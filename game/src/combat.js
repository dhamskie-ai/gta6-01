import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { createPersonMesh } from './player.js';
import { addWanted } from './police.js';
import { wasPressed, wasClicked, isMouseDown } from './input.js';

export function initCombat(G) {
  G.ammo = { vesper: 72, mako: 150, breaker: 0 };
  G.owned = { breaker: false };
  G.weapon = 2; // MAKO default (HUD shows MAKO 150)
  G.fireCd = 0;
  G.enemies = [];
  G._kills = 0;
}

export function currentWeapon(G) { return WEAPONS[G.weapon]; }

export function damagePlayer(G, n) {
  if (G.phase !== 'play') return;
  let rest = n;
  if (G.armor > 0) {
    const absorbed = Math.min(G.armor, rest * 0.6);
    G.armor -= absorbed;
    rest -= absorbed;
  }
  G.health -= rest;
  if (G.health <= 0) {
    G.health = 0;
    G.phase = 'dead';
    G.audio.busted();
    G.audio.siren(false);
    G.audio.engine(false, 0);
  }
}

export function spawnGuard(G, x, z) {
  const mesh = createPersonMesh({ shirt: 0x8a2a2a, pants: 0x22262c, skin: 0xc98d64, hair: 0x14100c });
  mesh.position.set(x, 0, z);
  G.W.scene.add(mesh);
  const g = { mesh, x, z, hp: 60, shootCd: 1 + Math.random(), walkPhase: Math.random() * 6, kind: 'guard' };
  G.enemies.push(g);
  return g;
}

function muzzleWorldPos(G) {
  const p = G.player;
  const fx = Math.sin(p.camYaw), fz = Math.cos(p.camYaw);
  return { x: p.x + fx * 1.1, y: p.y + 1.45, z: p.z + fz * 1.1 };
}

function shootAt(G, from, dirX, dirY, dirZ, range, damage, spread) {
  const targets = [];
  for (const e of G.enemies) targets.push({ x: e.x, y: 1.2, z: e.z, r: 1.0, ref: e, kind: 'enemy' });
  for (const fp of G.footPolice) targets.push({ x: fp.x, y: 1.2, z: fp.z, r: 1.0, ref: fp, kind: 'cop' });
  for (const p of G.peds) targets.push({ x: p.x, y: 1.1, z: p.z, r: 0.9, ref: p, kind: 'ped' });
  let best = null, bestT = range;
  for (const t of targets) {
    const dx = t.x - from.x, dy = t.y - from.y, dz = t.z - from.z;
    const proj = dx * dirX + dy * dirY + dz * dirZ;
    if (proj < 0 || proj > range) continue;
    const px = from.x + dirX * proj, py = from.y + dirY * proj, pz = from.z + dirZ * proj;
    const miss = Math.hypot(t.x - px, t.y - py, t.z - pz);
    if (miss < t.r + spread && proj < bestT) { bestT = proj; best = t; }
  }
  const end = {
    x: from.x + dirX * (best ? bestT : range),
    y: from.y + dirY * (best ? bestT : range),
    z: from.z + dirZ * (best ? bestT : range),
  };
  G.W.spawnTracer(from, end);
  if (!best) return null;
  if (best.kind === 'enemy') {
    best.ref.hp -= damage;
    G.W.spawnParticles({ x: best.x, y: 1.2, z: best.z }, 0xff5040, 6, 1.4, 1.2);
    if (best.ref.hp <= 0) {
      G.W.spawnParticles({ x: best.x, y: 1, z: best.z }, 0xff5040, 18, 2.2, 1.6);
      G.W.scene.remove(best.ref.mesh);
      G.enemies = G.enemies.filter((e) => e !== best.ref);
      G._kills++;
    }
  } else if (best.kind === 'cop') {
    best.ref.hp -= damage;
    if (best.ref.hp <= 0) {
      G.W.spawnParticles({ x: best.x, y: 1, z: best.z }, 0xff5040, 14, 2, 1.5);
      G.W.scene.remove(best.ref.mesh);
      G.footPolice = G.footPolice.filter((f) => f !== best.ref);
      G._kills++;
    }
  } else if (best.kind === 'ped') {
    best.ref.hp -= damage;
    G._panic = 6;
    if (best.ref.hp <= 0) {
      G.W.spawnParticles({ x: best.x, y: 1, z: best.z }, 0xff5040, 10, 1.6, 1.2);
      G.W.scene.remove(best.ref.mesh.group);
      G.peds = G.peds.filter((pp) => pp !== best.ref);
    }
  }
  return best;
}

export function updateCombat(G, input, dt) {
  if (G.phase !== 'play' || G.inCar) { G.fireCd -= dt; return; }
  G.fireCd -= dt;
  for (let i = 0; i < 5; i++) {
    if (wasPressed(input, 'Digit' + (i + 1))) {
      const w = WEAPONS[i];
      if (w.locked) { if (G.hud) G.hud.toast(`${w.name} LOCKED`); continue; }
      if (w.id === 'breaker' && !G.owned.breaker) { if (G.hud) G.hud.toast('BREAKER — beli di CAL’S GUNS ($3,800)'); continue; }
      G.weapon = i;
      G.audio.click();
    }
  }
  if (wasPressed(input, 'KeyR')) {
    const w = currentWeapon(G);
    if (w.id !== 'fists' && G.ammo[w.id] <= 0 && (G.spare || 0) > 0) {
      const give = Math.min(30, G.spare);
      G.ammo[w.id] += give; G.spare -= give;
      if (G.hud) G.hud.toast(`Reload ${w.name} +${give}`);
    }
  }
  const w = currentWeapon(G);
  const p = G.player;
  if (w.id === 'fists') {
    if (wasClicked(input, 0) && G.fireCd <= 0) {
      G.fireCd = 0.4;
      G.audio.punch();
      const fx = Math.sin(p.camYaw), fz = Math.cos(p.camYaw);
      let hit = false;
      for (const e of G.enemies) {
        if (Math.hypot(e.x - p.x, e.z - p.z) < 2.4) { e.hp -= 14; hit = true; }
      }
      for (const fp of G.footPolice) {
        if (Math.hypot(fp.x - p.x, fp.z - p.z) < 2.4) { fp.hp -= 14; hit = true; }
      }
      if (hit) G.W.spawnParticles({ x: p.x + fx, y: 1.2, z: p.z + fz }, 0xffffff, 4, 0.8, 0.8);
    }
    return;
  }
  const cd = w.id === 'mako' ? 0.09 : w.id === 'breaker' ? 0.7 : 0.28;
  const wantFire = w.id === 'mako' ? isMouseDown(input, 0) : wasClicked(input, 0);
  if (wantFire && G.fireCd <= 0) {
    if (G.ammo[w.id] <= 0) {
      if (G.hud) G.hud.toast(`${w.name} — AMMO HABIS`);
      G.audio.click();
      G.fireCd = 0.3;
      return;
    }
    G.fireCd = cd;
    G.ammo[w.id]--;
    G.audio.shot(w.id);
    const from = muzzleWorldPos(G);
    G.W.muzzleFlash(from);
    const cam = G.W.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const spread = w.id === 'mako' ? 0.35 : w.id === 'breaker' ? 0.15 : 0.25;
    const hit = shootAt(G, from, dir.x, dir.y, dir.z, 70, w.id === 'breaker' ? 55 : w.id === 'mako' ? 16 : 26, spread);
    if (hit && hit.kind === 'ped') addWanted(G, 1, 'Wanted +1 — warga tertembak');
    if (hit && hit.kind === 'cop') addWanted(G, 2, 'Wanted +2 — polisi tertembak');
    p.camPitch = Math.min(0.55, p.camPitch + 0.012);
  }
}

export function updateEnemies(G, dt) {
  for (const e of [...G.enemies]) {
    const dx = G.player.x - e.x, dz = G.player.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    if (d < 42 && d > 16) {
      e.x += (dx / d) * 4.2 * dt;
      e.z += (dz / d) * 4.2 * dt;
      e.walkPhase += dt * 10;
      const swing = Math.sin(e.walkPhase) * 0.5;
      e.mesh.userData.legL.rotation.x = swing;
      e.mesh.userData.legR.rotation.x = -swing;
    }
    e.mesh.position.set(e.x, 0, e.z);
    e.mesh.rotation.y = Math.atan2(dx, dz);
    e.shootCd -= dt;
    if (e.shootCd <= 0 && d < 38 && G.phase === 'play') {
      e.shootCd = 1.7;
      G.audio.shot('vesper');
      const from = { x: e.x, y: 1.4, z: e.z };
      const to = G.inCar && G.car ? { x: G.car.x, y: 1, z: G.car.z } : { x: G.player.x, y: 1.3, z: G.player.z };
      G.W.spawnTracer(from, to);
      if (Math.random() < 0.4) {
        if (G.inCar && G.car) G.car.hp = Math.max(0, G.car.hp - 4);
        else damagePlayer(G, 7);
      }
    }
  }
}
