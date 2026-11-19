// Combat: tinju + pistol/SMG/shotgun, musuh penjaga Dario, health/armor,
// pickup, toko senjata Cal's Guns. Tembakan = tes jarak + sudut kamera.
import { mulberry32, rr, pick, clamp } from './random.js';
import { makePersonModel } from './traffic.js';
import { fleePeds } from './traffic.js';
import { CFG } from './config.js';

export function createCombat(W) {
  const C = {
    weapon: 1, ammo: [Infinity, 12, 0, 0, 0],
    owned: [true, true, false, false, false],
    enemies: [], cooldown: 0, reloadT: 0, pickups: [],
  };
  // Pickup health/armor di 4 titik kota.
  for (const [x, z, kind] of [[-120, -100, 'hp'], [120, 140, 'ar'], [-260, 200, 'hp'], [200, -120, 'ar']]) {
    const mesh = new W.three.Mesh(
      new W.three.BoxGeometry(0.8, 0.8, 0.8),
      new W.three.MeshLambertMaterial({ color: kind === 'hp' ? 0x2aff5a : 0x6db7ff, emissive: kind === 'hp' ? 0x1a5a2a : 0x1a3a5a }),
    );
    mesh.position.set(x, 0.8, z);
    W.scene.add(mesh);
    C.pickups.push({ mesh, x, z, kind, taken: false, respawn: 0 });
  }
  W.combat = C;
  return C;
}
export function switchWeapon(W, i) {
  const C = W.combat;
  const def = CFG.weapons[i];
  if (!def) return;
  if (def.locked) { W.hud.toast('KESTREL masih LOCKED — selesaikan Golden Hour.'); return; }
  if (!C.owned[i]) { W.hud.toast(`${def.name} belum dibeli — ke Cal's Guns.`); return; }
  C.weapon = i;
  W.audio.click();
}
export function buyWeapon(W, i) {
  const C = W.combat;
  const def = CFG.weapons[i];
  if (!def || def.locked) return false;
  if (C.owned[i]) { W.hud.toast(`${def.name} sudah dimiliki.`); return true; }
  if (W.cash < def.price) { W.hud.toast(`${def.name} $${def.price} — uang kurang ($${W.cash}).`); return false; }
  W.cash -= def.price;
  C.owned[i] = true;
  C.ammo[i] = def.mag;
  W.audio.jingle();
  W.hud.toast(`${def.name} dibeli! Tekan ${i + 1} untuk pakai.`);
  return true;
}
export function spawnGuards(W, x, z, n) {
  const rng = mulberry32(W.seed + 55 + W.combat.enemies.length);
  for (let i = 0; i < n; i++) {
    const group = makePersonModel(W.three, rng, { shirt: 0x1a1d22, pants: 0x1a1d22 });
    const gx = x + rr(rng, -6, 6), gz = z + rr(rng, -6, 6);
    group.position.set(gx, 0, gz);
    W.scene.add(group);
    W.combat.enemies.push({ group, x: gx, z: gz, hp: 50, heading: 0, shootT: rr(rng, 0.5, 1.5), phase: 0, dead: false });
  }
}
function camForward(W) {
  const e = new W.three.Euler(0, 0, 0, 'YXZ');
  e.setFromQuaternion(W.camera.quaternion);
  return { x: -Math.sin(e.y), z: -Math.cos(e.y) };
}
function nearestTarget(W, maxDist, maxAngle) {
  const px = W.player.car ? W.player.car.x : W.player.x;
  const pz = W.player.car ? W.player.car.z : W.player.z;
  const f = camForward(W);
  let best = null, bd = maxDist;
  const test = (x, z, obj) => {
    const dx = x - px, dz = z - pz;
    const d = Math.hypot(dx, dz);
    if (d > bd || d < 0.5) return;
    const dot = (dx * f.x + dz * f.z) / d;
    if (dot < Math.cos(maxAngle)) return;
    bd = d; best = { ...obj, d };
  };
  for (const e of W.combat.enemies) if (!e.dead) test(e.x, e.z, { type: 'enemy', ref: e });
  for (const c of W.police.cops) test(c.x, c.z, { type: 'cop', ref: c });
  return best;
}
export function shoot(W) {
  const C = W.combat;
  const def = CFG.weapons[C.weapon];
  if (C.reloadT > 0 || C.cooldown > 0) return;
  C.cooldown = def.rate;
  if (C.weapon === 0) { punch(W); return; }
  if (C.ammo[C.weapon] <= 0) {
    W.audio.click();
    W.hud.toast('Peluru habis — tekan R untuk reload.');
    return;
  }
  C.ammo[C.weapon]--;
  W.audio.shot();
  const px = W.player.car ? W.player.car.x : W.player.x;
  const pz = W.player.car ? W.player.car.z : W.player.z;
  const py = W.player.car ? 1.4 : 1.5;
  const f = camForward(W);
  const endX = px + f.x * 46, endZ = pz + f.z * 46;
  W.effects.tracer(px, py, pz, endX, py, endZ);
  W.effects.muzzle(px + f.x * 1.2, py, pz + f.z * 1.2);
  const hit = nearestTarget(W, 46, 0.22);
  if (hit) {
    const dmg = def.dmg * (C.weapon === 3 ? 1 : 1);
    if (hit.type === 'enemy') {
      hit.ref.hp -= dmg;
      W.effects.puff(hit.ref.x, 1.4, hit.ref.z, 0xd21f2b);
      if (hit.ref.hp <= 0) {
        hit.ref.dead = true;
        W.scene.remove(hit.ref.group);
        W.cash += 50;
        W.hud.toast('Penjaga tumbang! +$50');
      }
    } else {
      hit.ref.hp -= dmg;
      W.effects.puff(hit.ref.x, 1.4, hit.ref.z, 0xd21f2b);
      if (hit.ref.hp <= 0) {
        W.scene.remove(hit.ref.group);
        const i = W.police.cops.indexOf(hit.ref);
        if (i >= 0) W.police.cops.splice(i, 1);
        W.police.addWanted(W, 2, 'polisi tumbang');
      }
    }
    if (!hit.ref.dead) fleePeds(W, hit.ref.x, hit.ref.z, 12);
  }
  fleePeds(W, px, pz, 10);
}
export function punch(W) {
  const C = W.combat;
  C.cooldown = CFG.weapons[0].rate;
  W.audio.punch();
  const px = W.player.x, pz = W.player.z;
  for (const e of W.combat.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - px, e.z - pz);
    if (d < 2.4) {
      e.hp -= CFG.weapons[0].dmg;
      e.x += (e.x - px) / (d || 1) * 1.5;
      e.z += (e.z - pz) / (d || 1) * 1.5;
      W.effects.puff(e.x, 1.3, e.z, 0xd21f2b);
      if (e.hp <= 0) { e.dead = true; W.scene.remove(e.group); W.cash += 50; }
    }
  }
  fleePeds(W, px, pz, 8);
}
export function updateCombat(W, dt) {
  const C = W.combat;
  C.cooldown = Math.max(0, C.cooldown - dt);
  if (C.reloadT > 0) {
    C.reloadT -= dt;
    if (C.reloadT <= 0) {
      const def = CFG.weapons[C.weapon];
      C.ammo[C.weapon] = def.mag;
      W.hud.toast(`${def.name} reload selesai.`);
    }
  }
  const slot = W.input.weaponSlot();
  if (slot >= 0) switchWeapon(W, slot);
  if (W.input.action('reload') && C.weapon > 0 && C.reloadT <= 0) {
    const def = CFG.weapons[C.weapon];
    if (C.ammo[C.weapon] < def.mag) { C.reloadT = 0.9; W.audio.reload(); }
  }
  if (W.input.mouseDown && W.state === 'playing' && !W.player.car) shoot(W);
  // Pickup: dekat = ambil.
  for (const pk of C.pickups) {
    if (pk.taken) {
      pk.respawn -= dt;
      if (pk.respawn <= 0) { pk.taken = false; pk.mesh.visible = true; }
      continue;
    }
    pk.mesh.rotation.y += dt * 2;
    pk.mesh.position.y = 0.8 + Math.sin(W.elapsed * 3) * 0.15;
    const d = Math.hypot(pk.x - W.player.x, pk.z - W.player.z);
    if (d < 1.6) {
      pk.taken = true; pk.mesh.visible = false; pk.respawn = 45;
      if (pk.kind === 'hp') { W.health = Math.min(100, W.health + 40); W.hud.toast('Health +40'); }
      else { W.armor = Math.min(100, W.armor + 40); W.hud.toast('Armor +40'); }
      W.audio.coin();
    }
  }
  // Musuh: dekati sampai 12 m lalu tembak (akurasi terbatas).
  const px = W.player.car ? W.player.car.x : W.player.x;
  const pz = W.player.car ? W.player.car.z : W.player.z;
  for (const e of W.combat.enemies) {
    if (e.dead) continue;
    const dx = px - e.x, dz = pz - e.z;
    const d = Math.hypot(dx, dz);
    e.heading = Math.atan2(dx, dz);
    if (d > 12) {
      e.x += Math.sin(e.heading) * 3.2 * dt;
      e.z += Math.cos(e.heading) * 3.2 * dt;
      e.phase += dt * 8;
    } else {
      e.shootT -= dt;
      if (e.shootT <= 0) {
        e.shootT = 1.5;
        W.audio.shot();
        W.effects.tracer(e.x, 1.4, e.z, px, 1.2, pz);
        if (Math.random() < 0.28) {
          let dmg = 8;
          if (W.armor > 0) { const absorbed = Math.min(W.armor, dmg); W.armor -= absorbed; dmg -= absorbed; }
          W.health -= dmg;
          W.effects.puff(px, 1.4, pz, 0xd21f2b);
          if (W.health <= 0) W.die('K.O.');
        }
      }
    }
    const swing = Math.sin(e.phase) * 0.5;
    const parts = e.group.userData.parts;
    parts.legL.rotation.x = swing; parts.legR.rotation.x = -swing;
    e.group.position.set(e.x, 0, e.z);
    e.group.rotation.y = e.heading;
  }
}
