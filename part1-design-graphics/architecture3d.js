/* Часть 1 · Дизайн и графика — архитектура набережных: стили зданий по районам и объёмные ориентиры */
(function (G) {
  'use strict';
  const D = G.DUSTY;
  const A3 = (D.Arch3D = {});
  const PI = Math.PI;
  const Z = (z) => -z; // мировая координата → Three.js (вперёд = −z)
  const STYLE_ID = { panel: 0, stalin: 1, classic: 2, merchant: 2, brick: 3, modern: 4, sport: 5 };
  const lam = (color, extra) => new THREE.MeshLambertMaterial(Object.assign({ color }, extra || {}));
  const std = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8 }, extra || {}));
  const shade = (hex, k) => { const c = new THREE.Color(hex); c.r = Math.min(1, c.r * (1 + k)); c.g = Math.min(1, c.g * (1 + k)); c.b = Math.min(1, c.b * (1 + k)); return '#' + c.getHexString(); };

  /* Фасады: окна, руст, наличники, кирпич и стекло считаются в шейдере по мировым координатам; стиль — атрибут aStyle */
  const FACADE_GLSL = `
    float st = floor(vStyle + 0.5);
    vec3 base = diffuseColor.rgb;
    if (vWN.y > 0.5) { diffuseColor.rgb *= 0.62; }
    else if (vWN.y > -0.5) {
      float u = abs(vWN.x) > 0.5 ? vWPos.z : vWPos.x;
      float y = vWPos.y;
      if (st > 3.5 && st < 4.5) {
        // стекло: витраж с перекрытиями и импостами, в нём отражается небо
        float fv = fract(y / 3.6), fu = fract(u / 1.6);
        vec3 sky = mix(vec3(0.55, 0.7, 0.86), vec3(0.86, 0.92, 0.98), clamp(y / 70.0, 0.0, 1.0));
        vec3 glass = mix(winColor * 1.6, sky, 0.55 + 0.2 * sin(u * 0.13 + y * 0.05));
        diffuseColor.rgb = mix(glass, base * 0.8, max(step(fv, 0.1), step(fu, 0.05)));
      } else if (st > 2.5 && st < 3.5) {
        // кирпич: перевязка рядов, светлые швы, высокие арочные окна
        float row = floor(y / 0.3);
        float bu = fract((u + mod(row, 2.0) * 0.4) / 0.8), bv = fract(y / 0.3);
        float tone = 0.9 + 0.1 * fract(sin(floor((u + mod(row, 2.0) * 0.4) / 0.8) * 17.13 + row * 3.7) * 4375.85);
        diffuseColor.rgb = mix(base * tone, vec3(0.83, 0.77, 0.7), max(step(bu, 0.05), step(bv, 0.09)) * 0.5);
        float cu = (fract(u / 3.8) - 0.5) * 3.8, fy = mod(y, 4.4);
        float win = step(abs(cu), 0.85) * step(1.0, fy) * step(fy, 3.2) + step(length(vec2(cu, fy - 3.2)), 0.85) * step(3.2, fy);
        diffuseColor.rgb = mix(diffuseColor.rgb, winColor * 0.85, clamp(win, 0.0, 1.0) * step(4.4, y) * 0.9);
      } else {
        bool stalin = st > 0.5 && st < 1.5, classic = st > 1.5 && st < 2.5, sport = st > 4.5;
        float sx = stalin ? 2.7 : (classic ? 3.0 : 3.1);
        float fu = fract(u / sx), fv = fract(y / 3.4);
        float x0 = stalin ? 0.3 : 0.25, x1 = stalin ? 0.7 : 0.72, y0 = stalin ? 0.18 : 0.26, y1 = stalin ? 0.86 : 0.8;
        float win = step(x0, fu) * step(fu, x1) * step(y0, fv) * step(fv, y1) * step(3.4, y);
        if (classic) {
          // белые наличники и сандрики
          float fr = step(x0 - 0.07, fu) * step(fu, x1 + 0.07) * step(y0 - 0.06, fv) * step(fv, y1 + 0.12) * step(3.4, y);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97, 0.95, 0.9), fr * 0.85);
        }
        if (stalin) diffuseColor.rgb = mix(diffuseColor.rgb, base * 1.12, step(fract(u / (sx * 2.0)), 0.07) * step(6.8, y)); // пилястры
        float glassN = 0.5 + 0.5 * fract(sin(floor(u / sx) * 12.9898 + floor(y / 3.4) * 78.233) * 43758.5453);
        diffuseColor.rgb = mix(diffuseColor.rgb, winColor * (0.75 + 0.5 * glassN), win * 0.88);
        if (sport) diffuseColor.rgb = mix(diffuseColor.rgb, mix(winColor * 1.5, vec3(0.75, 0.85, 0.95), 0.5), step(1.2, y) * step(y, 4.6) * 0.9);
        if (y < 3.2) diffuseColor.rgb *= 0.72;
        if (stalin && y < 6.8) diffuseColor.rgb *= 0.88 - 0.12 * step(fract(y / 0.6), 0.1); // руст цоколя
        diffuseColor.rgb *= 0.92 + 0.08 * step(0.5, fv);
      }
    }`;
  A3.facade = function (winColor, color) {
    const m = new THREE.MeshLambertMaterial({ color: color || '#ffffff' });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.winColor = { value: new THREE.Color(winColor) };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aStyle; varying float vStyle; varying vec3 vWPos; varying vec3 vWN;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 wp = vec4(transformed, 1.0);
          vec3 wn = objectNormal;
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp; wn = mat3(instanceMatrix) * wn;
          #endif
          wp = modelMatrix * wp; vWPos = wp.xyz; vWN = normalize(mat3(modelMatrix) * wn); vStyle = aStyle;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vStyle; varying vec3 vWPos; varying vec3 vWN; uniform vec3 winColor;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + FACADE_GLSL);
    };
    return m;
  };

  /* Геометрии: всё стоит на y = 0. Создаются при первой постройке — без WebGL модуль не трогает THREE */
  let unitBox, prismZ, prismX, cylGeo, coneGeo, tentGeo, octaGeo, onionGeo;
  const styledCache = {};
  function initGeo() {
    if (unitBox) return;
    unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    prismZ = (() => { const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5); })(); // конёк вдоль z
    prismX = prismZ.clone().rotateY(PI / 2); // фронтон, обращённый к ±x
    cylGeo = new THREE.CylinderGeometry(1, 1, 1, 14).translate(0, 0.5, 0);
    coneGeo = new THREE.ConeGeometry(1, 1, 12).translate(0, 0.5, 0);
    tentGeo = new THREE.ConeGeometry(1, 1, 4).rotateY(PI / 4).translate(0, 0.5, 0);
    octaGeo = new THREE.OctahedronGeometry(1);
    // луковичная глава
    onionGeo = new THREE.LatheGeometry([[0, 0], [0.82, 0.04], [1, 0.32], [0.96, 0.58], [0.62, 0.92], [0.26, 1.22], [0.07, 1.5], [0, 1.6]].map((p) => new THREE.Vector2(p[0], p[1])), 18);
  }
  const styledGeo = (sid) => {
    if (!styledCache[sid]) { const g = unitBox.clone(); g.setAttribute('aStyle', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(sid), 1)); styledCache[sid] = g; }
    return styledCache[sid];
  };

  // Пачка одинаковых деталей → один InstancedMesh (z — уже в координатах Three.js)
  function Batch(geo, mat, cast) { this.geo = geo; this.mat = mat; this.cast = cast; this.items = []; }
  Batch.prototype.add = function (x, y, z, sx, sy, sz, color, ry, style) { this.items.push([x, y, z, sx, sy, sz, color, ry || 0, style || 0]); };
  Batch.prototype.build = function (root, styled) {
    const n = this.items.length;
    if (!n) return null;
    const geo = styled ? this.geo.clone() : this.geo;
    const im = new THREE.InstancedMesh(geo, this.mat, n);
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), v = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const st = styled ? new Float32Array(n) : null;
    this.items.forEach((it, i) => {
      q.setFromAxisAngle(up, it[7]);
      im.setMatrixAt(i, mt.compose(v.set(it[0], it[1], it[2]), q, s.set(it[3], it[4], it[5])));
      im.setColorAt(i, c.set(it[6]));
      if (st) st[i] = it[8];
    });
    if (st) geo.setAttribute('aStyle', new THREE.InstancedBufferAttribute(st, 1));
    im.frustumCulled = false; im.castShadow = !!this.cast; im.receiveShadow = true;
    root.add(im);
    return im;
  };

  /* Квартал вдоль набережной: корпус + детали своего стиля */
  A3.buildCity = function (root, sc) {
    initGeo();
    const body = new Batch(unitBox, A3.facade('#2c3e57'));
    const towers = new Batch(unitBox, A3.facade('#2c3e57'));
    const trim = lam('#ffffff');
    const plinth = new Batch(unitBox, trim), cornice = new Batch(unitBox, trim), balcony = new Batch(unitBox, trim), roofBox = new Batch(unitBox, trim);
    const roofs = new Batch(prismZ, lam('#ffffff', { flatShading: true }));
    const spires = new Batch(coneGeo, lam('#ffffff')), stars = new Batch(octaGeo, std('#e0b23c', { metalness: 0.7, roughness: 0.3, emissive: '#5a3a00' }));
    const columns = new Batch(cylGeo, trim), pediments = new Batch(prismX, trim), chimneys = new Batch(cylGeo, trim);
    const roofCols = ['#7d8a8c', '#4c8a64', '#8e4a3a', '#6b7280'];
    for (const b of sc.buildings) {
      if (b.kremlin) continue;
      const cz = Z(b.z + b.len / 2), cx = b.xf - b.depth / 2;
      body.add(cx, 0, cz, b.depth, b.h, b.len, b.color, 0, STYLE_ID[b.style] || 0);
      const dark = shade(b.color, -0.2), light = shade(b.color, 0.12);
      switch (b.style) {
        case 'stalin': {
          plinth.add(cx + 0.08, 0, cz, b.depth + 0.16, 6.8, b.len + 0.2, dark);
          cornice.add(cx + 0.2, b.h - 0.25, cz, b.depth + 0.4, 0.6, b.len + 0.5, light);
          cornice.add(cx, b.h + 0.35, cz, b.depth - 0.8, 1.1, b.len - 0.8, b.color); // аттик
          if (b.tower) {
            const w1 = Math.min(b.depth, b.len) * 0.5, tz = Z(b.z + b.len - w1 / 2 - 0.6), h1 = b.h * 0.32, w2 = w1 * 0.62, h2 = b.h * 0.2, hs = b.h * 0.3;
            towers.add(cx, b.h, tz, w1, h1, w1, b.color, 0, 1);
            cornice.add(cx, b.h + h1 - 0.2, tz, w1 + 0.5, 0.5, w1 + 0.5, light);
            towers.add(cx, b.h + h1, tz, w2, h2, w2, b.color, 0, 1);
            spires.add(cx, b.h + h1 + h2, tz, w2 * 0.32, hs, w2 * 0.32, '#c9a23a');
            stars.add(cx, b.h + h1 + h2 + hs + 0.45, tz, 0.5, 0.6, 0.5, '#ffffff');
          }
          break;
        }
        case 'classic': {
          plinth.add(cx + 0.05, 0, cz, b.depth + 0.1, 3.4, b.len + 0.1, light);
          cornice.add(cx + 0.15, b.h - 0.2, cz, b.depth + 0.3, 0.5, b.len + 0.4, '#f4efe4');
          if (b.portico) {
            // портик: колонны, антаблемент и фронтон к дороге
            const n = b.len > 22 ? 6 : 4, span = Math.min(b.len - 2, n * 2.2), colH = Math.min(b.h * 0.62, 9);
            for (let i = 0; i < n; i++) columns.add(b.xf + 1.1, 0, Z(b.z + b.len / 2 - span / 2 + (i + 0.5) * span / n), 0.38, colH, 0.38, '#f4f1ea');
            cornice.add(b.xf + 0.75, colH, cz, 1.7, 0.7, span + 0.6, '#f4efe4');
            pediments.add(b.xf + 0.75, colH + 0.7, cz, 1.7, Math.min(2.6, span * 0.18), span + 0.6, '#f4efe4');
          }
          break;
        }
        case 'merchant':
          cornice.add(cx + 0.12, b.h - 0.15, cz, b.depth + 0.25, 0.35, b.len + 0.3, '#f4efe4');
          roofs.add(cx, b.h + 0.2, cz, b.depth + 0.5, b.depth * 0.32, b.len + 0.5, roofCols[Math.floor(b.z) % 3]);
          break;
        case 'brick':
          cornice.add(cx + 0.1, b.h - 0.3, cz, b.depth + 0.2, 0.6, b.len + 0.2, dark);
          roofs.add(cx, b.h, cz, b.depth + 0.3, b.depth * 0.18, b.len + 0.3, '#5d5f66');
          if (b.chimney) chimneys.add(b.xf - b.depth * 0.7, 0, Z(b.z + b.len * 0.3), 0.9, b.h + 14 + (b.len % 8), 0.9, dark);
          break;
        case 'modern':
          cornice.add(cx, b.h, cz, b.depth + 0.1, 0.4, b.len + 0.1, '#3a4656');
          roofBox.add(cx - 1, b.h + 0.4, cz, b.depth * 0.4, 2.2, b.len * 0.35, '#9aa4ae');
          break;
        case 'panel':
          cornice.add(cx, b.h, cz, b.depth + 0.1, 0.5, b.len + 0.1, dark);
          if (!b.back) {
            for (let f = 1; f < b.floors; f++) for (let c = 0; c < b.cols; c += 2) {
              const bz = Z(b.z + (c + 0.5) * b.len / b.cols), by = f * 3.4 + 0.05;
              balcony.add(b.xf + 0.45, by, bz, 0.9, 0.12, 1.7, '#d8d8d4');
              balcony.add(b.xf + 0.88, by + 0.12, bz, 0.06, 0.95, 1.7, ['#c96a4f', '#6f8ba6', '#e6d4a0'][c % 3]);
            }
          }
          break;
        case 'sport':
          cornice.add(cx, b.h, cz, b.depth + 0.6, 0.45, b.len + 0.6, '#d0d6da');
          break;
      }
    }
    body.build(root, true); towers.build(root, true);
    for (const bt of [plinth, cornice, roofs, spires, stars, columns, pediments, chimneys, balcony, roofBox]) bt.build(root);
  };

  /* ---------- объёмные ориентиры: локально +x смотрит на дорогу, z — вдоль набережной ---------- */
  const facadeCache = {};
  const facadeOf = (color, win) => { const k = color + (win || ''); if (!facadeCache[k]) facadeCache[k] = A3.facade(win || '#2c3e57', color); return facadeCache[k]; };
  const GOLD = () => std('#e0b23c', { metalness: 0.75, roughness: 0.28, emissive: '#3a2600' });
  function LM() { this.g = new THREE.Group(); }
  // корпус с фасадом стиля (окна в шейдере)
  LM.prototype.box = function (x, y, z, w, h, d, color, style, win) {
    const m = new THREE.Mesh(styledGeo(STYLE_ID[style] != null ? STYLE_ID[style] : 0), facadeOf(color, win));
    m.scale.set(w, h, d); m.position.set(x, y, z); m.receiveShadow = true; this.g.add(m); return m;
  };
  LM.prototype.mesh = function (geo, mat, x, y, z, sx, sy, sz, ry) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz); if (ry) m.rotation.y = ry; this.g.add(m); return m;
  };
  LM.prototype.plain = function (x, y, z, w, h, d, color) { return this.mesh(unitBox, lam(color), x, y, z, w, h, d); };
  LM.prototype.dome = function (x, y, z, r, mat, cross) {
    this.mesh(onionGeo, mat, x, y, z, r, r, r);
    if (cross) { const gm = GOLD(); this.plain(x, y + r * 1.6, z, 0.12 * r, r * 0.7, 0.12 * r).material = gm; this.plain(x, y + r * 1.95, z, 0.12 * r, 0.1 * r, 0.5 * r).material = gm; }
  };
  LM.prototype.text = function (text, x, y, z, w, h, opts, ry) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: D.Tex.text(text, opts), transparent: opts.bg === 'none', alphaTest: opts.bg === 'none' ? 0.4 : 0, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry == null ? PI / 2 : ry; this.g.add(m); return m;
  };
  // ступенчатая высотка: ярусы, карнизы, шпиль со звездой
  function skyscraper(L, color, tiers, spireH) {
    let y = 0;
    for (const [w, h, d] of tiers) { L.box(0, y, 0, w, h, d, color, 'stalin'); L.plain(0, y + h - 0.4, 0, w + 0.8, 0.8, d + 0.8, shade(color, 0.12)); y += h; }
    const top = tiers[tiers.length - 1];
    L.mesh(coneGeo, lam(shade(color, -0.1)), 0, y, 0, top[0] * 0.33, spireH, top[0] * 0.33);
    L.mesh(octaGeo, GOLD(), 0, y + spireH + 1.2, 0, 1.4, 1.8, 1.4);
    return y;
  }

  const MODELS = {
    // Центр международной торговли
    wtc(L) {
      L.box(0, 0, 0, 30, 14, 60, '#d9dde2', 'modern', '#3b5f86');
      L.box(0, 0, -6, 18, 72, 18, '#eef0f2', 'modern', '#3b5f86');
      L.plain(0, 72, -6, 12, 4, 12, '#c9ced4');
    },
    // Дом Правительства: белый корпус, башня с часами и флагом
    whitehouse(L) {
      L.box(0, 0, 0, 34, 20, 76, '#f4f4f0', 'classic');
      L.plain(0.4, 19.6, 0, 34.8, 0.8, 76.8, '#e6e6e0');
      L.box(0, 0, 0, 20, 50, 20, '#f7f7f3', 'classic');
      L.plain(0, 50, 0, 14, 8, 14, '#e0e0da');
      L.mesh(new THREE.CylinderGeometry(1, 1, 0.3, 28).rotateZ(PI / 2), GOLD(), 7.2, 54, 0, 2.6, 2.6, 2.6);
      L.plain(0, 58, 0, 0.3, 9, 0.3, '#dddddd');
      [['#ffffff', 66.2], ['#1f4fbf', 65.3], ['#d02a2a', 64.4]].forEach(([c, y]) => L.plain(0, y, 2.6, 0.1, 0.9, 4.6, c));
    },
    // высотка МИД на Смоленской
    mid(L) {
      skyscraper(L, '#cdb58e', [[40, 26, 64], [28, 30, 36], [18, 22, 20], [12, 8, 12]], 22);
      for (const z of [-26, 26]) { L.box(0, 26, z, 9, 9, 9, '#cdb58e', 'stalin'); L.mesh(coneGeo, lam('#bfa27a'), 0, 35, z, 2.4, 7, 2.4); }
    },
    // доходные дома Ростовской набережной
    rostov(L) {
      const cols = ['#f0d58a', '#e8b7a0', '#cfe0c8', '#f3e6c8', '#f5c9c9'];
      for (let i = 0; i < 5; i++) {
        const z = -32 + i * 16, h = 14 + (i % 2) * 4;
        L.box(0, 0, z, 12, h, 15.6, cols[i], 'merchant');
        L.plain(0.2, h - 0.2, z, 12.5, 0.4, 16, '#f4efe4');
        L.mesh(prismZ, lam('#8a8f9c', { flatShading: true }), 0, h + 0.2, z, 12.6, 4, 16);
      }
    },
    // фабрика «Московский шёлк»: кирпич, арочные окна, труба
    silk(L) {
      L.box(0, 0, 0, 24, 18, 72, '#a9452f', 'brick', '#3a2a24');
      L.mesh(prismZ, lam('#5d5f66', { flatShading: true }), 0, 18, 0, 24.4, 4, 72.4);
      L.mesh(cylGeo, lam('#8e3d2c'), -4, 0, 24, 1.6, 44, 1.6);
      for (const y of [14, 28, 40]) L.mesh(cylGeo, lam('#e8dccb'), -4, y, 24, 1.7, 0.6, 1.7);
      L.text('МОСКОВСКИЙ ШЁЛК', 12.06, 15.5, -6, 30, 3, { bg: '#8e3d2c', fg: '#fff7fb', w: 1024, h: 102 });
    },
    // Новодевичий монастырь: стены с башнями, собор с главами, колокольня
    novodevichy(L) {
      const red = '#c8473a', white = '#f4f1ea';
      L.plain(30, 0, 0, 1.6, 9, 100, red); L.plain(-30, 0, 0, 1.6, 9, 100, red);
      L.plain(0, 0, 50, 60, 9, 1.6, red); L.plain(0, 0, -50, 60, 9, 1.6, red);
      const mer = new Batch(unitBox, lam(white));
      for (let z = -49; z <= 49; z += 3) { mer.add(30, 9, z, 1.4, 1.4, 1.6, white); mer.add(-30, 9, z, 1.4, 1.4, 1.6, white); }
      for (let x = -28; x <= 28; x += 3) { mer.add(x, 9, 50, 1.6, 1.4, 1.4, white); mer.add(x, 9, -50, 1.6, 1.4, 1.4, white); }
      mer.build(L.g);
      for (const x of [-30, 30]) for (const z of [-50, 50]) {
        L.plain(x, 0, z, 6, 15, 6, red);
        L.mesh(tentGeo, lam('#2f6a46', { flatShading: true }), x, 15, z, 4.4, 8, 4.4);
        L.dome(x, 23, z, 0.7, GOLD());
      }
      // Смоленский собор
      L.box(-4, 0, -10, 18, 17, 22, white, 'classic');
      L.mesh(cylGeo, lam(white), -4, 17, -10, 2.4, 4, 2.4); L.dome(-4, 21, -10, 3.2, GOLD(), true);
      for (const [dx, dz] of [[-5, -6], [5, -6], [-5, 6], [5, 6]]) { L.mesh(cylGeo, lam(white), -4 + dx, 17, -10 + dz, 1.5, 3, 1.5); L.dome(-4 + dx, 20, -10 + dz, 2, lam('#2b2b2b')); }
      // колокольня
      let y = 0;
      for (const [w, h] of [[8, 14], [6, 10], [4, 9], [2.8, 8]]) { L.plain(8, y, 16, w, h, w, white); L.plain(8, y + h - 1, 16, w + 0.3, 1, w + 0.3, red); y += h; }
      L.dome(8, y, 16, 1.6, GOLD(), true);
    },
    // Большая спортивная арена «Лужники»
    luzhniki(L) {
      const wall = D.Tex.stripes('#f4f4f0', '#cfd3d6', 8, false).clone(); wall.needsUpdate = true; wall.wrapS = THREE.RepeatWrapping; wall.repeat.set(14, 1);
      L.mesh(new THREE.CylinderGeometry(1, 1, 1, 72, 1, true).translate(0, 0.5, 0), lam('#ffffff', { map: wall, side: THREE.DoubleSide }), 0, 0, 0, 46, 24, 60);
      L.mesh(new THREE.CylinderGeometry(1, 1, 1, 72).translate(0, 0.5, 0), lam('#cfd3d6'), 0, 0, 0, 48, 3, 62);
      L.mesh(new THREE.RingGeometry(0.62, 1.04, 72).rotateX(-PI / 2), lam('#dfe3e6', { side: THREE.DoubleSide }), 0, 24, 0, 46, 1, 60);
      L.mesh(new THREE.CircleGeometry(0.62, 48).rotateX(-PI / 2), lam('#4f9a52'), 0, 3.2, 0, 46, 1, 60);
      for (const [x, z] of [[38, 48], [-38, 48], [38, -48], [-38, -48]]) { L.plain(x, 0, z, 0.8, 40, 0.8, '#9aa3ad'); L.mesh(unitBox, new THREE.MeshBasicMaterial({ color: '#fff6d0' }), x, 40, z, 1, 2, 5); }
      L.text('ЛУЖНИКИ', 46.6, 13, 0, 40, 5, { bg: 'none', fg: '#1e0b2e', w: 1024, h: 128 });
    },
    // Министерство обороны на Фрунзенской: ризалит с колоннадой
    mod(L) {
      L.box(0, 0, 0, 30, 28, 110, '#d8c7a0', 'stalin');
      L.plain(0.3, 27.6, 0, 30.6, 0.8, 110.6, '#e8dcbf');
      L.box(2, 0, 0, 34, 36, 32, '#e2d3ae', 'stalin');
      for (let i = 0; i < 8; i++) L.mesh(cylGeo, lam('#f0e6d0'), 19.6, 0, -14 + i * 4, 0.7, 30, 0.7);
      L.plain(19.6, 30, 0, 1.6, 1.4, 32, '#f0e6d0');
      L.mesh(prismX, lam('#cdb88f', { flatShading: true }), 2, 36, 0, 34, 5, 32);
    },
    // Храм Христа Спасителя: куб с закомарами, барабан, золотые главы
    hhs(L) {
      const white = '#f7f5ef';
      L.box(0, 0, 0, 52, 32, 52, white, 'classic');
      const arch = (() => { const s = new THREE.Shape(); s.absarc(0, 0, 7, 0, PI, false); s.lineTo(7, 0); return new THREE.ExtrudeGeometry(s, { depth: 1.2, bevelEnabled: false }); })();
      for (let k = 0; k < 4; k++) for (const o of [-17, 0, 17]) {
        const m = L.mesh(arch, lam('#efeadd'), 0, 32, 0, 1, 1, 1, k * PI / 2);
        m.position.set(Math.cos(k * PI / 2) * 25.6 + Math.sin(k * PI / 2) * o, 32, -Math.sin(k * PI / 2) * 25.6 + Math.cos(k * PI / 2) * o);
        m.rotation.y = k * PI / 2 + PI / 2;
      }
      const drum = D.Tex.stripes('#f7f5ef', '#d9d2c2', 12, false).clone(); drum.needsUpdate = true; drum.wrapS = THREE.RepeatWrapping; drum.repeat.set(4, 1);
      L.mesh(new THREE.CylinderGeometry(1, 1, 1, 32).translate(0, 0.5, 0), lam('#ffffff', { map: drum }), 0, 32, 0, 11, 16, 11);
      L.dome(0, 48, 0, 11, GOLD(), true);
      for (const x of [-19, 19]) for (const z of [-19, 19]) { L.plain(x, 32, z, 7, 9, 7, white); L.dome(x, 41, z, 3.5, GOLD(), true); }
    },
    // Кремль: Большой Кремлёвский дворец, Иван Великий, Успенский собор
    palace(L) {
      L.box(0, 0, 0, 30, 24, 110, '#efe2b8', 'classic');
      L.mesh(prismZ, lam('#4c8a64', { flatShading: true }), 0, 24, 0, 30.6, 5, 110.6);
      L.mesh(cylGeo, lam('#efe2b8'), 0, 26, 0, 3.2, 5, 3.2); L.dome(0, 31, 0, 3.2, lam('#4c8a64'));
      const white = lam('#f4f1ea');
      let y = 0;
      for (const [r, h] of [[5, 30], [4.2, 20], [3.4, 14], [2.4, 6]]) { L.mesh(new THREE.CylinderGeometry(r * 0.9, r, 1, 8).translate(0, 0.5, 0), white, -6, y, 40, 1, h, 1); y += h; }
      L.dome(-6, y, 40, 3.2, GOLD(), true);
      L.box(10, 0, 22, 16, 18, 20, '#f4f1ea', 'classic');
      L.dome(10, 18, 22, 3, GOLD(), true);
      for (const [dx, dz] of [[-4.5, -5], [4.5, -5], [-4.5, 5], [4.5, 5]]) L.dome(10 + dx, 18, 22 + dz, 2.1, GOLD(), true);
    },
    // том берег: гостиница «Украина»
    ukraina(L) {
      skyscraper(L, '#d9cfb8', [[34, 30, 70], [24, 40, 30], [14, 30, 16], [9, 8, 9]], 30);
      for (const z of [-30, 30]) { L.box(0, 30, z, 10, 12, 10, '#d9cfb8', 'stalin'); L.mesh(coneGeo, lam('#c9bfa6'), 0, 42, z, 2.6, 9, 2.6); }
    },
    // памятник Петру I на стрелке реки
    petr(L) {
      const bronze = std('#8a7650', { metalness: 0.45, roughness: 0.45 }), patina = std('#6f8f80', { metalness: 0.25, roughness: 0.55 });
      L.mesh(cylGeo, lam('#8d8079'), 0, -2.3, 0, 10, 2.2, 10);
      L.mesh(cylGeo, lam('#9b8f86'), 0, -0.1, 0, 5.5, 7, 5.5);
      for (const [y, w, l] of [[6.9, 9, 26], [11, 7, 20], [14.6, 5, 14]]) {
        L.mesh(unitBox, patina, 0, y, 0, w, 4, l);
        L.mesh(prismX, patina, 0, y, -l / 2 - 1.5, w, 4, 3);
      }
      L.mesh(cylGeo, bronze, 0, 18.6, 0, 0.6, 30, 0.6);
      for (const [y, s] of [[22, 12], [30, 10], [37, 7]]) L.mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({ color: '#6a6048', side: THREE.DoubleSide }), 0, y, 1.2, s, s * 0.7, 1, PI / 2);
      L.mesh(new THREE.CapsuleGeometry(1.1, 3.6, 4, 10).translate(0, 2.9, 0), bronze, 0, 48.6, 0, 1, 1, 1);
      L.mesh(cylGeo, bronze, 0.6, 52, 0, 0.35, 3.5, 0.35).rotation.z = -1;
    },
    // фабрика «Красный Октябрь» с буквами на крыше
    krasny(L) {
      L.box(0, 0, 0, 28, 22, 80, '#9c4a36', 'brick', '#3a2a24');
      L.box(-6, 0, 52, 20, 16, 30, '#a9452f', 'brick', '#3a2a24');
      L.mesh(cylGeo, lam('#8e3d2c'), -8, 0, -30, 1.4, 40, 1.4);
      L.plain(13, 22, 0, 0.3, 6, 60, '#2a2a33');
      L.text('КРАСНЫЙ ОКТЯБРЬ', 13.3, 25, 0, 60, 6, { bg: 'none', fg: '#e8253a', w: 1024, h: 102 });
    },
    // Дом на набережной
    domnab(L) {
      L.box(0, 0, 0, 50, 34, 120, '#9a958c', 'stalin');
      L.plain(0.3, 33.6, 0, 50.6, 0.8, 120.6, '#b0aba2');
      L.box(-10, 34, 30, 22, 8, 26, '#9a958c', 'stalin');
    }
  };

  A3.Batch = Batch;

  A3.unitBox = () => { initGeo(); return unitBox; };
  A3.landmark = function (kind) {
    initGeo();
    const L = new LM();
    if (MODELS[kind]) MODELS[kind](L);
    L.g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    return L.g;
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
