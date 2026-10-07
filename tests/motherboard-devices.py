"""Monitor projection, context recovery and actual touch input checks.
Run serve.py 4173 first; requires Playwright, Pillow and Chromium.
"""
from pathlib import Path
import os
from io import BytesIO
from PIL import Image,ImageChops,ImageStat
from playwright.sync_api import sync_playwright
out=Path(__file__).resolve().parents[1]/'artifacts/motherboard-film'
out.mkdir(exist_ok=True)
BASE=os.environ.get('CAWIKI_TEST_URL','http://127.0.0.1:4173/')
BROWSER=os.environ.get('CAWIKI_CHROMIUM','/usr/bin/chromium')
def diff(a,b):
 return sum(ImageStat.Stat(ImageChops.difference(Image.open(BytesIO(a)).convert('RGB'),Image.open(BytesIO(b)).convert('RGB'))).mean)/3
def seek(page,p):
 page.evaluate('(p)=>scrollTo(0,p*(document.querySelector("#sequence").offsetHeight-innerHeight))',p)
 page.wait_for_function('(p)=>Math.abs(Number(document.body.dataset.filmProgress)-p)<.00015',arg=p,timeout=45000)
 page.wait_for_timeout(250)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=BROWSER,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1400,'height':550});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE+'#system');page.wait_for_selector('body.ready',timeout=120000)
 seek(page,.9398);before=page.screenshot();seek(page,.9402);after=page.screenshot()
 delta=diff(before,after);assert delta<3,delta;print('Ultrawide continuous reveal:',round(delta,3),'pixel mean delta PASS',flush=True)
 seek(page,1);page.set_viewport_size({'width':1000,'height':760});page.wait_for_timeout(500)
 seek(page,1);resized=page.screenshot(path=str(out/'ending-resize.png'))
 page.evaluate('window.testContextLoss=document.querySelector("#world").getContext("webgl2").getExtension("WEBGL_lose_context");testContextLoss.loseContext()')
 page.wait_for_selector('body.failed');page.wait_for_timeout(250);page.evaluate('testContextLoss.restoreContext()');page.wait_for_selector('body.ready:not(.failed)',timeout=60000);page.wait_for_timeout(500)
 assert page.locator('.wiki-enter').is_visible();assert not errors,errors
 restored=page.screenshot(path=str(out/'ending-restored.png'));assert diff(resized,restored)<3,'Restored monitor should reproduce its 3D content';print('Monitor resize and WebGL context recovery PASS',flush=True)
 b.close()
 b=p.chromium.launch(executable_path=BROWSER,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
 page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE+'#system');page.wait_for_selector('body.ready',timeout=120000);seek(page,.98)
 cdp=ctx.new_cdp_session(page)
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':185,'y':570}]})
 for y in range(540,149,-30):
  cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':185,'y':y}]});page.wait_for_timeout(25)
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 page.wait_for_function('Number(document.body.dataset.filmProgress)>.996',timeout=45000)
 page.locator('.wiki-enter').tap();page.wait_for_selector('body[data-mode="wiki"]');assert not errors,errors
 print('Mobile: actual touch scroll into ending and tap to Wiki PASS',flush=True)
 b.close()
