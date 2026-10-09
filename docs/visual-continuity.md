# 외형과 전환의 일관성 보정

후속 제보에서 준비 중 iframe의 두 번째 목록이 원래 목록을 덮어 부품이 사라지는 현상을 재현했다. 이 문서의 좌표 끝점 검사는 그 구간을 놓쳤다. [메인↔관계지도 화면 인계 수정](room-handoff.md)에 추가 원인·수정·중간 프레임 검증을 기록했다.

2026-10-09 (한국 시간). 기준은 `main`의 `059629c`다. 앞선 [로딩·공간 관계지도 최적화](loading-rendering.md) 이후 발견된 외형 교체, 확대·축소, 시나리오 이전 프레임 노출을 수정했다. 앞선 최적화의 개선 폭과 이번 결과를 구분한다.

## 변경 원인과 최종 동작

| 문제 | 원인 | 변경 |
|---|---|---|
| 관계지도 상세/연결 상대의 외형이 달라짐 | 전체보기의 이미지 평면을 별도 조명과 회전으로 만든 절차적 3D 모델로 교체 | 같은 원본 이미지의 해상도만 높인다. 평면·좌표·방향은 유지하며 상세 1개/연결 2개의 원본 텍스처만 보유한다. 닫을 때 원본 텍스처를 해제한다. |
| 목록↔관계지도에서 커졌다 작아짐 | 카메라 위치·FOV·부품 크기를 동시에 변경하고, 잘린 이미지와 잘리지 않은 목록 이미지를 섞어 사용 | 두 방향 모두 카메라를 고정하고 실제 DOM 이미지의 `object-fit:contain` 영역을 해당 카메라 공간으로 역투영한다. 이미지의 알파 여백도 동일하게 유지한다. 목록 전체를 옆으로 밀던 연출은 없앴다. |
| 시작 CPU와 실제 필름의 모습이 다름 | 관계지도용 CPU 사진을 필름의 다른 카메라·조명 앞에 표시 | 필름의 실제 첫 프레임으로 데스크톱/모바일 시작 이미지를 생성한다. `build_cpu_intro.py`로 재현한다. |
| 건너뛰기가 모니터까지 진행 | 목표 진행률이 1.0 | 0.93의 조립된 보드에서 종료한다. 모니터는 계속 비동기 준비하지만 다음 스크롤/드래그 전에는 나타나지 않는다. |
| 시나리오에서 이전 모델이 잠깐 노출 | 가림막의 200ms 지연 전에 재사용 캔버스가 표시됨 | 준비 시작과 같은 작업에서 이전 캔버스/설명을 숨기고 검정 바탕을 표시한다. 현재 장면을 그린 뒤 노출한다. 200ms 이하는 추가 애니메이션·인위적 대기 없이 바로 보여준다. 초과 시 기존 360–1200ms 밝아짐을 적용한다. |
| 타이핑 썸네일 Ctrl이 본체 밖에 위치 | 문자 3줄과 Ctrl이 별도 좌표계에 있고 실제 하단 키 배열이 없음 | ANSI TKL 87키 배열, 기능키·숫자열·수정키·스페이스바·방향키를 하나의 데크 좌표계로 구성한다. A/S 누름 막대의 끝점도 실제 키 중심에서 계산한다. 저장/잠자기 썸네일에도 같은 키보드를 사용한다. |

관계지도는 원근과 벽 배치를 가진 이미지 평면 전시다. 상세에서 임의로 돌릴 수 있는 정밀 입체 모델로 자동 교체하지 않는다. 메인 하드웨어 항목의 별도 3D 살펴보기는 유지한다. 이 선택으로 외형 연속성과 모바일 렌더링 비용을 함께 관리한다.

키보드 배열 참고: [Keychron C1 공식 제품 페이지](https://www.keychron.com/products/keychron-c1-wired-mechanical-keyboard), [공식 키캡 배열 도면](https://cdn.shopify.com/s/files/1/0059/0630/1017/t/5/assets/keychronc1keycapsizelayout--edited-1650872980416.jpg). 사진을 제품에 삽입하지 않고 키 비율과 배치를 참고해 SVG로 작성했다.

## 검증

[시각 검사 원본](performance/continuity/checks.json), [로딩 UX 검사](performance/continuity-loading-ux.json), [전체 기능 검사](performance/continuity-functional.json)를 보관한다.

- CPU 프레임: 1440×900 및 390×844, DPR 1의 실제 첫 렌더와 생성 이미지 RGB 평균 절대 차이 **0/255**. 이 결과는 해당 두 기준 화면의 비교이며 모든 화면비·장치 GPU의 픽셀 동일성을 뜻하지 않는다.
- 관계지도: 두 방향 모두 전환 내내 카메라 위치·회전·FOV가 동일했다. 표시 영역의 끝점 오차는 두 프로필에서 부동소수점 오차 수준(`1.2e-13px` 이하). iframe 진입 전 부모 목록과 CPU 카드 경계도 일치했다.
- 상세 및 연결 상대: 전환 전후 그룹·지오메트리 식별자가 동일하며 이미지 경로만 같은 원본의 고해상도로 변경됐다.
- 연속 시나리오: 게임→타이핑 진입에 지연을 주고 DOM 변경 시점을 관측했다. 준비 중 이전 캔버스는 `visibility:hidden`, 바탕은 검정이며 완료 후 가림 상태가 해제됐다.
- 건너뛰기: 모니터 준비에 지연을 주어도 중간 프레임을 거쳐 0.93에서 멈췄다. 추가 대기만으로 모니터에 진입하지 않고 사용자 스크롤 후에 진행됐다. 취소 후 실제 장면 복구도 통과했다.
- 키보드: 87개 키의 경계가 모두 데크 내부에 있다. 데스크톱/모바일 썸네일을 캡처해 배열과 막대 위치를 확인했다.

캡처: [데스크톱 연결](performance/continuity/desktop-connection.png), [모바일 연결](performance/continuity/mobile-connection.png), [타이핑 썸네일](performance/continuity/desktop-typing.png), [모바일 썸네일](performance/continuity/mobile-typing.png).

## 성능 기록

[전체 반복 비교](performance/continuity-comparison.md)는 기존 v3 경로를 같은 Chromium/SwiftShader, 로컬 gzip 서버, CPU 제한 1배에서 버전·프로필별 3회씩 실행했다. 별도 스냅샷의 수정 전 소스와 현재 소스를 비교하며 측정 중 다른 브라우저 테스트를 실행하지 않았다. 완료 시간, 긴 작업, rAF p95, draw calls/triangles, 누적 전송량, JS 힙을 모두 남긴다. 메트릭의 정의와 고정 대기 시간은 [기존 측정 방법](loading-rendering.md#검증과-측정-방법)을 따른다.

중간 실험 [continuity-iteration-1.json](performance/continuity-iteration-1.json)에서는 iframe 목록에 원본 이미지를 사용하면서 관계지도 누적 전송량이 데스크톱 728→2,088KB, 모바일 728→1,743KB로 증가했다. 최종안은 같은 여백의 512px 미리보기를 목록·전체보기에서 공유하고 선택한 상세에만 원본을 요청한다. 이 회귀를 숨기지 않고 별도 기록으로 남겼다.

원본: [변경 전](performance/continuity-before.json), [변경 후](performance/continuity-after.json). 상세/연결의 지연 교체는 전체 경로에 포함되지 않으므로 별도 `measure_room_detail.py`에서 이동 종료와 고해상도 준비를 모두 기다려 측정한다.

별도 상세 측정 원본: [변경 전](performance/continuity-detail-before.json), [변경 후](performance/continuity-detail-after.json). 아래는 각 3회 중앙값이며, 준비 완료 시간에는 850ms 이동 연출과 자동화 관측 지연도 포함된다. 삼각형은 단일 `renderer.render`의 최대 제출량이다.

| 환경·구간 | 완료 관측 ms (전→후) | 최대 긴 작업 ms (전→후) | 최대 삼각형 (전→후) |
|---|---:|---:|---:|
| desktop / cpu | 1,691 → 1,015 | 596 → 141 | 61,575 → 66 |
| desktop / pair | 2,049 → 1,374 | 313 → 81 | 90,117 → 66 |
| mobile / cpu | 1,433 → 933 | 416 → 0 | 61,575 → 50 |
| mobile / pair | 1,489 → 942 | 238 → 0 | 90,117 → 50 |

전체 경로에서는 관계지도 문서 누적 응답 본문이 **727,633→582,524B (약 20% 감소)**다. 진입 완료는 데스크톱 **3,066→3,024ms**, 모바일 **2,680→2,703ms**로 사실상 비슷하다. 데스크톱 관계지도 rAF p95는 **50.1→66.6ms**로 악화됐고 모바일은 **16.8→16.8ms**다. 고정 카메라/정렬 정확성을 확인했지만 전체보기 애니메이션의 프레임 속도 개선을 입증한 결과는 아니다.

시작 CPU를 실제 첫 프레임으로 맞춘 대가로 초기 문서 전송량은 데스크톱 **617,878→783,347B**, 모바일 **485,045→495,500B**로 늘었다. CPU 이미지가 준비되는 시점과 실제 3D 준비 시점은 별도 마크로 남긴다.

이번 최종 3회에서 모바일 초기 필름 완료 관측은 **4,064→4,437ms**, 게임 시나리오는 **2,246→2,714ms**, 시나리오 최대 긴 작업은 **1,456→2,035ms**로 악화됐다. 데스크톱 게임 시나리오는 **3,326→3,339ms**다. 모델/셰이더 첫 준비의 긴 작업이 남아 있으며, 검정 전환으로 이전 프레임을 감췄다는 사실을 계산 시간 개선으로 해석하지 않는다. 이 표본만으로 악화 원인을 단정하거나 실제 단말의 성능을 보장하지 않는다.

실제 모바일 기기의 탭 재로드/OS 메모리 종료는 이 환경으로 재현할 수 없다. 이번 결과는 모바일 화면·터치·DPR을 모사한 Chromium 소프트웨어 GPU 결과다. 실제 iOS Safari와 Android에서 장시간 왕복, 회전, 절전 복귀를 확인하는 과제는 남아 있다. CPU·시나리오 최초 3D 생성의 긴 작업도 이번 외형 보정만으로 제거되지 않는다.

## 재현

```bash
python3 tools/build_room_previews.py
python3 tools/build_cpu_intro.py
python3 tools/build_inside_manifest.py
python3 tools/test_loading_ux.py
python3 tools/test_visual_continuity.py
python3 tools/test_rendering.py
python3 tools/measure_loading.py --root /path/to/059629c --out docs/performance/continuity-before.json --runs 3
python3 tools/measure_loading.py --out docs/performance/continuity-after.json --runs 3
python3 tools/summarize_loading.py --prefix continuity --baseline 059629c
python3 tools/measure_room_detail.py --root /path/to/059629c --out docs/performance/continuity-detail-before.json
python3 tools/measure_room_detail.py --out docs/performance/continuity-detail-after.json
```

시작 필름의 모델·재질·조명·카메라를 수정하면 CPU 이미지를 다시 생성해야 한다. 모든 런타임 자산·모듈 변경 후 manifest를 갱신한다. 검증 전후 소스 해시는 `performance/continuity-source-manifest.json`에 기록한다.

## 동일 증상 제보 후 배포 재검증

2026-10-09, 제보 주소 `https://leedonghyun00.github.io/CAwiki/#wiki`를 기준으로 HTML 두 개와 관계지도·필름·시나리오 전환·키보드 관련 모듈 다섯 개의 응답 본문을 비교했다. 모두 `b943422`의 파일과 일치했다. 같은 소스의 데스크톱/모바일 시각 검사를 다시 통과했고, 이번 검사에서는 제보된 외형 교체와 이전 시나리오 모델 노출을 재현하지 못했다. 사용자 브라우저가 실제로 읽은 버전이나 실기기 렌더링을 관측한 것은 아니다.

추가로 목록을 1,000px 내린 뒤 **실제 iframe 제거와 부모 목록 복귀까지** 검사했다. 두 프로필 모두 스크롤이 1,000px로 복구됐고, 마지막 이미지 평면과 부모 목록의 위치 차이는 `2.3e-13px` 이하였다. 건너뛰기 종료 후 1초 기다려도 진행률은 약 0.93에 머물렀고, 사용자 스크롤 입력 후에만 모니터 구간으로 진행했다. [배포 대조·재검증 원본](performance/continuity-deployment-check.json)에 기록했다. 이번 재검증에서는 실행 코드를 추가로 변경하지 않았다.

이미 열려 있던 문서는 `#wiki`처럼 해시 경로만 이동할 때 새 JavaScript를 받지 않는다. [문서를 새로 요청하는 확인 주소](https://leedonghyun00.github.io/CAwiki/?revision=b943422#wiki)로 수정본을 확인할 수 있다. 이것을 사용자 제보의 원인이 캐시였다는 증거로 해석하지 않는다.
