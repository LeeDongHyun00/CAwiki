import { EXTENDED_SCENARIOS } from 'inside/scenario-extended-data';
// Scroll positions describe explanatory order, not physical elapsed time.
const gameSteps=[
 {at:0,tag:'MOUSE / SWITCH',en:'INPUT',title:'손끝에서 시작된 변화',copy:'클릭 한 번이 어떻게 화면을 바꿀까요?',detail:'스위치의 상태가 바뀌면 마우스 컨트롤러가 버튼 상태를 입력 보고서로 만듭니다 USB 연결을 사용하는 경우의 입력 흐름입니다',focus:[-9,-.4,1],offset:[3,4.7,-6.5]},
 {at:.18,tag:'USB → CPU',en:'INPUT REPORT',title:'입력을 읽다',copy:'운영체제가 입력을 전달하고, 게임이 클릭을 읽습니다',detail:'USB 호스트 컨트롤러와 드라이버를 통해 들어온 입력을 운영체제가 전달합니다 게임은 그 이벤트를 읽습니다 화면의 빛은 이벤트 전달 경로를 표현하며, 전자가 CPU까지 직접 이동한다는 뜻이 아닙니다',focus:[-.72,-1.5,-1.56],offset:[1.4,2.8,3.4]},
 {at:.36,tag:'CPU ↔ RAM',en:'UPDATE STATE',title:'다음 상태를 계산하다',copy:'CPU가 메모리의 정보를 읽고 게임 상태를 갱신합니다',detail:'CPU는 캐시와 RAM의 게임 데이터를 사용해 입력, 물리, 게임 규칙을 처리합니다 RAM은 작업 중인 데이터를 보관합니다 이 장면에서는 상태 변화가 중심이고 모든 캐시 접근을 하나씩 재현하지는 않습니다',focus:[.5,-.7,-1.35],offset:[3,5,6.2]},
 {at:.55,tag:'CPU → GPU',en:'DRAW COMMANDS',title:'그리기를 요청하다',copy:'CPU가 준비한 그래픽 명령을 GPU가 실행합니다',detail:'그래픽 API와 드라이버가 준비한 명령 버퍼를 GPU의 큐가 처리합니다 명령 제출과 데이터 이동을 빛의 경로로 축약했습니다 실제로 CPU와 GPU는 여러 프레임의 작업을 겹쳐 수행할 수 있습니다',focus:[0,-1.4,3.6],offset:[5,8,10]},
 {at:.74,tag:'GPU ↔ VRAM',en:'RENDER FRAME',title:'한 프레임을 만들다',copy:'GPU가 장면을 그리고 결과를 VRAM에 기록합니다',detail:'GPU는 VRAM의 텍스처와 기하 데이터를 읽어 셰이딩·래스터화 등을 수행합니다 렌더 타깃에 기록된 색상 결과가 한 프레임을 이룹니다 작은 픽셀 격자는 결과를 크게 확대한 개념 표현입니다',focus:[-.8,-2,6.5],offset:[4,7,9]},
 {at:.92,tag:'FRAME → DISPLAY',en:'VISIBLE CHANGE',title:'변화가 눈에 닿다',copy:'완성된 프레임이 출력되고, 클릭의 결과가 보입니다',detail:'디스플레이 엔진이 프레임 버퍼를 읽어 HDMI 또는 DisplayPort 신호로 출력합니다 디스플레이는 주사와 갱신에 맞춰 화면을 바꿉니다 한 프레임의 인과관계를 느리게 펼쳐 보여줍니다',focus:[10,1.5,5],offset:[.5,1.4,13]},
];
const step=(at,en,title,copy,detail,focus,offset,tag,fallback,fit=1.9)=>({at,en,title,copy,detail,focus,offset,tag,fallback,fit});
const gameParts=['cpu','dram','gpu','ssd','vrm','coproc','spirom','io'];
gameSteps.forEach((b,i)=>{b.fallback=['mouse','cpu','dram','gpu','gpu','display'][i];b.fit=[1.5,1.65,1.9,2.05,2.1,2.25][i];});
const gamePaths=[
 {window:[.045,.18],points:[[-9,.1,-.5],[-7,.3,-4],[-3,.1,-4],[-.72,-1.1,-1.56]]},
 {window:[.27,.54],points:[[-.72,-1.2,-1.56],[.2,.7,-1.6],[2,-.9,-1.3],[1.5,.7,-.7],[-.72,-1.2,-1.56]]},
 {window:[.51,.7],points:[[-.72,-1.2,-1.56],[-3,.5,.3],[-3.5,.5,4],[0,-.8,6.75]]},
 {window:[.72,.85],bind:'gpu',points:[[-1,-2.25,6.72],[-1.4,-1.95,6.4],[-1.85,-2.25,6.15],[-1.25,-2.05,6.05],[-1,-2.25,6.72]]},
 {window:[.86,.975],points:[[0,-.8,6.75],[4,.4,8.2],[8,.7,7],[10,1.4,5.2]]},
];
export const SCENARIOS={
 game:{title:'클릭이 픽셀이 되기까지',en:'INPUT TO PIXEL',cover:'gpu',steps:gameSteps,parts:gameParts,extras:['mouse'],paths:gamePaths,screen:[.88,.985]},
 boot:{title:'전원이 켜지는 순간',en:'POWER TO POSSIBILITY',cover:'mainboard',parts:[...gameParts,'power'],extras:[],screen:[.83,.98],steps:[
  step(0,'POWER ON','전원이 흐르기 시작하다','전원 요청을 받은 PSU가 주 전원을 공급합니다','ATX 시스템에서는 대기 전원으로 켜기 요청을 받고, PSU가 주 전원을 활성화합니다 전압이 안정되었다는 신호 뒤에 CPU가 실행을 시작할 수 있습니다',[5.2,-.3,-2.2],[6,7,9],'PSU → POWER RAILS','power',2.1),
  step(.16,'STABLE VOLTAGE','작동할 준비를 갖추다','VRM이 CPU에 맞는 낮고 안정된 전압을 만듭니다','PSU 전압을 그대로 CPU 코어에 넣지 않습니다 메인보드 VRM의 스위칭 회로가 필요한 전압으로 변환하고 조절합니다',[-1.9,-1.1,-1.5],[2.3,3.4,4.3],'VRM → CPU','vrm',1.85),
  step(.32,'FIRST INSTRUCTION','첫 명령을 읽다','CPU가 플래시에 저장된 펌웨어를 실행합니다','메인보드 SPI 플래시의 펌웨어가 초기 실행을 맡습니다 운영체제보다 먼저 메모리와 핵심 장치를 준비합니다 메모리 초기화 전의 임시 실행 환경 등 세부 과정은 축약했습니다',[.936,-1.6,3.168],[.65,1.2,1.4],'SPI FLASH → CPU','spirom',1.7),
  step(.48,'INITIALIZE','메모리를 깨우다','펌웨어가 메모리와 핵심 장치를 초기화합니다','CPU가 실행하는 펌웨어는 DRAM을 사용할 수 있도록 초기화하고 장치를 점검합니다 메모리는 스스로 컴퓨터를 검사하는 주체가 아닙니다',[.5,-.7,-1.35],[3,5,6.2],'CPU ↔ DDR5','dram',1.9),
  step(.67,'LOAD THE SYSTEM','운영체제를 불러오다','부트로더와 운영체제 커널이 RAM에 올라옵니다','펌웨어가 부팅할 장치를 선택하고 부트로더로 실행을 넘깁니다 저장장치에 보관된 운영체제의 필요한 부분이 RAM으로 읽힌 뒤 CPU가 실행합니다',[.24,-1.4,-.28],[1.8,3.2,4.2],'SSD → RAM → CPU','ssd',1.9),
  step(.9,'READY','하나의 컴퓨터가 되다','운영체제가 실행되고 첫 화면이 나타납니다','운영체제가 드라이버와 서비스를 준비하고 그래픽 출력을 구성합니다 화면은 GPU의 디스플레이 엔진을 통해 표시됩니다 이 흐름은 대표적인 PC 부팅 과정을 단순화한 것입니다',[10,1.5,5],[.5,1.4,13],'SYSTEM → DISPLAY','display',2.25),
 ],paths:[
  {window:[.025,.18],points:[[5.1,-.7,-.8],[3,-.3,-4.8],[-2.6,-.8,-4],[-2,-1.4,-1.5]]},
  {window:[.18,.31],points:[[-2,-1.35,-1.5],[-1.5,-.6,-1.9],[-.8,-.7,-1.5],[-.72,-1.2,-1.56]]},
  {window:[.35,.47],points:[[.936,-1.5,3.168],[1,-.8,1],[-.8,-.2,-.1],[-.72,-1.1,-1.56]]},
  {window:[.5,.65],points:[[-.72,-1.2,-1.56],[.2,.5,-2],[2,-.9,-1.3],[1.2,.5,-.5],[-.72,-1.2,-1.56]]},
  {window:[.7,.86],points:[[.24,-1.35,-.28],[.5,.3,.4],[2,.3,.1],[2,-.9,-1.3]]},
  {window:[.87,.98],points:[[0,-1.5,6.75],[4,.4,8.2],[8,.7,7],[10,1.4,5.2]]},
 ]},
 search:{title:'검색 한 번의 여정',en:'ACROSS THE NETWORK',cover:'datacenter',parts:[...gameParts,'nic'],extras:['input','infra','datacenter'],screen:[.84,.99],steps:[
  step(0,'A QUESTION','질문 하나를 보내다','브라우저가 검색어로 요청을 준비합니다','키보드 입력이 운영체제를 거쳐 브라우저에 전달됩니다 브라우저는 검색 서비스로 보낼 요청을 준비합니다',[-9,-.2,1],[3,5.2,8],'KEYBOARD → BROWSER','input',2),
  step(.16,'ADDRESS & CONNECTION','갈 곳을 확인하다','주소를 확인하고 안전한 연결을 준비합니다','DNS로 서버 주소를 확인하고 HTTPS 통신에 필요한 연결을 준비합니다 주소가 캐시에 있거나 연결을 재사용하는 경우 일부 과정은 생략됩니다 이번 흐름은 새 연결의 예입니다',[-.8,-.4,2.2],[3.5,4.5,6.5],'DNS · HTTPS','nic',2),
  step(.34,'ACROSS THE NETWORK','컴퓨터 밖으로 나가다','요청이 라우터와 인터넷을 거쳐 이동합니다','운영체제의 네트워크 스택과 NIC가 통신을 수행합니다 라우터들은 목적지 주소에 따라 패킷을 전달합니다 HTTPS의 내용을 중간 라우터가 평문으로 읽는 것으로 표현하지 않습니다',[10,.1,-7],[3,4,7],'NIC → ROUTER → INTERNET','infra',1.85),
  step(.52,'SERVER WORK','서버가 답을 만들다','서버가 검색을 처리하고 응답을 준비합니다','데이터센터의 서버들이 검색을 처리합니다 실제 서비스는 여러 서버와 저장소를 사용할 수 있으며, 여기서는 요청을 받아 결과를 만드는 관계에 집중합니다',[23,3,-8],[7,4,12],'REQUEST → RESPONSE','datacenter',1.7),
  step(.7,'THE RETURN','답이 돌아오다','응답 데이터가 내 컴퓨터의 메모리에 도착합니다','응답은 인터넷을 거쳐 클라이언트로 돌아옵니다 출발 때와 동일한 물리적 경로를 반드시 이용하지는 않습니다 NIC와 OS가 받은 데이터를 브라우저가 사용할 수 있게 합니다',[-.8,-.3,2.2],[3,4.5,7],'NETWORK → RAM → BROWSER','nic',2),
  step(.9,'MAKE IT VISIBLE','정보가 화면이 되다','브라우저가 응답을 해석해 화면을 구성합니다','브라우저는 HTML, CSS, JavaScript와 리소스를 처리하고 레이아웃·페인트·합성을 수행합니다 도착한 패킷 자체가 곧바로 화면의 픽셀인 것은 아닙니다',[10,1.5,5],[.5,1.4,13],'BROWSER → DISPLAY','display',2.25),
 ],paths:[
  {window:[.03,.17],points:[[-9,-.3,1],[-7,.4,-1],[-4,.2,-2],[-.72,-1.2,-1.56]]},
  {window:[.2,.34],points:[[-.8,-.1,2.2],[2,2,-2],[7,1,-5],[10,.1,-7]]},
  {window:[.36,.53],points:[[10,.1,-7],[14,1,-11],[20,2,-10],[23,3,-6]]},
  {window:[.56,.72],points:[[23,3,-6],[22,5,-1],[13,3,1],[-.8,-.1,2.2]]},
  {window:[.73,.85],points:[[-.8,-.1,2.2],[-2,.6,.3],[.2,.4,-1],[2,-.9,-1.3]]},
  {window:[.86,.985],points:[[-.72,-1.2,-1.56],[3,.5,1],[7,1,4],[10,1.4,5.2]]},
 ]},
 storage:{title:'파일을 여는 순간',en:'FROM STORAGE TO SCREEN',cover:'hdd',parts:[...gameParts,'hdd'],extras:['mouse'],screen:[.84,.99],steps:[
  step(0,'OPEN A FILE','파일 하나를 열다','운영체제가 파일과 메모리 캐시를 확인합니다','파일 열기 요청을 받은 운영체제는 파일 시스템과 메모리 캐시를 확인합니다 저장장치 읽기는 필요한 데이터가 캐시에 없을 때 발생합니다',[-9,-.4,1],[3,4.7,-6.5],'MOUSE → FILE REQUEST','mouse',1.5),
  step(.18,'CHECK THE CACHE','이미 있는지 살펴보다','메모리에 없다면 저장장치에서 읽습니다','OS의 파일 캐시에 데이터가 있으면 저장장치에서 다시 읽지 않아도 됩니다 CPU 내부 캐시와 OS 파일 캐시는 서로 다른 개념입니다 아래에서 저장장치 또는 캐시 경로를 비교할 수 있습니다',[.5,-.7,-1.35],[3,5,6.2],'CPU ↔ RAM','dram',1.9),
  step(.36,'READ THE STORAGE','보관된 데이터를 찾다','SSD 컨트롤러가 NAND의 데이터를 읽습니다','NVMe SSD는 PCIe를 통해 읽기 명령을 받고 플래시 메모리에서 데이터를 읽습니다 SSD와 HDD는 대체 가능한 저장 경로이며 둘을 직렬로 통과하지 않습니다',[.24,-1.4,-.28],[1.8,3.2,4.2],'NVMe SSD / NAND','ssd',1.9),
  step(.55,'TRANSFER TO MEMORY','작업할 곳으로 옮기다','DMA로 읽은 데이터가 RAM에 전송됩니다','CPU는 I/O 작업을 준비하지만 대용량 데이터가 모두 CPU 내부를 거쳐 옮겨지는 것은 아닙니다 장치의 DMA가 지정된 메모리 영역으로 데이터를 전송하고 완료를 알립니다',[.5,-.7,-1.35],[3,5,6.2],'STORAGE → RAM / DMA','dram',1.9),
  step(.73,'DECODE','내용을 해석하다','CPU가 메모리의 데이터를 해석합니다','CPU는 내부 캐시와 RAM의 데이터를 사용해 파일 형식을 해석합니다 예를 들어 압축된 이미지의 내용을 처리해 표시할 수 있는 결과를 만듭니다 CPU 캐시는 칩 내부에 있습니다',[-.72,-1.5,-1.56],[1.4,2.8,3.4],'RAM → CPU','cpu',1.65),
  step(.9,'ON THE SCREEN','내용이 눈앞에 펼쳐지다','처리한 결과가 그래픽 출력을 거쳐 보입니다','애플리케이션과 그래픽 시스템이 처리 결과를 화면에 구성합니다 GPU의 디스플레이 엔진이 프레임을 읽어 모니터에 출력합니다',[10,1.5,5],[.5,1.4,13],'DECODED FILE → DISPLAY','display',2.25),
 ],paths:[
  {window:[.04,.18],points:[[-9,.1,-.5],[-7,.3,-4],[-3,.1,-4],[-.72,-1.1,-1.56]]},
  {window:[.21,.35],points:[[-.72,-1.2,-1.56],[.2,.7,-1.6],[2,-.9,-1.3]]},
  {window:[.4,.53],points:[[-.72,-1.2,-1.56],[-.4,-.6,-1],[.3,-.4,-.4],[.24,-1.35,-.28]]},
  {window:[.57,.71],points:[[.24,-1.35,-.28],[.5,.3,.4],[2,.3,.1],[2,-.9,-1.3]]},
  {window:[.75,.86],points:[[2,-.9,-1.3],[1,.6,-.3],[-.8,-.4,-.5],[-.72,-1.2,-1.56]]},
  {window:[.87,.99],points:[[-.72,-1.2,-1.56],[3,.5,1],[7,1,4],[10,1.4,5.2]]},
 ]},
};
Object.assign(SCENARIOS,EXTENDED_SCENARIOS);
export function scenarioFor(id,variant='ssd'){
 const base=SCENARIOS[id];if(id!=='storage'||variant==='ssd')return base;
 const result={...base,steps:base.steps.map(s=>({...s})),paths:base.paths.map(p=>({...p,points:p.points.map(v=>[...v])}))};
 if(variant==='hdd'){
  Object.assign(result.steps[2],{tag:'SATA HDD / PLATTER',fallback:'hdd',copy:'HDD의 헤드가 회전하는 플래터의 데이터를 읽습니다',detail:'HDD의 헤드는 회전하는 자기 디스크의 트랙에 접근합니다 읽은 데이터는 SATA 연결을 통해 시스템 메모리로 전송됩니다',focus:[5.09,-1.3,2.42],offset:[4,6,7],fit:2.05});
  result.paths[2].points=[[-.72,-1.2,-1.56],[2,.2,0],[5,0,1],[5.09,-1.2,2.42]];
  result.paths[3].points=[[5.09,-1.2,2.42],[4,.8,1],[2,.5,0],[2,-.9,-1.3]];
 }else if(variant==='cached'){
  result.steps=[result.steps[0],{...result.steps[1],at:.24,title:'이미 메모리에 있다',copy:'파일 캐시의 데이터를 바로 사용합니다',tag:'RAM / CACHE HIT'}, {...result.steps[4],at:.6},result.steps[5]];
  result.paths=[result.paths[0],{...result.paths[1],window:[.25,.53]},{...result.paths[4],window:[.61,.83]},result.paths[5]];
 }
 return result;
}
