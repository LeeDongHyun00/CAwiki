#!/usr/bin/env python3
"""Refresh the main page's content-versioned module/asset URLs after editing.

No bundler or Node runtime is required to serve the checked-in output.
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def versioned(path):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()[:12]
    return './' + path.relative_to(ROOT).as_posix() + '?v=' + digest

assets = {p.relative_to(ROOT / 'assets/inside').as_posix(): versioned(p)
          for p in sorted((ROOT / 'assets/inside').rglob('*')) if p.is_file()}
manifest = ROOT / 'lib/inside/assets.js'
manifest.write_text('window.__insideAssets = ' + json.dumps(assets, ensure_ascii=False, indent=2) + ';\n')
# The standalone gallery uses the same modules/assets. Version the iframe URL
# before hashing its host so browser caches cannot serve the old embedded bundle.
room = ROOT / 'relationship-room-study.html'
host = ROOT / 'lib/inside/room-host.js'
for page in [room, ROOT / 'index.html']:
    imports = {'inside/' + p.stem: versioned(p)
               for p in sorted((ROOT / 'lib/inside').glob('*.js')) if p != manifest}
    text = page.read_text()
    text = re.sub(r'<script type="importmap">.*?</script>',
                  '<script type="importmap">' + json.dumps({'imports': imports}) + '</script>',text,flags=re.S)
    text = re.sub(r'<script src="\./lib/inside/assets.js[^"]*"></script>',
                  '<script src="' + versioned(manifest) + '"></script>', text)
    if page.name == 'index.html':
        text = re.sub(r'(href=")[^"]*assets/inside/scenario-detail.css[^"]*', lambda m:m[1]+versioned(ROOT/'assets/inside/scenario-detail.css'), text)
        text = re.sub(r'(id="cpu-intro" src=")[^"]+',lambda m:m[1]+versioned(ROOT/'assets/inside/intro/desktop.webp'),text)
        text = re.sub(r'(srcset=")[^"]+(" data-cpu-mobile)',lambda m:m[1]+versioned(ROOT/'assets/inside/intro/mobile.webp')+m[2],text)
    page.write_text(text)
    if page == room:
        # Exclude room-host from the iframe import map to avoid a hash cycle.
        imports.pop('inside/room-host', None)
        text = re.sub(r'<script type="importmap">.*?</script>',
                      '<script type="importmap">' + json.dumps({'imports': imports}) + '</script>',text,flags=re.S)
        page.write_text(text)
        host.write_text(re.sub(r'embedded=1&v=[a-f0-9]+',
                              'embedded=1&v=' + hashlib.sha256(text.encode()).hexdigest()[:12],host.read_text()))
