import { Experience } from './experience.js';
import { ScenarioFilm } from './scenario-film.js';
import { pauseCinema, resumeCinema } from './study.js';
import { HARDWARE, HARDWARE_BY_ID, GROUPS, STORIES } from './site-data.js';
import { STORY_ORDER, storyCover } from './story-covers.js';
import { bindUSBPreview } from './story-usb-preview.js';
import { RELATION_SCENARIOS } from './relation-scenarios.js';
import { RelationshipMap } from './relationship-map.js';

const $=selector=>document.querySelector(selector);
const asset=file=>new URL(`../../assets/models/${file}`,import.meta.url).href;
if(new URLSearchParams(location.search).has('thumb'))document.body.classList.add('thumbnail');
const dialog=$('#collection-dialog');
let mode='home',currentId='',currentStep=0,currentKey='',lastExperience='#journey',homeScroll=0,routeToken=0,filter='all',query='',lastFocus=null;
let objectReturn='#wiki';
const experience=new Experience();
const film=new ScenarioFilm(updateStory);
const relationshipMap=new RelationshipMap($('#relationship-page'),asset);
const imageTag=(id,alt='')=>`<img src="${asset(`redesign/${id}.webp`)}" data-fallback="${asset(`${id}.png`)}" alt="${alt}" loading="lazy" decoding="async">`;
function imageFallbacks(){dialog.querySelectorAll('img[data-fallback]').forEach(img=>img.addEventListener('error',()=>{img.src=img.dataset.fallback;},{once:true}));}
$('#category-filter').innerHTML=GROUPS.map(([id,name])=>`<button data-filter="${id}" aria-pressed="${id==='all'}">${name}</button>`).join('');
const scenarioLabels={typing:'TYPING',launch:'APP LAUNCH',save:'SAVE',music:'MUSIC',streaming:'STREAMING',call:'VIDEO CALL',multitasking:'MULTITASKING',usb:'USB',sleep:'SLEEP & WAKE',ai:'AI',loading:'GAME LOADING',record:'SCREEN RECORDING'};
const storyCards=scope=>RELATION_SCENARIOS.map((scenario,i)=>{const {id}=scenario,s=STORIES[id]||scenario,href=STORIES[id]?`#story/${id}/0`:`#map/scenario/${id}/0`;return `<li><a class="story-card" data-scenario="${id}" href="${href}" aria-labelledby="${scope}-${id}-title">${storyCover(id,scope)}<div class="story-card-heading"><div><p>${String(i+1).padStart(2,'0')} / ${s.en||scenarioLabels[id]}</p><h3 id="${scope}-${id}-title">${s.title}</h3></div><span aria-hidden="true">↗</span></div></a></li>`;}).join('');
$('#story-grid').innerHTML=storyCards('stories');
function renderCollection(){
  const search=query.toLocaleLowerCase();
  const items=HARDWARE.filter(p=>(filter==='all'||p.category===filter)&&[p.id,p.title,p.name,p.en,p.model,p.tag].join(' ').toLocaleLowerCase().includes(search));
  $('#collection-grid').classList.toggle('filtered',filter!=='all'||!!query);
  $('#collection-grid').innerHTML=items.map(p=>`<li><a href="#object/${p.id}" aria-label="${p.name} 3D 살펴보기"><figure>${imageTag(p.id)}</figure><div class="item-caption"><div><span class="item-number">${String(p.index+1).padStart(2,'0')}</span><strong>${p.title}</strong></div><small>${p.name}</small></div></a></li>`).join('');
  $('#no-results').hidden=items.length>0;$('#collection-total').textContent=`${String(items.length).padStart(2,'0')} / 23 OBJECTS`;imageFallbacks();
}
renderCollection();
$('#wiki-hardware').innerHTML=HARDWARE.map(p=>`<li><a href="#object/${p.id}" aria-label="${p.name} 3D 살펴보기"><figure>${imageTag(p.id)}</figure><div class="item-caption"><div><span class="item-number">${String(p.index+1).padStart(2,'0')}</span><strong>${p.title}</strong></div><small>${p.name}</small></div></a></li>`).join('');
$('#wiki-stories').innerHTML=storyCards('wiki');
const canHover=matchMedia('(hover:hover)');
document.querySelectorAll('.story-card').forEach(card=>{
  card.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'&&canHover.matches)card.classList.add('preview-active');});
  card.addEventListener('pointerleave',()=>card.classList.remove('preview-active'));
  card.addEventListener('click',()=>card.classList.remove('preview-active'));
  if(card.dataset.scenario==='usb')bindUSBPreview(card);
});
$('#wiki-page').querySelectorAll('img[data-fallback]').forEach(img=>img.addEventListener('error',()=>{img.src=img.dataset.fallback;},{once:true}));
document.querySelectorAll('[data-wiki-tab]').forEach(b=>b.onclick=()=>{
  if(b.dataset.wikiTab==='map'){location.hash='map';return;}
  const stories=b.dataset.wikiTab==='stories';$('#wiki-hardware').hidden=stories;$('#wiki-stories').hidden=!stories;
  document.querySelectorAll('[data-wiki-tab]').forEach(tab=>tab.setAttribute('aria-pressed',String(tab===b)));
});
function showCollection(kind){
  if(!dialog.open){lastFocus=document.activeElement;experience.pause();film.pause();pauseCinema();document.body.classList.add('modal-open');dialog.showModal();}
  const stories=kind==='stories';$('#collection-title').textContent=stories?'시나리오':'하드웨어';
  $('#collection-grid').hidden=stories;$('#story-grid').hidden=!stories;$('#category-filter').hidden=stories;$('.search').hidden=stories;
  $('#no-results').hidden=stories||$('#collection-grid').children.length>0;
  document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===kind)));
  if(stories)$('#collection-total').textContent=`${RELATION_SCENARIOS.length} STORIES`;else renderCollection();
}
function closeCollection(){
  if(dialog.open)dialog.close();document.body.classList.remove('modal-open');
  if(mode==='home')resumeCinema();else if(mode==='story')film.resume();else if(mode!=='wiki'&&mode!=='map')experience.resume();
}
function fallbackImage(id){
  const img=$('#fallback');img.onerror=()=>{img.onerror=null;img.src=asset(`${id}.png`);};img.src=asset(`redesign/${id}.webp`);img.alt=HARDWARE_BY_ID[id]?.name||'하드웨어 모델';
  if(document.body.classList.contains('failed')){document.documentElement.style.setProperty('--paper','#ecece9');document.documentElement.style.setProperty('--ink','45,47,48');}
}
function updateObject(id){
  const p=HARDWARE_BY_ID[id];$('#object-name').textContent=p.title;$('#object-ko').textContent=p.name;
  $('#object-counter').textContent=`${String(p.index+1).padStart(2,'0')} / 23`;
  $('#object-exit').href=objectReturn;$('#object-structure').textContent='조립된 외형';
  $('#world').setAttribute('aria-label',`${p.name} 3D 모델`);document.title=`${p.name} — Inside`;fallbackImage(id);
}
function updateStory(index,story){
  $('#story-map').href=`#map/scenario/${currentId}/0`;
  const step=story.steps[index];currentStep=index;
  $('#story-kicker').textContent=story.en;$('#story-title').textContent=step.title;$('#story-copy').textContent=step.copy;
  $('#story-count').textContent=`${String(index+1).padStart(2,'0')} / ${String(story.steps.length).padStart(2,'0')}`;
  $('#status').textContent=`${step.title} — ${step.copy}`;$('#world').setAttribute('aria-label',`${story.title}: ${step.title}`);
  if(mode==='story'&&currentId){lastExperience=`#story/${currentId}/${index}`;history.replaceState(null,'',lastExperience);}
  fallbackImage(step.fallback);
}
async function route(){
  const token=++routeToken;let hash;try{hash=decodeURIComponent(location.hash.slice(1));}catch{hash='collection';}
  if(hash==='map/scenarios'){hash='stories';history.replaceState(null,'','#stories');}
  if(hash==='collection'||hash==='stories'){showCollection(hash);return;}
  const mapRoute=hash==='map'||hash.startsWith('map/');
  const objectMatch=hash.match(/^(?:object\/|part-)([a-z]+)$/),storyMatch=hash.match(/^story\/([a-z]+)(?:\/(\d+))?$/);
  if((objectMatch&&!HARDWARE_BY_ID[objectMatch[1]])||(storyMatch&&!STORIES[storyMatch[1]])){history.replaceState(null,'','#collection');showCollection('collection');return;}
  const wasCollection=dialog.open;closeCollection();
  if(!mapRoute)relationshipMap.leave();
  if(!storyMatch)film.leave();
  $('#story-sequence').hidden=!storyMatch;
  $('#wiki-page').hidden=hash!=='wiki';
  if(mapRoute){
    if(mode==='home')homeScroll=scrollY;
    mode='map';currentId='';currentKey='';lastExperience='#'+hash;
    experience.pause();experience.clear();pauseCinema();document.body.dataset.mode='map';
    document.body.classList.remove('loading');$('#object-ui').hidden=$('#story-ui').hidden=true;
    document.documentElement.style.setProperty('--paper','#ecece9');document.documentElement.style.setProperty('--ink','45,47,48');
    const preserveMapScroll=relationshipMap.enter(hash);if(!wasCollection&&!preserveMapScroll)scrollTo({top:0,behavior:'instant'});return;
  }
  if(hash==='wiki'){
    if(mode==='home')homeScroll=scrollY;
    mode='wiki';currentId='';currentKey='';lastExperience='#wiki';
    experience.pause();experience.clear();pauseCinema();document.body.dataset.mode='wiki';
    document.body.classList.remove('loading');$('#object-ui').hidden=$('#story-ui').hidden=true;
    document.documentElement.style.setProperty('--paper','#ecece9');document.documentElement.style.setProperty('--ink','45,47,48');
    document.title='Computer Wiki — 하드웨어와 작동 원리';scrollTo({top:0,behavior:'instant'});$('#wiki-title').focus({preventScroll:true});return;
  }
  if(objectMatch){
    if(mode!=='object')objectReturn=/^#(?:wiki$|map(?:\/|$)|story\/)/.test(lastExperience)?lastExperience:'#wiki';
    if(mode==='home')homeScroll=scrollY;
    mode='object';currentId=objectMatch[1];lastExperience=`#object/${currentId}`;
    document.body.dataset.mode='object';$('#object-ui').hidden=false;$('#story-ui').hidden=true;document.body.classList.remove('manipulated');
    if(currentKey===`object/${currentId}`&&!document.body.classList.contains('loading')){experience.resume();return;}
    updateObject(currentId);
    currentKey=`object/${currentId}`;document.body.classList.add('loading');
    try{const ready=await experience.object(currentId);if(token!==routeToken)return;if(ready)$('#object-structure').textContent=experience.items[0].model.layers.join(' · ');}
    catch(error){console.error('Object could not be rendered',currentId,error);document.body.classList.add('failed');$('#status').textContent='모델 이미지를 표시합니다';}
    document.body.classList.remove('loading');$('#object-name').focus({preventScroll:true});
  }else if(storyMatch){
    if(mode==='home')homeScroll=scrollY;
    const nextId=storyMatch[1],same=currentKey===`story/${nextId}`;
    if(!same){film.leave();experience.pause();experience.clear();}
    mode='story';currentId=nextId;const config=same?film.config:STORIES[currentId],index=Math.min(config.steps.length-1,Number(storyMatch[2]||0));
    lastExperience=`#story/${currentId}/${index}`;document.body.dataset.mode='story';$('#object-ui').hidden=true;$('#story-ui').hidden=false;document.title=`${config.title} — Inside`;
    if(same&&!document.body.classList.contains('loading')){if(wasCollection)film.resume();else film.seek(film.stop(index),true);return;}
    currentKey=`story/${currentId}`;document.body.classList.add('loading');
    try{await film.enter(currentId,index);if(token!==routeToken)return;}
    catch(error){console.error('Scenario could not be rendered',currentId,error);document.body.classList.add('failed');updateStory(index,config);}
    document.body.classList.remove('loading');$('#story-title').focus({preventScroll:true});
  }else{
    mode='home';currentId='';currentKey='';lastExperience=hash==='home'?'#home':'#journey';
    document.body.dataset.mode='home';document.body.classList.remove('loading');$('#object-ui').hidden=$('#story-ui').hidden=true;
    scrollTo({top:hash==='home'?0:homeScroll,behavior:'instant'});experience.home();document.title='Inside — 하나의 메인보드, 하나의 컴퓨터';
    if(lastFocus?.isConnected&&lastFocus!==document.body)lastFocus.focus({preventScroll:true});
  }
}
$('#collection-close').onclick=()=>location.hash=lastExperience;
dialog.addEventListener('cancel',event=>{event.preventDefault();location.hash=lastExperience;});
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>location.hash=button.dataset.tab);
$('#search').addEventListener('input',e=>{query=e.target.value.trim();renderCollection();});
$('#category-filter').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button===b)));renderCollection();});
addEventListener('hashchange',route);
addEventListener('keydown',e=>{
  if(dialog.open||$('#story-detail').open||e.altKey||e.ctrlKey||e.metaKey||e.target.closest('input,textarea,select'))return;
  if(mode==='map'){if(e.key==='Escape'){e.preventDefault();relationshipMap.escape();}return;}
  if(e.key==='Escape'&&mode==='object'){e.preventDefault();location.hash=objectReturn;return;}
  if(e.key==='Escape'&&mode!=='home'){location.hash=mode==='story'?'stories':'collection';return;}
  if(e.target.closest('button,a'))return;
  if(mode==='object'){
    if(e.key.toLowerCase()==='a')experience.turn(.15,0);else if(e.key.toLowerCase()==='d')experience.turn(-.15,0);
    else if(e.key.toLowerCase()==='w')experience.turn(0,-.12);else if(e.key.toLowerCase()==='s')experience.turn(0,.12);
    else if(e.key==='+'||e.key==='=')experience.zoom(.9);else if(e.key==='-')experience.zoom(1.1);

  }
});
addEventListener('inside:contextloss',()=>{if(mode==='object')fallbackImage(currentId);else if(mode==='story')fallbackImage(film.config.steps[currentStep]?.fallback||STORIES[currentId].cover);});
addEventListener('inside:contextrestore',()=>{if(mode==='story'){film.resume();return;}currentKey='';if(mode!=='home'&&!dialog.open)route();});
route();
