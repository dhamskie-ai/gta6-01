// 5 story missions + side activities (taxi, stunt jumps, sun coins, garage)
// + dialog, save/load, game over. Missions are data-driven step lists.
import * as THREE from 'three';
import { CFG } from './config.js';
import { spawnCar, addWanted } from './vehicles.js';
import { spawnGuard } from './combat.js';
import { clearWanted } from './police.js';
import { makePedModel } from './traffic.js';

export const MISSION_DEFS = [
  {
    name: 'First Gear', reward: 150,
    briefing: 'Sal Vega: "Ro, utangmu belum lunas. Curi mobil itu, antar ke bengkel Mara."',
    steps: [
      { type: 'goto', x: 0, z: 60, r: 6, text: 'Jalan kaki ke mobil parkir di utara' },
      { type: 'enterCar', text: 'Tekan E untuk mencuri mobil' },
      { type: 'driveTo', x: -60, z: -60, r: 8, text: 'Kendarai ke bengkel Mara (hijau)' },
    ],
  },
  {
    name: 'Courier Run', reward: 300,
    briefing: 'Kip: "Tiga paket, empat menit. Jangan tabrak apa pun — paketnya rapuh."',
    steps: [
      { type: 'driveTo', x: 120, z: -120, r: 8, text: 'Antar paket 1/3 ke The Spires', time: 240 },
      { type: 'driveTo', x: -180, z: 180, r: 8, text: 'Antar paket 2/3 ke Calle Verde' },
      { type: 'driveTo', x: 180, z: 180, r: 8, text: 'Antar paket 3/3 ke The Docks' },
    ],
  },
  {
    name: 'The Docks Job', reward: 500,
    briefing: 'Sal Vega: "Curi truk Hauler di dermaga. Penjaga Dario ada di sana — hati-hati."',
    steps: [
      { type: 'goto', x: 210, z: 200, r: 10, text: 'Masuk ke area dermaga' },
      { type: 'shoot', count: 4, text: 'Lumpuhkan 4 penjaga Dario' },
      { type: 'enterCar', carType: 'truck', text: 'Curi truk Hauler (E)' },
      { type: 'driveTo', x: -60, z: -60, r: 8, text: 'Kabur ke bengkel Mara — wanted 2 bintang!' },
    ],
  },
  {
    name: 'Neon Nights', reward: 600,
    briefing: 'Kip: "Kurir Dario lewat Marina malam ini. Buntuti dia — jangan sampai ketahuan."',
    steps: [
      { type: 'goto', x: -240, z: 40, r: 10, text: 'Pergi ke dermaga Marina malam hari' },
      { type: 'follow', x: -180, z: -60, r: 6, text: 'Buntuti kurir Dario (jaga jarak 10–25 m)' },
      { type: 'chase', x: 120, z: 120, r: 10, text: 'Dia kabur! Kejar sampai ke Docks' },
    ],
  },
  {
    name: 'Bay Heist', reward: 1000,
    briefing: 'Sal Vega: "Terakhir. Veloce GT Aurelia di garasi penthouse. Ambil — utangmu lunas."',
    steps: [
      { type: 'goto', x: 120, z: -60, r: 8, text: 'Masuk ke garasi The Spires' },
      { type: 'enterCar', carType: 'sport', text: 'Curi Veloce GT Aurelia (E)' },
      { type: 'driveTo', x: -300, z: 40, r: 10, text: 'Antar ke dermaga Marina — wanted 4 bintang!' },
    ],
  },
];

export function createMissions(G) {
  G.missions = {
    index: 0,
    step: 0,
    stepTimer: 0,
    guardsDown: 0,
    marker: null,
    markerPos: new THREE.Vector3(0, 0, 60),
    active: false,
    done: false,
    dialog: '',
    dialogTimer: 0,
    taxi: null,
    taxiTimer: 0,
    stuntDone: new Set(),
    courierCar: null,
    followTarget: null,
  };
  // Mission NPCs: Mara at the garage, Sal's phone contact, Kip.
  G.talkNpcs = [];
  spawnTalkNpc(G, 'Mara Voss', -60, -60, 0x8a4a2a);
  spawnTalkNpc(G, 'Sal Vega', 0, 60, 0x2a4a8a);
  // Mission marker beacon.
  const beaconGeo = new THREE.CylinderGeometry(0.4, 0.4, 60, 8, 1, true);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.y = 30;
  G.scene.add(beacon);
  const ringGeo = new THREE.TorusGeometry(5, 0.3, 8, 32);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd24a }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.3;
  G.scene.add(ring);
  G.missions.marker = beacon;
  G.missions.ring = ring;
  G.missions.marker.visible = false;
  G.missions.ring.visible = false;
}

function spawnTalkNpc(G, name, x, z, color) {
  const mesh = makePedModel(G.rng);
  mesh.children[0].material = new THREE.MeshLambertMaterial({ color });
  mesh.position.set(x, 0, z);
  G.scene.add(mesh);
  const npc = { mesh, name, x, z };
  G.talkNpcs.push(npc);
  return npc;
}

export function startMission(G, index) {
  const def = MISSION_DEFS[index];
  if (!def) { G.missions.done = true; G.hud.showEnding(G); return; }
  G.missions.index = index;
  G.missions.step = 0;
  G.missions.stepTimer = 0;
  G.missions.guardsDown = 0;
  G.missions.active = true;
  G.missions.marker.visible = true;
  G.missions.ring.visible = true;
  setDialog(G, def.briefing, 6);
  G.audio?.missionJingle();
  setupStep(G);
  G.hud.setToast(`Misi ${index + 1}: ${def.name}`);
}

export function setupStep(G) {
  const def = MISSION_DEFS[G.missions.index];
  const step = def.steps[G.missions.step];
  if (!step) { completeMission(G); return; }
  G.missions.stepTimer = step.time || 0;
  if (step.x !== undefined) {
    G.missions.markerPos.set(step.x, 0, step.z);
    G.missions.marker.position.set(step.x, 30, step.z);
    G.missions.ring.position.set(step.x, 0.3, step.z);
  }
  if (step.type === 'shoot') {
    G.missions.guardsDown = 0;
    const gx = step.x ?? 210, gz = step.z ?? 200;
    for (let i = 0; i < step.count; i++) {
      spawnGuard(G, gx + G.rng.range(-14, 14), gz + G.rng.range(-14, 14));
    }
  }
  if (step.type === 'follow') {
    // Courier target car that loops along the coast road.
    const car = spawnCar(G, 'sedan', step.x, step.z, 0, { driver: 'courier' });
    G.missions.followTarget = car;
  }
  if (step.type === 'chase') {
    const car = G.missions.followTarget;
    if (car) car.speed = 20;
  }
  if (step.type === 'enterCar' && step.carType) {
    // Make sure the target car type exists near the marker.
    const near = G.cars.find((c) => c.type === step.carType && c.mesh.position.distanceTo(G.missions.markerPos) < 40);
    if (!near) {
      const yaw = G.rng.range(0, Math.PI * 2);
      spawnCar(G, step.carType, G.missions.markerPos.x + 4, G.missions.markerPos.z + 4, yaw);
    }
  }
  if (step.type === 'goto' && G.missions.index === 3) {
    G.timeOfDay = 21.5; // Neon Nights starts at night.
  }
  G.hud.setObjective(step.text);
}

export function updateMissions(G, dt) {
  const M = G.missions;
  if (M.dialogTimer > 0) {
    M.dialogTimer -= dt;
    if (M.dialogTimer <= 0) G.hud.setDialog('');
  }
  // Start the next mission with N after one completes.
  if (!M.active && M.pendingNext !== undefined && G.input.pressed('KeyN')) {
    const n = M.pendingNext;
    M.pendingNext = undefined;
    G.hud.setObjective('');
    startMission(G, n);
    return;
  }
  if (!M.active || G.phase !== 'play') return;
  const def = MISSION_DEFS[M.index];
  const step = def.steps[M.step];
  if (!step) return;
  const p = G.player;
  const pos = p.car ? p.car.mesh.position : p.pos;
  if (M.stepTimer > 0) {
    M.stepTimer -= dt;
    if (M.stepTimer <= 0) { failMission(G, 'Waktu habis!'); return; }
  }
  const dist = Math.hypot(pos.x - M.markerPos.x, pos.z - M.markerPos.z);
  switch (step.type) {
    case 'goto':
    case 'driveTo':
      if (dist < (step.r || 8)) advanceStep(G);
      break;
    case 'enterCar':
      if (p.car && (!step.carType || p.car.type === step.carType)) advanceStep(G);
      break;
    case 'shoot':
      if (M.guardsDown >= step.count) advanceStep(G);
      break;
    case 'follow': {
      const t = M.followTarget;
      if (!t) { advanceStep(G); break; }
      const tp = t.mesh.position;
      // Courier drives away along the road.
      t.mesh.position.x += Math.sin(0.3) * 6 * dt;
      t.mesh.position.z -= 6 * dt;
      t.mesh.rotation.y = 0.3;
      const d = Math.hypot(tp.x - pos.x, tp.z - pos.z);
      M.markerPos.copy(tp);
      M.marker.position.set(tp.x, 30, tp.z);
      M.ring.position.set(tp.x, 0.3, tp.z);
      if (d > 35) { failMission(G, 'Kurir kabur — kamu ketahuan!'); return; }
      if (tp.z < -120) advanceStep(G);
      break;
    }
    case 'chase': {
      const t = M.followTarget;
      if (t) {
        t.mesh.position.z += 12 * dt;
        M.markerPos.copy(t.mesh.position);
        M.marker.position.set(t.mesh.position.x, 30, t.mesh.position.z);
        M.ring.position.set(t.mesh.position.x, 0.3, t.mesh.position.z);
      }
      if (dist < (step.r || 10)) advanceStep(G);
      break;
    }
  }
  // Beacon pulse.
  if (M.marker.visible) {
    const s = 1 + Math.sin(G.elapsed * 3) * 0.15;
    M.ring.scale.set(s, s, 1);
  }
  updateTaxi(G, dt);
}

function advanceStep(G) {
  G.missions.step += 1;
  G.audio?.blip(880, 0.12, 'sine', 0.15);
  setupStep(G);
}

export function completeMission(G) {
  const def = MISSION_DEFS[G.missions.index];
  G.player.cash += def.reward;
  G.missions.active = false;
  G.missions.marker.visible = false;
  G.missions.ring.visible = false;
  G.stats.missionsDone += 1;
  G.audio?.missionJingle();
  G.hud.showMissionComplete(G, def);
  G.hud.setObjective('Tekan N untuk misi berikutnya');
  saveGame(G);
  if (G.missions.index + 1 < MISSION_DEFS.length) {
    G.missions.pendingNext = G.missions.index + 1;
  } else {
    G.missions.done = true;
  }
}

export function failMission(G, reason) {
  const def = MISSION_DEFS[G.missions.index];
  G.missions.active = false;
  G.audio?.failJingle();
  G.hud.showMissionFailed(G, def, reason);
}

export function retryMission(G) {
  // Respawn near the mission start, reset wanted, restart the mission.
  const idx = G.missions.index;
  G.player.hp = CFG.maxHealth;
  G.player.armor = 0;
  clearWanted(G);
  for (const guard of [...G.enemies]) {
    const i = G.enemies.indexOf(guard);
    if (i >= 0) G.enemies.splice(i, 1);
    G.scene.remove(guard.mesh);
  }
  G.phase = 'play';
  startMission(G, idx);
}

export function onGuardDown(G) {
  G.missions.guardsDown += 1;
  const def = MISSION_DEFS[G.missions.index];
  const step = def?.steps[G.missions.step];
  if (step && step.type === 'shoot') {
    G.hud.setObjective(`Lumpuhkan penjaga Dario (${G.missions.guardsDown}/${step.count})`);
  }
}

export function talkToNpc(G, npc) {
  const lines = {
    'Mara Voss': 'Mara: "Bengkelku terbuka 24 jam. Parkir mobil curian di sini — aku simpan."',
    'Sal Vega': 'Sal: "Utangmu $2.000. Selesaikan lima pekerjaan, kita impas."',
  };
  setDialog(G, lines[npc.name] || `${npc.name}: "Hati-hati di jalan."`, 5);
  G.audio?.blip(520, 0.1, 'sine', 0.12);
}

export function setDialog(G, text, seconds = 5) {
  G.missions.dialog = text;
  G.missions.dialogTimer = seconds;
  G.hud.setDialog(text);
}

export function gameOver(G, title) {
  if (G.phase === 'over') return;
  G.phase = 'over';
  G.audio?.failJingle();
  G.audio?.setSiren(false);
  G.input.unlockPointer();
  G.hud.showGameOver(G, title);
}

// --- Side activities -------------------------------------------------------
export function startTaxi(G) {
  if (G.missions.taxi) return;
  const p = G.player;
  if (!p.car || p.car.type !== 'taxi') { G.hud.setToast('Butuh taksi Cabro untuk kerja taksi'); return; }
  const spots = [[-180, -180], [150, -150], [60, 180], [-60, 180]];
  const dest = spots[G.rng.int(0, spots.length - 1)];
  G.missions.taxi = { x: dest[0], z: dest[1], timer: 90 };
  G.missions.markerPos.set(dest[0], 0, dest[1]);
  G.missions.marker.visible = true;
  G.missions.ring.visible = true;
  G.missions.ring.position.set(dest[0], 0.3, dest[1]);
  G.missions.marker.position.set(dest[0], 30, dest[1]);
  G.hud.setObjective('Taksi: antar penumpang ke marker (90 dtk)');
  G.audio?.horn();
}

function updateTaxi(G, dt) {
  const T = G.missions.taxi;
  if (!T) return;
  T.timer -= dt;
  const pos = G.player.car ? G.player.car.mesh.position : G.player.pos;
  if (Math.hypot(pos.x - T.x, pos.z - T.z) < 8) {
    G.player.cash += 60;
    G.stats.taxiFares += 1;
    G.audio?.coin();
    G.hud.setToast('Tarif taksi selesai! +$60');
    G.missions.taxi = null;
    if (!G.missions.active) {
      G.missions.marker.visible = false;
      G.missions.ring.visible = false;
    }
    return;
  }
  if (T.timer <= 0) {
    G.missions.taxi = null;
    G.hud.setToast('Penumpang batal — terlalu lama');
    if (!G.missions.active) {
      G.missions.marker.visible = false;
      G.missions.ring.visible = false;
    }
  }
}

export function checkStuntJump(G, car) {
  // Ramps near the beach: jumping with speed over one awards cash.
  const ramps = [[-250, -120], [-250, 120], [200, -200]];
  for (const [rx, rz] of ramps) {
    const key = `${rx},${rz}`;
    if (G.missions.stuntDone.has(key)) continue;
    if (Math.hypot(car.mesh.position.x - rx, car.mesh.position.z - rz) < 6 && Math.abs(car.speed) > 20) {
      G.missions.stuntDone.add(key);
      G.player.cash += 80;
      G.audio?.missionJingle();
      G.hud.setToast('Stunt jump! +$80');
    }
  }
}

// --- Save / load -----------------------------------------------------------
export function saveGame(G) {
  try {
    const data = {
      cash: G.player.cash,
      mission: G.missions.index,
      missionsDone: G.stats.missionsDone,
      coins: G.stats.coins,
      carsStolen: G.stats.carsStolen,
      maxWanted: G.stats.maxWanted,
      taxiFares: G.stats.taxiFares,
      garage: G.garage.map((c) => c.type),
      timeOfDay: G.timeOfDay,
    };
    localStorage.setItem(CFG.saveKey, JSON.stringify(data));
    G.hud.setToast('Game disimpan');
    return true;
  } catch { return false; }
}

export function loadGame(G) {
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    G.player.cash = data.cash ?? 0;
    G.stats.missionsDone = data.missionsDone ?? 0;
    G.stats.coins = data.coins ?? 0;
    G.stats.carsStolen = data.carsStolen ?? 0;
    G.stats.maxWanted = data.maxWanted ?? 0;
    G.stats.taxiFares = data.taxiFares ?? 0;
    G.timeOfDay = data.timeOfDay ?? CFG.startHour;
    return data;
  } catch { return null; }
}

export function hasSave() {
  try { return !!localStorage.getItem(CFG.saveKey); } catch { return false; }
}
