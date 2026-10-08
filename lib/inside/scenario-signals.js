// Functional overlays follow real model transforms. Tiles and core regions are
// teaching diagrams, never a claim about a manufacturer's physical floorplan.
import * as T from 'inside/three';
import { createModelKit } from 'inside/collection';
import { ScenarioFrames } from 'inside/scenario-frames';
const clamp=x=>T.MathUtils.clamp(x,0,1),mix=T.MathUtils.lerp;
const ease=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10);};
const MINT=0x9bcab7,GOLD=0xd6bb83,BLUE=0x8ca9c9,DIM=0x29433d;
const COLORS=[MINT,GOLD,BLUE],UP=new T.Vector3(0,1,0);
const v=a=>new T.Vector3(...a);

class Instances {
 constructor(parent,name,geometry,capacity){
  this.capacity=capacity;this.alpha=new T.InstancedBufferAttribute(new Float32Array(capacity),1);geometry.setAttribute('signalAlpha',this.alpha);
  const material=new T.MeshBasicMaterial({color:0xffffff,transparent:true,depthWrite:false,toneMapped:false});
  material.onBeforeCompile=s=>{
   s.vertexShader='attribute float signalAlpha; varying float vSignalAlpha;\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSignalAlpha=signalAlpha;');
   s.fragmentShader='varying float vSignalAlpha;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );','vec4 diffuseColor = vec4( diffuse, opacity * vSignalAlpha );');
  };
  this.mesh=new T.InstancedMesh(geometry,material,capacity);this.mesh.name=name;this.mesh.frustumCulled=false;this.mesh.renderOrder=4;
  this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.object=new T.Object3D();parent.add(this.mesh);this.reset();
 }
 reset(){this.used=0;this.mesh.count=0;}
 add(position,size,color,alpha=1,quaternion=null){
  if(alpha<.004||this.used>=this.capacity)return;
  const o=this.object;o.position.copy(position);o.scale.copy(size);o.quaternion.copy(quaternion||new T.Quaternion());o.updateMatrix();
  this.mesh.setMatrixAt(this.used,o.matrix);this.mesh.setColorAt(this.used,new T.Color(color));this.alpha.setX(this.used,alpha);this.used++;
 }
 flush(){this.mesh.count=this.used;this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;this.alpha.needsUpdate=true;}
}

export class ScenarioSignals {
 constructor(scene){
  this.root=new T.Group();this.root.name='scenario functional motion';scene.add(this.root);this.root.visible=false;
  this.cells=new Instances(this.root,'active component regions',new T.BoxGeometry(1,1,1),256);
  this.packets=new Instances(this.root,'moving data and tasks',new T.BoxGeometry(1,1,1),128);
  this.rings=new Instances(this.root,'component contact rings',new T.TorusGeometry(1,.027,8,48),24);
  this.frames=new ScenarioFrames(this.root);
  this.linePositions=new Float32Array(4096*3);this.lineColors=new Float32Array(4096*3);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(this.linePositions,3));g.setAttribute('color',new T.BufferAttribute(this.lineColors,3));
  this.lines=new T.LineSegments(g,new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.66,depthWrite:false}));this.lines.frustumCulled=false;this.root.add(this.lines);
  this.styles=new Map();this.clones=[];this.bindings=[];this.lastCues='';
  this.hud=document.createElement('div');this.hud.id='story-cues';this.hud.setAttribute('aria-hidden','true');document.querySelector('.scenario-ui').append(this.hud);
  this.cues=Array.from({length:3},()=>{const el=document.createElement('div');el.className='scenario-cue';el.innerHTML='<i class="cue-pulse"></i><i class="cue-dot"></i><span></span>';this.hud.append(el);return el;});
 }
 model(id){return id==='display'?this.f.monitor:this.f.computer.parts[id]?.model||this.f.extras[id];}
 node(id,part=null){const root=this.model(id)?.root;return part?root?.getObjectByName(part)||root:root;}
 world(node,point){return node.localToWorld(v(point));}
 anchor(id,region='center'){
  const root=this.node(id);if(!root)return new T.Vector3();
  if(id==='cpu')return this.world(this.node(id,'silicon'),region==='left'?[-2.6,1.7,-5]:region==='right'?[2.6,1.7,5]:[0,1.7,0]);
  if(['gpu','serverGpu','remoteGpu'].includes(id))return this.world(this.node(id,'graphics board'),region==='memory'?[-42,-10.2,24]:[-40,-10.05,0]);
  if(id==='ssd')return this.world(this.node(id,'컨트롤러 · NAND'),region==='nand'?[-14,2,0]:[23,2,0]);
  if(id==='dram')return this.world(this.f.computer.ram2.root,[0,-3,-1]);
  if(id==='remoteMemory')return this.world(root,[0,3,-1]);
  if(id==='io')return this.world(this.node(id,'USB · Ethernet · audio'),[-13,21,-33]);
  if(id==='nic')return this.world(this.node(id,'이더넷 컨트롤러'),[-19,3.2,0]);
  if(id==='input')return this.world(root,region==='ctrl'?[-150,23,54]:region==='s'?[-122,23,4]:[28,23,4]);
  if(id==='mouse')return this.world(root,[-18,22,-32]);
  if(id==='camera')return this.world(root,region==='mic'?[-32,29,17]:[0,29,27]);
  if(id==='audio')return this.world(root,region==='dac'?[-19,76,24]:region==='amp'?[17,76,24]:[0,64,72]);
  if(id==='display'||id==='remote')return this.world(root,[0,205,11]);
  if(id==='datacenter')return this.world(root,[0,483,300]);
  if(id==='power')return this.world(root,[0,46,0]);
  if(id==='usb')return this.world(this.f.extras.usb.hub,[0,0,0]);
  return root.getWorldPosition(new T.Vector3());
 }
 prepare(f){
  this.reset();this.f=f;if(!f.config.extended)return;
  const audio=f.extras.audio;
  if(audio&&!audio.signalCircuit){
   const k=createModelKit(),b=k.part('DAC and amplifier concept board');k.board(b,72,60,0,0,0,'#183c34');
   for(const [x,w,d] of [[-19,16,18],[17,22,24]]){k.box(b,w,3,d,x,2,0,'black',.5);k.pins(b,9,x-w/2,1.4,-d/2-1,w/9,3,.45);k.pins(b,9,x-w/2,1.4,d/2+1,w/9,3,.45);}
   for(const x of [-28,-12,4,20,30])k.cyl(b,2.2,6,x,3,23,'silver');
   for(const x of [-27,-15,5,17])k.box(b,2,1,4,x,1.3,-23,'ceramic');
   k.root.position.set(0,76,20);k.root.rotation.x=Math.PI/2;audio.root.add(k.root);audio.signalCircuit=k.root;k.root.visible=false;
  }
  // Borrowed motherboard materials must not tint the main film or other objects.
  for(const id of [...Object.keys(f.computer.parts),'display',...Object.keys(f.extras)]){
   const model=this.model(id);if(!model)continue;const clone=!!f.computer.parts[id],cache=new Map(),set=new Set();
   model.root.traverse(o=>{
    if(!o.isMesh)return;const old=o.material,materials=Array.isArray(old)?old:[old];
    const next=materials.map(m=>{if(!clone){set.add(m);return m;}if(!cache.has(m)){const c=m.clone();cache.set(m,c);this.clones.push(c);}const c=cache.get(m);set.add(c);return c;});
    if(clone){this.bindings.push({mesh:o,material:old});o.material=Array.isArray(old)?next:next[0];}
   });
   this.styles.set(id,[...set].map(m=>({m,color:m.color?.clone(),emissive:m.emissive?.clone(),intensity:m.emissiveIntensity,opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite})));
  }
 }
 restoreColors(){for(const entries of this.styles.values())for(const s of entries){if(s.color)s.m.color.copy(s.color);if(s.emissive&&s.emissive.getHex()===0){s.m.emissive.copy(s.emissive);s.m.emissiveIntensity=s.intensity;}}}
 reset(){
  this.restoreColors();for(const {mesh,material} of this.bindings)mesh.material=material;this.clones.forEach(m=>m.dispose());this.bindings=[];this.clones=[];this.styles.clear();
  this.root.visible=false;this.hud.hidden=true;
  if(this.f?.extras.audio?.signalCircuit)this.f.extras.audio.signalCircuit.visible=false;
 }
 tint(id,amount,color=MINT){for(const s of this.styles.get(id)||[]){if(s.color)s.m.color.lerp(new T.Color(color),amount*.18);if(s.emissive&&s.emissive.getHex()===0){s.m.emissive.lerp(new T.Color(color),amount*.34);s.m.emissiveIntensity=.28;}}}
 ghost(node,amount){node?.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.opacity*=1-.88*amount;m.transparent=true;m.depthWrite=false;}});}
 localBox(node,point,size,color,alpha=1,packet=false){
  const scale=node.getWorldScale(new T.Vector3()).multiply(v(size)),q=node.getWorldQuaternion(new T.Quaternion());
  (packet?this.packets:this.cells).add(this.world(node,point),scale,color,alpha,q);
 }
 line(a,b,color=MINT,alpha=1){
  if(this.lineCount+2>4096||alpha<.005)return;const c=new T.Color(color).multiplyScalar(alpha);
  a.toArray(this.linePositions,this.lineCount*3);c.toArray(this.lineColors,this.lineCount*3);this.lineCount++;
  b.toArray(this.linePositions,this.lineCount*3);c.toArray(this.lineColors,this.lineCount*3);this.lineCount++;
 }
 link(a,b,t,{alpha=1,color=MINT,count=4,command=false,arc=.28}={}){
  const mid=a.clone().lerp(b,.5).addScaledVector(UP,arc),curve=new T.QuadraticBezierCurve3(a,mid,b);
  for(let j=0;j<28;j++)this.line(curve.getPoint(j/28),curve.getPoint((j+1)/28),color,alpha*.6);
  for(let j=0;j<count;j++){
   const u=clamp(t*(1+count*.17)-j*.17),fade=ease(u/.1)*(1-ease((u-.91)/.09))*alpha;
   const p=curve.getPoint(u),q=this.f.camera.quaternion;
   if(command)this.rings.add(p,new T.Vector3(.065,.065,.065),color,fade,q);
   else this.packets.add(p,new T.Vector3(.065,.036,.095),color,fade,q);
  }
 }
 flow(step,t,alpha){
  if(!step.flow)return;const [a,b]=step.flow.split('>');if(!this.model(a)||!this.model(b))return;
  const source=this.anchor(a),target=this.anchor(b),command=step.kind==='command';
  if(step.kind==='frame'){
   const mid=source.clone().lerp(target,.5).addScaledVector(UP,.6),curve=new T.QuadraticBezierCurve3(source,mid,target);
   for(let j=0;j<28;j++)this.line(curve.getPoint(j/28),curve.getPoint((j+1)/28),MINT,alpha*.4);
   for(let j=0;j<3;j++){const u=clamp(t*1.5-j*.24),opacity=ease(u/.12)*(1-ease((u-.9)/.1))*alpha;this.frames.add(curve.getPoint(u),.40,.225,this.f.camera.quaternion,opacity);}
  }else this.link(source,target,t,{alpha,color:command?GOLD:MINT,command,count:command?2:5,arc:source.distanceTo(target)>6?.7:.22});
 }
 reveal(step,weight){
  if(weight<.001)return;const mode=step.visual.mode,id=step.target,model=this.model(id);
  if(['compute','tasks'].includes(mode)){
   const r=this.f.computer.parts.cpu.model;r.explode(.84*weight);r.root.getObjectByName('heatspreader').position.x=-45*weight;
  }
  if(mode==='storage'){
   model.explode(.7*weight);model.root.getObjectByName('제품 라벨').position.x=-70*weight;
  }
  if(mode==='graphics'||(mode==='server'&&id==='serverGpu')){
   model.explode(.62*weight);model.root.getObjectByName('heat sink').position.z=-130*weight;model.root.getObjectByName('frame and fans').position.z=-205*weight;
  }
 }
 update(p,step,local){
  const f=this.f,index=f.config.steps.indexOf(step),next=f.config.steps[index+1],travel=matchMedia('(prefers-reduced-motion: reduce)').matches?0:ease((local-.55)/.45);
  this.root.visible=true;this.hud.hidden=false;this.cells.reset();this.packets.reset();this.rings.reset();this.lineCount=0;this.restoreColors();
  this.frames.begin(f.id,p*2.7);
  // Reset opacity on borrowed materials; peripheral fading is owned by the film.
  for(const [id,list] of this.styles)if(f.computer.parts[id])for(const s of list){s.m.opacity=s.opacity;s.m.transparent=s.transparent;s.m.depthWrite=s.depthWrite;}
  const weights=new Map();for(const [s,w] of [[step,1-travel],[next,travel]])if(s){const key=s.target+':'+s.visual.mode;const entry=weights.get(key);if(entry)entry.weight+=w;else weights.set(key,{step:s,weight:w});}
  for(const entry of weights.values())this.reveal(entry.step,entry.weight);
  f.scene.updateMatrixWorld(true);
  if(f.extras.audio?.signalCircuit)f.extras.audio.signalCircuit.visible=false;
  this.render(step,ease(local/.62),1-travel,p);
  if(next&&travel>0)this.render(next,0,travel,p);
  this.cells.flush();this.packets.flush();this.rings.flush();this.frames.flush();this.lines.geometry.setDrawRange(0,this.lineCount);this.lines.geometry.attributes.position.needsUpdate=true;this.lines.geometry.attributes.color.needsUpdate=true;
  this.paintCues(step,local,1-travel*.8);
 }
 render(step,t,alpha,p){
  if(alpha<.003)return;const {mode}=step.visual,e=step.effect,id=step.target;
  this.tint(id,alpha*(.45+.3*Math.sin(t*Math.PI)),step.kind==='command'?GOLD:MINT);this.flow(step,t,alpha);
  if(mode==='input'){
   const ids=e==='save-keys'?['ctrl','s']:['center'];for(const region of ids){const a=this.anchor(id,region);this.rings.add(a,new T.Vector3(.15+t*.10,.15+t*.10,.15),GOLD,alpha*(.9-.5*t),this.f.camera.quaternion);}
  }else if(mode==='port'){
   const usb=this.f.extras.usb,port=this.anchor(id==='usb'?'usb':'io');this.rings.add(port,new T.Vector3(.14,.14,.14),GOLD,alpha,this.f.camera.quaternion);
   if(usb&&e!=='insert'){const plug=usb.plug.getWorldPosition(new T.Vector3()),host=this.anchor('io');this.link(e==='descriptor'?plug:host,e==='descriptor'?host:plug,t,{alpha,color:e==='descriptor'?MINT:GOLD,command:e!=='descriptor',count:e==='descriptor'?3:2});}
   for(let j=0;j<4;j++){const pos=port.clone().add(new T.Vector3(j*.09-.13,.10,0));this.packets.add(pos,new T.Vector3(.045,.06,.03),j/4<=t?MINT:DIM,alpha,this.f.camera.quaternion);}
  }else if(mode==='compute'||mode==='tasks')this.cpu(step,t,alpha);
  else if(mode==='memory')this.memory(step,t,alpha);
  else if(mode==='storage')this.storage(step,t,alpha);
  else if(mode==='graphics')this.graphics(step,t,alpha);
  else if(mode==='audio')this.audio(step,t,alpha,p);
  else if(mode==='capture')this.capture(step,t,alpha);
  else if(mode==='network'){
   const a=this.anchor('nic'),root=this.node('nic'),b=this.world(root,[35,10,-32]);
   this.link(e==='send'?a:b,e==='send'?b:a,t,{alpha,count:5});this.rings.add(b,new T.Vector3(.14,.14,.14),MINT,alpha,this.f.camera.quaternion);
  }else if(mode==='server'){
   if(id==='datacenter'){
    const root=this.node(id);for(let j=0;j<6;j++)this.localBox(root,[-197+j*79,483,286],[54,62,2],j/6<t?MINT:DIM,alpha*.65);
   }else this.graphics(step,t,alpha);
  }else if(mode==='power'){
   const a=this.anchor('power'),b=this.anchor('dram');this.tint('dram',1);this.link(a,b,t,{alpha,color:GOLD,command:true,count:3});this.memory({...step,effect:'retain',target:'dram'},t,alpha);
  }else if(mode==='screen')this.screen(step,t,alpha);
 }
 cpu(step,t,alpha){
  const e=step.effect,n=this.node('cpu','silicon');
  const tasks=step.visual.mode==='tasks';const parked=this.world(n,[20,4,6]);
  for(let i=0;i<4;i++){
   const x=i%2?-2.6:2.6,z=i<2?-5.5:5.5;
   let on=tasks?(e==='parallel'?i<2:i===Math.min(3,Math.floor(t*4))):i<=Math.floor(t*4);
   if(e==='waiting')on=i===0||i===2;if(e==='quiesce')on=i/4>t;
   const color=tasks?COLORS[(i+Math.floor(t*2))%3]:MINT;
   this.localBox(n,[x,1.62,z],[4.3,.25,8.4],on?color:DIM,alpha*(on?.72:.3));
   const a=this.world(n,[-16+i*2,2.1,-12]),b=this.world(n,[x,2.1,z]);
   if(e==='waiting'&&i===1)this.link(a,parked,t,{alpha,color:GOLD,count:1,arc:.1});
   else this.link(a,b,clamp(t+(e==='parallel'?0:-i*.15)),{alpha,color,count:tasks?1:2,arc:.10});
  }
  if(e==='context'||e==='resume-thread'){
   const core=this.world(n,[2.6,2,5.5]);this.packets.add(parked,new T.Vector3(.14,.045,.20),GOLD,alpha*.65,n.getWorldQuaternion(new T.Quaternion()));
   this.link(e==='context'?core:parked,e==='context'?parked:core,t,{alpha,color:GOLD,count:1,arc:.11});
   // A retained execution-position mark stays with the same task when it resumes.
   this.localBox(n,[18+t*3,5,6],[.8,.5,6],GOLD,alpha);
  }
  if(e==='pcm'||e==='unpack'||e==='ime'){
   const base=this.world(n,[0,2,15]);for(let j=0;j<12;j++){const phase=clamp((t-j*.025)*1.6);const p=base.clone().add(new T.Vector3((j-5.5)*.035*phase,.025+Math.sin(j*.7)*.035*phase,j*.012));this.packets.add(p,new T.Vector3(.025,.025+phase*.07,.028),MINT,alpha*phase,this.f.camera.quaternion);}
  }
 }
 memory(step,t,alpha){
  const e=step.effect,n=this.node(step.target==='remoteMemory'?'remoteMemory':'dram');let fill=t;
  if(e==='buffer-low')fill=1-t;if(e==='buffer-refill')fill=.04+.96*t;if(e==='retain')fill=.8;
  if(e==='audio-buffer')fill=.78-.38*t;if(e==='spaces')fill=1;if(e==='page-fault')fill=t>.48?(t-.48)/.52:0;
  if(e==='mux'||e==='capture-clock'||e==='record-audio')fill=.6;
  for(let j=0;j<8;j++){
   const active=(j+.2)/8<=fill,color=e==='spaces'?COLORS[Math.floor(j/3)%3]:e==='page-fault'&&!active?GOLD:MINT;
   for(const module of (step.target==='remoteMemory'?[n]:[n,this.f.computer.ram2.root]))for(const side of [-1,1])this.localBox(module,[-56+j*16,side*2.7,-1],[10.8,.32,12],active?color:DIM,alpha*(active?.82:.38));
   if(active){const start=this.world(n,[-62+j*16,-5,-12]),end=this.world(n,[-56+j*16,-4,-1]);this.link(start,end,t,{alpha:alpha*.65,count:1,arc:.07});}
  }
  if(['mux','capture-clock','record-audio'].includes(e)){
   const center=this.anchor('dram'),left=center.clone().add(new T.Vector3(-.5,.25,-.35)),right=center.clone().add(new T.Vector3(.5,.25,-.35));
   this.link(left,center,t,{alpha,color:MINT,count:4,arc:.1});this.link(right,center,t,{alpha,color:GOLD,count:4,arc:.1});
  }
  if(e==='jitter'){
   const center=this.anchor('remoteMemory');for(let j=0;j<7;j++){const uneven=[0,.08,.32,.34,.58,.61,.95][j],x=mix(uneven,j/7,t);this.packets.add(center.clone().add(new T.Vector3((x-.5)*1.7,.55,.20)),new T.Vector3(.12,.08,.04),j%2?BLUE:MINT,alpha,this.f.camera.quaternion);}
  }
  if(e==='retain')this.tint('dram',alpha);
 }
 storage(step,t,alpha){
  const e=step.effect,n=this.node('ssd','컨트롤러 · NAND'),reading=['files','music-file','assets'].includes(e),controller=this.anchor('ssd');
  this.localBox(n,[23,1.8,0],[9.5,.25,11.4],GOLD,alpha*.76);
  for(let chip=0;chip<2;chip++)for(let row=0;row<4;row++)for(let col=0;col<4;col++){
   const j=chip*16+row*4+col,filled=e==='flush'?j/32<t:e==='write-transfer'?j/32<t*.75:reading?j/32>t:j/32<t;
   this.localBox(n,[-23+chip*18-5.1+col*3.4,2.08,-6+row*4],[2.85,.20,3.35],filled?MINT:DIM,alpha*(filled?.85:.32));
  }
  for(const x of [-23,-5]){
   const nand=this.world(n,[x,2.25,0]);this.link(reading?nand:controller,reading?controller:nand,t,{alpha,count:3,arc:.10});
  }
 }
 graphics(step,t,alpha){
  const e=step.effect,id=step.target,n=this.node(id,'graphics board');
  const encode=e==='encode',capture=e==='capture-frame',weights=e==='weights'||e==='upload';
  for(let y=0;y<4;y++)for(let x=0;x<4;x++){
   const active=e==='matrix'?x===Math.min(3,Math.floor(t*4))||y===Math.min(3,Math.floor(t*4)):(x+y*4)/16<=t;
   this.localBox(n,[-46+x*4,-9.98,-6+y*4],[3.25,.24,3.25],active?MINT:DIM,alpha*(active?.85:.28));
  }
  for(let j=0;j<12;j++)this.localBox(n,[-76+(j%6)*17,-10.42,j<6?-24:24],[12.1,.22,9.1],(j+.5)/12<t?BLUE:DIM,alpha*(weights?.85:.26));
  const center=this.anchor(id),base=center.clone().add(new T.Vector3(.1,.3,.58));
  if(e==='jitter'){
   for(let j=0;j<7;j++){const uneven=[0,.08,.32,.34,.58,.61,.95][j],x=mix(uneven,j/7,t);this.packets.add(base.clone().add(new T.Vector3(x-.5,.10,0)),new T.Vector3(.08,.06,.06),j%2?BLUE:MINT,alpha,this.f.camera.quaternion);}return;
  }
  if(e==='tokens'||e==='next-token'){
   for(let j=0;j<5;j++){const visible=e==='tokens'?1:clamp(t*5-j);this.packets.add(base.clone().add(new T.Vector3(j*.14-.28,.10,0)),new T.Vector3(.10,.07,.13),j===4?GOLD:MINT,alpha*visible,this.f.camera.quaternion);}return;
  }
  if(weights){
   if(e==='upload'){
    const at=this.anchor(id,'memory'),q=this.f.camera.quaternion,right=new T.Vector3(1,0,0).applyQuaternion(q);
    for(let j=0;j<3;j++)this.frames.add(at.clone().addScaledVector(right,(j-1)*.33).add(new T.Vector3(0,.22+.18*(1-t),0)),.29,.233,q,alpha*ease(t*2-j*.2),[j*.32,.30,.28,.40]);
   }
   return;
  }
  if(e==='matrix'){
   // Model inference is arithmetic on weights and tokens, not a video frame.
   this.link(this.anchor(id,'memory'),center,t,{alpha,color:BLUE,count:4,arc:.28});return;
  }
  const q=this.f.camera.quaternion,right=new T.Vector3(1,0,0).applyQuaternion(q),up=new T.Vector3(0,1,0).applyQuaternion(q);
  const origin=this.frameCenter(id),w=1.38,h=w*9/16,compressed=origin.clone().addScaledVector(right,.92);
  if(e==='drain'){
   for(let j=0;j<3;j++){
    const u=clamp(t*1.6-j*.28),at=origin.clone().addScaledVector(right,j*.13+.6*u).addScaledVector(up,-j*.09);
    this.frames.add(at,w,h,q,alpha*(1-ease((u-.6)/.4))*(1-j*.16));
   }
  }else{
   if(capture)this.frames.add(origin.clone().addScaledVector(right,-.36),w,h,q,alpha*.34);
   if(encode)this.frames.add(origin.clone().addScaledVector(right,-.35),w*.76,h*.76,q,alpha*ease((t-.4)/.4));
   for(let y=0;y<4;y++)for(let x=0;x<6;x++){
    const j=y*6+x,dx=(x-2.5)*w/6,dy=(1.5-y)*h/4;
    const gap=encode?Math.sin(t*Math.PI)*.22:(1-t)*.25;
    const at=origin.clone().addScaledVector(right,dx*(1+gap)).addScaledVector(up,dy*(1+gap));
    let opacity=1,size=1;
    if(encode){const u=ease((t-.22-j*.003)/.64);at.lerp(compressed,u);size=mix(1,.16,u);opacity=1-ease((u-.65)/.35);}
    else if(capture){at.addScaledVector(right,mix(-.36,.34,t));opacity=ease(t*3-j*.025);}
    else if(['first-frame','pixels'].includes(e))opacity=ease(t*1.7-j/28);
    else opacity=.22+.78*ease(t*2-j*.015);
    this.frames.add(at,w/6*size,h/4*size,q,alpha*opacity,[x/6,1-(y+1)/4,1/6,1/4]);
   }
  }
  if(encode||e==='decode'){
   const at=encode?compressed:origin.clone().addScaledVector(right,-.95),strength=encode?ease((t-.45)/.4):1-ease(t/.65);
   for(let j=0;j<4;j++){
    const pos=at.clone().addScaledVector(up,(j-1.5)*.065);
    this.packets.add(pos,new T.Vector3(.25,.036,.022),j%2?GOLD:MINT,alpha*strength,q);
    this.line(pos.clone().addScaledVector(right,-.08),pos.clone().addScaledVector(right,.08),DIM,alpha*strength);
   }
  }
  if(encode){
   const end=compressed.clone().addScaledVector(right,-.19),start=origin.clone().addScaledVector(right,.24),opacity=alpha*ease((t-.4)/.4);
   this.line(start,end,GOLD,opacity);for(const sign of [-1,1])this.line(end,end.clone().addScaledVector(right,-.07).addScaledVector(up,sign*.04),GOLD,opacity);
  }
  const bottom=origin.clone().addScaledVector(up,-h*.5-.05);this.line(center,bottom,MINT,alpha*.35);
  if(e==='av-sync'){
   const start=bottom.clone().addScaledVector(right,-.62),end=bottom.clone().addScaledVector(right,.62);this.line(start,end,GOLD,alpha*.6);
   for(let j=0;j<28;j++){
    const at=start.clone().lerp(end,j/27),height=.025+.075*Math.abs(Math.sin(j*.8+t*8));
    this.line(at.clone().addScaledVector(up,-height),at.clone().addScaledVector(up,height),GOLD,alpha);
   }
   const at=start.clone().lerp(end,t);this.line(at.clone().addScaledVector(up,-.14),at.clone().addScaledVector(up,.14),MINT,alpha);
  }
 }
 frameCenter(id){return this.anchor(id).add(new T.Vector3(.13,.86,.14).applyQuaternion(this.f.camera.quaternion));}

 audio(step,t,alpha,p){
  const e=step.effect,audio=this.f.extras.audio,n=audio.root,inside=e==='dac'||e==='amplify';
  if(inside){
   audio.signalCircuit.visible=true;for(const name of ['인클로저','드라이버','배플'])this.ghost(n.getObjectByName(name),alpha*.96);
   const board=audio.signalCircuit;this.localBox(board,[e==='dac'?-19:17,3.7,0],[e==='dac'?15:21,.3,e==='dac'?17:23],GOLD,alpha*.8);
  }
  const start=this.anchor('audio',e==='dac'?'dac':e==='amplify'?'amp':'center');
  if(inside){const a=this.anchor('audio','dac'),b=this.anchor('audio','amp');this.link(a,b,t,{alpha,color:GOLD,count:3,arc:.06});}
  const gain=e==='amplify'?mix(.08,.30,t):e==='dac'?.11:.20;
  for(let j=0;j<96;j++){
   const a=start.clone().add(new T.Vector3((j/95)*3-.15,Math.sin(j*.28+t*18)*gain,.22));
   if(j)this.line(previous,a,MINT,alpha*.75);var previous=a;
  }
  if(e==='speaker')for(let j=0;j<3;j++){
   const q=clamp(t*1.7-j*.28),position=start.clone().add(new T.Vector3(0,0,q*1.1));
   this.rings.add(position,new T.Vector3(.6+q*.6,.6+q*.6,.6+q*.6),MINT,alpha*(1-q)*.36,n.getWorldQuaternion(new T.Quaternion()));
  }
 }
 capture(step,t,alpha){
  const mic=step.effect==='mic',a=this.anchor('camera',mic?'mic':'center');this.rings.add(a,new T.Vector3(.13,.13,.13),mic?GOLD:MINT,alpha,this.f.camera.quaternion);
  if(!mic){
   const q=this.f.camera.quaternion,right=new T.Vector3(1,0,0).applyQuaternion(q),up=new T.Vector3(0,1,0).applyQuaternion(q);
   for(let j=0;j<3;j++){const u=clamp(t*1.6-j*.25),at=a.clone().addScaledVector(right,(j-1)*.36).addScaledVector(up,.25+u*.28);this.frames.add(at,.33,.186,q,alpha*ease(u/.2));}return;
  }
  for(let j=0;j<12;j++){
   const p=a.clone().add(new T.Vector3((j-5.5)*.065,.3,0));
   this.packets.add(p,new T.Vector3(.025,.08+Math.abs(Math.sin(j*.7+t*10))*.18,.025),GOLD,alpha,this.f.camera.quaternion);
  }
 }
 screen(step,t,alpha){
  const root=this.node(step.target),e=step.effect;
  if(['play','video-request','load-request','record-start','prompt','sleep-request'].includes(e)){
   const point=e==='sleep-request'?this.sleepPoint(this.f.localProgress):this.world(root,[0,170,11.3]);this.rings.add(point,new T.Vector3(.13+t*.16,.13+t*.16,.13),GOLD,alpha*(1-t)*.7,root.getWorldQuaternion(new T.Quaternion()));
  }
 }
 sleepPoint(local){const t=ease((local-.16)/.17),x=mix(104,195,t),y=mix(491,306,t);return this.world(this.node('display'),[(x/960-.5)*508,205+(.5-y/540)*286,11.3]);}
 paintCues(step,local,alpha){
  const mode=step.visual.mode,e=step.effect,id=step.target;
  let entries=[{point:this.anchor(id),label:step.visual.label,color:MINT}];
  if(mode==='tasks')entries=[{point:this.anchor('cpu','left'),label:e==='waiting'?'실행 중':e==='parallel'?'코어 · 첫 작업':'CPU · 실행',color:MINT},{point:this.world(this.node('cpu','silicon'),e==='parallel'?[2.6,1.8,5.5]:[20,4,6]),label:e==='waiting'?'I/O 대기':e==='parallel'?'코어 · 다른 작업':e==='resume-thread'?'보관한 위치':'실행 상태',color:GOLD}];
  if(mode==='storage')entries=[{point:this.anchor('ssd'),label:'컨트롤러',color:GOLD},{point:this.anchor('ssd','nand'),label:'NAND · '+(['files','music-file','assets'].includes(e)?'읽기':'기록'),color:MINT}];
  if(mode==='audio')entries=[{point:this.anchor('audio',e==='dac'?'dac':e==='amplify'?'amp':'center'),label:step.visual.label,color:e==='speaker'?MINT:GOLD}];
  if(mode==='server'&&e==='matrix')entries=[{point:this.anchor(id,'memory'),label:'가중치 예시 · 0.2',color:BLUE},{point:this.anchor(id),label:'입력 × 가중치 · 합산',color:MINT}];
  if(e==='upload')entries=[{point:this.anchor(id,'memory'),label:'이미지 자원 → VRAM',color:BLUE}];
  if(e==='sleep-request')entries=[{point:this.sleepPoint(local),label:local>.16?'절전 선택':'전원 메뉴',color:GOLD}];
  if(mode==='graphics'&&e!=='upload'){
   const source={typing:'글자 → 픽셀',streaming:'영상의 한 프레임',call:'카메라의 한 프레임',record:'녹화할 화면',loading:'게임의 첫 장면'}[this.f.id];
   if(source)entries.push({point:this.frameCenter(id).add(new T.Vector3(e==='encode'?.17:.63,e==='encode'?.33:.43,0).applyQuaternion(this.f.camera.quaternion)),label:source,color:MINT});
   if(e==='encode'&&local>.20)entries.push({point:this.frameCenter(id).add(new T.Vector3(.92,-.12,0).applyQuaternion(this.f.camera.quaternion)),label:'압축 데이터',color:GOLD});
  }
  if(e==='save-keys')entries=[{point:this.anchor('input','ctrl'),label:'Ctrl',color:GOLD},{point:this.anchor('input','s'),label:'S',color:GOLD}];
  if(mode==='screen'&&local>.42)entries=[];
  this.cues.forEach((el,i)=>{
   const entry=entries[i];if(!entry){el.hidden=true;return;}const point=entry.point.clone().project(this.f.camera),x=(point.x+1)*innerWidth/2,y=(1-point.y)*innerHeight/2;
   const caption=document.querySelector('.scenario-caption').getBoundingClientRect();
   el.hidden=point.z>1||point.z< -1||x<18||x>innerWidth-18||y<28||y>innerHeight-105||(x<caption.right+12&&y>caption.top-25);if(el.hidden)return;
   el.style.transform=`translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`;el.style.opacity=alpha;el.style.setProperty('--cue-color','#'+new T.Color(entry.color).getHexString());el.style.setProperty('--cue-pulse',`${clamp(local/.62)}`);
   el.querySelector('span').textContent=entry.label;el.classList.toggle('cue-left',x+31+el.querySelector('span').offsetWidth>innerWidth-14);
  });
 }
}
