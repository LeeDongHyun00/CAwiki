// Thirty baked frames from tools/usb-cover/scene.js share a single decoded image.
// A finite, reversible timeline avoids adding WebGL contexts to the scenario list.
const usbAtlas=new URL('../../assets/scenarios/usb-action-atlas.webp',import.meta.url).href;
export function usbCoverScene(id,{monitor,desktop,window,lines,tick}){
 const drive=(x,y,color)=>`<rect x="${x}" y="${y}" width="34" height="27" rx="4" fill="${color}"/><path d="M${x+5} ${y+19}h24" stroke="#213d43" stroke-width="3"/><circle cx="${x+27}" cy="${y+23}" r="1.5" fill="#c4e6cd"/>`;
 const screen=desktop(id)+window(44,29,512,263,'내 PC',`
 <rect x="60" y="76" width="102" height="199" rx="5" fill="#263f46"/>${lines(76,94,[60,49,56,43],'#627f77',25)}
 ${drive(186,95,'#7d9f91')}<text x="238" y="108" font-size="13" fill="#c1d8c7">로컬 디스크</text>${lines(239,122,[241],'#3e5c5d')}
 <path d="M183 149H533" stroke="#3b585b"/>
 <g class="action-result usb-connected" style="--action-delay:1.1s"><rect x="177" y="164" width="358" height="68" rx="7" fill="#315950" stroke="#7fa792" stroke-width=".8"/>${drive(191,184,'#a9cbb3')}<text x="240" y="193" font-size="15" fill="#cde2ce">USB 드라이브</text>${lines(240,207,[192],'#70958a')}${tick(492,193,.65)}</g>`);
 return monitor(id,screen,{x:128,y:30,w:544,h:278})+
 `<svg width="800" height="480" viewBox="0 0 800 480" overflow="hidden"><g class="usb-plug" data-usb-frame="0"><image href="${usbAtlas}" width="4800" height="2400"/></g></svg>`;
}
export function bindUSBPreview(card){
 const sprite=card.querySelector('.usb-plug');if(!sprite)return;
 const reduce=matchMedia('(prefers-reduced-motion:reduce)');
 let value=0,target=0,raf=0;
 const paint=p=>{value=p;const frame=Math.round(p*29);sprite.dataset.usbFrame=frame;sprite.style.transform=`translate(${-800*(frame%6)}px,${-480*Math.floor(frame/6)}px)`;};
 function move(next){
  if(next===target&&!reduce.matches)return;
  target=next;cancelAnimationFrame(raf);
  if(reduce.matches||document.hidden){paint(document.hidden?0:target);raf=0;return;}
  const from=value,start=performance.now(),duration=(target?1250:460)*Math.abs(target-from);
  if(!duration){paint(target);raf=0;return;}
  function tick(now){const t=Math.min(1,(now-start)/duration);paint(from+(target-from)*t);raf=t<1?requestAnimationFrame(tick):0;}
  raf=requestAnimationFrame(tick);
 }
 const sync=()=>move(card.matches(':focus-visible,.preview-active')?1:0);
 card.addEventListener('pointerenter',sync);card.addEventListener('pointerleave',sync);
 card.addEventListener('focus',sync);card.addEventListener('blur',sync);
 card.addEventListener('click',()=>move(0));
 reduce.addEventListener('change',()=>{target=-1;sync();});
 document.addEventListener('visibilitychange',()=>{target=-1;sync();});
 paint(0);
}
