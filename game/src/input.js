// Keyboard + mouse + pointer lock, dgn edge detection (wasPressed).
export function createInput(canvas) {
  const inp = {
    keys: new Set(), pressed: new Set(), mouseDX: 0, mouseDY: 0,
    wheel: 0, locked: false, canvas,
    clickX: 0, clickY: 0, clicked: false,
  };
  window.addEventListener('keydown', (e) => {
    if (!inp.keys.has(e.code)) inp.pressed.add(e.code);
    inp.keys.add(e.code);
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => inp.keys.delete(e.code));
  window.addEventListener('blur', () => { inp.keys.clear(); });
  document.addEventListener('mousemove', (e) => {
    if (inp.locked) { inp.mouseDX += e.movementX; inp.mouseDY += e.movementY; }
  });
  document.addEventListener('pointerlockchange', () => {
    inp.locked = document.pointerLockElement === canvas;
  });
  canvas.addEventListener('click', (e) => {
    inp.clickX = e.clientX; inp.clickY = e.clientY; inp.clicked = true;
    if (!inp.locked && document.pointerLockElement !== canvas) {
      try { canvas.requestPointerLock(); } catch (_) { /* headless: abaikan */ }
    }
  });
  canvas.addEventListener('wheel', (e) => { inp.wheel += e.deltaY; }, { passive: true });
  return inp;
}
export function isDown(inp, code) { return inp.keys.has(code); }
export function wasPressed(inp, code) { return inp.pressed.has(code); }
export function endFrameInput(inp) {
  inp.pressed.clear(); inp.mouseDX = 0; inp.mouseDY = 0; inp.wheel = 0; inp.clicked = false;
}
