"""Source-aware GPU frames, faceless call motion and the actual sleep action."""
from pathlib import Path
from io import BytesIO
import base64,json,os
from PIL import Image,ImageChops,ImageStat
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts/scenario-frame-redesign';OUT.mkdir(exist_ok=True)
STORIES=json.loads((ROOT/'design/redesign/expansion/storyboards.json').read_text());VISUALS=json.loads((ROOT/'design/redesign/expansion/visuals.json').read_text());results={'errors':[],'gpu':{},'mobile':{}}
selected=[s for s in os.environ.get('CAWIKI_FRAME_CASES','').split(',') if s]
if selected:results=json.loads((OUT/'verification.json').read_text())
def difference(a,b):return max(ImageStat.Stat(ImageChops.difference(Image.open(BytesIO(a)).convert('RGB'),Image.open(BytesIO(b)).convert('RGB'))).mean)
def save():(OUT/'verification.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':1280,'height':800},reduced_motion='reduce')
 page.on('pageerror',lambda e:results['errors'].append(str(e)));page.on('console',lambda m:results['errors'].append(m.text[:1000]) if m.type=='error' else None)
 page.goto('http://127.0.0.1:4173/#story/call/0');page.wait_for_selector('body[data-story="call"]:not(.loading)',timeout=90000)
 page.evaluate('''async()=>{const {ScenarioMechanisms}=await import('/design/redesign/scenario-mechanisms.js');const update=ScenarioMechanisms.prototype.update;ScenarioMechanisms.prototype.update=function(...args){window.film=this.film;return update.apply(this,args);};}''')
 def route(id,i=0):
  page.evaluate('([id,i])=>location.hash="story/"+id+"/"+i',[id,i]);page.wait_for_function('([id,i])=>document.body.dataset.story===id&&+document.body.dataset.storyStep===i&&!document.body.classList.contains("loading")',arg=[id,i],timeout=90000)
 def seek(value):
  page.evaluate('(p)=>scrollTo({top:Math.round(p*(document.querySelector("#story-sequence").offsetHeight-innerHeight)),behavior:"instant"})',value)
  page.wait_for_function('Math.abs(+document.body.dataset.storyProgress-scrollY/(document.querySelector("#story-sequence").offsetHeight-innerHeight))<.000015',timeout=45000)
 def at(s,i,t):
  start=s['stages'][i]['at'];end=s['stages'][i+1]['at'] if i+1<len(s['stages']) else 1;seek(start+(end-start)*t)
 def texture(remote=False):return base64.b64decode(page.evaluate('(remote)=>(remote?film.remoteScreenMap:film.screenMap).image.toDataURL().split(",")[1]',remote))
 page.emulate_media(reduced_motion='no-preference')
 for s in STORIES:
  for i,step in enumerate(s['stages']):
   if VISUALS[step['effect']]['mode']!='graphics':continue
   if selected and s['id']+'/'+str(i) not in selected:continue
   route(s['id']);at(s,i,.18);first=page.locator('#world').screenshot();at(s,i,.47);last=page.locator('#world').screenshot(path=str(OUT/f'{s["id"]}-{i}.png'))
   count=page.evaluate('film.motion.signals.frames.mesh.count');assert count>0,(s['id'],i,'no source image')
   delta=difference(first,last);assert delta>.05,(s['id'],i,delta)
   at(s,i,.18);reverse=difference(first,page.locator('#world').screenshot());assert reverse<.15,(s['id'],i,reverse)
   results['gpu'][s['id']+'/'+str(i)]={'source_fragments':count,'change':delta,'reverse':reverse};save();print(s['id'],i,'GPU source image / reverse PASS',flush=True)
 route('ai',4);assert page.evaluate('film.motion.signals.frames.mesh.count')==0,'AI arithmetic must not show a media frame';results['ai_not_a_video_frame']='pass'
 page.screenshot(path=str(OUT/'ai-matrix.png'))
 s=next(s for s in STORIES if s['id']=='call');route('call');at(s,8,.30);a=texture(True);(OUT/'call-pictogram-before.png').write_bytes(a);at(s,8,.88);z=texture(True);(OUT/'call-pictogram-after.png').write_bytes(z);assert difference(a,z)>.1;at(s,8,.30);assert difference(a,texture(True))==0;results['call_motion']='pass'
 s=next(s for s in STORIES if s['id']=='sleep');route('sleep');screens={}
 for name,t in [('desktop',.01),('menu',.25),('select',.38),('off',.74)]:
  at(s,0,t);screens[name]=texture();(OUT/f'sleep-{name}-screen.png').write_bytes(screens[name]);page.screenshot(path=str(OUT/f'sleep-{name}.png'))
 assert difference(screens['desktop'],screens['menu'])>1
 assert max(ImageStat.Stat(Image.open(BytesIO(screens['off'])).convert('RGB')).mean)<10
 at(s,0,.25);assert difference(screens['menu'],texture())==0
 at(s,6,1);resumed=Image.open(BytesIO(texture())).convert('RGB');before=Image.open(BytesIO(screens['desktop'])).convert('RGB');area=(260,85,780,360)
 assert max(ImageStat.Stat(ImageChops.difference(before.crop(area),resumed.crop(area))).mean)<.01;results['sleep_menu_off_and_same_work_resume']='pass';save();print('Call pictogram / sleep menu, blackout, reverse and same document restore PASS',flush=True)
 page.emulate_media(reduced_motion='reduce');page.set_viewport_size({'width':390,'height':844})
 for id,i in [('typing',5),('streaming',5),('call',3),('call',6),('call',8),('loading',4),('loading',5),('record',1),('record',2),('record',6)]:
  route(id,i);assert not page.locator('body.failed').count();assert page.evaluate('document.documentElement.scrollWidth===innerWidth')
  boxes=page.locator('.scenario-cue:visible span').evaluate_all('(es)=>es.map(e=>{let b=e.getBoundingClientRect();return {x:b.x,right:b.right,y:b.y,bottom:b.bottom}})');assert all(z['x']>=0 and z['right']<=390 and z['bottom']<610 for z in boxes),(id,i,boxes)
  page.screenshot(path=str(OUT/f'mobile-{id}-{i}.png'));results['mobile'][id+'/'+str(i)]='pass';save()
 page.emulate_media(reduced_motion='no-preference');route('sleep');at(s,0,.30);page.screenshot(path=str(OUT/'mobile-sleep-menu.png'))
 page.locator('#story-why').click();assert page.locator('#story-detail').evaluate('(e)=>{let b=e.getBoundingClientRect();return e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))}');page.keyboard.press('Escape')
 results['mobile']['sleep-menu']='pass';assert not results['errors'],results['errors'];save();b.close()
print('PASS source-aware frame redesign',flush=True)
