// SOLARA BAY boot: builds the world, runs the loop, owns the state machine.
import * as THREE from 'three';
import { makeRng } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity, updateCityFx } from './city.js';
import { createPlayerMesh, updatePlayerOnFoot, updateCamera } from './player.js';
import { spawnCar, updatePlayerCar, nearestStealableCar, stealCar, exitCar, initWheelInstances, updateWheelInstances } from './vehicles.js';
import { spawnTrafficWorld, spawnPed, updateTraffic, updatePeds, initPedInstances } from './traffic.js';
import { addWanted, updateWantedLevel, updatePolice } from './police.js';
import { createCombat, updateCombat } from './combat.js';
import { createMissions, startMission, updateMissions } from './missions.js';
import { createHud, updateHud, showTitle, showPause, showGameOver, saveGameData, loadGameData, missionName } from './hud.js';
import { createRender, updateDayNight, createEffects } from './render.js';
import { setupShot } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shotName = params.get('shot');

const G = {
  rng: makeRng(seed), seed, time: 0, timeOfDay: 14,
  phase: 'title', wanted: 0, hiddenT: 0, lightsOn: false,
  camYaw: Math.PI, camPitch: 0.15, camDist: 7, snapCamera: false,
  cars: [], policeCars: [], footPolice: [], peds: [], trafficPeds: [],
  playerCar: null, coins: [], lastShotT: -99, muzzleT: 0,
  stats: { carsStolen: 0, coins: 0, maxWanted: 0, playTime: 0 },
};
G.player = {
  pos: new THREE.Vector3(2.5, 0, 24), yaw: 0, vy: 0, walkPhase: 0,
  onFoot: true, health: 100, armor: 0, cash: 150,
  weapon: 0, ammo: 0, hasPistol: false, car: null,
};
G.spawnPed = (x, z) => spawnPed(G, x, z);
G.addWanted = (n, reason) => addWanted(G, n, reason);
G.input = createInput(document.getElementById('scene'));
G.audio = createAudio();

createRender(G, { lowFx: !!shotName });
createEffects(G);
buildCity(G);
initWheelInstances(G);
initPedInstances(G);
createPlayerMesh(G);
spawnTrafficWorld(G);
createCombat(G);
createMissions(G);

// Parked car for mission 1 right by the spawn point (on street x=0).
spawnCar(G, 'sedan', 2.5, 36, 0, 'parked');

G.explodeCar = (car) => {
  G.effects.burst(car.x, 1.5, car.z, 0xff8800, 26);
  G.effects.burst(car.x, 1.0, car.z, 0x555555, 14);
  G.audio.noise(0.5, 0.5, 150);
  G.scene.remove(car.group);
  G.cars.splice(G.cars.indexOf(car), 1);
  G.policeCars.splice(G.policeCars.indexOf(car), 1);
  if (G.playerCar === car) {
    G.playerCar = null; G.player.car = null; G.player.onFoot = true;
    G.player.health = Math.max(5, G.player.health - 25);
    G.playerMesh.visible = true;
    G.hud.toast('Your car blew up!');
  }
};

G.busted = () => {
  if (G.phase !== 'play') return;
  G.phase = 'over';
  G.player.cash = Math.max(0, G.player.cash - 100);
  G.wanted = 0; G.audio.setSiren(false);
  document.exitPointerLock?.();
  showGameOver(G, 'DITANGKAP', 'Busted — the Solara Bay police caught you. Bail cost $100.');
  G.audio.fail();
};
G.wasted = () => {
  if (G.phase !== 'play') return;
  G.phase = 'over';
  document.exitPointerLock?.();
  showGameOver(G, 'K.O.', 'Ro is down. Mara patches you up — but the mission restarts.');
  G.audio.fail();
};
G.saveGame = () => saveGameData(G);
G.startPlaying = () => {
  G.phase = 'play';
  G.hud.title.style.display = 'none';
  G.hud.gameover.style.display = 'none';
  G.hud.pause.style.display = 'none';
  G.hud.el.classList.add('on');
};
G.newGame = () => {
  const p = G.player;
  Object.assign(p, { health: 100, armor: 0, cash: 150, weapon: 0, ammo: 0, hasPistol: false, onFoot: true, car: null });
  p.pos.set(2.5, 0, 24); p.yaw = 0;
  G.wanted = 0; G.stats = { carsStolen: 0, coins: 0, maxWanted: 0, playTime: 0 };
  G.playerCar = null; G.playerMesh.visible = true;
  G.startPlaying();
  startMission(G, 0);
};
G.continueGame = () => {
  const data = loadGameData();
  if (!data) { G.newGame(); return; }
  const p = G.player;
  p.cash = data.cash; p.health = data.health; p.armor = data.armor;
  p.hasPistol = data.hasPistol; p.ammo = data.ammo;
  if (p.hasPistol) p.weapon = 1;
  G.stats.coins = data.coins || 0; G.stats.carsStolen = data.carsStolen || 0;
  G.stats.maxWanted = data.maxWanted || 0; G.stats.playTime = data.playTime || 0;
  G.startPlaying();
  // Clamp the saved mission index to 0–5 so a save on mission 6 (Harbor Lights) resumes there, never past the last mission.
  startMission(G, Math.min(data.mission, 5));
};
G.resumeGame = () => { G.phase = 'play'; showPause(G, false); };
G.quitToTitle = () => {
  G.phase = 'title';
  showTitle(G, !!loadGameData());
};
G.retryMission = () => {
  G.player.health = 100; G.player.armor = Math.max(G.player.armor, 0);
  G.player.pos.set(2.5, 0, 24);
  if (G.playerCar) { G.playerCar = null; G.player.car = null; G.player.onFoot = true; G.playerMesh.visible = true; }
  G.wanted = 0; G.audio.setSiren(false);
  G.startPlaying();
  startMission(G, G.mission.index);
};
G.restartMission = G.retryMission;

createHud(G);
G.hud.showObjective('Welcome to Solara Bay');

if (shotName) {
  setupShot(G, shotName);
} else {
  showTitle(G, !!loadGameData());
}

// Playtest + screenshot hook: live summary of the game state.
window.__game = { phase: 'title', wanted: 0, cash: 150, mission: '—', position: [2, 24], speed: 0, health: 100, onFoot: true };
window.__G = G;
window.__shotReady = false;

const clock = new THREE.Clock();
let saveT = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  G.time += dt;
  const input = G.input;

  if (G.phase === 'play') {
    G.stats.playTime += dt;
    // Pause / mute / headlights.
    if (input.wasPressed('Escape')) { G.phase = 'pause'; showPause(G, true); document.exitPointerLock?.(); }
    if (input.wasPressed('KeyM')) G.hud.toast(G.audio.toggleMute() ? 'Sound muted' : 'Sound on');
    if (input.wasPressed('KeyF')) { G.lightsOn = !G.lightsOn; G.hud.toast(G.lightsOn ? 'Headlights on' : 'Headlights off'); }

    if (G.playerCar) updatePlayerCar(G, dt);
    else updatePlayerOnFoot(G, dt);
    updateCamera(G, dt);

    // E: steal / enter / exit a car.
    if (input.wasPressed('KeyE')) {
      if (G.playerCar) exitCar(G);
      else {
        const car = nearestStealableCar(G, 4);
        if (car) stealCar(G, car);
      }
    }
    updateTraffic(G, dt);
    updatePeds(G, dt);
    updateWantedLevel(G, dt);
    updatePolice(G, dt);
    updateCombat(G, dt);
    updateMissions(G, dt);
    updateHud(G, dt);
    updateWheelInstances(G);
    updateCityFx(G, dt);
    // Auto-save when walking into the garage.
    saveT += dt;
    if (saveT > 10) {
      saveT = 0;
      if (Math.hypot(G.player.pos.x + 60, G.player.pos.z + 30) < 10) G.saveGame();
    }
  } else {
    // Title / pause / game over: slow orbit around the city centre.
    G.camYaw += dt * 0.03;
    G.camera.position.set(Math.sin(G.camYaw) * 120, 70, Math.cos(G.camYaw) * 120);
    G.camera.lookAt(0, 0, 0);
    updatePeds(G, dt);
    updateTraffic(G, dt);
    updateWheelInstances(G);
    updateCityFx(G, dt);
  }

  updateDayNight(G, dt);
  G.effects.update(dt);
  G.renderer.render(G.scene, G.camera);

  // Shot readiness: a few settled frames, then flag.
  if (shotName) {
    G.shotFrames = (G.shotFrames || 0) + 1;
    if (G.shotFrames >= 3) window.__shotReady = true;
  }
  const wg = window.__game;
  wg.phase = G.phase; wg.wanted = G.wanted; wg.cash = G.player.cash;
  wg.mission = missionName(G); wg.missionStep = G.mission.step;
  wg.position = [Math.round(G.player.pos.x), Math.round(G.player.pos.z)];
  wg.speed = G.playerCar ? Math.round(Math.abs(G.playerCar.speed) * 3.6) : 0;
  wg.health = Math.round(G.player.health); wg.onFoot = G.player.onFoot;
  wg.cars = G.cars.length;

  if (G.snapCamera) {
    // First frame after a shot setup: snap the chase cam into place.
    updateCamera(G, 1);
    G.camera.position.set(
      G.player.pos.x + Math.sin(G.camYaw) * (G.playerCar ? G.camDist + 4 : G.camDist),
      2.6 + G.camPitch * 6 + (G.playerCar ? 1.6 : 0),
      G.player.pos.z + Math.cos(G.camYaw) * (G.playerCar ? G.camDist + 4 : G.camDist));
    G.camera.lookAt(G.player.pos.x, G.player.pos.y + 1.6, G.player.pos.z);
    G.snapCamera = false;
  }
  input.endFrame();
}
frame();
