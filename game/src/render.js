// Renderer: sunset sky, sun glow, clouds, night stars, camera, particles.
import * as THREE from 'three';
import { clamp, lerp } from './random.js';

const SKY = [
  [5, 0x0e1a2e, 0x0e1a2e], [7, 0x7a9ac2, 0x9ab2c2], [12, 0x7ec8e8, 0xbfe3ea],
  [16, 0x9ec8e8, 0xcfe0e8], [17.5, 0xffc46a, 0xff9a5c], [18.35, 0xff7e6a, 0xff5f9e],
  [19.2, 0xc25a8a, 0x5a3a7a], [20, 0x1a2340, 0x1a2340], [24, 0x0a1024, 0x0a1024],
];
function skyAt(h) {
  let a = SKY[0], b = SKY[SKY.length - 1];
  for (let i = 0; i < SKY.length - 1; i++) if (h >= SKY[i][0] && h <= SKY[i + 1][0]) { a = SKY[i]; b = SKY[i + 1]; break; }
  const t = clamp((h - a[0]) / Math.max(0.01, b[0] - a[0]), 0, 1);
  return { top: new THREE.Color(a[1]).lerp(new THREE.Color(b[1]), t), fog: new THREE.Color(a[2]).lerp(new THREE.Color(b[2]), t) };
}
function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  gr.addColorStop(0, 'rgba(255,220,150,1)'); gr.addColorStop(0.4, 'rgba(255,150,90,0.55)'); gr.addColorStop(1, 'rgba(255,120,80,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createRender(G) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.domElement.className = 'game';
  document.getElementById('app').prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xff9a5c, 240, 820);
  G.scene = scene; G.renderer = renderer;
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1200);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a4a3a, 1.5); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
  sun.shadow.camera.far = 400;
  scene.add(sun); scene.add(sun.target);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, opacity: 0.8, depthWrite: false }));
  glow.scale.set(320, 320, 1); scene.add(glow);
  // clouds
  const cloudTex = glowTex();
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
    s.position.set((Math.random() - 0.5) * 700, 110 + Math.random() * 60, (Math.random() - 0.5) * 700);
    s.scale.set(90 + Math.random() * 120, 26 + Math.random() * 22, 1);
    scene.add(s); clouds.push(s);
  }
  // night stars + moon
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(240 * 3);
  for (let i = 0; i < 240; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 + 0.15, r = 700;
    starPos[i * 3] = Math.cos(a) * Math.cos(e) * r; starPos[i * 3 + 1] = Math.sin(e) * r; starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, transparent: true, opacity: 0 }));
  scene.add(stars);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xe8ecff, transparent: true, opacity: 0 }));
  moon.scale.set(60, 60, 1); scene.add(moon);
  // mission beacon
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  scene.add(beacon);
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.3, 16), new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.8 }));
  scene.add(marker);
  // particles
  const PMAX = 420;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(PMAX * 3);
  const pCol = new Float32Array(PMAX * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.5, vertexColors: true, transparent: true, opacity: 0.95 }));
  points.frustumCulled = false; scene.add(points);
  const parts = [];
  function burst(x, y, z, color, n) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n && parts.length < PMAX; i++) {
      parts.push({ x, y, z, vx: (Math.random() - 0.5) * 7, vy: Math.random() * 5 + 1, vz: (Math.random() - 0.5) * 7, life: 0.7, r: c.r, g: c.g, b: c.b });
    }
  }
  // tracers
  const tracers = [];
  function tracer(x1, y1, z1, x2, y2, z2) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.9 }));
    scene.add(line); tracers.push({ line, life: 0.09 });
  }
  // headlights
  const head = new THREE.SpotLight(0xfff2c0, 0, 60, 0.5, 0.4);
  scene.add(head); scene.add(head.target);
  let camPos = new THREE.Vector3(0, 6, 42);
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  return {
    renderer, scene, camera, burst, tracer,
    setShotMode() { renderer.setPixelRatio(3); },
    setQuality(q) {
      const cap = { Low: 1, Medium: 1.5, High: 2, Ultra: 2 }[q] || 1.5;
      renderer.setPixelRatio(Math.min(devicePixelRatio, cap));
      renderer.shadowMap.enabled = q !== 'Low';
    },
    update(dt, t) {
      const h = G.timeOfDay;
      const sky = skyAt(h);
      scene.background = sky.top;
      scene.fog.color.copy(sky.fog);
      const sunset = clamp(1 - Math.abs(h - 18.35) / 1.6, 0, 1);
      const nightF = clamp(h >= 20 || h < 5 ? 1 : h >= 19.2 ? (h - 19.2) / 0.8 : h < 5 ? 1 : 0, 0, 1);
      G.nightF = nightF;
      const sunA = ((h - 6) / 13.5) * Math.PI; // rises 06:00, sets ~19:30
      const sd = new THREE.Vector3(Math.cos(sunA), Math.sin(sunA) * 0.9 + 0.08, 0.35).normalize();
      const px = G.player.x, pz = G.player.z;
      sun.position.set(px + sd.x * 160, Math.max(20, sd.y * 160), pz + sd.z * 160);
      sun.target.position.set(px, 0, pz);
      sun.color.setHex(0xffffff).lerp(new THREE.Color(0xff8f3d), sunset * 0.8);
      sun.intensity = lerp(0.6, 2.4, clamp(sd.y * 1.6 + 0.4, 0, 1));
      hemi.intensity = lerp(0.65, 1.6, clamp(sd.y * 1.6 + 0.4, 0, 1));
      glow.position.set(px + sd.x * 420, Math.max(30, sd.y * 300), pz + sd.z * 420);
      glow.material.opacity = h > 6 && h < 20 ? 0.22 + sunset * 0.68 : 0;
      glow.material.color.setHex(0xffd28a).lerp(new THREE.Color(0xff7e6a), sunset);
      for (const c of clouds) { c.position.x += dt * 1.2; if (c.position.x > 380) c.position.x = -380; c.material.opacity = 0.5 - nightF * 0.34; c.material.color.setHex(0xffffff).lerp(new THREE.Color(0xff9a7a), sunset * 0.7); }
      stars.material.opacity = nightF * 0.9;
      stars.position.set(px, 0, pz);
      moon.material.opacity = nightF * 0.9;
      moon.position.set(px - 260, 260, pz - 300);
      // beacon + marker on the mission target
      const tgt = G.missions?.target?.();
      const showBeacon = !!tgt && G.phase === 'play' && !G.freeRoam;
      beacon.visible = showBeacon; marker.visible = showBeacon;
      if (showBeacon) {
        beacon.position.set(tgt.x, 30, tgt.z);
        beacon.material.opacity = 0.25 + Math.sin(t * 4) * 0.12;
        marker.position.set(tgt.x, 0.4, tgt.z);
      }
      // headlights at night when driving
      if (G.car && nightF > 0.3) {
        head.intensity = 90 * nightF;
        head.position.set(G.car.x, 1.2, G.car.z);
        head.target.position.set(G.car.x + Math.sin(G.car.heading) * 20, 0, G.car.z + Math.cos(G.car.heading) * 20);
      } else head.intensity = 0;
      // particles
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.life -= dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 9 * dt;
      }
      for (let i = 0; i < PMAX; i++) {
        const p = parts[i];
        pPos[i * 3] = p ? p.x : 0; pPos[i * 3 + 1] = p ? p.y : -99; pPos[i * 3 + 2] = p ? p.z : 0;
        pCol[i * 3] = p ? p.r : 0; pCol[i * 3 + 1] = p ? p.g : 0; pCol[i * 3 + 2] = p ? p.b : 0;
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;
      for (let i = tracers.length - 1; i >= 0; i--) {
        const tr = tracers[i]; tr.life -= dt;
        if (tr.life <= 0) { scene.remove(tr.line); tracers.splice(i, 1); }
      }
      // camera: chase behind player / car
      const inCar = !!G.car;
      const cx = inCar ? G.car.x : G.player.x, cz = inCar ? G.car.z : G.player.z;
      const cy = inCar ? 0 : G.player.y;
      const yaw = inCar ? G.car.heading : G.player.camYaw;
      const pitch = inCar ? 0.3 : G.player.camPitch;
      const dist = inCar ? 9.5 : G.player.camDist;
      const want = new THREE.Vector3(
        cx - Math.sin(yaw) * Math.cos(pitch) * dist,
        cy + 2.4 + Math.sin(pitch) * dist + (inCar ? 1.4 : 0),
        cz - Math.cos(yaw) * Math.cos(pitch) * dist);
      camPos.lerp(want, Math.min(1, dt * 7));
      camera.position.copy(camPos);
      camera.lookAt(cx, cy + 1.6, cz);
      renderer.render(scene, camera);
    },
  };
}
