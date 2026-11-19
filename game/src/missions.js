// 8 story missions (Nico, Marco, Lupe, Golden Hour) + 5 side activities:
// taxi $40, street race $120, fishing $15/fish, 6 photo spots +$60 bonus,
// courier $60. Beacons, stages, timers, dialog feed the HUD job counter.
import * as THREE from 'three';
import { G, CFG } from './config.js';
import { R } from './random.js';
import { showDialog, showObjective, showPrompt, announce } from './hud.js';
import { setWanted, addWanted } from './police.js';
import { spawnPed } from './traffic.js';
import { makeCar, isCarObj } from './vehicles.js';
import { spawnGuard } from './combat.js';
import { driveCarRef } from './player.js';
import { sfx } from './audio.js';

let beacon = null, lastKey = '', tailT = 0, raceCps = [];
const P = () => G.player.pos;

export const MISSIONS = [
  { title: 'First Gear', reward: 150, next: 'Meet Marco at Marlin Ceviche',
    brief: ['Mara', 'MECHANIC', 'Nico! That pink VELOZ by the curb is yours. Take it, then bring it to my garage.'],
    steps: [
      { text: 'Reach the pink VELOZ COMET RS', x: -240, z: 66, r: 6, type: 'reach' },
      { text: 'Drive the VELOZ to Mara\'s garage', x: CFG.garage.x, z: CFG.garage.z, r: 10, type: 'drive' },
    ] },
  { title: 'Meet Marco', reward: 200, next: 'Courier Run — 3 packages',
    brief: ['Marco', 'SMUGGLER · WHEELMAN', 'Nico! Over here — Marlin Ceviche. We talk, then you drive me to the pier.'],
    steps: [
      { text: 'Meet Marco at Marlin Ceviche', x: -238, z: 64, r: 7, type: 'reach' },
      { text: 'Talk to Marco (E)', x: -238, z: 64, r: 4, type: 'talk', who: 'marco' },
      { text: 'Drive Marco to the pier', x: CFG.pier.x, z: CFG.pier.z, r: 10, type: 'drive' },
    ] },
  { title: 'Courier Run', reward: 300, next: 'The Docks Job', timer: 240,
    brief: ['Kip', 'DRIVER', 'Three packages, four minutes, no questions. First stop: the plaza.'],
    steps: [
      { text: 'Deliver package 1 — Plaza Spires', x: 108, z: 108, r: 8, type: 'drive' },
      { text: 'Deliver package 2 — Vista Hills', x: 0, z: -180, r: 8, type: 'drive' },
      { text: 'Deliver package 3 — The Docks', x: 252, z: -60, r: 8, type: 'drive' },
    ] },
  { title: 'The Docks Job', reward: 450, next: 'Neon Nights',
    brief: ['Sal Vega', 'FIXER', 'Dario\'s Hauler is at the docks. Four guards. Take it, lose the heat, bring it home.'],
    steps: [
      { text: 'Reach the Hauler at the docks', x: 244, z: -60, r: 8, type: 'reach' },
      { text: 'Deal with the 4 guards', x: 244, z: -60, r: 40, type: 'kill' },
      { text: 'Drive the Hauler to the garage', x: CFG.garage.x, z: CFG.garage.z, r: 10, type: 'drive' },
    ] },
  { title: 'Neon Nights', reward: 500, next: 'Street Race', night: true,
    brief: ['Kip', 'DRIVER', 'Night run. Tail Dario\'s courier — close enough to see, far enough to stay invisible.'],
    steps: [
      { text: 'Tail the courier — stay 10–35 m back', x: 240, z: 120, r: 40, type: 'tail' },
      { text: 'The courier bolted! Chase him to the garage', x: CFG.garage.x, z: CFG.garage.z, r: 10, type: 'drive' },
    ] },
  { title: 'Street Race', reward: 120, next: 'Beach Party',
    brief: ['Lupe', 'RACER', 'Midnight money on the boulevard, Nico. Beat my two boys to the pier and the $120 is yours.'],
    steps: [
      { text: 'Get to the start line on the boulevard', x: CFG.raceStart.x, z: CFG.raceStart.z, r: 10, type: 'drive' },
      { text: 'Win the street race (3 checkpoints)', x: -258, z: 40, r: 12, type: 'race' },
    ] },
  { title: 'Beach Party', reward: 250, next: 'Golden Hour',
    brief: ['Lupe', 'RACER', 'Party on the beach, Nico! Come say hi, then drive me up the Malecón.'],
    steps: [
      { text: 'Reach the beach party', x: CFG.beachParty.x, z: CFG.beachParty.z, r: 10, type: 'reach' },
      { text: 'Talk to Lupe (E)', x: -272, z: 150, r: 4, type: 'talk', who: 'lupe' },
      { text: 'Drive Lupe to the Malecón viewpoint', x: -258, z: -40, r: 10, type: 'drive' },
    ] },
  { title: 'Golden Hour', reward: 800, next: 'Solara Bay is yours', timer: 107,
    brief: ['Marco', 'SMUGGLER · WHEELMAN', 'The boat sails in two minutes, Nico! Shake that chopper and get to the pier!'],
    steps: [
      { text: 'Lose the manhunt — reach the boat at the pier', x: CFG.pier.x, z: CFG.pier.z, r: 10, type: 'drive' },
    ] },
];

export function spawnMarco() {
  if (G.marcos) return G.marcos;
  const m = spawnPed(-238, 64, { color: 0xf5c518, hat: 0x1e3a5e, name: 'Marco' });
  m.x = -238; m.z = 64; m.group.position.set(-238, 0, 64);
  G.marcos = m;
  return m;
}

let lupe = null;
export function spawnLupe() {
  if (lupe) return lupe;
  lupe = spawnPed(-272, 150, { color: 0xff5a8a, name: 'Lupe' });
  lupe.x = -272; lupe.z = 150; lupe.group.position.set(-272, 0, 150);
  return lupe;
}

function ensureBeacon() {
  if (beacon) return;
  beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23d, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  G.scene.add(beacon);
}

function stageEnter(m, si) {
  const s = m.steps[si];
  showObjective(s.text);
  G.missionX = s.x; G.missionZ = s.z;
  if (si === 0 && m.brief) showDialog(m.brief[0], m.brief[1], m.brief[2]);
  if (m.night && si === 0) G.timeOfDay = 21.0;
  if (m.title === 'Meet Marco' && si === 0) spawnMarco();
  if (m.title === 'Beach Party' && si === 0) spawnLupe();
  if (m.title === 'The Docks Job' && si === 1) {
    for (const [gx, gz] of [[236, -68], [252, -52], [240, -44], [256, -72]]) spawnGuard(gx, gz);
  }
  if (m.title === 'Neon Nights' && si === 0) {
    const c = spawnPed(240, 120, { color: 0x2c3242, name: 'Courier' });
    G._courier = c; tailT = 0;
  }
  if (m.title === 'Golden Hour' && si === 0) { setWanted(4); announce('MANHUNT — 4 STARS!'); }
  if (m.title === 'The Docks Job' && si === 2) setWanted(2);
  if (m.title === 'Street Race' && si === 1) startRace();
}

function stepDone(m, si) {
  const s = m.steps[si];
  const dx = P().x - s.x, dz = P().z - s.z, d = Math.hypot(dx, dz);
  if (s.type === 'reach' || s.type === 'drive') return d < s.r && (s.type === 'reach' || driveCarRef());
  if (s.type === 'kill') return G.enemies.length === 0;
  if (s.type === 'race') {
    if (!G.race.active && !G.race.won) startRace(); // retry once the player brings a car
    return G.race.won;
  }
  if (s.type === 'talk') return false; // advances via onInteract
  if (s.type === 'tail') {
    const c = G._courier;
    if (!c) return false;
    const cd = Math.hypot(P().x - c.x, P().z - c.z);
    if (cd < 8) { failMission('Spotted! The courier saw you.'); return false; }
    if (cd < 40) tailT += 1 / 60;
    return tailT > 12;
  }
  return false;
}

function failMission(why) {
  announce(why + ' — retrying stage');
  sfx.fail();
  G.missionStage = 0;
  G.missionTimer = MISSIONS[G.missionIdx].timer || 0;
  lastKey = '';
}

function completeMission() {
  const m = MISSIONS[G.missionIdx];
  G.cash += m.reward;
  G.stats.missionsDone++;
  G.respect = Math.min(5, 1 + G.stats.missionsDone);
  sfx.jingle();
  announce(`JOB SELESAI — +$${m.reward}`);
  G.missionIdx++;
  G.missionStage = 0;
  G.missionTimer = 0;
  lastKey = '';
  if (G.missionIdx >= MISSIONS.length) {
    showDialog('Marco', 'SMUGGLER · WHEELMAN', 'That\'s the whole bay, Nico. Debt paid, boat waiting. Solara Bay is yours.');
    G.missionTitle = ''; G.objective = 'Free roam — Solara Bay is yours';
  }
  saveNow();
}

function saveNow() {
  try {
    localStorage.setItem('solarabay-save-v1', JSON.stringify({
      cash: G.cash, missionIdx: G.missionIdx, health: G.health, stats: G.stats, day: G.day,
      x: G.player.pos.x, z: G.player.pos.z,
    }));
  } catch { /* ignore */ }
}

export function startMission(i) {
  G.missionIdx = Math.max(0, Math.min(MISSIONS.length - 1, i));
  G.missionStage = 0;
  G.missionTimer = MISSIONS[G.missionIdx].timer || 0;
  lastKey = '';
}

export function updateMissions(dt) {
  ensureBeacon();
  if (G.missionIdx >= MISSIONS.length) {
    beacon.visible = false; updateInteract(); updateActivities(dt);
    return;
  }
  const m = MISSIONS[G.missionIdx];
  G.missionTitle = m.title;
  G.missionSteps = m.steps.length;
  G.missionNext = m.next;
  const key = `${G.missionIdx}:${G.missionStage}`;
  if (key !== lastKey) { lastKey = key; stageEnter(m, G.missionStage); }
  const s = m.steps[G.missionStage];
  G.missionX = s.x; G.missionZ = s.z;
  beacon.visible = true;
  beacon.position.set(s.x, 30, s.z);
  beacon.material.opacity = 0.2 + Math.sin(G.elapsed * 4) * 0.08;
  if (m.timer) {
    G.missionTimer -= dt;
    if (G.missionTimer <= 0) { failMission('Time up!'); return; }
  }
  if (stepDone(m, G.missionStage)) {
    sfx.coin();
    G.missionStage++;
    if (G.missionStage >= m.steps.length) completeMission();
  }
  updateInteract();
  updateActivities(dt);
}

// ---- interaction (E) ----
function nearWho(x, z, r) { return Math.hypot(P().x - x, P().z - z) < r; }

export function updateInteract() {
  G.interact = null;
  const m = MISSIONS[G.missionIdx];
  if (m && G.missionStage < m.steps.length) {
    const s = m.steps[G.missionStage];
    if (s.type === 'talk' && s.who === 'marco' && G.marcos && nearWho(-238, 64, 4.5)) {
      G.interact = () => {
        showDialog('Marco', 'SMUGGLER · WHEELMAN', 'Good. Pier, fast, no cops if we\'re lucky. Drive!');
        G.missionStage++;
      };
      showPrompt('E — Bicara dengan Marco');
      return;
    }
    if (s.type === 'talk' && s.who === 'lupe' && lupe && nearWho(-272, 150, 4.5)) {
      G.interact = () => {
        showDialog('Lupe', 'RACER', 'There he is! Up the Malecón, nice and slow — I want the sunset.');
        G.missionStage++;
      };
      showPrompt('E — Bicara dengan Lupe');
      return;
    }
  }
  if (G.taxi.active && G.taxi.stage === 0 && G.taxi.ped && nearWho(G.taxi.px, G.taxi.pz, 4)) {
    G.interact = () => {
      G.taxi.stage = 1;
      if (G.taxi.ped) { G.scene.remove(G.taxi.ped.group); G.peds.splice(G.peds.indexOf(G.taxi.ped), 1); G.taxi.ped = null; }
      showDialog('Penumpang', 'TAXI', 'Ke Plaza Spires ya, cepat!');
      announce('Antar penumpang ke tujuan');
    };
    showPrompt('E — Jemput penumpang');
    return;
  }
  showPrompt(G.nearMsg || '');
}

export function onInteract() {
  if (G.interact) { const f = G.interact; G.interact = null; f(); }
}

// ---- side activities ----
export function startTaxi() {
  if (G.taxi.active || !G.player.onFoot) return;
  const a = Math.random() * Math.PI * 2;
  const px = P().x + Math.sin(a) * 12, pz = P().z + Math.cos(a) * 12;
  const ped = spawnPed(px, pz, { color: 0x2e6fd8 });
  G.taxi = { active: true, px, pz, dx: 108, dz: 108, stage: 0, ped };
  announce('TAXI: jemput penumpang di dekatmu');
  sfx.click();
}

export function startRace() {
  if (G.race.active) return;
  const car = driveCarRef();
  if (!car) { announce('Butuh mobil untuk balapan!'); return; }
  G.race = { active: true, cp: 0, t: 0, rivals: [], won: false };
  raceCps = [[0, 40], [-258, 40], [-258, -160]];
  for (let i = 0; i < 2; i++) {
    const rc = makeCar(i === 0 ? 'sport' : 'sedan', CFG.raceStart.x + (i + 1) * 6, CFG.raceStart.z + 4, Math.PI / 2);
    rc.speed = 0; rc.cp = 0; G.race.rivals.push(rc);
  }
  announce('BALAPAN! 3 checkpoint — kalahkan 2 rival');
  sfx.jingle();
}

function updateRace(dt) {
  const r = G.race;
  if (!r.active) return;
  r.t += dt;
  const car = driveCarRef();
  if (car && r.cp < raceCps.length) {
    const [cx, cz] = raceCps[r.cp];
    if (Math.hypot(car.x - cx, car.z - cz) < 12) {
      r.cp++;
      sfx.coin();
      announce(r.cp >= raceCps.length ? 'FINISH!' : `Checkpoint ${r.cp}/3`);
    }
  }
  for (const rv of r.rivals) {
    if (!isCarObj(rv) || rv.cp >= raceCps.length) continue;
    const [cx, cz] = raceCps[rv.cp];
    const want = Math.atan2(cx - rv.x, cz - rv.z);
    let dh = want - rv.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    rv.heading += Math.max(-1, Math.min(1, dh * 2)) * dt * 1.4;
    rv.speed = Math.min(30, rv.speed + 12 * dt);
    rv.x += Math.sin(rv.heading) * rv.speed * dt;
    rv.z += Math.cos(rv.heading) * rv.speed * dt;
    rv.group.position.set(rv.x, 0, rv.z);
    rv.group.rotation.y = rv.heading;
    if (Math.hypot(rv.x - cx, rv.z - cz) < 12) rv.cp++;
  }
  const rivalsDone = r.rivals.filter((rv) => rv.cp >= raceCps.length).length;
  if (car && r.cp >= raceCps.length) {
    r.active = false; r.won = rivalsDone === 0;
    if (r.won) { G.cash += CFG.racePrize; G.stats.races++; announce(`MENANG BALAPAN! +$${CFG.racePrize}`); sfx.jingle(); }
    else { announce('Kalah balapan — coba lagi (R)'); sfx.fail(); }
    for (const rv of r.rivals) { G.scene.remove(rv.group); }
    r.rivals = [];
  } else if (rivalsDone === 2) {
    r.active = false; r.won = false;
    announce('Rival finis duluan — coba lagi (R)');
    for (const rv of r.rivals) G.scene.remove(rv.group);
    r.rivals = [];
  }
  if (r.active) { G.missionX = raceCps[Math.min(r.cp, 2)][0]; G.missionZ = raceCps[Math.min(r.cp, 2)][1]; }
}

function updateFishing(dt) {
  const f = G.fish;
  if (!f.active) {
    // near a pier spot? offer fishing
    for (const s of CFG.fishSpots) {
      if (nearWho(s.x, s.z, 5)) { G.nearMsg = 'F — Mancing di sini'; return; }
    }
    return;
  }
  f.needle += f.dir * dt * 1.6;
  if (f.needle > 1) { f.needle = 1; f.dir = -1; }
  if (f.needle < 0) { f.needle = 0; f.dir = 1; }
}

export function toggleFishing() {
  const f = G.fish;
  if (!f.active) {
    for (const s of CFG.fishSpots) {
      if (nearWho(s.x, s.z, 5)) {
        G.fish = { active: true, needle: 0.5, dir: 1, spot: s.id, caught: '' };
        announce('Mancing! Tekan F saat jarum di zona hijau');
        return;
      }
    }
    return;
  }
  // strike: green zone is 0.62..0.86
  if (f.needle >= 0.62 && f.needle <= 0.86) {
    const fish = R.pick(CFG.fish);
    G.cash += CFG.fishPrice;
    G.stats.fish++;
    if (!G.stats.fishKinds.includes(fish.name)) G.stats.fishKinds.push(fish.name);
    f.caught = fish.name;
    announce(`Dapat ${fish.name}! +$${CFG.fishPrice}`);
    sfx.coin(); sfx.splash();
  } else {
    announce('Ikan lepas… coba lagi');
    sfx.fail();
  }
  G.fish.active = false;
}

function updatePhoto() {
  for (const s of CFG.photoSpots) {
    if (!G.stats.photos.includes(s.id) && nearWho(s.x, s.z, 7)) {
      G.nearMsg = `P — Foto: ${s.name}`;
      return;
    }
  }
}

export function takePhoto() {
  for (const s of CFG.photoSpots) {
    if (!G.stats.photos.includes(s.id) && nearWho(s.x, s.z, 7)) {
      G.stats.photos.push(s.id);
      G.cash += 10;
      sfx.camera();
      announce(`Foto ${s.name}! +$10 (${G.stats.photos.length}/6)`);
      if (G.stats.photos.length === 6) {
        G.cash += CFG.photoBonus;
        announce(`SEMUA SPOT FOTO! Bonus +$${CFG.photoBonus}`);
        sfx.jingle();
      }
      return;
    }
  }
}

export function startCourierSide() {
  if (G.courier.active) return;
  const spots = [[108, 108], [-240, -180], [252, 120], [-60, 240], [180, -240]];
  const [dx, dz] = R.pick(spots);
  G.courier = { active: true, dx, dz, t: 90 };
  G.missionX = dx; G.missionZ = dz;
  announce('PAKET KILAT: antar ke marker dalam 90 detik — $60');
  sfx.click();
}

function updateActivities(dt) {
  G.nearMsg = ''; // rebuilt fresh every frame by the checks below
  updateRace(dt);
  updateFishing(dt);
  if (!G.fish.active) updatePhoto();
  // taxi drop-off
  const tx = G.taxi;
  if (tx.active && tx.stage === 1) {
    G.nearMsg = 'Antar penumpang ke Plaza Spires';
    if (Math.hypot(P().x - tx.dx, P().z - tx.dz) < 10) {
      tx.active = false; tx.stage = 0;
      G.cash += CFG.taxiFare; G.stats.taxi++;
      announce(`TAXI SELESAI +$${CFG.taxiFare}`);
      sfx.coin();
    }
  } else if (!tx.active && !G.shotMode) {
    // idle hint, overwritten by fishing/photo when relevant; hidden in
    // shot mode so it never clutters a screenshot.
    if (!G.nearMsg) G.nearMsg = 'T — Taksi · R — Balapan · K — Paket kilat';
  }
  if (G.courier.active) {
    G.courier.t -= dt;
    if (Math.hypot(P().x - G.courier.dx, P().z - G.courier.dz) < 10) {
      G.courier.active = false;
      G.cash += CFG.courierPay; G.stats.courier++;
      announce(`PAKET TERKIRIM +$${CFG.courierPay}`);
      sfx.coin();
    } else if (G.courier.t <= 0) {
      G.courier.active = false;
      announce('Paket kilat gagal — telat');
      sfx.fail();
    }
  }
}
