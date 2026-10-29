/* Проверка игровых правил: node test/test.js */
require('../part2-logic-tech/data.js');
require('../part2-logic-tech/sim.js');
const D = globalThis.DUSTY;
let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL:', msg); } };
const L = D.WORLD_LEN, LANES = D.LANES;

// 1. Проходимость плана и порядок открытия механик
for (let seed = 1; seed <= 40; seed++) {
  const { rows, objs } = D.buildPlan(seed * 7919);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const hard = row.objs.filter((o) => o.kind === 'obs' && !D.OBST[o.type].jump);
    const blockedHard = new Set();
    hard.forEach((o) => blockedHard.add(o.type === 'photographer' ? o.target : o.lane));
    ok(blockedHard.size <= 2, `seed ${seed} row ${i}: все три полосы закрыты непрыгаемыми`);
    if (i > 0) ok(row.z - rows[i - 1].z >= 16.9, `seed ${seed} row ${i}: ряды слишком близко`);
  }
  for (const o of objs) {
    const km = D.zToKm(o.z);
    if (['magnesium', 'photographer', 'dog'].includes(o.type)) ok(km >= 5, `${o.type} до 5 км (${km.toFixed(1)})`);
    if (o.type === 'highfive') ok(km >= 10, `«дай пять» до 10 км`);
    ok(o.z < L, 'объект за финишем');
  }
  // питание регулярно по всей дистанции
  const st = rows.filter((r) => r.station).map((r) => D.zToKm(r.z));
  for (let i = 1; i < st.length; i++) ok(st[i] - st[i - 1] < 3, 'пункты питания реже 3 км');
  ok(st.length >= 14, 'мало пунктов питания: ' + st.length);
}

// 2. Порядок районов
const names = D.DISTRICTS.map((d) => d.name.split(' ')[0]);
ok(names.join(',') === 'Краснопресненская,Смоленская,Ростовская,Саввинская,Новодевичья,Лужнецкая,Фрунзенская,Пречистенская,Кремлёвская', 'порядок районов');
ok(D.findDistrict(6.9) === 0 && D.findDistrict(7) === 1 && D.findDistrict(24) === 5 && D.findDistrict(42) === 8, 'границы районов');

// 3. Импорт участников
{
  const csv = 'id;name;club;long_runs_attended;email\n' +
    '5;Анна;  пыльные   ГАНТЕЛИ ;12;a@x.ru\n' +
    '3;Борис;Dusty Dumbbells;12;\n' +
    '9;Вера;Другой клуб;50;\n' +
    '4;"Глеб, мл.";Пыльные Гантели;7;\n' +
    '4;Глеб;Пыльные Гантели;7;\n' +
    ';Без ID;Пыльные Гантели;99;\n';
  const { participants: p, stats } = D.importParticipants(csv, 'x.csv');
  ok(p.length === 3, 'CSV: три участника клуба');
  ok(p[0].id === '3' && p[1].id === '5', 'CSV: равенство решается по ID');
  ok(p[2].name === 'Глеб, мл.' && p[2].count === 7, 'CSV: кавычки и дубли не удваивают');
  ok(!('email' in p[0]), 'CSV: лишние поля не сохраняются');
  ok(stats.skippedNoId === 1, 'CSV: строка без ID пропущена');

  const ev = [
    { user_id: 1, name: 'А', club: 'Пыльные Гантели', event_id: 'L1', attended: true },
    { user_id: 1, name: 'А', club: 'Пыльные Гантели', event_id: 'L2', attended: 'да' },
    { user_id: 1, name: 'А', club: 'Пыльные Гантели', event_id: 'L2', attended: 1 },
    { user_id: 2, name: 'Б', club: 'пыльные гантели', event_id: 'L1', attended: false },
    { user_id: 2, name: 'Б', club: 'пыльные гантели', event_id: 'L3', attended: 1 },
    { user_id: 3, name: 'В', club: 'Run Club', event_id: 'L1', attended: 1 }
  ];
  const r2 = D.importParticipants(JSON.stringify(ev), 'x.json');
  ok(r2.participants.length === 2 && r2.participants[0].count === 2 && r2.participants[1].count === 1, 'JSON-события: только посещения, уникальные');
  ok(r2.stats.attendedKnown, 'JSON: посещения отделены от регистраций');

  const big = ['id,name,club,long_runs_attended'];
  for (let i = 1; i <= 150; i++) big.push(`${i},U${i},Пыльные Гантели,${i % 37}`);
  const r3 = D.importParticipants(big.join('\n'), 'b.csv');
  ok(r3.participants.length === 100, 'топ-100');
  let sorted = true;
  for (let i = 1; i < 100; i++) {
    const a = r3.participants[i - 1], b = r3.participants[i];
    if (a.count < b.count || (a.count === b.count && Number(a.id) > Number(b.id))) sorted = false;
  }
  ok(sorted, 'сортировка по посещениям и ID');
  let threw = false; try { D.importParticipants('a,b\n1,2', 'x.csv'); } catch (e) { threw = true; }
  ok(threw, 'понятная ошибка без нужных колонок');
  ok(D.demoParticipants().length === 100 && new Set(D.demoParticipants().map((p) => p.name)).size === 100, 'демо: 100 уникальных');
}

// 4. Позиция при разном числе соперников
for (const n of [0, 1, 5, 100]) {
  const g = D.newGame(D.demoParticipants().slice(0, n), 42);
  D.update(g, 0.016);
  ok(g.position === n + 1 && g.total === n + 1, `стартовая позиция ${n + 1} из ${n + 1}`);
}

// 5. Столкновения, прыжок, неуязвимость, пейсер, кофеин
function rigged(objs) {
  const g = D.newGame([], 1);
  g.plan = { objs, rows: [] };
  g.scenery = null;
  return g;
}
const mk = (type, z, lane, extra) => Object.assign({ type, lane, x: LANES[lane], z, kind: D.ITEMS[type] ? 'item' : 'obs', taken: false, hit: false }, extra || {});
const run = (g, sec, fn) => { const dt = 1 / 60; for (let t = 0; t < sec; t += dt) { if (fn) fn(g); D.update(g, dt); } };
{
  let g = rigged([mk('fence', 30, 1)]); g.speed = 14.5; run(g, 3);
  ok(g.stats.hits.fence === 1 && g.penalty === 8, 'ограждение без прыжка: +8');
  // прыжок с правильным упреждением
  g = rigged([mk('fence', 30, 1)]); g.speed = 14.5;
  let jumped = false; run(g, 3, (gg) => { if (!jumped && 30 - gg.pz < 4.2) { D.act(gg, 'jump'); jumped = true; } });
  ok(!g.stats.hits.fence, 'прыжок через ограждение');
  g = rigged([mk('barrier', 30, 1)]); g.speed = 14.5; jumped = false;
  run(g, 3, (gg) => { if (!jumped && 30 - gg.pz < 4.2) { D.act(gg, 'jump'); jumped = true; } });
  ok(g.stats.hits.barrier === 1, 'крупное заграждение не перепрыгнуть');
  g = rigged([mk('barrier', 30, 1)]); D.act(g, 'left'); run(g, 3);
  ok(!g.stats.hits.barrier, 'перестроение спасает');
  // неуязвимость: две лужи подряд
  g = rigged([mk('puddle', 30, 1), mk('puddle', 31.2, 1)]); run(g, 4);
  ok(g.stats.hits.puddle === 1, 'короткая неуязвимость после столкновения');
  // пейсер
  g = rigged([mk('pacer', 20, 1), mk('barrier', 60, 1)]); run(g, 6);
  ok(g.stats.shield === 1 && !g.stats.hits.barrier && g.penalty === 0, 'пейсер поглощает столкновение');
  g = rigged([mk('pacer', 20, 1), mk('barrier', 220, 1)]); run(g, 20);
  ok(g.stats.hits.barrier === 1, 'защита пейсера заканчивается через 8 сек');
  // кофеин и его завершение
  g = rigged([mk('caffeine', 15, 1)]); run(g, 2);
  ok(g.caffT > 0 && g.stats.items.caffeine === 1, 'кофеин активен');
  const sp = g.speed; run(g, 6);
  ok(g.caffT === 0 && g.speed < sp, 'кофеин завершается');
  g = rigged([mk('caffeine', 15, 1), mk('puddle', 40, 1)]); run(g, 3);
  ok(g.caffT === 0 && g.slowT > 0, 'столкновение прерывает ускорение');
  // магний снимает замедление
  g = rigged([mk('puddle', 20, 1), mk('magnesium', 35, 1)]); run(g, 4.5);
  ok(g.slowT === 0 && g.magT >= 0 && g.stats.items.magnesium === 1, 'магний снимает замедление');
  // кофеин снимает замедление
  g = rigged([mk('puddle', 20, 1), mk('caffeine', 32, 1)]); run(g, 4);
  ok(g.slowT === 0, 'кофеин снимает замедление');
  // каждый предмет и бонус
  for (const t of Object.keys(D.ITEMS)) {
    g = rigged([t === 'highfive' ? mk(t, 20, 2, { x: 2.65 }) : mk(t, 20, 1)]);
    if (t === 'highfive') D.act(g, 'right');
    g.energy = 50; g.cal = 50; g.water = 50;
    run(g, 2.5);
    ok(g.stats.items[t] === 1 && g.bonus === D.ITEMS[t].bonus, 'подбор: ' + t);
  }
  g = rigged([mk('gel', 20, 1)]); g.energy = 10; run(g, 2.5);
  ok(g.energy > 45, 'гель +39 энергии');
  // бонус не двигает мир
  g = rigged([mk('gel', 20, 1)]); run(g, 2.5);
  const g2 = rigged([]); run(g2, 2.5);
  ok(Math.abs(g.pz - g2.pz) < 1e-6 && Math.abs(g.t - g2.t) < 1e-9, 'бонус меняет только результат, не мир');
  ok(Math.abs(D.raceTime(g) - (g2.t * 60 - 10)) < 1e-6, 'время = t×60 − бонусы');
  // время не отрицательное
  g = rigged([]); g.bonus = 99999; ok(D.raceTime(g) === 0, 'время не отрицательное');
  // собака: зона столкновения = видимое положение
  g = rigged([mk('dog', 40, 0, { a: 0, phase: 0, omega: 2.2, dir: 1 })]);
  let hitX = null;
  run(g, 4, (gg) => { const o = gg.plan.objs[0]; if (o.hit && hitX === null) hitX = o.x; });
  const dog = g.plan.objs[0];
  ok(dog.x !== LANES[0] || dog.hit, 'собака двигается');
  if (dog.hit) ok(Math.abs(hitX - g.px) < D.OBST.dog.w / 2 + 0.3, 'столкновение с собакой там, где она видна');
  // предупреждения с гистерезисом
  g = rigged([]); g.energy = 24; D.update(g, 0.01); ok(g.warn.energy, 'предупреждение < 25');
  g.energy = 35; D.update(g, 0.01); ok(g.warn.energy, 'держится до 40');
  g.energy = 41; D.update(g, 0.01); ok(!g.warn.energy, 'снимается > 40');
}

// 6. Полные забеги ботами
function bot(g, mode) {
  const p = g;
  if (mode === 'passive') return;
  const row = D.rowNear(g.plan.rows, g.pz, 0.5, 34);
  // бегуны впереди в полосах
  const runnerBlock = [false, false, false];
  for (const rv of g.rivals) { const dz = rv.z - g.pz; if (dz > 0 && dz < (mode === 'perfect' ? 14 : 6) && rv.v < g.speed) { for (let l = 0; l < 3; l++) if (Math.abs(LANES[l] - rv.x) < 0.75) runnerBlock[l] = true; } }
  const need = { gel: 100 - g.energy, banana: 100 - g.cal, water: 100 - g.water, magnesium: 100 - g.energy - 20,
    caffeine: 40, pacer: 25, breath: g.hr > 178 ? 40 : 0, highfive: 15 };
  let best = p.lane, bestScore = -1e9;
  for (let l = 0; l < 3; l++) {
    let s = -Math.abs(l - p.lane) * 2 - (runnerBlock[l] ? 30 : 0);
    if (row) {
      const hard = row.objs.some((o) => o.kind === 'obs' && !D.OBST[o.type].jump && (o.type === 'photographer' ? o.target === l : o.lane === l));
      if (hard) continue;
      if (row.block[l]) s -= (mode === 'perfect' ? 25 : 15);
      for (const o of row.objs) if (o.kind === 'item' && !o.taken && (o.lane === l || (o.type === 'highfive' && l === 2))) s += Math.max(need[o.type] || 0, 0);
    }
    if (s > bestScore) { bestScore = s; best = l; }
  }
  p.lane = best;
  if (row) for (const o of row.objs) if (o.kind === 'obs' && D.OBST[o.type].jump && Math.abs(o.x - p.px) < 1.1) {
    const d = o.z - p.pz, lead = p.speed * 0.3;
    if (d < lead + 0.6 && d > lead - 1.5) D.act(g, 'jump');
  }
  const target = mode === 'perfect' ? (g.hr > 182 ? 188 : 196) : 180;
  const low = g.energy < 45 || g.water < 40 || g.cal < 40;
  if (low && g.cad > 176) D.act(g, 'cadDown');
  else if (!low && g.cad < target) D.act(g, 'cadUp');
  else if (g.cad > target) D.act(g, 'cadDown');
}
for (const mode of ['perfect', 'smart', 'passive']) {
  const res = [];
  for (let s = 1; s <= 8; s++) {
    const g = D.newGame(D.demoParticipants(), s * 1013);
    let minE = 100, minW = 100, minC = 100;
    const dt = 1 / 60; let steps = 0;
    while (!g.finished && steps < 60 * 900) {
      bot(g, mode); D.update(g, dt); steps++;
      minE = Math.min(minE, g.energy); minW = Math.min(minW, g.water); minC = Math.min(minC, g.cal);
      g.events.length = 0;
    }
    ok(g.finished, 'забег завершён');
    ok(g.result >= D.RECORD_SEC, 'не быстрее рекорд-лимита');
    res.push({ game: fmtMS(g.finishT), raw: fmt(g.rawResult), result: fmt(g.result), pos: g.finalPos, minE: minE | 0, minW: minW | 0, minC: minC | 0,
      hits: JSON.stringify(g.stats.hits).replace(/[{}"]/g,''), form: (g.formAvg || 0).toFixed(2) });
  }
  console.log({ perfect: 'Идеальный бот:', smart: 'Средний бот:', passive: 'Пассивный (без управления):' }[mode]);
  console.table(res);
}
function fmtMS(s) { return Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0'); }
function fmt(s) { s = Math.round(s); return Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }

console.log(`\n${passes} проверок пройдено, ${fails} не пройдено`);
process.exit(fails ? 1 : 0);
