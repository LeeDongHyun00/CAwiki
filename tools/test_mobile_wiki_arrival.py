"""Exercise the published split-module film, including real touch activation.

Controller instrumentation is confined to the intercepted browser response.
Run a local HTTP server at CAWIKI_TEST_URL (default port 4173).
"""
from pathlib import Path
import json
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/performance/opening-principles'
OUT.mkdir(parents=True, exist_ok=True)
BASE = os.environ.get('CAWIKI_TEST_URL', 'http://127.0.0.1:4173/index.html')
SOURCE = (ROOT / 'lib/inside/wiki-arrival.js').read_text().replace(
    'this.page=page;', 'window.__arrival=this;this.page=page;')

TRACE = '''() => {
 const a=__arrival, tick=a.tick;
 const states=stage=>Object.entries(stage.computer.parts).map(([id,p])=>({id,
   position:p.model.root.position.toArray(),rotation:p.model.root.quaternion.toArray(),scale:p.model.root.scale.toArray()}));
 window.trace=[];
 a.tick=t=>{
   tick(t);if(!a.active)return;
   if(!window.borrowedStage){window.borrowedStage=a.snapshot.stage;window.original=states(borrowedStage);}
   trace.push({time:a.elapsed,chrome:Number(getComputedStyle(document.querySelector('.wiki-tabs')).opacity),
     items:a.items.map(i=>({id:i.id,delay:i.delay,duration:i.duration,from:i.from,to:i.to,
       position:i.group.position.toArray(),scale:i.group.scale.x,visible:i.group.visible}))});
 };
 window.originalStates=()=>states(borrowedStage);
 window.freezeArrival=()=>cancelAnimationFrame(a.frame);
 window.sampleArrival=t=>{cancelAnimationFrame(a.frame);a.elapsed=t;a.tick(0);};
}'''


def ending(page):
    page.wait_for_selector('body.ready', timeout=120000)
    page.evaluate('scrollTo({top:document.querySelector("#sequence").offsetHeight-innerHeight,behavior:"instant"})')
    page.wait_for_function('Number(document.body.dataset.filmProgress)>.9999', timeout=120000)


def enter(page, mobile):
    ending(page)
    if mobile:
        page.locator('.wiki-enter').tap()
    else:
        page.locator('.wiki-enter').click()


def complete(page, focused=True):
    page.wait_for_selector('body[data-mode="wiki"]:not(.wiki-arriving)', timeout=90000)
    assert not page.locator('.wiki-flight-title,.wiki-flight-backdrop').count()
    assert not page.locator('#wiki-page').evaluate('e=>e.inert||e.hasAttribute("aria-busy")')
    assert page.locator('#wiki-hardware>li').count() == 23
    assert page.evaluate('document.documentElement.scrollWidth===innerWidth')
    assert page.locator('#world').evaluate('e=>!e.style.width&&!e.style.height')
    if focused:
        assert page.evaluate('document.activeElement.id') == 'wiki-title'


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--enable-unsafe-swiftshader'])
    errors, results = [], []
    for mobile in [False, True]:
        page = browser.new_page(viewport={'width':390 if mobile else 1200, 'height':844 if mobile else 800},
                                is_mobile=mobile, has_touch=mobile, device_scale_factor=1)
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/lib/inside/wiki-arrival.js*', lambda r: r.fulfill(body=SOURCE, content_type='text/javascript'))
        page.goto(BASE+'#screen')
        ending(page)
        page.evaluate(TRACE)
        enter(page, mobile)
        page.wait_for_selector('body.wiki-arriving')
        complete(page)
        trace = page.evaluate('trace')
        assert len(trace) > 35, len(trace)
        first, last = trace[0], trace[-1]
        assert len(first['items']) == 12, first
        assert len({i['delay'] for i in first['items']}) == 12
        assert len({round(f['items'][0]['position'][0], 3) for f in trace}) > 12
        assert all(abs(i['position'][0]-i['to']['x']) < 1e-8 and abs(i['position'][1]-i['to']['y']) < 1e-8 for i in last['items'])
        assert all(all(f['time'] >= i['delay']+i['duration'] for i in f['items']) for f in trace if f['chrome'] > 0)
        assert page.evaluate('JSON.stringify(original)===JSON.stringify(originalStates())')
        profile = 'mobile' if mobile else 'desktop'
        page.screenshot(path=str(OUT / f'{profile}-wiki-landed.png'))
        results.append({'profile':profile, 'frames':len(trace), 'first':first, 'last':last})
        print(profile, '12 models / original transforms / destination alignment / navigation timing PASS', flush=True)

        if not mobile:
            page.close()
            continue

        # On a phone the address bar changes height without changing grid widths.
        page.evaluate('location.hash="screen"')
        enter(page, True)
        page.wait_for_selector('body.wiki-arriving')
        page.evaluate('freezeArrival();sampleArrival(700)')
        page.screenshot(path=str(OUT / 'mobile-wiki-flight.png'))
        before = page.evaluate('({items:__arrival.items.map(i=>i.to),rect:__arrival.cards[0].el.getBoundingClientRect().toJSON()})')
        page.set_viewport_size({'width':390,'height':760})
        page.wait_for_timeout(100)
        assert page.evaluate('__arrival.active')
        assert page.locator('#world').evaluate('e=>e.style.height') == '844px'
        after = page.evaluate('({items:__arrival.items.map(i=>i.to),rect:__arrival.cards[0].el.getBoundingClientRect().toJSON()})')
        assert before == after, (before, after)
        page.evaluate('sampleArrival(__arrival.endAt)')
        complete(page)
        assert page.locator('#world').evaluate('e=>e.height') == 760
        print('Address-bar height change retains flight coordinates and restores backing buffer PASS', flush=True)

        # Rotation changes the destination layout; complete cleanly into that grid.
        page.evaluate('location.hash="screen"')
        enter(page, True)
        page.wait_for_selector('body.wiki-arriving')
        page.evaluate('freezeArrival()')
        page.set_viewport_size({'width':844,'height':390})
        complete(page)
        print('Orientation change releases canvas and controls PASS', flush=True)

        # Cancel via a real user gesture or a new route, then replay the same film.
        page.set_viewport_size({'width':390,'height':844})
        page.evaluate('location.hash="screen"')
        enter(page, True)
        page.wait_for_selector('body.wiki-arriving')
        page.evaluate('freezeArrival()')
        page.dispatch_event('body', 'touchmove')
        complete(page)
        page.evaluate('location.hash="screen"')
        enter(page, True)
        page.wait_for_selector('body.wiki-arriving')
        page.evaluate('freezeArrival();location.hash="home"')
        page.wait_for_selector('body[data-mode="home"]:not(.wiki-arriving)')
        assert not page.locator('.wiki-flight-title,.wiki-flight-backdrop').count()
        assert not page.locator('#wiki-page').evaluate('e=>e.inert')
        assert not page.locator('body.failed').count()
        print('Scroll interruption / route change / film replay PASS', flush=True)

        page.emulate_media(reduced_motion='reduce')
        page.evaluate('location.hash="screen"')
        enter(page, True)
        complete(page)
        assert not page.evaluate('__arrival.active')
        print('Reduced motion keeps direct, usable navigation PASS', flush=True)
        page.close()

    still = browser.new_page(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
    still.goto(BASE+'?quality=still#screen')
    ending(still)
    still.locator('.wiki-enter').tap()
    complete(still)
    print('Image-only mode retains complete hardware list PASS', flush=True)
    assert not errors, errors
    (OUT/'wiki-arrival.json').write_text(json.dumps({'runs':results,'errors':errors,'heightResize':True,'orientation':True,'routeInterruption':True,'reducedMotion':True,'imageOnly':True}, indent=2))
    browser.close()
