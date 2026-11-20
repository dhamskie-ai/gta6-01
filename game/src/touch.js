// Touch controls: joystick, ENTER/REM/KAM/TEMBAK buttons, drag-to-look.
import { driveCarRef, exitCar } from './player.js';
import { shoot } from './combat.js';
import { toggleMute } from './audio.js';

export function initTouch(G) {
  G.touchMode = 'ontouchstart' in window || matchMedia('(pointer: coarse)').matches
    || new URLSearchParams(location.search).has('touch');
  G.joy = { x: 0, y: 0 };
  G.touchShoot = false;
  if (!G.touchMode) return;
  document.body.classList.add('touch');
  const el = G.el;
  const joyBase = el.joyBase, knob = el.joyKnob;
  let joyId = null;
  const setKnob = (dx, dy) => {
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  joyBase.addEventListener('touchstart', (e) => {
    e.preventDefault();
    joyId = e.changedTouches[0].identifier;
  }, { passive: false });
  addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        const r = joyBase.getBoundingClientRect();
        let dx = t.clientX - (r.left + r.width / 2);
        let dy = t.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy), max = 44;
        if (d > max) { dx *= max / d; dy *= max / d; }
        setKnob(dx, dy);
        G.joy.x = dx / max; G.joy.y = dy / max;
      } else if (G.dragId === t.identifier) {
        G.camYaw -= (t.clientX - G.dragX) * 0.005;
        G.camPitch = Math.max(-0.9, Math.min(0.25, G.camPitch + (t.clientY - G.dragY) * 0.004));
        G.dragX = t.clientX; G.dragY = t.clientY;
      }
    }
  }, { passive: false });
  addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) { joyId = null; G.joy.x = 0; G.joy.y = 0; setKnob(0, 0); }
      if (t.identifier === G.dragId) G.dragId = null;
    }
  });
  G.canvas.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    G.dragId = t.identifier; G.dragX = t.clientX; G.dragY = t.clientY;
  }, { passive: true });
  const bindBtn = (elm, fn) => { if (elm) elm.addEventListener('touchstart', (e) => { e.preventDefault(); fn(); }, { passive: false }); };
  bindBtn(el.btnEnter, () => {
    if (driveCarRef(G)) exitCar(G);
    else G.pressed.KeyE = true;
  });
  bindBtn(el.btnBrake, () => { G.touchBrake = true; setTimeout(() => { G.touchBrake = false; }, 300); });
  bindBtn(el.btnCam, () => { G.camDist = G.camDist === 9 ? 7 : G.camDist === 7 ? 13 : 9; });
  bindBtn(el.btnShoot, () => { G.touchShoot = true; });
}
export function updateTouchUI(G) {
  if (!G.touchMode) return;
  const car = driveCarRef(G);
  if (G.el.btnEnter) G.el.btnEnter.textContent = car ? 'KELUAR' : 'MASUK';
  if (G.el.touchUi) G.el.touchUi.style.display = G.phase === 'play' ? 'block' : 'none';
}
