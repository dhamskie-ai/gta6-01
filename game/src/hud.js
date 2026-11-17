// HUD: DOM bars/stars/cash/clock, minimap canvas, menus, save/load.
import { MISSIONS, SHOP_POS } from './config.js';

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const hud = {
    el: $('hud'), healthFill: $('health-fill'), armorFill: $('armor-fill'),
    weapon: $('weapon'), stars: $('stars'), cash: $('cash'), clock: $('clock'),
    objective: $('objective'), prompt: $('prompt'), dialog: $('dialog'),
    toastEl: $('toast'), speed: $('speed'), minimap: $('minimap'),
    banner: $('banner'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
    title: $('title'), pause: $('pause'), gameover: $('gameover'),
    toastT: 0, dialogT: 0, bannerT: 0,
    showPrompt(text) {
      hud.prompt.style.display = text ? 'block' : 'none';
      hud.prompt.textContent = text;
    },
    showObjective(text) { hud.objective.textContent = text; },
    showDialog(who, text) {
      hud.dialog.innerHTML = `<b>${who}:</b> ${text}`;
      hud.dialog.style.display = 'block'; hud.dialogT = 7;
    },
    toast(text) {
      hud.toastEl.textContent = text; hud.toastEl.style.display = 'block'; hud.toastT = 3;
    },
    showBanner(title, sub) {
      hud.bannerTitle.textContent = title; hud.bannerSub.textContent = sub || '';
      hud.banner.style.display = 'block'; hud.bannerT = 3;
    },
    flashDamage() {
      hud.healthFill.style.background = '#ff4444';
      setTimeout(() => { hud.healthFill.style.background = '#3ddc5f'; }, 150);
    },
  };
  G.hud = hud;
  $('btn-new').addEventListener('click', () => { G.audio.resume(); G.audio.startMusic(); G.newGame(); });
  $('btn-continue').addEventListener('click', () => { G.audio.resume(); G.audio.startMusic(); G.continueGame(); });
  $('btn-resume').addEventListener('click', () => G.resumeGame());
  $('btn-save').addEventListener('click', () => { G.saveGame(); hud.toast('Game saved'); });
  $('btn-restart-mission').addEventListener('click', () => { G.resumeGame(); G.restartMission(); });
  $('btn-quit').addEventListener('click', () => { G.saveGame(); G.quitToTitle(); });
  $('btn-retry').addEventListener('click', () => { G.retryMission(); });
  $('btn-title').addEventListener('click', () => G.quitToTitle());
  return hud;
}

export function updateHud(G, dt) {
  const hud = G.hud;
  const p = G.player;
  hud.healthFill.style.width = `${Math.max(0, p.health)}%`;
  hud.armorFill.style.width = `${Math.max(0, p.armor)}%`;
  hud.weapon.textContent = p.weapon === 1 ? `Pistol — ${p.ammo} / 12` : 'Fists';
  hud.stars.textContent = '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
  hud.cash.textContent = `$${p.cash}`;
  const h = Math.floor(G.timeOfDay) % 24, m = Math.floor((G.timeOfDay % 1) * 60);
  hud.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  hud.speed.innerHTML = G.playerCar ? `${Math.round(Math.abs(G.playerCar.speed) * 3.6)}<small>km/h · ${G.playerCar.spec.name}</small>` : '0<small>km/h · on foot</small>';
  if (hud.toastT > 0) { hud.toastT -= dt; if (hud.toastT <= 0) hud.toastEl.style.display = 'none'; }
  if (hud.dialogT > 0) { hud.dialogT -= dt; if (hud.dialogT <= 0) hud.dialog.style.display = 'none'; }
  if (hud.bannerT > 0) { hud.bannerT -= dt; if (hud.bannerT <= 0) hud.banner.style.display = 'none'; }
  drawMinimap(G);
}

function drawMinimap(G) {
  const cv = G.hud.minimap;
  const g = cv.getContext('2d');
  const S = 180, HALF = 300;
  const toMap = (x, z) => [(x + HALF) / (HALF * 2) * S, (z + HALF) / (HALF * 2) * S];
  g.fillStyle = '#0e1a24'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#1f6f9f'; g.fillRect(0, 0, 8, S); // sea strip
  g.strokeStyle = '#4a5568'; g.lineWidth = 2;
  for (let c = -240; c <= 240; c += 60) {
    const [ax] = toMap(c, 0); const [, bz] = toMap(0, c);
    g.beginPath(); g.moveTo(ax, 0); g.lineTo(ax, S); g.stroke();
    g.beginPath(); g.moveTo(0, bz); g.lineTo(S, bz); g.stroke();
  }
  // Garage + shops.
  g.fillStyle = '#3ddc5f';
  const [gx, gz] = toMap(SHOP_POS.garage[0], SHOP_POS.garage[1]);
  g.fillRect(gx - 3, gz - 3, 6, 6);
  g.fillStyle = '#c98aff';
  const [sx, sz] = toMap(SHOP_POS.guns[0], SHOP_POS.guns[1]);
  g.fillRect(sx - 3, sz - 3, 6, 6);
  // Mission marker.
  if (G.mission.marker) {
    const [mx, mz] = toMap(G.mission.marker.x, G.mission.marker.z);
    g.fillStyle = '#ffd23f';
    g.beginPath(); g.arc(mx, mz, 5 + Math.sin(G.time * 5) * 1.5, 0, Math.PI * 2); g.fill();
  }
  // Police (blinking red/blue).
  g.fillStyle = Math.sin(G.time * 8) > 0 ? '#ff4444' : '#4488ff';
  for (const pc of G.policeCars) {
    const [px, pz] = toMap(pc.x, pc.z);
    g.beginPath(); g.arc(px, pz, 3, 0, Math.PI * 2); g.fill();
  }
  // Player arrow (white, rotated by yaw).
  const p = G.player.pos;
  const [px, pz] = toMap(p.x, p.z);
  g.save(); g.translate(px, pz); g.rotate(-G.player.yaw);
  g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 5); g.lineTo(-4, 5); g.closePath(); g.fill();
  g.restore();
}

export function showTitle(G, hasSave) {
  G.hud.title.style.display = 'flex';
  G.hud.pause.style.display = 'none';
  G.hud.gameover.style.display = 'none';
  G.hud.el.classList.remove('on');
  document.getElementById('btn-continue').style.display = hasSave ? '' : 'none';
}
export function showPause(G, on) {
  G.hud.pause.style.display = on ? 'flex' : 'none';
}
export function showGameOver(G, title, sub) {
  document.getElementById('over-title').textContent = title;
  document.getElementById('over-sub').textContent = sub;
  G.hud.gameover.style.display = 'flex';
  G.hud.el.classList.remove('on');
}

const SAVE_KEY = 'solarabay-save-v1';
export function saveGameData(G) {
  const p = G.player;
  const data = {
    cash: p.cash, mission: G.mission.index, health: p.health, armor: p.armor,
    hasPistol: p.hasPistol, ammo: p.ammo, coins: G.stats.coins, carsStolen: G.stats.carsStolen,
    maxWanted: G.stats.maxWanted, playTime: G.stats.playTime,
    garage: G.cars.filter((c) => c.driver === 'player' || c.driver === 'parked').slice(0, 3).map((c) => ({ type: c.type, x: c.x, z: c.z })),
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* private mode */ }
  return data;
}
export function loadGameData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function missionName(G) {
  return MISSIONS[G.mission.index] ? MISSIONS[G.mission.index].name : 'Free Roam';
}
