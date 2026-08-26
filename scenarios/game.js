/* ============================================================
   아키텍처 №2 — 게임 조작이 화면이 되기까지 (input-to-photon)
   같은 컴포넌트를 이번엔 가로 파이프라인으로 조립한다.
   ============================================================ */
import { defineScenario } from '../lib/scenario.js';
import { CPU, GPU, RAM, Monitor, Keyboard, Mouse, Node, C } from '../lib/components.js';

defineScenario({
  id: 'game',
  title: '게임 — 클릭에서 픽셀까지',
  tagline: '조작 한 번이 빛이 되기까지의 파이프라인. 게임 업계는 이 전체 지연을 input-to-photon latency라 부른다.',

  compose(stage) {
    stage.add('kb', Keyboard(50, 280));
    stage.add('mouse', Mouse(95, 400));
    stage.add('usb', Node(250, 320, 120, 76, { label: 'USB 컨트롤러', sub: '폴링 1000Hz', color: C.io }));
    stage.add('ram', RAM(470, 44, { h: 160, labelDy: -172 }));
    stage.add('cpu', CPU(430, 240, { size: 150 }));
    stage.add('gpu', GPU(680, 230));
    stage.add('mon', Monitor(1040, 250, { w: 170, h: 120 }));

    stage.trace('t_kb', 'M217,312 C238,312 240,332 250,340');
    stage.trace('t_mouse', 'M140,433 C190,433 215,392 250,376');
    stage.trace('t_usb', 'M370,358 C400,358 402,320 430,315', { label: '인터럽트', at: [398, 296] });
    stage.trace('t_ram', 'M505,240 V204', { label: '메모리 버스', at: [560, 224] });
    stage.trace('t_pcie', 'M580,315 H680', { label: 'PCIe 5.0 ×16', at: [630, 301] });
    stage.trace('t_hdmi', 'M860,300 H1040', { label: 'HDMI · DP', at: [950, 286] });
  },

  steps: [
    {
      title: '개요 — 초당 수백 번의 왕복',
      body: `마우스 클릭이 모니터의 빛이 되기까지 <b>입력 장치 → CPU → GPU → 모니터</b>를 지납니다. 이 전체 경로가 초당 60~240번 반복됩니다. 스크롤로 한 단계씩 따라가 보세요.`,
      focus: null, lit: [],
    },
    {
      title: '입력 감지',
      body: `마우스의 광 센서와 키보드의 키 매트릭스가 조작을 감지합니다. <b>USB 컨트롤러</b>가 최대 <code>1000Hz</code>로 장치를 폴링해 데이터를 받고, <b>인터럽트</b>로 CPU에 알립니다. OS는 이를 입력 이벤트로 만들어 게임에 전달합니다.`,
      focus: ['kb', 'mouse', 'usb'], lit: ['kb', 'mouse', 'usb'],
      traces: [{ id: 't_kb', color: C.io }, { id: 't_mouse', color: C.io }],
      flows: [
        { trace: 't_kb', color: C.io, n: 2, speed: 0.5 },
        { trace: 't_mouse', color: C.io, n: 2, speed: 0.5 },
      ],
    },
    {
      title: '게임 루프 (CPU)',
      body: `<b>CPU</b>가 입력을 반영해 물리·충돌·AI·게임 로직을 계산하고, 이번 프레임에 그릴 대상 목록을 확정합니다. 게임의 상태와 데이터는 <b>RAM</b>을 쉼 없이 오가며 처리됩니다.`,
      focus: ['usb', 'cpu', 'ram'], lit: ['cpu', 'ram'],
      traces: [{ id: 't_usb', color: C.io }, { id: 't_ram', color: C.memory }],
      flows: [
        { trace: 't_usb', color: C.io, n: 2, speed: 0.5 },
        { trace: 't_ram', color: C.memory, n: 2, speed: 0.6 },
        { trace: 't_ram', color: C.memory, n: 2, speed: 0.6, reverse: true },
      ],
    },
    {
      title: '드로우콜',
      body: `게임이 그래픽 API(<code>DirectX</code>·<code>Vulkan</code>)를 호출하면, 드라이버가 이를 GPU 명령 버퍼로 번역해 <b>PCIe ×16</b> 버스(방향당 ~64GB/s)로 GPU에 보냅니다. "무엇을 그릴지"는 CPU가, "그리는 일"은 GPU가 맡는 분업입니다.`,
      focus: ['cpu', 'gpu'], lit: ['cpu', 'gpu'],
      traces: [{ id: 't_pcie', color: C.compute }],
      flows: [{ trace: 't_pcie', color: C.compute, n: 3, speed: 0.5 }],
    },
    {
      title: 'GPU 렌더링',
      body: `<b>정점 셰이더</b>가 3D 좌표를 화면 좌표로 바꾸고, <b>래스터라이저</b>가 삼각형을 픽셀로 쪼개고, <b>픽셀 셰이더</b>가 색·조명·텍스처를 계산합니다. 수천 개의 셰이더 코어가 픽셀들을 동시에 처리해, 완성된 프레임을 <b>VRAM의 프레임버퍼</b>에 기록합니다.`,
      focus: ['gpu'], lit: ['gpu'], maxS: 2.6,
    },
    {
      title: '스캔아웃',
      body: `GPU의 <b>디스플레이 엔진</b>이 주사율(60–240Hz)에 맞춰 프레임버퍼를 줄 단위로 읽어 <b>HDMI·DisplayPort</b> 신호로 내보냅니다. 렌더링 속도와 주사율의 어긋남(화면 찢어짐)을 다루는 것이 V-Sync와 가변 주사율(G-Sync·FreeSync)입니다.`,
      focus: ['gpu', 'mon'], lit: ['gpu', 'mon'],
      traces: [{ id: 't_hdmi', color: C.io }],
      flows: [{ trace: 't_hdmi', color: C.io, n: 3, speed: 0.4 }],
    },
    {
      title: '발광',
      body: `모니터의 <b>TCON</b>이 신호를 받아 각 픽셀을 구동하고, 백라이트+액정(LCD) 또는 자발광 소자(OLED)가 빛을 냅니다. 클릭부터 여기까지 — 잘 맞춘 시스템에서 <b>수십 ms</b>. 프로게이머들이 고주사율 모니터를 쓰는 이유가 이 경로에 있습니다.`,
      focus: ['mon'], lit: ['mon'], maxS: 2.4,
    },
    {
      title: '전체 파이프라인 복기',
      body: `<b>입력 장치 → USB → CPU(게임 루프) → PCIe → GPU(렌더링) → 프레임버퍼 → 스캔아웃 → 모니터.</b> 이 왕복이 매 프레임 반복됩니다. 부팅 아키텍처의 마지막 단계(로그인 화면 표시)도 사실 이 경로의 후반부였습니다.`,
      focus: null, lit: ['kb', 'mouse', 'usb', 'cpu', 'ram', 'gpu', 'mon'],
      traces: [
        { id: 't_kb', color: C.io }, { id: 't_mouse', color: C.io }, { id: 't_usb', color: C.io },
        { id: 't_ram', color: C.memory }, { id: 't_pcie', color: C.compute }, { id: 't_hdmi', color: C.io },
      ],
      flows: [
        { trace: 't_usb', color: C.io, n: 2, speed: 0.45 },
        { trace: 't_pcie', color: C.compute, n: 2, speed: 0.45 },
        { trace: 't_hdmi', color: C.io, n: 2, speed: 0.35 },
      ],
    },
  ],
});
