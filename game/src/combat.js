// Combat: tinju + pistol Vesper/Mako, musuh penjaga, health/armor.
import * as THREE from 'three';
import { G } from './config.js';
import { rr, pick } from './random.js';
import { wasPressed } from './input.js';
import { playShot, playBlip } from './audio.js';
import { scarePeds } from './traffic.js';
import { addWanted } from './police.js';
export const WEAPONS = [
  { name: 'FISTS', dmg: 12, range: 2.2, rate: 0.4 },
  { name: 'VESPER 72', dmg: 22, range: 42, rate: 0.28 },
  { name: 'MAKO 150', dmg: 14, range: 36, rate: 0.11 },
];
let guards = [];
let tracer = null, flash = null, cool = 0;
export function buildCombat() {
  tracer = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0 }));
  G.scene.add(tracer);
  flash = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0 }));
  G.scene.add(flash);
}
export function spawnGuards(x, z, n) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.9, 0.36), new THREE.MeshLambertMaterial({ color: 0x3a3a3a }));
    b.position.y = 1; m.add(b);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), new THREE.MeshLambertMaterial({ color: 0xc98d5a }));
    h.position.y = 1.66; m.add(h);
    m.position.set(x + rr(-8, 8), 0, z + rr(-8, 8));
    G.scene.add(m);
    guards.push({ mesh: m, x: m.position.x, z: m.position.z, hp: 50, shootT: rr(1, 2) });
  }
}
export function clearGuards() { for (const g of guards) G.scene.remove(g.mesh); guards = []; }
export function guardCount() { return guards.length; }
export function updateCombat(dt) {
  cool -= dt;
  if (wasPressed('Digit1')) G.weapon = 0;
  if (wasPressed('Digit2')) G.weapon = 1;
  if (wasPressed('Digit3')) G.weapon = 2;
  const w = WEAPONS[G.weapon];
  // Tembak hanya klik kiri mouse (G._mouseDown, dicatat main.js).
  // Tombol F dicadangkan untuk aktivitas dan tidak boleh dikonsumsi di sini.
  if (G._mouseDown && cool <= 0 && G.state === 'playing' && !G.car) {
    cool = w.rate;
    const px = G.player.x, pz = G.player.z;
    if (G.weapon === 0) {
      let hit = false;
      for (const g of guards) if (Math.hypot(g.x - px, g.z - pz) < w.range) { g.hp -= w.dmg; hit = true; }
      if (hit) playBlip(300);
    } else {
      if (G.ammo[G.weapon] <= 0) { G.toast = 'Peluru habis — tekan R'; G.toastT = 1.5; return; }
      G.ammo[G.weapon]--;
      playShot(); scarePeds(px, pz, 16); addWanted(0);
      const fx = Math.sin(G.player.yaw), fz = Math.cos(G.player.yaw);
      const end = new THREE.Vector3(px + fx * w.range, 1.4, pz + fz * w.range);
      let best = null, bd = w.range;
      for (const g of guards) {
        const d = Math.hypot(g.x - px, g.z - pz);
        const along = (g.x - px) * fx + (g.z - pz) * fz;
        const side = Math.abs((g.x - px) * fz - (g.z - pz) * fx);
        if (along > 0 && along < bd && side < 1.6) { bd = along; best = g; }
      }
      if (best) { best.hp -= w.dmg; end.set(best.x, 1.3, best.z); }
      tracer.geometry.setFromPoints([new THREE.Vector3(px, 1.4, pz), end]);
      tracer.material.opacity = 1; flash.position.set(px + fx * 1.2, 1.4, pz + fz * 1.2); flash.material.opacity = 1;
      setTimeout(() => { tracer.material.opacity = 0; flash.material.opacity = 0; }, 60);
    }
  }
  if (wasPressed('KeyR') && G.weapon > 0) { G.ammo[G.weapon] = G.weapon === 1 ? 72 : 150; playBlip(900); }
  // Musuh: kejar + tembak dengan akurasi terbatas.
  for (let i = guards.length - 1; i >= 0; i--) {
    const g = guards[i];
    if (g.hp <= 0) { G.scene.remove(g.mesh); guards.splice(i, 1); G.cash += 25; continue; }
    const dx = G.player.x - g.x, dz = G.player.z - g.z, d = Math.hypot(dx, dz) || 1;
    if (d > 3) { g.x += (dx / d) * 3.4 * dt; g.z += (dz / d) * 3.4 * dt; }
    g.shootT -= dt;
    if (g.shootT <= 0 && d < 30) {
      g.shootT = rr(1.2, 2.2);
      if (Math.random() < 0.4) { G.health -= 6; playShot(); }
    }
    g.mesh.position.set(g.x, 0, g.z); g.mesh.rotation.y = Math.atan2(dx, dz);
  }
  // Sama seperti police.js: di scene shot yang dipentaskan tidak ada
  // game-over (lihat police.js). Permainan normal tidak terpengaruh.
  if (G.health <= 0 && !G.shot) { G.state = 'busted'; }
}
