// Renderer + sky: HD pixel ratio, long fog, sunset gradient sky, sun glow,
// detailed moon, clear stars, layered drifting clouds. Few dynamic lights.
import * as THREE from 'three';
import { G } from './config.js';
import { R } from './random.js';

export function nightFactor() {
  const t = G.timeOfDay;
  if (t < 17.5 || t >= 24) return t >= 20 || t < 5 ? 1 : 0;
  if (t < 18.5) return (t - 17.5) * 0.4;
  if (t < 20) return 0.4 + (t - 18.5) * 0.4;
  return 1;
}
export function sunsetFactor() {
  const t = G.timeOfDay;
  if (t < 16.5 || t > 20) return 0;
  if (t < 18.3) return (t - 16.5) / 1.8;
  return Math.max(0, 1 - (t - 18.3) / 1.7);
}

function glowTexture(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createWorld() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.getElementById('game').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffb36b, 220, 1100);
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 2000);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a4a3a, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 700; sun.shadow.bias = -0.0006;
  scene.add(sun); scene.add(sun.target);
  // Gradient sky dome driven by uniforms each frame.
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x2e4a7a) },
      mid: { value: new THREE.Color(0xff9a5c) },
      bot: { value: new THREE.Color(0x3a2b4d) },
      sunDir: { value: new THREE.Vector3(0, 0.3, -1) },
      sunCol: { value: new THREE.Color(0xffd27a) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top,mid,bot,sunCol; uniform vec3 sunDir; void main(){ float h=normalize(vP).y; vec3 c=mix(bot,mid,smoothstep(-0.08,0.22,h)); c=mix(c,top,smoothstep(0.2,0.65,h)); float s=pow(max(dot(normalize(vP),normalize(sunDir)),0.0),18.0); c+=sunCol*s*0.85; gl_FragColor=vec4(c,1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 24, 14), skyMat);
  scene.add(sky);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,236,180,1)', 'rgba(255,120,40,0)'),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  sunSprite.scale.set(420, 420, 1); scene.add(sunSprite);
  // Moon: canvas disc with craters, sharp at night.
  const mc = document.createElement('canvas'); mc.width = mc.height = 128;
  const mx = mc.getContext('2d');
  mx.fillStyle = '#e8e6da'; mx.beginPath(); mx.arc(64, 64, 58, 0, 7); mx.fill();
  mx.fillStyle = '#c9c6b8';
  [[44, 48, 12], [80, 70, 16], [58, 88, 9], [88, 40, 8]].forEach(([a, b, r]) => { mx.beginPath(); mx.arc(a, b, r, 0, 7); mx.fill(); });
  const moonTex = new THREE.CanvasTexture(mc); moonTex.colorSpace = THREE.SRGBColorSpace;
  const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false }));
  moonSprite.scale.set(90, 90, 1); scene.add(moonSprite);
  // Stars: 420 points, opacity driven by night.
  const sp = [];
  for (let i = 0; i < 420; i++) {
    const a = R.range(0, Math.PI * 2), e = R.range(0.12, 1.4), r = 1300;
    sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
  scene.add(stars);
  // Layered clouds: soft sprites at 3 heights, drifting.
  const cloudTex = glowTexture('rgba(255,255,255,0.85)', 'rgba(255,255,255,0)');
  for (let i = 0; i < 11; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.5, depthWrite: false, fog: false }));
    const layer = i % 3;
    s.position.set(R.range(-500, 500), 120 + layer * 45 + R.range(0, 20), R.range(-500, 500));
    s.scale.set(R.range(120, 260), R.range(28, 55), 1);
    s.userData.v = R.range(0.6, 1.8);
    scene.add(s); G.clouds.push(s);
  }
  G.renderer = renderer; G.scene = scene; G.camera = camera;
  G.sun = sun; G.hemi = hemi; G.skyMat = skyMat;
  G.sunSprite = sunSprite; G.moonSprite = moonSprite; G.stars = stars;
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

const DAY_TOP = new THREE.Color(0x3f6db3), DAY_MID = new THREE.Color(0x9fc4e8), DAY_BOT = new THREE.Color(0xcfe0d8);
const SET_TOP = new THREE.Color(0x4a2a6e), SET_MID = new THREE.Color(0xff7a3d), SET_BOT = new THREE.Color(0x2c1b3e);
const NIGHT_TOP = new THREE.Color(0x060a18), NIGHT_MID = new THREE.Color(0x1b2340), NIGHT_BOT = new THREE.Color(0x0a0d1c);
const _c = new THREE.Color();

export function updateSky(dt) {
  const t = G.timeOfDay, nf = nightFactor(), sf = sunsetFactor();
  const u = G.skyMat.uniforms;
  _c.copy(DAY_TOP).lerp(SET_TOP, sf).lerp(NIGHT_TOP, nf); u.top.value.copy(_c);
  _c.copy(DAY_MID).lerp(SET_MID, sf).lerp(NIGHT_MID, nf); u.mid.value.copy(_c);
  _c.copy(DAY_BOT).lerp(SET_BOT, sf).lerp(NIGHT_BOT, nf); u.bot.value.copy(_c);
  const ang = ((t - 6) / 12) * Math.PI; // sunrise 6h, sunset 18h
  const sd = new THREE.Vector3(Math.cos(ang) * 0.7, Math.sin(ang), -0.55).normalize();
  u.sunDir.value.copy(sd);
  u.sunCol.value.setHex(sf > 0.4 ? 0xff8f3d : 0xffd27a);
  G.sun.position.copy(sd).multiplyScalar(320).add(G.player.pos);
  G.sun.target.position.copy(G.player.pos);
  G.sun.color.setHex(0xfff2dd).lerp(new THREE.Color(0xff8f3d), sf * 0.8);
  G.sun.intensity = (2.4 - nf * 2.1) * (1 + sf * 0.25);
  G.hemi.intensity = 1.15 - nf * 0.8;
  G.scene.fog.color.copy(u.mid.value);
  G.sunSprite.position.copy(sd).multiplyScalar(1250).add(G.player.pos);
  G.sunSprite.material.opacity = Math.max(0, 0.9 * sf + 0.22 * (1 - nf) - 0.1);
  const md = new THREE.Vector3(-0.5, 0.62, 0.4).normalize();
  G.moonSprite.position.copy(md).multiplyScalar(1250).add(G.player.pos);
  G.moonSprite.material.opacity = nf;
  G.stars.material.opacity = nf * 0.95;
  G.stars.position.copy(G.player.pos);
  for (const c of G.clouds) {
    c.position.x += c.userData.v * dt;
    if (c.position.x > 560) c.position.x = -560;
    c.material.opacity = 0.5 - nf * 0.34;
    c.material.color.setHex(sf > 0.4 ? 0xffc4a3 : 0xffffff);
  }
  G.scene.background = null;
}
