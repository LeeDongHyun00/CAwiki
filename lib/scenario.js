/* ============================================================
   CAwiki — 시나리오 페이지 부트스트랩
   defineScenario({ title, tagline, compose, steps }) 하나로
   레이아웃 + 스테이지 + 플레이어를 조립한다.
   새 아키텍처 페이지는 이 함수만 호출하면 된다.
   ============================================================ */
import { createStage } from './stage.js';
import { createPlayer } from './player.js';

export function defineScenario({ id, title, tagline, compose, steps, accumulate = true }) {
  document.title = `${title} — CAwiki`;

  document.body.innerHTML = `
    <div class="layout">
      <aside class="panel">
        <div class="progress"><i></i></div>
        <div class="panel-head">
          <a class="back" href="../index.html">← 아키텍처 목록</a>
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
      </main>
    </div>`;

  const svg = document.querySelector('.stagewrap svg');
  const stage = createStage(svg);
  compose(stage);

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
