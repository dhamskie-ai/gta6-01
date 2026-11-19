// Combat: fists (1) + VESPER 72 pistol (2) + MAKO SMG (3), Dario's guards,
// health/armor, muzzle flash, tracer lines, hit puffs, KO / DITANGKAP.
import * as THREE from 'three';
import { G } from './config.js';
import { keys, pressed, mouse, touch } from './input.js';
import { addWanted } from './police.js';
import { sfx } from './audio.js';
import { driveCarRef } from './player.js';

let flash = null, flashT = 0, tracers = [];

export function spawnGuard(x, z) {
  const g = new THREE.Group();
  const suit = new THREE.MeshLambertMaterial({ color: 0x1a1a22 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.34), suit);
  body.position.y = 0.95; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xd8a070 }));
  head.position.y = 1.62; g.add(head);
  const shades = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.1),
    new THREE.MeshLambertMaterial({ color: 0x000000 }));
  shades.position.set(0, 1.64, 0.2); g.add(shades);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0, 1.1, 0.4); g.add(gun);
  g.position.set(x, 0, z);
  G.scene.add(g);
  const e = { group: g, x, z, hp: 50, heading: 0, shootT: 2, kind: 'guard' };
  G.enemies.push(e);
  return e;
}

function puff(x, y, z, color) {
  const p = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }));
  p.position.set(x, y, z);
  G.scene.add(p);
  tracers.push({ mesh: p, t: 0.35, fade: true });
}

function tracer(from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8 }));
  G.scene.add(line);
  tracers.push({ mesh: line, t: 0.12, fade: false });
}

function shootAt(tx, tz, ty) {
  const from = new THREE.Vector3(G.player.pos.x, 1.4, G.player.pos.z);
  const to = new THREE.Vector3(tx, ty, tz);
  tracer(from, to);
  if (!flash) {
    flash = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    G.scene.add(flash);
  }
  flash.position.copy(from).add(new THREE.Vector3(Math.sin(G.player.heading) * 0.8, 0, Math.cos(G.player.heading) * 0.8));
  flash.visible = true; flashT = 0.06;
  sfx.shot();
}

export function updateCombat(dt) {
  if (pressed.Digit1) G.weapon = 0;
  if (pressed.Digit2) G.weapon = 1;
  if (pressed.Digit3) G.weapon = 2;
  if (pressed.KeyR) {
    G.ammo[1] = 72; G.ammo[2] = 150;
    sfx.click();
  }
  const wantShoot = mouse.down || touch.shoot;
  const car = driveCarRef();
  if (wantShoot && !car && G.phase === 'play') {
    if (G.weapon === 0) {
      // punch: nearest enemy within 2 m
      let best = null, bd = 4;
      for (const e of G.enemies) {
        if (!e || typeof e.hp !== 'number') continue;
        const d2 = (e.x - G.player.pos.x) ** 2 + (e.z - G.player.pos.z) ** 2;
        if (d2 < bd) { bd = d2; best = e; }
      }
      if (best) {
        best.hp -= 25; sfx.punch();
        puff(best.x, 1.2, best.z, 0xff5a4a);
        if (best.hp <= 0) killEnemy(best);
      }
      mouse.down = false;
    } else if (G.ammo[G.weapon] > 0) {
      G.ammo[G.weapon]--;
      // hit the nearest guard roughly ahead within 40 m
      const fx = Math.sin(G.player.heading), fz = Math.cos(G.player.heading);
      let best = null, bd = 1600;
      for (const e of G.enemies) {
        if (!e || typeof e.hp !== 'number') continue;
        const dx = e.x - G.player.pos.x, dz = e.z - G.player.pos.z;
        const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
        if (along > 1 && along < 40 && side < 3 && along * along < bd) { bd = along * along; best = e; }
      }
      if (best) {
        shootAt(best.x, best.z, 1.2);
        best.hp -= G.weapon === 2 ? 22 : 34;
        puff(best.x, 1.2, best.z, 0xff5a4a);
        if (best.hp <= 0) killEnemy(best);
      } else {
        const tx = G.player.pos.x + fx * 30, tz = G.player.pos.z + fz * 30;
        shootAt(tx, tz, 1.2);
      }
      if (G.wanted < 5) addWanted(1);
      mouse.down = false;
    }
  }
  if (flash) {
    flashT -= dt;
    if (flashT <= 0) flash.visible = false;
  }
  // guards: approach and shoot with limited accuracy
  for (const e of [...G.enemies]) {
    if (!e || typeof e.hp !== 'number') continue;
    const dx = G.player.pos.x - e.x, dz = G.player.pos.z - e.z;
    const d = Math.hypot(dx, dz);
    e.heading = Math.atan2(dx, dz);
    if (d > 3) {
      e.x += Math.sin(e.heading) * 2.6 * dt;
      e.z += Math.cos(e.heading) * 2.6 * dt;
    }
    e.group.position.set(e.x, 0, e.z);
    e.group.rotation.y = e.heading;
    e.shootT -= dt;
    if (e.shootT <= 0 && d < 26 && d > 2) {
      e.shootT = 1.6 + Math.random();
      if (Math.random() < 0.4) {
        const dmg = 6;
        if (G.armor > 0) G.armor = Math.max(0, G.armor - dmg);
        else G.health -= dmg;
        puff(G.player.pos.x, 1.3, G.player.pos.z, 0xffd23d);
        sfx.shot();
      }
    }
  }
  for (let i = tracers.length - 1; i >= 0; i--) {
    const tr = tracers[i];
    tr.t -= dt;
    if (tr.fade) tr.mesh.material.opacity = Math.max(0, tr.t * 2.2);
    if (tr.t <= 0) { G.scene.remove(tr.mesh); tracers.splice(i, 1); }
  }
  if (G.health <= 0 && G.phase === 'play') {
    G.health = 0;
    G.phase = 'over';
  }
}

function killEnemy(e) {
  puff(e.x, 1.2, e.z, 0xff5a4a);
  G.scene.remove(e.group);
  G.enemies.splice(G.enemies.indexOf(e), 1);
  G.stats.kills++;
  G.cash += 25;
  sfx.coin();
  if (G.wanted < 5) addWanted(1);
}
