// Reviewable motion study. Production scenarios remain on their existing routes.
import * as T from '../../lib/vendor/three/three.module.js';
import { createComputer } from './cinema-models.js';
import { createCollectionModel } from './collection-models.js';
import { poseMouseClick } from './mouse-model.js';
const $=s=>document.querySelector(s),clamp=T.MathUtils.clamp,mix=T.MathUtils.lerp;
const ease=t=>t*t*t*(t*(t*6-15)+10),range=(p,a,b)=>ease(clamp((p-a)/(b-a),0,1));
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),v=a=>new T.Vector3(...a);
const beats=[
 {at:0,tag:'MOUSE / SWITCH',en:'INPUT',title:'손끝에서 시작된 변화',copy:'클릭 한 번이 어떻게 화면을 바꿀까요?',detail:'스위치의 상태가 바뀌면 마우스 컨트롤러가 버튼 상태를 입력 보고서로 만듭니다 이 시안은 USB로 연결된 마우스를 기준으로 합니다',focus:[-9,-.4,1],offset:[3,4.7,-6.5]},
 {at:.18,tag:'USB → CPU',en:'INPUT REPORT',title:'입력을 읽다',copy:'운영체제가 입력을 전달하고, 게임이 클릭을 읽습니다',detail:'USB 호스트 컨트롤러와 드라이버를 통해 들어온 입력을 운영체제가 전달합니다 게임은 그 이벤트를 읽습니다 화면의 빛은 이벤트 전달 경로를 표현하며, 전자가 CPU까지 직접 이동한다는 뜻이 아닙니다',focus:[-.72,-1.5,-1.56],offset:[1.4,2.8,3.4]},
 {at:.36,tag:'CPU ↔ RAM',en:'UPDATE STATE',title:'다음 상태를 계산하다',copy:'CPU가 메모리의 정보를 읽고 게임 상태를 갱신합니다',detail:'CPU는 캐시와 RAM의 게임 데이터를 사용해 입력, 물리, 게임 규칙을 처리합니다 RAM은 작업 중인 데이터를 보관합니다 이 장면에서는 상태 변화가 중심이고 모든 캐시 접근을 하나씩 재현하지는 않습니다',focus:[.5,-.7,-1.35],offset:[3,5,6.2]},
 {at:.55,tag:'CPU → GPU',en:'DRAW COMMANDS',title:'그리기를 요청하다',copy:'CPU가 준비한 그래픽 명령을 GPU가 실행합니다',detail:'그래픽 API와 드라이버가 준비한 명령 버퍼를 GPU의 큐가 처리합니다 명령 제출과 데이터 이동을 빛의 경로로 축약했습니다 실제로 CPU와 GPU는 여러 프레임의 작업을 겹쳐 수행할 수 있습니다',focus:[0,-1.4,3.6],offset:[5,8,10]},
 {at:.74,tag:'GPU ↔ VRAM',en:'RENDER FRAME',title:'한 프레임을 만들다',copy:'GPU가 장면을 그리고 결과를 VRAM에 기록합니다',detail:'GPU는 VRAM의 텍스처와 기하 데이터를 읽어 셰이딩·래스터화 등을 수행합니다 렌더 타깃에 기록된 색상 결과가 한 프레임을 이룹니다 작은 픽셀 격자는 결과를 크게 확대한 개념 표현입니다',focus:[-.8,-2,6.5],offset:[4,7,9]},
 {at:.92,tag:'FRAME → DISPLAY',en:'VISIBLE CHANGE',title:'변화가 눈에 닿다',copy:'완성된 프레임이 출력되고, 클릭의 결과가 보입니다',detail:'디스플레이 엔진이 프레임 버퍼를 읽어 HDMI 또는 DisplayPort 신호로 출력합니다 디스플레이는 주사와 갱신에 맞춰 화면을 바꿉니다 이번 시안은 단일 프레임의 인과관계를 느리게 펼쳐 보여줍니다',focus:[10,1.5,5],offset:[.5,1.4,13]},
];
let renderer,scene,camera,computer,mouse,monitor,screen,screenMap,paths=[],dots=[],active=-1;
let progress=0,target=0,frame=0,last=0,drag=null,dirty=true,lastScreen=-1,modalProgress=0;
const mobile=()=>innerWidth<=760;
function boundsProgress(){return Math.max(1,$('#journey').offsetHeight-innerHeight);}
function seek(p){scrollTo({top:clamp(p,0,1)*boundsProgress(),behavior:'instant'});target=clamp(p,0,1);wake();}
function screenTexture(t){
 if(Math.abs(t-lastScreen)<.00005)return;lastScreen=t;
 const c=screenMap.image.getContext('2d'),w=960,h=540;
 c.fillStyle='#0c171e';c.fillRect(0,0,w,h);
 c.strokeStyle='#243740';c.lineWidth=1;for(let x=0;x<w;x+=48){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=0;y<h;y+=48){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
 const x=mix(260,635,t);c.fillStyle='#101f24';c.fillRect(130,394,710,8);
 c.shadowColor='#b4d7cb';c.shadowBlur=35;c.fillStyle='#a9d0c1';c.beginPath();c.roundRect(x,240,100,150,14);c.fill();c.shadowBlur=0;
 c.fillStyle='#617d82';c.font='16px Arial';c.fillText('ONE CLICK / A NEW FRAME',45,48);screenMap.needsUpdate=true;
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
 mouse=createCollectionModel('mouse');mouse.root.scale.setScalar(.034);mouse.root.position.set(-9,-1,1);mouse.root.rotation.y=-.2;scene.add(mouse.root);
 monitor=createCollectionModel('display');monitor.root.scale.setScalar(.013);monitor.root.position.set(10,-1.2,5);scene.add(monitor.root);
 const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;screenMap=new T.CanvasTexture(canvas);screenMap.colorSpace=T.SRGBColorSpace;
 // Replace the existing screen surface; overlapping planes shimmer at distance.
 monitor.root.traverse(object=>{if(object.geometry?.type==='PlaneGeometry'&&object.geometry.parameters.width===508)screen=object;});
 screen.material.map.dispose();screen.material.dispose();screen.material=new T.MeshBasicMaterial({map:screenMap,toneMapped:false});
 const routes=[
  [[-9,.1,-.5],[-7,.3,-4],[-3,.1,-4],[-.72,-1.1,-1.56]],
  [[-.72,-1.2,-1.56],[.2,.7,-1.6],[2,-.9,-1.3],[1.5,.7,-.7],[-.72,-1.2,-1.56]],
  [[-.72,-1.2,-1.56],[-3,.5,.3],[-3.5,.5,4],[0,-.8,6.75]],
  [[-1,-2.25,6.72],[-1.4,-1.95,6.4],[-1.85,-2.25,6.15],[-1.25,-2.05,6.05],[-1,-2.25,6.72]],
  [[0,-.8,6.75],[4,.4,8.2],[8,.7,7],[10,1.4,5.2]],
 ];
 for(const points of routes){const curve=new T.CatmullRomCurve3(points.map(v));const material=new T.MeshBasicMaterial({color:0x9ec7bd,transparent:true,opacity:.18,depthWrite:false});const line=new T.Mesh(new T.TubeGeometry(curve,80,.011,6,false),material);scene.add(line);paths.push({curve,line});const dot=new T.Mesh(new T.SphereGeometry(.055,16,12),new T.MeshBasicMaterial({color:0xd2eee4}));scene.add(dot);dots.push(dot);}
 const plate=new T.Mesh(new T.PlaneGeometry(80,60),new T.MeshBasicMaterial({color:0x111416,toneMapped:false}));plate.rotation.x=-Math.PI/2;plate.position.y=-3.3;scene.add(plate);
 resize();document.body.classList.add('ready');wake();
}
function compose(p){
 let i=beats.findLastIndex(b=>b.at<=p);i=Math.max(0,i);const next=Math.min(i+1,beats.length-1),a=beats[i],b=beats[next],local=next===i?1:clamp((p-a.at)/(b.at-a.at),0,1);
 // The first 45% holds the cause in view; the remaining distance carries the
 // camera and the same event toward its destination. All state is reversible.
 const travel=range(local,.40,1),focus=v(a.focus).lerp(v(b.focus),travel),offset=v(a.offset).lerp(v(b.offset),travel);
 if(mobile()){const fit=[1.5,1.65,1.9,2.05,2.1,2.25];offset.multiplyScalar(mix(fit[i],fit[next],travel));}
 camera.position.copy(focus).add(offset);camera.lookAt(focus);camera.updateMatrixWorld();
 if(mobile())camera.setViewOffset(innerWidth,innerHeight,0,innerHeight*.16,innerWidth,innerHeight);else camera.setViewOffset(innerWidth,innerHeight,-innerWidth*.14,0,innerWidth,innerHeight);
 computer.parts.cpu.model.explode(range(p,.09,.21)*(1-range(p,.45,.59)));
 const lid=computer.parts.cpu.model.root.getObjectByName('heatspreader');lid.position.x=-48*range(p,.10,.24)*(1-range(p,.44,.57));
 computer.parts.dram.model.explode(.48*range(p,.27,.38)*(1-range(p,.49,.58)));
 const open=range(p,.57,.76)*(1-range(p,.83,.96)),gpu=computer.parts.gpu.model;
 gpu.explode(open*.7);gpu.root.getObjectByName('heat sink').position.z=-190*open;gpu.root.getObjectByName('frame and fans').position.z=-380*open;
 mouse.root.visible=p<.28;
 poseMouseClick(mouse.root,Math.sin(Math.PI*range(p,0,.105)));
 const windows=[[.045,.18],[.27,.54],[.51,.7],[.72,.85],[.86,.975]];
 paths.forEach(({line,curve},j)=>{const [start,end]=windows[j],t=clamp((p-start)/(end-start),0,1),visible=p>=start&&p<=end;line.visible=dots[j].visible=visible;line.position.y=j===3?gpu.root.getObjectByName('graphics board').position.y*.024:0;dots[j].position.copy(curve.getPointAt(t)).add(line.position);line.material.opacity=.10+.2*Math.sin(t*Math.PI);});
 screenTexture(range(p,.88,.985));
 if(i!==active){active=i;$('#story-phase').textContent=`0${i+1} / 06 — ${a.en}`;$('#story-title').textContent=a.title;$('#story-copy').textContent=a.copy;$('#object-tag').textContent=a.tag;$('#live').textContent=a.title+' '+a.copy;$('#story-world').setAttribute('aria-label',a.title+' '+a.copy);document.querySelectorAll('#track button').forEach((e,j)=>e.setAttribute('aria-current',i===j?'step':'false'));}
 $('#gesture').hidden=p>.98;$('#restart').hidden=p<=.98;$('#line').style.transform=`scaleX(${p})`;document.body.dataset.progress=p.toFixed(5);document.body.dataset.step=String(i);
 renderer.render(scene,camera);
}
function tick(now){frame=0;if(document.hidden||$('#detail').open)return;const dt=Math.min(.12,(now-last)/1000||.016);last=now;const goal=reduced.matches?beats.reduce((best,b)=>Math.abs(b.at-target)<Math.abs(best-target)?b.at:best,0):target;progress=reduced.matches?goal:mix(progress,goal,1-Math.exp(-8*dt));const moving=Math.abs(goal-progress)>.00003;if(moving||dirty){compose(progress);dirty=false;}if(moving)frame=requestAnimationFrame(tick);}
function wake(){dirty=true;if(renderer&&!frame&&!document.hidden&&!$('#detail').open){last=performance.now();frame=requestAnimationFrame(tick);}}
function resize(){if(!renderer)return;renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.clearViewOffset();camera.updateProjectionMatrix();target=clamp(scrollY/boundsProgress(),0,1);wake();}
addEventListener('scroll',()=>{target=clamp(scrollY/boundsProgress(),0,1);wake();},{passive:true});addEventListener('resize',resize);
$('#story-world').addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;drag={y:e.clientY,scroll:scrollY};e.target.setPointerCapture(e.pointerId);});
addEventListener('pointermove',e=>{if(drag)scrollTo({top:drag.scroll+(drag.y-e.clientY)*2.5,behavior:'instant'});},{passive:true});
for(const event of ['pointerup','pointercancel','lostpointercapture'])addEventListener(event,()=>drag=null);
addEventListener('keydown',e=>{if($('#detail').open||e.target.closest('button,a,input'))return;if(e.key==='Home'){e.preventDefault();seek(0);}if(e.key==='End'){e.preventDefault();seek(1);}if(['ArrowDown','ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();seek(beats.find(b=>b.at>target+.015)?.at??1);}if(['ArrowUp','ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();seek([...beats].reverse().find(b=>b.at<target-.015)?.at??0);}});
$('#track').replaceChildren(...beats.map((b,i)=>{const button=document.createElement('button');button.setAttribute('aria-label',`${i+1}. ${b.title}`);button.onclick=()=>seek(b.at);return button;}));
$('#restart').onclick=()=>seek(0);$('#why').onclick=()=>{const b=beats[active];$('#detail-title').textContent=b.title;$('#detail-copy').textContent=b.detail;modalProgress=progress;document.documentElement.style.overflow='hidden';$('#detail').showModal();};$('#close-detail').onclick=()=>$('#detail').close();$('#detail').addEventListener('close',()=>{document.documentElement.style.overflow='';seek(modalProgress);});
addEventListener('visibilitychange',()=>{cancelAnimationFrame(frame);frame=0;if(!document.hidden)wake();});reduced.addEventListener('change',wake);
$('#story-world').addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(frame);frame=0;document.body.classList.remove('ready');$('#loading').textContent='3D 연결이 끊겼습니다 새로고침으로 장면을 다시 열 수 있습니다';});
try{setup();}catch(error){console.error(error);$('#loading').textContent='이 설계 시안은 WebGL을 지원하는 브라우저에서 볼 수 있습니다';}
