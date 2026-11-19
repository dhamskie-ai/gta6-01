// SOLARA BAY — traffic cars + ambient pedestrians.
// Round 6f: pedestrians are detailed people (see player.js) who walk the
// sidewalks on real waypoints, vary in speed, clothes and hats, stop and
// look around, and run away when a car or a gunshot comes close. Traffic
// cars follow the road graph, stop at red lights and honk when blocked.
import { CFG, CAR_DEFS } from './config.js';
import { rr, ri, pick, chance } from './random.js';
import { makeCar, driveToward, carForward } from './vehicles.js';
import { createPersonMesh } from './player.js';
import { collideCircle, lightStateAt, randomRoadPoint } from './city.js';

const TRAFFIC_TYPES = ['cometa', 'pip', 'cabro', 'mula', 'cometa', 'pip', 'veloce'];

function onSidewalkPoint(rng) {
  const r = pick(rng, CFG.roads);
  const v = rr(rng, -280, 280);
  const side = chance(rng, 0.5) ? 6.75 : -6.75;
  return chance(rng, 0.5) ? { x: r + side, z: v } : { x: v, z: r + side };
}

export function initTraffic(G, rng) {
  G.traffic = [];
  G.parked = [];
  G.peds = [];
  // Moving traffic on the road graph.
  for (let i = 0; i < CFG.trafficCount; i++) {
    const p = randomRoadPoint(rng);
    const type = pick(rng, TRAFFIC_TYPES);
    const car = makeCar(type, p.x, p.z, rr(rng, 0, Math.PI * 2), undefined, false);
    car.traffic = true;
    G.W.scene.add(car.group);
    G.traffic.push({ car, kind: 'traffic', route: randomRoadPoint(rng), wait: 0 });
  }
  // Parked cars along the Malecón and downtown, incl. the hero VELOZ.
  const hero = makeCar('veloce', -234, 66, Math.PI / 2, 0xff2e7e, true);
  hero.owned = false;
  G.W.scene.add(hero.group);
  G.parked.push({ car: hero, kind: 'parked' });
  for (let i = 0; i < CFG.parkedCount; i++) {
    const p = randomRoadPoint(rng);
    const type = pick(rng, ['cometa', 'pip', 'cabro', 'mula', 'veloce', 'hauler']);
    const car = makeCar(type, p.x + rr(rng, -2, 2), p.z + rr(rng, -2, 2), rr(rng, 0, Math.PI * 2), undefined, false);
    G.W.scene.add(car.group);
    G.parked.push({ car, kind: 'parked' });
  }
  // Bus + taco truck parked near the beach party strip.
  const bus = makeCar('bus', -232, 120, Math.PI, undefined, false);
  G.W.scene.add(bus.group);
  G.parked.push({ car: bus, kind: 'parked' });
  const taco = makeCar('taco', -232, 140, Math.PI, undefined, false);
  G.W.scene.add(taco.group);
  G.parked.push({ car: taco, kind: 'parked' });
  // Pedestrians on sidewalks.
  for (let i = 0; i < CFG.pedCount; i++) {
    const start = onSidewalkPoint(rng);
    const mesh = createPersonMesh({ hat: chance(rng, 0.25) ? pick(rng, [0xffd23f, 0x2e8fd2, 0xd23c2e]) : undefined });
    mesh.position.set(start.x, 0, start.z);
    G.W.scene.add(mesh);
    const target = onSidewalkPoint(rng);
    G.peds.push({
      mesh, x: start.x, z: start.z, tx: target.x, tz: target.z,
      speed: rr(rng, 1.0, 1.9), flee: 0, walkPhase: rr(rng, 0, 6),
      name: 'Ped', hp: 30, pause: 0, heading: rr(rng, 0, Math.PI * 2),
    });
  }
}

export function nearestParkedCar(G, x, z, maxD) {
  let best = null, bd = maxD;
  for (const p of G.parked) {
    const d = Math.hypot(p.car.x - x, p.car.z - z);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

export function nearestTrafficCar(G, x, z, maxD) {
  let best = null, bd = maxD;
  for (const t of G.traffic) {
    const d = Math.hypot(t.car.x - x, t.car.z - z);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

export function updateTraffic(G, dt, elapsed) {
  // Traffic cars drive toward their route point, obey lights, avoid the player.
  for (const t of G.traffic) {
    const car = t.car;
    if (!t.route) t.route = randomRoadPoint(G.rng);
    if (t.wait > 0) { t.wait -= dt; car.speed *= 0.9; continue; }
    const dx = car.x - G.player.x, dz = car.z - G.player.z;
    const playerNear = dx * dx + dz * dz < 30 * 30;
    const axis = Math.abs(car.x - Math.round(car.x / 120) * 120) < 6 ? 'z' : 'x';
    const nearJunction = CFG.roads.some((r) => Math.abs(car.x - r) < 12) && CFG.roads.some((r) => Math.abs(car.z - r) < 12);
    if (nearJunction && lightStateAt(G.city, car.x, car.z, axis, elapsed) === 'red' && Math.random() < 0.9) {
      car.speed = Math.max(0, car.speed - 20 * dt);
      continue;
    }
    const d = driveToward(car, t.route.x, t.route.z, dt, G.city, car.def.maxSpeed * 0.55);
    if (d < 4) t.route = randomRoadPoint(G.rng);
    if (playerNear && G.inCar && Math.hypot(G.car.x - car.x, G.car.z - car.z) < 6 && Math.random() < dt * 0.4) {
      G.audio.horn();
    }
    // Gentle separation between traffic cars.
    for (const o of G.traffic) {
      if (o === t) continue;
      const ox = car.x - o.car.x, oz = car.z - o.car.z;
      const dd = ox * ox + oz * oz;
      if (dd < 16 && dd > 0.01) {
        car.x += (ox / Math.sqrt(dd)) * dt * 2;
        car.z += (oz / Math.sqrt(dd)) * dt * 2;
      }
    }
  }
  // Pedestrians: walk sidewalk waypoints, pause, flee from danger.
  for (const p of G.peds) {
    const danger = G._panic > 0
      || (G.inCar && G.car && Math.hypot(G.car.x - p.x, G.car.z - p.z) < 5 && Math.abs(G.car.speed) > 8);
    if (danger) p.flee = Math.max(p.flee, 2.5);
    if (p.flee > 0) {
      p.flee -= dt;
      const dx = p.x - G.player.x, dz = p.z - G.player.z;
      const l = Math.hypot(dx, dz) || 1;
      p.x += (dx / l) * 4.5 * dt;
      p.z += (dz / l) * 4.5 * dt;
      p.heading = Math.atan2(dx / l, dz / l);
    } else if (p.pause > 0) {
      p.pause -= dt;
    } else {
      const dx = p.tx - p.x, dz = p.tz - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.5) {
        const np = onSidewalkPoint(G.rng);
        p.tx = np.x; p.tz = np.z;
        if (Math.random() < 0.25) p.pause = rr(G.rng, 1, 4);
      } else {
        const spd = p.speed * dt;
        p.x += (dx / dist) * spd;
        p.z += (dz / dist) * spd;
        p.heading = Math.atan2(dx / dist, dz / dist);
        p.walkPhase += dt * p.speed * 3.2;
      }
    }
    const parts = p.mesh.userData.parts;
    const moving = p.flee > 0 || p.pause <= 0;
    const swing = moving ? Math.sin(p.walkPhase) * (p.flee > 0 ? 0.8 : 0.5) : 0;
    parts.legL.rotation.x = swing;
    parts.legR.rotation.x = -swing;
    parts.armL.rotation.x = -swing * 0.8;
    parts.armR.rotation.x = swing * 0.8;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
  }
}
