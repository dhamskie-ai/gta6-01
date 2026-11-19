// Deterministic staged scenes: ?shot=chase|drive|street|night|harbor&seed=N
import { CONFIG } from './config.js';

function putInCar(G, type, x, z, heading, kmh) {
  const car = G.vehicles.spawnCar(type, x, z, heading);
  car.speed = kmh / 3.6;
  G.player.enterCar(car);
  return car;
}
function stagePolice(G, spots) {
  G.police.update(0.01, G.time);
  const bx = G.car ? G.car.x : G.player.x, bz = G.car ? G.car.z : G.player.z;
  G.police.cars.forEach((c, i) => {
    const s = spots[i % spots.length];
    c.x = bx + s[0]; c.z = bz + s[1];
    c.heading = s[2] ?? G.player.heading;
    c.speed = s[3] ?? 20;
  });
}

export function setupShot(G, name) {
  const q = new URLSearchParams(location.search);
  G.shotMode = name;
  G.phase = 'play';
  G.hud.hideTitle();
  if (name === 'chase') {
    // REF 1: GOLDEN HOUR finale — wanted 4, heli, Marco, $86,250, 113 km/h.
    G.timeOfDay = 18.35; G.day = 1;
    G.cash = 86250; G.respect = 290; G.wanted = 4;
    G.missions.startMission(7);
    G.missions.setStep(3);
    G.missions.setTimer(107);
    G.weaponIndex = 2; // MAKO SMG
    G.weapons[1].owned = true; G.weapons[2].owned = true; G.weapons[2].ammo = 150;
    putInCar(G, 'sport', -247, 10, Math.PI, 125); // decays to ~113 by capture
    G.player.camYaw = Math.PI;
    stagePolice(G, [[-7, 20, Math.PI, 24], [7, 22, Math.PI, 22], [-11, -6, Math.PI, 18], [11, -2, Math.PI, 16]]);
    G.hud.showDialog('Marco', 'SMUGGLER · WHEELMAN', 'The boat sails in two minutes, Nico! Shake that chopper and get to the pier!');
    G.hud.showMission();
  } else if (name === 'drive') {
    // REF 2: palm boulevard, meet Marco, 68 km/h, $10,350.
    G.timeOfDay = 17.5;
    G.cash = 10350; G.respect = 120; G.wanted = 0;
    G.missions.startMission(6);
    putInCar(G, 'sport', -250, 60, Math.PI, 86); // decays to ~68 by capture
    G.player.camYaw = Math.PI;
    G.hud.showDialog('Marco', 'SMUGGLER · WHEELMAN', 'Marlin Ceviche, Nico. Come hungry — we talk boats, not menus.');
    G.hud.showMission();
  } else if (name === 'street') {
    G.timeOfDay = 14;
    G.cash = 10350; G.respect = 120; G.wanted = 0;
    G.missions.startMission(6);
    G.missions.setStep(1);
    G.player.reset(-240, 104, 2.84);
    G.player.camYaw = 2.84; // looking north up the Malecón, Marco ~17° off-centre
    // pull 6 pedestrians into frame around the meet point
    G.traffic.peds.slice(0, 6).forEach((p, i) => {
      p.x = -236 + (i % 3) * 4; p.z = 94 - Math.floor(i / 3) * 6; p.idle = 3;
    });
    G.hud.prompt('E — Bicara');
    G.hud.showMission();
  } else if (name === 'night') {
    G.timeOfDay = 21;
    G.cash = 12400; G.respect = 180; G.wanted = 1;
    G.missions.startMission(3);
    putInCar(G, 'sedan', -244, -20, Math.PI, 60); // north on the Malecón: sea + ferris wheel ahead
    G.player.camYaw = Math.PI;
    stagePolice(G, [[-6, -12, -Math.PI / 2, 14]]);
    G.hud.showDialog('Mara Voss', 'MECHANIC', 'Dario\'s courier moves at night. Tail him — close enough to see, far enough to stay invisible.');
    G.hud.showMission();
  } else if (name === 'harbor') {
    G.timeOfDay = 16;
    G.cash = 5400; G.respect = 210; G.wanted = 0;
    G.missions.startMission(5);
    G.missions.setStep(1);
    G.player.reset(204, 44, Math.PI / 2);
    G.player.camYaw = Math.PI / 2;
    G.hud.showMission();
  }
  return true;
}
