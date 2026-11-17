// WebAudio synth: no audio files. Engine hum, siren, shots, jingle, music.
// Everything is guarded: no AudioContext until a user gesture, all calls safe.
export function createAudio() {
  const A = { ctx: null, muted: false, engineOsc: null, engineGain: null, musicTimer: 0, sirenOn: false, sirenOsc: null, sirenGain: null };
  A.ensure = () => {
    if (A.ctx) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      A.ctx = new Ctx();
      A.master = A.ctx.createGain(); A.master.gain.value = 0.5; A.master.connect(A.ctx.destination);
      const o = A.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 50;
      const g = A.ctx.createGain(); g.gain.value = 0;
      const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
      o.connect(f); f.connect(g); g.connect(A.master); o.start();
      A.engineOsc = o; A.engineGain = g;
      const s = A.ctx.createOscillator(); s.type = 'triangle'; s.frequency.value = 700;
      const sg = A.ctx.createGain(); sg.gain.value = 0;
      s.connect(sg); sg.connect(A.master); s.start();
      A.sirenOsc = s; A.sirenGain = sg;
    } catch { return false; }
    return true;
  };
  A.resume = () => { if (A.ensure() && A.ctx.state === 'suspended') A.ctx.resume().catch(() => {}); };
  A.tone = (freq, dur, type, vol, when = 0) => {
    if (!A.ctx || A.muted) return;
    try {
      const t = A.ctx.currentTime + when;
      const o = A.ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
      const g = A.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(A.master); o.start(t); o.stop(t + dur + 0.02);
    } catch { /* ignore */ }
  };
  A.noise = (dur, vol, low = 1000) => {
    if (!A.ctx || A.muted) return;
    try {
      const len = Math.floor(A.ctx.sampleRate * dur);
      const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = A.ctx.createBufferSource(); src.buffer = buf;
      const f = A.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = low;
      const g = A.ctx.createGain(); g.gain.value = vol || 0.3;
      src.connect(f); f.connect(g); g.connect(A.master); src.start();
    } catch { /* ignore */ }
  };
  A.shot = () => A.noise(0.14, 0.4, 800);
  A.punch = () => A.noise(0.08, 0.25, 300);
  A.honk = () => { A.tone(370, 0.25, 'square', 0.12); A.tone(466, 0.25, 'square', 0.1); };
  A.pickup = () => { A.tone(880, 0.12, 'sine', 0.2); A.tone(1320, 0.18, 'sine', 0.2, 0.1); };
  A.jingle = () => { [523, 659, 784, 1046].forEach((f, i) => A.tone(f, 0.22, 'triangle', 0.22, i * 0.12)); };
  A.fail = () => { [392, 330, 262].forEach((f, i) => A.tone(f, 0.25, 'triangle', 0.2, i * 0.15)); };
  A.setEngine = (speedFrac, driving) => {
    if (!A.ctx || !A.engineGain) return;
    const target = A.muted ? 0 : (driving ? 0.05 + speedFrac * 0.09 : 0.0);
    A.engineGain.gain.setTargetAtTime(target, A.ctx.currentTime, 0.1);
    A.engineOsc.frequency.setTargetAtTime(45 + speedFrac * 130, A.ctx.currentTime, 0.1);
  };
  A.setSiren = (on) => {
    if (!A.ctx || !A.sirenGain) return;
    A.sirenOn = on;
    A.sirenGain.gain.setTargetAtTime(on && !A.muted ? 0.045 : 0, A.ctx.currentTime, 0.2);
  };
  A.updateSiren = (t) => {
    if (A.sirenOn && A.sirenOsc) A.sirenOsc.frequency.value = 650 + Math.sin(t * 6) * 220;
  };
  const CHORDS = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 220, 261.6]];
  A.startMusic = () => {
    if (!A.ctx || A.musicTimer) return;
    let bar = 0;
    A.musicTimer = setInterval(() => {
      if (A.muted || !A.ctx) return;
      const chord = CHORDS[bar % CHORDS.length]; bar++;
      chord.forEach((f) => A.tone(f, 2.2, 'sine', 0.05));
      A.tone(chord[0] * 2, 0.5, 'triangle', 0.04, 0.5);
    }, 2000);
  };
  A.toggleMute = () => {
    A.muted = !A.muted;
    if (A.master) A.master.gain.value = A.muted ? 0 : 0.5;
    return A.muted;
  };
  return A;
}
