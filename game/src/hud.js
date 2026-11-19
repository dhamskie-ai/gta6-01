// HUD DOM, minimap canvas, menu title/pause/akhir, dialog, toast,
// save/load localStorage. Semua teks tajam (DOM di atas canvas WebGL).
import { CFG } from './config.js';
import { MALECON_X } from './city.js';

const SAVE_KEY = 'solarabay-save-v6g';
const $ = (id) => document.getElementById(id);
function fmtTime(h) {
  const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function fmtClock(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
export function createHud(W) {
  const H = {
    el: {}, dialogUntil: 0, toastUntil: 0,
    setPrompt(t) {
      const el = $('prompt');
      if (t) { el.textContent = t; el.style.display = 'block'; }
      else el.style.display = 'none';
    },
    showDialog(name, role, text, dur = 6) {
      $('dlg-name').textContent = name;
      $('dlg-role').textContent = role;
      $('dlg-text').textContent = text;
      $('dialog').style.display = 'block';
      H.dialogUntil = W.elapsed + dur;
    },
    toast(msg, dur = 3) {
      const el = $('toast');
      el.textContent = msg;
      el.style.display = 'block';
      H.toastUntil = W.elapsed + dur;
    },
    setScreen(name) {
      for (const s of ['screen-title', 'screen-pause', 'screen-end', 'screen-dead']) {
        $(s).style.display = s === `screen-${name}` ? 'flex' : 'none';
      }
      $('hud').classList.toggle('on', name === '' || name === 'pause');
    },
  };
  // Slot senjata 1–5.
  const weaponsEl = $('weapons');
  CFG.weapons.forEach((w, i) => {
    const d = document.createElement('div');
    d.className = 'wslot';
    d.id = `wslot-${i}`;
    d.innerHTML = `<b>${i + 1} ${w.name}</b><span class="ammo"></span>`;
    weaponsEl.appendChild(d);
  });
  // Tombol menu.
  $('btn-new').addEventListener('click', () => { W.audio.ensure(); W.newGame(); });
  $('btn-continue').addEventListener('click', () => { W.audio.ensure(); W.continueGame(); });
  $('btn-resume').addEventListener('click', () => W.resumeGame());
  $('btn-restart').addEventListener('click', () => { W.missions && W.startMission(W, W.missions.current); W.resumeGame(); });
  $('btn-save').addEventListener('click', () => { W.saveGame(); H.toast('Game disimpan.'); });
  $('btn-quit').addEventListener('click', () => W.toTitle());
  $('btn-again').addEventListener('click', () => W.newGame());
  $('btn-title').addEventListener('click', () => W.toTitle());
  $('btn-retry').addEventListener('click', () => { W.startMission(W, W.missions.current); W.resumeGame(); });
  $('btn-dead-title').addEventListener('click', () => W.toTitle());
  const save = loadSave();
  if (save) {
    $('btn-continue').style.display = '';
    $('save-info').textContent = `Save: JOB ${save.mission + 1}/8 · $${save.cash} · ${fmtTime(save.hour)}`;
  } else {
    $('btn-continue').style.display = 'none';
    $('save-info').textContent = 'Belum ada save — mulai New Game.';
  }
  W.hud = H;
  return H;
}
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function saveGame(W) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: W.cash, mission: W.missions.current, garage: W.garage,
      coins: W.city.sunCoins.map((c, i) => (c.taken ? i : -1)).filter((i) => i >= 0),
      stats: W.stats, owned: W.combat.owned, ammo: W.combat.ammo,
      weapon: W.combat.weapon, health: W.health, armor: W.armor,
      hour: W.hour, respect: W.respect,
    }));
  } catch { /* penyimpanan penuh / privat: abaikan */ }
}
export function applySave(W, save) {
  W.cash = save.cash; W.health = save.health; W.armor = save.armor;
  W.hour = save.hour; W.respect = save.respect || 0;
  W.garage = save.garage || [];
  W.stats = { ...W.stats, ...save.stats };
  W.combat.owned = save.owned || W.combat.owned;
  W.combat.ammo = save.ammo || W.combat.ammo;
  W.combat.weapon = save.weapon ?? 1;
  (save.coins || []).forEach((i) => {
    const c = W.city.sunCoins[i];
    if (c) { c.taken = true; c.mesh.visible = false; }
  });
  W.startMission(W, Math.min(save.mission, 7));
}
export function updateHud(W) {
  const M = W.missions;
  const m = M ? M.current : 0;
  const def = { name: 'First Gear', obj: '', sub: '' };
  const mission = MISSIONS[m] || def;
  if (M) {
    $('m-tag').textContent = `JOB ${m + 1}/8`;
    $('m-title').textContent = mission.name;
    $('m-timer').textContent = M.timer > 0 ? fmtClock(M.timer) : '';
    $('m-obj').textContent = mission.obj;
    $('m-sub').textContent = mission.sub || '';
    const stageMax = m === 2 ? 3 : m === 5 ? 4 : m === 6 ? 3 : 2;
    $('m-stage-fill').style.width = `${Math.min(100, (M.stage / stageMax) * 100)}%`;
    $('m-next').textContent = M.stage === 0 ? 'NEXT: ikuti marker kuning' : '';
  }
  $('cash').textContent = `$${W.cash.toLocaleString('en-US')}`;
  const w = W.police.wanted;
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < w ? '★' : '<span class="off">★</span>';
  $('stars').innerHTML = w > 0 ? `WANTED ${stars}` : stars;
  $('clock').textContent = `${fmtTime(W.hour)} · ${W.hour >= 6 && W.hour < 18.5 ? 'SIANG' : 'MALAM'}`;
  $('hp-fill').style.width = `${Math.max(0, W.health)}%`;
  $('ar-fill').style.width = `${Math.max(0, W.armor)}%`;
  const car = W.player.car;
  $('spd-num').innerHTML = car ? `${Math.round(Math.abs(car.speed) * 3.6)} <small>km/h</small>` : '0 <small>km/h</small>';
  $('spd-car').textContent = car ? `${car.spec.name} · G${1 + Math.min(5, Math.floor(Math.abs(car.speed) / 7))}` : 'JALAN KAKI';
  $('cond-fill').style.width = car ? `${Math.max(0, car.hp)}%` : '100%';
  $('cond-fill').style.background = car && car.hp < 45 ? '#ff5a5a' : '#57e389';
  $('radio-track').textContent = CFG.radioTracks[W.radioTrack % CFG.radioTracks.length];
  // Slot senjata.
  CFG.weapons.forEach((defW, i) => {
    const el = $(`wslot-${i}`);
    if (!el) return;
    el.classList.toggle('sel', W.combat.weapon === i);
    el.classList.toggle('locked', !!defW.locked || !W.combat.owned[i]);
    const ammoEl = el.querySelector('.ammo');
    if (ammoEl) {
      ammoEl.textContent = defW.locked ? 'LOCKED' : !W.combat.owned[i] ? `$${defW.price}` : W.combat.ammo[i] === Infinity ? '∞' : String(W.combat.ammo[i]);
    }
  });
  // Panel PCPD.
  const pcpd = $('pcpd');
  if (w > 0) {
    pcpd.style.display = 'block';
    const units = W.police.units || [];
    $('pcpd-list').innerHTML = `<div><span>● PCPD RESPONSE</span><span>${units.length} UNITS · CODE ${w}</span></div>`
      + units.slice(0, 5).map((u) => `<div><span>${u.name}</span><span>${u.dist} m</span><span class="pcpd-act ${u.act === 'SPOTLIGHT' ? 'blue' : ''}">${u.act}</span></div>`).join('')
      + (units.length > 5 ? `<div><span>+${units.length - 5} more units · roadblocks on the boulevard</span></div>` : '');
  } else pcpd.style.display = 'none';
  // Respect + nama jalan.
  $('respect-text').textContent = `SHOT CALLER ${W.respect} / 550`;
  $('respect-fill').style.width = `${Math.min(100, (W.respect / 550) * 100)}%`;
  const px = W.player.x;
  $('street').textContent = px < -250 ? 'Malecón Celeste' : px < -200 ? 'Marina Bay' : px > 80 ? 'The Spires' : px < -40 ? 'Old Solara' : W.player.z > 200 ? 'The Docks' : W.player.z < -200 ? 'Vista Hills' : 'Calle Verde';
  if (W.elapsed > W.hud.dialogUntil) $('dialog').style.display = 'none';
  if (W.elapsed > W.hud.toastUntil) $('toast').style.display = 'none';
  drawMinimap(W);
}
const MISSIONS = [
  { name: 'First Gear' }, { name: 'Meet Marco' }, { name: 'Courier Run' },
  { name: 'Docks Job' }, { name: 'Neon Nights' }, { name: 'Street Race' },
  { name: 'Beach Party' }, { name: 'Golden Hour' },
];
export function drawMinimap(W) {
  const cv = $('minimap');
  if (!cv) return;
  const g = cv.getContext('2d');
  const S = 180 / 640;
  const X = (x) => (x + 320) * S, Y = (z) => (z + 320) * S;
  g.clearRect(0, 0, 180, 180);
  g.fillStyle = '#0d1a2e'; g.fillRect(0, 0, 180, 180);
  // Laut + pantai.
  g.fillStyle = '#1a6a9a'; g.fillRect(0, 0, X(-300), 180);
  g.fillStyle = '#e8d5a8'; g.fillRect(X(-300), 0, X(-260) - X(-300), 180);
  // Jalan grid.
  g.strokeStyle = '#5a6a7a'; g.lineWidth = 2;
  for (const a of [-240, -160, -80, 0, 80, 160, 240]) {
    g.beginPath(); g.moveTo(X(a), 0); g.lineTo(X(a), 180); g.stroke();
    g.beginPath(); g.moveTo(0, Y(a)); g.lineTo(180, Y(a)); g.stroke();
  }
  // Malecón melengkung.
  g.strokeStyle = '#7a8a9a'; g.lineWidth = 2.5;
  g.beginPath();
  for (let z = -300; z <= 300; z += 20) {
    const x = MALECON_X(z);
    if (z === -300) g.moveTo(X(x), Y(z)); else g.lineTo(X(x), Y(z));
  }
  g.stroke();
  const dot = (x, z, color, r = 3) => {
    g.fillStyle = color;
    g.beginPath(); g.arc(X(x), Y(z), r, 0, Math.PI * 2); g.fill();
  };
  dot(56, 96, '#2aff5a', 3); // garasi
  dot(-88, 168, '#b45aff', 3); // Cal's Guns
  dot(168, -88, '#b45aff', 3); // Spray & Shine
  if (W.missions.taxiFare) dot(W.missions.taxiFare.fx, W.missions.taxiFare.fz, '#2aff5a', 4);
  for (const c of W.police.cars) dot(c.car.x, c.car.z, Math.floor(W.elapsed * 2) % 2 ? '#2a6aff' : '#ff2a2a', 3);
  for (const c of W.police.cops) dot(c.x, c.z, '#ff2a2a', 2);
  if (W.missions.marker) {
    const mx = X(W.missions.marker.x), my = Y(W.missions.marker.z);
    g.fillStyle = '#ffd25a';
    g.beginPath(); g.arc(mx, my, 5 + Math.sin(W.elapsed * 4) * 1.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffd25a'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(mx, my, 8, 0, Math.PI * 2); g.stroke();
  }
  // Pemain: panah putih.
  const px = W.player.car ? W.player.car.x : W.player.x;
  const pz = W.player.car ? W.player.car.z : W.player.z;
  const hd = W.player.car ? W.player.car.heading : W.player.heading;
  g.save();
  g.translate(X(px), Y(pz));
  g.rotate(Math.atan2(Math.sin(hd), Math.cos(hd)));
  g.fillStyle = '#fff';
  g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 5); g.lineTo(-4, 5); g.closePath(); g.fill();
  g.restore();
}
