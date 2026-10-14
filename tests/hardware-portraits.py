from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
import json
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts/hardware-portraits';OUT.mkdir(exist_ok=True)
s=(ROOT/'design/redesign/wiki-arrival.js').read_text().replace('this.page=page;','window.__arrival=this;this.page=page;')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':1200,'height':800},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/wiki-arrival.js',lambda r:r.fulfill(body=s,content_type='text/javascript'))
 page.goto('http://127.0.0.1:4173/#screen');page.wait_for_selector('body.ready',timeout=90000);page.wait_for_function('Number(document.body.dataset.filmProgress)>.9999',timeout=60000);page.wait_for_timeout(1700)
 page.evaluate('''() => {const a=__arrival,tick=a.tick;a.tick=t=>{tick(t);if(a.active&&a.elapsed>=a.landAt){cancelAnimationFrame(a.frame);a.frame=0;window.paused=true;}};}''')
 page.locator('.wiki-enter').click();page.wait_for_function('window.paused',timeout=90000)
 # Force the two actual transition endpoints; freeze UI identically.
 page.evaluate('''()=>{const a=__arrival;a.elapsed=a.landAt;a.tick(0);cancelAnimationFrame(a.frame);a.canvas.style.opacity=1;for(const i of a.items)i.card.el.style.setProperty('--arrival-image',0);}''')
 page.screenshot(path=str(OUT/'live-landing.png'))
 rects=page.locator('#wiki-hardware>li:nth-child(-n+2) figure').evaluate_all('(els)=>els.map(e=>e.getBoundingClientRect().toJSON())')
 page.evaluate('''()=>{const a=__arrival;a.canvas.style.opacity=0;for(const i of a.items)i.card.el.style.setProperty('--arrival-image',1);}''')
 page.screenshot(path=str(OUT/'catalog-still.png'))
 live=Image.open(OUT/'live-landing.png').convert('RGB');still=Image.open(OUT/'catalog-still.png').convert('RGB');results=[]
 for id,r in zip(['cpu','gpu'],rects):
  box=tuple(round(v) for v in (r['x'],r['y'],r['x']+r['width'],r['y']+r['height']))
  diff=ImageChops.difference(live.crop(box),still.crop(box));mae=sum(ImageStat.Stat(diff).mean)/3;results.append({'id':id,'mean_pixel_difference':mae});diff.save(OUT/(id+'-difference.png'))
 assert not errors,errors
 print(json.dumps(results),flush=True)
 (OUT/'comparison.json').write_text(json.dumps(results,indent=2)+'\n')
 assert all(r['mean_pixel_difference']<3 for r in results),results
 b.close()
