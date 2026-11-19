export function createInput(canvas) {
  const inp = {
    keys: new Set(),
    pressed: new Set(),
    buttons: new Set(),
    pressedBtn: new Set(),
    mouseDX: 0,
    mouseDY: 0,
    wheel: 0,
    locked: false,
    canvas,
  };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    inp.keys.add(e.code);
    inp.pressed.add(e.code);
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { inp.keys.delete(e.code); });
  window.addEventListener('blur', () => { inp.keys.clear(); inp.buttons.clear(); });
  document.addEventListener('mousemove', (e) => {
    if (!inp.locked) return;
    inp.mouseDX += e.movementX || 0;
    inp.mouseDY += e.movementY || 0;
  });
  document.addEventListener('mousedown', (e) => {
    inp.buttons.add(e.button);
    inp.pressedBtn.add(e.button);
  });
  document.addEventListener('mouseup', (e) => { inp.buttons.delete(e.button); });
  document.addEventListener('wheel', (e) => { inp.wheel += e.deltaY; }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    inp.locked = document.pointerLockElement === canvas;
  });
  return inp;
}

export function isDown(inp, code) { return inp.keys.has(code); }
export function wasPressed(inp, code) { return inp.pressed.has(code); }
export function wasClicked(inp, btn) { return inp.pressedBtn.has(btn); }
export function isMouseDown(inp, btn) { return inp.buttons.has(btn); }

export function consumeMouse(inp) {
  const dx = inp.mouseDX, dy = inp.mouseDY;
  inp.mouseDX = 0; inp.mouseDY = 0;
  return { dx, dy };
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
  try {
    if (!inp.locked && inp.canvas && inp.canvas.requestPointerLock) {
      inp.canvas.requestPointerLock();
    }
  } catch (err) { /* pointer lock unavailable headless; camera still works */ }
}
