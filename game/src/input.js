// Keyboard + mouse input with edge detection (pressed-this-frame) and
// pointer lock for the third-person camera.
export function createInput() {
  return {
    keys: {}, pressed: {}, mouseDX: 0, mouseDY: 0, locked: false,
    wheel: 0, touch: false,
  };
}
export function bindInput(input, canvas, onLockChange) {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input.keys[e.code] = true; input.pressed[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });
  window.addEventListener('blur', () => { input.keys = {}; });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      input.mouseDX += e.movementX || 0; input.mouseDY += e.movementY || 0;
    }
  });
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
    if (onLockChange) onLockChange(input.locked);
  });
  canvas.addEventListener('click', () => {
    if (!input.locked && !input.touch) canvas.requestPointerLock?.();
  });
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.pressed.Mouse0 = true;
  });
  window.addEventListener('wheel', (e) => { input.wheel += e.deltaY; }, { passive: true });
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) input.touch = true;
}
export function isDown(input, code) { return !!input.keys[code]; }
export function wasPressed(input, code) { return !!input.pressed[code]; }
export function endFrameInput(input) {
  input.pressed = {}; input.mouseDX = 0; input.mouseDY = 0; input.wheel = 0;
}
export function axis(input, neg, pos) {
  return (isDown(input, pos) ? 1 : 0) - (isDown(input, neg) ? 1 : 0);
}
