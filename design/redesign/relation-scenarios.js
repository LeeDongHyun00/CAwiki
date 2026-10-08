// These steps express causal stages, not a literal cable or timing simulation.
export const RELATION_GROUPS=[
 {id:'compute',title:'명령과 메모리',copy:'계산할 정보는 어디에서 올까요',focus:'cpu',nodes:['cpu','sram','dram','npu','coproc']},
 {id:'graphics',title:'화면과 그래픽',copy:'계산이 한 장의 화면이 되기까지',focus:'gpu',nodes:['gpu','cpu','vram','display','bus']},
 {id:'storage',title:'저장과 실행',copy:'보관한 파일을 작업 공간으로',focus:'ssd',nodes:['ssd','hdd','dram','cpu','bus','coproc']},
 {id:'io',title:'입력과 출력',copy:'사람의 동작과 컴퓨터가 만나는 곳',focus:'bus',nodes:['bus','input','mouse','camera','audio','coproc','mainboard']},
 {id:'network',title:'네트워크',copy:'내 컴퓨터에서 다른 컴퓨터까지',focus:'nic',nodes:['nic','infra','datacenter','cpu','dram','mainboard']},
 {id:'power',title:'전원과 냉각',copy:'모든 연결이 계속 작동할 수 있도록',focus:'mainboard',nodes:['mainboard','power','vrm','cooling','cpu','spirom']},
];
const step=(title,copy,focus,nodes)=>({title,copy,focus,nodes:[focus,...nodes]});
export const RELATION_SCENARIOS=[
 {id:'boot',title:'전원이 켜지는 순간',topic:'부팅과 실행',film:'boot',steps:[
  step('안정된 전원을 준비하다','전원 요청을 받은 PSU와 전원 회로가 각 부품에 필요한 전압을 준비합니다','power',['vrm','mainboard','cpu']),
  step('첫 명령을 실행하다','CPU가 SPI 플래시의 펌웨어를 실행해 메모리와 장치를 초기화합니다','cpu',['spirom','dram','mainboard']),
  step('운영체제를 불러오다','부트로더가 저장장치의 필요한 코드를 RAM에 올리고 CPU가 실행합니다','dram',['ssd','cpu']),
  step('첫 화면을 표시하다','운영체제가 그래픽 출력을 준비하고 GPU가 모니터로 화면을 보냅니다','gpu',['cpu','vram','display']),
 ]},
 {id:'game',title:'클릭이 픽셀이 되기까지',topic:'화면과 그래픽',film:'game',steps:[
  step('입력을 전달하다','마우스의 입력 보고서가 호스트 컨트롤러와 운영체제를 거쳐 게임에 전달됩니다','mouse',['bus','cpu']),
  step('게임 상태를 갱신하다','CPU가 캐시와 RAM의 정보를 사용해 게임 규칙과 물리를 처리합니다','cpu',['sram','dram','gpu']),
  step('한 프레임을 그리다','GPU가 명령을 실행하고 VRAM의 데이터를 읽고 결과를 기록합니다','gpu',['cpu','vram']),
  step('변화를 눈에 전달하다','디스플레이 엔진이 프레임을 출력하고 모니터가 빛으로 바꿉니다','display',['gpu','vram']),
 ]},
 {id:'search',title:'검색 한 번의 여정',topic:'네트워크',film:'search',steps:[
  step('요청을 준비하다','브라우저가 CPU와 RAM을 사용해 검색 요청을 만들고 주소와 연결을 확인합니다','cpu',['dram','nic','input']),
  step('컴퓨터 밖으로 보내다','NIC가 보낸 패킷을 라우터들이 목적지로 전달합니다 HTTPS의 내용은 암호화됩니다','nic',['infra','dram']),
  step('서버에서 처리하다','데이터센터의 서버가 요청을 처리하고 응답합니다 왕복 경로는 서로 다를 수 있습니다','datacenter',['infra','nic','cpu','dram']),
  step('응답을 화면으로 만들다','브라우저가 응답을 해석해 레이아웃과 화면을 구성합니다 패킷이 곧바로 픽셀이 되는 것은 아닙니다','gpu',['cpu','dram','display']),
 ]},
 {id:'storage',title:'파일을 여는 순간',topic:'저장과 파일',film:'storage',steps:[
  step('파일 캐시를 확인하다','운영체제가 파일을 찾습니다 RAM의 파일 캐시에 이미 있으면 저장장치 읽기를 생략합니다','cpu',['dram','ssd','mouse']),
  step('작업 공간으로 읽다','읽기가 필요하면 SSD 또는 HDD가 데이터를 메모리로 전송합니다 DMA 전송은 CPU가 준비하고 장치가 수행합니다','dram',['ssd','hdd','cpu']),
  step('내용을 해석하다','CPU가 캐시와 RAM의 데이터를 사용해 파일 형식을 해석합니다','cpu',['sram','dram']),
  step('결과를 표시하다','애플리케이션의 처리 결과가 그래픽 출력을 거쳐 화면에 보입니다','gpu',['cpu','vram','display']),
 ]},
 {id:'typing',title:'키 하나가 글자가 되기까지',topic:'소리와 입력',steps:[
  step('눌린 키를 감지하다','키보드 컨트롤러가 키 매트릭스를 읽고 입력 보고서를 만듭니다','input',['coproc','bus']),
  step('프로그램에 전달하다','운영체제와 입력기가 키 이벤트를 해석해 애플리케이션에 전달합니다','cpu',['input','bus','dram']),
  step('글자의 모양을 그리다','애플리케이션이 글꼴과 배치를 처리하고 그래픽 시스템이 화면을 구성합니다','gpu',['cpu','vram']),
  step('화면에 나타나다','완성된 프레임이 모니터로 출력되어 입력한 글자가 보입니다','display',['gpu','vram']),
 ]},
 {id:'launch',title:'더블클릭에서 프로그램 실행까지',topic:'부팅과 실행',steps:[
  step('실행을 요청하다','마우스 입력을 받은 운영체제가 실행 파일과 필요한 라이브러리를 찾습니다','cpu',['mouse','ssd']),
  step('주소 공간을 준비하다','운영체제가 프로세스의 가상 주소 공간을 만들고 필요한 페이지를 메모리에 연결합니다','cpu',['dram','ssd']),
  step('필요한 코드를 가져오다','아직 메모리에 없는 페이지는 접근할 때 읽어올 수 있습니다 프로그램 전체를 한 번에 읽는 것은 아닙니다','dram',['ssd','cpu','sram']),
  step('명령을 실행하다','CPU 내부의 MMU와 TLB가 주소 변환을 돕고 코어가 캐시의 명령을 실행합니다','cpu',['sram','dram','gpu']),
 ]},
 {id:'save',title:'Ctrl+S 한 번의 여정',topic:'저장과 파일',steps:[
  step('저장을 요청하다','키 입력을 받은 앱이 변경한 내용을 파일 시스템에 쓰도록 요청합니다','cpu',['input','dram']),
  step('쓰기 데이터를 모으다','운영체제는 쓰기를 메모리에 모아 처리할 수 있습니다 화면의 저장 표시는 물리 매체 기록과 다를 수 있습니다','dram',['cpu','ssd']),
  step('플래시에 기록하다','SSD 컨트롤러가 논리 주소를 NAND 위치에 연결하고 오류 정정과 기록을 수행합니다','ssd',['coproc','bus','dram']),
  step('지속성을 확인하다','동기화 요청과 장치의 완료 응답으로 필요한 데이터의 지속성을 보장합니다 보장 범위는 OS·장치·전원 보호에 따라 다릅니다','ssd',['cpu','power']),
 ]},
 {id:'music',title:'음악이 스피커에서 나오기까지',topic:'소리와 입력',steps:[
  step('음악을 읽다','앱이 저장장치의 압축된 오디오 데이터를 메모리로 읽습니다','dram',['ssd','cpu']),
  step('소리의 숫자를 복원하다','CPU 또는 전용 장치가 압축을 풀어 PCM 샘플을 만듭니다','cpu',['dram','audio']),
  step('끊기지 않게 전달하다','메모리의 오디오 버퍼와 DMA가 일정한 속도로 코덱에 샘플을 공급합니다','audio',['dram','bus','coproc']),
  step('공기를 움직이다','DAC가 아날로그 신호를 만들고 앰프와 스피커가 실제 진동으로 바꿉니다','audio',['power']),
 ]},
 {id:'streaming',title:'버퍼링 뒤에서 일어나는 일',topic:'네트워크',steps:[
  step('영상 조각을 요청하다','플레이어가 서버의 영상 조각을 요청하고 네트워크 상태에 따라 화질을 조절합니다','nic',['infra','datacenter','cpu']),
  step('앞부분을 미리 담다','받은 압축 데이터를 메모리 버퍼에 쌓아 네트워크 속도 변동을 흡수합니다','dram',['nic','cpu']),
  step('영상과 소리를 해석하다','지원하는 형식은 GPU의 비디오 디코더를 활용하고 소리도 디코딩합니다 지원하지 않으면 CPU가 처리할 수 있습니다','gpu',['cpu','dram','audio']),
  step('같은 시간에 재생하다','프레임과 오디오의 시간 정보를 맞춰 화면과 스피커에 재생합니다','display',['gpu','audio']),
 ]},
 {id:'call',title:'내 얼굴이 상대방에게 닿기까지',topic:'네트워크',steps:[
  step('빛과 소리를 받다','웹캠 센서와 ISP가 영상을 만들고 마이크와 ADC가 소리를 디지털화합니다','camera',['coproc','audio','bus']),
  step('전송할 크기로 줄이다','앱이 CPU 또는 GPU의 인코더로 영상을 압축하고 오디오와 시간 정보를 맞춥니다','gpu',['camera','cpu','dram']),
  step('네트워크로 보내다','앱이 압축 데이터를 패킷으로 보내고 지연과 손실에 대응합니다 실제 경로는 중계 서버 사용 여부에 따라 달라집니다','nic',['camera','gpu','infra']),
  step('상대편에서 복원하다','상대편 장치가 데이터를 받아 디코딩하고 버퍼와 시간 정보를 이용해 화면과 소리를 재생합니다','display',['gpu','audio']),
 ]},
 {id:'multitasking',title:'여러 프로그램이 동시에 도는 법',topic:'부팅과 실행',steps:[
  step('작업을 메모리에 준비하다','운영체제가 각 프로세스의 코드와 데이터를 관리합니다 가상 주소 공간은 서로 구분됩니다','dram',['cpu','ssd']),
  step('실행할 작업을 고르다','CPU에서 실행되는 운영체제 스케줄러가 준비된 작업을 코어에 배정합니다','cpu',['dram']),
  step('상태를 저장하고 바꾸다','작업을 바꿀 때 레지스터 등의 실행 상태를 저장하고 다음 작업의 상태를 복원합니다','cpu',['sram','dram']),
  step('다른 작업을 보호하다','CPU의 주소 변환과 보호 기능을 운영체제가 설정해 프로세스가 서로의 메모리를 함부로 읽지 못하게 합니다','cpu',['dram','sram']),
 ]},
 {id:'usb',title:'USB를 꽂는 순간',topic:'소리와 입력',steps:[
  step('연결을 감지하다','호스트 컨트롤러가 포트 상태 변화를 감지합니다 USB는 연결 규약이며 장치 종류는 다양합니다','bus',['mainboard','input']),
  step('장치를 알아보다','운영체제가 장치 설명자를 읽고 주소와 구성을 정합니다 이것이 열거 과정입니다','cpu',['bus','coproc']),
  step('드라이버를 연결하다','운영체제가 해당 기능을 다루는 드라이버를 연결합니다 이미 메모리에 있으면 다시 읽지 않아도 됩니다','cpu',['dram','ssd']),
  step('데이터를 주고받다','키보드라면 입력 보고서, 웹캠이라면 영상 데이터처럼 장치 종류에 맞는 전송을 시작합니다','bus',['input','camera','audio']),
 ]},
 {id:'sleep',title:'잠들었다가 다시 깨어나는 법',topic:'전원과 지능',steps:[
  step('작업 상태를 유지하다','여기서는 RAM의 내용을 유지하는 대기 상태를 봅니다 최대 절전은 저장장치에 상태를 보관하는 다른 방식입니다','dram',['cpu','power']),
  step('전력 사용을 줄이다','플랫폼의 전원 관리 기능이 장치별 전력 상태를 조절합니다 구체적인 상태는 기기와 OS에 따라 다릅니다','power',['coproc','cpu','display']),
  step('깨우기 신호를 받다','지원되는 버튼이나 입력 신호를 전원 관리 회로가 감지하고 필요한 전원을 복원합니다','power',['input','coproc','vrm']),
  step('작업을 이어가다','운영체제가 장치를 복구하고 남아 있는 메모리의 실행 상태를 사용해 작업을 이어갑니다','cpu',['dram','gpu']),
 ]},
 {id:'ai',title:'질문이 AI의 답으로 돌아오기까지',topic:'전원과 지능',steps:[
  step('질문을 보내다','클라우드 AI의 예시입니다 앱이 질문을 구성하고 서버로 전송합니다','nic',['cpu','dram','infra']),
  step('서버가 추론을 준비하다','서버가 모델과 요청을 준비합니다 가속기 종류와 모델 배치는 서비스마다 다릅니다','datacenter',['gpu','vram','dram']),
  step('다음 토큰을 계산하다','GPU 등 가속기가 모델의 가중치를 읽고 행렬 계산을 수행합니다 메모리 용량과 대역폭이 성능에 영향을 줍니다','gpu',['vram','sram','datacenter']),
  step('응답을 표시하다','결과가 네트워크로 돌아와 앱에 표시됩니다 기기 내 AI는 서버 왕복 대신 NPU·GPU 등을 사용할 수 있습니다','cpu',['nic','gpu','npu']),
 ]},
 {id:'loading',title:'게임 로딩 화면의 정체',topic:'저장과 파일',steps:[
  step('에셋을 찾다','게임이 다음 장면에 필요한 모델·텍스처·소리 등의 파일을 요청합니다','cpu',['ssd','dram']),
  step('메모리로 읽다','저장장치가 데이터를 전송합니다 빠른 SSD도 CPU 처리나 메모리 대역폭이 부족하면 대기할 수 있습니다','ssd',['bus','dram','cpu']),
  step('그릴 준비를 하다','압축 해제와 리소스 준비를 거칩니다 일부 경로는 GPU 압축 해제 등을 활용하지만 모든 게임이 같은 방식은 아닙니다','gpu',['cpu','dram','vram','ssd']),
  step('첫 프레임을 내보내다','필요한 리소스가 준비되면 GPU가 프레임을 그리고 모니터에 출력합니다','gpu',['vram','display']),
 ]},
 {id:'record',title:'화면이 영상 파일이 되기까지',topic:'화면과 그래픽',steps:[
  step('화면의 결과를 얻다','캡처 API가 프레임을 제공합니다 화면을 카메라로 다시 찍는 것이 아니라 이미 계산한 결과를 사용합니다','gpu',['vram','cpu']),
  step('영상으로 압축하다','CPU 또는 GPU의 비디오 인코더가 프레임들을 압축합니다 스크린샷은 한 장의 이미지로 저장하는 별도 경우입니다','gpu',['cpu','vram','dram']),
  step('파일 데이터를 모으다','앱이 압축 데이터와 시간 정보를 파일 형식으로 묶고 메모리에 버퍼링합니다','dram',['cpu','gpu','ssd']),
  step('저장장치에 남기다','파일 시스템과 저장장치가 데이터를 기록합니다 인코딩 속도와 저장 속도가 부족하면 프레임이 누락될 수 있습니다','ssd',['dram','cpu','bus']),
 ]},
];
export const RELATION_KINDS={data:'데이터·제어',power:'전원',thermal:'냉각',structure:'장착·구성',context:'활용·비교'};
