// Car models (procedural, box-based) + arcade driving physics.
import * as THREE from 'three';
import { G, CFG, clamp } from './config.js';
import { collides } from './city.js';
import { RNG } from './random.js';

export const CAR_TYPES = {
  sedan: { name: 'Cometa', max: 44, accel: 20, color: 0x3a6ad8 },
  hatch: { name: 'Pip', max: 42, accel: 19, color: 0xffd23e },
  taxi: { name: 'Cabro', max: 44, accel: 20, color: 0xffc61a },
  van: { name: 'Mula', max: 38, accel: 16, color: 0x8a8f96 },
  sport: { name: 'Veloce GT', max: 58, accel: 26, color: 0xff2e7e },
  truck: { name: 'Hauler', max: 34, accel: 14, color: 0x5a6a3a },
  bus: { name: 'Solara Bus', max: 36, accel: 13, color: 0x2a9a6a },
};
export function isCarObj(c) {
  return !!c && typeof c === 'object' && !!c.group && typeof c.speed === 'number';
}
const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.32, 8);
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1d22 });
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
const hubMat = new THREE.MeshLambertMaterial({ color: 0xc8ccd2 });

export function createCarMesh(type, color) {
  const t = CAR_TYPES[type] || CAR_TYPES.sedan;
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const L = type === 'truck' ? 5.2 : type === 'bus' ? 7 : type === 'van' ? 4.6 : 4.2;
  const W = type === 'bus' ? 2.5 : 2.0;
  const H = type === 'truck' || type === 'van' || type === 'bus' ? 1.5 : 0.95;
  const body = new THREE.Mesh(bodyGeo, paint);
  body.scale.set(W, H, L); body.position.y = 0.75; body.castShadow = true;
  g.add(body);
  if (type !== 'truck') {
    const cabin = new THREE.Mesh(bodyGeo, paint);
    cabin.scale.set(W * 0.86, 0.72, L * 0.42); cabin.position.set(0, H + 0.32, -L * 0.06);
    cabin.castShadow = true; g.add(cabin);
    const roof = new THREE.Mesh(bodyGeo, paint);
    roof.scale.set(W * 0.8, 0.1, L * 0.4); roof.position.set(0, H + 0.72, -L * 0.06);
    g.add(roof);
    const shield = new THREE.Mesh(bodyGeo, glassMat);
    shield.scale.set(W * 0.8, 0.55, 0.08);
    shield.position.set(0, H + 0.35, L * 0.17); shield.rotation.x = -0.35;
    g.add(shield);
  } else {
    const bed = new THREE.Mesh(bodyGeo, darkMat);
    bed.scale.set(W * 0.9, 0.7, L * 0.45); bed.position.set(0, 1.35, -L * 0.2);
    g.add(bed);
  }
  // Mirrors, bumpers, lights.
  for (const s of [-1, 1]) {
    const mir = new THREE.Mesh(bodyGeo, darkMat);
    mir.scale.set(0.12, 0.18, 0.3); mir.position.set(s * (W / 2 + 0.08), H + 0.45, L * 0.18);
    g.add(mir);
  }
  const bumpF = new THREE.Mesh(bodyGeo, darkMat);
  bumpF.scale.set(W + 0.1, 0.28, 0.25); bumpF.position.set(0, 0.42, L / 2 + 0.05); g.add(bumpF);
  const bumpR = bumpF.clone(); bumpR.position.z = -L / 2 - 0.05; g.add(bumpR);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(bodyGeo, lightMat);
    hl.scale.set(0.4, 0.18, 0.08); hl.position.set(s * (W / 2 - 0.35), 0.85, L / 2 + 0.02); g.add(hl);
    const tl = new THREE.Mesh(bodyGeo, tailMat);
    tl.scale.set(0.4, 0.16, 0.08); tl.position.set(s * (W / 2 - 0.35), 0.85, -L / 2 - 0.02); g.add(tl);
  }
  if (type === 'sport') {
    const sp = new THREE.Mesh(bodyGeo, paint);
    sp.scale.set(W * 0.9, 0.08, 0.5); sp.position.set(0, 1.35, -L / 2 + 0.15); g.add(sp);
    for (const s of [-1, 1]) {
      const strut = new THREE.Mesh(bodyGeo, darkMat);
      strut.scale.set(0.08, 0.35, 0.08); strut.position.set(s * (W / 2 - 0.3), 1.15, -L / 2 + 0.15);
      g.add(strut);
    }
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    sign.scale.set(0.9, 0.22, 0.5); sign.position.set(0, H + 0.85, -L * 0.06); g.add(sign);
  }
  // Wheels + hubcaps.
  const wheels = [];
  for (const [wx, wz] of [[-W / 2, L * 0.32], [W / 2, L * 0.32], [-W / 2, -L * 0.32], [W / 2, -L * 0.32]]) {
    const w = new THREE.Mesh(wheelGeo, tyreMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.36, wz); w.castShadow = true;
    g.add(w);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2; hub.position.set(wx, 0.36, wz); g.add(hub);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  return g;
}
export function makeCar(type, x, z, heading, color) {
  const t = CAR_TYPES[type] || CAR_TYPES.sedan;
  const col = color !== undefined ? color : t.color;
  const group = createCarMesh(type, col);
  group.position.set(x, 0, z); group.rotation.y = heading;
  G.scene.add(group);
  const car = { group, type, name: t.name, color: col, x, z, heading,
    speed: 0, hp: 100, max: t.max, accel: t.accel,
    driver: null, isPlayerCar: false, callsign: null, role: null,
    steer: 0, smokeT: 0 };
  return car;
}
export function syncCarMesh(car) {
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  const spin = car.speed * 0.5;
  for (const w of car.group.userData.wheels) w.rotation.x += spin * 0.016;
}
export function carForward(car) {
  return { x: Math.sin(car.heading), z: Math.cos(car.heading) };
}
function bumpCars(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const d = Math.hypot(dx, dz) || 0.01;
  const min = 3.4;
  if (d < min) {
    const push = (min - d) / 2;
    const nx = dx / d, nz = dz / d;
    a.x -= nx * push; a.z -= nz * push;
    b.x += nx * push; b.z += nz * push;
    if (!G.shotMode) {
      a.speed *= 0.6; b.speed *= 0.6;
      if (isCarObj(a) && a.isPlayerCar) a.hp = Math.max(0, a.hp - 1);
      if (isCarObj(b) && b.isPlayerCar) b.hp = Math.max(0, b.hp - 1);
    }
    return true;
  }
  return false;
}
// Arcade player-car physics. input: {y: throttle -1..1, x: steer -1..1, brake, hand}
export function updatePlayerCar(car, dt, input) {
  if (!isCarObj(car)) return;
  const fwd = carForward(car);
  const throttle = input.y;
  if (throttle > 0) car.speed += car.accel * throttle * dt;
  else if (throttle < 0) car.speed -= (car.speed > 0.5 ? CFG.carBrake : CFG.carReverse * 1.4) * dt;
  if (input.brake || input.hand) car.speed -= Math.sign(car.speed) * CFG.carBrake * dt * 0.8;
  if (!G.shotMode) car.speed -= car.speed * 0.35 * dt; // drag
  if (input.hand) car.speed *= Math.max(0, 1 - 2.2 * dt);
  car.speed = clamp(car.speed, -CFG.carReverse, car.max);
  if (Math.abs(car.speed) < 0.05) car.speed = 0;
  const steerAuthority = clamp(Math.abs(car.speed) / 8, 0, 1);
  car.heading += input.x * 1.9 * steerAuthority * dt * Math.sign(car.speed || 1);
  let nx = car.x + fwd.x * car.speed * dt;
  let nz = car.z + fwd.z * car.speed * dt;
  if (collides(nx, nz, 1.1)) {
    // Slide along the wall instead of stopping dead.
    if (!collides(nx, car.z, 1.1)) { car.z = car.z; }
    else if (!collides(car.x, nz, 1.1)) { car.x = car.x; }
    else {
      if (!G.shotMode) { car.speed *= 0.4; car.hp = Math.max(0, car.hp - 2); }
      else car.speed *= 0.7;
      nx = car.x; nz = car.z;
    }
    if (!collides(nx, car.z, 1.1)) car.x = nx;
    if (!collides(car.x, nz, 1.1)) car.z = nz;
  } else { car.x = nx; car.z = nz; }
  for (const o of G.cars) {
    if (o !== car && isCarObj(o)) bumpCars(car, o);
  }
  for (const t of G.traffic) if (isCarObj(t)) bumpCars(car, t);
  if (car.hp < 35 && car.hp > 0) {
    car.smokeT -= dt;
    if (car.smokeT <= 0) { car.smokeT = 0.12; }
  }
  syncCarMesh(car);
}
export function spawnParked(rng) {
  const spots = [];
  const types = ['sedan', 'hatch', 'sedan', 'van', 'hatch', 'taxi'];
  let placed = 0, guard = 0;
  while (placed < CFG.parkedN && guard++ < 400) {
    const road = rng.pick(CFG.roads);
    const along = rng.range(-280, 280);
    const horiz = rng.chance(0.5);
    const x = horiz ? along : road + rng.pick([-8.5, 8.5]);
    const z = horiz ? road + rng.pick([-8.5, 8.5]) : along;
    if (collides(x, z, 2)) continue;
    if (Math.hypot(x - CFG.velozPos[0], z - CFG.velozPos[1]) < 12) continue;
    if (Math.hypot(x - CFG.meetPos[0], z - CFG.meetPos[1]) < 14) continue;
    const type = types[placed % types.length];
    const car = makeCar(type, x, z, horiz ? Math.PI / 2 : 0);
    car.driver = 'parked';
    G.cars.push(car); spots.push(car); placed++;
  }
  return spots;
}
export function velozCar() {
  const car = makeCar('sport', CFG.velozPos[0], CFG.velozPos[1], Math.PI, 0xff2e7e);
  car.name = 'Veloz Comet RS'; car.isPlayerCar = true; car.driver = 'player';
  G.cars.push(car);
  return car;
}
