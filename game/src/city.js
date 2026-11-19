// Generasi kota Solara Bay: 6 distrik, ~110 gedung berfasad HD, jalan
// dengan marka geometri tajam, palem hidup, landmark (dermaga, mercusuar,
// kincir ria, bus, taco truck, jetski), graf jalan untuk traffic AI.
import { mulberry32, rr, ri, pick, chance, clamp } from './random.js';

const AVES = [-240, -160, -80, 0, 80, 160, 240];
const STREETS = [-240, -160, -80, 0, 80, 160, 240];
export const MALECON_X = (z) => -278 + 18 * Math.sin(z * 0.006);

// CanvasTexture dibuat di buildCity (THREE tersedia lewat W.three).
function makeTex(THREE, w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function facadeTex(THREE, kind) {
  return makeTex(THREE, 1024, 1024, (g) => {
    const wall = { shop: '#e8b04b', row: '#d97b5f', tower: '#5a7ba8', ware: '#9a8f7a', villa: '#f2e6d0' }[kind];
    g.fillStyle = wall; g.fillRect(0, 0, 1024, 1024);
    if (kind === 'tower') {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
        const lit = Math.random() < 0.28;
        g.fillStyle = lit ? '#ffd98a' : (Math.random() < 0.5 ? '#2c4a6a' : '#3d6488');
        g.fillRect(20 + x * 124, 20 + y * 62, 104, 44);
        g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(20 + x * 124, 20 + y * 62, 104, 4);
      }
      return;
    }
    if (kind === 'ware') {
      g.fillStyle = 'rgba(0,0,0,.18)';
      for (let x = 0; x < 1024; x += 32) g.fillRect(x, 0, 10, 1024);
      g.fillStyle = '#6a6258';
      g.fillRect(80, 700, 300, 324); g.fillRect(620, 700, 300, 324);
      g.fillStyle = '#3a352e';
      for (let i = 0; i < 5; i++) g.fillRect(100 + i * 56, 720, 8, 300);
      return;
    }
    // shop / row / villa: jendela berbingkai
    const cols = kind === 'villa' ? 4 : 6, rows = kind === 'shop' ? 5 : 8;
    const cw = 1024 / cols, ch = 1024 / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const px = x * cw + cw * 0.2, py = y * ch + ch * 0.2, pw = cw * 0.6, ph = ch * 0.55;
      g.fillStyle = '#f5f0e0'; g.fillRect(px - 6, py - 6, pw + 12, ph + 12);
      const lit = Math.random() < 0.22;
      g.fillStyle = lit ? '#ffe08a' : '#22344a';
      g.fillRect(px, py, pw, ph);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(px, py, pw, 5);
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(px + pw / 2 - 2, py, 4, ph);
    }
    if (kind === 'shop') {
      g.fillStyle = '#2c4a6a'; g.fillRect(0, 830, 1024, 194);
      g.fillStyle = '#ffd25a';
      for (let x = 0; x < 6; x++) g.fillRect(x * 172 + 10, 850, 150, 130);
      g.fillStyle = '#d21f2b';
      for (let x = 0; x < 6; x++) { g.beginPath(); g.moveTo(x * 172 + 10, 830); g.lineTo(x * 172 + 85, 872); g.lineTo(x * 172 + 160, 830); g.fill(); }
    }
    if (kind === 'villa') {
      g.fillStyle = '#b85c38'; g.fillRect(0, 0, 1024, 60);
      g.fillStyle = '#8a4a2a';
      for (let x = 0; x < 1024; x += 48) g.fillRect(x, 0, 20, 60);
    }
  });
}
function groundTex(THREE) {
  return makeTex(THREE, 4096, 4096, (g) => {
    g.fillStyle = '#9aa3a0'; g.fillRect(0, 0, 4096, 4096);
    // blok kota: variasi halus per blok 80 m (512 px)
    for (let bx = 0; bx < 8; bx++) for (let bz = 0; bz < 8; bz++) {
      g.fillStyle = `rgba(${120 + ((bx * 7 + bz * 13) % 40)},${130 + ((bx * 5 + bz * 11) % 30)},${110 + ((bx * 3 + bz * 17) % 25)},.55)`;
      g.fillRect(bx * 512 + 40, bz * 512 + 40, 432, 432);
    }
    // taman Calle Verde + plaza Old Solara: hijau
    g.fillStyle = '#5d8a4a';
    g.fillRect(2688, 3200, 512, 512); g.fillRect(1152, 1152, 512, 512);
    // pantai: pasir di barat (x < -260 m -> px < 384)
    g.fillStyle = '#e8d5a8'; g.fillRect(0, 0, 384, 4096);
    g.fillStyle = '#dfc793'; g.fillRect(300, 0, 84, 4096);
    // bintik pasir + rumput
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.07)';
      g.fillRect(Math.random() * 4096, Math.random() * 4096, 3, 3);
    }
  });
}
function signTex(THREE, text, fg, bg) {
  return makeTex(THREE, 512, 128, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
    g.font = '900 56px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = fg; g.shadowBlur = 22; g.fillStyle = fg;
    g.fillText(text, 256, 66);
  });
}
// Skala UV box supaya jendela selalu berukuran sama (tajam di semua tinggi).
function scaleBoxUV(geo, w, h, d) {
  const uv = geo.attributes.uv, nor = geo.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(nor.getX(i)), nz = Math.abs(nor.getZ(i));
    let su = w / 14, sv = h / 14;
    if (nx > 0.5) su = d / 14; else if (nz > 0.5) su = w / 14;
    if (nor.getY(i) !== 0) { su = w / 14; sv = d / 14; }
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
}
function districtOf(x, z) {
  if (z > 200) return 'docks';
  if (x < -200) return 'marina';
  if (x > 80) return 'spires';
  if (x < -40) return 'oldsolara';
  if (z < -200) return 'vista';
  return 'calle';
}
export function buildCity(W) {
  const THREE = W.three;
  const rng = mulberry32(W.seed);
  const scene = W.scene;
  const city = { colliders: [], nodes: [], spots: {}, palms: [], sunCoins: [], lamps: [], trafficLights: [], signs: [] };
  const groundT = groundTex(THREE);
  groundT.anisotropy = 8;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(640, 640),
    new THREE.MeshLambertMaterial({ map: groundT }),
  );
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  // Laut di barat.
  const seaT = makeTex(THREE, 512, 512, (g) => {
    g.fillStyle = '#1a6a9a'; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 4;
    for (let i = 0; i < 14; i++) {
      g.beginPath();
      for (let x = 0; x <= 512; x += 32) g.lineTo(x, i * 38 + Math.sin(x * 0.03 + i) * 8);
      g.stroke();
    }
  });
  seaT.wrapS = seaT.wrapT = THREE.RepeatWrapping; seaT.repeat.set(3, 5);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(420, 700), new THREE.MeshLambertMaterial({ map: seaT }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(-520, -0.4, 0);
  scene.add(sea); city.sea = sea; city.seaTex = seaT;

  // --- Jalan: aspal + trotoar + marka geometri (instanced, tajam) ---
  const asphalt = new THREE.MeshLambertMaterial({ color: 0x3d434b });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x8f979e });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5e9c8 });
  const zebraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const x of AVES) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(12, 640), asphalt);
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.02, 0); r.receiveShadow = true; scene.add(r);
    for (const s of [-8.5, 8.5]) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(5, 0.18, 640), walkMat);
      sw.position.set(x + s, 0.09, 0); sw.receiveShadow = true; scene.add(sw);
    }
  }
  for (const z of STREETS) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(640, 12), asphalt);
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.02, z); r.receiveShadow = true; scene.add(r);
    for (const s of [-8.5, 8.5]) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(640, 0.18, 5), walkMat);
      sw.position.set(0, 0.09, z + s); sw.receiveShadow = true; scene.add(sw);
    }
  }
  // Garis tengah putus-putus (instanced) + zebra di persimpangan.
  const dashGeo = new THREE.PlaneGeometry(0.35, 3.4);
  const dashes = [];
  for (const x of AVES) for (let z = -300; z <= 300; z += 8) {
    if (STREETS.some((s) => Math.abs(z - s) < 9)) continue;
    dashes.push([x, z, 0]);
  }
  for (const z of STREETS) for (let x = -300; x <= 300; x += 8) {
    if (AVES.some((a) => Math.abs(x - a) < 9)) continue;
    dashes.push([x, z, Math.PI / 2]);
  }
  const dashMesh = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
    dashes.forEach(([x, z, ry], i) => {
      e.set(-Math.PI / 2, 0, ry); q.setFromEuler(e); v.set(x, 0.05, z);
      m.compose(v, q, sc); dashMesh.setMatrixAt(i, m);
    });
  }
  scene.add(dashMesh);
  const zebraGeo = new THREE.PlaneGeometry(1.1, 4.6);
  const zebras = [];
  for (const x of AVES) for (const z of STREETS) {
    for (let i = -2; i <= 2; i++) { zebras.push([x + i * 2.2, z - 7.5, 0]); zebras.push([x + i * 2.2, z + 7.5, 0]); }
  }
  const zebraMesh = new THREE.InstancedMesh(zebraGeo, zebraMat, zebras.length);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
    zebras.forEach(([x, z], i) => {
      e.set(-Math.PI / 2, 0, 0); q.setFromEuler(e); v.set(x, 0.05, z);
      m.compose(v, q, sc); zebraMesh.setMatrixAt(i, m);
    });
  }
  scene.add(zebraMesh);
  // Malecón Celeste: jalan pantai melengkung + boardwalk kayu.
  const malGeo = new THREE.PlaneGeometry(14, 11);
  const malSegs = [];
  for (let z = -300; z <= 300; z += 10) malSegs.push(z);
  const malMesh = new THREE.InstancedMesh(malGeo, asphalt, malSegs.length);
  const boardMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(6, 11),
    new THREE.MeshLambertMaterial({ color: 0xa8825a }), malSegs.length);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
    malSegs.forEach((z, i) => {
      const x = MALECON_X(z);
      const dx = (MALECON_X(z + 5) - MALECON_X(z - 5)) / 10;
      const ry = Math.atan2(dx, 1);
      e.set(-Math.PI / 2, 0, -ry); q.setFromEuler(e);
      v.set(x, 0.02, z); m.compose(v, q, sc); malMesh.setMatrixAt(i, m);
      v.set(x + 11, 0.06, z); m.compose(v, q, sc); boardMesh.setMatrixAt(i, m);
    });
  }
  scene.add(malMesh); scene.add(boardMesh);

  // --- Gedung: fasad 1024², UV diskala per gedung, detail geometri ---
  const facades = {
    shop: facadeTex(THREE, 'shop'), row: facadeTex(THREE, 'row'),
    tower: facadeTex(THREE, 'tower'), ware: facadeTex(THREE, 'ware'),
    villa: facadeTex(THREE, 'villa'),
  };
  for (const t of Object.values(facades)) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Math.min(16, W.renderer.capabilities.getMaxAnisotropy());
  }
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const roofMat2 = new THREE.MeshLambertMaterial({ color: 0x6a5a48 });
  const detailMat = new THREE.MeshLambertMaterial({ color: 0x7a8288 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x2c4a6a, emissive: 0x0a1a2a });
  function addBuilding(x, z, w, h, d, kind) {
    const tex = facades[kind];
    const side = new THREE.MeshLambertMaterial({ map: tex, emissive: 0x2a1f0a, emissiveMap: tex, emissiveIntensity: 0.35 });
    const geo = new THREE.BoxGeometry(w, h, d);
    scaleBoxUV(geo, w, h, d);
    const b = new THREE.Mesh(geo, [side, side, kind === 'villa' ? roofMat2 : roofMat, roofMat, side, side]);
    b.position.set(x, h / 2, z);
    b.castShadow = true; b.receiveShadow = true;
    scene.add(b);
    city.colliders.push({ x, z, hx: w / 2 + 0.4, hz: d / 2 + 0.4 });
    // Detail atap: tangki air + antena + AC.
    if (h > 10) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 10), detailMat);
      tank.position.set(x + w * 0.25, h + 1.1, z); tank.castShadow = true; scene.add(tank);
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 5, 6), detailMat);
      ant.position.set(x - w * 0.3, h + 2.5, z - d * 0.2); scene.add(ant);
    }
    const ac = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1), detailMat);
    ac.position.set(x + w * 0.3, h + 0.45, z + d * 0.2); scene.add(ac);
    if (kind === 'row' || kind === 'shop') {
      // Balkon tipis di lantai 2.
      const bal = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.25, 1.4), detailMat);
      bal.position.set(x, Math.min(6, h * 0.45), z + d / 2 + 0.7); scene.add(bal);
    }
    if (kind === 'tower') {
      const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 2.5, d * 0.5),
        new THREE.MeshLambertMaterial({ color: 0x22344a, emissive: 0x112233 }));
      crown.position.set(x, h + 1.2, z); scene.add(crown);
    }
    return b;
  }
  function nearSpot(x, z, r = 26) {
    return Object.values(city.spots).some((s) => Math.hypot(s.x - x, s.z - z) < r);
  }
  // Spot khusus dulu (dipakai nearSpot saat generate blok).
  city.spots = {
    garage: { x: 56, z: 96 }, marlin: { x: -238, z: 40 }, docks: { x: 200, z: 240 },
    pier: { x: -348, z: 60 }, beach: { x: -282, z: 160 }, raceStart: { x: -262, z: -80 },
    spray: { x: 168, z: -88 }, guns: { x: -88, z: 168 }, taxi: { x: 0, z: 0 },
    fishing: { x: -344, z: 60 }, jetski: { x: -312, z: 100 }, plaza: { x: -120, z: -120 },
    park: { x: 120, z: 160 }, ferry: { x: -260, z: 140 },
  };
  const blockCenters = [];
  for (let bx = -200; bx <= 200; bx += 80) for (let bz = -200; bz <= 200; bz += 80) blockCenters.push([bx, bz]);
  for (const [bx, bz] of blockCenters) {
    const dist = districtOf(bx, bz);
    if ((bx === -120 && bz === -120) || (bx === 120 && bz === 160)) continue; // plaza + taman
    if (nearSpot(bx, bz, 30)) continue;
    if (dist === 'spires') {
      if (chance(rng, 0.75)) addBuilding(bx + rr(rng, -8, 8), bz + rr(rng, -8, 8), rr(rng, 26, 34), rr(rng, 38, 62), rr(rng, 26, 34), 'tower');
      else { addBuilding(bx - 14, bz, 22, rr(rng, 14, 22), 20, 'row'); addBuilding(bx + 14, bz, 22, rr(rng, 14, 22), 20, 'row'); }
    } else if (dist === 'docks') {
      addBuilding(bx - 12, bz, 34, rr(rng, 9, 12), 22, 'ware');
      addBuilding(bx + 16, bz + 6, 22, rr(rng, 8, 11), 18, 'ware');
    } else if (dist === 'vista') {
      addBuilding(bx - 12, bz - 10, 16, 7, 14, 'villa');
      addBuilding(bx + 14, bz + 12, 15, 8, 13, 'villa');
    } else if (dist === 'marina') {
      addBuilding(bx, bz + rr(rng, -6, 6), rr(rng, 20, 28), rr(rng, 8, 12), 18, 'shop');
      if (chance(rng, 0.5)) addBuilding(bx + rr(rng, -14, 14), bz + 18, 14, 7, 12, 'shop');
    } else {
      // Old Solara + Calle Verde: ruko warna-warni 3-4 unit per blok.
      addBuilding(bx - 16, bz - 12, 18, rr(rng, 9, 14), 16, 'row');
      addBuilding(bx + 16, bz - 12, 18, rr(rng, 9, 14), 16, 'row');
      addBuilding(bx - 16, bz + 14, 18, rr(rng, 8, 13), 16, 'row');
      addBuilding(bx + 16, bz + 14, 18, rr(rng, 8, 13), 16, 'row');
    }
  }
  // Gedung khusus: garasi Mara, Marlin Ceviche, Spray & Shine, Cal's Guns.
  addBuilding(56, 96, 26, 9, 20, 'shop');
  addBuilding(-238, 40, 24, 10, 18, 'shop');
  addBuilding(168, -88, 22, 9, 18, 'ware');
  addBuilding(-88, 168, 20, 9, 16, 'shop');

  // --- Papan neon (teks tajam, menyala malam) ---
  function addSign(text, x, y, z, ry, fg = '#ffd25a', bg = '#141024') {
    const tex = signTex(THREE, text, fg, bg);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    m.position.set(x, y, z); m.rotation.y = ry;
    scene.add(m); city.signs.push(m);
  }
  addSign('MARLIN CEVICHE', -238, 8.5, 30, 0, '#7dffd4', '#0a2030');
  addSign("MARA'S GARAGE", 56, 7.5, 86, Math.PI, '#ffd25a', '#141024');
  addSign('SPRAY & SHINE', 168, 7.5, -78, Math.PI, '#ff9de2', '#141024');
  addSign("CAL'S GUNS", -88, 7.5, 159, 0, '#ff8a8a', '#141024');
  addSign('CELESTE 98.1', 160, 46, -62, Math.PI, '#ff9de2', '#101c3a');
  addSign('HOTEL SOLARA', -120, 12, -100, 0, '#7db7ff', '#141024');
  addSign('TACO · TACOS', -268, 4.5, 120, Math.PI / 2, '#ffd25a', '#3a1408');

  // --- Palem HD: batang bersegmen + 8 pelepah + kelapa ---
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const trunkMat2 = new THREE.MeshLambertMaterial({ color: 0x7a5c3e });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f9e4f, side: THREE.DoubleSide });
  const leafMat2 = new THREE.MeshLambertMaterial({ color: 0x37b45c, side: THREE.DoubleSide });
  function makePalm(x, z, s) {
    const g = new THREE.Group();
    const h = 7 * s;
    const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.34 * s, h * 0.55, 7), trunkMat);
    seg1.position.y = h * 0.27; g.add(seg1);
    const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.22 * s, h * 0.5, 7), trunkMat2);
    seg2.position.y = h * 0.78; seg2.rotation.z = 0.06; g.add(seg2);
    // Cincin batang.
    for (let i = 1; i <= 4; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26 * s, 0.045 * s, 5, 10), trunkMat2);
      ring.rotation.x = Math.PI / 2; ring.position.y = h * i * 0.16; g.add(ring);
    }
    const crownY = h * 1.02;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + rr(rng, -0.15, 0.15);
      const frond = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.55 * s, 2.6 * s), j % 2 ? leafMat : leafMat2);
        leaf.position.set((j - 1) * 0.5 * s, 0.4 * s, 0);
        leaf.rotation.x = -0.5 - j * 0.18;
        leaf.rotation.z = (j - 1) * 0.35;
        // Runcingkan ujung: skala ujung via shear sederhana (rotasi).
        frond.add(leaf);
      }
      frond.position.y = crownY;
      frond.rotation.y = a;
      frond.rotation.x = 0.5;
      g.add(frond);
    }
    const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x6a4a22 }));
    nuts.position.y = crownY - 0.4 * s; g.add(nuts);
    g.position.set(x, 0, z);
    g.rotation.y = rr(rng, 0, Math.PI * 2);
    g.scale.setScalar(rr(rng, 0.9, 1.15));
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(g);
    city.palms.push(g);
    return g;
  }
  for (let z = -280; z <= 280; z += 20) makePalm(MALECON_X(z) + 14, z + rr(rng, -4, 4), rr(rng, 0.95, 1.25));
  for (let z = -280; z <= 280; z += 44) makePalm(MALECON_X(z) - 8, z, rr(rng, 0.85, 1.1));
  for (const x of [-160, -80, 0, 80, 160]) for (let z = -200; z <= 200; z += 80) {
    if (chance(rng, 0.6)) makePalm(x + 8.5, z + rr(rng, -30, 30), rr(rng, 0.8, 1.05));
  }
  for (let i = 0; i < 8; i++) makePalm(rr(rng, -295, -265), rr(rng, -260, 260), rr(rng, 0.9, 1.2));
  // Pohon rindang di taman + plaza.
  const shadeMat = new THREE.MeshLambertMaterial({ color: 0x3f7d3a, flatShading: true });
  function shadeTree(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 3.4, 7), trunkMat);
    trunk.position.y = 1.7; g.add(trunk);
    for (let i = 0; i < 3; i++) {
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(rr(rng, 1.8, 2.6), 0), shadeMat);
      ball.position.set(rr(rng, -1.2, 1.2), 3.8 + i * 0.9, rr(rng, -1.2, 1.2));
      ball.castShadow = true; g.add(ball);
    }
    g.position.set(x, 0, z); scene.add(g);
  }
  for (let i = 0; i < 10; i++) shadeTree(rr(rng, 95, 145), rr(rng, 135, 185));
  for (let i = 0; i < 6; i++) shadeTree(rr(rng, -145, -95), rr(rng, -145, -95));

  // --- Lampu jalan, bangku, lampu lalu lintas ---
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2e33 });
  const lampHeadMat = new THREE.MeshLambertMaterial({ color: 0xfff2c0, emissive: 0x000000 });
  for (const x of AVES) for (let z = -240; z <= 240; z += 80) {
    if (chance(rng, 0.7)) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 6), poleMat);
      pole.position.set(x + 8.5, 3, z + 12); scene.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), lampHeadMat.clone());
      head.position.set(x + 8.5, 6.1, z + 12); scene.add(head);
      city.lamps.push(head);
    }
  }
  for (let i = 0; i < 12; i++) {
    const bx = pick(rng, AVES) + 8.5, bz = rr(rng, -240, 240);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x8a5a2a }));
    bench.position.set(bx, 0.45, bz); scene.add(bench);
  }
  for (const [x, z] of [[0, 0], [-80, 80], [80, -80], [-160, -160]]) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5, 6), poleMat);
    pole.position.y = 2.5; g.add(pole);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.4), poleMat);
    box.position.y = 5.2; g.add(box);
    const cols = [0xff2a2a, 0xffc82a, 0x2aff5a];
    const bulbs = cols.map((c, i) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshBasicMaterial({ color: c }));
      b.position.set(0, 5.65 - i * 0.45, 0.25); g.add(b); return b;
    });
    g.position.set(x + 7, 0, z + 7); scene.add(g);
    city.trafficLights.push({ group: g, bulbs, t: rng() * 4 });
  }

  // --- Landmark: dermaga, mercusuar, kincir ria, air mancur ---
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x9a7a52 });
  for (let x = -300; x >= -348; x -= 4) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 10), woodMat);
    plank.position.set(x, 0.6, 60); scene.add(plank);
  }
  const pierEnd = new THREE.Mesh(new THREE.BoxGeometry(16, 0.4, 20), woodMat);
  pierEnd.position.set(-352, 0.6, 60); scene.add(pierEnd);
  city.colliders.push({ x: -352, z: 60, hx: 8, hz: 10 });
  // Mercusuar di ujung utara pantai.
  const lh = new THREE.Group();
  const lhBase = new THREE.Mesh(new THREE.CylinderGeometry(4, 5.5, 26, 12),
    new THREE.MeshLambertMaterial({ color: 0xf2ede0 }));
  lhBase.position.y = 13; lhBase.castShadow = true; lh.add(lhBase);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.7, 4, 12),
    new THREE.MeshLambertMaterial({ color: 0xd21f2b }));
  band.position.y = 16; lh.add(band);
  const lhTop = new THREE.Mesh(new THREE.SphereGeometry(2, 12, 8),
    new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffc82a }));
  lhTop.position.y = 27; lh.add(lhTop);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 3.5, 30, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.28, side: THREE.DoubleSide }));
  beam.rotation.z = Math.PI / 2 - 0.12; beam.position.set(15, 27, 0); lh.add(beam);
  lh.position.set(-296, 0, -262); scene.add(lh);
  city.lighthouse = lh; city.lighthouseBeam = beam; city.lighthouseTop = lhTop;
  city.colliders.push({ x: -296, z: -262, hx: 5, hz: 5 });
  // Kincir ria Marina Bay.
  const fw = new THREE.Group();
  const legMat = new THREE.MeshLambertMaterial({ color: 0x8a94a6 });
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 22, 6), legMat);
    leg.position.set(s * 4, 11, 0); leg.rotation.z = s * 0.25; fw.add(leg);
  }
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(10, 0.45, 8, 28),
    new THREE.MeshLambertMaterial({ color: 0xff5e8a, emissive: 0x40101e }));
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 20, 6), legMat);
    spoke.rotation.z = (i / 8) * Math.PI; wheel.add(spoke);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshLambertMaterial({ color: pick(rng, [0xffd25a, 0x7db7ff, 0xff9de2, 0x7dff9b]) }));
    const a = (i / 8) * Math.PI * 2;
    cab.position.set(Math.cos(a) * 10, Math.sin(a) * 10, 0); wheel.add(cab);
  }
  wheel.position.y = 22; fw.add(wheel);
  fw.position.set(-260, 0, 140); scene.add(fw);
  city.ferrisWheel = wheel;
  city.colliders.push({ x: -260, z: 140, hx: 5, hz: 5 });
  // Air mancur plaza Old Solara.
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.5, 1.2, 16),
    new THREE.MeshLambertMaterial({ color: 0x9aa3a0 }));
  basin.position.set(-120, 0.6, -120); scene.add(basin);
  const water = new THREE.Mesh(new THREE.CircleGeometry(5.4, 16),
    new THREE.MeshLambertMaterial({ color: 0x3fa8d8 }));
  water.rotation.x = -Math.PI / 2; water.position.set(-120, 1.25, -120); scene.add(water);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 3.4, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8d2c0 }));
  col.position.set(-120, 2.4, -120); scene.add(col);
  city.colliders.push({ x: -120, z: -120, hx: 6.5, hz: 6.5 });

  // --- The Docks: kontainer + crane ---
  const contCols = [0xd2602a, 0x2a7bd2, 0x3a9e4f, 0xc2a82a, 0x8a4a9a];
  for (let i = 0; i < 22; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.6),
      new THREE.MeshLambertMaterial({ color: pick(rng, contCols) }));
    const cx = rr(rng, 120, 260), cz = rr(rng, 210, 300);
    c.position.set(cx, 1.3 + (i % 3) * 0.1, cz);
    c.rotation.y = chance(rng, 0.5) ? 0 : Math.PI / 2;
    c.castShadow = true; scene.add(c);
    if (i % 2 === 0) city.colliders.push({ x: cx, z: cz, hx: 3.2, hz: 3.2 });
  }
  for (const cx of [150, 230]) {
    const crane = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.BoxGeometry(3, 30, 3), detailMat);
    mast.position.y = 15; crane.add(mast);
    const jib = new THREE.Mesh(new THREE.BoxGeometry(26, 2, 2), detailMat);
    jib.position.set(8, 29, 0); crane.add(jib);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshLambertMaterial({ color: 0xd21f2b }));
    hook.position.set(18, 24, 0); crane.add(hook);
    crane.position.set(cx, 0, 260); scene.add(crane);
    city.colliders.push({ x: cx, z: 260, hx: 2.5, hz: 2.5 });
  }
  // Kapal di dermaga Docks.
  const ship = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(14, 5, 40),
    new THREE.MeshLambertMaterial({ color: 0x2a4a6a }));
  hull.position.y = 1; ship.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 12),
    new THREE.MeshLambertMaterial({ color: 0xf2ede0 }));
  deck.position.set(0, 5, -12); ship.add(deck);
  ship.position.set(280, -0.5, 240); scene.add(ship);

  // --- Pantai: payung + jetski + perahu Marco ---
  const umbMat = new THREE.MeshLambertMaterial({ color: 0xff5e8a });
  for (let i = 0; i < 6; i++) {
    const ux = rr(rng, -295, -268), uz = rr(rng, 120, 220);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 6), woodMat);
    pole.position.set(ux, 1.5, uz); scene.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.1, 10), i % 2 ? umbMat : new THREE.MeshLambertMaterial({ color: 0x7db7ff }));
    top.position.set(ux, 3.2, uz); scene.add(top);
  }
  city.jetskis = [];
  for (let i = 0; i < 3; i++) {
    const j = new THREE.Group();
    const hullJ = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 2.6),
      new THREE.MeshLambertMaterial({ color: pick(rng, [0xffd25a, 0x2aff5a, 0xff5e8a]) }));
    hullJ.position.y = 0.2; j.add(hullJ);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 1.1),
      new THREE.MeshLambertMaterial({ color: 0x1a1a22 }));
    seat.position.set(0, 0.6, -0.3); j.add(seat);
    j.position.set(-312 + i * 4, 0, 96 + i * 6);
    j.rotation.y = rr(rng, -0.5, 0.5);
    scene.add(j); city.jetskis.push(j);
  }
  // Perahu Marco di ujung dermaga (tujuan Golden Hour).
  const boat = new THREE.Group();
  const boatHull = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 12),
    new THREE.MeshLambertMaterial({ color: 0xf2ede0 }));
  boatHull.position.y = 0.6; boat.add(boatHull);
  const boatTop = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 5),
    new THREE.MeshLambertMaterial({ color: 0x2a7bd2 }));
  boatTop.position.set(0, 2, -1); boat.add(boatTop);
  boat.position.set(-352, 0.2, 78); boat.rotation.y = 0.3;
  scene.add(boat); city.boat = boat;

  // --- Graf jalan (traffic AI) ---
  const nodeIndex = new Map();
  function addNode(x, z) {
    const key = `${Math.round(x)},${Math.round(z)}`;
    if (nodeIndex.has(key)) return nodeIndex.get(key);
    const idx = city.nodes.length;
    city.nodes.push({ x, z, links: [] });
    nodeIndex.set(key, idx);
    return idx;
  }
  function link(a, b) {
    if (a === b) return;
    if (!city.nodes[a].links.includes(b)) city.nodes[a].links.push(b);
    if (!city.nodes[b].links.includes(a)) city.nodes[b].links.push(a);
  }
  const grid = {};
  for (const x of AVES) for (const z of STREETS) grid[`${x},${z}`] = addNode(x, z);
  for (const x of AVES) for (let i = 0; i < STREETS.length - 1; i++) {
    link(grid[`${x},${STREETS[i]}`], grid[`${x},${STREETS[i + 1]}`]);
  }
  for (const z of STREETS) for (let i = 0; i < AVES.length - 1; i++) {
    link(grid[`${AVES[i]},${z}`], grid[`${AVES[i + 1]},${z}`]);
  }
  let prevMal = null;
  for (let z = -280; z <= 280; z += 40) {
    const idx = addNode(MALECON_X(z), z);
    if (prevMal !== null) link(prevMal, idx);
    prevMal = idx;
    if (STREETS.includes(z)) link(idx, grid[`-240,${z}`]);
  }

  // --- Sun coin (30, di trotoar) ---
  const coinMat = new THREE.MeshLambertMaterial({ color: 0xffd25a, emissive: 0x7a5a10 });
  for (let i = 0; i < 30; i++) {
    const coin = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.18, 8, 18), coinMat);
    const cx = pick(rng, AVES) + (chance(rng, 0.5) ? 8.5 : -8.5);
    const cz = rr(rng, -260, 260);
    coin.position.set(cx, 1.1, cz);
    scene.add(coin);
    city.sunCoins.push({ mesh: coin, x: cx, z: cz, taken: false });
  }
  W.city = city;
  return city;
}
// Tabrakan lingkaran vs AABB gedung. Kembalikan dorongan (px, pz) atau null.
export function collideBuildings(W, x, z, r) {
  let px = 0, pz = 0, hit = false;
  for (const c of W.city.colliders) {
    const dx = x - c.x, dz = z - c.z;
    const ox = c.hx + r - Math.abs(dx), oz = c.hz + r - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      hit = true;
      if (ox < oz) px += dx > 0 ? ox : -ox;
      else pz += dz > 0 ? oz : -oz;
    }
  }
  return hit ? { x: px, z: pz } : null;
}
export function nearestNode(W, x, z) {
  let best = 0, bd = Infinity;
  W.city.nodes.forEach((n, i) => {
    const d = (n.x - x) ** 2 + (n.z - z) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
export function onRoad(W, x, z) {
  if (Math.abs(x - MALECON_X(z)) < 8) return true;
  for (const a of AVES) if (Math.abs(x - a) < 7) return true;
  for (const s of STREETS) if (Math.abs(z - s) < 7) return true;
  return false;
}
