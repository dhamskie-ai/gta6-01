// Combat: fists + pistol, enemy guards, health/armor, tracers, pickups.
import * as THREE from 'three';
import { removePed } from './traffic.js';

export function createCombat(G) {
  G.enemies = [];
  G.tracers = [];
  G.pickups = [];
  const geo = new THREE.BoxGeometry(0.08, 0.08, 1);
  G.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe14a });
  G.tracerGeo = geo;
}

export function spawnGuard(G, x, z) {
  const ped = G.spawnPed(x, z);
  ped.state = 'guard'; ped.hp = 60; ped.speed = 3.0; ped.shootT = 0; ped.accuracy = 0.25;
  // Dark crew colours via instance colours.
  G.pedMeshes.body.setColorAt(ped.slot, new THREE.Color(0x3a3a3a));
  G.pedMeshes.armL.setColorAt(ped.slot, new THREE.Color(0x3a3a3a));
  G.pedMeshes.armR.setColorAt(ped.slot, new THREE.Color(0x3a3a3a));
  G.pedMeshes.body.instanceColor.needsUpdate = true;
  G.pedMeshes.armL.instanceColor.needsUpdate = true;
  G.pedMeshes.armR.instanceColor.needsUpdate = true;
  G.enemies.push(ped);
  return ped;
}

export function spawnPickup(G, kind, x, z) {
  const color = kind === 'health' ? 0x3ddc5f : 0x4aa8ff;
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7),
    new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.5 }));
  m.position.set(x, 0.8, z);
  G.scene.add(m);
  G.pickups.push({ mesh: m, kind, x, z });
}

function fireTracer(G, from, to) {
  const m = new THREE.Mesh(G.tracerGeo, G.tracerMat);
  const mid = from.clone().add(to).multiplyScalar(0.5);
  m.position.copy(mid);
  m.lookAt(to);
  m.scale.set(1, 1, from.distanceTo(to));
  G.scene.add(m);
  G.tracers.push({ mesh: m, life: 0.08 });
}

export function playerShoot(G) {
  const p = G.player;
  if (p.weapon === 0) {
    // Punch: hit the nearest enemy/police within 2.2 m.
    G.audio.punch();
    const target = nearestFoe(G, 2.4);
    if (target) damageFoe(G, target, 25);
    return;
  }
  if (p.ammo <= 0) { G.audio.tone(180, 0.1, 'square', 0.15); return; }
  p.ammo--;
  G.audio.shot();
  G.lastShotT = G.time;
  G.muzzleT = 0.06;
  addWantedOnce(G);
  const dir = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
  // Camera-aimed: shoot toward where the camera looks on foot.
  const from = p.pos.clone().add(new THREE.Vector3(0, 1.4, 0));
  const to = from.clone().add(dir.clone().multiplyScalar(60));
  fireTracer(G, from, to);
  // Hit the first foe near the shot line.
  let best = null, bd = 3;
  for (const foe of [...G.enemies, ...G.footPolice]) {
    const fx = foe.x - from.x, fz = foe.z - from.z;
    const along = fx * dir.x + fz * dir.z;
    if (along < 0 || along > 60) continue;
    const perp = Math.abs(fx * dir.z - fz * dir.x);
    if (perp < bd) { bd = perp; best = foe; }
  }
  if (best) damageFoe(G, best, 34);
}

let wantedGiven = false;
function addWantedOnce(G) {
  if (!wantedGiven) { wantedGiven = true; G.addWanted(1, 'fired a weapon'); }
  setTimeout(() => { wantedGiven = false; }, 8000);
}

function nearestFoe(G, range) {
  const p = G.player.pos;
  let best = null, bd = range;
  for (const foe of [...G.enemies, ...G.footPolice]) {
    const d = Math.hypot(foe.x - p.x, foe.z - p.z);
    if (d < bd) { bd = d; best = foe; }
  }
  return best;
}

export function damageFoe(G, foe, dmg) {
  foe.hp = (foe.hp ?? 50) - dmg;
  G.effects.burst(foe.x, 1.4, foe.z, 0xff5555, 8);
  if (foe.hp <= 0) {
    removePed(G, foe);
    G.enemies.splice(G.enemies.indexOf(foe), 1);
    G.footPolice.splice(G.footPolice.indexOf(foe), 1);
    G.missionFoesLeft = Math.max(0, (G.missionFoesLeft || 0) - 1);
    G.audio.noise(0.2, 0.3, 300);
  }
}

export function damagePlayer(G, dmg) {
  const p = G.player;
  if (p.armor > 0) { const absorbed = Math.min(p.armor, dmg); p.armor -= absorbed; dmg -= absorbed; }
  p.health -= dmg;
  G.hud.flashDamage();
  if (p.health <= 0) { p.health = 0; G.wasted(); }
}

export function updateCombat(G, dt) {
  const p = G.player;
  // Weapon switching + reload.
  if (G.input.wasPressed('Digit1')) { p.weapon = 0; G.audio.pickup(); }
  if (G.input.wasPressed('Digit2') && p.hasPistol) { p.weapon = 1; G.audio.pickup(); }
  if (G.input.wasPressed('KeyR') && p.weapon === 1) {
    if (p.cash >= 20) { p.cash -= 20; p.ammo = 12; G.hud.toast('Ammo refilled — $20'); }
    else { p.ammo = 6; G.hud.toast('Ammo refilled (6) — broke, huh'); }
  }
  if (G.input.mouseClicked && G.phase === 'play') playerShoot(G);
  // Enemy AI: chase, shoot with limited accuracy, or punch up close.
  for (const foe of [...G.enemies]) {
    const dx = p.pos.x - foe.x, dz = p.pos.z - foe.z;
    const d = Math.hypot(dx, dz) || 1;
    foe.yaw = Math.atan2(dx, dz);
    foe.shootT -= dt;
    if (d > 2.2) {
      foe.x += (dx / d) * foe.speed * dt; foe.z += (dz / d) * foe.speed * dt;
    } else if (foe.shootT <= 0) {
      foe.shootT = 1.1; damagePlayer(G, 8); G.audio.punch();
    }
    if (d < 26 && d > 2.2 && foe.shootT <= 0) {
      foe.shootT = 1.4;
      const from = new THREE.Vector3(foe.x, 1.4, foe.z);
      const to = p.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
      fireTracer(G, from, to);
      G.audio.shot();
      if (G.rng.chance(foe.accuracy)) damagePlayer(G, 7);
    }
    // Position/animation are written by updatePeds from x/z/yaw.
  }
  // Tracer fade.
  for (const t of [...G.tracers]) {
    t.life -= dt;
    if (t.life <= 0) { G.scene.remove(t.mesh); G.tracers.splice(G.tracers.indexOf(t), 1); }
  }
  // Pickups.
  for (const pk of [...G.pickups]) {
    pk.mesh.rotation.y += dt * 2;
    const d = Math.hypot(pk.x - p.pos.x, pk.z - p.pos.z);
    if (d < 1.6) {
      if (pk.kind === 'health') p.health = Math.min(100, p.health + 40);
      else p.armor = Math.min(100, p.armor + 50);
      G.audio.pickup();
      G.scene.remove(pk.mesh);
      G.pickups.splice(G.pickups.indexOf(pk), 1);
    }
  }
  if (G.muzzleT > 0) G.muzzleT -= dt;
}
