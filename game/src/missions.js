// 8 story missions + side activities (taxi, race, fishing, photo, sun coins).
import * as THREE from 'three';
import { G, CFG, clamp, dist2, fmtTime } from './config.js';
import { setWanted, spawnFootCop, spawnPoliceCar, nextCallsign } from './police.js';
import { spawnGuards, clearGuards } from './combat.js';
import { makeCar, isCarObj } from './vehicles.js';
import { addBurst } from './render.js';

export const MISSIONS = [
  { n: 1, name: 'FIRST GEAR', client: 'Sal Vega', role: 'FIXER',
    brief: "Sal Vega: Nico. You're back. Steal the pink Veloz and bring it to Mara's garage. Don't get cute.",
    steps: ['Steal the Veloz Comet RS', "Drive it to Mara's garage"],
    reward: 250, timer: 0 },
  { n: 2, name: 'MEET MARCO', client: 'Marco', role: 'WHEELMAN',
    brief: 'Marco: Meet me at Marlin Ceviche, on the Malecón. I got a job that pays real money.',
    steps: ['Go to Marlin Ceviche', 'Talk to Marco'],
    reward: 150, timer: 0 },
  { n: 3, name: 'COURIER RUN', client: 'Kip', role: 'HACKER',
    brief: 'Kip: Three drops, four minutes. Traffic is thick — use the ring roads. Go!',
    steps: ['Drop 1: Plaza Spires', 'Drop 2: The Docks', 'Drop 3: Vista Hills'],
    reward: 400, timer: 240 },
  { n: 4, name: 'DOCKS JOB', client: 'Sal Vega', role: 'FIXER',
    brief: 'Sal Vega: Dario has a Hauler at the docks. Take it. His guards shoot first — so do you.',
    steps: ['Reach the docks', 'Deal with 4 guards', 'Steal the Hauler', 'Lose the heat'],
    reward: 600, timer: 0 },
  { n: 5, name: 'NEON NIGHTS', client: 'Kip', role: 'HACKER',
    brief: "Kip: Dario's courier runs at night. Tail him — don't get spotted — then take the package.",
    steps: ['Tail the courier', 'Take the package', 'Escape'],
    reward: 500, timer: 0 },
  { n: 6, name: 'STREET RACE', client: 'Marco', role: 'WHEELMAN',
    brief: 'Marco: Midnight race, three checkpoints, winner takes $120. My money is on you, Nico.',
    steps: ['Reach the start line', 'Beat the rival through 3 checkpoints'],
    reward: 120, timer: 180 },
  { n: 7, name: 'BEACH PARTY', client: 'Lupe', role: 'CLIENT',
    brief: 'Lupe: The party is on the beach. Come dance, grab the sun coins, and meet me after.',
    steps: ['Reach the beach party', 'Collect 5 sun coins', 'Talk to Lupe'],
    reward: 300, timer: 0 },
  { n: 8, name: 'GOLDEN HOUR', client: 'Lupe', role: 'CLIENT',
    brief: "Marco: The boat sails in two minutes, Nico! Shake that chopper and get to the pier!",
    steps: ['Lose the manhunt', 'Reach the boat at the pier', 'Escape with Lupe'],
    reward: 1500, timer: 107 },
];
const CP = {
  courier: [[60, 60], [240, 180], [0, -240]],
  race: [[120, 240], [240, 0], [0, -240]],
  taxiDests: [[60, 60], [120, 120], [-180, -180], [240, -120], [-60, 180]],
};
export function missionInfo() {
  const m = MISSIONS[G.msn.idx];
  return {
    chapter: 'CH ' + m.n + ' · ' + m.name,
    name: m.name, timer: G.msn.timer > 0 ? fmtTime(G.msn.timer) : '',
    objective: G.msn.objective || m.steps[0],
    stage: 'STAGE ' + (G.msn.stage + 1) + '/' + m.steps.length,
    next: G.msn.next || ('NEXT: ' + (m.steps[G.msn.stage + 1] || 'Finish the job')),
    client: m.client, role: m.role,
  };
}
let marco = null, lupe = null, courierCar = null, rivalCar = null, beacon = null;
export function startMission(idx) {
  const m = MISSIONS[idx];
  G.msn = { idx, stage: 0, timer: m.timer || 0, objective: m.steps[0], next: 'NEXT: ' + (m.steps[1] || 'Finish'), active: true };
  clearGuards();
  if (courierCar) { G.scene.remove(courierCar.group); courierCar = null; }
  if (rivalCar) { G.scene.remove(rivalCar.group); rivalCar = null; }
  if (idx === 3) spawnGuards(CFG.docksPos[0], CFG.docksPos[1], 4);
  if (idx === 4) { G.timeOfDay = 21.5; courierCar = makeCar('sedan', -60, 120, 0, 0x222222); courierCar.driver = 'traffic'; G.traffic.push(courierCar); }
  if (idx === 5) { rivalCar = makeCar('sport', 4, 236, Math.PI, 0xffc61a); rivalCar.driver = 'rival'; G.cars.push(rivalCar); }
  if (idx === 7) setWanted(4);
  if (window.__hud) window.__hud.showDialog(m.client, m.role, m.brief, 6000);
  placeBeacon();
  if (window.__hud) window.__hud.setObjective(m.steps[0]);
}
function placeBeacon() {
  if (!beacon) {
    beacon = new THREE.Group();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    cyl.position.y = 30; beacon.add(cyl);
    G.scene.add(beacon);
  }
  beacon.visible = true;
}
function beaconAt(x, z) { if (beacon) beacon.position.set(x, 0, z); }
export function hideBeacon() { if (beacon) beacon.visible = false; }
function targetOf() {
  const p = G.player;
  switch (G.msn.idx) {
    case 0: return G.msn.stage === 0 ? CFG.velozPos : CFG.garagePos;
    case 1: return CFG.meetPos;
    case 2: return CP.courier[G.msn.stage] || CFG.garagePos;
    case 3: return G.msn.stage === 0 ? CFG.docksPos : (G.msn.stage === 2 ? CFG.velozPos : CFG.garagePos);
    case 4: return courierCar ? [courierCar.x, courierCar.z] : [0, 0];
    case 5: return G.msn.stage === 0 ? CFG.raceStart : CP.race[G.msn.stage - 1];
    case 6: return CFG.beachPos;
    case 7: return G.msn.stage < 2 ? [p.x, p.z] : CFG.boatPos;
    default: return [0, 0];
  }
}
export function completeMission() {
  const m = MISSIONS[G.msn.idx];
  G.cash += m.reward;
  G.stats.missionsDone++;
  if (window.__hud) {
    window.__hud.toast('MISSION COMPLETE — ' + m.name + '  +$' + m.reward);
    window.__hud.showDialog(m.client, m.role, 'Clean work, Nico. Next job is on the board.', 4000);
  }
  if (window.__audio) window.__audio.jingle();
  saveGame();
  if (G.msn.idx + 1 < MISSIONS.length) startMission(G.msn.idx + 1);
  else {
    G.msn.active = false;
    if (window.__hud) window.__hud.toast('ALL JOBS DONE — Solara Bay is yours, Nico.');
  }
}
export function failMission(why) {
  if (window.__hud) window.__hud.toast('MISSION FAILED — ' + why + '  (retrying)');
  if (window.__audio) window.__audio.fail();
  startMission(G.msn.idx);
}
export function updateMissions(dt) {
  if (!G.msn.active || G.phase !== 'play') return;
  const p = G.player;
  if (!p) return;
  if (G.msn.timer > 0) {
    G.msn.timer -= dt;
    if (G.msn.timer <= 0) { failMission('Out of time'); return; }
  }
  const t = targetOf();
  beaconAt(t[0], t[1]);
  const d = dist2(p.x, p.z, t[0], t[1]);
  // Hide the beacon when the player is already at the target, so it never
  // covers the NPC / car the shot is staging (street, road-zoom).
  if (beacon) beacon.visible = d > 15 && !G.beaconOff;
  const m = MISSIONS[G.msn.idx];
  const adv = (nextObj) => {
    G.msn.stage++;
    if (G.msn.stage >= m.steps.length) { completeMission(); return; }
    G.msn.objective = nextObj || m.steps[G.msn.stage];
    G.msn.next = 'NEXT: ' + (m.steps[G.msn.stage + 1] || 'Finish the job');
    if (window.__hud) window.__hud.setObjective(G.msn.objective);
  };
  switch (G.msn.idx) {
    case 0:
      if (G.msn.stage === 0 && p.car && isCarObj(p.car)) adv();
      else if (G.msn.stage === 1 && d < 10) completeMission();
      break;
    case 1: {
      // Marco stands at the meet point; talking advances.
      if (marco && dist2(p.x, p.z, marco.x, marco.z) < 3.5) {
        G.nearNpc = { onTalk: () => {
          if (window.__hud) window.__hud.showDialog('Marco', 'WHEELMAN', "There you are. The boat job is tonight — Lupe is counting on us. Don't keep her waiting.", 5000);
          adv();
        } };
        if (window.__hud) window.__hud.setPrompt('E — Bicara dengan Marco');
      } else G.nearNpc = null;
      if (G.msn.stage === 1) completeMission();
      break;
    }
    case 2:
      if (d < 10) {
        if (G.msn.stage === 2) completeMission();
        else adv();
      }
      break;
    case 3: {
      const alive = G.guards.filter((gd) => gd.alive).length;
      if (G.msn.stage === 0 && d < 16) adv();
      else if (G.msn.stage === 1 && alive === 0) { setWanted(2); adv(); }
      else if (G.msn.stage === 2 && p.car && p.car.type === 'truck') adv();
      else if (G.msn.stage === 3 && G.wanted === 0 && d < 10) completeMission();
      break;
    }
    case 4: {
      if (!courierCar) break;
      if (G.msn.stage === 0 && d < 18) adv();
      else if (G.msn.stage === 0 && d < 8) { failMission('Spotted'); }
      else if (G.msn.stage === 1) {
        if (d < 4) { G.cash += 200; completeMission(); }
        else if (d > 40) failMission('Lost the courier');
      }
      break;
    }
    case 5: {
      if (G.msn.stage === 0 && d < 8) { adv(); if (rivalCar) rivalCar.racing = true; }
      else if (G.msn.stage >= 1) {
        if (d < 10) {
          if (G.msn.stage === 3) {
            G.stats.raceWins++;
            completeMission();
          } else adv();
        }
        if (rivalCar && rivalCar.racing) {
          const rt = CP.race[Math.min(G.msn.stage - 1, 2)];
          const rdx = rt[0] - rivalCar.x, rdz = rt[1] - rivalCar.z;
          rivalCar.heading = Math.atan2(rdx, rdz);
          rivalCar.speed = 26;
          rivalCar.x += Math.sin(rivalCar.heading) * rivalCar.speed * dt;
          rivalCar.z += Math.cos(rivalCar.heading) * rivalCar.speed * dt;
          rivalCar.group.position.set(rivalCar.x, 0, rivalCar.z);
          rivalCar.group.rotation.y = rivalCar.heading;
        }
      }
      break;
    }
    case 6: {
      if (G.msn.stage === 0 && d < 10) adv();
      else if (G.msn.stage === 1 && G.stats.coins >= 5) adv();
      else if (G.msn.stage === 2 && lupe && dist2(p.x, p.z, lupe.x, lupe.z) < 3.5) {
        G.nearNpc = { onTalk: () => completeMission() };
        if (window.__hud) window.__hud.setPrompt('E — Bicara dengan Lupe');
      } else if (G.msn.stage !== 2) G.nearNpc = null;
      break;
    }
    case 7: {
      if (G.msn.stage === 0 && G.wanted === 0) adv();
      else if (G.msn.stage === 1 && d < 10) adv();
      else if (G.msn.stage === 2 && d < 8) completeMission();
      break;
    }
  }
  updateActivities(dt);
}
// ---- NPCs: Marco at the meet point, Lupe at the beach ----
export function spawnStoryNpcs() {
  const mk = (color, x, z) => {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc08a5a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirt);
    body.position.y = 1.05; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), skin);
    head.position.y = 1.62; g.add(head);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), new THREE.MeshLambertMaterial({ color: 0x2a2d38 }));
    leg.position.set(-0.14, 0.31, 0); g.add(leg);
    const leg2 = leg.clone(); leg2.position.x = 0.14; g.add(leg2);
    g.position.set(x, 0, z);
    G.scene.add(g);
    return { group: g, x, z };
  };
  marco = mk(0xffd23e, CFG.marcoPos[0], CFG.marcoPos[1]);
  lupe = mk(0xff5ea8, CFG.beachPos[0] + 4, CFG.beachPos[1] + 4);
}
// ---- Side activities ----
export function updateActivities(dt) {
  const p = G.player;
  if (!p) return;
  // Sun coins.
  for (const c of G.coins) {
    if (!c.taken && dist2(p.x, p.z, c.x, c.z) < 2) {
      c.taken = true; c.mesh.visible = false;
      G.stats.coins++; G.cash += 5;
      if (window.__audio) window.__audio.coin();
    }
  }
  // Taxi: press T near a waiting passenger (auto-spawn at the meet corner).
  if (!G.act.taxi && window.__input && window.__input.wasPressed && false) { /* reserved */ }
  // Fishing at the pier: stand at the pier end, hold F.
  if (dist2(p.x, p.z, -308, 60) < 6 && !p.car) {
    G.act.fishing += dt;
    if (G.act.fishing > 3) {
      G.act.fishing = 0; G.stats.fish++; G.cash += 15;
      if (window.__hud) window.__hud.toast('FISHING — caught one! +$15');
    }
    if (window.__hud) window.__hud.setPrompt('Fishing… stay still');
  } else G.act.fishing = 0;
  // Photo spots: press P near a spot.
  G.act.photoCd = Math.max(0, G.act.photoCd - dt);
  if (window.__input && window.__input.wasPressed && window.__input.wasPressed('KeyP') && G.act.photoCd <= 0) {
    for (const [sx, sz] of CFG.photoSpots) {
      if (dist2(p.x, p.z, sx, sz) < 12) {
        G.act.photoCd = 2; G.stats.photos++; G.cash += 10;
        if (window.__hud) window.__hud.toast('PHOTO — nice shot! +$10');
        break;
      }
    }
  }
  // Taxi fares: a passenger waits at the plaza; drive them to the dest.
  const taxi = G.act.taxi;
  if (!taxi) {
    if (p.car && dist2(p.x, p.z, 0, 0) < 12) {
      const dest = CP.taxiDests[Math.floor(Math.random() * CP.taxiDests.length)];
      G.act.taxi = { dest, picked: true, fare: 40 };
      if (window.__hud) window.__hud.toast('TAXI — passenger aboard, drive to the marker (+$40)');
    }
  } else if (dist2(p.x, p.z, taxi.dest[0], taxi.dest[1]) < 10) {
    G.cash += taxi.fare; G.stats.taxiDone++;
    if (window.__hud) window.__hud.toast('TAXI — fare complete! +$' + taxi.fare);
    G.act.taxi = null;
  }
}
// ---- Save / load ----
export function saveGame() {
  try {
    localStorage.setItem('solarabay-save', JSON.stringify({
      cash: G.cash, msnIdx: G.msn.idx, stats: G.stats, day: G.day,
    }));
  } catch { /* private mode */ }
}
export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem('solarabay-save') || 'null');
    if (!s) return null;
    return s;
  } catch { return null; }
}
export function applySave(s) {
  G.cash = s.cash || 10350;
  G.stats = { ...G.stats, ...(s.stats || {}) };
  G.stats.missionsDone = Math.min(8, (s.msnIdx || 0));
  G.day = s.day || 1;
  startMission(clamp(s.msnIdx || 0, 0, 7));
}
