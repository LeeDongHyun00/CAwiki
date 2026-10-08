# CAwiki — 작동 순서로 배우는 컴퓨터 아키텍처

현재 기본 화면은 **Inside**입니다. 메인보드와 연결된 부품을 14개 스크롤 장면으로 탐색한 뒤, 모니터 밖으로 빠져나와 **Computer Wiki**로 진입합니다. 23종 하드웨어를 실제 3D로 회전·확대·분해하고,
부팅·게임·검색·파일 읽기의 4개 시나리오를 카메라 이동과 데이터 흐름으로 보여줍니다.
관계지도에서는 하드웨어 23종의 관계 124개와 16개 작동 원리를 총 64단계로 탐색합니다.

[완성된 사이트 미리보기](artifacts/inside-site.html) · [구현 안내](docs/redesign/README.md) · [검증 기록](docs/redesign/verification.md)

## 실행

### 가장 쉬운 방법

**`start.command` 를 더블클릭**하세요. 서버를 띄우고 브라우저를 자동으로 엽니다.
(포트 4173이 이미 쓰이고 있으면 그 서버를 재사용하거나 빈 포트를 찾습니다.)

### 터미널에서

```bash
cd CAwiki
python3 serve.py 4173      # 캐시 없이 제공 (파일 수정이 새로고침에 바로 반영됨)
```

브라우저에서 <http://localhost:4173> 접속.
(`serve.py` 대신 `python3 -m http.server 4173` 도 되지만, 그 경우 브라우저가
`.js` 모듈을 캐시해 수정이 바로 안 보일 수 있습니다 — 그럴 땐 강력 새로고침 `Cmd+Shift+R`.)

### ⚠️ index.html을 그냥 더블클릭하면 안 되는 이유

이 프로젝트는 ES 모듈(`<script type="module">`)을 씁니다. 브라우저는 `file://` 에서
모듈 로딩을 보안 정책(CORS)으로 차단하므로, 파일을 직접 열면 **스크립트가 아예 실행되지 않아
화면이 비어 보입니다.** 그래서 정적 서버가 필요합니다.

공유용 `artifacts/inside-site.html`에는 모듈과 이미지가 모두 포함되어 있습니다.
`python3 tools/build-redesign-preview.py`로 독립 미리보기를 다시 생성할 수 있습니다.

## 현재 사이트 조작

- 메인 필름: 스크롤·스와이프·마우스 드래그로 CPU부터 메인보드의 부품 조립, 모니터 줌아웃까지 이동. 끝의 `Computer Wiki →` 또는 우측 하단 링크로 위키 메인 페이지를 연다.
- 위키 메인: 하드웨어 23종·시나리오 16편·관계지도 선택, 필름 다시 보기.
- 관계지도: 여섯 기능 묶음, 부품 검색·관계 유형 필터, 양쪽 관점 설명과 중심 이동, 16개 주제의 단계별 작동 원리 탐색. 설계와 데이터 생성 방법은 [관계지도 안내](docs/redesign/relationship-map.md) 참고.
- 컬렉션: 23개 부품 검색·분류, `STORIES`에서 시나리오 선택.
- 부품: 드래그·한 손가락으로 회전, 휠·핀치로 확대, `구조 펼치기`로 분해. 이전·다음으로 부품 이동.
- 키보드: 좌우 화살표로 부품 이동, WASD로 회전, +/−로 확대, E로 분해, 0으로 시점 초기화.
- 시나리오: 스크롤·세로 드래그·스와이프로 사건을 진행하거나 되감는다. 아래 구간 표시로 단계 이동, 마지막에서 다시 보기. `원리 자세히`는 현재 위치를 유지한 채 열리고 닫힌다. 파일 열기는 SSD·HDD·메모리 캐시 경로를 비교한다.
- Escape로 컬렉션 열기·닫기. 동작 감소 설정과 WebGL 대체 이미지 지원.

브라우저 검증: 서버 실행 후 `python3 tests/redesign-site.py`, `python3 tests/motherboard-film.py` (Playwright와 Chromium 필요).

## 기존 SVG 구현

아래는 저장소에 남아 있는 SVG 기반 위키·시나리오 코드의 설명이다. 현재 기본 진입점은 위의 3D 사이트다.

### 기존 SVG 홈 (lib/home.js)

두 구간으로 나뉜다.

**[1] 리빌 — 스크롤 양에 실시간 연동**
첫 화면을 꽉 채운 "컴퓨터 한 대를 펼쳐 놓았습니다"는 사실 보드 위 **모니터의 화면**이다.
스크롤할수록 카메라가 뒤로 빠지며 베젤이 가장자리에서 드러나고, 문구는 모니터 크기만큼
작아지고, 모니터는 제자리로 물러나며 부품 전체가 나타난다. 문구는 그대로 화면 안에 남는다.
스크롤을 되감으면 그대로 되돌아간다. `↓`(아래 방향키)를 누르면 리빌이 한 번에 재생되며,
`건너뛰기` 버튼이나 `End`는 애니메이션 없이 즉시 통과한다.

**[2] 투어 — 아키텍처 페이지와 동일한 스텝 잠금**
리빌이 끝나면 입력 모델이 바뀐다. 스크롤 1회 = 1단계, 애니메이션 중 잠금.
6개 하드웨어 영역을 돌고 마지막에 아키텍처 4선 카드가 나온다.
0단계에서 위로 스크롤하면 리빌로 되돌아간다.

**아키텍처로 넘어가는 길 두 가지** — 색이 들어온 **부품을 클릭**하거나(모니터→게임,
SSD→파일 열기, NIC→검색, PSU→부팅 …), 마지막 단계의 **`아키텍처 위키로`** 버튼으로
아키텍처 도감(`wiki.html`)에 가서 종류별로 고른다.

### 아키텍처 도감 (wiki.html)

일상 동작 15편을 6개 카테고리(부팅과 실행 · 화면과 그래픽 · 저장과 파일 · 네트워크 ·
소리와 입력 · 전원과 지능)로 나눠 카드로 보여준다. 준비된 4편(부팅·게임·검색·파일 열기)은
카드 전체가 클릭되어 해당 아키텍처로 이동하고(호버 시 리프트+화살표), 아직 없는 편은
조용히 디밍된다. 상단 필터로 카테고리만 추려 볼 수 있다.

거의 모노크롬에 구리 액센트 하나만 쓰는 절제된 디자인이며, 우상단 버튼으로
**다크/라이트 테마를 전환**한다(선택은 localStorage에 저장, 첫 페인트 전 적용해 깜빡임 없음).
전용 스타일은 `assets/wiki.css`에 자체 완결형으로 담겨 있다.

카드 제목은 질문·손동작 앵커형으로("전원 버튼을 누르면, 안에서 무슨 일이?"), 근거는
`docs/title-naming.md`. UX 세부: 히어로에 '처음이라면 …부터' 시작 힌트, 준비 중 카드는
`aria-disabled`+화면 숨김 라벨로 접근성 보강, 연어 본 편은 우하단 '읽음' 표시(localStorage,
인정된 진행). 근거·나머지 개선안은 `docs/wiki-ux.md`.

### 아키텍처 페이지

- **스크롤 / ↑↓ / 스페이스 / 클릭 / 스와이프** — 어떤 입력이든 정확히 **한 단계**씩 진행
- 애니메이션이 끝날 때까지 입력이 잠기고, 트랙패드 관성은 쿨다운으로 흡수 → **단계 건너뛰기 불가**
- 왼쪽 목록 클릭으로 특정 단계로 점프, `Home`/`End`로 처음/끝 이동
- 목록 위에서의 스크롤은 목록 스크롤로 동작 (스테이지 위에서만 단계 이동)

## 구조

```
start.command         더블클릭 실행 — 서버 기동 + 브라우저 열기
serve.py              개발 서버 (no-cache 정적 제공)
index.html            Inside — 3D 메인·23개 부품·4개 시나리오
design/redesign/      3D 무대, 모델, 컬렉션, 시나리오 런타임
assets/models/redesign/  실제 모델로 렌더링한 23개 썸네일
artifacts/inside-site.html  독립 HTML 미리보기
wiki.html             아키텍처 도감 — 종류별로 나눈 카드 디렉터리
assets/style.css      공통 스타일 (다크 스테이지, 패널 UI, 컴포넌트 상태)
assets/wiki.css       아키텍처 도감 전용 스타일 (자체 완결형 다크)
lib/
  components.js       하드웨어 컴포넌트 팩토리 (CPU, GPU, RAM, SSD, HDD, PSU,
                      Monitor, Keyboard, Mouse, Router, ServerRack, Node …)
  stage.js            SVG DOM 구성 · 트레이스(배선) · 상태 관리 (계산은 커널에 위임)
  kernel.js           애니메이션 커널 추상화 — wasm / js 두 백엔드
  cawiki.wasm         Rust로 빌드된 애니메이션 커널 (커밋됨, 41.9KB)
  player.js           스텝 플레이어 — 입력 통제(잠금·쿨다운·누적 임계값)
  scenario.js         defineScenario() — 레이아웃+스테이지+플레이어 조립
  home.js             메인 페이지 — 실리콘 지도 조립 · 리빌 스크럽 · 투어 단계
  wiki.js             아키텍처 도감 — 카테고리·카드 렌더 · 필터 · 스크롤 리빌
  boot-notice.js      file:// 로 열었을 때 백지 대신 안내 (일반 스크립트)
wasm/                 커널 Rust 소스 (수정할 때만 필요, 런타임은 무빌드)
  src/lib.rs          path 파싱·베지어 평탄화·재샘플링·펄스·카메라
docs/
  AUTHORING.md        제작 가이드 — 아키텍처·시나리오·컴포넌트 만드는 법 (핸드오프)
  stack-decision.md   기술 스택 결정 보고서 + WASM 구현 부록
  title-naming.md     카드 제목 개선 보고서 (근거 기반)
  wiki-ux.md          위키 UX 개선 보고서 (근거 기반)
  explanation-ux.md   설명 UI/UX 개선 보고서 (가독성·이해도·애플풍, 근거 기반)
scenarios/
  boot.html/.js       ARCH 01 부팅
  game.html/.js       ARCH 02 게임 입력→화면
  search.html/.js     ARCH 03 인터넷 검색
  storage.html/.js    ARCH 04 파일 읽기 경로
```

## 애니메이션 커널 (WebAssembly)

매 프레임 애니메이션 수학(SVG path 파싱, 베지어 평탄화, 호길이 재샘플링, 펄스 전진,
카메라 이징)은 Rust로 작성해 WebAssembly로 컴파일한 `lib/cawiki.wasm`이 담당한다.
JS는 SVG DOM 속성 쓰기만 한다. 렌더러는 SVG 그대로라 벡터 선명도·한글 라벨·
접근성·CSS 상태 전환은 전부 유지된다.

메인 페이지의 리빌도 커널이 계산한다 — 스크롤 감쇠(`scrub_step`)와
두 카메라 상태 사이의 보간(`cam_scrub`)이 WASM에 있다. 배율은 **로그 공간**에서,
위치는 **역배율 공간**에서 보간해 줌아웃 속도가 지각적으로 일정하게 느껴진다.
두 백엔드는 같은 수학을 쓰므로 폴백해도 곡선이 동일하다(실측 차이 0).

- 화면 좌상단 배지가 현재 백엔드를 표시한다 (`WASM` / `JS`)
- `?kernel=js` 를 붙이면 순수 JS 백엔드로 강제 전환 — 나란히 비교할 때 쓴다
- `.wasm` 로드에 실패하면(파일 직접 열기 등) 자동으로 JS 백엔드로 폴백한다

**런타임에는 어떤 툴체인도 필요 없다** — `.wasm`이 커밋되어 있어 `python3 -m http.server`로
그대로 열린다. 커널을 **수정**할 때만 Rust가 필요하다:

```bash
rustup target add wasm32-unknown-unknown      # 최초 1회
cd wasm
cargo build --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/cawiki.wasm ../lib/cawiki.wasm
```

성능·정확도 실측치와 도입 판단 근거는 `docs/stack-decision.md` 부록 참고.

## 설명 텍스트 구조 (스텝)

스텝 설명은 밀집 문단 대신 **리드 + 마이크로리스트 + 디테일** 3단으로 쓴다(가독성·인지부하
근거는 `docs/explanation-ux.md`). 스텝 데이터에 `body` 문자열 대신 아래를 준다:

```js
{
  title: '전원 공급',
  lead: '메인보드가 <b>PSU</b>를 깨워 CPU에 안정된 전기를 흘립니다.',   // 결론 한 문장 (밝고 굵게)
  points: [                                                          // 부품 → 역할 → 값
    '<b>PSU</b>: AC 220V → DC <code>12·5·3.3V</code>',
    '<b>VRM</b>: 12V → CPU용 <code>~1V</code>',
  ],
  detail: '실패하면 비프음이나 진단 LED로 알립니다.',                  // 심화(값·약어), 작고 차분하게
  focus: [...], lit: [...], traces: [...], flows: [...],
}
```

`lead`/`points`/`detail`이 없으면 기존 `body` 문자열도 그대로 렌더된다(하위호환).
스타일 토큰: `--fs-lead`/`--fs-body`/`--fs-caption`, 본문색 `--ink-2`(near-ink).

**본문 ↔ 다이어그램 연결**: 본문의 부품명을 `<b data-comp="cpu">CPU</b>`처럼 부품 id와 이으면,
그 용어에 점선 밑줄이 붙고 **호버 시 본문 용어와 다이어그램 도형이 함께 강조**된다(양방향).
player가 `data-comp`가 있는 페이지에서만 배선하므로 캡션형(home)엔 영향이 없다. 근거는
`docs/explanation-ux.md`(Mayer signaling·색 부호화·공간적 근접성).

## 새 아키텍처 페이지 추가하기

> 전체 제작 가이드(시나리오·컴포넌트·Stage API·검증·함정)는 **`docs/AUTHORING.md`** 참고.
> 아래는 요약이다.


1. `scenarios/foo.html` 생성 — 기존 셸 복사 후 `src="./foo.js"`만 변경
2. `scenarios/foo.js` 작성:

```js
import { defineScenario } from '../lib/scenario.js';
import { CPU, RAM, Node, C } from '../lib/components.js';

defineScenario({
  id: 'foo',
  title: '제목',
  tagline: '한 줄 소개',

  compose(stage) {
    // 좌표는 1280×800 월드 기준. 컴포넌트를 자유롭게 배치한다.
    stage.add('cpu', CPU(430, 240, { size: 150 }));
    stage.add('ram', RAM(470, 44, { h: 160 }));
    stage.add('x', Node(80, 300, 150, 84, { label: '무엇이든', sub: '범용 노드', color: C.net }));
    // 배선: SVG path d 문자열. 라벨은 선택.
    stage.trace('t1', 'M505,240 V204', { label: '메모리 버스', at: [560, 224] });
  },

  steps: [
    {
      title: '단계 제목',
      body: '패널에 표시될 설명. <b>강조</b>와 <code>코드</code> 사용 가능.',
      focus: ['cpu', 'ram'],   // 카메라가 이 컴포넌트들에 맞춰 줌
      lit: ['cpu'],            // 점등할 컴포넌트 (이전 단계 것은 trail로 유지)
      traces: [{ id: 't1', color: C.memory }],           // 강조할 배선
      flows: [{ trace: 't1', color: C.memory, n: 2, speed: 0.5 }], // 데이터 펄스
      // reverse: true 로 역방향 흐름, maxS/pad 로 줌 한도/여백 조절
    },
  ],
});
```

3. `index.html`의 카드 목록에 링크 추가.

컴포넌트가 부족하면 `Node()`(범용 상자)로 시작하고,
자주 쓰이면 `lib/components.js`에 전용 팩토리를 추가하세요.

## 다음 아키텍처 후보

키보드 입력이 글자가 되기까지 · Ctrl+S 한 번의 여정 · 유튜브 스트리밍 ·
화상통화 · 멀티태스킹 · USB를 꽂는 순간 · 절전 모드와 복귀 ·
AI에게 질문할 때 · 게임 로딩 화면 · 화면 녹화

시나리오별 개념·하드웨어 목록은 `scenarios-and-hardware.md` 참고.

## 하드웨어 3D 스튜디오

메인 화면 오른쪽 위 **하드웨어 3D 스튜디오** 또는 `hardware-3d.html`에서
23종의 하드웨어 모델을 살펴볼 수 있습니다. 관계 지도에서는 선택한 부품을
**실물 3D로 살펴보기**로 바로 엽니다. `hardware-3d.html?hw=gpu`처럼 직접 연결할 수 있습니다.

- 드래그 / 한 손가락: 회전, 휠 / 두 손가락: 확대·축소
- 앞면·뒷면·측면·입체 시점, 초기화, 자동 회전, 와이어프레임
- 분해 슬라이더: CPU, GPU, RAM, SSD, HDD, 메인보드, 팬의 층별 구조
- 뷰어에 키보드 초점을 둔 뒤 방향키: 회전, `+` / `-`: 확대, `0`: 초기화
- **3D 모델 다운로드**: 조립 상태의 GLB 파일을 저장합니다. glTF 표준 미터 단위로 내보냅니다.
- WebGL을 사용할 수 없거나 연결이 끊기면 같은 모델의 정적 렌더 이미지로 전환합니다.

모델은 공개 사양·사진을 바탕으로 직접 만든 **학습용 재구성**입니다. 제조사 CAD나
스캔 모델이 아니며, 외형 치수는 출처를 기준으로 하지만 미세 형상·접점 수·내부 배치까지
제조 실물과 일치함을 보증하지 않습니다. 특정 제품을 참고한 모델과 일반 구조 모델을
각 모델 설명에서 구분합니다. 출처와 구현 범위는 [3D 모델 참고 자료](docs/hardware/3d-models.md)에 정리했습니다.

`lib/hardware-models.js`는 mm 단위 메시, `lib/hardware-catalog.js`는 제품 설명과 출처,
`lib/hardware-scene.js`는 조명·카메라, `lib/hardware-viewer.js`는 조작과 GLB 내보내기를 담당합니다.
Three.js 0.170.0과 필요한 애드온을 MIT 라이선스와 함께 `lib/vendor/three/`에 보관하여
런타임 CDN이나 npm 설치 없이 정적 서버만으로 실행합니다.

기존 메인·관계 지도·학습 시나리오는 같은 3D 메시에서 생성한 PNG 미리보기를 사용하며,
배선·카메라·단계 설명은 기존 SVG/WASM 구조를 유지합니다. 메인 화면의 시작 모니터는
화면 안 문구와 리빌 효과를 위해 기존 라이브 SVG 화면을 유지합니다.

미리보기 재생성 및 검증(Python Playwright, Pillow, Chromium이 설치된 개발 환경):

```bash
python3 serve.py 4173
# 별도 터미널
python3 tools/render-models.py
python3 tests/hardware-3d.py
```

## 지도 페이지 디자인 시안

메인 화면의 **새 지도 디자인** 또는 `map-design.html`에서 새로운 지도 디자인을
미리 볼 수 있습니다. 전체 지도에서 CPU·메모리·GPU·저장·네트워크·전원으로 이어지는
7단계에 실제 3D 모델과 카메라 전환, 역할 설명을 결합했습니다. 휠·방향키·부품 클릭으로
탐색하고, **직접 돌려보기**로 모델을 회전할 수 있습니다.

레이아웃과 모션 설계는 [지도 디자인 문서](docs/hardware/map-design.md)를 참고하세요.
브라우저 검증: `python3 tests/map-design.py`.
