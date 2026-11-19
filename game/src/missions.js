import * as THREE from 'three';
import { CFG } from './config.js';
import { createPersonMesh } from './player.js';
import { makeCar } from './vehicles.js';
import { spawnGuard } from './combat.js';
import { addWanted } from './police.js';
import { rr, pick } from './random.js';

export const MISSIONS = [
  {
    name: 'FIRST GEAR', giver: 'Mara', role: 'MECHANIC',
    briefing: ['Mara: Nico! Mobil pink itu — VELOZ COMET RS — curi, bawa ke bengkelku.', 'Mara: Tekan E di dekat mobil. Jangan sampai PCPD lihat.'],
    steps: [
      { type: 'steal', text: 'Curi VELOZ COMET RS di Malecón', x: -232, z: 70, r: 6 },
      { type: 'goto', text: 'Antar mobil ke bengkel Mara', x: CFG.garage.x, z: CFG.garage.z, r: 8, inCar: true },
    ],
    reward: 200,
  },
  {
    name: 'MEET MARCO', giver: 'Marco', role: 'SMUGGLER · WHEELMAN',
    briefing: ['Marco: Nico, ketemu di Marlin Ceviche. Aku yang bawa kabar dari Lupe.', 'Marco: Jangan bawa PCPD ke mari. Jalan kaki saja.'],
    steps: [
      { type: 'goto', text: 'Pergi ke Marlin Ceviche', x: CFG.marlinCeviche.x, z: CFG.marlinCeviche.z, r: 8 },
      { type: 'talk', text: 'Bicara dengan Marco (E)', x: CFG.marcoPos.x, z: CFG.marcoPos.z, r: 3 },
    ],
    reward: 150,
  },
  {
    name: 'COURIER RUN', giver: 'Kip', role: 'DRIVER',
    briefing: ['Kip: Tiga paket, tiga alamat, empat menit. Jangan tabrak apa pun.', 'Kip: Paket rusak = misi gagal. Gas, Nico.'],
    steps: [
      { type: 'goto', text: 'Antar paket 1/3 — The Spires', x: 120, z: 120, r: 7 },
      { type: 'goto', text: 'Antar paket 2/3 — Old Solara', x: -120, z: -120, r: 7 },
      { type: 'goto', text: 'Antar paket 3/3 — Vista Hills', x: 240, z: 0, r: 7 },
    ],
    reward: 400, time: 240,
  },
  {
    name: 'THE DOCKS JOB', giver: 'Sal Vega', role: 'FIXER',
    briefing: ['Sal Vega: Hauler di The Docks itu milik Dario. Ambil. Penjaganya? Urus.', 'Sal Vega: Bawa truknya ke garasi. Jangan mati.'],
    steps: [
      { type: 'stealType', text: 'Curi truk HAULER di The Docks', x: 180, z: -240, r: 8, carType: 'hauler' },
      { type: 'kill', text: 'Singkirkan 4 penjaga Dario', x: 180, z: -240, r: 40, count: 4 },
      { type: 'goto', text: 'Bawa Hauler ke garasi', x: CFG.garage.x, z: CFG.garage.z, r: 8, inCar: true },
    ],
    reward: 600,
  },
  {
    name: 'NEON NIGHTS', giver: 'Kip', role: 'DRIVER',
    briefing: ['Kip: Kurir Dario lewat tengah malam. Buntuti dari jauh — jangan ketahuan.', 'Kip: Kalau dia kabur, kejar. Jangan sampai hilang.'],
    steps: [
      { type: 'tail', text: 'Buntuti kurir Dario (jaga jarak 12–45 m)', x: 0, z: 0, r: 45 },
      { type: 'chase', text: 'Kejar kurir yang kabur!', x: 240, z: 240, r: 12 },
    ],
    reward: 500, night: true,
  },
  {
    name: 'STREET RACE', giver: 'Marco', role: 'SMUGGLER · WHEELMAN',
    briefing: ['Marco: Balapan jalanan Malecón. Empat checkpoint, lawan tiga mobil.', 'Marco: Menang dan namamu naik. Kalah dan pulang jalan kaki.'],
    steps: [
      { type: 'goto', text: 'Checkpoint 1/4 — ujung Malecón', x: -240, z: -180, r: 9, inCar: true },
      { type: 'goto', text: 'Checkpoint 2/4 — The Docks', x: 0, z: -240, r: 9, inCar: true },
      { type: 'goto', text: 'Checkpoint 3/4 — Vista Hills', x: 240, z: -120, r: 9, inCar: true },
      { type: 'goto', text: 'FINISH — kembali ke Malecón', x: -240, z: 0, r: 9, inCar: true },
    ],
    reward: 750, time: 170,
  },
  {
    name: 'HARBOR LIGHTS', giver: 'Lupe', role: 'CONTACT',
    briefing: ['Lupe: Tiga peti di pelabuhan. Ambil semuanya, lalu ke dermaga.', 'Lupe: Mercusuar itu penanda kita. Jangan nyalakan lampu sorot.'],
    steps: [
      { type: 'goto', text: 'Ke mercusuar', x: CFG.lighthouse.x, z: CFG.lighthouse.z, r: 9 },
      { type: 'collect', text: 'Ambil peti 1/3', x: 200, z: -200, r: 5 },
      { type: 'collect', text: 'Ambil peti 2/3', x: 120, z: -240, r: 5 },
      { type: 'collect', text: 'Ambil peti 3/3', x: 240, z: -180, r: 5 },
      { type: 'goto', text: 'Kembali ke dermaga', x: CFG.pier.x, z: CFG.pier.z, r: 8 },
    ],
    reward: 500,
  },
  {
    name: 'GOLDEN HOUR', giver: 'Lupe', role: 'CONTACT',
    briefing: ['Lupe: Kapal Marco berlayar dua menit lagi, Nico! Hilangkan buruan itu!', 'Marco: Goyang helikopter itu dan sampai ke dermaga!'],
    steps: [
      { type: 'escape', text: 'Hilangkan buruan PCPD (bintang harus 0)', x: -240, z: 90, r: 60 },
      { type: 'goto', text: 'Capai kapal di dermaga', x: -282, z: 90, r: 7 },
    ],
    reward: 1500, time: 107, wanted: 4,
  },
];

let beacon = null;
let beaconRing = null;

export function initMissions(G) {
  G.missionIndex = 0;
  G.missionStage = 0;
  G.missionTimer = 0;
  G.missionTarget = null;
  G._tailTimer = 0;
  G._tailSeen = 0;
  beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 20, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
  );
  beacon.visible = false;
  G.W.scene.add(beacon);
  beaconRing = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.0, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
  );
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.visible = false;
  G.W.scene.add(beaconRing);
  const marco = createPersonMesh({ shirt: 0xff2e7e, pants: 0x2e3440, skin: 0x8a5a3a, hair: 0x14100c });
  marco.position.set(CFG.marcoPos.x, 0, CFG.marcoPos.z);
  marco.rotation.y = Math.PI / 2;
  G.W.scene.add(marco);
  G.marco = { mesh: marco, x: CFG.marcoPos.x, z: CFG.marcoPos.z };
  const lupe = createPersonMesh({ shirt: 0x37c8e8, pants: 0xf2ede2, skin: 0xe8b88a, hair: 0x2a1a0c });
  lupe.position.set(-282, 0.1, CFG.pier.z + 2);
  lupe.rotation.y = -Math.PI / 2;
  G.W.scene.add(lupe);
  G.lupe = { mesh: lupe, x: -282, z: CFG.pier.z + 2 };
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(9, 1.4, 3.2),
    new THREE.MeshLambertMaterial({ color: 0xf2ede2 }));
  hull.position.y = 0.4; boat.add(hull);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 2.6),
    new THREE.MeshLambertMaterial({ color: 0x1f7a6e }));
  cabin.position.set(-1, 1.8, 0); boat.add(cabin);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 6),
    new THREE.MeshLambertMaterial({ color: 0x5a4632 }));
  mast.position.set(1.5, 3.4, 0); boat.add(mast);
  boat.position.set(-292, 0, 96);
  boat.rotation.y = 0.3;
  G.W.scene.add(boat);
  G.boat = boat;
  initSideActivities(G);
}

function initSideActivities(G) {
  G.coins = [];
  const coinGeo = new THREE.SphereGeometry(0.55, 10, 8);
  const coinMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  for (let i = 0; i < CFG.sunCoinCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * 230;
    const x = Math.max(-245, Math.min(285, Math.cos(a) * r));
    const z = Math.max(-285, Math.min(285, Math.sin(a) * r));
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.position.set(x, 1.1, z);
    G.W.scene.add(m);
    G.coins.push({ mesh: m, x, z, taken: false, phase: Math.random() * 6 });
  }
  G.coinsCollected = 0;
  G.ramps = [];
  const rampMat = new THREE.MeshLambertMaterial({ color: 0xe86a1e });
  for (const [rx, rz, ry] of [[-120, -6, 0], [120, 6, Math.PI], [0, 126, Math.PI / 2]]) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6, 4), rampMat);
    ramp.position.set(rx, 0.8, rz);
    ramp.rotation.y = ry;
    ramp.rotation.z = 0.18;
    G.W.scene.add(ramp);
    G.ramps.push({ x: rx, z: rz, used: false });
  }
  const fare = createPersonMesh({ shirt: 0xe8b93a, pants: 0x2e3440, skin: 0xc98d64, hair: 0x6b4426 });
  fare.position.set(CFG.taxiStand.x, 0, CFG.taxiStand.z);
  G.W.scene.add(fare);
  G.taxi = { active: false, ped: { mesh: fare, x: CFG.taxiStand.x, z: CFG.taxiStand.z }, dest: null, done: false };
}

export function currentMission(G) { return MISSIONS[G.missionIndex] || null; }

export function missionObjectiveText(G) {
  const m = currentMission(G);
  if (!m) return 'Free roam — Solara Bay milikmu';
  const s = m.steps[G.missionStage];
  return s ? s.text : m.name;
}

function setTarget(G, step) {
  if (!step) { G.missionTarget = null; return; }
  G.missionTarget = { x: step.x, z: step.z, r: step.r || 8, label: step.text };
  if (G.hud) G.hud.showObjective(step.text);
}

export function startMission(G, i) {
  const m = MISSIONS[i];
  if (!m) { G.missionIndex = i; G.missionTarget = null; return; }
  G.missionIndex = i;
  G.missionStage = 0;
  G.missionTimer = m.time || 0;
  G._tailTimer = 0;
  G._kills = 0;
  if (m.night) G.timeOfDay = 21.0;
  if (m.wanted) addWanted(G, m.wanted, `Wanted ${m.wanted} bintang — buruan besar!`);
  if (G.hud) {
    G.hud.showDialog(m.giver, m.role, m.briefing[0]);
    setTimeout(() => { if (G.hud && currentMission(G) === m) G.hud.showDialog(m.giver, m.role, m.briefing[1] || m.briefing[0]); }, 4200);
  }
  if (i === 3) {
    const hauler = makeCar('hauler', 180, -240, Math.PI / 2);
    G.W.scene.add(hauler.group);
    G.parked.push(hauler);
    for (const [gx, gz] of [[172, -232], [188, -248], [176, -252], [192, -236]]) spawnGuard(G, gx, gz);
  }
  if (i === 4) {
    const courier = makeCar('mula', 60, 60, Math.PI);
    courier.speed = 11;
    G.W.scene.add(courier.group);
    G._courier = { car: courier, angle: 0 };
  }
  if (i === 5) {
    for (let r = 0; r < 3; r++) {
      const rival = makeCar(pick(G.rng, ['veloce', 'cometa', 'pip']), -236 + r * 3, -20 - r * 6, 0);
      rival.speed = 20;
      G.W.scene.add(rival.group);
      (G._rivals = G._rivals || []).push(rival);
    }
  }
  setTarget(G, m.steps[0]);
}

export function completeMission(G) {
  const m = currentMission(G);
  if (!m) return;
  G.cash += m.reward;
  G.stats.missionsDone++;
  G.respect = Math.min(5, G.stats.missionsDone + 1);
  G.audio.jingle(true);
  if (G.hud) {
    G.hud.toast(`MISI SELESAI — ${m.name} +$${m.reward}`);
    G.hud.showDialog(m.giver, m.role, `Bagus, Nico. $${m.reward} masuk. Lanjut.`);
  }
  if (G.hud) G.hud.saveGame(G);
  if (beacon) beacon.visible = false;
  if (beaconRing) beaconRing.visible = false;
  G.missionTarget = null;
  const next = G.missionIndex + 1;
  if (next >= MISSIONS.length) {
    G.phase = 'finale';
    if (G.hud) G.hud.showDialog('Lupe', 'CONTACT', 'Utang lunas, Nico. Solara Bay milikmu sekarang.');
    return;
  }
  setTimeout(() => { if (G.phase === 'play') startMission(G, next); }, 2500);
}

export function failMission(G, why) {
  if (G.phase !== 'play') return;
  G.phase = 'missionFailed';
  G.audio.jingle(false);
  if (G.hud) {
    G.hud.toast(`MISI GAGAL — ${why}`);
    G.hud.setPhase('missionFailed');
  }
}

export function advanceStep(G) {
  const m = currentMission(G);
  if (!m) return;
  G.missionStage++;
  G.audio.pickup();
  if (G.missionStage >= m.steps.length) { completeMission(G); return; }
  setTarget(G, m.steps[G.missionStage]);
}

function distToTarget(G, t) {
  return Math.hypot(G.player.x - t.x, G.player.z - t.z);
}

export function updateMissions(G, dt, elapsed) {
  if (beacon && G.missionTarget && G.phase === 'play') {
    beacon.visible = true;
    beaconRing.visible = true;
    beacon.position.set(G.missionTarget.x, 10, G.missionTarget.z);
    beaconRing.position.set(G.missionTarget.x, 0.15, G.missionTarget.z);
    const s = 1 + Math.sin(elapsed * 3) * 0.18;
    beaconRing.scale.set(s, s, 1);
  } else if (beacon) {
    beacon.visible = false;
    beaconRing.visible = false;
  }
  if (G.boat) {
    G.boat.position.y = Math.sin(elapsed * 0.9) * 0.12;
    G.boat.rotation.z = Math.sin(elapsed * 0.7) * 0.02;
  }
  for (const c of G.coins) {
    if (c.taken) continue;
    c.mesh.rotation.y += dt * 2;
    c.mesh.position.y = 1.1 + Math.sin(elapsed * 2 + c.phase) * 0.25;
    if (Math.hypot(G.player.x - c.x, G.player.z - c.z) < 2.2) {
      c.taken = true;
      c.mesh.visible = false;
      G.coinsCollected++;
      G.cash += 25;
      G.audio.pickup();
      if (G.hud) G.hud.toast(`Sun Coin +$25 (${G.coinsCollected}/30)`);
    }
  }
  if (G.inCar && G.car) {
    for (const r of G.ramps) {
      if (!r.used && Math.hypot(G.car.x - r.x, G.car.z - r.z) < 4 && Math.abs(G.car.speed) > 22) {
        r.used = true;
        G.cash += 100;
        G.car.speed = Math.min(G.car.def.maxSpeed, G.car.speed + 6);
        G.W.spawnParticles({ x: r.x, y: 1, z: r.z }, 0xffd23f, 20, 2.5, 2);
        if (G.hud) G.hud.toast('STUNT JUMP! +$100');
        G.audio.jingle(true);
      }
    }
  }
  if (G.taxi && !G.taxi.done) {
    const t = G.taxi;
    if (!t.active) {
      const d = Math.hypot(G.player.x - t.ped.x, G.player.z - t.ped.z);
      if (d < 4) G._nearTaxi = true; else G._nearTaxi = false;
      if (d < 5 && G.inCar) {
        t.active = true;
        t.dest = pick(G.rng, [{ x: 240, z: 240 }, { x: -120, z: 120 }, { x: 120, z: -240 }]);
        t.ped.mesh.visible = false;
        G.missionTarget = { x: t.dest.x, z: t.dest.z, r: 8, label: 'Antar penumpang' };
        if (G.hud) G.hud.toast('Penumpang naik — antar ke marker kuning');
      }
    } else if (Math.hypot(G.player.x - t.dest.x, G.player.z - t.dest.z) < 8) {
      t.active = false; t.done = true;
      G.cash += 80;
      if (G.hud) G.hud.toast('Tarif taksi +$80');
      G.audio.jingle(true);
      const m = currentMission(G);
      if (m) setTarget(G, m.steps[G.missionStage]);
    }
  }
  if (G.shotMode) return;
  if (G.phase !== 'play') return;
  const m = currentMission(G);
  if (!m) return;
  const step = m.steps[G.missionStage];
  if (!step) return;
  if (G.missionTimer > 0) {
    G.missionTimer -= dt;
    if (G.missionTimer <= 0) { failMission(G, 'Waktu habis'); return; }
  }
  const d = distToTarget(G, step);
  switch (step.type) {
    case 'goto':
      if (d < step.r) advanceStep(G);
      break;
    case 'steal':
      if (G.inCar) advanceStep(G);
      break;
    case 'stealType':
      if (G.inCar && G.car && G.car.type === step.carType) advanceStep(G);
      break;
    case 'talk':
      if (G._talkKey && d < step.r) {
        if (G.hud) G.hud.showDialog('Marco', 'SMUGGLER · WHEELMAN', 'Lupe nunggu di dermaga. Kapalnya siap — kamu yang bawa kabar baiknya.');
        advanceStep(G);
      }
      break;
    case 'kill':
      if (G._kills >= step.count) advanceStep(G);
      break;
    case 'collect':
      if (d < step.r) advanceStep(G);
      break;
    case 'escape':
      if (G.wanted === 0) advanceStep(G);
      else if (G.missionTimer > 0 && G.missionTimer < 20 && G.wanted > 0 && G.hud) {
      }
      break;
    case 'tail': {
      const c = G._courier;
      if (c) {
        c.angle += dt * 0.06;
        const cx = Math.cos(c.angle) * 90, cz = Math.sin(c.angle) * 90;
        const dx = cx - c.car.x, dz = cz - c.car.z;
        const dd = Math.hypot(dx, dz) || 1;
        c.car.heading = Math.atan2(dx, dz);
        c.car.x += (dx / dd) * 11 * dt;
        c.car.z += (dz / dd) * 11 * dt;
        c.car.group.position.set(c.car.x, 0, c.car.z);
        c.car.group.rotation.y = c.car.heading;
        const pd = Math.hypot(G.player.x - c.car.x, G.player.z - c.car.z);
        G.missionTarget = { x: c.car.x, z: c.car.z, r: 6, label: 'Kurir Dario' };
        if (pd > 12 && pd < 45) G._tailTimer += dt;
        else if (pd < 8) { G._tailSeen += dt; if (G._tailSeen > 3) { failMission(G, 'Ketahuan kurir!'); return; } }
        else if (pd > 70) { G._tailSeen += dt; if (G._tailSeen > 5) { failMission(G, 'Kurir hilang dari pandangan'); return; } }
        else G._tailSeen = 0;
        if (G._tailTimer > 20) {
          G.W.scene.remove(c.car.group);
          G._courier = null;
          advanceStep(G);
        }
      }
      break;
    }
    case 'chase': {
      if (d < step.r) advanceStep(G);
      break;
    }
    default:
      if (d < step.r) advanceStep(G);
  }
}
