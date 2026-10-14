// A single scroll clock drives every transform, so the whole film also runs backwards.
export const CHAPTERS=[
  {id:'cpu',start:0,end:.125,label:'PROCESSOR',description:'CPU의 금속 패키지, 실리콘 다이, LGA 소켓',fallback:'cpu'},
  {id:'gpu',start:.125,end:.245,label:'GRAPHICS',description:'GPU 기판, 방열판, 프레임과 팬이 분리되고 메인보드 아래의 전시 위치로 이동',fallback:'gpu'},
  {id:'dram',start:.245,end:.31,label:'MEMORY',description:'DDR5 메모리 칩과 기판을 펼치고 DIMM 슬롯에 결합',fallback:'dram'},
  {id:'ssd',start:.31,end:.375,label:'SOLID STATE',description:'M.2 SSD의 라벨, NAND, 컨트롤러가 분리되고 메인보드에 결합',fallback:'ssd'},
  {id:'hdd',start:.375,end:.44,label:'MAGNETIC STORAGE',description:'SATA 하드 디스크의 커버, 플래터, 헤드를 펼치고 SATA 케이블로 연결',fallback:'hdd'},
  {id:'cooling',start:.44,end:.51,label:'ENGINEERED AIRFLOW',description:'CPU 쿨러의 콜드 플레이트, 구리 히트파이프, 핀, 팬이 결합',fallback:'cooling'},
  {id:'power',start:.51,end:.575,label:'POWER',description:'전원 공급 장치의 팬과 커버가 열리고 ATX·EPS 전원에 연결',fallback:'power'},
  {id:'vrm',start:.575,end:.63,label:'VOLTAGE REGULATION',description:'메인보드 전원부의 초크, 커패시터, 방열판을 보여주는 구조 단면',fallback:'vrm'},
  {id:'coproc',start:.63,end:.685,label:'PLATFORM CONTROLLER',description:'메인보드 칩셋의 패키지와 다이를 펼쳐 보여주는 구조 단면',fallback:'coproc'},
  {id:'spirom',start:.685,end:.735,label:'FIRST INSTRUCTION',description:'SPI 펌웨어 플래시의 패키지와 리드 프레임을 보여주는 구조 단면',fallback:'spirom'},
  {id:'nic',start:.735,end:.795,label:'EXPANSION',description:'PCIe 네트워크 카드의 컨트롤러와 포트가 분리되고 확장 슬롯에 결합',fallback:'nic'},
  {id:'io',start:.795,end:.835,label:'CONNECTIONS',description:'후면 USB, 이더넷, 오디오 포트의 금속 실드와 접점',fallback:'mainboard'},
  {id:'system',start:.835,end:.94,label:'ONE MOTHERBOARD',description:'CPU, GPU, 메모리, 저장장치, 냉각, 전원, 확장 카드가 결합한 메인보드',fallback:'mainboard'},
  {id:'screen',start:.94,end:1,label:'BEYOND THE SCREEN',description:'카메라가 모니터 밖으로 빠져나오며 앞선 메인보드 장면이 화면 안에 나타납니다',fallback:'display'},
];
export const chapterAt=p=>CHAPTERS.find(c=>p<c.end)||CHAPTERS.at(-1);
export const CHAPTER_STOPS=CHAPTERS.map(c=>c.id==='screen'?1:c.id==='system'?.93:c.start+(c.end-c.start)*.57);
