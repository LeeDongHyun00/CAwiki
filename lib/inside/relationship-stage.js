import { preparePrograms } from 'inside/prepare-programs';
import { quality } from 'inside/quality';
import { beginPreparation, paintStatus, yieldTask } from 'inside/render-status';
import { batchStaticMeshes } from 'inside/cinema-models';
import * as T from 'inside/three';
import { acquireStage } from 'inside/study';
import { createCollectionModel, disposeCollectionModel } from 'inside/collection';
import { FRONT_FACING } from 'inside/data';

const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const smooth=t=>t*t*(3-2*t);
const keys=['x','y','scale','opacity','rx','ry'];
const neutral=()=>({lift:0,zoom:0,rx:0,ry:0});
const equal=(a,b)=>a&&keys.every(k=>Math.abs(a[k]-b[k])<.00001);

// Layout transitions and pointer feedback are separate animation channels.
// DOM anchors define destinations; hover never remeasures or restarts a route.
export class RelationshipStage {
 constructor(root){
  this.root=root;this.items=new Map();this.token=0;this.frame=0;this.layoutFrame=0;this.active=false;
  this.keyboard=false;this.mouse=null;this.hover=null;this.navigating=false;this.routePending=false;
  this.tick=this.tick.bind(this);
  this.resize=new ResizeObserver(()=>this.requestLayout());this.resize.observe(root);
  addEventListener('resize',()=>this.requestLayout());addEventListener('scroll',()=>this.requestLayout(),{passive:true});
  addEventListener('keydown',e=>{if(['Tab','Enter',' ','Escape','ArrowLeft','ArrowRight'].includes(e.key))this.keyboard=true;});
  addEventListener('pointerdown',()=>{this.keyboard=false;this.focusModel=null;this.updateInteraction();},{passive:true});
  root.addEventListener('pointermove',e=>{
   if(e.pointerType!=='mouse')return;
   this.keyboard=false;this.mouse={x:e.clientX,y:e.clientY};this.updateInteraction();
  });
  root.addEventListener('pointerleave',()=>{this.mouse=null;this.updateInteraction();});
  root.addEventListener('focusin',e=>{this.focusModel=this.keyboard?this.modelLink(e.target)?.id:null;this.updateInteraction();});
  root.addEventListener('focusout',()=>{this.focusModel=null;this.updateInteraction();});
  reduced.addEventListener('change',()=>{this.updateInteraction();this.requestLayout();});
  document.addEventListener('visibilitychange',()=>{
   cancelAnimationFrame(this.frame);this.frame=0;this.lastTime=0;
   if(!document.hidden)this.requestLayout();
  });
  addEventListener('inside:contextloss',()=>{this.lost=true;cancelAnimationFrame(this.frame);this.frame=0;root.classList.remove('rr-webgl');});
  addEventListener('inside:contextrestore',()=>{
   this.lost=false;if(this.active&&this.stage){this.scene.environment=this.stage.environment.texture;root.classList.add('rr-webgl');this.requestLayout();}
  });
 }
 modelLink(target){
  const link=target?.closest?.('.rr-exhibit,.rr-pair>a');
  const id=link?.querySelector('[data-model]')?.dataset.model;
  return id&&this.root.contains(link)?{id,link}:null;
 }
 updateInteraction(){
  let hit=null;
  if(!this.navigating&&!reduced.matches){
   if(this.keyboard){const match=this.modelLink(document.activeElement);if(match?.id===this.focusModel)hit=match;}
   else if(this.mouse)hit=this.modelLink(document.elementFromPoint(this.mouse.x,this.mouse.y));
  }
  this.hover=hit?.id||null;
  let rx=0,ry=0;
  if(hit&&this.mouse&&!this.keyboard){
   const r=hit.link.getBoundingClientRect();
   rx=(Math.max(-1,Math.min(1,(this.mouse.y-r.y)/r.height*2-1)))*.018;
   ry=(Math.max(-1,Math.min(1,(this.mouse.x-r.x)/r.width*2-1)))*.025;
  }
  for(const item of this.items.values())item.feedbackTarget=item.id===this.hover?{lift:.045,zoom:.022,rx,ry}:neutral();
  this.wake();
 }
 beginNavigation(){
  this.navigating=true;this.routePending=true;this.hover=null;this.focusModel=null;this.root.dataset.moving='true';
  // Preserve exactly the displayed pose, including an interrupted hover.
  for(const item of this.items.values()){
   item.current={...item.pose};item.from={...item.pose};item.to={...item.pose};item.elapsed=0;item.duration=0;
   item.feedback=neutral();item.feedbackTarget=neutral();
  }
  cancelAnimationFrame(this.layoutFrame);this.layoutFrame=0;
 }
 async enter(){
  this.active=true;const token=++this.token;this.preparing=true;
  const finish=beginPreparation('관계지도를 준비하고 있습니다');
  this.root.classList.remove('rr-webgl');
  await paintStatus();
  try{
   const stage=await acquireStage();if(token!==this.token||!this.active)return;
   if(!stage){this.root.classList.remove('rr-webgl');this.navigating=false;this.root.dataset.moving='false';return;}
   this.stage=stage;
   if(!this.scene){
    this.scene=new T.Scene();this.camera=new T.OrthographicCamera(-8,8,5,-5,.1,100);this.camera.position.z=30;
    const key=new T.DirectionalLight(0xfff9ef,2.3);key.position.set(-6,8,10);
    const rim=new T.DirectionalLight(0xdde8f0,1.2);rim.position.set(6,4,-3);
    this.scene.add(key,rim,new T.HemisphereLight(0xf6f7f2,0x5a6450,.8));
   }
   this.scene.environment=stage.environment.texture;this.scene.environmentIntensity=.82;
   stage.renderer.domElement.setAttribute('aria-label',(this.root.querySelector('#relation-title')?.textContent||'관계지도')+' 3D 하드웨어');
   stage.renderer.setClearColor(0xf5f5f1,0);stage.renderer.domElement.style.touchAction='pan-y';
   // Build one model per task so links and the loading status keep responding.
   const ids=[...new Set([...this.root.querySelectorAll('[data-model]')].map(el=>el.dataset.model))];
   for(const id of ids){
    if(token!==this.token||!this.active)return;
    if(!this.items.has(id))this.make(id);
    await yieldTask();
   }
   if(token!==this.token||!this.active)return;
   const prepared=await preparePrograms(stage.renderer,this.scene,this.camera,()=>token===this.token&&this.active&&!this.lost);
   if(!prepared)return;
   if(token!==this.token||!this.active)return;
   this.preparing=false;this.layout();cancelAnimationFrame(this.frame);this.frame=0;this.tick(performance.now());
   this.root.classList.add('rr-webgl');
  }catch(error){console.warn('Relationship models unavailable',error);this.root.classList.remove('rr-webgl');this.navigating=false;this.root.dataset.moving='false';}
  finally{if(token===this.token)this.preparing=false;finish();}
 }
 make(id){
  const model=createCollectionModel(id);model.explode(0);batchStaticMeshes(model.root);
  const box=new T.Box3().setFromObject(model.root);model.root.position.sub(box.getCenter(new T.Vector3()));
  const pivot=new T.Group(),group=new T.Group();pivot.add(model.root);group.add(pivot);
  const direction=new T.Vector3(...(id==='mouse'?[.9,1.15,-1.5]:FRONT_FACING.has(id)?[.7,.38,1.6]:[.75,1.2,1.65]));
  pivot.quaternion.setFromRotationMatrix(new T.Matrix4().lookAt(direction,new T.Vector3(),new T.Vector3(0,1,0))).invert();
  const bounds=new T.Box3().setFromObject(group);pivot.position.sub(bounds.getCenter(new T.Vector3()));
  const item={id,model,group,size:bounds.getSize(new T.Vector3()),current:null,to:null,pose:null,feedback:neutral(),feedbackTarget:neutral(),elapsed:0,duration:0};
  this.scene.add(group);this.items.set(id,item);return item;
 }
 requestLayout(){
  if(!this.active||this.preparing||!this.stage||this.lost||document.hidden||this.layoutFrame)return;
  this.layoutFrame=requestAnimationFrame(()=>{this.layoutFrame=0;this.layout();});
 }
 layout(){
  if(!this.active||this.preparing||!this.stage||this.lost||document.hidden)return;
  const route=this.routePending;this.routePending=false;
  const aspect=innerWidth/innerHeight;this.camera.left=-5*aspect;this.camera.right=5*aspect;this.camera.updateProjectionMatrix();
  const selected=new Set(),unit=10/innerHeight;
  for(const el of this.root.querySelectorAll('[data-model]')){
   if(!el.getClientRects().length)continue;
   const r=el.getBoundingClientRect(),id=el.dataset.model;if(!r.width||!r.height||selected.has(id))continue;
   selected.add(id);let item=this.items.get(id);
   try{item||=this.make(id);}catch(error){console.warn('Relationship model',id,error);continue;}
   const to={x:(r.x+r.width/2-innerWidth/2)*unit,y:(innerHeight/2-r.y-r.height/2)*unit,scale:Math.min(r.width*unit/item.size.x,r.height*unit/item.size.y)*.87,opacity:1,rx:0,ry:0};
   const fresh=!item.current;
   if(fresh)item.current=item.pose={...to,opacity:0};
   if(route||fresh)this.target(item,to,fresh?260:640);
   else if(!equal(item.to,to)){
    // Resize/scroll may update the endpoint, never finish an active transition.
    item.to=to;
    if(item.elapsed>=item.duration){item.current={...to};item.from={...to};}
   }
  }
  for(const item of this.items.values())if(!selected.has(item.id)&&item.to?.opacity!==0)this.target(item,{...item.current,opacity:0},180);
  this.updateInteraction();this.wake();
 }
 target(item,to,duration){
  item.from={...item.current};item.to=to;item.elapsed=0;item.duration=quality.compact||reduced.matches||equal(item.current,to)?0:duration;
 }
 wake(){
  if(!this.frame&&this.active&&this.stage&&!document.hidden&&!this.lost){this.lastTime=performance.now();this.frame=requestAnimationFrame(this.tick);}
 }
 tick(now){
  this.frame=0;if(!this.active||this.lost||this.routePending)return;
  // A slow compilation frame must not consume the entire entrance animation.
  const dt=Math.min(50,Math.max(0,now-(this.lastTime||now)));this.lastTime=now;
  let moving=false,transitioning=false;
  for(const [id,item] of this.items){
   if(!item.to)continue;
   item.elapsed=reduced.matches?item.duration:Math.min(item.duration,item.elapsed+dt);
   const t=item.duration?item.elapsed/item.duration:1,q=smooth(t);
   for(const k of keys)item.current[k]=item.from[k]+(item.to[k]-item.from[k])*q;
   if(t<1){moving=true;transitioning=true;}
   const k=reduced.matches?1:1-Math.exp(-dt/65);
   for(const key of Object.keys(item.feedback)){
    const delta=item.feedbackTarget[key]-item.feedback[key];
    item.feedback[key]=Math.abs(delta)<.00005?item.feedbackTarget[key]:item.feedback[key]+delta*k;
    if(Math.abs(delta)>=.00005)moving=true;
   }
   const c=item.current,f=item.feedback;
   item.pose={...c,y:c.y+f.lift,scale:c.scale*(1+f.zoom),rx:c.rx+f.rx,ry:c.ry+f.ry};
   const v=item.pose;item.group.position.set(v.x,v.y,0);item.group.scale.setScalar(v.scale);item.group.rotation.set(v.rx,v.ry,0);
   if(t===1&&v.opacity===0){this.scene.remove(item.group);disposeCollectionModel(item.model);this.items.delete(id);}
  }
  this.render();
  if(this.navigating&&!transitioning){this.navigating=false;this.root.dataset.moving='false';this.updateInteraction();}
  if(moving&&!this.frame)this.frame=requestAnimationFrame(this.tick);
 }
 render(){
  const renderer=this.stage.renderer,items=[...this.items.values()],buckets=new Map();
  for(const item of items){
   const alpha=Math.round(item.pose.opacity*1000)/1000;item.group.visible=alpha===1;
   if(alpha>0&&alpha<1){if(!buckets.has(alpha))buckets.set(alpha,[]);buckets.get(alpha).push(item);}
  }
  renderer.setRenderTarget(null);renderer.render(this.scene,this.camera);
  if(buckets.size){
   // Fade the resolved image of each opaque group. Fading individual mesh
   // materials disables occlusion and makes chips appear to break apart.
   if(!this.fadeTarget){
    const type=renderer.extensions.has('EXT_color_buffer_float')?T.HalfFloatType:T.UnsignedByteType;
    this.fadeTarget=new T.WebGLRenderTarget(1,1,{type,samples:quality.targetSamples});
    this.fadeScene=new T.Scene();this.fadeCamera=new T.OrthographicCamera(-1,1,1,-1,0,2);this.fadeCamera.position.z=1;
    this.fadeMaterial=new T.MeshBasicMaterial({map:this.fadeTarget.texture,transparent:true,depthTest:false,depthWrite:false});
    this.fadeQuad=new T.Mesh(new T.PlaneGeometry(2,2),this.fadeMaterial);this.fadeScene.add(this.fadeQuad);
   }
   const size=renderer.getDrawingBufferSize(new T.Vector2());
   size.multiplyScalar(Math.min(1,quality.targetWidth/Math.max(size.x,size.y))).floor();
   if(this.fadeTarget.width!==size.x||this.fadeTarget.height!==size.y)this.fadeTarget.setSize(size.x,size.y);
   const autoClear=renderer.autoClear;
   try{
    for(const item of items)item.group.visible=false;
    for(const [alpha,bucket]of buckets){
     for(const item of bucket)item.group.visible=true;
     renderer.autoClear=true;renderer.setRenderTarget(this.fadeTarget);renderer.render(this.scene,this.camera);
     this.fadeMaterial.opacity=alpha;renderer.setRenderTarget(null);renderer.autoClear=false;renderer.render(this.fadeScene,this.fadeCamera);
     for(const item of bucket)item.group.visible=false;
    }
   }finally{renderer.autoClear=autoClear;renderer.setRenderTarget(null);}
  }
  for(const item of items)item.group.visible=true;
 }
 leave(){
  this.active=false;this.preparing=false;++this.token;cancelAnimationFrame(this.frame);cancelAnimationFrame(this.layoutFrame);this.frame=this.layoutFrame=0;
  this.navigating=this.routePending=false;this.hover=null;this.mouse=null;this.focusModel=null;this.root.dataset.moving='false';this.root.classList.remove('rr-webgl');
  for(const item of this.items.values()){this.scene.remove(item.group);disposeCollectionModel(item.model);}this.items.clear();
  this.fadeTarget?.dispose();this.fadeQuad?.geometry.dispose();this.fadeMaterial?.dispose();this.fadeTarget=null;this.fadeScene=null;
 }
}
