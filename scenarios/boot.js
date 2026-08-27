/* ============================================================
   아키텍처 №1 — 컴퓨터가 켜지는 과정 (부팅)
   메인보드 구성으로 컴포넌트를 조립하고,
   전원 → 펌웨어 → POST → 부트로더 → 커널 → 로그인 순서를 재생한다.
   ============================================================ */
import { defineScenario } from '../lib/scenario.js';
import { Board, CPU, GPU, RAM, SSD, Chipset, SPIFlash, PSU, Monitor, Fan, VRM, C } from '../lib/components.js';

defineScenario({
  id: 'boot',
  title: '전원 버튼을 누르면, 안에서 무슨 일이?',
  tagline: '전원 버튼 하나로 시작되는 릴레이 경주. 각 주자는 다음 주자를 저장장치에서 찾아 메모리에 올린다.',

  compose(stage) {
    stage.add('board', Board(250, 90, 780, 600));
    stage.add('mon', Monitor(40, 90));
    stage.add('psu', PSU(1080, 110));
    stage.add('vrm', VRM(480, 142));
    stage.add('fan', Fan(303, 153));
    stage.add('cpu', CPU(480, 210));
    stage.add('ram', RAM(700, 150, { h: 260, labelDy: -272 }));
    stage.add('pch', Chipset(550, 470));
    stage.add('spi', SPIFlash(455, 485));
    stage.add('ssd', SSD(695, 430));
    stage.add('gpu', GPU(300, 470));

    stage.trace('t_psu', 'M1080,190 C1055,190 1050,200 1030,200', { label: 'Power Good', at: [1055, 172] });
    stage.trace('t_spi', 'M471,485 V395 H480', { label: '리셋 벡터', at: [432, 442] });
    stage.trace('t_ram1', 'M640,262 H700', { label: '메모리 버스', at: [670, 246] });
    stage.trace('t_ram2', 'M640,286 H700');
    stage.trace('t_pcie16', 'M500,370 V430 H390 V470', { label: 'PCIe ×16', at: [452, 422] });
    stage.trace('t_pcie4', 'M640,330 H670 V450 H695');
    stage.trace('t_dmi', 'M590,370 V470', { label: 'DMI', at: [612, 424] });
    stage.trace('t_mon', 'M300,540 C240,540 205,510 205,450 L205,290 C205,262 190,246 165,246', { label: 'HDMI · DP', at: [243, 336] });
  },

  steps: [
    {
      title: '개요 — 부팅이라는 릴레이',
      lead: '전원 버튼 하나로 시작되는 릴레이 경주입니다.',
      points: [
        '<b>전원 장치 → 펌웨어 → 부트로더 → 운영체제</b>가 차례로 바통을 넘깁니다',
      ],
      detail: '스크롤·↓ 키로 한 단계씩. 애니메이션이 끝나기 전에는 넘어가지 않습니다.',
      focus: null, lit: [],
    },
    {
      title: '전원 공급',
      lead: '메인보드가 <b data-comp="psu">PSU</b>를 깨워 CPU에 안정된 전기를 흘립니다.',
      points: [
        '<b data-comp="psu">PSU</b>: AC 220V → DC <code>12·5·3.3V</code>',
        '<b data-comp="vrm">VRM</b>: 12V → CPU용 <code>~1V</code>',
        '<code>Power Good</code> 신호가 오면 CPU 리셋 해제',
      ],
      focus: ['psu', 'vrm', 'cpu'], lit: ['psu', 'vrm'],
      traces: [{ id: 't_psu', color: C.power }],
      flows: [{ trace: 't_psu', color: C.power, n: 2, speed: 0.5 }],
    },
    {
      title: '펌웨어 실행 (UEFI)',
      lead: '깨어난 CPU가 메인보드의 <b>UEFI 펌웨어</b>부터 실행합니다.',
      points: [
        '고정 주소(리셋 벡터)에서 첫 명령을 읽음',
        '그 주소는 <b data-comp="spi">SPI 플래시 롬</b>의 UEFI로 연결',
        'RAM 초기화 전이라 CPU 캐시를 임시 메모리로 사용',
      ],
      detail: 'x86 리셋 벡터는 <code>0xFFFFFFF0</code>. 이 방식을 Cache-as-RAM이라 부릅니다.',
      focus: ['spi', 'cpu'], lit: ['spi', 'cpu'],
      traces: [{ id: 't_spi', color: C.storage }],
      flows: [{ trace: 't_spi', color: C.storage, n: 2, speed: 0.45 }],
    },
    {
      title: 'POST — 자가 점검',
      lead: 'UEFI가 핵심 부품을 하나씩 점검하고 초기화합니다.',
      points: [
        '<b>CPU·RAM·GPU</b> 점검·초기화',
        '<b data-comp="ram">RAM</b>: 속도·타이밍을 맞추는 메모리 트레이닝',
        '이때부터 화면에 제조사 로고가 뜸',
      ],
      detail: '실패하면 비프음이나 진단 LED로 알립니다.',
      focus: ['cpu', 'ram', 'gpu'], lit: ['cpu', 'ram', 'gpu'],
      traces: [{ id: 't_ram1', color: C.memory }, { id: 't_ram2', color: C.memory }, { id: 't_pcie16', color: C.compute }],
      flows: [
        { trace: 't_ram1', color: C.memory, n: 2, speed: 0.55 },
        { trace: 't_ram2', color: C.memory, n: 2, speed: 0.55, reverse: true },
        { trace: 't_pcie16', color: C.compute, n: 2, speed: 0.35 },
      ],
    },
    {
      title: '부트로더 로드',
      lead: 'UEFI가 저장장치에서 부트로더를 찾아 RAM에 올립니다.',
      points: [
        '<b>NVMe·SATA</b>에서 EFI 시스템 파티션을 탐색',
        '부트로더(<code>Windows Boot Manager</code>·<code>GRUB</code>)를 RAM에 적재',
        '제어를 넘기면 펌웨어의 일은 여기까지',
      ],
      focus: ['cpu', 'pch', 'ssd'], lit: ['ssd', 'cpu'],
      traces: [{ id: 't_pcie4', color: C.storage }],
      flows: [{ trace: 't_pcie4', color: C.storage, n: 3, speed: 0.4, reverse: true }],
    },
    {
      title: '커널 적재',
      lead: '부트로더가 OS 커널을 <b>SSD → RAM</b>으로 읽어들입니다.',
      points: [
        '커널이 장치들을 자기 방식으로 다시 초기화',
        '파일시스템을 마운트',
        '백그라운드 서비스를 시작',
      ],
      focus: ['cpu', 'ram', 'ssd'], lit: ['ssd', 'ram', 'cpu'],
      traces: [{ id: 't_pcie4', color: C.storage }, { id: 't_ram1', color: C.memory }],
      flows: [
        { trace: 't_pcie4', color: C.storage, n: 3, speed: 0.45, reverse: true },
        { trace: 't_ram1', color: C.memory, n: 2, speed: 0.5 },
      ],
    },
    {
      title: '로그인 화면',
      lead: '그래픽 스택이 올라오면 <b data-comp="gpu">GPU</b>가 로그인 화면을 그립니다.',
      points: [
        '<b>GPU → 모니터</b>로 첫 화면을 출력',
        "이후는 '게임' 아키텍처와 같은 경로",
      ],
      detail: '전 과정이 빠른 SSD 기준 수 초 안에 끝납니다.',
      focus: ['gpu', 'mon'], lit: ['gpu', 'mon'],
      traces: [{ id: 't_pcie16', color: C.compute }, { id: 't_mon', color: C.io }],
      flows: [
        { trace: 't_pcie16', color: C.compute, n: 2, speed: 0.4 },
        { trace: 't_mon', color: C.io, n: 2, speed: 0.3 },
      ],
    },
    {
      title: '전체 경로 복기',
      lead: '<b>PSU → SPI 플래시 → CPU → RAM → SSD → GPU → 모니터</b>, 일곱 부품의 릴레이.',
      detail: '각 단계를 다시 보려면 왼쪽 목록을 클릭하거나 ↑ 키로 거슬러 올라가세요.',
      focus: null, lit: ['psu', 'spi', 'cpu', 'ram', 'ssd', 'gpu', 'mon'],
      traces: [
        { id: 't_psu', color: C.power }, { id: 't_spi', color: C.storage },
        { id: 't_ram1', color: C.memory }, { id: 't_pcie4', color: C.storage },
        { id: 't_pcie16', color: C.compute }, { id: 't_mon', color: C.io },
      ],
      flows: [
        { trace: 't_spi', color: C.storage, n: 1, speed: 0.35 },
        { trace: 't_pcie4', color: C.storage, n: 2, speed: 0.35, reverse: true },
        { trace: 't_mon', color: C.io, n: 2, speed: 0.25 },
      ],
    },
  ],
});
