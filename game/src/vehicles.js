// Procedural car models (box-based, 8 types now: the six originals plus
// a city bus and a taco truck) + arcade driving + stealing. Wheels of
// ALL cars live in one shared InstancedMesh (1 draw call).
import * as THREE from 'three';
import { CAR_MODELS, CONFIG } from './config.js';
import { collideBuildings } from './city.js';
const WHEEL_CAP = 256;
let wheelMesh = null;
let hubMesh = null;
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
export function initWheelInstances(G) {
  wheelMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10),
    new THREE.MeshLambertMaterial({ color: 0x111111 }), WHEEL_CAP);
  wheelMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  wheelMesh.frustumCulled = false;
  G.scene.add(wheelMesh);
  hubMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.32, 8),
    new THREE.MeshLambertMaterial({ color: 0xc8ccd2 }), WHEEL_CAP);
  hubMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  hubMesh.frustumCulled = false;
  G.scene.add(hubMesh);
}
export function updateWheelInstances(G) {
  if (!wheelMesh) return;
  let w = 0;
  for (const car of G.cars) {
    const spec = car.spec;
    const axles = spec.len > 6 ? [0.36, 0, -0.36] : [0.32, -0.32];
    for (const az of axles) {
      for (const sx of [-1, 1]) {
        if (w >= WHEEL_CAP) break;
        const ox = (spec.wid / 2) * sx, oz = spec.len * az;
        const cy = Math.cos(car.yaw), sy = Math.sin(car.yaw);
        _v.set(car.x + ox * cy + oz * sy, 0.36, car.z - ox * sy + oz * cy);
        _e.set(car.wheelSpin || 0, car.yaw, Math.PI / 2, 'YXZ');
        _q.setFromEuler(_e);
        _m4.compose(_v, _q, _s);
        wheelMesh.setMatrixAt(w, _m4);
        if (hubMesh) hubMesh.setMatrixAt(w, _m4);
        w++;
      }
    }
  }
  for (; w < WHEEL_CAP; w++) {
    _m4.makeScale(0, 0, 0);
    wheelMesh.setMatrixAt(w, _m4);
    if (hubMesh) hubMesh.setMatrixAt(w, _m4);
  }
  wheelMesh.instanceMatrix.needsUpdate = true;
  if (hubMesh) hubMesh.instanceMatrix.needsUpdate = true;
}
export function makeCarModel(type, paint) {
  const spec = CAR_MODELS[type];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: paint !== undefined ? paint : spec.color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.wid, 0.75, spec.len), bodyMat);
  body.position.y = 0.62; body.castShadow = true; g.add(body);
  const cabinH = type === 'van' || type === 'truck' || type === 'bus' || type === 'foodtruck' ? 1.0 : 0.62;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.88, cabinH, spec.len * (type === 'truck' ? 0.28 : 0.5)), darkMat);
  cabin.position.set(0, 1.2 + cabinH / 2 - 0.3, type === 'truck' ? spec.len * 0.28 : -spec.len * 0.05);
  cabin.castShadow = true; g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.9, 0.1, spec.len * (type === 'truck' ? 0.28 : 0.52)), bodyMat);
  roof.position.set(0, 1.2 + cabinH - 0.3 + 0.05, type === 'truck' ? spec.len * 0.28 : -spec.len * 0.05);
  roof.castShadow = true; g.add(roof);
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fd8e8 });
  const shield = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.8, 0.06, 0.85), glassMat);
  shield.position.set(0, 1.35, spec.len * 0.2);
  shield.rotation.x = 0.5;
  g.add(shield);
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.8, 0.06, 0.7), glassMat);
  rearGlass.position.set(0, 1.35, -spec.len * 0.28);
  rearGlass.rotation.x = -0.5;
  g.add(rearGlass);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.42, 0.2, 0.06), darkMat);
  grille.position.set(0, 0.62, spec.len / 2 + 0.03); g.add(grille);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.04),
    new THREE.MeshBasicMaterial({ color: 0xf2f2e8 }));
  plate.position.set(0, 0.42, spec.len / 2 + 0.15); g.add(plate);
  for (const sx of [-1, 1]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.22), darkMat);
    mirror.position.set(sx * (spec.wid / 2 + 0.08), 1.15, spec.len * 0.16);
    g.add(mirror);
  }
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(spec.wid, 0.22, 0.16), darkMat);
  bumperF.position.set(0, 0.42, spec.len / 2 + 0.06); g.add(bumperF);
  const bumperR = new THREE.Mesh(new THREE.BoxGeometry(spec.wid, 0.22, 0.16), darkMat);
  bumperR.position.set(0, 0.42, -spec.len / 2 - 0.06); g.add(bumperR);
  if (type === 'sport') {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.9, 0.08, 0.5), darkMat);
    wing.position.set(0, 1.28, -spec.len / 2 + 0.25); wing.castShadow = true; g.add(wing);
    for (const sx of [-0.6, 0.6]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.08), darkMat);
      strut.position.set(sx, 1.08, -spec.len / 2 + 0.25); g.add(strut);
    }
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0xffe14a }));
    sign.position.set(0, 1.75, 0); g.add(sign);
  }
  if (type === 'truck') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(spec.wid, 1.1, spec.len * 0.55), new THREE.MeshLambertMaterial({ color: 0x5a4a3a }));
    bed.position.set(0, 1.1, -spec.len * 0.2); bed.castShadow = true; g.add(bed);
  }
  if (type === 'bus') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(spec.wid + 0.04, 0.18, spec.len * 0.9),
      new THREE.MeshLambertMaterial({ color: 0xf2f2e8 }));
    stripe.position.set(0, 1.85, 0); g.add(stripe);
    for (const sx of [-1, 1]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, spec.len * 0.72), glassMat);
      band.position.set(sx * (spec.wid / 2 + 0.01), 1.15, -0.3); g.add(band);
    }
    const dest = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xffd23f }));
    dest.position.set(0, 1.6, spec.len / 2 + 0.02); g.add(dest);
  }
  if (type === 'foodtruck') {
    const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 2.0), darkMat);
    hatch.position.set(spec.wid / 2 + 0.01, 1.15, 0.2); g.add(hatch);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 2.2),
      new THREE.MeshLambertMaterial({ color: 0xff5fa2 }));
    awn.position.set(spec.wid / 2 + 0.45, 1.7, 0.2); g.add(awn);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xffe14a }));
    sign.position.set(0, 2.0, 0); g.add(sign);
    const menu = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xf2f2e8 }));
    menu.position.set(0, 1.0, -spec.len / 2 - 0.08); g.add(menu);
  }
  const front = new THREE.Mesh(new THREE.BoxGeometry(spec.wid - 0.5, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: 0xfff6c0 }));
  front.position.set(0, 0.7, spec.len / 2 + 0.02); g.add(front);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(spec.wid - 0.5, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  tail.position.set(0, 0.7, -spec.len / 2 - 0.02); g.add(tail);
  return { group: g };
}
export function ensureBeams(car) {
  if (car.beams && car.beams.length) return;
  const spec = car.spec;
  const beams = [];
  for (const sx of [-0.6, 0.6]) {
    const beam = new THREE.SpotLight(0xfff2b0, 0, 26, 0.55, 0.5, 1.2);
    beam.position.set(sx, 0.7, spec.len / 2);
    car.group.add(beam);
    beam.target.position.set(sx, 0, spec.len / 2 + 12);
    car.group.add(beam.target);
    beams.push(beam);
  }
  car.beams = beams;
}
export function detachBeams(car) {
  if (!car.beams) return;
  for (const b of car.beams) { car.group.remove(b); car.group.remove(b.target); }
  car.beams = [];
}
export function spawnCar(G, type, x, z, yaw, driver, paint) {
  const { group } = makeCarModel(type, paint);
  group.position.set(x, 0, z); group.rotation.y = yaw;
  G.scene.add(group);
  const car = { type, spec: CAR_MODELS[type], group, beams: [], x, z, yaw, speed: 0, steer: 0, health: 100, driver, smoke: null, wheelSpin: 0 };
  if (driver === 'player') ensureBeams(car);
  G.cars.push(car);
  return car;
}
export function setHeadlights(car, on) {
  for (const b of car.beams) b.intensity = on ? 60 : 0;
}
export function nearestStealableCar(G, range) {
  const p = G.player;
  let best = null, bd = range;
  for (const car of G.cars) {
    if (car.driver === 'player' || car.driver === 'police' || car.driver === 'race') continue;
    const d = Math.hypot(car.x - p.pos.x, car.z - p.pos.z);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}
export function stealCar(G, car) {
  const p = G.player;
  const wasTraffic = car.driver === 'traffic';
  if (wasTraffic) {
    G.trafficPeds.push(makeFleeingPed(G, car.x + 2, car.z + 2));
    G.audio.honk();
  }
  car.driver = 'player';
  if (G.playerCar && G.playerCar !== car) detachBeams(G.playerCar);
  ensureBeams(car);
  G.playerCar = car;
  p.onFoot = false; p.car = car;
  p.pos.set(car.x, 0, car.z);
  G.stats.carsStolen++;
  const policeNear = G.policeCars.some((pc) => Math.hypot(pc.x - p.pos.x, pc.z - p.pos.z) < 80);
  if (wasTraffic || policeNear) G.addWanted(1, 'stole a car');
  G.hud.showPrompt('');
  G.audio.pickup();
  return car;
}
export function exitCar(G) {
  const car = G.playerCar;
  if (!car) return;
  car.driver = 'parked';
  const p = G.player;
  p.pos.set(car.x + Math.cos(car.yaw) * 2.6, 0, car.z - Math.sin(car.yaw) * 2.6);
  p.onFoot = true; p.car = null; p.yaw = car.yaw;
  G.playerCar = null;
  G.playerMesh.visible = true;
}
export function updatePlayerCar(G, dt) {
  const car = G.playerCar;
  if (!car) return;
  const input = G.input;
  const spec = car.spec;
  const fwd = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
  const handbrake = input.down('ShiftLeft') || input.down('ShiftRight');
  if (fwd > 0) car.speed += CONFIG.carAccel * spec.accel * dt;
  else if (fwd < 0) car.speed -= (car.speed > 0.5 ? CONFIG.carBrake : CONFIG.carAccel * 0.6) * dt;
  else car.speed -= Math.sign(car.speed) * CONFIG.carDrag * 4 * dt;
  if (handbrake) car.speed -= Math.sign(car.speed) * 14 * dt;
  car.speed = Math.max(-CONFIG.carReverseMax, Math.min(spec.top, car.speed));
  if (Math.abs(car.speed) < 0.05 && fwd === 0) car.speed = 0;
  const steerIn = (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0) - (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0);
  const steerTarget = steerIn * 0.55 * spec.grip * (handbrake ? 1.5 : 1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  if (Math.abs(car.speed) > 0.1) {
    car.yaw += car.steer * (car.speed / spec.top) * dt * 2.4 * Math.sign(car.speed);
  }
  const nx = car.x + Math.sin(car.yaw) * car.speed * dt;
  const nz = car.z + Math.cos(car.yaw) * car.speed * dt;
  const res = collideBuildings(G, nx, nz, 1.6);
  if (res.hit && Math.abs(car.speed) > 6) {
    G.audio.noise(0.15, 0.25, 200);
    car.speed *= 0.4;
    car.health -= 4;
    if (car.health <= 0) G.explodeCar(car);
  }
  car.x = res.x; car.z = res.z;
  for (const other of G.cars) {
    if (other === car || other.driver === 'player') continue;
    const d = Math.hypot(other.x - car.x, other.z - car.z);
    if (d < 3.4 && d > 0.01) {
      const push = (3.4 - d) / 2;
      const ux = (car.x - other.x) / d, uz = (car.z - other.z) / d;
      car.x += ux * push; car.z += uz * push;
      other.x -= ux * push; other.z -= uz * push;
      if (Math.abs(car.speed) > 8) { car.speed *= 0.6; other.speed = Math.min(other.speed, 4); G.audio.noise(0.12, 0.2, 250); }
    }
  }
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.yaw;
  car.wheelSpin += car.speed * dt * 2.4;
  G.player.pos.set(car.x, 0, car.z);
  G.audio.setEngine(Math.abs(car.speed) / spec.top, true);
  if (car.health < 35 && !car.smoke) {
    car.smoke = G.effects.smoke(car);
  }
}
function makeFleeingPed(G, x, z) {
  const ped = G.spawnPed(x, z);
  if (!ped) return null;
  ped.state = 'flee'; ped.fleeT = 6;
  return ped;
}
