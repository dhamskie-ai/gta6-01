// HUD: mission panel, stars, weapon slots, PCPD list, minimap, dialog, radio.
import { CONFIG, districtAt, respectTitle, fmtCash, fmtTime } from './config.js';

const $ = (id) => document.getElementById(id);
const HUES = { Marco: '#2a6f9e', 'Sal Vega': '#8a5a2a', Kip: '#2a8a5a', 'Mara Voss': '#8a2a6a', Lupe: '#6a2a8a', 'Dario Kane': '#8a1a1a' };

export function createHud(G) {
  const mm = $('minimap').getContext('2d');
  const flash = document.createElement('div');
  Object.assign(flash.style, { position: 'absolute', inset: '0', background: 'radial-gradient(ellipse, transparent 55%, rgba(255,0,0,0.45))', opacity: '0', pointerEvents: 'none', zIndex: 4 });
  $('app').appendChild(flash);
  let flashV = 0, policeT = 0, radioT = 0, trackI = 0, dialogT = 0, tickerT = 0, endCb = null;
  // weapon slots
  const slotsEl = $('slots');
  G.weapons.forEach((w, i) => {
    const d = document.createElement('div'); d.className = 'slot'; d.id = 'slot' + i;
    slotsEl.appendChild(d);
  });
  function renderSlots() {
    G.weapons.forEach((w, i) => {
      const d = $('slot' + i);
      const sub = w.locked ? 'LOCKED' : !w.owned ? fmtCash(w.price) : (w.ammo === Infinity ? '∞' : w.ammo);
      d.innerHTML = `<b>${i + 1} ${w.name}</b><span class="${w.locked || !w.owned ? 'locked' : ''}">${sub}</span>`;
      d.classList.toggle('cur', i === G.weaponIndex);
    });
    $('curweapon').textContent = G.weapons[G.weaponIndex].name + (G.weapons[G.weaponIndex].id === 'breaker' && !G.weapons[G.weaponIndex].owned ? ' — $3,800 at Cal\'s Guns' : '');
    $('weapontext').textContent = G.weapons[G.weaponIndex].name;
  }
  function showDialog(who, role, line) {
    $('dialog').classList.remove('hidden');
    $('portrait').textContent = who.split(' ').map((w) => w[0]).join('').slice(0, 2);
    $('portrait').style.background = `linear-gradient(135deg, ${HUES[who] || '#2a6f9e'}, #5a3a8a)`;
    $('dlgwho').innerHTML = `${who} <span>${role}</span>`;
    $('dlgline').textContent = line;
    dialogT = 9;
  }
  function showEnd(title, sub, text, btn, cb) {
    $('endtitle').textContent = title; $('endsub').textContent = sub; $('endtext').textContent = text;
    $('btnend').textContent = btn; endCb = cb;
    $('endscreen').classList.remove('hidden');
  }
  $('btnend').addEventListener('click', () => { if (endCb) endCb(); });
  $('btnnew').addEventListener('click', () => { G.audio.unlock(); G.newGame(); });
  $('btncontinue').addEventListener('click', () => { G.audio.unlock(); G.continueGame(); });
  $('btnresume').addEventListener('click', () => { G.phase = 'play'; $('pausemenu').classList.add('hidden'); });
  $('btnrestart').addEventListener('click', () => { $('pausemenu').classList.add('hidden'); G.missions.startMission(G.missions.current().index); G.phase = 'play'; });
  $('btnquit').addEventListener('click', () => { G.save(); $('pausemenu').classList.add('hidden'); G.toTitle(); });
  function drawMinimap() {
    const S = 200, k = S / 640;
    mm.clearRect(0, 0, S, S);
    mm.fillStyle = '#0e2a3a'; mm.fillRect(0, 0, S, S);
    mm.fillStyle = '#2a6f9e'; mm.fillRect(0, 0, 12, S); // sea
    mm.fillStyle = '#c9a86a'; mm.fillRect(12, 0, 8, S); // beach
    mm.fillStyle = '#3a3f46';
    for (const c of [-240, -120, 0, 120, 240]) { mm.fillRect((c - 7 + 320) * k, 0, 14 * k, S); mm.fillRect(0, (c - 7 + 320) * k, S, 14 * k); }
    mm.fillStyle = '#2a2f36';
    for (const b of G.city.boxes.slice(0, 120)) mm.fillRect((b.x - b.hw + 320) * k, (b.z - b.hd + 320) * k, b.hw * 2 * k, b.hd * 2 * k);
    mm.fillStyle = '#8a6a4a'; mm.fillRect((-322 + 320) * k, (CONFIG.pier.z - 4 + 320) * k, 40 * k, 8 * k);
    mm.fillStyle = '#5dff8f'; mm.fillRect((CONFIG.garage.x - 3 + 320) * k, (CONFIG.garage.z - 3 + 320) * k, 6 * k, 6 * k);
    mm.fillStyle = '#c98aff';
    for (const s of [CONFIG.gunShop, CONFIG.sprayShop]) mm.fillRect((s.x - 3 + 320) * k, (s.z - 3 + 320) * k, 6 * k, 6 * k);
    mm.fillStyle = '#ffd24a';
    for (const c of G.city.coins.slice(0, 30)) { mm.beginPath(); mm.arc((c.position.x + 320) * k, (c.position.z + 320) * k, 2, 0, 7); mm.fill(); }
    const tgt = G.missions?.target?.();
    if (tgt && G.phase === 'play') {
      const pulse = 5 + Math.sin(G.time * 5) * 2;
      mm.fillStyle = '#ffd24a'; mm.beginPath(); mm.arc((tgt.x + 320) * k, (tgt.z + 320) * k, pulse, 0, 7); mm.fill();
      mm.fillStyle = '#222'; mm.font = 'bold 9px Verdana'; mm.textAlign = 'center'; mm.fillText('!', (tgt.x + 320) * k, (tgt.z + 320) * k + 3);
    }
    mm.fillStyle = '#2f7bff';
    for (const c of G.police.cars) { mm.beginPath(); mm.arc((c.x + 320) * k, (c.z + 320) * k, 3, 0, 7); mm.fill(); }
    // player arrow
    const px = (G.player.x + 320) * k, pz = (G.player.z + 320) * k;
    mm.save(); mm.translate(px, pz); mm.rotate(G.player.heading);
    mm.fillStyle = '#fff'; mm.beginPath(); mm.moveTo(0, -7); mm.lineTo(5, 6); mm.lineTo(-5, 6); mm.closePath(); mm.fill(); mm.restore();
    // north tick
    mm.fillStyle = '#fff'; mm.font = 'bold 10px Verdana'; mm.textAlign = 'center'; mm.fillText('N', S / 2, 12);
  }
  return {
    showDialog, showEnd,
    hideEnd() { $('endscreen').classList.add('hidden'); },
    showStars() {},
    showObjective(t) { $('objective').textContent = t; },
    showMission() {
      const c = G.missions.current();
      $('joblabel').textContent = `JOB ${c.index + 1}/8 · ${c.mission.name}${c.mission.client ? ' · ' + c.mission.client : ''}`;
      $('stagelabel').textContent = `STAGE ${c.step + 1}/${c.mission.steps.length}`;
      $('stagebar').style.width = ((c.step + 1) / c.mission.steps.length * 100) + '%';
      $('nextlabel').textContent = c.stepObj.next || 'Job done';
      $('objective').textContent = c.stepObj.text;
    },
    prompt(t) { const el = $('prompt'); if (!t) el.classList.add('hidden'); else { el.classList.remove('hidden'); el.textContent = t; } },
    ticker(t) { const el = $('ticker'); el.textContent = t; el.classList.remove('hidden'); tickerT = 4; },
    flashDamage() { flashV = 1; },
    toTitle() { $('title').classList.remove('hidden'); },
    hideTitle() { $('title').classList.add('hidden'); },
    update(dt) {
      const c = G.missions?.current?.();
      if (c) {
        $('timer').style.display = c.timer > 0 ? '' : 'none';
        $('timer').textContent = fmtTime(c.timer);
        $('stagelabel').textContent = `STAGE ${c.step + 1}/${c.mission.steps.length}`;
        $('stagebar').style.width = ((c.step + 1) / c.mission.steps.length * 100) + '%';
        $('nextlabel').textContent = c.stepObj.next || 'Job done';
      }
      const seen = G.wanted > 0 && G.police.seen();
      $('objstate').textContent = G.wanted > 0 ? (seen ? 'They can see you · break line of sight' : 'Hidden — stay out of sight') : '';
      $('hptext').textContent = Math.ceil(G.health);
      $('hpbar').style.width = G.health + '%';
      $('armortext').textContent = Math.ceil(G.armor);
      $('armorbar').style.width = G.armor + '%';
      const h = Math.floor(G.timeOfDay), m = Math.floor((G.timeOfDay - h) * 60);
      $('clock').textContent = `DAY ${G.day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      $('cash').textContent = fmtCash(G.cash);
      $('stars').textContent = '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
      $('insight').classList.toggle('hidden', !seen);
      renderSlots();
      // police list (rebuilt every frame: sim dt is tiny vs real frame time)
      {
        const units = G.police.units;
        $('police').classList.toggle('hidden', units.length === 0);
        $('unitcount').textContent = `${units.length} UNITS · CODE ${Math.max(1, G.wanted)}`;
        const tagCls = { RAMMING: 'ram', PURSUIT: 'pur', SPOTLIGHT: 'spot', FIRING: 'fire', ROADBLOCK: 'block' };
        $('unitlist').innerHTML = units.slice(0, 5).map((u) => `<div class="u"><span>▸ ${u.name}</span><span>${u.d} m <span class="tag ${tagCls[u.role] || 'pur'}">${u.role}</span></span></div>`).join('');
        $('unitmore').textContent = units.length > 5 ? `+${units.length - 5} more units · roadblocks on the boulevard` : '';
      }
      $('district').textContent = districtAt(G.player.x, G.player.z);
      const rt = respectTitle(G.respect);
      $('respectlabel').textContent = `RESPECT · ${rt.title} ${G.respect} / ${rt.next}`;
      $('respectbar').style.width = Math.min(100, G.respect / rt.next * 100) + '%';
      drawMinimap();
      // radio
      radioT += dt;
      if (radioT > 25) { radioT = 0; trackI = (trackI + 1) % CONFIG.radio.tracks.length; }
      $('track').textContent = CONFIG.radio.tracks[trackI];
      // speed
      const car = G.car;
      $('carhud').style.display = car ? '' : 'none';
      if (car) {
        const kmh = Math.abs(car.speed) * 3.6;
        $('speed').textContent = Math.round(kmh);
        $('gear').textContent = car.speed < -0.5 ? 'R' : kmh < 1 ? 'N' : kmh < 30 ? 'G1' : kmh < 60 ? 'G2' : kmh < 120 ? 'G3' : kmh < 150 ? 'G4' : 'G5';
        $('carname').textContent = car.name.toUpperCase();
        $('condtext').textContent = Math.max(0, Math.round(car.hp)) + '%';
        $('condbar').style.width = Math.max(0, car.hp) + '%';
      }
      if (dialogT > 0) { dialogT -= dt; if (dialogT <= 0) $('dialog').classList.add('hidden'); }
      if (tickerT > 0) { tickerT -= dt; if (tickerT <= 0) $('ticker').classList.add('hidden'); }
      if (flashV > 0) { flashV = Math.max(0, flashV - dt * 2); flash.style.opacity = String(flashV); }
    },
  };
}
