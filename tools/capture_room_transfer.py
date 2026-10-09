#!/usr/bin/env python3
"""Capture the missing-image gap before and after the gallery handoff fix."""
import argparse,functools,threading,time,json,io
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
ap=argparse.ArgumentParser();ap.add_argument('--before',type=Path,required=True);ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);ap.add_argument('--out',type=Path,required=True);args=ap.parse_args();out=args.out;out.mkdir(parents=True,exist_ok=True)
records=[]
class H(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
 def do_GET(self):
  if '/room/cpu.webp' in self.path:time.sleep(1.2)
  super().do_GET()
 def copyfile(self,a,b):
  try:super().copyfile(a,b)
  except (BrokenPipeError,ConnectionResetError):pass
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
 for revision,root in [('before',str(args.before.resolve())),('after',str(args.root.resolve()))]:
  server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=root));threading.Thread(target=server.serve_forever,daemon=True).start()
  for profile,w,h in [('desktop',1440,900),('mobile',390,844)]:
   page=b.new_page(viewport={'width':w,'height':h},device_scale_factor=1,is_mobile=profile=='mobile',has_touch=profile=='mobile')
   page.goto(f'http://127.0.0.1:{server.server_port}/index.html#wiki');page.wait_for_selector('#wiki-title:visible');page.evaluate("async()=>{await document.querySelector('#wiki-hardware img').decode()}")
   r=page.locator('#wiki-hardware img').first.bounding_box();box=tuple(round(x) for x in (r['x'],r['y'],r['x']+r['width'],r['y']+r['height']))
   initial=Image.open(io.BytesIO(page.screenshot())).convert('RGB').crop(box)
   page.evaluate("document.querySelector('[data-wiki-tab=map]').click()");page.wait_for_timeout(400)
   preparing=page.evaluate("!document.querySelector('iframe').contentDocument.querySelector('#room').dataset.ready")
   pending=Image.open(io.BytesIO(page.screenshot(path=str(out/f'{profile}-{revision}-preparation.png')))).convert('RGB').crop(box)
   mae=sum(ImageStat.Stat(ImageChops.difference(initial,pending)).mean)/3
   assert preparing
   if revision=='after':assert mae<.1,mae
   records.append({'profile':profile,'revision':revision,'cpuRegionMeanAbsolutePixelError255DuringPreparation':mae,'preparing':preparing,'delayMs':1200,'captureAfterClickMs':400})
   f=page.frames[-1];f.wait_for_function("document.body.dataset.mode==='room' && document.querySelector('#room').dataset.moving==='false'",timeout=30000)
   if revision=='after':
    f.locator('.room-exit').click();page.wait_for_selector('#relationship-room-frame',state='detached');page.mouse.move(0,0);page.screenshot(path=str(out/f'{profile}-after-return.png'))
   page.close()
  server.shutdown()
 b.close()
(out/'visual-checks.json').write_text(json.dumps(records,indent=2)+'\n');print(json.dumps(records,indent=2))
