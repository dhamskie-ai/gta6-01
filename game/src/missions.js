// 8 misi cerita + aktivitas sampingan: balap jalanan, pesta pantai,
// mancing, taksi, sun coin, garasi.
import { MISSIONS, CONFIG } from './config.js';
import { clamp, dist2, fmtTimer } from './random.js';
import { spawnCar } from './vehicles.js';
import { spawnGuard } from './combat.js';
import { addWanted } from './police.js';

const STEPS = [
  [
    { type: 'goto', label: 'Walk to the parked Cometa', x: -125, z: 12, r: 7 },
    { type: 'steal', label: 'Press E to steal the car', x: -125, z: 12, r: 5 },
    { type: 'drive', label: 'Drive to Marco\u2019s garage', x: 0, z: 120, r: 8 },
  ],
  [
    { type: 'drive', label: 'Deliver package 1/3 — The Spires', x: 120, z: 120, r: 8 },
    { type: 'drive', label: 'Deliver package 2/3 — Marina Bay', x: 0, z: 240, r: 8 },
    { type: 'drive', label: 'Deliver package 3/3 — Vista Hills', x: -120, z: -240, r: 8 },
  ],
  [
    { type: 'drive', label: 'Steal the Hauler at the docks', x: 235, z: -180, r: 8 },
    { type: 'shoot', label: 'Deal with the 4 guards', kills: 4 },
    { type: 'drive', label: 'Escape to the garage — wanted 2', x: 0, z: 120, r: 8 },
  ],
  [
    { type: 'tail', label: 'Tail the courier — stay 12–45 m', dur: 30 },
    { type: 'chase', label: 'He is running! Stay within 40 m', dur: 20 },
    { type: 'drive', label: 'Lose the heat — reach Old Solara', x: -120, z: 60, r: 10 },
  ],
  [
    { type: 'drive', label: 'Reach the race start on the Malecón', x: -240, z: 180, r: 8 },
    { type: 'raceRun', label: 'Beat the rivals to the finish line' },
  ],
  [
    { type: 'drive', label: 'Pick up the crate at the docks', x: 240, z: -120, r: 8 },
    { type: 'drive', label: 'Drive to the pier parking', x: -252, z: 90, r: 8 },
    { type: 'goto', label: 'Walk to the end of the pier', x: -297, z: 90, r: 5 },
    { type: 'interact', label: 'Press E — hand over the crate', x: -297, z: 90, r: 5 },
  ],
  [
    { type: 'goto', label: 'Meet Marco at Marlin Ceviche', x: -240, z: 90, r: 7 },
    { type: 'interact', label: 'Press E — talk to Marco', x: -240, z: 87, r: 5 },
    { type: 'drive', label: 'Drive Marco to the beach party', x: -268, z: 150, r: 8 },
  ],
  [
    { type: 'steal', label: 'Get in the Veloz Comet RS', x: -235, z: 120, r: 5 },
    { type: 'drive', label: 'Pick up Lupe\u2019s package', x: -120, z: 60, r: 8 },
    { type: 'drive', label: 'Reach the Malecón checkpoint', x: -240, z: 0, r: 8 },
    { type: 'escape', label: 'Lose the manhunt before Marco\u2019s boat sails', dur: 20 },
    { type: 'drive', label: 'Reach the boat at the pier', x: -297, z: 90, r: 8 },
  ],
];

const TIMERS = { 1: 240, 7: 107 };
const RACE_NAMES = ['VEX', 'ROOK'];

export function startMission(G, i) {
  const def = MISSIONS[i];
  const steps = STEPS[i];
  G.mission = {
    index: i, def, steps, step: 0, timer: TIMERS[i] || 0,
    kills: 0, progress: 0, courier: null, race: null, started: true,
    onKill: () => { if (G.mission) G.mission.kills++; },
  };
  G.missionIndex = i;
  G.beacon = { x: steps[0].x || 0, z: steps[0].z || 0, visible: true };
  G.hud.showDialog(def.client, def.brief);
  G.hud.showObjective(steps[0].label);
  G.audio.jingle();
  if (i === 2) {
    // truk Hauler + 4 penjaga di docks
    const truck = spawnCar(G, G.THREE, G.city, 'truck', 234.6, -180, 0, { parked: true, driver: false });
    G.parkedCars.push(truck);
    G.missionTruck = truck;
    for (let k = 0; k < 4; k++) {
      spawnGuard(G, G.THREE, 228 + k * 6, -168 + (k % 2) * 10);
    }
  }
  if (i === 3) {
    G.timeOfDay = 21.2;
    const courier = spawnCar(G, G.THREE, G.city, 'sedan', 60, 0, 0, { ai: { courier: true } });
    courier.ai = { axis: 'x', road: 0, dir: 1, speed: 12, cruise: 12 };
    G.trafficCars.push(courier);
    G.mission.courier = courier;
  }
  if (i === 7) {
    const rs = spawnCar(G, G.THREE, G.city, 'sport', -234.6, 120, 0, { parked: true, driver: false });
    G.parkedCars.push(rs);
    G.missionSport = rs;
    addWanted(G, 0);
  }
  placeMarco(G, i);
}

export function placeMarco(G, missionIndex) {
  if (!G.marco) return;
  if (missionIndex === 6 || missionIndex === 0) {
    // Marco menunggu di Marlin Ceviche, 3 m di utara kolom beacon (-240,90)
    G.marco.mesh.visible = true;
    G.marco.x = -240; G.marco.z = 87;
    G.marco.mesh.position.set(-240, 0, 87);
  } else if (missionIndex === 7) {
    G.marco.mesh.visible = false;
  } else {
    G.marco.mesh.visible = true;
    G.marco.x = 0; G.marco.z = 116;
    G.marco.mesh.position.set(0, 0, 116);
  }
}

function advanceStep(G) {
  const m = G.mission;
  m.step++;
  m.progress = 0;
  if (m.step >= m.steps.length) { completeMission(G); return; }
  const s = m.steps[m.step];
  G.hud.showObjective(s.label);
  G.audio.jingle();
  if (s.x !== undefined) G.beacon = { x: s.x, z: s.z, visible: true };
  else if (m.courier) G.beacon = { x: m.courier.x, z: m.courier.z, visible: true };
  else G.beacon.visible = false;
  if (m.index === 2 && m.step === 1) addWanted(G, 2);
  if (m.index === 2 && m.step === 2) G.hud.ticker('Guards down — run!');
  if (m.index === 7 && m.step === 3) { addWanted(G, 4); G.hud.ticker('MANHUNT — 4 stars! Lose them!'); }
  if (m.index === 4 && m.step === 1) startRace(G, true);
}

export function completeMission(G) {
  const m = G.mission;
  G.cash += m.def.reward;
  G.stats.missionsDone = (G.stats.missionsDone || 0) + 1;
  G.missionsDone = G.stats.missionsDone;
  G.respectPoints = Math.min(550, (G.respectPoints || 0) + 50);
  G.audio.jingle();
  G.hud.showBanner('MISSION COMPLETE — ' + m.def.name + '  +$' + m.def.reward.toLocaleString('en-US'));
  G.hud.showDialog(m.def.client, 'Good work, Nico. Next one is waiting.');
  if (m.index === 6) {
    G.weapons[5].locked = false; G.weapons[5].owned = true;
    G.hud.ticker('KESTREL unlocked!');
  }
  saveGame(G);
  G.mission = null; G.beacon.visible = false;
  if (m.index >= MISSIONS.length - 1) {
    G.phase = 'won';
    G.hud.showEnd('DEBT PAID', 'Lupe\u2019s last job is done. The boat sails, the manhunt fades — Nico owns the night. SOLARA BAY is yours.');
    return;
  }
  G.nextMissionIn = 3;
}

export function failMission(G, reason) {
  const m = G.mission;
  G.audio.fail();
  G.hud.showEnd('MISSION FAILED', reason + ' — press retry to run it back.');
  G.phase = 'failed';
  G.failReason = reason;
  G.failedMission = m ? m.index : 0;
}

export function retryMission(G) {
  const i = G.failedMission || 0;
  G.health = 100; G.armor = 0; G.wanted = 0; G.phase = 'play';
  G.hud.hideEnd();
  startMission(G, i);
}

export function updateMissions(G, dt, input) {
  if (G.shotMode) return; // staging shot: misi tidak boleh gagal / jalan
  if (G.nextMissionIn !== undefined && G.nextMissionIn > 0) {
    G.nextMissionIn -= dt;
    if (G.nextMissionIn <= 0) {
      G.nextMissionIn = undefined;
      startMission(G, (G.missionIndex || 0) + 1);
    }
    return;
  }
  const m = G.mission;
  if (!m) return;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) { failMission(G, 'Time ran out'); return; }
  }
  const s = m.steps[m.step];
  if (!s) return;
  const px = G.player.x, pz = G.player.z;
  const inCar = G.player.inCar;
  const d2 = (x, z) => dist2(px, pz, x, z);
  switch (s.type) {
    case 'goto':
      if (d2(s.x, s.z) < s.r * s.r) advanceStep(G);
      break;
    case 'drive':
      if (inCar && d2(s.x, s.z) < s.r * s.r) advanceStep(G);
      break;
    case 'steal':
      if (inCar && d2(s.x, s.z) < 12 * 12) advanceStep(G);
      break;
    case 'interact':
      G.prompt = 'E — ' + (m.index === 6 ? 'Talk to Marco' : 'Hand over the crate');
      if (d2(s.x, s.z) < s.r * s.r && input.keys.has('KeyE')) advanceStep(G);
      break;
    case 'shoot':
      if (m.kills >= s.kills) advanceStep(G);
      break;
    case 'tail': {
      const c = m.courier;
      if (!c || c.dead) { failMission(G, 'Target lost'); return; }
      const d = Math.sqrt(d2(c.x, c.z));
      G.beacon = { x: c.x, z: c.z, visible: true };
      if (d >= 12 && d <= 45) m.progress += dt;
      else if (d < 8) { m.progress = Math.max(0, m.progress - dt * 2); G.hud.ticker('Too close — back off!'); }
      if (d > 70) { failMission(G, 'Target lost'); return; }
      if (m.progress >= s.dur) advanceStep(G);
      break;
    }
    case 'chase': {
      const c = m.courier;
      if (!c || c.dead) { failMission(G, 'Target lost'); return; }
      c.ai.cruise = 30; c.ai.speed = 30;
      const d = Math.sqrt(d2(c.x, c.z));
      G.beacon = { x: c.x, z: c.z, visible: true };
      if (d <= 40) m.progress += dt;
      if (d > 90) { failMission(G, 'Target got away'); return; }
      if (m.progress >= s.dur) advanceStep(G);
      break;
    }
    case 'raceRun':
      if (G.race && G.race.done) {
        if (G.race.won) advanceStep(G);
        else failMission(G, 'VEX took the boulevard');
      }
      break;
    case 'escape': {
      // bertahan 20 dtk dgn wanted 4 sambil bergerak / putus line of sight
      const near = G.policeUnits.some((u) => u.dist < 25);
      if (!near) m.progress += dt;
      else m.progress = Math.max(0, m.progress - dt * 0.5);
      if (m.progress >= s.dur) advanceStep(G);
      break;
    }
  }
  // kurir misi 4 berjalan di jalan
  if (m.courier && !m.courier.dead && s.type !== 'chase') {
    const c = m.courier;
    const nx = c.x + (c.ai.axis === 'x' ? c.ai.dir * c.ai.speed * dt : 0);
    const nz = c.z + (c.ai.axis === 'z' ? c.ai.dir * c.ai.speed * dt : 0);
    if (Math.abs(nx) > 285 || Math.abs(nz) > 285) {
      c.ai.axis = c.ai.axis === 'x' ? 'z' : 'x';
      c.ai.dir = Math.random() < 0.5 ? 1 : -1;
    } else { c.x = nx; c.z = nz; }
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.ai.axis === 'x' ? (c.ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.ai.dir > 0 ? 0 : Math.PI);
  }
}

// ---------- Balap jalanan ----------
export function startRace(G, isMission) {
  const route = G.city.raceRoute;
  const rivals = [];
  RACE_NAMES.forEach((name, i) => {
    const car = spawnCar(G, G.THREE, G.city, 'sport', -240 + (i === 0 ? -4 : 4), 176, 0, { ai: { rival: true } });
    car.ai = { wp: 1, speed: 0 };
    rivals.push({ car, name, wp: 1, finished: false, time: 0 });
    G.trafficCars.push(car);
  });
  G.race = {
    active: true, mission: !!isMission, route, rivals,
    startT: G.time, playerWp: 0, done: false, won: false, tickerT: 0,
  };
  G.audio.raceHorn();
  G.hud.ticker('STREET RACE — first to the finish line wins $2,000!');
  G.hud.showDialog('Marco', 'Green light, Nico! Own the Malecón!');
}

export function updateRace(G, dt) {
  const r = G.race;
  if (!r || !r.active) return;
  const route = r.route;
  const playerCar = G.playerCar;
  // progres pemain: waypoint terdekat yang dilewati
  if (playerCar) {
    const wp = route[r.playerWp + 1] || route[route.length - 1];
    if (wp && dist2(playerCar.x, playerCar.z, wp[0], wp[1]) < 15 * 15) {
      r.playerWp++;
      if (r.playerWp >= route.length - 1) {
        r.done = true; r.won = !r.rivals.some((rv) => rv.finished);
        r.active = false;
        finishRace(G, r.won);
        return;
      }
    }
  }
  for (const rv of r.rivals) {
    if (rv.finished) continue;
    const wp = route[rv.wp];
    const dx = wp[0] - rv.car.x, dz = wp[1] - rv.car.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    const wantYaw = Math.atan2(dx, dz);
    let dy = wantYaw - rv.car.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    rv.car.yaw += clamp(dy, -1.8 * dt, 1.8 * dt);
    const playerAhead = r.playerWp > rv.wp;
    const speed = playerAhead ? 28 : 24;
    rv.car.speed += clamp(speed - rv.car.speed, -10 * dt, 8 * dt);
    rv.car.x += Math.sin(rv.car.yaw) * rv.car.speed * dt;
    rv.car.z += Math.cos(rv.car.yaw) * rv.car.speed * dt;
    rv.car.mesh.position.set(rv.car.x, 0, rv.car.z);
    rv.car.mesh.rotation.y = rv.car.yaw;
    if (d < 14) {
      rv.wp++;
      if (rv.wp >= route.length) {
        rv.finished = true; rv.time = G.time - r.startT;
        if (!r.done) {
          r.done = true; r.won = false; r.active = false;
          finishRace(G, false);
          return;
        }
      }
    }
  }
  r.tickerT -= dt;
  if (r.tickerT <= 0) {
    r.tickerT = 2;
    const order = [{ name: 'NICO', wp: r.playerWp }, ...r.rivals.map((rv) => ({ name: rv.name, wp: rv.wp }))];
    order.sort((a, b) => b.wp - a.wp);
    G.hud.ticker('RACE — ' + order.map((o, i) => 'P' + (i + 1) + ' ' + o.name).join(' · '));
  }
  if (G.time - r.startT > CONFIG.raceDuration + 15) {
    r.done = true; r.won = false; r.active = false;
    finishRace(G, false);
  }
}

function finishRace(G, won) {
  if (won) {
    G.cash += CONFIG.racePrize;
    G.audio.jingle();
    G.hud.ticker('RACE WON — +$' + CONFIG.racePrize.toLocaleString('en-US'));
    G.hud.showBanner('STREET RACE WON  +$' + CONFIG.racePrize.toLocaleString('en-US'));
  } else {
    G.audio.fail();
    G.hud.ticker('Race lost — the boulevard belongs to VEX tonight.');
  }
}

// ---------- Aktivitas sampingan ----------
export function initSideActivities(G) {
  G.fares = [
    { x: -60, z: 120, dx: 120, dz: -120, price: 180, taken: false, active: false },
    { x: 60, z: -60, dx: -240, dz: 240, price: 240, taken: false, active: false },
    { x: 120, z: 60, dx: -120, dz: -120, price: 200, taken: false, active: false },
  ];
  G.fishing = { active: false, t: 0 };
  G.sunCoinsGot = 0;
}

export function updateSideActivities(G, dt, input) {
  // sun coins
  for (const c of G.city.sunCoins) {
    if (c.taken) continue;
    if (dist2(c.x, c.z, G.player.x, G.player.z) < 2.4 * 2.4) {
      c.taken = true; c.mesh.visible = false;
      G.sunCoinsGot++;
      G.cash += 25;
      G.hud.ticker('Sun coin +$25  (' + G.sunCoinsGot + '/' + G.city.sunCoins.length + ')');
      G.audio.click();
    }
  }
  // taksi
  for (const f of G.fares) {
    if (f.taken) continue;
    if (!f.active) {
      if (G.player.inCar && dist2(f.x, f.z, G.player.x, G.player.z) < 6 * 6) {
        G.prompt = 'E — Pick up fare ($' + f.price + ')';
        if (input.keys.has('KeyE')) {
          f.active = true;
          G.beacon = { x: f.dx, z: f.dz, visible: true };
          G.hud.ticker('Fare picked up — take them to the marker.');
          G.audio.horn();
        }
      }
    } else if (G.player.inCar && dist2(f.dx, f.dz, G.player.x, G.player.z) < 8 * 8) {
      f.taken = true; f.active = false;
      G.cash += f.price;
      G.hud.ticker('Fare complete +$' + f.price);
      G.audio.jingle();
      if (G.mission) G.beacon = { x: G.mission.steps[G.mission.step].x || 0, z: G.mission.steps[G.mission.step].z || 0, visible: true };
      else G.beacon.visible = false;
    }
  }
  // balap bebas di start line
  if (!G.race && !G.mission && G.player.inCar && dist2(-240, 180, G.player.x, G.player.z) < 8 * 8) {
    G.prompt = 'E — Street Race ($2,000 prize)';
    if (input.keys.has('KeyE')) startRace(G, false);
  }
  // pesta pantai: toast di api unggun (malam)
  const night = G.timeOfDay > 19 || G.timeOfDay < 6;
  if (night && !G.player.inCar && dist2(G.city.partySpot.x, G.city.partySpot.z, G.player.x, G.player.z) < 6 * 6) {
    G.prompt = 'E — Toast with the beach crew';
    if (input.keys.has('KeyE') && !G._toastCd) {
      G._toastCd = 5;
      G.audio.cheer();
      G.respectPoints = Math.min(550, (G.respectPoints || 0) + 10);
      G.hud.ticker('You toast with the beach crew — the bonfire crackles. +10 respect');
    }
  }
  if (G._toastCd) G._toastCd -= dt;
  // mancing di ujung dermaga
  const fs = G.city.fishSpot;
  if (!G.player.inCar && dist2(fs.x, fs.z, G.player.x, G.player.z) < 4 * 4) {
    if (!G.fishing.active) {
      G.prompt = 'E — Fish (6s)';
      if (input.keys.has('KeyE')) {
        G.fishing.active = true; G.fishing.t = 0;
        G.hud.ticker('Line in the water…');
      }
    }
  }
  if (G.fishing.active) {
    G.fishing.t += dt;
    G.prompt = 'Fishing… ' + Math.ceil(CONFIG.fishTime - G.fishing.t) + 's';
    if (G.fishing.t >= CONFIG.fishTime) {
      G.fishing.active = false;
      G.audio.splash();
      if (Math.random() < CONFIG.fishChance) {
        const amt = Math.floor(CONFIG.fishMin + Math.random() * (CONFIG.fishMax - CONFIG.fishMin));
        G.cash += amt;
        G.hud.ticker('Caught a fish! Sold for +$' + amt);
      } else G.hud.ticker('Nothing bites this time.');
    }
  }
}

export function saveGame(G) {
  try {
    localStorage.setItem('solarabay-save', JSON.stringify({
      cash: G.cash, missionIndex: G.missionIndex, missionsDone: G.stats.missionsDone,
      respectPoints: G.respectPoints, sunCoinsGot: G.sunCoinsGot,
      weapons: Object.fromEntries(Object.entries(G.weapons).map(([k, w]) => [k, w.owned])),
      stats: G.stats,
    }));
  } catch (_) { /* storage penuh / privat */ }
}

export function loadSave(G) {
  try {
    const raw = localStorage.getItem('solarabay-save');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) { return null; }
}

export function applySave(G, s) {
  G.cash = s.cash; G.missionsDone = s.missionsDone || 0;
  G.stats.missionsDone = s.missionsDone || 0;
  G.respectPoints = s.respectPoints || 0;
  G.sunCoinsGot = s.sunCoinsGot || 0;
  if (s.weapons) for (const [k, owned] of Object.entries(s.weapons)) {
    if (G.weapons[k]) G.weapons[k].owned = owned;
  }
  if (s.stats) Object.assign(G.stats, s.stats);
  return s.missionIndex || 0;
}
