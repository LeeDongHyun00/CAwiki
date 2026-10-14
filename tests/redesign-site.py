"""Browser integration checks for Inside. Run serve.py 4173 before this script.
Requires Playwright and Chromium; uses software WebGL when run in the cloud.
"""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/redesign-site'
BASE=os.environ.get('CAWIKI_TEST_URL','http://127.0.0.1:4173/')
BROWSER=os.environ.get('CAWIKI_CHROMIUM','/usr/bin/chromium')
OUT.mkdir(parents=True,exist_ok=True)

def ready(page):
    page.wait_for_selector('body.ready',timeout=90000)
    page.wait_for_selector('body:not(.loading)')
    page.wait_for_timeout(250)

def navigate(page,fragment,title=None):
    page.evaluate('(hash)=>location.hash=hash',fragment)
    if title:
        page.wait_for_function('(title)=>document.querySelector("#object-name").textContent===title',arg=title)
    ready(page)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=BROWSER,args=['--no-sandbox','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1,reduced_motion='reduce')
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE);ready(page)
    assert page.locator('header,nav,.filmstrip').count()==0
    page.screenshot(path=str(OUT/'site-home.png'))
    page.locator('.collection-entry').click();page.wait_for_selector('#wiki-page:not([hidden])')
    assert page.locator('#wiki-hardware li').count()==23
    page.evaluate('location.hash="collection"');page.wait_for_selector('#collection-dialog[open]')
    assert page.locator('#collection-grid li').count()==23
    page.screenshot(path=str(OUT/'site-collection.png'))
    page.locator('[data-filter="memory"]').click();assert page.locator('#collection-grid li').count()==4
    page.locator('[data-filter="all"]').click();page.locator('#search').fill('하드 디스크')
    assert page.locator('#collection-grid li').count()==1
    page.locator('#collection-grid a').click();page.wait_for_function('document.querySelector("#object-name").textContent==="HDD"');ready(page)
    clip={'x':350,'y':200,'width':600,'height':500}
    before=page.screenshot(clip=clip)
    page.mouse.move(600,400);page.mouse.down();page.mouse.move(850,520,steps=10);page.mouse.up();page.wait_for_timeout(250)
    assert page.screenshot(clip=clip)!=before,'Dragging must rotate the rendered model'
    assert page.locator('.object-tools a,.object-tools button').count()==1
    page.screenshot(path=str(OUT/'site-hdd.png'))
    page.locator('#object-exit').click();page.wait_for_selector('#wiki-page:not([hidden])')
    page.locator('#wiki-hardware a[href="#object/mainboard"]').click();ready(page)
    page.keyboard.press('Escape');page.wait_for_selector('#wiki-page:not([hidden])')
    print('Collection: all 23, category filter, Korean search, selection, exit, Escape PASS',flush=True)
    for id in ['boot','game','search','storage']:
        page.evaluate('(id)=>location.hash="story/"+id+"/0"',id)
        page.wait_for_function('(id)=>location.hash==="#story/"+id+"/0" && document.body.dataset.mode==="story"',arg=id);ready(page)
        for step in range(6):
            page.wait_for_function('(n)=>document.querySelector("#story-count").textContent.startsWith(String(n).padStart(2,"0"))',arg=step+1)
            assert page.locator('#story-copy').inner_text()
            assert page.locator('#story-track button').count()==6
            if step==2:page.screenshot(path=str(OUT/f'site-story-{id}.png'))
            if step<5:page.locator('#story-track button').nth(step+1).click();page.wait_for_timeout(250)
        assert page.locator('#story-restart').is_visible()
        print(id+': all 6 scroll scenario stages PASS',flush=True)
    page.locator('#story-restart').click();page.wait_for_function('document.body.dataset.storyStep==="0"')
    print('Scenario replay PASS',flush=True)
    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(500)
    page.screenshot(path=str(OUT/'site-mobile-story.png'))
    assert page.evaluate('document.documentElement.scrollWidth===innerWidth')
    navigate(page,'object/power','POWER');page.wait_for_timeout(400)
    page.screenshot(path=str(OUT/'site-mobile-power.png'))
    page.locator('#object-exit').click();page.evaluate('location.hash="collection"');page.wait_for_selector('#collection-dialog[open]');page.locator('#search').fill('');page.wait_for_timeout(400)
    assert page.locator('#collection-grid li').count()==23
    assert page.locator('#collection-dialog').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
    page.screenshot(path=str(OUT/'site-mobile-collection.png'))
    page.locator('[data-tab="stories"]').click();assert page.locator('#story-grid li').count()==16
    page.screenshot(path=str(OUT/'site-mobile-stories.png'))
    print('Mobile: collection, stories, model viewer, no horizontal overflow PASS',flush=True)
    assert not errors,errors
    browser.close()
    browser=p.chromium.launch(executable_path=BROWSER,args=['--no-sandbox','--disable-webgl'])
    page=browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
    page.goto(BASE+'#object/hdd');page.wait_for_selector('body.failed');page.wait_for_selector('body:not(.loading)')
    assert page.locator('#object-exit').is_visible()
    assert page.locator('#fallback').evaluate('(e)=>e.complete && e.naturalWidth>0')
    page.locator('#object-exit').click();page.wait_for_selector('#wiki-page:not([hidden])')
    page.evaluate('location.hash="story/storage/0"');page.wait_for_function('document.body.dataset.mode==="story"');page.wait_for_timeout(400)
    page.locator('#story-track button').nth(1).click();page.wait_for_function('document.querySelector("#story-count").textContent.startsWith("02")')
    assert page.locator('#story-why').is_enabled()
    print('WebGL fallback: objects, images, scenario steps remain available PASS',flush=True)
    browser.close()
    print('Page exceptions: none',flush=True)
