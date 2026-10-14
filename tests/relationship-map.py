"""Semantic coverage and responsive fallback for the spatial relationship map."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os
ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('CAWIKI_TEST_URL','http://127.0.0.1:4173/')
source=(ROOT/'design/redesign/relation-source.js').read_text()
graph=json.loads(source.split('export const RELATION_SOURCE = ',1)[1].strip().rstrip(';'))
GROUPS={'compute':['cpu','sram','dram','npu','coproc'],'graphics':['gpu','cpu','vram','display','bus'],'storage':['ssd','hdd','dram','cpu','bus','coproc'],'io':['bus','input','mouse','camera','audio','coproc','mainboard'],'network':['nic','infra','datacenter','cpu','dram','mainboard'],'power':['mainboard','power','vrm','cooling','cpu','spirom']}
SCENARIOS=['boot','game','search','storage','typing','launch','save','music','streaming','call','multitasking','usb','sleep','ai','loading','record']
def navigate(page,hash):
 page.evaluate('(h)=>location.hash=h',hash)
 page.wait_for_function('(h)=>location.hash==="#"+h&&document.body.dataset.mode==="map"',arg=hash)
 page.wait_for_timeout(40)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-webgl'])
 page=browser.new_page(viewport={'width':1440,'height':900},reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE+'#map');page.wait_for_selector('.relation-island');assert page.locator('.relation-island').count()==6
 for width,height in [(1440,900),(390,844),(320,740)]:
  page.set_viewport_size({'width':width,'height':height})
  for group,ids in GROUPS.items():
   navigate(page,'map/group/'+group);assert set(page.locator('.rr-exhibit[data-node]').evaluate_all('(es)=>es.map(e=>e.dataset.node)'))==set(ids)
   assert page.locator('.rr-room svg').count()==1, 'Only the exit icon, no grid or web'
   assert len(page.locator('#relationship-page').inner_text().splitlines())==len(ids)+1
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   for box in page.locator('.rr-exhibit').evaluate_all('(es)=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,w:r.width,h:r.height}})'):
    assert box['w']>=44 and box['h']>=44 and box['x']>=0 and box['right']<=width+.1,box
 print('Six rooms / only names and title / no grid / desktop, 390px, 320px PASS',flush=True)
 for node in graph['nodes']:
  navigate(page,'map/node/'+node['id']);assert page.locator('#relation-title').inner_text()==node['name']
  page.locator('[data-tab="parts"]').click();page.wait_for_selector('#rr-part-select');assert page.locator('#rr-part-select option').count()==len(node['parts'])
  page.locator('#rr-part-select').select_option(str(len(node['parts'])-1));page.wait_for_timeout(50);assert page.locator('.rr-content h2').inner_text()==node['parts'][-1]['name']
  page.locator('[data-tab="relations"]').click();page.wait_for_selector('.rr-peer-list')
  assert page.locator('.rr-peer-list a').count()==sum(node['id'] in (e['a'],e['b']) for e in graph['edges'])
 print('23 roles / all internal components / every neighbor accessible PASS',flush=True)
 for edge in graph['edges']:
  navigate(page,'map/node/'+edge['a']+'?edge='+edge['id'])
  assert page.locator('.relation-edge-copy dd').all_text_contents()==[edge['ab'],edge['ba']]
  assert page.locator('.rr-path .rr-route').count()==1
  assert page.locator('.rr-signal').count()==(1 if edge['kind']=='data' else 0)
 print('124 relations / both perspectives / relationship-specific visual signals PASS',flush=True)
 navigate(page,'map/node/cpu?tab=relations');assert page.locator('.rr-peer-list a').count()==18
 page.locator('#rr-peer-search').fill('zz');assert page.locator('#rr-no-peers').is_visible()
 page.locator('#rr-peer-search').fill('ram');assert page.locator('.rr-peer-list a:visible').count()>=1
 page.locator('#relation-type').select_option('power');page.wait_for_timeout(80);assert all(t=='전원' for t in page.locator('.rr-peer-list a>span:last-child').all_text_contents())
 navigate(page,'map/node/mouse?type=thermal');assert page.locator('#rr-no-peers').is_visible()
 page.evaluate('location.hash="map/group/compute?edge=cpu--dram"');page.wait_for_selector('.rr-pair');assert 'from=compute' in page.url
 page.locator('.rr-close').click();page.wait_for_selector('.rr-room');page.locator('[data-node="dram"]').focus();page.keyboard.press('Enter');page.wait_for_selector('.rr-tabs');page.keyboard.press('Escape');page.wait_for_selector('.rr-room');assert page.locator('[data-node="dram"]').evaluate('(e)=>document.activeElement===e')
 print('Filters / empty states / legacy edge links / keyboard / contextual return PASS',flush=True)
 for story in SCENARIOS:
  for step in range(4):
   navigate(page,f'map/scenario/{story}/{step}');assert page.locator('.relation-steps a').count()==4
   assert page.locator('.rr-content h2').inner_text();assert page.locator('.rr-content>p').inner_text();assert page.locator('.rr-scenario-parts a').count()>1
   assert page.locator('.relation-film-link').get_attribute('href')==f'#story/{story}/0'
 print('All 64 legacy stages / 16 cinematic links PASS',flush=True)
 assert not errors,errors
 browser.close()
