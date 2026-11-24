// Touch controls for phones: virtual joystick + action buttons + camera drag.
import { G } from './config.js';

export function initTouch() {
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 ||
    new URLSearchParams(location.search).has('touch');
  const ui = document.getElementById('touchUI');
  if (!ui) return;
  if (!isTouch) { ui.classList.add('hidden'); return; }
  ui.classList.remove('hidden');
  G.touch.active = true;
  const hint = document.getElementById('hint');
  if (hint) hint.classList.add('hidden'); // keyboard hints make no sense on touch
  const joy = document.getElementById('joy'), knob = document.getElementById('joyKnob');
  const btnAct = document.getElementById('btnAct'), btnBrake = document.getElementById('btnBrake');
  const btnCam = document.getElementById('btnCam'), btnFire = document.getElementById('btnFire');
  let joyId = null, camId = null, lastX = 0;
  const joyRect = () => joy.getBoundingClientRect();
  const setKnob = (dx, dy) => {
    knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  };
  addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      const r = joyRect();
      if (t.clientX >= r.left && t.clientX <= r.right && t.clientY >= r.top && t.clientY <= r.bottom && joyId === null) {
        joyId = t.identifier;
      } else if (t.clientX > window.innerWidth * 0.4 && camId === null) {
        camId = t.identifier; lastX = t.clientX;
      }
    }
  }, { passive: true });
  addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        const r = joyRect();
        let dx = (t.clientX - (r.left + r.width / 2)) / (r.width / 2);
        let dy = (t.clientY - (r.top + r.height / 2)) / (r.height / 2);
        const len = Math.hypot(dx, dy);
        if (len > 1) { dx /= len; dy /= len; }
        G.touch.moveX = dx; G.touch.moveY = -dy;
        setKnob(dx * 34, dy * 34);
      } else if (t.identifier === camId) {
        G.touch.camDX += (t.clientX - lastX) * 0.6;
        lastX = t.clientX;
      }
    }
  }, { passive: true });
  const endTouch = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) { joyId = null; G.touch.moveX = 0; G.touch.moveY = 0; setKnob(0, 0); }
      if (t.identifier === camId) camId = null;
    }
  };
  addEventListener('touchend', endTouch);
  addEventListener('touchcancel', endTouch);
  if (btnAct) btnAct.addEventListener('touchstart', (e) => { e.preventDefault(); G.touchAct = true; }, { passive: false });
  if (btnBrake) btnBrake.addEventListener('touchstart', (e) => { e.preventDefault(); G.touchBrake = true; }, { passive: false });
  if (btnBrake) btnBrake.addEventListener('touchend', () => { G.touchBrake = false; });
  if (btnCam) btnCam.addEventListener('touchstart', (e) => { e.preventDefault(); G.camDist = G.camDist > 12 ? 7 : G.camDist + 3; }, { passive: false });
  if (btnFire) btnFire.addEventListener('touchstart', (e) => { e.preventDefault(); G.touchFire = true; }, { passive: false });
  if (btnFire) btnFire.addEventListener('touchend', () => { G.touchFire = false; });
}
export function updateTouchLabels() {
  const btnAct = document.getElementById('btnAct');
  if (!btnAct || !G.touch.active) return;
  const p = G.player;
  btnAct.textContent = p && p.car ? 'KELUAR' : 'MASUK';
}
