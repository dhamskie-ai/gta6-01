// Solara Bay: 640x640 m coastal city. HD ground 4096x4096 canvas; road
// markings are separate sharp meshes (InstancedMesh), never texture-only;
// facades are 1024x1024 canvases, RepeatWrapping, anisotropy up to 16.
import * as THREE from 'three';
import { G, CFG } from './config.js';
import { R } from './random.js';
import { nightFactor } from './render.js';

const ROADS = CFG.roads;

export function districtAt(x, z) {
  if (x < -235) return 'Malecón Celeste';
  if (x > 235) return 'The Docks';
  if (x > 60 && z > 60) return 'Plaza Spires';
  if (x < -60 && z < -60) return 'Old Solara';
  if (z < -140) return 'Vista Hills';
  if (x < -60 && z > 60) return 'Marina Bay';
  return 'Calle Verde';
}

export function collideCircle(x, z, r) {
  for (const b of G.colliders) {
    if (x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1) return b;
  }
  return null;
}

// ---------- textures ----------
function facadeTexture(base, trim, litRatio) {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 1024, 1024);
  // subtle vertical tone variation per floor band
  for (let f = 0; f < 16; f++) {
    x.fillStyle = `rgba(0,0,0,${(f % 2) * 0.05})`;
    x.fillRect(0, f * 64, 1024, 64);
  }
  for (let r = 0; r < 16; r++) for (let col = 0; col < 8; col++) {
    const wx = 40 + col * 122, wy = 26 + r * 62;
    const lit = R.chance(litRatio);
    x.fillStyle = lit ? (R.chance(0.6) ? '#ffc46b' : '#ff9a4d') : '#3d4a61';
    x.fillRect(wx, wy, 72, 40);
    x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(wx, wy, 72, 5);
    x.strokeStyle = trim; x.lineWidth = 3; x.strokeRect(wx - 2, wy - 2, 76, 44);
  }
  // ground-floor shop band
  x.fillStyle = trim; x.fillRect(0, 960, 1024, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(16, G.renderer.capabilities.getMaxAnisotropy());
  return t;
}

function groundTexture() {
  const S = 4096, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const px = (m) => (m + 320) / 640 * S;
  x.fillStyle = '#7d8a6a'; x.fillRect(0, 0, S, S); // block base
  // city blocks: varied pavement tones
  for (let bx = -5; bx <= 5; bx++) for (let bz = -5; bz <= 5; bz++) {
    const cx = bx * 60, cz = bz * 60;
    x.fillStyle = ['#8a8f7a', '#93917f', '#7f8a72', '#8f8a76'][(bx * 7 + bz * 13 + 20) % 4];
    x.fillRect(px(cx - 26), px(cz - 26), px(52) - px(0), px(52) - px(0));
  }
  // sand + sea on the west edge
  x.fillStyle = '#d9c08a'; x.fillRect(0, 0, px(-252) - px(-320), S);
  const sea = x.createLinearGradient(0, 0, px(-296) - px(-320), 0);
  sea.addColorStop(0, '#1d6f8e'); sea.addColorStop(1, '#2f8fb0');
  x.fillStyle = sea; x.fillRect(0, 0, px(-298) - px(-320), S);
  x.fillStyle = '#efe6c8'; x.fillRect(px(-300), 0, 6, S); // foam line
  // roads: asphalt + pale sidewalk strips flanking each road
  for (const r of ROADS) {
    for (const horiz of [true, false]) {
      const a = px(r - 11), b = px(r + 11);
      x.fillStyle = '#b8b0a0';
      if (horiz) { x.fillRect(0, a, S, b - a); } else { x.fillRect(a, 0, b - a, S); }
      const c0 = px(r - 7), c1 = px(r + 7);
      x.fillStyle = '#3d434b';
      if (horiz) { x.fillRect(0, c0, S, c1 - c0); } else { x.fillRect(c0, 0, c1 - c0, S); }
    }
  }
  // crosswalk underlay at every intersection (geometry zebra sits on top)
  x.fillStyle = 'rgba(240,240,230,0.5)';
  for (const rx of ROADS) for (const rz of ROADS) {
    for (let i = -3; i <= 3; i++) {
      x.fillRect(px(rx + i * 1.1 - 0.35), px(rz - 9.5), px(0.7) - px(0), px(3.4) - px(0));
      x.fillRect(px(rx - 9.5), px(rz + i * 1.1 - 0.35), px(3.4) - px(0), px(0.7) - px(0));
    }
  }
  // plaza + docks concrete
  x.fillStyle = '#9a938a'; x.fillRect(px(96), px(96), px(72) - px(0), px(72) - px(0));
  x.fillStyle = '#8b8578'; x.fillRect(px(246), px(-300), px(74) - px(0), S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(16, G.renderer.capabilities.getMaxAnisotropy());
  return t;
}

function signTexture(text, fg, bg) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 512, 128);
  x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(6, 6, 500, 116);
  x.fillStyle = fg; x.font = 'bold 64px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function haloTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// ---------- geometry helpers ----------
function scaledBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, w / 9), uv.getY(i) * Math.max(1, h / 9));
  return g;
}

function mergeGeos(list) {
  // Concatenate position/normal/uv/color arrays (no BufferGeometryUtils in vendor).
  let v = 0, idx = 0;
  for (const g of list) { v += g.attributes.position.count; idx += g.index.count; }
  const pos = new Float32Array(v * 3), nor = new Float32Array(v * 3), uv = new Float32Array(v * 2), col = new Float32Array(v * 3);
  const index = new Uint32Array(idx);
  let vo = 0, io = 0;
  for (const g of list) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    const cc = g.attributes.color;
    if (cc) col.set(cc.array, vo * 3);
    else for (let i = 0; i < n; i++) { col[(vo + i) * 3] = 1; col[(vo + i) * 3 + 1] = 1; col[(vo + i) * 3 + 2] = 1; }
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) index[io + i] = gi[i] + vo;
    vo += n; io += gi.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  return out;
}

function paint(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function palmGeometry() {
  const parts = [];
  let px = 0, py = 0, lean = 0.35;
  for (let s = 0; s < 3; s++) {
    const seg = new THREE.CylinderGeometry(0.16 - s * 0.03, 0.22 - s * 0.03, 2.6, 6);
    seg.translate(px + lean * 0.4, py + 1.3, 0); seg.rotateZ(-lean * 0.12);
    paint(seg, s % 2 ? 0x7a5c38 : 0x8a6a42);
    parts.push(seg); px += lean * 0.5; py += 2.55;
  }
  for (let f = 0; f < 10; f++) {
    const a = (f / 10) * Math.PI * 2;
    const fr = new THREE.PlaneGeometry(0.55, 3.0, 1, 4);
    const p = fr.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) + 1.5; // 0..3 along frond
      p.setY(i, 1.5 - y * 0.28 - y * y * 0.09);
      p.setZ(i, y);
    }
    fr.computeVertexNormals();
    fr.rotateX(-0.5 - (f % 2) * 0.35);
    fr.rotateY(a);
    fr.translate(px, py + 0.4, 0);
    paint(fr, f % 2 ? 0x2f8f3a : 0x3fae4a);
    parts.push(fr);
  }
  for (let k = 0; k < 3; k++) {
    const nut = new THREE.SphereGeometry(0.16, 6, 5);
    nut.translate(px + Math.cos(k * 2.1) * 0.3, py + 0.15, Math.sin(k * 2.1) * 0.3);
    paint(nut, 0x6b4a22);
    parts.push(nut);
  }
  return mergeGeos(parts);
}

// ---------- city build ----------
export function buildCity() {
  const scene = G.scene;
  const city = { facadeMats: [], trafficLights: [], ferris: null, beam: null, lampMats: [] };
  G.city = city;
  // Ground: one 4096-textured plane over the whole 640 m map.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(640, 640),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  // Sea plane west of the sand.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 640),
    new THREE.MeshLambertMaterial({ color: 0x2f8fb0, transparent: true, opacity: 0.92 }),
  );
  sea.rotation.x = -Math.PI / 2; sea.position.set(-330, -0.4, 0);
  scene.add(sea);

  // ---- sharp road markings: separate thin geometry above the ground ----
  const dummy = new THREE.Object3D();
  const dashMats = [], edgeMats = [], zebraMats = [];
  for (const r of ROADS) {
    for (let m = -310; m < 310; m += 6) {
      dummy.position.set(m + 1.5, 0.03, r); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
      dashMats.push(dummy.matrix.clone());
      dummy.position.set(r, 0.03, m + 1.5); dummy.rotation.set(0, Math.PI / 2, 0); dummy.updateMatrix();
      dashMats.push(dummy.matrix.clone());
      for (const s of [-6.6, 6.6]) {
        dummy.position.set(m + 3, 0.025, r + s); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
        edgeMats.push(dummy.matrix.clone());
        dummy.position.set(r + s, 0.025, m + 3); dummy.rotation.set(0, Math.PI / 2, 0); dummy.updateMatrix();
        edgeMats.push(dummy.matrix.clone());
      }
    }
    for (const rz of ROADS) {
      for (let i = -2; i <= 2; i++) {
        dummy.position.set(r + i * 1.15, 0.035, rz - 8.6); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
        zebraMats.push(dummy.matrix.clone());
        dummy.position.set(r + i * 1.15, 0.035, rz + 8.6); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
        zebraMats.push(dummy.matrix.clone());
        dummy.position.set(r - 8.6, 0.035, rz + i * 1.15); dummy.rotation.set(0, Math.PI / 2, 0); dummy.updateMatrix();
        zebraMats.push(dummy.matrix.clone());
        dummy.position.set(r + 8.6, 0.035, rz + i * 1.15); dummy.rotation.set(0, Math.PI / 2, 0); dummy.updateMatrix();
        zebraMats.push(dummy.matrix.clone());
      }
    }
  }
  const dashGeo = new THREE.PlaneGeometry(3, 0.35); dashGeo.rotateX(-Math.PI / 2);
  const edgeGeo = new THREE.PlaneGeometry(6, 0.18); edgeGeo.rotateX(-Math.PI / 2);
  const zebraGeo = new THREE.PlaneGeometry(0.65, 3.4); zebraGeo.rotateX(-Math.PI / 2);
  const mkInst = (geo, color, mats) => {
    const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color }), mats.length);
    mats.forEach((mt, i) => im.setMatrixAt(i, mt));
    im.instanceMatrix.needsUpdate = true; scene.add(im); return im;
  };
  mkInst(dashGeo, 0xf7c948, dashMats);
  mkInst(edgeGeo, 0xf2f2ea, edgeMats);
  mkInst(zebraGeo, 0xf2f2ea, zebraMats);

  // ---- buildings: 3 facade variants, UV scaled per building ----
  const variants = [
    facadeTexture('#c98a4b', '#8a5a28', 0.22),
    facadeTexture('#7a8ba0', '#4a5a70', 0.3),
    facadeTexture('#b06a6a', '#7a3a3a', 0.18),
  ];
  const facadeMats = variants.map((t) => new THREE.MeshLambertMaterial({
    map: t, emissiveMap: t, emissive: new THREE.Color(0xffb45e), emissiveIntensity: 0,
  }));
  city.facadeMats = facadeMats;
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4640 });
  const trimMat = new THREE.MeshLambertMaterial({ color: 0x2c2c30 });
  const blockC = [-288, -180, -60, 60, 180, 288];
  for (const bx of blockC) for (const bz of blockC) {
    if (bx === -288) continue; // malecón strip: boardwalk, huts, palms
    const spires = bx >= 60 && bz >= 60;
    const docks = bx >= 240;
    const n = spires ? 1 : (docks ? 1 : R.int(2, 3));
    for (let i = 0; i < n; i++) {
      const w = docks ? R.range(30, 44) : R.range(18, 30);
      const d = docks ? R.range(18, 26) : R.range(18, 28);
      const h = spires ? R.range(42, 72) : docks ? R.range(8, 12) : R.range(10, 30);
      const jx = n === 1 ? 0 : (i === 0 ? -14 : 14);
      const jz = n === 1 ? 0 : (i === 2 ? 12 : -12);
      const x = bx + jx + R.range(-4, 4), z = bz + jz + R.range(-4, 4);
      if (Math.abs(x) > 305 || Math.abs(z) > 305) continue;
      const mat = facadeMats[R.int(0, 2)];
      const b = new THREE.Mesh(scaledBox(w, h, d), docks
        ? new THREE.MeshLambertMaterial({ color: [0x9a7a4a, 0x7a8a9a, 0x8a6a5a][R.int(0, 2)] })
        : mat);
      b.position.set(x, h / 2, z); b.castShadow = true; b.receiveShadow = true;
      scene.add(b);
      G.colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
      // roof detail: AC box, water tank, antenna
      const roof = new THREE.Group(); roof.position.set(x, h, z);
      if (R.chance(0.7)) {
        const ac = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 1.6), roofMat);
        ac.position.set(R.range(-w / 4, w / 4), 0.5, R.range(-d / 4, d / 4)); roof.add(ac);
      }
      if (R.chance(0.5)) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 10), trimMat);
        tank.position.set(R.range(-w / 4, w / 4), 1.1, R.range(-d / 4, d / 4)); roof.add(tank);
      }
      if (R.chance(0.6)) {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 5, 5), trimMat);
        ant.position.set(R.range(-w / 4, w / 4), 2.5, R.range(-d / 4, d / 4)); roof.add(ant);
      }
      scene.add(roof);
    }
  }
  // Marlin Ceviche restaurant (mission anchor) + beach huts
  const resto = new THREE.Mesh(scaledBox(26, 9, 16), facadeMats[0]);
  resto.position.set(-222, 4.5, 52); resto.castShadow = true; scene.add(resto);
  G.colliders.push({ x0: -235, x1: -209, z0: 44, z1: 60 });
  for (const [hx, hz] of [[-272, -120], [-272, -40], [-272, 210]]) {
    const hut = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 5),
      new THREE.MeshLambertMaterial({ color: 0xe8d8b0 }));
    hut.position.set(hx, 2, hz); scene.add(hut);
    G.colliders.push({ x0: hx - 3, x1: hx + 3, z0: hz - 2.5, z1: hz + 2.5 });
  }

  // ---- storefront + neon signs (sharp canvas text + glow halos) ----
  const haloTex = haloTexture();
  const shops = [
    ['TACOS', '#ffd23d', '#7a1e1e'], ['DONUTS', '#ff8fd0', '#3a1e5e'], ['BAR', '#7de3ff', '#14243a'],
    ['HOTEL', '#7de3ff', '#1e3a5e'], ['PIZZA', '#ff6b4a', '#2a1e10'], ['24H MART', '#9dff6b', '#123a1e'],
    ['CEVICHE', '#ffd23d', '#0e3a3a'], ['CAFÉ', '#ffb46b', '#3a2410'], ['SURF', '#7de3ff', '#0e2a4a'],
    ['FLOWERS', '#ff9fd0', '#3a1e2e'], ['TATTOO', '#e8e8e8', '#1a1a1a'], ['GYM', '#ff5a5a', '#1e1e26'],
  ];
  const neonDefs = [
    ['FLAMINGO FM', '#ff5ad0', -258, 20, -40], ['VICE HOTEL', '#37e0ff', -258, 130, 90],
    ['TACOS 24H', '#ffd23d', -258, -150, 120], ['CELESTE 98.1', '#ff8f3d', 110, 128, 40],
    ['MARLIN', '#7de3ff', -222, 62, 30], ['SOLARA BAY', '#ff5ad0', 60, 132, 60],
    ['PIER 9', '#9dff6b', -292, 44, 10], ['NEON NIGHTS', '#b48cff', 180, 180, 200],
  ];
  const signMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const addSign = (text, fg, bg, x, y, z, ry, w, big) => {
    const tex = signTexture(text, fg, bg);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4),
      new THREE.MeshBasicMaterial({ map: tex, transparent: false }));
    m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
    if (big) {
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.7, w * 0.85),
        new THREE.MeshBasicMaterial({ map: haloTex, color: new THREE.Color(fg), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.12 }));
      halo.position.set(x, y, z); halo.rotation.y = ry;
      halo.translateZ(-0.15);
      scene.add(halo); G.neonHalos.push(halo);
    }
    return m;
  };
  for (let i = 0; i < 22; i++) {
    const [t, fg, bg] = shops[i % shops.length];
    const bx = blockC[R.int(1, 5)], bz = blockC[R.int(0, 5)];
    const south = R.chance(0.5);
    addSign(t, fg, bg, bx + R.range(-8, 8), 2.8, bz + (south ? 15 : -15), south ? 0 : Math.PI, 10, false);
  }
  for (const [t, fg, x, z, ry] of neonDefs) addSign(t, fg, '#101018', x, 7, z, (ry * Math.PI) / 180, 16, true);
  void signMat;

  // ---- palms: one merged geometry, InstancedMesh ----
  const palmGeo = palmGeometry();
  const palmMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const palmMats4 = [];
  for (let z = -300; z <= 300; z += 18) { palmMats4.push([-262, z]); palmMats4.push([-252, z + 9]); }
  for (let x = -240; x <= 240; x += 36) { palmMats4.push([x, -8]); palmMats4.push([x + 18, 8]); }
  for (let z = -240; z <= 240; z += 36) { palmMats4.push([-8, z]); palmMats4.push([8, z + 18]); }
  for (let i = 0; i < 12; i++) palmMats4.push([96 + R.range(-20, 20), 96 + R.range(-20, 20)]);
  const palms = new THREE.InstancedMesh(palmGeo, palmMat, palmMats4.length);
  palmMats4.forEach(([x, z], i) => {
    dummy.position.set(x, 0, z); dummy.rotation.set(0, R.range(0, Math.PI * 2), 0);
    const s = R.range(0.9, 1.25); dummy.scale.set(s, s, s); dummy.updateMatrix();
    palms.setMatrixAt(i, dummy.matrix);
  });
  palms.instanceMatrix.needsUpdate = true; palms.castShadow = true;
  scene.add(palms);

  // ---- lamps along roads + malecón ----
  const lampPole = new THREE.MeshLambertMaterial({ color: 0x22242a });
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let x = -240; x <= 240; x += 60) for (const z of [-8, 8]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 6), lampPole);
    pole.position.set(x, 3, z); scene.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), lampHeadMat.clone());
    head.position.set(x, 6.1, z); scene.add(head); city.lampMats.push(head.material);
  }

  // ---- traffic lights at 4 intersections ----
  for (const [ix, iz] of [[0, 0], [120, -120], [-120, 120], [120, 120]]) {
    const g = new THREE.Group(); g.position.set(ix + 8.5, 0, iz + 8.5);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 5.5, 6), lampPole);
    pole.position.y = 2.75; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 0.18), lampPole);
    arm.position.set(-1.6, 5.3, 0); g.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.9, 0.5), trimMat);
    head.position.set(-3.2, 4.6, 0); g.add(head);
    const dots = [];
    for (let k = 0; k < 3; k++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6),
        new THREE.MeshBasicMaterial({ color: [0xff2a2a, 0xffb02a, 0x2aff5a][k] }));
      dot.position.set(-3.2, 5.2 - k * 0.6, 0.28); g.add(dot); dots.push(dot);
    }
    scene.add(g);
    city.trafficLights.push({ dots, off: (ix + iz) * 0.01 });
  }

  // ---- lighthouse + pier + ferris wheel + docks ----
  const lh = new THREE.Group(); lh.position.set(-288, 0, -262);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 26, 12),
    new THREE.MeshLambertMaterial({ color: 0xf2ead8 }));
  tower.position.y = 13; lh.add(tower);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.55, 4, 12),
    new THREE.MeshLambertMaterial({ color: 0xd23a2e }));
  band.position.y = 18; lh.add(band);
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.4, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
  lampRoom.position.y = 27; lh.add(lampRoom);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(9, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.rotation.z = Math.PI / 2.3; beam.position.set(28, 27, 0); lh.add(beam);
  city.beam = beam; scene.add(lh);
  G.colliders.push({ x0: -291, x1: -285, z0: -265, z1: -259 });
  // pier deck
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 90),
    new THREE.MeshLambertMaterial({ color: 0x8a6a42 }));
  pier.position.set(-298, 0.4, 66); scene.add(pier);
  // ferris wheel on the north beach
  const fw = new THREE.Group(); fw.position.set(-268, 16, -180);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(13, 0.5, 6, 24),
    new THREE.MeshLambertMaterial({ color: 0xff5ad0 }));
  fw.add(rim);
  for (let k = 0; k < 8; k++) {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4),
      new THREE.MeshLambertMaterial({ color: [0xffd23d, 0x37e0ff, 0xff5a5a, 0x9dff6b][k % 4] }));
    const a = (k / 8) * Math.PI * 2;
    cab.position.set(Math.cos(a) * 13, Math.sin(a) * 13, 0); fw.add(cab);
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(26, 0.3, 0.3), trimMat);
    spoke.rotation.z = a; fw.add(spoke);
  }
  const leg = new THREE.Mesh(new THREE.BoxGeometry(1, 16, 1), trimMat);
  leg.position.set(-268, 8, -180); scene.add(leg);
  scene.add(fw); city.ferris = fw;
  // docks: containers + cranes
  const contCols = [0xd23a2e, 0x2e6fd8, 0x1e9e6a, 0xf5c518];
  for (let i = 0; i < 18; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.6),
      new THREE.MeshLambertMaterial({ color: contCols[i % 4] }));
    const x = 252 + (i % 3) * 8, z = -280 + Math.floor(i / 3) * 10;
    c.position.set(x, 1.3 + (i % 2) * 2.7, z); c.rotation.y = (i % 2) * 0.06;
    c.castShadow = true; scene.add(c);
    G.colliders.push({ x0: x - 3, x1: x + 3, z0: z - 1.4, z1: z + 1.4 });
  }
  for (const cx of [268, 296]) {
    const crane = new THREE.Group(); crane.position.set(cx, 0, -120);
    const mast = new THREE.Mesh(new THREE.BoxGeometry(3, 34, 3),
      new THREE.MeshLambertMaterial({ color: 0xf5c518 }));
    mast.position.y = 17; crane.add(mast);
    const jib = new THREE.Mesh(new THREE.BoxGeometry(26, 2, 2), mast.material);
    jib.position.set(8, 32, 0); crane.add(jib);
    scene.add(crane);
  }
  // jetski near the pier
  const jet = new THREE.Group(); jet.position.set(-312, 0.1, 30);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.1),
    new THREE.MeshLambertMaterial({ color: 0x37e0ff }));
  hull.position.y = 0.2; jet.add(hull);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 0.8), trimMat);
  seat.position.set(-0.3, 0.55, 0); jet.add(seat);
  scene.add(jet); city.jetski = jet;
  // taco truck + bus stop props
  const taco = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 2.4),
    new THREE.MeshLambertMaterial({ color: 0xffd23d }));
  taco.position.set(-246, 1.5, 96); taco.rotation.y = Math.PI / 2; scene.add(taco);
  G.colliders.push({ x0: -247.5, x1: -244.5, z0: 93.5, z1: 98.5 });
  // market stalls (vendors stand here)
  const stallCols = [0xff5a5a, 0xffd23d, 0x37e0ff, 0x9dff6b];
  for (let i = 0; i < 8; i++) {
    const sx = -140 + (i % 4) * 12, sz = -132 + Math.floor(i / 4) * 14;
    const stall = new THREE.Group(); stall.position.set(sx, 0, sz);
    const table = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1, 2), new THREE.MeshLambertMaterial({ color: 0x8a6a42 }));
    table.position.y = 0.5; stall.add(table);
    const canopy = new THREE.Mesh(new THREE.PlaneGeometry(4, 3),
      new THREE.MeshLambertMaterial({ color: stallCols[i % 4], side: THREE.DoubleSide }));
    canopy.rotation.x = -Math.PI / 2; canopy.position.y = 2.6; stall.add(canopy);
    const poleM = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5), trimMat);
    poleM.position.set(1.8, 1.3, 1.3); stall.add(poleM);
    scene.add(stall);
    G.vendors.push({ x: sx, z: sz + 2.5, kind: ['tacos', 'buah', 'es', 'bunga'][i % 4] });
  }
  // benches on the malecón
  for (let z = -200; z <= 200; z += 40) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.9),
      new THREE.MeshLambertMaterial({ color: 0x6a4a2a }));
    bench.position.set(-256, 0.6, z); scene.add(bench);
  }
  // birds: two-plane gulls circling high
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x1a1a22, side: THREE.DoubleSide });
  for (let i = 0; i < CFG.birdN; i++) {
    const b = new THREE.Group();
    const w1 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), birdMat);
    w1.position.x = -0.8; b.add(w1);
    const w2 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), birdMat);
    w2.position.x = 0.8; b.add(w2);
    b.userData = { r: R.range(40, 160), h: R.range(55, 95), sp: R.range(0.05, 0.16), ph: R.range(0, 6.28), w1, w2 };
    scene.add(b); G.birds.push(b);
  }
}

export function updateCity(dt) {
  const nf = nightFactor(), t = G.elapsed;
  for (const m of G.city.facadeMats) m.emissiveIntensity = nf * 0.85;
  for (const h of G.neonHalos) h.material.opacity = 0.12 + nf * 0.5;
  for (const lm of G.city.lampMats) lm.color.setHex(nf > 0.5 ? 0xffe9a8 : 0x8a8578);
  for (const tl of G.city.trafficLights) {
    const ph = (t * 0.11 + tl.off) % 3;
    tl.dots[0].material.color.setHex(ph < 1 ? 0xff2a2a : 0x551111);
    tl.dots[1].material.color.setHex(ph >= 1 && ph < 1.3 ? 0xffb02a : 0x554411);
    tl.dots[2].material.color.setHex(ph >= 1.3 ? 0x2aff5a : 0x113311);
  }
  if (G.city.ferris) G.city.ferris.rotation.z += dt * 0.12;
  if (G.city.beam) { G.city.beam.rotation.y += dt * 0.5; G.city.beam.material.opacity = 0.05 + nf * 0.14; }
  if (G.city.jetski) G.city.jetski.position.y = 0.1 + Math.sin(t * 1.4) * 0.12;
  for (const b of G.birds) {
    const u = b.userData, a = t * u.sp + u.ph;
    b.position.set(G.player.pos.x + Math.cos(a) * u.r, u.h, G.player.pos.z + Math.sin(a) * u.r);
    b.rotation.y = -a;
    const flap = Math.sin(t * 6 + u.ph) * 0.55;
    u.w1.rotation.y = flap; u.w2.rotation.y = -flap;
  }
}
