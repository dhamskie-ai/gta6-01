// SOLARA BAY — combat: fists, pistols/SMG, guards, health + armor.
// Click to punch up close or shoot the equipped gun; R reloads, 1–5
// switch weapons. Guards are Dario's men: they chase, keep distance and
// shoot back with limited accuracy. Minimal red puffs, no gore.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { createPersonMesh } from './player.js';
import { addWanted } from './police.js';
import { wasPressed, wasClicked, isMouseDown } from './input.js';

export function initCombat(G) {
  G.enemies = [];
  G.weapon = 2; // MAKO
  G.ammo = { vesper: 72, mako: 150, breaker: 0 };
  G.health = 100;
  G.armor = 50;
  G.owned = { breaker: false };
  G._shootCooldown = 0;
}

export function currentWeapon(G) { return WEAPONS[G.weapon]; }

export function damagePlayer(G, n) {
  let left = n;
  if (G.armor > 0) {
    const absorbed = Math.min(G.armor, left * 0.6);
    G.armor -= absorbed;
    left -= absorbed;
  }
  G.health = Math.max(0, G.health - left);
  if (G.health <= 0) G.phase = 'dead';
}

export function spawnGuard(G, x, z) {
  const mesh = createPersonMesh({ shirt: 0x3a3f45, pants: 0x22303f, hair: 0x14100c });
  mesh.position.set(x, 0, z);
  G.W.scene.add(mesh);
  const e = { mesh, x, z, hp: 60, walkPhase: Math.random() * 6, shootCd: 1 + Math.random(), state: 'guard' };
  G.enemies.push(e);
  return e;
}

function fireBullet(G, from, dir, range, damage, hostile) {
  const to = { x: from.x + dir.x * range, y: from.y, z: from.z + dir.z * range };
  G.W.spawnTracer(from, to);
  G.W.muzzleFlash(from);
  G.audio.shot();
  if (!hostile) addWanted(G, 0, 'shot');
}

export function updateCombat(G, input, dt) {
  G._shootCooldown -= dt;
  // Weapon switching.
  for (let i = 0; i < 5; i++) {
    if (wasPressed(input, 'Digit' + (i + 1))) {
      const w = WEAPONS[i];
      if (w.locked) continue;
      if (w.id === 'breaker' && !G.owned.breaker) continue;
      G.weapon = i;
      G.audio.click();
    }
  }
  if (wasPressed(input, 'KeyR')) {
    const w = currentWeapon(G);
    if (w.id === 'vesper') G.ammo.vesper = 72;
    if (w.id === 'mako') G.ammo.mako = 150;
    if (w.id === 'breaker') G.ammo.breaker = 24;
    G.audio.click();
  }
  if (G.inCar) return;
  const w = currentWeapon(G);
  const p = G.player;
  const origin = { x: p.x, y: 1.5 + p.y, z: p.z };
  const dir = { x: Math.sin(p.heading), z: Math.cos(p.heading) };
  // Fists: punch the nearest enemy/ped within reach.
  if (w.id === 'fists') {
    if (wasClicked(input, 0) && G._shootCooldown <= 0) {
      G._shootCooldown = 0.45;
      G.audio.punch();
      let best = null, bd = 2.4;
      for (const e of G.enemies) {
        const d = Math.hypot(e.x - p.x, e.z - p.z);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        best.hp -= 25;
        G.W.spawnParticles({ x: best.x, y: 1.3, z: best.z }, 0xff5f5f, 6, 1, 1);
        if (best.hp <= 0) killEnemy(G, best);
      }
    }
    return;
  }
  // Guns: hold mouse to fire, consume ammo, hit the first enemy in the cone.
  if (isMouseDown(input, 0) && G._shootCooldown <= 0) {
    const key = w.id;
    if ((G.ammo[key] || 0) <= 0) {
      G._shootCooldown = 0.3;
      G.audio.click();
      return;
    }
    G.ammo[key]--;
    G._shootCooldown = w.id === 'breaker' ? 0.7 : 0.14;
    fireBullet(G, origin, dir, 60, 0, false);
    addWanted(G, 0, 'shot');
    if (G.wanted === 0 && Math.random() < 0.5) addWanted(G, 1, 'shot fired');
    let best = null, bd = 60;
    for (const e of G.enemies) {
      const ex = e.x - p.x, ez = e.z - p.z;
      const along = ex * dir.x + ez * dir.z;
      if (along < 0 || along > 60) continue;
      const perp = Math.abs(ex * dir.z - ez * dir.x);
      if (perp < 1.6 && along < bd) { bd = along; best = e; }
    }
    if (best) {
      best.hp -= w.id === 'breaker' ? 70 : 34;
      G.W.spawnParticles({ x: best.x, y: 1.3, z: best.z }, 0xff5f5f, 8, 1.2, 1);
      if (best.hp <= 0) killEnemy(G, best);
    }
    // Hitting a pedestrian raises wanted.
    for (const ped of G.peds) {
      const ex = ped.x - p.x, ez = ped.z - p.z;
      const along = ex * dir.x + ez * dir.z;
      if (along > 0 && along < 60 && Math.abs(ex * dir.z - ez * dir.x) < 1.2) {
        ped.flee = 4;
        addWanted(G, 1, 'pedestrian hit');
        break;
      }
    }
  }
}

function killEnemy(G, e) {
  G.W.spawnParticles({ x: e.x, y: 1.2, z: e.z }, 0xff5f5f, 16, 2, 2);
  G.W.scene.remove(e.mesh);
  G.enemies = G.enemies.filter((o) => o !== e);
  G.kills = (G.kills || 0) + 1;
  if (G.missionGuardsLeft !== undefined) G.missionGuardsLeft--;
}

export function updateEnemies(G, dt) {
  for (const e of [...G.enemies]) {
    const dx = G.player.x - e.x, dz = G.player.z - e.z;
    const dist = Math.hypot(dx, dz) || 1;
    e.shootCd -= dt;
    if (dist > 14) {
      e.x += (dx / dist) * 4.2 * dt;
      e.z += (dz / dist) * 4.2 * dt;
      e.state = 'chase';
    } else if (dist < 7) {
      e.x -= (dx / dist) * 2.5 * dt;
      e.z -= (dz / dist) * 2.5 * dt;
      e.state = 'hold';
    }
    e.walkPhase += dt * 7;
    const parts = e.mesh.userData.parts;
    const swing = Math.sin(e.walkPhase) * 0.5;
    parts.legL.rotation.x = swing;
    parts.legR.rotation.x = -swing;
    e.mesh.position.set(e.x, 0, e.z);
    e.mesh.rotation.y = Math.atan2(dx / dist, dz / dist);
    if (dist < 30 && e.shootCd <= 0 && !G.inCar) {
      e.shootCd = 1.1 + Math.random() * 0.8;
      const from = { x: e.x, y: 1.4, z: e.z };
      const dir = { x: dx / dist, z: dz / dist };
      fireBullet(G, from, dir, dist + 2, 0, true);
      if (Math.random() < 0.45) damagePlayer(G, 7);
    }
  }
}
