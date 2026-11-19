// City generation: districts, road grid, buildings, palms, lamps, neon,
// storefronts, traffic lights, birds, landmarks — plus the new beach
// life: umbrellas, lifeguard tower, bonfire, lighthouse, market stalls,
// jetskis and fishing rods on the pier. Draw calls stay low: ground is
// one canvas-textured plane; buildings, palms, lamps, containers and
import * as THREE from 'three';
import { CONFIG, districtAt } from './config.js';
const STREETS = [];
for (let c = CONFIG.streetMin; c <= CONFIG.streetMax; c += CONFIG.streetStep) STREETS.push(c);
function facadeTextures(base, litRatio, litColor) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512;
  const g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 512);
  const glow = document.createElement('canvas'); glow.width = 256; glow.height = 512;
  const gg = glow.getContext('2d');
  gg.fillStyle = '#000000'; gg.fillRect(0, 0, 256, 512);
  const shade = g.createLinearGradient(0, 0, 256, 0);
  shade.addColorStop(0, 'rgba(0,0,0,0.10)');
  shade.addColorStop(0.5, 'rgba(255,255,255,0.05)');
  shade.addColorStop(1, 'rgba(0,0,0,0.10)');
  g.fillStyle = shade; g.fillRect(0, 0, 256, 512);
  for (let y = 20; y < 486; y += 44) for (let x = 18; x < 232; x += 44) {
    const lit = Math.random() < litRatio;
    g.fillStyle = lit ? litColor : '#4a5a75';
    g.fillRect(x, y, 26, 26);
    if (lit) { gg.fillStyle = litColor; gg.fillRect(x, y, 26, 26); }
  }
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  const glowTex = new THREE.CanvasTexture(glow);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return { map, glow: glowTex };
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
function haloTexture() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function groundTexture(maxAniso) {
  const W = 2048, H = 1818;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const X = (x) => ((x + 360) / 700) * W;
  const Z = (z) => ((z + 310) / 620) * H;
  const SX = W / 700, SZ = H / 620;
  g.fillStyle = '#9aa08a'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#e0c98f'; g.fillRect(X(-300), 0, 40 * SX, H);
  g.fillStyle = '#8a7f72';
  g.fillRect(X(-30), Z(120), 60 * SX, 60 * SZ);
  for (const s of STREETS) {
    g.fillStyle = '#b8b0a0';
    g.fillRect(X(-300), Z(s + 5), 600 * SX, 3 * SZ);
    g.fillRect(X(-300), Z(s - 8), 600 * SX, 3 * SZ);
    g.fillRect(X(s + 5), Z(-300), 3 * SX, 600 * SZ);
    g.fillRect(X(s - 8), Z(-300), 3 * SX, 600 * SZ);
    g.fillStyle = '#3d4149';
    g.fillRect(X(-300), Z(s - 5), 600 * SX, 10 * SZ);
    g.fillRect(X(s - 5), Z(-300), 10 * SX, 600 * SZ);
    g.fillStyle = '#d8c25a';
    g.fillRect(X(-300), Z(s) - 1, 600 * SX, 2);
    g.fillRect(X(s) - 1, Z(-300), 2, 600 * SZ);
    g.fillStyle = '#e8e8e8';
    for (let d = -285; d < 285; d += 12) {
      g.fillRect(X(d), Z(s + 2.5) - 0.7, 6 * SX, 1.4);
      g.fillRect(X(d), Z(s - 2.5) - 0.7, 6 * SX, 1.4);
      g.fillRect(X(s + 2.5) - 0.7, Z(d), 1.4, 6 * SZ);
      g.fillRect(X(s - 2.5) - 0.7, Z(d), 1.4, 6 * SZ);
    }
    g.fillStyle = 'rgba(232,232,232,0.55)';
    g.fillRect(X(-300), Z(s + 4.6) - 0.7, 600 * SX, 1.4);
    g.fillRect(X(-300), Z(s - 4.6) - 0.7, 600 * SX, 1.4);
    g.fillRect(X(s + 4.6) - 0.7, Z(-300), 1.4, 600 * SZ);
    g.fillRect(X(s - 4.6) - 0.7, Z(-300), 1.4, 600 * SZ);
  }
  g.fillStyle = '#2c2f36';
  for (const s of STREETS) for (let d = -240; d <= 240; d += 90) {
    g.beginPath(); g.arc(X(d + 33), Z(s - 2.5), 1.1 * SX, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(X(s - 2.5), Z(d - 21), 1.1 * SX, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = 'rgba(20,20,24,0.35)';
  for (let i = 0; i < 46; i++) {
    const s = STREETS[Math.floor(Math.random() * STREETS.length)];
    let cx = X(-280 + Math.random() * 560), cy = Z(s - 4 + Math.random() * 8);
    if (Math.random() < 0.5) { cx = X(s - 4 + Math.random() * 8); cy = Z(-280 + Math.random() * 560); }
    g.beginPath(); g.moveTo(cx, cy);
    for (let k = 0; k < 4; k++) { cx += (Math.random() - 0.5) * 26; cy += (Math.random() - 0.5) * 26; g.lineTo(cx, cy); }
    g.stroke();
  }
  for (let i = 0; i < 26; i++) {
    const s = STREETS[Math.floor(Math.random() * STREETS.length)];
    const sx = -280 + Math.random() * 560;
    g.fillStyle = 'rgba(15,15,18,0.16)';
    g.beginPath();
    g.ellipse(X(sx), Z(s - 3 + Math.random() * 6), 8 + Math.random() * 14, 5 + Math.random() * 8, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 2600; i++) {
    const s = STREETS[Math.floor(Math.random() * STREETS.length)];
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
    g.fillRect(X(-300 + Math.random() * 600), Z(s - 5 + Math.random() * 10), 2, 2);
  }
  g.fillStyle = '#e8e8e8';
  for (const sx of STREETS) for (const sz of STREETS) {
    for (let i = -2; i <= 2; i++) {
      g.fillRect(X(sx + i * 2 - 0.6), Z(sz + 3), 1.2 * SX, 8 * SZ);
      g.fillRect(X(sx + 3), Z(sz + i * 2 - 0.6), 8 * SX, 1.2 * SZ);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}
export function nearestStreetPoint(x, z) {
  let bx = STREETS[0], bz = STREETS[0];
  for (const s of STREETS) {
    if (Math.abs(s - x) < Math.abs(bx - x)) bx = s;
    if (Math.abs(s - z) < Math.abs(bz - z)) bz = s;
  }
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
function mergeParts(parts) {
  const positions = [], normals = [], uvs = [], colors = [];
  const col = new THREE.Color();
  for (const part of parts) {
    const geo = part.geo.index ? part.geo.toNonIndexed() : part.geo;
    geo.applyMatrix4(part.matrix);
    const pos = geo.attributes.position.array;
    const nor = geo.attributes.normal.array;
    const uv = geo.attributes.uv ? geo.attributes.uv.array : null;
    col.setHex(part.color);
    for (let i = 0; i < pos.length; i += 3) {
      positions.push(pos[i], pos[i + 1], pos[i + 2]);
      normals.push(nor[i], nor[i + 1], nor[i + 2]);
      if (uv) uvs.push(uv[(i / 3) * 2], uv[(i / 3) * 2 + 1]);
      else uvs.push(0, 0);
      colors.push(col.r, col.g, col.b);
    }
    if (geo !== part.geo) geo.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return out;
}
function palmGeometry() {
  const parts = [];
  const dummy = new THREE.Object3D();
  const TRUNK = 0x8a6a42, GREEN_A = 0x2f8f4e, GREEN_B = 0x3aa860, NUT = 0x6a4a26;
  for (let i = 0; i < 3; i++) {
    dummy.position.set(i * 0.34, 1.3 + i * 2.4, 0);
    dummy.rotation.set(0, 0, -0.07 * i);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    parts.push({ geo: new THREE.CylinderGeometry(0.2, 0.34, 2.6, 6), matrix: dummy.matrix.clone(), color: TRUNK });
  }
  const crown = new THREE.Vector3(0.68, 7.4, 0);
  for (let i = 0; i < 10; i++) {
    const long = i < 6;
    const a = (i / 10) * Math.PI * 2 + (long ? 0 : 0.31);
    const len1 = long ? 2.0 : 1.3, len2 = long ? 2.0 : 1.3;
    const base = new THREE.Matrix4().makeTranslation(crown.x, crown.y, crown.z)
      .multiply(new THREE.Matrix4().makeRotationY(-a))
      .multiply(new THREE.Matrix4().makeRotationZ(-0.35));
    const blade1 = new THREE.BoxGeometry(len1, 0.06, 0.4);
    blade1.translate(len1 / 2, 0, 0);
    parts.push({ geo: blade1, matrix: base, color: i % 2 ? GREEN_A : GREEN_B });
    const tip = base.clone()
      .multiply(new THREE.Matrix4().makeTranslation(len1, 0, 0))
      .multiply(new THREE.Matrix4().makeRotationZ(-0.85));
    const blade2 = new THREE.BoxGeometry(len2, 0.06, 0.34);
    blade2.translate(len2 / 2, 0, 0);
    parts.push({ geo: blade2, matrix: tip, color: i % 2 ? GREEN_B : GREEN_A });
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    dummy.position.set(crown.x + Math.cos(a) * 0.5, crown.y - 0.35, crown.z + Math.sin(a) * 0.5);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    parts.push({ geo: new THREE.SphereGeometry(0.28, 8, 6), matrix: dummy.matrix.clone(), color: NUT });
  }
  return mergeParts(parts);
}
function jetskiGroup(color) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 2.6),
    new THREE.MeshLambertMaterial({ color }));
  hull.position.y = 0.25; g.add(hull);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.7),
    new THREE.MeshLambertMaterial({ color: 0x1a2028 }));
  nose.position.set(0, 0.35, 1.4); g.add(nose);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 1.0),
    new THREE.MeshLambertMaterial({ color: 0x222222 }));
  seat.position.set(0, 0.55, -0.4); g.add(seat);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.08),
    new THREE.MeshLambertMaterial({ color: 0x222222 }));
  bar.position.set(0, 0.85, 0.7); g.add(bar);
  return g;
}
export function buildCity(G) {
  const { scene, rng } = G;
  const city = {
    buildings: [], lamps: [], lampHeads: [], neonMats: [], neonHalos: [],
    ferris: null, coins: [], colliders: [], trafficLights: [], birds: [],
    lighthouse: null, bonfire: null, jetskis: [],
  };
  G.city = city;
  const facadeTexs = [
    facadeTextures('#cfcfcf', 0.62, '#ffd98a'),
    facadeTextures('#b8c4d0', 0.5, '#ffb36a'),
    facadeTextures('#d8cbb0', 0.72, '#ff9a5a'),
    facadeTextures('#e0d8c8', 0.45, '#ffe9b0'),
    facadeTextures('#9aa8b8', 0.58, '#ffc27a'),
    facadeTextures('#c8b8a0', 0.66, '#ffab5e'),
  ];
  const maxAniso = G.renderer ? G.renderer.capabilities.getMaxAnisotropy() : 4;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 620),
    new THREE.MeshLambertMaterial({ map: groundTexture(maxAniso) }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(-10, 0, 0); ground.receiveShadow = true;
  scene.add(ground);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(220, 620),
    new THREE.MeshLambertMaterial({ color: 0x1f6f9f }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(-410, 0.1, 0); scene.add(sea);
  G._seaMat = sea.material;
  const facadeCols = [0x8a7f72, 0x7d8aa0, 0xa08a6a, 0x87a0b2, 0x9a6a6a, 0x9aa39b];
  const mats = facadeCols.map((c, i) => new THREE.MeshLambertMaterial({
    color: c, map: facadeTexs[i].map,
    emissiveMap: facadeTexs[i].glow, emissive: 0xffffff, emissiveIntensity: 0.12,
  }));
  const perMat = mats.map(() => []);
  const roofs = [];
  for (let bx = -210; bx <= 210; bx += 60) for (let bz = -210; bz <= 210; bz += 60) {
    const d = districtAt(bx, bz);
    if (d.style === 'marina' && bx < -210) continue;
    if (Math.abs(bx) < 30 && Math.abs(bz - 150) < 30) continue;
    if (Math.abs(bx - 210) < 30 && Math.abs(bz - 90) < 30) continue;
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
  const acSpots = [], towerSpots = [], antennaSpots = [];
  for (const r of roofs) {
    if (rng.chance(0.55)) acSpots.push([r.x + rng.range(-r.w / 2, r.w / 2), r.h + 2.45, r.z + rng.range(-r.d / 2, r.d / 2)]);
    if (r.h > 30 && rng.chance(0.5)) towerSpots.push([r.x, r.h + 2, r.z]);
    if (rng.chance(0.22)) antennaSpots.push([r.x + rng.range(-r.w / 2, r.w / 2), r.h + 2, r.z + rng.range(-r.d / 2, r.d / 2)]);
  }
  if (acSpots.length) {
    const acMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.9, 1.6),
      new THREE.MeshLambertMaterial({ color: 0x8a8f96 }), acSpots.length);
    acSpots.forEach(([px, py, pz], i) => setInstance(acMesh, i, px, py, pz, 0, 1, 1, 1));
    scene.add(acMesh);
  }
  if (towerSpots.length) {
    const tankMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.3, 1.3, 2.2, 10),
      new THREE.MeshLambertMaterial({ color: 0x7a5a3a }), towerSpots.length);
    const capMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 1.1, 10),
      new THREE.MeshLambertMaterial({ color: 0x5a4230 }), towerSpots.length);
    towerSpots.forEach(([px, py, pz], i) => {
      setInstance(tankMesh, i, px, py + 1.1, pz, 0, 1, 1, 1);
      setInstance(capMesh, i, px, py + 2.75, pz, 0, 1, 1, 1);
    });
    scene.add(tankMesh); scene.add(capMesh);
  }
  if (antennaSpots.length) {
    const antMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.1, 5, 5),
      new THREE.MeshLambertMaterial({ color: 0x3a3f47 }), antennaSpots.length);
    antennaSpots.forEach(([px, py, pz], i) => setInstance(antMesh, i, px, py + 2.5, pz, 0, 1, 1, 1));
    scene.add(antMesh);
  }
  const palmSpots = [];
  for (let z = -240; z <= 240; z += 40) { palmSpots.push([-258, z]); }
  for (let z = -240; z <= 240; z += 60) { palmSpots.push([-232, z + 30]); }
  for (let x = -180; x <= 180; x += 60) palmSpots.push([x + 14, 150]);
  for (let x = -240; x <= 240; x += 36) { palmSpots.push([x, 8]); palmSpots.push([x, -8]); }
  for (let z = -240; z <= 240; z += 36) { palmSpots.push([8, z]); palmSpots.push([-8, z]); }
  const palmGeo = palmGeometry();
  const palmMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const palms = new THREE.InstancedMesh(palmGeo, palmMat, palmSpots.length);
  palmSpots.forEach(([px, pz], i) => {
    setInstance(palms, i, px, 0, pz, rng.range(0, Math.PI * 2), rng.range(0.9, 1.25), rng.range(0.9, 1.25), rng.range(0.9, 1.25));
  });
  palms.castShadow = true;
  scene.add(palms);
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
  const haloTex = haloTexture();
  const neons = [
    { text: 'SOLARA', fg: '#ff5fa2', bg: '#1a0a18', pos: [-258, 14, -60], ry: Math.PI / 2 },
    { text: 'PIER 9', fg: '#4ae3ff', bg: '#06121c', pos: [-286, 8, 24], ry: Math.PI / 2 },
    { text: "MARA'S GARAGE", fg: '#ffd23f', bg: '#14100a', pos: [-60, 7, -24], ry: 0 },
    { text: "CAL'S GUNS", fg: '#7dff9a', bg: '#0a140a', pos: [60, 7, 114], ry: 0 },
    { text: 'SPRAY & SHINE', fg: '#c98aff', bg: '#120a1c', pos: [-60, 7, 36], ry: 0 },
    { text: 'FLAMINGO FM', fg: '#ff5fa2', bg: '#1a0a18', pos: [-252, 16, 120], ry: Math.PI },
    { text: 'VICE HOTEL', fg: '#4ae3ff', bg: '#06121c', pos: [30, 12, 96], ry: 0 },
    { text: 'TACOS 24H', fg: '#ffd23f', bg: '#14100a', pos: [-30, 8, 132], ry: 0 },
  ];
  for (const n of neons) {
    const m = new THREE.MeshBasicMaterial({ map: textTexture(n.text, n.fg, n.bg) });
    m.color.setScalar(0.35);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), m);
    sign.position.set(n.pos[0], n.pos[1], n.pos[2]); sign.rotation.y = n.ry; scene.add(sign);
    city.neonMats.push(m);
    const nx = Math.sin(n.ry), nz = Math.cos(n.ry);
    const haloMat = new THREE.MeshBasicMaterial({
      map: haloTex, color: new THREE.Color(n.fg), transparent: true, opacity: 0.12,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(26, 9), haloMat);
    halo.position.set(n.pos[0] - nx * 0.2, n.pos[1], n.pos[2] - nz * 0.2);
    halo.rotation.y = n.ry;
    scene.add(halo);
    city.neonHalos.push(haloMat);
  }
  const shopSigns = [
    ['TACOS', '#ffd23f', '#3a1a08'], ['DONUTS', '#ff9ad5', '#2a0a1e'],
    ['BAR', '#7dff9a', '#0a140a'], ['HOTEL', '#4ae3ff', '#06121c'],
    ['PIZZA', '#ff8a3d', '#1c0e06'], ['24H MART', '#c98aff', '#120a1c'],
  ];
  let shopCount = 0;
  const awningSpots = [];
  for (const b of city.buildings) {
    if (shopCount >= 22) break;
    if (!rng.chance(0.35)) continue;
    const [text, fg, bg] = shopSigns[shopCount % shopSigns.length];
    const south = rng.chance(0.5);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 2),
      new THREE.MeshBasicMaterial({ map: textTexture(text, fg, bg) }),
    );
    sign.position.set(b.x, 2.6, b.z + (south ? b.hd + 0.15 : -b.hd - 0.15));
    sign.rotation.y = south ? 0 : Math.PI;
    scene.add(sign);
    awningSpots.push({
      x: b.x, z: b.z + (south ? b.hd + 0.7 : -b.hd - 0.7),
      ry: south ? 0 : Math.PI, color: bg,
    });
    shopCount++;
  }
  if (awningSpots.length) {
    const awnMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(8.6, 0.18, 1.5),
      new THREE.MeshLambertMaterial({ color: 0xffffff }), awningSpots.length);
    awningSpots.forEach((a, i) => {
      setInstance(awnMesh, i, a.x, 3.9, a.z, a.ry, 1, 1, 1);
      awnMesh.setColorAt(i, new THREE.Color(a.color));
    });
    if (awnMesh.instanceColor) awnMesh.instanceColor.needsUpdate = true;
    scene.add(awnMesh);
  }
  for (let li = 0; li < 4; li++) {
    const [ix, iz] = [[0, 0], [120, -120], [-120, 120], [120, 120]][li];
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 5.5, 6), poleMat);
    pole.position.set(ix + 6.5, 2.75, iz + 6.5); scene.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 5), poleMat);
    arm.position.set(ix + 6.5, 5.4, iz + 4); scene.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.7, 0.5), poleMat);
    head.position.set(ix + 6.5, 4.6, iz + 1.8); scene.add(head);
    const dotGeo = new THREE.SphereGeometry(0.2, 8, 6);
    const red = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0x550000 }));
    const amber = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0x554400 }));
    const green = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0x00aa33 }));
    red.position.set(ix + 6.5, 5.15, iz + 2.1);
    amber.position.set(ix + 6.5, 4.6, iz + 2.1);
    green.position.set(ix + 6.5, 4.05, iz + 2.1);
    scene.add(red); scene.add(amber); scene.add(green);
    city.trafficLights.push({ red, amber, green, offset: li * 2.3 });
  }
  const wingMat = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide });
  for (let i = 0; i < 8; i++) {
    const bird = new THREE.Group();
    const wingGeo = new THREE.PlaneGeometry(1.3, 0.4);
    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.x = -0.65;
    const wingR = new THREE.Mesh(wingGeo, wingMat);
    wingR.position.x = 0.65;
    bird.add(wingL); bird.add(wingR);
    bird.scale.setScalar(rng.range(0.8, 1.5));
    scene.add(bird);
    city.birds.push({
      group: bird, wingL, wingR,
      cx: rng.range(-120, 120), cz: rng.range(-120, 120),
      radius: rng.range(60, 160), height: rng.range(55, 90),
      speed: rng.range(0.05, 0.12), phase: rng.range(0, Math.PI * 2),
    });
  }
  const hydrantSpots = [], binSpots = [], planterSpots = [], benchSpots = [];
  for (const s of STREETS) {
    for (let t = -240; t <= 240; t += 45) {
      const side = rng.chance(0.5) ? 7.4 : -7.4;
      const roll = rng.next();
      if (roll < 0.10) hydrantSpots.push([t, s + side, 0]);
      else if (roll < 0.16) binSpots.push([t, s + side, 0]);
      else if (roll < 0.20) planterSpots.push([t, s + side, 0]);
      const side2 = rng.chance(0.5) ? 7.4 : -7.4;
      const roll2 = rng.next();
      if (roll2 < 0.08) hydrantSpots.push([s + side2, t, 1]);
      else if (roll2 < 0.14) binSpots.push([s + side2, t, 1]);
      else if (roll2 < 0.17) planterSpots.push([s + side2, t, 1]);
    }
  }
  for (let i = 0; i < 10; i++) benchSpots.push([-250 + rng.range(-4, 4), -198 + i * 44, Math.PI / 2]);
  for (let i = 0; i < 6; i++) benchSpots.push([-18 + i * 7, 138, Math.PI]);
  const propMesh = (geo, color, spots, y, sy = 1) => {
    if (!spots.length) return;
    const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color }), spots.length);
    spots.forEach(([px, pz, ry], i) => setInstance(m, i, px, y, pz, ry, 1, sy, 1));
    m.castShadow = true;
    scene.add(m);
  };
  propMesh(new THREE.CylinderGeometry(0.22, 0.28, 0.9, 8), 0xc23b2e, hydrantSpots, 0.45);
  propMesh(new THREE.SphereGeometry(0.24, 8, 6), 0xc23b2e, hydrantSpots, 0.95);
  propMesh(new THREE.CylinderGeometry(0.34, 0.28, 0.9, 8), 0x2a4a3a, binSpots, 0.45);
  propMesh(new THREE.BoxGeometry(1.3, 0.7, 1.3), 0xa8623a, planterSpots, 0.35);
  propMesh(new THREE.SphereGeometry(0.75, 8, 6), 0x3aa860, planterSpots, 1.0, 0.7);
  propMesh(new THREE.BoxGeometry(2.0, 0.14, 0.6), 0x9a7a4a, benchSpots, 0.5);
  const benchBackSpots = benchSpots.map(([px, pz, ry]) => [
    px - Math.sin(ry) * 0.26, pz - Math.cos(ry) * 0.26, ry,
  ]);
  propMesh(new THREE.BoxGeometry(2.0, 0.55, 0.12), 0x9a7a4a, benchBackSpots, 0.85);
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
  wheel.rotation.y = Math.PI / 2;
  scene.add(wheel);
  city.ferris = wheel;
  const basinMat = new THREE.MeshLambertMaterial({ color: 0xb8b0a0 });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 1, 20), basinMat);
  basin.position.set(0, 0.5, 150); scene.add(basin);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.4, 0.3, 20), new THREE.MeshLambertMaterial({ color: 0x3fa8d8 }));
  water.position.set(0, 1, 150); scene.add(water);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 4, 10), basinMat);
  col.position.set(0, 3, 150); scene.add(col);
  const stallGoods = [0xff5a3c, 0xffd23f, 0x3fae5a, 0x4ae3ff];
  const stallNames = ['FRUIT', 'FLOWERS', 'FISH', 'BREAD'];
  for (let i = 0; i < 4; i++) {
    const sx = i < 2 ? -24 : 24, sz = i % 2 === 0 ? 132 : 168;
    const stall = new THREE.Group();
    const counter = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 2),
      new THREE.MeshLambertMaterial({ color: 0x8a6a42 }));
    counter.position.y = 0.5; stall.add(counter);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.15, 2.6),
      new THREE.MeshLambertMaterial({ color: stallGoods[i] }));
    awn.position.y = 2.6; stall.add(awn);
    for (let k = 0; k < 3; k++) {
      const good = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7),
        new THREE.MeshLambertMaterial({ color: stallGoods[(i + k) % 4] }));
      good.position.set(-1.2 + k * 1.2, 1.3, 0); stall.add(good);
    }
    const label = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.9),
      new THREE.MeshBasicMaterial({ map: textTexture(stallNames[i], '#ffffff', '#20242b') }));
    label.position.set(0, 2.1, 1.15); stall.add(label);
    stall.position.set(sx, 0, sz);
    stall.rotation.y = sz < 150 ? 0 : Math.PI;
    scene.add(stall);
  }
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
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e });
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
  const umbrellaCols = [0xff5a3c, 0xffd23f, 0x4ae3ff, 0xff5fa2];
  const umbSpots = [];
  for (let z = -200; z <= 200; z += 40) umbSpots.push([-282, z + 8]);
  const umbPoles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), poleMat, umbSpots.length);
  const umbTops = new THREE.InstancedMesh(new THREE.ConeGeometry(2.2, 1.0, 8),
    new THREE.MeshLambertMaterial({ color: 0xffffff }), umbSpots.length);
  umbSpots.forEach(([px, pz], i) => {
    setInstance(umbPoles, i, px, 1.3, pz, 0, 1, 1, 1);
    setInstance(umbTops, i, px, 3.0, pz, 0, 1, 1, 1);
    umbTops.setColorAt(i, new THREE.Color(umbrellaCols[i % umbrellaCols.length]));
  });
  if (umbTops.instanceColor) umbTops.instanceColor.needsUpdate = true;
  scene.add(umbPoles); scene.add(umbTops);
  const towelCols = [0xff5fa2, 0x4ae3ff, 0xffd23f, 0x7dff9a];
  const towelSpots = umbSpots.filter((_, i) => i % 2 === 0).map(([px, pz]) => [px + 3, pz + 3]);
  const towels = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.06, 0.9),
    new THREE.MeshLambertMaterial({ color: 0xffffff }), towelSpots.length);
  towelSpots.forEach(([px, pz], i) => {
    setInstance(towels, i, px, 0.05, pz, rng.range(0, Math.PI), 1, 1, 1);
    towels.setColorAt(i, new THREE.Color(towelCols[i % towelCols.length]));
  });
  if (towels.instanceColor) towels.instanceColor.needsUpdate = true;
  scene.add(towels);
  const tower = new THREE.Group();
  const legMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
  for (const [lx, lz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.4, 0.25), legMat);
    leg.position.set(lx, 1.7, lz); tower.add(leg);
  }
  const platform = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 2.6), legMat);
  platform.position.y = 3.5; tower.add(platform);
  const chair = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xff5a3c }));
  chair.position.set(0, 4.1, -0.4); tower.add(chair);
  const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(2.0, 0.9, 4),
    new THREE.MeshLambertMaterial({ color: 0xff5a3c }));
  towerRoof.position.y = 5.4; towerRoof.rotation.y = Math.PI / 4; tower.add(towerRoof);
  tower.position.set(-288, 0, -60);
  scene.add(tower);
  const fire = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x6a6a6a }));
    stone.position.set(Math.cos(a) * 1.1, 0.15, Math.sin(a) * 1.1);
    fire.add(stone);
  }
  for (const rz of [0.5, -0.5]) {
    const log = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.18),
      new THREE.MeshLambertMaterial({ color: 0x5a3a1a }));
    log.position.y = 0.3; log.rotation.y = rz; fire.add(log);
  }
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTex, color: 0xff8822, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  flame.scale.set(2.2, 3.0, 1);
  flame.position.y = 1.1;
  fire.add(flame);
  const fireLight = new THREE.PointLight(0xff8822, 12, 22, 1.6);
  fireLight.position.y = 1.6;
  fire.add(fireLight);
  fire.position.set(-280, 0, 60);
  scene.add(fire);
  city.bonfire = { flame, light: fireLight };
  const light = new THREE.Group();
  const stripeCols = [0xf2f2e8, 0xc23b2e, 0xf2f2e8, 0xc23b2e, 0xf2f2e8];
  for (let i = 0; i < 5; i++) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(2.6 - i * 0.18, 2.8 - i * 0.18, 3.4, 12),
      new THREE.MeshLambertMaterial({ color: stripeCols[i] }));
    band.position.y = 1.7 + i * 3.4; light.add(band);
  }
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 2.2, 10),
    new THREE.MeshLambertMaterial({ color: 0x2c2f36 }));
  lampRoom.position.y = 19.5; light.add(lampRoom);
  const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0 }));
  lampBulb.position.y = 19.5; light.add(lampBulb);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(4.5, 34, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffe9a0, transparent: true, opacity: 0.12,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
  beam.rotation.z = Math.PI / 2;
  beam.position.set(17, 19.5, 0);
  const beamPivot = new THREE.Group();
  beamPivot.position.y = 19.5;
  beamPivot.add(beam);
  beam.position.set(17, 0, 0);
  light.add(beamPivot);
  light.position.set(-340, 0, -150);
  scene.add(light);
  city.lighthouse = { group: light, beam: beamPivot, bulb: lampBulb };
  for (const [jx, jz, jc] of [[-352, 24, 0x4ae3ff], [-358, -30, 0xff5fa2]]) {
    const ski = jetskiGroup(jc);
    ski.position.set(jx, 0.15, jz);
    ski.rotation.y = rng.range(0, Math.PI * 2);
    scene.add(ski);
    city.jetskis.push({ group: ski, phase: rng.range(0, 6), baseY: 0.15 });
  }
  const rodMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  for (const [rx, rz] of [[-344, -8], [-344, 2], [-344, 10]]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 3.4, 5), rodMat);
    rod.position.set(rx, 2.6, rz);
    rod.rotation.z = 0.5;
    scene.add(rod);
  }
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
  const bonusMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9),
    new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0xaa7a00, emissiveIntensity: 0.9 }),
  );
  bonusMesh.visible = false;
  scene.add(bonusMesh);
  G._bonus = { mesh: bonusMesh, x: 0, z: 0, active: false, timer: 8, spin: 0 };
  return city;
}
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
  for (const light of city.trafficLights) {
    const ph = (G.time + light.offset) % 9;
    const state = ph < 4 ? 'green' : ph < 5 ? 'amber' : 'red';
    light.red.material.color.setHex(state === 'red' ? 0xff2222 : 0x550000);
    light.amber.material.color.setHex(state === 'amber' ? 0xffaa00 : 0x554400);
    light.green.material.color.setHex(state === 'green' ? 0x22ff66 : 0x003311);
  }
  for (const bird of city.birds) {
    const a = bird.phase + G.time * bird.speed;
    bird.group.position.set(
      bird.cx + Math.cos(a) * bird.radius,
      bird.height + Math.sin(G.time * 0.5 + bird.phase) * 3,
      bird.cz + Math.sin(a) * bird.radius,
    );
    bird.group.rotation.y = -a;
    const flap = Math.sin(G.time * 6 + bird.phase) * 0.55;
    bird.wingL.rotation.z = 0.25 + flap;
    bird.wingR.rotation.z = -0.25 - flap;
  }
  if (city.lighthouse) {
    city.lighthouse.beam.rotation.y += dt * 0.5;
    const night = G.timeOfDay < 6 || G.timeOfDay >= 20;
    city.lighthouse.bulb.material.color.setHex(night ? 0xffe9a0 : 0x8a7a5a);
  }
  if (city.bonfire) {
    const f = 0.85 + Math.sin(G.time * 9) * 0.1 + Math.sin(G.time * 23) * 0.05;
    city.bonfire.flame.scale.set(2.2 * f, 3.0 * f, 1);
    city.bonfire.light.intensity = 10 + Math.sin(G.time * 9) * 3;
  }
  for (const ski of city.jetskis) {
    ski.group.position.y = ski.baseY + Math.sin(G.time * 1.4 + ski.phase) * 0.18;
    ski.group.rotation.z = Math.sin(G.time * 1.1 + ski.phase) * 0.06;
  }
  if (G._seaMat) {
    const s = 0.5 + Math.sin(G.time * 0.7) * 0.08;
    G._seaMat.color.setHex(0x1f6f9f).multiplyScalar(s + 0.5);
  }
  const bonus = G._bonus;
  if (bonus) {
    if (bonus.active) {
      bonus.spin += dt * 2.5;
      bonus.mesh.rotation.y = bonus.spin;
      bonus.mesh.position.y = 1.3 + Math.sin(G.time * 3) * 0.25;
      if (G.phase === 'play' && Math.hypot(G.player.pos.x - bonus.x, G.player.pos.z - bonus.z) < 2.6) {
        bonus.active = false;
        bonus.mesh.visible = false;
        bonus.timer = 40;
        G.player.cash += 25;
        G.hud.toast('Street bonus +$25');
        G.audio.pickup();
      }
    } else if (G.phase === 'play') {
      bonus.timer -= dt;
      if (bonus.timer <= 0) {
        const spot = randomRoadPos(G.rng);
        bonus.x = spot.x; bonus.z = spot.z;
        bonus.mesh.position.set(bonus.x, 1.3, bonus.z);
        bonus.mesh.visible = true;
        bonus.active = true;
      }
    }
  }
}
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
