// Keyboard + mouse input with edge detection and pointer lock.
export function initInput(G) {
  G.keys = {};
  G.pressed = {};
  G.mouseDX = 0; G.mouseDY = 0;
  G.locked = false;
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    G.keys[e.code] = true; G.pressed[e.code] = true;
    if (e.code === 'Escape' && G.phase === 'play') G.pauseGame();
    if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => { G.keys[e.code] = false; });
  addEventListener('blur', () => { G.keys = {}; });
  G.canvas.addEventListener('click', () => {
    if (G.phase === 'play' && !G.locked && !G.touchMode) G.canvas.requestPointerLock();
  });
  document.addEventListener('pointerlockchange', () => {
    G.locked = document.pointerLockElement === G.canvas;
  });
  addEventListener('mousemove', (e) => {
    if (G.locked) { G.mouseDX += e.movementX; G.mouseDY += e.movementY; }
  });
  G.canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) G.pressed.Mouse0 = true;
  });
  addEventListener('contextmenu', (e) => e.preventDefault());
}
export function endFrameInput(G) {
  G.pressed = {}; G.mouseDX = 0; G.mouseDY = 0;
}
export function keyDown(G, code) { return !!G.keys[code]; }
export function keyPressed(G, code) { return !!G.pressed[code]; }
