"""Bundle a 12-story review and an isolated, assembled-hardware save motion study."""
from pathlib import Path
import base64,json
ROOT=Path(__file__).resolve().parents[1]
D=ROOT/'design/redesign/expansion'
def inline(html,name):
 html=html.replace(f'<link rel="stylesheet" href="./{name}.css">','<style>'+(D/f'{name}.css').read_text()+'</style>')
 return html
stories=json.loads((D/'storyboards.json').read_text())
assert len(stories)==12 and all(len(s['stages'])>=6 for s in stories)
images={}
for path in (ROOT/'assets/models/redesign').glob('*.webp'):
 images[path.stem]='data:image/webp;base64,'+base64.b64encode(path.read_bytes()).decode()
review=inline((D/'review.html').read_text(),'review').replace('STORYBOARD_DATA',json.dumps(stories,ensure_ascii=False).replace('<','\\u003c')).replace('IMAGE_DATA',json.dumps(images))
review=review.replace('<script src="./review.js"></script>','<script>'+(D/'review.js').read_text()+'</script>')
(ROOT/'artifacts/scenario-expansion-design.html').write_text(review)
# The old review URL now opens the implemented save narrative
alias='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ctrl+S 한 번의 여정</title></head><body><a href="./inside-site.html#story/save/0">저장 시나리오 열기</a><script>location.replace(\'./inside-site.html#story/save/0\')</script></body></html>'
(ROOT/'artifacts/scenario-save-study.html').write_text(alias)
print('Updated narrative review and production-save alias')
