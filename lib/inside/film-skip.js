// Fast-forward is a compositor montage of the film's own hardware portraits.
// Do not render every cold, detailed chapter just to pass it in a fraction of a
// second. The live monitor takes over only after its GPU preparation completes.
import { chapterAt } from 'inside/cinema-timeline';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
export function createSkipMontage(){
  const root=document.createElement('div');root.className='film-montage';root.setAttribute('aria-hidden','true');document.querySelector('#stage').append(root);
  let key='',generation=0,closed=false;
  return {
    show(progress){
      const id=chapterAt(Math.min(progress,.93999)).fallback;if(key===id||closed)return;key=id;
      const token=++generation,img=new Image();img.src=window.__insideAssets['room/'+id+'.webp'];
      img.decode().then(()=>{
        if(closed||token!==generation)return;
        const old=root.lastElementChild;root.append(img);
        if(reduced.matches){old?.remove();return;}
        img.animate([{opacity:0,transform:'scale(.97)'},{opacity:1,transform:'scale(1)'}],{duration:180,easing:'ease-out'});
        if(old)old.animate([{opacity:1},{opacity:0}],{duration:180,fill:'forwards'}).finished.then(()=>old.remove(),()=>{});
      }).catch(()=>{});
    },
    finish(){
      if(closed)return;closed=true;
      if(reduced.matches){root.remove();return;}
      root.animate([{opacity:1},{opacity:0}],{duration:240,fill:'forwards'}).finished.then(()=>root.remove(),()=>{});
    },
    cancel(){closed=true;root.remove();},
  };
}
