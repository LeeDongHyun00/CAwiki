"""Real touch input plus deterministic large native-scroll bursts on all stories."""
from pathlib import Path
import json,sys
EDGES_ONLY="--edges-only" in sys.argv
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/performance/input-stability';OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);errors=[];results=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 site=(ROOT/'lib/inside/site.js').read_text()+'\nwindow.__story=film;'
 page.route('**/lib/inside/site.js*',lambda r:r.fulfill(body=site,content_type='text/javascript'))
 page.add_init_script('''window.__nativeScrollTo=scrollTo;window.__writes=[];window.__trace=[];window.__record=false;
 window.scrollTo=(...args)=>{if(__record)__writes.push({t:performance.now(),holding:__story.touching,args});return __nativeScrollTo(...args)};
 function sample(t){if(__record&&window.__story){const f=__story;__trace.push({t,p:f.progress,q:f.scrollPacer.position(f.progress),target:f.scrollPacer.position(f.target),y:scrollY});}requestAnimationFrame(sample)}requestAnimationFrame(sample);''')
 page.goto('http://127.0.0.1:4173/index.html#story/boot/0')
 cdp=page.context.new_cdp_session(page)
 def down(y):cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':360,'y':y}]})
 def up():cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 def ready():
  page.wait_for_function('window.__story?.active&&!__story.preparing',timeout=120000)
  page.wait_for_function("!document.querySelector('.scene-exposure')",timeout=120000)
 def settle():page.wait_for_function('Math.abs(__story.progress-__story.target)<.00003',timeout=30000);page.wait_for_timeout(250)
 def start():
  page.evaluate('__record=false;__story.seek(.4,true)');page.wait_for_timeout(150)
  page.evaluate('__writes=[];__trace=[];__record=true')
 def report(name,direction):
  data=page.evaluate('({trace:__trace,writes:__writes,anchor:__story.scrollPacer.anchor})')
  trace=data['trace'];assert len(trace)>3
  travel=max(abs(f['q']-data['anchor']) for f in trace)
  target=max(abs(f['target']-data['anchor']) for f in trace)
  reversals=sum((bb['p']-a['p'])*direction<-.000001 for a,bb in zip(trace,trace[1:]))
  assert travel<=1.00001 and target<=1.00001,(name,travel,target)
  assert reversals==0,(name,reversals)
  assert not any(w['holding'] for w in data['writes']),(name,data['writes'])
  result={'name':name,'frames':len(trace),'maxTravelScenes':travel,'maxTargetScenes':target,'reversals':reversals,'scrollWrites':len(data['writes'])};results.append(result);print(json.dumps(result),flush=True)
  page.evaluate('__record=false')

 ready()
 # Browser-native fast swipes in both directions; no programmatic input.
 for story in ([] if EDGES_ONLY else ['boot','typing']):
  page.evaluate('s=>location.hash="story/"+s+"/0"',story);page.wait_for_function('s=>__story.id===s&&!__story.preparing',arg=story,timeout=120000);ready()
  for direction in [1,-1]:
   start();y=720 if direction>0 else 130;down(y)
   for i in range(1,7):
    cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':360,'y':y-direction*95*i}]});page.wait_for_timeout(15)
   up();page.wait_for_timeout(1800);settle();report(story+'/native/'+str(direction),direction)

 stories=page.evaluate("async()=>Object.keys((await import('inside/scenario-data')).SCENARIOS)")
 if EDGES_ONLY:stories=[]
 for story in stories:
  page.evaluate('s=>location.hash="story/"+s+"/0"',story);page.wait_for_function('s=>__story.id===s&&!__story.preparing',arg=story,timeout=120000);ready()
  for direction in [1,-1]:
   start();down(500)
   # A held touch identifies one gesture. Feed a much larger native scroll
   # range than a physical screen can span, including its inertial tail.
   page.evaluate('''async direction=>{const origin=scrollY;for(let i=1;i<=10;i++){__nativeScrollTo(0,origin+direction*i*300);await new Promise(r=>setTimeout(r,25));}}''',direction)
   assert page.evaluate('__story.touching')
   before=page.evaluate('({p:__story.progress,target:__story.target})')
   resized=page.evaluate('''()=>{const before={p:__story.progress,target:__story.target};dispatchEvent(new Event('inside:resize'));return {before,after:{p:__story.progress,target:__story.target}}}''')
   assert resized['before']==resized['after'],resized
   up();settle();report(story+'/burst/'+str(direction),direction)
   assert page.evaluate('Math.abs(scrollY-__story.target*__story.distance())<=1.1')

 # Landscape phones still cap touch gestures, including multi-touch and
 # real address-bar height changes before the gesture finishes.
 page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(100)
 start();down(250);assert page.evaluate('__story.scrollPacer.active')
 page.evaluate('__nativeScrollTo(0,scrollY+2800)');page.wait_for_timeout(100)
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':360,'y':250},{'x':200,'y':250}]})
 page.set_viewport_size({'width':844,'height':360});page.wait_for_timeout(220)
 assert page.evaluate('__story.touching')
 up();settle();report('landscape/multitouch/resize',1)
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100)
 # A new drag must reverse immediately while the previous target is pending.
 start();down(500);page.evaluate('__nativeScrollTo(0,scrollY+2400)');page.wait_for_timeout(80);up();down(500)
 initial=page.evaluate('({p:__story.progress,target:__story.target,anchor:__story.scrollPacer.anchor})')
 assert initial['p']==initial['target']
 page.evaluate('__nativeScrollTo(0,scrollY-800)');page.wait_for_timeout(100);up();settle()
 assert page.evaluate('__story.progress')<initial['p']
 page.evaluate('__record=false')
 # Event timestamps older than the last wake must never advance backward.
 assert page.evaluate('''()=>{const f=__story;cancelAnimationFrame(f.frame);f.frame=0;f.target=f.progress-.01;const p=f.progress;f.tick(f.last-10);const stable=f.progress===p;cancelAnimationFrame(f.frame);f.frame=0;f.seek(p,true);return stable}''')
 page.locator('#story-why').tap();page.wait_for_selector('#story-detail[open]');page.locator('#story-detail-close').tap();page.wait_for_selector('#story-detail',state='hidden')
 page.locator('#story-track button').last.click();page.wait_for_function('__story.progress===1')
 page.locator('#story-restart').click();page.wait_for_function('__story.progress===0')
 page.emulate_media(reduced_motion='reduce');assert not page.evaluate('__story.scrollPacer.active')
 page.locator('#story-track button').last.click();page.wait_for_function('__story.progress===1')
 assert not errors,errors
 (OUT/('scenario-gesture-edges.json' if EDGES_ONLY else 'scenario-gestures.json')).write_text(json.dumps({'runs':results,'stories':len(stories),'quickReverse':True,'negativeFrameDelta':True,'popupAndNavigation':True,'errors':errors},indent=2))
 print('All scenario gestures / resize / quick reversal / timestamp / popup / explicit navigation PASS',flush=True);b.close()
