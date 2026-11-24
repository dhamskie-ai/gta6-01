// Traffic AI (road-following cars + bus) and pedestrian AI (~150 people).
import * as THREE from 'three';
import { G, CFG, clamp, dist2 } from './config.js';
import { makeCar, isCarObj, syncCarMesh, CAR_TYPES } from './vehicles.js';
import { collides, lightStateAt } from './city.js';
import { RNG } from './random.js';

const MIX = ['sedan', 'sedan', 'hatch', 'taxi', 'van', 'sedan', 'hatch', 'sport', 'taxi', 'van', 'sedan', 'truck'];
function nearRoad(v) {
  return CFG.roads.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), CFG.roads[0]);
}
function randRoadPoint(rng) {
  const road = rng.pick(CFG.roads);
  if (rng.chance(0.5)) return { x: rng.range(-300, 300), z: road, horiz: true };
  return { x: road, z: rng.range(-300, 300), horiz: false };
}
export function initTraffic(rng) {
  for (let i = 0; i < CFG.trafficN; i++) {
    const p = randRoadPoint(rng);
    const type = MIX[i % MIX.length];
    const car = makeCar(type, p.x, p.z, p.horiz ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI));
    car.driver = 'traffic'; car.speed = rng.range(6, 12);
    car.horiz = p.horiz; car.target = null;
    G.traffic.push(car);
  }
  // City bus looping the east ring road.
  const bus = makeCar('bus', CFG.ringE, -200, 0, 0x2a9a6a);
  bus.driver = 'traffic'; bus.speed = 9; bus.horiz = false; bus.busRoute = true;
  G.traffic.push(bus);
  // Taco truck parked by the beach.
  const taco = makeCar('van', -252, 160, Math.PI / 2, 0xffd23e);
  taco.driver = 'parked'; taco.name = 'Taco Truck';
  G.cars.push(taco);
  initPeds(rng);
}
function pedGeometry() {
  // One merged low-poly person: body + head + legs, vertex-coloured.
  const parts = [];
  const box = (w, h, d, x, y, z, color) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Matrix4().setPosition(x, y, z);
    parts.push({ geo: g, matrix: m, color });
  };
  const skin = 0xd8a070, shirt = 0x3a6ad8, pants = 0x2a2a33;
  box(0.55, 0.75, 0.32, 0, 1.05, 0, shirt);
  box(0.34, 0.34, 0.32, 0, 1.62, 0, skin);
  box(0.2, 0.62, 0.22, -0.14, 0.31, 0, pants);
  box(0.2, 0.62, 0.22, 0.14, 0.31, 0, pants);
  const pos = [], nor = [], col = [], uv = [];
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  for (const { geo, matrix, color } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position, nn = g.attributes.normal, u = g.attributes.uv;
    const c = new THREE.Color(color);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix); pos.push(v.x, v.y, v.z);
      n.fromBufferAttribute(nn, i).transformDirection(matrix); nor.push(n.x, n.y, n.z);
      col.push(c.r, c.g, c.b); uv.push(u.getX(i), u.getY(i));
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}
export function initPeds(rng) {
  const total = CFG.pedN + CFG.crowdN;
  const geo = pedGeometry();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.InstancedMesh(geo, mat, total);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = true;
  G.scene.add(mesh);
  G.pedMesh = mesh;
  const shirtCols = [0x3a6ad8, 0xc03028, 0x3f8a4a, 0xffd23e, 0x7a4a8a, 0xf2f2f2, 0xff8f3d, 0x2a9a9a];
  const crowdSpots = [[0, 0], [-180, 120], [-252, 190]];
  for (let i = 0; i < total; i++) {
    let x, z;
    if (i < CFG.pedN) {
      const p = randRoadPoint(rng);
      x = p.x + rng.range(-8, 8); z = p.z + rng.range(-8, 8);
    } else {
      const c = crowdSpots[(i - CFG.pedN) % crowdSpots.length];
      x = c[0] + rng.range(-24, 24); z = c[1] + rng.range(-24, 24);
    }
    if (collides(x, z, 1)) { x = nearRoad(x); z = nearRoad(z); }
    const ped = { x, z, heading: rng.range(0, Math.PI * 2), speed: rng.range(0.8, 1.8),
      state: 'walk', tx: x, tz: z, color: shirtCols[i % shirtCols.length], fleeT: 0 };
    G.peds.push(ped);
    mesh.setColorAt(i, new THREE.Color(ped.color));
  }
  mesh.instanceColor.needsUpdate = true;
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
export function updatePeds(dt) {
  const p = G.player;
  const car = p && isCarObj(p.car) ? p.car : null; // null-car guard
  const px = p ? p.x : 0, pz = p ? p.z : 0;
  G.peds.forEach((ped, i) => {
    // Flee from gunfire, or from a car bearing down on them.
    let flee = ped.fleeT > 0;
    if (car && dist2(ped.x, ped.z, car.x, car.z) < 6 && Math.abs(car.speed) > 3) flee = true;
    if (G.gunshotT > 0 && dist2(ped.x, ped.z, px, pz) < 25) flee = true;
    if (flee) {
      ped.fleeT = 1.2;
      const a = Math.atan2(ped.x - px, ped.z - pz);
      ped.heading = a; ped.speed = 5.5;
    } else {
      ped.fleeT = Math.max(0, ped.fleeT - dt);
      ped.speed = 1.4;
      if (dist2(ped.x, ped.z, ped.tx, ped.tz) < 2) {
        const nr = nearRoad(ped.x);
        ped.tx = clamp(ped.x + (Math.random() - 0.5) * 60, -300, 300);
        ped.tz = clamp(ped.z + (Math.random() - 0.5) * 60, -300, 300);
      }
      ped.heading = Math.atan2(ped.tx - ped.x, ped.tz - ped.z);
    }
    const nx = ped.x + Math.sin(ped.heading) * ped.speed * dt;
    const nz = ped.z + Math.cos(ped.heading) * ped.speed * dt;
    if (!collides(nx, nz, 0.5)) { ped.x = nx; ped.z = nz; }
    else ped.heading += 1.2;
    _q.setFromEuler(_e.set(0, ped.heading, 0));
    _m4.compose(_v.set(ped.x, Math.abs(Math.sin(G.elapsed * 6 + i)) * 0.04, ped.z), _q, _s);
    G.pedMesh.setMatrixAt(i, _m4);
  });
  G.pedMesh.instanceMatrix.needsUpdate = true;
}
export function updateTraffic(dt, audio) {
  const p = G.player;
  for (const car of G.traffic) {
    if (!isCarObj(car)) continue;
    const fwdX = Math.sin(car.heading), fwdZ = Math.cos(car.heading);
    // Pick a target point further along the current road.
    if (!car.target || dist2(car.x, car.z, car.target.x, car.target.z) < 6) {
      if (car.busRoute) {
        car.target = { x: CFG.ringE, z: car.z > 0 ? -300 : 300 };
        car.heading = car.z > 0 ? Math.PI : 0;
      } else if (car.horiz) {
        const dir = fwdX >= 0 ? 1 : -1;
        let nx = car.x + dir * 120;
        if (nx > 300 || nx < -300) { car.horiz = false; nx = car.x; }
        car.target = { x: nx, z: nearRoad(car.z) + (dir > 0 ? 2.5 : -2.5) };
      } else {
        const dir = fwdZ >= 0 ? 1 : -1;
        let nz = car.z + dir * 120;
        if (nz > 300 || nz < -300) { car.horiz = true; nz = car.z; }
        car.target = { x: nearRoad(car.x) + (dir > 0 ? -2.5 : 2.5), z: nz };
      }
    }
    const want = Math.atan2(car.target.x - car.x, car.target.z - car.z);
    let dh = want - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += clamp(dh, -1.4 * dt, 1.4 * dt);
    // Stop at red lights near an intersection.
    let desired = car.busRoute ? 9 : 10;
    const ix = nearRoad(car.x), iz = nearRoad(car.z);
    if (Math.abs(car.x - ix) < 16 && Math.abs(car.z - iz) < 16 && lightStateAt(ix, iz) === 'red') desired = 0;
    // Slow for the car ahead.
    for (const o of G.traffic) {
      if (o === car || !isCarObj(o)) continue;
      const d = dist2(car.x, car.z, o.x, o.z);
      if (d < 9) {
        const ahead = (o.x - car.x) * fwdX + (o.z - car.z) * fwdZ;
        if (ahead > 0) desired = Math.min(desired, 3);
      }
    }
    if (p && isCarObj(p.car) && dist2(car.x, car.z, p.car.x, p.car.z) < 8) {
      const ahead = (p.car.x - car.x) * fwdX + (p.car.z - car.z) * fwdZ;
      if (ahead > 0) { desired = 0; if (audio && Math.random() < 0.002) audio.horn(); }
    }
    car.speed += clamp(desired - car.speed, -14 * dt, 8 * dt);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    if (!collides(nx, nz, 1.2)) { car.x = nx; car.z = nz; }
    else { car.heading += 0.6 * dt * 10; car.speed *= 0.5; }
    syncCarMesh(car);
  }
  // Despawn far traffic, respawn near the player so streets stay busy.
  if (p) {
    for (const car of G.traffic) {
      if (car.busRoute) continue;
      if (dist2(car.x, car.z, p.x, p.z) > 220) {
        const pt = randRoadPoint(new RNG((Math.random() * 1e9) | 0));
        car.x = clamp(p.x + (pt.x - p.x) * 0.3, -300, 300);
        car.z = clamp(p.z + (pt.z - p.z) * 0.3, -300, 300);
        car.target = null;
      }
    }
  }
}
