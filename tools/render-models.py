"""Regenerate static map previews from the actual meshes. Requires Playwright + Pillow.
Run the static server first: python3 serve.py 4173
Then: python3 tools/render-models.py
"""
from pathlib import Path
from io import BytesIO
import base64
from PIL import Image
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
out=root/'assets/models'
out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page()
    page.goto('http://127.0.0.1:4173/tools/render-models.html')
    page.wait_for_function('window.renderModel !== undefined')
    for name in page.evaluate('window.modelIds'):
        data=page.evaluate('id => window.renderModel(id)',name)
        img=Image.open(BytesIO(base64.b64decode(data.split(',')[1]))).convert('RGBA')
        bounds=img.getbbox()
        assert bounds, f'Empty render: {name}'
        img=img.crop(bounds)
        img.thumbnail((800,650),Image.Resampling.LANCZOS)
        padded=Image.new('RGBA',(img.width+24,img.height+24))
        padded.paste(img,(12,12))
        padded.save(out/f'{name}.png',optimize=True)
        if name=='dram': padded.transpose(Image.Transpose.ROTATE_90).save(out/'dram-vertical.png',optimize=True)
        print(name, img.size, flush=True)
    browser.close()
