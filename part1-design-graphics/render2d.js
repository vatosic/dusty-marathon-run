/* DUSTY Marathon Run — псевдо-3D отрисовка на Canvas 2D */
(function (G) {
  'use strict';
  const D = G.DUSTY;
  const R = (D.Render2D = {});
  const clamp = D.clamp, lerp = D.lerp;
  const L = D.WORLD_LEN;
  const FAR = 270, FOG0 = 195;
  const PINK = '#ff2e93', VIOLET = '#6c2bd9', LIME = '#c8ff1a', INK = '#1e0b2e';

  let cv, ctx, W = 1, H = 1, dpr = 1, f = 600, baseF = 600, hor = 300, W2 = 0;
  const cam = { x: 0, y: 3.4, z: -6.9, back: 6.9 };
  let shirtTex = null, reduced = false, time = 0;
  const speedLines = [], bursts = [];

  /* ---------- утилиты ---------- */
  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return 'rgb(' + Math.round(lerp(A[0], B[0], t)) + ',' + Math.round(lerp(A[1], B[1], t)) + ',' + Math.round(lerp(A[2], B[2], t)) + ')';
  }
  function shade(h, k) { // k<0 темнее, k>0 светлее
    const c = hexToRgb(h);
    const t = k < 0 ? [0, 0, 0] : [255, 255, 255]; const a = Math.abs(k);
    return 'rgb(' + Math.round(lerp(c[0], t[0], a)) + ',' + Math.round(lerp(c[1], t[1], a)) + ',' + Math.round(lerp(c[2], t[2], a)) + ')';
  }
  const shadeCache = new Map();
  function sh(h, k) { const key = h + k; let v = shadeCache.get(key); if (!v) { v = shade(h, k); shadeCache.set(key, v); } return v; }
  const PX = (x, dz) => W2 + (x - cam.x) * f / dz;
  const PY = (y, dz) => hor + (cam.y - y) * f / dz;
  function fogA(dz) { return dz > FOG0 ? clamp((FAR - dz) / (FAR - FOG0), 0, 1) : 1; }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function ell(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, Math.max(0.0001, rx), Math.max(0.0001, ry), 0, 0, Math.PI * 2); }

  /* ---------- инициализация ---------- */
  R.init = function (canvas) {
    cv = canvas;
    ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D недоступен');
    reduced = !!(G.matchMedia && G.matchMedia('(prefers-reduced-motion: reduce)').matches);
    R.resize();
    shirtTex = R.makeShirt(440);
  };
  R.setReduced = (v) => { reduced = v; };
  R.resize = function () {
    if (!cv) return;
    dpr = Math.min(G.devicePixelRatio || 1, 2);
    const w = cv.clientWidth || G.innerWidth, h = cv.clientHeight || G.innerHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    W = w; H = h; W2 = W / 2;
    baseF = Math.min(H * 0.78, W * 1.6);
    hor = H * (W < H ? (H < 700 ? 0.43 : 0.37) : 0.4);
  };

  /* ---------- майка героя: текстура спины ---------- */
  R.makeShirt = function (w) {
    const h = Math.round(w * 1.3);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    const r = D.rng(2019);
    x.fillStyle = PINK; x.fillRect(0, 0, w, h);
    // фиолетовые пятна
    for (let i = 0; i < 26; i++) {
      const cx = r() * w, cy = r() * h, rad = (0.05 + r() * 0.11) * w;
      x.fillStyle = 'rgba(108,43,217,' + (0.45 + r() * 0.35) + ')';
      x.beginPath();
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2, rr2 = rad * (0.6 + r() * 0.5);
        const px = cx + Math.cos(a) * rr2, py = cy + Math.sin(a) * rr2 * 0.8;
        k ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.closePath(); x.fill();
    }
    // крупные кислотно-салатовые элементы
    x.fillStyle = LIME;
    x.beginPath(); x.moveTo(0, h * 0.06); x.lineTo(w * 0.34, 0); x.lineTo(w * 0.16, h * 0.2); x.lineTo(w * 0.3, h * 0.2); x.lineTo(0, h * 0.42); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(w, h * 0.5); x.lineTo(w * 0.8, h * 0.62); x.lineTo(w * 0.9, h * 0.64); x.lineTo(w * 0.72, h * 0.86); x.lineTo(w, h * 0.74); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(w * 0.62, 0); x.lineTo(w, 0); x.lineTo(w, h * 0.12); x.lineTo(w * 0.86, h * 0.07); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(0, h * 0.8); x.lineTo(w * 0.22, h * 0.9); x.lineTo(w * 0.1, h); x.lineTo(0, h); x.closePath(); x.fill();
    // брызги
    for (let i = 0; i < 14; i++) { x.beginPath(); x.arc(r() * w, r() * h, w * (0.008 + r() * 0.015), 0, 7); x.fill(); }
    // надпись
    const fam = '"Unbounded", "Arial Black", Impact, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.lineJoin = 'round';
    const txt = (s, y, size, wt) => {
      x.font = (wt || 800) + ' ' + size + 'px ' + fam;
      let sz = size; while (x.measureText(s).width > w * 0.9 && sz > 6) { sz -= 1; x.font = (wt || 800) + ' ' + sz + 'px ' + fam; }
      x.strokeStyle = INK; x.lineWidth = sz * 0.22; x.strokeText(s, w / 2, y);
      x.fillStyle = '#fff7fb'; x.fillText(s, w / 2, y);
    };
    txt('DUSTY', h * 0.2, w * 0.2);
    txt('DUMBBELLS', h * 0.29, w * 0.13);
    txt('ANONYMOUS RUNNING CLUB', h * 0.345, w * 0.065, 700);
    // клубный знак
    const ex = w / 2, ey = h * 0.56, er = w * 0.2;
    x.fillStyle = '#fff7fb'; x.beginPath(); x.arc(ex, ey, er, 0, 7); x.fill();
    x.strokeStyle = INK; x.lineWidth = w * 0.012; x.stroke();
    x.strokeStyle = PINK; x.lineWidth = w * 0.01; x.beginPath(); x.arc(ex, ey, er * 0.84, 0, 7); x.stroke();
    // гантель
    x.fillStyle = INK;
    x.fillRect(ex - er * 0.55, ey - er * 0.07, er * 1.1, er * 0.14);
    for (const s of [-1, 1]) {
      x.fillRect(ex + s * er * 0.45 - er * 0.08, ey - er * 0.34, er * 0.16, er * 0.68);
      x.fillRect(ex + s * er * 0.62 - er * 0.06, ey - er * 0.24, er * 0.12, er * 0.48);
    }
    x.font = '800 ' + (w * 0.06) + 'px ' + fam; x.fillStyle = INK; x.fillText('DDARC', ex, ey + er * 0.62);
    txt('est. 2019', h * 0.8, w * 0.085, 700);
    // складки ткани
    const gr = x.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, 'rgba(30,11,46,0.28)'); gr.addColorStop(0.18, 'rgba(30,11,46,0)'); gr.addColorStop(0.82, 'rgba(30,11,46,0)'); gr.addColorStop(1, 'rgba(30,11,46,0.28)');
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
    return c;
  };

  /* ---------- персонажи ---------- */
  // Бегун со спины. Координаты: метры, y вниз (0 — земля).
  function runnerBack(c, look, phase, tex, opts) {
    const sw = Math.sin(phase);
    const bob = Math.abs(Math.cos(phase)) * 0.045;
    c.translate(0, -bob);
    const skin = look.skin;
    // ноги
    for (const s of [-1, 1]) {
      const lift = Math.max(0, s * sw);
      const hx = s * 0.105, hy = -0.9;
      const kx = s * 0.13, ky = -0.5 - lift * 0.12;
      const fx = s * 0.115, fy = -0.04 - lift * 0.5;
      c.strokeStyle = skin; c.lineCap = 'round'; c.lineWidth = 0.13;
      c.beginPath(); c.moveTo(hx, hy); c.lineTo(kx, ky); c.lineTo(fx, fy); c.stroke();
      // носок + кроссовок
      c.fillStyle = '#fff'; c.fillRect(fx - 0.06, fy - 0.11, 0.12, 0.06);
      c.fillStyle = look.shoes; rr(c, fx - 0.075, fy - 0.06, 0.15, 0.1 + lift * 0.05, 0.035); c.fill();
      if (lift > 0.15) { c.fillStyle = sh(look.shoes, -0.35); c.fillRect(fx - 0.07, fy + 0.0, 0.14, 0.03 + lift * 0.04); }
    }
    // шорты
    c.fillStyle = look.shorts || '#1b1b22';
    c.beginPath(); c.moveTo(-0.2, -0.98); c.lineTo(0.2, -0.98); c.lineTo(0.23, -0.68); c.lineTo(0.02, -0.7); c.lineTo(0, -0.76); c.lineTo(-0.02, -0.7); c.lineTo(-0.23, -0.68); c.closePath(); c.fill();
    // руки (противофаза ногам)
    for (const s of [-1, 1]) {
      const a = -s * sw;
      const shx = s * 0.22, shy = -1.43;
      const ex = s * 0.31, ey = -1.18 + a * 0.06;
      const hx = s * 0.25, hy = -1.02 - a * 0.13;
      c.strokeStyle = skin; c.lineWidth = 0.085; c.lineCap = 'round';
      c.beginPath(); c.moveTo(shx, shy); c.lineTo(ex, ey); c.lineTo(hx, hy); c.stroke();
      // рукав
      c.strokeStyle = tex ? PINK : look.shirt; c.lineWidth = 0.13;
      c.beginPath(); c.moveTo(shx, shy); c.lineTo(lerp(shx, ex, 0.45), lerp(shy, ey, 0.45)); c.stroke();
    }
    // корпус
    if (tex) {
      c.save();
      c.beginPath(); c.moveTo(-0.25, -1.49); c.lineTo(0.25, -1.49); c.lineTo(0.215, -0.92); c.lineTo(-0.215, -0.92); c.closePath(); c.clip();
      c.drawImage(tex, -0.25, -1.52, 0.5, 0.65);
      c.restore();
    } else {
      c.fillStyle = look.shirt;
      c.beginPath(); c.moveTo(-0.24, -1.48); c.lineTo(0.24, -1.48); c.lineTo(0.205, -0.94); c.lineTo(-0.205, -0.94); c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(-0.205, -1.04, 0.41, 0.1);
      if (opts && opts.bib) { c.fillStyle = '#fff'; c.fillRect(-0.09, -1.3, 0.18, 0.12); }
    }
    // шея, голова
    c.fillStyle = skin; c.fillRect(-0.05, -1.56, 0.1, 0.1);
    c.fillStyle = look.hair; ell(c, 0, -1.67, 0.115, 0.125); c.fill();
    if (look.longHair && !look.cap) { c.fillStyle = look.hair; rr(c, -0.06, -1.66, 0.12, 0.26, 0.05); c.fill(); }
    if (look.cap || tex) {
      const cc = tex ? PINK : look.cap;
      c.fillStyle = cc;
      c.beginPath(); c.ellipse(0, -1.69, 0.125, 0.115, 0, Math.PI * 1.02, Math.PI * 1.98); c.lineTo(0.125, -1.66); c.lineTo(-0.125, -1.66); c.closePath(); c.fill();
      c.fillStyle = sh(cc, -0.3); c.fillRect(-0.035, -1.68, 0.07, 0.025);
      if (look.longHair) { c.fillStyle = look.hair; rr(c, -0.04, -1.67, 0.08, 0.22, 0.04); c.fill(); }
    }
    c.translate(0, bob);
  }

  // Человек лицом к камере: болельщики, фотографы, гуляющие
  function personFront(c, look, pose, t, ph, extra) {
    const k = t * (pose === 'dance' ? 5.5 : 3.2) + ph;
    let bob = 0, sway = 0, jumpY = 0;
    if (pose === 'jump') jumpY = Math.max(0, Math.sin(k * 1.4)) * 0.18;
    if (pose === 'dance') { bob = Math.abs(Math.sin(k)) * 0.06; sway = Math.sin(k * 0.5) * 0.08; }
    if (pose === 'walk') bob = Math.abs(Math.sin(k * 1.2)) * 0.03;
    if (reduced) { bob *= 0.3; jumpY *= 0.3; }
    c.translate(sway, -jumpY - bob);
    const skin = look.skin;
    // ноги
    c.strokeStyle = skin; c.lineWidth = 0.12; c.lineCap = 'round';
    for (const s of [-1, 1]) {
      let fy = 0, fx = s * 0.1;
      if (pose === 'walk') { const a = Math.sin(k * 1.2 + (s > 0 ? 0 : Math.PI)); fy = -Math.max(0, a) * 0.1; }
      if (pose === 'dance') fx += s * Math.max(0, Math.sin(k + (s > 0 ? 0 : Math.PI))) * 0.08;
      c.beginPath(); c.moveTo(s * 0.09, -0.85); c.lineTo(fx, fy - 0.05); c.stroke();
      c.fillStyle = look.shoes; rr(c, fx - 0.07, fy - 0.07, 0.14, 0.08, 0.03); c.fill();
    }
    // корпус / одежда
    if (look.swim) {
      if (look.sport === 'two') {
        c.fillStyle = look.shirt; c.fillRect(-0.17, -0.92, 0.34, 0.12);
        c.fillStyle = skin; c.fillRect(-0.16, -1.2, 0.32, 0.29);
        c.fillStyle = look.shirt; rr(c, -0.19, -1.46, 0.38, 0.27, 0.06); c.fill();
      } else {
        c.fillStyle = look.shirt; rr(c, -0.18, -1.46, 0.36, 0.64, 0.07); c.fill();
        c.fillStyle = sh(look.shirt, 0.25); c.fillRect(-0.18, -1.2, 0.36, 0.04);
      }
    } else {
      c.fillStyle = look.shorts || '#333'; c.fillRect(-0.19, -0.98, 0.38, 0.2);
      c.fillStyle = (extra && extra.vest) || look.shirt; rr(c, -0.22, -1.47, 0.44, 0.55, 0.06); c.fill();
      if (extra && extra.vest) { c.fillStyle = '#fff'; c.fillRect(-0.2, -1.22, 0.4, 0.04); }
    }
    // руки
    c.strokeStyle = skin; c.lineWidth = 0.08;
    const arm = (s, ex, ey, hx, hy) => { c.beginPath(); c.moveTo(s * 0.21, -1.42); c.lineTo(ex, ey); c.lineTo(hx, hy); c.stroke(); };
    if (pose === 'wave') {
      arm(-1, -0.3, -1.15, -0.26, -0.92);
      const w = Math.sin(k * 2.2) * 0.12;
      arm(1, 0.36, -1.62, 0.34 + w, -1.92);
      c.fillStyle = skin; ell(c, 0.34 + w, -1.95, 0.05, 0.06); c.fill();
    } else if (pose === 'cheer' || pose === 'jump') {
      const w = Math.sin(k * 2) * 0.06;
      arm(-1, -0.33, -1.68, -0.3 - w, -1.96); arm(1, 0.33, -1.68, 0.3 + w, -1.96);
    } else if (pose === 'clap') {
      const o = (Math.sin(k * 3.5) + 1) * 0.05;
      arm(-1, -0.28, -1.25, -0.03 - o, -1.32); arm(1, 0.28, -1.25, 0.03 + o, -1.32);
    } else if (pose === 'dance') {
      const a = Math.sin(k), b = Math.sin(k + 2);
      arm(-1, -0.34, -1.4 - a * 0.2, -0.3, -1.6 - a * 0.3); arm(1, 0.34, -1.4 - b * 0.2, 0.32, -1.62 - b * 0.3);
    } else if (pose === 'sign') {
      arm(-1, -0.3, -1.65, -0.24, -1.95); arm(1, 0.3, -1.65, 0.24, -1.95);
    } else if (pose === 'camera') {
      arm(-1, -0.26, -1.3, -0.08, -1.58); arm(1, 0.26, -1.3, 0.08, -1.58);
    } else if (pose === 'walk' || pose === 'stand') {
      const a = pose === 'walk' ? Math.sin(k * 1.2) * 0.07 : 0;
      if (extra && extra.chatArm) arm(1, 0.3, -1.22, 0.22, -1.38);
      else arm(1, 0.3, -1.15, 0.27, -0.92 + a);
      arm(-1, -0.3, -1.15, -0.27, -0.92 - a);
    }
    // голова
    c.fillStyle = skin; c.fillRect(-0.045, -1.55, 0.09, 0.1);
    if (look.longHair) { c.fillStyle = look.hair; rr(c, -0.14, -1.78, 0.28, 0.36, 0.1); c.fill(); }
    c.fillStyle = skin; ell(c, 0, -1.66, 0.105, 0.12); c.fill();
    c.fillStyle = look.hair; c.beginPath(); c.ellipse(0, -1.7, 0.112, 0.1, 0, Math.PI, 0); c.fill();
    if (look.cap) { c.fillStyle = look.cap; c.beginPath(); c.ellipse(0, -1.72, 0.12, 0.09, 0, Math.PI, 0); c.fill(); c.fillRect(-0.13, -1.73, 0.26, 0.03); }
    if (look.glasses) { c.fillStyle = '#111'; c.fillRect(-0.085, -1.68, 0.17, 0.035); }
    c.translate(-sway, jumpY + bob);
  }

  function dogSprite(c, dir, t) {
    c.scale(dir, 1);
    const k = t * 16;
    c.strokeStyle = '#6b4a2b'; c.lineWidth = 0.06; c.lineCap = 'round';
    const legs = [[-0.24, 0], [-0.16, Math.PI], [0.18, Math.PI * 0.5], [0.26, Math.PI * 1.5]];
    for (const [lx, p] of legs) { const s = Math.sin(k + p) * 0.09; c.beginPath(); c.moveTo(lx, -0.3); c.lineTo(lx + s, -0.02); c.stroke(); }
    c.fillStyle = '#c98b4e'; ell(c, 0, -0.36, 0.33, 0.13); c.fill();
    c.fillStyle = '#f2e3cf'; ell(c, 0.05, -0.3, 0.2, 0.06); c.fill();
    c.fillStyle = '#c98b4e'; ell(c, 0.34, -0.5, 0.12, 0.1); c.fill();
    ell(c, 0.44, -0.47, 0.08, 0.05); c.fill();
    c.fillStyle = '#5a3a20'; c.beginPath(); c.moveTo(0.29, -0.58); c.lineTo(0.27, -0.7); c.lineTo(0.35, -0.6); c.fill();
    c.fillStyle = '#111'; ell(c, 0.5, -0.48, 0.025, 0.02); c.fill(); ell(c, 0.37, -0.53, 0.018, 0.018); c.fill();
    c.fillStyle = PINK; c.fillRect(0.24, -0.47, 0.05, 0.08);
    c.strokeStyle = '#c98b4e'; c.lineWidth = 0.05;
    const tw = Math.sin(t * 20) * 0.08; c.beginPath(); c.moveTo(-0.32, -0.4); c.quadraticCurveTo(-0.45, -0.5, -0.42 + tw, -0.62); c.stroke();
    c.scale(dir, 1);
  }

  /* ---------- предметы и препятствия ---------- */
  function itemSprite(c, type, t, seed, variant) {
    const def = D.ITEMS[type];
    const bob = reduced ? 0 : Math.sin(t * 3 + seed) * 0.07;
    // светящийся столб — читается издалека
    const g = c.createLinearGradient(0, 0, 0, -3.2);
    g.addColorStop(0, def.color + '88'); g.addColorStop(1, def.color + '00');
    c.fillStyle = g; c.fillRect(-0.22, -3.2, 0.44, 3.2);
    c.fillStyle = def.color + '55'; ell(c, 0, 0, 0.5, 0.12); c.fill();
    c.translate(0, -0.85 + bob);
    // подложка-медальон
    c.fillStyle = 'rgba(255,255,255,0.92)'; ell(c, 0, 0, 0.36, 0.36); c.fill();
    c.strokeStyle = def.color; c.lineWidth = 0.07; c.stroke();
    const txt = (s2, x, y, size, col) => { c.fillStyle = col; c.font = '800 ' + size + 'px sans-serif'; c.textAlign = 'center'; c.fillText(s2, x, y); };
    switch (type) {
      case 'gel': {
        const lk = { sis: ['SiS', '#1f4fd1', '#fff'], gel4u: ['GEL4U', '#ff7a1a', INK], gu: ['GU', '#e8365a', '#fff'], maurten: ['MAURTEN', '#f1f1ec', '#15151a'] }[variant] || ['GEL', PINK, '#fff'];
        c.fillStyle = lk[1]; rr(c, -0.15, -0.22, 0.3, 0.42, 0.05); c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.02; c.stroke();
        c.fillStyle = INK; c.beginPath(); c.moveTo(-0.06, -0.22); c.lineTo(0.06, -0.22); c.lineTo(0.03, -0.3); c.lineTo(-0.03, -0.3); c.fill();
        txt(lk[0], 0, 0.03, lk[0].length > 4 ? 0.06 : 0.11, lk[2]);
        break;
      }
      case 'drink':
        if (variant === 'cola') {
          c.fillStyle = '#c8102e'; rr(c, -0.12, -0.22, 0.24, 0.42, 0.04); c.fill();
          c.fillStyle = '#d9d9de'; c.fillRect(-0.11, -0.25, 0.22, 0.04);
          txt('COLA', 0, 0.02, 0.075, '#fff');
        } else if (variant === 'iso') {
          c.fillStyle = '#ffb21a'; rr(c, -0.1, -0.2, 0.2, 0.42, 0.06); c.fill();
          c.fillStyle = INK; c.fillRect(-0.1, -0.06, 0.2, 0.11); c.fillRect(-0.05, -0.29, 0.1, 0.09);
          txt('ISO', 0, 0.025, 0.07, '#ffb21a');
        } else {
          c.fillStyle = '#7fd0ff'; rr(c, -0.1, -0.2, 0.2, 0.42, 0.06); c.fill();
          c.fillStyle = '#ffffff'; c.fillRect(-0.1, -0.05, 0.2, 0.08);
          c.fillStyle = '#1b6fd1'; c.fillRect(-0.05, -0.27, 0.1, 0.07);
        }
        break;
      case 'food':
        if (variant === 'orange') {
          c.fillStyle = '#ff8c1a'; ell(c, 0, 0, 0.2, 0.2); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.35)'; ell(c, -0.07, -0.07, 0.05, 0.04); c.fill();
          c.fillStyle = '#3f8a3a'; ell(c, 0.06, -0.21, 0.07, 0.03); c.fill();
        } else if (variant === 'burger') {
          c.fillStyle = '#d9913a'; c.beginPath(); c.ellipse(0, -0.04, 0.24, 0.17, 0, Math.PI, 0); c.fill();
          c.fillStyle = '#5fbf3a'; c.fillRect(-0.25, -0.04, 0.5, 0.05);
          c.fillStyle = '#ffcf3a'; c.fillRect(-0.23, 0.01, 0.46, 0.03);
          c.fillStyle = '#5a2e1a'; rr(c, -0.23, 0.04, 0.46, 0.07, 0.03); c.fill();
          c.fillStyle = '#d9913a'; rr(c, -0.22, 0.11, 0.44, 0.08, 0.04); c.fill();
          c.fillStyle = '#fff3d6'; for (let i = 0; i < 5; i++) { ell(c, -0.12 + i * 0.06, -0.12 - (i % 2) * 0.04, 0.012, 0.007); c.fill(); }
        } else {
          c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(0.02, -0.12, 0.25, 0.35, 2.75); c.arc(0.02, -0.26, 0.24, 2.6, 0.5, true); c.fill();
          c.fillStyle = '#6b4a2b'; c.fillRect(0.2, -0.07, 0.05, 0.05);
        }
        break;
      case 'boost':
        if (variant === 'magnesium') {
          c.fillStyle = '#39e27a'; rr(c, -0.22, -0.1, 0.44, 0.2, 0.1); c.fill();
          c.fillStyle = '#fff'; c.fillRect(0, -0.1, 0.22, 0.2);
          txt('Mg', -0.1, 0.05, 0.13, '#167a3c');
        } else if (variant === 'puer') {
          c.fillStyle = '#e9dcc6'; ell(c, 0, 0.14, 0.22, 0.05); c.fill();
          c.fillStyle = '#a04a26'; c.beginPath(); c.moveTo(-0.17, -0.06); c.lineTo(0.17, -0.06); c.lineTo(0.11, 0.13); c.lineTo(-0.11, 0.13); c.closePath(); c.fill();
          c.fillStyle = '#4a1c0c'; ell(c, 0, -0.06, 0.17, 0.035); c.fill();
          c.strokeStyle = 'rgba(160,160,160,0.7)'; c.lineWidth = 0.025; c.lineCap = 'round';
          for (const x of [-0.06, 0.05]) { c.beginPath(); c.moveTo(x, -0.1); c.quadraticCurveTo(x + 0.05, -0.17, x, -0.24); c.stroke(); }
        } else {
          c.fillStyle = '#8a4f22'; c.beginPath(); c.moveTo(-0.15, -0.12); c.lineTo(0.15, -0.12); c.lineTo(0.11, 0.18); c.lineTo(-0.11, 0.18); c.closePath(); c.fill();
          c.fillStyle = '#fff'; c.fillRect(-0.16, -0.17, 0.32, 0.06);
          c.fillStyle = LIME; c.beginPath(); c.moveTo(0.02, -0.08); c.lineTo(-0.06, 0.04); c.lineTo(0, 0.04); c.lineTo(-0.03, 0.14); c.lineTo(0.07, 0); c.lineTo(0.01, 0); c.closePath(); c.fill();
        }
        break;
      case 'pacer':
        c.fillStyle = VIOLET; c.beginPath(); c.moveTo(0, -0.26); c.lineTo(0.2, -0.16); c.lineTo(0.17, 0.08); c.lineTo(0, 0.22); c.lineTo(-0.17, 0.08); c.lineTo(-0.2, -0.16); c.closePath(); c.fill();
        txt('PACE', 0, 0.03, 0.13, '#fff');
        break;
    }
    c.translate(0, 0.85 - bob);
  }

  function obstacleSprite(c, o, t) {
    switch (o.type) {
      case 'puddle': {
        c.fillStyle = 'rgba(52,104,150,0.85)'; ell(c, 0, -0.02, 0.68, 0.17); c.fill();
        c.fillStyle = 'rgba(190,225,255,0.65)'; ell(c, -0.15, -0.05, 0.25, 0.04); c.fill();
        const rp = reduced ? 0.3 : (t * 0.8 + o.z) % 1;
        c.strokeStyle = 'rgba(255,255,255,' + (0.5 * (1 - rp)) + ')'; c.lineWidth = 0.025; ell(c, 0.2, -0.02, 0.1 + rp * 0.3, 0.03 + rp * 0.07); c.stroke();
        break;
      }
      case 'fanbarrier': {
        c.fillStyle = '#aab2bb';
        c.fillRect(-0.64, -0.66, 0.04, 0.66); c.fillRect(0.6, -0.66, 0.04, 0.66); c.fillRect(-0.64, -0.66, 1.28, 0.04); c.fillRect(-0.64, -0.12, 1.28, 0.03);
        for (let i = 1; i < 9; i++) c.fillRect(-0.62 + i * 0.14, -0.62, 0.02, 0.5);
        c.fillStyle = PINK; c.fillRect(-0.6, -0.57, 1.2, 0.3);
        c.fillStyle = LIME; c.fillRect(-0.6, -0.31, 1.2, 0.04);
        c.fillStyle = '#fff'; c.font = '800 0.17px sans-serif'; c.textAlign = 'center'; c.fillText('DUSTY', 0, -0.36);
        c.fillStyle = '#6b7480'; c.fillRect(-0.72, -0.03, 0.22, 0.03); c.fillRect(0.5, -0.03, 0.22, 0.03);
        break;
      }
      case 'scooter': {
        // самокат в профиль, едет влево; ездок стоит на деке
        c.fillStyle = '#1d1f26'; rr(c, -0.42, -0.2, 0.84, 0.06, 0.02); c.fill();
        c.fillRect(-0.4, -1.2, 0.05, 1.02); c.fillRect(-0.55, -1.22, 0.3, 0.05);
        for (const x of [-0.36, 0.36]) { c.fillStyle = '#1d1f26'; ell(c, x, -0.1, 0.1, 0.1); c.fill(); c.fillStyle = LIME; ell(c, x, -0.1, 0.04, 0.04); c.fill(); }
        c.save(); c.translate(0.05, -0.18); c.scale(0.92, 0.92);
        personFront(c, { skin: '#d9a07a', hair: '#1c1c1c', shirt: '#3a7bff', shorts: '#2f3a55', shoes: '#fff', cap: '#1e1e28' }, 'walk', 0, o.z);
        c.restore();
        break;
      }
      case 'volunteer': {
        personFront(c, { skin: '#e3b18c', hair: '#5a3a22', shirt: '#ff7a1a', shorts: '#2f3a55', shoes: '#222', cap: '#ffffff' }, 'stand', t, o.z, { vest: '#ff7a1a' });
        c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(-0.07, -1.12); c.lineTo(0.07, -1.12); c.lineTo(0.05, -0.98); c.lineTo(-0.05, -0.98); c.closePath(); c.fill();
        c.fillStyle = '#7fd0ff'; c.fillRect(-0.06, -1.12, 0.12, 0.03);
        c.fillStyle = INK; c.font = '800 0.07px sans-serif'; c.textAlign = 'center'; c.fillText('ВОЛОНТЁР', 0, -0.82);
        break;
      }
      case 'photographer': {
        personFront(c, { skin: '#e0ac85', hair: '#2b1d16', shirt: '#3a3a44', shorts: '#2f3a55', shoes: '#222', cap: '#1e1e28' }, o.walking ? 'walk' : 'camera', t, o.z, { vest: '#ffd23f' });
        c.fillStyle = '#1b1b1f'; rr(c, -0.13, -1.7, 0.26, 0.17, 0.03); c.fill();
        c.fillStyle = '#556'; ell(c, 0, -1.6, 0.06, 0.06); c.fill();
        c.fillStyle = '#fff'; c.fillRect(0.06, -1.72, 0.06, 0.03);
        c.fillStyle = INK; c.font = '800 0.075px sans-serif'; c.textAlign = 'center'; c.fillText('ПРЕССА', 0, -1.08);
        break;
      }
      case 'dog':
        dogSprite(c, o.dir || 1, t);
        break;
    }
  }

  /* ---------- окружение ---------- */
  function tree(c, o) {
    const h = o.h;
    c.fillStyle = '#5a4030'; c.fillRect(-0.12, -h * 0.45, 0.24, h * 0.45);
    const g1 = mix('#4f8a3c', '#2f6a35', o.tone), g2 = mix('#6aa84f', '#4f9a52', o.tone);
    if (o.kind === 'poplar') { c.fillStyle = g1; ell(c, 0, -h * 0.65, 0.8, h * 0.4); c.fill(); c.fillStyle = g2; ell(c, 0.2, -h * 0.72, 0.4, h * 0.28); c.fill(); }
    else { c.fillStyle = g1; ell(c, 0, -h * 0.68, 1.8, h * 0.32); c.fill(); c.fillStyle = g2; ell(c, 0.45, -h * 0.78, 1.0, h * 0.2); c.fill(); }
  }
  function lamp(c, side) {
    c.fillStyle = '#2d2f38'; c.fillRect(-0.06, -4.6, 0.12, 4.6);
    c.fillRect(-0.12, -0.3, 0.24, 0.3);
    c.beginPath(); c.moveTo(0, -4.5); c.quadraticCurveTo(-side * 0.1, -5, -side * 0.8, -4.95); c.lineWidth = 0.08; c.strokeStyle = '#2d2f38'; c.stroke();
    c.fillStyle = '#fff6d0'; ell(c, -side * 0.85, -4.85, 0.22, 0.12); c.fill();
  }
  function post(c) { c.fillStyle = '#9b8f86'; c.fillRect(-0.18, -1.25, 0.36, 1.25); c.fillStyle = '#c3b8ae'; c.fillRect(-0.22, -1.32, 0.44, 0.1); }

  function sign(c, text, color) {
    c.fillStyle = '#6b5a4a'; c.fillRect(-0.03, -2.6, 0.06, 1.2);
    c.font = '800 0.2px "Unbounded", sans-serif';
    const w = Math.max(0.9, c.measureText(text).width + 0.2);
    c.fillStyle = color || '#fff'; c.fillRect(-w / 2, -2.75, w, 0.42);
    c.fillStyle = color === PINK ? '#fff' : INK; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 0, -2.54);
    c.textBaseline = 'alphabetic';
  }
  function flag(c, t) {
    c.fillStyle = '#ddd'; c.fillRect(-0.02, -3.2, 0.04, 2);
    const w = reduced ? 0 : Math.sin(t * 4) * 0.05;
    c.fillStyle = PINK; c.beginPath(); c.moveTo(0, -3.2); c.quadraticCurveTo(0.4, -3.2 + w, 0.8, -3.15); c.lineTo(0.8, -2.7); c.quadraticCurveTo(0.4, -2.75 - w, 0, -2.75); c.fill();
    c.fillStyle = LIME; c.fillRect(0.1, -3.02, 0.6, 0.08);
  }

  function boat(c, b) {
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-6, -1); c.lineTo(6, -1); c.lineTo(5, 0.4); c.lineTo(-5.5, 0.4); c.closePath(); c.fill();
    c.fillStyle = b.kind === 0 ? '#2a5ea8' : b.kind === 1 ? '#c23b4a' : '#3b8a7a'; c.fillRect(-6, -0.2, 12, 0.35);
    c.fillStyle = '#e9edf2'; c.fillRect(-4, -2.4, 8, 1.4);
    c.fillStyle = '#2b3a4f'; for (let i = 0; i < 6; i++) c.fillRect(-3.6 + i * 1.25, -2.1, 0.8, 0.6);
    c.fillStyle = '#e9edf2'; c.fillRect(-1.5, -3.2, 3, 0.8);
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(-7, 0.35, 14, 0.12);
  }

  function arch(c, text, kind, t) {
    const colA = kind === 'finish' ? '#ffffff' : kind === 'start' ? VIOLET : kind === 'km' ? LIME : kind === 'luzh' ? '#ffffff' : PINK;
    c.fillStyle = colA; c.fillRect(-3.3, -5.6, 0.35, 5.6); c.fillRect(2.95, -5.6, 0.35, 5.6);
    c.fillStyle = kind === 'finish' ? INK : kind === 'start' || kind === 'km' ? VIOLET : kind === 'luzh' ? '#c8102e' : PINK;
    c.fillRect(-3.4, -5.9, 6.8, 1.25);
    if (kind === 'finish') {
      for (let i = 0; i < 17; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#fff' : INK; c.fillRect(-3.4 + i * 0.4, -4.85 + j * 0.2, 0.4, 0.2); }
    } else { c.fillStyle = LIME; c.fillRect(-3.4, -4.7, 6.8, 0.14); }
    c.fillStyle = kind === 'start' ? LIME : '#fff';
    c.font = '800 0.72px "Unbounded", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 0, -5.27); c.textBaseline = 'alphabetic';
    if (kind === 'dusty') {
      for (let i = 0; i < 9; i++) { const a = i / 9; c.fillStyle = i % 2 ? LIME : VIOLET; ell(c, -3.1 + a * 6.2, -5.95 - (reduced ? 0 : Math.abs(Math.sin(t * 3 + i)) * 0.1), 0.18, 0.22); c.fill(); }
    }
  }

  // Светомузыка точки Дасти: лучи веером и стробы в такт 128 BPM
  function raveLights(c, t, w, h, n) {
    if (reduced) return;
    const beat = t * 128 / 60, kick = Math.pow(1 - (beat % 1), 4), cols = ['255,46,147', '108,43,217', '200,255,26', '33,198,198', '255,122,26'];
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + Math.sin(t * (0.9 + (i % 3) * 0.25) + i * 1.3) * 0.9, x0 = -w / 2 + i * w / (n - 1);
      const gr = c.createLinearGradient(x0, -h, x0 + Math.cos(a) * 14, -h + Math.sin(a) * 14);
      gr.addColorStop(0, 'rgba(' + cols[(i + (Math.floor(beat) >> 2)) % 5] + ',' + (0.35 + 0.35 * kick) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gr; c.beginPath(); c.moveTo(x0, -h);
      c.lineTo(x0 + Math.cos(a - 0.09) * 14, -h + Math.sin(a - 0.09) * 14); c.lineTo(x0 + Math.cos(a + 0.09) * 14, -h + Math.sin(a + 0.09) * 14); c.closePath(); c.fill();
    }
    if (Math.floor(beat) % 4 === 0) { c.fillStyle = 'rgba(255,255,255,' + kick * 0.8 + ')'; for (const x of [-w / 2, w / 2]) { ell(c, x, -h, 0.4, 0.4); c.fill(); } }
    c.restore();
  }
  function raveSmall(c, t) {
    raveLights(c, t, 3, 4.3, 4);
    c.fillStyle = '#2a2a33'; c.fillRect(-1.5, -4.4, 0.22, 4.4); c.fillRect(1.3, -4.4, 0.22, 4.4); c.fillRect(-1.6, -4.5, 3.3, 0.3);
    c.fillStyle = INK; c.fillRect(-1.45, -4.15, 2.9, 0.6);
    c.fillStyle = LIME; c.font = '800 0.34px "Unbounded", sans-serif'; c.textAlign = 'center'; c.fillText('DUSTY RAVE', 0.05, -3.72);
    for (const x of [-2.2, 2.2]) { c.fillStyle = '#15151b'; c.fillRect(x - 0.45, -2.1, 0.9, 2.1); c.fillStyle = '#3a3a48'; ell(c, x, -1.45, 0.27, 0.27); c.fill(); ell(c, x, -0.6, 0.21, 0.21); c.fill(); }
  }

  function djBooth(c, t, level) {
    // LED-стена и светомузыка за шатром
    const beat = t * 128 / 60, kick = Math.pow(1 - (beat % 1), 4), hue = (beat * 12) % 360;
    c.fillStyle = '#05030a'; c.fillRect(-3.4, -6.8, 6.8, 3.6);
    c.fillStyle = 'hsla(' + hue + ',90%,50%,' + (0.3 + 0.4 * kick) + ')'; c.fillRect(-3.4, -6.8, 6.8, 3.6);
    for (let i = 0; i < 16; i++) { const v = 0.3 + 0.7 * Math.abs(Math.sin(t * (2 + i * 0.4) + i)); c.fillStyle = 'hsl(' + (hue + i * 14) % 360 + ',95%,60%)'; c.fillRect(-3.3 + i * 0.41, -3.3 - v * 1.4, 0.32, v * 1.4); }
    c.fillStyle = '#fff'; c.font = '800 0.9px "Unbounded", sans-serif'; c.textAlign = 'center'; c.fillText('DJ KIM', 0, -5.3);
    raveLights(c, t, 6.6, 6.9, 6);
    // шатёр Дасти
    c.fillStyle = PINK; c.beginPath(); c.moveTo(-2.4, -2.8); c.lineTo(0, -3.9); c.lineTo(2.4, -2.8); c.closePath(); c.fill();
    c.fillStyle = VIOLET; c.fillRect(-2.3, -2.85, 4.6, 0.25);
    c.fillStyle = '#ddd'; c.fillRect(-2.25, -2.6, 0.08, 2.6); c.fillRect(2.17, -2.6, 0.08, 2.6);
    // пульт
    c.fillStyle = '#1b1b22'; c.fillRect(-1.2, -1.05, 2.4, 1.05);
    c.fillStyle = LIME; c.font = '800 0.32px "Unbounded", sans-serif'; c.textAlign = 'center'; c.fillText('DUSTY', 0, -0.45);
    // диджей
    c.save(); c.translate(0, -0.6); c.scale(0.9, 0.9);
    personFront(c, { skin: '#e0ac85', hair: '#1c1c1c', shirt: VIOLET, shorts: '#111', shoes: '#fff', cap: PINK, glasses: true }, 'dance', t, 1);
    c.restore();
    c.fillStyle = '#333'; c.fillRect(-1, -1.15, 2, 0.12);
    // колонки
    const pump = 1 + (reduced ? 0 : level * 0.08 * Math.max(0, Math.sin(t * 13)));
    for (const s of [-1, 1]) {
      c.fillStyle = '#15151b'; c.fillRect(s * 1.9 - 0.4, -1.7, 0.8, 1.7);
      c.fillStyle = '#3a3a48'; ell(c, s * 1.9, -1.15, 0.26 * pump, 0.26 * pump); c.fill(); ell(c, s * 1.9, -0.45, 0.2 * pump, 0.2 * pump); c.fill();
    }
  }

  /* ---------- достопримечательности (силуэты-фасады, метры) ---------- */
  function windowsGrid(c, x0, y0, w, h, rows, cols, col) {
    c.fillStyle = col;
    const cw = w / cols, rh = h / rows;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) c.fillRect(x0 + j * cw + cw * 0.25, y0 + i * rh + rh * 0.25, cw * 0.5, rh * 0.45);
  }
  function dome(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.moveTo(x - r, y); c.quadraticCurveTo(x - r, y - r * 1.4, x, y - r * 2); c.quadraticCurveTo(x + r, y - r * 1.4, x + r, y); c.fill(); c.fillRect(x - r * 0.08, y - r * 2.8, r * 0.16, r * 0.8); c.fillRect(x - r * 0.3, y - r * 2.6, r * 0.6, r * 0.1); }
  const LM = {
    wtc(c) {
      c.fillStyle = '#d9dde2'; c.fillRect(-30, -14, 60, 14);
      windowsGrid(c, -30, -14, 60, 14, 3, 20, '#9aa7b4');
      c.fillStyle = '#eef0f2'; c.fillRect(-9, -72, 18, 72);
      c.fillStyle = '#a8b4c0'; for (let i = 0; i < 22; i++) c.fillRect(-9, -70 + i * 3.1, 18, 1.1);
      c.fillStyle = '#c9ced4'; c.fillRect(-6, -76, 12, 4);
    },
    whitehouse(c) {
      c.fillStyle = '#f4f4f0'; c.fillRect(-38, -20, 76, 20);
      windowsGrid(c, -38, -20, 76, 20, 6, 30, '#b8c2cc');
      c.fillStyle = '#f7f7f3'; c.fillRect(-10, -50, 20, 32);
      windowsGrid(c, -10, -48, 20, 28, 9, 6, '#b8c2cc');
      c.fillStyle = '#e0e0da'; c.fillRect(-7, -58, 14, 8);
      c.fillStyle = '#d4a63a'; ell(c, 0, -54, 2.6, 2.6); c.fill();
      c.fillStyle = '#ddd'; c.fillRect(-0.2, -66, 0.4, 8);
      c.fillStyle = '#fff'; c.fillRect(0.2, -66, 4, 0.9); c.fillStyle = '#1f4fbf'; c.fillRect(0.2, -65.1, 4, 0.9); c.fillStyle = '#d02a2a'; c.fillRect(0.2, -64.2, 4, 0.9);
    },
    mid(c) {
      const col = '#cdb58e', win = '#8a7458';
      c.fillStyle = col; c.fillRect(-32, -26, 64, 26); windowsGrid(c, -32, -26, 64, 26, 7, 22, win);
      c.fillRect(-18, -56, 36, 30); windowsGrid(c, -18, -56, 36, 30, 8, 12, win);
      c.fillStyle = col; c.fillRect(-10, -78, 20, 22); windowsGrid(c, -10, -76, 20, 20, 5, 6, win);
      c.fillStyle = sh(col, -0.1); c.fillRect(-6, -86, 12, 8);
      c.beginPath(); c.moveTo(-4, -86); c.lineTo(0, -108); c.lineTo(4, -86); c.fill();
      c.fillStyle = '#c9a23a'; c.fillRect(-0.3, -112, 0.6, 6);
    },
    rostov(c) {
      const cols = ['#f0d58a', '#e8b7a0', '#cfe0c8', '#f3e6c8', '#f5c9c9'];
      for (let i = 0; i < 5; i++) {
        const x = -40 + i * 16, h = 14 + (i % 2) * 4;
        c.fillStyle = cols[i]; c.fillRect(x, -h, 16, h);
        c.fillStyle = '#fff'; for (let j = 0; j < 4; j++) c.fillRect(x + 2 + j * 3.6, -h + 3, 0.9, h - 4);
        c.fillStyle = '#8a8f9c'; c.beginPath(); c.moveTo(x - 0.5, -h); c.lineTo(x + 8, -h - 4); c.lineTo(x + 16.5, -h); c.fill();
      }
    },
    silk(c) {
      c.fillStyle = '#a9452f'; c.fillRect(-36, -18, 72, 18);
      c.fillStyle = '#e8dccb'; for (let i = 0; i < 18; i++) { c.beginPath(); c.arc(-33 + i * 3.9, -12, 1.1, Math.PI, 0); c.lineTo(-31.9 + i * 3.9, -8); c.lineTo(-34.1 + i * 3.9, -8); c.fill(); }
      c.fillStyle = '#8e3d2c'; c.fillRect(-36, -19.5, 72, 1.5);
      c.fillStyle = '#a9452f'; c.beginPath(); c.moveTo(22, -18); c.lineTo(23, -44); c.lineTo(26, -44); c.lineTo(27, -18); c.fill();
      c.fillStyle = '#fff7fb'; c.font = '800 2.4px "Unbounded", sans-serif'; c.textAlign = 'center'; c.fillText('МОСКОВСКИЙ ШЁЛК', -6, -15);
    },
    novodevichy(c) {
      c.fillStyle = '#c8473a'; c.fillRect(-50, -9, 100, 9);
      c.fillStyle = '#f2ece2'; for (let i = 0; i < 34; i++) c.fillRect(-50 + i * 3, -10.4, 1.6, 1.4);
      for (const x of [-50, 48]) { c.fillStyle = '#c8473a'; c.fillRect(x - 2, -15, 6, 15); c.fillStyle = '#2f6a46'; c.beginPath(); c.moveTo(x - 2.5, -15); c.lineTo(x + 1, -22); c.lineTo(x + 4.5, -15); c.fill(); }
      // собор
      c.fillStyle = '#f4f1ea'; c.fillRect(-20, -26, 22, 17);
      dome(c, -9, -26, 3.2, '#d4a63a'); dome(c, -16, -26, 2, '#2b2b2b'); dome(c, -2, -26, 2, '#2b2b2b');
      // колокольня
      const tiers = [[10, -9, 8, 14], [11, -23, 6, 10], [12, -33, 4, 9], [12.6, -42, 2.8, 8]];
      for (const [x, y, w, h] of tiers) { c.fillStyle = '#f4f1ea'; c.fillRect(x, y - h, w, h); c.fillStyle = '#c8473a'; c.fillRect(x, y - h, w, 1); c.fillStyle = '#c8473a'; c.fillRect(x + w * 0.35, y - h + 2, w * 0.3, h - 3); }
      dome(c, 14, -50, 1.6, '#d4a63a');
    },
    luzhniki(c) {
      c.fillStyle = '#e9e9e4'; c.beginPath(); c.ellipse(0, -2, 56, 6, 0, Math.PI, 0); c.lineTo(56, 0); c.lineTo(-56, 0); c.fill();
      c.fillStyle = '#f4f4f0'; c.fillRect(-52, -24, 104, 22);
      c.fillStyle = '#cfd3d6'; for (let i = 0; i < 26; i++) c.fillRect(-50 + i * 4, -22, 1.4, 20);
      c.fillStyle = '#d7dbe0'; c.beginPath(); c.ellipse(0, -24, 54, 5, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#b9c0c7'; c.fillRect(-52, -25, 104, 1.4);
      c.fillStyle = INK; c.font = '800 3.2px "Unbounded", sans-serif'; c.textAlign = 'center'; c.fillText('ЛУЖНИКИ', 0, -12);
      for (const x of [-44, 44]) { c.fillStyle = '#9aa3ad'; c.fillRect(x, -40, 0.8, 18); c.fillStyle = '#fff6d0'; c.fillRect(x - 2, -42, 4.8, 2); }
    },
    mod(c) {
      const col = '#d8c7a0';
      c.fillStyle = col; c.fillRect(-55, -28, 110, 28);
      windowsGrid(c, -55, -26, 110, 24, 7, 40, '#9a8668');
      c.fillStyle = sh(col, 0.1); c.fillRect(-16, -36, 32, 36);
      c.fillStyle = '#f0e6d0'; for (let i = 0; i < 8; i++) c.fillRect(-14 + i * 4, -30, 1.4, 28);
      c.fillStyle = sh(col, -0.15); c.beginPath(); c.moveTo(-17, -36); c.lineTo(0, -41); c.lineTo(17, -36); c.fill();
    },
    hhs(c) {
      c.fillStyle = '#f7f5ef'; c.fillRect(-26, -32, 52, 32);
      c.fillStyle = '#e4dfd2'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-17 + i * 17, -32, 7, Math.PI, 0); c.fill(); }
      c.fillStyle = '#d2c9b6'; for (let i = 0; i < 7; i++) c.fillRect(-23 + i * 7.3, -26, 2.2, 14);
      c.fillStyle = '#f7f5ef'; c.fillRect(-11, -50, 22, 18);
      c.fillStyle = '#d2c9b6'; for (let i = 0; i < 6; i++) c.fillRect(-9 + i * 3.7, -47, 1.4, 11);
      dome(c, 0, -50, 11, '#e0b23c');
      for (const x of [-21, 21]) { c.fillStyle = '#f7f5ef'; c.fillRect(x - 3, -40, 6, 8); dome(c, x, -40, 3, '#e0b23c'); }
    },
    palace(c) {
      c.fillStyle = '#efe2b8'; c.fillRect(-55, -24, 110, 24);
      windowsGrid(c, -55, -22, 110, 20, 3, 34, '#f8f4ea');
      c.fillStyle = '#4c8a64'; c.fillRect(-56, -26, 112, 2.4);
      c.fillStyle = '#efe2b8'; c.fillRect(-8, -32, 16, 8); c.fillStyle = '#4c8a64'; c.beginPath(); c.moveTo(-8, -32); c.lineTo(0, -37); c.lineTo(8, -32); c.fill();
      // Иван Великий
      c.fillStyle = '#f4f1ea'; c.fillRect(24, -60, 8, 60); c.fillRect(25, -70, 6, 10);
      dome(c, 28, -70, 3.2, '#e0b23c');
      dome(c, 40, -28, 3.2, '#e0b23c'); dome(c, 46, -28, 2.2, '#e0b23c');
    }
  };

  function kremlinTower(c, tall) {
    const h = tall ? 20 : 14;
    c.fillStyle = '#b8402f'; c.fillRect(-2.6, -h, 5.2, h);
    c.fillStyle = '#f2ece2'; c.fillRect(-2.6, -h * 0.62, 5.2, 0.5); c.fillRect(-2.6, -h, 5.2, 0.5);
    c.fillStyle = '#a63a2a'; c.fillRect(-1.9, -h - 4, 3.8, 4);
    c.fillStyle = '#2f6a46'; c.beginPath(); c.moveTo(-2.2, -h - 4); c.lineTo(0, -h - 13); c.lineTo(2.2, -h - 4); c.fill();
    c.fillStyle = '#e0473a'; c.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.45 : 1.05; c.lineTo(Math.cos(a) * r, -h - 14.2 + Math.sin(a) * r); }
    c.fill();
  }

  /* ---------- небо и фон ---------- */
  function drawSky(g, km) {
    const late = clamp((km - 26) / 16, 0, 1);
    const top = mix('#3d8fe0', '#4f7fcf', late), mid = mix('#9fd0f2', '#f2c9a0', late), horc = mix('#dcecf4', '#ffe1b8', late);
    const gr = ctx.createLinearGradient(0, 0, 0, hor);
    gr.addColorStop(0, top); gr.addColorStop(0.7, mid); gr.addColorStop(1, horc);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, hor + 2);
    // солнце
    const sx = W * 0.8, sy = hor * lerp(0.25, 0.55, late);
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.25);
    sg.addColorStop(0, 'rgba(255,250,225,0.95)'); sg.addColorStop(0.08, 'rgba(255,245,210,0.8)'); sg.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, hor);
    // облака
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 5; i++) {
      const x = ((i * 0.27 + time * 0.004 + g.pz * 0.00004) % 1.3 - 0.15) * W;
      const y = hor * (0.15 + (i % 3) * 0.16);
      const s = H * 0.03 * (1 + (i % 2) * 0.5);
      ell(ctx, x, y, s * 3, s * 0.7); ctx.fill(); ell(ctx, x + s * 1.2, y - s * 0.4, s * 1.6, s * 0.8); ctx.fill();
    }
    return horc;
  }

  function drawBackdrop(g, km, horc) {
    const sx = -cam.x * 4;
    // далёкий город
    ctx.fillStyle = mix('#a9b9c9', '#d4b6a2', clamp((km - 26) / 16, 0, 1));
    const r = D.rng(77);
    ctx.beginPath(); ctx.moveTo(0, hor);
    for (let x = -40; x < W + 40; x += 18 + r() * 26) { const h = H * (0.012 + r() * 0.04); ctx.lineTo(x + sx * 0.3, hor - h); ctx.lineTo(x + 22 + sx * 0.3, hor - h); }
    ctx.lineTo(W, hor); ctx.fill();
    // Москва-Сити в перспективе
    const cityA = clamp(1 - km / 10, 0, 1) * 0.95;
    if (cityA > 0.01) {
      ctx.globalAlpha = cityA;
      const bx = W2 - W * 0.22 + sx, sc = H * 0.0028 * (1.15 - km / 20);
      const towers = [[-26, 70, '#5f88b0'], [-14, 92, '#6d95bd'], [-3, 118, '#4f7aa4'], [9, 100, '#7aa3c6'], [20, 80, '#5d84ab'], [30, 62, '#88aed0'], [-36, 50, '#7092b4']];
      for (const [x, h, col] of towers) {
        ctx.fillStyle = col; ctx.fillRect(bx + x * sc, hor - h * sc, 10 * sc, h * sc);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(bx + x * sc + 6 * sc, hor - h * sc, 2 * sc, h * sc);
      }
      ctx.globalAlpha = 1;
    }
    // Воробьёвы горы и МГУ на другом берегу (район Лужников)
    const mguA = clamp(1 - Math.abs(km - 25) / 5, 0, 1);
    if (mguA > 0.01) {
      ctx.globalAlpha = mguA;
      const bx = W2 + W * 0.3 + sx, sc = H * 0.0024;
      ctx.fillStyle = '#6f9a68'; ell(ctx, bx, hor, W * 0.4, H * 0.05); ctx.fill();
      ctx.fillStyle = '#d8d0bf';
      ctx.fillRect(bx - 40 * sc, hor - 60 * sc, 80 * sc, 22 * sc); ctx.fillRect(bx - 14 * sc, hor - 100 * sc, 28 * sc, 50 * sc); ctx.fillRect(bx - 7 * sc, hor - 125 * sc, 14 * sc, 30 * sc);
      ctx.beginPath(); ctx.moveTo(bx - 4 * sc, hor - 125 * sc); ctx.lineTo(bx, hor - 160 * sc); ctx.lineTo(bx + 4 * sc, hor - 125 * sc); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Кремль приближается
    const kA = clamp((km - 35) / 3, 0, 1);
    if (kA > 0.01) {
      ctx.globalAlpha = kA;
      const sc = H * 0.0012 * (1 + clamp((km - 35) / 7, 0, 1) * 1.6);
      const bx = W2 - W * 0.06 + sx;
      ctx.fillStyle = '#b8402f'; ctx.fillRect(bx - 160 * sc, hor - 14 * sc, 320 * sc, 14 * sc);
      for (const [x, h] of [[-150, 40], [-80, 34], [-10, 52], [60, 36], [130, 44]]) {
        ctx.fillStyle = '#b8402f'; ctx.fillRect(bx + (x - 6) * sc, hor - h * sc, 12 * sc, h * sc);
        ctx.fillStyle = '#2f6a46'; ctx.beginPath(); ctx.moveTo(bx + (x - 7) * sc, hor - h * sc); ctx.lineTo(bx + x * sc, hor - (h + 22) * sc); ctx.lineTo(bx + (x + 7) * sc, hor - h * sc); ctx.fill();
        ctx.fillStyle = '#e0473a'; ell(ctx, bx + x * sc, hor - (h + 25) * sc, 2.4 * sc, 2.4 * sc); ctx.fill();
      }
      ctx.fillStyle = '#e0b23c';
      for (const [x, r2] of [[20, 9], [36, 7], [48, 6]]) { ell(ctx, bx + x * sc, hor - 40 * sc, r2 * sc, r2 * 1.2 * sc); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    // дымка
    const hz = ctx.createLinearGradient(0, hor - H * 0.08, 0, hor + 4);
    hz.addColorStop(0, 'rgba(255,255,255,0)'); hz.addColorStop(1, horc);
    ctx.fillStyle = hz; ctx.fillRect(0, hor - H * 0.08, W, H * 0.08 + 4);
  }

  /* ---------- земля, дорога, вода ---------- */
  function band(x1, x2, y, zn, zf) {
    const dn = zn - cam.z, df = zf - cam.z;
    ctx.moveTo(PX(x1, df), PY(y, df)); ctx.lineTo(PX(x2, df), PY(y, df));
    ctx.lineTo(PX(x2, dn), PY(y, dn)); ctx.lineTo(PX(x1, dn), PY(y, dn)); ctx.closePath();
  }
  function vband(x, y1, y2, zn, zf) {
    const dn = zn - cam.z, df = zf - cam.z;
    ctx.moveTo(PX(x, df), PY(y1, df)); ctx.lineTo(PX(x, df), PY(y2, df));
    ctx.lineTo(PX(x, dn), PY(y2, dn)); ctx.lineTo(PX(x, dn), PY(y1, dn)); ctx.closePath();
  }

  function drawGround(g, km, horc) {
    const zn = cam.z + 0.7, zf = cam.z + FAR;
    // вода
    const wy = PY(-2.5, FAR);
    const wg = ctx.createLinearGradient(0, wy, 0, H);
    wg.addColorStop(0, mix('#8db9cc', '#c9b6a6', clamp((km - 26) / 16, 0, 1))); wg.addColorStop(0.25, '#3f7f9c'); wg.addColorStop(1, '#255d78');
    ctx.fillStyle = wg; ctx.fillRect(W2, wy, W2, H - wy);
    // противоположный берег
    ctx.fillStyle = mix('#8ea0a6', '#6f9a68', clamp(1 - Math.abs(km - 25) / 4, 0, 1));
    ctx.beginPath(); vband(75, -2.5, 6, zn + 30, zf); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); vband(75, -2.5, -1.8, zn + 30, zf); ctx.fill();
    // блики на воде
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineCap = 'round';
    const z0 = Math.floor(cam.z / 5) * 5;
    for (let i = 1; i < 52; i++) {
      const z = z0 + i * 5, dz = z - cam.z; if (dz < 2) continue;
      for (let j = 0; j < 3; j++) {
        const h = Math.sin(z * 12.9898 + j * 78.233) * 43758.5453; const fr = h - Math.floor(h);
        const x = 8 + fr * 62;
        const a = reduced ? 0.4 : 0.5 + 0.5 * Math.sin(time * 2.2 + fr * 30);
        if (a < 0.15) continue;
        ctx.globalAlpha = a * fogA(dz) * 0.8;
        ctx.lineWidth = Math.max(0.6, 0.12 * f / dz);
        const sx = PX(x, dz), sy = PY(-2.5, dz), len = (0.8 + fr * 1.6) * f / dz;
        ctx.beginPath(); ctx.moveTo(sx - len, sy); ctx.lineTo(sx + len, sy); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // левая сторона по районам
    let z = zf; let curCol = null;
    ctx.beginPath();
    const step = 12;
    let zz = Math.ceil(zf / step) * step;
    while (zz > zn) {
      const za = Math.max(zn, zz - step);
      const col = D.DISTRICTS[D.findDistrict(clamp(D.zToKm(za), 0, 42.19))].ground;
      if (col !== curCol) { if (curCol) { ctx.fillStyle = curCol; ctx.fill(); ctx.beginPath(); } curCol = col; }
      band(-400, -7.5, 0, za, Math.min(zz, zf));
      zz = za;
    }
    ctx.fillStyle = curCol; ctx.fill();
    // тротуар, бордюры, дорога, набережная
    ctx.fillStyle = '#bdb5a8'; ctx.beginPath(); band(-7.5, -2.75, 0, zn, zf); ctx.fill();
    ctx.fillStyle = '#d8d1c4'; ctx.beginPath(); band(-2.75, -2.45, 0, zn, zf); band(2.45, 2.75, 0, zn, zf); ctx.fill();
    ctx.fillStyle = '#4a4b55'; ctx.beginPath(); band(-2.45, 2.45, 0, zn, zf); ctx.fill();
    ctx.fillStyle = '#ab9f95'; ctx.beginPath(); band(2.75, 6.2, 0, zn, zf); ctx.fill();
    // полосы движения (лёгкая текстура асфальта и плитки)
    ctx.beginPath();
    const s4 = 4; let k = Math.floor(zn / s4);
    for (let zq = k * s4; zq < Math.min(zf, cam.z + 120); zq += s4) {
      if (((zq / s4) & 1) === 0) continue;
      const a = Math.max(zq, zn), b = zq + s4; if (b <= zn) continue;
      band(-2.45, 2.45, 0, a, b);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.07)'; ctx.fill();
    ctx.beginPath();
    for (let zq = k * s4; zq < Math.min(zf, cam.z + 120); zq += s4) {
      if (((zq / s4) & 1) === 1) continue;
      const a = Math.max(zq, zn), b = zq + s4; if (b <= zn) continue;
      band(2.75, 6.2, 0, a, b); band(-7.5, -2.75, 0, a, b);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fill();
    // едва заметные границы игровых полос
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.beginPath();
    for (const lx of [-0.725, 0.725]) band(lx - 0.04, lx + 0.04, 0, zn, Math.min(zf, cam.z + 160));
    ctx.fill();
    // Лужники: беговое покрытие с белыми линиями вместо асфальта
    const ta = Math.max(zn, D.kmToZ(D.TRACK_KM[0])), tb = Math.min(zf, D.kmToZ(D.TRACK_KM[1]));
    if (tb > ta) {
      ctx.fillStyle = '#b4452f'; ctx.beginPath(); band(-2.45, 2.45, 0, ta, tb); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath();
      for (const lx of [-2.28, -0.725, 0.725, 2.28]) band(lx - 0.03, lx + 0.03, 0, ta, Math.min(tb, cam.z + 160));
      ctx.fill();
    }
    // гранитный парапет
    ctx.fillStyle = '#8c7f78'; ctx.beginPath(); vband(6.2, 0, 1.0, zn, zf); ctx.fill();
    ctx.fillStyle = '#c0b4aa'; ctx.beginPath(); band(6.2, 6.9, 1.0, zn, zf); ctx.fill();
    // дымка поверх дали
    const hz = ctx.createLinearGradient(0, hor, 0, hor + H * 0.06);
    hz.addColorStop(0, horc); hz.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hz; ctx.fillRect(0, hor - 1, W, H * 0.06 + 1);
  }

  /* ---------- здания ---------- */
  function drawBuilding(b) {
    const z0 = Math.max(b.z, cam.z + 0.7), z1 = b.z + b.len;
    if (z1 <= z0) return;
    const dn = z0 - cam.z, df = z1 - cam.z;
    if (dn > FAR) return;
    ctx.globalAlpha = fogA(dn);
    // торец к камере
    if (b.z > cam.z + 0.7) {
      ctx.fillStyle = sh(b.color, -0.22); ctx.beginPath();
      ctx.moveTo(PX(b.xf, dn), PY(0, dn)); ctx.lineTo(PX(b.xf, dn), PY(b.h, dn)); ctx.lineTo(PX(b.xf - b.depth, dn), PY(b.h, dn)); ctx.lineTo(PX(b.xf - b.depth, dn), PY(0, dn)); ctx.closePath(); ctx.fill();
    }
    // фасад к дороге
    ctx.fillStyle = b.color; ctx.beginPath(); vband(b.xf, 0, b.h, z0, z1); ctx.fill();
    if (b.kremlin) {
      if (dn < 140) {
        ctx.fillStyle = b.color; ctx.beginPath();
        for (let z = Math.ceil(z0 / 1.6) * 1.6; z < z1; z += 1.6) {
          const a = z - cam.z, c2 = z + 0.8 - cam.z;
          ctx.moveTo(PX(b.xf, a), PY(b.h, a)); ctx.lineTo(PX(b.xf, a), PY(b.h + 0.9, a)); ctx.lineTo(PX(b.xf, c2), PY(b.h + 0.9, c2)); ctx.lineTo(PX(b.xf, c2), PY(b.h, c2)); ctx.closePath();
        }
        ctx.fill();
      }
    } else if (dn < 170) {
      // этажи и окна
      ctx.strokeStyle = sh(b.color, -0.28); ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i <= b.floors; i++) { const y = i * (b.h / (b.floors + 0.5)); ctx.moveTo(PX(b.xf, dn), PY(y, dn)); ctx.lineTo(PX(b.xf, df), PY(y, df)); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(40,50,70,0.35)'; ctx.lineWidth = Math.max(1, 1.2 * f / (dn + 20));
      ctx.beginPath();
      for (let j = 1; j < b.cols; j++) { const zc = b.z + (j / b.cols) * b.len; if (zc < z0) continue; const d = zc - cam.z; ctx.moveTo(PX(b.xf, d), PY(1, d)); ctx.lineTo(PX(b.xf, d), PY(b.h - 1, d)); }
      ctx.stroke();
      ctx.fillStyle = sh(b.color, -0.35); ctx.beginPath(); vband(b.xf, 0, 3.2, z0, z1); ctx.fill();
    }
    if (b.roof) { ctx.fillStyle = sh(b.color, -0.4); ctx.beginPath(); vband(b.xf + 0.01, b.h, b.h + 1.2, z0, z1); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  function drawBridge(br) {
    const zb = br.z, d0 = zb - cam.z;
    const zu0 = Math.max(zb, cam.z + 0.7), zu1 = zb + 9;
    if (zu1 <= zu0) return;
    const colors = ['#8e98a3', '#b9a58d', '#6f8f85'];
    const col = colors[br.variant];
    ctx.globalAlpha = fogA(Math.max(d0, 1));
    // нижняя плоскость пролёта
    ctx.fillStyle = sh(col, -0.45); ctx.beginPath(); band(-12, 80, 5.6, zu0, zu1); ctx.fill();
    if (d0 > 0.7) {
      const s = f / d0;
      ctx.save(); ctx.translate(PX(0, d0), PY(0, d0)); ctx.scale(s, s);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.rect(-12, -7.8, 92, 2.2);
      ctx.rect(-12, -5.6, 8.6, 5.6); ctx.rect(5.8, -5.6, 1.6, 5.6);
      // арки над рекой
      for (let i = 0; i < 4; i++) {
        const x0 = 7.4 + i * 18;
        ctx.moveTo(x0, -5.6); ctx.lineTo(x0 + 18, -5.6); ctx.lineTo(x0 + 18, 2.5); ctx.lineTo(x0 + 16, 2.5);
        ctx.quadraticCurveTo(x0 + 9, -7, x0 + 2, 2.5); ctx.lineTo(x0, 2.5); ctx.closePath();
      }
      ctx.fill();
      ctx.fillStyle = sh(col, 0.25); ctx.fillRect(-12, -8.3, 92, 0.5);
      ctx.fillStyle = sh(col, -0.2); for (let x = -12; x < 80; x += 1.4) ctx.fillRect(x, -9.1, 0.12, 0.8);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- главный рендер ---------- */
  const drawList = [];
  function push(z, kind, o, x) { drawList.push({ z, kind, o, x }); }

  R.render = function (g, dt, state) {
    time += dt;
    const km = D.zToKm(g.pz);
    // камера: плавное следование, лёгкая динамика при ускорении
    const boost = g.boostT > 0 ? 1 : 0;
    const back = 6.9 + (reduced ? 0 : boost * 0.5 + clamp((g.speed - 15) / 10, 0, 0.6) * 0.5);
    cam.back += (back - cam.back) * Math.min(1, dt * 2.5);
    cam.z = g.pz - cam.back;
    cam.x += (g.px * 0.55 - cam.x) * Math.min(1, dt * 5);
    cam.y += (3.4 + g.y * 0.35 - cam.y) * Math.min(1, dt * 6);
    const ftarget = baseF * (reduced ? 1 : 1 - 0.05 * boost);
    f += (ftarget - f) * Math.min(1, dt * 3);
    if (!isFinite(f) || f <= 0) f = baseF;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const horc = drawSky(g, km);
    drawBackdrop(g, km, horc);
    drawGround(g, km, horc);

    // слой: здания и ориентиры слева
    const sc = g.scenery;
    drawList.length = 0;
    const zMin = cam.z - 40, zMax = cam.z + FAR;
    for (const b of sc.buildings) { if (b.z + b.len < cam.z || b.z > zMax) continue; push(b.z, 'bld', b); }
    for (const l of sc.landmarks) { if (l.z < cam.z + 45 || l.z > zMax + 60) continue; push(l.z, 'lm', l); }
    for (const t of sc.towers) { if (t.z < cam.z + 2 || t.z > zMax) continue; push(t.z, 'tower', t); }
    drawList.sort((a, b) => b.z - a.z);
    for (const d of drawList) {
      if (d.kind === 'bld') drawBuilding(d.o);
      else {
        const dz = d.z - cam.z, s = f / dz;
        ctx.globalAlpha = d.kind === 'lm' ? Math.min(clamp((FAR + 60 - dz) / 80, 0, 1), clamp((dz - 45) / 45, 0, 1)) : fogA(dz);
        const k = d.kind === 'lm' ? clamp(W / H * 1.25, 0.5, 1) : 1; // узкий экран: ориентиры ближе и компактнее
        const kx = d.kind === 'lm' ? clamp(W / H, 0.4, 1) : 1;
        ctx.save(); ctx.translate(PX(d.o.x * kx, dz), PY(0, dz)); ctx.scale(s * k, s * k);
        if (d.kind === 'lm') LM[d.o.kind](ctx); else kremlinTower(ctx, d.o.tall);
        ctx.restore(); ctx.globalAlpha = 1;
      }
    }

    // основной слой
    drawList.length = 0;
    const inR = (z) => z > cam.z + 0.8 && z < zMax;
    for (const t of sc.trees) if (inR(t.z)) push(t.z, 'tree', t);
    for (const l of sc.lamps) if (inR(l.z)) push(l.z, 'lamp', l);
    for (const p of sc.posts) if (inR(p.z) && p.z - cam.z < 150) push(p.z, 'post', p);
    for (const b of sc.bridges) if (b.z + 9 > cam.z + 0.7 && b.z < zMax) push(Math.max(b.z, cam.z + 0.8), 'bridge', b);
    for (const b of sc.boats) { const z = b.z0 + b.v * g.t; if (inR(z)) push(z, 'boat', b, z); }
    // болельщики: бинарный поиск по отсортированному списку
    let lo = 0, hi = sc.fans.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (sc.fans[m].z < cam.z + 0.8) lo = m + 1; else hi = m; }
    for (let i = lo; i < sc.fans.length && sc.fans[i].z < cam.z + 170; i++) push(sc.fans[i].z, 'fan', sc.fans[i]);
    for (const w of sc.walkers) {
      let z = w.z0 + w.v * g.t;
      if (w.range) { const p = ((w.v * g.t) % (w.range * 2) + w.range * 2) % (w.range * 2); z = w.z0 + (p < w.range ? p : w.range * 2 - p); w.dirNow = p < w.range ? Math.sign(w.v) : -Math.sign(w.v); }
      else w.dirNow = Math.sign(w.v);
      if (inR(z) && z - cam.z < 160) push(z, 'walker', w, z);
    }
    if (inR(sc.dj.z)) { push(sc.dj.z, 'dj', sc.dj); }
    for (const rv of sc.raves) if (!rv.main && inR(rv.z)) push(rv.z, 'rave', rv);
    if (inR(sc.dj.z - 6)) push(sc.dj.z - 6, 'arch', { text: 'DUSTY', kind: 'dusty' });
    if (inR(L)) push(L, 'arch', { text: 'ФИНИШ', kind: 'finish' });
    if (inR(4)) push(4, 'arch', { text: 'СТАРТ', kind: 'start' });
    const luzhZ = D.kmToZ(D.TRACK_KM[0]) - 1.5;
    if (inR(luzhZ)) push(luzhZ, 'arch', { text: 'ЛУЖНИКИ', kind: 'luzh' });
    for (const k of D.KM_MARKS) if (inR(D.kmToZ(k))) push(D.kmToZ(k), 'arch', { text: k + ' КМ', kind: 'km' });
    const objs = g.plan.objs;
    for (let i = Math.max(0, g.objIdx - 2); i < objs.length; i++) {
      const o = objs[i]; if (o.z > zMax) break;
      if (!inR(o.z) || o.taken || o.z < g.pz - 1.2) continue;
      push(o.z, o.kind === 'item' ? (o.type === 'highfive' ? 'hf' : 'item') : 'obs', o);
    }
    const labels = [];
    const vis = [];
    for (const rv of g.rivals) { const dz = rv.z - cam.z; if (dz > 0.8 && dz < 165) vis.push(rv); }
    vis.sort((a, b) => Math.abs(a.z - g.pz) - Math.abs(b.z - g.pz));
    for (let i = 0; i < Math.min(14, vis.length); i++) push(vis[i].z, 'rival', vis[i]);
    if (g.pacerT > 0) push(g.pz + 2.6, 'pacer', null);
    push(g.pz, 'player', null);
    drawList.sort((a, b) => b.z - a.z);

    const musicLevel = state.musicLevel || 0;
    for (const d of drawList) {
      const dz = d.z - cam.z; if (dz < 0.8) continue;
      const s = f / dz; const a = fogA(dz);
      const o = d.o;
      const at = (x, y) => { ctx.save(); ctx.globalAlpha = a; ctx.translate(PX(x, dz), PY(y || 0, dz)); ctx.scale(s, s); };
      switch (d.kind) {
        case 'tree': at(o.x); tree(ctx, o); ctx.restore(); break;
        case 'lamp': at(o.x); lamp(ctx, o.side); ctx.restore(); break;
        case 'post': at(6.55, 0); post(ctx); ctx.restore(); break;
        case 'bridge': drawBridge(o); break;
        case 'boat': at(o.x, -2.5); ctx.scale(Math.sign(o.v) || 1, 1); boat(ctx, o); ctx.restore(); break;
        case 'fan': {
          at(o.x); shadow(ctx, 0.3);
          personFront(ctx, o.look, o.sign ? 'sign' : o.pose, time, o.phase);
          if (o.sign) sign(ctx, o.sign, (o.phase * 10 | 0) % 3 === 0 ? PINK : (o.phase * 10 | 0) % 3 === 1 ? LIME : '#fff');
          else if (o.flag) flag(ctx, time + o.phase);
          ctx.restore(); break;
        }
        case 'walker': {
          at(o.x); shadow(ctx, 0.3);
          if (o.kind === 'jogger' && o.dirNow > 0) runnerBack(ctx, o.look, time * 7 + o.phase, null);
          else personFront(ctx, o.look, 'walk', time, o.phase, { chatArm: o.chat && (Math.sin(time + o.phase) > 0.3) });
          ctx.restore(); break;
        }
        case 'dj': at(o.x); djBooth(ctx, time, musicLevel); ctx.restore(); break;
        case 'rave': at(4.4); raveSmall(ctx, time); ctx.restore(); break;
        case 'arch': at(0); arch(ctx, o.text, o.kind, time); ctx.restore(); break;
        case 'item': at(o.x); itemSprite(ctx, o.type, time, o.z, o.variant); ctx.restore(); break;
        case 'hf': {
          at(o.x); shadow(ctx, 0.3);
          personFront(ctx, { skin: '#f1c9a5', hair: '#5a3a22', shirt: PINK, shorts: '#1e1e28', shoes: '#fff', cap: LIME }, 'stand', time, o.z);
          ctx.strokeStyle = '#f1c9a5'; ctx.lineWidth = 0.09; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-0.2, -1.42); ctx.lineTo(-0.55, -1.55); ctx.lineTo(-0.8, -1.7); ctx.stroke();
          ctx.fillStyle = '#f1c9a5'; ell(ctx, -0.84, -1.74, 0.09, 0.1); ctx.fill();
          const g2 = ctx.createLinearGradient(0, 0, 0, -3.4); g2.addColorStop(0, 'rgba(200,255,26,0.45)'); g2.addColorStop(1, 'rgba(200,255,26,0)');
          ctx.fillStyle = g2; ctx.fillRect(-1.0, -3.4, 0.36, 3.4);
          ctx.fillStyle = LIME; ell(ctx, -0.82, -2.35, 0.3, 0.3); ctx.fill();
          ctx.fillStyle = INK; ctx.font = '800 0.3px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('5', -0.82, -2.33); ctx.textBaseline = 'alphabetic';
          ctx.restore(); break;
        }
        case 'obs': at(o.x); if (o.type !== 'puddle') shadow(ctx, o.type === 'dog' ? 0.35 : 0.5); obstacleSprite(ctx, o, time); ctx.restore(); break;
        case 'rival': {
          if (dz < cam.back - 1.2) break; // догнанных почти у камеры не рисуем
          at(o.x); ctx.globalAlpha = a * clamp((dz - (cam.back - 1.2)) / 1.5, 0, 1); shadow(ctx, 0.32);
          runnerBack(ctx, o.look, o.phase, null, { bib: true });
          ctx.restore();
          if (dz < 70 && o.z > g.pz - 1) labels.push({ x: PX(o.x, dz), y: PY(2.05, dz), s, name: o.star ? '★ ' + o.name : o.name, star: o.star, a, id: o.id });
          break;
        }
        case 'pacer': {
          at(g.px + 0.55); shadow(ctx, 0.3);
          runnerBack(ctx, { skin: '#e0ac85', hair: '#2b1d16', shirt: VIOLET, shorts: '#111', shoes: LIME }, g.phase + 1, null);
          ctx.fillStyle = '#ddd'; ctx.fillRect(0.28, -2.6, 0.03, 1.4);
          ctx.fillStyle = VIOLET; ctx.fillRect(0.31, -2.6, 0.62, 0.4);
          ctx.fillStyle = '#fff'; ctx.font = '800 0.17px "Unbounded", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('ПЕЙС', 0.62, -2.4); ctx.textBaseline = 'alphabetic';
          ctx.restore(); break;
        }
        case 'player': drawPlayer(g, dz, s); break;
      }
    }
    ctx.globalAlpha = 1;
    drawLabels(labels);
    drawEffects(g, dt);
  };

  function shadow(c, r) { c.fillStyle = 'rgba(20,10,30,0.28)'; ell(c, 0, 0, r, r * 0.28); c.fill(); }

  function drawPlayer(g, dz, s) {
    const x = PX(g.px, dz), y0 = PY(0, dz);
    // тень остаётся на земле при прыжке
    ctx.save(); ctx.translate(x, y0); ctx.scale(s, s);
    shadow(ctx, 0.38 / (1 + g.y * 0.6));
    ctx.restore();
    // бустер: цветной след (кофеин — розовый, магний — зелёный, пуэр — янтарный)
    if (g.boostT > 0) {
      const bc = { caffeine: '255,46,147', magnesium: '57,226,122', puer: '255,155,46' }[g.boostKind] || '255,46,147';
      for (let i = 3; i >= 1; i--) {
        const dz2 = dz - i * 0.55; if (dz2 < 0.9) continue;
        const s2 = f / dz2;
        ctx.save(); ctx.globalAlpha = 0.16 * (4 - i) / 3;
        ctx.translate(PX(g.px - g.vx * 0.012 * i, dz2), PY(g.y, dz2)); ctx.scale(s2, s2);
        runnerBack(ctx, { skin: i % 2 ? LIME : PINK, hair: i % 2 ? LIME : PINK, shirt: i % 2 ? LIME : PINK, shorts: i % 2 ? LIME : PINK, shoes: LIME }, g.phase - i * 0.4, null);
        ctx.restore();
      }
      const rg = ctx.createRadialGradient(x, PY(1, dz), 0, x, PY(1, dz), s * 1.3);
      rg.addColorStop(0, 'rgba(' + bc + ',0.32)'); rg.addColorStop(1, 'rgba(' + bc + ',0)');
      ctx.fillStyle = rg; ctx.fillRect(x - s * 1.4, PY(2.4, dz), s * 2.8, s * 2.6);
    }
    ctx.save(); ctx.translate(x, PY(g.y, dz)); ctx.scale(s, s);
    const lean = clamp(-g.vx * 0.022, -0.2, 0.2) + (g.hitT > 0 ? Math.sin(g.hitT * 20) * 0.04 : 0);
    ctx.rotate(reduced ? lean * 0.5 : lean);
    const look = { skin: '#e9b892', hair: '#3a2a20', shirt: PINK, shorts: '#141418', shoes: '#f4f4f4', longHair: false };
    // в прыжке ноги поджаты: фаза фиксируется
    const ph = g.y > 0.05 ? Math.PI / 2 : g.phase;
    if (g.invulnT > 0 && g.pacerT <= 0 && !reduced && Math.floor(g.invulnT * 12) % 2) ctx.globalAlpha = 0.7;
    runnerBack(ctx, look, ph, shirtTex);
    ctx.globalAlpha = 1;
    ctx.restore();
    // защита пейсера
    if (g.pacerT > 0) {
      const pulse = reduced ? 0 : Math.sin(time * 4) * 0.04;
      ctx.save(); ctx.translate(x, PY(g.y + 0.95, dz)); ctx.scale(s, s);
      ctx.strokeStyle = 'rgba(139,92,255,' + (g.pacerT < 2 ? 0.35 + 0.3 * Math.sin(time * 10) : 0.6) + ')';
      ctx.lineWidth = 0.05; ell(ctx, 0, 0, 0.62 + pulse, 1.05 + pulse); ctx.stroke();
      ctx.fillStyle = 'rgba(139,92,255,0.10)'; ctx.fill();
      ctx.restore();
    }
    // магний: зелёные кольца
    if (g.boostT > 0 && g.boostKind === 'magnesium') {
      const p = (time * 0.8) % 1;
      ctx.save(); ctx.translate(x, PY(g.y, dz)); ctx.scale(s, s);
      for (let i = 0; i < 3; i++) {
        const q = (p + i / 3) % 1;
        ctx.strokeStyle = 'rgba(57,226,122,' + (1 - q) * 0.8 + ')'; ctx.lineWidth = 0.05;
        ell(ctx, 0, -q * 2, 0.5 + q * 0.2, 0.14); ctx.stroke();
      }
      ctx.restore();
    }
    R.playerScreen = { x, y: PY(1.2, dz), s };
  }

  function drawLabels(labels) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    labels.sort((a, b) => b.s - a.s); // ближние важнее
    const boxes = [];
    for (const lb of labels) {
      const size = clamp(lb.s * 0.3, 10, 17);
      ctx.font = '700 ' + size + 'px "Golos Text", system-ui, sans-serif';
      const w = ctx.measureText(lb.name).width;
      const box = { x0: lb.x - w / 2 - 2, x1: lb.x + w / 2 + 2, y0: lb.y - size - 2, y1: lb.y + 4 };
      if (boxes.some((b) => b.x0 < box.x1 && b.x1 > box.x0 && b.y0 < box.y1 && b.y1 > box.y0)) continue;
      boxes.push(box);
      let x = lb.x - w / 2;
      const amp = reduced ? 0 : size * 0.12;
      ctx.globalAlpha = lb.a;
      ctx.lineWidth = Math.max(2.5, size * 0.24);
      ctx.strokeStyle = 'rgba(30,11,46,0.85)'; ctx.fillStyle = lb.star ? '#ffd23f' : '#ffffff'; // звёзды бега — золотом
      let i = 0;
      for (const ch of lb.name) {
        const cw = ctx.measureText(ch).width;
        const y = lb.y + Math.sin(time * 4 + i * 0.55) * amp;
        ctx.strokeText(ch, x, y); ctx.fillText(ch, x, y);
        x += cw; i++;
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawEffects(g, dt) {
    // линии скорости по краям
    const f2 = D.speedFactors(g);
    const fast = !reduced && (g.boostT > 0 || f2.cadF > 1.15);
    if (fast && speedLines.length < 26 && Math.random() < 0.8) {
      const side = Math.random() < 0.5 ? -1 : 1;
      speedLines.push({ x: W2 + side * W * (0.3 + Math.random() * 0.2), y: H * (0.35 + Math.random() * 0.55), v: 0, side, life: 0.35, c: g.boostT > 0 ? (Math.random() < 0.5 ? PINK : LIME) : '#ffffff' });
    }
    ctx.lineCap = 'round';
    for (let i = speedLines.length - 1; i >= 0; i--) {
      const l = speedLines[i]; l.life -= dt; l.v += dt * 2600;
      if (l.life <= 0) { speedLines.splice(i, 1); continue; }
      const dx = l.side * l.v * dt * 6, dy = (l.y - hor) * 0.12;
      ctx.strokeStyle = l.c; ctx.globalAlpha = l.life * 1.6; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x + dx, l.y + dy * l.life); ctx.stroke();
      l.x += l.side * l.v * dt * 0.6; l.y += (l.y - hor) * dt * 1.5;
    }
    ctx.globalAlpha = 1;
    // всплеск при подборе
    if (g.pickT > 0 && R.playerScreen) {
      const p = 1 - g.pickT / 0.5, ps = R.playerScreen;
      ctx.strokeStyle = g.pickColor; ctx.globalAlpha = (1 - p) * 0.9; ctx.lineWidth = 3;
      ell(ctx, ps.x, ps.y, ps.s * (0.4 + p * 0.9), ps.s * (0.4 + p * 0.9)); ctx.stroke();
      ctx.fillStyle = g.pickColor;
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; ell(ctx, ps.x + Math.cos(a) * ps.s * (0.3 + p), ps.y + Math.sin(a) * ps.s * (0.3 + p) - p * ps.s * 0.4, 3, 3); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    // мягкая вспышка фотографа
    if (g.flashT > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (g.flashT / 0.4) * (reduced ? 0.25 : 0.55) + ')'; ctx.fillRect(0, 0, W, H); }
    // зелёное восстановление / мягкий сигнал столкновения
    if (g.hitT > 0) {
      const col = '255,122,26', a = g.hitT / 0.45 * 0.3;
      const vg = ctx.createRadialGradient(W2, H * 0.55, Math.min(W, H) * 0.3, W2, H * 0.55, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(' + col + ',0)'); vg.addColorStop(1, 'rgba(' + col + ',' + a + ')');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
  }

  /* ---------- превью героя для стартового экрана ---------- */
  R.drawHero = function (canvas, t) {
    const c = canvas.getContext('2d'); if (!c) return;
    const d = Math.min(G.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * d)) { canvas.width = Math.round(w * d); canvas.height = Math.round(h * d); }
    c.setTransform(d, 0, 0, d, 0, 0);
    c.clearRect(0, 0, w, h);
    const s = h / 2.05;
    c.save(); c.translate(w / 2, h * 0.97); c.scale(s, s);
    c.fillStyle = 'rgba(30,11,46,0.25)'; ell(c, 0, 0, 0.42, 0.08); c.fill();
    if (!shirtTex) shirtTex = R.makeShirt(440);
    runnerBack(c, { skin: '#e9b892', hair: '#3a2a20', shirt: PINK, shorts: '#141418', shoes: '#f4f4f4' }, reduced ? 0.6 : t * 5.6, shirtTex);
    c.restore();
  };
  R.refreshShirt = function () { shirtTex = R.makeShirt(440); };
  D.LM2D = LM; D.kremlinTower2D = kremlinTower;
})(typeof globalThis !== 'undefined' ? globalThis : window);
