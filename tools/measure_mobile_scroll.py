#!/usr/bin/env python3
"""Native Chrome touch gestures: scene velocity, queued travel, frames and errors."""
import argparse, functools, json, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ap=argparse.ArgumentParser()
ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
ap.add_argument('--out',type=Path,required=True)
ap.add_argument('--rate',type=float)
ap.add_argument('--strict',action='store_true')
ap.add_argument('--quick',action='store_true')
ap.add_argument('--scenes',nargs='+',default=['film','boot','typing'])
ap.add_argument('--gestures',nargs='+',default=['gentle','strong','momentum-burst','reverse'])
args=ap.parse_args();root=args.root.resolve();args.out.parent.mkdir(parents=True,exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
 def copyfile(self,source,outputfile):
  try:super().copyfile(source,outputfile)
  except (BrokenPipeError,ConnectionResetError):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/index.html'
result={'root':str(root),'rate':args.rate,'profile':{'width':390,'height':844,'dpr':3},'runs':[],'errors':[]}
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True)
 page.on('pageerror',lambda e:result['errors'].append(str(e)))
 source=(root/'lib/inside/study.js').read_text()+"\nwindow.__filmProbe=()=>({progress,target,clock:lastTime,computerComplete,paced:typeof scrollPacer!=='undefined'&&scrollPacer.active});window.__resetFilmScroll=()=>{if(typeof scrollPacer!=='undefined')scrollPacer.reset();};"
 source=source.replace('  pointer.x=mix(',"  if(window.__record)__rendered.push({t:time,p:progress,target,dt,paced:typeof scrollPacer!=='undefined'&&scrollPacer.active});\n  pointer.x=mix(")
 page.route('**/lib/inside/study.js*',lambda r:r.fulfill(body=source,content_type='text/javascript'))
 source_site=(root/'lib/inside/site.js').read_text()+"\nwindow.__story=film;"
 page.route('**/lib/inside/site.js*',lambda r:r.fulfill(body=source_site,content_type='text/javascript'))
 scenario=(root/'lib/inside/scenario-film.js').read_text().replace('  if(!moving)this.progress=goal;',"  if(!moving)this.progress=goal;if(window.__record)__rendered.push({t:now,p:this.progress,target:this.target,dt,paced:!!this.scrollPacer?.active});")
 page.route('**/lib/inside/scenario-film.js*',lambda r:r.fulfill(body=scenario,content_type='text/javascript'))
 if args.rate:
  pace=(root/'lib/inside/scroll-pacing.js').read_text().replace('MOBILE_SCENES_PER_SECOND = 1;',f'MOBILE_SCENES_PER_SECOND = {args.rate};')
  page.route('**/lib/inside/scroll-pacing.js*',lambda r:r.fulfill(body=pace,content_type='text/javascript'))
 page.add_init_script('''window.__rendered=[];window.__samples=[];window.__touches=0;window.__tasks=[];
 addEventListener('pointerdown',e=>{if(e.pointerType==='touch')__touches++});
 new PerformanceObserver(l=>__tasks.push(...l.getEntries().map(e=>e.duration))).observe({type:'longtask'});
 function sample(t){if(window.__record){const f=document.body.dataset.mode==='story'?window.__story:window.__filmProbe?.();if(f)__samples.push({t,clock:f.last??f.clock,p:f.progress,target:f.target,y:scrollY,paced:!!(f.scrollPacer?.active||f.paced)});}requestAnimationFrame(sample)}requestAnimationFrame(sample);''')
 cdp=page.context.new_cdp_session(page)
 def touch(distance,duration):
  start=650 if distance>0 else 160
  steps=18 if duration>=900 else 5
  cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':370,'y':start}]})
  for i in range(1,steps+1):
   cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':370,'y':start-distance*i/steps}]})
   page.wait_for_timeout(duration/steps)
  cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 page.goto(url+'#home',wait_until='domcontentloaded');page.wait_for_function('window.__filmProbe?.().computerComplete',timeout=120000)
 for scene in (['boot'] if args.quick else args.scenes):
  if scene=='film':
   stops=page.evaluate("async()=>{const {CHAPTERS}=await import('inside/cinema-timeline');return [...CHAPTERS.map(c=>c.start),1]}")
  else:
   page.evaluate("s=>location.hash='story/'+s+'/0'",scene)
   page.wait_for_function("s=>window.__story?.id===s&&!__story.preparing&&document.body.dataset.story===s",arg=scene,timeout=120000)
   stops=page.evaluate('[...__story.config.steps.map(s=>s.at),1]')
  def position(p):
   for i,b in enumerate(stops[1:]):
    if p<b:return i+(p-stops[i])/(b-stops[i])
   return len(stops)-1
  for name,distance,speed in ([('strong',590,60)] if args.quick else [('gentle',360,1000),('strong',590,60),('momentum-burst',590,60),('reverse',590,60)]):
   if name not in args.gestures:continue
   page.evaluate("s=>{if(s==='film'){__resetFilmScroll();scrollTo(0,(document.querySelector('#sequence').offsetHeight-innerHeight)*.31)}else __story.seek(.32,true)}",scene)
   page.wait_for_function("s=>{const f=s==='film'?__filmProbe():__story;return Math.abs(f.target-(s==='film'?.31:.32))<.0001&&Math.abs(f.progress-f.target)<.00003}",arg=scene,timeout=30000)
   page.wait_for_timeout(250)
   page.evaluate('__rendered=[];__samples=[];__tasks=[];__touches=0;__record=true')
   page.wait_for_timeout(50)
   touch(distance,speed)
   if name=='momentum-burst':page.evaluate('scrollBy(0,3000)')
   if name=='reverse':
    page.wait_for_timeout(180)
    page.evaluate('window.__reverseAt=performance.now();window.__reverseProgress=__samples.at(-1).p')
    touch(-480,240)
   page.wait_for_timeout(2000)
   page.wait_for_function("s=>{const f=s==='film'?__filmProbe():__story;return Math.abs(f.progress-f.target)<.00003}",arg=scene,timeout=30000)
   data=page.evaluate('()=>{__record=false;return {rendered:__rendered,samples:__samples,tasks:__tasks,touches:__touches,reverseAt:window.__reverseAt,reverseProgress:window.__reverseProgress}}')
   samples=data['rendered'];frames=[b['t']-a['t'] for a,b in zip(data['samples'],data['samples'][1:])]
   velocities=[abs(position(b['p'])-position(a['p']))/((b['t']-a['t'])/1000) for a,b in zip(samples,samples[1:]) if b['t']>a['t']]
   run={'scene':scene,'gesture':name,'touches':data['touches'],'paced':any(s['paced'] for s in samples),'maxScenesPerSecond':max(velocities),'maxFrameSceneDelta':max(abs(position(b['p'])-position(a['p'])) for a,b in zip(samples,samples[1:])),'maxQueuedScenes':max(abs(position(s['target'])-position(s['p'])) for s in samples),'travelScenes':position(samples[-1]['p'])-position(samples[0]['p']),'endGapScenes':abs(position(samples[-1]['target'])-position(samples[-1]['p'])),'frameP95Ms':sorted(frames)[int(len(frames)*.95)],'longTasks':len(data['tasks']),'maxLongTaskMs':max(data['tasks'],default=0)}
   if name=='reverse':run['reversed']=samples[-1]['p']<data['reverseProgress']
   if args.strict and (run['maxScenesPerSecond']>1.02 or run['maxFrameSceneDelta']>.0501):args.out.with_suffix('.trace.json').write_text(json.dumps(samples))
   result['runs'].append(run);args.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(run),flush=True)
   assert abs(run['travelScenes'])>.005 or name=='reverse', 'Input did not scroll'
   if args.strict:
    assert run['touches']>0 and run['paced'],run
    assert run['maxScenesPerSecond']<=(args.rate or 1)+.02,run
    assert run['maxFrameSceneDelta']<=(args.rate or 1)*.05+.0001,run
    assert run['maxQueuedScenes']<=.751,run
    assert run['endGapScenes']<.003,run
    if name=='reverse':assert run['reversed'],run
  if not args.quick:page.screenshot(path=str(args.out.with_name(args.out.stem+'-'+scene+'.png')))
 result['removedCopy']=page.evaluate("()=>({ending:!document.querySelector('#ending p'),top:!document.querySelector('.wiki-top .micro'),subtitle:!document.querySelector('.wiki-heading p'),covers:!document.querySelector('.cover-status'),kicker:!document.querySelector('#story-kicker')})")
 if args.strict:assert all(result['removedCopy'].values()),result['removedCopy']
 browser.close()
server.shutdown();args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
assert not result['errors'],result['errors']
