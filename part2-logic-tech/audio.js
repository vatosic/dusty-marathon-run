/* DUSTY Marathon Run — звук: синтез Web Audio, оригинальный сет DJ KIM у точек Дасти */
(function (G) {
  'use strict';
  const D = G.DUSTY;
  const A = (D.Audio = {});
  let ctx = null, master = null, sfx = null, music = null, pump = null, noise = null;
  let enabled = false, paused = false, nextStep = 0, step = 0, musicLevel = 0;
  const BPM = 128, STEP = 60 / BPM / 4;

  function ensure() {
    if (ctx) return true;
    const AC = G.AudioContext || G.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = 0.6; sfx.connect(master);
    music = ctx.createGain(); music.gain.value = 0; music.connect(master);
    // «насос»: бас и аккорды приседают под каждую бочку (sidechain)
    pump = ctx.createGain(); pump.gain.value = 1; pump.connect(music);
    const len = ctx.sampleRate * 0.5;
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  A.isEnabled = () => enabled;
  A.supported = () => !!(G.AudioContext || G.webkitAudioContext);

  // Вызывается только из обработчика жеста пользователя
  A.setEnabled = function (on) {
    enabled = !!on;
    if (enabled) {
      if (!ensure()) { enabled = false; return false; }
      if (!paused) { ctx.resume(); master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(0.9, ctx.currentTime); }
    } else if (ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(0, ctx.currentTime);
      ctx.suspend();
    }
    return enabled;
  };

  A.setPaused = function (p) {
    paused = p;
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    if (p) {
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + 0.15);
      setTimeout(() => { if (paused && ctx) ctx.suspend(); }, 180);
    } else if (enabled) {
      ctx.resume();
      master.gain.setValueAtTime(0, t); master.gain.linearRampToValueAtTime(0.9, t + 0.2);
    }
  };

  const live = () => ctx && enabled && !paused && ctx.state === 'running';

  function tone(freq, start, dur, type, vol, dest, glideTo) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, start);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start); g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(dest || sfx); o.start(start); o.stop(start + dur + 0.02);
  }
  function hiss(start, dur, vol, freq, dest, type) {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const fl = ctx.createBiquadFilter(); fl.type = type || 'highpass'; fl.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, start); g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    s.connect(fl); fl.connect(g); g.connect(dest || sfx); s.start(start); s.stop(start + dur + 0.02);
  }

  A.play = function (name) {
    if (!live()) return;
    const t = ctx.currentTime + 0.005;
    switch (name) {
      case 'pickup': tone(880, t, 0.12, 'triangle', 0.3); tone(1320, t + 0.06, 0.16, 'triangle', 0.25); break;
      case 'bonus': tone(660, t, 0.1, 'square', 0.12); tone(990, t + 0.07, 0.1, 'square', 0.12); tone(1320, t + 0.14, 0.2, 'square', 0.12); break;
      case 'hit': tone(180, t, 0.22, 'sawtooth', 0.25, sfx, 70); hiss(t, 0.12, 0.25, 800, sfx, 'lowpass'); break;
      case 'shield': tone(520, t, 0.25, 'sine', 0.3, sfx, 1040); break;
      case 'boost': hiss(t, 0.5, 0.2, 1200, sfx, 'bandpass'); tone(300, t, 0.45, 'sawtooth', 0.12, sfx, 900); break;
      case 'clap': hiss(t, 0.08, 0.45, 1500); hiss(t + 0.03, 0.1, 0.35, 1500); break;
      case 'jump': tone(420, t, 0.12, 'sine', 0.15, sfx, 700); break;
      case 'flash': hiss(t, 0.06, 0.25, 4000); tone(2400, t, 0.05, 'square', 0.05); break;
      case 'click': tone(700, t, 0.05, 'square', 0.06); break;
      case 'finish': [523, 659, 784, 1047].forEach((fq, i) => tone(fq, t + i * 0.13, 0.4, 'triangle', 0.25)); break;
      case 'go': tone(880, t, 0.3, 'square', 0.12); break;
      case 'tick': tone(440, t, 0.12, 'square', 0.1); break;
    }
  };

  // Оригинальный синтезированный сет DJ KIM: 128 BPM, 16-тактовая фраза — 12 тактов драйва, брейкдаун, подъём, дроп
  const BASS = [36, 36, 48, 36, 0, 36, 46, 36, 36, 0, 48, 36, 43, 36, 46, 48];
  const CHORDS = [[57, 60, 64], [55, 59, 62], [53, 57, 60], [55, 59, 64]];
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function kick(t0) {
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(160, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + 0.11);
    gn.gain.setValueAtTime(1.1, t0); gn.gain.exponentialRampToValueAtTime(0.001, t0 + 0.34);
    o.connect(gn); gn.connect(music); o.start(t0); o.stop(t0 + 0.36);
    hiss(t0, 0.012, 0.35, 3500, music);
    pump.gain.cancelScheduledValues(t0); pump.gain.setValueAtTime(0.22, t0); pump.gain.linearRampToValueAtTime(1, t0 + STEP * 3);
  }
  function clap(t0) { for (const d of [0, 0.011, 0.023]) hiss(t0 + d, d === 0.023 ? 0.16 : 0.02, 0.32, 1400, music, 'bandpass'); }
  function acid(freq, t0, cut, len) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, t0);
    f.type = 'lowpass'; f.Q.value = 14; f.frequency.setValueAtTime(cut, t0); f.frequency.exponentialRampToValueAtTime(160, t0 + len);
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(0.2, t0 + 0.008); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    o.connect(f); f.connect(gn); gn.connect(pump); o.start(t0); o.stop(t0 + len + 0.02);
  }
  function stab(notes, t0, len, vol) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2800; f.connect(pump);
    for (const n of notes) for (const det of [-9, 0, 9]) {
      const o = ctx.createOscillator(), gn = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(midi(n), t0); o.detune.value = det;
      gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      o.connect(gn); gn.connect(f); o.start(t0); o.stop(t0 + len + 0.02);
    }
  }
  function riser(t0, len) {
    const s2 = ctx.createBufferSource(); s2.buffer = noise; s2.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(400, t0); f.frequency.exponentialRampToValueAtTime(7000, t0 + len);
    const gn = ctx.createGain(); gn.gain.setValueAtTime(0.02, t0); gn.gain.exponentialRampToValueAtTime(0.32, t0 + len); gn.gain.linearRampToValueAtTime(0, t0 + len + 0.02);
    s2.connect(f); f.connect(gn); gn.connect(music); s2.start(t0); s2.stop(t0 + len + 0.05);
  }
  A.updateMusic = function (level) {
    musicLevel = level;
    if (!ctx) return;
    const t = ctx.currentTime;
    music.gain.setTargetAtTime(live() ? level * 0.7 : 0, t, 0.25);
    if (!live() || level < 0.02) { nextStep = 0; return; }
    if (nextStep < t) { nextStep = t + 0.05; }
    while (nextStep < t + 0.2) {
      const s = step % 16, bar = Math.floor(step / 16) % 16, chord = CHORDS[Math.floor(bar / 2) % 4];
      const breakdown = bar >= 12 && bar < 15, build = bar === 15;
      if (!breakdown && !build && s % 4 === 0) kick(nextStep);
      if (build && s % 2 === 0) hiss(nextStep, 0.05, 0.12 + s * 0.02, 1800, music, 'bandpass'); // дробь перед дропом
      if (!breakdown && !build) {
        if (s % 4 === 2) hiss(nextStep, 0.13, 0.2, 6500, music); else hiss(nextStep, 0.025, 0.07, 9000, music);
        if (s === 4 || s === 12) clap(nextStep);
        if (BASS[s]) acid(midi(BASS[s] + (bar % 4 === 3 ? 3 : 0)), nextStep, 500 + 2600 * (0.5 + 0.5 * Math.sin(step / 40)), STEP * 1.5);
      }
      if (breakdown && s === 0) stab(chord, nextStep, STEP * 15, 0.03);          // брейкдаун: тянущийся аккорд
      else if (!breakdown && !build && (s === 0 || s === 6 || s === 11)) stab(chord, nextStep, STEP * 1.2, 0.045);
      if (build && s === 0) riser(nextStep, STEP * 16);
      nextStep += STEP; step++;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
