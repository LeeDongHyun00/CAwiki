# 관계지도 복귀와 준비 중 페이드

2026-10-09. 기준은 `main`의 `1770289`이다. 메인 복귀에서 부품이 옅어졌다 다시 보이는 현상과 도착 후 크기 변화를 재현했다.

## 확인한 원인

1. 마지막 10% 구간에서 캔버스는 `1-finish`, 목록 이미지는 `finish`로 동시에 페이드했다. 중간에는 두 레이어가 각각 0.5이므로 합성 불투명도는 `0.5 + 0.5 × 0.5 = 0.75`이다. 실제 CPU 픽셀의 대비도 원래 목록 대비 **74.4%**까지 내려갔다.
2. iframe에 별도의 하드웨어 목록과 시나리오 썸네일을 만들고, 마지막에 원래 부모 목록으로 교체했다. 이미지 디코딩과 문서 레이아웃을 두 번 관리해야 하는 구조였다. 앞선 검사는 끝점 좌표와 벽에 의한 잘림을 확인했지만, 복귀 마지막 구간의 실제 합성 픽셀까지 검사하지 않았다.
3. iframe이 제거되면 커서 밑의 메인 이미지에 기존 `scale(1.055)` hover가 즉시 적용됐다. 포인터를 도착할 CPU 위치에 둔 재현에서 이미지의 위치·크기 값이 PC 최대 **34.08px**, 모바일 뷰포트 **18.70px** 변했다. 카드의 `figure` 크기는 그대로여서 이미지가 커지며 잘리는 것처럼 보였다.

## 변경

- 메인에 있던 실제 목록을 그대로 사용한다. 관계지도에 포함될 때는 iframe 안에 하드웨어·시나리오 복제 목록을 만들지 않는다. 진입과 복귀 좌표 모두 원래 목록에서 읽는다.
- 준비 중에는 메인 조작을 허용하고, 준비된 첫 부품 프레임을 그린 뒤 같은 동기 작업에서 캔버스와 DOM을 연결한다. 이동 중에는 메인 목록의 너비·스크롤 위치를 고정한다.
- 복귀 전에 보이는 목적지 이미지의 디코딩을 확인한다. 원본 응답이 1.2초를 넘기거나 실패하면 관계지도에서 이미 디코딩한 동일 부품의 미리보기 픽셀을 재사용한다. 이 실패 경로에서는 목록 이미지가 미리보기 해상도로 표시될 수 있다.
- 도착 위치에 목록 이미지를 **불투명도 1로 먼저 표시**한 뒤 캔버스만 걷어낸다. 배경 벽의 깊이 버퍼를 비우는 이전 잘림 수정은 유지한다.
- 실제 포인터 이동이 다시 발생하기 전까지 자동 hover 확대를 막는다. 사용자가 포인터를 움직이면 기존 hover 동작을 사용할 수 있다.
- 투명 iframe의 색상 모드를 자식 문서와 맞췄다. 부모의 dark 색상 모드를 상속하면 Chromium이 투명 영역을 불투명한 기본 배경으로 합성할 수 있어 실제 픽셀 검사로 확인했다.

준비가 **200ms를 넘을 때** 제목·상단 링크·탭·부품 이름/구분선이 900ms 동안 서서히 사라진다. 부품 이미지의 불투명도·크기·위치는 유지한다. 준비가 끝나면 진행 중인 페이드 밝기에서 관계지도 전환으로 이어진다. 200ms 전에 준비되면 준비 페이드를 시작하지 않는다. 준비 중 Escape 또는 다른 탭 선택으로 취소하면 원래 UI가 복원된다. 로딩 문구는 추가하지 않았다.

## 중간 화면 검증

Chromium/SwiftShader, 1440×900 및 390×844/DPR 1에서 진행률을 고정하고 스크린샷을 비교했다. CPU 미리보기 요청을 보류해 준비 구간을 관측하고, 복귀 88%, 90%, 92.5%, 95%, 97.5%, 99%의 픽셀을 읽었다. 마지막에는 실제 iframe 제거와 메인 경로 복귀까지 실행했다. 반환 콜백을 모킹하지 않았다.

대비 비율은 원래 메인의 CPU 영역에서 RGB 모든 채널이 160 미만인 픽셀을 골라, 배경 236 대비 어두운 정도를 비교한 값이다. 해상도·투명 테두리의 미세 차이로 정확히 1.0이 되지 않을 수 있으며 FPS 지표는 아니다.

| 검사 | PC 전→후 | 모바일 뷰포트 전→후 |
|---|---:|---:|
| 복귀 95% CPU 대비 | 74.42% → 99.81% | 74.43% → 99.79% |
| 커서를 둔 채 복귀한 이미지 최대 위치/크기 변화 | 34.08 → 0px | 18.70 → 0px |
| 스크롤 후 왕복의 목록 위치 변화 | 0 → 0px | 0 → 0px |
| iframe 내부의 복제 하드웨어 이미지 | 23 → 0개 | 23 → 0개 |
| 준비 중 원래 부품 대비 유지 | 100% → 100% | 100% → 100% |

수정 후 준비 80ms 시점에는 제목 불투명도 1, 지연 준비 후에는 제목 0·부품 1이었다. 부모 목록의 이미지 DOM 노드는 왕복 후에도 동일했다.

- [픽셀·배치 검사 전](performance/wiki-return-before/checks.json) / [후](performance/wiki-return-after/checks.json)
- 복귀 중간 화면: [PC 전](performance/wiki-return-before/desktop-landing.png) / [후](performance/wiki-return-after/desktop-landing.png), [모바일 전](performance/wiki-return-before/mobile-landing.png) / [후](performance/wiki-return-after/mobile-landing.png)
- 준비 중 화면: [PC](performance/wiki-return-after/desktop-preparing.png), [모바일](performance/wiki-return-after/mobile-preparing.png)
- [직접 진입·느린 원본·이미지 전용 모드·동작 줄이기·크기 변경·탭 취소·200ms 경계 검사](performance/wiki-return-edges.json)

기존 [48개 중간 프레임의 잘림 검사](performance/wiki-return-clipping/checks.json)는 잘림 0픽셀·목록 복귀 오차 0px였다. [화면 연결 검사](performance/wiki-return-continuity/checks.json)는 CPU 첫 프레임, 부품 상세/연결의 외형, 이전 시나리오 차단과 87키 배열을 확인했다. [첫 진입 복구 검사](performance/wiki-return-recovery.json)는 준비 취소, 셰이더 지연, 첫/지속 렌더 오류, 필름 중단·복구, 4K·모바일을 포함한다. 마지막 페이드 최적화 뒤에도 [취소와 지속 렌더 오류 복구](performance/wiki-return-final-recovery.json)를 재확인했다.

## 성능 측정과 남은 비용

Chromium 151.0.7922.173/SwiftShader에서 프로필·버전별 3회, 매회 새 프로세스와 빈 캐시로 측정했다. 로컬 `no-store` 서버의 관계지도 이미지 응답에 120ms 지연을 주었다. 아래는 중앙값이며 실제 GitHub Pages RTT가 아니다.

| 프로필 | 진입 완료 ms 전→후 | 부모 rAF 간격 p95 ms 전→후 | 최대 긴 작업 ms 전→후 | 50ms 초과 차단 합계 ms 전→후 |
|---|---:|---:|---:|---:|
| 1440×900 / DPR 1 | 3,424 → 3,569 | 33.4 → 33.4 | 0 → 0 | 0 → 0 |
| 3840×2160 / DPR 2 | 3,383 → 3,694 | 66.7 → 66.6 | 0 → 0 | 0 → 0 |
| 390×844 / DPR 3 | 3,313 → 3,469 | 16.7 → 16.8 | 0 → 0 | 0 → 0 |

**전반적인 속도 향상을 입증한 변경은 아니다.** 진입 완료는 약 145~311ms 늘었다. 이번 구조는 정렬된 첫 캔버스를 제출한 뒤 기존 2,200ms 전환 시계를 시작한다. 완료 시간은 준비·연출·자동화 관측 지연을 함께 포함한다. rAF 간격은 GPU 렌더 시간/FPS와 동일하지 않으며, 긴 작업 0은 이 표본에서 50ms 이상 작업이 없었다는 뜻이다.

페이드 초안은 상속 CSS 변수를 부모 목록에 매 프레임 갱신했다. 숨겨진 시나리오 SVG까지 스타일 재계산 범위에 들어가지 않도록 최종 구현에서는 제목·탭·캡션의 `opacity`만 바꾸고, 이미지 불투명도는 값이 바뀔 때만 갱신한다. PC에서 두 방식을 각각 3회 비교한 CDP `RecalcStyleDuration` 누적 중앙값은 **82.90→60.28ms(약 27% 감소)**였다. 이 별도 실험의 진입 시간은 2,930→2,936ms로 거의 같았다. 스타일 계산 비용 감소를 전체 진입 시간 감소로 해석하지 않는다. [스타일 실험 원본](performance/wiki-return-style-profile.json), [초안 성능 기록](performance/wiki-return-metrics-prototype.json).

JS 힙 중앙값은 PC 11,000,424→11,146,044B, 4K 11,578,024→10,039,408B, 모바일 12,278,120→12,097,492B였다. GC 시점에 영향을 받는 값이며 GPU/네이티브 메모리는 포함하지 않는다.

[전체 측정 전](performance/wiki-return-metrics-before.json) / [후](performance/wiki-return-metrics-after.json), [소스 SHA-256](performance/wiki-return-source-manifest.json).

## 재현

```bash
python3 tools/build_inside_manifest.py
python3 tools/test_wiki_return.py --root /path/to/1770289 --out /tmp/return-before
python3 tools/test_wiki_return.py --out /tmp/return-after --strict
python3 tools/test_wiki_return_edges.py
python3 tools/test_gallery_transfer.py --out /tmp/return-clipping --strict
python3 tools/measure_cold_gallery.py --root /path/to/1770289 --out /tmp/return-metrics-before.json
python3 tools/measure_cold_gallery.py --out /tmp/return-metrics-after.json
```

브라우저 검사는 순차 실행한다. 모바일 결과는 터치 설정의 Chromium 뷰포트 검사이며 실기기 GPU 검사를 대체하지 않는다.
