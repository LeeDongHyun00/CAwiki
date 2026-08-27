/* ============================================================
   CAwiki — 메인 페이지 "실리콘 지도"
   ------------------------------------------------------------
   두 구간으로 이루어진다.

   [1] 리빌 (스크롤 양에 실시간 연동)
       첫 화면을 꽉 채운 "컴퓨터 한 대를 펼쳐 놓았습니다"는 사실
       보드 위 모니터의 화면이다. 스크롤할수록 카메라가 뒤로 빠지며
       베젤이 가장자리에서 드러나고, 문구는 모니터 크기만큼 작아지고,
       모니터는 제자리로 물러나 부품 전체가 나타난다.
       → 구현은 그냥 카메라 줌아웃이다. 문구가 월드 좌표(모니터 화면 안)에
         있으므로 축소는 저절로 따라온다.

   [2] 투어 (아키텍처 페이지와 동일한 스텝 잠금)
       6개 하드웨어 영역 → 아키텍처 4선.
   ============================================================ */
import {
  Board, CPU, GPU, RAM, SSD, HDD, Chipset, SPIFlash, PSU, Monitor,
  Keyboard, Mouse, Router, NICChip, Fan, VRM, Speaker, Webcam, Node, C, el,
} from './components.js';
import { createStageAsync } from './stage.js';
import { createPlayer } from './player.js';

const VW = 1280, VH = 800;

/* 부품 → 관련 아키텍처 페이지 */
const ARCH_OF = {
  psu: 'boot', vrm: 'boot', spi: 'boot', fan: 'boot', pch: 'boot',
  cpu: 'game', gpu: 'game', mon: 'game', kb: 'game', mouse: 'game',
  ssd: 'storage', hdd: 'storage', ram: 'storage',
  nic: 'search', router: 'search',
  cam: 'game', spk: 'game',
};
/* 부품 표시 이름 (스크린리더·툴팁용) */
const NAME_OF = {
  mon: '모니터', psu: '파워서플라이', vrm: 'VRM 전원부', fan: '쿨링 팬',
  cpu: 'CPU', gpu: 'GPU', ram: 'RAM', pch: '칩셋', spi: 'SPI 플래시',
  ssd: 'NVMe SSD', hdd: 'HDD', nic: 'NIC · Wi-Fi', router: '공유기 · 모뎀',
  kb: '키보드', mouse: '마우스', cam: '웹캠', spk: '스피커',
};
const ARCH_META = {
  boot:    { href: './scenarios/boot.html',    title: '전원 버튼을 누르면, 안에서 무슨 일이?', no: 'ARCH 01', acc: C.power },
  game:    { href: './scenarios/game.html',    title: '마우스를 클릭하면 화면 픽셀이 되기까지', no: 'ARCH 02', acc: C.compute },
  search:  { href: './scenarios/search.html',  title: '엔터를 치면 신호는 어디까지 갔다 올까?', no: 'ARCH 03', acc: C.net },
  storage: { href: './scenarios/storage.html', title: '내가 연 파일은 어디서 오는 걸까?',       no: 'ARCH 04', acc: C.storage },
};

/* ───────────────────────── 조립 ───────────────────────── */

let monitor = null;

function compose(stage) {
  stage.add('board', Board(250, 90, 780, 600));

  monitor = Monitor(40, 92, { w: 190, h: 138, dots: false });
  stage.add('mon', monitor);

  stage.add('psu', PSU(1080, 110));
  stage.add('vrm', VRM(482, 146));
  stage.add('fan', Fan(300, 150, { r: 50 }));
  stage.add('cpu', CPU(480, 210));
  stage.add('ram', RAM(700, 150, { h: 260, labelDy: -272 }));
  stage.add('pch', Chipset(550, 470));
  stage.add('spi', SPIFlash(455, 485));
  stage.add('ssd', SSD(695, 430));
  stage.add('gpu', GPU(300, 470));
  stage.add('hdd', HDD(1080, 300));
  stage.add('router', Router(1090, 520));
  stage.add('nic', NICChip(940, 610));
  stage.add('kb', Keyboard(52, 320));
  stage.add('mouse', Mouse(120, 410));
  stage.add('cam', Webcam(74, 500));
  stage.add('spk', Speaker(52, 560));

  /* 배선 — 앵커에서 좌표를 뽑아 만든다 */
  const P = (c, a) => stage.comps.get(c).a(a);
  const cpu = stage.comps.get('cpu');

  stage.trace('t_ram', `M640,262 H700`, { label: '메모리 버스', at: [670, 246] });
  stage.trace('t_ram2', `M640,286 H700`);
  stage.trace('t_pcie16', `M500,370 V430 H390 V470`, { label: 'PCIe ×16', at: [452, 422] });
  stage.trace('t_pcie4', `M640,330 H670 V450 H695`, { label: 'PCIe ×4', at: [690, 396] });
  stage.trace('t_dmi', `M590,370 V470`, { label: 'DMI', at: [612, 424] });
  stage.trace('t_spi', `M550,505 H487`);
  stage.trace('t_mon', `M300,540 C244,540 208,512 208,452 L208,300 C208,268 196,252 235,232`,
    { label: 'HDMI · DP', at: [246, 350] });
  stage.trace('t_sata', `M630,505 H1000 V360 H1080`, { label: 'SATA', at: [1020, 348] });
  stage.trace('t_usb', `M566,540 V600 H300 V420 H165`, { label: 'USB', at: [300, 412] });
  stage.trace('t_nic', `M614,505 H900 V632 H940`, { label: 'PCIe', at: [880, 496] });
  stage.trace('t_wifi', `M984,626 C1030,626 1050,600 1090,566`, { label: '무선', at: [1042, 596], dashed: true });
  stage.trace('t_psu', `M1080,190 C1050,190 1046,200 1030,200`, { label: 'Power Good', at: [1050, 172] });
  stage.trace('t_spk', `M330,650 H180`, { label: '아날로그', at: [255, 640], thin: true });

  /* 모니터 화면 안 — 히어로 문구 (월드 좌표라 카메라가 빠지면 저절로 작아진다) */
  const s = monitor.screen;
  const g = monitor.screenG;
  g.appendChild(el('rect', {
    x: s.x, y: s.y, width: s.w, height: s.h,
    fill: 'url(#heroGlow)',
  }));
  g.appendChild(el('text', {
    x: s.cx, y: s.cy - 5.5, text: '컴퓨터 한 대를',
    'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700,
    fill: '#F2F4F7', class: 'hero-line',
  }));
  g.appendChild(el('text', {
    x: s.cx, y: s.cy + 13.5, text: '펼쳐 놓았습니다',
    'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700,
    fill: '#97A0AB', class: 'hero-line',
  }));
  g.appendChild(el('text', {
    x: s.cx, y: s.cy + 26, text: 'CAWIKI · COMPUTER ARCHITECTURE',
    'text-anchor': 'middle', 'font-size': 3.6, fill: '#E09A5F',
    class: 'hero-eyebrow mn', 'letter-spacing': 0.6,
  }));

  /* 화면 발광 그라디언트 */
  const defs = el('defs', {}, [
    el('radialGradient', { id: 'heroGlow', cx: '50%', cy: '45%', r: '75%' }, [
      el('stop', { offset: '0', 'stop-color': '#1B2735' }),
      el('stop', { offset: '1', 'stop-color': '#0E141C' }),
    ]),
  ]);
  stage.svg.insertBefore(defs, stage.svg.firstChild);

  /* 부품 클릭 → 아키텍처 페이지 */
  stage.comps.forEach((c, id) => {
    const arch = ARCH_OF[id];
    if (!arch) return;
    c.el.classList.add('clickable');
    c.el.setAttribute('role', 'link');
    c.el.setAttribute('tabindex', '-1');
    c.el.setAttribute('aria-label', `${NAME_OF[id] || id} — ${ARCH_META[arch].title} 보기`);
    c.el.addEventListener('click', () => { location.href = ARCH_META[arch].href; });
  });
}

/* ───────────────────────── 투어 단계 ───────────────────────── */

const STEPS = [
  {
    key: 'all', title: '당신의 컴퓨터, 전 부품',
    body: '모든 클릭·검색·저장은 이 보드 위의 여행입니다. 색이 들어온 부품을 <b>클릭하면</b> 그 부품이 주인공인 아키텍처로 넘어갑니다.',
    chips: [], focus: null, lit: [],
  },
  {
    key: 'compute', title: '연산', eyebrow: 'PROCESSING', color: C.compute,
    body: '결정은 CPU가, 반복은 GPU가 — 수천 코어의 분업. AI는 NPU가 거듭니다.',
    chips: ['CPU 코어·캐시', 'GPU 셰이더', 'NPU'],
    focus: ['cpu', 'gpu'], lit: ['cpu', 'gpu'],
    traces: [{ id: 't_pcie16', color: C.compute }],
    flows: [{ trace: 't_pcie16', color: C.compute, n: 3, speed: 0.4 }],
    arch: 'game',
  },
  {
    key: 'memory', title: '메모리', eyebrow: 'MEMORY', color: C.memory,
    body: '빠를수록 작습니다 — 레지스터·캐시에서 RAM까지, 전원이 꺼지면 사라지는 계단.',
    chips: ['캐시 SRAM', 'RAM DDR5', 'VRAM GDDR7'],
    focus: ['cpu', 'ram'], lit: ['ram', 'cpu'],
    traces: [{ id: 't_ram', color: C.memory }, { id: 't_ram2', color: C.memory }],
    flows: [
      { trace: 't_ram', color: C.memory, n: 2, speed: 0.55 },
      { trace: 't_ram2', color: C.memory, n: 2, speed: 0.55, reverse: true },
    ],
    arch: 'storage',
  },
  {
    key: 'storage', title: '저장장치', eyebrow: 'STORAGE', color: C.storage,
    body: '전원이 꺼져도 남는 곳 — µs로 답하는 SSD, ms로 도는 HDD, 부팅을 여는 SPI 플래시.',
    chips: ['NVMe SSD', 'HDD', 'SPI 플래시'],
    focus: ['ssd', 'hdd', 'spi'], lit: ['ssd', 'hdd', 'spi'],
    traces: [{ id: 't_pcie4', color: C.storage }, { id: 't_sata', color: C.storage }],
    flows: [
      { trace: 't_pcie4', color: C.storage, n: 2, speed: 0.5, reverse: true },
      { trace: 't_sata', color: C.storage, n: 3, speed: 0.3, reverse: true },
    ],
    arch: 'storage',
  },
  {
    key: 'power', title: '기판과 전원', eyebrow: 'BOARD & POWER', color: C.power,
    body: '모두를 잇고 먹여 살리는 기반 — 버스가 길이고, PSU가 심장이고, 쿨러가 숨입니다.',
    chips: ['칩셋 PCH', 'PCIe·DMI', 'PSU', 'VRM', '쿨러'],
    focus: ['psu', 'vrm', 'pch', 'fan'], lit: ['psu', 'vrm', 'pch', 'fan'],
    traces: [{ id: 't_psu', color: C.power }, { id: 't_dmi', color: C.power }],
    flows: [
      { trace: 't_psu', color: C.power, n: 2, speed: 0.5 },
      { trace: 't_dmi', color: C.power, n: 2, speed: 0.45 },
    ],
    arch: 'boot',
  },
  {
    key: 'io', title: '입출력', eyebrow: 'INPUT & OUTPUT', color: C.io,
    body: '사람과 실리콘이 만나는 경계 — 손끝의 인터럽트, 눈앞의 프레임, 귓가의 파형.',
    chips: ['모니터', '키보드·마우스', '웹캠', '스피커'],
    focus: ['mon', 'kb', 'mouse', 'cam', 'spk'], lit: ['mon', 'kb', 'mouse', 'cam', 'spk'],
    traces: [{ id: 't_mon', color: C.io }, { id: 't_usb', color: C.io }, { id: 't_spk', color: C.io }],
    flows: [
      { trace: 't_mon', color: C.io, n: 3, speed: 0.3 },
      { trace: 't_usb', color: C.io, n: 3, speed: 0.28, reverse: true },
    ],
    arch: 'game',
  },
  {
    key: 'net', title: '네트워크', eyebrow: 'NETWORK', color: C.net,
    body: '보드 밖, 지구 반대편까지 — 검색 한 번의 왕복이 수십 ms.',
    chips: ['NIC·Wi-Fi', '공유기·모뎀', 'ISP·해저케이블'],
    focus: ['nic', 'router'], lit: ['nic', 'router'],
    traces: [{ id: 't_nic', color: C.net }, { id: 't_wifi', color: C.net }],
    flows: [
      { trace: 't_nic', color: C.net, n: 2, speed: 0.45 },
      { trace: 't_wifi', color: C.net, n: 2, speed: 0.5 },
    ],
    arch: 'search',
  },
  {
    key: 'arch', title: '이제, 작동 순서로', eyebrow: 'ARCHITECTURES', color: C.accent,
    body: '부품을 알았으니, 이제 그 부품들이 실제로 어떻게 협력하는지 볼 차례입니다. 위키에서 종류별로 골라 한 편씩 따라가 보세요.',
    chips: [], focus: null, lit: [],
    wiki: true,
  },
];

/* ───────────────────────── 부트스트랩 ───────────────────────── */

(async function main() {
  const svg = document.querySelector('.stagewrap svg');
  const stage = await createStageAsync(svg, { vw: VW, vh: VH });
  compose(stage);

  const badge = document.querySelector('.kernel-badge');
  badge.textContent = stage.backend === 'wasm' ? 'WASM' : 'JS';
  badge.classList.add(stage.backend === 'wasm' ? 'k-wasm' : 'k-js');

  /* ── 리빌 카메라 두 지점 ── */
  const s = monitor.screen;
  /* 화면이 뷰포트를 꽉 채우는 배율. 창 크기가 바뀌면 달라지므로 매번 계산한다. */
  const CAM_A = { x: s.cx, y: s.cy, get s() { return stage.coverScale(s.w, s.h); } };

  /* 세로 폰에서는 '보드 전체'(배율 1)가 화면 높이의 30%로 쪼그라든다 —
     월드는 가로 1.6인데 화면은 세로 0.46이라 viewBox가 세로로 확장되기 때문.
     그래서 세로에서는 리빌 종착점도 보드 중심부를 채우는 지점으로 바꾼다. */
  const PORTRAIT_CORE = ['cpu', 'gpu', 'ram', 'pch'];
  const isPortrait = () => {
    const r = svg.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (r.width / r.height) < 1.15;
  };
  let camBCache = null, camBKey = null;
  function camB() {
    const key = isPortrait() ? 'p' : 'l';
    if (camBKey === key && camBCache) return camBCache;
    camBKey = key;
    if (key === 'l') { camBCache = { x: VW / 2, y: VH / 2, s: 1 }; return camBCache; }
    const boxes = PORTRAIT_CORE.map((id) => stage.comps.get(id)).filter(Boolean)
      .map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h }));
    const f = boxes.length ? stage.kernel.camFit(boxes, 70, 3) : { fx: VW / 2, fy: VH / 2, s: 1 };
    camBCache = { x: f.fx, y: f.fy, s: f.s };
    return camBCache;
  }
  const CAM_B = { get x() { return camB().x; }, get y() { return camB().y; }, get s() { return camB().s; } };

  let wasPortrait = isPortrait();
  window.addEventListener('resize', () => {
    const p = isPortrait();
    if (p !== wasPortrait) {          // 회전·크기 변경 → 세로/가로 카메라 정책 전환
      wasPortrait = p;
      tuneSteps();
      if (phase === 'tour') player.start(player.index, { instant: true });
    }
    if (phase === 'reveal') applyReveal(stage.kernel.scrub);
  });

  const root = document.body;
  const hint = document.querySelector('.reveal-hint');
  const hud = document.querySelector('.hud');

  /* ── 캡션 카드 렌더러 ── */
  const captions = document.querySelector('.captions');
  function renderCaption(st, idx) {
    const d = document.createElement('div');
    d.className = 'cap' + (st.color ? '' : ' cap-plain');
    if (st.color) d.style.setProperty('--cc', st.color);
    const chips = (st.chips && st.chips.length)
      ? '<div class="chips">' + st.chips.map((c) => `<span class="chip">${c}</span>`).join('') + '</div>' : '';
    const link = st.arch
      ? `<a class="cap-link" href="${ARCH_META[st.arch].href}">${ARCH_META[st.arch].title} →</a>` : '';
    const wiki = st.wiki
      ? '<a class="wiki-cta" href="./wiki.html">아키텍처 위키로 <span class="wc-arrow" aria-hidden="true">→</span></a>' : '';
    d.innerHTML = `
      <p class="cap-eyebrow">${String(idx).padStart(2, '0')} / ${String(STEPS.length - 1).padStart(2, '0')}${st.eyebrow ? ' · ' + st.eyebrow : ''}</p>
      <h2>${st.title}</h2>
      <p class="cap-body">${st.body}</p>${chips}${link}${wiki}`;
    return d;
  }

  /* ── 점 네비게이션 ── */
  const nav = document.querySelector('.dotnav');
  const dots = STEPS.map((st, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span>${st.title}</span>`;
    b.setAttribute('aria-label', `${i + 1}단계: ${st.title}`);
    nav.appendChild(b);
    return b;
  });

  /* 세로 폰: 전체 보드(focus:null) 스텝은 글자가 4px로 뭉개져 읽을 수 없다.
     → 보드 중심부로 포커스를 주고, 확대 상한을 올려 부품이 실제로 보이게 한다.
     가로로 돌아오면 원래 값으로 복원한다(원본을 stepBase에 보관). */
  const stepBase = STEPS.map((st) => ({ focus: st.focus, maxS: st.maxS, pad: st.pad }));
  function tuneSteps() {
    const p = isPortrait();
    STEPS.forEach((st, i) => {
      const b = stepBase[i];
      st.focus = (p && !b.focus) ? PORTRAIT_CORE : b.focus;
      st.maxS = p ? Math.max(b.maxS ?? 2.4, 3.4) : b.maxS;
      st.pad = p ? Math.min(b.pad ?? 90, 56) : b.pad;
    });
  }
  tuneSteps();

  const player = createPlayer({
    stage, steps: STEPS,
    ui: {
      list: captions, lock: document.querySelector('.stage-lock'),
      progress: document.querySelector('.progress > i'),
      dots, scrollIntoView: false,
    },
    renderItem: renderCaption,
    enabled: false,                       // 리빌이 끝나기 전에는 입력을 받지 않는다
    onExitTop: () => exitToReveal(),      // 0단계에서 위로 → 리빌로 복귀
  });

  /* ── 리빌 스크럽 컨트롤러 ── */
  let target = 0;          // 목표 스크럽 0..1
  let phase = 'reveal';    // 'reveal' | 'tour'
  const WHEEL_SPAN = 2200; // 리빌 전 구간에 필요한 휠 델타 총량

  function applyReveal(t) {
    stage.scrubTo(t, CAM_A, CAM_B);
    root.style.setProperty('--reveal', t.toFixed(4));
    root.classList.toggle('revealed', t > 0.985);
    if (hint) hint.style.opacity = t < 0.06 ? '' : '0';
  }

  async function enterTour() {
    if (phase === 'tour') return;
    phase = 'tour';
    root.classList.add('tour');
    target = 1;
    stage.kernel.scrubSet(1);
    applyReveal(1);
    await player.start(0, { instant: true });
    // 인계를 촉발한 큰 플릭의 관성이 남아 있다. 초기 잠금으로 첫 관성 휠을 흡수 분기로
    // 넣으면, 이후는 플레이어의 관성 연장이 이어받는다. (MOMENTUM_GAP보다 크기만 하면 된다.)
    player.setActive(true, 190);
  }

  function exitToReveal() {
    if (phase === 'reveal') return;
    phase = 'reveal';
    player.setActive(false);
    root.classList.remove('tour');
    stage.stopFlows();
    stage.setStates({ lit: [], trail: [], dimOthers: false });
    stage.emphTraces([]);
    target = 0.9;                          // 살짝 되감아 리빌을 다시 잡는다
    stage.kernel.scrubSet(0.94);
  }

  function onWheel(e) {
    if (phase !== 'reveal') return;        // 투어 중에는 플레이어가 처리
    e.preventDefault();
    target = Math.min(1, Math.max(0, target + e.deltaY / WHEEL_SPAN));
    // 인계(enterTour)는 tick 루프가 스크럽 완료 시점에 처리한다.
    // 여기서 target>=1이 되는 즉시 부르면 남은 스크럽 구간이 스냅된다.
  }
  function onKey(e) {
    if (phase !== 'reveal') return;
    // 아래키/PageDown/스페이스: target만 1로 올리고, 실제 인계는 tick 루프가 스크럽이
    // 1에 도달한 뒤에 한다 → 리빌 애니메이션이 온전히 재생된다.
    // (예전엔 여기서 곧장 enterTour를 불러 애니메이션 없이 스냅됐다.)
    if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); target = 1; }
    else if (e.key === 'End') { e.preventDefault(); target = 1; enterTour(); }   // End = 즉시 건너뛰기
    else if (['ArrowUp', 'PageUp', 'Home'].includes(e.key)) { e.preventDefault(); target = 0; }
  }
  let ty = null;
  function onTouchStart(e) { if (phase === 'reveal') ty = e.touches[0].clientY; }
  function onTouchMove(e) {
    if (phase !== 'reveal' || ty == null) return;
    e.preventDefault();
    const y = e.touches[0].clientY;
    target = Math.min(1, Math.max(0, target + (ty - y) / 700));
    ty = y;
    // 인계는 tick 루프가 처리 (onWheel과 동일)
  }
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  document.querySelector('.reveal-skip')?.addEventListener('click', () => { target = 1; enterTour(); });

  /* ── 스크럽 감쇠 루프 (커널이 계산) ── */
  const RATE = 9;   // 클수록 손가락에 빨리 붙는다
  let last = null;
  // 리빌 한 프레임: 스크럽을 target으로 감쇠시키고, 끝까지 재생되면 투어로 넘긴다.
  // 입력 핸들러가 아니라 이 프레임에서 넘겨야 스크럽 애니메이션이 온전히 재생된다.
  function revealFrame(dt) {
    const t = stage.kernel.scrubStep(target, dt, RATE);
    applyReveal(t);
    if (target >= 1 && t >= 0.999) enterTour();
    return t;
  }
  function tick(now) {
    if (last == null) last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (phase === 'reveal') revealFrame(dt);
    requestAnimationFrame(tick);
  }

  if (stage.RM) {                      // 모션 최소화 설정이면 리빌을 건너뛴다
    target = 1;
    await enterTour();
  } else {
    stage.kernel.scrubSet(0);
    applyReveal(0);
  }
  requestAnimationFrame(tick);

  if (window.__cawikiBooted) window.__cawikiBooted();

  window.stage = stage;
  window.player = player;
  window.reveal = { get phase() { return phase; }, get target() { return target; },
                    set target(v) { target = v; }, enterTour, exitToReveal, CAM_A, CAM_B,
                    pump: revealFrame /* 테스트용: tick 한 프레임을 수동으로 돌린다 */ };
})();
