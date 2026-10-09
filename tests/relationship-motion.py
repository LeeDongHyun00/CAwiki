"""Exercise real room motion; observe the renderer without shipping test globals.

Run against the modular development server. The other relationship tests cover
the portable bundle, content, context restoration and renderer handoffs.
"""
from pathlib import Path
import json
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/relationship-motion'
OUT.mkdir(exist_ok=True)
BASE = os.environ.get('CAWIKI_TEST_URL', 'http://127.0.0.1:4173/')
source = (ROOT / 'design/redesign/relationship-stage.js').read_text().replace(
    'this.root=root;', 'window.__roomStage=this;this.root=root;')


def settled(page):
    page.wait_for_function('''() => {
      const s=window.__roomStage;
      return s?.active&&!s.navigating&&!s.routePending&&!s.frame&&!s.layoutFrame;
    }''', timeout=90000)


def snapshot(page, id='sram'):
    return page.evaluate('''id => {
      const s=__roomStage,i=s.items.get(id);
      return {hover:s.hover,pose:i.pose,to:i.to,feedback:i.feedback,uuid:i.group.uuid,
        focus:document.activeElement.dataset.node,scroll:scrollY};
    }''', id)


def neutral(state):
    assert all(abs(v) < .00005 for v in state['feedback'].values()), state


def same_pose(a, b):
    assert all(abs(a[k]-b[k]) < 1e-9 for k in a), (a,b)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=[
        '--no-sandbox', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width':1000, 'height':760}, device_scale_factor=.75, reduced_motion='no-preference')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('**/relationship-stage.js', lambda r: r.fulfill(body=source, content_type='text/javascript'))
    page.goto(BASE+'#map/group/compute')
    page.wait_for_selector('.rr-webgl', timeout=90000)
    settled(page)
    page.evaluate('''() => {
      const s=__roomStage;
      window.audit={frames:[],starts:[],layouts:[],materials:[],stress:false};
      const materialState=()=>{
        const result=[];
        for(const i of s.items.values())i.group.traverse(o=>{
          for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])
            result.push([m.uuid,m.transparent,m.depthWrite,m.opacity]);
        });return result;
      };
      audit.materials=materialState();
      const begin=s.beginNavigation.bind(s);
      s.beginNavigation=()=>{
        const before=Object.fromEntries([...s.items].map(([id,i])=>[id,{...i.pose}]));
        begin();audit.starts.push({before,after:Object.fromEntries([...s.items].map(([id,i])=>[id,{...i.current}]))});
      };
      const layout=s.layout.bind(s);
      s.layout=()=>{
        const route=s.routePending,elapsed=s.items.get('sram')?.elapsed;
        layout();audit.layouts.push({route,before:elapsed,after:s.items.get('sram')?.elapsed});
      };
      const tick=s.tick;
      s.tick=t=>{
        tick(t);
        const i=s.items.get('sram');
        if(i)audit.frames.push({hash:location.hash,pose:{...i.pose},elapsed:i.elapsed,duration:i.duration});
        if(s.navigating){
          const expected=new Map(audit.materials.map(m=>[m[0],m]));
          for(const m of materialState())if(expected.has(m[0])&&JSON.stringify(m)!==JSON.stringify(expected.get(m[0])))
            throw Error('A fade changed the original mesh material');
          if(audit.stress){
            s.root.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',clientX:900,clientY:50}));
            dispatchEvent(new Event('scroll'));dispatchEvent(new Event('resize'));
          }
        }
      };
    }''')
    initial = snapshot(page)
    page.locator('.rr-exhibit[data-node="sram"]').hover()
    settled(page)
    hovered = snapshot(page)
    assert hovered['hover'] == 'sram'
    assert hovered['pose']['scale'] > initial['pose']['scale']
    neutral(snapshot(page, 'cpu'))
    page.mouse.move(5, 5)
    settled(page)
    neutral(snapshot(page))
    same_pose(snapshot(page)['pose'], initial['pose'])
    page.locator('.rr-exhibit[data-node="sram"]').hover()
    settled(page)
    page.evaluate('audit.stress=true')
    page.locator('.rr-exhibit[data-node="sram"]').click()
    page.wait_for_selector('.rr-tabs')
    settled(page)
    detail = snapshot(page)
    assert detail['uuid'] == initial['uuid']
    assert detail['hover'] is None
    page.evaluate('audit.stress=false')
    audit = page.evaluate('audit')
    assert all(s['before'] == s['after'] for s in audit['starts'])
    active_layouts = [s for s in audit['layouts'] if not s['route'] and 0 < (s.get('before') or 0) < 640]
    assert active_layouts and all(s['before'] == s['after'] for s in active_layouts)
    frames = [s for s in audit['frames'] if '#map/node/sram' in s['hash'] and s['duration'] == 640]
    assert len(frames) >= 10, len(frames)
    assert all(0 <= b['elapsed']-a['elapsed'] <= 50.001 for a,b in zip(frames, frames[1:])), frames
    assert len({round(f['pose']['scale'],4) for f in frames}) >= 10
    print('Local hover / continuous click / pointer+resize+scroll stress / intact materials PASS', flush=True)

    # A real X click restores DOM focus, without manufacturing pointer hover.
    page.locator('.rr-close').click()
    page.wait_for_selector('.rr-room')
    settled(page)
    returned = snapshot(page)
    assert returned['focus'] == 'sram' and returned['hover'] is None
    assert returned['uuid'] == initial['uuid']
    neutral(returned)
    same_pose(returned['pose'], initial['pose'])
    page.screenshot(path=str(OUT/'return.png'))
    page.keyboard.press('Tab')
    settled(page)
    assert page.evaluate('__roomStage.hover===document.activeElement.dataset.node&&!!__roomStage.hover')
    page.keyboard.press('Enter')
    page.wait_for_selector('.rr-tabs')
    settled(page)
    page.keyboard.press('Escape')
    page.wait_for_selector('.rr-room')
    settled(page)
    assert page.evaluate('__roomStage.hover===document.activeElement.dataset.node&&!!__roomStage.hover')
    print('X pointer return / keyboard focus and Escape return PASS', flush=True)

    # Reverse while moving, then settle at the original room anchor.
    page.mouse.move(5,5)
    reversal_uuid = snapshot(page)['uuid']
    page.evaluate('''() => {
      const s=__roomStage,tick=s.tick;
      s.tick=t=>{
        tick(t);
        const i=s.items.get('sram');
        if(location.hash.includes('/node/sram')&&i?.elapsed>80&&i.elapsed<640){
          s.tick=tick;document.querySelector('.rr-close').click();
        }
      };
      document.querySelector('.rr-exhibit[data-node="sram"]').click();
    }''')
    page.wait_for_function('location.hash==="#map/group/compute"&&!__roomStage.navigating')
    settled(page)
    reversed = snapshot(page)
    same_pose(reversed['pose'], initial['pose'])
    assert reversed['uuid'] == reversal_uuid
    assert page.evaluate('audit.starts.every(s=>JSON.stringify(s.before)===JSON.stringify(s.after))')

    # A preference change must finish an already running tween too.
    page.locator('.rr-exhibit[data-node="sram"]').click()
    page.wait_for_selector('.rr-tabs')
    page.emulate_media(reduced_motion='reduce')
    settled(page)
    neutral(snapshot(page))
    assert page.evaluate('[...__roomStage.items.values()].every(i=>i.elapsed===i.duration)')
    page.emulate_media(reduced_motion='no-preference')
    print('Mid-flight X reversal / reduced motion change PASS', flush=True)

    # Every room uses the same behavior, including differently shaped models.
    for group,id in [('graphics','gpu'),('storage','ssd'),('io','mouse'),('network','nic'),('power','power')]:
        page.evaluate('g=>location.hash="map/group/"+g',group)
        page.wait_for_selector('.rr-exhibit[data-node="'+id+'"]')
        settled(page)
        page.locator('.rr-exhibit[data-node="'+id+'"]').hover()
        settled(page)
        assert snapshot(page,id)['hover'] == id
        page.locator('.rr-exhibit[data-node="'+id+'"]').click()
        page.wait_for_selector('.rr-tabs')
        settled(page)
        page.locator('.rr-close').click()
        page.wait_for_selector('.rr-room')
        settled(page)
        neutral(snapshot(page,id))
        assert snapshot(page,id)['hover'] is None
        print(group+' hover / click / X PASS', flush=True)

    mobile = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
    touch = mobile.new_page()
    touch.on('pageerror', lambda e: errors.append(str(e)))
    touch.route('**/relationship-stage.js', lambda r:r.fulfill(body=source,content_type='text/javascript'))
    touch.goto(BASE+'#map/group/compute')
    touch.wait_for_selector('.rr-webgl',timeout=90000)
    settled(touch)
    mobile_initial = snapshot(touch)
    touch.locator('.rr-exhibit[data-node="sram"]').tap()
    touch.wait_for_selector('.rr-tabs')
    settled(touch)
    touch.locator('.rr-role-more summary').tap()
    touch.evaluate('scrollTo(0,document.documentElement.scrollHeight)')
    touch.wait_for_function('scrollY>50')
    settled(touch)
    touch.locator('.rr-close').tap()
    touch.wait_for_selector('.rr-room')
    settled(touch)
    mobile_return = snapshot(touch)
    assert mobile_return['scroll'] == 0 and mobile_return['hover'] is None
    same_pose(mobile_return['pose'], mobile_initial['pose'])
    neutral(mobile_return)
    touch.screenshot(path=str(OUT/'mobile-return.png'))
    print('Touch / scrolled detail X / original slot restoration PASS', flush=True)
    assert not errors, errors
    (OUT/'verification.json').write_text(json.dumps({
        'initial':initial,'hover':hovered,'detail':detail,'return':returned,
        'transitionFrames':len(frames),'activeLayoutChecks':len(active_layouts),
        'originalMaterialsChecked':len(audit['materials']),
        'midflightReversal':True,'keyboardReturn':True,'reducedMotion':True,
        'rooms':6,'touchReturn':mobile_return,'errors':errors,
    },ensure_ascii=False,indent=2))
    browser.close()
