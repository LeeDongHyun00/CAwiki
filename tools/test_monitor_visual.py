#!/usr/bin/env python3
"""Compare the baked monitor against the live reference and check viewport switching."""
import functools,threading,json
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
root=Path(__file__).resolve().parents[1];out=root/'docs/performance'
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
 def copyfile(self,source,outputfile):
  try:super().copyfile(source,outputfile)
  except (BrokenPipeError,ConnectionResetError):pass  # Expected when a test navigates away.
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start()
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 for mode in ['baked','live']:
  page=browser.new_page(viewport={'width':1440,'height':900},reduced_motion='reduce');page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html'+('?live-monitor=1' if mode=='live' else '')+'#screen',wait_until='domcontentloaded')
  page.wait_for_function("Number(document.body.dataset.filmProgress)>.995",timeout=180000)
  # The end view is the same deterministic pose in reduced motion mode.
  page.locator('#world').screenshot(path=str(out/f'monitor-{mode}.png'));print(mode,'captured',flush=True)
  if mode=='baked':
   page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(500)
   page.wait_for_function("performance.getEntriesByName('inside:monitor-ready').length>=2",timeout=120000)
   assert not page.evaluate("document.body.classList.contains('failed')")
   page.locator('#world').screenshot(path=str(out/'monitor-mobile.png'));print('Viewport switch captured',flush=True)
  page.close()
 browser.close()
server.shutdown()
a=Image.open(out/'monitor-baked.png').convert('RGB');b=Image.open(out/'monitor-live.png').convert('RGB');difference=ImageStat.Stat(ImageChops.difference(a,b))
result={'viewport':[1440,900],'bakedVsLiveRgbMeanAbsoluteError':sum(difference.mean)/3,'scale':255,'pageErrors':errors,'viewportSwitch':'desktop to mobile monitor profile loaded'}
assert not errors,errors
assert result['bakedVsLiveRgbMeanAbsoluteError']<8,result
(out/'monitor-visual.json').write_text(json.dumps(result,indent=2)+'\n');print(result)
