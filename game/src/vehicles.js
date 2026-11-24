// 6 procedural car models + arcade driving physics (accel, brake, handbrake,
// steering by speed, building + car collisions, wheel spin, smoke when hurt).
import * as THREE from 'three';
import { CAR_TYPES } from './config.js';
import { collideBuildings, clampWorld } from './city.js';

export function createCarMesh(type, color) {
  const def = CAR_TYPES[type] || CAR_TYPES.sedan;
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: color ?? def.color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const bodyLen = type === 'van' || type === 'truck' ? 5.2 : 4.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, bodyLen), bodyMat);
  body.position.y = 0.75; body.castShadow = true; g.add(body);
  const cabinH = type === 'van' ? 0.9 : 0.65;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, cabinH, type === 'truck' ? 1.2 : 2.1), glassMat);
  cabin.position.set(0, 1.4, type === 'truck' ? 1.4 : -0.2); cabin.castShadow = true; g.add(cabin);
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5), new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x664400 }));
    sign.position.set(0, 1.95, -0.2); g.add(sign);
  }
  if (type === 'truck') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 2.6), new THREE.MeshLambertMaterial({ color: 0x6a7a6a }));
    bed.position.set(0, 1.2, -1.2); g.add(bed);
  }
  // Headlights + taillights.
  const hl = new THREE.MeshLambertMaterial({ color: 0xfff2c8, emissive: 0xaa9900 });
  const tl = new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0x550000 });
  for (const sx of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), hl);
    h.position.set(sx, 0.8, bodyLen / 2); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), tl);
    t.position.set(sx, 0.8, -bodyLen / 2); g.add(t);
  }
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.38, wz);
    g.add(w); wheels.push(w);
  }
  return { group: g, wheels, type, def, speed: 0, hp: 100, driver: null, maxSpeed: def.topSpeed, isShowCar: false };
}

export function spawnPlayerCar(S, type, color, x, z) {
  const car = createCarMesh(type, color);
  car.group.position.set(x, 0, z); car.group.rotation.y = Math.PI / 4;
  car.driver = 'parked';
  S.scene.add(car.group); S.cars.push(car);
  return car;
}

export function updateCar(S, car, dt) {
  const input = S.input;
  const def = car.def;
  let throttle = 0;
  if (input.down('KeyW') || input.touchVec.y < -0.3) throttle = 1;
  if (input.down('KeyS') || input.touchVec.y > 0.3) throttle = -1;
  const handbrake = input.down('ShiftLeft') || input.down('ShiftRight') || input.touch.brake;
  if (throttle > 0) car.speed += def.accel * dt;
  else if (throttle < 0) car.speed -= (car.speed > 0.5 ? def.accel * 1.4 : def.accel * 0.6) * dt;
  else car.speed -= Math.sign(car.speed) * 6 * dt;
  if (handbrake) car.speed -= Math.sign(car.speed) * 18 * dt;
  car.speed = Math.max(-def.topSpeed * 0.4, Math.min(def.topSpeed, car.speed));
  if (Math.abs(car.speed) < 0.15 && throttle === 0) car.speed = 0;
  let steer = 0;
  if (input.down('KeyA') || input.touchVec.x < -0.3) steer = 1;
  if (input.down('KeyD') || input.touchVec.x > 0.3) steer = -1;
  const steerFactor = Math.min(1, Math.abs(car.speed) / 8) * (car.speed >= 0 ? 1 : -1);
  car.group.rotation.y += steer * def.turn * steerFactor * dt * (handbrake ? 1.5 : 1);
  car.group.position.x += Math.sin(car.group.rotation.y) * car.speed * dt;
  car.group.position.z += Math.cos(car.group.rotation.y) * car.speed * dt;
  collideBuildings(S.city.colliders, car.group.position, 1.6);
  clampWorld(car.group.position, 312);
  // Bump other cars.
  for (const o of S.cars) {
    if (o === car) continue;
    const d = o.group.position.distanceTo(car.group.position);
    if (d < 3.4 && d > 0.01) {
      const push = o.group.position.clone().sub(car.group.position).normalize().multiplyScalar((3.4 - d) * 0.5);
      o.group.position.add(push);
      car.speed *= 0.82;
      if (Math.abs(car.speed) > 12) { car.hp -= 2; S.audio.punch(); }
    }
  }
  for (const w of car.wheels) w.rotation.x += car.speed * dt * 0.5;
  // Body lean + smoke when badly hurt.
  car.group.rotation.z = -steer * Math.min(0.08, Math.abs(car.speed) * 0.004);
  if (car.hp < 30 && Math.random() < 0.1) S.combat.burst(car.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0x888888, 1);
  if (car.hp <= 0) {
    S.combat.burst(car.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xff6600, 14);
    car.hp = 100; car.speed = 0;
    if (S.player.inCar && S.player.car === car) { S.player.inCar = false; S.player.car = null; S.player.mesh.visible = true; S.player.mesh.position.copy(car.group.position).add(new THREE.Vector3(3, 0, 0)); }
  }
}
