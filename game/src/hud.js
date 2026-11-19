import { CFG, WEAPONS, RADIO_TRACKS, SAVE_KEY } from './config.js';
import { MISSIONS, missionObjectiveText } from './missions.js';
import { districtAt } from './city.js';
import { policeUnits } from './police.js';
import { currentWeapon } from './combat.js';

const RESPECT_TITLES = ['ROOKIE', 'HUSTLER', 'DRIVER', 'SHOT CALLER', 'LEGEND'];

function el(id) { return document.getElementById(id); }
function fmtCash(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
function fmtTime(t) {
  const h = Math.floor(t) % 24, m = Math.floor((t % 1) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
function fmtTimer(s) {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return m + ':' + String(ss).padStart(2, '0');
}

export function initHUD(G, cbs) {
  const hud = {
    policeTimer: 0, radioTimer: 0, dialogTimer: 0, toastTimer: 0,
    lastObjective: '',
  };
  const slots = el('weapon-slots');
  if (slots) {
    slots.innerHTML = '';
    WEAPONS.forEach((w, i) => {
      const d = document.createElement('div');
      d.className = 'slot';
      d.id = 'slot-' + i;
      d.innerHTML = `<span class="slot-key">${i + 1}</span><span class="slot-name">${w.name}</span><span class="slot-ammo" id="slot-ammo-${i}"></span>`;
      slots.appendChild(d);
    });
  }
  const bind = (id, fn) => { const b = el(id); if (b) b.addEventListener('click', () => { G.audio.ensure(); G.audio.click(); fn(); }); };
  bind('btn-new', () => cbs.onNew());
  bind('btn-continue', () => cbs.onContinue());
  bind('btn-resume', () => cbs.onResume());
  bind('btn-restart-mission', () => cbs.onRestartMission());
  bind('btn-save-quit', () => cbs.onSaveQuit());
  bind('btn-retry', () => cbs.onRetry());
  bind('btn-roam', () => cbs.onRoam());
  bind('btn-title', () => cbs.onTitle());
  const save = loadGame();
  const cont = el('btn-continue');
  if (cont) cont.style.display = save ? 'block' : 'none';
  const info = el('save-info');
  if (info && save) info.textContent = `Save: ${fmtCash(save.cash)} · Misi ${save.missionIndex + 1}/8 · ${save.coinsCollected || 0} Sun Coins`;
  return hud;
}

export function showDialog(G, speaker, role, text) {
  const d = el('dialogue');
  if (!d) return;
  const portrait = el('dialogue-portrait');
  if (portrait) {
    const initials = speaker.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    portrait.textContent = initials;
    const hues = { Marco: 330, Lupe: 190, Mara: 160, Kip: 45, 'Sal Vega': 280 };
    portrait.style.background = `linear-gradient(135deg, hsl(${hues[speaker] || 220} 70% 55%), hsl(${(hues[speaker] || 220) + 40} 70% 35%))`;
  }
  const name = el('dialogue-name');
  if (name) name.textContent = `${speaker.toUpperCase()} · ${role || 'CONTACT'}`;
  const body = el('dialogue-text');
  if (body) body.textContent = text;
  d.style.display = 'flex';
  G.hud.dialogTimer = 6;
}

export function showObjective(G, text) {
  const o = el('mission-objective');
  if (o) o.textContent = text;
  G.hud.lastObjective = text;
}

export function setPrompt(G, text) {
  const p = el('prompt');
  if (!p) return;
  if (text) { p.textContent = text; p.style.display = 'block'; }
  else p.style.display = 'none';
}

export function toast(G, text) {
  const t = el('toast');
  if (!t) return;
  t.textContent = text;
  t.style.display = 'block';
  t.style.opacity = '1';
  G.hud.toastTimer = 3;
}

export function setPhase(G, phase) {
  const show = (id, on) => { const n = el(id); if (n) n.style.display = on ? 'flex' : 'none'; };
  show('title-screen', phase === 'title');
  show('pause-screen', phase === 'pause');
  const end = phase === 'dead' || phase === 'busted' || phase === 'missionFailed' || phase === 'finale';
  show('end-screen', end);
  const hudRoot = el('hud');
  if (hudRoot) hudRoot.style.display = phase === 'play' ? 'block' : 'none';
  if (end) {
    const title = el('end-title'), sub = el('end-sub');
    const retry = el('btn-retry'), roam = el('btn-roam');
    if (phase === 'dead') { if (title) title.textContent = 'K.O.'; if (sub) sub.textContent = 'Nico tumbang. Solara Bay tidak menunggu siapa pun.'; }
    if (phase === 'busted') { if (title) title.textContent = 'DITANGKAP'; if (sub) sub.textContent = 'PCPD memborgol Nico. Untung masih bisa kabur dari kantor polisi.'; }
    if (phase === 'missionFailed') { if (title) title.textContent = 'MISI GAGAL'; if (sub) sub.textContent = 'Coba lagi — checkpoint sudah menunggu.'; }
    if (phase === 'finale') { if (title) title.textContent = 'UTANG LUNAS'; if (sub) sub.textContent = 'Golden Hour selesai. Nico bebas — Solara Bay milikmu. Free roam terus jalan.'; }
    if (retry) retry.style.display = phase === 'missionFailed' || phase === 'dead' || phase === 'busted' ? 'block' : 'none';
    if (roam) roam.style.display = phase === 'finale' ? 'block' : 'none';
  }
}

function drawMinimap(G) {
  const cv = el('minimap');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const S = 200, k = S / 640;
  const px = (x) => (x + 320) * k;
  const pz = (z) => (z + 320) * k;
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#20262e'; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#1d6f8e'; ctx.fillRect(0, 0, px(-258), S);
  ctx.fillStyle = '#d9c08a'; ctx.fillRect(px(-258), 0, px(-246) - px(-258), S);
  ctx.fillStyle = '#3a3f45';
  const lines = CFG.roads;
  const edges = [-300, ...lines, 300];
  for (let i = 0; i < edges.length - 1; i++) {
    for (let j = 0; j < edges.length - 1; j++) {
      if (edges[i + 1] < -246) continue;
      ctx.fillRect(px(edges[i] + 9), pz(edges[j] + 9), px(edges[i + 1] - 9) - px(edges[i] + 9), pz(edges[j + 1] - 9) - pz(edges[j] + 9));
    }
  }
  ctx.strokeStyle = '#c8c8c0'; ctx.lineWidth = 2;
  for (const r of lines) {
    ctx.beginPath(); ctx.moveTo(px(r), 0); ctx.lineTo(px(r), S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, pz(r)); ctx.lineTo(S, pz(r)); ctx.stroke();
  }
  const dot = (x, z, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(px(x), pz(z), r || 3, 0, Math.PI * 2); ctx.fill();
  };
  dot(CFG.garage.x, CFG.garage.z, '#3ddc5a', 3.5);
  dot(CFG.sprayShop.x, CFG.sprayShop.z, '#b46fe8', 3);
  dot(CFG.gunShop.x, CFG.gunShop.z, '#b46fe8', 3);
  dot(CFG.taxiStand.x, CFG.taxiStand.z, '#ffd23f', 3);
  if (G.missionTarget) {
    const pulse = 4 + Math.sin(performance.now() / 200) * 1.5;
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px(G.missionTarget.x), pz(G.missionTarget.z), pulse, 0, Math.PI * 2); ctx.stroke();
    dot(G.missionTarget.x, G.missionTarget.z, '#ffd23f', 3);
  }
  const blink = Math.sin(performance.now() / 150) > 0;
  for (const pc of G.policeCars) dot(pc.car.x, pc.car.z, blink ? '#ff4040' : '#4080ff', 3);
  for (const fp of G.footPolice) dot(fp.x, fp.z, '#4080ff', 2.5);
  const pxp = px(G.player.x), pzp = pz(G.player.z);
  ctx.save();
  ctx.translate(pxp, pzp);
  ctx.rotate(G.player.heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

export function updateHUD(G, dt) {
  const hud = G.hud;
  if (!hud) return;
  const m = MISSIONS[G.missionIndex];
  const chapter = el('mission-chapter');
  if (chapter) chapter.textContent = m ? `JOB ${G.missionIndex + 1}/8 · ${m.name}` : 'FREE ROAM';
  const timer = el('mission-timer');
  if (timer) {
    if (m && G.missionTimer > 0) { timer.textContent = '◷ ' + fmtTimer(G.missionTimer); timer.style.display = 'inline'; }
    else timer.style.display = 'none';
  }
  const obj = el('mission-objective');
  if (obj && hud.lastObjective !== missionObjectiveText(G)) {
    obj.textContent = missionObjectiveText(G);
    hud.lastObjective = obj.textContent;
  }
  const stage = el('mission-stage');
  if (stage) {
    if (m) {
      const pct = Math.round(((G.missionStage) / m.steps.length) * 100);
      stage.textContent = `STAGE ${G.missionStage + 1}/${m.steps.length}`;
      const bar = el('mission-stage-fill');
      if (bar) bar.style.width = pct + '%';
    } else stage.textContent = '';
  }
  const next = el('mission-next');
  if (next) {
    if (m) {
      const nm = MISSIONS[G.missionIndex + 1];
      next.textContent = nm ? 'NEXT: ' + nm.name : 'NEXT: Golden Hour selesai — free roam';
    } else next.textContent = '';
  }
  const hf = el('health-fill'); if (hf) hf.style.width = G.health + '%';
  const af = el('armor-fill'); if (af) af.style.width = G.armor + '%';
  const w = currentWeapon(G);
  const wn = el('weapon-name'); if (wn) wn.textContent = w.name + (w.id === 'mako' ? ' SMG' : w.id === 'vesper' ? ' PISTOL' : w.id === 'breaker' ? ' SHOTGUN' : '');
  const wa = el('weapon-ammo');
  if (wa) wa.textContent = w.id === 'fists' ? '∞' : String(G.ammo[w.id] || 0);
  WEAPONS.forEach((ww, i) => {
    const slot = el('slot-' + i);
    if (!slot) return;
    slot.classList.toggle('active', i === G.weapon);
    const sa = el('slot-ammo-' + i);
    if (sa) {
      if (ww.locked) sa.textContent = 'LOCKED';
      else if (ww.id === 'breaker' && !G.owned.breaker) sa.textContent = '$3,800';
      else if (ww.id === 'fists') sa.textContent = '∞';
      else sa.textContent = String(G.ammo[ww.id] || 0);
    }
  });
  const day = el('day-line'); if (day) day.textContent = 'DAY ' + G.day;
  const cash = el('cash'); if (cash) cash.textContent = fmtCash(G.cash);
  const clock = el('clock'); if (clock) clock.textContent = fmtTime(G.timeOfDay);
  const stars = el('stars');
  if (stars) {
    stars.textContent = '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
    stars.style.color = G.wanted > 0 ? '#ffd23f' : '#888';
  }
  const ws = el('wanted-state');
  if (ws) {
    ws.textContent = G.wanted > 0 ? (G.policeCars.length ? 'IN SIGHT' : 'HIDDEN — cari tempat sembunyi') : '';
    ws.style.display = G.wanted > 0 ? 'block' : 'none';
  }
  hud.policeTimer -= dt;
  if (hud.policeTimer <= 0) {
    hud.policeTimer = 0.5;
    const list = el('police-list');
    if (list) {
      const units = policeUnits(G);
      if (G.wanted > 0 && units.length) {
        list.style.display = 'block';
        let html = `<div class="pl-head">● PCPD RESPONSE &nbsp; ${units.length} UNITS · CODE ${G.wanted + 1}</div>`;
        for (const u of units.slice(0, 5)) {
          const cls = u.role === 'RAMMING' ? 'ram' : u.role === 'SPOTLIGHT' ? 'spot' : u.role === 'FIRING' ? 'ram' : 'pur';
          html += `<div class="pl-row"><span>${u.callsign}</span><span>${u.dist} m</span><span class="pl-tag ${cls}">${u.role}</span></div>`;
        }
        if (units.length > 5) html += `<div class="pl-more">+${units.length - 5} more units in the search zone</div>`;
        list.innerHTML = html;
      } else list.style.display = 'none';
    }
  }
  drawMinimap(G);
  const dn = el('district-name');
  if (dn) dn.textContent = districtAt(G.player.x, G.player.z);
  const rl = el('respect-label');
  const level = Math.min(5, G.stats.missionsDone + 1);
  if (rl) rl.textContent = `RESPECT · ${RESPECT_TITLES[level - 1]} ${level}/5`;
  const rf = el('respect-fill');
  if (rf) rf.style.width = (level * 20) + '%';
  hud.radioTimer -= dt;
  if (hud.radioTimer <= 0) {
    hud.radioTimer = 25;
    G.radioTrack = (G.radioTrack + 1) % RADIO_TRACKS.length;
    const rt = el('radio-track');
    if (rt) rt.textContent = RADIO_TRACKS[G.radioTrack];
  }
  const rs = el('radio-station');
  if (rs) rs.textContent = '♪ ' + CFG.radioStation;
  const speedEl = el('speed-value');
  const carEl = el('speed-car');
  const gearEl = el('speed-gear');
  const condEl = el('speed-condition-fill');
  const speedBox = el('speed-box');
  if (G.inCar && G.car) {
    if (speedBox) speedBox.style.display = 'block';
    const kmh = Math.round(Math.abs(G.car.speed) * 3.6);
    if (speedEl) speedEl.textContent = String(kmh);
    if (carEl) carEl.textContent = G.car.name;
    if (gearEl) gearEl.textContent = 'G' + (1 + Math.min(4, Math.floor(Math.abs(G.car.speed) / 10)));
    if (condEl) condEl.style.width = G.car.hp + '%';
  } else if (speedBox) speedBox.style.display = 'none';
  if (hud.dialogTimer > 0) {
    hud.dialogTimer -= dt;
    if (hud.dialogTimer <= 0) { const d = el('dialogue'); if (d) d.style.display = 'none'; }
  }
  if (hud.toastTimer > 0) {
    hud.toastTimer -= dt;
    if (hud.toastTimer <= 0) { const t = el('toast'); if (t) t.style.opacity = '0'; }
  }
  if (G._promptText) setPrompt(G, G._promptText);
  else setPrompt(G, null);
}

export function saveGame(G) {
  try {
    const data = {
      cash: G.cash, missionIndex: G.missionIndex, missionsDone: G.stats.missionsDone,
      coinsCollected: G.coinsCollected || 0, weapon: G.weapon, ammo: G.ammo,
      day: G.day, timeOfDay: G.timeOfDay, owned: G.owned, stats: G.stats,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
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
