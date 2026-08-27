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
          <span class="hint">스크롤·↑↓ = 1단계</span>
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

  const player = createPlayer({ stage, steps, ui, accumulate });
  player.start();

  // 디버깅·테스트용 전역 노출
  window.stage = stage;
  window.player = player;
  return { stage, player };
}
