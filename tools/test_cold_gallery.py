#!/usr/bin/env python3
"""Fresh Chrome: pending entry, first-frame failure, shader deadline and film work."""
import argparse,functools,json,threading,time
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);ap.add_argument('--out',type=Path,required=True);ap.add_argument('--strict',action='store_true');ap.add_argument('--cases',default='pending-cancel,shader-stall,first-frame-error,early-film,4k,mobile');args=ap.parse_args();root=args.root.resolve()
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
 def end_headers(self):self.send_header('Cache-Control','no-store');super().end_headers()
 def copyfile(self,a,b):
  try:super().copyfile(a,b)
  except (BrokenPipeError,ConnectionResetError):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/index.html'
room=(root/'lib/inside/room-study.js').read_text()
probe="\nwindow.__coldRoom=()=>({view,moving,ready:room.dataset.ready,renderer:!!renderer,canvas:renderer&&[renderer.domElement.width,renderer.domElement.height],parts:items.length});"
records=[]
with sync_playwright() as p:
 for case in args.cases.split(','):
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
  mobile=case=='mobile';w,h,dpr=(3840,2160,2) if case=='4k' else (390,844,3) if mobile else (1440,900,1)
  page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=dpr,is_mobile=mobile,has_touch=mobile);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('crash',lambda:errors.append('PAGE_CRASH'))
  cdp=page.context.new_cdp_session(page);cdp.send('Network.enable');cdp.send('Network.setCacheDisabled',{'cacheDisabled':True})
  source=room
  if case in ['first-frame-error','entry-render-error']:
   anchor='function drawRoomScene(){' if 'function drawRoomScene(){' in source else 'function drawScene(){'
   condition="view==='entering'"+("&&!window.__firstFrameFault" if case=='first-frame-error' else '')
   source=source.replace(anchor,anchor+"if("+condition+"){window.__firstFrameFault=true;throw new Error('Injected first-entry render failure');}")
  page.route('**/lib/inside/room-study.js*',lambda r:r.fulfill(body=source+probe,content_type='text/javascript'))
  if case=='shader-stall':
   program=(root/'lib/inside/prepare-programs.js').read_text().replace("if (!renderer.extensions.has('KHR_parallel_shader_compile')) return true;",'') .replace('if (!pending) return true;','pending=true;if (!pending) return true;')
   page.route('**/lib/inside/prepare-programs.js*',lambda r:r.fulfill(body=program,content_type='text/javascript'))
  if case=='pending-cancel':
   # A held request, released by page teardown. No artificial renderer delay.
   held=[];page.route('**/room/cpu.webp*',lambda r:held.append(r))
  if case=='early-film':
   stage=(root/'lib/inside/study.js').read_text().replace('const root=computer.root;',"performance.mark('test:part:'+id,{detail:{suspended,mode:document.body.dataset.mode}});const root=computer.root;")
   anchor="performance.mark('inside:cpu-visible');"
   stage=stage.replace(anchor,anchor+"document.querySelector('.collection-entry').click();setTimeout(()=>document.querySelector('[data-wiki-tab=map]').click(),0);")
   stage+="\nwindow.__filmProbe=()=>({complete:computerComplete,canvas:graphics&&[graphics.renderer.domElement.width,graphics.renderer.domElement.height],target:graphics&&[graphics.reveal.target.width,graphics.reveal.target.height]});"
   page.route('**/lib/inside/study.js*',lambda r:r.fulfill(body=stage,content_type='text/javascript'))
  page.goto(url+('#home' if case=='early-film' else '#wiki'),wait_until='domcontentloaded')
  if case!='early-film':page.wait_for_selector('#wiki-title:visible');page.locator('[data-wiki-tab=map]').click()
  page.wait_for_selector('#relationship-room-frame',state='attached',timeout=120000);frame=page.frames[-1];frame.wait_for_function('window.__coldRoom',timeout=30000);start=time.monotonic()
  record={'case':case}
  if case=='pending-cancel':
   page.wait_for_timeout(250)
   record['parentInteractiveDuringPreparation']=page.evaluate("()=>{let e=document.querySelector('[data-wiki-tab=map]'),r=e.getBoundingClientRect();return !document.querySelector('#wiki-page').inert&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}")
   page.keyboard.press('Escape');page.wait_for_timeout(150);record['cancelled']=page.locator('#relationship-room-frame').count()==0
   if args.strict:assert record['parentInteractiveDuringPreparation'] and record['cancelled'],record
  else:
   timeout=10000 if case=='shader-stall' else 7000 if case in ['first-frame-error','entry-render-error'] else 45000
   try:frame.wait_for_function("__coldRoom().view==='room'&&!__coldRoom().moving",timeout=timeout);record['settled']=True
   except Exception:record['settled']=False
   record['entryMs']=(time.monotonic()-start)*1000;record['state']=frame.evaluate('__coldRoom()')
   if record['settled']:
    if record['state']['renderer']:frame.locator('[data-hardware=cpu]').click(force=True)
    else:frame.locator('.room-fallback [data-id=cpu]').click()
    frame.wait_for_selector('body.detail-ready',timeout=10000);record['detailClickable']=bool(frame.locator('#detail-title').inner_text())
    frame.locator('#room-close').click();frame.wait_for_function('!__coldRoom().moving')
   if case=='early-film':
    record['filmWhileInRoom']=page.evaluate('__filmProbe()')
    record['backgroundParts']=page.evaluate("performance.getEntriesByType('mark').filter(e=>e.name.startsWith('test:part:')&&e.detail?.suspended).map(e=>e.name)")
    page.evaluate("location.hash='object/cpu'");page.wait_for_function("performance.getEntriesByName('inside:object-ready').length&&!document.body.classList.contains('loading')",timeout=120000)
    record['restoredCanvas']=page.evaluate('__filmProbe().canvas')
    # Disable only the auto-navigation probe before returning to the film.
    page.evaluate("location.hash='home'");page.wait_for_function('__filmProbe().complete',timeout=120000);record['filmResumed']=True
    if args.strict:assert not record['backgroundParts'] and record['filmWhileInRoom']['canvas']==[1,1] and record['restoredCanvas']==[w,h],record
   elif record['settled']:
    if case in ['4k','mobile']:
     canvas=record['state']['canvas'];record['canvasPixels']=canvas[0]*canvas[1]
     if args.strict:assert record['canvasPixels']<= (900*900 if mobile else 1600*900),record
    frame.locator('.room-exit').click();page.wait_for_selector('#relationship-room-frame',state='detached',timeout=20000);record['returned']=page.locator('#wiki-title').is_visible()
   if args.strict:assert record['settled'] and record['detailClickable'],record
   if case=='entry-render-error' and not record['settled']:
    # Keep the same injected failure: reload takes #map's direct-entry path,
    # which skips the failing entering animation just as in the reported symptom.
    page.reload(wait_until='domcontentloaded');page.wait_for_selector('#relationship-room-frame');reloaded=page.frames[-1]
    reloaded.wait_for_function("window.__coldRoom && __coldRoom().view==='room'&&!__coldRoom().moving",timeout=30000)
    reloaded.locator('[data-hardware=cpu]').click();reloaded.wait_for_selector('body.detail-ready')
    record['sameFaultReloadsIntoWorkingDirectMap']=bool(reloaded.locator('#detail-title').inner_text())
  record['pageErrors']=errors
  if args.strict:assert not errors,errors
  records.append(record);args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(json.dumps({'method':'Fresh Chromium process per case; injected faults are explicitly named, not real driver crashes.','cases':records},indent=2)+'\n');print(json.dumps(record),flush=True)
  if case=='pending-cancel':
   for route in held:
    try:route.abort()
    except Exception:pass  # The iframe may already have cancelled its request.
  page.unroute_all(behavior='ignoreErrors');page.close();browser.close()
server.shutdown()
