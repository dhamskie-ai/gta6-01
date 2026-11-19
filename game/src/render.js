// SOLARA BAY — renderer: scene, sky dome, sun/moon, clouds, birds,
// particles, tracers and muzzle flashes. Sharpness rules (round 6f):
// pixelRatio min(dpr,2) + antialias on real hardware, fog pushed far
// (220–1100 m) so mid-distance buildings stay crisp, and every sky
// element is drawn with hard edges instead of stretched blur sprites.
import * as THREE from 'three';
import { nightFactor } from './city.js';

// Soft round glow (only used for small glows, never stretched huge).
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// Puffy cloud texture: several hard-edged lobes on a 256px canvas, so a
// cloud sprite keeps visible shape instead of one blurred blob.
function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const lobes = [[70, 84, 46], [120, 66, 58], [178, 80, 48], [205, 92, 30], [100, 92, 40], [150, 94, 42]];
  for (const [x, y, r] of lobes) {
    const grad = g.createRadialGradient(x, y, r * 0.15, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.75, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fillRect(52, 88, 156, 22);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, software ? 1 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = !software;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x8fc3e8, 220, 1100);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
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
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
  sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x8a7a5a, 1.0);
  scene.add(hemi);

  const glowTex = glowTexture();
  // Sharp sun disc: hard-edged circle mesh + a modest glow halo.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 40),
    new THREE.MeshBasicMaterial({ color: 0xfff2c8, fog: false, depthWrite: false, depthTest: false, transparent: true, opacity: 0.95 }),
  );
  sunDisc.renderOrder = -1;
  scene.add(sunDisc);
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffb347, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
  }));
  sunGlow.scale.set(220, 220, 1);
  scene.add(sunGlow);
  // Moon: pale hard disc visible at night, opposite the sun.
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(22, 32),
    new THREE.MeshBasicMaterial({ color: 0xe8ecf5, fog: false, depthWrite: false, depthTest: false, transparent: true, opacity: 0 }),
  );
  moon.renderOrder = -1;
  scene.add(moon);

  const cloudTex = cloudTexture();
  const clouds = [];
  for (let i = 0; i < 11; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cloudTex, color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false,
    }));
    s.position.set((Math.random() - 0.5) * 700, 120 + Math.random() * 70, (Math.random() - 0.5) * 700);
    s.scale.set(90 + Math.random() * 110, 34 + Math.random() * 22, 1);
    scene.add(s);
    clouds.push({ s, speed: 0.6 + Math.random() * 0.9 });
  }
  // Puffy mesh clouds: clusters of flat-shaded spheres, crisp silhouette.
  const puffMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  const puffs = [];
  for (let i = 0; i < 5; i++) {
    const grp = new THREE.Group();
    const n = 4 + Math.floor(Math.random() * 3);
    for (let j = 0; j < n; j++) {
      const r = 14 + Math.random() * 16;
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), puffMat);
      m.position.set((j - n / 2) * 22 + Math.random() * 8, Math.random() * 8, Math.random() * 10 - 5);
      m.scale.y = 0.55;
      grp.add(m);
    }
    grp.position.set((Math.random() - 0.5) * 600, 130 + Math.random() * 60, (Math.random() - 0.5) * 600);
    scene.add(grp);
    puffs.push({ grp, speed: 0.5 + Math.random() * 0.8 });
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

  // Ambient birds: flapping two-triangle wings, flying slow circles.
  const birds = [];
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x1c2733, side: THREE.DoubleSide });
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      0, 0, 0, 1.1, 0, 0.35, 1.1, 0, -0.35,
    ]), 3));
    wingGeo.computeVertexNormals();
    const wl = new THREE.Mesh(wingGeo, birdMat);
    const wr = new THREE.Mesh(wingGeo, birdMat);
    wr.scale.x = -1;
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.7, 6), birdMat);
    body.rotation.x = Math.PI / 2;
    g.add(wl); g.add(wr); g.add(body);
    g.userData = { wl, wr, flap: Math.random() * 6.28 };
    scene.add(g);
    birds.push({
      g, cx: (Math.random() - 0.5) * 320, cz: (Math.random() - 0.5) * 320,
      cy: 55 + Math.random() * 45, r: 40 + Math.random() * 90,
      a: Math.random() * Math.PI * 2, speed: (0.05 + Math.random() * 0.05) * (Math.random() < 0.5 ? 1 : -1),
      flapSpeed: 7 + Math.random() * 4,
    });
  }

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

  W.updateBirds = function (dt, elapsed, day) {
    for (const b of birds) {
      b.a += b.speed * dt;
      const x = b.cx + Math.cos(b.a) * b.r;
      const z = b.cz + Math.sin(b.a) * b.r;
      const y = b.cy + Math.sin(elapsed * 0.7 + b.a * 3) * 3;
      b.g.position.set(x, y, z);
      b.g.rotation.y = -b.a - (b.speed > 0 ? 0 : Math.PI);
      const flap = Math.sin(elapsed * b.flapSpeed + b.g.userData.flap) * 0.7;
      b.g.userData.wl.rotation.z = flap;
      b.g.userData.wr.rotation.z = -flap;
      b.g.visible = day;
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
    const sunPos = new THREE.Vector3(px + dir.x * 760, Math.max(40, dir.y * 760), pz + dir.z * 760);
    W.sunGlow.position.copy(sunPos);
    W.sunGlow.material.opacity = 0.18 + golden * 0.72;
    W.sunGlow.material.color.setHex(golden > 0.4 ? 0xff8f3d : 0xffe9a8);
    sunDisc.position.copy(sunPos);
    sunDisc.lookAt(px, sunPos.y, pz);
    sunDisc.material.color.setHex(golden > 0.4 ? 0xff9a4d : 0xfff2c8);
    const nf = nightFactor(t);
    moon.position.set(px - dir.x * 760, Math.max(60, -dir.y * 760 + 260), pz - dir.z * 760);
    moon.lookAt(px, moon.position.y, pz);
    moon.material.opacity = nf * 0.9;
    W.starsMat.opacity = nf * 0.9;
    for (const c of W.clouds) {
      c.s.position.x += c.speed * dt;
      if (c.s.position.x > 420) c.s.position.x = -420;
      c.s.material.opacity = 0.85 - nf * 0.6;
    }
    for (const p of puffs) {
      p.grp.position.x += p.speed * dt;
      if (p.grp.position.x > 420) p.grp.position.x = -420;
      p.grp.children.forEach((m) => { m.material = puffMat; });
      puffMat.opacity = 0.9 - nf * 0.65;
    }
    W.updateBirds(dt, elapsed, nf < 0.5);
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
