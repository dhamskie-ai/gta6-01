// Wanted level + PCPD: foot cops, patrol cars, heli, heat, Spray & Shine.
import * as THREE from 'three';
import { CFG, CALLSIGNS } from './config.js';
import { makeCar, isCarObj } from './vehicles.js';
import { collideCircle } from './city.js';
import { driveCarRef } from './player.js';
import { hurtPlayer } from './combat.js';
import { sfx } from './audio.js';

export function setWanted(G, n) {
  G.wanted = Math.max(0, Math.min(CFG.maxWanted, n));
  G.stats.maxWanted = Math.max(G.stats.maxWanted, G.wanted);
  G.hiddenT = 0;
}
export function addWanted(G, n) { setWanted(G, G.wanted + n); }
let callIdx = 0;
function nextCallsign(G) {
  // Skip callsigns already used by a live unit (no duplicates in the panel).
  for (let tries = 0; tries < CALLSIGNS.length; tries++) {
    const c = CALLSIGNS[callIdx++ % CALLSIGNS.length];
    const used = [...(G.policeCars || []), ...(G.footCops || [])].some((u) => u.callsign === c);
    if (!used) return c;
  }
  return CALLSIGNS[callIdx++ % CALLSIGNS.length];
}
function nearRoad(v) {
  return CFG.roads.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), CFG.roads[0]);
}
function spawnPoliceCar(G) {
  // Snap to the nearest road so the car never spawns inside a building.
  const rx = nearRoad(G.player.x), rz = nearRoad(G.player.z);
  const alongRoad = Math.abs(G.player.x - rx) < Math.abs(G.player.z - rz);
  const x = alongRoad ? rx + 3.4 : Math.max(-310, Math.min(310, G.player.x + (G.rng.chance(0.5) ? 45 : -45)));
  const z = alongRoad ? Math.max(-310, Math.min(310, G.player.z + (G.rng.chance(0.5) ? 45 : -45))) : rz + 3.4;
  const car = makeCar(G, 'police', x, z, 0);
  car.policeCar = true;
  car.callsign = nextCallsign(G);
  car.ramT = 0;
  G.cars.push(car); G.policeCars.push(car);
  return car;
}
function spawnFootCop(G) {
  const rx = nearRoad(G.player.x);
  const x = rx + (G.rng.chance(0.5) ? 8 : -8);
  const z = Math.max(-310, Math.min(310, G.player.z + (G.rng.chance(0.5) ? 18 : -18)));
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.34), mat(0x1a2a4a));
  torso.position.y = 1.12; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), mat(0xc98a5e));
  head.position.y = 1.62; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.14, 10), mat(0x11151c));
  cap.position.y = 1.86; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.22), mat(0x1a2a4a));
  legL.position.set(-0.16, 0.38, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
  g.position.set(x, 0, z);
  G.scene.add(g);
  const cop = { g, x, z, heading: 0, callsign: nextCallsign(G), kind: 'cop' };
  G.footCops.push(cop);
  return cop;
}
function spawnHeli(G) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 2),
    new THREE.MeshLambertMaterial({ color: 0x1a2a4a }));
  g.add(body);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.1, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  rotor.position.y = 1.1; g.add(rotor);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(6, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = -13; g.add(beam);
  G.scene.add(g);
  G.heli = { g, rotor, a: 0 };
}
export function updatePolice(G, dt) {
  // Desired units from wanted level.
  const wantCars = G.wanted >= 1 ? Math.max(2, G.wanted + 1) : 0;
  const wantCops = G.wanted >= 1 ? 2 : 0;
  while (G.policeCars.length < wantCars) spawnPoliceCar(G);
  while (G.policeCars.length > wantCars) {
    const c = G.policeCars.pop();
    G.scene.remove(c.group);
    const i = G.cars.indexOf(c); if (i >= 0) G.cars.splice(i, 1);
  }
  while (G.footCops.length < wantCops) spawnFootCop(G);
  while (G.footCops.length > wantCops) {
    const c = G.footCops.pop();
    G.scene.remove(c.g);
  }
  if (G.wanted >= 3 && !G.heli) spawnHeli(G);
  if (G.wanted < 3 && G.heli) { G.scene.remove(G.heli.g); G.heli = null; }
  const px = G.player.x, pz = G.player.z;
  const pcar = driveCarRef(G);
  // Police cars chase + ram.
  for (const car of G.policeCars) {
    if (!isCarObj(car)) continue;
    const dx = px - car.x, dz = pz - car.z;
    const d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    let diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
    const target = d > 12 ? 42 : 26;
    car.speed += (target - car.speed) * Math.min(1, dt * 0.8);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    if (!collideCircle(G, nx, car.z, 1.6)) car.x = nx; else car.heading += 1.2 * dt * 10;
    if (!collideCircle(G, car.x, nz, 1.6)) car.z = nz;
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    car.ramT -= dt;
    if (d < 4.5 && car.ramT <= 0) {
      car.ramT = 0.5;
      if (pcar) pcar.speed *= 0.92;
      hurtPlayer(G, 0.2);
      sfx(G, 'punch');
    }
  }
  // Foot cops chase + hit at 1.6 m, 14 dmg/s.
  for (const cop of G.footCops) {
    const dx = px - cop.x, dz = pz - cop.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.1) {
      cop.heading = Math.atan2(dx, dz);
      cop.x += (dx / d) * 5 * dt;
      cop.z += (dz / d) * 5 * dt;
    }
    cop.g.position.set(cop.x, 0, cop.z);
    cop.g.rotation.y = cop.heading;
    if (d < 1.6) hurtPlayer(G, 14 * dt);
  }
  // Heli orbits 30 m, height 26.
  if (G.heli) {
    G.heli.a += dt * 0.3;
    G.heli.g.position.set(px + Math.cos(G.heli.a) * 30, 26, pz + Math.sin(G.heli.a) * 30);
    G.heli.rotor.rotation.y += dt * 20;
  }
  // Heat: far (>45 m) from every unit => hidden timer.
  let nearest = 1e9;
  for (const car of G.policeCars) nearest = Math.min(nearest, Math.hypot(car.x - px, car.z - pz));
  for (const cop of G.footCops) nearest = Math.min(nearest, Math.hypot(cop.x - px, cop.z - pz));
  if (G.wanted > 0 && nearest > 45) {
    G.hiddenT += dt;
    const pSpeed = pcar ? Math.abs(pcar.speed) : G.player.speed;
    if (G.hiddenT > 20) { setWanted(G, 0); G.centerMsg('PCPD kehilangan jejakmu.', 2.5); }
    else if (G.hiddenT > 10 && pSpeed < 2) { setWanted(G, G.wanted - 1); G.centerMsg('Bintang wanted turun.', 2); }
  } else G.hiddenT = 0;
  // Spray & Shine (132,60) r10: pay $100 per star, wanted 0.
  if (G.wanted > 0) {
    const d = Math.hypot(px - CFG.spray[0], pz - CFG.spray[1]);
    const cost = CFG.respray * G.wanted;
    if (d < 10 && G.cash >= cost) {
      G.cash -= cost;
      setWanted(G, 0);
      G.centerMsg(`Spray & Shine: -$${cost} — wanted bersih!`, 3);
      sfx(G, 'jingle');
    }
  }
}
