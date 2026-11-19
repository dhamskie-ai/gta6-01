// Scene deterministik ?shot= — staging + window.__shotReady.
import { spawnCar } from './vehicles.js';
import { stagePolice } from './police.js';
import { startMission } from './missions.js';

export function applyShot(G) {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (!shot) return false;
  const seed = parseInt(q.get('seed') || '8', 10);
  G.seed = seed;
  G.shotMode = true;
  G.phase = 'play';
  G.hud.showGame();
  const T = G.THREE, city = G.city;
  const putPlayerInSport = (x, z, yaw, speed) => {
    if (G.playerCar) { G.playerCar.mesh.visible = false; G.playerCar.dead = true; }
    const car = spawnCar(G, T, city, 'sport', x, z, yaw, { isPlayer: true });
    car.speed = speed || 0;
    G._stagedSpeed = speed || 0;
    G.playerCar = car;
    G.player.inCar = true;
    G.player.x = x; G.player.z = z;
    return car;
  };
  const addTrafficNear = (x, z, n) => {
    const spots = [[x + 6, z + 26], [x - 6, z + 40], [x + 5, z - 30], [x - 5, z + 55]];
    for (let i = 0; i < Math.min(n, spots.length); i++) {
      const [tx, tz] = spots[i];
      const car = spawnCar(G, T, city, i % 2 ? 'sedan' : 'taxi', tx, tz, 0, { ai: { axis: 'z', road: -240, dir: 1, speed: 10, cruise: 10 } });
      G.trafficCars.push(car);
    }
  };
  if (shot === 'chase') {
    // Meniru ref1: JOB 8/8 GOLDEN HOUR · Lupe, 1:47, STAGE 4/5, $86,250,
    // 4 bintang, PCPD 9 UNITS · CODE 4, Malecón Celeste, SHOT CALLER 290/550.
    G.cash = 86250;
    G.wanted = 4; G.heat = 1;
    G.timeOfDay = 18.8; G.day = 1;
    G.missionsDone = 7; G.stats.missionsDone = 7;
    G.respectPoints = 290;
    startMission(G, 7);
    G.mission.step = 3;
    G.mission.timer = 107;
    G.mission.progress = 0;
    G.hud.showObjective('Lose the manhunt before Marco\u2019s boat sails');
    const car = putPlayerInSport(-240, 60, 0, 31.1); // 112 km/h, G3
    car.hp = car.maxHp;
    // formasi kejar relatif terhadap mobil: belakang-kiri/kanan + samping
    stagePolice(G, T, city, [[-5, -12], [5, -14], [-9, -2], [9, -4], [-6, 16], [7, 22]]);
    // roadblock 2 unit di depan di boulevard
    const rb1 = spawnCar(G, T, city, 'police', -243.4, 105, Math.PI / 2, { ai: { roadblock: true } });
    rb1.callsign = 'TAC-45'; rb1.role = 'ROADBLOCK'; G.policeCars.push(rb1);
    const rb2 = spawnCar(G, T, city, 'police', -236.6, 105, Math.PI / 2, { ai: { roadblock: true } });
    rb2.callsign = 'BARRACUDA-18'; rb2.role = 'ROADBLOCK'; G.policeCars.push(rb2);
    // callsign unit kejar sesuai ref1
    const names = ['PELICAN-11', 'GECKO-25', 'IBIS-43', 'TARPON-19', 'HERON-17', 'MARLIN-26'];
    G.policeCars.forEach((c, i) => { if (i < 6) c.callsign = names[i]; });
    G.audio.trackIdx = 0; // Malecón Mirage · Vela Roja
    G.hud.showDialog('Marco', 'The boat sails in two minutes, Nico! Shake that chopper and get to the pier!');
    G.hud.ticker('They can see you — break line of sight');
    addTrafficNear(-240, 60, 3);
    G.beacon = { x: -297, z: 90, visible: true };
  } else if (shot === 'drive') {
    G.cash = 10350; G.wanted = 0; G.timeOfDay = 17.6; G.day = 1;
    startMission(G, 1);
    G.mission.step = 0; G.mission.timer = 0;
    putPlayerInSport(-240, -40, Math.PI, 22);
    G.player.camYaw = Math.PI;
    addTrafficNear(-240, -40, 3);
    G.hud.showDialog('Marco', 'Golden hour on the Malecón, Nico. This city is ours tonight.');
    G.beacon.visible = false;
  } else if (shot === 'street') {
    G.cash = 10350; G.wanted = 0; G.timeOfDay = 12.0; G.day = 1;
    startMission(G, 0);
    G.mission.step = 0;
    G.player.inCar = false; G.playerCar = null;
    G.player.x = -240; G.player.z = 104; G.player.y = 0;
    G.player.yaw = 0; G.player.camYaw = 2.84; G.player.camPitch = 0.12;
    G.player.mesh.position.set(-240, 0, 104);
    G.marco.mesh.visible = true;
    G.marco.x = -240; G.marco.z = 87;
    G.marco.mesh.position.set(-240, 0, 87);
    G.shotPrompt = 'E — Bicara';
    G.hud.showDialog('Marco', 'Nico! Over here — Marlin Ceviche. We need to talk.');
    G.beacon = { x: -240, z: 90, visible: true };
  } else if (shot === 'night') {
    G.cash = 10350; G.wanted = 1; G.heat = 1; G.day = 1;
    startMission(G, 3);
    G.timeOfDay = 21.5; // sesudah startMission (misi 4 men-set 21.2)
    G.mission.step = 0; G.mission.timer = 0;
    putPlayerInSport(-240, 150, Math.PI, 14);
    G.player.camYaw = Math.PI;
    stagePolice(G, T, city, [[-5, -12]]);
    G.policeCars[0].callsign = 'PELICAN-11';
    G.hud.showDialog('Lupe', 'Neon nights, Nico. The courier moves at midnight — stay dark.');
    G.beacon = { x: 60, z: 0, visible: true };
  } else if (shot === 'harbor') {
    G.cash = 10350; G.wanted = 0; G.timeOfDay = 18.2; G.day = 1;
    startMission(G, 5);
    G.mission.step = 2;
    G.player.inCar = false; G.playerCar = null;
    G.player.x = -297; G.player.z = 90; G.player.y = 0;
    G.player.camYaw = 2.2;
    G.player.mesh.position.set(-297, 0, 90);
    G.shotPrompt = 'E — Fish (6s)';
    G.hud.showDialog('Lupe', 'Walk it to the end of the pier, Nico. The boat is waiting.');
    G.beacon = { x: -297, z: 90, visible: true };
  }
  G.shotPending = true;
  G.shotFrames = 0;
  window.__game = snapshot(G);
  return true;
}

export function shotTick(G) {
  if (!G.shotPending) return;
  // tahan kecepatan staging (HUD speedometer) + prompt staging tiap frame
  if (G.shotMode && G.playerCar && G._stagedSpeed) G.playerCar.speed = G._stagedSpeed;
  if (G.shotPrompt) G.prompt = G.shotPrompt;
  G.shotFrames++;
  window.__game = snapshot(G);
  if (G.shotFrames >= 3 && !window.__shotReady) {
    window.__shotReady = true;
  }
}

export function snapshot(G) {
  return {
    phase: G.phase,
    wanted: G.wanted,
    cash: Math.round(G.cash),
    mission: G.mission ? G.mission.index : -1,
    step: G.mission ? G.mission.step : -1,
    timer: G.mission ? Math.round(G.mission.timer) : 0,
    inCar: !!G.player.inCar,
    x: Math.round(G.player.x * 10) / 10,
    z: Math.round(G.player.z * 10) / 10,
    speed: G.playerCar ? Math.round(Math.abs(G.playerCar.speed) * 3.6) : 0,
    health: Math.round(G.health),
    timeOfDay: Math.round(G.timeOfDay * 100) / 100,
    policeUnits: (G.policeUnits || []).length,
    shotMode: !!G.shotMode,
  };
}
