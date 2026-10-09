#!/usr/bin/env python3
"""Observe the actual parent/iframe handoff, including slow textures and scrolling."""
import argparse,functools,json,threading,time
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);ap.add_argument('--out',type=Path,required=True);ap.add_argument('--strict',action='store_true');args=ap.parse_args();root=args.root.resolve()
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
 def do_GET(self):
  if '/room/cpu.webp' in self.path:time.sleep(1.2)
  super().do_GET()
 def copyfile(self,a,b):
  try:super().copyfile(a,b)
  except (BrokenPipeError,ConnectionResetError):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/index.html'
room=(root/'lib/inside/room-study.js').read_text()+'''
window.__transferProbe=()=>({view,moving,hidden:room.hidden,ready:room.dataset.ready,canvasOpacity:Number(getComputedStyle(renderer?.domElement||room).opacity),bounds:items.map(i=>({id:i.id,bounds:i.bounds,opacity:i.pose.opacity})),images:[...document.querySelectorAll('#wiki-hardware img')].map(i=>({id:i.dataset.id,complete:i.complete&&!!i.naturalWidth}))});
'''
# Save the last real WebGL bounds before the iframe is removed (no mock return).
room=room.replace('function completeExit(){',"function completeExit(){if(parent!==window)parent.__lastRoomBounds=items.map(i=>({id:i.id,bounds:i.bounds,opacity:i.pose.opacity}));")
SAMPLER='''()=>{
 window.__samples=[];window.__watch=true;
 const list=document.querySelector('#wiki-page');window.__originalList=list;
 const rects=()=>Object.fromEntries([...document.querySelectorAll('#wiki-hardware img')].map(i=>{const r=i.getBoundingClientRect();return[i.closest('a').hash.split('/')[1],{x:r.x,y:r.y,width:r.width,height:r.height}]}));
 window.__originalRects=rects();window.__getRects=rects;
 function sample(t){
  if(!__watch)return;
  const f=document.querySelector('#relationship-room-frame'),shown=f&&getComputedStyle(f).visibility==='visible',probe=f?.contentWindow.__transferProbe?.();
  const opacity=Number(getComputedStyle(list).opacity),image=Number(getComputedStyle(list.querySelector('img')).opacity);
  let shift=0;for(const [id,r] of Object.entries(rects()))for(const k of ['x','y','width','height'])shift=Math.max(shift,Math.abs(r[k]-__originalRects[id][k]));
  const iframeOpaque=shown&&getComputedStyle(f).backgroundColor!=='rgba(0, 0, 0, 0)';
  const parentVisible=!list.hidden&&!iframeOpaque;
  const duplicate=shown&&probe&&!probe.hidden?0:shown&&probe?.images.find(i=>i.id==='cpu')?.complete?1:0;
  const cpu=probe?.bounds.find(i=>i.id==='cpu');
  const coverage=(parentVisible?opacity*image:0)+(shown&&!probe?.hidden?(probe?.canvasOpacity||0)*(cpu?.opacity||0):duplicate);
  __samples.push({t,shown:!!shown,ready:!!probe?.ready,view:probe?.view,shift,coverage,sameList:document.querySelector('#wiki-page')===__originalList});
  requestAnimationFrame(sample);
 }requestAnimationFrame(sample);
}'''
records=[];errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 for name,w,h in [('desktop',1440,900),('mobile',390,844)]:
  for offset in [0,1000]:
   page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1,is_mobile=name=='mobile',has_touch=name=='mobile');page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/lib/inside/room-study.js*',lambda r:r.fulfill(body=room,content_type='text/javascript'))
   page.goto(url+'#wiki');page.wait_for_selector('#wiki-title:visible');page.evaluate('y=>scrollTo(0,y)',offset);page.wait_for_timeout(80)
   page.evaluate('''async()=>{await Promise.allSettled([...document.querySelectorAll('#wiki-hardware img')].filter(i=>{const r=i.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight}).map(i=>{i.loading='eager';return i.decode()}));}''')
   nav=page.evaluate("()=>{const a=document.querySelector('[data-wiki-tab=stories]').getBoundingClientRect(),b=document.querySelector('[data-wiki-tab=map]').getBoundingClientRect();return b.left-a.right;}")
   if args.strict and offset==0:page.locator('#wiki-hardware img').first.hover()
   page.evaluate(SAMPLER);started=time.monotonic();page.evaluate("document.querySelector('[data-wiki-tab=map]').click()")
   page.wait_for_selector('#relationship-room-frame',state='attached');frame=page.frames[-1]
   frame.wait_for_function("window.__transferProbe && __transferProbe().view==='room'&&!__transferProbe().moving",timeout=120000)
   enter_ms=(time.monotonic()-started)*1000
   entry=page.evaluate('__samples');page.evaluate('__samples=[]')
   # Actual return must transfer the same list, without disabling postMessage.
   frame.locator('.room-exit').click();page.wait_for_selector('#relationship-room-frame',state='detached',timeout=20000);page.wait_for_timeout(80)
   exit_samples=page.evaluate('__samples');page.evaluate('__watch=false')
   end=page.evaluate('''()=>({scroll:scrollY,locked:document.querySelector('#wiki-page').classList.contains('room-list-locked'),rects:__getRects(),bounds:__lastRoomBounds})''')
   endpoint=[]
   for item in end['bounds']:
    r=end['rects'][item['id']];width=min(r['width'],r['height']*4/3);height=width*3/4;expected={'x':r['x']+(r['width']-width)/2,'y':r['y']+(r['height']-height)/2,'width':width,'height':height}
    endpoint.append(max(abs(expected[k]-item['bounds'][k]) for k in expected))
   record={'profile':name,'scroll':offset,'mapButtonGapPx':nav,'entryMsWith1200msTextureDelay':enter_ms,'prematureIframeFrames':sum(s['shown'] and not s['ready'] for s in entry),'parentLayoutMaxShiftPx':max(s['shift'] for s in entry+exit_samples),'sameParentList':all(s['sameList'] for s in entry+exit_samples),'exitEndpointMaxErrorPx':max(endpoint),'restoredScroll':end['scroll'],'lockReleased':not end['locked']}
   if offset==0:record['zeroCoverageFrames']=sum(s['coverage']<.01 for s in entry+exit_samples)
   records.append(record)
   if args.strict:
    assert record['prematureIframeFrames']==0,record
    assert record['parentLayoutMaxShiftPx']<1 and record['sameParentList'],record
    assert record['exitEndpointMaxErrorPx']<1 and abs(end['scroll']-offset)<1 and record['lockReleased'],record
    assert record.get('zeroCoverageFrames',0)==0 and nav<=31,record
   page.close()
  if args.strict:
   # Stories retain their own layout while preparation runs; cancel is immediate.
   page=browser.new_page(viewport={'width':w,'height':h},is_mobile=name=='mobile',has_touch=name=='mobile');page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(url+'#wiki');page.wait_for_selector('#wiki-title:visible');page.locator('[data-wiki-tab=stories]').click();page.locator('[data-wiki-tab=map]').click();page.wait_for_selector('#relationship-room-frame',state='attached');page.wait_for_timeout(150)
   assert page.locator('#wiki-hardware').is_hidden() and page.locator('#wiki-stories').is_visible()
   page.keyboard.press('Escape');page.wait_for_selector('#relationship-room-frame',state='detached');assert not page.locator('#wiki-page').evaluate('e=>e.inert')
   # A normal story->room->story round trip must not force a hardware-list flash.
   page.locator('[data-wiki-tab=map]').click();page.wait_for_selector('#relationship-room-frame');frame=page.frames[-1]
   frame.wait_for_function("document.body.dataset.mode==='room' && document.querySelector('#room').dataset.moving==='false'",timeout=120000)
   frame.locator('.room-exit').click();page.wait_for_selector('#relationship-room-frame',state='detached');assert page.locator('#wiki-stories').is_visible();page.close()
   page=browser.new_page(viewport={'width':w,'height':h});page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(url+'?quality=still#wiki');page.wait_for_selector('#wiki-title:visible');page.locator('[data-wiki-tab=map]').click();page.wait_for_selector('#relationship-room-frame');frame=page.frames[-1]
   frame.wait_for_selector('.room-fallback:visible',timeout=120000);page.wait_for_function("document.querySelector('#relationship-room-frame').style.visibility==='visible'")
   frame.locator('.room-exit').click();page.wait_for_selector('#relationship-room-frame',state='detached');assert page.locator('#wiki-title').is_visible()
   # A queued detail route must not replace a newer parent navigation. Trigger
   # both in one task, so this reproduces the race without timing assumptions.
   page.locator('[data-wiki-tab=map]').click();page.wait_for_selector('#relationship-room-frame');frame=page.frames[-1]
   frame.wait_for_selector('.room-fallback:visible');page.wait_for_function("document.querySelector('#relationship-room-frame').style.visibility==='visible'")
   page.evaluate("()=>{document.querySelector('#relationship-room-frame').contentDocument.querySelector('.room-fallback [data-id=cpu]').click();location.hash='wiki';}")
   page.wait_for_selector('#relationship-room-frame',state='detached');assert page.locator('#wiki-title').is_visible();assert page.evaluate('location.hash')=='#wiki';page.close()
   records.append({'profile':name,'storiesPreserved':True,'pendingEscapeRestoresInput':True,'imageOnlyRoundTrip':True,'queuedChildRouteCannotUndoReturn':True})
 browser.close()
server.shutdown();assert not errors,errors
args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(json.dumps({'cases':records,'pageErrors':errors},indent=2)+'\n');print(json.dumps(records,indent=2))
