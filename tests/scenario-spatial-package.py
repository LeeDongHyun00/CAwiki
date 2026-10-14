from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts/scenario-spatial';stories=json.loads((ROOT/'design/redesign/expansion/storyboards.json').read_text());results={'errors':[]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
 c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
 pg=c.new_page();pg.on('pageerror',lambda e:results['errors'].append(str(e)));requests=[];pg.on('request',lambda r:requests.append(r.url))
 pg.goto('http://127.0.0.1:4174/#story/usb/0');pg.wait_for_selector('body[data-story="usb"]:not(.loading)',timeout=90000);c.set_offline(True)
 cd=c.new_cdp_session(pg);cd.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':280,'y':550}]})
 for y in range(530,180,-20):
  cd.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':280,'y':y}]});pg.wait_for_timeout(30)
 cd.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});pg.wait_for_function('+document.body.dataset.storyProgress>.01',timeout=30000)
 results['touch_scroll']={'scrollY':pg.evaluate('scrollY'),'progress':pg.locator('body').get_attribute('data-story-progress')}
 pg.locator('#story-track button').last.tap();pg.wait_for_selector('#story-restart:visible');assert not pg.locator('body.failed').count()
 results['offline_scenes']={}
 for id in ['ai','save','record']:
  pg.evaluate('(id)=>location.hash="story/"+id+"/0"',id);pg.wait_for_function('(id)=>document.body.dataset.story===id&&!document.body.classList.contains("loading")',arg=id,timeout=90000)
  assert not pg.locator('body.failed').count()
  for i in [1,pg.locator('#story-track button').count()-1]:
   pg.locator('#story-track button').nth(i).tap();pg.wait_for_function('(i)=>+document.body.dataset.storyStep===i',arg=i)
  results['offline_scenes'][id]='pass'
  pg.screenshot(path=str(OUT/f'packaged-mobile-{id}.png'))
 assert all(r.split('#')[0]=='http://127.0.0.1:4174/' or r.startswith(('blob:','data:')) for r in requests),requests
 print('Pages package: actual touch scroll, step taps, offline models PASS',flush=True);b.close()
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-webgl'])
 pg=b.new_page(viewport={'width':390,'height':844},reduced_motion='reduce');pg.on('pageerror',lambda e:results['errors'].append(str(e)))
 pg.goto('http://127.0.0.1:4174/scenario-save-study');pg.wait_for_selector('body[data-story="save"].failed:not(.loading)',timeout=90000);assert pg.url.endswith('#story/save/0')
 results['legacy_save_alias']='pass';results['no_webgl']={}
 for s in stories:
  pg.evaluate('(id)=>location.hash="story/"+id+"/0"',s['id']);pg.wait_for_function('(id)=>document.body.dataset.story===id&&!document.body.classList.contains("loading")',arg=s['id'])
  assert pg.locator('#fallback').evaluate('(e)=>e.complete&&e.naturalWidth>0')
  pg.locator('#story-track button').last.click();pg.wait_for_selector('#story-restart:visible');pg.locator('#story-why').click();assert pg.locator('#story-detail-copy').inner_text()==s['stages'][-1]['detail'];pg.keyboard.press('Escape')
  results['no_webgl'][s['id']]='pass'
 b.close()
 assert not results['errors'],results['errors']
 print('12 films without WebGL and old save address PASS',flush=True)
(OUT/'packaged-verification.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
