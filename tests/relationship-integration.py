"""Verify map navigation with the existing single WebGL stage and story modal."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os

BASE=os.environ.get('CAWIKI_TEST_URL','http://127.0.0.1:4173/')
OUT=Path(__file__).resolve().parents[1]/'artifacts/relationship-map'

def settled(page,mode):
    page.wait_for_function('(mode)=>document.body.dataset.mode===mode&&!document.body.classList.contains("loading")',arg=mode)
    assert page.locator('body.failed').count()==0
    assert page.locator('canvas').count()==1

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce')
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE+'#wiki');page.wait_for_selector('body.ready',timeout=90000)
    page.locator('[data-wiki-tab="stories"]').click()
    assert page.locator('#wiki-stories .story-card').count()==16
    page.locator('#wiki-stories [data-scenario="typing"]').click();settled(page,'story')
    page.locator('.scenario-bottom a[href="#wiki"]').click();settled(page,'wiki')
    page.locator('[data-wiki-tab="map"]').click();settled(page,'map')
    page.locator('.relation-island').first.click()
    page.locator('.relation-neighbor[data-node="dram"]').click()
    selected=page.url
    page.locator('.relation-edge-copy a[href="#object/dram"]').click();settled(page,'object')
    assert page.locator('#world').is_visible()
    assert not page.locator('#explode').is_disabled()
    page.locator('#explode').click()
    assert page.locator('#explode').get_attribute('aria-pressed')=='true'
    page.go_back();settled(page,'map')
    assert page.url==selected
    assert page.locator('.relation-edge-copy dt').all_text_contents()==['CPU의 관점','RAM의 관점']
    print('Wiki discovery / model rendering / map history / single canvas PASS',flush=True)
    for id in ['boot','game','search','storage','save','usb','call','ai']:
        page.evaluate('(id)=>location.hash="map/scenario/"+id+"/0"',id)
        page.wait_for_selector('.relation-film-link')
        page.locator('.relation-film-link').click();settled(page,'story')
        page.locator('#story-why').click();page.wait_for_selector('#story-detail[open]')
        page.locator('#story-map').click();settled(page,'map')
        assert not page.locator('#story-detail').evaluate('(e)=>e.open')
        assert not page.locator('body.story-modal').count()
        assert page.url.endswith('#map/scenario/'+id+'/0')
    print('Original and extended films / detail modal / map round trips PASS',flush=True)
    page.set_viewport_size({'width':390,'height':844})
    page.evaluate('location.hash="map/node/cpu"');page.wait_for_selector('.relation-center[data-node="cpu"]')
    page.locator('.relation-node-copy a[href="#object/cpu"]').click();settled(page,'object')
    assert page.evaluate('document.documentElement.scrollWidth===innerWidth')
    controls=page.locator('.object-tools a,.object-tools button').evaluate_all('(es)=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,right:r.right,bottom:r.bottom}})')
    assert all(c['x']>=0 and c['right']<=390 and c['bottom']<=844 for c in controls),controls
    page.screenshot(path=str(OUT/'mobile-object-map-link.png'))
    page.locator('#object-relations').click();settled(page,'map')
    page.locator('.relation-top a[href="#wiki"]').click();settled(page,'wiki')
    page.locator('.wiki-top a').click();settled(page,'home')
    page.wait_for_function('document.body.dataset.filmProgress!==undefined')
    assert page.locator('#world').is_visible()
    assert not errors,errors
    print('Mobile model controls / return to main film / no page errors PASS',flush=True)
    browser.close()
