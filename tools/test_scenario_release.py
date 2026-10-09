"""Measure release completion while late native inertia continues."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1];out=root/'docs/performance/input-stability'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);errors=[];results=[];page.on('pageerror',lambda e:errors.append(str(e)))
 source=(root/'lib/inside/site.js').read_text()+'\nwindow.__story=film;'
 page.route('**/lib/inside/site.js*',lambda r:r.fulfill(body=source,content_type='text/javascript'))
 film=(root/'lib/inside/scenario-film.js').read_text().replace('  if(!moving)this.progress=goal;', "  if(!moving)this.progress=goal;if(this.scrollPacer.released){const r=this.scrollPacer.released;window.__updates.push({ms:performance.now()-r.at,p:this.progress,goal:r.to});}")
 page.route('**/lib/inside/scenario-film.js*',lambda r:r.fulfill(body=film,content_type='text/javascript'))
 page.add_init_script('''window.__trace=[];window.__updates=[];function sample(){if(window.__story?.scrollPacer.released){const f=__story,r=f.scrollPacer.released;__trace.push({ms:performance.now()-r.at,p:f.progress,target:f.target,goal:r.to});}requestAnimationFrame(sample)}requestAnimationFrame(sample)''')
 page.goto('http://127.0.0.1:4173/index.html#story/boot/0');cdp=page.context.new_cdp_session(page)
 page.wait_for_function('window.__story?.active&&!__story.preparing',timeout=120000);page.wait_for_function("!document.querySelector('.scene-exposure')",timeout=120000)
 for story in ['boot','typing']:
  page.evaluate('s=>location.hash="story/"+s+"/0"',story);page.wait_for_function('s=>__story.id===s&&!__story.preparing',arg=story,timeout=120000);page.wait_for_function("!document.querySelector('.scene-exposure')",timeout=120000)
  for direction in [1,-1]:
   page.evaluate('__story.seek(.4,true);__trace=[];__updates=[]');page.wait_for_timeout(100)
   cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':360,'y':500}]})
   page.evaluate('d=>scrollBy(0,d*3000)',direction);page.wait_for_timeout(50)
   cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
   # Continue native input beyond the release deadline: the visual target stays frozen.
   page.evaluate('''async d=>{for(let i=0;i<8;i++){scrollBy(0,d*150);await new Promise(r=>setTimeout(r,100));}}''',direction)
   page.wait_for_timeout(250);trace=page.evaluate('__trace');done=next(f['ms'] for f in trace if f['p']==f['goal'])
   updates=page.evaluate('__updates');settled=next(f['ms'] for f in updates if f['p']==f['goal']);gap=max([bb['ms']-a['ms'] for a,bb in zip(updates,updates[1:])],default=0)
   assert settled<=500+gap+30,(story,direction,settled,gap)
   assert all(f['p']==f['goal'] for f in updates if f['ms']>=500),'Complete on the first available frame at/after the deadline'
   assert all(abs(f['target']-f['goal'])<1e-10 for f in trace)
   assert all((bb['p']-a['p'])*direction>=-1e-6 for a,bb in zip(trace,trace[1:]))
   result={'story':story,'direction':direction,'durationMs':500,'firstSettledUpdateMs':round(settled,1),'observedSettledPaintMs':round(done,1),'maxFrameGapMs':round(gap,1),'lateInertiaChangedTarget':False};results.append(result);print(result,flush=True)
 assert not errors,errors
 (out/'release-500ms.json').write_text(json.dumps({'runs':results,'errors':errors},indent=2));b.close()
