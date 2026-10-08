"""Stage the portable, publicly shareable site for GitHub Pages."""
from pathlib import Path
import argparse,json,subprocess,shutil
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--output',default='/tmp/cawiki-pages-output');args=p.parse_args()
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
for command in ['build-extended-scenarios.py','build-redesign-preview.py','build-expansion-design.py']:
 subprocess.run(['python3',str(ROOT/'tools'/command)],check=True)
shutil.copyfile(ROOT/'artifacts/inside-site.html',out/'index.html')
shutil.copyfile(ROOT/'artifacts/scenario-expansion-design.html',out/'scenario-expansion-design.html')
alias=(ROOT/'artifacts/scenario-save-study.html').read_text().replace('./inside-site.html','./index.html')
(out/'scenario-save-study.html').write_text(alias)
(out/'scenario-save-study').mkdir(exist_ok=True)
(out/'scenario-save-study/index.html').write_text(alias.replace('./index.html','../index.html'))
(out/'.nojekyll').touch()
revision=subprocess.run(['git','rev-parse','HEAD'],cwd=ROOT,capture_output=True,text=True,check=True).stdout.strip()
(out/'version.json').write_text(json.dumps({'source':revision,'stories':16,'extendedScenes':94},indent=2)+'\n')
print('Pages files prepared at',out)
