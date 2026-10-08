import { RELATION_SOURCE } from 'inside/relation-source';
import { RELATION_GROUPS, RELATION_SCENARIOS, RELATION_KINDS } from 'inside/relation-scenarios';
import { RelationshipStage } from 'inside/relationship-stage';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nodes=new Map(RELATION_SOURCE.nodes.map(n=>[n.id,n]));
const edges=RELATION_SOURCE.edges;
const byId=new Map(edges.map(e=>[e.id,e]));
const related=id=>edges.filter(e=>e.a===id||e.b===id);
const other=(e,id)=>e.a===id?e.b:e.a;
const closeIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
const scope={data:'명령·데이터의 기능적 관계입니다 컨트롤러나 운영체제를 거칠 수 있으며 선은 실제 배선이나 속도를 뜻하지 않습니다',power:'전력을 공급하고 사용하는 관계입니다 양방향 데이터 전송을 뜻하지 않습니다',thermal:'열을 발생시키고 밖으로 옮기는 관계입니다',structure:'장착하거나 내부에 포함하는 구성 관계입니다',context:'함께 활용되거나 비교되는 관계입니다 직접 연결된 배선을 뜻하지 않습니다'};
const short=s=>s.split(/\s*[(（]/)[0].trim();
const architecture='<div class="rr-architecture" aria-hidden="true"><div class="rr-left-wall"></div><div class="rr-back-wall"></div><div class="rr-right-wall"></div><div class="rr-floor"></div></div>';

export class RelationshipMap {
 constructor(root,asset){
  this.root=root;this.asset=asset;this.stage=new RelationshipStage(root);this.selection=new Map();this.navigation=0;
  root.addEventListener('input',e=>{if(e.target.id==='relation-search')this.search(e.target.value);if(e.target.id==='rr-peer-search')this.filterPeers(e.target.value);});
  root.addEventListener('change',e=>{if(e.target.id==='relation-type')this.change({type:e.target.value,edge:'',page:0});});
  root.addEventListener('click',e=>{
   const model=e.target.closest('.rr-exhibit[data-node]');if(model&&this.view==='group')this.selection.set(this.group.id,model.dataset.node);
   const replay=e.target.closest('[data-replay]');if(replay){const path=root.querySelector('.rr-path');path?.classList.remove('playing');requestAnimationFrame(()=>requestAnimationFrame(()=>path?.classList.add('playing')));}
  });
 }
 model(id,cls=''){
  const n=nodes.get(id);return `<span class="rr-model ${cls}" data-model="${n.model||id}" aria-hidden="true"><img src="${this.asset(`redesign/${n.model||id}.webp`)}" alt="" decoding="async"></span>`;
 }
 picture(id){const n=nodes.get(id);return `<img src="${this.asset(`redesign/${n.model||id}.webp`)}" alt="" loading="lazy">`;}
 nodeURL(id,values={}){
  const p=new URLSearchParams(values);const from=this.view==='group'?this.group.id:this.view==='scenario'?`scenario/${this.scenario.id}/${this.step}`:this.params?.get('from');
  if(from&&!p.has('from'))p.set('from',from);return `#map/node/${id}${p.size?'?'+p:''}`;
 }
 backURL(){
  const from=this.params?.get('from');if(RELATION_GROUPS.some(g=>g.id===from))return '#map/group/'+from;
  if(/^scenario\/[a-z]+\/\d+$/.test(from||'')&&RELATION_SCENARIOS.some(s=>s.id===from.split('/')[1]))return '#map/'+from;
  return '#map';
 }
 escape(){location.hash=this.view==='node'?this.backURL():this.view==='overview'?'#wiki':'#map';}
 url(values){const p=new URLSearchParams(this.params);for(const [k,v]of Object.entries(values)){if(v===''||v===0||v==='all')p.delete(k);else p.set(k,String(v));}return '#'+this.path+(p.size?'?'+p:'');}
 change(values){location.hash=this.url(values);}
 enter(hash){
  const previous={view:this.view,focus:this.focus,tab:this.tab};
  const navigation=++this.navigation;
  this.stage.beginNavigation();
  this.path=hash.split('?')[0];this.params=new URLSearchParams(hash.split('?')[1]||'');
  const [,view,id,number]=this.path.split('/');this.view=view||'overview';this.group=RELATION_GROUPS.find(g=>g.id===id);this.scenario=RELATION_SCENARIOS.find(s=>s.id===id);
  // Preserve links to a selected edge from the previous group map.
  if(view==='group'&&this.group&&this.params.has('edge')){
   this.params.set('from',id);this.path='map/node/'+this.group.focus;this.view='node';history.replaceState(null,'','#'+this.path+'?'+this.params);this.focus=this.group.focus;
  }else this.focus=view==='node'&&nodes.has(id)?id:null;
  this.root.hidden=false;this.root.dataset.view=this.view;this.root.dataset.node=this.focus||'';
  if(this.view==='node'&&this.focus)this.renderNode();
  else if(this.view==='group'&&this.group)this.renderRoom();
  else if(this.view==='scenario'&&this.scenario){this.step=Math.max(0,Math.min(this.scenario.steps.length-1,parseInt(number)||0));this.renderScenario();}
  else {this.view='overview';this.root.dataset.view=this.view;this.renderOverview();}
  this.root.dataset.entering=String(previous.view!==this.view||previous.focus!==this.focus);
  const spatial=this.view!=='overview';document.body.classList.toggle('map-spatial',spatial);
  if(spatial)this.stage.enter();else this.stage.leave();
  document.title=`${this.title} — Computer Wiki`;
  requestAnimationFrame(()=>{
   if(this.root.hidden||navigation!==this.navigation)return;
   if(this.view==='group'&&this.selection.has(this.group.id)){this.root.querySelector(`[data-node="${this.selection.get(this.group.id)}"]`)?.focus({preventScroll:true});}
   else if(previous.focus===this.focus&&previous.view===this.view&&this.tab){this.root.querySelector(`[data-tab="${this.tab}"]`)?.focus({preventScroll:true});}
   else this.root.querySelector('#relation-title')?.focus({preventScroll:true});
   this.stage.requestLayout();
  });
  return previous.view==='node'&&this.view==='node'&&previous.focus===this.focus;
 }
 leave(){this.root.hidden=true;this.stage.leave();document.body.classList.remove('map-spatial');}
 search(value){
  const slot=this.root.querySelector('#relation-results'),q=value.trim().normalize('NFKC').toLocaleLowerCase();if(!slot)return;slot.hidden=!q;
  const found=[...nodes.values()].filter(n=>[n.id,n.name,n.category,n.summary].join(' ').normalize('NFKC').toLocaleLowerCase().includes(q));
  slot.innerHTML=q?(found.length?found.map(n=>`<a href="${this.nodeURL(n.id)}">${esc(n.name)}</a>`).join(''):'<p>일치하는 부품이 없습니다</p>'):'';
 }
 renderOverview(){
  this.title='관계지도';this.focus=null;this.tab=null;
  this.root.innerHTML=`<div class="relation-top"><a href="#wiki">← Computer Wiki</a></div><div class="relation-heading"><h1 id="relation-title" tabindex="-1">관계지도</h1><div class="relation-search"><label class="sr-only" for="relation-search">부품 찾기</label><input id="relation-search" type="search" placeholder="부품 찾기" autocomplete="off" aria-controls="relation-results"><div id="relation-results" hidden></div></div></div><div class="relation-overview">${RELATION_GROUPS.map(g=>`<a class="relation-island" href="#map/group/${g.id}"><div class="relation-island-models">${[g.nodes[1],g.focus,g.nodes[2]].map((id,i)=>`<span class="island-model island-model-${i}">${this.picture(id)}</span>`).join('')}</div><h2>${g.title}</h2></a>`).join('')}</div>`;
 }
 renderRoom(){
  this.title=this.group.title;this.tab=null;const ids=[this.group.focus,...this.group.nodes.filter(id=>id!==this.group.focus)];
  this.root.innerHTML=`<section class="rr-room rr-count-${ids.length}" aria-labelledby="relation-title">${architecture}<a class="rr-close" href="#map" aria-label="전체 관계지도로 나가기">${closeIcon}</a>${ids.map((id,i)=>`<a class="rr-exhibit rr-slot-${i}" data-node="${id}" href="${this.nodeURL(id)}">${this.model(id)}<span>${esc(nodes.get(id).name)}</span></a>`).join('')}<h1 id="relation-title" tabindex="-1">${this.title}</h1></section>`;
 }
 renderNode(){
  const n=nodes.get(this.focus),edge=byId.get(this.params.get('edge'));this.selected=edge&&(edge.a===n.id||edge.b===n.id)?edge:null;
  this.tab=this.selected?'relations':['role','parts','relations'].includes(this.params.get('tab'))?this.params.get('tab'):this.params.has('type')||this.params.has('page')?'relations':'role';
  this.title=n.name;
  this.root.dataset.tab=this.tab;
  let left=this.model(n.id,'rr-hero-model'),content='';
  if(this.tab==='role')content=`<h2>${esc(n.summary)}</h2><details class="rr-role-more"><summary>역할 자세히</summary><p>${esc(n.detail)}</p></details><a class="rr-object-link" href="#object/${n.model||n.id}">3D로 자세히 보기 ↗</a>`;
  else if(this.tab==='parts'){
   const index=Math.max(0,Math.min(n.parts.length-1,parseInt(this.params.get('part'))||0)),part=n.parts[index],page=Math.floor(index/6),visible=n.parts.slice(page*6,page*6+6);
   left=`<div class="rr-parts-visual" role="group" aria-label="${esc(n.name)} 구성 요소 개념도">${visible.map((p,i)=>`<a class="rr-part-tile ${index===page*6+i?'selected':''}" href="${this.url({part:page*6+i})}" ${index===page*6+i?'aria-current="true"':''}><span>${String(page*6+i+1).padStart(2,'0')}</span>${esc(short(p.name))}</a>`).join('')}</div>`;
   content=`<h2>${esc(part.name)}</h2><p>${esc(part.role)}</p><p class="rr-scope">기능을 설명하는 구성 요소 개념도입니다 실제 배치와 포함 범위는 제품마다 다릅니다</p><div class="rr-part-controls">${page>0?`<a href="${this.url({part:(page-1)*6})}">← 이전 구성</a>`:''}<span>${index+1} / ${n.parts.length}</span>${(page+1)*6<n.parts.length?`<a href="${this.url({part:(page+1)*6})}">다음 구성 →</a>`:''}</div><label class="sr-only" for="rr-part-select">모든 내부 구성</label><select id="rr-part-select">${n.parts.map((p,i)=>`<option value="${i}" ${i===index?'selected':''}>${esc(p.name)}</option>`).join('')}</select>`;
  }else{
   const peer=this.selected&&nodes.get(other(this.selected,n.id));
   if(peer)left=`<div class="rr-pair rr-kind-${this.selected.kind}"><a class="rr-pair-first" href="${this.nodeURL(n.id)}">${this.model(n.id)}<span>${esc(n.name)}</span></a><a class="rr-pair-second" href="${this.nodeURL(peer.id)}">${this.model(peer.id)}<span>${esc(peer.name)}</span></a>${this.pathVisual(this.selected.kind)}</div>`;
   content=this.relations(n);
  }
  this.root.innerHTML=`<div class="rr-detail"><a class="rr-close" href="${this.backURL()}" aria-label="관계 공간으로 돌아가기">${closeIcon}</a><div class="rr-visual">${left}</div><article class="rr-copy"><h1 id="relation-title" tabindex="-1">${esc(n.name)}</h1><nav class="rr-tabs" aria-label="부품 설명">${[['role','역할'],['parts','내부 구성'],['relations','연결 관계']].map(([tab,label])=>`<a href="${this.url({tab,edge:'',part:'',page:0})}" data-tab="${tab}" ${tab===this.tab?'aria-current="page"':''}>${label}</a>`).join('')}</nav><section class="rr-content">${content}</section></article></div>`;
  this.root.querySelector('#rr-part-select')?.addEventListener('change',e=>this.change({part:e.target.value}));
  if(this.tab==='relations'){
   const page=Math.max(0,parseInt(this.params.get('page'))||0);if(page)this.root.querySelectorAll('.rr-peer-list a')[page*6]?.scrollIntoView({block:'nearest'});
  }
 }
 pathVisual(kind){
  // Deliberately no directional arrows: supplied edges describe functions, not
  // a verified protocol trace. Only data relationships have a brief signal.
  return `<svg class="rr-path playing" viewBox="0 0 600 430" preserveAspectRatio="none" aria-hidden="true"><path class="rr-route" d="M155 285V398Q155 410 167 410H443Q455 410 455 398V380"/>${kind==='data'?'<path class="rr-signal" d="M155 285V398Q155 410 167 410H443Q455 410 455 398V380"/>':''}${kind==='thermal'?'<ellipse class="rr-heat" cx="300" cy="395" rx="145" ry="25"/>':''}</svg>`;
 }
 relations(n){
  const all=related(n.id),type=Object.hasOwn(RELATION_KINDS,this.params.get('type'))?this.params.get('type'):'all',list=all.filter(e=>type==='all'||e.kind===type),e=this.selected;
  let description='';
  if(e){const peer=nodes.get(other(e,n.id)),forward=e.a===n.id;
   description=`<div class="relation-edge-copy"><h2>${esc(n.name)} ↔ ${esc(peer.name)}</h2><span class="rr-kind-label">${RELATION_KINDS[e.kind]}</span><dl><dt>${esc(n.name)}의 관점</dt><dd>${esc(forward?e.ab:e.ba)}</dd><dt>${esc(peer.name)}의 관점</dt><dd>${esc(forward?e.ba:e.ab)}</dd></dl><p class="rr-scope">${scope[e.kind]}</p>${e.kind==='data'?'<button class="rr-replay" data-replay>흐름 다시 보기 ↺</button>':''}<a class="rr-object-link" href="${this.nodeURL(peer.id)}">${esc(peer.name)} 살펴보기 ↗</a></div>`;
  }
  return `${description}<div class="rr-relation-picker"><div class="rr-picker-head"><label for="relation-type" class="sr-only">관계 유형</label><select id="relation-type"><option value="all">모든 관계 (${all.length})</option>${Object.entries(RELATION_KINDS).map(([k,v])=>`<option value="${k}" ${k===type?'selected':''}>${v} (${all.filter(e=>e.kind===k).length})</option>`).join('')}</select><label for="rr-peer-search" class="sr-only">연결된 부품 찾기</label><input id="rr-peer-search" type="search" placeholder="연결된 부품 찾기" autocomplete="off"></div><div class="rr-peer-list">${list.map(edge=>{const peer=nodes.get(other(edge,n.id));return `<a href="${this.url({edge:edge.id,page:0})}" data-peer="${peer.id} ${esc(peer.name)}" ${edge===e?'aria-current="true"':''}><span>${esc(peer.name)}</span><span>${RELATION_KINDS[edge.kind]}</span></a>`;}).join('')}</div><p id="rr-no-peers" ${list.length?'hidden':''}>이 유형의 관계가 없습니다</p></div>`;
 }
 filterPeers(value){let count=0;const q=value.trim().toLocaleLowerCase();for(const el of this.root.querySelectorAll('[data-peer]')){el.hidden=!el.dataset.peer.toLocaleLowerCase().includes(q);if(!el.hidden)count++;}const empty=this.root.querySelector('#rr-no-peers');if(empty){empty.hidden=!!count;empty.textContent='일치하는 부품이 없습니다';}}
 renderScenario(){
  const stage=this.scenario.steps[this.step];this.focus=stage.focus;this.tab='scenario';this.title=this.scenario.title;this.root.dataset.node=this.focus;this.root.dataset.tab='scenario';
  this.root.innerHTML=`<div class="rr-detail rr-scenario"><a class="rr-close" href="#stories" aria-label="시나리오 목록으로 나가기">${closeIcon}</a><div class="rr-visual">${this.model(stage.focus,'rr-hero-model')}</div><article class="rr-copy"><h1 id="relation-title" tabindex="-1">${esc(this.scenario.title)}</h1><nav class="relation-steps" aria-label="시나리오 단계">${this.scenario.steps.map((s,i)=>`<a href="#map/scenario/${this.scenario.id}/${i}" ${i===this.step?'aria-current="step"':''} aria-label="${esc(s.title)}">${String(i+1).padStart(2,'0')}</a>`).join('')}</nav><section class="rr-content"><h2>${esc(stage.title)}</h2><p>${esc(stage.copy)}</p><div class="rr-scenario-parts">${stage.nodes.map(id=>`<a href="${this.nodeURL(id)}">${esc(nodes.get(id).name)}</a>`).join('')}</div><div class="relation-step-actions">${this.step>0?`<a href="#map/scenario/${this.scenario.id}/${this.step-1}">← 이전 단계</a>`:''}${this.step<this.scenario.steps.length-1?`<a href="#map/scenario/${this.scenario.id}/${this.step+1}">다음 단계 →</a>`:`<a href="#map/scenario/${this.scenario.id}/0">처음부터 ↺</a>`}</div><a class="relation-film-link" href="#story/${this.scenario.film||this.scenario.id}/0">3D 시나리오로 보기 ↗</a></section></article></div>`;
 }
}
