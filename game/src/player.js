// Nico on foot + driving, chase camera, enter/exit cars.
import * as THREE from 'three';
import { CFG } from './config.js';
import { isCarObj, updateCarPhysics } from './vehicles.js';
import { makePersonMesh, collideCircle } from './city.js';
import { keyDown, keyPressed } from './input.js';
import { sfx, toggleMute } from './audio.js';

export function driveCarRef(G) {
  const c = G.player.car;
  return isCarObj(c) ? c : null;
}
export function initPlayer(G) {
  G.player = {
    x: CFG.startPos[0], z: CFG.startPos[1], heading: 0, vy: 0, grounded: true,
    car: null, weapon: 0, ammo: [Infinity, 72, 150], speed: 0, mesh: null,
  };
  const mesh = makePersonMesh(0xc98a5e, 0xc22030, 0x2c3242, 0x1e3a5e);
  mesh.position.set(G.player.x, 0, G.player.z);
  G.scene.add(mesh);
  G.player.mesh = mesh;
  G.camYaw = 0; G.camPitch = -0.22; G.camDist = 9;
}
export function teleportPlayer(G, x, z, heading) {
  G.player.x = x; G.player.z = z;
  if (heading !== undefined) G.player.heading = heading;
  G.player.vy = 0;
  if (G.player.mesh) G.player.mesh.position.set(x, 0, z);
}
export function forceDrive(G, car) {
  if (!isCarObj(car)) return;
  G.player.car = car;
  car.driver = 'player';
  G.player.mesh.visible = false;
}
function nearestCar(G, maxD) {
  let best = null, bd = maxD;
  for (const c of G.cars) {
    if (!isCarObj(c)) continue;
    const d = Math.hypot(c.x - G.player.x, c.z - G.player.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
export function enterCar(G, car) {
  if (!isCarObj(car)) return false;
  if (car.driver && car.driver !== 'player') {
    // Driver becomes a fleeing pedestrian; stealing in front of police is hot.
    const p = { g: null, x: car.x, z: car.z, heading: car.heading, speed: 4.2, tx: car.x + 20, tz: car.z + 20, anchor: null, fleeT: 3, walkT: 0, state: 'flee' };
    const mesh = makePersonMesh(0x8a5a3a, 0x2e6fd8, 0x2c3242, 0);
    mesh.position.set(car.x + 2, 0, car.z + 2);
    G.scene.add(mesh);
    p.g = mesh;
    p.g.userData = mesh.userData;
    G.peds.push(p);
  }
  car.driver = 'player';
  G.player.car = car;
  car.parked = false;
  car.traffic = false;
  G.player.mesh.visible = false;
  G.stats.stolen++;
  return true;
}
export function exitCar(G) {
  const car = driveCarRef(G);
  if (!car) return;
  const a = car.heading + Math.PI / 2;
  const x = car.x + Math.sin(a) * 2.2, z = car.z + Math.cos(a) * 2.2;
  car.speed = 0;
  G.player.car = null;
  G.player.x = x; G.player.z = z;
  G.player.heading = car.heading;
  G.player.mesh.visible = true;
  G.player.mesh.position.set(x, 0, z);
}
export function updatePlayer(G, dt) {
  const P = G.player;
  const car = driveCarRef(G);
  // Camera orbit from mouse / touch drag.
  G.camYaw -= G.mouseDX * 0.0035;
  G.camPitch = Math.max(-0.9, Math.min(0.25, G.camPitch + G.mouseDY * 0.0028));
  if (keyPressed(G, 'KeyC')) G.camDist = G.camDist === 9 ? 7 : G.camDist === 7 ? 13 : 9;
  if (keyPressed(G, 'KeyM')) toggleMute(G);
  if (keyPressed(G, 'KeyH') && car) sfx(G, 'horn');
  if (car) {
    const joyF = G.joy.y !== 0 ? -G.joy.y : 0;
    const joyS = G.joy.x !== 0 ? G.joy.x : 0;
    const input = {
      fwd: keyDown(G, 'KeyW') || keyDown(G, 'ArrowUp') || joyF > 0.25,
      back: keyDown(G, 'KeyS') || keyDown(G, 'ArrowDown') || joyF < -0.25,
      steer: (keyDown(G, 'KeyA') || keyDown(G, 'ArrowLeft') ? -1 : 0) + (keyDown(G, 'KeyD') || keyDown(G, 'ArrowRight') ? 1 : 0) + joyS,
      handbrake: keyDown(G, 'ShiftLeft') || keyDown(G, 'ShiftRight'),
    };
    input.steer = Math.max(-1, Math.min(1, input.steer));
    updateCarPhysics(G, car, dt, input);
    P.x = car.x; P.z = car.z; P.heading = car.heading; P.speed = car.speed;
    if (input.handbrake && Math.abs(car.speed) > 10) sfx(G, 'skid');
    if (keyPressed(G, 'KeyE')) exitCar(G);
    return;
  }
  // On foot.
  let mx = 0, mz = 0;
  if (keyDown(G, 'KeyW') || keyDown(G, 'ArrowUp')) mz += 1;
  if (keyDown(G, 'KeyS') || keyDown(G, 'ArrowDown')) mz -= 1;
  if (keyDown(G, 'KeyA') || keyDown(G, 'ArrowLeft')) mx -= 1;
  if (keyDown(G, 'KeyD') || keyDown(G, 'ArrowRight')) mx += 1;
  mx += G.joy.x; mz += -G.joy.y;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const run = keyDown(G, 'ShiftLeft') || keyDown(G, 'ShiftRight');
  const speed = run ? CFG.run : CFG.walk;
  const sy = Math.sin(G.camYaw), cy = Math.cos(G.camYaw);
  const vx = (mx * cy + mz * sy) * speed;
  const vz = (-mx * sy + mz * cy) * speed;
  const nx = P.x + vx * dt, nz = P.z + vz * dt;
  if (!collideCircle(G, nx, P.z, 0.5)) P.x = nx;
  if (!collideCircle(G, P.x, nz, 0.5)) P.z = nz;
  P.speed = len > 0.05 ? speed : 0;
  if (len > 0.05) P.heading = Math.atan2(vx, vz);
  if (keyPressed(G, 'Space') && P.grounded) { P.vy = CFG.jump; P.grounded = false; }
  if (!P.grounded) {
    P.vy -= CFG.grav * dt;
    P.mesh.position.y += P.vy * dt;
    if (P.mesh.position.y <= 0) { P.mesh.position.y = 0; P.vy = 0; P.grounded = true; }
  }
  P.mesh.position.set(P.x, P.mesh.position.y, P.z);
  P.mesh.rotation.y = P.heading;
  const swing = Math.sin(G.elapsed * 9) * (P.speed > 0 ? 0.5 : 0);
  const u = P.mesh.userData;
  if (u.legL) { u.legL.rotation.x = swing; u.legR.rotation.x = -swing; u.armL.rotation.x = -swing; u.armR.rotation.x = swing; }
  if (keyPressed(G, 'KeyE')) {
    if (G.talkAvailable) return; // missions talk takes priority over entering a car
    const c = nearestCar(G, 3.5);
    if (c) {
      const wasMine = c.driver === 'player'; // re-entering your own car is not a new theft
      enterCar(G, c);
      if (!wasMine) {
        G.addWanted(1);
        G.centerMsg('Mobil dicuri — PCPD mengejar!', 2.5);
      }
    }
  }
}
export function updateCamera(G) {
  if (G.shotCam) {
    G.camera.position.set(G.shotCam.pos[0], G.shotCam.pos[1], G.shotCam.pos[2]);
    G.camera.lookAt(G.shotCam.look[0], G.shotCam.look[1], G.shotCam.look[2]);
    return;
  }
  const P = G.player;
  const tx = P.x, ty = 1.8, tz = P.z;
  const yaw = G.camYaw, pitch = G.camPitch, d = G.camDist;
  const cx = tx - Math.sin(yaw) * Math.cos(pitch) * d;
  const cz = tz - Math.cos(yaw) * Math.cos(pitch) * d;
  const cy = ty - Math.sin(pitch) * d;
  G.camera.position.set(cx, Math.max(cy, 0.6), cz);
  G.camera.lookAt(tx, ty, tz);
}
