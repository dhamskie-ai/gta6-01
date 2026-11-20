// City generation: ground texture, geometry road markings, buildings,
// palms, shade trees, props, colliders, districts.
import * as THREE from 'three';
import { CFG, SIGNS, NEON_BIG } from './config.js';

const WORLD = 640, PX = 4096, S = PX / WORLD; // 6.4 px/m
const px = (v) => (v + 320) * S;
function rect(ctx, x0, z0, x1, z1, fill) {
  ctx.fillStyle = fill; ctx.fillRect(px(x0), px(z0), (x1 - x0) * S, (z1 - z0) * S);
}
export function isOnRoad(x, z) {
  for (const r of CFG.roads) {
    if (Math.abs(x - r) < 11 || Math.abs(z - r) < 11) return true;
  }
  if (Math.abs(x - 312) < 11 || Math.abs(z - 312) < 11) return true;
  if (Math.abs(x + 258) < 7) return true;
  return false;
}
export function collideCircle(G, x, z, r) {
  if (Math.abs(x) > 318 - r || Math.abs(z) > 318 - r) return true;
  for (const c of G.colliders) {
    if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return true;
  }
  return false;
}
function groundTexture(G) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 4096;
  const ctx = cv.getContext('2d');
  const R = G.rng;
  ctx.fillStyle = '#8a9a72'; ctx.fillRect(0, 0, 4096, 4096);
  // City blocks: varied tints.
  const tints = ['#93a07a', '#8b9a78', '#9aa37e', '#878f74', '#a39a7c', '#8f9a80'];
  const centers = [-288, -180, -60, 60, 180, 288];
  for (const cx of centers) for (const cz of centers) {
    rect(ctx, cx - 53, cz - 53, cx + 53, cz + 53, R.pick(tints));
  }
  // Sea + sand west.
  const sea = ctx.createLinearGradient(px(-320), 0, px(-300), 0);
  sea.addColorStop(0, '#1d6f8e'); sea.addColorStop(1, '#2f8fb0');
  rect(ctx, -320, -320, -300, 320, '#2f8fb0');
  ctx.fillStyle = sea; ctx.fillRect(0, 0, px(-300), 4096);
  rect(ctx, -300, -320, -252, 320, '#d9c08a');
  rect(ctx, -302, -320, -300, 320, '#efe6c8');
  // Docks + plaza ground.
  rect(ctx, 246, -320, 320, 320, '#8b8578');
  rect(ctx, 96, 96, 168, 168, '#9a938a');
  // Sidewalks then asphalt for grid roads.
  for (const r of CFG.roads) {
    rect(ctx, r - 11, -320, r + 11, 320, '#b8b0a0');
    rect(ctx, -320, r - 11, 320, r + 11, '#b8b0a0');
  }
  for (const r of CFG.ringRoads) {
    rect(ctx, r - 11, -320, r + 11, 320, '#b8b0a0');
    rect(ctx, -320, r - 11, 320, r + 11, '#b8b0a0');
  }
  rect(ctx, -263, -320, -253, 320, '#c8b898'); // promenade paving
  for (const r of CFG.roads) {
    rect(ctx, r - 7, -320, r + 7, 320, '#3d434b');
    rect(ctx, -320, r - 7, 320, r + 7, '#3d434b');
  }
  for (const r of CFG.ringRoads) {
    rect(ctx, r - 7, -320, r + 7, 320, '#3d434b');
    rect(ctx, -320, r - 7, 320, r + 7, '#3d434b');
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = Math.min(16, G.renderer.capabilities.getMaxAnisotropy());
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function facadeTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1024;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#c9bda8'; ctx.fillRect(0, 0, 1024, 1024);
  const cols = 8, rows = 12, cw = 1024 / cols, ch = 1024 / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const lit = Math.random() < 0.22;
    ctx.fillStyle = lit ? '#ffd98a' : (Math.random() < 0.5 ? '#2c3e55' : '#3a4a63');
    ctx.fillRect(i * cw + 14, j * ch + 12, cw - 28, ch - 24);
    ctx.strokeStyle = 'rgba(60,50,40,0.7)'; ctx.lineWidth = 4;
    ctx.strokeRect(i * cw + 14, j * ch + 12, cw - 28, ch - 24);
    if (j === rows - 1) { ctx.fillStyle = '#5a4a3a'; ctx.fillRect(i * cw + 8, j * ch + 40, cw - 16, ch - 40); }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function scaledBox(w, h, d, mat) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, rx = Math.max(1, w / 9), ry = Math.max(1, h / 9);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rx, uv.getY(i) * ry);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function addCollider(G, x0, z0, x1, z1) { G.colliders.push({ x0, z0, x1, z1 }); }
export function buildCity(G) {
  const R = G.rng, scene = G.scene;
  G.colliders = [];
  // Ground.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(640, 640),
    new THREE.MeshLambertMaterial({ map: groundTexture(G) }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  // Road markings as geometry InstancedMesh (dash / edge / zebra).
  const dashG = new THREE.PlaneGeometry(3, 0.35);
  const edgeG = new THREE.PlaneGeometry(6, 0.18);
  const zebG = new THREE.PlaneGeometry(0.65, 3.4);
  const dashM = new THREE.MeshBasicMaterial({ color: 0xffd23d });
  const whiteM = new THREE.MeshBasicMaterial({ color: 0xf2f2ea });
  const dashPos = [], edgePos = [], zebPos = [];
  const allRoads = [...CFG.roads, ...CFG.ringRoads];
  for (const r of allRoads) {
    for (let v = -308; v <= 308; v += 6) {
      dashPos.push([r, v, 0]); dashPos.push([v, r, Math.PI / 2]);
      edgePos.push([r - 6.6, v, 0]); edgePos.push([r + 6.6, v, 0]);
      edgePos.push([v, r - 6.6, Math.PI / 2]); edgePos.push([v, r + 6.6, Math.PI / 2]);
    }
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const place = (mesh, list) => {
    list.forEach(([x, z, ry], i) => {
      e.set(-Math.PI / 2, 0, ry); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, 0.03, z), q, new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true; scene.add(mesh);
  };
  place(new THREE.InstancedMesh(dashG, dashM, dashPos.length), dashPos);
  place(new THREE.InstancedMesh(edgeG, whiteM, edgePos.length), edgePos);
  // Zebra at all 25 grid intersections + 10 ring×grid intersections.
  const inter = [];
  for (const a of CFG.roads) for (const b of CFG.roads) inter.push([a, b]);
  for (const r of CFG.roads) { inter.push([312, r]); inter.push([r, 312]); }
  for (const [ix, iz] of inter) {
    for (let s = 0; s < 4; s++) {
      const horiz = s < 2, off = s % 2 === 0 ? -9.5 : 9.5;
      for (let k = -5; k <= 5; k++) {
        if (horiz) zebPos.push([ix + k * 1.3, iz + off, 0]);
        else zebPos.push([ix + off, iz + k * 1.3, Math.PI / 2]);
      }
    }
  }
  place(new THREE.InstancedMesh(zebG, whiteM, zebPos.length), zebPos);
  // Buildings.
  const facTex = facadeTexture();
  facTex.anisotropy = Math.min(16, G.renderer.capabilities.getMaxAnisotropy());
  const facMats = [0xc9bda8, 0xb8c4cc, 0xd8c2a8].map((c) =>
    new THREE.MeshLambertMaterial({ map: facTex, color: c }));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x6a655c });
  const acMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a4 });
  const tankMat = new THREE.MeshLambertMaterial({ color: 0x7a6a55 });
  const antMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const addBuilding = (x, z, w, h, d, mat) => {
    const b = scaledBox(w, h, d, mat);
    b.position.set(x, h / 2, z);
    scene.add(b);
    addCollider(G, x - w / 2, z - d / 2, x + w / 2, z + d / 2);
    if (R.chance(0.7)) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1.4), acMat);
      ac.position.set(x + R.range(-w / 4, w / 4), h + 0.5, z + R.range(-d / 4, d / 4));
      scene.add(ac);
    }
    if (R.chance(0.5)) {
      const tk = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.4, 8), tankMat);
      tk.position.set(x + R.range(-w / 4, w / 4), h + 1.2, z + R.range(-d / 4, d / 4));
      scene.add(tk);
    }
    if (R.chance(0.6)) {
      const an = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 5, 5), antMat);
      an.position.set(x + R.range(-w / 4, w / 4), h + 2.5, z + R.range(-d / 4, d / 4));
      scene.add(an);
    }
    return b;
  };
  const reserved = [
    { x0: -237, z0: 42, x1: -207, z1: 62 }, // Marlin Ceviche
    { x0: -142, z0: -134, x1: -102, z1: -116 }, // market stalls
    { x0: 250, z0: -282, x1: 270, z1: -228 }, // containers
  ];
  const hitsReserved = (x, z, w, d) => reserved.some((r) =>
    x - w / 2 < r.x1 && x + w / 2 > r.x0 && z - d / 2 < r.z1 && z + d / 2 > r.z0);
  const blockCenters = [-180, -60, 60, 180, 288];
  const rows = [-288, -180, -60, 60, 180, 288];
  for (const cx of blockCenters) for (const cz of rows) {
    const spires = cx >= 60 && cz >= 60;
    const docks = cx >= 240;
    if (spires) {
      addBuilding(cx, cz, R.range(24, 30), R.range(42, 72), R.range(24, 30), R.pick(facMats));
      addBuilding(cx + 16, cz + 16, R.range(22, 28), R.range(42, 72), R.range(22, 28), R.pick(facMats));
      continue;
    }
    const n = docks ? 2 : R.int(3, 4);
    for (let i = 0; i < n; i++) {
      const w = R.range(14, 28), d = R.range(14, 28);
      const h = docks ? R.range(8, 12) : R.range(10, 30);
      const ox = [-30, 0, 30][i % 3] + R.range(-6, 6), oz = [-30, 0, 30][Math.floor(i / 3) % 3] + R.range(-6, 6);
      const x = cx + ox, z = cz + oz;
      if (hitsReserved(x, z, w, d)) continue;
      addBuilding(x, z, w, h, d, R.pick(facMats));
    }
  }
  // 4 Plaza landmark towers (120,120)±28, 60–90 m, gold/cyan trim + beacon.
  const trimCols = [0xffd23d, 0x37e0ff];
  [[92, 92], [148, 92], [92, 148], [148, 148]].forEach(([x, z], i) => {
    const h = R.range(60, 90);
    addBuilding(x, z, 26, h, 26, R.pick(facMats));
    const trim = new THREE.Mesh(new THREE.BoxGeometry(27, 1.2, 27),
      new THREE.MeshBasicMaterial({ color: trimCols[i % 2] }));
    trim.position.set(x, h - 0.6, z); scene.add(trim);
    const bc = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8),
      new THREE.MeshBasicMaterial({ color: trimCols[i % 2] }));
    bc.position.set(x, h + 1.6, z); scene.add(bc);
    G.beacons = G.beacons || []; G.beacons.push(bc);
  });
  // Marlin Ceviche restaurant (fixed, collider -235..-209, 44..60).
  const marlin = new THREE.Mesh(new THREE.BoxGeometry(26, 9, 16),
    new THREE.MeshLambertMaterial({ color: 0xe8dcc0 }));
  marlin.position.set(-222, 4.5, 52); marlin.castShadow = true; scene.add(marlin);
  addCollider(G, -235, 44, -209, 60);
  const marlinRoof = new THREE.Mesh(new THREE.BoxGeometry(27, 0.6, 17), roofMat);
  marlinRoof.position.set(-222, 9.3, 52); scene.add(marlinRoof);
  G.marlinPos = [-222, 52];
  buildProps(G, scene);
  buildPalmsTrees(G, scene);
  buildBirds(G, scene);
}

// ---- props ----
function textTexture(text, fg, bg, w = 512, h = 128) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg; ctx.font = `bold ${h * 0.55}px Arial`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function glowTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}
function buildProps(G, scene) {
  const R = G.rng;
  const glowTex = glowTexture();
  const neonCols = [0xff2e7e, 0x37e0ff, 0xffd23d, 0x2eff8a, 0xff7a3d, 0xc26bff];
  G.neonMats = [];
  const addNeon = (text, x, z, big) => {
    const col = R.pick(neonCols);
    const tex = textTexture(text, '#' + col.toString(16).padStart(6, '0'), '#101018', big ? 1024 : 512, big ? 256 : 128);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const w = big ? 18 : 8, h = big ? 4.5 : 2;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    sign.position.set(x, big ? 11 : 6, z);
    sign.rotation.y = Math.abs(x) > Math.abs(z) ? (x > 0 ? -Math.PI / 2 : Math.PI / 2) : 0;
    scene.add(sign);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, big ? 11 : 6, 6),
      new THREE.MeshLambertMaterial({ color: 0x3a3f4a }));
    pole.position.set(x, (big ? 11 : 6) / 2, z); scene.add(pole);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: 0.5, depthWrite: false }));
    halo.scale.set(w * 1.6, h * 3, 1); halo.position.copy(sign.position); scene.add(halo);
    G.neonMats.push(mat);
  };
  for (const [t, x, z] of NEON_BIG) addNeon(t, x, z, true);
  for (let i = 0; i < 22; i++) {
    const r = R.pick(CFG.roads);
    const along = R.range(-280, 280);
    const side = R.chance(0.5) ? 1 : -1;
    if (R.chance(0.5)) addNeon(R.pick(SIGNS), r + side * 10, along, false);
    else addNeon(R.pick(SIGNS), along, r + side * 10, false);
  }
  // Lighthouse (-288,-262): 26 m tower, red band, lamp, beam cone.
  const lh = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, 26, 10),
    new THREE.MeshLambertMaterial({ color: 0xf2ede0 }));
  tower.position.y = 13; tower.castShadow = true; lh.add(tower);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.7, 4, 10),
    new THREE.MeshLambertMaterial({ color: 0xc22030 }));
  band.position.y = 18; lh.add(band);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  lamp.position.y = 27; lh.add(lamp);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(9, 40, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
  beam.rotation.z = Math.PI / 2; beam.position.set(20, 27, 0); lh.add(beam);
  lh.position.set(-288, 0, -262); scene.add(lh);
  G.lighthouseBeam = beam;
  G.colliders.push({ x0: -291, z0: -265, x1: -285, z1: -259 });
  // Wooden pier 10×90 at (-298,66).
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 90),
    new THREE.MeshLambertMaterial({ color: 0x8a6a45 }));
  pier.position.set(-298, 0.6, 66); pier.castShadow = true; scene.add(pier);
  // Ferris wheel (-268,-180), radius 13, 8 cabins, 0.12 rad/s.
  const fw = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(13, 0.5, 8, 32),
    new THREE.MeshLambertMaterial({ color: 0xff2e7e }));
  fw.add(rim);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4),
      new THREE.MeshLambertMaterial({ color: [0x37e0ff, 0xffd23d, 0x2eff8a][i % 3] }));
    cab.position.set(Math.cos(a) * 13, Math.sin(a) * 13, 0); fw.add(cab);
  }
  const legMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 15, 6), legMat);
    leg.position.set(s * 5, 7, 0); leg.rotation.z = s * 0.35; fw.add(leg);
  }
  fw.position.set(-268, 15, -180); scene.add(fw);
  G.ferris = fw;
  // Docks: 18 coloured containers (x 252..268, z -280..-230), 2 cranes.
  const contCols = [0xc22030, 0x2e6fd8, 0x1e9e6a, 0xf5c518, 0x8a5a9a, 0xd86a1e];
  for (let i = 0; i < 18; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 12),
      new THREE.MeshLambertMaterial({ color: R.pick(contCols) }));
    c.position.set(R.range(254, 266), 1.3 + (i % 3 === 2 ? 2.6 : 0), R.range(-278, -232));
    c.castShadow = true; scene.add(c);
  }
  G.colliders.push({ x0: 250, z0: -282, x1: 270, z1: -228 });
  for (const [cx, cz] of [[268, -120], [296, -120]]) {
    const crane = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.BoxGeometry(2, 22, 2),
      new THREE.MeshLambertMaterial({ color: 0xf5c518 }));
    mast.position.y = 11; crane.add(mast);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(30, 1.5, 1.5),
      new THREE.MeshLambertMaterial({ color: 0xf5c518 }));
    arm.position.set(8, 21, 0); crane.add(arm);
    crane.position.set(cx, 0, cz); scene.add(crane);
  }
  // Jetski (-312,30), taco truck (-246,96), beach huts.
  const jet = new THREE.Group();
  const jb = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 2.6),
    new THREE.MeshLambertMaterial({ color: 0x37e0ff }));
  jet.add(jb);
  const js = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 1),
    new THREE.MeshLambertMaterial({ color: 0x222222 }));
  js.position.set(0, 0.4, -0.3); jet.add(js);
  jet.position.set(-312, 0.4, 30); scene.add(jet);
  G.jetski = jet;
  const taco = new THREE.Group();
  const tb = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 5),
    new THREE.MeshLambertMaterial({ color: 0xf5c518 }));
  tb.position.y = 1.6; taco.add(tb);
  const tt = textTexture('TACOS', '#c22030', '#f5c518', 256, 64);
  const ts = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.6), new THREE.MeshBasicMaterial({ map: tt }));
  ts.position.set(0, 2.6, 2.55); taco.add(ts);
  taco.position.set(-246, 0, 96); taco.rotation.y = 0.4; scene.add(taco);
  for (const [hx, hz] of [[-272, -120], [-272, -40], [-272, 210]]) {
    const hut = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 5),
      new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
    hut.position.set(hx, 2, hz); hut.castShadow = true; scene.add(hut);
    const hr = new THREE.Mesh(new THREE.ConeGeometry(4.4, 2, 4),
      new THREE.MeshLambertMaterial({ color: 0x8a6a45 }));
    hr.position.set(hx, 5, hz); hr.rotation.y = Math.PI / 4; scene.add(hr);
    G.colliders.push({ x0: hx - 3, z0: hz - 2.5, x1: hx + 3, z1: hz + 2.5 });
  }
  // 8 market stalls around (-140..-104, -132..-118) + striped canopies.
  const stripeTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
    const ctx = cv.getContext('2d');
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#f2ede0' : '#c22030'; ctx.fillRect(i * 16, 0, 16, 64); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  for (let i = 0; i < 8; i++) {
    const sx = R.range(-140, -104), sz = R.range(-132, -118);
    const st = new THREE.Group();
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3, 1.1, 1.6),
      new THREE.MeshLambertMaterial({ color: 0x8a6a45 }));
    counter.position.y = 0.55; st.add(counter);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.15, 2.2),
      new THREE.MeshLambertMaterial({ map: stripeTex }));
    canopy.position.y = 2.6; st.add(canopy);
    for (const [px2, pz2] of [[-1.6, -1], [1.6, -1], [-1.6, 1], [1.6, 1]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5),
        new THREE.MeshLambertMaterial({ color: 0x555555 }));
      post.position.set(px2, 1.3, pz2); st.add(post);
    }
    st.position.set(sx, 0, sz); scene.add(st);
  }
  // Benches every 40 m at x=-256.
  const benchG = new THREE.BoxGeometry(2.2, 0.5, 0.7);
  const benchM = new THREE.MeshLambertMaterial({ color: 0x7a6a55 });
  const benches = [];
  for (let z = -280; z <= 280; z += 40) benches.push([-256, z]);
  const benchMesh = new THREE.InstancedMesh(benchG, benchM, benches.length);
  benches.forEach(([x, z], i) => {
    m4b.compose(new THREE.Vector3(x, 0.5, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    benchMesh.setMatrixAt(i, m4b);
  });
  benchMesh.instanceMatrix.needsUpdate = true; scene.add(benchMesh);
  // Street lamps every 60 m at z=±8 along grid roads + heads.
  const lampPos = [];
  for (const r of CFG.roads) for (let v = -300; v <= 300; v += 60) {
    lampPos.push([r - 8, v]); lampPos.push([r + 8, v]);
    lampPos.push([v, r - 8]); lampPos.push([v, r + 8]);
  }
  const poleG = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  const poleM = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
  const poles = new THREE.InstancedMesh(poleG, poleM, lampPos.length);
  const headG = new THREE.SphereGeometry(0.35, 8, 8);
  const headM = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const heads = new THREE.InstancedMesh(headG, headM, lampPos.length);
  G.lampHeadMat = headM;
  lampPos.forEach(([x, z], i) => {
    m4b.compose(new THREE.Vector3(x, 3, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    poles.setMatrixAt(i, m4b);
    m4b.compose(new THREE.Vector3(x, 6.1, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    heads.setMatrixAt(i, m4b);
  });
  poles.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
  scene.add(poles, heads);
  // Traffic lights at 4 intersections.
  const tlMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  for (const [ix, iz] of [[0, 0], [120, -120], [-120, 120], [120, 120]]) {
    const tl = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5, 6), tlMat);
    post.position.y = 2.5; tl.add(post);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.7), tlMat);
    box.position.y = 5.4; tl.add(box);
    const cols = [0xff2020, 0xffd23d, 0x2eff8a];
    cols.forEach((c, i) => {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: c }));
      l.position.set(0, 5.9 - i * 0.55, 0.4); tl.add(l);
    });
    tl.position.set(ix + 8.5, 0, iz + 8.5); scene.add(tl);
  }
}
const m4b = new THREE.Matrix4();
// ---- palms + shade trees ----
function buildPalmsTrees(G, scene) {
  const R = G.rng;
  // Palm: trunk 3 segments + 10 fronds + 3 coconuts, merged into one geometry.
  const parts = [];
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8a4a, side: THREE.DoubleSide });
  const nutMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const trunk = new THREE.Group();
  for (let s = 0; s < 3; s++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.22 - s * 0.04, 0.26 - s * 0.04, 2.2, 6), trunkMat);
    seg.position.y = 1.1 + s * 2.2; trunk.add(seg);
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const fr = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 3.2), leafMat);
    fr.position.set(Math.cos(a) * 1.4, 7.2, Math.sin(a) * 1.4);
    fr.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    fr.rotation.y = -a;
    trunk.add(fr);
  }
  for (let i = 0; i < 3; i++) {
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), nutMat);
    nut.position.set(Math.cos(i * 2.1) * 0.5, 6.7, Math.sin(i * 2.1) * 0.5);
    trunk.add(nut);
  }
  // Bake trunk group into one geometry via merged BufferGeometries is overkill;
  // instead use the group as a template and instance its children count via a
  // single merged geometry built from cloned parts.
  const geos = [];
  trunk.children.forEach((ch) => {
    const g = ch.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().compose(ch.position, ch.quaternion, ch.scale));
    geos.push({ g, mat: ch.material });
  });
  const palmSpots = [];
  // Rows phased -291 so no trunk sits on the street-shot sightline (z=64);
  // stagger stays +4 between the two rows.
  for (let z = -291; z <= 291; z += 18) {
    palmSpots.push([-256, z]);
    palmSpots.push([-246, z + 4]); // second row, stagger +4
  }
  for (let i = 0; i < 24; i++) palmSpots.push([R.range(100, 164), R.range(100, 164)]);
  for (let i = 0; i < 14; i++) palmSpots.push([R.range(-280, -260), R.range(-280, 280)]);
  // One InstancedMesh per material group.
  const byMat = new Map();
  geos.forEach(({ g, mat }) => {
    const key = mat === trunkMat ? 't' : mat === leafMat ? 'l' : 'n';
    if (!byMat.has(key)) byMat.set(key, { mat, list: [] });
    byMat.get(key).list.push(g);
  });
  G.palmMeshes = [];
  G.palmBase = [];
  G.palmPhase = [];
  byMat.forEach(({ mat, list }) => {
    const merged = mergeGeos(list);
    const mesh = new THREE.InstancedMesh(merged, mat, palmSpots.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    G.palmMeshes.push(mesh);
  });
  const m = new THREE.Matrix4(), qq = new THREE.Quaternion(), ee = new THREE.Euler();
  palmSpots.forEach(([x, z], i) => {
    const sc = R.range(0.85, 1.25);
    ee.set(0, R.f() * Math.PI * 2, 0); qq.setFromEuler(ee);
    m.compose(new THREE.Vector3(x, 0, z), qq, new THREE.Vector3(sc, sc, sc));
    G.palmBase.push(m.clone());
    G.palmPhase.push((x * 0.7 + z * 1.3) % 6.28);
    G.palmMeshes.forEach((mesh) => mesh.setMatrixAt(i, m));
  });
  G.palmMeshes.forEach((mesh) => { mesh.instanceMatrix.needsUpdate = true; });
  // Shade trees: trunk cylinder + 3 flat-shaded canopy spheres, InstancedMesh 24.
  const treeSpots = [];
  let guard = 0;
  while (treeSpots.length < 24 && guard++ < 400) {
    const zone = R.pick(['plaza', 'market', 'verde']);
    let x, z;
    if (zone === 'plaza') { x = R.range(100, 164); z = R.range(100, 164); }
    else if (zone === 'market') { x = R.range(-140, -100); z = R.range(-140, -100); }
    else { x = R.range(60, 180); z = R.range(-60, 60); }
    if (isOnRoad(x, z)) continue;
    treeSpots.push([x, z]);
  }
  const trunkG = new THREE.CylinderGeometry(0.3, 0.45, 3, 7);
  const trunkM = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const canG = new THREE.SphereGeometry(2.2, 8, 6);
  const canM = new THREE.MeshLambertMaterial({ color: 0x3d7a3a, flatShading: true });
  const canM2 = new THREE.MeshLambertMaterial({ color: 0x4a8a3a, flatShading: true });
  const trunks = new THREE.InstancedMesh(trunkG, trunkM, treeSpots.length);
  const cans = new THREE.InstancedMesh(canG, canM, treeSpots.length * 3);
  const cans2 = new THREE.InstancedMesh(canG, canM2, treeSpots.length * 3);
  treeSpots.forEach(([x, z], i) => {
    const sc = R.range(0.9, 1.4);
    m.compose(new THREE.Vector3(x, 1.5 * sc, z), new THREE.Quaternion(), new THREE.Vector3(sc, sc, sc));
    trunks.setMatrixAt(i, m);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1, r2 = 1.4 * sc;
      m.compose(new THREE.Vector3(x + Math.cos(a) * r2, (3.6 + (k % 2) * 0.9) * sc, z + Math.sin(a) * r2),
        new THREE.Quaternion(), new THREE.Vector3(sc, sc * 0.8, sc));
      (k % 2 ? cans2 : cans).setMatrixAt(i * 3 + k, m);
      (k % 2 ? cans : cans2).setMatrixAt(i * 3 + k, new THREE.Matrix4().makeScale(0, 0, 0));
    }
  });
  trunks.instanceMatrix.needsUpdate = true;
  cans.instanceMatrix.needsUpdate = true; cans2.instanceMatrix.needsUpdate = true;
  scene.add(trunks, cans, cans2);
}
function mergeGeos(list) {
  // Merge BufferGeometries with same attributes (position/normal/uv).
  let vCount = 0, iCount = 0;
  list.forEach((g) => { vCount += g.attributes.position.count; iCount += g.index ? g.index.count : 0; });
  const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), uv = new Float32Array(vCount * 2);
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  list.forEach((g) => {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    if (g.index) {
      const arr = g.index.array;
      for (let i = 0; i < arr.length; i++) idx[io + i] = arr[i] + vo;
      io += arr.length;
    }
    vo += n;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
// ---- birds ----
function buildBirds(G, scene) {
  G.birds = [];
  const mat = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide });
  const wingG = new THREE.PlaneGeometry(1.1, 0.5);
  for (let i = 0; i < CFG.birdN; i++) {
    const b = new THREE.Group();
    const wl = new THREE.Mesh(wingG, mat); wl.position.x = -0.55; b.add(wl);
    const wr = new THREE.Mesh(wingG, mat); wr.position.x = 0.55; b.add(wr);
    scene.add(b);
    G.birds.push({
      g: b, wl, wr, r: G.rng.range(30, 140), h: G.rng.range(40, 80),
      a: G.rng.f() * Math.PI * 2, sp: G.rng.range(0.05, 0.14),
      cx: G.rng.range(-160, 160), cz: G.rng.range(-160, 160), ph: G.rng.f() * 6.28,
    });
  }
}
// ---- shared person mesh (cached geo/mat per colour) ----
const personCache = new Map();
export function makePersonMesh(skin, shirt, pants, hat) {
  const key = `${skin}-${shirt}-${pants}-${hat}`;
  if (!personCache.has(key)) {
    const g = new THREE.Group();
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), mat(skin));
    head.position.y = 1.62; g.add(head);
    if (hat) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.14, 10), mat(hat));
      h.position.y = 1.86; g.add(h);
    }
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.34), mat(shirt));
    torso.position.y = 1.12; g.add(torso);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.22), mat(pants));
    legL.name = 'legL'; legL.position.set(-0.16, 0.38, 0); g.add(legL);
    const legR = legL.clone(); legR.name = 'legR'; legR.position.x = 0.16; g.add(legR);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), mat(shirt));
    armL.name = 'armL'; armL.position.set(-0.4, 1.12, 0); g.add(armL);
    const armR = armL.clone(); armR.name = 'armR'; armR.position.x = 0.4; g.add(armR);
    g.userData = { legL, legR, armL, armR };
    personCache.set(key, g);
  }
  // clone() JSON-round-trips userData, losing object refs: re-resolve parts.
  const c = personCache.get(key).clone();
  c.userData = {
    legL: c.getObjectByName('legL'), legR: c.getObjectByName('legR'),
    armL: c.getObjectByName('armL'), armR: c.getObjectByName('armR'),
  };
  return c;
}
export function updateCity(G, dt) {
  const t = G.elapsed;
  // Palm sway: base matrix + small rot.z per instance.
  if (G.palmMeshes) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const base = G.palmBase;
    G.palmMeshes.forEach((mesh) => {
      for (let i = 0; i < base.length; i++) {
        const b = base[i];
        const p = new THREE.Vector3(), qq = new THREE.Quaternion(), s = new THREE.Vector3();
        b.decompose(p, qq, s);
        e.set(0, 0, Math.sin(t * 0.8 + G.palmPhase[i]) * 0.03);
        q.setFromEuler(e).multiply(qq);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    });
  }
  if (G.ferris) G.ferris.rotation.z += dt * 0.12;
  if (G.jetski) { G.jetski.position.y = 0.4 + Math.sin(t * 1.4) * 0.15; G.jetski.rotation.z = Math.sin(t * 0.9) * 0.06; }
  if (G.lighthouseBeam) G.lighthouseBeam.rotation.y += dt * 0.5;
  if (G.lampHeadMat) G.lampHeadMat.color.setHex(nightFactor(G.timeOfDay) > 0.5 ? 0xfff2b0 : 0xcfc49a);
  // Birds circle + flap.
  for (const b of G.birds || []) {
    b.a += dt * b.sp;
    b.g.position.set(b.cx + Math.cos(b.a) * b.r, b.h + Math.sin(t * 0.7 + b.ph) * 3, b.cz + Math.sin(b.a) * b.r);
    b.g.rotation.y = -b.a;
    const flap = Math.sin(t * 6 + b.ph) * 0.5;
    b.wl.rotation.z = flap; b.wr.rotation.z = -flap;
  }
  if (G.beacons) {
    const on = Math.sin(t * 3) > 0;
    G.beacons.forEach((bc) => { bc.visible = on; });
  }
}
function nightFactor(t) {
  if (t < 17.5) return 0;
  if (t < 18.5) return (t - 17.5) * 0.4;
  if (t < 20) return 0.4 + (t - 18.5) * 0.6;
  return 1;
}
