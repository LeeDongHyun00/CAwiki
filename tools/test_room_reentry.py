"""Repeated cached iframe visits, shared RAF epochs, and resize during transfer."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/performance/input-stability';OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader']);report=[];errors=[]
 for mobile,shared in [(False,False),(True,False),(False,True),(True,True)]:
  width,height=(390,844) if mobile else (1200,800)
  page=b.new_page(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile)
  page.on('pageerror',lambda e:errors.append(str(e)))
  # No interception: preserve the browser's real HTTP/module cache on repeat
  # visits. Inject only a legal alternate RAF time origin for the clock case.
  if shared:page.add_init_script('''const nativeRAF=requestAnimationFrame;window.requestAnimationFrame=callback=>nativeRAF(t=>callback(t+(window===top?0:parent.performance.now()-performance.now())));''')
  page.add_init_script('''window.__trace=[];window.__opens=[];addEventListener('message',e=>{if(e.data?.type==='open')__opens.push(e.data)});function sample(){const room=document.querySelector('#room');if(room){const item=document.querySelector('[data-hardware=cpu]');__trace.push({t:performance.now(),phase:room.dataset.phase,mode:document.body.dataset.mode,x:item?.getBoundingClientRect().x,y:item?.getBoundingClientRect().y});}requestAnimationFrame(sample)}requestAnimationFrame(sample)''')
  page.goto('http://127.0.0.1:4173/index.html#wiki')
  for cycle in range(3):
   if mobile:page.locator('[data-wiki-tab=map]').tap()
   else:page.locator('[data-wiki-tab=map]').click()
   page.wait_for_selector('#relationship-room-frame');frame=page.frames[-1]
   frame.wait_for_function("document.querySelector('#room')?.dataset.phase==='entry'",timeout=60000)
   if cycle==1:
    frame.evaluate("dispatchEvent(new Event('resize'));dispatchEvent(new Event('resize'))")
    assert frame.evaluate("document.querySelector('#room').dataset.phase")=='entry'
    page.set_viewport_size({'width':width,'height':height-70});page.wait_for_timeout(50)
    assert frame.evaluate("document.body.dataset.mode")=='entering-room'
   frame.wait_for_function("document.body.dataset.mode==='room'&&document.querySelector('#room').dataset.moving==='false'",timeout=30000)
   data=frame.evaluate('({trace:__trace,opens:__opens,ready:document.querySelector("#room").dataset.ready,all:document.querySelector(".room-topic[data-group=all]").getAttribute("aria-pressed")})')
   entry=[f for f in data['trace'] if f['phase']=='entry'];assert len(entry)>20,(mobile,shared,cycle,data)
   duration=entry[-1]['t']-entry[0]['t'];assert duration>1900,(cycle,duration)
   assert len({round(f['x'],1) for f in entry if f.get('x') is not None})>15
   assert data['ready']=='true' and data['all']=='true' and data['opens'][0]['animate']
   if cycle==2:
    frame.locator('.room-topic[data-group=compute]').click();frame.wait_for_function("document.querySelector('#room').dataset.moving==='false'")
   frame.locator('.room-exit').click();frame.wait_for_function("document.querySelector('#room').dataset.phase==='exit'")
   if cycle==1:
    frame.evaluate("dispatchEvent(new Event('resize'))");assert frame.evaluate("document.querySelector('#room').dataset.phase")=='exit'
    page.set_viewport_size({'width':width,'height':height})
   page.wait_for_selector('#relationship-room-frame',state='detached',timeout=30000)
   page.wait_for_function("document.body.dataset.mode==='wiki'")
   assert not page.locator('#wiki-page').evaluate('e=>e.inert||e.hasAttribute("aria-busy")')
   assert page.locator('#wiki-hardware img').evaluate_all('es=>es.every(e=>getComputedStyle(e).opacity==="1")')
   r={'mobile':mobile,'sharedRAFClock':shared,'cycle':cycle+1,'entryFrames':len(entry),'entryDurationMs':round(duration),'restoredList':True};report.append(r);print(json.dumps(r),flush=True)
  page.close()
 assert not errors,errors
 (OUT/'room-reentry.json').write_text(json.dumps({'runs':report,'errors':errors},indent=2));b.close()
