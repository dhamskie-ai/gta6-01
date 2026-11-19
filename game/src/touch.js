// Touch controls for phones: virtual joystick (bottom-left), MASUK/KELUAR,
// REM, KAM buttons (bottom-right), finger drag rotates the camera.
// Only shown on touch devices (or ?touch=1 for testing). Desktop keyboard
// + pointer lock are untouched by this file.
import { G } from './config.js';
import { touch } from './input.js';

let joyBase = null, joyKnob = null, joyId = null, joyC = null;
let camId = null, camLX = 0, camLY = 0;

export function touchActive() {
  return G.touchMode;
}

export function initTouch() {
  const params = new URLSearchParams(location.search);
  const coarse = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (!coarse && params.get('touch') !== '1') return;
  G.touchMode = true;
  touch.active = true;
  document.body.classList.add('touch');
  const ui = document.getElementById('touch-ui');
  ui.style.display = 'block';
  joyBase = document.getElementById('joy-base');
  joyKnob = document.getElementById('joy-knob');
  const rect = () => joyBase.getBoundingClientRect();
  const setKnob = (dx, dy) => {
    joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    touch.moveX = dx / 44; touch.moveY = dy / 44;
  };
  joyBase.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    joyId = t.identifier; joyC = rect();
    moveJoy(t);
  }, { passive: false });
  const moveJoy = (t) => {
    const cx = joyC.left + joyC.width / 2, cy = joyC.top + joyC.height / 2;
    let dx = t.clientX - cx, dy = t.clientY - cy;
    const len = Math.hypot(dx, dy), max = 44;
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
    setKnob(dx, dy);
  };
  joyBase.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === joyId) moveJoy(t);
  }, { passive: false });
  const endJoy = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) { joyId = null; setKnob(0, 0); }
    }
  };
  joyBase.addEventListener('touchend', endJoy);
  joyBase.addEventListener('touchcancel', endJoy);
  // camera drag anywhere on the canvas that is not a control
  const canvas = document.getElementById('game');
  canvas.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      if (t.target.closest('#touch-ui')) continue;
      camId = t.identifier; camLX = t.clientX; camLY = t.clientY;
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== camId) continue;
      touch.camDX += t.clientX - camLX; touch.camDY += t.clientY - camLY;
      camLX = t.clientX; camLY = t.clientY;
    }
  }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) if (t.identifier === camId) camId = null;
  });
  const bindHold = (id, on, off) => {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', (e) => { e.preventDefault(); on(); }, { passive: false });
    if (off) {
      el.addEventListener('touchend', off);
      el.addEventListener('touchcancel', off);
    }
  };
  bindHold('btn-enter', () => { touch.enter = true; });
  bindHold('btn-brake', () => { touch.brake = true; }, () => { touch.brake = false; });
  bindHold('btn-cam', () => { touch.cam = true; G.camDist = G.camDist > 10 ? 7 : 13; });
  bindHold('btn-shoot', () => { touch.shoot = true; }, () => { touch.shoot = false; });
}

// Called every frame: keep the MASUK/KELUAR label truthful.
export function updateTouchUI() {
  if (!G.touchMode) return;
  const b = document.getElementById('btn-enter');
  if (b) b.textContent = G.player.car ? 'KELUAR' : 'MASUK';
}
