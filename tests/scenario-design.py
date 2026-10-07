"""Review prototype: real scroll / drag, six stages, reverse and offline playback."""
from pathlib import Path
from io import BytesIO
import os
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright
OUT=Path(__file__).resolve().parents[1]/'artifacts/scenario-design'
OUT.mkdir(exist_ok=True)
BASE=os.environ.get('CAWIKI_SCENARIO_URL','http://127.0.0.1:4173/artifacts/scenario-design.html')
def seek(page,p):
 page.evaluate('(p)=>scrollTo({top:p*(document.querySelector("#journey").offsetHeight-innerHeight),behavior:"instant"})',p)
 page.wait_for_function('(p)=>Math.abs(Number(document.body.dataset.progress)-p)<.00015',arg=p,timeout=45000)
 page.wait_for_timeout(180)
def diff(a,b):
 return sum(ImageStat.Stat(ImageChops.difference(Image.open(BytesIO(a)).convert('RGB'),Image.open(BytesIO(b)).convert('RGB'))).mean)/3
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
 context=b.new_context(viewport={'width':1440,'height':900});page=context.new_page();errors=[];requests=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
 page.goto(BASE);page.wait_for_selector('body.ready',timeout=120000);context.set_offline(True)
 assert page.locator('#track button').count()==6
 stages=[(0,'input'),(.2,'cpu'),(.4,'memory'),(.59,'command'),(.78,'gpu'),(1,'display')]
 saved=None
 for i,(progress,name) in enumerate(stages):
  seek(page,progress);assert page.locator('body').get_attribute('data-step')==str(i)
  shot=page.screenshot(path=str(OUT/(name+'.png')))
  if name=='memory':saved=shot
  assert page.locator('#story-copy').inner_text()
  print(name+': visible stage and scroll state PASS',flush=True)
 assert page.locator('#restart').is_visible();assert page.locator('#story-title').inner_text()=='변화가 눈에 닿다'
 seek(page,.4);assert diff(saved,page.screenshot())<1,'Reverse scroll must recreate the same pose'
 page.locator('#why').click();assert page.locator('#detail').is_visible();old=page.locator('body').get_attribute('data-progress');page.mouse.wheel(0,500);page.wait_for_timeout(150);assert page.locator('body').get_attribute('data-progress')==old
 page.keyboard.press('Escape');page.wait_for_selector('#detail',state='hidden');assert page.locator('#why').evaluate('(e)=>e===document.activeElement')
 seek(page,0);page.mouse.move(1050,410);page.mouse.wheel(0,450);page.wait_for_function('scrollY>400')
 old=page.evaluate('scrollY');page.mouse.down();page.mouse.move(1050,200,steps=10);page.mouse.up();page.wait_for_function('(s)=>scrollY>s+300',arg=old)
 print('Reverse, explanation dialog, wheel and actual mouse drag PASS',flush=True)
 page.set_viewport_size({'width':390,'height':844})
 for progress,name in [(0,'input'),(.4,'memory'),(1,'display')]:
  seek(page,progress);page.screenshot(path=str(OUT/('mobile-'+name+'.png')));assert page.evaluate('document.documentElement.scrollWidth===innerWidth')
 for item in page.locator('#track button').all():
  box=item.bounding_box();assert box['width']>=44 and box['height']>=44
 page.emulate_media(reduced_motion='reduce');page.locator('#track button').nth(2).click();page.wait_for_function('document.body.dataset.step==="2"');assert page.locator('#story-title').inner_text()=='다음 상태를 계산하다'
 page.locator('#track button').last.click();page.wait_for_function('document.body.dataset.step==="5"')
 assert not errors,errors
 assert all(r==BASE or r.startswith(('data:','blob:')) for r in requests),requests
 print('Mobile layout, 44px stage targets, reduced motion, self-contained offline preview PASS',flush=True)
 b.close()
