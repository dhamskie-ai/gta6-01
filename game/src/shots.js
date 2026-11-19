// SOLARA BAY — deterministic screenshot scenes (?shot=chase|drive|street|
// night&seed=1). Each scene stages the player, cars, police, wanted level,
// time of day and mission, then waits a few frames and sets
// window.__shotReady so the capture tool knows the frame is settled.
// Cover (chase) shows the most systems at once: pursuit, wanted stars,
// minimap, mission marker, speed, traffic, the Spires.
import { CFG } from './config.js';
import { makeCar } from './vehicles.js';
import { placePlayer, syncPlayerToCar, updateCamera } from './player.js';
import { startMission } from './missions.js';

function addChaseCar(G, type, x, z, heading, color) {
  const car = makeCar(type, x, z, heading, color, false);
  car.traffic = true;
  G.W.scene.add(car.group);
  G.traffic.push({ car, kind: 'traffic' });
  return car;
}

export function applyShot(G, name) {
  G.shotMode = true;
  G.phase = 'play';
  if (name === 'chase') {
    // Golden-hour downtown pursuit: player in the pink VELOZ, 2 PCPD cars
    // closing in, wanted 3, mission 8 beacon on the minimap.
    G.timeOfDay = 17.8;
    placePlayer(G, 0, 40, Math.PI);
    const hero = makeCar('veloce', 0, 36, Math.PI, 0xff2e7e, true);
    G.W.scene.add(hero.group);
    G.car = hero; G.inCar = true;
    syncPlayerToCar(G);
    const p1 = makeCar('police', -6, 20, Math.PI, undefined, true);
    G.W.scene.add(p1.group);
    G.policeCars.push({ car: p1, callsign: 'PELICAN-11' });
    const p2 = makeCar('police', 7, 52, Math.PI, undefined, true);
    G.W.scene.add(p2.group);
    G.policeCars.push({ car: p2, callsign: 'GECKO-25' });
    addChaseCar(G, 'cometa', -4, 60, 0, 0x3f6fb5);
    addChaseCar(G, 'cabro', 5, 12, Math.PI, 0xf2c200);
    G.cash = 86250;
    startMission(G, 7);
    G.wanted = 3;
    G.missionTimer = 107;
  } else if (name === 'drive') {
    // Golden hour on the Malecón: sport car on the coast road, traffic,
    // pedestrians on the boardwalk, sea + sunset sky, palms.
    G.timeOfDay = 17.4;
    placePlayer(G, -238, 30, 0);
    const hero = makeCar('veloce', -238, 34, 0, 0xff2e7e, true);
    G.W.scene.add(hero.group);
    G.car = hero; G.inCar = true;
    syncPlayerToCar(G);
    addChaseCar(G, 'cometa', -238, 60, 0, 0x3f6fb5);
    addChaseCar(G, 'pip', -234, 8, Math.PI, 0xe8b93a);
    addChaseCar(G, 'cabro', -238, 90, 0, 0xf2c200);
    G.wanted = 0;
    G.cash = 10350;
    startMission(G, 1);
  } else if (name === 'street') {
    // Midday in Old Solara: Nico on foot in the market street, pedestrians
    // around, Marco + mission marker, "E — Bicara" prompt.
    G.timeOfDay = 12.0;
    placePlayer(G, -236, 84, -0.93);
    G.wanted = 0;
    G.cash = 10350;
    G.weapon = 1;
    startMission(G, 1);
    G._promptText = 'E — Bicara dengan Marco';
  } else if (name === 'night') {
    // Night at Marina Bay: neon signs, headlights on, wanted 1, the pier
    // and ferris wheel behind, minimap at night.
    G.timeOfDay = 21.5;
    placePlayer(G, -238, 120, 0);
    const hero = makeCar('cometa', -238, 124, 0, 0x3f6fb5, true);
    G.W.scene.add(hero.group);
    G.car = hero; G.inCar = true;
    syncPlayerToCar(G);
    const p1 = makeCar('police', -238, 100, 0, undefined, true);
    G.W.scene.add(p1.group);
    G.policeCars.push({ car: p1, callsign: 'BARRACUDA-18' });
    G.wanted = 1;
    G.cash = 10350;
    startMission(G, 4);
    // Keep the tail courier near the player so the staged scene never
    // trips the "courier escaped" fail while the shot settles.
    if (G._chaseCar) {
      G._chaseCar.x = -210; G._chaseCar.z = 120;
      G._chaseCar.group.position.set(-210, 0, 120);
      G._courierRoute = { x: -180, z: 120 };
    }
  } else {
    G.timeOfDay = 12.0;
    placePlayer(G, CFG.playerStart.x, CFG.playerStart.z, 0);
  }
  G.player.camYaw = G.inCar && G.car ? G.car.heading + Math.PI : G.player.heading + Math.PI;
  G.player.camDist = G.inCar ? 10 : 6.5;
  // Snap the chase camera to its staged position at once: at ~2 fps the
  // normal lerp would still be travelling (through buildings) when the
  // capture fires 8 frames in.
  updateCamera(G, 1);
  window.__shotReady = false;
  G._shotFrames = 0;
}

export function tickShot(G) {
  if (!G.shotMode) return;
  G._shotFrames = (G._shotFrames || 0) + 1;
  // Let the camera settle and the sky/birds animate a few frames in.
  if (G._shotFrames === 3) {
    if (G.inCar && G.car) {
      G.car.speed = 14;
    }
  }
  if (G._shotFrames >= 8) window.__shotReady = true;
}
