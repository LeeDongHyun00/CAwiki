#!/usr/bin/env python3
"""Capture README GIFs by interacting with the published site (no source hooks)."""
import argparse,asyncio,io,json,hashlib,subprocess,base64
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
from PIL import Image
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
ap=argparse.ArgumentParser();ap.add_argument('--url',default='https://leedonghyun00.github.io/CAwiki/');ap.add_argument('--browser',default='/usr/bin/chromium');ap.add_argument('--only',nargs='+',choices=['film','wiki','hardware','map','scenario','typing'],default=['film','wiki','hardware','map','scenario','typing']);args=ap.parse_args()
OUT=ROOT/'docs/media/current';OUT.mkdir(parents=True,exist_ok=True)
def sample_gif(frames,durations,step=120):
 sampled=[];delays=[];index=0;end=durations[0];total=sum(durations)
 for stamp in range(0,total,step):
  while stamp>=end and index<len(frames)-1:index+=1;end+=durations[index]
  sampled.append(frames[index]);delays.append(min(step,total-stamp))
 return sampled,delays
async def main():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
  page=await browser.new_page(viewport={'width':960,'height':640},device_scale_factor=1);errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  response=await page.goto(args.url+'#wiki',wait_until='networkidle',timeout=120000)
  digest=hashlib.sha256(await response.body()).hexdigest()
  catalog=await page.evaluate("async()=>{const {HARDWARE,STORIES}=await import('inside/data');return {hardware:HARDWARE.map(p=>({id:p.id,title:p.title,name:p.name})),stories:Object.entries(STORIES).map(([id,s])=>({id,title:s.title}))}}")
  (OUT/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
  manifest_path=OUT/'captures.json';manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {'source':args.url,'date':str(datetime.now(ZoneInfo('Asia/Seoul')).date()),'viewport':[960,640],'outputWidth':800,'playback':'Edited playback timing; long captures condensed and GIF frames sampled every 120 ms','captures':{}}
  manifest.update(source=args.url,date=str(datetime.now(ZoneInfo('Asia/Seoul')).date()),htmlSha256=digest,frameIntervalMs=120)
  manifest['sourceCommit']=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip() if hashlib.sha256((ROOT/'index.html').read_bytes()).hexdigest()==digest else None
  async def pause(ms=800):await page.wait_for_timeout(ms)
  async def route(hash):
   await page.evaluate('h=>location.hash=h',hash);await pause(200)
  async def ready(mark):
   await page.wait_for_function('m=>performance.getEntriesByName(m).length>0',arg=mark,timeout=120000)
   await page.wait_for_selector('.scene-exposure',state='detached',timeout=30000);await pause(700)
  async def record(name,action):
   images=[];times=[];session=await page.context.new_cdp_session(page)
   async def capture(event):
    await session.send('Page.screencastFrameAck',{'sessionId':event['sessionId']})
    images.append(Image.open(io.BytesIO(base64.b64decode(event['data']))).convert('RGB').resize((800,533),Image.Resampling.LANCZOS))
    times.append(event['metadata']['timestamp'])
   session.on('Page.screencastFrame',capture)
   await session.send('Page.startScreencast',{'format':'jpeg','quality':90,'maxWidth':960,'maxHeight':640,'everyNthFrame':1})
   await action();await pause(200)
   await session.send('Page.stopScreencast');await pause(100);await session.detach()
   assert len(images)>2, f'No moving frames captured for {name}'
   # A shared palette avoids palette flicker. Only speed and size are changed.
   selected=images[::max(1,len(images)//12)][:12];sheet=Image.new('RGB',(200*len(selected),134))
   for i,img in enumerate(selected):sheet.paste(img.resize((200,134)),(i*200,0))
   palette=sheet.quantize(colors=128)
   frames=[img.quantize(palette=palette,dither=Image.Dither.NONE) for img in images]
   speed=max(1.4,(times[-1]-times[0])/9)
   durations=[max(20,round((b-a)*1000/speed/10)*10) for a,b in zip(times,times[1:])]+[1000]
   frames,durations=sample_gif(frames,durations)
   path=OUT/(name+'.gif');frames[0].save(path,save_all=True,append_images=frames[1:],duration=durations,loop=0,optimize=True,disposal=1)
   images[len(images)//2].save(Path('/tmp')/('cawiki-readme-'+name+'.png'))
   manifest['captures'][name]={'file':path.name,'capturedDate':manifest['date'],'htmlSha256':digest,'startUrl':starts[name],'endUrl':page.url,'frames':Image.open(path).n_frames,'requestedPlaybackSpeed':round(speed,3),'durationMs':sum(durations),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
   manifest['errors']=errors;(OUT/'captures.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(name,manifest['captures'][name],flush=True)
  starts={}
  if 'film' in args.only:
   await route('home');await ready('inside:cpu-visible');await pause(1800);starts['film']=page.url
   async def film():
    await pause(700)
    for p in [.18,.275,.93,1]:
     await page.evaluate("p=>scrollTo({top:p*(document.querySelector('#sequence').offsetHeight-innerHeight),behavior:'smooth'})",p)
     await page.wait_for_function('p=>Math.abs(Number(document.body.dataset.filmProgress)-p)<.003',arg=p,timeout=40000);await pause(650)
   await record('film',film)
  if 'wiki' in args.only:
   await route('wiki');await page.wait_for_selector('#wiki-title:visible');await pause(2000);starts['wiki']=page.url
   async def wiki():
    await pause(700);await page.evaluate("scrollTo({top:530,behavior:'smooth'})");await pause(1300)
    await page.evaluate("scrollTo({top:0,behavior:'smooth'})");await pause(850);await page.locator('[data-wiki-tab=stories]').click();await pause(800)
    await page.evaluate("scrollTo({top:360,behavior:'smooth'})");await pause(1400)
   await record('wiki',wiki)
  if 'hardware' in args.only:
   await route('object/cpu');await ready('inside:object-ready');starts['hardware']=page.url
   async def hardware():
    await pause(700);await page.mouse.move(430,275);await page.mouse.down()
    for i in range(24):await page.mouse.move(430+i*8,275-i*2);await pause(60)
    await page.mouse.up();await pause(500);await page.mouse.wheel(0,-240);await pause(900)
    await page.mouse.move(620,255);await page.mouse.down()
    for i in range(20):await page.mouse.move(620-i*7,255+i*2);await pause(50)
    await page.mouse.up();await pause(800)
   await record('hardware',hardware)
  if 'map' in args.only:
   await route('map');await page.wait_for_selector('#relationship-room-frame');frame=page.frames[-1]
   await frame.wait_for_function("document.body.dataset.mode==='room'&&document.querySelector('#room').dataset.moving==='false'",timeout=120000);starts['map']=page.url
   async def room():
    await pause(900);await frame.locator('[data-group=compute].room-topic').click();await pause(1300)
    await frame.locator('[data-hardware=cpu]').click();await pause(1300)
    await frame.locator('[data-tab=relations]').click();await pause(1000)
    await frame.locator('.detail-peer').first.click();await pause(1600)
   await record('map',room)
  for name,id in [('scenario','boot'),('typing','typing')]:
   if name not in args.only:continue
   before=await page.evaluate("performance.getEntriesByName('inside:scenario-ready').length")
   await route('story/'+id+'/0');await page.wait_for_function("n=>performance.getEntriesByName('inside:scenario-ready').length>n",arg=before,timeout=120000);await page.wait_for_selector('.scene-exposure',state='detached');await pause(700);starts[name]=page.url
   async def scenario():
    await pause(1000)
    for progress in ([.25,.53,.76,1] if id=='boot' else [.18,.36,.58,.8,1]):
     await page.evaluate("p=>scrollTo({top:p*(document.querySelector('#story-sequence').offsetHeight-innerHeight),behavior:'smooth'})",progress)
     await page.wait_for_function('p=>Math.abs(Number(document.body.dataset.storyProgress)-p)<.005',arg=progress,timeout=30000);await pause(800)
   await record(name,scenario)
  await browser.close()
  assert not errors,errors
asyncio.run(main())
