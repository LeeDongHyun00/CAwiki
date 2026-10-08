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
imports = {'inside/' + p.stem: versioned(p)
           for p in sorted((ROOT / 'lib/inside').glob('*.js')) if p != manifest}
index = ROOT / 'index.html'
text = index.read_text()
text = re.sub(r'<script type="importmap">.*?</script>',
              '<script type="importmap">' + json.dumps({'imports': imports}) + '</script>',
              text, flags=re.S)
text = re.sub(r'<script src="\./lib/inside/assets.js[^"]*"></script>',
              '<script src="' + versioned(manifest) + '"></script>', text)
text = text.replace('<script type="module" src="./lib/inside/site.js"></script>',
                    '<script type="module">import "inside/site";</script>')
index.write_text(text)
