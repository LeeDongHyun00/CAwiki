#!/usr/bin/env python3
"""Summarize the fixed v3 iframe/film measurements without dropping regressions."""
from pathlib import Path
from statistics import median
import argparse,json
ROOT=Path(__file__).resolve().parents[1];folder=ROOT/'docs/performance'
ap=argparse.ArgumentParser();ap.add_argument('--prefix',default='loading');ap.add_argument('--baseline',default='7428ff7');args=ap.parse_args()
before=json.loads((folder/(args.prefix+'-before.json')).read_text());after=json.loads((folder/(args.prefix+'-after.json')).read_text())
assert before['method']==after['method']
assert before['browserVersion']==after['browserVersion']
for d in [before,after]:
 assert not any(r.get('failure') or r['errors'] for r in d['runs'])
 for profile in ['desktop','mobile']:assert sum(r['profile']==profile for r in d['runs'])>=3
metrics=[('elapsedMs','완료 관측까지(ms)',1),('longTasks.maxMs','최대 긴 작업(ms)',1),('longTasks.blockingMs','긴 작업의 50ms 초과분 합(ms)',1),('frameP95Ms','rAF 간격 p95(ms)',1),('renders.maxCalls','단일 render 최대 draw calls',1),('renders.maxTriangles','단일 render 최대 triangles',1),('encodedBytes','문서 누적 응답(KiB)',1024),('jsHeapBytes','JS 힙(MiB)',1024**2)]
phases=[('initial','초기 필름'),('monitor','모니터 진입'),('room-entry','공간 관계지도 진입'),('room-compute','컴퓨트 주제 전환'),('room-network','네트워크 주제 전환'),('scenario-entry','게임 시나리오 진입'),('object-entry','CPU 상세 진입')]
def get(d,path):
 for key in path.split('.'):d=d[key]
 return d
def values(d,profile,phase,path,scale):return [get(r['phases'][phase],path)/scale for r in d['runs'] if r['profile']==profile]
def show(v):return f'{median(v):,.1f} ({min(v):,.1f}–{max(v):,.1f})'
lines=['# 로딩·새 관계지도 반복 측정','',f"브라우저: Chromium {after['browserVersion']} / SwiftShader. 기준 `{args.baseline}`, 각 프로필·버전 3회. 셀은 **중앙값 (최소–최대)**.",'','로컬 gzip 서버, CPU 1배, 캐시 없음. 소프트웨어 GPU 결과이며 실기기/운영망 성능을 뜻하지 않는다. [방법과 제약](../loading-rendering.md)을 함께 읽는다. 시나리오/상세 완료 시간에는 고정 관측 대기 700ms가 포함된다.','']
for profile in ['desktop','mobile']:
 lines += [f'## {profile}','','| 구간 | 지표 | 변경 전 | 변경 후 | 중앙값 변화 |','|---|---|---:|---:|---:|']
 for phase,label in phases:
  for path,title,scale in metrics:
   a,b=values(before,profile,phase,path,scale),values(after,profile,phase,path,scale)
   delta=f'{(median(b)/median(a)-1)*100:+.1f}%' if median(a) else '—'
   lines.append(f'| {label} | {title} | {show(a)} | {show(b)} | {delta} |')
 lines+=['','### 변경 후 준비 시점','','| 지표 | 탐색 시작 이후 ms (중앙값, 최소–최대) |','|---|---:|']
 for mark,label in [('inside:cpu-preview-visible','CPU 이미지 스타일 적용'),('inside:cpu-visible','CPU 3D 제출'),('inside:computer-ready','컴퓨터·모니터 모델 생성 완료'),('inside:monitor-ready','모니터 준비 완료')]:
  samples=[]
  for r in after['runs']:
   if r['profile']!=profile:continue
   marks={m['name']:m['at'] for phase in r['phases'].values() for m in phase['marks']}
   if mark in marks:samples.append(marks[mark])
  lines.append(f'| {label} | {show(samples) if samples else "미관측"} |')
 lines+=['']
lines+=['## 해석','','최초 화면의 CPU 미리보기, CPU 3D, 전체 컴퓨터 준비는 서로 다른 완료 시점이다. `firstReadyMs`는 자동화가 `ready` 클래스를 관측한 시각이므로 CPU 제출 마크나 실제 화면 표시 시간과 일치하지 않을 수 있다. 이전 버전의 `ready`는 전체 컴퓨터 준비 뒤에 설정됐다. 같은 의미의 지표처럼 직접 비교하지 않는다.','','첫 모니터 캡처를 파일로 옮기면서 메인의 초기 전송량이 늘 수 있다. 그 대신 전환 순간의 RTT 생성과 관계지도 내장 payload/정밀 모델 비용을 줄인다. rAF 표본에는 정지 프레임이 포함되므로 개수가 다른 경로의 p95 하나만으로 부드러움을 판정하지 않는다. JS 힙은 GPU 메모리와 별개다. LCP 원시 관측은 JSON에 남기되 캔버스 장면의 완성도 지표로 비교하지 않는다.','']
if args.prefix!='loading':
 lines=lines[:lines.index('## 해석')]+['## 해석','','두 버전 모두 CPU 선표시/모니터 사전 준비가 적용된 상태다. 이번 변경은 외형과 전환의 일관성 보정이 중심이다. 기능·픽셀 비교 결과와 회귀한 수치를 포함해 [후속 기록](../visual-continuity.md)을 함께 읽는다. 이전 단계의 개선 폭을 이번 변경의 효과로 계산하지 않는다.','']
(folder/(args.prefix+'-comparison.md')).write_text('\n'.join(lines))
print(folder/(args.prefix+'-comparison.md'))
