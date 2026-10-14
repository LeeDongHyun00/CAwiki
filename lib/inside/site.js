import { cancelPreparation, beginSceneReveal } from 'inside/render-status';
import { pauseCinema, resumeCinema, parkCinema } from 'inside/study';
import { HARDWARE, HARDWARE_BY_ID, GROUPS, STORIES } from 'inside/data';
import { STORY_ORDER, storyCover } from 'inside/story-covers';
import { bindUSBPreview } from 'inside/story-usb-preview';
import { RELATION_SCENARIOS } from 'inside/relation-scenarios';
import { RelationshipRoomHost } from 'inside/room-host';

const $=selector=>document.querySelector(selector);
const asset=file=>window.__insideAssets[file];
if(new URLSearchParams(location.search).has('thumb'))document.body.classList.add('thumbnail');
const dialog=$('#collection-dialog');
let mode='home',currentId='',currentStep=0,currentKey='',lastExperience='#journey',homeScroll=0,routeToken=0,filter='all',query='',lastFocus=null;
let objectReturn='#wiki';
// The 3D views load on first use. The Wiki list must not wait for Three.js,
// the model kits or the relationship data before its first paint.
let experience=null,film=null,relationshipMap=null,wikiArrival=null;
const views={
  experience:()=>import('inside/experience').then(({Experience})=>experience||=new Experience()),
  film:()=>import('inside/scenario-film').then(({ScenarioFilm})=>film||=new ScenarioFilm(updateStory)),
  map:()=>import('inside/relationship-map').then(({RelationshipMap})=>relationshipMap||=new RelationshipMap($('#relationship-page'),asset)),
  // After the flight the hidden film gives back its full-size drawing buffer.
  arrival:()=>import('inside/wiki-arrival').then(({WikiArrival})=>wikiArrival||=new WikiArrival($('#wiki-page'),()=>{if(mode==='wiki')parkCinema();})),
};
let wikiEntry=null,roomReturnScroll=null;
const roomGallery=new RelationshipRoomHost(scroll=>{roomReturnScroll=scroll;location.hash='wiki';},hash=>{lastExperience=hash;history.replaceState(null,'',hash);});
document.addEventListener('click',event=>{
  const link=event.target.closest('.wiki-enter,.collection-entry');
  if(mode==='home'&&link&&!event.defaultPrevented&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&event.button===0)wikiEntry=link;
});
// Figures have fixed heights, so a 4:3 portrait never renders wider than these
// caps; phone cells use the 576 px encode. The two lead cells are larger.
const SIZES=['(max-width:600px) 307px,(max-width:900px) 240px,400px','(max-width:600px) calc(50vw - 34px),(max-width:900px) 240px,400px','(max-width:600px) calc(50vw - 34px),(max-width:900px) 240px,(min-width:1600px) 360px,293px'];
// Only a Wiki entry fetches its first portraits ahead of layout; elsewhere the
// hidden list must not compete with the film or a 3D view.
const wikiFirst=/^#wiki$/.test(location.hash);
const imageTag=(id,{index=2,eager=false}={})=>`<img src="${asset(`redesign/${id}.webp`)}" srcset="${asset(`redesign/576/${id}.webp`)} 576w,${asset(`redesign/${id}.webp`)} 1152w" sizes="${SIZES[Math.min(index,2)]}" data-fallback="${asset(`${id}.png`)}" alt="" ${eager&&index<2?'fetchpriority="high"':'loading="lazy"'} decoding="async">`;
const useFallback=img=>{img.removeAttribute('srcset');img.src=img.dataset.fallback;};
function imageFallbacks(){dialog.querySelectorAll('img[data-fallback]').forEach(img=>img.addEventListener('error',()=>useFallback(img),{once:true}));}
$('#category-filter').innerHTML=GROUPS.map(([id,name])=>`<button data-filter="${id}" aria-pressed="${id==='all'}">${name}</button>`).join('');
const scenarioLabels={typing:'TYPING',launch:'APP LAUNCH',save:'SAVE',music:'MUSIC',streaming:'STREAMING',call:'VIDEO CALL',multitasking:'MULTITASKING',usb:'USB',sleep:'SLEEP & WAKE',ai:'AI',loading:'GAME LOADING',record:'SCREEN RECORDING'};
const storyCards=scope=>RELATION_SCENARIOS.map((scenario,i)=>{const {id}=scenario,s=STORIES[id]||scenario,href=STORIES[id]?`#story/${id}/0`:`#map/scenario/${id}/0`;return `<li><a class="story-card" data-scenario="${id}" href="${href}" aria-labelledby="${scope}-${id}-title">${storyCover(id,scope)}<div class="story-card-heading"><div><p>${String(i+1).padStart(2,'0')} / ${s.en||scenarioLabels[id]}</p><h3 id="${scope}-${id}-title">${s.title}</h3></div><span aria-hidden="true">↗</span></div></a></li>`;}).join('');
$('#story-grid').innerHTML=storyCards('stories');
function renderCollection(){
  const search=query.toLocaleLowerCase();
  const items=HARDWARE.filter(p=>(filter==='all'||p.category===filter)&&[p.id,p.title,p.name,p.en,p.model,p.tag].join(' ').toLocaleLowerCase().includes(search));
  $('#collection-grid').classList.toggle('filtered',filter!=='all'||!!query);
  $('#collection-grid').innerHTML=items.map((p,i)=>`<li><a href="#object/${p.id}" aria-label="${p.name} 3D 살펴보기"><figure>${imageTag(p.id,{index:filter==='all'&&!query?i:2})}</figure><div class="item-caption"><div><span class="item-number">${String(p.index+1).padStart(2,'0')}</span><strong>${p.title}</strong></div><small>${p.name}</small></div></a></li>`).join('');
  $('#no-results').hidden=items.length>0;$('#collection-total').textContent=`${String(items.length).padStart(2,'0')} / 23 OBJECTS`;imageFallbacks();
}
renderCollection();
$('#wiki-hardware').innerHTML=HARDWARE.map((p,i)=>`<li><a href="#object/${p.id}" aria-label="${p.name} 3D 살펴보기"><figure>${imageTag(p.id,{index:i,eager:wikiFirst})}</figure><div class="item-caption"><div><span class="item-number">${String(p.index+1).padStart(2,'0')}</span><strong>${p.title}</strong></div><small>${p.name}</small></div></a></li>`).join('');
$('#wiki-stories').innerHTML=storyCards('wiki');
const canHover=matchMedia('(hover:hover)');
document.querySelectorAll('.story-card').forEach(card=>{
  card.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'&&canHover.matches)card.classList.add('preview-active');});
  card.addEventListener('pointerleave',()=>card.classList.remove('preview-active'));
  card.addEventListener('click',()=>card.classList.remove('preview-active'));
  if(card.dataset.scenario==='usb')bindUSBPreview(card);
});
$('#wiki-page').querySelectorAll('img[data-fallback]').forEach(img=>img.addEventListener('error',()=>useFallback(img),{once:true}));
document.querySelectorAll('[data-wiki-tab]').forEach(b=>b.onclick=()=>{
  if(b.dataset.wikiTab==='map'){$('#wiki-hardware').hidden=false;$('#wiki-stories').hidden=true;document.querySelectorAll('[data-wiki-tab]').forEach(t=>t.setAttribute('aria-pressed',String(t.dataset.wikiTab==='hardware')));location.hash='map';return;}
  if(roomGallery.frame?.style.visibility==='hidden')roomGallery.escape();
  const stories=b.dataset.wikiTab==='stories';$('#wiki-hardware').hidden=stories;$('#wiki-stories').hidden=!stories;
  document.querySelectorAll('[data-wiki-tab]').forEach(tab=>tab.setAttribute('aria-pressed',String(tab===b)));
});
function showCollection(kind){
  if(!dialog.open){lastFocus=document.activeElement;experience?.pause();film?.pause();pauseCinema();document.body.classList.add('modal-open');dialog.showModal();}
  const stories=kind==='stories';$('#collection-title').textContent=stories?'시나리오':'하드웨어';
  $('#collection-grid').hidden=stories;$('#story-grid').hidden=!stories;$('#category-filter').hidden=stories;$('.search').hidden=stories;
  $('#no-results').hidden=stories||$('#collection-grid').children.length>0;
  document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===kind)));
  if(stories)$('#collection-total').textContent=`${RELATION_SCENARIOS.length} STORIES`;else renderCollection();
}
function closeCollection(){
  if(dialog.open)dialog.close();document.body.classList.remove('modal-open');
  // The destination route resumes its own renderer after closing the dialog.
}
function fallbackImage(id){
  const img=$('#fallback');img.onerror=()=>{img.onerror=null;img.src=asset(`${id}.png`);};img.src=asset(`redesign/${id}.webp`);img.alt=HARDWARE_BY_ID[id]?.name||'하드웨어 모델';
  if(document.body.classList.contains('failed')){document.documentElement.style.setProperty('--paper','#ecece9');document.documentElement.style.setProperty('--ink','45,47,48');}
}
function updateObject(id){
  const p=HARDWARE_BY_ID[id];$('#object-name').textContent=p.title;$('#object-ko').textContent=p.name;
  $('#object-counter').textContent=`${String(p.index+1).padStart(2,'0')} / 23`;
  $('#object-exit').href=objectReturn;$('#object-structure').textContent='조립된 외형';
  $('#world').setAttribute('aria-label',`${p.name} 3D 모델`);document.title=`${p.name} — Inside`;if(document.body.classList.contains('failed'))fallbackImage(id);
}
function updateStory(index,story){
  const step=story.steps[index];currentStep=index;
  $('#story-title').textContent=step.title;$('#story-copy').textContent=step.copy;
  $('#story-count').textContent=`${String(index+1).padStart(2,'0')} / ${String(story.steps.length).padStart(2,'0')}`;
  $('#status').textContent=`${step.title} — ${step.copy}`;$('#world').setAttribute('aria-label',`${story.title}: ${step.title}`);
  if(mode==='story'&&currentId){lastExperience=`#story/${currentId}/${index}`;history.replaceState(null,'',lastExperience);}
  if(document.body.classList.contains('failed'))fallbackImage(step.fallback);
}
async function route(){
  const token=++routeToken;cancelPreparation();let hash;try{hash=decodeURIComponent(location.hash.slice(1));}catch{hash='collection';}
  wikiArrival?.cancel();
  const enteringWiki=hash==='wiki'&&mode==='home'&&!!wikiEntry;
  const arrival=enteringWiki&&wikiArrival?wikiArrival.capture(wikiEntry):null;wikiEntry=null;
  if(hash==='map/scenarios'){hash='stories';history.replaceState(null,'','#stories');}
  if(hash==='collection'||hash==='stories'){showCollection(hash);return;}
  const mapRoute=hash==='map'||hash.startsWith('map/');
  const objectMatch=hash.match(/^(?:object\/|part-)([a-z]+)$/),storyMatch=hash.match(/^story\/([a-z]+)(?:\/(\d+))?$/);
  if((objectMatch&&!HARDWARE_BY_ID[objectMatch[1]])||(storyMatch&&!STORIES[storyMatch[1]])){history.replaceState(null,'','#collection');showCollection('collection');return;}
  const wasCollection=dialog.open;closeCollection();
  const spatialRoute=mapRoute&&!hash.startsWith('map/scenario/');
  if(spatialRoute){
    const animate=mode==='wiki'&&hash==='map',scroll=mode==='wiki'?scrollY:0;
    relationshipMap?.leave();film?.leave();experience?.pause();experience?.clear();parkCinema();
    if(mode==='home')homeScroll=scrollY;mode='map';currentId='';currentKey='';lastExperience='#'+hash;
    $('#story-sequence').hidden=true;$('#object-ui').hidden=$('#story-ui').hidden=true;$('#wiki-page').hidden=!animate;
    document.body.dataset.mode=animate?'wiki':'map';document.body.classList.remove('loading');document.title='관계지도 — Computer Wiki';
    roomGallery.enter(hash,{animate,scroll});return;
  }
  roomGallery.leave();
  if(!mapRoute)relationshipMap?.leave();
  if(!storyMatch)film?.leave();
  $('#story-sequence').hidden=!storyMatch;
  $('#wiki-page').hidden=hash!=='wiki';
  if(mapRoute){
    if(mode==='home')homeScroll=scrollY;
    mode='map';currentId='';currentKey='';lastExperience='#'+hash;
    experience?.pause();experience?.clear();pauseCinema();document.body.dataset.mode='map';
    document.body.classList.remove('loading');$('#object-ui').hidden=$('#story-ui').hidden=true;
    document.documentElement.style.setProperty('--paper','#ecece9');document.documentElement.style.setProperty('--ink','45,47,48');
    let map;try{map=await views.map();}catch(error){console.error('Relationship map could not be loaded',error);history.replaceState(null,'','#wiki');route();return;}
    if(token!==routeToken)return;const preserveMapScroll=map.enter(hash);if(!wasCollection&&!preserveMapScroll)scrollTo({top:0,behavior:'instant'});return;
  }
  if(hash==='wiki'){
    if(mode==='home')homeScroll=scrollY;
    mode='wiki';currentId='';currentKey='';lastExperience='#wiki';
    experience?.pause();experience?.clear();pauseCinema();document.body.dataset.mode='wiki';
    document.body.classList.remove('loading');$('#object-ui').hidden=$('#story-ui').hidden=true;
    document.documentElement.style.setProperty('--paper','#ecece9');document.documentElement.style.setProperty('--ink','45,47,48');
    document.title='Computer Wiki — 하드웨어와 작동 원리';scrollTo({top:0,behavior:'instant'});
    if(enteringWiki){
      $('#wiki-hardware').hidden=false;$('#wiki-stories').hidden=true;
      document.querySelectorAll('[data-wiki-tab]').forEach(tab=>tab.setAttribute('aria-pressed',String(tab.dataset.wikiTab==='hardware')));
    }
    if(arrival){
      try{if(wikiArrival.start(arrival))return;}catch(error){console.warn('Wiki entrance interrupted',error);wikiArrival.cancel();}
    }
    // The film is hidden behind the list: release its full-size drawing buffer.
    parkCinema();
    if(roomReturnScroll!==null){scrollTo({top:roomReturnScroll,behavior:'instant'});roomReturnScroll=null;$('[data-wiki-tab=map]').focus({preventScroll:true});}else $('#wiki-title').focus({preventScroll:true});return;
  }
  if(objectMatch){
    if(mode!=='object')objectReturn=/^#(?:wiki$|map(?:\/|$)|story\/)/.test(lastExperience)?lastExperience:'#wiki';
    if(mode==='home')homeScroll=scrollY;
    mode='object';currentId=objectMatch[1];lastExperience=`#object/${currentId}`;
    document.body.dataset.mode='object';$('#object-ui').hidden=false;$('#story-ui').hidden=true;document.body.classList.remove('manipulated');
    if(currentKey===`object/${currentId}`&&!document.body.classList.contains('loading')){experience?.resume();return;}
    updateObject(currentId);
    currentKey=`object/${currentId}`;document.body.classList.add('loading');const exposure=beginSceneReveal();
    try{const viewer=await views.experience();if(token!==routeToken)return;const ready=await viewer.object(currentId);if(token!==routeToken)return;if(ready)$('#object-structure').textContent=viewer.items[0].model.layers.join(' · ');else fallbackImage(currentId);}
    catch(error){console.error('Object could not be rendered',currentId,error);document.body.classList.add('failed');fallbackImage(currentId);$('#status').textContent='모델 이미지를 표시합니다';}
    if(token!==routeToken)return;exposure.finish();document.body.classList.remove('loading');$('#object-name').focus({preventScroll:true});
  }else if(storyMatch){
    if(mode==='home')homeScroll=scrollY;
    const nextId=storyMatch[1],same=!!film&&currentKey===`story/${nextId}`;
    if(!same){film?.leave();experience?.pause();experience?.clear();}
    mode='story';currentId=nextId;const config=same?film.config:STORIES[currentId],index=Math.min(config.steps.length-1,Number(storyMatch[2]||0));
    lastExperience=`#story/${currentId}/${index}`;document.body.dataset.mode='story';$('#object-ui').hidden=true;$('#story-ui').hidden=false;document.title=`${config.title} — Inside`;
    if(same&&!document.body.classList.contains('loading')){if(wasCollection)film.resume();else film.seek(film.stop(index),true);return;}
    currentKey=`story/${currentId}`;document.body.classList.add('loading');const exposure=beginSceneReveal();
    try{const story=await views.film();if(token!==routeToken)return;await story.enter(currentId,index);if(token!==routeToken)return;}
    catch(error){console.error('Scenario could not be rendered',currentId,error);document.body.classList.add('failed');updateStory(index,config);}
    if(token!==routeToken)return;exposure.finish();document.body.classList.remove('loading');$('#story-title').focus({preventScroll:true});
  }else{
    mode='home';currentId='';currentKey='';lastExperience=hash==='home'?'#home':'#journey';
    document.body.dataset.mode='home';document.body.classList.remove('loading');$('#object-ui').hidden=$('#story-ui').hidden=true;
    scrollTo({top:hash==='home'?0:homeScroll,behavior:'instant'});showFilm();document.title='Inside — 하나의 메인보드, 하나의 컴퓨터';
    if(lastFocus?.isConnected&&lastFocus!==document.body)lastFocus.focus({preventScroll:true});
  }
}
function showFilm(){
  if(experience)experience.home();
  else{$('#world').style.touchAction='pan-y';resumeCinema();}
  // The film's ending opens the Wiki through a flight that uses this module.
  views.arrival().catch(()=>{});
}
// Warm the next views after the current page has settled, or as soon as a
// visitor points at one. A constrained connection only pays for what is opened.
const viewFor=link=>link.hash.startsWith('#object/')?views.experience:views.film;
const intent=event=>{const link=event.target.closest?.('a[href^="#object/"],a[href^="#story/"]');if(link)viewFor(link)().catch(()=>{});};
for(const type of ['pointerover','pointerdown','focusin'])document.addEventListener(type,intent,{passive:true});
addEventListener('load',()=>{
  const connection=navigator.connection;
  if(connection?.saveData||/2g|3g/.test(connection?.effectiveType||''))return;
  (window.requestIdleCallback||(callback=>setTimeout(callback,1500)))(()=>{views.experience().catch(()=>{});views.film().catch(()=>{});},{timeout:5000});
},{once:true});
$('#collection-close').onclick=()=>location.hash=lastExperience;
dialog.addEventListener('cancel',event=>{event.preventDefault();location.hash=lastExperience;});
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>location.hash=button.dataset.tab);
$('#search').addEventListener('input',e=>{query=e.target.value.trim();renderCollection();});
$('#category-filter').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button===b)));renderCollection();});
addEventListener('hashchange',route);
addEventListener('keydown',e=>{
  if(dialog.open||$('#story-detail').open||e.altKey||e.ctrlKey||e.metaKey||e.target.closest('input,textarea,select'))return;
  if(mode==='map'){if(e.key==='Escape'){e.preventDefault();if(roomGallery.frame)roomGallery.escape();else relationshipMap?.escape();}return;}
  if(e.key==='Escape'&&mode==='object'){e.preventDefault();location.hash=objectReturn;return;}
  if(e.key==='Escape'&&mode!=='home'){location.hash=mode==='story'?'stories':'collection';return;}
  if(e.target.closest('button,a'))return;
  if(mode==='object'){
    if(e.key.toLowerCase()==='a')experience?.turn(.15,0);else if(e.key.toLowerCase()==='d')experience?.turn(-.15,0);
    else if(e.key.toLowerCase()==='w')experience?.turn(0,-.12);else if(e.key.toLowerCase()==='s')experience?.turn(0,.12);
    else if(e.key==='+'||e.key==='=')experience?.zoom(.9);else if(e.key==='-')experience?.zoom(1.1);

  }
});
addEventListener('inside:contextloss',()=>{if(mode==='object')fallbackImage(currentId);else if(mode==='story')fallbackImage(film?.config?.steps[currentStep]?.fallback||STORIES[currentId].cover);});
addEventListener('inside:contextrestore',()=>{if(mode==='story'){film?.resume();return;}currentKey='';if(mode!=='home'&&!dialog.open)route();});
route();
