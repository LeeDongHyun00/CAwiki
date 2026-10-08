import * as T from 'inside/three';
import { OrbitControls } from 'inside/orbit';
import { acquireStage, resumeCinema } from 'inside/study';
import { createCollectionModel, disposeCollectionModel } from 'inside/collection';
import { FRONT_FACING, DARK_MODELS, HARDWARE_BY_ID, STORIES } from 'inside/data';

const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=t=>1-Math.pow(1-t,5);
const up=new T.Vector3(0,1,0);
function fitDistance(box,direction,aspect,fov=31){
  const right=new T.Vector3().crossVectors(up,direction).normalize(),vertical=new T.Vector3().crossVectors(direction,right).normalize();
  const center=box.getCenter(new T.Vector3()),tanY=Math.tan(fov*Math.PI/360),tanX=tanY*aspect;
  let distance=0;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    const v=new T.Vector3(x,y,z).sub(center);distance=Math.max(distance,Math.max(Math.abs(v.dot(right))/tanX,Math.abs(v.dot(vertical))/tanY)+v.dot(direction));
  }
  return Math.max(3,distance*1.17);
}
function presentation(id,size=6.3){
  const model=createCollectionModel(id),pivot=new T.Group(),scale=new T.Group();pivot.add(scale);scale.add(model.root);
  const bounds=new T.Box3().setFromObject(model.root),center=bounds.getCenter(new T.Vector3()),dims=bounds.getSize(new T.Vector3());
  const ratio=size/Math.max(dims.x,dims.y,dims.z);scale.scale.setScalar(ratio);model.root.position.sub(center);
  const assembled=new T.Box3().setFromObject(pivot);model.explode(1);const expanded=new T.Box3().setFromObject(pivot);model.explode(0);
  return{id,model,pivot,scale,assembled,expanded,centerA:assembled.getCenter(new T.Vector3()),centerB:expanded.getCenter(new T.Vector3())};
}
export class Experience {
  constructor(onStep){
    this.onStep=onStep;this.stage=null;this.mode='home';this.items=[];this.frame=0;this.dirty=true;this.token=0;this.amount=0;this.targetAmount=0;this.paused=false;this.playing=false;this.step=0;
    this.wake=this.wake.bind(this);this.tick=this.tick.bind(this);
    addEventListener('inside:resize',()=>{if(this.mode==='story'&&this.items.length)this.setStep(this.step,true);else if(this.mode==='object')this.reframe(true);this.dirty=true;this.wake();});
    addEventListener('inside:contextloss',()=>{this.lost=true;cancelAnimationFrame(this.frame);this.frame=0;this.stop();});
    addEventListener('inside:contextrestore',()=>{this.lost=false;if(this.stage&&this.mode!=='home'){this.stage.root.visible=false;this.stage.floor.visible=true;this.dirty=true;this.wake();}});
    document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(this.frame);this.frame=0;if(!document.hidden)this.wake();});
    reduced.addEventListener('change',()=>{this.dirty=true;this.wake();});
  }
  clear(){
    this.stop();cancelAnimationFrame(this.frame);this.frame=0;this.controls?.dispose();this.controls=null;
    this.items.forEach(i=>disposeCollectionModel(i.model));this.items=[];
    this.storyData=null;
    this.clearPaths();if(this.group)this.stage?.scene.remove(this.group);this.group=null;
    document.querySelector('#model-labels')?.replaceChildren();
  }
  clearPaths(){
    if(!this.paths)return;
    for(const p of this.paths){p.line.geometry.dispose();p.line.material.dispose();p.dot.geometry.dispose();p.dot.material.dispose();p.line.removeFromParent();p.dot.removeFromParent();}this.paths=[];
  }
  async prepare(mode){
    const token=++this.token;this.clear();this.mode=mode;this.paused=false;this.stage=await acquireStage();
    if(token!==this.token||!this.stage)return false;
    this.lost=false;this.group=new T.Group();this.stage.scene.add(this.group);this.stage.floor.visible=true;
    this.controls=new OrbitControls(this.stage.camera,this.stage.renderer.domElement);this.controls.enablePan=false;this.controls.enableDamping=!reduced.matches;this.controls.dampingFactor=.09;this.controls.zoomSpeed=.65;this.controls.rotateSpeed=.55;this.controls.minDistance=2.4;this.controls.maxDistance=90;
    this.controls.addEventListener('change',()=>{this.dirty=true;if(!this.inFrame)this.wake();});
    this.controls.addEventListener('start',()=>{this.cameraTween=null;this.userMoved=true;document.body.classList.add('manipulated');});
    this.controls.enabled=mode==='object';
    this.stage.renderer.domElement.style.touchAction=mode==='object'?'none':'pan-y';
    return token;
  }
  theme(dark){
    const {scene,floor,key,rim,fill}=this.stage;this.dark=dark;
    scene.background.set(dark?0x101113:0xecece9);scene.fog.color.copy(scene.background);scene.fog.density=.01;
    scene.environmentIntensity=dark?.66:.58;key.intensity=dark?2.3:1.7;rim.intensity=dark?1.8:1.1;fill.intensity=dark?.35:.8;
    floor.material.opacity=dark?0:.3;floor.position.set(0,-3.6,0);floor.visible=this.mode==='object';
    document.documentElement.style.setProperty('--ink',dark?'214,215,216':'45,47,48');
    document.documentElement.style.setProperty('--paper',dark?'#101113':'#ecece9');
  }
  async object(id){
    const token=await this.prepare('object');if(!token)return false;
    this.id=id;this.amount=this.targetAmount=0;this.userMoved=false;
    this.theme(DARK_MODELS.has(id)&&!new URLSearchParams(location.search).has('thumb'));
    const item=presentation(id);this.items=[item];this.group.add(item.pivot);
    this.stage.renderer.domElement.setAttribute('aria-label',`${HARDWARE_BY_ID[id].name} 3D 모델. 드래그로 회전, 휠 또는 두 손가락으로 확대합니다.`);
    this.reframe(true);this.entryTime=performance.now();this.dirty=true;this.wake();
    return token===this.token;
  }
  reframe(instant=false){
    if(!this.stage||!this.items.length)return;
    const camera=this.stage.camera;
    if(this.mode==='object'){
      const i=this.items[0],bounds=this.targetAmount?i.expanded.clone():i.assembled.clone();
      const c=bounds.getCenter(new T.Vector3());bounds.translate(c.negate());
      const direction=this.userMoved?camera.position.clone().sub(this.controls.target).normalize():new T.Vector3(...(this.id==='mouse'?[.9,1.15,-1.5]:FRONT_FACING.has(this.id)?[.7,.38,1.6]:[.75,1.2,1.65])).normalize();
      const distance=fitDistance(bounds,direction,camera.aspect);
      this.moveCamera(direction.multiplyScalar(distance),new T.Vector3(),instant);
    }else this.frameStory(instant);
  }
  moveCamera(position,target,instant=false){
    const {camera}=this.stage;
    if(instant||reduced.matches){camera.position.copy(position);this.controls.target.copy(target);this.controls.update();this.cameraTween=null;}
    else this.cameraTween={from:camera.position.clone(),to:position,targetFrom:this.controls.target.clone(),targetTo:target,start:performance.now()};
    this.dirty=true;this.wake();
  }
  explode(value){if(this.mode!=='object')return;this.targetAmount=value?1:0;this.reframe(false);this.wake();}
  reset(){this.userMoved=false;this.reframe(false);}
  turn(dx,dy){
    if(!this.controls)return;const offset=this.stage.camera.position.clone().sub(this.controls.target),s=new T.Spherical().setFromVector3(offset);
    s.theta+=dx;s.phi=clamp(s.phi+dy,.05,Math.PI-.05);this.stage.camera.position.copy(this.controls.target).add(new T.Vector3().setFromSpherical(s));this.controls.update();this.userMoved=true;this.dirty=true;this.wake();
  }
  zoom(factor){if(!this.controls)return;this.stage.camera.position.sub(this.controls.target).multiplyScalar(factor).add(this.controls.target);this.controls.update();this.userMoved=true;this.dirty=true;this.wake();}
  async story(id,step=0){
    const token=await this.prepare('story');if(!token)return false;this.id=id;this.storyData=STORIES[id];this.theme(false);
    this.items=this.storyData.ids.map((part,i)=>{const item=presentation(part,FRONT_FACING.has(part)?2.7:part==='gpu'?3.0:2.15);this.group.add(item.pivot);item.pivot.position.set((i-(this.storyData.ids.length-1)/2)*3.8,0,(i%2)*-1.4);return item;});
    this.step=clamp(step,0,this.storyData.steps.length-1);this.entryTime=performance.now();this.setStep(this.step,true);this.wake();return token===this.token;
  }
  setStep(index,instant=false){
    if(this.mode!=='story'||!this.storyData)return;
    this.step=clamp(index,0,this.storyData.steps.length-1);this.playPaused=0;this.clearPaths();
    const current=this.storyData.steps[this.step];this.flowStart=performance.now();
    this.layoutStory();
    for(const item of this.items){item.active=current.focus.includes(item.id);item.targetScale=item.active?1:.001;item.pivot.visible=true;if(reduced.matches)item.pivot.scale.setScalar(item.targetScale);}
    const lookup=Object.fromEntries(this.items.map(i=>[i.id,i]));this.paths=[];
    for(const [a,b] of current.edges){
      const start=lookup[a].pivot.position.clone().add(new T.Vector3(0,-.6,.7)),end=lookup[b].pivot.position.clone().add(new T.Vector3(0,-.6,.7));
      const mid=start.clone().lerp(end,.5);mid.y-=.5;mid.z+=.7;
      const curve=new T.CatmullRomCurve3([start,mid,end]),line=new T.Mesh(new T.TubeGeometry(curve,48,.012,6,false),new T.MeshBasicMaterial({color:0xb19774,transparent:true,opacity:.48}));
      const dot=new T.Mesh(new T.SphereGeometry(.065,12,8),new T.MeshBasicMaterial({color:0x9b7441,transparent:true,opacity:1}));this.group.add(line,dot);this.paths.push({curve,line,dot});
    }
    const labels=document.querySelector('#model-labels');labels.replaceChildren();
    this.items.forEach(item=>{const el=document.createElement('button');el.textContent=HARDWARE_BY_ID[item.id].title;el.setAttribute('aria-label',`${HARDWARE_BY_ID[item.id].name} 자세히 보기`);el.onclick=()=>location.hash=`object/${item.id}`;el.hidden=!item.active;labels.append(el);item.label=el;});
    this.onStep?.(this.step,this.storyData);this.frameStory(instant);this.dirty=true;this.wake();
  }
  frameStory(instant){
    this.layoutStory();
    const focus=this.items.filter(i=>i.active),bounds=new T.Box3();focus.forEach(i=>{const scale=i.pivot.scale.x;i.pivot.scale.setScalar(1);bounds.union(new T.Box3().setFromObject(i.pivot));i.pivot.scale.setScalar(scale);});
    const target=bounds.getCenter(new T.Vector3()),direction=new T.Vector3(.2,.58,1.5).normalize();
    const portrait=innerWidth<=600;
    const distance=fitDistance(bounds,direction,this.stage.camera.aspect)*(portrait?1.20:1.04);
    if(portrait)target.y-=distance*Math.tan(this.stage.camera.fov*Math.PI/360)*.16;
    this.moveCamera(target.clone().addScaledVector(direction,distance),target,instant);
  }
  layoutStory(){
    const portrait=innerWidth<=600;
    this.items.forEach((item,i)=>item.pivot.position.set(portrait?(i%2?1.1:-1.1):(i-(this.items.length-1)/2)*3.8,portrait?((this.items.length-1)/2-i)*3.1:0,(i%2)*(portrait?-.6:-1.4)));
  }
  play(){
    if(this.mode!=='story')return;
    if(this.playing){this.stop();this.playPaused=performance.now();this.dirty=true;this.wake();return;}
    const wasPaused=!!this.playPaused;
    if(wasPaused){const elapsed=performance.now()-this.playPaused;this.flowStart+=elapsed;if(this.cameraTween)this.cameraTween.start+=elapsed;this.playPaused=0;}
    this.playing=true;if(this.step===this.storyData.steps.length-1&&!wasPaused)this.setStep(0);
    const advance=()=>{if(!this.playing)return;if(document.hidden||this.paused){this.playTimer=setTimeout(advance,500);return;}if(this.step>=this.storyData.steps.length-1){this.stop();return;}this.setStep(this.step+1);this.playTimer=setTimeout(advance,3800);};
    if(!wasPaused)this.flowStart=performance.now();this.playTimer=setTimeout(advance,3800);this.wake();
  }
  stop(){this.playing=false;this.playPaused=0;clearTimeout(this.playTimer);document.querySelector('#story-play')?.setAttribute('aria-pressed','false');const b=document.querySelector('#story-play');if(b)b.textContent='재생';}
  pause(){this.paused=true;if(this.controls)this.controls.enabled=false;cancelAnimationFrame(this.frame);this.frame=0;}
  resume(){this.paused=false;if(this.controls)this.controls.enabled=this.mode==='object';this.dirty=true;this.wake();}
  home(){++this.token;this.clear();this.mode='home';this.stage?.scene.fog&&(this.stage.scene.fog.density=.019);document.querySelector('#world').style.touchAction='pan-y';resumeCinema();}
  wake(){if(!this.frame&&this.stage&&!this.lost&&!this.paused&&this.mode!=='home'&&!document.hidden)this.frame=requestAnimationFrame(this.tick);}
  tick(time){
    this.frame=0;if(!this.stage||this.lost||this.paused||this.mode==='home'||document.hidden)return;this.inFrame=true;
    const dt=clamp((time-(this.lastTime||time-16))/1000,.001,.06);this.lastTime=time;
    const entering=this.mode==='object'&&!reduced.matches&&(time-this.entryTime)<850;
    let moving=false;
    if(this.mode==='object'){
      moving=Math.abs(this.amount-this.targetAmount)>.0001;this.amount=reduced.matches?this.targetAmount:T.MathUtils.lerp(this.amount,this.targetAmount,1-Math.exp(-5.8*dt));
      const item=this.items[0];item.model.explode(this.amount);item.pivot.position.copy(item.centerA).lerp(item.centerB,this.amount).negate();
      const entry=reduced.matches?1:smooth(clamp((time-this.entryTime)/850));item.pivot.rotation.y=(1-entry)*.16;item.pivot.scale.setScalar(.97+.03*entry);
    }
    if(this.cameraTween){const tween=this.cameraTween,t=reduced.matches?1:smooth(clamp(((this.playPaused||time)-tween.start)/1250));this.stage.camera.position.lerpVectors(tween.from,tween.to,t);this.controls.target.lerpVectors(tween.targetFrom,tween.targetTo,t);if(t>=1)this.cameraTween=null;else if(!this.playPaused)moving=true;}
    this.controls.enableDamping=!reduced.matches;
    this.controls.dampingFactor=1-Math.exp(-8*dt);
    const orbit=this.controls.update();
    let flow=false;
    if(this.mode==='story'){
      for(const item of this.items){const next=reduced.matches?item.targetScale:this.playPaused?item.pivot.scale.x:T.MathUtils.lerp(item.pivot.scale.x,item.targetScale,1-Math.exp(-6*dt));if(!this.playPaused&&Math.abs(next-item.targetScale)>.0001)moving=true;item.pivot.scale.setScalar(next);item.pivot.visible=item.active||next>.025;}
      const t=clamp(((this.playPaused||time)-this.flowStart)/2600);flow=!reduced.matches&&t<1&&!this.playPaused;
      for(const {curve,dot} of this.paths){dot.position.copy(curve.getPoint(reduced.matches?1:t));dot.material.opacity=reduced.matches?.8:1-rangeFade(t);}
      for(const item of this.items){if(!item.label)continue;const pos=item.pivot.position.clone().add(new T.Vector3(0,-1.55,0)).project(this.stage.camera);item.label.style.left=`${(pos.x*.5+.5)*innerWidth}px`;item.label.style.top=`${(-pos.y*.5+.5)*innerHeight}px`;item.label.hidden=!item.active||Math.abs(pos.x)>.95||pos.y<-.7||pos.y>.8||pos.z>1;}
    }
    if(this.dirty||moving||entering||orbit||flow){this.stage.renderer.shadowMap.needsUpdate=true;this.stage.renderer.render(this.stage.scene,this.stage.camera);this.dirty=false;}
    this.inFrame=false;if(moving||entering||orbit||flow)this.wake();
  }
}
function rangeFade(t){return clamp((t-.85)/.15);}
