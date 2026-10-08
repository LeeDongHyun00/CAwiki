"""Relationship map: graph navigation, source coverage, scenarios and offline access."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts/relationship-map';OUT.mkdir(exist_ok=True)
BASE=os.environ.get('CAWIKI_TEST_URL','http://127.0.0.1:4173/')
SCENARIOS=['boot','game','search','storage','typing','launch','save','music','streaming','call','multitasking','usb','sleep','ai','loading','record']
def navigate(page,hash):
 page.evaluate('(h)=>location.hash=h',hash)
 page.wait_for_function('(h)=>location.hash==="#"+h&&document.body.dataset.mode==="map"',arg=hash)
 page.wait_for_timeout(70)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-webgl'])
 page=browser.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE+'#map');page.wait_for_selector('.relation-island');assert page.locator('.relation-island').count()==6;assert page.locator('.relation-scenario-grid').count()==0
 page.screenshot(path=str(OUT/'overview.png'))
 page.locator('.relation-island').first.click();page.wait_for_selector('.relation-center');assert page.locator('.relation-center').get_attribute('data-node')=='cpu'
 page.locator('.relation-neighbor[data-node="dram"]').click();page.wait_for_selector('.relation-edge-copy');assert page.locator('.relation-edge-copy dt').all_text_contents()==['CPU의 관점','RAM의 관점'];assert page.locator('.relation-edge-copy dd').count()==2
 page.screenshot(path=str(OUT/'cpu-ram.png'));page.locator('.relation-edge-copy .relation-primary').click();page.wait_for_function('document.querySelector(".relation-center").dataset.node==="dram"');page.go_back();page.wait_for_selector('.relation-edge-copy');assert page.locator('.relation-center').get_attribute('data-node')=='cpu'
 navigate(page,'map/node/cpu');seen=set()
 while True:
  seen.update(page.locator('.relation-neighbor').evaluate_all('(es)=>es.map(e=>e.dataset.node)'))
  nxt=page.get_by_role('link',name='다음 관계',exact=True)
  if not nxt.count():break
  nxt.click();page.wait_for_timeout(80)
 assert len(seen)>=16,seen
 page.locator('#relation-type').select_option('power');page.wait_for_timeout(100);assert all(t=='전원' for t in page.locator('.relation-neighbor>span:last-child').all_text_contents())
 page.locator('#relation-type').select_option('context');page.wait_for_timeout(100);assert page.locator('.relation-neighbor').count()>0
 navigate(page,'map/node/mouse?type=thermal');assert page.locator('.relation-empty').is_visible();assert page.locator('.relation-neighbor').count()==0
 page.locator('#relation-search').fill('없는부품zz');assert '없습니다' in page.locator('#relation-results').inner_text()
 page.locator('#relation-search').fill('마우스');assert page.locator('#relation-results a').first.get_attribute('href')=='#map/node/mouse';page.locator('#relation-results a[href="#map/node/mouse"]').click();page.wait_for_function('document.querySelector(".relation-center").dataset.node==="mouse"')
 page.keyboard.press('Tab');page.locator('.relation-neighbor').first.focus();page.keyboard.press('Enter');page.wait_for_selector('.relation-edge-copy')
 print('Overview / both directions / recenter / history / all neighbors / filters / search / keyboard PASS',flush=True)
 for id in SCENARIOS:
  navigate(page,'map/scenario/'+id+'/0');assert page.locator('.relation-steps a').count()==4
  for i in range(4):
   page.locator('.relation-steps a').nth(i).click();page.wait_for_function('(i)=>document.querySelectorAll(".relation-steps a")[i].getAttribute("aria-current")==="step"',arg=i)
   assert page.locator('.relation-step-copy h2').inner_text();assert page.locator('.relation-step-copy p').inner_text();assert page.locator('.relation-neighbor').count()>0
  assert page.locator('.relation-step-actions').inner_text().find('처음부터')>=0
  assert page.locator('.relation-film-link').count()==1
  if id in ['save','music','ai']:page.screenshot(path=str(OUT/f'scenario-{id}.png'))
 print('16 scenarios / all 64 stages / 16 cinematic links PASS',flush=True)
 navigate(page,'map/node/coproc');assert page.locator('.relation-node-copy a[href^="#object/"]').count()==0
 navigate(page,'map/node/cpu');page.locator('.relation-explanation details').evaluate('(e)=>e.open=true');assert page.locator('.relation-explanation dd').count()>3
 page.set_viewport_size({'width':390,'height':844});navigate(page,'map');page.screenshot(path=str(OUT/'mobile-overview.png'));assert page.evaluate('document.documentElement.scrollWidth===innerWidth')
 navigate(page,'map/node/cpu');page.screenshot(path=str(OUT/'mobile-cpu.png'));assert page.evaluate('document.documentElement.scrollWidth===innerWidth')
 boxes=page.locator('.relation-node').evaluate_all('(es)=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})')
 for a in boxes:
  assert a['w']>=44 and a['h']>=44 and a['x']>=0 and a['x']+a['w']<=390,boxes
 page.locator('.relation-neighbor[data-node="dram"]').click();page.wait_for_function('document.activeElement.classList.contains("relation-edge-copy")');assert 0<=page.locator('.relation-edge-copy').bounding_box()['y']<50
 page.screenshot(path=str(OUT/'mobile-relationship.png'));page.locator('[data-return-map]').click();assert page.locator('.relation-center').evaluate('(e)=>document.activeElement===e')
 navigate(page,'map/scenario/save/1');assert page.locator('.relation-step-copy').bounding_box()['y']<page.locator('.relation-map-area').bounding_box()['y'];page.screenshot(path=str(OUT/'mobile-save.png'));assert page.evaluate('document.documentElement.scrollWidth===innerWidth')
 assert not errors,errors;browser.close()
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-webgl'])
 context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce');page=context.new_page();requests=[];page.on('request',lambda r:requests.append(r.url));page.on('pageerror',lambda e:errors.append(str(e)))
 portable='http://127.0.0.1:4173/artifacts/inside-site.html';page.goto(portable+'#map');page.wait_for_selector('.relation-island');context.set_offline(True)
 page.locator('.relation-island').nth(5).tap();page.wait_for_selector('.relation-neighbor');page.locator('.relation-neighbor').first.tap();page.wait_for_selector('.relation-edge-copy')
 navigate(page,'map/scenario/usb/0');page.locator('.relation-step-actions .relation-primary').tap();page.wait_for_function('location.hash.endsWith("/1")')
 assert all(r.split('#')[0]==portable or r.startswith(('blob:','data:')) for r in requests),requests
 assert not errors,errors;browser.close();print('Mobile / touch / reduced motion / no WebGL / offline standalone PASS',flush=True)
