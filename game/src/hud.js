// HUD: mission panel, event ticker, vitals, cash/stars/clock/day,
// police response list, circular minimap with district + respect,
// portrait dialogue, radio, speedometer with car-condition bar,
// menus, save/load.
import { MISSIONS, SHOP_POS, FISH_SPOT, districtAt } from './config.js';
const ROLES = {
  'Sal Vega': 'FIXER', 'Kip': 'DRIVER', 'Mara': 'MECHANIC',
  'Juno Reyes': 'WHEELWOMAN', 'Dario Kane': 'DEVELOPER',
};
const TRACKS = [
  'Pink Horizon — Lumen Kids', 'Midnight Marina — Vela',
  'Sunset Strip — The Palms', 'Neon Drive — Coral Skies',
];
function portraitHtml(speaker) {
  const words = speaker.split(' ');
  const initials = (words[0]?.[0] || '?') + (words[1]?.[0] || '');
  let hue = 0;
  for (const ch of speaker) hue = (hue + ch.charCodeAt(0)) % 360;
  return `<div class="portrait" style="background:linear-gradient(135deg,hsl(${hue},70%,55%),hsl(${(hue + 60) % 360},70%,35%))">${initials}</div>`;
}
export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const hud = {
    el: $('hud'), healthFill: $('health-fill'), armorFill: $('armor-fill'),
    weapon: $('weapon'), stars: $('stars'), cash: $('cash'), clock: $('clock'),
    dayEl: $('day'), objective: $('objective'), prompt: $('prompt'), dialog: $('dialog'),
    toastEl: $('toast'), speed: $('speed'), speedNum: $('speed-num'), carName: $('car-name'),
    conditionWrap: $('condition-wrap'), conditionFill: $('condition-fill'),
    minimap: $('minimap'), districtEl: $('district-name'),
    respectFill: $('respect-fill'), respectLabel: $('respect-label'),
    chapterEl: $('mission-chapter'), timerEl: $('mission-timer'),
    stageEl: $('mission-stage'), nextEl: $('mission-next'),
    policeList: $('police-list'), radioTrack: $('radio-track'),
    eventTicker: $('event-ticker'),
    banner: $('banner'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
    title: $('title'), pause: $('pause'), gameover: $('gameover'),
    fpsEl: $('fps'),
    toastT: 0, dialogT: 0, bannerT: 0, policeT: 1,
    showPrompt(text) {
      hud.prompt.style.display = text ? 'block' : 'none';
      hud.prompt.textContent = text;
    },
    showObjective(text) { hud.objective.textContent = text; },
    showDialog(who, text) {
      let speaker = who, body = text;
      const m = text.match(/^([^:]{1,30}):\s*(.*)$/);
      if (m) { speaker = m[1]; body = m[2]; }
      const role = ROLES[speaker] || 'CONTACT';
      hud.dialog.innerHTML = `${portraitHtml(speaker)}<div class="dialog-body">`
        + `<div class="dialog-name">${speaker.toUpperCase()} · ${role}</div>`
        + `<div class="dialog-text">${body}</div></div>`;
      hud.dialog.style.display = 'flex'; hud.dialogT = 7;
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
  const qSel = $('quality'), q4k = $('quality-4k'), qFps = $('quality-fps');
  const syncQualityInputs = () => {
    const q = G.quality || { level: 'high', fourK: false, showFps: false };
    if (qSel) qSel.value = q.level;
    if (q4k) q4k.checked = !!q.fourK;
    if (qFps) qFps.checked = !!q.showFps;
  };
  syncQualityInputs();
  if (qSel) qSel.addEventListener('change', () => { G.quality.level = qSel.value; G.applyQuality(); });
  if (q4k) q4k.addEventListener('change', () => { G.quality.fourK = q4k.checked; G.applyQuality(); });
  if (qFps) qFps.addEventListener('change', () => { G.quality.showFps = qFps.checked; G.applyQuality(); });
  hud.syncQualityInputs = syncQualityInputs;
  return hud;
}
function formatTimer(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function rebuildPoliceList(G) {
  const hud = G.hud;
  if (G.wanted <= 0) {
    hud.policeList.style.display = 'none';
    return;
  }
  const p = G.player.pos;
  let html = `<div class="police-head">HKPD RESPONSE · ${G.policeCars.length + G.footPolice.length} UNITS</div>`;
  for (const car of G.policeCars) {
    const d = Math.round(Math.hypot(car.x - p.x, car.z - p.z));
    const cls = car.role === 'RAMMING' ? 'tag-ram' : car.role === 'ROADBLOCK' ? 'tag-block' : 'tag-pursuit';
    html += `<div class="police-row"><span>${car.callsign || 'UNIT'}</span><span>${d}m</span><span class="tag ${cls}">${car.role || 'PURSUIT'}</span></div>`;
  }
  if (G.footPolice.length > 0) {
    html += `<div class="police-more">+${G.footPolice.length} more unit${G.footPolice.length > 1 ? 's' : ''} in the search zone</div>`;
  }
  hud.policeList.innerHTML = html;
  hud.policeList.style.display = 'block';
}
export function updateHud(G, dt) {
  const hud = G.hud;
  const p = G.player;
  hud.healthFill.style.width = `${Math.max(0, p.health)}%`;
  hud.armorFill.style.width = `${Math.max(0, p.armor)}%`;
  hud.weapon.textContent = p.weapon === 1 ? `Pistol — ${p.ammo} / 12` : 'Fists';
  hud.stars.textContent = '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
  hud.cash.textContent = `$${p.cash.toLocaleString('en-US')}`;
  hud.dayEl.textContent = `DAY ${G.day || 1}`;
  const h = Math.floor(G.timeOfDay) % 24, m = Math.floor((G.timeOfDay % 1) * 60);
  hud.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const def = MISSIONS[G.mission.index];
  if (def) {
    hud.chapterEl.textContent = `CH ${G.mission.index + 1} · ${def.name.toUpperCase()}`;
    if (def.time && G.mission.timer > 0) {
      hud.timerEl.textContent = formatTimer(G.mission.timer);
      hud.timerEl.style.display = '';
    } else hud.timerEl.style.display = 'none';
    hud.stageEl.textContent = `STAGE ${Math.min(G.mission.step + 1, def.steps.length)}/${def.steps.length}`;
    const next = def.steps[G.mission.step + 1];
    if (next) { hud.nextEl.textContent = `NEXT: ${next.text}`; hud.nextEl.style.display = ''; }
    else hud.nextEl.style.display = 'none';
  }
  if (G._eventT > 0 && G._eventMsg) {
    G._eventT -= dt;
    hud.eventTicker.textContent = G._eventMsg;
    hud.eventTicker.style.display = 'block';
  } else {
    hud.eventTicker.style.display = 'none';
  }
  hud.speedNum.textContent = G.playerCar ? Math.round(Math.abs(G.playerCar.speed) * 3.6) : 0;
  hud.carName.textContent = G.playerCar ? G.playerCar.spec.name.toUpperCase() : 'ON FOOT';
  if (G.playerCar) {
    hud.conditionWrap.style.display = 'block';
    hud.conditionFill.style.width = `${Math.max(0, G.playerCar.health)}%`;
  } else hud.conditionWrap.style.display = 'none';
  hud.radioTrack.textContent = TRACKS[Math.floor(G.time / 25) % TRACKS.length];
  if (hud.fpsEl) {
    const showFps = G.quality && G.quality.showFps;
    hud.fpsEl.style.display = showFps ? 'block' : 'none';
    if (showFps) hud.fpsEl.textContent = `${Math.round(G._fps || 60)} FPS · PR ${G._prCur || 1}`;
  }
  hud.policeT += dt;
  if (hud.policeT > 0.5) { hud.policeT = 0; rebuildPoliceList(G); }
  hud.districtEl.textContent = districtAt(p.pos.x, p.pos.z).name.toUpperCase();
  const respect = Math.min(5, (G.stats.missionsDone || 0) + 1);
  hud.respectFill.style.width = `${respect * 20}%`;
  hud.respectLabel.textContent = `RESPECT ${respect}`;
  if (hud.toastT > 0) { hud.toastT -= dt; if (hud.toastT <= 0) hud.toastEl.style.display = 'none'; }
  if (hud.dialogT > 0) { hud.dialogT -= dt; if (hud.dialogT <= 0) hud.dialog.style.display = 'none'; }
  if (hud.bannerT > 0) { hud.bannerT -= dt; if (hud.bannerT <= 0) hud.banner.style.display = 'none'; }
  drawMinimap(G);
}
function drawMinimap(G) {
  const cv = G.hud.minimap;
  const g = cv.getContext('2d');
  const S = 200, HALF = 300;
  const toMap = (x, z) => [
    Math.max(2, Math.min(S - 2, (x + HALF) / (HALF * 2) * S)),
    Math.max(2, Math.min(S - 2, (z + HALF) / (HALF * 2) * S)),
  ];
  g.fillStyle = '#0e1a24'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#1f6f9f'; g.fillRect(0, 0, 8, S);
  for (let c = -240; c <= 240; c += 60) {
    const [ax] = toMap(c, 0); const [, bz] = toMap(0, c);
    const main = c === 0;
    g.strokeStyle = main ? '#6a7a8c' : '#4a5568';
    g.lineWidth = main ? 3.5 : 2;
    g.beginPath(); g.moveTo(ax, 0); g.lineTo(ax, S); g.stroke();
    g.beginPath(); g.moveTo(0, bz); g.lineTo(S, bz); g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.font = 'bold 7px sans-serif'; g.textAlign = 'center';
  const labels = [
    ['MARINA BAY', -210, 0], ['THE DOCKS', 210, 0], ['VISTA HILLS', 0, -238],
    ['THE SPIRES', 0, -6], ['OLD SOLARA', 0, 152], ['CALLE VERDE', -152, -152],
  ];
  for (const [name, lx, lz] of labels) {
    const [mx, mz] = toMap(lx, lz);
    g.fillText(name, mx, mz);
  }
  g.fillStyle = '#9a7a4a';
  const [pierX, pierZ] = toMap(-322, 0);
  g.fillRect(pierX - 6, pierZ - 4, 6, 8);
  g.fillStyle = '#ffffff';
  const [lhX, lhZ] = toMap(-340, -150);
  g.beginPath(); g.arc(lhX, lhZ, 2.5, 0, Math.PI * 2); g.fill();
  if (G._race && G._race.active) {
    g.strokeStyle = '#ff2222';
    g.lineWidth = 2;
    g.setLineDash([4, 3]);
    const [rx1, rz1] = toMap(-240, -200);
    const [rx2, rz2] = toMap(-240, 235);
    g.beginPath(); g.moveTo(rx1, rz1); g.lineTo(rx2, rz2); g.stroke();
    g.setLineDash([]);
  }
  const p0 = G.player.pos;
  g.fillStyle = '#ffd23f';
  for (const coin of G.coins) {
    if (coin.taken) continue;
    if (Math.hypot(coin.x - p0.x, coin.z - p0.z) > 160) continue;
    const [mx, mz] = toMap(coin.x, coin.z);
    g.fillRect(mx - 1, mz - 1, 2, 2);
  }
  if (G._bonus && G._bonus.active) {
    const [bx, bz] = toMap(G._bonus.x, G._bonus.z);
    g.beginPath(); g.arc(bx, bz, 3.5, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#ff8a3d';
  for (const truck of G.foodTrucks || []) {
    const [tx, tz] = toMap(truck.x, truck.z);
    g.fillRect(tx - 2.5, tz - 2.5, 5, 5);
  }
  g.fillStyle = '#4ae3ff';
  const [fx, fz] = toMap(FISH_SPOT[0], FISH_SPOT[1]);
  g.beginPath(); g.arc(fx, fz, 3, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#3ddc5f';
  const [gx, gz] = toMap(SHOP_POS.garage[0], SHOP_POS.garage[1]);
  g.fillRect(gx - 3, gz - 3, 6, 6);
  g.fillStyle = '#c98aff';
  const [sx, sz] = toMap(SHOP_POS.guns[0], SHOP_POS.guns[1]);
  g.fillRect(sx - 3, sz - 3, 6, 6);
  if (G.mission.marker) {
    const [mx, mz] = toMap(G.mission.marker.x, G.mission.marker.z);
    g.fillStyle = '#ffd23f';
    g.beginPath(); g.arc(mx, mz, 5 + Math.sin(G.time * 5) * 1.5, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = Math.sin(G.time * 8) > 0 ? '#ff4444' : '#4488ff';
  for (const pc of G.policeCars) {
    const [px, pz] = toMap(pc.x, pc.z);
    g.beginPath(); g.arc(px, pz, 3, 0, Math.PI * 2); g.fill();
  }
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
