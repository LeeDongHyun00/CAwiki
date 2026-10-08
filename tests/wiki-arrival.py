"""Film → Wiki shared title/models, completion, cancellation and replay.

The source response is instrumented only inside this browser test; production
does not expose the animation controller. Use the portable smoke test below
with CAWIKI_PORTABLE_URL to verify the packaged site as well.
"""
from pathlib import Path
import json
import os
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/wiki-arrival'
OUT.mkdir(exist_ok=True)
BASE=os.environ.get('CAWIKI_TEST_URL','http://127.0.0.1:4173/')
source=(ROOT/'design/redesign/wiki-arrival.js').read_text().replace('this.page=page;','window.__arrival=this;this.page=page;')

def ending(page):
    page.evaluate('scrollTo({top:document.querySelector("#sequence").offsetHeight-innerHeight,behavior:"instant"})')
    page.wait_for_function('Number(document.body.dataset.filmProgress)>.9999',timeout=60000)

def complete(page):
    page.wait_for_selector('body[data-mode="wiki"]:not(.wiki-arriving)',timeout=90000)
    assert not page.locator('.wiki-flight-title,.wiki-flight-backdrop').count()
    assert not page.locator('#wiki-page').evaluate('(e)=>e.inert||e.hasAttribute("aria-busy")')
    assert page.locator('#wiki-hardware>li').count()==23
    assert page.locator('#wiki-hardware').is_visible()
    assert page.evaluate('document.activeElement.id')=='wiki-title'
    assert page.locator('canvas').count()==1

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1200,'height':800},device_scale_factor=.75)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/wiki-arrival.js',lambda r:r.fulfill(body=source,content_type='text/javascript'))
    page.goto(BASE+'#screen');page.wait_for_selector('body.ready',timeout=90000);ending(page);page.wait_for_timeout(1900)
    page.evaluate('''() => {
      const a=__arrival,tick=a.tick;window.trace=[];
      const states=stage=>Object.entries(stage.computer.parts).map(([id,p])=>({id,
        position:p.model.root.position.toArray(),rotation:p.model.root.quaternion.toArray(),scale:p.model.root.scale.toArray()}));
      a.tick=t=>{
        tick(t);if(!a.active)return;
        if(!window.borrowedStage){window.borrowedStage=a.snapshot.stage;window.original=states(borrowedStage);}
        trace.push({time:a.elapsed,phase:document.body.dataset.wikiArrival,
          chrome:Number(getComputedStyle(document.querySelector('.wiki-tabs')).opacity),
          title:document.querySelector('.wiki-flight-title').getBoundingClientRect().toJSON(),
          items:a.items.map(i=>({id:i.id,index:i.card.index,delay:i.delay,duration:i.duration,
            from:i.from,to:i.to,position:i.group.position.toArray(),scale:i.group.scale.x,rotation:i.group.quaternion.toArray()}))});
      };
      window.originalStates=()=>states(borrowedStage);
    }''')
    page.locator('.wiki-enter').click()
    page.wait_for_selector('body.wiki-arriving')
    assert page.locator('#wiki-page').evaluate('(e)=>e.inert')
    complete(page)
    trace=page.evaluate('trace')
    assert len(trace)>35,len(trace)
    first=trace[0];last=trace[-1]
    assert len(first['items'])==12
    assert [i['index'] for i in first['items']]==sorted(i['index'] for i in first['items'])
    assert len({i['delay'] for i in first['items']})==12
    assert len({round(f['items'][0]['position'][0],3) for f in trace})>12
    assert all(abs(i['position'][0]-i['to']['x'])<1e-8 and abs(i['position'][1]-i['to']['y'])<1e-8 for i in last['items'])
    for frame in trace:
        if frame['chrome']>0:
            assert all(frame['time']>=i['delay']+i['duration'] for i in frame['items'])
    assert page.evaluate('JSON.stringify(original)===JSON.stringify(originalStates())')
    assert page.locator('.wiki-top a').is_visible()
    assert page.locator('[data-wiki-tab="hardware"]').get_attribute('aria-pressed')=='true'
    page.screenshot(path=str(OUT/'desktop-final.png'))
    print('Live title / 12 borrowed models / staggered destinations / chrome after landing / originals untouched PASS',flush=True)

    # A previous Stories tab must not hide the destination hardware grid.
    page.locator('[data-wiki-tab="stories"]').click();assert page.locator('#wiki-stories li').count()==16
    page.locator('.wiki-top a').click();page.wait_for_selector('body[data-mode="home"]');ending(page)
    page.locator('.wiki-enter').click();page.wait_for_selector('body.wiki-arriving')
    page.mouse.wheel(0,400);complete(page)
    print('Stories → film → hardware / user scroll completes transition PASS',flush=True)

    # A route change during a flight cannot leave a canvas or inert overlay.
    page.evaluate('location.hash="home"');page.wait_for_selector('body[data-mode="home"]')
    page.locator('.collection-entry').click();page.wait_for_selector('body.wiki-arriving')
    page.evaluate('location.hash="map/group/compute"');page.wait_for_selector('.rr-webgl[data-moving="false"]',timeout=90000)
    assert not page.locator('.wiki-flight-title,.wiki-flight-backdrop,body.wiki-arriving').count()
    assert not page.locator('#wiki-page').evaluate('(e)=>e.inert')
    assert page.locator('canvas').count()==1
    page.evaluate('location.hash="home"');page.wait_for_selector('body[data-mode="home"]');ending(page)
    assert page.locator('#world').is_visible() and not page.locator('body.failed').count()
    page.screenshot(path=str(OUT/'replay.png'))
    print('Early entry / mid-flight route change / relation renderer / original film replay PASS',flush=True)

    page.locator('.wiki-enter').focus();page.keyboard.press('Enter');page.wait_for_selector('body.wiki-arriving')
    page.emulate_media(reduced_motion='reduce');complete(page)
    page.locator('.wiki-top a').click();page.wait_for_selector('body[data-mode="home"]');ending(page)
    page.locator('.wiki-enter').focus();page.keyboard.press('Enter');complete(page)
    assert not page.locator('body.wiki-arriving').count()
    print('Keyboard entry / reduced motion changed during flight / reduced motion direct entry PASS',flush=True)

    mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
    touch=mobile.new_page();touch.on('pageerror',lambda e:errors.append(str(e)))
    touch.goto(BASE+'#screen');touch.wait_for_selector('body.ready',timeout=90000);ending(touch)
    touch.locator('.wiki-enter').tap();touch.wait_for_selector('body.wiki-arriving');complete(touch)
    assert touch.evaluate('document.documentElement.scrollWidth===innerWidth')
    touch.screenshot(path=str(OUT/'mobile-final.png'))
    touch.locator('.wiki-top a').tap();touch.wait_for_selector('body[data-mode="home"]');ending(touch)
    touch.locator('.wiki-enter').tap();touch.wait_for_selector('body.wiki-arriving')
    touch.set_viewport_size({'width':844,'height':390});complete(touch)
    assert touch.evaluate('document.documentElement.scrollWidth===innerWidth')
    print('Touch entry / portrait placement / orientation change cleanup PASS',flush=True)
    assert not errors,errors
    report={'frames':len(trace),'sourceModels':[i['id'] for i in first['items']],
      'first':first,'last':last,'scrollInterrupt':True,'routeInterrupt':True,
      'keyboard':True,'reducedMotion':True,'mobile':True,'orientationChange':True,'errors':errors}
    (OUT/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    browser.close()

    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-webgl'])
    fallback=browser.new_page(viewport={'width':390,'height':844});fallback.goto(BASE+'#screen')
    fallback.wait_for_selector('body.failed');ending(fallback);fallback.locator('.wiki-enter').click();complete(fallback)
    print('WebGL fallback: complete usable list, no blocked controls PASS',flush=True);browser.close()

    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
    context=browser.new_context(viewport={'width':1000,'height':760},device_scale_factor=.75)
    portable=context.new_page();pack_errors=[];portable.on('pageerror',lambda e:pack_errors.append(str(e)))
    portable.goto(os.environ.get('CAWIKI_PORTABLE_URL','http://127.0.0.1:4174/')+'#screen');portable.wait_for_selector('body.ready',timeout=90000);ending(portable)
    context.set_offline(True);portable.locator('.wiki-enter').click();portable.wait_for_selector('body.wiki-arriving');complete(portable)
    portable.locator('#wiki-hardware a[href="#object/cpu"]').click();portable.wait_for_selector('body[data-mode="object"]:not(.loading)',timeout=90000)
    portable.locator('#object-exit').click();complete(portable)
    assert not pack_errors,pack_errors
    print('Portable offline animation / shared renderer / hardware detail return PASS',flush=True);browser.close()
