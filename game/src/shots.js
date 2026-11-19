import { CFG } from './config.js';
import { makeCar } from './vehicles.js';
import { placePlayer, syncPlayerToCar } from './player.js';
import { startMission } from './missions.js';

function setCar(G, type, x, z, heading, speed) {
  if (G.car) { G.W.scene.remove(G.car.group); }
  const car = makeCar(type, x, z, heading, undefined, true);
  car.speed = speed || 0;
  car.isPlayer = true;
  G.W.scene.add(car.group);
  G.car = car;
  G.inCar = true;
  G.player.mesh.visible = false;
  syncPlayerToCar(G);
  return car;
}

function setOnFoot(G, x, z, heading) {
  if (G.car) { G.W.scene.remove(G.car.group); G.car = null; }
  G.inCar = false;
  G.player.mesh.visible = true;
  placePlayer(G, x, z, heading || 0);
}

export function applyShot(G, name) {
  G.shotMode = true;
  G.shotName = name;
  G.phase = 'play';
  G._shotWantedLock = true;
  G._shotPlaced = false;
  G._shotFrames = 0;
  if (G.hud) G.hud.setPhase('play');
  G.enemies = [];
  if (name === 'chase') {
    G.timeOfDay = 18.4;
    G.day = 1;
    setCar(G, 'veloce', 0, 30, 0, 26);
    G.wanted = 3;
    G.cash = 38420;
    G.missionIndex = 2; G.missionStage = 1;
    startMission(G, 2);
    G.missionStage = 1;
    G.missionTarget = { x: 0, z: 120, r: 7, label: 'Antar paket 2/3 — Old Solara' };
    if (G.hud) G.hud.showObjective('Antar paket 2/3 — Old Solara');
  } else if (name === 'drive') {
    G.timeOfDay = 17.6;
    G.day = 1;
    setCar(G, 'veloce', -240, -40, 0, 22);
    G.wanted = 0;
    G.cash = 10350;
    G.missionIndex = 2; G.missionStage = 0;
    startMission(G, 2);
    G.missionStage = 0;
    G.missionTarget = { x: 120, z: 120, r: 7, label: 'Antar paket 1/3 — The Spires' };
  } else if (name === 'street') {
    G.timeOfDay = 12.0;
    G.day = 1;
    setOnFoot(G, -60, 120, Math.PI);
    G.wanted = 0;
    G.cash = 10350;
    G.weapon = 2;
    G.missionIndex = 0; G.missionStage = 0;
    startMission(G, 0);
    G.missionStage = 0;
    G.missionTarget = { x: -232, z: 70, r: 6, label: 'Curi VELOZ COMET RS di Malecón' };
    G._promptText = 'E — Bicara';
  } else if (name === 'night') {
    G.timeOfDay = 21.5;
    G.day = 1;
    setCar(G, 'veloce', -230, 60, 0, 14);
    G.wanted = 1;
    G.cash = 24800;
    G.missionIndex = 4; G.missionStage = 0;
    startMission(G, 4);
    G.missionStage = 0;
    G.timeOfDay = 21.5; // startMission(3) does not force night; keep staged night
    G.missionTarget = { x: 0, z: 0, r: 45, label: 'Buntuti kurir Dario (jaga jarak 12–45 m)' };
  } else if (name === 'harbor') {
    G.timeOfDay = 19.0;
    G.day = 1;
    setOnFoot(G, -250, 84, -Math.PI / 2);
    G.wanted = 0;
    G.cash = 15200;
    G.missionIndex = 6; G.missionStage = 0;
    startMission(G, 6);
    G.missionStage = 0;
    G.missionTarget = { x: CFG.lighthouse.x, z: CFG.lighthouse.z, r: 9, label: 'Ke mercusuar' };
  } else {
    G.timeOfDay = 17.0;
    setOnFoot(G, CFG.playerStart.x, CFG.playerStart.z, 0);
    startMission(G, 0);
  }
  if (name === 'chase') G.wanted = 3;
  if (name === 'night') G.wanted = 1;
  if (name === 'drive' || name === 'street' || name === 'harbor') G.wanted = 0;
}

export function tickShot(G) {
  if (!G.shotMode) return;
  G._shotFrames++;
  const px = G.player.x, pz = G.player.z;
  const fx = Math.sin(G.player.heading), fz = Math.cos(G.player.heading);
  if (!G._shotPlaced) {
    if (G.shotName === 'chase') {
      if (G.policeCars.length >= 2) {
        G.policeCars.slice(0, 2).forEach((pc, i) => {
          if (i === 0) {
            pc.car.x = px + fx * 18 + 3.2 * fz;
            pc.car.z = pz + fz * 18 - 3.2 * fx;
          } else {
            pc.car.x = px - fx * 20 + 3.5 * fz;
            pc.car.z = pz - fz * 20 - 3.5 * fx;
          }
          pc.car.heading = G.player.heading;
          pc.car.speed = 24;
        });
        G._shotPlaced = true;
      }
      G.traffic.slice(0, 3).forEach((t, i) => {
        t.car.x = px + fx * (26 + i * 16) + (i % 2 ? 2.2 : -2.2) * fz;
        t.car.z = pz + fz * (26 + i * 16) - (i % 2 ? 2.2 : -2.2) * fx;
        t.car.heading = G.player.heading;
        t.car.speed = 10;
        t.axis = 'z'; t.line = 0; t.dir = 1;
      });
    } else if (G.shotName === 'drive') {
      G.traffic.slice(0, 3).forEach((t, i) => {
        t.car.x = -240 + (i % 2 ? 2.2 : -2.2);
        t.car.z = -40 + 30 + i * 18;
        t.car.heading = 0;
        t.car.speed = 10;
        t.axis = 'z'; t.line = -240; t.dir = 1;
      });
      G.peds.slice(0, 4).forEach((p, i) => {
        p.x = -249; p.z = -30 + i * 9; p.axis = 'z'; p.dir = 1;
      });
      G._shotPlaced = true;
    } else if (G.shotName === 'street') {
      G.peds.slice(0, 6).forEach((p, i) => {
        p.x = -60 + (i % 3 - 1) * 5;
        p.z = 120 + (Math.floor(i / 3) - 0.5) * 12 + i * 2;
        p.axis = 'x'; p.dir = i % 2 ? 1 : -1;
      });
      G._shotPlaced = true;
    } else if (G.shotName === 'night') {
      G.traffic.slice(0, 2).forEach((t, i) => {
        t.car.x = -240 + (i % 2 ? 2.2 : -2.2);
        t.car.z = 60 + 24 + i * 16;
        t.car.heading = 0;
        t.car.speed = 9;
        t.axis = 'z'; t.line = -240; t.dir = 1;
      });
      G._shotPlaced = true;
    } else {
      G._shotPlaced = true;
    }
  }
  if (G._shotFrames > 4 && !window.__shotReady) {
    window.__shotReady = true;
  }
}
