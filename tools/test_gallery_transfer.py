#!/usr/bin/env python3
"""Compare actual transition silhouettes with a wall-free pixel reference.

The test intercepts the gallery module to stop at exact animation times. It
disables wall COLOR writes for the diagnostic capture, preserving their depth
writes; an independent capture hides the walls entirely. Missing alpha pixels
therefore identify clipping, including fully transparent walls. Production code
has no test hooks. Screenshots are taken with the original wall colors restored.
"""
import argparse, base64, functools, io, json, threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
parser.add_argument('--out',type=Path,required=True)
parser.add_argument('--strict',action='store_true')
args=parser.parse_args();root=args.root.resolve();out=args.out.resolve();out.mkdir(parents=True,exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
source=(root/'lib/inside/room-study.js').read_text().replace('function wake(){','function wake(){if(window.__freeze)return;')+'''
window.__freeze=true;
window.__sample=t=>{tick(transitionAt+t*(view==='exiting'?2300:2200));};
window.__exit=panned=>{if(panned){pan={x:.18,y:.08};tick(performance.now());}return exitRoom();};
window.__pixels=()=>{
 const walls=roomScene.children.filter(m=>m.userData.wall);
 walls.forEach(w=>w.material.colorWrite=false);drawScene();const actual=renderer.domElement.toDataURL();
 roomScene.visible=false;drawScene();const reference=renderer.domElement.toDataURL();
 roomScene.visible=true;walls.forEach(w=>w.material.colorWrite=true);drawScene();
 return{actual,reference,drawCalls:renderer.info.render.calls};
};
'''
rects="""es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};})"""
key_state="""card=>[...card.querySelectorAll('.action-key')].map(key=>{
 const cap=key.querySelector('.keycap')||key,face=key.querySelector('.key-face')||key.querySelectorAll('rect')[1],halo=key.querySelector('.key-halo');
 return{key:key.dataset.key,transform:getComputedStyle(cap).transform,fill:getComputedStyle(face).fill,halo:halo?Number(getComputedStyle(halo).opacity):0};
})"""
checks=[];errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 for profile,width,height in [('desktop',1440,900),('mobile',390,844)]:
  page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=profile=='mobile',has_touch=profile=='mobile')
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/lib/inside/room-study.js*',lambda r:r.fulfill(body=source,content_type='text/javascript'))
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html#wiki')
  page.wait_for_selector('#wiki-hardware img')
  for scroll in [0,650]:
   page.evaluate('(y)=>scrollTo(0,y)',scroll);page.wait_for_timeout(100)
   before=page.locator('#wiki-hardware figure').evaluate_all(rects)
   page.locator('[data-wiki-tab=map]').evaluate('b=>b.click()')
   page.wait_for_selector('#relationship-room-frame');frame=page.frames[-1]
   frame.wait_for_function("document.body.dataset.mode==='entering-room'",timeout=30000)
   for phase in ['entry','exit']:
    if phase=='exit':frame.evaluate('async()=>{__sample(1);await __exit('+str(scroll>0).lower()+')}')
    for t in [0,.2,.4,.6,.8,.95]:
     frame.evaluate('__sample',t)
     if scroll==0 and ((phase=='entry' and t==.6) or (phase=='exit' and t==.4)):
      page.screenshot(path=str(out/f'{profile}-{phase}.png'))
     pair=frame.evaluate('__pixels()')
     images=[Image.open(io.BytesIO(base64.b64decode(pair[k].split(',')[1]))).getchannel('A') for k in ['actual','reference']]
     diff=ImageChops.subtract(images[1],images[0])
     lost=sum(n for i,n in enumerate(diff.histogram()) if i>32)
     expected=sum(n for i,n in enumerate(images[1].histogram()) if i>32)
     checks.append(dict(profile=profile,scroll=scroll,phase=phase,t=t,clippedPixels=lost,referencePixels=expected,modelDrawCalls=pair['drawCalls']))
   frame.evaluate('__sample(1)');page.wait_for_selector('#relationship-room-frame',state='detached')
   page.wait_for_function("location.hash==='#wiki'");page.wait_for_timeout(100)
   after=page.locator('#wiki-hardware figure').evaluate_all(rects)
   drift=max(abs(a[k]-b[k]) for a,b in zip(before,after) for k in a)
   checks.append(dict(profile=profile,scroll=scroll,listReturnMaxDriftPx=drift))
  page.locator('[data-wiki-tab=stories]').click()
  assert page.locator('#wiki-stories .story-keyboard').count()==3
  for scenario in ['typing','save','sleep']:
   card=page.locator(f'#wiki-stories [data-scenario={scenario}]')
   card.scroll_into_view_if_needed();page.mouse.move(0,0);page.locator(':focus').evaluate_all('es=>es.forEach(e=>e.blur())');page.wait_for_timeout(700)
   idle=card.evaluate(key_state);rods=card.locator('[class*=rod]').count()
   assert card.locator('[data-key]').count()==87
   if profile=='desktop':card.hover()
   else:
    page.keyboard.press('Tab');card.focus() # Real keyboard input enables :focus-visible on touch devices.
   page.wait_for_timeout(750);pressed=card.evaluate(key_state)
   card.locator('.story-cover').screenshot(path=str(out/f'{profile}-{scenario}-pressed.png'))
   page.mouse.move(0,0);card.evaluate('e=>e.blur()');page.wait_for_timeout(700)
   released=card.evaluate(key_state)
   checks.append(dict(profile=profile,scenario=scenario,rods=rods,keys=87,idle=idle,pressed=pressed,released=released))
  page.emulate_media(reduced_motion='reduce')
  card=page.locator('#wiki-stories [data-scenario=typing]');page.keyboard.press('Tab');card.focus();page.wait_for_timeout(50)
  animations=card.evaluate('e=>e.getAnimations({subtree:true}).length')
  checks.append(dict(profile=profile,reducedMotionAnimations=animations,reducedMotionKeys=card.evaluate(key_state)))
  page.close()
 browser.close()
server.shutdown()
report={'source':str(root),'checks':checks,'pageErrors':errors}
(out/'checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
summary={'sampledFrames':sum('clippedPixels' in c for c in checks),'maxClippedPixels':max(c.get('clippedPixels',0) for c in checks),'maxListDriftPx':max(c.get('listReturnMaxDriftPx',0) for c in checks),'pageErrors':errors}
print(json.dumps(summary,indent=2))
assert not errors,errors
if args.strict:
 for c in checks:
  if 'clippedPixels' in c:assert c['clippedPixels']==0 and c['referencePixels']>0,c
  if 'listReturnMaxDriftPx' in c:assert c['listReturnMaxDriftPx']<1,c
  if 'scenario' in c:
   assert c['rods']==0 and c['idle']==c['released'],c
   assert sorted(k['key'] for k in c['pressed'])==(['Ctrl','S'] if c['scenario']=='save' else ['A']),c
   assert all(k['transform']=='matrix(1, 0, 0, 1, 0, 4)' and k['halo']==1 and k['fill']=='rgb(255, 227, 160)' for k in c['pressed']),c
  if 'reducedMotionAnimations' in c:assert c['reducedMotionAnimations']==0 and c['reducedMotionKeys'][0]['halo']==1,c
