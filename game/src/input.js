// Input keyboard + mouse + jembatan sentuh. Touch.js menulis joyX/joyY,
// lookDX/lookDY, dan flag tombol ke objek ini; game membaca lewat
// action()/axis() tanpa peduli sumbernya. Desktop tetap keyboard+mouse.
export function createInput(canvas) {
  const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0
    || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
  const inp = {
    keys: new Set(), pressed: new Set(),
    mouseDX: 0, mouseDY: 0, mouseDown: false,
    joyX: 0, joyY: 0, lookDX: 0, lookDY: 0,
    touchEnter: false, touchBrake: false, touchCam: false,
    locked: false, isTouchDevice,
    attach() {
      window.addEventListener('keydown', (e) => {
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
        if (!e.repeat) inp.pressed.add(e.code);
        inp.keys.add(e.code);
      });
      window.addEventListener('keyup', (e) => inp.keys.delete(e.code));
      window.addEventListener('blur', () => inp.keys.clear());
      document.addEventListener('mousemove', (e) => {
        if (inp.locked) { inp.mouseDX += e.movementX || 0; inp.mouseDY += e.movementY || 0; }
      });
      document.addEventListener('mousedown', (e) => { if (e.target === canvas) inp.mouseDown = true; });
      window.addEventListener('mouseup', () => { inp.mouseDown = false; });
      document.addEventListener('pointerlockchange', () => {
        inp.locked = document.pointerLockElement === canvas;
      });
      canvas.addEventListener('click', () => {
        if (!inp.isTouchDevice && !inp.locked) {
          try { canvas.requestPointerLock(); } catch { /* abaikan */ }
        }
      });
    },
    lock() {
      if (!inp.isTouchDevice && !inp.locked) {
        try { canvas.requestPointerLock(); } catch { /* abaikan */ }
      }
    },
    down(code) { return inp.keys.has(code); },
    // Aksi edge-trigger: sekali per tekan. Flag sentuh ikut dibersihkan.
    action(name) {
      const p = inp.pressed;
      switch (name) {
        case 'enter': if (p.has('KeyE') || inp.touchEnter) { inp.touchEnter = false; return true; } break;
        case 'camera': if (p.has('KeyC') || inp.touchCam) { inp.touchCam = false; return true; } break;
        case 'jump': return p.has('Space');
        case 'horn': return p.has('KeyH');
        case 'mute': return p.has('KeyM');
        case 'pause': return p.has('Escape');
        case 'reload': return p.has('KeyR');
        case 'sprint': return inp.down('ShiftLeft') || inp.down('ShiftRight');
        case 'handbrake': return inp.down('ShiftLeft') || inp.down('ShiftRight');
        default: break;
      }
      return false;
    },
    weaponSlot() {
      for (let i = 1; i <= 5; i++) if (inp.pressed.has('Digit' + i)) return i - 1;
      return -1;
    },
    // Sumbu gerak -1..1. y = maju (+1), x = kanan (+1).
    moveAxis() {
      let y = 0, x = 0;
      if (inp.down('KeyW') || inp.down('ArrowUp')) y += 1;
      if (inp.down('KeyS') || inp.down('ArrowDown')) y -= 1;
      if (inp.down('KeyD') || inp.down('ArrowRight')) x += 1;
      if (inp.down('KeyA') || inp.down('ArrowLeft')) x -= 1;
      y += -inp.joyY; x += inp.joyX;
      return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    },
    brake() { return inp.down('KeyS') || inp.down('ArrowDown') || inp.touchBrake; },
    lookDelta() {
      const dx = inp.mouseDX + inp.lookDX, dy = inp.mouseDY + inp.lookDY;
      inp.mouseDX = 0; inp.mouseDY = 0; inp.lookDX = 0; inp.lookDY = 0;
      return { dx, dy };
    },
    endFrame() { inp.pressed.clear(); },
  };
  return inp;
}
