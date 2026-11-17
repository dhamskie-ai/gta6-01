// Ro Mendez on foot: movement, jump, camera, enter/exit cars.
import * as THREE from 'three';
import { CFG } from './config.js';
import { collideBuildings, clampToCity } from './city.js';
import { makePedModel } from './traffic.js';
import { nearestCar, stealCar, exitCar } from './vehicles.js';

export function createPlayer(G) {
  const mesh = makePedModel(G.rng);
  // Ro: red jacket, dark jeans.
  mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0xc82828 });
  mesh.position.set(0, 0, 20);
  G.scene.add(mesh);
  G.player.mesh = mesh;
  G.player.pos = mesh.position;
  G.player.yaw = Math.PI;
  G.player.camYaw = Math.PI;
  G.player.camPitch = 0.25;
  G.player.camDist = 8;
  G.player.vy = 0;
  G.player.grounded = true;
  G.player.onFoot = true;
}

export function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  const run = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = run ? CFG.runSpeed : CFG.walkSpeed;
  const ax = input.axis();
  const sin = Math.sin(p.camYaw), cos = Math.cos(p.camYaw);
  let mx = 0, mz = 0;
  if (ax.z !== 0) { mx += -sin * -ax.z; mz += -cos * -ax.z; }
  if (ax.x !== 0) { mx += cos * ax.x; mz += -sin * ax.x; }
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len; mz /= len;
    p.pos.x += mx * speed * dt;
    p.pos.z += mz * speed * dt;
    p.yaw = Math.atan2(-mx, -mz);
    p.walkPhase = (p.walkPhase || 0) + dt * speed * 1.6;
  }
  // Jump + gravity.
  if (input.pressed('Space') && p.grounded) {
    p.vy = CFG.jumpSpeed;
    p.grounded = false;
  }
  if (!p.grounded) {
    p.vy -= CFG.gravity * dt;
    p.pos.y += p.vy * dt;
    if (p.pos.y <= 0) { p.pos.y = 0; p.vy = 0; p.grounded = true; }
  }
  clampToCity(p.pos, 2);
  collideBuildings(G, p.pos, 0.6);
  // Walk swing.
  const swing = len > 0.01 ? Math.sin(p.walkPhase || 0) * 0.55 : 0;
  p.mesh.userData.legL.rotation.x = swing;
  p.mesh.userData.legR.rotation.x = -swing;
  p.mesh.userData.armL.rotation.x = -swing * 0.7;
  p.mesh.userData.armR.rotation.x = swing * 0.7;
  p.mesh.rotation.y = p.yaw;
  // Steal / enter a car with E.
  if (input.pressed('KeyE')) {
    const car = nearestCar(G, p.pos, 5);
    if (car) {
      stealCar(G, car);
      G.hud.setPrompt('');
    } else {
      const npc = nearestTalkNpc(G, p.pos, 4);
      if (npc) G.missions.talkToNpc(G, npc);
    }
  }
}

export function nearestTalkNpc(G, pos, maxDist) {
  for (const npc of G.talkNpcs || []) {
    const dx = npc.mesh.position.x - pos.x;
    const dz = npc.mesh.position.z - pos.z;
    if (Math.hypot(dx, dz) < maxDist) return npc;
  }
  return null;
}

// Third-person chase camera: mouse orbits, wheel zooms, C toggles distance.
export function updateCamera(G, dt) {
  const input = G.input;
  const p = G.player;
  p.camYaw -= input.mouseDX * 0.0032;
  p.camPitch = THREE.MathUtils.clamp(p.camPitch + input.mouseDY * 0.0022, -0.1, 1.1);
  if (input.wheel !== 0) p.camDist = THREE.MathUtils.clamp(p.camDist + input.wheel * 0.01, 5, 14);
  if (input.pressed('KeyC')) p.camDist = p.camDist < 10 ? 13 : 7;
  const anchor = p.car ? p.car.mesh.position : p.pos;
  const ay = p.car ? 1.6 : 1.9;
  const dist = p.camDist;
  const cx = anchor.x + Math.sin(p.camYaw) * Math.cos(p.camPitch) * dist;
  const cz = anchor.z + Math.cos(p.camYaw) * Math.cos(p.camPitch) * dist;
  const cy = anchor.y + ay + Math.sin(p.camPitch) * dist;
  const cam = G.camera;
  cam.position.set(cx, cy, cz);
  cam.lookAt(anchor.x, anchor.y + ay * 0.6, anchor.z);
  // Keep the camera out of buildings (simple: raise it).
  if (cam.position.y < 1.2) cam.position.y = 1.2;
}

export function exitVehicleKey(G) {
  if (G.player.car && G.input.pressed('KeyE')) {
    exitCar(G);
    G.audio?.blip(330, 0.08, 'sine', 0.1);
  }
}
