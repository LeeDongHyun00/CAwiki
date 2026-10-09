#!/usr/bin/env python3
"""Cold Wiki->gallery and actual gallery->Wiki handoff; repeatable local metrics."""
import argparse,functools,json,statistics,threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);ap.add_argument('--out',type=Path,required=True);ap.add_argument('--runs',type=int,default=3);args=ap.parse_args();root=args.root.resolve()
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
 def end_headers(self):self.send_header('Cache-Control','no-store');super().end_headers()
 def copyfile(self,a,b):
  try:super().copyfile(a,b)
  except (BrokenPipeError,ConnectionResetError):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start()
INIT='''window.__transferMeasure={frames:[],tasks:[],draws:[]};
let previous=0;function sample(t){if(previous)__transferMeasure.frames.push(t-previous);previous=t;requestAnimationFrame(sample)}requestAnimationFrame(sample);
const observer=new PerformanceObserver(l=>__transferMeasure.tasks.push(...l.getEntries().map(e=>e.duration)));observer.observe({type:'longtask',buffered:true});
window.__resetTransfer=()=>{observer.takeRecords();__transferMeasure={frames:[],tasks:[],draws:[]};};
window.__collectTransfer=()=>{__transferMeasure.tasks.push(...observer.takeRecords().map(e=>e.duration));return {...__transferMeasure,parentAt:parent.performance.now(),nodes:document.querySelectorAll('*').length,memory:window.__transferRenderer?{...__transferRenderer.info.memory}:null,encodedBytes:performance.getEntriesByType('resource').reduce((s,r)=>s+r.encodedBodySize,0)};};'''
source=(root/'lib/inside/room-study.js').read_text();anchor='renderer.toneMappingExposure=1.12;';assert anchor in source
source=source.replace(anchor,anchor+'''window.__transferRenderer=renderer;const originalRender=renderer.render.bind(renderer);renderer.render=(...args)=>{originalRender(...args);__transferMeasure.draws.push({...renderer.info.render});};''')
source=source.replace('function completeExit(){','function completeExit(){parent.__exitTransferMetrics=__collectTransfer();')
def summarize(data,start):
 frames=sorted(data.pop('frames'));tasks=data.pop('tasks');draws=data.pop('draws');data['elapsedMs']=data.pop('parentAt')-start
 data['frameP95Ms']=frames[min(len(frames)-1,int(len(frames)*.95))] if frames else None
 data['longTasks']={'n':len(tasks),'maxMs':max(tasks,default=0),'blockingMs':sum(max(0,t-50) for t in tasks)}
 data['renders']={'n':len(draws),'maxCalls':max((r['calls'] for r in draws),default=0),'maxTriangles':max((r['triangles'] for r in draws),default=0)}
 return data
out={'method':{'version':1,'gpu':'SwiftShader','network':'localhost no-store, no artificial delay','cpuThrottle':1,'desktop':[1440,900,1],'mobile':[390,844,3],'end':'entry: room idle; exit: final frame before actual iframe removal','p95':'rAF intervals, including preparation/idle; not GPU time','heap':'JS only, not GPU/native RAM'},'runs':[]}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader']);out['browserVersion']=browser.version
 for profile,w,h,dpr in [('desktop',1440,900,1),('mobile',390,844,3)]:
  for n in range(args.runs):
   page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=dpr,is_mobile=profile=='mobile',has_touch=profile=='mobile');page.add_init_script(INIT);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/lib/inside/room-study.js*',lambda r:r.fulfill(body=source,content_type='text/javascript'))
   cdp=page.context.new_cdp_session(page);cdp.send('Performance.enable')
   page.goto(f'http://127.0.0.1:{server.server_port}/index.html#wiki');page.wait_for_selector('#wiki-title:visible');page.wait_for_function("[...document.querySelectorAll('#wiki-hardware img')].slice(0,2).every(i=>i.complete&&i.naturalWidth)")
   start=page.evaluate('performance.now()');page.locator('[data-wiki-tab=map]').click();page.wait_for_selector('#relationship-room-frame');frame=page.frames[-1]
   frame.wait_for_function("document.body.dataset.mode==='room' && document.querySelector('#room').dataset.moving==='false'",timeout=120000)
   entry=summarize(frame.evaluate('__collectTransfer()'),start);entry['jsHeapBytes']=next(m['value'] for m in cdp.send('Performance.getMetrics')['metrics'] if m['name']=='JSHeapUsedSize')
   frame.evaluate('__resetTransfer()');start=page.evaluate('performance.now()');frame.locator('.room-exit').click();page.wait_for_selector('#relationship-room-frame',state='detached',timeout=30000)
   exit=summarize(page.evaluate('__exitTransferMetrics'),start)
   assert not errors,errors
   record={'profile':profile,'run':n+1,'entry':entry,'exit':exit,'errors':errors};out['runs'].append(record);args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(json.dumps(out,indent=2)+'\n');print(profile,n+1,'entry',round(entry['elapsedMs']),'exit',round(exit['elapsedMs']),'nodes',entry['nodes'],flush=True);page.close()
 browser.close()
server.shutdown()
