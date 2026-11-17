// Traffic AI (cars follow the road grid) + pedestrian AI (sidewalks, flee).
// Pedestrians share 6 InstancedMeshes (body/head/legs/arms) — 6 draw calls
// for the whole crowd, with per-instance colours.
import * as THREE from 'three';
import { CONFIG, PED_NAMES } from './config.js';
import { randomRoadPos } from './city.js';
import { spawnCar } from './vehicles.js';

const TRAFFIC_TYPES = ['sedan', 'hatch', 'taxi', 'van', 'sedan', 'hatch', 'sport'];
const SKIN = [0xe8b98a, 0xc98d64, 0x8a5a3a, 0xd8a0a0, 0x6a4a2a];
const SHIRT = [0xd94f3d, 0x3f6fb5, 0x3fae5a, 0xf2c200, 0x8a5fc2, 0xe8e8e8, 0x2c2f36];
const PED_CAP = 64;
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color();

let pedMeshes = null;
const freeSlots = [];

export function initPedInstances(G) {
  const geo = {
    body: new THREE.BoxGeometry(0.5, 0.75, 0.3),
    head: new THREE.BoxGeometry(0.34, 0.34, 0.34),
    leg: new THREE.BoxGeometry(0.18, 0.6, 0.2),
    arm: new THREE.BoxGeometry(0.13, 0.55, 0.15),
  };
  const mat = () => new THREE.MeshLambertMaterial({ color: 0xffffff });
  pedMeshes = {
    body: new THREE.InstancedMesh(geo.body, mat(), PED_CAP),
    head: new THREE.InstancedMesh(geo.head, mat(), PED_CAP),
    legL: new THREE.InstancedMesh(geo.leg, mat(), PED_CAP),
    legR: new THREE.InstancedMesh(geo.leg, mat(), PED_CAP),
    armL: new THREE.InstancedMesh(geo.arm, mat(), PED_CAP),
    armR: new THREE.InstancedMesh(geo.arm, mat(), PED_CAP),
  };
  for (const k of Object.keys(pedMeshes)) {
    pedMeshes[k].instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    pedMeshes[k].frustumCulled = false;
    pedMeshes[k].castShadow = true;
    G.scene.add(pedMeshes[k]);
    for (let i = 0; i < PED_CAP; i++) { _m4.makeScale(0, 0, 0); pedMeshes[k].setMatrixAt(i, _m4); }
  }
  for (let i = PED_CAP - 1; i >= 0; i--) freeSlots.push(i);
  G.pedMeshes = pedMeshes;
}

export function spawnPed(G, x, z) {
  if (!pedMeshes || freeSlots.length === 0) return null;
  const slot = freeSlots.pop();
  const rng = G.rng;
  const skin = rng.pick(SKIN), shirt = rng.pick(SHIRT);
  const pants = rng.pick([0x2c3e50, 0x5a4a3a, 0x3a3a3a]);
  pedMeshes.body.setColorAt(slot, _c.setHex(shirt));
  pedMeshes.head.setColorAt(slot, _c.setHex(skin));
  pedMeshes.legL.setColorAt(slot, _c.setHex(pants));
  pedMeshes.legR.setColorAt(slot, _c.setHex(pants));
  pedMeshes.armL.setColorAt(slot, _c.setHex(shirt));
  pedMeshes.armR.setColorAt(slot, _c.setHex(shirt));
  for (const k of Object.keys(pedMeshes)) if (pedMeshes[k].instanceColor) pedMeshes[k].instanceColor.needsUpdate = true;
  const ped = {
    slot, x, z, yaw: rng.range(0, Math.PI * 2),
    speed: rng.range(1.0, 1.8), state: 'walk', fleeT: 0, walkPhase: rng.range(0, 6),
    name: rng.pick(PED_NAMES), taxi: false,
  };
  G.peds.push(ped);
  return ped;
}

export function removePed(G, ped) {
  if (!ped || ped.slot === undefined) return;
  for (const k of Object.keys(pedMeshes)) { _m4.makeScale(0, 0, 0); pedMeshes[k].setMatrixAt(ped.slot, _m4); }
  freeSlots.push(ped.slot);
  const i = G.peds.indexOf(ped);
  if (i >= 0) G.peds.splice(i, 1);
}

export function spawnTrafficWorld(G) {
  const rng = G.rng;
  G.trafficCars = [];
  for (let i = 0; i < CONFIG.trafficCount; i++) {
    const p = randomRoadPos(rng);
    const type = rng.pick(TRAFFIC_TYPES);
    const yaw = p.axis === 'x' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
    const car = spawnCar(G, type, p.x, p.z, yaw, 'traffic');
    car.speed = rng.range(6, 11);
    car.cruise = car.speed;
    car.axis = p.axis; car.dir = p.dir;
    G.trafficCars.push(car);
  }
  for (let i = 0; i < CONFIG.parkedCount; i++) {
    const p = randomRoadPos(rng);
    const type = rng.pick(['sedan', 'hatch', 'van', 'taxi']);
    const yaw = p.axis === 'x' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
    spawnCar(G, type, p.x + (p.axis === 'x' ? 0 : 3.4), p.z + (p.axis === 'x' ? 3.4 : 0), yaw, 'parked');
  }
  G.trafficPeds = [];
  G.peds = [];
  for (let i = 0; i < CONFIG.pedCount; i++) {
    const p = randomRoadPos(rng);
    spawnPed(G, p.x + rng.range(-8, 8), p.z + rng.range(-8, 8));
  }
}

function nearestIntersection(v, step) {
  return Math.round(v / step) * step;
}

export function updateTraffic(G, dt) {
  const p = G.player.pos;
  for (const car of G.trafficCars) {
    if (car.driver !== 'traffic') continue;
    let target = car.cruise;
    for (const other of G.cars) {
      if (other === car) continue;
      const dx = other.x - car.x, dz = other.z - car.z;
      const ahead = car.axis === 'x' ? dz * car.dir : dx * car.dir;
      const along = car.axis === 'x' ? dx * car.dir : dz * car.dir;
      if (along > 0 && along < 9 && Math.abs(ahead) < 2.2) { target = 0; break; }
    }
    const pd = Math.hypot(p.x - car.x, p.z - car.z);
    if (pd < 8 && Math.abs(car.speed) < 1 && G.rng.chance(dt * 0.3)) G.audio.honk();
    car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
    const step = CONFIG.streetStep;
    if (car.axis === 'x') {
      car.x += car.dir * car.speed * dt;
      const inter = nearestIntersection(car.x, step);
      if (Math.abs(car.x - inter) < 0.6 && G.rng.chance(dt * 1.2)) {
        car.axis = 'z'; car.dir = G.rng.chance(0.5) ? 1 : -1;
        car.yaw = car.dir > 0 ? 0 : Math.PI; car.z = inter;
      }
    } else {
      car.z += car.dir * car.speed * dt;
      const inter = nearestIntersection(car.z, step);
      if (Math.abs(car.z - inter) < 0.6 && G.rng.chance(dt * 1.2)) {
        car.axis = 'x'; car.dir = G.rng.chance(0.5) ? 1 : -1;
        car.yaw = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2; car.x = inter;
      }
    }
    if (car.x < -245) { car.x = -245; car.axis = 'z'; car.dir = 1; car.yaw = 0; }
    if (car.x > 245) { car.x = 245; car.axis = 'z'; car.dir = -1; car.yaw = Math.PI; }
    if (car.z < -245) { car.z = -245; car.axis = 'x'; car.dir = 1; car.yaw = Math.PI / 2; }
    if (car.z > 245) { car.z = 245; car.axis = 'x'; car.dir = -1; car.yaw = -Math.PI / 2; }
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.yaw;
    car.wheelSpin += car.speed * dt * 2.4;
  }
}

function partMatrix(ped, ox, oy, oz, swing) {
  const cy = Math.cos(ped.yaw), sy = Math.sin(ped.yaw);
  _v.set(ped.x + ox * cy + oz * sy, oy, ped.z - ox * sy + oz * cy);
  _e.set(swing, ped.yaw, 0, 'YXZ');
  _q.setFromEuler(_e);
  _m4.compose(_v, _q, _s);
  return _m4;
}

export function updatePeds(G, dt) {
  const p = G.player.pos;
  for (const ped of G.peds) {
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      if (ped.fleeT <= 0) ped.state = 'walk';
      const dx = ped.x - p.x, dz = ped.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      ped.yaw = Math.atan2(dx / d, dz / d);
      ped.x += (dx / d) * 4.5 * dt; ped.z += (dz / d) * 4.5 * dt;
    } else if (ped.state === 'wait') {
      // Standing still (taxi passenger / mission NPC).
    } else if (ped.state === 'police' || ped.state === 'guard') {
      // Moved by police.js / combat.js; only animate here.
    } else {
      ped.x += Math.sin(ped.yaw) * ped.speed * dt;
      ped.z += Math.cos(ped.yaw) * ped.speed * dt;
      if (G.rng.chance(dt * 0.08)) ped.yaw += (G.rng.chance(0.5) ? 1 : -1) * Math.PI / 2;
      if (Math.abs(ped.x) > 250 || Math.abs(ped.z) > 250) ped.yaw += Math.PI;
    }
    if (G.lastShotT !== undefined && G.time - G.lastShotT < 1.5) {
      const d = Math.hypot(ped.x - p.x, ped.z - p.z);
      if (d < 25 && ped.state !== 'flee' && ped.state !== 'police' && ped.state !== 'guard') { ped.state = 'flee'; ped.fleeT = 5; }
    }
    const moving = ped.state === 'flee' || ped.state === 'walk' || ped.state === 'police' || ped.state === 'guard';
    ped.walkPhase += dt * (ped.state === 'flee' ? 11 : moving ? 8 : 0);
    const swing = moving ? Math.sin(ped.walkPhase) * 0.5 : 0;
    const s = ped.slot;
    pedMeshes.body.setMatrixAt(s, partMatrix(ped, 0, 1.05, 0, 0));
    pedMeshes.head.setMatrixAt(s, partMatrix(ped, 0, 1.62, 0, 0));
    pedMeshes.legL.setMatrixAt(s, partMatrix(ped, -0.14, 0.35, 0, swing));
    pedMeshes.legR.setMatrixAt(s, partMatrix(ped, 0.14, 0.35, 0, -swing));
    pedMeshes.armL.setMatrixAt(s, partMatrix(ped, -0.33, 1.05, 0, -swing * 0.7));
    pedMeshes.armR.setMatrixAt(s, partMatrix(ped, 0.33, 1.05, 0, swing * 0.7));
  }
  for (const k of Object.keys(pedMeshes)) pedMeshes[k].instanceMatrix.needsUpdate = true;
}
