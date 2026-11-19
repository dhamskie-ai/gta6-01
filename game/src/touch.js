// Kontrol sentuh HP (baru ronde 6g): virtual joystick + tombol aksi +
// geser jari untuk kamera. HANYA muncul di perangkat sentuh (deteksi
// ontouchstart / pointer coarse, atau ?touch=1 untuk tes). Desktop tetap
// keyboard + mouse — file ini tidak mengubah kontrol yang sudah ada.
export function createTouch(W) {
  const input = W.input;
  const force = new URLSearchParams(location.search).has('touch');
  const isTouch = input.isTouchDevice || force;
  if (!isTouch) return { active: false };
  const app = document.getElementById('app');
  const ui = document.createElement('div');
  ui.id = 'touch-ui';
  ui.innerHTML = '<div id="joy-base"><div id="joy-knob"></div></div>'
    + '<div id="touch-btns">'
    + '<button class="tbtn" id="btn-enter">MASUK</button>'
    + '<button class="tbtn" id="btn-brake">REM</button>'
    + '<button class="tbtn small" id="btn-cam">KAM</button>'
    + '</div><div id="touch-hint">Joystick: gerak &amp; nyetir · Geser layar: kamera</div>';
  app.appendChild(ui);
  ui.style.display = 'block';

  // --- Virtual joystick (kiri bawah): jalan kaki + nyetir ---
  const base = ui.querySelector('#joy-base');
  const knob = ui.querySelector('#joy-knob');
  const R = 44;
  let joyId = null;
  function joyMove(e) {
    const r = base.getBoundingClientRect();
    let dx = e.clientX - (r.x + r.width / 2);
    let dy = e.clientY - (r.y + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
    input.joyX = dx / R;
    input.joyY = dy / R;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  function joyEnd(e) {
    if (e.pointerId !== joyId) return;
    joyId = null;
    input.joyX = 0; input.joyY = 0;
    knob.style.transform = 'translate(0px, 0px)';
  }
  base.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    joyId = e.pointerId;
    try { base.setPointerCapture(e.pointerId); } catch { /* abaikan */ }
    joyMove(e);
  });
  base.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) joyMove(e); });
  base.addEventListener('pointerup', joyEnd);
  base.addEventListener('pointercancel', joyEnd);

  // --- Tombol aksi (kanan bawah) ---
  function wireBtn(id, down, up) {
    const el = ui.querySelector(id);
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      el.classList.add('pressed');
      down();
    });
    const release = (e) => {
      el.classList.remove('pressed');
      if (up) up();
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
  }
  wireBtn('#btn-enter', () => { input.touchEnter = true; }, null);
  wireBtn('#btn-brake', () => { input.touchBrake = true; }, () => { input.touchBrake = false; });
  wireBtn('#btn-cam', () => { input.touchCam = true; }, null);

  // --- Geser jari di layar (bukan di kontrol) = putar kamera ---
  const canvas = W.renderer.domElement;
  let camId = null, lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (camId !== null) return;
    camId = e.pointerId; lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== camId) return;
    input.lookDX += (e.clientX - lastX) * 2.4;
    input.lookDY += (e.clientY - lastY) * 2.4;
    lastX = e.clientX; lastY = e.clientY;
  });
  const camEnd = (e) => { if (e.pointerId === camId) camId = null; };
  canvas.addEventListener('pointerup', camEnd);
  canvas.addEventListener('pointercancel', camEnd);
  const enterBtn = ui.querySelector('#btn-enter');
  return {
    active: true,
    // Label tombol ikut status: MASUK saat jalan kaki, KELUAR saat nyetir.
    setEnterLabel(driving) { enterBtn.textContent = driving ? 'KELUAR' : 'MASUK'; },
  };
}
