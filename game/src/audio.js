export function createAudio() {
  const au = {
    ctx: null, master: null, muted: false, musicOn: false,
    engineOsc: null, engineGain: null, engineOn: false,
    sirenOsc: null, sirenGain: null, sirenOn: false, musicTimer: null,
  };

  au.ensure = function () {
    if (au.ctx) {
      if (au.ctx.state === 'suspended') au.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      au.ctx = new AC();
      au.master = au.ctx.createGain();
      au.master.gain.value = au.muted ? 0 : 0.5;
      au.master.connect(au.ctx.destination);
      return true;
    } catch (err) { return false; }
  };

  au.setMuted = function (m) {
    au.muted = m;
    if (au.master) au.master.gain.value = m ? 0 : 0.5;
  };

  function tone(freq, dur, type, vol, slideTo) {
    if (!au.ctx || au.muted) return;
    try {
      const t = au.ctx.currentTime;
      const o = au.ctx.createOscillator();
      const g = au.ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(au.master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (err) { /* ignore */ }
  }

  function noise(dur, vol, low) {
    if (!au.ctx || au.muted) return;
    try {
      const t = au.ctx.currentTime;
      const len = Math.floor(au.ctx.sampleRate * dur);
      const buf = au.ctx.createBuffer(1, len, au.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = au.ctx.createBufferSource();
      src.buffer = buf;
      const f = au.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = low || 1200;
      const g = au.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(au.master);
      src.start(t);
    } catch (err) { /* ignore */ }
  }

  au.click = function () { tone(660, 0.07, 'square', 0.12); };
  au.horn = function () { tone(370, 0.28, 'sawtooth', 0.18); tone(466, 0.28, 'sawtooth', 0.14); };
  au.punch = function () { noise(0.12, 0.35, 700); };
  au.pickup = function () { tone(880, 0.09, 'sine', 0.2); setTimeout(() => tone(1320, 0.12, 'sine', 0.2), 70); };
  au.shot = function (kind) {
    if (kind === 'mako') { noise(0.09, 0.3, 2600); tone(190, 0.08, 'square', 0.16, 70); }
    else if (kind === 'breaker') { noise(0.22, 0.45, 1500); tone(120, 0.2, 'square', 0.25, 45); }
    else { noise(0.12, 0.32, 2000); tone(220, 0.1, 'square', 0.18, 80); }
  };
  au.jingle = function (win) {
    const notes = win ? [523, 659, 784, 1047] : [392, 330, 262, 196];
    notes.forEach((n, i) => setTimeout(() => tone(n, 0.22, 'triangle', 0.22), i * 130));
  };
  au.busted = function () { tone(220, 0.5, 'sawtooth', 0.2, 110); tone(165, 0.7, 'sawtooth', 0.18, 82); };

  au.engine = function (on, speed01) {
    if (!au.ctx) return;
    try {
      if (on && !au.engineOn) {
        au.engineOsc = au.ctx.createOscillator();
        au.engineGain = au.ctx.createGain();
        au.engineOsc.type = 'sawtooth';
        au.engineOsc.frequency.value = 60;
        au.engineGain.gain.value = 0.05;
        const f = au.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 900;
        au.engineOsc.connect(f); f.connect(au.engineGain); au.engineGain.connect(au.master);
        au.engineOsc.start();
        au.engineOn = true;
      } else if (!on && au.engineOn) {
        au.engineOsc.stop(); au.engineOsc = null; au.engineOn = false;
      }
      if (au.engineOn) {
        au.engineOsc.frequency.value = 55 + speed01 * 165;
        au.engineGain.gain.value = 0.03 + speed01 * 0.06;
      }
    } catch (err) { /* ignore */ }
  };

  au.siren = function (on) {
    if (!au.ctx) return;
    try {
      if (on && !au.sirenOn) {
        au.sirenOsc = au.ctx.createOscillator();
        au.sirenGain = au.ctx.createGain();
        au.sirenOsc.type = 'sine';
        au.sirenOsc.frequency.value = 700;
        au.sirenGain.gain.value = 0.045;
        au.sirenOsc.connect(au.sirenGain); au.sirenGain.connect(au.master);
        au.sirenOsc.start();
        au.sirenOn = true;
        au._sirenPhase = 0;
      } else if (!on && au.sirenOn) {
        au.sirenOsc.stop(); au.sirenOsc = null; au.sirenOn = false;
      }
    } catch (err) { /* ignore */ }
  };

  au.updateSiren = function (dt) {
    if (au.sirenOn && au.sirenOsc) {
      au._sirenPhase = (au._sirenPhase || 0) + dt * 2.2;
      const s = Math.sin(au._sirenPhase * Math.PI * 2) > 0 ? 950 : 650;
      try { au.sirenOsc.frequency.value = s; } catch (err) { /* ignore */ }
    }
  };

  au.music = function (on) {
    if (on === au.musicOn) return;
    au.musicOn = on;
    if (on && au.ctx) {
      const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 220, 261.6]];
      let step = 0;
      au.musicTimer = setInterval(() => {
        if (au.muted || !au.ctx) return;
        const ch = chords[step % chords.length];
        step++;
        ch.forEach((f) => tone(f, 1.6, 'triangle', 0.05));
        tone(ch[0] * 2, 0.5, 'sine', 0.05);
      }, 900);
    } else if (au.musicTimer) {
      clearInterval(au.musicTimer);
      au.musicTimer = null;
    }
  };

  return au;
}
