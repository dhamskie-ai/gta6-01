// Nico jalan kaki + kamera third-person (chase cam). Mouse / geser jari
// memutar kamera, C / tombol KAM ganti jarak, E masuk-keluar mobil.
import { mulberry32 } from './random.js';
import { makePersonModel } from './traffic.js';
import { collideBuildings } from './city.js';
import { updatePlayerCar } from './vehicles.js';
import { clamp, wrapAngle } from './random.js';
import { CFG } from './config.js';

export function createPlayer(W) {
  const rng = mulberry32(W.seed + 5);
  const group = makePersonModel(W.three, rng, { skin: 0xe8b88a, shirt: 0x2a7bd2, pants: 0x2a2e33, noHat: false });
  group.position.set(CFG.spawn.x, 0, CFG.spawn.z);
  W.scene.add(group);
  // Pistol di tangan kanan (terlihat bila senjata > FISTS).
  const gun = new W.three.Mesh(new W.three.BoxGeometry(0.09, 0.16, 0.42),
    new W.three.MeshLambertMaterial({ color: 0x1a1d22 }));
  gun.position.set(0.34, 0.85, 0.28);
  gun.visible = false;
  group.add(gun);
  const P = {
    group, gun, x: CFG.spawn.x, z: CFG.spawn.z, y: 0, vy: 0,
    heading: CFG.spawn.heading, camYaw: CFG.spawn.heading, camPitch: 0.32,
    camDist: 7, camMode: 0, speed: 0, phase: 0,
    car: null, onGround: true, walkTarget: null,
  };
  W.player = P;
  return P;
}
export function tryEnterCar(W) {
  const P = W.player;
  if (P.car) { exitCar(W); return true; }
  // Cari mobil terdekat dalam 4,5 m (parkir / traffic / misi).
  let best = null, bd = 4.5;
  for (const car of W.cars.list) {
    if (car.driver === 'police' || car.driver === 'courier' || car.driver === 'rival') continue;
    const d = Math.hypot(car.x - P.x, car.z - P.z);
    if (d < bd) { bd = d; best = car; }
  }
  if (!best) return false;
  if (best.driver === 'traffic') {
    // Pengemudi ditarik keluar, kabur.
    best.driver = 'parked';
    W.audio.blip(300, 0.15, 'square', 0.25, -100);
  }
  if (best === W.traffic.missionCar && W.missions.current === 0 && !W.missions.flags.stoleVeloz) {
    W.missions.flags.stoleVeloz = true;
    W.hud.toast('VELOZ COMET RS dicuri! Antar ke bengkel Mara.');
  }
  best.driver = 'player';
  P.car = best;
  P.group.visible = false;
  W.audio.engine(true, 0);
  W.hud.setPrompt('');
  if (W.police.nearbyPolice(P.x, P.z, 25)) {
    W.police.addWanted(W, 1, 'curi mobil di depan PCPD');
  }
  return true;
}
export function exitCar(W) {
  const P = W.player;
  if (!P.car) return;
  const car = P.car;
  car.driver = 'parked';
  car.speed = 0;
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  P.x = car.x - fx * 2.6; P.z = car.z - fz * 2.6;
  P.heading = car.heading;
  P.car = null;
  P.group.visible = true;
  P.group.position.set(P.x, 0, P.z);
  W.audio.engine(false);
}
export function updatePlayer(W, dt) {
  const P = W.player;
  const input = W.input;
  const look = input.lookDelta();
  P.camYaw = wrapAngle(P.camYaw - look.dx * 0.0032);
  P.camPitch = clamp(P.camPitch + look.dy * 0.0022, -0.15, 1.1);
  if (input.action('camera')) {
    P.camMode = (P.camMode + 1) % 3;
    P.camDist = [7, 11, 4.5][P.camMode];
    W.hud.toast(['Kamera: dekat', 'Kamera: jauh', 'Kamera: kap mesin'][P.camMode]);
  }
  if (P.car) {
    // Mengemudi: joystick / WASD.
    const axis = input.moveAxis();
    const ctrl = {
      throttle: axis.y,
      steer: -axis.x,
      brake: input.brake() && axis.y <= 0,
      handbrake: input.action('handbrake'),
    };
    if (input.action('horn')) W.audio.horn();
    updatePlayerCar(W, P.car, dt, ctrl);
    W.audio.engine(true, Math.abs(P.car.speed) / P.car.spec.top);
    if (input.action('enter')) exitCar(W);
    updateCamera(W, dt);
    return;
  }
  // Jalan kaki.
  const axis = input.moveAxis();
  const sprint = input.action('sprint');
  const speed = sprint ? CFG.runSpeed : CFG.walkSpeed;
  let mx = 0, mz = 0;
  if (axis.x !== 0 || axis.y !== 0) {
    const sin = Math.sin(P.camYaw), cos = Math.cos(P.camYaw);
    mx = sin * axis.y + cos * axis.x;
    mz = cos * axis.y - sin * axis.x;
    const len = Math.hypot(mx, mz) || 1;
    mx /= len; mz /= len;
    P.heading = Math.atan2(mx, mz);
  }
  const targetSpeed = (axis.x !== 0 || axis.y !== 0) ? speed : 0;
  P.speed += (targetSpeed - P.speed) * Math.min(1, dt * 10);
  P.x += mx * P.speed * dt;
  P.z += mz * P.speed * dt;
  // Gravitasi + lompat.
  if (input.action('jump') && P.onGround) { P.vy = CFG.jumpSpeed; P.onGround = false; }
  P.vy -= CFG.gravity * dt;
  P.y += P.vy * dt;
  if (P.y <= 0) { P.y = 0; P.vy = 0; P.onGround = true; }
  const hit = collideBuildings(W, P.x, P.z, CFG.playerRadius);
  if (hit) { P.x += hit.x; P.z += hit.z; }
  // Dermaga: koridor pejalan kaki ke ujung pier (x sampai -352, z ~60).
  const minX = Math.abs(P.z - 60) < 6 ? -352 : -308;
  P.x = clamp(P.x, minX, 308); P.z = clamp(P.z, -308, 308);
  // Animasi jalan prosedural.
  P.phase += dt * P.speed * 2.2;
  const swing = Math.sin(P.phase) * (P.speed > 0.5 ? 0.6 : 0);
  const parts = P.group.userData.parts;
  parts.legL.rotation.x = swing; parts.legR.rotation.x = -swing;
  parts.armL.rotation.x = -swing * 0.8; parts.armR.rotation.x = swing * 0.8;
  P.group.position.set(P.x, P.y, P.z);
  P.group.rotation.y = P.heading;
  if (P.gun) P.gun.visible = W.combat.weapon > 0 && !P.car;
  // Prompt konteks: mobil di dekat?
  let nearCar = null, bd = 4.5;
  for (const car of W.cars.list) {
    if (car.driver === 'police' || car.driver === 'courier' || car.driver === 'rival') continue;
    const d = Math.hypot(car.x - P.x, car.z - P.z);
    if (d < bd) { bd = d; nearCar = car; }
  }
  if (nearCar) W.hud.setPrompt(`E — ${nearCar.driver === 'traffic' ? 'Curi' : 'Naik'} ${nearCar.spec.name}`);
  else if (W.missions.nearInteract) W.hud.setPrompt(W.missions.nearInteract);
  else W.hud.setPrompt('');
  if (input.action('enter')) {
    if (!tryEnterCar(W) && W.missions.onInteract) W.missions.onInteract(W);
  }
  updateCamera(W, dt);
}
export function updateCamera(W, dt) {
  const P = W.player;
  const cam = W.camera;
  const cx = P.car ? P.car.x : P.x;
  const cz = P.car ? P.car.z : P.z;
  const cy = P.car ? 1.2 : P.y + 1.7;
  // Kamera mengikuti heading mobil saat nyetir, bebas saat jalan kaki.
  const yaw = P.car ? P.car.heading : P.camYaw;
  const dist = P.camDist;
  const pitch = P.camPitch;
  const ox = Math.sin(yaw) * Math.cos(pitch) * dist;
  const oz = Math.cos(yaw) * Math.cos(pitch) * dist;
  const oy = Math.sin(pitch) * dist + 1.2;
  const tx = cx - ox, tz = cz - oz, ty = cy + oy;
  const k = Math.min(1, dt * 9);
  cam.position.x += (tx - cam.position.x) * k;
  cam.position.y += (ty - cam.position.y) * k;
  cam.position.z += (tz - cam.position.z) * k;
  cam.lookAt(cx, cy + 0.6, cz);
}
