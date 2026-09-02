/* ============================================================
   CAwiki — 하드웨어 관계 지도 (그래프 뷰)
   레벨1: ego-graph — 중앙 하드웨어 + 이웃을 방사형(카테고리 섹터)으로,
          화살표 + 관계 글. 이웃 클릭 → 재중심 카메라 애니메이션.
   레벨2: 상세 — 역할 먼저 → 부품 그리드가 순서대로 빛나고(스크롤/키),
          부품 클릭 → 역할·작동 설명.
   카메라(로그줌·ease-out)는 stage/kernel 재사용. 노드·부품·하이라이트는
   이 파일이 직접 관리(stage엔 재배치/제거 API가 없으므로 — 설계 §4.2).
   입력은 mode(ego|detail) 라우터가 배타적으로 소유(설계 §4.5).
   ============================================================ */
import { createStageAsync } from './stage.js';
import { C } from './components.js';
import { hwVisual, partArt } from './hw-visuals.js';

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  return n;
};

const VW = 1280, VH = 800, CX = 640, CY = 400;
/* 좁은 화면(세로 폰)에서는 방사형을 세로로 세운다.
   무대가 세로로 길면 stage의 viewBox가 세로로 확장돼 가로 배치가 화면 가운데
   30%에만 몰린다 — 배치 자체를 무대의 실제 비율에 맞추는 것이 근본 해법.
   가로 모드 폰은 폭이 넓으므로(무대가 가로로 길다) 세로 배치를 쓰면 안 된다. */
function isNarrow() {
  const st = document.querySelector('.hw-stage');
  if (!st) return window.matchMedia('(max-width: 820px)').matches;
  const r = st.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && (r.width / r.height) < 1.15;   // 무대가 세로로 길다
}
const CAT_ORDER = ['연산', '메모리', '저장장치', '기판·버스·전원', '입출력', '네트워크'];
const CAT_C = { '연산': C.compute, '메모리': C.memory, '저장장치': C.storage, '기판·버스·전원': C.power, '입출력': C.io, '네트워크': C.net };
const catColor = (c) => CAT_C[c] || C.power;
const catIdx = (c) => { const i = CAT_ORDER.indexOf(c); return i < 0 ? 99 : i; };
const shortName = (n) => (n.name_ko || '').split(' (')[0].split(' —')[0].trim();
const shortPart = (s) => { const base = String(s).split(' (')[0].trim(); return base.length > 16 ? base.slice(0, 15) + '…' : base; };
const truncate = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const clear = (g) => { while (g && g.firstChild) g.removeChild(g.firstChild); };

/* ---------- 상태 ---------- */
let stage, graph, byId, adjMap;
let gEdges, gNodes, gDetail;
let centerId, mode = 'ego', busy = false;
let ego = [];            // [{id, reason, node, box, edge, label}]
let egoFocus = -1;       // 키보드 이웃 포커스
let detail = null;       // {parts:[{g,box,short,role}], steps, cur}
let crumbs = [];         // 방문 경로
let gLesson, gMap;       // 입문 코스 / 전문가 전체 지도 레이어
let level = 'standard';  // 학습 단계: beginner | standard | expert
let lesson = -1;         // 입문 코스 진행(-1 개요, 0..5 레슨, 6 완료)
let expertTab = 'overview';
const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* DOM refs */
const $ = (s) => document.querySelector(s);
const panel = {
  badge: $('.hw-cat-badge'), name: $('.hw-name'), en: $('.hw-name-en'),
  oneline: $('.hw-oneline'), body: $('.hw-body'),
  detailBtn: $('.hw-detail-btn'), backBtn: $('.hw-back-btn'), hint: $('.hw-hint'),
};
const stepbar = $('.hw-stepbar'), stepCount = $('.hw-stepcount'), progress = $('.hw-progress > i');
const actions = { detail: $('.hw-detail-btn'), back: $('.hw-back-btn'), map: $('.hw-map-btn'),
  lprev: $('.hw-lesson-prev'), lnext: $('.hw-lesson-next') };
const crumbNav = $('.hw-crumbs'), live = $('.sr-live');

/* ---------- 카메라 (stage/kernel 재사용) ---------- */
function camFit(boxes, { pad = 80, maxS = 1.6, ms = 900 } = {}) {
  if (!boxes.length) return Promise.resolve();
  const { fx, fy, s } = stage.kernel.camFit(boxes, pad, maxS);
  return stage.tweenTo(fx, fy, s, RM ? 0 : ms);
}

/* ============================================================
   레벨 1 — ego-graph
   ============================================================ */
function showEgo(id, { instant = false, push = true } = {}) {
  mode = 'ego'; centerId = id; egoFocus = -1;
  clear(gDetail); gDetail.style.display = 'none';
  if (gLesson) { clear(gLesson); gLesson.style.display = 'none'; }
  if (gMap) { clear(gMap); gMap.style.display = 'none'; }
  gEdges.style.display = ''; gNodes.style.display = '';
  clear(gEdges); clear(gNodes);
  stepbar.hidden = true;
  setActions('ego');

  const node = byId.get(id);
  const nbrs = [...adjMap.get(id)].sort((a, b) => catIdx(byId.get(a.id).category) - catIdx(byId.get(b.id).category));

  // 중앙 — 실물 비주얼
  const cv = hwVisual(id, 150);
  const cbox = { x: CX - cv.w / 2, y: CY - cv.h / 2, w: cv.w, h: cv.h };
  const cr = Math.max(cv.w, cv.h) / 2 + 26;
  const ring = svgEl('circle', { class: 'center-ring', cx: CX, cy: CY, r: cr, stroke: catColor(node.category), 'stroke-width': 1.4 });
  const cNode = svgEl('g', { class: 'hw-node center' });
  cNode.appendChild(svgEl('rect', { class: 'hitbox', x: cbox.x - 12, y: cbox.y - 12, width: cv.w + 24, height: cv.h + 24, rx: 12, fill: 'transparent', stroke: catColor(node.category) }));
  cv.el.setAttribute('transform', `translate(${cbox.x},${cbox.y}) scale(${cv.s})`);
  cNode.appendChild(cv.el);
  const cname = svgEl('text', { class: 'node-name', x: CX, y: cbox.y + cv.h + 26, 'text-anchor': 'middle' });
  cname.textContent = shortName(node);
  cNode.appendChild(cname);
  cNode.dataset.id = id;
  cNode.setAttribute('tabindex', '0');
  cNode.setAttribute('role', 'button');
  cNode.setAttribute('aria-label', `${shortName(node)} 중앙. 부품·작동 보기`);
  cNode.addEventListener('click', () => enterDetail(id));
  gNodes.append(ring, cNode);

  const boxes = [cbox];
  // 반경을 무대 비율에 맞춘다 — 세로 화면이면 세로로 긴 타원(가로 폭이 좁으므로)
  const narrow = isNarrow();
  const N = nbrs.length, rx = narrow ? 330 : 500, ry = narrow ? 560 : 306;
  ego = nbrs.map((nb, i) => {
    const a = -Math.PI / 2 + 2 * Math.PI * (i + 0.5) / N;
    const nx = CX + rx * Math.cos(a), ny = CY + ry * Math.sin(a);
    const nn = byId.get(nb.id);
    // 실물 미니
    const v = hwVisual(nb.id, 84);
    const box = { x: nx - v.w / 2, y: ny - v.h / 2, w: v.w, h: v.h };
    // 곡선 엣지 (중앙 → 이웃, 살짝 휘어서)
    const dx = nx - CX, dy = ny - CY, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    const x1 = CX + ux * (cr + 4), y1 = CY + uy * (cr + 4);
    const x2 = nx - ux * (Math.max(v.w, v.h) / 2 + 14), y2 = ny - uy * (Math.max(v.w, v.h) / 2 + 14);
    const mx = (x1 + x2) / 2 - uy * 26, my = (y1 + y2) / 2 + ux * 26;   // 수직 방향 곡률
    const edge = svgEl('path', {
      class: 'edge', d: `M${x1},${y1} Q${mx},${my} ${x2},${y2}`, fill: 'none',
      stroke: catColor(nn.category), 'marker-end': `url(#arw-${catIdx(nn.category)})`,
    });
    gEdges.appendChild(edge);
    // 노드 = 히트박스 + 실물 + 이름 + 관계 글
    const nNode = svgEl('g', { class: 'hw-node' });
    nNode.appendChild(svgEl('rect', { class: 'hitbox', x: box.x - 14, y: box.y - 12, width: v.w + 28, height: v.h + 44, rx: 10, fill: 'transparent', stroke: catColor(nn.category) }));
    v.el.setAttribute('transform', `translate(${box.x},${box.y}) scale(${v.s})`);
    nNode.appendChild(v.el);
    const nm = svgEl('text', { class: 'node-name sm', x: nx, y: box.y + v.h + 17, 'text-anchor': 'middle' });
    nm.textContent = shortName(nn);
    nNode.appendChild(nm);
    nNode.dataset.id = nb.id;
    nNode.setAttribute('tabindex', '0');
    nNode.setAttribute('role', 'button');
    nNode.setAttribute('aria-label', `${shortName(nn)}. ${truncate(nb.reason, 40)}. 이동하려면 Enter`);
    const label = svgEl('text', { class: 'edge-label', x: nx, y: box.y + v.h + (narrow ? 36 : 31), 'text-anchor': 'middle' });
    label.textContent = truncate(nb.reason, narrow ? 12 : 17);   // 폰에선 더 짧게(겹침 방지)
    gNodes.appendChild(label);
    gNodes.appendChild(nNode);
    const nodeRef = { el: nNode };

    const item = { id: nb.id, reason: nb.reason, node: nodeRef, box, edge, label, idx: i };
    const enter = () => hoverNeighbor(item, true);
    const leaveev = () => hoverNeighbor(item, false);
    nNode.addEventListener('mouseenter', enter);
    nNode.addEventListener('mouseleave', leaveev);
    nNode.addEventListener('focus', enter);
    nNode.addEventListener('blur', leaveev);
    nNode.addEventListener('click', () => recenter(nb.id));
    boxes.push({ x: box.x - 14, y: box.y - 12, w: box.w + 28, h: box.h + 48 });   // 이름·관계 라벨 포함
    return item;
  });

  renderPanelEgo(node, nbrs.length, true);
  buildCrumbs();
  panel.hint.textContent = '이웃에 마우스를 올리면 관계가, 클릭하면 이동합니다. 화살표키+Enter로도 이동.';
  say(`${shortName(node)} 중앙. 연관 하드웨어 ${nbrs.length}개.`);

  // 등장 페이드
  if (!instant && !RM) { [gEdges, gNodes].forEach((g) => { g.style.opacity = 0; requestAnimationFrame(() => { g.style.transition = 'opacity .45s var(--ease, ease)'; g.style.opacity = 1; }); }); }
  else { gEdges.style.opacity = 1; gNodes.style.opacity = 1; }

  if (push) pushCrumb(id);
  return camFit(boxes, { pad: narrow ? 56 : 96, maxS: narrow ? 1.1 : 1.42, ms: instant ? 0 : 900 });
}

function hoverNeighbor(item, on) {
  item.node.el.classList.toggle('hi', on);
  item.edge.classList.toggle('hi', on);
  item.label.classList.toggle('hi', on);
  if (on) {
    const c = byId.get(centerId), n = byId.get(item.id);
    panel.body.innerHTML = `<p class="lead">${shortName(c)} → ${shortName(n)}</p><p class="role">${item.reason}</p>
      <p style="color:var(--ink-dim);font-size:12.5px;margin-top:14px">클릭하면 ${shortName(n)}가 중앙으로 이동합니다.</p>`;
  } else if (mode === 'ego') {
    renderPanelEgo(byId.get(centerId), ego.length);
  }
}

async function recenter(id) {
  if (busy || id === centerId || mode !== 'ego') return;
  busy = true;
  pushCrumb(id);
  try { await showEgo(id, { push: false }); }
  finally { busy = false; }
}

function renderPanelEgo(node, deg, animate = false) {
  if (level === 'expert') return renderPanelExpert(node, animate);
  panel.badge.textContent = node.category;
  panel.badge.style.background = catColor(node.category);
  panel.name.textContent = shortName(node);
  panel.en.textContent = node.name_en || '';
  panel.oneline.textContent = node.one_line || '';
  swapBody(`<p class="hw-eyebrow">표준 · 관계 지도</p><p class="role">${node.role}</p>
    <section class="hw-sec"><h3>연관 하드웨어 ${deg}개</h3><p class="hw-sub">이웃에 마우스를 올리면 관계가, 클릭하면 그쪽으로 이동합니다.</p></section>`, animate);
  panel.detailBtn.textContent = `${shortName(node)} 부품·작동 자세히 보기 →`;
  panel.hint.textContent = '';
}

/* ============================================================
   레벨 2 — 상세 (부품 순서 투어)
   ============================================================ */
function enterDetail(id) {
  mode = 'detail';
  gEdges.style.display = 'none'; gNodes.style.display = 'none';
  if (gLesson) gLesson.style.display = 'none'; if (gMap) gMap.style.display = 'none';
  gDetail.style.display = ''; clear(gDetail);
  setActions('detail');
  stepbar.hidden = false;

  const node = byId.get(id);
  const parts = node.parts || [];
  const color = catColor(node.category);
  const N = parts.length;
  // 부품 수에 비례한 타원 — 세로 화면에선 세로로 세운다
  const narrow = isNarrow();
  const base = 400 + N * 10;
  const rx = narrow ? base * 0.62 : base;
  const ry = narrow ? base * 1.15 : base * 0.6;

  const gLinks = svgEl('g', { class: 'g-plinks' });
  gDetail.appendChild(gLinks);

  // 중앙 — 하드웨어 실물 (마인드맵 허브)
  const cv = hwVisual(id, 176);
  const hub = svgEl('g', { class: 'detail-hub' });
  cv.el.setAttribute('transform', `translate(${CX - cv.w / 2},${CY - cv.h / 2}) scale(${cv.s})`);
  hub.appendChild(cv.el);
  const title = svgEl('text', { class: 'detail-title', x: CX, y: CY - cv.h / 2 - 22, 'text-anchor': 'middle' });
  title.textContent = shortName(node);
  hub.appendChild(title);
  const sub = svgEl('text', { x: CX, y: CY + cv.h / 2 + 24, 'text-anchor': 'middle', class: 'edge-label' });
  sub.textContent = `부품 ${N}개 · 배선 = 실제 상호작용 · 스크롤/←→ 순서, 클릭 = 그 부품`;
  hub.appendChild(sub);
  gDetail.appendChild(hub);

  // 부품 — 방사형 실물 아이콘
  const pitems = parts.map((p, i) => {
    const a = -Math.PI / 2 + 2 * Math.PI * i / N;
    const px = CX + rx * Math.cos(a), py = CY + ry * Math.sin(a);
    const art = partArt(p.part, color);
    const ax = px - art.w / 2, ay = py - art.h / 2 - 6;
    const g = svgEl('g', { class: 'part' });
    g.appendChild(svgEl('rect', { class: 'p-hit', x: px - 58, y: py - 42, width: 116, height: 84, rx: 10, fill: 'transparent', stroke: color }));
    const artG = svgEl('g', { class: 'p-art' });
    artG.appendChild(art.el);
    artG.setAttribute('transform', `translate(${ax},${ay})`);
    g.appendChild(artG);
    const nm = svgEl('text', { class: 'p-name', x: px, y: ay + art.h + 16, 'text-anchor': 'middle' });
    nm.textContent = shortPart(p.part);
    g.appendChild(nm);
    g.dataset.part = i;
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', `${shortPart(p.part)}. 설명 보기`);
    g.addEventListener('click', () => gotoStep(i + 1));
    g.addEventListener('focus', () => gotoStep(i + 1));
    gDetail.appendChild(g);
    const box = { x: px - 60, y: py - 46, w: 120, h: 96 };
    return { g, box, cx: px, cy: py, short: shortPart(p.part), full: p.part, role: p.role, color };
  });

  // 상호작용 배선 — part_links의 부품쌍을 곡선으로 (중앙 쪽으로 휘어 마인드맵 느낌)
  const links = (node.part_links || []).map(([i, j]) => {
    const a = pitems[i], b = pitems[j];
    const mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2;
    const qx = mx + (CX - mx) * 0.30, qy = my + (CY - my) * 0.30;
    const path = svgEl('path', { class: 'plink', d: `M${a.cx},${a.cy} Q${qx},${qy} ${b.cx},${b.cy}`, stroke: color });
    gLinks.appendChild(path);
    return { i, j, path };
  });
  // 어떤 링크에도 안 걸린 부품은 허브로 희미한 소속 스포크
  const linked = new Set(links.flatMap((l) => [l.i, l.j]));
  pitems.forEach((p, i) => {
    if (linked.has(i)) return;
    gLinks.appendChild(svgEl('path', { class: 'spoke', d: `M${CX},${CY} L${p.cx},${p.cy}`, stroke: color }));
  });

  // 개요 + 부품별 스텝
  const steps = [{ type: 'overview' }].concat(pitems.map((_, i) => ({ type: 'part', idx: i })));
  detail = { node, parts: pitems, links, steps, cur: -1, allBoxes: pitems.map((p) => p.box) };
  $('.hw-prev').onclick = () => gotoStep(detail.cur - 1);
  $('.hw-next').onclick = () => gotoStep(detail.cur + 1);
  say(`${shortName(node)} 상세. 부품 ${N}개, 상호작용 배선 ${links.length}개.`);
  gotoStep(0);
}

function gotoStep(i) {
  if (!detail) return;
  i = Math.max(0, Math.min(detail.steps.length - 1, i));
  if (i === detail.cur) return;
  detail.cur = i;
  const step = detail.steps[i];
  // 콜아웃 제거
  const old = gDetail.querySelector('.callout'); if (old) old.remove();

  detail.parts.forEach((p) => { p.g.classList.remove('focus', 'linked', 'dim'); p.g.style.color = ''; });
  detail.links.forEach((l) => l.path.classList.remove('hi', 'off'));

  if (step.type === 'overview') {
    stepCount.textContent = `개요 · 역할`;
    progress.style.width = '0%';
    panel.body.innerHTML = `<p class="lead">${shortName(detail.node)}는 무슨 일을 하나</p><p class="role">${detail.node.role}</p>`;
    camFit(detail.allBoxes, { pad: isNarrow() ? 48 : 80, maxS: isNarrow() ? 1.05 : 1.3, ms: 700 });
    say(`개요. ${shortName(detail.node)}의 역할.`);
  } else {
    const p = detail.parts[step.idx];
    // 이 부품과 실제로 상호작용하는 부품·배선을 함께 밝힌다
    const mates = [];
    detail.links.forEach((l) => {
      if (l.i === step.idx || l.j === step.idx) { l.path.classList.add('hi'); mates.push(l.i === step.idx ? l.j : l.i); }
      else l.path.classList.add('off');
    });
    detail.parts.forEach((q, k) => {
      if (k === step.idx) return;
      if (mates.includes(k)) { q.g.classList.add('linked'); q.g.style.color = q.color; }
      else q.g.classList.add('dim');
    });
    p.g.classList.add('focus'); p.g.style.color = p.color;
    stepCount.textContent = `부품 ${step.idx + 1} / ${detail.parts.length}`;
    progress.style.width = `${(step.idx + 1) / detail.parts.length * 100}%`;
    const mateNames = mates.map((k) => detail.parts[k].short);
    panel.body.innerHTML = `<p class="lead">${p.full}</p><p class="part-role">${p.role}</p>`
      + (mateNames.length ? `<h3>함께 작동</h3><p class="role">${mateNames.join(' · ')}</p>` : '');
    // 콜아웃(공간 근접성) — 아이콘 아래 한 줄.
    // 상반부 부품은 위로 넘치기 쉬우므로 아래쪽에, 하반부 부품은 위쪽에 둔다.
    const above = p.cy > CY;
    const co = svgEl('g', { class: 'callout' });
    const t = svgEl('text', {
      class: 'callout-text', x: p.cx, 'text-anchor': 'middle',
      y: above ? p.box.y - 8 : p.box.y + p.box.h + 16,
    });
    t.textContent = truncate(p.role.split(/[.。]/)[0], isNarrow() ? 22 : 34);
    co.appendChild(t);
    gDetail.appendChild(co);
    // 카메라 — 부품 + 상호작용 상대들을 한 프레임에
    // (폰은 무대가 좁아 여백·배율을 줄여야 콜아웃·이름이 잘리지 않는다)
    const nrw = isNarrow();
    const grow = (b) => ({ x: b.x, y: b.y - 34, w: b.w, h: b.h + 68 });   // 콜아웃·이름 여유
    const ctx = [grow(p.box)].concat(mates.map((k) => grow(detail.parts[k].box)));
    // 폰: 무대가 좁아 확대하면 맥락이 사라진다 — 배율 상한을 1 아래로 묶어 주변까지 보이게
    camFit(ctx, { pad: nrw ? 220 : 150, maxS: nrw ? 0.85 : 2.1, ms: 650 });
    say(`${p.short}. ${truncate(p.role, 60)}${mateNames.length ? ` 함께 작동: ${mateNames.join(', ')}` : ''}`);
  }
  $('.hw-prev').disabled = detail.cur <= 0;
  $('.hw-next').disabled = detail.cur >= detail.steps.length - 1;
}

function exitDetail() {
  if (mode !== 'detail') return;
  detail = null;
  showEgo(centerId, { push: false });
}

/* ============================================================
   입력 라우터 (mode 배타 소유 — 설계 §4.5)
   ============================================================ */
let acc = 0, cooldownUntil = 0;
function onWheel(e) {
  if (mode !== 'detail') return;         // ego 모드는 휠을 소유하지 않음
  e.preventDefault();
  const now = performance.now();
  if (now < cooldownUntil) { acc = 0; return; }
  acc += e.deltaY;
  if (acc > 60) { acc = 0; cooldownUntil = now + 260; gotoStep(detail.cur + 1); }
  else if (acc < -60) { acc = 0; cooldownUntil = now + 260; gotoStep(detail.cur - 1); }
}
function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === '1') return setLevel('beginner');
  if (e.key === '2') return setLevel('standard');
  if (e.key === '3') return setLevel('expert');
  if ((e.key === 'm' || e.key === 'M') && level === 'expert' && mode !== 'map') return showMap();
  if ((e.key === 'd' || e.key === 'D') && mode === 'ego') return enterDetail(centerId);
  if (mode === 'lesson') {
    if (['ArrowRight', 'ArrowDown', ' ', 'Enter'].includes(e.key) && !(e.target && e.target.closest('.hw-node'))) { e.preventDefault(); actions.lnext.click(); }
    else if (['ArrowLeft', 'ArrowUp'].includes(e.key)) { e.preventDefault(); actions.lprev.click(); }
    return;
  }
  if (mode === 'map') { if (e.key === 'Escape') { e.preventDefault(); showEgo(centerId, { push: false }); } return; }
  if (mode === 'detail') {
    if (['ArrowRight', 'ArrowDown', ' ', 'PageDown'].includes(e.key)) { e.preventDefault(); gotoStep(detail.cur + 1); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); gotoStep(detail.cur - 1); }
    else if (e.key === 'Home') { e.preventDefault(); gotoStep(0); }
    else if (e.key === 'End') { e.preventDefault(); gotoStep(detail.steps.length - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); exitDetail(); }
    return;
  }
  // ego: 이웃 순회 + Enter 이동
  if (!ego.length) return;
  if (['ArrowRight', 'ArrowDown'].includes(e.key)) { e.preventDefault(); moveEgoFocus(1); }
  else if (['ArrowLeft', 'ArrowUp'].includes(e.key)) { e.preventDefault(); moveEgoFocus(-1); }
  else if (e.key === 'Enter' && egoFocus >= 0) { e.preventDefault(); recenter(ego[egoFocus].id); }
}
function moveEgoFocus(d) {
  if (egoFocus >= 0) hoverNeighbor(ego[egoFocus], false);
  egoFocus = (egoFocus + d + ego.length) % ego.length;
  const it = ego[egoFocus];
  hoverNeighbor(it, true);
  it.node.el.focus();
}
let touchY = null;
function onTouchStart(e) { touchY = e.touches[0].clientY; }
function onTouchEnd(e) {
  if (mode !== 'detail' || touchY == null) return;
  const dy = touchY - e.changedTouches[0].clientY; touchY = null;
  if (dy > 50) gotoStep(detail.cur + 1); else if (dy < -50) gotoStep(detail.cur - 1);
}

/* ---------- 브레드크럼 ---------- */
function pushCrumb(id) {
  if (crumbs[crumbs.length - 1] === id) return;
  const at = crumbs.indexOf(id);
  if (at >= 0) crumbs = crumbs.slice(0, at + 1);
  else crumbs.push(id);
  try { history.pushState({ hw: id }, '', `?hw=${id}`); } catch (e) { /* file:// */ }
}
function buildCrumbs() {
  clear(crumbNav);
  crumbs.forEach((id, i) => {
    if (i) { const s = document.createElement('span'); s.className = 'hw-crumb-sep'; s.textContent = '›'; crumbNav.appendChild(s); }
    const b = document.createElement('button');
    b.className = 'hw-crumb' + (id === centerId ? ' cur' : '');
    b.textContent = shortName(byId.get(id));
    b.addEventListener('click', () => { if (id !== centerId) { if (mode === 'detail') { detail = null; } recenter(id); } });
    crumbNav.appendChild(b);
  });
}
function say(msg) { if (live) live.textContent = msg; }

/* ---------- 범례 ---------- */
function buildLegend() {
  const ul = $('.hw-legend');
  CAT_ORDER.forEach((c) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="dot" style="background:${catColor(c)}"></span>${c}`;
    ul.appendChild(li);
  });
}

/* ---------- defs (화살표 마커) ---------- */
function addDefs(svg) {
  const defs = svgEl('defs');
  CAT_ORDER.forEach((c, i) => {
    const m = svgEl('marker', { id: `arw-${i}`, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
    m.appendChild(svgEl('path', { d: 'M0,0 L10,5 L0,10 z', fill: catColor(c), 'fill-opacity': 0.85 }));
    defs.appendChild(m);
  });
  svg.appendChild(defs);
}


/* ============================================================
   학습 단계 — 입문 / 표준 / 전문가
   입문: 핵심 6가지 코스(한 화면에 하드웨어 1개·부품 3개·연결 ≤3개, 일상 언어·비유 먼저)
   표준: 관계 지도(관계 글은 호버/포커스에서만 — 초기 밀도 절반)
   전문가: 관계·부품·사양·개념 데이터시트 탭 + 21노드 전체 지도 + 단축키
   ============================================================ */
const LEVEL_KEY = 'cawiki-hw-level';
const LEVELS = ['beginner', 'standard', 'expert'];
const CORE6 = ['cpu', 'dram', 'gpu', 'ssd', 'mainboard', 'power'];   // 누구나 이름은 들어본 여섯
const firstSent = (s) => { const m = String(s || '').match(/^[^.。]*[.。]/); return m ? m[0].trim() : truncate(s, 90); };
const analogyShort = (s) => {
  const t = String(s || '').split(/비유 ?2/)[0].replace(/^비유 ?1\s*[—\-:]\s*/, '').trim();
  return t.length > 230 ? truncate(t, 230) : t;
};
function loadLevel() { try { const v = localStorage.getItem(LEVEL_KEY); return LEVELS.includes(v) ? v : null; } catch (e) { return null; } }
function paintLevel(lv) {
  document.body.classList.remove('lv-beginner', 'lv-standard', 'lv-expert');
  document.body.classList.add('lv-' + lv);
  const seg = $('.hw-levels');
  if (!seg) return;
  seg.style.setProperty('--i', LEVELS.indexOf(lv));
  seg.querySelectorAll('.hw-level').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.level === lv)));
}
function setLevel(lv) {
  if (!LEVELS.includes(lv) || !byId) return;
  const changed = lv !== level;
  level = lv;
  try { localStorage.setItem(LEVEL_KEY, lv); } catch (e) { /* 비공개 모드 */ }
  paintLevel(lv);
  say(`${{ beginner: '입문', standard: '표준', expert: '전문가' }[lv]} 단계.`);
  if (lv === 'beginner') { if (mode !== 'lesson' || changed) showBeginner(); return; }
  if (mode === 'lesson' || mode === 'map') { showEgo(centerId || 'cpu', { push: false }); return; }
  if (mode === 'ego') { setActions('ego'); renderPanelEgo(byId.get(centerId), ego.length, true); }
}
function swapBody(html, animate = true) {
  panel.body.innerHTML = html;
  if (!animate || RM) return;
  panel.body.classList.remove('swap');
  void panel.body.offsetWidth;
  panel.body.classList.add('swap');
}
function stagger(g) {
  if (RM) return;
  [...g.children].forEach((c, i) => {
    c.style.transition = 'none'; c.style.opacity = 0;
    requestAnimationFrame(() => { c.style.transition = `opacity .5s var(--ease) ${Math.min(i, 24) * 35}ms`; c.style.opacity = 1; });
  });
}
function hideStageGroups() { [gEdges, gNodes, gDetail, gLesson, gMap].forEach((g) => { if (g) g.style.display = 'none'; }); }
function setActions(state) {
  const show = (el, on) => { if (el) el.hidden = !on; };
  show(actions.detail, state === 'ego');
  show(actions.map, state === 'ego' && level === 'expert');
  show(actions.back, state === 'detail' || state === 'map' || (state === 'ego' && crumbs.length > 1));
  show(actions.lprev, state === 'lesson' || state === 'done');
  show(actions.lnext, state === 'lesson' || state === 'done' || state === 'beginner-overview');
  if (actions.back) actions.back.textContent = (state === 'detail' || state === 'map') ? '← 관계 지도로' : '← 이전 하드웨어';
  if (actions.lnext) actions.lnext.textContent = state === 'beginner-overview' ? '첫 번째부터 시작 →'
    : state === 'done' ? '표준 모드로 탐험하기 →' : (lesson >= CORE6.length - 1 ? '마무리 →' : '다음 →');
  if (actions.lprev) actions.lprev.textContent = state === 'done' ? '← 다시 보기' : (lesson === 0 ? '← 목록' : '← 이전');
}
function pushCrumbQuiet(id) { try { history.replaceState({ hw: id }, '', `?hw=${id}`); } catch (e) { /* file:// */ } }
function coreMates(id) {
  const adj = adjMap.get(id) || [];
  return CORE6.filter((c) => c !== id).map((c) => adj.find((a) => a.id === c)).filter(Boolean).slice(0, 3);
}

/* ---------- 입문: 코스 개요(6개 그리드) ---------- */
function renderCourseGrid() {
  hideStageGroups(); gLesson.style.display = ''; clear(gLesson);
  const narrow = isNarrow();
  const cols = narrow ? 2 : 3, gx = narrow ? 380 : 390, gy = narrow ? 320 : 310;
  const rows = Math.ceil(CORE6.length / cols);
  const boxes = [];
  CORE6.forEach((id, i) => {
    const n = byId.get(id);
    const c = i % cols, r = Math.floor(i / cols);
    const x = CX + (c - (cols - 1) / 2) * gx, y = CY + (r - (rows - 1) / 2) * gy;
    const v = hwVisual(id, 150, 118);
    const bx = x - v.w / 2, by = y - v.h / 2 - 10;
    const g = svgEl('g', { class: 'hw-node lesson-node' + (lesson === i ? ' hi' : '') });
    g.appendChild(svgEl('rect', { class: 'hitbox', x: bx - 20, y: by - 18, width: v.w + 40, height: v.h + 64, rx: 18, fill: 'transparent', stroke: catColor(n.category) }));
    v.el.setAttribute('transform', `translate(${bx},${by}) scale(${v.s})`);
    g.appendChild(v.el);
    const num = svgEl('text', { class: 'lesson-num', x: bx - 8, y: by - 4 }); num.textContent = String(i + 1);
    const nm = svgEl('text', { class: 'node-name', x, y: by + v.h + 26, 'text-anchor': 'middle' }); nm.textContent = shortName(n);
    g.append(num, nm);
    g.dataset.id = id;
    g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', `${i + 1}. ${shortName(n)} 배우기`);
    g.addEventListener('click', () => startLesson(i));
    gLesson.appendChild(g);
    boxes.push({ x: bx - 20, y: by - 18, w: v.w + 40, h: v.h + 64 });
  });
  stagger(gLesson);
  return camFit(boxes, { pad: narrow ? 56 : 110, maxS: narrow ? 1.1 : 1.35, ms: 700 });
}
function showBeginner() {
  mode = 'lesson'; lesson = -1; busy = false; stepbar.hidden = true;
  const p = renderCourseGrid();
  panel.badge.textContent = '입문 코스'; panel.badge.style.background = 'var(--ink)';
  panel.name.textContent = '컴퓨터는 여섯 부품이 팀으로 움직여요';
  panel.en.textContent = 'Six parts, one machine';
  panel.oneline.textContent = '하나씩 3분이면 충분해요. 어려운 말은 나중에 나와요.';
  swapBody(`<ol class="hw-course">${CORE6.map((id, i) => { const n = byId.get(id);
    return `<li><button class="hw-course-item" data-i="${i}"><span class="hw-course-num" style="background:${catColor(n.category)}">${i + 1}</span><span class="hw-course-txt"><b>${shortName(n)}</b><small>${truncate(n.one_line, 48)}</small></span></button></li>`; }).join('')}</ol>`);
  panel.body.querySelectorAll('.hw-course-item').forEach((b) => b.addEventListener('click', () => startLesson(+b.dataset.i)));
  panel.hint.textContent = '그림을 눌러도 시작돼요. 1·2·3 키로 단계를 바꿀 수 있어요.';
  setActions('beginner-overview');
  pushCrumbQuiet('cpu');
  say('입문 코스. 핵심 하드웨어 여섯 가지.');
  return p;
}

/* ---------- 입문: 레슨 한 장 ---------- */
function startLesson(i) {
  i = Math.max(0, Math.min(CORE6.length - 1, i));
  mode = 'lesson'; lesson = i; stepbar.hidden = true;
  const id = CORE6[i]; centerId = id;
  hideStageGroups(); gLesson.style.display = ''; clear(gLesson);
  const n = byId.get(id), color = catColor(n.category);
  const narrow = isNarrow();
  // 중앙 실물 — 살짝 숨쉬는 할로
  const cv = hwVisual(id, narrow ? 200 : 236, narrow ? 170 : 196);
  const cbox = { x: CX - cv.w / 2, y: CY - cv.h / 2, w: cv.w, h: cv.h };
  const R0 = Math.max(cv.w, cv.h) / 2 + 42;
  gLesson.appendChild(svgEl('circle', { class: 'lesson-halo', cx: CX, cy: CY, r: R0, fill: color, 'fill-opacity': 0.05, stroke: color, 'stroke-opacity': 0.28 }));
  const cg = svgEl('g', { class: 'lesson-center' });
  cv.el.setAttribute('transform', `translate(${cbox.x},${cbox.y}) scale(${cv.s})`);
  cg.appendChild(cv.el);
  gLesson.appendChild(cg);
  const cname = svgEl('text', { class: 'node-name lg', x: CX, y: cbox.y + cv.h + 40, 'text-anchor': 'middle' }); cname.textContent = shortName(n);
  gLesson.appendChild(cname);
  const boxes = [{ x: cbox.x - 46, y: cbox.y - 46, w: cbox.w + 92, h: cbox.h + 120 }];
  // 함께 일하는 핵심 이웃 ≤3 — 화살표만, 글은 패널에
  const mates = coreMates(id);
  const R = narrow ? { x: 250, y: 360 } : { x: 440, y: 240 };
  const angles = narrow ? [-Math.PI / 2, Math.PI / 2, Math.PI] : [Math.PI, 0, Math.PI / 2];
  mates.forEach((m, k) => {
    const a = angles[k], nx = CX + R.x * Math.cos(a), ny = CY + R.y * Math.sin(a);
    const mn = byId.get(m.id), v = hwVisual(m.id, 104, 84);
    const bx = nx - v.w / 2, by = ny - v.h / 2;
    const dx = nx - CX, dy = ny - CY, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    const x1 = CX + ux * (R0 + 6), y1 = CY + uy * (R0 + 6);
    const x2 = nx - ux * (Math.max(v.w, v.h) / 2 + 16), y2 = ny - uy * (Math.max(v.w, v.h) / 2 + 16);
    gLesson.appendChild(svgEl('path', { class: 'edge lesson-edge', d: `M${x1},${y1} L${x2},${y2}`, fill: 'none', stroke: catColor(mn.category), 'marker-end': `url(#arw-${catIdx(mn.category)})` }));
    const g = svgEl('g', { class: 'hw-node lesson-mate' });
    g.appendChild(svgEl('rect', { class: 'hitbox', x: bx - 14, y: by - 12, width: v.w + 28, height: v.h + 44, rx: 12, fill: 'transparent', stroke: catColor(mn.category) }));
    v.el.setAttribute('transform', `translate(${bx},${by}) scale(${v.s})`); g.appendChild(v.el);
    const nm = svgEl('text', { class: 'node-name sm', x: nx, y: by + v.h + 18, 'text-anchor': 'middle' }); nm.textContent = shortName(mn); g.appendChild(nm);
    g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', `${shortName(mn)} 배우기`);
    g.addEventListener('click', () => startLesson(CORE6.indexOf(m.id)));
    gLesson.appendChild(g);
    boxes.push({ x: bx - 14, y: by - 12, w: v.w + 28, h: v.h + 44 });
  });
  stagger(gLesson);
  // 패널 — 일상 언어: 한 줄 → 비유 → 부품 3 → 함께 일하는 것
  panel.badge.textContent = n.category; panel.badge.style.background = color;
  panel.name.textContent = shortName(n); panel.en.textContent = n.name_en || '';
  panel.oneline.textContent = n.one_line || '';
  const parts = (n.parts || []).slice(0, 3), an = analogyShort(n.analogy);
  swapBody(`<p class="hw-eyebrow">입문 · ${i + 1} / ${CORE6.length}</p>
    ${an ? `<section class="hw-sec"><h3>비유하자면</h3><p class="hw-quote">${an}</p></section>` : ''}
    <section class="hw-sec"><h3>안에 든 핵심 부품 3가지</h3><ul class="hw-list">${parts.map((p) => `<li><b>${shortPart(p.part)}</b><span>${firstSent(p.role)}</span></li>`).join('')}</ul></section>
    ${mates.length ? `<section class="hw-sec"><h3>함께 일하는 것</h3><ul class="hw-list">${mates.map((m) => `<li><button class="hw-linkbtn" data-id="${m.id}"><i class="dot" style="background:${catColor(byId.get(m.id).category)}"></i><b>${shortName(byId.get(m.id))}</b></button><span>${firstSent(m.reason)}</span></li>`).join('')}</ul></section>` : ''}`);
  panel.body.querySelectorAll('.hw-linkbtn').forEach((b) => b.addEventListener('click', () => startLesson(CORE6.indexOf(b.dataset.id))));
  panel.hint.textContent = '←/→ 키로도 넘길 수 있어요.';
  setActions('lesson');
  pushCrumbQuiet(id);
  say(`${i + 1}단계. ${shortName(n)}. ${n.one_line}`);
  return camFit(boxes, { pad: narrow ? 50 : 100, maxS: narrow ? 1.15 : 1.5, ms: 800 });
}
function finishCourse() {
  lesson = CORE6.length; mode = 'lesson';
  renderCourseGrid();
  panel.badge.textContent = '입문 완료'; panel.badge.style.background = 'var(--ink)';
  panel.name.textContent = '여섯 가지를 다 봤어요';
  panel.en.textContent = 'You made it';
  panel.oneline.textContent = '이제 컴퓨터가 어떤 팀으로 움직이는지 알게 됐어요.';
  swapBody(`<section class="hw-sec"><h3>다음은</h3><p class="hw-sub">표준 모드에서는 21가지 하드웨어와 115개의 관계를 자유롭게 오갈 수 있어요. 궁금한 것을 클릭하면 그것이 중앙으로 옵니다.</p></section>
    <section class="hw-sec"><h3>더 알아보고 싶다면</h3><ul class="hw-list">${['display', 'nic', 'cooling'].map((id) => { const n = byId.get(id); return `<li><b>${shortName(n)}</b><span>${truncate(n.one_line, 60)}</span></li>`; }).join('')}</ul></section>`);
  panel.hint.textContent = '';
  setActions('done');
  say('입문 코스 완료.');
}

/* ---------- 전문가: 데이터시트 패널 ---------- */
function renderPanelExpert(node, animate = false) {
  panel.badge.textContent = node.category; panel.badge.style.background = catColor(node.category);
  panel.name.textContent = shortName(node); panel.en.textContent = node.name_en || '';
  panel.oneline.textContent = node.one_line || '';
  const nbrs = adjMap.get(node.id) || [], parts = node.parts || [];
  const tabs = [['overview', '개요'], ['rel', `관계 ${nbrs.length}`], ['parts', `부품 ${parts.length}`], ['specs', '사양'], ['concepts', '개념']];
  let body = '';
  if (expertTab === 'overview') {
    body = `<p class="role">${node.role}</p>
      <dl class="hw-kv"><dt>연결 차수</dt><dd>${node.degree}</dd><dt>부품</dt><dd>${parts.length}</dd><dt>부품 상호작용 배선</dt><dd>${(node.part_links || []).length}</dd><dt>핵심 개념</dt><dd>${(node.key_concepts || []).length}</dd></dl>
      <p class="hw-kbd">단축키 — <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 단계 · <kbd>M</kbd> 전체 지도 · <kbd>←</kbd><kbd>→</kbd> 이웃 · <kbd>Enter</kbd> 이동 · <kbd>D</kbd> 부품 투어 · <kbd>Esc</kbd> 뒤로</p>`;
  } else if (expertTab === 'rel') {
    body = `<ul class="hw-rel">${nbrs.map((a) => { const n = byId.get(a.id); return `<li><button class="hw-linkbtn" data-id="${a.id}"><i class="dot" style="background:${catColor(n.category)}"></i><b>${shortName(n)}</b><small>${n.category}</small></button><span>${a.reason}</span></li>`; }).join('')}</ul>`;
  } else if (expertTab === 'parts') {
    body = `<ol class="hw-parts">${parts.map((p, i) => `<li><button class="hw-linkbtn" data-part="${i}"><b>${p.part}</b></button><span>${p.role}</span></li>`).join('')}</ol>`;
  } else if (expertTab === 'specs') {
    body = (node.specs && node.specs.length)
      ? `<table class="hw-spec">${node.specs.map((s) => `<tr><th>${s.metric || ''}</th><td>${s.value || ''}${s.note ? `<small>${s.note}</small>` : ''}</td></tr>`).join('')}</table>`
      : '<p class="hw-sub">사양 데이터가 없습니다.</p>';
  } else {
    body = `<dl class="hw-concepts">${(node.key_concepts || []).map((c) => `<dt>${c.term}</dt><dd>${c.explanation}</dd>`).join('')}</dl>`;
  }
  swapBody(`<div class="hw-tabs" role="tablist">${tabs.map(([k, t]) => `<button class="hw-tab${k === expertTab ? ' on' : ''}" data-tab="${k}" role="tab" aria-selected="${k === expertTab}">${t}</button>`).join('')}</div><div class="hw-tabpane">${body}</div>`, animate);
  panel.body.querySelectorAll('.hw-tab').forEach((b) => b.addEventListener('click', () => { expertTab = b.dataset.tab; renderPanelExpert(node, true); }));
  panel.body.querySelectorAll('.hw-linkbtn[data-id]').forEach((b) => b.addEventListener('click', () => recenter(b.dataset.id)));
  panel.body.querySelectorAll('.hw-linkbtn[data-part]').forEach((b) => b.addEventListener('click', () => { enterDetail(node.id); gotoStep(+b.dataset.part + 1); }));
  panel.detailBtn.textContent = `부품 투어 (${parts.length}) →`;
  panel.hint.textContent = '';
}

/* ---------- 전문가: 전체 지도(21노드·115관계, 카테고리 클러스터) ---------- */
function showMap() {
  if (!graph) return;
  mode = 'map'; stepbar.hidden = true;
  hideStageGroups(); gMap.style.display = ''; clear(gMap);
  setActions('map');
  const narrow = isNarrow();
  const cols = narrow ? 2 : 3, gx = narrow ? 400 : 430, gy = narrow ? 330 : 350;
  const rows = Math.ceil(CAT_ORDER.length / cols);
  const pos = new Map();
  const gP = svgEl('g', { class: 'g-map-plates' }), gE = svgEl('g', { class: 'g-map-edges' }), gN = svgEl('g', { class: 'g-map-nodes' });
  gMap.append(gP, gE, gN);
  const boxes = [];
  CAT_ORDER.forEach((cat, ci) => {
    const c = ci % cols, r = Math.floor(ci / cols);
    const cx = CX + (c - (cols - 1) / 2) * gx, cy = CY + (r - (rows - 1) / 2) * gy;
    const members = graph.nodes.filter((n) => n.category === cat);
    const rr = members.length > 3 ? 104 : 88;
    // 카테고리 '섬' — 은은한 색 플레이트로 클러스터를 한 덩어리로 읽히게 (애플식 그룹화)
    gP.appendChild(svgEl('rect', { class: 'map-plate', x: cx - rr - 96, y: cy - rr * 0.74 - 92, width: rr * 2 + 192, height: rr * 1.48 + 176, rx: 30, fill: catColor(cat), stroke: catColor(cat) }));
    const lab = svgEl('text', { class: 'map-cat', x: cx, y: cy - rr * 0.74 - 62, 'text-anchor': 'middle', fill: catColor(cat) }); lab.textContent = cat;
    gP.appendChild(lab);
    members.forEach((n, k) => {
      const a = -Math.PI / 2 + 2 * Math.PI * k / members.length;
      pos.set(n.id, { x: cx + rr * Math.cos(a), y: cy + rr * 0.74 * Math.sin(a) });
    });
  });
  graph.edges.forEach((e) => {
    const a = pos.get(e.a), b = pos.get(e.b);
    gE.appendChild(svgEl('line', { class: 'map-edge', 'data-a': e.a, 'data-b': e.b, x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#9AA6B2' }));
  });
  graph.nodes.forEach((n) => {
    const p = pos.get(n.id), v = hwVisual(n.id, 82, 66);
    const g = svgEl('g', { class: 'hw-node map-node' + (n.id === centerId ? ' cur' : '') });
    const bx = p.x - v.w / 2, by = p.y - v.h / 2;
    g.appendChild(svgEl('rect', { class: 'hitbox', x: bx - 10, y: by - 8, width: v.w + 20, height: v.h + 34, rx: 10, fill: 'transparent', stroke: catColor(n.category) }));
    v.el.setAttribute('transform', `translate(${bx},${by}) scale(${v.s})`); g.appendChild(v.el);
    const nm = svgEl('text', { class: 'node-name xs', x: p.x, y: by + v.h + 17, 'text-anchor': 'middle' }); nm.textContent = shortName(n); g.appendChild(nm);
    g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', `${shortName(n)}. 연관 ${n.degree}개. 중앙으로 이동`);
    const on = () => { gE.querySelectorAll('.map-edge').forEach((l) => l.classList.toggle('hi', l.dataset.a === n.id || l.dataset.b === n.id)); g.classList.add('hi'); };
    const off = () => { gE.querySelectorAll('.map-edge.hi').forEach((l) => l.classList.remove('hi')); g.classList.remove('hi'); };
    g.addEventListener('mouseenter', on); g.addEventListener('mouseleave', off); g.addEventListener('focus', on); g.addEventListener('blur', off);
    g.addEventListener('click', () => { pushCrumb(n.id); showEgo(n.id, { push: false }); });
    gN.appendChild(g);
    boxes.push({ x: bx - 10, y: by - 8, w: v.w + 20, h: v.h + 34 });
  });
  stagger(gN);
  panel.badge.textContent = '전문가'; panel.badge.style.background = 'var(--ink)';
  panel.name.textContent = '전체 지도'; panel.en.textContent = `${graph.nodes.length} nodes · ${graph.edges.length} edges`;
  panel.oneline.textContent = '카테고리로 묶은 21개 하드웨어와 115개 관계. 노드에 올리면 그 관계만 밝아지고, 클릭하면 중앙으로 갑니다.';
  const ranked = [...graph.nodes].sort((a, b) => b.degree - a.degree);
  swapBody(`<section class="hw-sec"><h3>연결 차수 순</h3><ol class="hw-rank">${ranked.map((n) => `<li><button class="hw-linkbtn" data-id="${n.id}"><i class="dot" style="background:${catColor(n.category)}"></i><b>${shortName(n)}</b></button><span class="hw-deg">${n.degree}</span></li>`).join('')}</ol></section>`);
  panel.body.querySelectorAll('.hw-linkbtn').forEach((b) => b.addEventListener('click', () => { pushCrumb(b.dataset.id); showEgo(b.dataset.id, { push: false }); }));
  panel.hint.textContent = 'Esc 로 관계 지도로 돌아갑니다.';
  say('전체 지도. 21개 하드웨어, 115개 관계.');
  return camFit(boxes, { pad: narrow ? 30 : 60, maxS: narrow ? 1.0 : 1.3, ms: 800 });
}

/* ---------- 첫 방문 환영 시트 ---------- */
function initWelcome() {
  const w = $('.hw-welcome'); if (!w) return;
  if (loadLevel()) { w.hidden = true; return; }
  w.hidden = false; requestAnimationFrame(() => w.classList.add('in'));
  const close = () => { w.classList.remove('in'); setTimeout(() => { w.hidden = true; }, RM ? 0 : 320); };
  w.querySelectorAll('.hw-choice').forEach((b) => b.addEventListener('click', () => { setLevel(b.dataset.level); close(); }));
  const x = w.querySelector('.hw-welcome-close'); if (x) x.addEventListener('click', () => { setLevel('standard'); close(); });
}

/* ============================================================
   부트스트랩
   ============================================================ */
async function main() {
  const svg = document.getElementById('stage');
  svg.setAttribute('tabindex', '0');
  stage = await createStageAsync(svg, { vw: VW, vh: VH });
  addDefs(svg);
  gEdges = svgEl('g', { class: 'g-edges' });
  gNodes = svgEl('g', { class: 'g-nodes' });
  gDetail = svgEl('g', { class: 'g-detail' });
  gLesson = svgEl('g', { class: 'g-lesson' });
  gMap = svgEl('g', { class: 'g-map' });
  stage.world.append(gEdges, gNodes, gDetail, gLesson, gMap);

  graph = await fetch('./data/hardware-graph.json').then((r) => r.json());
  byId = new Map(graph.nodes.map((n) => [n.id, n]));
  adjMap = new Map(graph.nodes.map((n) => [n.id, []]));
  graph.edges.forEach((e) => {
    adjMap.get(e.a).push({ id: e.b, reason: e.reason_ab });
    adjMap.get(e.b).push({ id: e.a, reason: e.reason_ba });
  });

  buildLegend();
  panel.detailBtn.addEventListener('click', () => enterDetail(centerId));
  panel.backBtn.addEventListener('click', () => {
    if (mode === 'detail') exitDetail();
    else if (mode === 'map') showEgo(centerId, { push: false });
    else if (crumbs.length > 1) recenter(crumbs[crumbs.length - 2]);
  });
  actions.map.addEventListener('click', () => showMap());
  actions.lnext.addEventListener('click', () => {
    if (lesson < 0) startLesson(0);
    else if (lesson < CORE6.length - 1) startLesson(lesson + 1);
    else if (lesson === CORE6.length - 1) finishCourse();
    else setLevel('standard');
  });
  actions.lprev.addEventListener('click', () => {
    if (lesson >= CORE6.length) startLesson(CORE6.length - 1);
    else if (lesson > 0) startLesson(lesson - 1);
    else showBeginner();
  });
  document.querySelectorAll('.hw-level').forEach((b) => b.addEventListener('click', () => setLevel(b.dataset.level)));
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchend', onTouchEnd);
  // 화면 회전·크기 변경 → 좁은/넓은 배치가 바뀌면 현재 뷰를 다시 그린다
  let wasNarrow = isNarrow(), rzT = null;
  document.body.classList.toggle('narrow-stage', wasNarrow);
  window.addEventListener('resize', () => {
    clearTimeout(rzT);
    rzT = setTimeout(() => {
      const now = isNarrow();
      if (now === wasNarrow) return;
      wasNarrow = now;
      document.body.classList.toggle('narrow-stage', now);
      if (mode === 'detail' && detail) { const id = detail.node.id, at = detail.cur; enterDetail(id); gotoStep(at); }
      else if (mode === 'lesson') { lesson < 0 || lesson >= CORE6.length ? showBeginner() : startLesson(lesson); }
      else if (mode === 'map') showMap();
      else showEgo(centerId, { instant: true, push: false });
    }, 220);
  });
  window.addEventListener('popstate', (e) => {
    const id = (e.state && e.state.hw) || 'cpu';
    if (!byId.has(id)) return;
    if (level === 'beginner') { const k = CORE6.indexOf(id); k >= 0 ? startLesson(k) : showBeginner(); return; }
    crumbs = crumbs.slice(0, Math.max(1, crumbs.indexOf(id) + 1)); if (mode === 'detail') detail = null; showEgo(id, { push: false });
  });

  const start = new URLSearchParams(location.search).get('hw') || 'cpu';
  const id = byId.has(start) ? start : 'cpu';
  crumbs = [id]; centerId = id;
  level = loadLevel() || 'standard';
  paintLevel(level);
  if (level === 'beginner') showBeginner(); else showEgo(id, { instant: true, push: false });
  initWelcome();

  window.hwapp = { showEgo, enterDetail, setLevel, showMap, startLesson, get mode() { return mode; }, get center() { return centerId; }, get level() { return level; }, get lesson() { return lesson; } }; // 디버그
}
main();
