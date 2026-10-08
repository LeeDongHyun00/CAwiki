"""Spatial design: list continuity, five walls, staged filtering, orbital rail,
non-navigating relationship pairs, complete parts access, mobile and fallback.
Timeline probes are injected into the source response only, never production.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/relationship-room-study';OUT.mkdir(exist_ok=True)
URL=os.environ.get('CAWIKI_ROOM_URL','http://127.0.0.1:4173/design/redesign/relationship-room-study.html')
PORTABLE=':4174' in URL
source=(ROOT/'design/redesign/relationship-room-study.js').read_text().replace('function tick(now){',"function tick(now){if(window.__pauseEntry&&view==='entering'){frame=0;return;}")+'''
window.__roomDebug={snapshot:()=>({view,active,detail,edge:selectedEdge?.id,phase:room.dataset.phase,camera:camera&&{x:camera.position.x,z:camera.position.z,fov:camera.fov,rotation:camera.rotation.toArray()},rail,items:items.map(i=>({id:i.id,pose:{...i.pose},home:{...i.home}}))}),at:ms=>{window.__pauseEntry=false;cancelAnimationFrame(frame);frame=0;transitionAt=performance.now()-ms;moving=true;tick(performance.now());cancelAnimationFrame(frame);frame=0;},resume:()=>wake()};
'''
def settled(page):page.wait_for_selector('#room[data-moving=false]',timeout=90000)
def count(page,n):
 settled(page)
 assert page.locator('.room-part:not([disabled])').count()==n

def choose(page,id):
 page.locator('.room-topic[data-group='+id+']').focus();page.keyboard.press('Enter');settled(page)

with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':960},device_scale_factor=.75);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 if not PORTABLE:page.route('**/relationship-room-study.js',lambda r:r.fulfill(body=source,content_type='text/javascript'))
 page.goto(URL+'#wiki');page.wait_for_selector('#room[data-ready=true]',state='attached',timeout=90000)
 assert page.locator('#wiki-hardware li').count()==23 and page.locator('#room').is_hidden()
 page.screenshot(path=str(OUT/'wiki-start.png'))
 # Opening from Stories paints the unchanged hardware list before the room.
 page.locator('[data-wiki-tab=stories]').click();assert page.locator('#wiki-stories').is_visible()
 if not PORTABLE:page.evaluate('window.__pauseEntry=true')
 page.locator('[data-wiki-tab=map]').click();page.wait_for_selector('body[data-mode=entering-room]')
 assert page.locator('#wiki-hardware').evaluate('(e)=>!e.hidden') and page.locator('#wiki-stories').is_hidden()
 if not PORTABLE:
  samples=[]
  for elapsed in [180,900,1750]:
   page.evaluate('ms=>__roomDebug.at(ms)',elapsed);state=page.evaluate('__roomDebug.snapshot()');samples.append(state['camera']);page.screenshot(path=str(OUT/('entry-'+str(elapsed)+'.png')))
  assert samples[0]['x']<samples[1]['x']<samples[2]['x']<0
  assert samples[0]['fov']<samples[1]['fov']<samples[2]['fov']
  page.evaluate('__roomDebug.at(2250);__roomDebug.resume()')
 page.wait_for_selector('body[data-mode=room]');count(page,23)
 assert page.locator('.room-topic').count()==7
 assert set(page.locator('.room-part').evaluate_all('(els)=>els.map(e=>e.dataset.wall)'))=={'back','left','right','ceiling','floor'}
 page.mouse.move(720,930);page.wait_for_timeout(500);page.screenshot(path=str(OUT/'all.png'))
 if not PORTABLE:
  initial=page.evaluate('__roomDebug.snapshot()')
  page.locator('.room-topic[data-group=compute]').focus();page.keyboard.press('Enter')
  page.evaluate('__roomDebug.at(300)');early=page.evaluate('__roomDebug.snapshot()')
  for item in early['items']:
   if item['id'] in ['cpu','sram','dram','npu','coproc']:
    assert all(abs(item['pose'][k]-item['home'][k])<.001 for k in ['x','y','z']),item
   else:assert item['pose']['opacity']<.2,item
  page.evaluate('__roomDebug.at(1500);__roomDebug.resume()')
 else:choose(page,'compute')
 count(page,5);page.screenshot(path=str(OUT/'compute.png'))
 page.locator('[data-hardware=cpu]').click();page.wait_for_selector('body.detail-ready');page.wait_for_timeout(450)
 page.screenshot(path=str(OUT/'detail.png'))
 page.locator('[data-tab=parts]').click();settled(page)
 assert page.locator('.parts-select button').count()<=4
 assert page.locator('#room-detail article').evaluate('(e)=>getComputedStyle(e).scrollbarWidth')=='none'
 total=page.locator('#detail-copy select option').count();page.locator('#detail-copy select').select_option(str(total-1))
 assert page.locator('#detail-copy select').input_value()==str(total-1)
 page.locator('#detail-copy select').select_option('0');page.screenshot(path=str(OUT/'parts.png'))
 page.locator('[data-tab=relations]').click();settled(page)
 for peer in ['sram','dram','gpu']:
  link=page.locator('.detail-peer[data-peer='+peer+']');edge=link.get_attribute('data-edge');link.click();page.wait_for_selector('body.detail-ready');page.wait_for_timeout(450)
  assert page.locator('#detail-title').inner_text()=='CPU'
  assert '#node/cpu?' in page.url and 'edge='+edge in page.url
  assert page.locator('.relation-pair-copy dd').count()==2
  assert page.locator('#pair-labels span').first.inner_text()=='CPU'
  assert page.locator('#room-connection').evaluate('(e)=>Number(getComputedStyle(e).opacity)')>.9
  if not PORTABLE:
   shown=[i['id'] for i in page.evaluate('__roomDebug.snapshot()')['items'] if i['pose']['opacity']>.99]
   assert set(shown)=={'cpu',peer},shown
  page.screenshot(path=str(OUT/('pair-'+peer+'.png')))
  page.locator('.relation-reset').click();settled(page)
 page.locator('#room-close').click();count(page,5)
 assert page.evaluate('document.activeElement.dataset.hardware')=='cpu'
 # A real ellipse: controls change height and scale, travel around the back,
 # and dragging alone never commits the topic or duplicates controls.
 positions=[]
 for _ in range(3):
  page.mouse.move(1030,870);page.mouse.down();page.mouse.move(420,870,steps=14);page.mouse.up();page.wait_for_timeout(500)
  positions.append(page.locator('.room-topic[data-group=all]').evaluate('(e)=>e.getBoundingClientRect().toJSON()'))
  assert page.locator('#room').get_attribute('data-group')=='compute'
 assert len({round(x['y']) for x in positions})>1 and len({round(x['width']) for x in positions})>1
 if not PORTABLE:
  page.locator('.room-topic[data-group=all]').focus();page.keyboard.press('Enter');page.evaluate('__roomDebug.at(1050)');ret=page.evaluate('__roomDebug.snapshot()')
  for item in ret['items']:
   if item['id'] not in ['cpu','sram','dram','npu','coproc']:assert item['pose']['opacity']<.01,item
  page.evaluate('__roomDebug.at(1600);__roomDebug.resume()');count(page,23)
  final=page.evaluate('__roomDebug.snapshot()')
  for item in final['items']:assert all(abs(item['pose'][k]-item['home'][k])<1e-8 for k in ['x','y','z','rx','ry','rz','size']),item
 else:choose(page,'all');count(page,23)
 print('Wiki → rightward camera / 5 surfaces / 7-topic orbit / staged gather and exact return / pairs retain CPU / all parts accessible PASS',flush=True)
 for id,n in [('graphics',5),('storage',6),('io',7),('network',6),('power',6)]:
  choose(page,id);count(page,n);page.screenshot(path=str(OUT/(id+'.png')))
 # Rapid replacement of a selection starts from the current frame.
 page.locator('.room-topic[data-group=compute]').focus();page.keyboard.press('Enter');page.locator('.room-topic[data-group=io]').focus();page.keyboard.press('Enter');count(page,7)
 page.emulate_media(reduced_motion='reduce');choose(page,'all');count(page,23)
 page.locator('.room-exit').click();assert page.locator('#wiki-hardware').is_visible();page.locator('[data-wiki-tab=map]').click();page.wait_for_selector('body[data-mode=room]');count(page,23)
 assert not page.locator('body[data-mode=entering-room]').count();page.close()
 print('All groups / interruption / keyboard / reduced motion entry PASS',flush=True)
 mobile=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True);mobile.on('pageerror',lambda e:errors.append(str(e)))
 mobile.goto(URL+'#group/io');mobile.wait_for_selector('#room[data-ready=true]',timeout=90000);count(mobile,7)
 assert mobile.evaluate('document.documentElement.scrollWidth===innerWidth');mobile.screenshot(path=str(OUT/'mobile-io.png'))
 mobile.locator('[data-hardware=mouse]').tap();mobile.wait_for_selector('body.detail-ready');mobile.wait_for_timeout(450);mobile.screenshot(path=str(OUT/'mobile-detail.png'))
 mobile.locator('[data-tab=relations]').tap();settled(mobile);mobile.locator('.detail-peer').first.tap();mobile.wait_for_selector('body.detail-ready');mobile.wait_for_timeout(450);mobile.screenshot(path=str(OUT/'mobile-pair.png'))
 assert mobile.locator('#detail-title').inner_text()=='마우스'
 mobile.locator('#room-close').tap();count(mobile,7);choose(mobile,'all');count(mobile,23)
 mobile.locator('[data-hardware=audio]').focus();mobile.wait_for_timeout(600);box=mobile.locator('[data-hardware=audio]').bounding_box();assert box['x']<390 and box['x']+box['width']>0,box;mobile.screenshot(path=str(OUT/'mobile-wall.png'))
 mobile.locator('.room-exit').tap();mobile.locator('[data-wiki-tab=map]').tap();mobile.wait_for_selector('body[data-mode=entering-room]');mobile.set_viewport_size({'width':844,'height':390});mobile.wait_for_selector('body[data-mode=room]');count(mobile,23)
 assert not errors,errors;b.close();print('Mobile / paired explanation / wall pan-to-focus / entry resize PASS',flush=True)
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-webgl']);page=b.new_page(viewport={'width':1200,'height':800});page.on('pageerror',lambda e:errors.append(str(e)));page.goto(URL+'#all');page.wait_for_selector('#room[data-ready=fallback]');assert page.locator('.room-fallback button').count()==23
 choose(page,'compute');assert page.locator('.room-fallback button').count()==5;page.locator('.room-fallback [data-id=cpu]').click();page.locator('[data-tab=relations]').click();page.locator('.detail-peer').first.click();assert page.locator('.fallback-detail img').count()==2;assert page.locator('#detail-title').inner_text()=='CPU';page.locator('#room-close').click();assert page.locator('.room-fallback').is_visible()
 assert not errors,errors;b.close();print('WebGL fallback: full gallery + two-model relationships PASS',flush=True)
 (OUT/('verification-portable.json' if PORTABLE else 'verification-source.json')).write_text(json.dumps({'wikiEntry':True,'cameraMovesRight':not PORTABLE,'walls':5,'models':23,'menuTopics':7,'stagedFilter':not PORTABLE,'exactReturn':not PORTABLE,'pairWithoutNavigation':True,'partsPagination':True,'mobile':True,'keyboard':True,'reducedMotion':True,'fallback':True,'portable':PORTABLE,'errors':errors},indent=2)+'\n')
