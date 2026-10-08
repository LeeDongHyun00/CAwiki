"""Render the authored USB model to a finite 30-frame thumbnail atlas.
Requires serve.py 4173, Playwright, Chromium and Pillow. --preview renders only endpoints.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
import argparse,base64,io
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--preview',action='store_true');args=parser.parse_args()
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts/usb-cover';OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':800,'height':480});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:4173/tools/usb-cover/');page.wait_for_function('window.usbReady',timeout=90000)
 atlas=Image.new('RGB',(4800,2400))
 for i in ([0,29] if args.preview else range(30)):
  page.evaluate('(p)=>window.usbScene.setProgress(p)',i/29)
  data=page.locator('canvas').evaluate('(c)=>c.toDataURL("image/png").split(",")[1]')
  frame=Image.open(io.BytesIO(base64.b64decode(data))).convert('RGB').resize((800,480),Image.Resampling.LANCZOS)
  atlas.paste(frame,((i%6)*800,(i//6)*480))
  if i in [0,14,29]:frame.save(OUT/f'model-{i:02}.png')
  print(f'USB model frame {i+1}/30',flush=True)
 assert not errors,errors
 b.close()
 if not args.preview:
  target=ROOT/'assets/scenarios/usb-action-atlas.webp';atlas.save(target,quality=91,method=6)
  print(f'{target} ({target.stat().st_size:,} bytes)')
