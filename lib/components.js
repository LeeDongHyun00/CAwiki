/* ============================================================
   CAwiki — 하드웨어 컴포넌트 라이브러리
   모든 컴포넌트는 팩토리 함수: Comp(x, y, opts) → 컴포넌트 객체
   { el, x, y, w, h, a(anchor) }  — a('L'|'R'|'T'|'B'|'C') = 연결점 좌표
   어떤 아키텍처 페이지에서든 좌표만 주고 조립해 재사용한다.
   ============================================================ */
const NS = 'http://www.w3.org/2000/svg';

export const C = {
  compute: '#7DA8F5', memory: '#B08EF0', storage: '#E0AC4E',
  io: '#EF8AA3', net: '#62C795', power: '#96A4B3', accent: '#E09A5F',
};

/* ---------- SVG 생성 헬퍼 ---------- */
export function el(tag, attrs = {}, children = []) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) {
    if (attrs[k] == null) continue;
    if (k === 'text') n.textContent = attrs[k];
    else n.setAttribute(k, attrs[k]);
  }
  children.forEach((c) => n.appendChild(c));
  return n;
}
const txt = (x, y, s, attrs = {}) => el('text', { x, y, text: s, ...attrs });

/* ---------- 컴포넌트 베이스 ---------- */
function base(x, y, w, h, body, label, opts = {}) {
  const g = el('g', { class: 'comp' });
  const bodyG = el('g', { class: 'body' });
  body.forEach((b) => bodyG.appendChild(b));
  g.appendChild(bodyG);
  if (label) {
    g.appendChild(txt(x + w / 2, y + h + (opts.labelDy ?? 20), label, {
      class: 'clabel', 'text-anchor': 'middle',
    }));
  }
  return {
    el: g, x, y, w, h,
    a(p) {
      switch (p) {
        case 'L': return [x, y + h / 2];
        case 'R': return [x + w, y + h / 2];
        case 'T': return [x + w / 2, y];
        case 'B': return [x + w / 2, y + h];
        default:  return [x + w / 2, y + h / 2];
      }
    },
  };
}

/* ---------- 범용 노드 (어떤 아키텍처 구성 요소든 표현) ---------- */
export function Node(x, y, w, h, { label = '', sub = '', color = C.power, dashed = false } = {}) {
  const body = [
    el('rect', {
      x, y, width: w, height: h, rx: 10, fill: '#1D2733',
      stroke: color, 'stroke-width': 1.5,
      'stroke-dasharray': dashed ? '5 5' : null, 'stroke-opacity': 0.75,
    }),
    txt(x + w / 2, y + h / 2 - (sub ? 4 : -5), label, {
      'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, class: 'nlabel',
    }),
  ];
  if (sub) body.push(txt(x + w / 2, y + h / 2 + 16, sub, {
    'text-anchor': 'middle', 'font-size': 10.5, fill: '#97A0AB', class: 'mn',
  }));
  return base(x, y, w, h, body, null);
}

/* ---------- 기판 / 보드 ---------- */
export function Board(x, y, w, h) {
  const body = [el('rect', { x, y, width: w, height: h, rx: 18, class: 'boardbase' })];
  [[x + 22, y + 22], [x + w - 22, y + 22], [x + 22, y + h - 22], [x + w - 22, y + h - 22]]
    .forEach(([cx, cy]) => body.push(el('circle', { cx, cy, r: 5, class: 'hole' })));
  return base(x, y, w, h, body, null);
}

/* ---------- CPU ---------- */
export function CPU(x, y, { size = 160, label = 'CPU', cores = 8 } = {}) {
  const s = size / 160; // 내부 배치는 160 기준으로 스케일
  const body = [
    el('rect', { x, y, width: size, height: size, rx: 10, fill: '#1D2733', stroke: '#566A80', 'stroke-width': 1.6 }),
    el('rect', { x: x + 30 * s, y: y + 30 * s, width: 100 * s, height: 100 * s, rx: 5, fill: '#232F3D', stroke: '#64788F', 'stroke-width': 1.4 }),
  ];
  const cols = 4, cw = 18 * s, gap = 6 * s;
  for (let i = 0; i < Math.min(cores, 8); i++) {
    const cx = x + 36 * s + (i % cols) * (cw + gap);
    const cy = y + 38 * s + Math.floor(i / cols) * (cw + gap);
    body.push(el('rect', { x: cx, y: cy, width: cw, height: cw, rx: 2.5, fill: '#3A4C6488', stroke: '#5B84C4', 'stroke-width': 1 }));
  }
  body.push(el('rect', { x: x + 36 * s, y: y + 88 * s, width: 90 * s, height: 14 * s, rx: 3, fill: '#4A3A7066', stroke: '#8F76CB', 'stroke-width': 1 }));
  body.push(txt(x + 81 * s, y + 98.5 * s, 'CACHE', { 'text-anchor': 'middle', 'font-size': 8.5 * s, fill: '#A78FDD', class: 'mn' }));
  body.push(txt(x + 81 * s, y + 118 * s, 'IMC · PCIe', { 'text-anchor': 'middle', 'font-size': 8.5 * s, fill: '#5C6774', class: 'mn' }));
  return base(x, y, size, size, body, label);
}

/* ---------- GPU (VRAM + 디스플레이 엔진 포함 패키지) ---------- */
export function GPU(x, y, { w = 180, h = 140, label = 'GPU', vram = true, engine = true } = {}) {
  const body = [
    el('rect', { x, y, width: w, height: h, rx: 10, fill: '#1D2733', stroke: '#566A80', 'stroke-width': 1.6 }),
    el('rect', { x: x + 55, y: y + 30, width: 70, height: 62, rx: 5, fill: '#232F3D', stroke: '#64788F', 'stroke-width': 1.4 }),
    el('rect', { x: x + 61, y: y + 36, width: 58, height: 38, rx: 3, fill: '#3A4C6466', stroke: '#5B84C4', 'stroke-width': 0.9 }),
    txt(x + 90, y + 58, '셰이더 ×1000s', { 'text-anchor': 'middle', 'font-size': 8.5, fill: '#7DA8F5', class: 'mn' }),
  ];
  if (vram) {
    body.push(el('rect', { x: x + 14, y: y + 38, width: 28, height: 50, rx: 3, fill: '#251D36', stroke: '#8F76CB', 'stroke-width': 1.1 }));
    body.push(el('rect', { x: x + w - 42, y: y + 38, width: 28, height: 50, rx: 3, fill: '#251D36', stroke: '#8F76CB', 'stroke-width': 1.1 }));
    body.push(txt(x + 28, y + 102, 'VRAM', { 'text-anchor': 'middle', 'font-size': 8, fill: '#A78FDD', class: 'mn' }));
    body.push(txt(x + w - 28, y + 102, 'VRAM', { 'text-anchor': 'middle', 'font-size': 8, fill: '#A78FDD', class: 'mn' }));
  }
  if (engine) {
    body.push(el('rect', { x: x + 20, y: y + h - 30, width: w - 40, height: 16, rx: 3, fill: '#3A2A3155', stroke: '#C4738D', 'stroke-width': 1 }));
    body.push(txt(x + w / 2, y + h - 18.5, '디스플레이 엔진 (스캔아웃)', { 'text-anchor': 'middle', 'font-size': 8.5, fill: '#EF8AA3', class: 'mn' }));
  }
  return base(x, y, w, h, body, label);
}

/* ---------- RAM ---------- */
export function RAM(x, y, { h = 260, sticks = 2, label = 'RAM (DDR5)', labelDy = 22 } = {}) {
  const body = [];
  const stickW = 22, gap = 13;
  for (let sI = 0; sI < sticks; sI++) {
    const sx = x + sI * (stickW + gap);
    body.push(el('rect', { x: sx, y, width: stickW, height: h, rx: 3, fill: '#1D2733', stroke: '#6A5A94', 'stroke-width': 1.4 }));
    const chipH = 44, n = Math.floor((h - 40) / (chipH + 16));
    for (let i = 0; i < n; i++) {
      body.push(el('rect', { x: sx + 4, y: y + 15 + i * (chipH + 16), width: stickW - 8, height: chipH, rx: 2, fill: '#4A3A7077' }));
    }
    body.push(el('rect', { x: sx, y: y + h - 10, width: stickW, height: 7, fill: '#7A6A44' }));
  }
  const w = sticks * stickW + (sticks - 1) * gap;
  return base(x, y, w, h, body, label, { labelDy });
}

/* ---------- SSD (detail: 컨트롤러·FTL·NAND 강조) ---------- */
export function SSD(x, y, { w = 200, detail = false, label = 'NVMe SSD' } = {}) {
  const h = detail ? 110 : 44;
  const body = [el('rect', { x, y, width: w, height: h, rx: 6, fill: '#1D2733', stroke: '#8A7442', 'stroke-width': 1.5 })];
  if (detail) {
    body.push(el('rect', { x: x + 14, y: y + 16, width: 62, height: 38, rx: 4, fill: '#3A3220', stroke: '#B99B55', 'stroke-width': 1.1 }));
    body.push(txt(x + 45, y + 33, '컨트롤러', { 'text-anchor': 'middle', 'font-size': 9.5, fill: '#D2B36B' }));
    body.push(txt(x + 45, y + 47, 'FTL 매핑', { 'text-anchor': 'middle', 'font-size': 8.5, fill: '#8A7440', class: 'mn' }));
    body.push(el('rect', { x: x + 90, y: y + 16, width: 46, height: 38, rx: 3, fill: '#2E2818', stroke: '#8A7442', 'stroke-width': 1 }));
    body.push(el('rect', { x: x + 144, y: y + 16, width: 46, height: 38, rx: 3, fill: '#2E2818', stroke: '#8A7442', 'stroke-width': 1 }));
    body.push(txt(x + 113, y + 39, 'NAND', { 'text-anchor': 'middle', 'font-size': 8.5, fill: '#8A7440', class: 'mn' }));
    body.push(txt(x + 167, y + 39, 'NAND', { 'text-anchor': 'middle', 'font-size': 8.5, fill: '#8A7440', class: 'mn' }));
    body.push(txt(x + w / 2, y + 84, '응답 수십 µs · 움직이는 부품 없음', { 'text-anchor': 'middle', 'font-size': 9.5, fill: '#97A0AB', class: 'mn' }));
  } else {
    body.push(el('rect', { x: x + 15, y: y + 10, width: 28, height: 24, rx: 3, fill: '#3A3220', stroke: '#B99B55', 'stroke-width': 1 }));
    body.push(el('rect', { x: x + 57, y: y + 10, width: 52, height: 24, rx: 3, fill: '#2E2818', stroke: '#8A7442', 'stroke-width': 1 }));
    body.push(el('rect', { x: x + 117, y: y + 10, width: 52, height: 24, rx: 3, fill: '#2E2818', stroke: '#8A7442', 'stroke-width': 1 }));
    body.push(txt(x + 83, y + 26, 'NAND', { 'text-anchor': 'middle', 'font-size': 8.5, fill: '#8A7440', class: 'mn' }));
    body.push(txt(x + 143, y + 26, 'NAND', { 'text-anchor': 'middle', 'font-size': 8.5, fill: '#8A7440', class: 'mn' }));
    body.push(el('rect', { x: x + w - 16, y: y + 8, width: 11, height: 28, rx: 2, fill: '#7A6A44' }));
  }
  return base(x, y, w, h, body, label);
}

/* ---------- HDD ---------- */
export function HDD(x, y, { label = 'HDD' } = {}) {
  const w = 130, h = 130, cx = x + 65, cy = y + 58;
  const body = [
    el('rect', { x, y, width: w, height: h, rx: 10, fill: '#1D2836', stroke: '#8A7442', 'stroke-width': 1.5 }),
    el('circle', { cx, cy, r: 40, fill: '#232F3D', stroke: '#55667A', 'stroke-width': 1.2 }),
    el('circle', { cx, cy, r: 26, fill: 'none', stroke: '#3A4653', 'stroke-width': 0.8 }),
    el('circle', { cx, cy, r: 6, fill: '#4E5D6D' }),
    el('circle', { cx: x + 22, cy: y + 110, r: 5, fill: '#4E5D6D' }),
    el('line', { x1: x + 22, y1: y + 110, x2: cx - 9, y2: cy + 12, stroke: '#5E6D7C', 'stroke-width': 3.5, 'stroke-linecap': 'round' }),
  ];
  return base(x, y, w, h, body, label);
}

/* ---------- 칩셋 ---------- */
export function Chipset(x, y, { label = '칩셋 (PCH)' } = {}) {
  const body = [
    el('rect', { x, y, width: 80, height: 70, rx: 8, fill: '#1D2733', stroke: '#566A80', 'stroke-width': 1.4 }),
    el('rect', { x: x + 20, y: y + 20, width: 40, height: 30, rx: 4, fill: '#263241', stroke: '#55667A', 'stroke-width': 1 }),
  ];
  return base(x, y, 80, 70, body, label);
}

/* ---------- SPI 플래시 (UEFI) ---------- */
export function SPIFlash(x, y, { label = 'SPI 플래시' } = {}) {
  const body = [
    el('rect', { x, y, width: 32, height: 32, rx: 4, fill: '#202B37', stroke: '#8A7442', 'stroke-width': 1.3 }),
    txt(x + 16, y + 20, 'UEFI', { 'text-anchor': 'middle', 'font-size': 8.5, fill: '#B99B55', class: 'mn' }),
  ];
  return base(x, y, 32, 32, body, label);
}

/* ---------- PSU ---------- */
export function PSU(x, y, { label = 'PSU' } = {}) {
  const w = 130, h = 130, cx = x + 65, cy = y + 65;
  const body = [
    el('rect', { x, y, width: w, height: h, rx: 10, fill: '#1D2836', stroke: '#5E6D7C', 'stroke-width': 1.5 }),
    el('circle', { cx, cy, r: 34, fill: '#0D1218', stroke: '#55667A', 'stroke-width': 1.3 }),
    el('circle', { cx, cy, r: 8, fill: '#202B37', stroke: '#4E5D6D', 'stroke-width': 1 }),
    el('path', { d: `M${cx},${cy - 32} A32,32 0 0 1 ${cx + 28},${cy - 15}`, fill: 'none', stroke: '#3A4653', 'stroke-width': 2 }),
    el('path', { d: `M${cx + 28},${cy + 15} A32,32 0 0 1 ${cx},${cy + 32}`, fill: 'none', stroke: '#3A4653', 'stroke-width': 2 }),
    el('path', { d: `M${cx - 28},${cy + 15} A32,32 0 0 1 ${cx - 28},${cy - 15}`, fill: 'none', stroke: '#3A4653', 'stroke-width': 2 }),
    txt(cx, y + h - 12, 'AC → DC 12·5·3.3V', { 'text-anchor': 'middle', 'font-size': 8.5, fill: '#97A0AB', class: 'mn' }),
  ];
  return base(x, y, w, h, body, label);
}

/* ---------- 모니터 ----------
   screen  : 화면(베젤 안쪽) 사각형 — 리빌 애니메이션의 시작 프레임이 된다.
   screenG : 화면 안에 무언가를 그려 넣을 때 쓰는 그룹 (화면 밖으로 넘치지 않게 클립됨). */
let uid = 0;
export function Monitor(x, y, { w = 180, h = 130, label = '모니터', dots = true } = {}) {
  const sx = x + 8, sy = y + 8, sw = w - 16, sh = h - 24;
  const cid = `mscr${++uid}`;
  const clip = el('clipPath', { id: cid }, [el('rect', { x: sx, y: sy, width: sw, height: sh, rx: 4 })]);
  const screenG = el('g', { 'clip-path': `url(#${cid})`, class: 'screen-content' });

  const body = [
    clip,
    el('rect', { x, y, width: w, height: h, rx: 9, fill: '#1D2733', stroke: '#5E6D7C', 'stroke-width': 1.5 }),
    el('rect', { x: sx, y: sy, width: sw, height: sh, rx: 4, fill: '#151E29' }),
  ];
  if (dots) {
    body.push(
      el('circle', { cx: x + w * 0.28, cy: y + h * 0.32, r: 2.5, fill: '#EF8AA366' }),
      el('circle', { cx: x + w * 0.45, cy: y + h * 0.55, r: 2, fill: '#7DA8F555' }),
      el('circle', { cx: x + w * 0.66, cy: y + h * 0.38, r: 2, fill: '#62C79555' }),
    );
  }
  body.push(
    screenG,
    el('rect', { x: x + w / 2 - 10, y: y + h, width: 20, height: 14, fill: '#202B37' }),
    el('rect', { x: x + w / 2 - 34, y: y + h + 14, width: 68, height: 8, rx: 4, fill: '#202B37', stroke: '#3A4653', 'stroke-width': 1 }),
  );
  const c = base(x, y, w, h + 22, body, label, { labelDy: 18 });
  c.screen = { x: sx, y: sy, w: sw, h: sh, cx: sx + sw / 2, cy: sy + sh / 2 };
  c.screenG = screenG;
  return c;
}

/* ---------- 스피커 ---------- */
export function Speaker(x, y, { w = 120, h = 100, label = '스피커' } = {}) {
  const body = [
    el('rect', { x, y, width: w, height: h, rx: 10, fill: '#1D2733', stroke: '#5E6D7C', 'stroke-width': 1.4 }),
    el('circle', { cx: x + w / 2, cy: y + h * 0.62, r: Math.min(w, h) * 0.24, fill: '#0D1218', stroke: '#55667A', 'stroke-width': 1.3 }),
    el('circle', { cx: x + w / 2, cy: y + h * 0.62, r: Math.min(w, h) * 0.09, fill: '#202B37' }),
    el('circle', { cx: x + w / 2, cy: y + h * 0.26, r: Math.min(w, h) * 0.1, fill: '#0D1218', stroke: '#55667A', 'stroke-width': 1.2 }),
  ];
  return base(x, y, w, h, body, label);
}

/* ---------- 웹캠 ---------- */
export function Webcam(x, y, { w = 46, h = 34, label = '웹캠' } = {}) {
  const body = [
    el('rect', { x, y, width: w, height: h, rx: 9, fill: '#1D2733', stroke: '#5E6D7C', 'stroke-width': 1.4 }),
    el('circle', { cx: x + w / 2, cy: y + h / 2, r: 9, fill: '#0D1218', stroke: '#55667A', 'stroke-width': 1.2 }),
    el('circle', { cx: x + w / 2, cy: y + h / 2, r: 3.5, fill: '#4A5F82AA' }),
  ];
  return base(x, y, w, h, body, label);
}

/* ---------- 키보드 ---------- */
export function Keyboard(x, y, { label = '키보드' } = {}) {
  const w = 167, h = 64;
  const body = [el('rect', { x, y, width: w, height: h, rx: 9, fill: '#1D2733', stroke: '#5E6D7C', 'stroke-width': 1.4 })];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) {
    body.push(el('rect', { x: x + 13 + c * 19, y: y + 10 + r * 14, width: 12, height: 8, rx: 2, fill: '#303C48' }));
  }
  body.push(el('rect', { x: x + 43, y: y + 50, width: 80, height: 6, rx: 2, fill: '#303C48' }));
  return base(x, y, w, h, body, label);
}

/* ---------- 마우스 ---------- */
export function Mouse(x, y, { label = '마우스' } = {}) {
  const w = 45, h = 66;
  const body = [
    el('rect', { x, y, width: w, height: h, rx: 22, fill: '#1D2733', stroke: '#5E6D7C', 'stroke-width': 1.4 }),
    el('line', { x1: x + w / 2, y1: y, x2: x + w / 2, y2: y + 26, stroke: '#3A4653', 'stroke-width': 1.5 }),
    el('rect', { x: x + w / 2 - 3.5, y: y + 10, width: 7, height: 12, rx: 3.5, fill: '#303C48' }),
  ];
  return base(x, y, w, h, body, label);
}

/* ---------- 공유기 ---------- */
export function Router(x, y, { label = '공유기 · 모뎀' } = {}) {
  const w = 130, h = 80;
  const body = [
    el('rect', { x, y, width: w, height: h, rx: 10, fill: '#1D2733', stroke: '#4E7B65', 'stroke-width': 1.5 }),
    el('line', { x1: x + 30, y1: y, x2: x + 16, y2: y - 30, stroke: '#4E7B65', 'stroke-width': 2, 'stroke-linecap': 'round' }),
    el('circle', { cx: x + 16, cy: y - 32, r: 3, fill: '#62C795' }),
    el('line', { x1: x + 70, y1: y, x2: x + 84, y2: y - 30, stroke: '#4E7B65', 'stroke-width': 2, 'stroke-linecap': 'round' }),
    el('circle', { cx: x + 84, cy: y - 32, r: 3, fill: '#62C795' }),
    el('circle', { cx: x + 24, cy: y + h - 26, r: 3, fill: '#62C79599' }),
    el('circle', { cx: x + 40, cy: y + h - 26, r: 3, fill: '#62C79566' }),
    el('circle', { cx: x + 56, cy: y + h - 26, r: 3, fill: '#62C79533' }),
  ];
  return base(x, y, w, h, body, label);
}

/* ---------- NIC 칩 ---------- */
export function NICChip(x, y, { label = 'NIC · Wi-Fi' } = {}) {
  const body = [
    el('rect', { x, y, width: 44, height: 44, rx: 6, fill: '#1D2733', stroke: '#4E7B65', 'stroke-width': 1.4 }),
    el('rect', { x: x + 12, y: y + 12, width: 20, height: 20, rx: 3, fill: '#263B31', stroke: '#4E7B65', 'stroke-width': 1 }),
    el('line', { x1: x + 44, y1: y + 4, x2: x + 54, y2: y - 6, stroke: '#4E7B65', 'stroke-width': 1.6 }),
  ];
  return base(x, y, 44, 44, body, label);
}

/* ---------- 쿨링 팬 ---------- */
export function Fan(x, y, { r = 52, label = null } = {}) {
  const cx = x + r, cy = y + r;
  const blades = el('g', { class: 'blades', fill: '#2C3948' });
  for (let i = 0; i < 5; i++) {
    blades.appendChild(el('rect', {
      x: cx - 8, y: cy - r + 6, width: 16, height: 34, rx: 8,
      transform: `rotate(${i * 72} ${cx} ${cy})`,
    }));
  }
  const body = [
    el('circle', { cx, cy, r, fill: '#0D1218', stroke: '#3A4855', 'stroke-width': 1.6 }),
    blades,
    el('circle', { cx, cy, r: 12, fill: '#202B37', stroke: '#4E5D6D', 'stroke-width': 1.2 }),
  ];
  return base(x, y, r * 2, r * 2, body, label);
}

/* ---------- VRM 열 ---------- */
export function VRM(x, y, { label = 'VRM' } = {}) {
  const body = [];
  for (let i = 0; i < 5; i++) {
    body.push(el('rect', { x: x + i * 32, y, width: 20, height: 20, rx: 3, fill: '#242F3B', stroke: '#4E5D6D', 'stroke-width': 1.2 }));
    body.push(el('circle', { cx: x + 10 + i * 32, cy: y + 36, r: 5, fill: '#2C3844', stroke: '#55667A', 'stroke-width': 1 }));
  }
  return base(x, y, 148, 42, body, label, { labelDy: 18 });
}

/* ---------- 서버 랙 (데이터센터) ---------- */
export function ServerRack(x, y, { label = '검색 서버', units = 5 } = {}) {
  const w = 130, h = 180;
  const body = [el('rect', { x, y, width: w, height: h, rx: 10, fill: '#1D2733', stroke: '#4E7B65', 'stroke-width': 1.5 })];
  for (let i = 0; i < units; i++) {
    const uy = y + 14 + i * 32;
    body.push(el('rect', { x: x + 12, y: uy, width: w - 24, height: 24, rx: 4, fill: '#263B31', stroke: '#3E6252', 'stroke-width': 1 }));
    body.push(el('circle', { cx: x + 24, cy: uy + 12, r: 3, fill: '#62C795AA' }));
    body.push(el('rect', { x: x + 38, y: uy + 8, width: 54, height: 3, rx: 1.5, fill: '#3E6252' }));
    body.push(el('rect', { x: x + 38, y: uy + 14, width: 38, height: 3, rx: 1.5, fill: '#3E625288' }));
  }
  return base(x, y, w, h, body, label);
}
