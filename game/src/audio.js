// Suara sintetis WebAudio (tanpa file audio): mesin, klakson, sirene,
// tembakan, pukulan, jingle misi, musik loop CELESTE 98.1. Semua no-op
// bila AudioContext tidak tersedia; mulai hanya setelah gestur pemain.
export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null, musicTimer = null, muted = false;
  let musicOn = false, track = 0;
  const A = {
    ensure() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.5;
        master.connect(ctx.destination);
      } catch { ctx = null; }
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    isMuted() { return muted; },
    blip(freq, dur, type = 'sine', vol = 0.3, slide = 0) {
      if (!ctx) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + dur);
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur);
    },
    click() { A.blip(660, 0.07, 'square', 0.15); },
    horn() { A.blip(370, 0.28, 'square', 0.25); A.blip(466, 0.28, 'square', 0.2); },
    punch() { A.blip(140, 0.12, 'sawtooth', 0.35, -60); },
    shot() { A.blip(180, 0.14, 'sawtooth', 0.4, -120); A.blip(90, 0.1, 'square', 0.3); },
    reload() { A.blip(520, 0.06, 'square', 0.2); setTimeout(() => A.blip(760, 0.06, 'square', 0.2), 90); },
    coin() { A.blip(990, 0.1, 'sine', 0.25); setTimeout(() => A.blip(1320, 0.18, 'sine', 0.25), 90); },
    boom() { A.blip(70, 0.6, 'sawtooth', 0.5, -40); A.blip(45, 0.8, 'sine', 0.4); },
    jingle() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => A.blip(f, 0.22, 'triangle', 0.3), i * 110));
    },
    fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => A.blip(f, 0.25, 'triangle', 0.25), i * 130)); },
    engine(on, speed01 = 0) {
      if (!ctx) return;
      if (on && !engineOsc) {
        engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain(); engineGain.gain.value = 0.05;
        const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 700;
        engineOsc.connect(filt); filt.connect(engineGain); engineGain.connect(master);
        engineOsc.start();
      }
      if (engineOsc) {
        engineOsc.frequency.value = 55 + speed01 * 140;
        engineGain.gain.value = on ? 0.04 + speed01 * 0.06 : 0;
      }
      if (!on && engineOsc) {
        try { engineOsc.stop(); } catch { /* abaikan */ }
        engineOsc = null; engineGain = null;
      }
    },
    siren(on) {
      if (!ctx) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine';
        sirenGain = ctx.createGain(); sirenGain.gain.value = 0.045;
        sirenOsc.connect(sirenGain); sirenGain.connect(master);
        sirenOsc.start();
        sirenOsc.frequency.setValueAtTime(650, ctx.currentTime);
        sirenOsc.frequency.linearRampToValueAtTime(950, ctx.currentTime + 0.7);
      } else if (!on && sirenOsc) {
        try { sirenOsc.stop(); } catch { /* abaikan */ }
        sirenOsc = null; sirenGain = null;
      } else if (sirenOsc) {
        const t = ctx.currentTime % 1.4;
        sirenOsc.frequency.value = t < 0.7 ? 650 + (t / 0.7) * 300 : 950 - ((t - 0.7) / 0.7) * 300;
      }
    },
    setMusic(on, trackIdx = 0) {
      musicOn = on; track = trackIdx;
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
      if (!on || !ctx) return;
      // Progresi Am – F – C – G, tempo santai, satu not per ketuk.
      const chords = [[220, 261, 329], [174, 220, 261], [196, 246, 294], [164, 196, 246]];
      let step = 0;
      musicTimer = setInterval(() => {
        if (!musicOn || muted) return;
        const ch = chords[Math.floor(step / 4) % 4];
        A.blip(ch[step % 3] * (track % 2 === 0 ? 1 : 1.12), 0.5, 'triangle', 0.07);
        if (step % 8 === 0) A.blip(ch[0] / 2, 0.9, 'sine', 0.09);
        step++;
      }, 300);
    },
  };
  return A;
}
