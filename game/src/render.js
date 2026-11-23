// three.js renderer: sky dome, sun/moon, clouds, stars, fog, lights and
// the third-person chase camera (yaw = heading, camera behind the car).
import * as THREE from 'three';
import { clamp, lerp } from './random.js';

// Sky keys: [hour, top colour, horizon colour, sun colour, fog colour, hemi]
const SKY = [
  [0, 0x0a1030, 0x1a2340, 0x8899bb, 0x0d1428, 0.35],
  [6, 0x3a5a8a, 0xf2a65a, 0xffd9a0, 0x8a7a9a, 0.7],
  [9, 0x6fb0e8, 0xcfe8f5, 0xfff2cc, 0xbdd8ea, 1.1],
  [12, 0x4f9fe0, 0xbfe6f7, 0xffffff, 0xc4dcee, 1.6],
  [16, 0x5a9ed8, 0xf2d8a0, 0xffe9b0, 0xd8c8a8, 1.5],
  [17.5, 0x7a5fb0, 0xff9e5e, 0xffb36b, 0xe8a06a, 1.3],
  [18.3, 0xb05a8a, 0xff7e4a, 0xff8f3d, 0xe87a5a, 1.1],
  [19.3, 0x6a3a70, 0xff6a8a, 0xff6a5e, 0xc85a6a, 0.8],
  [20, 0x141a38, 0x2a2a55, 0x8899bb, 0x1a1e38, 0.35],
  [24, 0x0a1030, 0x1a2340, 0x8899bb, 0x0d1428, 0.35],
];
function skyAt(h) {
  let a = SKY[0], b = SKY[SKY.length - 1];
  for (let i = 0; i < SKY.length - 1; i++) {
    if (h >= SKY[i][0] && h <= SKY[i + 1][0]) { a = SKY[i]; b = SKY[i + 1]; break; }
  }
  const t = clamp((h - a[0]) / Math.max(0.001, b[0] - a[0]), 0, 1);
  const mix = (ca, cb) => {
    const A = new THREE.Color(ca), B = new THREE.Color(cb);
    return A.lerp(B, t);
  };
  return { top: mix(a[1], b[1]), hor: mix(a[2], b[2]), sun: mix(a[3], b[3]),
    fog: mix(a[4], b[4]), hemi: lerp(a[5], b[5], t) };
}

export function createRenderer(G) {
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.mapSize?.set?.(1024, 1024);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffb36b, 220, 1100);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x8a6a4a, 1.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2cc, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
  sun.shadow.camera.far = 500;
  scene.add(sun); scene.add(sun.target);
  const amb = new THREE.AmbientLight(0x404050, 0.25);
  scene.add(amb);
  // Sky dome: big sphere, vertex colours repainted per time of day.
  const skyGeo = new THREE.SphereGeometry(900, 24, 12);
  const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true });
  const pos = skyGeo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  skyGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  // Sun disc + glow sprite.
  const glowTex = makeGlowTexture();
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffc36b, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  sunSprite.scale.set(180, 180, 1);
  scene.add(sunSprite);
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(26, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff2cc, fog: false }));
  scene.add(sunDisc);
  // Moon.
  const moon = new THREE.Mesh(new THREE.CircleGeometry(14, 24),
    new THREE.MeshBasicMaterial({ color: 0xe8ecff, fog: false, transparent: true, opacity: 0 }));
  scene.add(moon);
  // Clouds: 14 soft sprites + lumpy mesh balls.
  const clouds = [];
  const rng = G.rng;
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex,
      color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }));
    const sc = 90 + rng() * 160;
    s.scale.set(sc, sc * 0.42, 1);
    s.position.set((rng() - 0.5) * 1400, 110 + rng() * 60, (rng() - 0.5) * 1400);
    s.userData.drift = 0.4 + rng() * 0.8;
    scene.add(s); clouds.push(s);
  }
  // Night stars: 240 points.
  const starGeo = new THREE.BufferGeometry();
  const sp = new Float32Array(240 * 3);
  for (let i = 0; i < 240; i++) {
    const a = rng() * Math.PI * 2, e = 0.25 + rng() * 1.2, r = 850;
    sp[i * 3] = Math.cos(a) * Math.cos(e) * r;
    sp[i * 3 + 1] = Math.sin(e) * r;
    sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0 }));
  scene.add(stars);
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  G.fx = { renderer, scene, camera, hemi, sun, amb, sky, skyGeo, sunSprite,
    sunDisc, moon, clouds, stars, glowTex };
  return G.fx;
}
export function makeGlowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); return t;
}
export function updateSky(G, dt) {
  const fx = G.fx; if (!fx) return;
  const h = G.timeOfDay, s = skyAt(h);
  const night = h >= 20 || h < 5.5 ? 1 : h >= 19.3 ? (h - 19.3) / 0.7 : h < 6 ? 1 - (h - 5.5) / 0.5 : 0;
  const nf = clamp(night, 0, 1);
  fx.hemi.intensity = s.hemi;
  fx.scene.fog.color.copy(s.fog);
  fx.amb.intensity = 0.25 + nf * 0.15;
  // Repaint sky dome gradient.
  const pos = fx.skyGeo.attributes.position, cols = fx.skyGeo.attributes.color;
  const cTop = s.top, cHor = s.hor;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 900;
    const t = clamp((y + 0.12) / 0.7, 0, 1);
    cols.setXYZ(i, lerp(cHor.r, cTop.r, t), lerp(cHor.g, cTop.g, t), lerp(cHor.b, cTop.b, t));
  }
  cols.needsUpdate = true;
  // Sun position: rises east, sets west.
  const ang = ((h - 6) / 12) * Math.PI;
  const sx = Math.cos(ang) * 780, sy = Math.sin(ang) * 520 + 40, sz = -260;
  const sunUp = h > 5.5 && h < 20;
  fx.sun.position.set(sx, Math.max(30, sy), sz);
  fx.sun.target.position.set(G.player.x, 0, G.player.z);
  fx.sun.color.copy(s.sun);
  const sunset = clamp(1 - Math.abs(h - 18.3) / 1.6, 0, 1);
  fx.sun.intensity = sunUp ? 1.6 + sunset * 0.9 : 0.12;
  fx.sunSprite.position.set(sx * 1.05, Math.max(20, sy * 1.05), sz * 1.05);
  fx.sunSprite.material.opacity = sunUp ? 0.22 + sunset * 0.68 : 0;
  fx.sunSprite.material.color.copy(s.sun);
  fx.sunDisc.position.set(sx, Math.max(20, sy), sz);
  fx.sunDisc.lookAt(G.fx.camera.position);
  fx.sunDisc.material.opacity = sunUp ? 1 : 0;
  fx.sunDisc.material.transparent = true;
  fx.moon.position.set(-sx, 320, -sz);
  fx.moon.lookAt(G.fx.camera.position);
  fx.moon.material.opacity = nf * 0.9;
  fx.stars.material.opacity = nf * 0.9;
  fx.stars.position.set(G.player.x, 0, G.player.z);
  fx.sky.position.set(G.player.x, 0, G.player.z);
  for (const c of fx.clouds) {
    c.position.x += c.userData.drift * dt;
    if (c.position.x > 800) c.position.x = -800;
    c.material.opacity = 0.5 - nf * 0.34;
  }
  // Neon halos follow the night factor (city.neonHalos filled by city.js).
  if (G.city && G.city.neonHalos) {
    for (const halo of G.city.neonHalos) halo.material.opacity = 0.12 + nf * 0.5;
  }
  if (G.city && G.city.lamps) {
    for (const l of G.city.lamps) l.material.opacity = nf * 0.9;
  }
}
// Third-person chase camera. yaw = heading: the camera sits BEHIND the
// car/player, looking the way they face. snap=1 jumps straight there.
export function updateCamera(G, snap) {
  const fx = G.fx; if (!fx) return;
  const p = G.player;
  const car = p.car;
  const heading = car && typeof car.heading === 'number' ? car.heading : p.heading;
  const yaw = heading;
  const dist = G.camDist || 9;
  const px = car ? car.x : p.x, pz = car ? car.z : p.z;
  const cx = px - Math.sin(yaw) * dist;
  const cz = pz - Math.cos(yaw) * dist;
  const cy = (car ? 3.2 : 2.6) + (G.camHeight || 0);
  const k = snap ? 1 : 0.12;
  fx.camera.position.x += (cx - fx.camera.position.x) * k;
  fx.camera.position.y += (cy - fx.camera.position.y) * k;
  fx.camera.position.z += (cz - fx.camera.position.z) * k;
  fx.camera.lookAt(px + Math.sin(yaw) * 6, 1.6, pz + Math.cos(yaw) * 6);
  // Sun shadow follows the player.
  fx.sun.target.position.set(px, 0, pz);
}
