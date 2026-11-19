import { CFG, CAR_DEFS } from './config.js';
import { rr, ri, pick, chance } from './random.js';
import { makeCar } from './vehicles.js';
import { createPersonMesh } from './player.js';
import { lightStateAt, randomRoadPoint } from './city.js';

const TRAFFIC_TYPES = ['cometa', 'pip', 'cabro', 'mula', 'cometa', 'pip'];

export function initTraffic(G, rng) {
  G.traffic = [];
  G.peds = [];
  G.parked = [];
  const used = new Set();
  for (let i = 0; i < CFG.trafficCount; i++) {
    const axis = chance(rng, 0.5) ? 'x' : 'z';
    const line = pick(rng, CFG.roads);
    const dir = chance(rng, 0.5) ? 1 : -1;
    const lane = dir > 0 ? 2.2 : -2.2;
    const along = rr(rng, -280, 280);
    const x = axis === 'x' ? along : line + lane;
    const z = axis === 'x' ? line + lane : along;
    const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const type = pick(rng, TRAFFIC_TYPES);
    const car = makeCar(type, x, z, heading);
    car.speed = rr(rng, 8, 14);
    G.W.scene.add(car.group);
    G.traffic.push({ car, axis, line, dir, speed: car.speed, targetSpeed: rr(rng, 9, 15), hornCd: 0 });
  }
  const fixedSpots = [
    { type: 'bus', x: -236, z: 40, heading: 0 },
    { type: 'taco', x: -236, z: 130, heading: 0 },
    { type: 'veloce', x: -232, z: 70, heading: 0 },
  ];
  for (const s of fixedSpots) {
    const car = makeCar(s.type, s.x, s.z, s.heading);
    car.speed = 0;
    G.W.scene.add(car.group);
    G.parked.push(car);
  }
  let tries = 0;
  while (G.parked.length < CFG.parkedCount + 3 && tries < 200) {
    tries++;
    const p = randomRoadPoint(rng);
    const axis = chance(rng, 0.5) ? 'x' : 'z';
    const off = chance(rng, 0.5) ? 4.4 : -4.4;
    const x = axis === 'x' ? p.x : p.x + off;
    const z = axis === 'x' ? p.z + off : p.z;
    const key = `${Math.round(x / 10)}:${Math.round(z / 10)}`;
    if (used.has(key)) continue;
    if (Math.abs(x + 240) < 3 && Math.abs(z - 90) < 8) continue; // keep Marlin Ceviche clear
    used.add(key);
    const type = pick(rng, ['cometa', 'pip', 'cabro', 'mula', 'veloce']);
    const car = makeCar(type, x, z, axis === 'x' ? Math.PI / 2 : 0);
    car.speed = 0;
    G.W.scene.add(car.group);
    G.parked.push(car);
  }
  const shirtCols = [0xd95f5f, 0x5f8fd9, 0x63c06a, 0xe8b93a, 0x9a6fd0, 0xe87ab0, 0x4fb3a9, 0xd9d9d9];
  const skinCols = [0xc98d64, 0x8a5a3a, 0xe8b88a, 0x6b4426];
  for (let i = 0; i < CFG.pedCount; i++) {
    const p = randomRoadPoint(rng);
    const axis = chance(rng, 0.5) ? 'x' : 'z';
    const side = chance(rng, 0.5) ? 1 : -1;
    const x = axis === 'x' ? p.x : p.x + side * 6.8;
    const z = axis === 'x' ? p.z + side * 6.8 : p.z;
    const mesh = createPersonMesh({
      shirt: pick(rng, shirtCols), pants: pick(rng, [0x2e3440, 0x5a4632, 0x3a4a5a]), skin: pick(rng, skinCols),
    });
    mesh.position.set(x, 0, z);
    G.W.scene.add(mesh);
    G.peds.push({
      mesh, x, z, axis, side, dir: chance(rng, 0.5) ? 1 : -1,
      speed: rr(rng, 1.0, 1.9), flee: 0, walkPhase: rr(rng, 0, 6),
      name: 'Ped', hp: 30,
    });
  }
}

export function nearestParkedCar(G, x, z, maxD) {
  let best = null, bestD = maxD;
  for (const car of G.parked) {
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best ? { car: best, d: bestD } : null;
}

export function nearestTrafficCar(G, x, z, maxD) {
  let best = null, bestD = maxD;
  for (const t of G.traffic) {
    const d = Math.hypot(t.car.x - x, t.car.z - z);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best ? { t: best, d: bestD } : null;
}

export function updateTraffic(G, dt, elapsed) {
  const px = G.inCar && G.car ? G.car.x : G.player.x;
  const pz = G.inCar && G.car ? G.car.z : G.player.z;
  for (const t of G.traffic) {
    const car = t.car;
    let want = t.targetSpeed;
    const aheadX = car.x + Math.sin(car.heading) * 12;
    const aheadZ = car.z + Math.cos(car.heading) * 12;
    const onAxis = t.axis;
    if (lightStateAt(G.city, aheadX, aheadZ, onAxis, elapsed) === 'red') want = 0;
    for (const o of G.traffic) {
      if (o === t || o.axis !== t.axis || o.line !== t.line || o.dir !== t.dir) continue;
      const along = t.axis === 'x' ? (o.car.x - car.x) * t.dir : (o.car.z - car.z) * t.dir;
      const lateral = t.axis === 'x' ? Math.abs(o.car.z - car.z) : Math.abs(o.car.x - car.x);
      if (along > 0 && along < 9 && lateral < 3) { want = Math.min(want, o.car.speed * 0.6); break; }
    }
    if (G.car) {
      const along = t.axis === 'x' ? (G.car.x - car.x) * t.dir : (G.car.z - car.z) * t.dir;
      const lateral = t.axis === 'x' ? Math.abs(G.car.z - car.z) : Math.abs(G.car.x - car.x);
      if (along > 0 && along < 8 && lateral < 3.2) {
        want = 0;
        t.hornCd -= dt;
        if (t.hornCd <= 0) { G.audio.horn(); t.hornCd = 5; }
      }
    }
    car.speed += (want - car.speed) * Math.min(1, dt * 1.6);
    if (t.axis === 'x') {
      car.x += t.dir * car.speed * dt;
      if (car.x > 288) car.x = -288;
      if (car.x < -288) car.x = 288;
      car.z = t.line + (t.dir > 0 ? 2.2 : -2.2);
    } else {
      car.z += t.dir * car.speed * dt;
      if (car.z > 288) car.z = -288;
      if (car.z < -288) car.z = 288;
      car.x = t.line + (t.dir > 0 ? 2.2 : -2.2);
    }
    car.group.position.set(car.x, 0, car.z);
    const spin = car.speed * dt / 0.36;
    for (const w of car.group.userData.wheels) { w.wheel.rotation.y += spin; }
  }
  for (const p of G.peds) {
    const dPlayer = Math.hypot(p.x - px, p.z - pz);
    if (G._panic > 0 && dPlayer < 26) p.flee = 2.5;
    if (G.inCar && G.car && Math.abs(G.car.speed) > 6 && dPlayer < 6) p.flee = 2;
    let spd = p.speed;
    if (p.flee > 0) { p.flee -= dt; spd = 5.2; }
    if (p.axis === 'x') {
      p.x += p.dir * spd * dt;
      if (p.flee > 0) p.z += (p.z > pz ? 1 : -1) * spd * 0.4 * dt;
      if (p.x > 286 || p.x < -286) p.dir *= -1;
      if (Math.random() < dt * 0.02) p.dir *= -1;
    } else {
      p.z += p.dir * spd * dt;
      if (p.flee > 0) p.x += (p.x > px ? 1 : -1) * spd * 0.4 * dt;
      if (p.z > 286 || p.z < -286) p.dir *= -1;
      if (Math.random() < dt * 0.02) p.dir *= -1;
    }
    p.walkPhase += dt * spd * 3.2;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.axis === 'x' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
    const swing = Math.sin(p.walkPhase) * 0.55;
    p.mesh.userData.legL.rotation.x = swing;
    p.mesh.userData.legR.rotation.x = -swing;
    p.mesh.userData.armL.rotation.x = -swing * 0.7;
    p.mesh.userData.armR.rotation.x = swing * 0.7;
  }
}
