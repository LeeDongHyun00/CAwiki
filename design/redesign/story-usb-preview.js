// Thirty baked frames from tools/usb-cover/scene.js share a single decoded image.
// A finite, reversible timeline avoids adding WebGL contexts to the scenario list.
const usbAtlas=new URL('../../assets/scenarios/usb-action-atlas.webp',import.meta.url).href;
export function usbCoverScene(){
 return `<svg width="800" height="480" viewBox="0 0 800 480" overflow="hidden"><g class="usb-plug" data-usb-frame="0"><image href="${usbAtlas}" width="4800" height="2400"/></g></svg>
 <g class="action-result usb-connected" style="--action-delay:1.1s"><rect x="572" y="410" width="184" height="36" rx="18" fill="#10282d" fill-opacity=".9" stroke="#58786e" stroke-width=".7"/><circle cx="593" cy="428" r="3" fill="#b6e7ca"/><text x="610" y="433" fill="#c6dfd0" font-size="13">USB 연결됨</text></g>`;
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
