// SOLARA BAY — keyboard + mouse input with edge detection and pointer
// lock. The game loop reads `pressed` once per frame, then endFrame clears
// the edge sets so a single keypress never fires twice.
export function createInput(canvas) {
  const inp = {
    keys: new Set(), pressed: new Set(),
    buttons: new Set(), pressedBtn: new Set(),
    dx: 0, dy: 0, wheel: 0, locked: false, canvas,
  };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    inp.keys.add(e.code);
    inp.pressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => inp.keys.delete(e.code));
  window.addEventListener('blur', () => { inp.keys.clear(); inp.buttons.clear(); });
  canvas.addEventListener('mousedown', (e) => {
    inp.buttons.add(e.button);
    inp.pressedBtn.add(e.button);
    if (!inp.locked && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
    }
  });
  window.addEventListener('mouseup', (e) => inp.buttons.delete(e.button));
  document.addEventListener('pointerlockchange', () => {
    inp.locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (!inp.locked) return;
    inp.dx += e.movementX || 0;
    inp.dy += e.movementY || 0;
  });
  canvas.addEventListener('wheel', (e) => { inp.wheel += e.deltaY; e.preventDefault(); }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return inp;
}

export function isDown(inp, code) { return inp.keys.has(code); }
export function wasPressed(inp, code) { return inp.pressed.has(code); }
export function wasClicked(inp, btn) { return inp.pressedBtn.has(btn); }
export function isMouseDown(inp, btn) { return inp.buttons.has(btn); }

export function consumeMouse(inp) {
  const out = { dx: inp.dx, dy: inp.dy };
  inp.dx = 0; inp.dy = 0;
  return out;
}

export function consumeWheel(inp) {
  const w = inp.wheel;
  inp.wheel = 0;
  return w;
}

export function endFrame(inp) {
  inp.pressed.clear();
  inp.pressedBtn.clear();
}

export function requestLock(inp) {
  if (document.pointerLockElement !== inp.canvas) inp.canvas.requestPointerLock?.();
}
