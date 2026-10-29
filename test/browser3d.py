import os, sys, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(os.path.join(ROOT, 'shots'), exist_ok=True)
os.chdir(ROOT)
THREE = open(os.path.join(ROOT, 'node_modules/three/build/three.min.js')).read()
url = 'file://' + os.path.join(ROOT, 'dist/index.html')
def route(r):
    r.fulfill(status=200, content_type='application/javascript', body=THREE)
errs = []
kms = [float(a) for a in sys.argv[2:]] or [3, 11, 20, 23.9, 33, 41]
w, h = [int(v) for v in (sys.argv[1] if len(sys.argv) > 1 else '390x844').split('x')]
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width':w,'height':h}, device_scale_factor=1, is_mobile=w<h, has_touch=w<h)
    ctx.route('**/three.min.js', route)
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') and 'ERR_NAME' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
    pg.goto(url); time.sleep(2.0)
    pg.screenshot(path=f'shots/{w}_start.png')
    print('3d:', pg.evaluate("() => !!DUSTY.Render3D && DUSTY.Render3D.supported()"), 'note:', pg.inner_text('#gfxNote'))
    pg.click('#btnStart'); time.sleep(4)
    pg.screenshot(path=f'shots/{w}_run.png')
    for km in kms:
        pg.evaluate(f"() => {{ const g = DUSTY._game(); g.pz = DUSTY.kmToZ({km}); g.t = Math.max(g.t, g.pz/14); }}")
        time.sleep(2.5)
        pg.screenshot(path=f'shots/{w}_km{km}.png')
    if w < h:
        pg.tap('#game', position={'x': w//2, 'y': h//2}); time.sleep(0.15)
        print('tap jump:', pg.evaluate("() => DUSTY._game().vy > 0 || DUSTY._game().y > 0"))
    fps = pg.evaluate("""() => new Promise(res => { let n=0; const t0=performance.now(); function f(){ n++; if (performance.now()-t0<2000) requestAnimationFrame(f); else res(n/2); } requestAnimationFrame(f); })""")
    print('fps (swiftshader, CPU):', fps)
    pg.evaluate("() => { const g = DUSTY._game(); g.pz = DUSTY.WORLD_LEN - 20; }")
    pg.wait_for_selector('#finish.show', timeout=90000)
    pg.screenshot(path=f'shots/{w}_finish.png')
    print('finish:', pg.is_visible('#finish'), pg.inner_text('#fFormula')[:160])
    pg.click('#btnAgain'); time.sleep(3)
    print('restart:', pg.evaluate("() => { const g = DUSTY._game(); return [DUSTY.zToKm(g.pz).toFixed(2), g.bonus, g.penalty, g.position]; }"))
    b.close()
print('ERRORS:', errs[:10])
