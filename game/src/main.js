// SOLARA BAY boot + game loop: wires renderer, city, vehicles, traffic,
// player, police, combat, missions, HUD, audio, touch, screenshot scenes.
import * as THREE from 'three';
import { G, CFG } from './config.js';
import { reseed } from './random.js';
import { initInput, endFrame, pressed, keys } from './input.js';
import { initAudio, updateAudio } from './audio.js';
import { createWorld, updateSky } from './render.js';
import { buildCity, updateCity } from './city.js';
import { spawnParkedCars } from './vehicles.js';
import { initTraffic, updateTraffic, updatePeds } from './traffic.js';
import { initPlayer, updatePlayer, driveCarRef, exitCar } from './player.js';
import { updatePolice, setWanted } from './police.js';
import { updateCombat } from './combat.js';
import { initHud, updateHud, setPhaseUI, showDialog, saveGame, loadGame, hasSave, announce } from './hud.js';
import { initTouch, updateTouchUI } from './touch.js';
import { startMission, updateMissions, startTaxi, startRace, startCourierSide, toggleFishing, takePhoto } from './missions.js';
import { setupShot, shotTick } from './shots.js';

let last = performance.now();

function setPhase(p) {
  G.phase = p;
  setPhaseUI(p);
  if (p === 'play') initAudio();
}

function newGame() {
  G.cash = CFG.startCash; G.wanted = 0; G.health = 100; G.armor = 0;
  G.missionIdx = 0; G.missionStage = 0; G.day = 1; G.timeOfDay = 17.5;
  G.stats = { stolen: 0, missionsDone: 0, taxi: 0, races: 0, fish: 0, fishKinds: [], photos: [], courier: 0, kills: 0, distance: 0, playT: 0 };
  G.player.pos.set(CFG.startPos.x, 0, CFG.startPos.z);
  G.player.heading = 0; G.player.car = null; G.player.onFoot = true;
  startMission(0);
  setPhase('play');
  showDialog('Mara', 'MECHANIC', 'Nico! That pink VELOZ by the curb is yours. Take it, then bring it to my garage.');
}

function continueGame() {
  if (hasSave()) loadGame();
  startMission(G.missionIdx);
  setPhase('play');
}

function boot() {
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get('seed') || 8);
  G.seed = seed;
  reseed(seed);
  createWorld();
  buildCity();
  spawnParkedCars();
  initTraffic();
  initPlayer();
  initHud();
  initTouch();
  initInput(G.renderer.domElement);
  setPhase('title');
  window.__startNew = newGame;
  window.__startContinue = continueGame;
  window.__resume = () => setPhase('play');
  window.__restartMission = () => { startMission(G.missionIdx); setPhase('play'); };
  window.__quitToTitle = () => setPhase('title');
  window.__retry = () => { G.health = 100; G.wanted = 0; setPhase('play'); };
  window.__game = {
    get phase() { return G.phase; },
    get wanted() { return G.wanted; },
    get cash() { return G.cash; },
    get mission() { return G.missionIdx; },
    get frames() { return G.frames; },
    get elapsed() { return G.elapsed; },
    get x() { return G.player.pos.x; },
    get z() { return G.player.pos.z; },
    get speed() { const c = driveCarRef(); return c ? Math.abs(c.speed) * 3.6 : G.player.speed * 3.6; },
    get inCar() { return !!driveCarRef(); },
    get health() { return G.health; },
  };
  if (params.get('shot')) {
    G.shotMode = true;
    G.shotName = params.get('shot');
    setPhase('play');
    setupShot(G.shotName);
  }
  requestAnimationFrame(loop);
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  G.elapsed += dt;
  G.frames++;
  if (G.phase === 'play') {
    G.stats.playT += dt;
    G.timeOfDay += dt * 0.12; // full day ~3.3 min of play
    if (G.timeOfDay >= 24) { G.timeOfDay -= 24; G.day++; }
    if (pressed.Escape) { setPhase('pause'); }
    if (pressed.KeyT) startTaxi();
    if (pressed.KeyR && !G.race.active) startRace();
    if (pressed.KeyK) startCourierSide();
    if (pressed.KeyF) toggleFishing();
    if (pressed.KeyP) takePhoto();
    updatePlayer(dt);
    updateTraffic(dt);
    updatePeds(dt);
    updatePolice(dt);
    updateCombat(dt);
    updateMissions(dt);
    updateCity(dt);
    updateSky(dt);
    updateHud(dt);
    updateTouchUI();
    const car = driveCarRef();
    updateAudio(dt, car ? Math.abs(car.speed) / car.def.top : 0, !!car);
    if (G.shotMode) shotTick();
    if (G.health <= 0) setPhase('over');
    if (G.wanted >= 5 && G.phase === 'play' && Math.random() < dt * 0.002) setPhase('busted');
  } else if (G.phase === 'pause' && pressed.Escape) {
    setPhase('play');
  }
  if (G.phase === 'title') updateSky(dt * 0.2);
  G.renderer.render(G.scene, G.camera);
  endFrame();
}

boot();
