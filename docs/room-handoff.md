# 메인 목록과 관계지도 사이의 화면 인계 수정

2026-10-09. 기준 소스는 `main`의 `4ff1d66`이다. 메인→관계지도 준비 중 부품이 사라졌다 나타나는 현상을 재현했고, 실제 메인 목록을 유지한 채 같은 위치에서 애니메이션을 시작하도록 수정했다. 관계지도 버튼도 시나리오 바로 옆으로 옮겼다.

## 원인과 변경

이전 구현은 관계지도 iframe이 메시지를 받자마자 표시됐다. 이때 iframe 안의 **두 번째 목록**은 이미지를 다시 준비하고 있었다. 원래 메인 목록의 이미지가 디코딩돼 있어도, 그 위를 아직 비어 있는 새 목록이 덮었다. 준비가 끝나면 부품이 다시 나타나 애니메이션을 시작했다. 복귀 시에도 두 목록을 교체했다.

앞선 [시각 일관성 검사](visual-continuity.md)는 카메라·투영 좌표와 마지막 복귀 위치를 확인했지만, 준비 중 실제로 어느 문서가 보이는지 검사하지 않았다. 이번 재현에서도 수정 전 끝점 좌표 오차는 거의 0이었다. **끝점 일치만으로 중간 프레임의 연속성을 판단한 검증 공백**이었다.

- `RelationshipRoomHost`가 원래 메인 목록의 너비·스크롤 위치를 고정한다. 준비 중 목록은 그대로 보이며 iframe은 숨겨진다. 로딩 문구나 별도 로딩 화면을 추가하지 않는다.
- iframe은 중복 하드웨어 목록과 시나리오 SVG를 만들지 않는다. 부모의 실제 이미지 영역을 읽어 같은 위치·크기의 첫 WebGL 프레임을 제출한 후, 같은 동기 작업에서 목록 이미지와 캔버스를 교체한다. 이후에 애니메이션 시간을 시작한다.
- 복귀는 현재 표시 중인 부품 위치·카메라에서 시작한다. 대상 목록의 이미지를 미리 디코딩하고, 도착한 평면과 고정된 원래 목록을 겹쳐 전환한다. 필터 때문에 숨겨진 부품은 벽 위치에 갑자기 나타나지 않고 마지막 목록에서 드러난다.
- 메인 하드웨어 목록의 hover 확대(`1.055`)를 제거했다. 전환이 끝난 뒤 커서 아래 카드만 다시 커졌다 작아지지 않는다.
- 시나리오 탭에서 열었다 돌아오면 해당 탭을 유지한다. 하드웨어 목록을 중간에 강제로 노출하지 않는다.
- 복귀와 부품 클릭 메시지가 겹칠 때, 늦게 도착한 iframe 경로가 새 메인 경로를 덮어쓰는 경합도 수정했다. 부모가 관계지도 경로를 떠났다면 이전 메시지는 적용하지 않는다.
- 관계지도 버튼의 `margin-left:auto`를 제거해 시나리오 다음에 동일한 30px 간격으로 배치했다.

## 중간 프레임 검증

Chromium 151.0.7922.173 / SwiftShader, 1440×900 및 390×844, DPR 1. 관계지도 CPU 미리보기 응답에 **1,200ms 지연**을 주고 상단 및 1,000px 스크롤 위치에서 실제 iframe 제거까지 관측했다. 수정 전은 `4ff1d66`의 별도 소스 스냅샷에서 실행했다.

| 항목 | 데스크톱 전→후 | 모바일 전→후 |
|---|---:|---:|
| CPU 표시가 비는 관측 프레임 수, 상단 | 73 → **0** | 72 → **0** |
| 준비 완료 전 iframe 표시 프레임 수, 상단 | 75 → **0** | 76 → **0** |
| 원래 부모 목록의 최대 위치/크기 변화 | 0 → **0px** | 0 → **0px** |
| 시나리오↔관계지도 버튼 간격 | 1,064 → **30px** | 137 → **30px** |
| 준비 중 CPU 영역과 클릭 전 영역의 RGB 평균 절대 차이 | 15.30 → **0/255** | 21.34 → **0/255** |

빈 프레임 수는 rAF마다 부모/자식의 표시 상태·이미지 디코딩 상태·캔버스 불투명도를 관측한 값이다. GPU 프레임을 녹화한 수치와 동일하지 않으므로, 별도로 클릭 400ms 후 스크린샷의 CPU 영역도 비교했다. 수정 전 CPU가 없는 화면과 수정 후 유지되는 화면을 직접 확인했다. 픽셀 비교는 해당 두 해상도의 준비 중 한 시점에 대한 검증이다.

원본: [수정 전](performance/room-handoff-before.json), [수정 후](performance/room-handoff-after.json), [픽셀 비교](performance/room-handoff/visual-checks.json).

캡처: [데스크톱 준비 전 구현](performance/room-handoff/desktop-before-preparation.png), [준비 수정 후](performance/room-handoff/desktop-after-preparation.png), [복귀 수정 후](performance/room-handoff/desktop-after-return.png), [모바일 준비 전 구현](performance/room-handoff/mobile-before-preparation.png), [준비 수정 후](performance/room-handoff/mobile-after-preparation.png), [복귀 수정 후](performance/room-handoff/mobile-after-return.png).

두 화면 크기에서 상단/스크롤 후 왕복, hover 상태 왕복, 실제 iframe 제거 후 스크롤 복구, 시나리오 탭 유지, 준비 중 Escape 취소, 이미지 전용 모드, 늦은 경로 메시지 차단을 통과했다. 마지막 WebGL 이미지와 부모 목록의 좌표 오차는 `1e-12px` 미만이다. 위치 검사에서 iframe 복귀 동작을 모킹하지 않는다.

기존 [기능 검사 13항목](performance/room-handoff-functional.json), [로딩 UX 검사 11항목](performance/room-handoff-loading-ux.json), [시각 일관성 검사](performance/room-handoff/continuity/checks.json)도 통과했다. CPU 시작 이미지·건너뛰기·이전 시나리오 차단·87키 배열·관계지도 상세/연결의 외형 유지와 WebGL 손실 후 탐색/복귀를 포함한다. 페이지 JavaScript 오류는 없었다.

## 성능 비교와 한계

`measure_room_transfer.py`로 버전·프로필별 3회씩 순차 실행했다. 로컬 `no-store` HTTP 서버, 인위적 지연 없음, CPU 제한 1배, 데스크톱 DPR 1/모바일 DPR 3, 동일 Chromium/SwiftShader다. 측정 중 다른 브라우저 검사는 실행하지 않았다. 아래는 중앙값이다. 이전 문서의 gzip 기반 전체 경로 측정과 직접 비교하지 않는다.

| 구간 | 완료 관측 ms 전→후 | rAF p95 ms 전→후 | 긴 작업 차단 시간 합계 ms 전→후 |
|---|---:|---:|---:|
| 데스크톱 진입 | 2,791 → 2,828 | 50.1 → 50.1 | 69 → 71 |
| 데스크톱 복귀 | 2,795 → 2,896 | 50.1 → 50.1 | 0 → 0 |
| 모바일 진입 | 2,600 → 2,690 | 16.8 → 16.8 | 19 → 35 |
| 모바일 복귀 | 2,359 → 2,367 | 16.7 → 16.7 | 0 → 0 |

중복 목록 제거로 **iframe 내부 DOM은 3,234→106개(96.7% 감소)**다. 전체 앱 DOM 감소율을 뜻하지 않는다. 진입 후 JS 힙 중앙값은 데스크톱 10,727,388→10,262,776B, 모바일 10,837,420→10,147,716B였다. GC 시점에 영향을 받는 JS 힙 관측값이며 GPU/네이티브 메모리나 메모리 최고치를 측정한 값이 아니다. iframe 자원 응답 본문 합계는 1,390,132→1,391,668B로 소폭 증가했다.

이번 변경은 준비 중 빈 화면과 목록 교체를 없앴지만 **프레임 속도 개선을 입증하지는 못했다**. 진입/복귀 시간도 약간 늘었고 모바일 진입의 긴 작업 차단 시간도 늘었다. 완료 시간에는 기존 진입 2,200ms/복귀 2,300ms 연출과 자동화 관측 지연이 포함된다. rAF p95는 준비 구간을 포함한 콜백 간격이며 GPU 렌더 시간이나 FPS 자체가 아니다. 차단 시간은 각 50ms 초과 작업에서 초과분을 합한 값으로, Lighthouse TBT가 아니다.

원본은 [성능 수정 전](performance/room-handoff-metrics-before.json), [수정 후](performance/room-handoff-metrics-after.json)에 긴 작업·rAF·draw calls·삼각형·본문 바이트·JS 힙까지 보관했다. 실제 iOS/Android GPU 및 탭 재로드/OS 메모리 종료는 이 환경에서 검증하지 못했다.

## 재현

```bash
# 4ff1d66 소스를 별도 디렉터리에 준비한 뒤 실행
python3 tools/build_inside_manifest.py
python3 tools/test_room_transfer.py --root /path/to/4ff1d66 --out /tmp/handoff-before.json
python3 tools/test_room_transfer.py --out /tmp/handoff-after.json --strict
python3 tools/capture_room_transfer.py --before /path/to/4ff1d66 --out /tmp/handoff-captures
python3 tools/measure_room_transfer.py --root /path/to/4ff1d66 --out /tmp/metrics-before.json --runs 3
python3 tools/measure_room_transfer.py --out /tmp/metrics-after.json --runs 3
python3 tools/test_rendering.py
python3 tools/test_loading_ux.py
python3 tools/test_visual_continuity.py
```

브라우저 검사는 서로 동시에 실행하지 않는다. 테스트 응답에만 관측 코드를 주입하며 실제 배포 파일에 테스트 전역 변수를 넣지 않는다. 검증한 실행 소스의 SHA-256은 [source manifest](performance/room-handoff-source-manifest.json)에 남긴다.
