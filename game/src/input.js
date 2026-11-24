// Keyboard + mouse input with edge detection (wasPressed) and pointer lock.
export class Input {
  constructor() {
    this.keys = new Set(); this.pressed = new Set();
    this.mouseDX = 0; this.mouseDY = 0; this.mouseDown = false;
    this.mousePressed = false; this.wheel = 0; this.locked = false;
  }
  attach(el) {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code); this.pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    el.addEventListener('mousedown', (e) => {
      this.mouseDown = true; this.mousePressed = true;
      if (e.button === 0 && document.pointerLockElement !== el) {
        try { el.requestPointerLock(); } catch { /* headless */ }
      }
    });
    addEventListener('mouseup', () => { this.mouseDown = false; });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    });
    el.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  down(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  axis() {
    let x = 0, y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    return { x, y };
  }
  endFrame() {
    this.pressed.clear(); this.mouseDX = 0; this.mouseDY = 0;
    this.mousePressed = false; this.wheel = 0;
  }
}
