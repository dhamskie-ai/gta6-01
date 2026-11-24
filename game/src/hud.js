// HUD: mission panel, vitals, top-right cluster, PCPD list, circular minimap,
// portrait dialogue, radio + speedometer, menus, save/load.
// NOTE: MISSIONS must be imported (a missing import page-errors every frame).
import { G, CFG, fmtCash, clamp } from './config.js';
import { MISSIONS, missionInfo, saveGame, loadSave, applySave } from './missions.js';
import { WEAPONS } from './combat.js';
import { districtAt } from './city.js';

const ROLES = { 'Sal Vega': 'FIXER', 'Kip': 'HACKER', 'Mara Voss': 'MECHANIC',
  'Marco': 'WHEELMAN', 'Lupe': 'CLIENT', 'Dario Kane': 'DEVELOPER', 'Nico': 'DRIVER' };
const $ = (id) => document.getElementById(id);
let els = {}, mmCtx = null, pcpdT = 0, radioT = 0, radioI = 0;

export function initHud() {
  const ids = ['missionPanel', 'mpChapter', 'mpTimer', 'mpObjective', 'mpStage', 'mpNext',
    'hpBar', 'hpText', 'armorBar', 'weaponSlots', 'ammoText',
    'dayLine', 'stars', 'cash', 'clock', 'wantedState', 'pcpdList', 'pcpdTitle',
    'minimap', 'districtName', 'respectBar', 'respectLabel',
    'dialog', 'dlgPortrait', 'dlgName', 'dlgText',
    'radioStation', 'radioTrack', 'speedNum', 'carName', 'condBar', 'condWrap', 'speedUnit',
    'prompt', 'toast', 'jobsLine',
    'titleScreen', 'btnNew', 'btnContinue', 'pauseScreen', 'btnResume', 'btnRestart', 'btnSaveQuit',
    'overScreen', 'overTitle', 'overText', 'btnRetry', 'muteBtn', 'hint'];
  for (const id of ids) els[id] = $(id);
  mmCtx = els.minimap ? els.minimap.getContext('2d') : null;
  if (els.btnNew) els.btnNew.onclick = () => window.__startNew && window.__startNew();
  if (els.btnContinue) els.btnContinue.onclick = () => window.__startContinue && window.__startContinue();
  if (els.btnResume) els.btnResume.onclick = () => { G.phase = 'play'; showOnly('hud'); };
  if (els.btnRestart) els.btnRestart.onclick = () => window.__startNew && window.__startNew();
  if (els.btnSaveQuit) els.btnSaveQuit.onclick = () => { saveGame(); G.phase = 'title'; showOnly('title'); };
  if (els.btnRetry) els.btnRetry.onclick = () => window.__startNew && window.__startNew();
  if (els.muteBtn) els.muteBtn.onclick = () => {
    G.muted = !G.muted;
    if (window.__audio) window.__audio.setMuted(G.muted);
    els.muteBtn.textContent = G.muted ? '🔇' : '🔊';
  };
  const save = loadSave();
  if (els.btnContinue) els.btnContinue.classList.toggle('hidden', !save);
}
export function showOnly(which) {
  const map = { hud: [], title: ['titleScreen'], pause: ['pauseScreen'], over: ['overScreen'] };
  for (const id of ['titleScreen', 'pauseScreen', 'overScreen']) {
    if (els[id]) els[id].classList.toggle('hidden', !(map[which] || []).includes(id));
  }
}
export function showDialog(name, role, text, dur = 5000) {
  if (!els.dialog) return;
  const clean = text.includes(':') ? text.split(':').slice(1).join(':').trim() : text;
  els.dlgPortrait.textContent = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  els.dlgPortrait.style.background = 'linear-gradient(135deg,#ff2e7e,#7a4a8a)';
  els.dlgName.textContent = name.toUpperCase() + ' · ' + (role || ROLES[name] || 'CONTACT');
  els.dlgText.textContent = clean;
  els.dialog.classList.remove('hidden');
  G.dialogUntil = performance.now() + dur;
}
export function setObjective(t) { if (els.mpObjective) els.mpObjective.textContent = t; }
export function setPrompt(t) { if (els.prompt) { els.prompt.textContent = t; els.prompt.classList.remove('hidden'); } }
export function clearPrompt() { if (els.prompt) els.prompt.classList.add('hidden'); }
export function toast(t) {
  if (!els.toast) return;
  els.toast.textContent = t; els.toast.classList.remove('hidden');
  G.toastUntil = performance.now() + 3500;
}
function stars(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }
export function updateHud(dt) {
  if (!els.missionPanel) return;
  const mi = missionInfo();
  els.mpChapter.textContent = mi.chapter;
  els.mpTimer.textContent = mi.timer;
  els.mpTimer.classList.toggle('hidden', !mi.timer);
  els.mpObjective.textContent = mi.objective;
  els.mpStage.textContent = mi.stage;
  els.mpNext.textContent = mi.next;
  // Vitals.
  els.hpBar.style.width = clamp(G.health, 0, 100) + '%';
  els.hpText.textContent = 'HP ' + Math.round(G.health);
  els.armorBar.style.width = clamp(G.armor, 0, 100) + '%';
  const w = WEAPONS[G.weapon];
  els.ammoText.textContent = G.weapon === 0 ? 'FISTS' : (w.name + '  ' + G.mag[G.weapon] + '/' + (G.ammo[G.weapon] === Infinity ? '∞' : G.ammo[G.weapon]));
  els.weaponSlots.innerHTML = ['FISTS', 'VESPER', 'MAKO', 'BREAKER'].map((n, i) =>
    '<span class="wslot' + (i === G.weapon ? ' on' : '') + '">' + (i + 1) + ' ' + n + '</span>').join(' ');
  // Top-right cluster.
  const hh = Math.floor(G.timeOfDay), mm = Math.floor((G.timeOfDay - hh) * 60);
  els.dayLine.textContent = 'DAY ' + G.day;
  els.stars.textContent = stars(G.wanted);
  els.stars.style.color = G.wanted > 0 ? '#ff5a5a' : '#ffd23e';
  els.cash.textContent = fmtCash(G.cash);
  els.clock.textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ' · ' + (G.timeOfDay >= 18.5 || G.timeOfDay < 6 ? 'MALAM' : 'SIANG');
  els.wantedState.textContent = G.wanted > 0 ? (G.hiddenT > 2 ? 'HIDDEN' : 'IN SIGHT') : '';
  // PCPD response list (rebuild ≤ 2×/s).
  pcpdT -= dt;
  if (pcpdT <= 0) {
    pcpdT = 0.5;
    const units = G.policeUnits || [];
    els.pcpdTitle.textContent = 'PCPD RESPONSE · ' + units.length + ' UNITS';
    els.pcpdList.classList.toggle('hidden', G.wanted === 0);
    if (G.wanted > 0) {
      els.pcpdList.innerHTML = '<div class="pcpd-h">' + els.pcpdTitle.textContent + '</div>' +
        units.slice(0, 6).map((u) =>
          '<div class="pcpd-r"><b>' + u.callsign + '</b> ' + u.dist + 'm <span class="' +
          (u.role === 'RAMMING' ? 'ram' : u.role === 'PATROL' ? 'pat' : 'pur') + '">' + u.role + '</span></div>').join('') +
        (units.length > 6 ? '<div class="pcpd-r">+' + (units.length - 6) + ' more units in the search zone</div>' : '');
    }
  }
  // Minimap (200×200, circular via CSS).
  if (mmCtx) drawMinimap();
  const p = G.player;
  if (p) {
    els.districtName.textContent = districtAt(p.x, p.z);
    const respect = clamp(G.stats.missionsDone + 1, 1, 5);
    if (els.respectBar.firstElementChild) els.respectBar.firstElementChild.style.width = (respect * 20) + '%';
    els.respectLabel.textContent = 'RESPECT ' + respect + ' · ' + ['ROOKIE', 'HUSTLER', 'SHOT CALLER', 'KINGPIN', 'LEGEND'][respect - 1];
  }
  // Radio + speed.
  radioT += dt;
  if (radioT > 25) { radioT = 0; radioI = (radioI + 1) % CFG.tracks.length; }
  els.radioStation.textContent = '♪ ' + CFG.radio + ' · Neon Drive';
  els.radioTrack.textContent = CFG.tracks[radioI];
  const car = p && p.car;
  if (car) {
    els.speedNum.textContent = Math.round(Math.abs(car.speed) * 3.6);
    els.carName.textContent = car.name === 'Veloce GT' ? 'VELOZ COMET RS' : car.name.toUpperCase();
    els.condWrap.classList.remove('hidden');
    els.condBar.style.width = clamp(car.hp, 0, 100) + '%';
  } else {
    els.speedNum.textContent = Math.round(Math.abs(p ? p.speed : 0) * 3.6);
    els.carName.textContent = 'ON FOOT';
    els.condWrap.classList.add('hidden');
  }
  // Jobs counters.
  els.jobsLine.textContent = 'FOTO ' + G.stats.photos + ' · IKAN ' + G.stats.fish + ' · TAKSI ' + G.stats.taxiDone + ' · BALAPAN ' + G.stats.raceWins + ' · KOIN ' + G.stats.coins + '/30';
  // Dialog / toast expiry.
  if (els.dialog && performance.now() > G.dialogUntil) els.dialog.classList.add('hidden');
  if (els.toast && performance.now() > G.toastUntil) els.toast.classList.add('hidden');
  if (G.phase === 'over' && els.overScreen && els.overScreen.classList.contains('hidden')) {
    els.overTitle.textContent = G.overKind === 'busted' ? 'DITANGKAP' : 'K.O.';
    els.overText.textContent = G.overKind === 'busted'
      ? 'The PCPD caught you on foot. The crew will bail you out — retry the job.'
      : 'Nico is down. The crew will patch you up — retry the job.';
    showOnly('over');
  }
}
function drawMinimap() {
  const c = mmCtx, S = 200, sc = S / 640;
  c.clearRect(0, 0, S, S);
  c.fillStyle = 'rgba(10,14,24,0.85)'; c.fillRect(0, 0, S, S);
  c.strokeStyle = '#7d8590'; c.lineWidth = 5;
  for (const r of CFG.roads) {
    c.beginPath(); c.moveTo((r + 320) * sc, 0); c.lineTo((r + 320) * sc, S); c.stroke();
    c.beginPath(); c.moveTo(0, (r + 320) * sc); c.lineTo(S, (r + 320) * sc); c.stroke();
  }
  c.strokeStyle = '#ffd23e'; c.lineWidth = 1;
  for (const r of CFG.roads) {
    c.beginPath(); c.moveTo((r + 320) * sc, 0); c.lineTo((r + 320) * sc, S); c.stroke();
    c.beginPath(); c.moveTo(0, (r + 320) * sc); c.lineTo(S, (r + 320) * sc); c.stroke();
  }
  c.strokeStyle = '#7d8590'; c.lineWidth = 5;
  c.beginPath(); c.moveTo((CFG.ringE + 320) * sc, 0); c.lineTo((CFG.ringE + 320) * sc, S); c.stroke();
  c.beginPath(); c.moveTo(0, (CFG.ringS + 320) * sc); c.lineTo(S, (CFG.ringS + 320) * sc); c.stroke();
  // Sea.
  c.fillStyle = '#2f7fb5'; c.fillRect(0, 0, 62 * sc, S);
  // Garage + spray shop.
  c.fillStyle = '#2aff5a'; c.fillRect((CFG.garagePos[0] + 320) * sc - 4, (CFG.garagePos[1] + 320) * sc - 4, 8, 8);
  c.fillStyle = '#c07aff'; c.fillRect((CFG.sprayPos[0] + 320) * sc - 4, (CFG.sprayPos[1] + 320) * sc - 4, 8, 8);
  // Mission marker (beacon target).
  const mi = missionInfo();
  c.fillStyle = '#ffd23e';
  c.beginPath(); c.arc(100, 100, 5, 0, 7); c.fill();
  // Police dots.
  for (const u of G.police) {
    c.fillStyle = u.kind === 'car' ? '#ff3a3a' : '#3a6aff';
    c.beginPath(); c.arc((u.x + 320) * sc, (u.z + 320) * sc, 3.5, 0, 7); c.fill();
  }
  // Player arrow.
  const p = G.player;
  if (p) {
    c.save();
    c.translate((p.x + 320) * sc, (p.z + 320) * sc);
    c.rotate(Math.atan2(Math.sin(p.heading), Math.cos(p.heading)) * 0 + p.heading);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath(); c.fill();
    c.restore();
  }
}
