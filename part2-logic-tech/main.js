/* DUSTY Marathon Run — интерфейс, управление, игровой цикл */
(function (G) {
  'use strict';
  const D = G.DUSTY, A = D.Audio;
  let R = null, gfx3d = false; // выбирается при запуске: 3D (WebGL) или упрощённая 2D
  const $ = (id) => document.getElementById(id);
  const STORE = 'dusty.participants.v1';

  const ICON_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 9a4 4 0 010 6M18.5 6.5a7.5 7.5 0 010 11"/></svg>';
  const ICON_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';

  let g = null, state = 'menu', paused = false, last = 0, hudT = 0, finishDelay = 0, countT = 0, countShown = -1;
  // соперники: club — встроенный список клуба (по умолчанию), demo — вымышленные прозвища, file — загруженная выгрузка
  const clubRoster = () => ({ participants: D.clubParticipants(), mode: 'club', stats: null, file: '' });
  const demoRoster = () => ({ participants: D.demoParticipants(), mode: 'demo', stats: null, file: '' });
  let roster = clubRoster();
  const reduceMQ = G.matchMedia ? G.matchMedia('(prefers-reduced-motion: reduce)') : null;

  /* ---------- участники ---------- */
  function loadRoster() {
    try {
      const raw = G.localStorage.getItem(STORE);
      if (raw) {
        const v = JSON.parse(raw);
        if (v && v.mode === 'demo') roster = demoRoster();
        else if (v && Array.isArray(v.participants)) roster = { participants: v.participants.slice(0, 100).map((p) => ({ id: String(p.id), name: String(p.name).slice(0, 24), count: p.count | 0 })), mode: 'file', stats: v.stats, file: v.file || '' };
      }
    } catch (e) { /* хранилище недоступно — остаётся список клуба */ }
  }
  function saveRoster() {
    try {
      if (roster.mode === 'club') G.localStorage.removeItem(STORE);
      else if (roster.mode === 'demo') G.localStorage.setItem(STORE, JSON.stringify({ mode: 'demo' }));
      else G.localStorage.setItem(STORE, JSON.stringify({ participants: roster.participants, stats: roster.stats, file: roster.file }));
    } catch (e) { /* без сохранения */ }
  }
  function renderRoster() {
    const n = roster.participants.length;
    $('partSummary').innerHTML = roster.mode === 'demo' ? 'Соперники: <span class="mode-tag">демо-режим</span>'
      : roster.mode === 'club' ? 'Соперники: <span class="mode-tag real">клуб, ' + n + '</span>'
      : 'Соперники: <span class="mode-tag real">загружено ' + n + '</span>';
    const st = roster.stats;
    $('partStatus').textContent = roster.mode === 'demo'
      ? 'Сейчас на трассе 100 вымышленных бегунов с шуточными прозвищами. Это не настоящие участники и не рейтинг клуба.'
      : roster.mode === 'club'
      ? 'На трассе ' + n + ' участников клуба «Пыльные Гантели» — первые по числу заказов на лонги DDLONG (выгрузка ' + D.CLUB_ROSTER_DATE + '; заказ — это регистрация, а не подтверждённое посещение). Порядок на старте и темп в каждом забеге случайные. Ближе к финишу на трассу выходят звёзды бега России.'
      : 'Из файла «' + roster.file + '»: строк ' + (st ? st.rows : '?') + ', записей клуба ' + (st ? st.clubRows : '?') + ', уникальных участников ' + (st ? st.unique : '?') + '. В забеге — первые ' + n + ' по числу посещённых лонгов.' +
        (st && st.mode === 'events' && !st.attendedKnown ? ' В файле нет колонки attended, поэтому посещения не отделены от регистраций.' : '') +
        (st && st.skippedNoId ? ' Пропущено строк без ID: ' + st.skippedNoId + '.' : '');
    const ol = $('partList'); ol.textContent = '';
    if (roster.mode !== 'demo') {
      roster.participants.forEach((p) => { const li = document.createElement('li'); li.textContent = p.name + (roster.mode === 'file' ? ' — ' + p.count : ''); ol.appendChild(li); });
    }
    ol.style.display = roster.mode === 'demo' ? 'none' : '';
  }
  $('fileInput').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    $('partError').textContent = '';
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const res = D.importParticipants(String(fr.result), file.name, 100);
        if (!res.participants.length) throw new Error('В файле не нашлось участников клуба «Пыльные Гантели» с ID.');
        roster = { participants: res.participants, mode: 'file', stats: res.stats, file: file.name.slice(0, 60) };
        saveRoster(); renderRoster();
      } catch (err) { $('partError').textContent = err.message; }
      e.target.value = '';
    };
    fr.onerror = () => { $('partError').textContent = 'Не удалось прочитать файл.'; };
    fr.readAsText(file, 'utf-8');
  });
  $('btnDemo').addEventListener('click', () => { roster = demoRoster(); saveRoster(); renderRoster(); $('partError').textContent = ''; });
  $('btnClub').addEventListener('click', () => { roster = clubRoster(); saveRoster(); renderRoster(); $('partError').textContent = ''; });

  /* ---------- звук ---------- */
  function soundUI() {
    const on = A.isEnabled();
    $('btnSound').innerHTML = on ? ICON_ON : ICON_OFF;
    $('btnSound').setAttribute('aria-label', on ? 'Выключить звук' : 'Включить звук');
    for (const id of ['btnSoundStart', 'btnSoundPause']) {
      $(id).innerHTML = (on ? ICON_ON : ICON_OFF) + (on ? 'Звук включён' : 'Звук выключен');
      $(id).setAttribute('aria-pressed', String(on));
    }
  }
  function toggleSound() {
    if (!A.supported()) { soundUI(); return; }
    A.setEnabled(!A.isEnabled());
    if (paused && A.isEnabled()) A.setPaused(true);
    soundUI();
    if (A.isEnabled()) A.play('click');
  }
  ['btnSound', 'btnSoundStart', 'btnSoundPause'].forEach((id) => $(id).addEventListener('click', toggleSound));

  /* ---------- экраны ---------- */
  function show(id) { for (const s of ['start', 'pause', 'finish']) $(s).classList.toggle('show', s === id); }

  function startRun() {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    g = D.newGame(roster.participants, (Date.now() ^ (Math.random() * 1e9)) >>> 0);
    paused = false; finishDelay = 0; hudT = 0;
    $('toasts').textContent = '';
    state = 'countdown'; countT = 0; countShown = -1;
    show(null);
    document.body.classList.add('playing');
    buildTrackTicks();
    A.setPaused(false);
    updateHUD(true);
  }
  function setPause(p) {
    if (state !== 'run' && state !== 'countdown') return;
    paused = p;
    A.setPaused(p);
    show(p ? 'pause' : null);
    if (!p) last = performance.now();
  }
  function toMenu() {
    state = 'menu'; paused = false; g = null;
    document.body.classList.remove('playing');
    $('countdown').classList.remove('show');
    A.updateMusic(0); A.setPaused(false);
    show('start');
  }
  $('btnStart').addEventListener('click', startRun);
  $('btnAgain').addEventListener('click', startRun);
  $('btnRestart').addEventListener('click', startRun);
  $('btnResume').addEventListener('click', () => setPause(false));
  $('btnMenu').addEventListener('click', toMenu);
  $('btnMenu2').addEventListener('click', toMenu);
  $('btnPause').addEventListener('click', () => setPause(!paused));

  /* ---------- HUD ---------- */
  const fmt = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const fmtMS = (s) => { s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const meter = (id, val, pct, low) => {
    const el = $(id); el.querySelector('em').textContent = val; el.querySelector('i').style.width = Math.max(0, Math.min(100, pct)) + '%';
    el.classList.toggle('low', !!low);
  };
  function buildTrackTicks() {
    const tr = $('track');
    tr.querySelectorAll('s').forEach((s) => s.remove());
    D.DISTRICTS.slice(1).forEach((d) => { const s = document.createElement('s'); s.style.left = (d.from / D.KM_TOTAL * 100) + '%'; tr.appendChild(s); });
  }
  let lastChips = '';
  function updateHUD(force) {
    if (!g) return;
    const km = Math.min(D.KM_TOTAL, D.zToKm(g.pz));
    $('hDist').textContent = km.toFixed(1).replace('.', ',');
    $('hTime').textContent = fmt(g.finished ? g.result : D.raceTime(g));
    $('hPos').textContent = g.position + '/' + g.total;
    meter('mEnergy', Math.round(g.energy), g.energy, g.energy < 25);
    meter('mCal', Math.round(g.cal), g.cal, g.cal < 25);
    meter('mWater', Math.round(g.water), g.water, g.water < 25);
    meter('mHr', Math.round(g.hr), (g.hr - 60) / 1.4, g.hr > 175);
    meter('mCad', g.cad, (g.cad - D.CAD.min) / (D.CAD.max - D.CAD.min) * 100, g.cad >= 192);
    $('cCad').textContent = g.cad;
    $('hDistrict').textContent = D.DISTRICTS[g.district].name;
    $('hProg').style.width = (km / D.KM_TOTAL * 100) + '%';
    $('wEnergy').classList.toggle('show', g.warn.energy);
    $('wCal').classList.toggle('show', g.warn.cal);
    $('wWater').classList.toggle('show', g.warn.water);
    let chips = '';
    if (g.caffT > 0) chips += '<span class="chip c-caff">Кофеин ' + Math.ceil(g.caffT) + ' с</span>';
    if (g.pacerT > 0) chips += '<span class="chip c-pacer">Пейсер ' + Math.ceil(g.pacerT) + ' с</span>';
    if (g.slowT > 0) chips += '<span class="chip c-slow">Замедление ' + Math.ceil(g.slowT) + ' с</span>';
    if (chips !== lastChips || force) { $('chips').innerHTML = chips; lastChips = chips; }
  }

  function toast(title, sub, tone) {
    const box = $('toasts');
    while (box.children.length >= 2) box.removeChild(box.firstChild);
    const el = document.createElement('div');
    el.className = 'toast ' + tone;
    const b = document.createElement('b'); b.textContent = title; el.appendChild(b);
    if (sub) { const s = document.createElement('span'); s.textContent = sub; el.appendChild(s); }
    box.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 2350);
  }

  function handleEvents() {
    for (const e of g.events) {
      switch (e.kind) {
        case 'item':
          toast(e.title, e.sub, 'good');
          A.play(e.type === 'caffeine' ? 'boost' : e.type === 'highfive' ? 'clap' : e.type === 'magnesium' || e.type === 'pacer' ? 'bonus' : 'pickup');
          if (G.navigator && navigator.vibrate && !reduced()) try { navigator.vibrate(12); } catch (x) { /* нет вибрации */ }
          break;
        case 'hit':
          toast(e.title, e.sub, 'bad');
          A.play('hit'); if (e.type === 'photographer') A.play('flash');
          if (G.navigator && navigator.vibrate) try { navigator.vibrate(40); } catch (x) { /* нет вибрации */ }
          break;
        case 'shield': toast(e.title, e.sub, 'good'); A.play('shield'); break;
        case 'district': toast(e.title, '', 'info'); break;
        case 'info': toast(e.title, e.sub, 'info'); break;
        case 'star': toast(e.title, e.sub, 'star'); A.play('bonus'); break;
        case 'jump': A.play('jump'); break;
        case 'finish': A.play('finish'); break;
      }
    }
    g.events.length = 0;
  }

  function showFinish() {
    state = 'done';
    A.updateMusic(0);
    $('fTime').textContent = fmt(g.result);
    const gm = Math.floor(g.finishT / 60), gs = Math.floor(g.finishT % 60);
    $('fFormula').textContent = 'Забег занял ' + gm + ' мин ' + String(gs).padStart(2, '0') + ' с игры — это ' + fmt(g.finishT * D.TIME_SCALE) + ' марафона (секунда игры = минута). Штрафы +' + fmtMS(g.penalty) + ', бонусы −' + fmtMS(g.bonus) + '.' +
      (g.recordCapped ? ' Быстрее 2:00:00 финишировать нельзя — результат упёрся в рекорд-лимит. Идеальный забег!' : '');
    $('fPos').textContent = g.finalPos + ' из ' + g.total;
    $('fOvt').textContent = g.overtakes;
    $('fBonus').textContent = '−' + fmtMS(g.bonus);
    $('fPen').textContent = '+' + fmtMS(g.penalty);
    const names = { gel: 'гели', banana: 'еда', water: 'вода', breath: 'дыхание', pacer: 'пейсер', caffeine: 'кофеин', magnesium: 'магний', highfive: '«дай пять»' };
    const hn = { puddle: 'лужи', fence: 'ограждения', barrier: 'заграждения', photographer: 'фотографы', dog: 'собаки', runner: 'бегуны' };
    const it = Object.keys(g.stats.items).map((k) => names[k] + ' ×' + g.stats.items[k]).join(', ');
    const ht = Object.keys(g.stats.hits).map((k) => hn[k] + ' ×' + g.stats.hits[k]).join(', ');
    $('fItems').textContent = 'Подобрано: ' + (it || 'ничего') + '.';
    $('fHits').textContent = 'Столкновения: ' + (ht || 'ни одного') + (g.stats.shield ? '; пейсер защитил ×' + g.stats.shield : '') + '.';
    $('fNote').textContent = (g.total > 1 ? 'Место считается по итоговому времени с бонусами и штрафами. ' : 'Соперников нет — ты бежишь один. ') +
      (roster.mode === 'demo' ? 'Соперники — демонстрационный список вымышленных бегунов.' : roster.mode === 'club' ? 'Соперники — участники клуба «Пыльные Гантели».' : 'Соперники загружены из файла «' + roster.file + '».') +
      (g.starsOn ? ' Звёзд бега позади: ' + g.stats.stars + ' из ' + D.STARS.length + ' — в место они не входят.' : '') +
      ' Трасса — художественная адаптация, не GPS-копия.';
    show('finish');
    document.body.classList.remove('playing');
  }

  /* ---------- управление ---------- */
  const reduced = () => !!(reduceMQ && reduceMQ.matches);
  function act(a) {
    if (!g || paused || state !== 'run') return;
    D.act(g, a);
  }
  G.addEventListener('keydown', (e) => {
    const k = e.key, c = e.code;
    let handled = true;
    if (state === 'menu' && (k === 'Enter') && document.activeElement === document.body) { startRun(); }
    else if (k === 'ArrowLeft' || c === 'KeyA') act('left');
    else if (k === 'ArrowRight' || c === 'KeyD') act('right');
    else if (k === ' ' || k === 'ArrowUp' || c === 'KeyW') { if (state === 'run' || state === 'countdown') act('jump'); else handled = false; }
    else if (k === '+' || k === '=' || c === 'NumpadAdd') act('cadUp');
    else if (k === '-' || k === '_' || c === 'NumpadSubtract') act('cadDown');
    else if (k === 'p' || k === 'P' || c === 'KeyP' || k === 'Escape') { if (state === 'run' || state === 'countdown') setPause(!paused); else handled = false; }
    else if (c === 'KeyM') toggleSound();
    else handled = false;
    if (handled && (state === 'run' || state === 'countdown')) e.preventDefault();
  });
  document.querySelectorAll('#controls [data-act]').forEach((b) => {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); act(b.dataset.act); b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 120); });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  // свайпы по игровому полю
  let ts = null;
  const cvs = $('game');
  cvs.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; ts = { x: t.clientX, y: t.clientY, t: performance.now() }; }, { passive: true });
  cvs.addEventListener('touchend', (e) => {
    if (!ts) return; const t = e.changedTouches[0];
    const dx = t.clientX - ts.x, dy = t.clientY - ts.y, dur = performance.now() - ts.t; ts = null;
    // короткое касание в любом месте поля — прыжок; свайп — перестроение
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) { if (dur < 450) act('jump'); return; }
    if (Math.abs(dx) > Math.abs(dy)) act(dx < 0 ? 'left' : 'right'); else if (dy < 0) act('jump');
  }, { passive: true });
  // мышь: клик по полю — прыжок
  cvs.addEventListener('mousedown', (e) => { if (e.button === 0) act('jump'); });
  // отключаем прокрутку и масштаб во время игры
  document.addEventListener('touchstart', () => document.body.classList.add('touch'), { passive: true, once: true });
  if (G.matchMedia && G.matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
  document.addEventListener('touchmove', (e) => { if (!e.target.closest('.screen')) e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('visibilitychange', () => { if (document.hidden && (state === 'run' || state === 'countdown') && !paused) setPause(true); });
  G.addEventListener('pagehide', () => { if ((state === 'run' || state === 'countdown') && !paused) setPause(true); });
  G.addEventListener('resize', () => R && R.resize());
  if (reduceMQ && reduceMQ.addEventListener) reduceMQ.addEventListener('change', () => R && R.setReduced(reduceMQ.matches));

  /* ---------- игровой цикл ---------- */
  let heroOn = true;
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000 || 0));
    last = now;
    try {
      if (state === 'menu') {
        if (heroOn) R.drawHero($('heroCanvas'), now / 1000);
      } else if (g && !paused) {
        if (state === 'countdown') {
          countT += dt;
          const n = 3 - Math.floor(countT / 0.6);
          if (n !== countShown) {
            countShown = n;
            const el = $('countdown');
            el.textContent = n > 0 ? String(n) : 'Марш!';
            el.classList.add('show');
            A.play(n > 0 ? 'tick' : 'go');
          }
          if (countT >= 1.8) { state = 'run'; setTimeout(() => { if (state !== 'countdown') $('countdown').classList.remove('show'); }, 450); }
          R.render(g, dt, { musicLevel: 0 });
        } else if (state === 'run') {
          D.update(g, dt);
          handleEvents();
          const djZ = D.kmToZ(D.DJ_KM);
          const lvl = Math.pow(D.clamp(1 - Math.abs(g.pz - djZ) / 260, 0, 1), 1.5);
          A.updateMusic(lvl);
          if (g.finished) { state = 'finishing'; finishDelay = 0; }
          R.render(g, dt, { musicLevel: lvl });
          hudT -= dt; if (hudT <= 0) { updateHUD(); hudT = 0.1; }
        } else if (state === 'finishing') {
          // после финиша бегун плавно сбавляет; мир для результата уже зафиксирован
          finishDelay += dt;
          g.speed *= Math.pow(0.25, dt); g.pz += g.speed * dt; g.phase += dt * 6;
          A.updateMusic(0);
          R.render(g, dt, { musicLevel: 0 });
          if (finishDelay > 1.4) { updateHUD(true); showFinish(); }
        } else if (state === 'done') {
          // экран финиша: сцену не перерисовываем
        }
      }
    } catch (err) {
      fatal('Игра остановилась из-за ошибки: ' + err.message);
      return;
    }
    requestAnimationFrame(frame);
  }

  function fatal(msg) {
    $('fatalMsg').textContent = msg;
    $('fatal').classList.add('show');
  }

  D._game = () => g; // для самопроверки в консоли
  D._setPause = setPause;

  /* ---------- запуск ---------- */
  function boot() {
    let note = '';
    try {
      if (D.Render3D && D.Render3D.supported()) { R = D.Render3D; R.init($('game'), $('overlay')); gfx3d = true; }
    } catch (e) { R = null; note = 'WebGL не запустился: ' + e.message; }
    if (!R) {
      try { R = D.Render2D; R.init($('game')); $('overlay').style.display = 'none'; }
      catch (e) { fatal('Браузер не дал доступ ни к WebGL, ни к Canvas 2D. Обнови браузер или открой игру в Safari или Chrome.'); return; }
      $('gfxNote').textContent = 'Упрощённая графика: ' + (note || '3D (WebGL) недоступен в этом браузере.');
    }
    loadRoster(); renderRoster(); soundUI();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => R.refreshShirt()).catch(() => {});
    last = performance.now();
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
