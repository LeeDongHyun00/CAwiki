"""Post-touch input stays live within the original one-scene gesture limit."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 source=(root/'lib/inside/site.js').read_text()+'\nObject.defineProperty(window,"__story",{configurable:true,get:()=>film});'
 page.route('**/lib/inside/site.js*',lambda r:r.fulfill(body=source,content_type='text/javascript'))
 page.goto(os.environ.get('TEST_BASE_URL','http://127.0.0.1:4173')+'/index.html#story/boot/0')
 page.wait_for_function('window.__story?.active&&!__story.preparing',timeout=120000)
 page.wait_for_function("!document.querySelector('.scene-exposure')",timeout=120000)
 results=[]
 for direction in [1,-1]:
  result=page.evaluate('''d=>{
   const f=__story;f.seek(.4,true);
   const world=document.querySelector('#world'),touch=new Touch({identifier:1,target:world,clientX:350,clientY:500});
   world.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[touch]}));
   const anchor=f.scrollPacer.position(f.progress);
   function scroll(delta){scrollBy(0,delta);dispatchEvent(new Event('scroll'));return f.target;}
   const held=scroll(d*100);
   world.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[]}));
   const lifted=f.target;
   const inertia=scroll(d*200);
   const capped=scroll(d*3000),travel=Math.abs(f.scrollPacer.position(capped)-anchor);
   const reverse=scroll(-d*25);
   const immediateReverse=(reverse-f.progress)*d<0;
   // Another touch can start immediately, with a new anchor and no timer gate,
   // and continues the pending target instead of stopping the scene.
   const pending=f.target;
   world.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[touch]}));
   const fresh=f.target===pending&&f.scrollPacer.active&&f.scrollPacer.anchor===f.scrollPacer.position(pending);
   world.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[]}));
   return {direction:d,held,lifted,inertia,travel,immediateReverse,fresh};
  }''',direction)
  assert result['held']==result['lifted'],result
  assert (result['inertia']-result['lifted'])*direction>0,result
  assert .99<=result['travel']<=1.00001,result
  assert result['immediateReverse'] and result['fresh'],result
  results.append(result)
 page.wait_for_function('!__story.scrollPacer.active',timeout=15000)
 (root/'docs/performance/input-stability/post-touch-inertia.json').write_text(json.dumps(results,indent=2))
 print(json.dumps(results),flush=True);b.close()
