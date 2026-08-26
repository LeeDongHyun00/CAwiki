# CAwiki — 작동 순서로 배우는 컴퓨터 아키텍처

일상 동작(부팅, 게임, 검색, 파일 열기)이 하드웨어를 통과하는 경로를
**단계별 애니메이션**으로 보여주는 로컬 웹 프로젝트입니다.

## 실행

ES 모듈을 쓰므로 정적 서버가 필요합니다 (파일로 직접 열면 CORS로 막힙니다):

```bash
cd CAwiki
python3 -m http.server 4173
```

브라우저에서 <http://localhost:4173> 접속.

## 조작

- **스크롤 / ↑↓ / 스페이스 / 클릭 / 스와이프** — 어떤 입력이든 정확히 **한 단계**씩 진행
- 애니메이션이 끝날 때까지 입력이 잠기고, 트랙패드 관성은 쿨다운으로 흡수 → **단계 건너뛰기 불가**
- 왼쪽 목록 클릭으로 특정 단계로 점프, `Home`/`End`로 처음/끝 이동
- 목록 위에서의 스크롤은 목록 스크롤로 동작 (스테이지 위에서만 단계 이동)

## 구조

```
index.html            홈 — 아키텍처 목록
assets/style.css      공통 스타일 (다크 스테이지, 패널 UI, 컴포넌트 상태)
lib/
  components.js       하드웨어 컴포넌트 팩토리 (CPU, GPU, RAM, SSD, HDD, PSU,
                      Monitor, Keyboard, Mouse, Router, ServerRack, Node …)
  stage.js            카메라 트윈 · 트레이스(배선) · 플로우(데이터 펄스) · 상태 관리
  player.js           스텝 플레이어 — 입력 통제(잠금·쿨다운·누적 임계값)
  scenario.js         defineScenario() — 레이아웃+스테이지+플레이어 조립
scenarios/
  boot.html/.js       ARCH 01 부팅
  game.html/.js       ARCH 02 게임 입력→화면
  search.html/.js     ARCH 03 인터넷 검색
  storage.html/.js    ARCH 04 파일 읽기 경로
```

## 새 아키텍처 페이지 추가하기

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
