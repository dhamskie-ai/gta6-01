// WebAudio synth sound: engine hum, siren, gunshots, jingles, ambient music.
// No audio files — everything is generated with oscillators and noise.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startEngine();
      this.startMusic();
    } catch { this.ctx = null; }
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
  startEngine() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 50;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 600;
    this.engineOsc.connect(filt); filt.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start();
  }
  setEngine(speedFrac, driving) {
    if (!this.engineOsc) return;
    this.engineOsc.frequency.value = 45 + speedFrac * 160;
    this.engineGain.gain.value = driving ? 0.05 + speedFrac * 0.05 : 0.015;
  }
  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.04;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 1.6;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start(); lfo.start();
      this.sirenLfo = lfo;
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch { /* already stopped */ }
      this.sirenOsc = null; this.sirenLfo = null;
    }
  }
  blip(freq, dur, type = 'sine', vol = 0.15) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }
  noiseBurst(dur = 0.15, vol = 0.3) {
    if (!this.ctx || this.muted) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g); g.connect(this.master);
    src.start();
  }
  gunshot() { this.noiseBurst(0.14, 0.35); this.blip(120, 0.1, 'square', 0.12); }
  punch() { this.noiseBurst(0.08, 0.2); }
  horn() { this.blip(330, 0.25, 'square', 0.1); this.blip(415, 0.25, 'square', 0.08); }
  coin() { this.blip(880, 0.08, 'sine', 0.15); setTimeout(() => this.blip(1320, 0.12, 'sine', 0.15), 70); }
  missionJingle() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'triangle', 0.18), i * 110));
  }
  failJingle() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.25, 'triangle', 0.15), i * 140)); }
  startMusic() {
    // A-minor ambient loop: soft chord pads, one note every 0.5 s.
    const scale = [220, 261.6, 329.6, 392, 440, 523.2];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx || document.hidden) return;
      const f = scale[this.musicStep % scale.length];
      this.musicStep += 1;
      this.blip(f, 0.9, 'sine', 0.035);
      if (this.musicStep % 4 === 0) this.blip(f / 2, 1.4, 'sine', 0.03);
    }, 500);
  }
}
