/* ============================================================
   CAwiki — 스텝 플레이어
   휠·키보드·터치 입력을 "한 번에 한 단계"로 통제한다.
   애니메이션이 끝날 때까지 입력을 잠그고(busy),
   트랙패드 관성은 쿨다운 + 누적 리셋으로 흡수해
   단계를 건너뛰는 일이 없다.
   ============================================================ */
export function createPlayer({ stage, steps, ui, accumulate = true }) {
  let i = -1;
  let busy = false;
  let cooldownUntil = 0;
  let acc = 0;
  let lastWheel = 0;

  const COOLDOWN = 450;   // 단계 전환 후 입력 무시(ms) — 관성 스크롤 흡수
  const THRESHOLD = 70;   // 한 단계로 인정할 휠 누적량

  /* ---------- 스텝 목록 UI ---------- */
  const items = steps.map((st, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="st-head">
        <span class="st-num">${String(idx).padStart(2, '0')}</span>
        <span class="st-title">${st.title}</span>
      </div>
      <div class="st-body">${st.body}</div>`;
    li.addEventListener('click', () => goTo(idx));
    ui.list.appendChild(li);
    return li;
  });

  function renderUI() {
    items.forEach((li, idx) => {
      li.classList.toggle('cur', idx === i);
      li.classList.toggle('done', idx < i);
    });
    ui.counter.innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b> / ${String(steps.length).padStart(2, '0')}`;
    ui.progress.style.width = `${((i + 1) / steps.length) * 100}%`;
    ui.prevBtn.disabled = i <= 0;
    ui.nextBtn.disabled = i >= steps.length - 1;
    const cur = items[i];
    if (cur) cur.scrollIntoView({ block: 'nearest', behavior: stage.RM ? 'auto' : 'smooth' });
  }

  /* ---------- 단계 적용 ---------- */
  async function apply(idx, { instant = false } = {}) {
    const st = steps[idx];
    i = idx;
    renderUI();
    ui.lock.classList.add('on');

    stage.stopFlows();
    stage.emphTraces(st.traces || []);

    const lit = st.lit || [];
    const trail = accumulate
      ? steps.slice(0, idx).flatMap((s) => s.lit || []).filter((id) => !lit.includes(id))
      : [];
    stage.setStates({ lit, trail, dimOthers: st.dimOthers !== false });

    const ms = instant ? 0 : (st.ms ?? 900);
    if (st.focus && st.focus.length) await stage.fit(st.focus, { ms, pad: st.pad ?? 90, maxS: st.maxS ?? 2.4 });
    else await stage.tweenTo(stage.vw / 2, stage.vh / 2, 1, ms);

    (st.flows || []).forEach((f) => stage.startFlow(f.trace, f));
    if (st.run) st.run(stage);
    ui.lock.classList.remove('on');
  }

  async function goTo(idx, opts = {}) {
    idx = Math.max(0, Math.min(steps.length - 1, idx));
    if (busy || idx === i) return;
    busy = true;
    await apply(idx, opts);
    busy = false;
    cooldownUntil = performance.now() + COOLDOWN;
    acc = 0;
  }
  const next = () => goTo(i + 1);
  const prev = () => goTo(i - 1);

  /* ---------- 입력 통제 ---------- */
  function onWheel(e) {
    // 패널(설명 목록) 위에서는 목록 스크롤을 허용한다
    if (e.target.closest && e.target.closest('.steps-scroll')) return;
    e.preventDefault();
    const now = performance.now();
    if (busy || now < cooldownUntil) { acc = 0; return; }
    if (now - lastWheel > 250) acc = 0; // 잠깐 멈추면 누적 리셋
    lastWheel = now;
    acc += e.deltaY;
    if (acc > THRESHOLD) { acc = 0; next(); }
    else if (acc < -THRESHOLD) { acc = 0; prev(); }
  }

  function onKey(e) {
    if (['ArrowDown', 'ArrowRight', ' ', 'PageDown'].includes(e.key)) { e.preventDefault(); next(); }
    else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
    else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
    else if (e.key === 'End') { e.preventDefault(); goTo(steps.length - 1); }
  }

  let touchY = null;
  function onTouchStart(e) { touchY = e.touches[0].clientY; }
  function onTouchMove(e) {
    if (e.target.closest && e.target.closest('.steps-scroll')) return;
    e.preventDefault();
  }
  function onTouchEnd(e) {
    if (touchY == null) return;
    const dy = touchY - e.changedTouches[0].clientY;
    touchY = null;
    if (busy || performance.now() < cooldownUntil) return;
    if (dy > 55) next();
    else if (dy < -55) prev();
  }

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd);
  ui.prevBtn.addEventListener('click', prev);
  ui.nextBtn.addEventListener('click', next);

  return { next, prev, goTo, get index() { return i; }, get busy() { return busy; }, start: () => { busy = true; return apply(0, { instant: true }).then(() => { busy = false; }); } };
}
