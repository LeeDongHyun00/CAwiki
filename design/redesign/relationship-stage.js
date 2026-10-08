import * as T from '../../lib/vendor/three/three.module.js';
import { acquireStage } from './study.js';
import { createCollectionModel, disposeCollectionModel } from './collection-models.js';
import { FRONT_FACING } from './site-data.js';

const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const ease=t=>1-Math.pow(1-t,4);
// One shared renderer, with DOM anchors as the authoritative responsive layout.
export class RelationshipStage {
 constructor(root){
  this.root=root;this.items=new Map();this.token=0;this.frame=0;this.active=false;this.pointer={x:0,y:0};
  this.tick=this.tick.bind(this);
  this.resize=new ResizeObserver(()=>this.layout(true));this.resize.observe(root);
  addEventListener('resize',()=>this.layout(true));addEventListener('scroll',()=>this.layout(true),{passive:true});
  root.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||reduced.matches)return;this.hover=e.target.closest('[data-model]')?.dataset.model||e.target.closest('.rr-exhibit[data-node]')?.dataset.node;this.pointer={x:(e.clientX/innerWidth-.5)*.045,y:(e.clientY/innerHeight-.5)*.025};this.layout(false);});
  root.addEventListener('pointerleave',()=>{this.hover=null;this.pointer={x:0,y:0};this.layout(false);});
  root.addEventListener('focusin',e=>{this.hover=e.target.closest('[data-model]')?.dataset.model||e.target.closest('.rr-exhibit[data-node]')?.dataset.node;this.layout(false);});
  reduced.addEventListener('change',()=>{this.pointer={x:0,y:0};this.layout(true);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(this.frame);this.frame=0;}else this.layout(true);});
  addEventListener('inside:contextloss',()=>{this.lost=true;cancelAnimationFrame(this.frame);this.frame=0;root.classList.remove('rr-webgl');});
  addEventListener('inside:contextrestore',()=>{this.lost=false;if(this.active&&this.stage){this.scene.environment=this.stage.environment.texture;root.classList.add('rr-webgl');this.layout(true);}});
 }
 async enter(){
  this.active=true;const token=++this.token;
  try{
   const stage=await acquireStage();if(token!==this.token||!this.active)return;
   if(!stage){this.root.classList.remove('rr-webgl');return;}
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
   this.root.classList.add('rr-webgl');this.layout(false);
  }catch(error){console.warn('Relationship models unavailable',error);this.root.classList.remove('rr-webgl');}
 }
 make(id){
  const model=createCollectionModel(id);model.explode(0);
  const cloned=new Map();
  model.root.traverse(o=>{if(!o.material)return;const clone=m=>{if(!m.userData.persistent)return m;if(!cloned.has(m)){const c=m.clone();c.userData={...m.userData,persistent:false};cloned.set(m,c);}return cloned.get(m);};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);});
  const box=new T.Box3().setFromObject(model.root);model.root.position.sub(box.getCenter(new T.Vector3()));
  const pivot=new T.Group(),group=new T.Group();pivot.add(model.root);group.add(pivot);
  const direction=new T.Vector3(...(id==='mouse'?[.9,1.15,-1.5]:FRONT_FACING.has(id)?[.7,.38,1.6]:[.75,1.2,1.65]));
  pivot.quaternion.setFromRotationMatrix(new T.Matrix4().lookAt(direction,new T.Vector3(),new T.Vector3(0,1,0))).invert();
  const bounds=new T.Box3().setFromObject(group);pivot.position.sub(bounds.getCenter(new T.Vector3()));
  const size=bounds.getSize(new T.Vector3()),materials=new Map();
  model.root.traverse(o=>{for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])if(!materials.has(m))materials.set(m,{opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite});});
  const item={id,model,group,size,materials,current:null,to:null};this.scene.add(group);this.items.set(id,item);return item;
 }
 layout(instant=false){
  if(!this.active||!this.stage||this.lost||document.hidden)return;
  const aspect=innerWidth/innerHeight;this.camera.left=-5*aspect;this.camera.right=5*aspect;this.camera.updateProjectionMatrix();
  const selected=new Set();const unit=10/innerHeight;
  for(const el of this.root.querySelectorAll('[data-model]')){
   if(!el.getClientRects().length)continue;
   const r=el.getBoundingClientRect(),id=el.dataset.model;if(r.width===0||r.height===0||selected.has(id))continue;
   selected.add(id);let item=this.items.get(id);
   try{item||=this.make(id);}catch(error){console.warn('Relationship model',id,error);continue;}
   const hovered=this.hover===id;
   const to={x:(r.x+r.width/2-innerWidth/2)*unit,y:(innerHeight/2-r.y-r.height/2)*unit+(hovered?.055:0),scale:Math.min(r.width*unit/item.size.x,r.height*unit/item.size.y)*.87*(hovered?1.025:1),opacity:1,rx:this.pointer.y,ry:this.pointer.x};
   if(!item.current)item.current={...to,scale:to.scale*.97,opacity:0};
   this.target(item,to,instant);
  }
  for(const item of this.items.values())if(!selected.has(item.id))this.target(item,{...item.current,opacity:0},instant);
  this.wake();
 }
 target(item,to,instant){
  if(item.to&&Object.keys(to).every(k=>Math.abs(to[k]-item.to[k])<.00001))return;
  item.from={...item.current};item.to=to;item.start=performance.now();item.duration=instant||reduced.matches?0:760;
 }
 wake(){if(!this.frame&&this.active&&!document.hidden&&!this.lost)this.frame=requestAnimationFrame(this.tick);}
 tick(now){
  this.frame=0;if(!this.active||this.lost)return;let moving=false;
  for(const [id,item] of this.items){
   const t=item.duration?Math.min(1,(now-item.start)/item.duration):1,q=ease(t);
   for(const k of Object.keys(item.to))item.current[k]=item.from[k]+(item.to[k]-item.from[k])*q;
   const v=item.current;item.group.position.set(v.x,v.y,0);item.group.scale.setScalar(v.scale);item.group.rotation.set(v.rx,v.ry,0);
   for(const [m,base] of item.materials){const fade=v.opacity<.999;m.opacity=base.opacity*v.opacity;if(m.transparent!==(base.transparent||fade)){m.transparent=base.transparent||fade;m.needsUpdate=true;}m.depthWrite=base.depthWrite&&!fade;}
   if(t<1)moving=true;
   else if(v.opacity<.001){this.scene.remove(item.group);disposeCollectionModel(item.model);this.items.delete(id);}
  }
  this.stage.renderer.render(this.scene,this.camera);if(moving)this.wake();
 }
 leave(){
  this.active=false;++this.token;cancelAnimationFrame(this.frame);this.frame=0;this.root.classList.remove('rr-webgl');
  for(const item of this.items.values()){this.scene.remove(item.group);disposeCollectionModel(item.model);}this.items.clear();
 }
}
