import * as THREE from 'three';
import { CFG } from './config.js';
import { collideCircle } from './city.js';
import { isDown, wasPressed, consumeMouse, consumeWheel } from './input.js';

export function createPersonMesh(colors) {
  const grp = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.68, 0.3), mat(colors.shirt));
  torso.position.y = 1.06; torso.castShadow = true; grp.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), mat(colors.skin));
  head.position.y = 1.62; head.castShadow = true; grp.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.34), mat(colors.hair || 0x1c1410));
  hair.position.y = 1.8; grp.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.22), mat(colors.pants));
  legL.geometry.translate(0, -0.36, 0);
  legL.position.set(-0.13, 0.72, 0); grp.add(legL);
  const legR = legL.clone(); legR.position.x = 0.13; grp.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.18), mat(colors.shirt));
  armL.geometry.translate(0, -0.31, 0);
  armL.position.set(-0.35, 1.36, 0); grp.add(armL);
  const armR = armL.clone(); armR.position.x = 0.35; grp.add(armR);
  grp.userData = { legL, legR, armL, armR, torso, head };
  return grp;
}

export function createPlayerMesh() {
  const grp = createPersonMesh({ shirt: 0x1f7a6e, pants: 0x2e3440, skin: 0xc98d64, hair: 0x14100c });
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.36),
    new THREE.MeshLambertMaterial({ color: 0xff2e7e }));
  cap.position.y = 1.86; grp.add(cap);
  return grp;
}

export function placePlayer(G, x, z, heading) {
  G.player.x = x; G.player.z = z; G.player.y = 0; G.player.vy = 0;
  G.player.heading = heading !== undefined ? heading : 0;
  G.player.camYaw = heading !== undefined ? heading : 0;
  G.player.mesh.position.set(x, 0, z);
  G.player.mesh.rotation.y = G.player.heading;
}

export function updateOnFoot(G, input, dt) {
  const p = G.player;
  const { dx, dy } = consumeMouse(input);
  p.camYaw -= dx * 0.0028;
  p.camPitch = Math.max(-0.45, Math.min(0.55, p.camPitch + dy * 0.0022));
  const wheel = consumeWheel(input);
  if (wheel !== 0) p.camDist = Math.max(4, Math.min(12, p.camDist + Math.sign(wheel) * 1.2));
  if (wasPressed(input, 'KeyC')) p.camDist = p.camDist > 7 ? 5.5 : 10;

  const fwd = (isDown(input, 'KeyW') || isDown(input, 'ArrowUp') ? 1 : 0)
    - (isDown(input, 'KeyS') || isDown(input, 'ArrowDown') ? 1 : 0);
  const strafe = (isDown(input, 'KeyD') || isDown(input, 'ArrowRight') ? 1 : 0)
    - (isDown(input, 'KeyA') || isDown(input, 'ArrowLeft') ? 1 : 0);
  const running = isDown(input, 'ShiftLeft') || isDown(input, 'ShiftRight');
  const speed = running ? CFG.runSpeed : CFG.walkSpeed;
  const len = Math.hypot(fwd, strafe) || 1;
  const mx = (Math.sin(p.camYaw) * fwd + Math.cos(p.camYaw) * strafe) / len;
  const mz = (Math.cos(p.camYaw) * fwd - Math.sin(p.camYaw) * strafe) / len;
  const moving = fwd !== 0 || strafe !== 0;
  let nx = p.x + mx * speed * dt * (moving ? 1 : 0);
  let nz = p.z + mz * speed * dt * (moving ? 1 : 0);
  const fixed = collideCircle(G.city, nx, nz, 0.55);
  nx = fixed.x; nz = fixed.z;
  p.x = nx; p.z = nz;
  if (moving) p.heading = Math.atan2(mx, mz);
  if (wasPressed(input, 'Space') && p.onGround) { p.vy = CFG.jumpSpeed; p.onGround = false; }
  p.vy -= CFG.gravity * dt;
  p.y += p.vy * dt;
  if (p.y <= 0) { p.y = 0; p.vy = 0; p.onGround = true; }
  p.walkPhase += dt * (moving ? speed * 1.6 : 0);
  const swing = moving ? Math.sin(p.walkPhase) * 0.6 : 0;
  const u = p.mesh.userData;
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.75;
  u.armR.rotation.x = swing * 0.75;
  p.mesh.position.set(p.x, p.y, p.z);
  p.mesh.rotation.y = p.heading;
  G.audio.engine(false, 0);
}

export function syncPlayerToCar(G) {
  if (!G.car) return;
  G.player.x = G.car.x;
  G.player.z = G.car.z;
  G.player.heading = G.car.heading;
  G.player.mesh.position.set(G.car.x, 0, G.car.z);
}

export function updateCamera(G, dt) {
  const W = G.W;
  const cam = W.camera;
  const p = G.player;
  const snap = G.shotMode ? 1 : 0;
  if (G.inCar && G.car) {
    const car = G.car;
    const back = 8.5 + Math.abs(car.speed) * 0.06;
    const cy = 3.4 + Math.abs(car.speed) * 0.015;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    const tx = car.x - fx * back, tz = car.z - fz * back;
    const k = snap || Math.min(1, dt * 5);
    cam.position.x += (tx - cam.position.x) * k;
    cam.position.y += (cy - cam.position.y) * k;
    cam.position.z += (tz - cam.position.z) * k;
    cam.lookAt(car.x + fx * 6, 1.4, car.z + fz * 6);
    p.camYaw = car.heading;
    return;
  }
  const d = p.camDist;
  const cx = p.x - Math.sin(p.camYaw) * Math.cos(p.camPitch) * d;
  const cz = p.z - Math.cos(p.camYaw) * Math.cos(p.camPitch) * d;
  const cy = p.y + 1.7 + Math.sin(p.camPitch) * d + 0.6;
  const k2 = snap || Math.min(1, dt * 10);
  cam.position.x += (cx - cam.position.x) * k2;
  cam.position.y += (cy - cam.position.y) * k2;
  cam.position.z += (cz - cam.position.z) * k2;
  cam.lookAt(p.x, p.y + 1.5, p.z);
}
