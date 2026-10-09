"""Render catalog stills with the film's exact models and Wiki landing setup."""
from pathlib import Path
import argparse, base64, io
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('models',nargs='*',help='Optional hardware IDs')
parser.add_argument('--url',default='http://127.0.0.1:4173/')
args=parser.parse_args()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1152,'height':864})
    page.goto(args.url+'#wiki')
    ids=page.evaluate('''async()=>{
      const {acquireStage}=await import('/design/redesign/study.js');
      const profile=await import('/design/redesign/hardware-portraits.js');
      const {createCollectionModel}=await import('/design/redesign/collection-models.js');
      const {HARDWARE}=await import('/design/redesign/site-data.js');
      const stage=await acquireStage(),{renderer}=stage;
      renderer.setPixelRatio(1);renderer.setSize(1152,864,false);
      renderer.setClearColor(0xecece9,0);
      window.renderPortrait=id=>{
        const original=id==='mainboard'?stage.computer.board.root:stage.computer.parts[id]?.model.root;
        const root=original||createCollectionModel(id).root;
        const model=profile.portraitModel(root,id,stage.computer.rest[id]);model.assemble(1);
        const scene=profile.portraitScene(stage.environment.texture),camera=profile.portraitCamera(1152,864);
        const pose=profile.portraitPose(model.size,{x:0,y:0,width:1152,height:864},1152,864);
        model.group.position.set(pose.x,pose.y,0);model.group.scale.setScalar(pose.scale);scene.add(model.group);
        renderer.render(scene,camera);
        return renderer.domElement.toDataURL('image/png').split(',')[1];
      };
      return HARDWARE.map(x=>x.id);
    }''')
    if args.models:
        unknown=set(args.models)-set(ids)
        if unknown:parser.error('Unknown model IDs: '+', '.join(sorted(unknown)))
        ids=[id for id in ids if id in args.models]
    for id in ids:
        data=base64.b64decode(page.evaluate('id=>renderPortrait(id)',id))
        Image.open(io.BytesIO(data)).save(ROOT/f'assets/models/redesign/{id}.webp',lossless=True)
        print(id,flush=True)
    browser.close()
