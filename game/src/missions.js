// SOLARA BAY — 8 story missions: First Gear, Meet Marco, Courier Run,
// The Docks Job, Neon Nights, Street Race, Beach Party, Golden Hour.
// A tiny step engine drives every mission: reach / talk / steal / drive /
// guards / tail / race / collect / escape. Each mission has a briefing
// dialog, a 3D beacon + minimap marker, checkpoints, fail + retry.
import * as THREE from 'three';
import { CFG } from './config.js';
import { createPersonMesh } from './player.js';
import { makeCar } from './vehicles.js';
import { spawnGuard } from './combat.js';
import { addWanted } from './police.js';
import { rr, pick } from './random.js';

export const MISSIONS = [
  {
    id: 'first-gear', name: 'FIRST GEAR', chapter: 'JOB 1/8',
    speaker: 'Marco', role: 'SMUGGLER · WHEELMAN',
    dialog: 'Selamat datang di Solara Bay, Nico. Kota ini milik siapa yang berani ambil. Curi mobil itu, bawa ke garasi.',
    reward: 500,
    steps: [
      { type: 'steal', text: 'Curi VELOZ COMET RS di Malecón' },
      { type: 'drive', x: -116, z: -116, r: 8, text: 'Antar mobil ke garasi' },
    ],
  },
  {
    id: 'meet-marco', name: 'MEET MARCO', chapter: 'JOB 2/8',
    speaker: 'Marco', role: 'SMUGGLER · WHEELMAN',
    dialog: 'Nico! Ketemu gue di Marlin Ceviche. Ada kerjaan — dan jangan telat, perahunya nggak nunggu.',
    reward: 800,
    steps: [
      { type: 'reach', x: -240, z: 87, r: 4, text: 'Temui Marco di Marlin Ceviche' },
      { type: 'talk', x: -240, z: 87, r: 4, text: 'Bicara dengan Marco (tekan E)' },
      { type: 'drive', x: -268, z: 90, r: 6, text: 'Antar Marco ke dermaga' },
    ],
  },
  {
    id: 'courier-run', name: 'COURIER RUN', chapter: 'JOB 3/8',
    speaker: 'Lupe', role: 'FIXER · MARINA',
    dialog: 'Tiga paket, empat menit, jangan sampai rusak. Traffic lagi padat — pilih jalanmu sendiri.',
    reward: 1200, timer: 240,
    steps: [
      { type: 'drive', x: 120, z: 120, r: 8, text: 'Antar paket 1/3 ke The Spires' },
      { type: 'drive', x: 0, z: -120, r: 8, text: 'Antar paket 2/3 ke The Docks' },
      { type: 'drive', x: 240, z: 240, r: 8, text: 'Antar paket 3/3 ke Vista Hills' },
    ],
  },
  {
    id: 'docks-job', name: 'THE DOCKS JOB', chapter: 'JOB 4/8',
    speaker: 'Sal Vega', role: 'FIXER',
    dialog: 'Truk Hauler di dermaga dijaga empat orang Dario. Beresin mereka, bawa truknya ke garasi. Cepat, Nico.',
    reward: 2000,
    steps: [
      { type: 'reach', x: -180, z: -240, r: 10, text: 'Masuk ke area The Docks' },
      { type: 'guards', n: 4, x: -180, z: -240, text: 'Lumpuhkan 4 penjaga Dario' },
      { type: 'steal', text: 'Curi truk Hauler di dermaga' },
      { type: 'drive', x: -116, z: -116, r: 8, text: 'Bawa Hauler ke garasi (wanted 2)' },
    ],
  },
  {
    id: 'neon-nights', name: 'NEON NIGHTS', chapter: 'JOB 5/8',
    speaker: 'Kip', role: 'HACKER',
    dialog: 'Kurir Dario lagi keliling downtown. Buntuti dia dari jauh — ketahuan, dia kabur. Gue pantau dari sini.',
    reward: 2500,
    steps: [
      { type: 'tail', text: 'Buntuti kurir Dario tanpa ketahuan' },
      { type: 'chase', text: 'Kejar kurir yang kabur — pepet dia!' },
    ],
  },
  {
    id: 'street-race', name: 'STREET RACE', chapter: 'JOB 6/8',
    speaker: 'Marco', role: 'SMUGGLER · WHEELMAN',
    dialog: 'Balapan jalanan, Malecón sampai Vista Hills. Kalahin Veloce-nya Rocco dan hadiahnya milik lo.',
    reward: 3000, timer: 150,
    steps: [
      { type: 'race', points: [{ x: 240, z: 0 }, { x: 240, z: 240 }, { x: 0, z: 240 }, { x: -240, z: 240 }], text: 'Balapan: lewati semua checkpoint' },
    ],
  },
  {
    id: 'beach-party', name: 'BEACH PARTY', chapter: 'JOB 7/8',
    speaker: 'Lupe', role: 'FIXER · MARINA',
    dialog: 'Pesta di pantai butuh lima peti dari dermaga. Ambil petinya, antar ke pier — dan jangan nyebur, Nico.',
    reward: 1500,
    steps: [
      { type: 'collect', points: [{ x: -250, z: -200 }, { x: -250, z: -60 }, { x: -250, z: 40 }, { x: -250, z: 160 }, { x: -250, z: 250 }], text: 'Kumpulkan 5 peti di pantai' },
      { type: 'drive', x: -268, z: 90, r: 6, text: 'Antar peti ke dermaga' },
    ],
  },
  {
    id: 'golden-hour', name: 'GOLDEN HOUR', chapter: 'JOB 8/8',
    speaker: 'Marco', role: 'SMUGGLER · WHEELMAN',
    dialog: 'Perahunya berlayar dua menit lagi, Nico! Lepas dari kejaran mereka dan sampai ke dermaga!',
    reward: 5000, timer: 107,
    steps: [
      { type: 'escape', x: -268, z: 90, r: 6, text: 'Capai perahu di dermaga sebelum berlayar' },
    ],
  },
];

export function initMissions(G) {
  G.missionIndex = 0;
  G.missionStep = 0;
  G.missionTimer = null;
  G.missionTarget = null;
  G.missionGuardsLeft = 0;
  G.taxi = { done: 0, active: null };
  G.gameWon = false;
  // Marco waits at Marlin Ceviche; Lupe waits at the pier.
  const marco = createPersonMesh({ skin: 0xc98a5e, shirt: 0x2e8fd2, pants: 0x22303f, hair: 0x14100c, hat: 0x2e8fd2 });
  marco.position.set(CFG.marcoPos.x, 0, CFG.marcoPos.z);
  marco.rotation.y = Math.PI / 2;
  G.W.scene.add(marco);
  G.marcoMesh = marco;
  const lupe = createPersonMesh({ skin: 0xe8b88a, shirt: 0xff8fd6, pants: 0x2a4a6b, hair: 0x3a2418 });
  lupe.position.set(CFG.pier.x + 4, 0, CFG.pier.z + 6);
  lupe.rotation.y = -Math.PI / 2;
  G.W.scene.add(lupe);
  G.lupeMesh = lupe;
  // Beacon: glowing pillar + ring marking the active objective.
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.visible = false;
  G.W.scene.add(pillar);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.22, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23f }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.visible = false;
  G.W.scene.add(ring);
  G.beacon = { pillar, ring };
}

export function currentMission(G) { return MISSIONS[G.missionIndex] || null; }

export function missionObjectiveText(G) {
  const m = currentMission(G);
  if (!m) return 'Free roam — kota milikmu, Nico.';
  const s = m.steps[G.missionStep];
  return s ? s.text : m.name;
}

function setBeacon(G, x, z) {
  G.missionTarget = x === null ? null : { x, z };
  G.beacon.pillar.visible = x !== null;
  G.beacon.ring.visible = x !== null;
  if (x !== null) {
    G.beacon.pillar.position.set(x, 30, z);
    G.beacon.ring.position.set(x, 0.15, z);
  }
}

function setupStep(G) {
  const m = currentMission(G);
  if (!m) { setBeacon(G, null, null); return; }
  const s = m.steps[G.missionStep];
  if (!s) { completeMission(G); return; }
  G._tailTime = 0;
  G._raceIdx = 0;
  G._collectIdx = 0;
  G._chaseCar = null;
  if (s.type === 'reach' || s.type === 'talk' || s.type === 'drive' || s.type === 'escape') setBeacon(G, s.x, s.z);
  else if (s.type === 'guards') {
    setBeacon(G, s.x, s.z);
    G.missionGuardsLeft = s.n;
    for (let i = 0; i < s.n; i++) {
      spawnGuard(G, s.x + rr(G.rng, -8, 8), s.z + rr(G.rng, -8, 8));
    }
  } else if (s.type === 'race' || s.type === 'collect') {
    setBeacon(G, s.points[0].x, s.points[0].z);
  } else if (s.type === 'tail') {
    const courier = makeCar('cometa', 60, 60, 0, 0x8a5fd2, false);
    G.W.scene.add(courier.group);
    G._chaseCar = courier;
    G._courierRoute = { x: -60, z: 60 };
    setBeacon(G, courier.x, courier.z);
  } else if (s.type === 'steal') {
    if (G.missionIndex === 3) {
      // Docks job: park a Hauler at the docks for the player to steal.
      const truck = makeCar('hauler', -186, -232, Math.PI / 2, undefined, false);
      G.W.scene.add(truck.group);
      G.parked.push({ car: truck, kind: 'parked' });
    }
    setBeacon(G, G.missionIndex === 3 ? -186 : -234, G.missionIndex === 3 ? -232 : 66);
  } else if (s.type === 'chase') {
    if (G._chaseCar) setBeacon(G, G._chaseCar.x, G._chaseCar.z);
  }
  G.showObjective(missionObjectiveText(G));
}

export function startMission(G, i) {
  G.missionIndex = i;
  G.missionStep = 0;
  const m = MISSIONS[i];
  G.missionTimer = m.timer || null;
  if (i === 4) G.timeOfDay = 21.2; // Neon Nights starts at night
  if (i === 7) { G.timeOfDay = 17.8; addWanted(G, 4, 'manhunt'); } // Golden Hour: 4-star manhunt
  G.showDialog(m.speaker, m.role, m.dialog);
  setupStep(G);
}

export function completeMission(G) {
  const m = currentMission(G);
  if (!m) return;
  G.cash += m.reward;
  G.audio.jingle(true);
  G.toast(`MISI SELESAI — ${m.name} +$${m.reward}`);
  setBeacon(G, null, null);
  G.missionIndex++;
  G.missionStep = 0;
  G.missionTimer = null;
  if (G.missionIndex >= MISSIONS.length) {
    G.gameWon = true;
    G.phase = 'won';
    G.showDialog('Marco', 'SMUGGLER · WHEELMAN', 'Kita berhasil, Nico. Utang lunas — Solara Bay milik kita sekarang.');
    return;
  }
  startMission(G, G.missionIndex);
}

export function failMission(G, why) {
  G.audio.jingle(false);
  G.phase = 'failed';
  G._failReason = why;
}

export function advanceStep(G) {
  const m = currentMission(G);
  if (!m) return;
  G.missionStep++;
  if (G.missionStep >= m.steps.length) completeMission(G);
  else setupStep(G);
}

export function updateMissions(G, dt, elapsed) {
  const m = currentMission(G);
  if (G.gameWon) return;
  // Beacon pulse + courier movement.
  if (G.beacon.pillar.visible) {
    G.beacon.ring.scale.setScalar(1 + Math.sin(elapsed * 3) * 0.12);
    G.beacon.pillar.material.opacity = 0.22 + Math.sin(elapsed * 3) * 0.08;
  }
  if (m) {
    if (G.missionTimer !== null) {
      G.missionTimer -= dt;
      if (G.missionTimer <= 0) { failMission(G, 'Waktu habis'); return; }
    }
    const s = m.steps[G.missionStep];
    if (s) {
      const px = G.player.x, pz = G.player.z;
      if (s.type === 'reach' || s.type === 'drive' || s.type === 'escape') {
        const d = Math.hypot(px - s.x, pz - s.z);
        if (d < s.r) {
          if (s.type === 'drive' && !G.inCar) { /* must arrive by car */ }
          else if (s.type === 'escape' && G.wanted > 2 && G.missionTimer > 25) {
            G.showObjective('Lepas dari kejaran dulu — cari jalan memutar!');
          } else advanceStep(G);
        }
      } else if (s.type === 'talk') {
        if (Math.hypot(px - s.x, pz - s.z) < s.r && G._talkKey) {
          G.showDialog('Marco', 'SMUGGLER · WHEELMAN', 'Ikut gue ke dermaga. Bawa mobil — jalan kaki kelamaan.');
          advanceStep(G);
        }
      } else if (s.type === 'steal') {
        if (G.inCar) {
          if (G.missionIndex === 3) addWanted(G, 2, 'truk dicuri');
          advanceStep(G);
        }
      } else if (s.type === 'guards') {
        if (G.missionGuardsLeft <= 0) advanceStep(G);
      } else if (s.type === 'tail' || s.type === 'chase') {
        const c = G._chaseCar;
        if (c) {
          if (s.type === 'tail') {
            // Courier cruises a loop around downtown.
            const dx = G._courierRoute.x - c.x, dz = G._courierRoute.z - c.z;
            const dd = Math.hypot(dx, dz);
            if (dd < 6) G._courierRoute = pick(G.rng, [{ x: 60, z: 60 }, { x: -60, z: 60 }, { x: -60, z: -60 }, { x: 60, z: -60 }]);
            c.heading = Math.atan2(dx, dz);
            c.x += Math.sin(c.heading) * 9 * dt;
            c.z += Math.cos(c.heading) * 9 * dt;
            c.group.position.set(c.x, 0, c.z);
            c.group.rotation.y = c.heading;
            setBeacon(G, c.x, c.z);
            const pd = Math.hypot(px - c.x, pz - c.z);
            if (pd < 6) { G._tailTime = Math.max(0, G._tailTime - dt * 2); G.showObjective('Terlalu dekat — dia bisa melihatmu!'); }
            else if (pd < 35) { G._tailTime += dt; }
            else if (pd > 55) { failMission(G, 'Kurir kabur dari pandangan'); return; }
            if (G._tailTime >= 12) advanceStep(G);
          } else {
            // Courier flees; catch it (get within 5 m).
            const dx = px - c.x, dz = pz - c.z;
            const dd = Math.hypot(dx, dz);
            c.heading = Math.atan2(-dx, -dz);
            c.x += Math.sin(c.heading) * 13 * dt;
            c.z += Math.cos(c.heading) * 13 * dt;
            c.group.position.set(c.x, 0, c.z);
            c.group.rotation.y = c.heading;
            setBeacon(G, c.x, c.z);
            if (dd < 5) advanceStep(G);
          }
        }
      } else if (s.type === 'race') {
        const pt = s.points[G._raceIdx];
        if (pt) {
          setBeacon(G, pt.x, pt.z);
          if (G.inCar && Math.hypot(px - pt.x, pz - pt.z) < 9) {
            G._raceIdx++;
            G.audio.coin();
            if (G._raceIdx >= s.points.length) advanceStep(G);
            else G.showObjective(`Checkpoint ${G._raceIdx + 1}/${s.points.length}`);
          }
        }
      } else if (s.type === 'collect') {
        const pt = s.points[G._collectIdx];
        if (pt) {
          setBeacon(G, pt.x, pt.z);
          if (Math.hypot(px - pt.x, pz - pt.z) < 3) {
            G._collectIdx++;
            G.audio.coin();
            if (G._collectIdx >= s.points.length) advanceStep(G);
          }
        }
      }
    }
  }
  // Taxi side job: 3 fares, only while driving near the stand.
  if (G.taxi.done < 3 && G.inCar) {
    if (!G.taxi.active && Math.hypot(G.player.x - CFG.taxiStand.x, G.player.z - CFG.taxiStand.z) < 8) {
      const dest = { x: pick(G.rng, [-240, 0, 120, 240]), z: pick(G.rng, [-120, 0, 120, 240]) };
      G.taxi.active = dest;
      setBeacon(G, dest.x, dest.z);
      G.showObjective('Tarif taksi — antar penumpang ke marker');
    } else if (G.taxi.active) {
      const d = G.taxi.active;
      if (Math.hypot(G.player.x - d.x, G.player.z - d.z) < 8) {
        G.cash += 150;
        G.taxi.done++;
        G.taxi.active = null;
        G.audio.jingle(true);
        G.toast(`Tarif taksi selesai +$150 (${G.taxi.done}/3)`);
        if (m) setupStep(G);
      }
    }
  }
  // Player death / busted ends the run.
  if (G.health <= 0 && G.phase === 'play') G.phase = 'dead';
}
