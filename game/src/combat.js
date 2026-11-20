// Combat: fists / VESPER 72 / MAKO SMG, guards, health + armor, death.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { makePersonMesh } from './city.js';
import { driveCarRef } from './player.js';
import { keyPressed } from './input.js';
import { sfx } from './audio.js';

export function hurtPlayer(G, dmg) {
  if (G.phase !== 'play' || dmg <= 0) return;
  let left = dmg;
  if (G.armor > 0) {
    const absorbed = Math.min(G.armor, left);
    G.armor -= absorbed; left -= absorbed;
  }
  G.health -= left;
  if (G.health <= 0) {
    G.health = 0;
    const busted = G.wanted >= 5 && G.rng.f() < 0.25;
    G.phase = 'over';
    G.overKind = busted ? 'busted' : 'ko';
    if (G.showOver) G.showOver(G.overKind);
    sfx(G, 'fail');
  }
}
export function spawnGuards(G, spots) {
  G.guards = G.guards || [];
  for (const [x, z] of spots) {
    const g = makePersonMesh(0x8a5a3a, 0x222222, 0x222222, 0x111111);
    g.position.set(x, 0, z);
    G.scene.add(g);
    G.guards.push({ g, x, z, hp: 50, shootT: 1 + G.rng.f(), alive: true });
  }
}
export function guardsAlive(G) { return (G.guards || []).filter((gu) => gu.alive).length; }
function enemies(G) {
  const list = [];
  for (const gu of G.guards || []) if (gu.alive) list.push({ x: gu.x, z: gu.z, kind: 'guard', ref: gu });
  for (const c of G.footCops || []) list.push({ x: c.x, z: c.z, kind: 'cop', ref: c });
  return list;
}
function addTracer(G, from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(from[0], from[1], from[2]),
    new THREE.Vector3(to[0], to[1], to[2]),
  ]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd23d, transparent: true, opacity: 0.9 }));
  G.scene.add(line);
  G.tracers = G.tracers || [];
  G.tracers.push({ line, life: 0.08 });
}
export function shoot(G) {
  const P = G.player;
  const w = WEAPONS[P.weapon];
  const px = P.x, pz = P.z;
  const origin = [px, 1.4, pz];
  if (P.weapon === 0) {
    sfx(G, 'punch');
    for (const e of enemies(G)) {
      if (Math.hypot(e.x - px, e.z - pz) < 2) { damageEnemy(G, e, w.dmg); return; }
    }
    return;
  }
  if (P.ammo[P.weapon] <= 0) { sfx(G, 'click'); return; }
  P.ammo[P.weapon]--;
  sfx(G, 'shot');
  const fx = Math.sin(P.heading), fz = Math.cos(P.heading);
  let best = null, bd = w.range;
  for (const e of enemies(G)) {
    const dx = e.x - px, dz = e.z - pz, d = Math.hypot(dx, dz);
    if (d > w.range) continue;
    const dot = (dx * fx + dz * fz) / (d || 1);
    if (dot < 0.9) continue; // must be roughly ahead
    if (d < bd) { bd = d; best = e; }
  }
  const end = best ? [best.x, 1.2, best.z]
    : [px + fx * w.range, 1.2, pz + fz * w.range];
  addTracer(G, origin, end);
  if (best) damageEnemy(G, best, w.dmg);
}
function damageEnemy(G, e, dmg) {
  if (e.kind === 'guard') {
    e.ref.hp -= dmg;
    if (e.ref.hp <= 0 && e.ref.alive) {
      e.ref.alive = false;
      G.scene.remove(e.ref.g);
      G.cash += 25;
      G.stats.kills++;
      G.centerMsg('Guard tumbang +$25', 1.5);
      sfx(G, 'coin');
    }
  } else if (e.kind === 'cop') {
    // Foot cop goes down; that is a crime.
    G.scene.remove(e.ref.g);
    G.footCops.splice(G.footCops.indexOf(e.ref), 1);
    G.cash += 25;
    G.stats.kills++;
    G.addWanted(1);
  }
}
export function updateCombat(G, dt) {
  const P = G.player;
  if (keyPressed(G, 'Digit1')) P.weapon = 0;
  if (keyPressed(G, 'Digit2')) P.weapon = 1;
  if (keyPressed(G, 'Digit3')) P.weapon = 2;
  // R reloads only on foot; R in a car starts a race (missions.js).
  if (keyPressed(G, 'KeyR') && !driveCarRef(G) && P.weapon > 0) {
    P.ammo[P.weapon] = WEAPONS[P.weapon].ammo;
    sfx(G, 'click');
  }
  if (keyPressed(G, 'Mouse0') || G.touchShoot) {
    G.touchShoot = false;
    if (!driveCarRef(G)) shoot(G);
  }
  // Guards: approach 2.6 m/s, shoot every ~1.6 s, 40% accuracy, 6 dmg.
  for (const gu of G.guards || []) {
    if (!gu.alive) continue;
    const dx = P.x - gu.x, dz = P.z - gu.z;
    const d = Math.hypot(dx, dz);
    if (d > 3) {
      gu.x += (dx / d) * 2.6 * dt;
      gu.z += (dz / d) * 2.6 * dt;
    }
    gu.g.position.set(gu.x, 0, gu.z);
    gu.g.rotation.y = Math.atan2(dx, dz);
    gu.shootT -= dt;
    if (gu.shootT <= 0 && d < 45) {
      gu.shootT = 1.6;
      if (G.rng.f() < 0.4) { hurtPlayer(G, 6); sfx(G, 'shot'); }
    }
  }
  for (const t of G.tracers || []) {
    t.life -= dt;
    if (t.life <= 0) { G.scene.remove(t.line); t.line.geometry.dispose(); }
  }
  G.tracers = (G.tracers || []).filter((t) => t.life > 0);
}
