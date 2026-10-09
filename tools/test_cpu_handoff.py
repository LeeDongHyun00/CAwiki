"""Delay the live film to test poster resizing before the WebGL handoff."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1];out=root/'docs/performance/opening-principles';out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':1440,'height':900});pending=[];errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/lib/inside/study.js*',lambda r:pending.append(r))
 page.goto('http://127.0.0.1:4173/index.html#home',wait_until='commit')
 page.wait_for_function('document.querySelector("#cpu-intro")?.naturalWidth>0 && getComputedStyle(document.querySelector("#cpu-intro")).opacity==="1"')
 page.set_viewport_size({'width':980,'height':820});page.wait_for_timeout(200)
 before=page.locator('#cpu-intro').bounding_box();page.screenshot(path=str(out/'cold-before.png'))
 source=(root/'lib/inside/study.js').read_text().replace("document.body.classList.add('ready');performance.mark('inside:cpu-visible');", "window.firstCPU={camera:graphics.camera.position.toArray(),fov:graphics.camera.fov,progress,until:introHandoffUntil};document.body.classList.add('ready');performance.mark('inside:cpu-visible');")
 assert pending
 pending[0].fulfill(body=source,content_type='text/javascript')
 page.wait_for_selector('body.ready',timeout=120000);page.wait_for_timeout(250)
 after=page.locator('#cpu-intro').bounding_box();assert before==after,(before,after)
 assert page.locator('#cpu-intro').evaluate('e=>getComputedStyle(e).opacity')=='0'
 record=page.evaluate('firstCPU');assert abs(record['fov']-32.7588974909)<1e-6
 page.screenshot(path=str(out/'cold-after.png'));assert not errors,errors
 (out/'cold-handoff.json').write_text(json.dumps({'before':before,'after':after,'firstFrame':record,'errors':errors},indent=2))
 print('Pre-WebGL resize / stable poster rectangle / matching first live projection / normal-motion handoff PASS');b.close()
