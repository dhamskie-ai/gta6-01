// WebAudio synth sound: engine hum, horn, siren, gunshots, punches, coins,
// mission jingle and a soft A-minor ambient loop. No audio files.
export function createAudio() {
  const audio = {
    ctx: null, muted: false, musicTimer: 0, engineOsc: null, engineGain: null,
    sirenOsc: null, sirenGain: null, musicOn: false, nextNote: 0, chord: 0,
    ensure() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
      } catch { this.ctx = null; }
    },
    setMuted(m) { this.muted = m; if (this.engineGain) this.engineGain.gain.value = 0; },
    tone(freq, dur, type, vol, slideTo) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol || 0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + dur);
    },
    shot() { this.tone(180, 0.12, 'square', 0.2, 60); this.tone(900, 0.05, 'sawtooth', 0.1, 200); },
    punch() { this.tone(120, 0.1, 'sine', 0.25, 50); },
    honk() { this.tone(370, 0.35, 'square', 0.1); this.tone(466, 0.35, 'square', 0.08); },
    coin() { this.tone(880, 0.09, 'sine', 0.14); setTimeout(() => this.tone(1318, 0.14, 'sine', 0.14), 90); },
    click() { this.tone(660, 0.05, 'square', 0.08); },
    jingle() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.14), i * 110)); },
    fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'triangle', 0.12), i * 130)); },
    engineStart() {
      if (!this.ctx || this.engineOsc) return;
      this.engineOsc = this.ctx.createOscillator(); this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 55;
      this.engineGain.gain.value = 0.0;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
    },
    engineUpdate(speedNorm) {
      if (!this.ctx || !this.engineOsc) return;
      this.engineOsc.frequency.value = 50 + speedNorm * 160;
      this.engineGain.gain.value = this.muted ? 0 : 0.02 + speedNorm * 0.05;
    },
    engineStop() { try { this.engineOsc?.stop(); } catch { /* already stopped */ } this.engineOsc = null; this.engineGain = null; },
    sirenStart() {
      if (!this.ctx || this.sirenOsc) return;
      this.sirenOsc = this.ctx.createOscillator(); this.sirenGain = this.ctx.createGain();
      this.sirenOsc.type = 'sine'; this.sirenOsc.frequency.value = 700;
      this.sirenGain.gain.value = this.muted ? 0 : 0.03;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.ctx.destination);
      this.sirenOsc.start();
    },
    sirenUpdate(t) {
      if (this.sirenOsc) this.sirenOsc.frequency.value = 650 + Math.sin(t * 4) * 220;
    },
    sirenStop() { try { this.sirenOsc?.stop(); } catch { /* stopped */ } this.sirenOsc = null; this.sirenGain = null; },
    // Soft A-minor loop: Am – F – C – G, one chord a bar, quiet plucks.
    startMusic() {
      if (this.musicOn || !this.ctx) return;
      this.musicOn = true;
      const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [196, 246.9, 293.7]];
      const tick = () => {
        if (!this.musicOn) return;
        const chord = chords[this.chord % chords.length]; this.chord++;
        chord.forEach((f, i) => setTimeout(() => this.tone(f, 1.4, 'triangle', 0.035), i * 90));
        setTimeout(tick, 2400);
      };
      tick();
    },
  };
  return audio;
}
