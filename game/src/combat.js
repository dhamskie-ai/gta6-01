// Combat: tinju, senjata, musuh, health/armor, pickup.
import { WEAPONS } from './config.js';
import { clamp, dist2 } from './random.js';
import { damagePlayer } from './vehicles.js';

export function initCombat(G) {
  G.weapons = {};
  for (const [k, w] of Object.entries(WEAPONS)) {
    G.weapons[k] = { ...w, ammo: w.ammo, mag: w.ammo };
  }
  G.weapon = 1;
  G.shootCd = 0; G.reloadT = 0;
  G.enemies = [];
  G.pickups = [];
}

export function switchWeapon(G, n) {
  const w = G.weapons[n];
  if (!w) return;
  if (w.locked && !w.owned) { G.hud.ticker('KESTREL terkunci — selesaikan misi 7 dulu.'); return; }
  if (!w.owned) {
    if (G.cash >= w.price) {
      G.cash -= w.price; w.owned = true;
      G.hud.ticker(w.name + ' dibeli — $' + w.price.toLocaleString('en-US'));
      G.audio.jingle();
    } else {
      G.hud.ticker(w.name + ' butuh $' + w.price.toLocaleString('en-US') + ' — uang kurang.');
      return;
    }
  }
  G.weapon = n;
  G.audio.click();
}

export function spawnGuard(G, THREE, x, z) {
  const mesh = makeGuardMesh(THREE);
  mesh.position.set(x, 0, z);
  G.scene.add(mesh);
  const g = { mesh, x, z, yaw: 0, hp: 50, speed: 2.6, shootCd: 1.5, dead: false };
  G.enemies.push(g);
  return g;
}

function makeGuardMesh(THREE) {
  const g = new THREE.Group();
  const suit = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.05, 0.4), suit);
  body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skin);
  head.position.y = 1.82; g.add(head);
  const shade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.12),
    new THREE.MeshLambertMaterial({ color: 0x11151c }));
  shade.position.set(0, 1.86, 0.24); g.add(shade);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.24), suit);
  legL.position.set(-0.17, 0.42, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.17; g.add(legR);
  g.userData = { legL, legR };
  return g;
}

export function spawnPickups(G, THREE, city) {
  const spots = [
    { kind: 'health', x: 60, z: 120 }, { kind: 'armor', x: -60, z: -120 },
    { kind: 'health', x: 180, z: 0 }, { kind: 'armor', x: -180, z: 180 },
    { kind: 'health', x: -240, z: 30 }, { kind: 'armor', x: 120, z: 180 },
  ];
  for (const s of spots) {
    const color = s.kind === 'health' ? 0x2aff5e : 0x37e0ff;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8),
      new THREE.MeshBasicMaterial({ color }));
    m.position.set(s.x, 1, s.z);
    G.scene.add(m);
    G.pickups.push({ ...s, mesh: m, taken: false });
  }
}

function nearestTarget(G, maxD) {
  const px = G.player.x, pz = G.player.z;
  let best = null, bd = maxD * maxD;
  const consider = (t) => {
    if (t.dead || t.hp <= 0) return;
    const d2 = dist2(t.x, t.z, px, pz);
    if (d2 < bd) { bd = d2; best = t; }
  };
  for (const e of G.enemies) consider(e);
  for (const c of G.footCops) consider(c);
  return best;
}

export function updateCombat(G, dt, input, camera) {
  G.shootCd -= dt;
  if (G.reloadT > 0) {
    G.reloadT -= dt;
    if (G.reloadT <= 0) {
      const w = G.weapons[G.weapon];
      w.mag = w.ammo;
      G.hud.ticker(w.name + ' terisi ulang.');
    }
  }
  const w = G.weapons[G.weapon];
  const firing = input.clicked || (w.auto && input.keys.has('Mouse0'));
  if (firing && G.shootCd <= 0 && G.reloadT <= 0 && G.phase === 'play') {
    if (G.weapon === 1) {
      const t = nearestTarget(G, 2.4);
      G.audio.punch();
      G.shootCd = w.rate;
      if (t) {
        t.hp -= w.dmg;
        G.renderFx.burst(t.x, 1.4, t.z, 0xff5a5a, 6);
        if (t.hp <= 0) killTarget(G, t);
      }
    } else if (w.mag > 0) {
      w.mag -= 1;
      G.audio.shot();
      G.shootCd = w.rate;
      G.fleeUntil = performance.now() + 2500;
      const t = nearestTarget(G, 60);
      const from = { x: G.player.x, y: 1.5, z: G.player.z };
      let to = null;
      if (t) {
        const d = Math.sqrt(dist2(t.x, t.z, G.player.x, G.player.z)) || 1;
        to = { x: t.x, y: 1.4, z: t.z };
        t.hp -= w.dmg;
        G.renderFx.burst(t.x, 1.4, t.z, 0xff5a5a, 8);
        if (t.hp <= 0) killTarget(G, t);
      } else {
        const yaw = G.player.inCar ? G.playerCar.yaw : G.player.yaw;
        to = { x: G.player.x + Math.sin(yaw) * 40, y: 1.4, z: G.player.z + Math.cos(yaw) * 40 };
      }
      G.renderFx.tracer(from, to);
      G.renderFx.muzzle(from);
      if (w.mag === 0) G.hud.ticker(w.name + ' kosong — tekan R.');
    } else {
      G.audio.click();
      G.shootCd = 0.3;
    }
  }
  // musuh: kejar + tembak
  for (const e of G.enemies) {
    if (e.dead) continue;
    const dx = G.player.x - e.x, dz = G.player.z - e.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    e.yaw = Math.atan2(dx, dz);
    if (d > 8) { e.x += Math.sin(e.yaw) * e.speed * dt; e.z += Math.cos(e.yaw) * e.speed * dt; }
    e.shootCd -= dt;
    if (d < 26 && e.shootCd <= 0) {
      e.shootCd = 1.6;
      G.audio.shot();
      if (!G.shotMode && Math.random() < 0.4) damagePlayer(G, 6);
      G.renderFx.tracer({ x: e.x, y: 1.5, z: e.z }, { x: G.player.x, y: 1.4, z: G.player.z });
    }
    e.mesh.position.set(e.x, 0, e.z);
    e.mesh.rotation.y = e.yaw;
    const sw = Math.sin(performance.now() / 180 + e.x) * 0.4;
    e.mesh.userData.legL.rotation.x = sw;
    e.mesh.userData.legR.rotation.x = -sw;
  }
  // pickup
  for (const p of G.pickups) {
    if (p.taken) continue;
    p.mesh.rotation.y += dt * 2;
    const d2 = dist2(p.x, p.z, G.player.x, G.player.z);
    if (d2 < 2.2 * 2.2) {
      p.taken = true; p.mesh.visible = false;
      if (p.kind === 'health') { G.health = clamp(G.health + 40, 0, 100); G.hud.ticker('Health +40'); }
      else { G.armor = clamp(G.armor + 50, 0, 100); G.hud.ticker('Armor +50'); }
      G.audio.jingle();
    }
  }
  // asap mobil rusak
  for (const car of G.cars) {
    if (!car.isPlayer || car.dead) continue;
    if (car.hp < car.maxHp * 0.4 && Math.random() < dt * 6) {
      G.renderFx.burst(car.x, 1.2, car.z, 0x666666, 3);
    }
  }
}

function killTarget(G, t) {
  t.dead = true;
  G.renderFx.burst(t.x, 1.2, t.z, 0xff5a5a, 14);
  if (t.mesh) t.mesh.visible = false;
  G.stats.kills = (G.stats.kills || 0) + 1;
  if (G.mission && G.mission.onKill) G.mission.onKill(G, t);
}
