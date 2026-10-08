// Isolate the spatial gallery's camera and styles from the film, while keeping
// the public #map route and the same Wiki list on either side of its animation.
export class RelationshipRoomHost {
 constructor(onReturn,onRoute){
  this.onReturn=onReturn;this.onRoute=onRoute;this.frame=null;this.scroll=0;
  addEventListener('message',event=>{
   if(!this.frame||event.source!==this.frame.contentWindow||event.origin!==location.origin)return;
   const data=event.data;if(data?.channel!=='inside-room')return;
   if(data.type==='ready'){
    this.frame.contentWindow.postMessage({channel:'inside-room-host',type:'open',scroll:this.scroll,animate:this.animate},location.origin);
   }else if(data.type==='visible'){
    this.status?.remove();this.status=null;this.frame.style.visibility='visible';document.querySelector('#wiki-page').inert=true;document.querySelector('#wiki-page').removeAttribute('aria-busy');
    this.frame.focus();document.body.dataset.mode='map';document.body.style.overflow='hidden';
   }else if(data.type==='return')this.onReturn(this.scroll);
   else if(data.type==='route'&&/^#(?:all|group\/[a-z]+|node\/[a-z]+(?:\?.*)?)$/.test(data.hash))this.onRoute(data.hash==='#all'?'#map':'#map/'+data.hash.slice(1));
  });
 }
 enter(hash,{animate=false,scroll=0}={}){
  this.leave();this.scroll=scroll;this.animate=animate;
  document.querySelector('#wiki-page').setAttribute('aria-busy','true');
  if(!animate){this.status=document.createElement('p');this.status.textContent='관계지도 준비 중';this.status.setAttribute('role','status');this.status.style.cssText='position:fixed;inset:0;display:grid;place-items:center;margin:0;background:#ecece9;color:#646b5d;font-size:13px;z-index:90';document.body.append(this.status);}
  const frame=document.createElement('iframe');this.frame=frame;frame.title='관계지도';frame.id='relationship-room-frame';
  frame.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0;z-index:100;visibility:hidden;background:#ecece9';
  const route=animate?'wiki':hash==='map'?'all':hash.slice(4);
  frame.src=new URL('../../relationship-room-study.html?embedded=1&v=8b5b87343e08#'+route,import.meta.url).href;
  const quality=new URLSearchParams(location.search).get('quality');if(quality){const url=new URL(frame.src);url.searchParams.set('quality',quality);frame.src=url.href;}
  document.body.append(frame);
 }
 leave(){this.status?.remove();this.status=null;document.querySelector('#wiki-page').removeAttribute('aria-busy');this.frame?.remove();this.frame=null;document.querySelector('#wiki-page').inert=false;document.body.style.removeProperty('overflow');}
 escape(){if(this.frame?.style.visibility==='hidden'){this.onReturn(this.scroll);return;}this.frame?.contentWindow.postMessage({channel:'inside-room-host',type:'escape'},location.origin);}
}
