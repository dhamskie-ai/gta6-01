// SOLARA BAY startup: build the world, run the frame loop, drive the
// title / play / pause / game-over state machine.
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
import { createRender, updateDayNight, createEffects, loadQuality, saveQuality, applyQuality, updateDynamicRes } from './render.js';
import { setupShot } from './shots.js';
const query = new URLSearchParams(location.search);
const seed = parseInt(query.get('seed') || '1', 10) || 1;
const shot = query.get('shot');
const G = {
  rng: makeRng(seed),
  seed,
  time: 0,
  timeOfDay: 14,
  day: 1,
  phase: 'title',
  wanted: 0,
  hiddenT: 0,
  lightsOn: false,
  camYaw: Math.PI,
  camPitch: 0.15,
  camDist: 7,
  snapCamera: false,
  cars: [],
  policeCars: [],
  footPolice: [],
  peds: [],
  trafficPeds: [],
  raceCars: [],
  foodTrucks: [],
  playerCar: null,
  coins: [],
  lastShotT: -99,
  muzzleT: 0,
  _eventMsg: '',
  _eventT: 0,
  stats: { carsStolen: 0, coins: 0, maxWanted: 0, playTime: 0, missionsDone: 0 },
};
G.player = {
  pos: new THREE.Vector3(2.5, 0, 24),
  yaw: 0,
  vy: 0,
  walkPhase: 0,
  onFoot: true,
  health: 100,
  armor: 0,
  cash: 150,
  weapon: 0,
  ammo: 0,
  hasPistol: false,
  car: null,
};
G.spawnPed = (x, z) => spawnPed(G, x, z);
G.addWanted = (n, reason) => addWanted(G, n, reason);
G.input = createInput(document.getElementById('scene'));
G.audio = createAudio();
G.quality = loadQuality();
createRender(G, { shotMode: !!shot, quality: G.quality });
G.applyQuality = () => {
  saveQuality(G.quality);
  applyQuality(G);
  if (G.hud && G.hud.syncQualityInputs) G.hud.syncQualityInputs();
};
createEffects(G);
buildCity(G);
initWheelInstances(G);
initPedInstances(G);
createPlayerMesh(G);
spawnTrafficWorld(G);
createCombat(G);
createMissions(G);
spawnCar(G, 'sedan', 2.5, 36, 0, 'parked');
G.explodeCar = (car) => {
  G.effects.burst(car.x, 1.5, car.z, 0xff8800, 26);
  G.effects.burst(car.x, 1.0, car.z, 0x555555, 14);
  G.audio.noise(0.5, 0.5, 150);
  G.scene.remove(car.group);
  G.cars.splice(G.cars.indexOf(car), 1);
  G.policeCars.splice(G.policeCars.indexOf(car), 1);
  if (G.playerCar === car) {
    G.playerCar = null;
    G.player.car = null;
    G.player.onFoot = true;
    G.player.health = Math.max(5, G.player.health - 25);
    G.playerMesh.visible = true;
    G.hud.toast('Your car blew up!');
  }
};
G.busted = () => {
  if (G.phase !== 'play') return;
  G.phase = 'over';
  G.player.cash = Math.max(0, G.player.cash - 100);
  G.wanted = 0;
  G.audio.setSiren(false);
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
  const hero = G.player;
  Object.assign(hero, {
    health: 100, armor: 0, cash: 150, weapon: 0,
    ammo: 0, hasPistol: false, onFoot: true, car: null,
  });
  hero.pos.set(2.5, 0, 24);
  hero.yaw = 0;
  G.wanted = 0;
  G.stats = { carsStolen: 0, coins: 0, maxWanted: 0, playTime: 0, missionsDone: 0 };
  G.playerCar = null;
  G.playerMesh.visible = true;
  G.startPlaying();
  startMission(G, 0);
};
G.continueGame = () => {
  const data = loadGameData();
  if (!data) {
    G.newGame();
    return;
  }
  const hero = G.player;
  hero.cash = data.cash;
  hero.health = data.health;
  hero.armor = data.armor;
  hero.hasPistol = data.hasPistol;
  hero.ammo = data.ammo;
  if (hero.hasPistol) hero.weapon = 1;
  G.stats.coins = data.coins || 0;
  G.stats.carsStolen = data.carsStolen || 0;
  G.stats.maxWanted = data.maxWanted || 0;
  G.stats.playTime = data.playTime || 0;
  G.stats.missionsDone = Math.min(data.mission || 0, 5);
  G.startPlaying();
  startMission(G, Math.min(data.mission, 5));
};
G.resumeGame = () => {
  G.phase = 'play';
  showPause(G, false);
};
G.quitToTitle = () => {
  G.phase = 'title';
  showTitle(G, !!loadGameData());
};
G.retryMission = () => {
  G.player.health = 100;
  G.player.armor = Math.max(G.player.armor, 0);
  G.player.pos.set(2.5, 0, 24);
  if (G.playerCar) {
    G.playerCar = null;
    G.player.car = null;
    G.player.onFoot = true;
    G.playerMesh.visible = true;
  }
  G.wanted = 0;
  G.audio.setSiren(false);
  G.startPlaying();
  startMission(G, G.mission.index);
};
G.restartMission = G.retryMission;
createHud(G);
G.hud.showObjective('Welcome to Solara Bay');
if (shot) {
  setupShot(G, shot);
} else {
  showTitle(G, !!loadGameData());
}
window.__game = {
  phase: 'title', wanted: 0, cash: 150, mission: '—',
  position: [2, 24], speed: 0, health: 100, onFoot: true,
};
window.__G = G;
window.__shotReady = false;
const frameClock = new THREE.Clock();
let saveTimer = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, frameClock.getDelta());
  G.time += dt;
  const instFps = dt > 0.001 ? 1 / dt : 60;
  G._fps = G._fps ? G._fps * 0.95 + instFps * 0.05 : instFps;
  const keys = G.input;
  if (G.phase === 'play') {
    G.stats.playTime += dt;
    if (keys.wasPressed('Escape')) {
      G.phase = 'pause';
      showPause(G, true);
      document.exitPointerLock?.();
    }
    if (keys.wasPressed('KeyM')) G.hud.toast(G.audio.toggleMute() ? 'Sound off' : 'Sound on');
    if (keys.wasPressed('KeyF')) {
      G.lightsOn = !G.lightsOn;
      G.hud.toast(G.lightsOn ? 'Headlights on' : 'Headlights off');
    }
    if (keys.wasPressed('F3')) {
      G.quality.showFps = !G.quality.showFps;
      saveQuality(G.quality);
      G.hud.toast(G.quality.showFps ? 'FPS counter on' : 'FPS counter off');
    }
    if (G.playerCar) updatePlayerCar(G, dt);
    else updatePlayerOnFoot(G, dt);
    updateCamera(G, dt);
    if (keys.wasPressed('KeyE')) {
      if (G.playerCar) {
        exitCar(G);
      } else {
        const nearby = nearestStealableCar(G, 4);
        if (nearby) stealCar(G, nearby);
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
    saveTimer += dt;
    if (saveTimer > 10) {
      saveTimer = 0;
      if (Math.hypot(G.player.pos.x + 60, G.player.pos.z + 30) < 10) G.saveGame();
    }
  } else {
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
  updateDynamicRes(G, dt);
  G.renderer.render(G.scene, G.camera);
  if (shot) {
    G.shotFrames = (G.shotFrames || 0) + 1;
    if (G.shotFrames >= 3) window.__shotReady = true;
  }
  const live = window.__game;
  live.phase = G.phase;
  live.wanted = G.wanted;
  live.cash = G.player.cash;
  live.mission = missionName(G);
  live.missionStep = G.mission.step;
  live.position = [Math.round(G.player.pos.x), Math.round(G.player.pos.z)];
  live.speed = G.playerCar ? Math.round(Math.abs(G.playerCar.speed) * 3.6) : 0;
  live.health = Math.round(G.player.health);
  live.onFoot = G.player.onFoot;
  live.cars = G.cars.length;
  if (G.snapCamera) {
    updateCamera(G, 1);
    G.camera.position.set(
      G.player.pos.x + Math.sin(G.camYaw) * (G.playerCar ? G.camDist + 4 : G.camDist),
      2.6 + G.camPitch * 6 + (G.playerCar ? 1.6 : 0),
      G.player.pos.z + Math.cos(G.camYaw) * (G.playerCar ? G.camDist + 4 : G.camDist));
    G.camera.lookAt(G.player.pos.x, G.player.pos.y + 1.6, G.player.pos.z);
    G.snapCamera = false;
  }
  keys.endFrame();
}
frame();
