// Procedural WebAudio only — zero audio files. Engine pitch follows speed,
// horn (H), skid, siren, gunshots, jingles, city ambience, radio pad.
import { G, CFG } from './config.js';

let ctx = null, master = null, engOsc = null, engOsc2 = null, engGain = null;
let engFilter = null, ambGain = null, sirenOsc = null, sirenGain = null;
let radioT = 0, radioStep = 0, muted = false;

function ac() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  return ctx;
}

export function initAudio() {
  const c = ac(); if (!c) return;
  if (c.state === 'suspended') c.resume();
  if (engOsc) return;
  engOsc = c.createOscillator(); engOsc.type = 'sawtooth'; engOsc.frequency.value = 55;
  engOsc2 = c.createOscillator(); engOsc2.type = 'square'; engOsc2.frequency.value = 28;
  engFilter = c.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 700;
  engGain = c.createGain(); engGain.gain.value = 0;
  const g2 = c.createGain(); g2.gain.value = 0.4;
  engOsc.connect(engFilter); engOsc2.connect(g2); g2.connect(engFilter);
  engFilter.connect(engGain); engGain.connect(master);
  engOsc.start(); engOsc2.start();
  // City ambience: looped filtered noise, quiet.
  const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3; }
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 320; bp.Q.value = 0.4;
  ambGain = c.createGain(); ambGain.gain.value = 0.05;
  src.connect(bp); bp.connect(ambGain); ambGain.connect(master); src.start();
  // Police siren, silent until wanted >= 2.
  sirenOsc = c.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 720;
  sirenGain = c.createGain(); sirenGain.gain.value = 0;
  sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
}

export function setMuted(m) {
  muted = m; G.muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}
export function toggleMute() { setMuted(!muted); return muted; }
export function isMuted() { return muted; }

function blip(freq, dur, type, vol, slideTo) {
  const c = ac(); if (!c || muted) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
  g.gain.setValueAtTime(vol || 0.2, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g); g.connect(master); o.start(); o.stop(c.currentTime + dur);
}

function noiseBurst(dur, freq, vol) {
  const c = ac(); if (!c || muted) return;
  const len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource(); s.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  const g = c.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start();
}

export const sfx = {
  horn() { blip(370, 0.35, 'square', 0.16); blip(466, 0.35, 'square', 0.12); },
  skid() { noiseBurst(0.4, 900, 0.25); },
  shot() { noiseBurst(0.12, 1800, 0.4); blip(160, 0.08, 'square', 0.25, 60); },
  punch() { noiseBurst(0.08, 300, 0.3); },
  click() { blip(880, 0.05, 'sine', 0.12); },
  splash() { noiseBurst(0.5, 500, 0.2); },
  camera() { blip(1200, 0.06, 'sine', 0.15); blip(900, 0.08, 'sine', 0.12); },
  coin() { blip(988, 0.1, 'sine', 0.18); setTimeout(() => blip(1319, 0.18, 'sine', 0.18), 90); },
  jingle() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.2), i * 110)); },
  fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'triangle', 0.18), i * 130)); },
  gull() { blip(1400, 0.18, 'sine', 0.05, 1900); },
};

// Called every frame: engine follows speed, siren wails with wanted,
// radio pad cycles a soft A-minor progression (CELESTE 98.1).
export function updateAudio(dt, speed01, driving) {
  if (!ctx || muted) { if (engGain) engGain.gain.value = 0; return; }
  const t = ctx.currentTime;
  if (engOsc && engGain) {
    const rpm = 55 + speed01 * 240 + (driving ? 18 : 0);
    engOsc.frequency.setTargetAtTime(rpm, t, 0.06);
    engOsc2.frequency.setTargetAtTime(rpm * 0.5, t, 0.06);
    engFilter.frequency.setTargetAtTime(500 + speed01 * 1800, t, 0.1);
    engGain.gain.setTargetAtTime(driving ? 0.06 + speed01 * 0.09 : 0.0, t, 0.1);
  }
  if (sirenOsc && sirenGain) {
    const on = G.wanted >= 2 && G.phase === 'play';
    sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, t, 0.2);
    if (on) sirenOsc.frequency.setTargetAtTime(680 + 160 * Math.sin(G.elapsed * 2.4), t, 0.05);
  }
  if (ambGain) ambGain.gain.setTargetAtTime(G.phase === 'play' ? 0.05 : 0.02, t, 0.5);
  radioT += dt;
  if (radioT > 2.2) {
    radioT = 0;
    const roots = [110, 87.3, 98, 82.4]; // A2 F2 G2 E2
    const root = roots[radioStep % 4]; radioStep++;
    blip(root, 2.0, 'triangle', 0.035);
    blip(root * 1.5, 2.0, 'triangle', 0.022);
    blip(root * 2, 1.6, 'sine', 0.015);
  }
  if (G.player.pos.x < -240 && Math.random() < dt * 0.06) sfx.gull();
}

export function radioTrack() {
  return CFG.tracks[Math.floor(G.elapsed / 25) % CFG.tracks.length];
}
