// SOLARA BAY — boot, game loop, state machine, wiring. Original open-world
// crime game: Ro Mendez pays off a debt to fixer Sal Vega across 5 missions
// while hunting developer Dario Kane. three.js, static files, offline.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng } from './random.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { buildCity } from './city.js';
import { createRenderer, createScene, updateDayNight, createParticles, updateParticles } from './render.js';
import { spawnCar, updatePlayerCar, exitCar } from './vehicles.js';
import { spawnTraffic, spawnPedestrians, updateTraffic, updatePedestrians } from './traffic.js';
import { createPlayer, updatePlayerOnFoot, updateCamera, exitVehicleKey } from './player.js';
import { createPolice, updateWantedLevel, tryRespray } from './police.js';
import { createCombat, updateCombat, spawnPickups, updatePickups } from './combat.js';
import { createMissions, updateMissions, startMission, saveGame, loadGame, retryMission, gameOver, onGuardDown, checkStuntJump, startTaxi } from './missions.js';
import { createHud } from './hud.js';
import { applyShot, enableHeadlights, disableHeadlights } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shotScene = params.get('shot');

const G = {
  seed,
  rng: makeRng(seed),
  canvas: document.getElementById('game'),
  phase: 'title',
  elapsed: 0,
  timeOfDay: CFG.startHour,
  wanted: 0,
  cars: [],
  traffic: [],
  peds: [],
  talkNpcs: [],
  garage: [],
  stats: { missionsDone: 0, coins: 0, carsStolen: 0, maxWanted: 0, taxiFares: 0 },
  player: { hp: CFG.maxHealth, armor: 0, cash: 0, onFoot: true, car: null, pos: new THREE.Vector3(0, 0, 20), yaw: Math.PI, camYaw: Math.PI, camPitch: 0.25, camDist: 8, walkPhase: 0 },
  shotPending: false,
  shotFrames: 0,
};
window.__game = G;
G.input = new Input(G.canvas);
G.audio = new AudioEngine();
G.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
G.renderer = createRenderer(G);
G.scene = createScene(G);
G.scene.add(buildCity(G));
createParticles(G);
createPlayer(G);
createPolice(G);
createCombat(G);
createMissions(G);
G.missions.onGuardDown = onGuardDown;
G.missions.gameOver = gameOver;
G.hud = createHud(G);
spawnTraffic(G);
spawnPedestrians(G);
spawnPickups(G);
// Parked cars the player can steal, including the mission-1 car.
spawnCar(G, 'sedan', 0, 60, 0.2);
spawnCar(G, 'hatch', 30, -90, 1.5);
spawnCar(G, 'taxi', -90, 30, -0.6, { driver: 'cab' });
spawnCar(G, 'van', 150, 90, 2.1);
spawnCar(G, 'sport', 120, -60, 0.4);
spawnCar(G, 'truck', 210, 200, 0.9, { driver: 'dock' });
spawnCar(G, 'sedan', -180, -180, 1.1);
spawnCar(G, 'hatch', 60, 180, -1.2);

// Headlight toggle with the day-night cycle.
let headlightsOn = false;

function togglePause(G) {
  if (G.phase === 'play') {
    G.phase = 'pause';
    G.input.unlockPointer();
    document.getElementById('pause-screen').style.display = 'flex';
  } else if (G.phase === 'pause') {
    G.phase = 'play';
    document.getElementById('pause-screen').style.display = 'none';
    G.input.lockPointer();
  }
}

function updatePrompt(G) {
  const p = G.player;
  if (G.phase !== 'play') { G.hud.setPrompt(''); return; }
  if (p.onFoot) {
    let near = null;
    for (const car of G.cars) {
      if (car.police) continue;
      const d = car.mesh.position.distanceTo(p.pos);
      if (d < 5) { near = car; break; }
    }
    if (near) {
      const label = CFG.carTypes[near.type].name;
      G.hud.setPrompt(`E — Curi ${label}`);
      return;
    }
    for (const npc of G.talkNpcs) {
      if (npc.mesh.position.distanceTo(p.pos) < 4) {
        G.hud.setPrompt(`E — Bicara dengan ${npc.name}`);
        return;
      }
    }
    // Shops: respray / guns.
    if (Math.hypot(p.pos.x - 120, p.pos.z - 60) < 6 && G.wanted > 0) {
      G.hud.setPrompt(`E — Respray $${G.wanted * CFG.resprayPerStar} (hapus wanted)`);
      if (G.input.pressed('KeyE')) tryRespray(G);
      return;
    }
    if (Math.hypot(p.pos.x - 180, p.pos.z + 60) < 6 && !p.pistolOwned && p.cash >= CFG.pistolPrice) {
      G.hud.setPrompt(`E — Beli pistol $${CFG.pistolPrice}`);
      if (G.input.pressed('KeyE')) {
        p.cash -= CFG.pistolPrice;
        p.pistolOwned = true; p.weapon = 'pistol'; p.ammo = 12;
        G.audio?.blip(880, 0.15, 'sine', 0.15);
        G.hud.setToast('Pistol dibeli! Tekan 2 untuk pakai');
      }
      return;
    }
    G.hud.setPrompt('');
  } else {
    G.hud.setPrompt('E — Keluar mobil');
  }
}

function updateGarage(G) {
  const p = G.player;
  if (!p.car) return;
  // Park an owned car at Mara's garage to keep it.
  if (Math.hypot(p.car.mesh.position.x + 60, p.car.mesh.position.z + 60) < 8) {
    if (G.garage.length < CFG.garageSlots && !G.garage.includes(p.car)) {
      G.garage.push(p.car);
      saveGame(G);
      G.hud.setToast(`Mobil disimpan di garasi (${G.garage.length}/${CFG.garageSlots})`);
    }
  }
}

const clock = new THREE.Clock();
let lastFpsLog = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  G.elapsed += dt;
  const input = G.input;

  // Global keys.
  if (input.pressed('KeyM')) {
    const muted = G.audio.toggleMute();
    G.hud.setToast(muted ? 'Suara mati (M)' : 'Suara hidup (M)');
  }
  if (input.pressed('Escape')) togglePause(G);
  if (input.pressed('KeyF') && G.phase === 'play') {
    startTaxi(G);
  }

  if (G.phase === 'play') {
    updateDayNight(G, dt);
    if (G.isNight && !headlightsOn) { enableHeadlights(G); headlightsOn = true; }
    if (!G.isNight && headlightsOn) { disableHeadlights(G); headlightsOn = false; }
    if (G.player.onFoot) updatePlayerOnFoot(G, dt);
    else {
      updatePlayerCar(G, dt);
      checkStuntJump(G, G.player.car);
      exitVehicleKey(G);
    }
    updateTraffic(G, dt);
    updatePedestrians(G, dt);
    updateWantedLevel(G, dt);
    updateCombat(G, dt);
    updateMissions(G, dt);
    updatePickups(G, dt, G.elapsed);
    updatePrompt(G);
    updateGarage(G);
    // Engine sound follows speed.
    const speedFrac = G.player.car ? Math.abs(G.player.car.speed) / CFG.carTypes[G.player.car.type].top : 0;
    G.audio.setEngine(speedFrac, !!G.player.car);
    // Ferris wheel turns slowly.
    if (G.ferrisWheel) G.ferrisWheel.children[0].rotation.z += dt * 0.1;
    // Auto-save on mission complete is done in missions.js.
  }

  updateCamera(G, dt);
  updateParticles(G, dt);
  G.hud.update(G, dt);
  G.renderer.render(G.scene, G.camera);

  // Screenshot readiness: after the scene settles for 2-3 frames.
  if (G.shotPending) {
    G.shotFrames += 1;
    if (G.shotFrames >= 3) {
      G.shotPending = false;
      window.__shotReady = true;
    }
  }
  // Expose a small state object for playtesting.
  window.__game = {
    phase: G.phase,
    wanted: G.wanted,
    cash: Math.floor(G.player.cash),
    mission: G.missions.index,
    missionStep: G.missions.step,
    hp: Math.round(G.player.hp),
    inCar: !!G.player.car,
    carSpeed: G.player.car ? Math.round(G.player.car.speed * 3.6) : 0,
    pos: [Math.round(G.player.pos.x), Math.round(G.player.pos.z)],
    timeOfDay: Math.round(G.timeOfDay * 10) / 10,
    enemies: G.enemies.length,
    traffic: G.traffic.length,
    peds: G.peds.length,
  };
  input.endFrame();
  if (G.elapsed - lastFpsLog > 10) {
    lastFpsLog = G.elapsed;
    console.log('fps tick', Math.round(1 / Math.max(dt, 0.001)));
  }
}


window.addEventListener('resize', () => {
  G.camera.aspect = window.innerWidth / window.innerHeight;
  G.camera.updateProjectionMatrix();
  G.renderer.setSize(window.innerWidth, window.innerHeight);
});

// Title screen click starts audio; the buttons handle the phase change.
document.getElementById('game').addEventListener('click', () => {
  if (G.phase === 'play') G.input.lockPointer();
});

if (shotScene) {
  applyShot(G, shotScene);
} else if (new URLSearchParams(location.search).get('autostart') === '1') {
  document.getElementById('title-screen').style.display = 'none';
  G.phase = 'play';
  startMission(G, 0);
}
frame();
