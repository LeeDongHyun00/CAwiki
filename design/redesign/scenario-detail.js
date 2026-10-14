import { HARDWARE_BY_ID } from './site-data.js';

// A location is part of the explanation: a remote/server GPU must never be
// relabelled as a component inside the viewer's own computer.
const aliases={
  io:{id:'mainboard',title:'USB',name:'메인보드의 USB 컨트롤러'},
  usb:{id:'usb',title:'USB',name:'USB 장치와 연결부'},
  remote:{id:'display',title:'DISPLAY',name:'상대방의 화면'},
  remoteMemory:{id:'dram',title:'RAM',name:'상대방의 메모리'},
  remoteGpu:{id:'gpu',title:'GPU',name:'상대방의 그래픽 처리'},
  serverGpu:{id:'gpu',title:'GPU',name:'서버의 연산 장치'},
};
const asset=id=>window.__insideAssets?.[`redesign/${id}.webp`]||new URL(`../../assets/inside/redesign/${id}.webp`,import.meta.url).href;
function hardware(step){
  const id=step.target||step.fallback;
  return aliases[id]||HARDWARE_BY_ID[id]||HARDWARE_BY_ID.cpu;
}
export function renderScenarioDetail(story,index){
  const step=story.steps[index],part=hardware(step),get=id=>document.getElementById(id);
  get('story-detail-title').textContent=step.title;
  get('story-detail-copy').textContent=step.detail;
  get('story-detail-lead').textContent=step.copy;
  get('story-detail-count').textContent=`${String(index+1).padStart(2,'0')} / ${String(story.steps.length).padStart(2,'0')}`;
  get('story-detail-part').textContent=part.title;
  get('story-detail-part-name').textContent=part.name;
  const hero=get('story-detail-image');hero.src=asset(part.id);hero.alt=part.name;
  const flow=get('story-detail-flow');flow.replaceChildren();
  const start=Math.max(0,Math.min(index-1,story.steps.length-3));
  for(let i=start;i<Math.min(story.steps.length,start+3);i++){
    const beat=story.steps[i],model=hardware(beat);
    if(i>start){const arrow=document.createElement('span');arrow.className='principle-arrow';arrow.textContent='→';arrow.setAttribute('aria-hidden','true');flow.append(arrow);}
    const figure=document.createElement('figure'),image=document.createElement('img'),caption=document.createElement('figcaption'),number=document.createElement('span');
    figure.classList.toggle('current',i===index);if(i===index)figure.setAttribute('aria-current','step');
    image.src=asset(model.id);image.alt=model.name;image.decoding='async';
    number.textContent=String(i+1).padStart(2,'0')+(i===index?' · 현재':'');
    caption.append(number,document.createTextNode(beat.title));figure.append(image,caption);flow.append(figure);
  }
  const source=get('story-source');source.hidden=!story.source;if(story.source)source.href=story.source;
  get('story-detail').querySelector('.principle-layout').scrollTop=0;
}
