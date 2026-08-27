/* ============================================================
   CAwiki — 스테이지
   카메라(줌·이동 트윈), 트레이스(배선), 플로우(데이터 펄스),
   컴포넌트 상태(lit / trail / dim)를 관리한다.

   매 프레임 수학은 애니메이션 커널(lib/kernel.js)에 위임한다.
   기본 백엔드는 WebAssembly(lib/cawiki.wasm)이며, 로드 실패 시
   동일 인터페이스의 순수 JS 백엔드로 자동 폴백한다.
   이 파일이 하는 일은 SVG DOM 구성과 속성 쓰기뿐이다.
   ============================================================ */
import { el } from './components.js';
import { createKernel } from './kernel.js';

const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 커널을 먼저 만들고 스테이지를 조립한다. */
export async function createStageAsync(svg, opts = {}) {
  const vw = opts.vw ?? 1280;
  const vh = opts.vh ?? 800;
  const kernel = opts.kernel ?? (await createKernel({ vw, vh }));
  return createStage(svg, { vw, vh, kernel });
}

export function createStage(svg, { vw = 1280, vh = 800, kernel } = {}) {
  if (!kernel) throw new Error('createStage: kernel이 필요합니다 (createStageAsync를 쓰세요)');

  /* 뷰포트 비율에 맞춰 viewBox를 넓힌다 — 레터박스(검은 띠) 없이 화면을 꽉 채우면서
     월드(vw×vh) 전체는 항상 보이도록 '더 큰 쪽으로' 확장한다.
     카메라 수식(tx = evw/2 - s*cx)은 그대로 성립하므로 좌표계는 건드리지 않는다. */
  let evw = vw, evh = vh;
  function writeViewBox() {
    svg.setAttribute('viewBox', `${((vw - evw) / 2).toFixed(2)} ${((vh - evh) / 2).toFixed(2)} ${evw.toFixed(2)} ${evh.toFixed(2)}`);
    if (kernel.camConfig) kernel.camConfig(evw, evh);
  }
  function resize() {
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return false;   // 아직 레이아웃 전 — 기본 viewBox를 유지한다
    const aspect = r.width / r.height;
    if (aspect >= vw / vh) { evh = vh; evw = vh * aspect; }
    else { evw = vw; evh = vw / aspect; }
    writeViewBox();
    return true;
  }
  /* 측정에 실패해도 화면이 깨지지 않도록 월드 크기로 먼저 깔아 둔다. */
  writeViewBox();
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const world = el('g', { id: 'world' });
  const zonesG = el('g');
  const tracesG = el('g');
  const pulsesG = el('g', { class: 'pulses' });   // 펄스 전용 그룹 (검사·디버깅 시 선택자로 사용)
  const compsG = el('g');
  world.append(zonesG, tracesG, pulsesG, compsG);
  svg.appendChild(world);

  const comps = new Map();   // id → component
  const traces = new Map();  // id → { g, path, len, ref }
  let dots = [];             // 펄스 SVG 엘리먼트 (커널의 펄스 순서와 1:1 대응)

  /* ---------- 등록 ---------- */
  function add(id, comp) {
    comp.el.dataset.id = id;
    comps.set(id, comp);
    compsG.appendChild(comp.el);
    return comp;
  }
  function decorate(node) { compsG.appendChild(node); return node; }

  function trace(id, d, { label = null, at = null, dashed = false, thin = false } = {}) {
    const g = el('g', { class: `trace-group${dashed ? ' dashed' : ''}` });
    const path = el('path', { d, class: `trace${thin ? ' thin' : ''}` });
    g.appendChild(path);
    if (label && at) {
      g.appendChild(el('text', { x: at[0], y: at[1], text: label, class: 'tracelabel', 'text-anchor': 'middle' }));
    }
    tracesG.appendChild(g);

    let ref;
    try {
      ref = kernel.registerPath(d, path);
    } catch (e) {
      console.warn(`[CAwiki] trace('${id}') 경로 등록 실패 — 이 배선에는 펄스가 흐르지 않습니다.`, e);
      ref = null;
    }
    const t = { g, path, ref, len: ref ? ref.len : 0 };
    traces.set(id, t);
    return t;
  }

  function zone(x, y, w, h, label) {
    zonesG.appendChild(el('rect', { x, y, width: w, height: h, rx: 12, class: 'zone-rect' }));
    zonesG.appendChild(el('text', { x: x + 12, y: y + h - 12, text: label, class: 'zone-label' }));
  }

  /* ---------- 상태 ---------- */
  function setStates({ lit = [], trail = [], dimOthers = true } = {}) {
    const litSet = new Set(lit), trailSet = new Set(trail);
    for (const id of litSet) {
      if (!comps.has(id)) console.warn(`[CAwiki] setStates: 알 수 없는 컴포넌트 id '${id}'`);
    }
    comps.forEach((c, id) => {
      c.el.classList.toggle('lit', litSet.has(id));
      c.el.classList.toggle('trail', !litSet.has(id) && trailSet.has(id));
      const active = litSet.has(id) || trailSet.has(id);
      c.el.classList.toggle('dim', dimOthers && lit.length > 0 && !active);
    });
  }

  function emphTraces(list = []) {
    traces.forEach((t) => { t.g.classList.remove('on'); t.g.style.removeProperty('--tc'); });
    list.forEach((e) => {
      const id = typeof e === 'string' ? e : e.id;
      const t = traces.get(id);
      if (!t) { console.warn(`[CAwiki] emphTraces: 알 수 없는 트레이스 id '${id}'`); return; }
      t.g.classList.add('on');
      if (typeof e === 'object' && e.color) t.g.style.setProperty('--tc', e.color);
    });
  }

  /* ---------- 플로우 (데이터 펄스) ---------- */
  function startFlow(traceId, { color = '#E09A5F', n = 2, speed = 0.35, reverse = false, r = 4 } = {}) {
    if (RM) return;
    const t = traces.get(traceId);
    if (!t) { console.warn(`[CAwiki] startFlow: 알 수 없는 트레이스 id '${traceId}'`); return; }
    if (!t.ref) return;
    for (let k = 0; k < n; k++) {
      const dot = el('circle', { r, fill: color, opacity: 0.95, cx: -9999, cy: -9999 });
      pulsesG.appendChild(dot);
      dots.push(dot);
      kernel.addPulse(t.ref, k / n, speed, reverse);
    }
  }
  function stopFlows() {
    kernel.clearPulses();
    dots.forEach((d) => d.remove());
    dots = [];
  }

  /* ---------- 카메라 ---------- */
  let pendingResolvers = [];

  /* viewBox 원점이 ((vw-evw)/2, (vh-evh)/2)로 밀려 있으므로 그만큼 보정한다. */
  const offX = () => (vw - evw) / 2;
  const offY = () => (vh - evh) / 2;
  function writeCam(c) {
    world.setAttribute('transform',
      `translate(${(c.tx + offX()).toFixed(2)},${(c.ty + offY()).toFixed(2)}) scale(${c.s.toFixed(4)})`);
  }
  function applyCamNow() { writeCam(kernel.camStep(performance.now())); }

  function flushResolvers() {
    const rs = pendingResolvers;
    pendingResolvers = [];
    rs.forEach((r) => r());
  }

  function tweenTo(fx, fy, s, ms = 900) {
    if (RM || ms === 0) {
      kernel.camSet(fx, fy, s);
      applyCamNow();
      flushResolvers();       // 대기 중이던 트윈들도 함께 해소 (영구 대기 방지)
      return Promise.resolve();
    }
    kernel.camTween(fx, fy, s, ms, performance.now());
    return new Promise((resolve) => { pendingResolvers.push(resolve); });
  }

  /** 스크롤 양에 실시간 연동되는 카메라 (메인 페이지 리빌).
      t=0 → camA, t=1 → camB. 배율은 커널이 로그 공간에서 보간한다. */
  function scrubTo(t, camA, camB) {
    const c = kernel.camScrub(t, camA, camB);
    writeCam(c);
    return c;
  }

  /** 사각형이 뷰포트를 꽉 채우는 배율 — 리빌 시작 프레임을 구할 때. */
  function coverScale(w, h) { return kernel.coverScale(w, h); }

  /** 컴포넌트들이 모두 보이도록 카메라를 맞춘다. */
  function fit(ids, { pad = 90, maxS = 2.4, ms = 900 } = {}) {
    if (!ids || !ids.length) return tweenTo(vw / 2, vh / 2, 1, ms);
    const boxes = [];
    ids.forEach((id) => {
      const c = comps.get(id);
      if (!c) { console.warn(`[CAwiki] fit: 알 수 없는 컴포넌트 id '${id}'`); return; }
      boxes.push({ x: c.x, y: c.y, w: c.w, h: c.h });
    });
    if (!boxes.length) return tweenTo(vw / 2, vh / 2, 1, ms);
    const { fx, fy, s } = kernel.camFit(boxes, pad, maxS);
    return tweenTo(fx, fy, s, ms);
  }

  /* ---------- rAF 루프 (카메라 트윈 + 펄스) ---------- */
  let last = null;
  function loop(now) {
    if (last == null) last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (kernel.camTweening) {
      const c = kernel.camStep(now);
      writeCam(c);
      if (c.finished) flushResolvers();
    }

    const n = kernel.pulseCount;
    if (n > 0) {
      const pos = kernel.advancePulses(dt);
      for (let i = 0; i < n; i++) {
        const d = dots[i];
        if (!d) continue;
        d.setAttribute('cx', pos[i * 2]);
        d.setAttribute('cy', pos[i * 2 + 1]);
      }
    }
    requestAnimationFrame(loop);
  }

  /* 레이아웃이 잡히는 시점이 브라우저·상황마다 달라서(숨은 탭, 폰트 로딩 등)
     ResizeObserver로 실제 크기가 생기는 순간을 잡는다. */
  resize();
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => { if (resize()) applyCamNow(); });
    ro.observe(svg);
  }
  window.addEventListener('resize', () => { resize(); applyCamNow(); });
  kernel.camSet(vw / 2, vh / 2, 1);
  applyCamNow();
  requestAnimationFrame(loop);

  return {
    svg, vw, vh, add, decorate, trace, zone, setStates, emphTraces,
    startFlow, stopFlows, tweenTo, fit, scrubTo, coverScale, resize, comps, traces, RM,
    get evw() { return evw; }, get evh() { return evh; },
    world, backend: kernel.backend, kernel,
  };
}
