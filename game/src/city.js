// Solara Bay city: seeded buildings, palms, neon, pier, docks, props.
import * as THREE from 'three';
import { CONFIG, districtAt } from './config.js';
import { mulberry32, range, pick, chance } from './random.js';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function textTex(text, fg, bg, font = 44) {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = fg; g.font = `bold ${font}px Verdana`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  });
}
function facadeTex(base, litRatio, r) {
  const map = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 4);
    for (let y = 18; y < h; y += 52) for (let x = 16; x < w; x += 42) {
      g.fillStyle = r() < litRatio ? (r() < 0.5 ? '#ffca7a' : '#ff9a5c') : '#3d4a61';
      g.fillRect(x, y, 26, 30);
    }
  });
  const emi = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let y = 18; y < h; y += 52) for (let x = 16; x < w; x += 42) {
      if (r() < litRatio) { g.fillStyle = '#ffca7a'; g.fillRect(x, y, 26, 30); }
    }
  });
  return { map, emi };
}

export function createCity(G) {
  const r = mulberry32(G.seed);
  const scene = G.scene;
  const boxes = []; // building AABBs {x,z,hw,hd}
  const group = new THREE.Group(); scene.add(group);
  const dummy = new THREE.Object3D();

  // Ground: roads, sidewalks, crosswalks, sand, plaza.
  const groundTex = canvasTex(1024, 1024, (g, S) => {
    const m = (v) => (v + 320) / 640 * S;
    g.fillStyle = '#3a3f46'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#c9a86a'; g.fillRect(0, 0, m(-288), S); // beach sand west
    g.fillStyle = '#43484f';
    for (const c of [-240, -120, 0, 120, 240]) { g.fillRect(m(c - 7), 0, m(14) - m(0), S); g.fillRect(0, m(c - 7), S, m(14) - m(0)); }
    g.fillStyle = '#6e737c'; // sidewalks
    for (const c of [-240, -120, 0, 120, 240]) { g.fillRect(m(c - 11), 0, 4, S); g.fillRect(m(c + 7), 0, 4, S); g.fillRect(0, m(c - 11), S, 4); g.fillRect(0, m(c + 7), S, 4); }
    g.fillStyle = '#e8e4d8'; // crosswalks + dashes
    for (const a of [-240, -120, 0, 120, 240]) for (const b of [-240, -120, 0, 120, 240]) {
      for (let i = -3; i <= 3; i++) { g.fillRect(m(a + i * 2 - 1), m(b - 10), 2, 5); g.fillRect(m(a + i * 2 - 1), m(b + 5), 2, 5); }
    }
    g.strokeStyle = '#d8c95a'; g.lineWidth = 2; g.setLineDash([14, 18]);
    for (const c of [-240, -120, 0, 120, 240]) {
      g.beginPath(); g.moveTo(m(c), 0); g.lineTo(m(c), S); g.stroke();
      g.beginPath(); g.moveTo(0, m(c)); g.lineTo(S, m(c)); g.stroke();
    }
    g.setLineDash([]);
    g.fillStyle = '#4a7a5a'; g.fillRect(m(-180), m(40), m(120) - m(0), m(120) - m(0)); // park
  });
  groundTex.anisotropy = G.renderer.capabilities.getMaxAnisotropy();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(640, 640), new THREE.MeshLambertMaterial({ map: groundTex }));
  ground.rotation.x = -Math.PI / 2; group.add(ground);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(220, 640), new THREE.MeshLambertMaterial({ color: 0x2a6f9e }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(-410, -0.4, 0); group.add(sea);
  const dockBasin = new THREE.Mesh(new THREE.PlaneGeometry(90, 120), new THREE.MeshLambertMaterial({ color: 0x2a6f9e }));
  dockBasin.rotation.x = -Math.PI / 2; dockBasin.position.set(285, -0.3, -220); group.add(dockBasin);

  // Buildings: 3 facade variants, instanced.
  const variants = [
    facadeTex('#7a6a8a', 0.28, mulberry32(G.seed + 11)),
    facadeTex('#8a7a5a', 0.22, mulberry32(G.seed + 22)),
    facadeTex('#5a7a8a', 0.32, mulberry32(G.seed + 33)),
  ];
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const meshes = variants.map((v) => {
    const mat = new THREE.MeshLambertMaterial({ map: v.map, emissiveMap: v.emi, emissive: 0xffffff, emissiveIntensity: 0 });
    const im = new THREE.InstancedMesh(geo, mat, 160); im.count = 0; im.instanceMatrix.setUsage(THREE.StaticDrawUsage); group.add(im); return im;
  });
  const counts = [0, 0, 0];
  const spots = [];
  for (const bx of [-180, -60, 60, 180]) for (const bz of [-180, -60, 60, 180]) {
    for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) {
      const x = bx + ix * 34 + range(r, -6, 6), z = bz + iz * 34 + range(r, -6, 6);
      if (x < -250 || x > 250 || z < -250 || z > 250) continue;
      if (x > -290 && x < -235) continue; // beach strip stays open
      if (chance(r, 0.22)) continue; // plaza / park gaps
      const tall = districtAt(x, z) === 'The Spires';
      const w = range(r, 16, 26), d = range(r, 16, 26), h = tall ? range(r, 26, 62) : range(r, 7, 18);
      const vi = Math.floor(r() * 3);
      dummy.position.set(x, h / 2, z); dummy.scale.set(w, h, d); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
      meshes[vi].setMatrixAt(counts[vi]++, dummy.matrix);
      boxes.push({ x, z, hw: w / 2 + 1, hd: d / 2 + 1 });
      spots.push({ x, z, w, h, d });
    }
  }
  meshes.forEach((m, i) => { m.count = counts[i]; m.instanceMatrix.needsUpdate = true; });
  const neonMats = meshes.map((m) => m.material);

  // Rooftop props: AC units, water towers, antennas (instanced).
  const roofGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a8 });
  const roofs = new THREE.InstancedMesh(roofGeo, roofMat, 120); let rc = 0;
  for (const s of spots) {
    if (rc >= 120) break;
    if (chance(r, 0.6)) continue;
    dummy.position.set(s.x + range(r, -4, 4), s.h + 1, s.z + range(r, -4, 4));
    dummy.scale.set(3, 2, 3); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    roofs.setMatrixAt(rc++, dummy.matrix);
  }
  roofs.count = rc; group.add(roofs);

  // Palms: trunk + drooping fronds + coconuts, instanced.
  const palmSpots = [];
  for (let z = -280; z <= 280; z += 36) { palmSpots.push([-256 + range(r, -4, 4), z]); palmSpots.push([-238 + range(r, -4, 4), z]); }
  for (let x = -230; x <= 230; x += 36) { palmSpots.push([x, -9]); palmSpots.push([x, 9]); }
  for (let z = -230; z <= 230; z += 36) { palmSpots.push([-9, z]); palmSpots.push([9, z]); }
  for (let i = 0; i < 12; i++) palmSpots.push([range(r, -170, 170), range(r, 50, 190)]);
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 7, 5); trunkGeo.translate(0, 3.5, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const frondGeo = new THREE.PlaneGeometry(0.8, 2.8, 1, 4);
  { const p = frondGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, -Math.pow((y + 1.4) / 2.8, 2) * 1.1); } frondGeo.computeVertexNormals(); }
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f9e4f, side: THREE.DoubleSide });
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palmSpots.length * 6);
  const cocoGeo = new THREE.SphereGeometry(0.2, 6, 5);
  const cocoMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const cocos = new THREE.InstancedMesh(cocoGeo, cocoMat, palmSpots.length * 3);
  let fi = 0, ci = 0;
  palmSpots.forEach(([x, z], i) => {
    const s = range(r, 0.9, 1.25), yaw = range(r, 0, Math.PI * 2);
    dummy.position.set(x, 0, z); dummy.rotation.set(0, yaw, range(r, -0.08, 0.08)); dummy.scale.set(s, s, s); dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    for (let k = 0; k < 6; k++) {
      const a = yaw + (k / 6) * Math.PI * 2 + range(r, -0.2, 0.2);
      dummy.position.set(x + Math.cos(a) * 0.4 * s, 7 * s, z - Math.sin(a) * 0.4 * s);
      dummy.rotation.set(0, -a + Math.PI / 2, 0); dummy.rotateX(-0.9 - range(r, 0, 0.35));
      dummy.scale.set(s, s, s); dummy.updateMatrix(); fronds.setMatrixAt(fi++, dummy.matrix);
    }
    for (let k = 0; k < 3; k++) {
      dummy.position.set(x + range(r, -0.3, 0.3), 6.6 * s, z + range(r, -0.3, 0.3));
      dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); cocos.setMatrixAt(ci++, dummy.matrix);
    }
  });
  trunks.count = palmSpots.length; fronds.count = fi; cocos.count = ci;
  group.add(trunks, fronds, cocos);

  // Street props: hydrants, benches, bins, planters.
  const propGeo = new THREE.BoxGeometry(1, 1, 1);
  const propMat = new THREE.MeshLambertMaterial({ color: 0xb03a2a });
  const props = new THREE.InstancedMesh(propGeo, propMat, 90); let pc = 0;
  for (let i = 0; i < 90 && pc < 90; i++) {
    const x = range(r, -240, 240), z = pick(r, [-129, -111, -9, 9, 111, 129]) + range(r, -40, 40);
    dummy.position.set(x, 0.5, z); dummy.scale.set(0.7, 1, 0.7); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    props.setMatrixAt(pc++, dummy.matrix);
  }
  props.count = pc; group.add(props);

  // Signs: neon billboards + storefronts, with glow halos.
  const haloTex = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const halos = [];
  function neonSign(text, fg, bg, x, y, z, ry, w = 26, h = 13) {
    const tex = textTex(text, fg, bg, text.length > 9 ? 30 : 44);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
    mesh.position.set(x, y, z); mesh.rotation.y = ry; group.add(mesh);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: fg, transparent: true, opacity: 0.35, depthWrite: false }));
    halo.scale.set(w * 1.7, h * 1.7, 1); halo.position.set(x, y, z); group.add(halo); halos.push(halo);
    return mesh;
  }
  neonSign('FLAMINGO FM', '#ff5fa2', '#2a0a2a', -196, 15, 60, Math.PI / 2);
  neonSign('VICE HOTEL', '#5ad8ff', '#0a2a3a', 40, 24, -238, 0);
  neonSign('TACOS 24H', '#ffd24a', '#3a2a0a', 62, 11, 138, Math.PI);
  neonSign('HOTEL', '#5ad8ff', '#0a1a2a', -118, 12, -180, Math.PI / 2, 18, 9);
  neonSign('PIZZA', '#ff8a5c', '#2a0a0a', 118, 10, 60, -Math.PI / 2, 16, 8);
  const shopNames = [['TACOS', '#ffd24a', '#3a2a0a'], ['DONUTS', '#ff9ad8', '#2a0a1a'], ['BAR', '#5dff8f', '#0a2a0a'], ['HOTEL', '#5ad8ff', '#0a1a2a'], ['PIZZA', '#ff8a5c', '#2a0a0a'], ['24H MART', '#ffffff', '#1a2a4a']];
  for (let i = 0; i < 22; i++) {
    const s = pick(r, spots); if (!s || s.h > 20) continue;
    const [t, fg, bg] = pick(r, shopNames);
    const tex = textTex(t, fg, bg, 40);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({ map: tex }));
    m.position.set(s.x, 2.6, s.z + s.d / 2 + 0.15); group.add(m);
  }

  // Traffic lights at 4 intersections.
  const lights = [];
  for (const [lx, lz] of [[0, 0], [120, -120], [-120, 120], [120, 120]]) {
    const g2 = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 6), new THREE.MeshLambertMaterial({ color: 0x444444 }));
    pole.position.y = 3; g2.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(4, 0.25, 0.25), pole.material); arm.position.set(2, 5.6, 0); g2.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2, 0.7), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    head.position.set(3.8, 4.8, 0); g2.add(head);
    const dots = [];
    [['#ff3b30', 5.5], ['#ffb13d', 4.8], ['#5dff8f', 4.1]].forEach(([c, y]) => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: c }));
      d.position.set(3.8, y, 0.4); g2.add(d); dots.push(d);
    });
    g2.position.set(lx + 8, 0, lz + 8); group.add(g2);
    lights.push({ x: lx, z: lz, dots, off: lights.length * 2.2 });
  }

  // Ferris wheel, pier, lighthouse, docks, stalls, bonfire.
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(14, 0.5, 6, 24), new THREE.MeshLambertMaterial({ color: 0xff5fa2 }));
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), new THREE.MeshLambertMaterial({ color: pick(r, [0xffd24a, 0x5ad8ff, 0x5dff8f, 0xff8a5c]) }));
    const a = (i / 8) * Math.PI * 2; cab.position.set(Math.cos(a) * 14, Math.sin(a) * 14, 0); wheel.add(cab);
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(27, 0.3, 0.3), new THREE.MeshLambertMaterial({ color: 0xcccccc }));
    spoke.rotation.z = a; wheel.add(spoke);
  }
  wheel.position.set(CONFIG.ferris.x, 16, CONFIG.ferris.z); group.add(wheel);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  [[-6, -8], [6, -8]].forEach(([dx]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 18, 6), legMat);
    leg.position.set(CONFIG.ferris.x + dx, 8, CONFIG.ferris.z); leg.rotation.z = dx > 0 ? -0.35 : 0.35; group.add(leg);
  });
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  for (let i = 0; i < 18; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 7), pierMat);
    p.position.set(-282 - i * 2.2, 1.2, CONFIG.pier.z); group.add(p);
  }
  const lh = new THREE.Group();
  const lhBase = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 22, 10), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  lhBase.position.y = 11; lh.add(lhBase);
  const lhBand = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 5, 10), new THREE.MeshLambertMaterial({ color: 0xd23a3a }));
  lhBand.position.y = 15; lh.add(lhBand);
  const lhTop = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2a0 }));
  lhTop.position.y = 23; lh.add(lhTop);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(3.5, 26, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  beam.rotation.z = Math.PI / 2; beam.position.set(14, 23, 0); lh.add(beam);
  lh.position.set(CONFIG.lighthouse.x, 0, CONFIG.lighthouse.z); group.add(lh);
  const contCols = [0xd23a3a, 0x3a7ad2, 0x3ad26a, 0xd2a03a];
  for (let i = 0; i < 26; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 3.4), new THREE.MeshLambertMaterial({ color: pick(r, contCols) }));
    c.position.set(range(r, 200, 300), 1.5 + Math.floor(i / 9) * 3.1, range(r, -280, 20));
    c.rotation.y = chance(r, 0.5) ? 0 : Math.PI / 2; group.add(c);
    boxes.push({ x: c.position.x, z: c.position.z, hw: 6.5, hd: 6.5 });
  }
  const ship = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(46, 8, 16), new THREE.MeshLambertMaterial({ color: 0x2a3a4a }));
  hull.position.y = 3; ship.add(hull);
  const cab2 = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 12), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
  cab2.position.set(-12, 11, 0); ship.add(cab2);
  ship.position.set(285, 0, -220); group.add(ship);
  for (let i = 0; i < 4; i++) { // market stalls on the beach
    const st = new THREE.Group();
    const top = new THREE.Mesh(new THREE.PlaneGeometry(6, 5), new THREE.MeshLambertMaterial({ color: pick(r, [0xff5fa2, 0xffd24a, 0x5ad8ff, 0x5dff8f]), side: THREE.DoubleSide }));
    top.rotation.x = -0.5; top.position.y = 3; st.add(top);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(5, 1.4, 2), new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
    counter.position.y = 0.7; st.add(counter);
    st.position.set(-252 + i * 2, 0, 205 + i * 14); group.add(st);
  }
  const fire = new THREE.Group();
  const flame = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.4, 8), new THREE.MeshBasicMaterial({ color: 0xff8a2a }));
  flame.position.y = 1.4; fire.add(flame);
  const fireLight = new THREE.PointLight(0xff8a2a, 12, 22); fireLight.position.y = 2; fire.add(fireLight);
  fire.position.set(-250, 0, 240); group.add(fire);
  const dancers = [];
  for (let i = 0; i < 4; i++) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.9, 0.5), new THREE.MeshLambertMaterial({ color: pick(r, [0xff5fa2, 0x5ad8ff, 0xffd24a, 0x5dff8f]) }));
    const a = (i / 4) * Math.PI * 2;
    d.position.set(-250 + Math.cos(a) * 4, 1, 240 + Math.sin(a) * 4); group.add(d); dancers.push(d);
  }

  // Sun coins.
  const coinGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 12);
  const coinMat = new THREE.MeshBasicMaterial({ color: 0xffd24a });
  const coins = [];
  for (let i = 0; i < CONFIG.sunCoins; i++) {
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.position.set(range(r, -240, 240), 1.1, range(r, -240, 240));
    m.rotation.x = Math.PI / 2; group.add(m); coins.push(m);
  }

  function collide(x, z, rad) {
    for (const b of boxes) {
      const dx = x - b.x, dz = z - b.z;
      if (Math.abs(dx) < b.hw + rad && Math.abs(dz) < b.hd + rad) {
        const px = b.hw + rad - Math.abs(dx), pz = b.hd + rad - Math.abs(dz);
        if (px < pz) x = b.x + Math.sign(dx || 1) * (b.hw + rad);
        else z = b.z + Math.sign(dz || 1) * (b.hd + rad);
      }
    }
    x = Math.max(-315, Math.min(315, x)); z = Math.max(-315, Math.min(315, z));
    return { x, z };
  }
  function lightState(x, z) {
    for (const L of lights) if (Math.abs(x - L.x) < 24 && Math.abs(z - L.z) < 24) return L.state;
    return 'green';
  }
  return {
    group, boxes, coins, halos, neonMats, collide, lightState, districtAt,
    update(dt, t, nightF) {
      for (const L of lights) {
        const cyc = (t + L.off) % 9;
        L.state = cyc < 4 ? 'green' : cyc < 5 ? 'amber' : 'red';
        L.dots[0].material.color.set(L.state === 'red' ? 0xff3b30 : 0x441111);
        L.dots[1].material.color.set(L.state === 'amber' ? 0xffb13d : 0x443311);
        L.dots[2].material.color.set(L.state === 'green' ? 0x5dff8f : 0x113311);
      }
      wheel.rotation.z += dt * 0.12;
      beam.rotation.y += dt * 0.9;
      flame.scale.y = 1 + Math.sin(t * 9) * 0.15;
      fireLight.intensity = 10 + Math.sin(t * 11) * 3;
      dancers.forEach((d, i) => { d.position.y = 1 + Math.abs(Math.sin(t * 3 + i)) * 0.5; d.rotation.y = t * 2 + i; });
      for (const c of coins) { c.rotation.z += dt * 2; }
      for (const m of neonMats) m.emissiveIntensity = 0.15 + nightF * 0.85;
      for (const h of halos) h.material.opacity = 0.12 + nightF * 0.5;
    },
  };
}
