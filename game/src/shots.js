// Deterministic screenshot scenes (?shot=...&seed=8). Each scene stages
// the player, cars, police, wanted level and time of day, waits a few
// frames, then sets window.__shotReady. If staging throws, the error is
// logged but the shot still resolves — a hung shot helps nobody.
import { G, CFG } from './config.js';
import { makeCar, isCarObj } from './vehicles.js';
import { forceDrive, teleportPlayer } from './player.js';
import { startMission, spawnMarco, spawnLupe } from './missions.js';
import { setWanted } from './police.js';
import { showDialog } from './hud.js';

function sportAt(x, z, heading, speed) {
  const car = makeCar('sport', x, z, heading);
  car.driver = false;
  G.cars.push(car);
  forceDrive(car, speed);
  return car;
}

function flankPolice() {
  for (const [x, z, name] of [[5, 34, 'KESTREL-31'], [-5, 48, 'BARRACUDA-18']]) {
    const p = makeCar('police', x, z, 0);
    p.speed = 30; p.callsign = name; p.role = 'RAMMING'; p.kind = 'car';
    G.police.push(p);
  }
}

function nearTraffic(n, x, z, heading) {
  let placed = 0;
  for (const c of G.traffic) {
    if (!isCarObj(c) || placed >= n) continue;
    c.x = x + placed * 9; c.z = z + placed * 14; c.heading = heading;
    c.speed = 10; c.horiz = false;
    placed++;
  }
}

export function setupShot(name) {
  try {
    G.shotFrames = 0; G.shotReady = false;
    if (name === 'chase') {
      G.timeOfDay = 18.0; G.cash = 86250;
      startMission(2);
      sportAt(0, 40, 0, 31); // 112 km/h down the boulevard
      setWanted(4);
      flankPolice();
      G.camDist = 12;
    } else if (name === 'drive') {
      G.timeOfDay = 17.5; G.cash = 10350;
      startMission(2);
      sportAt(-240, -40, 0, 19); // 68 km/h on the Malecón road
      setWanted(0);
      nearTraffic(3, -240, 10, 0);
      G.camDist = 11;
    } else if (name === 'street') {
      G.timeOfDay = 12.0; G.cash = 10350;
      startMission(1);
      teleportPlayer(-241.5, 64, Math.PI / 2);
      spawnMarco();
      spawnLupe();
      setWanted(0);
      G.camYaw = Math.PI / 2; G.camDist = 8;
      showDialog('Marco', 'SMUGGLER · WHEELMAN', 'Nico! Over here — Marlin Ceviche. We talk, then you drive me to the pier.');
    } else if (name === 'night') {
      G.timeOfDay = 21.5; G.cash = 10350;
      startMission(4);
      sportAt(-252, 108, 0, 12); // 43 km/h, headlights on
      setWanted(1);
      nearTraffic(1, -244, 126, 0);
      G.camDist = 11;
    } else if (name === 'roadzoom') {
      // Close-up of the road surface: dashes + zebra must read sharp.
      G.timeOfDay = 15.0; G.cash = 10350;
      startMission(0);
      teleportPlayer(5, -10, 0);
      const car = makeCar('sport', 7, 26, 0.15);
      car.driver = false; G.cars.push(car);
      setWanted(0);
      G.shotCam = { pos: [1.5, 2.4, -16], look: [0.5, 0.2, 34] };
    } else if (name === 'touch') {
      G.timeOfDay = 17.8; G.cash = 10350;
      startMission(2);
      sportAt(-240, -30, 0, 16);
      setWanted(0);
      nearTraffic(2, -240, 16, 0);
      G.camDist = 11;
    } else if (name === 'phone') {
      G.timeOfDay = 18.0; G.cash = 10350;
      startMission(1);
      teleportPlayer(-258, 20, -Math.PI / 2);
      spawnMarco();
      setWanted(0);
      G.camYaw = -Math.PI / 2; G.camPitch = -0.08; G.camDist = 7;
    }
  } catch (e) {
    console.error('setupShot failed:', e && e.message ? e.message : e);
  }
}

// Called once per frame from the main loop while shotMode is on.
export function shotTick() {
  if (G.shotCam) {
    // fixed close-up camera, applied after the normal chase cam
    G.camera.position.set(G.shotCam.pos[0], G.shotCam.pos[1], G.shotCam.pos[2]);
    G.camera.lookAt(G.shotCam.look[0], G.shotCam.look[1], G.shotCam.look[2]);
  }
  if (G.shotName === 'street' || G.shotName === 'phone') {
    // re-show every frame: at ~1 fps in SwiftShader the 5.2 s dialog
    // timeout would otherwise expire before the screenshot is taken.
    showDialog('Marco', 'SMUGGLER · WHEELMAN', 'Nico! Over here — Marlin Ceviche. We talk, then you drive me to the pier.');
  }
  G.shotFrames++;
  if (!G.shotReady && G.shotFrames >= 5) {
    G.shotReady = true;
    window.__shotReady = true;
  }
}
