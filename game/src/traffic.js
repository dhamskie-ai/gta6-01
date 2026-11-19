// Traffic AI + pejalan kaki AI + mobil parkir (termasuk bus & taco truck).
import { CONFIG, CAR_TYPES } from './config.js';
import { range, rangeInt, pick, clamp } from './random.js';
import { spawnCar } from './vehicles.js';

function makePedMesh(THREE, rng) {
  const g = new THREE.Group();
  const shirt = pick(rng, [0xff5fa2, 0x37e0ff, 0xffd23e, 0x7ef0d4, 0xff8a3d, 0xf2ede2, 0xb678f0]);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.05, 0.36),
    new THREE.MeshLambertMaterial({ color: shirt }));
  body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6),
    new THREE.MeshLambertMaterial({ color: pick(rng, [0xd9a066, 0x8a5a3b, 0xe8b98a, 0x6b4a26]) }));
  head.position.y = 1.82; g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22),
    new THREE.MeshLambertMaterial({ color: 0x2a2f38 }));
  legL.position.set(-0.16, 0.42, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
  g.userData = { legL, legR, body };
  return g;
}

export function initTraffic(G, THREE, city, rng) {
  G.trafficCars = []; G.peds = []; G.parkedCars = [];
  const roadTypes = ['sedan', 'hatch', 'taxi', 'van', 'sport', 'truck'];
  for (let i = 0; i < CONFIG.trafficCount; i++) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    const road = pick(rng, CONFIG.roads);
    const dir = rng() < 0.5 ? 1 : -1;
    const lane = dir * 2.6;
    const along = range(rng, -280, 280);
    const x = axis === 'x' ? along : road + lane;
    const z = axis === 'x' ? road + lane : along;
    const type = pick(rng, roadTypes);
    const car = spawnCar(G, THREE, city, type, x, z, axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI));
    car.ai = { axis, road, dir, speed: range(rng, 8, 14), cruise: range(rng, 9, 15) };
    car.driver = true;
    G.trafficCars.push(car);
  }
  for (let i = 0; i < CONFIG.pedCount; i++) {
    const ped = spawnPed(G, THREE, city, rng);
    G.peds.push(ped);
  }
  // mobil parkir di pinggir jalan
  const parkedTypes = ['sedan', 'hatch', 'taxi', 'van', 'sport', 'sedan', 'hatch', 'truck', 'van', 'sedan', 'sport', 'hatch', 'taxi', 'van'];
  for (let i = 0; i < Math.min(CONFIG.parkedCount - 2, parkedTypes.length); i++) {
    const road = pick(rng, CONFIG.roads);
    const along = range(rng, -260, 260);
    const side = rng() < 0.5 ? -1 : 1;
    const horiz = rng() < 0.5;
    const x = horiz ? along : road + side * 5.4;
    const z = horiz ? road + side * 5.4 : along;
    if (city.collide(x, z, 2)) continue;
    const car = spawnCar(G, THREE, city, parkedTypes[i], x, z, horiz ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2), { parked: true, driver: false });
    G.parkedCars.push(car);
  }
  // Solara Bus + taco truck — bisa dicuri
  const bus = spawnCar(G, THREE, city, 'bus', 125.4, -60, Math.PI / 2, { parked: true, driver: false });
  G.parkedCars.push(bus);
  const taco = spawnCar(G, THREE, city, 'taco', -234.6, 210, 0, { parked: true, driver: false });
  G.parkedCars.push(taco);
  // mobil misi 1: Cometa parkir di pinggir jalan dekat spawn
  const starter = spawnCar(G, THREE, city, 'sedan', -125.4, 12, 0, { parked: true, driver: false });
  G.parkedCars.push(starter);
  G.starterCar = starter;
}

export function spawnPed(G, THREE, city, rng) {
  const mesh = makePedMesh(THREE, rng);
  const road = pick(rng, CONFIG.roads);
  const horiz = rng() < 0.5;
  const along = range(rng, -270, 270);
  const side = rng() < 0.5 ? -1 : 1;
  const x = horiz ? along : road + side * 9.4;
  const z = horiz ? road + side * 9.4 : along;
  mesh.position.set(x, 0, z);
  G.scene.add(mesh);
  const ped = {
    mesh, x, z, yaw: range(rng, 0, 6.28), speed: range(rng, 0.8, 1.6),
    horiz, side, road, flee: 0, walkPhase: range(rng, 0, 6),
  };
  return ped;
}

export function fleePed(G, x, z) {
  const ped = { mesh: null, x, z, yaw: 0, speed: 3.2, flee: 4, walkPhase: 0, driver: true };
  G.peds.push(ped);
}

function nearestLightState(city, x, z) {
  let best = null, bd = 1e9;
  for (const tl of city.trafficLights) {
    const dx = tl.x - x, dz = tl.z - z, d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = tl; }
  }
  if (!best || bd > 30 * 30) return -1;
  const ph = best.phase % 9;
  return ph < 4 ? 2 : ph < 5 ? 1 : 0; // 2 hijau, 1 kuning, 0 merah
}

export function updateTraffic(G, dt, city, rng) {
  const px = G.player.inCar ? G.playerCar.x : G.player.x;
  const pz = G.player.inCar ? G.playerCar.z : G.player.z;
  for (const car of G.trafficCars) {
    if (car.dead) continue;
    const ai = car.ai;
    if (!ai || ai.rival || ai.courier) continue; // rival balap & kurir digerakkan modul misi
    let target = ai.cruise;
    // mobil di depan?
    for (const o of G.cars) {
      if (o === car || o.dead) continue;
      const dx = o.x - car.x, dz = o.z - car.z;
      const ahead = ai.axis === 'x' ? dx * ai.dir : dz * ai.dir;
      const side = ai.axis === 'x' ? Math.abs(dz) : Math.abs(dx);
      if (ahead > 0 && ahead < 12 && side < 3) { target = 0; break; }
    }
    // lampu merah di depan?
    const ls = nearestLightState(city, car.x, car.z);
    if (ls === 0) {
      const dx = car.x, dz = car.z;
      void dx; void dz;
      target = Math.min(target, 2);
    }
    ai.speed += clamp(target - ai.speed, -14 * dt, 8 * dt);
    const nx = car.x + (ai.axis === 'x' ? ai.dir * ai.speed * dt : 0);
    const nz = car.z + (ai.axis === 'z' ? ai.dir * ai.speed * dt : 0);
    if (Math.abs(nx) > 288 || Math.abs(nz) > 288 || city.collide(nx, nz, 1.6)) {
      // belok: ganti sumbu/jalan di persimpangan terdekat
      const road = pick(rng, CONFIG.roads);
      ai.axis = ai.axis === 'x' ? 'z' : 'x';
      ai.road = road; ai.dir = rng() < 0.5 ? 1 : -1;
      const lane = ai.dir * 2.6;
      if (ai.axis === 'x') { car.z = road + lane; car.yaw = ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      else { car.x = road + lane; car.yaw = ai.dir > 0 ? 0 : Math.PI; }
    } else { car.x = nx; car.z = nz; }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.yaw;
    for (const w of car.mesh.userData.wheels) w.rotation.x += ai.speed * dt * 2.2;
    // respawn dekat pemain bila terlalu jauh
    const dx = car.x - px, dz = car.z - pz;
    if (dx * dx + dz * dz > 170 * 170) {
      const road = pick(rng, CONFIG.roads);
      const lane = ai.dir * 2.6;
      if (ai.axis === 'x') { car.x = clamp(px + range(rng, -90, 90), -280, 280); car.z = road + lane; }
      else { car.z = clamp(pz + range(rng, -90, 90), -280, 280); car.x = road + lane; }
    }
  }
  for (const ped of G.peds) {
    if (!ped.mesh) { // pengemudi yang ditarik keluar — lari lalu hilang
      ped.flee -= dt;
      ped.x += Math.sin(ped.yaw) * ped.speed * dt;
      ped.z += Math.cos(ped.yaw) * ped.speed * dt;
      if (ped.flee <= 0) G.peds.splice(G.peds.indexOf(ped), 1);
      continue;
    }
    const pdx = ped.x - px, pdz = ped.z - pz;
    const pd2 = pdx * pdx + pdz * pdz;
    const playerSpeed = G.player.inCar ? Math.abs(G.playerCar.speed) : 0;
    if (pd2 < 36 && playerSpeed > 6) ped.flee = 2.5;
    if (G.fleeUntil && performance.now() < G.fleeUntil) ped.flee = 1.5;
    let sp = ped.speed;
    if (ped.flee > 0) {
      ped.flee -= dt; sp = 4.2;
      const d = Math.sqrt(pd2) || 1;
      ped.yaw = Math.atan2(pdx / d, pdz / d);
    } else {
      // jalan di trotoar, sesekali berhenti
      if (rng() < 0.002) ped.yaw += Math.PI;
    }
    ped.x += Math.sin(ped.yaw) * sp * dt;
    ped.z += Math.cos(ped.yaw) * sp * dt;
    if (Math.abs(ped.x) > 288 || Math.abs(ped.z) > 288 || city.collide(ped.x, ped.z, 0.6)) {
      ped.yaw += Math.PI * 0.75;
      ped.x -= Math.sin(ped.yaw) * sp * dt * 2;
      ped.z -= Math.cos(ped.yaw) * sp * dt * 2;
    }
    ped.walkPhase += dt * sp * 3;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.yaw;
    const sw = Math.sin(ped.walkPhase) * 0.5;
    ped.mesh.userData.legL.rotation.x = sw;
    ped.mesh.userData.legR.rotation.x = -sw;
    if (pd2 > 150 * 150) {
      const road = pick(rng, CONFIG.roads);
      const side = rng() < 0.5 ? -1 : 1;
      if (rng() < 0.5) { ped.x = clamp(px + range(rng, -80, 80), -280, 280); ped.z = road + side * 9.4; }
      else { ped.z = clamp(pz + range(rng, -80, 80), -280, 280); ped.x = road + side * 9.4; }
    }
  }
}
