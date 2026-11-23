// 8 story missions + side activities (fishing, photo spots) + the Marco
// NPC. State lives in G.msn — never G.mission (that name once shadowed
// the state object and threw every frame).
import * as THREE from 'three';
import { CFG, MISSIONS } from './config.js';
import { clamp, dist2, pick, angDiff } from './random.js';
import { createCar, isCarObj } from './vehicles.js';
import { showDialog, showObjective } from './hud.js';
import { addWanted, setWanted } from './police.js';
import { spawnGuards } from './combat.js';
import { sfxMission, sfxHorn, sfxSplash, sfxCheer, sfxCoin } from './audio.js';

const PHOTO_SPOTS = [
  { x: -258, z: 20, label: 'Pier sunset' },
  { x: 0, z: 0, label: 'Plaza Spires' },
  { x: 60, z: 280, label: 'Ferris wheel' },
];
const FISH_SPOT = { x: -272, z: 26 };
function marcoMesh() {
  const g = new THREE.Group();
  const blue = new THREE.MeshLambertMaterial({ color: 0x2a5a9a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.36), blue);
  body.position.y = 1.05; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skin);
  head.position.y = 1.68; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.12, 8),
    new THREE.MeshLambertMaterial({ color: 0xffd23a }));
  cap.position.y = 1.88; g.add(cap);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x333333 }));
  legs.position.y = 0.35; g.add(legs);
  return g;
}
export function initMissions(G) {
  G.msn = { idx: 0, step: 0, timer: 0, active: false, stepT: 0, followT: 0, race: null };
  G.fish = { active: false, t: 0 };
  G.stats.photos = 0; G.stats.fish = 0;
  const mesh = marcoMesh();
  mesh.position.set(CFG.marcoPos.x, 0, CFG.marcoPos.z);
  mesh.rotation.y = Math.PI;
  G.fx.scene.add(mesh);
  G.marco = { mesh, x: CFG.marcoPos.x, z: CFG.marcoPos.z };
  // mission beacon: golden column at the current target
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 30, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beacon.position.set(-240, 15, 66);
  G.fx.scene.add(beacon);
  G.beacon = beacon;
}
function curDef(G) { return MISSIONS[G.msn.idx]; }
function curStep(G) { const d = curDef(G); return d ? d.steps[G.msn.step] : null; }
export function startMission(G, idx) {
  if (idx >= MISSIONS.length) { G.msn.active = false; return; }
  const d = MISSIONS[idx];
  G.msn = { idx, step: 0, timer: d.timer || 0, active: true, stepT: 0, followT: 0, race: null };
  showDialog(G, `${d.client}: ${d.brief}`);
  showObjective(G, d.steps[0].label);
  if (G.audio) sfxMission(G.audio);
  enterStep(G);
}
function enterStep(G) {
  const s = curStep(G);
  if (!s) return;
  G.msn.stepT = 0;
  showObjective(G, s.label);
  if (s.type === 'clear') spawnGuards(G, s.x, s.z, s.count || 3);
  if (s.type === 'follow' || s.type === 'chase') spawnCourier(G);
  if (s.type === 'race') startRace(G, s);
  if (s.type === 'escape') setWanted(G, 4);
  if (s.type === 'talk') showDialog(G, 'Marco: Nico! Over here — by the ceviche stand.');
}
function spawnCourier(G) {
  if (G.courier) return;
  const car = createCar(G, 'sedan', -210, 120, Math.PI / 2, 'courier', 0x222831);
  G.courier = { car, state: 'follow' };
}
function startRace(G, s) {
  const rivals = [];
  for (let i = 0; i < 2; i++) {
    const car = createCar(G, 'sport', -120 + i * 6, 4 + i * 4, 0, 'rival',
      i ? 0x2a9a8a : 0xc22030);
    rivals.push({ car, cp: 0 });
  }
  G.msn.race = { cps: s.cps, cp: 0, rivals, won: false };
  if (G.audio) sfxHorn(G.audio);
}
function nextStep(G) {
  const d = curDef(G);
  G.msn.step++;
  if (G.msn.step >= d.steps.length) { completeMission(G); return; }
  enterStep(G);
}
export function completeMission(G) {
  const d = curDef(G);
  G.cash += d.reward;
  G.stats.missionsDone = (G.stats.missionsDone || 0) + 1;
  showDialog(G, `${d.client}: Job done. +$${d.reward}`);
  if (G.audio) sfxCheer(G.audio);
  if (G.msn.idx === 6) G.hudMsg = 'KESTREL unlocked!';
  if (G.msn.idx === 7) {
    showDialog(G, 'Marco: We made it, Nico. The debt is paid — Solara Bay is ours.');
    G.msn.active = false;
    G.objective = 'Golden Hour complete — free roam!';
    if (G.saveGame) G.saveGame();
    return;
  }
  if (G.saveGame) G.saveGame();
  startMission(G, G.msn.idx + 1);
}
export function failMission(G, why) {
  showDialog(G, `Kip: ${why} — retrying ${curDef(G).name}.`);
  startMission(G, G.msn.idx);
}
export function updateMissions(G, dt) {
  const p = G.player;
  // fishing timer
  if (G.fish.active) {
    G.fish.t -= dt;
    if (G.fish.t <= 0) {
      G.fish.active = false;
      if (G.rng() < 0.65) {
        const v = 10 + Math.floor(G.rng() * 31);
        G.cash += v; G.stats.fish++;
        G.hudMsg = `Caught a fish! +$${v}`;
        if (G.audio) sfxCoin(G.audio);
      } else G.hudMsg = 'The fish got away…';
    }
  }
  // beacon follows the current step target
  const s = curStep(G);
  if (s && s.x !== undefined && G.beacon) {
    G.beacon.visible = !G.shotMode || true;
    G.beacon.position.set(s.x, 15, s.z);
    G.beacon.rotation.y += dt;
  } else if (G.beacon) G.beacon.visible = false;
  // near-interact prompt (talk / fish / photo)
  G.nearInteract = null;
  if (G.msn.active && s) {
    if (s.type === 'talk' && dist2(p.x, p.z, G.marco.x, G.marco.z) < 25) {
      G.nearInteract = { kind: 'talk', label: 'Bicara dengan Marco' };
    }
  }
  if (dist2(p.x, p.z, FISH_SPOT.x, FISH_SPOT.z) < 16 && !G.fish.active) {
    G.nearInteract = { kind: 'fish', label: 'Memancing (E)' };
  }
  for (const sp of PHOTO_SPOTS) {
    if (dist2(p.x, p.z, sp.x, sp.z) < 16) {
      G.nearInteract = { kind: 'photo', label: `Foto: ${sp.label} (E)`, spot: sp };
      break;
    }
  }
  if (!G.msn.active || G.phase !== 'play') return;
  // mission timer
  if (G.msn.timer > 0) {
    G.msn.timer -= dt;
    if (G.msn.timer <= 0) {
      if (s && s.type === 'escape') { nextStep(G); return; }
      failMission(G, 'Time ran out');
      return;
    }
  }
  if (!s) return;
  const dPlayer = s.x !== undefined ? Math.sqrt(dist2(p.x, p.z, s.x, s.z)) : 1e9;
  switch (s.type) {
    case 'goto':
      if (dPlayer < 7) nextStep(G);
      break;
    case 'steal':
      if (isCarObj(p.car)) nextStep(G);
      break;
    case 'drive':
      if (dPlayer < 7) nextStep(G);
      break;
    case 'clear':
      if (G.guards.length === 0) nextStep(G);
      break;
    case 'stealTruck':
      if (isCarObj(p.car) && p.car.type === 'truck') {
        addWanted(G, 2);
        nextStep(G);
      }
      break;
    case 'follow': updateCourier(G, dt, 'follow'); break;
    case 'chase': updateCourier(G, dt, 'chase'); break;
    case 'race': updateRace(G, dt, s); break;
    case 'party':
      if (dPlayer < 10) {
        G.msn.stepT += dt;
        if (G.msn.stepT >= (s.dur || 5)) nextStep(G);
      }
      break;
    case 'escape':
      // timer expiry advances (handled above); staying alive is enough
      break;
    case 'boat':
      if (dPlayer < 8) nextStep(G);
      break;
    case 'talk':
      break; // advances via E (onPlayerInteract)
  }
}
function updateCourier(G, dt, mode) {
  const c = G.courier;
  if (!c || !isCarObj(c.car)) return;
  const p = G.player;
  const car = c.car;
  const d = Math.sqrt(dist2(car.x, car.z, p.x, p.z));
  if (mode === 'follow') {
    // cruise slowly along the coast road; spotted if the player gets close
    car.speed = 8;
    car.heading += clamp(angDiff(car.heading, Math.PI / 2), -0.5, 0.5) * dt * 2;
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    G.msn.followT += dt;
    if (d < 12) { showDialog(G, 'Courier: Hey — you\'re following me!'); nextStep(G); }
    else if (G.msn.followT >= 20) nextStep(G);
  } else {
    // chase: courier flees toward the docks; catch him within 8 m
    const tx = 120, tz = -120;
    const desired = Math.atan2(tx - car.x, tz - car.z);
    car.heading += clamp(desired - car.heading, -1.2 * dt, 1.2 * dt);
    car.speed = 26;
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    if (d < 8) {
      showDialog(G, 'Kip: Got him. The drop point is yours.');
      G.fx.scene.remove(car.mesh);
      G.cars.splice(G.cars.indexOf(car), 1);
      G.courier = null;
      nextStep(G);
    }
  }
}
function updateRace(G, dt, s) {
  const race = G.msn.race;
  if (!race) return;
  const p = G.player;
  // player checkpoints
  const cp = race.cps[race.cp];
  if (cp && Math.sqrt(dist2(p.x, p.z, cp[0], cp[1])) < 10) {
    race.cp++;
    G.hudMsg = `Checkpoint ${race.cp}/${race.cps.length}`;
    if (race.cp >= race.cps.length) {
      const rivalBest = Math.max(...race.rivals.map((r) => r.cp));
      if (race.cp > rivalBest || race.rivals.every((r) => r.cp < race.cps.length)) {
        G.cash += 120; G.hudMsg = 'Race won! +$120 bonus';
        if (G.audio) sfxCheer(G.audio);
      }
      cleanupRace(G);
      nextStep(G);
      return;
    }
  }
  // rivals drive the checkpoint loop
  for (const r of race.rivals) {
    if (r.cp >= race.cps.length) continue;
    const t = race.cps[r.cp];
    const car = r.car;
    const desired = Math.atan2(t[0] - car.x, t[1] - car.z);
    car.heading += clamp(desired - car.heading, -1.5 * dt, 1.5 * dt);
    car.speed = 27;
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    if (Math.sqrt(dist2(car.x, car.z, t[0], t[1])) < 10) r.cp++;
  }
}
function cleanupRace(G) {
  const race = G.msn.race;
  if (!race) return;
  for (const r of race.rivals) {
    G.fx.scene.remove(r.car.mesh);
    G.cars.splice(G.cars.indexOf(r.car), 1);
  }
  G.msn.race = null;
}
export function onPlayerInteract(G, kind, target) {
  if (kind === 'enterCar') {
    const s = curStep(G);
    if (s && s.type === 'stealTruck' && target && target.type === 'truck') return false;
    return false;
  }
  if (kind === 'exitCar') return false;
  if (kind !== 'interact') return false;
  const ni = G.nearInteract;
  if (!ni) return false;
  if (ni.kind === 'talk') {
    const s = curStep(G);
    if (s && s.type === 'talk') {
      showDialog(G, 'Marco: The boat sails at golden hour. Lose the cops, get to the pier, and we\'re rich.');
      nextStep(G);
      return true;
    }
  }
  if (ni.kind === 'fish') {
    G.fish = { active: true, t: 6 };
    G.hudMsg = 'Fishing… wait for a bite';
    if (G.audio) sfxSplash(G.audio);
    return true;
  }
  if (ni.kind === 'photo') {
    G.cash += 10; G.stats.photos++;
    G.hudMsg = `Photo snapped! +$10 (${ni.spot.label})`;
    if (G.audio) sfxCoin(G.audio);
    return true;
  }
  return false;
}
export function missionLabel(G) {
  if (!G.msn.active) return 'FREE ROAM';
  const d = curDef(G);
  return `JOB ${G.msn.idx + 1}/8 ${d.name}`;
}
export function missionStage(G) {
  if (!G.msn.active) return '';
  const d = curDef(G);
  return `STAGE ${G.msn.step + 1}/${d.steps.length}`;
}
