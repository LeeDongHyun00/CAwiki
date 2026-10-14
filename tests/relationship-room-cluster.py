"""Verify filtering keeps the room's irregular arrangement, then restores it.
Timeline access is injected only in the browser test's source response.
Run with the repository served at http://127.0.0.1:4173.
"""
from pathlib import Path
from itertools import combinations
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get('CAWIKI_ROOM_URL', 'http://127.0.0.1:4173/design/redesign/relationship-room-study.html')
SOURCE = (ROOT / 'design/redesign/relationship-room-study.js').read_text() + '''
window.inspectRoom={
 snap:()=>items.map(i=>({id:i.id,pose:{...i.pose},home:{...i.home},bounds:i.bounds})),
 at:ms=>{cancelAnimationFrame(frame);frame=0;transitionAt=performance.now()-ms;
 moving=true;tick(performance.now());cancelAnimationFrame(frame);frame=0;},select
};
'''
KEYS = ['x', 'y', 'z', 'rx', 'ry', 'rz', 'size']

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 1440, 'height': 960}, device_scale_factor=.75)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('**/relationship-room-study.js', lambda r: r.fulfill(body=SOURCE, content_type='text/javascript'))
    page.goto(URL + '#all')
    page.wait_for_selector('#room[data-ready=true][data-moving=false]', timeout=90000)
    assert page.locator('#room-title').count() == 0
    for width, height in [(1440, 960), (390, 844), (320, 720)]:
        page.set_viewport_size({'width': width, 'height': height})
        page.wait_for_selector('#room[data-moving=false]')
        for group in ['compute', 'graphics', 'storage', 'io', 'network', 'power']:
            before = page.evaluate('inspectRoom.snap()')
            page.evaluate('id=>inspectRoom.select(id)', group)
            page.evaluate('inspectRoom.at(425)')
            early = page.evaluate('inspectRoom.snap()')
            page.evaluate('inspectRoom.at(1500)')
            end = page.evaluate('inspectRoom.snap()')
            shown = [i for i in end if i['pose']['opacity'] > .99]
            ids = {i['id'] for i in shown}
            for old, now in zip(before, early):
                # Every model waits in place while membership fades.
                assert all(abs(now['pose'][k] - old['pose'][k]) < .001 for k in KEYS)
                if now['id'] not in ids:
                    assert now['pose']['opacity'] < .01
            ratios = [i['pose']['size'] / i['home']['size'] for i in shown]
            assert max(ratios) - min(ratios) < 1e-5
            for a, b in combinations(shown, 2):
                # Relative ordering survives; no per-index ring or row slots.
                for axis in ['x', 'y', 'z']:
                    assert (a['pose'][axis] - b['pose'][axis]) * (a['home'][axis] - b['home'][axis]) >= -1e-5
            for item in shown:
                assert abs(item['pose']['rz'] - item['home']['rz']) < 1e-5
                box = item['bounds']
                assert box['x'] > -10 and box['x'] + box['width'] < width + 10, (width, group, item['id'])
                assert box['y'] > 30 and box['y'] + box['height'] < height - 155, (width, group, item['id'])
            page.evaluate('inspectRoom.select(null);inspectRoom.at(1100)')
            for item in page.evaluate('inspectRoom.snap()'):
                if item['id'] not in ids:
                    assert item['pose']['opacity'] < .01
            page.evaluate('inspectRoom.at(1600)')
            for item in page.evaluate('inspectRoom.snap()'):
                assert item['pose']['opacity'] == 1
                assert all(abs(item['pose'][k] - item['home'][k]) < 1e-5 for k in KEYS)
        print(f'{width}×{height}: six loose clusters, fade before movement, exact home return PASS', flush=True)
    assert not errors, errors
    browser.close()
