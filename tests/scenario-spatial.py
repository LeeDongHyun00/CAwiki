"""Render all story steps, then prove depth, physical motion, screens and restoration."""
from pathlib import Path
from io import BytesIO
import os,json,base64
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts/scenario-spatial';OUT.mkdir(exist_ok=True)
STORIES=json.loads((ROOT/'design/redesign/expansion/storyboards.json').read_text());PHASE=os.environ.get('CAWIKI_SPATIAL_PHASE','all');RESULT=OUT/'verification.json';results=json.loads(RESULT.read_text()) if PHASE!='all' and RESULT.exists() else {'errors':[]}
def save():RESULT.write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
def diff(a,b):return max(ImageStat.Stat(ImageChops.difference(Image.open(BytesIO(a)).convert('RGB'),Image.open(BytesIO(b)).convert('RGB'))).mean)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader']);page=browser.new_page(viewport={'width':1280,'height':800},reduced_motion='reduce')
 page.on('pageerror',lambda e:results['errors'].append(str(e)));page.on('console',lambda m:results['errors'].append(m.text[:1000]) if m.type=='error' else None)
 page.goto('http://127.0.0.1:4173/#story/typing/0');page.wait_for_selector('body[data-story="typing"]:not(.loading)',timeout=90000)
 page.evaluate('''async()=>{const {ScenarioMechanisms}=await import('/design/redesign/scenario-mechanisms.js');const update=ScenarioMechanisms.prototype.update;ScenarioMechanisms.prototype.update=function(...args){window.inspectedMotion=this;return update.apply(this,args);};}''')
 def route(id,index=0):
  page.evaluate('([id,i])=>location.hash="story/"+id+"/"+i',[id,index]);page.wait_for_function('([id,i])=>document.body.dataset.story===id&&+document.body.dataset.storyStep===i&&!document.body.classList.contains("loading")',arg=[id,index],timeout=90000)
 def seek(t):
  page.evaluate('(p)=>scrollTo({top:Math.round(p*(document.querySelector("#story-sequence").offsetHeight-innerHeight)),behavior:"instant"})',t)
  page.wait_for_function('Math.abs(+document.body.dataset.storyProgress-scrollY/(document.querySelector("#story-sequence").offsetHeight-innerHeight))<.000015',timeout=45000)
 def scene(id,i):
  route(id);page.locator('#story-track button').nth(i).click();page.wait_for_function('(i)=>+document.body.dataset.storyStep===i',arg=i)
 if PHASE in ['all','stages']:
  results['stages']={};results['scene_modes']=[]
  for s in STORIES:
   route(s['id']);assert page.locator('#story-track button').count()==len(s['stages'])
   for i,stage in enumerate(s['stages']):
    page.locator('#story-track button').nth(i).click();page.wait_for_function('(i)=>+document.body.dataset.storyStep===i',arg=i)
    assert page.locator('#story-title').inner_text()==stage['title'];assert not page.locator('body.failed').count();assert page.locator('canvas').count()==1
    if i>0:
     mode=page.evaluate('inspectedMotion.signals.f.config.steps[+document.body.dataset.storyStep].visual.mode');results['scene_modes'].append(mode)
     if mode!='screen':assert page.locator('.scenario-cue:visible').count()>0,(s['id'],i,'missing component point')
     if i in [len(s['stages'])//2,len(s['stages'])-1]:page.screenshot(path=str(OUT/f'{s["id"]}-{i}.png'))
   results['stages'][s['id']]=len(s['stages']);save();print(s['id'],len(s['stages']),'rendered PASS',flush=True)
  results['scene_modes']=sorted(set(results['scene_modes']));save()
 if PHASE in ['all','motion']:
  page.emulate_media(reduced_motion='no-preference');results['component_motion']={}
  for id,i in [('multitasking',3),('multitasking',5),('streaming',3),('save',5),('record',2),('music',4),('call',5),('ai',4)]:
   route(id);s=next(s for s in STORIES if s['id']==id);start=s['stages'][i]['at'];end=s['stages'][i+1]['at'];a=start+(end-start)*.17;z=start+(end-start)*.47
   seek(a);page.evaluate('inspectedMotion.panel.visible=false;inspectedMotion.film.stage.renderer.render(inspectedMotion.film.scene,inspectedMotion.film.camera)');first=page.locator('#world').screenshot()
   seek(z);page.evaluate('inspectedMotion.panel.visible=false;inspectedMotion.film.stage.renderer.render(inspectedMotion.film.scene,inspectedMotion.film.camera)');last=page.locator('#world').screenshot();delta=diff(first,last);assert delta>.05,(id,i,delta)
   seek(a);page.evaluate('inspectedMotion.panel.visible=false;inspectedMotion.film.stage.renderer.render(inspectedMotion.film.scene,inspectedMotion.film.camera)');reverse=diff(first,page.locator('#world').screenshot());assert reverse<.15,(id,i,reverse)
   results['component_motion'][id+'/'+str(i)]={'change':delta,'reverse':reverse};save()
  print('Real component motion with explanatory sheet hidden / reverse PASS',flush=True)
 if PHASE in ['all','motion','screens']:
  page.emulate_media(reduced_motion='no-preference');results.setdefault('monitor_motion',{})
  for s in STORIES:
   selected=os.environ.get('CAWIKI_SCREEN_STORIES','').split(',')
   if selected!=[''] and s['id'] not in selected:continue
   route(s['id']);start=s['stages'][-1]['at']
   def screen(t):
    seek(start+(1-start)*t);return base64.b64decode(page.evaluate('(id)=>(id==="call"?inspectedMotion.film.remoteScreenMap:inspectedMotion.film.screenMap).image.toDataURL().split(",")[1]',s['id']))
   a=screen(.08);z=screen(.88);d=diff(a,z);assert d>.02,(s['id'],d);assert diff(a,screen(.08))<.01
   results['monitor_motion'][s['id']]={'change':d,'reverse':diff(a,screen(.08))};save()
  print('All 12 monitor textures progress through the actual final scene clock PASS',flush=True)
 if PHASE in ['all','layers']:
  page.emulate_media(reduced_motion='reduce');scene('typing',3)
  assert page.evaluate('inspectedMotion.panel.visible&&!inspectedMotion.panel.material.depthTest&&!inspectedMotion.panel.material.depthWrite&&inspectedMotion.panel.renderOrder>=10000')
  # An opaque mesh closer to the camera must still not cover the explanatory sheet.
  page.evaluate('''async()=>{const T=await import('/lib/vendor/three/three.module.js');const f=inspectedMotion.film;window.testOccluder=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshBasicMaterial({color:0x14252c}));testOccluder.position.copy(f.camera.position).add(f.camera.getWorldDirection(new T.Vector3()).multiplyScalar(.5));testOccluder.quaternion.copy(f.camera.quaternion);f.scene.add(testOccluder);f.stage.renderer.render(f.scene,f.camera);}''')
  front=page.locator('#world').screenshot();page.evaluate('inspectedMotion.panel.visible=false;inspectedMotion.film.stage.renderer.render(inspectedMotion.film.scene,inspectedMotion.film.camera)');covered=page.locator('#world').screenshot();assert diff(front,covered)>.2
  page.evaluate('testOccluder.removeFromParent();testOccluder.geometry.dispose();testOccluder.material.dispose();inspectedMotion.film.wake()')
  for id,i in [('music',4),('multitasking',3),('save',7)]:
   scene(id,i);page.locator('#story-why').click();assert page.locator('#story-detail').evaluate('(e)=>{const b=e.getBoundingClientRect();return e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}');page.screenshot(path=str(OUT/f'dialog-{id}.png'));page.keyboard.press('Escape')
  results['explanation_layer']='pass';save();print('Explanatory sheet over physical occluder / native dialog above models PASS',flush=True)
 if PHASE in ['all','mobile']:
  page.emulate_media(reduced_motion='reduce');page.set_viewport_size({'width':390,'height':844});results['mobile']={}
  for id,i in [('multitasking',3),('streaming',3),('save',5),('record',2),('music',4),('typing',3),('usb',1),('call',5),('ai',4)]:
   scene(id,i);assert page.evaluate('document.documentElement.scrollWidth===innerWidth')
   boxes=page.locator('.scenario-cue:visible span').evaluate_all('(es)=>es.map(e=>{const b=e.getBoundingClientRect();return {x:b.x,right:b.right,y:b.y,bottom:b.bottom}})');assert boxes,(id,'no component cue');assert all(b['x']>=0 and b['right']<=390 and b['y']>=0 and b['bottom']<600 for b in boxes),(id,boxes)
   assert page.locator('#story-copy').evaluate('(e)=>e.getBoundingClientRect().bottom<innerHeight-90');page.screenshot(path=str(OUT/f'mobile-{id}.png'));results['mobile'][id]='pass';save()
  print('Mobile component points, labels and captions PASS',flush=True)
 if PHASE in ['all','restore']:
  page.set_viewport_size({'width':1280,'height':800});page.emulate_media(reduced_motion='reduce');scene('music',4);scene('record',2);scene('save',5);scene('multitasking',3)
  page.evaluate('location.hash="system"');page.wait_for_selector('body[data-mode="home"]:not(.loading)');page.wait_for_timeout(300);a=page.locator('#world').screenshot()
  page.reload();page.wait_for_selector('body.ready:not(.loading)',timeout=90000);page.wait_for_timeout(300);d=diff(a,page.locator('#world').screenshot());assert d<1,d
  results['main_restoration_difference']=d;save();print('Borrowed materials / covers / shared main scene restored PASS',flush=True)
 if PHASE in ['all','state']:
  page.emulate_media(reduced_motion='no-preference');route('usb');seek(.11)
  emit=page.evaluate('''()=>{const a=[];inspectedMotion.film.extras.usb.root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.emissive?.getHex())a.push(m.emissiveIntensity);});return Math.max(...a);}''')
  assert emit>1,emit
  route('sleep');s=next(s for s in STORIES if s['id']=='sleep');i=next(i for i,b in enumerate(s['stages']) if b['effect']=='power-low');at=s['stages'][i]['at']
  seek(at-.00015);before=page.evaluate('inspectedMotion.film.key.intensity');seek(at+.00015);after=page.evaluate('inspectedMotion.film.key.intensity');assert abs(before-after)<.02,(before,after)
  results['native_states']={'usb_connected_emission':emit,'sleep_light_boundary_difference':abs(before-after)};save();print('USB connected light and continuous sleep lighting PASS',flush=True)
 assert not results['errors'],results['errors'];save();browser.close()
print('PASS',PHASE,flush=True)
