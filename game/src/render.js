// Renderer: scene, lights, warm sunset sky, sun glow, drifting clouds,
// night stars, fog, particles, explosions. Sharpness: screenshots
// render supersampled (pixel ratio 3, ~4K backing store) with
// antialiasing on, while live play uses a quality setting (Low/Medium/
// High/Ultra + 4K toggle) with dynamic resolution scaling that sheds
import * as THREE from 'three';
function glowTexture(inner, outer) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, inner); grad.addColorStop(1, outer);
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const QUALITY_KEY = 'solarabay-quality-v1';
const QUALITY_LEVELS = {
  low: { pr: 1, shadows: false, shadowSize: 1024 },
  medium: { pr: 1.5, shadows: true, shadowSize: 1024 },
  high: { pr: 2, shadows: true, shadowSize: 1024 },
  ultra: { pr: 2, shadows: true, shadowSize: 2048 },
};
export function loadQuality() {
  const fallback = { level: 'high', fourK: false, showFps: false, drs: true };
  try {
    const raw = localStorage.getItem(QUALITY_KEY);
    if (!raw) return fallback;
    const q = JSON.parse(raw);
    if (!QUALITY_LEVELS[q.level]) q.level = 'high';
    return { ...fallback, ...q };
  } catch { return fallback; }
}
export function saveQuality(q) {
  try { localStorage.setItem(QUALITY_KEY, JSON.stringify(q)); } catch { /* private mode */ }
}
export function qualityCap(q) {
  if (q.fourK) return 3;
  return QUALITY_LEVELS[q.level || 'high'].pr;
}
export function applyQuality(G) {
  const q = G.quality || loadQuality();
  const level = QUALITY_LEVELS[q.level || 'high'];
  G._prCap = qualityCap(q);
  G._prCur = Math.min(devicePixelRatio || 1, G._prCap);
  G.renderer.setPixelRatio(G._prCur);
  G.renderer.shadowMap.enabled = level.shadows;
  if (G.lights && G.lights.sun) G.lights.sun.shadow.mapSize.set(level.shadowSize, level.shadowSize);
  if (G.lights && G.lights.sun && G.lights.sun.shadow.map) {
    G.lights.sun.shadow.map.dispose();
    G.lights.sun.shadow.map = null;
  }
}
export function updateDynamicRes(G, dt) {
  if (G._shotMode || !G.renderer || !G.quality || G.quality.drs === false) return;
  if (G._drsCooldown === undefined) G._drsCooldown = 0;
  G._drsCooldown -= dt;
  if (G._drsCooldown > 0) return;
  const fps = G._fps || 60;
  if (fps < 42 && G._prCur > 1) {
    G._prCur = Math.max(1, G._prCur - 0.25);
    G.renderer.setPixelRatio(G._prCur);
    G._drsCooldown = 2;
  } else if (fps > 57 && G._prCur < G._prCap) {
    G._prCur = Math.min(G._prCap, G._prCur + 0.25);
    G.renderer.setPixelRatio(G._prCur);
    G._drsCooldown = 2;
  }
}
export function createRender(G, opts = {}) {
  const shotMode = !!opts.shotMode;
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  G.quality = opts.quality || loadQuality();
  if (shotMode) {
    G._shotMode = true;
    G._prCap = 3;
    G._prCur = 3;
    renderer.setPixelRatio(3);
  } else {
    G._shotMode = false;
    G._prCap = qualityCap(G.quality);
    G._prCur = Math.min(devicePixelRatio || 1, G._prCap);
    renderer.setPixelRatio(G._prCur);
  }
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = shotMode || QUALITY_LEVELS[G.quality.level || 'high'].shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    G.camera.aspect = innerWidth / innerHeight;
    G.camera.updateProjectionMatrix();
  });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d6);
  scene.fog = new THREE.Fog(0x9ab8cc, 240, 820);
  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 900);
  camera.position.set(0, 8, -14);
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 500;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a5240, 1.15);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x8aa8ff, 0);
  scene.add(moon); scene.add(moon.target);
  const glowTex = glowTexture('rgba(255, 190, 110, 1)', 'rgba(255, 120, 60, 0)');
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, transparent: true, opacity: 0.22, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  sunGlow.scale.set(180, 180, 1);
  scene.add(sunGlow);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, color: 0xbfd0ff,
  }));
  moonGlow.scale.set(90, 90, 1);
  scene.add(moonGlow);
  const cloudTex = glowTexture('rgba(255, 255, 255, 0.85)', 'rgba(255, 255, 255, 0)');
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const puff = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cloudTex, transparent: true, opacity: 0.5, depthWrite: false,
    }));
    const w = 70 + G.rng.range(0, 150);
    const tall = i % 4 === 0;
    puff.scale.set(w, w * (tall ? 0.5 : 0.3), 1);
    puff.position.set(G.rng.range(-420, 420), G.rng.range(105, 175), G.rng.range(-320, 320));
    scene.add(puff);
    clouds.push({ sprite: puff, drift: G.rng.range(1.0, 3.4), baseOp: G.rng.range(0.32, 0.62) });
  }
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(240 * 3);
  for (let i = 0; i < 240; i++) {
    const a = G.rng.range(0, Math.PI * 2);
    const r = G.rng.range(180, 420);
    starPos[i * 3] = Math.cos(a) * r;
    starPos[i * 3 + 1] = G.rng.range(120, 380);
    starPos[i * 3 + 2] = Math.sin(a) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, transparent: true, opacity: 0 });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  scene.add(stars);
  G.renderer = renderer; G.scene = scene; G.camera = camera;
  G.lights = { sun, hemi, moon };
  G._sunGlow = sunGlow;
  G._moonGlow = moonGlow;
  G._clouds = clouds;
  G._stars = stars;
  return { renderer, scene, camera };
}
const SKY_KEYS = [
  [0, 0x0a1026], [5, 0x1a2440], [6.5, 0xf2a35e], [8, 0x87b5d6], [12, 0x7fb2e0],
  [16, 0x8fb8d8], [17.5, 0xf2b25e], [18.5, 0xf2803c], [19.3, 0xe86a8a],
  [20, 0x1c2447], [22, 0x0a1026], [24, 0x0a1026],
];
function skyColorAt(hour) {
  const h = hour % 24;
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    const [h0, c0] = SKY_KEYS[i], [h1, c1] = SKY_KEYS[i + 1];
    if (h >= h0 && h <= h1) {
      const t = (h - h0) / (h1 - h0 || 1);
      return new THREE.Color(c0).lerp(new THREE.Color(c1), t);
    }
  }
  return new THREE.Color(0x87b5d6);
}
function sunsetFactor(h) {
  if (h < 17 || h >= 20) return 0;
  if (h < 18.33) return (h - 17) / 1.33;
  return 1 - (h - 18.33) / 1.67;
}
export function updateDayNight(G, dt) {
  const prevHour = G.timeOfDay;
  G.timeOfDay = (G.timeOfDay + (dt * 24) / 480) % 24;
  if (G.timeOfDay < prevHour) G.day = (G.day || 1) + 1;
  const h = G.timeOfDay;
  const sky = skyColorAt(h);
  G.scene.background.copy(sky);
  G.scene.fog.color.copy(sky);
  const isNight = h < 6 || h >= 20;
  const isDay = h >= 7 && h <= 17.5;
  const set = sunsetFactor(h);
  const ang = ((h - 6) / 12) * Math.PI;
  const p = G.player.pos;
  const elev = Math.max(Math.sin(ang), 0.07);
  const sunDir = new THREE.Vector3(Math.cos(ang), elev, 0.36).normalize();
  G.lights.sun.position.set(p.x + sunDir.x * 220, sunDir.y * 220 + 20, p.z + sunDir.z * 220);
  G.lights.sun.target.position.set(p.x, 0, p.z);
  G.lights.sun.intensity = isDay ? 2.2 : isNight ? 0 : 1.2 + set * 0.5;
  G.lights.sun.color.setHex(0xfff2d8).lerp(new THREE.Color(0xff8f3d), set);
  G.lights.hemi.intensity = isNight ? 0.35 : isDay ? 1.6 : 1.1;
  G.lights.moon.intensity = isNight ? 0.5 : 0;
  G.lights.moon.position.set(p.x - 100, 160, p.z - 80);
  G.lights.moon.target.position.set(p.x, 0, p.z);
  if (G._sunGlow) {
    G._sunGlow.position.set(p.x + sunDir.x * 420, 55 + sunDir.y * 160, p.z + sunDir.z * 420);
    G._sunGlow.material.opacity = isNight ? 0 : 0.22 + set * 0.68;
    const s = 180 + set * 170;
    G._sunGlow.scale.set(s, s, 1);
  }
  const nightF = isNight ? 1 : isDay ? 0 : 0.6;
  if (G._moonGlow) {
    G._moonGlow.position.set(p.x - 260, 190, p.z - 200);
    G._moonGlow.material.opacity = nightF * 0.5;
  }
  if (G._stars) {
    G._stars.material.opacity = nightF * 0.9;
    G._stars.position.set(p.x, 0, p.z);
  }
  if (G._clouds) {
    const dim = isNight ? 0.32 : isDay ? 1 : 0.68;
    for (const c of G._clouds) {
      c.sprite.position.x += c.drift * dt;
      if (c.sprite.position.x > 460) c.sprite.position.x = -460;
      c.sprite.material.opacity = c.baseOp * dim;
    }
  }
  if (G._nightF === undefined || Math.abs(nightF - G._nightF) > 0.02) {
    G._nightF = nightF;
    for (const m of G.city.lampHeads) m.color.setHex(nightF > 0.5 ? 0xffe9a0 : 0x8a8a7a);
    for (const m of G.city.neonMats) m.color.setScalar(nightF > 0 ? 1 : 0.35);
    if (G.city.neonHalos) {
      for (const m of G.city.neonHalos) m.opacity = 0.12 + nightF * 0.5;
    }
    G.scene.traverse((o) => {
      if (o.material && o.material.emissiveMap && o.material.emissiveIntensity !== undefined) {
        o.material.emissiveIntensity = 0.12 + nightF * 0.55;
      }
    });
  }
  if (G.playerCar) {
    const on = isNight || G.lightsOn || h > 18.5;
    for (const b of G.playerCar.beams) b.intensity = on ? 60 : 0;
  }
  if (G.city.ferris) G.city.ferris.rotation.z += dt * 0.15;
  return isNight;
}
export function createEffects(G) {
  const bursts = [];
  const eff = {
    bursts,
    burst(x, y, z, color, n) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(n * 3);
      const vel = [];
      for (let i = 0; i < n; i++) {
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        vel.push([G.rng.range(-1, 1), G.rng.range(0.5, 2), G.rng.range(-1, 1)]);
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ color, size: 0.9, transparent: true, opacity: 1 });
      const pts = new THREE.Points(geo, mat);
      G.scene.add(pts);
      bursts.push({ pts, vel, life: 0.9 });
    },
    smoke(car) {
      const mat = new THREE.SpriteMaterial({ color: 0x555555, transparent: true, opacity: 0.5 });
      const s = new THREE.Sprite(mat);
      s.scale.set(2, 2, 1);
      car.group.add(s);
      s.position.set(0, 1.6, -2);
      return s;
    },
    update(dt) {
      for (const b of [...bursts]) {
        b.life -= dt;
        const arr = b.pts.geometry.attributes.position.array;
        for (let i = 0; i < b.vel.length; i++) {
          arr[i * 3] += b.vel[i][0] * dt * 6;
          arr[i * 3 + 1] += b.vel[i][1] * dt * 4;
          arr[i * 3 + 2] += b.vel[i][2] * dt * 6;
        }
        b.pts.geometry.attributes.position.needsUpdate = true;
        b.pts.material.opacity = Math.max(0, b.life);
        if (b.life <= 0) { G.scene.remove(b.pts); bursts.splice(bursts.indexOf(b), 1); }
      }
    },
  };
  G.effects = eff;
  return eff;
}
