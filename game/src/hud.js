// SOLARA BAY — HUD: mission panel, vitals, wanted stars, cash, clock,
// PCPD response list, radio, speedometer, dialogue, prompts, toasts,
// circular minimap, and title / pause / end screens + localStorage saves.
// All HUD text is DOM (crisp by construction); the 3D world stays in canvas.
import { CFG, WEAPONS, RADIO_TRACKS, SAVE_KEY } from './config.js';
import { MISSIONS, missionObjectiveText } from './missions.js';
import { districtAt } from './city.js';
import { policeUnits } from './police.js';
import { currentWeapon } from './combat.js';

function $(id) { return document.getElementById(id); }

export function initHUD(G, cbs) {
  G.hud = { flashWanted: 0, dialogUntil: 0, toastUntil: 0, trackIdx: 0 };
  const bind = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => { G.audio.unlock(); G.audio.click(); fn(); }); };
  bind('btn-new', () => cbs.onNew());
  bind('btn-continue', () => cbs.onContinue());
  bind('btn-resume', () => cbs.onResume());
  bind('btn-restart-mission', () => cbs.onRestartMission());
  bind('btn-save-quit', () => cbs.onSaveQuit());
  bind('btn-retry', () => cbs.onRetry());
  bind('btn-roam', () => cbs.onRoam());
  bind('btn-title', () => cbs.onTitle());
  const save = loadGame();
  const info = $('save-info');
  if (info) info.textContent = save ? `Continue — Job ${save.missionIndex + 1}/8 · $${save.cash}` : '';
  const cont = $('btn-continue');
  if (cont && !save) cont.style.display = 'none';
}

export function showDialog(G, speaker, role, text) {
  const d = $('dialogue');
  if (!d) return;
  $('dialogue-name').textContent = `${speaker.toUpperCase()} · ${role}`;
  $('dialogue-portrait').textContent = speaker[0].toUpperCase();
  $('dialogue-text').textContent = text;
  d.style.display = 'flex';
  G.hud.dialogUntil = performance.now() / 1000 + 7;
}

export function showObjective(G, text) {
  const el = $('mission-objective');
  if (el) el.textContent = text;
}

export function setPrompt(G, text) { G._promptText = text; }

export function toast(G, text) {
  const el = $('toast');
  if (!el) return;
  el.textContent = text;
  el.style.display = 'block';
  G.hud.toastUntil = performance.now() / 1000 + 3;
}

export function setPhase(G, phase) {
  G.phase = phase;
  const show = (id, on) => { const el = $(id); if (el) el.style.display = on ? 'flex' : 'none'; };
  show('title-screen', phase === 'title');
  show('pause-screen', phase === 'pause');
  const end = phase === 'dead' || phase === 'busted' || phase === 'failed' || phase === 'won';
  show('end-screen', end);
  const hud = $('hud');
  if (hud) hud.style.display = (phase === 'play' || phase === 'pause') ? 'block' : 'none';
  if (end) {
    const titles = { dead: 'K.O.', busted: 'DITANGKAP', failed: 'MISI GAGAL', won: 'SOLARA BAY MILIKMU' };
    const subs = {
      dead: 'Nico tumbang. Coba lagi dari checkpoint.',
      busted: 'PCPD menangkapmu. Misi diulang dari checkpoint.',
      failed: (G._failReason || 'Misi gagal') + ' — coba lagi.',
      won: 'Utang lunas. Dario kalah. Golden Hour milikmu, Nico.',
    };
    $('end-title').textContent = titles[phase] || 'K.O.';
    $('end-sub').textContent = subs[phase] || '';
    const roam = $('btn-roam');
    if (roam) roam.style.display = (phase === 'failed' || phase === 'won') ? 'inline-block' : 'none';
  }
  if (phase === 'play') {
    const d = $('dialogue');
    if (d && performance.now() / 1000 > G.hud.dialogUntil) d.style.display = 'none';
  }
}

function drawMinimap(G) {
  const cv = $('minimap');
  if (!cv) return;
  const g = cv.getContext('2d');
  const S = 200, k = S / 640;
  const X = (x) => (x + 320) * k, Z = (z) => (z + 320) * k;
  g.clearRect(0, 0, S, S);
  g.fillStyle = '#101c26'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#1d6f8e'; g.fillRect(0, 0, X(-246), S);
  g.fillStyle = '#d9c08a'; g.fillRect(X(-258), 0, X(-246) - X(-258), S);
  g.strokeStyle = '#3a3d42'; g.lineWidth = 4;
  for (const r of CFG.roads) {
    g.beginPath(); g.moveTo(X(r), 0); g.lineTo(X(r), S); g.stroke();
    g.beginPath(); g.moveTo(0, Z(r)); g.lineTo(S, Z(r)); g.stroke();
  }
  g.fillStyle = '#8dff9e';
  g.fillRect(X(CFG.garage.x) - 3, Z(CFG.garage.z) - 3, 6, 6);
  g.fillStyle = '#c9a0ff';
  g.fillRect(X(CFG.gunShop.x) - 3, Z(CFG.gunShop.z) - 3, 6, 6);
  g.fillRect(X(CFG.sprayShop.x) - 3, Z(CFG.sprayShop.z) - 3, 6, 6);
  if (G.missionTarget) {
    const pulse = 5 + Math.sin(performance.now() / 250) * 2;
    g.fillStyle = '#ffd23f';
    g.beginPath(); g.arc(X(G.missionTarget.x), Z(G.missionTarget.z), pulse, 0, Math.PI * 2); g.fill();
  }
  for (const u of G.policeCars) {
    g.fillStyle = '#ff5f5f';
    g.beginPath(); g.arc(X(u.car.x), Z(u.car.z), 3, 0, Math.PI * 2); g.fill();
  }
  const px = X(G.player.x), pz = Z(G.player.z);
  g.save();
  g.translate(px, pz);
  g.rotate(Math.atan2(Math.sin(G.player.heading), Math.cos(G.player.heading)));
  g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
  g.restore();
}

export function updateHUD(G, dt) {
  const now = performance.now() / 1000;
  const d = $('dialogue');
  if (d && now > G.hud.dialogUntil) d.style.display = 'none';
  const t = $('toast');
  if (t && now > G.hud.toastUntil) t.style.display = 'none';
  const m = MISSIONS[G.missionIndex] || null;
  const chap = $('mission-chapter');
  if (chap) chap.textContent = m ? `${m.chapter} · ${m.name}` : 'FREE ROAM';
  const obj = $('mission-objective');
  if (obj) obj.textContent = missionObjectiveText(G);
  const stage = $('mission-stage');
  if (stage && m) stage.textContent = `STAGE ${G.missionStep + 1}/${m.steps.length}`;
  const fill = $('mission-stage-fill');
  if (fill && m) fill.style.width = `${((G.missionStep + (m.steps.length ? 0 : 0)) / m.steps.length) * 100}%`;
  const timer = $('mission-timer');
  if (timer) timer.textContent = G.missionTimer !== null && G.missionTimer !== undefined ? fmtTime(G.missionTimer) : '';
  const next = $('mission-next');
  if (next) next.textContent = m && G.missionStep + 1 < m.steps.length ? `NEXT ${m.steps[G.missionStep + 1].text}` : (m ? `REWARD $${m.reward}` : '');
  const hf = $('health-fill');
  if (hf) hf.style.width = `${G.health}%`;
  const af = $('armor-fill');
  if (af) af.style.width = `${G.armor}%`;
  const w = currentWeapon(G);
  const wn = $('weapon-name');
  if (wn) wn.textContent = w.name;
  const wa = $('weapon-ammo');
  if (wa) wa.textContent = w.ammo === Infinity ? '∞' : (G.ammo[w.id] ?? w.ammo);
  const stars = $('stars');
  if (stars) {
    stars.textContent = '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
    stars.style.color = G.wanted > 0 ? '#ffd23f' : '#8888aa';
  }
  const cash = $('cash');
  if (cash) cash.textContent = `$${G.cash.toLocaleString('en-US')}`;
  const clock = $('clock');
  if (clock) {
    const hh = Math.floor(G.timeOfDay) % 24;
    const mm = Math.floor((G.timeOfDay % 1) * 60);
    clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  const day = $('day-line');
  if (day) day.textContent = `DAY ${G.day}`;
  const ws = $('wanted-state');
  if (ws) {
    ws.style.display = G.wanted > 0 ? 'block' : 'none';
    ws.textContent = G.wanted >= 4 ? 'MANHUNT — LOSE THE COPS' : G.wanted >= 2 ? 'POLICE PURSUIT' : 'WANTED';
  }
  const slots = $('weapon-slots');
  if (slots) {
    slots.innerHTML = WEAPONS.map((wp, i) => {
      const locked = wp.locked || (wp.id === 'breaker' && !G.owned.breaker);
      return `<span style="color:${i === G.weapon ? '#ffd23f' : locked ? '#666' : '#ccc'}">${i + 1} ${wp.name}${locked ? ' 🔒' : ''}</span>`;
    }).join(' · ');
  }
  const plist = $('police-list');
  if (plist) {
    const units = policeUnits(G).slice(0, 5);
    plist.style.display = units.length ? 'block' : 'none';
    plist.innerHTML = units.length
      ? `<b>PCPD RESPONSE · ${units.length} UNITS</b><br>` + units.map((u) => `${u.callsign} ${u.dist}m ${u.mode}`).join('<br>')
      : '';
  }
  const dn = $('district-name');
  if (dn) dn.textContent = districtAt(G.player.x, G.player.z);
  const rf = $('respect-fill');
  if (rf) rf.style.width = `${Math.min(100, (G.missionIndex / MISSIONS.length) * 100)}%`;
  const rl = $('respect-label');
  if (rl) rl.textContent = `RESPECT · ${['ROOKIE', 'HUSTLER', 'SHOT CALLER', 'KINGPIN', 'LEGEND'][Math.min(4, Math.floor(G.missionIndex / 2))]} ${G.missionIndex}/${MISSIONS.length}`;
  const rs = $('radio-station');
  if (rs) rs.textContent = `♪ ${CFG.radioStation}`;
  const rt = $('radio-track');
  if (rt) rt.textContent = RADIO_TRACKS[Math.floor(G.timeOfDay / 6) % RADIO_TRACKS.length];
  const sb = $('speed-box');
  if (sb) {
    sb.style.display = G.inCar && G.car ? 'block' : 'none';
    if (G.inCar && G.car) {
      const kmh = Math.round(Math.abs(G.car.speed) * 3.6);
      $('speed-car').textContent = G.car.def.name;
      $('speed-value').textContent = String(kmh);
      $('speed-gear').textContent = `G${1 + Math.min(5, Math.floor(kmh / 30))}`;
      const cf = $('speed-condition-fill');
      if (cf) cf.style.width = `${G.car.hp || 100}%`;
    }
  }
  const pr = $('prompt');
  if (pr) {
    pr.style.display = G._promptText ? 'block' : 'none';
    pr.textContent = G._promptText || '';
  }
  drawMinimap(G);
  if (G.hud.flashWanted > 0) G.hud.flashWanted -= dt;
}

function fmtTime(s) {
  const m = Math.floor(Math.max(0, s) / 60);
  const ss = Math.floor(Math.max(0, s) % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
}

export function saveGame(G) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: G.cash, missionIndex: G.missionIndex, coinsGot: G.coinsGot || 0,
      taxiDone: G.taxi.done, kills: G.kills || 0, time: G.stats.time, day: G.day,
    }));
  } catch (err) { /* storage unavailable */ }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* ignore */ }
}
