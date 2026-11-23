// WebAudio synth — no audio files. Engine hum follows speed, siren wails
// while wanted, plus shots, horn, splash, cheer and a lazy chord loop.
export function createAudio() {
  return {
    ctx: null, master: null, engine: null, engineGain: null, siren: null,
    sirenGain: null, musicTimer: 0, musicStep: 0, muted: false, started: false,
  };
}
export function ensureAudio(A) {
  if (A.started) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    A.ctx = new Ctx();
    A.master = A.ctx.createGain(); A.master.gain.value = 0.35;
    A.master.connect(A.ctx.destination);
    A.engine = A.ctx.createOscillator(); A.engine.type = 'sawtooth';
    A.engine.frequency.value = 60;
    A.engineGain = A.ctx.createGain(); A.engineGain.gain.value = 0;
    const lp = A.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    A.engine.connect(lp); lp.connect(A.engineGain); A.engineGain.connect(A.master);
    A.engine.start();
    A.siren = A.ctx.createOscillator(); A.siren.type = 'triangle';
    A.siren.frequency.value = 700;
    A.sirenGain = A.ctx.createGain(); A.sirenGain.gain.value = 0;
    A.siren.connect(A.sirenGain); A.sirenGain.connect(A.master);
    A.siren.start();
    A.started = true;
  } catch { /* audio unavailable — game stays silent */ }
}
export function setMuted(A, m) {
  A.muted = m;
  if (A.master) A.master.gain.value = m ? 0 : 0.35;
}
function blip(A, freq, dur, type, vol, slideTo) {
  if (!A.ctx || A.muted) return;
  try {
    const o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, A.ctx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.2, A.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, A.ctx.currentTime + dur);
    o.connect(g); g.connect(A.master); o.start(); o.stop(A.ctx.currentTime + dur);
  } catch { /* ignore */ }
}
export function sfxShot(A) { blip(A, 900, 0.12, 'square', 0.25, 120); }
export function sfxPunch(A) { blip(A, 160, 0.1, 'sine', 0.3, 60); }
export function sfxHorn(A) { blip(A, 440, 0.35, 'sawtooth', 0.18, 415); blip(A, 554, 0.35, 'sawtooth', 0.12); }
export function sfxSplash(A) { blip(A, 300, 0.4, 'sine', 0.2, 90); }
export function sfxCheer(A) { blip(A, 660, 0.25, 'triangle', 0.2, 990); blip(A, 880, 0.3, 'triangle', 0.15, 1320); }
export function sfxCoin(A) { blip(A, 990, 0.12, 'sine', 0.2, 1480); }
export function sfxMission(A) {
  blip(A, 523, 0.15, 'triangle', 0.22); setTimeout(() => blip(A, 659, 0.15, 'triangle', 0.22), 140);
  setTimeout(() => blip(A, 784, 0.3, 'triangle', 0.22), 280);
}
export function sfxClick(A) { blip(A, 700, 0.06, 'sine', 0.15); }
export function updateAudio(A, G, dt) {
  if (!A.ctx || A.muted) return;
  const car = G.player.car;
  const speed = car && typeof car.speed === 'number' ? Math.abs(car.speed) : 0;
  if (A.engine) {
    A.engine.frequency.value = 55 + speed * 3.2;
    A.engineGain.gain.value = car ? 0.05 + Math.min(0.09, speed * 0.002) : 0.015;
  }
  if (A.siren) {
    const t = G.t || 0;
    A.siren.frequency.value = G.wanted > 0 ? (Math.sin(t * 4) > 0 ? 820 : 620) : 700;
    A.sirenGain.gain.value = G.wanted > 0 ? 0.045 : 0;
  }
  // Lazy A-minor chord loop: one soft note every 0.5 s, cycling a progression.
  A.musicTimer += dt;
  if (A.musicTimer > 0.5) {
    A.musicTimer = 0;
    const prog = [220, 261.6, 329.6, 196, 220, 261.6, 349.2, 293.7];
    const f = prog[A.musicStep % prog.length]; A.musicStep++;
    blip(A, f, 0.5, 'sine', 0.05);
  }
}
