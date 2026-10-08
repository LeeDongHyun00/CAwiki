"""Design prototype: cyclic rail, filtering, detail return, mobile and fallback."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/relationship-room-study';OUT.mkdir(exist_ok=True)
URL=os.environ.get('CAWIKI_ROOM_URL','http://127.0.0.1:4173/design/redesign/relationship-room-study.html')
def settled(page):
 page.wait_for_selector('#room[data-moving=false]',timeout=90000)
def count(page,n):
 settled(page)
 assert page.locator('.room-part:not([disabled])').count()==n
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':960},device_scale_factor=.8);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL);page.wait_for_selector('#room[data-ready=true]',timeout=90000);count(page,23)
 page.screenshot(path=str(OUT/'all.png'))
 page.locator('.room-topic[data-group=compute]').click();count(page,5);page.screenshot(path=str(OUT/'compute.png'))
 page.locator('[data-hardware=cpu]').click();page.wait_for_selector('body.detail-ready',timeout=90000);page.wait_for_timeout(550)
 assert page.locator('#detail-title').inner_text()=='CPU';page.screenshot(path=str(OUT/'detail.png'))
 page.locator('[data-tab=parts]').click();assert page.locator('#detail-copy li').count()>1
 page.locator('[data-tab=relations]').click();assert page.locator('[data-peer]').count()>1
 page.locator('#room-close').click();count(page,5)
 assert page.evaluate('document.activeElement.dataset.hardware')=='cpu'
 # Drag titles around the seam twice: never commits a topic on release.
 for _ in range(3):
  page.mouse.move(1100,910);page.mouse.down();page.mouse.move(220,910,steps=15);page.mouse.up();page.wait_for_timeout(900)
  assert page.locator('#room').get_attribute('data-group')=='compute'
  assert page.locator('.room-topic').count()==6
 # Keyboard can always reach every original topic, without duplicated buttons.
 for id,n in [('graphics',5),('storage',6),('io',7),('network',6),('power',6)]:
  topic=page.locator('.room-topic[data-group='+id+']');topic.focus();page.keyboard.press('Enter');count(page,n)
  assert page.locator('#room-title').inner_text()==topic.inner_text()
  page.screenshot(path=str(OUT/(id+'.png')))
 page.keyboard.press('Escape');count(page,23)
 page.emulate_media(reduced_motion='reduce');page.locator('.room-topic[data-group=io]').focus();page.keyboard.press('Enter');count(page,7)
 page.locator('[data-hardware=mouse]').focus();page.keyboard.press('Enter');page.wait_for_selector('body.detail-ready')
 page.keyboard.press('Escape');count(page,7)
 print('23 models / all six filters / cyclic dragging without selection / detail tabs and return / keyboard / reduced motion PASS',flush=True)
 page.close()
 mobile=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True);mobile.on('pageerror',lambda e:errors.append(str(e)))
 mobile.goto(URL+'#group/io');mobile.wait_for_selector('#room[data-ready=true]',timeout=90000);count(mobile,7)
 assert mobile.evaluate('document.documentElement.scrollWidth===innerWidth')
 mobile.screenshot(path=str(OUT/'mobile-io.png'))
 mobile.locator('[data-hardware=mouse]').tap();mobile.wait_for_selector('body.detail-ready',timeout=90000);mobile.wait_for_timeout(550);mobile.screenshot(path=str(OUT/'mobile-detail.png'))
 mobile.locator('#room-close').tap();count(mobile,7);mobile.keyboard.press('Escape');count(mobile,23)
 mobile.locator('[data-hardware=audio]').focus();mobile.wait_for_timeout(1000)
 box=mobile.locator('[data-hardware=audio]').bounding_box();assert box['x']<390 and box['x']+box['width']>0,box
 mobile.screenshot(path=str(OUT/'mobile-wall.png'))
 assert not errors,errors
 print('Mobile topic / detail / pan-to-focus / no horizontal page overflow PASS',flush=True);b.close()
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-webgl']);page=b.new_page(viewport={'width':1200,'height':800});page.on('pageerror',lambda e:errors.append(str(e)));page.goto(URL);page.wait_for_selector('#room[data-ready=fallback]');assert page.locator('.room-fallback button').count()==23
 page.locator('.room-topic[data-group=compute]').click();assert page.locator('.room-fallback button').count()==5
 page.locator('.room-fallback [data-id=cpu]').click();assert page.locator('#detail-title').inner_text()=='CPU';page.locator('#room-close').click();assert page.locator('.room-fallback').is_visible()
 assert not errors,errors
 print('WebGL fallback retains filtering and explanation PASS',flush=True)
 (OUT/'verification.json').write_text(json.dumps({'allModels':23,'groups':6,'cyclicDrag':True,'detailReturn':True,'mobile':True,'keyboard':True,'reducedMotion':True,'fallback':True,'errors':errors},indent=2)+'\n')
 b.close()
