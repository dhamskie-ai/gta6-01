// Scene, sky, lights, day-night cycle, particles, skid marks.
import * as THREE from 'three';
import { CFG } from './config.js';

export function createRenderer(G) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: G.canvas });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

export function createScene(G) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b8e0);
  scene.fog = new THREE.Fog(0x9fc0dd, 120, 480);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 600;
  scene.add(sun);
  scene.add(sun.target);
  const moon = new THREE.DirectionalLight(0x8aa8ff, 0.25);
  moon.position.set(-80, 120, -60);
  scene.add(moon);
  G.sun = sun; G.hemi = hemi; G.moon = moon;
  // Sky dome: gradient via vertex colors on a big sphere.
  const skyGeo = new THREE.SphereGeometry(700, 16, 12);
  const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true, fog: false });
  const pos = skyGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i) / 700);
    const c = new THREE.Color().lerpColors(new THREE.Color(0xffe0a8), new THREE.Color(0x3a7bd8), t);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.name = 'sky';
  scene.add(sky);
  G.sky = sky;
  // Sun disc + moon disc.
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(22, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false }));
  sunDisc.name = 'sunDisc';
  scene.add(sunDisc);
  G.sunDisc = sunDisc;
  return scene;
}

// Hour 0-24 -> lighting. Called every frame; cheap lerps only.
export function updateDayNight(G, dt) {
  G.timeOfDay = (G.timeOfDay + (dt / CFG.dayLengthSec) * 24) % 24;
  const h = G.timeOfDay;
  const dayF = smoothDay(h);
  const duskF = Math.max(0, 1 - Math.abs(h - 18.5) / 1.5);
  const nightF = 1 - dayF;
  const sun = G.sun;
  const ang = ((h - 6) / 12) * Math.PI;
  sun.position.set(Math.cos(ang) * 200, Math.sin(ang) * 180 + 10, 120);
  sun.intensity = 0.15 + dayF * 2.1;
  sun.color.setHSL(0.09 + duskF * 0.02, 0.7, 0.72 - duskF * 0.15);
  G.hemi.intensity = 0.25 + dayF * 0.65;
  G.moon.intensity = nightF * 0.35;
  const skyTop = new THREE.Color().lerpColors(new THREE.Color(0x0a1030), new THREE.Color(0x3a7bd8), dayF);
  const skyBot = new THREE.Color().lerpColors(new THREE.Color(0x1a2040), new THREE.Color(0xffe0a8), dayF);
  if (duskF > 0) {
    skyBot.lerp(new THREE.Color(0xff8a4a), duskF * 0.6);
    skyTop.lerp(new THREE.Color(0x6a3a6a), duskF * 0.4);
  }
  const pos = G.sky.geometry.attributes.position;
  const colors = G.sky.geometry.attributes.color;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i) / 700);
    const c = new THREE.Color().lerpColors(skyBot, skyTop, t);
    colors.setXYZ(i, c.r, c.g, c.b);
  }
  colors.needsUpdate = true;
  G.scene.background = skyTop.clone().lerp(skyBot, 0.5);
  G.scene.fog.color.copy(G.scene.background);
  G.scene.fog.near = 120 + dayF * 60;
  G.isNight = nightF > 0.5;
  // Sun disc follows the sun.
  const sd = G.sunDisc;
  sd.position.copy(sun.position).normalize().multiplyScalar(650);
  sd.lookAt(G.camera.position);
  sd.material.color.setHex(duskF > 0.4 ? 0xff9a4a : 0xfff6c8);
  // Neon + lamps glow at night.
  for (const s of G.neonSigns || []) s.material.opacity = 1;
  G.nightF = nightF;
  G.dayF = dayF;
}

function smoothDay(h) {
  // 1 at noon, 0 at midnight, smooth at dawn/dusk.
  const t = Math.sin(((h - 6) / 24) * Math.PI * 2);
  return THREE.MathUtils.clamp(t * 1.4, 0, 1);
}

// Simple particle pool for smoke, sparks, muzzle puffs, explosions.
export function createParticles(G) {
  const max = 300;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(max * 3);
  const colors = new Float32Array(max * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({ size: 1.4, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  G.scene.add(points);
  G.particles = { points, max, items: [], positions, colors };
}

export function spawnParticles(G, pos, color, count, spread = 3, up = 4, life = 0.8) {
  const P = G.particles;
  for (let i = 0; i < count; i++) {
    if (P.items.length >= P.max) P.items.shift();
    P.items.push({
      x: pos.x, y: pos.y, z: pos.z,
      vx: (G.rng.next() - 0.5) * spread, vy: G.rng.next() * up, vz: (G.rng.next() - 0.5) * spread,
      life, maxLife: life,
      r: ((color >> 16) & 255) / 255, g: ((color >> 8) & 255) / 255, b: (color & 255) / 255,
    });
  }
}

export function updateParticles(G, dt) {
  const P = G.particles;
  for (let i = P.items.length - 1; i >= 0; i--) {
    const p = P.items[i];
    p.life -= dt;
    if (p.life <= 0) { P.items.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.vy -= 6 * dt;
  }
  const pos = P.positions, col = P.colors;
  for (let i = 0; i < P.max; i++) {
    const p = P.items[i];
    if (p) {
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      const f = p.life / p.maxLife;
      col[i * 3] = p.r * f; col[i * 3 + 1] = p.g * f; col[i * 3 + 2] = p.b * f;
    } else {
      pos[i * 3 + 1] = -100;
      col[i * 3] = 0; col[i * 3 + 1] = 0; col[i * 3 + 2] = 0;
    }
  }
  P.points.geometry.attributes.position.needsUpdate = true;
  P.points.geometry.attributes.color.needsUpdate = true;
}
