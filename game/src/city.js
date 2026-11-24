// Solara Bay city generation: 6 districts, ~120 instanced buildings, grid +
// beach + ring roads, palms, lamps, landmarks (pier, ferris wheel,
// lighthouse, docks crane, market fountain), canvas window texture.
import * as THREE from 'three';
import { rand, randInt, pick } from './random.js';

export const ROAD_XS = [-240, -160, -80, 0, 80, 160, 240];
export const ROAD_ZS = [-240, -160, -80, 0, 80, 160, 240];

function windowTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#cfd8e3'; g.fillRect(0, 0, 64, 128);
  g.fillStyle = '#2b3a4a';
  for (let y = 8; y < 120; y += 16) for (let x = 6; x < 58; x += 14) g.fillRect(x, y, 9, 11);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function signTexture(text, bg, fg) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 64);
  g.fillStyle = fg; g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group(); group.name = 'city'; scene.add(group);
  const winTex = windowTexture();
  const lambert = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, ...opts });

  // Ground: grass base, sand beach strip west, sea plane beyond.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(640, 640), lambert(0x7fae6a));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(48, 640), lambert(0xe8d49a));
  sand.rotation.x = -Math.PI / 2; sand.position.set(-296, 0.02, 0); sand.receiveShadow = true; group.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(160, 640), new THREE.MeshLambertMaterial({ color: 0x2e7fb8 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(-400, 0.01, 0); group.add(sea);

  // Roads: dark strips + sidewalk strips along every grid line + ring roads.
  const roadMat = lambert(0x3a3f46); const walkMat = lambert(0xb9b3a4);
  for (const x of ROAD_XS) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(14, 640), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.03, 0); r.receiveShadow = true; group.add(r);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(20, 640), walkMat);
    w.rotation.x = -Math.PI / 2; w.position.set(x, 0.025, 0); group.add(w);
  }
  for (const z of ROAD_ZS) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(640, 14), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.03, z); r.receiveShadow = true; group.add(r);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(640, 20), walkMat);
    w.rotation.x = -Math.PI / 2; w.position.set(0, 0.025, z); group.add(w);
  }
  // Ring roads east + south, beach promenade curve (Malecón Celeste).
  for (const [x, z, w, d] of [[312, 0, 12, 640], [0, 312, 640, 12], [-272, 0, 10, 640]]) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.03, z); group.add(r);
  }
  // Zebra crossings at the central intersections.
  const zebraMat = lambert(0xf2f2f2);
  for (const x of [-80, 0, 80]) for (const z of [-80, 0, 80]) {
    for (let i = -2; i <= 2; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 5), zebraMat);
      s.rotation.x = -Math.PI / 2; s.position.set(x + i * 2.6, 0.04, z - 9); group.add(s);
    }
  }

  // Buildings: instanced boxes, 3 height styles by district.
  const palette = [0xe8b48a, 0xd9e6f2, 0xf2d492, 0xc9a0c9, 0x9fc9a8, 0xe8e0d0, 0x8fb8d8, 0xf0a0a0];
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshLambertMaterial({ map: winTex });
  const buildings = new THREE.InstancedMesh(geo, mat, 160);
  buildings.castShadow = true; buildings.receiveShadow = true;
  const dummy = new THREE.Object3D(); const col = new THREE.Color();
  let bi = 0;
  const blocks = [];
  for (let gx = 0; gx < 7; gx++) for (let gz = 0; gz < 7; gz++) {
    const cx = -240 + gx * 80 + 40, cz = -240 + gz * 80 + 40;
    blocks.push([cx, cz]);
  }
  for (const [cx, cz] of blocks) {
    const n = randInt(rng, 1, 3);
    for (let k = 0; k < n; k++) {
      if (bi >= 160) break;
      const bx = cx + rand(rng, -22, 22), bz = cz + rand(rng, -22, 22);
      const tower = Math.abs(cx - 80) < 90 && Math.abs(cz + 80) < 90;
      const h = tower ? rand(rng, 45, 95) : rand(rng, 10, 30);
      const w = rand(rng, 14, 26), d = rand(rng, 14, 26);
      dummy.position.set(bx, h / 2, bz); dummy.scale.set(w, h, d); dummy.rotation.y = 0;
      dummy.updateMatrix(); buildings.setMatrixAt(bi, dummy.matrix);
      buildings.setColorAt(bi, col.setHex(pick(rng, palette)));
      colliders.push({ x: bx, z: bz, hw: w / 2 + 0.5, hd: d / 2 + 0.5 });
      bi++;
    }
  }
  buildings.count = bi; group.add(buildings);

  // Palms along the beach + shade trees in parks (instanced).
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
  const trunkMat = lambert(0x8a6a45);
  const palms = new THREE.InstancedMesh(trunkGeo, trunkMat, 220);
  const leafGeo = new THREE.ConeGeometry(2.6, 3.4, 6);
  const leafMat = lambert(0x2f9e44);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, 220);
  let ti = 0;
  const treeSpots = [];
  for (let z = -300; z <= 300; z += 14) treeSpots.push([-272 + rand(rng, -4, 4), z]);
  for (let i = 0; i < 90; i++) treeSpots.push([rand(rng, -280, 300), rand(rng, -280, 300)]);
  for (const [tx, tz] of treeSpots) {
    if (ti >= 220) break;
    if (ROAD_XS.some((x) => Math.abs(tx - x) < 11) && ROAD_ZS.some((z) => Math.abs(tz - z) < 11)) continue;
    dummy.position.set(tx, 3.5, tz); dummy.scale.set(1, 1, 1); dummy.rotation.y = rand(rng, 0, 6);
    dummy.updateMatrix(); palms.setMatrixAt(ti, dummy.matrix);
    dummy.position.set(tx, 8.2, tz); dummy.updateMatrix(); leaves.setMatrixAt(ti, dummy.matrix);
    ti++;
  }
  palms.count = ti; leaves.count = ti; group.add(palms); group.add(leaves);

  // Street lamps (instanced), lit at night via emissive material swap in render.
  const lampGeo = new THREE.CylinderGeometry(0.12, 0.12, 6, 5);
  const lamps = new THREE.InstancedMesh(lampGeo, lambert(0x44484e), 90);
  const lampHeads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x554400 }), 90);
  let li = 0;
  for (const x of ROAD_XS) for (const z of [-200, -40, 120, 280]) {
    if (li >= 90) break;
    dummy.position.set(x + 9, 3, z); dummy.scale.set(1, 1, 1); dummy.rotation.y = 0; dummy.updateMatrix();
    lamps.setMatrixAt(li, dummy.matrix);
    dummy.position.set(x + 9, 6.2, z); dummy.updateMatrix(); lampHeads.setMatrixAt(li, dummy.matrix);
    li++;
  }
  lamps.count = li; lampHeads.count = li; group.add(lamps); group.add(lampHeads);

  // Landmarks.
  const addBox = (w, h, d, color, x, y, z, tex) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), tex ? new THREE.MeshLambertMaterial({ map: tex }) : lambert(color));
    m.position.set(x, y, z); m.castShadow = true; group.add(m); return m;
  };
  // Pier (west) + ferris wheel at Marina Bay.
  for (let i = 0; i < 14; i++) addBox(6, 0.4, 6, 0x9a7a52, -330 - i * 6, 1.2, -40);
  const wheel = new THREE.Group(); wheel.position.set(-280, 26, -120); group.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(18, 0.8, 8, 32), lambert(0xff5fa2));
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.6, 36, 0.6), lambert(0xffffff));
    spoke.rotation.z = (i * Math.PI) / 8; wheel.add(spoke);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), lambert(pick(rng, [0xffd23f, 0x3fd2c0, 0xff5fa2])));
    cab.position.set(Math.cos((i * Math.PI) / 4) * 18, Math.sin((i * Math.PI) / 4) * 18, 0); wheel.add(cab);
  }
  // Lighthouse on the beach.
  const light = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, 26, 10), lambert(0xf2f2f2));
  light.position.set(-300, 13, 180); light.castShadow = true; group.add(light);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(2, 10, 8), new THREE.MeshLambertMaterial({ color: 0xfff2a8, emissive: 0xffd23f }));
  beacon.position.set(-300, 27, 180); group.add(beacon);
  // Docks: crane + containers.
  const crane = new THREE.Group(); crane.position.set(220, 0, 180); group.add(crane);
  const mast = new THREE.Mesh(new THREE.BoxGeometry(3, 40, 3), lambert(0xe8a13a)); mast.position.y = 20; crane.add(mast);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(34, 2, 2), lambert(0xe8a13a)); arm.position.set(10, 38, 0); crane.add(arm);
  for (let i = 0; i < 18; i++) addBox(8, 3, 3, pick(rng, [0xd84a3a, 0x3f7fd0, 0x3fae5a, 0xe8a13a]), 200 + (i % 6) * 10, 1.6 + Math.floor(i / 6) * 3.2, 220 + rand(rng, -6, 6));
  // Old Solara fountain + market stalls.
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(8, 9, 1.6, 16), lambert(0xcfd8e3));
  fountain.position.set(-120, 0.8, -120); group.add(fountain);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.4, 16), lambert(0x4aa8ff));
  water.position.set(-120, 1.6, -120); group.add(water);
  for (let i = 0; i < 8; i++) {
    addBox(5, 0.3, 4, pick(rng, [0xff5fa2, 0xffd23f, 0x3fd2c0]), -150 + i * 9, 2.6, -95);
    addBox(0.3, 2.6, 4, 0x6a4a2a, -152.5 + i * 9, 1.3, -95);
  }
  // Neon shop signs (emissive at night).
  const signs = [];
  const signDefs = [['CELESTE 98.1', '#ff5fa2', '#ffffff', -272, 10, 60], ['SPRAY & SHINE', '#3fd2c0', '#08222e', 80, 8, -88], ["CAL'S GUNS", '#ffd23f', '#222222', 160, 8, 0], ['MARLIN CEVICHE', '#4aa8ff', '#ffffff', -80, 8, -160], ['TACO SOL', '#ff8a3d', '#ffffff', 0, 8, 160]];
  for (const [text, bg, fg, x, y, z] of signDefs) {
    const s = addBox(14, 3.2, 0.6, 0x111111, x, y, z, signTexture(text, bg, fg));
    signs.push(s);
  }
  // Traffic lights at central intersections.
  for (const x of [-80, 0, 80]) for (const z of [-80, 0, 80]) {
    addBox(0.5, 5, 0.5, 0x222222, x + 9, 2.5, z + 9);
    addBox(1, 2.4, 1, 0x111111, x + 9, 5.6, z + 9);
  }
  // Benches along the promenade.
  for (let z = -260; z <= 260; z += 40) addBox(4, 0.5, 1.4, 0x7a5a34, -266, 0.6, z);

  return { group, colliders, signs, wheel, beacon, lampHeads, roads: { xs: ROAD_XS, zs: ROAD_ZS } };
}

// Keep a position out of building colliders (simple AABB push-out).
export function collideBuildings(colliders, pos, radius) {
  for (const c of colliders) {
    const dx = pos.x - c.x, dz = pos.z - c.z;
    if (Math.abs(dx) < c.hw + radius && Math.abs(dz) < c.hd + radius) {
      if (c.hw + radius - Math.abs(dx) < c.hd + radius - Math.abs(dz)) pos.x = c.x + Math.sign(dx || 1) * (c.hw + radius);
      else pos.z = c.z + Math.sign(dz || 1) * (c.hd + radius);
    }
  }
}
export function clampWorld(pos, half = 318) {
  pos.x = Math.max(-318, Math.min(half, pos.x));
  pos.z = Math.max(-318, Math.min(half, pos.z));
}
