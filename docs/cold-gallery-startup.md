# 새 Chrome에서 관계지도 첫 진입이 멈추는 경로 수정

2026-10-09. 기준은 `main`의 `220f4e6`이다. 제보는 “Chrome에서 첫 관계지도 진입 때 화면과 클릭이 멈추고, 새로고침하면 `#map`으로 열려 정상 동작한다”였다.

## 확인한 원인과 재현의 범위

메인 목록에서 들어갈 때는 `enterRoom()`의 준비→이동 애니메이션을 거친다. URL은 클릭 시 이미 `#map`으로 바뀐다. 따라서 새로고침하면 `initialRoute()`가 관계지도를 직접 열며 **첫 이동 애니메이션을 건너뛴다**. 두 경로의 차이를 기준으로 조사했다.

새 Chromium 프로세스·빈 캐시에서 정상 진입은 성공했다. 이 환경에서 사용자의 실제 GPU/드라이버가 멈추는 현상 자체를 재현한 것은 아니다. 다음 취약 경로는 코드와 결함 주입으로 확인했다.

1. **준비 전 입력 차단과 무기한 대기.** iframe을 즉시 표시하고 부모 목록을 `inert`로 바꾼 뒤 이미지와 셰이더를 기다렸다. 이때 자식은 아직 `view='wiki'`라 Escape 처리에도 해당하지 않는다. 이미지 디코딩·셰이더 대기에 제한 시간이 없어 준비가 끝나지 않으면 클릭 불가 상태가 지속된다.
2. **첫 렌더 실패 후 이동 상태가 남음.** `tick()`에서 `drawScene()`이 예외를 내면 이후 프레임 예약과 전환 완료 처리가 실행되지 않는다. 주제 선택은 `inert`, 닫기 버튼은 `disabled` 상태로 남는다. 진입 렌더에 지속 오류를 주자 7초 후에도 `view='entering', moving=true`였고, 같은 오류를 유지한 채 새로고침하면 직접 진입 경로에서 탐색이 가능했다. 이 결과는 제보와 같은 상태 전이를 재현한 것이며 실제 기기 오류의 종류를 입증한 것은 아니다.
3. **처음에 집중되는 자원 준비.** 23개 이미지를 순서대로 기다렸고, 텍스처 업로드 및 벽·그림자·합성 셰이더의 첫 사용이 큰 렌더 작업에 몰렸다.
4. **화면을 떠난 필름의 작업과 버퍼 유지.** `pauseCinema()`는 rAF만 멈췄다. CPU가 보이자마자 목록으로 나가는 재현에서 이후 메인보드 등 13단계가 숨은 화면에서 계속 생성됐고, 부모의 그리기 버퍼와 모니터 타깃도 유지됐다.
5. **주 캔버스에 픽셀 예산이 없음.** 제한은 오프스크린 합성 타깃에만 있었다. 3840×2160/DPR 2에서 주 캔버스는 5760×3240, 18,662,400픽셀이고 데스크톱 MSAA도 켜져 있었다.

## 변경

- 이미지 요청은 최대 4개씩 병렬로 처리한다. CPU·GPU 텍스처를 단계별로 업로드하고, 부품·벽/그림자·합성 프로그램을 전환 전에 준비한다.
- 주 캔버스는 데스크톱 1,440,000픽셀, 모바일 810,000픽셀 이하로 제한한다. 이 갤러리의 이미지 평면에는 MSAA를 사용하지 않는다. DOM 텍스트와 조작 영역은 CSS 해상도를 유지한다.
- 준비가 완료될 때까지 메인 목록을 조작할 수 있게 하고 Escape 취소도 유지한다. 숨겨진 iframe의 rAF를 기다리지 않고 준비한다. 로딩 메시지를 추가하지 않는다.
- 준비는 8초 제한과 `AbortController`를 갖는다. 지연·실패·WebGL 손실 시 GPU 자원을 정리하고 기존 이미지 탐색으로 이어지며, 부품 상세와 메인 복귀가 가능하다. 첫 렌더 예외도 같은 복구 경로를 사용한다. JavaScript가 완전히 차단된 동안 타이머가 선점 실행될 수 있다는 의미는 아니다.
- 필름의 미완료 생성은 부품 사이에서 중단한다. 관계지도 진입 시 사용하지 않는 부모 화면 버퍼/모니터 타깃을 1×1로 줄이고, 필름·부품·시나리오가 다시 필요하면 원래 화면 크기와 생성 작업을 복구한다.
- 취소한 iframe의 늦은 경로 메시지가 새 이동 경로를 덮어쓰지 않도록 확인한다.

준비와 복구는 `inside:room-start`, `inside:room-images-ready`, `inside:room-ready`, `inside:room-fallback` performance mark에 남긴다. 복구 마크의 `detail.reason`에는 실패 원인이 들어간다. 진단 정보는 브라우저 내에만 남고 외부로 전송하지 않는다.

## 실패 경로와 기능 검사

[수정 전](performance/cold-gallery-before.json), [수정 후](performance/cold-gallery-after.json), [지속 렌더 오류 전](performance/cold-gallery-render-error-before.json), [후](performance/cold-gallery-render-error-after.json).

| 검사 | 수정 전 | 수정 후 |
|---|---|---|
| CPU 이미지 응답이 지연된 준비 중 | 부모 클릭 차단, Escape로 취소 불가 | 부모 조작 및 Escape 취소 가능 |
| 셰이더 완료가 오지 않음 | 10초 관측 후에도 준비 상태 | 약 8초 후 이미지 탐색, 상세·복귀 가능 |
| 첫 전환에서 렌더가 계속 실패 | 이동 상태와 입력 차단 지속 | 이미지 탐색으로 복구, 상세·복귀 가능 |
| CPU 직후 필름을 떠남 | 숨은 화면에서 13단계 추가 생성 | 추가 생성 0단계, 복귀 시 이어서 완성 |
| 관계지도에서 부모 버퍼/타깃 | 1440×900 / 1536×864 | 1×1 / 1×1, 다시 필요할 때 복원 |
| 4K/DPR 2 갤러리 캔버스 | 5760×3240 | 1600×900, 픽셀 수 92.3% 감소 |

정상 데스크톱·4K·모바일 진입, 상세 클릭, 메인 복귀를 확인했다. [전체 기능 검사](performance/cold-gallery-functional.json)는 모든 관계 주제와 16개 시나리오, 자원 회수 및 WebGL 복구를 포함한다. [기존 로딩 UX 검사](performance/cold-gallery-loading-ux.json)도 통과했다. 복구 시험의 오류는 테스트 응답에만 주입하며, 배포 코드에 시험 전역 변수를 넣지 않는다.

[시각 회귀 검사](performance/cold-gallery-visual/checks.json)에서 CPU 시작 프레임, 관계지도 좌표·외형, 이전 시나리오 차단 및 키보드 배열을 확인했다. [데스크톱 연결 화면](performance/cold-gallery-visual/desktop-connection.png)과 [모바일 연결 화면](performance/cold-gallery-visual/mobile-connection.png)도 보관한다.

## 반복 성능 측정

프로필·버전별 3회, 매회 새 Chromium 프로세스와 빈 캐시로 시작했다. 로컬 `no-store` 서버에서 관계지도 이미지 응답에 120ms 지연을 주었다. 실제 GitHub Pages RTT를 측정한 값은 아니다. Chromium/SwiftShader, CPU 제한 1배이며 다른 브라우저 검사를 동시에 실행하지 않았다.

완료 시간은 실제 버튼 클릭부터 관계지도 이동 종료까지이며 기존 2,200ms 연출과 자동화 관측 지연을 포함한다. 긴 작업은 부모와 자식 문서에서 관측하고 `timeOrigin`으로 맞춰 중복을 제거하므로 숨겨진 준비 구간도 포함한다. rAF p95는 부모 콜백 간격이며 GPU 시간 또는 FPS와 동일하지 않다. 차단 시간 합계는 각 긴 작업의 50ms 초과분이며 Lighthouse TBT가 아니다.

Chromium 151.0.7922.173에서 각각 3회 중앙값은 다음과 같다.

| 프로필 | 진입 완료 ms 전→후 | rAF p95 ms 전→후 | 최대 긴 작업 ms 전→후 | 차단 시간 합계 ms 전→후 |
|---|---:|---:|---:|---:|
| 1440×900 / DPR 1 | 3,510 → 3,404 | 50.0 → 33.4 | 123 → 0 | 73 → 0 |
| 3840×2160 / DPR 2 | 4,610 → 3,366 | 616.6 → 66.7 | 340 → 0 | 290 → 0 |
| 390×844 / DPR 3, 터치 | 3,905 → 3,323 | 16.8 → 16.8 | 87 → 0 | 37 → 0 |

긴 작업의 0은 이 표본에서 50ms 이상 작업이 관측되지 않았다는 뜻이다. 모든 장치에서 긴 작업이 없음을 보장하지 않는다. 모바일의 프레임 간격은 거의 같고, 소프트웨어 GPU의 4K 결과도 60fps를 달성한 것은 아니다.

JS 힙 중앙값은 데스크톱 9,394,140→11,638,660B, 4K 7,713,636→10,144,792B, 모바일 12,622,448→12,311,876B였다. 앞의 두 환경에서는 증가했다. GC 시점에 영향을 받는 JavaScript 힙이며 GPU/네이티브 RAM 또는 메모리 최고치를 측정하지 않았다. 버퍼 픽셀 수 감소를 전체 메모리 감소율로 해석하지 않는다.

원본: [성능 전](performance/cold-gallery-metrics-before.json), [성능 후](performance/cold-gallery-metrics-after.json). 실제 Chrome 하드웨어 가속 환경의 드라이버 정지나 OS의 탭 종료가 해결됐다고 단정할 수는 없다. 이번 수정은 확인된 입력 차단·복구 누락을 제거하고 초기 GPU/CPU 부하를 제한한다.

## 재현

```bash
python3 tools/build_inside_manifest.py
python3 tools/test_cold_gallery.py --root /path/to/220f4e6 --out /tmp/cold-before.json
python3 tools/test_cold_gallery.py --out /tmp/cold-after.json --strict
python3 tools/test_cold_gallery.py --root /path/to/220f4e6 --cases entry-render-error --out /tmp/error-before.json
python3 tools/test_cold_gallery.py --cases entry-render-error --out /tmp/error-after.json --strict
python3 tools/measure_cold_gallery.py --root /path/to/220f4e6 --out /tmp/metrics-before.json
python3 tools/measure_cold_gallery.py --out /tmp/metrics-after.json
python3 tools/test_rendering.py
python3 tools/test_loading_ux.py
python3 tools/test_visual_continuity.py
```

각 브라우저 명령은 순차 실행한다. 측정 소스 SHA-256은 [source manifest](performance/cold-gallery-source-manifest.json)에 보관한다.
