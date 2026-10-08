import { preparePrograms } from 'inside/prepare-programs';
import { quality } from 'inside/quality';
import { beginPreparation, paintStatus, yieldTask } from 'inside/render-status';
// A single reversible scroll clock, using the site's existing WebGL renderer.
import * as T from 'inside/three';
import { acquireStage } from 'inside/study';
import { createCollectionModel, disposeCollectionModel } from 'inside/collection';
import { poseMouseClick } from 'inside/mouse';
import { ScenarioMechanisms } from 'inside/scenario-mechanisms';
import { createUSBAssembly } from 'inside/usb-model';
import { scenarioFor } from 'inside/scenario-data';
const $=s=>document.querySelector(s),mix=T.MathUtils.lerp,clamp=n=>T.MathUtils.clamp(n,0,1),v=a=>new T.Vector3(...a);
const ease=t=>t*t*t*(t*(t*6-15)+10),range=(p,a,b)=>ease(clamp((p-a)/(b-a))),pulse=(p,a,b,c,d)=>range(p,a,b)*(1-range(p,c,d));
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),mobile=()=>innerWidth<=760;
export class ScenarioFilm{
 constructor(onStep){
  this.onStep=onStep;this.active=false;this.paused=false;this.frame=0;this.token=0;this.progress=0;this.target=0;this.storageVariant='ssd';this.bookmarks={};this.extras={};this.paths=[];this.lastScreen=-1;this.lost=false;
  this.tick=this.tick.bind(this);
  addEventListener('scroll',()=>{if(!this.active||this.paused||$('#story-detail').open)return;this.target=clamp(scrollY/this.distance());this.wake();},{passive:true});
  addEventListener('inside:resize',()=>{if(this.active){this.resize();this.seek(this.target,true);}});
  $('#world').addEventListener('pointerdown',e=>{if(!this.active||this.paused||e.pointerType!=='mouse'||e.button!==0)return;this.drag={y:e.clientY,scroll:scrollY};e.target.setPointerCapture(e.pointerId);});
  addEventListener('pointermove',e=>{if(this.drag)scrollTo({top:this.drag.scroll+(this.drag.y-e.clientY)*2.5,behavior:'instant'});},{passive:true});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])addEventListener(event,()=>this.drag=null);
  addEventListener('keydown',e=>{
   if(!this.active||this.paused||$('#story-detail').open||e.altKey||e.ctrlKey||e.metaKey||e.target.closest('button,a,input,select'))return;
   let goal;if(['ArrowDown','ArrowRight','PageDown',' '].includes(e.key))goal=this.config.steps.map((_,i)=>this.stop(i)).find(p=>p>this.target+.015)??1;
   if(['ArrowUp','ArrowLeft','PageUp'].includes(e.key))goal=this.config.steps.map((_,i)=>this.stop(i)).reverse().find(p=>p<this.target-.015)??0;
   if(e.key==='Home')goal=0;if(e.key==='End')goal=1;if(goal!==undefined){e.preventDefault();this.seek(goal);}
  });
  $('#story-restart').onclick=()=>this.seek(0,true);
  $('#story-why').onclick=()=>{const b=this.config.steps[this.step];$('#story-detail-title').textContent=b.title;$('#story-detail-copy').textContent=b.detail;this.modalProgress=this.progress;this.modalToken=this.token;document.body.classList.add('story-modal');this.drag=null;$('#story-detail').showModal();};
  $('#story-detail-close').onclick=()=>$('#story-detail').close();
  $('#story-detail').addEventListener('close',()=>{document.body.classList.remove('story-modal');if(this.active&&this.token===this.modalToken)this.seek(this.modalProgress,true);});
  document.querySelectorAll('[data-storage]').forEach(button=>button.onclick=()=>this.changeStorage(button.dataset.storage));
  document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(this.frame);this.frame=0;if(!document.hidden)this.wake();});
  reduced.addEventListener('change',()=>this.wake());
  addEventListener('inside:contextloss',()=>{this.lost=true;cancelAnimationFrame(this.frame);this.frame=0;if(this.active)this.wake();});
  addEventListener('inside:contextrestore',()=>{this.lost=false;if(this.active&&this.scene){const generator=new T.PMREMGenerator(this.stage.renderer);this.environment.dispose();this.environment=generator.fromScene(this.studio,.04);this.scene.environment=this.environment.texture;generator.dispose();this.lastScreen=-1;this.wake();}});
 }
 stop(i){const steps=this.config.steps;if(i<=0)return 0;if(i>=steps.length-1)return 1;return steps[i].at+(steps[i+1].at-steps[i].at)*(this.config.extended?.48:.25);}
 distance(){return Math.max(1,$('#story-sequence').offsetHeight-innerHeight);}
 async enter(id,index=0){
  this.preparing=true;
  const finish=beginPreparation('시나리오를 준비하고 있습니다');
  const token=++this.token;
  try {
  await paintStatus();if(token!==this.token)return false;
  this.active=true;this.paused=false;this.id=id;this.step=-1;this.config=scenarioFor(id,this.storageVariant);this.lastScreen=-1;
  document.body.dataset.story=id;this.buildUI();
  const saved=this.bookmarks[id],point=saved?.step===index?saved.progress:this.stop(index);
  this.target=this.progress=point;
  this.stage=await acquireStage();if(token!==this.token||!this.active)return false;
  if(this.stage){
   if(!this.scene)this.setup();
   this.computer=this.stage.computer;this.scene.add(this.computer.root);this.computer.root.visible=true;
   await this.prepareExtras();if(token!==this.token||!this.active)return false;this.motion.prepare(this);this.buildPaths();this.resize();
   this.stage.renderer.domElement.style.touchAction='pan-y';
   const prepared=await preparePrograms(this.stage.renderer,this.scene,this.camera,()=>token===this.token&&this.active&&!this.lost);if(!prepared||token!==this.token||!this.active)return false;
  }
  document.documentElement.style.setProperty('--paper','#111416');document.documentElement.style.setProperty('--ink','221,223,223');
  this.preparing=false;this.seek(point,true);this.compose(point);return !!this.stage;
  } finally { if(token===this.token)this.preparing=false;finish(); }
 }
 setup(){
  const renderer=this.stage.renderer;this.scene=new T.Scene();this.scene.background=new T.Color(0x111416);this.camera=new T.PerspectiveCamera(34,innerWidth/innerHeight,.3,160);
  const studio=new T.Scene();studio.background=new T.Color(0x11161c);
  for(const [size,pos,intensity,color] of [[[8,12],[-6,9,3],5,0xf6f2ec],[[4,14],[7,3,-4],4,0xa5c3d6],[[10,3],[0,8,-8],6,0xffffff]]){
   const m=new T.Mesh(new T.PlaneGeometry(...size),new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(intensity),side:T.DoubleSide}));m.position.set(...pos);m.lookAt(0,0,0);studio.add(m);
  }
  const pmrem=new T.PMREMGenerator(renderer);this.environment=pmrem.fromScene(studio,.04);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.85;pmrem.dispose();this.studio=studio;
  const key=new T.DirectionalLight(0xfff5e9,3.4);key.position.set(-6,10,8);const rim=new T.DirectionalLight(0xb0d5e6,2);rim.position.set(8,4,-7);this.key=key;this.rim=rim;this.scene.add(key,rim,new T.HemisphereLight(0xdcebf1,0x1b2527,1.2));
  const floor=new T.Mesh(new T.PlaneGeometry(180,120),new T.MeshBasicMaterial({color:0x111416,toneMapped:false}));floor.rotation.x=-Math.PI/2;floor.position.y=-3.3;this.scene.add(floor);
  this.monitor=createCollectionModel('display');this.monitor.root.scale.setScalar(.013);this.monitor.root.position.set(10,-1.2,5);this.scene.add(this.monitor.root);
  const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;this.screenMap=new T.CanvasTexture(canvas);this.screenMap.colorSpace=T.SRGBColorSpace;this.screenMap.generateMipmaps=false;this.screenMap.minFilter=T.LinearFilter;this.motion=new ScenarioMechanisms(this.scene);
  this.monitor.root.traverse(o=>{if(o.geometry?.type==='PlaneGeometry'&&o.geometry.parameters.width===508){o.material.map.dispose();o.material.dispose();o.material=new T.MeshBasicMaterial({map:this.screenMap,toneMapped:false});}});
 }
 async prepareExtras(){
  const token=this.token;
  const specs={mouse:[.034,[-9,-1,1],-.2],input:[.017,[-9,-1,1],-.12],infra:[.024,[10,-1,-7],.1],datacenter:[.0072,[23,-1,-8],-.1],audio:[.026,[17,-1.2,.3],-.15],camera:[.075,[-9,-1,1],.1],remote:[.013,[29,-1.2,4],0],serverGpu:[.024,[22,-1.8,-2],0],remoteGpu:[.024,[25,-1.8,-3],0],remoteMemory:[.024,[26.5,-1,-3],0],usb:[.32,[-9,-.8,1],0]};
  for(const id of this.config.extras){
   await yieldTask();if(token!==this.token||!this.active)return;
   if(!this.extras[id]){
   const alias={remote:'display',serverGpu:'gpu',remoteGpu:'gpu',remoteMemory:'dram'}[id]||id;
   const model=id==='usb'?createUSBAssembly():createCollectionModel(alias),[scale,pos,rot]=specs[id];
   model.root.scale.setScalar(scale);model.root.position.set(...pos);model.root.rotation.y=rot;this.scene.add(model.root);this.extras[id]=model;if(id==='remoteMemory')model.root.rotation.x=Math.PI/2;
   if(id==='remote'){
    const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;this.remoteScreenMap=new T.CanvasTexture(canvas);this.remoteScreenMap.colorSpace=T.SRGBColorSpace;this.remoteScreenMap.generateMipmaps=false;this.remoteScreenMap.minFilter=T.LinearFilter;
    model.root.traverse(o=>{if(o.geometry?.type==='PlaneGeometry'&&o.geometry.parameters.width===508){o.material.map.dispose();o.material.dispose();o.material=new T.MeshBasicMaterial({map:this.remoteScreenMap,toneMapped:false});}});
   }
  }}
  Object.entries(this.extras).forEach(([id,model])=>{model.root.visible=this.config.extras.includes(id);model.explode(0);if(id==='mouse')poseMouseClick(model.root,0);});
 }
 buildPaths(){
  for(const path of this.paths){for(const mesh of [path.line,...path.markers]){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();}}this.paths=[];
  if(this.config.extended)return;
  for(const route of this.config.paths){
   const curve=new T.CatmullRomCurve3(route.points.map(v)),command=route.kind==='command',data=route.kind&&!command;
   const line=new T.Mesh(new T.TubeGeometry(curve,96,.009,6,false),new T.MeshBasicMaterial({color:this.id==='boot'||command?0xc8b891:0x9ec7bd,transparent:true,opacity:.18,depthWrite:false}));
   const markers=Array.from({length:data?4:1},()=>{
    const geometry=command?new T.TorusGeometry(.075,.010,8,28):data?new T.PlaneGeometry(route.kind==='frame'?.25:.14,route.kind==='frame'?.16:.20):new T.SphereGeometry(.055,16,12);
    const marker=new T.Mesh(geometry,new T.MeshBasicMaterial({color:this.id==='boot'||command?0xe1cfa5:0xb8daca,transparent:true,opacity:.9,side:T.DoubleSide}));this.scene.add(marker);return marker;
   });this.scene.add(line);this.paths.push({...route,curve,line,dot:markers[0],markers});
  }
 }
 posePaths(p){
  for(const path of this.paths){
   const [a,b]=path.window,t=clamp((p-a)/(b-a));path.line.visible=p>=a&&p<=b;
   path.line.position.y=path.bind==='gpu'?this.computer.parts.gpu.model.root.getObjectByName('graphics board').position.y*.024:0;
   path.markers.forEach((marker,j)=>{const u=path.markers.length>1?t*1.45-j*.15:t;marker.visible=path.line.visible&&u>=0&&u<=1;marker.position.copy(path.curve.getPointAt(clamp(u))).add(path.line.position);if(path.kind)marker.quaternion.copy(this.camera.quaternion);});
   path.line.material.opacity=.07+.18*Math.sin(t*Math.PI);
  }
 }
 buildUI(){
  $('#story-sequence').style.setProperty('--scene-count',this.config.steps.length);document.body.dataset.extendedStory=String(!!this.config.extended);
  $('#story-track').replaceChildren(...this.config.steps.map((b,i)=>{const button=document.createElement('button');button.setAttribute('aria-label',`${i+1}. ${b.title}`);button.onclick=()=>this.seek(this.stop(i),true);return button;}));
  $('#story-sequence').replaceChildren(...this.config.steps.map(b=>{const section=document.createElement('section');section.className='sr-only';section.textContent=b.title+' '+b.copy;return section;}));
  $('#story-source').hidden=!this.config.source;if(this.config.source)$('#story-source').href=this.config.source;
  $('#story-options').hidden=this.id!=='storage';document.querySelectorAll('[data-storage]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.storage===this.storageVariant)));
 }
 changeStorage(variant){
  if(!this.active||this.id!=='storage')return;this.storageVariant=variant;this.config=scenarioFor('storage',variant);this.step=-1;this.lastScreen=-1;this.buildUI();if(this.stage)this.buildPaths();this.seek(this.stop(variant==='cached'?1:2),true);
 }
 resize(){if(!this.camera)return;this.camera.aspect=innerWidth/innerHeight;this.camera.clearViewOffset();this.camera.updateProjectionMatrix();this.dirty=true;}
 resetBoard(){
  const c=this.computer;c.root.visible=true;c.board.root.position.set(0,-1.8,0);c.board.root.visible=true;c.cables.visible=false;
  for(const [id,item] of Object.entries(c.parts)){const root=item.model.root;root.position.copy(item.install);root.quaternion.copy(item.installedRotation);root.scale.setScalar(.024);root.visible=this.config.parts.includes(id);item.model.explode(0);}
  c.parts.cpu.model.root.getObjectByName('heatspreader').position.x=0;
  for(const name of ['heat sink','frame and fans'])c.parts.gpu.model.root.getObjectByName(name).position.z=0;
  c.ram2.root.visible=true;c.ram2.root.position.y=23*.024-1.8;
 }
 pose(p){
  this.resetBoard();const parts=this.computer.parts;
  if(this.config.extended){
   if(this.extras.mouse){const beat=this.currentBeat,e=beat.effect,q=this.localProgress;const amount=e==='double-click'?Math.pow(Math.sin(q*Math.PI*2),2)*(q<.7?1:0):0;poseMouseClick(this.extras.mouse.root,amount);}
   this.posePaths(p);this.motion.update(p,this.currentBeat,this.localProgress);return;
  }
  this.motion.root.visible=false;
  let cpu=0,ram=0,gpu=0;
  if(this.id==='game'){
   cpu=pulse(p,.09,.21,.45,.59);ram=.48*pulse(p,.27,.38,.49,.58);gpu=pulse(p,.57,.76,.83,.96);
  }else if(this.id==='boot'){
   parts.power.model.explode(.45*pulse(p,.025,.10,.15,.27));parts.vrm.model.explode(.7*pulse(p,.13,.2,.28,.39));parts.spirom.model.explode(.65*pulse(p,.29,.35,.41,.48));ram=.46*pulse(p,.46,.52,.6,.69);parts.ssd.model.explode(.7*pulse(p,.65,.71,.78,.87));cpu=.65*pulse(p,.34,.43,.57,.7);
  }else if(this.id==='storage'){
   const cached=this.storageVariant==='cached';cpu=pulse(p,cached?.52:.68,cached?.63:.75,.84,.91);ram=.38*pulse(p,.16,.23,cached?.53:.3,cached?.6:.35);
   if(!cached){const read=.7*pulse(p,.33,.41,.48,.56);parts[this.storageVariant==='hdd'?'hdd':'ssd'].model.explode(read);}
   parts.hdd.model.root.visible=this.storageVariant==='hdd';
  }else if(this.id==='search'){
   parts.nic.model.explode(.42*pulse(p,.12,.2,.26,.34)+.3*pulse(p,.67,.74,.81,.9));this.extras.infra.explode(.25*pulse(p,.3,.37,.44,.52));this.extras.datacenter.explode(.4*pulse(p,.48,.55,.62,.72));cpu=.45*pulse(p,.75,.81,.87,.93);
  }
  parts.cpu.model.explode(cpu);parts.cpu.model.root.getObjectByName('heatspreader').position.x=-48*cpu;parts.dram.model.explode(ram);
  parts.gpu.model.explode(gpu*.7);parts.gpu.model.root.getObjectByName('heat sink').position.z=-190*gpu;parts.gpu.model.root.getObjectByName('frame and fans').position.z=-380*gpu;
  if(this.extras.mouse){this.extras.mouse.root.visible=this.config.extras.includes('mouse')&&p<.28;poseMouseClick(this.extras.mouse.root,Math.sin(Math.PI*range(p,0,.105)));}
  if(this.extras.input)this.extras.input.root.visible=this.id==='search'&&p<.29;
  this.posePaths(p);
 }
 paintScreen(t){
  const now=performance.now();
  if(quality.compact&&this.lastScreen!==-1&&now-(this.lastScreenAt||0)<1000/24&&Math.abs(this.target-this.progress)>.00003){this.screenPending=true;return;}
  this.screenPending=false;this.lastScreenAt=now;
  if(this.config.extended){
   const e=this.currentBeat.effect,local=this.localProgress,raw=this.progress,key=e+':'+Math.round(local*1600)+':'+Math.round(raw*1600);if(key===this.lastScreen)return;this.lastScreen=key;
   this.motion.paintOutput(this.screenMap.image.getContext('2d'),this.id,e,local,raw);this.screenMap.needsUpdate=true;
   if(this.id==='call'&&this.remoteScreenMap){this.motion.paintOutput(this.remoteScreenMap.image.getContext('2d'),this.id,e,local,raw,{remote:true});this.remoteScreenMap.needsUpdate=true;}return;
  }
  if(Math.abs(t-this.lastScreen)<.00005)return;this.lastScreen=t;
  const c=this.screenMap.image.getContext('2d');c.fillStyle='#0c171e';c.fillRect(0,0,960,540);
  const rect=(x,y,w,h,color,r=0)=>{c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();};
  if(this.id==='game'){
   c.strokeStyle='#243740';c.lineWidth=1;for(let x=0;x<960;x+=48){c.beginPath();c.moveTo(x,0);c.lineTo(x,540);c.stroke();}for(let y=0;y<540;y+=48){c.beginPath();c.moveTo(0,y);c.lineTo(960,y);c.stroke();}
   rect(130,394,710,8,'#101f24');c.shadowColor='#b4d7cb';c.shadowBlur=35;rect(mix(260,635,t),240,100,150,'#a9d0c1',14);c.shadowBlur=0;c.fillStyle='#617d82';c.font='16px Arial';c.fillText('ONE CLICK / A NEW FRAME',45,48);
  }else if(this.id==='boot'){
   c.strokeStyle='#8db3a9';c.lineWidth=3;c.beginPath();c.arc(480,220,32,-Math.PI/2,-Math.PI/2+t*Math.PI*2);c.stroke();rect(320,310,320,3,'#213038');rect(320,310,320*t,3,'#9ac5b6');
   if(t>.7){const a=range(t,.7,1);c.globalAlpha=a;rect(125,80,710,365,'#1a2d34',14);rect(147,102,666,30,'#213b43',6);for(let i=0;i<4;i++)rect(153+i*160,160,135,110,['#426b6c','#658080','#294e5e','#6a8272'][i],8);rect(153,300,390,7,'#a0b8b4',2);rect(153,325,260,6,'#657f83',2);rect(350,477,260,30,'#314951',10);c.globalAlpha=1;}
  }else if(this.id==='search'){
   rect(85,64,790,412,'#17282f',12);rect(113,92,734,42,'#253c44',10);c.fillStyle='#b8d0cb';c.font='18px Arial';c.fillText('컴퓨터는 어떻게 작동할까?',145,120);
   for(let i=0;i<3;i++){const a=range(t,i*.23,.30+i*.23);c.globalAlpha=a;rect(124,173+i*93,310-i*40,8,'#83b4b4',3);rect(124,197+i*93,590-i*55,5,'#63818a',2);rect(124,214+i*93,505-i*35,5,'#405f68',2);}c.globalAlpha=1;
  }else{
   rect(95,54,770,433,'#192b32',12);c.save();c.beginPath();c.rect(122,82,716*t,344);c.clip();const gradient=c.createLinearGradient(0,82,0,426);gradient.addColorStop(0,'#557b8b');gradient.addColorStop(1,'#c5bbb0');c.fillStyle=gradient;c.fillRect(122,82,716,344);c.fillStyle='#ded7b7';c.beginPath();c.arc(670,172,37,0,Math.PI*2);c.fill();c.fillStyle='#294f58';c.beginPath();c.moveTo(122,355);c.lineTo(358,190);c.lineTo(533,363);c.lineTo(720,250);c.lineTo(838,330);c.lineTo(838,426);c.lineTo(122,426);c.fill();c.fillStyle='#193840';c.beginPath();c.moveTo(122,411);c.quadraticCurveTo(398,301,838,405);c.lineTo(838,426);c.lineTo(122,426);c.fill();c.restore();rect(122,452,320,5,'#718c94',2);
  }
  this.screenMap.needsUpdate=true;
 }
 compose(p){
  const steps=this.config.steps;let i=Math.max(0,steps.findLastIndex(b=>b.at<=p));const next=Math.min(i+1,steps.length-1),a=steps[i],b=steps[next],local=next===i?(this.config.extended?clamp((p-a.at)/(1-a.at)):1):clamp((p-a.at)/(b.at-a.at)),travel=reduced.matches?0:range(local,this.config.extended?.55:.4,1);
  this.currentBeat=a;this.localProgress=local;
  if(this.stage&&!this.lost){
   const focus=v(a.focus).lerp(v(b.focus),travel),offset=v(a.offset).lerp(v(b.offset),travel);if(mobile())offset.multiplyScalar(mix(a.fit,b.fit,travel));
   this.camera.position.copy(focus).add(offset);this.camera.lookAt(focus);this.camera.updateMatrixWorld();
   this.camera.setViewOffset(innerWidth,innerHeight,mobile()?0:-innerWidth*.14,mobile()?innerHeight*.16:0,innerWidth,innerHeight);
   this.pose(p);this.paintScreen(range(p,...this.config.screen));this.stage.renderer.setRenderTarget(null);this.stage.renderer.render(this.scene,this.camera);
  }
  if(i!==this.step){this.step=i;this.onStep(i,this.config);$('#story-tag').textContent=a.tag;$('#story-phase').textContent=`${String(i+1).padStart(2,'0')} / ${String(steps.length).padStart(2,'0')}`;document.querySelectorAll('#story-track button').forEach((e,j)=>e.setAttribute('aria-current',i===j?'step':'false'));const rail=$('#story-track'),current=rail.children[i];rail.scrollTo({left:current.offsetLeft-rail.clientWidth/2+22,behavior:'instant'});}
  $('#story-progress').style.transform=`scaleX(${p})`;$('#story-gesture').hidden=p>.98;$('#story-restart').hidden=p<=.98;$('#story-more').hidden=p<.98;$('#story-options').hidden=this.id!=='storage'||p>.7;
  document.body.dataset.storyProgress=p.toFixed(5);document.body.dataset.storyStep=String(i);document.body.dataset.storage=this.storageVariant;
 }
 seek(p,instant=false){this.target=clamp(p);if(instant||reduced.matches)this.progress=this.target;scrollTo({top:Math.ceil(this.target*this.distance()-1e-7),behavior:'instant'});this.wake();}
 wake(){this.dirty=true;if(!this.frame&&!this.preparing&&this.active&&!this.paused&&!document.hidden&&!$('#story-detail').open){this.last=performance.now();this.frame=requestAnimationFrame(this.tick);}}
 tick(now){
  this.frame=0;if(this.preparing||!this.active||this.paused||document.hidden||$('#story-detail').open)return;
  const dt=Math.min(.5,(now-this.last)/1000||.016);this.last=now;
  const stops=this.config.steps.map((_,i)=>this.stop(i)),goal=reduced.matches?stops.reduce((best,n)=>Math.abs(n-this.target)<Math.abs(best-this.target)?n:best,0):this.target;
  const previous=this.progress;this.progress=reduced.matches?goal:mix(this.progress,goal,1-Math.exp(-8*dt));const moving=Math.abs(goal-this.progress)>.00003;
  if(!moving)this.progress=goal;
  if(moving||this.dirty||this.screenPending||this.progress!==previous){this.compose(this.progress);this.dirty=false;}if(moving)this.frame=requestAnimationFrame(this.tick);
 }
 pause(){if(!this.active)return;this.paused=true;this.drag=null;cancelAnimationFrame(this.frame);this.frame=0;this.bookmarks[this.id]={progress:this.progress,step:this.step};}
 resume(){if(!this.active)return;this.paused=false;this.seek(this.progress,true);}
 leave(){
  ++this.token;this.preparing=false;if(!this.active)return;this.pause();this.active=false;this.motion?.reset();
  // Only the current scenario owns its optional hardware. The shared computer
  // and monitor are reused; visited scenarios must not accumulate hidden models.
  for(const model of Object.values(this.extras)){model.root.removeFromParent();disposeCollectionModel(model);}
  this.extras={};this.remoteScreenMap=null;
  for(const path of this.paths){for(const mesh of [path.line,...path.markers]){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();}}this.paths=[];
  if($('#story-detail').open)$('#story-detail').close();document.body.classList.remove('story-modal');
  if(this.computer){this.resetBoard();this.stage.scene.add(this.computer.root);this.computer.root.visible=false;}
 }
}
