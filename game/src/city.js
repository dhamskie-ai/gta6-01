import * as THREE from 'three';
import { CFG, SHOP_SIGNS, NEON_SIGNS } from './config.js';
import { rr, ri, pick, chance, shuffle } from './random.js';

export function nightFactor(t) {
  if (t >= 20 || t < 6) return 1;
  if (t >= 18) return (t - 18) / 2;
  if (t < 8) return 1 - (t - 6) / 2;
  return 0;
}

export function districtAt(x, z) {
  if (x < -200) return 'Malecón Celeste';
  if (z < -180) return 'The Docks';
  if (Math.abs(x) < 120 && Math.abs(z) < 120) return 'The Spires';
  if (x < -60 && z > 60) return 'Old Solara';
  if (x > 180) return 'Vista Hills';
  if (z > 180) return 'Calle Verde';
  return 'Marina Bay';
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function canvasTex(c, aniso) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso || 8;
  return t;
}

function facadeTexture(rng, variant, aniso) {
  const [c, g] = makeCanvas(512, 512);
  if (variant === 'brick' || variant === 'brickDark') {
    const base = variant === 'brick' ? '#8a4a38' : '#5a3a30';
    g.fillStyle = base; g.fillRect(0, 0, 512, 512);
    const rows = 32, bh = 512 / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * 16;
      for (let x = -32; x < 512; x += 32) {
        const l = ri(rng, -14, 14);
        g.fillStyle = `rgba(${138 + l},${74 + l},${56 + l},0.55)`;
        g.fillRect(x + off + 1, r * bh + 1, 30, bh - 2);
      }
      g.fillStyle = 'rgba(40,26,20,0.5)';
      g.fillRect(0, r * bh, 512, 1.5);
    }
  } else if (variant === 'concrete') {
    g.fillStyle = '#9aa0a8'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${ri(rng, 60, 130)},${ri(rng, 60, 130)},${ri(rng, 60, 135)},0.10)`;
      g.fillRect(ri(rng, 0, 512), ri(rng, 0, 512), ri(rng, 2, 9), ri(rng, 2, 9));
    }
    g.strokeStyle = 'rgba(70,76,84,0.7)'; g.lineWidth = 2;
    for (let x = 0; x <= 512; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
    for (let y = 0; y <= 512; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
    for (let i = 0; i < 7; i++) {
      g.fillStyle = 'rgba(80,84,88,0.12)';
      g.fillRect(ri(rng, 0, 400), ri(rng, 0, 400), ri(rng, 30, 110), ri(rng, 20, 90));
    }
  } else if (variant === 'glass' || variant === 'tower') {
    const grad = g.createLinearGradient(0, 0, 512, 512);
    if (variant === 'glass') { grad.addColorStop(0, '#3d6a8c'); grad.addColorStop(1, '#274b66'); }
    else { grad.addColorStop(0, '#22384e'); grad.addColorStop(1, '#14273a'); }
    g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(220,235,245,0.55)'; g.lineWidth = 2;
    for (let x = 0; x <= 512; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
    for (let y = 0; y <= 512; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.beginPath(); g.moveTo(0, 512); g.lineTo(200, 0); g.lineTo(300, 0); g.lineTo(100, 512); g.fill();
    g.beginPath(); g.moveTo(300, 512); g.lineTo(512, 60); g.lineTo(512, 160); g.lineTo(380, 512); g.fill();
  } else { // stucco pastel
    const tones = ['#e8b04b', '#d97b6c', '#7fb5a8', '#c98bb0', '#e6d3a3', '#8fb6d9'];
    const base = pick(rng, tones);
    g.fillStyle = base; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = `rgba(255,255,255,${rr(rng, 0.02, 0.07)})`;
      g.fillRect(ri(rng, 0, 512), ri(rng, 0, 512), 2, 2);
    }
    g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, 0, 512, 10);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 496, 512, 16);
  }
  return canvasTex(c, aniso);
}

function signTexture(text, fg, bg, glow) {
  const [c, g] = makeCanvas(512, 128);
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, 500, 116);
  g.fillStyle = fg;
  g.font = 'bold 56px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (glow) { g.shadowColor = fg; g.shadowBlur = 22; }
  g.fillText(text, 256, 66);
  return canvasTex(c, 8);
}

function radialTexture(color) {
  const [c, g] = makeCanvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}

function groundTexture(rng, aniso) {
  const S = 2048, W = 640, k = S / W;
  const px = (x) => (x + 320) * k;
  const pz = (z) => (z + 320) * k;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = '#8d8a76'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#1d6f8e'; g.fillRect(0, 0, px(-258), S);
  const sg = g.createLinearGradient(0, 0, px(-258), 0);
  sg.addColorStop(0, '#155a78'); sg.addColorStop(1, '#2b8ab0');
  g.fillStyle = sg; g.fillRect(0, 0, px(-258), S);
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
  for (let i = 0; i < 60; i++) {
    const y = ri(rng, 0, S);
    g.beginPath(); g.moveTo(ri(rng, 0, 60), y);
    g.bezierCurveTo(60, y - 6, 120, y + 6, px(-262) * rng() + 40, y + ri(rng, -4, 4));
    g.stroke();
  }
  g.fillStyle = '#d9c08a'; g.fillRect(px(-258), 0, px(-246) - px(-258), S);
  for (let i = 0; i < 1500; i++) {
    g.fillStyle = `rgba(120,95,50,${rr(rng, 0.05, 0.2)})`;
    g.fillRect(rr(rng, px(-258), px(-246)), ri(rng, 0, S), 2, 2);
  }
  g.fillStyle = '#a97e4f'; g.fillRect(px(-252), 0, px(-246) - px(-252), S);
  g.strokeStyle = 'rgba(70,45,20,0.6)'; g.lineWidth = 1.5;
  for (let z = -320; z < 320; z += 1.2) {
    g.beginPath(); g.moveTo(px(-252), pz(z)); g.lineTo(px(-246), pz(z)); g.stroke();
  }
  const lines = CFG.roads;
  const edges = [-300, ...lines, 300];
  for (let i = 0; i < edges.length - 1; i++) {
    for (let j = 0; j < edges.length - 1; j++) {
      const x0 = edges[i], x1 = edges[i + 1], z0 = edges[j], z1 = edges[j + 1];
      if (x1 < -246) continue;
      const park = (x1 > 120 && z1 > 120) || (x0 >= 120 && z0 < -180);
      g.fillStyle = park ? '#79a865' : `rgb(${ri(rng, 158, 178)},${ri(rng, 150, 168)},${ri(rng, 132, 150)})`;
      g.fillRect(px(x0), pz(z0), px(x1) - px(x0), pz(z1) - pz(z0));
      if (park) {
        for (let n = 0; n < 40; n++) {
          g.fillStyle = `rgba(40,90,40,${rr(rng, 0.08, 0.2)})`;
          g.beginPath();
          g.arc(rr(rng, px(x0), px(x1)), rr(rng, pz(z0), pz(z1)), rr(rng, 4, 12), 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  }
  const sw = CFG.sidewalk;
  g.fillStyle = '#b7b0a0';
  for (const r of lines) {
    g.fillRect(px(r - 5 - sw), 0, sw * k, S);
    g.fillRect(px(r + 5), 0, sw * k, S);
    g.fillRect(0, pz(r - 5 - sw), S, sw * k);
    g.fillRect(0, pz(r + 5), S, sw * k);
  }
  g.strokeStyle = 'rgba(110,102,84,0.55)'; g.lineWidth = 1;
  for (const r of lines) {
    for (let z = -300; z < 300; z += 2.4) {
      g.beginPath(); g.moveTo(px(r - 5 - sw), pz(z)); g.lineTo(px(r - 5), pz(z)); g.stroke();
      g.beginPath(); g.moveTo(px(r + 5), pz(z)); g.lineTo(px(r + 5 + sw), pz(z)); g.stroke();
    }
    for (let x = -300; x < 300; x += 2.4) {
      g.beginPath(); g.moveTo(px(x), pz(r - 5 - sw)); g.lineTo(px(x), pz(r - 5)); g.stroke();
      g.beginPath(); g.moveTo(px(x), pz(r + 5)); g.lineTo(px(x), pz(r + 5 + sw)); g.stroke();
    }
  }
  g.strokeStyle = '#6f6a5c'; g.lineWidth = 2;
  for (const r of lines) {
    for (const o of [-5, 5]) {
      g.beginPath(); g.moveTo(px(r + o), 0); g.lineTo(px(r + o), S); g.stroke();
      g.beginPath(); g.moveTo(0, pz(r + o)); g.lineTo(S, pz(r + o)); g.stroke();
    }
  }
  g.fillStyle = '#2e3238';
  for (const r of lines) {
    g.fillRect(px(r - 5), 0, 10 * k, S);
    g.fillRect(0, pz(r - 5), S, 10 * k);
  }
  for (let i = 0; i < 14000; i++) {
    const onV = chance(rng, 0.5);
    const a = onV ? rr(rng, px(pick(rng, lines) - 5), px(pick(rng, lines) + 5)) : ri(rng, 0, S);
    const b = onV ? ri(rng, 0, S) : rr(rng, pz(pick(rng, lines) - 5), pz(pick(rng, lines) + 5));
    g.fillStyle = `rgba(${ri(rng, 120, 190)},${ri(rng, 120, 190)},${ri(rng, 125, 195)},${rr(rng, 0.05, 0.22)})`;
    g.fillRect(a, b, 1.6, 1.6);
  }
  for (let i = 0; i < 26; i++) {
    g.fillStyle = 'rgba(20,22,26,0.35)';
    const r = pick(rng, lines);
    g.fillRect(rr(rng, px(r - 5), px(r + 2)), ri(rng, 0, S - 60), rr(rng, 8, 26), rr(rng, 10, 30));
  }
  g.fillStyle = '#e8c832';
  for (const r of lines) {
    for (let s = -300; s < 300; s += 6) {
      g.fillRect(px(r) - 1, pz(s), 2, 3 * k);
      g.fillRect(px(s), pz(r) - 1, 3 * k, 2);
    }
  }
  g.fillStyle = '#f2f2ee';
  for (const r of lines) {
    for (let s = -300; s < 300; s += 6) {
      g.fillRect(px(r - 2.6) - 1, pz(s), 1.6, 2.4 * k);
      g.fillRect(px(r + 2.6) - 1, pz(s), 1.6, 2.4 * k);
      g.fillRect(px(s), pz(r - 2.6) - 1, 2.4 * k, 1.6);
      g.fillRect(px(s), pz(r + 2.6) - 1, 2.4 * k, 1.6);
    }
    g.fillRect(px(r - 4.6), 0, 1.4, S);
    g.fillRect(px(r + 4.6), 0, 1.4, S);
    g.fillRect(0, pz(r - 4.6), S, 1.4);
    g.fillRect(0, pz(r + 4.6), S, 1.4);
  }
  for (const rx of lines) {
    for (const rz of lines) {
      for (let i = -2; i <= 2; i++) {
        g.fillRect(px(rx + i * 1.6) - 2.5, pz(rz - 7.5), 5, 2.2 * k);
        g.fillRect(px(rx + i * 1.6) - 2.5, pz(rz + 5.3), 5, 2.2 * k);
        g.fillRect(px(rx - 7.5), pz(rz + i * 1.6) - 2.5, 2.2 * k, 5);
        g.fillRect(px(rx + 5.3), pz(rz + i * 1.6) - 2.5, 2.2 * k, 5);
      }
    }
  }
  return canvasTex(c, aniso);
}

function buildPalmGeometry() {
  const pos = [], norm = [], col = [], uv = [], idx = [];
  let vc = 0;
  function pushGeom(geo, matrix, color) {
    const p = geo.attributes.position, n = geo.attributes.normal, u = geo.attributes.uv;
    const v = new THREE.Vector3(), nv = new THREE.Vector3();
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const start = vc;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      nv.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      pos.push(v.x, v.y, v.z); norm.push(nv.x, nv.y, nv.z);
      col.push(color.r, color.g, color.b);
      uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
      vc++;
    }
    const ix = geo.index;
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(start + ix.getX(i));
    else for (let i = 0; i < p.count; i++) idx.push(start + i);
  }
  const trunkMat = new THREE.Matrix4();
  let y = 0;
  for (let s = 0; s < 3; s++) {
    const h = 2.0;
    const geo = new THREE.CylinderGeometry(0.13 - s * 0.015, 0.19 - s * 0.015, h, 6, 1);
    trunkMat.makeTranslation(s * 0.22, y + h / 2, 0);
    const tilt = new THREE.Matrix4().makeRotationZ(-0.07);
    trunkMat.premultiply(tilt);
    pushGeom(geo, trunkMat, new THREE.Color(0x7a5a38));
    y += h * 0.985;
  }
  const topX = 0.44, topY = y;
  function frondGeo(len, wid) {
    const seg = 5, positions = [], normals = [], uvs = [], indices = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const w = wid * (1 - t * 0.85);
      const drop = t * t * 1.5;
      positions.push(-w / 2, -drop, t * len, w / 2, -drop, t * len);
      normals.push(0, 1, 0, 0, 1, 0);
      uvs.push(0, t, 1, t);
    }
    for (let i = 0; i < seg; i++) {
      const a = i * 2, b = a + 1, d = a + 2, e = a + 3;
      indices.push(a, d, b, b, d, e);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
  }
  const greens = [new THREE.Color(0x2f7a3d), new THREE.Color(0x3f9448)];
  for (let f = 0; f < 10; f++) {
    const long = f < 6;
    const geo = frondGeo(long ? 3.4 : 2.4, long ? 0.55 : 0.5);
    const m = new THREE.Matrix4().makeTranslation(topX, topY, 0);
    const rotY = new THREE.Matrix4().makeRotationY((f / 10) * Math.PI * 2);
    const tilt = new THREE.Matrix4().makeRotationX(long ? -0.62 : -0.28);
    m.multiply(rotY).multiply(tilt);
    pushGeom(geo, m, greens[f % 2]);
  }
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.SphereGeometry(0.16, 6, 5);
    const m = new THREE.Matrix4().makeTranslation(topX + Math.cos(i * 2.1) * 0.25, topY - 0.25, Math.sin(i * 2.1) * 0.25);
    pushGeom(geo, m, new THREE.Color(0x6b4a26));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

function smallPerson(colors) {
  const grp = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.28), mat(colors.shirt));
  torso.position.y = 1.05; grp.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), mat(colors.skin));
  head.position.y = 1.6; grp.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), mat(colors.pants));
  legL.position.set(-0.13, 0.35, 0); grp.add(legL);
  const legR = legL.clone(); legR.position.x = 0.13; grp.add(legR);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 4), mat(0x5a4632));
  rod.position.set(0.35, 1.4, 0.6); rod.rotation.x = 0.9; grp.add(rod);
  return grp;
}

export function buildCity(scene, rng, maxAniso, lowDetail) {
  const aniso = lowDetail ? 4 : (maxAniso || 8);
  const city = {
    group: new THREE.Group(),
    colliders: [],
    buildings: [],
    neonHalos: [],
    trafficLights: [],
    birds: [],
    jetskis: [],
    lampHeadMat: null,
    bonfireLight: null,
    beam: null,
  };
  scene.add(city.group);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(640, 640),
    new THREE.MeshLambertMaterial({ map: groundTexture(rng, aniso) })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  city.group.add(ground);

  const variants = ['brick', 'concrete', 'glass', 'stucco', 'tower', 'brickDark'];
  const facadeMats = {};
  for (const v of variants) {
    facadeMats[v] = new THREE.MeshLambertMaterial({ map: facadeTexture(rng, v, aniso) });
  }
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x22262c });

  const frameMats = [], glassMats = [], litMats = [], balconyMats = [], acMats = [], tankMats = [];
  const dummy = new THREE.Object3D();
  const litColors = [0xffca6a, 0xffb347, 0xffe9a8, 0xff9d5c];
  const glassColors = [0x4a6a86, 0x557693, 0x5d7f96, 0x3d5a70];

  function districtHeight(x, z) {
    if (Math.abs(x) < 120 && Math.abs(z) < 120) return rr(rng, 30, 68);
    if (x < -180) return rr(rng, 8, 20);
    if (z < -180) return rr(rng, 8, 14);
    if (x > 180) return rr(rng, 6, 12);
    return rr(rng, 9, 18);
  }
  function districtVariant(x, z) {
    if (Math.abs(x) < 120 && Math.abs(z) < 120) return chance(rng, 0.6) ? 'tower' : 'glass';
    if (x < -60 && z > 60) return chance(rng, 0.6) ? 'stucco' : 'brick';
    if (z < -180) return chance(rng, 0.5) ? 'concrete' : 'brickDark';
    return pick(rng, ['brick', 'concrete', 'stucco', 'glass']);
  }

  const lines = CFG.roads;
  const edges = [-300, ...lines, 300];
  const signPool = shuffle(rng, SHOP_SIGNS);
  let signIdx = 0;
  for (let i = 0; i < edges.length - 1; i++) {
    for (let j = 0; j < edges.length - 1; j++) {
      const bx0 = edges[i] + 9, bx1 = edges[i + 1] - 9;
      const bz0 = edges[j] + 9, bz1 = edges[j + 1] - 9;
      if (bx1 <= bx0 || bz1 <= bz0) continue;
      if (bx1 < -246) continue;
      let z = bz0;
      while (z < bz1 - 10) {
        const seg = rr(rng, 16, 28);
        const z1 = Math.min(z + seg, bz1);
        if (chance(rng, 0.82)) {
          const cx = (bx0 + bx1) / 2, cz = (z + z1) / 2;
          const w = (bx1 - bx0) * rr(rng, 0.72, 0.92);
          const d = (z1 - z) * rr(rng, 0.72, 0.92);
          const h = districtHeight(cx, cz);
          const variant = districtVariant(cx, cz);
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facadeMats[variant]);
          mesh.position.set(cx, h / 2, cz);
          mesh.castShadow = !lowDetail; mesh.receiveShadow = true;
          city.group.add(mesh);
          const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.25, d + 0.3), roofMat);
          slab.position.set(cx, h + 0.1, cz);
          city.group.add(slab);
          city.buildings.push({ x: cx, z: cz, w, d, h, variant });
          city.colliders.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 });
          const colStep = lowDetail ? 4.6 : 3.2;
          const rowStep = lowDetail ? 4.4 : 3.4;
          const cols = Math.max(2, Math.floor(w / colStep));
          const colsD = Math.max(2, Math.floor(d / colStep));
          const rows = Math.max(1, Math.floor((h - 4.5) / rowStep));
          const faces = [
            { n: cols, axis: 'z', off: d / 2, rotY: 0, along: 'x' },
            { n: cols, axis: 'z', off: -d / 2, rotY: Math.PI, along: 'x' },
            { n: colsD, axis: 'x', off: w / 2, rotY: Math.PI / 2, along: 'z' },
            { n: colsD, axis: 'x', off: -w / 2, rotY: -Math.PI / 2, along: 'z' },
          ];
          for (const f of faces) {
            for (let rI = 0; rI < rows; rI++) {
              const wy = 4.6 + rI * rowStep;
              if (wy > h - 1.4) break;
              for (let cI = 0; cI < f.n; cI++) {
                const along = -((f.n - 1) * colStep) / 2 + cI * colStep;
                const lit = chance(rng, 0.3);
                let px2, pz2;
                if (f.along === 'x') { px2 = cx + along; pz2 = cz + f.off; }
                else { px2 = cx + f.off; pz2 = cz + along; }
                const out = f.off > 0 ? 0.07 : -0.07;
                const ox = f.along === 'x' ? 0 : out;
                const oz = f.along === 'x' ? out : 0;
                dummy.position.set(px2 + ox, wy, pz2 + oz);
                dummy.rotation.set(0, f.rotY, 0);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                frameMats.push(dummy.matrix.clone());
                dummy.position.set(px2 + ox * 1.4, wy, pz2 + oz * 1.4);
                dummy.updateMatrix();
                if (lit) { litMats.push({ m: dummy.matrix.clone(), c: pick(rng, litColors) }); }
                else { glassMats.push({ m: dummy.matrix.clone(), c: pick(rng, glassColors) }); }
                if (chance(rng, 0.1) && (variant === 'stucco' || variant === 'tower')) {
                  dummy.position.set(px2 + ox * 1.2, wy - 1.05, pz2 + oz * 1.2);
                  dummy.updateMatrix();
                  balconyMats.push(dummy.matrix.clone());
                }
              }
            }
          }
          const nAc = ri(rng, 1, 3);
          for (let a = 0; a < nAc; a++) {
            dummy.position.set(cx + rr(rng, -w / 4, w / 4), h + 0.3, cz + rr(rng, -d / 4, d / 4));
            dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
            acMats.push(dummy.matrix.clone());
          }
          if (h > 20 && chance(rng, 0.5)) {
            dummy.position.set(cx + w / 4, h + 0.9, cz - d / 4);
            dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
            tankMats.push(dummy.matrix.clone());
          }
          if (h < 24 && signIdx < 22 && chance(rng, 0.5)) {
            const s = signPool[signIdx % signPool.length]; signIdx++;
            const tex = signTexture(s.text, s.fg, s.bg, false);
            const plane = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1),
              new THREE.MeshBasicMaterial({ map: tex }));
            const faceSouth = chance(rng, 0.5);
            plane.position.set(cx, 2.7, cz + (faceSouth ? d / 2 + 0.08 : -d / 2 - 0.08));
            plane.rotation.y = faceSouth ? 0 : Math.PI;
            city.group.add(plane);
            const awn = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.12, 1.2),
              new THREE.MeshLambertMaterial({ color: new THREE.Color(s.bg) }));
            awn.position.set(cx, 3.4, cz + (faceSouth ? d / 2 + 0.6 : -d / 2 - 0.6));
            awn.rotation.x = faceSouth ? 0.25 : -0.25;
            city.group.add(awn);
          }
        }
        z = z1 + rr(rng, 2, 6);
      }
    }
  }

  function instanced(geo, mat, mats, colors) {
    if (!mats.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, mats.length);
    mats.forEach((m, i) => {
      im.setMatrixAt(i, m.m || m);
      if (colors && colors[i] !== undefined) im.setColorAt(i, new THREE.Color(colors[i]));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    city.group.add(im);
    return im;
  }
  instanced(new THREE.PlaneGeometry(1.5, 1.9),
    new THREE.MeshLambertMaterial({ color: 0x2a323e }), frameMats);
  instanced(new THREE.PlaneGeometry(1.2, 1.6),
    new THREE.MeshLambertMaterial({ color: 0xffffff }), glassMats.map((o) => o.m), glassMats.map((o) => o.c));
  instanced(new THREE.PlaneGeometry(1.2, 1.6),
    new THREE.MeshBasicMaterial({ color: 0xffffff }), litMats.map((o) => o.m), litMats.map((o) => o.c));
  instanced(new THREE.BoxGeometry(1.7, 0.12, 0.7),
    new THREE.MeshLambertMaterial({ color: 0x6a6f75 }), balconyMats);
  instanced(new THREE.BoxGeometry(0.9, 0.55, 0.9),
    new THREE.MeshLambertMaterial({ color: 0x8a9097 }), acMats);
  instanced(new THREE.CylinderGeometry(0.7, 0.7, 1.6, 8),
    new THREE.MeshLambertMaterial({ color: 0x5a6a72 }), tankMats);

  for (const n of NEON_SIGNS) {
    const tex = signTexture(n.text, n.color, '#101018', true);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    const x = n.x, z = n.z;
    plane.position.set(x, 9, z);
    plane.rotation.y = n.face === 'E' ? -Math.PI / 2 : n.face === 'N' ? Math.PI : 0;
    if (n.face === 'W') plane.rotation.y = Math.PI / 2;
    city.group.add(plane);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(11, 5),
      new THREE.MeshBasicMaterial({
        map: radialTexture(n.color), transparent: true, opacity: 0.12,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
    halo.position.copy(plane.position);
    halo.rotation.copy(plane.rotation);
    halo.position.y = 9;
    city.group.add(halo);
    city.neonHalos.push(halo);
  }

  const palmGeo = buildPalmGeometry();
  const palmMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const palmSpots = [];
  for (let z = -270; z <= 270; z += 36) palmSpots.push([-250.5, z + rr(rng, -6, 6)]);
  for (let x = -270; x <= 270; x += 36) {
    palmSpots.push([x + rr(rng, -4, 4), -8.5]);
    palmSpots.push([x + rr(rng, -4, 4), 8.5]);
    palmSpots.push([-8.5, x + rr(rng, -4, 4)]);
    palmSpots.push([8.5, x + rr(rng, -4, 4)]);
  }
  for (let i = 0; i < 8; i++) palmSpots.push([rr(rng, 40, 90), rr(rng, -90, -40)]);
  const palms = new THREE.InstancedMesh(palmGeo, palmMat, palmSpots.length);
  palmSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, rr(rng, 0, Math.PI * 2), 0);
    const s = rr(rng, 0.9, 1.25);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    palms.setMatrixAt(i, dummy.matrix);
  });
  palms.instanceMatrix.needsUpdate = true;
  palms.castShadow = true;
  city.group.add(palms);

  const lampSpots = [];
  for (const r of lines) {
    for (let s = -280; s <= 280; s += 42) {
      lampSpots.push([r + 7, s]); lampSpots.push([r - 7, s + 21]);
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6, 6);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0x2a2f36 }), lampSpots.length);
  const headGeo = new THREE.SphereGeometry(0.28, 8, 6);
  city.lampHeadMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffca6a, emissiveIntensity: 0.15 });
  const heads = new THREE.InstancedMesh(headGeo, city.lampHeadMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 3, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    dummy.updateMatrix(); poles.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 6.1, z); dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
  });
  poles.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
  city.group.add(poles); city.group.add(heads);

  const lightSpots = [[0, 0], [120, -120], [-120, 120], [120, 120]];
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x30343a });
  for (const [lx, lz] of lightSpots) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5.4, 6), poleMat);
    pole.position.set(lx + 6, 2.7, lz + 6); city.group.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 0.14), poleMat);
    arm.position.set(lx + 4.4, 5.3, lz + 6); city.group.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.4), poleMat);
    head.position.set(lx + 2.8, 4.9, lz + 6); city.group.add(head);
    const dots = {};
    const dotCols = { red: 0xff2a2a, amber: 0xffb52a, green: 0x2aff5c };
    let dy = 5.35;
    for (const k of ['red', 'amber', 'green']) {
      const m = new THREE.MeshBasicMaterial({ color: dotCols[k] });
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), m);
      d.position.set(lx + 2.8, dy, lz + 6.25); dy -= 0.42;
      city.group.add(d);
      dots[k] = m;
    }
    city.trafficLights.push({ x: lx, z: lz, dots, offset: ri(rng, 0, 8) });
  }

  const woodMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  for (let x = -246; x >= -280; x -= 3) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 12), woodMat);
    plank.position.set(x, 0.06, CFG.pier.z);
    city.group.add(plank);
  }
  const pierEnd = new THREE.Mesh(new THREE.BoxGeometry(10, 0.12, 16), woodMat);
  pierEnd.position.set(-282, 0.06, CFG.pier.z); city.group.add(pierEnd);
  for (const [px2, pz2] of [[-250, 84], [-250, 96], [-270, 84], [-270, 96], [-282, 82], [-282, 98]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.6, 6), woodMat);
    post.position.set(px2, -0.4, pz2); city.group.add(post);
  }
  const lh = new THREE.Group();
  for (let s = 0; s < 5; s++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(2.2 - s * 0.18, 2.4 - s * 0.18, 3.4, 10),
      new THREE.MeshLambertMaterial({ color: s % 2 ? 0xe84a3a : 0xf2ede2 }));
    seg.position.y = 1.7 + s * 3.4; lh.add(seg);
  }
  const lampRoom = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 3),
    new THREE.MeshLambertMaterial({ color: 0x22262c, emissive: 0xffe9a8, emissiveIntensity: 0.4 }));
  lampRoom.position.y = 18.4; lh.add(lampRoom);
  const beamGeo = new THREE.ConeGeometry(7, 34, 12, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.rotation.z = Math.PI / 2; beam.position.set(17, 18.4, 0);
  lh.add(beam);
  city.beam = beam; city.beamMat = beamMat;
  lh.position.set(CFG.lighthouse.x, 0, CFG.lighthouse.z);
  lh.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  city.group.add(lh);
  city.colliders.push({ x0: CFG.lighthouse.x - 3, z0: CFG.lighthouse.z - 3, x1: CFG.lighthouse.x + 3, z1: CFG.lighthouse.z + 3 });

  const partySpots = [[-249, 118], [-247, 126], [-250, 134], [-248, 142]];
  const umbCols = [0xff5f7e, 0x37c8e8, 0xffd23f, 0x8dff9e];
  partySpots.forEach(([ux, uz], i) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 5), woodMat);
    pole.position.set(ux, 1.2, uz); city.group.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.9, 8),
      new THREE.MeshLambertMaterial({ color: umbCols[i % 4] }));
    top.position.set(ux, 2.7, uz); city.group.add(top);
    const towel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.8),
      new THREE.MeshLambertMaterial({ color: umbCols[(i + 2) % 4] }));
    towel.position.set(ux + 1.6, 0.08, uz + 0.6); towel.rotation.y = rr(rng, 0, 1); city.group.add(towel);
  });
  const fire = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x8a8a82 }));
    const a = (i / 7) * Math.PI * 2;
    stone.position.set(Math.cos(a) * 0.8, 0.12, Math.sin(a) * 0.8);
    fire.add(stone);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 6),
    new THREE.MeshBasicMaterial({ color: 0xff8f2a }));
  flame.position.y = 0.7; fire.add(flame);
  fire.position.set(-249, 0, 130);
  city.group.add(fire);
  city.bonfireLight = new THREE.PointLight(0xff8f2a, 0, 18);
  city.bonfireLight.position.set(-249, 1.5, 130);
  city.group.add(city.bonfireLight);
  city.flame = flame;

  const fisher1 = smallPerson({ shirt: 0x3f6fb5, pants: 0x3a3f45, skin: 0xc98d64 });
  fisher1.position.set(-272, 0.1, 86); fisher1.rotation.y = -Math.PI / 2;
  city.group.add(fisher1);
  const fisher2 = smallPerson({ shirt: 0xe86a1e, pants: 0x5a4632, skin: 0x8a5a3a });
  fisher2.position.set(-278, 0.1, 95); fisher2.rotation.y = Math.PI;
  city.group.add(fisher2);

  for (let i = 0; i < 3; i++) {
    const js = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 0.9),
      new THREE.MeshLambertMaterial({ color: [0xff2e7e, 0x37c8e8, 0xffd23f][i] }));
    hull.position.y = 0.15; js.add(hull);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x22262c }));
    seat.position.set(-0.3, 0.42, 0); js.add(seat);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 5),
      new THREE.MeshLambertMaterial({ color: 0x22262c }));
    bar.rotation.z = Math.PI / 2; bar.position.set(0.9, 0.55, 0); js.add(bar);
    js.position.set(-266 - i * 4, 0, 66 + i * 9);
    js.rotation.y = rr(rng, 0, Math.PI * 2);
    city.group.add(js);
    city.jetskis.push({ grp: js, phase: rr(rng, 0, 6), baseY: 0 });
  }

  for (let i = 0; i < 6; i++) {
    const bird = new THREE.Group();
    const wingMat = new THREE.MeshBasicMaterial({ color: 0x22262c, side: THREE.DoubleSide });
    const wL = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), wingMat);
    wL.position.x = -0.7; bird.add(wL);
    const wR = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), wingMat);
    wR.position.x = 0.7; bird.add(wR);
    bird.userData = { wL, wR };
    city.group.add(bird);
    city.birds.push({
      grp: bird, r: rr(rng, 60, 150), h: rr(rng, 55, 95),
      speed: rr(rng, 0.05, 0.12) * (chance(rng, 0.5) ? 1 : -1),
      a: rr(rng, 0, Math.PI * 2), flap: rr(rng, 0, 6),
    });
  }

  return city;
}

export function collideCircle(city, x, z, r) {
  for (const b of city.colliders) {
    const cx = Math.max(b.x0, Math.min(x, b.x1));
    const cz = Math.max(b.z0, Math.min(z, b.z1));
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 < 0.0001) { x = b.x1 + r; continue; }
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      z = cz + (dz / d) * r;
    }
  }
  x = Math.max(-298, Math.min(298, x));
  z = Math.max(-298, Math.min(298, z));
  const inPierLane = z > 82 && z < 98;
  if (x < -257 && !(inPierLane && x > -290)) x = -257;
  return { x, z };
}

export function randomRoadPoint(rng) {
  const axis = chance(rng, 0.5) ? 'x' : 'z';
  const line = pick(rng, CFG.roads);
  const along = rr(rng, -280, 280);
  return axis === 'x' ? { x: along, z: line } : { x: line, z: along };
}

export function lightStateAt(city, x, z, axis, elapsed) {
  let best = null, bestD = 1e9;
  for (const l of city.trafficLights) {
    const d = Math.hypot(x - l.x, z - l.z);
    if (d < bestD) { bestD = d; best = l; }
  }
  if (!best || bestD > 26) return 'green';
  const t = (elapsed + best.offset) % 9;
  const nsGreen = t < 4; // north-south (z axis) green first
  if (axis === 'z') return nsGreen ? 'green' : 'red';
  return nsGreen ? 'red' : 'green';
}

export function updateCityFx(city, G, dt, elapsed) {
  const nf = nightFactor(G.timeOfDay);
  for (const h of city.neonHalos) h.material.opacity = 0.12 + nf * 0.5;
  if (city.lampHeadMat) city.lampHeadMat.emissiveIntensity = 0.15 + nf * 1.4;
  for (const l of city.trafficLights) {
    const t = (elapsed + l.offset) % 9;
    const phase = t < 4 ? 'green' : t < 5 ? 'amber' : 'red';
    l.dots.red.color.setHex(phase === 'red' ? 0xff2a2a : 0x4a1414);
    l.dots.amber.color.setHex(phase === 'amber' ? 0xffb52a : 0x4a3414);
    l.dots.green.color.setHex(phase === 'green' ? 0x2aff5c : 0x14341c);
  }
  for (const j of city.jetskis) {
    j.grp.position.y = Math.sin(elapsed * 1.4 + j.phase) * 0.14;
    j.grp.rotation.z = Math.sin(elapsed * 1.1 + j.phase) * 0.06;
  }
  if (city.beam) {
    city.beam.rotation.y = elapsed * 0.5;
    city.beamMat.opacity = nf * 0.28;
  }
  if (city.bonfireLight) {
    city.bonfireLight.intensity = nf * (14 + Math.sin(elapsed * 9) * 3 + Math.sin(elapsed * 23) * 2);
    if (city.flame) city.flame.scale.y = 1 + Math.sin(elapsed * 7) * 0.15;
  }
  for (const b of city.birds) {
    b.a += b.speed * dt;
    b.grp.position.set(Math.cos(b.a) * b.r, b.h + Math.sin(elapsed * 0.7 + b.flap) * 2, Math.sin(b.a) * b.r);
    b.grp.rotation.y = -b.a + (b.speed > 0 ? 0 : Math.PI);
    const flap = Math.sin(elapsed * 6 + b.flap) * 0.55;
    b.grp.userData.wL.rotation.y = flap;
    b.grp.userData.wR.rotation.y = -flap;
  }
}
