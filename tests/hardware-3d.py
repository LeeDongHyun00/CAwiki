"""Browser integration coverage. Run with the static server on :4173.
Requires Python Playwright and Chromium; no runtime npm install is needed.
"""
import json, struct
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:4173/'
ARGS=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=ARGS)
    page=browser.new_page(viewport={'width':1440,'height':1050},reduced_motion='reduce')
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('response',lambda r:errors.append(f'{r.status} {r.url}') if r.status>=400 and 'favicon' not in r.url else None)
    page.goto(BASE+'hardware-3d.html?hw=ram')
    page.wait_for_function('window.hardwareStudio?.id === "dram" && hardwareStudio.renderer.info.render.triangles > 0')
    ids=page.locator('.model-card').evaluate_all('(els)=>els.map(e=>e.dataset.model)')
    assert len(ids)==23
    for key in ids:
        page.locator(f'[data-model="{key}"]').click()
        page.wait_for_function('(id)=>hardwareStudio.id===id && hardwareStudio.renderer.info.render.triangles>0',arg=key)
        assert page.locator('#model-list img').evaluate_all('(imgs)=>imgs.every(i=>i.complete && i.naturalWidth>0)')
        assert page.evaluate('hardwareStudio.model.children.length>0')
    print('All 23 models, previews, URL selection: PASS')
    page.locator('[data-model="cpu"]').click()
    before=page.evaluate('hardwareStudio.camera.position.toArray()')
    page.locator('#viewport').focus();page.keyboard.press('ArrowLeft')
    page.wait_for_function('(before)=>JSON.stringify(hardwareStudio.camera.position.toArray())!==JSON.stringify(before)',arg=before)
    page.locator('[data-view="bottom"]').click()
    assert page.evaluate('hardwareStudio.camera.position.y<0')
    page.locator('#reset').click()
    page.locator('#explode').fill('100')
    assert page.evaluate('hardwareStudio.model.children.some(o=>o.position.y>=26)')
    page.locator('#explode').fill('0')
    assert page.evaluate('hardwareStudio.model.children.every(o=>o.position.y===0)')
    page.locator('#wire').click()
    assert page.evaluate('hardwareStudio.model.children[0].children[0].material.wireframe')
    page.locator('#wire').click()
    page.locator('#rotate').click()
    first=page.evaluate('hardwareStudio.camera.position.toArray()')
    page.wait_for_function('(before)=>JSON.stringify(hardwareStudio.camera.position.toArray())!==JSON.stringify(before)',arg=first)
    page.locator('#rotate').click()
    print('Keyboard, view presets, explosion, wireframe, rotation: PASS')
    with page.expect_download() as download:
        page.locator('#download-model').click()
    file=download.value.path();data=Path(file).read_bytes()
    magic,version,total=struct.unpack_from('<4sII',data)
    assert magic==b'glTF' and version==2 and total==len(data)
    length,kind=struct.unpack_from('<II',data,12)
    gltf=json.loads(data[20:20+length])
    assert gltf['meshes'] and gltf['materials'] and gltf['buffers']
    print('GLB download has valid geometry/materials: PASS')
    # Mouse drag and wheel zoom must change a real perspective camera.
    region=page.locator('#viewport').bounding_box();x=region['x']+region['width']/2;y=region['y']+region['height']/2
    before=page.evaluate('hardwareStudio.camera.position.toArray()')
    page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+100,y+60,steps=8);page.mouse.up()
    page.wait_for_function('(before)=>JSON.stringify(hardwareStudio.camera.position.toArray())!==JSON.stringify(before)',arg=before)
    before=page.evaluate('hardwareStudio.camera.position.toArray()');page.mouse.wheel(0,150)
    page.wait_for_function('(before)=>JSON.stringify(hardwareStudio.camera.position.toArray())!==JSON.stringify(before)',arg=before)
    print('Pointer orbit and wheel zoom: PASS')
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('[data-model="gpu"]').click();page.locator('#viewport').scroll_into_view_if_needed()
    assert page.locator('#viewport canvas').bounding_box()['height']>=400
    page.screenshot(path='/tmp/cawiki-studio-mobile.png',full_page=True)
    print('Mobile layout, model selection: PASS')
    # Context loss must leave a usable static preview and model picker.
    page.evaluate('hardwareStudio.renderer.forceContextLoss()')
    page.wait_for_selector('.fallback-image');page.locator('[data-model="ssd"]').click()
    assert page.locator('.fallback-image').get_attribute('src').endswith('/ssd.png')
    assert page.locator('#rotate').is_disabled()
    print('Context-loss fallback and model selection: PASS')
    page.goto(BASE+'hardware.html?hw=ssd')
    if page.locator('.hw-welcome').is_visible():page.locator('.hw-choice[data-level="standard"]').click()
    page.wait_for_function('window.hwapp?.center==="ssd"')
    assert page.locator('.hw-3d-link').get_attribute('href').endswith('hw=ssd')
    assert page.locator('.hw-visual image').count()>0
    print('Existing map previews and selected-model link: PASS')
    assert not errors,json.dumps(errors)
    browser.close()
    # WebGL denied at startup should also work, including deep links.
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-webgl'])
    page=b.new_page();page.goto(BASE+'hardware-3d.html?hw=gpu');page.wait_for_selector('.fallback-image')
    assert page.locator('.fallback-image').get_attribute('src').endswith('/gpu.png')
    assert page.locator('#explode').is_disabled()
    b.close()
    print('WebGL unavailable at startup: PASS')
print('Hardware 3D integration: all checks passed')
