// Kontrol sentuh HP: joystick kiri bawah, MASUK/KELUAR, REM, KAM, AKSI.
// Hanya tampil di perangkat sentuh (atau ?touch=1).
import { G } from './config.js';
export function initTouch() {
  const q = new URLSearchParams(location.search);
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || q.get('touch') === '1';
  const ui = document.getElementById('touch-ui');
  if (!isTouch) { ui.style.display = 'none'; return; }
  ui.style.display = 'block';
  G.touch.active = true;
  const joyBase = document.getElementById('joy-base');
  const knob = document.getElementById('joy-knob');
  let joyId = null;
  const setJoy = (cx, cy) => {
    const r = joyBase.getBoundingClientRect();
    let dx = (cx - (r.x + r.width / 2)) / (r.width / 2);
    let dy = (cy - (r.y + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    G.touch.joyX = dx; G.touch.joyY = dy;
    knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
  };
  joyBase.addEventListener('touchstart', (e) => { e.preventDefault(); joyId = e.changedTouches[0].identifier; setJoy(e.changedTouches[0].clientX, e.changedTouches[0].clientY); }, { passive: false });
  joyBase.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === joyId) setJoy(t.clientX, t.clientY);
  }, { passive: false });
  const endJoy = (e) => {
    for (const t of e.changedTouches) if (t.identifier === joyId) { joyId = null; G.touch.joyX = 0; G.touch.joyY = 0; knob.style.transform = 'translate(0,0)'; }
  };
  joyBase.addEventListener('touchend', endJoy);
  joyBase.addEventListener('touchcancel', endJoy);
  // Tombol MASUK/KELUAR (label dinamis) — tap via touchscreen.
  const btnEnter = document.getElementById('btn-enter');
  // Hanya touchstart (tanpa click) supaya satu tap tidak terhitung dua kali.
  const tap = (el, fn) => {
    el.addEventListener('touchstart', (e) => { e.preventDefault(); fn(); }, { passive: false });
  };
  tap(btnEnter, () => { G.touch.enterPressed = true; });
  const btnBrake = document.getElementById('btn-brake');
  btnBrake.addEventListener('touchstart', (e) => { e.preventDefault(); G.touch.brake = true; }, { passive: false });
  btnBrake.addEventListener('touchend', () => { G.touch.brake = false; });
  btnBrake.addEventListener('click', () => { G.touch.brake = true; setTimeout(() => { G.touch.brake = false; }, 300); });
  // KAM: geser jari di kanan layar = putar kamera (mode drag).
  const btnCam = document.getElementById('btn-cam');
  tap(btnCam, () => { G.touch.camDrag = !G.touch.camDrag; btnCam.classList.toggle('on', G.touch.camDrag); });
  // AKSI: tombol F (taksi/balapan/mancing/foto).
  const btnAct = document.getElementById('btn-act');
  if (btnAct) tap(btnAct, () => { G.touch.actPressed = true; });
  // Geser jari di area kanan layar memutar kamera.
  let camId = null, lastX = 0;
  const cv = document.getElementById('c');
  cv.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) if (t.clientX > innerWidth * 0.45) { camId = t.identifier; lastX = t.clientX; }
  }, { passive: true });
  cv.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) if (t.identifier === camId) { G.camYaw -= (t.clientX - lastX) * 0.008; lastX = t.clientX; }
  }, { passive: true });
  cv.addEventListener('touchend', (e) => { for (const t of e.changedTouches) if (t.identifier === camId) camId = null; });
}
export function updateTouchLabels() {
  const b = document.getElementById('btn-enter');
  if (b) b.textContent = G.car ? 'KELUAR' : 'MASUK';
}
