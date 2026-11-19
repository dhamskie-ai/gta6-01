// Model mobil prosedural HD + fisika arcade pemain (akselerasi, rem,
// handbrake, belok ikut kecepatan, tabrakan gedung + mobil lain).
import { CAR_KINDS } from './config.js';
import { clamp, wrapAngle } from './random.js';
import { collideBuildings } from './city.js';

function box(THREE, w, h, d, color, x = 0, y = 0, z = 0, emissive = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color, emissive }));
  m.position.set(x, y, z);
  return m;
}
export function makeCarModel(THREE, kind, colorOverride) {
  const spec = CAR_KINDS[kind] || CAR_KINDS.cometa;
  const color = colorOverride ?? spec.color;
  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2a3a, emissive: 0x0a141e });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1d22 });
  const chrome = new THREE.MeshLambertMaterial({ color: 0xc8ccd2 });
  const L = kind === 'hauler' ? 5.6 : kind === 'bus' ? 7.2 : kind === 'mula' ? 4.8 : 4.3;
  const Wd = kind === 'bus' ? 2.4 : 1.95;
  // Body berlapis: lower body + kap + kabin kaca + bumper + grille.
  const lower = new THREE.Mesh(new THREE.BoxGeometry(Wd, 0.62, L), body);
  lower.position.y = 0.62; lower.castShadow = true; g.add(lower);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(Wd * 0.94, 0.22, L * 0.26), body);
  hood.position.set(0, 0.98, L * 0.34); g.add(hood);
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(Wd * 0.94, 0.2, L * 0.2), body);
  trunk.position.set(0, 0.96, -L * 0.36); g.add(trunk);
  if (kind === 'hauler') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(Wd, 0.95, 1.5), body);
    cab.position.set(0, 1.35, L * 0.3); g.add(cab);
    const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(Wd * 0.9, 0.5, 0.2), glass);
    cabGlass.position.set(0, 1.5, L * 0.3 + 0.7); g.add(cabGlass);
    const bed = box(THREE, Wd, 0.5, L * 0.55, 0x6a6258, 0, 1.05, -L * 0.2);
    g.add(bed);
  } else if (kind === 'bus') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(Wd, 1.1, L * 0.85), body);
    cab.position.set(0, 1.45, -0.2); g.add(cab);
    const win = new THREE.Mesh(new THREE.BoxGeometry(Wd + 0.06, 0.55, L * 0.7), glass);
    win.position.set(0, 1.6, -0.2); g.add(win);
    const stripe = box(THREE, Wd + 0.04, 0.25, L, 0xffd25a, 0, 0.95, 0);
    g.add(stripe);
  } else {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(Wd * 0.82, 0.62, L * 0.46), glass);
    cabin.position.set(0, 1.2, -L * 0.05); cabin.castShadow = true; g.add(cabin);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(Wd * 0.78, 0.1, L * 0.4), body);
    roof.position.set(0, 1.55, -L * 0.05); g.add(roof);
    if (kind === 'veloz') {
      const spoiler = box(THREE, Wd * 0.9, 0.08, 0.5, 0x1a1d22, 0, 1.28, -L * 0.48);
      g.add(spoiler);
      for (const s of [-0.6, 0.6]) g.add(box(THREE, 0.08, 0.3, 0.08, 0x1a1d22, s, 1.1, -L * 0.48));
      const scoop = box(THREE, 0.9, 0.1, 0.7, 0x1a1d22, 0, 1.12, L * 0.3);
      g.add(scoop);
    }
    if (kind === 'cabro') {
      const sign = box(THREE, 0.9, 0.28, 0.5, 0xffd25a, 0, 1.72, -L * 0.05, 0xFFC82A);
      g.add(sign);
    }
    if (kind === 'taco') {
      const winT = box(THREE, 0.1, 0.8, 2.2, 0x1a2a3a, Wd / 2 + 0.02, 1.3, 0, 0x0a141e);
      g.add(winT);
    }
  }
  // Bumper, grille, spion, lampu emissive.
  g.add(box(THREE, Wd, 0.22, 0.3, 0x22262c, 0, 0.42, L / 2));
  g.add(box(THREE, Wd, 0.22, 0.3, 0x22262c, 0, 0.42, -L / 2));
  g.add(box(THREE, Wd * 0.5, 0.18, 0.1, 0x111318, 0, 0.68, L / 2 + 0.02));
  for (const s of [-1, 1]) {
    g.add(box(THREE, 0.16, 0.12, 0.3, 0x22262c, s * (Wd / 2 + 0.08), 1.05, L * 0.18));
    const hl = box(THREE, 0.42, 0.16, 0.08, 0xfff6d8, s * (Wd / 2 - 0.35), 0.78, L / 2 + 0.02, 0xFFF2C0);
    hl.material = hl.material.clone();
    g.add(hl);
    const tl = box(THREE, 0.42, 0.14, 0.08, 0xd21f2b, s * (Wd / 2 - 0.35), 0.78, -L / 2 - 0.02, 0xFF2A2A);
    tl.material = tl.material.clone();
    g.add(tl);
  }
  if (kind === 'pcpd') {
    const stripe = box(THREE, Wd + 0.04, 0.3, L * 0.9, 0xf2f2f2, 0, 0.62, 0);
    g.add(stripe);
    const bar = box(THREE, 1.1, 0.18, 0.4, 0x22262c, 0, 1.68, 0);
    g.add(bar);
    const rL = box(THREE, 0.5, 0.16, 0.42, 0xff2a2a, -0.28, 1.8, 0, 0xFF2A2A);
    rL.material = rL.material.clone(); g.add(rL);
    const bL = box(THREE, 0.5, 0.16, 0.42, 0x2a6aff, 0.28, 1.8, 0, 0x2A6AFF);
    bL.material = bL.material.clone(); g.add(bL);
    g.userData.lightBar = [rL, bL];
  }
  // Roda: ban + velg + jari-jari.
  const wheels = [];
  const tireMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const hubMat = new THREE.MeshLambertMaterial({ color: 0xb8bec8 });
  for (const [wx, wz] of [[-Wd / 2 + 0.08, L * 0.32], [Wd / 2 - 0.08, L * 0.32], [-Wd / 2 + 0.08, -L * 0.32], [Wd / 2 - 0.08, -L * 0.32]]) {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14), tireMat);
    tire.rotation.z = Math.PI / 2; wheel.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 10), hubMat);
    hub.rotation.z = Math.PI / 2; wheel.add(hub);
    for (let i = 0; i < 3; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.07), hubMat);
      spoke.rotation.x = (i / 3) * Math.PI; wheel.add(spoke);
    }
    wheel.position.set(wx, 0.36, wz);
    g.add(wheel); wheels.push(wheel);
  }
  g.userData = { ...g.userData, wheels, kind, spec, length: L, width: Wd };
  return g;
}
export function createCar(W, kind, x, z, heading, colorOverride) {
  const group = makeCarModel(W.three, kind, colorOverride);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  W.scene.add(group);
  const spec = CAR_KINDS[kind] || CAR_KINDS.cometa;
  const car = {
    kind, spec, group, x, z, heading, speed: 0, steer: 0,
    hp: 100, r: 2.2, driver: null, smoke: 0, spin: 0,
  };
  W.cars.list.push(car);
  return car;
}
export function removeCar(W, car) {
  W.scene.remove(car.group);
  const i = W.cars.list.indexOf(car);
  if (i >= 0) W.cars.list.splice(i, 1);
}
// Fisika arcade mobil pemain. ctrl: {throttle -1..1, steer -1..1, brake, handbrake}
export function updatePlayerCar(W, car, dt, ctrl) {
  const spec = car.spec;
  const top = spec.top, accel = spec.accel;
  if (ctrl.throttle > 0) car.speed += ctrl.throttle * accel * dt;
  else if (ctrl.throttle < 0) {
    if (car.speed > 0.5) car.speed += ctrl.throttle * 22 * dt; // rem dulu
    else car.speed += ctrl.throttle * 9 * dt; // lalu mundur
  }
  if (ctrl.brake && car.speed > 0) car.speed -= 30 * dt;
  if (ctrl.handbrake) car.speed -= Math.sign(car.speed) * 18 * dt;
  if (!W.shotMode) car.speed -= car.speed * 0.35 * dt; // drag (di-skip saat shot)
  car.speed = clamp(car.speed, -spec.top * 0.35, top);
  if (Math.abs(car.speed) < 0.05 && ctrl.throttle === 0) car.speed = 0;
  const steerTarget = clamp(ctrl.steer, -1, 1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const grip = ctrl.handbrake ? 0.45 : 1;
  const turnRate = car.steer * spec.turn * grip * clamp(Math.abs(car.speed) / 12, 0, 1) * (car.speed >= 0 ? 1 : -1);
  car.heading = wrapAngle(car.heading + turnRate * dt);
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  car.x += fx * car.speed * dt;
  car.z += fz * car.speed * dt;
  // Batas peta.
  car.x = clamp(car.x, -330, 308); car.z = clamp(car.z, -308, 308);
  // Tabrakan gedung.
  const hit = collideBuildings(W, car.x, car.z, 2.1);
  if (hit) {
    car.x += hit.x; car.z += hit.z;
    if (!W.shotMode) {
      if (Math.abs(car.speed) > 6) { car.hp -= Math.abs(car.speed) * 0.4; W.audio.blip(90, 0.15, 'sawtooth', 0.3, -40); }
      car.speed *= -0.22;
    }
  }
  // Tabrakan mobil lain (lingkaran).
  for (const other of W.cars.list) {
    if (other === car) continue;
    const dx = car.x - other.x, dz = car.z - other.z;
    const d = Math.hypot(dx, dz), min = car.r + other.r - 0.4;
    if (d < min && d > 0.01) {
      const push = (min - d) / 2;
      const nx = dx / d, nz = dz / d;
      car.x += nx * push; car.z += nz * push;
      other.x -= nx * push; other.z -= nz * push;
      if (!W.shotMode) {
        if (Math.abs(car.speed) > 8) { car.hp -= 3; other.hp -= 3; }
        car.speed *= 0.55;
      }
      if (other.driver === 'traffic') W.audio.horn();
    }
  }
  // Visual: posisi, roda, asap saat rusak.
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  car.spin += car.speed * dt * 2.4;
  const wheels = car.group.userData.wheels;
  wheels.forEach((w, i) => {
    w.rotation.x = car.spin;
    if (i < 2) w.rotation.y = car.steer * 0.4;
  });
  if (car.hp < 45 && Math.random() < 0.3) {
    W.effects.spawnSmoke(car.x, car.z + 1, 1);
  }
  if (car.hp <= 0) {
    W.effects.explode(car.x, car.z);
    W.audio.boom();
    car.hp = 100; car.speed = 0;
    car.x += 6; car.z += 6;
  }
  return car;
}
