// Combat: fists + 4 guns, guards, health/armor, shops, pickups.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { mulberry32, range, pick, chance, clamp } from './random.js';

export function createCombat(G) {
  const r = mulberry32(G.seed + 17);
  const enemies = [];
  let cooldown = 0, lastShotT = -99, reloading = false, reloadT = 0;
  let mouseDown = false, mousePressed = false;
  addEventListener('mousedown', (e) => { if (e.button === 0) { mouseDown = true; mousePressed = true; } });
  addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
  function guardFigure() {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.34), mat); body.position.y = 1.1; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshLambertMaterial({ color: 0xc89878 })); head.position.y = 1.72; g.add(head);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.7), new THREE.MeshLambertMaterial({ color: 0x111111 })); gun.position.set(0.3, 1.2, 0.4); g.add(gun);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.2), mat); legL.position.set(-0.15, 0.33, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.15; g.add(legR);
    G.scene.add(g);
    return { group: g, legL, legR };
  }
  function spawnGuard(x, z) {
    const f = guardFigure();
    const e = { ...f, x, z, hp: 50, heading: 0, shootT: range(r, 1, 2), phase: 0 };
    f.group.position.set(x, 0, z);
    enemies.push(e); return e;
  }
  function clearEnemies() {
    for (const e of [...enemies]) { G.scene.remove(e.group); enemies.splice(enemies.indexOf(e), 1); }
  }
  function curWeapon() { return G.weapons[G.weaponIndex]; }
  function hurtPlayer(dmg, src) {
    if (G.phase !== 'play') return;
    if (G.armor > 0) { const ab = Math.min(G.armor, dmg); G.armor -= ab; dmg -= ab; }
    G.health -= dmg;
    G.hud.flashDamage();
    if (G.health <= 0) { G.health = 0; G.phase = 'dead'; G.missions.failMission('K.O. — Nico is down.'); }
  }
  function fire() {
    const w = curWeapon();
    if (cooldown > 0 || reloading) return;
    if (w.id === 'fists') {
      cooldown = w.rate; G.audio.punch();
      const rangeM = 2.4;
      let best = null, bd = rangeM;
      for (const e of enemies) { const d = Math.hypot(e.x - G.player.x, e.z - G.player.z); if (d < bd) { bd = d; best = e; } }
      for (const c of G.police.cops) { const d = Math.hypot(c.x - G.player.x, c.z - G.player.z); if (d < bd) { bd = d; best = c; } }
      if (best) {
        if (best.hp !== undefined) { best.hp -= w.dmg; G.render.burst(best.x, 1.4, best.z, 0xff5a5a, 8); if (best.hp <= 0) killEnemy(best); }
        else { G.police.addWanted(2); G.scene.remove(best.group); G.police.cops.splice(G.police.cops.indexOf(best), 1); }
      }
      return;
    }
    if (w.ammo <= 0) { reload(); return; }
    cooldown = w.rate; w.ammo--;
    lastShotT = G.time;
    G.audio.shot();
    G.police.addWanted(1);
    const yaw = G.player.camYaw, pitch = -G.player.camPitch;
    const ox = G.player.x, oy = G.player.y + 1.5, oz = G.player.z;
    const dx = Math.sin(yaw) * Math.cos(pitch), dy = Math.sin(pitch), dz = Math.cos(yaw) * Math.cos(pitch);
    let hitD = 120;
    for (const e of enemies) {
      const d = Math.hypot(e.x - ox, e.z - oz);
      const along = (e.x - ox) * dx + (e.z - oz) * dz;
      if (along > 0 && along < hitD && Math.abs((e.x - ox) * dz - (e.z - oz) * dx) < 1.6) { hitD = along; e.hp -= w.dmg; if (e.hp <= 0) killEnemy(e); }
    }
    for (const c of G.police.cops) {
      const along = (c.x - ox) * dx + (c.z - oz) * dz;
      if (along > 0 && along < hitD && Math.abs((c.x - ox) * dz - (c.z - oz) * dx) < 1.6) { hitD = along; G.police.addWanted(1); G.scene.remove(c.group); G.police.cops.splice(G.police.cops.indexOf(c), 1); }
    }
    G.render.tracer(ox, oy, oz, ox + dx * hitD, oy + dy * hitD, oz + dz * hitD);
    G.render.burst(ox + dx * hitD, oy + dy * hitD, oz + dz * hitD, 0xffca7a, 6);
  }
  function killEnemy(e) {
    G.render.burst(e.x, 1.2, e.z, 0xff5a5a, 18);
    G.scene.remove(e.group);
    enemies.splice(enemies.indexOf(e), 1);
    G.missions?.onGuardKilled?.(e);
  }
  function reload() {
    const w = curWeapon();
    if (w.id === 'fists' || w.ammo >= w.max || reloading) return;
    reloading = true; reloadT = 1.1;
  }
  // pickups
  const pickups = [];
  function addPickup(kind, x, z) {
    const col = kind === 'health' ? 0x5dff8f : 0x5ad8ff;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshBasicMaterial({ color: col }));
    m.position.set(x, 0.9, z); G.scene.add(m);
    pickups.push({ kind, mesh: m, x, z });
  }
  addPickup('health', 40, -100); addPickup('armor', -100, 140); addPickup('health', 200, 100);
  return {
    enemies, lastShotT: -99,
    firedRecently() { return G.time - lastShotT < 6; },
    spawnGuard, clearEnemies, hurtPlayer, reload,
    curWeapon,
    buyWeapon(id) {
      const w = G.weapons.find((v) => v.id === id);
      if (!w || w.owned || G.cash < w.price) return false;
      G.cash -= w.price; w.owned = true; w.ammo = w.max;
      if (id === 'kestrel') w.locked = false;
      return true;
    },
    update(dt) {
      cooldown = Math.max(0, cooldown - dt);
      if (reloading) { reloadT -= dt; if (reloadT <= 0) { const w = curWeapon(); w.ammo = w.max; reloading = false; } }
      if (G.input.pressed('KeyR')) reload();
      for (let i = 1; i <= 5; i++) if (G.input.pressed('Digit' + i)) { const w = G.weapons[i - 1]; if (w.owned && !w.locked) { G.weaponIndex = i - 1; G.audio.click(); } }
      if (mouseDown && G.phase === 'play') {
        const w = curWeapon();
        if (w.auto) fire();
        else if (mousePressed) fire();
      }
      mousePressed = false;
      // guards AI
      for (const e of [...enemies]) {
        const d = Math.hypot(G.player.x - e.x, G.player.z - e.z);
        e.heading = Math.atan2(G.player.x - e.x, G.player.z - e.z);
        e.group.rotation.y = e.heading;
        e.phase += dt * 4;
        e.legL.rotation.x = Math.sin(e.phase) * 0.5; e.legR.rotation.x = -Math.sin(e.phase) * 0.5;
        if (d > 3) { e.x += Math.sin(e.heading) * 3.4 * dt; e.z += Math.cos(e.heading) * 3.4 * dt; e.group.position.set(e.x, 0, e.z); }
        e.shootT -= dt;
        if (e.shootT <= 0 && d < 42) {
          e.shootT = range(r, 1.4, 2.4);
          G.audio.shot();
          if (chance(r, 0.35)) hurtPlayer(range(r, 4, 9));
          G.render.tracer(e.x, 1.3, e.z, G.player.x, G.player.y + 1.2, G.player.z);
        }
      }
      // pickups
      for (const p of pickups) {
        p.mesh.rotation.y += dt;
        if (Math.hypot(G.player.x - p.x, G.player.z - p.z) < 1.8) {
          if (p.kind === 'health') G.health = Math.min(100, G.health + 40);
          else G.armor = Math.min(100, G.armor + 50);
          G.audio.coin(); G.scene.remove(p.mesh); pickups.splice(pickups.indexOf(p), 1);
        }
      }
    },
  };
}
