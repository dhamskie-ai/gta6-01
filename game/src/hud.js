// HUD: mission panel, vitals, cash/stars/clock, PCPD response list,
// circular minimap, district + respect, dialog with portrait, radio
// CELESTE 98.1, speedometer, job counter, prompts, menus, save/load.
// Layout fix (6i): the job counter lives under the mission panel, the
// dialog sits bottom-centre — they can no longer overlap.
import { G, CFG } from './config.js';
import { districtAt } from './city.js';
import { policeUnits } from './police.js';
import { radioTrack, toggleMute, isMuted } from './audio.js';
import { driveCarRef } from './player.js';

const $ = (id) => document.getElementById(id);
const SAVE_KEY = 'solarabay-save-v1';
let dlgTimer = null, policeT = 0, mmCtx = null;

export function initHud() {
  mmCtx = $('minimap').getContext('2d');
  $('mute-btn').addEventListener('click', () => toggleMuteBtn());
  $('btn-new').addEventListener('click', () => window.__startNew?.());
  $('btn-continue').addEventListener('click', () => window.__startContinue?.());
  $('btn-resume').addEventListener('click', () => window.__resume?.());
  $('btn-restart').addEventListener('click', () => window.__restartMission?.());
  $('btn-save').addEventListener('click', () => { saveGame(); announce('GAME TERSIMPAN'); });
  $('btn-quit').addEventListener('click', () => window.__quitToTitle?.());
  $('btn-retry').addEventListener('click', () => window.__retry?.());
  if (!hasSave()) $('btn-continue').style.opacity = '0.4';
}

export function toggleMuteBtn() {
  const m = toggleMute();
  $('mute-btn').textContent = m ? 'SUARA: MATI' : 'SUARA: HIDUP';
}

export function announce(t, dur = 2600) {
  const el = $('center-msg');
  el.textContent = t; el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, dur);
}

export function showDialog(name, role, text, dur = 5200) {
  $('dialog-box').style.display = 'flex';
  $('dialog-portrait').textContent = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  $('dialog-name').textContent = `${name.toUpperCase()} · ${role}`;
  $('dialog-text').textContent = text;
  G.dialogUntil = G.elapsed + dur / 1000;
  clearTimeout(dlgTimer);
  dlgTimer = setTimeout(() => { $('dialog-box').style.display = 'none'; }, dur);
}

export function showObjective(t) { G.objective = t; $('mission-objective').textContent = t; }
export function showPrompt(t) { G.prompt = t; $('prompt').textContent = t; $('prompt').style.display = t ? 'block' : 'none'; }

function fmtCash(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
function fmtClock() {
  const h = Math.floor(G.timeOfDay), m = Math.floor((G.timeOfDay - h) * 60);
  const label = G.timeOfDay < 12 ? 'PAGI' : G.timeOfDay < 17.5 ? 'SIANG' : G.timeOfDay < 19.5 ? 'SORE' : 'MALAM';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${label}`;
}

export function setPhaseUI(phase) {
  $('title-screen').style.display = phase === 'title' ? 'flex' : 'none';
  $('pause-screen').style.display = phase === 'pause' ? 'flex' : 'none';
  $('over-screen').style.display = phase === 'over' || phase === 'busted' ? 'flex' : 'none';
  if (phase === 'over') $('over-title').textContent = 'K.O.';
  if (phase === 'busted') $('over-title').textContent = 'DITANGKAP';
  $('hud').style.display = phase === 'play' ? 'block' : 'none';
}

export function updateHud(dt) {
  if (G.phase !== 'play') return;
  // mission panel from live mission state (set by missions.js on G)
  $('mission-chapter').textContent = G.missionTitle ? `JOB ${G.missionIdx + 1}/8 · ${G.missionTitle.toUpperCase()}` : 'FREE ROAM';
  $('mission-timer').textContent = G.missionTimer > 0
    ? `${Math.floor(G.missionTimer / 60)}:${String(Math.floor(G.missionTimer % 60)).padStart(2, '0')}` : '';
  $('mission-stage').textContent = G.missionTitle ? `STAGE ${G.missionStage + 1}/${G.missionSteps || 1}` : '';
  $('mission-next').textContent = G.missionNext ? `NEXT: ${G.missionNext}` : '';
  $('mission-objective').textContent = G.objective;
  // vitals
  $('hp-bar').style.width = `${Math.max(0, G.health)}%`;
  $('armor-bar').style.width = `${Math.max(0, G.armor)}%`;
  $('weapon-name').textContent = G.weapons[G.weapon];
  $('ammo-count').textContent = G.weapon === 0 ? '—' : `${G.ammo[G.weapon]} peluru`;
  // jobs counter (top-left column, clear of the dialog)
  $('jobs-row').textContent = `TAXI ${G.stats.taxi} · BALAP ${G.stats.races} · IKAN ${G.stats.fish} · FOTO ${G.stats.photos.length}/6 · PAKET ${G.stats.courier}`;
  // top-right cluster
  $('day-label').textContent = `DAY ${G.day}`;
  $('stars').textContent = '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
  $('cash-label').textContent = fmtCash(G.cash);
  $('clock-label').textContent = fmtClock();
  // PCPD list, rebuilt at most twice a second
  policeT -= dt;
  if (policeT <= 0) {
    policeT = 0.5;
    const units = policeUnits();
    const list = $('police-list');
    list.style.display = G.wanted > 0 ? 'block' : 'none';
    if (G.wanted > 0) {
      $('police-head').textContent = `PCPD RESPONSE · ${units.length} UNITS`;
      $('police-rows').innerHTML = units.slice(0, 6).map((u) =>
        `<div class="prow"><span>${u.name}</span><span>${u.d}m</span><span class="${u.role === 'RAMMING' ? 'ram' : 'pur'}">${u.role}</span></div>`).join('')
        + (units.length > 6 ? `<div class="prow">+${units.length - 6} more units in the search zone</div>` : '');
    }
  }
  // radio + speed
  $('radio-line').textContent = `♪ ${CFG.radio} · Neon Drive`;
  $('track-line').textContent = radioTrack();
  const car = driveCarRef();
  if (car) {
    const kmh = Math.round(Math.abs(car.speed) * 3.6);
    $('speed-num').textContent = `${kmh}`;
    $('speed-car').textContent = car.def.name;
    $('speed-cond').style.width = `${Math.max(0, car.hp)}%`;
    $('speed-gear').textContent = `G${1 + Math.min(5, Math.floor(Math.abs(car.speed) / 9))}`;
    $('speed-box').style.display = 'block';
  } else {
    $('speed-box').style.display = 'none';
  }
  // fishing timing bar
  const fb = $('fishing-bar');
  if (G.fish.active) {
    fb.style.display = 'block';
    $('fish-needle').style.left = `${G.fish.needle * 100}%`;
  } else fb.style.display = 'none';
  if (G.dialogUntil && G.elapsed > G.dialogUntil) $('dialog-box').style.display = 'none';
  drawMinimap();
}

export function drawMinimap() {
  if (!mmCtx) return;
  const S = 200, c = mmCtx, px = (m) => ((m + 320) / 640) * S;
  c.clearRect(0, 0, S, S);
  c.fillStyle = '#10151d'; c.fillRect(0, 0, S, S);
  c.fillStyle = '#2f8fb0'; c.fillRect(0, 0, px(-298), S); // sea
  c.fillStyle = '#d9c08a'; c.fillRect(px(-298), 0, px(-252) - px(-298), S); // sand
  c.fillStyle = '#232a35';
  for (let bx = -5; bx <= 5; bx++) for (let bz = -5; bz <= 5; bz++) c.fillRect(px(bx * 60 - 26), px(bz * 60 - 26), px(52) - px(0), px(52) - px(0));
  // roads: light enough to read at a glance (was too dark)
  c.strokeStyle = '#7d8590'; c.lineWidth = 5;
  for (const r of CFG.roads) {
    c.beginPath(); c.moveTo(0, px(r)); c.lineTo(S, px(r)); c.stroke();
    c.beginPath(); c.moveTo(px(r), 0); c.lineTo(px(r), S); c.stroke();
  }
  c.strokeStyle = '#f7c948'; c.lineWidth = 1;
  for (const r of CFG.roads) {
    c.beginPath(); c.moveTo(0, px(r)); c.lineTo(S, px(r)); c.stroke();
    c.beginPath(); c.moveTo(px(r), 0); c.lineTo(px(r), S); c.stroke();
  }
  const dot = (x, z, col, r) => { c.fillStyle = col; c.beginPath(); c.arc(px(x), px(z), r, 0, 7); c.fill(); };
  dot(CFG.garage.x, CFG.garage.z, '#2aff5a', 4); // garage
  dot(CFG.spray.x, CFG.spray.z, '#b48cff', 4); // spray shop
  for (const s of CFG.photoSpots) if (!G.stats.photos.includes(s.id)) dot(s.x, s.z, '#7de3ff', 3);
  // mission marker (pulsing yellow)
  const mx = G.missionX ?? 0, mz = G.missionZ ?? 0;
  if (G.missionIdx < 8) dot(mx, mz, '#ffd23d', 5 + Math.sin(G.elapsed * 5) * 1.5);
  for (const u of G.police) if (u && typeof u.x === 'number') dot(u.x, u.z, '#ff2a2a', 3);
  for (const t of G.traffic) if (t && typeof t.x === 'number') dot(t.x, t.z, '#c8ccd4', 2);
  // player arrow
  c.save();
  c.translate(px(G.player.pos.x), px(G.player.pos.z));
  c.rotate(Math.atan2(Math.sin(G.player.heading), Math.cos(G.player.heading)) + Math.PI);
  c.fillStyle = '#ffffff';
  c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath(); c.fill();
  c.restore();
  $('district-label').textContent = districtAt(G.player.pos.x, G.player.pos.z).toUpperCase();
  $('respect-label').textContent = `RESPECT ${G.respect} · SHOT CALLER`;
  $('respect-bar').style.width = `${Math.min(100, G.respect * 20)}%`;
}

export function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: G.cash, missionIdx: G.missionIdx, health: G.health,
      stats: G.stats, day: G.day, x: G.player.pos.x, z: G.player.pos.z,
    }));
  } catch { /* storage unavailable in some embeds */ }
}

export function loadGame() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!s) return null;
    G.cash = s.cash; G.missionIdx = Math.min(7, s.missionIdx || 0);
    G.health = s.health ?? 100; G.day = s.day || 1;
    Object.assign(G.stats, s.stats || {});
    G.player.pos.set(s.x ?? CFG.startPos.x, 0, s.z ?? CFG.startPos.z);
    return s;
  } catch { return null; }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}
