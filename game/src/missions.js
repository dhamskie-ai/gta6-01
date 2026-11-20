// 8 story missions + side activities: taxi, street race, fishing, photo, courier.
import * as THREE from 'three';
import { CFG, MISSIONS, RACE_CP, COURIER_SPOTS, FISH_SPOTS, PHOTO_SPOTS, FISH } from './config.js';
import { makeCar, isCarObj } from './vehicles.js';
import { spawnNPC } from './traffic.js';
import { driveCarRef } from './player.js';
import { keyPressed } from './input.js';
import { spawnGuards, guardsAlive } from './combat.js';
import { setWanted } from './police.js';
import { sfx } from './audio.js';

export function initMissions(G) {
  G.missionIdx = 0; G.missionStage = 0; G.missionTimer = 0;
  G.taxi = null; G.race = null; G.fishing = null; G.courier = null;
  G.photosDone = [];
  G.talkAvailable = false;
  // Beacon: glowing pillar marking the current objective.
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 30, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23d, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  pillar.position.y = 15; beacon.add(pillar);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.25, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23d }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; beacon.add(ring);
  G.scene.add(beacon);
  G.beacon = beacon;
  spawnNPC(G, 'Marco', -238, 64, 0x8a5a3a, 0x1e3a5e, 0x2c3242, 0x111111);
  spawnNPC(G, 'Lupe', -272, 150, 0xc98a5e, 0xff2e7e, 0x2c3242, 0xffd23d);
  startMission(G, 0);
}
export function showDialog(G, name, role, text) {
  G.dialog = { name, role, text, t: 6 };
}
export function startMission(G, i) {
  const m = MISSIONS[i];
  if (!m) { G.objective = 'Solara Bay is yours'; return; }
  G.missionIdx = i; G.missionStage = 0;
  G.missionTitle = m.title; G.missionNext = m.next;
  G.missionTimer = m.timer || 0;
  G.tailT = 0;
  if (m.night) G.timeOfDay = m.night;
  if (m.wantedOnStart) setWanted(G, m.wantedOnStart);
  if (m.guards) { G.guards = []; spawnGuards(G, m.guards); }
  if (i === 4) spawnCourier(G);
  showDialog(G, m.brief.name, m.brief.role, m.brief.text);
  updateObjective(G);
}
function updateObjective(G) {
  const m = MISSIONS[G.missionIdx];
  if (!m) return;
  const s = m.steps[G.missionStage];
  if (!s) return;
  G.objective = s.label;
  G.missionX = s.x; G.missionZ = s.z;
  if (G.beacon) G.beacon.position.set(s.x, 0, s.z);
}
function nextStep(G) {
  const m = MISSIONS[G.missionIdx];
  if (m.steps[G.missionStage].k === 'tail' && G.courierCar) {
    G.scene.remove(G.courierCar.group);
    const i = G.cars.indexOf(G.courierCar); if (i >= 0) G.cars.splice(i, 1);
    G.courierCar = null;
  }
  G.missionStage++;
  if (G.missionStage >= m.steps.length) {
    G.cash += m.reward;
    G.centerMsg(`Misi selesai: ${m.title} +$${m.reward}`, 3.5);
    sfx(G, 'jingle');
    G.missionIdx++;
    if (G.missionIdx >= MISSIONS.length) {
      G.objective = 'Solara Bay is yours';
      if (G.beacon) G.beacon.visible = false;
      return;
    }
    startMission(G, G.missionIdx);
    return;
  }
  const s = m.steps[G.missionStage];
  if (s.k === 'kill') { /* guards already spawned */ }
  if (s.k === 'race') startRace(G, true);
  if (m.wantedOnDrive && s.k === 'drive' && G.missionStage === 2) setWanted(G, m.wantedOnDrive);
  sfx(G, 'coin');
  updateObjective(G);
}
function failMission(G, why) {
  G.centerMsg(`${why} — misi diulang.`, 3);
  sfx(G, 'fail');
  if (G.race) { endRace(G); }
  if (G.courierCar) { G.scene.remove(G.courierCar.group); G.courierCar = null; }
  startMission(G, G.missionIdx);
}
function spawnCourier(G) {
  const car = makeCar(G, 'sedan', 240, 120, Math.PI / 2);
  car.courier = true; car.wp = 0;
  G.cars.push(car);
  G.courierCar = car;
  G.courierPath = [[240, 120], [120, 120], [0, 120], [-120, 120], [-240, 120], [-240, 0], [-240, -120]];
}
function dist2(G, x, z) { return Math.hypot(G.player.x - x, G.player.z - z); }
export function updateMissions(G, dt) {
  if (G.phase !== 'play') return;
  const m = MISSIONS[G.missionIdx];
  if (m) {
    if (m.timer) {
      G.missionTimer -= dt;
      if (G.missionTimer <= 0) { failMission(G, 'Waktu habis!'); return; }
    }
    const s = m.steps[G.missionStage];
    if (s) {
      G.talkAvailable = false;
      if (s.k === 'reach') {
        if (dist2(G, s.x, s.z) < s.r) nextStep(G);
      } else if (s.k === 'drive') {
        const car = driveCarRef(G);
        if (car && dist2(G, s.x, s.z) < s.r) nextStep(G);
      } else if (s.k === 'talk') {
        if (dist2(G, s.x, s.z) < 6) {
          G.talkAvailable = dist2(G, s.x, s.z) < s.r;
          if (G.talkAvailable && keyPressed(G, 'KeyE')) {
            showDialog(G, s.x < -200 ? 'Marco' : 'Lupe', '', 'Ayo, Nico — gas!');
            nextStep(G);
          }
        }
      } else if (s.k === 'kill') {
        if (guardsAlive(G) === 0) nextStep(G);
      } else if (s.k === 'tail') {
        updateTail(G, dt, s);
      } else if (s.k === 'race') {
        const res = updateRace(G, dt);
        if (res === 'win') nextStep(G);
        else if (res === 'lose') failMission(G, 'Rival menang!');
      }
    }
    if (G.beacon && G.beacon.visible) {
      G.beacon.children[1].rotation.z += dt;
      G.beacon.children[0].material.opacity = 0.25 + Math.sin(G.elapsed * 3) * 0.12;
    }
  }
  updateActivities(G, dt);
  if (G.dialog) { G.dialog.t -= dt; if (G.dialog.t <= 0) G.dialog = null; }
}
function updateTail(G, dt, s) {
  const c = G.courierCar;
  if (!isCarObj(c)) return;
  const wp = G.courierPath[c.wp];
  const dx = wp[0] - c.x, dz = wp[1] - c.z, d = Math.hypot(dx, dz);
  if (d < 4) c.wp = (c.wp + 1) % G.courierPath.length;
  else {
    c.heading = Math.atan2(dx, dz);
    c.x += Math.sin(c.heading) * 12 * dt;
    c.z += Math.cos(c.heading) * 12 * dt;
    c.group.position.set(c.x, 0, c.z);
    c.group.rotation.y = c.heading;
  }
  const pd = Math.hypot(G.player.x - c.x, G.player.z - c.z);
  if (pd < 8) { failMission(G, 'Spotted!'); return; }
  if (pd < 40) {
    G.tailT += dt;
    if (G.tailT > 12) nextStep(G);
  }
}
// ---- street race (mission + free activity) ----
export function startRace(G, forMission) {
  if (G.race) return;
  const mk = (type, x, z) => {
    const car = makeCar(G, type, x, z, 0);
    car.racer = true; car.cp = 0;
    G.cars.push(car);
    return car;
  };
  G.race = {
    cps: RACE_CP, idx: 0, forMission,
    rivals: [mk('sport', -4, -186), mk('sedan', 4, -186)],
  };
  G.centerMsg(forMission ? 'Balapan! Lewati 3 checkpoint — kalahkan 2 rival!' : 'Balapan jalanan! 3 checkpoint, $120 untuk pemenang!', 3);
}
function endRace(G) {
  if (!G.race) return;
  for (const r of G.race.rivals) {
    G.scene.remove(r.group);
    const i = G.cars.indexOf(r); if (i >= 0) G.cars.splice(i, 1);
  }
  G.race = null;
}
function updateRace(G, dt) {
  const r = G.race;
  if (!r) return null;
  const car = driveCarRef(G);
  if (car) {
    const [cx, cz] = r.cps[r.idx];
    if (Math.hypot(car.x - cx, car.z - cz) < 10) {
      r.idx++;
      sfx(G, 'coin');
      if (r.idx >= r.cps.length) {
        const won = true;
        endRace(G);
        if (!r.forMission) { G.cash += CFG.racePrize; G.stats.races++; G.centerMsg(`Menang balapan +$${CFG.racePrize}!`, 3); sfx(G, 'jingle'); }
        return 'win';
      }
    }
  }
  for (const rv of r.rivals) {
    const [cx, cz] = r.cps[rv.cp];
    const dx = cx - rv.x, dz = cz - rv.z, d = Math.hypot(dx, dz);
    if (d < 8) {
      rv.cp++;
      if (rv.cp >= r.cps.length) {
        endRace(G);
        if (!r.forMission) G.centerMsg('Rival menang — balapan kalah.', 3);
        return 'lose';
      }
      continue;
    }
    rv.heading = Math.atan2(dx, dz);
    const sp = rv.type === 'sport' ? 30 : 26;
    rv.x += Math.sin(rv.heading) * sp * dt;
    rv.z += Math.cos(rv.heading) * sp * dt;
    rv.group.position.set(rv.x, 0, rv.z);
    rv.group.rotation.y = rv.heading;
  }
  return null;
}
// ---- side activities ----
function updateActivities(G, dt) {
  // Taxi (T on foot).
  if (keyPressed(G, 'KeyT') && !driveCarRef(G) && !G.taxi) {
    const a = G.rng.f() * Math.PI * 2;
    const x = G.player.x + Math.cos(a) * 12, z = G.player.z + Math.sin(a) * 12;
    const mesh = spawnNPC(G, 'Passenger', x, z, 0xe8b88a, 0xf5c518, 0x2c3242, 0);
    G.taxi = { stage: 'pickup', x, z, mesh };
    G.centerMsg('Penumpang taksi menunggu — jemput dengan mobil!', 3);
  }
  if (G.taxi) {
    const car = driveCarRef(G);
    if (G.taxi.stage === 'pickup' && car && Math.hypot(car.x - G.taxi.x, car.z - G.taxi.z) < 6) {
      G.scene.remove(G.taxi.mesh.g);
      G.taxi.stage = 'deliver';
      G.centerMsg('Penumpang naik — antar ke Plaza Spires!', 3);
    } else if (G.taxi.stage === 'deliver' && car && Math.hypot(car.x - 108, car.z - 108) < 8) {
      G.cash += CFG.taxiFare; G.stats.deliveries++;
      G.centerMsg(`Taksi selesai +$${CFG.taxiFare}`, 3);
      sfx(G, 'coin');
      G.taxi = null;
    }
  }
  // Free race (R in car).
  if (keyPressed(G, 'KeyR') && driveCarRef(G) && !G.race) startRace(G, false);
  if (G.race && !G.race.forMission) updateRace(G, dt);
  // Fishing (F at a fish spot).
  if (keyPressed(G, 'KeyF')) {
    if (!G.fishing) {
      const spot = FISH_SPOTS.find((s) => Math.hypot(G.player.x - s.x, G.player.z - s.z) < 8);
      if (spot) { G.fishing = { needle: 0, dir: 1 }; sfx(G, 'splash'); }
    } else {
      const n = G.fishing.needle;
      if (n >= 0.62 && n <= 0.86) {
        const fish = G.rng.pick(FISH);
        G.cash += CFG.fishPrice; G.stats.fish++;
        G.centerMsg(`Dapat ${fish.name} (${fish.w} kg) +$${CFG.fishPrice}!`, 3);
        sfx(G, 'coin');
      } else G.centerMsg('Ikan lepas…', 2);
      G.fishing = null;
    }
  }
  if (G.fishing) {
    G.fishing.needle += G.fishing.dir * 1.6 * dt;
    if (G.fishing.needle >= 1) { G.fishing.needle = 1; G.fishing.dir = -1; }
    if (G.fishing.needle <= 0) { G.fishing.needle = 0; G.fishing.dir = 1; }
  }
  // Photo (P at a photo spot).
  if (keyPressed(G, 'KeyP')) {
    const spot = PHOTO_SPOTS.find((s) => Math.hypot(G.player.x - s.x, G.player.z - s.z) < 10);
    if (spot && !G.photosDone.includes(spot.name)) {
      G.photosDone.push(spot.name);
      G.cash += 10; G.stats.photos++;
      sfx(G, 'camera');
      if (G.photosDone.length === 6) {
        G.cash += CFG.photoBonus;
        G.centerMsg(`6/6 foto! Bonus +$${CFG.photoBonus}!`, 3.5);
        sfx(G, 'jingle');
      } else G.centerMsg(`Foto ${spot.name} +$10 (${G.photosDone.length}/6)`, 2.5);
    }
  }
  // Courier (K).
  if (keyPressed(G, 'KeyK') && !G.courier) {
    const [x, z] = G.rng.pick(COURIER_SPOTS);
    G.courier = { x, z, t: 90 };
    G.centerMsg(`Paket kilat: antar ke (${x}, ${z}) dalam 90 detik!`, 3);
  }
  if (G.courier) {
    G.courier.t -= dt;
    const car = driveCarRef(G);
    if (car && Math.hypot(car.x - G.courier.x, car.z - G.courier.z) < 8) {
      G.cash += CFG.courierPay;
      G.centerMsg(`Paket sampai +$${CFG.courierPay}!`, 3);
      sfx(G, 'coin');
      G.courier = null;
    } else if (G.courier.t <= 0) {
      G.centerMsg('Paket kilat gagal — waktu habis.', 2.5);
      G.courier = null;
    }
  }
}
