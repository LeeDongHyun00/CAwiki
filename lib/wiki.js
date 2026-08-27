/* ============================================================
   CAwiki — 아키텍처 도감 (위키)
   일상 동작을 종류(카테고리)로 나눠 보여주고, 준비된 편을 고르면
   해당 아키텍처 페이지로 이동한다. 카테고리 필터 + 스크롤 리빌 +
   다크/라이트 테마 토글.
   ============================================================ */

/* 카테고리 (장식적 색·영문 라벨 없음 — 이름과 한 줄 설명만) */
const CATS = [
  { id: 'boot-exec', ko: '부팅과 실행',   desc: '전원이 들어온 순간부터 프로그램이 실제로 도는 순간까지.' },
  { id: 'graphics',  ko: '화면과 그래픽', desc: '연산 결과가 눈앞의 빛이 되기까지.' },
  { id: 'storage',   ko: '저장과 파일',   desc: '전원이 꺼져도 남는 곳을 오가는 읽고 쓰는 길.' },
  { id: 'network',   ko: '네트워크',      desc: '보드 밖, 지구 반대편까지 갔다 오는 왕복.' },
  { id: 'sound-io',  ko: '소리와 입력',   desc: '사람과 실리콘이 만나는 경계에서 벌어지는 일.' },
  { id: 'power-ai',  ko: '전원과 지능',   desc: '잠들고 깨어나고, 스스로 생각하기.' },
];

/* 아키텍처 — href가 있으면 열 수 있는 편, 없으면 아직 준비 중 */
const ARCHES = [
  { cat: 'boot-exec', title: '전원 버튼을 누르면, 안에서 무슨 일이?', tag: '전원에서 로그인 화면까지, 컴퓨터가 깨어나는 순서', hw: ['PSU', 'CPU', 'RAM', 'SSD'], href: './scenarios/boot.html' },
  { cat: 'boot-exec', title: '더블클릭 한 번에 프로그램이 뜨기까지',   tag: '잠자던 코드가 SSD에서 CPU로 올라오는 길',       hw: ['SSD', 'RAM', 'MMU'] },
  { cat: 'boot-exec', title: '코어 몇 개로 어떻게 수백 개를 동시에?',   tag: '한 CPU가 여러 일을 번갈아 처리하는 법',          hw: ['CPU 코어', '타이머', 'MMU'] },

  { cat: 'graphics',  title: '마우스를 클릭하면 화면 픽셀이 되기까지',   tag: 'CPU와 GPU가 한 프레임을 그려내는 순서',          hw: ['CPU', 'GPU', 'VRAM', '모니터'], href: './scenarios/game.html' },
  { cat: 'graphics',  title: '지금 이 화면은 어떻게 영상 파일이 될까?',  tag: '프레임버퍼의 픽셀이 저장 파일로 굳기까지',       hw: ['GPU', 'VRAM', 'SSD'] },

  { cat: 'storage',   title: '내가 연 파일은 어디서 오는 걸까?',        tag: 'SSD 셀에 잠든 데이터가 화면에 뜨기까지',         hw: ['SSD', 'RAM', 'CPU 캐시'], href: './scenarios/storage.html' },
  { cat: 'storage',   title: 'Ctrl+S를 누르는 순간 무슨 일이?',        tag: '메모리 버퍼의 데이터가 플래시에 새겨지기까지',   hw: ['RAM', 'SSD 컨트롤러', 'NAND'] },
  { cat: 'storage',   title: '게임은 왜 로딩이 오래 걸릴까?',           tag: '거대한 에셋이 SSD에서 화면까지 밀려오는 길',     hw: ['NVMe', 'PCIe', 'GPU'] },

  { cat: 'network',   title: '엔터를 치면 신호는 어디까지 갔다 올까?',   tag: '우리 집에서 데이터센터까지, 왕복 여정',          hw: ['NIC', '공유기', '데이터센터'], href: './scenarios/search.html' },
  { cat: 'network',   title: '버퍼링 막대 뒤에서는 무슨 일이?',         tag: '쪼개진 패킷이 매끄러운 영상으로 이어지기까지',   hw: ['NIC', 'GPU 디코더'] },
  { cat: 'network',   title: '내 얼굴은 어떻게 지구 반대편에 닿을까?',   tag: '카메라에서 상대방 화면까지 건너가는 길',         hw: ['웹캠', 'GPU 인코더', 'NIC'] },

  { cat: 'sound-io',  title: '재생 버튼을 누르면 소리가 나기까지',       tag: '파일 속 숫자가 스피커 진동이 되는 길',           hw: ['CPU', '오디오 코덱', '스피커'] },
  { cat: 'sound-io',  title: '키를 누르면 왜 그 글자가 뜰까?',          tag: '키 하나가 화면 글자가 되기까지',                 hw: ['키보드 컨트롤러', 'USB', 'CPU'] },

  { cat: 'power-ai',  title: '노트북은 어떻게 1초 만에 깨어날까?',       tag: '잠들 때 기억을 지키고 순식간에 되살아나는 법',   hw: ['PSU', 'RAM', 'EC', 'RTC'] },
  { cat: 'power-ai',  title: '내 질문은 어떻게 답이 되어 돌아올까?',     tag: '문장 한 줄이 GPU를 지나 답으로 돌아오기까지',    hw: ['GPU·NPU', 'VRAM'] },
];

const ARROW = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 10h10M11 6l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* 방문 표시(인정된 진행) — 연 편의 href를 localStorage에 남긴다.
   점수·배지가 아니라 '이미 진행 중'이라는 유능감 피드백만. */
const VISIT_KEY = 'cawiki-visited';
function loadVisited() {
  try { return new Set(JSON.parse(localStorage.getItem(VISIT_KEY) || '[]')); }
  catch (e) { return new Set(); }
}
const visited = loadVisited();
function markVisited(href) {
  visited.add(href);
  try { localStorage.setItem(VISIT_KEY, JSON.stringify([...visited])); } catch (e) { /* 저장 실패 무시 */ }
}

function render() {
  const main = document.querySelector('main .wrap');
  const filters = document.querySelector('.filters .row');

  // 필터: '전체' + 카테고리 (색점 없음)
  const all = el('button', 'chip-filter on', '전체');
  all.dataset.cat = 'all';
  filters.appendChild(all);
  CATS.forEach((c) => { const b = el('button', 'chip-filter', c.ko); b.dataset.cat = c.id; filters.appendChild(b); });

  // 카테고리 섹션
  CATS.forEach((c) => {
    const sec = el('section', 'cat reveal');
    sec.id = c.id;
    const head = el('div', 'cat-head', `<h2>${c.ko}</h2><p>${c.desc}</p>`);
    sec.appendChild(head);
    const grid = el('div', 'grid');
    ARCHES.filter((a) => a.cat === c.id).forEach((a) => grid.appendChild(card(a)));
    sec.appendChild(grid);
    main.appendChild(sec);
  });

  fillStartHint();
  wireFilters();
  wireReveal();
}

/* 시작 앵커(가벼운 한 줄) — 첫 공개 편으로 안내해 '어디서 시작하지?' 마찰을 없앤다. */
function fillStartHint() {
  const slot = document.querySelector('.hero-hint');
  if (!slot) return;
  const first = ARCHES.find((a) => a.href);
  if (!first) return;
  slot.innerHTML = `처음이라면 <a href="${first.href}">「${first.title}」</a>부터 열어 보세요.`;
}

function card(a) {
  const live = !!a.href;
  const seen = live && visited.has(a.href);
  const node = el(live ? 'a' : 'div', 'arch ' + (live ? 'live' : 'soon') + (seen ? ' visited' : ''));
  if (live) {
    node.href = a.href;
    // 읽은 편은 스크린리더에도 상태를 알린다
    node.setAttribute('aria-label', `${a.title} — 열기${seen ? ' (읽음)' : ''}`);
    node.addEventListener('click', () => markVisited(a.href));
  } else {
    // 준비 중: 미관은 디밍 그대로 두되, 접근성·어포던스만 보강한다.
    // aria-disabled + 시각적으로 숨긴 '준비 중' 텍스트(화면엔 안 보이나 스크린리더는 읽음).
    node.setAttribute('aria-disabled', 'true');
  }
  node.innerHTML = `
    <div class="a-head">
      <div>
        <h3>${a.title}${live ? '' : '<span class="sr-only"> (준비 중)</span>'}</h3>
        <p class="a-tag">${a.tag}</p>
      </div>
      ${live ? `<span class="a-arrow">${ARROW}</span>` : ''}
    </div>
    <p class="a-hw">${a.hw.join(' · ')}</p>
    ${seen ? '<span class="a-visited" aria-hidden="true">읽음</span>' : ''}`;
  return node;
}

function wireFilters() {
  const pills = Array.from(document.querySelectorAll('.chip-filter'));
  const cats = Array.from(document.querySelectorAll('.cat'));
  pills.forEach((p) => p.addEventListener('click', () => {
    pills.forEach((x) => x.classList.toggle('on', x === p));
    const sel = p.dataset.cat;
    cats.forEach((sec) => sec.classList.toggle('hidden', sel !== 'all' && sec.id !== sel));
    if (sel === 'all') window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    else document.getElementById(sel)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }));
}

function wireReveal() {
  const targets = Array.from(document.querySelectorAll('.reveal'));
  if (reduce || !('IntersectionObserver' in window)) { targets.forEach((t) => t.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  targets.forEach((t) => io.observe(t));

  // 안전장치: IO가 콜백을 못 줘도(일부 환경) 콘텐츠가 영영 숨지 않도록 뷰포트 요소를 강제 표시
  let pending = targets.slice();
  const sweep = () => {
    pending = pending.filter((t) => {
      const r = t.getBoundingClientRect();
      if (r.top < window.innerHeight + 40 && r.bottom > -40) { t.classList.add('in'); return false; }
      return true;
    });
    if (!pending.length) window.removeEventListener('scroll', onScroll);
  };
  let ticking = false;
  const onScroll = () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { ticking = false; sweep(); }); };
  window.addEventListener('scroll', onScroll, { passive: true });
  setTimeout(sweep, 400);
}

/* ---------- 테마 토글 ---------- */
function wireTheme() {
  const btn = document.querySelector('.theme-toggle');
  if (!btn) return;
  const apply = (t) => {
    document.documentElement.setAttribute('data-theme', t);
    btn.setAttribute('aria-label', t === 'light' ? '다크 모드로 전환' : '라이트 모드로 전환');
    btn.setAttribute('aria-pressed', String(t === 'light'));
  };
  apply(document.documentElement.getAttribute('data-theme') || 'dark');
  btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    apply(next);
    try { localStorage.setItem('cawiki-theme', next); } catch (e) { /* 저장 실패해도 전환은 됨 */ }
  });
}

render();
wireTheme();
if (window.__cawikiBooted) window.__cawikiBooted();
