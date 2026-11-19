// Model mobil detail + fisika arcade + masuk/keluar mobil.
import * as THREE from 'three';
import { G, CFG, CAR_TYPES } from './config.js';
import { rr, pick, clamp } from './random.js';
import { playHorn } from './audio.js';
const tireMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
const hubMat = new THREE.MeshLambertMaterial({ color: 0xd8dde2 });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2e3d, transparent: true, opacity: 0.75 });
const darkMat = new THREE.MeshLambertMaterial({ color: 0x222226 });
const seatMat = new THREE.MeshLambertMaterial({ color: 0x5a2e2e });
const chromeMat = new THREE.MeshLambertMaterial({ color: 0xc8ccd2 });
export function buildCarMesh(type) {
  const def = CAR_TYPES[type];
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: def.color });
  const paint2 = new THREE.MeshLambertMaterial({ color: new THREE.Color(def.color).multiplyScalar(0.75) });
  const box = (w, h, d, x, y, z, mat = paint) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
  };
  const len = type === 'truck' ? 5.6 : type === 'bus' ? 7.2 : type === 'van' ? 5.0 : 4.4;
  const wid = type === 'bus' || type === 'truck' ? 2.4 : 2.0;
  const hgt = type === 'bus' ? 2.6 : type === 'truck' ? 1.9 : 1.35;
  // Bodi berlapis: bawah + kap + garis bodi + panel atap.
  box(wid, 0.55, len, 0, 0.55, 0);
  box(wid * 0.98, 0.35, len * 0.94, 0, 0.95, 0, paint2);
  box(wid * 0.92, 0.08, len * 0.3, 0, 1.02, len * 0.32); // kap depan
  box(wid * 0.92, 0.08, len * 0.28, 0, 1.02, -len * 0.34); // bagasi
  box(wid * 0.7, 0.06, len * 0.5, 0, 1.28, -len * 0.05); // panel atap
  // Kabin + kaca depan/belakang miring + interior yang kelihatan.
  if (type !== 'truck') {
    box(wid * 0.8, 0.55, len * 0.42, 0, 1.35, -len * 0.04, paint);
    const shield = new THREE.Mesh(new THREE.PlaneGeometry(wid * 0.72, 0.6), glassMat);
    shield.position.set(0, 1.35, len * 0.18); shield.rotation.x = -0.35; g.add(shield);
    const rear = new THREE.Mesh(new THREE.PlaneGeometry(wid * 0.72, 0.55), glassMat);
    rear.position.set(0, 1.35, -len * 0.26); rear.rotation.x = 0.35; rear.rotation.y = Math.PI; g.add(rear);
    for (const sx of [-0.45, 0.45]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), seatMat);
      seat.position.set(sx, 1.25, -0.1); g.add(seat);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 12), darkMat);
      wheel.position.set(-0.45, 1.35, 0.45); wheel.rotation.x = -0.6; g.add(wheel);
    }
  } else {
    box(wid * 0.9, 1.0, 1.6, 0, 1.6, len * 0.28, paint); // kabin truk
    const shield = new THREE.Mesh(new THREE.PlaneGeometry(wid * 0.8, 0.7), glassMat);
    shield.position.set(0, 1.7, len * 0.28 + 0.82); shield.rotation.x = -0.15; g.add(shield);
    box(wid * 0.96, 0.7, len * 0.55, 0, 1.0, -len * 0.2, darkMat); // bak terbuka
  }
  if (type === 'bus') { // jendela samping berderet
    for (let i = 0; i < 4; i++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), glassMat);
      win.position.set(wid / 2 + 0.01, 1.8, -2.4 + i * 1.6); win.rotation.y = Math.PI / 2; g.add(win);
      const win2 = win.clone(); win2.position.x = -wid / 2 - 0.01; win2.rotation.y = -Math.PI / 2; g.add(win2);
    }
  }
  // Spion, bumper, gril, knalpot.
  for (const sx of [-1, 1]) {
    box(0.18, 0.12, 0.3, sx * (wid / 2 + 0.08), 1.25, len * 0.18, darkMat);
    box(wid * 0.12, 0.05, 0.5, sx * wid * 0.42, 0.32, len * 0.42, chromeMat); // lis bodi
  }
  box(wid * 0.98, 0.22, 0.25, 0, 0.42, len / 2, darkMat); // bumper depan
  box(wid * 0.98, 0.22, 0.25, 0, 0.42, -len / 2, darkMat); // bumper belakang
  box(wid * 0.5, 0.18, 0.1, 0, 0.62, len / 2 + 0.05, chromeMat); // gril
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.4, 6), chromeMat);
  exhaust.rotation.x = Math.PI / 2; exhaust.position.set(wid * 0.3, 0.3, -len / 2 - 0.1); g.add(exhaust);
  // Lampu depan (putih) + belakang (merah) — menyala saat malam.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2e2e });
  const heads = [], tails = [];
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.08), headMat);
    h.position.set(sx * wid * 0.32, 0.78, len / 2 + 0.02); g.add(h); heads.push(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), tailMat);
    t.position.set(sx * wid * 0.32, 0.78, -len / 2 - 0.02); g.add(t); tails.push(t);
  }
  // Spoiler sport (dua penopang) + strip reflektif.
  if (type === 'sport') {
    box(0.12, 0.35, 0.12, -0.7, 1.25, -len * 0.42, darkMat);
    box(0.12, 0.35, 0.12, 0.7, 1.25, -len * 0.42, darkMat);
    box(wid * 0.95, 0.08, 0.5, 0, 1.48, -len * 0.42, paint2);
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.3, len * 0.9), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }));
    stripe.rotation.x = -Math.PI / 2; stripe.position.set(0, 1.32, 0); g.add(stripe);
  }
  if (type === 'taxi') { // papan taksi + garis kotak
    box(0.9, 0.3, 0.5, 0, 1.75, 0, new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    box(wid * 1.01, 0.25, len * 0.9, 0, 0.85, 0, new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  }
  if (type === 'police') { // hitam-putih + light bar merah/biru
    box(wid * 0.98, 0.3, len * 0.5, 0, 0.95, 0, new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    const barR = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    barR.position.set(-0.4, 1.72, 0); g.add(barR);
    const barB = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    barB.position.set(0.4, 1.72, 0); g.add(barB);
    g.userData.barR = barR; g.userData.barB = barB;
  }
  // Roda + velg berdetail (ban tebal, velg 5 jari, hubcap).
  const wheels = [];
  const wheelPos = [[-wid / 2, len * 0.32], [wid / 2, len * 0.32], [-wid / 2, -len * 0.32], [wid / 2, -len * 0.32]];
  for (const [wx, wz] of wheelPos) {
    const wg = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12), tireMat);
    tire.rotation.z = Math.PI / 2; wg.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.32, 8), hubMat);
    hub.rotation.z = Math.PI / 2; wg.add(hub);
    wg.position.set(wx, 0.38, wz); g.add(wg); wheels.push(wg);
  }
  g.userData = { ...g.userData, type, heads, tails, wheels, headMat, tailMat, len, wid };
  return g;
}
export function spawnVehicle(type, x, z, heading, opts = {}) {
  const mesh = buildCarMesh(type);
  mesh.position.set(x, 0, z); mesh.rotation.y = heading;
  G.scene.add(mesh);
  const v = { type, name: CAR_TYPES[type].name, mesh, x, z, heading, speed: 0, hp: 100, top: CAR_TYPES[type].top, acc: CAR_TYPES[type].acc, parked: !!opts.parked, traffic: !!opts.traffic, police: type === 'police', callsign: opts.callsign || '', role: 'PURSUIT', route: opts.route || null, brakeLight: false };
  G.vehicles.push(v);
  return v;
}
export function nearestVehicle(x, z, maxD = 6) {
  let best = null, bd = maxD * maxD;
  for (const v of G.vehicles) {
    const d = (v.x - x) ** 2 + (v.z - z) ** 2;
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}
export function enterCar(v) {
  G.car = v; v.parked = false; G.stats.stolen++;
  if (v.type === 'police' || G.wanted > 0) { /* sudah dicuri */ }
  G.toast = `Mengendarai ${v.name}`; G.toastT = 2;
}
export function exitCar() {
  if (!G.car) return;
  const v = G.car; G.car = null;
  G.player.x = v.x + Math.sin(v.heading + Math.PI / 2) * 3;
  G.player.z = v.z - Math.cos(v.heading + Math.PI / 2) * 3;
  G.player.yaw = v.heading;
}
function collideBuildings(x, z, r) {
  for (const c of G.city.colliders) {
    if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) {
      const dxl = x - (c.x0 - r), dxr = (c.x1 + r) - x, dzl = z - (c.z0 - r), dzr = (c.z1 + r) - z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) x = c.x0 - r; else if (m === dxr) x = c.x1 + r;
      else if (m === dzl) z = c.z0 - r; else z = c.z1 + r;
      return { x, z, hit: true };
    }
  }
  return { x, z, hit: false };
}
export function updatePlayerCar(dt, f, s) {
  const v = G.car; if (!v) return;
  const hand = G.keys.ShiftLeft || G.keys.ShiftRight || (G.touch.active && G.touch.brake);
  if (f > 0) v.speed += v.acc * dt;
  else if (f < 0) v.speed -= (v.speed > 0.5 ? CFG.carBrake : v.acc * 0.6) * dt;
  else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 6 * dt);
  if (hand) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 22 * dt);
  v.speed = clamp(v.speed, -12, v.top);
  const turn = s * CFG.carTurn * clamp(Math.abs(v.speed) / 12, 0, 1) * (v.speed < 0 ? -1 : 1) * dt;
  v.heading += turn * (hand ? 1.5 : 1);
  // Maju searah heading: forward = (sin h, cos h); h = PI berarti -Z.
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
  const px = v.x + fx * v.speed * dt, pz = v.z + fz * v.speed * dt;
  const col = collideBuildings(px, pz, 1.6);
  if (col.hit) { v.speed *= 0.4; v.hp = Math.max(0, v.hp - Math.abs(v.speed) * 0.4); }
  v.x = clamp(col.x, -295, 295); v.z = clamp(col.z, -295, 295);
  v.mesh.position.set(v.x, 0, v.z); v.mesh.rotation.y = v.heading;
  v.mesh.rotation.z = -turn * 4;
  const wSpin = v.speed * dt * 2;
  for (const w of v.mesh.userData.wheels) w.rotation.x += wSpin;
  const night = G.nightF > 0.35;
  v.mesh.userData.headMat.color.setHex(night ? 0xfff6c8 : 0x8a8a7a);
  v.mesh.userData.tailMat.color.setHex(f < 0 || hand ? 0xff4040 : (night ? 0xff2e2e : 0x7a2020));
  if (G.keys.KeyH) playHorn();
  G.player.x = v.x; G.player.z = v.z; G.player.yaw = v.heading;
}
export function updateCarLights() {
  // SATU sorot lampu depan bersama (hemat shader) mengikuti mobil pemain.
  const hl = G.headlight;
  if (!hl) return;
  const night = G.nightF > 0.35;
  if (G.car && night) {
    const v = G.car;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    hl.position.set(v.x + fx * 2, 1.2, v.z + fz * 2);
    hl.target.position.set(v.x + fx * 16, 0, v.z + fz * 16);
    hl.intensity = 2.4;
  } else hl.intensity = 0;
  for (const v of G.vehicles) {
    if (!v.mesh.userData.headMat) continue;
    v.mesh.userData.headMat.color.setHex(night ? 0xfff6c8 : 0x8a8a7a);
  }
}
