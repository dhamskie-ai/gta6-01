// Traffic AI (14 mobil ikut graf jalan), pejalan kaki AI (36, model HD
// + ayunan jalan + lari saat bahaya), burung ambient (14, sayap mengepak).
import { mulberry32, rr, ri, pick, chance, clamp, wrapAngle } from './random.js';
import { createCar } from './vehicles.js';
import { nearestNode, collideBuildings } from './city.js';
import { CFG, CAR_KINDS } from './config.js';

const SKINS = [0xe8b88a, 0xc98a5e, 0x8a5a38, 0xf2c89a, 0x6a4028];
const SHIRTS = [0xd21f2b, 0x2a7bd2, 0x3a9e4f, 0xffd25a, 0x8a4a9a, 0xff8c42, 0x2a9d8f, 0xf2f2f2];
const PANTS = [0x2a2e33, 0x3a4a6a, 0x6a5a48, 0x4a6b4f, 0x8a94a6];
// Model orang HD: kepala + topi/rambut, torso jaket, lengan, kaki, sepatu.
export function makePersonModel(THREE, rng, opts = {}) {
  const skin = opts.skin ?? pick(rng, SKINS);
  const shirt = opts.shirt ?? pick(rng, SHIRTS);
  const pants = opts.pants ?? pick(rng, PANTS);
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat(skin));
  head.position.y = 1.62; head.castShadow = true; g.add(head);
  if (chance(rng, 0.5) && !opts.noHat) {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.1, 10), mat(pick(rng, SHIRTS)));
    hat.position.y = 1.8; g.add(hat);
  } else {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(0x2a1a10));
    hair.position.y = 1.64; g.add(hair);
  }
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), mat(shirt));
  torso.position.y = 1.12; torso.castShadow = true; g.add(torso);
  const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.2, 0.34), mat(0x1a1d22));
  jacket.position.y = 1.36; g.add(jacket);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.58, 0.14), mat(shirt));
  armL.position.set(-0.34, 1.12, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.34; g.add(armR);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.18), mat(pants));
  legL.position.set(-0.13, 0.42, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.13; g.add(legR);
  for (const s of [-0.13, 0.13]) {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.34), mat(0x14161a));
    shoe.position.set(s, 0.05, 0.05); g.add(shoe);
  }
  g.userData.parts = { armL, armR, legL, legR, head };
  return g;
}
function sidewalkPoint(rng) {
  // Titik di trotoar: tepi jalan (offset 8.5 m dari as jalan).
  if (chance(rng, 0.5)) {
    const x = pick(rng, [-240, -160, -80, 0, 80, 160, 240]) + (chance(rng, 0.5) ? 8.5 : -8.5);
    return { x: clamp(x, -300, 300), z: rr(rng, -280, 280) };
  }
  const z = pick(rng, [-240, -160, -80, 0, 80, 160, 240]) + (chance(rng, 0.5) ? 8.5 : -8.5);
  return { x: rr(rng, -280, 280), z: clamp(z, -300, 300) };
}
export function createTraffic(W) {
  const THREE = W.three;
  const rng = mulberry32(W.seed + 77);
  const T = { cars: [], peds: [], birds: [], parked: [], missionCar: null, lastHonk: 0 };
  // Mobil traffic: jalan di graf jalan antar node.
  const kinds = ['cometa', 'pip', 'cabro', 'mula', 'cometa', 'pip'];
  for (let i = 0; i < CFG.trafficCars; i++) {
    const from = ri(rng, 0, W.city.nodes.length - 1);
    const node = W.city.nodes[from];
    if (!node.links.length) continue;
    const to = pick(rng, node.links);
    const kind = pick(rng, kinds);
    const car = createCar(W, kind, node.x, node.z, 0, pick(rng, [null, 0x3a7bd5, 0xe8b93e, 0x8a94a6, 0x4a9e5f]));
    car.driver = 'traffic';
    const tx = W.city.nodes[to].x, tz = W.city.nodes[to].z;
    car.heading = Math.atan2(tx - node.x, tz - node.z);
    T.cars.push({ car, from, to, t: rng(), speed: rr(rng, 8, 13), wait: 0 });
  }
  // Mobil parkir di tepi jalan (termasuk VELOZ COMET RS misi 1).
  const veloz = createCar(W, 'veloz', 17, 84, 0);
  veloz.driver = 'parked';
  T.missionCar = veloz;
  T.parked.push(veloz);
  const parkSpots = [[-88, 40], [88, -120], [-168, 120], [168, 40], [-8, -168], [88, 200], [-168, -40], [248, 120], [8, 248]];
  for (const [px, pz] of parkSpots) {
    const kind = pick(rng, ['cometa', 'pip', 'mula', 'cabro']);
    const c = createCar(W, kind, px, pz, chance(rng, 0.5) ? 0 : Math.PI / 2);
    c.driver = 'parked';
    T.parked.push(c);
  }
  // Pejalan kaki: 36 orang di trotoar.
  for (let i = 0; i < CFG.peds; i++) {
    const p = sidewalkPoint(rng);
    const group = makePersonModel(THREE, rng);
    group.position.set(p.x, 0, p.z);
    W.scene.add(group);
    const tgt = sidewalkPoint(rng);
    T.peds.push({
      group, x: p.x, z: p.z, heading: rng() * Math.PI * 2,
      speed: rr(rng, 0.9, 1.9), tx: tgt.x, tz: tgt.z,
      phase: rng() * 6, flee: 0, fx: 0, fz: 0,
    });
  }
  // Burung: 14 ekor, sayap segitiga mengepak, terbang melingkar.
  const birdMat = new THREE.MeshLambertMaterial({ color: 0x2a2e33, side: THREE.DoubleSide });
  for (let i = 0; i < CFG.birds; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 6), birdMat);
    body.rotation.x = Math.PI / 2; g.add(body);
    const wingGeo = new THREE.PlaneGeometry(1.5, 0.5);
    const wL = new THREE.Mesh(wingGeo, birdMat); wL.position.x = -0.8; g.add(wL);
    const wR = new THREE.Mesh(wingGeo, birdMat); wR.position.x = 0.8; g.add(wR);
    W.scene.add(g);
    T.birds.push({
      group: g, wL, wR, cx: rr(rng, -200, 200), cz: rr(rng, -200, 200),
      r: rr(rng, 20, 60), h: rr(rng, 28, 55), a: rng() * Math.PI * 2,
      speed: rr(rng, 0.12, 0.3) * (chance(rng, 0.5) ? 1 : -1), flap: rng() * 6,
    });
  }
  W.traffic = T;
  return T;
}
export function honk(W, car) {
  const now = W.elapsed;
  if (now - W.traffic.lastHonk < 1.5) return;
  W.traffic.lastHonk = now;
  W.audio.horn();
}
function pedTarget(rng) { return sidewalkPoint(rng); }
export function fleePeds(W, x, z, radius = 14) {
  for (const p of W.traffic.peds) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < radius) {
      p.flee = 3;
      p.fx = (p.x - x) / (d || 1); p.fz = (p.z - z) / (d || 1);
    }
  }
}
export function updateTraffic(W, dt) {
  const T = W.traffic;
  const rng = T.rng || (T.rng = mulberry32(W.seed + 99));
  // --- Mobil traffic ---
  const playerCar = W.player.car;
  for (const t of T.cars) {
    const from = W.city.nodes[t.from], to = W.city.nodes[t.to];
    const edgeLen = Math.hypot(to.x - from.x, to.z - from.z) || 1;
    // Berhenti bila pemain menghalangi di depan.
    let speed = t.speed;
    const px = playerCar ? playerCar.x : W.player.x;
    const pz = playerCar ? playerCar.z : W.player.z;
    const ahead = (to.x - from.x) * (px - t.car.x) + (to.z - from.z) * (pz - t.car.z);
    const distP = Math.hypot(px - t.car.x, pz - t.car.z);
    if (ahead > 0 && distP < 9) {
      speed = 0;
      if (distP < 6) honk(W, t.car);
    }
    t.t += (speed * dt) / edgeLen;
    if (t.t >= 1) {
      t.from = t.to;
      const links = W.city.nodes[t.to].links.filter((l) => l !== t.from);
      t.to = links.length ? pick(rng, links) : W.city.nodes[t.to].links[0];
      t.t = 0;
    }
    const a = W.city.nodes[t.from], b = W.city.nodes[t.to];
    t.car.x = a.x + (b.x - a.x) * t.t;
    t.car.z = a.z + (b.z - a.z) * t.t;
    t.car.heading = Math.atan2(b.x - a.x, b.z - a.z);
    t.car.group.position.set(t.car.x, 0, t.car.z);
    t.car.group.rotation.y = t.car.heading;
    t.car.spin = (t.car.spin || 0) + speed * dt * 2;
    t.car.group.userData.wheels.forEach((w) => { w.rotation.x = t.car.spin; });
  }
  // --- Pejalan kaki ---
  for (const p of T.peds) {
    let tx = p.tx, tz = p.tz, sp = p.speed;
    if (p.flee > 0) {
      p.flee -= dt; tx = p.x + p.fx * 20; tz = p.z + p.fz * 20; sp = 4.2;
    }
    const dx = tx - p.x, dz = tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.5) {
      const nt = pedTarget(rng);
      p.tx = nt.x; p.tz = nt.z;
    } else {
      const want = Math.atan2(dx, dz);
      p.heading += wrapAngle(want - p.heading) * Math.min(1, dt * 5);
      p.x += Math.sin(p.heading) * sp * dt;
      p.z += Math.cos(p.heading) * sp * dt;
      const hit = collideBuildings(W, p.x, p.z, 0.5);
      if (hit) { p.x += hit.x; p.z += hit.z; }
      p.x = clamp(p.x, -305, 305); p.z = clamp(p.z, -305, 305);
      p.phase += dt * sp * 3.2;
      const swing = Math.sin(p.phase) * 0.55;
      const parts = p.group.userData.parts;
      parts.legL.rotation.x = swing; parts.legR.rotation.x = -swing;
      parts.armL.rotation.x = -swing * 0.8; parts.armR.rotation.x = swing * 0.8;
    }
    p.group.position.set(p.x, 0, p.z);
    p.group.rotation.y = p.heading;
  }
  // --- Burung ---
  const isDay = W.hour >= 6 && W.hour < 19;
  for (const b of T.birds) {
    b.group.visible = isDay;
    if (!isDay) continue;
    b.a += b.speed * dt;
    b.flap += dt * 9;
    const bx = b.cx + Math.cos(b.a) * b.r;
    const bz = b.cz + Math.sin(b.a) * b.r;
    b.group.position.set(bx, b.h + Math.sin(b.flap * 0.3) * 1.5, bz);
    b.group.rotation.y = Math.atan2(-Math.sin(b.a) * Math.sign(b.speed), Math.cos(b.a) * Math.sign(b.speed)) + (b.speed > 0 ? 0 : Math.PI);
    const flap = Math.sin(b.flap) * 0.55;
    b.wL.rotation.z = flap; b.wR.rotation.z = -flap;
  }
}
