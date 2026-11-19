// Suara WebAudio sintetis — tanpa file audio. Mesin, sirene, tembakan,
// klakson balap, cipratan, sorakan, jingle misi, musik loop CELESTE 98.1.
import { RADIO } from './config.js';

export function createAudio() {
  const A = {
    ctx: null, master: null, muted: false, sirenOn: false,
    engineOsc: null, engineGain: null, musicTimer: 0, trackIdx: 0,
    sirenOsc: null, sirenGain: null,
  };
  A.ensure = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      A.ctx = new AC();
      A.master = A.ctx.createGain(); A.master.gain.value = 0.5;
      A.master.connect(A.ctx.destination);
      A.engineOsc = A.ctx.createOscillator(); A.engineOsc.type = 'sawtooth';
      A.engineOsc.frequency.value = 60;
      A.engineGain = A.ctx.createGain(); A.engineGain.gain.value = 0;
      const lp = A.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      A.engineOsc.connect(lp); lp.connect(A.engineGain); A.engineGain.connect(A.master);
      A.engineOsc.start();
      A.sirenOsc = A.ctx.createOscillator(); A.sirenOsc.type = 'sine';
      A.sirenOsc.frequency.value = 700;
      A.sirenGain = A.ctx.createGain(); A.sirenGain.gain.value = 0;
      A.sirenOsc.connect(A.sirenGain); A.sirenGain.connect(A.master);
      A.sirenOsc.start();
      return true;
    } catch (_) { return false; }
  };
  A.tone = function (freq, dur, type, vol, slideTo) {
    if (!A.ensure() || A.muted) return;
    const t = A.ctx.currentTime;
    const o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(A.master); o.start(t); o.stop(t + dur + 0.02);
  };
  A.noise = function (dur, vol, freq) {
    if (!A.ensure() || A.muted) return;
    const t = A.ctx.currentTime, len = Math.floor(A.ctx.sampleRate * dur);
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = A.ctx.createBufferSource(); src.buffer = buf;
    const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
    const g = A.ctx.createGain(); g.gain.value = vol || 0.25;
    src.connect(f); f.connect(g); g.connect(A.master); src.start(t);
  };
  A.shot = function () { A.noise(0.14, 0.4, 900); A.tone(180, 0.08, 'square', 0.15, 60); };
  A.punch = function () { A.noise(0.08, 0.3, 500); };
  A.horn = function () { A.tone(370, 0.35, 'square', 0.18); A.tone(466, 0.35, 'square', 0.12); };
  A.raceHorn = function () { A.tone(620, 0.18, 'square', 0.22); setTimeout(() => A.tone(620, 0.5, 'square', 0.22), 220); };
  A.splash = function () { A.noise(0.5, 0.3, 2400); };
  A.cheer = function () {
    A.tone(523, 0.15, 'triangle', 0.2); A.tone(659, 0.15, 'triangle', 0.2);
    setTimeout(() => A.tone(784, 0.3, 'triangle', 0.22), 140);
  };
  A.jingle = function () {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => A.tone(f, 0.22, 'triangle', 0.2), i * 110));
  };
  A.fail = function () { A.tone(220, 0.4, 'sawtooth', 0.18, 110); };
  A.click = function () { A.tone(800, 0.05, 'square', 0.12); };
  A.setMuted = function (m) { A.muted = m; if (A.master) A.master.gain.value = m ? 0 : 0.5; };
  A.engine = function (speed01, on) {
    if (!A.ctx) return;
    A.engineGain.gain.value = on && !A.muted ? 0.05 + speed01 * 0.09 : 0;
    A.engineOsc.frequency.value = 55 + speed01 * 160;
  };
  A.siren = function (on) {
    if (!A.ctx) return;
    A.sirenOn = on;
    A.sirenGain.gain.value = on && !A.muted ? 0.045 : 0;
  };
  A.update = function (dt, speed01, inCar, wanted) {
    if (!A.ctx) return;
    A.engine(speed01, inCar);
    A.siren(wanted > 0);
    if (A.sirenOn && A.sirenOsc) {
      A.sirenOsc.frequency.value = 650 + Math.sin(performance.now() / 380) * 220;
    }
    A.musicTimer += dt;
    if (A.musicTimer > 25) {
      A.musicTimer = 0;
      A.trackIdx = (A.trackIdx + 1) % RADIO.tracks.length;
      A.tone(392, 0.3, 'triangle', 0.06); A.tone(523, 0.3, 'triangle', 0.05);
    }
  };
  return A;
}
