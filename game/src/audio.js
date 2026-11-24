// Synthesised WebAudio: engine, horn, siren, shots, jingles, radio music.
// No audio files. Everything is guarded so headless runs stay silent.
export class AudioSys {
  constructor() {
    this.ctx = null; this.master = null; this.eng = null; this.engGain = null;
    this.sirenOsc = null; this.sirenGain = null; this.musicT = 0; this.note = 0;
    this.muted = false;
  }
  ensure() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
  tone(f, dur, type = 'sine', vol = 0.2, slideTo = 0) {
    if (!this.ctx || this.muted) return;
    try {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.value = f;
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), this.ctx.currentTime + dur);
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.connect(g); g.connect(this.master);
      o.start(); o.stop(this.ctx.currentTime + dur);
    } catch { /* ignore */ }
  }
  noise(dur, vol = 0.2, low = 400) {
    if (!this.ctx || this.muted) return;
    try {
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low;
      const g = this.ctx.createGain(); g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
    } catch { /* ignore */ }
  }
  shoot() { this.noise(0.12, 0.35, 3000); this.tone(180, 0.08, 'square', 0.12, 60); }
  punch() { this.noise(0.08, 0.25, 500); }
  horn() { this.tone(370, 0.35, 'sawtooth', 0.12); this.tone(466, 0.35, 'sawtooth', 0.1); }
  coin() { this.tone(880, 0.1, 'sine', 0.15); setTimeout(() => this.tone(1320, 0.18, 'sine', 0.15), 90); }
  jingle() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.18), i * 110)); }
  fail() { [400, 300, 220].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'sawtooth', 0.12), i * 130)); }
  engine(on, speed01) {
    if (!this.ctx || this.muted) { if (this.engGain) this.engGain.gain.value = 0; return; }
    try {
      if (!this.eng) {
        this.eng = this.ctx.createOscillator(); this.eng.type = 'sawtooth';
        this.engGain = this.ctx.createGain(); this.engGain.gain.value = 0;
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
        this.eng.connect(f); f.connect(this.engGain); this.engGain.connect(this.master);
        this.eng.start();
      }
      const target = on ? 0.05 + speed01 * 0.09 : 0;
      this.engGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
      this.eng.frequency.setTargetAtTime(55 + speed01 * 165, this.ctx.currentTime, 0.08);
    } catch { /* ignore */ }
  }
  siren(on) {
    if (!this.ctx) return;
    try {
      if (on && !this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator(); this.sirenOsc.type = 'triangle';
        this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = this.muted ? 0 : 0.045;
        const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.6;
        const lg = this.ctx.createGain(); lg.gain.value = 260;
        lfo.connect(lg); lg.connect(this.sirenOsc.frequency);
        this.sirenOsc.frequency.value = 800;
        this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
        this.sirenOsc.start(); lfo.start();
      } else if (!on && this.sirenOsc) {
        try { this.sirenOsc.stop(); } catch { /* ignore */ }
        this.sirenOsc = null;
      }
    } catch { /* ignore */ }
  }
  // Gentle A-minor pad loop, one chord per bar.
  music(dt) {
    if (!this.ctx || this.muted) return;
    this.musicT += dt;
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 220, 261.6]];
    if (this.musicT > 2.4) {
      this.musicT = 0;
      const ch = chords[this.note % 4]; this.note++;
      ch.forEach((f) => {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.035, this.ctx.currentTime + 0.4);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2.3);
        o.connect(g); g.connect(this.master);
        o.start(); o.stop(this.ctx.currentTime + 2.4);
      });
    }
  }
}
