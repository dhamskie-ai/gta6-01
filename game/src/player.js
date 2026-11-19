// SOLARA BAY — the on-foot character: detailed low-poly person meshes,
// walking/jumping, and the third-person chase camera.
// Round 6f: people are real articulated figures — hair or hat, jacketed
// torso with a belt, arms with sleeves, trousers, shoes — with skin-tone
// and outfit variation, so pedestrians read as people, not blurry boxes.
import * as THREE from 'three';
import { CFG } from './config.js';
import { collideCircle } from './city.js';
import { isDown, wasPressed, consumeMouse, consumeWheel } from './input.js';

const SKINS = [0xe8b88a, 0xc98a5e, 0x8a5a34, 0xf2c9a0, 0x6e4426];
const SHIRTS = [0xff2e7e, 0x2e8fd2, 0xe8b93a, 0x3a9e4f, 0x8a5fd2, 0xff8f3d, 0xe8e8e8, 0x37e0ff, 0xd23c2e];
const PANTS = [0x22303f, 0x3a3f45, 0x5a4a3a, 0x2a4a6b, 0x6b2a3a];
const HAIRS = [0x14100c, 0x3a2418, 0x6b6b6b, 0x8a5a2a, 0xd2b48c];

function lam(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function limb(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// colours: { skin, shirt, pants, hair, hat } — all optional.
export function createPersonMesh(colors) {
  const c = colors || {};
  const skin = c.skin !== undefined ? c.skin : SKINS[Math.floor(Math.random() * SKINS.length)];
  const shirt = c.shirt !== undefined ? c.shirt : SHIRTS[Math.floor(Math.random() * SHIRTS.length)];
  const pants = c.pants !== undefined ? c.pants : PANTS[Math.floor(Math.random() * PANTS.length)];
  const hair = c.hair !== undefined ? c.hair : HAIRS[Math.floor(Math.random() * HAIRS.length)];
  const group = new THREE.Group();
  const skinMat = lam(skin), shirtMat = lam(shirt), pantsMat = lam(pants), hairMat = lam(hair);
  // Legs (trousers) + shoes.
  const legL = limb(0.2, 0.78, 0.24, pantsMat, -0.13, 0.39, 0);
  const legR = limb(0.2, 0.78, 0.24, pantsMat, 0.13, 0.39, 0);
  const shoeL = limb(0.22, 0.1, 0.36, lam(0x1a1a1a), -0.13, 0.05, 0.05);
  const shoeR = limb(0.22, 0.1, 0.36, lam(0x1a1a1a), 0.13, 0.05, 0.05);
  legL.add(shoeL); shoeL.position.set(0, -0.36, 0.05);
  legR.add(shoeR); shoeR.position.set(0, -0.36, 0.05);
  // Torso: jacket + belt stripe + collar.
  const body = limb(0.56, 0.68, 0.32, shirtMat, 0, 1.12, 0);
  const belt = limb(0.58, 0.09, 0.34, lam(0x14181f), 0, 0.8, 0);
  const collar = limb(0.4, 0.08, 0.34, lam(0xffffff), 0, 1.44, 0);
  body.add(belt); belt.position.set(0, -0.3, 0);
  body.add(collar); collar.position.set(0, 0.34, 0);
  // Arms with sleeves + hands.
  const armL = limb(0.16, 0.62, 0.2, shirtMat, -0.37, 1.16, 0);
  const armR = limb(0.16, 0.62, 0.2, shirtMat, 0.37, 1.16, 0);
  const handL = limb(0.15, 0.14, 0.18, skinMat, -0.37, 0.82, 0);
  const handR = limb(0.15, 0.14, 0.18, skinMat, 0.37, 0.82, 0);
  // Head + hair cap (+ optional hat brim).
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.32), skinMat);
  head.position.set(0, 1.66, 0);
  head.castShadow = true;
  const hairM = limb(0.36, 0.14, 0.34, hairMat, 0, 1.88, 0);
  const hairBack = limb(0.36, 0.2, 0.08, hairMat, 0, 1.78, -0.15);
  group.add(legL); group.add(legR); group.add(body);
  group.add(armL); group.add(armR); group.add(handL); group.add(handR);
  group.add(head); group.add(hairM); group.add(hairBack);
  if (c.hat) {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.1, 10), lam(c.hat));
    hat.position.set(0, 1.96, 0);
    group.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 10), lam(c.hat));
    brim.position.set(0, 1.91, 0);
    group.add(brim);
  }
  group.userData.parts = { legL, legR, armL, armR, handL, handR, head, body };
  return group;
}

export function createPlayerMesh() {
  // Nico: red jacket, dark jeans, dark hair — the player is unmistakable.
  return createPersonMesh({ skin: 0xe8b88a, shirt: 0xd21f4e, pants: 0x22303f, hair: 0x14100c });
}

export function placePlayer(G, x, z, heading) {
  G.player.x = x; G.player.z = z;
  G.player.heading = heading !== undefined ? heading : 0;
  G.player.vy = 0; G.player.y = 0;
  G.player.mesh.position.set(x, 0, z);
  G.player.mesh.rotation.y = heading !== undefined ? heading : 0;
}

export function updateOnFoot(G, input, dt) {
  const p = G.player;
  const run = isDown(input, 'ShiftLeft') || isDown(input, 'ShiftRight');
  const speed = run ? CFG.runSpeed : CFG.walkSpeed;
  const fwd = (isDown(input, 'KeyW') || isDown(input, 'ArrowUp') ? 1 : 0)
    - (isDown(input, 'KeyS') || isDown(input, 'ArrowDown') ? 1 : 0);
  const strafe = (isDown(input, 'KeyD') || isDown(input, 'ArrowRight') ? 1 : 0)
    - (isDown(input, 'KeyA') || isDown(input, 'ArrowLeft') ? 1 : 0);
  const mouse = consumeMouse(input);
  p.camYaw -= mouse.dx * 0.0032;
  p.camPitch = Math.max(-0.4, Math.min(0.55, p.camPitch + mouse.dy * 0.0024));
  const wheel = consumeWheel(input);
  if (wheel !== 0) p.camDist = Math.max(4, Math.min(14, p.camDist + Math.sign(wheel)));
  if (wasPressed(input, 'KeyC')) p.camDist = p.camDist > 8 ? 5.5 : 10;
  const sin = Math.sin(p.camYaw), cos = Math.cos(p.camYaw);
  let mx = (-sin * fwd + cos * strafe);
  let mz = (-cos * fwd - sin * strafe);
  const ml = Math.hypot(mx, mz);
  if (ml > 0.01) { mx /= ml; mz /= ml; }
  const nx = p.x + mx * speed * dt;
  const nz = p.z + mz * speed * dt;
  if (!collideCircle(G.city, nx, nz, 0.55)) { p.x = nx; p.z = nz; }
  else if (!collideCircle(G.city, nx, p.z, 0.55)) { p.x = nx; }
  else if (!collideCircle(G.city, p.x, nz, 0.55)) { p.z = nz; }
  if (ml > 0.01) p.heading = Math.atan2(mx, mz);
  // Jump + gravity.
  if (wasPressed(input, 'Space') && p.y <= 0.01) p.vy = CFG.jumpSpeed;
  p.vy -= CFG.gravity * dt;
  p.y += p.vy * dt;
  if (p.y < 0) { p.y = 0; p.vy = 0; }
  // Procedural walk swing.
  p.walkPhase += dt * (ml > 0.01 ? speed * 1.6 : 0);
  const parts = p.mesh.userData.parts;
  const swing = ml > 0.01 ? Math.sin(p.walkPhase) * (run ? 0.75 : 0.55) : 0;
  parts.legL.rotation.x = swing;
  parts.legR.rotation.x = -swing;
  parts.armL.rotation.x = -swing * 0.8;
  parts.armR.rotation.x = swing * 0.8;
  parts.body.position.y = 1.12 + Math.abs(Math.sin(p.walkPhase)) * 0.05;
  p.mesh.position.set(p.x, p.y, p.z);
  p.mesh.rotation.y = p.heading;
  // Sun coin pickup.
  for (const c of G.city.coins) {
    if (!c.taken && Math.hypot(p.x - c.x, p.z - c.z) < 1.6) {
      c.taken = true;
      c.mesh.visible = false;
      G.cash += 50;
      G.coinsGot = (G.coinsGot || 0) + 1;
      G.audio.coin();
    }
  }
}

export function syncPlayerToCar(G) {
  const p = G.player;
  if (!G.car) return;
  p.x = G.car.x; p.z = G.car.z;
  p.mesh.position.set(p.x, -2, p.z);
  p.mesh.visible = false;
  p.heading = G.car.heading;
}

export function updateCamera(G, dt) {
  const W = G.W;
  const p = G.player;
  if (G.inCar && G.car) {
    const c = G.car;
    const back = 9.5 + Math.abs(c.speed) * 0.06;
    const tx = c.x - Math.sin(c.heading) * back;
    const tz = c.z - Math.cos(c.heading) * back;
    const ty = 4.2 + Math.abs(c.speed) * 0.02;
    W.camera.position.x += (tx - W.camera.position.x) * Math.min(1, dt * 5);
    W.camera.position.y += (ty - W.camera.position.y) * Math.min(1, dt * 5);
    W.camera.position.z += (tz - W.camera.position.z) * Math.min(1, dt * 5);
    W.camera.lookAt(c.x + Math.sin(c.heading) * 6, 1.6, c.z + Math.cos(c.heading) * 6);
  } else {
    const d = p.camDist;
    const cx = p.x + Math.sin(p.camYaw) * d * Math.cos(p.camPitch);
    const cz = p.z + Math.cos(p.camYaw) * d * Math.cos(p.camPitch);
    const cy = 2.2 + Math.sin(p.camPitch) * d + 1.4;
    W.camera.position.x += (cx - W.camera.position.x) * Math.min(1, dt * 10);
    W.camera.position.y += (cy - W.camera.position.y) * Math.min(1, dt * 10);
    W.camera.position.z += (cz - W.camera.position.z) * Math.min(1, dt * 10);
    W.camera.lookAt(p.x, 1.7 + p.y, p.z);
  }
}
