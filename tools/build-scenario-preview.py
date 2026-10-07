"""Package the review-only scenario motion study, without external assets."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
STUDY=ROOT/'design/redesign'
modules={
 'inside/three':ROOT/'lib/vendor/three/three.module.js',
 'inside/rounded':ROOT/'lib/vendor/three/RoundedBoxGeometry.js',
 'inside/models':ROOT/'lib/hardware-models.js',
 'inside/catalog':ROOT/'lib/hardware-catalog.js',
 'inside/hero':STUDY/'hero-models.js',
 'inside/collection':STUDY/'collection-models.js',
 'inside/mouse':STUDY/'mouse-model.js',
 'inside/cinema':STUDY/'cinema-models.js',
 'inside/scenario':STUDY/'scenario-study.js',
}
imports={
 './three.module.js':'inside/three','./vendor/three/three.module.js':'inside/three',
 '../../lib/vendor/three/three.module.js':'inside/three',
 './vendor/three/RoundedBoxGeometry.js':'inside/rounded','../../lib/vendor/three/RoundedBoxGeometry.js':'inside/rounded',
 '../../lib/hardware-models.js':'inside/models','../../lib/hardware-catalog.js':'inside/catalog',
 './hero-models.js':'inside/hero','./collection-models.js':'inside/collection','./mouse-model.js':'inside/mouse','./cinema-models.js':'inside/cinema',
}
sources={}
for name,path in modules.items():
 source=path.read_text()
 for old,new in imports.items():source=source.replace("'"+old+"'","'"+new+"'").replace('"'+old+'"','"'+new+'"')
 sources[name]=source
payload=json.dumps(sources,ensure_ascii=False).replace('<','\\u003c')
html=(STUDY/'scenario-study.html').read_text().replace('<link rel="stylesheet" href="./scenario-study.css">','<style>'+(STUDY/'scenario-study.css').read_text()+'</style>')
html=html.replace('../../index.html#wiki','./inside-site.html#wiki')
loader='''<script>
const sources=PAYLOAD;
const map=document.createElement('script');map.type='importmap';map.textContent=JSON.stringify({imports:Object.fromEntries(Object.entries(sources).map(([id,code])=>[id,URL.createObjectURL(new Blob([code],{type:'text/javascript'}))]))});document.head.appendChild(map);
const entry=document.createElement('script');entry.type='module';entry.textContent="import 'inside/scenario';";document.body.appendChild(entry);
</script>'''.replace('PAYLOAD',payload)
html=html.replace('<script type="module" src="./scenario-study.js"></script>',loader)
html+='\n<!-- Three.js license\n'+(ROOT/'lib/vendor/three/LICENSE').read_text().replace('--','—')+'\n-->\n'
out=ROOT/'artifacts/scenario-design.html';out.write_text(html);print(f'{out} ({out.stat().st_size:,} bytes)')
