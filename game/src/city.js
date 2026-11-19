// SOLARA BAY — city generation. Round 6f sharpness fixes:
// - facades drawn at 1024px and REPEATED per building size (RepeatWrapping,
//   repeat = size/14 m) so windows never stretch, whatever the tower height.
// - road paint (centre dashes, edge lines, zebra crossings) is crisp
//   GEOMETRY floating 2 cm above the asphalt, not pixels in the ground
//   texture, so it stays sharp up close and far away.
// - ground texture raised to 4096px over 640 m (6.4 px/m).
// - palms are detailed geometry (ringed trunk, 8 drooping fronds, coconuts)
//   with per-instance colour/scale variation; leafy park trees added.
// - buildings get geometry windows, balconies, AC units, roof tanks and
//   antennas, so detail is real edges, not a blurred texture.
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

// Merge coloured geometry parts into one BufferGeometry (vertex colours).
function mergeParts(parts) {
  const pos = [], norm = [], col = [], idx = [];
  let base = 0;
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  for (const part of parts) {
    const p = part.geo.attributes.position;
    const nm = part.geo.attributes.normal;
    const ix = part.geo.index;
    const c = new THREE.Color(part.color);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(part.matrix);
      pos.push(v.x, v.y, v.z);
      n.fromBufferAttribute(nm, i).transformDirection(part.matrix);
      norm.push(n.x, n.y, n.z);
      col.push(c.r, c.g, c.b);
    }
    if (ix) { for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base); }
    else { for (let i = 0; i < p.count; i++) idx.push(base + i); }
    base += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

function mat4(x, y, z, rx, ry, rz, s) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0));
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s || 1, s || 1, s || 1));
  return m;
}

function mat4s(x, y, z, rx, ry, rz, sx, sy, sz) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0));
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
  return m;
}

// Facade material only — no windows painted in (windows are geometry).
// One 1024px tile covers 14 m; buildings repeat it, so detail stays 1:1.
function facadeTexture(rng, variant, aniso) {
  const [c, g] = makeCanvas(1024, 1024);
  if (variant === 'brick' || variant === 'brickDark') {
    const base = variant === 'brick' ? '#8a4a38' : '#5a3a30';
    g.fillStyle = base; g.fillRect(0, 0, 1024, 1024);
    const rows = 48, bh = 1024 / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * 21;
      for (let x = -42; x < 1024; x += 42) {
        const l = ri(rng, -16, 16);
        g.fillStyle = `rgba(${138 + l},${74 + l},${56 + l},0.6)`;
        g.fillRect(x + off + 1, r * bh + 1, 40, bh - 2);
      }
      g.fillStyle = 'rgba(40,26,20,0.55)';
      g.fillRect(0, r * bh, 1024, 2);
    }
  } else if (variant === 'concrete') {
    g.fillStyle = '#9aa0a8'; g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(${ri(rng, 60, 130)},${ri(rng, 60, 130)},${ri(rng, 60, 135)},0.10)`;
      g.fillRect(ri(rng, 0, 1024), ri(rng, 0, 1024), ri(rng, 2, 12), ri(rng, 2, 12));
    }
    g.strokeStyle = 'rgba(70,76,84,0.8)'; g.lineWidth = 3;
    for (let x = 0; x <= 1024; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1024); g.stroke(); }
    for (let y = 0; y <= 1024; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
    for (let i = 0; i < 9; i++) {
      g.fillStyle = 'rgba(80,84,88,0.12)';
      g.fillRect(ri(rng, 0, 800), ri(rng, 0, 800), ri(rng, 40, 180), ri(rng, 30, 140));
    }
  } else if (variant === 'glass' || variant === 'tower') {
    const grad = g.createLinearGradient(0, 0, 1024, 1024);
    if (variant === 'glass') { grad.addColorStop(0, '#3d6a8c'); grad.addColorStop(1, '#274b66'); }
    else { grad.addColorStop(0, '#22384e'); grad.addColorStop(1, '#14273a'); }
    g.fillStyle = grad; g.fillRect(0, 0, 1024, 1024);
    g.strokeStyle = 'rgba(220,235,245,0.6)'; g.lineWidth = 3;
    for (let x = 0; x <= 1024; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1024); g.stroke(); }
    for (let y = 0; y <= 1024; y += 96) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.beginPath(); g.moveTo(0, 1024); g.lineTo(420, 0); g.lineTo(620, 0); g.lineTo(200, 1024); g.fill();
    g.beginPath(); g.moveTo(620, 1024); g.lineTo(1024, 120); g.lineTo(1024, 320); g.lineTo(780, 1024); g.fill();
  } else { // stucco pastel
    const tones = ['#e8b04b', '#d97b6c', '#7fb5a8', '#c98bb0', '#e6d3a3', '#8fb6d9'];
    const base = pick(rng, tones);
    g.fillStyle = base; g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 3200; i++) {
      g.fillStyle = `rgba(255,255,255,${rr(rng, 0.02, 0.07)})`;
      g.fillRect(ri(rng, 0, 1024), ri(rng, 0, 1024), 3, 3);
    }
    g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, 0, 1024, 18);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 990, 1024, 34);
  }
  const t = canvasTex(c, aniso);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  return t;
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

function neonTexture(text, color) {
  const [c, g] = makeCanvas(512, 128);
  g.clearRect(0, 0, 512, 128);
  g.font = 'bold 64px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 26;
  g.fillStyle = color;
  g.fillText(text, 256, 64);
  g.shadowBlur = 8;
  g.fillStyle = '#ffffff';
  g.fillText(text, 256, 64);
  return canvasTex(c, 8);
}

function groundTexture(rng, aniso) {
  const S = 4096, W = 640, k = S / W;
  const px = (x) => (x + 320) * k;
  const pz = (z) => (z + 320) * k;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = '#8d8a76'; g.fillRect(0, 0, S, S);
  // Sea (west of the coast) with a soft gradient + wave strokes.
  const sg = g.createLinearGradient(0, 0, px(-258), 0);
  sg.addColorStop(0, '#155a78'); sg.addColorStop(1, '#2b8ab0');
  g.fillStyle = sg; g.fillRect(0, 0, px(-258), S);
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3;
  for (let i = 0; i < 90; i++) {
    const y = ri(rng, 0, S);
    g.beginPath(); g.moveTo(ri(rng, 0, 90), y);
    g.bezierCurveTo(90, y - 8, 180, y + 8, px(-262) * rng() + 60, y + ri(rng, -6, 6));
    g.stroke();
  }
  // Beach sand with speckle.
  g.fillStyle = '#d9c08a'; g.fillRect(px(-258), 0, px(-246) - px(-258), S);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(120,95,50,${rr(rng, 0.05, 0.2)})`;
    g.fillRect(rr(rng, px(-258), px(-246)), ri(rng, 0, S), 3, 3);
  }
  g.fillStyle = '#a97e4f'; g.fillRect(px(-252), 0, px(-246) - px(-252), S);
  // City blocks: pavement / park fill.
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
        for (let n = 0; n < 90; n++) {
          g.fillStyle = `rgba(40,90,40,${rr(rng, 0.08, 0.2)})`;
          g.beginPath();
          g.arc(rr(rng, px(x0), px(x1)), rr(rng, pz(z0), pz(z1)), rr(rng, 6, 20), 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  }
  // Sidewalks (light) hugging every road.
  const sw = CFG.sidewalk;
  g.fillStyle = '#b7b0a0';
  for (const r of lines) {
    g.fillRect(px(r - 5 - sw), 0, sw * k, S);
    g.fillRect(px(r + 5), 0, sw * k, S);
    g.fillRect(0, pz(r - 5 - sw), S, sw * k);
    g.fillRect(0, pz(r + 5), S, sw * k);
  }
  // Asphalt: dark base + fine speckle so it is not a flat blur.
  g.fillStyle = '#3a3d42';
  for (const r of lines) {
    g.fillRect(px(r - 5), 0, 10 * k, S);
    g.fillRect(0, pz(r - 5), S, 10 * k);
  }
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${ri(rng, 90, 140)},${ri(rng, 90, 140)},${ri(rng, 95, 145)},0.12)`;
    g.fillRect(ri(rng, 0, S), ri(rng, 0, S), 3, 3);
  }
  return canvasTex(c, aniso);
}

// Detailed palm: ringed trunk, 8 drooping fronds (each 3 tapered
// leaflets), coconut cluster. One merged geometry, instanced with tint.
function buildPalmGeometry() {
  const parts = [];
  const trunkCols = [0x7a5a38, 0x6e5132, 0x84653f];
  let y = 0;
  for (let s = 0; s < 5; s++) {
    const h = 1.5;
    const r0 = 0.34 - s * 0.045, r1 = 0.30 - s * 0.045;
    parts.push({ geo: new THREE.CylinderGeometry(r1, r0, h, 7), matrix: mat4(0, y + h / 2, 0, 0, 0, 0.05), color: trunkCols[s % 3] });
    parts.push({ geo: new THREE.TorusGeometry(r0, 0.05, 5, 10), matrix: mat4(0.08 * s, y + h, 0, Math.PI / 2, 0, 0), color: 0x5a4028 });
    y += h;
  }
  const topY = y;
  // Frond leaflet: tapered, drooping plane.
  const leaf = new THREE.PlaneGeometry(3.0, 0.62, 6, 1);
  const lp = leaf.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const x = lp.getX(i) + 1.5;
    const f = x / 3.0;
    lp.setZ(i, lp.getZ(i) * (1 - f * 0.85));
    lp.setY(i, lp.getY(i) - f * f * 1.1);
  }
  leaf.computeVertexNormals();
  for (let f = 0; f < 8; f++) {
    const ang = (f / 8) * Math.PI * 2;
    const green = f % 2 ? 0x2f7a2e : 0x3a8f35;
    for (let l = -1; l <= 1; l++) {
      const m = new THREE.Matrix4()
        .makeRotationY(ang + l * 0.22)
        .multiply(new THREE.Matrix4().makeRotationZ(0.35 + l * 0.12))
        .multiply(new THREE.Matrix4().makeTranslation(0.1, topY + 0.15 - Math.abs(l) * 0.25, 0));
      parts.push({ geo: leaf, matrix: m, color: green });
    }
  }
  for (let i = 0; i < 3; i++) {
    parts.push({ geo: new THREE.SphereGeometry(0.22, 8, 6), matrix: mat4(Math.cos(i * 2.1) * 0.3, topY - 0.1, Math.sin(i * 2.1) * 0.3, 0, 0, 0), color: 0x6b4a26 });
  }
  return mergeParts(parts);
}

// Leafy park tree: trunk + three flat-shaded canopy spheres.
function buildLeafyGeometry() {
  const parts = [];
  parts.push({ geo: new THREE.CylinderGeometry(0.28, 0.42, 2.6, 7), matrix: mat4(0, 1.3, 0, 0, 0, 0), color: 0x6b4a2c });
  const greens = [0x3f8f3a, 0x4da344, 0x357a30];
  const blobs = [[0, 3.6, 0, 1.7], [-1.1, 3.0, 0.4, 1.2], [1.0, 3.1, -0.4, 1.25], [0.2, 4.4, 0.2, 1.1]];
  blobs.forEach(([x, yy, z, r], i) => {
    parts.push({ geo: new THREE.IcosahedronGeometry(r, 1), matrix: mat4(x, yy, z, 0, 0, 0), color: greens[i % 3] });
  });
  return mergeParts(parts);
}

export function buildCity(scene, rng, maxAniso, lowDetail) {
  const aniso = maxAniso || 8;
  const city = { group: new THREE.Group(), buildings: [], coins: [] };
  scene.add(city.group);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(640, 640),
    new THREE.MeshLambertMaterial({ map: groundTexture(rng, aniso) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  city.group.add(ground);

  // ---- crisp road paint as geometry (never stretched texture) ----
  const dashGeo = new THREE.BoxGeometry(0.28, 0.02, 3.2);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  const dashMats = [];
  const zebraGeo = new THREE.BoxGeometry(0.7, 0.02, 5.6);
  const zebraMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
  const zebraMats = [];
  const edgeGeo = new THREE.BoxGeometry(0.22, 0.02, 20);
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e8 });
  const edgeMats = [];
  const dummy = new THREE.Object3D();
  for (const r of CFG.roads) {
    for (let v = -290; v < 290; v += 7) {
      if (Math.abs(v - r) < 9) continue; // gap at intersections
      dashMats.push(mat4(r, 0.02, v, 0, 0, 0));
      dashMats.push(mat4(v, 0.02, r, 0, Math.PI / 2, 0));
    }
    for (const s of [-4.7, 4.7]) {
      for (let v = -290; v < 290; v += 20) {
        edgeMats.push(mat4(r + s, 0.02, v, 0, 0, 0));
        edgeMats.push(mat4(v, 0.02, r + s, 0, Math.PI / 2, 0));
      }
    }
    for (const o of CFG.roads) {
      for (let k = -2; k <= 2; k++) {
        zebraMats.push(mat4(r + k * 1.1, 0.02, o + 6.2, 0, 0, 0));
        zebraMats.push(mat4(r + 6.2, 0.02, o + k * 1.1, 0, Math.PI / 2, 0));
      }
    }
  }
  const dashMesh = new THREE.InstancedMesh(dashGeo, dashMat, dashMats.length);
  dashMats.forEach((m, i) => dashMesh.setMatrixAt(i, m));
  city.group.add(dashMesh);
  const zebraMesh = new THREE.InstancedMesh(zebraGeo, zebraMat, zebraMats.length);
  zebraMats.forEach((m, i) => zebraMesh.setMatrixAt(i, m));
  city.group.add(zebraMesh);
  const edgeMesh = new THREE.InstancedMesh(edgeGeo, edgeMat, edgeMats.length);
  edgeMats.forEach((m, i) => edgeMesh.setMatrixAt(i, m));
  city.group.add(edgeMesh);

  // ---- sidewalks as raised curb geometry with a hard edge ----
  const curbGeo = new THREE.BoxGeometry(3.5, 0.22, 20);
  const curbMat = new THREE.MeshLambertMaterial({ color: 0xc9c2b2 });
  const curbMats = [];
  for (const r of CFG.roads) {
    for (const s of [-6.75, 6.75]) {
      for (let v = -290; v < 290; v += 20) {
        curbMats.push(mat4(r + s, 0.11, v, 0, 0, 0));
        curbMats.push(mat4(v, 0.11, r + s, 0, Math.PI / 2, 0));
      }
    }
  }
  const curbMesh = new THREE.InstancedMesh(curbGeo, curbMat, curbMats.length);
  curbMats.forEach((m, i) => curbMesh.setMatrixAt(i, m));
  curbMesh.receiveShadow = true;
  city.group.add(curbMesh);

  // ---- buildings ----
  const facadeBase = {
    brick: facadeTexture(rng, 'brick', aniso),
    brickDark: facadeTexture(rng, 'brickDark', aniso),
    concrete: facadeTexture(rng, 'concrete', aniso),
    glass: facadeTexture(rng, 'glass', aniso),
    tower: facadeTexture(rng, 'tower', aniso),
    stucco: facadeTexture(rng, 'stucco', aniso),
  };
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const frameMats = [], glassMats = [], litMats = [], balconyMats = [], acMats = [], tankMats = [];
  const frameGeo = new THREE.BoxGeometry(1.7, 1.1, 0.12);
  const glassGeo = new THREE.BoxGeometry(1.45, 0.9, 0.14);
  const balcGeo = new THREE.BoxGeometry(2.2, 0.14, 0.9);
  const acGeo = new THREE.BoxGeometry(0.7, 0.5, 0.4);
  const tankGeo = new THREE.CylinderGeometry(0.9, 0.9, 1.6, 10);

  function districtHeight(x, z) {
    const d = districtAt(x, z);
    if (d === 'The Spires') return [26, 58];
    if (d === 'Malecón Celeste') return [8, 18];
    if (d === 'The Docks') return [9, 14];
    if (d === 'Vista Hills') return [8, 13];
    if (d === 'Calle Verde') return [10, 18];
    if (d === 'Old Solara') return [10, 20];
    return [10, 22];
  }
  function districtVariant(x, z) {
    const d = districtAt(x, z);
    if (d === 'The Spires') return chance(rng, 0.6) ? 'tower' : 'glass';
    if (d === 'Malecón Celeste') return chance(rng, 0.5) ? 'stucco' : 'brick';
    if (d === 'The Docks') return 'concrete';
    if (d === 'Old Solara') return chance(rng, 0.5) ? 'brick' : 'stucco';
    return pick(rng, ['stucco', 'brick', 'concrete']);
  }

  const edges = [-300, ...CFG.roads, 300];
  const blocks = [];
  for (let i = 0; i < edges.length - 1; i++) {
    for (let j = 0; j < edges.length - 1; j++) {
      blocks.push([edges[i] + 8.5, edges[i + 1] - 8.5, edges[j] + 8.5, edges[j + 1] - 8.5]);
    }
  }
  for (const [x0, x1, z0, z1] of blocks) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (x1 < -246) continue; // sea
    const park = (x1 > 120 && z1 > 120) || (x0 >= 120 && z0 < -180);
    if (park) continue;
    const bw = x1 - x0, bd = z1 - z0;
    const n = (bw > 60 && bd > 60) ? 4 : 1;
    for (let b = 0; b < n; b++) {
      const w = n === 4 ? bw / 2 - 6 : bw - 4;
      const d = n === 4 ? bd / 2 - 6 : bd - 4;
      const bx = n === 4 ? x0 + (b % 2) * (bw / 2) + bw / 4 : cx;
      const bz = n === 4 ? z0 + Math.floor(b / 2) * (bd / 2) + bd / 4 : cz;
      const [hMin, hMax] = districtHeight(bx, bz);
      const h = rr(rng, hMin, hMax);
      const variant = districtVariant(bx, bz);
      const tex = facadeBase[variant].clone();
      tex.needsUpdate = true;
      tex.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 14)));
      const sideMat = new THREE.MeshLambertMaterial({ map: tex });
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sideMat, sideMat, roofMat, roofMat, sideMat, sideMat]);
      box.position.set(bx, h / 2, bz);
      box.castShadow = true; box.receiveShadow = true;
      city.group.add(box);
      city.buildings.push({ x: bx, z: bz, hw: w / 2, hd: d / 2, h });
      // Crisp geometry windows on the two street-facing sides.
      const floors = Math.max(1, Math.floor(h / 3.6));
      const cols = Math.max(1, Math.floor(w / 3.4));
      for (let f = 0; f < floors; f++) {
        for (let cIdx = 0; cIdx < cols; cIdx++) {
          const wx = bx - w / 2 + 1.8 + cIdx * 3.4;
          const wy = 2.6 + f * 3.6;
          if (wy > h - 1.4) continue;
          const lit = chance(rng, 0.35);
          frameMats.push(mat4(wx, wy, bz + d / 2 + 0.06, 0, 0, 0));
          frameMats.push(mat4(wx, wy, bz - d / 2 - 0.06, 0, 0, 0));
          (lit ? litMats : glassMats).push(mat4(wx, wy, bz + d / 2 + 0.08, 0, 0, 0));
          (lit ? litMats : glassMats).push(mat4(wx, wy, bz - d / 2 - 0.08, 0, 0, 0));
          if (chance(rng, 0.16) && f > 0) {
            balconyMats.push(mat4(wx, wy - 0.7, bz + d / 2 + 0.5, 0, 0, 0));
            balconyMats.push(mat4(wx, wy - 0.7, bz - d / 2 - 0.5, 0, 0, 0));
          }
          if (chance(rng, 0.12)) acMats.push(mat4(wx + 0.9, wy - 0.9, bz + d / 2 + 0.25, 0, 0, 0));
        }
      }
      // Rooftop detail: water tank, antenna, parapet trim.
      if (chance(rng, 0.5)) tankMats.push(mat4(bx + w * 0.25, h + 0.8, bz, 0, 0, 0));
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.35, d + 0.4),
        new THREE.MeshLambertMaterial({ color: 0x22262c }));
      trim.position.set(bx, h + 0.17, bz);
      city.group.add(trim);
      if (chance(rng, 0.4)) {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 5, 6),
          new THREE.MeshLambertMaterial({ color: 0x30343a }));
        ant.position.set(bx - w * 0.3, h + 2.5, bz);
        city.group.add(ant);
      }
    }
  }
  function instanced(geo, mat, mats, colors) {
    if (!mats.length) return null;
    const m = new THREE.InstancedMesh(geo, mat, mats.length);
    mats.forEach((mm, i) => {
      m.setMatrixAt(i, mm);
      if (colors) m.setColorAt(i, colors[i]);
    });
    m.instanceMatrix.needsUpdate = true;
    city.group.add(m);
    return m;
  }
  instanced(frameGeo, new THREE.MeshLambertMaterial({ color: 0x22262c }), frameMats);
  instanced(glassGeo, new THREE.MeshLambertMaterial({ color: 0x9fc4dd, emissive: 0x1a2c3a, emissiveIntensity: 0.4 }), glassMats);
  const litMat = new THREE.MeshBasicMaterial({ color: 0xffd88a });
  city.litMesh = instanced(glassGeo, litMat, litMats);
  instanced(balcGeo, new THREE.MeshLambertMaterial({ color: 0x6a6f75 }), balconyMats);
  instanced(acGeo, new THREE.MeshLambertMaterial({ color: 0x8a9097 }), acMats);
  instanced(tankGeo, new THREE.MeshLambertMaterial({ color: 0x5a6a72 }), tankMats);

  // ---- shop signs (crisp text planes on the coastal strip) ----
  SHOP_SIGNS.forEach((s, i) => {
    const tex = signTexture(s.text, s.fg, s.bg, true);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2),
      new THREE.MeshBasicMaterial({ map: tex }));
    const x = -228 + (i % 2) * 2;
    const z = -200 + i * 62;
    p.position.set(x, 5.5, z);
    p.rotation.y = Math.PI / 2;
    city.group.add(p);
  });
  // ---- neon signs ----
  city.neonMats = [];
  for (const ns of NEON_SIGNS) {
    const tex = neonTexture(ns.text, ns.color);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), mat);
    p.position.set(ns.x, 7, ns.z);
    p.rotation.y = ns.face === 'E' ? Math.PI / 2 : ns.face === 'N' ? Math.PI : ns.face === 'W' ? -Math.PI / 2 : 0;
    city.group.add(p);
    city.neonMats.push(mat);
  }

  // ---- palms along the Malecón + streets, leafy trees in parks ----
  const palmGeo = buildPalmGeometry();
  const palmMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const palmSpots = [];
  for (let z = -270; z <= 270; z += 36) palmSpots.push([-250.5, z + rr(rng, -6, 6)]);
  for (const r of CFG.roads) {
    for (let v = -270; v <= 270; v += 72) {
      palmSpots.push([r + 8.5 + rr(rng, -1, 1), v + rr(rng, -8, 8)]);
      palmSpots.push([r - 8.5 + rr(rng, -1, 1), v + rr(rng, -8, 8)]);
    }
  }
  for (let i = 0; i < 8; i++) palmSpots.push([rr(rng, 40, 90), rr(rng, -90, -40)]);
  const palms = new THREE.InstancedMesh(palmGeo, palmMat, palmSpots.length);
  const tint = new THREE.Color();
  palmSpots.forEach(([x, z], i) => {
    const s = rr(rng, 0.85, 1.3);
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, rr(rng, 0, Math.PI * 2), 0);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    palms.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.29 + rr(rng, -0.02, 0.02), 0.55, 0.5 + rr(rng, -0.08, 0.08));
    palms.setColorAt(i, tint);
  });
  palms.instanceMatrix.needsUpdate = true;
  palms.castShadow = true;
  city.group.add(palms);

  const leafyGeo = buildLeafyGeometry();
  const leafyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const leafySpots = [];
  for (let i = 0; i < 26; i++) leafySpots.push([rr(rng, 130, 290), rr(rng, 130, 290)]);
  for (let i = 0; i < 14; i++) leafySpots.push([rr(rng, 130, 290), rr(rng, -290, -190)]);
  for (let i = 0; i < 10; i++) leafySpots.push([rr(rng, -110, 110), rr(rng, 130, 290)]);
  const leafy = new THREE.InstancedMesh(leafyGeo, leafyMat, leafySpots.length);
  leafySpots.forEach(([x, z], i) => {
    const s = rr(rng, 0.8, 1.4);
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, rr(rng, 0, Math.PI * 2), 0);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    leafy.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.3 + rr(rng, -0.03, 0.03), 0.5, 0.5 + rr(rng, -0.07, 0.07));
    leafy.setColorAt(i, tint);
  });
  leafy.instanceMatrix.needsUpdate = true;
  leafy.castShadow = true;
  city.group.add(leafy);

  // ---- street lamps ----
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6.4, 6);
  const lampSpots = [];
  for (const r of CFG.roads) {
    for (let v = -270; v <= 270; v += 60) {
      lampSpots.push([r + 8.6, v]);
      lampSpots.push([r - 8.6, v + 30]);
    }
  }
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0x2a2f36 }), lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 3.2, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
  });
  city.group.add(poles);
  city.lampHeadMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffca6a, emissiveIntensity: 0.15 });
  const headGeo = new THREE.SphereGeometry(0.28, 8, 6);
  const heads = new THREE.InstancedMesh(headGeo, city.lampHeadMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 6.5, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
  });
  city.group.add(heads);

  // ---- traffic lights at intersections ----
  city.lights = [];
  const lightPoleMat = new THREE.MeshLambertMaterial({ color: 0x30343a });
  for (const rx of CFG.roads) {
    for (const rz of CFG.roads) {
      if (rx < -200 || rz < -200) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 5.2, 6), lightPoleMat);
      pole.position.set(rx + 6.2, 2.6, rz + 6.2);
      city.group.add(pole);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x14181f }));
      box.position.set(rx + 6.2, 5.4, rz + 6.2);
      city.group.add(box);
      const dots = [];
      for (let k = 0; k < 3; k++) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6),
          new THREE.MeshBasicMaterial({ color: [0xff3b30, 0xffcc00, 0x3ddc5a][k] }));
        dot.position.set(rx + 6.2, 5.85 - k * 0.42, rz + 6.2 + 0.28);
        city.group.add(dot);
        dots.push(dot);
      }
      city.lights.push({ x: rx, z: rz, dots });
    }
  }

  // ---- beach umbrellas ----
  const umbParts = [];
  for (let i = 0; i < 10; i++) {
    const x = -252 + rr(rng, 0, 4), z = -260 + i * 52 + rr(rng, -8, 8);
    const col = pick(rng, [0xff5fa2, 0xffd23f, 0x37e0ff, 0xff8f3d]);
    umbParts.push({ geo: new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), matrix: mat4(x, 1.1, z, 0, 0, 0), color: 0x8a6a42 });
    umbParts.push({ geo: new THREE.ConeGeometry(1.9, 0.7, 10), matrix: mat4(x, 2.5, z, 0, 0, 0), color: col });
  }
  city.group.add(new THREE.Mesh(mergeParts(umbParts), new THREE.MeshLambertMaterial({ vertexColors: true })));

  // ---- pier + lighthouse + ferris wheel ----
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  for (let i = 0; i < 14; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(22, 0.3, 2.4), woodMat);
    plank.position.set(-258 - i * 1.6, 0.6, 90);
    plank.castShadow = true;
    city.group.add(plank);
  }
  city.buildings.push({ x: -256, z: -252, hw: 3, hd: 3, h: 30 });
  const lhParts = [];
  lhParts.push({ geo: new THREE.CylinderGeometry(2.2, 3.0, 22, 12), matrix: mat4(-256, 11, -252, 0, 0, 0), color: 0xf2ede2 });
  lhParts.push({ geo: new THREE.CylinderGeometry(2.45, 2.45, 3.2, 12), matrix: mat4(-256, 6, -252, 0, 0, 0), color: 0xd23c2e });
  lhParts.push({ geo: new THREE.CylinderGeometry(2.45, 2.45, 3.2, 12), matrix: mat4(-256, 15, -252, 0, 0, 0), color: 0xd23c2e });
  lhParts.push({ geo: new THREE.CylinderGeometry(1.6, 1.9, 2.4, 10), matrix: mat4(-256, 23, -252, 0, 0, 0), color: 0x22262c });
  city.group.add(new THREE.Mesh(mergeParts(lhParts), new THREE.MeshLambertMaterial({ vertexColors: true })));
  const beamGeo = new THREE.ConeGeometry(4, 60, 12, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
  city.beam = new THREE.Mesh(beamGeo, beamMat);
  city.beam.position.set(-256, 23, -252);
  city.beam.rotation.z = Math.PI / 2;
  city.group.add(city.beam);

  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(11, 0.35, 8, 28), new THREE.MeshLambertMaterial({ color: 0xff5fa2 }));
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 22, 6), new THREE.MeshLambertMaterial({ color: 0x8ef2ff }));
    spoke.rotation.z = (i / 8) * Math.PI;
    wheel.add(spoke);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), new THREE.MeshLambertMaterial({ color: pick(rng, [0xffd23f, 0x37e0ff, 0xff8f3d, 0x8dff9e]) }));
    const a = (i / 8) * Math.PI * 2;
    cab.position.set(Math.cos(a) * 11, Math.sin(a) * 11, 0);
    wheel.add(cab);
  }
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 14, 6), new THREE.MeshLambertMaterial({ color: 0x30343a }));
  legL.position.set(-4, -8, 0); legL.rotation.z = 0.35;
  wheel.add(legL);
  const legR = legL.clone(); legR.position.x = 4; legR.rotation.z = -0.35;
  wheel.add(legR);
  wheel.position.set(-252, 16, -180);
  city.group.add(wheel);
  city.wheel = wheel;

  // ---- docks: containers + crane ----
  const contCols = [0xd23c2e, 0x2e6fd2, 0x3a9e4f, 0xe8b93a, 0x8a5fd2];
  for (let i = 0; i < 26; i++) {
    const x = rr(rng, -260, -140), z = rr(rng, -290, -200);
    const cont = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.6),
      new THREE.MeshLambertMaterial({ color: pick(rng, contCols) }));
    cont.position.set(x, 1.3 + (i % 3) * 0.1, z);
    cont.rotation.y = chance(rng, 0.5) ? 0 : Math.PI / 2;
    cont.castShadow = true;
    city.group.add(cont);
    city.buildings.push({ x, z, hw: 3.2, hd: 3.2, h: 3 });
  }
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xe8b93a });
  const craneBase = new THREE.Mesh(new THREE.BoxGeometry(4, 18, 4), craneMat);
  craneBase.position.set(-180, 9, -240);
  city.group.add(craneBase);
  const craneArm = new THREE.Mesh(new THREE.BoxGeometry(30, 1.4, 1.4), craneMat);
  craneArm.position.set(-168, 18, -240);
  city.group.add(craneArm);
  city.buildings.push({ x: -180, z: -240, hw: 2, hd: 2, h: 18 });

  // ---- sun coins (collectibles) ----
  const coinGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 18);
  const coinMat = new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0xa87800, emissiveIntensity: 0.7 });
  for (let i = 0; i < CFG.sunCoinCount; i++) {
    const p = randomRoadPoint(rng);
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.position.set(p.x + rr(rng, -4, 4), 1.1, p.z + rr(rng, -4, 4));
    m.rotation.x = Math.PI / 2;
    city.group.add(m);
    city.coins.push({ x: m.position.x, z: m.position.z, mesh: m, taken: false });
  }

  // ---- jetski near the pier (decor) ----
  const jet = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.1), new THREE.MeshLambertMaterial({ color: 0x37e0ff }));
  hull.position.y = 0.3;
  jet.add(hull);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 0.8), new THREE.MeshLambertMaterial({ color: 0x14181f }));
  seat.position.set(-0.3, 0.7, 0);
  jet.add(seat);
  jet.position.set(-266, 0.2, 104);
  jet.rotation.y = 0.7;
  city.group.add(jet);

  return city;
}

export function collideCircle(city, x, z, r) {
  if (x < -300 + r || x > 300 - r || z < -300 + r || z > 300 - r) return true;
  // Sea blocks everything except the pier walkway.
  if (x < -246 - r && !(z > 84 && z < 96 && x > -282)) return true;
  for (const b of city.buildings) {
    const dx = Math.max(Math.abs(x - b.x) - b.hw, 0);
    const dz = Math.max(Math.abs(z - b.z) - b.hd, 0);
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

export function randomRoadPoint(rng) {
  const r = pick(rng, CFG.roads);
  const v = rr(rng, -280, 280);
  return chance(rng, 0.5) ? { x: r + rr(rng, -3, 3), z: v } : { x: v, z: r + rr(rng, -3, 3) };
}

export function lightStateAt(city, x, z, axis, elapsed) {
  const cycle = ((elapsed % 14) + 14) % 14;
  const nsGreen = cycle < 6;
  if (axis === 'x') return nsGreen ? 'green' : 'red';
  return nsGreen ? 'red' : 'green';
}

export function updateCityFx(city, G, dt, elapsed) {
  const nf = nightFactor(G.timeOfDay);
  city.lampHeadMat.emissiveIntensity = 0.15 + nf * 1.6;
  if (city.litMesh) city.litMesh.material.color.setHex(nf > 0.5 ? 0xffd88a : 0xffe9b0);
  for (let i = 0; i < city.neonMats.length; i++) {
    const m = city.neonMats[i];
    m.opacity = 0.75 + nf * 0.25 + Math.sin(elapsed * 3 + i * 1.7) * 0.05;
  }
  if (city.beam) {
    city.beam.rotation.y = elapsed * 0.5;
    city.beam.material.opacity = 0.05 + nf * 0.16;
  }
  if (city.wheel) city.wheel.rotation.z = elapsed * 0.12;
  for (const l of city.lights) {
    const cycle = ((elapsed % 14) + 14) % 14;
    const nsGreen = cycle < 6;
    const amber = cycle >= 6 && cycle < 7;
    l.dots[0].material.color.setHex(nsGreen || amber ? 0x551512 : 0xff3b30);
    l.dots[1].material.color.setHex(amber ? 0xffcc00 : 0x554400);
    l.dots[2].material.color.setHex(nsGreen ? 0x3ddc5a : 0x0f3d1e);
  }
  for (const c of city.coins) {
    if (c.taken) continue;
    c.mesh.rotation.z += dt * 2;
    c.mesh.position.y = 1.1 + Math.sin(elapsed * 2 + c.x) * 0.15;
  }
}
