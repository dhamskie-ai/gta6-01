// Renderer three.js: langit golden hour, matahari, awan, bintang, bulan,
// partikel, beacon misi, lampu depan.
import { clamp, lerp } from './random.js';

const SKY_KEYS = [
  [6, 0x8fb8dd], [12, 0x9fc3e8], [16, 0x9fc3e8], [17.5, 0xf7c873],
  [18.5, 0xff8f3d], [19.3, 0xff6f91], [20, 0x2a2f4a], [21, 0x0d1526], [24, 0x0d1526],
];
function skyColorAt(t) {
  let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (t >= SKY_KEYS[i][0] && t <= SKY_KEYS[i + 1][0]) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
  }
  const f = clamp((t - a[0]) / Math.max(0.01, b[0] - a[0]), 0, 1);
  const ca = new THREE.Color(a[1]), cb = new THREE.Color(b[1]);
  return ca.lerp(cb, f);
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  return renderer;
}

export function createWorld(THREE, scene) {
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 500;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x4a3a28, 1.0);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0x9fc3e8, 180, 520);
  // sun glow sprite
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,220,150,1)'); gr.addColorStop(0.4, 'rgba(255,160,80,0.55)');
    gr.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sunGlow.scale.set(180, 180, 1);
  scene.add(sunGlow);
  // awan
  const cloudTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const x = 40 + Math.random() * 176, y = 40 + Math.random() * 48, r = 18 + Math.random() * 26;
      const gr = g.createRadialGradient(x, y, 2, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.29); g.fill();
    }
    return new THREE.CanvasTexture(c);
  })();
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.5, depthWrite: false }));
    s.position.set((Math.random() - 0.5) * 500, 110 + Math.random() * 60, (Math.random() - 0.5) * 500);
    s.scale.set(90 + Math.random() * 70, 34 + Math.random() * 20, 1);
    scene.add(s);
    clouds.push(s);
  }
  // kubah langit gradien (mengikuti pemain, warna ikut jam)
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 4; skyCanvas.height = 256;
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(480, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }));
  scene.add(skyDome);
  // bintang malam (240) + bulan
  const starGeo = new THREE.BufferGeometry();
  const sp = [];
  for (let i = 0; i < 240; i++) {
    const a = Math.random() * Math.PI * 2, e = 0.25 + Math.random() * 1.2, r = 420;
    sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, transparent: true, opacity: 0, sizeAttenuation: false }));
  scene.add(stars);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xdfe8ff, transparent: true, opacity: 0, depthWrite: false }));
  moon.scale.set(46, 46, 1);
  scene.add(moon);
  // beacon misi
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true), beaconMat);
  beacon.position.y = 30; beacon.visible = false;
  scene.add(beacon);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.2, 24), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; ring.visible = false;
  scene.add(ring);
  // lampu depan mobil (spotlight) — dipindah tiap frame ke mobil pemain
  const headlight = new THREE.SpotLight(0xfff2b0, 0, 60, 0.5, 0.4, 1.2);
  scene.add(headlight); scene.add(headlight.target);
  return { sun, hemi, sunGlow, clouds, stars, moon, beacon, ring, headlight, skyDome, skyCanvas, skyTex, lastSkyT: -1 };
}

export function createRenderFx(THREE, scene) {
  const fx = { bursts: [], tracers: [], muzzles: [] };
  fx.burst = function (x, y, z, color, n) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) {
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      vel.push([(Math.random() - 0.5) * 8, Math.random() * 6, (Math.random() - 0.5) * 8]);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.5, transparent: true, opacity: 1 }));
    scene.add(pts);
    fx.bursts.push({ pts, vel, life: 0.7 });
  };
  fx.tracer = function (a, b) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    scene.add(line);
    fx.tracers.push({ line, life: 0.12 });
  };
  fx.muzzle = function (p) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffd23e, transparent: true, opacity: 0.95, depthWrite: false }));
    s.position.set(p.x, p.y, p.z); s.scale.set(1.4, 1.4, 1);
    scene.add(s);
    fx.muzzles.push({ s, life: 0.06 });
  };
  fx.update = function (dt) {
    for (const b of fx.bursts) {
      b.life -= dt;
      const arr = b.pts.geometry.attributes.position.array;
      for (let i = 0; i < b.vel.length; i++) {
        arr[i * 3] += b.vel[i][0] * dt;
        arr[i * 3 + 1] += b.vel[i][1] * dt;
        arr[i * 3 + 2] += b.vel[i][2] * dt;
        b.vel[i][1] -= 9 * dt;
      }
      b.pts.geometry.attributes.position.needsUpdate = true;
      b.pts.material.opacity = Math.max(0, b.life / 0.7);
      if (b.life <= 0) { scene.remove(b.pts); fx.bursts.splice(fx.bursts.indexOf(b), 1); }
    }
    for (const t of fx.tracers) {
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.12);
      if (t.life <= 0) { scene.remove(t.line); fx.tracers.splice(fx.tracers.indexOf(t), 1); }
    }
    for (const m of fx.muzzles) {
      m.life -= dt;
      if (m.life <= 0) { scene.remove(m.s); fx.muzzles.splice(fx.muzzles.indexOf(m), 1); }
    }
  };
  return fx;
}

export function updateRender(G, dt, world, city, camera) {
  const t = G.timeOfDay;
  const px = G.player.x, pz = G.player.z;
  // siklus siang–malam
  const sunset = clamp(1 - Math.abs(t - 18.4) / 1.6, 0, 1);
  const night = t >= 20 || t < 6 ? 1 : t >= 19.3 ? (t - 19.3) / 0.7 : t < 6 ? 1 : 0;
  const nightF = clamp(night, 0, 1);
  G.nightFactor = nightF;
  const sky = skyColorAt(t);
  G.scene.background = sky;
  G.scene.fog.color.copy(sky);
  // kubah langit: gradien horizon (hangat) → atas (lebih gelap)
  if (Math.abs(t - world.lastSkyT) > 0.2) {
    world.lastSkyT = t;
    const g2 = world.skyCanvas.getContext('2d');
    const top = sky.clone().lerp(new THREE.Color(0x1a2340), nightF > 0.5 ? 0.8 : 0.5);
    const grad = g2.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#' + top.getHexString());
    grad.addColorStop(0.62, '#' + sky.getHexString());
    grad.addColorStop(1, '#' + sky.clone().lerp(new THREE.Color(0xffffff), 0.12).getHexString());
    g2.fillStyle = grad; g2.fillRect(0, 0, 4, 256);
    world.skyTex.needsUpdate = true;
  }
  world.skyDome.position.set(px, 0, pz);
  // matahari: elevasi dari jam
  const sunAngle = ((t - 6) / 12) * Math.PI; // 6:00 timur → 18:00 barat
  const sunDir = {
    x: Math.cos(sunAngle), y: Math.sin(sunAngle) * 0.9 + 0.08, z: 0.35,
  };
  const sunLen = Math.hypot(sunDir.x, sunDir.y, sunDir.z);
  sunDir.x /= sunLen; sunDir.y /= sunLen; sunDir.z /= sunLen;
  world.sun.position.set(px + sunDir.x * 140, Math.max(20, sunDir.y * 140), pz + sunDir.z * 140);
  world.sun.target.position.set(px, 0, pz);
  world.sun.target.updateMatrixWorld();
  world.sun.color.setHex(0xfff2dd).lerp(new THREE.Color(0xff8f3d), sunset * 0.85);
  world.sun.intensity = (nightF > 0.5 ? 0.25 : 1.5) + sunset * 0.35;
  world.hemi.intensity = lerp(1.15, 0.35, nightF);
  world.sunGlow.position.set(px + sunDir.x * 260, Math.max(30, sunDir.y * 260), pz + sunDir.z * 260);
  world.sunGlow.material.opacity = nightF > 0.5 ? 0 : 0.22 + sunset * 0.68;
  world.sunGlow.scale.set(120 + sunset * 70, 120 + sunset * 70, 1);
  for (const c of world.clouds) {
    c.position.x += dt * 1.2;
    if (c.position.x > 300) c.position.x = -300;
    c.material.opacity = lerp(0.5, 0.16, nightF);
  }
  world.stars.material.opacity = nightF * 0.9;
  world.stars.position.set(px, 0, pz);
  world.moon.position.set(px - sunDir.x * 380, 220, pz - sunDir.z * 380);
  world.moon.material.opacity = nightF * 0.85;
  // beacon
  if (G.beacon && G.beacon.visible) {
    world.beacon.visible = true; world.ring.visible = true;
    world.beacon.position.set(G.beacon.x, 30, G.beacon.z);
    world.ring.position.set(G.beacon.x, 0.15, G.beacon.z);
    const pulse = 1 + Math.sin(performance.now() / 300) * 0.25;
    world.beacon.scale.set(pulse, 1, pulse);
    world.beacon.material.opacity = 0.18 + Math.sin(performance.now() / 300) * 0.06;
  } else { world.beacon.visible = false; world.ring.visible = false; }
  // lampu depan malam
  const hl = world.headlight;
  if (nightF > 0.4 && G.player.inCar && G.playerCar) {
    const car = G.playerCar;
    hl.intensity = 2.2;
    hl.position.set(car.x + Math.sin(car.yaw) * 2, 1.2, car.z + Math.cos(car.yaw) * 2);
    hl.target.position.set(car.x + Math.sin(car.yaw) * 30, 0.4, car.z + Math.cos(car.yaw) * 30);
  } else hl.intensity = 0;
  city.updateCityFx(dt, t, nightF, G.time);
  G.renderFx.update(dt);
}
