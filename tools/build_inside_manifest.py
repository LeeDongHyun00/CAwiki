#!/usr/bin/env python3
"""Refresh the main page's content-versioned module/asset URLs after editing.

No bundler or Node runtime is required to serve the checked-in output.
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULES = ROOT / 'lib/inside'
def versioned(path):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()[:12]
    return './' + path.relative_to(ROOT).as_posix() + '?v=' + digest

# Static imports and re-exports only: dynamic import() stays lazy on purpose.
STATIC = re.compile(r"""(?:^|[;\s])(?:import|export)\s+(?:[^'"();]*?\s+from\s+)?['"]inside/([\w-]+)['"]""", re.M)
def closure(*entries):
    seen, stack = set(), list(entries)
    while stack:
        name = stack.pop()
        if name in seen:
            continue
        seen.add(name)
        stack.extend(STATIC.findall((MODULES / (name + '.js')).read_text()))
    return seen
def by_size(names):
    # Large files first so the longest download starts earliest.
    return sorted(names, key=lambda n: (-(MODULES / (n + '.js')).stat().st_size, n))
POSTER_MODULES = ('cpu-framing', 'quality')
def preload_block(imports, entries, groups=None):
    critical = closure(*entries)
    url = lambda n: imports['inside/' + n]
    link = lambda n: f'<link rel="modulepreload" href="{url(n)}">'
    if not groups:
        return '<!-- inside:preload -->' + ''.join(link(n) for n in by_size(critical)) + '<!-- /inside:preload -->'
    # index.html keeps its import map in the head, so this runs before the body
    # is parsed. Only the poster's framing modules are static. The rest of the
    # first screen is requested at once for the Wiki and the 3D views, and
    # after the opening poster has arrived on the film, so the poster keeps
    # the connection to itself. Direct entries into a 3D view also fetch that
    # view's modules with the page instead of after the router has evaluated.
    first = [n for n in POSTER_MODULES if n in critical]
    rest = [url(n) for n in by_size(critical - set(first))]
    lazy = {route: [url(n) for n in by_size(closure(*names) - critical)] for route, names in groups.items()}
    script = ('<script>(function(){var h=location.hash.slice(1),c=' + json.dumps(rest, separators=(',', ':')) + ',g=' + json.dumps(lazy, separators=(',', ':')) +
              ',k=/^(?:home|journey|inside|silicon|graphics|airflow|system|screen)?$/.test(h)?"film":/^(?:object\\/|part-)/.test(h)?"object":'
              '/^story\\//.test(h)?"story":/^map\\/scenario\\//.test(h)?"map":"",done=0,go=function(){if(done++)return;'
              'c.concat(g[k]||[]).forEach(function(u){var l=document.createElement("link");l.rel="modulepreload";l.href=u;document.head.appendChild(l);});},'
              'p=window.__insidePoster&&document.querySelector("link[rel=preload][as=image]");if(k==="film"&&p){'
              'p.addEventListener("load",go);p.addEventListener("error",go);setTimeout(go,2500);}else go();})();</script>')
    return '<!-- inside:preload -->' + ''.join(link(n) for n in first) + script + '<!-- /inside:preload -->'
def with_preload(text, block):
    text = re.sub(r'<!-- inside:preload -->.*?<!-- /inside:preload -->', '', text, flags=re.S)
    return re.sub(r'(<script type="importmap">.*?</script>)', lambda m: m[1] + block, text, count=1, flags=re.S)

assets = {p.relative_to(ROOT / 'assets/inside').as_posix(): versioned(p)
          for p in sorted((ROOT / 'assets/inside').rglob('*')) if p.is_file()}
manifest = MODULES / 'assets.js'
manifest.write_text('window.__insideAssets = ' + json.dumps(assets, ensure_ascii=False, indent=2) + ';\n')
# The standalone gallery uses the same modules/assets. Version the iframe URL
# before hashing its host so browser caches cannot serve the old embedded bundle.
room = ROOT / 'relationship-room-study.html'
host = MODULES / 'room-host.js'
ROUTE_MODULES = {'film': ['three', 'cinema-models', 'wiki-arrival'], 'object': ['experience'], 'story': ['scenario-film'], 'map': ['relationship-map']}
for page in [room, ROOT / 'index.html']:
    imports = {'inside/' + p.stem: versioned(p)
               for p in sorted(MODULES.glob('*.js')) if p != manifest}
    text = page.read_text()
    text = re.sub(r'<script type="importmap">.*?</script>',
                  '<script type="importmap">' + json.dumps({'imports': imports}) + '</script>',text,flags=re.S)
    if page.name == 'index.html':
        inline = '<script data-inside-assets>window.__insideAssets=' + json.dumps(assets, ensure_ascii=False, separators=(',', ':')) + ';</script>'
        text = re.sub(r'<script src="\./lib/inside/assets.js[^"]*"></script>|<script data-inside-assets>.*?</script>', lambda m: inline, text, flags=re.S)
    else:
        text = re.sub(r'<script src="\./lib/inside/assets.js[^"]*"></script>',
                      '<script src="' + versioned(manifest) + '"></script>', text)
    if page.name == 'index.html':
        text = with_preload(text, preload_block(imports, ['site', 'cpu-framing'], ROUTE_MODULES))
        # The poster preload, stylesheet and any other inline asset URL.
        text = re.sub(r'\./assets/inside/([^"\'?\s]+)\?v=[0-9a-f]{12}', lambda m: assets.get(m[1], m[0]), text)
    page.write_text(text)
    if page == room:
        # Exclude room-host from the iframe import map to avoid a hash cycle.
        imports.pop('inside/room-host', None)
        text = re.sub(r'<script type="importmap">.*?</script>',
                      '<script type="importmap">' + json.dumps({'imports': imports}) + '</script>',text,flags=re.S)
        text = with_preload(text, preload_block(imports, ['room-study']))
        page.write_text(text)
        host.write_text(re.sub(r'embedded=1&v=[a-f0-9]+',
                              'embedded=1&v=' + hashlib.sha256(text.encode()).hexdigest()[:12],host.read_text()))
