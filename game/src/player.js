// Nico on foot: movement, jumping, camera, entering / stealing cars.
import * as THREE from 'three';
import { G, CFG, clamp, angLerp, dist2 } from './config.js';
import { collides } from './city.js';
import { isCarObj, updatePlayerCar, syncCarMesh } from './vehicles.js';

export function driveCarRef() {
  const c = G.player && G.player.car;
  return isCarObj(c) ? c : null;
}
export function createPlayer() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x27435e });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2a2d38 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a070 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), jacket);
  body.position.y = 1.05; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), skin);
  head.position.y = 1.62; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.36), new THREE.MeshLambertMaterial({ color: 0xff2e7e }));
  cap.position.y = 1.82; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), jeans);
  legL.position.set(-0.14, 0.31, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.14; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.18), jacket);
  armL.position.set(-0.36, 1.05, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.36; g.add(armR);
  g.position.set(CFG.spawnPos[0], 0, CFG.spawnPos[1]);
  G.scene.add(g);
  G.player = { group: g, legL, legR, armL, armR, x: CFG.spawnPos[0], z: CFG.spawnPos[1],
    heading: Math.PI, vy: 0, grounded: true, car: null, speed: 0, walkT: 0 };
  return G.player;
}
export function nearestCar(maxD = 5) {
  let best = null, bd = maxD;
  for (const c of [...G.cars, ...G.traffic]) {
    if (!isCarObj(c)) continue;
    const d = dist2(G.player.x, G.player.z, c.x, c.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
export function enterCar(car, audio) {
  const p = G.player;
  if (!isCarObj(car)) return false;
  if (car.driver === 'traffic') {
    // Pull the driver out: they flee on foot.
    const ped = { x: car.x + 2, z: car.z + 2, heading: 0, speed: 5, state: 'walk', tx: car.x + 20, tz: car.z + 20, color: 0xc03028, fleeT: 2 };
    G.peds.push(ped);
    car.driver = 'player';
  } else if (car.driver === 'parked' || car.driver === 'player') {
    car.driver = 'player';
  }
  const wasPlayerCar = car.isPlayerCar;
  car.isPlayerCar = true;
  p.car = car;
  p.x = car.x; p.z = car.z;
  p.group.visible = false;
  if (!wasPlayerCar) {
    G.stats.carsStolen++;
    if (G.wanted === 0 && nearestPolice(25)) { /* seen stealing */ }
    if (nearestPolice(30)) addWantedExternal(1);
  }
  if (audio) audio.engine(true, 0);
  return true;
}
export function exitCar() {
  const p = G.player;
  const car = driveCarRef();
  if (!car) return false;
  p.car = null;
  p.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.5;
  p.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.5;
  p.heading = car.heading;
  p.group.visible = true;
  p.group.position.set(p.x, 0, p.z);
  return true;
}
function nearestPolice(maxD) {
  for (const u of G.police) {
    if (dist2(G.player.x, G.player.z, u.x, u.z) < maxD) return u;
  }
  return null;
}
function addWantedExternal(n) {
  G.wanted = clamp(G.wanted + n, 0, 5);
  G.heat = 1; G.hiddenT = 0;
  G.stats.maxWanted = Math.max(G.stats.maxWanted, G.wanted);
}
export function updatePlayer(dt, input, audio) {
  const p = G.player;
  if (!p) return;
  const car = driveCarRef();
  if (car) {
    // Driving.
    const ax = input.axis();
    const tx = G.touch.active ? G.touch.moveX : 0;
    const ty = G.touch.active ? G.touch.moveY : 0;
    updatePlayerCar(car, dt, {
      y: ax.y || ty,
      x: -(ax.x || tx),
      brake: input.down('KeyS') && car.speed > 1,
      hand: input.down('ShiftLeft') || input.down('ShiftRight'),
    });
    p.x = car.x; p.z = car.z; p.speed = car.speed;
    p.heading = car.heading;
    if (audio) audio.engine(true, Math.abs(car.speed) / car.max);
    if (input.wasPressed('KeyE') || G.touchAct) {
      G.touchAct = false;
      exitCar();
      if (audio) audio.engine(false, 0);
    }
    if (input.wasPressed('KeyC')) G.camDist = G.camDist > 12 ? 7 : G.camDist + 3;
    updateCamera(dt, car);
    return;
  }
  // On foot.
  const ax = input.axis();
  const tx = G.touch.active ? G.touch.moveX : 0;
  const ty = G.touch.active ? G.touch.moveY : 0;
  const mx = ax.x || tx, my = ax.y || ty;
  const run = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = run ? CFG.runSpeed : CFG.walkSpeed;
  const camSin = Math.sin(G.camYaw), camCos = Math.cos(G.camYaw);
  const dx = (mx * camCos - my * camSin) * speed * dt;
  const dz = (mx * camSin + my * camCos) * speed * dt;
  const moving = Math.abs(mx) > 0.1 || Math.abs(my) > 0.1;
  if (moving) {
    p.heading = Math.atan2(dx, dz);
    const nx = p.x + dx, nz = p.z + dz;
    if (!collides(nx, p.z, 0.5)) p.x = nx;
    if (!collides(p.x, nz, 0.5)) p.z = nz;
    p.walkT += dt * (run ? 11 : 7);
    p.speed = speed;
  } else p.speed = 0;
  // Jump.
  if (input.wasPressed('Space') && p.grounded) { p.vy = CFG.jumpV; p.grounded = false; G.stats.jumps++; }
  if (!p.grounded) {
    p.vy -= 22 * dt;
    const y = p.group.position.y + p.vy * dt;
    if (y <= 0) { p.group.position.y = 0; p.vy = 0; p.grounded = true; }
    else p.group.position.y = y;
  }
  // Walk swing.
  const sw = moving ? Math.sin(p.walkT) * 0.55 : 0;
  p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
  p.armL.rotation.x = -sw; p.armR.rotation.x = sw;
  p.group.position.set(p.x, p.group.position.y, p.z);
  p.group.rotation.y = p.heading;
  // Camera orbit (mouse + touch drag).
  G.camYaw -= input.mouseDX * 0.0032 + G.touch.camDX * 0.005;
  G.touch.camDX = 0;
  G.camPitch = clamp(G.camPitch + input.mouseDY * 0.002, 0.08, 0.9);
  if (input.wheel) G.camDist = clamp(G.camDist + input.wheel * 1.5, 5, 16);
  if (input.wasPressed('KeyC')) G.camDist = G.camDist > 12 ? 7 : G.camDist + 3;
  if (audio) audio.engine(false, 0);
  updateCamera(dt, null);
  // Interact (E): car, NPC, activity.
  if (input.wasPressed('KeyE') || G.touchAct) {
    G.touchAct = false;
    tryInteract(audio);
  }
}
function tryInteract(audio) {
  const p = G.player;
  if (G.nearNpc) {
    if (typeof G.nearNpc.onTalk === 'function') G.nearNpc.onTalk();
    return;
  }
  const car = nearestCar(5);
  if (car) { enterCar(car, audio); return; }
}
export function updateCamera(dt, car) {
  const cam = G.camera;
  if (!cam) return;
  let yaw, tx, tz, ty = 1.6;
  if (car) {
    // Chase cam: yaw = heading, camera sits BEHIND the car.
    yaw = car.heading;
    const back = 9 + Math.abs(car.speed) * 0.06;
    tx = car.x - Math.sin(yaw) * back;
    tz = car.z - Math.cos(yaw) * back;
    ty = 3.4;
    cam.position.x = tx; cam.position.y = ty; cam.position.z = tz;
    cam.lookAt(car.x + Math.sin(yaw) * 8, 1.4, car.z + Math.cos(yaw) * 8);
    G.camYaw = yaw;
    return;
  }
  yaw = G.camYaw;
  const p = G.player;
  const d = G.camDist;
  tx = p.x - Math.sin(yaw) * d * Math.cos(G.camPitch);
  tz = p.z - Math.cos(yaw) * d * Math.cos(G.camPitch);
  ty = 1.6 + Math.sin(G.camPitch) * d;
  cam.position.x += (tx - cam.position.x) * Math.min(1, dt * 8);
  cam.position.y += (ty - cam.position.y) * Math.min(1, dt * 8);
  cam.position.z += (tz - cam.position.z) * Math.min(1, dt * 8);
  cam.lookAt(p.x, 1.6, p.z);
}
