// Traffic AI, pedestrians, parked cars, NPCs.
import * as THREE from 'three';
import { CFG, PARKED, CROWDS } from './config.js';
import { makeCar, isCarObj } from './vehicles.js';
import { makePersonMesh, collideCircle } from './city.js';
import { driveCarRef } from './player.js';
import { sfx } from './audio.js';

const MIX = ['sedan', 'taxi', 'van', 'sedan', 'taxi', 'truck', 'sedan', 'van', 'bus', 'sedan', 'taxi', 'sport'];
const SKINS = [0xc98a5e, 0x8a5a3a, 0xe8b88a, 0x6a4a2a];
const SHIRTS = [0xc22030, 0x2e6fd8, 0x1e9e6a, 0xf5c518, 0x8a5a9a, 0xe8e4d8, 0xff8fd0, 0x37e0ff];
const PANTS = [0x2c3242, 0x3a3f4a, 0x5a4a3a, 0x1e3a5e];

export function spawnParkedCars(G) {
  for (const [type, x, z, h] of PARKED) {
    let px = x, pz = z;
    if (collideCircle(G, px, pz, 2.2)) {
      // Shift to nearest road lane.
      let best = null;
      for (const r of [...CFG.roads, ...CFG.ringRoads]) {
        for (const d of [-3.4, 3.4]) {
          const c1 = [r + d, pz], c2 = [px, r + d];
          for (const [cx, cz] of [c1, c2]) {
            const dd = Math.hypot(cx - x, cz - z);
            if (!collideCircle(G, cx, cz, 2.2) && (best === null || dd < best[0])) best = [dd, cx, cz];
          }
        }
      }
      if (best) { px = best[1]; pz = best[2]; }
    }
    const car = makeCar(G, type, px, pz, h, type === 'sport' && px === -240 && pz === 66 ? { color: 0xff2e7e } : {});
    car.parked = true;
    G.cars.push(car);
  }
}
export function initTraffic(G) {
  G.traffic = [];
  const roads = [...CFG.roads, ...CFG.ringRoads];
  for (let i = 0; i < CFG.trafficN; i++) {
    const type = MIX[i % MIX.length];
    const road = G.rng.pick(roads);
    const axis = G.rng.chance(0.5) ? 'v' : 'h';
    const dir = G.rng.chance(0.5) ? 1 : -1;
    const lane = dir > 0 ? 3.4 : -3.4;
    const along = G.rng.range(-300, 300);
    const x = axis === 'v' ? road + lane : along;
    const z = axis === 'v' ? along : road + lane;
    const heading = axis === 'v' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = makeCar(G, type, x, z, heading);
    car.traffic = true; car.axis = axis; car.dir = dir; car.lane = lane; car.road = road;
    car.cruise = G.rng.range(8, 16);
    car.speed = car.cruise;
    G.cars.push(car); G.traffic.push(car);
  }
}
function aheadBlocked(G, car) {
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  for (const o of G.cars) {
    if (!isCarObj(o) || o === car) continue;
    const dx = o.x - car.x, dz = o.z - car.z;
    const along = dx * fx + dz * fz;
    if (along > 0 && along < 9 && Math.abs(dx * fz - dz * fx) < 2.6) return o;
  }
  return null;
}
export function updateTraffic(G, dt) {
  for (const car of G.traffic) {
    if (!isCarObj(car)) continue;
    const blocked = aheadBlocked(G, car);
    if (blocked) {
      car.speed = Math.max(0, car.speed - 20 * dt);
      car.blockedT += dt;
      car.honkT += dt;
      if (car.honkT > 4) { car.honkT = 0; sfx(G, 'horn'); }
      if (car.blockedT > 8) {
        // Anti-jam: change lane, or nudge backwards.
        car.lane = -car.lane;
        car.blockedT = 0;
        if (car.axis === 'v') car.x = car.road + car.lane;
        else car.z = car.road + car.lane;
        car.x -= Math.sin(car.heading) * 3;
        car.z -= Math.cos(car.heading) * 3;
      }
    } else {
      car.blockedT = 0;
      car.speed += (car.cruise - car.speed) * Math.min(1, dt);
    }
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    if (car.axis === 'v' && (car.z > 312 || car.z < -312)) car.z = -Math.sign(car.z) * 312;
    if (car.axis === 'h' && (car.x > 312 || car.x < -312)) car.x = -Math.sign(car.x) * 312;
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
  }
}
// ---- pedestrians ----
function newPed(G, x, z, anchor) {
  const g = makePersonMesh(G.rng.pick(SKINS), G.rng.pick(SHIRTS), G.rng.pick(PANTS), G.rng.chance(0.3) ? 0x1e3a5e : 0);
  g.position.set(x, 0, z);
  G.scene.add(g);
  return {
    g, x, z, heading: G.rng.f() * Math.PI * 2, speed: G.rng.range(1, 1.8),
    tx: x, tz: z, anchor, fleeT: 0, walkT: G.rng.f() * 6.28, state: 'walk',
  };
}
function randomSidewalkTarget(G) {
  const r = G.rng.pick(CFG.roads);
  const along = G.rng.range(-300, 300);
  const off = G.rng.pick([-10, 10]);
  return G.rng.chance(0.5) ? [r + off, along] : [along, r + off];
}
export function initPeds(G) {
  G.peds = [];
  G.npcs = [];
  for (const [ax, az, n] of CROWDS) {
    for (let i = 0; i < n; i++) {
      const p = newPed(G, ax + G.rng.range(-8, 8), az + G.rng.range(-8, 8), [ax, az]);
      G.peds.push(p);
    }
  }
  for (let i = 0; i < CFG.pedN; i++) {
    let x, z, tries = 0;
    do {
      [x, z] = randomSidewalkTarget(G);
      tries++;
    } while (x < -250 && tries < 5); // ambient peds avoid boardwalk (crowd zone)
    const p = newPed(G, x, z, null);
    G.peds.push(p);
  }
}
export function spawnNPC(G, name, x, z, skin, shirt, pants, hat) {
  const g = makePersonMesh(skin, shirt, pants, hat);
  g.position.set(x, 0, z);
  G.scene.add(g);
  const npc = { name, g, x, z, heading: 0 };
  G.npcs.push(npc);
  return npc;
}
export function updatePeds(G, dt) {
  const t = G.elapsed;
  // Player car position only when a valid car object exists; else on-foot pos.
  const car = driveCarRef(G);
  const threatX = car ? car.x : G.player.x;
  const threatZ = car ? car.z : G.player.z;
  const threatFast = car ? Math.abs(car.speed) > 8 : false;
  for (const p of G.peds) {
    const dx = p.x - threatX, dz = p.z - threatZ;
    const d = Math.hypot(dx, dz);
    if (threatFast && d < 10) { p.fleeT = 2.5; p.state = 'flee'; }
    if (p.fleeT > 0) {
      p.fleeT -= dt;
      const flee = 4.2;
      p.x += (dx / (d || 1)) * flee * dt;
      p.z += (dz / (d || 1)) * flee * dt;
      p.heading = Math.atan2(dx, dz);
      if (p.fleeT <= 0) p.state = 'walk';
    } else if (p.anchor) {
      // Mill around the anchor.
      p.walkT += dt;
      const tx = p.anchor[0] + Math.cos(p.walkT * 0.5) * 5;
      const tz = p.anchor[1] + Math.sin(p.walkT * 0.4) * 5;
      moveToward(p, tx, tz, p.speed * 0.6, dt);
    } else {
      const dd = Math.hypot(p.tx - p.x, p.tz - p.z);
      if (dd < 1.5) { [p.tx, p.tz] = randomSidewalkTarget(G); }
      moveToward(p, p.tx, p.tz, p.speed, dt);
    }
    if (collideCircle(G, p.x, p.z, 0.5)) { p.x -= Math.sin(p.heading) * p.speed * dt * 2; p.z -= Math.cos(p.heading) * p.speed * dt * 2; }
    p.x = Math.max(-315, Math.min(315, p.x));
    p.z = Math.max(-315, Math.min(315, p.z));
    p.g.position.set(p.x, 0, p.z);
    p.g.rotation.y = p.heading;
    const swing = Math.sin(t * 6 + p.walkT * 10) * 0.45;
    const u = p.g.userData;
    if (u.legL) { u.legL.rotation.x = swing; u.legR.rotation.x = -swing; u.armL.rotation.x = -swing; u.armR.rotation.x = swing; }
  }
}
function moveToward(p, tx, tz, speed, dt) {
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  if (d < 0.05) return;
  p.heading = Math.atan2(dx, dz);
  p.x += (dx / d) * speed * dt;
  p.z += (dz / d) * speed * dt;
}
