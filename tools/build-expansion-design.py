"""Bundle a 12-story review and an isolated, assembled-hardware save motion study."""
from pathlib import Path
import base64,json
ROOT=Path(__file__).resolve().parents[1]
D=ROOT/'design/redesign/expansion'
def inline(html,name):
 html=html.replace(f'<link rel="stylesheet" href="./{name}.css">','<style>'+(D/f'{name}.css').read_text()+'</style>')
 return html
stories=json.loads((D/'storyboards.json').read_text())
assert len(stories)==12 and all(len(s['stages'])==6 for s in stories)
images={}
for path in (ROOT/'assets/models/redesign').glob('*.webp'):
 images[path.stem]='data:image/webp;base64,'+base64.b64encode(path.read_bytes()).decode()
review=inline((D/'review.html').read_text(),'review').replace('STORYBOARD_DATA',json.dumps(stories,ensure_ascii=False).replace('<','\\u003c')).replace('IMAGE_DATA',json.dumps(images))
review=review.replace('<script src="./review.js"></script>','<script>'+(D/'review.js').read_text()+'</script>')
(ROOT/'artifacts/scenario-expansion-design.html').write_text(review)
modules={
 'inside/three':ROOT/'lib/vendor/three/three.module.js','inside/rounded':ROOT/'lib/vendor/three/RoundedBoxGeometry.js',
 'inside/models':ROOT/'lib/hardware-models.js','inside/catalog':ROOT/'lib/hardware-catalog.js',
 **{'inside/'+name:ROOT/f'design/redesign/{file}.js' for name,file in [('hero','hero-models'),('collection','collection-models'),('mouse','mouse-model'),('cinema','cinema-models')]},
 'inside/save':D/'save-study.js'
}
imports={'./three.module.js':'inside/three','./vendor/three/three.module.js':'inside/three','../../lib/vendor/three/three.module.js':'inside/three','../../../lib/vendor/three/three.module.js':'inside/three','./vendor/three/RoundedBoxGeometry.js':'inside/rounded','../../lib/vendor/three/RoundedBoxGeometry.js':'inside/rounded','../../lib/hardware-models.js':'inside/models','../../lib/hardware-catalog.js':'inside/catalog'}
for name,file in [('hero','hero-models'),('collection','collection-models'),('mouse','mouse-model'),('cinema','cinema-models')]:
 for prefix in ['./','../']:imports[prefix+file+'.js']='inside/'+name
sources={}
for name,path in modules.items():
 text=path.read_text()
 for old,new in imports.items():text=text.replace("'"+old+"'","'"+new+"'").replace('"'+old+'"','"'+new+'"')
 sources[name]=text
payload=json.dumps(sources,ensure_ascii=False).replace('<','\\u003c')
loader='''<script>const sources=PAYLOAD;const map=document.createElement('script');map.type='importmap';map.textContent=JSON.stringify({imports:Object.fromEntries(Object.entries(sources).map(([id,code])=>[id,URL.createObjectURL(new Blob([code],{type:'text/javascript'}))]))});document.head.appendChild(map);const entry=document.createElement('script');entry.type='module';entry.textContent="import 'inside/save';";document.body.appendChild(entry);</script>'''.replace('PAYLOAD',payload)
html=inline((D/'save-study.html').read_text(),'save-study').replace('<script type="module" src="./save-study.js"></script>',loader)
html+='\n<!-- Three.js license\n'+(ROOT/'lib/vendor/three/LICENSE').read_text().replace('--','—')+'\n-->\n'
(ROOT/'artifacts/scenario-save-study.html').write_text(html)
for name in ['scenario-expansion-design','scenario-save-study']:print(name,(ROOT/f'artifacts/{name}.html').stat().st_size)
