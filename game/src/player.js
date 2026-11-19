// Nico on foot: WASD + Shift run + Space jump, E enter/exit car, steal
// (driver pulled out), third-person chase camera (mouse orbit, C zoom,
// touch drag). driveCarRef() is the ONLY way gameplay reads the driven
// car, and it refuses anything that is not a real car object.
import * as THREE from 'three';
import { G, CFG } from './config.js';
import { keys, pressed, mouse, touch, axis } from './input.js';
import { isCarObj, nearestCar, updateCarPhysics } from './vehicles.js';
import { collideCircle } from './city.js';
import { sfx } from './audio.js';
import { onInteract } from './missions.js';
import { setWanted } from './police.js';
import { spawnPed } from './traffic.js';

let mesh = null, legL = null, legR = null, armL = null, armR = null;

export function driveCarRef() {
  const c = G.player.car;
  if (!c || typeof c !== 'object' || typeof c.speed !== 'number' || !c.group) return null;
  return c;
}

export function initPlayer() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xc22030 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.34), jacket);
  body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xc98a5e }));
  head.position.y = 1.68; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.12, 10),
    new THREE.MeshLambertMaterial({ color: 0x1e3a5e }));
  cap.position.y = 1.86; g.add(cap);
  const legM = new THREE.MeshLambertMaterial({ color: 0x2c3242 });
  legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.22), legM);
  legL.position.set(0, 0.3, 0.14); g.add(legL);
  legR = legL.clone(); legR.position.z = -0.14; g.add(legR);
  const armM = new THREE.MeshLambertMaterial({ color: 0xc22030 });
  armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), armM);
  armL.position.set(0, 1.05, 0.3); g.add(armL);
  armR = armL.clone(); armR.position.z = -0.3; g.add(armR);
  g.position.copy(G.player.pos);
  G.scene.add(g); mesh = g;
}

export function enterCar(car) {
  if (!isCarObj(car)) return false;
  if (car.driver) {
    // pull the driver out: he becomes a fleeing pedestrian
    car.driver = false;
    const d = spawnPed(car.x + 2, car.z + 2, {});
    d.flee = 4;
    if (G.wanted < 5) setWanted(G.wanted + 1, 'steal');
  }
  G.player.car = car; G.player.onFoot = false; car.stolen = true;
  G.stats.stolen++;
  mesh.visible = false;
  sfx.click();
  return true;
}

export function exitCar() {
  const car = driveCarRef();
  G.player.onFoot = true;
  if (car) {
    const a = car.heading + Math.PI / 2;
    G.player.pos.set(car.x + Math.sin(a) * 2.2, 0, car.z + Math.cos(a) * 2.2);
    G.player.heading = car.heading;
    G.player.car = null;
  }
  mesh.visible = true;
  mesh.position.copy(G.player.pos);
}

// Shot staging helpers: put Nico in a car (or on foot) without the
// steal/wanted side effects of the gameplay path.
export function forceDrive(car, speed) {
  if (!isCarObj(car)) return false;
  G.player.car = car; G.player.onFoot = false;
  car.stolen = true; car.speed = speed || 0;
  G.player.pos.set(car.x, 0, car.z);
  G.player.heading = car.heading;
  mesh.visible = false;
  return true;
}

export function teleportPlayer(x, z, heading) {
  if (driveCarRef()) exitCar();
  G.player.pos.set(x, 0, z);
  G.player.heading = heading ?? 0;
  G.player.car = null; G.player.onFoot = true;
  mesh.visible = true;
  mesh.position.copy(G.player.pos);
}

export function updatePlayer(dt) {
  const P = G.player;
  const car = driveCarRef(); // guarded: null unless a real car object
  if (pressed.KeyE || touch.enter) {
    if (car) exitCar();
    else if (G.interact) onInteract();
    else {
      const near = nearestCar(P.pos.x, P.pos.z, 4.5);
      if (near) enterCar(near);
    }
  }
  if (pressed.KeyH) sfx.horn();
  if (pressed.KeyM) { import('./hud.js').then((h) => h.toggleMuteBtn()); }
  const a = axis();
  if (car) {
    // driving: car is a proven object here; physics guards again inside.
    const ctl = {
      throttle: a.f,
      steer: -a.s,
      brake: !!(keys.KeyS && a.f < 0) || keys.Space || touch.brake,
      hand: keys.ShiftLeft || keys.ShiftRight,
    };
    if (Math.abs(car.speed) > 18 && Math.abs(a.s) > 0.7) sfx.skid();
    updateCarPhysics(car, dt, ctl);
    P.pos.set(car.x, 0, car.z);
    P.heading = car.heading;
    P.speed = Math.abs(car.speed);
    G.stats.distance += Math.abs(car.speed) * dt;
    if (pressed.KeyC) G.camDist = G.camDist > 10 ? 7 : 13;
  } else {
    const run = keys.ShiftLeft || keys.ShiftRight;
    const sp = (run ? CFG.run : CFG.walk) * (a.f !== 0 || a.s !== 0 ? 1 : 0);
    const camA = G.camYaw;
    const fx = Math.sin(camA), fz = Math.cos(camA);
    let mx = (fx * a.f + fz * a.s), mz = (fz * a.f - fx * a.s);
    const ml = Math.hypot(mx, mz);
    if (ml > 0.01) {
      mx /= ml; mz /= ml;
      const nx = P.pos.x + mx * sp * dt, nz = P.pos.z + mz * sp * dt;
      if (!collideCircle(nx, nz, 0.6)) { P.pos.x = nx; P.pos.z = nz; }
      P.heading = Math.atan2(mx, mz);
      P.speed = sp;
      G.stats.distance += sp * dt;
    } else P.speed = 0;
    if (pressed.Space && P.grounded) { P.vy = CFG.jump; P.grounded = false; }
    if (!P.grounded) {
      P.vy -= CFG.grav * dt;
      P.pos.y += P.vy * dt;
      if (P.pos.y <= 0) { P.pos.y = 0; P.vy = 0; P.grounded = true; }
    }
    mesh.visible = true;
    mesh.position.copy(P.pos);
    mesh.rotation.y = P.heading;
    const sw = Math.sin(G.elapsed * 11) * 0.55 * Math.min(1, P.speed / 6);
    legL.rotation.x = sw; legR.rotation.x = -sw;
    armL.rotation.x = -sw * 0.8; armR.rotation.x = sw * 0.8;
  }
  // camera orbit: mouse (pointer lock) or touch drag
  G.camYaw -= (mouse.dx * 0.0032 + touch.camDX * 0.006);
  G.camPitch = Math.max(-1.1, Math.min(0.45, G.camPitch + mouse.dy * 0.0022 + touch.camDY * 0.005));
  updateCamera(dt);
}

export function updateCamera(dt) {
  const P = G.player;
  const car = driveCarRef();
  const target = car ? new THREE.Vector3(car.x, 1.6, car.z) : new THREE.Vector3(P.pos.x, 1.7, P.pos.z);
  const yaw = car ? car.heading : G.camYaw;
  const pitch = car ? -0.3 : G.camPitch;
  const dist = G.camDist + (car ? 3 : 0);
  const cx = target.x - Math.sin(yaw) * Math.cos(pitch) * dist;
  const cz = target.z - Math.cos(yaw) * Math.cos(pitch) * dist;
  const cy = target.y - Math.sin(pitch) * dist + 1.2;
  G.camera.position.lerp(new THREE.Vector3(cx, Math.max(1.2, cy), cz), Math.min(1, dt * 10));
  G.camera.lookAt(target);
}
