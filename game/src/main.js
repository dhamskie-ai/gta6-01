// SOLARA BAY — boot, game loop, state machine, wiring antar sistem.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { mulberry32 } from './random.js';
import { createInput, wasPressed, endFrameInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { spawnCar, updatePlayerCar, stealCar, exitCar } from './vehicles.js';
import { initTraffic, updateTraffic, fleePed } from './traffic.js';
import { createPlayerMesh, createMarcoMesh, updatePlayer, updateCamera } from './player.js';
import { addWanted, updateWanted, maintainPolice, updatePolice } from './police.js';
import { initCombat, updateCombat, switchWeapon, spawnPickups } from './combat.js';
import {
  startMission, updateMissions, updateRace, initSideActivities,
  updateSideActivities, saveGame, loadSave, applySave, retryMission,
} from './missions.js';
import { createHud } from './hud.js';
import { createRenderer, createWorld, createRenderFx, updateRender } from './render.js';
import { applyShot, shotTick, snapshot } from './shots.js';

globalThis.THREE = THREE;

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || String(CONFIG.seed), 10);
const rng = mulberry32(seed);

const canvas = document.getElementById('game-canvas');
const renderer = createRenderer(canvas);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc3e8);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
const world = createWorld(THREE, scene);
const city = buildCity(scene, THREE, rng);
const renderFx = createRenderFx(THREE, scene);
const input = createInput(canvas);
const audio = createAudio();

const G = {
  THREE, scene, city, renderFx, audio, input,
  phase: 'title', time: 0, timeOfDay: CONFIG.startTime, day: 1,
  cash: CONFIG.cashStart, wanted: 0, heat: 0, wantedTimer: 0,
  health: 100, armor: 0, weapon: 1, missionIndex: 0, missionsDone: 0,
  respectPoints: 0, nightFactor: 0, shotMode: false, seed,
  cars: [], policeCars: [], footCops: [], trafficCars: [], parkedCars: [], peds: [],
  policeUnits: [], heli: null, roadblock: null, beacon: { x: 0, z: 0, visible: false },
  mission: null, race: null, playerCar: null, marco: null,
  stats: { stolen: 0, kills: 0, jumps: 0, maxWanted: 0, missionsDone: 0 },
  prompt: '', fleeUntil: 0, _policeSeq: 0, _toastCd: 0,
  player: {
    x: -120, z: 0, y: 0, vy: 0, yaw: 0, camYaw: 0, camPitch: 0.22, camDist: 7,
    camYawOffset: 0, walkPhase: 0, inCar: false, mesh: null,
  },
};
G.police = { addWanted, updateWanted, maintainPolice, updatePolice };
G.traffic = { fleePed };

G.player.mesh = createPlayerMesh(THREE);
G.player.mesh.position.set(G.player.x, 0, G.player.z);
scene.add(G.player.mesh);
G.marco = { mesh: createMarcoMesh(THREE), x: 0, z: 116 };
G.marco.mesh.position.set(0, 0, 116);
scene.add(G.marco.mesh);

initTraffic(G, THREE, city, rng);
initCombat(G);
initSideActivities(G);
spawnPickups(G, THREE, city);

const hud = createHud(G, {
  newGame() {
    G.cash = CONFIG.cashStart; G.health = 100; G.armor = 0; G.wanted = 0;
    G.missionsDone = 0; G.stats.missionsDone = 0; G.respectPoints = 0;
    G.timeOfDay = CONFIG.startTime; G.day = 1;
    G.player.x = -120; G.player.z = 0; G.player.inCar = false;
    G.phase = 'play';
    hud.showGame();
    startMission(G, 0);
  },
  continueGame() {
    const s = loadSave(G);
    const idx = s ? applySave(G, s) : 0;
    G.health = 100; G.armor = 0; G.wanted = 0;
    G.phase = 'play';
    hud.showGame();
    startMission(G, idx);
  },
  resume() { G.phase = 'play'; hud.showPause(false); },
  restartMission() {
    G.health = 100; G.armor = 0; G.wanted = 0;
    G.phase = 'play'; hud.showPause(false);
    startMission(G, G.missionIndex || 0);
  },
  saveQuit() {
    saveGame(G);
    G.phase = 'title'; hud.showPause(false);
    hud.showTitle(true);
  },
  retryEnd() { retryMission(G); },
  closeEnd() {
    hud.hideEnd();
    if (G.phase === 'won') { G.phase = 'title'; hud.showTitle(true); return; }
    if (G.phase === 'dead' || G.phase === 'busted') {
      G.health = 100; G.armor = 0; G.wanted = 0;
      G.player.x = 0; G.player.z = 0; G.player.y = 0;
      if (G.playerCar) { G.playerCar.isPlayer = false; G.playerCar = null; }
      G.player.inCar = false;
      G.phase = 'play';
    }
  },
});
G.hud = hud;

const hadShot = applyShot(G);
if (!hadShot) {
  hud.showTitle(!!loadSave(G));
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function nearestStealable() {
  let best = null, bd = 3.5 * 3.5;
  for (const car of G.cars) {
    if (car.dead || car.isPlayer || car.type === 'police') continue;
    const dx = car.x - G.player.x, dz = car.z - G.player.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bd) { bd = d2; best = car; }
  }
  return best;
}

let prevPhase = G.phase;
const clock = new THREE.Clock();

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  G.time += dt;
  G.prompt = '';
  if (G.phase === 'play') {
    G.timeOfDay += dt / CONFIG.dayLength;
    if (G.timeOfDay >= 24) { G.timeOfDay -= 24; G.day++; }
    if (wasPressed(input, 'Escape')) { G.phase = 'pause'; hud.showPause(true); }
    if (wasPressed(input, 'KeyM')) audio.setMuted(!audio.muted);
    if (wasPressed(input, 'KeyR') && G.weapon > 1) {
      const w = G.weapons[G.weapon];
      if (w.mag < w.ammo && G.reloadT <= 0) G.reloadT = 0.9;
    }
    for (let n = 1; n <= 5; n++) {
      if (wasPressed(input, 'Digit' + n)) switchWeapon(G, n);
    }
    if (wasPressed(input, 'KeyE')) {
      if (G.player.inCar) exitCar(G);
      else {
        const car = nearestStealable();
        if (car) stealCar(G, car);
      }
    }
    if (G.player.inCar && G.playerCar) updatePlayerCar(G, dt, input, city);
    else updatePlayer(G, dt, input, city);
    updateTraffic(G, dt, city, rng);
    if (!G.shotMode) maintainPolice(G, THREE, city, rng);
    updatePolice(G, dt, city);
    updateWanted(G, dt);
    updateCombat(G, dt, input, camera);
    updateMissions(G, dt, input);
    updateRace(G, dt);
    updateSideActivities(G, dt, input);
    updateCamera(G, camera);
    audio.update(dt, G.playerCar ? Math.abs(G.playerCar.speed) / 38 : 0, !!G.playerCar, G.wanted);
    if (G.shotPrompt) G.prompt = G.shotPrompt; // prompt staging shot menang
    hud.update(G, dt);
  } else if (G.phase === 'title') {
    const a = G.time * 0.05;
    camera.position.set(Math.sin(a) * 180, 90, Math.cos(a) * 180);
    camera.lookAt(0, 0, 0);
    city.updateCityFx(dt, G.timeOfDay, 0.3, G.time);
  } else if (G.phase === 'pause') {
    if (wasPressed(input, 'Escape')) { G.phase = 'play'; hud.showPause(false); }
  }
  if (prevPhase !== G.phase) {
    if (G.phase === 'dead') hud.showEnd('K.O.', 'Nico is down. The city keeps moving — press continue to get back up.');
    if (G.phase === 'busted') hud.showEnd('DITANGKAP', 'PCPD got you, Nico. Press continue — the streets are still yours.');
    prevPhase = G.phase;
  }
  updateRender(G, dt, world, city, camera);
  renderer.render(scene, camera);
  window.__game = snapshot(G);
  shotTick(G);
  endFrameInput(input);
}
loop();

window.__game = snapshot(G);
window.__solara = G;
