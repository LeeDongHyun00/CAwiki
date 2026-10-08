#!/usr/bin/env python3
"""Bake the deterministic final board view using the production camera/materials.
Requires Python Playwright + Chromium. Update after film geometry/camera changes.
?live-monitor=1 forces the reference RTT path while regenerating.
"""
import base64,functools,threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
out=ROOT/'assets/inside/monitor';out.mkdir(exist_ok=True)
source=(ROOT/'lib/inside/study.js').read_text()
anchor='scene.background=null;renderer.setClearColor(0,0);renderer.setRenderTarget(reveal.target);'
hook='''scene.background=null;renderer.setClearColor(0,0);
 const priorSize=renderer.getSize(new graphics.T.Vector2()),priorRatio=renderer.getPixelRatio();
 renderer.setPixelRatio(1);renderer.setSize(1024,576,false);renderer.setRenderTarget(null);renderer.render(scene,camera);
 window.__monitorFrame=renderer.domElement.toDataURL('image/png');
 renderer.setPixelRatio(priorRatio);renderer.setSize(priorSize.x,priorSize.y,false);renderer.setRenderTarget(reveal.target);'''
assert anchor in source
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 for profile in ['desktop','mobile']:
  mobile=profile=='mobile';page=browser.new_page(viewport={'width':390 if mobile else 1440,'height':844 if mobile else 900},device_scale_factor=1,is_mobile=mobile,has_touch=mobile,reduced_motion='reduce')
  page.route('**/lib/inside/study.js*',lambda route:route.fulfill(body=source.replace(anchor,hook),content_type='text/javascript'))
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html?live-monitor=1#screen',wait_until='domcontentloaded')
  page.wait_for_function('window.__monitorFrame',timeout=180000)
  (out/(profile+'.png')).write_bytes(base64.b64decode(page.evaluate('__monitorFrame').split(',')[1]));print(profile,'baked',flush=True);page.close()
 browser.close()
server.shutdown()
