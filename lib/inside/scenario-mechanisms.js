// Hardware activity, focused diagrams and output screens share the scroll clock.
import * as T from 'inside/three';
import { ScenarioSignals } from 'inside/scenario-signals';
import { paintScenarioScreen } from 'inside/scenario-screen';
const clamp=T.MathUtils.clamp,mix=T.MathUtils.lerp;
const ease=x=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
const mint='#b5d8c8',muted='#597a72',gold='#cfbd91',blue='#779caa';
function rounded(c,x,y,w,h,color,r=8){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function text(c,s,x,y,size=30,color=mint){c.fillStyle=color;c.font=`${size}px Arial, sans-serif`;c.fillText(s,x,y);}
function line(c,x,y,x2,y2,color=muted,width=2){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();}
function card(c,x,y,w,h,label,color=mint){rounded(c,x,y,w,h,'#132421e8',9);c.strokeStyle=color;c.lineWidth=2;c.stroke();if(label)text(c,label,x+15,y+h*.58,27,color);}
function bars(c,t,{count=8,x=48,y=240,width=585,fill=mint}={}){for(let k=0;k<count;k++){const w=width/count-8;rounded(c,x+k*width/count,y,w,34,k/count<t?fill:'#273f37',3);}}
function wave(c,t,{digital=false,y=217,amplitude=55,gain=1,color=mint}={}){c.strokeStyle=color;c.lineWidth=3;c.beginPath();for(let k=0;k<=120;k++){const x=45+k*5,val=Math.sin(k*.16+t*9)*Math.sin(k*.023+.3)*amplitude*gain;if(digital){c.moveTo(x,y);c.lineTo(x,y-val);}else if(k===0)c.moveTo(x,y-val);else c.lineTo(x,y-val);}c.stroke();}
function mountain(c,x,y,w,h,t=0){const g=c.createLinearGradient(0,y,0,y+h);g.addColorStop(0,'#7b9a9a');g.addColorStop(1,'#bec6ab');c.fillStyle=g;c.fillRect(x,y,w,h);c.fillStyle='#e4dcbc';c.beginPath();c.arc(x+w*.76,y+h*.26,h*.095,0,Math.PI*2);c.fill();c.fillStyle='#476b64';c.beginPath();c.moveTo(x,y+h);c.lineTo(x+w*.28,y+h*.25);c.lineTo(x+w*.55,y+h*.74);c.lineTo(x+w*.8,y+h*.4);c.lineTo(x+w,y+h*.65);c.lineTo(x+w,y+h);c.fill();c.fillStyle='#234b48';c.beginPath();c.moveTo(x,y+h);c.quadraticCurveTo(x+w*.2,y+h*(.6+.04*Math.sin(t)),x+w,y+h*.87);c.lineTo(x+w,y+h);c.fill();}
function portrait(c,x,y,w,h,shade='#729489'){rounded(c,x,y,w,h,'#203936',15);c.fillStyle=shade;c.beginPath();c.arc(x+w*.5,y+h*.36,w*.14,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(x+w*.5,y+h*.82,w*.29,h*.24,0,0,Math.PI*2);c.fill();}
const labels={
 key:'눌린 키',report:'입력 보고서',focus:'입력할 앱',ime:'글자 조합',glyph:'모양과 위치',pixels:'화면에 그리기',typed:'문서',
 'double-click':'실행 요청',files:'실행 파일',address:'가상 주소 공간',thread:'실행할 스레드','page-fault':'필요한 페이지',pages:'RAM에 준비된 페이지',execute:'명령 실행',window:'첫 창',
 'save-keys':'Ctrl + S','write-request':'파일에 쓸 내용','write-buffer':'쓰기 대기','io-command':'위치와 쓰기 명령','write-transfer':'RAM → SSD',nand:'플래시 기록',flush:'남은 기록 마무리',saved:'저장 완료',
 play:'재생 요청','music-file':'압축된 음악',pcm:'소리의 샘플','audio-buffer':'다음 샘플',dac:'숫자 → 전기 신호',amplify:'신호 증폭',speaker:'진동 → 소리',
 'video-request':'영상 조각 요청',segments:'도착하는 조각','video-buffer':'미리 모은 데이터','buffer-low':'공급보다 빠른 소비','buffer-refill':'다시 채우기',decode:'프레임으로 복원','av-sync':'같은 재생 시각',video:'재생',
 capture:'카메라의 프레임',mic:'목소리의 샘플','capture-clock':'기록한 시각',encode:'영상 압축',send:'내 컴퓨터 → 상대방',jitter:'도착 간격 고르기','call-result':'상대방의 화면',
 windows:'세 프로그램',spaces:'서로 다른 주소 공간',scheduler:'실행 가능한 작업',waiting:'I/O를 기다리는 작업',parallel:'두 코어의 동시 실행',context:'실행 상태 보관','resume-thread':'멈춘 위치에서 재개','multitask-result':'함께 반응하는 창',
 insert:'USB 연결','usb-reset':'기본 통신','usb-address':'장치 주소',descriptor:'장치가 알려 주는 정보',driver:'드라이버 연결','usb-config':'전송 준비','usb-files':'파일 정보',drive:'연결된 저장장치',
 'sleep-request':'절전 요청',quiesce:'진행 중인 작업 정리',retain:'RAM 유지 전원','power-low':'낮은 전력 상태',wake:'깨우기 요청',restore:'장치 복귀',resumed:'이전 작업으로',
 prompt:'서버에 질문 보내기','server-ready':'서버의 준비',tokens:'토큰 예시',weights:'서버 메모리의 가중치',matrix:'서버의 모델 연산','next-token':'다음 토큰','tokens-return':'응답 스트림',answer:'돌아온 응답',
 'load-request':'필요한 자원',assets:'압축된 파일',unpack:'사용할 형태로 준비',shader:'그래픽 처리 준비',upload:'그래픽 자원 → VRAM','first-frame':'첫 프레임','asset-stream':'필요한 자원 추가 읽기','play-game':'플레이',
 'record-start':'화면 녹화 요청','capture-frame':'이미 그려진 프레임','record-audio':'소리의 시간축',mux:'영상 + 소리 + 시간','record-write':'녹화 파일 기록',drain:'남은 프레임 처리','record-end':'재생 가능한 파일'
};
export class ScenarioMechanisms{
 constructor(scene){
  this.scene=scene;this.root=new T.Group();scene.add(this.root);
  this.canvas=document.createElement('canvas');this.canvas.width=720;this.canvas.height=390;
  this.texture=new T.CanvasTexture(this.canvas);this.texture.colorSpace=T.SRGBColorSpace;this.texture.generateMipmaps=false;this.texture.minFilter=T.LinearFilter;
  this.panel=new T.Mesh(new T.PlaneGeometry(3.2,1.733),new T.MeshBasicMaterial({map:this.texture,transparent:true,depthWrite:false,toneMapped:false}));this.root.add(this.panel);
  this.waveGeometry=new T.BufferGeometry();this.waveGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(128*3),3));
  this.wave=new T.Line(this.waveGeometry,new T.LineBasicMaterial({color:0xadcdbd,transparent:true,opacity:.7}));this.root.add(this.wave);
  this.signals=new ScenarioSignals(scene);this.keys=[];this.cones=[];this.lastPanel='';this.lastScreen='';
 }
 prepare(film){
  this.film=film;this.root.visible=!!film.config.extended;this.lastPanel=this.lastScreen='';this.keys=[];this.cones=[];
  const keyboard=film.extras.input?.root;
  if(keyboard){const caps=keyboard.getObjectByName('키캡');for(const m of caps.children){if(!m.isMesh)continue;const isS=Math.abs(m.position.x+122)<.01&&Math.abs(m.position.z-4)<.01,isCtrl=Math.abs(m.position.x+150)<.01&&Math.abs(m.position.z-54)<.01,isK=Math.abs(m.position.x-28)<.01&&Math.abs(m.position.z-4)<.01;if(isS||isCtrl||isK)this.keys.push({mesh:m,y:m.position.y,key:isS?'S':isCtrl?'Ctrl':'K'});}}
  for(const model of Object.values(film.extras)){
   if(!model.fadeMaterials){model.fadeMaterials=[];model.root.traverse(o=>{if(!o.isMesh)return;const original=Array.isArray(o.material)?o.material:[o.material];const copies=original.map(m=>{const clone=model.plug?m:m.clone();if(clone!==m){clone.userData.persistent=false;(model.originalMaterials ||= new Set()).add(m);}model.fadeMaterials.push({material:clone,opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite});return clone;});o.material=Array.isArray(o.material)?copies:copies[0];});}
  }
  film.extras.audio?.root.traverse(m=>{if(m.geometry?.type==='ConeGeometry')this.cones.push({mesh:m,y:m.position.y});});
  this.signals.prepare(film);
 }
 reset(){for(const model of Object.values(this.film?.extras||{})){for(const m of model.fadeMaterials||[]){m.material.opacity=m.opacity;m.material.transparent=m.transparent;m.material.depthWrite=m.depthWrite;}}this.keys.forEach(({mesh,y})=>mesh.position.y=y);this.cones.forEach(({mesh,y})=>mesh.position.y=y);if(this.film?.key)this.film.key.intensity=3.4;if(this.film?.rim)this.film.rim.intensity=2;this.root.visible=false;this.signals.reset();}
 update(p,step,local){
  const f=this.film,e=step.effect,t=ease(local/.8);this.root.visible=true;
  const index=f.config.steps.indexOf(step),prev=f.config.steps[index-1],next=f.config.steps[index+1];
  for(const [id,model] of Object.entries(f.extras)){
   const amount=step.target===id?1:prev?.target===id?1-ease(local/.38):next?.target===id?ease((local-.6)/.4):0;
   model.root.visible=f.config.extras.includes(id)&&amount>.001;
   for(const m of model.fadeMaterials||[]){m.material.opacity=m.opacity*amount;m.material.transparent=m.transparent||amount<.999;m.material.depthWrite=m.depthWrite&&amount>.999;}
  }
  this.keys.forEach(({mesh,y,key})=>{const pressed=e==='save-keys'?(key==='Ctrl'||key==='S'):e==='key'||e==='wake'?key==='K':false;mesh.position.y=y-(pressed?Math.sin(Math.PI*clamp(local/.6,0,1))*1.1:0);});
  this.cones.forEach(({mesh,y})=>mesh.position.y=y+(e==='speaker'?Math.sin(local*35)*1.1:0));
  if(f.extras.usb){const at=f.config.steps.findIndex(s=>s.effect==='insert');f.extras.usb.pose(f.config.steps.indexOf(step)>at?1:e==='insert'?ease(local/.65):0);}
  const blend=matchMedia('(prefers-reduced-motion: reduce)').matches?0:ease((local-.55)/.45),dark=effect=>f.id==='sleep'&&['power-low','wake'].includes(effect)?1:0;
  const dim=mix(dark(e),dark(next?.effect),next?blend:0);if(f.key)f.key.intensity=mix(3.4,.55,dim);if(f.rim)f.rim.intensity=mix(2,.35,dim);
  this.panel.visible=!!step.visual.panel;
  this.panel.material.depthTest=false;this.panel.material.depthWrite=false;this.panel.renderOrder=10000;
  if(this.panel.visible){
   const focus=new T.Vector3(...step.focus);this.panel.position.copy(focus).add(new T.Vector3(-1.35,1.55,.1));this.panel.quaternion.copy(f.camera.quaternion);
   this.panel.scale.setScalar(['input','mouse','camera','usb','audio','datacenter'].includes(step.target)?1.12:.78);
   // Keep the conceptual illustration inside the reading area across all camera angles.
   this.fitPanel();this.drawPanel(e,t,p);this.texture.needsUpdate=true;
  }
  this.wave.visible=false;
  if(this.wave.visible){const a=this.waveGeometry.attributes.position;for(let i=0;i<128;i++)a.setXYZ(i,14.5+i*.037,1+Math.sin(i*.18+local*18)*.3*(e==='amplify'?.45+.55*t:1),1.9);a.needsUpdate=true;this.waveGeometry.computeBoundingSphere();}
  this.signals.update(p,step,local);
  const state=$state(f,step,local);document.body.dataset.mechanism=e;document.body.dataset.mechanismState=JSON.stringify(state);
 }
 fitPanel(){
  const camera=this.film.camera,mobile=innerWidth<=760,w=innerWidth,h=innerHeight;
  const projectedSize=()=>{
   const center=this.panel.position.clone(),q=this.panel.quaternion,scale=this.panel.scale.x;
   const a=new T.Vector3(-1.6,-.8665,0).multiplyScalar(scale).applyQuaternion(q).add(center).project(camera);
   const b=new T.Vector3(1.6,.8665,0).multiplyScalar(scale).applyQuaternion(q).add(center).project(camera);
   return {width:Math.abs(b.x-a.x)*w/2,height:Math.abs(b.y-a.y)*h/2};
  };
  let size=projectedSize();this.panel.scale.multiplyScalar(Math.min(1,(mobile?w*.76:310)/size.width,(mobile?120:168)/size.height));size=projectedSize();
  const p=this.panel.position.clone().project(camera),px=(p.x+1)*w/2,py=(1-p.y)*h/2;
  const audio=this.film.currentBeat.target==='audio';
  const x=clamp(px,(mobile?.05:audio?.06:.30)*w+size.width/2,(mobile?.95:audio?.43:.95)*w-size.width/2),y=clamp(py,.045*h+size.height/2,(mobile?.34:.40)*h-size.height/2);
  this.panel.position.copy(new T.Vector3(x/w*2-1,1-y/h*2,p.z).unproject(camera));
 }
 drawPanel(e,t,p){
  const c=this.canvas.getContext('2d');c.clearRect(0,0,720,390);
  // This quiet translucent sheet is a logical illustration, separate from the component geometry.
  const bg=c.createLinearGradient(0,0,0,390);bg.addColorStop(0,'#0e1b19e8');bg.addColorStop(1,'#0e1b1999');rounded(c,0,0,720,390,bg,14);
  text(c,labels[e]||'',35,53,32);line(c,35,78,685,78,'#355348');
  if(['key','save-keys','wake'].includes(e)){
   const names=e==='save-keys'?['Ctrl','S']:['ㅏ'];names.forEach((s,i)=>{const pressed=Math.sin(t*Math.PI);card(c,210+i*150,135+pressed*10,120,125,s);});
  }else if(e==='ime'){
   text(c,'ㄱ',110,235,80);text(c,'+',237,227,45,muted);text(c,'ㅏ',310,235,80);text(c,'→',435,226,44,muted);c.globalAlpha=t;text(c,'가',533,236,80);c.globalAlpha=1;
  }else if(['glyph','pixels'].includes(e)){
   c.font='165px Arial';c.strokeStyle=mint;c.lineWidth=1.5;c.strokeText('가',280,275);c.save();c.beginPath();c.rect(245,90,230*t,230);c.clip();c.fillStyle=mint;c.fillText('가',280,275);c.restore();line(c,130,290,590,290);text(c,'기준선',130,326,19,muted);
  }else if(['address','spaces','pages','page-fault','retain'].includes(e)){
   const rows=e==='spaces'?3:1;for(let r=0;r<rows;r++){text(c,rows>1?['문서','음악','브라우저'][r]:'프로그램의 주소',40,125+r*75,21);for(let i=0;i<8;i++){const active=e==='address'?false:e==='page-fault'?i===Math.floor(t*7):i<2+Math.floor(t*4);card(c,240+i*52,99+r*75,43,43,active?'▰':'',active?mint:muted);}}
   if(e==='retain'){text(c,'RAM에 전원을 유지합니다',160,260,25);line(c,90,320,630,320,mint,4);}else if(rows===1)text(c,e==='page-fault'?'없는 내용만 요청':'주소 공간 ≠ 사용 중인 RAM 전체',80,280,22,muted);
  }else if(['scheduler','waiting','parallel','context','resume-thread','thread','execute'].includes(e)){
   const names=['문서','음악','브라우저'],colors=[mint,gold,blue];names.forEach((name,j)=>card(c,55+j*213,102,190,50,name,colors[j]));
   for(let r=0;r<2;r++){text(c,'코어 '+(r+1),40,213+r*67,22);for(let j=0;j<6;j++){const which=(j+r+(e==='context'?1:0))%3;rounded(c,145+j*83,181+r*67,76,37,colors[which],4);}line(c,145+t*498,169,145+t*498,294,mint,3);}
   text(c,e==='waiting'?'I/O 대기 → 다른 작업 실행':e==='context'?'현재 실행 위치를 기억':'같은 시간축에서 바라본 작업',145,342,22,muted);
  }else if(['pcm','mic','audio-buffer','dac','amplify','speaker','record-audio'].includes(e)){
   wave(c,t,{digital:['pcm','mic','audio-buffer','record-audio'].includes(e),gain:e==='amplify'?.3+.7*t:1});if(e==='audio-buffer')bars(c,.7-t*.3,{y:310});else text(c,e==='dac'?'숫자 샘플 → 아날로그 신호':e==='speaker'?'진동판이 공기를 움직입니다':'시간에 따른 소리 크기',55,329,23,muted);
  }else if(['video-buffer','buffer-low','buffer-refill','jitter','write-buffer','flush','drain'].includes(e)){
   const amount=e==='buffer-low'?1-t*.95:e==='buffer-refill'?t:e==='flush'||e==='drain'?1-t:e==='jitter'?.45+.3*t:t;
   bars(c,amount,{y:192});text(c,e==='buffer-low'&&t>.75?'다음 데이터를 기다립니다':e==='flush'?'대기 중인 기록을 마무리':'들어오는 데이터',50,142,24);text(c,e==='write-buffer'?'RAM의 대기 공간':e==='jitter'?'도착 시간의 흔들림을 흡수':'사용하거나 기록할 데이터',50,306,23,muted);
  }else if(['decode','encode','unpack','first-frame','capture-frame','capture','capture-clock'].includes(e)){
   const capture=['capture','capture-frame','capture-clock'].includes(e),first=e==='first-frame',compress=e==='encode';const left=(compress||capture||first)?1:0,right=compress?0:1;
   if(first){for(let j=0;j<7;j++)line(c,50,125+j*22,248,125+j*22,muted);c.strokeStyle=mint;c.beginPath();c.moveTo(60,255);c.lineTo(134,135);c.lineTo(235,255);c.closePath();c.stroke();}else if(left){if(this.film.id==='call')portrait(c,40,125,210,142);else mountain(c,40,125,210,142,p);}else for(let j=0;j<4;j++)card(c,50+j*42,168,32,52,'');
   text(c,'→',321,217,40,muted);
   c.globalAlpha=.35+.65*t;if(right){if(this.film.id==='call')portrait(c,455,125,220,142);else mountain(c,455,125,220,142,p);}else for(let j=0;j<4;j++)card(c,465+j*42,168,32,52,'');c.globalAlpha=1;
   text(c,e==='capture-clock'?'영상과 소리에 같은 시간 정보':capture?'이미 만들어진 프레임을 받습니다':first?'그래픽 자원으로 화면을 그립니다':compress?'프레임 → 압축 데이터':'압축 데이터 → 사용할 내용',70,333,23,muted);
  }else if(['av-sync','mux'].includes(e)){
   for(let j=0;j<5;j++){mountain(c,110+j*112,110,94,58,p+j);card(c,110+j*112,215,94,42,'');}wave(c,t,{y:236,amplitude:13});const x=110+t*542;line(c,x,93,x,298,gold,3);text(c,e==='mux'?'영상 · 소리 · 시간 → 컨테이너':'같은 시각에 화면과 소리를 출력',100,338,24,muted);
  }else if(['usb-reset','usb-address','descriptor','driver','usb-config','insert'].includes(e)){
   const rows=e==='descriptor'?['종류  ·  저장장치','인터페이스  ·  대용량 저장','기능과 전력 정보']:e==='driver'?['운영체제','이미 준비된 저장장치 드라이버','새 장치에 연결']:e==='usb-address'?['호스트가 주소를 배정','장치를 구별해 요청 전달']:['연결 감지','호스트의 요청','장치의 응답'];
   rows.forEach((s,j)=>{c.globalAlpha=t>j/4?1:.28;card(c,70,102+j*80,580,58,s);});c.globalAlpha=1;
  }else if(['tokens','weights','matrix','next-token','server-ready','tokens-return'].includes(e)){
   if(['weights','matrix','server-ready'].includes(e)){for(let y=0;y<5;y++)for(let x=0;x<12;x++){const highlight=x===Math.floor(t*12);rounded(c,50+x*33,106+y*35,25,26,highlight?mint:'#345548',2);}text(c,'→',470,210,40,muted);card(c,542,166,130,77,e==='server-ready'?'준비':'다음 토큰');text(c,'서버에서 사용하는 메모리와 연산',70,337,22,muted);}
   else{const words=['오늘','의',' 날','씨','는'];words.forEach((s,j)=>{c.globalAlpha=e==='tokens'||j/5<=t?1:.18;card(c,50+j*130,150,116,82,s);});c.globalAlpha=1;text(c,'토큰의 경계는 모델마다 다릅니다',75,322,22,muted);}
  }else if(['power-low','quiesce','restore'].includes(e)){
   ['CPU','GPU','RAM'].forEach((s,j)=>{const on=e==='power-low'?j===2:e==='restore'?j/3<t:true;card(c,75+j*205,141,168,92,s,on?mint:muted);rounded(c,95+j*205,259,128,5,on?mint:'#243c33',2);});text(c,e==='power-low'?'이 예시는 RAM 유지형 S3 절전':'장치별 상태를 운영체제가 조정',65,335,22,muted);
  }else if(['nand','write-transfer','record-write','io-command','write-request','files','assets','upload','shader','asset-stream','usb-files','music-file'].includes(e)){
   const labels=e==='files'?['앱','라이브러리']:e==='upload'?['모델','텍스처']:e==='shader'?['명령','셰이더']:['데이터','데이터'];
   for(let j=0;j<4;j++){const done=e==='nand'?j/4<t:true;card(c,58+j*158,145,136,104,labels[j%2],done?mint:muted);for(let k=0;k<3;k++)line(c,76+j*158,211+k*9,153+j*158,211+k*9,done?mint:muted);}
   text(c,e==='nand'?'문서는 기록 상태를 나타냅니다':e==='io-command'?'명령과 대용량 데이터는 다릅니다':e==='upload'?'그래픽 자원만 VRAM에 준비':'작업에 필요한 내용을 준비합니다',55,333,23,muted);
  }else{
   card(c,60,146,220,94,e==='focus'?'입력할 앱':'요청');text(c,'→',327,204,40,muted);card(c,430,146,230,94,e==='send'?'상대방':'처리');bars(c,t,{y:306});
  }
 }
 paintOutput(c,id,e,t,p,{remote=false}={}){paintScenarioScreen(c,id,e,t,p,{remote});}

}
function $state(f,step,local){return{story:f.id,effect:step.effect,stage:f.config.steps.indexOf(step),local:+local.toFixed(4),visual:step.visual.mode};}
