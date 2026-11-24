// Keyboard + mouse + touch input, with edge detection (wasPressed).
export function createInput(canvas) {
  const input = {
    keys: new Set(), pressed: new Set(), mouseDX: 0, mouseDY: 0,
    lookYaw: 0, lookPitch: 0, locked: false, firing: false,
    touchVec: { x: 0, y: 0 }, touch: { e: false, jump: false, fire: false, brake: false },
    down(code) { return this.keys.has(code); },
    wasPressed(code) { return this.pressed.has(code); },
    endFrame() { this.pressed.clear(); this.mouseDX = 0; this.mouseDY = 0; this.touch.e = false; this.touch.jump = false; this.touch.fire = false; },
  };
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input.keys.add(e.code); input.pressed.add(e.code);
    if (e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', (e) => input.keys.delete(e.code));
  addEventListener('blur', () => input.keys.clear());
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.firing = true;
    if (!input.locked && document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) input.firing = false; });
  document.addEventListener('pointerlockchange', () => { input.locked = document.pointerLockElement === canvas; });
  addEventListener('mousemove', (e) => {
    if (!input.locked) return;
    input.mouseDX += e.movementX; input.mouseDY += e.movementY;
    input.lookYaw -= e.movementX * 0.0028;
    input.lookPitch = Math.max(-0.9, Math.min(0.6, input.lookPitch - e.movementY * 0.0028));
  });
  addEventListener('contextmenu', (e) => { if (e.target === canvas) e.preventDefault(); });
  return input;
}
