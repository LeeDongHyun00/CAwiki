"""Interaction and layout coverage for the map design prototype. Server: :4173."""
from pathlib import Path
from playwright.sync_api import sync_playwright
URL='http://127.0.0.1:4173/map-design.html'
ARGS=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=ARGS)
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('response',lambda r:errors.append(f'HTTP {r.status}: {r.url}') if r.status>=400 and 'favicon.ico' not in r.url else None)
    page.goto(URL)
    page.wait_for_function('atlasDesign.graphics?.renderer.info.render.triangles>0 && !atlasDesign.transitioning')
    assert page.locator('.model-label').count()==8
    assert page.locator('.chapter-tab').count()==7
    assert page.locator('#chapter-prev').is_disabled()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path='artifacts/map-design-overview.png',full_page=True)
    # Actual animated camera and meshes reach a new selected state.
    previous=page.evaluate('atlasDesign.graphics.camera.position.toArray()')
    page.locator('[data-chapter="cpu"]').click()
    page.wait_for_function('atlasDesign.chapter==="cpu" && !atlasDesign.transitioning')
    assert page.evaluate('atlasDesign.graphics.camera.position.toArray()')!=previous
    assert page.evaluate('atlasDesign.graphics.byId.get("cpu").opacity')==1
    assert page.evaluate('atlasDesign.graphics.byId.get("infra").opacity')==0
    assert page.locator('[data-object="cpu"]').is_visible()
    assert page.locator('#chapter-action').get_attribute('href').endswith('?hw=cpu')
    page.screenshot(path='artifacts/map-design-cpu.png',full_page=True)
    # Explicit related-component controls, keyboard and URL deep links.
    page.locator('#relation-items button').first.click()
    page.wait_for_function('atlasDesign.chapter==="dram" && !atlasDesign.transitioning')
    page.locator('#atlas-viewport').focus();page.keyboard.press('ArrowRight')
    page.wait_for_function('atlasDesign.chapter==="gpu" && !atlasDesign.transitioning')
    page.keyboard.press('Escape');page.wait_for_function('atlasDesign.chapter==="all" && !atlasDesign.transitioning')
    print('Overview, animated focus, related components, keyboard: PASS',flush=True)
    # A sustained wheel gesture cannot skip multiple chapters.
    page.mouse.move(950,430)
    # Dispatch the gesture in the page so software-renderer/driver roundtrips do
    # not accidentally turn it into separate physical gestures.
    page.evaluate("""async () => {
      const canvas=document.querySelector('#atlas-viewport canvas'),start=performance.now();
      for(let i=0;i<18;i++){
        const event=new WheelEvent('wheel',{deltaY:90,bubbles:true,cancelable:true});
        // Native wheel events retain input timestamps when rendering delays dispatch.
        Object.defineProperty(event,'timeStamp',{value:start+i*80});
        canvas.dispatchEvent(event);
        await new Promise(resolve=>setTimeout(resolve,80));
      }
    }""")
    assert page.evaluate('atlasDesign.chapter')=='cpu'
    page.wait_for_function('!atlasDesign.transitioning')
    page.wait_for_timeout(220)
    page.mouse.wheel(0,100)
    page.wait_for_function('atlasDesign.chapter==="dram" && !atlasDesign.transitioning')
    print('Wheel momentum: one chapter per gesture: PASS',flush=True)
    # Orbit mode owns pointer and wheel input without advancing the tour.
    page.locator('#inspect-button').click()
    before=page.evaluate('atlasDesign.graphics.camera.position.toArray()')
    page.mouse.move(930,390);page.mouse.down();page.mouse.move(1020,425,steps=8);page.mouse.up()
    page.wait_for_function('(old)=>JSON.stringify(atlasDesign.graphics.camera.position.toArray())!==JSON.stringify(old)',arg=before)
    page.mouse.wheel(0,160)
    assert page.evaluate('atlasDesign.chapter')=='dram'
    page.locator('#overview-button').click()
    page.wait_for_function('atlasDesign.chapter==="all" && !atlasDesign.transitioning')
    assert page.locator('#inspect-button').get_attribute('aria-pressed')=='false'
    page.locator('[data-object="gpu"]').click()
    page.wait_for_function('atlasDesign.chapter==="gpu" && !atlasDesign.transitioning')
    print('Direct orbit, zoom, map return and model labels: PASS',flush=True)
    # Reduced-motion, every chapter, and a narrow layout with the model above the text.
    page.emulate_media(reduced_motion='reduce')
    for name in ['cpu','dram','gpu','ssd','infra','power','all']:
        page.locator(f'[data-chapter="{name}"]').click()
        page.wait_for_function('(name)=>atlasDesign.chapter===name && !atlasDesign.transitioning',arg=name)
        assert page.locator('#chapter-title').inner_text()
    page.set_viewport_size({'width':390,'height':844})
    page.locator('[data-chapter="cpu"]').click();page.wait_for_function('!atlasDesign.transitioning')
    page.evaluate('window.scrollTo(0,0)')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert page.locator('#atlas-viewport').bounding_box()['y']<300
    assert page.locator('#chapter-description').bounding_box()['y']>page.locator('#atlas-viewport').bounding_box()['y']
    page.screenshot(path='artifacts/map-design-mobile.png',full_page=True)
    # Touch swipe on the exhibit uses the same chapter router.
    page.wait_for_timeout(120)
    page.locator('#atlas-viewport canvas').dispatch_event('pointerdown',{'clientX':180,'clientY':430,'pointerType':'touch'})
    page.locator('#atlas-viewport canvas').dispatch_event('pointerup',{'clientX':180,'clientY':330,'pointerType':'touch'})
    assert page.evaluate('atlasDesign.chapter')=='dram'
    print('All chapters, reduced motion, mobile layout, swipe: PASS',flush=True)
    page.evaluate('atlasDesign.graphics.renderer.forceContextLoss()')
    page.wait_for_selector('.fallback-model')
    page.locator('[data-chapter="ssd"]').click()
    assert page.locator('.fallback-model').get_attribute('src').endswith('/ssd.png')
    assert page.locator('#inspect-button').is_disabled()
    assert not errors,errors
    browser.close()
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-webgl'])
    page=b.new_page();page.goto(URL+'#ssd');page.wait_for_selector('.fallback-model')
    assert page.locator('.fallback-model').get_attribute('src').endswith('/ssd.png')
    assert '기억은 남도록' in page.locator('#chapter-title').inner_text()
    b.close()
    print('WebGL fallback and deep links: PASS',flush=True)
print('Map design checks passed')
