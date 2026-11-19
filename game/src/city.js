// Kota Solara Bay: tanah, gedung bervariasi, palem, neon, dermaga, pasar.
import * as THREE from 'three';
import { G, CFG } from './config.js';
import { rng, reseed, rr, ri, pick, clamp, lerp } from './random.js';
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function facadeTex(base, litRatio, warm) {
  return canvasTex(128, 256, (x, w, h) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < 40; i++) x.fillRect(rr(0, w), rr(0, h), rr(2, 8), rr(2, 6));
    for (let r = 0; r < 10; r++) for (let c = 0; c < 6; c++) {
      const lit = rng() < litRatio;
      x.fillStyle = lit ? (warm ? '#ffd27a' : '#ffe9b0') : '#3d4a61';
      x.fillRect(8 + c * 20, 12 + r * 24, 13, 15);
    }
    x.fillStyle = 'rgba(255,255,255,0.10)'; x.fillRect(0, 0, w, 6);
  });
}
function litTex(litRatio, warm) {
  return canvasTex(128, 256, (x, w, h) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    for (let r = 0; r < 10; r++) for (let c = 0; c < 6; c++) {
      if (rng() < litRatio) { x.fillStyle = warm ? '#ffbf4d' : '#ffd98a'; x.fillRect(8 + c * 20, 12 + r * 24, 13, 15); }
    }
  });
}
function textTex(text, fg, bg, font = 44) {
  return canvasTex(256, 64, (x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.fillStyle = fg; x.font = `bold ${font}px Arial`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, w / 2, h / 2 + 2);
  });
}
function groundTex() {
  return canvasTex(1024, 1024, (x, w, h) => {
    const S = w / 640;
    x.fillStyle = '#5d8a4a'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#e8d9a0'; x.fillRect(0, 0, 42 * S, h); // pantai barat
    x.fillStyle = '#7fc4d8'; x.fillRect(0, 0, 16 * S, h); // laut tepi
    x.fillStyle = '#3f4a3a'; // blok kota
    for (const bx of [-240, -120, 0, 120]) for (const bz of [-240, -120, 0, 120])
      x.fillRect((bx + 320 + 8) * S, (bz + 320 + 8) * S, 104 * S, 104 * S);
    x.fillStyle = '#c9c2b2'; // trotoar
    for (const r of CFG.roadAt) {
      x.fillRect((r + 320 - 10) * S, 0, 20 * S, h);
      x.fillRect(0, (r + 320 - 10) * S, w, 20 * S);
    }
    x.fillStyle = '#33363d'; // aspal
    for (const r of CFG.roadAt) {
      x.fillRect((r + 320 - 6) * S, 0, 12 * S, h);
      x.fillRect(0, (r + 320 - 6) * S, w, 12 * S);
    }
    x.strokeStyle = '#e8c832'; x.lineWidth = 1.5 * S; x.setLineDash([10 * S, 8 * S]);
    for (const r of CFG.roadAt) {
      x.beginPath(); x.moveTo((r + 320) * S, 0); x.lineTo((r + 320) * S, h); x.stroke();
      x.beginPath(); x.moveTo(0, (r + 320) * S); x.lineTo(w, (r + 320) * S); x.stroke();
    }
    x.setLineDash([]); x.fillStyle = '#f2f2f2'; // zebra di semua persimpangan
    for (const rx of CFG.roadAt) for (const rz of CFG.roadAt)
      for (let i = -2; i <= 2; i++) x.fillRect((rx + 320 + i * 3 - 1) * S, (rz + 320 - 8) * S, 2 * S, 16 * S);
    x.fillStyle = '#7a9e5a'; x.fillRect((120 + 320 + 8) * S, (180 + 320 + 8) * S, 104 * S, 104 * S); // taman
  });
}
const SIGNS = [
  ['TACOS', '#ffe14d', '#a31621'], ['DONUTS', '#ff9ecf', '#4a235a'], ['BAR', '#7df9ff', '#14213d'],
  ['HOTEL', '#7df9ff', '#0b3d5c'], ['PIZZA', '#ff8c42', '#5b2a00'], ['24H MART', '#9dff57', '#123524'],
  ['MARLIN CEVICHE', '#ffffff', '#0e6b6b'], ['CAFÉ SOL', '#fff3b0', '#7a4a12'], ['NEON NAILS', '#ff5da2', '#2b0a3d'],
];
const NEONS = [
  ['FLAMINGO FM', '#ff5da2', -252, -80, 0], ['VICE HOTEL', '#37e0ff', 60, -180, 1],
  ['TACOS 24H', '#ffe14d', -180, 60, 0], ['CELESTE 98.1', '#ff7ad9', -252, 120, 0],
  ['MARLIN', '#7df9ff', -252, 40, 0], ['HOTEL SOLARA', '#ffb347', 140, 140, 1],
];
export function buildCity() {
  reseed(G.seed);
  const scene = G.scene;
  const city = {
    colliders: [], lamps: [], neonHalos: [], trafficLights: [], birds: [],
    crowdSpots: [
      { x: -252, z: 40, r: 16, n: 16, label: 'Malecón' },
      { x: -180, z: 60, r: 14, n: 14, label: 'Pasar Old Solara' },
      { x: -252, z: 120, r: 12, n: 10, label: 'Kafe pantai' },
      { x: 60, z: -180, r: 12, n: 8, label: 'Plaza Spires' },
      { x: -120, z: 240, r: 12, n: 8, label: 'Taman Calle Verde' },
      { x: -252, z: -80, r: 12, n: 9, label: 'Boardwalk' },
    ],
    photoSpots: [
      { x: -262, z: 150, name: 'Mercusuar' }, { x: -252, z: 40, name: 'Mural Malecón' },
      { x: -286, z: 0, name: 'Ujung Dermaga' }, { x: 60, z: -180, name: 'Air Mancur Plaza' },
      { x: 140, z: 140, name: 'Neon Hotel Solara' }, { x: -252, z: -160, name: 'Pantai Senja' },
    ],
    fishingSpots: [{ x: -284, z: 6 }, { x: -284, z: -30 }],
    taxiStand: { x: 8, z: -8 }, raceStart: { x: 120, z: 6 },
    garage: { x: 120, z: 120 }, respray: { x: -120, z: -120 },
  };
  const gt = groundTex(); gt.anisotropy = G.renderer.capabilities.getMaxAnisotropy();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(640, 640), new THREE.MeshLambertMaterial({ map: gt }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(120, 640), new THREE.MeshLambertMaterial({ color: 0x2f7fa8 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(-360, 0.05, 0); scene.add(sea);
  // Gedung bervariasi: 3 tekstur fasad + 3 gaya tinggi + detail atap.
  const facades = [
    { map: facadeTex('#8a6f5c', 0.25, true), lit: litTex(0.25, true) },
    { map: facadeTex('#5c6e8a', 0.35, false), lit: litTex(0.35, false) },
    { map: facadeTex('#a85c6e', 0.3, true), lit: litTex(0.3, true) },
  ];
  const mats = facades.map((f) => new THREE.MeshLambertMaterial({ map: f.map, emissive: 0xffffff, emissiveMap: f.lit, emissiveIntensity: 0 }));
  city.facadeMats = mats;
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4440 });
  const acMat = new THREE.MeshLambertMaterial({ color: 0x9aa2ab });
  const tankMat = new THREE.MeshLambertMaterial({ color: 0xb8b0a0 });
  const antMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  let bi = 0;
  for (const bx of [-240, -120, 0, 120]) for (const bz of [-240, -120, 0, 120]) {
    const cx = bx + 60, cz = bz + 60;
    if (cx > 180 && cz < -60) continue; // area docks: gudang rendah
    const tall = cx > -60 && cz < -60; // Spires
    const n = tall ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const w = rr(16, 26), d = rr(16, 26);
      const hgt = tall ? rr(30, 62) : pick([rr(10, 16), rr(16, 26), rr(26, 34)]);
      const px = cx + rr(-28, 28), pz = cz + rr(-28, 28);
      if (Math.abs(px) < 14 || Math.abs(pz) < 14) continue;
      const m = new THREE.Mesh(boxGeo, mats[bi++ % 3]);
      m.scale.set(w, hgt, d); m.position.set(px, hgt / 2, pz);
      m.castShadow = true; m.receiveShadow = true; scene.add(m);
      city.colliders.push({ x0: px - w / 2, z0: pz - d / 2, x1: px + w / 2, z1: pz + d / 2 });
      // Detail atap: AC, tangki air, antena (variasi acak per gedung).
      const roof = new THREE.Mesh(boxGeo, roofMat); roof.scale.set(w * 0.9, 0.8, d * 0.9);
      roof.position.set(px, hgt + 0.4, pz); scene.add(roof);
      if (rng() < 0.7) { const ac = new THREE.Mesh(boxGeo, acMat); ac.scale.set(3, 1.6, 2.4); ac.position.set(px + rr(-4, 4), hgt + 1.6, pz + rr(-4, 4)); scene.add(ac); }
      if (rng() < 0.5) { const tk = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 3, 8), tankMat); tk.position.set(px + rr(-5, 5), hgt + 2.2, pz + rr(-5, 5)); scene.add(tk); }
      if (rng() < 0.6) { const an = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, rr(4, 9), 5), antMat); an.position.set(px + rr(-6, 6), hgt + 3, pz + rr(-6, 6)); scene.add(an); }
    }
  }
  // Gudang docks + kontainer warna-warni.
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x6e5a4a });
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Mesh(boxGeo, dockMat); g.scale.set(30, 10, 18);
    g.position.set(220 + rr(-14, 14), 5, -220 + i * 42); g.castShadow = true; scene.add(g);
    city.colliders.push({ x0: g.position.x - 15, z0: g.position.z - 9, x1: g.position.x + 15, z1: g.position.z + 9 });
  }
  const contCols = [0xc0392b, 0x2471a3, 0x1e8449, 0xd4ac0d, 0x7d3c98];
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: pick(contCols) }));
    c.scale.set(12, 2.6, 2.6); c.position.set(200 + rr(-20, 40), 1.3 + (i % 2) * 2.7, -260 + (i % 7) * 18);
    c.rotation.y = (i % 2) * 0.3; scene.add(c);
  }
  // Toko: papan nama di fasad + neon + halo.
  const haloTex = canvasTex(128, 128, (x, w, h) => {
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  for (let i = 0; i < 22; i++) {
    const s = pick(SIGNS);
    const bx = pick([-240, -120, 0, 120]) + 60 + rr(-30, 30);
    const bz = pick([-240, -120, 0, 120]) + 60 + rr(-30, 30);
    const tex = textTex(s[0], s[1], s[2], s[0].length > 8 ? 30 : 44);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshBasicMaterial({ map: tex }));
    sign.position.set(bx, 3.2, bz + 13.2); sign.rotation.y = Math.PI; scene.add(sign);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(s[1]) }));
    halo.position.set(bx, 3.2, bz + 13); halo.rotation.y = Math.PI; scene.add(halo); city.neonHalos.push(halo);
  }
  for (const n of NEONS) {
    const tex = textTex(n[0], n[1], '#14060f', 40);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), new THREE.MeshBasicMaterial({ map: tex }));
    sign.position.set(n[2], 12, n[3]); if (n[4]) sign.rotation.y = Math.PI / 2; scene.add(sign);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(26, 12), new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(n[1]) }));
    halo.position.copy(sign.position); halo.position.z -= 0.4; if (n[4]) halo.rotation.y = Math.PI / 2; scene.add(halo); city.neonHalos.push(halo);
  }
  // Palem: batang miring 3 segmen + 10 pelepah menjuntai + kelapa.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6d4b });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f8f3a, side: THREE.DoubleSide });
  const frondMat2 = new THREE.MeshLambertMaterial({ color: 0x46a83f, side: THREE.DoubleSide });
  const palmSpots = [];
  for (const z of [-260, -140, -20, 100, 220]) palmSpots.push([-258, z]);
  for (let x = -240; x <= 240; x += 72) { palmSpots.push([x, -8]); palmSpots.push([x, 8]); }
  for (let z = -240; z <= 240; z += 72) { palmSpots.push([-8, z]); palmSpots.push([8, z]); }
  for (const [px, pz] of palmSpots) {
    if (Math.abs(px) < 12 && Math.abs(pz) < 12) continue;
    const palm = new THREE.Group();
    let tx = 0, ty = 0; const lean = rr(-0.4, 0.4);
    for (let s = 0; s < 2; s++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.28 - s * 0.05, 0.34 - s * 0.05, 3.6, 6), trunkMat);
      seg.position.set(tx, ty + 1.8, 0); seg.rotation.z = lean * 0.3; palm.add(seg); tx += lean * 0.8; ty += 3.4;
    }
    for (let f = 0; f < 6; f++) {
      const a = (f / 6) * Math.PI * 2 + rr(-0.2, 0.2);
      const fr = new THREE.Mesh(new THREE.PlaneGeometry(0.9, rr(3.2, 4.2)), f % 2 ? frondMat : frondMat2);
      fr.position.set(tx + Math.cos(a) * 1.4, ty + 0.2, Math.sin(a) * 1.4);
      fr.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1 - 0.5);
      fr.rotation.y = -a; palm.add(fr);
    }
    palm.position.set(px + rr(-2, 2), 0, pz + rr(-2, 2)); palm.rotation.y = rr(0, 6.28);
    palm.scale.setScalar(rr(0.9, 1.25)); scene.add(palm);
  }
  // Pohon taman + bangku + air mancur plaza.
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f3a });
  for (let i = 0; i < 16; i++) {
    const t = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2.4, 6), trunkMat); tr.position.y = 1.2; t.add(tr);
    const cr = new THREE.Mesh(new THREE.SphereGeometry(rr(1.8, 2.6), 8, 6), leafMat); cr.position.y = 3.4; t.add(cr);
    t.position.set(rr(130, 220), 0, rr(190, 280)); scene.add(t);
  }
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 1, 12), new THREE.MeshLambertMaterial({ color: 0x9aa2ab }));
  fountain.position.set(60, 0.5, -180); scene.add(fountain);
  const water = new THREE.Mesh(new THREE.CircleGeometry(5.4, 12), new THREE.MeshLambertMaterial({ color: 0x4db2d8 }));
  water.rotation.x = -Math.PI / 2; water.position.set(60, 1.05, -180); scene.add(water);
  // Dermaga kayu + mercusuar + kincir ria kecil.
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x8a6d4b });
  const pier = new THREE.Mesh(boxGeo, woodMat); pier.scale.set(30, 1, 6); pier.position.set(-288, 0.6, 0); scene.add(pier);
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const lh = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 22, 10), lightMat); tower.position.y = 11; lh.add(tower);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 3, 10), new THREE.MeshLambertMaterial({ color: 0xc0392b })); band.position.y = 16; lh.add(band);
  const lampTop = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a0 })); lampTop.position.y = 23; lh.add(lampTop);
  lh.position.set(-262, 0, 150); scene.add(lh); city.lighthouseTop = lampTop;
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(9, 0.4, 6, 20), new THREE.MeshLambertMaterial({ color: 0xff5da2 }));
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const cab = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: pick([0xffd23f, 0x37e0ff, 0xff5da2]) }));
    cab.scale.set(1.6, 1.6, 1.6);
    const a = (i / 8) * Math.PI * 2; cab.position.set(Math.cos(a) * 9, Math.sin(a) * 9, 0); wheel.add(cab);
  }
  wheel.position.set(-250, 14, -200); scene.add(wheel); city.wheel = wheel;
  // Lampu jalan + lampu lalu lintas.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2c30 });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
  for (const rx of CFG.roadAt) for (const rz of CFG.roadAt) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 7, 6), poleMat);
    pole.position.set(rx + 8, 3.5, rz + 8); scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 5), lampGlowMat);
    bulb.position.set(rx + 8, 7.2, rz + 8); scene.add(bulb); city.lamps.push(bulb);
  }
  for (const [ix, iz, off] of [[0, 0, 0], [120, -120, 2], [-120, 120, 4], [120, 120, 6]]) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 6, 6), poleMat); pole.position.y = 3; g.add(pole);
    const head = new THREE.Mesh(boxGeo, poleMat); head.scale.set(1, 2.4, 0.8); head.position.set(0, 6.2, 0); g.add(head);
    const dots = [];
    for (let i = 0; i < 3; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.32, 6, 5), new THREE.MeshBasicMaterial({ color: [0xff2e2e, 0xffc832, 0x2eff5e][i] }));
      d.position.set(0, 7 + -i * 0.7, 0.5); g.add(d); dots.push(d);
    }
    g.position.set(ix + 7, 0, iz + 7); scene.add(g);
    city.trafficLights.push({ dots, off });
  }
  // Kios pasar + pedagang kaki lima (gerobak taco).
  const stallCols = [0xff8c42, 0x37e0ff, 0xff5da2, 0x9dff57];
  for (let i = 0; i < 6; i++) {
    const st = new THREE.Group();
    const counter = new THREE.Mesh(boxGeo, woodMat); counter.scale.set(4, 1.2, 2); counter.position.y = 0.6; st.add(counter);
    const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: pick(stallCols) }));
    roof.scale.set(4.6, 0.3, 2.6); roof.position.y = 2.6; st.add(roof);
    st.position.set(-186 + i * 8, 0, 52 + (i % 2) * 10); scene.add(st);
  }
  const taco = new THREE.Group();
  const tb = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xf5c518 })); tb.scale.set(3.4, 2, 2); tb.position.y = 1.2; taco.add(tb);
  const tr2 = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xc0392b })); tr2.scale.set(3.6, 0.3, 2.2); tr2.position.y = 2.4; taco.add(tr2);
  taco.position.set(-244, 0, 66); scene.add(taco);
  // Burung: 12 ekor, dua bidang sayap.
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x222226, side: THREE.DoubleSide });
  for (let i = 0; i < 12; i++) {
    const b = new THREE.Group();
    const w1 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), birdMat); w1.position.x = -0.8; b.add(w1);
    const w2 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), birdMat); w2.position.x = 0.8; b.add(w2);
    b.userData = { r: rr(40, 160), h: rr(28, 55), sp: rr(0.08, 0.22) * (rng() < 0.5 ? 1 : -1), ph: rr(0, 6.28), w1, w2 };
    scene.add(b); city.birds.push(b);
  }
  // Marker toko/garasi/respray (tiang cahaya).
  const mk = (x, z, col) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 14, 8),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35 }));
    m.position.set(x, 7, z); scene.add(m);
  };
  mk(city.garage.x, city.garage.z, 0x2eff5e); mk(city.respray.x, city.respray.z, 0xb46bff);
  mk(city.taxiStand.x, city.taxiStand.z, 0xffe14d); mk(city.raceStart.x, city.raceStart.z, 0xff7a1a);
  for (const p of city.photoSpots) mk(p.x, p.z, 0xc678ff);
  for (const f of city.fishingSpots) mk(f.x, f.z, 0x37e0ff);
  G.city = city;
  return city;
}
export function updateCityFx(dt) {
  const city = G.city; if (!city) return;
  const t = G.time;
  for (const tl of city.trafficLights) {
    const ph = (t + tl.off) % 9;
    const on = ph < 4 ? 2 : ph < 5 ? 1 : 0;
    tl.dots.forEach((d, i) => { d.material.color.setHex(i === on ? [0xff2e2e, 0xffc832, 0x2eff5e][i] : 0x331111); d.scale.setScalar(i === on ? 1.3 : 1); });
  }
  for (const b of city.birds) {
    const u = b.userData; const a = u.ph + t * u.sp;
    b.position.set(Math.cos(a) * u.r, u.h + Math.sin(t * 0.7 + u.ph) * 2, Math.sin(a) * u.r);
    b.rotation.y = -a + (u.sp > 0 ? 0 : Math.PI);
    const flap = Math.sin(t * 9 + u.ph) * 0.7;
    u.w1.rotation.z = flap; u.w2.rotation.z = -flap;
  }
  if (city.wheel) city.wheel.rotation.z += dt * 0.25;
  if (city.lighthouseTop) city.lighthouseTop.material.color.setHex(Math.sin(t * 2) > 0 ? 0xffe9a0 : 0x8a7a4a);
  const night = G.nightF;
  for (const m of city.facadeMats) m.emissiveIntensity = night * 0.9;
  for (const h of city.neonHalos) h.material.opacity = 0.10 + night * 0.55;
  for (const l of city.lamps) l.material.color.setHex(night > 0.4 ? 0xffe9a0 : 0x8a8a7a);
}
