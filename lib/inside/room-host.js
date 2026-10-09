// Keep the real Wiki DOM under the gallery throughout the transfer. The iframe
// owns only the moving portraits; it never substitutes a second, loading list.
export class RelationshipRoomHost {
 constructor(onReturn,onRoute){
  this.onReturn=onReturn;this.onRoute=onRoute;this.frame=null;this.scroll=0;
  this.page=document.querySelector('#wiki-page');
  addEventListener('message',event=>{
   if(!this.frame||event.source!==this.frame.contentWindow||event.origin!==location.origin)return;
   const data=event.data;if(data?.channel!=='inside-room')return;
   // A queued child route must not overwrite a newer parent navigation before
   // its hashchange handler has had time to remove this iframe.
   if(!/^#map(?:\/|$)/.test(location.hash))return;
   if(data.type==='ready'){
    const frame=this.frame,current=()=>this.frame===frame;
    // Same-origin calls present the canvas and hide its corresponding DOM
    // images atomically, without a postMessage/frame gap between those writes.
    frame.contentWindow.__insideRoomTransfer={
     layout:()=>current()?this.layout():null,
     paint:(opacity,images)=>{if(current())this.paint(opacity,images);},
     present:()=>{if(current()){frame.style.visibility='visible';this.page.removeAttribute('aria-busy');document.body.dataset.mode='map';frame.focus();}},
     prepareExit:()=>current()?this.prepareExit(frame):null,
     finish:()=>{if(current()){this.paint(1,1);this.onReturn(this.scroll);}},
    };
    frame.contentWindow.postMessage({channel:'inside-room-host',type:'open',scroll:this.scroll,animate:this.animate},location.origin);
   }else if(data.type==='route'&&/^#(?:all|group\/[a-z]+|node\/[a-z]+(?:\?.*)?)$/.test(data.hash))this.onRoute(data.hash==='#all'?'#map':'#map/'+data.hash.slice(1));
  });
  addEventListener('resize',()=>{if(this.locked)this.page.style.setProperty('--room-list-width',document.documentElement.clientWidth+'px');});
 }
 lock(){
  if(this.locked)return;this.locked=true;
  this.page.style.setProperty('--room-list-top',-this.scroll+'px');
  this.page.style.setProperty('--room-list-width',document.documentElement.clientWidth+'px');
  this.page.classList.add('room-list-locked');this.page.inert=true;
  document.body.style.overflow='hidden';this.paint(1,1);
 }
 layout(){
  const hardware=!document.querySelector('#wiki-hardware').hidden,rects={};
  if(hardware)for(const image of this.page.querySelectorAll('#wiki-hardware img')){
   const id=image.closest('a').hash.split('/')[1],r=image.getBoundingClientRect();
   rects[id]={x:r.x,y:r.y,width:r.width,height:r.height};
  }
  return{hardware,rects,opacity:Number(this.page.style.opacity||1)};
 }
 paint(opacity,images){
  this.page.style.opacity=String(opacity);
  document.querySelector('#wiki-hardware').style.setProperty('--room-list-images',images);
 }
 async prepareExit(frame){
  if(!this.locked){
   this.page.hidden=false;document.querySelector('#wiki-hardware').hidden=false;document.querySelector('#wiki-stories').hidden=true;
   document.querySelectorAll('[data-wiki-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.wikiTab==='hardware')));
   this.lock();this.paint(0,0);
  }
  // Decode the destination viewport while the current room stays visible.
  const visible=[...this.page.querySelectorAll('#wiki-hardware img')].filter(image=>{const r=image.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&r.width>0;});
  await Promise.allSettled(visible.map(image=>{image.loading='eager';return image.decode();}));
  return this.frame===frame?this.layout():null;
 }
 enter(hash,{animate=false,scroll=0}={}){
  this.leave();this.scroll=scroll;this.animate=animate;
  if(animate)this.lock();
  this.page.setAttribute('aria-busy','true');
  const frame=document.createElement('iframe');this.frame=frame;frame.title='관계지도';frame.id='relationship-room-frame';
  frame.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0;z-index:100;visibility:hidden;background:transparent';
  const route=animate?'wiki':hash==='map'?'all':hash.slice(4);
  frame.src=new URL('../../relationship-room-study.html?embedded=1&v=090038425e8e#'+route,import.meta.url).href;
  const quality=new URLSearchParams(location.search).get('quality');if(quality){const url=new URL(frame.src);url.searchParams.set('quality',quality);frame.src=url.href;}
  document.body.append(frame);
 }
 leave(){
  this.frame?.contentWindow.dispatchEvent(new Event('inside:dispose'));this.frame?.remove();this.frame=null;
  this.page.removeAttribute('aria-busy');this.page.classList.remove('room-list-locked');this.page.inert=false;
  this.page.style.removeProperty('opacity');document.querySelector('#wiki-hardware').style.removeProperty('--room-list-images');
  for(const key of ['top','width'])this.page.style.removeProperty('--room-list-'+key);
  document.body.style.removeProperty('overflow');
  if(this.locked)scrollTo({top:this.scroll,behavior:'instant'});this.locked=false;
 }
 escape(){if(this.frame?.style.visibility==='hidden'){this.onReturn(this.scroll);return;}this.frame?.contentWindow.postMessage({channel:'inside-room-host',type:'escape'},location.origin);}
}
