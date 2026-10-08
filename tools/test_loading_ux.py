#!/usr/bin/env python3
"""Silent 200 ms threshold, early CPU, asynchronous skip and spatial LOD checks."""
import functools,json,threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
 def copyfile(self,source,outputfile):
  try:super().copyfile(source,outputfile)
  except (BrokenPipeError,ConnectionResetError):pass  # Expected when a test navigates away.
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/index.html'
results=[];errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':900});page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(url+'#wiki');page.wait_for_selector('#wiki-title:visible')
 assert page.locator('#render-status').is_hidden()
 fast=page.evaluate('''async()=>{const {beginSceneReveal}=await import('inside/render-status');let shown=0;const o=new MutationObserver(rs=>{for(const r of rs)for(const n of r.addedNodes)if(n.classList?.contains('scene-exposure'))shown++;});o.observe(document.body,{childList:true});const reveal=beginSceneReveal();await new Promise(r=>setTimeout(r,70));reveal.finish();await new Promise(r=>setTimeout(r,250));o.disconnect();return shown;}''')
 assert fast==0;results.append('Below 200 ms: no veil, loading message or animation is created')
 page.evaluate('''async()=>{window.__reveal=(await import('inside/render-status')).beginSceneReveal();}''');page.wait_for_timeout(260)
 assert page.locator('.scene-exposure').count()==1
 page.evaluate('__reveal.finish()');page.wait_for_timeout(90)
 opacity=float(page.locator('.scene-exposure').evaluate('e=>getComputedStyle(e).opacity'));assert 0<opacity<1
 page.wait_for_selector('.scene-exposure',state='detached');results.append('Slow preparation: black exposure fades continuously with a minimum 360 ms duration')
 page.evaluate('''async()=>{window.__reveal=(await import('inside/render-status')).beginSceneReveal();}''');page.wait_for_timeout(230)
 page.evaluate("async()=>{(await import('inside/render-status')).cancelPreparation();__reveal.finish();}")
 assert page.locator('.scene-exposure').count()==0;results.append('Route cancellation removes a pending exposure; stale completion cannot resurrect it')
 page.goto(url,wait_until='domcontentloaded');page.wait_for_function("performance.getEntriesByName('inside:cpu-preview-visible').length")
 page.wait_for_function("performance.getEntriesByName('inside:computer-ready').length",timeout=120000)
 marks=page.evaluate("Object.fromEntries(performance.getEntriesByType('mark').map(e=>[e.name,e.startTime]))")
 assert marks['inside:cpu-preview-visible']<marks['inside:cpu-visible']<marks['inside:computer-ready'];results.append({'cpuBeforeRestOfComputer':marks})
 page.evaluate("scrollTo(0,(document.querySelector('#sequence').offsetHeight-innerHeight)*.04)")
 page.wait_for_function("performance.getEntriesByName('inside:monitor-ready').length",timeout=120000)
 assert float(page.locator('body').get_attribute('data-film-progress'))<.125
 assert page.locator('#render-status').is_hidden();results.append('Monitor finishes background preparation while the user is still in the CPU chapter')
 # The CPU can be visible before the complete film exists; leaving early must
 # use the normal Wiki route instead of capturing an incomplete monitor scene.
 models=(ROOT/'lib/inside/cinema-models.js').read_text()
 page.route('**/lib/inside/cinema-models.js*',lambda route:route.fulfill(body=models.replace("if(id==='cpu'){","if(id==='cpu'){await new Promise(r=>setTimeout(r,5000));"),content_type='text/javascript'))
 page.goto(url,wait_until='domcontentloaded');page.wait_for_function("performance.getEntriesByName('inside:cpu-visible').length",timeout=120000)
 page.locator('.collection-entry').click();page.wait_for_function("document.body.dataset.mode==='wiki'")
 assert page.locator('#wiki-title').is_visible();page.unroute('**/lib/inside/cinema-models.js*')
 results.append('Leaving the first CPU while remaining parts are pending safely opens Wiki')
 # Hold only the background monitor promise to exercise skip while it is pending.
 study=(ROOT/'lib/inside/study.js').read_text();anchor='const image=monitorImage,baked=image&&await image;'
 page.route('**/lib/inside/study.js*',lambda route:route.fulfill(body=study.replace(anchor,anchor+'await new Promise(r=>setTimeout(r,5000));').replace('graphics={T,renderer,scene,camera,key,rim,fill,floor,root,colorDark,colorLight,focus,position,environment,computer,reveal};','graphics={T,renderer,scene,camera,key,rim,fill,floor,root,colorDark,colorLight,focus,position,environment,computer,reveal};window.__skipStage=graphics;'),content_type='text/javascript'))
 page.goto(url,wait_until='domcontentloaded');page.wait_for_function("performance.getEntriesByName('inside:cpu-visible').length",timeout=120000)
 page.wait_for_selector('#skip-film:visible',timeout=120000)
 page.evaluate("window.__skipTrace=[];function sample(t){__skipTrace.push({at:t,p:Number(document.body.dataset.filmProgress)});if(Number(document.body.dataset.filmProgress)<.995)requestAnimationFrame(sample);}requestAnimationFrame(sample)")
 page.locator('#skip-film').click()
 page.wait_for_function("Number(document.body.dataset.filmProgress)>.25 && Number(document.body.dataset.filmProgress)<.94",timeout=120000)
 previous=page.evaluate('__skipStage.renderer.info.render.frame');page.keyboard.press('Escape')
 assert page.locator('.film-montage').count()==0
 page.wait_for_function('previous=>__skipStage.renderer.info.render.frame>previous',arg=previous,timeout=120000)
 results.append('Cancelling fast-forward redraws the live film instead of exposing an old canvas')
 page.locator('#skip-film').click();page.wait_for_function("Number(document.body.dataset.filmProgress)>.995",timeout=120000)
 trace=page.evaluate('__skipTrace');ready=page.evaluate("performance.getEntriesByName('inside:monitor-ready').at(-1).startTime")
 assert any(.25<e['p']<.9 for e in trace),trace
 assert all(e['p']<.94 for e in trace if e['at']<ready),trace
 results.append({'skipUsesIntermediateFramesUntilMonitorReady':{'frames':len(trace),'monitorReadyMs':ready}})
 page.unroute('**/lib/inside/study.js*')
 page.goto(url+'#object/cpu',wait_until='domcontentloaded')
 page.wait_for_function("performance.getEntriesByName('inside:object-ready').length && !document.querySelector('.scene-exposure')",timeout=120000)
 assert not page.evaluate("document.body.classList.contains('failed')")
 assert page.locator('#world').evaluate("e=>getComputedStyle(e).opacity")=='1'
 page.mouse.move(700,400);page.mouse.down();page.mouse.move(780,430,steps=6);page.mouse.up()
 assert page.evaluate("document.body.classList.contains('manipulated')")
 assert page.locator('#object-structure').inner_text()
 results.append('Cold hardware detail draws its first frame before revealing; drag rotation remains usable')
 # Instrument only the test response, never production globals.
 room=(ROOT/'lib/inside/room-study.js').read_text()+"\nwindow.__roomProbe=()=>({full:items.filter(i=>i.full).map(i=>i.id),memory:renderer?{...renderer.info.memory}:null});window.__loseRoom=()=>renderer.getContext().getExtension('WEBGL_lose_context').loseContext();"
 page.route('**/lib/inside/room-study.js*',lambda route:route.fulfill(body=room,content_type='text/javascript'))
 page.evaluate("location.hash='map/group/compute'");page.wait_for_selector('#relationship-room-frame');frame=page.frames[-1]
 frame.wait_for_function("document.querySelector('#room').dataset.ready==='true' && document.querySelector('#room').dataset.moving==='false'",timeout=120000)
 assert frame.evaluate('__roomProbe().full')==[]
 frame.locator('[data-hardware=cpu]').click();frame.wait_for_function("__roomProbe().full.includes('cpu')",timeout=120000)
 frame.locator('[data-tab=relations]').click();frame.locator('.detail-peer').first.click();frame.wait_for_function('__roomProbe().full.length===2',timeout=120000)
 assert len(frame.evaluate('__roomProbe().full'))<=2
 frame.locator('#room-close').click();frame.wait_for_function("document.querySelector('#room').dataset.moving==='false'")
 assert frame.evaluate('__roomProbe().full')==[]
 results.append('Spatial overview has zero detailed models; one selected model or two relation peers are retained, then released')
 frame.evaluate('__loseRoom()');frame.wait_for_selector('.room-fallback:visible')
 frame.locator('.room-fallback [data-id=cpu]').click();assert frame.locator('#detail-title').inner_text();results.append('Lost gallery WebGL context retains image navigation and detail text')
 page.evaluate("location.hash='wiki'");page.wait_for_selector('#wiki-title:visible');assert page.locator('.scene-exposure').count()==0
 assert not errors,errors
 page.close();browser.close()
server.shutdown()
print(json.dumps({'passed':results,'pageErrors':errors},ensure_ascii=False,indent=2))
