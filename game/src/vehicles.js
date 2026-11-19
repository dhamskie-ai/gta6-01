// Model mobil prosedural + fisika arcade pemain.
import { CAR_TYPES, CONFIG } from './config.js';
import { clamp } from './random.js';

export function createCarModel(THREE, type, colorOverride) {
  const def = CAR_TYPES[type];
  const color = colorOverride !== undefined ? colorOverride : def.color;
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2836 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x14181f });
  const long = type === 'bus' ? 7.2 : type === 'truck' || type === 'van' ? 5.6 : 4.4;
  const wide = type === 'bus' || type === 'truck' ? 2.4 : 1.9;
  const body = new THREE.Mesh(new THREE.BoxGeometry(wide, 0.75, long), bodyMat);
  body.position.y = 0.65; body.castShadow = true; g.add(body);
  const cabinH = type === 'bus' ? 1.5 : 0.62;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(wide - 0.25, cabinH, long * 0.5), bodyMat);
  cabin.position.set(0, 1.3, type === 'bus' ? 0 : -0.3); cabin.castShadow = true; g.add(cabin);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(wide - 0.35, 0.55, 0.12), glassMat);
  shield.position.set(0, 1.35, long * 0.22); shield.rotation.x = -0.35; g.add(shield);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(wide - 0.2, 0.08, long * 0.48), bodyMat);
  roof.position.set(0, 1.3 + cabinH / 2, -0.3); g.add(roof);
  for (const s of [-1, 1]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.3), darkMat);
    mirror.position.set(s * (wide / 2 + 0.08), 1.25, long * 0.18); g.add(mirror);
    const bumpF = new THREE.Mesh(new THREE.BoxGeometry(wide, 0.22, 0.3), darkMat);
    bumpF.position.set(0, 0.42, long / 2); g.add(bumpF);
    const bumpR = new THREE.Mesh(new THREE.BoxGeometry(wide, 0.22, 0.3), darkMat);
    bumpR.position.set(0, 0.42, -long / 2); g.add(bumpR);
  }
  if (type === 'sport') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(wide - 0.2, 0.08, 0.5), darkMat);
    spoiler.position.set(0, 1.35, -long / 2 + 0.1); g.add(spoiler);
    for (const s of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), darkMat);
      strut.position.set(s * 0.6, 1.15, -long / 2 + 0.1); g.add(strut);
    }
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    sign.position.set(0, 1.85, -0.3); g.add(sign);
  }
  if (type === 'truck') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(wide - 0.2, 0.5, long * 0.42), darkMat);
    bed.position.set(0, 1.15, -long * 0.26); g.add(bed);
  }
  if (type === 'taco') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(wide - 0.4, 0.8, 1.4),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    sign.position.set(0, 1.6, 0); g.add(sign);
  }
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tlMat = new THREE.MeshBasicMaterial({ color: 0xff2a22 });
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), hlMat);
    hl.position.set(s * (wide / 2 - 0.3), 0.72, long / 2 + 0.02); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), tlMat);
    tl.position.set(s * (wide / 2 - 0.3), 0.72, -long / 2 - 0.02); g.add(tl);
  }
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14181f });
  for (const [wx, wz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx * (wide / 2 - 0.1), 0.38, wz * (long / 2 - 0.8));
    g.add(w); wheels.push(w);
  }
  let barL = null, barR = null;
  if (type === 'police') {
    barL = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2a22 }));
    barL.position.set(-0.38, 1.78, -0.3); g.add(barL);
    barR = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x2a6bff }));
    barR.position.set(0.38, 1.78, -0.3); g.add(barR);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(wide + 0.02, 0.3, long * 0.9),
      new THREE.MeshLambertMaterial({ color: 0xf2ede2 }));
    stripe.position.y = 0.65; g.add(stripe);
  }
  g.userData = { wheels, barL, barR, length: long, width: wide };
  return g;
}

export function spawnCar(G, THREE, city, type, x, z, yaw, opts) {
  const o = opts || {};
  const def = CAR_TYPES[type];
  const mesh = createCarModel(THREE, type, o.color);
  mesh.position.set(x, 0, z); mesh.rotation.y = yaw;
  G.scene.add(mesh);
  const car = {
    type, def, name: def.name, x, z, yaw, speed: 0, steer: 0,
    hp: def.hp, maxHp: def.hp, mesh, y: 0, vy: 0, airborne: false,
    isPlayer: !!o.isPlayer, parked: !!o.parked, stolen: false,
    driver: o.driver !== false, ai: o.ai || null, color: o.color || def.color,
    radius: 2.1, lightPhase: Math.random() * 2,
  };
  G.cars.push(car);
  return car;
}

function collideCar(G, city, car, nx, nz) {
  if (city.collide(nx, nz, 1.6)) return true;
  for (const o of G.cars) {
    if (o === car || o.hp <= 0) continue;
    const dx = nx - o.x, dz = nz - o.z;
    if (dx * dx + dz * dz < (2.1 + 2.1) * (2.1 + 2.1) * 0.55) return o;
  }
  return false;
}

export function updatePlayerCar(G, dt, input, city) {
  const car = G.playerCar;
  if (!car) return;
  const def = car.def;
  const fwd = { x: Math.sin(car.yaw), z: Math.cos(car.yaw) };
  const accelIn = input.keys.has('KeyW') || input.keys.has('ArrowUp');
  const brakeIn = input.keys.has('KeyS') || input.keys.has('ArrowDown');
  const handbrake = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const steerIn = (input.keys.has('KeyA') || input.keys.has('ArrowLeft') ? 1 : 0)
    - (input.keys.has('KeyD') || input.keys.has('ArrowRight') ? 1 : 0);
  if (accelIn) car.speed += def.accel * dt * (car.speed < 0 ? 2.2 : 1);
  if (brakeIn) {
    if (car.speed > 0.5) car.speed -= CONFIG.carBrake * dt;
    else car.speed -= def.accel * 0.6 * dt;
  }
  car.speed -= car.speed * CONFIG.carDrag * dt * (handbrake ? 2.4 : 1);
  car.speed = clamp(car.speed, -CONFIG.carMaxReverse, def.top);
  if (!accelIn && !brakeIn && Math.abs(car.speed) < 0.4) car.speed = 0;
  const grip = handbrake ? CONFIG.handbrakeGrip : def.grip;
  car.yaw += steerIn * clamp(car.speed / 12, -1, 1) * 0.55 * grip * dt;
  car.steer = steerIn;
  const nx = car.x + fwd.x * car.speed * dt;
  const nz = car.z + fwd.z * car.speed * dt;
  // shot mode: lewati tabrakan antar-mobil (jangan pantul / rusak saat staging)
  const hit = G.shotMode
    ? (city.collide(nx, nz, 1.6) ? true : false)
    : collideCar(G, city, car, nx, nz);
  if (hit === true) {
    car.speed *= -0.25;
    if (Math.abs(car.speed) > 6) { car.hp -= 4; G.audio.punch(); }
  } else if (hit) {
    const o = hit;
    const push = 0.5;
    car.x -= fwd.x * push; car.z -= fwd.z * push;
    o.x += fwd.x * push * 0.6; o.z += fwd.z * push * 0.6;
    const dmg = Math.abs(car.speed) * 0.35;
    if (dmg > 3) {
      car.hp -= dmg; o.hp -= dmg * 0.7;
      G.audio.punch();
      if (G.shotMode !== true && Math.abs(car.speed) > 8) car.speed *= 0.55;
    }
    car.speed *= 0.7;
  } else {
    car.x = nx; car.z = nz;
  }
  // ramp stunt jump
  if (!car.airborne) {
    for (const r of city.ramps) {
      const dx = car.x - r.x, dz = car.z - r.z;
      if (dx * dx + dz * dz < 9 && Math.abs(car.speed) > 15) {
        car.vy = 8; car.airborne = true;
        G.stats.jumps = (G.stats.jumps || 0) + 1;
        break;
      }
    }
  }
  if (car.airborne) {
    car.vy -= 22 * dt; car.y += car.vy * dt;
    if (car.y <= 0) { car.y = 0; car.airborne = false; car.vy = 0; }
  }
  car.mesh.position.set(car.x, car.y, car.z);
  car.mesh.rotation.y = car.yaw;
  car.mesh.rotation.z = -car.steer * clamp(car.speed / 20, -1, 1) * 0.05;
  // sinkronkan posisi pemain dgn mobil — misi/polisi/HUD/minimap baca G.player
  G.player.x = car.x; G.player.z = car.z;
  for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.2;
  if (car.hp <= 0) explodeCar(G, car);
}

export function explodeCar(G, car) {
  if (car.dead) return;
  car.dead = true; car.hp = 0;
  G.renderFx.burst(car.x, 1, car.z, 0xff8a3d, 26);
  G.renderFx.burst(car.x, 1, car.z, 0x444444, 18);
  G.audio.noise(0.6, 0.5, 500);
  if (car === G.playerCar) {
    G.playerCar = null; G.player.inCar = false;
    G.player.x = car.x + 3; G.player.z = car.z + 3;
    G.player.y = 0;
    damagePlayer(G, 30);
  }
  car.mesh.visible = false;
}

export function damagePlayer(G, n) {
  if (G.phase !== 'play') return;
  const absorbed = Math.min(G.armor, n * 0.6);
  G.armor -= absorbed;
  G.health -= (n - absorbed);
  if (G.health <= 0) {
    G.health = 0;
    G.phase = G.wanted > 0 && !G.player.inCar ? 'busted' : 'dead';
    G.audio.fail();
  }
}

export function stealCar(G, car) {
  if (!car || car.dead) return false;
  G.playerCar = car; G.player.inCar = true; car.isPlayer = true; car.parked = false;
  car.stolen = true; G.stats.stolen = (G.stats.stolen || 0) + 1;
  if (car.driver) {
    car.driver = false;
    G.traffic.fleePed(G, car.x + 2, car.z + 2);
  }
  let seen = false;
  for (const p of G.policeCars) {
    const dx = p.x - car.x, dz = p.z - car.z;
    if (dx * dx + dz * dz < 50 * 50) { seen = true; break; }
  }
  if (seen) G.police.addWanted(G, 1);
  G.audio.horn();
  return true;
}

export function exitCar(G) {
  const car = G.playerCar;
  if (!car) return;
  car.isPlayer = false;
  G.playerCar = null; G.player.inCar = false;
  G.player.x = car.x + Math.cos(car.yaw) * 2.5;
  G.player.z = car.z - Math.sin(car.yaw) * 2.5;
  G.player.y = 0; G.player.yaw = car.yaw;
}
