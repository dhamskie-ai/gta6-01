// Combat: fists + pistol, Dario's guards, tracers, muzzle flash, damage,
// health/armor pickups. Enemies chase and shoot with limited accuracy.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { rand } from './random.js';

export function createCombat(scene, rng) {
  const combat = {
    enemies: [], tracers: [], flash: null, flashTimer: 0, shootCooldown: 0,
    lastShotAt: 0, guardMeshes: [],
    spawnGuards(pos, count) {
      for (let i = 0; i < count; i++) this.spawnGuard(pos.x + rand(rng, -8, 8), pos.z + rand(rng, -8, 8));
    },
    spawnGuard(x, z) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.7, 0.6), new THREE.MeshLambertMaterial({ color: 0x2b2b33 }));
      body.position.y = 1.35; g.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
      head.position.y = 2.5; g.add(head);
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.8), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      gun.position.set(0.4, 1.5, 0.4); g.add(gun);
      g.position.set(x, 0, z); scene.add(g);
      const e = { mesh: g, hp: 60, shootTimer: rand(rng, 0.5, 2), speed: 3.2 };
      this.enemies.push(e); return e;
    },
    clearEnemies() { for (const e of this.enemies) scene.remove(e.mesh); this.enemies = []; },
    muzzleFlash(pos) {
      if (!this.flash) {
        this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
        scene.add(this.flash);
      }
      this.flash.position.copy(pos); this.flash.visible = true; this.flashTimer = 0.06;
    },
    tracer(from, to) {
      const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8 }));
      scene.add(line); this.tracers.push({ line, t: 0.08 });
    },
    burst(pos, color, n) {
      for (let i = 0; i < n; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshBasicMaterial({ color }));
        p.position.set(pos.x + rand(rng, -0.4, 0.4), pos.y + rand(rng, 0, 0.8), pos.z + rand(rng, -0.4, 0.4));
        scene.add(p); this.tracers.push({ line: p, t: 0.35, particle: true });
      }
    },
  };
  return combat;
}

// Player attacks: fists up close, pistol at range toward the aim direction.
export function playerAttack(S) {
  const p = S.player;
  if (S.combat.shootCooldown > 0) return;
  const w = WEAPONS[p.weapon];
  S.combat.shootCooldown = w.rate;
  const origin = p.inCar && p.car ? p.car.group.position.clone().add(new THREE.Vector3(0, 1.4, 0)) : p.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
  const dir = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
  if (p.weapon === 'fists') {
    S.audio.punch();
    for (const e of S.combat.enemies) {
      if (e.mesh.position.distanceTo(origin) < w.range + 1) { e.hp -= w.damage; S.combat.burst(e.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0)), 0xff4444, 4); }
    }
    return;
  }
  if (p.ammo <= 0) { S.audio.click(); S.hud.showPrompt('R — RELOAD'); return; }
  p.ammo--;
  S.audio.shot(); S.combat.lastShotAt = S.elapsed;
  S.combat.muzzleFlash(origin.clone().add(dir.clone().multiplyScalar(1)));
  const end = origin.clone().add(dir.clone().multiplyScalar(w.range));
  let hit = null;
  for (const e of S.combat.enemies) {
    const d = e.mesh.position.distanceTo(origin);
    if (d < w.range) {
      const to = e.mesh.position.clone().sub(origin).normalize();
      if (to.dot(dir) > 0.86 && (!hit || d < hit.d)) hit = { e, d };
    }
  }
  if (hit) {
    hit.e.hp -= w.damage;
    end.copy(hit.e.mesh.position).add(new THREE.Vector3(0, 1.4, 0));
    S.combat.burst(end, 0xff4444, 5);
  }
  S.combat.tracer(origin, end);
  S.police.addWanted(S, 1);
}

// Enemy AI: chase the player, keep some distance, shoot with poor accuracy.
export function updateCombat(S, dt) {
  const c = S.combat;
  c.shootCooldown = Math.max(0, c.shootCooldown - dt);
  if (c.flash) { c.flashTimer -= dt; if (c.flashTimer <= 0) c.flash.visible = false; }
  for (let i = c.tracers.length - 1; i >= 0; i--) {
    c.tracers[i].t -= dt;
    if (c.tracers[i].t <= 0) { S.scene.remove(c.tracers[i].line); c.tracers.splice(i, 1); }
  }
  const pp = S.player.mesh.position;
  for (let i = c.enemies.length - 1; i >= 0; i--) {
    const e = c.enemies[i];
    if (e.hp <= 0) { S.combat.burst(e.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xff4444, 8); S.scene.remove(e.mesh); c.enemies.splice(i, 1); S.player.cash += 25; continue; }
    const d = e.mesh.position.distanceTo(pp);
    const dir = pp.clone().sub(e.mesh.position); dir.y = 0; dir.normalize();
    if (d > 9) e.mesh.position.addScaledVector(dir, e.speed * dt);
    else if (d < 5) e.mesh.position.addScaledVector(dir, -e.speed * 0.5 * dt);
    e.mesh.lookAt(pp.x, 0, pp.z);
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && d < 34 && S.phase === 'playing') {
      e.shootTimer = rand(S.rng, 1.2, 2.4);
      S.audio.shot();
      const from = e.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
      c.tracer(from, pp.clone().add(new THREE.Vector3(0, 1.3, 0)));
      if (Math.random() < 0.3) damagePlayer(S, 8);
    }
  }
}

export function damagePlayer(S, amount) {
  const p = S.player;
  let left = amount;
  if (p.armor > 0) { const absorbed = Math.min(p.armor, left); p.armor -= absorbed; left -= absorbed; }
  p.hp -= left;
  if (p.hp <= 0) { p.hp = 0; S.gameOver('K.O.'); }
}
export function healPlayer(S, hp, armor) {
  S.player.hp = Math.min(100, S.player.hp + hp);
  S.player.armor = Math.min(100, S.player.armor + armor);
}
