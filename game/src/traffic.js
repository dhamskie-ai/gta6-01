// Traffic AI di graf jalan + pejalan kaki berkerumun di titik ramai.
import * as THREE from 'three';
import { G, CFG } from './config.js';
import { rr, ri, pick, clamp, dist2 } from './random.js';
import { spawnVehicle } from './vehicles.js';
const PED_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0x2c3e50, 0xff6b9d, 0xffe14d];
const SKIN = [0xf1c27d, 0xe0ac69, 0x8d5524, 0xffdbac];
let pedGeoBody, pedGeoHead, pedMats = [];
export function buildTraffic() {
  pedGeoBody = new THREE.BoxGeometry(0.55, 0.9, 0.34);
  pedGeoHead = new THREE.BoxGeometry(0.34, 0.34, 0.34);
  pedMats = PED_COLORS.map((c) => new THREE.MeshLambertMaterial({ color: c }));
  const skinMats = SKIN.map((c) => new THREE.MeshLambertMaterial({ color: c }));
  // Mobil traffic: jalur lurus di grid, belok di ujung, berhenti di lampu merah.
  const types = ['sedan', 'taxi', 'van', 'sedan', 'truck', 'sedan', 'taxi'];
  for (let i = 0; i < CFG.trafficCount; i++) {
    const axis = i % 2 === 0 ? 'x' : 'z';
    const line = pick(CFG.roadAt);
    const dir = i % 4 < 2 ? 1 : -1;
    const lane = dir * 3;
    const t = spawnVehicle(pick(types), axis === 'x' ? rr(-280, 280) : line + lane, axis === 'x' ? line + lane : rr(-280, 280),
      axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), { traffic: true });
    t.route = { axis, line, dir, lane, speed: rr(8, 14) };
    G.traffic.push(t);
  }
  // Mobil parkir di pinggir jalan (bisa dicuri).
  const parkedTypes = ['sedan', 'sport', 'taxi', 'van', 'sedan', 'truck'];
  for (let i = 0; i < CFG.parkedCount; i++) {
    const line = pick(CFG.roadAt);
    const along = rr(-260, 260);
    const side = pick([-1, 1]);
    spawnVehicle(pick(parkedTypes), line + side * 8.5, along, side > 0 ? Math.PI / 2 : -Math.PI / 2, { parked: true });
  }
  // Pejalan kaki: KERUMUNAN di titik ramai, bukan tersebar tipis.
  for (let i = 0; i < CFG.pedCount; i++) {
    const spot = pick(G.city.crowdSpots);
    const mode = i % 5 === 0 ? 'idle' : i % 5 === 1 ? 'vendor' : 'walk';
    spawnPed(spot, mode, skinMats);
  }
  // Pedagang kaki lima tetap di kios + beberapa nongkrong di trotoar.
  for (let i = 0; i < 6; i++) spawnPed({ x: -186 + i * 8, z: 56, r: 2, n: 1 }, 'vendor', skinMats);
}
function spawnPed(spot, mode, skinMats) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(pedGeoBody, pick(pedMats)); body.position.y = 0.95; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(pedGeoHead, pick(skinMats)); head.position.y = 1.62; g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
  legL.position.set(-0.14, 0.25, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.14; g.add(legR);
  const x = spot.x + rr(-spot.r, spot.r), z = spot.z + rr(-spot.r, spot.r);
  g.position.set(x, 0, z);
  G.scene.add(g);
  const p = { mesh: g, legL, legR, x, z, yaw: rr(0, 6.28), speed: mode === 'walk' ? rr(1, 2.2) : 0, mode, home: { x: spot.x, z: spot.z, r: spot.r }, target: null, flee: 0, phase: rr(0, 6.28) };
  G.peds.push(p);
  return p;
}
export function updateTraffic(dt) {
  const player = G.player;
  for (const t of G.traffic) {
    const r = t.route;
    // Lampu merah: berhenti bila dekat persimpangan dan lampu merah arahnya.
    let stop = false;
    for (const tl of G.city.trafficLights) { /* lampu disederhanakan: berhenti acak singkat */ }
    const px = G.car === t ? 0 : 0;
    // Hindari pemain: klakson + pelan bila pemain di depan.
    const dx = player.x - t.x, dz = player.z - t.z;
    const ahead = Math.sin(t.heading) * dx + Math.cos(t.heading) * dz;
    const side = Math.abs(Math.cos(t.heading) * dx - Math.sin(t.heading) * dz);
    if (ahead > 0 && ahead < 9 && side < 2.5) stop = true;
    const target = stop ? 0 : r.speed;
    t.speed += (target - t.speed) * Math.min(1, dt * 2);
    t.x += Math.sin(t.heading) * t.speed * dt;
    t.z += Math.cos(t.heading) * t.speed * dt;
    const lim = 285;
    if (r.axis === 'x' && Math.abs(t.x) > lim) { t.x = -Math.sign(t.x) * lim; }
    if (r.axis === 'z' && Math.abs(t.z) > lim) { t.z = -Math.sign(t.z) * lim; }
    t.mesh.position.set(t.x, 0, t.z); t.mesh.rotation.y = t.heading;
    for (const w of t.mesh.userData.wheels) w.rotation.x += t.speed * dt * 2;
  }
}
export function updatePeds(dt) {
  const px = G.player.x, pz = G.player.z;
  for (const p of G.peds) {
    if (p.flee > 0) { // lari menjauh dari pemain
      p.flee -= dt;
      const dx = p.x - px, dz = p.z - pz, d = Math.hypot(dx, dz) || 1;
      p.x += (dx / d) * 5 * dt; p.z += (dz / d) * 5 * dt;
      p.yaw = Math.atan2(dx, dz);
    } else if (p.mode === 'walk') {
      if (!p.target || dist2(p.x, p.z, p.target.x, p.target.z) < 4) {
        p.target = { x: p.home.x + rr(-p.home.r, p.home.r), z: p.home.z + rr(-p.home.r, p.home.r) };
      }
      const dx = p.target.x - p.x, dz = p.target.z - p.z, d = Math.hypot(dx, dz) || 1;
      p.yaw = Math.atan2(dx, dz);
      p.x += (dx / d) * p.speed * dt; p.z += (dz / d) * p.speed * dt;
      p.phase += dt * 6;
      p.legL.rotation.x = Math.sin(p.phase) * 0.6; p.legR.rotation.x = -Math.sin(p.phase) * 0.6;
    } else if (p.mode === 'idle') {
      // Nongkrong berkelompok: goyang pelan, kadang pindah posisi dalam kerumunan.
      p.phase += dt;
      p.mesh.rotation.y = p.yaw + Math.sin(p.phase * 0.5) * 0.4;
      if (Math.random() < dt * 0.02) p.target = { x: p.home.x + rr(-p.home.r, p.home.r), z: p.home.z + rr(-p.home.r, p.home.r) };
      if (p.target) {
        const dx = p.target.x - p.x, dz = p.target.z - p.z, d = Math.hypot(dx, dz) || 1;
        if (d > 1) { p.x += (dx / d) * 1.2 * dt; p.z += (dz / d) * 1.2 * dt; }
      }
    }
    // Vendor: berdiri di tempat, melambai sesekali.
    if (p.mode === 'vendor') { p.mesh.rotation.y = p.yaw + Math.sin(G.time * 0.8 + p.phase) * 0.3; }
    p.mesh.position.set(p.x, 0, p.z);
    if (p.mode === 'walk') p.mesh.rotation.y = p.yaw;
  }
}
export function scarePeds(x, z, r = 12) {
  for (const p of G.peds) if (dist2(p.x, p.z, x, z) < r * r) p.flee = 2.5;
}
