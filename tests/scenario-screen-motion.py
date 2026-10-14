"""Monitor results are reversible animated scenes, not static ending cards."""
from pathlib import Path
from io import BytesIO
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat,ImageDraw
import json
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts/scenario-spatial';OUT.mkdir(exist_ok=True)
stories=json.loads((ROOT/'design/redesign/expansion/storyboards.json').read_text());results={}
def difference(a,b):return max(ImageStat.Stat(ImageChops.difference(Image.open(BytesIO(a)).convert('RGB'),Image.open(BytesIO(b)).convert('RGB'))).mean)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);pg=b.new_page(viewport={'width':960,'height':540});errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.route('**/__screen_test',lambda r:r.fulfill(content_type='text/html',body='<style>body{margin:0;background:#111}</style><canvas width="960" height="540"></canvas>'))
 pg.goto('http://127.0.0.1:4173/__screen_test');pg.evaluate('async()=>{window.draw=(await import("/design/redesign/scenario-screen.js")).paintScenarioScreen;window.ctx=document.querySelector("canvas").getContext("2d");}')
 for s in stories:
  e=s['stages'][-1]['effect']
  def frame(t):
   pg.evaluate('([id,e,t])=>draw(ctx,id,e,t,.92+.08*t,{remote:id==="call"})',[s['id'],e,t]);return pg.locator('canvas').screenshot()
  a=frame(.08);(OUT/f'screen-{s["id"]}-before.png').write_bytes(a);z=frame(.88);(OUT/f'screen-{s["id"]}-after.png').write_bytes(z);d=difference(a,z)
  assert d>.02,(s['id'],d);assert difference(a,frame(.08))==0
  results[s['id']]={'visual_change':d,'reverse_difference':0};print(s['id'],round(d,3),'PASS',flush=True)
  if s['id'] in ['ai','multitasking']:
   previous=s['stages'][-2]['effect']
   pg.evaluate('([id,e])=>draw(ctx,id,e,1,.92)',[s['id'],previous]);before=pg.locator('canvas').screenshot()
   pg.evaluate('([id,e])=>draw(ctx,id,e,0,.92)',[s['id'],e]);boundary=difference(before,pg.locator('canvas').screenshot());assert boundary==0,(s['id'],boundary)
   results[s['id']]['final_scene_boundary_difference']=boundary
 assert not errors,errors;b.close()
(OUT/'screen-motion.json').write_text(json.dumps(results,indent=2)+'\n')
canvas=Image.new('RGB',(1440,2160),'#111416');draw=ImageDraw.Draw(canvas)
for i,s in enumerate(stories):
 for col,state in enumerate(['before','after']):
  im=Image.open(OUT/f'screen-{s["id"]}-{state}.png');im.thumbnail((360,203));x=(i%2)*720+col*360;y=(i//2)*360;canvas.paste(im,(x,y+22));draw.text((x+10,y+5),s['id']+' / '+state,fill='white')
canvas.save(OUT/'screens-contact.jpg',quality=90)
