// 8 story jobs + side work: taxi, stunts, sun coins, fishing, street race.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { range } from './random.js';

const MISSIONS = [
  { name: 'FIRST GEAR', client: 'Sal Vega', reward: 300, brief: 'Sal Vega: "Welcome home, Nico. Steal a car, bring it to Mara\'s garage — and don\'t get nicked."', steps: [
    { type: 'goto', pos: [0, 60], text: 'Walk to the parked Comet', next: 'Steal the car' },
    { type: 'steal', pos: [0, 60], text: 'Steal the car — press E', next: 'Drive to Mara\'s garage' },
    { type: 'goto', pos: [-60, -30], text: 'Drive to Mara\'s garage', next: 'Job done' } ] },
  { name: 'COURIER RUN', client: 'Kip', reward: 500, timer: 240, brief: 'Kip: "Three drops, four minutes. The packages are fragile — and so is my patience."', steps: [
    { type: 'goto', pos: [120, 0], text: 'Deliver package 1/3 — The Spires', next: 'Package 2/3' },
    { type: 'goto', pos: [-120, 180], text: 'Deliver package 2/3 — Old Solara', next: 'Package 3/3' },
    { type: 'goto', pos: [240, 120], text: 'Deliver package 3/3 — Vista Hills', next: 'Job done' } ] },
  { name: 'THE DOCKS JOB', client: 'Sal Vega', reward: 900, brief: 'Sal Vega: "Dario\'s guards watch his Hauler at the docks. Drop them, take the truck, vanish."', steps: [
    { type: 'goto', pos: [210, 30], text: 'Reach the docks', next: 'Clear the guards' },
    { type: 'clear', pos: [216, 36], count: 4, text: 'Clear the guards 0/4', next: 'Steal the Hauler' },
    { type: 'stealTruck', pos: [222, 36], text: 'Steal the Hauler truck', next: 'Escape to the garage' },
    { type: 'goto', pos: [-60, -30], text: 'Escape to Mara\'s garage — wanted 2', next: 'Job done' } ] },
  { name: 'NEON NIGHTS', client: 'Mara Voss', reward: 1200, night: true, brief: 'Mara Voss: "Dario\'s courier moves at night. Tail him — close enough to see, far enough to stay invisible."', steps: [
    { type: 'tail', pos: [0, -120], text: 'Tail the courier — stay 10–45 m back', next: 'Chase him down' },
    { type: 'chase', pos: [0, -120], text: 'He made you! Chase the courier down', next: 'Job done' } ] },
  { name: 'BAY HEIST', client: 'Sal Vega', reward: 2500, brief: 'Sal Vega: "The show car. Penthouse garage, Spires. Four stars on your tail — bring it to the pier."', steps: [
    { type: 'goto', pos: [60, -180], text: 'Reach the penthouse garage', next: 'Steal the show car' },
    { type: 'steal', pos: [60, -180], text: 'Steal the Veloz Comet RS', next: 'Lose the cops' },
    { type: 'goto', pos: [-288, 150], text: 'Deliver the Comet to the pier — wanted 4', next: 'Job done' } ] },
  { name: 'HARBOR LIGHTS', client: 'Kip', reward: 600, brief: 'Kip: "Harbor job. Three guards, one truck, zero witnesses. You know the drill."', steps: [
    { type: 'goto', pos: [210, 30], text: 'Reach the harbor', next: 'Clear the guards' },
    { type: 'clear', pos: [216, 36], count: 3, text: 'Clear the guards 0/3', next: 'Steal the truck' },
    { type: 'stealTruck', pos: [222, 36], text: 'Steal the truck', next: 'Escape to the garage' },
    { type: 'goto', pos: [-60, -30], text: 'Escape to Mara\'s garage', next: 'Job done' } ] },
  { name: 'MEET MARCO', client: 'Marco', reward: 400, brief: 'Marco: "Marlin Ceviche, Nico. Come hungry — we talk boats, not menus."', steps: [
    { type: 'goto', pos: [-240, 90], text: 'Meet Marco at Marlin Ceviche', next: 'Talk to Marco' },
    { type: 'meet', pos: [-240, 90], text: 'Talk to Marco — press E', next: 'Drive Marco to the pier' },
    { type: 'goto', pos: [-288, 150], text: 'Drive Marco to the pier', next: 'Job done' } ] },
  { name: 'GOLDEN HOUR', client: 'Lupe', reward: 5000, timer: 107, brief: 'Marco: "The boat sails in two minutes, Nico! Shake that chopper and get to the pier!"', steps: [
    { type: 'goto', pos: [-240, 60], text: 'Reach Lupe\'s runner on the Malecón', next: 'Grab the package' },
    { type: 'meet', pos: [-240, 60], text: 'Grab the package — press E', next: 'Get in the Comet' },
    { type: 'steal', pos: [-180, 0], text: 'Get in the Veloz Comet RS', next: 'Lose the manhunt' },
    { type: 'escape', pos: [-240, 120], text: 'Lose the manhunt before Marco\'s boat sails', next: 'Reach the boat at the pier' },
    { type: 'goto', pos: [-300, 150], text: 'Reach the boat at the pier', next: 'Job done' } ] },
];
const FARES = [
  { pick: [-120, 60], drop: [120, -120], pay: 80 },
  { pick: [0, 180], drop: [-240, 0], pay: 90 },
  { pick: [180, 120], drop: [-60, 200], pay: 100 },
];
const STUNTS = [[-120, -60], [60, 120], [180, -180]];

export function createMissions(G) {
  let idx = 0, step = 0, timer = 0, tailT = 0, tailSeen = 0, guardsLeft = 0;
  let targetCar = null, targetRoute = [], routeI = 0, race = null, fareI = 0, fareState = 0, farePed = null;
  let fishing = 0, partyDone = false, stuntsDone = new Set();
  // Marco NPC at Marlin Ceviche + the boat at the pier.
  const marcoMat = new THREE.MeshLambertMaterial({ color: 0xffd24a });
  const marco = new THREE.Group();
  const mb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.34), marcoMat); mb.position.y = 1.1; marco.add(mb);
  const mh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshLambertMaterial({ color: 0x8a5a3a })); mh.position.y = 1.72; marco.add(mh);
  marco.position.set(CONFIG.marlin.x, 0, CONFIG.marlin.z - 3); marco.visible = false; G.scene.add(marco); // 3 m north of the beacon column
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 3.4), new THREE.MeshLambertMaterial({ color: 0xeeeeee })); hull.position.y = 0.6; boat.add(hull);
  const bcab = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 2.6), new THREE.MeshLambertMaterial({ color: 0x2a6f9e })); bcab.position.set(-1, 2.2, 0); boat.add(bcab);
  boat.position.set(-318, 0.4, CONFIG.pier.z); boat.visible = false; G.scene.add(boat);
  function cur() { return MISSIONS[idx]; }
  function stepObj() { return cur().steps[step]; }
  function dialog(who, role, line) { G.hud.showDialog(who, role, line); }
  function startMission(i) {
    idx = i; step = 0; timer = cur().timer || 0; tailT = 0; tailSeen = 0;
    G.combat.clearEnemies();
    if (cur().night) G.timeOfDay = 21;
    if (i === 7) { G.timeOfDay = 18.35; boat.visible = true; }
    if (i === 6) marco.visible = true;
    dialog(cur().client, i === 6 || i === 7 ? 'SMUGGLER · WHEELMAN' : i === 0 ? 'FIXER' : 'CONTACT', cur().brief.replace(/^.*?: "/, '').replace(/"$/, ''));
    G.hud.showObjective(stepObj().text);
    G.hud.showMission();
  }
  function advance() {
    step++;
    if (step >= cur().steps.length) { completeMission(); return; }
    const s = stepObj();
    if (s.type === 'clear') { guardsLeft = s.count; for (let k = 0; k < s.count; k++) G.combat.spawnGuard(s.pos[0] + range(Math.random, -6, 6), s.pos[1] + range(Math.random, -6, 6)); }
    if (s.type === 'tail' || s.type === 'chase') startTailCar();
    if (s.type === 'escape') G.police.addWanted(4);
    G.hud.showObjective(s.text);
    G.hud.showMission();
  }
  function startTailCar() {
    if (targetCar) return;
    targetCar = G.vehicles.spawnCar('sedan', 0, -120, 0);
    targetRoute = [[0, -120], [120, -120], [120, 0], [0, 0], [-120, 0], [-120, -120]];
    routeI = 0;
  }
  function completeMission() {
    const m = cur();
    G.cash += m.reward; G.stats.missionsDone++;
    G.respect += 25; G.audio.jingle();
    G.hud.ticker('Job done: ' + m.name + ' +$' + m.reward);
    if (idx === 6) { G.weapons[4].locked = false; G.weapons[4].owned = true; G.weapons[4].ammo = 40; G.hud.ticker('KESTREL unlocked'); }
    G.save();
    const next = Math.min(idx + 1, MISSIONS.length - 1);
    const done = idx >= MISSIONS.length - 1;
    G.hud.showEnd('JOB DONE', m.name + ' · +$' + m.reward.toLocaleString('en-US'),
      done ? 'All 8 jobs complete. The debt is paid — Solara Bay is yours, Nico.' : 'Next job: ' + MISSIONS[next].name + ' — ' + MISSIONS[next].client,
      done ? 'FREE ROAM' : 'START JOB ' + (next + 1) + '/8', () => {
        G.hud.hideEnd();
        if (done) { G.phase = 'play'; G.freeRoam = true; }
        else { G.phase = 'play'; startMission(next); }
      });
    G.phase = 'missionDone';
    if (targetCar) { G.scene.remove(targetCar.group); G.vehicles.cars.splice(G.vehicles.cars.indexOf(targetCar), 1); targetCar = null; }
  }
  function failMission(text) {
    if (G.phase === 'missionFail' || G.phase === 'missionDone') return;
    G.audio.fail();
    G.police.clearWanted();
    G.hud.showEnd('JOB FAILED', '', text, 'RETRY JOB', () => { G.hud.hideEnd(); G.health = 100; G.phase = 'play'; startMission(idx); });
    G.phase = 'missionFail';
  }
  function onGuardKilled() {
    const s = stepObj();
    if (s && s.type === 'clear') {
      guardsLeft--;
      G.hud.showObjective('Clear the guards ' + (s.count - guardsLeft) + '/' + s.count);
      if (guardsLeft <= 0) advance();
    }
  }
  function near(pos, d) {
    const px = G.car ? G.car.x : G.player.x, pz = G.car ? G.car.z : G.player.z;
    return Math.hypot(px - pos[0], pz - pos[1]) < d;
  }
  return {
    count: MISSIONS.length, startMission, completeMission, failMission, onGuardKilled,
    setStep(n) { step = n; const s = stepObj(); if (s && s.type === 'clear') { guardsLeft = s.count; for (let k = 0; k < s.count; k++) G.combat.spawnGuard(s.pos[0] + range(Math.random, -6, 6), s.pos[1] + range(Math.random, -6, 6)); } if (s) { G.hud.showObjective(s.text); G.hud.showMission(); } },
    setTimer(s) { timer = s; },
    current: () => ({ index: idx, mission: cur(), step, stepObj: stepObj(), timer, guardsLeft }),
    target: () => {
      const s = stepObj();
      if (!s) return null;
      if (s.type === 'tail' || s.type === 'chase') return targetCar ? { x: targetCar.x, z: targetCar.z } : { x: s.pos[0], z: s.pos[1] };
      return { x: s.pos[0], z: s.pos[1] };
    },
    interact() { // E pressed: meet / taxi / fishing
      const s = stepObj();
      if (s && s.type === 'meet' && near(s.pos, 5)) { advance(); return true; }
      if (fareState === 1 && farePed && near([farePed.x, farePed.z], 4)) {
        fareState = 2; G.hud.ticker('Fare aboard — take them to the marker'); return true;
      }
      return false;
    },
    update(dt) {
      if (G.phase !== 'play' || G.freeRoam) return;
      const s = stepObj();
      if (!s) return;
      if (timer > 0) {
        timer -= dt;
        if (timer <= 0) { failMission('Out of time — the boat sailed without you.'); return; }
      }
      if (s.type === 'goto' && near(s.pos, 7)) advance();
      else if ((s.type === 'steal' || s.type === 'stealTruck') && G.car) {
        if (s.type === 'stealTruck') G.police.addWanted(2);
        advance();
      }
      else if (s.type === 'escape') {
        if (!G.police.seen() && near(s.pos, 25)) advance();
        else if (near(s.pos, 25) && !G.police.seen()) advance();
      }
      else if (s.type === 'tail' && targetCar) {
        const d = Math.hypot(G.player.x - targetCar.x, G.player.z - targetCar.z);
        if (d < 8) { tailSeen += dt; if (tailSeen > 3) { failMission('Spotted! The courier burned you.'); return; } }
        else tailSeen = 0;
        if (d > 10 && d < 45) tailT += dt;
        if (tailT > 20) advance();
      } else if (s.type === 'chase' && targetCar) {
        if (Math.hypot(G.player.x - targetCar.x, G.player.z - targetCar.z) < 12) advance();
      }
      // tail target drives its route
      if (targetCar) {
        const wp = targetRoute[routeI];
        const d = Math.hypot(wp[0] - targetCar.x, wp[1] - targetCar.z);
        const fast = stepObj()?.type === 'chase';
        const sp = fast ? 30 : 11;
        if (d < 4) routeI = (routeI + 1) % targetRoute.length;
        targetCar.heading = Math.atan2(wp[0] - targetCar.x, wp[1] - targetCar.z);
        targetCar.x += Math.sin(targetCar.heading) * sp * dt;
        targetCar.z += Math.cos(targetCar.heading) * sp * dt;
        targetCar.group.position.set(targetCar.x, 0, targetCar.z);
        targetCar.group.rotation.y = targetCar.heading;
      }
      // taxi fares
      if (fareState === 0 && fareI < FARES.length) {
        const f = FARES[fareI];
        if (!farePed) {
          farePed = { x: f.pick[0], z: f.pick[1] };
        }
        if (near(f.pick, 80)) G.hud.ticker('Taxi fare waiting at the marker — press E to pick up');
        if (near(f.pick, 5)) fareState = 1;
      } else if (fareState === 2) {
        if (near(FARES[fareI].drop, 7)) {
          G.cash += FARES[fareI].pay; G.respect += 10; G.audio.coin();
          G.hud.ticker('Fare delivered +$' + FARES[fareI].pay);
          fareI++; fareState = 0; farePed = null;
        }
      }
      // stunt jumps: fast through a ramp zone
      STUNTS.forEach((p, i) => {
        if (!stuntsDone.has(i) && G.car && Math.abs(G.car.speed) > 25 && near(p, 6)) {
          stuntsDone.add(i); G.cash += 150; G.audio.coin(); G.hud.ticker('Stunt jump! +$150');
        }
      });
      // fishing at the pier end
      const pierEnd = { x: -318, z: CONFIG.pier.z };
      if (Math.hypot(G.player.x - pierEnd.x, G.player.z - pierEnd.z) < 5 && !G.car) {
        G.hud.prompt('E — Fish (6s)');
        if (G.input.pressed('KeyE')) fishing = 6;
      }
      if (fishing > 0) {
        fishing -= dt;
        G.hud.prompt('Fishing… ' + Math.ceil(fishing) + 's');
        if (fishing <= 0) {
          if (Math.random() < 0.65) { const c = 10 + Math.floor(Math.random() * 31); G.cash += c; G.hud.ticker('Caught a fish! +$' + c); }
          else G.hud.ticker('Nothing bit. Try again.');
        }
      }
      // street race trigger on the Malecón
      if (!race && G.car && Math.abs(G.player.x + 180) < 8 && Math.abs(G.player.z + 60) < 8) {
        race = { t: 0, r1: G.vehicles.spawnCar('sport', -186, -40, Math.PI), r2: G.vehicles.spawnCar('sport', -174, -40, Math.PI) };
        G.audio.horn(); G.hud.ticker('STREET RACE — first to the north end wins $200!');
      }
      if (race) {
        race.t += dt;
        race.r1.z -= 30 * dt; race.r2.z -= 28 * dt;
        race.r1.group.position.set(race.r1.x, 0, race.r1.z); race.r2.group.position.set(race.r2.x, 0, race.r2.z);
        const done = G.player.z < -260 || race.r1.z < -260 || race.r2.z < -260;
        if (done) {
          if (G.player.z < -260 && G.player.z <= race.r1.z) { G.cash += 200; G.hud.ticker('Race won! +$200'); }
          else G.hud.ticker('Race lost — the Comet eats your dust next time.');
          G.scene.remove(race.r1.group); G.scene.remove(race.r2.group);
          G.vehicles.cars.splice(G.vehicles.cars.indexOf(race.r1), 1);
          G.vehicles.cars.splice(G.vehicles.cars.indexOf(race.r2), 1);
          race = null;
        }
      }
      // beach party at night
      if (!partyDone && G.timeOfDay >= 20 && Math.hypot(G.player.x + 250, G.player.z - 240) < 14) {
        partyDone = true; G.respect += 10; G.audio.jingle();
        G.hud.ticker('Beach party! The crew toasts the sunset — respect +10');
      }
      // sun coins
      for (const c of [...G.city.coins]) {
        if (Math.hypot(G.player.x - c.position.x, G.player.z - c.position.z) < 2) {
          G.cash += 50; G.audio.coin(); G.hud.ticker('Sun coin +$50');
          G.scene.remove(c); G.city.coins.splice(G.city.coins.indexOf(c), 1);
        }
      }
    },
  };
}
