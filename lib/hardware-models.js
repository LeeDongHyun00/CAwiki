/* Physical meshes in millimetres. Public dimensions are cited in hardware-catalog.js.
   Small internal details are illustrative reconstructions, not manufacturer CAD. */
import * as T from './vendor/three/three.module.js';
import { RoundedBoxGeometry } from './vendor/three/RoundedBoxGeometry.js';

const M = {
  pcb: [0x073a32,.15,.62], black: [0x171b20,.2,.42], rubber: [0x080a0d,0,.85],
  silver: [0xaeb5bc,.85,.28], darkmetal: [0x42484e,.8,.35], gold: [0xcfa955,.78,.25],
  copper: [0xac683c,.82,.3], white: [0xd5d3cc,.15,.45], beige: [0xbca789,0,.65], brown: [0x55382c,0,.52],
};
let materialPool = new Map();
function material(key) {
  if(materialPool.has(key))return materialPool.get(key);
  const [color,metalness,roughness]=M[key]||M.black;
  const m=new T.MeshStandardMaterial({color,metalness,roughness});
  if(key==='silver'){
    const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d'),pixels=ctx.createImageData(256,256);let seed=17;
    for(let i=0;i<pixels.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const v=140+(seed%100);pixels.data.set([v,v,v,255],i);}
    ctx.putImageData(pixels,0,0);const map=new T.CanvasTexture(c);map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(4,4);m.roughnessMap=map;m.bumpMap=map;m.bumpScale=.025;
  }
  materialPool.set(key,m);return m;
}
function mesh(g, geometry, mat, x=0,y=0,z=0) {
  const m = new T.Mesh(geometry, typeof mat==='string'?material(mat):mat);
  m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; g.add(m); return m;
}
function box(g,w,h,d,x=0,y=0,z=0,mat='black',r=0) {
  return mesh(g,r?new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)):new T.BoxGeometry(w,h,d),mat,x,y,z);
}
function cylinder(g,r,h,x=0,y=0,z=0,mat='silver',r2=r) { return mesh(g,new T.CylinderGeometry(r,r2,h,48),mat,x,y,z); }
function ring(g,r,t,x,y,z,mat='silver') {const m=mesh(g,new T.TorusGeometry(r,t,8,64),mat,x,y,z);m.rotation.x=-Math.PI/2;return m;}
function layer(root,name,dy=0) {const g=new T.Group();g.name=name;g.userData.explode=dy;root.add(g);return g;}
function label(g,text,w,d,x,y,z,{bg=null,color='#bbc1c4',size=58}={}) {
  const c=document.createElement('canvas');c.width=1024;c.height=Math.max(128,Math.round(1024*d/w));
  const ctx=c.getContext('2d');if(bg){ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);}
  ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`500 ${size}px Arial`;
  const lines=text.split('\n');lines.forEach((s,i)=>ctx.fillText(s,512,c.height/2+(i-(lines.length-1)/2)*size*1.5,950));
  const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
  const m=mesh(g,new T.PlaneGeometry(w,d),new T.MeshStandardMaterial({map,transparent:!bg,roughness:.58,metalness:.15,side:T.DoubleSide}),x,y,z);m.rotation.x=-Math.PI/2;return m;
}
function repeated(g,geometry,mat,positions) {
  const m=new T.InstancedMesh(geometry,material(mat),positions.length);const o=new T.Object3D();
  positions.forEach((p,i)=>{o.position.set(...p);o.updateMatrix();m.setMatrixAt(i,o.matrix);});m.castShadow=true;m.receiveShadow=true;g.add(m);return m;
}
function screws(g,w,d,y,r=1.4) {for(const x of [-w/2,w/2])for(const z of [-d/2,d/2]){cylinder(g,r,.7,x,y,z);box(g,r*1.2,.1,.22,x,y+.4,z,'black');}}
function contacts(g,count,width,x,y,z,step=1.0) {const p=[];for(let i=0;i<count;i++)p.push([x+i*step,y,z]);repeated(g,new T.BoxGeometry(width,.12,3.4),'gold',p);}
function traces(g,w,d,y) {
  const p=[];for(let i=0;i<30;i++){const x=-w*.44+i*w*.029;const z=-d*.4+(i%7)*d*.11;p.push(x,y,z,x+w*.07,y,z,x+w*.12,y,z+d*.07);}
  const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(p,3));g.add(new T.LineSegments(geom,new T.LineBasicMaterial({color:0x548578,transparent:true,opacity:.35})));
}
function cpu(root){
  const base=layer(root,'유리섬유 패키지 기판',0);box(base,37.5,1.15,45,0,0,0,'pcb',.65);
  // LGA contact field on the underside, with the central decoupling area left open.
  const pins=[];for(let ix=0;ix<36;ix++)for(let iz=0;iz<44;iz++)if(!(ix>10&&ix<25&&iz>12&&iz<32))pins.push([-17.2+ix*.98,-.65,-21+iz*.97]);
  repeated(base,new T.BoxGeometry(.64,.12,.62),'gold',pins);
  for(let x=-5;x<=5;x+=2)for(let z=-7;z<=7;z+=2)box(base,1,.4,.6,x,-.8,z,'beige');
  for(let z=10;z<=16;z+=1.8)box(base,1.1,.3,.6,-17,.72,z,'beige');
  for(let x=6;x<=10;x+=2)box(base,1.1,.3,.6,x,.72,21,'beige');
  const die=layer(root,'실리콘 다이 · 구조 예시',12);box(die,11,.8,22,0,1.15,0,'darkmetal',.25);
  const lid=layer(root,'니켈 도금 구리 히트스프레더',26);
  const shape=new T.Shape();shape.moveTo(-13,-20);shape.lineTo(13,-20);shape.quadraticCurveTo(15,-20,15,-17);shape.lineTo(15,-9);shape.bezierCurveTo(15,-7,18,-7,18,-4);shape.lineTo(18,7);shape.bezierCurveTo(18,10,15,9,15,12);shape.lineTo(15,17);shape.quadraticCurveTo(15,20,13,20);shape.lineTo(-13,20);shape.quadraticCurveTo(-15,20,-15,17);shape.lineTo(-15,12);shape.bezierCurveTo(-15,9,-18,10,-18,7);shape.lineTo(-18,-4);shape.bezierCurveTo(-18,-7,-15,-7,-15,-9);shape.lineTo(-15,-17);shape.quadraticCurveTo(-15,-20,-13,-20);
  const geo=new T.ExtrudeGeometry(shape,{depth:1.3,bevelEnabled:true,bevelSize:.4,bevelThickness:.3,bevelSegments:3,steps:1});geo.rotateX(-Math.PI/2);mesh(lid,geo,'silver',0,1.45,0);
  box(lid,28.7,1.1,38.3,0,3.2,0,'silver',1.4);
  label(lid,'INTEL® CORE™ i9\ni9-14900K\nSRN48',24,15,0,3.78,-3,{color:'#343432',size:81});
  const tri=new T.Shape();tri.moveTo(0,0);tri.lineTo(2,0);tri.lineTo(0,2);tri.closePath();const mark=mesh(base,new T.ShapeGeometry(tri),'gold',-17.5,.64,20);mark.rotation.x=-Math.PI/2;
}
function impeller(g,r,x,y,z,mat='black',blades=9){
  ring(g,r,.9,x,y,z,'darkmetal');cylinder(g,r*.25,3,x,y,z,mat);
  const shape=new T.Shape();shape.moveTo(r*.2,-r*.12);shape.bezierCurveTo(r*.45,-r*.42,r*.78,-r*.38,r*.96,-r*.1);shape.bezierCurveTo(r*.75,r*.06,r*.61,r*.47,r*.28,r*.25);shape.closePath();
  const geo=new T.ExtrudeGeometry(shape,{depth:1.4,bevelEnabled:true,bevelSize:.4,bevelThickness:.4,bevelSegments:1,steps:1});geo.rotateX(-Math.PI/2);
  for(let i=0;i<blades;i++){const m=mesh(g,geo,mat,x,y,z);m.rotation.y=i*Math.PI*2/blades;}
}
function gpu(root){
  const base=layer(root,'기판 · PCIe 접점',0);box(base,285,1.6,110,0,-13,0,'pcb',3);
  contacts(base,80,1.1,-119,-12,58,1.75);box(base,148,1.6,6,-50,-13,57,'pcb');contacts(base,80,1.1,-119,-12,59,1.75);
  box(base,25,3,25,-40,-10,0,'silver',1);for(let i=0;i<8;i++)box(base,14,2,10,-72+(i%4)*21,-10,i<4?-28:28);
  const cooler=layer(root,'방열핀 · 알루미늄 프레임',42);
  for(let i=0;i<91;i++)box(cooler,1.1,48,118,-140+i*3.1,0,0,'darkmetal');
  for(const z of [-65,65])for(const y of [-26,26])box(cooler,304,7,7,0,y,z,'silver',2);
  for(const x of [-148,148])box(cooler,8,58,130,x,0,0,'silver',3);
  // The FE has opposite-side fans, not two fans on the same face.
  for(const side of [-1,1]){
    const x=side*85,y=side*28;const fan=new T.Group();cooler.add(fan);fan.position.set(x,y,0);if(side<0)fan.rotation.z=Math.PI;
    cylinder(fan,54,2,0,0,0,'rubber');impeller(fan,51,0,1.5,0,'black',11);cylinder(fan,13,4,0,3,0,'darkmetal');
    ring(fan,54,2.7,0,2,0,'silver');
  }
  for(const sign of [-1,1]){const rail=box(cooler,300,6,9,0,29,0,'silver',2);rail.rotation.y=sign*.37;}
  const bracket=layer(root,'I/O 브래킷 · 출력 포트',0);box(bracket,3,60,120,-154,-1,0,'silver',1);
  for(let i=0;i<3;i++){box(bracket,4,13,18,-156,-10,-34+i*27,'rubber');box(bracket,4.1,8,13,-156,-10,-34+i*27,'darkmetal');}
  for(let i=0;i<14;i++)box(bracket,3.2,2,35,-155,12+i*1.1,28,'black');
  box(base,21,10,12,15,12,-64,'black',1);label(cooler,'RTX 4090',80,16,-82,30,0,{size:120});
}
function dram(root){
  const base=layer(root,'DDR5 UDIMM 기판',0);box(base,133.35,1.5,31.25,0,0,0,'pcb',.6);traces(base,130,30,.8);
  contacts(base,64,.65,-62,.83,13.8,.9);contacts(base,66,.65,4,.83,13.8,.9);
  contacts(base,64,.65,-62,-.83,13.8,.9);contacts(base,66,.65,4,-.83,13.8,.9);
  const chips=layer(root,'DRAM 패키지 · PMIC',12);
  for(const side of [-1,1])for(let i=0;i<8;i++){
    const x=-55+i*15.7;box(chips,11,1.5,13,x,side*1.5,-1,'black',.3);if(side>0)label(chips,'DDR5',9,5,x,2.27,-1,{size:125});
  }
  box(chips,5,1,5,0,1.3,10);label(chips,'DDR5  •  288 PIN  •  UDIMM',70,4,0,2.4,-12,{size:54});
}
function ssd(root){
  const base=layer(root,'M.2 2280 기판 · M-key',0);box(base,80,.8,22,0,0,0,'black',.7);traces(base,78,21,.43);
  for(let i=0;i<24;i++)if(i!==5&&i!==6)box(base,4,.12,.48,38,.47,-9+i*.77,'gold');
  ring(base,2.1,.65,-37,.5,0,'gold');cylinder(base,1.5,.1,-37,.54,0,'rubber');
  const chips=layer(root,'컨트롤러 · NAND · DRAM',9);
  box(chips,11,1.1,12,24,1,0,'darkmetal',.35);box(chips,8,.85,10,11,.9,0,'black',.2);
  for(const x of [-8,-25])box(chips,14,1.1,17,x,1,0,'black',.4);
  const sticker=layer(root,'제품 라벨',18);
  label(sticker,'SAMSUNG   V-NAND SSD\n990 PRO     PCIe 4.0 NVMe M.2\n2TB                         2280',59,18,-4,1.58,0,{bg:'#141619',color:'#f0f1ef',size:67});
  box(sticker,13,.03,1.2,13,1.61,4.7,'copper');
}
function hdd(root){
  const base=layer(root,'알루미늄 하우징',0);box(base,101.85,20,146.99,0,0,0,'darkmetal',5);box(base,95,2,140,0,11,0,'silver',3);
  const platter=layer(root,'플래터 · 스핀들 · 액추에이터',18);
  cylinder(platter,45,2,0,13,-19,'silver');ring(platter,42,.15,0,14.1,-19,'darkmetal');cylinder(platter,12,3,0,15,-19,'darkmetal');cylinder(platter,6,4,0,16,-19,'silver');
  cylinder(platter,9,5,30,15,43,'silver');const arm=box(platter,6,2,61,18,18,18,'silver',1);arm.rotation.y=-.45;box(platter,28,9,17,20,15,56,'black',2);
  const lid=layer(root,'밀폐 커버',80);box(lid,101,2,146,0,22,0,'silver',4);screws(lid,87,129,23,2);
  label(lid,'SEAGATE\nBARRACUDA\n3.5 HDD  /  SATA\nMODEL RECONSTRUCTION',69,76,0,23.1,-7,{bg:'#e8e7df',color:'#262d30',size:65});
  box(base,67,5,6,-9,-5,73,'black');contacts(base,22,1.6,-39,-2,75,2.5);
}
function fan(root){
  const frame=layer(root,'120 mm 프레임',0);
  const shape=new T.Shape();shape.moveTo(-60,-60);shape.lineTo(60,-60);shape.lineTo(60,60);shape.lineTo(-60,60);shape.closePath();
  const hole=new T.Path();hole.absarc(0,0,56,0,Math.PI*2,true);shape.holes.push(hole);
  for(const x of [-52.5,52.5])for(const z of [-52.5,52.5]){const h=new T.Path();h.absarc(x,z,2.1,0,Math.PI*2,true);shape.holes.push(h);}
  const geo=new T.ExtrudeGeometry(shape,{depth:25,bevelEnabled:true,bevelSize:1,bevelThickness:.6,bevelSegments:2,steps:1});geo.rotateX(-Math.PI/2);mesh(frame,geo,'beige',0,-12.5,0);
  for(const x of [-52,52])for(const z of [-52,52]){box(frame,13,1,13,x,13,z,'brown',2);cylinder(frame,2.2,1.2,x,13.7,z,'rubber');}
  const blades=layer(root,'9엽 임펠러 · 모터',30);impeller(blades,54,0,3,0,'brown');cylinder(blades,16,9,0,4,0,'brown');
  for(let i=0;i<4;i++){const s=box(frame,5,3,110,0,-9,0,'beige');s.rotation.y=i*Math.PI/2+.35;}
  label(blades,'noctua',24,9,0,8.6,0,{color:'#d2c1a4',size:115});
}
function mainboard(root){
  const base=layer(root,'ATX 기판',0);box(base,234,1.6,305,0,0,0,'black',3);traces(base,230,300,.9);screws(base,214,281,1.2,3);
  const parts=layer(root,'소켓 · 확장 슬롯 · 전원부',30);
  box(parts,54,6,66,-20,4,-65,'darkmetal',3);box(parts,40,2,47,-20,8,-65,'black');ring(parts,2,1,-48,8,-95);
  const lever=box(parts,2,2,70,12,9,-65,'silver',1);
  for(let i=0;i<4;i++){
    box(parts,7,11,142,43+i*13,6,-53,'black',1);box(parts,1.5,1,129,43+i*13,12,-53,'rubber');
    for(const z of [-124,18])box(parts,9,13,7,43+i*13,6,z,'white',1);
  }
  for(let i=0;i<4;i++){box(parts,i===2?48:94,9,9,-23,5,22+i*31,i===0?'silver':'black',1);box(parts,i===2?42:86,1,1.8,-23,10,22+i*31,'rubber');}
  for(const x of [-68,-82])for(let z=-107;z<-20;z+=14){box(parts,9,6,9,x,4,z,'darkmetal',1);cylinder(parts,3,8,x+6,5,z,'silver');}
  for(let j=0;j<2;j++){box(parts,28,18,101,-85,10,-68,'silver',2);for(let i=0;i<9;i++)box(parts,1,3,94,-97+i*3,20,-68,'darkmetal');}
  box(parts,49,9,47,73,5,80,'silver',2);label(parts,'PRIME',40,12,73,9.6,80,{color:'#343a3b',size:120});
  for(let i=0;i<3;i++)box(parts,80,4,15,-7,3,43+i*35,'silver',1);
  for(let i=0;i<5;i++){box(parts,23,25,23,-108,13,-125+i*27,'silver',1);box(parts,1,13,15,-120,13,-125+i*27,'rubber');}
  box(parts,11,15,51,105,8,-52,'black',1);for(let i=0;i<6;i++)box(parts,13,11,14,105,6,65+i*13,'black');
  cylinder(parts,10,3,-64,3,89,'silver');label(base,'PRIME Z790-P',71,13,-34,1,139,{size:100});
}
function psu(root){
  const body=layer(root,'ATX 섀시',0);box(body,150,86,140,0,0,0,'black',3);impeller(body,57,0,44,0,'black',7);
  for(let r=12;r<60;r+=6)ring(body,r,.9,0,48,0,'silver');for(const a of [-.75,.75]){const b=box(body,128,1.5,2,0,49,0,'silver');b.rotation.y=a;}
  screws(body,135,124,44,2);for(let i=0;i<5;i++)for(let j=0;j<2;j++){box(body,17,13,2,-48+i*24,-16+j*27,71,'darkmetal',1);box(body,12,8,2.1,-48+i*24,-16+j*27,72,'rubber');}
  label(body,'ATX POWER SUPPLY\n750 W',100,26,0,-43.1,0,{bg:'#181b20',color:'#d9dad8',size:100}).rotation.x=Math.PI/2;
}
function chip(root,id){
  const b=layer(root,'패키지 기판',0);box(b,32,1,32,0,0,0,'pcb',1);
  const p=[];for(let x=-13;x<14;x+=2)for(let z=-13;z<14;z+=2)p.push([x,-.8,z]);repeated(b,new T.SphereGeometry(.55,8,6),'gold',p);
  const top=layer(root,'반도체 패키지',14);box(top,26,2,26,0,1.5,0,'black',1);label(top,id.toUpperCase()+'\nBGA PACKAGE',22,12,0,2.55,0,{size:95});cylinder(top,.65,.05,-10,2.56,10,'white');
}
function spi(root){const b=layer(root,'SOIC-8 패키지',0);box(b,5,1.6,6,0,0,0,'black',.3);for(const x of [-3.1,3.1])for(let i=0;i<4;i++)box(b,1.6,.25,.4,x,-.5,-1.9+i*1.27,'silver',.1);label(b,'25Q128\nSPI FLASH',4,3,0,.83,0,{size:90});}
function display(root){const b=layer(root,'모니터 · 스탠드',0);box(b,530,318,18,0,210,0,'black',5);const face=label(b,'CAwiki\nCOMPUTER ARCHITECTURE',508,286,0,213,9.2,{bg:'#101d29',color:'#d9e4ec',size:65});face.rotation.x=0;box(b,40,70,28,0,33,-4,'darkmetal',3);box(b,190,8,125,0,0,10,'darkmetal',4);}
function keyboard(root){const b=layer(root,'키보드',0);box(b,360,15,135,0,0,0,'darkmetal',5);const rows=['1234567890-+=','QWERTYUIOP[]','ASDFGHJKL;','ZXCVBNM,.'];rows.forEach((s,row)=>[...s].forEach((c,i)=>{const x=-158+i*25+row*3,z=-46+row*25;box(b,22,9,21,x,12,z,'black',2);label(b,c,12,12,x,16.6,z,{size:200});}));box(b,143,9,21,-30,12,54,'black',2);for(const x of [-150,-121,63,92,121,150])box(b,22,9,21,x,12,54,'black',2);}
function mouse(root){const b=layer(root,'마우스',0);const m=mesh(b,new T.SphereGeometry(1,40,32),'black',0,16,0);m.scale.set(31,22,56);box(b,1,1,48,0,36,-21,'rubber');const wh=cylinder(b,6,4,0,35,-23,'rubber');wh.rotation.z=Math.PI/2;box(b,47,3,77,0,1,0,'rubber',1);}
function router(root){const b=layer(root,'라우터',0);box(b,220,32,145,0,0,0,'black',6);for(const x of [-91,-30,30,91]){const a=box(b,9,123,9,x,59,-64,'black',4);a.rotation.z=x*.002;}for(let i=0;i<5;i++){box(b,23,16,4,-65+i*31,-2,-74,'gold',1);box(b,17,11,4.2,-65+i*31,-2,-75,'rubber');}for(let i=0;i<7;i++)box(b,2,2,1,-35+i*12,1,73,new T.MeshStandardMaterial({color:0x7acba1,emissive:0x277744}));for(let i=0;i<25;i++)box(b,1,.2,100,-93+i*7.6,16.1,0,'darkmetal');}
function speaker(root){const b=layer(root,'스피커 인클로저',0);box(b,115,190,120,0,95,0,'black',7);for(const [y,r] of [[67,40],[145,20]]){const group=new T.Group();b.add(group);group.position.set(0,y,61);group.rotation.x=Math.PI/2; cylinder(group,r,5,0,0,0,'rubber');ring(group,r-3,2,0,4,0,'darkmetal');cylinder(group,r*.33,9,0,4,0,'black');}}
function camera(root){const b=layer(root,'웹캠',0);box(b,96,30,30,0,26,0,'black',9);const lens=new T.Group();b.add(lens);lens.position.set(0,26,17);lens.rotation.x=Math.PI/2;cylinder(lens,12,5,0,0,0,'silver');cylinder(lens,9,6,0,2,0,'rubber');cylinder(lens,6,6,0,3,0,new T.MeshPhysicalMaterial({color:0x244461,metalness:.8,roughness:.1,clearcoat:1}));box(b,43,7,42,0,4,-5,'black',3);box(b,30,20,9,0,10,-18,'black',2);}
function nic(root){const b=layer(root,'PCIe 네트워크 카드',0);box(b,100,1.6,65,0,0,0,'pcb',1);contacts(b,30,1.1,-37,1,33,1.8);box(b,25,9,28,32,6,-15,'silver');box(b,10,55,4,49,21,-29,'silver');box(b,22,3,22,-10,3,0,'black');for(let i=0;i<8;i++)box(b,1,8,26,-22+i*3,7,0,'silver');}
function rack(root){const b=layer(root,'19인치 서버 랙',0);box(b,600,1150,600,0,575,0,'darkmetal',4);for(let i=0;i<12;i++){box(b,520,73,20,0,70+i*87,309,'black',2);for(let j=0;j<6;j++){box(b,69,50,4,-210+j*82,70+i*87,321,'darkmetal');box(b,4,3,5,-226+j*82,85+i*87,324,'gold');}}}
function vrm(root){const b=layer(root,'전원부 · 초크 · 커패시터',0);box(b,100,1.6,35,0,0,0,'pcb');for(let i=0;i<6;i++){box(b,11,9,11,-41+i*16,5,-6,'darkmetal',1);cylinder(b,4,12,-41+i*16,7,10,'silver');}}
function bus(root){const b=layer(root,'PCIe 슬롯 · 버스의 물리 연결 예시',0);box(b,100,1.6,32,0,0,0,'pcb');traces(b,100,30,1);box(b,90,12,9,0,7,0,'black',1);box(b,84,1,2,0,13.1,0,'rubber');contacts(b,64,.7,-40,13.2,0,1.25);}
const BUILD={cpu,gpu,dram,ssd,hdd,cooling:fan,mainboard,power:psu,spirom:spi,display,input:keyboard,keyboard,mouse,infra:router,audio:speaker,camera,nic,datacenter:rack,vrm,bus};
export function createHardware(id){
  materialPool=new Map();const root=new T.Group();root.name=id;(BUILD[id]||((r)=>chip(r,id)))(root);
  root.traverse(o=>{if(o.isGroup&&o.userData.explode!==undefined)o.userData.home=o.position.y;});return root;
}
export function setExploded(root,amount){root.traverse(o=>{if(o.userData.explode!==undefined)o.position.y=o.userData.home+o.userData.explode*amount;});}
export function disposeModel(root){const geometries=new Set(),materials=new Set(),maps=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const key of ['map','roughnessMap','bumpMap'])if(m[key])maps.add(m[key]);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());maps.forEach(m=>m.dispose());}
