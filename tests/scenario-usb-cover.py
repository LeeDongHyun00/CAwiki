"""USB model cover: finite/reversible playback, keyboard, reduced motion and offline atlas."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import os
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts/usb-cover'
BASE=os.environ.get('CAWIKI_TEST_URL','http://127.0.0.1:4173/')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-webgl'])
 page=b.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE+'#stories');page.wait_for_selector('#collection-dialog[open]')
 card=page.locator('#story-grid [data-scenario="usb"]');card.scroll_into_view_if_needed()
 assert card.locator('.usb-connected').text_content()=='USB 드라이브'
 assert '내 PC' in card.locator('figure').text_content()
 assert 'USB 연결됨' not in card.locator('figure').text_content()
 sprite=card.locator('.usb-plug');frame=lambda:int(sprite.get_attribute('data-usb-frame'))
 page.mouse.move(0,0);page.locator('#collection-title').click()
 expect(sprite).to_have_attribute('data-usb-frame','0')
 assert card.locator('image').evaluate('async e=>{const i=new Image();i.src=e.getAttribute("href");await i.decode();return i.naturalWidth===4800&&i.naturalHeight===2400}')
 card.locator('figure').screenshot(path=str(OUT/'cover-before.png'))
 card.hover();page.wait_for_timeout(420);mid=frame();assert 0<mid<29,mid
 card.locator('figure').screenshot(path=str(OUT/'cover-inserting.png'))
 mid=frame() # Capture may advance playback before the pointer leaves
 page.mouse.move(0,0);page.wait_for_timeout(60);reverse=frame();assert reverse<mid,(mid,reverse)
 card.hover();page.wait_for_timeout(120)
 assert frame()>=reverse,(reverse,frame())
 expect(sprite).to_have_attribute('data-usb-frame','29',timeout=2200)
 expect(card.locator('.action-result')).to_have_css('opacity','1')
 card.locator('figure').screenshot(path=str(OUT/'cover-connected.png'))
 final=sprite.get_attribute('style');page.wait_for_timeout(200)
 assert sprite.get_attribute('style')==final
 page.mouse.move(0,0);expect(sprite).to_have_attribute('data-usb-frame','0',timeout=1000)
 page.keyboard.press('Tab');card.focus();expect(sprite).to_have_attribute('data-usb-frame','29',timeout=1800)
 page.mouse.move(0,0);assert frame()==29 # keyboard focus keeps the preview active
 page.locator('#collection-title').click();expect(sprite).to_have_attribute('data-usb-frame','0',timeout=1000)
 page.emulate_media(reduced_motion='reduce');page.keyboard.press('Tab');card.focus()
 expect(sprite).to_have_attribute('data-usb-frame','29',timeout=200)
 assert not card.evaluate('e=>e.getAnimations({subtree:true}).length')
 page.set_viewport_size({'width':390,'height':844});card.scroll_into_view_if_needed();card.screenshot(path=str(OUT/'mobile.png'))
 assert page.locator('#collection-dialog').evaluate('e=>e.scrollWidth<=e.clientWidth')
 assert not errors,errors
 b.close()
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-webgl'])
 ctx=b.new_context(is_mobile=True,has_touch=True,viewport={'width':390,'height':844})
 page=ctx.new_page();requests=[];page.on('request',lambda r:requests.append(r.url));page.on('pageerror',lambda e:errors.append(str(e)))
 url=BASE+'artifacts/inside-site.html';page.goto(url+'#stories');page.wait_for_selector('#collection-dialog[open]');ctx.set_offline(True)
 card=page.locator('#story-grid [data-scenario="usb"]')
 assert card.locator('image').get_attribute('href').startswith('data:image/webp;base64,')
 assert card.locator('image').evaluate('async e=>{const i=new Image();i.src=e.getAttribute("href");await i.decode();return i.naturalWidth===4800}')
 card.tap();page.wait_for_selector('.relation-step-copy');assert page.url.endswith('#map/scenario/usb/0')
 assert all(r.split('#')[0]==url or r.startswith(('blob:','data:')) for r in requests),requests
 assert not errors,errors
 b.close()
print('USB scene / insertion / interrupted reversal / replay / focus / reduced motion / mobile touch / offline PASS')
