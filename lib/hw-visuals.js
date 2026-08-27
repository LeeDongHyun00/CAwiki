/* ============================================================
   CAwiki — 하드웨어·부품 실물 비주얼
   그래프 뷰에서 텍스트 박스 대신 실리콘 지도풍 실물 도형을 쓴다.
   - hwVisual(id, targetW): 하드웨어 실물 미니 (components.js 팩토리 재사용
     + 팩토리가 없는 것(NPU·SRAM·VRAM·버스·MCU·메인보드)은 여기서 신규)
   - partArt(name, color): 부품 이름 키워드로 고르는 실물 아이콘
   ============================================================ */
import {
  el, CPU, GPU, RAM, SSD, HDD, Chipset, SPIFlash, PSU, Monitor,
  Speaker, Webcam, Keyboard, Mouse, Router, NICChip, Fan, VRM, ServerRack,
} from './components.js';

const txt = (x, y, s, attrs = {}) => el('text', { x, y, text: s, ...attrs });

/* ---------- 신규 미니 팩토리 (components.js 스타일) ---------- */
function NPUChip(x, y) {
  const w = 78, h = 78;
  const body = [el('rect', { x, y, width: w, height: h, rx: 9, fill: '#1D2733', stroke: '#566A80', 'stroke-width': 1.5 })];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    body.push(el('rect', { x: x + 12 + c * 14.5, y: y + 12 + r * 14.5, width: 11, height: 11, rx: 2, fill: '#3A4C6488', stroke: '#5B84C4', 'stroke-width': 0.9 }));
  }
  body.push(txt(x + w / 2, y + h - 6, 'MAC 어레이', { 'text-anchor': 'middle', 'font-size': 7.5, fill: '#7DA8F5', class: 'mn' }));
  const g = el('g'); body.forEach((b) => g.appendChild(b));
  return { el: g, w, h };
}
function SRAMChip(x, y) {
  const w = 84, h = 60;
  const body = [el('rect', { x, y, width: w, height: h, rx: 7, fill: '#1D2733', stroke: '#6A5A94', 'stroke-width': 1.5 })];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
    body.push(el('rect', { x: x + 9 + c * 11.5, y: y + 9 + r * 12, width: 8.5, height: 9, rx: 1.5, fill: '#4A3A7077', stroke: '#8F76CB', 'stroke-width': 0.7 }));
  }
  body.push(txt(x + w / 2, y + h - 6, '6T 셀', { 'text-anchor': 'middle', 'font-size': 7.5, fill: '#A78FDD', class: 'mn' }));
  const g = el('g'); body.forEach((b) => g.appendChild(b));
  return { el: g, w, h };
}
function VRAMMod(x, y) {
  const w = 96, h = 62; const g = el('g');
  g.appendChild(el('rect', { x, y: y + 8, width: w, height: h - 8, rx: 6, fill: '#171F2A', stroke: '#3A4653', 'stroke-width': 1 }));
  for (let i = 0; i < 3; i++) {
    g.appendChild(el('rect', { x: x + 8 + i * 29, y: y + 16, width: 24, height: 30, rx: 3, fill: '#251D36', stroke: '#8F76CB', 'stroke-width': 1.2 }));
  }
  g.appendChild(txt(x + w / 2, y + h - 4, 'GDDR·HBM', { 'text-anchor': 'middle', 'font-size': 7.5, fill: '#A78FDD', class: 'mn' }));
  return { el: g, w, h };
}
function BusLanes(x, y) {
  const w = 96, h = 54; const g = el('g');
  for (let i = 0; i < 4; i++) {
    const ly = y + 8 + i * 12;
    g.appendChild(el('path', { d: `M${x},${ly} h28 l10,6 h${w - 66} l10,-6 h18`, fill: 'none', stroke: '#5B84C4', 'stroke-width': 2, 'stroke-opacity': 0.55 + i * 0.12, 'stroke-linejoin': 'round' }));
    g.appendChild(el('circle', { cx: x + 20 + i * 16, cy: ly + (i % 2 ? 6 : 0), r: 2.4, fill: '#7DA8F5' }));
  }
  return { el: g, w, h };
}
function MCUChip(x, y) {
  const w = 64, h = 64; const g = el('g');
  for (let i = 0; i < 4; i++) {
    g.appendChild(el('rect', { x: x - 6, y: y + 10 + i * 13, width: 8, height: 4, fill: '#5E6D7C' }));
    g.appendChild(el('rect', { x: x + w - 2, y: y + 10 + i * 13, width: 8, height: 4, fill: '#5E6D7C' }));
  }
  g.appendChild(el('rect', { x, y, width: w, height: h, rx: 7, fill: '#1D2733', stroke: '#566A80', 'stroke-width': 1.5 }));
  g.appendChild(el('rect', { x: x + 14, y: y + 14, width: 36, height: 26, rx: 4, fill: '#263241', stroke: '#55667A', 'stroke-width': 1 }));
  g.appendChild(txt(x + w / 2, y + 31, 'MCU', { 'text-anchor': 'middle', 'font-size': 9.5, fill: '#97A0AB' }));
  g.appendChild(txt(x + w / 2, y + h - 8, 'ROM·RAM 내장', { 'text-anchor': 'middle', 'font-size': 7, fill: '#5C6774', class: 'mn' }));
  return { el: g, w: w + 12, h };
}
function MainboardMini(x, y) {
  const w = 118, h = 88; const g = el('g');
  g.appendChild(el('rect', { x, y, width: w, height: h, rx: 8, fill: '#16202B', stroke: '#3E5468', 'stroke-width': 1.5 }));
  g.appendChild(el('rect', { x: x + 12, y: y + 12, width: 34, height: 34, rx: 4, fill: '#22303E', stroke: '#64788F', 'stroke-width': 1.2 }));   // 소켓
  g.appendChild(el('rect', { x: x + 56, y: y + 10, width: 7, height: 40, rx: 2, fill: '#251D36', stroke: '#6A5A94', 'stroke-width': 1 }));      // DIMM
  g.appendChild(el('rect', { x: x + 67, y: y + 10, width: 7, height: 40, rx: 2, fill: '#251D36', stroke: '#6A5A94', 'stroke-width': 1 }));
  g.appendChild(el('rect', { x: x + 12, y: y + 58, width: 62, height: 7, rx: 2, fill: '#20303C', stroke: '#5B84C4', 'stroke-width': 1 }));      // PCIe
  g.appendChild(el('rect', { x: x + 12, y: y + 70, width: 42, height: 6, rx: 2, fill: '#20303C', stroke: '#5B84C466', 'stroke-width': 1 }));
  g.appendChild(el('rect', { x: x + 86, y: y + 54, width: 22, height: 22, rx: 3, fill: '#22303E', stroke: '#55667A', 'stroke-width': 1.1 }));    // PCH
  g.appendChild(txt(x + 97, y + 68, 'PCH', { 'text-anchor': 'middle', 'font-size': 7.5, fill: '#97A0AB', class: 'mn' }));
  g.appendChild(el('path', { d: `M${x + 46},${y + 29} H${x + 56} M${x + 29},${y + 46} V${y + 58} M${x + 74},${y + 61} H${x + 86}`, stroke: '#3E5468', 'stroke-width': 1.2, fill: 'none' }));
  return { el: g, w, h };
}
function AudioAmp(x, y) {
  const w = 108, h = 66; const g = el('g');
  const sp = Speaker(x, y, { w: 62, h: 66, label: null });
  g.appendChild(sp.el);
  g.appendChild(el('rect', { x: x + 72, y: y + 18, width: 30, height: 30, rx: 4, fill: '#1D2733', stroke: '#C4738D', 'stroke-width': 1.3 }));
  g.appendChild(el('path', { d: `M${x + 76},${y + 33} q4,-9 8,0 t8,0 t8,0`, fill: 'none', stroke: '#EF8AA3', 'stroke-width': 1.4 }));
  g.appendChild(txt(x + 87, y + 58, 'DAC', { 'text-anchor': 'middle', 'font-size': 7.5, fill: '#EF8AA3', class: 'mn' }));
  return { el: g, w, h };
}
function InputSet(x, y) {
  const g = el('g');
  const kb = Keyboard(x, y + 8, { label: null });
  const ms = Mouse(x + 178, y + 4, { label: null });
  g.append(kb.el, ms.el);
  return { el: g, w: 230, h: 74 };
}

/* ---------- 하드웨어 → 실물 미니 매핑 ---------- */
const HW_FACTORY = {
  cpu:        () => CPU(0, 0, { size: 120, label: null }),
  gpu:        () => GPU(0, 0, { w: 150, h: 116, label: null }),
  npu:        () => NPUChip(0, 0),
  sram:       () => SRAMChip(0, 0),
  dram:       () => RAM(0, 0, { h: 120, sticks: 2, label: null }),
  vram:       () => VRAMMod(0, 0),
  ssd:        () => SSD(0, 0, { w: 150, label: null }),
  hdd:        () => HDD(0, 0, { label: null }),
  spirom:     () => SPIFlash(0, 0, { label: null }),
  mainboard:  () => MainboardMini(0, 0),
  bus:        () => BusLanes(0, 0),
  power:      () => PSU(0, 0, { label: null }),
  cooling:    () => Fan(0, 0, { r: 44 }),
  display:    () => Monitor(0, 0, { w: 130, h: 92, label: null }),
  input:      () => InputSet(0, 0),
  audio:      () => AudioAmp(0, 0),
  camera:     () => Webcam(0, 0, { w: 70, h: 52, label: null }),
  nic:        () => NICChip(0, 0, { label: null }),
  infra:      () => Router(0, 0, { label: null }),
  datacenter: () => ServerRack(0, 0, { label: null, units: 4 }),
  coproc:     () => MCUChip(0, 0),
};

/** 하드웨어 실물 미니 — targetW×targetH 박스에 맞춰 스케일한 래퍼를 반환.
    (폭만 기준으로 하면 램 스틱·서버 랙처럼 세로로 긴 실물이 과대해진다) */
export function hwVisual(id, targetW = 100, targetH = targetW * 0.82) {
  const make = HW_FACTORY[id];
  const c = make ? make() : { el: el('g'), w: 80, h: 50 };
  const w0 = c.w || 80, h0 = c.h || 50;
  const s = Math.min(targetW / w0, targetH / h0);
  const g = el('g', { class: 'hw-visual' });
  g.appendChild(c.el);
  g._scale = s; g._w0 = w0; g._h0 = h0;
  return { el: g, w: w0 * s, h: h0 * s, s };
}

/* ============================================================
   부품 실물 아이콘 — 이름 키워드 → 원형(archetype)
   ============================================================ */
const A = {}; // archetype 함수들: (color) => {el,w,h}  (0,0 기준)

A.chipCores = (c) => { // 코어·PE·셰이더 격자
  const w = 56, h = 44, g = el('g');
  g.appendChild(el('rect', { x: 0, y: 0, width: w, height: h, rx: 6, fill: '#1D2733', stroke: c, 'stroke-width': 1.4 }));
  for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++)
    g.appendChild(el('rect', { x: 8 + k * 15, y: 8 + r * 15, width: 11, height: 11, rx: 2, fill: '#3A4C6488', stroke: c, 'stroke-width': 0.8, 'stroke-opacity': 0.8 }));
  return { el: g, w, h };
};
A.memCells = (c) => { // 셀 격자(메모리·캐시·버퍼)
  const w = 56, h = 42, g = el('g');
  g.appendChild(el('rect', { x: 0, y: 0, width: w, height: h, rx: 5, fill: '#1D2733', stroke: c, 'stroke-width': 1.4 }));
  for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++)
    g.appendChild(el('rect', { x: 6 + k * 9.5, y: 6 + r * 10.5, width: 7, height: 8, rx: 1.2, fill: `${c}55` }));
  return { el: g, w, h };
};
A.logicChip = (c) => { // 범용 IC (컨트롤러·유닛·엔진)
  const w = 58, h = 42, g = el('g');
  for (let i = 0; i < 3; i++) {
    g.appendChild(el('rect', { x: -5, y: 8 + i * 11, width: 6, height: 3.5, fill: '#5E6D7C' }));
    g.appendChild(el('rect', { x: w - 1, y: 8 + i * 11, width: 6, height: 3.5, fill: '#5E6D7C' }));
  }
  g.appendChild(el('rect', { x: 0, y: 0, width: w, height: h, rx: 6, fill: '#1D2733', stroke: c, 'stroke-width': 1.4 }));
  g.appendChild(el('rect', { x: 13, y: 10, width: 32, height: 22, rx: 3, fill: '#263241', stroke: c, 'stroke-width': 0.9, 'stroke-opacity': 0.7 }));
  g.appendChild(el('circle', { cx: 8, cy: 8, r: 2, fill: c, 'fill-opacity': 0.8 }));
  return { el: g, w: w + 10, h };
};
A.lanes = (c) => { // 배선·버스·링크
  const w = 60, h = 40, g = el('g');
  for (let i = 0; i < 4; i++) {
    const y = 5 + i * 9.5;
    g.appendChild(el('path', { d: `M0,${y} h18 l8,5 h${w - 44} l8,-5 h10`, fill: 'none', stroke: c, 'stroke-width': 1.7, 'stroke-opacity': 0.5 + i * 0.12, 'stroke-linejoin': 'round' }));
  }
  g.appendChild(el('circle', { cx: 24, cy: 5, r: 2.2, fill: c }));
  g.appendChild(el('circle', { cx: 40, cy: 24 + 5, r: 2.2, fill: c }));
  return { el: g, w, h };
};
A.connector = (c) => { // 금핀 커넥터·슬롯
  const w = 58, h = 38, g = el('g');
  g.appendChild(el('rect', { x: 0, y: 6, width: w, height: 22, rx: 3, fill: '#1D2733', stroke: c, 'stroke-width': 1.3 }));
  for (let i = 0; i < 8; i++) g.appendChild(el('rect', { x: 5 + i * 6.6, y: 28, width: 3.6, height: 8, fill: '#B99B55' }));
  g.appendChild(el('rect', { x: 22, y: 10, width: 14, height: 6, rx: 1.5, fill: '#0D1218' }));
  return { el: g, w, h };
};
A.transistorCell = (c) => { // 트랜지스터·셀 소자
  const w = 50, h = 44, g = el('g');
  g.appendChild(el('circle', { cx: 25, cy: 22, r: 17, fill: '#151E29', stroke: c, 'stroke-width': 1.4 }));
  g.appendChild(el('path', { d: 'M10,22 h8 M18,12 v20 M18,15 l14,-8 M18,29 l14,8 M32,7 v6 M32,37 v-6', fill: 'none', stroke: c, 'stroke-width': 1.5, 'stroke-linecap': 'round' }));
  return { el: g, w, h };
};
A.powerParts = (c) => { // 전원 소자: 캡 + 인덕터
  const w = 60, h = 44, g = el('g');
  g.appendChild(el('rect', { x: 2, y: 8, width: 18, height: 28, rx: 3, fill: '#242F3B', stroke: c, 'stroke-width': 1.3 }));
  g.appendChild(el('line', { x1: 5, y1: 14, x2: 17, y2: 14, stroke: c, 'stroke-width': 1, 'stroke-opacity': 0.6 }));
  g.appendChild(el('path', { d: 'M28,30 q5,-12 10,0 t10,0', fill: 'none', stroke: c, 'stroke-width': 1.8 }));
  g.appendChild(el('rect', { x: 28, y: 32, width: 20, height: 3, fill: `${c}66` }));
  g.appendChild(el('circle', { cx: 52, cy: 16, r: 6, fill: '#2C3844', stroke: c, 'stroke-width': 1.1 }));
  return { el: g, w, h };
};
A.spinner = (c) => { // 팬·모터·펌프
  const w = 46, h = 46, g = el('g');
  g.appendChild(el('circle', { cx: 23, cy: 23, r: 21, fill: '#0D1218', stroke: c, 'stroke-width': 1.4 }));
  for (let i = 0; i < 4; i++)
    g.appendChild(el('rect', { x: 19.5, y: 4, width: 7, height: 14, rx: 3.5, fill: '#2C3948', transform: `rotate(${i * 90} 23 23)` }));
  g.appendChild(el('circle', { cx: 23, cy: 23, r: 5.5, fill: '#202B37', stroke: c, 'stroke-width': 1 }));
  return { el: g, w, h };
};
A.platter = (c) => { // 플래터·디스크
  const w = 48, h = 48, g = el('g');
  g.appendChild(el('circle', { cx: 24, cy: 24, r: 22, fill: '#232F3D', stroke: c, 'stroke-width': 1.3 }));
  g.appendChild(el('circle', { cx: 24, cy: 24, r: 13, fill: 'none', stroke: '#3A4653', 'stroke-width': 0.8 }));
  g.appendChild(el('circle', { cx: 24, cy: 24, r: 4, fill: '#4E5D6D' }));
  return { el: g, w, h };
};
A.fins = (c) => { // 히트싱크·핀·방열
  const w = 54, h = 42, g = el('g');
  g.appendChild(el('rect', { x: 0, y: 32, width: w, height: 8, rx: 2, fill: '#2C3844', stroke: c, 'stroke-width': 1 }));
  for (let i = 0; i < 7; i++) g.appendChild(el('rect', { x: 3 + i * 7.4, y: 2, width: 4, height: 30, rx: 1.5, fill: '#242F3B', stroke: c, 'stroke-width': 0.8, 'stroke-opacity': 0.7 }));
  return { el: g, w, h };
};
A.lens = (c) => { // 렌즈·광학
  const w = 46, h = 46, g = el('g');
  g.appendChild(el('circle', { cx: 23, cy: 23, r: 20, fill: '#0D1218', stroke: c, 'stroke-width': 1.4 }));
  g.appendChild(el('circle', { cx: 23, cy: 23, r: 12, fill: '#151E29', stroke: c, 'stroke-width': 1, 'stroke-opacity': 0.7 }));
  g.appendChild(el('circle', { cx: 23, cy: 23, r: 5, fill: '#4A5F82AA' }));
  g.appendChild(el('circle', { cx: 18, cy: 17, r: 2.5, fill: '#E8EDF344' }));
  return { el: g, w, h };
};
A.antenna = (c) => {
  const w = 46, h = 46, g = el('g');
  g.appendChild(el('line', { x1: 23, y1: 44, x2: 23, y2: 16, stroke: c, 'stroke-width': 2, 'stroke-linecap': 'round' }));
  g.appendChild(el('circle', { cx: 23, cy: 13, r: 3, fill: c }));
  [10, 17].forEach((r, i) => {
    g.appendChild(el('path', { d: `M${23 - r},${13 - r * 0.35} a${r},${r} 0 0 1 ${r * 2},0`, fill: 'none', stroke: c, 'stroke-width': 1.3, 'stroke-opacity': 0.7 - i * 0.2 }));
  });
  g.appendChild(el('rect', { x: 14, y: 40, width: 18, height: 5, rx: 2, fill: '#2C3844' }));
  return { el: g, w, h };
};
A.clock = (c) => { // 크리스탈·클럭
  const w = 56, h = 40, g = el('g');
  g.appendChild(el('rect', { x: 0, y: 10, width: 26, height: 18, rx: 8, fill: '#202B37', stroke: c, 'stroke-width': 1.3 }));
  g.appendChild(el('path', { d: 'M30,19 h5 v-8 h6 v16 h6 v-8 h5', fill: 'none', stroke: c, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }));
  return { el: g, w, h };
};
A.speaker = (c) => {
  const w = 46, h = 46, g = el('g');
  g.appendChild(el('path', { d: 'M6,17 h9 l11,-10 v32 l-11,-10 h-9 z', fill: '#1D2733', stroke: c, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }));
  [8, 14].forEach((r, i) => g.appendChild(el('path', { d: `M31,${23 - r} a${r},${r} 0 0 1 0,${r * 2}`, fill: 'none', stroke: c, 'stroke-width': 1.3, 'stroke-opacity': 0.8 - i * 0.25 })));
  return { el: g, w, h };
};
A.mic = (c) => {
  const w = 40, h = 46, g = el('g');
  g.appendChild(el('rect', { x: 13, y: 4, width: 14, height: 22, rx: 7, fill: '#1D2733', stroke: c, 'stroke-width': 1.3 }));
  g.appendChild(el('path', { d: 'M8,20 a12,12 0 0 0 24,0 M20,32 v8 M12,42 h16', fill: 'none', stroke: c, 'stroke-width': 1.4, 'stroke-linecap': 'round' }));
  return { el: g, w, h };
};
A.wave = (c) => { // DAC·ADC·코덱·앰프 (파형 변환 칩)
  const w = 58, h = 40, g = el('g');
  g.appendChild(el('rect', { x: 0, y: 0, width: w, height: h, rx: 6, fill: '#1D2733', stroke: c, 'stroke-width': 1.3 }));
  g.appendChild(el('path', { d: 'M6,26 h6 v-10 h6 v10 h6 v-10 h5', fill: 'none', stroke: c, 'stroke-width': 1.4, 'stroke-opacity': 0.85 }));
  g.appendChild(el('path', { d: 'M32,21 q4,-11 8,0 t8,0', fill: 'none', stroke: c, 'stroke-width': 1.5 }));
  return { el: g, w, h };
};
A.fiber = (c) => { // 광섬유·해저케이블
  const w = 58, h = 40, g = el('g');
  g.appendChild(el('path', { d: 'M2,30 C16,8 42,34 56,12', fill: 'none', stroke: c, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-opacity': 0.4 }));
  g.appendChild(el('path', { d: 'M2,30 C16,8 42,34 56,12', fill: 'none', stroke: c, 'stroke-width': 1.2, 'stroke-linecap': 'round' }));
  g.appendChild(el('circle', { cx: 2, cy: 30, r: 3, fill: c }));
  g.appendChild(el('circle', { cx: 56, cy: 12, r: 3, fill: c }));
  return { el: g, w, h };
};
A.server = (c) => { // 랙·서버·스위치
  const w = 46, h = 50, g = el('g');
  g.appendChild(el('rect', { x: 0, y: 0, width: w, height: h, rx: 5, fill: '#1D2733', stroke: c, 'stroke-width': 1.3 }));
  for (let i = 0; i < 3; i++) {
    const y = 6 + i * 14;
    g.appendChild(el('rect', { x: 5, y, width: w - 10, height: 10, rx: 2, fill: '#263B31', stroke: c, 'stroke-width': 0.8, 'stroke-opacity': 0.6 }));
    g.appendChild(el('circle', { cx: 10, cy: y + 5, r: 1.8, fill: c }));
  }
  return { el: g, w, h };
};
A.board = (c) => { // PCB·기판·하우징
  const w = 56, h = 42, g = el('g');
  g.appendChild(el('rect', { x: 0, y: 0, width: w, height: h, rx: 6, fill: '#16202B', stroke: c, 'stroke-width': 1.3 }));
  g.appendChild(el('path', { d: 'M8,10 h14 v10 h12 M14,32 v-8 M36,14 h12 M30,32 h16', fill: 'none', stroke: c, 'stroke-width': 1.1, 'stroke-opacity': 0.6 }));
  [[8, 10], [34, 20], [46, 14], [30, 32]].forEach(([cx, cy]) => g.appendChild(el('circle', { cx, cy, r: 2, fill: c, 'fill-opacity': 0.8 })));
  return { el: g, w, h };
};
A.keys = (c) => { // 키·스위치·매트릭스
  const w = 56, h = 40, g = el('g');
  for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++)
    g.appendChild(el('rect', { x: 2 + k * 14, y: 4 + r * 17, width: 11, height: 12, rx: 2.5, fill: '#303C48', stroke: c, 'stroke-width': 0.9, 'stroke-opacity': 0.7 }));
  return { el: g, w, h };
};
A.screen = (c) => { // 패널·백라이트 레이어
  const w = 56, h = 44, g = el('g');
  g.appendChild(el('rect', { x: 10, y: 2, width: 44, height: 28, rx: 3, fill: '#151E29', stroke: c, 'stroke-width': 1.3, transform: 'skewY(-6)', 'transform-origin': '10 2' }));
  g.appendChild(el('rect', { x: 4, y: 10, width: 44, height: 28, rx: 3, fill: '#1D2733', stroke: c, 'stroke-width': 1.1, 'stroke-opacity': 0.7, transform: 'skewY(-6)', 'transform-origin': '4 10' }));
  ['#EF8AA3', '#7DA8F5', '#62C795'].forEach((cc, i) => g.appendChild(el('circle', { cx: 14 + i * 11, cy: 26, r: 2, fill: cc, 'fill-opacity': 0.7 })));
  return { el: g, w, h };
};
A.battery = (c) => {
  const w = 54, h = 40, g = el('g');
  g.appendChild(el('rect', { x: 0, y: 8, width: 44, height: 24, rx: 4, fill: '#1D2733', stroke: c, 'stroke-width': 1.3 }));
  g.appendChild(el('rect', { x: 44, y: 15, width: 5, height: 10, rx: 1.5, fill: c }));
  g.appendChild(el('rect', { x: 4, y: 12, width: 22, height: 16, rx: 2, fill: `${c}44` }));
  g.appendChild(el('path', { d: 'M24,14 l-6,7 h5 l-4,6', fill: 'none', stroke: '#E8EDF3', 'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  return { el: g, w, h };
};

/* 키워드 → 원형 (첫 매치 승리 — 순서 중요) */
const PART_RULES = [
  [/배터리|리튬|셀 \(노트북|BMS|충전/i, 'battery'],
  [/팬|모터|펌프|스핀들|VCM|보이스코일|액추에이터/i, 'spinner'],
  [/플래터|라디에이터|디스크/i, 'platter'],
  [/히트싱크|히트파이프|베이퍼|핀\(fin\)|핀 스택|IHS|스프레더|콜드플레이트|워터블록|서멀|TIM|패드|리퀴드메탈|방열|냉각수|에어플로|하우징|램프|필터 \(|재순환/i, 'fins'],
  [/렌즈|조리개|IR 컷|마이크로렌즈|광학|필름/i, 'lens'],
  [/안테나|RF|라디오|무선 AP|Wi-?Fi 베이스밴드|블루투스/i, 'antenna'],
  [/클럭|PLL|크리스탈|오실레이터|RTC|타이머|카운터/i, 'clock'],
  [/스피커|콘\/진동판|크로스오버/i, 'speaker'],
  [/마이크(?!로)/i, 'mic'],
  [/캐시/i, 'memCells'],
  [/DAC|ADC|앰프|코덱|프리앰프|믹서|PGA/i, 'wave'],
  [/광섬유|해저|광케이블|DWDM|OLT|ONT|광 트랜시버|백본/i, 'fiber'],
  [/랙|서버|스위치|라우터|로드밸런서|IXP|CDN|DNS|스토리지 계층|UPS|발전기|배전|DCIM|상면/i, 'server'],
  [/키 스위치|키 매트릭스|스크롤|스틱|햅틱|버튼/i, 'keys'],
  [/패널|액정|편광|컬러필터|백라이트|OLED|TFT|도광|로컬디밍|발광층/i, 'screen'],
  [/트랜지스터|인버터|커패시터 \(storage|접근 트랜지스터|다이오드|셀 \(플로팅|셀 어레이|NOR 플래시 셀|NAND 플래시 셀/i, 'transistorCell'],
  [/전원|PMIC|VRM|MOSFET|정류|퓨즈|PFC|컨버터|LDO|트랜스포머|초크|인덕터|벌크|EMI|서미스터|돌입|차지 ?펌프|5VSB|보호회로|브라운아웃|기준전압/i, 'powerParts'],
  [/커넥터|핀 배열|8핀|포트|잭|슬롯|소켓|패키지|RJ45|M\.2|엣지 커넥터|헤더|I\/O 패널|DIMM/i, 'connector'],
  [/버스|레인|링크|인터커넥트|배선|트레이스|케이블|DMI|NVLink|InfiniBand|CXL|워드라인|비트라인|채널 인터페이스|CA\)|플렉스|NoC|AXI|패브릭|MIPI|I2S|SPI 직렬/i, 'lanes'],
  [/코어|PE|셰이더|SM\/CU|MAC 배열|MAC 유닛|처리 요소|텐서|RT 코어/i, 'chipCores'],
  [/캐시|메모리|버퍼|레지스터|어레이|SRAM|DRAM|NAND|VRAM|롬|플래시|EEPROM|SPD|스크래치|누산|MSHR|프레임|저장|리전|디스크립터/i, 'memCells'],
  [/기판|PCB|평면|프레임|베이스 로직|인터포저|TSV|마운팅|리텐션/i, 'board'],
  [/센서|카메라|이미지|화소|베이어|지문|서보/i, 'lens'],
];

/** 부품 실물 아이콘 — {el, w, h}. */
export function partArt(name, color) {
  for (const [re, key] of PART_RULES) {
    if (re.test(name)) return A[key](color);
  }
  return A.logicChip(color);   // 기본: 범용 IC
}
