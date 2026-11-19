// SOLARA BAY — boot, game loop, state machine, wiring antar sistem.
// Satu objek dunia (W) dibagikan semua modul; modul tak saling import
// kecuali lewat W (menghindari circular import).
import * as THREE from 'three';
import { CFG } from './config.js';
import { createInput } from './input.js';
import { createTouch } from './touch.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { createPlayer, updatePlayer } from './player.js';
import { createPolice, updatePolice } from './police.js';
import { createCombat, updateCombat } from './combat.js';
import { createMissions, startMission, updateMissions } from './missions.js';
import { createHud, updateHud, saveGame, applySave, loadSave } from './hud.js';
import { createRenderer, updateSky, renderFrame } from './render.js';
import { applyShot, shotTick } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || CFG.seed) || 1;
window.__shotReady = false;

const W = {
  three: THREE, seed, state: 'title', elapsed: 0, hour: CFG.startHour,
  cash: CFG.startCash, health: 100, armor: 0, respect: 0, radioTrack: 0,
  garage: [], stats: { stolen: 0, coins: 0, maxWanted: 0, time: 0 },
  cars: { list: [] }, shotMode: params.has('shot'), shotHold: null,
  shotFrames: 0, startedOnce: false,
};
W.audio = createAudio();
W.saveGame = () => saveGame(W);
W.startMission = (w, i) => startMission(w, i);
W.showDead = (title, text) => {
  if (W.state === 'dead') return;
  W.state = 'dead';
  W.audio.fail();
  W.audio.siren(false);
  W.audio.engine(false);
  document.getElementById('dead-title').textContent = title;
  document.getElementById('dead-text').textContent = text;
  W.hud.setScreen('dead');
};
W.die = (reason) => {
  if (W.state !== 'playing') return;
  const title = reason === 'DITANGKAP' ? 'DITANGKAP' : 'K.O.';
  W.showDead(title, reason === 'DITANGKAP'
    ? 'PCPD menangkapmu. Misi diulang dari checkpoint.'
    : 'Nico tumbang. Misi diulang dari checkpoint.');
};
W.endGame = (text) => {
  W.state = 'end';
  W.audio.jingle();
  document.getElementById('end-text').textContent = text;
  W.hud.setScreen('end');
  W.saveGame();
};
W.resetRun = () => {
  // Reset lunak untuk New Game / retry tanpa reload halaman.
  const P = W.player;
  if (P.car) { P.car.driver = 'parked'; P.car.speed = 0; P.car = null; P.group.visible = true; }
  P.x = CFG.spawn.x; P.z = CFG.spawn.z; P.y = 0; P.vy = 0;
  P.heading = CFG.spawn.heading; P.camYaw = CFG.spawn.heading;
  P.group.position.set(P.x, 0, P.z);
  W.police.wanted = 0; W.police.heat = 0;
  for (const u of W.police.cars) W.scene.remove(u.car.group);
  for (const c of W.police.cops) W.scene.remove(c.group);
  W.police.cars = []; W.police.cops = [];
  for (const e of W.combat.enemies) if (!e.dead) W.scene.remove(e.group);
  W.combat.enemies = [];
  W.health = 100; W.armor = 0; W.cash = CFG.startCash;
  W.hour = CFG.startHour; W.respect = 0; W.garage = [];
  W.stats = { stolen: 0, coins: 0, maxWanted: 0, time: 0 };
};
W.newGame = () => {
  W.resetRun();
  W.state = 'playing';
  W.startedOnce = true;
  W.audio.ensure();
  W.audio.setMusic(true, 0);
  W.hud.setScreen('');
  W.input.lock();
  startMission(W, 0);
};
W.continueGame = () => {
  const save = loadSave();
  W.resetRun();
  W.state = 'playing';
  W.startedOnce = true;
  W.audio.ensure();
  W.audio.setMusic(true, 0);
  W.hud.setScreen('');
  W.input.lock();
  if (save) applySave(W, save);
  else startMission(W, 0);
};
W.resumeGame = () => {
  if (W.state !== 'paused' && W.state !== 'dead') return;
  W.state = 'playing';
  W.hud.setScreen('');
  W.input.lock();
};
W.toTitle = () => {
  W.state = 'title';
  W.saveGame();
  W.hud.setScreen('title');
};

// --- Boot: renderer dulu (canvas), lalu semua sistem ---
createRenderer(W);
W.input = createInput(W.renderer.domElement);
W.input.attach();
buildCity(W);
createTraffic(W);
createPlayer(W);
createPolice(W);
createCombat(W);
createMissions(W);
createHud(W);
W.touch = createTouch(W);
W.ready = true;

// --- Loop ---
let last = performance.now();
let hudT = 0;
let titleAngle = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, Math.max(0.001, (now - last) / 1000));
  last = now;
  if (W.state === 'playing') {
    W.elapsed += dt;
    W.stats.time += dt;
    W.hour += dt / CFG.hourLength;
    if (W.hour >= 24) W.hour -= 24;
    if (W.input.action('pause')) {
      W.state = 'paused';
      document.getElementById('pause-info').textContent =
        `JOB ${W.missions.current + 1}/8 · $${W.cash} · ${Math.floor(W.stats.time / 60)} menit main`;
      W.hud.setScreen('pause');
      if (document.pointerLockElement) document.exitPointerLock();
    } else if (W.input.action('mute')) {
      W.audio.setMuted(!W.audio.isMuted());
      W.hud.toast(W.audio.isMuted() ? 'Suara: mute' : 'Suara: on');
    } else {
      try {
        updatePlayer(W, dt);
        updateTraffic(W, dt);
        updatePolice(W, dt);
        updateCombat(W, dt);
        updateMissions(W, dt);
        updateSky(W, dt);
      } catch (err) { console.error('[frame]', err); }
    }
    hudT += dt;
    if (hudT > 0.1) {
      hudT = 0;
      try { updateHud(W); } catch (err) { console.error('[hud]', err); }
    }
  } else if (W.state === 'title') {
    // Backdrop title: kamera mengorbit pelan di atas Malecón.
    titleAngle += dt * 0.05;
    const cx = -260 + Math.sin(titleAngle) * 40;
    const cz = 40 + Math.cos(titleAngle) * 60;
    W.camera.position.set(cx, 42, cz);
    W.camera.lookAt(-240, 4, 40);
    updateSky(W, dt);
    updateTraffic(W, dt);
  } else {
    updateSky(W, dt);
  }
  W.input.endFrame();
  if (W.touch && W.touch.active) W.touch.setEnterLabel(!!W.player.car);
  // State ringkas untuk playtest + shot.
  const P = W.player;
  const mc = W.traffic.missionCar;
  window.__game = {
    ready: W.ready, state: W.state,
    px: +(P.car ? P.car.x : P.x).toFixed(2),
    pz: +(P.car ? P.car.z : P.z).toFixed(2),
    driving: !!P.car, car: P.car ? P.car.kind : null,
    speed: P.car ? Math.round(Math.abs(P.car.speed) * 3.6) : 0,
    cash: W.cash, wanted: W.police.wanted, health: Math.round(W.health),
    mission: W.missions.current, stage: W.missions.stage,
    hour: +W.hour.toFixed(2),
    distToMissionCar: mc ? +Math.hypot((P.car ? P.car.x : P.x) - mc.x, (P.car ? P.car.z : P.z) - mc.z).toFixed(1) : -1,
    touchActive: !!(W.touch && W.touch.active),
  };
  if (W.shotMode) shotTick(W);
  renderFrame(W);
}
requestAnimationFrame(frame);
// Mode shot: lewati title, langsung atur scene.
if (W.shotMode) applyShot(W);
