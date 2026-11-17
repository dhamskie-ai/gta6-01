// Traffic AI cars following the road graph + pedestrian AI on sidewalks.
import * as THREE from 'three';
import { CFG } from './config.js';
import { roadCoords } from './city.js';
import { makeCarModel } from './vehicles.js';

const PED_NAMES = ['Ana', 'Beto', 'Celia', 'Dimas', 'Elena', 'Farid', 'Gita', 'Hugo', 'Ines', 'Joko', 'Kira', 'Luis', 'Maya', 'Nico', 'Olga', 'Pablo', 'Rina', 'Sinta', 'Tono', 'Uma', 'Vera', 'Wira', 'Yara', 'Zaki'];
const SHIRT_COLORS = [0xd84a4a, 0x4a8ad8, 0x4ad87a, 0xd8c84a, 0x9a4ad8, 0xe88a4a, 0x4ad8d8, 0xe8e8e8, 0x3a3a3a, 0xd84a8a];

export function spawnTraffic(G) {
  const roads = roadCoords();
  const types = ['sedan', 'hatch', 'taxi', 'van', 'sedan', 'hatch'];
  for (let i = 0; i < CFG.trafficCount; i++) {
    const horizontal = G.rng.chance(0.5);
    const road = G.rng.pick(roads);
    const along = G.rng.range(-240, 240);
    const dir = G.rng.chance(0.5) ? 1 : -1;
    const type = G.rng.pick(types);
    const mesh = makeCarModel(type);
    const lane = 3;
    const x = horizontal ? along : road + lane * dir;
    const z = horizontal ? road + lane * dir : along;
    const yaw = horizontal ? (dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (dir > 0 ? Math.PI : 0);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;
    G.scene.add(mesh);
    const car = {
      mesh, type, yaw, speed: G.rng.range(7, 12),
      horizontal, road, dir, targetSpeed: G.rng.range(7, 12),
      stuck: 0,
    };
    G.cars.push(car);
    G.traffic.push(car);
  }
}

export function updateTraffic(G, dt) {
  const roads = roadCoords();
  const playerPos = G.player.car ? G.player.car.mesh.position : G.player.pos;
  for (const car of G.traffic) {
    const p = car.mesh.position;
    // Slow down if the player car is right ahead.
    let blocked = false;
    const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw);
    for (const other of G.cars) {
      if (other === car) continue;
      const dx = other.mesh.position.x - p.x;
      const dz = other.mesh.position.z - p.z;
      const ahead = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 9 && side < 2.5) { blocked = true; break; }
    }
    const target = blocked ? 0 : car.targetSpeed;
    car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
    p.x += fx * car.speed * dt;
    p.z += fz * car.speed * dt;
    // At an intersection, sometimes turn.
    const alongVal = car.horizontal ? p.x : p.z;
    const atCross = roads.some((v) => Math.abs(alongVal - v) < 1.0);
    car.turnCd = (car.turnCd || 0) - dt;
    if (atCross && car.turnCd <= 0 && G.rng.next() < dt * 0.5) {
      turnTrafficCar(G, car);
      car.turnCd = 5;
    }
    // Wrap around the city edge.
    if (p.x > 260 || p.x < -260 || p.z > 260 || p.z < -260) {
      respawnTrafficCar(G, car);
    }
    // Despawn far cars, respawn near the player.
    const dx = p.x - playerPos.x, dz = p.z - playerPos.z;
    if (dx * dx + dz * dz > 200 * 200) respawnTrafficCar(G, car);
    car.mesh.rotation.y = car.yaw;
    const wheels = car.mesh.userData.wheels;
    if (wheels) for (const w of wheels) w.rotation.x += car.speed * dt * 2;
  }
}

function turnTrafficCar(G, car) {
  const roads = roadCoords();
  const p = car.mesh.position;
  const wasH = car.horizontal;
  car.horizontal = !wasH;
  const newRoad = roads.reduce((a, b) => (Math.abs(b - (wasH ? p.z : p.x)) < Math.abs(a - (wasH ? p.z : p.x)) ? b : a));
  car.road = newRoad;
  car.dir = G.rng.chance(0.5) ? 1 : -1;
  const lane = 3;
  if (car.horizontal) {
    p.z = newRoad + lane * car.dir;
    car.yaw = car.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  } else {
    p.x = newRoad + lane * car.dir;
    car.yaw = car.dir > 0 ? Math.PI : 0;
  }
}

function respawnTrafficCar(G, car) {
  const roads = roadCoords();
  const playerPos = G.player.car ? G.player.car.mesh.position : G.player.pos;
  const horizontal = G.rng.chance(0.5);
  const road = G.rng.pick(roads);
  const along = THREE.MathUtils.clamp(playerPos.x + G.rng.range(-90, 90), -240, 240);
  const alongZ = THREE.MathUtils.clamp(playerPos.z + G.rng.range(-90, 90), -240, 240);
  const dir = G.rng.chance(0.5) ? 1 : -1;
  const lane = 3;
  car.horizontal = horizontal;
  car.road = road;
  car.dir = dir;
  const p = car.mesh.position;
  if (horizontal) {
    p.set(along, 0, road + lane * dir);
    car.yaw = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  } else {
    p.set(road + lane * dir, 0, alongZ);
    car.yaw = dir > 0 ? Math.PI : 0;
  }
  car.speed = car.targetSpeed;
}

// --- Pedestrians -----------------------------------------------------------
export function makePedModel(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(SHIRT_COLORS) });
  const skin = new THREE.MeshLambertMaterial({ color: [0xe8b98a, 0xc98a5a, 0x8a5a3a, 0xf2c9a0][rng.int(0, 3)] });
  const pants = new THREE.MeshLambertMaterial({ color: [0x2a3644, 0x4a3a2a, 0x3a3a3a, 0x5a6a8a][rng.int(0, 3)] });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.32), shirt);
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skin);
  head.position.y = 1.65;
  head.castShadow = true;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.2), pants);
  legL.position.set(-0.14, 0.32, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), shirt);
  armL.position.set(-0.36, 1.05, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.36;
  g.add(armR);
  g.userData.legL = legL; g.userData.legR = legR;
  g.userData.armL = armL; g.userData.armR = armR;
  return g;
}

export function spawnPedestrians(G) {
  for (let i = 0; i < CFG.pedCount; i++) {
    const mesh = makePedModel(G.rng);
    const x = G.rng.range(-240, 240);
    const z = G.rng.range(-240, 240);
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    const ped = {
      mesh, name: PED_NAMES[i % PED_NAMES.length],
      speed: G.rng.range(1.2, 2.4),
      yaw: G.rng.range(0, Math.PI * 2),
      target: null, flee: 0, walkPhase: G.rng.range(0, 6),
    };
    pickPedTarget(G, ped);
    G.peds.push(ped);
  }
}

function pickPedTarget(G, ped) {
  const roads = roadCoords();
  const road = G.rng.pick(roads);
  const along = G.rng.range(-240, 240);
  const side = G.rng.chance(0.5) ? 8.5 : -8.5;
  ped.target = G.rng.chance(0.5)
    ? { x: along, z: road + side }
    : { x: road + side, z: along };
}

export function updatePedestrians(G, dt) {
  const playerPos = G.player.car ? G.player.car.mesh.position : G.player.pos;
  for (const ped of G.peds) {
    const p = ped.mesh.position;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const dx = p.x - playerPos.x, dz = p.z - playerPos.z;
      const d = Math.max(0.1, Math.hypot(dx, dz));
      ped.yaw = Math.atan2(-dx / d, -dz / d);
      p.x += -Math.sin(ped.yaw) * 5 * dt;
      p.z += -Math.cos(ped.yaw) * 5 * dt;
    } else {
      const t = ped.target;
      const dx = t.x - p.x, dz = t.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.5) { pickPedTarget(G, ped); continue; }
      ped.yaw = Math.atan2(-dx / d, -dz / d);
      p.x += -Math.sin(ped.yaw) * ped.speed * dt;
      p.z += -Math.cos(ped.yaw) * ped.speed * dt;
    }
    ped.walkPhase += dt * ped.speed * 4;
    const swing = Math.sin(ped.walkPhase) * 0.5;
    ped.mesh.userData.legL.rotation.x = swing;
    ped.mesh.userData.legR.rotation.x = -swing;
    ped.mesh.userData.armL.rotation.x = -swing * 0.7;
    ped.mesh.userData.armR.rotation.x = swing * 0.7;
    ped.mesh.rotation.y = ped.yaw;
    // Despawn far peds, respawn near the player.
    const dx = p.x - playerPos.x, dz = p.z - playerPos.z;
    if (dx * dx + dz * dz > 180 * 180) {
      p.x = playerPos.x + G.rng.range(-90, 90);
      p.z = playerPos.z + G.rng.range(-90, 90);
      pickPedTarget(G, ped);
    }
  }
}

export function scarePedestrians(G, pos, radius = 25) {
  for (const ped of G.peds) {
    const dx = ped.mesh.position.x - pos.x;
    const dz = ped.mesh.position.z - pos.z;
    if (dx * dx + dz * dz < radius * radius) ped.flee = 3 + G.rng.next() * 3;
  }
}
