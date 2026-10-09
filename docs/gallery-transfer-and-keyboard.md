# 관계지도 전환 잘림과 키보드 썸네일 수정

2026-10-09. 기준 소스는 `main`의 `6ddeaf1`이다.

## 원인과 변경

관계지도 벽·바닥의 `MeshBasicMaterial`은 `transparent: true`이지만 깊이 버퍼에는 계속 기록했다. 따라서 벽의 `opacity`가 0이어도, 목록과 전시 위치 사이를 이동하는 부품 이미지가 벽·바닥 뒤로 지나가면 직선으로 잘렸다. 목록의 시작/끝 좌표만 검사하면 발견하지 못하는 중간 프레임 문제였다.

`drawRoomScene()`에서 **진입·복귀 중에만** 배경을 그린 뒤 깊이 버퍼를 비우고 부품을 그린다. 배경 색과 벽이 나타나는 연출은 유지하면서 이동 중인 부품 전체를 표시한다. 전환이 끝난 관계지도의 기존 깊이 판정, 목록 배치, 이동 경로 및 카메라 계산은 유지한다. 추가 렌더 타깃이나 합성 패스는 만들지 않는다.

키보드가 있는 타이핑·저장·절전 복귀 썸네일 세 곳에서 막대 SVG를 제거했다. 공통 키보드에서 눌리는 키의 바닥은 고정하고 키캡만 4 SVG 단위 내려가도록 분리했다. 대상 키는 기본 상태에서 금색으로 구별되며, 미리보기에서는 밝은 키 표면과 테두리로 강조된다. Ctrl+S는 왼쪽 Ctrl 하나와 S를 함께 누른다. 기존 87키 배열과 화면 반응 시점은 유지했다. 마우스 미리보기와 키보드 포커스에 동일하게 적용하며, 동작 줄이기 설정에서는 전환 없이 상태를 표시한다. 터치 화면의 기본 썸네일에도 대상 키 색상이 보인다.

## 실제 렌더 픽셀 비교

Chromium/SwiftShader, PC 1440×900 및 모바일 390×844/DPR 1에서 각 방향의 진행률 0%, 20%, 40%, 60%, 80%, 95%를 캡처했다. 목록 맨 위와 650px 스크롤 위치를 검사하고, 두 번째 복귀는 관계지도 카메라를 회전한 상태에서 시작했다. 총 48개 중간 프레임이다.

진단 캡처는 벽의 색상 쓰기만 끄고 깊이 쓰기는 그대로 둔다. 이를 벽을 숨긴 독립 기준 캡처와 비교해, 화면 안에 있어야 하는 부품의 알파 픽셀이 사라졌는지 계산한다. 알파 차이가 32/255를 초과하는 픽셀을 센다. 화면 자체 밖에 있는 부품 영역은 이 측정에 포함하지 않는다. 일반 스크린샷은 원래 배경 색으로 저장한다. 테스트 훅은 응답 가로채기로만 넣으며 배포 코드에는 포함하지 않는다.

| 항목 | 수정 전 | 수정 후 |
|---|---:|---:|
| PC 표본 한 프레임의 최대 잘림 픽셀 수 | 100,083 | 0 |
| 모바일 표본 한 프레임의 최대 잘림 픽셀 수 | 27,269 | 0 |
| PC/모바일 목록 복귀 위치 최대 오차 | 0px | 0px |
| 키보드 썸네일당 막대 개수 | 1 | 0 |
| 저장 썸네일에서 눌리는 Ctrl 개수 | 2 | 1 |

동일 진행률의 부품 draw call 수는 전후 동일했다. 48개 표본에서 벽에 의해 추가로 잘린 픽셀은 모두 0이었다. 마우스 미리보기·키보드 포커스에서 키 눌림, 해제 후 기본 상태 복원, 동작 줄이기 설정의 애니메이션 0개, JavaScript 오류 0건을 확인했다.

- 픽셀 검사 원본: [수정 전](performance/gallery-transfer-before/checks.json), [수정 후](performance/gallery-transfer-after/checks.json)
- PC 진입 60%: [전](performance/gallery-transfer-before/desktop-entry.png), [후](performance/gallery-transfer-after/desktop-entry.png)
- 모바일 복귀 40%: [전](performance/gallery-transfer-before/mobile-exit.png), [후](performance/gallery-transfer-after/mobile-exit.png)
- 키보드 눌림: [타이핑](performance/gallery-transfer-after/desktop-typing-pressed.png), [저장](performance/gallery-transfer-after/desktop-save-pressed.png), [절전 복귀](performance/gallery-transfer-after/desktop-sleep-pressed.png)

## 성능 측정

Chromium 151.0.7922.173/SwiftShader에서 프로필·버전별 3회씩, 매회 새 브라우저와 빈 캐시로 측정했다. 로컬 `no-store` 서버의 관계지도 이미지 응답에는 120ms 지연을 주었다. 실제 서비스 RTT를 측정한 값은 아니다. 아래는 각 3회의 중앙값이다.

| 프로필 | 진입 완료 ms 전→후 | rAF 간격 p95 ms 전→후 | 최대 긴 작업 ms 전→후 | 50ms 초과 차단 합계 ms 전→후 |
|---|---:|---:|---:|---:|
| 1440×900 / DPR 1 | 3,465 → 3,410 | 50.0 → 49.9 | 0 → 0 | 0 → 0 |
| 3840×2160 / DPR 2 | 3,401 → 3,439 | 83.3 → 66.7 | 0 → 0 | 0 → 0 |
| 390×844 / DPR 3, 터치 | 3,309 → 3,382 | 16.8 → 16.8 | 0 → 0 | 0 → 0 |

이번 변경의 확인된 효과는 중간 프레임 잘림 제거다. 진입 완료 시간은 PC에서 55ms 줄었고 4K·모바일에서는 각각 38ms·73ms 늘어, 전반적인 속도 향상으로 해석하지 않는다. 캔버스 크기와 전환 표본의 부품 draw call 수는 동일하다. 진입 완료 시간은 기존 2,200ms 연출과 자동화 관측 지연을 포함하며, 부모 rAF 간격은 실제 GPU 렌더 시간/FPS가 아니다. 긴 작업 0은 표본 구간에서 50ms 이상 작업이 관측되지 않았다는 뜻이다.

JS 힙 중앙값은 PC 10,304,188→11,282,932B, 4K 10,613,060→10,900,624B, 모바일 12,270,696→11,122,456B였다. GC 시점에 영향을 받으며 GPU/네이티브 메모리를 포함하지 않는다. 실기기 Chrome GPU에서의 결과를 대체하지 않는다.

원본: [성능 전](performance/gallery-transfer-metrics-before.json), [성능 후](performance/gallery-transfer-metrics-after.json).

## 기존 동작 회귀 확인

[기존 화면 연결 검사](performance/gallery-transfer-continuity/checks.json)도 PC·모바일에서 통과했다. CPU 첫 프레임 픽셀 차이는 0, 전환 시작 위치 최대 오차는 0.00018px 미만이며, 부품 상세/연결 부품의 이미지 평면은 유지된다. 다른 시나리오로 이동할 때 이전 모델이 차단되고 87개 키캡이 키보드 안에 들어가는 것도 확인했다.

[첫 진입 복구 검사](performance/gallery-transfer-recovery.json)에서 준비 중 Escape 취소와 지속적인 전환 렌더 오류 후 이미지 탐색·상세 클릭·메인 복귀가 모두 통과했다. [검사 소스 SHA-256](performance/gallery-transfer-source-manifest.json)을 함께 보관한다.

## 재현

```bash
python3 tools/build_inside_manifest.py
python3 tools/test_gallery_transfer.py --root /path/to/6ddeaf1 --out /tmp/transfer-before
python3 tools/test_gallery_transfer.py --out /tmp/transfer-after --strict
python3 tools/measure_cold_gallery.py --root /path/to/6ddeaf1 --out /tmp/metrics-before.json
python3 tools/measure_cold_gallery.py --out /tmp/metrics-after.json
```

브라우저 검사는 병렬로 실행하지 않는다.
