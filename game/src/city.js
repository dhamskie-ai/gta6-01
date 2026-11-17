// City generation: 6 districts, road grid, buildings, palms, pier + ferris
// wheel, neon signs. Ground is one canvas texture; buildings are one
// InstancedMesh. Roads form a graph the traffic AI follows.
import * as THREE from 'three';
import { CFG, districtAt } from './config.js';

export function roadCoords() {
  const list = [];
  for (let v = -240; v <= 240; v += CFG.roadGap) list.push(v);
  return list;
}

export function buildGroundTexture(rng) {
  const S = 1024, half = CFG.cityHalf, scale = S / (half * 2 + 80);
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  const toPx = (v) => (v + half + 40) * scale;
  ctx.fillStyle = '#2f6fb4'; ctx.fillRect(0, 0, S, S); // sea
  ctx.fillStyle = '#e8d5a2'; ctx.fillRect(toPx(-300), 0, toPx(-270) - toPx(-300), S); // beach
  ctx.fillStyle = '#7d8a7a';
  ctx.fillRect(toPx(-300), 0, S - toPx(-300), S); // land base
  // district block tints
  for (const d of CFG.districts) {
    ctx.fillStyle = '#8a8f7d';
    ctx.fillRect(toPx(d.x0), toPx(d.z0), toPx(d.x1) - toPx(d.x0), toPx(d.z1) - toPx(d.z0));
  }
  // parks
  ctx.fillStyle = '#5d8a4a';
  ctx.fillRect(toPx(-270), toPx(150), toPx(-180) - toPx(-270), toPx(240) - toPx(150));
  ctx.fillRect(toPx(120), toPx(-270), toPx(210) - toPx(120), toPx(-210) - toPx(-270));
  // roads
  const roads = roadCoords();
  ctx.fillStyle = '#33363b';
  for (const v of roads) {
    ctx.fillRect(toPx(v - 6), 0, 12 * scale, S);
    ctx.fillRect(0, toPx(v - 6), S, 12 * scale);
  }
  // lane dashes
  ctx.fillStyle = '#d8c95a';
  for (const v of roads) {
    for (let u = -280; u < 280; u += 16) {
      ctx.fillRect(toPx(u), toPx(v) - 1, 7 * scale, 2);
      ctx.fillRect(toPx(v) - 1, toPx(u), 2, 7 * scale);
    }
  }
  // crosswalks at intersections
  ctx.fillStyle = '#d8d8d8';
  for (const x of roads) for (const z of roads) {
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(toPx(x + i * 2.2) - 1, toPx(z - 8), 2, 4 * scale);
      ctx.fillRect(toPx(x + i * 2.2) - 1, toPx(z + 4), 2, 4 * scale);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function makeWindowTexture(rng) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 14) {
    for (let x = 6; x < 58; x += 14) {
      ctx.fillStyle = rng.chance(0.35) ? '#ffd76a' : '#2a3644';
      ctx.fillRect(x, y, 9, 9);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(G) {
  const rng = G.rng;
  const group = new THREE.Group();
  group.name = 'city';
  const groundTex = buildGroundTexture(rng);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(680, 680),
    new THREE.MeshLambertMaterial({ map: groundTex }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Buildings: one InstancedMesh, per-district heights, window texture.
  const winTex = makeWindowTexture(rng);
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const mat = new THREE.MeshLambertMaterial({ map: winTex, emissive: 0x222222, emissiveMap: winTex });
  const spots = [];
  const roads = roadCoords();
  const colliders = [];
  for (let ix = 0; ix < roads.length - 1; ix++) {
    for (let iz = 0; iz < roads.length - 1; iz++) {
      const x0 = roads[ix] + 9, x1 = roads[ix + 1] - 9;
      const z0 = roads[iz] + 9, z1 = roads[iz + 1] - 9;
      if (x1 - x0 < 14 || z1 - z0 < 14) continue;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const d = districtAt(cx, cz);
      if (rng.chance(0.12)) continue; // empty lot / plaza
      const n = rng.chance(0.5) ? 1 : 2;
      for (let k = 0; k < n; k++) {
        const w = rng.range(12, Math.min(24, x1 - x0 - 4));
        const dep = rng.range(12, Math.min(24, z1 - z0 - 4));
        const h = rng.range(d.minH, d.maxH);
        const bx = cx + (n === 2 ? (k === 0 ? -w * 0.55 : w * 0.55) : 0);
        const bz = cz + (n === 2 ? (k === 0 ? -dep * 0.3 : dep * 0.3) : 0);
        const tint = new THREE.Color(d.tint).multiplyScalar(rng.range(0.75, 1.1));
        spots.push({ x: bx, z: bz, w, d: dep, h, color: tint });
        colliders.push({ x0: bx - w / 2, z0: bz - dep / 2, x1: bx + w / 2, z1: bz + dep / 2 });
      }
    }
  }
  const inst = new THREE.InstancedMesh(geo, mat, spots.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  spots.forEach((s, i) => {
    m4.compose(new THREE.Vector3(s.x, 0, s.z), q, new THREE.Vector3(s.w, s.h, s.d));
    inst.setMatrixAt(i, m4);
    inst.setColorAt(i, s.color);
  });
  inst.castShadow = true;
  inst.receiveShadow = true;
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  group.add(inst);
  G.buildings = spots;
  G.colliders = colliders;

  // Palm trees along the beach + parks (instanced trunk + canopy).
  const palmSpots = [];
  for (let z = -280; z <= 280; z += 24) {
    if (rng.chance(0.75)) palmSpots.push({ x: rng.range(-288, -272), z: z + rng.range(-6, 6) });
  }
  for (let i = 0; i < 26; i++) {
    palmSpots.push({ x: rng.range(-270, -180), z: rng.range(150, 240) });
    palmSpots.push({ x: rng.range(120, 210), z: rng.range(-270, -210) });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
  trunkGeo.translate(0, 3.5, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const crownGeo = new THREE.ConeGeometry(3.2, 3.5, 7);
  crownGeo.translate(0, 8.2, 0);
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x2f7d3a });
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, palmSpots.length);
  palmSpots.forEach((p, i) => {
    m4.compose(new THREE.Vector3(p.x, 0, p.z), q, one);
    trunks.setMatrixAt(i, m4);
    crowns.setMatrixAt(i, m4);
  });
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  group.add(trunks); group.add(crowns);

  // Street lamps along roads.
  const lampGeo = new THREE.CylinderGeometry(0.12, 0.12, 6, 5);
  lampGeo.translate(0, 3, 0);
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x3c4148 });
  const lampSpots = [];
  for (const v of roads) for (let u = -240; u <= 240; u += 60) {
    lampSpots.push({ x: v + 8, z: u }); lampSpots.push({ x: u, z: v + 8 });
  }
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lampSpots.length);
  lampSpots.forEach((p, i) => {
    m4.compose(new THREE.Vector3(p.x, 0, p.z), q, one);
    lamps.setMatrixAt(i, m4);
  });
  lamps.instanceMatrix.needsUpdate = true;
  group.add(lamps);
  G.lampPositions = lampSpots;

  buildMarina(G, group);
  buildNeonSigns(G, group);
  return group;
}

function buildMarina(G, group) {
  const rng = G.rng;
  // Wooden pier into the sea, west edge.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 8), pierMat);
  pier.position.set(-315, 0.5, 40);
  pier.castShadow = true;
  group.add(pier);
  for (let i = 0; i < 6; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 6), pierMat);
    post.position.set(-290 - i * 8, 0.2, 36.5);
    group.add(post);
    const post2 = post.clone(); post2.position.z = 43.5;
    group.add(post2);
  }
  // Ferris wheel at the pier end.
  const wheel = new THREE.Group();
  wheel.position.set(-338, 16, 40);
  const rimMat = new THREE.MeshLambertMaterial({ color: 0xd84a8a, emissive: 0x661133 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(13, 0.5, 6, 24), rimMat);
  wheel.add(rim);
  const cabinMat = new THREE.MeshLambertMaterial({ color: 0xf2e14c, emissive: 0x554400 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), cabinMat);
    cab.position.set(Math.cos(a) * 13, Math.sin(a) * 13, 0);
    wheel.add(cab);
  }
  const legMat = new THREE.MeshLambertMaterial({ color: 0x555c66 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(1, 18, 1), legMat);
  legL.position.set(-4, -8, 0); legL.rotation.z = 0.25;
  const legR = legL.clone(); legR.position.x = 4; legR.rotation.z = -0.25;
  wheel.add(legL); wheel.add(legR);
  wheel.name = 'ferrisWheel';
  G.ferrisWheel = wheel;
  group.add(wheel);
  // Beach cafe + umbrellas.
  const cafe = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 8), new THREE.MeshLambertMaterial({ color: 0xf2e6c8 }));
  cafe.position.set(-262, 2, 120);
  cafe.castShadow = true;
  group.add(cafe);
  for (let i = 0; i < 5; i++) {
    const um = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.4, 8),
      new THREE.MeshLambertMaterial({ color: [0xe84a4a, 0x4a8ae8, 0xf2c200, 0x4ae88a, 0xe84ad8][i] }));
    um.position.set(-282 + rng.range(-2, 2), 2.6, 90 + i * 14);
    group.add(um);
  }
  // Docks: containers + crane.
  const contColors = [0xc84a2a, 0x2a7ac8, 0x3aa84a, 0xc8a82a, 0x7a4ac8];
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.6),
      new THREE.MeshLambertMaterial({ color: contColors[i % contColors.length] }));
    c.position.set(200 + (i % 4) * 9, 1.3 + Math.floor(i / 4) * 2.7, 220 + Math.floor(i / 8) * 8);
    c.rotation.y = (i % 3) * 0.06;
    c.castShadow = true;
    group.add(c);
    G.colliders.push({ x0: c.position.x - 3, z0: c.position.z - 1.5, x1: c.position.x + 3, z1: c.position.z + 1.5 });
  }
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xd8a82a });
  const crane = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.BoxGeometry(3, 34, 3), craneMat);
  mast.position.y = 17;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(30, 2, 2), craneMat);
  arm.position.set(12, 32, 0);
  crane.add(mast); crane.add(arm);
  crane.position.set(250, 0, 180);
  group.add(crane);
}

function neonSignTexture(text, color) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#101018'; ctx.fillRect(0, 0, 256, 64);
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = color; ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildNeonSigns(G, group) {
  const signs = [
    { text: 'SOLARA', color: '#ff5ad8', x: -60, z: -120, y: 14, w: 22 },
    { text: 'MARINA', color: '#4ad8ff', x: -262, z: 120, y: 7, w: 16 },
    { text: 'SPRAY & SHINE', color: '#ffd24a', x: 120, z: 60, y: 9, w: 20 },
    { text: "CAL'S GUNS", color: '#ff6a4a', x: 180, z: -60, y: 9, w: 18 },
    { text: 'TACOS', color: '#7aff6a', x: -60, z: 60, y: 8, w: 12 },
  ];
  G.neonSigns = [];
  for (const s of signs) {
    const tex = neonSignTexture(s.text, s.color);
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.w / 4), mat);
    mesh.position.set(s.x, s.y, s.z);
    mesh.rotation.y = Math.PI / 4;
    mesh.name = 'neon';
    group.add(mesh);
    G.neonSigns.push(mesh);
  }
}

// Circle vs building AABB push-out. Returns true if a collision happened.
export function collideBuildings(G, pos, radius) {
  let hit = false;
  for (const b of G.colliders) {
    const cx = Math.max(b.x0, Math.min(pos.x, b.x1));
    const cz = Math.max(b.z0, Math.min(pos.z, b.z1));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        pos.x = b.x1 + radius;
      }
    }
  }
  return hit;
}

export function clampToCity(pos, margin = 4) {
  const h = CFG.cityHalf - margin;
  pos.x = Math.max(-h, Math.min(h, pos.x));
  pos.z = Math.max(-h, Math.min(h, pos.z));
}
