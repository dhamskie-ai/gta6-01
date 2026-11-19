// WebAudio synth — no audio files: engine, siren, shots, jingles, music.
export function createAudio() {
  let ctx = null, master = null, muted = false, eng = null, engGain = null, sir = null, sirGain = null;
  let chordI = 0, nextChord = 0, trackT = 0;
  const CHORDS = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 196, 246.9]];
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
      eng = ctx.createOscillator(); eng.type = 'sawtooth'; eng.frequency.value = 60;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      engGain = ctx.createGain(); engGain.gain.value = 0;
      eng.connect(f); f.connect(engGain); engGain.connect(master); eng.start();
      sir = ctx.createOscillator(); sir.type = 'triangle'; sir.frequency.value = 700;
      sirGain = ctx.createGain(); sirGain.gain.value = 0;
      sir.connect(sirGain); sirGain.connect(master); sir.start();
      return true;
    } catch { return false; }
  }
  function blip(freq, dur, type = 'square', vol = 0.2) {
    if (!ensure()) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur);
  }
  function noise(dur, vol = 0.3) {
    if (!ensure()) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const g = ctx.createGain(); g.gain.value = vol;
    s.connect(g); g.connect(master); s.start();
  }
  return {
    unlock: ensure,
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    shot() { noise(0.12, 0.35); blip(160, 0.08, 'square', 0.2); },
    punch() { noise(0.07, 0.25); },
    click() { blip(880, 0.05, 'sine', 0.12); },
    coin() { blip(1320, 0.08, 'sine', 0.15); setTimeout(() => blip(1760, 0.12, 'sine', 0.15), 70); },
    jingle() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.2), i * 110)); },
    fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'sawtooth', 0.12), i * 140)); },
    horn() { blip(370, 0.3, 'square', 0.15); },
    update(dt, speed01, wanted, t) {
      if (!ctx) return;
      if (engGain) engGain.gain.value = speed01 * 0.08;
      if (eng) eng.frequency.value = 55 + speed01 * 130;
      if (sirGain) sirGain.gain.value = wanted > 0 ? 0.045 : 0;
      if (sir && wanted > 0) sir.frequency.value = (Math.floor(t * 2.2) % 2 ? 950 : 700);
      if (t >= nextChord) {
        nextChord = t + 4;
        const ch = CHORDS[chordI % CHORDS.length]; chordI++;
        ch.forEach((f) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'triangle'; o.frequency.value = f / 2;
          g.gain.setValueAtTime(0.0001, ctx.currentTime);
          g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.6);
          g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 4);
          o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + 4.1);
        });
      }
      trackT += dt;
    },
  };
}
