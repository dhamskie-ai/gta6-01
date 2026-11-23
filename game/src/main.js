// SOLARA BAY — boot, game loop, state machine, wiring.
// The world state lives in G. Note: the mission state is G.msn —
// never G.mission (a property by that name once shadowed the object).
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng, clamp } from './random.js';
import { createInput, bindInput, endFrameInput, wasPressed, isDown } from './input.js';
import { createAudio, ensureAudio, setMuted, updateAudio, sfxClick, sfxCoin } from './audio.js';
import { createRenderer, updateSky, updateCamera } from './render.js';
import { buildCity, updateCityFx, collide } from './city.js';
import { spawnWorld, updateTraffic } from './traffic.js';
import { spawnPlayer, updatePlayer, nearestCar, driveCarRef } from './player.js';
import { updatePolice, setWanted } from './police.js';
import { initCombat, updateCombat } from './combat.js';
import { initMissions, startMission, updateMissions } from './missions.js';
import { initHud, updateHud, saveGame, loadSave, showDialog } from './hud.js';
import { initTouch, updateTouchLabels } from './touch.js';
import { applyShot, shotTick } from './shots.js';

const params = new URLSearchParams(location.search);
const SEED = parseInt(params.get('seed') || '1', 10) || 1;
const SHOT = params.get('shot');
const G = {
  phase: 'title', t: 0, timeOfDay: 12, day: 1,
  cash: CFG.startCash, wanted: 0, heat: 0, lastSeenT: 0,
  rng: makeRng(SEED), seed: SEED,
  player: { x: CFG.spawn.x, z: CFG.spawn.z, y: 0, vy: 0, heading: CFG.spawn.heading,
    health: CFG.startHealth, armor: CFG.startArmor, onFoot: true, car: null,
    mesh: null, weapon: 1, ammo: [], fireT: 0, moving: false, run: false },
  cars: [], traffic: [], peds: [], parked: [], cops: [], guards: [],
  msn: { idx: 0, step: 0, timer: 0, active: false, stepT: 0, followT: 0, race: null },
  stats: { missionsDone: 0, stolen: 0, coins: 0, taxi: 0, fish: 0, photos: 0 },
  camYaw: CFG.spawn.heading, camDist: 9, camHeight: 0,
  input: createInput(), audio: createAudio(),
  shotMode: false, shotScene: null, touchMode: false,
  showFps: false, fps: 0, quality: 'High',
  hudMsg: '', objective: '', nearInteract: null, nearCar: null,
  gunfireT: 0, _policeSeq: 0, city: null, fx: null, el: {},
};
window.__G = G;

function resetWorld(G) {
  // fresh state for New Game (in place — no reload, keeps the seed)
  G.cash = CFG.startCash; G.wanted = 0; G.heat = 0; G.day = 1; G.timeOfDay = 12;
  G.stats = { missionsDone: 0, stolen: 0, coins: 0, taxi: 0, fish: 0, photos: 0 };
  G.player.health = CFG.startHealth; G.player.armor = CFG.startArmor;
  G.player.weapon = 1;
  for (const u of [...G.cops]) {
    if (u.car) { G.fx.scene.remove(u.car.mesh); G.cars.splice(G.cars.indexOf(u.car), 1); }
    if (u.foot) G.fx.scene.remove(u.mesh);
  }
  G.cops = [];
  for (const gd of [...G.guards]) { G.fx.scene.remove(gd.mesh); }
  G.guards = [];
  if (G.courier) {
    G.fx.scene.remove(G.courier.car.mesh);
    G.cars.splice(G.cars.indexOf(G.courier.car), 1);
    G.courier = null;
  }
  if (G.veloz) {
    G.veloz.x = CFG.velozPos.x; G.veloz.z = CFG.velozPos.z;
    G.veloz.heading = Math.PI; G.veloz.speed = 0; G.veloz.hp = 100;
    G.veloz.driver = 'parked'; G.veloz.owner = undefined;
    G.veloz.mesh.position.set(CFG.velozPos.x, 0, CFG.velozPos.z);
    G.veloz.mesh.rotation.y = Math.PI;
  }
  if (G.city) for (const c of G.city.coins) { c.taken = false; c.mesh.visible = true; }
  spawnPlayer(G);
  startMission(G, 0);
}
function startNewGame() {
  ensureAudio(G.audio);
  if (G.audio) sfxClick(G.audio);
  resetWorld(G);
  G.phase = 'play';
  showTitle(false);
  showDialog(G, 'Sal Vega: Nico, the VELOZ is parked on the Malecón. Take it, bring it to Mara\'s garage.');
}
function continueGame() {
  ensureAudio(G.audio);
  const save = loadSave();
  resetWorld(G);
  if (save) {
    G.cash = save.cash ?? CFG.startCash;
    G.stats.missionsDone = save.missionsDone || 0;
    G.stats.coins = save.coins || 0;
    G.stats.taxi = save.taxi || 0;
    G.stats.fish = save.fish || 0;
    G.stats.photos = save.photos || 0;
    G.player.health = save.health ?? CFG.startHealth;
    G.player.armor = save.armor ?? 0;
    startMission(G, clamp(save.msnIdx || 0, 0, 7));
  }
  G.phase = 'play';
  showTitle(false);
}
function showTitle(show) {
  if (G.el.titleScreen) G.el.titleScreen.classList.toggle('hidden', !show);
  if (G.el.pauseScreen) G.el.pauseScreen.classList.add('hidden');
  if (G.el.overScreen) G.el.overScreen.classList.add('hidden');
}
function pauseGame() {
  if (G.phase !== 'play') return;
  G.phase = 'pause';
  if (G.el.pauseScreen) G.el.pauseScreen.classList.remove('hidden');
  document.exitPointerLock?.();
}
function resumeGame() {
  if (G.phase !== 'pause') return;
  G.phase = 'play';
  if (G.el.pauseScreen) G.el.pauseScreen.classList.add('hidden');
}
function restartMission() {
  if (G.el.pauseScreen) G.el.pauseScreen.classList.add('hidden');
  startMission(G, G.msn.idx);
  G.player.health = CFG.startHealth;
  G.phase = 'play';
}
function quitToTitle() {
  G.phase = 'title';
  showTitle(true);
}
function retryGame() {
  G.player.health = CFG.startHealth;
  startMission(G, G.msn.idx);
  spawnPlayer(G);
  G.phase = 'play';
  showTitle(false);
}
function setQuality(q) {
  G.quality = q;
  try { localStorage.setItem('solara-quality', q); } catch { /* ignore */ }
  const r = G.fx.renderer;
  const pr = q === 'Low' ? 1 : q === 'Medium' ? 1.5 : 2;
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, pr));
  r.shadowMap.enabled = q !== 'Low';
  G.fx.sun.castShadow = q !== 'Low';
}
G.startNewGame = startNewGame;
G.continueGame = continueGame;
G.resumeGame = resumeGame;
G.restartMission = restartMission;
G.quitToTitle = quitToTitle;
G.retryGame = retryGame;
G.setQuality = setQuality;
G.saveGame = () => saveGame(G);
G.toggleMute = () => {
  ensureAudio(G.audio);
  setMuted(G.audio, !G.audio.muted);
  if (G.el.muteBtn) G.el.muteBtn.textContent = G.audio.muted ? '🔇' : '🔊';
};

// --- boot ---
createRenderer(G);
buildCity(G);
spawnWorld(G);
spawnPlayer(G);
initCombat(G);
initMissions(G);
initHud(G);
initTouch(G);
bindInput(G.input, G.fx.renderer.domElement);
try { setQuality(localStorage.getItem('solara-quality') || 'High'); } catch { setQuality('High'); }
if (G.el.qualitySelect) G.el.qualitySelect.value = G.quality;
const saved = loadSave();
if (G.el.btnContinue) G.el.btnContinue.classList.toggle('hidden', !saved);
if (SHOT) {
  applyShot(G, SHOT);
  showTitle(false);
} else {
  showTitle(true);
}
window.__game = {
  phase: G.phase, wanted: 0, cash: G.cash, msn: 0, step: 0,
  x: G.player.x, z: G.player.z, inCar: false, speed: 0, health: 100,
};

// --- main loop ---
let last = performance.now();
let fpsAcc = 0, fpsN = 0, fpsT = 0;
let dynT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const rawDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const dt = Math.min(rawDt, 0.05);
  G.t += dt;
  // fps meter + dynamic resolution (never in shot mode)
  fpsAcc += 1 / Math.max(0.001, rawDt); fpsN++; fpsT += rawDt;
  if (fpsT > 1) { G.fps = fpsAcc / fpsN; fpsAcc = 0; fpsN = 0; fpsT = 0; }
  if (!G.shotMode && G.phase === 'play') {
    dynT += dt;
    if (dynT > 4) {
      dynT = 0;
      const r = G.fx.renderer;
      const cur = r.getPixelRatio();
      if (G.fps < 42 && cur > 1) r.setPixelRatio(Math.max(1, cur - 0.25));
      else if (G.fps > 57 && cur < 2 && G.quality !== 'Low') r.setPixelRatio(Math.min(2, cur + 0.25));
    }
  }
  // day/night cycle: full day = 10 real minutes
  G.timeOfDay += dt * (24 / 600);
  if (G.timeOfDay >= 24) { G.timeOfDay -= 24; G.day++; }
  if (G.phase === 'play') {
    if (wasPressed(G.input, 'Escape')) pauseGame();
    if (wasPressed(G.input, 'KeyM')) G.toggleMute();
    if (wasPressed(G.input, 'F3')) G.showFps = !G.showFps;
    G.nearCar = G.player.onFoot ? nearestCar(G, 3.5) : null;
    updatePlayer(G, dt);
    updateTraffic(G, dt);
    updatePolice(G, dt);
    updateCombat(G, dt);
    updateMissions(G, dt);
    // sun coins
    if (G.city) {
      for (const c of G.city.coins) {
        if (c.taken) continue;
        const dx = G.player.x - c.x, dz = G.player.z - c.z;
        if (dx * dx + dz * dz < 2.25) {
          c.taken = true; c.mesh.visible = false;
          G.cash += 5; G.stats.coins++;
          G.hudMsg = 'Sun coin +$5';
          if (G.audio) sfxCoin(G.audio);
        }
      }
    }
    if (G.player.health <= 0 && G.phase === 'play') {
      G.phase = 'dead';
      if (G.el.overTitle) G.el.overTitle.textContent = 'K.O.';
      if (G.el.overText) G.el.overText.textContent = 'Nico is down. The crew will patch you up — retry the mission.';
      if (G.el.overScreen) G.el.overScreen.classList.remove('hidden');
      document.exitPointerLock?.();
    }
    updateTouchLabels(G);
  }
  updateCityFx(G, dt);
  updateSky(G, dt);
  if (G.phase === 'play') {
    updateAudio(G.audio, G, dt);
    updateHud(G, dt);
    if (G.shotMode) shotTick(G);
    updateCamera(G, G.shotMode ? 1 : 0);
  } else {
    // title/pause/dead: slow orbit around the Malecón
    const fx = G.fx;
    const a = G.t * 0.05;
    fx.camera.position.set(-240 + Math.cos(a) * 40, 18, 80 + Math.sin(a) * 40);
    fx.camera.lookAt(-240, 2, 60);
    updateHud(G, dt);
  }
  G.fx.renderer.render(G.fx.scene, G.fx.camera);
  // expose state for playtests
  const car = driveCarRef(G);
  window.__game = {
    phase: G.phase, wanted: G.wanted, cash: Math.round(G.cash),
    msn: G.msn.idx, step: G.msn.step, timer: Math.round(G.msn.timer || 0),
    x: Math.round(G.player.x * 10) / 10, z: Math.round(G.player.z * 10) / 10,
    heading: Math.round(G.player.heading * 100) / 100,
    inCar: !!car, speed: car ? Math.round(Math.abs(car.speed) * 3.6) : 0,
    health: Math.round(G.player.health), onFoot: G.player.onFoot,
    missionsDone: G.stats.missionsDone,
  };
  if (G.shotMode) {
    G.shotFrames = (G.shotFrames || 0) + 1;
    if (G.shotFrames >= 3) window.__shotReady = true;
  }
  if (G.hudMsg) { G.hudMsg = ''; }
  endFrameInput(G.input);
  if (G.touch) G.touch.camDX = 0;
}
requestAnimationFrame(loop);
