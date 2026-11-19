import { CFG } from './config.js';
import { mulberry32 } from './random.js';
import { createInput, isDown, wasPressed, endFrame, requestLock } from './input.js';
import { createAudio } from './audio.js';
import { buildCity, updateCityFx } from './city.js';
import { updatePlayerCar } from './vehicles.js';
import { initTraffic, updateTraffic, nearestParkedCar, nearestTrafficCar } from './traffic.js';
import { createPlayerMesh, createPersonMesh, placePlayer, updateOnFoot, updateCamera, syncPlayerToCar } from './player.js';
import { addWanted, updatePolice } from './police.js';
import { initCombat, updateCombat, updateEnemies } from './combat.js';
import { initMissions, startMission, updateMissions, currentMission } from './missions.js';
import { initHUD, showDialog, showObjective, toast, setPhase, updateHUD, saveGame, loadGame, clearSave } from './hud.js';
import { createWorld } from './render.js';
import { applyShot, tickShot } from './shots.js';

function stealCar(G, car, fromTraffic) {
  G.parked = G.parked.filter((c) => c !== car);
  G.traffic = G.traffic.filter((t) => t.car !== car);
  if (fromTraffic) {
    const driver = createPersonMesh({ shirt: 0xd95f5f, pants: 0x2e3440, skin: 0xc98d64, hair: 0x14100c });
    driver.position.set(car.x + 2, 0, car.z + 2);
    G.W.scene.add(driver);
    G.peds.push({ mesh: driver, x: car.x + 2, z: car.z + 2, axis: 'x', side: 1, dir: 1, speed: 1.5, flee: 4, walkPhase: 0, name: 'Driver', hp: 30 });
  }
  car.isPlayer = true;
  car.stolen = true;
  G.car = car;
  G.inCar = true;
  G.player.mesh.visible = false;
  syncPlayerToCar(G);
  G.stats.carsStolen++;
  const nearPolice = G.policeCars.some((pc) => Math.hypot(pc.car.x - G.player.x, pc.car.z - G.player.z) < 40)
    || G.footPolice.length > 0;
  if (nearPolice) addWanted(G, 1, 'Wanted +1 — mencuri mobil di depan PCPD');
  else toast(G, `${car.name} dicuri — gas!`);
}

function exitCar(G) {
  const car = G.car;
  if (!car) return;
  car.speed = 0;
  if (!G.parked.includes(car)) G.parked.push(car);
  G.car = null;
  G.inCar = false;
  placePlayer(G, car.x + 2.5, car.z + 2.5, car.heading);
  G.player.mesh.visible = true;
  G.audio.engine(false, 0);
}

function resetRun(G, fresh) {
  for (const pc of G.policeCars) G.W.scene.remove(pc.car.group);
  for (const fp of G.footPolice) G.W.scene.remove(fp.mesh);
  for (const e of G.enemies) G.W.scene.remove(e.mesh);
  G.policeCars = []; G.footPolice = []; G.enemies = [];
  if (G.car) { G.W.scene.remove(G.car.group); G.car = null; }
  G.inCar = false;
  G.wanted = 0;
  G.health = 100;
  G.armor = 50;
  G._kills = 0;
  G.audio.siren(false);
  G.audio.engine(false, 0);
  if (fresh) {
    G.cash = 10350;
    G.day = 1;
    G.timeOfDay = CFG.dayStart;
    G.missionIndex = 0;
    G.stats = { time: 0, carsStolen: 0, maxWanted: 0, missionsDone: 0 };
    G.coinsCollected = 0;
    initCombat(G);
    placePlayer(G, CFG.playerStart.x, CFG.playerStart.z, 0);
    G.player.mesh.visible = true;
  }
}

function boot() {
  const params = new URLSearchParams(window.location.search);
  const seed = parseInt(params.get('seed') || '1', 10) || 1;
  const shot = params.get('shot');
  const container = document.getElementById('game-container');
  const W = createWorld(container);

  const G = {
    seed, rng: mulberry32(seed), W,
    phase: 'title', shotMode: false, shotName: null,
    timeOfDay: CFG.dayStart, day: 1,
    cash: 10350, wanted: 0, wantedSeen: 0, wantedTimer: 0,
    health: 100, armor: 50, weapon: 2, spare: 0,
    missionIndex: 0, missionStage: 0, missionTimer: 0, missionTarget: null,
    stats: { time: 0, carsStolen: 0, maxWanted: 0, missionsDone: 0 },
    respect: 1, radioTrack: 0,
    player: null, car: null, inCar: false,
    traffic: [], peds: [], parked: [], policeCars: [], footPolice: [], enemies: [],
    _panic: 0, _policeSeq: 0, _heli: null, _heliVisible: false,
    _promptText: null, _resprayKey: false, _talkKey: false, _taxiKey: false,
    _shotWantedLock: false, _shotPlaced: false, _shotFrames: 0,
    city: null, input: null, audio: null, hud: null, marco: null, lupe: null, boat: null,
    coins: [], coinsCollected: 0, ramps: [], taxi: null, _courier: null, _rivals: null,
    _tailTimer: 0, _tailSeen: 0, _kills: 0, _nearRespray: false, _nearTaxi: false,
  };
  G.audio = createAudio();
  G.city = buildCity(W.scene, G.rng, W.renderer.capabilities.getMaxAnisotropy(), W.software);
  const playerMesh = createPlayerMesh();
  W.scene.add(playerMesh);
  G.player = {
    mesh: playerMesh, x: CFG.playerStart.x, z: CFG.playerStart.z, y: 0, vy: 0,
    heading: 0, camYaw: 0, camPitch: 0.12, camDist: 7, onGround: true, walkPhase: 0,
  };
  placePlayer(G, CFG.playerStart.x, CFG.playerStart.z, 0);
  G.input = createInput(W.renderer.domElement);
  initTraffic(G, G.rng);
  initCombat(G);
  initMissions(G);

  const hudState = initHUD(G, {
    onNew: () => { resetRun(G, true); startMission(G, 0); G.phase = 'play'; setPhase(G, 'play'); G.audio.ensure(); G.audio.music(true); },
    onContinue: () => {
      const save = loadGame();
      resetRun(G, true);
      if (save) {
        G.cash = save.cash; G.day = save.day || 1; G.timeOfDay = save.timeOfDay || CFG.dayStart;
        G.coinsCollected = save.coinsCollected || 0;
        if (save.ammo) G.ammo = save.ammo;
        if (save.owned) G.owned = save.owned;
        if (save.stats) G.stats = save.stats;
        startMission(G, save.missionIndex || 0);
      } else startMission(G, 0);
      G.phase = 'play'; setPhase(G, 'play'); G.audio.ensure(); G.audio.music(true);
    },
    onResume: () => { G.phase = 'play'; setPhase(G, 'play'); },
    onRestartMission: () => { resetRun(G, false); placePlayer(G, CFG.playerStart.x, CFG.playerStart.z, 0); startMission(G, G.missionIndex); G.phase = 'play'; setPhase(G, 'play'); },
    onSaveQuit: () => { saveGame(G); G.phase = 'title'; setPhase(G, 'title'); G.audio.music(false); },
    onRetry: () => {
      resetRun(G, false);
      G.health = 100;
      placePlayer(G, CFG.playerStart.x, CFG.playerStart.z, 0);
      G.player.mesh.visible = true;
      startMission(G, G.missionIndex);
      G.phase = 'play'; setPhase(G, 'play');
    },
    onRoam: () => { G.phase = 'play'; setPhase(G, 'play'); },
    onTitle: () => { G.phase = 'title'; setPhase(G, 'title'); },
  });
  G.hud = Object.assign(hudState, {
    showDialog: (s, r, t) => showDialog(G, s, r, t),
    showObjective: (t) => showObjective(G, t),
    toast: (t) => toast(G, t),
    setPhase: (p) => setPhase(G, p),
    saveGame: () => saveGame(G),
  });

  W.renderer.domElement.addEventListener('click', () => {
    G.audio.ensure();
    if (G.phase === 'play') requestLock(G.input);
  });
  window.addEventListener('keydown', () => G.audio.ensure(), { once: true });

  if (shot) {
    applyShot(G, shot);
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
      stealCar(G, hit.car || hit.t.car, !!hit.t);
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
                G.spare = (G.spare || 0) + 30;
                toast(G, 'Ammo dibeli — MAKO +60, VESPER +24 ($200)');
              } else toast(G, 'Uang tidak cukup — butuh $200');
            } else {
              const parked = nearestParkedCar(G, G.player.x, G.player.z, 4.5);
              const traffic = parked ? null : nearestTrafficCar(G, G.player.x, G.player.z, 4.5);
              if (parked) stealCar(G, parked.car, false);
              else if (traffic) stealCar(G, traffic.t.car, true);
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
