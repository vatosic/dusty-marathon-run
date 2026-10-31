/* Проверка игровых правил: node test/test.js */
require('../part2-logic-tech/data.js');
require('../part2-logic-tech/club.js');
require('../part2-logic-tech/sim.js');
const D = globalThis.DUSTY;
let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL:', msg); } };
const L = D.WORLD_LEN, LANES = D.LANES;

// 1. План трассы: проходимость, ништяки по правилам, открытие механик, рост сложности
for (let seed = 1; seed <= 40; seed++) {
  const { rows, objs } = D.buildPlan(seed * 7919);
  let prevItemLane = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const blockedHard = new Set(row.objs.filter((o) => o.kind === 'obs' && !D.OBST[o.type].jump).map(D.hardLane));
    ok(blockedHard.size <= 2, `seed ${seed} row ${i}: все три полосы закрыты непрыгаемыми`);
    if (i > 0) ok(row.z - rows[i - 1].z >= 16.9, `seed ${seed} row ${i}: ряды слишком близко`);
    const items = row.objs.filter((o) => o.kind === 'item');
    ok(items.length <= 1, `seed ${seed} row ${i}: ништяки поперёк трассы`);
    const it = items.find((o) => o.type !== 'highfive');
    if (it) {
      ok(it.lane !== prevItemLane, `seed ${seed} row ${i}: ништяки вдоль одной полосы`);
      ok(!row.block[it.lane], `seed ${seed} row ${i}: ништяк в полосе с препятствием`);
      prevItemLane = it.lane;
    }
  }
  const count = {}, at = { gel: [], drink: [], food: [] };
  for (const o of objs) {
    const km = D.zToKm(o.z);
    if (o.kind === 'item') { count[o.type] = (count[o.type] || 0) + 1; if (at[o.type]) at[o.type].push(km); }
    if (['photographer', 'dog'].includes(o.type) || o.variant === 'magnesium') ok(km >= 5, `${o.variant || o.type} до 5 км (${km.toFixed(1)})`);
    if (o.type === 'scooter') ok(km >= D.UNLOCK.scooter, 'самокатчик раньше 8 км');
    if (o.type === 'volunteer') ok(km >= D.UNLOCK.volunteer, 'волонтёр раньше 2,5 км');
    if (o.type === 'highfive') ok(km >= 10, '«дай пять» до 10 км');
    if (o.kind === 'item' && D.ITEMS[o.type].variants) ok(!!D.variantOf(o), 'у ништяка есть вид: ' + o.type);
    ok(o.z < L, 'объект за финишем');
  }
  const idealSpeed = 42.195 / (D.RECORD_SEC / D.TIME_SCALE); // км за секунду игры на идеальном темпе
  for (const k of ['gel', 'drink', 'food']) {
    ok(count[k] === 2 * Math.ceil(D.RECORD_SEC / D.TIME_SCALE / D.SUPPLY[k]), `${k}: вдвое больше нужного на идеальные 2:00 (${count[k]})`);
    // соседние порции ближе, чем запас успевает кончиться на идеальном темпе
    for (let i = 1; i < at[k].length; i++) ok(at[k][i] - at[k][i - 1] < D.SUPPLY[k] * idealSpeed, `${k}: разрыв ${(at[k][i] - at[k][i - 1]).toFixed(1)} км`);
  }
  ok(count.boost === D.ITEM_COUNT.boost && count.pacer === D.ITEM_COUNT.pacer && count.highfive === D.ITEM_COUNT.highfive, 'бустеры, пейсеры и «дай пять» на месте');
  // сложность растёт: на последних 15 км препятствий заметно больше, чем на первых 15
  const obsIn = (a2, b2) => objs.filter((o) => o.kind === 'obs' && D.zToKm(o.z) >= a2 && D.zToKm(o.z) < b2).length;
  ok(obsIn(27, 42.2) > obsIn(0, 15) * 1.4, `seed ${seed}: сложность растёт к финишу (${obsIn(0, 15)} → ${obsIn(27, 42.2)})`);
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

// 3b. Встроенный список клуба и звёзды бега
{
  const club = D.clubParticipants();
  ok(club.length === 100 && new Set(club.map((p) => p.name)).size === 100, 'клуб: 100 уникальных имён');
  ok(club.every((p) => p.count === null && /^club-\d{3}$/.test(p.id) && p.name.length <= 24 && !/[@\d]/.test(p.name)), 'клуб: без ID сайта, счётчиков и контактов');
  ok(!club.some((p) => /EVENT/i.test(p.name)), 'клуб: служебный аккаунт исключён');
  ok(D.STARS.length === 20 && new Set(D.STARS.map((st) => st.name)).size === 20 && D.STARS.every((st) => st.tag && ['sprint', 'mid', 'long'].includes(st.kind)), 'звёзды: 20 с подписями');
  // масс-старт: все в коридоре перед аркой, клуб равномерно 2:30–4:00, звёзды быстрее и впереди
  for (const [seed, lane] of [[3, true], [4, true], [5, false]]) {
    const rv = D.initRivals(club, seed, lane), cl = rv.filter((x) => !x.star), st = rv.filter((x) => x.star);
    const L = D.WORLD_LEN, tag = `(сид ${seed}${lane ? ', своя дорожка' : ''})`;
    ok(cl.length === 100 && st.length === 20, 'масс-старт: 100 участников и 20 звёзд ' + tag);
    ok(rv.every((x) => x.z0 < D.START_Z && x.z0 > -50), 'масс-старт: все в стартовом коридоре ' + tag);
    ok(cl.every((x) => x.T >= D.CLUB_T[0] && x.T <= D.CLUB_T[1]) && st.every((x) => x.T >= D.STARS_T[0] && x.T < D.CLUB_T[0]), 'клуб 2:30–4:00, звёзды быстрее ' + tag);
    const buckets = [0, 0, 0, 0, 0, 0];
    for (const x of cl) buckets[Math.min(5, Math.floor((x.T - D.CLUB_T[0]) / 15))]++;
    ok(buckets.every((b) => b >= 15 && b <= 18), `клуб равномерно по 15 минутам: ${buckets} ` + tag);
    ok(Math.min(...st.map((x) => x.z0)) > Math.max(...cl.map((x) => x.z0)) - 0.31, 'звёзды стоят впереди клуба ' + tag);
    ok(rv.every((x) => Math.abs(D.rivalZ(x, x.T) - L) < 1e-6 && D.rivalZ(x, x.T * 0.99) < L), 'каждый финиширует ровно в своё время ' + tag);
    ok(!rv.some((x) => Math.abs(x.z0) < (lane ? 2.4 : 0.8) && Math.abs(x.x) < 0.6), 'место игрока на старте свободно ' + tag);
    if (lane) ok(!rv.some((x) => Math.abs(x.z0) < 2.4 && x.x0 > -0.6) && rv.every((x) => x.laneX >= D.RIVAL_LANE.left && x.laneX <= -2.45) && rv.some((x) => x.x0 > 1), 'старт на всю ширину, рядом с игроком пусто, все сбегают на свою дорожку ' + tag);
  }
}

// 3c. Застройка: у каждого дома стиль района, ориентиры ничем не заслонены
for (const seed of [5, 77, 1234]) {
  const sc = D.buildScenery(seed);
  const lmZ = D.LANDMARKS.map((l) => D.kmToZ(l.km));
  for (const b of sc.buildings) {
    if (b.kremlin) continue;
    const dist = D.DISTRICTS[D.findDistrict(Math.min(42.19, Math.max(0, D.zToKm(b.z))))];
    ok(!!D.STYLES[b.style] && (b.back || dist.styles.some(([st]) => st === b.style)), `дом стиля ${b.style} в районе ${dist.id}`);
    ok(!lmZ.some((lz) => b.z < lz + 40 && b.z + b.len > lz - 40), 'дом заслоняет ориентир');
  }
  ok(sc.buildings.filter((b) => !b.kremlin && !b.back).length > 40, 'набережные застроены');
}

// 4. Позиция при разном числе соперников
for (const n of [0, 1, 5, 100]) {
  const g = D.newGame(D.demoParticipants().slice(0, n), 42);
  D.update(g, 0.016);
  const ahead = g.rivals.filter((rv) => !rv.star && rv.z > g.pz).length;
  ok(g.position === ahead + 1 && g.total === n + 1 && (n < 15 || ahead > 0 && ahead < n / 3), `на старте ${ahead + 1} из ${n + 1}`);
}

// 5. Запасы, каденс, столкновения, прыжок, пейсер, бустеры
function rigged(objs) {
  const g = D.newGame([], 1);
  g.plan = { objs, rows: [] };
  g.scenery = null;
  g.rivals = []; // правила проверяем без соперников (звёзды стартуют со всеми)
  return g;
}
const mk = (type, z, lane, extra) => Object.assign({ type, lane, x: LANES[lane], z, kind: D.ITEMS[type] ? 'item' : 'obs', taken: false, hit: false }, extra || {});
const run = (g, sec, fn) => { const dt = 1 / 60; for (let t = 0; t < sec - 1e-9; t += dt) { if (fn) fn(g); D.update(g, dt); } };
const until = (g, cond, max) => { const dt = 1 / 60; for (let t = 0; t < (max || 10) && !cond(g); t += dt) D.update(g, dt); };
const cadOf = (g) => D.speedFactors(g).cad;
{
  // запасы: гель 20 с, питьё 25 с, еда 30 с; пустой запас −10 каденса; предупреждение за 5 с
  let g = rigged([]); g.cad = D.CAD.max;
  const ev = [];
  const runE = (sec) => run(g, sec, (gg) => { for (const e of gg.events) ev.push([e.kind, e.res, gg.t]); gg.events.length = 0; });
  ok(D.CAD.start === 160 && D.CAD.min === 160 && D.CAD.max === 200, 'каденс 160…200, старт 160');
  ok(cadOf(g) === 200, 'при полных запасах можно бежать на 200');
  runE(16);
  ok(ev.some((e) => e[0] === 'warn' && e[1] === 'gel' && Math.abs(e[2] - 15) < 0.05) && g.warn.gel && !g.warn.drink, 'предупреждение за 5 с до конца геля');
  ok(cadOf(g) === 200, 'пока гель есть — каденс не снижен');
  runE(4.5);
  ok(g.gel === 0 && cadOf(g) === 190 && ev.some((e) => e[0] === 'empty' && e[1] === 'gel'), 'гель кончился через 20 с — каденс −10');
  runE(5);
  ok(g.drink === 0 && cadOf(g) === 180, 'питьё кончилось через 25 с — ещё −10');
  runE(5);
  ok(g.food === 0 && cadOf(g) === 170 && g.cad === 200, 'еда кончилась через 30 с — всего −30, выбранный каденс цел');
  g.cad = D.CAD.min; ok(cadOf(g) === 130, 'от минимальных 160 пустые запасы снимают до 130');
  D.act(g, 'cadDown'); ok(g.cad === 160, 'ниже 160 руками не опустить');
  g.plan.objs.push(mk('gel', g.pz + 14, 1, { variant: 'gu' }));
  until(g, (gg) => gg.gel > 0, 3);
  ok(g.gel > 19.9 && cadOf(g) === 140, 'гель пополнен — каденс сразу +10');
  // скорость растёт с каденсом
  const v = (c) => { const gg = rigged([]); gg.cad = c; gg.speed = 0; run(gg, 3); return gg.speed; };
  ok(v(200) > v(180) * 1.12 && v(180) > v(160) * 1.12, 'выше каденс — быстрее бег');

  // столкновения: лужа −10, остальные −50; через 3 с — прежний каденс
  g = rigged([mk('puddle', 12, 1)]); g.cad = 180; until(g, (gg) => gg.hitPenT > 0, 4);
  ok(cadOf(g) === 170 && g.penalty === 5, 'лужа: каденс −10 и +5 с');
  run(g, 2.9); ok(cadOf(g) === 170, 'лужа держит −10 почти 3 с');
  run(g, 0.2); ok(cadOf(g) === 180, 'через 3 с — прежний каденс');
  for (const t of ['fanbarrier', 'volunteer']) {
    g = rigged([mk(t, 12, 1)]); g.cad = 180; until(g, (gg) => gg.hitPenT > 0, 4);
    ok(cadOf(g) === 130 && g.stats.hits[t] === 1, t + ': каденс −50');
    run(g, 3.05); ok(cadOf(g) === 180, t + ': через 3 с — прежний каденс');
  }
  g = rigged([mk('photographer', 40, 1, { target: 1, x: 3.3 })]); run(g, 5);
  ok(g.stats.hits.photographer === 1 && g.flashT >= 0, 'фотограф выходит в полосу');
  g = rigged([mk('photographer', 40, 1, { target: 1, x: 3.3 })]); D.act(g, 'left'); run(g, 5);
  ok(!g.stats.hits.photographer, 'перестроение спасает от фотографа');
  g = rigged([mk('scooter', 40, 1, { target: 1, x: 5.2, dir: -1 })]); run(g, 5);
  ok(g.stats.hits.scooter === 1, 'самокатчик тормозит в своей полосе');
  g = rigged([mk('scooter', 40, 2, { target: 2, x: 5.2, dir: -1 })]); run(g, 6);
  ok(!g.stats.hits.scooter, 'самокатчик в соседней полосе не задевает');
  // прыжки
  const jumpRun = (gg, z) => { let jumped = false; run(gg, 4, (q) => { if (!jumped && z - q.pz < q.speed * 0.3 + 0.3) { D.act(q, 'jump'); jumped = true; } }); };
  g = rigged([mk('fanbarrier', 30, 1)]); jumpRun(g, 30);
  ok(!g.stats.hits.fanbarrier, 'прыжок через фан-барьер');
  g = rigged([mk('volunteer', 30, 1)]); jumpRun(g, 30);
  ok(g.stats.hits.volunteer === 1, 'волонтёра не перепрыгнуть');
  g = rigged([mk('volunteer', 30, 1)]); D.act(g, 'left'); run(g, 4);
  ok(!g.stats.hits.volunteer, 'перестроение спасает');
  // неуязвимость: две лужи подряд
  g = rigged([mk('puddle', 30, 1), mk('puddle', 31.2, 1)]); run(g, 5);
  ok(g.stats.hits.puddle === 1, 'короткая неуязвимость после столкновения');
  // пейсер
  g = rigged([mk('pacer', 20, 1), mk('volunteer', 60, 1)]); run(g, 7);
  ok(g.stats.shield === 1 && !g.stats.hits.volunteer && g.penalty === 0 && g.hitPen === 0, 'пейсер поглощает столкновение');
  g = rigged([mk('pacer', 20, 1), mk('volunteer', 220, 1)]); run(g, 22);
  ok(g.stats.hits.volunteer === 1, 'защита пейсера заканчивается через 8 сек');
  // бустеры: 5 с на каденсе 210
  for (const id of ['caffeine', 'magnesium', 'puer']) {
    g = rigged([mk('boost', 15, 1, { variant: id })]); until(g, (gg) => gg.boostT > 0, 4);
    ok(cadOf(g) === 210 && g.boostKind === id && Math.abs(g.boostT - 5) < 0.05, id + ': 5 с на каденсе 210');
    run(g, 4.9); ok(cadOf(g) === 210, id + ': держится почти 5 с');
    run(g, 0.2); ok(g.boostT === 0 && cadOf(g) === D.CAD.start, id + ': через 5 с — прежний каденс');
  }
  g = rigged([mk('boost', 15, 1, { variant: 'puer' }), mk('puddle', 40, 1)]); until(g, (gg) => gg.hitPenT > 0, 5);
  ok(g.boostT === 0 && cadOf(g) === D.CAD.start - 10, 'столкновение прерывает бустер');
  g = rigged([mk('fanbarrier', 15, 1), mk('boost', 18, 0, { variant: 'magnesium' })]);
  until(g, (gg) => gg.hitPenT > 0, 4); D.act(g, 'left'); until(g, (gg) => gg.boostT > 0, 3);
  ok(g.boostT > 0 && g.hitPen === 0 && cadOf(g) === 210, 'бустер снимает сбитый темп');
  // каждый ништяк и бонус
  for (const t of Object.keys(D.ITEMS)) {
    const variant = D.ITEMS[t].variants ? D.ITEMS[t].variants[0].id : undefined;
    g = rigged([t === 'highfive' ? mk(t, 20, 2, { x: 2.65 }) : mk(t, 20, 1, { variant })]);
    if (t === 'highfive') D.act(g, 'right');
    run(g, 3);
    ok(g.stats.items[t] === 1 && g.bonus === D.ITEMS[t].bonus, 'подбор: ' + t);
  }
  for (const t of ['gel', 'drink', 'food']) for (const vv of D.ITEMS[t].variants) {
    const k = D.ITEMS[t].supply;
    g = rigged([mk(t, 20, 1, { variant: vv.id })]); g[k] = 1; until(g, (gg) => gg.stats.items[t], 4);
    ok(g[k] > D.SUPPLY[k] - 0.05, `${vv.name}: запас «${D.SUPPLY_NAME[k]}» на ${D.SUPPLY[k]} с`);
  }
  // бонус не двигает мир
  g = rigged([mk('gel', 20, 1, { variant: 'sis' })]); run(g, 2.5);
  const g2 = rigged([]); run(g2, 2.5);
  ok(Math.abs(g.pz - g2.pz) < 1e-6 && Math.abs(g.t - g2.t) < 1e-9, 'бонус меняет только результат, не мир');
  ok(Math.abs(D.raceTime(g) - (g2.t * 60 - 10)) < 1e-6, 'время = t×60 − бонусы');
  // время не отрицательное
  g = rigged([]); g.bonus = 99999; ok(D.raceTime(g) === 0, 'время не отрицательное');
  // собака: зона столкновения = видимое положение
  g = rigged([mk('dog', 40, 0, { a: 0, phase: 0, omega: 2.2, dir: 1 })]);
  let hitX = null;
  run(g, 5, (gg) => { const o = gg.plan.objs[0]; if (o.hit && hitX === null) hitX = o.x; });
  const dog = g.plan.objs[0];
  ok(dog.x !== LANES[0] || dog.hit, 'собака двигается');
  if (dog.hit) ok(Math.abs(hitX - g.px) < D.OBST.dog.w / 2 + 0.3, 'столкновение с собакой там, где она видна');
  // отметки каждых 5 км
  g = rigged([]); g.pz = D.kmToZ(4.99); g.speed = 15; const kmEv = [];
  run(g, 0.3, (gg) => { for (const e of gg.events) if (e.kind === 'km') kmEv.push(e.km); gg.events.length = 0; });
  ok(kmEv.join() === '5' && g.splits.length === 1, 'отметка 5 км со сплитом');
}

// 6. Полные забеги ботами
function bot(g, mode) {
  if (mode === 'passive') return;
  const perfect = mode === 'perfect';
  const row = D.rowNear(g.plan.rows, g.pz, 0.5, 34);
  // бегуны впереди в полосах
  const runnerBlock = [false, false, false];
  for (const rv of g.rivals) { const dz = rv.z - g.pz; if (dz > 0 && dz < (perfect ? 14 : 6) && rv.v < g.speed) { for (let l = 0; l < 3; l++) if (Math.abs(LANES[l] - rv.x) < 0.75) runnerBlock[l] = true; } }
  // ништяк тем ценнее, чем меньше запас; средний бот берёт только когда почти пусто
  const need = (k) => { const left = g[k] / D.SUPPLY[k]; return left < (perfect ? 0.55 : 0.3) ? 40 * (1 - left) : 0; };
  const val = { gel: need('gel'), drink: need('drink'), food: need('food'), boost: perfect ? 30 : 12, pacer: perfect ? 14 : 4, highfive: 6 };
  let best = g.lane, bestScore = -1e9;
  for (let l = 0; l < 3; l++) {
    let s = -Math.abs(l - g.lane) * 2 - (runnerBlock[l] ? 30 : 0);
    if (row) {
      if (row.objs.some((o) => o.kind === 'obs' && !D.OBST[o.type].jump && D.hardLane(o) === l)) continue;
      if (row.block[l]) s -= perfect ? 25 : 15;
      for (const o of row.objs) if (o.kind === 'item' && !o.taken && (o.lane === l || (o.type === 'highfive' && l === 2))) s += val[o.type] || 0;
    }
    if (s > bestScore) { bestScore = s; best = l; }
  }
  g.lane = best;
  if (row) for (const o of row.objs) if (o.kind === 'obs' && D.OBST[o.type].jump && Math.abs(o.x - g.px) < 1.1) {
    const d = o.z - g.pz, lead = g.speed * 0.3;
    if (d < lead + 0.6 && d > lead - 1.5) D.act(g, 'jump');
  }
  const target = perfect ? D.CAD.max : 184;
  if (g.cad < target) D.act(g, 'cadUp'); else if (g.cad > target) D.act(g, 'cadDown');
}
for (const mode of ['perfect', 'smart', 'passive']) {
  const res = [];
  for (let s = 1; s <= 8; s++) {
    const g = D.newGame(D.demoParticipants(), s * 1013);
    let emptyT = 0;
    const dt = 1 / 60; let steps = 0;
    while (!g.finished && steps < 60 * 900) {
      bot(g, mode); D.update(g, dt); steps++;
      if (g.gel <= 0 || g.drink <= 0 || g.food <= 0) emptyT += dt;
      g.events.length = 0;
    }
    ok(g.finished, 'забег завершён');
    ok(g.result >= D.RECORD_SEC, 'не быстрее рекорд-лимита');
    if (mode === 'passive') ok(g.result > 4 * 3600, 'без управления — дольше 4:00:00');
    const it = g.stats.items;
    res.push({ game: fmtMS(g.finishT), raw: fmt(g.rawResult), result: fmt(g.result), pos: g.finalPos,
      'гель/питьё/еда': (it.gel || 0) + '/' + (it.drink || 0) + '/' + (it.food || 0), boost: it.boost || 0, 'пусто, с': emptyT | 0,
      hits: JSON.stringify(g.stats.hits).replace(/[{}"]/g, ''), stars: g.stats.stars });
  }
  console.log({ perfect: 'Идеальный бот:', smart: 'Средний бот:', passive: 'Пассивный (без управления):' }[mode]);
  console.table(res);
}
// звёзды бега: стартуют со всеми, обгоны засчитываются (обогнала снова — не в счёт), в место не входят
for (const mode of ['perfect', 'smart', 'passive']) {
  const g = D.newGame(D.clubParticipants(), mode === 'smart' ? 777 : 778);
  let starEvents = 0, steps = 0;
  ok(g.rivals.filter((rv) => rv.star).length === D.STARS.length && g.rivals.every((rv) => !rv.star || rv.z > 0), `звёзды на масс-старте впереди (${mode})`);
  while (!g.finished && steps < 60 * 900) {
    bot(g, mode); D.update(g, 1 / 60); steps++;
    for (const e of g.events) if (e.kind === 'star') starEvents++;
    g.events.length = 0;
  }
  const behind = g.rivals.filter((rv) => rv.star && rv.z < D.WORLD_LEN).length;
  ok(starEvents >= g.stats.stars && g.stats.stars === behind && (mode !== 'perfect' || behind >= 8), `обгоны звёзд засчитаны (${mode}: ${g.stats.stars})`);
  ok(g.total === 101 && g.finalPos >= 1 && g.finalPos <= 101, `звёзды не входят в место (${mode})`);
}

// соперники весь забег в своей полосе: сдвиг не дальше края полосы, полосу не меняют
for (const mode of ['perfect', 'smart']) {
  const g = D.newGame(D.clubParticipants(), mode === 'smart' ? 515 : 516, { rivalLane: false });
  const lane0 = new Map(g.rivals.map((rv) => [rv.id, rv.lane]));
  let worst = 0, hops = 0, steps = 0;
  while (!g.finished && steps < 60 * 900) {
    bot(g, mode); D.update(g, 1 / 60); steps++; g.events.length = 0;
    for (const rv of g.rivals) { worst = Math.max(worst, Math.abs(rv.x - LANES[rv.lane])); if (rv.y > 0.3) hops++; }
  }
  ok(g.rivals.every((rv) => rv.lane === lane0.get(rv.id)) && worst <= 0.5 + 1e-9, `соперники не меняют полосу (${mode}: отклонение ${worst.toFixed(2)})`);
  ok(hops > 0, `соперники перепрыгивают барьеры и собак (${mode})`);
}

// тестовый режим: соперники на своей дорожке слева — не заходят в полосы игрока и не сталкиваются с ним
{
  const lo = D.RIVAL_LANE.left, hi = -2.45;
  const sc = D.buildScenery(5, { rivalLane: true });
  ok(sc.lamps.filter((l) => l.side < 0).every((l) => l.x < lo - 0.3) && sc.trees.every((t) => t.x < lo - 0.3), 'дорожка соперников: фонари и деревья на тротуаре');
  for (const mode of ['smart', 'passive']) {
    const g = D.newGame(D.clubParticipants(), mode === 'smart' ? 991 : 992, { rivalLane: true });
    let outside = 0, steps = 0;
    while (!g.finished && steps < 60 * 900) {
      bot(g, mode); D.update(g, 1 / 60); steps++; g.events.length = 0;
      if (steps % 30 === 0 && g.t > 3) for (const rv of g.rivals) { const dz = rv.z - g.pz; if (dz > -12 && dz < 170 && (rv.x < lo || rv.x > hi)) outside++; }
    }
    ok(outside === 0, `дорожка соперников: никто не выбегает в полосы игрока (${mode})`);
    ok(!g.stats.hits.runner, `дорожка соперников: столкновений с бегунами нет (${mode})`);
    ok(g.rivals.filter((rv) => rv.star).length === D.STARS.length, `дорожка соперников: звёзды тоже на ней (${mode})`);
  }
  // игрок на дорожке соперников: туда можно уйти, соперники с неё не сходят и обходят игрока у края
  {
    const g = D.newGame(D.clubParticipants(), 4242);
    D.act(g, 'left'); D.act(g, 'left'); D.act(g, 'left');
    let steps = 0, outside = 0, overlap = 0;
    while (!g.finished && steps < 60 * 120) {
      D.update(g, 1 / 60); steps++; g.events.length = 0;
      if (g.t > 3) for (const rv of g.rivals) {
        if (rv.x < lo - 1e-9 || rv.x > hi + 1e-9) outside++;
        if (Math.abs(rv.z - g.pz) < 0.3 && Math.abs(rv.x - g.px) < 0.45 && rv.v > g.speed) overlap++;
      }
    }
    ok(g.lane === -1 && Math.abs(g.px - D.RIVAL_LANE.x) < 1e-6, 'игрок может бежать по дорожке соперников');
    ok(outside === 0 && overlap === 0, `соперники с дорожки не сходят и обходят игрока (${outside}/${overlap})`);
  }
  {
    const g = D.newGame([], 1, { rivalLane: false }); D.act(g, 'left'); D.act(g, 'left');
    ok(g.lane === 0, 'в прежнем режиме левее полосы 0 не уйти');
  }
  for (let s = 1; s <= 20; s++) {
    const g = D.newGame(D.demoParticipants(), s * 1013, { rivalLane: true });
    let steps = 0;
    while (!g.finished && steps < 60 * 900) { D.update(g, 1 / 60); steps++; g.events.length = 0; }
    ok(g.result > 4 * 3600, `дорожка соперников: без управления дольше 4:00:00 (seed ${s}: ${fmt(g.result || 0)})`);
  }
}

// без управления марафон всегда дольше 4:00:00 — проверяем шире, чем в таблице
for (let s = 9; s <= 40; s++) {
  const g = D.newGame(D.demoParticipants(), s * 1013);
  let steps = 0;
  while (!g.finished && steps < 60 * 900) { D.update(g, 1 / 60); steps++; g.events.length = 0; }
  ok(g.finished && g.result > 4 * 3600, `без управления дольше 4:00:00 (seed ${s}: ${fmt(g.result || 0)})`);
}
function fmtMS(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0'); }
function fmt(s) { s = Math.round(s); return Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }

console.log(`\n${passes} проверок пройдено, ${fails} не пройдено`);
process.exit(fails ? 1 : 0);
