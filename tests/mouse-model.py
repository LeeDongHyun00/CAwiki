"""Render the rebuilt mouse, animate its layers, orbit and revisit after disposal."""
from pathlib import Path
from io import BytesIO
import os
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright
OUT=Path(__file__).resolve().parents[1]/'artifacts/motherboard-refinement'
BASE=os.environ.get('CAWIKI_TEST_URL','http://127.0.0.1:4173/')
def diff(a,b):
    return sum(ImageStat.Stat(ImageChops.difference(Image.open(BytesIO(a)).convert('RGB'),Image.open(BytesIO(b)).convert('RGB'))).mean)/3
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CAWIKI_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader'])
    context=browser.new_context(viewport={'width':1200,'height':850},reduced_motion='reduce')
    page=context.new_page();errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
    page.goto(BASE+'#object/mouse');page.wait_for_selector('body.ready:not(.loading)',timeout=120000)
    if 'inside-site.html' in BASE:context.set_offline(True)
    for name in ['센서','PCB','클릭','휠']:
        assert name in page.locator('#object-structure').text_content()
    page.wait_for_timeout(300);assembled=page.locator('#world').screenshot();page.screenshot(path=str(OUT/'mouse.png'))
    page.locator('#explode').click();page.wait_for_timeout(350)
    expanded=page.locator('#world').screenshot();page.screenshot(path=str(OUT/'mouse-exploded.png'))
    assert diff(assembled,expanded)>3,'Separating the shell, buttons, wheel and PCB must visibly change the model'
    page.locator('#explode').click();page.wait_for_timeout(350)
    assert diff(assembled,page.locator('#world').screenshot())<1,'Reassembly must reproduce the original'
    page.locator('#world').focus();page.keyboard.press('a');page.keyboard.press('a');page.keyboard.press('a');page.wait_for_timeout(300)
    assert diff(assembled,page.locator('#world').screenshot())>1,'Orbit must reveal another side'
    page.screenshot(path=str(OUT/'mouse-side.png'))
    page.evaluate('location.hash="story/game/0"');page.wait_for_selector('body[data-mode="story"]:not(.loading)');page.wait_for_timeout(300)
    assert 'MOUSE' in page.locator('#story-tag').inner_text()
    page.evaluate('location.hash="object/mouse"');page.wait_for_selector('body[data-mode="object"]:not(.loading)');page.wait_for_timeout(300)
    assert diff(assembled,page.locator('#world').screenshot())<1,'Recreated geometry and materials must remain intact'
    page.evaluate('location.hash="graphics"');page.wait_for_function('document.body.dataset.chapter==="gpu"');page.wait_for_timeout(300)
    page.locator('#skip-film').click();page.wait_for_function('document.body.dataset.chapter==="system"')
    assert page.locator('#ending').is_hidden()
    page.set_viewport_size({'width':390,'height':844});page.evaluate('location.hash="graphics"');page.wait_for_function('document.body.dataset.chapter==="gpu"')
    page.locator('#skip-film').click();page.wait_for_function('document.body.dataset.chapter==="system"');assert page.locator('#ending').is_hidden()
    page.evaluate('location.hash="screen"');page.wait_for_function('document.body.dataset.chapter==="screen"');assert page.locator('.wiki-enter').is_visible()
    assert not errors,errors
    if 'inside-site.html' in BASE:assert all(r.split('#')[0]==BASE.split('#')[0] or r.startswith(('blob:','data:')) for r in requests),requests
    print('Mouse: assembled / separated / restored / orbit / scenario / recreated PASS',flush=True)
    print('Reduced motion: desktop + mobile skip before monitor, ending CTA PASS',flush=True)
    if 'inside-site.html' in BASE:print('Self-contained preview works offline; no external asset requests PASS',flush=True)
    browser.close()
