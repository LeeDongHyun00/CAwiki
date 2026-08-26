/* ============================================================
   아키텍처 №4 — 드라이브의 파일이 화면에 보이기까지
   저장장치 읽기 경로: 파일시스템 → NVMe → DMA → RAM → CPU → 화면
   ============================================================ */
import { defineScenario } from '../lib/scenario.js';
import { CPU, RAM, SSD, HDD, Monitor, Node, C } from '../lib/components.js';

defineScenario({
  id: 'storage',
  title: '파일 열기 — 셀에서 화면까지',
  tagline: '더블클릭 한 번에 파일시스템·DMA·메모리 계층이 총출동한다. SSD가 컴퓨터를 빠르게 느끼게 만드는 이유가 이 경로에 있다.',

  compose(stage) {
    stage.add('app', Node(60, 300, 140, 80, { label: '응용 프로그램', sub: '더블클릭', color: C.io }));
    stage.add('fs', Node(250, 300, 150, 80, { label: 'OS 파일시스템', sub: '이름 → 블록 주소', color: C.power }));
    stage.add('ssd', SSD(450, 285, { w: 220, detail: true }));
    stage.add('hdd', HDD(470, 470));
    stage.add('ram', RAM(720, 220, { h: 220, label: 'RAM · 페이지 캐시' }));
    stage.add('cpu', CPU(840, 255, { size: 150 }));
    stage.add('gpu', Node(1020, 300, 90, 70, { label: 'GPU', color: C.compute }));
    stage.add('mon', Monitor(1140, 270, { w: 130, h: 100 }));

    stage.trace('t_a', 'M200,340 H250', { label: '시스템 콜', at: [225, 326] });
    stage.trace('t_b', 'M400,340 H450', { label: 'NVMe 명령', at: [425, 326] });
    stage.trace('t_or', 'M535,395 V470', { label: '또는', at: [560, 436], dashed: true, thin: true });
    stage.trace('t_dma', 'M670,330 H720', { label: 'DMA', at: [695, 316] });
    stage.trace('t_rc', 'M777,330 H840', { label: 'L3→L1', at: [808, 316] });
    stage.trace('t_cg', 'M990,330 H1020');
    stage.trace('t_gm', 'M1110,335 H1140');
  },

  steps: [
    {
      title: '개요 — 이름에서 빛까지',
      body: `저장장치의 자기 신호·전하가 화면의 글자와 그림이 되기까지의 경로입니다. 핵심 개념은 <b>파일시스템, DMA, 메모리 계층</b> 세 가지 — 스크롤로 하나씩 만나 보세요.`,
      focus: null, lit: [],
    },
    {
      title: '열기 요청',
      body: `파일을 더블클릭하면 응용 프로그램이 OS에 <b>파일 열기 시스템 콜</b>을 보냅니다. 프로그램은 "이 이름의 파일을 달라"고 말할 뿐, 그 데이터가 디스크 어디에 어떻게 흩어져 있는지는 전혀 모릅니다.`,
      focus: ['app', 'fs'], lit: ['app'],
      traces: [{ id: 't_a', color: C.io }],
      flows: [{ trace: 't_a', color: C.io, n: 2, speed: 0.55 }],
    },
    {
      title: '파일시스템',
      body: `<code>NTFS</code>·<code>APFS</code>·<code>ext4</code> 같은 <b>파일시스템</b>이 파일 이름을 디스크 위의 블록 주소로 변환합니다. 그 전에 먼저 <b>RAM의 페이지 캐시</b>를 확인해서, 최근에 읽은 파일이면 디스크를 아예 건드리지 않습니다(캐시 적중).`,
      focus: ['fs', 'ssd'], lit: ['fs'],
      traces: [{ id: 't_b', color: C.storage }],
    },
    {
      title: '장치 읽기 — SSD vs HDD',
      body: `OS가 <b>NVMe 명령 큐</b>로 읽기 명령을 보냅니다. <b>SSD</b>는 컨트롤러가 FTL 매핑 테이블로 NAND 셀 위치를 찾아 <b>수십 µs</b> 만에 읽습니다. <b>HDD</b>는 액추에이터가 헤드를 옮기고 플래터가 돌아올 때까지 기다려 <b>수 ms</b> — SSD가 백 배쯤 빠른 이유이자, 낡은 컴퓨터가 SSD 하나로 살아나는 이유입니다.`,
      focus: ['fs', 'ssd', 'hdd'], lit: ['ssd', 'hdd'],
      traces: [{ id: 't_b', color: C.storage }, { id: 't_or', color: C.storage }],
      flows: [{ trace: 't_b', color: C.storage, n: 2, speed: 0.5 }],
    },
    {
      title: 'DMA 전송',
      body: `저장장치가 <b>DMA(Direct Memory Access)</b>로 데이터를 RAM에 직접 써 넣습니다 — <b>CPU를 거치지 않습니다</b>(그래서 CPU가 아직 어둡습니다). CPU는 그동안 다른 일을 하다가, 전송이 끝나면 <b>인터럽트</b>로 "다 됐다"는 알림만 받습니다.`,
      focus: ['ssd', 'ram', 'cpu'], lit: ['ssd', 'ram'],
      traces: [{ id: 't_dma', color: C.storage }],
      flows: [{ trace: 't_dma', color: C.storage, n: 3, speed: 0.55 }],
    },
    {
      title: 'CPU 해석',
      body: `<b>CPU</b>가 RAM의 바이트를 읽어 들여 텍스트 디코딩, 이미지 압축 해제 등 파일 형식에 맞는 가공을 합니다. 이때 데이터는 <b>캐시 계층(L3→L2→L1)</b>을 거쳐 코어에 도달합니다 — RAM보다 수십 배 빠른 층계참들입니다.`,
      focus: ['ram', 'cpu'], lit: ['ram', 'cpu'],
      traces: [{ id: 't_rc', color: C.memory }],
      flows: [{ trace: 't_rc', color: C.memory, n: 2, speed: 0.5 }],
    },
    {
      title: '화면 표시',
      body: `가공된 내용을 <b>GPU</b>가 그려 프레임버퍼에 쓰고 <b>모니터</b>로 내보냅니다 — 게임 아키텍처의 후반부와 동일한 경로입니다. 같은 파일을 다시 열면? 2단계의 페이지 캐시 덕분에 이번엔 디스크 없이 즉시 뜹니다.`,
      focus: ['cpu', 'gpu', 'mon'], lit: ['gpu', 'mon'],
      traces: [{ id: 't_cg', color: C.compute }, { id: 't_gm', color: C.io }],
      flows: [
        { trace: 't_cg', color: C.compute, n: 2, speed: 0.5 },
        { trace: 't_gm', color: C.io, n: 2, speed: 0.45 },
      ],
    },
    {
      title: '전체 경로 복기',
      body: `<b>더블클릭 → 파일시스템 → SSD(FTL→NAND) → DMA → RAM(페이지 캐시) → CPU(캐시 계층) → GPU → 모니터.</b> "속도 감각" 표를 떠올려 보세요: 레지스터가 1초라면 SSD는 이틀, HDD는 10개월 — 이 경로의 모든 캐시는 그 간극을 메우기 위해 존재합니다.`,
      focus: null, lit: ['app', 'fs', 'ssd', 'ram', 'cpu', 'gpu', 'mon'],
      traces: [
        { id: 't_a', color: C.io }, { id: 't_b', color: C.storage }, { id: 't_dma', color: C.storage },
        { id: 't_rc', color: C.memory }, { id: 't_cg', color: C.compute }, { id: 't_gm', color: C.io },
      ],
      flows: [
        { trace: 't_b', color: C.storage, n: 2, speed: 0.45 },
        { trace: 't_dma', color: C.storage, n: 2, speed: 0.5 },
        { trace: 't_rc', color: C.memory, n: 2, speed: 0.45 },
      ],
    },
  ],
});
