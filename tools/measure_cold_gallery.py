#!/usr/bin/env python3
"""Cold gallery entry: fresh Chrome process/cache per run, controlled image latency."""
import argparse,functools,json,threading,time
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);ap.add_argument('--out',type=Path,required=True);ap.add_argument('--runs',type=int,default=3);ap.add_argument('--image-latency-ms',type=int,default=120);args=ap.parse_args();root=args.root.resolve()
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
 def do_GET(self):
  if '/room/' in self.path and '.webp' in self.path:time.sleep(args.image_latency_ms/1000)
  super().do_GET()
 def end_headers(self):self.send_header('Cache-Control','no-store');super().end_headers()
 def copyfile(self,a,b):
  try:super().copyfile(a,b)
  except (BrokenPipeError,ConnectionResetError):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/index.html#wiki'
INIT='''window.__cold={tasks:[],frames:[],losses:0};const obs=new PerformanceObserver(l=>__cold.tasks.push(...l.getEntries().map(e=>({at:e.startTime,ms:e.duration}))));obs.observe({type:'longtask',buffered:true});window.__coldObs=obs;let previous=0;function sample(t){if(previous)__cold.frames.push({at:t,ms:t-previous});previous=t;requestAnimationFrame(sample)}requestAnimationFrame(sample);addEventListener('webglcontextlost',()=>__cold.losses++,true);'''
source=(root/'lib/inside/room-study.js').read_text()+"\nwindow.__coldRoom=()=>({view,moving,ready:room.dataset.ready,canvas:renderer&&[renderer.domElement.width,renderer.domElement.height],attributes:renderer?.getContext().getContextAttributes(),memory:renderer&&{...renderer.info.memory}});"
out={'method':{'version':2,'gpu':'SwiftShader','browser':'Fresh Chromium process per run','cache':'Disabled, local HTTP no-store','imageResponseDelayMs':args.image_latency_ms,'cpuThrottle':1,'entry':'From actual map button click to room idle; includes 2200 ms choreography and automation observation delay','longTasks':'Parent and child observers, aligned by timeOrigin and deduplicated to nearest millisecond; includes hidden preparation','frameP95':'Parent rAF intervals after click; not GPU rendering time','heap':'JS heap, not GPU/native memory'},'runs':[]}
with sync_playwright() as p:
 for profile,w,h,dpr in [('desktop',1440,900,1),('4k',3840,2160,2),('mobile',390,844,3)]:
  for n in range(args.runs):
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader']);out['browserVersion']=browser.version
   page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=dpr,is_mobile=profile=='mobile',has_touch=profile=='mobile');page.add_init_script(INIT);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/lib/inside/room-study.js*',lambda r:r.fulfill(body=source,content_type='text/javascript'))
   cdp=page.context.new_cdp_session(page);cdp.send('Network.enable');cdp.send('Network.setCacheDisabled',{'cacheDisabled':True});cdp.send('Performance.enable')
   page.goto(url);page.wait_for_selector('#wiki-title:visible')
   start=page.evaluate("()=>{let t=performance.now();document.querySelector('[data-wiki-tab=map]').click();return t}")
   page.wait_for_selector('#relationship-room-frame',state='attached');f=page.frames[-1]
   f.wait_for_function("window.__coldRoom && __coldRoom().view==='room'&&!__coldRoom().moving",timeout=30000)
   end=page.evaluate('performance.now()');state=f.evaluate('__coldRoom()')
   data=page.evaluate("()=>{__cold.tasks.push(...__coldObs.takeRecords().map(e=>({at:e.startTime,ms:e.duration})));return {...__cold,origin:performance.timeOrigin}}")
   frames=sorted(e['ms'] for e in data['frames'] if start<=e['at']<=end)
   child=f.evaluate("()=>{__cold.tasks.push(...__coldObs.takeRecords().map(e=>({at:e.startTime,ms:e.duration})));return {tasks:__cold.tasks,origin:performance.timeOrigin,losses:__cold.losses,marks:performance.getEntriesByType('mark').map(e=>({name:e.name,ms:e.startTime})),images:performance.getEntriesByType('resource').filter(e=>e.name.includes('/room/')&&e.name.includes('.webp')).map(e=>({name:e.name.split('/room/')[1].split('?')[0],start:e.startTime,end:e.responseEnd,bytes:e.encodedBodySize}))}}")
   unique={}
   for context in [data,child]:
    for event in context['tasks']:
     at=context['origin']+event['at']-data['origin']
     if start<=at<=end:unique[(round(at),round(event['ms']))]={'at':at,'ms':event['ms']}
   events=list(unique.values());tasks=[e['ms'] for e in events]
   heap=next(m['value'] for m in cdp.send('Performance.getMetrics')['metrics'] if m['name']=='JSHeapUsedSize')
   row={'profile':profile,'run':n+1,'entryMs':end-start,'frameP95Ms':frames[min(len(frames)-1,int(len(frames)*.95))] if frames else None,'maxTaskMs':max(tasks,default=0),'blockingMs':sum(max(0,t-50) for t in tasks),'longTaskEvents':events,'losses':data['losses']+child['losses'],'jsHeapBytes':heap,'state':state,'child':child,'errors':errors};assert not errors and state['ready']=='true',row
   out['runs'].append(row);args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(json.dumps(out,indent=2)+'\n');print(profile,n+1,round(row['entryMs']),state['canvas'],flush=True);page.close();browser.close()
server.shutdown()
