// Traffic AI + pedestrians + side activities (taxi, fishing spots are in
// missions; stunt jumps, sun-coin pickup and the wandering street bonus
// live here). ~150 pedestrians: 72 walkers + crowd groups.
import * as THREE from 'three';
import { CFG, TRAFFIC_MIX, TRAFFIC_PAINTS } from './config.js';
import { rr, ri, pick, clamp, dist2 } from './random.js';
import { createCar, isCarObj } from './vehicles.js';
import { collide } from './city.js';
import { sfxHorn, sfxCoin } from './audio.js';

const PED_SHIRTS = [0xc23a3a, 0x2a7a4a, 0x2a5a9a, 0xe8a23a, 0x7a4a9e, 0xdddddd, 0x222831, 0xe07a9e, 0x3a9a8a, 0xd86a2e];
const PED_SKINS = [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf2c89a];
function pedMesh(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, PED_SHIRTS) });
  const skin = new THREE.MeshLambertMaterial({ color: pick(rng, PED_SKINS) });
  const pants = new THREE.MeshLambertMaterial({ color: pick(rng, [0x2a3a5a, 0x333333, 0x5a4a3a]) });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirt);
  body.position.y = 1.05; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.65; g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.38),
    new THREE.MeshLambertMaterial({ color: pick(rng, [0x1a1a1a, 0x5a3a1a, 0x8a8a8a, 0xc2a23a]) }));
  hair.position.y = 1.86; g.add(hair);
  if (rng() < 0.3) { // hat
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.1, 8),
      new THREE.MeshLambertMaterial({ color: pick(rng, [0xc23a3a, 0x2a5a9a, 0xe8a23a]) }));
    hat.position.y = 1.9; g.add(hat);
  }
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), pants);
  legs.position.y = 0.35; g.add(legs);
  const shoes = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x222222 }));
  shoes.position.y = 0.06; g.add(shoes);
  // jacket stripe + belt for the player-lookalike variety
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.08, 0.34),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  belt.position.y = 0.68; g.add(belt);
  g.userData = { body, head, legs };
  return g;
}
function nearestRoadLine(v) {
  let best = CFG.grid[0], bd = 1e9;
  for (const g of CFG.grid) { const d = Math.abs(v - g); if (d < bd) { bd = d; best = g; } }
  return best;
}
export function spawnWorld(G) {
  const rng = G.rng;
  G.traffic = []; G.peds = []; G.parked = [];
  // --- traffic: 36 cars on the road graph ---
  for (let i = 0; i < CFG.trafficN; i++) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    const line = pick(rng, CFG.grid);
    const along = rr(rng, -290, 290);
    const type = TRAFFIC_MIX[i % TRAFFIC_MIX.length];
    const paint = TRAFFIC_PAINTS[i % TRAFFIC_PAINTS.length];
    const x = axis === 'x' ? along : line;
    const z = axis === 'x' ? line : along;
    const dir = rng() < 0.5 ? 1 : -1;
    const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = createCar(G, type, x, z, heading, 'traffic', paint);
    car.speed = rr(rng, 8, 14);
    G.traffic.push({ car, axis, line, dir, cruise: car.speed, wait: 0 });
  }
  // --- parked: 24 cars along road edges ---
  for (let i = 0; i < CFG.parkedN; i++) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    const line = pick(rng, CFG.grid);
    const along = rr(rng, -280, 280);
    const side = rng() < 0.5 ? -8.5 : 8.5;
    const type = TRAFFIC_MIX[ri(rng, 0, TRAFFIC_MIX.length - 1)];
    const paint = TRAFFIC_PAINTS[ri(rng, 0, TRAFFIC_PAINTS.length - 1)];
    const x = axis === 'x' ? along : line + side;
    const z = axis === 'x' ? line + side : along;
    const heading = axis === 'x' ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    const car = createCar(G, type, x, z, heading, 'parked', paint);
    car.speed = 0;
    G.parked.push(car);
  }
  // --- Solara Bus + taco truck (stealable) ---
  const bus = createCar(G, 'bus', 120, -100, 0, 'parked');
  bus.speed = 0; G.parked.push(bus); G.bus = bus;
  const taco = createCar(G, 'taco', -120, 100, Math.PI, 'parked');
  taco.speed = 0; G.parked.push(taco); G.tacoTruck = taco;
  // --- the VELOZ Comet RS (mission car, hot pink sport) ---
  const veloz = createCar(G, 'sport', CFG.velozPos.x, CFG.velozPos.z, Math.PI, 'parked', 0xff2e7e);
  veloz.speed = 0; G.veloz = veloz; G.parked.push(veloz);
  // --- pedestrians: 72 walkers + crowd groups to ~150 ---
  for (let i = 0; i < CFG.pedN; i++) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    const line = pick(rng, CFG.grid);
    const along = rr(rng, -290, 290);
    const off = rng() < 0.5 ? -9 : 9;
    const mesh = pedMesh(rng);
    const x = axis === 'x' ? along : line + off;
    const z = axis === 'x' ? line + off : along;
    mesh.position.set(x, 0, z);
    G.fx.scene.add(mesh);
    G.peds.push({ mesh, x, z, heading: rng() * Math.PI * 2, speed: rr(rng, 0.8, 1.6),
      state: 'walk', pauseT: 0, jog: rng() < 0.12, flee: false, axis, line, off });
  }
  // crowd groups: market, beach, plaza, bus stop
  const crowds = [[-60, 120, 18], [-258, 180, 14], [0, 0, 16], [120, -120, 12], [-120, -60, 12], [60, 180, 14], [-240, 40, 12]];
  for (const [cx, cz, n] of crowds) {
    for (let i = 0; i < n; i++) {
      const mesh = pedMesh(rng);
      const x = cx + rr(rng, -10, 10), z = cz + rr(rng, -10, 10);
      mesh.position.set(x, 0, z);
      G.fx.scene.add(mesh);
      G.peds.push({ mesh, x, z, heading: rng() * Math.PI * 2, speed: rr(rng, 0.6, 1.4),
        state: rng() < 0.4 ? 'idle' : 'walk', pauseT: rr(rng, 0, 4), jog: false, flee: false,
        axis: 'x', line: nearestRoadLine(z), off: 9, cx, cz });
    }
  }
  // --- stunt jump ramps ---
  G.ramps = [];
  for (const [rx, rz, rh] of [[-120, 240, 0], [120, -240, Math.PI / 2], [240, 120, Math.PI]]) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 4),
      new THREE.MeshLambertMaterial({ color: 0xe8a23a }));
    ramp.position.set(rx, 0.6, rz); ramp.rotation.y = rh;
    ramp.rotation.x = 0.25;
    G.fx.scene.add(ramp);
    G.ramps.push({ x: rx, z: rz, used: false });
  }
  // --- wandering street bonus ---
  G.bonus = { x: 0, z: 0, mesh: null, timer: 0 };
  const bMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 12),
    new THREE.MeshLambertMaterial({ color: 0x2aff7a, emissive: 0x1a8a3a, emissiveIntensity: 0.7 }));
  G.fx.scene.add(bMesh); G.bonus.mesh = bMesh;
  placeBonus(G);
  // --- taxi job state ---
  G.taxi = { state: 'idle', passenger: null, dest: null, fare: 40, waitT: 0 };
  spawnTaxiPassenger(G);
}
function placeBonus(G) {
  const rng = G.rng;
  const g = pick(rng, CFG.grid);
  G.bonus.x = rng() < 0.5 ? g : rr(rng, -280, 280);
  G.bonus.z = rng() < 0.5 ? rr(rng, -280, 280) : g;
  G.bonus.mesh.position.set(G.bonus.x, 0.8, G.bonus.z);
  G.bonus.timer = 40;
}
function spawnTaxiPassenger(G) {
  const rng = G.rng;
  const mesh = pedMesh(rng);
  const g = pick(rng, CFG.grid);
  const x = rng() < 0.5 ? rr(rng, -280, 280) : g + 9;
  const z = rng() < 0.5 ? g + 9 : rr(rng, -280, 280);
  mesh.position.set(x, 0, z);
  G.fx.scene.add(mesh);
  const destG = pick(rng, CFG.grid);
  G.taxi.passenger = { mesh, x, z, dest: { x: rr(rng, -280, 280), z: destG } };
  G.taxi.state = 'waiting';
}
export function updateTraffic(G, dt) {
  const rng = G.rng;
  // traffic cars: follow their road line, turn at intersections sometimes
  for (const t of G.traffic) {
    const car = t.car;
    if (!isCarObj(car)) continue;
    // car ahead on the same line? slow down
    let slow = false;
    for (const o of G.traffic) {
      if (o === t || !isCarObj(o.car)) continue;
      if (o.axis !== t.axis || o.line !== t.line) continue;
      const along = t.axis === 'x' ? car.x : car.z;
      const oAlong = t.axis === 'x' ? o.car.x : o.car.z;
      const gap = (oAlong - along) * t.dir;
      if (gap > 0 && gap < 10) { slow = true; break; }
    }
    const p = G.player;
    if (isCarObj(p.car)) {
      const dx = car.x - p.car.x, dz = car.z - p.car.z;
      if (dx * dx + dz * dz < 64) slow = true;
    }
    const target = slow ? 0 : t.cruise;
    car.speed += clamp(target - car.speed, -20 * dt, 12 * dt);
    const step = car.speed * t.dir * dt;
    if (t.axis === 'x') car.x += step; else car.z += step;
    const along = t.axis === 'x' ? car.x : car.z;
    // turn at an intersection or at the edge
    if (Math.abs(along) > 300 || (Math.abs(along % 120) < 1.5 && rng() < 0.02)) {
      if (Math.abs(along) > 300) { t.dir *= -1; }
      else if (rng() < 0.4) {
        const newLine = pick(rng, CFG.grid);
        if (t.axis === 'x') { t.axis = 'z'; t.line = newLine; t.dir = rng() < 0.5 ? 1 : -1; car.z = newLine; }
        else { t.axis = 'x'; t.line = newLine; t.dir = rng() < 0.5 ? 1 : -1; car.x = newLine; }
      }
    }
    car.heading = t.axis === 'x' ? (t.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (t.dir > 0 ? 0 : Math.PI);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }
  // pedestrians
  const px = G.player.x, pz = G.player.z;
  const pCar = G.player.car;
  for (const ped of G.peds) {
    if (ped.state === 'idle') {
      ped.pauseT -= dt;
      if (ped.pauseT <= 0) { ped.state = 'walk'; ped.pauseT = 0; }
    } else {
      // flee: player car fast & close, or gunfire nearby
      const dCar = pCar && isCarObj(pCar) ? dist2(ped.x, ped.z, pCar.x, pCar.z) : 1e9;
      const dFoot = dist2(ped.x, ped.z, px, pz);
      ped.flee = (dCar < 100 && Math.abs(pCar.speed) > 8) || (G.gunfireT > 0 && dFoot < 400);
      let sp = ped.jog ? 3.2 : ped.speed;
      let hx = Math.sin(ped.heading), hz = Math.cos(ped.heading);
      if (ped.flee) {
        sp = 5;
        const dx = ped.x - px, dz = ped.z - pz;
        const d = Math.sqrt(dx * dx + dz * dz) || 1;
        hx = dx / d; hz = dz / d;
        ped.heading = Math.atan2(hx, hz);
      } else if (ped.cx !== undefined) {
        // crowd: wander near home
        if (dist2(ped.x, ped.z, ped.cx, ped.cz) > 144) {
          ped.heading = Math.atan2(ped.cx - ped.x, ped.cz - ped.z);
        } else if (rng() < 0.01) ped.heading = rng() * Math.PI * 2;
        hx = Math.sin(ped.heading); hz = Math.cos(ped.heading);
      } else {
        // walk along the sidewalk; occasionally turn at intersections
        if (rng() < 0.004) ped.heading += (rng() < 0.5 ? 1 : -1) * Math.PI / 2;
        hx = Math.sin(ped.heading); hz = Math.cos(ped.heading);
      }
      const nx = ped.x + hx * sp * dt, nz = ped.z + hz * sp * dt;
      const hit = collide(G, nx, nz, 0.5);
      ped.x = hit.x; ped.z = hit.z;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      // walk bob
      ped.mesh.position.y = Math.abs(Math.sin(G.t * 8 + ped.x)) * 0.06;
      if (rng() < 0.002) { ped.state = 'idle'; ped.pauseT = rr(rng, 2, 5); }
    }
  }
  // taxi passenger pickup / delivery
  const taxi = G.taxi;
  if (taxi.state === 'waiting' && taxi.passenger) {
    const pp = taxi.passenger;
    const d = dist2(px, pz, pp.x, pp.z);
    if (d < 9 && isCarObj(pCar)) {
      taxi.state = 'deliver';
      G.fx.scene.remove(pp.mesh);
      G.hudMsg = 'Passenger aboard — drive to the marker';
    }
  } else if (taxi.state === 'deliver') {
    const d = dist2(px, pz, taxi.passenger.dest.x, taxi.passenger.dest.z);
    if (d < 49 && isCarObj(pCar)) {
      G.cash += taxi.fare;
      G.stats.taxi = (G.stats.taxi || 0) + 1;
      G.hudMsg = `Taxi fare +$${taxi.fare}`;
      taxi.state = 'idle';
      spawnTaxiPassenger(G);
    }
  }
  // street bonus pickup
  if (G.bonus && dist2(px, pz, G.bonus.x, G.bonus.z) < 4) {
    G.cash += 25; G.hudMsg = 'Street bonus +$25';
    if (G.audio) sfxCoin(G.audio);
    placeBonus(G);
  } else if (G.bonus) {
    G.bonus.timer -= dt;
    if (G.bonus.timer <= 0) placeBonus(G);
    G.bonus.mesh.rotation.y += dt * 2;
  }
  // stunt jumps: fast over a ramp
  if (isCarObj(pCar)) {
    for (const r of G.ramps) {
      if (!r.used && dist2(pCar.x, pCar.z, r.x, r.z) < 9 && Math.abs(pCar.speed) > 25) {
        r.used = true;
        G.cash += 50; G.hudMsg = 'Stunt jump +$50';
        if (G.audio) sfxCoin(G.audio);
      }
    }
  }
  // honk if the player blocks traffic
  if (G.audio && rng() < 0.002 && isCarObj(pCar)) {
    for (const t of G.traffic) {
      if (dist2(t.car.x, t.car.z, pCar.x, pCar.z) < 100) { sfxHorn(G.audio); break; }
    }
  }
}
