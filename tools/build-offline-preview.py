"""Package the reviewable site into one offline HTML file; no localhost required.
Build dependency: esbuild (invoked through npm exec with a temporary cache).
"""
from pathlib import Path
import base64, json, mimetypes, re, shutil, subprocess, tempfile

ROOT = Path(__file__).resolve().parents[1]
PAGES = ['map-design.html','hardware-3d.html','hardware.html','index.html','wiki.html',
         'scenarios/boot.html','scenarios/game.html','scenarios/search.html','scenarios/storage.html']
assets = {}
for folder in ['assets/models', 'data']:
    for p in (ROOT/folder).rglob('*'):
        if p.is_file():
            mime = mimetypes.guess_type(p.name)[0] or 'application/octet-stream'
            assets[str(p.relative_to(ROOT))] = f'data:{mime};base64,' + base64.b64encode(p.read_bytes()).decode()
assets['lib/cawiki.wasm'] = 'data:application/wasm;base64,' + base64.b64encode((ROOT/'lib/cawiki.wasm').read_bytes()).decode()

runtime = r'''
<script>
window.__cawikiQuery=parent.__previewQuery||'';
window.__cawikiHash=parent.__previewHash||'';
window.__cawikiHref='https://cawiki.invalid/'+parent.__previewPath+window.__cawikiQuery+window.__cawikiHash;
window.__cawikiAsset=path=>parent.__previewAssets[path]||path;
window.__cawikiNavigate=path=>parent.__previewOpen(new URL(path,window.__cawikiHref).href);
const NativeURL=window.URL;
window.URL=class extends NativeURL {
  constructor(input,base){
    super(input,base);
    if(this.hostname==='cawiki.invalid'){
      const asset=parent.__previewAssets[this.pathname.slice(1)];
      if(asset)return new NativeURL(asset);
    }
  }
};
const nativeFetch=window.fetch.bind(window);
window.fetch=(input,options)=>{
  const url=new URL(String(input),window.__cawikiHref);
  return nativeFetch(url,options);
};
history.replaceState=function(state,unused,url){
  if(!url)return;
  const parsed=new NativeURL(url,window.__cawikiHref);
  window.__cawikiHref=parsed.href;window.__cawikiQuery=parsed.search;window.__cawikiHash=parsed.hash;
};
document.addEventListener('click',event=>{
  const a=event.target.closest('a');if(!a)return;
  const href=a.getAttribute('href');if(!href||href.startsWith('#')||href.startsWith('blob:')||href.startsWith('data:'))return;
  const url=new NativeURL(href,window.__cawikiHref);
  if(url.hostname!=='cawiki.invalid')return;
  event.preventDefault();event.stopImmediatePropagation();parent.__previewOpen(url.href);
},true);
</script>
'''
with tempfile.TemporaryDirectory(prefix='cawiki-offline-') as work:
    work=Path(work)
    for folder in ['lib','scenarios']:
        shutil.copytree(ROOT/folder,work/folder)
    for source in work.rglob('*.js'):
        s=source.read_text()
        source_url='https://cawiki.invalid/'+str(source.relative_to(work))
        s=s.replace('import.meta.url',json.dumps(source_url))
        s=re.sub(r'\.{1,2}/assets/models/\$\{([^}]+)\}\.png',lambda m:'${window.__cawikiAsset("assets/models/"+'+m[1]+'+".png")}',s)
        s=re.sub(r'location\.href\s*=\s*([^;]+);',r'window.__cawikiNavigate(\1);',s)
        s=s.replace('location.search','window.__cawikiQuery').replace('location.hash','window.__cawikiHash').replace('location.href','window.__cawikiHref')
        source.write_text(s)
    bundles={}
    documents={}
    for page in PAGES:
        doc=(ROOT/page).read_text()
        base=Path(page).parent
        def css(match):
            path=(ROOT/base/match[1].split('?')[0]).resolve()
            return '<style>'+path.read_text()+'</style>'
        doc=re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)"\s*/?>',css,doc)
        def script(match):
            attrs,path=match[1],match[2]
            entry=(work/base/path.split('?')[0]).resolve()
            key=str(entry)
            if key not in bundles:
                output=work/f'bundle-{len(bundles)}.js'
                subprocess.run(['npm','exec','--yes','--cache','/tmp/cawiki-npm-cache','--package=esbuild@0.25.5','--','esbuild',key,'--bundle','--format=iife','--minify',f'--outfile={output}','--log-level=error'],check=True,cwd=work)
                bundles[key]=output.read_text().replace('</script','<\\/script')
            return '<script>'+bundles[key]+'</script>'
        doc=re.sub(r'<script\b([^>]*?)src="([^"]+)"[^>]*>\s*</script>',script,doc)
        doc=doc.replace('<head>','<head>'+runtime,1)
        documents[page]=doc
        print('Bundled',page,flush=True)
    payload=json.dumps({'assets':assets,'pages':documents},ensure_ascii=False).replace('<','\\u003c')
    result='''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CAwiki — 지도 디자인 미리보기</title><link rel="icon" href="data:,"><style>html,body{margin:0;width:100%;height:100%;background:#111415}iframe{display:block;width:100%;height:100%;border:0}</style></head><body><iframe title="CAwiki 디자인 미리보기" id="preview"></iframe><script>const packageData='''+payload+''';
window.__previewAssets=packageData.assets;
window.__previewOpen=function(input){
 const url=new URL(input,'https://cawiki.invalid/');const path=url.pathname.replace(/^\\//,'')||'map-design.html';
 if(!packageData.pages[path])return;
 window.__previewPath=path;window.__previewQuery=url.search;window.__previewHash=url.hash;
 document.querySelector('#preview').srcdoc=packageData.pages[path];
};
window.__previewOpen('map-design.html');
</script></body></html>'''
    target=ROOT/'artifacts/cawiki-preview.html'
    target.write_text(result)
    print('Saved',target,'bytes',target.stat().st_size,flush=True)
