// Combat: fists + 4 guns, guards with simple chase-and-shoot AI,
// muzzle flash, tracers, health/armor. R reloads only on foot.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { clamp, dist2, angDiff } from './random.js';
import { wasPressed, isDown } from './input.js';
import { addWanted } from './police.js';
import { sfxShot, sfxPunch } from './audio.js';

export function initCombat(G) {
  G.player.weapon = 1; // VESPER
  G.player.ammo = WEAPONS.map((w) => w.ammo);
  G.player.fireT = 0;
  G.guards = [];
  G.gunfireT = 0;
  // muzzle flash sprite + tracer line (reused)
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.fx.glowTex,
    color: 0xffd23a, transparent: true, opacity: 0, depthWrite: false }));
  flash.scale.set(2, 2, 1);
  G.fx.scene.add(flash);
  G.combatFx = { flash, flashT: 0, tracer: null };
}
export function spawnGuards(G, x, z, n) {
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    const dark = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35), dark);
    body.position.y = 1.05; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36),
      new THREE.MeshLambertMaterial({ color: 0xc98a5a }));
    head.position.y = 1.65; g.add(head);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.7), dark);
    gun.position.set(0.3, 1.1, 0.3); g.add(gun);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), dark);
    legs.position.y = 0.35; g.add(legs);
    const gx = x + (i - 1) * 3, gz = z + (i % 2) * 3;
    g.position.set(gx, 0, gz);
    G.fx.scene.add(g);
    G.guards.push({ mesh: g, x: gx, z: gz, hp: 50, heading: 0, shootT: 1 + i * 0.5 });
  }
}
function nearestEnemy(G, maxD, maxAng) {
  const p = G.player;
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  let best = null, bd = maxD * maxD;
  const targets = [];
  for (const gd of G.guards) targets.push({ x: gd.x, z: gd.z, ref: gd, kind: 'guard' });
  for (const u of G.cops) {
    if (u.foot) targets.push({ x: u.x, z: u.z, ref: u, kind: 'cop' });
    else if (u.car) targets.push({ x: u.car.x, z: u.car.z, ref: u, kind: 'copcar' });
  }
  for (const t of targets) {
    const dx = t.x - p.x, dz = t.z - p.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > bd) continue;
    const d = Math.sqrt(d2) || 1;
    const ang = Math.abs(angDiff(p.heading, Math.atan2(dx, dz)));
    if (ang > maxAng) continue;
    bd = d2; best = t;
  }
  return best;
}
function damagePlayer(G, dmg) {
  const p = G.player;
  let rest = dmg;
  if (p.armor > 0) { const ab = Math.min(p.armor, rest); p.armor -= ab; rest -= ab; }
  p.health -= rest;
  if (p.health <= 0) { p.health = 0; G.phase = 'dead'; }
}
function damageEnemy(G, t, dmg) {
  if (t.kind === 'guard') {
    t.ref.hp -= dmg;
    if (t.ref.hp <= 0) {
      G.fx.scene.remove(t.ref.mesh);
      G.guards.splice(G.guards.indexOf(t.ref), 1);
    }
  } else if (t.kind === 'cop') {
    // foot cops go down, wanted +2
    G.fx.scene.remove(t.ref.mesh);
    G.cops.splice(G.cops.indexOf(t.ref), 1);
    addWanted(G, 2);
  } else if (t.kind === 'copcar') {
    t.ref.car.hp -= dmg;
    if (t.ref.car.hp <= 0) {
      G.fx.scene.remove(t.ref.car.mesh);
      G.cars.splice(G.cars.indexOf(t.ref.car), 1);
      G.cops.splice(G.cops.indexOf(t.ref), 1);
      addWanted(G, 2);
    }
  }
}
export function updateCombat(G, dt) {
  const p = G.player;
  const input = G.input;
  G.gunfireT = Math.max(0, (G.gunfireT || 0) - dt);
  p.fireT = Math.max(0, (p.fireT || 0) - dt);
  // weapon select 1-5 (KESTREL locked until mission 7 done)
  for (let i = 0; i < 5; i++) {
    if (wasPressed(input, 'Digit' + (i + 1))) {
      if (i === 4 && (G.stats.missionsDone || 0) < 7) { G.hudMsg = 'KESTREL locked — finish mission 7'; continue; }
      if (i === 3 && G.cash < WEAPONS[3].price && p.ammo[3] === 0) { G.hudMsg = 'BREAKER costs $3,800'; continue; }
      p.weapon = i;
    }
  }
  // reload (on foot only — R is also the race key)
  if (wasPressed(input, 'KeyR') && p.onFoot) {
    const w = WEAPONS[p.weapon];
    if (w.ammo !== Infinity) p.ammo[p.weapon] = w.ammo;
  }
  // fire
  const firing = (isDown(input, 'Mouse0') || G.touch?.shoot) && p.fireT <= 0;
  if (firing && p.onFoot) {
    const w = WEAPONS[p.weapon];
    p.fireT = w.rate;
    if (p.weapon === 0) {
      const t = nearestEnemy(G, w.range, 0.9);
      if (t) { damageEnemy(G, t, w.dmg); if (G.audio) sfxPunch(G.audio); }
      return;
    }
    if (p.ammo[p.weapon] <= 0) { G.hudMsg = 'Out of ammo — press R'; return; }
    p.ammo[p.weapon]--;
    G.gunfireT = 1;
    addWanted(G, 1);
    if (G.audio) sfxShot(G.audio);
    const t = nearestEnemy(G, w.range, 0.35);
    if (t) damageEnemy(G, t, w.dmg);
    // muzzle flash + tracer
    const fx = G.combatFx;
    fx.flash.position.set(p.x + Math.sin(p.heading) * 1, 1.4, p.z + Math.cos(p.heading) * 1);
    fx.flash.material.opacity = 0.9; fx.flashT = 0.06;
    if (fx.tracer) { G.fx.scene.remove(fx.tracer); fx.tracer.geometry.dispose(); }
    const end = t ? new THREE.Vector3(t.x, 1.2, t.z)
      : new THREE.Vector3(p.x + Math.sin(p.heading) * w.range, 1.2, p.z + Math.cos(p.heading) * w.range);
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(p.x, 1.4, p.z), end]);
    fx.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe28a }));
    G.fx.scene.add(fx.tracer);
    setTimeout(() => { if (fx.tracer) { G.fx.scene.remove(fx.tracer); fx.tracer = null; } }, 60);
  }
  const fx = G.combatFx;
  if (fx.flashT > 0) { fx.flashT -= dt; if (fx.flashT <= 0) fx.flash.material.opacity = 0; }
  // guards AI: chase + shoot with limited accuracy
  for (const gd of [...G.guards]) {
    const d = Math.sqrt(dist2(gd.x, gd.z, p.x, p.z));
    const desired = Math.atan2(p.x - gd.x, p.z - gd.z);
    gd.heading += angDiff(gd.heading, desired) * Math.min(1, dt * 5);
    if (d > 12) {
      gd.x += Math.sin(gd.heading) * 3.2 * dt;
      gd.z += Math.cos(gd.heading) * 3.2 * dt;
    }
    gd.mesh.position.set(gd.x, 0, gd.z);
    gd.mesh.rotation.y = gd.heading;
    gd.shootT -= dt;
    if (d < 26 && gd.shootT <= 0) {
      gd.shootT = 1.2;
      if (G.rng() < 0.45) { damagePlayer(G, 8); if (G.audio) sfxShot(G.audio); }
    }
  }
}
