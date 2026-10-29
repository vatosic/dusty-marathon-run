#!/bin/sh
# Сборка: часть 1 (дизайн и графика) + часть 2 (технология и логика) → dist/index.html
set -e
cd "$(dirname "$0")"
mkdir -p dist
python3 - <<'PY'
order = ['part2-logic-tech/data.js', 'part2-logic-tech/club.js', 'part2-logic-tech/sim.js', 'part2-logic-tech/audio.js',
         'part1-design-graphics/render2d.js', 'part1-design-graphics/textures.js', 'part1-design-graphics/characters.js', 'part1-design-graphics/architecture3d.js',
         'part1-design-graphics/world3d.js', 'part1-design-graphics/render3d.js', 'part2-logic-tech/main.js']
t = open('part1-design-graphics/index.template.html').read()
js = ''.join('<script>\n/* ' + f + ' */\n' + open(f).read() + '\n</script>\n' for f in order)
open('dist/index.html', 'w').write(t.replace('<!--SCRIPTS-->', js))
PY
echo built dist/index.html
