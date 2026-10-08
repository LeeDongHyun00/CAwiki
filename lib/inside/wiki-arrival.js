import { quality } from 'inside/quality';
import * as T from 'inside/three';
import { captureCinema } from 'inside/study';
import { portraitScene, portraitCamera, portraitRotation, portraitModel, portraitPose } from 'inside/hardware-portraits';

const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const t=clamp(x);return t*t*t*(t*(t*6-15)+10);};
const range=(t,a,b)=>smooth((t-a)/(b-a));
const mix=(a,b,t)=>a+(b-a)*t;
const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};

// One temporary scene borrows film geometry; no duplicated renderer, changed
// materials, or persistent transforms on the film's original models.
export class WikiArrival {
  constructor(page){
    this.page=page;this.frame=0;this.active=false;this.tick=this.tick.bind(this);
    const finish=()=>{if(this.active)this.finish();};
    addEventListener('wheel',finish,{passive:true});addEventListener('touchmove',finish,{passive:true});
    addEventListener('resize',finish);addEventListener('pointerdown',finish);
    addEventListener('keydown',e=>{if(this.active&&['Tab','Escape','PageDown','PageUp','Home','End','ArrowDown','ArrowUp'].includes(e.key))this.finish();});
    addEventListener('inside:contextloss',finish);reduced.addEventListener('change',finish);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)finish();});
  }
  capture(button){
    if(quality.compact||!button||reduced.matches||!button.getClientRects().length)return null;
    try{
      const snapshot=captureCinema();if(!snapshot)return null;
      const text=document.createRange();text.selectNodeContents(button.firstChild);
      const r=text.getBoundingClientRect();snapshot.label={x:r.x,y:r.y,width:r.width,height:r.height};
      snapshot.labelColor=getComputedStyle(button).color;
      return snapshot;
    }catch(error){console.warn('Wiki entrance unavailable',error);return null;}
  }
  start(snapshot){
    if(!snapshot)return false;
    this.cancel();this.active=true;this.elapsed=0;this.snapshot=snapshot;this.items=[];
    this.page.inert=true;this.page.setAttribute('aria-busy','true');
    document.body.classList.add('wiki-arriving');document.body.dataset.wikiArrival='parts';
    this.cards=[...this.page.querySelectorAll('#wiki-hardware>li')].map((el,index)=>({el,index,image:el.querySelector('img'),caption:el.querySelector('.item-caption'),id:el.querySelector('a').hash.split('/')[1]}));
    for(const card of this.cards){card.image.loading='eager';card.el.style.setProperty('--arrival-image','0');card.el.style.setProperty('--arrival-caption','0');}
    this.backdrop=document.createElement('img');this.backdrop.className='wiki-flight-backdrop';this.backdrop.alt='';this.backdrop.src=snapshot.image;document.body.append(this.backdrop);
    this.title=this.page.querySelector('#wiki-title');const titleRect=rect(this.title),style=getComputedStyle(this.title);
    this.label=document.createElement('div');this.label.className='wiki-flight-title';this.label.textContent='Computer Wiki';
    Object.assign(this.label.style,{font:style.font,letterSpacing:style.letterSpacing,lineHeight:style.lineHeight,color:style.color});
    this.label.setAttribute('aria-hidden','true');document.body.append(this.label);
    this.startColor=new T.Color(snapshot.labelColor);this.endColor=new T.Color(style.color);this.labelColor=new T.Color();
    this.titleTarget={x:titleRect.x,y:titleRect.y,width:this.label.getBoundingClientRect().width,height:titleRect.height};
    this.scene=portraitScene(snapshot.stage.environment.texture);this.camera=portraitCamera(innerWidth,innerHeight);
    const unit=10/innerHeight;
    const destinationRotation=portraitRotation('cpu');
    const sources=new Map(snapshot.models.map(m=>[m.id,m]));
    for(const card of this.cards){
      const source=sources.get(card.id);if(!source)continue;
      const portrait=portraitModel(source.root,card.id,source.rest),{group,size:toSize}=portrait;portrait.assemble(0);this.scene.add(group);
      group.quaternion.copy(source.quaternion);const fromSize=new T.Box3().setFromObject(group).getSize(new T.Vector3());
      const target=rect(card.el.querySelector('figure')),r=source.rect;
      const from={x:(r.x+r.width/2-innerWidth/2)*unit,y:(innerHeight/2-r.y-r.height/2)*unit,scale:Math.min(r.width*unit/fromSize.x,r.height*unit/fromSize.y)};
      const to=portraitPose(toSize,target,innerWidth,innerHeight);
      const delay=150+this.items.length*65,duration=1050;
      this.items.push({id:card.id,card,group,portrait,from,to,rotation:source.quaternion,endRotation:destinationRotation,delay,duration});card.travels=true;
    }
    this.landAt=Math.max(1120+(this.cards.length-1)*28,...this.items.map(i=>i.delay+i.duration));this.chromeAt=this.landAt+240;this.endAt=this.chromeAt+540;
    this.canvas=snapshot.stage.renderer.domElement;this.canvas.style.opacity='0';
    this.tick(0);this.lastTime=performance.now();this.frame=requestAnimationFrame(this.tick);return true;
  }
  tick(now){
    this.frame=0;if(!this.active)return;
    if(now)this.elapsed+=Math.min(50,Math.max(0,now-this.lastTime));this.lastTime=now;
    const t=this.elapsed,renderer=this.snapshot.stage.renderer,fade=range(t,this.landAt,this.chromeAt);
    this.backdrop.style.opacity=String(this.snapshot.opacity*(1-range(t,120,740)));this.backdrop.style.transform=`scale(${mix(1,.975,range(t,120,740))})`;
    const q=range(t,0,1050),a=this.snapshot.label,b=this.titleTarget;
    this.label.style.transform=`translate3d(${mix(a.x,b.x,q)}px,${mix(a.y,b.y,q)}px,0) scale(${mix(a.width/b.width,1,q)},${mix(a.height/b.height,1,q)})`;
    this.label.style.color=this.labelColor.copy(this.startColor).lerp(this.endColor,range(t,0,900)).getStyle();
    this.label.style.opacity=String(1-range(t,950,1100));this.title.style.opacity=String(range(t,950,1100));
    for(const item of this.items){
      const p=range(t,item.delay,item.delay+item.duration),{group,from,to}=item;
      item.portrait.assemble(range(t,item.delay+120,item.delay+750));
      group.position.set(mix(from.x,to.x,p),mix(from.y,to.y,p)+Math.sin(p*Math.PI)*.32,0);
      group.scale.setScalar(mix(from.scale,to.scale,p));group.quaternion.copy(item.rotation).slerp(item.endRotation,p);
      item.card.el.style.setProperty('--arrival-caption',range(t,item.delay+800,item.delay+1150));
    }
    for(const card of this.cards){
      // Put the identical still underneath the settled opaque model before
      // fading the canvas. Two half-opacity layers would cause a brightness dip.
      if(card.travels)card.el.style.setProperty('--arrival-image',t>=this.landAt?1:0);
      else{
        const p=range(t,720+card.index*28,1120+card.index*28);
        card.el.style.setProperty('--arrival-image',p);card.el.style.setProperty('--arrival-caption',p);
      }
    }
    this.canvas.style.opacity=String(range(t,40,190)*(1-fade));
    try{renderer.setRenderTarget(null);renderer.setClearColor(0xecece9,0);renderer.render(this.scene,this.camera);}
    catch(error){console.warn('Wiki entrance render unavailable',error);this.finish();return;}
    const chrome=range(t,this.chromeAt,this.endAt);
    this.page.style.setProperty('--arrival-chrome',chrome);this.page.style.setProperty('--arrival-tabs',range(t,this.chromeAt+80,this.endAt));
    if(t>=this.chromeAt)document.body.dataset.wikiArrival='chrome';
    if(t>=this.endAt){this.finish();return;}
    if(now)this.frame=requestAnimationFrame(this.tick);
  }
  finish(){this.cancel();if(document.body.dataset.mode==='wiki')this.title?.focus({preventScroll:true});}
  cancel(){
    cancelAnimationFrame(this.frame);this.frame=0;if(!this.active)return;this.active=false;
    this.page.inert=false;this.page.removeAttribute('aria-busy');this.page.style.removeProperty('--arrival-chrome');this.page.style.removeProperty('--arrival-tabs');
    this.title?.style.removeProperty('opacity');this.canvas?.style.removeProperty('opacity');
    for(const card of this.cards){card.el.style.removeProperty('--arrival-image');card.el.style.removeProperty('--arrival-caption');}
    this.label?.remove();this.backdrop?.remove();this.scene?.clear();
    this.label=this.backdrop=this.scene=null;this.items=[];this.snapshot=null;
    document.body.classList.remove('wiki-arriving');delete document.body.dataset.wikiArrival;
  }
}
