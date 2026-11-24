// SOLARA BAY boot + game loop: builds the world, wires every system,
// runs the state machine (title / playing / paused / over / missionEnd),
// exposes window.__game for playtests and ?shot= scenes for screenshots.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { mulberry32 } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { createCarMesh, spawnPlayerCar, updateCar } from './vehicles.js';
import { initTraffic } from './traffic.js';
import { createPlayerMesh, updateOnFoot, tryStealCar } from './player.js';
import { createPolice } from './police.js';
import { createCombat, updateCombat, playerAttack } from './combat.js';
import { createMissions, MISSIONS } from './missions.js';
import { createHud, saveGameData, loadGameData } from './hud.js';
import { createWorldRenderer } from './render.js';
import { setupShot } from './shots.js';
import { createTouch } from './touch.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 8);
const shotName = params.get('shot');
const forceTouch = params.get('touch') === '1';

const canvas = document.getElementById('game');
const R = createWorldRenderer(canvas);
const rng = mulberry32(seed);

const S = {
  scene: R.scene, camera: R.camera, renderer: R.renderer, rng, elapsed: 0,
  phase: 'title', timeHours: CONFIG.startHour, frame: 0, shotName,
  stats: { missionsDone: 0, stolen: 0, coins: 0, maxWanted: 0, playSeconds: 0 },
  player: null, cars: [], police: null, combat: null, missions: null, hud: null,
  audio: createAudio(), input: createInput(canvas), city: null, traffic: null,
  touchMode: forceTouch || 'ontouchstart' in window,
};

S.city = buildCity(R.scene, rng);
S.traffic = initTraffic(R.scene, rng, S.city);
S.player = createPlayerMesh(R.scene);
S.player.cash = 0; S.player.hp = 100; S.player.armor = 0; S.player.weapon = 'fists'; S.player.ammo = 12;
S.player.yaw = 0; S.player.inCar = false; S.player.car = null; S.player.velY = 0; S.player.nearMarco = false;
S.police = createPolice(R.scene, rng);
S.combat = createCombat(R.scene, rng);
S.missions = createMissions(S);
S.missions.spawnCoins();
S.hud = createHud(S);
createTouch(S);
S.cars = [...S.traffic.cars, ...S.traffic.parked];
spawnPlayerCar(S, 'sport', 0xd81e5b, -100, -100);

S.newGame = () => {
  S.hud.el.title.classList.add('hidden');
  S.player.cash = 0; S.player.hp = 100; S.player.armor = 0;
  S.missions.current = 0; S.stats = { missionsDone: 0, stolen: 0, coins: 0, maxWanted: 0, playSeconds: 0 };
  S.resetPlayer();
  S.phase = 'playing';
  S.missions.start(0);
};
S.resumeFromSave = () => {
  S.hud.el.title.classList.add('hidden');
  S.phase = 'playing';
  S.missions.start(Math.min(S.missions.current, MISSIONS.length - 1));
};
S.loadGame = () => {
  const d = loadGameData();
  if (!d) return false;
  S.player.cash = d.cash; S.player.hp = d.hp; S.player.armor = d.armor;
  S.missions.current = d.mission; S.missions.collected = d.coins || 0; S.stats = d.stats || S.stats;
  S.player.mesh.position.set(d.x || 0, 0, d.z || 0);
  return true;
};
S.saveGame = () => saveGameData(S);
S.resetPlayer = () => {
  S.player.hp = 100; S.player.armor = Math.max(S.player.armor, 0);
  S.player.mesh.position.set(-96, 0, -96); S.player.yaw = 0;
  if (S.player.inCar && S.player.car) { S.player.inCar = false; S.player.car = null; }
  S.police.clearWanted(S); S.combat.clearEnemies();
  S.player.mesh.visible = true;
};
S.gameOver = (title, text) => { if (S.phase === 'playing') S.hud.showGameOver(title, text); };
S.togglePause = (show) => {
  if (S.phase !== 'playing' && S.phase !== 'paused') return;
  S.phase = show ? 'paused' : 'playing';
  S.hud.showPause(show);
};
S.spawnShowCar = () => {
  const car = createCarMesh('sport', 0xffd23f);
  car.group.position.set(96, 0, -96); car.group.rotation.y = Math.PI / 4;
  car.driver = 'parked'; car.isShowCar = true;
  R.scene.add(car.group); S.cars.push(car);
};

// Shot scenes: set up deterministically, then signal readiness.
let shotApplied = false;
if (shotName) {
  S.phase = 'playing';
  S.hud.el.title.classList.add('hidden');
  if (S.touchMode || forceTouch) document.getElementById('touch').style.display = 'block';
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  S.elapsed += dt; S.frame++;
  const input = S.input;

  if (shotName && !shotApplied) { setupShot(S, shotName); shotApplied = true; }

  if (S.phase === 'playing') {
    S.stats.playSeconds += dt;
    S.timeHours = (S.timeHours + dt / (CONFIG.dayLengthSec / 24)) % 24;
    if (input.wasPressed('Escape')) S.togglePause(true);
    if (input.wasPressed('KeyM')) { S.audio.setMuted(!S.audio.muted); S.hud.showPrompt(S.audio.muted ? 'Muted' : 'Sound on'); }
    if (input.wasPressed('Digit1')) S.player.weapon = 'fists';
    if (input.wasPressed('Digit2')) S.player.weapon = 'pistol';
    if (input.wasPressed('KeyR') && S.player.weapon === 'pistol' && !S.player.inCar) { S.player.ammo = 12; S.audio.click(); }
    if (input.wasPressed('KeyC')) R.cycleCamera();
    if (input.wasPressed('KeyE') || input.touch.e) tryStealCar(S);
    if (input.firing || input.touch.fire) playerAttack(S);
    if (S.player.inCar && S.player.car) {
      const car = S.player.car;
      updateCar(S, car, dt);
      S.audio.engineStart(); S.audio.engineUpdate(Math.abs(car.speed) / 46);
      S.player.mesh.position.copy(car.group.position);
      S.player.mesh.visible = false;
    } else {
      updateOnFoot(S, dt);
      S.audio.engineStop();
    }
    S.traffic.update(S, dt);
    S.police.update(S, dt);
    updateCombat(S, dt);
    S.missions.update(dt);
    S.missions.collectCoins();
    S.audio.sirenUpdate(S.elapsed);
    if (S.police.wanted > 0) S.audio.sirenStart(); else S.audio.sirenStop();
  } else if (S.phase === 'paused') {
    if (input.wasPressed('Escape')) S.togglePause(false);
  }
  R.update(S, dt);
  S.hud.update(dt);
  if (S.city.wheel) S.city.wheel.rotation.z += dt * 0.15;
  S.renderer.render(S.scene, S.camera);
  input.endFrame();

  if (shotName && shotApplied && S.frame > 4 && !window.__shotReady) window.__shotReady = true;
}
animate();

window.__game = {
  get phase() { return S.phase; },
  get wanted() { return S.police.wanted; },
  get cash() { return S.player.cash; },
  get mission() { return MISSIONS[S.missions.current]?.name || ''; },
  get missionStage() { return S.missions.stage; },
  get hp() { return S.player.hp; },
  get x() { return S.player.mesh.position.x; },
  get z() { return S.player.mesh.position.z; },
  get speed() { return S.player.inCar && S.player.car ? Math.abs(S.player.car.speed) * 3.6 : 0; },
  get inCar() { return S.player.inCar; },
  get coins() { return S.missions.collected; },
  get enemies() { return S.combat.enemies.length; },
  get traffic() { return S.traffic.cars.length; },
  get peds() { return S.traffic.peds.length; },
  start() { S.newGame(); },
};
