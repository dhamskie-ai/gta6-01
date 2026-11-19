// 8 misi cerita + 4 aktivitas baru yang bisa dimainkan (taksi, balapan, mancing, foto) + misi sampingan.
import { G, CFG } from './config.js';
import { wasPressed } from './input.js';
import { playJingle, playBlip } from './audio.js';
import { spawnGuards, clearGuards, guardCount } from './combat.js';
import { spawnVehicle } from './vehicles.js';
import { addWanted } from './police.js';
import { dist2 } from './random.js';
export const MISSIONS = [
  { name: 'First Gear', ch: 'JOB 1/8', reward: 500, steps: [
    { text: 'Curi VELOZ COMET RS pink di depanmu (E)', x: 0, z: 14, r: 4 },
    { text: 'Antar mobil ke bengkel Mara (garasi hijau)', x: 120, z: 120, r: 8 } ] },
  { name: 'Meet Marco', ch: 'JOB 2/8', reward: 800, steps: [
    { text: 'Temui Marco di Marlin Ceviche, Malecón', x: -244, z: 44, r: 7 } ] },
  { name: 'Courier Run', ch: 'JOB 3/8', reward: 1200, timer: 240, steps: [
    { text: 'Antar paket 1/3 ke Plaza Spires', x: 60, z: -180, r: 8 },
    { text: 'Antar paket 2/3 ke Docks', x: 220, z: -180, r: 8 },
    { text: 'Antar paket 3/3 ke Calle Verde', x: -140, z: 240, r: 8 } ] },
  { name: 'Docks Job', ch: 'JOB 4/8', reward: 2000, steps: [
    { text: 'Curi truk Hauler di Docks (E)', x: 220, z: -200, r: 6 },
    { text: 'Hajar 4 penjaga Docks, lalu kabur ke garasi', x: 120, z: 120, r: 9 } ] },
  { name: 'Neon Nights', ch: 'JOB 5/8', reward: 1500, timer: 180, steps: [
    { text: 'Buntuti kurir Dario di Old Solara (jangan dekat)', x: -140, z: 60, r: 10 },
    { text: 'Kejar kurir yang kabur ke Marina', x: -140, z: -180, r: 8 } ] },
  { name: 'Street Race', ch: 'JOB 6/8', reward: 1800, timer: 150, steps: [
    { text: 'Menang balapan jalanan: lewati 3 checkpoint', x: 120, z: 6, r: 9 },
    { text: 'Checkpoint 2 — ujung Malecón', x: -240, z: -120, r: 9 },
    { text: 'Finish — garis start', x: 120, z: 6, r: 9 } ] },
  { name: 'Beach Party', ch: 'JOB 7/8', reward: 1000, steps: [
    { text: 'Datang ke pesta pantai di dermaga', x: -284, z: 0, r: 8 },
    { text: 'Foto mercusuar untuk Lupe (F di titik ungu)', x: -262, z: 150, r: 7 } ] },
  { name: 'Golden Hour', ch: 'JOB 8/8', reward: 5000, timer: 150, steps: [
    { text: 'Lolos dari kejaran PCPD sebelum kapal Marco berlayar', x: -120, z: 0, r: 10 },
    { text: 'Sampai ke kapal di ujung dermaga!', x: -292, z: 0, r: 7 } ] },
];
const DIALOGS = [
  ['Marco', 'SMUGGLER · WHEELMAN', 'Nico! Mobil pink itu kuncinya. Bawa ke bengkel Mara, cepat.'],
  ['Marco', 'SMUGGLER · WHEELMAN', 'Marlin Ceviche, Malecón. Aku tunggu di meja luar — jangan telat.'],
  ['Lupe', 'DISPATCHER', 'Tiga paket, empat menit. Jangan tabrak apa pun, Nico.'],
  ['Marco', 'SMUGGLER · WHEELMAN', 'Truk Hauler di Docks itu milik Dario. Ambil. Penjaganya galak.'],
  ['Kip', 'HACKER', 'Kurir Dario lewat Old Solara jam segini. Buntuti dari jauh.'],
  ['Marco', 'SMUGGLER · WHEELMAN', 'Balapan jalanan malam ini — menangkan, dan namamu naik.'],
  ['Lupe', 'DISPATCHER', 'Pesta pantai di dermaga! Foto mercusuarnya buat kenang-kenangan.'],
  ['Marco', 'SMUGGLER · WHEELMAN', 'Kapal berlayar dua menit lagi, Nico! Lepas dari helikopter itu dan ke dermaga!'],
];
export function mission() { return MISSIONS[Math.min(G.missionIdx, MISSIONS.length - 1)]; }
export function missionStep() { const m = mission(); return m.steps[Math.min(G.missionStep, m.steps.length - 1)]; }
// Titik acak yang selalu di jalan (satu sumbu menempel garis jalan) —
// supaya target taksi/paket selalu bisa dicapai mobil, tidak di dalam gedung.
function roadPoint() {
  const lines = [-240, -120, 0, 120, 240];
  const line = lines[Math.floor(Math.random() * lines.length)];
  if (Math.random() < 0.5) return { x: line + (Math.random() * 6 - 3), z: Math.random() * 520 - 260 };
  return { x: Math.random() * 520 - 260, z: line + (Math.random() * 6 - 3) };
}
export function startMission(i) {
  G.missionIdx = i; G.missionStep = 0;
  const m = MISSIONS[i];
  G.missionTimer = m.timer || 0;
  const d = DIALOGS[i];
  G.dialog = { name: d[0], role: d[1], text: d[2], until: G.time + 6 };
  G.objective = m.steps[0].text;
  if (i === 3) spawnGuards(220, -200, 4);
  if (i === 4) G.timeOfDay = 20.5;
  if (i === 7) { G.timeOfDay = 18.4; addWanted(4, 'PCPD mengepungmu — lolos sebelum kapal berlayar!'); }
}
export function completeMission() {
  const m = mission();
  G.cash += m.reward; G.missionsDone++; G.respect = Math.min(5, 1 + G.missionsDone);
  playJingle();
  G.toast = `MISI SELESAI: ${m.name}  +$${m.reward}`; G.toastT = 4;
  clearGuards();
  if (G.missionIdx < MISSIONS.length - 1) startMission(G.missionIdx + 1);
  else { G.dialog = { name: 'Marco', role: 'SMUGGLER · WHEELMAN', text: 'Utang lunas, Nico. Solara Bay milik kita sekarang.', until: G.time + 8 }; G.objective = 'Semua misi selesai — bebas keliling Solara Bay!'; }
  saveGame();
}
export function updateMissions(dt) {
  const m = mission();
  if (G.missionIdx >= MISSIONS.length) return;
  if (m.timer && G.missionTimer > 0) {
    G.missionTimer -= dt;
    if (G.missionTimer <= 0) { G.missionTimer = m.timer; G.missionStep = 0; G.toast = 'Waktu habis — misi diulang dari awal'; G.toastT = 3; G.objective = m.steps[0].text; return; }
  }
  const s = missionStep();
  const px = G.player.x, pz = G.player.z;
  // Syarat khusus misi 4: penjaga harus habis dulu sebelum checkpoint akhir.
  if (G.missionIdx === 3 && G.missionStep === 1 && guardCount() > 0) {
    G.objective = `Hajar penjaga Docks yang tersisa: ${guardCount()}`;
    return;
  }
  if (dist2(px, pz, s.x, s.z) < s.r * s.r) {
    if (G.missionStep < m.steps.length - 1) {
      G.missionStep++;
      G.objective = m.steps[G.missionStep].text;
      playBlip(990);
    } else completeMission();
  }
  updateActivities(dt);
}
// ---------- AKTIVITAS BARU ----------
export function updateActivities(dt) {
  const px = G.player.x, pz = G.player.z;
  const city = G.city;
  // (a) TAKSI — antar penumpang, timer + bayaran.
  const t = G.taxi;
  if (!t.active && dist2(px, pz, city.taxiStand.x, city.taxiStand.z) < 64) {
    G.prompt = 'F — Jadi supir taksi (antar penumpang, $40)';
    if (wasPressed('KeyF') || G.touch.actPressed) {
      G.touch.actPressed = false; t.active = true; t.phase = 'pickup';
      const rp = roadPoint(); t.tx = rp.x; t.tz = rp.z;
      t.t = 90; G.toast = 'Penumpang menunggu — jemput dia (marker kuning)!'; G.toastT = 3; playBlip(700);
    }
  } else if (t.active) {
    t.t -= dt;
    if (t.t <= 0) { t.active = false; G.toast = 'Penumpang batal — terlalu lama'; G.toastT = 2; }
    else if (t.phase === 'pickup' && dist2(px, pz, t.tx, t.tz) < 81) {
      t.phase = 'drop'; const rp = roadPoint(); t.tx = rp.x; t.tz = rp.z; t.t = 100;
      G.toast = 'Penumpang naik! Antar ke tujuan (marker kuning)'; G.toastT = 3;
    } else if (t.phase === 'drop' && dist2(px, pz, t.tx, t.tz) < 81) {
      t.active = false; t.done++; G.cash += CFG.taxiFare;
      G.toast = `Taksi selesai! +$${CFG.taxiFare}`; G.toastT = 3; playJingle();
    }
  }
  // (b) BALAPAN JALANAN DADAKAN — lawan 2 AI di rute kota.
  const r = G.race;
  if (!r.active && dist2(px, pz, city.raceStart.x, city.raceStart.z) < 64) {
    G.prompt = 'F — Balapan jalanan dadakan (hadiah $120)';
    if (wasPressed('KeyF') || G.touch.actPressed) {
      G.touch.actPressed = false; r.active = true; r.step = 0; r.t = 180; r.rivals = [];
      for (let i = 0; i < 2; i++) {
        const rv = spawnVehicle(i ? 'sedan' : 'sport', city.raceStart.x + 4 + i * 5, city.raceStart.z + 6, Math.PI, { traffic: true });
        rv.raceTarget = 0; rv.raceSpeed = 20 + i * 3; r.rivals.push(rv);
      }
      G.toast = 'BALAPAN! Lewati 3 checkpoint sebelum rival!'; G.toastT = 3; playBlip(1200);
    }
  } else if (r.active) {
    r.t -= dt;
    const route = [{ x: 120, z: 6 }, { x: -240, z: -120 }, { x: 120, z: 6 }];
    const cp = route[Math.min(r.step, 2)];
    if (dist2(px, pz, cp.x, cp.z) < 81) {
      r.step++;
      if (r.step >= 3) {
        r.active = false; r.done++;
        const win = r.rivals.every((rv) => (rv.raceTarget || 0) < 3);
        if (win) { G.cash += CFG.racePrize; G.toast = `MENANG BALAPAN! +$${CFG.racePrize}`; playJingle(); }
        else G.toast = 'Kalah balapan — coba lagi di garis start';
        G.toastT = 3;
        for (const rv of r.rivals) { G.scene.remove(rv.mesh); G.vehicles.splice(G.vehicles.indexOf(rv), 1); }
        r.rivals = [];
      } else playBlip(990);
    }
    for (const rv of r.rivals) {
      const target = route[Math.min(rv.raceTarget || 0, 2)];
      const dx = target.x - rv.x, dz = target.z - rv.z, d = Math.hypot(dx, dz) || 1;
      rv.heading = Math.atan2(dx, dz);
      rv.x += (dx / d) * rv.raceSpeed * dt; rv.z += (dz / d) * rv.raceSpeed * dt;
      rv.mesh.position.set(rv.x, 0, rv.z); rv.mesh.rotation.y = rv.heading;
      if (d < 9) rv.raceTarget = (rv.raceTarget || 0) + 1;
    }
    if (r.t <= 0) { r.active = false; G.toast = 'Balapan berakhir — waktu habis'; G.toastT = 2; for (const rv of r.rivals) { G.scene.remove(rv.mesh); G.vehicles.splice(G.vehicles.indexOf(rv), 1); } r.rivals = []; }
  }
  // (c) MANCING LEBIH DALAM — timing bar, 3 hit, koleksi ikan.
  const f = G.fishing;
  const spot = city.fishingSpots[0];
  if (!f.active && dist2(px, pz, spot.x, spot.z) < 49) {
    G.prompt = 'F — Mancing di dermaga (tekan F saat bar di zona hijau)';
    if (wasPressed('KeyF') || G.touch.actPressed) {
      G.touch.actPressed = false; f.active = true; f.bar = 0; f.dir = 1; f.hits = 0;
      G.toast = 'Mancing! Tekan F saat bar di zona hijau (3x)'; G.toastT = 3;
    }
  } else if (f.active) {
    // Bar bergerak pelan (0,8/dtk) + zona hijau lebar (30–80%) supaya
    // timing bisa dilakukan manusia — dan terverifikasi di playtest.
    f.bar += f.dir * dt * 0.8;
    if (f.bar > 1) { f.bar = 1; f.dir = -1; }
    if (f.bar < 0) { f.bar = 0; f.dir = 1; }
    if (wasPressed('KeyF') || G.touch.actPressed) {
      G.touch.actPressed = false;
      if (f.bar > 0.30 && f.bar < 0.80) {
        f.hits++; playBlip(1100);
        if (f.hits >= f.need) {
          const fish = ['Ikan Kerapu', 'Ikan Tuna Kecil', 'Ikan Marlin Muda', 'Ikan Kakap'][Math.floor(Math.random() * 4)];
          G.fish.push(fish); G.fishCaught[fish] = (G.fishCaught[fish] || 0) + 1;
          G.cash += CFG.fishPrice; f.active = false;
          G.toast = `Dapat ${fish}! +$${CFG.fishPrice} (koleksi: ${G.fish.length})`; G.toastT = 3; playJingle();
        } else G.toast = `Kena! ${f.hits}/${f.need}`; G.toastT = 1;
      } else { f.active = false; G.toast = 'Ikan lepas! Coba mancing lagi'; G.toastT = 2; }
    }
  }
  // (d) SPOT FOTO — 6 titik tersembunyi di kota.
  for (let i = 0; i < city.photoSpots.length; i++) {
    const sp = city.photoSpots[i];
    if (!G.photos.includes(i) && dist2(px, pz, sp.x, sp.z) < 49) {
      G.prompt = `F — Foto: ${sp.name} (${G.photos.length}/6)`;
      if (wasPressed('KeyF') || G.touch.actPressed) {
        G.touch.actPressed = false; G.photos.push(i);
        G.toast = `Foto ${sp.name} diambil! (${G.photos.length}/6)`; G.toastT = 2.5; playBlip(1300);
        if (G.photos.length === 6) { G.cash += CFG.photoBonus; G.toast = `SEMUA FOTO LENGKAP! +$${CFG.photoBonus}`; playJingle(); }
      }
    }
  }
  // (e) MISI SAMPINGAN PENDEK — antar paket kilat (muncul berkala).
  const s = G.sideJob;
  if (!s.active && G.time % 90 < dt && Math.random() < 0.5) {
    const rp = roadPoint(); s.active = true; s.tx = rp.x; s.tz = rp.z; s.t = 75;
    G.toast = 'Misi sampingan: antar paket kilat ke marker hijau (75 detik)!'; G.toastT = 3;
  } else if (s.active) {
    s.t -= dt;
    if (dist2(px, pz, s.tx, s.tz) < 81) { s.active = false; s.done++; G.cash += 60; G.toast = 'Paket kilat sampai! +$60'; G.toastT = 3; playJingle(); }
    else if (s.t <= 0) { s.active = false; G.toast = 'Paket kilat gagal — waktu habis'; G.toastT = 2; }
  }
}
export function saveGame() {
  try {
    localStorage.setItem('solarabay-save', JSON.stringify({ cash: G.cash, missionIdx: G.missionIdx, missionsDone: G.missionsDone, photos: G.photos, fish: G.fish, stats: G.stats }));
  } catch (e) { /* abaikan */ }
}
export function loadGame() {
  try {
    const s = JSON.parse(localStorage.getItem('solarabay-save') || 'null');
    if (!s) return false;
    G.cash = s.cash; G.missionIdx = s.missionIdx; G.missionsDone = s.missionsDone || 0;
    G.photos = s.photos || []; G.fish = s.fish || []; G.stats = s.stats || G.stats;
    G.respect = Math.min(5, 1 + G.missionsDone);
    return true;
  } catch (e) { return false; }
}
