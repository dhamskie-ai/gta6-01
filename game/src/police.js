// Wanted system + PCPD: patrol cars, foot cops, helicopter, callsigns.
import * as THREE from 'three';
import { G, CFG, clamp, dist2 } from './config.js';
import { makeCar, isCarObj, syncCarMesh } from './vehicles.js';
import { collides } from './city.js';
import { addBurst } from './render.js';

export const CALLSIGNS = ['IBIS-43', 'TARPON-10', 'HERON-17', 'KESTREL-31', 'MARLIN-26',
  'OSPREY-08', 'PELICAN-11', 'GECKO-25', 'BARRACUDA-18', 'TAC-45', 'AIR-1'];
export function nextCallsign() {
  return CALLSIGNS[G._policeSeq++ % CALLSIGNS.length];
}
export function addWanted(n) {
  if (G.shotMode) return;
  G.wanted = clamp(G.wanted + n, 0, 5);
  G.heat = 1; G.hiddenT = 0;
  G.stats.maxWanted = Math.max(G.stats.maxWanted, G.wanted);
}
export function setWanted(n) {
  G.wanted = clamp(n, 0, 5);
  G.heat = n > 0 ? 1 : 0; G.hiddenT = 0;
  G.stats.maxWanted = Math.max(G.stats.maxWanted, G.wanted);
}
function policeCarMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const blackMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.9, 4.2), bodyMat);
  body.position.y = 0.75; body.castShadow = true; g.add(body);
  const doors = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.5, 1.6), blackMat);
  doors.position.y = 0.75; g.add(doors);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 1.8), bodyMat);
  cabin.position.set(0, 1.5, -0.2); g.add(cabin);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.08),
    new THREE.MeshLambertMaterial({ color: 0x1a2a3a }));
  shield.position.set(0, 1.5, 0.75); shield.rotation.x = -0.3; g.add(shield);
  // Split light bar: red left, blue right, flashing in alternation.
  const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.4), blackMat);
  barBase.position.set(0, 1.95, -0.2); g.add(barBase);
  const redMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const blueMat = new THREE.MeshBasicMaterial({ color: 0x2a6aff });
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.42), redMat);
  red.position.set(-0.3, 1.98, -0.2); g.add(red);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.42), blueMat);
  blue.position.set(0.3, 1.98, -0.2); g.add(blue);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const tyre = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [wx, wz] of [[-1, 1.35], [1, 1.35], [-1, -1.35], [1, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, tyre);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.36, wz); g.add(w);
  }
  g.userData = { redMat, blueMat };
  return g;
}
function footCopMesh() {
  const g = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1a2a55 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a070 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), navy);
  body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), skin);
  head.position.y = 1.62; g.add(head);
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.36), navy);
  hat.position.y = 1.82; g.add(hat);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), navy);
  legL.position.set(-0.14, 0.31, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.14; g.add(legR);
  return g;
}
export function spawnPoliceCar(x, z, callsign) {
  const group = policeCarMesh();
  group.position.set(x, 0, z);
  G.scene.add(group);
  const car = { group, type: 'police', name: 'PCPD Interceptor', x, z,
    heading: 0, speed: 0, hp: 100, max: 52, accel: 24,
    driver: 'police', isPlayerCar: false, callsign: callsign || nextCallsign(),
    role: 'PURSUIT', steer: 0 };
  car.group.userData.wheels = [];
  G.police.push({ kind: 'car', car, x, z, callsign: car.callsign, role: 'PURSUIT', punchT: 0 });
  return car;
}
export function spawnFootCop(x, z, callsign) {
  const group = footCopMesh();
  group.position.set(x, 0, z);
  G.scene.add(group);
  G.police.push({ kind: 'foot', group, x, z, heading: 0, speed: 0,
    callsign: callsign || nextCallsign(), role: 'PATROL', punchT: 0, hp: 50 });
  return G.police[G.police.length - 1];
}
function buildHeli() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a2a55 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 4.5), bodyMat);
  g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.3, 4.55),
    new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
  stripe.position.y = 0.3; g.add(stripe);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.2),
    new THREE.MeshLambertMaterial({ color: 0x9fd4e8 }));
  glass.position.set(0, 0.3, 1.8); g.add(glass);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 5), bodyMat);
  boom.position.set(0, 0.4, -4.2); g.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.6, 1.2), bodyMat);
  fin.position.set(0, 1, -6.4); g.add(fin);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.4), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  rotor.position.y = 1.1; g.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.3), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  tailRotor.position.set(0.4, 1, -6.4); g.add(tailRotor);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  beacon.position.set(0, -0.9, 0); g.add(beacon);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.rotation.x = Math.PI; cone.position.y = -13.5; g.add(cone);
  g.visible = false;
  G.scene.add(g);
  G.heli = { group: g, rotor, tailRotor, beacon, angle: 0 };
}
export function updatePolice(dt, audio) {
  const p = G.player;
  if (!p) return;
  if (!G.heli) buildHeli();
  // Desired units: foot cops at 1★, cars from 2★, heli from 3★.
  // In shot mode the scene stages its own units; never spawn/remove there.
  const wantCars = G.wanted >= 2 ? Math.min(G.wanted, 4) : 0;
  const wantFoot = G.wanted >= 1 ? Math.min(G.wanted, 3) : 0;
  const cars = G.police.filter((u) => u.kind === 'car');
  const feet = G.police.filter((u) => u.kind === 'foot');
  if (!G.shotMode) {
    while (cars.length < wantCars) {
      const a = Math.random() * Math.PI * 2;
      spawnPoliceCar(p.x + Math.cos(a) * 40, p.z + Math.sin(a) * 40);
    }
    while (feet.length < wantFoot) {
      const a = Math.random() * Math.PI * 2;
      spawnFootCop(p.x + Math.cos(a) * 12, p.z + Math.sin(a) * 12);
    }
    // Remove extras when wanted falls.
    while (cars.length > wantCars) {
      const u = cars.pop();
      G.scene.remove(u.car.group); G.police.splice(G.police.indexOf(u), 1);
    }
    while (feet.length > wantFoot) {
      const u = feet.pop();
      G.scene.remove(u.group); G.police.splice(G.police.indexOf(u), 1);
    }
  }
  const car = p.car;
  const px = p.x, pz = p.z;
  let seen = false;
  G.policeUnits = [];
  for (const u of G.police) {
    const d = dist2(u.x, u.z, px, pz);
    if (d < 60) seen = true;
    if (u.kind === 'car') {
      const c = u.car;
      const want = Math.atan2(px - c.x, pz - c.z);
      let dh = want - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const targetSpeed = d > 6 ? Math.min(52, 30 + G.wanted * 5) : 12;
      c.speed += clamp(targetSpeed - c.speed, -18 * dt, 12 * dt);
      c.heading += clamp(dh, -1.8 * dt, 1.8 * dt);
      const nx = c.x + Math.sin(c.heading) * c.speed * dt;
      const nz = c.z + Math.cos(c.heading) * c.speed * dt;
      if (!collides(nx, nz, 1.2)) { c.x = nx; c.z = nz; }
      else { c.heading += 0.8; c.speed *= 0.6; }
      u.x = c.x; u.z = c.z;
      c.group.position.set(c.x, 0, c.z);
      c.group.rotation.y = c.heading;
      // Flashing light bar, alternating.
      const on = Math.floor(G.elapsed * 6) % 2 === 0;
      c.group.userData.redMat.color.set(on ? 0xff2a2a : 0x551111);
      c.group.userData.blueMat.color.set(on ? 0x223355 : 0x2a6aff);
      // Ram the player car.
      if (car && isCarObj(car) && d < 4.5 && !G.shotMode) {
        car.hp = Math.max(0, car.hp - 6 * dt);
        car.speed *= (1 - 0.8 * dt);
        if (Math.random() < 0.02) addBurst(car.x, 1, car.z, 0xffaa33, 6, 4);
      }
      u.role = d < 15 ? 'RAMMING' : 'PURSUIT';
      G.policeUnits.push({ callsign: u.callsign, role: u.role, dist: Math.round(d) });
    } else {
      // Foot cop: chase on foot, punch when close.
      const want = Math.atan2(px - u.x, pz - u.z);
      u.heading = want;
      const sp = 6.5;
      const nx = u.x + Math.sin(want) * sp * dt;
      const nz = u.z + Math.cos(want) * sp * dt;
      if (!collides(nx, nz, 0.5)) { u.x = nx; u.z = nz; }
      u.group.position.set(u.x, 0, u.z);
      u.group.rotation.y = want;
      u.punchT -= dt;
      if (d < 1.6 && u.punchT <= 0 && !car) {
        u.punchT = 1.1;
        G.health = Math.max(0, G.health - 4);
        if (audio) audio.punch();
      }
      G.policeUnits.push({ callsign: u.callsign, role: 'PATROL', dist: Math.round(d) });
    }
  }
  // Helicopter at wanted ≥ 3.
  const heli = G.heli;
  if (heli) {
    const show = G.wanted >= 3 && G.phase === 'play';
    heli.group.visible = show;
    if (show) {
      heli.angle += dt * 0.25;
      heli.group.position.set(px + Math.cos(heli.angle) * 30, 26, pz + Math.sin(heli.angle) * 30);
      heli.group.rotation.y = -heli.angle;
      heli.rotor.rotation.y += dt * 22;
      heli.tailRotor.rotation.x += dt * 18;
      heli.beacon.material.color.set(Math.floor(G.elapsed * 3) % 2 ? 0xff2a2a : 0x551111);
    }
  }
  if (audio) audio.siren(G.wanted > 0 && G.phase === 'play');
  // Wanted decay: hidden 10 s → heat falls; 20 s hidden → cleared.
  if (G.wanted > 0 && !G.shotMode) {
    if (seen) { G.hiddenT = 0; }
    else {
      G.hiddenT += dt;
      if (G.hiddenT > CFG.wantedDecaySeen) G.heat = Math.max(0, G.heat - dt * 0.1);
      if (G.hiddenT > CFG.wantedClearHidden) {
        G.wanted = 0; G.heat = 0; G.hiddenT = 0;
      }
    }
  }
  // Spray & Shine: drive through to clear stars for $100/star.
  if (car && isCarObj(car) && G.wanted > 0 && !G.shotMode) {
    if (dist2(car.x, car.z, CFG.sprayPos[0], CFG.sprayPos[1]) < 8) {
      const cost = G.wanted * CFG.sprayCost;
      if (G.cash >= cost) {
        G.cash -= cost; G.wanted = 0; G.heat = 0; G.hiddenT = 0;
      }
    }
  }
  // Busted: foot cop on top of you on foot while wanted.
  if (!car && G.wanted > 0) {
    for (const u of G.police) {
      if (u.kind === 'foot' && dist2(u.x, u.z, px, pz) < 1.4) {
        G.bustedT = (G.bustedT || 0) + dt;
        if (G.bustedT > 2.5) { G.overKind = 'busted'; G.phase = 'over'; }
      }
    }
  } else G.bustedT = 0;
}
