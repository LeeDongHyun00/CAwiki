"""Verify the review data and independent save motion study; no production routing changes."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops, ImageStat
import json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/scenario-expansion-design'
BASE='http://127.0.0.1:4173/artifacts/'
stories=json.loads((ROOT/'design/redesign/expansion/storyboards.json').read_text())
assert [s['number'] for s in stories]==list(range(5,17))
assert len({s['id'] for s in stories})==12
assert all(len(s['stages'])==6 for s in stories)
assert all(all(b.get(k) for k in ['title','copy','part','motion','detail']) for s in stories for b in s['stages'])
results={'storyboards':72,'errors':[]}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
 page.on('pageerror',lambda e:results['errors'].append(str(e)))
 page.goto(BASE+'scenario-expansion-design.html')
 for story in stories:
  page.locator(f'nav button[data-id="{story["id"]}"]').click()
  for i,b in enumerate(story['stages']):
   page.locator('#rail button').nth(i).click()
   assert page.locator('#scene-title').inner_text()==b['title']
   assert page.locator('#detail').inner_text()==b['detail']
   assert page.locator('#part-image').evaluate('(img)=>img.complete&&img.naturalWidth>0')
 page.goto(BASE+'scenario-expansion-design.html#save')
 page.screenshot(path=str(OUT/'review-desktop.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':844})
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path=str(OUT/'review-mobile.png'),full_page=True)
 page.set_viewport_size({'width':1440,'height':900})
 page.goto(BASE+'scenario-save-study.html');page.wait_for_selector('body.ready',timeout=90000)
 def settled():
  page.wait_for_function("Math.abs(Number(document.body.dataset.progress)-scrollY/(document.querySelector('#journey').offsetHeight-innerHeight))<.000009",timeout=60000)
 def seek(t):
  page.evaluate('(p)=>scrollTo(0,p*(document.querySelector("#journey").offsetHeight-innerHeight))',t);settled()
 save=next(s for s in stories if s['id']=='save')
 for i,b in enumerate(save['stages']):
  page.locator('#track button').nth(i).click();settled()
  assert page.locator('#story-title').inner_text()==b['title'],(i,page.locator('#story-title').inner_text())
  page.screenshot(path=f'/tmp/save-{i}.png')
  print('six-stage check',i+1,flush=True)
 seek(.43);page.locator('#story-world').screenshot(path='/tmp/save-forward.png')
 seek(.85);seek(.43);page.locator('#story-world').screenshot(path='/tmp/save-reverse.png')
 delta=ImageStat.Stat(ImageChops.difference(Image.open('/tmp/save-forward.png').convert('RGB'),Image.open('/tmp/save-reverse.png').convert('RGB'))).mean
 assert max(delta)<.05,delta
 results['reverse_pixel_mean']=delta
 before=float(page.locator('body').get_attribute('data-progress'))
 page.locator('#why').click();assert page.locator('#detail').evaluate('(e)=>e.open')
 page.mouse.wheel(0,1000);page.wait_for_timeout(300)
 assert float(page.locator('body').get_attribute('data-progress'))==before
 page.keyboard.press('Escape');settled();assert abs(float(page.locator('body').get_attribute('data-progress'))-before)<.00001
 seek(0);page.mouse.move(1050,630);page.mouse.down();page.mouse.move(1050,330,steps=12);page.mouse.up();settled()
 results['drag_progress']=float(page.locator('body').get_attribute('data-progress'));assert results['drag_progress']>.05
 page.locator('#story-world').focus();page.keyboard.press('End');settled();assert page.locator('#restart').is_visible();assert page.locator('#story-phase').inner_text()=='06 / 06'
 page.screenshot(path=str(OUT/'save-ending.png'));page.locator('#restart').click();settled();assert page.locator('#story-phase').inner_text()=='01 / 06'
 page.set_viewport_size({'width':390,'height':844})
 for i in [0,2,4,5]:
  page.locator('#track button').nth(i).click();settled();page.screenshot(path=str(OUT/f'save-mobile-{i+1}.png'))
  assert page.locator('#story-title').evaluate('(e)=>e.getBoundingClientRect().bottom<innerHeight-90')
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.emulate_media(reduced_motion='reduce');page.locator('#track button').nth(5).click();page.wait_for_function("document.body.dataset.progress==='1.00000'")
 assert page.locator('#restart').is_visible()
 page.locator('#track button').nth(2).click();page.wait_for_function("document.body.dataset.step==='2'")
 assert page.locator('#buffer i[data-filled="true"]').count()>0
 results['reduced_motion']='meaningful states and completed ending'
 # The standalone artifact has no external asset dependency
 offline=browser.new_context(offline=True,viewport={'width':1280,'height':800})
 op=offline.new_page();op.on('pageerror',lambda e:results['errors'].append(str(e)))
 op.route('**/scenario-save-study.html',lambda route:route.fulfill(path=str(ROOT/'artifacts/scenario-save-study.html'),content_type='text/html'))
 op.goto(BASE+'scenario-save-study.html');op.wait_for_selector('body.ready',timeout=90000)
 results['offline']='pass';offline.close();browser.close()
assert not results['errors'],results['errors']
canvas=Image.new('RGB',(1200,1125))
for i in range(6):
 im=Image.open(f'/tmp/save-{i}.png');im.thumbnail((600,375));canvas.paste(im,((i%2)*600,(i//2)*375))
canvas.save(OUT/'save-contact.jpg',quality=90)
(OUT/'verification.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(results,ensure_ascii=False))
