import os, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(os.path.join(ROOT, 'shots'), exist_ok=True)
os.chdir(ROOT)
THREE = open(os.path.join(ROOT, 'node_modules/three/build/three.min.js')).read()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    c = b.new_context(viewport={'width':900,'height':900}); c.route('**/three.min.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=THREE))
    pg = c.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + os.path.join(ROOT, 'dist/index.html')); time.sleep(1.5)
    pg.locator('.hero').screenshot(path='shots/hero.png')
    # крупный план героя в забеге: камера ближе
    pg.click('#btnStart'); time.sleep(3)
    pg.evaluate("() => { const g = DUSTY._game(); g.pz = DUSTY.kmToZ(8.0); g.t = 40; g.speed = 16; }"); time.sleep(3)
    pg.screenshot(path='shots/close_run.png', clip={'x':250,'y':330,'width':400,'height':560})
    b.close(); print(errs)
