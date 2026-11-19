// Generasi kota Solara Bay: distrik, bangunan, jalan, palem, neon,
// mercusuar, dermaga, pantai, pesta pantai, kios pasar, jetski.
import { CONFIG, DISTRICTS, SHOP_SIGNS, NEON_SIGNS } from './config.js';
import { range, rangeInt, pick, clamp, lerp } from './random.js';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); return t;
}
function textTex(text, fg, bg, w, h) {
  return canvasTex(w || 256, h || 64, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w || 256, h || 64);
    g.fillStyle = fg; g.font = 'bold 34px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, (w || 256) / 2, (h || 64) / 2 + 1);
  });
}
// Gabung beberapa BoxGeometry (non-indexed) jadi satu geometry ber-warna vertex.
function mergeBoxes(parts) {
  const pos = [], nor = [], col = [], uv = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const v = new THREE.Vector3(), s = new THREE.Vector3();
  for (const p of parts) {
    const g = new THREE.BoxGeometry(p.w, p.h, p.d).toNonIndexed();
    e.set(p.rx || 0, p.ry || 0, p.rz || 0); q.setFromEuler(e);
    m.compose(new THREE.Vector3(p.x || 0, p.y || 0, p.z || 0), q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    const pa = g.attributes.position.array, na = g.attributes.normal.array, ua = g.attributes.uv.array;
    const c = new THREE.Color(p.color);
    for (let i = 0; i < pa.length; i += 3) {
      pos.push(pa[i], pa[i + 1], pa[i + 2]); nor.push(na[i], na[i + 1], na[i + 2]);
      col.push(c.r, c.g, c.b); uv.push(ua[i * 2 / 3] || 0, ua[i * 2 / 3 + 1] || 0);
    }
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (d.test(x, z)) return d.name;
  return 'Old Solara';
}

export function buildCity(scene, THREE, rng) {
  const city = {
    buildings: [], neonHalos: [], lamps: [], trafficLights: [], birds: [],
    sunCoins: [], ramps: [], group: new THREE.Group(),
    garage: { x: 0, z: 120 }, respray: { x: 120, z: 0 }, gunShop: { x: -120, z: 120 },
    raceStart: { x: -240, z: 180 },
    raceRoute: [[-240, 180], [-240, -240], [240, -240], [240, 240], [-240, 240]],
    fishSpot: { x: -297, z: 90 }, partySpot: { x: -268, z: 150 },
    pierEnd: { x: -298, z: 90 },
  };
  scene.add(city.group);
  const H = CONFIG.worldHalf;

  // --- Tanah: tekstur jalan + trotoar + zebra + pasir pantai ---
  const groundTex = canvasTex(1024, 1024, (g) => {
    const S = 1024 / 600; const X = (x) => (x + 300) * S, Z = (z) => (z + 300) * S;
    g.fillStyle = '#5d7a4e'; g.fillRect(0, 0, 1024, 1024);
    g.fillStyle = '#c9b489'; g.fillRect(0, 0, X(-252), 1024); // pantai barat
    g.fillStyle = '#3f6d8e'; g.fillRect(0, 0, X(-288), 1024); // laut (tertutup plane laut)
    for (const r of CONFIG.roads) {
      g.fillStyle = '#c8c2b4'; // trotoar
      g.fillRect(X(r - 11), 0, 22 * S, 1024); g.fillRect(0, Z(r - 11), 1024, 22 * S);
      g.fillStyle = '#33363d'; // aspal
      g.fillRect(X(r - 7), 0, 14 * S, 1024); g.fillRect(0, Z(r - 7), 1024, 14 * S);
      g.strokeStyle = '#e8c33a'; g.lineWidth = 1.5; g.setLineDash([10, 12]);
      g.beginPath(); g.moveTo(X(r), 0); g.lineTo(X(r), 1024); g.stroke();
      g.beginPath(); g.moveTo(0, Z(r)); g.lineTo(1024, Z(r)); g.stroke();
      g.setLineDash([]);
    }
    g.fillStyle = '#e8e8e8'; // zebra di semua persimpangan
    for (const rx of CONFIG.roads) for (const rz of CONFIG.roads) {
      for (let i = -3; i <= 3; i++) {
        g.fillRect(X(rx + i * 2 - 0.7), Z(rz - 7), 1.4 * S, 3 * S);
        g.fillRect(X(rx + i * 2 - 0.7), Z(rz + 4), 1.4 * S, 3 * S);
      }
    }
  });
  groundTex.anisotropy = 8;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshLambertMaterial({ map: groundTex }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  city.group.add(ground);

  // --- Laut (plane biru, shimmer di updateCityFx) ---
  const seaMat = new THREE.MeshLambertMaterial({ color: 0x2a7fa8, transparent: true, opacity: 0.92 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(90, 620), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.set(-330, 0.15, 0);
  city.group.add(sea); city.seaMat = seaMat;

  // --- Bangunan: 3 varian tekstur jendela, InstancedMesh ---
  const winTexes = [0.42, 0.55, 0.3].map((lit, vi) => canvasTex(128, 256, (g) => {
    const bases = ['#8a6f5c', '#7d8aa0', '#a08a6a'];
    g.fillStyle = bases[vi]; g.fillRect(0, 0, 128, 256);
    for (let y = 12; y < 244; y += 24) for (let x = 10; x < 118; x += 26) {
      const on = rng() < lit;
      g.fillStyle = on ? (rng() < 0.5 ? '#ffca7a' : '#ffb45e') : '#3d4a61';
      g.fillRect(x, y, 16, 14);
    }
  }));
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const mats = winTexes.map((t) => new THREE.MeshLambertMaterial({ map: t }));
  const spots = [];
  const blockC = [-180, -60, 60, 180];
  for (const bx of blockC) for (const bz of blockC) {
    const n = rangeInt(rng, 2, 4);
    for (let i = 0; i < n; i++) {
      const w = range(rng, 18, 34), d = range(rng, 18, 34);
      const x = bx + range(rng, -28, 28), z = bz + range(rng, -28, 28);
      if (Math.abs(x) > 285 || Math.abs(z) > 285) continue;
      const spires = x > 120 && z > -120 && z < 120;
      const h = spires ? range(rng, 30, 62) : range(rng, 8, 26);
      spots.push({ x, z, w, d, h, vi: rangeInt(rng, 0, 2) });
      city.buildings.push({ x, z, hw: w / 2, hd: d / 2, h });
    }
  }
  // gedung pesisir Malecón (rendah, warna-warni) — di timur jalan, x=-228
  for (let z = -220; z <= 220; z += 44) {
    const h = range(rng, 7, 14);
    spots.push({ x: -228, z: z + range(rng, -6, 6), w: 12, d: 18, h, vi: rangeInt(rng, 0, 2) });
    city.buildings.push({ x: -228, z, hw: 6, hd: 9, h });
  }
  const dummies = [new THREE.Object3D(), new THREE.Object3D(), new THREE.Object3D()];
  const counts = [0, 0, 0];
  spots.forEach((s) => counts[s.vi]++);
  const meshes = counts.map((c, i) => {
    const m = new THREE.InstancedMesh(boxGeo, mats[i], Math.max(c, 1));
    m.castShadow = true; m.receiveShadow = true; city.group.add(m); return m;
  });
  const idx = [0, 0, 0];
  for (const s of spots) {
    const d = dummies[s.vi];
    d.position.set(s.x, 0, s.z); d.scale.set(s.w, s.h, s.d); d.updateMatrix();
    meshes[s.vi].setMatrixAt(idx[s.vi]++, d.matrix);
  }

  // --- Palem: satu merged geometry, InstancedMesh ---
  const palmParts = [];
  for (let i = 0; i < 3; i++) palmParts.push({ w: 0.5, h: 2.6, d: 0.5, x: i * 0.35, y: 1.3 + i * 2.5, z: 0, rz: -0.08 * i, color: 0x7a5230 });
  for (let f = 0; f < 10; f++) {
    const a = (f / 10) * Math.PI * 2, long = f < 6;
    palmParts.push({
      w: 0.9, h: 0.06, d: long ? 4.6 : 3.2,
      x: Math.cos(a) * (long ? 1.9 : 1.3), y: 7.6 - (long ? 0.9 : 0.2), z: Math.sin(a) * (long ? 1.9 : 1.3),
      ry: -a, rx: long ? 0.62 : 0.25, color: f % 2 ? 0x2f7a35 : 0x3f9a3f,
    });
  }
  for (let c = 0; c < 3; c++) palmParts.push({ w: 0.5, h: 0.5, d: 0.5, x: Math.cos(c * 2.1) * 0.6, y: 7.3, z: Math.sin(c * 2.1) * 0.6, color: 0x6b4a26 });
  const palmGeo = mergeBoxes(palmParts);
  const palmMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const palmSpots = [];
  for (let z = -270; z <= 270; z += 36) { palmSpots.push([-250, z + range(rng, -4, 4)]); palmSpots.push([-262, z + 18]); }
  for (let x = -180; x <= 240; x += 36) { palmSpots.push([x, 8]); palmSpots.push([x + 18, -8]); }
  for (let z = -180; z <= 180; z += 36) { palmSpots.push([8, z]); palmSpots.push([-8, z + 18]); }
  const palms = new THREE.InstancedMesh(palmGeo, palmMat, palmSpots.length);
  palms.castShadow = true;
  const pd = new THREE.Object3D();
  palmSpots.forEach((p, i) => {
    pd.position.set(p[0], 0, p[1]); pd.rotation.y = range(rng, 0, Math.PI * 2);
    const s = range(rng, 0.9, 1.25); pd.scale.set(s, s, s); pd.updateMatrix();
    palms.setMatrixAt(i, pd.matrix);
  });
  city.group.add(palms);

  // --- Pohon taman Calle Verde (material lama dipertahankan) ---
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a26 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8a3f });
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 3, 6);
  const leafGeo = new THREE.SphereGeometry(2.2, 7, 6);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, 24);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, 24);
  for (let i = 0; i < 24; i++) {
    const x = range(rng, -170, 110), z = range(rng, -170, -10);
    pd.position.set(x, 1.5, z); pd.rotation.set(0, 0, 0); pd.scale.set(1, 1, 1); pd.updateMatrix();
    trunks.setMatrixAt(i, pd.matrix);
    pd.position.y = 4.4; pd.updateMatrix(); leaves.setMatrixAt(i, pd.matrix);
  }
  city.group.add(trunks); city.group.add(leaves);

  // --- Toko / papan nama ---
  const signMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const shopSpots = [];
  for (let i = 0; i < 22; i++) {
    const b = pick(rng, city.buildings);
    shopSpots.push({ x: b.x, z: b.z + b.hd + 0.15, ry: 0, sign: pick(rng, SHOP_SIGNS) });
  }
  for (const s of shopSpots) {
    const [txt, fg, bg] = s.sign;
    const tex = textTex(txt, fg, bg, 256, 64);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    m.position.set(s.x, 2.6, s.z); city.group.add(m);
  }
  // Neon besar + halo
  const haloTex = canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
  for (const n of NEON_SIGNS) {
    const tex = textTex(n.text, n.color, '#101018', 512, 96);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 3),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    m.position.set(n.x, 9, n.z); m.rotation.y = Math.PI / 2; city.group.add(m);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(26, 10),
      new THREE.MeshBasicMaterial({ map: haloTex, color: n.color, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.set(n.x - 0.4, 9, n.z); halo.rotation.y = Math.PI / 2;
    city.group.add(halo); city.neonHalos.push(halo);
  }

  // --- Lampu jalan ---
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 6);
  const lampGeo = new THREE.SphereGeometry(0.4, 8, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, 60);
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, 60);
  let li = 0;
  for (const rx of CONFIG.roads) for (const rz of CONFIG.roads) {
    if (li >= 60) break;
    pd.position.set(rx + 9, 3.5, rz + 9); pd.rotation.set(0, 0, 0); pd.scale.set(1, 1, 1); pd.updateMatrix();
    poles.setMatrixAt(li, pd.matrix); pd.position.y = 7; pd.updateMatrix(); lamps.setMatrixAt(li, pd.matrix);
    city.lamps.push({ x: rx + 9, z: rz + 9 }); li++;
  }
  city.group.add(poles); city.group.add(lamps);

  // --- Lampu lalu lintas di 4 persimpangan ---
  const tlSpots = [[0, 0], [120, -120], [-120, 120], [120, 120]];
  for (const [tx, tz] of tlSpots) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 6), poleMat);
    pole.position.y = 3; g.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x1a1d22 }));
    head.position.set(0, 5.6, 0); g.add(head);
    const dots = [];
    const cols = [0xff2a22, 0xffb52a, 0x2aff5e];
    cols.forEach((c, i) => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6),
        new THREE.MeshBasicMaterial({ color: c }));
      d.position.set(0, 6.2 - i * 0.55, 0.28); g.add(d); dots.push(d);
    });
    g.position.set(tx + 8, 0, tz + 8);
    city.group.add(g);
    city.trafficLights.push({ group: g, dots, phase: range(rng, 0, 9), x: tx, z: tz });
  }

  // --- Mercusuar merah-putih + beam ---
  const lh = new THREE.Group();
  const stripeCols = [0xd8382a, 0xf2ede2, 0xd8382a, 0xf2ede2, 0xd8382a];
  stripeCols.forEach((c, i) => {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(2.6 - i * 0.25, 2.9 - i * 0.25, 3.4, 10),
      new THREE.MeshLambertMaterial({ color: c }));
    seg.position.y = 1.7 + i * 3.4; lh.add(seg);
  });
  const lhTop = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
  lhTop.position.y = 18; lh.add(lhTop);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(3.5, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.rotation.z = Math.PI / 2; beam.position.set(13, 18, 0);
  const beamPivot = new THREE.Group(); beamPivot.add(beam); beamPivot.position.y = 0;
  lh.add(beamPivot);
  lh.position.set(-288, 0, -180);
  city.group.add(lh);
  city.lighthouseBeam = beamPivot;

  // --- Dermaga kayu + ujung mancing ---
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a44 });
  for (let x = -272; x >= -300; x -= 2) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 7), pierMat);
    plank.position.set(x, 0.6, 90); city.group.add(plank);
  }
  const pierEnd = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 10), pierMat);
  pierEnd.position.set(-300, 0.6, 90); city.group.add(pierEnd);
  const pierPost = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.4, 6), pierMat);
  pierPost.position.set(-302, 1.4, 85); city.group.add(pierPost);

  // --- Pantai: payung, handuk, menara lifeguard, jetski ---
  const umbCols = [0xff5fa2, 0x37e0ff, 0xffd23e, 0xff8a3d];
  for (let i = 0; i < 10; i++) {
    const x = range(rng, -278, -258), z = range(rng, -60, 200);
    const umb = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.2, 8),
      new THREE.MeshLambertMaterial({ color: pick(rng, umbCols) }));
    umb.position.set(x, 2.6, z); city.group.add(umb);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 5), poleMat);
    pole.position.set(x, 1.3, z); city.group.add(pole);
    const towel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.9),
      new THREE.MeshLambertMaterial({ color: pick(rng, umbCols) }));
    towel.position.set(x + 2.4, 0.1, z + 1); city.group.add(towel);
  }
  const tower = new THREE.Group();
  const tLeg = new THREE.Mesh(new THREE.BoxGeometry(2.6, 4.4, 2.6),
    new THREE.MeshLambertMaterial({ color: 0xf2ede2 }));
  tLeg.position.y = 2.2; tower.add(tLeg);
  const tTop = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 3.4),
    new THREE.MeshLambertMaterial({ color: 0xd8382a }));
  tTop.position.y = 5.2; tower.add(tTop);
  tower.position.set(-272, 0, 120); city.group.add(tower);
  city.jetskis = [];
  [[-296, 40], [-296, -40]].forEach(([jx, jz]) => {
    const j = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.1),
      new THREE.MeshLambertMaterial({ color: 0x37e0ff }));
    body.position.y = 0.3; j.add(body);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.9),
      new THREE.MeshLambertMaterial({ color: 0x11151c }));
    seat.position.set(-0.3, 0.65, 0); j.add(seat);
    j.position.set(jx, 0.2, jz); city.group.add(j); city.jetskis.push(j);
  });

  // --- Kios pasar Old Solara ---
  const stallCols = [0xff5fa2, 0xffd23e, 0x37e0ff, 0x7ef0d4];
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 3),
      new THREE.MeshLambertMaterial({ color: pick(rng, stallCols) }));
    top.position.y = 2.4; s.add(top);
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.2, 2.6),
      new THREE.MeshLambertMaterial({ color: 0x8a6a44 }));
    base.position.y = 0.6; s.add(base);
    s.position.set(-60 + i * 8, 0, 60 + (i % 2) * 6);
    city.group.add(s);
  }

  // --- Pesta pantai malam: api unggun + penari ---
  const party = new THREE.Group();
  const fireLight = new THREE.PointLight(0xff8a3d, 2.2, 26, 1.6);
  fireLight.position.y = 1.6; party.add(fireLight);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 8),
    new THREE.MeshBasicMaterial({ color: 0xffb52a, transparent: true, opacity: 0.95 }));
  flame.position.y = 1; party.add(flame);
  const logs = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 1.6),
    new THREE.MeshLambertMaterial({ color: 0x4a2f1a }));
  logs.position.y = 0.2; party.add(logs);
  const dancers = [];
  for (let i = 0; i < 5; i++) {
    const d = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.4),
      new THREE.MeshLambertMaterial({ color: pick(rng, [0xff5fa2, 0x37e0ff, 0xffd23e, 0x7ef0d4, 0xff8a3d]) }));
    body.position.y = 1.1; d.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
    head.position.y = 2.1; d.add(head);
    const a = (i / 5) * Math.PI * 2;
    d.position.set(Math.cos(a) * 3.4, 0, Math.sin(a) * 3.4);
    party.add(d); dancers.push(d);
  }
  party.position.set(city.partySpot.x, 0, city.partySpot.z);
  city.group.add(party);
  city.party = { group: party, dancers, flame, light: fireLight };

  // --- Ramp stunt jump ---
  const rampMat = new THREE.MeshLambertMaterial({ color: 0xff8a3d });
  [[60, 0], [-60, -120], [180, 60]].forEach(([rx, rz]) => {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 4), rampMat);
    ramp.position.set(rx, 0.6, rz); ramp.rotation.z = 0.28;
    city.group.add(ramp); city.ramps.push({ x: rx, z: rz });
  });

  // --- Burung ---
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x1a1d22, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Group();
    const w1 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), birdMat);
    w1.position.x = -0.8; b.add(w1);
    const w2 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), birdMat);
    w2.position.x = 0.8; b.add(w2);
    city.group.add(b);
    city.birds.push({ g: b, w1, w2, r: range(rng, 60, 160), h: range(rng, 60, 110), a: range(rng, 0, 6.28), sp: range(rng, 0.08, 0.2) });
  }

  city.collide = function (x, z, r) {
    if (x < -303 || x > 295 || z < -295 || z > 295) return true;
    if (x < -282) { // laut — kecuali strip dermaga
      if (!(Math.abs(z - 90) < 3.5 && x >= -303)) return true;
    }
    for (const b of city.buildings) {
      if (Math.abs(x - b.x) < b.hw + r && Math.abs(z - b.z) < b.hd + r) return true;
    }
    return false;
  };
  city.onRoad = function (x, z) {
    for (const r of CONFIG.roads) {
      if (Math.abs(x - r) < 9 || Math.abs(z - r) < 9) return true;
    }
    return false;
  };
  // --- Sun coins (di luar gedung) ---
  const coinGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.1, 12);
  const coinMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  for (let i = 0; i < CONFIG.sunCoinCount; i++) {
    let x = 0, z = 0, tries = 0;
    do { x = range(rng, -280, 280); z = range(rng, -280, 280); tries++; }
    while (city.collide(x, z, 1) && tries < 20);
    if (city.collide(x, z, 1)) continue;
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.rotation.x = Math.PI / 2; m.position.set(x, 1.2, z);
    city.group.add(m);
    city.sunCoins.push({ x, z, mesh: m, taken: false });
  }
  city.updateCityFx = function (dt, timeOfDay, nightFactor, t) {
    for (const tl of city.trafficLights) {
      tl.phase += dt;
      const ph = tl.phase % 9;
      const state = ph < 4 ? 2 : ph < 5 ? 1 : 0; // hijau, kuning, merah
      tl.dots.forEach((d, i) => {
        d.material.color.setHex(i === state ? [0xff2a22, 0xffb52a, 0x2aff5e][i] : 0x222222);
      });
    }
    for (const b of city.birds) {
      b.a += b.sp * dt;
      b.g.position.set(Math.cos(b.a) * b.r, b.h + Math.sin(t * 0.5 + b.r) * 3, Math.sin(b.a) * b.r);
      b.g.rotation.y = -b.a;
      const flap = Math.sin(t * 6 + b.r) * 0.5;
      b.w1.rotation.z = flap; b.w2.rotation.z = -flap;
    }
    if (city.lighthouseBeam) city.lighthouseBeam.rotation.y = t * 0.5;
    const flick = 1.8 + Math.sin(t * 11) * 0.35 + Math.sin(t * 23) * 0.2;
    city.party.light.intensity = flick * (nightFactor > 0.25 ? 1 : 0.35);
    city.party.flame.scale.set(1 + Math.sin(t * 9) * 0.12, 1 + Math.sin(t * 13) * 0.2, 1);
    city.party.dancers.forEach((d, i) => {
      d.position.y = Math.abs(Math.sin(t * 3 + i * 1.3)) * 0.35;
      d.rotation.y = t * 0.8 + i;
    });
    for (const j of city.jetskis) {
      j.position.y = 0.2 + Math.sin(t * 1.4 + j.position.z) * 0.15;
      j.rotation.z = Math.sin(t * 1.1) * 0.06;
    }
    city.seaMat.color.setHex(0x2a7fa8);
    const shimmer = 0.9 + Math.sin(t * 0.8) * 0.06;
    city.seaMat.opacity = 0.92 * shimmer;
    for (const h of city.neonHalos) h.material.opacity = 0.12 + nightFactor * 0.5;
    for (const c of city.sunCoins) if (!c.taken) c.mesh.rotation.z += dt * 1.5;
  };
  return city;
}
