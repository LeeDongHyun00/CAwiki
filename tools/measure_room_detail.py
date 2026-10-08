#!/usr/bin/env python3
"""Measure CPU detail and its first relation peer, including deferred upgrades."""
import argparse,functools,json,threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);ap.add_argument('--out',type=Path,required=True);ap.add_argument('--runs',type=int,default=3);args=ap.parse_args()
root=args.root.resolve()
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start()
source=(root/'lib/inside/room-study.js').read_text()+'''
window.__detailBench={tasks:[],draws:[]};
const observer=new PerformanceObserver(l=>__detailBench.tasks.push(...l.getEntries().map(e=>e.duration)));observer.observe({type:'longtask',buffered:true});
window.__detailState=()=>({full:items.filter(i=>i.full).map(i=>i.id),moving,memory:{...renderer.info.memory},programs:renderer.info.programs.length});
window.__detailReset=()=>{__detailBench.tasks=[];__detailBench.draws=[];observer.takeRecords();return performance.now();};
window.__detailResult=()=>{__detailBench.tasks.push(...observer.takeRecords().map(e=>e.duration));return{...__detailBench,...__detailState(),at:performance.now()};};
'''
anchor='renderer.toneMappingExposure=1.12;'
assert anchor in source
source=source.replace(anchor,anchor+'''const draw=renderer.render.bind(renderer);renderer.render=(...args)=>{draw(...args);__detailBench.draws.push({...renderer.info.render});};''')
out={'method':{'gpu':'SwiftShader','network':'localhost HTTP no-store via Playwright interception','runs':args.runs,'desktop':[1440,900,1],'mobile':[390,844,3],'end':'movement finished and selected original resolution/model prepared'},'runs':[]}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader']);out['browserVersion']=browser.version
 for profile in ['desktop','mobile']:
  for i in range(args.runs):
   mobile=profile=='mobile';page=browser.new_page(viewport={'width':390 if mobile else 1440,'height':844 if mobile else 900},device_scale_factor=3 if mobile else 1,is_mobile=mobile,has_touch=mobile);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/lib/inside/room-study.js*',lambda r:r.fulfill(body=source,content_type='text/javascript'))
   page.goto(f'http://127.0.0.1:{server.server_port}/relationship-room-study.html#group/compute')
   page.wait_for_function("document.querySelector('#room').dataset.ready==='true' && !__detailState().moving",timeout=120000)
   record={'profile':profile,'run':i+1,'phases':{}}
   for phase,count in [('cpu',1),('pair',2)]:
    if phase=='pair':page.locator('[data-tab=relations]').click()
    start=page.evaluate('__detailReset()')
    page.locator('[data-hardware=cpu]' if phase=='cpu' else '.detail-peer').first.click()
    page.wait_for_function('n=>!__detailState().moving && __detailState().full.length===n',arg=count,timeout=120000)
    page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,0))))')
    d=page.evaluate('__detailResult()');tasks=d.pop('tasks');draws=d.pop('draws');d['elapsedMs']=d.pop('at')-start
    d['longTasks']={'maxMs':max(tasks,default=0),'blockingMs':sum(max(0,t-50) for t in tasks),'n':len(tasks)}
    d['render']={'maxCalls':max(x['calls'] for x in draws),'maxTriangles':max(x['triangles'] for x in draws)}
    record['phases'][phase]=d;print(profile,i+1,phase,d,flush=True)
   assert not errors,errors;out['runs'].append(record);args.out.write_text(json.dumps(out,indent=2));page.close()
 browser.close()
server.shutdown()
