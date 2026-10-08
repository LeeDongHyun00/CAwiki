"""Real shared WebGL rendering and transitions between map, viewer and films."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os
BASE=os.environ.get('CAWIKI_TEST_URL','http://127.0.0.1:4173/')
OUT=Path(__file__).resolve().parents[1]/'artifacts/relationship-room';OUT.mkdir(exist_ok=True)
def settled(page,mode):
 page.wait_for_function('(mode)=>document.body.dataset.mode===mode&&!document.body.classList.contains("loading")',arg=mode)
 assert not page.locator('body.failed').count();assert page.locator('canvas').count()==1
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1280,'height':900},reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE+'#wiki');page.wait_for_selector('body.ready',timeout=90000)
 page.locator('[data-wiki-tab="map"]').click();page.wait_for_selector('.relation-island');page.locator('.relation-island').first.click();page.wait_for_selector('.rr-webgl');settled(page,'map')
 page.locator('[data-node="cpu"]').click();page.wait_for_selector('.rr-tabs');page.locator('[data-tab="relations"]').click();page.wait_for_selector('.rr-peer-list');page.locator('[data-peer^="dram "]').click();page.wait_for_selector('.rr-pair');page.wait_for_timeout(200)
 selected=page.url;assert page.locator('.relation-edge-copy dt').all_text_contents()==['CPU의 관점','RAM의 관점']
 page.locator('[data-tab="role"]').click();page.wait_for_selector('.rr-object-link');selected=page.url
 page.locator('.rr-object-link').click();settled(page,'object');assert page.locator('.object-tools a,.object-tools button').count()==1
 page.locator('#object-exit').click();settled(page,'map');assert page.url==selected;page.wait_for_selector('.rr-webgl')
 for group in ['compute','graphics','storage','io','network','power']:
  page.evaluate('(g)=>location.hash="map/group/"+g',group);page.wait_for_selector('.rr-room');page.wait_for_timeout(350);settled(page,'map');page.screenshot(path=str(OUT/(group+'.png')))
  assert page.locator('#world').is_visible();assert page.locator('.rr-webgl').count()==1
 print('Six actual 3D rooms / contextual viewer return / single canvas PASS',flush=True)
 for id in ['boot','save','usb','call']:
  page.evaluate('(id)=>location.hash="map/scenario/"+id+"/0"',id);page.wait_for_selector('.relation-film-link');page.locator('.relation-film-link').click();settled(page,'story')
  page.locator('#story-why').click();page.wait_for_selector('#story-detail[open]');page.locator('#story-map').click();settled(page,'map');assert not page.locator('#story-detail').evaluate('(e)=>e.open')
 print('Scenario modal / film / room renderer handoff PASS',flush=True)
 page.set_viewport_size({'width':390,'height':844});page.evaluate('location.hash="map/group/io"');page.wait_for_selector('.rr-count-7');page.wait_for_timeout(400);page.screenshot(path=str(OUT/'mobile-io.png'),full_page=True);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.locator('[data-node="mouse"]').click();page.wait_for_selector('.rr-object-link');page.locator('.rr-object-link').click();settled(page,'object');page.locator('#object-exit').click();settled(page,'map')
 page.evaluate('location.hash="wiki"');settled(page,'wiki');page.locator('.wiki-top a').click();settled(page,'home');page.wait_for_function('document.body.dataset.filmProgress!==undefined');assert page.locator('#world').is_visible()
 assert not errors,errors;browser.close();print('Mobile / original main film restored / no page errors PASS',flush=True)
