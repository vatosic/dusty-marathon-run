/* DUSTY Marathon Run — звук: синтез Web Audio. Оригинальный техно-сет DJ KIM у точек Дасти и в Лужниках,
   шаги и дыхание героя, гул, аплодисменты и возгласы болельщиков */
(function (G) {
  'use strict';
  const D = G.DUSTY;
  const A = (D.Audio = {});
  let ctx = null, master = null, sfx = null, music = null, pump = null, noise = null, amb = null, bedGain = null, dub = null;
  let enabled = false, paused = false, nextStep = 0, step = 0, musicLevel = 0, ambT = 0;
  const BPM = D.BPM, STEP = 60 / BPM / 4;

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
    // даб-эхо для аккордов: задержка на 3/16, затухающие повторы
    dub = ctx.createDelay(1); dub.delayTime.value = STEP * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2200;
    dub.connect(dl); dl.connect(fb); fb.connect(dub); dl.connect(music);
    // болельщики: непрерывный гул толпы (шум в полосах голоса, медленно «дышит»)
    amb = ctx.createGain(); amb.gain.value = 1; amb.connect(master);
    const bedBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), bd = bedBuf.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < bd.length; i++) { lp += (Math.random() * 2 - 1 - lp) * 0.3; bd[i] = lp * 2; }
    const bed = ctx.createBufferSource(); bed.buffer = bedBuf; bed.loop = true;
    bedGain = ctx.createGain(); bedGain.gain.value = 0;
    const sway = ctx.createGain(); sway.gain.value = 1;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.23; lfoG.gain.value = 0.3; lfo.connect(lfoG); lfoG.connect(sway.gain);
    for (const [fq, q] of [[480, 0.9], [1500, 1.3]]) { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fq; f.Q.value = q; bed.connect(f); f.connect(sway); }
    sway.connect(bedGain); bedGain.connect(amb); bed.start(); lfo.start();
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
    s.connect(fl); fl.connect(g); g.connect(dest || sfx); s.start(start, Math.random() * Math.max(0, 0.48 - dur)); s.stop(start + dur + 0.02);
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

  // Оригинальный техно-сет DJ KIM: D.BPM, 16-тактовая фраза — 12 тактов драйва (с 5-го такта — acid-линия),
  // брейкдаун с тянущимся аккордом, подъём и дроп. Бочка с «рокотом», катящийся бас, даб-аккорды с эхом
  const ROLL = [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1];
  const ACID = [36, 0, 48, 36, 0, 43, 36, 46, 0, 36, 48, 0, 43, 36, 46, 48];
  const CHORDS = [[57, 60, 64], [57, 60, 64], [55, 58, 62], [53, 57, 60]];
  const ROOT = [33, 33, 31, 29];
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function kick(t0) {
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(170, t0); o.frequency.exponentialRampToValueAtTime(44, t0 + 0.1);
    gn.gain.setValueAtTime(1.2, t0); gn.gain.exponentialRampToValueAtTime(0.001, t0 + 0.32);
    o.connect(gn); gn.connect(music); o.start(t0); o.stop(t0 + 0.34);
    hiss(t0, 0.01, 0.4, 3500, music);
    pump.gain.cancelScheduledValues(t0); pump.gain.setValueAtTime(0.2, t0); pump.gain.linearRampToValueAtTime(1, t0 + STEP * 3);
  }
  // «рокот»: низкий гул после бочки, как в зале с бетонными стенами
  function rumble(t0, freq) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(freq, t0);
    f.type = 'lowpass'; f.frequency.value = 140;
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(0.32, t0 + 0.03); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + STEP * 2.6);
    o.connect(f); f.connect(gn); gn.connect(pump); o.start(t0); o.stop(t0 + STEP * 2.7);
  }
  function clap(t0) { for (const d of [0, 0.011, 0.023]) hiss(t0 + d, d === 0.023 ? 0.18 : 0.02, 0.3, 1400, music, 'bandpass'); }
  function bass(freq, t0) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, t0);
    f.type = 'lowpass'; f.Q.value = 4; f.frequency.setValueAtTime(420, t0); f.frequency.exponentialRampToValueAtTime(120, t0 + STEP * 0.9);
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(0.26, t0 + 0.006); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + STEP * 0.9);
    o.connect(f); f.connect(gn); gn.connect(pump); o.start(t0); o.stop(t0 + STEP);
  }
  function acid(freq, t0, cut, len) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, t0);
    f.type = 'lowpass'; f.Q.value = 15; f.frequency.setValueAtTime(cut, t0); f.frequency.exponentialRampToValueAtTime(180, t0 + len);
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(0.13, t0 + 0.008); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    o.connect(f); f.connect(gn); gn.connect(pump); o.start(t0); o.stop(t0 + len + 0.02);
  }
  function stab(notes, t0, len, vol, echo) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400; f.connect(pump);
    if (echo) f.connect(dub);
    for (const n of notes) for (const det of [-8, 0, 8]) {
      const o = ctx.createOscillator(), gn = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(midi(n), t0); o.detune.value = det;
      gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(vol, t0 + 0.008); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      o.connect(gn); gn.connect(f); o.start(t0); o.stop(t0 + len + 0.02);
    }
  }
  function riser(t0, len) {
    const s2 = ctx.createBufferSource(); s2.buffer = noise; s2.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(400, t0); f.frequency.exponentialRampToValueAtTime(7000, t0 + len);
    const gn = ctx.createGain(); gn.gain.setValueAtTime(0.02, t0); gn.gain.exponentialRampToValueAtTime(0.3, t0 + len); gn.gain.linearRampToValueAtTime(0, t0 + len + 0.02);
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
      const s = step % 16, bar = Math.floor(step / 16) % 16, ci = Math.floor(bar / 2) % 4;
      const breakdown = bar >= 12 && bar < 15, build = bar === 15, drive = !breakdown && !build;
      if (drive && s % 4 === 0) { kick(nextStep); rumble(nextStep + STEP * 0.5, midi(ROOT[ci] - 12) * 2); }
      if (build && s % 2 === 0) hiss(nextStep, 0.05, 0.1 + s * 0.02, 1800, music, 'bandpass'); // дробь перед дропом
      if (drive) {
        if (s % 4 === 2) hiss(nextStep, 0.12, 0.18, 7000, music); else hiss(nextStep, 0.022, s % 2 ? 0.05 : 0.08, 9500, music);
        if (s === 4 || s === 12) clap(nextStep);
        if (s === 7 || (s === 15 && bar % 2)) hiss(nextStep, 0.03, 0.12, 3200, music, 'bandpass'); // перкуссия
        if (ROLL[s]) bass(midi(ROOT[ci]), nextStep);
        if (bar >= 4 && ACID[s]) acid(midi(ACID[s] + (bar % 4 === 3 ? 3 : 0)), nextStep, 500 + 2400 * (0.5 + 0.5 * Math.sin(step / 48)), STEP * 1.4);
        if (s === 0 && bar % 2 === 0) stab(CHORDS[ci], nextStep + STEP * 2, STEP * 0.9, 0.04, true);
      }
      if (breakdown && s === 0 && bar === 12) stab(CHORDS[ci], nextStep, STEP * 44, 0.03, true); // брейкдаун: тянущийся аккорд
      if (build && s === 0) riser(nextStep, STEP * 16);
      nextStep += STEP; step++;
    }
  };

  // Шаги героя: глухой удар и шорох подошвы (на тартане Лужников — мягче). Дыхание: два шага вдох, два — выдох,
  // громче с пульсом. Вызывается на каждом шаге из игрового цикла
  A.step = function (track, hr, n) {
    if (!live()) return;
    const t = ctx.currentTime + 0.003, side = n % 2, k = Math.max(0, Math.min(1, (hr - 95) / 90));
    tone(track ? 82 : 100 + side * 9, t, 0.075, 'sine', track ? 0.13 : 0.18, sfx, 46);
    hiss(t, track ? 0.03 : 0.045, track ? 0.035 : 0.06, track ? 900 : 1800 + side * 250, sfx, 'bandpass');
    if (side === 0) {
      const inhale = (n >> 1) % 2 === 0, dur = inhale ? 0.28 : 0.34, vol = 0.012 + 0.045 * k;
      const s = ctx.createBufferSource(); s.buffer = noise; s.playbackRate.value = 0.75 + Math.random() * 0.1;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = inhale ? 1500 : 950; f.Q.value = 0.9;
      const gn = ctx.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(gn); gn.connect(sfx); s.start(t, Math.random() * 0.1); s.stop(t + dur + 0.02);
    }
  };

  // Болельщики: гул всегда, аплодисменты и возгласы «у-у-у!» — гуще там, где больше людей (уровень 0…1)
  function cheer(t0, level) {
    const n = 2 + Math.floor(Math.random() * 3), vol = 0.02 + 0.03 * level;
    for (let i = 0; i < n; i++) {
      const s = t0 + Math.random() * 0.25, dur = 0.45 + Math.random() * 0.6, f0 = 210 + Math.random() * 260;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0, s); o.frequency.linearRampToValueAtTime(f0 * 1.35, s + dur * 0.35); o.frequency.linearRampToValueAtTime(f0 * 1.12, s + dur);
      const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5 + Math.random() * 2; vg.gain.value = f0 * 0.025; vib.connect(vg); vg.connect(o.frequency);
      const gn = ctx.createGain(); gn.gain.setValueAtTime(0.0001, s); gn.gain.exponentialRampToValueAtTime(vol, s + 0.08);
      gn.gain.setValueAtTime(vol, s + dur * 0.6); gn.gain.exponentialRampToValueAtTime(0.0001, s + dur);
      for (const [fq, q] of [[450, 6], [850, 8], [2600, 10]]) { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fq * (0.9 + Math.random() * 0.2); f.Q.value = q; o.connect(f); f.connect(gn); }
      gn.connect(amb); o.start(s); o.stop(s + dur + 0.05); vib.start(s); vib.stop(s + dur + 0.05);
    }
  }
  A.updateCrowd = function (level) {
    if (!ctx) return;
    const t = ctx.currentTime;
    bedGain.gain.setTargetAtTime(live() ? 0.05 + level * 0.13 : 0, t, 0.5);
    if (!live() || level < 0.02) { ambT = 0; return; }
    if (ambT < t) ambT = t;
    const dt = 1 / 50;
    while (ambT < t + 0.15) {
      if (Math.random() < level * 0.85) hiss(ambT + Math.random() * dt, 0.008 + Math.random() * 0.018, 0.04 + 0.07 * Math.random() * level, 800 + Math.random() * 1900, amb, 'bandpass');
      if (Math.random() < level * dt * 0.4) cheer(ambT, level);
      ambT += dt;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
