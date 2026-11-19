// Keyboard + mouse + pointer lock. Touch (touch.js) writes into the same
// Input.touch object, so gameplay reads one input source either way.
import { G } from './config.js';

export const keys = {};
export const pressed = {}; // edge-triggered: true only on the frame of keydown
export const mouse = { dx: 0, dy: 0, down: false, locked: false };
export const touch = {
  active: false, moveX: 0, moveY: 0, // joystick -1..1
  enter: false, brake: false, cam: false, camDX: 0, camDY: 0,
  shoot: false, action: false,
};

export function initInput(canvas) {
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true; pressed[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  canvas.addEventListener('click', () => {
    if (G.phase === 'play' && !G.touchMode && !mouse.locked) canvas.requestPointerLock?.();
  });
  document.addEventListener('pointerlockchange', () => {
    mouse.locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (!mouse.locked) return;
    mouse.dx += e.movementX; mouse.dy += e.movementY;
  });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) mouse.down = true; });
  addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  addEventListener('wheel', (e) => {
    G.camDist = Math.max(5, Math.min(16, G.camDist + (e.deltaY > 0 ? 1 : -1)));
  }, { passive: true });
}

export function endFrame() {
  for (const k in pressed) pressed[k] = false;
  mouse.dx = 0; mouse.dy = 0;
  touch.camDX = 0; touch.camDY = 0;
  touch.enter = false; touch.action = false;
}

export function axis() {
  // -1..1 forward/strafe from keys or touch joystick.
  let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  let s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  if (touch.active) { f += -touch.moveY; s += touch.moveX; }
  return { f: Math.max(-1, Math.min(1, f)), s: Math.max(-1, Math.min(1, s)) };
}
