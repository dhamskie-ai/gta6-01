// Wanted level (0–5 stars) + police AI (patrol cars + foot officers).
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
  // Spawn to match wanted level.
  const wantCars = G.wanted >= 2 ? Math.min(4, G.wanted - 1) : 0;
  const wantFoot = G.wanted === 1 ? 2 : G.wanted >= 2 ? 1 : 0;
  while (G.policeCars.length < wantCars) spawnPoliceCar(G);
  while (G.policeCars.length > wantCars) removePoliceCar(G, G.policeCars[0]);
  while (G.footPolice.length < wantFoot) spawnFootPolice(G);
  while (G.footPolice.length > wantFoot) removeFootPolice(G, G.footPolice[0]);
}

export function spawnPoliceCar(G) {
  const rng = G.rng;
  const p = G.player.pos;
  const a = rng.range(0, Math.PI * 2);
  const x = Math.max(-240, Math.min(240, p.x + Math.cos(a) * 70));
  const z = Math.max(-240, Math.min(240, p.z + Math.sin(a) * 70));
  const car = spawnCar(G, 'sedan', x, z, 0, 'police');
  car.group.children[0].material = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  // Light bar.
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  bar.position.set(0, 1.5, 0); car.group.add(bar);
  car.lightBar = bar;
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
  po.state = 'police'; po.speed = 3.2; po.bustT = 0;
  // Dark uniform via instance colours.
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
  for (const car of G.policeCars) {
    const dx = p.x - car.x, dz = p.z - car.z;
    const d = Math.hypot(dx, dz) || 1;
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
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.yaw;
    car.wheelSpin += car.speed * dt * 2.4;
    if (car.lightBar) car.lightBar.material.color.setHex(Math.sin(t * 10) > 0 ? 0xff2222 : 0x2244ff);
    // Ram the player's car.
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
      // Player in a car: officer stands and watches, radios it in.
      if (d < 30 && G.rng.chance(dt * 0.1)) addWanted(G, 0, '');
    }
    // Position/animation are written by updatePeds from x/z/yaw.
  }
  G.audio.updateSiren(t);
}
