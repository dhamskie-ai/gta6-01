// HUD DOM: panel misi, PCPD response, minimap, dialog, radio, speed.
import { RADIO, RESPECT_TITLES, RESPECT_MAX, WEAPONS } from './config.js';
import { fmtCash, fmtTimer } from './random.js';
import { districtAt } from './city.js';

const ROLES = {
  Marco: 'SMUGGLER · WHEELMAN', Lupe: 'CLIENT', Nico: 'DRIVER',
  Sal: 'FIXER', Kip: 'HACKER', Mara: 'MECHANIC', Dario: 'DEVELOPER',
};
const $ = (id) => document.getElementById(id);

export function createHud(G, handlers) {
  const H = {
    dialogT: 0, bannerT: 0, tickerT: 0, lastSlots: '', lastPolice: '',
    mm: $('minimap'), mmCtx: null,
  };
  H.mmCtx = H.mm.getContext('2d');
  const hue = (name) => {
    let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
    return h;
  };
  H.showDialog = function (speaker, text) {
    let name = speaker, line = text;
    const m = String(text).match(/^([A-Za-z]+):\s*(.*)$/);
    if (m && ROLES[m[1]]) { name = m[1]; line = m[2]; }
    $('dialogPortrait').textContent = name.slice(0, 2).toUpperCase();
    $('dialogPortrait').style.background = `linear-gradient(135deg, hsl(${hue(name)},70%,55%), hsl(${(hue(name) + 60) % 360},70%,40%))`;
    $('dialogName').textContent = name.toUpperCase() + '  ·  ' + (ROLES[name] || 'CONTACT');
    $('dialogText').textContent = line;
    $('dialogBox').classList.remove('hidden');
    H.dialogT = 7;
  };
  H.showObjective = function (label) { $('mObjective').textContent = label; };
  H.showBanner = function (text) {
    $('banner').textContent = text;
    $('banner').classList.remove('hidden');
    H.bannerT = 3;
  };
  H.ticker = function (text) {
    $('tickerBox').textContent = text;
    $('tickerBox').classList.remove('hidden');
    H.tickerT = 4.5;
  };
  H.showTitle = function (hasSave) {
    $('titleScreen').classList.remove('hidden');
    $('hud').classList.add('hidden');
    $('btnContinue').style.display = hasSave ? '' : 'none';
  };
  H.showGame = function () {
    $('titleScreen').classList.add('hidden');
    $('pauseMenu').classList.add('hidden');
    $('endScreen').classList.add('hidden');
    $('hud').classList.remove('hidden');
  };
  H.showPause = function (on) { $('pauseMenu').classList.toggle('hidden', !on); };
  H.showEnd = function (title, text) {
    $('endTitle').textContent = title;
    $('endText').textContent = text;
    $('endScreen').classList.remove('hidden');
    $('btnEndRetry').style.display = G.phase === 'failed' ? '' : 'none';
  };
  H.hideEnd = function () { $('endScreen').classList.add('hidden'); };

  $('btnNew').addEventListener('click', () => { G.audio.ensure(); handlers.newGame(); });
  $('btnContinue').addEventListener('click', () => { G.audio.ensure(); handlers.continueGame(); });
  $('btnResume').addEventListener('click', () => handlers.resume());
  $('btnRestart').addEventListener('click', () => handlers.restartMission());
  $('btnSaveQuit').addEventListener('click', () => handlers.saveQuit());
  $('btnEndRetry').addEventListener('click', () => handlers.retryEnd());
  $('btnEndContinue').addEventListener('click', () => handlers.closeEnd());
  $('titleScreen').addEventListener('click', (e) => {
    if (e.target === $('titleScreen')) { G.audio.ensure(); handlers.newGame(); }
  });

  H.update = function (G, dt) {
    // --- panel misi ---
    const m = G.mission;
    if (m) {
      const s = m.steps[m.step];
      $('mJob').textContent = 'JOB ' + (m.index + 1) + '/8  ' + m.def.name + ' · ' + m.def.client;
      $('mTimer').textContent = m.timer > 0 ? '◷ ' + fmtTimer(m.timer) : '';
      $('mTimer').style.display = m.timer > 0 ? '' : 'none';
      $('mObjective').textContent = s ? s.label : '—';
      $('mStage').textContent = 'STAGE ' + Math.min(m.step + 1, m.steps.length) + '/' + m.steps.length;
      const nx = m.steps[m.step + 1];
      $('mNext').textContent = nx ? 'NEXT  ' + nx.label : 'NEXT  Finish the job';
    } else {
      $('mJob').textContent = 'FREE ROAM  ·  SOLARA BAY';
      $('mTimer').style.display = 'none';
      $('mObjective').textContent = 'Explore the city — the next job waits at the garage.';
      $('mStage').textContent = 'STAGE —/—';
      $('mNext').textContent = 'NEXT  Talk to Marco at the garage';
    }
    // --- vitals ---
    $('hpFill').style.width = G.health + '%';
    $('armorFill').style.width = G.armor + '%';
    $('weaponName').textContent = G.weapons[G.weapon].name + (G.weapon === 1 ? '' : '  ' + G.weapons[G.weapon].mag);
    // --- kanan atas ---
    $('dayLabel').textContent = 'DAY ' + G.day;
    $('cashLabel').textContent = fmtCash(G.cash);
    $('starsLabel').textContent = '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
    const hh = Math.floor(G.timeOfDay), mm = Math.floor((G.timeOfDay - hh) * 60);
    $('clockLabel').textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    let nearest = 1e9;
    for (const u of (G.policeUnits || [])) nearest = Math.min(nearest, u.dist);
    $('wantedState').textContent = G.wanted > 0
      ? (nearest < 45 ? 'IN SIGHT — search zone follows you' : 'HIDDEN — stay out of sight')
      : '';
    // --- daftar PCPD: rebuild SETIAP frame (timer 0,5 dtk gagal di SwiftShader) ---
    const units = G.policeUnits || [];
    if (G.wanted > 0 && units.length > 0) {
      const rows = units.slice(0, 5).map((u) => {
        const cls = u.role === 'RAMMING' ? 'tag-red' : u.role === 'FIRING' ? 'tag-orange'
          : u.role === 'SPOTLIGHT' ? 'tag-blue' : 'tag-yellow';
        return '<div class="prow"><span class="pcall">' + u.callsign + '</span><span class="pdist">' + u.dist + ' m</span><span class="ptag ' + cls + '">' + u.role + '</span></div>';
      }).join('');
      const more = units.length > 5
        ? '<div class="pmore">+' + (units.length - 5) + ' more units · roadblocks on the boulevard</div>'
        : '';
      const html = '<div class="phead">● PCPD RESPONSE <span>' + units.length + ' UNITS · CODE ' + G.wanted + '</span></div>' + rows + more;
      if (html !== H.lastPolice) { $('policeRows').innerHTML = html; H.lastPolice = html; }
      $('policePanel').classList.remove('hidden');
    } else $('policePanel').classList.add('hidden');
    // --- slot senjata ---
    const slots = [1, 2, 3, 4, 5].map((n) => {
      const w = G.weapons[n];
      const sub = w.locked && !w.owned ? 'LOCKED' : !w.owned ? (w.price > 0 ? '$' + w.price.toLocaleString('en-US') : w.ammo) : (n === 1 ? '∞' : w.mag);
      return n + '|' + w.name + '|' + sub + '|' + (G.weapon === n ? '1' : '0');
    }).join(';');
    if (slots !== H.lastSlots) {
      H.lastSlots = slots;
      [1, 2, 3, 4, 5].forEach((n) => {
        const w = G.weapons[n];
        const el = $('slot' + n);
        const sub = w.locked && !w.owned ? 'LOCKED' : !w.owned ? (w.price > 0 ? '$' + w.price.toLocaleString('en-US') : w.ammo) : (n === 1 ? '∞' : w.mag);
        el.innerHTML = '<b>' + n + '</b> ' + w.name + ' <i>' + sub + '</i>';
        el.classList.toggle('active', G.weapon === n);
        el.classList.toggle('locked', !!(w.locked && !w.owned));
      });
      $('weaponSlots').style.display = '';
    }
    $('curWeapon').textContent = G.weapons[G.weapon].name;
    // --- minimap ---
    drawMinimap(H, G);
    $('districtLabel').textContent = districtAt(G.player.x, G.player.z);
    const title = RESPECT_TITLES[Math.min(4, Math.floor((G.missionsDone || 0) / 2))];
    $('respectLabel').textContent = 'RESPECT · ' + title + '  ' + (G.respectPoints || 0) + ' / ' + RESPECT_MAX;
    $('respectFill').style.width = ((G.respectPoints || 0) / RESPECT_MAX * 100) + '%';
    // --- radio + speed ---
    $('radioStation').textContent = '♪ ' + RADIO.station;
    $('radioTrack').textContent = RADIO.tracks[G.audio.trackIdx % RADIO.tracks.length];
    if (G.player.inCar && G.playerCar) {
      const car = G.playerCar;
      $('speedBox').classList.remove('hidden');
      $('carName').textContent = car.name.toUpperCase();
      $('condFill').style.width = Math.max(0, car.hp / car.maxHp * 100) + '%';
      $('condLabel').textContent = 'CONDITION ' + Math.max(0, Math.round(car.hp / car.maxHp * 100)) + '%';
      const kmh = Math.round(Math.abs(car.speed) * 3.6);
      $('speedNum').textContent = kmh;
      const gear = car.speed < -0.5 ? 'R' : kmh < 40 ? 'G1' : kmh < 80 ? 'G2' : kmh < 120 ? 'G3' : kmh < 160 ? 'G4' : 'G5';
      $('gearLabel').textContent = gear;
    } else $('speedBox').classList.add('hidden');
    // --- prompt / ticker / dialog / banner timers ---
    $('promptLabel').textContent = G.prompt || '';
    $('promptLabel').style.display = G.prompt ? '' : 'none';
    if (H.dialogT > 0) { H.dialogT -= dt; if (H.dialogT <= 0) $('dialogBox').classList.add('hidden'); }
    if (H.bannerT > 0) { H.bannerT -= dt; if (H.bannerT <= 0) $('banner').classList.add('hidden'); }
    if (H.tickerT > 0) { H.tickerT -= dt; if (H.tickerT <= 0) $('tickerBox').classList.add('hidden'); }
  };
  return H;
}

function drawMinimap(H, G) {
  const c = H.mmCtx, S = 200 / 600;
  const X = (x) => (x + 300) * S, Y = (z) => (z + 300) * S;
  c.clearRect(0, 0, 200, 200);
  c.fillStyle = '#101826'; c.fillRect(0, 0, 200, 200);
  c.fillStyle = '#2a7fa8'; c.fillRect(0, 0, X(-282), 200); // laut
  c.fillStyle = '#c9b489'; c.fillRect(X(-282), 0, X(-252) - X(-282), 200); // pantai
  c.strokeStyle = '#3a4150'; c.lineWidth = 5;
  for (const r of [-240, -120, 0, 120, 240]) {
    c.beginPath(); c.moveTo(X(r), 0); c.lineTo(X(r), 200); c.stroke();
    c.beginPath(); c.moveTo(0, Y(r)); c.lineTo(200, Y(r)); c.stroke();
  }
  // rute balap (merah) saat aktif
  if (G.race && G.race.active) {
    c.strokeStyle = '#ff2a22'; c.lineWidth = 2.5;
    c.beginPath();
    G.race.route.forEach(([x, z], i) => { if (i === 0) c.moveTo(X(x), Y(z)); else c.lineTo(X(x), Y(z)); });
    c.stroke();
  }
  // garasi + toko
  c.fillStyle = '#2aff5e';
  c.fillRect(X(G.city.garage.x) - 3, Y(G.city.garage.z) - 3, 6, 6);
  c.fillStyle = '#b678f0';
  for (const s of [G.city.respray, G.city.gunShop]) c.fillRect(X(s.x) - 2, Y(s.z) - 2, 4, 4);
  // marker misi
  if (G.beacon && G.beacon.visible) {
    const pulse = 5 + Math.sin(performance.now() / 240) * 2;
    c.fillStyle = '#ffd23e';
    c.beginPath(); c.arc(X(G.beacon.x), Y(G.beacon.z), pulse, 0, 6.29); c.fill();
    c.strokeStyle = '#ffd23e'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(X(G.beacon.x), Y(G.beacon.z), pulse + 4, 0, 6.29); c.stroke();
  }
  // polisi
  for (const u of (G.policeUnits || [])) {
    const car = (G.policeCars || []).find((pc) => pc.callsign === u.callsign);
    if (!car) continue;
    c.fillStyle = u.role === 'ROADBLOCK' ? '#ff8a3d' : '#3a86ff';
    c.beginPath(); c.arc(X(car.x), Y(car.z), 3, 0, 6.29); c.fill();
  }
  if (G.heli) {
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(X(G.heli.mesh.position.x), Y(G.heli.mesh.position.z), 3.5, 0, 6.29); c.fill();
  }
  // pemain
  const px = X(G.player.x), py = Y(G.player.z);
  const yaw = G.player.inCar && G.playerCar ? G.playerCar.yaw : G.player.yaw;
  c.save();
  c.translate(px, py);
  c.rotate(Math.atan2(Math.sin(yaw), -Math.cos(yaw)));
  c.fillStyle = '#ffffff';
  c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 5); c.lineTo(-5, 5); c.closePath(); c.fill();
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1;
  c.beginPath(); c.arc(100, 100, 99, 0, 6.29); c.stroke();
}
