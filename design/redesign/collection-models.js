// Dimensions are millimetres. Internal assemblies are illustrative reconstructions.
import * as T from '../../lib/vendor/three/three.module.js';
import { RoundedBoxGeometry } from '../../lib/vendor/three/RoundedBoxGeometry.js';
import { createProcessor, createGraphicsCard, createSupportingPart } from './hero-models.js';
import { buildMouse } from './mouse-model.js';

const palette={
  pcb:[0x12392c,.25,.55],black:[0x111519,.18,.43],rubber:[0x080a0c,0,.72],
  silver:[0x9ba4ad,.94,.29],steel:[0x626a71,.88,.36],gold:[0xc9a565,.95,.28],
  copper:[0xad713f,.9,.32],white:[0xd6d4cc,.15,.4],ceramic:[0x81785d,.05,.58],blue:[0x27323f,.7,.3],
};
function seeded(seed=47){return()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);}
function canvasMap(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.anisotropy=8;return t;}
export function createModelKit(){
  const materials={};for(const [name,[color,metalness,roughness]] of Object.entries(palette))materials[name]=new T.MeshStandardMaterial({color,metalness,roughness});
  const grain=canvasMap(512,512,(c,w,h)=>{const r=seeded();c.fillStyle='#aaa';c.fillRect(0,0,w,h);for(let i=0;i<2000;i++){c.strokeStyle=`rgba(110,110,110,${r()*.25})`;c.beginPath();const y=r()*h;c.moveTo(0,y);c.lineTo(w,y+.1);c.stroke();}});
  for(const name of ['silver','steel','copper']){materials[name].roughnessMap=grain;materials[name].bumpMap=grain;materials[name].bumpScale=.012;}
  const root=new T.Group(),layers=[];
  function mesh(g,geo,mat,x=0,y=0,z=0){const m=new T.Mesh(geo,typeof mat==='string'?materials[mat]:mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);return m;}
  function box(g,w,h,d,x=0,y=0,z=0,mat='black',r=.3){return mesh(g,r?new RoundedBoxGeometry(w,h,d,3,Math.min(r,h*.4,w*.4,d*.4)):new T.BoxGeometry(w,h,d),mat,x,y,z);}
  function cyl(g,r,h,x=0,y=0,z=0,mat='silver',r2=r){return mesh(g,new T.CylinderGeometry(r,r2,h,48),mat,x,y,z);}
  function ring(g,r,t,x,y,z,mat='steel'){const m=mesh(g,new T.TorusGeometry(r,t,10,80),mat,x,y,z);m.rotation.x=-Math.PI/2;return m;}
  function part(name,shift=[0,0,0]){const g=new T.Group();g.name=name;root.add(g);layers.push({g,shift:new T.Vector3(...shift)});return g;}
  function batch(g,geo,mat,positions){const m=new T.InstancedMesh(geo,typeof mat==='string'?materials[mat]:mat,positions.length),o=new T.Object3D();positions.forEach((p,i)=>{o.position.set(...p);o.rotation.set(0,0,0);if(p[3])o.rotation.y=p[3];o.updateMatrix();m.setMatrixAt(i,o.matrix);});m.castShadow=m.receiveShadow=true;g.add(m);return m;}
  function text(g,words,w,d,x,y,z,{bg=null,color='#b3b9ba',size=68,front=false}={}){
    const tex=canvasMap(1024,Math.max(128,Math.round(1024*d/w)),(c,cw,ch)=>{if(bg){c.fillStyle=bg;c.fillRect(0,0,cw,ch);}c.fillStyle=color;c.font=`500 ${size}px Arial`;c.textAlign='center';c.textBaseline='middle';words.split('\n').forEach((line,i,all)=>c.fillText(line,cw/2,ch/2+(i-(all.length-1)/2)*size*1.45,cw*.9));});tex.colorSpace=T.SRGBColorSpace;
    const m=mesh(g,new T.PlaneGeometry(w,d),new T.MeshStandardMaterial({map:tex,transparent:!bg,metalness:.15,roughness:.5,side:T.DoubleSide}),x,y,z);if(!front)m.rotation.x=-Math.PI/2;return m;
  }
  function board(g,w,d,x=0,y=0,z=0,color='#13372c'){
    box(g,w,1.4,d,x,y,z,'pcb',.45);
    const tex=canvasMap(1024,1024,(c,cw,ch)=>{const random=seeded(122);c.fillStyle=color;c.fillRect(0,0,cw,ch);for(let i=0;i<170;i++){const px=random()*cw,py=random()*ch,len=20+random()*130;c.strokeStyle='#31544c';c.lineWidth=.7;c.beginPath();c.moveTo(px,py);c.lineTo(px+len,py);c.lineTo(px+len+16,py+16);c.lineTo(px+len+16,py+55);c.stroke();c.strokeStyle='#798479';c.beginPath();c.arc(px,py,1.8,0,Math.PI*2);c.stroke();}});tex.colorSpace=T.SRGBColorSpace;
    const m=mesh(g,new T.PlaneGeometry(w-.7,d-.7),new T.MeshStandardMaterial({map:tex,metalness:.2,roughness:.62}),x,y+.71,z);m.rotation.x=-Math.PI/2;
  }
  function screws(g,w,d,y,r=1.3){for(const x of [-w/2,w/2])for(const z of [-d/2,d/2]){cyl(g,r,.45,x,y,z,'steel');box(g,r*1.35,.07,.23,x,y+.27,z,'black',0);}}
  function pins(g,count,x,y,z,step=1.2,length=4,width=.7){const pts=[];for(let i=0;i<count;i++)pts.push([x+i*step,y,z]);return batch(g,new T.BoxGeometry(width,.12,length),'gold',pts);}
  function smd(g,positions){batch(g,new T.BoxGeometry(1.6,.8,.9),'ceramic',positions);batch(g,new T.BoxGeometry(.3,.85,.94),'silver',positions.flatMap(p=>[[p[0]-.8,p[1],p[2]],[p[0]+.8,p[1],p[2]]]));}
  function fan(g,r,x,y,z,blades=9){
    const f=new T.Group();f.position.set(x,y,z);g.add(f);ring(f,r,.7,0,0,0,'steel');cyl(f,r*.22,r*.065,0,1,0,'black');
    const v=[],idx=[];for(let i=0;i<=16;i++)for(let j=0;j<=6;j++){const u=i/16,q=j/6,rr=r*(.2+.76*u),a=u*u*.5+(q-.5)*.52;v.push(rr*Math.cos(a),r*.065*((q-.5)*u+Math.sin(u*Math.PI)*.3),rr*Math.sin(a));if(i<16&&j<6){const n=i*7+j;idx.push(n,n+7,n+1,n+1,n+7,n+8);}}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.setIndex(idx);geo.computeVertexNormals();const mat=materials.black.clone();mat.side=T.DoubleSide;
    for(let i=0;i<blades;i++){const m=mesh(f,geo,mat,0,1,0);m.rotation.y=i*Math.PI*2/blades;}return f;
  }
  function wire(g,points,r=.7,mat='black'){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));return mesh(g,new T.TubeGeometry(curve,32,r,8,false),mat);}
  return{root,materials,part,mesh,box,cyl,ring,batch,text,board,screws,pins,smd,fan,wire,layers,explode(t){for(const {g,shift} of layers)g.position.copy(shift).multiplyScalar(t);}};
}

function memory(k){
  const {part,board,box,pins,text,smd}=k,b=part('DDR5 기판'),chips=part('전면 DRAM · 전원 관리',[0,18,0]),back=part('후면 DRAM',[0,-18,0]);board(b,133.35,31.25);pins(b,64,-62,.83,13.3,.9,3.4,.62);pins(b,66,4,.83,13.3,.9,3.4,.62);pins(b,64,-62,-.83,13.3,.9,3.4,.62);
  for(const side of [-1,1])for(let i=0;i<8;i++){const x=-56+i*16;box(side>0?chips:back,11.4,1.6,12.5,x,side*1.65,-1,'black',.3);if(side>0)text(chips,'SK hynix\nDDR5',9,6,x,2.46,-1,{size:88});}
  box(chips,5,1,5,0,1.25,9,'steel');smd(b,Array.from({length:30},(_,i)=>[-59+i*4,1.12,-11]));text(b,'DDR5  /  288 PIN',55,3,-27,.78,-13,{size:51});
}
function storage(k){
  const {part,board,box,pins,ring,cyl,smd,text}=k,b=part('M.2 기판'),chips=part('컨트롤러 · NAND',[0,9,0]),label=part('제품 라벨',[0,20,0]);board(b,80,22,0,0,0,'#11191a');ring(b,2.2,.5,-37,.9,0,'gold');cyl(b,1.6,.1,-37,1,0,'black');
  const contacts=[];for(let i=0;i<24;i++)if(i!==5&&i!==6)contacts.push([38,.8,-9+i*.77]);k.batch(b,new T.BoxGeometry(4,.12,.48),'gold',contacts);
  for(const x of [-23,-5]){box(chips,15,1.1,17,x,1.3,0,'black');text(chips,'SAMSUNG\nV-NAND',12,7,x,1.86,0,{size:86});}box(chips,10,1,12,23,1.2,0,'steel');box(chips,6,1,9,11,1.2,0,'black');smd(b,Array.from({length:18},(_,i)=>[-31+i*3.8,1.1,-9.7]));text(label,'SAMSUNG   990 PRO\nPCIe 4.0 NVMe  /  2TB',58,17,-6,2,0,{bg:'#121517',color:'#d8dcdd',size:64});
}
function disk(k){
  const {part,box,cyl,ring,text,screws,mesh}=k,b=part('드라이브 하우징'),drive=part('플래터 · 헤드',[0,22,0]),lid=part('밀폐 커버',[0,78,0]);
  box(b,101.85,20,146.99,0,0,0,'black',3);box(b,96,2,141,0,10,0,'steel',2);
  const chrome=new T.MeshPhysicalMaterial({color:0xb2b6bb,metalness:1,roughness:.13,anisotropy:.85});
  for(const y of [13,16]){cyl(drive,45,1,0,y,-19,chrome);for(let r=15;r<44;r+=4)ring(drive,r,.035,0,y+.54,-19,'steel');}cyl(drive,11,5,0,17,-19,'silver');cyl(drive,5.5,5.5,0,17.5,-19,'steel');
  for(let i=0;i<6;i++){const a=i*Math.PI/3;cyl(drive,.8,.2,8*Math.cos(a),20.1,-19+8*Math.sin(a),'black');}
  cyl(drive,8,5,30,15,42,'silver');const arm=box(drive,7,1.8,60,17,19,17,'silver',.7);arm.rotation.y=-.47;box(drive,24,9,17,21,15,57,'black',2);box(drive,3,1,5,3,19,-10,'steel');
  box(lid,101,2,146,0,22,0,'silver',3);screws(lid,86,130,23.1,2);text(lid,'SEAGATE\nBARRACUDA\n3.5 HDD  /  SATA',68,77,0,23.11,-8,{bg:'#e0dfd8',color:'#313538',size:68});box(b,66,4,4,-7,-3,75,'black');k.pins(b,22,-36,-.9,76,2.5,3.5,1.5);
}
function cooling(k){
  const {part,mesh,box,cyl,fan,wire}=k,frame=part('프레임'),rotor=part('임펠러 · 모터',[0,35,0]);
  const shape=new T.Shape();shape.moveTo(-60,-60);shape.lineTo(60,-60);shape.lineTo(60,60);shape.lineTo(-60,60);shape.closePath();const hole=new T.Path();hole.absarc(0,0,56,0,Math.PI*2,true);shape.holes.push(hole);const geo=new T.ExtrudeGeometry(shape,{depth:25,bevelEnabled:true,bevelSize:.8,bevelThickness:.5,bevelSegments:3});geo.rotateX(-Math.PI/2);mesh(frame,geo,'black',0,-12.5,0);
  for(const x of [-52,52])for(const z of [-52,52]){box(frame,14,2,14,x,13,z,'rubber',2);cyl(frame,2.6,.2,x,14.1,z,'steel');cyl(frame,1.9,.25,x,14.25,z,'black');}
  for(let i=0;i<4;i++){const s=box(frame,5,2,112,0,-10,0,'steel');s.rotation.y=i*Math.PI/2+.38;}fan(rotor,53,0,5,0,9);cyl(rotor,13,8,0,2,0,'black');wire(frame,[[56,-6,51],[70,-8,64],[87,-10,61],[99,-10,70]],1);box(frame,8,5,7,100,-10,70,'black');
}
function supply(k){
  const {part,box,board,cyl,ring,fan,screws,text,wire,batch}=k,base=part('전원 회로'),caseTop=part('섀시 · 냉각 팬',[0,65,0]);
  box(base,150,2,140,0,-42,0,'steel',1);board(base,138,128,0,-36,0,'#153a2c');
  for(const x of [-35,-7])cyl(base,12,34,x,-18,-20,'black');cyl(base,8,22,40,-23,-37,'silver');box(base,37,30,35,7,-20,22,'ceramic',2);box(base,29,24,28,7,-16,22,'copper',1);
  for(const x of [-55,52])for(let i=0;i<8;i++)box(base,1.5,29,36,x+i*2,-21,17,'silver',.15);
  wire(base,[[-47,-33,38],[-33,-6,45],[27,0,52],[55,-30,58]],1.5,'copper');
  for(const z of [-69,69])box(base,150,84,2,0,0,z,'black',1);for(const x of [-74,74])box(base,2,84,138,x,0,0,'black',1);
  // The lid lifts with the grille and fan; circuits remain in the lower chassis.
  const plate=new T.Shape();plate.moveTo(-75,-70);plate.lineTo(75,-70);plate.lineTo(75,70);plate.lineTo(-75,70);plate.closePath();const hole=new T.Path();hole.absarc(0,0,58,0,Math.PI*2,true);plate.holes.push(hole);const g=new T.ExtrudeGeometry(plate,{depth:2,bevelEnabled:false});g.rotateX(-Math.PI/2);k.mesh(caseTop,g,'black',0,42,0);fan(caseTop,54,0,34,0,7);
  for(let r=13;r<59;r+=5)ring(caseTop,r,.65,0,45,0,'steel');for(const a of [-.75,.75]){const rail=box(caseTop,128,1.4,1.5,0,46,0,'steel');rail.rotation.y=a;}screws(caseTop,135,123,44,1.8);
  for(let i=0;i<5;i++)for(let j=0;j<2;j++){box(base,17,12,2,-49+i*24,-16+j*26,71,'steel',1);box(base,13,9,2.2,-49+i*24,-16+j*26,72,'black',.7);}
  text(base,'ATX  /  750W',100,17,0,17,70.15,{front:true,size:100});
}
function semiconductor(k,id){
  const {part,board,box,batch,text,cyl}=k;
  const specs={npu:[48,48,'NEURAL ENGINE',0x385f65],sram:[25,25,'SRAM',0x56646b],vram:[32,28,'GDDR6X',0x49464e],coproc:[35,35,'I/O CONTROLLER',0x4a565f]};
  const [w,d,title,color]=specs[id],base=part('BGA 패키지'),die=part('실리콘',[0,w*.4,0]),cap=part('패키지 덮개',[0,w*.88,0]);board(base,w,d,0,0,0,'#142b28');
  const balls=[];for(let x=-w*.42;x<w*.44;x+=1.5)for(let z=-d*.42;z<d*.44;z+=1.5)if(Math.abs(x)>w*.15||Math.abs(z)>d*.15)balls.push([x,-1.1,z]);batch(base,new T.SphereGeometry(.42,10,8),'silver',balls);
  box(die,w*.55,.8,d*.58,0,1.2,0,new T.MeshPhysicalMaterial({color,metalness:.9,roughness:.2,iridescence:.5,clearcoat:1}),.2);
  const points=[];for(let x=-w*.25;x<w*.25;x+=1.2)points.push([x,1.64,-d*.27]);batch(die,new T.BoxGeometry(.4,.05,d*.52),'copper',points);
  box(cap,w*.85,2.3,d*.85,0,2,0,id==='npu'?'silver':'black',.6);text(cap,title+'\n'+({npu:'MATRIX COMPUTE',sram:'LOW LATENCY',vram:'GRAPHICS MEMORY',coproc:'PLATFORM HUB'}[id]),w*.76,d*.46,0,3.17,0,{color:id==='npu'?'#353b40':'#aeb4b7',size:id==='coproc'?59:76});cyl(cap,.65,.08,-w*.33,3.2,d*.32,'ceramic');
}
function flash(k){
  const {part,box,text,batch}=k,b=part('리드 프레임'),die=part('메モリ 다이',[0,3,0]),cap=part('SOIC 패키지',[0,7,0]);
  const pins=[];for(const x of [-3.2,3.2])for(let i=0;i<4;i++)pins.push([x,-.5,-1.9+i*1.27]);batch(b,new T.BoxGeometry(1.8,.25,.4),'silver',pins);box(b,4,.25,4,0,-.4,0,'copper',.1);box(die,2.2,.3,2.6,0,-.05,0,'blue',.1);box(cap,5,1.6,6,0,.3,0,'black',.25);text(cap,'25Q128\nSPI FLASH',4,3,0,1.11,0,{size:87});
}
function voltage(k){
  const {part,board,box,cyl,text,ring,smd}=k,b=part('전원부 기판'),components=part('초크 · 커패시터',[0,23,0]),heat=part('방열판',[0,42,0]);board(b,100,38);smd(b,Array.from({length:24},(_,i)=>[-46+i*4,1.1,15]));
  for(let i=0;i<6;i++){const x=-41+i*16;box(components,11,9,11,x,5,-7,'steel',1);text(components,'R22',8,4,x,9.55,-7,{size:115});cyl(components,4,12,x,7,9,'silver');cyl(components,3.6,.15,x,13.1,9,'black');box(b,6,1.7,5,x,1.8,-7,'black');}
  box(heat,100,1.6,12,0,11,-8,'black');for(let i=0;i<26;i++)box(heat,1.5,9,12,-47+i*3.7,16,-8,'steel',.2);
}
function bus(k){
  const {part,board,box,pins,text}=k,b=part('PCIe 배선'),contacts=part('접점',[0,12,0]),housing=part('슬롯 하우징',[0,24,0]);board(b,100,32);box(housing,90,12,4.3,0,7,-3,'black',.7);box(housing,90,12,4.3,0,7,3,'black',.7);for(const x of [-44,44])box(housing,3,12,10,x,7,0,'black',.7);box(housing,4,15,12,48,7,0,'steel',.6);pins(contacts,64,-40,5,0,1.25,4,.65);text(b,'PCI EXPRESS  ×16',60,5,0,.78,12,{size:68});
}
function network(k){
  const {part,board,box,pins,cyl,text}=k,b=part('PCIe 기판'),chip=part('이더넷 컨트롤러',[0,18,0]),shield=part('포트 · 방열판',[0,38,0]);board(b,112,68);pins(b,32,-43,.8,33,1.8,4,1.05);
  box(chip,26,2,26,-19,2,0,'black',.6);text(chip,'ETHERNET\nCONTROLLER',23,14,-19,3.1,0,{size:68});
  box(shield,31,18,30,35,10,-17,'silver',1);box(shield,31.2,12,22,35,10,-32.1,'black',.7);box(b,4,74,3,54,25,-32,'steel');for(let i=0;i<10;i++)box(shield,1.3,11,29,-32+i*2.8,9,0,'steel',.2);for(let i=0;i<5;i++)cyl(b,2.2,5,-39+i*17,3,22,'silver');
}
function router(k){
  const {part,board,box,wire,cyl,text}=k,b=part('네트워크 기판'),lid=part('통풍 커버',[0,65,0]),aerial=part('안테나',[0,22,0]);box(b,220,4,145,0,-15,0,'black',4);board(b,198,125,0,-10,0,'#15362b');
  for(const x of [-55,8,66]){box(b,35,3,31,x,-6,0,'silver',1);wire(b,[[x,-6,3],[x,-2,-40],[x+20,0,-65]],.5,'copper');}for(let i=0;i<5;i++){box(b,25,17,4,-65+i*31,-2,-74,'steel',1);box(b,18,11,4.2,-65+i*31,-2,-76,'black',.7);}
  box(lid,220,28,145,0,1,0,'black',5);for(let i=0;i<38;i++)box(lid,1.8,.3,103,-100+i*5.4,15.1,0,'steel',.1);for(const x of [-91,-30,30,91]){const a=box(aerial,8,115,9,x,60,-65,'black',3);a.rotation.z=x*.002;cyl(aerial,5,12,x,3,-64,'steel');}text(lid,'W I — F I',72,14,0,15.3,22,{size:120});for(let i=0;i<5;i++)box(lid,2,1,1,-16+i*8,5,73,new T.MeshStandardMaterial({color:0x659d89,emissive:0x183c2c}),.2);
}
function monitor(k){
  const {part,box,cyl,text,mesh}=k,base=part('스탠드 · 백커버'),panel=part('LCD 패널',[0,0,85]),glass=part('전면 유리',[0,0,150]);box(base,530,310,16,0,205,-8,'black',6);box(base,35,113,26,0,50,-10,'silver',4);box(base,220,6,150,0,0,15,'steel',3);
  box(panel,520,299,3,0,205,1,'steel',3);box(glass,530,310,2,0,205,9,'black',4);
  const map=canvasMap(1536,864,(c,w,h)=>{const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#0a141b');g.addColorStop(1,'#345466');c.fillStyle=g;c.fillRect(0,0,w,h);for(let i=0;i<16;i++){c.strokeStyle=`rgba(172,211,223,${.06+i*.002})`;c.lineWidth=2;c.beginPath();c.ellipse(w*.55,h*.64,180+i*32,70+i*21,-.4,0,Math.PI*2);c.stroke();}c.fillStyle='#b0c6cc';c.font='300 24px Arial';c.fillText('EVERY PIXEL, A POSSIBILITY',70,h-64);});map.colorSpace=T.SRGBColorSpace;
  mesh(glass,new T.PlaneGeometry(508,286),new T.MeshBasicMaterial({map}),0,205,10.1);
  for(let i=0;i<8;i++)box(base,12,4,1,-82+i*23,70,-17,'steel',.5);cyl(base,18,5,0,140,-12,'steel');
}
function keyboard(k){
  const {part,board,box,text,batch}=k,base=part('알루미늄 하우징'),pcb=part('스위치 기판',[0,27,0]),keys=part('키캡',[0,57,0]);box(base,360,15,135,0,0,0,'steel',5);board(pcb,350,124,0,9,0,'#173632');
  const rows=['1234567890-+=','QWERTYUIOP[]','ASDFGHJKL;','ZXCVBNM,.'];const switches=[];
  rows.forEach((s,row)=>[...s].forEach((c,i)=>{const x=-155+i*25+row*4,z=-46+row*25;switches.push([x,15,z]);box(keys,21.8,9,21,x,18,z,'black',2);text(keys,c,11,11,x,22.55,z,{size:180});}));
  batch(pcb,new T.BoxGeometry(13,7,13),'white',switches);box(keys,143,9,21,-30,18,54,'black',2);for(const x of [-150,-121,63,92,121,150])box(keys,22,9,21,x,18,54,'black',2);text(base,'MECHANICAL',55,5,140,7.6,-60,{size:81});
}
function mouse(k){
  buildMouse(k);
}
function speaker(k){
  const {part,box,cyl,ring,mesh}=k,cabinet=part('인클로저'),driver=part('드라이버',[0,0,58]),front=part('배플',[0,0,105]);box(cabinet,116,190,117,0,95,-4,'black',5);
  const baffle=new T.Shape();baffle.moveTo(-57,-93.5);baffle.lineTo(57,-93.5);baffle.lineTo(57,93.5);baffle.lineTo(-57,93.5);baffle.closePath();
  for(const [y,r] of [[64,40],[144,21]]){const opening=new T.Path();opening.absarc(0,y-95,r,0,Math.PI*2,true);baffle.holes.push(opening);}
  mesh(front,new T.ExtrudeGeometry(baffle,{depth:5,bevelEnabled:true,bevelSize:.5,bevelThickness:.5,bevelSegments:3,curveSegments:48}),'rubber',0,95,55);
  for(const [y,r] of [[64,39],[144,20]]){const g=new T.Group();g.position.set(0,y,62);g.rotation.x=Math.PI/2;driver.add(g);cyl(g,r,4,0,0,0,'steel');const cone=mesh(g,new T.ConeGeometry(r*.86,9,64,1,true),'black',0,3,0);cone.rotation.z=Math.PI;ring(g,r*.83,2,0,6,0,'rubber');cyl(g,r*.28,9,0,7,0,'black');ring(g,r-1,.5,0,3,0,'silver');}
  for(const x of [-48,48])for(const y of [13,177]){const screw=cyl(front,2,.5,x,y,60,'steel');screw.rotation.x=Math.PI/2;}box(cabinet,68,3,80,0,-1,0,'rubber',3);
}
function camera(k){
  const {part,box,cyl,ring,mesh,board}=k,base=part('클립 · 센서 기판'),shell=part('하우징',[0,32,0]),lens=part('렌즈 그룹',[0,0,35]);box(base,43,6,40,0,3,-6,'black',3);box(base,30,20,8,0,13,-18,'steel',2);board(base,75,22,0,26,0,'#133c2f');box(shell,96,30,30,0,29,0,'black',9);
  const barrel=new T.Group();barrel.position.set(0,29,18);barrel.rotation.x=Math.PI/2;lens.add(barrel);cyl(barrel,12,8,0,0,0,'steel');cyl(barrel,10.4,9,0,1,0,'black');const optical=new T.MeshPhysicalMaterial({color:0x193f5a,metalness:.6,roughness:.08,clearcoat:1,iridescence:.65});cyl(barrel,7.6,9.2,0,1.5,0,optical);ring(barrel,8.2,.32,0,6.2,0,'silver');
}
function rack(k){
  const {part,box,batch,cyl,text,fan}=k,frame=part('랙 프레임'),door=part('전면 도어',[0,0,210]);
  for(const x of [-280,280])for(const z of [-280,280])box(frame,24,1120,24,x,560,z,'steel',2);for(const y of [10,1120])box(frame,600,22,600,0,y,0,'black',3);
  for(const x of [-250,250]){box(frame,14,1080,10,x,560,295,'silver',1);const holes=[];for(let i=0;i<80;i++)holes.push([x,36+i*13,301]);batch(frame,new T.BoxGeometry(6,5,1),'black',holes);}
  for(let i=0;i<8;i++){
    const tray=part(`서버 ${i+1}`,[0,0,65+(i%3)*36]);box(tray,490,101,530,0,93+i*130,7,'steel',3);box(tray,497,98,5,0,93+i*130,275,'black',2);
    for(let j=0;j<6;j++){box(tray,65,73,3,-197+j*79,93+i*130,279,'steel',1);box(tray,54,62,3.2,-197+j*79,93+i*130,281,'black',1);box(tray,3,5,4,-216+j*79,113+i*130,284,'gold',.4);}
    for(const x of [-234,234]){box(tray,5,61,18,x,93+i*130,290,'silver',2);}
    text(tray,`NODE 0${i+1}`,64,9,194,53+i*130,280,{front:true,size:100});
  }
  // Sparse perforated door reveals the bays without an opaque placeholder.
  for(const x of [-284,284])box(door,20,1088,17,x,560,316,'black',2);for(const y of [24,1102])box(door,588,20,17,0,y,316,'black',2);
  const grille=[];for(let x=-265;x<270;x+=12)grille.push([x,562,317]);batch(door,new T.BoxGeometry(1.1,1050,1.1),'steel',grille);box(door,13,130,22,258,570,334,'silver',3);
}

const builders={dram:memory,ssd:storage,hdd:disk,cooling,power:supply,npu:k=>semiconductor(k,'npu'),sram:k=>semiconductor(k,'sram'),vram:k=>semiconductor(k,'vram'),coproc:k=>semiconductor(k,'coproc'),spirom:flash,vrm:voltage,bus,nic:network,infra:router,display:monitor,input:keyboard,mouse,audio:speaker,camera,datacenter:rack};
export function createCollectionModel(id){
  if(id==='cpu'){const m=createProcessor();return{root:m.root,explode:t=>m.animate(t),layers:['기판','실리콘 다이','히트스프레더']};}
  if(id==='gpu'){const m=createGraphicsCard();return{root:m.root,explode:t=>{m.animate(t,t*Math.PI);m.pcb.position.y=-15*t;},layers:['그래픽 기판','방열판','프레임 · 팬']};}
  if(id==='mainboard'){
    const root=createSupportingPart(id),groups=[];root.traverse(o=>{if(o.userData.explode!==undefined)groups.push(o);});
    return{root,explode:t=>groups.forEach(o=>o.position.y=o.userData.explode*t),layers:groups.map(o=>o.name)};
  }
  if(!builders[id])throw new Error(`Unknown hardware: ${id}`);
  const k=createModelKit();builders[id](k);k.root.name=id;
  return{root:k.root,explode:k.explode,layers:k.layers.map(({g})=>g.name)};
}
export function disposeCollectionModel(model){
  const geometries=new Set(),materials=new Set(),textures=new Set();model.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])if(!m.userData.persistent){materials.add(m);for(const value of Object.values(m))if(value?.isTexture&&!value.userData.persistent)textures.add(value);}});
  geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());
}
