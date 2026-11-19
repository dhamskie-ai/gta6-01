// Boot + game loop + wiring semua sistem SOLARA BAY.
import { G } from './config.js';
import { reseed } from './random.js';
import { initInput, wasPressed } from './input.js';
import { initAudio, updateAudio, audioState } from './audio.js';
import { buildRender, updateSky } from './render.js';
import { buildCity, updateCityFx } from './city.js';
import { buildCarMesh, spawnVehicle, updateCarLights } from './vehicles.js';
import { buildTraffic, updateTraffic, updatePeds } from './traffic.js';
import { buildPlayer, updatePlayer } from './player.js';
import { buildHelicopter, updatePolice } from './police.js';
import { buildCombat, updateCombat } from './combat.js';
import { startMission, updateMissions, loadGame } from './missions.js';
import { initHud, updateHud, showTitle } from './hud.js';
import { initTouch, updateTouchLabels } from './touch.js';
import { setupShot, shotTick, exposeGame } from './shots.js';
window.__audio = audioState;
function boot() {
  const q = new URLSearchParams(location.search);
  G.seed = parseInt(q.get('seed') || '1', 10) || 1;
  reseed(G.seed);
  buildRender();
  buildCity();
  buildPlayer();
  buildCombat();
  buildHelicopter();
  buildTraffic();
  // VELOZ COMET RS pink parkir di depan spawn (misi 1).
  const veloz = spawnVehicle('sport', 0, 14, Math.PI, { parked: true });
  veloz.missionCar = true;
  spawnVehicle('bus', -120, 40, Math.PI / 2, { parked: true });
  spawnVehicle('taxi', 8, -14, 0, { parked: true });
  initInput();
  initAudio();
  initHud();
  initTouch();
  const cv = document.getElementById('c');
  cv.addEventListener('pointerdown', () => { G._mouseDown = true; });
  addEventListener('pointerup', () => { G._mouseDown = false; });
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && G.state === 'playing') G.paused = !G.paused; });
  const had = loadGame();
  if (had) { const bc = document.getElementById('btn-continue'); if (bc) bc.style.display = 'inline-block'; }
  startMission(G.missionIdx);
  setupShot();
  if (!G.shot) showTitle();
  G.ready = true;
  let last = performance.now();
  const loop = (now) => {
    requestAnimationFrame(loop);
    // Substep: di SwiftShader (~1fps) dt mentah ~1 dtk; pecah jadi langkah
    // 0,05 dtk supaya waktu game tetap mengikuti waktu nyata & fisika stabil.
    const rawDt = Math.min(1, (now - last) / 1000); last = now;
    const dt = rawDt;
    if (G.state === 'playing' && !G.paused) {
      G.time += dt; G.stats.playT += dt;
      const n = Math.max(1, Math.ceil(rawDt / 0.05)), sdt = rawDt / n;
      for (let i = 0; i < n; i++) {
        updateCityFx(sdt);
        updatePlayer(sdt);
        updateTraffic(sdt);
        updatePeds(sdt);
        updatePolice(sdt);
        updateCombat(sdt);
        updateMissions(sdt);
      }
      updateSky(dt);
      updateAudio(dt);
      updateCarLights();
      updateTouchLabels();
      if (G.dialog && G.time > G.dialog.until) G.dialog = null;
    } else if (G.state === 'title') {
      G.time += dt; updateSky(dt); updateCityFx(dt);
      G.camera.position.set(Math.sin(G.time * 0.05) * 60, 26, Math.cos(G.time * 0.05) * 60);
      G.camera.lookAt(0, 4, 0);
    }
    updateHud(dt);
    exposeGame();
    shotTick();
    G.renderer.render(G.scene, G.camera);
  };
  requestAnimationFrame(loop);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
