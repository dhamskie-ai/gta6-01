// Nico jalan kaki + kamera third-person + masuk/keluar mobil.
import * as THREE from 'three';
import { G, CFG } from './config.js';
import { clamp } from './random.js';
import { axis, wasPressed } from './input.js';
import { nearestVehicle, enterCar, exitCar, updatePlayerCar } from './vehicles.js';
import { playBlip } from './audio.js';
let armL, armR, legL, legR, body;
export function buildPlayer() {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0xff5da2 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe0ac69 });
  body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), shirt); body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skin); head.position.y = 1.72; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.44), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  cap.position.y = 1.94; g.add(cap);
  armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), skin); armL.position.set(-0.42, 1.05, 0); g.add(armL);
  armR = armL.clone(); armR.position.x = 0.42; g.add(armR);
  legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.22), pants); legL.position.set(-0.16, 0.38, 0); g.add(legL);
  legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  G.scene.add(g);
  G.player.mesh = g;
  return g;
}
export function updatePlayer(dt) {
  const p = G.player;
  const a = axis();
  if (G.car) {
    updatePlayerCar(dt, a.f, a.s);
    if (wasPressed('KeyE') || G.touch.enterPressed) { G.touch.enterPressed = false; exitCar(); playBlip(520); }
    p.mesh.visible = false;
    updateCamera(dt);
    return;
  }
  p.mesh.visible = true;
  // Arah gerak relatif kamera: W = menjauhi kamera.
  const run = G.keys.ShiftLeft || G.keys.ShiftRight;
  const speed = run ? CFG.runSpeed : CFG.walkSpeed;
  const cy = G.camYaw;
  const fx = Math.sin(cy), fz = Math.cos(cy);
  const rx = Math.cos(cy), rz = -Math.sin(cy);
  let mx = fx * a.f + rx * a.s, mz = fz * a.f + rz * a.s;
  const ml = Math.hypot(mx, mz);
  if (ml > 0.01) {
    mx /= ml; mz /= ml;
    p.yaw = Math.atan2(mx, mz);
    p.x += mx * speed * dt; p.z += mz * speed * dt;
    p.speed = speed;
    const ph = G.time * (run ? 13 : 9);
    legL.rotation.x = Math.sin(ph) * 0.7; legR.rotation.x = -Math.sin(ph) * 0.7;
    armL.rotation.x = -Math.sin(ph) * 0.5; armR.rotation.x = Math.sin(ph) * 0.5;
  } else {
    p.speed = 0;
    legL.rotation.x *= 0.8; legR.rotation.x *= 0.8; armL.rotation.x *= 0.8; armR.rotation.x *= 0.8;
  }
  if (wasPressed('Space') && p.onGround) { p.vy = CFG.jumpV; p.onGround = false; }
  if (!p.onGround) {
    p.vy -= 22 * dt; p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.onGround = true; }
  }
  // Tabrakan gedung (lingkaran vs AABB).
  for (const c of G.city.colliders) {
    if (p.x > c.x0 - 0.5 && p.x < c.x1 + 0.5 && p.z > c.z0 - 0.5 && p.z < c.z1 + 0.5) {
      const dxl = p.x - (c.x0 - 0.5), dxr = (c.x1 + 0.5) - p.x, dzl = p.z - (c.z0 - 0.5), dzr = (c.z1 + 0.5) - p.z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) p.x = c.x0 - 0.5; else if (m === dxr) p.x = c.x1 + 0.5;
      else if (m === dzl) p.z = c.z0 - 0.5; else p.z = c.z1 + 0.5;
    }
  }
  // Tabrakan mobil: pemain tidak bisa jalan menembus mobil (berhenti di sisinya).
  for (const v of G.vehicles) {
    const dx = p.x - v.x, dz = p.z - v.z, d = Math.hypot(dx, dz);
    if (d < 2.6 && d > 0.01) { p.x = v.x + (dx / d) * 2.6; p.z = v.z + (dz / d) * 2.6; }
  }
  p.x = clamp(p.x, -296, 296); p.z = clamp(p.z, -296, 296);
  p.mesh.position.set(p.x, p.y, p.z);
  p.mesh.rotation.y = p.yaw;
  // Interaksi: E masuk mobil terdekat. Tekan selalu dikonsumsi (tap tanpa
  // mobil di dekatnya tidak boleh nyangkut dan masuk mobil belakangan).
  const near = nearestVehicle(p.x, p.z, 5);
  G._nearCar = near;
  if (wasPressed('KeyE') || G.touch.enterPressed) {
    G.touch.enterPressed = false;
    if (near) { enterCar(near); playBlip(660); }
  }
  updateCamera(dt);
}
export function updateCamera(dt) {
  const p = G.player;
  const cy = G.camYaw;
  const tx = p.x - Math.sin(cy) * G.camDist;
  const tz = p.z - Math.cos(cy) * G.camDist;
  const ty = (G.car ? 4.2 : 3.2) + p.y;
  G.camera.position.x += (tx - G.camera.position.x) * Math.min(1, dt * 8);
  G.camera.position.y += (ty - G.camera.position.y) * Math.min(1, dt * 8);
  G.camera.position.z += (tz - G.camera.position.z) * Math.min(1, dt * 8);
  G.camera.lookAt(p.x, 1.4 + p.y, p.z);
}
export function distToMissionCar() {
  const v = G.vehicles.find((x) => x.missionCar);
  if (!v) return 999;
  return Math.hypot(v.x - G.player.x, v.z - G.player.z);
}
