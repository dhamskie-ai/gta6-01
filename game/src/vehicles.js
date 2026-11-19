// SOLARA BAY — procedural HD car models + arcade driving physics.
// Round 6f: every car is built from layered crisp geometry — lower body,
// hood/trunk shaping, glass cabin, bumpers, grille, mirrors, spoiler,
// emissive headlights/taillights, wheels with hub + spokes — so cars read
// sharp at any distance instead of flat coloured boxes. All cars stay
// drivable: E to enter, W/S throttle/brake, A/D steer, Shift handbrake.
import * as THREE from 'three';
import { CAR_DEFS } from './config.js';
import { collideCircle } from './city.js';

const bodyMatCache = new Map();
function bodyMat(colorHex) {
  if (!bodyMatCache.has(colorHex)) {
    bodyMatCache.set(colorHex, new THREE.MeshLambertMaterial({ color: colorHex }));
  }
  return bodyMatCache.get(colorHex);
}
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2c3a, emissive: 0x0e1a24, emissiveIntensity: 0.5 });
const chromeMat = new THREE.MeshLambertMaterial({ color: 0xc8ccd2, emissive: 0x30343a, emissiveIntensity: 0.3 });
const tireMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
const hubMat = new THREE.MeshLambertMaterial({ color: 0xd8dce2, emissive: 0x555a60, emissiveIntensity: 0.4 });
const darkMat = new THREE.MeshLambertMaterial({ color: 0x14181f });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function makeWheel(r) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.32, 14), tireMat);
  tire.rotation.x = Math.PI / 2;
  tire.castShadow = true;
  g.add(tire);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.34, 10), hubMat);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.07, r * 0.9, 0.36), darkMat);
    spoke.rotation.z = (i / 5) * Math.PI;
    g.add(spoke);
  }
  return g;
}

export function buildCarMesh(type, colorHex, withLight) {
  const def = CAR_DEFS[type] || CAR_DEFS.cometa;
  const L = def.len, Wd = def.wid;
  const g = new THREE.Group();
  const body = bodyMat(colorHex);
  const tall = type === 'van' || type === 'bus' || type === 'truck';
  const bodyH = tall ? 1.15 : 0.72;
  const bodyY = tall ? 0.95 : 0.62;
  // Lower body + shaped hood/trunk.
  g.add(box(L, bodyH, Wd, body, 0, bodyY, 0));
  g.add(box(L * 0.22, bodyH * 0.55, Wd * 0.96, body, L * 0.42, bodyY + bodyH * 0.28, 0));
  g.add(box(L * 0.2, bodyH * 0.5, Wd * 0.96, body, -L * 0.43, bodyY + bodyH * 0.26, 0));
  // Glass cabin.
  const cabL = tall ? L * 0.55 : L * 0.48;
  const cab = box(cabL, tall ? 0.95 : 0.55, Wd * 0.86, glassMat, tall ? -L * 0.08 : -L * 0.06, bodyY + bodyH / 2 + (tall ? 0.5 : 0.3), 0);
  g.add(cab);
  // Roof panel over the glass (sedan/sport only).
  if (!tall) g.add(box(cabL * 0.82, 0.07, Wd * 0.8, body, -L * 0.06, bodyY + bodyH / 2 + 0.6, 0));
  // Bumpers, grille, mirrors.
  g.add(box(0.24, 0.3, Wd * 0.98, chromeMat, L / 2 + 0.02, 0.42, 0));
  g.add(box(0.24, 0.3, Wd * 0.98, chromeMat, -L / 2 - 0.02, 0.42, 0));
  g.add(box(0.1, 0.28, Wd * 0.5, darkMat, L / 2 + 0.06, 0.62, 0));
  g.add(box(0.16, 0.12, 0.3, body, L * 0.28, bodyY + bodyH / 2 + 0.12, Wd / 2 + 0.06));
  g.add(box(0.16, 0.12, 0.3, body, L * 0.28, bodyY + bodyH / 2 + 0.12, -Wd / 2 - 0.06));
  // Headlights + taillights (emissive, crisp at night).
  const hlY = bodyY + 0.12;
  g.add(box(0.08, 0.2, 0.34, headMat, L / 2 + 0.05, hlY, Wd / 2 - 0.28));
  g.add(box(0.08, 0.2, 0.34, headMat, L / 2 + 0.05, hlY, -Wd / 2 + 0.28));
  g.add(box(0.08, 0.18, 0.4, tailMat, -L / 2 - 0.05, hlY, Wd / 2 - 0.3));
  g.add(box(0.08, 0.18, 0.4, tailMat, -L / 2 - 0.05, hlY, -Wd / 2 + 0.3));
  // Type extras: taxi sign, sport spoiler, police light bar, truck bed.
  if (type === 'cabro') {
    g.add(box(0.9, 0.22, 0.5, new THREE.MeshBasicMaterial({ color: 0xffe45c }), -L * 0.06, bodyY + bodyH / 2 + 0.68, 0));
    g.add(box(L * 0.98, 0.3, Wd + 0.04, new THREE.MeshLambertMaterial({ color: 0x14181f }), 0, bodyY - 0.05, 0));
  }
  if (type === 'veloce') {
    g.add(box(0.5, 0.07, Wd * 0.9, darkMat, -L / 2 + 0.15, bodyY + bodyH / 2 + 0.32, 0));
    g.add(box(0.08, 0.3, 0.08, darkMat, -L / 2 + 0.05, bodyY + bodyH / 2 + 0.16, Wd * 0.36));
    g.add(box(0.08, 0.3, 0.08, darkMat, -L / 2 + 0.05, bodyY + bodyH / 2 + 0.16, -Wd * 0.36));
    g.add(box(L * 0.5, 0.06, 0.3, new THREE.MeshLambertMaterial({ color: 0x14181f }), 0, bodyY + bodyH / 2 + 0.06, 0));
  }
  if (type === 'police') {
    g.add(box(1.1, 0.16, 0.5, new THREE.MeshBasicMaterial({ color: 0xff2a2a }), -L * 0.06, bodyY + bodyH / 2 + 0.66, -0.24));
    g.add(box(1.1, 0.16, 0.5, new THREE.MeshBasicMaterial({ color: 0x2a6bff }), -L * 0.06, bodyY + bodyH / 2 + 0.66, 0.24));
    g.add(box(L * 0.9, 0.34, Wd + 0.03, new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }), 0, bodyY + 0.05, 0));
  }
  if (type === 'hauler') {
    g.add(box(L * 0.42, 0.9, Wd * 0.94, new THREE.MeshLambertMaterial({ color: 0x3a3f45 }), -L * 0.22, bodyY + 0.8, 0));
  }
  if (type === 'taco') {
    g.add(box(1.4, 0.7, 1.4, new THREE.MeshBasicMaterial({ color: 0xffe45c }), 0, bodyY + 1.1, 0));
  }
  if (type === 'bus') {
    for (let i = 0; i < 5; i++) {
      g.add(box(0.9, 0.6, 0.06, glassMat, -L / 2 + 0.8 + i * 1.3, bodyY + 0.9, Wd / 2 + 0.02));
      g.add(box(0.9, 0.6, 0.06, glassMat, -L / 2 + 0.8 + i * 1.3, bodyY + 0.9, -Wd / 2 - 0.02));
    }
  }
  // Wheels with hubs + spokes.
  const wr = type === 'bus' || type === 'hauler' ? 0.46 : 0.38;
  const wx = L * 0.32, wz = Wd / 2 + 0.02;
  const wheels = [];
  for (const [x, z] of [[wx, wz], [wx, -wz], [-wx, wz], [-wx, -wz]]) {
    const w = makeWheel(wr);
    w.position.set(x, wr, z);
    g.add(w);
    wheels.push(w);
  }
  // Headlight beams at night.
  let beam = null;
  if (withLight) {
    beam = new THREE.SpotLight(0xfff2b0, 0, 42, 0.5, 0.5, 1.2);
    beam.position.set(L / 2, 0.8, 0);
    const tgt = new THREE.Object3D();
    tgt.position.set(L / 2 + 12, 0, 0);
    g.add(tgt);
    beam.target = tgt;
    g.add(beam);
  }
  g.userData = { wheels, beam, def };
  return g;
}

export function makeCar(type, x, z, heading, colorHex, withLight) {
  const def = CAR_DEFS[type] || CAR_DEFS.cometa;
  const group = buildCarMesh(type, colorHex !== undefined ? colorHex : def.color, withLight);
  group.position.set(x, 0, z);
  group.rotation.y = heading || 0;
  return {
    type, def, group, x, z, heading: heading || 0, speed: 0,
    steer: 0, hp: 100, owned: false, traffic: false, color: colorHex !== undefined ? colorHex : def.color,
  };
}

export function carForward(car) {
  return { x: Math.sin(car.heading), z: Math.cos(car.heading) };
}

function circleHitsCar(ax, az, ar, bx, bz, br) {
  const dx = ax - bx, dz = az - bz;
  const rr = ar + br;
  return dx * dx + dz * dz < rr * rr;
}

export function updatePlayerCar(G, input, dt) {
  const car = G.car;
  if (!car) return;
  const def = car.def;
  const fwd = (input.keys.has('KeyW') || input.keys.has('ArrowUp')) ? 1 : 0;
  const back = (input.keys.has('KeyS') || input.keys.has('ArrowDown')) ? 1 : 0;
  const hand = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const steerIn = (input.keys.has('KeyA') || input.keys.has('ArrowLeft') ? 1 : 0)
    - (input.keys.has('KeyD') || input.keys.has('ArrowRight') ? 1 : 0);
  if (fwd) car.speed += def.accel * dt;
  if (back) car.speed -= (car.speed > 0.5 ? def.brake : def.accel * 0.55) * dt;
  if (!fwd && !back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  if (hand) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 22 * dt);
  car.speed = Math.max(-def.maxSpeed * 0.4, Math.min(def.maxSpeed, car.speed));
  const spd = Math.abs(car.speed) / def.maxSpeed;
  car.steer += (steerIn - car.steer) * Math.min(1, dt * 8);
  car.heading += car.steer * def.turn * spd * Math.sign(car.speed || 1) * dt * (car.speed < 0 ? -1 : 1);
  const f = carForward(car);
  const nx = car.x + f.x * car.speed * dt;
  const nz = car.z + f.z * car.speed * dt;
  let blocked = collideCircle(G.city, nx, nz, 1.4);
  if (!blocked) {
    for (const t of G.traffic) {
      if (t.car !== car && circleHitsCar(nx, nz, 1.4, t.car.x, t.car.z, 1.6)) { blocked = true; break; }
    }
  }
  if (blocked) {
    car.speed *= -0.25;
    G.audio.punch();
    if (G.W) G.W.spawnParticles({ x: car.x, y: 0.6, z: car.z }, 0xaaaaaa, 6, 1.5, 1);
  } else {
    car.x = nx; car.z = nz;
  }
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  const spin = car.speed * dt * 2.4;
  for (const w of car.group.userData.wheels) w.rotation.y += 0; // wheels spin around local X via parent
  car.group.userData.wheels.forEach((w) => { w.children[0].rotation.z += spin; w.children[1].rotation.z += spin; });
  if (hand && Math.abs(car.speed) > 6) {
    G.W.spawnParticles({ x: car.x - f.x * 1.6, y: 0.2, z: car.z - f.z * 1.6 }, 0xcccccc, 2, 0.8, 0.5);
  }
  G.audio.engine(Math.abs(car.speed) / def.maxSpeed);
  const beam = car.group.userData.beam;
  if (beam) beam.intensity = 0;
}

export function driveToward(car, tx, tz, dt, city, maxSpeed) {
  const dx = tx - car.x, dz = tz - car.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1) { car.speed *= 0.9; return dist; }
  const want = Math.atan2(dx, dz);
  let dh = want - car.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh));
  const target = Math.min(maxSpeed || car.def.maxSpeed, dist * 0.8 + 4);
  car.speed += ((target - car.speed) * Math.min(1, dt * 1.6));
  const f = carForward(car);
  const nx = car.x + f.x * car.speed * dt;
  const nz = car.z + f.z * car.speed * dt;
  if (!collideCircle(city, nx, nz, 1.4)) { car.x = nx; car.z = nz; }
  else { car.speed *= 0.4; car.heading += 0.5 * dt; }
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  return dist;
}
