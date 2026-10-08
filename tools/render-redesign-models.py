"""Render all 23 catalog thumbnails and exploded views.
Requires serve.py 4173, Playwright, Chromium, and Pillow.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import subprocess
import argparse
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('models',nargs='*',help='Optional hardware IDs; renders all models when omitted.')
args=parser.parse_args()
ROOT=Path(__file__).resolve().parents[1]
(ROOT/'assets/models/redesign').mkdir(parents=True,exist_ok=True)
(ROOT/'artifacts/redesign-site').mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':768,'height':576},device_scale_factor=1,reduced_motion='reduce')
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:4173/?thumb=1#object/cpu');page.wait_for_selector('body.ready',timeout=90000)
 data=page.evaluate('async()=> (await import("/design/redesign/site-data.js")).HARDWARE.map(p=>({id:p.id,title:p.title}))')
 if args.models:
  unknown=set(args.models)-{item['id'] for item in data}
  if unknown:parser.error('Unknown model IDs: '+', '.join(sorted(unknown)))
  data=[item for item in data if item['id'] in args.models]
 for item in data:
  id=item['id'];page.evaluate('(id)=>location.hash="object/"+id',id)
  page.wait_for_function('(title)=>document.querySelector("#object-name").textContent===title',arg=item['title'])
  page.wait_for_selector('body:not(.loading)');page.wait_for_timeout(500)
  assert not page.locator('body.failed').count(),(id,'failed')
  path=ROOT/f'artifacts/redesign-site/{id}.png';page.locator('#world').screenshot(path=str(path))
  page.evaluate('document.querySelector("#explode").click()');page.wait_for_timeout(500)
  assert page.locator('#explode').get_attribute('aria-pressed')=='true'
  assert page.locator('#object-structure').text_content()
  page.locator('#world').screenshot(path=str(ROOT/f'artifacts/redesign-site/{id}-structure.png'))
  print(id+' / assembled + exploded PASS',flush=True)
 assert not errors,errors
 print(f'{len(data)} models rendered. Page errors: none',flush=True)
 b.close()

# Catalog portraits share the film geometry and landing camera, not the detail viewer.
subprocess.run(['python3',str(ROOT/'tools/render-hardware-portraits.py'),*args.models],check=True)
