import * as THREE from 'three';
import { CAR_DEFS } from './config.js';
import { collideCircle } from './city.js';
import { isDown } from './input.js';

const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2f42 });
const darkMat = new THREE.MeshLambertMaterial({ color: 0x16191d });
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x111214 });
const hubMat = new THREE.MeshLambertMaterial({ color: 0xc8ccd2 });
const headMat = new THREE.MeshLambertMaterial({ color: 0xfff6c8, emissive: 0xffe9a8, emissiveIntensity: 0.9 });
const tailMat = new THREE.MeshLambertMaterial({ color: 0xaa1414, emissive: 0xcc2222, emissiveIntensity: 0.7 });

export function buildCarMesh(type, colorHex, withLight) {
  const def = CAR_DEFS[type] || CAR_DEFS.cometa;
  const color = colorHex !== undefined ? colorHex : def.color;
  const grp = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const L = def.len, W = def.wid;
  const body = new THREE.Mesh(new THREE.BoxGeometry(L, 0.62, W), bodyMat);
  body.position.y = 0.62; body.castShadow = true; grp.add(body);
  let cabinLen = L * 0.48, cabinZ = -0.15, cabinY = 1.18;
  if (def.kind === 'van' || def.kind === 'bus') { cabinLen = L * 0.92; cabinZ = 0; cabinY = 1.25; }
  if (def.kind === 'truck') { cabinLen = L * 0.3; cabinZ = L * 0.28; cabinY = 1.15; }
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(cabinLen, 0.55, W * 0.86), bodyMat);
  cabin.position.set(cabinZ, cabinY, 0); cabin.castShadow = true; grp.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(cabinLen * 0.94, 0.07, W * 0.8), bodyMat);
  roof.position.set(cabinZ, cabinY + 0.3, 0); grp.add(roof);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, W * 0.8), glassMat);
  shield.position.set(cabinZ + cabinLen / 2 - 0.05, cabinY + 0.05, 0);
  shield.rotation.z = -0.42; grp.add(shield);
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.48, W * 0.8), glassMat);
  rearGlass.position.set(cabinZ - cabinLen / 2 + 0.05, cabinY + 0.05, 0);
  rearGlass.rotation.z = 0.42; grp.add(rearGlass);
  const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(cabinLen * 0.8, 0.34, W * 0.88), glassMat);
  sideGlass.position.set(cabinZ, cabinY + 0.08, 0); grp.add(sideGlass);
  for (const s of [-1, 1]) {
    const mir = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.08), darkMat);
    mir.position.set(cabinZ + cabinLen / 2 - 0.1, cabinY + 0.05, s * (W / 2 + 0.06));
    grp.add(mir);
  }
  for (const s of [-1, 1]) {
    const bump = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, W * 0.96), darkMat);
    bump.position.set(s * (L / 2 - 0.02), 0.42, 0); grp.add(bump);
  }
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.34), headMat);
    hl.position.set(L / 2 + 0.01, 0.72, s * (W / 2 - 0.35)); grp.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.34), tailMat);
    tl.position.set(-L / 2 - 0.01, 0.72, s * (W / 2 - 0.35)); grp.add(tl);
  }
  if (def.kind === 'sport') {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, W * 0.92),
      new THREE.MeshLambertMaterial({ color: 0x14181f }));
    wing.position.set(-L / 2 + 0.15, 1.32, 0); grp.add(wing);
    for (const s of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.08), darkMat);
      strut.position.set(-L / 2 + 0.15, 1.12, s * (W / 2 - 0.3)); grp.add(strut);
    }
  }
  if (type === 'cabro') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x222222, emissive: 0xf2c200, emissiveIntensity: 0.8 }));
    sign.position.set(0, cabinY + 0.42, 0); grp.add(sign);
  }
  if (type === 'taco') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.1),
      new THREE.MeshLambertMaterial({ color: 0xfff3c4, emissive: 0xffd23f, emissiveIntensity: 0.4 }));
    sign.position.set(0, 1.5, W / 2 + 0.06); grp.add(sign);
  }
  if (def.kind === 'bus') {
    const band = new THREE.Mesh(new THREE.BoxGeometry(L * 0.9, 0.5, W * 0.92), glassMat);
    band.position.set(0, 1.35, 0); grp.add(band);
  }
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10);
  wheelGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.28, 8);
  hubGeo.rotateX(Math.PI / 2);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeo, tyreMat);
      wheel.position.set(sx * (L / 2 - 0.85), 0.36, sz * (W / 2 - 0.02));
      wheel.castShadow = true;
      grp.add(wheel);
      const hub = new THREE.Mesh(hubGeo, hubMat);
      hub.position.copy(wheel.position);
      grp.add(hub);
      wheels.push({ wheel, hub });
    }
  }
  let spot = null;
  if (withLight) {
    spot = new THREE.SpotLight(0xfff2c0, 0, 42, 0.5, 0.45, 1.2);
    spot.position.set(L / 2, 0.8, 0);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(L / 2 + 14, 0, 0);
    grp.add(spotTarget);
    spot.target = spotTarget;
    grp.add(spot);
  }
  grp.userData = { wheels, spot, def };
  return grp;
}

export function makeCar(type, x, z, heading, colorHex, withLight) {
  const def = CAR_DEFS[type] || CAR_DEFS.cometa;
  const group = buildCarMesh(type, colorHex, withLight);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  return {
    type, def, group, x, z, heading,
    speed: 0, steer: 0, hp: 100, color: colorHex !== undefined ? colorHex : def.color,
    name: def.name, isPlayer: false, owned: false, stolen: false,
    brakeLight: false,
  };
}

export function carForward(car) {
  return { x: Math.sin(car.heading), z: Math.cos(car.heading) };
}

function circleHitsCar(ax, az, ar, bx, bz, br) {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz < (ar + br) * (ar + br);
}

export function updatePlayerCar(G, input, dt) {
  const car = G.car;
  if (!car) return;
  const def = car.def;
  const fwd = isDown(input, 'KeyW') || isDown(input, 'ArrowUp') ? 1 : 0;
  const back = isDown(input, 'KeyS') || isDown(input, 'ArrowDown') ? 1 : 0;
  const left = isDown(input, 'KeyA') || isDown(input, 'ArrowLeft') ? 1 : 0;
  const right = isDown(input, 'KeyD') || isDown(input, 'ArrowRight') ? 1 : 0;
  const handbrake = isDown(input, 'ShiftLeft') || isDown(input, 'ShiftRight');
  const dir = car.speed >= 0 ? 1 : -1;
  if (fwd) car.speed += def.accel * dt;
  if (back) {
    if (car.speed > 0.5) car.speed -= def.brake * dt;
    else car.speed -= def.accel * 0.55 * dt;
  }
  if (!fwd && !back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 7 * dt);
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 16 * dt);
    if (Math.abs(car.speed) > 6 && Math.random() < dt * 6) {
      G.W.spawnParticles({ x: car.x, y: 0.2, z: car.z }, 0xaaaaaa, 3, 1.2, 0.6);
    }
  }
  car.speed = Math.max(-13, Math.min(def.maxSpeed, car.speed));
  const steerTarget = (left ? 1 : 0) - (right ? 1 : 0);
  const steerRate = handbrake ? 1.5 : 1;
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const spd01 = Math.min(1, Math.abs(car.speed) / def.maxSpeed);
  car.heading += car.steer * def.turn * spd01 * dir * dt * steerRate;
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  let nx = car.x + fx * car.speed * dt;
  let nz = car.z + fz * car.speed * dt;
  const fixed = collideCircle(G.city, nx, nz, 1.7);
  if (Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01) {
    car.speed *= 0.45;
    car.hp = Math.max(0, car.hp - Math.abs(car.speed) * 0.35);
    nx = fixed.x; nz = fixed.z;
  }
  const others = [...(G.traffic || []), ...(G.parked || [])].filter((o) => o !== car);
  for (const o of others) {
    const oc = o.car || o;
    if (circleHitsCar(nx, nz, 1.8, oc.x, oc.z, 1.9)) {
      car.speed *= 0.55;
      car.hp = Math.max(0, car.hp - 2);
      if (oc.speed !== undefined && o.axis) oc.speed = Math.max(0, oc.speed - 4);
      nx = car.x; nz = car.z;
      break;
    }
  }
  car.x = nx; car.z = nz;
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  const spin = car.speed * dt / 0.36;
  for (const w of car.group.userData.wheels) { w.wheel.rotation.y += spin; w.hub.rotation.y += spin; }
  const night = G.timeOfDay >= 19 || G.timeOfDay < 6;
  const spot = car.group.userData.spot;
  if (spot) spot.intensity = night ? 260 : 0;
  G.audio.engine(true, spd01);
  if (car.hp <= 0) {
    G.W.explosion({ x: car.x, y: 1, z: car.z });
    G.car = null;
    G.inCar = false;
    G.player.x = car.x + 3; G.player.z = car.z + 3;
    G.player.mesh.visible = true;
    G.audio.engine(false, 0);
  }
}

export function driveToward(car, tx, tz, dt, city, maxSpeed) {
  const dx = tx - car.x, dz = tz - car.z;
  const want = Math.atan2(dx, dz);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.heading += Math.max(-1.9 * dt, Math.min(1.9 * dt, diff));
  const target = maxSpeed || car.def.maxSpeed * 0.85;
  car.speed += (target - car.speed) * Math.min(1, dt * 0.8);
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  let nx = car.x + fx * car.speed * dt;
  let nz = car.z + fz * car.speed * dt;
  const fixed = collideCircle(city, nx, nz, 1.7);
  if (Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01) {
    car.speed *= 0.5;
    nx = fixed.x; nz = fixed.z;
  }
  car.x = nx; car.z = nz;
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  const spin = car.speed * dt / 0.36;
  for (const w of car.group.userData.wheels) { w.wheel.rotation.y += spin; w.hub.rotation.y += spin; }
}
