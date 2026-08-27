# CAwiki 제작 가이드 (개발 핸드오프)

이 문서 하나로 **아키텍처 페이지 · 시나리오 · 하드웨어 컴포넌트를 만드는 법**과 전체 구조를
파악할 수 있다. 다른 채팅/세션에서 작업을 이어갈 때 이 문서를 먼저 읽으면 된다.
(설계 근거·개선 배경은 같은 폴더의 `title-naming.md` · `wiki-ux.md` · `explanation-ux.md` ·
`stack-decision.md` 참고.)

---

## 0. 한눈에 보는 구조

CAwiki는 **빌드 도구 없는 순수 ES 모듈** 웹사이트다. 일상 동작(부팅·게임·검색·파일 열기)이
하드웨어를 통과하는 '작동 순서'를 단계별 애니메이션으로 가르친다.

```
index.html            메인 — 실리콘 지도 (리빌 + 6영역 투어 → 위키)
wiki.html             아키텍처 도감 (카드 디렉터리, 다크/라이트 토글)
scenarios/<id>.html   아키텍처 페이지 셸 (4편: boot·game·search·storage)
scenarios/<id>.js       └ defineScenario({compose, steps})로 내용 정의

lib/
  components.js       하드웨어 컴포넌트 팩토리 (CPU·GPU·RAM·SSD·… → SVG)
  stage.js            SVG 무대: 카메라·배선(trace)·펄스(flow)·상태(lit/dim) 관리
  kernel.js           애니메이션 커널 추상화 (wasm / js 두 백엔드)
  cawiki.wasm         Rust로 빌드된 커널 (커밋됨, 런타임은 무빌드)
  player.js           스텝 플레이어: 입력 통제 + 스텝 렌더 + 교차 강조
  scenario.js         defineScenario() — 셸+무대+플레이어 조립
  home.js             메인(실리콘 지도) 조립 · 리빌 스크럽 · 투어
  wiki.js             위키 카드/필터/테마
  boot-notice.js      file://로 열었을 때 안내 (일반 스크립트)
wasm/src/lib.rs       커널 Rust 소스 (수정 시에만 필요)
assets/
  style.css           시나리오·실리콘 지도 공통 스타일 + 디자인 토큰
  wiki.css            위키 전용 (자체 완결형, 라이트/다크)
docs/                 이 가이드 + 설계 보고서들
serve.py              개발 서버 (no-cache)
```

**좌표계**: 모든 무대는 **1280×800 월드**(viewBox)를 쓴다. 뷰포트 비율에 맞춰 좌우/상하로
넓혀 레터박스 없이 채운다(`stage.evw/evh`). 컴포넌트·배선 좌표는 이 1280×800 기준으로 손으로 적는다.

---

## 1. 새 아키텍처(시나리오) 페이지 만들기

기존 `boot`을 예로, 새 시나리오 `foo`를 추가하는 전체 절차.

### ① 셸 HTML — `scenarios/foo.html`
기존 셸을 복사하고 스크립트 이름만 바꾼다.

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CAwiki</title>
  <link rel="stylesheet" href="../assets/style.css">
</head>
<body>
  <script src="../lib/boot-notice.js"></script>
  <script type="module" src="./foo.js"></script>
</body>
</html>
```
(제목·백링크·패널은 `defineScenario`가 런타임에 만든다. 셸은 거의 비어 있다.)

### ② 내용 — `scenarios/foo.js`
```js
import { defineScenario } from '../lib/scenario.js';
import { CPU, RAM, Node, C } from '../lib/components.js';

defineScenario({
  id: 'foo',
  title: '내가 던지는 질문형 제목',     // 페이지 h1 + 문서 제목. 카드 제목과 통일할 것
  tagline: '한 줄 소개 (패널 상단에 표시)',

  // 무대 조립: 컴포넌트 배치 + 배선. 좌표는 1280×800 기준.
  compose(stage) {
    stage.add('cpu', CPU(430, 240, { size: 150 }));
    stage.add('ram', RAM(470, 44, { h: 160, labelDy: -172 }));
    stage.add('x', Node(80, 300, 150, 84, { label: '무엇이든', sub: '범용 노드', color: C.net }));

    // 배선: SVG path d 문자열(월드 좌표). label/at은 선택.
    stage.trace('t_ram', 'M505,240 V204', { label: '메모리 버스', at: [560, 224] });
  },

  // 단계 목록: 스크롤/↑↓/클릭으로 한 스텝씩. 각 스텝이 무대 상태 + 설명.
  steps: [
    {
      title: '단계 제목',
      lead: '결론 한 문장 (밝고 굵게).',                 // ← 설명은 리드+포인트+디테일 구조
      points: [                                          //   (밀집 문단 금지, docs/explanation-ux.md)
        '<b data-comp="cpu">CPU</b>: 역할 → <code>값</code>',
        '<b data-comp="ram">RAM</b>: …',
      ],
      detail: '심화(값·약어)는 작고 차분하게 뒤로.',      // 선택
      focus: ['cpu', 'ram'],                             // 카메라가 이 컴포넌트들에 맞춰 줌
      lit: ['cpu'],                                      // 점등할 컴포넌트 (이전 스텝은 trail로 유지)
      traces: [{ id: 't_ram', color: C.memory }],        // 강조할 배선
      flows: [{ trace: 't_ram', color: C.memory, n: 2, speed: 0.5 }],  // 데이터 펄스
    },
    // …
  ],
});
```

### ③ 링크 등록 (다른 화면에서 이 시나리오로 오게)
- **위키 카드** — `lib/wiki.js`의 `ARCHES` 배열에 항목 추가:
  ```js
  { cat: 'boot-exec', title: '카드 제목', tag: '부제', hw: ['CPU','RAM'], href: './scenarios/foo.html' },
  ```
  `href`가 있으면 '공개' 카드(클릭 가능), 없으면 '준비 중'(디밍).
- **실리콘 지도 연동**(선택) — `lib/home.js`의 `ARCH_META`에 `foo: { href, title, no, acc }`를 넣으면
  부품 클릭·투어 캡션 링크가 이 시나리오를 가리킬 수 있다.

### ④ 검증
`serve.py`로 띄우고 `/scenarios/foo.html` 열기 → 스크롤로 전 스텝 진행, 콘솔 오류 0 확인.
(자세한 검증은 §6.)

---

## 2. 스텝(step) 데이터 레퍼런스

`player.js`의 `apply()`가 읽는 필드 전부. 모든 필드는 선택이며 없으면 안전한 기본값.

| 필드 | 타입 | 의미 |
|---|---|---|
| `title` | string | 스텝 목록에 늘 보이는 제목 |
| `lead` | string(HTML) | **결론 한 문장** (밝고 굵게). 설명의 최상단 |
| `points` | string[](HTML) | **부품 → 역할 → 값** 마이크로리스트 (구리 점) |
| `detail` | string(HTML) | 심화(값·주소·약어). 작고 차분하게 |
| `body` | string(HTML) | (레거시) lead/points/detail이 없을 때 쓰는 단일 문단. 하위호환용 |
| `focus` | string[] | 카메라가 맞출 컴포넌트 id들. 없으면 전체(1배) |
| `lit` | string[] | 점등할 컴포넌트 id들. 나머지는 dim |
| `dimOthers` | bool | 기본 true. false면 lit 외 컴포넌트를 어둡게 하지 않음 |
| `ms` | number | 카메라 전환 시간(기본 900) |
| `pad` / `maxS` | number | fit 여백(기본 90) / 최대 줌(기본 2.4) |
| `traces` | `{id, color}[]` | 강조(색 점등)할 배선 |
| `flows` | `{trace, color, n, speed, reverse, r}[]` | 배선을 따라 흐르는 데이터 펄스 |
| `run` | `(stage)=>{}` | 스텝 적용 후 실행할 커스텀 훅 (거의 안 씀) |

`accumulate`(defineScenario 옵션, 기본 true): 이전 스텝들의 `lit`을 `trail`로 남겨 지나온 경로를
옅게 유지한다.

**HTML 인라인 태그 관례**
- `<b>부품명</b>` — 부품·핵심어 강조. `<b data-comp="cpu">CPU</b>`로 쓰면 **본문↔다이어그램 연결**
  (호버 시 그 도형이 함께 강조, §5). `data-comp` 값은 `stage.add(id, …)`의 id.
- `<code>값</code>` — 값·신호·주소 (`12·5·3.3V`, `0xFFFFFFF0`).
- 강조는 스텝당 핵심 1~2개로 절제 (근거: `explanation-ux.md`).

---

## 3. Stage API (무대) 레퍼런스

`compose(stage)`와 `run(stage)`에서 쓰는 메서드. `createStage()`가 반환하는 객체.

| 메서드 | 시그니처 | 설명 |
|---|---|---|
| `add` | `add(id, comp)` | 컴포넌트를 무대에 등록. `comp`는 팩토리(§4)가 반환한 객체. id는 스텝의 focus/lit·`data-comp`에서 참조 |
| `trace` | `trace(id, d, {label, at, dashed, thin})` | 배선 추가. `d`=SVG path(월드 좌표), `at`=[x,y] 라벨 위치 |
| `zone` | `zone(x, y, w, h, label)` | 점선 영역 박스(예: '집 / 인터넷 / 데이터센터') |
| `setStates` | `setStates({lit, trail, dimOthers})` | 점등/잔광/디밍. 보통 player가 호출 |
| `emphTraces` | `emphTraces([{id, color}])` | 배선 색 점등 |
| `startFlow`/`stopFlows` | `startFlow(traceId, {color, n, speed, reverse, r})` | 배선 따라 펄스 흐름 시작/전체 정지 |
| `fit` | `fit(ids, {pad, maxS, ms})` | 컴포넌트들이 보이게 카메라 맞춤 (Promise) |
| `tweenTo` | `tweenTo(fx, fy, s, ms)` | 카메라를 좌표·배율로 이동 (Promise) |
| `scrubTo` | `scrubTo(t, camA, camB)` | 스크롤 연동 카메라 보간(실리콘 지도 리빌 전용) |
| `comps` / `traces` | Map | id→컴포넌트 / id→배선. 직접 조회 가능 |
| `svg` / `world` | SVGElement | 최상위 svg / 카메라가 변형하는 `<g id="world">` |
| `kernel` / `backend` | | 애니메이션 커널 + 'wasm'\|'js' |

배선 `d` 문자열은 **M/H/V/L/C** 명령을 쓴다(직선·수평·수직·베지어). 커널이 이 경로를 파싱해
펄스가 흐를 좌표를 계산한다. 예: `'M500,370 V430 H390 V470'`.

---

## 4. 하드웨어 컴포넌트 (팩토리) 레퍼런스

### 4.1 쓰는 법
모든 컴포넌트는 **팩토리 함수** `Comp(x, y, opts)`다. 좌상단 (x,y) 기준으로 SVG를 그려
`{ el, x, y, w, h, a(anchor) }` 객체를 반환한다.

```js
import { CPU, C } from '../lib/components.js';
const cpu = CPU(430, 240, { size: 150 });
stage.add('cpu', cpu);
cpu.a('R');   // 오른쪽 변 중앙 좌표 [x, y] — 배선 시작점 등에 사용
```
- `a(p)` 앵커: `'L'`(좌) `'R'`(우) `'T'`(상) `'B'`(하) `'C'`(중앙) → `[x, y]` 반환.
- `w`/`h`: 컴포넌트 크기. `focus`/`fit`이 이 박스를 쓴다.

### 4.2 컴포넌트 목록 (현재)
```
Node(x,y,w,h,{label,sub,color,dashed})   범용 상자 — 뭐든 표현. color는 C.* 도메인색
Board(x,y,w,h)                            메인보드 기판
CPU(x,y,{size,label,cores})               코어·캐시·IMC 다이
GPU(x,y,{w,h,label,vram,engine})          셰이더·VRAM·디스플레이 엔진
RAM(x,y,{h,sticks,label,labelDy})         DDR 스틱들
SSD(x,y,{w,detail,label})                 NVMe (detail:true면 컨트롤러·FTL·NAND 표시)
HDD(x,y,{label})                          플래터·헤드
Chipset(x,y,{label})   SPIFlash(x,y,{label})   PSU(x,y,{label})
Monitor(x,y,{w,h,label,dots})             화면(screen 사각형 노출 — 리빌에 사용)
Speaker · Webcam · Keyboard · Mouse · Router · NICChip · Fan · VRM · ServerRack
```
색 상수 `C = { compute:#7DA8F5, memory:#B08EF0, storage:#E0AC4E, io:#EF8AA3, net:#62C795,
power:#96A4B3, accent:#E09A5F }` — 도메인(연산/메모리/저장/입출력/네트워크/전원)별 색.
**도메인 색은 다이어그램 전용**이며 UI 크롬으로 확산하지 않는다.

### 4.3 새 컴포넌트 팩토리 추가
`el()`(SVG 생성 헬퍼)와 `base()`(공통 래퍼)를 쓴다.

```js
export function MyChip(x, y, { w = 60, h = 40, label = '내 칩', color = C.io } = {}) {
  const body = [
    el('rect', { x, y, width: w, height: h, rx: 8, fill: '#1D2733', stroke: color, 'stroke-width': 1.4 }),
    el('text', { x: x + w / 2, y: y + h / 2, text: '핵심', 'text-anchor': 'middle', 'font-size': 10, fill: color }),
  ];
  return base(x, y, w, h, body, label);   // base가 {el,x,y,w,h,a()} 반환 + 라벨(.clabel) 부착
}
```
- `el(tag, attrs, children)`: `text` 속성은 텍스트 노드로 들어간다. 색은 CSS 변수 대신 실제 헥스나
  `C.*`를 쓴다(SVG fill/stroke).
- `base(x,y,w,h, bodyNodes[], label, {labelDy})`: 몸통 그룹 + 하단 라벨. 반환 객체가 표준.
- 같은 부품이 **3개 이상 시나리오에 등장**할 때만 전용 팩토리로 승격. 일회성은 `Node()`로 충분.
- `components.js`가 600줄을 넘으면 도메인별 파일로 분할(현재 350줄대).

---

## 5. 본문 ↔ 다이어그램 연결 (교차 강조)

본문 부품명을 `<b data-comp="cpu">CPU</b>`로 쓰면:
- 그 용어에 **점선 밑줄**(가리킬 수 있음 표시)이 붙고,
- **호버/포커스 시 본문 용어와 다이어그램 도형이 함께 강조**된다(양방향).

`player.js`의 `wireCrossHighlight()`가 `data-comp`가 하나라도 있는 페이지에서만 배선하므로,
캡션형(home)엔 영향이 없다. CSS는 `assets/style.css`의 `b[data-comp]`·`.comp.xhi`.
`data-comp` 값은 반드시 `stage.add(id, …)`의 id와 일치해야 한다.

---

## 6. 실행 · 검증 · 함정

### 실행
```bash
cd CAwiki
python3 serve.py 4173      # no-cache 개발 서버
```
`start.command` 더블클릭도 동일(서버 기동 + 브라우저). **`index.html`을 그냥 더블클릭하면
안 됨** — ES 모듈이 `file://`에서 CORS로 차단된다(`boot-notice.js`가 안내 표시).

### ⚠️ 모듈 캐시 함정 (자주 겪음)
`python -m http.server`는 `Cache-Control`을 안 보내 브라우저가 `.js` 모듈을 캐시한다 → 파일을
고쳐도 반영 안 됨. **반드시 `serve.py`(no-cache)를 쓰거나** 강력 새로고침(`Cmd+Shift+R`).
`.claude/launch.json`은 이미 `serve.py`를 쓴다.

### 검증 관례
- 스텝 순회: `window.player.goTo(i, {instant:true})`로 전 스텝을 돌려 오류 0 확인.
  (전역 `window.player`·`window.stage` 노출됨.)
- 입력 통제: 휠 25회 폭주 → 정확히 1단계만 이동해야 함(관성 흡수). 스텝 전환 쿨다운 후 테스트.
- 스텝 개수는 `.st-title` 개수로 센다 — `.steplist li`는 `.st-points` 안의 `<li>`까지 세니 주의.
- 한국어 줄바꿈: 제목·본문은 `word-break: keep-all`(어절 단위) 유지.

### WASM 커널 (수정 시에만)
런타임은 `lib/cawiki.wasm`(커밋됨)만 있으면 되고 툴체인 불필요. 커널을 고칠 때:
```bash
rustup target add wasm32-unknown-unknown       # 최초 1회
cd wasm && cargo build --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/cawiki.wasm ../lib/cawiki.wasm
```
`?kernel=js`를 URL에 붙이면 순수 JS 백엔드로 강제 전환(비교·폴백). 로드 실패 시 자동 폴백.

---

## 7. 디자인 시스템 (요약)

- **색**: 거의 모노크롬 + 구리 액센트(`--accent #E09A5F`). 도메인 6색은 다이어그램 전용.
  다크 기본(시나리오·실리콘 지도), 위키만 라이트/다크 토글.
- **폰트**: 시스템 스택(맥=SF Pro / Apple SD 고딕). `--sans` / `--mono`.
- **설명 텍스트 위계**: `--fs-lead`(리드) > `--fs-body`(본문) > `--fs-caption`(디테일).
  본문색 `--ink-2`(near-ink), 강조는 색보다 굵기·밝기.
- **모션**: 목적 있는 애니메이션만(카메라 줌·데이터 펄스=상태 변화). `prefers-reduced-motion` 존중.

## 8. 미구현/후속 (참고)

`docs/explanation-ux.md`의 개선안 중 아직 안 한 것: ④ 점등 부품 옆 값 콜아웃(공간적 근접성),
⑦ Reduce Motion 전면 확장, ⑧ 화면 A 도메인 색 범례. `docs/wiki-ux.md`에도 후속 UX 항목이 있다.
