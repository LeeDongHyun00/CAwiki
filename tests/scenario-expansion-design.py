"""Review-page coverage; production motion is covered by scenario-extended.py."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]
stories=json.loads((ROOT/'design/redesign/expansion/storyboards.json').read_text())
assert [s['number'] for s in stories]==list(range(5,17))
assert all(len(s['stages'])>=6 for s in stories)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1280,'height':800},reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:4173/artifacts/scenario-expansion-design.html')
 for s in stories:
  page.locator(f'nav button[data-id="{s["id"]}"]').click();assert int(page.locator('input').get_attribute('max'))==len(s['stages'])-1
  for i,stage in enumerate(s['stages']):
   page.locator('#rail button').nth(i).click();assert page.locator('#scene-title').inner_text()==stage['title'];assert page.locator('#detail').inner_text()==stage['detail']
   assert page.locator('#part-image').evaluate('(img)=>img.complete&&img.naturalWidth>0')
 page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.goto('http://127.0.0.1:4173/artifacts/scenario-save-study.html');page.wait_for_selector('body[data-story="save"]:not(.loading)',timeout=90000);assert page.locator('#story-track button').count()==8
 assert not errors,errors;b.close()
print('94 reviewed scenes and production save alias PASS')
