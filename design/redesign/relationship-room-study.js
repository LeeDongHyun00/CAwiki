// Isolated design prototype: the production relationship routes stay intact.
import * as T from '../../lib/vendor/three/three.module.js';
import { createComputer, batchStaticMeshes } from './cinema-models.js';
import { createCollectionModel } from './collection-models.js';
import { portraitModel, portraitScene } from './hardware-portraits.js';
import { HARDWARE } from './site-data.js';
import { RELATION_GROUPS } from './relation-scenarios.js';
import { RELATION_SOURCE } from './relation-source.js';

const $=s=>document.querySelector(s),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const nodes=new Map(RELATION_SOURCE.nodes.map(n=>[n.id,n]));
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),ease=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10);};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wrap=(v,n)=>((v+n/2)%n+n)%n-n/2;
let renderer,scene,camera,items=[],active=null,detail=null,tab='role',moving=false,frame=0,previous=0,transitionAt=0,restoreFocus=null,detailOrigin=null;
let rail=0,railTarget=0,drag=null,preventClick=false,pan=0,panTarget=0,roomDrag=null;
const buttons=RELATION_GROUPS.map((g,i)=>{
 const b=document.createElement('button');b.className='room-topic';b.textContent=g.title;b.dataset.group=g.id;b.setAttribute('aria-pressed','false');
 b.onclick=()=>{if(preventClick)return;select(active===g.id?null:g.id);railTarget=rail+wrap(i-rail,6);wake();};
 b.onfocus=()=>{railTarget=rail+wrap(i-rail,6);wake();};
 b.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const next=(i+(e.key==='ArrowRight'?1:5))%6;railTarget=rail+wrap(next-rail,6);buttons[next].focus({preventScroll:true});wake();}};
 $('#room-titles').append(b);return b;
});
function drawRail(){
 const gap=innerWidth<700?173:238;
 buttons.forEach((b,i)=>{const d=wrap(i-rail,6),a=Math.abs(d);b.style.transform=`translate(calc(-50% + ${d*gap}px),${a*a*4}px) scale(${1-Math.min(a,3)*.09})`;b.style.opacity=String(1-Math.min(a,3)*.2);b.setAttribute('aria-pressed',String(active===RELATION_GROUPS[i].id));});
}
const railEl=$('#room-rail');
railEl.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,start:rail,moved:false};preventClick=false;});
railEl.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x;if(Math.abs(dx)>7){drag.moved=true;preventClick=true;railEl.setPointerCapture(e.pointerId);}if(drag.moved){rail=drag.start-dx/(innerWidth<700?173:238);railTarget=rail;drawRail();}});
function releaseRail(e){if(!drag||drag.id!==e.pointerId)return;const moved=drag.moved;drag=null;if(moved){railTarget=Math.round(rail);wake();}setTimeout(()=>{preventClick=false;},0);}
railEl.addEventListener('pointerup',releaseRail);railEl.addEventListener('pointercancel',releaseRail);railEl.addEventListener('lostpointercapture',e=>{if(drag)releaseRail(e);});
railEl.addEventListener('wheel',e=>{if(Math.abs(e.deltaX)>Math.abs(e.deltaY)){e.preventDefault();railTarget+=e.deltaX/400;wake();}},{passive:false});

function roomSlot(index){
 // Nine on the back wall, seven on each side. The grid is never drawn.
 // Narrow screens unfold the side walls into three readable gallery bays.
 if(innerWidth<700){const side=index<9?0:index<16?-1:1,j=index<9?index:(index-9)%7,col=j===6&&side?1:j%3;return{x:side*11+(col-1)*3.3,y:5.2-Math.floor(j/3)*3.6,z:-2,ry:-side*.12,size:1.8};}
 if(index<9)return{x:(index%3-1)*5.5,y:4.5-Math.floor(index/3)*3.7,z:-5.4,ry:0,size:2.1};
 const side=index<16?-1:1,j=(index-9)%7,positions=[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[1,2]], [col,row]=positions[j];
 return{x:side*9.2,y:4.5-row*3.7,z:-4+col*4.5,ry:-side*.55,size:1.5};
}
function target(item){
 const mobile=innerWidth<700;
 if(detail){return item.id===detail?{x:mobile?0:-5.6,y:mobile?4.5:.5,z:2,ry:0,size:mobile?4.3:6,opacity:1}:{...item.pose,opacity:0};}
 if(!active){const slot=roomSlot(item.index);return{...slot,opacity:1};}
 const group=RELATION_GROUPS.find(g=>g.id===active),order=[group.focus,...group.nodes.filter(id=>id!==group.focus)],i=order.indexOf(item.id);
 if(i<0)return{...roomSlot(item.index),opacity:0};
 if(mobile){const positions=[[0,4.3],[-2.4,1.4],[2.4,1.4],[-2.4,-1.4],[2.4,-1.4],[-2.4,-4.2],[2.4,-4.2]];return{x:positions[i][0],y:positions[i][1]+1.1,z:3,ry:0,size:i===0?2.2:1.65,opacity:1};}
 if(i===0)return{x:0,y:1.5,z:3,ry:0,size:3.4,opacity:1};
 const angle=-Math.PI/2+(i-1)/(order.length-1)*Math.PI*2;
 return{x:Math.cos(angle)*5.8,y:1.5+Math.sin(angle)*2.8,z:2.5,ry:0,size:2.55,opacity:1};
}
function transition(){
 transitionAt=performance.now();moving=true;items.forEach(item=>{item.from={...item.pose};item.to=target(item);});
 if(reduced.matches||!renderer){items.forEach(item=>Object.assign(item.pose,item.to));moving=false;}
 $('#room').dataset.moving=String(moving);$('#room').dataset.group=active||'all';$('#room').dataset.detail=detail||'';wake();
}
function select(id){
 active=id;detail=null;document.body.classList.remove('has-detail','detail-ready');$('#room-detail').hidden=true;
 panTarget=0;$('#room-title').textContent=RELATION_GROUPS.find(g=>g.id===id)?.title||'관계지도';
 $('#room-status').textContent=id?`${$('#room-title').textContent} 관련 하드웨어 ${RELATION_GROUPS.find(g=>g.id===id).nodes.length}개`:'모든 하드웨어 23개';
 history.replaceState(null,'',id?'#group/'+id:'#all');drawRail();transition();renderFallback();
}
function openDetail(id){
 if(!detail)detailOrigin=id;detail=id;tab='role';document.body.classList.add('has-detail');document.body.classList.remove('detail-ready');$('#room-detail').hidden=false;$('#room-rail').inert=true;
 renderDetail();transition();history.replaceState(null,'','#node/'+id+(active?'?from='+active:''));
 $('#room-close').focus({preventScroll:true});renderFallback();
}
function closeDetail(){restoreFocus=detailOrigin;$('#room-rail').inert=false;select(active);}
$('#room-close').onclick=closeDetail;
function renderDetail(){
 const n=nodes.get(detail);$('#detail-title').textContent=n.name;
 $('#detail-tabs').innerHTML=[['role','역할'],['parts','내부 구성'],['relations','연결 관계']].map(([id,label])=>`<button data-tab="${id}" aria-pressed="${id===tab}">${label}</button>`).join('');
 $('#detail-tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;renderDetail();$('#detail-tabs [data-tab="'+tab+'"]').focus();});
 if(tab==='role')$('#detail-copy').innerHTML=`<h3>${esc(n.summary)}</h3><p>${esc(n.detail)}</p>`;
 else if(tab==='parts')$('#detail-copy').innerHTML=`<ul>${n.parts.map(p=>`<li><strong>${esc(p.name)}</strong>${esc(p.role)}</li>`).join('')}</ul>`;
 else{
  const edges=RELATION_SOURCE.edges.filter(e=>e.a===detail||e.b===detail);
  $('#detail-copy').innerHTML=edges.map(e=>{const id=e.a===detail?e.b:e.a;return `<button class="detail-peer" data-peer="${id}">${esc(nodes.get(id).name)}<span>${esc(e.a===detail?e.ab:e.ba)}</span></button>`;}).join('');
  $('#detail-copy').querySelectorAll('[data-peer]').forEach(b=>b.onclick=()=>openDetail(b.dataset.peer));
 }
}
addEventListener('keydown',e=>{if(e.key==='Escape'){if(detail)closeDetail();else if(active)select(null);}});
function wake(){if(!frame&&!document.hidden)frame=requestAnimationFrame(tick);}
function tick(now){
 frame=0;const dt=Math.min((now-previous)||16,50);previous=now;
 if(reduced.matches){rail=railTarget;pan=panTarget;}else{if(!drag)rail+=(railTarget-rail)*(1-Math.exp(-dt/100));pan+=(panTarget-pan)*(1-Math.exp(-dt/150));}drawRail();
 if(renderer){
  const duration=reduced.matches?0:1100,t=duration?clamp((now-transitionAt)/duration):1;
  if(moving){items.forEach(item=>{const p=ease(t),fade=ease(clamp(t*2.5)),appearing=item.to.opacity>item.from.opacity;for(const key of ['x','y','z','ry','size'])item.pose[key]=T.MathUtils.lerp(item.from[key],item.to[key],p);item.pose.opacity=T.MathUtils.lerp(item.from.opacity,item.to.opacity,appearing?ease(clamp((t-.15)/.7)):fade);});if(t===1)moving=false;}
  camera.position.x=innerWidth<700&&!active&&!detail?pan:0;camera.lookAt(camera.position.x,0,-3);camera.updateMatrixWorld();
  const v=new T.Vector3();items.forEach(item=>{
   const p=item.pose;item.group.position.set(p.x,p.y,p.z);item.group.scale.setScalar(p.size/item.extent);item.group.quaternion.copy(item.rotation);item.group.rotateY(p.ry);
   const hover=item.button.matches(':hover,:focus-visible')&&!moving&&!detail;item.lift+=(Number(hover)-item.lift)*(1-Math.exp(-dt/90));item.group.position.z+=item.lift*.25;
   item.group.visible=p.opacity>.003;
   // Opacity is composited after each opaque model has rendered. Internal
   // surfaces never become visible during the disappearance transition.
   item.button.disabled=!!detail||p.opacity<.95;item.button.style.pointerEvents=item.button.disabled?'none':'auto';item.button.style.opacity=String(detail?0:p.opacity);
   v.copy(item.group.position).project(camera);const h=innerHeight*p.size/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2))*(camera.position.z-p.z)),w=h*1.15;
   item.button.style.width=w+'px';item.button.style.height=h+20+'px';item.button.style.transform=`translate(${(v.x+1)*innerWidth/2-w/2}px,${(1-v.y)*innerHeight/2-h/2}px)`;
  });
  drawScene();
  if(detail&&!moving)document.body.classList.add('detail-ready');
  if(restoreFocus&&!moving){items.find(i=>i.id===restoreFocus)?.button.focus({preventScroll:true});restoreFocus=null;}
 }
 $('#room').dataset.moving=String(moving);
 if(moving||Math.abs(railTarget-rail)>.0005||Math.abs(panTarget-pan)>.001||items.some(i=>Math.abs(i.lift-Number(i.button.matches(':hover,:focus-visible')&&!detail&&!moving))>.002))wake();
}
let modelLayer,compositeScene,compositeCamera,quad,roomScene;
function drawScene(){
 renderer.setRenderTarget(null);renderer.setClearColor(0xf2f2ed,1);renderer.render(roomScene,camera);
 renderer.autoClear=false;
 // One shared target; opaque depth-tested geometry then flat alpha composition.
 // Fully opaque models can share a pass, translucent ones each use a pass.
 const fades=items.filter(i=>i.pose.opacity>.003&&i.pose.opacity<.997);
 items.forEach(i=>i.group.visible=i.pose.opacity>=.997);
 renderer.render(scene,camera);
 for(const item of fades){
  items.forEach(i=>i.group.visible=i===item);renderer.setRenderTarget(modelLayer);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,camera);
  renderer.setRenderTarget(null);quad.material.opacity=item.pose.opacity;renderer.render(compositeScene,compositeCamera);
 }
 renderer.autoClear=true;
}
function resize(){if(!renderer)return;const mobile=innerWidth<700;roomScene.children[0].scale.x=mobile?2:1;roomScene.children[1].position.x=mobile?-19.8:-9.9;roomScene.children[2].position.x=mobile?19.8:9.9;roomScene.children[3].scale.x=roomScene.children[4].scale.x=mobile?2:1;renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth<700?43:39;camera.position.z=innerWidth<700?28:25;camera.updateProjectionMatrix();const s=renderer.getDrawingBufferSize(new T.Vector2());modelLayer.setSize(s.x,s.y);transition();}
function renderFallback(){
 if(renderer)return;
 $('#room-hardware').hidden=true;$('#room-world').hidden=true;if(detail)document.body.classList.add('detail-ready');
 let el=$('.room-fallback');if(!el){el=document.createElement('div');el.className='room-fallback';$('#room').append(el);}
 const ids=active?RELATION_GROUPS.find(g=>g.id===active).nodes:HARDWARE.map(x=>x.id);
 el.innerHTML=ids.map(id=>`<button data-id="${id}"><img src="${window.__insideAssets?.['redesign/'+id+'.webp']||'../../assets/models/redesign/'+id+'.webp'}" alt="">${esc(nodes.get(id).name)}</button>`).join('');el.querySelectorAll('button').forEach(b=>b.onclick=()=>{openDetail(b.dataset.id);document.body.classList.add('detail-ready');});el.hidden=!!detail;
}
async function start(){
 drawRail();try{
  renderer=new T.WebGLRenderer({canvas:$('#room-world'),alpha:true,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  const studio=new T.Scene();studio.background=new T.Color(0x17191c);
  for(const [w,h,pos,intensity,color] of [[9,12,[-8,9,5],5.5,0xf2f1ef],[2,14,[8,4,0],5,0xc9daf5],[12,3,[0,8,-8],6.5,0xffffff],[6,5,[-1,-7,6],1.4,0xffffff],[3,9,[2,1,10],1.9,0xffffff]]){const p=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(intensity),side:T.DoubleSide}));p.position.set(...pos);p.lookAt(0,0,0);studio.add(p);}
  const pmrem=new T.PMREMGenerator(renderer),env=pmrem.fromScene(studio,.045);pmrem.dispose();scene=portraitScene(env.texture);
  camera=new T.PerspectiveCamera(39,innerWidth/innerHeight,.1,120);camera.position.z=25;
  roomScene=new T.Scene();roomScene.background=new T.Color(0xf2f2ed);
  const wall=(w,h,pos,rotation,color)=>{const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color,side:T.DoubleSide,toneMapped:false}));m.position.set(...pos);m.rotation.set(...rotation);roomScene.add(m);};
  wall(19.8,15,[0,0,-7],[0,0,0],0xe8e9e2);wall(22,15,[-9.9,0,4],[0,Math.PI/2,0],0xeeeee8);wall(22,15,[9.9,0,4],[0,-Math.PI/2,0],0xf5f5f0);wall(20,22,[0,-7.5,4],[-Math.PI/2,0,0],0xf1f1eb);wall(20,22,[0,7.5,4],[Math.PI/2,0,0],0xf5f5ef);
  modelLayer=new T.WebGLRenderTarget(1,1);compositeScene=new T.Scene();compositeCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);quad=new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshBasicMaterial({map:modelLayer.texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));compositeScene.add(quad);
  const computer=createComputer();
  // Deliberate distribution by silhouette, rather than six clusters of topics.
  const ids=['npu','cpu','sram','dram','mainboard','vram','spirom','gpu','coproc','ssd','power','hdd','cooling','vrm','bus','nic','display','camera','audio','mouse','input','infra','datacenter'];
  for(const [index,id] of ids.entries()){
   const root=id==='mainboard'?computer.board.root:computer.parts[id]?.model.root||createCollectionModel(id).root;
   const model=portraitModel(root,id,computer.rest[id]);batchStaticMeshes(model.group);scene.add(model.group);
   const button=document.createElement('button');button.className='room-part';button.dataset.hardware=id;button.innerHTML=`<span>${esc(HARDWARE.find(x=>x.id===id).title)}</span>`;button.setAttribute('aria-label',nodes.get(id).name+' 설명');button.onclick=()=>{if(!roomDrag?.moved)openDetail(id);};button.onpointerenter=button.onpointerleave=button.onblur=wake;button.onfocus=()=>{if(innerWidth<700&&!active&&!detail)panTarget=clamp(roomSlot(index).x,-11,11);wake();};$('#room-hardware').append(button);
   items.push({id,index,group:model.group,rotation:model.group.quaternion.clone(),extent:Math.max(model.size.x,model.size.y),pose:{...roomSlot(index),opacity:1},button,lift:0});
   // Let the loading page paint while geometry is built.
   if(index%4===0)await new Promise(requestAnimationFrame);
  }
  resize();$('#room').dataset.ready='true';$('#room-status').textContent='모든 하드웨어 23개';
 }catch(error){console.warn('Room preview uses image fallback',error);renderer?.dispose();renderer=null;renderFallback();$('#room').dataset.ready='fallback';}
 const route=location.hash.slice(1),group=route.startsWith('group/')?route.split('/')[1]:new URLSearchParams(route.split('?')[1]).get('from');
 if(RELATION_GROUPS.some(g=>g.id===group)){select(group);rail=railTarget=RELATION_GROUPS.findIndex(g=>g.id===group);drawRail();}
 if(route.startsWith('node/')&&nodes.has(route.split('/')[1].split('?')[0]))openDetail(route.split('/')[1].split('?')[0]);
}
addEventListener('resize',resize);reduced.addEventListener('change',transition);document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else wake();});
$('#room-world').addEventListener('webglcontextlost',e=>{e.preventDefault();renderer=null;renderFallback();});
// On a narrow screen the room retains scale; a horizontal pan visits the walls.
$('#room').addEventListener('pointerdown',e=>{if(innerWidth>=700||active||detail||e.target.closest('#room-rail,.room-exit'))return;roomDrag={id:e.pointerId,x:e.clientX,pan:panTarget,moved:false};});
$('#room').addEventListener('pointermove',e=>{if(!roomDrag||e.pointerId!==roomDrag.id)return;const dx=e.clientX-roomDrag.x;if(Math.abs(dx)>8){roomDrag.moved=true;$('#room').setPointerCapture(e.pointerId);panTarget=clamp(roomDrag.pan-dx/innerWidth*12,-11,11);wake();}});
$('#room').addEventListener('pointerup',()=>{setTimeout(()=>{roomDrag=null;},0);});$('#room').addEventListener('pointercancel',()=>{roomDrag=null;});
start();
