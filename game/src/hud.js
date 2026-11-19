// HUD DOM + minimap lingkaran + panel misi + dialog + menu.
import { G, CFG, districtAt, fmtCash } from './config.js';
import { mission, missionStep } from './missions.js';
import { WEAPONS } from './combat.js';
import { policeList } from './police.js';
import { audioState } from './audio.js';
const TRACKS = ['Malecón Mirage — Vela Roja', 'Pink Horizon — Lumen Kids', 'Midnight Marina — Vela', 'Sunset Strip — The Palms', 'Neon Drive — Coral Skies'];
let trackIdx = 0, trackT = 0;
const $ = (id) => document.getElementById(id);
export function initHud() {
  $('btn-mute').addEventListener('click', () => { G.muted = !G.muted; });
  $('btn-new').addEventListener('click', () => { G.state = 'playing'; $('title').style.display = 'none'; $('hud').style.display = 'block'; });
  const bc = $('btn-continue');
  if (bc) bc.addEventListener('click', () => { G.state = 'playing'; $('title').style.display = 'none'; $('hud').style.display = 'block'; });
  $('btn-resume').addEventListener('click', () => { G.paused = false; $('pause').style.display = 'none'; });
  $('btn-restart').addEventListener('click', () => { location.reload(); });
  $('btn-quit').addEventListener('click', () => { G.state = 'title'; G.paused = false; $('pause').style.display = 'none'; $('title').style.display = 'flex'; $('hud').style.display = 'none'; });
}
export function showTitle() { $('title').style.display = 'flex'; $('hud').style.display = 'none'; }
export function updateHud(dt) {
  trackT += dt;
  if (trackT > 25) { trackT = 0; trackIdx = (trackIdx + 1) % TRACKS.length; }
  const m = mission();
  $('mp-chapter').textContent = `${m.ch} · ${m.name.toUpperCase()}`;
  $('mp-timer').textContent = G.missionTimer > 0 ? fmtTimer(G.missionTimer) : '';
  $('mp-timer').style.display = G.missionTimer > 0 ? 'inline' : 'none';
  $('mp-objective').textContent = G.objective || missionStep().text;
  $('mp-stage').textContent = `STAGE ${Math.min(G.missionStep + 1, m.steps.length)}/${m.steps.length}`;
  $('mp-next').textContent = G.missionIdx < 7 ? `NEXT: ${['Meet Marco', 'Courier Run', 'Docks Job', 'Neon Nights', 'Street Race', 'Beach Party', 'Golden Hour', 'Selesai'][G.missionIdx + 1] || ''}` : 'NEXT: Bebas!';
  $('wanted').textContent = '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
  $('wanted').style.color = G.wanted > 0 ? '#ff4040' : '#ffd23f';
  $('cash').textContent = fmtCash(G.cash);
  const hh = Math.floor(G.timeOfDay), mm = Math.floor((G.timeOfDay - hh) * 60);
  $('clock').textContent = `DAY ${G.day} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  $('sight').textContent = G.wanted > 0 ? 'IN SIGHT — search zone follows you' : '';
  // Polisi response list.
  const pl = policeList();
  $('police-list').style.display = G.wanted > 0 ? 'block' : 'none';
  if (G.wanted > 0) {
    $('police-count').textContent = `${pl.length} UNITS · CODE ${G.wanted}`;
    $('police-rows').innerHTML = pl.slice(0, 5).map((u) => `<div class="prow"><span>${u.callsign}</span><span>${u.d}m</span><b class="${u.role === 'RAMMING' ? 'ram' : 'pur'}">${u.role}</b></div>`).join('') + (pl.length > 5 ? `<div class="prow">+${pl.length - 5} more units</div>` : '');
  }
  // Senjata.
  $('weapons').innerHTML = WEAPONS.map((w, i) => `<span class="wslot ${G.weapon === i ? 'on' : ''}">${i + 1} ${w.name}${i > 0 ? ' ' + G.ammo[i] : ''}</span>`).join('');
  $('weapon-now').textContent = WEAPONS[G.weapon].name;
  // Kecepatan + kondisi mobil.
  const sp = G.car ? Math.abs(G.car.speed) * 3.6 : Math.abs(G.player.speed) * 3.6;
  $('speed-num').textContent = Math.round(sp);
  $('car-name').textContent = G.car ? G.car.name : 'JALAN KAKI';
  $('cond-bar').style.width = (G.car ? G.car.hp : 100) + '%';
  $('speed-box').style.display = G.car ? 'block' : 'block';
  $('radio-track').textContent = TRACKS[trackIdx];
  // Dialog.
  const d = G.dialog;
  if (d && G.time < d.until) {
    $('dialog').style.display = 'flex';
    $('dlg-portrait').textContent = d.name.slice(0, 2).toUpperCase();
    $('dlg-name').textContent = `${d.name} · ${d.role}`;
    $('dlg-text').textContent = d.text;
  } else $('dialog').style.display = 'none';
  // Prompt + toast.
  $('prompt').textContent = G.prompt || '';
  $('prompt').style.display = G.prompt ? 'block' : 'none';
  G.prompt = '';
  if (G.toastT > 0) { $('toast').textContent = G.toast; $('toast').style.display = 'block'; G.toastT -= dt; }
  else $('toast').style.display = 'none';
  // Aktivitas.
  const acts = [];
  if (G.taxi.active) acts.push(`🚕 TAKSI ${G.taxi.phase === 'pickup' ? 'jemput penumpang' : 'antar ke tujuan'} — ${Math.ceil(G.taxi.t)}s`);
  if (G.race.active) acts.push(`🏁 BALAPAN checkpoint ${G.race.step}/3 — ${Math.ceil(G.race.t)}s`);
  if (G.fishing.active) acts.push(`🎣 MANCING — tekan F di zona hijau (${G.fishing.hits}/${G.fishing.need})`);
  if (G.sideJob.active) acts.push(`📦 PAKET KILAT — ${Math.ceil(G.sideJob.t)}s`);
  acts.push(`📸 FOTO ${G.photos.length}/6 · 🐟 IKAN ${G.fish.length} (${Object.keys(G.fishCaught).length} jenis) · 🚕 Taksi ${G.taxi.done} · 🏁 Balapan ${G.race.done}`);
  $('activity').innerHTML = acts.map((a) => `<div>${a}</div>`).join('');
  // Bar mancing.
  $('fish-bar').style.display = G.fishing.active ? 'block' : 'none';
  if (G.fishing.active) $('fish-cursor').style.left = (G.fishing.bar * 100) + '%';
  // Vital.
  $('hp-bar').style.width = G.health + '%';
  $('ar-bar').style.width = G.armor + '%';
  $('district').textContent = districtAt(G.player.x, G.player.z).toUpperCase();
  $('respect').textContent = `RESPECT · ${['', 'ROOKIE', 'HUSTLER', 'SHOT CALLER', 'KINGPIN', 'LEGEND'][G.respect]} ${G.missionsDone}/8`;
  $('respect-bar').style.width = (G.respect * 20) + '%';
  $('btn-mute').textContent = G.muted ? '🔇 MUTED' : '🔊 SUARA';
  $('engine-state').textContent = audioState.engineOn ? `MESIN ${audioState.engineFreq}Hz` : 'MESIN MATI';
  $('pause').style.display = G.paused ? 'flex' : 'none';
  $('busted').style.display = G.state === 'busted' ? 'flex' : 'none';
  drawMinimap();
}
function fmtTimer(s) { const m = Math.floor(s / 60), ss = Math.floor(s % 60); return `${m}:${String(ss).padStart(2, '0')}`; }
function drawMinimap() {
  const cv = $('minimap'); if (!cv) return;
  const x = cv.getContext('2d'); const S = cv.width / 640;
  x.clearRect(0, 0, cv.width, cv.height);
  x.fillStyle = '#1c2b1a'; x.fillRect(0, 0, cv.width, cv.height);
  x.fillStyle = '#2f7fa8'; x.fillRect(0, 0, 20 * S, cv.height);
  x.fillStyle = '#e8d9a0'; x.fillRect(0, 0, 34 * S, cv.height);
  x.strokeStyle = '#888'; x.lineWidth = 4;
  for (const r of [-240, -120, 0, 120, 240]) {
    x.beginPath(); x.moveTo((r + 320) * S, 0); x.lineTo((r + 320) * S, cv.height); x.stroke();
    x.beginPath(); x.moveTo(0, (r + 320) * S); x.lineTo(cv.width, (r + 320) * S); x.stroke();
  }
  const dot = (wx, wz, col, r = 5) => { x.fillStyle = col; x.beginPath(); x.arc((wx + 320) * S, (wz + 320) * S, r, 0, 7); x.fill(); };
  const s = missionStep();
  dot(s.x, s.z, '#ffe14d', 6);
  for (const p of G.police) dot(p.x, p.z, '#ff4040', 4);
  dot(G.city.taxiStand.x, G.city.taxiStand.z, '#2eff5e', 4);
  dot(G.city.raceStart.x, G.city.raceStart.z, '#ff7a1a', 4);
  for (const p of G.city.photoSpots) dot(p.x, p.z, '#c678ff', 3);
  if (G.taxi.active) dot(G.taxi.tx, G.taxi.tz, '#ffe14d', 6);
  if (G.sideJob.active) dot(G.sideJob.tx, G.sideJob.tz, '#2eff5e', 6);
  if (G.fishing.active) dot(G.city.fishingSpots[0].x, G.city.fishingSpots[0].z, '#37e0ff', 5);
  // Pemain: panah putih.
  const px = (G.player.x + 320) * S, pz = (G.player.z + 320) * S;
  x.save(); x.translate(px, pz); x.rotate(Math.PI - G.player.yaw);
  x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -8); x.lineTo(6, 7); x.lineTo(-6, 7); x.closePath(); x.fill();
  x.restore();
}
