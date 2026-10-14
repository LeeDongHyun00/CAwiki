"""Verify the deployed main site's #map route, not only the standalone study."""
from playwright.sync_api import sync_playwright
import os,json
URL=os.environ.get('CAWIKI_MAIN_URL','http://127.0.0.1:4174/index.html')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
 errors=[]
 page=b.new_page(viewport={'width':1440,'height':960},device_scale_factor=.75)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL+'#wiki');page.wait_for_selector('body[data-mode=wiki]');page.evaluate('scrollTo(0,200)');saved=page.evaluate('scrollY')
 page.locator('[data-wiki-tab=map]').evaluate('(e)=>e.focus({preventScroll:true})');page.keyboard.press('Enter')
 frame=page.frame_locator('#relationship-room-frame')
 frame.locator('body[data-mode=room]').wait_for(timeout=120000)
 assert page.url.endswith('#map') and frame.locator('.room-topic').count()==7
 assert frame.locator('.room-part:not([disabled])').count()==23
 frame.locator('.room-topic[data-group=compute]').focus();page.keyboard.press('Enter');frame.locator('#room[data-group=compute][data-moving=false]').wait_for(timeout=90000)
 page.wait_for_url('**#map/group/compute')
 frame.locator('[data-hardware=cpu]').click();frame.locator('body.detail-ready').wait_for();assert '#map/node/cpu' in page.url
 frame.locator('[data-tab=relations]').click();frame.locator('[data-peer=gpu]').click();frame.locator('body.detail-ready').wait_for()
 assert frame.locator('#detail-title').inner_text()=='CPU' and 'edge=cpu--gpu' in page.url
 frame.locator('#room-close').click();frame.locator('#room[data-moving=false]').wait_for()
 frame.locator('body').evaluate("e=>{parent.__roomStates=[];new MutationObserver(()=>parent.__roomStates.push(e.dataset.mode)).observe(e,{attributes:true,attributeFilter:['data-mode']})}")
 frame.locator('.room-exit').click()
 page.locator('#relationship-room-frame').wait_for(state='detached',timeout=90000)
 assert 'exiting-room' in page.evaluate('__roomStates')
 assert page.url.endswith('#wiki') and page.evaluate('scrollY')==saved
 assert not page.locator('#wiki-page').evaluate('(e)=>e.inert')
 page.locator('#wiki-hardware a[href="#object/cpu"]').click();page.locator('body[data-mode=object]:not(.loading)').wait_for(timeout=90000)
 page.locator('#object-exit').click();page.wait_for_url('**#wiki');page.locator('body[data-mode=wiki]').wait_for()
 page.evaluate("location.hash='story/boot/0'");page.locator('body[data-mode=story]:not(.loading)').wait_for(timeout=120000)
 page.evaluate("location.hash='map/group/storage'");frame=page.frame_locator('#relationship-room-frame');frame.locator('#room[data-group=storage][data-moving=false]').wait_for(timeout=120000)
 frame.locator('.room-exit').click();page.locator('#relationship-room-frame').wait_for(state='detached',timeout=90000)
 page.evaluate("location.hash='home'");page.locator('body[data-mode=home]').wait_for()
 page.close();print('Main Wiki → map / public deep links / CPU-GPU relationship / animated return and scroll / hardware / story / film PASS',flush=True)
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL+'#wiki');page.locator('[data-wiki-tab=map]').tap();frame=page.frame_locator('#relationship-room-frame');frame.locator('body[data-mode=room]').wait_for(timeout=120000)
 c=page.context.new_cdp_session(page)
 def touch(type,x=0,y=0):c.send('Input.dispatchTouchEvent',{'type':type,'touchPoints':[] if type=='touchEnd' else [{'x':x,'y':y,'id':1}]})
 r=frame.locator('.room-topic[data-group=all]').bounding_box();x=r['x']+r['width']/2;y=r['y']+r['height']/2
 touch('touchStart',x,y)
 for dx in range(15,151,15):touch('touchMove',x-dx,y);page.wait_for_timeout(25)
 touch('touchEnd');page.wait_for_timeout(600)
 assert frame.locator('#room').get_attribute('data-group')=='all'
 r2=frame.locator('.room-topic[data-group=all]').bounding_box();assert abs(r2['x']+r2['width']/2-x)>50
 frame.locator('.room-topic[data-group=compute]').tap();frame.locator('#room[data-group=compute][data-moving=false]').wait_for(timeout=90000)
 child=page.locator('#relationship-room-frame').element_handle().content_frame()
 child.wait_for_function('()=>{const r=document.querySelector(".room-topic[data-group=compute]").getBoundingClientRect();return Math.abs(r.x+r.width/2-innerWidth/2)<1}',timeout=90000)
 assert page.url.endswith('#map/group/compute')
 frame.locator('body').evaluate("e=>{parent.__roomStates=[];new MutationObserver(()=>parent.__roomStates.push(e.dataset.mode)).observe(e,{attributes:true,attributeFilter:['data-mode']})}")
 frame.locator('.room-exit').tap();page.locator('#relationship-room-frame').wait_for(state='detached',timeout=90000)
 assert page.url.endswith('#wiki') and 'exiting-room' in page.evaluate('__roomStates');assert not errors,errors
 b.close();print(json.dumps({'mainRoute':True,'animatedReturn':True,'deepLinks':True,'mobileNativeTouch':True,'existingExperiences':True,'errors':errors}),flush=True)
