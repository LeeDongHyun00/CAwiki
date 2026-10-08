#!/usr/bin/env python3
"""Bake the actual first film frame (same CPU, materials, lights and camera).

Requires Python Playwright, Chromium and Pillow. No asset-rendering code ships
to the browser. Regenerate after changing the opening film scene.
"""
import base64,functools,io,threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
source=(ROOT/'lib/inside/study.js').read_text()
anchor="renderFilm();introStart=performance.now();"
assert anchor in source
hook="renderFilm();window.__cpuFrame=renderer.domElement.toDataURL('image/png');introStart=performance.now();"
out=ROOT/'assets/inside/intro';out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 for profile,width,height in [('desktop',1440,900),('mobile',390,844)]:
  page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=profile=='mobile',has_touch=profile=='mobile',reduced_motion='reduce')
  page.route('**/lib/inside/study.js*',lambda route:route.fulfill(body=source.replace(anchor,hook),content_type='text/javascript'))
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html#home',wait_until='domcontentloaded')
  page.wait_for_function('window.__cpuFrame',timeout=120000)
  image=Image.open(io.BytesIO(base64.b64decode(page.evaluate('__cpuFrame').split(',')[1])))
  image.save(out/(profile+'.webp'),lossless=True,method=6)
  print(profile,image.size,flush=True);page.close()
 browser.close()
server.shutdown()
