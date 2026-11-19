// SOLARA BAY — boot, game loop, stealing/exiting cars, and the
// window.__game debug handle used by the automated playtest.
// Phases: title -> play -> pause / dead / busted / failed / won.
import { CFG } from './config.js';
import { mulberry32 } from './random.js';
import { createInput, isDown, wasPressed, endFrame, requestLock } from './input.js';
import { createAudio } from './audio.js';
import { buildCity, updateCityFx } from './city.js';
import { updatePlayerCar } from './vehicles.js';
import { initTraffic, updateTraffic, nearestParkedCar, nearestTrafficCar } from './traffic.js';
import { createPlayerMesh, placePlayer, updateOnFoot, updateCamera, syncPlayerToCar } from './player.js';
import { addWanted, updatePolice } from './police.js';
import { initCombat, updateCombat, updateEnemies } from './combat.js';
import { initMissions, startMission, updateMissions, currentMission } from './missions.js';
import { initHUD, showDialog, showObjective, toast, setPhase, updateHUD, saveGame, loadGame, clearSave } from './hud.js';
import { createWorld } from './render.js';
import { applyShot, tickShot } from './shots.js';

function stealCar(G, car, fromTraffic) {
  if (fromTraffic) {
    G.traffic = G.traffic.filter((t) => t.car !== car);
    addWanted(G, 1, 'mencuri mobil');
    G.stats.stolen = (G.stats.stolen || 0) + 1;
  }
  car.traffic = false;
  car.owned = true;
  G.car = car;
  G.inCar = true;
  syncPlayerToCar(G);
  G.audio.horn();
  toast(G, `Mobil dicuri — ${car.def.name}`);
}

function exitCar(G) {
  if (!G.car) return;
  const c = G.car;
  const side = { x: c.x + Math.cos(c.heading) * 2.2, z: c.z - Math.sin(c.heading) * 2.2 };
  G.inCar = false;
  G.player.mesh.visible = true;
  placePlayer(G, side.x, side.z, c.heading);
  G.audio.engine(0);
}

function boot() {
  const params = new URLSearchParams(location.search);
  const seed = parseInt(params.get('seed') || '1', 10) || 1;
  const shot = params.get('shot');
  const container = document.getElementById('game-container');
  const W = createWorld(container);
  const rng = mulberry32(seed);
  const G = {
    W, rng, seed,
    phase: 'title',
    player: { x: CFG.playerStart.x, z: CFG.playerStart.z, y: 0, vy: 0, heading: 0, walkPhase: 0, camYaw: Math.PI, camPitch: 0.22, camDist: 6.5, mesh: null },
    car: null, inCar: false,
    traffic: [], parked: [], peds: [],
    policeCars: [], policeFoot: [],
    enemies: [],
    wanted: 0, cash: 10350, health: 100, armor: 50,
    weapon: 2, ammo: {}, owned: {},
    timeOfDay: CFG.dayStart, day: 1,
    city: null, input: null, audio: null,
    stats: { time: 0, stolen: 0 },
    coinsGot: 0, kills: 0,
    lastSeen: 0, _panic: 0, _decayBucket: 0,
    _promptText: null, _nearRespray: false, _nearTaxi: false,
    _resprayKey: false, _talkKey: false, _taxiKey: false,
    shotMode: false, _shotFrames: 0, gameWon: false,
  };
  G.audio = createAudio();
  G.input = createInput(W.renderer.domElement);
  G.city = buildCity(W.scene, rng, W.renderer.capabilities.getMaxAnisotropy(), W.software);
  G.player.mesh = createPlayerMesh();
  W.scene.add(G.player.mesh);
  placePlayer(G, CFG.playerStart.x, CFG.playerStart.z, 0);
  G.showDialog = (s, r, t) => showDialog(G, s, r, t);
  G.showObjective = (t) => showObjective(G, t);
  G.toast = (t) => toast(G, t);
  initTraffic(G, rng);
  initCombat(G);
  initMissions(G);
  initHUD(G, {
    onNew: () => {
      clearSave();
      G.cash = 10350; G.health = 100; G.armor = 50; G.wanted = 0; G.day = 1; G.timeOfDay = CFG.dayStart;
      G.gameWon = false;
      startMission(G, 0);
      setPhase(G, 'play');
      requestLock(G.input);
      G.audio.unlock(); G.audio.startMusic();
    },
    onContinue: () => {
      const save = loadGame();
      if (save) {
        G.cash = save.cash; G.day = save.day || 1; G.coinsGot = save.coinsGot || 0;
        startMission(G, Math.min(save.missionIndex || 0, 7));
      } else startMission(G, 0);
      setPhase(G, 'play');
      requestLock(G.input);
      G.audio.unlock(); G.audio.startMusic();
    },
    onResume: () => { setPhase(G, 'play'); requestLock(G.input); },
    onRestartMission: () => {
      G.health = 100;
      startMission(G, G.missionIndex);
      setPhase(G, 'play');
    },
    onSaveQuit: () => { saveGame(G); setPhase(G, 'title'); },
    onRetry: () => {
      G.health = 100; G.armor = 50; G.wanted = 0;
      if (G.inCar) exitCar(G);
      placePlayer(G, CFG.playerStart.x, CFG.playerStart.z, 0);
      startMission(G, G.missionIndex);
      setPhase(G, 'play');
    },
    onRoam: () => { G.health = 100; G.wanted = 0; setPhase(G, 'play'); },
    onTitle: () => setPhase(G, 'title'),
  });

  if (shot) {
    applyShot(G, shot);
    setPhase(G, 'play');
  } else {
    setPhase(G, 'title');
    showDialog(G, 'Marco', 'SMUGGLER · WHEELMAN', 'Selamat datang di Solara Bay, Nico. Kota ini milik siapa yang berani ambil.');
  }

  window.__game = {
    get phase() { return G.phase; },
    get wanted() { return G.wanted; },
    get cash() { return G.cash; },
    get mission() { const m = currentMission(G); return m ? m.name : null; },
    get missionIndex() { return G.missionIndex; },
    get x() { return G.player.x; },
    get z() { return G.player.z; },
    get inCar() { return G.inCar; },
    get speed() { return G.car ? Math.abs(G.car.speed) : 0; },
    get health() { return G.health; },
    get timeOfDay() { return G.timeOfDay; },
    get rendererInfo() {
      return {
        software: !!G.W.software,
        calls: G.W.renderer.info.render.calls,
        triangles: G.W.renderer.info.render.triangles,
      };
    },
    teleport(x, z) {
      if (G.inCar && G.car) { G.car.x = x; G.car.z = z; G.car.group.position.set(x, 0, z); syncPlayerToCar(G); }
      else placePlayer(G, x, z, G.player.heading);
    },
    enterNearestCar() {
      const hit = nearestParkedCar(G, G.player.x, G.player.z, 6)
        || nearestTrafficCar(G, G.player.x, G.player.z, 6);
      if (!hit) return false;
      stealCar(G, hit.car, hit.kind === 'traffic');
      return true;
    },
  };

  let last = performance.now();
  let elapsed = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    elapsed += dt;
    const input = G.input;

    if (G.phase === 'title') {
      const a = elapsed * 0.03;
      W.camera.position.set(Math.cos(a) * 190, 95, Math.sin(a) * 190);
      W.camera.lookAt(-60, 0, 40);
      W.updateSky(G, dt, elapsed);
      updateCityFx(G.city, G, dt, elapsed);
      W.updateFx(dt);
    } else if (G.phase === 'play') {
      G.stats.time += dt;
      G.timeOfDay += dt / 40;
      if (G.timeOfDay >= 24) { G.timeOfDay -= 24; G.day++; }
      if (G._panic > 0) G._panic -= dt;

      if (wasPressed(input, 'Escape')) { G.phase = 'pause'; setPhase(G, 'pause'); }
      if (wasPressed(input, 'KeyM')) G.audio.setMuted(!G.audio.muted);

      G._resprayKey = false; G._talkKey = false; G._taxiKey = false;
      if (wasPressed(input, 'KeyE')) {
        G._resprayKey = true; G._talkKey = true; G._taxiKey = true;
        if (!G.shotMode) {
          if (G.inCar) exitCar(G);
          else {
            const nearMarco = Math.hypot(G.player.x - CFG.marcoPos.x, G.player.z - CFG.marcoPos.z) < 4;
            const nearGun = Math.hypot(G.player.x - CFG.gunShop.x, G.player.z - CFG.gunShop.z) < 8;
            if (G.missionIndex === 1 && nearMarco) { /* talk handled by missions */ }
            else if (nearGun) {
              if (!G.owned.breaker && G.cash >= 3800) {
                G.cash -= 3800; G.owned.breaker = true; G.ammo.breaker = 24;
                toast(G, 'BREAKER dibeli — $3,800 (tekan 4)');
                G.audio.jingle(true);
              } else if (G.cash >= 200) {
                G.cash -= 200;
                G.ammo.mako = Math.min(150, (G.ammo.mako || 0) + 60);
                G.ammo.vesper = Math.min(72, (G.ammo.vesper || 0) + 24);
                toast(G, 'Ammo dibeli — MAKO +60, VESPER +24 ($200)');
              } else toast(G, 'Uang tidak cukup — butuh $200');
            } else {
              const parked = nearestParkedCar(G, G.player.x, G.player.z, 4.5);
              const traffic = parked ? null : nearestTrafficCar(G, G.player.x, G.player.z, 4.5);
              if (parked) stealCar(G, parked.car, false);
              else if (traffic) stealCar(G, traffic.car, true);
            }
          }
        }
      }

      if (G.inCar && G.car) { updatePlayerCar(G, input, dt); syncPlayerToCar(G); }
      else updateOnFoot(G, input, dt);
      updateTraffic(G, dt, elapsed);
      updatePolice(G, dt, elapsed);
      updateCombat(G, input, dt);
      updateEnemies(G, dt);
      updateMissions(G, dt, elapsed);
      updateCityFx(G.city, G, dt, elapsed);
      W.updateSky(G, dt, elapsed);
      W.updateFx(dt);
      updateCamera(G, dt);
      updateHUD(G, dt);
      if (G._savedMission !== G.missionIndex) { G._savedMission = G.missionIndex; saveGame(G); }
      if (G.shotMode) { /* staged prompt stays */ }
      else if (G.inCar) G._promptText = 'E — Keluar mobil';
      else {
        const nearMarco = Math.hypot(G.player.x - CFG.marcoPos.x, G.player.z - CFG.marcoPos.z) < 4;
        const nearGun = Math.hypot(G.player.x - CFG.gunShop.x, G.player.z - CFG.gunShop.z) < 8;
        const nearCar = nearestParkedCar(G, G.player.x, G.player.z, 4.5)
          || nearestTrafficCar(G, G.player.x, G.player.z, 4.5);
        if (G._nearRespray && G.wanted > 0) G._promptText = `E — Respray $${G.wanted * CFG.resprayPerStar} (hapus bintang)`;
        else if (G.missionIndex === 1 && nearMarco) G._promptText = 'E — Bicara dengan Marco';
        else if (nearGun) G._promptText = 'E — Beli senjata di CAL’S GUNS';
        else if (nearCar) G._promptText = 'E — Curi mobil';
        else if (G._nearTaxi && !G.taxi.done) G._promptText = 'Dekati penumpang dengan mobil — tarif taksi';
        else G._promptText = null;
      }
      if (G.phase !== 'play') setPhase(G, G.phase);
    } else {
      W.updateSky(G, dt, elapsed);
      updateCityFx(G.city, G, dt, elapsed);
      W.updateFx(dt);
      updateCamera(G, dt);
      if (G.phase === 'pause') updateHUD(G, dt);
    }

    if (G.shotMode) tickShot(G);
    endFrame(input);
    W.renderer.render(W.scene, W.camera);
  }
  requestAnimationFrame(frame);
}

boot();
