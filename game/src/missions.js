// Story missions (six of them, ending with Harbor Lights) plus the
// side hustles that pay between jobs: taxi fares, stunt jumps, sun
// coins, and the new pier fishing spot at the end of the Marina pier.
import * as THREE from 'three';
import { MISSIONS, CONFIG, TAXI_SPOTS, JUMP_RAMPS, SHOP_POS, FISH_SPOT, PARTY_POS } from './config.js';
import { spawnGuard, spawnPickup } from './combat.js';
import { spawnCar } from './vehicles.js';
import { removePed } from './traffic.js';
function distTo(point, x, z) {
  return Math.hypot(point.x - x, point.z - z);
}
function makeBeacon(G) {
  const columnGeo = new THREE.CylinderGeometry(3, 3, 40, 16, 1, true);
  const columnMat = new THREE.MeshBasicMaterial({
    color: 0xffd23f, transparent: true, opacity: 0.28,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const column = new THREE.Mesh(columnGeo, columnMat);
  column.position.y = 20;
  const groundRing = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, side: THREE.DoubleSide }),
  );
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = 0.15;
  const beacon = new THREE.Group();
  beacon.add(column);
  beacon.add(groundRing);
  beacon.visible = false;
  G.scene.add(beacon);
  return beacon;
}
export function createMissions(G) {
  G.mission = {
    index: 0, step: 0, state: 'idle', timer: 0,
    beacon: makeBeacon(G), marker: null, taxi: null, courier: null, tailT: 0,
  };
  G.missionFoesLeft = 0;
  G._fishing = { active: false, t: 0 };
  G._partyToasted = false;
  G.ramps = [];
  for (const [rampX, rampZ] of JUMP_RAMPS) {
    const rampMesh = new THREE.Mesh(
      new THREE.BoxGeometry(4, 1.2, 6),
      new THREE.MeshLambertMaterial({ color: 0xd8a02a }),
    );
    rampMesh.position.set(rampX, 0.6, rampZ);
    rampMesh.rotation.x = -0.35;
    rampMesh.castShadow = true;
    G.scene.add(rampMesh);
    G.ramps.push({ x: rampX, z: rampZ, done: false });
  }
  spawnPickup(G, 'health', SHOP_POS.guns[0] + 4, SHOP_POS.guns[1]);
  spawnPickup(G, 'armor', SHOP_POS.guns[0] - 4, SHOP_POS.guns[1]);
  spawnPickup(G, 'health', SHOP_POS.spray[0], SHOP_POS.spray[1] + 6);
}
export function startMission(G, index) {
  const missionDef = MISSIONS[index];
  if (!missionDef) {
    G.mission.state = 'done-all';
    G.hud.showObjective('All missions complete — Solara Bay is yours, Ro.');
    return;
  }
  G.mission.index = index;
  G.mission.step = 0;
  G.mission.state = 'active';
  G.mission.timer = missionDef.time || 0;
  G.missionFoesLeft = 0;
  G.hud.showDialog(missionDef.name, missionDef.briefing);
  G.hud.showObjective(missionDef.steps[0].text);
  G.audio.jingle();
  setupMissionStep(G);
}
function setupMissionStep(G) {
  const missionDef = MISSIONS[G.mission.index];
  const currentStep = missionDef.steps[G.mission.step];
  if (!currentStep) {
    completeMission(G);
    return;
  }
  const beacon = G.mission.beacon;
  beacon.position.set(currentStep.pos[0], 0, currentStep.pos[1]);
  beacon.visible = true;
  G.mission.marker = { x: currentStep.pos[0], z: currentStep.pos[1] };
  G.hud.showObjective(currentStep.text);
  if (currentStep.kind === 'clear') {
    for (let i = 0; i < currentStep.count; i++) {
      spawnGuard(
        G,
        currentStep.pos[0] + G.rng.range(-8, 8),
        currentStep.pos[1] + G.rng.range(-8, 8),
      );
    }
    G.missionFoesLeft = currentStep.count;
  }
  if (missionDef.id === 4 && currentStep.kind === 'wait') G.timeOfDay = 21.5;
  if (missionDef.id === 4 && currentStep.kind === 'tail') {
    const courierCar = spawnCar(G, 'sedan', currentStep.pos[0] + 20, currentStep.pos[1], 0, 'courier');
    courierCar.speed = 8;
    courierCar.cruise = 8;
    G.mission.courier = courierCar;
    G.mission.tailT = 0;
  }
  if (missionDef.id === 5 && currentStep.kind === 'steal') {
    spawnCar(G, 'sport', currentStep.pos[0], currentStep.pos[1], 0.5, 'parked');
  }
  if (currentStep.kind === 'stealTruck') {
    spawnCar(G, 'truck', currentStep.pos[0], currentStep.pos[1], 0.5, 'parked');
  }
}
export function completeMission(G) {
  const missionDef = MISSIONS[G.mission.index];
  G.player.cash += missionDef.reward;
  G.stats.missionsDone = (G.stats.missionsDone || 0) + 1;
  G.mission.beacon.visible = false;
  G.mission.marker = null;
  G.mission.state = 'complete';
  G.hud.showBanner('MISSION COMPLETE', `${missionDef.name}  ·  +$${missionDef.reward}`);
  G.audio.jingle();
  G.saveGame();
  setTimeout(() => {
    if (G.phase === 'play') startMission(G, G.mission.index + 1);
  }, 4000);
}
export function advanceMissionStep(G) {
  G.mission.step++;
  G.audio.pickup();
  const missionDef = MISSIONS[G.mission.index];
  if (G.mission.step >= missionDef.steps.length) completeMission(G);
  else setupMissionStep(G);
}
export function failMission(G, reason) {
  G.mission.state = 'failed';
  G.mission.beacon.visible = false;
  G.audio.fail();
  G.hud.showBanner('MISSION FAILED', reason);
  setTimeout(() => {
    if (G.phase === 'play') {
      G.player.health = 100;
      startMission(G, G.mission.index);
    }
  }, 3000);
}
export function updateMissions(G, dt) {
  const mission = G.mission;
  if (mission.state === 'active') {
    const missionDef = MISSIONS[mission.index];
    const currentStep = missionDef.steps[mission.step];
    if (!currentStep) return;
    if (mission.timer > 0) {
      mission.timer -= dt;
      if (mission.timer <= 0) {
        failMission(G, 'Out of time.');
        return;
      }
    }
    const playerPos = G.player.pos;
    if (currentStep.kind === 'goto' || currentStep.kind === 'wait') {
      if (distTo(playerPos, currentStep.pos[0], currentStep.pos[1]) < (currentStep.radius || 9)) {
        advanceMissionStep(G);
      }
    } else if (currentStep.kind === 'clear') {
      if (G.missionFoesLeft <= 0 && G.enemies.length === 0) advanceMissionStep(G);
    } else if (currentStep.kind === 'steal' || currentStep.kind === 'stealTruck') {
      if (!G.player.onFoot && G.playerCar) {
        if (currentStep.kind === 'stealTruck' && G.playerCar.type !== 'truck') {
        } else {
          advanceMissionStep(G);
        }
      }
    } else if (currentStep.kind === 'tail') {
      const courierCar = mission.courier;
      if (courierCar) {
        const gap = distTo(playerPos, courierCar.x, courierCar.z);
        courierCar.x += Math.sin(courierCar.yaw) * 6 * dt;
        courierCar.z += Math.cos(courierCar.yaw) * 6 * dt;
        courierCar.yaw += Math.sin(G.time * 0.3) * dt * 0.4;
        courierCar.group.position.set(courierCar.x, 0, courierCar.z);
        courierCar.group.rotation.y = courierCar.yaw;
        if (gap < 10) {
          failMission(G, 'The courier spotted you.');
          return;
        }
        if (gap < 42) {
          mission.tailT += dt;
          if (mission.tailT > 12) advanceMissionStep(G);
        } else {
          mission.tailT = Math.max(0, mission.tailT - dt);
        }
      }
    } else if (currentStep.kind === 'chase') {
      const courierCar = mission.courier;
      if (courierCar) {
        courierCar.speed = 22;
        const dx = playerPos.x - courierCar.x;
        const dz = playerPos.z - courierCar.z;
        const gap = Math.hypot(dx, dz) || 1;
        courierCar.yaw = Math.atan2(dx, dz) + Math.PI;
        courierCar.x += Math.sin(courierCar.yaw) * courierCar.speed * dt;
        courierCar.z += Math.cos(courierCar.yaw) * courierCar.speed * dt;
        courierCar.group.position.set(courierCar.x, 0, courierCar.z);
        courierCar.group.rotation.y = courierCar.yaw;
        if (gap < 4 && Math.abs((G.playerCar?.speed || 0)) > 5) {
          G.effects.burst(courierCar.x, 1.5, courierCar.z, 0xffaa00, 20);
          G.scene.remove(courierCar.group);
          G.cars.splice(G.cars.indexOf(courierCar), 1);
          G.mission.courier = null;
          advanceMissionStep(G);
        }
      }
    } else if (currentStep.kind === 'escape') {
      if (distTo(playerPos, currentStep.pos[0], currentStep.pos[1]) < (currentStep.radius || 14)) {
        G.wanted = 0;
        G.audio.setSiren(false);
        advanceMissionStep(G);
      }
    }
    if (missionDef.id === 5 && mission.step === 2 && G.wanted < 4) {
      G.addWanted(4 - G.wanted, 'the whole city is after the Aurelia');
    }
    if (missionDef.id === 3 && mission.step === 2 && G.wanted < 2) {
      G.addWanted(2 - G.wanted, 'the Docks crew called it in');
    }
    if (missionDef.id === 6 && mission.step === 2 && G.wanted < 2) {
      G.addWanted(2 - G.wanted, 'the harbor crew raised the alarm');
    }
  }
  if (!mission.taxi) {
    const waiting = G.peds.find((walker) => walker.taxi && distTo(G.player.pos, walker.x, walker.z) < 3);
    if (waiting) {
      G.hud.showPrompt('E — Take this taxi fare');
    } else if (G.player.onFoot) {
      const pickupSpot = TAXI_SPOTS.find(([spotX, spotZ]) =>
        distTo(G.player.pos, spotX, spotZ) < 4 &&
        !G.peds.some((walker) => walker.taxi && Math.hypot(walker.x - spotX, walker.z - spotZ) < 6));
      if (pickupSpot && G.rng.chance(dt * 0.05)) {
        const walker = G.spawnPed(pickupSpot[0] + 2, pickupSpot[1] + 2);
        if (walker) {
          walker.state = 'wait';
          walker.taxi = true;
        }
      }
    }
  } else {
    const dropOff = mission.taxi.dest;
    if (distTo(G.player.pos, dropOff[0], dropOff[1]) < 9) {
      G.player.cash += CONFIG.taxiFare;
      G.hud.toast(`Fare finished +$${CONFIG.taxiFare}`);
      G.audio.jingle();
      mission.taxi = null;
      mission.beacon.visible = mission.state === 'active';
    }
  }
  if (G.input.wasPressed('KeyE') && !mission.taxi) {
    const waiting = G.peds.find((walker) => walker.taxi && distTo(G.player.pos, walker.x, walker.z) < 3);
    if (waiting) {
      const dropOff = TAXI_SPOTS[Math.floor(G.rng.next() * TAXI_SPOTS.length)];
      mission.taxi = { dest: dropOff, ped: waiting };
      removePed(G, waiting);
      mission.beacon.position.set(dropOff[0], 0, dropOff[1]);
      mission.beacon.visible = true;
      G.hud.showObjective(`Taxi fare — take them to (${Math.round(dropOff[0])}, ${Math.round(dropOff[1])})`);
      G.hud.toast('Passenger in — follow the beacon to the drop-off');
    }
  }
  for (const jump of G.ramps) {
    if (jump.done) continue;
    if (G.playerCar && distTo(G.player.pos, jump.x, jump.z) < 3 && Math.abs(G.playerCar.speed) > 18) {
      jump.done = true;
      G.player.cash += CONFIG.jumpReward;
      G.hud.showBanner('STUNT JUMP!', `+$${CONFIG.jumpReward}`);
      G.audio.jingle();
    }
  }
  for (const sunCoin of G.coins) {
    if (sunCoin.taken) continue;
    if (distTo(G.player.pos, sunCoin.x, sunCoin.z) < 2.2) {
      sunCoin.taken = true;
      G.player.cash += CONFIG.coinValue;
      G.stats.coins++;
      G.audio.pickup();
      G.hud.toast(`Picked up a sun coin +$${CONFIG.coinValue} (${G.stats.coins} of 30)`);
    }
  }
  const fish = G._fishing;
  if (fish) {
    const nearPier = G.player.onFoot && distTo(G.player.pos, FISH_SPOT[0], FISH_SPOT[1]) < 5;
    if (fish.active) {
      fish.t -= dt;
      G.hud.showPrompt('Fishing… wait for a bite');
      if (fish.t <= 0) {
        fish.active = false;
        G.hud.showPrompt('');
        G.audio.splash();
        if (G.rng.chance(0.65)) {
          const prize = G.rng.int(CONFIG.fishMin, CONFIG.fishMax);
          G.player.cash += prize;
          G.hud.toast(`Caught a bay snapper — sold for $${prize}`);
          G.audio.pickup();
        } else {
          G.hud.toast('Nothing bit this time.');
        }
      }
    } else if (nearPier) {
      G.hud.showPrompt('E — Cast a line at the pier');
      if (G.input.wasPressed('KeyE')) {
        fish.active = true;
        fish.t = 6;
        G.hud.toast('Line cast…');
      }
    }
  }
  if (!G._partyToasted && (G.timeOfDay >= 20 || G.timeOfDay < 6)) {
    if (distTo(G.player.pos, PARTY_POS[0], PARTY_POS[1]) < 90) {
      G._partyToasted = true;
      G._eventMsg = 'BEACH PARTY at Coral Strand — bonfire lit, music on';
      G._eventT = 6;
      G.audio.cheer();
    }
  }
  if (distTo(G.player.pos, SHOP_POS.spray[0], SHOP_POS.spray[1]) < 8 && G.wanted > 0) {
    G.hud.showPrompt(`E — Spray & Shine: lose the heat for $${G.wanted * CONFIG.resprayPerStar}`);
    if (G.input.wasPressed('KeyE') && G.player.cash >= G.wanted * CONFIG.resprayPerStar) {
      G.player.cash -= G.wanted * CONFIG.resprayPerStar;
      G.wanted = 0;
      G.audio.setSiren(false);
      G.hud.toast('Fresh coat of paint. The heat is gone.');
    }
  }
  if (distTo(G.player.pos, SHOP_POS.guns[0], SHOP_POS.guns[1]) < 6 && !G.player.hasPistol) {
    G.hud.showPrompt(`E — Buy a pistol ($${CONFIG.pistolPrice})`);
    if (G.input.wasPressed('KeyE') && G.player.cash >= CONFIG.pistolPrice) {
      G.player.cash -= CONFIG.pistolPrice;
      G.player.hasPistol = true;
      G.player.weapon = 1;
      G.player.ammo = 12;
      G.hud.toast('Pistol purchased — press 2 to draw it');
    }
  }
}
