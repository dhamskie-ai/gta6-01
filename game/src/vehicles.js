// Detailed procedural cars (box-based, no imported models) + arcade
// driving physics. Every car the player can steal is built here.
import * as THREE from 'three';
import { CAR_TYPES } from './config.js';
import { collide } from './city.js';
import { clamp } from './random.js';

export function isCarObj(c) {
  return !!c && typeof c === 'object' && typeof c.x === 'number' && typeof c.z === 'number';
}
const shared = {};
function mat(color) {
  if (!shared[color]) shared[color] = new THREE.MeshLambertMaterial({ color });
  return shared[color];
}
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
const chromeMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffedb0, emissiveIntensity: 0.7 });
const tailMat = new THREE.MeshLambertMaterial({ color: 0xaa2222, emissive: 0x881111, emissiveIntensity: 0.5 });
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.37, 8);
function box(w, h, d, m, x, y, z, parent) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
export function buildCarMesh(type, colorHex) {
  const g = new THREE.Group();
  const body = mat(colorHex);
  const long = type === 'truck' || type === 'bus' ? 5.6 : type === 'van' ? 4.8 : 4.2;
  const wide = type === 'bus' ? 2.4 : 2;
  const h = type === 'bus' || type === 'van' ? 2.2 : 1.15;
  // layered body: lower slab + upper body
  box(wide, 0.5, long, body, 0, 0.55, 0, g);
  box(wide - 0.1, h - 0.5, long - 0.4, body, 0, 0.75 + (h - 0.5) / 2, 0, g);
  // roof panel (body colour)
  box(wide - 0.3, 0.12, long * 0.42, body, 0, 0.75 + h - 0.35, -long * 0.08, g);
  // slanted glass windshield + rear glass
  const shield = box(wide - 0.5, 0.1, 1.1, glassMat, 0, 0.75 + h - 0.55, long * 0.22, g);
  shield.rotation.x = -0.5;
  const rear = box(wide - 0.5, 0.1, 1, glassMat, 0, 0.75 + h - 0.55, -long * 0.32, g);
  rear.rotation.x = 0.5;
  // cabin glass band
  box(wide - 0.25, 0.55, long * 0.4, glassMat, 0, 0.75 + h - 0.5, -long * 0.05, g);
  // side mirrors
  box(0.25, 0.18, 0.3, darkMat, -wide / 2 - 0.1, 1.35, long * 0.2, g);
  box(0.25, 0.18, 0.3, darkMat, wide / 2 + 0.1, 1.35, long * 0.2, g);
  // bumpers + grille + plate
  box(wide, 0.28, 0.3, darkMat, 0, 0.45, long / 2 + 0.05, g);
  box(wide, 0.28, 0.3, darkMat, 0, 0.45, -long / 2 - 0.05, g);
  box(wide - 0.6, 0.3, 0.1, darkMat, 0, 0.8, long / 2 + 0.02, g);
  box(0.7, 0.25, 0.06, chromeMat, 0, 0.5, long / 2 + 0.2, g);
  // headlights + taillights (emissive)
  box(0.5, 0.22, 0.1, lightMat, -wide / 2 + 0.35, 0.95, long / 2 + 0.02, g);
  box(0.5, 0.22, 0.1, lightMat, wide / 2 - 0.35, 0.95, long / 2 + 0.02, g);
  box(0.45, 0.2, 0.1, tailMat, -wide / 2 + 0.35, 0.95, -long / 2 - 0.02, g);
  box(0.45, 0.2, 0.1, tailMat, wide / 2 - 0.35, 0.95, -long / 2 - 0.02, g);
  if (type === 'sport') {
    // rear spoiler on two struts
    box(0.15, 0.35, 0.15, darkMat, -0.7, 1.5, -long / 2 + 0.2, g);
    box(0.15, 0.35, 0.15, darkMat, 0.7, 1.5, -long / 2 + 0.2, g);
    box(wide - 0.2, 0.1, 0.6, body, 0, 1.7, -long / 2 + 0.2, g);
  }
  if (type === 'taxi') {
    box(1.1, 0.3, 0.5, new THREE.MeshLambertMaterial({ color: 0x222222, emissive: 0xaa8800, emissiveIntensity: 0.6 }),
      0, 0.75 + h - 0.2, -long * 0.05, g);
  }
  if (type === 'truck') {
    box(wide - 0.2, 0.9, long * 0.5, new THREE.MeshLambertMaterial({ color: 0x5a5a5a }),
      0, 1.5, -long * 0.2, g);
  }
  if (type === 'police') {
    // light bar base (halves added by police.js)
    box(1.6, 0.18, 0.5, darkMat, 0, 0.75 + h - 0.15, 0, g);
  }
  // wheels + hubcaps
  const wheels = [];
  const wy = [-long / 2 + 0.9, long / 2 - 0.9];
  const wx = [-wide / 2 + 0.05, wide / 2 - 0.05];
  for (const zz of wy) for (const xx of wx) {
    const w = new THREE.Mesh(wheelGeo, tyreMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(xx, 0.42, zz);
    w.castShadow = true;
    g.add(w); wheels.push(w);
    const hub = new THREE.Mesh(hubGeo, chromeMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(xx, 0.42, zz);
    g.add(hub);
  }
  // headlight beam (spotlight, only the player car gets one lit at night)
  const beam = new THREE.SpotLight(0xfff2b0, 0, 40, 0.5, 0.5, 1);
  beam.position.set(0, 1.2, long / 2);
  const beamTarget = new THREE.Object3D();
  beamTarget.position.set(0, 0, long / 2 + 12);
  g.add(beamTarget);
  beam.target = beamTarget;
  g.add(beam);
  g.userData = { wheels, beam, long, wide };
  return g;
}
export function createCar(G, type, x, z, heading, driver, colorHex) {
  const def = CAR_TYPES[type] || CAR_TYPES.sedan;
  const color = colorHex !== undefined ? colorHex : def.color;
  const mesh = buildCarMesh(type, color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  G.fx.scene.add(mesh);
  const car = { type, name: def.name, x, z, heading, speed: 0,
    max: def.max, accel: def.accel, grip: def.grip, hp: 100, driver,
    mesh, wheels: mesh.userData.wheels, beam: mesh.userData.beam,
    long: mesh.userData.long, wide: mesh.userData.wide, color };
  G.cars.push(car);
  return car;
}
export function removeCar(G, car) {
  G.fx.scene.remove(car.mesh);
  const i = G.cars.indexOf(car);
  if (i >= 0) G.cars.splice(i, 1);
}
// Arcade physics. ctrl: {throttle -1..1, steer -1..1, brake, hand}.
// In shot mode, collision slowdown + damage are skipped (staging holds).
export function updateCarPhysics(G, car, ctrl, dt) {
  if (!isCarObj(car)) return;
  const shot = !!G.shotMode;
  const steerAuthority = clamp(Math.abs(car.speed) / 8, 0, 1);
  car.heading += ctrl.steer * car.grip * steerAuthority * dt * (car.speed < 0 ? -1 : 1) * 0.55;
  if (ctrl.throttle > 0) car.speed += car.accel * ctrl.throttle * dt;
  else if (ctrl.throttle < 0) car.speed += car.accel * ctrl.throttle * dt * 0.8;
  if (ctrl.brake) car.speed -= Math.sign(car.speed) * 30 * dt;
  if (ctrl.hand) car.speed *= Math.pow(0.2, dt);
  car.speed -= car.speed * 0.35 * dt; // drag (skipped in shot mode below)
  if (shot) car.speed += car.speed * 0.35 * dt; // cancel drag so staged speed holds
  car.speed = clamp(car.speed, -car.max * 0.45, car.max);
  if (Math.abs(car.speed) < 0.05 && !ctrl.throttle) car.speed = 0;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const hit = collide(G, nx, nz, 1.6);
  const bumped = (hit.x !== nx || hit.z !== nz);
  car.x = hit.x; car.z = hit.z;
  if (bumped && !shot) {
    car.speed *= 0.55;
    car.hp = Math.max(0, car.hp - Math.abs(car.speed) * 0.08);
  }
  // car-car push (skip slowdown/damage in shot mode)
  for (const other of G.cars) {
    if (other === car || !isCarObj(other)) continue;
    const dx = car.x - other.x, dz = car.z - other.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 12 && d2 > 0.001) {
      const d = Math.sqrt(d2), push = (3.5 - d) / 2;
      const ux = dx / d, uz = dz / d;
      car.x += ux * push; car.z += uz * push;
      other.x -= ux * push; other.z -= uz * push;
      if (!shot) {
        car.speed *= 0.85; other.speed *= 0.85;
        if (car.driver === 'player') car.hp = Math.max(0, car.hp - 1);
      }
    }
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * dt * 2.4;
  for (const w of car.wheels) w.rotation.x += spin;
  // headlight: on at night, intensity 120
  const night = G.timeOfDay >= 19 || G.timeOfDay < 6;
  if (car.beam) car.beam.intensity = night && car.driver === 'player' ? 120 : 0;
  // smoke when badly damaged
  if (car.hp < 30 && G.fx && G.city) car.mesh.position.y = 0;
}
export function carSpeedKmh(car) {
  return isCarObj(car) ? Math.abs(car.speed) * 3.6 : 0;
}
