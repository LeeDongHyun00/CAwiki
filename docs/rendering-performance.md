# 메인 렌더링 최적화 설계·실험 기록

작성일: 2026-10-08. 기준: GitHub `main`의 `c1046be7709ae6c66d271cfbc2bcbdda367570d2`.
GitHub API로 원격 main과 로컬 HEAD가 같은 것을 확인했다. 기존 `origin/main` 추적 참조는 오래되어 분석 기준으로 사용하지 않았다.

초기 자산 전달 비용, 과도한 텍스처/RTT 할당, 전환 중 모델 생성이 주요 개선 지점이었다. 파일·자산 분리, 품질 예산, 자원 해제, 로딩·이미지 복구를 로컬 작업본에 구현했다. 시간 비교는 [반복 측정 결과](performance/comparison.md), 실제 동작 검증은 [기능 검사 기록](performance/functional.json)을 참조한다. 모바일 탭 새로고침 해결 여부는 실기기 검증이 남아 있다.

## 문제와 판단

사용자가 보고한 증상은 필름 → 마지막 모니터, 관계지도 진입의 정지와 모바일 시나리오 버벅임이다. 모바일은 단순 입력 지연을 넘어 페이지 새로고침/오류 화면이 발생한다고 확인했다.

메인 페이지는 README의 기존 SVG/WASM 홈과 다른 Three.js 앱이다. `index.html`의 거대한 `payload.modules`에 실제 런타임 코드가 들어 있었다. 따라서 `lib/stage.js`의 WASM 계산을 바꾸는 것은 이번 메인 화면의 병목을 직접 해결하지 않는다.

여기서 모니터의 **RTT(render-to-texture)** 는 실제로 있다. 보드 장면을 별도 WebGLRenderTarget에 렌더한 다음 모니터 표면에 합성한다. 네트워크 왕복 시간(round-trip time)과 구분해야 한다. 이번 측정은 로컬 서버이므로 운영 서버의 네트워크 RTT/TTFB 개선을 입증하지 않는다.

확인한 비용:

| 위치 | 기존 구현 | 문제 |
|---|---|---|
| index.html / 부트스트랩 | HTML 6,856,128바이트, 모듈 31개와 이미지 48개를 문자열/base64로 포함 | 사용하지 않는 자산까지 초기 다운로드·파싱; 파일 단위 캐시 불가 |
| study / cinema-models | 모바일 모니터 타깃 2251×1266, half-float, MSAA 2 | 마지막 장면의 픽셀 처리량·렌더 버퍼·첫 사용 비용 |
| collection / hero / models | 라벨·키보드 글자마다 큰 CanvasTexture, 최대 1024×6927 라벨 | 작은 표면에도 큰 CPU 캔버스 및 GPU 텍스처 할당 |
| relationship-stage | 여러 모델 동기 생성, 각 메시 draw call, 알파 버킷별 오프스크린 페이드 | 진입 시 긴 작업과 추가 렌더 타깃/패스 |
| scenario-film | 모든 기기에 같은 상세 지오메트리, 화면 텍스처 빈번 갱신, 방문한 extras 보관 | 모바일 작업량 증가와 탐색에 따른 자원 보유 |
| site.closeCollection | 초기 라우팅에서도 이전 홈 렌더러 재개 | 위키 직접 진입에도 불필요한 3D 생성 |

필름 컴퓨터만 약 5,185만 텍스처 픽셀(4바이트 환산 약 198MiB)을 가지고 있었다. **필름+마지막 모니터 장면 전체**는 약 393MiB다. 이 값은 고유 텍스처의 `width × height × 4` 합계이며 실제 프로세스 메모리/VRAM 측정값이 아니다. 밉맵, 렌더 타깃, 드라이버, 디코딩 이미지, 캔버스 사본 등을 포함하지 않는다. 모바일 메모리 압박의 유력한 원인이지만 OS의 탭 종료 로그 없이 새로고침 원인을 확정할 수는 없다.

## 구현한 구조

### 파일과 자산

- main의 인라인 모듈을 `lib/inside/*.js`, 이미지를 `assets/inside/`로 추출했다. `index.html`은 화면 셸·CSS·import map을 맡는다. 런타임 빌드 도구/프레임워크 추가는 없다.
- 자산은 URL로 참조하여 base64 JS 문자열을 없앴다. 브라우저가 필요한 파일을 개별 요청·캐시할 수 있다. 숨겨진 USB 스프라이트는 카드가 뷰포트 근처에 올 때 연결한다.
- fallback 이미지는 3D가 실패했을 때만 요청한다. 정상 시나리오에서 단계가 바뀔 때마다 대체 이미지를 요청하지 않는다.
- `tools/build_inside_manifest.py`가 파일 내용 해시를 URL 쿼리에 반영한다. JS/자산 변경 후 실행하고 생성된 `index.html`·`assets.js`를 함께 배포한다. 해시는 캐시 무효화용이며 호스팅의 Cache-Control을 변경하지 않는다.
- `relationship-room-study.html` 등 별도의 디자인 실험 HTML과 기존 SVG 페이지는 이번 변경 범위 밖이다. 실제 앱 수정은 추출된 모듈에서 한다.

### 그래픽 예산

`quality.js`에서 세션 시작 시 정책을 결정한다. 작은 화면/터치 기기는 기본 경량 설정이며 `?quality=low`, `?quality=high`, `?quality=still`로 재현할 수 있다. 화면 회전 때 모델 전체를 재생성하지 않는다.

| 항목 | 기본 데스크톱 | 경량/모바일 |
|---|---:|---:|
| 렌더 DPR 상한 | 1.5 | 1 |
| 절차적 일반 텍스처 최대 변 | 1024 | 512 |
| 라벨 텍스처 최대 변 | 256 | 128 |
| 모니터 RTT 최대 폭 | 1536 | 1024 |
| RTT MSAA 샘플 | 2 | 0 |
| 실시간 그림자 | 기본 해제, high에서 사용 | 해제 |
| 둥근 모서리·원통·마우스 분할 | 기존 상세도 | 낮은 분할 수 |
| 관계지도 오프스크린 페이드 | 제한된 크기로 유지 | 모델 페이드 추가 패스 생략 |

텍스처는 작은 캔버스에 원래 논리 좌표를 스케일해 그린다. 큰 캔버스를 만든 뒤 축소하는 방식이 아니므로 생성 순간의 할당도 줄어든다. 동일한 금속 질감은 공유한다. 기본 모드는 기존 바닥의 접촉 그림자를 유지한다. 모바일의 작은 글자/표면 무늬 선명도와 곡면 세밀함은 줄어든다. 학습용 DOM 텍스트와 시나리오 단계는 유지한다.

관계지도는 움직이는 그룹 내부의 정적 메시를 같은 재질별로 합친다. 그룹 단위 위치·회전과 부품 선택은 유지한다. 시나리오 키보드의 눌리는 키처럼 개별 메시를 조작하는 곳에 이 병합을 무조건 적용하지 않는다.

### 준비·전환·복구 UX

| 상태 | 화면 처리 | 코드 책임 |
|---|---|---|
| 초기 3D 준비 | 가벼운 상태 안내와 위키/이미지 모드 링크 | render-status / study |
| 모니터 첫 진입 | 직전 캔버스를 유지하고 준비 안내를 먼저 페인트한 뒤 RTT 생성·첫 렌더 | study.prepareMonitor |
| 관계지도 준비 | 이미지·설명·탐색 링크를 먼저 표시, 모델을 작업 단위로 생성 | RelationshipStage.enter |
| 시나리오 준비 | 준비 안내 후 extras 생성·셰이더 준비; 완료한 첫 장면 표시 | ScenarioFilm.enter |
| 준비 중 경로 변경 | 토큰으로 오래된 작업의 후속 표시 취소 | routeToken / 각 장면 token |
| WebGL 실패 | 이미지·설명으로 계속 탐색, 이미지 모드 링크 제공 | contextloss / render-status |
| 위키 직접 진입 | 3D 렌더러 생성하지 않음 | site / ensureStage |

상태 안내는 `role=status`, `aria-live=polite`, 캔버스의 `aria-busy`를 사용한다. 가짜 진행률이나 임의의 고정 대기 시간을 추가하지 않는다. 안내를 먼저 페인트하도록 두 번의 rAF를 넘긴 뒤 실제 생성 작업을 시작한다. 모델 단위 작업 사이에는 `setTimeout(0)`으로 이벤트 처리를 허용한다. 한 모델 내부의 긴 작업까지 완전히 없앤 것은 아니다.

모바일 위키 진입은 framebuffer `toDataURL()` 읽기와 3D 모델 복제 비행 대신 기존 카드 목적지를 바로 보여준다. 데스크톱의 비행 전환은 유지한다. `prefers-reduced-motion`도 존중한다.

시나리오의 사용이 끝난 extras·경로·복제 재질을 해제한다. 공유 컴퓨터와 모니터는 재사용한다. 동적 화면 텍스처의 밉맵 재생성을 끄고 모바일 모니터 페인트를 이동 중 최대 24Hz로 제한하되 최종 상태는 반드시 그린다.

취소·컨텍스트 복구를 함께 검증하는 과정에서 `Cannot read properties of undefined (reading 'isReady')`를 재현했다. Three r170의 `compileAsync()` 타이머가 재질 해제/컨텍스트 복구로 사라진 `currentProgram`을 확인하지 않는 문제였다. `prepare-programs.js`로 준비를 감싸 경로 토큰·컨텍스트 손실·프로그램 유효성을 확인하고 취소를 종료한다. 벤더 소스는 수정하지 않았다. 이 어댑터의 `renderer.properties/currentProgram` 접근은 r170에 결합되어 있으므로 Three 업그레이드 때 함께 검토한다. 이번 복구 테스트에서 확인한 오류이며, 사용자가 보고한 모바일 탭 재로드의 원인이라고 단정하지 않는다.

## 실험 순서와 기록

1. **baseline**: 원격 main과 동일한 커밋을 별도 `/tmp` 사본으로 보존하고 데스크톱/모바일 각 3회 측정.
2. **iteration-1**: 파일 분리, 일반 텍스처 상한, 모바일 지오메트리, 작업 분할, 관계지도 병합·로딩 적용. 관계지도 draw call은 감소했으나 키보드의 다수 라벨 메모리가 남았다. 데스크톱 준비 시간은 1회 관찰값 7,338ms로 기준 3회 중앙값 5,915ms보다 나빠졌다. 전체 셰이더 사전 준비를 초기 부트스트랩에 몰아넣는 접근은 채택하지 않았다.
3. **iteration-2**: 라벨 별도 예산, 금속 질감 공유, 기본 실시간 그림자 해제. 모바일 장면 텍스처 환산량 20.56MiB 확인. 준비 중 안내를 실제 전환 지점으로 옮기는 방향 결정.
4. **after**: 모니터 직전 안내 후 렌더, 불필요한 홈 재개 제거, 숨은 이미지·USB atlas 지연, 캐시 버전 URL까지 반영해 같은 환경에서 각 3회 측정.
5. 기능 검증: 위키 직접 진입의 불필요한 WebGL 생성이 테스트에서 드러나 수정. 16개 시나리오, 6개 관계지도, 저장 매체 분기, 경로 취소, 강제 컨텍스트 손실 및 이미지 모드 검증.
6. 최종 예외 경로 검증: 이미지 모드의 부품 직접 진입·부품 생성 실패의 대체 이미지를 보완하고, 비동기 셰이더 준비의 해제/복구 경쟁을 수정했다. 일반 경로도 데스크톱·모바일 각각 3회 재측정했다.

최종 기능 검사에서 16개 시나리오·6개 관계지도·저장 매체 분기·준비 취소·강제 컨텍스트 손실과 복구·이미지 모드·데스크톱 모니터/위키 비행·부품 생성 실패 복구가 통과했다. 같은 경로를 5회 왕복한 뒤 renderer.info는 매번 geometry 190개, texture 50개였다. 이 테스트에서 지속적인 자원 수 증가는 관측되지 않았으며 장시간 실기기 누수가 없다는 증명은 아니다. 기록은 [functional.json](performance/functional.json), 측정 소스 해시는 [source-manifest.json](performance/source-manifest.json)에 있다.

원본 수치: [초기 baseline](performance/baseline.json), [1차](performance/iteration-1.json), [2차](performance/iteration-2.json), [최종 코드의 최초 측정](performance/after.json).

마지막 검토에서 일부 longtask/rAF 관측값이 스냅샷 뒤에 도착하는 수집 문제를 발견했다. 측정기 v2는 두 번의 rAF, 다음 타이머, observer.takeRecords()까지 기다린다. **최종 시간 비교는 v2로 재측정한 [변경 전](performance/baseline-final.json)·[변경 후](performance/after-final.json)만 사용**한다. v1 기록은 실험 이력으로 보존한다. 자산 바이트/텍스처 차원과 앱 ready 시각은 수집 지연 문제와 별개다. 최종 집계는 [전후 비교표](performance/comparison.md)에 있다.

## 측정 방법과 해석 범위

- Python Playwright + 시스템 Chromium, 헤드리스, SwiftShader 소프트웨어 WebGL. CPU throttle=1.
- 데스크톱 1440×900 / DPR 1. 모바일 에뮬레이션 390×844 / DPR 3 / 터치. **에뮬레이션은 실제 휴대폰의 GPU·메모리 제한·Safari가 아니다.**
- gzip 정적 localhost 서버, `Cache-Control: no-store`, 새 페이지/컨텍스트. 동일 순서로 초기 장면 → 보드 92% → 모니터 → compute/network 관계지도 → game/save 시나리오.
- `PerformanceObserver`의 longtask, rAF 간격, LCP, `renderer.info`의 렌더 호출/삼각형·geometry/texture 개수, CDP JS heap/DOM 카운터, Resource Timing의 encoded bytes를 기록.
- `renderMs`는 JS가 렌더 명령을 제출하는 시간이다. 비동기 GPU 실행 시간과 동일하지 않다. draw call은 기록된 **개별 render 호출의 최댓값**이며 여러 패스의 프레임 합계가 아니다.
- rAF p95에는 정지 상태의 프레임도 들어간다. 표본이 적고 GPU 정지가 구간 경계를 넘을 수 있어 p95 하나를 FPS/부드러움 판정으로 쓰지 않는다. 원본에는 n·최댓값·50ms 초과 횟수·구간 실제 길이도 포함했다.
- LCP는 Canvas 3D의 준비 완료를 표현하지 못한다. `readyMs`는 앱이 첫 렌더 명령 제출 후 ready 상태에 도달한 시각이며 GPU의 화면 표시 완료 보장은 아니다.
- 이번 자동 동선에는 대표적인 사용자 입력 표본이 부족해 Event Timing 값으로 현장 INP를 주장하지 않는다. longtask blocking 합도 Lighthouse의 공식 TBT로 부르지 않는다.
- JS heap은 GPU/캔버스/디코딩 이미지 메모리를 제외한다. 텍스처 픽셀 환산값도 실제 VRAM 사용량으로 쓰지 않는다. 메모리 숫자는 서로 별개로 읽어야 한다.

재현:

```sh
python3 tools/build_inside_manifest.py
python3 tools/measure_rendering.py --root /path/to/baseline --out /tmp/baseline.json --runs 3
python3 tools/measure_rendering.py --out /tmp/after.json --runs 3
python3 tools/summarize_rendering.py /tmp/baseline.json /tmp/after.json --out /tmp/comparison.md
python3 tools/test_rendering.py
```

Playwright Python 패키지와 `/usr/bin/chromium`이 필요하다. 성능 측정끼리, 또는 기능 테스트와 성능 측정을 병렬 실행하지 않는다. 운영 코드를 수정하지 않고 측정 서버 응답에만 렌더 관측 훅을 넣는다.

## 다음 리팩토링과 출시 기준

이번 변경은 자산 크기·픽셀/모델 비용·작업 겹침을 먼저 줄이는 단계다. 남은 긴 프레임은 표에서 숨기지 않는다. 실제 기기의 부드러움과 새로고침 해결은 별도 확인이 필요하다.

1. iOS Safari 및 중저가 Android Chrome에서 동일 경로를 각 10회 왕복한다. 콜드/웜 로딩을 나누고 기종, OS, 브라우저, 전원/발열 상태를 함께 기록한다. context loss·탭 재로드·오류 화면 0회, 왕복 이후 메모리의 지속 증가가 없는지 확인한다.
2. DevTools/원격 Web Inspector에서 main thread·GPU/렌더러 프로세스·프레임 타임라인을 함께 본다. 전환 입력→안내 표시→첫 3D 프레임→입력 가능을 각각 마크한다. Web Vitals는 실제 사용자 p75 기준 LCP≤2.5s, INP≤200ms, CLS≤0.1을 별도로 수집한다.
3. 대상 모바일에서 이동 구간 프레임 p95≤33.3ms를 1차 예산으로 정한다. 60Hz 데스크톱은 p95≤16.7ms를 목표로 한다. 이 값은 이번 소프트웨어 렌더러에서 달성했다고 주장하는 값이 아니다.
4. 프로파일이 절차적 모델 생성/첫 GPU 업로드를 계속 가리키면, 전처리한 glTF/geometry 데이터와 LOD를 도입한다. 현재 장면과 다음 장면만 준비하고, 관계지도에서는 화면 안의 모델만 생성한다. Worker에는 순수 geometry/typed array 생성부터 옮기며 DOM/전체 Three 객체를 그대로 전송하지 않는다.
5. 동적 라벨·키보드 glyph atlas, 배경/정적 부품의 더 넓은 instancing을 검토한다. 움직이는 개별 메시 참조를 먼저 명시적으로 분리한 뒤 병합한다.
6. 이후 필요하면 renderer/env와 cinema computer/reveal의 소유권을 분리한다. 현재 첫 3D 관계지도 직접 진입도 공유 필름 장면을 준비하므로 아직 줄일 여지가 있다. 장면별 `prepare → activate → pause → dispose`와 용량이 제한된 캐시로 정리한다.
7. 정적 카드에도 288/576/1152px `srcset`을 만든다. 현재 redesign 이미지 23개는 각각 1152×864이며 모두 디코딩했을 때 RGBA 환산 약 87.3MiB다. lazy loading으로 초기 동시 요청은 줄었지만 실제 모바일 카드 크기에 맞는 이미지 선택은 별도 개선 여지다. 이는 앞의 WebGL 텍스처 환산량에 포함되지 않는다.

사용자 요청에 따라 리팩토링과 검증 기록을 main에 반영한다. 위 실기기 검증은 후속 과제로 남아 있으며, 모바일 새로고침 문제가 완전히 해결되었다는 판단은 실기기 결과로 확인해야 한다.
