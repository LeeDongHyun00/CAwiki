import * as T from './vendor/three/three.module.js';
import { OrbitControls } from './vendor/three/OrbitControls.js';
import { createHardware,setExploded,disposeModel } from './hardware-models.js';
import { CATALOG,modelId } from './hardware-catalog.js';
import { studioScene,fitCamera } from './hardware-scene.js';
const $=s=>document.querySelector(s), viewport=$('#viewport');
const entries=Object.entries(CATALOG);let id,model,context,controls,frame=0,dirty=true,view='perspective';
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let active=true;
$('#collection-count').textContent=String(entries.length).padStart(2,'0');$('#object-total').textContent=String(entries.length).padStart(2,'0');
for(const [i,[key,m]] of entries.entries()){
  const b=document.createElement('button');b.className='model-card';b.dataset.model=key;b.setAttribute('aria-pressed','false');
  b.innerHTML=`<span class="num">${String(i+1).padStart(2,'0')}</span><img src="./assets/models/${key}.png" alt="" width="118" height="78"><b>${m.name}</b><small>${m.tag}</small>`;
  b.addEventListener('click',()=>select(key));$('#model-list').appendChild(b);
}
function info(key){const m=CATALOG[key];$('#model-name').textContent=m.name;$('#model-product').textContent=m.model;$('#model-description').textContent=m.description;$('#model-size').textContent=m.size;$('#model-tag').textContent=m.tag;$('#model-category').textContent=m.en;
  $('#model-features').replaceChildren(...m.features.map(s=>{const li=document.createElement('li');li.textContent=s;return li;}));
  $('#accuracy-note').textContent=m.verified?'공개 사양·사진 기반 재구성. 미세 형상과 내부 배치는 근사 모델입니다.':'제품의 일반적인 구조를 표현한 학습용 모델입니다.';
  const a=$('#model-source');a.hidden=!m.source;if(m.source)a.href=m.source;
  $('#learn-link').href=`./hardware.html?hw=${['vrm','mouse'].includes(key)?({vrm:'power',mouse:'input'})[key]:key}`;
  $('#object-number').textContent=String(entries.findIndex(([k])=>k===key)+1).padStart(2,'0');
  document.querySelectorAll('.model-card').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.model===key)));
  $('#viewport').setAttribute('aria-label',`${m.name} 3D 모델. 드래그와 방향키로 회전, 휠 또는 + − 키로 확대, 0으로 초기화.`);
}
function resize(){if(!context)return;const w=viewport.clientWidth,h=viewport.clientHeight;context.renderer.setSize(w,h,false);context.camera.aspect=w/h;context.camera.updateProjectionMatrix();if(model)reset(view);dirty=true;}
function reset(which='perspective'){
  if(!model||!context)return;view=which;const {center,distance}=fitCamera(context.camera,model,viewport.clientWidth/viewport.clientHeight,which);
  controls.target.copy(center);controls.minDistance=distance*.24;controls.maxDistance=distance*3;controls.update();
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===which);b.setAttribute('aria-pressed',String(b.dataset.view===which));});dirty=true;
}
function fallback(message){viewport.replaceChildren();const img=document.createElement('img');img.className='fallback-image';img.src=`./assets/models/${id}.png`;img.alt=`${CATALOG[id].name} 3D 렌더 이미지`;viewport.appendChild(img);const p=document.createElement('p');p.className='loading';p.style.top='82%';p.textContent=message;viewport.appendChild(p);document.querySelectorAll('.view-controls button,.options button,#explode').forEach(b=>b.disabled=true);$('.live-badge').textContent='3D PREVIEW';}
function select(key,history=true){
  id=CATALOG[key]?key:'cpu';info(id);$('#download-status').textContent='';if(history){const url=new URL(location.href);url.searchParams.set('hw',id);window.history.replaceState(null,'',url);}
  $('#explode').value=0;$('#explode-value').value='0%';
  if(!context){fallback('이 브라우저에서는 WebGL을 사용할 수 없어 렌더 이미지로 표시합니다.');return;}
  if(model){context.scene.remove(model);disposeModel(model);}model=createHardware(id);context.scene.add(model);
  model.traverse(o=>{if(o.material)o.material.wireframe=$('#wire').getAttribute('aria-pressed')==='true';});
  const canExplode=model.children.some(g=>g.userData.explode>0);$('#explode').disabled=!canExplode;$('#explode-hint').textContent=canExplode?'슬라이더를 움직여 부품의 층을 분리하세요.':'이 모델은 외형 관찰을 위한 단일 조립체입니다.';
  reset();dirty=true;
}
try{
  const canvas=document.createElement('canvas');context=studioScene(canvas);viewport.replaceChildren(canvas);controls=new OrbitControls(context.camera,canvas);controls.enableDamping=!reduced;controls.dampingFactor=.08;controls.autoRotateSpeed=.7;controls.enablePan=false;controls.addEventListener('change',()=>dirty=true);resize();
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();active=false;cancelAnimationFrame(frame);controls.dispose();if(model)disposeModel(model);context.environment.dispose();context.renderer.dispose();context=null;fallback('3D 그래픽 연결이 끊겼습니다. 페이지를 새로고침해 다시 열 수 있습니다.');});
}catch(e){console.warn('3D unavailable:',e.message);context=null;}
select(modelId(new URLSearchParams(location.search).get('hw')||'cpu'),false);
new ResizeObserver(resize).observe(viewport);
$('#explode').addEventListener('input',e=>{if(!model)return;setExploded(model,Number(e.target.value)/100);$('#explode-value').value=e.target.value+'%';reset(view);});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>reset(b.dataset.view)));
$('#reset').addEventListener('click',()=>reset());
$('#rotate').addEventListener('click',e=>{if(!controls)return;const on=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',String(on));controls.autoRotate=on;dirty=true;});
$('#wire').addEventListener('click',e=>{const on=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',String(on));model?.traverse(o=>{if(o.material)o.material.wireframe=on;});dirty=true;});
viewport.addEventListener('keydown',e=>{
  if(!context||!model)return;const offset=context.camera.position.clone().sub(controls.target),s=new T.Spherical().setFromVector3(offset);
  if(e.key==='ArrowLeft')s.theta-=.12;else if(e.key==='ArrowRight')s.theta+=.12;else if(e.key==='ArrowUp')s.phi-=.12;else if(e.key==='ArrowDown')s.phi+=.12;else if(['+','='].includes(e.key))s.radius*=.9;else if(e.key==='-')s.radius*=1.1;else if(e.key==='0'){reset();e.preventDefault();return;}else return;
  e.preventDefault();s.makeSafe();s.radius=T.MathUtils.clamp(s.radius,controls.minDistance,controls.maxDistance);context.camera.position.copy(controls.target).add(new T.Vector3().setFromSpherical(s));controls.update();dirty=true;
});
const clock=new T.Clock();function tick(){if(!active)return;frame=requestAnimationFrame(tick);const dt=Math.min(clock.getDelta(),.05);if(!context||document.hidden)return;if(controls.enableDamping||controls.autoRotate)controls.update(dt);if(dirty||controls.autoRotate){context.renderer.render(context.scene,context.camera);dirty=false;}}
tick();window.addEventListener('pagehide',()=>{active=false;cancelAnimationFrame(frame);});window.addEventListener('pageshow',()=>{if(!active&&context){active=true;dirty=true;tick();}});
// Read-only diagnostics for smoke tests and local asset generation.
window.hardwareStudio={get id(){return id;},get model(){return model;},get renderer(){return context?.renderer;},get camera(){return context?.camera;},select};

$('#download-model').addEventListener('click',async()=>{
  const button=$('#download-model'),status=$('#download-status');button.disabled=true;status.textContent='3D 파일을 준비하고 있습니다…';
  let exported;
  try{
    const selected=id,{GLTFExporter}=await import('./vendor/three/GLTFExporter.js');
    exported=createHardware(selected);exported.scale.setScalar(.001); // glTF units: metres.
    exported.userData={model:CATALOG[selected].model,source:CATALOG[selected].source||null,accuracy:'Educational reconstruction; not manufacturer CAD.'};
    const data=await new GLTFExporter().parseAsync(exported,{binary:true});
    const url=URL.createObjectURL(new Blob([data],{type:'model/gltf-binary'})),a=document.createElement('a');a.href=url;a.download=`cawiki-${selected}.glb`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
    status.textContent='GLB 파일을 저장했습니다. Blender 등에서 열 수 있습니다.';
  }catch(error){status.textContent='파일을 만들지 못했습니다. 다시 시도해 주세요.';console.warn('GLB export failed:',error);}
  finally{if(exported)disposeModel(exported);button.disabled=false;}
});
