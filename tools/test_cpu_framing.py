from pathlib import Path
import base64,io,json
from PIL import Image,ImageChops
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];out=root/'docs/performance/opening-principles';out.mkdir(parents=True,exist_ok=True)
source=(root/'lib/inside/study.js').read_text()+'''\nwindow.cpuCheck={capture:()=>{suspended=true;cancelAnimationFrame(frame);frame=0;size();compose(0,1);renderFilm();return {image:graphics.renderer.domElement.toDataURL('image/png'),camera:graphics.camera.position.toArray(),fov:graphics.camera.fov};}};'''
def box(img):return ImageChops.difference(img.convert('RGB'),Image.new('RGB',img.size,(16,17,19))).convert('L').point(lambda n:255 if n>25 else 0).getbbox()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader']);results=[]
 for mobile in [False,True]:
  page=b.new_page(viewport={'width':390 if mobile else 1440,'height':844 if mobile else 900},is_mobile=mobile,has_touch=mobile,reduced_motion='reduce')
  page.route('**/lib/inside/study.js*',lambda r:r.fulfill(body=source,content_type='text/javascript'))
  page.goto('http://127.0.0.1:4173/index.html#home');page.wait_for_selector('body.ready',timeout=120000)
  for w,h in ([(1440,900),(980,820),(820,1180),(1440,600)] if not mobile else [(390,844),(320,568),(844,390)]):
   page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(150);r=page.evaluate('cpuCheck.capture()');image=Image.open(io.BytesIO(base64.b64decode(r.pop('image').split(',')[1])));live=box(image);image.save(out/f'cpu-{w}-{h}.png')
   poster=page.locator('#cpu-intro').evaluate('e=>({rect:e.getBoundingClientRect().toJSON(),src:e.currentSrc})');im=Image.open(root/('assets/inside/intro/'+('mobile' if mobile else 'desktop')+'.webp'));pbox=box(im);k=poster['rect']['width']/im.width;expected=[poster['rect']['x']+pbox[0]*k,poster['rect']['y']+pbox[1]*k,poster['rect']['x']+pbox[2]*k,poster['rect']['y']+pbox[3]*k]
   error=max(abs(a-b) for a,b in zip(expected,live));results.append({'width':w,'height':h,'compact':mobile,'maxBoundaryError':round(error,2),**r});assert error<3.5,(expected,live,results[-1])
   print('CPU boundary match',results[-1],flush=True)
  page.close()
 (out/'cpu-framing.json').write_text(json.dumps(results,indent=2));b.close()
