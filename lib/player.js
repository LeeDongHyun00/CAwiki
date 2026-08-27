/* ============================================================
   CAwiki — 스텝 플레이어
   휠·키보드·터치 입력을 "한 번에 한 단계"로 통제한다.
   애니메이션이 끝날 때까지 입력을 잠그고(busy),
   트랙패드 관성은 쿨다운 + 누적 리셋으로 흡수해
   단계를 건너뛰는 일이 없다.

   메인 페이지처럼 앞단에 스크럽 구간이 있는 경우:
     · enabled(false)  → 입력을 받지 않고 스크럽 쪽에 양보
     · onExitTop       → 0단계에서 위로 스크롤하면 호출 (스크럽으로 복귀)
     · renderItem      → 단계 목록 마크업을 호출자가 정한다
   ============================================================ */
export function createPlayer({
  stage, steps, ui, accumulate = true,
  renderItem = null, onExitTop = null, enabled = true,
}) {
  let i = -1;
  let busy = false;
  let cooldownUntil = 0;
  let acc = 0;
  let lastWheel = 0;
  let active = enabled;

  const COOLDOWN = 220;      // 단계 전환 후 입력 무시(ms) — 관성 스크롤 흡수
  const THRESHOLD = 70;      // 한 단계로 인정할 휠 누적량
  const MOMENTUM_GAP = 120;  // 이 간격 안에 다음 휠이 오면 '같은 관성 제스처'로 본다
  const MOMENTUM_HOLD = 110; // 흡수 중 관성이 이어지면 이만큼씩 쿨다운을 연장한다

  /* ---------- 스텝 목록 UI ---------- */
  // 설명 본문 렌더 — 새 형식 {lead, points[], detail} 우선, 없으면 기존 body 문자열.
  // lead=결론 한 문장, points=부품→역할→값 마이크로리스트, detail=값·약어 심화.
  const bodyHtml = (st) => {
    if (st.lead || st.points || st.detail) {
      const lead = st.lead ? `<p class="st-lead">${st.lead}</p>` : '';
      const pts = (st.points && st.points.length)
        ? `<ul class="st-points">${st.points.map((p) => `<li>${p}</li>`).join('')}</ul>` : '';
      const det = st.detail ? `<p class="st-detail">${st.detail}</p>` : '';
      return lead + pts + det;
    }
    return `<div class="st-body">${st.body || ''}</div>`;
  };

  const defaultRender = (st, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="st-head">
        <span class="st-num">${String(idx).padStart(2, '0')}</span>
        <span class="st-title">${st.title}</span>
      </div>
      ${bodyHtml(st)}`;
    return li;
  };

  const items = ui.list ? steps.map((st, idx) => {
    const node = (renderItem || defaultRender)(st, idx);
    node.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;   // 내부 링크는 그대로 통과
      goTo(idx);
    });
    ui.list.appendChild(node);
    return node;
  }) : [];

  /* 본문 부품명(<b data-comp>) ↔ 다이어그램 도형 교차 강조.
     data-comp 용어가 하나라도 있을 때만 배선한다 → home(캡션)엔 영향 없음. */
  function wireCrossHighlight() {
    if (!stage.comps || !ui.list) return;
    const anyTerm = ui.list.querySelector('[data-comp]');
    if (!anyTerm) return;
    const setComp = (id, on) => { const c = stage.comps.get(id); if (c) c.el.classList.toggle('xhi', on); };
    // 본문 용어 → 도형
    items.forEach((li) => {
      li.querySelectorAll('[data-comp]').forEach((term) => {
        const id = term.getAttribute('data-comp');
        if (!stage.comps.get(id)) return;
        const on = () => { setComp(id, true); term.classList.add('xhi'); };
        const off = () => { setComp(id, false); term.classList.remove('xhi'); };
        term.addEventListener('mouseenter', on);
        term.addEventListener('mouseleave', off);
      });
    });
    // 도형 → 현재 스텝의 매칭 용어
    stage.comps.forEach((c, id) => {
      c.el.addEventListener('mouseenter', () => {
        c.el.classList.add('xhi');
        const cur = items[i];
        if (cur) cur.querySelectorAll(`[data-comp="${id}"]`).forEach((t) => t.classList.add('xhi'));
      });
      c.el.addEventListener('mouseleave', () => {
        c.el.classList.remove('xhi');
        items.forEach((li) => li.querySelectorAll(`[data-comp="${id}"]`).forEach((t) => t.classList.remove('xhi')));
      });
    });
  }
  wireCrossHighlight();

  function renderUI() {
    items.forEach((n, idx) => {
      n.classList.toggle('cur', idx === i);
      n.classList.toggle('done', idx < i);
    });
    if (ui.counter) {
      ui.counter.innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b> / ${String(steps.length).padStart(2, '0')}`;
    }
    if (ui.progress) ui.progress.style.width = `${((i + 1) / steps.length) * 100}%`;
    if (ui.prevBtn) ui.prevBtn.disabled = i <= 0 && !onExitTop;
    if (ui.nextBtn) ui.nextBtn.disabled = i >= steps.length - 1;
    if (ui.dots) {
      ui.dots.forEach((d, idx) => d.classList.toggle('on', idx === i));
    }
    const cur = items[i];
    if (cur && ui.scrollIntoView !== false) {
      cur.scrollIntoView({ block: 'nearest', behavior: stage.RM ? 'auto' : 'smooth' });
    }
  }

  /* ---------- 단계 적용 ---------- */
  async function apply(idx, { instant = false } = {}) {
    const st = steps[idx];
    i = idx;
    renderUI();
    if (ui.lock) ui.lock.classList.add('on');

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
    if (st.run) await st.run(stage);
    if (ui.lock) ui.lock.classList.remove('on');
  }

  async function goTo(idx, opts = {}) {
    idx = Math.max(0, Math.min(steps.length - 1, idx));
    if (busy || idx === i) return;
    busy = true;
    try {
      await apply(idx, opts);
    } catch (e) {
      console.error('[CAwiki] 단계 적용 중 오류 — 잠금을 해제합니다.', e);
    } finally {
      busy = false;                       // 예외가 나도 화면이 굳지 않는다
      cooldownUntil = performance.now() + COOLDOWN;
      acc = 0;
    }
  }
  const next = () => goTo(i + 1);
  const prev = () => {
    if (i <= 0) { if (onExitTop) onExitTop(); return; }
    goTo(i - 1);
  };

  /* ---------- 입력 통제 ---------- */
  function onWheel(e) {
    if (!active) return;
    if (e.target.closest && e.target.closest('.steps-scroll')) return;  // 목록은 자체 스크롤 허용
    e.preventDefault();
    const now = performance.now();
    const continuation = (now - lastWheel) < MOMENTUM_GAP;   // 직전 휠과 이어지는 관성인가
    lastWheel = now;

    // 애니메이션 중이거나 쿨다운 중이면 입력을 흡수한다.
    // 큰 플릭의 '관성 꼬리'가 계속 들어오는 동안에는 쿨다운을 밀어, 제스처가 잦아들기 전에는
    // 다음 단계로 넘어가지 않게 한다. (리빌→투어 인계 직후 0을 지나쳐 1로 튀던 버그가 여기서 막힌다.)
    if (busy || now < cooldownUntil) {
      acc = 0;
      if (continuation) cooldownUntil = Math.max(cooldownUntil, now + MOMENTUM_HOLD);
      return;
    }
    if (!continuation) acc = 0;   // 관성이 끊긴 뒤의 새 제스처 → 누적 리셋
    acc += e.deltaY;
    if (acc > THRESHOLD) { acc = 0; next(); }
    else if (acc < -THRESHOLD) { acc = 0; prev(); }
  }

  function onKey(e) {
    if (!active) return;
    if (['ArrowDown', 'ArrowRight', ' ', 'PageDown'].includes(e.key)) { e.preventDefault(); next(); }
    else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
    else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
    else if (e.key === 'End') { e.preventDefault(); goTo(steps.length - 1); }
  }

  let touchY = null;
  function onTouchStart(e) { if (active) touchY = e.touches[0].clientY; }
  function onTouchMove(e) {
    if (!active) return;
    if (e.target.closest && e.target.closest('.steps-scroll')) return;
    e.preventDefault();
  }
  function onTouchEnd(e) {
    if (!active || touchY == null) return;
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
  if (ui.prevBtn) ui.prevBtn.addEventListener('click', prev);
  if (ui.nextBtn) ui.nextBtn.addEventListener('click', next);
  if (ui.dots) ui.dots.forEach((d, idx) => d.addEventListener('click', () => goTo(idx)));

  return {
    next, prev, goTo,
    get index() { return i; },
    get busy() { return busy; },
    get active() { return active; },
    setActive(v, guardMs) {
      active = v;
      if (v) {
        acc = 0;
        // 인계 직후 초기 잠금은 관성 간격(MOMENTUM_GAP)보다 길어야, 첫 관성 휠이
        // 흡수 분기로 들어가 쿨다운 연장 사슬을 시작한다. lastWheel도 지금으로 맞춘다.
        lastWheel = performance.now();
        cooldownUntil = performance.now() + (guardMs != null ? guardMs : 300);
      }
    },
    /** 스크럽에서 넘어올 때 목록/카메라를 첫 단계로 맞춘다. */
    start: (idx = 0, opts = { instant: true }) => {
      busy = true;
      return apply(idx, opts).then(() => {
        busy = false;
        cooldownUntil = performance.now() + COOLDOWN;
      });
    },
  };
}
