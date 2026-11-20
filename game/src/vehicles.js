// Cars: procedural models, arcade physics, collision. Guards everywhere.
import * as THREE from 'three';
import { CAR_TYPES, CAR_COLORS } from './config.js';
import { collideCircle } from './city.js';
import { sfx } from './audio.js';

export function isCarObj(c) {
  return !!c && typeof c === 'object' && typeof c.speed === 'number' && !!c.group;
}
export function randomCarColor(R) { return R.pick(CAR_COLORS); }
const geoCache = new Map();
function boxGeo(w, h, d) {
  const k = `${w}|${h}|${d}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}
const matCache = new Map();
function lam(c) {
  if (!matCache.has(c)) matCache.set(c, new THREE.MeshLambertMaterial({ color: c }));
  return matCache.get(c);
}
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
const darkMat = new THREE.MeshLambertMaterial({ color: 0x181818 });
const chromeMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
const tireMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
const hubMat = new THREE.MeshLambertMaterial({ color: 0x999999 });

export function makeCar(G, type, x, z, heading, opts = {}) {
  const T = CAR_TYPES[type];
  const color = opts.color !== undefined ? opts.color : (type === 'taxi' || type === 'police' ? T.color : randomCarColor(G.rng));
  const g = new THREE.Group();
  const L = T.len, W = T.wid;
  const body = new THREE.Mesh(boxGeo(L, 0.75, W), lam(color));
  body.position.y = 0.65; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(boxGeo(L * 0.52, 0.62, W * 0.86), glassMat);
  cabin.position.set(-L * 0.04, 1.3, 0); cabin.castShadow = true; g.add(cabin);
  const roof = new THREE.Mesh(boxGeo(L * 0.5, 0.1, W * 0.8), lam(color));
  roof.position.set(-L * 0.04, 1.66, 0); g.add(roof);
  const shield = new THREE.Mesh(boxGeo(0.08, 0.55, W * 0.8), glassMat);
  shield.position.set(L * 0.22, 1.28, 0); shield.rotation.z = -0.35; g.add(shield);
  const rear = new THREE.Mesh(boxGeo(0.08, 0.55, W * 0.8), glassMat);
  rear.position.set(-L * 0.3, 1.28, 0); rear.rotation.z = 0.35; g.add(rear);
  for (const s of [-1, 1]) {
    const win = new THREE.Mesh(boxGeo(L * 0.42, 0.4, 0.06), glassMat);
    win.position.set(-L * 0.04, 1.3, s * (W * 0.44)); g.add(win);
    const mir = new THREE.Mesh(boxGeo(0.14, 0.1, 0.22), darkMat);
    mir.position.set(L * 0.24, 1.15, s * (W * 0.55)); g.add(mir);
  }
  const seat = new THREE.Mesh(boxGeo(0.5, 0.5, 0.45), darkMat);
  seat.position.set(-L * 0.02, 1.05, -W * 0.2); g.add(seat);
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 10), darkMat);
  wheel.rotation.x = Math.PI / 2; wheel.position.set(L * 0.18, 1.15, -W * 0.2); g.add(wheel);
  const bumpF = new THREE.Mesh(boxGeo(0.18, 0.3, W), chromeMat);
  bumpF.position.set(L / 2 + 0.05, 0.45, 0); g.add(bumpF);
  const bumpR = bumpF.clone(); bumpR.position.x = -L / 2 - 0.05; g.add(bumpR);
  // Headlights (emissive + beam cone, opacity follows night) + taillights.
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tlMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  const beams = [];
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(boxGeo(0.1, 0.18, 0.3), hlMat);
    hl.position.set(L / 2 + 0.02, 0.75, s * (W * 0.32)); g.add(hl);
    const tl = new THREE.Mesh(boxGeo(0.1, 0.18, 0.3), tlMat);
    tl.position.set(-L / 2 - 0.02, 0.75, s * (W * 0.32)); g.add(tl);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.6, 9, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    beam.rotation.z = -Math.PI / 2; beam.position.set(L / 2 + 4.5, 0.6, s * (W * 0.32));
    g.add(beam); beams.push(beam);
  }
  // 4 wheels + hubcaps.
  const wheels = [];
  for (const [wx, wz] of [[L * 0.32, W / 2], [L * 0.32, -W / 2], [-L * 0.32, W / 2], [-L * 0.32, -W / 2]]) {
    const wh = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12), tireMat);
    tire.rotation.x = Math.PI / 2; wh.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 8), hubMat);
    hub.rotation.x = Math.PI / 2; wh.add(hub);
    wh.position.set(wx, 0.36, wz); g.add(wh); wheels.push(wh);
  }
  if (type === 'sport') {
    const sp = new THREE.Mesh(boxGeo(0.5, 0.08, W * 0.95), lam(0x111111));
    sp.position.set(-L / 2 + 0.1, 1.25, 0); g.add(sp);
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(boxGeo(0.7, 0.25, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffd23d }));
    sign.position.set(-L * 0.04, 1.85, 0); g.add(sign);
  }
  if (type === 'truck') {
    const bed = new THREE.Mesh(boxGeo(L * 0.42, 0.5, W * 0.9), lam(0x8a6a45));
    bed.position.set(-L * 0.26, 1.25, 0); g.add(bed);
  }
  if (type === 'bus') {
    for (let i = 0; i < 4; i++) {
      const w2 = new THREE.Mesh(boxGeo(0.7, 0.4, 0.06), glassMat);
      w2.position.set(L * 0.28 - i * 0.9, 1.3, W * 0.44); g.add(w2);
      const w3 = w2.clone(); w3.position.z = -W * 0.44; g.add(w3);
    }
  }
  if (type === 'police') {
    const bar = new THREE.Mesh(boxGeo(0.5, 0.18, W * 0.7),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    bar.position.set(-L * 0.04, 1.78, 0); g.add(bar);
    const stripe = new THREE.Mesh(boxGeo(L * 0.9, 0.22, W + 0.02),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.set(0, 0.85, 0); g.add(stripe);
  }
  // Model parts are built with length along local X; travel forward is
  // local +Z (heading rotation), so rotate the whole body -90° about Y.
  const inner = new THREE.Group();
  while (g.children.length > 0) inner.add(g.children[0]);
  inner.rotation.y = -Math.PI / 2;
  g.add(inner);
  g.position.set(x, 0, z);
  g.rotation.y = heading;
  G.scene.add(g);
  const car = {
    type, group: g, x, z, heading, speed: 0, hp: 100,
    top: T.top, accel: T.accel, grip: T.grip, len: L, wid: W,
    name: T.name, driver: null, traffic: false, police: type === 'police',
    beams, hlMat, wheels, blockedT: 0, honkT: 0, steer: 0,
  };
  return car;
}
export function removeCar(G, car) {
  if (!isCarObj(car)) return;
  G.scene.remove(car.group);
  const i = G.cars.indexOf(car);
  if (i >= 0) G.cars.splice(i, 1);
}
// Arcade physics: accel/brake/handbrake, drag, steering, building + car hits.
export function updateCarPhysics(G, car, dt, input) {
  if (!isCarObj(car)) return;
  const T = CAR_TYPES[car.type];
  const throttle = input.fwd ? 1 : input.back ? -0.6 : 0;
  if (throttle !== 0) car.speed += throttle * car.accel * dt * (car.speed < 0 ? 0.6 : 1);
  if (input.handbrake) car.speed *= Math.max(0, 1 - 3 * dt);
  car.speed *= Math.max(0, 1 - (G.shotMode ? 0 : 0.35) * dt);
  if (Math.abs(car.speed) < 0.05 && throttle === 0) car.speed = 0;
  car.speed = Math.max(-T.top * 0.5, Math.min(T.top, car.speed));
  const auth = Math.min(1, Math.abs(car.speed) / 8);
  car.heading += input.steer * car.grip * auth * dt * (car.speed >= 0 ? 1 : -1) * Math.sign(car.speed || 1);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  if (!collideCircle(G, nx, car.z, 1.6)) car.x = nx; else car.speed *= 0.4;
  if (!collideCircle(G, car.x, nz, 1.6)) car.z = nz; else car.speed *= 0.4;
  // Car-car collision: push + slow + small damage.
  for (const o of G.cars) {
    if (!isCarObj(o) || o === car) continue;
    const dx = car.x - o.x, dz = car.z - o.z;
    const d = Math.hypot(dx, dz), min = (car.len + o.len) / 2 * 0.8;
    if (d > 0.01 && d < min) {
      const push = (min - d) / 2;
      car.x += (dx / d) * push; car.z += (dz / d) * push;
      car.speed *= 0.55; car.hp = Math.max(0, car.hp - 0.4);
      if (o.traffic && Math.abs(car.speed) > 5) sfx(G, 'horn');
    }
  }
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  car.wheels.forEach((w, i) => {
    w.rotation.y = i < 2 ? input.steer * 0.4 : 0;
    w.children[0].rotation.z += car.speed * dt * 2;
  });
  const nf = nightFactor(G.timeOfDay);
  car.beams.forEach((b) => { b.material.opacity = nf * 0.14; });
}
function nightFactor(t) {
  if (t < 17.5) return 0;
  if (t < 18.5) return (t - 17.5) * 0.4;
  if (t < 20) return 0.4 + (t - 18.5) * 0.6;
  return 1;
}
