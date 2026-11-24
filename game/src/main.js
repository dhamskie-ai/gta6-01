// SOLARA BAY — boot, game loop, state machine, shot-mode staging.
import * as THREE from 'three';
import { G, CFG, resetRun, clamp } from './config.js';
import { RNG } from './random.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { initRender, updateSky, updateBursts } from './render.js';
import { buildCity, updateCityFx, districtAt } from './city.js';
import { velozCar, spawnParked, isCarObj } from './vehicles.js';
import { initTraffic, updateTraffic, updatePeds } from './traffic.js';
import { createPlayer, updatePlayer, driveCarRef } from './player.js';
import { updatePolice, setWanted } from './police.js';
import { updateCombat } from './combat.js';
import { startMission, updateMissions, spawnStoryNpcs, loadSave, applySave, hideBeacon } from './missions.js';
import { initHud, updateHud, showOnly, showDialog, setObjective, setPrompt, clearPrompt, toast } from './hud.js';
import { initTouch, updateTouchLabels } from './touch.js';
import { setupShot, stageShotDialog } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '8', 10) || 8;
G.seed = seed;
const shotScene = params.get('shot') || '';
G.shotMode = !!shotScene;

const canvas = document.getElementById('game');
const input = new Input();
const audio = new AudioSys();
window.__input = input; window.__audio = audio;
window.__hud = { showDialog, setObjective, setPrompt, clearPrompt, toast };
window.__beaconOff = hideBeacon;

function boot() {
  initRender(canvas);
  input.attach(canvas);
  const rng = new RNG(seed);
  buildCity();
  createPlayer();
  const v = velozCar();
  spawnParked(rng);
  initTraffic(rng);
  spawnStoryNpcs();
  initHud();
  initTouch();
  startMission(0);
  G.camYaw = Math.PI;
  if (G.shotMode) {
    setupShot(shotScene);
    showOnly('hud');
  } else {
    showOnly('title');
  }
  window.__game = snapshot();
  requestAnimationFrame(loop);
}
function snapshot() {
  const p = G.player;
  return {
    phase: G.phase, wanted: G.wanted, cash: Math.round(G.cash),
    mission: G.msn.idx + 1, stage: G.msn.stage + 1,
    x: p ? +p.x.toFixed(1) : 0, z: p ? +p.z.toFixed(1) : 0,
    inCar: !!(p && p.car), speedKmh: p && p.car ? Math.round(Math.abs(p.car.speed) * 3.6) : 0,
    heading: p ? +p.heading.toFixed(3) : 0,
    car: (p && p.car) ? p.car.name : '',
    health: Math.round(G.health), time: +G.timeOfDay.toFixed(2), day: G.day,
    district: p ? districtAt(p.x, p.z) : '',
  };
}
window.__startNew = () => {
  resetRun();
  const p = G.player;
  p.x = CFG.spawnPos[0]; p.z = CFG.spawnPos[1]; p.heading = Math.PI; p.car = null;
  p.group.visible = true; p.group.position.set(p.x, 0, p.z);
  const v = G.cars.find((c) => c.isPlayerCar);
  if (v) { v.x = CFG.velozPos[0]; v.z = CFG.velozPos[1]; v.heading = Math.PI; v.speed = 0; v.hp = 100; v.group.position.set(v.x, 0, v.z); }
  G.timeOfDay = 17.5; G.camYaw = Math.PI;
  startMission(0);
  G.phase = 'play';
  showOnly('hud');
  showDialog('Sal Vega', 'FIXER', MISSIONS_BRIEF_1, 6000);
  audio.ensure();
};
const MISSIONS_BRIEF_1 = "Sal Vega: Nico. You're back. Steal the pink Veloz and bring it to Mara's garage. Don't get cute.";
window.__startContinue = () => {
  const s = loadSave();
  resetRun();
  if (s) applySave(s);
  G.phase = 'play';
  showOnly('hud');
  audio.ensure();
};

function updateHeadlight() {
  if (!G.headlight) {
    const s = new THREE.SpotLight(0xfff2b0, 0, 70, 0.55, 0.5, 1.2);
    G.scene.add(s); G.scene.add(s.target);
    G.headlight = s;
  }
  const car = driveCarRef();
  const on = !!car && G.nightF > 0.35;
  G.headlight.intensity = on ? 120 : 0;
  if (car) {
    const f = Math.sin(car.heading), fz = Math.cos(car.heading);
    G.headlight.position.set(car.x + f * 2, 1.2, car.z + fz * 2);
    G.headlight.target.position.set(car.x + f * 25, 0.5, car.z + fz * 25);
  }
}
let last = performance.now();
let shotFrames = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = clamp((now - last) / 1000, 0.001, 0.05);
  last = now;
  G.elapsed += dt;
  G.frame++;
  if (G.phase === 'title') {
    // Slow orbit over the city behind the title screen.
    const a = G.elapsed * 0.05;
    G.camera.position.set(Math.cos(a) * 260, 90, Math.sin(a) * 260);
    G.camera.lookAt(0, 0, 0);
    updateSky(dt);
    updateCityFx(dt);
    updateBursts(dt);
    G.renderer.render(G.scene, G.camera);
    input.endFrame();
    return;
  }
  if (G.phase === 'play') {
    if (!G.shotMode) {
      G.timeOfDay += dt * 0.008;
      if (G.timeOfDay >= 24) { G.timeOfDay -= 24; G.day++; }
      G.stats.playTime += dt;
    }
    if (input.wasPressed('Escape')) { G.phase = 'pause'; showOnly('pause'); }
    if (input.wasPressed('KeyM')) {
      G.muted = !G.muted; audio.setMuted(G.muted);
      const b = document.getElementById('muteBtn');
      if (b) b.textContent = G.muted ? '🔇' : '🔊';
    }
    updatePlayer(dt, input, audio);
    updateHeadlight();
    updateTraffic(dt, audio);
    updatePeds(dt);
    updatePolice(dt, audio);
    updateCombat(dt, input, audio);
    updateMissions(dt);
    updateCityFx(dt);
    updateSky(dt);
    updateBursts(dt);
    audio.music(dt);
    updateTouchLabels();
    // Shot-mode staging: keep the chase flank pose after updatePolice,
    // and re-stage dialogs that time out before SwiftShader frames land.
    if (G.shotMode) {
      stageShotDialog();
      if (G.shotScene === 'chase') {
        const v = G.cars.find((c) => c.isPlayerCar);
        const cars = G.police.filter((u) => u.kind === 'car');
        if (v && cars[0]) { cars[0].car.x = v.x - 3.5; cars[0].car.z = v.z - 6; cars[0].x = v.x - 3.5; cars[0].z = v.z - 6; cars[0].car.heading = Math.PI; cars[0].car.group.position.set(cars[0].car.x, 0, cars[0].car.z); }
        if (v && cars[1]) { cars[1].car.x = v.x + 3.5; cars[1].car.z = v.z + 7; cars[1].x = v.x + 3.5; cars[1].z = v.z + 7; cars[1].car.heading = Math.PI; cars[1].car.group.position.set(cars[1].car.x, 0, cars[1].car.z); }
      }
      shotFrames++;
      if (shotFrames >= 3) window.__shotReady = true;
    }
    updateHud(dt);
    window.__game = snapshot();
  } else if (G.phase === 'pause') {
    if (input.wasPressed('Escape')) { G.phase = 'play'; showOnly('hud'); }
    updateHud(dt);
  } else if (G.phase === 'over') {
    updateHud(dt);
    updateSky(dt);
  }
  if (G.phase !== 'title') G.renderer.render(G.scene, G.camera);
  input.endFrame();
}
boot();
