// Keyboard + mouse input with edge detection and pointer lock.
export function createInput(canvas) {
  const keys = new Set();
  const just = new Set();
  let lookX = 0, lookY = 0, locked = false, wheel = 0;
  addEventListener('keydown', (e) => {
    if (!keys.has(e.code)) just.add(e.code);
    keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  document.addEventListener('mousemove', (e) => {
    if (locked) { lookX += e.movementX; lookY += e.movementY; }
  });
  document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; });
  canvas.addEventListener('click', () => { if (!locked) canvas.requestPointerLock?.(); });
  addEventListener('wheel', (e) => { wheel += e.deltaY; }, { passive: true });
  return {
    keys, locked: () => locked,
    down: (c) => keys.has(c),
    pressed: (c) => just.has(c),
    axis: () => ({ x: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), y: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0) }),
    look: () => { const v = { x: lookX, y: lookY }; lookX = 0; lookY = 0; return v; },
    wheelDelta: () => { const w = wheel; wheel = 0; return w; },
    endFrame: () => just.clear(),
  };
}
