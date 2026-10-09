#!/usr/bin/env python3
"""Observe preparation and the actual iframe removal, including landing pixels."""
import argparse,functools,io,json,threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from PIL import Image
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);ap.add_argument('--out',type=Path,required=True);ap.add_argument('--strict',action='store_true');args=ap.parse_args()
root=args.root.resolve();out=args.out.resolve();out.mkdir(parents=True,exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/index.html'
source=(root/'lib/inside/room-study.js').read_text().replace('function wake(){','function wake(){if(window.__hold)return;')+'''
window.__hold=true;window.__sample=t=>tick(transitionAt+t*(view==='exiting'?2300:2200));window.__exit=exitRoom;
window.__returnState=()=>({view,moving,embeddedImages:document.querySelectorAll('#wiki-hardware img').length,canvasOpacity:Number(getComputedStyle(document.querySelector('#room-world')).opacity),images:items.map(i=>({id:i.id,bounds:i.bounds}))});
'''
RECTS="es=>es.map(e=>{let r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})"
STATE="""()=>{const wiki=document.querySelector('#wiki-page'),img=wiki.querySelector('img'),frame=document.querySelector('iframe');return{chrome:Number(getComputedStyle(wiki.querySelector('.wiki-heading')).opacity),image:Number(getComputedStyle(img).opacity),interactive:!wiki.inert,frameVisible:frame&&getComputedStyle(frame).visibility==='visible',preparing:wiki.classList.contains('room-preparing')}}"""
results=[];errors=[]
def contrast(reference,current):
 a=list(reference.convert('RGB').get_flattened_data());b=list(current.convert('RGB').get_flattened_data())
 pixels=[i for i,p in enumerate(a) if max(p)<160]
 assert pixels,'No opaque part pixels in reference'
 return sum(sum(max(0,236-c) for c in b[i]) for i in pixels)/sum(sum(236-c for c in a[i]) for i in pixels)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 for profile,w,h in [('desktop',1440,900),('mobile',390,844)]:
  page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1,is_mobile=profile=='mobile',has_touch=profile=='mobile');page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/lib/inside/room-study.js*',lambda r:r.fulfill(body=source,content_type='text/javascript'))
  held=[];holding=[True]
  page.route('**/room/cpu.webp*',lambda r:held.append(r) if holding[0] else r.continue_())
  page.goto(url+'#wiki');page.wait_for_function("[...document.querySelectorAll('#wiki-hardware img')].filter(i=>i.getBoundingClientRect().top<innerHeight).every(i=>i.complete&&i.naturalWidth)")
  page.mouse.move(0,0)
  start=page.locator('#wiki-hardware img').evaluate_all(RECTS);clip=start[0]
  reference=Image.open(io.BytesIO(page.screenshot(clip=clip)))
  page.evaluate("window.__originalImages=[...document.querySelectorAll('#wiki-hardware img')];document.querySelector('[data-wiki-tab=map]').click()")
  page.wait_for_timeout(80);early=page.evaluate(STATE)
  page.wait_for_timeout(1050);prepared=page.evaluate(STATE)
  prepImage=Image.open(io.BytesIO(page.screenshot(clip=clip)));page.screenshot(path=str(out/f'{profile}-preparing.png'))
  prepContrast=contrast(reference,prepImage)
  holding[0]=False
  for route in held:route.continue_()
  page.wait_for_selector('#relationship-room-frame');frame=page.frames[-1];frame.wait_for_function("document.body.dataset.mode==='entering-room'",timeout=30000)
  entryChrome=page.evaluate(STATE)['chrome'];frame.evaluate('__sample(1)')
  frame.evaluate('async()=>{await __exit()}')
  landing=[]
  for t in [.88,.90,.925,.95,.975,.99]:
   frame.evaluate('__sample',t)
   state=frame.evaluate('__returnState()');host=page.evaluate(STATE)
   pixels=Image.open(io.BytesIO(page.screenshot(clip=clip)))
   landing.append({'t':t,'contrastRatio':contrast(reference,pixels),'canvasOpacity':state['canvasOpacity'],'hostImageOpacity':host['image'],'embeddedImages':state['embeddedImages']})
   if t==.95:page.screenshot(path=str(out/f'{profile}-landing.png'))
  # Keep the pointer over the destination image. Revealing the page must not
  # start its hover zoom until the user actually moves the pointer again.
  page.mouse.move(clip['x']+clip['width']/2,clip['y']+clip['height']/2)
  frame.evaluate('__sample(1)');page.wait_for_selector('#relationship-room-frame',state='detached');page.wait_for_function("location.hash==='#wiki'")
  page.wait_for_timeout(850)
  final=page.locator('#wiki-hardware img').evaluate_all(RECTS)
  drift=max(abs(a[k]-b[k]) for a,b in zip(start,final) for k in a)
  same=page.evaluate("__originalImages.every((img,i)=>img===document.querySelectorAll('#wiki-hardware img')[i])")
  row={'profile':profile,'early':early,'preparation':prepared,'preparationPartContrast':prepContrast,'entryChrome':entryChrome,'landing':landing,'returnImageDriftPx':drift,'sameImageNodes':same}
  results.append(row)
  # A second trip from a scrolled list must use its actual viewport positions.
  page.mouse.move(0,0);page.evaluate('scrollTo(0,650)');page.wait_for_timeout(100)
  start=page.locator('#wiki-hardware figure').evaluate_all(RECTS)
  page.locator('[data-wiki-tab=map]').evaluate('b=>b.click()');page.wait_for_selector('#relationship-room-frame');frame=page.frames[-1]
  frame.wait_for_function("document.body.dataset.mode==='entering-room'");frame.evaluate('__sample(1)');frame.evaluate('async()=>{await __exit()}');frame.evaluate('__sample(.99)')
  final=page.locator('#wiki-hardware figure').evaluate_all(RECTS)
  travelDrift=max(abs(a[k]-b[k]) for a,b in zip(start,final) for k in a)
  frame.evaluate('__sample(1)');page.wait_for_selector('#relationship-room-frame',state='detached');page.wait_for_timeout(100)
  final=page.locator('#wiki-hardware figure').evaluate_all(RECTS)
  finalDrift=max(abs(a[k]-b[k]) for a,b in zip(start,final) for k in a)
  row['scrolledTravelDriftPx']=travelDrift;row['scrolledReturnDriftPx']=finalDrift
  page.close()
 browser.close()
server.shutdown();report={'checks':results,'pageErrors':errors};(out/'checks.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
assert not errors,errors
if args.strict:
 for r in results:
  assert r['early']['chrome']==1 and not r['early']['preparing'],r
  assert r['preparation']['chrome']<.05 and r['preparation']['interactive'],r
  assert .995<r['preparationPartContrast']<1.005 and r['entryChrome']<.05,r
  assert all(f['contrastRatio']>.96 and f['embeddedImages']==0 for f in r['landing']),r
  assert r['returnImageDriftPx']<1 and r['scrolledTravelDriftPx']<1 and r['scrolledReturnDriftPx']<1 and r['sameImageNodes'],r
