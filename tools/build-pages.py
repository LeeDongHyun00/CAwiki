"""Stage the portable, publicly shareable site for GitHub Pages."""
from pathlib import Path
import argparse,json,subprocess,shutil,hashlib
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--output',default='/tmp/cawiki-pages-output');args=p.parse_args()
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
for command in ['build-extended-scenarios.py','build-redesign-preview.py','build-expansion-design.py']:
 subprocess.run(['python3',str(ROOT/'tools'/command)],check=True)
# Preserve the optimized, split-module main site when it is present. The
# standalone design build remains useful for previews, not as a replacement
# for production's lazy loading and shader preparation.
if (ROOT/'lib/inside/site.js').exists():
 room_revision=hashlib.sha256((ROOT/'artifacts/relationship-room-study.html').read_bytes()).hexdigest()[:12]
 host=(ROOT/'design/redesign/relationship-room-host.js').read_text().replace('./relationship-room-study.html?embedded=1#',f'../../relationship-room-study.html?embedded=1&v={room_revision}#')
 (ROOT/'lib/inside/room-host.js').write_text(host)
 subprocess.run(['python3',str(ROOT/'tools/build_inside_manifest.py')],check=True)
 shutil.copyfile(ROOT/'index.html',out/'index.html')
 for directory in ['lib/inside','assets/inside']:
  shutil.copytree(ROOT/directory,out/directory,dirs_exist_ok=True)
else:
 shutil.copyfile(ROOT/'artifacts/inside-site.html',out/'index.html')
shutil.copyfile(ROOT/'artifacts/relationship-room-study.html',out/'relationship-room-study.html')
shutil.copyfile(ROOT/'artifacts/scenario-expansion-design.html',out/'scenario-expansion-design.html')
alias=(ROOT/'artifacts/scenario-save-study.html').read_text().replace('./inside-site.html','./index.html')
(out/'scenario-save-study.html').write_text(alias)
(out/'scenario-save-study').mkdir(exist_ok=True)
(out/'scenario-save-study/index.html').write_text(alias.replace('./index.html','../index.html'))
(out/'.nojekyll').touch()
revision=subprocess.run(['git','rev-parse','HEAD'],cwd=ROOT,capture_output=True,text=True,check=True).stdout.strip()
(out/'version.json').write_text(json.dumps({'source':revision,'stories':16,'extendedScenes':94},indent=2)+'\n')
print('Pages files prepared at',out)
