// Ro Mendez on foot + third-person chase camera.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { collideBuildings } from './city.js';

export function createPlayerMesh(G) {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2e6f8e });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a077 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.32), jacket);
  body.position.y = 1.1; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.7; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.38), new THREE.MeshLambertMaterial({ color: 0x1a1210 }));
  hair.position.y = 1.9; g.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), pants);
  legL.position.set(-0.15, 0.38, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.15; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.17), jacket);
  armL.position.set(-0.37, 1.1, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.37; g.add(armR);
  // Pistol in the right hand when armed.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.42), new THREE.MeshLambertMaterial({ color: 0x14161a }));
  gun.position.set(0.37, 0.82, 0.22); gun.name = 'gun'; gun.visible = false; g.add(gun);
  g.position.copy(G.player.pos);
  G.scene.add(g);
  G.playerMesh = g;
  G.playerParts = { legL, legR, armL, armR, gun };
  return g;
}

export function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  const { dx, dy } = input.consumeMouse();
  G.camYaw -= dx * 0.0032;
  G.camPitch = Math.max(-0.4, Math.min(0.7, G.camPitch + dy * 0.0022));
  if (input.wheel) G.camDist = Math.max(4, Math.min(12, G.camDist + input.wheel * 0.01));
  if (input.wasPressed('KeyC')) G.camDist = G.camDist > 7 ? 5 : 9;

  const run = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = run ? CONFIG.runSpeed : CONFIG.walkSpeed;
  let mx = 0, mz = 0;
  if (input.down('KeyW') || input.down('ArrowUp')) mz += 1;
  if (input.down('KeyS') || input.down('ArrowDown')) mz -= 1;
  if (input.down('KeyA') || input.down('ArrowLeft')) mx -= 1;
  if (input.down('KeyD') || input.down('ArrowRight')) mx += 1;
  const moving = mx !== 0 || mz !== 0;
  if (moving) {
    const len = Math.hypot(mx, mz); mx /= len; mz /= len;
    const sy = Math.sin(G.camYaw), cy = Math.cos(G.camYaw);
    const wx = (mx * cy + mz * sy) * speed * dt;
    const wz = (-mx * sy + mz * cy) * speed * dt;
    const res = collideBuildings(G, p.pos.x + wx, p.pos.z + wz, 0.6);
    p.pos.x = res.x; p.pos.z = res.z;
    p.yaw = Math.atan2(wx, wz);
    p.walkPhase += dt * (run ? 13 : 9);
  }
  // Jump + gravity.
  if (input.wasPressed('Space') && p.pos.y <= 0.01) p.vy = CONFIG.jumpSpeed;
  p.vy -= CONFIG.gravity * dt;
  p.pos.y += p.vy * dt;
  if (p.pos.y < 0) { p.pos.y = 0; p.vy = 0; }
  const parts = G.playerParts;
  const swing = moving ? Math.sin(p.walkPhase) * 0.55 : 0;
  parts.legL.rotation.x = swing; parts.legR.rotation.x = -swing;
  parts.armL.rotation.x = -swing * 0.7; parts.armR.rotation.x = swing * 0.7;
  parts.gun.visible = p.weapon === 1;
  G.playerMesh.position.copy(p.pos);
  G.playerMesh.rotation.y = p.yaw;
  G.audio.setEngine(0, false);
}

// Chase camera: behind the player (or car), smoothed, mouse orbit.
export function updateCamera(G, dt) {
  const p = G.player;
  const input = G.input;
  if (G.playerCar) {
    const { dx, dy } = input.consumeMouse();
    G.camYaw -= dx * 0.0032;
    G.camPitch = Math.max(-0.2, Math.min(0.6, G.camPitch + dy * 0.0022));
    if (input.wheel) G.camDist = Math.max(6, Math.min(16, G.camDist + input.wheel * 0.01));
    if (input.wasPressed('KeyC')) G.camDist = G.camDist > 10 ? 7 : 13;
    // Auto-align behind the car when driving without mouse input.
    if (Math.abs(dx) < 0.5 && Math.abs(G.playerCar.speed) > 3) {
      let target = G.playerCar.yaw + Math.PI;
      let diff = target - G.camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      G.camYaw += diff * Math.min(1, dt * 1.2);
    }
  }
  const dist = G.playerCar ? G.camDist + 4 : G.camDist;
  const height = 2.6 + G.camPitch * 6 + (G.playerCar ? 1.6 : 0);
  const cx = p.pos.x + Math.sin(G.camYaw) * dist;
  const cz = p.pos.z + Math.cos(G.camYaw) * dist;
  const tx = p.pos.x, tz = p.pos.z, ty = p.pos.y + 1.6;
  G.camera.position.x += (cx - G.camera.position.x) * Math.min(1, dt * 8);
  G.camera.position.y += (height - G.camera.position.y) * Math.min(1, dt * 8);
  G.camera.position.z += (cz - G.camera.position.z) * Math.min(1, dt * 8);
  G.camera.lookAt(tx, ty, tz);
}
