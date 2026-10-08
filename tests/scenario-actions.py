"""Verify action-specific thumbnails, replay, keyboard parity and reduced motion."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from PIL import Image, ImageDraw, ImageOps
import os
import re

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/scenario-actions'
OUT.mkdir(exist_ok=True)
BASE = os.environ.get('CAWIKI_TEST_URL', 'http://127.0.0.1:4173/')
CASES = {
    'typing': ('.action-key', 'transform'),
    'launch': ('.launch-window', 'transform'),
    'save': ('.save-progress', 'transform'),
    'music': ('.music-progress', 'strokeDashoffset'),
    'streaming': ('.stream-buffer', 'strokeDashoffset'),
    'call': ('.call-led', 'fill'),
    'multitasking': ('.multi-front', 'transform'),
    'usb': ('.usb-plug', 'transform'),
    'sleep': ('.monitor-led', 'fill'),
    'ai': ('.ai-question', 'transform'),
    'loading': ('.load-progress', 'transform'),
    'record': ('.record-playhead', 'transform'),
}

def style(card, selector, prop):
    return card.locator(selector).first.evaluate('(e,p)=>getComputedStyle(e)[p]', prop)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-webgl'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE + '#wiki')
    page.locator('[data-wiki-tab="stories"]').click()
    states = {}
    for name, (selector, prop) in CASES.items():
        card = page.locator(f'#wiki-stories [data-scenario="{name}"]')
        card.scroll_into_view_if_needed()
        page.mouse.move(0, 0)
        page.locator('[data-wiki-tab="stories"]').focus()
        page.wait_for_timeout(1000)
        before = style(card, selector, prop)
        assert style(card, '.action-result', 'opacity') == '0', name
        card.locator('figure').screenshot(path=str(OUT / f'{name}-before.png'))
        card.hover()
        page.wait_for_timeout(2200)
        after = style(card, selector, prop)
        assert after != before, (name, before, after)
        assert style(card, '.action-result', 'opacity') == '1', name
        assert not card.evaluate('(e)=>e.getAnimations({subtree:true}).some(a=>a.effect.getTiming().iterations===Infinity)'), name
        card.locator('figure').screenshot(path=str(OUT / f'{name}-after.png'))
        page.mouse.move(0, 0)
        css_property = re.sub(r'[A-Z]', lambda m: '-' + m[0].lower(), prop)
        expect(card.locator(selector).first).to_have_css(css_property, before, timeout=2200)
        expect(card.locator('.action-result').first).to_have_css('opacity', '0', timeout=1500)
        states[name] = (before, after)
    # A fresh keyboard activation must reach the same state without any motion.
    page.emulate_media(reduced_motion='reduce')
    for name, (selector, prop) in CASES.items():
        card = page.locator(f'#wiki-stories [data-scenario="{name}"]')
        page.keyboard.press('Tab')
        card.focus()
        assert card.evaluate('(e)=>e.matches(":focus-visible")'), name
        assert style(card, selector, prop) == states[name][1], (name, 'keyboard parity')
        assert style(card, '.action-result', 'opacity') == '1', name
        assert not card.evaluate('(e)=>e.getAnimations({subtree:true}).length'), name
        page.locator('[data-wiki-tab="stories"]').focus()
        assert style(card, selector, prop) == states[name][0], name
    # Original four covers still reveal their results through the shared trigger.
    for name in ['boot', 'game', 'search', 'storage']:
        card = page.locator(f'#wiki-stories [data-scenario="{name}"]')
        card.focus()
        assert style(card, '.cover-after', 'opacity') == '1', name
    page.evaluate('location.hash="stories"')
    page.wait_for_selector('#collection-dialog[open]')
    # Paint servers must remain unique when both catalog copies are in the DOM.
    problems = page.locator('.story-cover').evaluate_all('''es=>{
      const ids=es.flatMap(e=>[...e.querySelectorAll('[id]')].map(n=>n.id));
      const missing=es.flatMap(e=>[...e.querySelectorAll('[fill],[stroke]')]).flatMap(e=>
        [...(e.getAttribute('fill')+' '+e.getAttribute('stroke')).matchAll(/url\\(#([^)]+)\\)/g)]
        .map(m=>m[1])).filter(id=>!document.getElementById(id));
      return {duplicates:ids.length-new Set(ids).size,missing};
    }''')
    assert problems == {'duplicates': 0, 'missing': []}, problems
    assert not errors, errors
    browser.close()

for offset in [0, 6]:
    sheet = Image.new('RGB', (1200, 612), '#101f27')
    draw = ImageDraw.Draw(sheet)
    for i, name in enumerate(list(CASES)[offset:offset + 6]):
        x, y = i % 2 * 600, i // 2 * 204
        draw.text((x + 8, y + 5), name + '  BEFORE / AFTER', fill='white')
        for j, state in enumerate(['before', 'after']):
            im = Image.open(OUT / f'{name}-{state}.png')
            sheet.paste(ImageOps.contain(im, (294, 180)), (x + j * 300, y + 23))
    sheet.save(OUT / f'review-{offset}.jpg')
print('12 scene actions / reset / replay by keyboard / reduced motion / original 4 / unique paint servers PASS')
