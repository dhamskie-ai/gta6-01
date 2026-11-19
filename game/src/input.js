// Keyboard + mouse drag. Edge-trigger via pressed set (konsumsi sekali).
import { G } from './config.js';
const pressed = new Set();
export function initInput() {
  addEventListener('keydown', (e) => {
    if (e.code === 'Tab') e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    G.keys[e.code] = true;
    if (e.code === 'KeyM') G.muted = !G.muted;
  });
  addEventListener('keyup', (e) => { G.keys[e.code] = false; });
  addEventListener('blur', () => { G.keys = {}; });
  let dragging = false, lx = 0;
  const cv = document.getElementById('c');
  cv.addEventListener('pointerdown', (e) => { dragging = true; lx = e.clientX; });
  addEventListener('pointermove', (e) => {
    if (!dragging) return;
    G.camYaw -= (e.clientX - lx) * 0.005; lx = e.clientX;
  });
  addEventListener('pointerup', () => { dragging = false; });
  addEventListener('wheel', (e) => { G.camDist = Math.max(5, Math.min(16, G.camDist + Math.sign(e.deltaY))); }, { passive: true });
}
export function wasPressed(code) { if (pressed.has(code)) { pressed.delete(code); return true; } return false; }
export function clearPressed() { pressed.clear(); }
export function axis() {
  let f = 0, s = 0;
  if (G.keys.KeyW || G.keys.ArrowUp) f += 1;
  if (G.keys.KeyS || G.keys.ArrowDown) f -= 1;
  if (G.keys.KeyA || G.keys.ArrowLeft) s -= 1;
  if (G.keys.KeyD || G.keys.ArrowRight) s += 1;
  if (G.touch.active) { f += -G.touch.joyY; s += G.touch.joyX; }
  return { f: Math.max(-1, Math.min(1, f)), s: Math.max(-1, Math.min(1, s)) };
}
