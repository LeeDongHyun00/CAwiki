from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1];out=root/'docs/performance/opening-principles';out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':1440,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:4173/index.html#wiki')
 result=page.evaluate('''async()=>{const {SCENARIOS}=await import('inside/scenario-data'),{renderScenarioDetail}=await import('inside/scenario-detail');const rows=[];for(const [id,story] of Object.entries(SCENARIOS))for(let i=0;i<story.steps.length;i++){renderScenarioDetail(story,i);const d=document.querySelector('#story-detail');if(d.querySelector('#story-detail-copy').textContent!==story.steps[i].detail||d.querySelectorAll('#story-detail-flow figure').length!==3||d.querySelectorAll('#story-detail-flow [aria-current=step]').length!==1)throw Error(id+'/'+i);rows.push({id,i,hero:d.querySelector('#story-detail-image').src});}return rows}''')
 assert len(result)==118,len(result)
 for story,step in [('boot',1),('save',5),('call',7),('usb',0)]:
  page.evaluate('(hash)=>location.hash=hash',f'story/{story}/{step}');page.wait_for_selector('body[data-mode=story]:not(.loading):not(.scene-pending)',timeout=120000);page.wait_for_function("!document.querySelector('.scene-exposure')",timeout=120000)
  page.locator('#story-why').click();page.wait_for_selector('#story-detail[open]');page.wait_for_timeout(650);page.wait_for_function("Array.from(document.querySelectorAll('#story-detail img')).every(i=>i.complete&&i.naturalWidth>0)")
  assert page.locator('#story-map').count()==0;assert page.locator('#story-detail').evaluate('e=>e.scrollWidth<=e.clientWidth');page.screenshot(path=str(out/(story+'-dialog.png')))
  old=page.url;page.keyboard.press('Escape');page.wait_for_selector('#story-detail',state='hidden');assert page.url==old;assert page.evaluate('document.activeElement.id')=='story-why'
 page.set_viewport_size({'width':390,'height':844});page.locator('#story-why').click();page.wait_for_timeout(650);page.screenshot(path=str(out/'mobile-dialog.png'));assert page.locator('#story-detail').evaluate('e=>e.scrollWidth<=e.clientWidth')
 page.set_viewport_size({'width':320,'height':568});page.wait_for_timeout(200);page.locator('.principle-layout').evaluate('e=>e.scrollTop=e.scrollHeight');assert page.locator('#story-detail-close').is_visible();page.locator('#story-detail-close').click();page.wait_for_selector('#story-detail',state='hidden')
 assert not errors,errors;(out/'principles.json').write_text(json.dumps({'scenes':len(result),'liveScenarios':['boot','save','call','usb'],'sizes':[1440,390,320],'errors':errors},indent=2));print('118 scene explanations / actual dialog entry, Escape and close / remote labels / mobile scroll PASS',flush=True);b.close()
