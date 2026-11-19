// Procedural cars: 6 models + bus + taco truck, arcade driving, stealing.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { mulberry32, range, pick, chance, clamp, angLerp } from './random.js';

const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
const darkMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2a0 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x181818 });
const hubMat = new THREE.MeshLambertMaterial({ color: 0xbbbbbb });

function box(mat, w, h, d, x, y, z) {
  const m = new THREE.Mesh(bodyGeo, mat);
  m.scale.set(w, h, d); m.position.set(x, y, z); return m;
}
export function makeCarModel(type, color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const long = type === 'truck' || type === 'bus' ? 5.6 : type === 'van' ? 4.8 : 4.2;
  const wide = type === 'bus' ? 2.4 : 2;
  g.add(box(paint, wide, 0.75, long, 0, 0.75, 0));
  g.add(box(glassMat, wide * 0.86, 0.62, long * 0.42, 0, 1.42, type === 'truck' ? -1.2 : -0.2));
  g.add(box(paint, wide * 0.9, 0.14, long * 0.44, 0, 1.78, type === 'truck' ? -1.2 : -0.2)); // roof
  g.add(box(darkMat, wide + 0.1, 0.3, 0.5, 0, 0.55, long / 2)); // bumpers
  g.add(box(darkMat, wide + 0.1, 0.3, 0.5, 0, 0.55, -long / 2));
  g.add(box(lightMat, 0.4, 0.22, 0.1, -0.65, 0.85, long / 2)); // headlights
  g.add(box(lightMat, 0.4, 0.22, 0.1, 0.65, 0.85, long / 2));
  g.add(box(tailMat, 0.4, 0.22, 0.1, -0.65, 0.85, -long / 2));
  g.add(box(tailMat, 0.4, 0.22, 0.1, 0.65, 0.85, -long / 2));
  g.add(box(paint, 0.14, 0.2, 0.4, -wide / 2 - 0.06, 1.35, 0.9)); // mirrors
  g.add(box(paint, 0.14, 0.2, 0.4, wide / 2 + 0.06, 1.35, 0.9));
  if (type === 'sport') { // spoiler + slanted rear glass
    g.add(box(paint, wide * 0.9, 0.08, 0.7, 0, 1.55, -long / 2 + 0.3));
    g.add(box(darkMat, 0.1, 0.35, 0.1, -0.7, 1.35, -long / 2 + 0.3));
    g.add(box(darkMat, 0.1, 0.35, 0.1, 0.7, 1.35, -long / 2 + 0.3));
  }
  if (type === 'taxi') g.add(box(new THREE.MeshBasicMaterial({ color: 0xffe14a }), 0.9, 0.3, 0.5, 0, 1.95, -0.2));
  if (type === 'truck') g.add(box(new THREE.MeshLambertMaterial({ color: 0x5a5f66 }), wide * 0.9, 1.1, 2.4, 0, 1.3, 1.2));
  if (type === 'taco') g.add(box(new THREE.MeshBasicMaterial({ color: 0xffd24a }), 1.2, 0.6, 0.6, 0, 2, 0.4));
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz); g.add(w); wheels.push(w);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.32, 8), hubMat);
    hub.rotation.z = Math.PI / 2; hub.position.set(wx, 0.42, wz); g.add(hub);
  }
  return { group: g, wheels, long };
}

export function createVehicles(G) {
  const r = mulberry32(G.seed + 5);
  const cars = [];
  const roadLines = [-240, -120, 0, 120, 240];
  for (let i = 0; i < CONFIG.parkedCount; i++) {
    const type = pick(r, ['sedan', 'hatch', 'taxi', 'van', 'sport', 'truck', 'bus', 'taco']);
    const c = CONFIG.cars[type];
    const along = pick(r, roadLines), cross = range(r, -230, 230);
    const horiz = chance(r, 0.5);
    const x = horiz ? cross : along + (chance(r, 0.5) ? 9 : -9);
    const z = horiz ? along + (chance(r, 0.5) ? 9 : -9) : cross;
    const m = makeCarModel(type, c.color);
    m.group.position.set(x, 0, z);
    m.group.rotation.y = horiz ? (chance(r, 0.5) ? 0 : Math.PI) : (chance(r, 0.5) ? Math.PI / 2 : -Math.PI / 2);
    G.scene.add(m.group);
    cars.push({ type, name: c.name, group: m.group, wheels: m.wheels, x, z, heading: m.group.rotation.y, speed: 0, hp: 100, parked: true, driver: null });
  }
  function spawnCar(type, x, z, heading) {
    const c = CONFIG.cars[type];
    const m = makeCarModel(type, c.color);
    m.group.position.set(x, 0, z); m.group.rotation.y = heading;
    G.scene.add(m.group);
    const car = { type, name: c.name, group: m.group, wheels: m.wheels, x, z, heading, speed: 0, hp: 100, parked: false, driver: null };
    cars.push(car); return car;
  }
  function drive(car, dt) {
    const c = CONFIG.cars[car.type];
    const ax = G.input.axis();
    const fwd = ax.y, steer = ax.x;
    const hand = G.input.down('ShiftLeft') || G.input.down('ShiftRight');
    if (fwd > 0) car.speed += c.accel * dt;
    else if (fwd < 0) car.speed -= (car.speed > 0.5 ? c.accel * 1.6 : c.accel * 0.6) * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
    if (hand) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 22 * dt);
    car.speed = clamp(car.speed, -c.top * 0.45, c.top);
    const turnRate = c.turn * (0.35 + 0.65 * Math.min(1, Math.abs(car.speed) / 14)) * Math.sign(car.speed || 1);
    car.heading -= steer * turnRate * dt * (hand ? 1.5 : 1);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const fixed = G.city.collide(nx, nz, 1.6);
    if (fixed.x !== nx || fixed.z !== nz) { // bumped a building
      if (Math.abs(car.speed) > 8) { car.hp -= 4; G.hud?.flashDamage?.(); }
      car.speed *= 0.4;
    }
    car.x = fixed.x; car.z = fixed.z;
    // bump traffic cars
    for (const t of (G.traffic?.cars || [])) {
      const d = Math.hypot(car.x - t.x, car.z - t.z);
      if (d < 3.4 && d > 0.01) {
        const push = (3.4 - d);
        t.x += (t.x - car.x) / d * push; t.z += (t.z - car.z) / d * push;
        t.speed = Math.max(t.speed, 4);
        if (Math.abs(car.speed) > 10 && !G.shotMode) { car.hp -= 3; car.speed *= 0.6; }
      }
    }
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    const lean = clamp(steer * car.speed * 0.012, -0.08, 0.08);
    car.group.rotation.z = lean;
    for (const w of car.wheels) w.rotation.x += car.speed * dt * 2;
    return car;
  }
  return {
    cars, spawnCar, drive,
    nearestCar(x, z, maxD) {
      let best = null, bd = maxD;
      for (const c of cars) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c; } }
      return best;
    },
    update(dt) { if (G.car) drive(G.car, dt); },
  };
}
