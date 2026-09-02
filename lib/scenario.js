/* ============================================================
   CAwiki — 시나리오 페이지 부트스트랩
   defineScenario({ title, tagline, compose, steps }) 하나로
   레이아웃 + 스테이지 + 플레이어를 조립한다.
   새 아키텍처 페이지는 이 함수만 호출하면 된다.
   ============================================================ */
import { createStageAsync } from './stage.js';
import { createPlayer } from './player.js';

export async function defineScenario({ id, title, tagline, compose, steps, accumulate = true }) {
  document.title = `${title} — CAwiki`;

  if (window.__cawikiBooted) window.__cawikiBooted();

  document.body.innerHTML = `
    <div class="layout">
      <aside class="panel">
        <div class="progress"><i></i></div>
        <div class="panel-head">
          <a class="back" href="../wiki.html">← 위키로 돌아가기</a>
          <h1>${title}</h1>
          <p class="tagline">${tagline}</p>
        </div>
        <div class="steps-scroll"><ol class="steplist"></ol></div>
        <div class="panel-foot">
          <span class="counter"></span>
          <span class="hint">${matchMedia('(pointer: coarse)').matches ? '스와이프 = 1단계' : '스크롤·↑↓ = 1단계'}</span>
          <div class="navbtns">
            <button class="btn-prev">← 이전</button>
            <button class="btn-next">다음 →</button>
          </div>
        </div>
      </aside>
      <main class="stagewrap">
        <svg role="img" aria-label="${title} 작동 순서 다이어그램"></svg>
        <span class="stage-lock">ANIMATING…</span>
        <span class="kernel-badge" title="애니메이션 커널 백엔드"></span>
      </main>
    </div>`;

  const svg = document.querySelector('.stagewrap svg');
  const stage = await createStageAsync(svg);
  compose(stage);

  // 어떤 커널로 도는지 화면에 표시 (?kernel=js 로 강제 폴백 가능)
  const badge = document.querySelector('.kernel-badge');
  if (badge) {
    badge.textContent = stage.backend === 'wasm' ? 'WASM' : 'JS';
    badge.classList.add(stage.backend === 'wasm' ? 'k-wasm' : 'k-js');
  }

  const ui = {
    list: document.querySelector('.steplist'),
    counter: document.querySelector('.counter'),
    progress: document.querySelector('.progress > i'),
    prevBtn: document.querySelector('.btn-prev'),
    nextBtn: document.querySelector('.btn-next'),
    lock: document.querySelector('.stage-lock'),
  };

  /* ── 세로 폰 카메라 정책 ──────────────────────────────────
     월드(1280×800, 가로 1.6)를 세로 폰(≈0.46)에 넣으면 viewBox가 세로로 늘어나
     '전체 보드' 스텝(focus:null)은 라벨 4.5px·펄스가 점 수준으로 쪼그라든다.
     세로에서는 (1) 포커스 스텝은 더 크게(maxS↑·pad↓),
     (2) 전체 보드 스텝은 정지샷 대신 '데이터가 흐르는 방향으로 카메라가 따라가는 팬'으로
         교체한다 — 경로의 왼쪽 묶음에 맞춘 뒤 오른쪽 묶음으로 흘러간다.
         stage.tweenTo를 기다리지 않고 띄우므로 입력 잠금이 없고, 다음 스텝의 fit이
         자연스럽게 이어받는다(kernel의 pendingResolvers 이월 설계 덕).
     가로/데스크톱은 원본 값으로 복원한다(회전 시 재적용). */
  const isNarrow = () => {
    const r = svg.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (r.width / r.height) < 1.15;
  };
  const allIds = () => [...stage.comps.keys()];
  const boxOf = (id) => { const c = stage.comps.get(id); return c ? { x: c.x, y: c.y, w: c.w, h: c.h } : null; };
  const byX = (ids) => ids.map((id) => [id, stage.comps.get(id)]).filter(([, c]) => c)
    .sort((a, b) => (a[1].x + a[1].w / 2) - (b[1].x + b[1].w / 2)).map(([id]) => id);
  const base = steps.map((st) => ({ focus: st.focus, maxS: st.maxS, pad: st.pad, run: st.run }));
  const PAN_PAD = 48, PAN_MAXS = 3.2, PAN_MS = 3600;
  function tuneSteps() {
    const p = isNarrow();
    document.body.classList.toggle('narrow-stage', p);
    steps.forEach((st, i) => {
      const b = base[i];
      st.focus = b.focus; st.maxS = b.maxS; st.pad = b.pad; st.run = b.run;
      if (!p) return;
      st.maxS = Math.max(b.maxS ?? 2.4, PAN_MAXS);
      st.pad = Math.min(b.pad ?? 90, PAN_PAD);
      if (b.focus && b.focus.length) return;                 // 포커스 스텝: 확대만
      // 경로 순서: 복기 스텝의 lit은 저자가 '서사 순서'(전원→…→화면)로 적었으므로 그대로 따르고,
      // lit이 없는 개요 스텝만 x좌표 순으로 훑는다(x정렬을 복기에 쓰면 boot처럼 역방향이 된다).
      const path = (st.lit && st.lit.length)
        ? [...new Set(st.lit)].filter((id) => stage.comps.has(id))
        : byX(allIds());
      if (path.length < 2) return;
      const k = Math.min(3, Math.max(1, Math.floor(path.length / 2)));
      const left = path.slice(0, k), right = path.slice(-2);
      st.focus = left;                                       // 먼저 왼쪽 끝에 맞춘다
      st.run = async (sg) => {
        if (b.run) await b.run(sg);
        const lb = left.map(boxOf).filter(Boolean), rb = right.map(boxOf).filter(Boolean);
        if (!lb.length || !rb.length) return;
        // 배율은 왼쪽 fit 값으로 고정한 '순수 팬' — 오른쪽 묶음을 통째로 fit하면
        // 배율이 절반으로 떨어져 글자가 다시 작아진다(측정: 3.08 → 1.46).
        const s = sg.kernel.camFit(lb, PAN_PAD, PAN_MAXS).s;
        const x0 = Math.min(...rb.map((b) => b.x)), x1 = Math.max(...rb.map((b) => b.x + b.w));
        const y0 = Math.min(...rb.map((b) => b.y)), y1 = Math.max(...rb.map((b) => b.y + b.h));
        sg.tweenTo((x0 + x1) / 2, (y0 + y1) / 2, s, PAN_MS); // 기다리지 않는다
      };
    });
  }
  tuneSteps();

  const player = createPlayer({ stage, steps, ui, accumulate });
  player.start();

  let wasNarrow = isNarrow(), rzT = null;
  window.addEventListener('resize', () => {
    clearTimeout(rzT);
    rzT = setTimeout(() => {
      const now = isNarrow();
      if (now === wasNarrow) return;
      wasNarrow = now;
      tuneSteps();
      player.start(Math.max(0, player.index), { instant: true });
    }, 220);
  });

  // 디버깅·테스트용 전역 노출
  window.stage = stage;
  window.player = player;
  window.steps = steps;   // 튜닝된 스텝(세로 폰 카메라 정책) 검증용
  return { stage, player };
}
