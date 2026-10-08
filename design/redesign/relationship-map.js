import { RELATION_SOURCE } from './relation-source.js';
import { RELATION_GROUPS, RELATION_SCENARIOS, RELATION_KINDS } from './relation-scenarios.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nodes=new Map(RELATION_SOURCE.nodes.map(n=>[n.id,n]));
const edges=RELATION_SOURCE.edges;
const byId=new Map(edges.map(e=>[e.id,e]));
const related=id=>edges.filter(e=>e.a===id||e.b===id);
const other=(e,id)=>e.a===id?e.b:e.a;
const nodeURL=id=>`#map/node/${id}`;
export class RelationshipMap{
 constructor(root,asset){
  this.root=root;this.asset=asset;this.frame=0;
  root.innerHTML=`<div class="relation-top"><a href="#wiki">← Computer Wiki</a><a href="#map">전체 관계지도</a></div><div class="relation-heading"><div><h1 id="relation-title" tabindex="-1">부품은 함께 작동합니다</h1><p id="relation-intro"></p></div><div class="relation-search"><label for="relation-search">부품 찾기</label><input id="relation-search" type="search" placeholder="CPU, 메모리, 마우스" autocomplete="off" aria-controls="relation-results"><div id="relation-results" hidden></div></div></div><div id="relation-content"></div><p class="sr-only" id="relation-live" aria-live="polite"></p>`;
  root.querySelector('#relation-search').addEventListener('input',e=>this.search(e.target.value));
  root.querySelector('#relation-search').addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();this.search('');e.target.value='';}if(e.key==='Enter'){const link=root.querySelector('#relation-results a');if(link){e.preventDefault();link.click();}}});
  root.addEventListener('change',e=>{if(e.target.id==='relation-type')this.change({type:e.target.value,page:0,edge:''});});
  this.resize=new ResizeObserver(()=>this.schedule());this.resize.observe(root);
 }
 picture(id,cls=''){
  const n=nodes.get(id);
  if(!n.model)return `<span class="relation-chip ${cls}" aria-hidden="true"><span>MCU</span></span>`;
  return `<img class="${cls}" src="${this.asset(`redesign/${n.model}.webp`)}" alt="" width="180" height="140" decoding="async">`;
 }
 search(value){
  const slot=this.root.querySelector('#relation-results'),q=value.trim().normalize('NFKC').toLocaleLowerCase();slot.hidden=!q;
  if(!q){slot.replaceChildren();return;}
  const found=[...nodes.values()].filter(n=>[n.id,n.name,n.category,n.summary,n.detail].join(' ').normalize('NFKC').toLocaleLowerCase().includes(q));
  slot.innerHTML=found.length?found.map(n=>`<a href="${nodeURL(n.id)}">${esc(n.name)}<span>${esc(n.category)}</span></a>`).join(''):'<p role="status">일치하는 부품이 없습니다</p>';
  this.root.querySelector('#relation-live').textContent=`${found.length}개 부품 검색됨`;
 }
 enter(hash){
  this.path=hash.split('?')[0];this.params=new URLSearchParams(hash.split('?')[1]||'');
  this.root.hidden=false;this.root.querySelector('#relation-search').value='';this.search('');
  const [_,view,id,number]=this.path.split('/');this.view=view||'overview';this.group=RELATION_GROUPS.find(g=>g.id===id);this.scenario=RELATION_SCENARIOS.find(s=>s.id===id);
  if(view==='node'&&nodes.has(id)){this.focus=id;this.renderFocus();}
  else if(view==='group'&&this.group){this.focus=this.group.focus;this.renderFocus();}
  else if(view==='scenario'&&this.scenario){this.step=Math.max(0,Math.min(this.scenario.steps.length-1,Number.isFinite(Number(number))?Math.floor(Number(number)):0));this.focus=this.scenario.steps[this.step].focus;this.renderFocus();}
  else {this.view=view==='scenarios'?'scenarios':'overview';this.renderOverview();}
  this.root.dataset.view=this.view;this.root.dataset.node=this.focus||'';
  this.root.querySelector('#relation-title').focus({preventScroll:true});this.schedule();
 }
 leave(){cancelAnimationFrame(this.frame);this.frame=0;this.root.hidden=true;}
 setHeading(title,copy){this.root.querySelector('#relation-title').textContent=title;this.root.querySelector('#relation-intro').textContent=copy;document.title=`${title} — Computer Wiki`;}
 gallery(){return `<section class="relation-scenarios" aria-labelledby="relation-scenarios-title"><div class="relation-section-title"><h2 id="relation-scenarios-title">일상에서 따라가기</h2><span>16가지 작동 원리</span></div><div class="relation-scenario-grid">${RELATION_SCENARIOS.map((s,i)=>`<a href="#map/scenario/${s.id}/0"><span class="relation-number">${String(i+1).padStart(2,'0')}</span><div><h3>${esc(s.title)}</h3><p>${esc(s.topic)}</p></div><span aria-hidden="true">↗</span></a>`).join('')}</div></section>`;}
 renderOverview(){
  this.focus=null;this.setHeading(this.view==='scenarios'?'하나의 행동을 따라가 보세요':'부품은 함께 작동합니다',this.view==='scenarios'?'어떤 부품이, 왜 필요한지 한 단계씩 살펴봅니다':'함께 작동하는 부품을 고르고 서로에게 필요한 이유를 살펴보세요');
  this.root.querySelector('#relation-content').innerHTML=`${this.view==='overview'?`<div class="relation-overview">${RELATION_GROUPS.map((g,i)=>`<a class="relation-island" href="#map/group/${g.id}"><div class="relation-island-models">${[g.nodes[1],g.focus,g.nodes[2]].map((id,j)=>this.picture(id,`island-model island-model-${j}`)).join('')}<svg viewBox="0 0 300 130" aria-hidden="true"><path d="M50 70Q150 120 250 70M50 70 150 32 250 70"/></svg></div><div class="relation-island-title"><span>${String(i+1).padStart(2,'0')}</span><h2>${g.title}</h2><span aria-hidden="true">↗</span></div><p>${g.copy}</p><small>${g.nodes.map(id=>nodes.get(id).name).join(' · ')}</small></a>`).join('')}</div>`:''}${this.gallery()}`;
 }
 change(values){const params=new URLSearchParams(this.params);for(const [k,v] of Object.entries(values)){if(v===''||v===0||v==='all')params.delete(k);else params.set(k,String(v));}location.hash=this.path+(params.size?'?'+params.toString():'');}
 url(values){const params=new URLSearchParams(this.params);for(const [k,v] of Object.entries(values)){if(v===''||v===0||v==='all')params.delete(k);else params.set(k,String(v));}return '#'+this.path+(params.size?'?'+params.toString():'');}
 renderFocus(){
  const n=nodes.get(this.focus),isScenario=this.view==='scenario',stage=isScenario?this.scenario.steps[this.step]:null;
  const allowed=stage?.nodes||(this.view==='group'?this.group.nodes:null);
  const all=related(this.focus).filter(e=>!allowed||allowed.includes(other(e,this.focus)));
  const type=isScenario?'all':(Object.hasOwn(RELATION_KINDS,this.params.get('type'))?this.params.get('type'):'all');
  const filtered=all.filter(e=>type==='all'||e.kind===type);
  let page=Math.min(Math.max(0,Number.parseInt(this.params.get('page'))||0),Math.max(0,Math.ceil(filtered.length/6)-1));
  const chosen=byId.get(this.params.get('edge'));
  this.selected=chosen&&filtered.includes(chosen)?chosen:null;
  if(this.selected)page=Math.floor(filtered.indexOf(this.selected)/6);
  this.visible=filtered.slice(page*6,page*6+6);
  this.setHeading(isScenario?this.scenario.title:this.view==='group'?this.group.title:`${n.name}의 연결`,stage?`${String(this.step+1).padStart(2,'0')} / ${String(this.scenario.steps.length).padStart(2,'0')}`:this.view==='group'?this.group.copy:n.summary);
  this.root.querySelector('#relation-content').innerHTML=`
   ${isScenario?`<div class="relation-steps" role="group" aria-label="시나리오 단계">${this.scenario.steps.map((s,i)=>`<a href="#map/scenario/${this.scenario.id}/${i}" aria-current="${i===this.step?'step':'false'}"><span>${String(i+1).padStart(2,'0')}</span>${esc(s.title)}</a>`).join('')}</div>`:''}
   <div class="relation-workspace"><div class="relation-map-area"><div class="relation-map-tools"><a href="#map">← 전체 지도</a>${!isScenario?`<label for="relation-type" class="sr-only">관계 유형</label><select id="relation-type"><option value="all">모든 관계 (${all.length})</option>${Object.entries(RELATION_KINDS).map(([k,v])=>`<option value="${k}" ${type===k?'selected':''}>${v} (${all.filter(e=>e.kind===k).length})</option>`).join('')}</select>`:`<a href="#map/scenarios">시나리오 목록 ↗</a>`}</div>
    <div class="relation-board" aria-label="${esc(n.name)} 중심 관계지도"><svg class="relation-lines" aria-hidden="true"></svg><a class="relation-node relation-center" data-node="${this.focus}" href="${this.url({edge:''})}" aria-label="${esc(n.name)} 설명 보기">${this.picture(this.focus)}<strong>${esc(n.name)}</strong><span>현재 중심</span></a>
    ${this.visible.map((e,i)=>{const id=other(e,this.focus);return `<a class="relation-node relation-neighbor slot-${i} ${this.selected===e?'is-selected':''}" data-node="${id}" data-edge="${e.id}" href="${this.url({edge:e.id,page})}" aria-label="${esc(n.name)}와 ${esc(nodes.get(id).name)}의 ${RELATION_KINDS[e.kind]} 관계" ${this.selected===e?'aria-current="true"':''}>${this.picture(id)}<strong>${esc(nodes.get(id).name)}</strong><span>${RELATION_KINDS[e.kind]}</span></a>`;}).join('')}
    ${!this.visible.length?'<p class="relation-empty">이 유형의 관계가 없습니다<br>다른 유형을 선택해 주세요</p>':''}</div>
    <div class="relation-map-bottom"><span>${filtered.length?`${page*6+1}–${Math.min((page+1)*6,filtered.length)} / ${filtered.length}개 관계`:'0개 관계'}</span><div>${page>0?`<a href="${this.url({page:page-1,edge:''})}" aria-label="이전 관계">← 이전</a>`:''}${(page+1)*6<filtered.length?`<a href="${this.url({page:page+1,edge:''})}" aria-label="다음 관계">다음 →</a>`:''}</div></div>
    <p class="relation-map-note">부품을 선택하면 관계를 설명합니다 선은 실제 배선이나 시간 비율을 뜻하지 않습니다</p>
   </div><aside class="relation-explanation" aria-label="관계 설명">${stage?`<div class="relation-step-copy"><h2>${esc(stage.title)}</h2><p>${esc(stage.copy)}</p></div>`:''}${this.selected?this.edgeDetail(this.selected,n):this.nodeDetail(n,isScenario)}
   ${isScenario?`<div class="relation-step-actions">${this.step>0?`<a href="#map/scenario/${this.scenario.id}/${this.step-1}">← 이전 단계</a>`:''}${this.step<this.scenario.steps.length-1?`<a class="relation-primary" href="#map/scenario/${this.scenario.id}/${this.step+1}">다음 단계 →</a>`:`<a class="relation-primary" href="#map/scenario/${this.scenario.id}/0">처음부터 ↺</a>`}</div>${this.scenario.film?`<a class="relation-film-link" href="#story/${this.scenario.film}/0">3D 시나리오로 보기 ↗</a>`:''}`:''}</aside></div>
   ${!isScenario?`<section class="relation-related"><h2>이 부품이 하는 일</h2><div>${RELATION_SCENARIOS.filter(s=>s.steps.some(t=>t.nodes.includes(this.focus))).map(s=>`<a href="#map/scenario/${s.id}/${s.steps.findIndex(t=>t.nodes.includes(this.focus))}">${esc(s.title)} <span aria-hidden="true">↗</span></a>`).join('')}</div></section>`:''}`;
  this.root.querySelector('#relation-live').textContent=stage?`${this.step+1}단계 ${stage.title}`:`${n.name} 중심, ${filtered.length}개 관계`;
 }
 nodeDetail(n,compact){return `<div class="relation-node-copy"><span class="relation-panel-label">${compact?'이 단계의 중심':'선택한 부품'}</span><h2>${esc(n.name)}</h2><p>${esc(n.summary)}</p><div class="relation-links">${n.model?`<a href="#object/${n.model}">3D 구조 보기 ↗</a>`:''}${this.view!=='node'?`<a href="${nodeURL(n.id)}">모든 관계 보기 ↗</a>`:''}</div><details><summary>역할과 내부 구성</summary><p>${esc(n.detail)}</p><dl>${n.parts.map(p=>`<dt>${esc(p.name)}</dt><dd>${esc(p.role)}</dd>`).join('')}</dl></details></div>`;}
 edgeDetail(e,n){const second=nodes.get(other(e,n.id)),forward=e.a===n.id;return `<div class="relation-edge-copy"><span class="relation-panel-label">${RELATION_KINDS[e.kind]}</span><h2>${esc(n.name)} <span>↔</span> ${esc(second.name)}</h2><dl><dt>${esc(n.name)}의 관점</dt><dd>${esc(forward?e.ab:e.ba)}</dd><dt>${esc(second.name)}의 관점</dt><dd>${esc(forward?e.ba:e.ab)}</dd></dl><div class="relation-links"><a class="relation-primary" href="${nodeURL(second.id)}">${esc(second.name)} 중심으로 →</a>${second.model?`<a href="#object/${second.model}">3D 구조 보기 ↗</a>`:''}</div><p class="relation-scope">${{data:'명령·데이터의 논리적 관계입니다 실제로는 컨트롤러나 운영체제를 거칠 수 있습니다',power:'전력을 공급하고 사용하는 관계입니다 양방향 데이터 전송을 뜻하지 않습니다',thermal:'열을 발생시키고 밖으로 옮기는 관계입니다',structure:'장착하거나 내부에 포함하는 구조상의 관계입니다',context:'함께 활용되거나 비교되는 관계입니다 직접 연결된 배선을 뜻하지 않습니다'}[e.kind]}</p></div>`;}
 schedule(){cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>{this.frame=0;this.draw();});}
 draw(){
  const board=this.root.querySelector('.relation-board'),svg=this.root.querySelector('.relation-lines');if(this.root.hidden||!board||!svg)return;
  const rect=board.getBoundingClientRect();if(!rect.width)return;svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
  const position=el=>{const r=el.getBoundingClientRect();return{x:r.x-rect.x+r.width/2,y:r.y-rect.y+r.height/2};};
  const center=position(board.querySelector('.relation-center'));
  svg.innerHTML=[...board.querySelectorAll('.relation-neighbor')].map(el=>{const p=position(el),active=el.dataset.edge===this.selected?.id,mid=(center.x+p.x)/2;return `<path class="${active?'is-selected':''}" d="M${center.x},${center.y} C${mid},${center.y} ${mid},${p.y} ${p.x},${p.y}"/>`;}).join('');
 }
}
