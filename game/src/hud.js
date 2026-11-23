// HUD: mission panel, vitals, top-right cluster, PCPD response list,
// circular minimap, portrait dialogue, radio, speedometer, menus, save.
import { CFG, MISSIONS, WEAPONS, RADIO_TRACKS } from './config.js';
import { clamp } from './random.js';
import { districtAt } from './city.js';
import { policeUnits } from './police.js';
import { missionLabel, missionStage } from './missions.js';

const ROLES = {
  'Sal Vega': 'FIXER', Kip: 'DRIVER', Mara: 'MECHANIC',
  Marco: 'SMUGGLER · WHEELMAN', 'Juno Reyes': 'WHEELWOMAN',
  'Dario Kane': 'DEVELOPER', Lupe: 'CLIENT',
};
const SAVE_KEY = 'solara-bay-save-v1';
export function formatCash(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}
function el(id) { return document.getElementById(id); }
export function initHud(G) {
  const ids = ['mission-panel', 'msn-chapter', 'msn-timer', 'msn-objective', 'msn-stage',
    'msn-next', 'health-fill', 'armor-fill', 'weapon-slots', 'weapon-name', 'day-line',
    'stars', 'cash', 'clock', 'sight-state', 'pcpd-panel', 'pcpd-head', 'pcpd-list',
    'minimap', 'district-name', 'respect-fill', 'respect-label', 'dialog',
    'dialog-portrait', 'dialog-name', 'dialog-text', 'radio-station', 'radio-track',
    'speed-box', 'car-name', 'condition-fill', 'speed-num', 'gear', 'jobs-panel',
    'jobs-list', 'prompt', 'hint', 'toast', 'title-screen', 'pause-screen', 'over-screen',
    'over-title', 'over-text', 'touch-controls', 'mute-btn', 'fps-box',
    'btn-new', 'btn-continue', 'btn-resume', 'btn-restart', 'btn-save',
    'btn-quit', 'btn-retry', 'quality-select'];
  G.el = {};
  for (const id of ids) {
    const camel = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    G.el[camel] = el(id);
  }
  G.el.mapCtx = G.el.minimap ? G.el.minimap.getContext('2d') : null;
  G.dialogT = 0; G.radioT = 0; G.radioIdx = 0;
  G.objective = 'Steal the VELOZ Comet RS';
  buildWeaponSlots(G);
  if (G.el.btnNew) G.el.btnNew.addEventListener('click', () => G.startNewGame?.());
  if (G.el.btnContinue) G.el.btnContinue.addEventListener('click', () => G.continueGame?.());
  if (G.el.btnResume) G.el.btnResume.addEventListener('click', () => G.resumeGame?.());
  if (G.el.btnRestart) G.el.btnRestart.addEventListener('click', () => G.restartMission?.());
  if (G.el.btnSave) G.el.btnSave.addEventListener('click', () => { saveGame(G); G.hudMsg = 'Game saved'; });
  if (G.el.btnQuit) G.el.btnQuit.addEventListener('click', () => G.quitToTitle?.());
  if (G.el.btnRetry) G.el.btnRetry.addEventListener('click', () => G.retryGame?.());
  if (G.el.muteBtn) G.el.muteBtn.addEventListener('click', () => G.toggleMute?.());
  if (G.el.qualitySelect) G.el.qualitySelect.addEventListener('change', (e) => G.setQuality?.(e.target.value));
}
function buildWeaponSlots(G) {
  const box = G.el.weaponSlots;
  if (!box) return;
  box.innerHTML = '';
  WEAPONS.forEach((w, i) => {
    const d = document.createElement('div');
    d.className = 'wslot'; d.id = 'wslot-' + i;
    d.innerHTML = `<span class="wkey">${i + 1}</span><span class="wname">${w.name}</span><span class="wammo"></span>`;
    box.appendChild(d);
  });
}
export function showDialog(G, text) {
  if (!G.el.dialog) return;
  const m = text.match(/^([^:]{1,30}):\s*(.*)$/s);
  const speaker = m ? m[1] : 'CONTACT';
  const line = m ? m[2] : text;
  const role = ROLES[speaker] || 'CONTACT';
  G.el.dialogName.textContent = `${speaker.toUpperCase()} · ${role}`;
  G.el.dialogText.textContent = line;
  const initials = speaker.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  G.el.dialogPortrait.textContent = initials;
  const hue = (speaker.length * 47) % 360;
  G.el.dialogPortrait.style.background = `linear-gradient(135deg, hsl(${hue},70%,55%), hsl(${(hue + 60) % 360},70%,40%))`;
  G.el.dialog.classList.remove('hidden');
  G.dialogT = 6;
}
export function showObjective(G, text) {
  G.objective = text;
  if (G.el.msnObjective) G.el.msnObjective.textContent = text;
}
function fmtTime(t) {
  const h = Math.floor(t) % 24, m = Math.floor((t % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function fmtTimer(s) {
  const v = Math.max(0, Math.ceil(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
}
export function updateHud(G, dt) {
  const p = G.player;
  // dialog timeout (re-staged every frame in shot mode by shots.js)
  if (G.dialogT > 0 && !G.shotMode) {
    G.dialogT -= dt;
    if (G.dialogT <= 0 && G.el.dialog) G.el.dialog.classList.add('hidden');
  }
  // mission panel
  if (G.el.msnChapter) G.el.msnChapter.textContent = missionLabel(G);
  if (G.el.msnTimer) {
    if (G.msn.active && G.msn.timer > 0) {
      G.el.msnTimer.textContent = fmtTimer(G.msn.timer);
      G.el.msnTimer.classList.remove('hidden');
    } else G.el.msnTimer.classList.add('hidden');
  }
  if (G.el.msnObjective) G.el.msnObjective.textContent = G.objective || '';
  if (G.el.msnStage) G.el.msnStage.textContent = missionStage(G);
  if (G.el.msnNext) {
    const d = G.msn.active ? null : null;
    G.el.msnNext.textContent = G.msn.active && G.msn.idx + 1 < 8
      ? `NEXT: ${['MEET MARCO', 'COURIER RUN', 'THE DOCKS JOB', 'NEON NIGHTS', 'STREET RACE', 'BEACH PARTY', 'GOLDEN HOUR', 'FREE ROAM'][G.msn.idx + 1]}` : '';
  }
  // vitals
  if (G.el.healthFill) G.el.healthFill.style.width = `${clamp(p.health, 0, 100)}%`;
  if (G.el.armorFill) G.el.armorFill.style.width = `${clamp(p.armor, 0, 100)}%`;
  if (G.el.weaponName) {
    const w = WEAPONS[p.weapon || 0];
    const ammo = p.ammo ? p.ammo[p.weapon || 0] : w.ammo;
    G.el.weaponName.textContent = `${w.name} ${ammo === Infinity ? '∞' : ammo}`;
  }
  for (let i = 0; i < 5; i++) {
    const s = document.getElementById('wslot-' + i);
    if (!s) continue;
    s.classList.toggle('active', (p.weapon || 0) === i);
    const locked = i === 4 && (G.stats.missionsDone || 0) < 7;
    s.classList.toggle('locked', locked);
    const ammoEl = s.querySelector('.wammo');
    if (ammoEl) {
      const w = WEAPONS[i];
      const a = p.ammo ? p.ammo[i] : w.ammo;
      ammoEl.textContent = locked ? 'LOCKED' : (a === Infinity ? '∞' : a);
    }
  }
  // top-right cluster
  if (G.el.dayLine) G.el.dayLine.textContent = `DAY ${G.day}`;
  if (G.el.stars) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < (G.wanted || 0) ? '★' : '☆';
    G.el.stars.textContent = s;
    G.el.stars.classList.toggle('hot', (G.wanted || 0) > 0);
  }
  if (G.el.cash) G.el.cash.textContent = formatCash(G.cash);
  if (G.el.clock) G.el.clock.textContent = fmtTime(G.timeOfDay);
  if (G.el.sightState) {
    const seen = (G.wanted || 0) > 0;
    G.el.sightState.textContent = seen ? 'IN SIGHT — search zone follows you' : '';
    G.el.sightState.classList.toggle('hidden', !seen);
  }
  // PCPD response list (rebuilt every frame — SwiftShader frames are ~10 s)
  if (G.el.pcpdPanel) {
    const units = policeUnits(G);
    const show = (G.wanted || 0) > 0;
    G.el.pcpdPanel.classList.toggle('hidden', !show);
    if (show) {
      if (G.el.pcpdHead) G.el.pcpdHead.textContent = `PCPD RESPONSE · ${units.length} UNITS · CODE ${G.wanted}`;
      if (G.el.pcpdList) {
        let html = '';
        for (const u of units.slice(0, 5)) {
          const cls = u.role === 'RAMMING' ? 'ram' : u.role === 'ROADBLOCK' ? 'block' : 'pursuit';
          html += `<div class="pcpd-row"><span class="pcpd-dot"></span><span>${u.callsign}</span><span class="pcpd-dist">${u.dist}m</span><span class="pcpd-tag ${cls}">${u.role}</span></div>`;
        }
        if (units.length > 5) html += `<div class="pcpd-more">+${units.length - 5} more units in the search zone</div>`;
        G.el.pcpdList.innerHTML = html;
      }
    }
  }
  // minimap + district + respect
  drawMinimap(G);
  if (G.el.districtName) G.el.districtName.textContent = districtAt(p.x, p.z).toUpperCase();
  const respect = clamp((G.stats.missionsDone || 0) + 1, 1, 5);
  if (G.el.respectFill) G.el.respectFill.style.width = `${respect * 20}%`;
  if (G.el.respectLabel) G.el.respectLabel.textContent = `RESPECT ${respect} · ${['ROOKIE', 'HUSTLER', 'SHOT CALLER', 'KINGPIN', 'LEGEND'][respect - 1]}`;
  // radio
  G.radioT += dt;
  if (G.radioT > 25) { G.radioT = 0; G.radioIdx = (G.radioIdx + 1) % RADIO_TRACKS.length; }
  if (G.el.radioStation) G.el.radioStation.textContent = '♪ CELESTE 98.1';
  if (G.el.radioTrack) G.el.radioTrack.textContent = RADIO_TRACKS[G.radioIdx];
  // speedometer
  const car = p.car && typeof p.car === 'object' ? p.car : null;
  if (G.el.speedBox) G.el.speedBox.classList.toggle('hidden', !car);
  if (car) {
    if (G.el.carName) G.el.carName.textContent = car.name || 'CAR';
    if (G.el.conditionFill) G.el.conditionFill.style.width = `${clamp(car.hp, 0, 100)}%`;
    const kmh = Math.round(Math.abs(car.speed) * 3.6);
    if (G.el.speedNum) G.el.speedNum.textContent = String(kmh);
    if (G.el.gear) {
      const g = kmh < 1 ? 'N' : kmh < 40 ? 'G1' : kmh < 70 ? 'G2' : kmh < 100 ? 'G3' : kmh < 130 ? 'G4' : 'G5';
      G.el.gear.textContent = g;
    }
  }
  // jobs panel (side-activity counters)
  if (G.el.jobsList) {
    G.el.jobsList.textContent = `TAXI ${G.stats.taxi || 0} · FISH ${G.stats.fish || 0} · PHOTOS ${G.stats.photos || 0} · COINS ${G.stats.coins || 0}/30`;
  }
  // prompt
  if (G.el.prompt) {
    let label = '';
    if (G.nearInteract) label = G.nearInteract.label;
    else if (!p.onFoot && car) label = 'E — Keluar mobil';
    else if (p.onFoot) {
      const near = G.nearCar;
      if (near) label = near.owner === 'player' ? 'E — Masuk mobil' : 'E — Curi mobil';
    }
    G.el.prompt.textContent = label ? `E — ${label.replace(/^E — /, '')}` : '';
    G.el.prompt.classList.toggle('hidden', !label);
  }
  // toast: transient event message (+$40 taxi, stunt jump, ...)
  if (G.el.toast) {
    if (G.hudMsg) { G.el.toast.textContent = G.hudMsg; G.el.toast.classList.remove('hidden'); G.toastT = 3; }
    else if (G.toastT > 0) { G.toastT -= dt; if (G.toastT <= 0) G.el.toast.classList.add('hidden'); }
  }
  // hint (hidden in shot mode)
  if (G.el.hint) G.el.hint.classList.toggle('hidden', !!G.shotMode);
  // FPS readout
  if (G.el.fpsBox && G.showFps) {
    G.el.fpsBox.textContent = `${Math.round(G.fps || 0)} FPS`;
    G.el.fpsBox.classList.remove('hidden');
  } else if (G.el.fpsBox) G.el.fpsBox.classList.add('hidden');
}
function drawMinimap(G) {
  const ctx = G.el.mapCtx;
  if (!ctx) return;
  const S = 200, W = 640;
  const mx = (x) => (x + 320) / W * S;
  const mz = (z) => (z + 320) / W * S;
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#1a2430'; ctx.fillRect(0, 0, S, S);
  // sea + beach
  ctx.fillStyle = '#2a7ab5'; ctx.fillRect(0, 0, mx(-252), S);
  ctx.fillStyle = '#c8b898'; ctx.fillRect(mx(-266), 0, mx(-252) - mx(-266), S);
  // blocks
  ctx.fillStyle = '#3a4150';
  for (const bx of [-280, -180, -60, 60, 180, 280]) {
    for (const bz of [-280, -180, -60, 60, 180, 280]) {
      ctx.fillRect(mx(bx - 52), mz(bz - 52), (104 / W) * S, (104 / W) * S);
    }
  }
  // roads (thicker boulevards)
  ctx.strokeStyle = '#7d8590'; ctx.lineWidth = 5;
  for (const g of CFG.grid) {
    ctx.beginPath(); ctx.moveTo(mx(g), 0); ctx.lineTo(mx(g), S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, mz(g)); ctx.lineTo(S, mz(g)); ctx.stroke();
  }
  ctx.strokeStyle = '#e8c832'; ctx.lineWidth = 1;
  for (const g of CFG.grid) {
    ctx.beginPath(); ctx.moveTo(mx(g), 0); ctx.lineTo(mx(g), S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, mz(g)); ctx.lineTo(S, mz(g)); ctx.stroke();
  }
  // ring roads + promenade
  ctx.strokeStyle = '#7d8590'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(mx(312), 0); ctx.lineTo(mx(312), S); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, mz(312)); ctx.lineTo(S, mz(312)); ctx.stroke();
  // pier
  ctx.strokeStyle = '#8a6a42'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(mx(-258), mz(20)); ctx.lineTo(mx(-280), mz(20)); ctx.stroke();
  // garage + shops
  ctx.fillStyle = '#2aff7a'; ctx.fillRect(mx(-60) - 3, mz(-30) - 3, 6, 6);
  ctx.fillStyle = '#c07aff';
  ctx.fillRect(mx(132) - 3, mz(60) - 3, 6, 6);
  // sun coins nearby
  if (G.city) {
    ctx.fillStyle = '#ffd23a';
    for (const c of G.city.coins) {
      if (c.taken) continue;
      const dx = c.x - G.player.x, dz = c.z - G.player.z;
      if (dx * dx + dz * dz < 14400) { ctx.beginPath(); ctx.arc(mx(c.x), mz(c.z), 2, 0, 7); ctx.fill(); }
    }
  }
  // mission marker
  const msn = G.msn;
  if (msn && msn.active) {
    const d = MISSIONS[msn.idx];
    const s = d && d.steps[msn.step];
    if (s && s.x !== undefined) {
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath(); ctx.arc(mx(s.x), mz(s.z), 5, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mx(s.x), mz(s.z), 7, 0, 7); ctx.stroke();
    }
  }
  // police dots (blink)
  const blink = Math.sin(G.t * 6) > 0;
  for (const u of G.cops) {
    const x = u.car ? u.car.x : u.x, z = u.car ? u.car.z : u.z;
    ctx.fillStyle = blink ? '#ff4444' : '#4488ff';
    ctx.beginPath(); ctx.arc(mx(x), mz(z), 3, 0, 7); ctx.fill();
  }
  // player arrow (white)
  const p = G.player;
  ctx.save();
  ctx.translate(mx(p.x), mz(p.z));
  ctx.rotate(p.heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
}
export function saveGame(G) {
  try {
    const save = {
      cash: G.cash, msnIdx: G.msn ? G.msn.idx : 0,
      missionsDone: G.stats.missionsDone || 0,
      coins: G.stats.coins || 0, taxi: G.stats.taxi || 0,
      fish: G.stats.fish || 0, photos: G.stats.photos || 0,
      health: G.player.health, armor: G.player.armor,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch { /* storage unavailable */ }
}
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
