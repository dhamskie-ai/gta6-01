// Wanted 0–5 + PCPD: mobil patroli (≥2 bintang) + polisi jalan kaki
// (≥1 bintang). AI kejar + tabrak + blokir; heat turun bila tak terlihat.
import { mulberry32, rr, pick, clamp } from './random.js';
import { createCar } from './vehicles.js';
import { makePersonModel } from './traffic.js';
import { nearestNode } from './city.js';
import { CFG } from './config.js';

export function createPolice(W) {
  const P = {
    wanted: 0, heat: 0, hiddenTimer: 0, cars: [], cops: [],
    sirenOn: false, units: [],
  };
  // Dipakai modul lain sebagai method (pola yang sama dengan W.hud / W.audio).
  P.nearbyPolice = (x, z, r) => nearbyPolice(W, x, z, r);
  P.addWanted = (w, n, reason) => addWanted(w, n, reason);
  W.police = P;
  return P;
}
export function addWanted(W, n, reason) {
  const P = W.police;
  const before = P.wanted;
  P.wanted = clamp(P.wanted + n, 0, 5);
  P.heat = CFG.wantedDecaySeen;
  if (P.wanted > before) {
    W.hud.toast(`WANTED ★${P.wanted} — ${reason}`);
    W.stats.maxWanted = Math.max(W.stats.maxWanted, P.wanted);
  }
  spawnForWanted(W);
}
export function nearbyPolice(W, x, z, radius) {
  const P = W.police;
  for (const c of P.cars) if (Math.hypot(c.car.x - x, c.car.z - z) < radius) return true;
  for (const c of P.cops) if (Math.hypot(c.x - x, c.z - z) < radius) return true;
  return false;
}
export function nearestPoliceDist(W) {
  const P = W.police;
  let bd = Infinity;
  const px = W.player.car ? W.player.car.x : W.player.x;
  const pz = W.player.car ? W.player.car.z : W.player.z;
  for (const c of P.cars) bd = Math.min(bd, Math.hypot(c.car.x - px, c.car.z - pz));
  for (const c of P.cops) bd = Math.min(bd, Math.hypot(c.x - px, c.z - pz));
  return bd;
}
function spawnForWanted(W) {
  const P = W.police;
  const rng = mulberry32(W.seed + 31 + P.wanted);
  const wantCars = P.wanted >= 2 ? Math.min(3, P.wanted - 1) : 0;
  const wantCops = P.wanted >= 1 ? Math.min(4, P.wanted + 1) : 0;
  const px = W.player.x, pz = W.player.z;
  while (P.cars.length < wantCars) {
    const a = rng() * Math.PI * 2;
    const car = createCar(W, 'pcpd', px + Math.sin(a) * 30, pz + Math.cos(a) * 30, a);
    car.driver = 'police';
    P.cars.push({ car, ram: pick(rng, ['RAMMING', 'RAMMING', 'ROADBLOCK', 'FIRING']), name: pick(rng, CFG.pcpdUnits) });
  }
  while (P.cops.length < wantCops) {
    const a = rng() * Math.PI * 2;
    const group = makePersonModel(W.three, rng, { shirt: 0x1a2a4a, pants: 0x1a2a4a });
    const x = px + Math.sin(a) * 14, z = pz + Math.cos(a) * 14;
    group.position.set(x, 0, z);
    W.scene.add(group);
    P.cops.push({ group, x, z, heading: a, speed: rr(rng, 2.6, 3.4), phase: 0, hp: 40, name: pick(rng, CFG.pcpdUnits) });
  }
}
function despawnExtra(W) {
  const P = W.police;
  const wantCars = P.wanted >= 2 ? Math.min(3, P.wanted - 1) : 0;
  const wantCops = P.wanted >= 1 ? Math.min(4, P.wanted + 1) : 0;
  while (P.cars.length > wantCars) {
    const c = P.cars.pop();
    W.scene.remove(c.car.group);
    const i = W.cars.list.indexOf(c.car);
    if (i >= 0) W.cars.list.splice(i, 1);
  }
  while (P.cops.length > wantCops) {
    const c = P.cops.pop();
    W.scene.remove(c.group);
  }
}
export function clearWantedAtRespray(W) {
  const P = W.police;
  if (P.wanted === 0) { W.hud.toast('Tidak ada bintang wanted.'); return; }
  const cost = P.wanted * CFG.resprayPerStar;
  if (W.cash < cost) { W.hud.toast(`Respray butuh $${cost} — uang kurang.`); return; }
  W.cash -= cost;
  P.wanted = 0; P.heat = 0;
  despawnExtra(W);
  W.audio.jingle();
  W.hud.toast('Spray & Shine: bintang wanted hilang!');
}
export function updatePolice(W, dt) {
  const P = W.police;
  const px = W.player.car ? W.player.car.x : W.player.x;
  const pz = W.player.car ? W.player.car.z : W.player.z;
  const seen = nearbyPolice(W, px, pz, 55);
  if (P.wanted > 0) {
    if (seen) { P.heat = CFG.wantedDecaySeen; P.hiddenTimer = 0; }
    else {
      P.hiddenTimer += dt;
      if (P.hiddenTimer > CFG.wantedDecayHidden) {
        P.wanted = 0; P.heat = 0; P.hiddenTimer = 0;
        despawnExtra(W);
        W.hud.toast('Kamu lolos — wanted padam.');
      } else if (P.hiddenTimer > CFG.wantedDecaySeen) {
        P.wanted = Math.max(0, P.wanted - 1);
        P.hiddenTimer = 0;
        despawnExtra(W);
      }
    }
  }
  // Sirene bila ada patroli aktif.
  const siren = P.cars.length > 0 && P.wanted > 0;
  if (siren !== P.sirenOn) { P.sirenOn = siren; W.audio.siren(siren); }
  if (siren) W.audio.siren(true); // update nada naik-turun
  // Mobil patroli: kejar + tabrak.
  for (const u of P.cars) {
    const c = u.car;
    const dx = px - c.x, dz = pz - c.z;
    const d = Math.hypot(dx, dz) || 1;
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - c.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    c.heading += clamp(dh, -1.6 * dt, 1.6 * dt);
    const target = d > 26 ? 30 : d > 8 ? 22 : 12;
    c.speed += (target - c.speed) * Math.min(1, dt * 1.2);
    c.x += Math.sin(c.heading) * c.speed * dt;
    c.z += Math.cos(c.heading) * c.speed * dt;
    c.x = clamp(c.x, -308, 308); c.z = clamp(c.z, -308, 308);
    c.group.position.set(c.x, 0, c.z);
    c.group.rotation.y = c.heading;
    // Tabrak pemain (di-skip saat shot: mobil pose, jangan melambat).
    if (d < 3.4 && !W.shotMode) {
      const playerCar = W.player.car;
      if (playerCar) {
        playerCar.hp -= 6 * dt * 10;
        playerCar.speed *= 0.92;
      } else {
        W.health -= 14 * dt;
        if (W.health <= 0) W.die('DITANGKAP');
      }
      c.speed *= 0.6;
    }
    // Lampu bar berkedip.
    const bar = c.group.userData.lightBar;
    if (bar) {
      const on = Math.floor(W.elapsed * 4) % 2 === 0;
      bar[0].material.emissive.setHex(on ? 0xFF2A2A : 0x220000);
      bar[1].material.emissive.setHex(on ? 0x220000 : 0x2A6AFF);
    }
  }
  // Polisi jalan kaki: kejar + pukul.
  for (const cop of P.cops) {
    const dx = px - cop.x, dz = pz - cop.z;
    const d = Math.hypot(dx, dz) || 1;
    cop.heading = Math.atan2(dx, dz);
    if (d > 2) {
      cop.x += Math.sin(cop.heading) * cop.speed * dt;
      cop.z += Math.cos(cop.heading) * cop.speed * dt;
    } else if (!W.player.car) {
      W.health -= 10 * dt;
      if (W.health <= 0) W.die('DITANGKAP');
    }
    cop.phase += dt * cop.speed * 3;
    const swing = Math.sin(cop.phase) * 0.5;
    const parts = cop.group.userData.parts;
    parts.legL.rotation.x = swing; parts.legR.rotation.x = -swing;
    parts.armL.rotation.x = -swing; parts.armR.rotation.x = swing;
    cop.group.position.set(cop.x, 0, cop.z);
    cop.group.rotation.y = cop.heading;
  }
  // Pose shot chase: 2 patroli mengapit VELOZ (override pergerakan kejar,
  // diterapkan di akhir update agar bertahan sampai render).
  if (W.shotMode && W.shotName === 'chase' && W.player.car && P.cars.length >= 2) {
    const pc = W.player.car;
    const fx = Math.sin(pc.heading), fz = Math.cos(pc.heading);
    const rx = Math.cos(pc.heading), rz = -Math.sin(pc.heading);
    P.cars.slice(0, 2).forEach((u, i) => {
      const sx = i === 0 ? -6 : 6, sz = i === 0 ? 4 : 6;
      u.car.x = pc.x + rx * sx + fx * sz;
      u.car.z = pc.z + rz * sx + fz * sz;
      u.car.heading = pc.heading;
      u.car.speed = 31;
      u.car.group.position.set(u.car.x, 0, u.car.z);
      u.car.group.rotation.y = u.car.heading;
    });
  }
  // Daftar unit untuk panel PCPD di HUD (mobil + polisi jalan kaki).
  P.units = P.cars.map((u) => ({
    name: u.name,
    dist: Math.round(Math.hypot(u.car.x - px, u.car.z - pz)),
    act: u.ram,
  })).concat(P.cops.map((c) => ({
    name: c.name || 'PCPD-UNIT',
    dist: Math.round(Math.hypot(c.x - px, c.z - pz)),
    act: 'PATROL',
  })));
}
