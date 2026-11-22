# CLAUDE.md — контекст проекта DUSTY Marathon Run

Браузерная 3D-аркада для бегового клуба «Пыльные Гантели» (Dusty Dumbbells Anonymous Running Club, est. 2019).
Марафон 42,195 км по московским набережным от Краснопресненской до Кремля. Язык интерфейса и общения — русский.
Игра опубликована на GitHub Pages: https://vatosic.github.io/dusty-marathon-run/

## Как работаем: два чата
Работа разделена на два куска — у каждого свой чат, своя ветка и свой PR, чтобы чат держал в памяти только своё.
- «Дизайн» — `part1-design-graphics/` и стили в `index.template.html`: как всё выглядит (подробности —
  `part1-design-graphics/CLAUDE.md`). Правила, баланс и звук здесь не меняем.
- «Техника и алгоритмы» — `part2-logic-tech/` и `test/`: правила, баланс, соперники, звук, участники, тесты, сборка и CI
  (подробности — `part2-logic-tech/CLAUDE.md`). Внешний вид здесь не меняем.
- Пограничное: как выглядят HUD и предупреждения (CSS) — дизайн; что и когда показывать (`main.js`) — техника.
  Визуальные данные в `data.js` (`D.STYLES`, `styles` районов, `D.LANDMARKS*`) правит дизайн, правила и константы игры — техника.
- `dist/index.html` пересобирается в каждом PR; при конфликте в нём руками не править — пересобрать `sh build.sh`.
- Сообщать заказчику коротко; ссылку на проверку давать на коммит: `https://raw.githack.com/vatosic/dusty-marathon-run/<коммит>/dist/index.html`.

## Структура (две части — так попросил заказчик)
- `part1-design-graphics/` — дизайн и графика: `render3d.js` (Three.js r149, камера, свет, тени, пулы объектов, 2D-слой с именами),
  `characters.js` (скелет бегуна, беговой цикл, позы болельщиков, толпа на InstancedMesh, собака), `architecture3d.js` (стили зданий
  по районам: шейдер фасадов, цоколи, карнизы, крыши, башни, портики, трубы, балконы; объёмные ориентиры), `world3d.js` (набережная,
  дорога и тартан Лужников, мосты, Кремль, арки, рейв-сцены Дасти, небо), `textures.js` (процедурные текстуры, майка героя),
  `render2d.js` (резервная 2D-графика без WebGL), `index.template.html` (разметка и стили).
- `part2-logic-tech/` — технология и логика: `data.js` (маршрут, районы, константы, звёзды бега, импорт участников),
  `club.js` (встроенный список клуба, генерируется `club_roster.py`), `sim.js` (все правила, без DOM), `audio.js` (Web Audio),
  `main.js` (игровой цикл, ввод, HUD, экраны).
- `build.sh` склеивает всё в один файл `dist/index.html`. Three.js грузится с cdn.jsdelivr.net (three@0.149.0, UMD).
- `.github/workflows/pages.yml` — при пуше в `main`: `node test/test.js` → сборка → публикация `dist/` на GitHub Pages.
  В PR в `main` — только тесты и сборка. Изменения — через ветку и PR, в `main` вливать после проверки.

## Команды
- `sh build.sh` — собрать. После любых правок в `part1`/`part2` пересобрать и закоммитить `dist/index.html`.
- `node test/test.js` — проверка правил и прогон всей дистанции ботами (идеальный, средний, пассивный). Должно быть 0 провалов.
- `npm install && python3 test/browser3d.py 390x844` — проверка в браузере (Playwright для Python), скриншоты в `shots/`.

## Участники
- По умолчанию соперники — встроенный список клуба (`club.js`): первые 100 аккаунтов «Пыльных Гантелей» из выгрузки заказов
  DDLONG (срез 28.10.2026), по числу заказов, при равенстве — по ID. Заказ — регистрация, не посещение: так и подписывать.
  `python3 part2-logic-tech/club_roster.py выгрузка.xlsx [--short]` пересобирает список: служебные аккаунты (`SERVICE_NAMES`)
  пропускаются, перепутанные имя/фамилия (`SWAPPED_NAMES`) исправляются. В `club.js` — только имена: без ID сайта, числа
  заказов, телефонов и почты. Саму выгрузку и ID сайта в репозиторий не класть.
  Имена публикуются полностью, как в профиле (решение заказчика, 29.10.2026); `--short` даёт «Имя Ф.».
- Импорт CSV/JSON: `id, name, club, long_runs_attended` или `user_id, name, club, event_id, attended`.
  Фильтр клуба «Пыльные Гантели» / «Dusty Dumbbells», объединение по ID, топ-100 по посещённым лонгам, при равенстве — по ID.
- Демо-список вымышленных прозвищ — по кнопке. Никогда не выдавать его за реальный рейтинг, не придумывать реальных людей,
  не хранить телефоны и почту.
- Звёзды бега (`D.STARS` в `data.js`) — 20 известных бегунов России по открытым источникам. Подписи — только подтверждённые
  факты. Результатов за них не придумывать: в место и итоговое время звёзды не входят, считается только «позади N из 20».
  Их темп на трассе — игровой (быстрее 2:30), время звёзд нигде не показывается.

## Шрифты (правило заказчика, 22.11.2026; действует для обоих чатов)
- Запрещены шрифты, типичные для сайтов из ИИ-шаблонов, — везде: в заголовках, основном тексте, fallback-стеке CSS и в
  `ctx.font` на canvas: Inter, Manrope, Montserrat, Poppins, DM Sans, Space Grotesk, Plus Jakarta Sans, Outfit, Geist,
  Playfair Display, Roboto, Open Sans, Unbounded, Golos / Golos Text. Шрифт, часто встречающийся в ИИ-шаблонах, но не из
  списка, — тоже запрещён. Не использовать шаблоны и штампы, по которым видно, что сайт сделан ИИ.
- Разрешённые (все с кириллицей). Подбирать под идею проекта, а не первый из списка; перед использованием проверить
  кириллицу на реальном тексте.
  - Гротески: Sofia Sans (+ Condensed, Extra Condensed), Commissioner, Geologica, Ysabeau, Tenor Sans (заголовки), Arsenal,
    Wix Madefor Display, Overpass, Exo 2, Jura, PT Root UI (Paratype, не на Google Fonts), Fixel (MacPaw, не на Google Fonts).
  - Антиквы: Literata, Spectral, Brygada 1918, Alegreya, Vollkorn, Piazzolla, Source Serif 4, EB Garamond, Old Standard TT,
    Ledger, Bona Nova, Alice, Kurale, Prata (только заголовки), Yeseva One (только заголовки).
  - Брусковые: Podkova, Kelly Slab (заголовки).
  - Декоративные (только заголовки и акценты): Forum, Oranienbaum, Ruslan Display, Philosopher.
  - Моноширинные: Martian Mono, Victor Mono.
  - Платные: Brownfox — Formular, Kazimir; Contrast Foundry — CoFo Sans, CoFo Robert, CoFo Gothic.
- Проверенные пары: Sofia Sans Condensed (заголовки) + Literata (текст); Commissioner (заголовки) + Spectral (текст).
- В конце стека — только системные шрифты: гротески `system-ui, -apple-system, "Segoe UI", sans-serif`;
  антиквы `Georgia, "Times New Roman", serif`; моноширинные `ui-monospace, Menlo, Consolas, monospace`.
- Сейчас игра правилу не соответствует: Unbounded и Golos Text (и Roboto в стеке) в `index.template.html`, `render2d.js`,
  `render3d.js`, `textures.js`, `world3d.js` — замена за чатом «Дизайн».

## Принципы работы
- Не заявлять, что что-то протестировано на устройстве, подключено к сайту клуба или опубликовано, если этого не было.
- Трасса — художественная адаптация, не GPS-копия.
- `pages.yml`: checkout@v7, setup-node@v7 (Node 24, без автокэша), upload-pages-artifact@v5, deploy-pages@v5.
