// SOLARA BAY city: 640×640 m of streets, buildings, palms, beach and
// neon. All procedural — canvas textures + instanced geometry, no files.
import * as THREE from 'three';
import { CFG, DISTRICTS } from './config.js';
import { rr, ri, pick, clamp } from './random.js';
import { makeGlowTexture } from './render.js';

const CLEAR = [ // keep these spots free of buildings (mission-critical)
  { x: -60, z: -30, r: 14 }, { x: 222, z: 36, r: 12 }, { x: 216, z: 36, r: 10 },
  { x: 210, z: 30, r: 10 }, { x: 132, z: 60, r: 9 }, { x: -240, z: 90, r: 8 },
  { x: -240, z: 66, r: 8 }, { x: -240, z: 80, r: 8 }, { x: -258, z: 180, r: 10 },
];
function nearClear(x, z) {
  for (const c of CLEAR) { const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz < c.r * c.r) return true; }
  return false;
}
export function districtAt(x, z) {
  for (const d of DISTRICTS) if (d.test(x, z)) return d.name;
  return 'Calle Verde';
}
export function collide(G, x, z, r) {
  // Slide along building AABBs and the world edge.
  const cs = G.city.colliders;
  let nx = clamp(x, -CFG.half + 2, CFG.half - 2);
  let nz = clamp(z, -CFG.half + 2, CFG.half - 2);
  for (const c of cs) {
    if (nx > c.x0 - r && nx < c.x1 + r && nz > c.z0 - r && nz < c.z1 + r) {
      const dxl = nx - (c.x0 - r), dxr = (c.x1 + r) - nx;
      const dzl = nz - (c.z0 - r), dzr = (c.z1 + r) - nz;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) nx = c.x0 - r; else if (m === dxr) nx = c.x1 + r;
      else if (m === dzl) nz = c.z0 - r; else nz = c.z1 + r;
    }
  }
  return { x: nx, z: nz };
}
function facadeTexture(rng, variant) {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const x = c.getContext('2d');
  const bases = ['#c8a06a', '#b08050', '#8a9aa8', '#a89a80', '#c08070', '#7a8a9a'];
  const base = bases[variant % bases.length];
  x.fillStyle = base; x.fillRect(0, 0, 1024, 1024);
  // subtle vertical tint bands
  for (let i = 0; i < 8; i++) {
    x.fillStyle = `rgba(0,0,0,${0.03 + rng() * 0.05})`;
    x.fillRect(i * 128, 0, 64, 1024);
  }
  // brick / panel lines
  x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 2;
  for (let y = 0; y <= 1024; y += 64) { x.beginPath(); x.moveTo(0, y); x.lineTo(1024, y); x.stroke(); }
  // windows: dark glass + lit amber, with frames
  for (let wy = 40; wy < 1000; wy += 96) {
    for (let wx = 32; wx < 1000; wx += 96) {
      const lit = rng() < 0.28;
      x.fillStyle = '#20242e'; x.fillRect(wx - 4, wy - 4, 72, 80);
      x.fillStyle = lit ? (rng() < 0.5 ? '#ffbf5e' : '#ff9e4a') : '#3d4a61';
      x.fillRect(wx, wy, 64, 72);
      x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(wx, wy, 64, 10);
    }
  }
  // ground-floor storefront band
  x.fillStyle = 'rgba(20,16,12,0.85)'; x.fillRect(0, 928, 1024, 96);
  x.fillStyle = '#ffd98a'; x.font = 'bold 44px sans-serif';
  x.fillText(pick(rng, ['SHOP', 'CAFÉ', 'MART', 'BAR', 'HOTEL', 'TACOS']), 24, 990);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function groundTexture(rng) {
  const S = 4096, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const px = (wx) => (wx + 320) / 640 * S;
  // base grass / dirt
  x.fillStyle = '#5a7a4a'; x.fillRect(0, 0, S, S);
  // beach sand west of the promenade
  x.fillStyle = '#d8c090'; x.fillRect(0, 0, px(-252), S);
  // boardwalk strip
  x.fillStyle = '#c8b898'; x.fillRect(px(-266), 0, px(-252) - px(-266), S);
  // asphalt blocks
  x.fillStyle = '#3d434b';
  for (const gx of [-280, -180, -60, 60, 180, 280]) {
    for (const gz of [-280, -180, -60, 60, 180, 280]) {
      x.fillRect(px(gx - 52), px(gz - 52), px(gx + 52) - px(gx - 52), px(gz + 52) - px(gz - 52));
    }
  }
  // speckle + patches + cracks on the asphalt
  for (let i = 0; i < 9000; i++) {
    const a = rng() * 2 * Math.PI, r = rng() * 300;
    x.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)';
    x.fillRect(rng() * S, rng() * S, 2 + rng() * 5, 2 + rng() * 5);
  }
  for (let i = 0; i < 260; i++) {
    x.fillStyle = 'rgba(0,0,0,0.12)';
    x.fillRect(rng() * S, rng() * S, 8 + rng() * 40, 6 + rng() * 26);
  }
  // sidewalk strips flanking every road (pale)
  x.fillStyle = '#9aa0a8';
  for (const g of CFG.grid) {
    x.fillRect(px(g - 10), 0, px(g - 7) - px(g - 10), S);
    x.fillRect(px(g + 7), 0, px(g + 10) - px(g + 7), S);
    x.fillRect(0, px(g - 10), S, px(g - 7) - px(g - 10));
    x.fillRect(0, px(g + 7), S, px(g + 10) - px(g + 7));
  }
  // crosswalk stripes at every intersection
  x.fillStyle = 'rgba(255,255,255,0.85)';
  for (const gx of CFG.grid) for (const gz of CFG.grid) {
    for (let i = -3; i <= 3; i++) {
      x.fillRect(px(gx + i * 2 - 0.8), px(gz - 7), px(gx + i * 2 + 0.8) - px(gx + i * 2 - 0.8), px(gz + 7) - px(gz - 7));
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function textTexture(text, fg, bg, font) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 512, 128);
  x.fillStyle = fg; x.font = font || 'bold 64px sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// Merge small geometries into one (positions/normals/colours/uv).
function mergeGeoms(list) {
  let vc = 0, ic = 0;
  for (const g of list) { vc += g.attributes.position.count; ic += (g.index ? g.index.count : g.attributes.position.count); }
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3);
  const col = new Float32Array(vc * 3), uv = new Float32Array(vc * 2);
  const idx = new Uint32Array(ic);
  let vo = 0, io = 0;
  for (const g of list) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.color) col.set(g.attributes.color.array, vo * 3);
    else for (let i = 0; i < n; i++) { col[vo * 3 + i * 3] = 1; col[vo * 3 + i * 3 + 1] = 1; col[vo * 3 + i * 3 + 2] = 1; }
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    if (g.index) { for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo; io += g.index.count; }
    else { for (let i = 0; i < n; i++) idx[io + i] = vo + i; io += n; }
    vo += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
function tinted(geo, hex) {
  const g = geo.toNonIndexed ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function palmGeometry() {
  const parts = [];
  // leaning 3-segment trunk (rings)
  for (let s = 0; s < 3; s++) {
    const seg = new THREE.CylinderGeometry(0.16 - s * 0.03, 0.22 - s * 0.03, 2.6, 6);
    seg.translate(s * 0.35, 1.3 + s * 2.5, 0);
    seg.rotateZ(-0.06 * s);
    parts.push(tinted(seg, s % 2 ? 0x7a5a38 : 0x8a6a42));
  }
  // 10 drooping fronds: 6 long drooping + 4 flatter, two greens
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const long = i < 6;
    const fr = new THREE.PlaneGeometry(long ? 0.9 : 0.7, long ? 4.6 : 3.2, 1, 3);
    const p = fr.attributes.position;
    for (let v = 0; v < p.count; v++) {
      const y = p.getY(v);
      const droop = Math.max(0, (y + 2.3) / 4.6);
      p.setZ(v, -droop * droop * (long ? 1.6 : 0.9));
    }
    fr.computeVertexNormals();
    fr.translate(0, 7.6, long ? 2.1 : 1.5);
    fr.rotateX(-0.5);
    fr.rotateY(a);
    parts.push(tinted(fr, i % 2 ? 0x2e7a2e : 0x3a9a3a));
  }
  // 3 coconuts
  for (let i = 0; i < 3; i++) {
    const nut = new THREE.SphereGeometry(0.22, 6, 5);
    nut.translate(1.0 + Math.cos(i * 2.1) * 0.3, 7.3, Math.sin(i * 2.1) * 0.3);
    parts.push(tinted(nut, 0x6a4a22));
  }
  const g = mergeGeoms(parts);
  return g;
}

export function buildCity(G) {
  const rng = G.rng;
  const scene = G.fx.scene;
  const city = { colliders: [], neonHalos: [], lamps: [], birds: [], coins: [],
    trafficLights: [], buildings: [], beam: null, ferris: null, jetskis: [] };
  G.city = city;
  const maxAniso = G.fx.renderer.capabilities.getMaxAnisotropy();
  // --- ground (4096², 6.4 px/m) ---
  const gt = groundTexture(rng);
  gt.anisotropy = maxAniso;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(640, 640),
    new THREE.MeshLambertMaterial({ map: gt }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  // --- sea (west of the promenade) ---
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(90, 640),
    new THREE.MeshLambertMaterial({ color: 0x2a7ab5 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(-315, -0.3, 0);
  scene.add(sea);
  // --- road markings as sharp geometry (InstancedMesh) ---
  const dashGeo = new THREE.BoxGeometry(0.5, 0.06, 5);
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xe8c832 });
  const edgeGeo = new THREE.BoxGeometry(0.35, 0.06, 36);
  const edgeMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const zebraGeo = new THREE.BoxGeometry(1.6, 0.06, 10);
  const zebraMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const dashPos = [], edgePos = [], zebraPos = [];
  const roadLines = [...CFG.grid, CFG.ringEast, CFG.ringSouth, CFG.promenade];
  for (const g of CFG.grid) {
    for (let d = -300; d < 300; d += 12) { dashPos.push([g, d, 0]); dashPos.push([d, g, 1]); }
    for (let d = -300; d < 300; d += 36) {
      edgePos.push([g - 6.5, d, 0]); edgePos.push([g + 6.5, d, 0]);
      edgePos.push([d, g - 6.5, 1]); edgePos.push([d, g + 6.5, 1]);
    }
  }
  for (let d = -300; d < 300; d += 12) { dashPos.push([CFG.ringEast, d, 0]); dashPos.push([d, CFG.ringSouth, 1]); dashPos.push([CFG.promenade, d, 0]); }
  for (const gx of CFG.grid) for (const gz of CFG.grid) {
    for (let i = -3; i <= 3; i++) { zebraPos.push([gx + i * 2, gz, 1]); zebraPos.push([gx, gz + i * 2, 0]); }
  }
  const dummy = new THREE.Object3D();
  function fillInstanced(geo, mat, list) {
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((p, i) => {
      dummy.position.set(p[0], 0.05, p[1]);
      dummy.rotation.set(0, p[2] ? Math.PI / 2 : 0, 0);
      dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true; m.receiveShadow = true;
    scene.add(m); return m;
  }
  fillInstanced(dashGeo, dashMat, dashPos);
  fillInstanced(edgeGeo, edgeMat, edgePos);
  fillInstanced(zebraGeo, zebraMat, zebraPos);
  // --- facades (1024², RepeatWrapping per building, aniso 16) ---
  const facades = [];
  for (let v = 0; v < 6; v++) {
    const t = facadeTexture(rng, v);
    t.anisotropy = Math.min(16, maxAniso);
    facades.push(t);
  }
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4440 });
  const winGeo = new THREE.BoxGeometry(1.5, 1.9, 0.15);
  const winDark = new THREE.MeshLambertMaterial({ color: 0x2a3242 });
  const winLit = new THREE.MeshLambertMaterial({ color: 0xffbf5e, emissive: 0xff9e3a, emissiveIntensity: 0.9 });
  const winMats = [winDark, winLit];
  const winSpots = [];
  const blockCenters = [-280, -180, -60, 60, 180, 280];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const buildingMeshes = [];
  let vi = 0;
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      const n = 3 + ri(rng, 0, 1);
      for (let k = 0; k < n; k++) {
        let w = rr(rng, 16, 26), d = rr(rng, 14, 24);
        let cx = bx + rr(rng, -22, 22), cz = bz + rr(rng, -22, 22);
        // coastal strip: keep buildings east of x=-228
        if (bx === -280) { cx = -222 + rr(rng, -4, 6); }
        let h = rr(rng, 9, 26);
        if (Math.abs(bx) < 70 && Math.abs(bz) < 70) h = rr(rng, 30, 70); // plaza towers
        if (bx === 60 && bz === -60 && k === 0) { h = 95; w = 30; d = 30; } // Spire A
        if (bx === 60 && bz === 60 && k === 0) { h = 82; w = 28; d = 28; } // Spire B
        if (nearClear(cx, cz)) continue;
        if (cx - w / 2 < -228 && bx !== -280) cx = -228 + w / 2;
        // Marlin Ceviche: fixed restaurant on the coast
        if (bx === -280 && bz === 60 && k === 0) { cx = -217; cz = 52; w = 22; d = 16; h = 9; }
        const mat = new THREE.MeshLambertMaterial({ map: facades[vi++ % 6] });
        mat.map = facades[(vi - 1) % 6].clone();
        mat.map.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 14)));
        mat.map.needsUpdate = true;
        const mesh = new THREE.Mesh(boxGeo, mat);
        mesh.scale.set(w, h, d);
        mesh.position.set(cx, h / 2, cz);
        mesh.castShadow = true; mesh.receiveShadow = true;
        scene.add(mesh); buildingMeshes.push(mesh);
        city.colliders.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 });
        city.buildings.push({ x: cx, z: cz, w, d, h });
        // windows on two faces
        const floors = Math.max(1, Math.floor(h / 5));
        const cols = Math.max(2, Math.floor(w / 5));
        for (let f = 0; f < floors; f++) for (let cI = 0; cI < cols; cI++) {
          if (winSpots.length > 3000) break;
          const wx = cx - w / 2 + 3 + cI * ((w - 6) / Math.max(1, cols - 1));
          const wy = 3 + f * 5;
          winSpots.push([wx, wy, cz + d / 2 + 0.1, 0, rng() < 0.25 ? 1 : 0]);
          winSpots.push([wx, wy, cz - d / 2 - 0.1, 0, rng() < 0.25 ? 1 : 0]);
        }
      }
    }
  }
  // windows: two instanced meshes (dark + lit)
  for (let mi = 0; mi < 2; mi++) {
    const spots = winSpots.filter((s) => s[4] === mi);
    if (!spots.length) continue;
    const m = new THREE.InstancedMesh(winGeo, winMats[mi], spots.length);
    spots.forEach((s, i) => {
      dummy.position.set(s[0], s[1], s[2]); dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    scene.add(m);
  }
  // rooftop AC units, water towers, antennas (instanced)
  const acGeo = new THREE.BoxGeometry(1.6, 1, 1.6);
  const acMat = new THREE.MeshLambertMaterial({ color: 0x9a9a9a });
  const acSpots = city.buildings.filter(() => rng() < 0.6).map((b) => [b.x, b.h + 0.5, b.z]);
  const acMesh = new THREE.InstancedMesh(acGeo, acMat, Math.max(1, acSpots.length));
  acSpots.forEach((s, i) => { dummy.position.set(s[0], s[1], s[2]); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); acMesh.setMatrixAt(i, dummy.matrix); });
  acMesh.instanceMatrix.needsUpdate = true; scene.add(acMesh);
  // --- storefront awnings + shop signs + neon signs ---
  const awnGeo = new THREE.BoxGeometry(6, 0.4, 2.4);
  const awnColors = [0xc23a3a, 0x2a7a4a, 0x2a5a9a, 0xe8a23a];
  const awnSpots = [];
  const signDefs = [
    ['TACOS', '#ffd23a', '#7a1a1a'], ['DONUTS', '#ff9ecf', '#4a2a6a'],
    ['BAR', '#7ae8ff', '#1a2a4a'], ['HOTEL', '#8affc8', '#123a2a'],
    ['PIZZA', '#ff8a3a', '#5a1a0a'], ['24H MART', '#ffffff', '#1a5a8a'],
  ];
  const shopSpots = [];
  for (let i = 0; i < 22; i++) {
    const b = pick(rng, city.buildings);
    if (!b || b.h > 40) continue;
    const face = rng() < 0.5 ? 1 : -1;
    shopSpots.push({ x: b.x + rr(rng, -b.w / 3, b.w / 3), y: 2.6, z: b.z + face * (b.d / 2 + 0.15), face, def: signDefs[i % signDefs.length] });
    awnSpots.push({ x: b.x, z: b.z + face * (b.d / 2 + 1.1), c: awnColors[i % 4] });
  }
  for (const s of shopSpots) {
    const tex = textTexture(s.def[0], s.def[1], s.def[2]);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75),
      new THREE.MeshBasicMaterial({ map: tex }));
    m.position.set(s.x, s.y, s.z);
    if (s.face < 0) m.rotation.y = Math.PI;
    scene.add(m);
  }
  const awnMesh = new THREE.InstancedMesh(awnGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), Math.max(1, awnSpots.length));
  awnSpots.forEach((s, i) => {
    dummy.position.set(s.x, 3.4, s.z); dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix(); awnMesh.setMatrixAt(i, dummy.matrix);
    awnMesh.setColorAt(i, new THREE.Color(s.c));
  });
  awnMesh.instanceMatrix.needsUpdate = true;
  if (awnMesh.instanceColor) awnMesh.instanceColor.needsUpdate = true;
  scene.add(awnMesh);
  // neon signs (8) with additive halos
  const neonDefs = [
    ['FLAMINGO FM', '#ff5ec8', -252, 120, 10], ['VICE HOTEL', '#4ae8ff', 120, -240, 12],
    ['TACOS 24H', '#ffe23a', -120, 240, 9], ['MARLIN CEVICHE', '#ff7a5e', -217, 61, 8],
    ['HOTEL', '#4affc8', 240, 120, 11], ['NEON', '#ff4a6a', 0, 240, 10],
    ['PIZZA', '#ffb03a', -60, -120, 9], ['BAR', '#7ae8ff', 180, -60, 9],
  ];
  for (const [txt, col, nx, nz, ny] of neonDefs) {
    const tex = textTexture(txt, col, '#0a0a14');
    const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 3),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    m.position.set(nx, ny, nz);
    m.rotation.y = nx < -200 ? Math.PI / 2 : 0;
    scene.add(m);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(20, 8),
      new THREE.MeshBasicMaterial({ map: G.fx.glowTex, color: new THREE.Color(col),
        transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.set(nx, ny, nz + (nx < -200 ? 0.2 : 0.4));
    halo.rotation.y = m.rotation.y;
    scene.add(halo);
    city.neonHalos.push(halo);
  }
  // --- palms: one merged detailed geometry, single InstancedMesh ---
  const palmGeo = palmGeometry();
  const palmMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const palmSpots = [];
  for (let z = -300; z <= 300; z += 36) { palmSpots.push([-252, z]); palmSpots.push([-246, z + 18]); }
  for (let x = -240; x <= 240; x += 36) { palmSpots.push([x, -9]); palmSpots.push([x, 9]); }
  for (let z = -240; z <= 240; z += 36) { palmSpots.push([-9, z]); palmSpots.push([9, z]); }
  const palmMesh = new THREE.InstancedMesh(palmGeo, palmMat, palmSpots.length);
  palmSpots.forEach((p, i) => {
    dummy.position.set(p[0], 0, p[1]);
    dummy.rotation.set(0, rng() * Math.PI * 2, 0);
    const s = rr(rng, 0.9, 1.25); dummy.scale.set(s, s, s);
    dummy.updateMatrix(); palmMesh.setMatrixAt(i, dummy.matrix);
  });
  palmMesh.instanceMatrix.needsUpdate = true;
  palmMesh.castShadow = true;
  scene.add(palmMesh);
  // --- 24 shade trees ---
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3a7a2e });
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 3, 6);
  const leafGeo = new THREE.SphereGeometry(2.6, 8, 6);
  const treeSpots = [];
  for (let i = 0; i < 24; i++) treeSpots.push([rr(rng, -280, 280), rr(rng, -280, 280)]);
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, treeSpots.length);
  treeSpots.forEach((p, i) => {
    dummy.position.set(p[0], 1.5, p[1]); dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1); dummy.updateMatrix(); trunkMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p[0], 4.2, p[1]); dummy.updateMatrix(); leafMesh.setMatrixAt(i, dummy.matrix);
  });
  trunkMesh.instanceMatrix.needsUpdate = true; leafMesh.instanceMatrix.needsUpdate = true;
  leafMesh.castShadow = true;
  scene.add(trunkMesh); scene.add(leafMesh);
  // --- street props: hydrants, benches, bins, planters ---
  const propGeo = new THREE.BoxGeometry(0.7, 1, 0.7);
  const propMat = new THREE.MeshLambertMaterial({ color: 0xc23a3a });
  const props = [];
  for (let i = 0; i < 40; i++) {
    const g = pick(rng, CFG.grid);
    props.push([g + (rng() < 0.5 ? -9 : 9), rr(rng, -280, 280)]);
  }
  const propMesh = new THREE.InstancedMesh(propGeo, propMat, props.length);
  props.forEach((p, i) => { dummy.position.set(p[0], 0.5, p[1]); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); propMesh.setMatrixAt(i, dummy.matrix); });
  propMesh.instanceMatrix.needsUpdate = true; scene.add(propMesh);
  // --- traffic lights at 4 intersections ---
  const tlIntersections = [[0, 0], [120, -120], [-120, 120], [120, 120]];
  for (const [ix, iz] of tlIntersections) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    pole.position.set(ix + 8, 3, iz + 8); scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    head.position.set(ix + 8, 6.2, iz + 8); scene.add(head);
    const dots = [];
    for (let d = 0; d < 3; d++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x330000 }));
      dot.position.set(ix + 8, 6.9 - d * 0.6, iz + 8.4);
      scene.add(dot); dots.push(dot);
    }
    city.trafficLights.push({ dots, phase: rng() * 9, x: ix, z: iz });
  }
  // --- street lamps (glow sprites, lit at night) ---
  for (const g of CFG.grid) {
    for (let d = -240; d <= 240; d += 120) {
      const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.fx.glowTex,
        color: 0xffd98a, transparent: true, opacity: 0, depthWrite: false }));
      lamp.scale.set(9, 9, 1); lamp.position.set(g + 8, 6, d);
      scene.add(lamp); city.lamps.push(lamp);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6),
        new THREE.MeshLambertMaterial({ color: 0x333333 }));
      pole.position.set(g + 8, 3, d); scene.add(pole);
    }
  }
  // --- lighthouse + rotating beam ---
  const lh = new THREE.Group();
  const lhBody = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, 26, 10),
    new THREE.MeshLambertMaterial({ color: 0xe8e0d0 }));
  lhBody.position.y = 13; lh.add(lhBody);
  const lhStripe = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 4, 10),
    new THREE.MeshLambertMaterial({ color: 0xc23a3a }));
  lhStripe.position.y = 18; lh.add(lhStripe);
  const lhTop = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 3, 10),
    new THREE.MeshLambertMaterial({ color: 0x222831 }));
  lhTop.position.y = 27; lh.add(lhTop);
  lh.position.set(CFG.lighthouse.x, 0, CFG.lighthouse.z);
  scene.add(lh);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.rotation.z = Math.PI / 2; beam.position.set(CFG.lighthouse.x, 28, CFG.lighthouse.z);
  scene.add(beam);
  city.beam = beam;
  city.colliders.push({ x0: CFG.lighthouse.x - 5, z0: CFG.lighthouse.z - 5, x1: CFG.lighthouse.x + 5, z1: CFG.lighthouse.z + 5 });
  // --- pier + ferris wheel ---
  const pier = new THREE.Mesh(new THREE.BoxGeometry(22, 1, 8),
    new THREE.MeshLambertMaterial({ color: 0x8a6a42 }));
  pier.position.set(-269, 0.6, 20); scene.add(pier);
  const ferris = new THREE.Group();
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(16, 1, 8, 24),
    new THREE.MeshLambertMaterial({ color: 0xff5e8a }));
  ferris.add(wheel);
  for (let i = 0; i < 8; i++) {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4),
      new THREE.MeshLambertMaterial({ color: pick(rng, [0xffd23a, 0x4ae8ff, 0x8affc8, 0xff8a3a]) }));
    const a = (i / 8) * Math.PI * 2;
    cab.position.set(Math.cos(a) * 16, Math.sin(a) * 16, 0);
    ferris.add(cab);
  }
  ferris.position.set(CFG.ferris.x, 18, CFG.ferris.z);
  scene.add(ferris);
  city.ferris = ferris;
  // --- beach: umbrellas, towels, lifeguard tower, bonfire ---
  for (let i = 0; i < 8; i++) {
    const ux = -262 + rng() * 6, uz = -200 + i * 55 + rng() * 10;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6),
      new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    pole.position.set(ux, 1.3, uz); scene.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 8),
      new THREE.MeshLambertMaterial({ color: pick(rng, [0xff5e8a, 0x4ae8ff, 0xffd23a, 0xff8a3a]) }));
    top.position.set(ux, 3, uz); scene.add(top);
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3),
      new THREE.MeshLambertMaterial({ color: pick(rng, [0xff5e8a, 0x4ae8ff, 0xffd23a]) }));
    towel.rotation.x = -Math.PI / 2; towel.position.set(ux + 3, 0.1, uz + 2); scene.add(towel);
  }
  const tower = new THREE.Group();
  const tLegs = new THREE.Mesh(new THREE.BoxGeometry(2.5, 4, 2.5),
    new THREE.MeshLambertMaterial({ color: 0xffffff }));
  tLegs.position.y = 2; tower.add(tLegs);
  const tTop = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.5, 3.5),
    new THREE.MeshLambertMaterial({ color: 0xc23a3a }));
  tTop.position.y = 4.6; tower.add(tTop);
  tower.position.set(-260, 0, 60); scene.add(tower);
  // bonfire
  const fire = new THREE.Group();
  const logs = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.6, 6),
    new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
  logs.position.y = 0.8; fire.add(logs);
  const fireLight = new THREE.PointLight(0xff8a3a, 30, 30);
  fireLight.position.y = 2; fire.add(fireLight);
  fire.position.set(CFG.bonfire.x, 0, CFG.bonfire.z);
  scene.add(fire);
  city.bonfire = fire;
  // --- market stalls (Old Solara) ---
  for (let i = 0; i < 4; i++) {
    const stall = new THREE.Group();
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 2),
      new THREE.MeshLambertMaterial({ color: 0x8a6a42 }));
    counter.position.y = 0.6; stall.add(counter);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 2.6),
      new THREE.MeshLambertMaterial({ color: pick(rng, [0xc23a3a, 0x2a7a4a, 0xe8a23a]) }));
    awn.position.y = 2.4; stall.add(awn);
    stall.position.set(-60 + i * 8, 0, 120);
    scene.add(stall);
  }
  // --- jetskis in the water ---
  for (let i = 0; i < 2; i++) {
    const ski = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 1),
      new THREE.MeshLambertMaterial({ color: i ? 0x4ae8ff : 0xffd23a }));
    hull.position.y = 0.2; ski.add(hull);
    ski.position.set(-278 + i * 6, 0, 40 + i * 20);
    scene.add(ski);
    city.jetskis.push(ski);
  }
  // --- sun coins (30) on sidewalks ---
  const coinGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.15, 12);
  const coinMat = new THREE.MeshLambertMaterial({ color: 0xffd23a, emissive: 0xa88000, emissiveIntensity: 0.6 });
  for (let i = 0; i < CFG.sunCoins; i++) {
    const g = pick(rng, CFG.grid);
    const cx = rng() < 0.5 ? g + 9 : rr(rng, -280, 280);
    const cz = rng() < 0.5 ? rr(rng, -280, 280) : g + 9;
    const coin = new THREE.Mesh(coinGeo, coinMat);
    coin.position.set(cx, 1, cz);
    coin.rotation.x = Math.PI / 2;
    scene.add(coin);
    city.coins.push({ mesh: coin, x: cx, z: cz, taken: false });
  }
  // --- birds: 22, two thin dark planes each ---
  const wingGeo = new THREE.PlaneGeometry(1.6, 0.5);
  const wingMat = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide });
  for (let i = 0; i < CFG.birdN; i++) {
    const bird = new THREE.Group();
    const wl = new THREE.Mesh(wingGeo, wingMat); wl.position.x = -0.8; bird.add(wl);
    const wr = new THREE.Mesh(wingGeo, wingMat); wr.position.x = 0.8; bird.add(wr);
    scene.add(bird);
    city.birds.push({ g: bird, wl, wr, r: rr(rng, 40, 130), h: rr(rng, 40, 90),
      a: rng() * Math.PI * 2, sp: rr(rng, 0.05, 0.16) * (rng() < 0.5 ? 1 : -1),
      cx: rr(rng, -120, 120), cz: rr(rng, -120, 120), ph: rng() * 6 });
  }
  return city;
}
export function updateCityFx(G, dt) {
  const city = G.city; if (!city) return;
  const t = G.t;
  // traffic lights: green 4 s -> amber 1 s -> red 4 s, offset per light
  for (const tl of city.trafficLights) {
    const ph = (t + tl.phase) % 9;
    const state = ph < 4 ? 0 : ph < 5 ? 1 : 2; // 0 green, 1 amber, 2 red
    const cols = [0x003300, 0x331a00, 0x330000];
    tl.dots.forEach((dot, i) => {
      dot.material.color.setHex(i === state ? [0x00ff44, 0xffaa00, 0xff2222][i] : cols[i]);
    });
  }
  // birds: circle + flap
  for (const b of city.birds) {
    b.a += b.sp * dt;
    b.g.position.set(b.cx + Math.cos(b.a) * b.r, b.h + Math.sin(t * 0.7 + b.ph) * 3, b.cz + Math.sin(b.a) * b.r);
    b.g.rotation.y = -b.a - (b.sp > 0 ? 0 : Math.PI);
    const flap = Math.sin(t * 6 + b.ph) * 0.55;
    b.wl.rotation.z = flap; b.wr.rotation.z = -flap;
  }
  // lighthouse beam sweeps
  if (city.beam) {
    city.beam.rotation.y = t * 0.5;
    city.beam.material.opacity = (G.timeOfDay >= 19 || G.timeOfDay < 6) ? 0.22 : 0.07;
  }
  if (city.ferris) city.ferris.rotation.z += dt * 0.05;
  // jetskis bob
  city.jetskis.forEach((s, i) => { s.position.y = Math.sin(t * 1.3 + i * 2) * 0.25; });
  // bonfire flicker
  if (city.bonfire) {
    const l = city.bonfire.children[1];
    if (l) l.intensity = 26 + Math.sin(t * 9) * 6 + Math.sin(t * 23) * 3;
  }
  // sun coins spin
  for (const c of city.coins) {
    if (!c.taken) { c.mesh.rotation.y += dt * 2; c.mesh.position.y = 1 + Math.sin(t * 2 + c.x) * 0.15; }
  }
}
