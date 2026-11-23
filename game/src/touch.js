// Touch controls for phones: virtual joystick (bottom-left), action
// buttons (bottom-right). Shown only on touch devices or ?touch=1.
export function initTouch(G) {
  G.touch = { moveX: 0, moveY: 0, throttle: 0, steer: 0, brake: false,
    camDX: 0, shoot: false, action: false, active: false };
  const params = new URLSearchParams(location.search);
  const forceTouch = params.get('touch') === '1';
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || forceTouch;
  if (!isTouch) return;
  G.touch.active = true;
  const wrap = document.getElementById('touch-controls');
  if (wrap) wrap.classList.remove('hidden');
  const joy = document.getElementById('joy-base');
  const knob = document.getElementById('joy-knob');
  if (joy && knob) {
    let joyId = null;
    const setKnob = (dx, dy) => {
      const r = 48;
      const len = Math.hypot(dx, dy);
      const cl = len > r ? r / len : 1;
      knob.style.transform = `translate(${dx * cl}px, ${dy * cl}px)`;
      G.touch.moveX = (dx * cl) / r;
      G.touch.moveY = -(dy * cl) / r;
      G.touch.throttle = G.touch.moveY;
      G.touch.steer = G.touch.moveX;
    };
    joy.addEventListener('pointerdown', (e) => {
      joyId = e.pointerId;
      joy.setPointerCapture(e.pointerId);
      const rect = joy.getBoundingClientRect();
      setKnob(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2));
    });
    joy.addEventListener('pointermove', (e) => {
      if (e.pointerId !== joyId) return;
      const rect = joy.getBoundingClientRect();
      setKnob(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2));
    });
    const endJoy = (e) => {
      if (e.pointerId !== joyId) return;
      joyId = null;
      knob.style.transform = 'translate(0px, 0px)';
      G.touch.moveX = 0; G.touch.moveY = 0; G.touch.throttle = 0; G.touch.steer = 0;
    };
    joy.addEventListener('pointerup', endJoy);
    joy.addEventListener('pointercancel', endJoy);
  }
  // camera drag anywhere on the screen (not on controls)
  let camId = null, lastX = 0;
  const canvas = document.getElementById('game-canvas');
  if (canvas) {
    canvas.addEventListener('pointerdown', (e) => {
      if (e.target !== canvas) return;
      camId = e.pointerId; lastX = e.clientX;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== camId) return;
      G.touch.camDX = e.clientX - lastX;
      lastX = e.clientX;
    });
    const endCam = (e) => { if (e.pointerId === camId) { camId = null; G.touch.camDX = 0; } };
    canvas.addEventListener('pointerup', endCam);
    canvas.addEventListener('pointercancel', endCam);
  }
  const bindHold = (id, on, off) => {
    const b = document.getElementById(id);
    if (!b) return;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); on(); });
    b.addEventListener('pointerup', () => off && off());
    b.addEventListener('pointercancel', () => off && off());
  };
  bindHold('btn-enter', () => { G.touch.action = true; });
  bindHold('btn-brake', () => { G.touch.brake = true; }, () => { G.touch.brake = false; });
  bindHold('btn-shoot', () => { G.touch.shoot = true; }, () => { G.touch.shoot = false; });
  bindHold('btn-cam', () => { G.camDist = G.camDist > 12 ? 9 : G.camDist + 3; });
  bindHold('btn-action', () => { G.touch.action = true; });
}
export function updateTouchLabels(G) {
  const b = document.getElementById('btn-enter');
  if (!b) return;
  b.textContent = G.player.car ? 'KELUAR' : 'MASUK';
}
