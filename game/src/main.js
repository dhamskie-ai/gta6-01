// Boot, game loop, state wiring, window exposes.
import * as THREE from 'three';
import { CFG, FISH_SPOTS, PHOTO_SPOTS, districtAt } from './config.js';
import { makeRng } from './random.js';
import { initRender, updateSky } from './render.js';
import { buildCity as buildCityFn, updateCity as updateCityFn } from './city.js';
import { initInput, endFrameInput } from './input.js';
import { initAudio, updateAudio, toggleMute, sfx } from './audio.js';
import { spawnParkedCars, initTraffic, initPeds, updateTraffic, updatePeds } from './traffic.js';
import { initPlayer, updatePlayer, updateCamera } from './player.js';
import { updatePolice, addWanted } from './police.js';
import { updateCombat } from './combat.js';
import { initMissions, updateMissions } from './missions.js';
import { initHud, updateHud } from './hud.js';
import { initTouch, updateTouchUI } from './touch.js';
import { stageShot, shotTick } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '8', 10) || 8;
const G = {
  seed, rng: makeRng(seed), canvas: document.getElementById('game'),
  timeOfDay: 12, day: 1, cash: CFG.startCash, health: 100, armor: 0,
  wanted: 0, hiddenT: 0, phase: 'title',
  missionIdx: 0, missionStage: 0, missionTitle: '', missionTimer: 0,
  missionX: 0, missionZ: 0, missionNext: '', objective: '',
  cars: [], traffic: [], peds: [], npcs: [], policeCars: [], footCops: [],
  heli: null, guards: [], colliders: [], stats: { stolen: 0, maxWanted: 0, kills: 0, photos: 0, fish: 0, deliveries: 0, races: 0 },
  elapsed: 0, frames: 0, shotMode: false, shotName: '', district: 'Malecón Celeste',
  centerMsgText: '', centerMsgT: 0, dialog: null, muted: false,
  joy: { x: 0, y: 0 }, touchShoot: false, touchBrake: false,
};
G.addWanted = (n) => addWanted(G, n);
G.toggleMute = () => toggleMute(G);
window.__game = G;
window.__G = G; // debug expose (heading, scene inspection for playtests)
window.__shotReady = false;

initRender(G);
initAudio(G);
buildCityFn(G);
spawnParkedCars(G);
initTraffic(G);
initPeds(G);
initPlayer(G);
initMissions(G);
initHud(G);
initTouch(G);
initInput(G);

const shotName = params.get('shot');
if (shotName) stageShot(G, shotName);

window.__startNew = () => G.startNew();
window.__startContinue = () => G.startContinue();
window.__resume = () => G.resumeGame();
window.__restartMission = () => G.restartMission();
window.__quitToTitle = () => G.quitToTitle();
window.__retry = () => G.retry();

let last = performance.now();
function frame() {
  requestAnimationFrame(frame);
  // performance.now() directly: headless rAF timestamps are not monotonic.
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  G.elapsed += dt;
  if (G.phase === 'play') {
    G.timeOfDay += dt * 0.12;
    if (G.timeOfDay >= 24) { G.timeOfDay -= 24; G.day++; }
    // HUD context flags.
    G.district = districtAt(G.player.x, G.player.z);
    let nd = 1e9;
    for (const c of G.cars) {
      if (!c || typeof c.speed !== 'number') continue;
      nd = Math.min(nd, Math.hypot(c.x - G.player.x, c.z - G.player.z));
    }
    G.nearestCarD = nd;
    G.nearFish = FISH_SPOTS.some((s) => Math.hypot(G.player.x - s.x, G.player.z - s.z) < 8);
    G.nearPhoto = PHOTO_SPOTS.some((s) => Math.hypot(G.player.x - s.x, G.player.z - s.z) < 10 && !G.photosDone.includes(s.name));
    updatePlayer(G, dt);
    updateTraffic(G, dt);
    updatePeds(G, dt);
    updatePolice(G, dt);
    updateCombat(G, dt);
    updateMissions(G, dt);
    updateCityFn(G, dt);
    updateSky(G, dt);
    updateHud(G, dt);
    updateTouchUI(G);
    updateAudio(G, dt);
    shotTick(G);
  }
  updateCamera(G);
  G.renderer.render(G.scene, G.camera);
  window.__game = {
    phase: G.phase, wanted: G.wanted, cash: Math.floor(G.cash),
    mission: G.missionIdx, missionStage: G.missionStage, frames: G.frames, elapsed: G.elapsed,
    x: G.player.x, z: G.player.z, speed: G.player.speed,
    inCar: !!G.player.car, health: Math.round(G.health),
    fish: G.fishing ? G.fishing.needle : null,
    taxi: G.taxi ? G.taxi.stage : null, taxiX: G.taxi ? G.taxi.x : null, taxiZ: G.taxi ? G.taxi.z : null,
    race: G.race ? G.race.idx : null, courier: G.courier ? G.courier.t : null,
    photos: G.photosDone.length,
  };
  endFrameInput(G);
}
requestAnimationFrame(frame);
