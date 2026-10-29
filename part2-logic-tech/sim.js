/* DUSTY Marathon Run — игровая логика (без DOM; проверяется в Node) */
(function (G) {
  'use strict';
  const D = G.DUSTY;
  const L = D.WORLD_LEN, LANES = D.LANES, TS = D.TIME_SCALE;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  D.clamp = clamp; D.lerp = lerp;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  D.rng = mulberry32;

  // Каденс: игрок выбирает 160…200. Каждый пустой запас (гель, питьё, еда) −10, столкновение — на 3 с минус своё значение,
  // бустер — 5 с на 210. Скорость растёт со степенью каденса: шаг чаще и длиннее.
  D.CAD = { min: 160, max: 200, start: 160, step: 4, ref: 180, exp: 1.8, empty: 10, boost: 210, floor: 60 };
  D.BASE_SPEED = 16.2;
  D.JUMP_V = 8.4; D.GRAVITY = 24;

  // Запасы: сколько игровых секунд действует порция (секунда игры = минута марафона: гель — 20 минут бега)
  D.SUPPLY = { gel: 20, drink: 25, food: 30 };
  D.SUPPLY_WARN = 5;   // предупреждение за 5 с до конца запаса
  D.BOOST_T = 5;       // бустер: 5 с на каденсе 210
  D.HIT_T = 3;         // столкновение сбивает каденс на 3 с, затем он возвращается к прежнему
  D.SUPPLY_NAME = { gel: 'гель', drink: 'питьё', food: 'еда' };

  D.ITEMS = {
    gel: { label: 'ГЕЛЬ', supply: 'gel', bonus: 10, color: '#ff2e93', variants: [
      { id: 'sis', name: 'SiS', color: '#1f4fd1' }, { id: 'gel4u', name: 'GEL4U', color: '#ff7a1a' },
      { id: 'gu', name: 'GU', color: '#e8365a' }, { id: 'maurten', name: 'Maurten', color: '#f1f1ec' }] },
    drink: { label: 'ПИТЬЁ', supply: 'drink', bonus: 5, color: '#3fb7ff', variants: [
      { id: 'water', name: 'Вода', color: '#9fdcff' }, { id: 'iso', name: 'Изотоник', color: '#ffb21a' }, { id: 'cola', name: 'Кола', color: '#c8102e' }] },
    food: { label: 'ЕДА', supply: 'food', bonus: 8, color: '#ffd23f', variants: [
      { id: 'banana', name: 'Банан', color: '#ffd23f' }, { id: 'orange', name: 'Апельсин', color: '#ff8c1a' }, { id: 'burger', name: 'Бургер', color: '#c9772e' }] },
    boost: { label: 'БУСТЕР', bonus: 12, color: '#ff9b2e', variants: [
      { id: 'caffeine', name: 'Кофеин', color: '#8a4f22' }, { id: 'magnesium', name: 'Магний', color: '#39e27a' }, { id: 'puer', name: 'Пуэр', color: '#7a2e1c' }] },
    pacer: { label: 'ПЕЙСЕР', bonus: 5, sub: 'защита от столкновений 8 с', color: '#8b5cff' },
    highfive: { label: 'ДАЙ ПЯТЬ', bonus: 4, sub: 'болельщики заряжают', color: '#c8ff1a' }
  };
  D.variantOf = (o) => (D.ITEMS[o.type].variants || []).find((v) => v.id === o.variant) || null;

  // cad — насколько столкновение сбивает каденс; t — сколько секунд (по умолчанию D.HIT_T)
  D.OBST = {
    puddle:       { label: 'ЛУЖА', pen: 5, cad: 10, h: 0.14, w: 1.3, jump: true },
    fanbarrier:   { label: 'ФАН-БАРЬЕР', pen: 8, cad: 50, h: 0.62, w: 1.3, jump: true },
    dog:          { label: 'СОБАКА', pen: 6, cad: 50, h: 0.55, w: 0.95, jump: true },
    photographer: { label: 'ФОТОГРАФ', pen: 7, cad: 50, h: 1.8, w: 0.7, jump: false },
    scooter:      { label: 'САМОКАТЧИК', pen: 9, cad: 50, h: 1.7, w: 0.8, jump: false },
    volunteer:    { label: 'ВОЛОНТЁР', pen: 7, cad: 50, h: 1.75, w: 0.75, jump: false },
    runner:       { label: 'БЕГУН', pen: 4, cad: 20, t: 1.5, h: 1.7, w: 0.6, jump: false }
  };
  // полоса, которую непрыгаемое препятствие перекрывает в своём ряду
  D.hardLane = (o) => (o.type === 'photographer' || o.type === 'scooter' ? o.target : o.lane);

  // Когда механики становятся доступны (км)
  D.UNLOCK = { volunteer: 2.5, magnesium: 5, photographer: 5, dog: 5, pacer: 6.5, scooter: 8, highfive: 10, double: 12, triple: 18 };

  // Ништяков на трассе вдвое больше, чем нужно на идеальный забег 2:00:00 (120 с игры): гель 6, питьё 5, еда 4
  const IDEAL_T = D.RECORD_SEC / TS;
  D.ITEM_COUNT = {
    gel: 2 * Math.ceil(IDEAL_T / D.SUPPLY.gel), drink: 2 * Math.ceil(IDEAL_T / D.SUPPLY.drink), food: 2 * Math.ceil(IDEAL_T / D.SUPPLY.food),
    boost: 8, pacer: 5, highfive: 7
  };

  /* ---------------- План трассы ---------------- */
  function weighted(r, list) {
    let s = 0; for (const [, w] of list) s += Math.max(0, w);
    let x = r() * s;
    for (const [k, w] of list) { x -= Math.max(0, w); if (x <= 0) return k; }
    return list[list.length - 1][0];
  }
  function shuffle(r, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  D.buildPlan = function (seed) {
    const r = mulberry32(seed);
    const objs = [], rows = [];
    const km = D.zToKm, kz = D.kmToZ;
    const C = D.ITEM_COUNT;

    // 1) Где нужны ништяки: каждая категория равномерно по дистанции со случайным сдвигом
    const want = [];
    const spread = (type, n, from, to, jitter) => {
      const step = (to - from) / n;
      for (let i = 0; i < n; i++) want.push({ type, km: from + step * (i + 0.5) + (r() - 0.5) * step * jitter });
    };
    spread('gel', C.gel, 1, 40.8, 0.6); spread('drink', C.drink, 1, 40.8, 0.6); spread('food', C.food, 1, 40.8, 0.6);
    spread('boost', C.boost, 2, 40.5, 0.5); spread('pacer', C.pacer, D.UNLOCK.pacer, 40, 0.5); spread('highfive', C.highfive, D.UNLOCK.highfive + 0.4, 41, 0.5);
    want.sort((a, b) => a.km - b.km);
    let lastItemLane = -1;
    const variant = (type, k) => {
      let vs = D.ITEMS[type].variants;
      if (type === 'boost' && k < D.UNLOCK.magnesium) vs = vs.filter((v) => v.id !== 'magnesium');
      return vs[Math.floor(r() * vs.length)].id;
    };

    // 2) Ряды препятствий: реже и проще в начале, чаще и сложнее к финишу
    let z = kz(0.6);
    while (z < L - kz(0.5)) {
      const k = km(z), d = clamp(k / 42, 0, 1);
      const row = { z, objs: [], block: [false, false, false] };
      const add = (type, lane, extra) => {
        const isItem = !!D.ITEMS[type];
        const o = Object.assign({ type, lane, x: LANES[lane], z, kind: isItem ? 'item' : 'obs', taken: false, hit: false }, extra || {});
        if (!isItem) {
          if (type === 'dog') { row.block[o.a] = row.block[o.a + 1] = true; }
          else row.block[D.hardLane(o)] = true;
        }
        row.objs.push(o); objs.push(o);
        return o;
      };
      const djCalm = k >= 23.2 && k <= 24.9;
      const overdue = want.length && k - want[0].km > 0.8; // ништяк опаздывает — ряд без препятствий
      const t = overdue ? 'empty' : djCalm ? weighted(r, [['empty', 2], ['puddle', 0.7]]) : weighted(r, [
        ['empty', 0.2 + 1.6 * (1 - d)],
        ['puddle', 2.2 - 0.6 * d],
        ['fanbarrier', 1.4],
        ['volunteer', k >= D.UNLOCK.volunteer ? 1.0 : 0],
        ['dog', k >= D.UNLOCK.dog ? 0.6 + 0.8 * d : 0],
        ['photo', k >= D.UNLOCK.photographer ? 0.6 + 0.8 * d : 0],
        ['scooter', k >= D.UNLOCK.scooter ? 0.4 + 1.0 * d : 0],
        ['double', k >= D.UNLOCK.double ? 0.3 + 1.6 * d : 0],
        ['triple', k >= D.UNLOCK.triple ? 0.2 + 0.9 * d : 0]
      ]);
      if (t === 'puddle' || t === 'fanbarrier' || t === 'volunteer') add(t, Math.floor(r() * 3));
      else if (t === 'dog') { const a = Math.floor(r() * 2); add('dog', a, { a, phase: r() * Math.PI * 2, omega: 1.9 + r() * 0.8, dir: 1 }); }
      else if (t === 'photo') { const target = 1 + Math.floor(r() * 2); add('photographer', target, { target, x: 3.3 }); }
      else if (t === 'scooter') { const target = Math.floor(r() * 3); add('scooter', target, { target, x: 5.2, dir: -1 }); }
      else if (t === 'double') {
        const free = Math.floor(r() * 3);
        for (let i = 0; i < 3; i++) if (i !== free) add(weighted(r, [['volunteer', 1.2], ['fanbarrier', 1], ['puddle', 0.6]]), i);
      } else if (t === 'triple') {
        for (let i = 0; i < 3; i++) add(r() < 0.5 ? 'fanbarrier' : 'puddle', i);
      }

      // 3) Ништяк из очереди: один на ряд (не поперёк) и не в той же полосе, что предыдущий (не вдоль)
      for (let j = 0; j < want.length && want[j].km <= k; j++) {
        const w = want[j];
        // «дай пять» — болельщик у правого края, а не предмет на полосе: правило линии на него не действует
        const hf = w.type === 'highfive';
        const lanes = (hf ? [2] : shuffle(r, [0, 1, 2])).filter((l) => !row.block[l] && (hf || l !== lastItemLane));
        if (!lanes.length) continue;
        const l = lanes[0];
        if (hf) add('highfive', 2, { x: 2.65 });
        else { add(w.type, l, D.ITEMS[w.type].variants ? { variant: variant(w.type, k) } : null); lastItemLane = l; }
        want.splice(j, 1);
        break;
      }
      rows.push(row);
      z += lerp(36, 19, d) + r() * 8 + (djCalm ? 6 : 0);
    }
    // не успевшие встать ништяки (редко, у финиша) — в ряды без ништяков с конца, по тем же правилам
    for (const w of want) {
      for (let i = rows.length - 2; i > 0; i--) {
        const row = rows[i];
        if (row.objs.some((o) => o.kind === 'item')) continue;
        const itemIn = (rw) => rw.objs.find((o) => o.kind === 'item' && o.type !== 'highfive');
        const near = [rows.slice(0, i).reverse().find(itemIn), rows.slice(i + 1).find(itemIn)].map((rw) => rw && itemIn(rw));
        const l = (w.type === 'highfive' ? [2] : [0, 1, 2]).find((ln) => !row.block[ln] && (w.type === 'highfive' || !near.some((o) => o && o.lane === ln)));
        if (l == null) continue;
        const o = { type: w.type, lane: l, x: w.type === 'highfive' ? 2.65 : LANES[l], z: row.z, kind: 'item', taken: false, hit: false };
        if (D.ITEMS[w.type].variants) o.variant = variant(w.type, km(row.z));
        row.objs.push(o); objs.push(o);
        break;
      }
    }
    objs.sort((a, b) => a.z - b.z);
    return { objs, rows };
  };

  // Позиция подвижных препятствий — единый источник для отрисовки и столкновений
  D.updateDynamic = function (o, t, pz) {
    if (o.type === 'dog') {
      const s = Math.sin(t * o.omega + o.phase);
      o.x = lerp(LANES[o.a], LANES[o.a + 1], (s + 1) / 2);
      o.dir = Math.cos(t * o.omega + o.phase) >= 0 ? 1 : -1;
    } else if (o.type === 'photographer') {
      const p = clamp((40 - (o.z - pz)) / 16, 0, 1);
      const e = p * p * (3 - 2 * p);
      o.x = lerp(3.3, LANES[o.target], e);
      o.walking = p > 0 && p < 1;
    } else if (o.type === 'scooter') {
      // выезжает с набережной, тормозит в своей полосе, когда герой рядом; пропустив его, уезжает влево
      const dz = o.z - pz;
      const p = clamp((46 - dz) / 20, 0, 1), e = p * p * (3 - 2 * p);
      o.x = dz > -1.5 ? lerp(5.2, LANES[o.target], e) : LANES[o.target] - Math.min(9, (-1.5 - dz) * 0.45);
      o.moving = (p > 0 && p < 1) || dz < -1.5;
    }
  };

  /* ---------------- Декорации ---------------- */
  D.buildScenery = function (seed) {
    const r = mulberry32(seed ^ 0x9e3779b9);
    const kz = D.kmToZ, km = D.zToKm;
    const sc = { buildings: [], trees: [], lamps: [], fans: [], boats: [], bridges: [], landmarks: [], walkers: [], towers: [], posts: [] };
    const lmZ = D.LANDMARKS.map((l) => kz(l.km));
    const kremlinZ = kz(39.3);

    for (let z = -40; z < L + 160;) {
      const k = km(Math.max(0, z));
      const di = D.findDistrict(Math.min(k, 42.19));
      const dist = D.DISTRICTS[di];
      const len = 10 + r() * 18;
      if (z >= kremlinZ - 10) {
        sc.buildings.push({ z, len: 30, xf: -9, depth: 6, h: 7, color: '#b23a2c', kremlin: true });
        z += 30; continue;
      }
      const nearLm = lmZ.some((lz) => Math.abs(lz - z) < 70);
      if (!nearLm && r() > dist.gap) {
        const h = lerp(dist.hMin, dist.hMax, r());
        sc.buildings.push({ z, len, xf: -8 - r() * 2, depth: 10 + r() * 10, h,
          color: dist.palette[Math.floor(r() * dist.palette.length)], floors: Math.min(12, Math.round(h / 3.4)),
          cols: Math.max(2, Math.round(len / 3.2)), roof: r() < 0.3 });
      }
      z += len + 1.5 + r() * 4;
    }
    for (let z = -20; z < L + 160; z += 7 + r() * 7) {
      const k = km(Math.max(0, z));
      const dist = D.DISTRICTS[D.findDistrict(Math.min(k, 42.19))];
      if (r() < dist.trees) sc.trees.push({ z, x: -4.4 - r() * 1.4, kind: r() < 0.25 ? 'poplar' : 'round', h: 4.5 + r() * 3, tone: r() });
    }
    for (let z = 4; z < L + 160; z += 22) {
      sc.lamps.push({ z, x: 5.95, side: 1 });
      if ((z / 22) % 2 < 1) sc.lamps.push({ z: z + 11, x: -3.3, side: -1 });
    }
    for (let z = 0; z < L + 160; z += 9) sc.posts.push({ z });

    // Болельщики у реки: плотность растёт по дистанции, Лужники и финиш — максимум
    const djZ = kz(D.DJ_KM);
    for (let z = 10; z < L + 40; z += 4.2) {
      const k = km(z);
      let dens = 0.12 + 0.35 * clamp((k - 6) / 30, 0, 1);
      if (k > 22 && k < 29) dens += 0.25;
      if (Math.abs(z - djZ) < 70) dens += 0.5;
      if (k > 38) dens += 0.35;
      if (r() < dens) {
        const poseR = r();
        const pose = poseR < 0.3 ? 'wave' : poseR < 0.5 ? 'cheer' : poseR < 0.68 ? 'clap' : poseR < 0.8 ? 'jump' : 'stand';
        const signR = r();
        sc.fans.push({ z, x: 3.6 + r() * 1.9, look: D.randomLook(r, false), pose, phase: r() * 6.28,
          sign: signR < 0.22 ? D.SIGNS[Math.floor(r() * D.SIGNS.length)] : null,
          flag: signR > 0.92 });
      }
    }
    // Любители бега на набережной (бегут навстречу и попутно по прогулочной части)
    for (let z = 60; z < L; z += 70 + r() * 90) {
      sc.walkers.push({ z0: z, x: 4.1 + r() * 1.4, v: (r() < 0.5 ? -1 : 1) * (2.5 + r() * 2), kind: 'jogger', look: D.randomLook(r, false), phase: r() * 6 });
    }
    // Лужники: точка Дасти, диджей, танцпол; ещё две точки поддержки поменьше — тоже рейв
    sc.dj = { z: djZ, x: 4.7 };
    sc.raves = D.RAVE_KM.map((k) => ({ z: kz(k), main: k === D.DJ_KM }));
    for (const rv of sc.raves) {
      const n = rv.main ? 26 : 12, spread = rv.main ? 30 : 16;
      for (let i = 0; i < n; i++) {
        sc.fans.push({ z: rv.z - spread * 0.4 + r() * spread, x: 3.4 + r() * 2.4, look: D.randomLook(r, false), pose: 'dance', phase: r() * 6.28, sign: null,
          flag: !rv.main && i % 5 === 0 });
      }
    }
    for (let i = 0; i < 8; i++) {
      const pair = i % 2;
      sc.walkers.push({ z0: djZ - 140 + Math.floor(i / 2) * 75 + pair * 1.1, x: 4.0 + pair * 0.75, v: (Math.floor(i / 2) % 2 ? -1 : 1) * 0.9,
        kind: 'swim', look: D.randomLook(r, true), phase: r() * 6, chat: true, range: 60 });
    }
    sc.fans.sort((a, b) => a.z - b.z);

    for (const bk of D.BRIDGES) sc.bridges.push({ z: kz(bk), variant: Math.floor(r() * 3) });
    for (const lm of D.LANDMARKS) sc.landmarks.push({ z: kz(lm.km), x: lm.x, kind: lm.kind });
    for (let z = 30; z < L + 200; z += 160 + r() * 160) {
      sc.boats.push({ z0: z, x: 16 + r() * 26, v: (r() < 0.5 ? -1 : 1) * (1 + r() * 1.5), kind: Math.floor(r() * 3) });
    }
    for (let z = kremlinZ + 10; z < L + 200; z += 55 + r() * 25) sc.towers.push({ z, x: -9.5, tall: r() < 0.35 });
    return sc;
  };

  const SKIN = ['#e3b18c', '#d49a72', '#b97f58', '#ecc3a0', '#93603f'];
  const HAIR = ['#2b1d16', '#5a3a22', '#c99a52', '#1c1c1c', '#8a5a33', '#d8c08a'];
  const SHIRTS = ['#ff2e93', '#6c2bd9', '#c8ff1a', '#1e1e28', '#ffffff', '#ff7a1a', '#21c6c6', '#ffd23f', '#3a7bff', '#e8365a'];
  const SWIM = ['#ff2e93', '#21c6c6', '#ffd23f', '#6c2bd9', '#ff7a1a', '#1e1e28'];
  D.randomLook = function (r, swim) {
    const pickA = (a) => a[Math.floor(r() * a.length)];
    const longHair = swim ? true : r() < 0.4;
    return {
      skin: pickA(SKIN), hair: pickA(HAIR), longHair, female: !!swim || longHair,
      shirt: swim ? pickA(SWIM) : pickA(SHIRTS), shorts: swim ? null : pickA(['#1e1e28', '#2f3a55', '#555', '#6c2bd9', '#1e1e28']),
      cap: r() < 0.35 ? pickA(['#ff2e93', '#ffffff', '#1e1e28', '#c8ff1a']) : null,
      shoes: pickA(['#ffffff', '#c8ff1a', '#ff2e93', '#3a7bff', '#222']), swim: !!swim,
      sport: swim ? (r() < 0.5 ? 'two' : 'one') : null, glasses: r() < 0.2
    };
  };

  /* ---------------- Соперники ---------------- */
  D.initRivals = function (participants, seed) {
    const r = mulberry32(seed ^ 0x51ed27);
    const N = participants.length;
    return participants.map((p, i) => {
      const f = N > 1 ? i / (N - 1) : 0.5;
      const z0 = 6 + Math.pow(r(), 1.1) * D.kmToZ(20) + f * 4;
      const T = 128 + Math.pow(r(), 0.85) * 170; // секунды игры до финиша (2:08:00 … 4:58:00)
      return { id: p.id, name: p.name, z0, T, bumpT: 0, bumpDir: 1, v: (L - z0) / T, lane: Math.floor(r() * 3), x: 0, z: z0, ahead: true, passed: false,
        phase: r() * 6.28, look: D.randomLook(r, false), dodge: 0 };
    }).map((rv) => { rv.x = LANES[rv.lane]; return rv; });
  };
  D.rivalZ = (rv, t) => Math.min(L, rv.z0 + rv.v * t);

  /* ---------------- Звёзды бега ---------------- */
  // Выходят на D.STARS_KM вне поля зрения. Темп — от среднего темпа игрока: при нём встречи идут с ~35 км
  // до финиша, сначала спринтеры, последними марафонцы; двух последних без ускорения до финиша не догнать.
  const STAR_F = { sprint: [0.45, 0.55], mid: [0.55, 0.65], long: [0.66, 0.76] };
  function spawnStars(g) {
    const r = mulberry32(g.seed ^ 0x5ea75);
    const vAvg = g.pz / Math.max(1, g.t);
    const order = ['sprint', 'mid', 'long'].reduce((a, k) => a.concat(shuffle(r, D.STARS.filter((st) => st.kind === k))), []);
    const n = order.length, S = D.zToKm(g.pz), endKm = D.KM_TOTAL + 0.4;
    order.forEach((st, k) => {
      const C = D.kmToZ((endKm - S) * (0.45 + 0.55 * k / Math.max(1, n - 1))); // путь игрока до встречи
      const fr = STAR_F[st.kind], f = fr[0] + r() * (fr[1] - fr[0]);
      const d = Math.max(180, (1 - f) * C);
      const v = Math.max(vAvg * 0.3, vAvg * (C - d) / C);
      const lane = Math.floor(r() * 3);
      g.rivals.push({ id: 'star-' + (k + 1), name: st.name, tag: st.tag, star: true, z0: g.pz + d - v * g.t, v, T: 0,
        bumpT: 0, bumpDir: 1, lane, x: LANES[lane], z: g.pz + d, ahead: true, passed: false, phase: r() * 6.28, dodge: 0,
        look: { skin: SKIN[Math.floor(r() * SKIN.length)], hair: HAIR[Math.floor(r() * HAIR.length)], longHair: st.female, female: st.female,
          shirt: '#ffffff', shorts: '#1e3a8a', stripe: '#ffd23f', cap: null, shoes: '#ffd23f', swim: false, sport: null, glasses: false } });
    });
    g.starsOn = true;
    g.events.push({ kind: 'info', title: 'ЗВЁЗДЫ БЕГА НА ТРАССЕ', sub: 'лучшие бегуны России впереди — догони до финиша' });
  }

  /* ---------------- Состояние забега ---------------- */
  D.newGame = function (participants, seed) {
    seed = seed >>> 0;
    const plan = D.buildPlan(seed);
    return {
      seed, plan, scenery: D.buildScenery(seed), rivals: D.initRivals(participants, seed),
      t: 0, pz: 0, px: 0, lane: 1, vx: 0, y: 0, vy: 0, speed: 0,
      cad: D.CAD.start, cadEff: D.CAD.start, gel: D.SUPPLY.gel, drink: D.SUPPLY.drink, food: D.SUPPLY.food, hr: 92,
      bonus: 0, penalty: 0, boostT: 0, boostKind: '', pacerT: 0, invulnT: 0, hitPen: 0, hitPenT: 0,
      flashT: 0, hitT: 0, pickT: 0, pickColor: '#fff',
      objIdx: 0, overtakes: 0, position: participants.length + 1, total: participants.length + 1,
      district: 0, unlocked: {}, warn: { gel: false, drink: false, food: false }, splits: [],
      finished: false, finishT: 0, result: 0, finalPos: 0, phase: 0,
      starsOn: false, stats: { items: {}, hits: {}, shield: 0, bonusSec: 0, penaltySec: 0, stars: 0 },
      events: []
    };
  };

  D.raceTime = (g) => Math.max(0, g.t * TS + g.penalty - g.bonus);
  D.fmtTime = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  D.finalTime = (raw) => Math.max(D.RECORD_SEC, raw);

  D.act = function (g, a) {
    if (g.finished) return;
    if (a === 'left') g.lane = Math.max(0, g.lane - 1);
    else if (a === 'right') g.lane = Math.min(2, g.lane + 1);
    else if (a === 'jump') { if (g.y <= 0.001) { g.vy = D.JUMP_V; g.events.push({ kind: 'jump' }); } }
    else if (a === 'cadUp') g.cad = Math.min(D.CAD.max, g.cad + D.CAD.step);
    else if (a === 'cadDown') g.cad = Math.max(D.CAD.min, g.cad - D.CAD.step);
  };

  // Фактический каденс: бустер — 210; иначе выбранный минус 10 за каждый пустой запас и минус сбитый столкновением темп
  D.speedFactors = function (g) {
    const empty = (g.gel <= 0) + (g.drink <= 0) + (g.food <= 0);
    const cad = g.boostT > 0 ? D.CAD.boost : Math.max(D.CAD.floor, g.cad - D.CAD.empty * empty - (g.hitPenT > 0 ? g.hitPen : 0));
    return { cad, empty, cadF: Math.pow(cad / D.CAD.ref, D.CAD.exp) };
  };

  function collect(g, o) {
    const def = D.ITEMS[o.type], v = D.variantOf(o);
    o.taken = true;
    g.bonus += def.bonus; g.stats.bonusSec += def.bonus;
    g.stats.items[o.type] = (g.stats.items[o.type] || 0) + 1;
    let title = (v ? v.name.toUpperCase() : def.label) + ' −' + def.bonus + ' сек', sub = def.sub;
    if (def.supply) {
      const k = def.supply, wasEmpty = g[k] <= 0;
      g[k] = D.SUPPLY[k];
      if (o.type === 'gel') title = 'ГЕЛЬ ' + v.name + ' −' + def.bonus + ' сек';
      sub = D.SUPPLY_NAME[k] + ' на ' + D.SUPPLY[k] + ' с' + (wasEmpty ? ' · каденс +' + D.CAD.empty : '');
    } else if (o.type === 'boost') {
      g.boostT = D.BOOST_T; g.boostKind = v.id; g.hitPen = 0; g.hitPenT = 0;
      sub = D.BOOST_T + ' с на каденсе ' + D.CAD.boost;
    } else if (o.type === 'pacer') g.pacerT = 8;
    g.pickT = 0.5; g.pickColor = v ? v.color : def.color;
    g.events.push({ kind: 'item', type: o.type, variant: o.variant, title, sub, good: true });
  }

  function hit(g, o) {
    const def = D.OBST[o.type];
    if (g.invulnT > 0) return;
    if (g.pacerT > 0) {
      o.hit = true; g.invulnT = 0.6; g.stats.shield++;
      g.events.push({ kind: 'shield', type: o.type, title: 'ПЕЙСЕР ЗАЩИТИЛ', sub: def.label.toLowerCase() + ' без штрафа', good: true });
      return;
    }
    o.hit = true;
    g.penalty += def.pen; g.stats.penaltySec += def.pen;
    g.stats.hits[o.type] = (g.stats.hits[o.type] || 0) + 1;
    // темп сбит на своё значение и вернётся к прежнему через 3 с (повторное столкновение — по большему)
    const dur = def.t || D.HIT_T;
    g.hitPen = Math.max(g.hitPenT > 0 ? g.hitPen : 0, def.cad); g.hitPenT = Math.max(g.hitPenT, dur);
    const parts = ['каденс −' + def.cad + ' на ' + dur + ' с'];
    if (g.boostT > 0) { g.boostT = 0; parts.push('бустер прерван'); }
    if (o.type === 'photographer') g.flashT = 0.4;
    g.invulnT = 1.0; g.hitT = 0.45;
    g.events.push({ kind: 'hit', type: o.type, title: def.label + ' +' + def.pen + ' сек', sub: parts.join(', '), good: false });
  }

  D.update = function (g, dt) {
    if (g.finished) return;
    g.t += dt;
    const km = D.zToKm(g.pz);

    // таймеры эффектов идут в реальном времени симуляции
    g.pacerT = Math.max(0, g.pacerT - dt); g.invulnT = Math.max(0, g.invulnT - dt); g.flashT = Math.max(0, g.flashT - dt);
    g.hitT = Math.max(0, g.hitT - dt); g.pickT = Math.max(0, g.pickT - dt);
    if (g.boostT > 0) { g.boostT = Math.max(0, g.boostT - dt); if (g.boostT === 0) g.events.push({ kind: 'boostEnd' }); }
    if (g.hitPenT > 0) { g.hitPenT = Math.max(0, g.hitPenT - dt); if (g.hitPenT === 0) g.hitPen = 0; }

    // запасы тают по секундам игры; за 5 с до конца — предупреждение, на нуле — каденс −10
    for (const k of ['gel', 'drink', 'food']) {
      const was = g[k];
      g[k] = Math.max(0, g[k] - dt);
      if (was > D.SUPPLY_WARN && g[k] <= D.SUPPLY_WARN) g.events.push({ kind: 'warn', res: k });
      if (was > 0 && g[k] <= 0) g.events.push({ kind: 'empty', res: k });
      g.warn[k] = g[k] <= D.SUPPLY_WARN;
    }

    const f = D.speedFactors(g);
    g.cadEff = f.cad;
    // пульс следует за фактическим каденсом (индикатор нагрузки)
    g.hr += clamp(95 + (f.cad - 150) * 1.6 - g.hr, -4.5 * dt, 6 * dt);
    const sp = D.BASE_SPEED * f.cadF;
    g.speed += (sp - g.speed) * Math.min(1, dt * 3);
    g.pz += g.speed * dt;
    g.phase += dt * (f.cad / 60) * Math.PI; // один цикл = два шага

    // перестроение
    const tx = LANES[g.lane];
    const dx = clamp(tx - g.px, -11 * dt, 11 * dt);
    g.vx = dt > 0 ? dx / dt : 0;
    g.px += dx;

    // прыжок
    if (g.y > 0 || g.vy > 0) {
      g.vy -= D.GRAVITY * dt; g.y += g.vy * dt;
      if (g.y <= 0) { g.y = 0; g.vy = 0; }
    }

    // подвижные объекты и столкновения
    const objs = g.plan.objs;
    while (g.objIdx < objs.length && objs[g.objIdx].z < g.pz - 15) g.objIdx++;
    for (let i = g.objIdx; i < objs.length; i++) {
      const o = objs[i];
      if (o.z > g.pz + 280) break;
      if (o.type === 'dog' || o.type === 'photographer' || o.type === 'scooter') D.updateDynamic(o, g.t, g.pz);
      if (o.taken || o.hit) continue;
      const dz = o.z - g.pz;
      if (dz < -1.2 || dz > 1.2) continue;
      if (o.kind === 'item') {
        if (Math.abs(dz) < 0.9) {
          const ok = o.type === 'highfive' ? g.px > 0.8 : (Math.abs(o.x - g.px) < 0.8 && g.y < 1.5);
          if (ok) collect(g, o);
        }
      } else {
        const def = D.OBST[o.type];
        if (Math.abs(dz) < (o.type === 'dog' ? 0.6 : 0.5) && Math.abs(o.x - g.px) < def.w / 2 + 0.3 && g.y < def.h) hit(g, o);
      }
    }

    // соперники
    if (!g.starsOn && km >= D.STARS_KM) spawnStars(g);
    let ahead = 0;
    const rows = g.plan.rows;
    for (const rv of g.rivals) {
      rv.z = D.rivalZ(rv, g.t);
      const isAhead = rv.z > g.pz;
      rv.ahead = isAhead;
      if (rv.star) {
        // финишировавшая раньше игрока звезда (z = L) не обогнана
        if (!isAhead && !rv.passed && rv.z < L) { rv.passed = true; g.stats.stars++; g.events.push({ kind: 'star', title: rv.name + ' позади', sub: rv.tag }); }
      } else if (isAhead) ahead++;
      const dz = rv.z - g.pz;
      if (dz > -12 && dz < 160) {
        rv.phase += dt * (2.4 + rv.v * 0.06) * Math.PI;
        // обход препятствий: ищем ряд впереди
        let desired = rv.lane;
        const row = D.rowNear(rows, rv.z, 1, 12);
        if (row && row.block[desired]) {
          // честность: не подрезаем игрока, который бежит прямо за соперником
          const playerClose = dz > 0 && dz < 9;
          const order = [desired - 1, desired + 1, desired - 2, desired + 2].filter((l) => l >= 0 && l < 3);
          for (const l of order) if (!row.block[l] && !(playerClose && Math.abs(LANES[l] - g.px) < 0.8)) { desired = l; break; }
        }
        if (rv.bumpT > 0) rv.bumpT -= dt;
        let target = LANES[desired] + (rv.bumpT > 0 ? rv.bumpDir * 0.7 : 0);
        // соперник, догоняющий сзади, сам обходит игрока
        if (dz < 0 && dz > -2.6 && rv.v > g.speed && Math.abs(target - g.px) < 0.9) target += rv.x >= g.px ? 0.8 : -0.8;
        target = clamp(target, -2.2, 2.2);
        rv.x += clamp(target - rv.x, -3.5 * dt, 3.5 * dt);
      }
    }
    // догнал бегуна в своей полосе и не обошёл — столкновение
    if (g.invulnT <= 0) {
      for (const rv of g.rivals) {
        const dz = rv.z - g.pz;
        if (dz > 0 && dz < 0.55 && Math.abs(rv.x - g.px) < 0.6 && g.y < 0.6 && g.speed > rv.v) {
          rv.bumpT = 2.5; rv.bumpDir = rv.x >= g.px ? 1 : -1;
          hit(g, { type: 'runner', hit: false });
          break;
        }
      }
    }
    g.position = 1 + ahead;
    g.overtakes = g.total - g.position; // все соперники стартуют впереди

    // район и новые механики
    const di = D.findDistrict(Math.min(km, 42.19));
    if (di !== g.district) { g.district = di; g.events.push({ kind: 'district', title: D.DISTRICTS[di].name, sub: '' }); }
    const unlockMsgs = [
      [D.UNLOCK.volunteer, 'u2', 'НОВОЕ НА ТРАССЕ', 'волонтёры — их не перепрыгнуть'],
      [5, 'u5', 'НОВОЕ НА ТРАССЕ', 'фотографы, собаки и магний'],
      [D.UNLOCK.scooter, 'u8', 'ОСТОРОЖНО', 'самокатчики выезжают с набережной'],
      [10, 'u10', 'БОЛЕЛЬЩИКИ РЯДОМ', 'правая полоса — «дай пять»'],
      [D.RAVE_KM[0] - 0.5, 'r0', 'ДАСТИ НА ТРАССЕ', 'рейв поддержки — слышишь бит?'],
      [D.TRACK_KM[0] - 0.4, 'u22', 'ЛУЖНИКИ', 'впереди беговое покрытие и точка Дасти'],
      [D.DJ_KM - 0.6, 'u23', 'ТОЧКА ДАСТИ', 'за пультом DJ KIM'],
      [D.RAVE_KM[2] - 0.5, 'r2', 'ДАСТИ НА ТРАССЕ', 'ещё один рейв поддержки'],
      [39.2, 'u39', 'КРЕМЛЬ ВПЕРЕДИ', 'финиш близко']
    ];
    for (const [k, id, title, sub] of unlockMsgs) if (km >= k && !g.unlocked[id]) { g.unlocked[id] = true; g.events.push({ kind: 'info', title, sub }); }
    // отметки каждых 5 км со сплитом
    const mark = Math.floor(km / 5) * 5;
    if (mark >= 5 && mark < 42 && g.splits.length < mark / 5) {
      while (g.splits.length < mark / 5) g.splits.push(D.raceTime(g));
      g.events.push({ kind: 'km', km: mark, title: mark + ' КМ', sub: 'сплит ' + D.fmtTime(D.raceTime(g)) });
    }

    // финиш
    if (g.pz >= L) {
      const over = (g.pz - L) / Math.max(1, g.speed);
      g.finishT = Math.max(0, g.t - over);
      g.rawResult = Math.max(0, g.finishT * TS + g.penalty - g.bonus);
      g.result = D.finalTime(g.rawResult);
      g.recordCapped = g.rawResult < D.RECORD_SEC;
      g.finalPos = 1 + g.rivals.filter((rv) => !rv.star && rv.T * TS < g.result).length;
      g.overtakes = g.total - g.finalPos;
      g.finished = true;
      g.events.push({ kind: 'finish' });
    }
  };

  // ближайший ряд по курсу (z+from … z+to)
  D.rowNear = function (rows, z, from, to) {
    let lo = 0, hi = rows.length - 1, idx = rows.length;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (rows[mid].z >= z + from) { idx = mid; hi = mid - 1; } else lo = mid + 1; }
    const row = rows[idx];
    return row && row.z <= z + to ? row : null;
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
