#!/usr/bin/env python3
"""Version 1: current spatial iframe, film and entry transitions; local SwiftShader only."""
import argparse,gzip,json,mimetypes,statistics,threading
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
INIT="""window.__probe={tasks:[],frames:[],renders:[],lcp:[],losses:0};
const obs=new PerformanceObserver(l=>__probe.tasks.push(...l.getEntries().map(e=>({at:e.startTime,ms:e.duration}))));obs.observe({type:'longtask',buffered:true});window.__probeObserver=obs;
let last=0;function raf(t){if(last)__probe.frames.push(t-last);last=t;requestAnimationFrame(raf)}requestAnimationFrame(raf);
new PerformanceObserver(l=>__probe.lcp.push(...l.getEntries().map(e=>({at:e.startTime,size:e.size,element:e.element?.id})))).observe({type:'largest-contentful-paint',buffered:true});
addEventListener('webglcontextlost',()=>__probe.losses++,true);"""
HOOK="""window.__probeRenderer=renderer;const renderOriginal=renderer.render.bind(renderer);renderer.render=(...args)=>{let t=performance.now();renderOriginal(...args);__probe.renders.push({ms:performance.now()-t,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});};"""
def instrument(name,source):
 if name.endswith('room-study'):
  return source.replace('renderer.toneMappingExposure=1.12;', 'renderer.toneMappingExposure=1.12;'+HOOK)
 if name.endswith('study'):
  return source.replace('renderer.toneMappingExposure = 1.12;', 'renderer.toneMappingExposure = 1.12;'+HOOK)
 return source

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);ap.add_argument('--out',type=Path,required=True);ap.add_argument('--runs',type=int,default=3);ap.add_argument('--profiles',default='desktop,mobile');args=ap.parse_args();root=args.root.resolve()
 class Handler(BaseHTTPRequestHandler):
  def log_message(self,*_):pass
  def do_GET(self):
   path=root/self.path.split('?')[0].lstrip('/');path=path/'index.html' if path.is_dir() else path
   if not path.resolve().is_relative_to(root) or not path.is_file():self.send_error(404);return
   data=path.read_bytes();mime=mimetypes.guess_type(path)[0] or 'application/octet-stream'
   if path.suffix=='.html':
    s=data.decode()
    if 'const payload = ' in s:
     start=s.index('const payload = ')+len('const payload = ');payload,end=json.JSONDecoder().raw_decode(s[start:])
     for name in payload['modules']:payload['modules'][name]=instrument(name,payload['modules'][name])
     s=s[:start]+json.dumps(payload,ensure_ascii=False)+s[start+end:]
    data=s.encode()
   elif path.parent.name=='inside' and path.suffix=='.js':data=instrument(path.stem,data.decode()).encode()
   compressed=mime.startswith('text/') or mime in ('application/javascript','application/json')
   if compressed:data=gzip.compress(data)
   self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(data)))
   if compressed:self.send_header('Content-Encoding','gzip')
   self.end_headers()
   try:self.wfile.write(data)
   except (BrokenPipeError,ConnectionResetError):pass
 server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/index.html'
 out={'method':{'version':3,'gpu':'SwiftShader','network':'localhost gzip no-store','cpuThrottle':1,'desktop':[1440,900,1],'mobile':[390,844,3],'frameMeaning':'rAF interval including idle, not GPU time','heapMeaning':'JS only; not GPU/native RAM'},'runs':[]};args.out.parent.mkdir(parents=True,exist_ok=True)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader']);out['browserVersion']=browser.version
  for profile in args.profiles.split(','):
   for i in range(args.runs):
    mobile=profile=='mobile';page=browser.new_page(viewport={'width':390 if mobile else 1440,'height':844 if mobile else 900},device_scale_factor=3 if mobile else 1,is_mobile=mobile,has_touch=mobile);page.add_init_script(INIT);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));record={'profile':profile,'run':i+1,'phases':{},'errors':errors};cdp=page.context.new_cdp_session(page);cdp.send('Performance.enable')
    def reset(context):context.evaluate('()=>{__probe.tasks=[];__probe.frames=[];__probe.renders=[];__probeObserver.takeRecords();}')
    def sample(name,context,start):
     context.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,0))))')
     d=context.evaluate('''()=>{__probe.tasks.push(...__probeObserver.takeRecords().map(e=>({at:e.startTime,ms:e.duration})));let r=window.__probeRenderer;return {...__probe,at:performance.now(),canvas:r?[r.domElement.width,r.domElement.height]:null,memory:r?{...r.info.memory}:null,encodedBytes:performance.getEntriesByType('resource').reduce((s,e)=>s+e.encodedBodySize,0)+performance.getEntriesByType('navigation')[0].encodedBodySize,marks:performance.getEntriesByType('mark').map(e=>({name:e.name,at:e.startTime}))}}''')
     values=sorted(d.pop('frames'));d['frameP95Ms']=values[min(len(values)-1,int(len(values)*.95))] if values else None
     tasks=d.pop('tasks');d['longTasks']={'n':len(tasks),'maxMs':max((e['ms'] for e in tasks),default=0),'blockingMs':sum(max(0,e['ms']-50) for e in tasks)}
     renders=d.pop('renders');d['renders']={'n':len(renders),'maxCalls':max((e['calls'] for e in renders),default=0),'maxTriangles':max((e['triangles'] for e in renders),default=0)}
     d['elapsedMs']=page.evaluate('performance.now()')-start;d['jsHeapBytes']=next(m['value'] for m in cdp.send('Performance.getMetrics')['metrics'] if m['name']=='JSHeapUsedSize');record['phases'][name]=d;print(profile,i+1,name,round(d['elapsedMs']),d['longTasks'],d['renders'],flush=True)
    try:
     page.goto(url,wait_until='domcontentloaded',timeout=120000);page.wait_for_function("document.body.classList.contains('ready')",timeout=120000);record['firstReadyMs']=page.evaluate('performance.now()');page.wait_for_timeout(1500);sample('initial',page,0)
     # Normal user reading/scrolling gives the monitor preparation lead time.
     for f in [.18,.4,.65,.88]:page.evaluate("p=>scrollTo(0,(document.querySelector('#sequence').offsetHeight-innerHeight)*p)",f);page.wait_for_timeout(700)
     reset(page);start=page.evaluate('performance.now()');page.evaluate("scrollTo(0,document.querySelector('#sequence').offsetHeight-innerHeight)");page.wait_for_function("Number(document.body.dataset.filmProgress)>.995",timeout=120000);sample('monitor',page,start)
     page.evaluate("location.hash='wiki'");page.wait_for_timeout(300);reset(page);start=page.evaluate('performance.now()');page.locator('[data-wiki-tab=map]').click();page.wait_for_selector('#relationship-room-frame',state='attached');frame=page.frames[-1];frame.wait_for_function("document.querySelector('#room')?.dataset.ready && document.body.dataset.mode==='room' && document.querySelector('#room').dataset.moving==='false'",timeout=180000);sample('room-entry',frame,start)
     for group in ['compute','network']:
      reset(frame);start=page.evaluate('performance.now()');frame.locator('[data-group="'+group+'"].room-topic').click();frame.wait_for_function("g=>document.querySelector('#room').dataset.group===g && document.querySelector('#room').dataset.moving==='false'",arg=group,timeout=120000);sample('room-'+group,frame,start)
     if i==0:page.screenshot(type='jpeg',quality=80,path=str(args.out.with_name(args.out.stem+'-'+profile+'.jpg')))
     reset(page);start=page.evaluate("()=>{const t=performance.now();location.hash='story/game/0';return t;}");page.wait_for_function("document.body.dataset.story==='game' && !document.body.classList.contains('loading')",timeout=120000);page.wait_for_timeout(700);sample('scenario-entry',page,start)
     reset(page);start=page.evaluate("()=>{const t=performance.now();location.hash='object/cpu';return t;}");page.wait_for_function("document.body.dataset.mode==='object' && !document.body.classList.contains('loading')",timeout=120000);page.wait_for_timeout(700);sample('object-entry',page,start);assert not page.evaluate("document.body.classList.contains('failed')"), 'Object fell back instead of rendering'
    except Exception as e:record['failure']=str(e);print('FAIL',profile,i+1,str(e),flush=True)
    finally:out['runs'].append(record);args.out.write_text(json.dumps(out,ensure_ascii=False,indent=2));page.close()
  browser.close()
 server.shutdown()
 if any(r.get('failure') or r['errors'] for r in out['runs']):raise SystemExit(1)
if __name__=='__main__':main()
