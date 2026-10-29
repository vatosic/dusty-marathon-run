/* DUSTY Marathon Run — звук: синтез Web Audio, оригинальный ритм у точки Дасти */
(function (G) {
  'use strict';
  const D = G.DUSTY;
  const A = (D.Audio = {});
  let ctx = null, master = null, sfx = null, music = null, noise = null;
  let enabled = false, paused = false, nextStep = 0, step = 0, musicLevel = 0;
  const BPM = 124, STEP = 60 / BPM / 4;

  function ensure() {
    if (ctx) return true;
    const AC = G.AudioContext || G.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = 0.6; sfx.connect(master);
    music = ctx.createGain(); music.gain.value = 0; music.connect(master);
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

  // Оригинальный синтезированный ритм; громкость зависит от близости к точке Дасти
  const BASS = [45, 0, 45, 0, 48, 0, 45, 52, 45, 0, 45, 0, 43, 0, 50, 48];
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  A.updateMusic = function (level) {
    musicLevel = level;
    if (!ctx) return;
    const t = ctx.currentTime;
    music.gain.setTargetAtTime(live() ? level * 0.55 : 0, t, 0.25);
    if (!live() || level < 0.02) { nextStep = 0; return; }
    if (nextStep < t) { nextStep = t + 0.05; }
    while (nextStep < t + 0.2) {
      const s = step % 16, bar = Math.floor(step / 16) % 4;
      if (s % 4 === 0) tone(150, nextStep, 0.25, 'sine', 0.9, music, 45);
      if (s === 4 || s === 12) hiss(nextStep, 0.14, 0.35, 1800, music);
      if (s % 2 === 1) hiss(nextStep, 0.04, 0.18, 7000, music);
      if (BASS[s]) tone(midi(BASS[s] + (bar === 3 ? 2 : 0)), nextStep, STEP * 1.6, 'sawtooth', 0.16, music);
      if (s === 0 || s === 10) {
        const root = bar === 2 ? 65 : bar === 3 ? 67 : 69;
        [0, 3, 7].forEach((iv) => tone(midi(root + iv), nextStep, STEP * 2, 'square', 0.035, music));
      }
      nextStep += STEP; step++;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
