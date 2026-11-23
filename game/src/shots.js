// Deterministic shot scenes (?shot=chase|drive|street|night|touch|
// road-zoom|phone). Each stages the player, cars, police, mission panel
// and dialogue, then main.js sets window.__shotReady after 3 frames.
import { CFG, MISSIONS } from './config.js';
import { startMission } from './missions.js';
import { showDialog, showObjective } from './hud.js';
import { setWanted, spawnPoliceCar, stagePolice } from './police.js';
import { isCarObj } from './vehicles.js';

function putInVeloz(G, x, z, heading, kmh) {
  const car = G.veloz;
  car.x = x; car.z = z; car.heading = heading;
  car.speed = kmh / 3.6;
  car.driver = 'player'; car.owner = 'player';
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = heading;
  const p = G.player;
  p.car = car; p.onFoot = false; p.x = x; p.z = z; p.heading = heading;
  p.mesh.visible = false;
  G.camYaw = heading;
}
function putOnFoot(G, x, z, heading) {
  const p = G.player;
  if (isCarObj(p.car)) { p.car.driver = 'parked'; p.car = null; }
  p.onFoot = true; p.x = x; p.z = z; p.heading = heading;
  p.mesh.visible = true;
  p.mesh.position.set(x, 0, z);
  p.mesh.rotation.y = heading;
  G.camYaw = heading;
}
export function applyShot(G, name) {
  G.shotMode = true;
  G.phase = 'play';
  G.shotScene = name;
  G.shotDialog = null; G.shotSpeed = null;
  // clear existing cops (shots stage their own)
  for (const u of [...G.cops]) {
    if (u.car) { G.fx.scene.remove(u.car.mesh); G.cars.splice(G.cars.indexOf(u.car), 1); }
    if (u.foot) G.fx.scene.remove(u.mesh);
  }
  G.cops = [];
  G.wanted = 0; G.heat = 0;
  G.cash = 10350;
  G.stats.missionsDone = 3;
  if (name === 'chase') {
    G.timeOfDay = 18.0;
    startMission(G, 7);
    G.msn.step = 3; // escape — STAGE 4/5
    G.msn.timer = 107;
    G.cash = 86250;
    putInVeloz(G, -240, 80, Math.PI, 112);
    setWanted(G, 4);
    showObjective(G, 'Lose the manhunt before Marco\'s boat sails');
    G.shotDialog = 'Marco: The boat sails in two minutes, Nico! Shake that chopper and get to the pier!';
    G.shotSpeed = 112;
    // 4 police cars in chase formation + helicopter (wanted 4)
    for (let i = 0; i < 4; i++) spawnPoliceCar(G, -240, 80);
    stagePolice(G, G.cops);
    if (G.heli) G.heli.g.visible = true;
  } else if (name === 'drive') {
    G.timeOfDay = 17.5;
    startMission(G, 1);
    putInVeloz(G, -240, -40, 0, 68);
    showObjective(G, 'Free roam — Malecón Celeste');
    G.shotSpeed = 68;
  } else if (name === 'street') {
    G.timeOfDay = 12;
    startMission(G, 1);
    G.msn.step = 1; // talk step — prompt + beacon on Marco
    putOnFoot(G, -241.5, 64, Math.PI / 2);
    G.marco.mesh.position.set(CFG.marcoPos.x, 0, CFG.marcoPos.z);
    showObjective(G, 'Talk to Marco (E)');
    G.shotDialog = 'Marco: Nico! Over here — by the ceviche stand.';
  } else if (name === 'night') {
    G.timeOfDay = 21;
    startMission(G, 4);
    putInVeloz(G, -252, 108, Math.PI, 43);
    setWanted(G, 1);
    showObjective(G, 'Tail the courier — stay back');
    G.shotSpeed = 43;
    // 2 foot cops on patrol near the car (PCPD panel shows units)
    for (let i = 0; i < 2; i++) {
      spawnPoliceCar(G, -252, 108);
    }
    // replace the 2 cars with foot cops for a quiet night scene
    for (const u of [...G.cops]) {
      if (u.car) {
        G.fx.scene.remove(u.car.mesh);
        G.cars.splice(G.cars.indexOf(u.car), 1);
        G.cops.splice(G.cops.indexOf(u), 1);
      }
    }
    const footNames = ['PELICAN-11', 'GECKO-25'];
    footNames.forEach((name, i) => {
      const mesh = G.marco.mesh.clone();
      mesh.position.set(-248 + i * 6, 0, 104 + i * 3);
      G.fx.scene.add(mesh);
      G.cops.push({ foot: true, mesh, x: -248 + i * 6, z: 104 + i * 3,
        heading: 0, callsign: name, role: 'PATROL' });
    });
  } else if (name === 'touch') {
    G.timeOfDay = 17.5;
    G.touchMode = true;
    if (G.touch) G.touch.active = true;
    const wrap = document.getElementById('touch-controls');
    if (wrap) wrap.classList.remove('hidden');
    startMission(G, 1);
    putInVeloz(G, -240, 0, 0, 68);
    showObjective(G, 'Free roam — Malecón Celeste');
    G.shotSpeed = 68;
  } else if (name === 'road-zoom') {
    G.timeOfDay = 12;
    startMission(G, 1);
    putInVeloz(G, 0, 10, 0, 0);
    if (G.beacon) G.beacon.visible = false;
    G.camDist = 4;
    showObjective(G, 'Free roam — The Spires');
  } else if (name === 'phone') {
    G.timeOfDay = 18.5;
    startMission(G, 1);
    putOnFoot(G, -258, 20, -Math.PI / 2);
    G.marco.mesh.position.set(-264, 0, 23);
    G.veloz.x = -258; G.veloz.z = 30; G.veloz.heading = Math.PI;
    G.veloz.mesh.position.set(-258, 0, 30);
    G.veloz.mesh.rotation.y = Math.PI;
    showObjective(G, 'Free roam — Malecón Celeste');
    G.shotDialog = 'Marco: Sunset on the Malecón. This city never sleeps, Nico.';
  }
  // refresh the mission panel text for the staged mission
  if (G.msn.active) {
    const d = MISSIONS[G.msn.idx];
    if (d && d.steps[G.msn.step]) showObjective(G, d.steps[G.msn.step].label);
  }
  G.shotFrames = 0;
}
export function shotTick(G) {
  if (G.shotDialog) showDialog(G, G.shotDialog);
  const car = isCarObj(G.player.car) ? G.player.car : null;
  if (car && G.shotSpeed) car.speed = G.shotSpeed / 3.6;
  // keep the staged police formation (updatePolice may have moved them)
  if (G.shotScene === 'chase' && G.cops.length) stagePolice(G, G.cops);
  if (G.shotScene === 'night') {
    // foot cops hold their staged spots
    G.cops.forEach((u, i) => {
      if (u.foot) { u.x = -248 + i * 6; u.z = 104 + i * 3; u.mesh.position.set(u.x, 0, u.z); }
    });
  }
  if (G.shotScene === 'street' && G.marco) {
    G.marco.mesh.position.set(CFG.marcoPos.x, 0, CFG.marcoPos.z);
  }
  if (G.shotScene === 'phone' && G.marco) {
    G.marco.mesh.position.set(-264, 0, 23);
  }
  if (G.shotScene === 'road-zoom' && G.beacon) G.beacon.visible = false;
}
