// Keyboard + mouse input with pointer lock and edge-triggered presses.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.wheel = 0;
    this.locked = false;
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressedKeys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    });
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.mouseClicked = true; }
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    document.addEventListener('wheel', (e) => { this.wheel += e.deltaY; }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
  }
  lockPointer() { if (!this.locked) this.canvas.requestPointerLock?.(); }
  unlockPointer() { if (this.locked) document.exitPointerLock?.(); }
  down(code) { return this.keys.has(code); }
  pressed(code) { return this.pressedKeys.has(code); }
  axis() {
    let x = 0, z = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) z -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) z += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    return { x, z };
  }
  endFrame() {
    this.pressedKeys.clear();
    this.mouseDX = 0; this.mouseDY = 0;
    this.mouseClicked = false; this.wheel = 0;
  }
}
