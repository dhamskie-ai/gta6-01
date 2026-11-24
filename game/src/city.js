// SOLARA BAY city generation: ground, roads + geometry markings, buildings,
// palms, signs + neon, traffic lights, birds, landmarks, beach + sea.
import * as THREE from 'three';
import { G, CFG, clamp } from './config.js';
import { RNG } from './random.js';

export function makeTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function textTex(text, fg, bg, sub = '') {
  return makeTex(512, 128, (x) => {
    x.fillStyle = bg; x.fillRect(0, 0, 512, 128);
    x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(4, 4, 504, 120);
    x.fillStyle = fg; x.font = 'bold 56px Arial'; x.textAlign = 'center';
    x.fillText(text, 256, sub ? 62 : 82);
    if (sub) { x.font = 'bold 30px Arial'; x.fillText(sub, 256, 106); }
  });
}
function facadeTex(base, litRatio, winDark) {
  return makeTex(1024, 1024, (x) => {
    x.fillStyle = base; x.fillRect(0, 0, 1024, 1024);
    for (let r = 0; r < 12; r++) for (let c = 0; c < 8; c++) {
      const lit = Math.random() < litRatio;
      x.fillStyle = lit ? (Math.random() < 0.5 ? '#ffca7a' : '#ffb36b') : winDark;
      x.fillRect(40 + c * 120, 40 + r * 80, 72, 52);
    }
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 980, 1024, 44);
  });
}
function groundTex() {
  const S = 4096, m = S / 640; // px per metre
  const X = (wx) => (wx + 320) * m, Z = (wz) => (wz + 320) * m;
  return makeTex(S, S, (x) => {
    x.fillStyle = '#7d8a6a'; x.fillRect(0, 0, S, S); // base grass/concrete
    // Sea (west, beyond the beach) + sand strip.
    const sea = x.createLinearGradient(0, 0, X(-258), 0);
    sea.addColorStop(0, '#1d5a8a'); sea.addColorStop(1, '#2f7fb5');
    x.fillStyle = sea; x.fillRect(0, 0, X(-272), S);
    x.fillStyle = '#d9c08a'; x.fillRect(X(-272), 0, X(-258) - X(-272), S);
    // Block interiors: concrete / park green.
    const rng = new RNG(99);
    for (const bx of [-180, -60, 60, 180]) for (const bz of [-180, -60, 60, 180]) {
      x.fillStyle = rng.chance(0.3) ? '#6f9a5e' : '#8f8c82';
      x.fillRect(X(bx - 54), Z(bz - 54), 108 * m, 108 * m);
    }
    // Roads: asphalt + pale sidewalk strips.
    const roads = [...CFG.roads, CFG.ringE, CFG.ringS, CFG.prom];
    for (const r of CFG.roads) {
      x.fillStyle = '#c8c4b8';
      x.fillRect(X(r - 9), 0, 18 * m, S); x.fillRect(0, Z(r - 9), S, 18 * m);
      x.fillStyle = '#3d434b';
      x.fillRect(X(r - 6), 0, 12 * m, S); x.fillRect(0, Z(r - 6), S, 12 * m);
    }
    x.fillStyle = '#c8c4b8'; x.fillRect(X(CFG.ringE - 9), 0, 18 * m, S);
    x.fillStyle = '#3d434b'; x.fillRect(X(CFG.ringE - 6), 0, 12 * m, S);
    x.fillStyle = '#c8c4b8'; x.fillRect(0, Z(CFG.ringS - 9), S, 18 * m);
    x.fillStyle = '#3d434b'; x.fillRect(0, Z(CFG.ringS - 6), S, 12 * m);
    x.fillStyle = '#c8c4b8'; x.fillRect(X(CFG.prom - 9), 0, 18 * m, S);
    x.fillStyle = '#c8c4b8'; x.fillRect(X(CFG.prom - 6), 0, 12 * m, S);
    // Crosswalk stripes at every intersection.
    x.fillStyle = 'rgba(240,240,230,0.9)';
    for (const rx of CFG.roads) for (const rz of CFG.roads) {
      for (let i = -2; i <= 2; i++) {
        x.fillRect(X(rx + i * 2.4 - 0.7), Z(rz - 6), 1.4 * m, 3 * m);
        x.fillRect(X(rx + i * 2.4 - 0.7), Z(rz + 3), 1.4 * m, 3 * m);
      }
    }
  });
}
// Merge several transformed geometries into one (vertex-coloured).
function mergeGeoms(parts) {
  const pos = [], nor = [], col = [], uv = [];
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  const tmp = new THREE.Matrix4();
  for (const { geo, matrix, color } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position, nn = g.attributes.normal, u = g.attributes.uv;
    const c = new THREE.Color(color);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      pos.push(v.x, v.y, v.z);
      n.fromBufferAttribute(nn, i).transformDirection(matrix);
      nor.push(n.x, n.y, n.z);
      col.push(c.r, c.g, c.b);
      uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}
function palmGeometry() {
  const parts = [];
  const M = (x, y, z, rx, ry, rz, s = 1) => {
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
    m.setPosition(x, y, z); m.scale(new THREE.Vector3(s, s, s)); return m;
  };
  // Leaning 3-segment trunk.
  let tx = 0, ty = 0, lean = 0;
  for (let i = 0; i < 3; i++) {
    lean += 0.09;
    parts.push({ geo: new THREE.CylinderGeometry(0.16, 0.22, 2.6, 6), matrix: M(tx, ty + 1.3, 0, lean, 0, 0.06), color: 0x8a6a48 });
    ty += 2.5; tx += 0.16;
  }
  const topY = ty, topX = tx;
  // 10 drooping fronds: 6 long + 4 flatter, two greens.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const long = i < 6;
    const f = new THREE.PlaneGeometry(0.7, long ? 3.4 : 2.4, 1, 3);
    const p = f.attributes.position;
    for (let j = 0; j < p.count; j++) {
      const yy = p.getY(j); // -len/2 .. len/2
      p.setZ(j, -Math.pow((yy + (long ? 1.7 : 1.2)) / (long ? 1.7 : 1.2), 2) * 0.9);
    }
    f.computeVertexNormals();
    parts.push({ geo: f, matrix: M(topX, topY + 0.2, 0, -1.05 - (long ? 0.25 : 0), a, 0), color: i % 2 ? 0x2f8a3a : 0x3fae4e });
  }
  for (let i = 0; i < 3; i++) {
    parts.push({ geo: new THREE.SphereGeometry(0.22, 6, 5), matrix: M(topX + 0.3 * Math.cos(i * 2.1), topY - 0.15, 0.3 * Math.sin(i * 2.1), 0, 0, 0), color: 0x6a4a28 });
  }
  return mergeGeoms(parts);
}
export function districtAt(x, z) {
  if (x < -235) return 'MALECÓN CELESTE';
  if (x > 180 && z > 120) return 'THE DOCKS';
  if (Math.abs(x) < 70 && Math.abs(z) < 70) return 'THE SPIRES';
  if (z < -180) return 'VISTA HILLS';
  if (x < -120 && z > 120) return 'OLD SOLARA';
  if (z > 180) return 'CALLE VERDE';
  return 'MARINA BAY';
}
export function collides(x, z, r = 0.6) {
  if (Math.abs(x) > 314 || Math.abs(z) > 314) return true;
  if (x < -266) return true; // sea
  for (const c of G.colliders) {
    if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return true;
  }
  return false;
}
export function buildCity() {
  const scene = G.scene, rng = new RNG(G.seed);
  const maxAniso = G.renderer.capabilities.getMaxAnisotropy();
  // Ground 4096².
  const gt = groundTex();
  gt.anisotropy = Math.min(16, maxAniso);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(640, 640),
    new THREE.MeshLambertMaterial({ map: gt }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  // Facade materials: 3 variants, 1024², RepeatWrapping, aniso 16.
  const facades = [
    facadeTex('#c8a06a', 0.35, '#3d4a61'),
    facadeTex('#a88a7a', 0.3, '#3d4a61'),
    facadeTex('#7a8aa0', 0.42, '#3d4a61'),
  ].map((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Math.min(16, maxAniso);
    return new THREE.MeshLambertMaterial({ map: t });
  });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4a50 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const addBuilding = (x, z, w, h, d, matI, awning = false) => {
    const m = new THREE.Mesh(boxGeo, facades[matI % 3]);
    m.scale.set(w, h, d); m.position.set(x, h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    m.material.map.repeat.set(Math.max(1, Math.round(w / 18)), Math.max(1, Math.round(h / 22)));
    scene.add(m);
    const roof = new THREE.Mesh(boxGeo, roofMat);
    roof.scale.set(w * 0.92, 0.6, d * 0.92); roof.position.set(x, h + 0.3, z);
    scene.add(roof);
    const ac = new THREE.Mesh(boxGeo, roofMat);
    ac.scale.set(1.6, 0.8, 1.6); ac.position.set(x + w * 0.2, h + 0.9, z);
    scene.add(ac);
    if (awning) {
      const aw = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xc03028 }));
      aw.scale.set(w * 0.7, 0.25, 1.6); aw.position.set(x, 3.1, z + d / 2 + 0.7);
      scene.add(aw);
    }
    G.colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
    return m;
  };
  // Marlin Ceviche restaurant (meet point is on the road in front of it).
  addBuilding(-222, 52, 26, 9, 16, 0, true);
  // Blocks: 3–4 buildings each.
  const towerBlocks = new Set(['60,-60', '60,60']);
  for (const bx of [-180, -60, 60, 180]) for (const bz of [-180, -60, 60, 180]) {
    if (towerBlocks.has(bx + ',' + bz)) continue;
    const n = 3 + rng.int(0, 1);
    for (let i = 0; i < n; i++) {
      const ox = bx + rng.range(-34, 34), oz = bz + rng.range(-34, 34);
      const w = rng.range(16, 26), d = rng.range(14, 22);
      const h = districtAt(ox, oz) === 'THE SPIRES' ? rng.range(24, 48) : rng.range(8, 26);
      if (Math.abs(ox - bx) > 40 || Math.abs(oz - bz) > 40) continue;
      addBuilding(ox, oz, w, h, d, rng.int(0, 2), rng.chance(0.4));
    }
  }
  // 2 Spires towers + 4 Plaza towers.
  const tower = (x, z, w, h, d) => {
    const m = addBuilding(x, z, w, h, d, 2);
    m.material = new THREE.MeshLambertMaterial({ color: 0x9fc4e8, emissive: 0x223344 });
    return m;
  };
  tower(-48, -48, 26, 95, 26); tower(80, 40, 24, 80, 24);
  tower(24, 24, 20, 48, 20); tower(24, 96, 20, 55, 20);
  tower(96, 24, 20, 42, 20); tower(96, 96, 20, 60, 20);
  // Road markings as geometry (InstancedMesh): dashes, edge lines, zebra.
  const markGeo = new THREE.BoxGeometry(1, 1, 1);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf2f2ea });
  const dashXf = [], zebraXf = [], edgeXf = [];
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
  const pushMark = (arr, x, y, z, w, d, ry = 0) => {
    Q.setFromEuler(E.set(0, ry, 0));
    M4.compose(new THREE.Vector3(x, y, z), Q, new THREE.Vector3(w, 0.06, d));
    arr.push(M4.clone());
  };
  for (const r of CFG.roads) {
    for (let s = -300; s <= 300; s += 12) {
      pushMark(dashXf, r, 0.05, s, 0.35, 3); pushMark(dashXf, s, 0.05, r, 3, 0.35);
    }
    for (let s = -310; s <= 310; s += 24) {
      pushMark(edgeXf, r - 5.6, 0.05, s, 0.25, 10); pushMark(edgeXf, r + 5.6, 0.05, s, 0.25, 10);
      pushMark(edgeXf, s, 0.05, r - 5.6, 10, 0.25); pushMark(edgeXf, s, 0.05, r + 5.6, 10, 0.25);
    }
  }
  for (const r of [CFG.ringE, CFG.ringS, CFG.prom]) {
    for (let s = -300; s <= 300; s += 12) pushMark(dashXf, r, 0.05, s, 0.35, 3);
    for (let s = -300; s <= 300; s += 12) pushMark(dashXf, s, 0.05, r, 3, 0.35);
  }
  for (const rx of CFG.roads) for (const rz of CFG.roads) {
    for (let i = -2; i <= 2; i++) {
      pushMark(zebraXf, rx + i * 2.4, 0.05, rz - 7.5, 1.2, 2.6);
      pushMark(zebraXf, rx + i * 2.4, 0.05, rz + 7.5, 1.2, 2.6);
      pushMark(zebraXf, rx - 7.5, 0.05, rz + i * 2.4, 2.6, 1.2);
      pushMark(zebraXf, rx + 7.5, 0.05, rz + i * 2.4, 2.6, 1.2);
    }
  }
  const inst = (arr, mat) => {
    const im = new THREE.InstancedMesh(markGeo, mat, arr.length);
    arr.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true; scene.add(im); return im;
  };
  inst(dashXf, dashMat); inst(zebraXf, whiteMat); inst(edgeXf, whiteMat);
  // Palms: merged geometry, InstancedMesh, coast + plaza + avenue rows + 2nd row.
  const palmGeo = palmGeometry();
  const palmMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const palmSpots = [];
  for (let z = -300; z <= 300; z += 36) {
    palmSpots.push([-252, z]); palmSpots.push([-252 + 8, z + 18]);
    palmSpots.push([-8, z]); palmSpots.push([8, z + 18]);
  }
  for (let x = -240; x <= 300; x += 36) {
    palmSpots.push([x, -8]); palmSpots.push([x + 18, 8]);
  }
  for (let i = 0; i < 12; i++) palmSpots.push([-60 + rng.range(-40, 40), -60 + rng.range(-40, 40)]);
  const palms = new THREE.InstancedMesh(palmGeo, palmMat, palmSpots.length);
  palmSpots.forEach(([x, z], i) => {
    if (collides(x, z, 1)) return;
    Q.setFromEuler(E.set(0, rng.range(0, Math.PI * 2), 0));
    const s = rng.range(0.9, 1.25);
    M4.compose(new THREE.Vector3(x, 0, z), Q, new THREE.Vector3(s, s, s));
    palms.setMatrixAt(i, M4);
  });
  palms.instanceMatrix.needsUpdate = true; palms.castShadow = true;
  scene.add(palms);
  // 24 shade trees (trunk + round canopy).
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a28 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8a4a });
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6);
  const leafGeo = new THREE.IcosahedronGeometry(2.2, 1);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, CFG.shadeTrees);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, CFG.shadeTrees);
  // Keep staged shot sightlines clear of big canopies.
  const clearSpots = [[-252, 108], [-240, 84], [-240, 66], [-240, 120], [-258, 20]];
  for (let i = 0; i < CFG.shadeTrees; i++) {
    const x = rng.range(-280, 300), z = rng.range(-280, 300);
    const nearShot = clearSpots.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 15);
    if (nearShot || collides(x, z, 2)) { M4.makeScale(0, 0, 0); trunks.setMatrixAt(i, M4); leaves.setMatrixAt(i, M4); continue; }
    Q.setFromEuler(E.set(0, 0, 0));
    M4.compose(new THREE.Vector3(x, 1.2, z), Q, new THREE.Vector3(1, 1, 1));
    trunks.setMatrixAt(i, M4);
    M4.compose(new THREE.Vector3(x, 3.6, z), Q, new THREE.Vector3(1, 1.2, 1));
    leaves.setMatrixAt(i, M4);
  }
  trunks.instanceMatrix.needsUpdate = true; leaves.instanceMatrix.needsUpdate = true;
  leaves.castShadow = true;
  scene.add(trunks); scene.add(leaves);
  // Shop signs (~22) + neon signs (8) with additive halos.
  const shopDefs = [['TACOS', '#ffd23e', '#7a1e1e'], ['DONUTS', '#ff9ecf', '#3a2a55'], ['BAR', '#7ae0ff', '#12233a'],
    ['HOTEL', '#7ae0ff', '#0f2a2a'], ['PIZZA', '#ffb36b', '#5a1e12'], ['24H MART', '#a8ff7a', '#1e3a1e']];
  const haloTex = makeTex(128, 128, (x) => {
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  });
  const signSpots = [];
  for (let i = 0; i < 22; i++) {
    const bx = rng.pick([-180, -60, 60, 180]) + rng.range(-30, 30);
    const bz = rng.pick([-180, -60, 60, 180]) + rng.range(-30, 30);
    signSpots.push([bx, bz]);
  }
  signSpots.forEach(([x, z], i) => {
    const [txt, fg, bg] = shopDefs[i % shopDefs.length];
    const t = textTex(txt, fg, bg);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75),
      new THREE.MeshBasicMaterial({ map: t }));
    p.position.set(x, 2.6, z + 8); scene.add(p);
  });
  const neonDefs = [
    ['FLAMINGO FM', '#ff5ea8', -252, 150], ['VICE HOTEL', '#4ae0ff', 30, 130],
    ['TACOS 24H', '#ffd23e', -222, 52], ['HOTEL', '#4ae0ff', 60, -60],
    ['BAR', '#ff7a5a', -120, 0], ['PIZZA', '#ffb36b', 120, 120],
    ['DONUTS', '#ff9ecf', -60, 180], ['CLUB NEON', '#c07aff', 0, -120],
  ];
  for (const [txt, fg, x, z] of neonDefs) {
    const t = textTex(txt, fg, '#0a0a14');
    const p = new THREE.Mesh(new THREE.PlaneGeometry(12, 3),
      new THREE.MeshBasicMaterial({ map: t }));
    p.position.set(x, 14, z); scene.add(p);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(20, 8),
      new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, opacity: 0.12, color: fg, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.set(x, 14, z - 0.3); scene.add(halo);
    G.neonHalos.push(halo);
  }
  // Traffic lights at 4 intersections.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
  const lampMats = {
    red: new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
    amber: new THREE.MeshBasicMaterial({ color: 0xffb32a }),
    green: new THREE.MeshBasicMaterial({ color: 0x2aff5a }),
    off: new THREE.MeshBasicMaterial({ color: 0x331111 }),
  };
  for (const [ix, iz, off] of [[0, 0, 0], [120, -120, 2.2], [-120, 120, 4.5], [120, 120, 6.7]]) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 6), poleMat);
    pole.position.y = 2.5; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 0.15), poleMat);
    arm.position.set(1.4, 4.8, 0); g.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.4), poleMat);
    head.position.set(2.8, 4.4, 0); g.add(head);
    const dots = {};
    [['red', 4.75], ['amber', 4.4], ['green', 4.05]].forEach(([k, y]) => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lampMats.off.clone());
      d.position.set(2.8, y, 0.25); g.add(d); dots[k] = d;
    });
    g.position.set(ix + 7, 0, iz + 7);
    scene.add(g);
    G.trafficLights.push({ x: ix, z: iz, off, dots, state: 'green', t: 0 });
  }
  // Street lamps along the roads.
  const lampGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.5, 6);
  const lampHeadGeo = new THREE.SphereGeometry(0.3, 8, 6);
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  G.lampHeadMat = lampHeadMat;
  const lampSpots = [];
  for (const r of CFG.roads) for (let s = -280; s <= 280; s += 60) {
    lampSpots.push([r + 7.5, s]); lampSpots.push([s, r + 7.5]);
  }
  const lamps = new THREE.InstancedMesh(lampGeo, poleMat, lampSpots.length);
  const lampHeads = new THREE.InstancedMesh(lampHeadGeo, lampHeadMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    Q.setFromEuler(E.set(0, 0, 0));
    M4.compose(new THREE.Vector3(x, 2.75, z), Q, new THREE.Vector3(1, 1, 1));
    lamps.setMatrixAt(i, M4);
    M4.compose(new THREE.Vector3(x, 5.6, z), Q, new THREE.Vector3(1, 1, 1));
    lampHeads.setMatrixAt(i, M4);
  });
  lamps.instanceMatrix.needsUpdate = true; lampHeads.instanceMatrix.needsUpdate = true;
  scene.add(lamps); scene.add(lampHeads);
  // Lighthouse, ferris wheel, pier, boat, jetskis, docks.
  const lh = new THREE.Group();
  const lhBody = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 22, 10),
    new THREE.MeshLambertMaterial({ color: 0xf2ede2 }));
  lhBody.position.y = 11; lh.add(lhBody);
  const lhBand = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 3, 10),
    new THREE.MeshLambertMaterial({ color: 0xc03028 }));
  lhBand.position.y = 16; lh.add(lhBand);
  const lhTop = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
  lhTop.position.y = 23; lh.add(lhTop);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(6, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.rotation.z = Math.PI / 2; beam.position.set(15, 23, 0); lh.add(beam);
  lh.position.set(CFG.lighthousePos[0], 0, CFG.lighthousePos[1]);
  scene.add(lh); G.lighthouseBeam = beam;
  G.colliders.push({ x0: -295, x1: -289, z0: 197, z1: 203 });
  const fw = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(14, 0.5, 8, 24),
    new THREE.MeshLambertMaterial({ color: 0xff5ea8 }));
  fw.add(rim);
  for (let i = 0; i < 8; i++) {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 28, 6), poleMat);
    sp.rotation.z = (i / 8) * Math.PI; fw.add(sp);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshLambertMaterial({ color: i % 2 ? 0xffd23e : 0x4ae0ff }));
    const a = (i / 8) * Math.PI * 2;
    cab.position.set(Math.cos(a) * 14, Math.sin(a) * 14, 0); fw.add(cab);
  }
  fw.position.set(CFG.ferrisPos[0], 18, CFG.ferrisPos[1]);
  scene.add(fw); G.ferris = fw;
  G.colliders.push({ x0: -287, x1: -283, z0: 118, z1: 122 });
  // Pier planks + boat + jetskis.
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
  for (let x = -266; x >= -312; x -= 3) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, 7), woodMat);
    p.position.set(x, 0.4, 60); scene.add(p);
  }
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6, 2.6),
    new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
  hull.position.y = 0.8; boat.add(hull);
  const cab2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 2),
    new THREE.MeshLambertMaterial({ color: 0x2a6a9a }));
  cab2.position.set(-0.5, 2.2, 0); boat.add(cab2);
  boat.position.set(CFG.boatPos[0], 0.2, CFG.boatPos[1]);
  scene.add(boat); G.boat = boat;
  G.jetskis = [];
  for (let i = 0; i < 3; i++) {
    const j = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 1),
      new THREE.MeshLambertMaterial({ color: [0xff2e7e, 0x4ae0ff, 0xffd23e][i] }));
    j.position.set(-292 - i * 6, 0.3, 90 + i * 14);
    scene.add(j); G.jetskis.push(j);
  }
  // Docks: containers + crane.
  const contCols = [0xc03028, 0x2a6a9a, 0xffd23e, 0x3f8a4a, 0x7a4a8a];
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 3),
      new THREE.MeshLambertMaterial({ color: contCols[i % 5] }));
    const cx = 220 + (i % 5) * 12, cz = 200 + Math.floor(i / 5) * 10;
    c.position.set(cx, 1.5 + (i % 2) * 3, cz); c.castShadow = true;
    scene.add(c);
    G.colliders.push({ x0: cx - 4, x1: cx + 4, z0: cz - 1.5, z1: cz + 1.5 });
  }
  const crane = new THREE.Group();
  const c1 = new THREE.Mesh(new THREE.BoxGeometry(3, 26, 3), new THREE.MeshLambertMaterial({ color: 0xffd23e }));
  c1.position.y = 13; crane.add(c1);
  const c2 = new THREE.Mesh(new THREE.BoxGeometry(22, 2, 2), new THREE.MeshLambertMaterial({ color: 0xffd23e }));
  c2.position.set(8, 25, 0); crane.add(c2);
  crane.position.set(250, 0, 160); scene.add(crane);
  // Birds: 22, two-plane wings, circling.
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x1a1a22, side: THREE.DoubleSide });
  for (let i = 0; i < CFG.birdN; i++) {
    const g = new THREE.Group();
    const w1 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), birdMat);
    const w2 = w1.clone(); w1.position.x = -0.8; w2.position.x = 0.8;
    g.add(w1); g.add(w2);
    const r = 60 + rng.range(0, 180), h = 45 + rng.range(0, 40);
    g.position.set(rng.range(-200, 200), h, rng.range(-200, 200));
    scene.add(g);
    G.birds.push({ g, w1, w2, r, h, sp: rng.range(0.1, 0.35), ph: rng.range(0, 6.28), cx: rng.range(-100, 100), cz: rng.range(-100, 100) });
  }
  // Sun coins (30) — golden spinning discs.
  const coinGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.12, 12);
  const coinMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  for (let i = 0; i < CFG.coinsN; i++) {
    const c = new THREE.Mesh(coinGeo, coinMat);
    let x, z, tries = 0;
    do { x = rng.range(-300, 300); z = rng.range(-300, 300); tries++; } while (collides(x, z, 1) && tries < 20);
    c.position.set(x, 1.2, z); scene.add(c);
    G.coins.push({ mesh: c, x, z, taken: false });
  }
}
export function lightStateAt(x, z) {
  for (const l of G.trafficLights) {
    if (Math.abs(l.x - x) < 14 && Math.abs(l.z - z) < 14) return l.state;
  }
  return 'green';
}
export function updateCityFx(dt) {
  const t = G.elapsed;
  for (const l of G.trafficLights) {
    const cyc = (t + l.off) % 9;
    l.state = cyc < 4 ? 'green' : cyc < 5 ? 'amber' : 'red';
    l.dots.red.material.color.set(l.state === 'red' ? 0xff2a2a : 0x331111);
    l.dots.amber.material.color.set(l.state === 'amber' ? 0xffb32a : 0x332211);
    l.dots.green.material.color.set(l.state === 'green' ? 0x2aff5a : 0x113311);
  }
  for (const b of G.birds) {
    const a = b.ph + t * b.sp;
    b.g.position.set(b.cx + Math.cos(a) * b.r, b.h + Math.sin(t * 0.7 + b.ph) * 3, b.cz + Math.sin(a) * b.r);
    b.g.rotation.y = -a;
    const flap = Math.sin(t * 6 + b.ph) * 0.6;
    b.w1.rotation.z = flap; b.w2.rotation.z = -flap;
  }
  if (G.ferris) G.ferris.rotation.z += dt * 0.15;
  if (G.lighthouseBeam) G.lighthouseBeam.rotation.y += dt * 0.4;
  if (G.lampHeadMat) G.lampHeadMat.color.set(G.nightF > 0.4 ? 0xffe9a8 : 0x8a8578);
  G.jetskis.forEach((j, i) => { j.position.y = 0.3 + Math.sin(t * 1.5 + i * 2) * 0.15; });
  for (const c of G.coins) {
    if (!c.taken) { c.mesh.rotation.y += dt * 2; c.mesh.position.y = 1.2 + Math.sin(t * 2 + c.x) * 0.15; }
  }
}
