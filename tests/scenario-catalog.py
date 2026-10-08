"""Verify the unified scenario list, generated covers, motion and offline links."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/scenario-catalog';OUT.mkdir(exist_ok=True)
BASE=os.environ.get('CAWIKI_TEST_URL','http://127.0.0.1:4173/')
IDS=['boot','game','search','storage','typing','launch','save','music','streaming','call','multitasking','usb','sleep','ai','loading','record']

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-webgl'])
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE+'#wiki');page.locator('[data-wiki-tab="stories"]').click()
    cards=page.locator('#wiki-stories .story-card')
    assert cards.evaluate_all('(es)=>es.map(e=>e.dataset.scenario)')==IDS
    assert page.locator('#wiki-stories .story-cover svg').count()==4
    assert page.locator('#wiki-stories .cover-generated img').count()==12
    page.locator('#wiki-stories img').evaluate_all('(es)=>es.forEach(e=>e.loading="eager")')
    page.wait_for_function('Array.from(document.querySelectorAll("#wiki-stories img")).every(e=>e.complete&&e.naturalWidth>=1000)')
    assert '16' in page.locator('[data-wiki-tab="stories"]').inner_text()
    assert not page.locator('#wiki-learning,#all-map-scenarios').count()
    page.locator('#wiki-stories img').evaluate_all('(es)=>Promise.all(es.map(e=>e.decode()))')
    page.wait_for_timeout(150)
    page.screenshot(path=str(OUT/'wiki-all-scenarios.png'),full_page=True)
    for i,id in enumerate(IDS):
        expected=('#story/' if i<4 else '#map/scenario/')+id+'/0'
        assert cards.nth(i).get_attribute('href')==expected
        assert cards.nth(i).locator('.story-card-heading p').inner_text().startswith(str(i+1).zfill(2)+' /')
    card=cards.filter(has=page.locator('.cover-music'));image=card.locator('img');feedback=card.locator('.generated-feedback')
    assert feedback.evaluate('(e)=>getComputedStyle(e).opacity')=='0'
    card.hover();page.wait_for_timeout(1400)
    assert feedback.evaluate('(e)=>getComputedStyle(e).opacity')=='1'
    assert image.evaluate('(e)=>getComputedStyle(e).transform')!='matrix(1, 0, 0, 1, 0, 0)'
    card.screenshot(path=str(OUT/'music-hover.png'))
    page.mouse.move(0,0);page.locator('[data-wiki-tab="stories"]').focus();page.wait_for_timeout(1400)
    assert feedback.evaluate('(e)=>getComputedStyle(e).opacity')=='0'
    page.keyboard.press('Tab');card.focus();page.wait_for_timeout(1400)
    assert feedback.evaluate('(e)=>getComputedStyle(e).opacity')=='1'
    page.keyboard.press('Enter');page.wait_for_selector('.relation-step-copy')
    assert page.url.endswith('#map/scenario/music/0')
    page.get_by_role('link',name='시나리오 목록 ↗',exact=True).click();page.wait_for_selector('#collection-dialog[open]')
    assert page.locator('#story-grid .story-card').count()==16
    assert page.locator('#collection-total').inner_text()=='16 STORIES'
    for id in IDS[4:]:
        page.locator('#story-grid [data-scenario="'+id+'"]').click();page.wait_for_selector('.relation-step-copy')
        assert page.url.endswith('#map/scenario/'+id+'/0')
        page.get_by_role('link',name='시나리오 목록 ↗',exact=True).click();page.wait_for_selector('#collection-dialog[open]')
    page.evaluate('location.hash="map"');page.wait_for_selector('.relation-island')
    assert page.locator('.relation-island').count()==6
    assert not page.locator('.relation-scenarios,.relation-scenario-grid').count()
    assert '일상에서 따라가기' not in page.locator('#relationship-page').inner_text()
    page.evaluate('location.hash="map/scenarios"');page.wait_for_selector('#collection-dialog[open]')
    assert page.url.endswith('#stories')
    print('16 unique cards / 12 images / numbering / hover and keyboard / 12 destinations / legacy URL PASS',flush=True)
    page.set_viewport_size({'width':390,'height':844});page.emulate_media(reduced_motion='reduce')
    assert page.locator('#collection-dialog').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
    card=page.locator('#story-grid [data-scenario="typing"]');page.keyboard.press('Tab');card.focus();card.scroll_into_view_if_needed()
    assert card.locator('img').evaluate('(e)=>getComputedStyle(e).transform')=='none'
    assert card.locator('.generated-light').evaluate('(e)=>getComputedStyle(e).animationName')=='none'
    page.screenshot(path=str(OUT/'mobile-scenarios.png'))
    assert not errors,errors
    browser.close()
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-webgl'])
    ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    page=ctx.new_page();requests=[];page.on('request',lambda r:requests.append(r.url))
    page.on('pageerror',lambda e:errors.append(str(e)))
    url=BASE+'artifacts/inside-site.html';page.goto(url+'#stories');page.wait_for_selector('#collection-dialog[open]');ctx.set_offline(True)
    page.locator('#story-grid img').evaluate_all('(es)=>es.forEach(e=>e.loading="eager")')
    page.wait_for_function('Array.from(document.querySelectorAll("#story-grid img")).every(e=>e.complete&&e.naturalWidth>=1000)')
    page.locator('#story-grid [data-scenario="record"]').tap();page.wait_for_selector('.relation-step-copy')
    assert page.url.endswith('#map/scenario/record/0')
    assert all(r.split('#')[0]==url or r.startswith(('blob:','data:')) for r in requests)
    assert not errors,errors
    browser.close();print('Mobile / reduced motion / touch / all covers offline / no page errors PASS',flush=True)
