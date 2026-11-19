// SOLARA BAY — wanted stars + PCPD police AI.
// Stars 0–5 rise from stealing, speeding near police, hitting pedestrians
// and shooting. Patrol cars chase and ram from 2 stars; foot officers
// chase and punch from 1 star. Heat decays after 10 s unseen and clears
// after 20 s hidden; the Spray & Shine respray clears stars for cash.
import * as THREE from 'three';
import { CFG, POLICE_CALLSIGNS } from './config.js';
import { makeCar, driveToward } from './vehicles.js';
import { createPersonMesh } from './player.js';
import { rr, pick } from './random.js';

export function addWanted(G, n, reason) {
  const before = G.wanted;
  G.wanted = Math.max(0, Math.min(5, G.wanted + n));
  if (G.wanted > before) {
    G._panic = 2;
    G.lastSeen = 0;
    if (G.hud) G.hud.flashWanted = 1;
  }
  return G.wanted;
}

export function policeUnits(G) {
  const units = [];
  for (const u of G.policeCars) {
    units.push({ callsign: u.callsign, dist: Math.round(Math.hypot(u.car.x - G.player.x, u.car.z - G.player.z)), mode: 'RAMMING' });
  }
  for (const o of G.policeFoot) {
    units.push({ callsign: o.callsign, dist: Math.round(Math.hypot(o.x - G.player.x, o.z - G.player.z)), mode: 'ON FOOT' });
  }
  return units;
}

function spawnPoliceCar(G) {
  const angle = rr(G.rng, 0, Math.PI * 2);
  const x = G.player.x + Math.sin(angle) * 55;
  const z = G.player.z + Math.cos(angle) * 55;
  const car = makeCar('police', x, z, angle, undefined, true);
  car.traffic = false;
  G.W.scene.add(car.group);
  G.policeCars.push({ car, callsign: pick(G.rng, POLICE_CALLSIGNS) });
  G.audio.siren(true);
}

function spawnFootOfficer(G) {
  const angle = rr(G.rng, 0, Math.PI * 2);
  const x = G.player.x + Math.sin(angle) * 18;
  const z = G.player.z + Math.cos(angle) * 18;
  const mesh = createPersonMesh({ shirt: 0x14181f, pants: 0x14181f, hair: 0x14100c, hat: 0x14181f });
  mesh.position.set(x, 0, z);
  G.W.scene.add(mesh);
  G.policeFoot.push({ mesh, x, z, callsign: pick(G.rng, POLICE_CALLSIGNS), walkPhase: 0, cooldown: 0 });
}

export function updatePolice(G, dt, elapsed) {
  // Wanted decay: unseen 10 s -> -1 star, hidden 20 s -> clear.
  if (G.wanted > 0) {
    G.lastSeen = (G.lastSeen || 0) + dt;
    const nearest = G.policeCars.length
      ? Math.min(...G.policeCars.map((u) => Math.hypot(u.car.x - G.player.x, u.car.z - G.player.z)))
      : 999;
    if (nearest > 45) {
      if (G.lastSeen > CFG.wantedDecayUnseen) {
        const bucket = Math.floor((G.lastSeen - CFG.wantedDecayUnseen) / 10);
        if (bucket > (G._decayBucket || 0)) {
          G._decayBucket = bucket;
          G.wanted = Math.max(0, G.wanted - 1);
          if (G.wanted === 0) { G.lastSeen = 0; G._decayBucket = 0; }
        }
      }
    } else { G.lastSeen = 0; G._decayBucket = 0; }
  }
  // Desired force scales with stars.
  const wantCars = G.wanted >= 2 ? Math.min(3, G.wanted - 1) : 0;
  const wantFoot = G.wanted >= 1 ? Math.min(3, G.wanted) : 0;
  while (G.policeCars.length < wantCars) spawnPoliceCar(G);
  while (G.policeFoot.length < wantFoot) spawnFootOfficer(G);
  // Despawn extras when heat drops.
  while (G.policeCars.length > wantCars) {
    const u = G.policeCars.pop();
    G.W.scene.remove(u.car.group);
  }
  while (G.policeFoot.length > wantFoot) {
    const o = G.policeFoot.pop();
    G.W.scene.remove(o.mesh);
  }
  if (G.policeCars.length === 0 && G.wanted === 0) G.audio.siren(false);
  // Patrol cars ram the player; foot officers chase and punch.
  for (const u of G.policeCars) {
    const car = u.car;
    const d = driveToward(car, G.player.x, G.player.z, dt, G.city, car.def.maxSpeed * (0.85 + G.wanted * 0.03));
    if (d < 3.2) {
      car.speed *= 0.4;
      if (G.inCar) {
        G.car.hp = Math.max(0, (G.car.hp || 100) - 12 * dt);
        if (Math.random() < dt * 2) G.W.spawnParticles({ x: car.x, y: 0.8, z: car.z }, 0xffd23f, 4, 1.5, 1);
      } else if (Math.random() < dt * 0.5) {
        G.health = Math.max(0, G.health - 4);
      }
    }
  }
  for (const o of G.policeFoot) {
    const dx = G.player.x - o.x, dz = G.player.z - o.z;
    const dist = Math.hypot(dx, dz) || 1;
    const spd = 5.6 * dt;
    o.x += (dx / dist) * spd;
    o.z += (dz / dist) * spd;
    o.walkPhase += dt * 9;
    const parts = o.mesh.userData.parts;
    const swing = Math.sin(o.walkPhase) * 0.6;
    parts.legL.rotation.x = swing;
    parts.legR.rotation.x = -swing;
    parts.armL.rotation.x = -swing * 0.8;
    parts.armR.rotation.x = swing * 0.8;
    o.mesh.position.set(o.x, 0, o.z);
    o.mesh.rotation.y = Math.atan2(dx / dist, dz / dist);
    o.cooldown -= dt;
    if (dist < 1.6 && o.cooldown <= 0) {
      o.cooldown = 1.1;
      G.health = Math.max(0, G.health - 8);
      G.audio.punch();
      if (G.health <= 0) G.phase = 'busted';
    }
  }
  // Respray: near the shop with stars, E clears them for cash.
  const nearShop = Math.hypot(G.player.x - CFG.sprayShop.x, G.player.z - CFG.sprayShop.z) < 9;
  G._nearRespray = nearShop;
  if (nearShop && G._resprayKey && G.wanted > 0) {
    const cost = G.wanted * CFG.resprayPerStar;
    if (G.cash >= cost) {
      G.cash -= cost;
      G.wanted = 0;
      G.lastSeen = 0;
      G.audio.jingle(true);
    }
  }
}
