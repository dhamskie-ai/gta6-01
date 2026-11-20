// WebAudio synth: engine, ambience, siren, radio pad, sfx. No audio files.
import * as THREE from 'three';
export function initAudio(G) {
  G.muted = false;
  G.audio = { ctx: null, eng: null, engGain: null, siren: null, sirenGain: null, pad: null, track: 0, trackT: 0 };
  const start = () => {
    if (G.audio.ctx) { if (G.audio.ctx.state === 'suspended') G.audio.ctx.resume(); return; }
    try {
      const C = new (window.AudioContext || window.webkitAudioContext)();
      const A = G.audio; A.ctx = C;
      A.eng = C.createOscillator(); A.eng.type = 'sawtooth'; A.eng.frequency.value = 55;
      const sq = C.createOscillator(); sq.type = 'square'; sq.frequency.value = 28;
      const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      A.engGain = C.createGain(); A.engGain.gain.value = 0;
      A.eng.connect(lp); sq.connect(lp); lp.connect(A.engGain); A.engGain.connect(C.destination);
      A.eng.start(); sq.start();
      const nb = C.createBuffer(1, C.sampleRate * 2, C.sampleRate);
      const d = nb.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const ns = C.createBufferSource(); ns.buffer = nb; ns.loop = true;
      const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 320;
      const ng = C.createGain(); ng.gain.value = 0.05;
      ns.connect(bp); bp.connect(ng); ng.connect(C.destination); ns.start();
      A.siren = C.createOscillator(); A.siren.type = 'triangle'; A.siren.frequency.value = 720;
      A.sirenGain = C.createGain(); A.sirenGain.gain.value = 0;
      A.siren.connect(A.sirenGain); A.sirenGain.connect(C.destination); A.siren.start();
      A.pad = C.createGain(); A.pad.gain.value = 0.05; A.pad.connect(C.destination);
    } catch { /* audio unavailable */ }
  };
  G.startAudio = start;
  addEventListener('pointerdown', start, { once: true });
  addEventListener('keydown', start, { once: true });
}
function tone(G, freq, dur, type, vol, slideTo) {
  const A = G.audio; if (!A || !A.ctx || G.muted) return;
  const C = A.ctx, o = C.createOscillator(), g = C.createGain();
  o.type = type || 'square'; o.frequency.value = freq;
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, C.currentTime + dur);
  g.gain.setValueAtTime(vol || 0.15, C.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, C.currentTime + dur);
  o.connect(g); g.connect(C.destination); o.start(); o.stop(C.currentTime + dur);
}
export function sfx(G, name) {
  if (!G.audio || !G.audio.ctx || G.muted) return;
  const seq = (notes, step, type, vol) => notes.forEach((n, i) =>
    setTimeout(() => tone(G, n, 0.16, type, vol), i * step));
  if (name === 'horn') { tone(G, 370, 0.25, 'square', 0.2); tone(G, 466, 0.25, 'square', 0.2); }
  else if (name === 'shot') tone(G, 900, 0.08, 'square', 0.25, 120);
  else if (name === 'punch') tone(G, 160, 0.08, 'square', 0.25, 60);
  else if (name === 'click') tone(G, 1200, 0.04, 'square', 0.1);
  else if (name === 'splash') tone(G, 500, 0.3, 'sine', 0.15, 150);
  else if (name === 'camera') { tone(G, 2000, 0.05, 'square', 0.12); setTimeout(() => tone(G, 1500, 0.06, 'square', 0.12), 60); }
  else if (name === 'coin') { tone(G, 988, 0.09, 'sine', 0.2); setTimeout(() => tone(G, 1319, 0.18, 'sine', 0.2), 90); }
  else if (name === 'jingle') seq([523, 659, 784, 1047], 110, 'sine', 0.2);
  else if (name === 'fail') seq([392, 330, 262], 160, 'sine', 0.2);
  else if (name === 'gull') tone(G, 1400, 0.25, 'sine', 0.06, 900);
  else if (name === 'skid') tone(G, 300, 0.2, 'sawtooth', 0.08, 180);
}
export function updateAudio(G, dt) {
  const A = G.audio; if (!A || !A.ctx || G.muted) return;
  const car = G.player.car;
  const speed = car && typeof car.speed === 'number' ? Math.abs(car.speed) : 0;
  if (A.engGain) A.engGain.gain.value = car ? 0.03 + Math.min(0.09, speed * 0.002) : 0;
  if (A.eng) A.eng.frequency.value = 55 + speed * 2.2;
  if (A.sirenGain) A.sirenGain.gain.value = G.wanted >= 2 ? 0.05 : 0;
  if (A.siren && G.wanted >= 2) A.siren.frequency.value = 680 + 160 * Math.sin(G.elapsed * 2.2);
  // Radio pad: A-minor roots cycle every 2.2 s.
  A.trackT += dt;
  if (A.trackT > 2.2) {
    A.trackT = 0; A.track = (A.track + 1) % 4;
    const roots = [110, 87.3, 98, 82.4];
    const C = A.ctx;
    [roots[A.track], roots[A.track] * 1.5, roots[A.track] * 2].forEach((f) => {
      const o = C.createOscillator(), g = C.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.03, C.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, C.currentTime + 2.4);
      o.connect(g); g.connect(A.pad); o.start(); o.stop(C.currentTime + 2.4);
    });
  }
}
export function toggleMute(G) {
  G.muted = !G.muted;
  if (G.audio && G.audio.ctx) {
    if (G.audio.engGain) G.audio.engGain.gain.value = 0;
    if (G.audio.sirenGain) G.audio.sirenGain.gain.value = 0;
  }
}
