# Inside 사이트 검증

2026-10-08 · [사이트 미리보기](../../artifacts/inside-site.html) · [구현 안내](README.md)

## 실제 확인한 범위

Chromium + Playwright에서 새 기본 사이트와 독립 HTML을 검증했다.

메인 필름 변경은 `tests/motherboard-refinement.py`로 데스크톱 1200×850·모바일 390×844에서 확인했다. 모니터 전환 중 네 시점의 실제 화면 픽셀을 측정해, 화면 안의 부품과 전체 뷰포트에 보이는 부품이 모두 연속해서 축소되는지 검사했다. 메인보드와 GPU의 투영 영역이 겹치지 않으며, GPU 구간의 건너뛰기는 엔딩 이전인 진행률 0.93에서 멈춘다. INPUT / OUTPUT 전시 장면은 제거했고, 후면 I/O 포트에서 메인보드 전체 장면으로 바로 연결되는 것을 확인했다. 키보드·마우스는 마지막 모니터 장면에만 남겼다. [측정 결과](../../artifacts/motherboard-refinement/checks.json)

`tests/mouse-model.py`는 참고 사진에 맞춰 다시 만든 마우스와 갱신된 독립 HTML을 오프라인으로 연 상태에서 통과했다. 새 마우스의 분해·재조립 픽셀 비교, 회전, 게임 시나리오 사용 후 재생성, 모션 감소 설정에서 데스크톱·모바일 건너뛰기를 확인했다. 메인 필름의 엔딩·위키 이동과 모바일 전체 장면은 앞선 `tests/motherboard-film.py` 검증 기록이다.

시나리오는 `tests/scenario-film.py`로 네 편의 실제 렌더링 24개 장면, SSD·HDD·메모리 캐시 분기, 연속 스크롤·드래그·되감기, 상세 설명·컬렉션·부품 보기에서의 정확한 위치 복귀를 검사한다. 시나리오 종료 후 메인 필름의 복원 화면과 새로고침한 화면, WebGL 컨텍스트 손실·복구 전후 화면을 픽셀로 비교한다.

해당 검사들을 통과했다. 모바일 390×844에서는 독립 HTML을 오프라인으로 전환한 뒤 네 편의 터치 단계 이동·모션 감소·가로 넘침 여부를 확인했다. WebGL을 끈 상태에서도 장면 이미지·설명·단계 이동·다시 보기가 동작했다. 모바일 캡처의 마우스, 펌웨어 확대, 서버 랙과 모니터 엔딩 구도도 직접 확인했다.

상황별 표지 변경 후에는 네 이미지의 기본·호버·원상 복귀·키보드 포커스 화면을 픽셀로 비교했다. 호버와 키보드 포커스의 최종 이미지는 같고, 벗어난 뒤 원래 이미지로 돌아왔다. 위키·시나리오 목록 양쪽의 SVG ID가 중복되지 않으며, 모션 감소·모바일 첫 탭 진입·오프라인 표지도 확인했다. 네 편의 24개 장면 제목·본문과 상세 설명에 문장 끝 마침표가 남지 않았는지 검사했다. 해당 UI 변경은 일회성 Playwright 검사로 검증했다.

- **23종 전체**: 실제 WebGL 렌더링, 조립·분해 상태, 두 이미지의 픽셀 차이, 모델별 구성 요소 확인. 페이지 예외 없음.
- **메인 필름**: CPU·GPU 외 부품을 메인 스크롤에 연결했다. 14개 장면의 렌더링, 12개 부품 장면의 조립·분해 픽셀 차이, 역방향 스크롤, 메인보드 전체의 분리·결합을 확인했다. 모니터 전환 시작 전후의 픽셀을 비교해 카메라·밝기의 연결을 검사했다.
- **모니터 엔딩**: 데스크톱·세로·울트라와이드 투영, 창 크기 변경, 실제 터치 스크롤과 버튼 탭, 렌더 타깃의 WebGL 손실·복구를 확인했다. 복구 전후 이미지의 픽셀 차이는 0이었다.
- **위키 진입**: `Computer Wiki →`로 별도 `#wiki` 메인 페이지에 진입하고 23개 하드웨어·4개 시나리오를 탐색한다.
- **컬렉션**: 23개 표시, 분류별 필터, 한국어 검색, 선택, 닫기·Escape, 분해 상태 보존, 브라우저 뒤로 가기.
- **개별 모델**: 마우스 드래그 회전, 휠 확대, 키보드 이동, 분해·재조립·초기화. 대체 이미지가 포인터를 가리지 않는지 확인.
- **4개 시나리오 / 총 24개 장면**: 단계 이동, 관련 모델, 신호와 문장, 각기 다른 모니터 결과, 다시 보기. 파일 열기의 HDD 대체 경로와 저장장치를 건너뛰는 4개 장면의 메모리 캐시 경로.
- **모션**: 분해 보간, 포인터 회전, 장면 카메라 이동. 시나리오 스크롤을 되감으면 카메라·부품·신호가 동일한 상태로 복원된다. 상세 설명·컬렉션은 진행을 멈추고 닫으면 같은 위치로 돌아간다. 정지 상태에서는 프레임 요청이 끝난다.
- **모바일 에뮬레이션 390×844**: 부품·컬렉션·시나리오 화면, 세로 시나리오 배치, 가로 넘침 없음. 터치 회전과 확대 확인.
- **WebGL 손실·복구**: 이미지 전환, 손실 중 다른 부품 선택, 복구 후 새로 선택한 모델 재생성.
- **WebGL 비활성화**: 대체 이미지, 전체 컬렉션, 부품 이동, 시나리오 단계 이동 사용 가능. 실행할 수 없는 3D 조작만 비활성화.
- **독립 HTML**: 문서를 연 뒤 네트워크를 오프라인으로 전환해 모델·컬렉션·시나리오 사용. HTML 문서 외 외부 요청 없음.
- JavaScript 구문, Python 스크립트 구문, 문서 상대 링크, 변경 파일 공백 검사.

## 재현

서버를 실행한 뒤:

```bash
python3 tests/redesign-site.py
python3 tests/motherboard-film.py
python3 tests/motherboard-devices.py
python3 tests/motherboard-refinement.py
python3 tests/mouse-model.py
python3 tests/scenario-film.py
```

기본 사이트의 검색·상태·3D 조작·시나리오·모바일·WebGL 대체 동작을 검사한다. Playwright와 Chromium이 필요하다. `CAWIKI_CHROMIUM`으로 브라우저 실행 파일, `CAWIKI_TEST_URL`로 검증할 주소를 지정할 수 있다.

```bash
python3 tools/render-redesign-models.py
python3 tools/build-redesign-preview.py
CAWIKI_TEST_URL=http://127.0.0.1:4173/artifacts/inside-site.html python3 tests/redesign-site.py
```

첫 명령은 23개 모델을 렌더링해 WebP 썸네일과 조립·분해 캡처를 만든다. Pillow도 필요하다. 두 번째 명령은 코드·이미지가 포함된 독립 HTML을 만든다.

`python3 tools/render-redesign-models.py mouse`처럼 부품 ID를 지정하면 해당 모델의 썸네일만 갱신한다.

## 한계

검증 브라우저는 소프트웨어 WebGL을 사용했다. 실제 GPU·휴대전화·Safari의 프레임 속도나 발열을 실측한 결과는 아니다. 검증 환경의 브라우저 정책이 `file://` 진입을 차단하므로 독립 HTML은 HTTP로 연 후 오프라인으로 전환해 확인했다.

부품 내부 형상과 연결은 교육용 재구성이다. 제조사 CAD, 실제 회로 배치, 물리적 배선 위치를 재현한 것은 아니다. 시나리오는 단계별 핵심 동작으로 축약했다.

## 사이트 화면

[메인](../../artifacts/redesign-site/site-home.png) · [전체 컬렉션](../../artifacts/redesign-site/site-collection.png) · [HDD 분해](../../artifacts/redesign-site/site-hdd.png)

[부팅](../../artifacts/redesign-site/site-story-boot.png) · [게임](../../artifacts/redesign-site/site-story-game.png) · [검색](../../artifacts/redesign-site/site-story-search.png) · [파일 읽기](../../artifacts/redesign-site/site-story-storage.png)

[모바일 컬렉션](../../artifacts/redesign-site/site-mobile-collection.png) · [모바일 PSU](../../artifacts/redesign-site/site-mobile-power.png) · [모바일 시나리오](../../artifacts/redesign-site/site-mobile-story.png)

## 메인보드 필름 화면

[DDR5](../../artifacts/motherboard-film/dram.png) · [타워 쿨러](../../artifacts/motherboard-film/cooling.png) · [메인보드 전체 분해](../../artifacts/motherboard-film/board-exploded.png) · [메인보드 결합](../../artifacts/motherboard-film/system.png) · [모니터 엔딩](../../artifacts/motherboard-film/screen.png) · [Computer Wiki](../../artifacts/motherboard-film/wiki.png)

[새 마우스](../../artifacts/motherboard-refinement/mouse.png) · [마우스 분해](../../artifacts/motherboard-refinement/mouse-exploded.png) · [GPU 하단 배치](../../artifacts/motherboard-refinement/desktop-system.png) · [모바일 건너뛰기](../../artifacts/motherboard-refinement/mobile-skip.png)

## 참고 사진을 반영한 마우스와 스크롤 시나리오

[마우스 외장](../../artifacts/redesign-site/mouse.png) · [마우스 내부](../../artifacts/redesign-site/mouse-structure.png)

[부팅 — 메모리 초기화](../../artifacts/scenario-production/boot-3.png) · [게임 — CPU와 RAM](../../artifacts/scenario-production/game-2.png) · [검색 — 서버](../../artifacts/scenario-production/search-3.png) · [파일 — 열린 이미지](../../artifacts/scenario-production/storage-5.png) · [HDD 경로](../../artifacts/scenario-production/storage-hdd.png)

[모바일 마우스](../../artifacts/scenario-production/mobile-game-0.png) · [모바일 펌웨어](../../artifacts/scenario-production/mobile-boot-2.png) · [모바일 서버](../../artifacts/scenario-production/mobile-search-3.png) · [모바일 결과](../../artifacts/scenario-production/mobile-storage-5.png)

## 상황별 시나리오 표지

[목록](../../artifacts/scenario-covers/overview-before.png) · [전원 켜기](../../artifacts/scenario-covers/boot-after.png) · [게임 클릭](../../artifacts/scenario-covers/game-after.png) · [검색 결과](../../artifacts/scenario-covers/search-after.png) · [파일 열기](../../artifacts/scenario-covers/storage-after.png)

## 관계지도 검증 — 2026-10-08

- `node tests/relationship-data.mjs`: 원본 115개 관계와 방향 보존, 하드웨어 23종·관계 124개, 여섯 묶음의 전체 부품 포함, 16개 주제·64단계의 참조 무결성 통과
- `python3 tests/relationship-map.py`: 검색 우선순위·필터·양쪽 관점 설명·중심 이동·뒤로 가기·모든 단계 접근·키보드·모바일 터치·모션 감소·WebGL 미지원·독립 HTML 오프라인 검증 통과
- `python3 tests/relationship-integration.py`: 실제 소프트웨어 WebGL에서 위키→관계지도→모델→뒤로 가기, 네 편의 필름과 상세 팝업 왕복, 모바일 조작 영역, 메인 필름 복귀, 단일 캔버스와 페이지 오류 없음 확인
- 모바일 관계 선택 시 설명 포커스·스크롤과 지도로 돌아가기, 단계 설명의 지도 앞 배치 확인

[전체 지도](../../artifacts/relationship-map/overview.png) · [CPU와 RAM](../../artifacts/relationship-map/cpu-ram.png) · [모바일 관계 설명](../../artifacts/relationship-map/mobile-relationship.png) · [모바일 시나리오](../../artifacts/relationship-map/mobile-save.png)

추가 시나리오는 단계별 관계지도이며 3D 필름은 기존 네 편이다 실제 기기와 Safari 성능은 별도 측정하지 않았다

## 시나리오 카드 통합 — 2026-10-08

`python3 tests/scenario-catalog.py`로 위키·전체 화면 목록의 16개 중복 없는 카드와 01–16 번호, 16개 SVG 상황 장면, 호버·키보드 포커스·복귀 상태, 추가 12편의 상세 연결, 이전 목록 주소 리다이렉트를 확인했다
모바일 배치·모션 감소·터치·독립 HTML의 모든 표지 오프라인 표시도 통과했다
`tests/relationship-map.py`와 `tests/relationship-integration.py`를 다시 실행해 관계지도 64단계와 기존 3D 화면 왕복을 확인했다

[통합 목록](../../artifacts/scenario-catalog/wiki-all-scenarios.png) · [음악 카드 호버](../../artifacts/scenario-catalog/music-hover.png) · [모바일 목록](../../artifacts/scenario-catalog/mobile-scenarios.png)


## 시나리오 썸네일 동작 — 2026-10-08

`python3 tests/scenario-actions.py`로 추가 12편의 동작 전·후, 개별 요소 변화, 포인터 이탈 후 복귀, 키보드 재실행과 같은 결과, 모션 감소 설정, 무한 애니메이션 없음, 기존 네 편의 결과 표시, 두 목록의 SVG ID·그라디언트 참조를 검사한다
`python3 tests/scenario-catalog.py`로 16편의 상세 링크·모바일·터치·독립 HTML을 검증한다

[05–10 동작 전·후](../../artifacts/scenario-actions/review-0.jpg) · [11–16 동작 전·후](../../artifacts/scenario-actions/review-6.jpg)


## USB 모델 썸네일 — 2026-10-08

`python3 tests/scenario-usb-cover.py`로 실제 렌더 자산 표시, 삽입 중 이탈·역방향·재진입, 완료 상태 유지, 키보드 포커스·모션 감소, 모바일 터치와 독립 HTML의 오프라인 렌더 표시를 검사했다
`python3 tests/scenario-catalog.py`로 전체 목록과 상세 주소 연결을 확인했다
시작·중간·결합 3D 렌더 및 실제 카드의 모바일 화면을 시각적으로 확인했다

[연결 전](../../artifacts/usb-cover/cover-before.png) · [삽입 중](../../artifacts/usb-cover/cover-inserting.png) · [결합](../../artifacts/usb-cover/cover-connected.png) · [모바일](../../artifacts/usb-cover/mobile.png)
