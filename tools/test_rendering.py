#!/usr/bin/env python3
"""Interaction, async-route cancellation, resource lifetime and WebGL recovery checks."""
import functools
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/index.html'
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True,reduced_motion='reduce')
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 stage_source=(ROOT/'lib/inside/study.js').read_text()
 anchor='graphics={T,renderer,scene,camera,key,rim,fill,floor,root,colorDark,colorLight,focus,position,environment,computer,reveal};'
 page.route('**/lib/inside/study.js*',lambda route:route.fulfill(body=stage_source.replace(anchor,anchor+'window.__testStage=graphics;'),content_type='text/javascript'))
 # A Wiki deep link should not instantiate WebGL or allocate the film textures.
 page.add_init_script("window.webglContexts=0;const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type.startsWith('webgl'))window.webglContexts++;return get.call(this,type,...args);};")
 page.goto(url+'#wiki');page.wait_for_selector('#wiki-title:visible');page.wait_for_timeout(500)
 assert page.evaluate('webglContexts')==0
 assert page.locator('#render-status').is_hidden()
 results.append('Wiki direct entry: zero WebGL contexts')
 def route(hash):page.evaluate('hash=>location.hash=hash',hash)
 def ready():
  page.wait_for_function("document.querySelector('#render-status').hidden && !document.body.classList.contains('loading')",timeout=120000)
  assert not page.evaluate("document.body.classList.contains('failed')")
 # Each awaited route must correspond to its actual destination, including when
 # all model preparation is cold on the first deep link.
 def gallery(group):
  frame=page.frame_locator('#relationship-room-frame')
  frame.locator('#room[data-group="'+group+'"][data-moving=false]').wait_for(timeout=120000)
  return frame
 for group in ['compute','network','io','graphics','power','storage']:
  route('map/group/'+group);frame=gallery(group)
  frame.locator('.room-part:not([disabled])').first.click();frame.locator('body.detail-ready').wait_for()
  frame.locator('[data-tab="parts"]').click();frame.locator('body.detail-ready').wait_for()
  frame.locator('[data-tab="relations"]').click();frame.locator('body.detail-ready').wait_for()
 results.append('All six relationship groups, node, parts and relation tabs')
 ids=page.evaluate("async()=>Object.keys((await import('inside/data')).STORIES)")
 for id in ids:
  route('story/'+id+'/0')
  page.wait_for_function('id=>document.body.dataset.story===id',arg=id);ready()
  page.wait_for_function("document.body.dataset.storyStep==='0'")
  page.evaluate("document.querySelector('#story-track button:last-child').click()")
  page.wait_for_function("Number(document.body.dataset.storyStep)===document.querySelectorAll('#story-track button').length-1")
  assert page.locator('#story-title').inner_text()
 results.append(f'All {len(ids)} scenarios: entry and final step')
 route('story/storage/0');page.wait_for_function("document.body.dataset.story==='storage'");ready()
 for variant in ['hdd','cached','ssd']:
  page.evaluate('v=>document.querySelector(`[data-storage="${v}"]`).click()',variant)
  page.wait_for_function('v=>document.body.dataset.storage===v',arg=variant)
 results.append('SSD/HDD/cache branches')
 # Cancel preparation on a later task, while it is yielding between models.
 page.evaluate("location.hash='map/group/network';setTimeout(()=>location.hash='wiki',20)")
 page.wait_for_function("document.body.dataset.mode==='wiki'");page.wait_for_timeout(1200)
 assert page.locator('#render-status').is_hidden()
 assert page.locator('#relationship-room-frame').count()==0
 results.append('Interrupted relationship preparation does not overwrite Wiki')
 page.evaluate("location.hash='story/call/0';setTimeout(()=>location.hash='wiki',20)")
 page.wait_for_function("document.body.dataset.mode==='wiki'");page.wait_for_timeout(1000)
 assert page.locator('#render-status').is_hidden()
 results.append('Interrupted scenario preparation does not overwrite Wiki')
 # Compare retained GPU resource counts at the same idle destination after each
 # full cycle, including shader/model reuse. They must plateau, not grow.
 counts=[]
 for cycle in range(5):
  route('story/call/0');page.wait_for_function("document.body.dataset.story==='call'");ready()
  route('map/group/network');gallery('network');ready()
  route('wiki');page.wait_for_function("document.body.dataset.mode==='wiki'");page.wait_for_timeout(150)
  counts.append(page.evaluate('({...__testStage.renderer.info.memory})'))
 assert counts[-1]['textures']<=counts[1]['textures'],counts
 assert counts[-1]['geometries']<=counts[1]['geometries'],counts
 results.append({'fiveRoundTripsRendererMemory':counts})
 # Context loss must keep useful text/images and navigation, with no reload loop.
 route('story/save/0');page.wait_for_function("document.body.dataset.story==='save'");ready()
 page.evaluate("window.loseExtension=document.querySelector('#world').getContext('webgl2').getExtension('WEBGL_lose_context');loseExtension.loseContext()")
 page.wait_for_function("document.body.classList.contains('failed')")
 assert page.locator('#render-status').get_attribute('data-state')=='recovery'
 assert page.locator('#story-title').inner_text()
 route('map/group/compute');frame=gallery('compute')
 assert frame.locator('.room-part:not([disabled])').count()==5
 results.append('Parent context loss leaves the independent relationship gallery usable')
 page.evaluate("loseExtension.restoreContext()")
 page.wait_for_function("!document.body.classList.contains('failed')",timeout=120000)
 gallery('compute')
 results.append('Context restoration preserves the active relationship route')
 page.goto(url+'?quality=still#story/save/0');page.wait_for_function("document.body.dataset.story==='save' && document.body.dataset.storyStep==='0'")
 assert page.evaluate('webglContexts')==0
 assert page.locator('#story-title').inner_text()
 results.append('Image-only mode: zero WebGL contexts, scenario remains usable')
 page.goto(url+'?quality=still#object/cpu')
 page.wait_for_function("document.body.dataset.mode==='object' && document.querySelector('#fallback').complete && document.querySelector('#fallback').naturalWidth>0")
 assert page.evaluate('webglContexts')==0
 results.append('Image-only direct object entry displays its portrait')
 assert not errors,errors
 page.close()
 desktop=browser.new_page(viewport={'width':1440,'height':900},reduced_motion='no-preference')
 desktop.on('pageerror',lambda e:errors.append(str(e)))
 desktop.goto(url+'#screen')
 desktop.wait_for_function("document.body.classList.contains('ready') && document.querySelector('#render-status').hidden",timeout=120000)
 desktop.wait_for_function("Number(document.body.dataset.filmProgress)>.995",timeout=120000)
 desktop.locator('#ending .wiki-enter').click(timeout=120000)
 desktop.wait_for_function("document.body.dataset.mode==='wiki' && !document.body.classList.contains('wiki-arriving')",timeout=120000)
 assert desktop.locator('#wiki-title').is_visible()
 assert not desktop.locator('#wiki-page').evaluate('(el)=>el.inert')
 results.append('Desktop monitor and animated Wiki arrival complete and release input')
 desktop.evaluate("async()=>{const {Experience}=await import('inside/experience');Experience.prototype.object=async()=>{throw new Error('intentional object failure for recovery test');};location.hash='object/cpu';}")
 desktop.wait_for_function("document.body.classList.contains('failed') && document.querySelector('#fallback').complete && document.querySelector('#fallback').naturalWidth>0")
 results.append('Object construction failure displays a fallback portrait')
 assert not errors,errors
 desktop.close();browser.close()
server.shutdown()
print(json.dumps({'passed':results,'pageErrors':errors},ensure_ascii=False,indent=2))
