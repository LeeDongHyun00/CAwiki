"""Exercise all 94 implemented scenes and shared interaction contracts."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops, ImageStat, ImageDraw
from io import BytesIO
import json
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts/scenario-extended';OUT.mkdir(exist_ok=True)
BASE='http://127.0.0.1:4173/'
stories=json.loads((ROOT/'design/redesign/expansion/storyboards.json').read_text());results={'scenes':sum(len(s['stages']) for s in stories),'errors':[]}
assert all(len(s['stages'])>=6 for s in stories)
def diff(a,b):return max(ImageStat.Stat(ImageChops.difference(Image.open(BytesIO(a)).convert('RGB'),Image.open(BytesIO(b)).convert('RGB'))).mean)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1280,'height':800},reduced_motion='reduce');page.on('pageerror',lambda e:results['errors'].append(str(e)))
 page.goto(BASE+'#story/save/0');page.wait_for_selector('body[data-mode="story"]:not(.loading)',timeout=90000)
 def route(id,i=0):
  page.evaluate('([id,i])=>location.hash="story/"+id+"/"+i',[id,i]);page.wait_for_function('([id,i])=>document.body.dataset.story===id&&+document.body.dataset.storyStep===i&&!document.body.classList.contains("loading")',arg=[id,i],timeout=90000)
 def seek(t):
  page.evaluate('(p)=>scrollTo({top:Math.round(p*(document.querySelector("#story-sequence").offsetHeight-innerHeight)),behavior:"instant"})',t)
  page.wait_for_function('Math.abs(+document.body.dataset.storyProgress-scrollY/(document.querySelector("#story-sequence").offsetHeight-innerHeight))<.000015',timeout=45000)
 for s in stories:
  route(s['id']);assert page.locator('#story-track button').count()==len(s['stages'])
  assert not page.locator('body').evaluate('(e)=>e.classList.contains("failed")'),s['id']
  for i,stage in enumerate(s['stages']):
   page.locator('#story-track button').nth(i).click();page.wait_for_function('(i)=>+document.body.dataset.storyStep===i',arg=i)
   assert page.locator('#story-title').inner_text()==stage['title'];assert page.locator('#story-copy').inner_text()==stage['copy']
   assert page.locator('canvas').count()==1
   if i in [0,len(s['stages'])//2,len(s['stages'])-1]:page.screenshot(path=str(OUT/f'{s["id"]}-{i}.png'))
  page.locator('#story-why').click();assert page.locator('#story-detail-copy').inner_text()==s['stages'][-1]['detail'];assert page.locator('#story-source').is_visible();page.keyboard.press('Escape')
  print(s['id'],len(s['stages']),'PASS',flush=True)
 page.evaluate('location.hash="stories"');page.wait_for_selector('#collection-dialog[open]');assert page.locator('#story-grid a[href^="#story/"]').count()==16
 page.locator('#story-grid a[data-scenario="save"]').click();page.wait_for_selector('body[data-story="save"]:not(.loading)')
 page.emulate_media(reduced_motion='no-preference')
 reverse={}
 for id in ['save','usb','streaming']:
  route(id);seek(.36);a=page.locator('#world').screenshot();seek(.81);b=page.locator('#world').screenshot();assert diff(a,b)>1
  seek(.36);delta=diff(a,page.locator('#world').screenshot());assert delta<.15,(id,delta);reverse[id]=delta
 results['reverse_difference']=reverse
 route('save');seek(.45);page.locator('#story-why').click();before=page.locator('body').get_attribute('data-story-progress');page.mouse.wheel(0,800);page.wait_for_timeout(150);assert page.locator('body').get_attribute('data-story-progress')==before;page.keyboard.press('Escape')
 page.wait_for_function('(p)=>Math.abs(+document.body.dataset.storyProgress-p)<.00015',arg=float(before));assert page.locator('#story-why').evaluate('(e)=>e===document.activeElement')
 seek(0);page.mouse.move(1000,600);page.mouse.down();page.mouse.move(1000,300,steps=8);page.mouse.up();page.wait_for_function('+document.body.dataset.storyProgress>.04')
 page.locator('#story-title').focus();page.keyboard.press('End');page.wait_for_selector('#story-restart:visible');page.locator('#story-restart').click();page.wait_for_function('document.body.dataset.storyStep==="0"')
 print('Reverse, drag, modal, keyboard PASS',flush=True)
 page.emulate_media(reduced_motion='reduce');page.set_viewport_size({'width':390,'height':844})
 for s in stories:
  route(s['id'])
  for i in [len(s['stages'])//2,len(s['stages'])-1]:
   page.locator('#story-track button').nth(i).click();page.wait_for_function('(i)=>+document.body.dataset.storyStep===i',arg=i)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert page.locator('#story-copy').evaluate('(e)=>e.getBoundingClientRect().bottom<innerHeight-90')
  assert page.locator('#story-restart').is_visible();page.screenshot(path=str(OUT/f'mobile-{s["id"]}-end.png'))
 print('Mobile / variable step rails PASS',flush=True)
 # Touch gestures and portability in a second mobile context
 mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
 mp=mobile.new_page();mp.on('pageerror',lambda e:results['errors'].append(str(e)))
 mp.goto(BASE+'artifacts/inside-site.html#story/usb/0');mp.wait_for_selector('body[data-story="usb"]:not(.loading)',timeout=90000);mobile.set_offline(True)
 cdp=mobile.new_cdp_session(mp)
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':280,'y':550}]})
 for y in range(530,180,-20):
  cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':280,'y':y}]});mp.wait_for_timeout(30)
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});mp.wait_for_function('+document.body.dataset.storyProgress>.01',timeout=30000)
 mp.locator('#story-track button').last.tap();mp.wait_for_selector('#story-restart:visible')
 for id in ['ai','save','record']:
  mp.evaluate('(id)=>location.hash="story/"+id+"/0"',id);mp.wait_for_function('(id)=>document.body.dataset.story===id&&!document.body.classList.contains("loading")',arg=id);assert not mp.locator('body').evaluate('(e)=>e.classList.contains("failed")')
 results['touch_offline']='pass';mobile.close();browser.close()
assert not results['errors'],results['errors']
canvas=Image.new('RGB',(1600,2400),'#111416');draw=ImageDraw.Draw(canvas)
for row,s in enumerate(stories):
 for col,i in enumerate([0,len(s['stages'])//2,len(s['stages'])-1]):
  im=Image.open(OUT/f'{s["id"]}-{i}.png');im.thumbnail((400,250));canvas.paste(im,((row%4)*400,(row//4)*800+col*250));draw.text(((row%4)*400+5,(row//4)*800+col*250+5),s['id']+'/'+str(i+1),fill='white')
canvas.save(OUT/'contact.jpg',quality=88)
(OUT/'verification.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n');print(json.dumps(results,ensure_ascii=False))
