// Car factory + arcade driving physics. 7 drivable silhouettes: sport
// (VELOZ COMET RS), taxi, sedan, van, truck, bus, police.
// BUG FIX (round 6i): every function that touches a car first proves the
// value is a real car object — a stray number in a car list used to crash
// with "Cannot create property 'speed' on number" and hang the chase shot.
import * as THREE from 'three';
import { G, CFG } from './config.js';
import { R } from './random.js';
import { collideCircle } from './city.js';
import { nightFactor } from './render.js';

export function isCarObj(c) {
  return !!c && typeof c === 'object' && typeof c.speed === 'number' && !!c.group;
}

const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2836, transparent: true, opacity: 0.85 });
const darkMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
const chromeMat = new THREE.MeshLambertMaterial({ color: 0xc8ccd4 });
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x0c0c0e });

export function makeCar(type, x, z, heading) {
  const def = CFG.carTypes[type] || CFG.carTypes.sedan;
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: def.color });
  const L = def.len, W = def.wid;
  const body = new THREE.Mesh(new THREE.BoxGeometry(L, 0.75, W), bodyMat);
  body.position.y = 0.62; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(L * 0.52, 0.62, W * 0.86), bodyMat);
  cabin.position.set(-L * 0.05, 1.28, 0); cabin.castShadow = true; g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(L * 0.5, 0.08, W * 0.82),
    new THREE.MeshLambertMaterial({ color: new THREE.Color(def.color).multiplyScalar(0.85) }));
  roof.position.set(-L * 0.05, 1.62, 0); g.add(roof);
  // slanted glass windshield + rear glass + side windows
  const shield = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.8, 0.62), glassMat);
  shield.position.set(L * 0.2, 1.3, 0); shield.rotation.y = Math.PI / 2; shield.rotation.x = 0; shield.rotation.z = 0;
  shield.rotation.set(0, Math.PI / 2, 0); shield.rotateX(-0.35); g.add(shield);
  const rear = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.8, 0.55), glassMat);
  rear.position.set(-L * 0.3, 1.3, 0); rear.rotation.y = -Math.PI / 2; rear.rotateX(0.3); g.add(rear);
  for (const s of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.44, 0.5), glassMat);
    win.position.set(-L * 0.05, 1.3, s * (W * 0.44)); g.add(win);
    const mir = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.3), darkMat);
    mir.position.set(L * 0.24, 1.12, s * (W / 2 + 0.12)); g.add(mir);
  }
  // interior: seats + wheel visible through the glass
  const seatM = new THREE.MeshLambertMaterial({ color: 0x2a2118 });
  for (const s of [-0.4, 0.4]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.5), seatM);
    seat.position.set(-L * 0.08, 1.05, s); g.add(seat);
  }
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 12), darkMat);
  wheel.position.set(L * 0.14, 1.15, -0.4); wheel.rotation.y = Math.PI / 2; g.add(wheel);
  // bumpers
  for (const s of [1, -1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.32, W * 0.96), darkMat);
    b.position.set(s * (L / 2 + 0.02), 0.5, 0); g.add(b);
  }
  // headlights + taillights (emissive; cones fake the beam, no SpotLights)
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a22 });
  const cones = [];
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.42), headMat);
    h.position.set(L / 2 + 0.05, 0.72, s * W * 0.32); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.4), tailMat);
    t.position.set(-L / 2 - 0.05, 0.72, s * W * 0.32); g.add(t);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5, 9, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.rotation.z = -Math.PI / 2; cone.position.set(L / 2 + 4.6, 0.7, s * W * 0.32);
    g.add(cone); cones.push(cone);
  }
  // wheels + hubcaps
  const wheels = [];
  const wg = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12); wg.rotateX(Math.PI / 2);
  const hg = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 10); hg.rotateX(Math.PI / 2);
  for (const [wx, wz] of [[L * 0.32, W / 2], [L * 0.32, -W / 2], [-L * 0.32, W / 2], [-L * 0.32, -W / 2]]) {
    const w = new THREE.Mesh(wg, tyreMat); w.position.set(wx, 0.36, wz); g.add(w);
    const hub = new THREE.Mesh(hg, chromeMat); hub.position.set(wx, 0.36, wz); g.add(hub);
    wheels.push(w);
  }
  // type extras
  let barL = null, barR = null;
  if (type === 'sport') {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, W * 0.9), darkMat);
    sp.position.set(-L / 2 - 0.05, 1.28, 0); g.add(sp);
    for (const s of [-1, 1]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), darkMat);
      st.position.set(-L / 2 - 0.05, 1.1, s * W * 0.32); g.add(st);
    }
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    sign.position.set(-L * 0.05, 1.82, 0); g.add(sign);
  }
  if (type === 'truck') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(L * 0.42, 0.5, W * 0.9),
      new THREE.MeshLambertMaterial({ color: 0x5a4632 }));
    bed.position.set(-L * 0.26, 1.15, 0); g.add(bed);
  }
  if (type === 'bus') {
    for (let i = 0; i < 4; i++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), glassMat);
      win.position.set(L * 0.28 - i * 1.5, 1.35, W / 2 + 0.01); g.add(win);
      const win2 = win.clone(); win2.position.z = -W / 2 - 0.01; win2.rotation.y = Math.PI; g.add(win2);
    }
  }
  if (type === 'police') {
    barL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    barL.position.set(-0.05, 1.72, -0.42); g.add(barL);
    barR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), new THREE.MeshBasicMaterial({ color: 0x2050ff }));
    barR.position.set(-0.05, 1.72, 0.42); g.add(barR);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(L * 0.9, 0.3, W + 0.02),
      new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    stripe.position.y = 0.62; g.add(stripe);
  }
  g.position.set(x, 0, z); g.rotation.y = heading;
  G.scene.add(g);
  const car = {
    type, def, group: g, wheels, cones, barL, barR, headMat, tailMat,
    x, z, heading, speed: 0, hp: 100, stolen: false, driver: true, smoke: null,
  };
  return car;
}

export function spawnParkedCars() {
  const spots = [
    ['sport', -240, 66, 0.4], ['sedan', -204, -108, 1.57], ['taxi', 108, -4, 0],
    ['van', -116, 128, 3.14], ['sedan', 52, 232, 1.57], ['truck', 244, -60, 1.57],
    ['sport', 128, -232, 0], ['taxi', -8, 116, 1.57], ['van', 232, 52, 0],
    ['sedan', -232, 180, 3.14], ['taxi', 60, -100, 0], ['bus', -116, 240, 1.57],
  ];
  for (const [t, x, z, h] of spots) {
    const c = makeCar(t, x, z, h); c.driver = false; G.cars.push(c);
  }
}

// Arcade physics. `ctl`: {throttle -1..1, steer -1..1, brake, hand}. Guards
// first: a non-object (or number) car is ignored, never mutated.
export function updateCarPhysics(car, dt, ctl) {
  if (!isCarObj(car) || !ctl || typeof ctl !== 'object') return;
  const def = car.def, top = def.top;
  const shot = G.shotMode;
  if (ctl.throttle !== 0) car.speed += ctl.throttle * def.accel * dt;
  if (ctl.brake || ctl.hand) car.speed -= Math.sign(car.speed) * (ctl.hand ? 34 : 26) * dt;
  if (!shot) car.speed -= car.speed * 0.35 * dt; // rolling drag (skipped in shots)
  if (Math.abs(car.speed) < 0.05 && ctl.throttle === 0) car.speed = 0;
  car.speed = Math.max(-top * 0.45, Math.min(top, car.speed));
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 8);
  car.heading += ctl.steer * def.grip * steerAuthority * dt * (car.speed >= 0 ? 1 : -1) * 0.55;
  const ox = car.x, oz = car.z;
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.x = Math.max(-316, Math.min(316, car.x));
  car.z = Math.max(-316, Math.min(316, car.z));
  if (collideCircle(car.x, car.z, 1.6)) { car.x = ox; car.z = oz; if (!shot) car.speed *= 0.4; }
  // car-vs-car: only real car objects take part; numbers are skipped.
  for (const other of G.cars) {
    if (!isCarObj(other) || other === car) continue;
    const dx = other.x - car.x, dz = other.z - car.z, d2 = dx * dx + dz * dz;
    if (d2 < 12.5 && d2 > 0.001) {
      const d = Math.sqrt(d2), push = (3.55 - d) / 2;
      car.x -= (dx / d) * push; car.z -= (dz / d) * push;
      other.x += (dx / d) * push; other.z += (dz / d) * push;
      if (!shot) { car.speed *= 0.55; other.speed *= 0.55; }
      car.hp -= 0.4; other.hp -= 0.4;
    }
  }
  for (const other of G.traffic) {
    if (!isCarObj(other) || other === car) continue;
    const dx = other.x - car.x, dz = other.z - car.z, d2 = dx * dx + dz * dz;
    if (d2 < 12.5 && d2 > 0.001) {
      const d = Math.sqrt(d2), push = (3.55 - d) / 2;
      car.x -= (dx / d) * push; car.z -= (dz / d) * push;
      if (!shot) { car.speed *= 0.5; other.speed *= 0.5; }
    }
  }
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  const spin = car.speed * dt * 2.2;
  for (const w of car.wheels) if (w && typeof w === 'object') w.rotation.z += spin;
  const nf = nightFactor();
  for (const cone of car.cones) cone.material.opacity = nf * 0.13;
  if (car.hp < 35 && !car.smoke) {
    car.smoke = new THREE.Mesh(new THREE.SphereGeometry(0.8, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.5 }));
    car.smoke.position.set(car.def.len * 0.3, 1.2, 0);
    car.group.add(car.smoke);
  }
  if (car.smoke) car.smoke.scale.setScalar(1 + Math.sin(G.elapsed * 5) * 0.15);
}

export function damageCar(car, amt) {
  if (!isCarObj(car)) return;
  car.hp -= amt;
  if (car.hp <= 0) { car.hp = 0; car.speed = 0; }
}

export function nearestCar(x, z, maxD) {
  let best = null, bd = maxD * maxD;
  for (const c of G.cars) {
    if (!isCarObj(c)) continue;
    const dx = c.x - x, dz = c.z - z, d2 = dx * dx + dz * dz;
    if (d2 < bd) { bd = d2; best = c; }
  }
  return best;
}

export function randomCarColor() {
  return R.pick([0xc22030, 0x2e6fd8, 0xe8e4d8, 0x1e9e6a, 0xf5c518, 0x8a5a9a, 0x3a3f4a]);
}
