#!/usr/bin/env python3
"""Repeatable local Chromium rendering probe. Requires Python Playwright + Chromium.

No production telemetry is injected on disk. The local server instruments render()
in memory. Timings describe this machine (SwiftShader), not a physical phone/GPU.
"""
import argparse
import gzip
import json
import mimetypes
import statistics
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

HOOK = """window.__benchStage=graphics;
const originalRender=renderer.render.bind(renderer);
renderer.render=(...args)=>{const start=performance.now();originalRender(...args);
 const b=window.__bench;if(b)b.renders.push({at:start,ms:performance.now()-start,
 calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});};"""
ANCHOR='graphics={T,renderer,scene,camera,key,rim,fill,floor,root,colorDark,colorLight,focus,position,environment,computer,reveal};'
INIT="""window.__bench={frames:[],tasks:[],renders:[],lcp:[],events:[],losses:0};
window.__taskObserver=new PerformanceObserver(l=>__bench.tasks.push(...l.getEntries().map(e=>({at:e.startTime,ms:e.duration}))));
__taskObserver.observe({type:'longtask',buffered:true});
new PerformanceObserver(l=>__bench.lcp.push(...l.getEntries().map(e=>e.startTime))).observe({type:'largest-contentful-paint',buffered:true});
new PerformanceObserver(l=>__bench.events.push(...l.getEntries().filter(e=>e.interactionId).map(e=>({at:e.startTime,ms:e.duration})))).observe({type:'event',buffered:true,durationThreshold:16});
addEventListener('webglcontextlost',()=>__bench.losses++,true);
let last=0;function frame(t){if(last)__bench.frames.push({at:t,ms:t-last});last=t;requestAnimationFrame(frame);}requestAnimationFrame(frame);
"""

def main():
 ap=argparse.ArgumentParser(description=__doc__)
 ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
 ap.add_argument('--out',type=Path,required=True)
 ap.add_argument('--profiles',default='desktop,mobile')
 ap.add_argument('--runs',type=int,default=3)
 args=ap.parse_args(); root=args.root.resolve()
 class Handler(BaseHTTPRequestHandler):
  def log_message(self,*_): pass
  def do_GET(self):
   path=root/self.path.split('?')[0].lstrip('/')
   if path.is_dir(): path=path/'index.html'
   if not path.resolve().is_relative_to(root) or not path.is_file(): self.send_error(404);return
   data=path.read_bytes()
   if path.name=='index.html' and path.parent==root:
    s=data.decode()
    if 'const payload = ' in s:
     start=s.index('const payload = ')+len('const payload = ')
     payload,end=json.JSONDecoder().raw_decode(s[start:])
     payload['modules']['inside/study']=payload['modules']['inside/study'].replace(ANCHOR,ANCHOR+HOOK)
     s=s[:start]+json.dumps(payload,ensure_ascii=False)+s[start+end:]
    data=s.encode()
   elif path.name=='study.js' and path.parent.name=='inside':
    data=data.decode().replace(ANCHOR,ANCHOR+HOOK).encode()
   mime=mimetypes.guess_type(path)[0] or 'application/octet-stream'
   if mime.startswith('text/') or mime in ['application/javascript','application/json']: data=gzip.compress(data)
   else: mime=mime+';binary'
   self.send_response(200);self.send_header('Content-Type',mime.split(';')[0]);self.send_header('Cache-Control','no-store')
   if not mime.endswith(';binary'):self.send_header('Content-Encoding','gzip')
   self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
 server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
 threading.Thread(target=server.serve_forever,daemon=True).start()
 base=f'http://127.0.0.1:{server.server_port}/index.html'
 output={'method':{'version':2,'drain':'Two animation frames, then a timer and observer.takeRecords() before snapshot','browser':'Chromium / SwiftShader','network':'localhost gzip; no network RTT claim','cpuThrottle':1,'frames':'rAF intervals including idle; not GPU execution time','renderMs':'CPU submission time; GPU work may be asynchronous','heap':'CDP JS heap only, excludes GPU/native/decoded image memory','profiles':{'desktop':[1440,900,1],'mobile':[390,844,3]}},'runs':[]}
 args.out.parent.mkdir(parents=True,exist_ok=True)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
  output['browserVersion']=browser.version
  for profile in args.profiles.split(','):
   for run in range(args.runs):
    mobile=profile=='mobile';page=browser.new_page(viewport={'width':390 if mobile else 1440,'height':844 if mobile else 900},device_scale_factor=3 if mobile else 1,is_mobile=mobile,has_touch=mobile)
    page.add_init_script(INIT);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    cdp=page.context.new_cdp_session(page);cdp.send('Performance.enable')
    record={'profile':profile,'run':run+1,'phases':{},'errors':errors}
    def snapshot(name,start):
     # PerformanceObserver delivery is asynchronous. A timer alone can run
     # before the render's long-task entry or its delayed frame is delivered.
     page.evaluate('''()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,0))))''')
     data=page.evaluate('''start=>{const b=__bench,g=window.__benchStage;
      b.tasks.push(...__taskObserver.takeRecords().map(e=>({at:e.startTime,ms:e.duration})));
      const take=k=>b[k].filter(e=>e.at>=start);const textures=new Map();
      for(const scene of [g?.scene,g?.reveal?.scene])scene?.traverse(o=>{for(const m of [o.material].flat().filter(Boolean))for(const t of Object.values(m))if(t?.isTexture&&!t.isRenderTargetTexture)textures.set(t.uuid,(t.image?.width||0)*(t.image?.height||0));});
      return {durationMs:performance.now()-start,frames:take('frames'),tasks:take('tasks'),renders:take('renders'),events:take('events'),losses:b.losses,lcpMs:b.lcp.at(-1)||null,resourceBytes:performance.getEntriesByType('resource').filter(e=>!e.name.startsWith('data:')&&!e.name.startsWith('blob:')).reduce((n,e)=>n+e.encodedBodySize,0)+performance.getEntriesByType('navigation')[0].encodedBodySize,
      canvas:g?[g.renderer.domElement.width,g.renderer.domElement.height]:null,target:g?[g.reveal.target.width,g.reveal.target.height,g.reveal.target.samples]:null,rendererMemory:g?g.renderer.info.memory:null,retainedSceneTexturePixels:[...textures.values()].reduce((a,b)=>a+b,0)};}''',start)
     for key in ['frames','renders','events']:
      samples=data.pop(key);values=sorted(e['ms'] for e in samples)
      data[key]={'n':len(values),'p50Ms':round(statistics.median(values),2) if values else None,'p95Ms':round(values[min(len(values)-1,int(len(values)*.95))],2) if values else None,'maxMs':round(max(values),2) if values else None}
      if key=='frames':data[key]['over50ms']=sum(v>50 for v in values)
      if key=='renders':data[key].update(maxCalls=max((e['calls'] for e in samples),default=0),maxTriangles=max((e['triangles'] for e in samples),default=0))
     tasks=data.pop('tasks');data['longTasks']={'n':len(tasks),'totalMs':sum(e['ms'] for e in tasks),'maxMs':max((e['ms'] for e in tasks),default=0),'blockingMs':sum(max(0,e['ms']-50) for e in tasks)}
     metrics={e['name']:e['value'] for e in cdp.send('Performance.getMetrics')['metrics']};data['jsHeapBytes']=metrics.get('JSHeapUsedSize');data['dom']=cdp.send('Memory.getDOMCounters')
     record['phases'][name]=data;print(profile,run+1,name,'p95',data['frames']['p95Ms'],'longtask',data['longTasks']['maxMs'],'calls',data['renders']['maxCalls'],flush=True)
     return data
    try:
     page.goto(base,wait_until='domcontentloaded',timeout=120000)
     page.wait_for_function("document.body.classList.contains('ready')",timeout=120000)
     record['readyMs']=page.evaluate('performance.now()');page.wait_for_timeout(1900);snapshot('initial',0)
     page.evaluate("scrollTo(0,(document.querySelector('#sequence').offsetHeight-innerHeight)*.92)");page.wait_for_timeout(2200)
     start=page.evaluate('performance.now()');page.evaluate("scrollTo(0,document.querySelector('#sequence').offsetHeight-innerHeight)");page.wait_for_timeout(2500);snapshot('monitor',start)
     page.evaluate("location.hash='wiki'");page.wait_for_timeout(300)
     start=page.evaluate('performance.now()');page.evaluate("location.hash='map/group/compute'");page.wait_for_timeout(2300);snapshot('relationship',start)
     start=page.evaluate('performance.now()');page.evaluate("location.hash='map/group/network'");page.wait_for_timeout(2300);snapshot('relationship-network',start)
     start=page.evaluate('performance.now()');page.evaluate("location.hash='story/game/0'");page.wait_for_timeout(1500)
     for fraction in [.15,.4,.7]:
      page.evaluate("p=>scrollTo(0,(document.querySelector('#story-sequence').offsetHeight-innerHeight)*p)",fraction);page.wait_for_timeout(800)
     snapshot('scenario-game',start)
     start=page.evaluate('performance.now()');page.evaluate("location.hash='story/save/0'");page.wait_for_timeout(1000)
     page.evaluate("scrollTo(0,(document.querySelector('#story-sequence').offsetHeight-innerHeight)*.45)");page.wait_for_timeout(1600);snapshot('scenario-save',start)
     if run==0:page.screenshot(type='jpeg',quality=80,path=str(args.out.with_name(f'{args.out.stem}-{profile}.jpg')))
    except Exception as e:record['failure']=str(e);print('FAIL',str(e),flush=True)
    finally:
     output['runs'].append(record);args.out.write_text(json.dumps(output,ensure_ascii=False,indent=2));page.close()
  browser.close()
 server.shutdown()
 if any(r.get('failure') or r['errors'] for r in output['runs']):
  raise SystemExit(1)

if __name__=='__main__':main()
