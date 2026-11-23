// Nico on foot: WASD + mouse camera, jump, and E to enter/steal cars.
// The camera yaw is the movement reference on foot; in a car the chase
// camera sits behind the car (see render.js updateCamera).
import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, angDiff, dist2 } from './random.js';
import { isCarObj, updateCarPhysics, carSpeedKmh } from './vehicles.js';
import { collide } from './city.js';
import { isDown, wasPressed, axis } from './input.js';
import { onPlayerInteract } from './missions.js';
import { addWanted } from './police.js';

export function driveCarRef(G) {
  const c = G.player.car;
  return isCarObj(c) ? c : null;
}
export function playerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xc23a3a });
  const stripe = new THREE.MeshLambertMaterial({ color: 0xffd23a });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2a3a5a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35), jacket);
  body.position.y = 1.05; body.castShadow = true; g.add(body);
  const stripeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.37), stripe);
  stripeMesh.position.y = 1.25; g.add(stripeMesh);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.09, 0.37),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  belt.position.y = 0.66; g.add(belt);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skin);
  head.position.y = 1.68; g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  hair.position.y = 1.9; g.add(hair);
  const pony = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.14),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  pony.position.set(0, 1.75, -0.24); g.add(pony);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.36),
    new THREE.MeshLambertMaterial({ color: 0x5a3a1a }));
  strap.position.set(0.18, 1.1, 0); strap.rotation.z = 0.25; g.add(strap);
  const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.05),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  glasses.position.set(0, 1.72, 0.2); g.add(glasses);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.65, 0.3), jeans);
  legL.position.set(-0.16, 0.35, 0); g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.65, 0.3), jeans);
  legR.position.set(0.16, 0.35, 0); g.add(legR);
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.42),
    new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
  shoeL.position.set(-0.16, 0.06, 0.04); g.add(shoeL);
  const shoeR = shoeL.clone(); shoeR.position.x = 0.16; g.add(shoeR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.22), jacket);
  armL.position.set(-0.4, 1.05, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.4; g.add(armR);
  g.userData = { legL, legR, armL, armR, body };
  return g;
}
export function spawnPlayer(G) {
  if (G.player.mesh) G.fx.scene.remove(G.player.mesh);
  const mesh = playerMesh();
  mesh.position.set(CFG.spawn.x, 0, CFG.spawn.z);
  G.fx.scene.add(mesh);
  G.player.mesh = mesh;
  G.player.x = CFG.spawn.x; G.player.z = CFG.spawn.z;
  G.player.heading = CFG.spawn.heading;
  G.camYaw = CFG.spawn.heading;
  G.player.onFoot = true; G.player.car = null;
}
export function nearestCar(G, maxD) {
  let best = null, bd = maxD * maxD;
  for (const c of G.cars) {
    if (!isCarObj(c)) continue;
    const d = dist2(G.player.x, G.player.z, c.x, c.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function enterCar(G, car) {
  const p = G.player;
  const firstSteal = car.driver !== 'player' && car.owner !== 'player';
  if (firstSteal) {
    car.owner = 'player';
    addWanted(G, 1);
    G.stats.stolen = (G.stats.stolen || 0) + 1;
    G.hudMsg = `Stole the ${car.name}!`;
  }
  car.driver = 'player';
  p.car = car; p.onFoot = false;
  p.mesh.visible = false;
  onPlayerInteract(G, 'enterCar', car);
}
function exitCar(G) {
  const p = G.player;
  const car = driveCarRef(G);
  if (!car) return;
  car.speed = 0;
  p.car = null; p.onFoot = true;
  p.x = car.x - Math.sin(car.heading + Math.PI / 2) * 2.5;
  p.z = car.z - Math.cos(car.heading + Math.PI / 2) * 2.5;
  const hit = collide(G, p.x, p.z, 0.5);
  p.x = hit.x; p.z = hit.z;
  p.heading = car.heading;
  G.camYaw = car.heading;
  p.mesh.visible = true;
  p.mesh.position.set(p.x, 0, p.z);
  onPlayerInteract(G, 'exitCar', car);
}
export function updatePlayer(G, dt) {
  const p = G.player, input = G.input;
  const car = driveCarRef(G);
  if (car) {
    // driving: W/S throttle, A/D steer, Space handbrake, Shift brake
    let throttle = axis(input, 'KeyS', 'KeyW');
    let steer = axis(input, 'KeyA', 'KeyD');
    if (G.touch) {
      throttle += G.touch.throttle || 0;
      steer += G.touch.steer || 0;
    }
    throttle = clamp(throttle, -1, 1); steer = clamp(steer, -1, 1);
    updateCarPhysics(G, car, {
      throttle, steer,
      brake: isDown(input, 'ShiftLeft') || isDown(input, 'ShiftRight') || !!G.touch?.brake,
      hand: isDown(input, 'Space'),
    }, dt);
    p.x = car.x; p.z = car.z; p.heading = car.heading;
    if (wasPressed(input, 'KeyE')) exitCar(G);
    if (wasPressed(input, 'KeyC')) G.camDist = G.camDist > 12 ? 9 : G.camDist + 3;
    if (input.wheel) G.camDist = clamp(G.camDist - Math.sign(input.wheel) * 1.5, 6, 16);
    return;
  }
  // on foot
  G.camYaw -= input.mouseDX * 0.003;
  if (G.touch && G.touch.camDX) G.camYaw -= G.touch.camDX * 0.004;
  const fwd = axis(input, 'KeyS', 'KeyW') + (G.touch?.moveY || 0);
  const strafe = axis(input, 'KeyA', 'KeyD') + (G.touch?.moveX || 0);
  const run = isDown(input, 'ShiftLeft') || isDown(input, 'ShiftRight');
  const speed = (run ? CFG.runSpeed : CFG.walkSpeed);
  const fx = Math.sin(G.camYaw), fz = Math.cos(G.camYaw);
  const rx = Math.sin(G.camYaw + Math.PI / 2), rz = Math.cos(G.camYaw + Math.PI / 2);
  let mx = fx * fwd + rx * strafe, mz = fz * fwd + rz * strafe;
  const ml = Math.hypot(mx, mz);
  if (ml > 0.01) {
    mx /= Math.max(1, ml); mz /= Math.max(1, ml);
    const targetHeading = Math.atan2(mx, mz);
    p.heading += angDiff(p.heading, targetHeading) * Math.min(1, dt * 12);
    const nx = p.x + mx * speed * dt, nz = p.z + mz * speed * dt;
    const hit = collide(G, nx, nz, 0.5);
    p.x = hit.x; p.z = hit.z;
    p.moving = true; p.run = run;
  } else p.moving = false;
  // jump + gravity
  if (wasPressed(input, 'Space') && p.y <= 0.01) p.vy = CFG.jumpV;
  p.vy = (p.vy || 0) - CFG.gravity * dt;
  p.y = Math.max(0, (p.y || 0) + p.vy * dt);
  if (p.y === 0) p.vy = 0;
  // walk animation: leg/arm swing, step bounce, run lean
  const u = p.mesh.userData;
  const t = G.t * (p.run ? 13 : 9);
  const amp = p.moving ? (p.run ? 0.7 : 0.45) : 0;
  u.legL.rotation.x = Math.sin(t) * amp;
  u.legR.rotation.x = -Math.sin(t) * amp;
  u.armL.rotation.x = -Math.sin(t) * amp * 0.8;
  u.armR.rotation.x = Math.sin(t) * amp * 0.8;
  u.body.rotation.x = p.moving && p.run ? 0.12 : 0;
  p.mesh.position.set(p.x, (p.y || 0) + (p.moving ? Math.abs(Math.sin(t)) * 0.05 : 0), p.z);
  p.mesh.rotation.y = p.heading;
  // interact
  if (wasPressed(input, 'KeyE') || G.touch?.action) {
    G.touch.action = false;
    const near = nearestCar(G, 3.5);
    const talked = onPlayerInteract(G, 'interact', near);
    if (!talked && near) enterCar(G, near);
  }
  if (wasPressed(input, 'KeyC')) G.camDist = G.camDist > 12 ? 9 : G.camDist + 3;
}
export function playerSpeedKmh(G) {
  const car = driveCarRef(G);
  return car ? carSpeedKmh(car) : 0;
}
