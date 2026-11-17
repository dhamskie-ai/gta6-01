// City generation: districts, road grid, buildings, palms, lamps, landmarks.
// Draw calls kept low: ground is one canvas-textured plane; buildings, palms,
// lamps, containers and coins are InstancedMesh. Seeded RNG: same city per ?seed=.
import * as THREE from 'three';
import { CONFIG, districtAt } from './config.js';

const STREETS = [];
for (let c = CONFIG.streetMin; c <= CONFIG.streetMax; c += CONFIG.streetStep) STREETS.push(c);

function windowTexture() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#cfcfcf'; g.fillRect(0, 0, 128, 256);
  for (let y = 12; y < 244; y += 22) for (let x = 10; x < 118; x += 22) {
    g.fillStyle = Math.random() < 0.55 ? '#ffd98a' : '#2a3242';
    g.fillRect(x, y, 14, 14);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function textTexture(text, fg, bg) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 64);
  g.fillStyle = fg; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Whole ground plan in one texture: grass, beach, roads, dashes, crossings.
// Canvas x maps world x (-360..340), canvas y maps world z (-310..310).
function groundTexture() {
  const W = 2048, H = 1818;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const X = (x) => ((x + 360) / 700) * W;
  const Z = (z) => ((z + 310) / 620) * H;
  const SX = W / 700, SZ = H / 620;
  g.fillStyle = '#9aa08a'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#e0c98f'; g.fillRect(X(-300), 0, (40) * SX, H); // beach
  g.fillStyle = '#8a7f72'; // plaza
  g.fillRect(X(-30), Z(120), 60 * SX, 60 * SZ);
  for (const s of STREETS) {
    g.fillStyle = '#33363c';
    g.fillRect(X(-300), Z(s - 5), 600 * SX, 10 * SZ);
    g.fillRect(X(s - 5), Z(-300), 10 * SX, 600 * SZ);
    g.fillStyle = '#d8c25a';
    g.fillRect(X(-300), Z(s) - 1, 600 * SX, 2);
    g.fillRect(X(s) - 1, Z(-300), 2, 600 * SZ);
  }
  g.fillStyle = '#e8e8e8';
  for (const sx of [-120, 0, 120]) for (const sz of [-120, 0, 120]) {
    for (let i = -2; i <= 2; i++) g.fillRect(X(sx + i * 2 - 0.6), Z(sz + 3), 1.2 * SX, 8 * SZ);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 1;
  return tex;
}

export function nearestStreetPoint(x, z) {
  let bx = STREETS[0], bz = STREETS[0];
  for (const s of STREETS) { if (Math.abs(s - x) < Math.abs(bx - x)) bx = s; if (Math.abs(s - z) < Math.abs(bz - z)) bz = s; }
  return Math.abs(bx - x) < Math.abs(bz - z) ? { x: bx, z } : { x, z: bz };
}

export function randomRoadPos(rng) {
  const horizontal = rng.chance(0.5);
  const s = rng.pick(STREETS);
  const along = rng.range(CONFIG.streetMin, CONFIG.streetMax);
  const lane = rng.pick([-2.5, 2.5]);
  return horizontal ? { x: along, z: s + lane, axis: 'x', dir: lane > 0 ? 1 : -1 }
                    : { x: s + lane, z: along, axis: 'z', dir: lane > 0 ? 1 : -1 };
}

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
function setInstance(mesh, i, x, y, z, ry, sx, sy, sz) {
  _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry || 0);
  _v.set(x, y, z); _s.set(sx, sy, sz);
  _m4.compose(_v, _q, _s);
  mesh.setMatrixAt(i, _m4);
}

export function buildCity(G) {
  const { scene, rng } = G;
  const city = { buildings: [], lamps: [], lampHeads: [], neonMats: [], ferris: null, coins: [], colliders: [] };
  G.city = city;
  const winTex = windowTexture();

  // Ground (one textured plane) + sea.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 620),
    new THREE.MeshLambertMaterial({ map: groundTexture() }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(-10, 0, 0); ground.receiveShadow = true;
  scene.add(ground);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(220, 620),
    new THREE.MeshLambertMaterial({ color: 0x1f6f9f }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(-410, 0.1, 0); scene.add(sea);

  // Buildings: collect transforms per facade material, then instance them.
  const facadeCols = [0x8a7f72, 0x7d8aa0, 0xa08a6a, 0x6a7d8a, 0x9a6a6a, 0x707a68];
  const mats = facadeCols.map((c) => new THREE.MeshLambertMaterial({ color: c, map: winTex }));
  const perMat = mats.map(() => []);
  const roofs = [];
  for (let bx = -210; bx <= 210; bx += 60) for (let bz = -210; bz <= 210; bz += 60) {
    const d = districtAt(bx, bz);
    if (d.style === 'marina' && bx < -210) continue;
    if (Math.abs(bx) < 30 && Math.abs(bz - 150) < 30) continue; // plaza
    if (Math.abs(bx - 210) < 30 && Math.abs(bz - 90) < 30) continue; // docks yard
    const h = d.style === 'spires' ? rng.range(38, 78)
      : d.style === 'hills' ? rng.range(8, 16)
      : rng.range(10, 26);
    const w = rng.range(26, 40), dep = rng.range(26, 40);
    const mi = Math.floor(rng.next() * mats.length);
    const px = bx + rng.range(-4, 4), pz = bz + rng.range(-4, 4);
    perMat[mi].push({ x: px, z: pz, w, h, d: dep });
    roofs.push({ x: px, z: pz, w: w * 0.5, h, d: dep * 0.5 });
    city.buildings.push({ x: px, z: pz, hw: w / 2, hd: dep / 2, h });
    city.colliders.push({ x: px, z: pz, hw: w / 2 + 0.4, hd: dep / 2 + 0.4 });
    if (d.style === 'spires' && rng.chance(0.5)) {
      perMat[1].push({ x: px + 8, z: pz - 8, w: w * 0.7, h: h * 0.6, d: dep * 0.7 });
      city.buildings.push({ x: px + 8, z: pz - 8, hw: w * 0.35, hd: dep * 0.35, h: h * 0.6 });
      city.colliders.push({ x: px + 8, z: pz - 8, hw: w * 0.35 + 0.4, hd: dep * 0.35 + 0.4 });
    }
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  perMat.forEach((list, mi) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(boxGeo, mats[mi], list.length);
    list.forEach((b, i) => setInstance(im, i, b.x, b.h / 2, b.z, 0, b.w, b.h, b.d));
    im.castShadow = true; im.receiveShadow = true;
    scene.add(im);
  });
  const roofMesh = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x3a3f47 }), roofs.length);
  roofs.forEach((r, i) => setInstance(roofMesh, i, r.x, r.h + 1, r.z, 0, r.w, 2, r.d));
  scene.add(roofMesh);

  // Palm trees (instanced trunk + crown) along the coast and plaza.
  const palmSpots = [];
  for (let z = -240; z <= 240; z += 40) { palmSpots.push([-258, z]); palmSpots.push([-232, z + 20]); }
  for (let x = -180; x <= 180; x += 60) palmSpots.push([x + 14, 150]);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e });
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), trunkMat, palmSpots.length);
  const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(2.6, 3.4, 7), leafMat, palmSpots.length);
  palmSpots.forEach(([px, pz], i) => {
    setInstance(trunks, i, px, 3.5, pz, 0, 1, 1, 1);
    setInstance(crowns, i, px, 8.2, pz, 0, 1, 1, 1);
  });
  trunks.castShadow = true; crowns.castShadow = true;
  scene.add(trunks); scene.add(crowns);

  // Street lamps (instanced pole + head, one shared head material).
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const headShared = new THREE.MeshBasicMaterial({ color: 0x8a8a7a });
  city.lampHeads = [headShared];
  const lampSpots = [];
  for (const s of STREETS) for (const t of [-180, -60, 60, 180]) lampSpots.push([t, s + 6]);
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), poleMat, lampSpots.length);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 8, 6), headShared, lampSpots.length);
  lampSpots.forEach(([px, pz], i) => {
    setInstance(poles, i, px, 3, pz, 0, 1, 1, 1);
    setInstance(heads, i, px, 6.2, pz, 0, 1, 1, 1);
  });
  scene.add(poles); scene.add(heads);

  // Neon signs (emissive at night).
  const neons = [
    { text: 'SOLARA', fg: '#ff5fa2', bg: '#1a0a18', pos: [-258, 14, -60], ry: Math.PI / 2 },
    { text: 'PIER 9', fg: '#4ae3ff', bg: '#06121c', pos: [-286, 8, 24], ry: Math.PI / 2 },
    { text: "MARA'S GARAGE", fg: '#ffd23f', bg: '#14100a', pos: [-60, 7, -24], ry: 0 },
    { text: "CAL'S GUNS", fg: '#7dff9a', bg: '#0a140a', pos: [60, 7, 114], ry: 0 },
    { text: 'SPRAY & SHINE', fg: '#c98aff', bg: '#120a1c', pos: [-60, 7, 36], ry: 0 },
  ];
  for (const n of neons) {
    const m = new THREE.MeshBasicMaterial({ map: textTexture(n.text, n.fg, n.bg) });
    m.color.setScalar(0.35);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), m);
    sign.position.set(n.pos[0], n.pos[1], n.pos[2]); sign.rotation.y = n.ry; scene.add(sign);
    city.neonMats.push(m);
  }

  // Marina pier + ferris wheel.
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x9a7a4a });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(48, 1, 26), woodMat);
  pier.position.set(-322, 1.2, 0); pier.receiveShadow = true; scene.add(pier);
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(11, 0.5, 8, 24), new THREE.MeshLambertMaterial({ color: 0xff5fa2, emissive: 0xff5fa2, emissiveIntensity: 0.5 }));
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.3, 22, 0.3), poleMat);
    spoke.rotation.z = (i * Math.PI) / 8; wheel.add(spoke);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), new THREE.MeshLambertMaterial({ color: [0xffd23f, 0x4ae3ff, 0x7dff9a][i % 3] }));
    const a = (i * Math.PI) / 4;
    cab.position.set(Math.cos(a) * 11, Math.sin(a) * 11, 0); wheel.add(cab);
  }
  const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 14, 0.8), poleMat);
  leg1.position.set(0, -7, 0); leg1.rotation.z = 0.35; wheel.add(leg1);
  const leg2 = leg1.clone(); leg2.rotation.z = -0.35; wheel.add(leg2);
  wheel.position.set(-322, 15, -14);
  wheel.rotation.y = Math.PI / 2; // face the boardwalk (visible from the coastal road)
  scene.add(wheel);
  city.ferris = wheel;

  // Old Solara plaza fountain.
  const basinMat = new THREE.MeshLambertMaterial({ color: 0xb8b0a0 });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 1, 20), basinMat);
  basin.position.set(0, 0.5, 150); scene.add(basin);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.4, 0.3, 20), new THREE.MeshLambertMaterial({ color: 0x3fa8d8 }));
  water.position.set(0, 1, 150); scene.add(water);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 4, 10), basinMat);
  col.position.set(0, 3, 150); scene.add(col);

  // Docks: cranes + containers (instanced per colour).
  const contCols = [0xc23b2e, 0x2e7dc2, 0x3fae5a, 0xd8a02a];
  const contLists = contCols.map(() => []);
  for (let i = 0; i < 14; i++) {
    const cx = 198 + (i % 4) * 8, cz = 60 + Math.floor(i / 4) * 10, cy = 1.3 + Math.floor(i / 4) * 2.7;
    contLists[i % 4].push({ x: cx, y: cy, z: cz });
    city.colliders.push({ x: cx, z: cz, hw: 3.2, hd: 1.5 });
  }
  contLists.forEach((list, ci) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(6, 2.6, 2.6),
      new THREE.MeshLambertMaterial({ color: contCols[ci] }), list.length);
    list.forEach((c, i) => setInstance(im, i, c.x, c.y, c.z, 0, 1, 1, 1));
    im.castShadow = true; scene.add(im);
  });
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xd8a02a });
  for (const cx of [228, 252]) {
    const mast = new THREE.Mesh(new THREE.BoxGeometry(2, 26, 2), craneMat);
    mast.position.set(cx, 13, 120); scene.add(mast);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 40), craneMat);
    arm.position.set(cx, 24, 100); scene.add(arm);
  }

  // Park trees in Calle Verde (instanced).
  const parkSpots = [];
  for (let i = 0; i < 10; i++) parkSpots.push([rng.range(-200, -100), rng.range(160, 230), rng.range(2.2, 3.4)]);
  const parkTrunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.45, 3, 6), trunkMat, parkSpots.length);
  const parkTops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), leafMat, parkSpots.length);
  parkSpots.forEach(([px, pz, r], i) => {
    setInstance(parkTrunks, i, px, 1.5, pz, 0, 1, 1, 1);
    setInstance(parkTops, i, px, 4.5, pz, 0, r, r, r);
  });
  parkTops.castShadow = true;
  scene.add(parkTrunks); scene.add(parkTops);

  // Sun coins: one InstancedMesh, spun per frame in updateCityFx.
  const coinMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.7, 0.7, 0.12, 16),
    new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0xaa7a00, emissiveIntensity: 0.7 }), 30);
  for (let i = 0; i < 30; i++) {
    const p = randomRoadPos(rng);
    const cx = p.x + rng.range(-4, 4), cz = p.z + rng.range(-4, 4);
    city.coins.push({ x: cx, z: cz, taken: false, index: i, spin: rng.range(0, 6) });
  }
  city.coinMesh = coinMesh;
  scene.add(coinMesh);
  G.coins = city.coins;
  return city;
}

// Per-frame city animation: spin sun coins (hide taken ones).
const _e = new THREE.Euler();
export function updateCityFx(G, dt) {
  const city = G.city;
  if (!city || !city.coinMesh) return;
  for (const coin of city.coins) {
    coin.spin += dt * 3;
    if (coin.taken) {
      _m4.makeScale(0, 0, 0);
    } else {
      _e.set(Math.PI / 2, 0, coin.spin);
      _q.setFromEuler(_e);
      _v.set(coin.x, 1.1, coin.z); _s.set(1, 1, 1);
      _m4.compose(_v, _q, _s);
    }
    city.coinMesh.setMatrixAt(coin.index, _m4);
  }
  city.coinMesh.instanceMatrix.needsUpdate = true;
}

// Circle vs building/container AABB: push the point out, report a hit.
export function collideBuildings(G, x, z, r) {
  let hit = false;
  for (const c of G.city.colliders) {
    const dx = x - c.x, dz = z - c.z;
    if (Math.abs(dx) < c.hw + r && Math.abs(dz) < c.hd + r) {
      const px = c.hw + r - Math.abs(dx), pz = c.hd + r - Math.abs(dz);
      if (px < pz) x = c.x + Math.sign(dx || 1) * (c.hw + r);
      else z = c.z + Math.sign(dz || 1) * (c.hd + r);
      hit = true;
    }
  }
  const lim = CONFIG.cityHalf - 6;
  if (x < -lim) { x = -lim; hit = true; } if (x > lim) { x = lim; hit = true; }
  if (z < -lim) { z = -lim; hit = true; } if (z > lim) { z = lim; hit = true; }
  return { x, z, hit };
}
