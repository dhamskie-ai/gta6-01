// Dense world life: 36 traffic cars on the road graph, ~150 pedestrians on
// sidewalks, 24 parked cars, 22 birds. Spawn/despawn near the player.
import * as THREE from 'three';
import { CONFIG, CAR_TYPES } from './config.js';
import { rand, randInt, pick } from './random.js';
import { ROAD_XS, ROAD_ZS, collideBuildings, clampWorld } from './city.js';
import { createCarMesh } from './vehicles.js';

const PED_COLORS = [0xe2543e, 0x3f7fd0, 0xffd23f, 0x3fd2c0, 0xff8fd0, 0x9aa5b1, 0x4a6b4f, 0xf2e6d0];

export function initTraffic(scene, rng, city) {
  const traffic = { cars: [], peds: [], parked: [], birds: [], marco: null };

  function randomRoadPoint() {
    if (rng() < 0.5) return { x: pick(rng, ROAD_XS) + rand(rng, -3, 3), z: rand(rng, -280, 280), alongX: false };
    return { x: rand(rng, -280, 280), z: pick(rng, ROAD_ZS) + rand(rng, -3, 3), alongX: true };
  }
  function makeTrafficCar() {
    const type = pick(rng, Object.keys(CAR_TYPES));
    const car = createCarMesh(type, pick(rng, [0xe2543e, 0x3f7fd0, 0xffd23f, 0x9aa5b1, 0x3fd2c0, 0xffffff, 0x222831]));
    const pt = randomRoadPoint();
    car.group.position.set(pt.x, 0, pt.z);
    car.group.rotation.y = pt.alongX ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    car.driver = 'traffic'; car.speed = rand(rng, 8, 14); car.maxSpeed = rand(rng, 12, 18);
    car.target = randomRoadPoint();
    scene.add(car.group);
    return car;
  }
  for (let i = 0; i < CONFIG.trafficCount; i++) traffic.cars.push(makeTrafficCar());

  for (let i = 0; i < CONFIG.parkedCount; i++) {
    const type = pick(rng, Object.keys(CAR_TYPES));
    const car = createCarMesh(type, pick(rng, [0xe2543e, 0x3f7fd0, 0xffd23f, 0x9aa5b1, 0x3fd2c0]));
    const road = pick(rng, ROAD_XS);
    car.group.position.set(road + 6.5, 0, rand(rng, -280, 280));
    car.group.rotation.y = rng() < 0.5 ? 0 : Math.PI;
    car.driver = 'parked'; car.speed = 0;
    scene.add(car.group); traffic.parked.push(car);
  }
  // Mission 1's parked Cometa sits by the market at (-104, -104).
  const m1 = createCarMesh('sedan', 0x3f7fd0);
  m1.group.position.set(-104, 0, -104); m1.group.rotation.y = Math.PI / 2;
  m1.driver = 'parked'; m1.speed = 0;
  scene.add(m1.group); traffic.parked.push(m1);

  function makePed(x, z) {
    const g = new THREE.Group();
    const c = pick(rng, PED_COLORS);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.95, 0.4), new THREE.MeshLambertMaterial({ color: c }));
    body.position.y = 1.1; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
    head.position.y = 1.8; g.add(head);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.65, 0.26), new THREE.MeshLambertMaterial({ color: 0x2b3a4a }));
    leg.position.set(-0.16, 0.32, 0); g.add(leg);
    const leg2 = leg.clone(); leg2.position.x = 0.16; g.add(leg2);
    g.position.set(x, 0, z);
    scene.add(g);
    return { mesh: g, speed: rand(rng, 1, 2.2), dir: rand(rng, 0, Math.PI * 2), panic: 0, leg, leg2, phase: rand(rng, 0, 6) };
  }
  for (let i = 0; i < CONFIG.pedCount; i++) {
    const road = pick(rng, ROAD_XS);
    traffic.peds.push(makePed(road + rand(rng, 8, 11) * (rng() < 0.5 ? 1 : -1), rand(rng, -290, 290)));
  }
  // Marco, the mission-2 contact, waits by Marlin Ceviche.
  const marco = makePed(-80, -160);
  marco.mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0xffd23f });
  traffic.marco = marco.mesh;
  traffic.peds.push(marco);

  for (let i = 0; i < CONFIG.birdCount; i++) {
    const b = new THREE.Group();
    const wingMat = new THREE.MeshLambertMaterial({ color: 0x333a44 });
    const w1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.4), wingMat);
    const w2 = w1.clone(); w2.position.x = 0; b.add(w1); b.add(w2);
    const cx = rand(rng, -280, 100), cz = rand(rng, -200, 200);
    b.position.set(cx, rand(rng, 30, 55), cz);
    scene.add(b);
    traffic.birds.push({ mesh: b, cx, cz, r: rand(rng, 15, 45), a: rand(rng, 0, 6), speed: rand(rng, 0.2, 0.5) });
  }

  traffic.update = (S, dt) => {
    const pp = S.player.mesh.position;
    // Traffic cars: steer toward their target intersection, pick a new one on arrival.
    for (const car of traffic.cars) {
      const t = car.target;
      const dx = t.x - car.group.position.x, dz = t.z - car.group.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 6) { car.target = randomRoadPoint(); continue; }
      const want = Math.atan2(dx, dz);
      let dy = want - car.group.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      car.group.rotation.y += Math.max(-1.6 * dt, Math.min(1.6 * dt, dy));
      // Slow down if a car is right ahead.
      let blocked = false;
      for (const o of S.cars) {
        if (o === car) continue;
        const od = o.group.position.distanceTo(car.group.position);
        if (od < 7) { const fwd = new THREE.Vector3(Math.sin(car.group.rotation.y), 0, Math.cos(car.group.rotation.y)); const to = o.group.position.clone().sub(car.group.position).normalize(); if (to.dot(fwd) > 0.7) blocked = true; }
      }
      car.speed = blocked ? Math.max(0, car.speed - 20 * dt) : Math.min(car.maxSpeed, car.speed + 6 * dt);
      car.group.position.x += Math.sin(car.group.rotation.y) * car.speed * dt;
      car.group.position.z += Math.cos(car.group.rotation.y) * car.speed * dt;
      clampWorld(car.group.position, 310);
      // Respawn near the player if it drifted far away.
      if (car.group.position.distanceTo(pp) > 220) {
        const pt = randomRoadPoint();
        car.group.position.set(pp.x + rand(rng, -90, 90), 0, pp.z + rand(rng, -90, 90));
        car.group.position.x = Math.max(-300, Math.min(300, car.group.position.x));
        car.group.position.z = Math.max(-300, Math.min(300, car.group.position.z));
        car.target = randomRoadPoint();
      }
      for (const w of car.wheels || []) w.rotation.x += car.speed * dt * 0.5;
    }
    // Pedestrians: stroll the sidewalks, panic-flee on gunfire or a near car.
    const gunfire = S.elapsed - S.combat.lastShotAt < 3;
    for (const ped of traffic.peds) {
      let sp = ped.speed;
      if (gunfire) ped.panic = 2;
      if (ped.panic > 0) { ped.panic -= dt; sp = 6; ped.dir = Math.atan2(pp.x - ped.mesh.position.x, pp.z - ped.mesh.position.z) + Math.PI; }
      else if (Math.random() < 0.002) ped.dir = rand(rng, 0, Math.PI * 2);
      ped.mesh.position.x += Math.sin(ped.dir) * sp * dt;
      ped.mesh.position.z += Math.cos(ped.dir) * sp * dt;
      ped.mesh.rotation.y = ped.dir;
      ped.phase += dt * sp * 3;
      ped.leg.rotation.x = Math.sin(ped.phase) * 0.5;
      ped.leg2.rotation.x = -Math.sin(ped.phase) * 0.5;
      collideBuildings(city.colliders, ped.mesh.position, 0.6);
      clampWorld(ped.mesh.position, 305);
    }
    // Birds circle overhead.
    for (const b of traffic.birds) {
      b.a += b.speed * dt;
      b.mesh.position.set(b.cx + Math.cos(b.a) * b.r, b.mesh.position.y + Math.sin(S.elapsed * 0.7 + b.a) * 0.4, b.cz + Math.sin(b.a) * b.r);
      b.mesh.rotation.y = -b.a;
    }
  };
  return traffic;
}
