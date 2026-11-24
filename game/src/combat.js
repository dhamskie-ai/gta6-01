// Combat: fists + guns, guards, muzzle flash, tracers, health/armor.
import * as THREE from 'three';
import { G, clamp, dist2 } from './config.js';
import { addBurst } from './render.js';
import { addWanted } from './police.js';

export const WEAPONS = [
  { name: 'FISTS', mag: Infinity, dmg: 12, range: 2.2 },
  { name: 'VESPER', mag: 12, dmg: 34, range: 55 },
  { name: 'MAKO', mag: 30, dmg: 18, range: 48 },
  { name: 'BREAKER', mag: 1, dmg: 90, range: 40 },
];
export function spawnGuards(x, z, n = 4) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x3a3a22 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a070 });
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), mat);
    body.position.y = 1.05; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), skin);
    head.position.y = 1.62; g.add(head);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.7), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.3, 1.2, 0.3); g.add(gun);
    g.position.set(x + (i % 2) * 6 - 3, 0, z + Math.floor(i / 2) * 6 - 3);
    G.scene.add(g);
    G.guards.push({ group: g, x: g.position.x, z: g.position.z, hp: 60, shootT: 1 + i * 0.5, alive: true });
  }
}
export function clearGuards() {
  for (const gd of G.guards) G.scene.remove(gd.group);
  G.guards = [];
}
function tracer(from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(from.x, from.y, from.z), new THREE.Vector3(to.x, to.y, to.z)]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
  line.userData.life = 0.09;
  G.scene.add(line);
  G.tracers = G.tracers || [];
  G.tracers.push(line);
}
export function updateTracers(dt) {
  if (!G.tracers) return;
  for (let i = G.tracers.length - 1; i >= 0; i--) {
    const l = G.tracers[i];
    l.userData.life -= dt;
    if (l.userData.life <= 0) { G.scene.remove(l); l.geometry.dispose(); G.tracers.splice(i, 1); }
  }
}
export function shoot(audio) {
  const p = G.player;
  if (!p || p.car) return;
  const w = WEAPONS[G.weapon];
  if (G.weapon > 0 && G.mag[G.weapon] <= 0) { if (audio) audio.tone(140, 0.08, 'square', 0.1); return; }
  if (G.weapon > 0) G.mag[G.weapon]--;
  const px = p.x, pz = p.z;
  const dirX = Math.sin(p.heading), dirZ = Math.cos(p.heading);
  const from = { x: px + dirX, y: 1.4, z: pz + dirZ };
  let best = null, bd = w.range;
  const targets = [];
  for (const gd of G.guards) if (gd.alive) targets.push({ x: gd.x, z: gd.z, o: gd, kind: 'guard' });
  for (const u of G.police) if (u.kind === 'foot') targets.push({ x: u.x, z: u.z, o: u, kind: 'cop' });
  for (const t of targets) {
    const dx = t.x - px, dz = t.z - pz;
    const d = Math.hypot(dx, dz);
    if (d > w.range) continue;
    const dot = (dx * dirX + dz * dirZ) / (d || 1);
    if (dot < 0.93 && d > 2) continue;
    if (d < bd) { bd = d; best = t; }
  }
  if (G.weapon === 0) {
    if (audio) audio.punch();
    if (best && bd < w.range) hitTarget(best, w.dmg, audio);
    return;
  }
  if (audio) audio.shoot();
  G.gunshotT = 0.8;
  addWanted(1);
  const end = best ? { x: best.x, y: 1.3, z: best.z }
    : { x: px + dirX * w.range, y: 1.4, z: pz + dirZ * w.range };
  tracer(from, end);
  addBurst(from.x, from.y, from.z, 0xffd23e, 4, 2);
  if (best) {
    hitTarget(best, w.dmg, audio);
    addBurst(best.x, 1.3, best.z, 0xff3a3a, 8, 4);
  }
}
function hitTarget(t, dmg, audio) {
  if (t.kind === 'guard') {
    t.o.hp -= dmg;
    if (t.o.hp <= 0 && t.o.alive) {
      t.o.alive = false;
      G.scene.remove(t.o.group);
      addBurst(t.o.x, 1, t.o.z, 0x888888, 12, 5);
    }
  } else if (t.kind === 'cop') {
    t.o.hp = (t.o.hp || 50) - dmg;
    if (t.o.hp <= 0) {
      G.scene.remove(t.o.group);
      G.police.splice(G.police.indexOf(t.o), 1);
      addWanted(2);
    }
  }
}
export function reload() {
  // R reloads only on foot.
  if (G.player && G.player.car) return;
  const w = WEAPONS[G.weapon];
  if (G.weapon === 0) return;
  if (G.ammo[G.weapon] === Infinity) { G.mag[G.weapon] = w.mag; return; }
  const need = w.mag - G.mag[G.weapon];
  const take = Math.min(need, G.ammo[G.weapon]);
  G.mag[G.weapon] += take; G.ammo[G.weapon] -= take;
}
export function damagePlayer(n) {
  if (G.armor > 0) {
    const absorbed = Math.min(G.armor, n);
    G.armor -= absorbed; n -= absorbed;
  }
  G.health = Math.max(0, G.health - n);
  if (G.health <= 0) { G.overKind = 'wasted'; G.phase = 'over'; }
}
export function updateCombat(dt, input, audio) {
  const p = G.player;
  if (!p) return;
  if (input.wasPressed('Digit1')) G.weapon = 0;
  if (input.wasPressed('Digit2')) G.weapon = 1;
  if (input.wasPressed('Digit3')) G.weapon = 2;
  if (input.wasPressed('Digit4')) G.weapon = 3;
  if (input.wasPressed('KeyR')) reload();
  if (input.mousePressed && !p.car) shoot(audio);
  G.gunshotT = Math.max(0, (G.gunshotT || 0) - dt);
  // Guards shoot back with limited accuracy.
  for (const gd of G.guards) {
    if (!gd.alive) continue;
    const d = dist2(gd.x, gd.z, p.x, p.z);
    const want = Math.atan2(p.x - gd.x, p.z - gd.z);
    gd.group.rotation.y = want;
    if (d < 30) {
      // Close in slowly.
      gd.x += Math.sin(want) * 2.2 * dt;
      gd.z += Math.cos(want) * 2.2 * dt;
      gd.group.position.set(gd.x, 0, gd.z);
      gd.shootT -= dt;
      if (gd.shootT <= 0) {
        gd.shootT = 1.4 + Math.random() * 0.8;
        if (Math.random() < 0.45) {
          tracer({ x: gd.x, y: 1.3, z: gd.z }, { x: p.x, y: 1.3, z: p.z });
          if (audio) audio.shoot();
          damagePlayer(6);
        }
      }
    }
  }
  // Player car explodes at 0 hp.
  const car = p.car;
  if (car && car.hp <= 0) {
    addBurst(car.x, 1.2, car.z, 0xff6a2a, 30, 10);
    addBurst(car.x, 1.2, car.z, 0x333333, 20, 8);
    if (audio) audio.noise(0.5, 0.4, 800);
    G.scene.remove(car.group);
    G.cars.splice(G.cars.indexOf(car), 1);
    p.car = null; p.group.visible = true;
    p.x = car.x + 3; p.z = car.z + 3;
    p.group.position.set(p.x, 0, p.z);
    damagePlayer(25);
  }
  updateTracers(dt);
}
