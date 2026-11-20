// HUD DOM, minimap, dialogs, menus, save/load.
import { CFG, MISSIONS, PHOTO_SPOTS } from './config.js';
import { driveCarRef } from './player.js';
import { startMission } from './missions.js';
import { setWanted } from './police.js';

const SAVE_KEY = 'solarabay-save-v1';
export function initHud(G) {
  G.el = {};
  document.querySelectorAll('[id]').forEach((el) => {
    const key = el.id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    G.el[key] = el;
  });
  G.centerMsg = (text, dur) => { G.centerMsgText = text; G.centerMsgT = dur || 2.5; };
  G.showOver = (kind) => {
    G.el.overTitle.textContent = kind === 'busted' ? 'DITANGKAP' : 'K.O.';
    G.el.overScreen.style.display = 'flex';
  };
  const hideScreens = () => {
    ['titleScreen', 'pauseScreen', 'overScreen'].forEach((k) => { if (G.el[k]) G.el[k].style.display = 'none'; });
  };
  G.startNew = () => {
    G.cash = CFG.startCash; G.health = 100; G.armor = 0; G.day = 1;
    G.timeOfDay = 12; G.stats = { stolen: 0, maxWanted: 0, kills: 0, photos: 0, fish: 0, deliveries: 0, races: 0 };
    G.photosDone = [];
    setWanted(G, 0);
    G.player.car = null; G.player.mesh.visible = true;
    G.player.x = CFG.startPos[0]; G.player.z = CFG.startPos[1];
    G.player.mesh.position.set(G.player.x, 0, G.player.z);
    G.phase = 'play'; hideScreens();
    startMission(G, 0);
    G.saveGame();
  };
  G.startContinue = () => {
    const s = loadSave();
    if (s) {
      G.cash = s.cash; G.health = s.health; G.day = s.day || 1;
      G.stats = { ...G.stats, ...s.stats };
      G.player.x = s.x; G.player.z = s.z;
      G.player.mesh.position.set(s.x, 0, s.z);
      G.phase = 'play'; hideScreens();
      startMission(G, s.missionIdx || 0);
    } else G.startNew();
  };
  G.pauseGame = () => { if (G.phase === 'play') { G.phase = 'pause'; G.el.pauseScreen.style.display = 'flex'; } };
  G.resumeGame = () => { G.phase = 'play'; G.el.pauseScreen.style.display = 'none'; };
  G.restartMission = () => { G.health = 100; setWanted(G, 0); G.phase = 'play'; hideScreens(); startMission(G, G.missionIdx); };
  G.retry = () => {
    G.health = 100; G.armor = 0; setWanted(G, 0);
    G.player.car = null; G.player.mesh.visible = true;
    G.player.x = CFG.startPos[0]; G.player.z = CFG.startPos[1];
    G.player.mesh.position.set(G.player.x, 0, G.player.z);
    G.phase = 'play'; hideScreens();
    startMission(G, G.missionIdx);
  };
  G.quitToTitle = () => { G.phase = 'title'; hideScreens(); G.el.titleScreen.style.display = 'flex'; };
  G.saveGame = () => saveGame(G);
  const bind = (id, fn) => { const el = G.el[id]; if (el) el.addEventListener('click', fn); };
  bind('btnNew', () => G.startNew());
  bind('btnContinue', () => G.startContinue());
  bind('btnResume', () => G.resumeGame());
  bind('btnRestart', () => G.restartMission());
  bind('btnSave', () => { G.saveGame(); G.centerMsg('Game disimpan.', 2); });
  bind('btnQuit', () => G.quitToTitle());
  bind('btnRetry', () => G.retry());
  bind('muteBtn', () => { if (G.toggleMute) G.toggleMute(); });
  G.el.btnContinue.style.display = loadSave() ? 'block' : 'none';
}
function saveGame(G) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: G.cash, missionIdx: G.missionIdx, health: G.health,
      stats: G.stats, day: G.day, x: G.player.x, z: G.player.z,
    }));
  } catch { /* storage unavailable */ }
}
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; }
}
function fmtTime(t) {
  const h = Math.floor(t) % 24, m = Math.floor((t % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
export function updateHud(G, dt) {
  const el = G.el;
  const m = MISSIONS[G.missionIdx];
  el.missionChapter.textContent = m ? `JOB ${G.missionIdx + 1}/8 · ${m.title.toUpperCase()}` : 'SOLARA BAY';
  el.missionTimer.textContent = m && m.timer ? `${Math.floor(G.missionTimer / 60)}:${String(Math.floor(G.missionTimer % 60)).padStart(2, '0')}` : '';
  el.missionObjective.textContent = G.objective || '';
  el.missionStage.textContent = m ? `STAGE ${G.missionStage + 1}/${m.steps.length}` : '';
  el.missionNext.textContent = m ? `NEXT: ${m.next}` : 'Solara Bay is yours';
  el.hpBar.style.width = `${Math.max(0, G.health)}%`;
  el.armorBar.style.width = `${Math.max(0, G.armor)}%`;
  const w = ['FISTS', 'VESPER 72', 'MAKO SMG'][G.player.weapon];
  el.weaponName.textContent = w;
  el.ammoCount.textContent = G.player.weapon === 0 ? '∞' : String(G.player.ammo[G.player.weapon]);
  el.jobsRow.textContent = `TAKSI $40 · BALAP $120 · IKAN $15 · FOTO ${G.photosDone.length}/6 · PAKET $60`;
  el.dayLabel.textContent = `DAY ${G.day}`;
  el.stars.textContent = '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
  el.cashLabel.textContent = `$${Math.floor(G.cash).toLocaleString('en-US')}`;
  el.clockLabel.textContent = fmtTime(G.timeOfDay);
  // PCPD panel.
  const units = [...G.policeCars, ...G.footCops];
  el.policeHead.textContent = `PCPD RESPONSE: ${units.length} UNITS${G.heli ? ' · AIR-1' : ''}`;
  el.policeRows.innerHTML = units.slice(0, 6).map((u) => {
    const d = Math.round(Math.hypot(u.x - G.player.x, u.z - G.player.z));
    return `<div>${u.callsign || 'UNIT'} · ${d}m · ${u.policeCar ? 'RAMMING' : 'CHASING'}</div>`;
  }).join('') + (units.length > 6 ? `<div>+${units.length - 6} more units</div>` : '');
  // District + respect.
  el.districtLabel.textContent = G.district;
  const respect = G.stats.deliveries * 20 + G.stats.races * 30 + G.stats.photos * 10 + G.stats.fish * 5 + G.missionIdx * 50;
  el.respectBar.style.width = `${Math.min(100, respect / 550 * 100)}%`;
  el.respectLabel.textContent = `RESPECT · ${respect}/550`;
  // Dialog.
  if (G.dialog) {
    el.dialogBox.style.display = 'flex';
    el.dialogPortrait.textContent = (G.dialog.name || '?')[0];
    el.dialogName.textContent = G.dialog.name + (G.dialog.role ? ` · ${G.dialog.role}` : '');
    el.dialogText.textContent = G.dialog.text;
  } else el.dialogBox.style.display = 'none';
  // Context prompt.
  let prompt = '';
  const car = driveCarRef(G);
  if (G.talkAvailable) prompt = 'E — Bicara';
  else if (!car && G.nearestCarD < 3.5) prompt = 'E — Curi mobil';
  else if (car) prompt = 'E — Keluar · R — Balapan · H — Klakson';
  else if (G.nearFish) prompt = 'F — Mancing';
  else if (G.nearPhoto) prompt = 'P — Foto';
  el.prompt.textContent = prompt;
  el.prompt.style.display = prompt ? 'block' : 'none';
  // Center message.
  if (G.centerMsgT > 0) {
    G.centerMsgT -= dt;
    el.centerMsg.textContent = G.centerMsgText || '';
    el.centerMsg.style.display = 'block';
  } else el.centerMsg.style.display = 'none';
  // Radio.
  el.radioLine.textContent = CFG.radio;
  el.trackLine.textContent = CFG.tracks[G.audio ? G.audio.track : 0];
  // Speedometer.
  const kmh = Math.round(Math.abs(G.player.speed) * 3.6);
  el.speedNum.textContent = String(kmh);
  el.speedUnit.textContent = 'km/h';
  el.speedGear.textContent = car ? `G${Math.min(5, 1 + Math.floor(Math.abs(car.speed) / 11))}` : '—';
  el.speedCar.textContent = car ? car.name : 'JALAN KAKI';
  el.speedCond.textContent = car ? `CONDITION ${Math.round(car.hp)}%` : '';
  // Fishing bar.
  if (G.fishing) {
    el.fishingBar.style.display = 'block';
    el.fishNeedle.style.left = `${G.fishing.needle * 100}%`;
  } else el.fishingBar.style.display = 'none';
  el.muteBtn.textContent = G.muted ? 'SUARA: MATI (M)' : 'SUARA: HIDUP (M)';
  drawMinimap(G);
}
function drawMinimap(G) {
  const cv = G.el.minimap;
  const ctx = cv.getContext('2d');
  const W = cv.width, k = W / 640;
  const X = (x) => (x + 320) * k, Z = (z) => (z + 320) * k;
  ctx.fillStyle = '#2f8fb0'; ctx.fillRect(0, 0, W, W);
  ctx.fillStyle = '#d9c08a'; ctx.fillRect(X(-300), 0, (48) * k, W);
  ctx.fillStyle = '#7d8590';
  for (const cx of [-288, -180, -60, 60, 180, 288]) for (const cz of [-288, -180, -60, 60, 180, 288])
    ctx.fillRect(X(cx - 53), Z(cz - 53), 106 * k, 106 * k);
  ctx.fillStyle = '#8b8578'; ctx.fillRect(X(246), 0, 74 * k, W);
  ctx.fillStyle = '#9a938a'; ctx.fillRect(X(96), Z(96), 72 * k, 72 * k);
  ctx.strokeStyle = '#3d434b'; ctx.lineWidth = 14 * k;
  for (const r of CFG.roads) {
    ctx.beginPath(); ctx.moveTo(X(r), 0); ctx.lineTo(X(r), W); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, Z(r)); ctx.lineTo(W, Z(r)); ctx.stroke();
  }
  ctx.strokeStyle = '#ffd23d'; ctx.lineWidth = 1;
  for (const r of CFG.roads) {
    ctx.beginPath(); ctx.moveTo(X(r), 0); ctx.lineTo(X(r), W); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, Z(r)); ctx.lineTo(W, Z(r)); ctx.stroke();
  }
  for (const r of CFG.ringRoads) {
    ctx.strokeStyle = '#3d434b'; ctx.lineWidth = 14 * k;
    ctx.beginPath(); ctx.moveTo(X(r), 0); ctx.lineTo(X(r), W); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, Z(r)); ctx.lineTo(W, Z(r)); ctx.stroke();
  }
  ctx.strokeStyle = '#c8b898'; ctx.lineWidth = 10 * k;
  ctx.beginPath(); ctx.moveTo(X(-258), 0); ctx.lineTo(X(-258), W); ctx.stroke();
  const dot = (x, z, c, r) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(X(x), Z(z), r, 0, 7); ctx.fill(); };
  dot(CFG.garage[0], CFG.garage[1], '#2eff8a', 4);
  dot(CFG.spray[0], CFG.spray[1], '#c26bff', 4);
  for (const s of PHOTO_SPOTS) dot(s.x, s.z, '#37e0ff', 3);
  for (const c of G.traffic || []) dot(c.x, c.z, '#aaaaaa', 2);
  for (const u of [...G.policeCars, ...G.footCops]) dot(u.x, u.z, '#ff2020', 3);
  if (G.missionIdx < MISSIONS.length) {
    const pulse = 4 + Math.sin(G.elapsed * 4) * 2;
    dot(G.missionX, G.missionZ, '#ffd23d', pulse);
  }
  // Player arrow.
  ctx.save();
  ctx.translate(X(G.player.x), Z(G.player.z));
  ctx.rotate(Math.atan2(Math.sin(G.player.heading), Math.cos(G.player.heading)) * -1 + Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
}
