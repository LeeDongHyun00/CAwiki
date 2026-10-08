// Reviewable motion study. Production scenarios remain on their existing routes.
import * as T from '../../../lib/vendor/three/three.module.js';
import { createComputer } from '../cinema-models.js';
import { createCollectionModel } from '../collection-models.js';
const $=s=>document.querySelector(s),clamp=T.MathUtils.clamp,mix=T.MathUtils.lerp;
const ease=t=>t*t*t*(t*(t*6-15)+10),range=(p,a,b)=>ease(clamp((p-a)/(b-a),0,1));
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),v=a=>new T.Vector3(...a);
const beats=[{"at": 0, "title": "수정을 남기기로 하다", "copy": "Ctrl과 S를 누르면 앱이 저장을 요청합니다", "part": "input", "motion": "키보드의 Ctrl·S가 함께 눌리고 문서의 수정 표시가 저장 중으로 바뀜", "detail": "키 입력을 받은 앱이 파일 시스템에 쓰기를 요청합니다 단축키를 누른 순간에 데이터가 모두 NAND에 기록되는 것은 아닙니다", "focus": [-9, -0.35, 1], "offset": [3, 5.2, 8]}, {"at": 0.18, "title": "기록을 준비하다", "copy": "운영체제가 쓸 위치와 데이터를 준비합니다", "part": "cpu", "motion": "작은 빈 고리가 CPU 옆에서 SSD 쪽으로 이동하고 데이터 타일은 RAM 옆에 남음", "detail": "CPU에서 실행되는 운영체제와 드라이버가 I/O를 준비합니다 제어 명령과 대용량 데이터 전송을 서로 다른 형태로 표현합니다", "focus": [-0.72, -1.5, -1.56], "offset": [2.3, 3.8, 5]}, {"at": 0.36, "title": "메모리에 잠시 머물다", "copy": "변경한 데이터가 쓰기 버퍼에서 기다립니다", "part": "dram", "motion": "RAM 옆 네 칸의 버퍼가 채워지고 기록 전 상태가 유지됨", "detail": "버퍼 쓰기는 데이터를 RAM에 먼저 둘 수 있습니다 앱의 저장 표시만으로 물리 장치 기록이나 전원 손실 시 보존을 단정할 수 없습니다", "focus": [1.8, -0.55, -1.3], "offset": [3.5, 4.4, 6.1]}, {"at": 0.55, "title": "SSD로 옮기다", "copy": "DMA 전송으로 데이터가 메모리에서 SSD로 이동합니다", "part": "ssd", "motion": "RAM의 타일이 CPU를 관통하지 않고 SSD로 이동하며 버퍼가 줄어듦", "detail": "드라이버가 지정한 메모리의 데이터를 장치가 DMA로 가져옵니다 실제 데이터 전송 경로는 플랫폼과 저장장치 구성에 따라 다릅니다", "focus": [0.65, -0.8, -0.75], "offset": [3.7, 4.8, 6.6]}, {"at": 0.74, "title": "플래시에 기록하다", "copy": "컨트롤러가 데이터를 NAND에 기록합니다", "part": "ssd", "motion": "SSD 외장은 그대로 두고 옆의 기록 상태 타일이 윤곽에서 채워진 면으로 바뀜", "detail": "컨트롤러가 논리 주소를 관리하고 NAND 쓰기와 오류 정정을 수행합니다 표시한 칸은 기록 상태를 위한 개념 표현이며 실제 셀 배치가 아닙니다", "focus": [0.24, -1.4, -0.28], "offset": [1.5, 2.7, 3.4]}, {"at": 0.92, "title": "완료를 확인하다", "copy": "동기화 완료를 확인한 뒤 문서로 돌아옵니다", "part": "display", "motion": "SSD의 작은 완료 고리가 돌아오고 모니터의 저장 중 표시가 저장됨으로 바뀜", "detail": "이 예시는 동기화 완료를 기다리는 저장 흐름입니다 보존 보장은 OS·장치 캐시·전원 손실 보호와 파일 시스템 동작에 따라 달라집니다", "focus": [10, 1.5, 5], "offset": [0.5, 1.4, 13]}];
let renderer,scene,camera,computer,keyboard,monitor,screen,screenMap,paths=[],active=-1;
let progress=0,target=0,frame=0,last=0,drag=null,lastScreen=-1,modalProgress=0,tiles=[],tilePaths=[],keys=[],contextLost=false;
const mobile=()=>innerWidth<=760;
function boundsProgress(){return Math.max(1,$('#journey').offsetHeight-innerHeight);}
function seek(p){scrollTo({top:Math.ceil(clamp(p,0,1)*boundsProgress()-1e-7),behavior:'instant'});target=clamp(p,0,1);wake();}
function screenTexture(p){
 if(Math.abs(p-lastScreen)<.00005)return;lastScreen=p;
 const c=screenMap.image.getContext('2d');
 c.fillStyle='#122022';c.fillRect(0,0,960,540);
 c.fillStyle='#1d3032';c.beginPath();c.roundRect(90,52,780,430,16);c.fill();
 c.fillStyle='#9baea9';c.font='19px Arial';c.fillText('나의 기록',130,102);
 c.fillStyle='#9da9a4';c.font='15px Arial';c.fillText(p<.08?'수정됨':p<.955?'저장 중':'저장됨',740,102);
 c.strokeStyle='#34494a';c.beginPath();c.moveTo(125,123);c.lineTo(833,123);c.stroke();
 c.fillStyle='#d7dfd7';c.font='28px Arial';c.fillText('오늘의 생각',135,185);
 c.fillStyle='#728b87';for(let i=0;i<5;i++)c.fillRect(135,222+i*31,[560,485,527,420,350][i],5);
 c.fillStyle=p<.955?'#4b6862':'#aecdbd';c.beginPath();c.roundRect(132,415,32,7,3);c.fill();
 c.fillStyle='#91a9a2';c.font='13px Arial';c.fillText(p<.955?'기록을 준비하고 있습니다':'변경 사항을 기록했습니다',180,425);
 screenMap.needsUpdate=true;
}
function setup(){
 renderer=new T.WebGLRenderer({canvas:$('#story-world'),antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;
 scene=new T.Scene();scene.background=new T.Color(0x111416);camera=new T.PerspectiveCamera(34,innerWidth/innerHeight,.3,100);
 const studio=new T.Scene();studio.background=new T.Color(0x11161c);
 for(const [size,pos,intensity,color] of [[[8,12],[-6,9,3],5,0xf6f2ec],[[4,14],[7,3,-4],4,0xa5c3d6],[[10,3],[0,8,-8],6,0xffffff]]){
  const m=new T.Mesh(new T.PlaneGeometry(...size),new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(intensity),side:T.DoubleSide}));m.position.set(...pos);m.lookAt(0,0,0);studio.add(m);
 }
 const pmrem=new T.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(studio,.04).texture;scene.environmentIntensity=.85;pmrem.dispose();
 const key=new T.DirectionalLight(0xfff5e9,3.4);key.position.set(-6,10,8);const rim=new T.DirectionalLight(0xb0d5e6,2);rim.position.set(8,4,-7);scene.add(key,rim,new T.HemisphereLight(0xdcebf1,0x1b2527,1.2));
 computer=createComputer();scene.add(computer.root);computer.board.root.position.y=-1.8;
 for(const [id,item] of Object.entries(computer.parts)){item.model.root.position.copy(item.install);item.model.root.quaternion.copy(item.installedRotation);item.model.root.scale.setScalar(.024);item.model.root.visible=!['cooling','hdd','power','nic'].includes(id);}
 computer.cables.visible=false;computer.ram2.root.visible=true;
 keyboard=createCollectionModel('input');keyboard.root.scale.setScalar(.017);keyboard.root.position.set(-9,-1,1);keyboard.root.rotation.y=-.12;scene.add(keyboard.root);
 // Move the existing keycaps and their printed labels together, without opening the housing.
 const capGroup=keyboard.root.getObjectByName('키캡');
 for(const [x,z,label] of [[-150,54,'Ctrl'],[-122,4,'S']]){
  const cap=capGroup.children.find(m=>m.isMesh&&Math.abs(m.position.x-x)<.01&&Math.abs(m.position.z-z)<.01&&m.position.y===18);
  const printed=capGroup.children.find(m=>m.isMesh&&Math.abs(m.position.x-x)<.01&&Math.abs(m.position.z-z)<.01&&m.position.y>22);
  if(cap){cap.material=cap.material.clone();cap.material.color.set('#506b62');keys.push({mesh:cap,y:cap.position.y});}
  if(printed)keys.push({mesh:printed,y:printed.position.y});
  if(!printed){
   const c=document.createElement('canvas');c.width=128;c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='#bed2c5';ctx.font='24px Arial';ctx.textAlign='center';ctx.fillText(label,64,40);
   const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;
   const mark=new T.Mesh(new T.PlaneGeometry(16,8),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false}));mark.rotation.x=-Math.PI/2;mark.position.set(x,22.6,z);capGroup.add(mark);keys.push({mesh:mark,y:mark.position.y});
  }
 }
 monitor=createCollectionModel('display');monitor.root.scale.setScalar(.013);monitor.root.position.set(10,-1.2,5);scene.add(monitor.root);
 const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;screenMap=new T.CanvasTexture(canvas);screenMap.colorSpace=T.SRGBColorSpace;
 // Replace the existing screen surface; overlapping planes shimmer at distance.
 monitor.root.traverse(object=>{if(object.geometry?.type==='PlaneGeometry'&&object.geometry.parameters.width===508)screen=object;});
 screen.material.map.dispose();screen.material.dispose();screen.material=new T.MeshBasicMaterial({map:screenMap,toneMapped:false});
 const routes=[
  {window:[.05,.23],type:'command',points:[[-9,-.4,1],[-7,.5,-1],[-4,.4,-2],[-.72,-1.15,-1.56]]},
  {window:[.23,.39],type:'command',points:[[-.72,-1.15,-1.56],[-1.2,-.15,-.9],[-.3,-.4,0],[.24,-1.15,-.28]]},
  {window:[.53,.76],type:'data',points:[[1.9,-.55,-1.3],[2.4,.35,.1],[1.3,.55,.8],[.24,-1.02,.38]]},
  {window:[.87,.98],type:'command',points:[[.24,-1.15,-.28],[1.5,.5,2.4],[5,1.3,4],[10,1.4,5.2]]}
 ];
 for(const route of routes){
  const curve=new T.CatmullRomCurve3(route.points.map(v)),data=route.type==='data';
  const line=new T.Mesh(new T.TubeGeometry(curve,80,.008,6,false),new T.MeshBasicMaterial({color:data?0xa6c9bd:0xcbbd9f,transparent:true,opacity:.2,depthWrite:false}));scene.add(line);
  const marker=new T.Mesh(new T.TorusGeometry(.075,.009,8,36),new T.MeshBasicMaterial({color:0xd4c5a2}));scene.add(marker);
  paths.push({...route,curve,line,marker});
 }
 // Flat document glyphs distinguish logical data from physical NAND packages.
 const glyph=document.createElement('canvas');glyph.width=128;glyph.height=180;
 const gc=glyph.getContext('2d');gc.fillStyle='#132b25dd';gc.strokeStyle='#bedbcd';gc.lineWidth=5;
 gc.beginPath();gc.roundRect(6,6,116,168,9);gc.fill();gc.stroke();gc.fillStyle='#bedbcd';
 for(const [row,width] of [[0,75],[1,60],[2,75],[3,42]])gc.fillRect(24,43+row*24,width,5);
 const glyphMap=new T.CanvasTexture(glyph);glyphMap.colorSpace=T.SRGBColorSpace;
 for(let i=0;i<4;i++){
  const material=new T.MeshBasicMaterial({map:glyphMap,color:0xa7c8ba,transparent:true,side:T.DoubleSide,depthWrite:false,toneMapped:false});
  const tile=new T.Mesh(new T.PlaneGeometry(.21,.30),material);tile.rotation.x=-Math.PI/2;scene.add(tile);tiles.push(tile);
  tilePaths.push(new T.CatmullRomCurve3([new T.Vector3(1.68+i*.26,-.32,-1.3),new T.Vector3(2.3+i*.035,.2,.05),new T.Vector3(1+i*.035,.15,.7),new T.Vector3(-.17+i*.27,-1.02,.38)]));
 }
 const plate=new T.Mesh(new T.PlaneGeometry(80,60),new T.MeshBasicMaterial({color:0x111416,toneMapped:false}));plate.rotation.x=-Math.PI/2;plate.position.y=-3.3;scene.add(plate);
 resize();document.body.classList.add('ready');wake();
}
function compose(p){
 let i=beats.findLastIndex(b=>b.at<=p);i=Math.max(0,i);const next=Math.min(i+1,beats.length-1),a=beats[i],b=beats[next],local=next===i?1:clamp((p-a.at)/(b.at-a.at),0,1);
 // The first 40% holds the cause in view; the remaining distance carries the
 // camera and the same event toward its destination. All state is reversible.
 const travel=reduced.matches?0:range(local,.40,1),focus=v(a.focus).lerp(v(b.focus),travel),offset=v(a.offset).lerp(v(b.offset),travel);
 if(mobile()){const fit=[1.5,1.65,1.9,2.05,2.1,2.25];offset.multiplyScalar(mix(fit[i],fit[next],travel));}
 camera.position.copy(focus).add(offset);camera.lookAt(focus);camera.updateMatrixWorld();
 if(mobile())camera.setViewOffset(innerWidth,innerHeight,0,innerHeight*.16,innerWidth,innerHeight);else camera.setViewOffset(innerWidth,innerHeight,-innerWidth*.14,0,innerWidth,innerHeight);
 // Every component retains its assembled transform throughout the study.
 const press=Math.sin(Math.PI*range(p,.005,.105));keys.forEach(({mesh,y})=>mesh.position.y=y-1.1*press);
 paths.forEach(({line,curve,marker,window:[start,end],type})=>{
  const t=clamp((p-start)/(end-start),0,1),visible=p>start&&p<end;
  line.visible=visible;marker.visible=visible&&type==='command';
  marker.position.copy(curve.getPointAt(t));marker.quaternion.copy(camera.quaternion);line.material.opacity=.08+.26*Math.sin(Math.PI*t);
 });
 tiles.forEach((tile,j)=>{
  const filled=range(p,.37+j*.014,.415+j*.014),move=range(p,.545+j*.035,.65+j*.035),write=range(p,.755+j*.025,.8+j*.025);
  tile.position.copy(tilePaths[j].getPointAt(move));
  tile.scale.setScalar(filled*(1+write*.15));tile.material.opacity=filled*(1-range(p,.90,.925));
  tile.material.color.set(write>.5?0xcbbd9f:0xa7c8ba);tile.visible=p>.36&&p<.93;
 });
 screenTexture(p);
 if(i!==active){active=i;$('#story-phase').textContent=`0${i+1} / 06`;$('#story-title').textContent=a.title;$('#story-copy').textContent=a.copy;$('#live').textContent=a.title+' '+a.copy;$('#story-world').setAttribute('aria-label',a.title+' '+a.copy);document.querySelectorAll('#track button').forEach((e,j)=>e.setAttribute('aria-current',i===j?'step':'false'));}
 const stateNames=['기록 전','저장 요청','쓰기 버퍼','데이터 전송','NAND 기록','완료 확인'];
 const stateCopy=['문서에 변경 사항이 있습니다','고리: 처리 요청','타일: 기록할 데이터','RAM → SSD','채워진 칸: 기록 상태','동기화 완료를 기다리는 예시'];
 $('#state-label').textContent=stateNames[i];$('#state-caption').textContent=stateCopy[i];$('#state-panel').dataset.stage=String(i);
 const count=i<2?0:i===2?Math.ceil(range(p,.36,.47)*4):i===3?4-Math.floor(range(p,.55,.74)*4):i===4?Math.ceil(range(p,.74,.87)*4):4;
 document.querySelectorAll('#buffer i').forEach((el,j)=>el.dataset.filled=String(j<count));
 $('#gesture').hidden=p>.98;$('#restart').hidden=p<=.98;$('#line').style.transform=`scaleX(${p})`;document.body.dataset.progress=p.toFixed(5);document.body.dataset.step=String(i);
 renderer.render(scene,camera);
}
function tick(now){frame=0;if(document.hidden||$('#detail').open||contextLost)return;const dt=Math.min(.12,(now-last)/1000||.016);last=now;const goal=reduced.matches?[.06,.26,.435,.635,.83,1][Math.max(0,beats.findLastIndex(b=>b.at<=target))]:target;progress=reduced.matches?goal:mix(progress,goal,1-Math.exp(-8*dt));const moving=Math.abs(goal-progress)>.00003;if(!moving)progress=goal;compose(progress);if(moving)frame=requestAnimationFrame(tick);}
function wake(){if(renderer&&!frame&&!document.hidden&&!$('#detail').open&&!contextLost){last=performance.now();frame=requestAnimationFrame(tick);}}
function resize(){if(!renderer)return;renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.clearViewOffset();camera.updateProjectionMatrix();target=clamp(scrollY/boundsProgress(),0,1);wake();}
addEventListener('scroll',()=>{target=clamp(scrollY/boundsProgress(),0,1);wake();},{passive:true});addEventListener('resize',resize);
$('#story-world').addEventListener('pointerdown',e=>{if($('#detail').open)return;if(e.pointerType!=='mouse'||e.button!==0)return;drag={y:e.clientY,scroll:scrollY};e.target.setPointerCapture(e.pointerId);});
addEventListener('pointermove',e=>{if(drag)scrollTo({top:drag.scroll+(drag.y-e.clientY)*2.5,behavior:'instant'});},{passive:true});
for(const event of ['pointerup','pointercancel','lostpointercapture'])addEventListener(event,()=>drag=null);
addEventListener('keydown',e=>{if($('#detail').open||e.target.closest('button,a,input'))return;if(e.key==='Home'){e.preventDefault();seek(0);}if(e.key==='End'){e.preventDefault();seek(1);}if(['ArrowDown','ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();seek(beats.find(b=>b.at>target+.015)?.at??1);}if(['ArrowUp','ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();seek([...beats].reverse().find(b=>b.at<target-.015)?.at??0);}});
$('#track').replaceChildren(...beats.map((b,i)=>{const button=document.createElement('button');button.setAttribute('aria-label',`${i+1}. ${b.title}`);button.onclick=()=>seek(b.at);return button;}));
$('#restart').onclick=()=>seek(0);$('#why').onclick=()=>{const b=beats[active];$('#detail-title').textContent=b.title;$('#detail-copy').textContent=b.detail;modalProgress=progress;document.documentElement.style.overflow='hidden';$('#detail').showModal();};$('#close-detail').onclick=()=>$('#detail').close();$('#detail').addEventListener('close',()=>{document.documentElement.style.overflow='';seek(modalProgress);});
addEventListener('visibilitychange',()=>{cancelAnimationFrame(frame);frame=0;if(!document.hidden)wake();});reduced.addEventListener('change',wake);
$('#story-world').addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;cancelAnimationFrame(frame);frame=0;document.body.classList.remove('ready');$('#loading').textContent='3D 연결이 끊겼습니다 새로고침으로 장면을 다시 열 수 있습니다';});
$('#story-world').addEventListener('webglcontextrestored',()=>{contextLost=false;document.body.classList.add('ready');wake();});
$('#journey').replaceChildren(...beats.map(b=>{const section=document.createElement('section'),h=document.createElement('h2');h.textContent=b.title;section.appendChild(h);return section;}));
try{setup();}catch(error){console.error(error);$('#loading').textContent='이 설계 시안은 WebGL을 지원하는 브라우저에서 볼 수 있습니다';}
