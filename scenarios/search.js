/* ============================================================
   아키텍처 №3 — 인터넷 검색 한 번의 왕복
   이번엔 보드가 아니라 "집 → 인터넷 → 데이터센터" 지형으로 조립한다.
   ============================================================ */
import { defineScenario } from '../lib/scenario.js';
import { Node, Router, ServerRack, C } from '../lib/components.js';

defineScenario({
  id: 'search',
  title: '엔터를 치면 신호는 어디까지 갔다 올까?',
  tagline: '패킷이 지구 반대편까지 갔다 돌아오는 왕복이 눈 깜빡임보다 빠르다.',

  compose(stage) {
    stage.zone(60, 240, 350, 360, '내 컴퓨터 · 집');
    stage.zone(450, 120, 340, 480, '인터넷 인프라');
    stage.zone(830, 240, 410, 360, '데이터센터');

    stage.add('browser', Node(80, 300, 150, 84, { label: '브라우저', sub: 'CPU · RAM', color: C.compute }));
    stage.add('nic', Node(270, 330, 120, 84, { label: 'NIC · Wi-Fi', sub: '신호 변환', color: C.net }));
    stage.add('router', Router(150, 470));
    stage.add('isp', Node(490, 330, 120, 84, { label: 'ISP 망', sub: '교환국 라우터', color: C.net }));
    stage.add('bb', Node(650, 330, 130, 84, { label: '백본망', sub: '해저 광케이블', color: C.net }));
    stage.add('dns', Node(510, 160, 180, 84, { label: 'DNS 서버', sub: '이름 → IP 주소', color: C.net, dashed: true }));
    stage.add('lb', Node(870, 330, 130, 84, { label: '로드밸런서', sub: '트래픽 분배', color: C.net }));
    stage.add('rack', ServerRack(1080, 260));

    stage.trace('t1', 'M230,342 H270');
    stage.trace('t2', 'M330,414 V444 H215 V470');
    stage.trace('t3', 'M280,510 H430 V372 H490', { label: '광신호', at: [455, 300] });
    stage.trace('t4', 'M610,372 H650');
    stage.trace('t5', 'M780,372 H870', { label: '해저케이블', at: [825, 358] });
    stage.trace('t6', 'M1000,372 H1080');
    stage.trace('t_dns', 'M155,300 V202 H510', { label: 'UDP 53 · 이름 풀이', at: [340, 190], dashed: true });
    stage.trace('t_ret', 'M1145,440 V650 H100 V388', { label: '응답 (HTML) — 왕복 수십 ms', at: [650, 640] });
  },

  steps: [
    {
      title: '개요 — 검색은 왕복이다',
      lead: '검색은 내 컴퓨터 혼자 하는 일이 아닙니다 — 지구를 왕복합니다.',
      points: [
        '요청이 <b>집 → 인터넷 인프라 → 데이터센터</b>를 지나갔다가 같은 길로 돌아옵니다',
      ],
      detail: '스크롤로 패킷을 따라가 보세요.',
      focus: null, lit: [],
    },
    {
      title: '요청 준비',
      lead: '<b data-comp="browser">브라우저</b>가 검색 요청을 만듭니다.',
      points: [
        '검색 URL과 HTTP 요청을 구성 (CPU·RAM 위에서 실행)',
        '아직 보낼 곳의 주소를 모름 — <code>www.google.com</code>은 이름일 뿐',
      ],
      focus: ['browser', 'nic'], lit: ['browser'],
    },
    {
      title: 'DNS 조회',
      lead: '이름을 IP 주소로 바꿉니다.',
      points: [
        '<code>www.google.com → 142.250.…</code>',
        'OS 캐시 → 공유기 → <b data-comp="dns">ISP의 DNS 서버</b> 순으로 조회',
      ],
      detail: '캐시에 있으면 0ms, 없어도 보통 수십 ms면 답이 옵니다.',
      focus: ['browser', 'dns'], lit: ['browser', 'dns'],
      traces: [{ id: 't_dns', color: C.net }],
      flows: [
        { trace: 't_dns', color: C.net, n: 2, speed: 0.4 },
        { trace: 't_dns', color: C.net, n: 2, speed: 0.4, reverse: true },
      ],
    },
    {
      title: 'TCP · TLS 연결',
      lead: '서버와 연결을 만들고 암호화를 협상합니다.',
      points: [
        '<b>TCP 3-way 핸드셰이크</b>로 연결 수립',
        '<b>TLS</b>로 암호화 협상',
      ],
      detail: '암호화 연산은 CPU 전용 명령(<code>AES-NI</code>)이 가속해 체감 부담이 거의 없습니다.',
      focus: ['browser', 'nic', 'router', 'isp'], lit: ['browser', 'nic', 'router'],
      traces: [{ id: 't1', color: C.net }, { id: 't2', color: C.net }, { id: 't3', color: C.net }],
      flows: [
        { trace: 't2', color: C.net, n: 2, speed: 0.5 },
        { trace: 't2', color: C.net, n: 2, speed: 0.5, reverse: true },
        { trace: 't3', color: C.net, n: 2, speed: 0.4 },
      ],
    },
    {
      title: '패킷의 여행',
      lead: '패킷이 라우터 수십 대를 갈아타며 데이터센터로 갑니다.',
      points: [
        '<b data-comp="nic">NIC·Wi-Fi</b>가 패킷을 전기신호·전파로 변환 → <b data-comp="router">공유기</b>',
        '모뎀이 광신호로 바꿔 ISP 망에 태움',
        '<b>홉(hop)</b>마다 갈아타며 백본망·해저 광케이블 통과',
      ],
      focus: ['nic', 'isp', 'bb', 'lb'], lit: ['nic', 'router', 'isp', 'bb'],
      traces: [{ id: 't1', color: C.net }, { id: 't2', color: C.net }, { id: 't3', color: C.net }, { id: 't4', color: C.net }, { id: 't5', color: C.net }],
      flows: [
        { trace: 't3', color: C.net, n: 2, speed: 0.45 },
        { trace: 't4', color: C.net, n: 1, speed: 0.6 },
        { trace: 't5', color: C.net, n: 2, speed: 0.5 },
      ],
    },
    {
      title: '서버 처리',
      lead: '데이터센터가 요청을 받아 검색 결과를 만듭니다.',
      points: [
        '<b data-comp="lb">로드밸런서</b>가 수만 대 서버 중 하나로 분배',
        '<b data-comp="rack">검색 서버</b>가 미리 만든 인덱스를 조회해 HTML로 회신',
      ],
      detail: '전 웹을 그 자리에서 뒤지는 게 아니라, 미리 만들어 둔 색인을 봅니다.',
      focus: ['lb', 'rack'], lit: ['lb', 'rack'],
      traces: [{ id: 't6', color: C.net }],
      flows: [{ trace: 't6', color: C.net, n: 2, speed: 0.5 }],
    },
    {
      title: '응답, 그리고 렌더링',
      lead: '응답이 같은 길을 되짚어 돌아와 화면에 뜹니다.',
      points: [
        '전체 왕복이 <b>수십 ms</b>',
        '브라우저가 HTML 파싱 → DOM → 레이아웃·페인트 → GPU 합성',
      ],
      detail: '이 마지막 구간은 <b>게임 아키텍처의 후반부</b>와 같은 경로입니다.',
      focus: null, lit: ['rack', 'browser'],
      traces: [{ id: 't_ret', color: C.accent }],
      flows: [{ trace: 't_ret', color: C.accent, n: 3, speed: 0.3 }],
    },
    {
      title: '전체 왕복 복기',
      lead: '<b>브라우저 → DNS → NIC → 공유기 → ISP → 백본 → 로드밸런서 → 검색 서버</b>, 그리고 같은 길로 복귀.',
      detail: '내 컴퓨터의 하드웨어만으로는 완성되지 않는, 지구 크기의 아키텍처입니다.',
      focus: null, lit: ['browser', 'nic', 'router', 'isp', 'bb', 'dns', 'lb', 'rack'],
      traces: [
        { id: 't1', color: C.net }, { id: 't2', color: C.net }, { id: 't3', color: C.net },
        { id: 't4', color: C.net }, { id: 't5', color: C.net }, { id: 't6', color: C.net },
        { id: 't_dns', color: C.net }, { id: 't_ret', color: C.accent },
      ],
      flows: [
        { trace: 't3', color: C.net, n: 2, speed: 0.4 },
        { trace: 't5', color: C.net, n: 2, speed: 0.45 },
        { trace: 't_ret', color: C.accent, n: 3, speed: 0.28 },
      ],
    },
  ],
});
