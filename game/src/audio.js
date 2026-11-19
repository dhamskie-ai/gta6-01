// Suara sintetis WebAudio — tanpa file audio. Mesin mengikuti kecepatan.
import { G } from './config.js';
let ctx = null, master = null, engOsc = null, engOsc2 = null, engGain = null, engFilter = null;
let ambGain = null, musicGain = null, sirenOsc = null, sirenGain = null, skidSrc = null, skidGain = null;
export const audioState = { engineOn: false, engineFreq: 0, engineGain: 0, muted: false, ambientOn: false, ctx: false };
function noiseBuf() {
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
export function initAudio() {
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    engOsc = ctx.createOscillator(); engOsc.type = 'sawtooth'; engOsc.frequency.value = 55;
    engOsc2 = ctx.createOscillator(); engOsc2.type = 'square'; engOsc2.frequency.value = 28;
    engFilter = ctx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 700;
    engGain = ctx.createGain(); engGain.gain.value = 0;
    engOsc.connect(engFilter); engOsc2.connect(engFilter); engFilter.connect(engGain); engGain.connect(master);
    engOsc.start(); engOsc2.start();
    const amb = ctx.createBufferSource(); amb.buffer = noiseBuf(); amb.loop = true;
    const af = ctx.createBiquadFilter(); af.type = 'lowpass'; af.frequency.value = 320;
    ambGain = ctx.createGain(); ambGain.gain.value = 0.05;
    amb.connect(af); af.connect(ambGain); ambGain.connect(master); amb.start();
    sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine'; sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
    skidSrc = ctx.createBufferSource(); skidSrc.buffer = noiseBuf(); skidSrc.loop = true;
    const sf = ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 900; sf.Q.value = 2;
    skidGain = ctx.createGain(); skidGain.gain.value = 0;
    skidSrc.connect(sf); sf.connect(skidGain); skidGain.connect(master); skidSrc.start();
    musicGain = ctx.createGain(); musicGain.gain.value = 0.05; musicGain.connect(master);
    startMusic();
    audioState.ctx = true; audioState.ambientOn = true;
  } catch (e) { ctx = null; }
  addEventListener('pointerdown', resumeAudio, { once: false });
  addEventListener('keydown', resumeAudio, { once: false });
}
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); }
function startMusic() {
  // Pad chord A-minor bergilir, nada rendah, loop pelan.
  const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 220, 261.6]];
  let i = 0;
  const play = () => {
    if (!ctx) return;
    const ch = chords[i % chords.length]; i++;
    for (const f of ch) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.2);
      g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 7.5);
      o.connect(g); g.connect(musicGain); o.start(); o.stop(ctx.currentTime + 7.6);
    }
    setTimeout(play, 8000);
  };
  play();
}
export function updateAudio(dt) {
  if (!ctx) return;
  if (master) master.gain.value = G.muted ? 0 : 0.5;
  audioState.muted = G.muted;
  const speed = G.car ? Math.abs(G.car.speed) : 0;
  const top = G.car ? G.car.top : 1;
  const ratio = Math.min(1, speed / top);
  const driving = !!G.car;
  const rpm = 42 + ratio * 165 + (driving ? 8 : 0);
  if (engOsc) {
    engOsc.frequency.setTargetAtTime(rpm, ctx.currentTime, 0.06);
    engOsc2.frequency.setTargetAtTime(rpm * 0.5, ctx.currentTime, 0.06);
    engFilter.frequency.setTargetAtTime(500 + ratio * 2600, ctx.currentTime, 0.1);
  }
  const target = driving ? 0.05 + ratio * 0.075 : 0.012;
  if (engGain) engGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
  audioState.engineOn = driving && !G.muted;
  audioState.engineFreq = Math.round(rpm);
  audioState.engineGain = +target.toFixed(3);
  if (ambGain) ambGain.gain.setTargetAtTime(0.03 + G.nightF * 0.01 + Math.min(0.03, G.traffic.length * 0.001), ctx.currentTime, 0.5);
  if (sirenGain) sirenGain.gain.setTargetAtTime(G.wanted >= 2 ? 0.028 : 0, ctx.currentTime, 0.3);
  if (sirenOsc && G.wanted >= 2) sirenOsc.frequency.setTargetAtTime(650 + 250 * Math.sin(G.time * 2.4), ctx.currentTime, 0.05);
  const skidding = !!(G.car && G.keys.ShiftLeft && Math.abs(G.car.speed) > 8);
  if (skidGain) skidGain.gain.setTargetAtTime(skidding ? 0.06 : 0, ctx.currentTime, 0.08);
  audioState.skidding = skidding;
  // Kicau burung acak di siang hari.
  if (ctx && G.timeOfDay > 6 && G.timeOfDay < 18 && Math.random() < dt * 0.25) chirp();
}
function chirp() {
  const o = ctx.createOscillator(); o.type = 'sine';
  const f0 = 2400 + Math.random() * 1200;
  o.frequency.setValueAtTime(f0, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(f0 * 1.4, ctx.currentTime + 0.12);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
  o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + 0.32);
}
export function playHorn() {
  if (!ctx || G.muted) return;
  const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 370;
  const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 466;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.12, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
  o.connect(g); o2.connect(g); g.connect(master); o.start(); o2.start(); o.stop(ctx.currentTime + 0.5); o2.stop(ctx.currentTime + 0.5);
}
export function playShot() {
  if (!ctx || G.muted) return;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf();
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.25, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
  s.connect(f); f.connect(g); g.connect(master); s.start(); s.stop(ctx.currentTime + 0.18);
}
export function playJingle() {
  if (!ctx || G.muted) return;
  [523, 659, 784, 1046].forEach((f, i) => {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const g = ctx.createGain(); const t = ctx.currentTime + i * 0.12;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.55);
  });
}
export function playBlip(f = 880) {
  if (!ctx || G.muted) return;
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.08, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + 0.16);
}
