/* Часть 1 · Дизайн и графика — процедурные текстуры для 3D-сцены */
(function (G) {
  'use strict';
  const D = G.DUSTY;
  const T = (D.Tex = {});
  const PINK = '#ff2e93', VIOLET = '#6c2bd9', LIME = '#c8ff1a', INK = '#1e0b2e';
  const FONT = '"Unbounded", "Arial Black", Impact, sans-serif';
  const cache = new Map();

  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function tex(c, repeat) {
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  T.dispose = function () { cache.forEach((t) => t.dispose && t.dispose()); cache.clear(); };

  /* Майка героя: развёртка вокруг корпуса. u = 0.5 — центр спины. */
  let shirtCanvas = null;
  T.shirt = function () {
    if (cache.has('shirt')) return cache.get('shirt');
    shirtCanvas = canvas(1024, 512);
    drawShirt(shirtCanvas);
    const t = tex(shirtCanvas); cache.set('shirt', t); return t;
  };
  // после загрузки фирменного шрифта майку перерисовываем
  T.redrawShirt = function () { if (shirtCanvas) { drawShirt(shirtCanvas); cache.get('shirt').needsUpdate = true; } };
  function drawShirt(c) {
    const w = 1024, h = 512, x = c.getContext('2d');
    const r = D.rng(2019);
    x.fillStyle = PINK; x.fillRect(0, 0, w, h);
    // фиолетовые пятна по всей ткани
    for (let i = 0; i < 70; i++) {
      const cx = r() * w, cy = r() * h, rad = 18 + r() * 46;
      x.fillStyle = 'rgba(108,43,217,' + (0.45 + r() * 0.35) + ')';
      x.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2, rr = rad * (0.55 + r() * 0.55);
        const px = cx + Math.cos(a) * rr * 1.3, py = cy + Math.sin(a) * rr;
        k ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.closePath(); x.fill();
    }
    // крупные кислотно-салатовые элементы (бока, плечи, низ)
    x.fillStyle = LIME;
    const bolt = (ox, oy, s, flip) => {
      x.save(); x.translate(ox, oy); x.scale(flip ? -s : s, s);
      x.beginPath(); x.moveTo(0, 0); x.lineTo(120, -30); x.lineTo(70, 40); x.lineTo(130, 40); x.lineTo(-10, 150); x.lineTo(30, 70); x.lineTo(-30, 70); x.closePath(); x.fill();
      x.restore();
    };
    bolt(300, 40, 1.1, true); bolt(724, 40, 1.1, false); bolt(140, 300, 0.9, false); bolt(884, 300, 0.9, true);
    x.beginPath(); x.moveTo(0, 420); x.lineTo(1024, 470); x.lineTo(1024, 512); x.lineTo(0, 512); x.closePath(); x.fill();
    for (let i = 0; i < 40; i++) { x.beginPath(); x.arc(r() * w, r() * h, 3 + r() * 6, 0, 7); x.fill(); }
    // спина: надпись и клубный знак (компенсация растяжения по окружности)
    x.save(); x.translate(512, 0); x.scale(1.37, 1);
    x.textAlign = 'center'; x.lineJoin = 'round';
    const txt = (s, y, size, wt) => {
      x.font = (wt || 800) + ' ' + size + 'px ' + FONT;
      let sz = size; while (x.measureText(s).width > 250 && sz > 8) { sz--; x.font = (wt || 800) + ' ' + sz + 'px ' + FONT; }
      x.strokeStyle = INK; x.lineWidth = sz * 0.2; x.strokeText(s, 0, y);
      x.fillStyle = '#fff7fb'; x.fillText(s, 0, y);
    };
    txt('DUSTY', 112, 60); txt('DUMBBELLS', 160, 40); txt('ANONYMOUS RUNNING CLUB', 190, 19, 700);
    const ey = 282, er = 62;
    x.fillStyle = '#fff7fb'; x.beginPath(); x.arc(0, ey, er, 0, 7); x.fill();
    x.strokeStyle = INK; x.lineWidth = 5; x.stroke();
    x.strokeStyle = PINK; x.lineWidth = 4; x.beginPath(); x.arc(0, ey, er * 0.84, 0, 7); x.stroke();
    x.fillStyle = INK;
    x.fillRect(-er * 0.55, ey - er * 0.07, er * 1.1, er * 0.14);
    for (const s of [-1, 1]) { x.fillRect(s * er * 0.45 - er * 0.08, ey - er * 0.34, er * 0.16, er * 0.68); x.fillRect(s * er * 0.62 - er * 0.06, ey - er * 0.24, er * 0.12, er * 0.48); }
    x.font = '800 15px ' + FONT; x.fillText('DDARC', 0, ey + er * 0.62);
    txt('est. 2019', 392, 26, 700);
    x.restore();
    // грудь: маленький знак
    x.fillStyle = '#fff7fb'; x.beginPath(); x.arc(940, 150, 22, 0, 7); x.fill();
    x.fillStyle = INK; x.fillRect(926, 147, 28, 6);
    // швы и складки
    const gr = x.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(30,11,46,0.25)'); gr.addColorStop(0.08, 'rgba(30,11,46,0)'); gr.addColorStop(0.92, 'rgba(30,11,46,0)'); gr.addColorStop(1, 'rgba(30,11,46,0.25)');
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(30,11,46,0.25)'; x.lineWidth = 2;
    for (const sx of [256, 768]) { x.beginPath(); x.moveTo(sx, 0); x.lineTo(sx, h); x.stroke(); }
  }

  // Фактура ткани для соперников (сетка + швы), окрашивается цветом материала
  T.fabric = function () {
    if (cache.has('fabric')) return cache.get('fabric');
    const c = canvas(128, 128), x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128);
    x.fillStyle = 'rgba(0,0,0,0.06)';
    for (let i = 0; i < 128; i += 4) for (let j = (i / 4) % 2 * 2; j < 128; j += 4) x.fillRect(i, j, 2, 2);
    const t = tex(c, [3, 3]); cache.set('fabric', t); return t;
  };

  T.asphalt = function () {
    if (cache.has('asphalt')) return cache.get('asphalt');
    const c = canvas(256, 256), x = c.getContext('2d'); const r = D.rng(5);
    x.fillStyle = '#4b4c56'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3500; i++) { const v = 60 + r() * 50 | 0; x.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 6) + ',0.5)'; x.fillRect(r() * 256, r() * 256, 1.5, 1.5); }
    // едва заметные границы игровых полос (u = 0.35 и 0.65 на ширине дороги)
    x.fillStyle = 'rgba(255,255,255,0.13)';
    for (let y = 0; y < 256; y += 64) { x.fillRect(256 * 0.352 - 2, y, 4, 36); x.fillRect(256 * 0.648 - 2, y, 4, 36); }
    const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; cache.set('asphalt', t); return t;
  };

  T.tiles = function (base, line) {
    const k = 'tiles' + base;
    if (cache.has(k)) return cache.get(k);
    const c = canvas(128, 128), x = c.getContext('2d'); const r = D.rng(9);
    x.fillStyle = base; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = 'rgba(0,0,0,' + (r() * 0.06) + ')'; x.fillRect(i * 32, j * 32, 32, 32); }
    x.strokeStyle = line; x.lineWidth = 2;
    for (let i = 0; i <= 128; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); }
    const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; cache.set(k, t); return t;
  };

  T.granite = function () {
    if (cache.has('granite')) return cache.get('granite');
    const c = canvas(128, 64), x = c.getContext('2d'); const r = D.rng(11);
    x.fillStyle = '#a1928a'; x.fillRect(0, 0, 128, 64);
    for (let i = 0; i < 900; i++) { x.fillStyle = r() < 0.5 ? 'rgba(60,40,40,0.25)' : 'rgba(255,240,230,0.25)'; x.fillRect(r() * 128, r() * 64, 1.5, 1.5); }
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 0, 2, 64); x.fillRect(64, 0, 2, 64);
    const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; cache.set('granite', t); return t;
  };

  T.water = function () {
    if (cache.has('water')) return cache.get('water');
    const c = canvas(256, 256), x = c.getContext('2d'); const r = D.rng(13);
    const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#3f86a8'); g.addColorStop(1, '#2f6f8f');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = 'rgba(255,255,255,0.5)'; x.lineCap = 'round';
    for (let i = 0; i < 120; i++) { x.lineWidth = 1 + r() * 2; const px = r() * 256, py = r() * 256, l = 6 + r() * 22; x.beginPath(); x.moveTo(px, py); x.lineTo(px + l, py); x.stroke(); }
    x.strokeStyle = 'rgba(20,50,70,0.25)';
    for (let i = 0; i < 80; i++) { x.lineWidth = 2; const px = r() * 256, py = r() * 256; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 20, py); x.stroke(); }
    const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; cache.set('water', t); return t;
  };

  T.text = function (text, opts) {
    opts = opts || {};
    const key = 'txt|' + text + '|' + JSON.stringify(opts);
    if (cache.has(key)) return cache.get(key);
    const w = opts.w || 512, h = opts.h || 128, c = canvas(w, h), x = c.getContext('2d');
    x.fillStyle = opts.bg || '#ffffff'; x.fillRect(0, 0, w, h);
    if (opts.stripe) { x.fillStyle = opts.stripe; x.fillRect(0, h * 0.82, w, h * 0.1); }
    if (opts.checker) { for (let i = 0; i < w / 16; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#fff' : INK; x.fillRect(i * 16, h - 32 + j * 16, 16, 16); } }
    let size = opts.size || h * 0.55;
    x.font = '800 ' + size + 'px ' + FONT;
    while (x.measureText(text).width > w * 0.92 && size > 8) { size -= 2; x.font = '800 ' + size + 'px ' + FONT; }
    x.fillStyle = opts.fg || INK; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, w / 2, opts.checker ? h * 0.38 : h / 2);
    const t = tex(c); cache.set(key, t); return t;
  };

  T.stripes = function (a, b, n, diag) {
    const key = 'str' + a + b + n + diag;
    if (cache.has(key)) return cache.get(key);
    const c = canvas(256, 64), x = c.getContext('2d');
    x.fillStyle = a; x.fillRect(0, 0, 256, 64);
    x.fillStyle = b;
    for (let i = 0; i < n; i++) {
      const x0 = (i / n) * 256;
      x.beginPath();
      if (diag) { x.moveTo(x0, 64); x.lineTo(x0 + 256 / n / 2, 0); x.lineTo(x0 + 256 / n, 0); x.lineTo(x0 + 256 / n / 2, 64); }
      else x.rect(0, (i / n) * 64, 256, 64 / n / 2);
      x.fill();
    }
    const t = tex(c); cache.set(key, t); return t;
  };

  T.glow = function (color) {
    const key = 'glow' + color;
    if (cache.has(key)) return cache.get(key);
    const c = canvas(64, 256), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 256, 0, 0);
    g.addColorStop(0, color + 'cc'); g.addColorStop(1, color + '00');
    x.fillStyle = g; x.fillRect(0, 0, 64, 256);
    const t = tex(c); cache.set(key, t); return t;
  };

  T.radial = function (inner, outer) {
    const key = 'rad' + inner + outer;
    if (cache.has(key)) return cache.get(key);
    const c = canvas(128, 128), x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, inner); g.addColorStop(1, outer);
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = tex(c); cache.set(key, t); return t;
  };

  T.sky = function (top, mid, hor) {
    const c = canvas(4, 256), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top); g.addColorStop(0.6, mid); g.addColorStop(1, hor);
    x.fillStyle = g; x.fillRect(0, 0, 4, 256);
    return tex(c);
  };

  T.cloud = function () {
    if (cache.has('cloud')) return cache.get('cloud');
    const c = canvas(256, 128), x = c.getContext('2d'); const r = D.rng(3);
    for (let i = 0; i < 9; i++) {
      const cx = 50 + r() * 156, cy = 60 + r() * 30, rr = 25 + r() * 30;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 256, 128);
    }
    const t = tex(c); cache.set('cloud', t); return t;
  };

  // Силуэты ориентиров рисуются в метрах и переносятся на холст
  T.landmark = function (kind) {
    const key = 'lm' + kind;
    if (cache.has(key)) return cache.get(key);
    const box = { wtc: [-32, -80, 64, 82], whitehouse: [-40, -70, 80, 72], mid: [-34, -114, 68, 116], rostov: [-42, -24, 84, 26], silk: [-38, -46, 76, 48],
      novodevichy: [-52, -56, 104, 58], luzhniki: [-58, -44, 116, 46], mod: [-57, -44, 114, 46], hhs: [-28, -82, 56, 84], palace: [-58, -82, 116, 84] }[kind];
    const px = 14;
    const c = canvas(Math.ceil(box[2] * px), Math.ceil(box[3] * px)), x = c.getContext('2d');
    x.scale(px, px); x.translate(-box[0], -box[1]);
    D.LM2D[kind](x);
    const t = tex(c); t.userData = { w: box[2], h: box[3], cx: box[0] + box[2] / 2 };
    cache.set(key, t); return t;
  };

  // Дальние силуэты: Москва-Сити, МГУ, Кремль
  T.backdrop = function (kind) {
    const key = 'bd' + kind;
    if (cache.has(key)) return cache.get(key);
    const c = canvas(1024, 512), x = c.getContext('2d');
    if (kind === 'city') {
      const towers = [[-260, 300, '#6d95bd'], [-150, 400, '#7aa3c6'], [-40, 500, '#4f7aa4'], [70, 430, '#86abcb'], [180, 350, '#5d84ab'], [290, 270, '#88aed0'], [-360, 220, '#7092b4']];
      for (const [tx, th, col] of towers) {
        const bx = 512 + tx;
        const g = x.createLinearGradient(bx, 0, bx + 80, 0); g.addColorStop(0, col); g.addColorStop(1, '#c9dceb');
        x.fillStyle = g; x.beginPath(); x.moveTo(bx, 512); x.lineTo(bx, 512 - th); x.lineTo(bx + 40, 512 - th - 22); x.lineTo(bx + 80, 512 - th); x.lineTo(bx + 80, 512); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.18)'; for (let yy = 512 - th; yy < 512; yy += 14) x.fillRect(bx, yy, 80, 2);
      }
    } else if (kind === 'mgu') {
      x.fillStyle = '#7fa577'; x.beginPath(); x.ellipse(512, 512, 520, 90, 0, Math.PI, 0); x.fill();
      x.fillStyle = '#ddd5c3'; x.fillRect(330, 330, 364, 110); x.fillRect(440, 200, 144, 150); x.fillRect(480, 120, 64, 90);
      x.beginPath(); x.moveTo(494, 120); x.lineTo(512, 20); x.lineTo(530, 120); x.fill();
      x.fillStyle = '#c9a23a'; x.beginPath(); x.arc(512, 18, 7, 0, 7); x.fill();
      x.fillStyle = 'rgba(80,70,60,0.35)'; for (let yy = 340; yy < 440; yy += 14) x.fillRect(330, yy, 364, 3);
    } else if (kind === 'kremlin') {
      x.fillStyle = '#b8402f'; x.fillRect(40, 440, 944, 72);
      for (const [tx, th] of [[80, 170], [300, 150], [512, 230], [720, 160], [930, 190]]) {
        x.fillStyle = '#b8402f'; x.fillRect(tx - 26, 512 - th, 52, th);
        x.fillStyle = '#2f6a46'; x.beginPath(); x.moveTo(tx - 30, 512 - th); x.lineTo(tx, 512 - th - 100); x.lineTo(tx + 30, 512 - th); x.fill();
        x.fillStyle = '#e0473a'; x.beginPath(); x.arc(tx, 512 - th - 110, 10, 0, 7); x.fill();
      }
      x.fillStyle = '#e0b23c'; for (const [tx, rr] of [[600, 34], [650, 26], [690, 22]]) { x.beginPath(); x.ellipse(tx, 330, rr, rr * 1.3, 0, 0, 7); x.fill(); }
      x.fillStyle = '#f4f1ea'; x.fillRect(395, 230, 34, 210); x.fillStyle = '#e0b23c'; x.beginPath(); x.ellipse(412, 222, 20, 26, 0, 0, 7); x.fill();
    }
    const t = tex(c); cache.set(key, t); return t;
  };

  T.windowsFacade = null;
})(typeof globalThis !== 'undefined' ? globalThis : window);
