/* ============================================================
   아키텍처 №3 — 인터넷 검색 한 번의 왕복
   이번엔 보드가 아니라 "집 → 인터넷 → 데이터센터" 지형으로 조립한다.
   ============================================================ */
import { defineScenario } from '../lib/scenario.js';
import { Node, Router, ServerRack, C } from '../lib/components.js';

defineScenario({
  id: 'search',
  title: '검색 — 집에서 데이터센터까지',
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
      body: `검색은 내 컴퓨터 혼자 하는 일이 아닙니다. 요청이 <b>집 → 인터넷 인프라 → 데이터센터</b>를 지나갔다가, 같은 길로 돌아옵니다. 스크롤로 패킷을 따라가 보세요.`,
      focus: null, lit: [],
    },
    {
      title: '요청 준비',
      body: `검색어를 입력하면 <b>브라우저</b>(CPU와 RAM 위에서 실행되는 프로그램)가 검색 URL과 HTTP 요청을 구성합니다. 그런데 보낼 곳의 주소를 아직 모릅니다 — <code>www.google.com</code>은 이름일 뿐, 주소가 아니니까요.`,
      focus: ['browser', 'nic'], lit: ['browser'],
    },
    {
      title: 'DNS 조회',
      body: `이름을 IP 주소로 바꿉니다: <code>www.google.com → 142.250.…</code> OS 캐시 → 공유기 → <b>ISP의 DNS 서버</b> 순서로 물어봅니다. 캐시에 있으면 0ms, 없어도 보통 수십 ms면 답이 옵니다.`,
      focus: ['browser', 'dns'], lit: ['browser', 'dns'],
      traces: [{ id: 't_dns', color: C.net }],
      flows: [
        { trace: 't_dns', color: C.net, n: 2, speed: 0.4 },
        { trace: 't_dns', color: C.net, n: 2, speed: 0.4, reverse: true },
      ],
    },
    {
      title: 'TCP · TLS 연결',
      body: `주소를 알았으니 서버와 <b>TCP 3-way 핸드셰이크</b>로 연결을 만들고, <b>TLS</b>로 암호화를 협상합니다. 암호화 연산은 CPU의 전용 명령(<code>AES-NI</code>)이 가속하므로 체감 부담이 거의 없습니다.`,
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
      body: `<b>NIC·Wi-Fi 모듈</b>이 패킷을 전기신호·전파로 바꿔 <b>공유기</b>로 보내고, 모뎀이 광신호로 변환해 ISP 망에 태웁니다. 패킷은 라우터 수십 대를 <b>홉(hop)</b>마다 갈아타며 백본망과 해저 광케이블을 지나 데이터센터에 도착합니다.`,
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
      body: `<b>로드밸런서</b>가 수만 대의 서버 중 하나로 요청을 분배합니다. <b>검색 서버</b>는 미리 만들어 둔 인덱스를 조회해(전 웹을 그 자리에서 뒤지는 게 아닙니다) 결과 HTML을 만들어 회신합니다.`,
      focus: ['lb', 'rack'], lit: ['lb', 'rack'],
      traces: [{ id: 't6', color: C.net }],
      flows: [{ trace: 't6', color: C.net, n: 2, speed: 0.5 }],
    },
    {
      title: '응답, 그리고 렌더링',
      body: `응답이 같은 길을 되짚어 돌아옵니다 — 전체 왕복이 <b>수십 ms</b>. 브라우저는 HTML을 파싱해 DOM을 만들고 레이아웃·페인트를 거쳐 GPU 합성으로 화면에 띄웁니다. 이 마지막 구간은 <b>게임 아키텍처의 후반부</b>와 같은 경로입니다.`,
      focus: null, lit: ['rack', 'browser'],
      traces: [{ id: 't_ret', color: C.accent }],
      flows: [{ trace: 't_ret', color: C.accent, n: 3, speed: 0.3 }],
    },
    {
      title: '전체 왕복 복기',
      body: `<b>브라우저 → DNS → NIC → 공유기 → ISP → 백본 → 로드밸런서 → 검색 서버 → (같은 길로) → 브라우저.</b> 내 컴퓨터의 하드웨어만으로는 완성되지 않는, 지구 크기의 아키텍처입니다.`,
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
