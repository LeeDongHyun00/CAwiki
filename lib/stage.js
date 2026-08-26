/* ============================================================
   CAwiki — 스테이지
   카메라(줌·이동 트윈), 트레이스(배선), 플로우(데이터 펄스),
   컴포넌트 상태(lit / trail / dim)를 관리한다.
   ============================================================ */
import { el } from './components.js';

const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createStage(svg, { vw = 1280, vh = 800 } = {}) {
  svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const world = el('g', { id: 'world' });
  const zonesG = el('g');
  const tracesG = el('g');
  const pulsesG = el('g');
  const compsG = el('g');
  world.append(zonesG, tracesG, pulsesG, compsG);
  svg.appendChild(world);

  const comps = new Map();   // id → component
  const traces = new Map();  // id → { g, path, len }
  const flows = [];          // { el, path, len, t, speed, reverse }

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
    const t = { g, path, len: path.getTotalLength() };
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
      const t = traces.get(typeof e === 'string' ? e : e.id);
      if (!t) return;
      t.g.classList.add('on');
      if (typeof e === 'object' && e.color) t.g.style.setProperty('--tc', e.color);
    });
  }

  /* ---------- 플로우 (데이터 펄스) ---------- */
  function startFlow(traceId, { color = '#E09A5F', n = 2, speed = 0.35, reverse = false, r = 4 } = {}) {
    if (RM) return;
    const t = traces.get(traceId);
    if (!t) return;
    for (let k = 0; k < n; k++) {
      const dot = el('circle', { r, fill: color, opacity: 0.95 });
      pulsesG.appendChild(dot);
      flows.push({ el: dot, path: t.path, len: t.len, t: k / n, speed, reverse });
    }
  }
  function stopFlows() {
    flows.forEach((f) => f.el.remove());
    flows.length = 0;
  }

  /* ---------- 카메라 ---------- */
  const cam = { x: vw / 2, y: vh / 2, s: 1 };
  let tween = null;
  function applyCam() {
    const tx = vw / 2 - cam.s * cam.x;
    const ty = vh / 2 - cam.s * cam.y;
    world.setAttribute('transform', `translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${cam.s.toFixed(4)})`);
  }
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function tweenTo(fx, fy, s, ms = 900) {
    if (RM || ms === 0) {
      tween = null;
      cam.x = fx; cam.y = fy; cam.s = s;
      applyCam();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      tween = { x0: cam.x, y0: cam.y, s0: cam.s, x1: fx, y1: fy, s1: s, t0: performance.now(), ms, resolve };
    });
  }

  /* 컴포넌트들이 모두 보이도록 카메라 맞추기 */
  function fit(ids, { pad = 90, maxS = 2.4, ms = 900 } = {}) {
    if (!ids || !ids.length) return tweenTo(vw / 2, vh / 2, 1, ms);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    ids.forEach((id) => {
      const c = comps.get(id);
      if (!c) return;
      x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y);
      x1 = Math.max(x1, c.x + c.w); y1 = Math.max(y1, c.y + c.h);
    });
    if (!isFinite(x0)) return tweenTo(vw / 2, vh / 2, 1, ms);
    const bw = x1 - x0 + pad * 2, bh = y1 - y0 + pad * 2;
    const s = Math.max(1, Math.min(maxS, Math.min(vw / bw, vh / bh)));
    return tweenTo((x0 + x1) / 2, (y0 + y1) / 2, s, ms);
  }

  /* ---------- rAF 루프 (카메라 트윈 + 플로우) ---------- */
  let last = null;
  function loop(now) {
    if (last == null) last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (tween) {
      const p = Math.min(1, (now - tween.t0) / tween.ms);
      const e = easeInOut(p);
      cam.x = tween.x0 + (tween.x1 - tween.x0) * e;
      cam.y = tween.y0 + (tween.y1 - tween.y0) * e;
      cam.s = tween.s0 + (tween.s1 - tween.s0) * e;
      applyCam();
      if (p >= 1) { const r = tween.resolve; tween = null; r(); }
    }
    for (const f of flows) {
      f.t = (f.t + dt * f.speed) % 1;
      const at = f.reverse ? (1 - f.t) : f.t;
      const pt = f.path.getPointAtLength(at * f.len);
      f.el.setAttribute('cx', pt.x);
      f.el.setAttribute('cy', pt.y);
    }
    requestAnimationFrame(loop);
  }
  applyCam();
  requestAnimationFrame(loop);

  return { svg, vw, vh, add, decorate, trace, zone, setStates, emphTraces, startFlow, stopFlows, tweenTo, fit, comps, traces, RM };
}
