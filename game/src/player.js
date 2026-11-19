// Karakter jalan kaki Nico + kamera third-person.
import { CONFIG } from './config.js';
import { clamp } from './random.js';

export function createPlayerMesh(THREE) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2e7d8a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.0, 0.38), shirt);
  body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skin);
  head.position.y = 1.8; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.56),
    new THREE.MeshLambertMaterial({ color: 0xff2e7e }));
  cap.position.y = 2.0; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.24), pants);
  legL.position.set(-0.17, 0.42, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.17; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.8, 0.18), shirt);
  armL.position.set(-0.44, 1.05, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.44; g.add(armR);
  g.userData = { legL, legR, armL, armR, body };
  return g;
}

export function createMarcoMesh(THREE) {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x1f6f5c });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.05, 0.4), jacket);
  body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), skin);
  head.position.y = 1.82; g.add(head);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.12, 10),
    new THREE.MeshLambertMaterial({ color: 0xf2ede2 }));
  hat.position.y = 2.02; g.add(hat);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.24),
    new THREE.MeshLambertMaterial({ color: 0x3a2f28 }));
  legL.position.set(-0.17, 0.42, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.17; g.add(legR);
  return g;
}

export function updatePlayer(G, dt, input, city) {
  const p = G.player;
  if (p.inCar) return;
  const run = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const sp = run ? CONFIG.runSpeed : CONFIG.walkSpeed;
  let mx = 0, mz = 0;
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) mz += 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) mz -= 1;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) mx -= 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) mx += 1;
  const len = Math.hypot(mx, mz) || 1;
  mx /= len; mz /= len;
  const cy = p.camYaw;
  const wx = (Math.sin(cy) * mz + Math.cos(cy) * mx) * sp;
  const wz = (Math.cos(cy) * mz - Math.sin(cy) * mx) * sp;
  const nx = p.x + wx * dt, nz = p.z + wz * dt;
  if (!city.collide(nx, p.z, 0.6)) p.x = nx;
  if (!city.collide(p.x, nz, 0.6)) p.z = nz;
  if (mx !== 0 || mz !== 0) {
    p.yaw = Math.atan2(wx, wz);
    p.walkPhase += dt * sp * 1.6;
  }
  if (input.keys.has('Space') && p.y <= 0.01) p.vy = CONFIG.jumpSpeed;
  p.vy -= CONFIG.gravity * dt;
  p.y += p.vy * dt;
  if (p.y <= 0) { p.y = 0; p.vy = 0; }
  p.mesh.position.set(p.x, p.y, p.z);
  p.mesh.rotation.y = p.yaw;
  const sw = Math.sin(p.walkPhase) * 0.6;
  p.mesh.userData.legL.rotation.x = sw;
  p.mesh.userData.legR.rotation.x = -sw;
  p.mesh.userData.armL.rotation.x = -sw * 0.8;
  p.mesh.userData.armR.rotation.x = sw * 0.8;
  // kamera: mouse orbit + scroll/C zoom
  p.camYaw -= input.mouseDX * 0.0032;
  p.camPitch = clamp(p.camPitch + input.mouseDY * 0.0022, -0.15, 0.9);
  p.camDist = clamp(p.camDist + input.wheel * 0.004, 4, 13);
  if (input.keys.has('KeyC') && !p._cHeld) { p.camDist = p.camDist > 8 ? 5 : 11; p._cHeld = true; }
  if (!input.keys.has('KeyC')) p._cHeld = false;
}

export function updateCamera(G, camera) {
  const p = G.player;
  let tx, tz, ty, lookX, lookZ, lookY;
  if (p.inCar && G.playerCar) {
    const car = G.playerCar;
    const yaw = car.yaw + p.camYawOffset;
    const d = p.camDist + 2.5;
    tx = car.x - Math.sin(yaw) * d; tz = car.z - Math.cos(yaw) * d; ty = 3.4 + p.camPitch * 4;
    lookX = car.x + Math.sin(car.yaw) * 8; lookZ = car.z + Math.cos(car.yaw) * 8; lookY = 1.4;
  } else {
    const d = p.camDist;
    tx = p.x - Math.sin(p.camYaw) * Math.cos(p.camPitch) * d;
    tz = p.z - Math.cos(p.camYaw) * Math.cos(p.camPitch) * d;
    ty = p.y + 2.1 + Math.sin(p.camPitch) * d;
    lookX = p.x; lookZ = p.z; lookY = p.y + 1.5;
  }
  camera.position.set(tx, Math.max(ty, 0.6), tz);
  camera.lookAt(lookX, lookY, lookZ);
}
