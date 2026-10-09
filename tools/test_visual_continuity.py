#!/usr/bin/env python3
"""Visual identity, projected transfer bounds, stale-frame barrier and key layout."""
import base64,functools,io,json,threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from PIL import Image,ImageChops,ImageStat
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/performance/continuity';OUT.mkdir(parents=True,exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/index.html'
results=[];errors=[]
room=(ROOT/'lib/inside/room-study.js').read_text()+'''
window.__gallery=()=>({view,moving,camera:camera&&[...camera.position.toArray(),...camera.quaternion.toArray(),camera.fov],items:items.map(i=>({id:i.id,group:i.group.uuid,geometry:i.group.children[0].geometry.uuid,source:i.group.children[0].material.map.image.src,full:!!i.full,bounds:i.bounds,pose:i.pose,rect:(()=>{const r=(embedded?parent.document.querySelector('#wiki-hardware a[href="#object/'+i.id+'"] img'):document.querySelector('#wiki-hardware img[data-id="'+i.id+'"]')).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})()}))});
window.__trace=[];
'''
room=room.replace('drawScene();updatePair();','drawScene();updatePair();if(travelling())__trace.push({kind:view,t,...__gallery()});')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 for profile,width,height in [('desktop',1440,900),('mobile',390,844)]:
  page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=profile=='mobile',has_touch=profile=='mobile');page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/lib/inside/room-study.js*',lambda route:route.fulfill(body=room,content_type='text/javascript'))
  # Exact opening capture against its lossless static frame.
  source=(ROOT/'lib/inside/study.js').read_text();anchor='renderFilm();introStart=performance.now();'
  page.route('**/lib/inside/study.js*',lambda route:route.fulfill(body=source.replace(anchor,"renderFilm();window.__firstCPU=renderer.domElement.toDataURL('image/png');introStart=performance.now();"),content_type='text/javascript'))
  page.goto(url+'#home',wait_until='domcontentloaded');page.wait_for_function('window.__firstCPU',timeout=120000)
  live=Image.open(io.BytesIO(base64.b64decode(page.evaluate('__firstCPU').split(',')[1]))).convert('RGB')
  still=Image.open(ROOT/f'assets/inside/intro/{profile}.webp').convert('RGB')
  mae=sum(ImageStat.Stat(ImageChops.difference(live,still)).mean)/3
  assert mae<.1,mae
  results.append({'profile':profile,'cpuMeanAbsolutePixelError255':mae})
  page.unroute('**/lib/inside/study.js*')
  # Entry and exit must keep the camera fixed and meet the real DOM image.
  page.evaluate("location.hash='wiki'");page.wait_for_selector('#wiki-title:visible')
  parent_rects=page.locator('#wiki-hardware img').evaluate_all('es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})')
  page.locator('[data-wiki-tab=map]').click();page.wait_for_selector('#relationship-room-frame');frame=page.frames[-1]
  frame.wait_for_function("window.__gallery && __gallery().view==='room' && !__gallery().moving",timeout=120000)
  entry=frame.evaluate('__trace');assert len(entry)>10
  assert all(x['camera']==entry[0]['camera'] for x in entry)
  def fit(r):
   w=min(r['width'],r['height']*4/3);h=w*3/4
   return dict(x=r['x']+(r['width']-w)/2,y=r['y']+(r['height']-h)/2,width=w,height=h)
  # IDs are mounted in a different order than the Wiki list; compare each image
  # with its own DOM bounds and compare the parent/iframe CPU endpoint directly.
  errors_entry=[max(abs(i['bounds'][k]-fit(i['rect'])[k]) for k in ['x','y','width','height']) for i in entry[0]['items'] if 0<=i['rect']['y']<height]
  assert max(errors_entry)<4,errors_entry
  cpu=next(i for i in entry[0]['items'] if i['id']=='cpu')
  assert max(abs(cpu['rect'][k]-parent_rects[0][k]) for k in cpu['rect'])<1,(cpu['rect'],parent_rects[0])
  before=frame.evaluate('__gallery().items');frame.locator('[data-hardware=cpu]').click(force=True)
  frame.wait_for_function("__gallery().items.find(i=>i.id==='cpu').full && !__gallery().moving")
  after=frame.evaluate('__gallery().items');a=next(i for i in before if i['id']=='cpu');b=next(i for i in after if i['id']=='cpu')
  assert a['geometry']==b['geometry'] and a['group']==b['group']
  assert '/room/cpu.webp' in a['source'] and '/redesign/cpu.webp' in b['source']
  frame.locator('[data-tab=relations]').click();frame.locator('.detail-peer').first.click()
  frame.wait_for_function('__gallery().items.filter(i=>i.full).length===2 && !__gallery().moving')
  for i in frame.evaluate('__gallery().items'):
   original=next(x for x in before if x['id']==i['id']);assert i['group']==original['group'] and i['geometry']==original['geometry']
  page.wait_for_timeout(450);page.screenshot(path=str(OUT/f'{profile}-connection.png'))
  frame.locator('#room-close').click();frame.wait_for_function('!__gallery().moving');frame.evaluate('__trace=[]')
  # Trace through the real iframe removal; do not mock the return handshake.
  frame.evaluate('window.__trace=parent.__galleryExitTrace=[]')
  frame.locator('.room-exit').click();page.wait_for_selector('#relationship-room-frame',state='detached')
  trace=page.evaluate('__galleryExitTrace');assert all(x['camera']==trace[0]['camera'] for x in trace)
  last=trace[-1];errors_exit=[max(abs(i['bounds'][k]-fit(i['rect'])[k]) for k in ['x','y','width','height']) for i in last['items'] if 0<=i['rect']['y']<height]
  assert max(errors_exit)<1,(errors_exit,last['t'])
  results.append({'profile':profile,'roomEntryMaxEndpointErrorPx':max(errors_entry),'roomExitMaxEndpointErrorPx':max(errors_exit),'entryFrames':len(entry),'exitFrames':len(trace),'cameraFixed':True,'detailAndPeerGeometryUnchanged':True})
  # A deliberately slow second scenario must cover the old canvas immediately.
  scenario=(ROOT/'lib/inside/scenario-film.js').read_text()
  page.route('**/lib/inside/scenario-film.js*',lambda route:route.fulfill(body=scenario.replace('async enter(id,index=0){','async enter(id,index=0){await new Promise(r=>setTimeout(r,500));'),content_type='text/javascript'))
  page.goto(url+'#story/game/0');page.wait_for_function("document.body.dataset.story==='game' && !document.body.classList.contains('loading')",timeout=120000)
  page.wait_for_selector('.scene-exposure',state='detached',timeout=15000)
  page.evaluate("""window.__barriers=[];window.__barrierObserver=new MutationObserver(()=>{if(document.body.classList.contains('scene-pending'))__barriers.push({visibility:getComputedStyle(document.querySelector('#world')).visibility,background:getComputedStyle(document.querySelector('#stage')).backgroundColor});});__barrierObserver.observe(document.body,{attributes:true});location.hash='story/typing/0';""")
  page.wait_for_function("document.body.dataset.story==='typing' && !document.body.classList.contains('loading')",timeout=120000)
  barriers=page.evaluate('__barrierObserver.disconnect();__barriers');assert barriers, page.evaluate('({hash:location.hash,cls:document.body.className})')
  assert all(b['visibility']=='hidden' and b['background']=='rgb(0, 0, 0)' for b in barriers),barriers
  page.wait_for_selector('.scene-exposure',state='detached');assert not page.locator('body').evaluate("e=>e.classList.contains('scene-pending')")
  results.append({'profile':profile,'staleScenarioCoveredSynchronously':True})
  page.evaluate("location.hash='wiki'");page.wait_for_selector('#wiki-title:visible');page.locator('[data-wiki-tab=stories]').click()
  cover=page.locator('#wiki-stories [data-scenario=typing] .story-cover')
  if not cover.count():cover=page.locator('#wiki-stories [data-scenario=typing] svg').first
  keys=cover.locator('[data-key]');assert keys.count()==87,keys.count()
  bounds=keys.evaluate_all('es=>es.map(e=>{const r=e.getBBox();return{x:r.x,y:r.y,w:r.width,h:r.height};})')
  assert all(b['x']>=7 and b['y']>=5 and b['x']+b['w']<=498 and b['y']+b['h']<=166 for b in bounds)
  cover.scroll_into_view_if_needed();page.mouse.move(0,0);page.wait_for_timeout(300);cover.screenshot(path=str(OUT/f'{profile}-typing.png'))
  results.append({'profile':profile,'keyboardKeys':87,'allKeycapsInsideDeck':True});page.close()
 browser.close()
server.shutdown();assert not errors,errors
(OUT/'checks.json').write_text(json.dumps({'checks':results,'pageErrors':errors},ensure_ascii=False,indent=2));print(json.dumps(results,indent=2))
