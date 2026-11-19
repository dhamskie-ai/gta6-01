// Traffic AI on the road grid + pedestrians on sidewalks, crowds at the
// Malecón, market and restaurants. Peds flee fast cars; traffic honks.
import * as THREE from 'three';
import { G, CFG } from './config.js';
import { R } from './random.js';
import { makeCar, isCarObj } from './vehicles.js';
import { collideCircle } from './city.js';
import { sfx } from './audio.js';

const PED_COLORS = [0xd23a2e, 0x2e6fd8, 0x1e9e6a, 0xf5c518, 0xe8e4d8, 0xff8fd0, 0x37e0ff, 0x8a5a9a];
const SKINS = [0xc98a5e, 0x8a5a3a, 0xe8b88a, 0x6a4426, 0xd8a070];

export function spawnPed(x, z, opts = {}) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: opts.color ?? R.pick(PED_COLORS) });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.32), shirt);
  body.position.y = 0.95; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshLambertMaterial({ color: opts.skin ?? R.pick(SKINS) }));
  head.position.y = 1.62; g.add(head);
  if (opts.hat) {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.14, 8),
      new THREE.MeshLambertMaterial({ color: opts.hat }));
    hat.position.y = 1.82; g.add(hat);
  }
  const legM = new THREE.MeshLambertMaterial({ color: 0x2c3242 });
  const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.2), legM);
  l1.position.set(0, 0.28, 0.12); g.add(l1);
  const l2 = l1.clone(); l2.position.z = -0.12; g.add(l2);
  g.position.set(x, 0, z);
  G.scene.add(g);
  const p = {
    group: g, x, z, heading: R.range(0, 6.28), speed: R.range(0.8, 1.6),
    leg1: l1, leg2: l2, walk: R.range(0, 6), flee: 0, idle: R.range(0, 4),
    crowd: !!opts.crowd, cx: x, cz: z, name: opts.name || '',
  };
  G.peds.push(p);
  return p;
}

export function crowdAt(x, z, n, color) {
  for (let i = 0; i < n; i++) {
    spawnPed(x + R.range(-7, 7), z + R.range(-7, 7), { crowd: true, color });
  }
}

export function initTraffic() {
  const types = ['sedan', 'taxi', 'van', 'sedan', 'taxi', 'truck', 'sedan', 'van'];
  for (let i = 0; i < CFG.trafficN; i++) {
    const horiz = i % 2 === 0;
    const road = R.pick(CFG.roads);
    const lane = R.pick([-3.4, 3.4]);
    const along = R.range(-300, 300);
    const car = makeCar(types[i % types.length], horiz ? along : road + lane, horiz ? road + lane : along, horiz ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane > 0 ? 0 : Math.PI));
    car.speed = R.range(8, 14);
    car.horiz = horiz; car.road = road; car.lane = lane; car.honkT = 0;
    G.traffic.push(car);
  }
  for (let i = 0; i < CFG.pedN; i++) {
    const x = R.range(-300, 300), z = R.range(-300, 300);
    if (x < -250) continue;
    spawnPed(x, z);
  }
  crowdAt(-258, 40, 7, 0xff8fd0);   // malecón strollers
  crowdAt(-258, -60, 5, 0x37e0ff);
  crowdAt(-128, -122, 7, 0xf5c518); // Old Solara market
  crowdAt(-232, 66, 5, 0x1e9e6a);   // outside Marlin Ceviche
  crowdAt(-272, 150, 8, 0xff5a5a);  // beach party
  crowdAt(108, 108, 5, 0x8a5a9a);   // plaza
  for (const v of G.vendors) spawnPed(v.x, v.z, { crowd: true, color: 0xe8e4d8 });
}

export function updateTraffic(dt) {
  const px = G.player.pos.x, pz = G.player.pos.z;
  for (const c of G.traffic) {
    if (!isCarObj(c)) continue;
    const dir = c.horiz ? Math.sign(Math.sin(c.heading)) : Math.sign(Math.cos(c.heading));
    let target = 12;
    // slow down if a car (or the player) blocks the lane ahead
    const ax = c.x + Math.sin(c.heading) * 9, az = c.z + Math.cos(c.heading) * 9;
    const block = G.cars.find((o) => isCarObj(o) && (o.x - ax) ** 2 + (o.z - az) ** 2 < 20)
      || (Math.abs(px - ax) < 4 && Math.abs(pz - az) < 4 && G.player.onFoot);
    if (block) {
      target = 0; c.honkT -= dt;
      if (c.honkT <= 0) { sfx.horn(); c.honkT = 4; }
    }
    c.speed += (target - c.speed) * Math.min(1, dt * 0.8);
    c.x += Math.sin(c.heading) * c.speed * dt;
    c.z += Math.cos(c.heading) * c.speed * dt;
    if (c.horiz && (c.x > 312 || c.x < -312)) { c.x = -dir * 312; }
    if (!c.horiz && (c.z > 312 || c.z < -312)) { c.z = -dir * 312; }
    c.group.position.set(c.x, 0, c.z);
    c.group.rotation.y = c.heading;
    for (const w of c.wheels) w.rotation.z += c.speed * dt * 2.2;
  }
}

export function updatePeds(dt) {
  const pc = G.player.car;
  const pcx = pc && isCarObj(pc) ? pc.x : G.player.pos.x;
  const pcz = pc && isCarObj(pc) ? pc.z : G.player.pos.z;
  const pSpeed = pc && isCarObj(pc) ? Math.abs(pc.speed) : G.player.speed;
  for (const p of G.peds) {
    if (!p || !p.group) continue;
    const dx = p.x - pcx, dz = p.z - pcz, d2 = dx * dx + dz * dz;
    if (pSpeed > 9 && d2 < 100) p.flee = 2.5;
    if (p.flee > 0) {
      p.flee -= dt;
      const d = Math.sqrt(d2) || 1;
      p.heading = Math.atan2(dx / d, dz / d);
      p.speed = 4.2;
    } else if (p.crowd) {
      // mill around the crowd anchor: drift, pause, drift
      p.idle -= dt;
      if (p.idle <= 0) {
        p.heading = R.range(0, Math.PI * 2);
        p.idle = R.range(1.5, 5);
        p.speed = R.chance(0.5) ? R.range(0.5, 1.1) : 0;
      }
      const ddx = p.x - p.cx, ddz = p.z - p.cz;
      if (ddx * ddx + ddz * ddz > 64) p.heading = Math.atan2(-ddx, -ddz);
    } else {
      p.idle -= dt;
      if (p.idle <= 0) {
        p.heading = R.range(0, Math.PI * 2);
        p.idle = R.range(3, 9);
        p.speed = R.chance(0.7) ? R.range(0.8, 1.6) : 0;
      }
    }
    const nx = p.x + Math.sin(p.heading) * p.speed * dt;
    const nz = p.z + Math.cos(p.heading) * p.speed * dt;
    if (!collideCircle(nx, nz, 0.5) && Math.abs(nx) < 312 && Math.abs(nz) < 312) { p.x = nx; p.z = nz; }
    p.walk += dt * p.speed * 4;
    p.leg1.rotation.x = Math.sin(p.walk) * 0.5 * Math.min(1, p.speed);
    p.leg2.rotation.x = -Math.sin(p.walk) * 0.5 * Math.min(1, p.speed);
    p.group.position.set(p.x, 0, p.z);
    p.group.rotation.y = p.heading;
  }
}
