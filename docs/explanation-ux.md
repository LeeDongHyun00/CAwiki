# 설명 UI/UX 개선 보고서 — 가독성·이해도·애플풍

작성일 2026-08-27 · 방법: 4각도 병렬 리서치(정보 제시·텍스트 가독성·다이어그램+텍스트 통합·
애플 디자인) + 각 조사 출처 실재성 적대적 검증 + 종합. 핵심 이론은 작성자가 웹으로 재확인.

> **범위** — *제안* 문서다. 실제 구현은 별도 결정. 대상: 아키텍처 페이지(화면 A —
> `scenarios/*.js`·`lib/scenario.js`·`lib/player.js`·`assets/style.css`)와 실리콘 지도
> (화면 B — `lib/home.js`). 앞선 [제목](title-naming.md)·[위키 UX](wiki-ux.md) 보고서와 같은 방식.

---

## 먼저 — 이미 잘하고 있는 것 (건드리지 말 것)

리서치가 공통으로 확인한 강점이다. 개선하다 이걸 깨면 손해다.

- **점진적 공개가 교과서적이다.** 스텝 제목은 늘 보이고 현재 스텝 본문만 펼쳐진다
  (`style.css` `.st-body`는 `.cur`만 표시). NNG는 공개 단계를 2단계 이하로 두라는데 이건 딱 1단계.
- **현위치 제시(you-are-here)가 충족돼 있다.** 항상 보이는 목차 + 진행바 + 카운터가 '전체
  시퀀스 + 현재 위치'를 동시에 준다(NNG 권장).
- **의미 있는 모션이다.** 카메라 줌·데이터 펄스는 스텝마다 다이어그램 상태를 실제로 바꾼다 —
  장식 애니메이션이 아니라 '의미 있는 전환'(The Pudding 페이싱 원칙에 부합).
- **맥락 누적.** `player.js`의 `accumulate=true`가 지나온 부품을 trail로 남겨 경로를 시각적으로 잇는다.
- **신호(signaling)를 이미 쓴다.** `<b>`=부품명, `<code>`=값/신호. Mayer의 signaling 원리에 부합.
- **모노크롬 + 구리 액센트 + 시스템 폰트**는 애플 방향(HIG Clarity/Deference)과 이미 맞다.

---

## 진단 — 진짜 약점은 '스텝 사이'가 아니라 '스텝 내부'

1. **밀도 높은 단일 문단.** 32개 스텝 본문이 각각 227~407자의 한 문단이고 `<br>`·리스트가
   전혀 없다. 밀집 문단은 작업기억을 과부하시킨다(인지부하 이론). **이 프로젝트 개선의 1순위.**
2. **좌(글)–우(그림) 분리 = 분산주의.** 글은 380px 패널, 그림은 무대로 열이 갈려 있다. Mayer의
   **공간적 근접성**(대응하는 글·그림을 가까이): 22/22 실험 지지, **효과크기 d≈1.10** — 멀티미디어
   원리 중 최상위급. 점등·줌·펄스가 부분 결속을 주지만, '현재 부품 옆 한 줄 캡션'이 가장 강한 레버.
3. **본문이 흐리고 대비 점프가 크다.** `.st-body`가 `--ink-soft`(흐림)라 본문 자체가 약하고,
   `<b>`에서 밝은 `--ink`로 급격히 튄다. 본문은 near-ink로 올리고 강조는 굵기로 처리하는 게 맞다.
4. **본문·`<code>`가 작다.** `.st-body` 0.84rem, `<code>` 0.8em. 기술 설명엔 ≥15~16px 권장.
5. **텍스트 용어와 도형이 색으로 안 이어진다.** 본문 `<b>`는 흰색 단색(`style.css:79`), 무대 점등은
   공통 구리 글로우 — '이 단어=저 도형'을 눈으로 잇는 참조 결속이 없다.
6. **전문용어가 즉석 정의 없이 등장.** 리셋 벡터·Cache-as-RAM·DMI·NVMe 등이 툴팁/정의 없이 나온다.

---

## 개선안 (우선순위 · 구현비용 · 근거)

### 🔴 높음

**1. 스텝 본문을 '리드 1줄 + 마이크로리스트(부품→역할→값)'로 재구성.** (비용 중간)
텍스트를 늘리지 말고 한 스텝 *안*을 쪼갠다. 예('전원 공급'):
리드 = "메인보드가 PSU를 깨워 CPU에 안정된 전기를 흘린다." →
점: `PSU: AC 220V → DC 12·5·3.3V` · `VRM: 12V → CPU용 ~1V` · `Power Good: CPU 리셋 해제`.
400자 문단이 스캔 가능한 4덩어리가 된다. → 근거: 청킹/인지부하, Mayer segmenting(자기속도 분절).
*구현*: 스텝 `body`를 `{lead, points[]}`로, `player.js`의 렌더를 `.st-lead`+`.st-points`로.

**2. 본문 부품명 ↔ 다이어그램 도형을 색·상호 강조로 연결.** (비용 낮음~중간)
본문 `<b>`에 `data-comp="psu"`를 붙여 그 부품의 도메인 색으로 칠하고, 무대 라벨과 같은 색으로 동시
점등. 본문 단어 호버 → 도형 강조, 도형 호버 → 단어 강조(양방향 지시). → 근거: signaling +
색 부호화 일치(Ozcelik 2009 아이트래킹). *인프라 이미 있음*: `stage.comps` 맵, home.js의 clickable 호버.

**3. 본문 가독성 기본기: 크기↑ · 대비 정리 · 접근성.** (비용 낮음)
`.st-body` 0.84→0.94~1rem, `<code>` 0.8→0.9em(축소 금지). 본문색을 near-ink로 올리고 `<b>`의 색
점프를 굵기 중심으로 완화. `<code>` 칩 대비를 WCAG 4.5:1 이상으로 점검. → 근거: 기술 텍스트 가독성,
WCAG 1.4.3/1.4.12.

### 🟠 중간

**4. 점등 부품 옆 '마이크로 캡션/값 콜아웃'.** (비용 중간, 효과 큼)
좌 패널 본문은 두되, 현재 스텝의 핵심 값(`<code>` 조각)만 무대의 해당 도형·배선 옆에 콜아웃으로도
띄운다. → 근거: **공간적 근접성 d≈1.10**(가장 강한 단일 레버). *인프라 있음*: `stage.trace(..,{label, at:[x,y]})`
콜아웃 기제를 스텝별로 켜고 끄면 됨.

**5. 애플식 타이포·여백: 3단 위계 토큰 + 8pt 그리드.** (비용 낮음~중간)
`--fs-lead`(1.06~1.25rem semibold) / `--fs-body`(0.95rem) / `--fs-caption`(0.8rem) 토큰화, 두 화면
공용. 여백을 4/8/12/16/24 증분으로 스냅. 리드는 letter-spacing −0.01em·600, 강조는 색 대신 굵기·밝기.
현재 스텝 카드는 '테두리' 대신 '살짝 밝은 배경 + 미세 그림자로 떠오름'. → 근거: HIG Typography/Layout,
애플 제품 페이지 패턴(큰 헤드라인 + 짧은 보조문).

### 🟡 낮음~중간

**6. 스텝 내부 2단 계층 + 용어 즉석 정의.** (비용 중간)
'왜/무엇(리드)'을 먼저, 값·주소(`0xFFFFFFF0`)·약어 같은 심화는 `.st-detail` 또는 접이식 '자세히'로.
첫 등장 용어에 점선 밑줄 + 1줄 툴팁. → 근거: NNG 점진적 공개(총 2단계 이하 유지).

**7. 모션 절제 + Reduce Motion 전면 대응.** (비용 낮음)
'전체 경로 복기'의 6개 동시 펄스를 순차·저속·소수로. 팬 상시 회전은 그 부품이 주인공일 때만.
`prefers-reduced-motion`에서 리빌 줌·펄스·bob을 즉시 스냅/크로스페이드로. → 근거: Mayer coherence,
Tversky et al. 2002(애니메이션은 합치·파악될 때만 도움), HIG Motion.

**8. 화면 A에 도메인 색 범례.** (비용 낮음)
화면 B 투어는 도메인별로 돌아 사실상 범례지만, 화면 A엔 없다. 패널 하단 또는 무대 모서리에 작은
색 점+이름 범례(또는 현재 스텝에 쓰인 색만). → 근거: 색 부호화가 작동하려면 키가 필요.

---

## 하지 말 것

- **강조 남용.** `<b>`+`<code>`를 스텝당 핵심 1~2개로 제한하고 부품명은 첫 등장만 굵게. '전체 경로
  복기'처럼 거의 전체가 `<b>`인 스텝은 정리(신호가 많으면 신호가 아니다).
- **Liquid Glass/블러를 다크 기술 텍스트 뒤에 남용** — 배경 대비를 떨어뜨린다. 재질은 카드·패널에만,
  텍스트 대비는 반드시 확보(WCAG).
- **점진적 공개를 3단계 이상으로** 늘리지 말 것(NNG: 길을 잃는다). 현재 1단계 + '자세히' 1단계까지만.
- **도메인 6색을 UI 크롬(버튼·필터 등)으로 확산** 금지 — 다이어그램 전용을 유지해야 색이 '의미'로 남는다.
- **측정(measure)만 손대기** — 한국어는 전각이라 줄당 ~25자가 정상. 라인 길이는 부차 지표, 큰 레버는
  청킹·여백·근접성이다.

---

## 남은 확인거리

- 개선 1·4는 스텝 데이터 스키마(`body` → `{lead, points, detail}`)와 렌더러(`player.js`) 변경이
  필요 — 32개 스텝 본문 리라이트가 따르는 중간 규모 작업. 한 시나리오(예: 부팅)로 시범 후 확대 권장.
- 개선 2의 색 연결은 '가독성(대비)'과 '색 부호화'가 충돌하지 않는지(도메인 색이 본문에서 충분한
  대비인지) 실측 필요.
- 🔴 3(가독성 기본기)·🟡 5(타이포 토큰)·🟡 7(모션/Reduce Motion)은 데이터 구조를 안 건드리고
  CSS 위주라 **저비용·저위험** — 원하면 먼저 적용 가능.

---

## 출처 (검증 통과분)

- **Mayer, "Principles for Reducing Extraneous Processing in Multimedia Learning"**(Cambridge Handbook
  of Multimedia Learning, Ch.12) — 공간적 근접성 22/22·**d≈1.10**, signaling 24/28·d=0.41,
  redundancy 10/10·d=0.69 — [cambridge.org](https://www.cambridge.org/core/books/abs/cambridge-handbook-of-multimedia-learning/principles-for-reducing-extraneous-processing-in-multimedia-learning-coherence-signaling-redundancy-spatial-contiguity-and-temporal-contiguity-principles/CD5B7AE1279A9AB81F8EEBB53DBEC86E)
- **Chandler & Sweller (1992), *BJEP* 62:233–246** — 분산주의 효과(split-attention)
- **Ozcelik et al. (2009), *Computers & Education* 53(2)** — 색 부호화 아이트래킹
- **Tversky, Morrison & Bétrancourt (2002)** — 애니메이션은 합치·파악될 때만 도움
- **NNG** — [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) ·
  [You Are Here](https://www.nngroup.com/articles/navigation-you-are-here/) ·
  [F-Shaped Reading](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/)
- **The Pudding** — [Responsive Scrollytelling Best Practices](https://pudding.cool/process/responsive-scrollytelling/)
- **Bartosz Ciechanowski** — [ciechanow.ski](https://ciechanow.ski/) (다이어그램 옆 짧은 문단, 절제의 모범)
- **Apple HIG** — [Typography](https://developer.apple.com/design/human-interface-guidelines/typography) ·
  [Layout](https://developer.apple.com/design/human-interface-guidelines/layout) ·
  [Motion](https://developer.apple.com/design/human-interface-guidelines/motion) · WWDC25 세션 356
- **WCAG 2.1** — [1.4.3 대비](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html), 1.4.12 텍스트 간격

> 검증에서 **완화**: '한국어 한 줄 25~30자 적정'은 실무 휴리스틱(인용된 KCI 논문의 수치가 아님) —
> 하드 근거가 아니라 방향 참고로만. 종합·보고서는 작성자가 8개 완료 에이전트(리서치 4+검증 4)의
> 저널을 직접 읽고 핵심 이론을 웹 재확인해 작성.
