/* DUSTY Marathon Run — данные маршрута, константы, импорт участников */
(function (G) {
  'use strict';
  const D = G.DUSTY || (G.DUSTY = {});

  D.KM_TOTAL = 42.195;
  D.WORLD_LEN = 2600;          // длина трассы в игровых метрах
  D.TIME_SCALE = 60;           // 1 секунда игры = 1 минута марафона (4:04 игры → 4:04:00)
  D.RECORD_SEC = 2 * 3600;     // предел: быстрее 2:00:00 финишировать нельзя (рекорд-лимит)
  D.LANES = [-1.45, 0, 1.45];
  // Тестовый режим: соперники бегут по отдельной четвёртой дорожке слева (−3,95…−2,45), не заходя в полосы игрока
  D.RIVAL_LANE = { x: -3.2, left: -3.95, spread: 0.8 };
  D.kmToZ = (km) => (km / D.KM_TOTAL) * D.WORLD_LEN;
  D.zToKm = (z) => (z / D.WORLD_LEN) * D.KM_TOTAL;

  // Художественная адаптация маршрута: последовательность и характер районов, не GPS-копия.
  D.DISTRICTS = [
    { id: 'krasnopresnenskaya', styles: [['modern', 4], ['stalin', 3], ['panel', 3]], name: 'Краснопресненская набережная', from: 0, to: 7,
      palette: ['#8fa9c4', '#b9c6d2', '#6f8ba6', '#d6dde4', '#a2b6ca', '#5d7690'], hMin: 18, hMax: 40, trees: 0.55, ground: '#7d8a7a', gap: 0.12 },
    { id: 'smolenskaya', styles: [['stalin', 7], ['classic', 3]], name: 'Смоленская набережная', from: 7, to: 10,
      palette: ['#d8c3a0', '#cdb48c', '#e3d2b4', '#bfa27a', '#c9b08f'], hMin: 20, hMax: 34, trees: 0.6, ground: '#808b72', gap: 0.08 },
    { id: 'rostovskaya', styles: [['merchant', 8], ['classic', 2]], name: 'Ростовская набережная', from: 10, to: 12,
      palette: ['#f0d58a', '#e8b7a0', '#cfe0c8', '#f3e6c8', '#e6a77f', '#f5c9c9'], hMin: 10, hMax: 18, trees: 0.7, ground: '#7a8b6c', gap: 0.06 },
    { id: 'savvinskaya', styles: [['brick', 5], ['merchant', 2.5], ['stalin', 2.5]], name: 'Саввинская набережная', from: 12, to: 18,
      palette: ['#b5523b', '#c96a4f', '#e2d6c2', '#8e3d2c', '#d7c3a8', '#a9b6c0'], hMin: 12, hMax: 26, trees: 0.6, ground: '#7c866c', gap: 0.1 },
    { id: 'novodevichya', styles: [['merchant', 5], ['classic', 5]], name: 'Новодевичья набережная', from: 18, to: 22,
      palette: ['#e8e2d0', '#c9b99b', '#e6d4c3'], hMin: 7, hMax: 13, trees: 1, ground: '#5f8a4e', gap: 0.45 },
    { id: 'luzhnetskaya', styles: [['sport', 6], ['panel', 4]], name: 'Лужнецкая набережная · Лужники', from: 22, to: 29,
      palette: ['#e9eef2', '#cfd8dc', '#d4e3d0'], hMin: 6, hMax: 11, trees: 0.95, ground: '#5d8f4c', gap: 0.5 },
    { id: 'frunzenskaya', styles: [['stalin', 8], ['classic', 2]], name: 'Фрунзенская набережная', from: 29, to: 35,
      palette: ['#d9c9a3', '#c2b08a', '#e6d8b6', '#a99a7c', '#d8bfa0'], hMin: 18, hMax: 30, trees: 0.75, ground: '#77866a', gap: 0.06 },
    { id: 'prechistenskaya', styles: [['classic', 6], ['merchant', 4]], name: 'Пречистенская набережная', from: 35, to: 39,
      palette: ['#f2e2c4', '#e9cfa5', '#f4f0e6', '#d7b98e', '#f0d2cf'], hMin: 10, hMax: 20, trees: 0.6, ground: '#7a8670', gap: 0.08 },
    { id: 'kremlevskaya', styles: [['classic', 1]], name: 'Кремлёвская набережная', from: 39, to: 42.195,
      palette: ['#b23a2c'], hMin: 7, hMax: 7, trees: 0.5, ground: '#6f8a5a', gap: 0 }
  ];

  // Архитектурные стили набережных: высоты и палитры (стиль района задаёт styles в D.DISTRICTS)
  D.STYLES = {
    stalin: { h: [18, 32], pal: ['#d8c3a0', '#cdb48c', '#e3d2b4', '#c9b08f', '#d9c9a3', '#e6d8b6', '#bfa27a'] },
    classic: { h: [10, 18], pal: ['#f2e2c4', '#efe2b8', '#f4f0e6', '#e9cfa5', '#f0d2cf', '#d7e3ea'] },
    merchant: { h: [8, 14], pal: ['#f0d58a', '#e8b7a0', '#cfe0c8', '#f3e6c8', '#e6a77f', '#f5c9c9', '#c9d9e6'] },
    brick: { h: [10, 20], pal: ['#a9452f', '#b5523b', '#8e3d2c', '#c96a4f', '#9c4a36'] },
    modern: { h: [26, 46], pal: ['#8fa9c4', '#7d9bb8', '#a2b6ca', '#6f8ba6', '#b9c6d2'] },
    panel: { h: [16, 30], pal: ['#e3e1dc', '#d6d9dc', '#e9e4d8', '#cfd6dc'] },
    sport: { h: [7, 12], pal: ['#e9eef2', '#f4f6f6', '#dfe8e4'] }
  };

  D.findDistrict = function (km) {
    for (let i = D.DISTRICTS.length - 1; i >= 0; i--) if (km >= D.DISTRICTS[i].from) return i;
    return 0;
  };

  D.LANDMARKS = [
    { km: 2.6, kind: 'wtc', x: -55 },
    { km: 5.3, kind: 'whitehouse', x: -50 },
    { km: 8.6, kind: 'mid', x: -64 },
    { km: 10.9, kind: 'rostov', x: -42 },
    { km: 14.6, kind: 'silk', x: -50 },
    { km: 20.0, kind: 'novodevichy', x: -68 },
    { km: 25.6, kind: 'luzhniki', x: -78 },
    { km: 32.8, kind: 'mod', x: -47 },
    { km: 37.4, kind: 'hhs', x: -45 },
    { km: 41.0, kind: 'palace', x: -66 }
  ];
  // Ориентиры на том берегу и на реке (только в 3D)
  D.LANDMARKS_FAR = [
    { km: 6.0, kind: 'ukraina', x: 104 },
    { km: 36.4, kind: 'petr', x: 58 },
    { km: 38.2, kind: 'krasny', x: 96 },
    { km: 40.6, kind: 'domnab', x: 98 }
  ];
  D.BRIDGES = [1.4, 7.4, 11.8, 17.2, 22.6, 27.0, 30.6, 34.6, 38.6, 41.7];
  D.DJ_KM = 24;
  // Точки поддержки Дасти — рейв со светомузыкой; на главной (24 км, Лужники) играет DJ KIM
  D.RAVE_KM = [11, 24, 33.5];
  D.TRACK_KM = [22.6, 27.0]; // Лужники: беговое покрытие вместо асфальта (между мостами)
  D.KM_MARKS = [5, 10, 15, 20, 25, 30, 35, 40];

  D.SIGNS = ['ДАВАЙ, ДАСТИ!', 'ПЫЛЬНЫЕ ГАНТЕЛИ', 'DUSTY', 'ТЫ УЖЕ КРАСАВЧИК', 'ГЕЛЬ СЪЕЛ?', 'БЕГИ, МЫ В ТЕБЯ ВЕРИМ', 'DUSTY DUMBBELLS', 'ЕЩЁ ЧУТЬ-ЧУТЬ'];

  /* ---------------- Участники ---------------- */

  // Демонстрационный список: вымышленные прозвища, НЕ реальные пользователи и НЕ рейтинг.
  D.demoParticipants = function () {
    const adj = ['Бодрый', 'Быстрый', 'Лёгкий', 'Упрямый', 'Утренний', 'Ночной', 'Пыльный', 'Розовый', 'Салатовый', 'Весёлый', 'Тихий', 'Звонкий'];
    const noun = ['Кроссовок', 'Гель', 'Лонг', 'Темп', 'Пейсер', 'Финишер', 'Каденс', 'Банан', 'Шнурок', 'Километр'];
    const out = [];
    for (let i = 0; i < 100; i++) {
      const a = adj[(i * 7) % adj.length];
      const n = noun[(i * 3 + Math.floor(i / adj.length)) % noun.length];
      out.push({ id: 'demo-' + String(i + 1).padStart(3, '0'), name: a + ' ' + n, count: null });
    }
    // уникальность имён
    const seen = new Map();
    out.forEach((p) => {
      const k = p.name; const c = (seen.get(k) || 0) + 1; seen.set(k, c);
      if (c > 1) p.name = p.name + ' ' + c;
    });
    return out;
  };

  /* Звёзды бега на последних километрах: известные бегуны России по открытым источникам (новости ВФЛА-стартов,
     Казанский и Московский марафоны, чемпионат России 2026). Подписи — только подтверждённые факты; результатов
     за них игра не придумывает: в место и итоговое время звёзды не входят. kind: sprint / mid / long — кого догнать проще. */
  D.STARS_KM = 30; // выходят на трассу вне поля зрения, догнать их можно с ~35 км
  D.STARS = [
    { name: 'Николай Грудковский', female: false, kind: 'sprint', tag: 'чемпион России на 100 м, 2026' },
    { name: 'Юлия Караваева', female: true, kind: 'sprint', tag: 'чемпионка России на 100 м, 2026' },
    { name: 'Вера Филатова', female: true, kind: 'sprint', tag: 'чемпионка России на 200 м, 2026' },
    { name: 'Константин Крылов', female: false, kind: 'sprint', tag: 'один из сильнейших спринтеров России' },
    { name: 'Виктория Максимова', female: true, kind: 'sprint', tag: 'призёр чемпионата России на 100 и 200 м, 2026' },
    { name: 'Дарья Осипова', female: true, kind: 'sprint', tag: 'бронза чемпионата России на 100 м, 2026' },
    { name: 'Алексей Данилов', female: false, kind: 'sprint', tag: 'чемпион России на 400 м, 2026' },
    { name: 'Кирилл Анисимов', female: false, kind: 'mid', tag: 'чемпион России на 800 м, 2026' },
    { name: 'Егор Лимонов', female: false, kind: 'mid', tag: 'чемпион России на 1500 м, 2026' },
    { name: 'Сергей Дубровский', female: false, kind: 'mid', tag: 'призёр чемпионата России на 800 и 1500 м, 2026' },
    { name: 'Лилия Мендаева', female: true, kind: 'mid', tag: 'чемпионка России в помещении на 1500 и 3000 м' },
    { name: 'Ольга Вовк', female: true, kind: 'mid', tag: 'стайер, 5000 м' },
    { name: 'Светлана Аплачкина', female: true, kind: 'mid', tag: 'рекорд России на 10 км по шоссе' },
    { name: 'Сергей Шаров', female: false, kind: 'mid', tag: 'победитель Казанского марафона на 10 км' },
    { name: 'Луиза Дмитриева', female: true, kind: 'long', tag: 'победительница Московского марафона 2023' },
    { name: 'Искандер Ядгаров', female: false, kind: 'long', tag: 'победитель Московского марафона' },
    { name: 'Степан Киселёв', female: false, kind: 'long', tag: 'победитель Московского и Казанского марафонов' },
    { name: 'Ринас Ахмадеев', female: false, kind: 'long', tag: 'призёр Московского полумарафона 2026' },
    { name: 'Дмитрий Неделин', female: false, kind: 'long', tag: 'чемпион России по марафону 2025' },
    { name: 'Владимир Никитин', female: false, kind: 'long', tag: 'рекордсмен России в марафоне' }
  ];

  const normClub = (s) => String(s == null ? '' : s)
    .toLowerCase().replace(/ё/g, 'е').replace(/[«»"'“”„]/g, ' ')
    .replace(/[\s\u00a0]+/g, ' ').trim();
  // Согласованные варианты: «Пыльные Гантели», «Dusty Dumbbells», «Dusty Dumbbells Anonymous Running Club» в любом регистре и с лишними пробелами.
  D.isDustyClub = function (club) {
    const c = normClub(club);
    return c.includes('пыльные гантели') || c.includes('dusty dumbbells');
  };

  const TRUE_SET = new Set(['1', 'true', 'yes', 'y', 'да', '+', 'attended', 'посетил', 'посетила', 'был', 'была', 'пришел', 'пришла']);
  const isTrue = (v) => v === true || v === 1 || TRUE_SET.has(String(v == null ? '' : v).trim().toLowerCase().replace(/ё/g, 'е'));

  function parseCSV(text) {
    text = text.replace(/^\uFEFF/, '');
    const firstLine = text.split(/\r?\n/)[0] || '';
    const counts = { ',': 0, ';': 0, '\t': 0 };
    for (const ch of firstLine) if (ch in counts) counts[ch]++;
    const sep = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    const rows = []; let row = []; let cell = ''; let q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some((c) => c.trim() !== '')) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    if (!rows.length) return [];
    const head = rows[0].map((h) => h.trim().toLowerCase());
    return rows.slice(1).map((r) => { const o = {}; head.forEach((h, i) => { o[h] = r[i] != null ? r[i].trim() : ''; }); return o; });
  }

  const pick = (o, keys) => { for (const k of keys) if (o[k] != null && String(o[k]).trim() !== '') return o[k]; return null; };
  const KEY = {
    id: ['id', 'user_id', 'userid', 'uid', 'участник_id'],
    name: ['name', 'display_name', 'имя', 'nickname', 'ник'],
    club: ['club', 'клуб', 'club_name'],
    count: ['long_runs_attended', 'longs_attended', 'attended_count', 'long_runs', 'посещения'],
    event: ['event_id', 'eventid', 'run_id', 'long_id'],
    attended: ['attended', 'is_attended', 'посетил', 'status']
  };

  const cleanName = (s, id) => {
    const n = String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim();
    const v = n || ('Участник #' + id);
    return v.length > 24 ? v.slice(0, 23) + '…' : v;
  };
  const cmpId = (a, b) => {
    const na = Number(a), nb = Number(b);
    if (String(a).trim() !== '' && String(b).trim() !== '' && Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
  };

  /**
   * Импорт CSV/JSON → топ-N участников клуба «Пыльные Гантели» по числу посещённых лонгов.
   * Возвращает { participants:[{id,name,count}], stats }. Лишние поля (телефон, почта и т. п.) отбрасываются.
   */
  D.importParticipants = function (text, filename, limit) {
    limit = limit || 100;
    let records;
    const t = String(text || '').trim();
    const isJson = /\.json$/i.test(filename || '') || t.startsWith('[') || t.startsWith('{');
    if (isJson) {
      let data;
      try { data = JSON.parse(t); } catch (e) { throw new Error('Файл не похож на корректный JSON: ' + e.message); }
      records = Array.isArray(data) ? data : (data.participants || data.records || data.users || data.data);
      if (!Array.isArray(records)) throw new Error('В JSON нет массива записей (ожидается массив или поле participants/records).');
      records = records.map((r) => { const o = {}; for (const k in r) o[String(k).trim().toLowerCase()] = r[k]; return o; });
    } else {
      records = parseCSV(t);
    }
    if (!records.length) throw new Error('В файле нет строк с данными.');

    const sample = records[0];
    const hasEvents = KEY.event.some((k) => k in sample);
    const hasCount = KEY.count.some((k) => k in sample);
    if (!hasEvents && !hasCount) throw new Error('Нужна колонка long_runs_attended или пара user_id + event_id.');
    const attendedKnown = hasEvents && KEY.attended.some((k) => k in sample);

    const stats = { rows: records.length, clubRows: 0, skippedNoId: 0, duplicates: 0, unique: 0,
      mode: hasEvents ? 'events' : 'aggregate', attendedKnown, selected: 0 };
    const people = new Map();

    for (const r of records) {
      if (!D.isDustyClub(pick(r, KEY.club))) continue;
      stats.clubRows++;
      const idRaw = pick(r, KEY.id);
      if (idRaw == null) { stats.skippedNoId++; continue; }
      const id = String(idRaw).trim();
      let p = people.get(id);
      if (!p) { p = { id, name: cleanName(pick(r, KEY.name), id), count: 0, events: new Set(), rows: 0 }; people.set(id, p); }
      p.rows++;
      if (p.name.startsWith('Участник #') && pick(r, KEY.name)) p.name = cleanName(pick(r, KEY.name), id);
      if (hasEvents) {
        const ev = pick(r, KEY.event);
        if (ev == null) continue;
        if (attendedKnown && !isTrue(pick(r, KEY.attended))) continue;
        p.events.add(String(ev).trim());
      } else {
        const c = Math.max(0, Math.floor(Number(String(pick(r, KEY.count) || '0').replace(',', '.')) || 0));
        if (p.rows > 1) stats.duplicates++;
        p.count = Math.max(p.count, c); // повтор строки одного ID не удваивает посещения
      }
    }
    const list = [...people.values()].map((p) => ({ id: p.id, name: p.name, count: hasEvents ? p.events.size : p.count }));
    stats.unique = list.length;
    list.sort((a, b) => (b.count - a.count) || cmpId(a.id, b.id));
    const top = list.slice(0, limit);
    stats.selected = top.length;
    return { participants: top, stats };
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
