// Renderer: scene, lights, day–night sky, fog, particles, explosions.
import * as THREE from 'three';

export function createRender(G, opts = {}) {
  const lowFx = !!opts.lowFx;
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowFx });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = !lowFx;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    G.camera.aspect = innerWidth / innerHeight;
    G.camera.updateProjectionMatrix();
  });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d6);
  scene.fog = new THREE.Fog(0x9ab8cc, 180, 520);
  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 900);
  camera.position.set(0, 8, -14);
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 500;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a5240, 0.9);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x8aa8ff, 0);
  scene.add(moon); scene.add(moon.target);
  G.renderer = renderer; G.scene = scene; G.camera = camera;
  G.lights = { sun, hemi, moon };
  return { renderer, scene, camera };
}

const SKY_KEYS = [
  [0, 0x0a1026], [5, 0x1a2440], [6.5, 0xf2a35e], [8, 0x87b5d6], [12, 0x7fb2e0],
  [17, 0x8fb8d8], [18.5, 0xf2803c], [20, 0x1c2447], [22, 0x0a1026], [24, 0x0a1026],
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

export function updateDayNight(G, dt) {
  G.timeOfDay = (G.timeOfDay + (dt * 24) / 480) % 24;
  const h = G.timeOfDay;
  const sky = skyColorAt(h);
  G.scene.background.copy(sky);
  G.scene.fog.color.copy(sky);
  const isNight = h < 6 || h > 19;
  const isDay = h >= 7 && h <= 17.5;
  // Sun position arcs across the sky.
  const ang = ((h - 6) / 12) * Math.PI;
  const p = G.player.pos;
  G.lights.sun.position.set(p.x + Math.cos(ang) * 220, Math.sin(ang) * 220 + 20, p.z + 80);
  G.lights.sun.target.position.set(p.x, 0, p.z);
  G.lights.sun.intensity = isDay ? 2.2 : isNight ? 0 : 1.2;
  G.lights.hemi.intensity = isNight ? 0.25 : 0.9;
  G.lights.moon.intensity = isNight ? 0.5 : 0;
  G.lights.moon.position.set(p.x - 100, 160, p.z - 80);
  G.lights.moon.target.position.set(p.x, 0, p.z);
  // Lamps + neon glow at night (only re-apply when the factor moves).
  const nightF = isNight ? 1 : isDay ? 0 : 0.6;
  if (G._nightF === undefined || Math.abs(nightF - G._nightF) > 0.02) {
    G._nightF = nightF;
    for (const m of G.city.lampHeads) m.color.setHex(nightF > 0.5 ? 0xffe9a0 : 0x8a8a7a);
    for (const m of G.city.neonMats) m.color.setScalar(nightF > 0 ? 1 : 0.35);
    G.scene.traverse((o) => {
      if (o.material && o.material.emissiveMap && o.material.emissiveIntensity !== undefined) {
        o.material.emissiveIntensity = 0.12 + nightF * 0.55;
      }
    });
  }
  // Headlights at night.
  if (G.playerCar) {
    const on = isNight || G.lightsOn;
    for (const b of G.playerCar.beams) b.intensity = on ? 60 : 0;
  }
  // Ferris wheel turns slowly.
  if (G.city.ferris) G.city.ferris.rotation.z += dt * 0.15;
  return isNight;
}

// Simple particle bursts (explosions, impacts) as point clouds.
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
      // Exhaust smoke marker: a fading sprite above the car, updated in main loop.
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
