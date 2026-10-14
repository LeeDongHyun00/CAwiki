"""Exercise the actual scroll film, monitor reveal and Wiki handoff in Chromium.
Run serve.py 4173 first. Requires Playwright and Pillow.
"""
from pathlib import Path
from io import BytesIO
import os
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/motherboard-film'
BASE=os.environ.get('CAWIKI_TEST_URL','http://127.0.0.1:4173/')
BROWSER=os.environ.get('CAWIKI_CHROMIUM','/usr/bin/chromium')
# Public story beats; tests exercise real scroll input, not a test renderer.
CHAPTERS=[('cpu',0,.125),('gpu',.125,.245),('dram',.245,.31),('ssd',.31,.375),
 ('hdd',.375,.44),('cooling',.44,.51),('power',.51,.575),('vrm',.575,.63),
 ('coproc',.63,.685),('spirom',.685,.735),('nic',.735,.795),('io',.795,.835)]
OUT.mkdir(exist_ok=True)

def seek(page,value,settle=True):
    page.evaluate('(p)=>scrollTo({top:p*(document.querySelector("#sequence").offsetHeight-innerHeight),behavior:"instant"})',value)
    if settle:
        page.wait_for_function('(p)=>Math.abs(Number(document.body.dataset.filmProgress)-p)<.00015',arg=value,timeout=45000)
    page.wait_for_timeout(180)

def difference(a,b):
    a=Image.open(BytesIO(a)).convert('RGB');b=Image.open(BytesIO(b)).convert('RGB')
    return sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=BROWSER,args=['--no-sandbox','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1200,'height':800},device_scale_factor=1)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE);page.wait_for_selector('body.ready',timeout=120000)
    assert page.locator('#sequence section').count()==14
    assert page.locator('header,nav,.filmstrip').count()==0
    ram_image=None
    for id,start,end in ([] if os.environ.get('CAWIKI_FILM_FROM')=='ending' else CHAPTERS):
        seek(page,start+(end-start)*.2);before=page.screenshot()
        seek(page,start+(end-start)*.57);after=page.screenshot(path=str(OUT/(id+'.png')))
        assert page.locator('body').get_attribute('data-chapter')==id
        assert difference(before,after)>1.0,(id,'assembly did not visibly animate')
        if id=='dram':ram_image=after
        print(id+': scroll-driven assembly / exploded view PASS',flush=True)
    if ram_image:
        seek(page,.245+(.31-.245)*.57)
        assert difference(ram_image,page.screenshot())<1.0,'Reverse scroll must reproduce the same model'
        print('Reverse scroll: deterministic model and camera PASS',flush=True)
    seek(page,.88);page.screenshot(path=str(OUT/'board-exploded.png'))
    seek(page,.9398);page.screenshot(path=str(OUT/'system.png'))
    before=page.screenshot()
    seek(page,.9402);after=page.screenshot()
    assert difference(before,after)<3.0,('Render-to-texture reveal must begin without a cut',difference(before,after))
    print('Monitor reveal: live 3D content, continuous first frame PASS',flush=True)
    frames=[]
    for value in [.95,.97,1.0]:
        seek(page,value);frames.append(page.screenshot(path=str(OUT/f'reveal-{value}.png')))
    assert difference(frames[0],frames[1])>2 and difference(frames[1],frames[2])>2
    page.screenshot(path=str(OUT/'screen.png'))
    assert page.locator('.wiki-enter').is_visible()
    seek(page,.93);assert page.locator('#ending').is_hidden()
    seek(page,1);page.locator('.wiki-enter').click();page.wait_for_selector('#wiki-page:not([hidden])')
    assert page.locator('#wiki-title').inner_text()=='Computer Wiki.'
    assert page.locator('#wiki-hardware li').count()==23
    page.screenshot(path=str(OUT/'wiki.png'))
    page.locator('[data-wiki-tab="stories"]').click();assert page.locator('#wiki-stories li').count()==4
    page.locator('[data-wiki-tab="hardware"]').click();page.locator('#wiki-hardware a[href="#object/dram"]').click()
    page.wait_for_selector('body[data-mode="object"]:not(.loading)');page.go_back();page.wait_for_selector('body[data-mode="wiki"]')
    page.set_viewport_size({'width':1250,'height':820});page.wait_for_timeout(300)
    page.locator('.wiki-top a').click();page.wait_for_selector('body[data-mode="home"]');seek(page,0)
    # Native mouse wheel and pointer drag both scrub the film.
    page.mouse.move(650,420);page.mouse.wheel(0,900);page.wait_for_function('scrollY>800')
    old_scroll=page.evaluate('scrollY');page.mouse.down();page.mouse.move(650,180,steps=8);page.mouse.up()
    page.wait_for_function('(s)=>scrollY>s+300',arg=old_scroll)
    assert not errors,errors
    print('Ending ↔ Wiki ↔ object / replay / wheel / drag PASS',flush=True)
    browser.close()

    browser=p.chromium.launch(executable_path=BROWSER,args=['--no-sandbox','--enable-unsafe-swiftshader'])
    context=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True,reduced_motion='reduce')
    page=context.new_page();errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url))
    portable='http://127.0.0.1:4173/artifacts/inside-site.html'
    page.goto(portable);page.wait_for_selector('body.ready',timeout=120000);context.set_offline(True)
    for id,start,end in CHAPTERS:
        seek(page,start+(end-start)*.57)
        assert page.locator('body').get_attribute('data-chapter')==id
        assert page.evaluate('document.documentElement.scrollWidth==innerWidth')
        if id in ['dram','cooling']:page.screenshot(path=str(OUT/('mobile-'+id+'.png')))
    seek(page,.93);page.screenshot(path=str(OUT/'mobile-system.png'))
    seek(page,1);page.screenshot(path=str(OUT/'mobile-screen.png'))
    page.locator('.wiki-enter').tap();page.wait_for_selector('#wiki-page:not([hidden])')
    assert page.locator('#wiki-hardware li').count()==23
    page.screenshot(path=str(OUT/'mobile-wiki.png'))
    assert all(r==portable or r.startswith(('blob:','data:')) for r in requests),requests
    assert not errors,errors
    print('Mobile portrait: all film chapters, final handoff, offline portable HTML PASS',flush=True)
    browser.close()

    browser=p.chromium.launch(executable_path=BROWSER,args=['--no-sandbox','--disable-webgl'])
    page=browser.new_page(viewport={'width':390,'height':844})
    page.goto(BASE);page.wait_for_selector('body.failed');seek(page,1)
    assert page.locator('#fallback').evaluate('(e)=>e.complete&&e.naturalWidth>0')
    page.locator('.wiki-enter').click();page.wait_for_selector('#wiki-page:not([hidden])')
    assert page.locator('#wiki-hardware li').count()==23
    print('No WebGL: fallback film images and Wiki handoff PASS',flush=True)
    browser.close()
