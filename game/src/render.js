// three.js renderer, golden-hour sky, sun, fog, clouds, stars, particles.
import * as THREE from 'three';
import { G, clamp, lerp } from './config.js';

const SKY = [
  // t, top, horizon, sun, fog, hemi, nightF
  [5.0, 0x0a1230, 0x2a2a55, 0x8899bb, 0x1a2038, 0.3, 1],
  [12.0, 0x3f8fd2, 0x9fd4e8, 0xfff2cc, 0xa8c8d8, 1.15, 0],
  [16.0, 0x5a9bd4, 0xbfe0ea, 0xffe9a8, 0xb8d4de, 1.15, 0],
  [17.5, 0x6a7fd0, 0xffc46b, 0xffc46b, 0xe8a86b, 1.15, 0],
  [18.5, 0x7a4a8a, 0xff8f3d, 0xff8f3d, 0xd87858, 1.0, 0.15],
  [19.33, 0x3a2350, 0xe85a7a, 0xff6a8a, 0x8a4a6a, 0.6, 0.6],
  [20.0, 0x0a1230, 0x2a2a55, 0x8899bb, 0x1a2038, 0.35, 1],
  [24.0, 0x0a1230, 0x2a2a55, 0x8899bb, 0x1a2038, 0.35, 1],
];
function skyAt(t) {
  let a = SKY[0], b = SKY[SKY.length - 1];
  for (let i = 0; i < SKY.length - 1; i++) {
    if (t >= SKY[i][0] && t <= SKY[i + 1][0]) { a = SKY[i]; b = SKY[i + 1]; break; }
  }
  const k = b[0] === a[0] ? 0 : clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
  const c = (i) => new THREE.Color(a[i]).lerp(new THREE.Color(b[i]), k);
  return { top: c(1), hor: c(2), sun: c(3), fog: c(4), hemi: lerp(a[5], b[5], k), nightF: lerp(a[6], b[6], k) };
}
function radialTex(inner, outer) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv); return t;
}
export function initRender(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffb36b, 220, 1100);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(-240, 8, 95);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a2f28, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2cc, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 600;
  scene.add(sun); scene.add(sun.target);
  // Sky dome: gradient shader driven by uniforms.
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x5a9bd4) }, bot: { value: new THREE.Color(0xbfe0ea) } },
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h=clamp(normalize(vP).y*1.4+0.25,0.0,1.0); gl_FragColor=vec4(mix(bot,top,h),1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), skyMat);
  scene.add(sky);
  const glowTex = radialTex('rgba(255,190,90,0.9)', 'rgba(255,120,40,0)');
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sunGlow.scale.set(320, 320, 1);
  scene.add(sunGlow);
  // Clouds: 9 soft sprites drifting slowly.
  const cloudTex = radialTex('rgba(255,255,255,0.85)', 'rgba(255,255,255,0)');
  const clouds = [];
  const rng = Math.random;
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.5, depthWrite: false, fog: false }));
    s.position.set(rng() * 1200 - 600, 110 + rng() * 60, rng() * 1200 - 600);
    s.scale.set(180 + rng() * 160, 50 + rng() * 40, 1);
    s.userData.v = 1.5 + rng() * 2;
    scene.add(s); clouds.push(s);
  }
  // Night stars + moon.
  const starGeo = new THREE.BufferGeometry();
  const sp = [];
  for (let i = 0; i < 400; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9 + 0.1, r = 850;
    sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
  scene.add(stars);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('rgba(240,240,255,1)', 'rgba(200,200,255,0)'), transparent: true, opacity: 0, depthWrite: false, fog: false }));
  moon.scale.set(60, 60, 1); moon.position.set(400, 420, -600);
  scene.add(moon);
  G.renderer = renderer; G.scene = scene; G.camera = camera;
  G.sun = sun; G.hemi = hemi; G.skyMat = skyMat; G.sunGlow = sunGlow;
  G.stars = stars; G.moon = moon; G.clouds = clouds;
  addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  return { renderer, scene, camera };
}
export function updateSky(dt) {
  const t = G.timeOfDay;
  const s = skyAt(t);
  G.nightF = s.nightF;
  G.skyMat.uniforms.top.value.copy(s.top);
  G.skyMat.uniforms.bot.value.copy(s.hor);
  G.scene.fog.color.copy(s.fog);
  G.hemi.intensity = s.hemi;
  // Sun position: rises east, sets west; golden hour low in the west.
  const ang = ((t - 6) / 12) * Math.PI;
  const el = Math.sin(ang), az = Math.cos(ang);
  const p = G.player ? { x: G.player.x, z: G.player.z } : { x: 0, z: 0 };
  const sunDir = new THREE.Vector3(az * 0.9, Math.max(0.06, el), 0.45).normalize();
  G.sun.position.set(p.x + sunDir.x * 260, 40 + sunDir.y * 220, p.z + sunDir.z * 260);
  G.sun.target.position.set(p.x, 0, p.z);
  G.sun.color.copy(s.sun);
  G.sun.intensity = 1.2 + (1 - s.nightF) * 1.4;
  const sunset = clamp(1 - Math.abs(t - 18.33) / 1.6, 0, 1);
  G.sunGlow.position.set(p.x + sunDir.x * 780, 30 + sunDir.y * 380, p.z + sunDir.z * 780);
  G.sunGlow.material.opacity = s.nightF > 0.8 ? 0 : 0.22 + sunset * 0.68;
  const gs = 260 + sunset * 160;
  G.sunGlow.scale.set(gs, gs, 1);
  G.stars.material.opacity = s.nightF * 0.9;
  G.moon.material.opacity = s.nightF * 0.85;
  for (const c of G.clouds) {
    c.position.x += c.userData.v * dt;
    if (c.position.x > 650) c.position.x = -650;
    c.material.opacity = 0.5 - s.nightF * 0.34;
  }
  // Neon halos follow the night factor.
  for (const h of G.neonHalos) h.material.opacity = 0.12 + s.nightF * 0.5;
}
export function addBurst(x, y, z, color, n = 14, spread = 6) {
  if (!G.scene) return;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), vel = [];
  for (let i = 0; i < n; i++) {
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    vel.push([(Math.random() - 0.5) * spread, Math.random() * spread, (Math.random() - 0.5) * spread]);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.7, transparent: true, opacity: 1 }));
  pts.userData = { vel, life: 0.7 };
  G.scene.add(pts); G.bursts.push(pts);
}
export function updateBursts(dt) {
  for (let i = G.bursts.length - 1; i >= 0; i--) {
    const p = G.bursts[i];
    p.userData.life -= dt;
    const a = p.geometry.attributes.position;
    for (let j = 0; j < a.count; j++) {
      a.array[j * 3] += p.userData.vel[j][0] * dt;
      a.array[j * 3 + 1] += p.userData.vel[j][1] * dt;
      a.array[j * 3 + 2] += p.userData.vel[j][2] * dt;
      p.userData.vel[j][1] -= 9 * dt;
    }
    a.needsUpdate = true;
    p.material.opacity = Math.max(0, p.userData.life / 0.7);
    if (p.userData.life <= 0) { G.scene.remove(p); p.geometry.dispose(); G.bursts.splice(i, 1); }
  }
}
