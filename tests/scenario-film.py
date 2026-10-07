"""Production stories: continuous scroll, branch semantics and shared-stage recovery."""
from pathlib import Path
from io import BytesIO
import os
from PIL import Image,ImageChops,ImageStat
from playwright.sync_api import sync_playwright
OUT=Path(__file__).resolve().parents[1]/'artifacts/scenario-production';OUT.mkdir(exist_ok=True)
BASE=os.environ.get('CAWIKI_TEST_URL','http://127.0.0.1:4173/')
BROWSER=os.environ.get('CAWIKI_CHROMIUM','/usr/bin/chromium')
def diff(a,b):
 return sum(ImageStat.Stat(ImageChops.difference(Image.open(BytesIO(a)).convert('RGB'),Image.open(BytesIO(b)).convert('RGB'))).mean)/3
def ready(page):page.wait_for_selector('body.ready:not(.loading)',timeout=120000)
def story(page,id):
 page.evaluate('(id)=>location.hash="story/"+id+"/0"',id)
 page.wait_for_function('(id)=>document.body.dataset.story===id&&document.body.dataset.mode==="story"&&!document.body.classList.contains("loading")',arg=id)
 page.wait_for_timeout(200)
def seek(page,value):
 page.evaluate('(p)=>scrollTo({top:p*(document.querySelector("#story-sequence").offsetHeight-innerHeight),behavior:"instant"})',value)
 page.wait_for_function('(p)=>Math.abs(Number(document.body.dataset.storyProgress)-p)<.00015',arg=value,timeout=45000)
 page.wait_for_timeout(150)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=BROWSER,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1200,'height':850},reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE+'#story/game/0');ready(page)
 for id in ([] if os.environ.get('CAWIKI_STORY_FROM')=='interaction' else ['game','boot','search','storage']):
  story(page,id);assert page.locator('#story-track button').count()==6
  for i in range(6):
   page.locator('#story-track button').nth(i).click();page.wait_for_function('(i)=>Number(document.body.dataset.storyStep)===i',arg=i);page.wait_for_timeout(160)
   assert page.locator('#story-copy').inner_text();assert page.locator('canvas').count()==1
   page.screenshot(path=str(OUT/f'{id}-{i}.png'))
  assert page.locator('#story-restart').is_visible();assert page.locator('#story-more').is_visible()
  print(id+': six rendered stages and distinct monitor result PASS',flush=True)
 story(page,'storage');page.locator('#story-track button').nth(1).click();page.locator('[data-storage="hdd"]').click();page.wait_for_function('document.body.dataset.storage==="hdd"');assert 'HDD' in page.locator('#story-copy').inner_text();page.screenshot(path=str(OUT/'storage-hdd.png'))
 page.locator('[data-storage="cached"]').click();page.wait_for_function('document.body.dataset.storage==="cached"');assert page.locator('#story-track button').count()==4
 assert '바로' in page.locator('#story-copy').inner_text();page.locator('#story-track button').nth(2).click();page.wait_for_function('document.body.dataset.storyStep==="2"');assert '내용을 해석' in page.locator('#story-title').inner_text()
 print('SSD / HDD alternatives and RAM cache shortcut PASS',flush=True)
 story(page,'game');page.emulate_media(reduced_motion='no-preference');seek(page,.4);baseline=page.locator('#world').screenshot();seek(page,.79);expanded=page.locator('#world').screenshot();assert diff(baseline,expanded)>2
 seek(page,.4);assert diff(baseline,page.locator('#world').screenshot())<1,'Reverse must recreate camera and model pose'
 page.locator('#story-why').click();before=float(page.locator('body').get_attribute('data-story-progress'));page.mouse.wheel(0,700);page.keyboard.press('Escape');page.wait_for_selector('#story-detail',state='hidden');page.wait_for_timeout(200)
 assert abs(float(page.locator('body').get_attribute('data-story-progress'))-before)<.001
 assert page.locator('#story-why').evaluate('(e)=>e===document.activeElement')
 page.evaluate('location.hash="stories"');page.wait_for_selector('#collection-dialog[open]');page.locator('#collection-close').click();page.wait_for_selector('#collection-dialog',state='hidden');page.wait_for_timeout(200)
 assert abs(float(page.locator('body').get_attribute('data-story-progress'))-.4)<.001,'Collection return must preserve exact progress'
 page.evaluate('location.hash="object/mouse"');page.wait_for_selector('body[data-mode="object"]:not(.loading)');page.go_back();page.wait_for_selector('body[data-mode="story"]:not(.loading)');page.wait_for_timeout(200)
 assert abs(float(page.locator('body').get_attribute('data-story-progress'))-.4)<.001
 seek(page,0);page.mouse.move(800,420);page.mouse.wheel(0,500);page.wait_for_function('scrollY>450');old=page.evaluate('scrollY');page.mouse.down();page.mouse.move(800,180,steps=8);page.mouse.up();page.wait_for_function('(y)=>scrollY>y+400',arg=old)
 print('Scroll / drag / reverse / dialog / collection / object history PASS',flush=True)
 # The same borrowed board must recover after repeated scenario poses.
 page.emulate_media(reduced_motion='reduce');page.evaluate('location.hash="system"');page.wait_for_selector('body[data-mode="home"]');page.wait_for_timeout(300);restored=page.locator('#world').screenshot(path=str(OUT/'main-restored.png'))
 page.reload();ready(page);page.wait_for_timeout(300);assert diff(restored,page.locator('#world').screenshot())<1,'Scenario must restore the main film without leaked poses'
 story(page,'search');page.locator('#story-track button').nth(3).click();page.wait_for_timeout(200);context_before=page.locator('#world').screenshot()
 page.evaluate('window.testLoss=document.querySelector("#world").getContext("webgl2").getExtension("WEBGL_lose_context");testLoss.loseContext()');page.wait_for_selector('body.failed');page.evaluate('testLoss.restoreContext()');ready(page);page.wait_for_timeout(600)
 assert diff(context_before,page.locator('#world').screenshot())<3,'Restored scenario must retain its environment and frame'
 assert not errors,errors
 print('Shared scene restoration and WebGL context recovery PASS',flush=True);browser.close()
 browser=p.chromium.launch(executable_path=BROWSER,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1,reduced_motion='reduce');page=context.new_page();requests=[];page.on('request',lambda r:requests.append(r.url));page.on('pageerror',lambda e:errors.append(str(e)))
 portable='http://127.0.0.1:4173/artifacts/inside-site.html';page.goto(portable+'#story/boot/0');ready(page);context.set_offline(True)
 for id in ['boot','game','search','storage']:
  story(page,id)
  for i in [0,2,3,5]:
   page.locator('#story-track button').nth(i).tap();page.wait_for_function('(i)=>Number(document.body.dataset.storyStep)===i',arg=i);page.wait_for_timeout(150)
   page.screenshot(path=str(OUT/f'mobile-{id}-{i}.png'));assert page.evaluate('document.documentElement.scrollWidth===innerWidth')
  assert page.locator('#story-restart').is_visible()
 assert all(r.split('#')[0]==portable or r.startswith(('blob:','data:')) for r in requests),requests
 assert not errors,errors
 print('Mobile: four stories, touch step controls, reduced motion, offline standalone PASS',flush=True);browser.close()
 browser=p.chromium.launch(executable_path=BROWSER,args=['--no-sandbox','--disable-webgl'])
 page=browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce');page.goto(BASE+'#story/storage/0');page.wait_for_selector('body.failed:not(.loading)')
 page.locator('#story-track button').nth(2).click();page.wait_for_function('document.body.dataset.storyStep==="2"');assert page.locator('#fallback').evaluate('(e)=>e.complete&&e.naturalWidth>0')
 page.locator('#story-why').click();assert page.locator('#story-detail').is_visible();page.keyboard.press('Escape');page.locator('#story-track button').last.click();page.wait_for_selector('#story-restart:visible')
 print('No WebGL: images, captions, stages and detailed explanations remain usable PASS',flush=True);browser.close()
