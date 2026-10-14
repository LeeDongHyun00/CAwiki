"""Regression: continuous held input, overflow reversal and mixed input sources."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os
root=Path(__file__).resolve().parents[1]
base=os.environ.get('TEST_BASE_URL','http://127.0.0.1:4173')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 errors=[];results=[];page.on('pageerror',lambda e:errors.append(str(e)))
 source=(root/'lib/inside/site.js').read_text()+'\nwindow.__story=film;'
 page.route('**/lib/inside/site.js*',lambda r:r.fulfill(body=source,content_type='text/javascript'))
 page.add_init_script('''window.__writes=[];window.__record=false;const native=scrollTo;window.scrollTo=(...args)=>{if(__record)__writes.push({held:__story.touching,args});return native(...args)};''')
 page.goto(base+'/index.html#story/boot/0')
 page.wait_for_function('window.__story?.active&&!__story.preparing',timeout=120000)
 page.wait_for_function("!document.querySelector('.scene-exposure')",timeout=120000)
 cdp=page.context.new_cdp_session(page)
 def touch(t,y=500,x=360):cdp.send('Input.dispatchTouchEvent',{'type':t,'touchPoints':[] if t=='touchEnd' else [{'x':x,'y':y}]})
 def settle():
  page.wait_for_function('!__story.scrollPacer.active&&Math.abs(__story.progress-__story.target)<.00003',timeout=15000)
 def start(at=.2):
  page.evaluate('p=>{__record=false;__story.seek(p,true)}',at);page.wait_for_timeout(200)
  page.evaluate('__writes=[];__record=true');touch('touchStart')
 for direction in [1,-1]:
  start(.2 if direction==1 else .8)
  origin=page.evaluate('__story.scrollPacer.position(__story.progress)')
  # Keep the same contact down while moving through multiple scenes.
  trace=[]
  for i in range(8):
   page.evaluate('d=>scrollBy(0,d*260)',direction);page.wait_for_timeout(220)
   trace.append(page.evaluate('({p:__story.progress,t:__story.target,q:__story.scrollPacer.position(__story.target),y:scrollY})'))
  assert (trace[-1]['q']-origin)*direction>1.3,trace
  assert all((bb['t']-a['t'])*direction>0 for a,bb in zip(trace,trace[1:])),trace
  # Force excess input, then reverse only a few pixels without lifting.
  page.evaluate('d=>scrollBy(0,d*2400)',direction);page.wait_for_timeout(80)
  page.evaluate('d=>{window.__reverseFrom=__story.progress;scrollBy(0,-d*25)}',direction)
  page.wait_for_timeout(100)
  assert page.evaluate('d=>(__story.target-__reverseFrom)*d<0',direction)
  assert not page.evaluate('__writes.some(w=>w.held)')
  touch('touchEnd');settle()
  assert page.evaluate('Math.abs(scrollY-__story.target*__story.distance())<=1.1')
  results.append({'case':'continuous-and-reverse','direction':direction,'sceneTravel':round(abs(trace[-1]['q']-origin),3)})
 # Real browser-native touch events, not injected scroll deltas.
 start(.3)
 touch('touchMove',700)
 for y in range(650,149,-50):touch('touchMove',y);page.wait_for_timeout(30)
 touch('touchEnd');settle()
 assert page.evaluate('__story.progress>.32')
 results.append({'case':'native-touch','passed':True})
 # A wheel or mouse drag can interrupt the 500ms release immediately.
 for kind in ['wheel','mouse']:
  start(.35);page.evaluate('scrollBy(0,400)');page.wait_for_timeout(60);touch('touchEnd')
  before=page.evaluate('__story.progress')
  if kind=='wheel':
   page.mouse.move(360,480);page.mouse.wheel(0,240)
  else:
   page.mouse.move(360,480);page.mouse.down();page.mouse.move(360,380,steps=4);page.mouse.up()
  page.wait_for_timeout(1000)
  assert page.evaluate('!__story.scrollPacer.active')
  assert page.evaluate('__story.target')>before+.01,(kind,before,page.evaluate('__story.target'))
  results.append({'case':kind+'-interrupts-release','passed':True})
 # Vertical touch over the chapter rail also starts fresh input.
 page.evaluate('__story.seek(.3,true)');page.wait_for_timeout(200)
 box=page.locator('#story-track').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
 touch('touchStart',y,x)
 assert page.evaluate('__story.touching&&__story.scrollPacer.active')
 touch('touchMove',y-60,x);touch('touchEnd');settle()
 results.append({'case':'chapter-rail-touch','passed':True})
 assert not errors,errors
 output={'runs':results,'errors':errors}
 (root/'docs/performance/input-stability/continuous-drag.json').write_text(json.dumps(output,indent=2))
 print(json.dumps(output),flush=True);b.close()
