"""Встроенный список соперников из выгрузки заказов DDLONG → part2-logic-tech/club.js

    python3 part2-logic-tech/club_roster.py выгрузка.xlsx [--short]

Берёт первые 100 аккаунтов клуба «Пыльные Гантели» в порядке выгрузки (заказы по убыванию, затем ID),
пропуская служебные. В club.js попадают только имя и фамилия (с --short — «Имя Ф.»):
без ID сайта, без числа заказов, без других полей. Сам файл выгрузки в репозиторий не кладём.
"""
import csv, json, os, re, sys

LIMIT = 100
# по именам, как в профиле («Имя Фамилия»), — чтобы ID сайта не попадали в репозиторий
SERVICE_NAMES = {'EVENT DD'}                                                     # служебный аккаунт
SWAPPED_NAMES = {'Рыжков Дмитрий', 'Авдеева Евгения', 'Амосов Клим', 'Карпов Петр'}  # фамилия стоит в поле «Имя»
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'club.js')


def rows_of(path):
    if path.lower().endswith('.xlsx'):
        import openpyxl
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        return [[('' if v is None else str(v)).strip() for v in r] for r in wb.worksheets[0].iter_rows(values_only=True)]
    with open(path, encoding='utf-8-sig', newline='') as f:
        return [[c.strip() for c in r] for r in csv.reader(f)]


def is_dusty(club):
    c = re.sub(r'\s+', ' ', club.lower().replace('ё', 'е')).strip()
    return 'пыльные гантели' in c or 'dusty dumbbells' in c


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    short = '--short' in sys.argv
    if len(args) != 1:
        sys.exit(__doc__)
    rows = rows_of(args[0])
    head = next(i for i, r in enumerate(rows) if r[:4] == ['ID', 'Имя', 'Фамилия', 'Клуб'])
    snap = next((m for r in rows[:head] for c in r for m in [re.search(r'Срез (\d{4})-(\d\d)-(\d\d)', c)] if m), None)
    date = '.'.join(reversed(snap.groups())) if snap else ''  # «Срез 2026-10-28» → 28.10.2026
    people = []
    for r in rows[head + 1:]:
        as_is = (r[1] + ' ' + r[2]).strip() if len(r) > 2 else ''
        if len(r) < 5 or not r[0] or as_is in SERVICE_NAMES or not is_dusty(r[3]):
            continue
        first, last = (r[2], r[1]) if as_is in SWAPPED_NAMES else (r[1], r[2])
        orders = int(float(r[4] or 0))
        people.append((-orders, int(r[0]), first, last))
    people.sort()
    names = []
    for _, _, first, last in people[:LIMIT]:
        name = first + (' ' + last[0] + '.' if short and last else ' ' + last if last else '')
        names.append(re.sub(r'\s+', ' ', name).strip()[:24])
    assert len(set(names)) == len(names), 'одинаковые имена — нужна ручная проверка'
    body = ',\n'.join('    ' + json.dumps(n, ensure_ascii=False) for n in names)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('/* DUSTY Marathon Run — встроенный список соперников: участники клуба «Пыльные Гантели».\n'
                '   Сгенерировано club_roster.py из выгрузки заказов DDLONG; первые ' + str(len(names)) +
                ' аккаунтов по числу заказов\n'
                '   (заказы — это регистрации, не подтверждённые посещения). Только имена: без ID, контактов и счётчиков. */\n'
                '(function (G) {\n'
                '  \'use strict\';\n'
                '  const D = G.DUSTY;\n'
                '  D.CLUB_ROSTER_DATE = ' + json.dumps(date) + '; // срез выгрузки\n'
                '  D.CLUB_ROSTER_NAMES = [\n' + body + '\n  ];\n'
                '  D.clubParticipants = () => D.CLUB_ROSTER_NAMES.map((name, i) => ({ id: \'club-\' + String(i + 1).padStart(3, \'0\'), name, count: null }));\n'
                '})(typeof globalThis !== \'undefined\' ? globalThis : window);\n')
    print('wrote', OUT, len(names), 'names', '(short)' if short else '(full)')


if __name__ == '__main__':
    main()
