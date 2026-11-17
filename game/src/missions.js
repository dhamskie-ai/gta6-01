// Story missions (5) + side activities: taxi fares, stunt jumps, sun coins.
import * as THREE from 'three';
import { MISSIONS, CONFIG, TAXI_SPOTS, JUMP_RAMPS, SHOP_POS } from './config.js';
import { spawnGuard, spawnPickup } from './combat.js';
import { spawnCar } from './vehicles.js';
import { removePed } from './traffic.js';

function makeBeacon(G) {
  const geo = new THREE.CylinderGeometry(3, 3, 40, 16, 1, true);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = 20;
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15;
  const grp = new THREE.Group(); grp.add(m); grp.add(ring);
  grp.visible = false;
  G.scene.add(grp);
  return grp;
}

export function createMissions(G) {
  G.mission = { index: 0, step: 0, state: 'idle', timer: 0, beacon: makeBeacon(G), marker: null, taxi: null, courier: null, tailT: 0 };
  G.missionFoesLeft = 0;
  // Stunt ramps.
  G.ramps = [];
  for (const [rx, rz] of JUMP_RAMPS) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 6), new THREE.MeshLambertMaterial({ color: 0xd8a02a }));
    ramp.position.set(rx, 0.6, rz); ramp.rotation.x = -0.35; ramp.castShadow = true;
    G.scene.add(ramp);
    G.ramps.push({ x: rx, z: rz, done: false });
  }
  // Shop pickups.
  spawnPickup(G, 'health', SHOP_POS.guns[0] + 4, SHOP_POS.guns[1]);
  spawnPickup(G, 'armor', SHOP_POS.guns[0] - 4, SHOP_POS.guns[1]);
  spawnPickup(G, 'health', SHOP_POS.spray[0], SHOP_POS.spray[1] + 6);
}

export function startMission(G, index) {
  const def = MISSIONS[index];
  if (!def) { G.mission.state = 'done-all'; G.hud.showObjective('All missions complete — Solara Bay is yours, Ro.'); return; }
  G.mission.index = index; G.mission.step = 0; G.mission.state = 'active';
  G.mission.timer = def.time || 0;
  G.missionFoesLeft = 0;
  G.hud.showDialog(def.name, def.briefing);
  G.hud.showObjective(def.steps[0].text);
  G.audio.jingle();
  setupMissionStep(G);
}

function setupMissionStep(G) {
  const def = MISSIONS[G.mission.index];
  const step = def.steps[G.mission.step];
  if (!step) { completeMission(G); return; }
  const b = G.mission.beacon;
  b.position.set(step.pos[0], 0, step.pos[1]);
  b.visible = true;
  G.mission.marker = { x: step.pos[0], z: step.pos[1] };
  G.hud.showObjective(step.text);
  if (step.kind === 'clear') {
    for (let i = 0; i < step.count; i++) {
      spawnGuard(G, step.pos[0] + G.rng.range(-8, 8), step.pos[1] + G.rng.range(-8, 8));
    }
    G.missionFoesLeft = step.count;
  }
  if (def.id === 4 && step.kind === 'wait') G.timeOfDay = 21.5; // Neon Nights runs at night.
  if (def.id === 4 && step.kind === 'tail') {
    const c = spawnCar(G, 'sedan', step.pos[0] + 20, step.pos[1], 0, 'courier');
    c.speed = 8; c.cruise = 8;
    G.mission.courier = c;
    G.mission.tailT = 0;
  }
  if (def.id === 5 && step.kind === 'steal') {
    spawnCar(G, 'sport', step.pos[0], step.pos[1], 0.5, 'parked');
  }
  if (step.kind === 'stealTruck') {
    spawnCar(G, 'truck', step.pos[0], step.pos[1], 0.5, 'parked');
  }
}

export function advanceMissionStep(G) {
  G.mission.step++;
  G.audio.pickup();
  const def = MISSIONS[G.mission.index];
  if (G.mission.step >= def.steps.length) completeMission(G);
  else setupMissionStep(G);
}

export function completeMission(G) {
  const def = MISSIONS[G.mission.index];
  G.player.cash += def.reward;
  G.mission.beacon.visible = false;
  G.mission.marker = null;
  G.mission.state = 'complete';
  G.hud.showBanner('MISSION COMPLETE', `${def.name}  ·  +$${def.reward}`);
  G.audio.jingle();
  G.saveGame();
  setTimeout(() => {
    if (G.phase === 'play') { startMission(G, G.mission.index + 1); }
  }, 4000);
}

export function failMission(G, reason) {
  const def = MISSIONS[G.mission.index];
  G.mission.state = 'failed';
  G.mission.beacon.visible = false;
  G.audio.fail();
  G.hud.showBanner('MISSION FAILED', reason);
  setTimeout(() => {
    if (G.phase === 'play') { G.player.health = 100; startMission(G, G.mission.index); }
  }, 3000);
}

function distTo(p, x, z) { return Math.hypot(p.x - x, p.z - z); }

export function updateMissions(G, dt) {
  const m = G.mission;
  if (m.state === 'active') {
    const def = MISSIONS[m.index];
    const step = def.steps[m.step];
    if (!step) return;
    if (m.timer > 0) {
      m.timer -= dt;
      if (m.timer <= 0) { failMission(G, 'Out of time.'); return; }
    }
    const p = G.player.pos;
    if (step.kind === 'goto' || step.kind === 'wait') {
      if (distTo(p, step.pos[0], step.pos[1]) < (step.radius || 9)) advanceMissionStep(G);
    } else if (step.kind === 'clear') {
      if (G.missionFoesLeft <= 0 && G.enemies.length === 0) advanceMissionStep(G);
    } else if (step.kind === 'steal' || step.kind === 'stealTruck') {
      if (!G.player.onFoot && G.playerCar) {
        if (step.kind === 'stealTruck' && G.playerCar.type !== 'truck') {
          // Wrong car — keep waiting.
        } else advanceMissionStep(G);
      }
    } else if (step.kind === 'tail') {
      const c = m.courier;
      if (c) {
        const d = distTo(p, c.x, c.z);
        c.x += Math.sin(c.yaw) * 6 * dt; c.z += Math.cos(c.yaw) * 6 * dt;
        c.yaw += Math.sin(G.time * 0.3) * dt * 0.4;
        c.group.position.set(c.x, 0, c.z); c.group.rotation.y = c.yaw;
        if (d < 10) { failMission(G, 'The courier spotted you.'); return; }
        if (d < 42) { m.tailT += dt; if (m.tailT > 12) advanceMissionStep(G); }
        else m.tailT = Math.max(0, m.tailT - dt);
      }
    } else if (step.kind === 'chase') {
      const c = m.courier;
      if (c) {
        c.speed = 22;
        const dx = p.x - c.x, dz = p.z - c.z;
        const d = Math.hypot(dx, dz) || 1;
        c.yaw = Math.atan2(dx, dz) + Math.PI; // flee away from player
        c.x += Math.sin(c.yaw) * c.speed * dt; c.z += Math.cos(c.yaw) * c.speed * dt;
        c.group.position.set(c.x, 0, c.z); c.group.rotation.y = c.yaw;
        if (d < 4 && Math.abs((G.playerCar?.speed || 0)) > 5) {
          G.effects.burst(c.x, 1.5, c.z, 0xffaa00, 20);
          G.scene.remove(c.group); G.cars.splice(G.cars.indexOf(c), 1);
          G.mission.courier = null;
          advanceMissionStep(G);
        }
      }
    } else if (step.kind === 'escape') {
      if (distTo(p, step.pos[0], step.pos[1]) < (step.radius || 14)) {
        G.wanted = 0; G.audio.setSiren(false);
        advanceMissionStep(G);
      }
    }
    // Mission 5 escape: wanted 4 while driving the Aurelia.
    if (def.id === 5 && m.step === 2 && G.wanted < 4) G.addWanted(4 - G.wanted, 'the whole city is after the Aurelia');
    if (def.id === 3 && m.step === 2 && G.wanted < 2) G.addWanted(2 - G.wanted, 'the Docks crew called it in');
  }

  // Taxi fares: press E near a waiting passenger.
  if (!m.taxi) {
    const near = G.peds.find((pd) => pd.taxi && distTo(G.player.pos, pd.x, pd.z) < 3);
    if (near) G.hud.showPrompt('E — Pick up taxi fare');
    else if (G.player.onFoot) {
      const spot = TAXI_SPOTS.find(([sx, sz]) => distTo(G.player.pos, sx, sz) < 4 && !G.peds.some((pd) => pd.taxi && Math.hypot(pd.x - sx, pd.z - sz) < 6));
      if (spot && G.rng.chance(dt * 0.05)) {
        const pd = G.spawnPed(spot[0] + 2, spot[1] + 2);
        pd.state = 'wait'; pd.taxi = true;
      }
    }
  } else {
    const dest = m.taxi.dest;
    if (distTo(G.player.pos, dest[0], dest[1]) < 9) {
      G.player.cash += CONFIG.taxiFare;
      G.hud.toast(`Fare complete +$${CONFIG.taxiFare}`);
      G.audio.jingle();
      m.taxi = null; m.beacon.visible = m.state === 'active';
    }
  }
  if (G.input.wasPressed('KeyE') && !m.taxi) {
    const near = G.peds.find((pd) => pd.taxi && distTo(G.player.pos, pd.x, pd.z) < 3);
    if (near) {
      const dest = TAXI_SPOTS[Math.floor(G.rng.next() * TAXI_SPOTS.length)];
      m.taxi = { dest, ped: near };
      removePed(G, near);
      m.beacon.position.set(dest[0], 0, dest[1]); m.beacon.visible = true;
      G.hud.showObjective(`Taxi fare — drive to (${Math.round(dest[0])}, ${Math.round(dest[1])})`);
      G.hud.toast('Passenger aboard — drive to the marker');
    }
  }

  // Stunt jumps: drive over a ramp fast.
  for (const ramp of G.ramps) {
    if (ramp.done) continue;
    if (G.playerCar && distTo(G.player.pos, ramp.x, ramp.z) < 3 && Math.abs(G.playerCar.speed) > 18) {
      ramp.done = true;
      G.player.cash += CONFIG.jumpReward;
      G.hud.showBanner('STUNT JUMP!', `+$${CONFIG.jumpReward}`);
      G.audio.jingle();
    }
  }

  // Sun coins (spun + hidden by updateCityFx).
  for (const coin of G.coins) {
    if (coin.taken) continue;
    if (distTo(G.player.pos, coin.x, coin.z) < 2.2) {
      coin.taken = true;
      G.player.cash += CONFIG.coinValue;
      G.stats.coins++;
      G.audio.pickup();
      G.hud.toast(`Sun coin +$${CONFIG.coinValue} (${G.stats.coins}/30)`);
    }
  }

  // Shops: respray + guns.
  if (distTo(G.player.pos, SHOP_POS.spray[0], SHOP_POS.spray[1]) < 8 && G.wanted > 0) {
    G.hud.showPrompt(`E — Spray & Shine: clear wanted for $${G.wanted * CONFIG.resprayPerStar}`);
    if (G.input.wasPressed('KeyE') && G.player.cash >= G.wanted * CONFIG.resprayPerStar) {
      G.player.cash -= G.wanted * CONFIG.resprayPerStar;
      G.wanted = 0; G.audio.setSiren(false);
      G.hud.toast('Fresh paint. Heat is off.');
    }
  }
  if (distTo(G.player.pos, SHOP_POS.guns[0], SHOP_POS.guns[1]) < 6 && !G.player.hasPistol) {
    G.hud.showPrompt(`E — Buy pistol ($${CONFIG.pistolPrice})`);
    if (G.input.wasPressed('KeyE') && G.player.cash >= CONFIG.pistolPrice) {
      G.player.cash -= CONFIG.pistolPrice;
      G.player.hasPistol = true; G.player.weapon = 1; G.player.ammo = 12;
      G.hud.toast('Pistol bought — press 2 to equip');
    }
  }
}
