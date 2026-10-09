#!/usr/bin/env python3
"""Mobile pacing must preserve deliberate navigation and resize/storage variants."""
import argparse,functools,json,threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--out',type=Path,required=True);args=ap.parse_args()
root=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/index.html';checks=[];errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True);page.on('pageerror',lambda e:errors.append(str(e)))
 source=(root/'lib/inside/site.js').read_text()+'\nwindow.__story=film;'
 page.route('**/lib/inside/site.js*',lambda r:r.fulfill(body=source,content_type='text/javascript'))
 page.goto(url+'#story/boot/0');page.wait_for_function("window.__story?.id==='boot'&&!__story.preparing",timeout=120000)
 page.locator('#story-track button').last.click();page.wait_for_function('__story.progress===1')
 page.locator('#story-restart').click();page.wait_for_function('__story.progress===0')
 checks.append('Step button and restart jump immediately')
 page.evaluate('__story.seek(.32,true);__story.scrollPacer.start(.32,__story.distance());dispatchEvent(new Event("inside:resize"))')
 assert page.evaluate('__story.scrollPacer.active&&Math.abs(__story.progress-.32)<1e-8')
 checks.append('Viewport resize retains visible progress and touch pacing')
 page.locator('#story-why').click();page.locator('#story-detail-close').click()
 assert page.evaluate('Math.abs(__story.progress-__story.modalProgress)<=1/__story.distance()')
 checks.append('Detail dialog restores the same scene')
 page.emulate_media(reduced_motion='reduce')
 assert not page.evaluate('__story.scrollPacer.active')
 page.emulate_media(reduced_motion='no-preference')
 checks.append('Reduced motion bypasses paced animation')
 page.evaluate("location.hash='story/storage/0'");page.wait_for_function("__story.id==='storage'&&!__story.preparing",timeout=120000)
 for variant in ['hdd','cached','ssd']:
  page.evaluate('v=>__story.changeStorage(v)',variant)
  assert page.evaluate('JSON.stringify(__story.scrollPacer.stops)===JSON.stringify([...__story.config.steps.map(s=>s.at),1])')
 checks.append('SSD/HDD/cache use their own scene boundaries')
 page.evaluate("location.hash='home'");page.wait_for_function("document.body.dataset.mode==='home'&&document.body.classList.contains('ready')",timeout=120000)
 page.locator('#skip-film').click();page.wait_for_function("performance.getEntriesByName('inside:skip-board-ready').length>0",timeout=120000)
 assert abs(float(page.locator('body').get_attribute('data-film-progress'))-.93)<.001
 checks.append('Skip still ends on the assembled board before the monitor')
 page.evaluate('scrollTo(0,document.querySelector("#sequence").offsetHeight-innerHeight)');page.wait_for_function('Number(document.body.dataset.filmProgress)>.995',timeout=30000)
 assert page.locator('#ending .wiki-enter').is_visible() and not page.locator('#ending p').count()
 checks.append('Monitor ending retains the Wiki link without its removed caption')
 page.evaluate("location.hash='wiki'");page.wait_for_selector('#wiki-title:visible');page.wait_for_timeout(2000)
 page.screenshot(path=str(args.out.with_name('wiki-mobile.png')))
 page.locator('[data-wiki-tab=stories]').click();page.screenshot(path=str(args.out.with_name('covers-mobile.png')))
 assert page.locator('#wiki-stories .story-cover').count()==16 and not page.locator('.cover-status').count()
 checks.append('All 16 covers remain; bottom status copy is absent')
 browser.close()
server.shutdown();args.out.write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2)+'\n');print(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False));assert not errors
