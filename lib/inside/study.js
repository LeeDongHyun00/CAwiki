import { createSkipMontage } from 'inside/film-skip';
import { preparePrograms } from 'inside/prepare-programs';
import { quality } from 'inside/quality';
import { beginPreparation, beginSceneReveal, paintStatus, yieldTask, showRecovery } from 'inside/render-status';
// Continuous motherboard film; the fixed final view is baked, with a live RTT fallback.
import { CHAPTERS, CHAPTER_STOPS, chapterAt } from 'inside/cinema-timeline';
import { MobileScrollPacer } from 'inside/scroll-pacing';
const $ = selector => document.querySelector(selector);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * t * (t * (t * 6 - 15) + 10);
const range = (p, a, b) => ease(clamp((p - a) / (b - a)));
const beats = [0,...CHAPTER_STOPS];
const scrollPacer=new MobileScrollPacer([...CHAPTERS.map(c=>c.start),1]);
const routePositions = {home:0, inside:.055, silicon:.078, graphics:.18, airflow:.48, system:.93, screen:1};
let graphics = null, progress = 0, target = 0, frame = 0, lastTime = 0, introStart = 0;
let dirty = true, active = -1, failed = false, contextLost = false;
let suspended = false, computerComplete=false, availableProgress=0, monitorRequested=false, skipRun=null;
// Pausing the film must also pause its unfinished model construction. A hidden
// board otherwise competes with the first gallery upload on the same thread.
let stageDemand='none',buildWaiters=[],surfaceParked=false;
function requestStage(demand){stageDemand=demand;const waiting=buildWaiters;buildWaiters=[];waiting.forEach(resolve=>resolve());}
async function waitForStageWork(full=true){
  while(suspended&&stageDemand!=='full'&&(full||stageDemand!=='base'))await new Promise(resolve=>buildWaiters.push(resolve));
}
const liveMonitor=new URLSearchParams(location.search).has('live-monitor');
let montage;
function cancelSkip(){if(!skipRun&&!montage)return;skipRun=null;montage?.cancel();montage=null;dirty=true;wake();}
let monitorImage,monitorProfile;
const monitorTextures=new Map();
function prefetchMonitor(T){
  const profile=mobile()?'mobile':'desktop';monitorProfile=profile;
  if(!monitorTextures.has(profile))monitorTextures.set(profile,new T.TextureLoader().loadAsync(window.__insideAssets['monitor/'+profile+'.png']).then(texture=>{texture.colorSpace=T.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=T.LinearFilter;return texture;}).catch(error=>{console.warn('Using live monitor capture',error);return null;}));
  return monitorTextures.get(profile);
}
let pointer = {x:0,y:0}, pointerTarget = {x:0,y:0};
let drag=null;
let currentHeight = innerHeight, totalScroll = 1;
const mobile = () => innerWidth <= 760;

function updateScroll() {
  if(suspended)return;
  totalScroll = Math.max(1, $('#sequence').offsetHeight - innerHeight);
  target = scrollPacer.target(clamp(scrollY / totalScroll),progress,totalScroll);
  document.body.classList.toggle('exploring', target > .008);
  if (failed) { progress = target; updateCaption(progress); }
  if(target>.02){monitorRequested=true;if(computerComplete)prepareMonitor();}
  wake();
}
function goTo(p, instant = false) {
  scrollPacer.reset();
  scrollTo({top:p * totalScroll, behavior:instant || motion.matches ? 'instant' : 'smooth'});
  updateScroll();
}
function readRoute() {
  if(suspended)return;
  const key = location.hash.slice(1);
  if (Object.hasOwn(routePositions, key)) goTo(routePositions[key], true);
}
function updateCaption(p) {
  const chapter=chapterAt(p),idx=CHAPTERS.indexOf(chapter),light=range(p,.10,.145);
  document.documentElement.style.setProperty('--ink',light>.55?'45,47,48':'214,215,216');
  document.documentElement.style.setProperty('--paper',light>.55?'#ecece9':'#101113');
  const reveal=range(p,.958,.986);
  document.documentElement.style.setProperty('--ending',reveal);
  const ending=$('#ending');ending.hidden=p<.958;ending.inert=p<.976;
  ending.setAttribute('aria-hidden',String(ending.inert));
  document.body.classList.toggle('at-ending',p>.986);
  $('#skip-film').hidden=p>=.94;
  $('#progress').style.transform=`scaleX(${p})`;
  document.body.dataset.chapter=chapter.id;
  document.body.dataset.filmProgress=p.toFixed(5);
  if(idx===active)return;active=idx;
  $('#scene-number').textContent=String(idx+1).padStart(2,'0');
  $('#scene-name').textContent=chapter.label;
  $('#world').setAttribute('aria-label',chapter.description);$('#status').textContent=chapter.description;
  if(failed){const id=chapter.fallback;$('#fallback').src=window.__insideAssets[id+'.png'];$('#fallback').alt=chapter.description;}
}
function fallback() {
  failed = true; cancelSkip();cancelAnimationFrame(frame); frame = 0;
  document.body.classList.remove('ready'); document.body.classList.add('failed');
  active = -1; if(!suspended)updateCaption(target);
  dispatchEvent(new Event('inside:contextloss'));
}

async function createStage() {
  const finish=beginPreparation(), exposure=!suspended&&!document.querySelector('#cpu-intro')?beginSceneReveal():null;
  await paintStatus();
  try {
  const [T, models] = await Promise.all([
    import('inside/three'), import('inside/cinema-models'),
  ]);
  await waitForStageWork(false);
  if(!liveMonitor)monitorImage=prefetchMonitor(T);
  const renderer = new T.WebGLRenderer({canvas:$('#world'),antialias:!quality.compact,alpha:true,powerPreference:quality.compact?'low-power':'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality.pixelRatio));
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = quality.shadows; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const scene = new T.Scene();
  scene.background = new T.Color(0x101113);
  scene.fog = new T.FogExp2(0x101113, .019);
  const camera = new T.PerspectiveCamera(31, innerWidth / innerHeight, .08, 120);
  const studio = new T.Scene(); studio.background = new T.Color(0x17191c);
  const panel = (w,h,pos,intensity,color=0xffffff) => {
    const material = new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(intensity),side:T.DoubleSide});
    const m = new T.Mesh(new T.PlaneGeometry(w,h),material);m.position.set(...pos);m.lookAt(0,0,0);studio.add(m);
  };
  // Large photographic softboxes make the metal readable through reflections.
  panel(9,12,[-8,9,5],5.5,0xf2f1ef); panel(2,14,[8,4,0],5,0xc9daf5);
  panel(12,3,[0,8,-8],6.5); panel(6,5,[-1,-7,6],1.4);panel(3,9,[2,1,10],1.9);
  const pmrem = new T.PMREMGenerator(renderer), environment = pmrem.fromScene(studio,.045);
  scene.environment = environment.texture; scene.environmentIntensity = .85;
  pmrem.dispose();
  const key = new T.DirectionalLight(0xfff5e9,3.4);key.position.set(-4,8,6);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:.1,far:35});
  key.shadow.normalBias=.018;key.shadow.bias=-.0001;key.shadow.radius=3;scene.add(key);
  const rim = new T.DirectionalLight(0xdbe6ff,2.2);rim.position.set(5,3,-6);scene.add(rim);
  const fill = new T.HemisphereLight(0xe8ecf1,0x4b4b43,.6);scene.add(fill);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=256;
  const shadowContext=shadowCanvas.getContext('2d'),gradient=shadowContext.createRadialGradient(128,128,0,128,128,128);
  gradient.addColorStop(0,'#0009');gradient.addColorStop(.3,'#0005');gradient.addColorStop(1,'#0000');shadowContext.fillStyle=gradient;shadowContext.fillRect(0,0,256,256);
  const floor = new T.Mesh(new T.PlaneGeometry(17,11),new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,opacity:0}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-3.4;scene.add(floor);
  $('#world').addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;fallback();});
  $('#world').addEventListener('webglcontextrestored',()=>{
    // Three restores meshes and textures; render the studio into a fresh target.
    const generator=new T.PMREMGenerator(renderer);
    const replacement=generator.fromScene(studio,.045);graphics.environment.dispose();scene.environment=replacement.texture;
    graphics.environment=replacement;if(graphics.reveal.scene)graphics.reveal.scene.environment=replacement.texture;graphics.reveal.warmed=false;generator.dispose();failed=false;contextLost=false;document.body.classList.remove('failed');document.body.classList.add('ready');size();dispatchEvent(new Event('inside:contextrestore'));
  });
  const colorDark=new T.Color(0x101113),colorLight=new T.Color(0xecece9);
  const focus=new T.Vector3(),position=new T.Vector3();
  const reveal={target:new T.WebGLRenderTarget(1,1,{samples:quality.targetSamples,type:T.HalfFloatType}),dirty:true};
  const computer=await models.createComputer({beforePart:id=>waitForStageWork(id!=='cpu'),onPart:async(id,computer)=>{
    const root=computer.root;
    if(!graphics){
      scene.add(root);
      graphics={T,renderer,scene,camera,key,rim,fill,floor,root,colorDark,colorLight,focus,position,environment,computer,reveal};
      size();availableProgress=CHAPTERS[0].end-.00001;
      compose(0,1);await preparePrograms(renderer,scene,camera,()=>!contextLost);
      if(!suspended&&!contextLost){renderFilm();introStart=performance.now();document.body.classList.add('ready');performance.mark('inside:cpu-visible');exposure?.finish();wake();}
      resolveBase(contextLost?null:graphics);
    }
    // The CPU stays interactive while the complete board is assembled offscreen.
    if(target>progress+.00003){dirty=true;wake();}
  }});
  computerComplete=true;availableProgress=.93999;
  await yieldTask();await waitForStageWork();Object.assign(reveal,models.createScreenReveal(environment.texture,reveal.target));
  performance.mark('inside:computer-ready');
  size();readRoute();
  if(suspended){document.body.classList.add('ready');exposure?.cancel();}
  else if(target>0){dirty=true;wake();}
  if(monitorRequested||target>=.94)prepareMonitor();
  } finally { finish(); }
}

function size() {
  currentHeight = innerHeight;
  if (graphics && !contextLost) {
    const {renderer,camera} = graphics;
    if(!liveMonitor&&monitorProfile!==(mobile()?'mobile':'desktop')){
      monitorImage=prefetchMonitor(graphics.T);graphics.reveal.warmed=false;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio,quality.pixelRatio));renderer.setSize(surfaceParked?1:innerWidth,surfaceParked?1:innerHeight,false);
    camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();graphics.reveal.dirty=true;
    const width=Math.min(quality.targetWidth,Math.round(Math.max(innerWidth,innerHeight*16/9)*renderer.getPixelRatio()));
    graphics.reveal.target.setSize(surfaceParked?1:width,surfaceParked?1:Math.round(width*9/16));
  }
  dirty=true;updateScroll();dispatchEvent(new Event('inside:resize'));
}
function compose(p,intro=1) {
  const {T,camera,scene,key,rim,fill,floor,colorDark,colorLight,focus,position,computer}=graphics;
  const chapter=chapterAt(Math.min(p,.939999)),local=clamp((p-chapter.start)/(chapter.end-chapter.start));
  const idx=CHAPTERS.indexOf(chapter),system=chapter.id==='system';
  const arrival=idx===0?1:range(local,0,.20),departure=1-range(local,.80,1);
  const hero=system?0:arrival*departure;
  const unfold=range(local,.20,.49)*(1-range(local,.69,.90));
  const macro=chapter.id==='cpu'?range(local,.49,.63)*(1-range(local,.69,.83)):0;
  const light=range(p,.10,.145),drop=hero*11.5;
  scene.background.copy(colorDark).lerp(colorLight,light);scene.fog.color.copy(scene.background);scene.fog.density=0;
  scene.environmentIntensity=mix(.67,.66,light);key.intensity=mix(2.3,1.95,light);rim.intensity=mix(1.8,1.25,light);fill.intensity=mix(.35,.8,light);
  floor.visible=true;floor.material.opacity=light*.23;floor.position.set(0,-3.4-drop,0);
  computer.board.root.position.set(0,-1.8-drop,0);computer.board.root.visible=hero<.995;
  computer.cables.position.y=-1.8-drop;computer.cables.visible=p>.56&&hero<.995;
  for(const [id,item] of Object.entries(computer.parts)){
    const index=CHAPTERS.findIndex(c=>c.id===id),selected=chapter.id===id;
    const onboard=['vrm','coproc','spirom','io'].includes(id);
    const show=onboard||index<=idx;
    const m=item.model.root;m.visible=(show&&hero<.995)||(selected&&hero>.001);
    const w=selected?hero:0;
    m.position.copy(item.install);m.position.y-=drop;
    const offset=id==='cooling'?-2.6:id==='hdd'?-1.4:-.6;
    m.position.lerp(new T.Vector3(0,offset,0),w);
    m.scale.setScalar(mix(.024,item.heroScale,w));
    m.quaternion.copy(item.installedRotation).slerp(item.heroRotation,w);
    if(selected){
      const turn=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),(local-.35)*.28*w);m.quaternion.multiply(turn);
      if(mobile()&&id==='gpu')m.rotateZ(-.66*w);
    }
    item.model.explode(selected?unfold:0);
    if(id==='cpu')item.model.root.getObjectByName('heatspreader').position.y+=macro*60;
  }
  computer.ram2.root.visible=p>.29&&hero<.995;computer.ram2.root.position.y=23*.024-1.8-drop;
  position.set(8.4,15,21);focus.set(1.2,-.25,1.5);
  const heroCamera=new T.Vector3(4.3,7.1,10.7),heroFocus=new T.Vector3(0,.6,0);
  if(chapter.id==='io'){heroCamera.set(-2,7.6,13.3);heroFocus.set(0,0,0);}
  if(!system){
    // Fit the entire exploded assembly, using projected bounds and the real viewport.
    const item=computer.parts[chapter.id],box=new T.Box3();
    box.min.lerpVectors(item.assembled.min,item.expanded.min,unfold);box.max.lerpVectors(item.assembled.max,item.expanded.max,unfold);
    const offset=chapter.id==='cooling'?-2.6:chapter.id==='hdd'?-1.4:-.6;
    const rotation=item.heroRotation.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),(local-.35)*.28));
    if(mobile()&&chapter.id==='gpu')rotation.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),-.66));
    const matrix=new T.Matrix4().compose(new T.Vector3(0,offset,0),rotation,new T.Vector3().setScalar(item.heroScale));
    const corners=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])corners.push(new T.Vector3(x,y,z).applyMatrix4(matrix));
    heroFocus.copy(box.getCenter(new T.Vector3()).applyMatrix4(matrix));
    const direction=heroCamera.clone().normalize(),right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),direction).normalize(),up=new T.Vector3().crossVectors(direction,right);
    const tanY=Math.tan(camera.fov*Math.PI/360)*.77,tanX=tanY*camera.aspect;
    let distance=0;for(const corner of corners){const v=corner.sub(heroFocus);distance=Math.max(distance,Math.max(Math.abs(v.dot(right))/tanX,Math.abs(v.dot(up))/tanY)+v.dot(direction));}
    heroCamera.copy(direction.multiplyScalar(Math.max(11,distance))).add(heroFocus);
    if(macro){
      const macroFocus=new T.Vector3(0,.47,0),macroPosition=new T.Vector3(.55,4.5,5.9);
      if(mobile())macroPosition.sub(macroFocus).multiplyScalar(1.65).add(macroFocus);
      heroCamera.lerp(macroPosition,macro);heroFocus.lerp(macroFocus,macro);
    }
  }
  if(mobile())position.sub(focus).multiplyScalar(2.05).add(focus);
  position.lerp(heroCamera,hero);focus.lerp(heroFocus,hero);
  if(system){
    const orbit=range(local,0,1);position.x=mix(8.4,3.5,orbit);position.z=mix(21,16.5,orbit);position.y=mix(15,26.5,orbit);
    if(mobile())position.sub(focus).multiplyScalar(2.05).add(focus);
    // One final exploded view exposes the board before every connector seats.
    const spread=range(local,.05,.37)*(1-range(local,.55,.96));
    for(const [id,height] of [['cpu',1.5],['dram',2],['ssd',1.1],['cooling',4.8],['nic',1.7]])computer.parts[id].model.root.position.y+=height*spread;
    computer.parts.cooling.model.root.position.x-=1.4*spread;
    computer.parts.nic.model.root.position.x-=.8*spread;
    computer.ram2.root.position.y+=2*spread;
    position.y+=spread*4;position.z+=spread*2;focus.y+=spread*1.15;
    position.sub(focus).multiplyScalar(1+spread*.12).add(focus);
  }
  position.z+=(1-intro)*1.1;
  if(!motion.matches&&p<.94){const parallax=1-range(p,.91,.94);position.x+=pointer.x*.20*parallax;position.y-=pointer.y*.13*parallax;}
  camera.position.copy(position);camera.lookAt(focus);
  graphics.renderer.shadowMap.needsUpdate=true;
  updateCaption(p);document.body.dataset.scene=String(active);
}
async function prepareMonitor(){
  monitorRequested=true;
  if(!computerComplete||!graphics?.reveal.scene||suspended||failed)return;
  const {renderer,scene,camera,reveal}=graphics;if(reveal.warming||reveal.warmed)return;
  reveal.warming=true;
  try{
    await yieldTask();if(suspended||failed)return;
    const image=monitorImage,baked=image&&await image;
    if(image!==monitorImage)return;
    if(suspended||failed)return;
    if(baked){
      reveal.display.material.uniforms.frame.value=baked;
      reveal.display.material.uniforms.baked.value=true;
      reveal.baked=true;reveal.dirty=false;
    }else{
      // Reference/fallback path when the static asset is unavailable.
      const previous=progress;compose(.94);renderer.setRenderTarget(reveal.target);
      const compiling=preparePrograms(renderer,scene,camera,()=>!suspended&&!failed);
      renderer.setRenderTarget(null);compose(previous);
      if(!await compiling||suspended||failed)return;
      try{compose(.94);captureMonitorFrame();}finally{compose(progress);}
    }
    await yieldTask();if(suspended||failed)return;
    if(!await preparePrograms(renderer,reveal.scene,reveal.camera,()=>!suspended&&!failed)||suspended||failed)return;
    // First GPU uploads happen in a single scissored pixel, leaving the film's
    // current image intact. No frame-sized RTT is allocated for the baked view.
    const viewport=renderer.getViewport(new graphics.T.Vector4()),scissor=renderer.getScissor(new graphics.T.Vector4()),test=renderer.getScissorTest();
    reveal.camera.position.set(0,0,44);reveal.camera.lookAt(0,0,0);reveal.camera.updateMatrixWorld();
    renderer.setViewport(0,0,1,1);renderer.setScissor(0,0,1,1);renderer.setScissorTest(true);
    try{renderer.render(reveal.scene,reveal.camera);}finally{renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(test);}
    reveal.warmed=true;availableProgress=1;performance.mark('inside:monitor-ready');
  }catch(error){console.warn('Monitor reveal unavailable',error);fallback();}
  finally{reveal.warming=false;dirty=true;wake();}
}
function captureMonitorFrame(){
  const {renderer,scene,camera,reveal}=graphics;
  const aspect=camera.aspect,fov=camera.fov;
  camera.aspect=16/9;
  if(aspect>16/9)camera.fov=2*Math.atan(Math.tan(fov*Math.PI/360)*aspect/(16/9))*180/Math.PI;
  camera.updateProjectionMatrix();
  const background=scene.background,clear=renderer.getClearColor(new graphics.T.Color()),alpha=renderer.getClearAlpha();
  scene.background=null;renderer.setClearColor(0,0);renderer.setRenderTarget(reveal.target);renderer.render(scene,camera);
  scene.background=background;renderer.setClearColor(clear,alpha);camera.aspect=aspect;camera.fov=fov;camera.updateProjectionMatrix();renderer.setRenderTarget(null);reveal.dirty=false;
}
function renderFilm(prepared=false){
  const {renderer,scene,camera,reveal}=graphics;
  if(progress>=.94&&!reveal.warmed){prepareMonitor();return;}
  if(progress<.94){renderer.setRenderTarget(null);renderer.render(scene,camera);return;}
  // The exact same live scene becomes the monitor's surface. No screenshot swap.
  const aspect=camera.aspect,fov=camera.fov,screenAspect=16/9;
  if(reveal.dirty&&!reveal.baked)captureMonitorFrame();
  const t=range(progress,.94,1),half=Math.tan(fov*Math.PI/360);
  // Larger UV coverage makes the content smaller; never counter-zoom on mobile.
  reveal.display.material.uniforms.frameScale.value=mix(1,1.12,t)*(reveal.baked?Math.max(1,aspect/(16/9)):1);
  const start=Math.min(4.5/half,8/(half*aspect))-.025;
  const end=mobile()?68:44;
  reveal.camera.aspect=aspect;reveal.camera.position.set(t*.95,t*2.2,mix(start,end,t));
  reveal.camera.lookAt(0,mix(0,-1.6,t),-.025);reveal.camera.updateProjectionMatrix();
  renderer.render(reveal.scene,reveal.camera);
}
function tick(time) {
  frame=0;if(!graphics||failed||document.hidden||suspended)return;
  const dt=clamp((time-lastTime)/1000,.001,.5);lastTime=time;
  if(skipRun){
    const t=(time-skipRun.at)/2400;
    const travel=skipRun.from+(.93-skipRun.from)*ease(clamp(t));
    goTo(travel,true);
    // Finish on the assembled board. Revealing the monitor belongs to the
    // user's next scroll/drag, even if its background preparation is ready.
    if(computerComplete&&t>=1&&Math.abs(progress-.93)<.0003){skipRun=null;dirty=true;performance.mark('inside:skip-board-ready');}
  }
  const requested=motion.matches?beats.reduce((a,b)=>Math.abs(b-target)<Math.abs(a-target)?b:a):target;
  const goal=Math.min(requested,availableProgress);
  const moving=Math.abs(goal-progress)>.00003;
  const pointerMoving=Math.abs(pointer.x-pointerTarget.x)+Math.abs(pointer.y-pointerTarget.y)>.001;
  const intro=1; // Exposure is compositor-driven; no idle 3D intro redraws.
  progress=motion.matches?goal:scrollPacer.advance(progress,goal,dt,5.8);
  pointer.x=mix(pointer.x,pointerTarget.x,1-Math.exp(-3.8*dt));pointer.y=mix(pointer.y,pointerTarget.y,1-Math.exp(-3.8*dt));
  if(moving||pointerMoving||dirty||intro<1){
    if(skipRun&&progress<.94){updateCaption(progress);montage?.show(progress);}
    else{compose(progress,intro);renderFilm();if(montage&&!skipRun){montage.finish();montage=null;}}
    dirty=false;
  }
  if((moving||pointerMoving||intro<1||skipRun)&&!frame)frame=requestAnimationFrame(tick);
}
function wake(){if(!frame&&graphics&&!failed&&!document.hidden&&!suspended){lastTime=performance.now();frame=requestAnimationFrame(tick);}}
addEventListener('scroll',updateScroll,{passive:true});
addEventListener('wheel',cancelSkip,{passive:true});
addEventListener('touchstart',cancelSkip,{passive:true});
addEventListener('resize',()=>{if(innerHeight!==currentHeight||graphics?.camera.aspect!==innerWidth/innerHeight)size();},{passive:true});
addEventListener('pointermove',e=>{
  if(suspended||e.pointerType!=='mouse')return;
  if(drag){scrollTo({top:drag.scroll+(drag.y-e.clientY)*2,behavior:'instant'});return;}
  if(motion.matches)return;
  pointerTarget={x:e.clientX/innerWidth*2-1,y:e.clientY/innerHeight*2-1};wake();
},{passive:true});
$('#world').addEventListener('pointerdown',e=>{
  if(!suspended&&e.pointerType==='touch'&&!failed)scrollPacer.start(progress,totalScroll);
  if(suspended||e.pointerType!=='mouse'||e.button!==0)return;
  drag={y:e.clientY,scroll:scrollY};$('#world').setPointerCapture(e.pointerId);
});
const endDrag=()=>{drag=null;};addEventListener('pointerup',endDrag);addEventListener('pointercancel',endDrag);
$('#skip-film').addEventListener('click',()=>{
  history.replaceState(null,'','#journey');montage?.cancel();montage=createSkipMontage();montage.show(progress);skipRun={from:progress,at:performance.now()};monitorRequested=true;prepareMonitor();dirty=true;wake();
  $('#world').focus({preventScroll:true});
});
$('#world').addEventListener('lostpointercapture',endDrag);
addEventListener('pointerout',e=>{if(!e.relatedTarget){pointerTarget={x:0,y:0};wake();}});
addEventListener('hashchange',readRoute);
addEventListener('keydown',e=>{
  if(e.key==='Escape'&&skipRun){cancelSkip();return;}
  if(suspended||document.querySelector('dialog[open]')||e.altKey||e.ctrlKey||e.metaKey||e.target.closest('a,button,input,textarea,select'))return;
  if(e.key==='ArrowRight'){e.preventDefault();goTo(beats.find(p=>p>target+.025)??1);}
  if(e.key==='ArrowLeft'){e.preventDefault();goTo([...beats].reverse().find(p=>p<target-.025)??0);}
});
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(frame);frame=0;if(!document.hidden){dirty=true;wake();}});
motion.addEventListener('change',()=>{pointerTarget=pointer={x:0,y:0};dirty=true;wake();});
updateScroll();readRoute();
let stageReady,resolveBase;
const stageBase=new Promise(resolve=>{resolveBase=resolve;});
function ensureStage(){
  if(quality.still){failed=true;document.body.classList.add('failed');document.body.classList.add('ready');showRecovery('이미지 모드로 보고 있습니다');return Promise.resolve(null);}
  return stageReady ||= createStage().then(()=>graphics).catch(error=>{console.warn('3D stage unavailable:',error);fallback();resolveBase(null);return null;});
}
export async function acquireStage({full=true}={}){
  suspended=true;cancelAnimationFrame(frame);frame=0;
  requestStage(full?'full':'base');if(surfaceParked){surfaceParked=false;size();}
  const complete=ensureStage();
  const stage=await (full||quality.still?complete:stageBase);if(stage){stage.root.visible=false;stage.floor.visible=false;}return failed?null:stage;
}
export function resumeCinema(){
  suspended=false;requestStage('full');if(surfaceParked){surfaceParked=false;size();}ensureStage();if(graphics)graphics.renderer.domElement.style.touchAction='pan-y';if(graphics){graphics.root.visible=true;graphics.floor.visible=true;graphics.reveal.dirty=true;}
  active=-1;dirty=true;updateScroll();readRoute();progress=Math.min(target,availableProgress);wake();
}
export function pauseCinema(){suspended=true;stageDemand='none';scrollPacer.reset();cancelSkip();drag=null;cancelAnimationFrame(frame);frame=0;}
export function parkCinema(){pauseCinema();surfaceParked=true;if(graphics){graphics.renderer.setSize(1,1,false);graphics.reveal.target.setSize(1,1);}}

// Capture the film before routing hides it. The nested monitor projection is
// also used for the departing models, so their origins stay on the live screen.
export function captureCinema(){
  if(!graphics||failed||!computerComplete||!graphics.reveal.scene)return null;
  pauseCinema();renderFilm();
  const {T,renderer,computer,camera,reveal}=graphics,inside=progress>=.94;
  const view=camera.clone();
  if(inside){
    view.aspect=16/9;
    if(camera.aspect>16/9)view.fov=2*Math.atan(Math.tan(camera.fov*Math.PI/360)*camera.aspect/(16/9))*180/Math.PI;
    view.updateProjectionMatrix();
  }
  view.updateMatrixWorld();reveal.scene.updateMatrixWorld(true);computer.root.updateMatrixWorld(true);
  const project=v=>{
    v.project(view);
    if(inside){
      const scale=reveal.display.material.uniforms.frameScale.value;
      v.set(v.x*8/scale,v.y*4.5/scale,0).applyMatrix4(reveal.display.matrixWorld).project(reveal.camera);
    }
    return v.set((v.x+1)*innerWidth/2,(1-v.y)*innerHeight/2,v.z);
  };
  const entries=[['mainboard',computer.board.root],...Object.entries(computer.parts).filter(([id])=>id!=='io').map(([id,p])=>[id,p.model.root])];
  const models=[];
  for(const [id,root]of entries){
    if(!root.visible)continue;
    const box=new T.Box3().setFromObject(root),points=[];
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(project(new T.Vector3(x,y,z)));
    const left=Math.min(...points.map(v=>v.x)),right=Math.max(...points.map(v=>v.x)),top=Math.min(...points.map(v=>v.y)),bottom=Math.max(...points.map(v=>v.y));
    if(right<0||left>innerWidth||bottom<0||top>innerHeight)continue;
    const quaternion=view.quaternion.clone().invert().multiply(root.getWorldQuaternion(new T.Quaternion()));
    if(inside)quaternion.premultiply(reveal.camera.quaternion.clone().invert().multiply(reveal.display.getWorldQuaternion(new T.Quaternion())));
    models.push({id,root,rest:computer.rest[id],quaternion,rect:{x:left,y:top,width:right-left,height:bottom-top}});
  }
  return{stage:graphics,image:renderer.domElement.toDataURL('image/webp'),opacity:Number(getComputedStyle(renderer.domElement).opacity),models};
}
