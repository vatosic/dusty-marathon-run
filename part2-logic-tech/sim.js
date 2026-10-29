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

  D.CAD = { min: 156, max: 200, comfort: 172, step: 4 };
  D.BASE_SPEED = 12.4;
  D.JUMP_V = 8.4; D.GRAVITY = 24;

  D.ITEMS = {
    gel:       { label: 'ГЕЛЬ', bonus: 10, sub: '+39 энергии', color: '#ff2e93' },
    banana:    { label: 'БАНАН', bonus: 8, sub: '+44 к запасу калорий', color: '#ffd23f' },
    water:     { label: 'ВОДА', bonus: 5, sub: '+42 воды, пульс ниже', color: '#3fb7ff' },
    breath:    { label: 'ДЫХАНИЕ', bonus: 3, sub: 'пульс ниже, каденс 172', color: '#9ff3ff' },
    pacer:     { label: 'ПЕЙСЕР', bonus: 5, sub: 'защита 8 сек', color: '#8b5cff' },
    caffeine:  { label: 'КОФЕИН', bonus: 12, sub: 'ускорение 6 сек', color: '#c07a3a' },
    magnesium: { label: 'МАГНИЙ', bonus: 4, sub: '+15 энергии, замедление снято', color: '#39e27a' },
    highfive:  { label: 'ДАЙ ПЯТЬ', bonus: 4, sub: '+12 энергии', color: '#c8ff1a' }
  };
  D.OBST = {
    puddle:       { label: 'ЛУЖА', pen: 5, slow: 3, h: 0.14, w: 1.3, jump: true },
    fence:        { label: 'ОГРАЖДЕНИЕ', pen: 8, energy: -12, h: 0.62, w: 1.3, jump: true },
    barrier:      { label: 'ЗАГРАЖДЕНИЕ', pen: 10, h: 1.7, w: 1.35, jump: false },
    photographer: { label: 'ФОТОГРАФ', pen: 7, slow: 2, h: 1.8, w: 0.7, jump: false },
    dog:          { label: 'СОБАКА', pen: 6, slow: 2, h: 0.55, w: 0.95, jump: true },
    runner:       { label: 'БЕГУН', pen: 4, slow: 1.5, h: 1.7, w: 0.6, jump: false }
  };

  // Когда механики становятся доступны (км)
  D.UNLOCK = { magnesium: 5, photographer: 5, dog: 5, breath: 4, pacer: 6.5, highfive: 10 };

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
    let z = kz(0.5);
    let nextStation = kz(1.3);
    const nextSpecial = { caffeine: kz(2.4), breath: kz(4.4), magnesium: kz(5.4), pacer: kz(6.8) };
    const specialGap = { caffeine: [4.5, 6], breath: [3.5, 5], magnesium: [3.5, 5], pacer: [5, 7] };

    const commonItem = (k) => weighted(r, [['gel', 1], ['banana', 1], ['water', 1.25],
      ['breath', k >= D.UNLOCK.breath ? 0.35 : 0], ['magnesium', k >= D.UNLOCK.magnesium ? 0.3 : 0]]);

    while (z < L - kz(0.55)) {
      const k = km(z), d = clamp(k / 40, 0, 1);
      const row = { z, objs: [], block: [false, false, false] };
      const add = (type, lane, extra) => {
        const isItem = !!D.ITEMS[type];
        const o = Object.assign({ type, lane, x: LANES[lane], z, kind: isItem ? 'item' : 'obs', taken: false, hit: false }, extra || {});
        if (!isItem) {
          if (type === 'dog') { row.block[o.a] = row.block[o.a + 1] = true; }
          else if (type === 'photographer') row.block[o.target] = true;
          else row.block[lane] = true;
        }
        row.objs.push(o); objs.push(o);
        return o;
      };
      const djCalm = k >= 23.2 && k <= 24.9;
      let special = null;
      for (const t in nextSpecial) if (z >= nextSpecial[t]) { special = t; break; }

      if (z >= nextStation) {
        // Пункт питания: осознанный выбор ресурса
        const items = shuffle(r, ['gel', 'banana', 'water']);
        items.forEach((t, i) => add(t, i));
        row.station = true;
        nextStation += kz(1.9 + r() * 0.7);
      } else if (special) {
        const g = specialGap[special];
        nextSpecial[special] = z + kz(g[0] + r() * (g[1] - g[0]));
        const lane = Math.floor(r() * 3);
        add(special, lane);
        if (!djCalm && r() < 0.5) {
          const ol = (lane + 1 + Math.floor(r() * 2)) % 3;
          add(r() < 0.5 ? 'puddle' : 'fence', ol);
        }
      } else if (djCalm) {
        const t = weighted(r, [['item', 2], ['highfive', 1.4], ['puddle', 0.6]]);
        if (t === 'item') add(commonItem(k), Math.floor(r() * 3));
        else if (t === 'highfive') add('highfive', 2, { x: 2.65 });
        else add('puddle', Math.floor(r() * 3));
      } else {
        const t = weighted(r, [
          ['single', 3], ['item', 2.3 - d],
          ['double', k > 2.5 ? 1 + 2 * d : 0],
          ['triple', k > 7 ? 0.6 + d : 0],
          ['dog', k >= D.UNLOCK.dog ? 0.9 + d : 0],
          ['photo', k >= D.UNLOCK.photographer ? 0.8 + d : 0],
          ['highfive', k >= D.UNLOCK.highfive ? 0.9 + (k > 36 ? 1.2 : 0) : 0]
        ]);
        if (t === 'single') {
          const ob = weighted(r, [['puddle', 1], ['fence', 1], ['barrier', 1.1]]);
          const lane = Math.floor(r() * 3);
          add(ob, lane);
          if (r() < 0.4) add(commonItem(k), (lane + 1 + Math.floor(r() * 2)) % 3);
        } else if (t === 'item') {
          const lane = Math.floor(r() * 3);
          add(commonItem(k), lane);
          if (r() < 0.3) add(commonItem(k), (lane + 1 + Math.floor(r() * 2)) % 3);
        } else if (t === 'double') {
          const free = Math.floor(r() * 3);
          for (let i = 0; i < 3; i++) if (i !== free) add(r() < 0.75 ? 'barrier' : 'fence', i);
          if (r() < 0.5) add(commonItem(k), free);
        } else if (t === 'triple') {
          for (let i = 0; i < 3; i++) add(r() < 0.5 ? 'fence' : 'puddle', i);
        } else if (t === 'dog') {
          const a = Math.floor(r() * 2);
          add('dog', a, { a, phase: r() * Math.PI * 2, omega: 1.9 + r() * 0.8, dir: 1 });
          if (r() < 0.4) add(commonItem(k), a === 0 ? 2 : 0);
        } else if (t === 'photo') {
          const target = 1 + Math.floor(r() * 2);
          add('photographer', target, { target, x: 3.3 });
          if (r() < 0.4) add(commonItem(k), 0);
        } else if (t === 'highfive') {
          add('highfive', 2, { x: 2.65 });
          if (r() < 0.4) add(r() < 0.5 ? 'puddle' : 'barrier', 0);
        }
      }
      rows.push(row);
      z += lerp(28, 17, d) + r() * 7 + (djCalm ? 6 : 0);
    }
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
    // Лужники: точка Дасти, диджей, танцующие, гуляющие
    sc.dj = { z: djZ, x: 4.7 };
    for (let i = 0; i < 12; i++) {
      sc.fans.push({ z: djZ - 10 + r() * 24, x: 3.5 + r() * 2.2, look: D.randomLook(r, false), pose: 'dance', phase: r() * 6.28, sign: null });
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

  /* ---------------- Состояние забега ---------------- */
  D.newGame = function (participants, seed) {
    seed = seed >>> 0;
    const plan = D.buildPlan(seed);
    return {
      seed, plan, scenery: D.buildScenery(seed), rivals: D.initRivals(participants, seed),
      t: 0, pz: 0, px: 0, lane: 1, vx: 0, y: 0, vy: 0, speed: 0,
      cad: D.CAD.comfort, energy: 100, cal: 100, water: 100, hr: 92,
      bonus: 0, penalty: 0, slowT: 0, caffT: 0, pacerT: 0, invulnT: 0, magT: 0, flashT: 0, hitT: 0, pickT: 0, pickColor: '#fff',
      objIdx: 0, overtakes: 0, position: participants.length + 1, total: participants.length + 1,
      district: 0, unlocked: {}, warn: { energy: false, cal: false, water: false },
      finished: false, finishT: 0, result: 0, finalPos: 0, phase: 0,
      stats: { items: {}, hits: {}, shield: 0, bonusSec: 0, penaltySec: 0 },
      events: []
    };
  };

  D.raceTime = (g) => Math.max(0, g.t * TS + g.penalty - g.bonus);
  D.finalTime = (raw) => Math.max(D.RECORD_SEC, raw);

  D.act = function (g, a) {
    if (g.finished) return;
    if (a === 'left') g.lane = Math.max(0, g.lane - 1);
    else if (a === 'right') g.lane = Math.min(2, g.lane + 1);
    else if (a === 'jump') { if (g.y <= 0.001) { g.vy = D.JUMP_V; g.events.push({ kind: 'jump' }); } }
    else if (a === 'cadUp') g.cad = Math.min(D.CAD.max, g.cad + D.CAD.step);
    else if (a === 'cadDown') g.cad = Math.max(D.CAD.min, g.cad - D.CAD.step);
  };

  D.speedFactors = function (g) {
    const res = (v) => (v < 25 ? 0.7 + 0.3 * (v / 25) : 1);
    const resF = res(g.energy) * res(g.cal) * res(g.water) * (g.hr > 186 ? 0.9 : 1);
    const cadF = 1 + (g.cad - D.CAD.comfort) * 0.011;
    // «форма»: каждый ресурс выше 60% даёт +5% к скорости — грамотное питание ускоряет
    const form = (g.energy > 60) + (g.cal > 60) + (g.water > 60);
    const formF = 1 + 0.05 * form;
    return { resF, cadF, formF, form, slowF: g.slowT > 0 ? 0.68 : 1, caffF: g.caffT > 0 ? 1.35 : 1 };
  };

  function collect(g, o) {
    const def = D.ITEMS[o.type];
    o.taken = true;
    g.bonus += def.bonus; g.stats.bonusSec += def.bonus;
    g.stats.items[o.type] = (g.stats.items[o.type] || 0) + 1;
    let interrupted = false;
    switch (o.type) {
      case 'gel': g.energy = Math.min(100, g.energy + 39); break;
      case 'banana': g.cal = Math.min(100, g.cal + 44); break;
      case 'water': g.water = Math.min(100, g.water + 42); g.hr = Math.max(80, g.hr - 8); break;
      case 'breath': g.hr = Math.max(80, g.hr - 22); g.cad = D.CAD.comfort; break;
      case 'pacer': g.pacerT = 8; break;
      case 'caffeine': g.caffT = 6; g.slowT = 0; break;
      case 'magnesium': g.energy = Math.min(100, g.energy + 15); g.slowT = 0; g.magT = 1.4; break;
      case 'highfive': g.energy = Math.min(100, g.energy + 12); break;
    }
    g.pickT = 0.5; g.pickColor = def.color;
    const title = o.type === 'magnesium' ? 'МАГНИЙ — ВОССТАНОВЛЕНИЕ' : def.label + ' −' + def.bonus + ' сек';
    const sub = o.type === 'magnesium' ? '−4 сек, +15 энергии' : def.sub;
    g.events.push({ kind: 'item', type: o.type, title, sub, good: true, interrupted });
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
    const parts = [];
    if (def.slow) { g.slowT = Math.max(g.slowT, def.slow); parts.push('замедление ' + def.slow + ' сек'); }
    if (def.energy) { g.energy = Math.max(0, g.energy + def.energy); parts.push(def.energy + ' энергии'); }
    if (o.type === 'barrier') parts.push('нужно перестроиться');
    if (g.caffT > 0) { g.caffT = 0; parts.push('ускорение прервано'); }
    if (o.type === 'photographer') g.flashT = 0.4;
    g.invulnT = 1.0; g.hitT = 0.45;
    g.events.push({ kind: 'hit', type: o.type, title: def.label + ' +' + def.pen + ' сек', sub: parts.join(', '), good: false });
  }

  D.update = function (g, dt) {
    if (g.finished) return;
    g.t += dt;
    const km = D.zToKm(g.pz);

    // таймеры эффектов идут в реальном времени симуляции
    g.slowT = Math.max(0, g.slowT - dt); g.caffT = Math.max(0, g.caffT - dt); g.pacerT = Math.max(0, g.pacerT - dt);
    g.invulnT = Math.max(0, g.invulnT - dt); g.magT = Math.max(0, g.magT - dt); g.flashT = Math.max(0, g.flashT - dt);
    g.hitT = Math.max(0, g.hitT - dt); g.pickT = Math.max(0, g.pickT - dt);
    const hadCaff = g.caffEnding; g.caffEnding = g.caffT > 0;
    if (hadCaff && g.caffT <= 0) g.events.push({ kind: 'caffEnd' });

    // пульс: целевая зона зависит от каденса и состояния
    const target = 96 + (g.cad - 150) * 1.9 + (g.caffT > 0 ? 8 : 0) + (g.water < 25 ? 10 : 0) + (g.slowT > 0 ? -4 : 0);
    g.hr += clamp(target - g.hr, -4.5 * dt, 6 * dt);

    // расход ресурсов (условная игровая модель)
    const m = Math.pow(g.cad / D.CAD.comfort, 3);
    const heat = 1 + 0.15 * clamp(km / 42, 0, 1);
    g.energy = clamp(g.energy - (1.1 * m + (g.hr > 172 ? 0.5 : 0)) * dt, 0, 100);
    g.cal = clamp(g.cal - 0.9 * m * dt, 0, 100);
    g.water = clamp(g.water - 1.1 * m * heat * dt, 0, 100);

    // предупреждения с гистерезисом: появление < 25, исчезновение > 40
    for (const k of ['energy', 'cal', 'water']) {
      if (!g.warn[k] && g[k] < 25) g.warn[k] = true;
      else if (g.warn[k] && g[k] > 40) g.warn[k] = false;
    }

    const f = D.speedFactors(g);
    const sp = D.BASE_SPEED * f.cadF * f.resF * f.formF * f.slowF * f.caffF;
    g.speed += (sp - g.speed) * Math.min(1, dt * 3);
    g.pz += g.speed * dt;
    g.formSum = (g.formSum || 0) + f.form * dt;
    g.phase += dt * (g.cad / 60) * Math.PI; // один цикл = два шага

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
      if (o.type === 'dog' || o.type === 'photographer') D.updateDynamic(o, g.t, g.pz);
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
    let ahead = 0;
    const rows = g.plan.rows;
    for (const rv of g.rivals) {
      rv.z = D.rivalZ(rv, g.t);
      const isAhead = rv.z > g.pz;
      rv.ahead = isAhead;
      if (isAhead) ahead++;
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
      [5, 'u5', 'НОВОЕ НА ТРАССЕ', 'магний, фотографы и собаки'],
      [10, 'u10', 'БОЛЕЛЬЩИКИ РЯДОМ', 'правая полоса — «дай пять»'],
      [23, 'u23', 'ТОЧКА ДАСТИ', 'диджей на 24-м км'],
      [39.2, 'u39', 'КРЕМЛЬ ВПЕРЕДИ', 'финиш близко']
    ];
    for (const [k, id, title, sub] of unlockMsgs) if (km >= k && !g.unlocked[id]) { g.unlocked[id] = true; g.events.push({ kind: 'info', title, sub }); }

    // финиш
    if (g.pz >= L) {
      const over = (g.pz - L) / Math.max(1, g.speed);
      g.finishT = Math.max(0, g.t - over);
      g.rawResult = Math.max(0, g.finishT * TS + g.penalty - g.bonus);
      g.result = D.finalTime(g.rawResult);
      g.recordCapped = g.rawResult < D.RECORD_SEC;
      g.finalPos = 1 + g.rivals.filter((rv) => rv.T * TS < g.result).length;
      g.formAvg = g.formSum / Math.max(1, g.t);
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
