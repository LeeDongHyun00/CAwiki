const stories=JSON.parse(document.querySelector('#storyboards').textContent),images=JSON.parse(document.querySelector('#images').textContent),$=s=>document.querySelector(s);
let selected=stories.find(s=>s.id===location.hash.slice(1))||stories[0],stage=0;
function render(){
 $('#story-number').textContent=String(selected.number).padStart(2,'0')+' / 16';$('#story-name').textContent=selected.title;$('#core').textContent=selected.core;$('#signature').textContent=selected.signature;$('#note').textContent=selected.note;
 $('input').max=selected.stages.length-1;$('#rail').style.setProperty('--beats',selected.stages.length);
 $('#scenario-list').querySelectorAll('button').forEach(b=>b.setAttribute('aria-current',String(b.dataset.id===selected.id)));
 $('#rail').replaceChildren(...selected.stages.map((b,i)=>{const button=document.createElement('button');button.textContent='0'+(i+1);const title=document.createElement('span');title.textContent=b.title;button.append(title);button.setAttribute('aria-label',`${i+1} ${b.title}`);button.setAttribute('aria-current',stage===i?'step':'false');button.onclick=()=>{stage=i;renderScene();};return button;}));renderScene();
}
function renderScene(){
 const b=selected.stages[stage];$('#scene-number').textContent='0'+(stage+1)+' / '+String(selected.stages.length).padStart(2,'0');$('#scene-title').textContent=b.title;$('#scene-copy').textContent=b.copy;$('#motion').textContent=b.motion===b.effect?b.copy:b.motion;$('#detail').textContent=b.detail;$('#part-image').src=images[({remote:'display',remoteGpu:'gpu',serverGpu:'gpu'}[b.part]||b.part)]||images.mainboard;$('#part-image').alt='장면에 사용하는 '+({input:'키보드',io:'메인보드 입출력',cpu:'CPU',dram:'RAM',ssd:'SSD',display:'모니터',gpu:'GPU',nic:'네트워크 카드',datacenter:'서버',mouse:'마우스',audio:'스피커',camera:'웹캠',power:'전원공급장치'}[b.part]||b.part)+' 참고 모델';
 $('#range-label').textContent=(stage+1)+' / '+selected.stages.length;$('input').value=stage;$('#rail').querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-current',stage===i?'step':'false'));
}
$('#scenario-list').replaceChildren(...stories.map(s=>{const b=document.createElement('button'),num=document.createElement('span');num.textContent=String(s.number).padStart(2,'0');b.append(num,document.createTextNode(s.title));b.dataset.id=s.id;b.onclick=()=>{selected=s;stage=0;history.replaceState(null,'','#'+s.id);render();};return b;}));
$('input').addEventListener('input',e=>{stage=+e.target.value;renderScene();});addEventListener('hashchange',()=>{selected=stories.find(s=>s.id===location.hash.slice(1))||stories[0];stage=0;render();});render();
