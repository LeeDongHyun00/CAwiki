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


USB 스타일 통일 후 같은 두 검사를 다시 통과했다
공통 청록 배경·모니터, 연결 후 화면 내부의 USB 드라이브 표시, 모바일 구도와 인접 시나리오와의 색감을 확인했다
[인접 썸네일 비교](../../artifacts/scenario-actions/review-6.jpg)

## 05–16 시나리오 확장 설계와 저장 대표 시안 · 2026-10-08

`python3 tools/build-expansion-design.py`와 `python3 tests/scenario-expansion-design.py`로 설계용 독립 HTML을 확인했다
12편·72개 장면 탐색, 저장의 6단계, 실제 마우스 드래그, 키보드 끝 이동·재시작, 모달 정지·복귀, 모바일 구도, 모션 감소, 오프라인 초기화를 통과했다
동일 진행 위치의 정방향·역방향 캔버스 픽셀 차이는 0이며 페이지 JavaScript 오류는 없다

[결과 데이터](../../artifacts/scenario-expansion-design/verification.json)와 [설계·구현 범위](scenario-expansion-design.md)를 참조한다
기존 서비스 경로는 유지하며 추가 12편 전체의 프로덕션 필름 구현을 완료한 검증은 아니다
Chromium 소프트웨어 WebGL을 사용했으며 실제 모바일 GPU·Safari 성능은 미측정이다

## 05–16 실제 필름 구현과 설명 검토 · 2026-10-08

추가 12편을 각 7–9개, 총 94개 장면으로 구현했다
앞의 설계 시안 범위를 대체하며 기본 시나리오 16편 전체는 총 118개 장면이다
[검토한 설명과 근거](scenario-content-review.md), [12편 비교 화면](../../artifacts/scenario-extended/contact.jpg)을 함께 확인할 수 있다

- 94개 장면의 제목·본문·상세 설명, 7–9개 단계 이동, 참고 자료와 목록의 16개 실제 필름 연결 확인
- 저장·USB·스트리밍을 같은 진행값으로 되감았을 때 화면 차이 0.15 미만, 다른 진행값에서는 실제 화면 변화 확인
- 마우스 드래그·키보드 끝 이동·재시작, 상세 팝업의 스크롤 정지·위치와 포커스 복귀 확인
- 모든 새 시나리오의 모바일 중간·마지막 단계에서 가로 넘침과 본문/하단 조작 겹침 없음 확인
- 시나리오 마지막 설명을 닫고 다른 편으로 이동할 때 옛 진행값을 적용하던 비동기 모달 닫기 문제 수정
- 개념 도식의 화면 밖 잘림, 주변 카메라와 스피커/모니터 가림을 실제 캡처에서 찾아 수정
- 실제 터치 시작·이동·종료 이벤트로 345px 스크롤과 진행값 변화 확인, 오프라인에서 USB·AI·저장·녹화 모델과 단계 탐색 확인
- 추가 12편의 WebGL 미지원 대체 이미지·전체 마지막 단계·상세 설명, 예전 저장 시안 주소의 실제 페이지 연결 확인

`tests/scenario-extended.py`의 전체 장면·역방향·마우스·팝업·키보드·모바일 검증을 통과했다
최초 터치 검사는 Chromium의 `synthesizeScrollGesture`로 스크롤을 만들지 못해 실패했다
실제 `dispatchTouchEvent` 시작·이동·종료 이벤트로 검사 방식을 수정하고 해당 입력 경로를 별도로 실행해 통과를 확인했다
[배포 파일의 터치·오프라인·WebGL 대체 결과](../../artifacts/scenario-extended/packaged-verification.json)에 기록했다

다음 기존 검사도 이번 변경에 맞춰 실행해 통과했다

- `tests/scenario-film.py` — 기존 네 편 24개 기본 장면, SSD/HDD/캐시, 되감기·상세 설명·이동 후 복귀, 공용 무대와 WebGL 컨텍스트 복원, 모바일·오프라인·WebGL 대체 화면
- `tests/scenario-expansion-design.py` — 94개 스토리보드와 실제 저장 8개 장면으로 연결되는 시안 주소
- `tests/scenario-catalog.py` — 위키/전체 목록 16편, 표지 동작·키보드·모바일·오프라인·실제 필름 링크
- `tests/relationship-map.py` — 관계지도 탐색과 64개 단계, 16편의 필름 링크, 모바일·오프라인
- `tests/relationship-integration.py` — 위키·지도·모델·기존/추가 필름·상세 팝업 왕복, 단일 WebGL 캔버스와 메인 필름 복귀

Chromium의 소프트웨어 WebGL과 모바일 에뮬레이션에서 확인했다
실제 휴대전화의 GPU 성능과 Safari는 측정하지 않았다

GitHub Pages의 기존 `main` 루트 설정을 사용해 독립 HTML을 게시했다
Pages 설정 변경 API는 GitHub App 권한 부족으로 403을 반환하므로 기존 배포 설정을 유지했다
배포 파일만 `main`에 반영하고, 그 커밋을 `redesign`에 병합하면서 개발용 `index.html`을 유지해 PR 충돌을 해소했다

공개 주소의 인증 없는 HTTPS 응답 200과 배포 파일의 SHA-256 일치를 확인했다
공개 사이트에서 16개 목록, 저장 8개 장면, 마우스 드래그, 상세 원리와 근거 링크, 모바일, 저장 시안 주소 호환을 확인했다
[공개 검증 결과](../../artifacts/scenario-extended/public-verification.json) · [공개 저장 화면](../../artifacts/scenario-extended/public-save.png)
HTTPS 검증은 시스템 신뢰 저장소를 사용하는 Python으로 수행했으며, Chromium에서는 실행 환경 프록시의 인증서 처리 예외를 사용했다

## 부품 동작과 연속적인 모니터 결과 · 2026-10-08

[94개 장면 감사 및 연출 설계](scenario-spatial-motion.md)를 기준으로 설명판만 바뀌던 30개, 설명판과 전송선에 의존하던 44개 장면을 포함해 추가 12편 전체를 개선했다
부품의 실제 변환 좌표에 연결된 포인트, CPU 작업 교대, RAM 버퍼, SSD NAND 기록, GPU 프레임과 코덱, 스피커 내부 예시 회로가 드래그에 반응한다
작은 보조 도식은 네 장면에만 남기고 깊이 검사를 분리했다
모니터의 입력·창·저장·음악·영상·통화·멀티태스킹·USB·절전·AI·게임·녹화 결과는 각 장면 진행값과 함께 변한다
마지막 장면도 독립된 진행 구간을 사용하며 화면 텍스처 갱신에 마지막 구간에서 평평해지는 전체 이징 값을 사용하지 않는다

- `tests/scenario-spatial.py`: 94개 장면의 렌더와 단계 이동, 설명판을 숨긴 여덟 대표 장면의 실제 부품 변화·역방향 복원, 실제 필름의 12개 마지막 모니터 텍스처 변화·역방향 복원 확인
- 같은 검사에서 설명판 앞에 불투명 모델을 놓아도 설명판이 읽히는지, 모니터·스피커 앞의 상세 팝업, 대표 아홉 장면의 모바일 포인트·본문 배치, 메인 필름으로 돌아올 때 재질·덮개 복원 확인
- USB 연결 표시등과 절전 구간 경계의 연속적인 조명 변화 확인
- `tests/scenario-screen-motion.py`: 12개 결과 화면의 캔버스 변화와 같은 진행값의 정확한 재현, AI 응답·멀티태스킹의 마지막 장면 경계에서 화면 차이 0 확인
- `tests/scenario-spatial-package.py`: 최종 독립 HTML에서 실제 터치 스크롤, 오프라인 모델·단계 이동, 추가 12편의 WebGL 대체 화면과 상세 설명 확인
- `tests/scenario-film.py`: 기존 네 편의 24개 기본 장면, 저장장치 분기, 되감기·팝업·공용 무대 복원·모바일·오프라인·WebGL 대체 화면 재검증 통과
- JavaScript/Python 구문 검사와 Git 공백 검사 통과

[시각적 변화·복원 결과](../../artifacts/scenario-spatial/verification.json) · [모니터 결과 비교](../../artifacts/scenario-spatial/screens-contact.jpg) · [배포 파일 검증](../../artifacts/scenario-spatial/packaged-verification.json)
검증 환경은 Chromium 소프트웨어 WebGL과 모바일 에뮬레이션이며 실제 휴대전화 GPU 및 Safari 성능은 미측정이다

소스 `95dde2b`의 독립 HTML을 공개 Pages 커밋 `160a7eb`으로 게시하고 기존 PR에 반영했다
인증 없는 HTTPS 200, 버전 정보와 배포 HTML의 SHA-256 일치를 확인했다
공개 응답으로 부품 포인트·드래그·모니터 결과·모바일 스피커·상세 팝업·16개 목록을 검증했다
시스템 신뢰 저장소로 인증서를 검증하는 Python HTTPS 클라이언트가 받은 공개 응답을 Chromium 요청에 전달했으며 TLS 검증을 끄지 않았다
[공개 검증 결과](../../artifacts/scenario-spatial/public-verification.json) · [공개 멀티태스킹](../../artifacts/scenario-spatial/public-multitasking.png) · [공개 결과 화면](../../artifacts/scenario-spatial/public-streaming.png)

## 통화 픽토그램·출처가 보이는 프레임·절전 메뉴 · 2026-10-08

[연출 결정과 전체 적용 범위](scenario-frame-redesign.md)에 따라 통화 화면의 얼굴·입·손을 없애고 하나의 사람 픽토그램으로 바꿨다
GPU 관련 11개 장면에는 해당 시나리오의 실제 글자·풍경·픽토그램·게임·녹화 화면에서 가져온 조각을 사용한다
압축 데이터와 원본 이미지를 구분하며 AI 행렬 연산에는 영상 프레임을 표시하지 않는다
절전은 전원 메뉴에서 절전을 선택하고 화면이 꺼진 뒤 같은 작업으로 복귀한다

- `tests/scenario-frame-redesign.py`: 11개 GPU 장면의 이미지 변화·역방향 복원, 통화 픽토그램의 움직임·되감기, 절전 메뉴 선택·검은 화면·동일한 문서 위치 복귀 확인
- 같은 검사에서 10개 모바일 GPU/통화 화면과 절전 메뉴, 포인트 라벨의 화면 밖 잘림·상세 팝업 확인
- `tests/scenario-screen-motion.py`: 12개 모니터 결과의 변화·정확한 되감기와 기존 연속성 검사 통과
- `tests/scenario-spatial-package.py`: 독립 HTML의 터치·오프라인 모델·12개 WebGL 대체 화면 검사 통과
- `tests/scenario-spatial.py`의 `restore`, `layers`: 메인 무대 복원, 실제 불투명 모델 앞의 설명판과 상세 팝업 검사 통과
- JavaScript/Python 구문과 Git 공백 검사 통과

[프레임 검증 결과](../../artifacts/scenario-frame-redesign/verification.json) · [영상 프레임](../../artifacts/scenario-frame-redesign/streaming-5.png) · [절전 선택](../../artifacts/scenario-frame-redesign/sleep-select.png)
Chromium 소프트웨어 WebGL과 모바일 에뮬레이션에서 검증했으며 실제 기기 GPU와 Safari는 별도 측정하지 않았다

소스 `b4c5e2b`를 Pages 커밋 `76733e0`으로 공개했다
인증 없는 HTTPS 200, 버전과 배포 HTML의 SHA-256 일치를 확인했다
시스템 인증서 검증을 유지한 공개 응답으로 GPU 이미지·픽토그램·절전 메뉴·실제 드래그·모바일 압축 장면·상세 팝업을 확인했다
[공개 검증 기록](../../artifacts/scenario-frame-redesign/public-verification.json) · [공개 GPU 이미지](../../artifacts/scenario-frame-redesign/public-gpu-frame.png) · [공개 통화](../../artifacts/scenario-frame-redesign/public-call.png) · [공개 절전](../../artifacts/scenario-frame-redesign/public-sleep.png)

## 하드웨어 상세 화면의 단일 나가기 · 2026-10-08

공통 하드웨어 상세 화면의 이전·다음·시점 초기화·구조 펼치기·전체 보기·관계 보기 컨트롤을 제거하고 나가기 링크 하나를 남겼다
드래그 회전과 스크롤 확대는 유지하며 나가기와 Escape는 들어왔던 위키·관계지도·시나리오로 돌아간다
직접 상세 주소로 들어온 경우 위키로 나간다
`tests/relationship-integration.py`로 관계지도에서 모델을 열고 같은 관계로 복귀, 시나리오·상세 설명 왕복, 모바일 나가기 배치와 단일 WebGL 캔버스를 확인했다

`tests/redesign-site.py`의 목록·검색·회전·나가기·Escape·기존 시나리오·모바일·WebGL 대체 화면 검증도 통과했다


## 관계지도 공간 구현 — 2026-10-08

6개 관계 공간에 23개 실제 하드웨어 모델을 배치하고 부품명과 제목만 표시했다 배경 격자와 거미줄 연결망은 제거했다 공용 WebGL 렌더러를 재사용하며 부품의 방 위치에서 상세 위치까지 연속 전환한다 내부 구성 전체와 검색·유형 필터가 있는 124개 관계를 제공하고 원래 관계 시나리오 64단계를 보존했다

- `node tests/relationship-data.mjs`: 원본 관계 115개 포함 전체 124개·23개 노드·6개 방·64단계 보존
- `python3 tests/relationship-map.py`: 23개 역할과 모든 내부 구성·124개 양쪽 설명·6개 방의 이름/제목만 표시·1440/390/320px·검색/필터/빈 결과·예전 주소·키보드 복귀·16편의 64단계 통과
- `python3 tests/relationship-integration.py`: 실제 3D 방 6개, 캔버스 하나, 하드웨어 단일 나가기, 시나리오 팝업 왕복, 모바일과 메인 필름 재진입 통과
- `tests/relationship-portable.py`: 배포용 독립 HTML에서 실제 전환·빠른 경로 변경·WebGL 손실/복원·오프라인 내부 구성/관계 이동 통과
- JavaScript 구문 검사와 Git 공백 검사 통과

Chromium 소프트웨어 WebGL과 모바일 에뮬레이션으로 검사했다 실기기 GPU와 Safari의 프레임 성능은 측정하지 않았다
