// ATX installation geometry, in millimetres. Internal details are illustrative.
import * as T from '../../lib/vendor/three/three.module.js';
import { createModelKit, createCollectionModel } from './collection-models.js';

export const UNIT=.024;
const finish=k=>({root:k.root,explode:k.explode,layers:k.layers.map(({g})=>g.name)});
// Combine static surfaces inside each moving layer. Layer / fan transforms stay
// independent; hundreds of tiny fittings no longer require separate draw calls.
function batchStaticMeshes(parent){
  for(const child of [...parent.children])if(child.isGroup)batchStaticMeshes(child);
  const batches=new Map();
  for(const mesh of parent.children){
    if(!mesh.isMesh||mesh.isInstancedMesh||Array.isArray(mesh.material))continue;
    const key=`${mesh.material.uuid}/${mesh.castShadow}/${mesh.receiveShadow}`;
    if(!batches.has(key))batches.set(key,[]);batches.get(key).push(mesh);
  }
  for(const meshes of batches.values()){
    if(meshes.length<2)continue;
    const count=meshes.reduce((sum,m)=>sum+m.geometry.attributes.position.count,0);
    const positions=new Float32Array(count*3),normals=new Float32Array(count*3),uvs=new Float32Array(count*2),indices=[];
    let offset=0;const v=new T.Vector3(),normalMatrix=new T.Matrix3();
    for(const m of meshes){
      m.updateMatrix();normalMatrix.getNormalMatrix(m.matrix);const g=m.geometry,a=g.attributes;
      for(let i=0;i<a.position.count;i++){
        v.fromBufferAttribute(a.position,i).applyMatrix4(m.matrix).toArray(positions,(offset+i)*3);
        if(a.normal)v.fromBufferAttribute(a.normal,i).applyNormalMatrix(normalMatrix).toArray(normals,(offset+i)*3);
        if(a.uv){uvs[(offset+i)*2]=a.uv.getX(i);uvs[(offset+i)*2+1]=a.uv.getY(i);}
      }
      if(g.index)for(let i=0;i<g.index.count;i++)indices.push(offset+g.index.getX(i));
      else for(let i=0;i<a.position.count;i++)indices.push(offset+i);
      offset+=a.position.count;parent.remove(m);
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('normal',new T.BufferAttribute(normals,3));geometry.setAttribute('uv',new T.BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeBoundingSphere();
    const merged=new T.Mesh(geometry,meshes[0].material);merged.castShadow=meshes[0].castShadow;merged.receiveShadow=meshes[0].receiveShadow;parent.add(merged);
  }
}
function motherboard(){
  const k=createModelKit(),{part,box,board,cyl,ring,batch,text,pins,smd}=k;
  const pcb=part('ATX multilayer PCB');board(pcb,244,305,0,0,0,'#101b1b');
  for(const x of [-113,0,113])for(const z of [-141,0,141]){
    ring(pcb,2.9,.65,x,1.1,z,'silver');cyl(pcb,1.85,.2,x,1.2,z,'black');
    cyl(pcb,3,7,x,-4,z,'steel');
  }
  const socket=part('LGA1700 socket');
  box(socket,54,4,66,-30,3,-65,'steel',1.5);box(socket,43,1.5,51,-30,5.5,-65,'black',.6);
  const contacts=[];for(let x=0;x<28;x++)for(let z=0;z<34;z++)contacts.push([-48+x*1.34,6.35,-87+z*1.32]);
  batch(socket,new T.BoxGeometry(.38,.5,.65),'gold',contacts);
  for(const x of [-54,-6])box(socket,3,1.5,62,x,7,-65,'silver');
  for(const z of [-94,-36])box(socket,47,1.5,3,-30,7,z,'silver');
  box(socket,1.5,1.5,66,0,7.4,-61,'silver',.6);cyl(socket,2,1,0,7.4,-96,'silver');
  const slots=part('DIMM · PCIe · M.2');
  for(const x of [50,64,78,92]){
    for(const dx of [-2.5,2.5])box(slots,2.3,9,140,x+dx,5.5,-53,'black',.4);
    for(const z of [-124,18])box(slots,8,12,7,x,7,z,'steel',.6);
    const pins=[];for(let j=0;j<65;j++)pins.push([x,5.8,-116+j*1.94]);
    batch(slots,new T.BoxGeometry(3,.3,.7),'gold',pins);
  }
  for(const [z,w] of [[8,94],[78,94],[120,40]]){
    for(const dz of [-3,3])box(slots,w,9,3,-34,5.5,z+dz,'steel',.4);
    box(slots,w-5,5,2,-34,4,z,'black',.2);box(slots,6,13,12,-34+w/2,6.5,z,'black');
    pins(slots,Math.round(w/.9),-34-w/2+2,5,z,.86,2,.4);
  }
  for(const z of [-12,50]){
    box(slots,5,4,24,50,3,z,'black');cyl(slots,2,3,-28,2,z,'steel');
    text(pcb,'M.2  /  PCIe 4.0',58,5,8,.78,z+19,{size:70});
  }
  const headers=part('Power · SATA · USB · fan headers');
  box(headers,12,14,52,111,8,-51,'black',.6);
  for(let x=0;x<2;x++)for(let z=0;z<12;z++)box(headers,3.3,.2,3,108+x*5,15.2,-74+z*4.1,'steel',.1);
  box(headers,23,12,12,-55,7,-140,'black');
  for(let i=0;i<8;i++)box(headers,2.4,.2,2.4,-63+(i%4)*5,13.2,-142+Math.floor(i/4)*5,'steel',.1);
  for(const z of [76,94,112]){box(headers,14,10,16,112,6,z,'black');box(headers,.3,5,10,119.1,6,z,'steel',.1);}
  for(const [x,z,n] of [[-91,142,10],[26,141,9],[72,141,10],[8,-122,4],[96,34,4],[-11,137,4]]){
    box(headers,n*2.5+4,4,7,x,3,z,'black');const points=[];for(let j=0;j<n;j++)for(const zz of [-1.5,1.5])points.push([x-n*1.25+j*2.5,6,z+zz]);
    batch(headers,new T.BoxGeometry(.55,5,.55),'gold',points);
  }
  const small=[];for(let i=0;i<170;i++)small.push([-93+(i%25)*7.4,1.45,100+Math.floor(i/25)*5]);
  for(let i=0;i<65;i++)small.push([-60+(i%13)*9,1.4,-134+Math.floor(i/13)*5]);smd(pcb,small);
  // Audio isolation zone, clock crystal and replaceable CMOS cell.
  box(pcb,1,.1,98,-101,.86,96,'gold',0);
  for(let i=0;i<7;i++)cyl(pcb,3,8,-111,5,57+i*12,'gold');
  box(pcb,13,1.5,13,-91,2,103,'black');box(pcb,9,2,4,29,2,106,'silver');
  cyl(pcb,12,2,-56,2.5,98,'black');cyl(pcb,10,2.6,-56,3.8,98,'silver');
  text(pcb,'CR2032',14,4,-56,5.15,98,{color:'#44494b',size:120});
  text(pcb,'INSIDE  /  ATX',73,8,-28,.79,143,{size:69});
  text(pcb,'LGA 1700',35,4,-31,.79,-105,{size:72});
  return finish(k);
}
function towerCooler(){
  const k=createModelKit(),{part,box,cyl,batch,wire,fan}=k;
  const foot=part('Cold plate · heat pipes'),fins=part('Aluminium fin stack',[0,45,0]),housing=part('Fan · retention clips',[0,35,90]);
  box(foot,43,5,43,0,3,0,'silver',1.5);
  for(const x of [-18,-6,6,18])wire(foot,[[x,6,-27],[x,12,-32],[x,95,-32],[x,110,-25],[x,113,25],[x,95,32],[x,12,32],[x,6,27]],3,'copper');
  const stack=[];for(let i=0;i<46;i++)stack.push([0,26+i*1.8,0]);batch(fins,new T.BoxGeometry(112,.55,67),'silver',stack);
  box(fins,113,2,68,0,109,0,'steel',1.4);
  const f=new T.Group();housing.add(f);f.position.set(0,68,49);f.rotation.x=Math.PI/2;
  for(const x of [-57,57])box(f,6,24,120,x,0,0,'black',2);
  for(const z of [-57,57])box(f,108,24,6,0,0,z,'black',2);
  fan(f,52,0,3,0,9);cyl(f,13,7,0,3,0,'black');
  for(const x of [-54,54])wire(housing,[[x,18,57],[x,16,18],[x,112,18],[x,116,55]],.8,'steel');
  for(const x of [-36,36]){box(foot,13,3,77,x,3,0,'steel');for(const z of [-35,35])cyl(foot,3,8,x,7,z,'silver');}
  return finish(k);
}
function rearIO(){
  const k=createModelKit(),{part,box,cyl,text}=k,metal=part('Rear I/O shielding'),inserts=part('USB · Ethernet · audio',[0,24,0]);
  // Long dimension is Z; exterior faces left, toward the ATX rear panel.
  box(metal,1.8,43,147,-9,21,0,'steel',.5);
  for(const z of [-59,-33,-7]){
    box(metal,23,29,23,0,15,z,'silver',.7);
    for(const y of [8,21]){box(inserts,1.9,9,16,-12,y,z,'black',.4);box(inserts,2.1,2,12,-13,y,z,'blue',.15);}
  }
  box(metal,23,23,22,0,12,20,'silver');box(inserts,2,15,17,-12.2,12,20,'black');
  for(let i=0;i<3;i++){
    const g=new T.Group();g.rotation.z=Math.PI/2;g.position.set(-12,10+i*12,49);inserts.add(g);
    cyl(g,4.4,5,0,0,0,'steel');cyl(g,3,5.2,0,0,0,'black');
  }
  text(metal,'REAR  I/O',17,115,0,30,0,{size:80});return finish(k);
}
export function createComputer(){
  const root=new T.Group(),board=motherboard(),parts={};root.name='ATX computer';root.add(board.root);board.root.scale.setScalar(UNIT);
  const ramRotation=new T.Euler().setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(0,0,1),new T.Vector3(-1,0,0),new T.Vector3(0,-1,0))).toArray().slice(0,3);
  const definitions=[
    ['cpu',[-30,7,-65],[0,0,0],.115],
    // Presentation layout: the GPU sits flat below the board, like the PSU
    // beside it, so neither the PCB nor its sockets are obscured.
    ['gpu',[-2,-10,280],[0,0,0],.023],
    ['dram',[64,23,-53],ramRotation,.055],
    ['ssd',[10,4,-12],[0,0,0],.082],
    ['hdd',[212,-3,101],[0,-.08,0],.044],
    ['cooling',[-30,11,-65],[0,0,0],.041],
    ['power',[217,20,-91],[0,0,0],.041],
    ['vrm',[-83,2,-64],[0,Math.PI/2,0],.069],
    ['coproc',[63,2,101],[0,0,0],.15],
    ['spirom',[39,2,132],[0,0,0],.8],
    ['nic',[-34,43,92],[Math.PI/2,0,0],.055],
    ['io',[-112,1,-65],[0,0,0],.055],
  ];
  for(const [id,pos,rot,heroScale] of definitions){
    const model=id==='cooling'?towerCooler():id==='io'?rearIO():createCollectionModel(id);
    const install=new T.Vector3(...pos).multiplyScalar(UNIT);install.y-=1.8;
    const installedRotation=new T.Quaternion().setFromEuler(new T.Euler(...rot));
    const heroRotation=new T.Quaternion().setFromEuler(new T.Euler(id==='io'?.3:.04,id==='io'?.9:-.22,id==='dram'?-.3:0));
    const assembled=new T.Box3().setFromObject(model.root);model.explode(1);
    const expanded=new T.Box3().setFromObject(model.root);model.explode(0);
    parts[id]={id,model,install,installedRotation,heroRotation,heroScale,assembled,expanded};root.add(model.root);
  }
  const ram2=createCollectionModel('dram');ram2.root.scale.setScalar(UNIT);ram2.root.position.set(92*UNIT,23*UNIT-1.8,-53*UNIT);ram2.root.rotation.set(...ramRotation);root.add(ram2.root);
  // Sleeved cables physically link external drives / supply to their headers.
  const k=createModelKit(),cables=k.root;cables.scale.setScalar(UNIT);cables.position.y=-1.8;root.add(cables);
  // Build tubes in local millimetres; deterministic curves are reversible with scroll.
  const wires=[
    [[217,-15,-18],[174,-18,2],[149,5,-12],[114,15,-51]],
    [[180,-15,-43],[151,-20,-160],[-25,2,-163],[-55,14,-140]],
    [[208,-15,-8],[243,-19,27],[227,-17,65],[207,-2,172]],
    [[112,7,94],[146,-14,127],[171,-16,185],[208,1,176]],
    [[-34,6,8],[-139,-4,8],[-155,-12,208],[-51,-13,236]],
  ];
  wires.forEach((points,j)=>{for(let i=0;i<(j===3?1:4);i++)k.wire(cables,points.map(([x,y,z])=>[x+i*2.2,y,z]),j===3?1.3:.8);});
  batchStaticMeshes(root);
  return{root,board,parts,ram2,cables};
}

export function createScreenReveal(environment){
  const scene=new T.Scene();scene.background=new T.Color(0xecece9);scene.environment=environment;scene.environmentIntensity=.75;
  const key=new T.DirectionalLight(0xfff8ef,3);key.position.set(-5,10,7);scene.add(key,new T.HemisphereLight(0xe8eef5,0x797974,1.1));
  const k=createModelKit(),monitor=k.root;scene.add(monitor);
  const body=k.part('Machined display'),stand=k.part('Aluminium stand');
  // 16:9 active display, 5 mm side bezels, a thin bevel and rear housing.
  k.box(body,16.34,9.42,.35,0,0,-.22,'black',.12);k.box(body,16.24,9.32,.45,0,0,-.48,'steel',.1);
  k.box(stand,.8,3.1,.75,0,-5.6,-.8,'silver',.12);k.box(stand,6,.15,3.8,0,-7.05,.1,'steel',.13);
  k.box(body,.12,.03,.04,7.8,-4.61,-.025,new T.MeshBasicMaterial({color:0xadc5c0}),.01);
  const target=new T.WebGLRenderTarget(1536,864,{samples:2,type:T.HalfFloatType});target.texture.colorSpace=T.LinearSRGBColorSpace;
  // Offscreen Three renders are linear HDR. Tone-map the hardware once, then
  // composite the un-tonemapped page background, exactly like the direct view.
  const screenMaterial=new T.ShaderMaterial({
    uniforms:{frame:{value:target.texture},paper:{value:new T.Color(0xecece9)},frameScale:{value:1}},
    vertexShader:'varying vec2 screenUv;void main(){screenUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`uniform sampler2D frame;uniform vec3 paper;uniform float frameScale;varying vec2 screenUv;
      void main(){vec2 sampleUv=(screenUv-0.5)*frameScale+0.5;vec4 source=texture2D(frame,sampleUv);
      source*=step(0.0,sampleUv.x)*step(sampleUv.x,1.0)*step(0.0,sampleUv.y)*step(sampleUv.y,1.0);
      gl_FragColor=vec4(source.rgb/max(source.a,0.00001),1.0);
      #include <tonemapping_fragment>
      gl_FragColor.rgb=mix(paper,gl_FragColor.rgb,source.a);
      #include <colorspace_fragment>
      }`,
    toneMapped:true,
  });
  const display=new T.Mesh(new T.PlaneGeometry(16,9),screenMaterial);display.position.z=-.025;monitor.add(display);
  const floor=new T.Mesh(new T.PlaneGeometry(300,300),new T.MeshBasicMaterial({color:0xecece9,toneMapped:false}));floor.rotation.x=-Math.PI/2;floor.position.y=-7.17;scene.add(floor);
  const shadow=document.createElement('canvas');shadow.width=512;shadow.height=128;const c=shadow.getContext('2d'),g=c.createRadialGradient(256,64,0,256,64,230);g.addColorStop(0,'#0005');g.addColorStop(1,'#0000');c.fillStyle=g;c.fillRect(0,0,512,128);
  const contact=new T.Mesh(new T.PlaneGeometry(22,8),new T.MeshBasicMaterial({map:new T.CanvasTexture(shadow),transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.set(0,-7.15,.3);scene.add(contact);
  const keyboard=createCollectionModel('input'),mouse=createCollectionModel('mouse');keyboard.root.scale.setScalar(.025);keyboard.root.position.set(-1,-6.86,4.4);mouse.root.scale.setScalar(.028);mouse.root.position.set(5.3,-7.02,4.6);scene.add(keyboard.root,mouse.root);
  const camera=new T.PerspectiveCamera(31,1,.08,200);
  for(const child of scene.children)if(child.isGroup)batchStaticMeshes(child);
  return{scene,camera,target,monitor,display,dirty:true};
}
