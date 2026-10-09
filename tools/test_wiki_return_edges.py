#!/usr/bin/env python3
"""Direct route, slow destination image, fallback, resize and preparation timer."""
import functools,json,threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/index.html';checks=[];errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 for case in ['direct','slow-image','fallback','reduced-motion','resize']:
  page=browser.new_page(viewport={'width':1440,'height':900});page.on('pageerror',lambda e:errors.append(str(e)));held=[]
  if case=='slow-image':page.route('**/redesign/cpu.webp*',lambda r:held.append(r))
  if case=='reduced-motion':page.emulate_media(reduced_motion='reduce')
  page.goto(url+('?quality=still#map' if case=='fallback' else '#map'),wait_until='domcontentloaded')
  page.wait_for_selector('#relationship-room-frame');frame=page.frames[-1]
  frame.wait_for_function("document.body.dataset.mode==='room'&&document.querySelector('#room').dataset.moving==='false'",timeout=30000)
  assert frame.locator('#wiki-hardware img').count()==0
  if case=='resize':
   page.set_viewport_size({'width':1000,'height':700});frame.wait_for_function("document.querySelector('#room').dataset.moving==='false'")
  frame.locator('.room-exit').click();page.wait_for_selector('#relationship-room-frame',state='detached',timeout=15000)
  page.wait_for_function("location.hash==='#wiki'")
  state=page.evaluate("""()=>{const wiki=document.querySelector('#wiki-page'),img=wiki.querySelector('img');return{locked:wiki.classList.contains('room-list-locked'),busy:wiki.hasAttribute('aria-busy'),inert:wiki.inert,headingOpacity:getComputedStyle(wiki.querySelector('.wiki-heading')).opacity,ready:img.complete&&img.naturalWidth>0,usesDecodedPreview:img.src.startsWith('data:image/'),hardwareVisible:!document.querySelector('#wiki-hardware').hidden}}""")
  assert not state['locked'] and not state['busy'] and not state['inert'] and state['headingOpacity']=='1' and state['ready'] and state['hardwareVisible'],state
  if case=='slow-image':assert state['usesDecodedPreview'],state
  checks.append({'case':case,**state})
  for r in held:r.abort()
  page.unroute_all(behavior='ignoreErrors');page.close()
 page=browser.new_page();page.on('pageerror',lambda e:errors.append(str(e)));held=[]
 page.route('**/room/cpu.webp*',lambda r:held.append(r));page.goto(url+'#wiki')
 page.locator('[data-wiki-tab=map]').click();page.wait_for_timeout(500)
 page.locator('[data-wiki-tab=stories]').click();page.wait_for_selector('#relationship-room-frame',state='detached')
 assert page.evaluate("location.hash==='#wiki'&&!document.querySelector('#wiki-stories').hidden&&!document.querySelector('#wiki-page').classList.contains('room-preparing')")
 for r in held:r.abort()
 page.unroute_all(behavior='ignoreErrors');checks.append({'case':'tab-during-preparation','cancelled':True,'selectedStoriesPreserved':True});page.close()
 # Control the host's clock only, replacing the iframe document with an inert
 # page. This tests the 200ms boundary and cancelling the timer on presentation.
 page=browser.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(url+'#wiki')
 page.route('**/relationship-room-study.html*',lambda r:r.fulfill(body='<!doctype html><html></html>',content_type='text/html'))
 page.evaluate("async()=>{const {RelationshipRoomHost}=await import('inside/room-host');window.__host=new RelationshipRoomHost(()=>{},()=>{});}")
 page.clock.install(time='2026-10-09T12:00:00Z');page.clock.pause_at('2026-10-09T12:00:01Z')
 page.evaluate("__host.enter('map',{animate:true})");page.clock.run_for(199)
 assert not page.locator('#wiki-page').evaluate("e=>e.classList.contains('room-preparing')")
 page.clock.run_for(1);assert page.locator('#wiki-page').evaluate("e=>e.classList.contains('room-preparing')")
 page.evaluate("__host.leave();__host.enter('map',{animate:true})");page.clock.run_for(100);page.evaluate('__host.paint(1,1);__host.present()');page.clock.run_for(500)
 assert not page.locator('#wiki-page').evaluate("e=>e.classList.contains('room-preparing')")
 page.evaluate('__host.leave()');checks.append({'case':'200ms-boundary','noFadeAt199ms':True,'fadeAt200ms':True,'presentationAt100msCancelsFade':True});page.close();browser.close()
server.shutdown();assert not errors,errors
out=root/'docs/performance/wiki-return-edges.json';out.write_text(json.dumps({'checks':checks,'pageErrors':errors},indent=2));print(out.read_text())
