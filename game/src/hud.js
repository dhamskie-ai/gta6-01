// HUD: DOM bars, stars, cash, clock, objective, prompt, dialog, minimap
// canvas, title/pause/game-over screens, save/load buttons.
import { CFG } from './config.js';
import { roadCoords } from './city.js';
import { saveGame, loadGame, hasSave, startMission, retryMission } from './missions.js';

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const hud = {
    el: {
      health: $('health-fill'), armor: $('armor-fill'), cash: $('cash'),
      stars: $('stars'), speed: $('speed'), weapon: $('weapon'),
      clock: $('clock'), objective: $('objective'), prompt: $('prompt'),
      dialog: $('dialog'), toast: $('toast'),
      title: $('title-screen'), pause: $('pause-screen'),
      over: $('over-screen'), overTitle: $('over-title'),
      missionDone: $('mission-done'), missionDoneText: $('mission-done-text'),
      missionFail: $('mission-fail'), missionFailText: $('mission-fail-text'),
      ending: $('ending-screen'),
      minimap: $('minimap'),
    },
    toastTimer: 0,
    setHealth(hp, armor) {
      hud.el.health.style.width = `${Math.max(0, hp)}%`;
      hud.el.armor.style.width = `${Math.max(0, armor)}%`;
    },
    setCash(c) { hud.el.cash.textContent = `$${Math.floor(c)}`; },
    setStars(n) {
      let s = '';
      for (let i = 0; i < CFG.maxWanted; i++) s += i < n ? '★' : '☆';
      hud.el.stars.textContent = s;
      hud.el.stars.style.color = n > 0 ? '#ffd24a' : '#888';
    },
    setSpeed(kmh, driving) {
      hud.el.speed.textContent = driving ? `${Math.round(Math.abs(kmh))} km/h` : '';
    },
    setWeapon(w, ammo) {
      hud.el.weapon.textContent = w === 'pistol' ? `Pistol ${ammo}/12` : 'Tinju';
    },
    setClock(hour) {
      const h = Math.floor(hour) % 24;
      const m = Math.floor((hour % 1) * 60);
      hud.el.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    },
    setObjective(t) { hud.el.objective.textContent = t || ''; },
    setPrompt(t) { hud.el.prompt.textContent = t || ''; },
    setDialog(t) { hud.el.dialog.textContent = t || ''; hud.el.dialog.style.display = t ? 'block' : 'none'; },
    setToast(t) {
      hud.el.toast.textContent = t;
      hud.el.toast.style.display = 'block';
      hud.toastTimer = 3;
    },
    hideToast() { hud.el.toast.style.display = 'none'; },
    showMissionComplete(G2, def) {
      hud.el.missionDoneText.textContent = `Misi selesai: ${def.name}  +$${def.reward}`;
      hud.el.missionDone.style.display = 'block';
      setTimeout(() => { hud.el.missionDone.style.display = 'none'; }, 3500);
    },
    showMissionFailed(G2, def, reason) {
      hud.el.missionFailText.textContent = `Misi gagal: ${reason}`;
      hud.el.missionFail.style.display = 'block';
    },
    hideMissionFail() { hud.el.missionFail.style.display = 'none'; },
    showGameOver(G2, title) {
      hud.el.overTitle.textContent = title;
      hud.el.over.style.display = 'flex';
    },
    hideGameOver() { hud.el.over.style.display = 'none'; },
    showEnding(G2) {
      hud.el.ending.style.display = 'flex';
    },
    update(G2, dt) {
      const p = G2.player;
      hud.setHealth(p.hp, p.armor);
      hud.setCash(p.cash);
      hud.setStars(G2.wanted);
      hud.setSpeed(p.car ? p.car.speed * 3.6 : 0, !!p.car);
      hud.setWeapon(p.weapon, p.ammo);
      hud.setClock(G2.timeOfDay);
      if (hud.toastTimer > 0) {
        hud.toastTimer -= dt;
        if (hud.toastTimer <= 0) hud.hideToast();
      }
      drawMinimap(G2);
    },
  };
  wireButtons(G, hud);
  return hud;
}

function wireButtons(G, hud) {
  const $ = (id) => document.getElementById(id);
  $('btn-new').addEventListener('click', () => {
    G.audio?.ensure();
    hud.el.title.style.display = 'none';
    G.phase = 'play';
    G.input.lockPointer();
    startMission(G, 0);
  });
  $('btn-continue').addEventListener('click', () => {
    G.audio?.ensure();
    const save = loadGame(G);
    hud.el.title.style.display = 'none';
    G.phase = 'play';
    G.input.lockPointer();
    if (save) startMission(G, Math.min(save.mission ?? 0, 4));
    else startMission(G, 0);
  });
  $('btn-resume').addEventListener('click', () => {
    hud.el.pause.style.display = 'none';
    G.phase = 'play';
    G.input.lockPointer();
  });
  $('btn-save').addEventListener('click', () => {
    saveGame(G);
    hud.setToast('Game disimpan');
  });
  $('btn-restart-mission').addEventListener('click', () => {
    hud.el.pause.style.display = 'none';
    hud.hideMissionFail();
    retryMission(G);
  });
  $('btn-quit').addEventListener('click', () => {
    saveGame(G);
    hud.el.pause.style.display = 'none';
    hud.el.title.style.display = 'flex';
    G.phase = 'title';
    G.input.unlockPointer();
  });
  $('btn-retry').addEventListener('click', () => {
    hud.hideMissionFail();
    retryMission(G);
  });
  $('btn-over-retry').addEventListener('click', () => {
    hud.hideGameOver();
    retryMission(G);
  });
  $('btn-over-title').addEventListener('click', () => {
    hud.hideGameOver();
    hud.el.title.style.display = 'flex';
    G.phase = 'title';
  });
  $('btn-ending-close').addEventListener('click', () => {
    hud.el.ending.style.display = 'none';
    G.phase = 'play';
  });
  if (!hasSave()) $('btn-continue').style.opacity = '0.4';
}

// Minimap: 180x180, north-up, roads + dots for player/police/marker/shops.
export function drawMinimap(G) {
  const cv = document.getElementById('minimap');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const S = 180, half = CFG.cityHalf;
  const toPx = (v) => ((v + half) / (half * 2)) * S;
  ctx.fillStyle = '#1a2230';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#2f6fb4';
  ctx.fillRect(0, 0, toPx(-270), S);
  ctx.strokeStyle = '#5a6270';
  ctx.lineWidth = 3;
  for (const v of roadCoords()) {
    ctx.beginPath(); ctx.moveTo(toPx(v), 0); ctx.lineTo(toPx(v), S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, toPx(v)); ctx.lineTo(S, toPx(v)); ctx.stroke();
  }
  // Shops: garage green, respray + guns purple.
  ctx.fillStyle = '#4ad87a';
  ctx.fillRect(toPx(-60) - 3, toPx(-60) - 3, 6, 6);
  ctx.fillStyle = '#b46ad8';
  ctx.fillRect(toPx(120) - 3, toPx(60) - 3, 6, 6);
  ctx.fillRect(toPx(180) - 3, toPx(-60) - 3, 6, 6);
  // Mission marker (yellow).
  if (G.missions.marker.visible) {
    ctx.fillStyle = '#ffd24a';
    const mx = toPx(G.missions.markerPos.x), mz = toPx(G.missions.markerPos.z);
    ctx.beginPath(); ctx.arc(mx, mz, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mx, mz, 8 + Math.sin(G.elapsed * 4) * 2, 0, Math.PI * 2); ctx.stroke();
  }
  // Police (red/blue flashing).
  const flash = Math.sin(G.elapsed * 8) > 0;
  ctx.fillStyle = flash ? '#ff4444' : '#4488ff';
  for (const car of G.policeCars || []) {
    ctx.fillRect(toPx(car.mesh.position.x) - 2, toPx(car.mesh.position.z) - 2, 4, 4);
  }
  for (const cop of G.footPolice || []) {
    ctx.fillRect(toPx(cop.mesh.position.x) - 2, toPx(cop.mesh.position.z) - 2, 4, 4);
  }
  // Player arrow (white).
  const p = G.player;
  const pos = p.car ? p.car.mesh.position : p.pos;
  const yaw = p.car ? p.car.yaw : p.yaw;
  ctx.save();
  ctx.translate(toPx(pos.x), toPx(pos.z));
  ctx.rotate(-yaw + Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath();
  ctx.fill();
  ctx.restore();
}
