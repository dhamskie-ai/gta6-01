// Wanted level (0–5 stars) + police AI: patrol cars, foot officers,
// the helicopter, and — at 4 stars and up — a roadblock unit that
// parks across the road ahead of the player.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { spawnCar } from './vehicles.js';
import { collideBuildings } from './city.js';
import { removePed } from './traffic.js';
export function addWanted(G, stars, reason) {
  if (G.wanted >= CONFIG.maxWanted) return;
  G.wanted = Math.min(CONFIG.maxWanted, G.wanted + stars);
  G.stats.maxWanted = Math.max(G.stats.maxWanted, G.wanted);
  G.hiddenT = 0;
  if (reason) G.hud.toast(`Wanted +${stars} — ${reason}`);
  G.audio.setSiren(G.wanted > 0);
}
export function updateWantedLevel(G, dt) {
  const p = G.player.pos;
  let nearest = Infinity;
  for (const pc of G.policeCars) nearest = Math.min(nearest, Math.hypot(pc.x - p.x, pc.z - p.z));
  for (const po of G.footPolice) nearest = Math.min(nearest, Math.hypot(po.x - p.x, po.z - p.z));
  if (G.wanted > 0) {
    if (nearest > 45) {
      G.hiddenT += dt;
      if (G.hiddenT > CONFIG.wantedDecayHidden) {
        G.wanted = Math.max(0, G.wanted - 1);
        G.hiddenT = CONFIG.wantedDecayHidden - 5;
        if (G.wanted === 0) { G.hud.toast('You lost them. Heat is off.'); G.audio.setSiren(false); }
      }
    } else G.hiddenT = 0;
  }
  const wantCars = G.wanted >= 2 ? Math.min(4, G.wanted - 1) : 0;
  const wantFoot = G.wanted === 1 ? 2 : G.wanted >= 2 ? 1 : 0;
  while (G.policeCars.length < wantCars) spawnPoliceCar(G);
  while (G.policeCars.length > wantCars) removePoliceCar(G, G.policeCars[0]);
  while (G.footPolice.length < wantFoot) {
    if (!spawnFootPolice(G)) break;
  }
  while (G.footPolice.length > wantFoot) removeFootPolice(G, G.footPolice[0]);
}
const CALLSIGNS = ['IBIS-43', 'TARPON-10', 'HERON-17', 'KESTREL-31', 'MARLIN-26', 'OSPREY-08'];
export function spawnPoliceCar(G) {
  const rng = G.rng;
  const p = G.player.pos;
  const a = rng.range(0, Math.PI * 2);
  const x = Math.max(-240, Math.min(240, p.x + Math.cos(a) * 70));
  const z = Math.max(-240, Math.min(240, p.z + Math.sin(a) * 70));
  const car = spawnCar(G, 'sedan', x, z, 0, 'police');
  car.group.children[0].material = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const barRed = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  barRed.position.set(-0.32, 1.5, 0); car.group.add(barRed);
  const barBlue = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
  barBlue.position.set(0.32, 1.5, 0); car.group.add(barBlue);
  car.lightBarRed = barRed;
  car.lightBarBlue = barBlue;
  car.callsign = CALLSIGNS[(G._policeSeq = (G._policeSeq || 0) + 1, (G._policeSeq - 1) % CALLSIGNS.length)];
  car.role = 'PURSUIT';
  car.speed = 10; car.cruise = 30;
  G.policeCars.push(car);
  return car;
}
function removePoliceCar(G, car) {
  G.scene.remove(car.group);
  G.cars.splice(G.cars.indexOf(car), 1);
  G.policeCars.splice(G.policeCars.indexOf(car), 1);
}
export function spawnFootPolice(G) {
  const p = G.player.pos;
  const a = G.rng.range(0, Math.PI * 2);
  const po = G.spawnPed(p.x + Math.cos(a) * 25, p.z + Math.sin(a) * 25);
  if (!po) return null;
  po.state = 'police'; po.speed = 3.2; po.bustT = 0;
  G.pedMeshes.body.setColorAt(po.slot, new THREE.Color(0x1a2a4a));
  G.pedMeshes.armL.setColorAt(po.slot, new THREE.Color(0x1a2a4a));
  G.pedMeshes.armR.setColorAt(po.slot, new THREE.Color(0x1a2a4a));
  G.pedMeshes.body.instanceColor.needsUpdate = true;
  G.pedMeshes.armL.instanceColor.needsUpdate = true;
  G.pedMeshes.armR.instanceColor.needsUpdate = true;
  G.footPolice.push(po);
  return po;
}
function removeFootPolice(G, po) {
  removePed(G, po);
  G.footPolice.splice(G.footPolice.indexOf(po), 1);
}
export function updatePolice(G, dt) {
  const p = G.player.pos;
  const t = G.time;
  let farthest = null, farD = -1;
  for (const car of G.policeCars) {
    const d = Math.hypot(p.x - car.x, p.z - car.z);
    if (d > farD) { farD = d; farthest = car; }
  }
  for (const car of G.policeCars) {
    const dx = p.x - car.x, dz = p.z - car.z;
    const d = Math.hypot(dx, dz) || 1;
    car.role = d < 25 ? 'RAMMING' : 'PURSUIT';
    if (G.wanted >= 4 && car === farthest && G.policeCars.length > 1) car.role = 'ROADBLOCK';
    if (car.role === 'ROADBLOCK') {
      const hx = G.playerCar ? Math.sin(G.playerCar.yaw) : Math.sin(G.player.yaw);
      const hz = G.playerCar ? Math.cos(G.playerCar.yaw) : Math.cos(G.player.yaw);
      const tx = p.x + hx * 26, tz = p.z + hz * 26;
      const bx = tx - car.x, bz = tz - car.z;
      const bd = Math.hypot(bx, bz) || 1;
      const wantYaw = Math.atan2(bx, bz);
      let diff = wantYaw - car.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.yaw += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
      car.speed += ((bd > 5 ? 24 : 0) - car.speed) * Math.min(1, dt * 1.2);
      const nx = car.x + Math.sin(car.yaw) * car.speed * dt;
      const nz = car.z + Math.cos(car.yaw) * car.speed * dt;
      const res = collideBuildings(G, nx, nz, 1.6);
      car.x = res.x; car.z = res.z;
    } else {
      const wantYaw = Math.atan2(dx, dz);
      let diff = wantYaw - car.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.yaw += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
      const targetSpeed = d > 6 ? 30 : 12;
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
      const nx = car.x + Math.sin(car.yaw) * car.speed * dt;
      const nz = car.z + Math.cos(car.yaw) * car.speed * dt;
      const res = collideBuildings(G, nx, nz, 1.6);
      car.x = res.x; car.z = res.z;
    }
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.yaw;
    car.wheelSpin += car.speed * dt * 2.4;
    const redOn = Math.sin(t * 10) > 0;
    if (car.lightBarRed) {
      car.lightBarRed.material.color.setHex(redOn ? 0xff2222 : 0x550000);
      car.lightBarBlue.material.color.setHex(redOn ? 0x000044 : 0x2244ff);
    }
    if (G.playerCar && d < 3.6) {
      G.playerCar.speed *= 0.85;
      G.playerCar.health -= 2 * dt * 10;
      if (G.playerCar.health <= 0) G.explodeCar(G.playerCar);
    }
  }
  for (const po of [...G.footPolice]) {
    const dx = p.x - po.x, dz = p.z - po.z;
    const d = Math.hypot(dx, dz) || 1;
    po.yaw = Math.atan2(dx, dz);
    if (G.player.onFoot) {
      po.x += (dx / d) * po.speed * dt; po.z += (dz / d) * po.speed * dt;
      if (d < 1.6) {
        po.bustT += dt;
        if (po.bustT > 2) { G.busted(); return; }
      } else po.bustT = 0;
      if (d < 8) G.hud.showPrompt('Police closing in — run!');
    } else {
      if (d < 30 && G.rng.chance(dt * 0.1)) addWanted(G, 0, '');
    }
  }
  updateHelicopter(G, dt);
  G.audio.updateSiren(t);
}
function buildHelicopter(G) {
  const heli = new THREE.Group();
  const darkBlue = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 4.2), darkBlue);
  heli.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.4, 4.24), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  stripe.position.y = 0.1; heli.add(stripe);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 1.2), new THREE.MeshLambertMaterial({ color: 0x9fd8e8 }));
  glass.position.set(0, 0.2, 2.0); heli.add(glass);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.5), darkBlue);
  boom.position.set(0, 0.3, -4.0); heli.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 1.0), darkBlue);
  fin.position.set(0, 0.9, -6.0); heli.add(fin);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  rotor.position.y = 1.1; heli.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.4), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  tailRotor.position.set(0.4, 0.9, -6.0); heli.add(tailRotor);
  const skidMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  for (const sx of [-0.9, 0.9]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 4.4), skidMat);
    skid.position.set(sx, -1.1, 0); heli.add(skid);
  }
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff2222 }),
  );
  beacon.position.set(0, -0.95, 0); heli.add(beacon);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(5, 24, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff2b0, transparent: true, opacity: 0.14,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }),
  );
  cone.position.y = -13; heli.add(cone);
  heli.visible = false;
  G.scene.add(heli);
  G._heli = { group: heli, rotor, tailRotor, beacon, angle: Math.PI / 2 };
  return G._heli;
}
function updateHelicopter(G, dt) {
  if (!G._heli) buildHelicopter(G);
  const heli = G._heli;
  if (G.wanted < 3) {
    heli.group.visible = false;
    return;
  }
  heli.group.visible = true;
  heli.angle += dt * 0.22;
  const p = G.player.pos;
  heli.group.position.set(
    p.x + Math.cos(heli.angle) * 30,
    14 + Math.sin(G.time * 0.4) * 1.5,
    p.z + Math.sin(heli.angle) * 30,
  );
  heli.group.rotation.y = -heli.angle;
  heli.rotor.rotation.y += dt * 18;
  heli.tailRotor.rotation.x += dt * 22;
  heli.beacon.material.color.setHex(Math.sin(G.time * 6) > 0 ? 0xff2222 : 0x550000);
}
