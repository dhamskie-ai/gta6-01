// Renderer three.js: langit gradasi, matahari/bulan/bintang, awan berlapis, kabut, bayangan.
import * as THREE from 'three';
import { G } from './config.js';
import { clamp, lerp } from './random.js';
// Kunci waktu: [jam, skyTop, skyBottom, fog, sunColor, sunI, hemi]
const KEYS = [
  [0, 0x0b1026, 0x1c2440, 0x141a2e, 0x8a9ac0, 0.12, 0.35],
  [6, 0x7a6a9a, 0xffb36b, 0xc98a6a, 0xffb36b, 0.7, 0.6],
  [9, 0x3f8fd2, 0xbfe3f2, 0xa8c8d8, 0xfff2d8, 1.15, 1.05],
  [12, 0x2f7fd0, 0x9fd8ef, 0x9fc8dc, 0xffffff, 1.3, 1.15],
  [16, 0x4a90d9, 0xf2d8a0, 0xd8b88a, 0xffe0a0, 1.2, 1.1],
  [17.5, 0x7a4a9a, 0xff9a3d, 0xe88a5a, 0xff8f3d, 1.35, 0.9],
  [18.4, 0x5a2a6e, 0xff6b35, 0xc05a6a, 0xff6b2e, 1.1, 0.75],
  [19.2, 0x3a1a5e, 0xd94f70, 0x8a3a5e, 0xff7a5a, 0.6, 0.55],
  [20, 0x141a3a, 0x2a2a55, 0x1c2038, 0x8a9ac0, 0.2, 0.4],
  [24, 0x0b1026, 0x1c2440, 0x141a2e, 0x8a9ac0, 0.12, 0.35],
];
function skyAt(t) {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i], b = KEYS[i + 1];
    if (t >= a[0] && t <= b[0]) {
      const k = (t - a[0]) / (b[0] - a[0] || 1);
      return { top: new THREE.Color(a[1]).lerp(new THREE.Color(b[1]), k), bot: new THREE.Color(a[2]).lerp(new THREE.Color(b[2]), k), fog: new THREE.Color(a[3]).lerp(new THREE.Color(b[3]), k), sun: new THREE.Color(a[4]).lerp(new THREE.Color(b[4]), k), sunI: lerp(a[5], b[5], k), hemi: lerp(a[6], b[6], k) };
    }
  }
  return { top: new THREE.Color(0x2f7fd0), bot: new THREE.Color(0x9fd8ef), fog: new THREE.Color(0x9fc8dc), sun: new THREE.Color(0xffffff), sunI: 1.2, hemi: 1.1 };
}
function radialTex(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function skyTex(top, bot) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#' + top.getHexString()); g.addColorStop(0.55, '#' + bot.getHexString()); g.addColorStop(1, '#' + bot.getHexString());
  x.fillStyle = g; x.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function buildRender() {
  const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  if (new URLSearchParams(location.search).get('noshadow')) renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  G.renderer = renderer;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x9fc8dc, 120, 520);
  G.scene = scene;
  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 1200);
  camera.position.set(0, 4, 46);
  G.camera = camera;
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  // Langit: kubah gradasi + matahari cakram + bulan + bintang + awan berlapis.
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex(new THREE.Color(0x2f7fd0), new THREE.Color(0x9fd8ef)), side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), skyMat);
  scene.add(sky);
  G.skyMat = skyMat;
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('rgba(255,240,190,1)', 'rgba(255,140,40,0)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  sunSprite.scale.setScalar(180); scene.add(sunSprite); G.sunSprite = sunSprite;
  const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('rgba(255,255,230,1)', 'rgba(255,200,80,0)'), transparent: true, depthWrite: false, fog: false }));
  sunDisc.scale.setScalar(46); scene.add(sunDisc); G.sunDisc = sunDisc;
  const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('rgba(235,240,255,1)', 'rgba(180,190,230,0)'), transparent: true, depthWrite: false, fog: false }));
  moonSprite.scale.setScalar(34); scene.add(moonSprite); G.moonSprite = moonSprite;
  // Bintang: 500 titik, lebih jelas saat malam.
  const starGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * 0.45 + 0.08;
    pos[i * 3] = Math.cos(a) * Math.cos(e) * 850; pos[i * 3 + 1] = Math.sin(e) * 850; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 850;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
  scene.add(stars); G.stars = stars;
  // Awan: 12 sprite lembut, 3 lapis ketinggian, melayang pelan.
  const cloudTex = radialTex('rgba(255,255,255,0.85)', 'rgba(255,255,255,0)');
  G.clouds = [];
  for (let i = 0; i < 12; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
    const sc = 60 + Math.random() * 90;
    s.scale.set(sc, sc * 0.32, 1);
    s.position.set(Math.random() * 800 - 400, 110 + (i % 3) * 30, Math.random() * 800 - 400);
    s.userData = { sp: 1 + Math.random() * 2 };
    scene.add(s); G.clouds.push(s);
  }
  // Cahaya: matahari directional + bayangan + hemi.
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(120, 180, 60); sun.castShadow = true;
  sun.shadow.mapSize.set(512, 512);
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 600;
  scene.add(sun); scene.add(sun.target); G.sun = sun;
  const hemi = new THREE.HemisphereLight(0xbdd8ff, 0x5a4a3a, 1.1);
  scene.add(hemi); G.hemi = hemi;
  // Satu sorot lampu depan bersama untuk mobil pemain (malam hari).
  const headlight = new THREE.SpotLight(0xffe9a0, 0, 30, 0.55, 0.5, 1.2);
  scene.add(headlight); scene.add(headlight.target); G.headlight = headlight;
  return { renderer, scene, camera };
}
export function updateSky(dt) {
  const t = G.timeOfDay;
  const k = skyAt(t);
  // Gradasi langit: buat ulang tekstur hanya saat bucket waktu berubah (hemat GPU).
  const bucket = Math.floor(t * 4);
  if (bucket !== updateSky._bucket) {
    updateSky._bucket = bucket;
    if (G.skyMat.map) G.skyMat.map.dispose();
    G.skyMat.map = skyTex(k.top, k.bot);
  }
  const night = t < 5.5 || t > 19.6 ? 1 : t > 18.6 ? (t - 18.6) : t < 6.5 ? (6.5 - t) : 0;
  G.nightF = clamp(night, 0, 1);
  const sunset = t > 16.5 && t < 19.5 ? Math.sin((t - 16.5) / 3 * Math.PI) : 0;
  G.sunsetF = sunset;
  G.scene.fog.color.copy(k.fog);
  G.sun.color.copy(k.sun); G.sun.intensity = k.sunI;
  G.hemi.intensity = k.hemi;
  // Matahari terbenam di barat (x negatif), bulan berlawanan.
  const ang = ((t - 6) / 12) * Math.PI;
  const sx = -Math.cos(ang) * 700, sy = Math.sin(ang) * 500 + 40, sz = -180;
  G.sunSprite.position.set(sx, sy, sz);
  G.sunDisc.position.set(sx, sy, sz);
  G.sunSprite.material.opacity = t > 5 && t < 20 ? 0.22 + sunset * 0.68 : 0;
  G.sunDisc.material.opacity = t > 5 && t < 20 ? 0.9 : 0;
  G.sunSprite.scale.setScalar(180 + sunset * 90);
  G.sun.position.set(sx * 0.4, Math.max(30, sy * 0.4), sz * 0.4);
  G.moonSprite.position.set(-sx, 320, -sz);
  G.moonSprite.material.opacity = G.nightF;
  G.stars.material.opacity = G.nightF * 0.95;
  // Awan: warna senja saat golden hour, melayang.
  for (const c of G.clouds) {
    c.position.x += c.userData.sp * dt;
    if (c.position.x > 450) c.position.x = -450;
    c.material.opacity = 0.16 + (1 - G.nightF) * 0.4;
    c.material.color.setHex(sunset > 0.4 ? 0xffb38a : 0xffffff);
  }
  // Siklus hari.
  if (G.state === 'playing' && !G.paused) {
    G.timeOfDay += dt * 0.02; // 1 menit game ~ 0.8 detik nyata? (pelan: 50 menit/hari-jam)
    if (G.timeOfDay >= 24) { G.timeOfDay -= 24; G.day++; }
  }
}
