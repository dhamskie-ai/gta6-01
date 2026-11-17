// Combat: fists + pistol, enemy guards, health/armor, pickups.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makePedModel, scarePedestrians } from './traffic.js';
import { spawnParticles } from './render.js';
import { damagePlayer } from './police.js';
import { addWanted } from './vehicles.js';

export function createCombat(G) {
  G.enemies = [];
  G.bullets = [];
  G.player.weapon = 'fists';
  G.player.ammo = 0;
  G.player.pistolOwned = false;
  G.player.punchCooldown = 0;
  G.player.shootCooldown = 0;
}

export function spawnGuard(G, x, z, hp = 50) {
  const mesh = makePedModel(G.rng);
  mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  mesh.position.set(x, 0, z);
  G.scene.add(mesh);
  const guard = { mesh, hp, maxHp: hp, shootCooldown: G.rng.range(1, 2.5), walkPhase: 0 };
  G.enemies.push(guard);
  return guard;
}

export function removeGuard(G, guard) {
  const i = G.enemies.indexOf(guard);
  if (i >= 0) G.enemies.splice(i, 1);
  G.scene.remove(guard.mesh);
}

export function updateCombat(G, dt) {
  const p = G.player;
  p.punchCooldown -= dt;
  p.shootCooldown -= dt;
  // Weapon switching.
  if (G.input.pressed('Digit1')) { p.weapon = 'fists'; G.hud.setToast('Senjata: Tinju'); }
  if (G.input.pressed('Digit2') && p.pistolOwned) { p.weapon = 'pistol'; G.hud.setToast('Senjata: Pistol'); }
  if (G.input.pressed('KeyR') && p.weapon === 'pistol') {
    p.ammo = 12;
    G.audio?.blip(500, 0.08, 'square', 0.1);
    G.hud.setToast('Pistol diisi ulang');
  }
  // Fire / punch on click.
  if (G.input.mouseClicked && G.phase === 'play') {
    if (p.weapon === 'pistol' && p.pistolOwned) shootPistol(G);
    else if (p.weapon === 'fists') punchAttack(G);
  }
  updateEnemies(G, dt);
  updateBullets(G, dt);
}

function aimPoint(G) {
  // Where the camera looks: forward from the player at eye height.
  const p = G.player;
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  const origin = p.car ? p.car.mesh.position.clone().setY(1.6) : p.pos.clone().setY(1.6);
  return { origin, dir };
}

function shootPistol(G) {
  const p = G.player;
  if (p.shootCooldown > 0) return;
  if (p.ammo <= 0) {
    G.audio?.blip(200, 0.1, 'square', 0.1);
    G.hud.setToast('Peluru habis — tekan R');
    return;
  }
  p.shootCooldown = 0.28;
  p.ammo -= 1;
  G.audio?.gunshot();
  const { origin, dir } = aimPoint(G);
  // Muzzle flash + tracer.
  spawnParticles(G, origin.clone().add(dir.clone().multiplyScalar(1.2)), 0xffd24a, 5, 1, 1, 0.15);
  const hit = findShotHit(G, origin, dir, 60);
  if (hit) {
    damageEnemy(G, hit.enemy, 34, hit.point);
  }
  scarePedestrians(G, p.pos, 30);
  addWanted(G, 1, 'Menembak di kota');
}

function findShotHit(G, origin, dir, maxDist) {
  let best = null, bestD = maxDist;
  const targets = [
    ...G.enemies.map((e) => ({ mesh: e.mesh, ref: e, kind: 'guard' })),
    ...G.footPolice.map((c) => ({ mesh: c.mesh, ref: c, kind: 'cop' })),
  ];
  for (const t of targets) {
    const pos = t.mesh.position;
    const to = new THREE.Vector3(pos.x - origin.x, 1.2 - origin.y, pos.z - origin.z);
    const along = to.dot(dir);
    if (along < 0 || along > bestD) continue;
    const closest = origin.clone().add(dir.clone().multiplyScalar(along));
    const perp = Math.hypot(closest.x - pos.x, closest.z - pos.z);
    if (perp < 1.6) { bestD = along; best = { enemy: t, point: closest }; }
  }
  return best;
}

function damageEnemy(G, target, dmg, point) {
  const ref = target.ref;
  ref.hp -= dmg;
  spawnParticles(G, point, 0xff4444, 6, 2, 2, 0.5);
  if (ref.hp > 0) return;
  if (target.kind === 'cop') {
    const i = G.footPolice.indexOf(ref);
    if (i >= 0) G.footPolice.splice(i, 1);
    G.scene.remove(ref.mesh);
    addWanted(G, 2, 'Menembak polisi');
    G.missions.onGuardDown?.(G);
  } else {
    spawnParticles(G, ref.mesh.position.clone().setY(1), 0xff4444, 14, 3, 3, 0.8);
    removeGuard(G, ref);
    G.missions.onGuardDown?.(G);
  }
}

function punchAttack(G) {
  const p = G.player;
  if (p.punchCooldown > 0) return;
  p.punchCooldown = 0.45;
  G.audio?.punch();
  const range = 2.2;
  const targets = [
    ...G.enemies.map((e) => ({ mesh: e.mesh, ref: e, kind: 'guard' })),
    ...G.footPolice.map((c) => ({ mesh: c.mesh, ref: c, kind: 'cop' })),
  ];
  for (const t of targets) {
    const d = t.mesh.position.distanceTo(p.pos);
    if (d < range) {
      damageEnemy(G, t, 18, t.mesh.position.clone().setY(1.2));
      break;
    }
  }
}

function updateEnemies(G, dt) {
  const p = G.player;
  const playerPos = p.car ? p.car.mesh.position : p.pos;
  for (const guard of [...G.enemies]) {
    const gp = guard.mesh.position;
    const dx = playerPos.x - gp.x, dz = playerPos.z - gp.z;
    const dist = Math.hypot(dx, dz);
    guard.mesh.rotation.y = Math.atan2(-dx, -dz);
    guard.shootCooldown -= dt;
    if (dist > 24) {
      // Walk toward the player.
      gp.x += -Math.sin(guard.mesh.rotation.y) * 2.5 * dt;
      gp.z += -Math.cos(guard.mesh.rotation.y) * 2.5 * dt;
      guard.walkPhase += dt * 6;
      const swing = Math.sin(guard.walkPhase) * 0.5;
      guard.mesh.userData.legL.rotation.x = swing;
      guard.mesh.userData.legR.rotation.x = -swing;
    } else if (guard.shootCooldown <= 0 && dist < 30) {
      guard.shootCooldown = 1.4 + G.rng.next();
      G.audio?.gunshot();
      spawnParticles(G, gp.clone().setY(1.5), 0xffd24a, 4, 1, 1, 0.15);
      // Limited accuracy.
      if (G.rng.chance(0.35)) {
        if (p.car) { p.car.hp -= 5; }
        else damagePlayer(G, 7);
        spawnParticles(G, playerPos.clone().setY(1.2), 0xff4444, 4, 2, 2, 0.4);
      }
    }
  }
}

function updateBullets(G, dt) {
  // Tracers are particle-based; nothing persistent to update.
}

// Pickups: health, armor, sun coins.
export function spawnPickups(G) {
  G.pickups = [];
  const hpMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x882222 });
  const arMat = new THREE.MeshLambertMaterial({ color: 0x4a8ad8, emissive: 0x113366 });
  const spots = [
    { x: 30, z: -30, kind: 'health' }, { x: -90, z: 90, kind: 'health' },
    { x: 150, z: 150, kind: 'armor' }, { x: -180, z: -90, kind: 'armor' },
    { x: 90, z: -150, kind: 'health' },
  ];
  for (const s of spots) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), s.kind === 'health' ? hpMat : arMat);
    mesh.position.set(s.x, 1, s.z);
    G.scene.add(mesh);
    G.pickups.push({ mesh, kind: s.kind, taken: false });
  }
  // Sun coins: golden spinning discs across the city.
  G.coins = [];
  const coinGeo = new THREE.TorusGeometry(0.5, 0.18, 8, 16);
  const coinMat = new THREE.MeshLambertMaterial({ color: 0xffd24a, emissive: 0xaa7700 });
  for (let i = 0; i < CFG.sunCoinCount; i++) {
    const mesh = new THREE.Mesh(coinGeo, coinMat);
    const x = G.rng.range(-260, 260);
    const z = G.rng.range(-260, 260);
    mesh.position.set(x, 1.2, z);
    mesh.rotation.x = Math.PI / 2;
    G.scene.add(mesh);
    G.coins.push({ mesh, x, z, taken: false });
  }
}

export function updatePickups(G, dt, time) {
  const p = G.player;
  const pos = p.car ? p.car.mesh.position : p.pos;
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    pk.mesh.rotation.y += dt * 2;
    pk.mesh.position.y = 1 + Math.sin(time * 2 + pk.mesh.position.x) * 0.15;
    if (pk.mesh.position.distanceTo(pos) < 2.2) {
      pk.taken = true;
      pk.mesh.visible = false;
      if (pk.kind === 'health') { p.hp = Math.min(CFG.maxHealth, p.hp + 40); G.hud.setToast('Health +40'); }
      else { p.armor = Math.min(CFG.maxArmor, p.armor + 50); G.hud.setToast('Armor +50'); }
      G.audio?.coin();
    }
  }
  for (const c of G.coins) {
    if (c.taken) continue;
    c.mesh.rotation.z += dt * 2;
    if (Math.hypot(c.x - pos.x, c.z - pos.z) < 2.2) {
      c.taken = true;
      c.mesh.visible = false;
      p.cash += 25;
      G.stats.coins += 1;
      G.audio?.coin();
      G.hud.setToast(`Sun coin! +$25 (${G.stats.coins}/${CFG.sunCoinCount})`);
    }
  }
}
