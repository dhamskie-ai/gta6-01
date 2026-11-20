// Deterministic screenshot scenes (?shot=&seed=8). Sets window.__shotReady
// after >=5 frames. All staging uses forceDrive/teleport (no wanted).
import { CFG } from './config.js';
import { makeCar } from './vehicles.js';
import { spawnNPC } from './traffic.js';
import { teleportPlayer, forceDrive } from './player.js';
import { setWanted } from './police.js';
import { startMission, showDialog } from './missions.js';

function veloz(G, x, z, speed, heading) {
  const car = makeCar(G, 'sport', x, z, heading || 0, { color: 0xff2e7e });
  car.speed = speed;
  G.cars.push(car);
  forceDrive(G, car);
  return car;
}
function nearTraffic(G, spots) {
  const types = ['sedan', 'taxi', 'van'];
  spots.forEach(([x, z], i) => {
    const car = makeCar(G, types[i % 3], x, z, 0);
    car.traffic = true; car.speed = 12;
    G.cars.push(car); G.traffic.push(car);
  });
}
function policePair(G, a, b) {
  const mk = (type, x, z, name) => {
    const car = makeCar(G, type, x, z, 0);
    car.policeCar = true; car.callsign = name; car.speed = 30;
    G.cars.push(car); G.policeCars.push(car);
  };
  mk('police', a[0], a[1], a[2]);
  mk('police', b[0], b[1], b[2]);
}
export function stageShot(G, name) {
  G.shotMode = true;
  G.shotName = name;
  G.phase = 'play';
  if (G.el.titleScreen) G.el.titleScreen.style.display = 'none';
  const base = () => { G.cash = CFG.startCash; };
  if (name === 'chase') {
    base(); G.cash = 86250; G.timeOfDay = 18.0;
    startMission(G, 2);
    veloz(G, 0, 40, 31, 0);
    setWanted(G, 4);
    policePair(G, [5, 34, 'KESTREL-31'], [-5, 48, 'BARRACUDA-18']);
    nearTraffic(G, [[0, 70], [3.4, 70], [-3.4, 78]]);
    G.camDist = 12; G.camYaw = 0;
  } else if (name === 'drive') {
    base(); G.timeOfDay = 17.5;
    startMission(G, 2);
    veloz(G, -240, -40, 19, 0);
    nearTraffic(G, [[-240, 10], [-236.6, 20], [-243.4, -6], [-240, 34], [-236.6, -20], [-243.4, 44]]);
    G.camDist = 11; G.camYaw = 0;
  } else if (name === 'street') {
    base(); G.timeOfDay = 12.0;
    startMission(G, 1);
    teleportPlayer(G, -241.5, 64, Math.PI / 2);
    G.camYaw = Math.PI / 2; G.camDist = 8;
    const sedan = makeCar(G, 'sedan', -232, 72, 0.3);
    G.cars.push(sedan);
    const taxi = makeCar(G, 'taxi', -236, 56, 1.57);
    G.cars.push(taxi);
    showDialog(G, 'Marco', 'SMUGGLER · WHEELMAN', 'Nico! Over here — Marlin Ceviche. We talk, then you drive me to the pier.');
    G.streetDialog = true;
  } else if (name === 'night') {
    base(); G.timeOfDay = 21.5;
    startMission(G, 4);
    veloz(G, -252, 108, 12, 0);
    setWanted(G, 1);
    nearTraffic(G, [[-244, 126]]);
    // Two foot cops so the PCPD panel is not empty at wanted 1.
    const mk = (x, z, name) => {
      const npc = spawnNPC(G, name, x, z, 0xc98a5e, 0x1a2a4a, 0x1a2a4a, 0x11151c);
      npc.kind = 'cop'; npc.callsign = name;
      G.footCops.push({ g: npc.g, x, z, heading: 0, callsign: name, kind: 'cop' });
    };
    mk(-248, 112, 'PELICAN-11'); mk(-256, 104, 'GECKO-25');
    G.camDist = 11; G.camYaw = 0;
  } else if (name === 'roadzoom') {
    base(); G.timeOfDay = 15.0;
    startMission(G, 0);
    teleportPlayer(G, 5, -10, 0);
    const sport = makeCar(G, 'sport', 7, 26, 0.15, { color: 0xff2e7e });
    G.cars.push(sport);
    G.beacon.visible = false;
    G.shotCam = { pos: [1.5, 2.4, -16], look: [0.5, 0.2, 34] };
  } else if (name === 'touch') {
    base(); G.timeOfDay = 17.8;
    startMission(G, 2);
    veloz(G, -240, -30, 16, 0);
    nearTraffic(G, [[-240, 16], [-236.6, 28]]);
    G.camDist = 11; G.camYaw = 0;
    G.touchMode = true;
    document.body.classList.add('touch');
  } else if (name === 'phone') {
    base(); G.timeOfDay = 18.0;
    startMission(G, 1);
    teleportPlayer(G, -258, 20, -Math.PI / 2);
    const marco = G.npcs.find((n) => n.name === 'Marco');
    if (marco) { marco.x = -264; marco.z = 23; marco.g.position.set(-264, 0, 23); }
    G.camYaw = -Math.PI / 2; G.camPitch = -0.08; G.camDist = 7;
    G.touchMode = true;
    document.body.classList.add('touch');
  } else {
    base();
    startMission(G, 0);
  }
  G.frames = 0;
}
export function shotTick(G) {
  if (!G.shotMode) return;
  if (G.streetDialog) {
    showDialog(G, 'Marco', 'SMUGGLER · WHEELMAN', 'Nico! Over here — Marlin Ceviche. We talk, then you drive me to the pier.');
  }
  G.frames++;
  if (G.frames >= 5 && !window.__shotReady) window.__shotReady = true;
}
