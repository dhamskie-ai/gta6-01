// Scene deterministik ?shot= untuk screenshot: atur posisi pemain/mobil/
// polisi, wanted, jam, misi aktif, lalu set window.__shotReady setelah
// beberapa frame. Dipakai tools/shot.mjs. Game tetap jalan normal.
import { createCar } from './vehicles.js';
import { addWanted } from './police.js';
import { MALECON_X, nearestNode } from './city.js';
import { makePersonModel } from './traffic.js';
import { mulberry32 } from './random.js';

function placeTrafficOnMalecon(W, count) {
  const T = W.traffic;
  let placed = 0;
  for (const t of T.cars) {
    if (placed >= count) break;
    const z = -40 + placed * 70;
    const from = nearestNode(W, MALECON_X(z), z);
    const links = W.city.nodes[from].links;
    if (!links.length) continue;
    t.from = from; t.to = links[0]; t.t = 0.2 + placed * 0.2;
    placed++;
  }
}
export function applyShot(W) {
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot') || 'chase';
  const P = W.player;
  const S = W.city.spots;
  W.shotMode = true;
  W.state = 'playing';
  W.hud.setScreen('');
  W.audio.ensure();
  W.audio.setMusic(true, 0);
  // Reset wanted + posisi pemain.
  W.police.wanted = 0;
  if (shot === 'chase') {
    // Cover: sunset pink, downtown Spires, VELOZ dikejar 2 PCPD, wanted 4.
    W.hour = 18.0;
    W.missions.current = 7; W.missions.stage = 0; W.missions.timer = 107;
    const car = createCar(W, 'veloz', 160, -40, Math.PI);
    car.driver = 'player'; car.speed = 31;
    P.car = car; P.group.visible = false;
    P.x = car.x; P.z = car.z;
    addWanted(W, 4, 'manhunt Golden Hour');
    // Dua patroli tepat di belakang pemain.
    W.police.cars.slice(0, 2).forEach((u, i) => {
      u.car.x = 160 + (i === 0 ? -3 : 4); u.car.z = -40 + 16 + i * 7;
      u.car.speed = 30;
    });
    W.shotHold = { speed: 31 };
    W.hud.showDialog('Marco', 'SMUGGLER · WHEELMAN', "The boat sails in two minutes, Nico! Shake that chopper and get to the pier!", 30);
  } else if (shot === 'drive') {
    // Golden hour, jalan pantai Malecón, VELOZ + traffic + pejalan kaki.
    W.hour = 17.8;
    W.missions.current = 1; W.missions.stage = 0;
    const car = createCar(W, 'veloz', MALECON_X(90), 90, Math.PI);
    car.driver = 'player'; car.speed = 19;
    P.car = car; P.group.visible = false;
    P.x = car.x; P.z = car.z;
    placeTrafficOnMalecon(W, 3);
    W.shotHold = { speed: 19 };
    W.hud.showDialog('Marco', 'SMUGGLER · WHEELMAN', 'Meet me at Marlin Ceviche, Nico. Malecón Celeste, ujung dermaga.', 30);
  } else if (shot === 'street') {
    // Siang, depan Marlin Ceviche: Nico jalan kaki, Marco di samping,
    // prompt bicara, 4 pejalan kaki di sekitar.
    W.hour = 11;
    W.missions.current = 1; W.missions.stage = 0;
    P.x = S.marlin.x; P.z = S.marlin.z + 15;
    P.heading = 2.21; P.camYaw = P.heading;
    P.group.position.set(P.x, 0, P.z);
    W.combat.weapon = 1;
    if (!W.missions.marco) {
      const rng = mulberry32(W.seed + 21);
      const g = makePersonModel(W.three, rng, { shirt: 0xffd25a, pants: 0x2a2e33 });
      W.scene.add(g);
      W.missions.marco = { group: g, x: S.marlin.x + 4, z: S.marlin.z + 12 };
    }
    W.missions.marco.group.position.set(S.marlin.x + 4, 0, S.marlin.z + 12);
    W.missions.marco.x = S.marlin.x + 4; W.missions.marco.z = S.marlin.z + 12;
    W.traffic.peds.slice(0, 4).forEach((p, i) => {
      p.x = S.marlin.x - 8 + i * 5; p.z = S.marlin.z + 18 + (i % 2) * 4;
      p.tx = p.x + 10; p.tz = p.z;
      p.group.position.set(p.x, 0, p.z);
    });
    W.hud.showDialog('Marco', 'SMUGGLER · WHEELMAN', 'Nico. Dario menguasai dermaga — tapi Malecón ini masih milik kita.', 30);
  } else if (shot === 'night') {
    // Malam, Marina Bay: neon, lampu depan, wanted 1, dermaga + kincir ria.
    W.hour = 23;
    W.missions.current = 4; W.missions.stage = 0;
    const car = createCar(W, 'veloz', -252, 108, Math.PI);
    car.driver = 'player'; car.speed = 12;
    P.car = car; P.group.visible = false;
    P.x = car.x; P.z = car.z;
    addWanted(W, 1, 'patroli malam');
    W.shotHold = { speed: 12 };
    W.hud.showDialog('Lupe', 'RADIO · CELESTE 98.1', 'Neon Nights di Malecón… kurir Dario lewat tengah malam ini.', 30);
  }
  W.shotFrames = 0;
  W.shotName = shot;
}
export function shotTick(W) {
  if (!W.shotMode || window.__shotReady) return;
  W.shotFrames++;
  if (W.shotHold && W.player.car) W.player.car.speed = W.shotHold.speed;
  if (W.shotFrames >= 4) window.__shotReady = true;
}
