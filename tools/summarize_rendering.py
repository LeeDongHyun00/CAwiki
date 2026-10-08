#!/usr/bin/env python3
"""Build an honest median/range comparison from two measure_rendering runs."""
import argparse
import json
import statistics
from pathlib import Path

ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument('before', type=Path)
ap.add_argument('after', type=Path)
ap.add_argument('--out', type=Path, required=True)
args = ap.parse_args()
before, after = (json.loads(p.read_text()) for p in (args.before, args.after))
assert before['method'] == after['method'], 'Measurement methods must match'
assert before['browserVersion'] == after['browserVersion'], 'Browser versions must match'
assert all(not r.get('failure') and not r['errors'] for d in (before, after) for r in d['runs']), 'A run failed'

def values(data, profile, get):
    return [get(r) for r in data['runs'] if r['profile'] == profile]

def cell(xs, digits=0):
    return f'{statistics.median(xs):,.{digits}f} ({min(xs):,.{digits}f}–{max(xs):,.{digits}f})'

lines = ['# 변경 전후 측정 비교', '',
         f'브라우저: {before["browserVersion"]}. 측정기 v{before["method"]["version"]}. 표는 **중앙값 (최솟값–최댓값)**.', '',
         'localhost gzip / SwiftShader / CPU throttle 1. 실제 휴대폰 FPS·VRAM·INP 측정이 아니다.', '',
         f'원본: [{args.before.name}]({args.before.name}), [{args.after.name}]({args.after.name}).', '']
for profile in ['desktop', 'mobile']:
    n = len(values(before, profile, lambda r: r))
    assert n == len(values(after, profile, lambda r: r)) and n >= 3
    lines += [f'## {profile} — 각각 {n}회', '', '| 지표 | 변경 전 | 변경 후 | 중앙값 변화 |', '|---|---:|---:|---:|']
    metrics = [
        ('앱 ready (ms)', lambda r: r['readyMs'], 0),
        ('초기 encoded body 합 (KiB)', lambda r: r['phases']['initial']['resourceBytes']/1024, 1),
        ('필름+모니터 텍스처 RGBA 환산 (MiB)', lambda r: r['phases']['initial']['retainedSceneTexturePixels']*4/1048576, 2),
    ]
    for phase in ['initial', 'monitor', 'relationship', 'relationship-network', 'scenario-game', 'scenario-save']:
        metrics += [(phase+' 최대 long task (ms)', lambda r, p=phase: r['phases'][p]['longTasks']['maxMs'], 0)]
    metrics += [('관계지도 network 최대 draw call / render', lambda r: r['phases']['relationship-network']['renders']['maxCalls'], 0)]
    for label, get, digits in metrics:
        a, b = values(before, profile, get), values(after, profile, get)
        ma, mb = statistics.median(a), statistics.median(b)
        change = f'{(mb/ma-1)*100:+.1f}%' if ma else '—'
        lines.append(f'| {label} | {cell(a,digits)} | {cell(b,digits)} | {change} |')
    lines += ['', '프레임 간격 p95는 정지 프레임과 작은 표본 수의 영향을 받는다. 아래 값은 FPS 판정용이 아니다.', '',
              '| 구간 | 변경 전 rAF p95 (ms) | 변경 후 rAF p95 (ms) | 변경 전/후 표본 수 중앙값 |', '|---|---:|---:|---:|']
    for phase in ['monitor','relationship','relationship-network','scenario-game','scenario-save']:
        a,b=(values(d,profile,lambda r:r['phases'][phase]['frames']['p95Ms']) for d in (before,after))
        na,nb=(statistics.median(values(d,profile,lambda r:r['phases'][phase]['frames']['n'])) for d in (before,after))
        lines.append(f'| {phase} | {cell(a,1)} | {cell(b,1)} | {na:g} / {nb:g} |')
    lines.append('')
lines += ['## 한계와 회귀 해석', '',
          '- 늦게 전달되는 관측값의 누락을 줄이기 위해 두 번의 rAF와 타이머, longtask observer.takeRecords()를 거친 뒤 수집했다. GPU 타이머 쿼리로 실행 시간을 측정한 것은 아니다.',
          '- 각 구간은 라우팅·모델 생성·전환 애니메이션을 포함한다. `durationMs`가 계획한 대기보다 길면 실제 실행이 그만큼 지연된 것이다.',
          '- p95가 커진 구간도 원본과 표에 남겼다. 긴 정지 하나 뒤 다수의 idle 프레임이 붙으면 p95가 작게 보일 수 있다. 프레임 최댓값·long task·표본 수를 같이 확인한다.',
          '- 남아 있는 수백 ms 이상의 작업은 해결 완료로 취급하지 않는다. 실제 모바일 재로드 해결과 목표 프레임 예산은 실기기에서 별도로 검증해야 한다.',
          '- 초기 크기는 초기 구간의 실제 요청 합이다. 외부화된 모든 자산의 전체 용량이 그만큼 줄었다는 뜻이 아니다.', '']
args.out.write_text('\n'.join(lines))
