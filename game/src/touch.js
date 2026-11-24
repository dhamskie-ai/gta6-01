// Touch controls: virtual joystick (left) + E / jump / fire / brake buttons.
// Shown on touch devices or with ?touch=1.
export function createTouch(S) {
  if (!S.touchMode) return;
  const touchEl = document.getElementById('touch');
  touchEl.style.display = 'block';
  const stick = document.getElementById('stick');
  const knob = document.getElementById('stickKnob');
  let stickId = null;
  const setKnob = (dx, dy) => {
    knob.style.left = 35 + dx + 'px'; knob.style.top = 35 + dy + 'px';
  };
  stick.addEventListener('touchstart', (e) => { e.preventDefault(); stickId = e.changedTouches[0].identifier; }, { passive: false });
  stick.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== stickId) continue;
      const r = stick.getBoundingClientRect();
      let dx = (t.clientX - (r.left + 60)) / 45, dy = (t.clientY - (r.top + 60)) / 45;
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      S.input.touchVec.x = dx; S.input.touchVec.y = dy;
      setKnob(dx * 35, dy * 35);
    }
  }, { passive: false });
  const endStick = (e) => {
    for (const t of e.changedTouches) if (t.identifier === stickId) { stickId = null; S.input.touchVec.x = 0; S.input.touchVec.y = 0; setKnob(0, 0); }
  };
  stick.addEventListener('touchend', endStick);
  stick.addEventListener('touchcancel', endStick);
  const bind = (id, key) => {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', (e) => { e.preventDefault(); S.input.touch[key] = true; S.audio.ensure(); }, { passive: false });
    el.addEventListener('touchend', (e) => { e.preventDefault(); S.input.touch[key] = key === 'fire' ? false : S.input.touch[key]; }, { passive: false });
  };
  bind('btnE', 'e'); bind('btnJump', 'jump'); bind('btnFire', 'fire'); bind('btnBrake', 'brake');
  // Fire button held state.
  const fire = document.getElementById('btnFire');
  fire.addEventListener('touchstart', () => { S.input.firing = true; });
  fire.addEventListener('touchend', () => { S.input.firing = false; });
}
