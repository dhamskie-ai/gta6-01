// Renderer, sky, lights, fog. HD: pixelRatio cap 2, PCFSoft 1024, ACES 1.12.
import * as THREE from 'three';
export function nightFactor(t) {
  if (t < 17.5) return 0;
  if (t < 18.5) return (t - 17.5) * 0.4;
  if (t < 20) return 0.4 + (t - 18.5) * 0.6;
  return 1;
}
export function sunsetFactor(t) {
  if (t < 16.5 || t >= 20) return 0;
  if (t < 18.3) return (t - 16.5) / 1.8;
  return 1 - (t - 18.3) / 1.7;
}
export function initRender(G) {
  const r = new THREE.WebGLRenderer({ canvas: G.canvas, antialias: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.setSize(innerWidth, innerHeight);
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.12;
  r.outputColorSpace = THREE.SRGBColorSpace;
  G.renderer = r;
  const s = new THREE.Scene();
  s.fog = new THREE.Fog(0xffb36b, 220, 1100);
  G.scene = s;
  G.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 2000);
  addEventListener('resize', () => {
    r.setSize(innerWidth, innerHeight);
    G.camera.aspect = innerWidth / innerHeight;
    G.camera.updateProjectionMatrix();
  });
  G.sunLight = new THREE.DirectionalLight(0xfff2d8, 2.4);
  G.sunLight.castShadow = true;
  G.sunLight.shadow.mapSize.set(1024, 1024);
  const sc = G.sunLight.shadow.camera;
  sc.left = -160; sc.right = 160; sc.top = 160; sc.bottom = -160; sc.far = 700;
  G.sunLight.shadow.bias = -0.0006;
  s.add(G.sunLight, G.sunLight.target);
  G.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x8a7a5a, 0.9);
  s.add(G.hemi);
  // Sky dome: 3-stop gradient shader, recoloured by time of day.
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x3f6db3) }, mid: { value: new THREE.Color(0x9fc4e8) }, bot: { value: new THREE.Color(0xcfe0d8) } },
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top,mid,bot; void main(){ float h=normalize(vP).y; vec3 c=h>0.12?mix(mid,top,smoothstep(0.12,0.7,h)):mix(bot,mid,smoothstep(-0.08,0.12,h)); gl_FragColor=vec4(c,1.0); }',
  });
  G.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), skyMat);
  s.add(G.sky);
  // Sun disc + glow sprite.
  const sunCv = document.createElement('canvas'); sunCv.width = sunCv.height = 128;
  const sg = sunCv.getContext('2d');
  const grad = sg.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,240,200,1)'); grad.addColorStop(0.35, 'rgba(255,200,90,0.85)'); grad.addColorStop(1, 'rgba(255,160,40,0)');
  sg.fillStyle = grad; sg.fillRect(0, 0, 128, 128);
  const sunTex = new THREE.CanvasTexture(sunCv);
  G.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false }));
  G.sunSprite.scale.set(420, 420, 1);
  s.add(G.sunSprite);
  // Moon: 128px canvas with craters.
  const mc = document.createElement('canvas'); mc.width = mc.height = 128;
  const mg = mc.getContext('2d');
  mg.fillStyle = '#e8e8e0'; mg.beginPath(); mg.arc(64, 64, 56, 0, 7); mg.fill();
  mg.fillStyle = '#b9b9ae';
  [[44, 48, 10], [80, 70, 13], [58, 86, 8], [88, 40, 7]].forEach(([x, y, r]) => { mg.beginPath(); mg.arc(x, y, r, 0, 7); mg.fill(); });
  G.moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(mc), transparent: true, fog: false, depthWrite: false }));
  G.moonSprite.scale.set(90, 90, 1);
  s.add(G.moonSprite);
  // Stars: 420 points.
  const sp = [];
  for (let i = 0; i < 420; i++) {
    const a = G.rng.f() * Math.PI * 2, e = 0.15 + G.rng.f() * 1.2, rr = 850;
    sp.push(Math.cos(a) * Math.cos(e) * rr, Math.sin(e) * rr, Math.sin(a) * Math.cos(e) * rr);
  }
  const sg2 = new THREE.BufferGeometry();
  sg2.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  G.stars = new THREE.Points(sg2, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0 }));
  s.add(G.stars);
  // Clouds: 11 soft sprites drifting.
  const cc = document.createElement('canvas'); cc.width = 256; cc.height = 128;
  const cg = cc.getContext('2d');
  for (let i = 0; i < 9; i++) {
    const x = 30 + G.rng.f() * 196, y = 40 + G.rng.f() * 48, r = 22 + G.rng.f() * 26;
    const g2 = cg.createRadialGradient(x, y, 2, x, y, r);
    g2.addColorStop(0, 'rgba(255,255,255,0.85)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
    cg.fillStyle = g2; cg.beginPath(); cg.arc(x, y, r, 0, 7); cg.fill();
  }
  const ct = new THREE.CanvasTexture(cc);
  G.clouds = [];
  for (let i = 0; i < 11; i++) {
    const sp2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, opacity: 0.75, fog: false, depthWrite: false }));
    sp2.position.set(G.rng.range(-500, 500), G.rng.range(120, 220), G.rng.range(-500, 500));
    const sc2 = G.rng.range(120, 240);
    sp2.scale.set(sc2, sc2 * 0.5, 1);
    s.add(sp2); G.clouds.push(sp2);
  }
}
const DAY = { top: 0x3f6db3, mid: 0x9fc4e8, bot: 0xcfe0d8 };
const SET = { top: 0x4a2a6e, mid: 0xff7a3d, bot: 0x2c1b3e };
const NIGHT = { top: 0x060a18, mid: 0x1b2340, bot: 0x0a0d1c };
function mix3(a, b, t) { return new THREE.Color(a).lerp(new THREE.Color(b), t); }
export function updateSky(G, dt) {
  const t = G.timeOfDay, nf = nightFactor(t), sf = sunsetFactor(t);
  const u = G.sky.material.uniforms;
  let top = mix3(DAY.top, SET.top, sf), mid = mix3(DAY.mid, SET.mid, sf), bot = mix3(DAY.bot, SET.bot, sf);
  top = top.lerp(new THREE.Color(NIGHT.top), nf);
  mid = mid.lerp(new THREE.Color(NIGHT.mid), nf);
  bot = bot.lerp(new THREE.Color(NIGHT.bot), nf);
  u.top.value.copy(top); u.mid.value.copy(mid); u.bot.value.copy(bot);
  G.scene.fog.color.copy(mid).lerp(new THREE.Color(0xffb36b), (1 - nf) * 0.5);
  const ang = ((t - 6) / 12) * Math.PI; // sun path 06:00-18:00
  const sx = Math.cos(ang) * 700, sy = Math.sin(ang) * 600 + 40, sz = 260;
  G.sunSprite.position.set(sx, Math.max(sy, -80), sz);
  G.sunSprite.material.opacity = nf > 0.9 ? 0 : 1 - nf;
  G.moonSprite.position.set(-sx * 0.8, Math.max(320 - sy * 0.4, 120), -sz);
  G.moonSprite.material.opacity = nf;
  G.stars.material.opacity = nf * 0.9;
  G.sunLight.position.set(sx * 0.4, Math.max(sy, 60), sz * 0.4);
  G.sunLight.intensity = 2.4 * (1 - nf) + 0.15;
  G.sunLight.color.setHex(sf > 0.3 ? 0xffb36b : 0xfff2d8);
  G.hemi.intensity = 0.9 * (1 - nf * 0.7);
  for (const c of G.clouds) {
    c.position.x += dt * 1.5;
    if (c.position.x > 560) c.position.x = -560;
    c.material.opacity = 0.75 * (1 - nf * 0.6);
  }
}
