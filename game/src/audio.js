// SOLARA BAY — fully synthesized WebAudio: no audio files. Engine hum,
// siren, gunshots, jingles and a lazy A-minor ambient loop are all built
// from oscillators, so the game stays offline and file-free.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let muted = false;
  const CHORDS = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 196, 246.9]];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch (err) { return false; }
    return true;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch (err) { /* audio is best-effort */ }
  }

  function noiseBurst(dur, vol, lowpass) {
    if (!ensure() || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
      const g = ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    } catch (err) { /* audio is best-effort */ }
  }

  const api = {
    get muted() { return muted; },
    setMuted(m) {
      muted = !!m;
      if (master) master.gain.value = muted ? 0 : 0.5;
      if (muted) { api.siren(false); api.engine(0); }
    },
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    click() { blip(660, 0.07, 'square', 0.12); },
    jingle(ok) {
      if (ok) {
        blip(523, 0.12, 'triangle', 0.22);
        setTimeout(() => blip(659, 0.12, 'triangle', 0.22), 110);
        setTimeout(() => blip(784, 0.22, 'triangle', 0.24), 220);
      } else blip(330, 0.18, 'sawtooth', 0.14, 220);
    },
    shot() { noiseBurst(0.12, 0.4, 900); blip(140, 0.08, 'square', 0.18, 60); },
    punch() { noiseBurst(0.08, 0.25, 500); },
    horn() { blip(370, 0.35, 'square', 0.14); setTimeout(() => blip(466, 0.3, 'square', 0.12), 40); },
    coin() { blip(988, 0.09, 'sine', 0.2); setTimeout(() => blip(1319, 0.16, 'sine', 0.2), 90); },
    engine(speed01) {
      if (!ensure() || muted) { if (engineGain) engineGain.gain.value = 0; return; }
      try {
        if (!engineOsc) {
          engineOsc = ctx.createOscillator();
          engineOsc.type = 'sawtooth';
          engineGain = ctx.createGain();
          engineGain.gain.value = 0;
          const f = ctx.createBiquadFilter();
          f.type = 'lowpass'; f.frequency.value = 700;
          engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
          engineOsc.start();
        }
        engineOsc.frequency.value = 55 + speed01 * 130;
        engineGain.gain.value = speed01 > 0.02 ? 0.05 + speed01 * 0.06 : 0;
      } catch (err) { /* audio is best-effort */ }
    },
    siren(on) {
      if (!ensure()) return;
      try {
        if (on && !sirenOsc) {
          sirenOsc = ctx.createOscillator();
          sirenOsc.type = 'sine';
          const sg = ctx.createGain();
          sg.gain.value = muted ? 0 : 0.05;
          sirenOsc.connect(sg); sg.connect(master);
          sirenOsc.start();
          const sweep = () => {
            if (!sirenOsc) return;
            sirenOsc.frequency.setValueAtTime(700, ctx.currentTime);
            sirenOsc.frequency.linearRampToValueAtTime(1400, ctx.currentTime + 0.6);
            sirenOsc.frequency.linearRampToValueAtTime(700, ctx.currentTime + 1.2);
          };
          sweep();
          sirenOsc._iv = setInterval(sweep, 1200);
        } else if (!on && sirenOsc) {
          clearInterval(sirenOsc._iv);
          sirenOsc.stop();
          sirenOsc = null;
        }
      } catch (err) { /* audio is best-effort */ }
    },
    startMusic() {
      if (api._musicTimer || !ensure()) return;
      let step = 0;
      api._musicTimer = setInterval(() => {
        if (muted) return;
        const chord = CHORDS[step % CHORDS.length];
        step++;
        chord.forEach((f, i) => setTimeout(() => blip(f, 1.4, 'triangle', 0.05), i * 40));
      }, 1600);
    },
  };
  return api;
}
