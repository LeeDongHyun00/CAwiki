/* ============================================================
   아키텍처 №1 — 컴퓨터가 켜지는 과정 (부팅)
   메인보드 구성으로 컴포넌트를 조립하고,
   전원 → 펌웨어 → POST → 부트로더 → 커널 → 로그인 순서를 재생한다.
   ============================================================ */
import { defineScenario } from '../lib/scenario.js';
import { Board, CPU, GPU, RAM, SSD, Chipset, SPIFlash, PSU, Monitor, Fan, VRM, C } from '../lib/components.js';

defineScenario({
  id: 'boot',
  title: '부팅 — 전원에서 로그인까지',
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
      body: `전원 버튼을 누른 뒤 로그인 화면까지, <b>전원 장치 → 펌웨어 → 부트로더 → 운영체제</b>가 차례로 바통을 넘깁니다. 스크롤(또는 ↓ 키)로 한 단계씩 진행하세요 — 애니메이션이 끝나기 전에는 다음 단계로 넘어가지 않습니다.`,
      focus: null, lit: [],
    },
    {
      title: '전원 공급',
      body: `버튼 신호를 받은 메인보드가 <b>PSU</b>를 깨우고, PSU는 AC 220V를 DC <code>12V·5V·3.3V</code>로 변환합니다. 전압이 안정되면 <code>Power Good</code> 신호를 보내 CPU의 리셋을 해제합니다. <b>VRM</b>은 이 12V를 CPU가 쓰는 ~1V로 다시 정밀 변환합니다.`,
      focus: ['psu', 'vrm', 'cpu'], lit: ['psu', 'vrm'],
      traces: [{ id: 't_psu', color: C.power }],
      flows: [{ trace: 't_psu', color: C.power, n: 2, speed: 0.5 }],
    },
    {
      title: '펌웨어 실행 (UEFI)',
      body: `잠에서 깬 CPU는 정해진 고정 주소(리셋 벡터, x86은 <code>0xFFFFFFF0</code>)에서 첫 명령을 읽습니다. 이 주소는 메인보드의 <b>SPI 플래시 롬</b>에 저장된 <b>UEFI 펌웨어</b>로 연결됩니다. RAM이 아직 초기화 전이라, 초기에는 CPU 캐시를 임시 메모리처럼 씁니다(Cache-as-RAM).`,
      focus: ['spi', 'cpu'], lit: ['spi', 'cpu'],
      traces: [{ id: 't_spi', color: C.storage }],
      flows: [{ trace: 't_spi', color: C.storage, n: 2, speed: 0.45 }],
    },
    {
      title: 'POST — 자가 점검',
      body: `UEFI가 <b>CPU·RAM·GPU</b> 등 핵심 부품을 점검하고 초기화합니다. RAM은 속도와 타이밍을 맞추는 <b>메모리 트레이닝</b>을 거치며, 이 시점부터 화면에 제조사 로고가 뜹니다. 실패하면 비프음이나 진단 LED로 알립니다.`,
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
      body: `UEFI가 <b>NVMe·SATA 저장장치</b>를 탐색해 EFI 시스템 파티션을 찾고, 부트로더(<code>Windows Boot Manager</code>, <code>GRUB</code>)를 RAM에 올린 뒤 제어를 넘깁니다. 펌웨어의 일은 여기까지입니다.`,
      focus: ['cpu', 'pch', 'ssd'], lit: ['ssd', 'cpu'],
      traces: [{ id: 't_pcie4', color: C.storage }],
      flows: [{ trace: 't_pcie4', color: C.storage, n: 3, speed: 0.4, reverse: true }],
    },
    {
      title: '커널 적재',
      body: `부트로더가 OS 커널과 핵심 드라이버를 <b>SSD → RAM</b>으로 읽어들입니다. 커널은 장치들을 자기 방식으로 다시 초기화하고, 파일시스템을 마운트하고, 백그라운드 서비스를 시작합니다.`,
      focus: ['cpu', 'ram', 'ssd'], lit: ['ssd', 'ram', 'cpu'],
      traces: [{ id: 't_pcie4', color: C.storage }, { id: 't_ram1', color: C.memory }],
      flows: [
        { trace: 't_pcie4', color: C.storage, n: 3, speed: 0.45, reverse: true },
        { trace: 't_ram1', color: C.memory, n: 2, speed: 0.5 },
      ],
    },
    {
      title: '로그인 화면',
      body: `그래픽 스택이 올라오면 <b>GPU</b>가 로그인 화면을 그려 <b>모니터</b>로 내보냅니다. 여기서부터는 "게임 조작이 화면이 되기까지" 아키텍처와 같은 경로입니다. 전 과정이 빠른 SSD 기준 수 초 안에 끝납니다.`,
      focus: ['gpu', 'mon'], lit: ['gpu', 'mon'],
      traces: [{ id: 't_pcie16', color: C.compute }, { id: 't_mon', color: C.io }],
      flows: [
        { trace: 't_pcie16', color: C.compute, n: 2, speed: 0.4 },
        { trace: 't_mon', color: C.io, n: 2, speed: 0.3 },
      ],
    },
    {
      title: '전체 경로 복기',
      body: `<b>PSU → SPI 플래시(UEFI) → CPU → RAM → SSD → GPU → 모니터.</b> 일곱 부품의 릴레이가 완성되었습니다. 각 단계를 다시 보려면 왼쪽 목록을 클릭하거나 ↑ 키로 거슬러 올라가세요.`,
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
