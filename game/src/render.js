// Renderer three.js: langit aesthetic (gradasi + matahari + bulan +
// awan + bintang), fog 220–1100 m, lampu, bayangan, partikel/efek.
import { CFG } from './config.js';
import { clamp, lerp, mulberry32, rr } from './random.js';

function skyColorsAt(hour) {
  const stops = CFG.skyStops;
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (hour >= stops[i][0] && hour <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
  }
  if (hour < stops[0][0]) { a = stops[stops.length - 1]; b = stops[0]; }
  const span = (b[0] - a[0]) || 1;
  const t = clamp((hour - a[0]) / span, 0, 1);
  const mix = (ca, cb) => {
    const ra = (ca >> 16) & 255, ga = (ca >> 8) & 255, ba = ca & 255;
    const rb = (cb >> 16) & 255, gb = (cb >> 8) & 255, bb = cb & 255;
    return ((Math.round(lerp(ra, rb, t)) << 16) | (Math.round(lerp(ga, gb, t)) << 8) | Math.round(lerp(ba, bb, t))) >>> 0;
  };
  return { top: mix(a[1], b[1]), horizon: mix(a[2], b[2]), fog: mix(a[3], b[3]) };
}
export function createRenderer(W) {
  const THREE = W.three;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.getElementById('game').appendChild(renderer.domElement);
  W.renderer = renderer;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x8fc3e8, 220, 1100);
  W.scene = scene;
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(24, 8, 110);
  W.camera = camera;
  // Langit: kubah gradasi 3 warna (shader kanvas), matahari, bulan, awan, bintang.
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 4; skyCanvas.height = 256;
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), skyMat);
  scene.add(sky);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }));
  const sunGlow = new THREE.Mesh(new THREE.CircleGeometry(60, 32),
    new THREE.MeshBasicMaterial({ color: 0xffc86a, transparent: true, opacity: 0.35, fog: false }));
  scene.add(sun); scene.add(sunGlow);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(18, 32),
    new THREE.MeshBasicMaterial({ color: 0xe8ecf5, fog: false }));
  scene.add(moon);
  // Awan: tekstur 256 px bergambar gumpalan berlapis + mesh bola.
  const cloudTex = new THREE.CanvasTexture((() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    for (let i = 0; i < 26; i++) {
      const x = 30 + Math.random() * 196, y = 90 + Math.random() * 76, r = 18 + Math.random() * 42;
      const grad = g.createRadialGradient(x, y, 2, x, y, r);
      grad.addColorStop(0, 'rgba(255,255,255,.85)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    return c;
  })());
  cloudTex.colorSpace = THREE.SRGBColorSpace;
  const clouds = [];
  const rng = mulberry32(W.seed + 13);
  for (let i = 0; i < 14; i++) {
    const puff = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(rr(rng, 9, 18), 10, 8),
        new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false }));
      s.position.set(rr(rng, -18, 18), rr(rng, -3, 3), rr(rng, -6, 6));
      s.scale.y = 0.45;
      puff.add(s);
    }
    puff.position.set(rr(rng, -500, 500), rr(rng, 130, 220), rr(rng, -500, 500));
    scene.add(puff);
    clouds.push(puff);
  }
  // Bintang malam: titik-titik tajam.
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 420; i++) {
    const a = rng() * Math.PI * 2, e = rr(rng, 0.15, 1.4), r = 850;
    starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false }));
  scene.add(stars);
  // Lampu: matahari directional + hemisphere + lampu depan.
  const sunLight = new THREE.DirectionalLight(0xfff2d8, 2.4);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -160; sunLight.shadow.camera.right = 160;
  sunLight.shadow.camera.top = 160; sunLight.shadow.camera.bottom = -160;
  sunLight.shadow.camera.far = 700;
  scene.add(sunLight);
  scene.add(sunLight.target);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9);
  scene.add(hemi);
  const headlight = new THREE.SpotLight(0xfff2c0, 0, 60, 0.5, 0.4);
  scene.add(headlight);
  scene.add(headlight.target);
  // Partikel: satu Points pool untuk asap / ledakan / cipratan.
  const P_COUNT = 320;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(P_COUNT * 3);
  const pCol = new Float32Array(P_COUNT * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 1.6, vertexColors: true, transparent: true, opacity: 0.9 }));
  points.frustumCulled = false;
  scene.add(points);
  const parts = [];
  for (let i = 0; i < P_COUNT; i++) parts.push({ life: 0, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1 });
  const tracers = [];
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  const E = {
    spawn(x, y, z, vx, vy, vz, life, r, g, b) {
      const p = parts.find((q) => q.life <= 0);
      if (!p) return;
      p.life = life; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.r = r; p.g = g; p.b = b;
    },
    spawnSmoke(x, z, n = 1) {
      for (let i = 0; i < n; i++) E.spawn(x + rr(Math.random, -0.5, 0.5), 1 + Math.random(), z + rr(Math.random, -0.5, 0.5), rr(Math.random, -0.4, 0.4), rr(Math.random, 0.8, 1.6), rr(Math.random, -0.4, 0.4), rr(Math.random, 0.8, 1.4), 0.45, 0.45, 0.48);
    },
    explode(x, z) {
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2, sp = rr(Math.random, 2, 9);
        E.spawn(x, 1, z, Math.cos(a) * sp, rr(Math.random, 2, 8), Math.sin(a) * sp, rr(Math.random, 0.5, 1.1), 1, 0.55 + Math.random() * 0.3, 0.12);
      }
      for (let i = 0; i < 10; i++) E.spawn(x, 1, z, rr(Math.random, -1, 1), rr(Math.random, 1, 3), rr(Math.random, -1, 1), rr(Math.random, 1.2, 2), 0.25, 0.25, 0.28);
    },
    puff(x, y, z, color) {
      const r = ((color >> 16) & 255) / 255, g = ((color >> 8) & 255) / 255, b = (color & 255) / 255;
      for (let i = 0; i < 6; i++) E.spawn(x, y, z, rr(Math.random, -1.5, 1.5), rr(Math.random, -0.5, 1.5), rr(Math.random, -1.5, 1.5), 0.5, r, g, b);
    },
    tracer(x1, y1, z1, x2, y2, z2) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2),
      ]);
      const line = new THREE.Line(geo, tracerMat.clone());
      scene.add(line);
      tracers.push({ line, life: 0.12 });
    },
    muzzle(x, y, z) {
      E.spawn(x, y, z, 0, 0, 0, 0.08, 1, 0.9, 0.4);
      E.spawn(x, y, z, 0.5, 0.3, 0, 0.08, 1, 0.75, 0.3);
    },
    update(dt) {
      for (let i = 0; i < P_COUNT; i++) {
        const p = parts[i];
        if (p.life > 0) {
          p.life -= dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          p.vy -= 1.5 * dt;
        } else { p.y = -99; }
        pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
        pCol[i * 3] = p.r; pCol[i * 3 + 1] = p.g; pCol[i * 3 + 2] = p.b;
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;
      for (let i = tracers.length - 1; i >= 0; i--) {
        tracers[i].life -= dt;
        if (tracers[i].life <= 0) {
          scene.remove(tracers[i].line);
          tracers[i].line.geometry.dispose();
          tracers.splice(i, 1);
        }
      }
    },
  };
  W.effects = E;
  W.render = {
    sky, skyCanvas, skyTex, sun, sunGlow, moon, clouds, stars,
    sunLight, hemi, headlight, renderer, camera,
  };
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  return W.render;
}
export function updateSky(W, dt) {
  const R = W.render;
  const hour = W.hour;
  const cols = skyColorsAt(hour);
  // Gradasi kubah: gambar ulang strip vertikal 4 px.
  const g = R.skyCanvas.getContext('2d');
  const top = `#${cols.top.toString(16).padStart(6, '0')}`;
  const hor = `#${cols.horizon.toString(16).padStart(6, '0')}`;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top); grad.addColorStop(0.55, hor); grad.addColorStop(1, hor);
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  R.skyTex.needsUpdate = true;
  R.sky.material.color.setHex(0xffffff);
  W.scene.fog.color.setHex(cols.fog);
  // Matahari / bulan mengikuti jam.
  const sunAngle = ((hour - 6) / 12) * Math.PI; // 06:00 terbit, 18:00 terbenam
  const sx = Math.cos(sunAngle) * 800, sy = Math.sin(sunAngle) * 700 + 40;
  R.sun.position.set(sx, Math.max(30, sy), -500);
  R.sunGlow.position.copy(R.sun.position);
  R.sunGlow.position.z += 2;
  const moonAngle = ((hour - 18) / 12) * Math.PI;
  R.moon.position.set(Math.cos(moonAngle) * 800, Math.max(60, Math.sin(moonAngle) * 600 + 80), -500);
  const isDay = hour >= 6 && hour < 18.5;
  R.sun.visible = isDay; R.sunGlow.visible = isDay;
  R.moon.visible = !isDay;
  R.stars.visible = !isDay;
  R.stars.material.opacity = isDay ? 0 : 1;
  // Cahaya matahari: siang terang, senja oranye, malam redup.
  const dayF = isDay ? clamp(Math.sin(sunAngle), 0.25, 1) : 0.12;
  R.sunLight.intensity = 0.5 + dayF * 1.9;
  R.sunLight.color.setHex(hour >= 17 && hour < 19 ? 0xffb36a : hour < 7 ? 0xffc98a : 0xfff2d8);
  R.sunLight.position.set(sx * 0.4, Math.max(120, sy * 0.6), -200);
  const px = W.player.car ? W.player.car.x : W.player.x;
  const pz = W.player.car ? W.player.car.z : W.player.z;
  R.sunLight.target.position.set(px, 0, pz);
  R.hemi.intensity = isDay ? 0.9 : 0.35;
  // Awan bergerak pelan.
  for (const c of R.clouds) {
    c.position.x += dt * 1.6;
    if (c.position.x > 560) c.position.x = -560;
  }
  // Lampu jalan + lampu depan menyala malam.
  const night = !isDay;
  for (const lamp of W.city.lamps) {
    lamp.material.emissive.setHex(night ? 0xFFD98A : 0x000000);
  }
  for (const tl of W.city.trafficLights) {
    tl.t += dt;
    const phase = Math.floor(tl.t) % 2;
    tl.bulbs[0].material.color.setHex(phase === 0 ? 0xff2a2a : 0x551111);
    tl.bulbs[2].material.color.setHex(phase === 0 ? 0x115511 : 0x2aff5a);
  }
  // Mercusuar berputar + kincir ria berputar.
  if (W.city.lighthouseBeam) W.city.lighthouseBeam.rotation.y += dt * 0.5;
  if (W.city.ferrisWheel) W.city.ferrisWheel.rotation.z += dt * 0.12;
  if (W.city.seaTex) W.city.seaTex.offset.y -= dt * 0.01;
  // Lampu depan mobil pemain.
  const car = W.player.car;
  if (car && night) {
    R.headlight.intensity = 120;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    R.headlight.position.set(car.x + fx * 2, 1.2, car.z + fz * 2);
    R.headlight.target.position.set(car.x + fx * 30, 0, car.z + fz * 30);
  } else R.headlight.intensity = 0;
  // Radio ganti lagu tiap 45 detik.
  if (Math.floor(W.elapsed / 45) !== Math.floor((W.elapsed - dt) / 45)) {
    W.radioTrack = (W.radioTrack + 1) % CFG.radioTracks.length;
  }
}
export function renderFrame(W) {
  W.effects.update(1 / 60);
  W.renderer.render(W.scene, W.camera);
}
