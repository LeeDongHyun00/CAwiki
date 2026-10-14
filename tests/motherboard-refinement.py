"""Regression checks for the monitor zoom, GPU layout, skip and motherboard-only sequence.
Uses actual browser renders; run serve.py 4173 first.
"""
from pathlib import Path
from io import BytesIO
import json
import os
from PIL import Image, ImageChops, ImageDraw
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/motherboard-refinement'
OUT.mkdir(exist_ok=True)
BASE=os.environ.get('CAWIKI_TEST_URL','http://127.0.0.1:4173/')
BROWSER=os.environ.get('CAWIKI_CHROMIUM','/usr/bin/chromium')

def seek(page,value):
    page.evaluate('(p)=>scrollTo({top:p*(document.querySelector("#sequence").offsetHeight-innerHeight),behavior:"instant"})',value)
    page.wait_for_function('(p)=>Math.abs(Number(document.body.dataset.filmProgress)-p)<.00015',arg=value,timeout=45000)
    page.wait_for_timeout(250)

def screen_ink(page,path):
    # Measure rendered dark hardware only inside the projected active display,
    # excluding the bezel, stand and desktop peripherals. This catches the old
    # mobile counter-zoom even if the outer monitor is moving away correctly.
    corners=page.evaluate('''()=>{const {T,reveal}=testStage;
      return [[-8,-4.5],[8,-4.5],[8,4.5],[-8,4.5]].map(([x,y])=>{
        const p=reveal.display.localToWorld(new T.Vector3(x,y,0)).project(reveal.camera);
        return [(p.x+1)*innerWidth/2,(1-p.y)*innerHeight/2];});}''')
    image=Image.open(BytesIO(page.locator('#world').screenshot(path=str(path)))).convert('L')
    cx=sum(x for x,y in corners)/4;cy=sum(y for x,y in corners)/4
    mask=Image.new('L',image.size);draw=ImageDraw.Draw(mask)
    draw.polygon([(cx+(x-cx)*.97,cy+(y-cy)*.97) for x,y in corners],fill=255)
    ink=ImageChops.multiply(image.point(lambda p:255 if p<145 else 0),mask)
    area=sum(ink.histogram()[255:])
    full_area=abs(sum(corners[i][0]*corners[(i+1)%4][1]-corners[(i+1)%4][0]*corners[i][1] for i in range(4)))/2
    return {'pixels':area,'relative':area/full_area}

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=BROWSER,args=['--no-sandbox','--enable-unsafe-swiftshader'])
    errors=[];report={}
    for label,width,height in [('desktop',1200,850),('mobile',390,844)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE+'#journey');page.wait_for_selector('body.ready',timeout=120000)
        module='inside/study' if 'inside-site.html' in BASE else '/design/redesign/study.js'
        page.evaluate('''async (module)=>{const m=await import(module);window.testStage=await m.acquireStage();m.resumeCinema();}''',module)
        seek(page,.06);assert page.locator('#skip-film').is_hidden()
        seek(page,.18);assert page.locator('#skip-film').is_visible()
        box=page.locator('#skip-film').bounding_box();assert 0<=box['x'] and box['x']+box['width']<=width
        page.screenshot(path=str(OUT/(label+'-skip.png')))
        page.locator('#skip-film').click()
        page.wait_for_function('document.body.dataset.chapter==="system"')
        assert page.locator('#ending').is_hidden() and page.locator('#skip-film').is_hidden()
        assert page.evaluate('Math.abs(Number(document.body.dataset.filmProgress)-.93)<.001')
        assert page.locator('#world').evaluate('(el)=>el===document.activeElement')
        seek(page,.9398)
        layout=page.evaluate('''()=>{const {T,computer,camera}=testStage;
          computer.root.updateMatrixWorld(true);
          const measure=root=>{const box=new T.Box3().setFromObject(root),points=[];
            for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
              const p=new T.Vector3(x,y,z).project(camera);points.push([p.x,-p.y]);}
            return {z:[box.min.z,box.max.z],top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))};};
          return {board:measure(computer.board.root),gpu:measure(computer.parts.gpu.model.root)};}''')
        assert layout['gpu']['z'][0]>layout['board']['z'][1],layout
        assert layout['gpu']['top']>layout['board']['bottom']-.025,layout
        assert layout['gpu']['bottom']<.94,layout
        page.screenshot(path=str(OUT/(label+'-system.png')))
        frames=[]
        for value in [.95,.965,.98,1.0]:
            seek(page,value);frames.append(screen_ink(page,OUT/f'{label}-reveal-{value}.png'))
        for before,after in zip(frames,frames[1:]):
            assert after['pixels']<before['pixels']*.97,(label,'hardware must shrink in viewport',frames)
            assert after['relative']<before['relative']*.99,(label,'hardware must shrink inside monitor too',frames)
        report[label]={'gpu':layout,'monitor':frames}
        print(label+': GPU below board, skip before monitor, continuous content shrink PASS',flush=True)
        for value in [.834, .836, .86, .88]:
            seek(page,value)
            assert page.locator('body').get_attribute('data-chapter') in ['io','system']
        assert page.evaluate('!("peripherals" in testStage.computer.parts)')
        assert page.locator('[data-scene="peripherals"]').count()==0
        print('Rear I/O joins directly to motherboard overview; no peripheral showcase PASS',flush=True)
        page.close()
    assert not errors,errors
    (OUT/'checks.json').write_text(json.dumps(report,indent=2))
    browser.close()
