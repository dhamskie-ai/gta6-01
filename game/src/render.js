// Renderer: scene, lights, warm sunset sky, sun glow, drifting clouds,
// fog, particles, explosions. Crisp output: pixel ratio capped at 2 and
// ACES filmic tone mapping so the golden hour reads warm, not washed out.
import * as THREE from 'three';

// Soft radial disc, drawn once on a canvas and reused for the sun glow,
// the neon halos and the cloud puffs.
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

export function createRender(G, opts = {}) {
  const lowFx = !!opts.lowFx;
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowFx });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
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
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a5240, 1.15);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x8aa8ff, 0);
  scene.add(moon); scene.add(moon.target);
  // Big warm glow that rides with the sun and swells at golden hour.
  const glowTex = glowTexture('rgba(255, 190, 110, 1)', 'rgba(255, 120, 60, 0)');
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, transparent: true, opacity: 0.22, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  sunGlow.scale.set(180, 180, 1);
  scene.add(sunGlow);
  // Nine slow cloud puffs high above the city.
  const cloudTex = glowTexture('rgba(255, 255, 255, 0.85)', 'rgba(255, 255, 255, 0)');
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const puff = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cloudTex, transparent: true, opacity: 0.5, depthWrite: false,
    }));
    const w = 90 + G.rng.range(0, 90);
    puff.scale.set(w, w * 0.36, 1);
    puff.position.set(G.rng.range(-420, 420), G.rng.range(110, 170), G.rng.range(-320, 320));
    scene.add(puff);
    clouds.push({ sprite: puff, drift: G.rng.range(1.2, 3.2) });
  }
  G.renderer = renderer; G.scene = scene; G.camera = camera;
  G.lights = { sun, hemi, moon };
  G._sunGlow = sunGlow;
  G._clouds = clouds;
  return { renderer, scene, camera };
}

// Golden-hour ramp: pale blue mid-afternoon, gold, then orange, then a
// pink dusk before the night keys take over.
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

// How deep into sunset we are: 0 at 17:00, 1 at 18:20, back to 0 by 20:00.
function sunsetFactor(h) {
  if (h < 17 || h >= 20) return 0;
  if (h < 18.33) return (h - 17) / 1.33;
  return 1 - (h - 18.33) / 1.67;
}

export function updateDayNight(G, dt) {
  const prevHour = G.timeOfDay;
  G.timeOfDay = (G.timeOfDay + (dt * 24) / 480) % 24;
  if (G.timeOfDay < prevHour) G.day = (G.day || 1) + 1; // midnight wrapped
  const h = G.timeOfDay;
  const sky = skyColorAt(h);
  G.scene.background.copy(sky);
  G.scene.fog.color.copy(sky);
  const isNight = h < 6 || h >= 20; // night starts when the sky key turns dark
  const isDay = h >= 7 && h <= 17.5;
  const set = sunsetFactor(h);
  // Sun position arcs across the sky. Elevation is clamped just above the
  // horizon: a sun below the ground plane lights nothing from above and
  // turns every sunset scene pitch black.
  const ang = ((h - 6) / 12) * Math.PI;
  const p = G.player.pos;
  const elev = Math.max(Math.sin(ang), 0.07);
  const sunDir = new THREE.Vector3(Math.cos(ang), elev, 0.36).normalize();
  G.lights.sun.position.set(p.x + sunDir.x * 220, sunDir.y * 220 + 20, p.z + sunDir.z * 220);
  G.lights.sun.target.position.set(p.x, 0, p.z);
  G.lights.sun.intensity = isDay ? 2.2 : isNight ? 0 : 1.2 + set * 0.5;
  G.lights.sun.color.setHex(0xfff2d8).lerp(new THREE.Color(0xff8f3d), set);
  // Fill is deliberately strong: with ACES tone mapping, shadowed faces
  // read near-black at the plan's 1.15, so day fill is 1.5 instead.
  G.lights.hemi.intensity = isNight ? 0.35 : isDay ? 1.5 : 1.1;
  G.lights.moon.intensity = isNight ? 0.5 : 0;
  G.lights.moon.position.set(p.x - 100, 160, p.z - 80);
  G.lights.moon.target.position.set(p.x, 0, p.z);
  // Sun glow tracks the sun far from the player; it swells and warms at dusk.
  if (G._sunGlow) {
    G._sunGlow.position.set(p.x + sunDir.x * 420, 55 + sunDir.y * 160, p.z + sunDir.z * 420);
    G._sunGlow.material.opacity = isNight ? 0 : 0.22 + set * 0.68;
    const s = 180 + set * 170;
    G._sunGlow.scale.set(s, s, 1);
  }
  // Clouds drift and thin out after dark.
  if (G._clouds) {
    const cloudOp = isNight ? 0.16 : isDay ? 0.5 : 0.34;
    for (const c of G._clouds) {
      c.sprite.position.x += c.drift * dt;
      if (c.sprite.position.x > 460) c.sprite.position.x = -460;
      c.sprite.material.opacity = cloudOp;
    }
  }
  // Lamps + neon glow at night (only re-apply when the factor moves).
  const nightF = isNight ? 1 : isDay ? 0 : 0.6;
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
  // Headlights at night — and from dusk onward, when the light goes low.
  if (G.playerCar) {
    const on = isNight || G.lightsOn || h > 18.5;
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
