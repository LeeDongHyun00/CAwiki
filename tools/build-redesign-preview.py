"""Package the complete Inside site as one HTML file. No build dependencies."""
from pathlib import Path
import base64
import json

ROOT = Path(__file__).resolve().parents[1]
STUDY = ROOT / 'design/redesign'
MODULES = {
    'inside/three': ROOT / 'lib/vendor/three/three.module.js',
    'inside/rounded': ROOT / 'lib/vendor/three/RoundedBoxGeometry.js',
    'inside/orbit': ROOT / 'lib/vendor/three/OrbitControls.js',
    'inside/models': ROOT / 'lib/hardware-models.js',
    'inside/catalog': ROOT / 'lib/hardware-catalog.js',
    'inside/hero': STUDY / 'hero-models.js',
    'inside/collection': STUDY / 'collection-models.js',
    'inside/mouse': STUDY / 'mouse-model.js',
    'inside/cinema-models': STUDY / 'cinema-models.js',
    'inside/cinema-timeline': STUDY / 'cinema-timeline.js',
    'inside/study': STUDY / 'study.js',
    'inside/data': STUDY / 'site-data.js',
    'inside/experience': STUDY / 'experience.js',
    'inside/site': STUDY / 'site.js',
    'inside/scenario-data': STUDY / 'scenario-data.js',
    'inside/scenario-film': STUDY / 'scenario-film.js',
    'inside/scenario-extended-data': STUDY / 'scenario-extended-data.js',
    'inside/scenario-mechanisms': STUDY / 'scenario-mechanisms.js',
    'inside/usb-model': STUDY / 'usb-model.js',
    'inside/story-covers': STUDY / 'story-covers.js',
    'inside/story-actions': STUDY / 'story-actions.js',
    'inside/story-usb-preview': STUDY / 'story-usb-preview.js',
    'inside/relationship-map': STUDY / 'relationship-map.js',
    'inside/relation-source': STUDY / 'relation-source.js',
    'inside/relation-scenarios': STUDY / 'relation-scenarios.js',
}
IMPORTS = {
    './three.module.js': 'inside/three',
    './vendor/three/three.module.js': 'inside/three',
    '../../lib/vendor/three/three.module.js': 'inside/three',
    './vendor/three/RoundedBoxGeometry.js': 'inside/rounded',
    '../../lib/vendor/three/RoundedBoxGeometry.js': 'inside/rounded',
    '../../lib/vendor/three/OrbitControls.js': 'inside/orbit',
    '../../lib/hardware-models.js': 'inside/models',
    '../../lib/hardware-catalog.js': 'inside/catalog',
    './hero-models.js': 'inside/hero',
    './collection-models.js': 'inside/collection',
    './mouse-model.js': 'inside/mouse',
    './cinema-models.js': 'inside/cinema-models',
    './cinema-timeline.js': 'inside/cinema-timeline',
    './study.js': 'inside/study',
    './site-data.js': 'inside/data',
    './experience.js': 'inside/experience',
    './scenario-data.js': 'inside/scenario-data',
    './scenario-film.js': 'inside/scenario-film',
    './scenario-extended-data.js': 'inside/scenario-extended-data',
    './scenario-mechanisms.js': 'inside/scenario-mechanisms',
    './usb-model.js': 'inside/usb-model',
    './story-covers.js': 'inside/story-covers',
    './story-actions.js': 'inside/story-actions',
    './story-usb-preview.js': 'inside/story-usb-preview',
    './relationship-map.js': 'inside/relationship-map',
    './relation-source.js': 'inside/relation-source',
    './relation-scenarios.js': 'inside/relation-scenarios',
}
images = {}
for path in sorted((ROOT / 'assets/models').glob('*.png')) + sorted((ROOT / 'assets/models/redesign').glob('*.webp')):
    name = str(path.relative_to(ROOT / 'assets/models'))
    mime = 'image/webp' if path.suffix == '.webp' else 'image/png'
    images[name] = f'data:{mime};base64,' + base64.b64encode(path.read_bytes()).decode()
assert len([name for name in images if name.startswith('redesign/')]) == 23, 'Render all 23 collection thumbnails first'
images['scenarios/usb-action-atlas.webp'] = 'data:image/webp;base64,' + base64.b64encode((ROOT / 'assets/scenarios/usb-action-atlas.webp').read_bytes()).decode()
sources = {}
for name, path in MODULES.items():
    source = path.read_text()
    for original, alias in IMPORTS.items():
        source = source.replace(f"'{original}'", f"'{alias}'").replace(f'"{original}"', f'"{alias}"')
    if name == 'inside/site':
        original = 'const asset=file=>new URL(`../../assets/models/${file}`,import.meta.url).href;'
        assert original in source
        source = source.replace(original, 'const asset=file=>window.__insideAssets[file];')
    if name == 'inside/story-usb-preview':
        original = "new URL('../../assets/scenarios/usb-action-atlas.webp',import.meta.url).href"
        assert original in source
        source = source.replace(original, "window.__insideAssets['scenarios/usb-action-atlas.webp']")
    if name == 'inside/study':
        original = 'new URL(`../../assets/models/${id}.png`,import.meta.url).href'
        assert original in source
        source = source.replace(original, "window.__insideAssets[id+'.png']")
    sources[name] = source
html = (STUDY / 'index.html').read_text()
for stylesheet in ['study.css', 'site.css', 'scenario-film.css', 'story-covers.css', 'relationship-map.css']:
    html = html.replace(f'<link rel="stylesheet" href="./{stylesheet}">', '<style>' + (STUDY / stylesheet).read_text() + '</style>')
html = html.replace('../../assets/models/cpu.png', images['cpu.png'])
payload = json.dumps({'modules': sources, 'images': images}, ensure_ascii=False).replace('<', '\\u003c')
loader = '''<script>
const payload = PAYLOAD;
window.__insideAssets = payload.images;
const imports = Object.fromEntries(Object.entries(payload.modules).map(([name,code]) =>
  [name,URL.createObjectURL(new Blob([code],{type:'text/javascript'}))]));
const map = document.createElement('script');map.type='importmap';
map.textContent=JSON.stringify({imports});document.head.appendChild(map);
const entry = document.createElement('script');entry.type='module';
entry.textContent="import 'inside/site';";document.body.appendChild(entry);
</script>'''.replace('PAYLOAD', payload)
assert '<script type="module" src="./site.js"></script>' in html
html = html.replace('<script type="module" src="./site.js"></script>', loader)
license_text = (ROOT / 'lib/vendor/three/LICENSE').read_text().replace('--', '—')
html += '\n<!-- Three.js license\n' + license_text + '\n-->\n'
target = ROOT / 'artifacts/inside-site.html'
target.write_text(html)
print(f'{target} ({target.stat().st_size:,} bytes)')
