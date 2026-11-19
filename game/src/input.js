// Keyboard + mouse input: held keys, pressed-this-frame edges,
// pointer-lock look deltas, wheel zoom, click edges.
export function createInput(canvas) {
  const input = {
    keys: new Set(), pressed: new Set(), mouseDX: 0, mouseDY: 0,
    mouseDown: false, mouseClicked: false, locked: false, wheel: 0,
  };
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
  });
  addEventListener('keyup', (e) => input.keys.delete(e.code));
  addEventListener('blur', () => {
    input.keys.clear();
    input.pressed.clear();
  });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      input.mouseDX += e.movementX;
      input.mouseDY += e.movementY;
    }
  });
  canvas.addEventListener('mousedown', (e) => {
    input.mouseDown = true;
    input.mouseClicked = true;
    if (e.button === 0 && document.pointerLockElement !== canvas) {
      try {
        const r = canvas.requestPointerLock?.();
        r?.catch?.(() => {});
      } catch { /* headless: no pointer lock */ }
    }
  });
  addEventListener('mouseup', () => { input.mouseDown = false; });
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
  });
  canvas.addEventListener('wheel', (e) => { input.wheel += e.deltaY; }, { passive: true });
  input.down = (code) => input.keys.has(code);
  input.wasPressed = (code) => input.pressed.has(code);
  input.consumeMouse = () => {
    const dx = input.mouseDX, dy = input.mouseDY;
    input.mouseDX = 0;
    input.mouseDY = 0;
    return { dx, dy };
  };
  input.endFrame = () => {
    input.pressed.clear();
    input.mouseClicked = false;
    input.wheel = 0;
  };
  return input;
}
