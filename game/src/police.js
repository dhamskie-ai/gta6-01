// Wanted 0–5 + polisi (mobil, jalan kaki, helikopter) + callsign PCPD.
import * as THREE from 'three';
import { G } from './config.js';
import { clamp, pick } from './random.js';
import { spawnVehicle } from './vehicles.js';
const CALLSIGNS = ['PELICAN-11', 'GECKO-25', 'IBIS-43', 'TARPON-19', 'HERON-17', 'KESTREL-31', 'MARLIN-26', 'BARRACUDA-18', 'TAC-45', 'OSPREY-08'];
let seq = 0;
export function addWanted(n, reason) {
  G.wanted = clamp(G.wanted + n, 0, 5);
  G.heat = 10;
  if (reason) { G.toast = reason; G.toastT = 2.5; }
}
export function buildHelicopter() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a2e4a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.8, 2.2), bodyMat); g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.4, 2.25), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
  stripe.position.y = 0.3; g.add(stripe);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 2), new THREE.MeshLambertMaterial({ color: 0x9fd8e8, transparent: true, opacity: 0.8 }));
  glass.position.set(2.2, 0.2, 0); g.add(glass);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 5, 6), bodyMat);
  boom.rotation.z = Math.PI / 2; boom.position.set(-4.2, 0.4, 0); g.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.8, 1.2), bodyMat); fin.position.set(-6.4, 1, 0); g.add(fin);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x222226 }));
  rotor.position.y = 1.3; g.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.4), new THREE.MeshLambertMaterial({ color: 0x222226 }));
  tailRotor.position.set(-6.4, 1, 0.4); g.add(tailRotor);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  beacon.position.y = -1.1; g.add(beacon);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(5, 22, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.position.y = -12; cone.rotation.x = Math.PI; g.add(cone);
  g.visible = false;
  G.scene.add(g);
  G.heli = { mesh: g, rotor, tailRotor, beacon, cone, angle: 0 };
}
export function updatePolice(dt) {
  // Heat turun bila jauh dari polisi; wanted hilang setelah bersembunyi.
  const px = G.player.x, pz = G.player.z;
  let nearest = 999;
  for (const c of G.police) nearest = Math.min(nearest, Math.hypot(c.x - px, c.z - pz));
  if (G.wanted > 0) {
    if (nearest > 40) { G.heat -= dt; if (G.heat <= 0) { G.wanted = 0; G.toast = 'Lolos dari kejaran PCPD'; G.toastT = 2; } }
    else G.heat = 10;
  }
  // Jumlah polisi mengikuti bintang.
  const wantCars = G.wanted >= 2 ? Math.min(4, G.wanted) : 0;
  const wantFoot = G.wanted >= 1 ? Math.min(3, G.wanted) : 0;
  while (G.police.filter((c) => c.kind === 'car').length < wantCars) {
    const a = Math.random() * Math.PI * 2;
    const c = spawnVehicle('police', px + Math.sin(a) * 45, pz + Math.cos(a) * 45, a, { callsign: CALLSIGNS[seq++ % CALLSIGNS.length] });
    c.kind = 'car'; G.police.push(c);
  }
  while (G.police.filter((c) => c.kind === 'foot').length < wantFoot) {
    const a = Math.random() * Math.PI * 2;
    const f = { kind: 'foot', x: px + Math.sin(a) * 18, z: pz + Math.cos(a) * 18, speed: 5.5, mesh: null, callsign: CALLSIGNS[seq++ % CALLSIGNS.length] };
    const m = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.35), new THREE.MeshLambertMaterial({ color: 0x1a2e6e }));
    b.position.y = 1; m.add(b);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshLambertMaterial({ color: 0xe0ac69 }));
    h.position.y = 1.65; m.add(h);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.4), new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
    cap.position.y = 1.85; m.add(cap);
    m.position.set(f.x, 0, f.z); G.scene.add(m); f.mesh = m;
    G.police.push(f);
  }
  // Hapus kelebihan bila wanted turun.
  while (G.police.filter((c) => c.kind === 'car').length > wantCars) {
    const i = G.police.findIndex((c) => c.kind === 'car');
    const c = G.police[i]; G.scene.remove(c.mesh); G.vehicles.splice(G.vehicles.indexOf(c), 1); G.police.splice(i, 1);
  }
  while (G.police.filter((c) => c.kind === 'foot').length > wantFoot) {
    const i = G.police.findIndex((c) => c.kind === 'foot');
    const c = G.police[i]; G.scene.remove(c.mesh); G.police.splice(i, 1);
  }
  // AI kejar: mobil belok ke arah pemain, pejalan kaki berlari ke pemain.
  for (const c of G.police) {
    const dx = px - c.x, dz = pz - c.z, d = Math.hypot(dx, dz) || 1;
    c.role = d < 12 ? 'RAMMING' : d < 30 ? 'PURSUIT' : 'ROADBLOCK';
    if (c.kind === 'car') {
      const want = Math.atan2(dx, dz);
      let diff = want - c.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.heading += clamp(diff, -1.8 * dt, 1.8 * dt);
      c.speed = Math.min(c.top, c.speed + 14 * dt);
      c.x += Math.sin(c.heading) * c.speed * dt; c.z += Math.cos(c.heading) * c.speed * dt;
      c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = c.heading;
      const flash = Math.sin(G.time * 12) > 0;
      if (c.mesh.userData.barR) { c.mesh.userData.barR.material.color.setHex(flash ? 0xff2020 : 0x550000); c.mesh.userData.barB.material.color.setHex(flash ? 0x550000 : 0x2040ff); }
      for (const w of c.mesh.userData.wheels) w.rotation.x += c.speed * dt * 2;
      if (d < 3.5) { // ditangkap
        if (G.car) { G.car.speed *= 0.5; }
        G.health -= 12 * dt;
      }
    } else {
      c.x += (dx / d) * c.speed * dt; c.z += (dz / d) * c.speed * dt;
      c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = Math.atan2(dx, dz);
      if (d < 1.6) G.health -= 10 * dt;
    }
  }
  // Helikopter di wanted >= 3.
  if (G.heli) {
    const h = G.heli;
    h.mesh.visible = G.wanted >= 3;
    if (h.mesh.visible) {
      h.angle += dt * 0.25;
      h.mesh.position.set(px + Math.cos(h.angle) * 30, 26 + Math.sin(G.time * 0.5) * 2, pz + Math.sin(h.angle) * 30);
      h.mesh.rotation.y = -h.angle;
      h.rotor.rotation.y += dt * 18; h.tailRotor.rotation.x += dt * 22;
      h.beacon.material.color.setHex(Math.sin(G.time * 6) > 0 ? 0xff2020 : 0x330000);
    }
  }
  // Di scene shot yang dipentaskan (?shot=) tidak ada game-over: polisi
  // tetap mengejar dan menabrak, tapi layar DITANGKAP tidak boleh menutupi
  // shot. Di permainan normal G.shot kosong dan bust jalan seperti biasa.
  if (G.health <= 0 && !G.shot) { G.state = 'busted'; G.stats.busted++; }
}
export function policeList() { return G.police.map((c) => ({ callsign: c.callsign, role: c.role || 'PURSUIT', d: Math.round(Math.hypot(c.x - G.player.x, c.z - G.player.z)) })); }
