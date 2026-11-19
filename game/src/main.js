// Boot, state, game loop, save/load, E interactions.
import { CONFIG } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createCity } from './city.js';
import { createVehicles } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createRender } from './render.js';
import { setupShot } from './shots.js';

const q = new URLSearchParams(location.search);
const seed = parseInt(q.get('seed') || '1', 10);
const G = {
  seed, time: 0, timeOfDay: 17.5, day: 1, phase: 'title',
  cash: 250, health: 100, armor: 0, wanted: 0, respect: 0,
  weapons: CONFIG.weapons.map((w) => ({ ...w, owned: w.id === 'fists' || w.id === 'vesper' })),
  weaponIndex: 1,
  stats: { missionsDone: 0, stolen: 0, maxWanted: 0, playT: 0 },
  freeRoam: false, shotMode: null, nightF: 0, car: null, player: null,
  input: null, audio: null,
};
window.__G = G;
G.input = createInput(document.getElementById('app'));
G.audio = createAudio();
G.render = createRender(G);
G.city = createCity(G);
G.vehicles = createVehicles(G);
G.traffic = createTraffic(G);
G.player = createPlayer(G);
G.police = createPolice(G);
G.combat = createCombat(G);
G.hud = createHud(G);
G.missions = createMissions(G);

const SAVE_KEY = 'solarabay-save-v1';
G.save = () => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: G.cash, respect: G.respect, health: G.health, armor: G.armor,
      mission: G.missions.current().index, missionsDone: G.stats.missionsDone,
      weapons: G.weapons.map((w) => ({ id: w.id, owned: w.owned, ammo: w.ammo, locked: w.locked })),
      stats: G.stats, day: G.day,
    }));
  } catch { /* storage unavailable */ }
};
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; }
}
G.newGame = () => {
  G.cash = 250; G.health = 100; G.armor = 0; G.wanted = 0; G.respect = 0;
  G.stats = { missionsDone: 0, stolen: 0, maxWanted: 0, playT: 0 };
  G.weapons = CONFIG.weapons.map((w) => ({ ...w, owned: w.id === 'fists' || w.id === 'vesper' }));
  G.weaponIndex = 1; G.freeRoam = false; G.timeOfDay = 17.5; G.day = 1;
  G.player.reset(0, 30, Math.PI);
  G.phase = 'play'; G.hud.hideTitle();
  G.missions.startMission(0);
  G.audio.unlock();
};
G.continueGame = () => {
  const s = loadSave();
  if (!s) { G.newGame(); return; }
  G.cash = s.cash; G.respect = s.respect; G.health = s.health; G.armor = s.armor;
  G.stats = s.stats; G.day = s.day || 1;
  s.weapons.forEach((sw) => { const w = G.weapons.find((v) => v.id === sw.id); if (w) { w.owned = sw.owned; w.ammo = sw.ammo; w.locked = sw.locked; } });
  G.player.reset(0, 30, Math.PI);
  G.phase = 'play'; G.hud.hideTitle();
  G.missions.startMission(Math.min(s.mission, 7));
  G.audio.unlock();
};
G.toTitle = () => { G.phase = 'title'; G.hud.toTitle(); };
document.getElementById('quality').addEventListener('change', (e) => G.render.setQuality(e.target.value));
document.getElementById('supersample').addEventListener('change', (e) => { if (e.target.checked) G.render.setShotMode(); else G.render.setQuality(document.getElementById('quality').value); });
function toggleFps() {
  const el = document.getElementById('fps');
  el.classList.toggle('hidden');
  document.getElementById('fpsToggle').checked = !el.classList.contains('hidden');
}

let frames = 0, fpsT = 0, fpsN = 0;
function near2d(x, z, px, pz, d) { return Math.hypot(x - px, z - pz) < d; }
function interact() {
  const P = G.player;
  if (P.inCar) { P.exitCar(); return; }
  if (G.missions.interact()) return;
  const gx = CONFIG.gunShop, sx = CONFIG.sprayShop;
  if (near2d(P.x, P.z, gx.x, gx.z, 6)) {
    const b = G.weapons[3];
    if (!b.owned && G.cash >= b.price) { G.cash -= b.price; b.owned = true; b.ammo = b.max; G.hud.ticker('BREAKER bought — press 4 to equip'); }
    else if (b.owned) { b.ammo = b.max; G.cash = Math.max(0, G.cash - 200); G.hud.ticker('Ammo restocked — $200'); }
    else G.hud.ticker('BREAKER costs $3,800 — you have $' + Math.floor(G.cash));
    return;
  }
  if (near2d(P.x, P.z, sx.x, sx.z, 6) && G.wanted > 0) {
    const cost = G.wanted * CONFIG.resprayPerStar;
    if (G.cash >= cost) { G.cash -= cost; G.police.clearWanted(); G.hud.ticker('Respray done — heat gone, -$' + cost); }
    else G.hud.ticker('Respray costs $' + cost);
    return;
  }
  const car = G.vehicles.nearestCar(P.x, P.z, 4.5);
  if (car) { P.stealCar(car); }
}
function promptFor() {
  const P = G.player;
  if (P.inCar) { if (!G.shotMode) G.hud.prompt('E — Exit car'); else G.hud.prompt(''); return; }
  const m = G.missions.current();
  if (m && m.stepObj.type === 'meet' && near2d(P.x, P.z, m.stepObj.pos[0], m.stepObj.pos[1], 16)) { G.hud.prompt('E — Bicara'); return; }
  if (near2d(P.x, P.z, CONFIG.gunShop.x, CONFIG.gunShop.z, 6)) { G.hud.prompt(G.weapons[3].owned ? 'E — Cal\'s Guns: restock ammo $200' : 'E — Cal\'s Guns: BREAKER $3,800'); return; }
  if (near2d(P.x, P.z, CONFIG.sprayShop.x, CONFIG.sprayShop.z, 6) && G.wanted > 0) { G.hud.prompt(`E — Spray & Shine: clear ${G.wanted}★ for $${G.wanted * CONFIG.resprayPerStar}`); return; }
  if (near2d(P.x, P.z, CONFIG.garage.x, CONFIG.garage.z, 7)) { G.hud.prompt('Mara\'s Garage — progress saved'); G.save(); return; }
  const car = G.vehicles.nearestCar(P.x, P.z, 4.5);
  if (car) { G.hud.prompt(car.parked ? `E — Steal the ${car.name}` : `E — Drive the ${car.name}`); return; }
  G.hud.prompt('');
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - (frame._t || now)) / 1000 || 0.016);
  frame._t = now;
  G.time += dt;
  fpsN++; fpsT += dt;
  if (fpsT > 0.5) { const el = document.getElementById('fps'); if (!el.classList.contains('hidden')) el.textContent = Math.round(fpsN / fpsT) + ' FPS'; fpsN = 0; fpsT = 0; }
  if (G.input.pressed('Escape') && G.phase === 'play') { G.phase = 'pause'; document.getElementById('pausemenu').classList.remove('hidden'); }
  else if (G.input.pressed('Escape') && G.phase === 'pause') { G.phase = 'play'; document.getElementById('pausemenu').classList.add('hidden'); }
  if (G.input.pressed('KeyM')) G.audio.toggleMute();
  if (G.input.pressed('F3')) toggleFps();
  if (G.phase === 'play') {
    G.stats.playT += dt;
    G.timeOfDay += (dt * 24) / CONFIG.dayLength;
    if (G.timeOfDay >= 24) { G.timeOfDay -= 24; G.day++; }
    if (G.input.pressed('KeyE')) interact();
    G.player.update(dt);
    G.vehicles.update(dt);
    // hitting a pedestrian with the car
    if (G.car && Math.abs(G.car.speed) > 5) {
      for (const p of G.traffic.peds) {
        if (!p.hit && Math.hypot(p.x - G.car.x, p.z - G.car.z) < 2.4) {
          p.hit = true; p.flee = 4; G.police.addWanted(1);
          G.hud.ticker('You hit a pedestrian! +1★');
        }
      }
    }
    G.traffic.update(dt, G.time);
    G.police.update(dt, G.time);
    G.combat.update(dt);
    G.missions.update(dt);
    G.city.update(dt, G.time, G.nightF || 0);
    G.audio.update(dt, G.car ? Math.abs(G.car.speed) / 46 : 0, G.wanted, G.time);
    promptFor();
    if (G.car && G.car.hp <= 0) { G.car.hp = 100; G.hud.ticker('Your car is wrecked — it sputters back to life'); }
  }
  G.render.update(dt, G.time);
  G.hud.update(dt);
  if (G.shotMode) {
    frames++;
    if (frames === 3) window.__shotReady = true;
  }
  G.input.endFrame();
}
window.__game = () => ({
  phase: G.phase, wanted: G.wanted, cash: Math.floor(G.cash),
  mission: G.missions.current().index, missionName: G.missions.current().mission.name,
  x: Math.round(G.car ? G.car.x : G.player.x), z: Math.round(G.car ? G.car.z : G.player.z),
  speed: G.car ? Math.round(Math.abs(G.car.speed) * 3.6) : 0,
  health: Math.round(G.health), inCar: !!G.car,
});
if (q.get('shot')) {
  G.render.setShotMode();
  setupShot(G, q.get('shot'));
  G.hud.update(0);
} else {
  const s = loadSave();
  document.getElementById('btncontinue').style.display = s ? '' : 'none';
}
requestAnimationFrame(frame);
