// Procedural car models (6 types) + arcade driving physics + stealing.
import * as THREE from 'three';
import { CFG } from './config.js';
import { collideBuildings, clampToCity } from './city.js';
import { spawnParticles } from './render.js';

export function makeCarModel(type, opts = {}) {
  const spec = CFG.carTypes[type] || CFG.carTypes.sedan;
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: opts.color ?? spec.color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1c2126 });
  const len = spec.len, wid = type === 'truck' ? 2.4 : 1.9;
  const bodyH = type === 'van' || type === 'truck' ? 1.5 : 0.75;
  const body = new THREE.Mesh(new THREE.BoxGeometry(wid, bodyH, len), bodyMat);
  body.position.y = 0.55 + bodyH / 2 - 0.35;
  body.castShadow = true;
  g.add(body);
  if (type === 'truck') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(wid, 1.3, 1.6), bodyMat);
    cab.position.set(0, 1.5, len / 2 - 1.1);
    cab.castShadow = true;
    g.add(cab);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.2, 0.5, len - 2.2),
      new THREE.MeshLambertMaterial({ color: 0x5a4a32 }));
    bed.position.set(0, 1.45, -0.8);
    g.add(bed);
  } else {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.25, 0.65, len * 0.45), darkMat);
    cabin.position.set(0, 1.05, type === 'van' ? 0 : -len * 0.06);
    cabin.castShadow = true;
    g.add(cabin);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const wheels = [];
  for (const [wx, wz] of [[-wid / 2, len / 2 - 0.8], [wid / 2, len / 2 - 0.8], [-wid / 2, -len / 2 + 0.8], [wid / 2, -len / 2 + 0.8]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  // Headlights + taillights.
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xfff8c8 });
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.08), hlMat);
    hl.position.set(s * (wid / 2 - 0.35), 0.75, -len / 2 - 0.01);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    tl.position.set(s * (wid / 2 - 0.35), 0.75, len / 2 + 0.01);
    g.add(tl);
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xfff200 }));
    sign.position.set(0, 1.55, 0);
    g.add(sign);
  }
  if (opts.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar.position.set(0, 1.5, 0);
    g.add(bar);
    const bar2 = bar.clone();
    bar2.material = new THREE.MeshBasicMaterial({ color: 0x2244ff });
    bar2.position.x = 0.0; bar2.position.z = 0.0;
    bar2.scale.x = 0.5;
    g.add(bar2);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(wid + 0.02, 0.3, len + 0.02),
      new THREE.MeshLambertMaterial({ color: 0x111418 }));
    stripe.position.y = 0.5;
    g.add(stripe);
  }
  g.userData.wheels = wheels;
  g.userData.type = type;
  return g;
}

export function spawnCar(G, type, x, z, yaw = 0, opts = {}) {
  const mesh = makeCarModel(type, opts);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = yaw;
  G.scene.add(mesh);
  const car = {
    mesh, type, yaw, speed: 0, steer: 0,
    hp: CFG.carTypes[type].hp,
    owned: !!opts.owned, police: !!opts.police,
    driver: opts.driver ?? null,
    smoke: 0,
  };
  G.cars.push(car);
  return car;
}

export function removeCar(G, car) {
  G.scene.remove(car.mesh);
  const i = G.cars.indexOf(car);
  if (i >= 0) G.cars.splice(i, 1);
}

// Arcade physics for the player's car. Returns speed in m/s.
export function updatePlayerCar(G, dt) {
  const car = G.player.car;
  if (!car) return 0;
  const spec = CFG.carTypes[car.type];
  const input = G.input;
  const fwd = input.down('KeyW') || input.down('ArrowUp');
  const back = input.down('KeyS') || input.down('ArrowDown');
  const handbrake = input.down('ShiftLeft') || input.down('ShiftRight');
  const steerIn = (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0)
    - (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0);
  const targetSteer = steerIn * 0.55 * (car.speed >= 0 ? 1 : -1);
  car.steer += (targetSteer - car.steer) * Math.min(1, dt * 8);
  if (fwd) car.speed += spec.accel * dt * (1 - Math.max(0, car.speed) / spec.top);
  if (back) {
    if (car.speed > 0.5) car.speed -= spec.accel * 1.6 * dt;
    else car.speed -= spec.accel * 0.6 * dt;
  }
  if (!fwd && !back) car.speed -= Math.sign(car.speed) * 6 * dt;
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * 18 * dt;
    if (Math.abs(car.speed) > 8 && G.rng.next() < 0.5) {
      spawnSkid(G, car);
    }
  }
  car.speed = THREE.MathUtils.clamp(car.speed, -spec.top * 0.45, spec.top);
  if (Math.abs(car.speed) < 0.05 && !fwd && !back) car.speed = 0;
  const grip = handbrake ? spec.grip * 0.45 : spec.grip;
  car.yaw += car.steer * (car.speed / spec.top) * grip * dt * (car.speed >= 0 ? 1 : -1);
  const dx = -Math.sin(car.yaw) * car.speed * dt;
  const dz = -Math.cos(car.yaw) * car.speed * dt;
  const pos = car.mesh.position;
  pos.x += dx; pos.z += dz;
  clampToCity(pos, 2);
  if (collideBuildings(G, pos, spec.len / 2)) {
    car.speed *= 0.35;
    if (Math.abs(car.speed) > 6) {
      car.hp -= 4;
      G.audio?.blip(90, 0.12, 'square', 0.15);
    }
  }
  // Bump other cars.
  for (const other of G.cars) {
    if (other === car) continue;
    const ox = other.mesh.position.x - pos.x;
    const oz = other.mesh.position.z - pos.z;
    const d2 = ox * ox + oz * oz;
    if (d2 < 9 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      const push = (3 - d) / 2;
      pos.x -= (ox / d) * push; pos.z -= (oz / d) * push;
      other.mesh.position.x += (ox / d) * push;
      other.mesh.position.z += (oz / d) * push;
      if (Math.abs(car.speed) > 8) { car.speed *= 0.6; other.hp -= 6; }
    }
  }
  car.mesh.rotation.y = car.yaw;
  const wheels = car.mesh.userData.wheels;
  if (wheels) for (const w of wheels) w.rotation.x += car.speed * dt * 2;
  // Body lean + smoke when damaged.
  car.mesh.rotation.z = -car.steer * Math.min(1, Math.abs(car.speed) / 20) * 0.06;
  if (car.hp < 40) {
    car.smoke += dt;
    if (car.smoke > 0.15) {
      car.smoke = 0;
      spawnParticles(G, { x: pos.x, y: 1.4, z: pos.z }, 0x555555, 3, 1, 2, 0.9);
    }
  }
  if (car.hp <= 0) explodeCar(G, car);
  return car.speed;
}

function spawnSkid(G, car) {
  const p = car.mesh.position;
  spawnParticles(G, { x: p.x, y: 0.2, z: p.z }, 0x888888, 2, 1.5, 0.5, 0.5);
}

export function explodeCar(G, car) {
  const p = car.mesh.position;
  spawnParticles(G, { x: p.x, y: 1, z: p.z }, 0xff7a1a, 40, 8, 10, 1.2);
  spawnParticles(G, { x: p.x, y: 1, z: p.z }, 0x333333, 20, 5, 8, 1.6);
  G.audio?.noiseBurst(0.6, 0.5);
  if (G.player.car === car) {
    G.player.car = null;
    G.player.onFoot = true;
    G.player.pos.copy(car.mesh.position);
    G.player.pos.x += 3;
  }
  removeCar(G, car);
}

// E near a car: steal it (pull the driver out if occupied) or enter it.
export function stealCar(G, car) {
  const wasOccupied = !!car.driver;
  if (car.driver) {
    car.driver = null;
  }
  car.owned = true;
  G.player.car = car;
  G.player.onFoot = false;
  G.stats.carsStolen += 1;
  if (wasOccupied) {
    G.audio?.horn();
    addWanted(G, 1, 'Mencuri mobil di depan umum');
  }
  G.audio?.blip(440, 0.1, 'sine', 0.12);
  return true;
}

export function exitCar(G) {
  const car = G.player.car;
  if (!car) return;
  const p = car.mesh.position;
  G.player.pos.set(p.x + Math.sin(car.yaw) * 3, 0, p.z + Math.cos(car.yaw) * 3);
  G.player.car = null;
  G.player.onFoot = true;
}

export function nearestCar(G, pos, maxDist = 5) {
  let best = null, bestD = maxDist;
  for (const car of G.cars) {
    if (car.police) continue;
    const dx = car.mesh.position.x - pos.x;
    const dz = car.mesh.position.z - pos.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function addWanted(G, stars, reason) {
  const before = G.wanted;
  G.wanted = Math.min(CFG.maxWanted, (G.wanted || 0) + stars);
  G.heatTimer = 0;
  G.lastWantedReason = reason || '';
  if (G.wanted > before) G.audio?.blip(660, 0.15, 'square', 0.1);
}
