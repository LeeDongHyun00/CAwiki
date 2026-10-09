// Keep the actual Wiki list under the transparent gallery during both transfers.
// The child owns the moving portraits; the host owns layout and preparation UX.
export class RelationshipRoomHost {
 constructor(onReturn,onRoute){
  this.onReturn=onReturn;this.onRoute=onRoute;this.frame=null;this.scroll=0;
  this.page=document.querySelector('#wiki-page');
  addEventListener('message',event=>{
   if(!this.frame||event.source!==this.frame.contentWindow||event.origin!==location.origin)return;
   const data=event.data;if(data?.channel!=='inside-room'||!/^#map(?:\/|$)/.test(location.hash))return;
   if(data.type==='ready'){
    const frame=this.frame,current=()=>this.frame===frame&&/^#map(?:\/|$)/.test(location.hash);
    // Same-origin synchronous calls keep the DOM and the first/last canvas
    // paint in one task, without a postMessage gap exposing an empty list.
    frame.contentWindow.__insideRoomTransfer={
     layout:()=>current()?this.layout():null,
     paint:(chrome,images)=>{if(current())this.paint(chrome,images);},
     present:()=>{if(current())this.present();},
     prepareExit:portraits=>this.prepareExit(frame,portraits),
     finish:()=>{if(current()){this.paint(1,1);this.onReturn(this.scroll);}},
    };
    frame.contentWindow.postMessage({channel:'inside-room-host',type:'open',scroll:this.scroll,animate:this.animate},location.origin);
   }else if(data.type==='route'&&/^#(?:all|group\/[a-z]+|node\/[a-z]+(?:\?.*)?)$/.test(data.hash))this.onRoute(data.hash==='#all'?'#map':'#map/'+data.hash.slice(1));
  });
  addEventListener('pointermove',()=>{if(!this.frame)this.page.classList.remove('room-image-rest');},{passive:true});
  addEventListener('resize',()=>{if(this.locked)this.page.style.setProperty('--room-list-width',innerWidth+'px');});
 }
 layout(){
  this.page.classList.add('room-image-rest');
  const rects={};
  for(const image of this.page.querySelectorAll('#wiki-hardware img')){
   const id=image.closest('a').hash.split('/')[1],r=image.getBoundingClientRect();
   rects[id]={x:r.x,y:r.y,width:r.width,height:r.height};
  }
  return{rects,chrome:Number(getComputedStyle(this.page.querySelector('.wiki-heading')).opacity)};
 }
 lock(){
  if(this.locked)return;
  this.locked=true;this.page.hidden=false;
  document.querySelector('#wiki-hardware').hidden=false;document.querySelector('#wiki-stories').hidden=true;
  document.querySelectorAll('[data-wiki-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.wikiTab==='hardware')));
  this.page.style.setProperty('--room-list-top',-this.scroll+'px');
  this.page.style.setProperty('--room-list-width',document.documentElement.clientWidth+'px');
  this.page.classList.add('room-list-locked','room-image-rest');this.page.inert=true;document.body.style.overflow='hidden';
 }
 paint(chrome,images){
  // Opacity does not inherit. Updating only these nodes avoids invalidating
  // every hidden scenario SVG descendant through an inherited CSS variable.
  this.chromeNodes ||= [...this.page.querySelectorAll('.wiki-top,.wiki-heading,.wiki-tabs,#wiki-hardware .item-caption')];
  this.imageNodes ||= [...this.page.querySelectorAll('#wiki-hardware img')];
  if(this.lastChrome!==chrome){for(const el of this.chromeNodes)el.style.opacity=String(chrome);this.lastChrome=chrome;}
  if(this.lastImages!==images){for(const el of this.imageNodes)el.style.opacity=String(images);this.lastImages=images;}
 }
 present(){
  clearTimeout(this.preparing);this.preparing=0;
  if(!this.locked)this.scroll=scrollY;
  this.lock();this.page.classList.remove('room-preparing');this.page.removeAttribute('aria-busy');
  this.frame.style.visibility='visible';document.body.dataset.mode='map';this.frame.focus();
 }
 async prepareExit(frame,portraits){
  if(this.frame!==frame)return null;
  if(!this.locked){
   this.lock();this.paint(0,0);
  }
  const visible=[...this.page.querySelectorAll('#wiki-hardware img')].filter(image=>{const r=image.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&r.width>0;});
  await Promise.all(visible.map(async image=>{
   image.loading='eager';let deadline;
   const ready=await Promise.race([image.decode().then(()=>true,()=>false),new Promise(resolve=>{deadline=setTimeout(()=>resolve(false),1200);})]);
   clearTimeout(deadline);if(ready||this.frame!==frame)return;
   // A slow/full-size image must not leave a hole at landing. The gallery
   // already decoded the identical portrait: use its pixels without a request.
   const preview=portraits?.[image.closest('a').hash.split('/')[1]];
   if(preview?.naturalWidth){
    const canvas=document.createElement('canvas');canvas.width=preview.naturalWidth;canvas.height=preview.naturalHeight;
    canvas.getContext('2d').drawImage(preview,0,0);image.src=canvas.toDataURL();await image.decode().catch(()=>{});
   }
  }));
  return this.frame===frame?this.layout():null;
 }
 enter(hash,{animate=false,scroll=0}={}){
  this.leave();this.scroll=scroll;this.animate=animate;this.page.setAttribute('aria-busy','true');
  const frame=document.createElement('iframe');this.frame=frame;frame.title='관계지도';frame.id='relationship-room-frame';
  // Match the child's UA color scheme so its transparent canvas stays clear.
  // Inheriting the main page's dark scheme otherwise paints an opaque backdrop.
  frame.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0;z-index:100;visibility:hidden;background:transparent;color-scheme:normal';
  const route=animate?'wiki':hash==='map'?'all':hash.slice(4);
  frame.src=new URL('../../relationship-room-study.html?embedded=1&v=fa9e86789bb9#'+route,import.meta.url).href;
  const quality=new URLSearchParams(location.search).get('quality');if(quality){const url=new URL(frame.src);url.searchParams.set('quality',quality);frame.src=url.href;}
  document.body.append(frame);
  if(animate)this.preparing=setTimeout(()=>{if(this.frame===frame&&frame.style.visibility==='hidden')this.page.classList.add('room-preparing');},200);
 }
 leave(){
  clearTimeout(this.preparing);this.preparing=0;
  this.frame?.contentWindow.dispatchEvent(new Event('inside:dispose'));this.frame?.remove();this.frame=null;
  this.page.removeAttribute('aria-busy');this.page.classList.remove('room-list-locked','room-preparing');this.page.inert=false;
  for(const key of ['--room-list-top','--room-list-width'])this.page.style.removeProperty(key);
  for(const el of [...(this.chromeNodes||[]),...(this.imageNodes||[])])el.style.removeProperty('opacity');
  this.chromeNodes=this.imageNodes=null;this.lastChrome=this.lastImages=undefined;
  document.body.style.removeProperty('overflow');
  if(this.locked)scrollTo({top:this.scroll,behavior:'instant'});this.locked=false;
 }
 escape(){if(this.frame?.style.visibility==='hidden'){this.onReturn(this.locked?this.scroll:scrollY);return;}this.frame?.contentWindow.postMessage({channel:'inside-room-host',type:'escape'},location.origin);}
}
