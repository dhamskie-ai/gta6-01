import * as THREE from 'three';
import { nightFactor } from './city.js';

function radialSpriteTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

const SKY_KEYS = [
  [0.0, 0x0a0a22, 0x1a1a3a, 0x2a1a3a, 0x8888aa, 0.4, 0.5],
  [6.0, 0x7fa8d8, 0xbcd4e8, 0xe8d9b0, 0xfff2d0, 1.5, 0.85],
  [12.0, 0x3f7fd0, 0x8fc3e8, 0xd8e8f0, 0xffffff, 2.2, 1.15],
  [16.0, 0x5a8fd0, 0xa8c8e0, 0xe8d9b0, 0xfff2d0, 2.0, 1.1],
  [17.5, 0x6a7fc8, 0xe8a860, 0xf2c078, 0xffb347, 2.3, 1.25],
  [18.5, 0x4a4a8a, 0xff8f3d, 0xff6a5e, 0xff8f3d, 2.4, 1.2],
  [19.3, 0x2a2a55, 0xe85a8a, 0xff7a5e, 0xff6a5e, 1.5, 0.9],
  [20.0, 0x0a0a22, 0x1a1a3a, 0x2a1a3a, 0x8888aa, 0.4, 0.5],
  [24.0, 0x0a0a22, 0x1a1a3a, 0x2a1a3a, 0x8888aa, 0.4, 0.5],
];

function skyAt(t) {
  let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (t >= SKY_KEYS[i][0] && t <= SKY_KEYS[i + 1][0]) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
  }
  const f = (b[0] - a[0]) === 0 ? 0 : (t - a[0]) / (b[0] - a[0]);
  const mix = (ca, cb) => new THREE.Color(ca).lerp(new THREE.Color(cb), f);
  return {
    top: mix(a[1], b[1]), mid: mix(a[2], b[2]), bot: mix(a[3], b[3]),
    sunCol: mix(a[4], b[4]), sunI: a[5] + (b[5] - a[5]) * f, hemi: a[6] + (b[6] - a[6]) * f,
  };
}

export function createWorld(container) {
  let software = false;
  try {
    const test = document.createElement('canvas');
    const tgl = test.getContext('webgl2') || test.getContext('webgl');
    const ext = tgl && tgl.getExtension('WEBGL_debug_renderer_info');
    const str = ext ? String(tgl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    software = /swiftshader|llvmpipe|softpipe|software/i.test(str);
    if (tgl) { const lose = tgl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); }
  } catch (err) { /* detection unavailable; assume hardware */ }
  const renderer = new THREE.WebGLRenderer({ antialias: !software, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (software) { renderer.shadowMap.enabled = false; renderer.setPixelRatio(1); }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x8fc3e8, 120, 700);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
  camera.position.set(0, 6, -10);

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x3f7fd0) },
      midColor: { value: new THREE.Color(0x8fc3e8) },
      botColor: { value: new THREE.Color(0xd8e8f0) },
    },
    vertexShader: 'varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vPos; uniform vec3 topColor; uniform vec3 midColor; uniform vec3 botColor;
      void main(){ float h = normalize(vPos).y;
        vec3 c = h > 0.12 ? mix(midColor, topColor, smoothstep(0.12, 0.65, h)) : mix(botColor, midColor, smoothstep(-0.08, 0.12, h));
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), skyMat);
  scene.add(sky);

  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
  sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x8a7a5a, 1.0);
  scene.add(hemi);

  const glowTex = radialSpriteTexture();
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffb347, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
  }));
  sunGlow.scale.set(260, 260, 1);
  scene.add(sunGlow);

  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false,
    }));
    s.position.set((Math.random() - 0.5) * 700, 110 + Math.random() * 60, (Math.random() - 0.5) * 700);
    s.scale.set(120 + Math.random() * 120, 26 + Math.random() * 20, 1);
    scene.add(s);
    clouds.push({ s, speed: 0.6 + Math.random() * 0.9 });
  }

  const starCount = 500;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const e = Math.random() * 0.9 + 0.08;
    const r = 820;
    starPos[i * 3] = Math.cos(a) * Math.cos(e) * r;
    starPos[i * 3 + 1] = Math.sin(e) * r;
    starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0 });
  const stars = new THREE.Points(starGeo, starsMat);
  scene.add(stars);

  const PMAX = 420;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(PMAX * 3);
  const pCol = new Float32Array(PMAX * 3);
  for (let i = 0; i < PMAX; i++) { pPos[i * 3 + 1] = -999; }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.9, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false,
  }));
  points.frustumCulled = false;
  scene.add(points);
  const parts = [];
  for (let i = 0; i < PMAX; i++) parts.push({ life: 0, max: 1, vx: 0, vy: 0, vz: 0 });

  const tracers = [];
  for (let i = 0; i < 12; i++) {
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(tg, new THREE.LineBasicMaterial({
      color: 0xffe9a8, transparent: true, opacity: 0,
    }));
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }

  const flashes = [];
  for (let i = 0; i < 4; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffe9a8, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sp.scale.set(1.6, 1.6, 1);
    scene.add(sp);
    flashes.push({ sp, life: 0 });
  }

  const W = {
    renderer, scene, camera, sun, hemi, sky, skyMat, sunGlow, clouds, stars, starsMat, software,
    _pGeo: pGeo, _pPos: pPos, _pCol: pCol, _parts: parts, _tracers: tracers, _flashes: flashes,
    _flashIdx: 0, _tracerIdx: 0,
  };

  W.spawnParticles = function (pos, colorHex, n, spread, up) {
    const c = new THREE.Color(colorHex);
    let placed = 0;
    for (let i = 0; i < PMAX && placed < n; i++) {
      const p = parts[i];
      if (p.life > 0) continue;
      p.life = p.max = 0.5 + Math.random() * 0.7;
      p.vx = (Math.random() - 0.5) * spread * 2;
      p.vy = Math.random() * (up || 1) + 0.5;
      p.vz = (Math.random() - 0.5) * spread * 2;
      pPos[i * 3] = pos.x; pPos[i * 3 + 1] = pos.y; pPos[i * 3 + 2] = pos.z;
      pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
      placed++;
    }
    pGeo.attributes.color.needsUpdate = true;
  };

  W.updateParticles = function (dt) {
    for (let i = 0; i < PMAX; i++) {
      const p = parts[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { pPos[i * 3 + 1] = -999; continue; }
      p.vy -= 4 * dt;
      pPos[i * 3] += p.vx * dt;
      pPos[i * 3 + 1] += p.vy * dt;
      pPos[i * 3 + 2] += p.vz * dt;
    }
    pGeo.attributes.position.needsUpdate = true;
  };

  W.spawnTracer = function (from, to) {
    const t = tracers[W._tracerIdx % tracers.length];
    W._tracerIdx++;
    const a = t.line.geometry.attributes.position.array;
    a[0] = from.x; a[1] = from.y; a[2] = from.z;
    a[3] = to.x; a[4] = to.y; a[5] = to.z;
    t.line.geometry.attributes.position.needsUpdate = true;
    t.life = 0.09;
    t.line.material.opacity = 0.95;
  };

  W.muzzleFlash = function (pos) {
    const f = flashes[W._flashIdx % flashes.length];
    W._flashIdx++;
    f.sp.position.set(pos.x, pos.y, pos.z);
    f.sp.scale.set(1.4 + Math.random(), 1.4 + Math.random(), 1);
    f.life = 0.06;
    f.sp.material.opacity = 0.95;
  };

  W.explosion = function (pos) {
    W.spawnParticles(pos, 0xff8f2a, 34, 3.2, 3.5);
    W.spawnParticles(pos, 0x555555, 16, 2.2, 2.5);
    W.spawnParticles(pos, 0xffe9a8, 10, 1.6, 2);
    W.muzzleFlash({ x: pos.x, y: pos.y + 0.5, z: pos.z });
  };

  W.updateFx = function (dt) {
    W.updateParticles(dt);
    for (const t of tracers) {
      if (t.life > 0) {
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.95;
      }
    }
    for (const f of flashes) {
      if (f.life > 0) {
        f.life -= dt;
        f.sp.material.opacity = Math.max(0, f.life / 0.06) * 0.95;
      }
    }
  };

  W.updateSky = function (G, dt, elapsed) {
    const t = G.timeOfDay;
    const sky = skyAt(t);
    W.skyMat.uniforms.topColor.value.copy(sky.top);
    W.skyMat.uniforms.midColor.value.copy(sky.mid);
    W.skyMat.uniforms.botColor.value.copy(sky.bot);
    W.scene.fog.color.copy(sky.mid);
    W.sun.color.copy(sky.sunCol);
    W.sun.intensity = sky.sunI;
    W.hemi.intensity = sky.hemi;
    const a = (t - 6) / 12 * Math.PI;
    const dir = new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.9 + 0.12, 0.42).normalize();
    const px = G.player.x, pz = G.player.z;
    W.sun.position.set(px + dir.x * 160, Math.max(12, dir.y * 160), pz + dir.z * 160);
    W.sun.target.position.set(px, 0, pz);
    const golden = (t >= 17 && t <= 19.3) ? 1 - Math.abs(t - 18.2) / 1.3 : 0;
    W.sunGlow.position.set(px + dir.x * 700, Math.max(30, dir.y * 700), pz + dir.z * 700);
    W.sunGlow.material.opacity = 0.18 + golden * 0.72;
    W.sunGlow.material.color.setHex(golden > 0.4 ? 0xff8f3d : 0xffe9a8);
    const nf = nightFactor(t);
    W.starsMat.opacity = nf * 0.9;
    for (const c of W.clouds) {
      c.s.position.x += c.speed * dt;
      if (c.s.position.x > 420) c.s.position.x = -420;
      c.s.material.opacity = 0.5 - nf * 0.34;
    }
    W.sky.position.set(px, 0, pz);
    W.stars.position.set(px, 0, pz);
  };

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return W;
}
