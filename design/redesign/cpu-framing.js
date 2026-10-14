import { quality } from '../../lib/inside/quality.js';

// The poster and the live opening use the same reference projection. Viewport
// changes adjust the sensor window, never the opening camera's distance.
export const CPU_FRAME = Object.freeze({width:1440,height:900,subjectWidth:855,maxWidth:.75,fov:31});
export function cpuFrame(width,height){
  const r=CPU_FRAME,s=Math.min(width*r.maxWidth/r.subjectWidth,height/r.height);
  return {width:r.width*s,height:r.height*s,aspect:width/height,
    fov:2*Math.atan(height/(s*r.height)*Math.tan(r.fov*Math.PI/360))*180/Math.PI};
}
export function mountCPUIntro(){
  const poster=document.querySelector('#cpu-intro'),stage=document.querySelector('#stage');
  if(!poster||!stage)return;
  poster.hidden=!/^#?(?:home|journey)?$/.test(location.hash);
  // Quality is fixed for this session; rotating the screen must not replace
  // the image with a different framing or material quality.
  const path=window.__insideAssets?.['intro/'+(quality.compact?'mobile':'desktop')+'.webp'];
  poster.closest('picture')?.querySelectorAll('source').forEach(source=>source.remove());
  if(path)poster.src=path;
  const fit=()=>{const r=stage.getBoundingClientRect(),p=cpuFrame(r.width,r.height);poster.style.width=p.width+'px';poster.style.height=p.height+'px';};
  fit();new ResizeObserver(fit).observe(stage);addEventListener('resize',fit);
  const show=()=>{if(poster.hidden)return;fit();poster.style.opacity='1';performance.mark('inside:cpu-preview-visible');};
  if(poster.complete&&poster.naturalWidth)show();else poster.addEventListener('load',show,{once:true});
}
