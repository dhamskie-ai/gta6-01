// Traffic AI (cars follow the road grid, plus a wild street race that
// tears down the coast road every minute or so) + pedestrian AI
// (sidewalks, fleeing, and the new street life: chatting groups,
// selfies, bench sitters, pier fishermen, bonfire dancers).
// Pedestrians share 6 InstancedMeshes (body/head/legs/arms) — 6 draw
import * as THREE from 'three';
import { CONFIG, PED_NAMES, PAINT_COLORS, FOOD_TRUCK_SPOTS, PARTY_POS } from './config.js';
import { randomRoadPos } from './city.js';
import { spawnCar } from './vehicles.js';
const TRAFFIC_TYPES = ['sedan', 'hatch', 'taxi', 'van', 'sedan', 'hatch', 'sport', 'bus'];
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
    speed: rng.chance(0.12) ? rng.range(2.4, 3.0) : rng.range(1.0, 1.8),
    state: 'walk', fleeT: 0, idleT: 0, walkPhase: rng.range(0, 6),
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
function spawnChatGroup(G, cx, cz, n) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const ped = spawnPed(G, cx + Math.cos(a) * 1.2, cz + Math.sin(a) * 1.2);
    if (!ped) return;
    ped.state = 'chat';
    ped.chatX = cx; ped.chatZ = cz;
    ped.yaw = Math.atan2(cx - ped.x, cz - ped.z);
  }
}
export function spawnTrafficWorld(G) {
  const rng = G.rng;
  G.trafficCars = [];
  G.raceCars = [];
  G.foodTrucks = [];
  G._race = { active: false, cooldown: 40 };
  for (let i = 0; i < CONFIG.trafficCount; i++) {
    const p = randomRoadPos(rng);
    const type = rng.pick(TRAFFIC_TYPES);
    const yaw = p.axis === 'x' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
    const paint = type === 'taxi' || type === 'truck' || type === 'bus' ? undefined : rng.pick(PAINT_COLORS);
    const car = spawnCar(G, type, p.x, p.z, yaw, 'traffic', paint);
    car.speed = rng.range(6, 11);
    car.cruise = car.speed;
    car.axis = p.axis; car.dir = p.dir;
    G.trafficCars.push(car);
  }
  for (let i = 0; i < CONFIG.parkedCount; i++) {
    const p = randomRoadPos(rng);
    const type = rng.pick(['sedan', 'hatch', 'van', 'taxi']);
    const yaw = p.axis === 'x' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
    const paint = type === 'taxi' ? undefined : rng.pick(PAINT_COLORS);
    spawnCar(G, type, p.x + (p.axis === 'x' ? 0 : 3.4), p.z + (p.axis === 'x' ? 3.4 : 0), yaw, 'parked', paint);
  }
  for (const [fx, fz] of FOOD_TRUCK_SPOTS) {
    const truck = spawnCar(G, 'foodtruck', fx, fz, Math.PI / 2, 'parked');
    G.foodTrucks.push(truck);
  }
  G.trafficPeds = [];
  G.peds = [];
  for (let i = 0; i < CONFIG.pedCount; i++) {
    const p = randomRoadPos(rng);
    spawnPed(G, p.x + rng.range(-8, 8), p.z + rng.range(-8, 8));
  }
  spawnChatGroup(G, 6, 144, 3);
  spawnChatGroup(G, -12, 126, 2);
  spawnChatGroup(G, -252, 62, 3);
  const selfie = spawnPed(G, -306, 12);
  if (selfie) { selfie.state = 'selfie'; selfie.yaw = Math.PI / 2; }
  const selfie2 = spawnPed(G, 14, 142);
  if (selfie2) { selfie2.state = 'selfie'; selfie2.yaw = Math.PI; }
  for (const [bx, bz] of [[-250, -110], [-250, 22], [-250, 154], [-4, 138]]) {
    const sitter = spawnPed(G, bx, bz);
    if (sitter) { sitter.state = 'sit'; sitter.yaw = Math.PI / 2; }
  }
  for (const [fx, fz] of [[-336, -6], [-338, 4], [-334, 10]]) {
    const fisher = spawnPed(G, fx, fz);
    if (fisher) { fisher.state = 'fish'; fisher.yaw = -Math.PI / 2; }
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const dancer = spawnPed(G, PARTY_POS[0] + Math.cos(a) * 3.2, PARTY_POS[1] + Math.sin(a) * 3.2);
    if (dancer) { dancer.state = 'dance'; dancer.yaw = Math.atan2(PARTY_POS[0] - dancer.x, PARTY_POS[1] - dancer.z); }
  }
}
function nearestIntersection(v, step) {
  return Math.round(v / step) * step;
}
function startStreetRace(G) {
  const paints = [0xff2e7e, 0x4ae3ff];
  for (let i = 0; i < 2; i++) {
    const car = spawnCar(G, 'sport', -242.5 + i * 5, -200 - i * 4, 0, 'race', paints[i]);
    car.speed = 6;
    car.cruise = 34;
    G.raceCars.push(car);
  }
  G._race.active = true;
  G.audio.raceHorn();
  G._eventMsg = 'STREET RACE on the coast road — two cars, no rules';
  G._eventT = 6;
  G.hud.toast('Street race on Coral Strand!');
}
function updateStreetRace(G, dt) {
  const race = G._race;
  if (!race) return;
  if (!race.active) {
    if (G.phase !== 'play') return;
    race.cooldown -= dt;
    if (race.cooldown <= 0) startStreetRace(G);
    return;
  }
  let finished = 0;
  for (const car of [...G.raceCars]) {
    car.speed += (car.cruise - car.speed) * Math.min(1, dt * 1.2);
    car.z += car.speed * dt;
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.yaw;
    car.wheelSpin += car.speed * dt * 2.4;
    if (car.z > 235) {
      finished++;
      G.scene.remove(car.group);
      G.cars.splice(G.cars.indexOf(car), 1);
      G.raceCars.splice(G.raceCars.indexOf(car), 1);
    }
  }
  if (finished > 0 && G.raceCars.length === 0) {
    race.active = false;
    race.cooldown = CONFIG.raceEvery + G.rng.range(0, 30);
    G._eventMsg = 'Street race finished — next one soon';
    G._eventT = 5;
    G.audio.cheer();
  }
}
export function updateTraffic(G, dt) {
  const p = G.player.pos;
  updateStreetRace(G, dt);
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
  const night = G.timeOfDay < 6 || G.timeOfDay >= 20;
  for (const ped of G.peds) {
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      if (ped.fleeT <= 0) ped.state = 'walk';
      const dx = ped.x - p.x, dz = ped.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      ped.yaw = Math.atan2(dx / d, dz / d);
      ped.x += (dx / d) * 4.5 * dt; ped.z += (dz / d) * 4.5 * dt;
    } else if (ped.state === 'wait') {
    } else if (ped.state === 'police' || ped.state === 'guard') {
    } else if (ped.state === 'chat') {
      ped.yaw = Math.atan2(ped.chatX - ped.x, ped.chatZ - ped.z);
      ped.walkPhase += dt * 2;
    } else if (ped.state === 'selfie') {
      ped.walkPhase += dt * 1.5;
      if (G.rng.chance(dt * 0.1)) ped.yaw += G.rng.range(-0.3, 0.3);
    } else if (ped.state === 'sit') {
      if (G.rng.chance(dt * 0.05)) ped.yaw += G.rng.range(-0.4, 0.4);
    } else if (ped.state === 'fish') {
      ped.walkPhase += dt * 0.8;
    } else if (ped.state === 'dance') {
      ped.walkPhase += dt * (night ? 7 : 1.5);
      ped.yaw = Math.atan2(PARTY_POS[0] - ped.x, PARTY_POS[1] - ped.z);
    } else {
      if (ped.idleT > 0) {
        ped.idleT -= dt;
        if (G.rng.chance(dt * 0.4)) ped.yaw += G.rng.range(-0.5, 0.5);
      } else {
        ped.x += Math.sin(ped.yaw) * ped.speed * dt;
        ped.z += Math.cos(ped.yaw) * ped.speed * dt;
        if (G.rng.chance(dt * 0.08)) ped.yaw += (G.rng.chance(0.5) ? 1 : -1) * Math.PI / 2;
        if (Math.abs(ped.x) > 250 || Math.abs(ped.z) > 250) ped.yaw += Math.PI;
        if (G.rng.chance(dt * 0.06)) ped.idleT = G.rng.range(2, 5);
      }
    }
    if (G.lastShotT !== undefined && G.time - G.lastShotT < 1.5) {
      const d = Math.hypot(ped.x - p.x, ped.z - p.z);
      if (d < 25 && ped.state !== 'flee' && ped.state !== 'police' && ped.state !== 'guard') { ped.state = 'flee'; ped.fleeT = 5; }
    }
    const strolling = ped.state === 'walk' && ped.idleT <= 0;
    const moving = ped.state === 'flee' || strolling || ped.state === 'police' || ped.state === 'guard';
    ped.walkPhase += dt * (ped.state === 'flee' ? 11 : moving ? 8 : 0);
    const swing = moving ? Math.sin(ped.walkPhase) * 0.5 : 0;
    const s = ped.slot;
    const sitting = ped.state === 'sit';
    const bodyY = sitting ? 0.72 : 1.05;
    const headY = sitting ? 1.28 : 1.62;
    const legSwing = sitting ? -1.35 : swing;
    let armL = -swing * 0.7, armR = swing * 0.7, bob = 0;
    if (ped.state === 'chat') { armR = -0.6 + Math.sin(ped.walkPhase) * 0.4; armL = 0.1; }
    if (ped.state === 'selfie') { armR = -2.1; armL = -0.3; }
    if (ped.state === 'fish') { armL = -0.9; armR = -0.9 + Math.sin(ped.walkPhase) * 0.15; }
    if (ped.state === 'dance') {
      const beat = Math.sin(ped.walkPhase);
      armL = -2.2 + beat * 0.5; armR = -2.2 - beat * 0.5;
      bob = night ? Math.abs(Math.sin(ped.walkPhase)) * 0.12 : 0;
    }
    pedMeshes.body.setMatrixAt(s, partMatrix(ped, 0, bodyY + bob, 0, 0));
    pedMeshes.head.setMatrixAt(s, partMatrix(ped, 0, headY + bob, 0, 0));
    pedMeshes.legL.setMatrixAt(s, partMatrix(ped, -0.14, 0.35, sitting ? 0.25 : 0, legSwing));
    pedMeshes.legR.setMatrixAt(s, partMatrix(ped, 0.14, 0.35, sitting ? 0.25 : 0, -legSwing));
    pedMeshes.armL.setMatrixAt(s, partMatrix(ped, -0.33, bodyY, 0, armL));
    pedMeshes.armR.setMatrixAt(s, partMatrix(ped, 0.33, bodyY, 0, armR));
  }
  for (const k of Object.keys(pedMeshes)) pedMeshes[k].instanceMatrix.needsUpdate = true;
}
