// Spatial gallery shared by the main #map route and the standalone preview.
import * as T from '../../lib/vendor/three/three.module.js';
import { createComputer, batchStaticMeshes } from './cinema-models.js';
import { createCollectionModel } from './collection-models.js';
import { portraitModel, portraitScene } from './hardware-portraits.js';
import { HARDWARE, STORIES } from './site-data.js';
import { storyCover } from './story-covers.js';
import { RELATION_GROUPS, RELATION_SCENARIOS, RELATION_KINDS } from './relation-scenarios.js';
import { RELATION_SOURCE } from './relation-source.js';

const $=s=>document.querySelector(s),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const nodes=new Map(RELATION_SOURCE.nodes.map(n=>[n.id,n]));
const topics=[{id:'all',title:'전체보기'},...RELATION_GROUPS],TAU=Math.PI*2;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),ease=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10);};
const range=(v,a,b)=>ease((v-a)/(b-a)),mix=T.MathUtils.lerp,wrap=(v,n)=>((v+n/2)%n+n)%n-n/2;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asset=id=>window.__insideAssets?.['redesign/'+id+'.webp']||'../../assets/models/redesign/'+id+'.webp';
const siteURL='../../index.html';
const embedded=new URLSearchParams(location.search).has('embedded')&&parent!==window;
const tellHost=(type,extra={})=>{if(embedded)parent.postMessage({channel:'inside-room',type,...extra},location.origin);};
function writeRoute(hash){history.replaceState(null,'',hash);tellHost('route',{hash});}
const scope={data:'데이터의 기능적 연결을 표현합니다 실제 전송은 컨트롤러·운영체제·프로토콜을 거칠 수 있습니다',power:'전력 공급 관계이며 데이터의 이동을 뜻하지 않습니다',thermal:'열의 발생과 방출 관계입니다',structure:'포함되거나 장착되는 구조적 관계입니다 제품에 따라 실제 구성이 다를 수 있습니다',context:'역할과 사용 맥락의 관계이며 직접 연결된 배선을 뜻하지 않습니다'};

// Positions are persistent, deliberately irregular exhibits on five surfaces.
// x/y/z define the mount; rotations point away from its supporting wall.
const mounts=[
 ['cpu',-7.8,4.5,-11.8,0,0,-.06,4.7,'back'],
 ['mainboard',1.2,.2,-11.5,0,0,.06,6.8,'back'],
 ['gpu',8.6,4.6,-11.6,0,0,-.12,6.1,'back'],
 ['dram',-10.5,-1.3,-11.7,0,0,.06,4.5,'back'],
 ['npu',-.5,6.6,-11.8,0,0,.1,2.7,'back'],
 ['sram',8.3,-1.7,-11.9,0,0,-.04,2.9,'back'],
 ['coproc',-6.1,-5.8,-11.7,0,0,.09,3.3,'back'],
 ['vram',5.5,-5.7,-11.7,0,0,-.13,2.5,'back'],
 ['spirom',11,1.4,-11.5,0,0,.16,2.1,'back'],
 ['ssd',-16.3,4.9,-8.5,0,Math.PI/2,.12,4.3,'left'],
 ['hdd',-16.2,-1.7,-8.5,0,Math.PI/2,-.14,5,'left'],
 ['cooling',-16.2,3.8,-1.9,0,Math.PI/2,.08,4.3,'left'],
 ['vrm',-16.3,-3.7,-2.4,0,Math.PI/2,-.1,3.9,'left'],
 ['display',16.1,4.6,-8.5,0,-Math.PI/2,-.05,5.2,'right'],
 ['camera',16.2,-1.8,-8.7,0,-Math.PI/2,.08,3.8,'right'],
 ['audio',16.2,3.9,-1.7,0,-Math.PI/2,.06,4.6,'right'],
 ['infra',16.1,-3.7,-2.3,0,-Math.PI/2,-.12,4.9,'right'],
 ['power',-7.3,9.5,-3.3,Math.PI/2,0,.04,4.2,'ceiling'],
 ['nic',1.8,9.5,-5.7,Math.PI/2,0,.18,3.8,'ceiling'],
 ['bus',8.2,9.5,-4.1,Math.PI/2,0,-.18,4.7,'ceiling'],
 ['input',-9,-8.8,-11.9,-.65,.25,.06,5.2,'floor'],
 ['mouse',-.8,-8.8,-11.5,-.65,.25,-.15,3.5,'floor'],
 ['datacenter',8.8,-7.9,-11.6,0,0,.06,3.5,'floor'],
];
const poseKeys=['x','y','z','rx','ry','rz','size'];
let renderer,scene,camera,roomScene,modelLayer,compositeScene,compositeCamera,quad,items=[];
let active=null,detail=null,selectedEdge=null,detailOrigin=null,tab='role',partIndex=0,peerPage=0;
let view='wiki',transitionKind='idle',transitionAt=0,moving=false,frame=0,lastTime=0,entryToken=0,wikiScroll=0,restoreFocus=null;
let rail=0,railTarget=0,railDrag=null,railBlockClick=false,railFrame=0,railTime=0,blockClick=false,roomDrag=null,exitCamera=null;
let pointer={x:0,y:0},look={x:0,y:0},pan={x:0,y:0},cameraX=0;
const travelling=()=>view==='entering'||view==='exiting';
const title=$('#room-title'),room=$('#room'),wiki=$('#wiki-page'),railEl=$('#room-rail');

$('#wiki-hardware').innerHTML=HARDWARE.map(p=>`<li><a href="${siteURL}#object/${p.id}" aria-label="${esc(p.name)} 3D 살펴보기"><figure><img src="${asset(p.id)}" alt="" data-id="${p.id}" loading="eager" decoding="async"></figure><div class="item-caption"><div><span class="item-number">${String(p.index+1).padStart(2,'0')}</span><strong>${p.title}</strong></div><small>${esc(p.name)}</small></div></a></li>`).join('');
$('#wiki-stories').innerHTML=RELATION_SCENARIOS.map((s,i)=>`<li><a class="story-card" href="${siteURL}#story/${s.id}/0">${storyCover(s.id,'room-study')}<div class="story-card-heading"><h3>${esc(STORIES[s.id]?.title||s.title)}</h3><span>↗</span></div></a></li>`).join('');
function showTab(name){
 const stories=name==='stories';$('#wiki-hardware').hidden=stories;$('#wiki-stories').hidden=!stories;
 document.querySelectorAll('[data-wiki-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.wikiTab===name)));
}
document.querySelectorAll('[data-wiki-tab]').forEach(b=>b.onclick=()=>b.dataset.wikiTab==='map'?enterRoom():showTab(b.dataset.wikiTab));

const buttons=topics.map((g,i)=>{
 const b=document.createElement('button');b.className='room-topic';b.textContent=g.title;b.dataset.group=g.id;b.setAttribute('aria-pressed',String(i===0));
 b.onclick=()=>{if(view!=='room')return;railTarget=rail+wrap(i-rail,topics.length);select(g.id==='all'?null:g.id);};
 b.onfocus=()=>{if(!railDrag&&b.matches(':focus-visible')){railTarget=rail+wrap(i-rail,topics.length);wakeRail();}};
 b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?topics.length-1:(i+(e.key==='ArrowRight'?1:topics.length-1))%topics.length;buttons[next].focus({preventScroll:true});}};
 $('#room-titles').append(b);return b;
});
function drawRail(){
 const mobile=innerWidth<700,w=railEl.clientWidth,r=mobile?w*.38:Math.min(448,w*.36),ry=mobile?42:58;
 buttons.forEach((b,i)=>{
  // Keep every control in front of the containing plane: negative translateZ
  // can paint the label but route a mobile tap to the empty parent instead.
  const angle=(i-rail)*TAU/topics.length,front=(Math.cos(angle)+1)/2,x=Math.sin(angle)*r,y=Math.cos(angle)*ry,z=1+front*(mobile?32:70);
  b.style.transform=`translate3d(calc(-50% + ${x}px),${y}px,${z}px) rotateZ(${-Math.sin(angle)*(mobile?13:17)}deg) scale(${mix(.67,1,front)})`;
  b.style.opacity=String(mix(.48,1,front));b.style.zIndex=String(Math.round(front*100));b.setAttribute('aria-pressed',String((active||'all')===topics[i].id));
 });
}
// The DOM orbit must not redraw 23 WebGL models just to rotate its labels.
function wakeRail(){if(!railFrame&&!document.hidden&&view==='room')railFrame=requestAnimationFrame(animateRail);}
function animateRail(now){
 railFrame=0;if(view!=='room')return;
 const dt=Math.min(now-railTime||16,50);railTime=now;
 if(!railDrag)rail=reduced.matches?railTarget:mix(rail,railTarget,1-Math.exp(-dt/110));
 drawRail();if(!railDrag&&Math.abs(railTarget-rail)>.001)wakeRail();
}
railEl.addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary||view!=='room'||railDrag)return;railDrag={id:e.pointerId,x:e.clientX,start:rail,moved:false};railBlockClick=false;});
railEl.addEventListener('pointermove',e=>{
 if(!railDrag||railDrag.id!==e.pointerId)return;const dx=e.clientX-railDrag.x;
 if(Math.abs(dx)>7&&!railDrag.moved){railDrag.moved=true;railBlockClick=true;railEl.setPointerCapture(e.pointerId);}
 if(railDrag.moved){if(e.cancelable)e.preventDefault();rail=railDrag.start-dx/(innerWidth<700?100:190);railTarget=rail;drawRail();}
});
function releaseRail(e){
 if(!railDrag||e.pointerId!==railDrag.id)return;
 // Touch starts with implicit capture on the button. Its bubbling loss when
 // capture moves to the rail is a hand-off, not the end of the gesture.
 if(e.type==='lostpointercapture'&&e.target!==railEl)return;
 const moved=railDrag.moved;railDrag=null;if(moved)railTarget=Math.round(rail);
 if(railEl.hasPointerCapture(e.pointerId))railEl.releasePointerCapture(e.pointerId);wakeRail();
}
for(const event of ['pointerup','pointercancel','lostpointercapture'])railEl.addEventListener(event,releaseRail);
railEl.addEventListener('click',e=>{if(railBlockClick&&e.detail!==0){e.preventDefault();e.stopImmediatePropagation();railBlockClick=false;}},true);
railEl.addEventListener('wheel',e=>{if(Math.abs(e.deltaX)>Math.abs(e.deltaY)){e.preventDefault();railTarget+=e.deltaX/350;wakeRail();}},{passive:false});

function target(item){
 const mobile=innerWidth<700;
 if(detail){
  const peer=selectedEdge&&(selectedEdge.a===detail?selectedEdge.b:selectedEdge.a),inPair=peer&&(item.id===detail||item.id===peer);
  if(inPair)return{x:mobile?(item.id===detail?-2.35:2.35):(item.id===detail?-9.6:-3.7),y:mobile?5.9:1.5,z:0,rx:0,ry:0,rz:0,size:mobile?3:4.9,opacity:1};
  if(item.id===detail)return{x:mobile?0:-6.7,y:mobile?5.7:1,z:0,rx:0,ry:0,rz:0,size:mobile?5:7,opacity:1};
  return{...item.pose,opacity:0};
 }
 if(!active)return{...item.home,opacity:1};
 const group=RELATION_GROUPS.find(g=>g.id===active),ids=[group.focus,...group.nodes.filter(id=>id!==group.focus)],i=ids.indexOf(item.id);
 if(i<0)return{...item.home,opacity:0};
 if(mobile){const p=[[0,6.5],[-2.4,3.5],[2.4,3.5],[-2.4,.4],[2.4,.4],[-2.4,-2.7],[2.4,-2.7]][i];return{x:p[0],y:p[1],z:0,rx:0,ry:0,rz:0,size:i===0?2.5:2.1,opacity:1};}
 if(i===0)return{x:0,y:2.8,z:-1.5,rx:0,ry:0,rz:0,size:4.7,opacity:1};
 const angle=-Math.PI/2+(i-1)/(ids.length-1)*TAU;
 return{x:Math.cos(angle)*7.2,y:3+Math.sin(angle)*3,z:-1.8,rx:0,ry:0,rz:0,size:3.5,opacity:1};
}
function transition(kind='focus'){
 transitionKind=kind;transitionAt=performance.now();moving=!!renderer&&!reduced.matches;
 items.forEach(item=>{item.from={...item.pose};item.to=target(item);if(!moving)item.pose={...item.to};});
 room.dataset.group=active||'all';room.dataset.detail=detail||'';room.dataset.moving=String(moving);room.dataset.phase=moving?kind:'idle';
 renderFallback();wake();
}
function select(id){
 const was=active;active=id;detail=null;selectedEdge=null;tab='role';look={x:0,y:0};pointer={x:0,y:0};pan={x:0,y:0};
 document.body.classList.remove('has-detail','detail-ready','has-pair');$('#room-detail').hidden=true;railEl.inert=false;
 title.textContent=RELATION_GROUPS.find(g=>g.id===id)?.title||'관계지도';
 $('#room-status').textContent=id?`${title.textContent} 관련 하드웨어 ${RELATION_GROUPS.find(g=>g.id===id).nodes.length}개`:'모든 하드웨어 23개';
 writeRoute(id?'#group/'+id:'#all');drawRail();transition(id?'gather':was?'restore':'focus');
}
function openDetail(id){
 if(!detail)detailOrigin=id;detail=id;selectedEdge=null;tab='role';partIndex=0;peerPage=0;
 document.body.classList.add('has-detail');document.body.classList.remove('detail-ready','has-pair');$('#room-detail').hidden=false;railEl.inert=true;
 pointer={x:0,y:0};look={x:0,y:0};pan={x:0,y:0};renderDetail();transition();writeDetailURL();$('#room-close').focus({preventScroll:true});
}
function writeDetailURL(){const p=new URLSearchParams();if(active)p.set('from',active);if(tab!=='role')p.set('tab',tab);if(selectedEdge)p.set('edge',selectedEdge.id);writeRoute('#node/'+detail+(p.size?'?'+p:''));}
function closeDetail(){restoreFocus=detailOrigin;select(active);}
$('#room-close').onclick=closeDetail;
function chooseEdge(edge){
 selectedEdge=edge;document.body.classList.add('has-pair');document.body.classList.remove('detail-ready');document.body.dataset.relationKind=edge.kind;
 renderDetail();transition('pair');writeDetailURL();$('#room-detail article').scrollTop=0;
}
function renderDetail(){
 const n=nodes.get(detail);$('#detail-title').textContent=n.name;room.dataset.tab=tab;room.dataset.edge=selectedEdge?.id||'';
 $('#detail-tabs').innerHTML=[['role','역할'],['parts','내부 구성'],['relations','연결 관계']].map(([id,label])=>`<button data-tab="${id}" aria-pressed="${id===tab}">${label}</button>`).join('');
 $('#detail-tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{
  tab=b.dataset.tab;selectedEdge=null;document.body.classList.remove('has-pair');renderDetail();transition();writeDetailURL();$('#detail-tabs [data-tab="'+tab+'"]').focus({preventScroll:true});$('#room-detail article').scrollTop=0;
 });
 const copy=$('#detail-copy');
 if(tab==='role')copy.innerHTML=`<h3>${esc(n.summary)}</h3><details><summary>역할 자세히</summary><p>${esc(n.detail)}</p></details>`;
 else if(tab==='parts'){
  const page=Math.floor(partIndex/4),part=n.parts[partIndex],visible=n.parts.slice(page*4,page*4+4);
  copy.innerHTML=`<div class="parts-select" role="group" aria-label="내부 구성 선택">${visible.map((p,i)=>`<button data-part="${page*4+i}" aria-pressed="${page*4+i===partIndex}">${esc(p.name)}</button>`).join('')}</div><div class="parts-description"><h3>${esc(part.name)}</h3><p>${esc(part.role)}</p></div><div class="parts-pages"><button data-part-page="${Math.max(0,(page-1)*4)}" ${page===0?'disabled':''} aria-label="이전 구성">←</button><span>${partIndex+1} / ${n.parts.length}</span><button data-part-page="${Math.min(n.parts.length-1,(page+1)*4)}" ${(page+1)*4>=n.parts.length?'disabled':''} aria-label="다음 구성">→</button></div><select aria-label="모든 내부 구성 선택">${n.parts.map((p,i)=>`<option value="${i}" ${i===partIndex?'selected':''}>${esc(p.name)}</option>`).join('')}</select>`;
  copy.querySelectorAll('[data-part],[data-part-page]').forEach(b=>b.onclick=()=>{partIndex=Number(b.dataset.part??b.dataset.partPage);renderDetail();copy.querySelector('[data-part="'+partIndex+'"]').focus({preventScroll:true});});
  copy.querySelector('select').onchange=e=>{partIndex=Number(e.target.value);renderDetail();copy.querySelector('select').focus({preventScroll:true});};
 }else{
  const all=RELATION_SOURCE.edges.filter(e=>e.a===detail||e.b===detail),visible=all.slice(peerPage*6,peerPage*6+6);
  let description='';
  if(selectedEdge){const e=selectedEdge,forward=e.a===detail,peer=nodes.get(forward?e.b:e.a);
   description=`<div class="relation-pair-copy"><h3>${esc(n.name)} ↔ ${esc(peer.name)}</h3><span>${RELATION_KINDS[e.kind]}</span><dl><dt>${esc(n.name)}의 관점</dt><dd>${esc(forward?e.ab:e.ba)}</dd><dt>${esc(peer.name)}의 관점</dt><dd>${esc(forward?e.ba:e.ab)}</dd></dl><p class="relation-scope">${scope[e.kind]}</p><button class="relation-reset">다른 연결 보기 ←</button></div>`;
  }
  copy.innerHTML=description||`${visible.map(e=>{const id=e.a===detail?e.b:e.a;return `<button class="detail-peer" data-edge="${e.id}" data-peer="${id}">${esc(nodes.get(id).name)}<span>${RELATION_KINDS[e.kind]}</span></button>`;}).join('')}<div class="peer-pages"><button data-peer-page="${peerPage-1}" ${peerPage===0?'disabled':''}>← 이전</button><span>${peerPage+1} / ${Math.ceil(all.length/6)}</span><button data-peer-page="${peerPage+1}" ${(peerPage+1)*6>=all.length?'disabled':''}>다음 →</button></div>`;
  copy.querySelectorAll('[data-edge]').forEach(b=>b.onclick=()=>chooseEdge(all.find(e=>e.id===b.dataset.edge)));
  copy.querySelectorAll('[data-peer-page]').forEach(b=>b.onclick=()=>{peerPage=Number(b.dataset.peerPage);renderDetail();copy.querySelector('.detail-peer')?.focus({preventScroll:true});});
  copy.querySelector('.relation-reset')?.addEventListener('click',()=>{selectedEdge=null;document.body.classList.remove('has-pair');renderDetail();transition();writeDetailURL();copy.querySelector('.detail-peer')?.focus({preventScroll:true});});
 }
 renderFallback();
}

function mapEntryPose(item,rect){
 const unit=20/innerHeight,w=Math.min(rect.width,rect.height*4/3),h=Math.min(rect.height,rect.width*3/4),scale=Math.min(w*unit/item.size.x,h*unit/item.size.y)*.78;
 return{x:-46+(rect.x+rect.width/2-innerWidth/2)*unit,y:(innerHeight/2-rect.y-rect.height/2)*unit,z:0,rx:0,ry:0,rz:0,size:scale*item.extent,opacity:1};
}
async function enterRoom(){
 const token=++entryToken;if(view!=='wiki')return;
 const changed=$('#wiki-hardware').hidden;showTab('hardware');wiki.setAttribute('aria-busy','true');
 // Always paint the hardware list first; never replace it with an intermediate page.
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 if(changed&&!reduced.matches)await new Promise(resolve=>setTimeout(resolve,220));
 await stageReady;if(token!==entryToken||view!=='wiki')return;wiki.removeAttribute('aria-busy');
 wikiScroll=scrollY;active=null;detail=null;selectedEdge=null;rail=railTarget=0;pointer={x:0,y:0};look={x:0,y:0};pan={x:0,y:0};
 items.forEach(item=>{const rect=$(`#wiki-hardware img[data-id="${item.id}"]`).closest('figure').getBoundingClientRect();item.pose=mapEntryPose(item,rect);item.from={...item.pose};item.to={...item.home,opacity:1};});
 room.hidden=false;title.textContent='관계지도';room.dataset.group='all';room.dataset.detail='';
 if(!renderer||reduced.matches){view='room';items.forEach(i=>i.pose={...i.to});completeEntry();renderFallback();wake();return;}
 view='entering';railEl.inert=true;$('.room-exit').disabled=true;document.body.dataset.mode='entering-room';wiki.inert=true;transitionKind='entry';transitionAt=performance.now();moving=true;room.dataset.moving='true';room.dataset.phase='entry';drawRail();wake();
}
function completeEntry(){
 view='room';moving=false;transitionKind='idle';railEl.inert=false;$('.room-exit').disabled=false;wiki.hidden=true;wiki.inert=false;wiki.style.removeProperty('transform');wiki.style.removeProperty('opacity');document.body.dataset.mode='room';
 // Commit both the rendered pose and its hit targets before announcing that
 // entry is complete; the orbit no longer supplies spare WebGL frames.
 if(renderer){cameraX=0;roomScene.children.filter(m=>m.userData.wall).forEach(m=>m.material.opacity=1);camera.position.set(0,.65,innerWidth<700?16:14);camera.fov=innerWidth<700?72:70;camera.lookAt(0,.65,-12);camera.updateProjectionMatrix();camera.updateMatrixWorld();items.forEach(i=>updateModel(i,0));drawScene();}
 room.dataset.moving='false';room.dataset.phase='idle';writeRoute('#all');buttons[0].focus({preventScroll:true});
 wakeRail();
}
function exitRoom(){
 if(view==='exiting')return;++entryToken;
 if(view==='wiki'||!renderer||reduced.matches){completeExit();return;}
 // Capture the displayed frame, including a panned camera or half-completed
 // filter. Returning never resets the models to their wall positions first.
 exitCamera={position:camera.position.clone(),rotation:camera.quaternion.clone(),span:2*camera.position.z*Math.tan(T.MathUtils.degToRad(camera.fov/2)),walls:roomScene.children.find(m=>m.userData.wall).material.opacity,wikiX:view==='entering'?new DOMMatrix(getComputedStyle(wiki).transform).m41:innerWidth*.68,wikiOpacity:view==='entering'?Number(wiki.style.opacity||1):0};
 view='exiting';moving=true;transitionKind='exit';transitionAt=performance.now();restoreFocus=null;railDrag=null;roomDrag=null;
 railEl.inert=true;$('.room-exit').disabled=true;$('#room-detail').hidden=true;
 document.body.classList.remove('has-detail','has-pair','detail-ready');document.body.dataset.mode='exiting-room';
 wiki.hidden=false;wiki.inert=true;wiki.removeAttribute('aria-busy');showTab('hardware');wiki.style.removeProperty('transform');wiki.style.opacity='0';scrollTo({top:wikiScroll,behavior:'instant'});
 items.forEach(item=>{
  item.from={...item.pose,x:item.group.position.x,y:item.group.position.y,z:item.group.position.z};item.lift=item.hover=0;
  item.to=mapEntryPose(item,$(`#wiki-hardware img[data-id="${item.id}"]`).closest('figure').getBoundingClientRect());
 });
 room.dataset.moving='true';room.dataset.phase='exit';wake();
}
function completeExit(){
 view='wiki';moving=false;transitionKind='idle';exitCamera=null;cancelAnimationFrame(frame);cancelAnimationFrame(railFrame);frame=railFrame=0;detail=null;selectedEdge=null;active=null;restoreFocus=null;railDrag=null;roomDrag=null;
 room.hidden=true;room.dataset.moving='false';room.dataset.phase='idle';railEl.inert=false;$('.room-exit').disabled=false;wiki.hidden=false;wiki.inert=false;wiki.removeAttribute('aria-busy');wiki.style.removeProperty('transform');wiki.style.removeProperty('opacity');wiki.style.removeProperty('--wiki-portraits');$('#room-world').style.removeProperty('opacity');$('.room-vignette').style.removeProperty('opacity');$('#room-detail').hidden=true;
 document.body.classList.remove('has-detail','has-pair','detail-ready');document.body.dataset.mode='wiki';showTab('hardware');history.replaceState(null,'','#wiki');scrollTo({top:wikiScroll,behavior:'instant'});$('[data-wiki-tab=map]').focus({preventScroll:true});tellHost('return');
}
$('.room-exit').onclick=exitRoom;
addEventListener('keydown',e=>{
 if(view==='exiting'){if(e.key==='Escape'||e.key==='Tab'){e.preventDefault();completeExit();}return;}
 if(view==='entering'&&e.key==='Tab'){items.forEach(i=>i.pose={...i.to});completeEntry();wake();return;}
 if(e.key==='Escape'){if(detail)closeDetail();else if(view==='entering'||view==='room'&&!active)exitRoom();else if(active){railTarget=rail+wrap(-rail,topics.length);select(null);}}
});

function wake(){wakeRail();if(!frame&&!document.hidden&&view!=='wiki')frame=requestAnimationFrame(tick);}
function tick(now){
 frame=0;const dt=Math.min(now-lastTime||16,50);lastTime=now;
 if(reduced.matches){look={x:pointer.x,y:pointer.y};}else{look.x+=(pointer.x-look.x)*(1-Math.exp(-dt/220));look.y+=(pointer.y-look.y)*(1-Math.exp(-dt/220));}
 const duration=transitionKind==='exit'?2300:transitionKind==='entry'?2200:transitionKind==='gather'?1450:transitionKind==='restore'?1550:850;
 const t=reduced.matches?1:clamp((now-transitionAt)/duration);
 if(renderer){
  if(moving)items.forEach(item=>{
   let move=ease(t),fade=move;
   if(transitionKind==='gather'){
    move=range(t,.29,1);fade=item.to.opacity<item.from.opacity?range(t,0,.27):range(t,.25,.53);
   }else if(transitionKind==='restore'){
    move=range(t,0,.7);fade=item.from.opacity<.01?range(t,.72,1):1;
   }else if(transitionKind==='entry'){move=range(t,0,.94);fade=1;}
   else if(transitionKind==='exit'){move=range(t,.03+(item.index%4)*.015,.88);fade=range(t,.12,.52);}
   for(const key of poseKeys)item.pose[key]=mix(item.from[key],item.to[key],move);
   item.pose.opacity=mix(item.from.opacity,item.to.opacity,fade);
  });
  if(view==='entering'){
   const travel=range(t,.13,1),z=innerWidth<700?16:14,span=2*z*Math.tan(T.MathUtils.degToRad(innerWidth<700?36:35));cameraX=mix(-46,0,travel);camera.position.set(cameraX,mix(0,.65,travel),mix(100,z,travel));
   camera.fov=T.MathUtils.radToDeg(2*Math.atan(mix(20,span,travel)/2/camera.position.z));camera.lookAt(cameraX,mix(0,.65,travel),-12);camera.updateProjectionMatrix();
   wiki.style.transform=`translate3d(${range(t,0,.68)*innerWidth*.68}px,0,0)`;wiki.style.opacity=String(1-range(t,.12,.55));
   roomScene.children.filter(m=>m.userData.wall).forEach(m=>m.material.opacity=range(t,.27,.68));
  }else if(view==='exiting'){
   const travel=range(t,0,.85),finish=range(t,.9,1);
   camera.position.copy(exitCamera.position).lerp(new T.Vector3(-46,0,100),travel);camera.quaternion.copy(exitCamera.rotation).slerp(new T.Quaternion(),travel);cameraX=camera.position.x;
   camera.fov=T.MathUtils.radToDeg(2*Math.atan(mix(exitCamera.span,20,travel)/2/camera.position.z));camera.updateProjectionMatrix();
   wiki.style.transform=`translate3d(${mix(exitCamera.wikiX,0,range(t,.18,.82))}px,0,0)`;wiki.style.opacity=String(mix(exitCamera.wikiOpacity,1,range(t,.38,.85)));wiki.style.setProperty('--wiki-portraits',String(finish));
   $('#room-world').style.opacity=String(1-finish);$('.room-vignette').style.opacity=String(1-range(t,0,.45));
   roomScene.children.filter(m=>m.userData.wall).forEach(m=>m.material.opacity=exitCamera.walls*(1-range(t,.08,.58)));
  }else{
   cameraX=0;camera.position.set(0,.65,innerWidth<700?16:14);camera.fov=innerWidth<700?72:70;camera.updateProjectionMatrix();camera.lookAt(0,.65,-12);
   if(!active&&!detail){camera.rotateY(pan.x-look.x*.1);camera.rotateX(pan.y+look.y*.065);}
   roomScene.children.filter(m=>m.userData.wall).forEach(m=>m.material.opacity=1);
  }
  camera.updateMatrixWorld();
  for(const item of items)updateModel(item,dt);
  drawScene();updatePair();
 }
 if(moving&&t>=1){moving=false;if(view==='entering')completeEntry();else if(view==='exiting'){completeExit();return;}}
 if(detail&&!moving)document.body.classList.add('detail-ready');
 if(restoreFocus&&!moving){const b=items.find(i=>i.id===restoreFocus)?.button||$('.room-fallback [data-id="'+restoreFocus+'"]');b?.focus({preventScroll:true});restoreFocus=null;}
 room.dataset.moving=String(moving);room.dataset.phase=!moving?'idle':transitionKind==='gather'?(t<.29?'fade-others':'gather'):transitionKind==='restore'?(t<.72?'return-home':'reveal-others'):transitionKind;
 if(moving||Math.abs(pointer.x-look.x)+Math.abs(pointer.y-look.y)>.001||items.some(i=>Math.abs(i.lift-i.hover)>.002))wake();
}
const quaternion=new T.Quaternion(),euler=new T.Euler(),point=new T.Vector3();
function projectBounds(item){
 const min={x:Infinity,y:Infinity},max={x:-Infinity,y:-Infinity};
 for(const p of item.corners){point.copy(p).applyMatrix4(item.group.matrixWorld).project(camera);min.x=Math.min(min.x,point.x);min.y=Math.min(min.y,point.y);max.x=Math.max(max.x,point.x);max.y=Math.max(max.y,point.y);}
 return{x:(min.x+1)*innerWidth/2,y:(1-max.y)*innerHeight/2,width:(max.x-min.x)*innerWidth/2,height:(max.y-min.y)*innerHeight/2};
}
function updateModel(item,dt){
 const p=item.pose;item.hover=Number(item.button.matches(':hover,:focus-visible')&&!moving&&!detail&&!travelling());item.lift=reduced.matches?0:mix(item.lift,item.hover,1-Math.exp(-dt/100));
 item.group.position.set(p.x,p.y,p.z);item.group.scale.setScalar(p.size/item.extent);
 quaternion.setFromEuler(euler.set(p.rx,p.ry,p.rz));item.group.quaternion.copy(quaternion).multiply(item.rotation);
 point.set(0,0,item.lift*.18).applyQuaternion(quaternion);item.group.position.add(point);item.group.updateMatrixWorld(true);
 const r=projectBounds(item);item.bounds=r;
 const center=item.group.position.clone().project(camera),offscreen=center.z>1||center.z< -1||r.x+r.width<0||r.x>innerWidth||r.y+r.height<0||r.y>innerHeight;
 item.button.disabled=!!detail||travelling()||p.opacity<.96;item.button.style.pointerEvents=item.button.disabled?'none':'auto';item.button.style.opacity=String(detail||offscreen||travelling()?0:p.opacity);
 item.button.style.width=Math.max(36,r.width)+'px';item.button.style.height=Math.max(36,r.height)+'px';item.button.style.transform=`translate(${r.x}px,${r.y}px)`;
 const shadow=item.shadow;shadow.material.opacity=travelling()?0:!active&&!detail?Math.max(0,.1*p.opacity*(1-Math.min(1,Math.hypot(p.x-item.home.x,p.y-item.home.y,p.z-item.home.z)))):0;
}
function updatePair(){
 if(!selectedEdge||!detail)return;
 const peer=selectedEdge.a===detail?selectedEdge.b:selectedEdge.a,a=items.find(i=>i.id===detail)?.bounds,b=items.find(i=>i.id===peer)?.bounds;if(!a||!b)return;
 const ax=a.x+a.width/2,bx=b.x+b.width/2,ay=a.y+a.height+24,by=b.y+b.height+24,y=Math.max(ay,by)+24;
 const d=`M${ax} ${ay} L${ax} ${y-12} Q${ax} ${y} ${ax+12} ${y} H${bx-12} Q${bx} ${y} ${bx} ${y-12} L${bx} ${by}`;
 $('#room-connection').querySelectorAll('path').forEach(el=>el.setAttribute('d',d));
 for(const [el,x,yy] of [[$('.connection-end.first'),ax,ay],[$('.connection-end.second'),bx,by]]){el.setAttribute('cx',x);el.setAttribute('cy',yy);}
 $('#pair-labels').querySelectorAll('span').forEach((el,i)=>{el.textContent=nodes.get(i?peer:detail).name;el.style.left=(i?bx:ax)+'px';el.style.top=(i?b.y+b.height:a.y+a.height)+6+'px';});
}
function drawScene(){
 renderer.setRenderTarget(null);renderer.setClearColor(0xf8f8f5,travelling()?0:1);renderer.render(roomScene,camera);renderer.autoClear=false;
 const fades=new Map();for(const item of items){if(item.pose.opacity<=.003||item.pose.opacity>=.997)continue;const key=item.pose.opacity.toFixed(5);if(!fades.has(key))fades.set(key,[]);fades.get(key).push(item);}
 items.forEach(i=>i.group.visible=i.pose.opacity>=.997);renderer.render(scene,camera);
 for(const batch of fades.values()){const visible=new Set(batch);items.forEach(i=>i.group.visible=visible.has(i));renderer.setRenderTarget(modelLayer);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,camera);renderer.setRenderTarget(null);quad.material.opacity=batch[0].pose.opacity;renderer.render(compositeScene,compositeCamera);}
 renderer.autoClear=true;
}
function resize(){
 drawRail();if(!renderer)return;renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();const s=renderer.getDrawingBufferSize(new T.Vector2());modelLayer.setSize(s.x,s.y);
 if(view==='entering'){items.forEach(i=>i.pose={...i.home,opacity:1});completeEntry();}
 if(view==='exiting')completeExit();
 if(view==='room')transition();
}
function renderFallback(){
 if(renderer||view==='wiki')return;
 $('#room-hardware').hidden=true;$('#room-world').hidden=true;if(detail)document.body.classList.add('detail-ready');
 let el=$('.room-fallback');if(!el){el=document.createElement('div');el.className='room-fallback';room.append(el);}
 const ids=active?RELATION_GROUPS.find(g=>g.id===active).nodes:HARDWARE.map(x=>x.id);
 el.innerHTML=ids.map(id=>`<button data-id="${id}"><img src="${asset(id)}" alt="">${esc(nodes.get(id).name)}</button>`).join('');el.querySelectorAll('button').forEach(b=>b.onclick=()=>openDetail(b.dataset.id));el.hidden=!!detail;
 $('.fallback-detail')?.remove();if(detail){const peer=selectedEdge&&(selectedEdge.a===detail?selectedEdge.b:selectedEdge.a),pair=document.createElement('div');pair.className='fallback-detail'+(peer?' pair':'');pair.innerHTML=[detail,...(peer?[peer]:[])].map(id=>`<figure><img src="${asset(id)}" alt="${esc(nodes.get(id).name)}"><figcaption>${esc(nodes.get(id).name)}</figcaption></figure>`).join('');$('#room-detail').append(pair);}
}

function shadowTexture(){
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'#233022aa');g.addColorStop(.4,'#23302245');g.addColorStop(1,'#23302200');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new T.CanvasTexture(c);
}
function createWalls(){
 roomScene=new T.Scene();
 const wall=(w,h,pos,rot,color)=>{const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color,side:T.DoubleSide,toneMapped:false,transparent:true}));m.position.set(...pos);m.rotation.set(...rot);m.userData.wall=true;roomScene.add(m);};
 wall(34,20,[0,0,-12.8],[0,0,0],0xf7f7f4);wall(27,20,[-17,0,.7],[0,Math.PI/2,0],0xf2f3ed);wall(27,20,[17,0,.7],[0,-Math.PI/2,0],0xfafaf7);wall(34,27,[0,10,.7],[Math.PI/2,0,0],0xfafaf7);wall(34,27,[0,-9.8,.7],[-Math.PI/2,0,0],0xf4f5ef);
}
async function start(){
 drawRail();if(new URLSearchParams(location.search).get('quality')==='still'){room.dataset.ready='fallback';renderFallback();return;}try{
  renderer=new T.WebGLRenderer({canvas:$('#room-world'),alpha:true,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  const studio=new T.Scene();studio.background=new T.Color(0x17191c);
  for(const [w,h,pos,intensity,color] of [[9,12,[-8,9,5],5.5,0xf2f1ef],[2,14,[8,4,0],5,0xc9daf5],[12,3,[0,8,-8],6.5,0xffffff],[6,5,[-1,-7,6],1.4,0xffffff],[3,9,[2,1,10],1.9,0xffffff]]){const p=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(intensity),side:T.DoubleSide}));p.position.set(...pos);p.lookAt(0,0,0);studio.add(p);}
  const pmrem=new T.PMREMGenerator(renderer),env=pmrem.fromScene(studio,.045);pmrem.dispose();scene=portraitScene(env.texture);
  camera=new T.PerspectiveCamera(70,innerWidth/innerHeight,.1,500);camera.position.set(0,.65,14);createWalls();
  modelLayer=new T.WebGLRenderTarget(1,1);compositeScene=new T.Scene();compositeCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);quad=new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshBasicMaterial({map:modelLayer.texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));compositeScene.add(quad);
  const computer=createComputer(),texture=shadowTexture();
  for(const [index,mount] of mounts.entries()){
   const [id,x,y,z,rx,ry,rz,size,surface]=mount,home={x,y,z,rx,ry,rz,size};
   const root=id==='mainboard'?computer.board.root:computer.parts[id]?.model.root||createCollectionModel(id).root;
   const model=portraitModel(root,id,computer.rest[id]);batchStaticMeshes(model.group);const rotation=model.group.quaternion.clone();model.group.quaternion.identity();
   const bounds=new T.Box3().setFromObject(model.group),corners=[];for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])corners.push(new T.Vector3(x,y,z));model.group.quaternion.copy(rotation);scene.add(model.group);
   // Mount the whole object in front of its wall, including deep enclosures.
   // Using only the center would let the wall cut through fins, fans and PCBs.
   model.group.position.set(x,y,z);model.group.scale.setScalar(size/Math.max(model.size.x,model.size.y));model.group.quaternion.setFromEuler(new T.Euler(rx,ry,rz)).multiply(rotation);
   const mounted=new T.Box3().setFromObject(model.group);
   if(surface==='back')home.z+=Math.max(0,-12.6-mounted.min.z);
   if(surface==='left')home.x+=Math.max(0,-16.8-mounted.min.x);
   if(surface==='right')home.x-=Math.max(0,mounted.max.x-16.8);
   if(surface==='ceiling')home.y-=Math.max(0,mounted.max.y-9.8);
   if(surface==='floor')home.y+=Math.max(0,-9.6-mounted.min.y);
   const shadow=new T.Mesh(new T.PlaneGeometry(size*1.7,size*1.2),new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,opacity:.1,toneMapped:false}));
   shadow.rotation.set(surface==='floor'?-Math.PI/2:rx,surface==='floor'?0:ry,rz);shadow.position.set(home.x,home.y,home.z);
   if(surface==='back')shadow.position.z=-12.78;if(surface==='left')shadow.position.x=-16.98;if(surface==='right')shadow.position.x=16.98;if(surface==='ceiling')shadow.position.y=9.98;if(surface==='floor')shadow.position.y=-9.78;
   roomScene.add(shadow);
   const button=document.createElement('button');button.className='room-part';button.dataset.hardware=id;button.dataset.wall=surface;button.innerHTML=`<span>${esc(HARDWARE.find(x=>x.id===id).title)}</span>`;button.setAttribute('aria-label',nodes.get(id).name+' 설명');
   button.onclick=e=>{if((!blockClick||e.detail===0)&&view==='room')openDetail(id);};button.onpointerenter=button.onpointerleave=button.onblur=wake;button.onfocus=()=>{
    if(innerWidth<700&&!active&&!detail){const dx=x,dz=14-z;pan.x=clamp(-Math.atan2(dx,dz),-.85,.85);pan.y=clamp(Math.atan2(y-.65,Math.hypot(dx,dz)),-.35,.35);}wake();
   };$('#room-hardware').append(button);
   items.push({id,index,home,group:model.group,rotation,size:model.size,extent:Math.max(model.size.x,model.size.y),corners,shadow,pose:{...home,opacity:1},button,lift:0,hover:0});
   if(index%4===0)await new Promise(requestAnimationFrame);
  }
  resize();camera.lookAt(0,.65,-12);camera.updateMatrixWorld();items.forEach(i=>updateModel(i,16));
  // Warm the actual models while the list is still visible, so shader upload
  // cannot consume the first half of the camera transition.
  if(renderer.compileAsync)await renderer.compileAsync(scene,camera);
  drawScene();room.dataset.ready='true';$('#room-status').textContent='모든 하드웨어 23개';
 }catch(error){console.warn('Room preview uses image fallback',error);renderer?.dispose();renderer=null;room.dataset.ready='fallback';renderFallback();}
}
const stageReady=start();
async function initialRoute(){
 const hash=location.hash.slice(1);if(!hash||hash==='wiki'){showTab('hardware');return;}if(hash==='stories'){showTab('stories');return;}
 await stageReady;view='room';wiki.hidden=true;room.hidden=false;document.body.dataset.mode='room';
 const params=new URLSearchParams(hash.split('?')[1]),group=hash.startsWith('group/')?hash.split('/')[1].split('?')[0]:params.get('from');
 active=RELATION_GROUPS.some(g=>g.id===group)?group:null;rail=railTarget=topics.findIndex(g=>g.id===(active||'all'));title.textContent=topics[rail].title==='전체보기'?'관계지도':topics[rail].title;
 items.forEach(i=>i.pose=target(i));transition('focus');
 if(hash.startsWith('node/')){const id=hash.split('/')[1].split('?')[0];if(nodes.has(id)){openDetail(id);if(['parts','relations'].includes(params.get('tab'))){tab=params.get('tab');renderDetail();}const e=RELATION_SOURCE.edges.find(e=>e.id===params.get('edge')&&(e.a===id||e.b===id));if(e){tab='relations';chooseEdge(e);}}}
 renderFallback();wake();
}
if(embedded){
 addEventListener('message',async event=>{
  if(event.source!==parent||event.origin!==location.origin||event.data?.channel!=='inside-room-host')return;
  if(event.data.type==='open'){
   if(event.data.animate){showTab('hardware');scrollTo({top:Number(event.data.scroll)||0,behavior:'instant'});tellHost('visible');enterRoom();}
   else{await initialRoute();tellHost('visible');}
  }else if(event.data.type==='escape')dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
 });
 stageReady.then(()=>tellHost('ready'));
}else initialRoute();
addEventListener('resize',resize);reduced.addEventListener('change',()=>{if(view==='entering'){items.forEach(i=>i.pose={...i.to});completeEntry();}else if(view==='exiting')completeExit();else if(view==='room')transition();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);cancelAnimationFrame(railFrame);frame=railFrame=0;}else wake();});
$('#room-world').addEventListener('webglcontextlost',e=>{e.preventDefault();renderer=null;if(view==='entering')completeEntry();else if(view==='exiting')completeExit();moving=false;room.dataset.ready='fallback';room.dataset.moving='false';renderFallback();});
room.addEventListener('pointermove',e=>{
 if(e.target.closest('#room-rail,#room-detail,.room-exit')||view!=='room'||active||detail)return;
 if(roomDrag&&roomDrag.id===e.pointerId){const dx=e.clientX-roomDrag.x,dy=e.clientY-roomDrag.y;if(Math.hypot(dx,dy)>8){blockClick=true;if(!roomDrag.moved){roomDrag.moved=true;room.setPointerCapture(e.pointerId);}pan.x=clamp(roomDrag.panX-dx/innerWidth*1.2,-.85,.85);pan.y=clamp(roomDrag.panY-dy/innerHeight*.8,-.35,.35);wake();}}
 else if(e.pointerType==='mouse'&&!reduced.matches){pointer={x:(e.clientX/innerWidth-.5)*2,y:(e.clientY/innerHeight-.5)*2};wake();}
});
room.addEventListener('pointerleave',()=>{pointer={x:0,y:0};wake();});
room.addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary||view!=='room'||detail||e.target.closest('#room-rail,#room-detail,.room-exit'))return;blockClick=false;if(active||roomDrag)return;roomDrag={id:e.pointerId,x:e.clientX,y:e.clientY,panX:pan.x,panY:pan.y,moved:false};});
function releaseRoom(e){if(!roomDrag||e.pointerId!==roomDrag.id||e.type==='lostpointercapture'&&e.target!==room)return;roomDrag=null;if(room.hasPointerCapture(e.pointerId))room.releasePointerCapture(e.pointerId);}
room.addEventListener('pointerup',releaseRoom);room.addEventListener('pointercancel',releaseRoom);

room.addEventListener('lostpointercapture',releaseRoom);
room.addEventListener('click',e=>{if(blockClick&&e.detail!==0&&!e.target.closest('#room-rail,#room-detail,.room-exit')){e.preventDefault();e.stopImmediatePropagation();blockClick=false;}},true);
