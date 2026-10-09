// Presentation meshes in millimetres. Package dimensions follow the existing
// catalog; internal microstructures are illustrative, not manufacturer CAD.
import * as T from '../../lib/vendor/three/three.module.js';
import { RoundedBoxGeometry } from '../../lib/vendor/three/RoundedBoxGeometry.js';
import { createHardware } from '../../lib/hardware-models.js';

function rng(seed=41){return()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);}
function texture(width,height,draw){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;draw(canvas.getContext('2d'),width,height);
  const map=new T.CanvasTexture(canvas);map.anisotropy=8;return map;
}
const brushed=texture(1024,1024,(c,w,h)=>{
  const random=rng();c.fillStyle='#a9a9a9';c.fillRect(0,0,w,h);
  for(let i=0;i<7200;i++){
    const v=135+random()*70;c.strokeStyle=`rgba(${v},${v},${v},.28)`;
    const y=random()*h,x=random()*w;c.lineWidth=.4+random()*.7;
    c.beginPath();c.moveTo(x,y);c.lineTo(x+50+random()*450,y+random()*.8);c.stroke();
  }
});brushed.wrapS=brushed.wrapT=T.RepeatWrapping;
const silver=new T.MeshPhysicalMaterial({color:0xbfc2c5,metalness:1,roughness:.32,roughnessMap:brushed,bumpMap:brushed,bumpScale:.014,anisotropy:.6,clearcoat:.15,clearcoatRoughness:.3});
const edge=new T.MeshStandardMaterial({color:0x9da4aa,metalness:1,roughness:.22});
const graphite=new T.MeshStandardMaterial({color:0x25282b,metalness:.75,roughness:.31});
const polymer=new T.MeshStandardMaterial({color:0x101315,metalness:.05,roughness:.48});
const gold=new T.MeshStandardMaterial({color:0xd8ae65,metalness:1,roughness:.25});
const solder=new T.MeshStandardMaterial({color:0xa5a5a0,metalness:.85,roughness:.34});
const ceramic=new T.MeshStandardMaterial({color:0x6f6853,metalness:.12,roughness:.62});
const titanium=new T.MeshPhysicalMaterial({color:0x777b7e,metalness:1,roughness:.36,roughnessMap:brushed,anisotropy:.4});
const fanMaterial=new T.MeshStandardMaterial({color:0x0d1012,metalness:.25,roughness:.38,side:T.DoubleSide});
// Collection instances can be released without disposing the shared studio materials.
brushed.userData.persistent=true;
for(const material of [silver,edge,graphite,polymer,gold,solder,ceramic,titanium,fanMaterial])material.userData.persistent=true;

function mesh(parent,geometry,material,x=0,y=0,z=0){
  const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function box(parent,w,h,d,x,y,z,material=polymer,r=0){return mesh(parent,r?new RoundedBoxGeometry(w,h,d,4,Math.min(r,h/2,d/2,w/2)):new T.BoxGeometry(w,h,d),material,x,y,z);}
function instances(parent,geometry,material,positions){
  const m=new T.InstancedMesh(geometry,material,positions.length),o=new T.Object3D();
  positions.forEach((p,i)=>{o.position.set(...p);o.updateMatrix();m.setMatrixAt(i,o.matrix);});m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function plane(parent,w,d,y,material,x=0,z=0){const m=mesh(parent,new T.PlaneGeometry(w,d),material,x,y,z);m.rotation.x=-Math.PI/2;return m;}
function group(parent,name){const g=new T.Group();g.name=name;parent.add(g);return g;}
function ring(parent,r,t,x,y,z,mat=edge){const m=mesh(parent,new T.TorusGeometry(r,t,12,96),mat,x,y,z);m.rotation.x=-Math.PI/2;return m;}
function cylinder(parent,r,h,x,y,z,mat=edge){return mesh(parent,new T.CylinderGeometry(r,r,h,64),mat,x,y,z);}

function circuitTexture(width=2048,height=2048,dark=false){
  return texture(width,height,(c,w,h)=>{
    const random=rng(95);c.fillStyle=dark?'#141b1c':'#143b32';c.fillRect(0,0,w,h);
    for(let i=0;i<350;i++){
      const x=Math.floor(random()*w/16)*16,y=Math.floor(random()*h/16)*16,length=40+random()*180,dir=random()>.5?1:-1;
      c.strokeStyle=dark?'#283737':'#255245';c.lineWidth=1+random()*1.5;c.beginPath();c.moveTo(x,y);c.lineTo(x+length,y);c.lineTo(x+length+32,y+32*dir);c.lineTo(x+length+32,y+(64+random()*160)*dir);c.stroke();
      c.strokeStyle=dark?'#71766b':'#718570';c.lineWidth=1;c.beginPath();c.arc(x,y,3,0,Math.PI*2);c.stroke();
    }
  });
}

export function createProcessor(){
  const root=new T.Group();root.name='processor';
  const substrate=group(root,'package'),die=group(root,'silicon'),lid=group(root,'heatspreader');
  const pcb=new T.MeshPhysicalMaterial({color:0x174c3e,metalness:.2,roughness:.37,clearcoat:.3,clearcoatRoughness:.38});
  box(substrate,37.5,.96,45,0,0,0,pcb,.28);box(substrate,37.35,.12,44.85,0,-.51,0,gold,.05);box(substrate,37.4,.15,44.9,0,-.63,0,pcb,.055);
  const circuit=circuitTexture();circuit.colorSpace=T.SRGBColorSpace;
  plane(substrate,37,44.5,.489,new T.MeshStandardMaterial({map:circuit,metalness:.35,roughness:.45}));
  const pads=[];for(let x=0;x<36;x++)for(let z=0;z<44;z++)if(!(x>10&&x<25&&z>12&&z<32))pads.push([-17.16+x*.98,-.75,-20.855+z*.97]);
  instances(substrate,new T.CylinderGeometry(.32,.32,.09,10),gold,pads);
  const passives=[],ends=[];
  for(const side of [-1,1])for(let i=0;i<17;i++){const x=side*16.9,z=-17+i*2.1;passives.push([x,.76,z]);ends.push([x-.41,.77,z],[x+.41,.77,z]);}
  for(let x=-6;x<=6;x+=2)for(let z=-8;z<=8;z+=2){passives.push([x,-.91,z]);ends.push([x-.41,-.91,z],[x+.41,-.91,z]);}
  instances(substrate,new T.BoxGeometry(.82,.36,.52),ceramic,passives);instances(substrate,new T.BoxGeometry(.19,.38,.54),solder,ends);
  const marker=new T.Shape();marker.moveTo(0,0);marker.lineTo(1.7,0);marker.lineTo(0,1.7);marker.closePath();
  const corner=mesh(substrate,new T.ShapeGeometry(marker),gold,-17.6,.51,20.7);corner.rotation.x=-Math.PI/2;
  box(die,11.4,.12,22.4,0,.7,0,edge,.05);
  box(die,11,.7,22,0,1.05,0,new T.MeshPhysicalMaterial({color:0x303746,metalness:.9,roughness:.18,iridescence:.55,iridescenceIOR:1.4,clearcoat:1}),.13);
  const siliconMap=texture(1024,2048,(c,w,h)=>{
    const random=rng(17);c.fillStyle='#403c40';c.fillRect(0,0,w,h);const colors=['#7f7063','#5b6868','#484e60','#827764','#627069','#806565'];
    for(let row=0;row<8;row++)for(let col=0;col<4;col++){
      const x=26+col*244,y=22+row*250;c.fillStyle=colors[(row+col)%colors.length];c.fillRect(x,y,230,237);
      for(let i=0;i<22;i++){c.fillStyle=i%3?'#292d30':'#aaa084';c.fillRect(x+8+i*10,y+8,4,220);}
      for(let i=0;i<12;i++){c.fillStyle='#8e8778';c.globalAlpha=.4;c.fillRect(x+5,y+12+i*18,218,2);c.globalAlpha=1;}
    }
    for(let i=0;i<260;i++){c.fillStyle=random()>.5?'#bbac86':'#434248';c.fillRect(random()*w,random()*h,2+random()*12,2);}
    c.strokeStyle='#b09b70';c.lineWidth=2;for(let i=0;i<12;i++)c.strokeRect(4+i*1.5,4+i*1.5,w-8-i*3,h-8-i*3);
  });siliconMap.colorSpace=T.SRGBColorSpace;
  plane(die,10.82,21.82,1.407,new T.MeshPhysicalMaterial({map:siliconMap,metalness:.9,roughness:.24,iridescence:.62,iridescenceIOR:1.33,iridescenceThicknessRange:[140,360],clearcoat:1,clearcoatRoughness:.12}));
  const seal=new T.Shape();seal.moveTo(-13,-19);seal.lineTo(13,-19);seal.lineTo(13,19);seal.lineTo(-13,19);seal.closePath();
  const hole=new T.Path();hole.moveTo(-11,-17);hole.lineTo(-11,17);hole.lineTo(11,17);hole.lineTo(11,-17);hole.closePath();seal.holes.push(hole);
  const gasket=mesh(substrate,new T.ShapeGeometry(seal),polymer,0,.55,0);gasket.rotation.x=-Math.PI/2;
  const outline=new T.Shape();outline.moveTo(-12.8,-19.5);outline.lineTo(12.8,-19.5);outline.quadraticCurveTo(14.7,-19.5,14.7,-17.4);outline.lineTo(14.7,-9);outline.quadraticCurveTo(14.7,-7.4,17.5,-6);outline.lineTo(17.5,6);outline.quadraticCurveTo(14.7,7.4,14.7,9);outline.lineTo(14.7,17.4);outline.quadraticCurveTo(14.7,19.5,12.8,19.5);outline.lineTo(-12.8,19.5);outline.quadraticCurveTo(-14.7,19.5,-14.7,17.4);outline.lineTo(-14.7,9);outline.quadraticCurveTo(-14.7,7.4,-17.5,6);outline.lineTo(-17.5,-6);outline.quadraticCurveTo(-14.7,-7.4,-14.7,-9);outline.lineTo(-14.7,-17.4);outline.quadraticCurveTo(-14.7,-19.5,-12.8,-19.5);
  const lidGeo=new T.ExtrudeGeometry(outline,{depth:1.15,bevelEnabled:true,bevelSize:.3,bevelThickness:.24,bevelSegments:6,curveSegments:20});lidGeo.rotateX(-Math.PI/2);mesh(lid,lidGeo,silver,0,1.43,0);
  box(lid,29.35,1.25,37.8,0,3.05,0,silver,.48);
  const markings=texture(1536,2048,(c,w,h)=>{
    c.fillStyle='#bfc2c5';c.fillRect(0,0,w,h);c.fillStyle='#555959';c.textAlign='left';c.font='500 107px Arial';c.fillText('intel®',170,660);c.font='400 80px Arial';c.fillText('CORE™ i9',170,770);
    c.font='400 47px Arial';c.fillText('i9-14900K',174,927);c.font='400 31px monospace';c.fillText('SRN48  3.20GHz',174,1004);c.fillText('X341K728',174,1057);
    const random=rng(371);for(let x=0;x<19;x++)for(let y=0;y<19;y++)if(random()>.49||x===0||y===18)c.fillRect(1070+x*8,918+y*8,7,7);
    c.font='400 17px monospace';c.fillText('LGA1700',175,1660);
  });markings.colorSpace=T.SRGBColorSpace;
  plane(lid,28.3,36.5,3.681,new T.MeshPhysicalMaterial({map:markings,metalness:1,roughness:.35,roughnessMap:brushed,bumpMap:brushed,bumpScale:.011,anisotropy:.65}));
  return{root,substrate,die,lid,animate(amount){lid.position.y=amount*25;die.position.y=amount*8;}};
}

function makeFan(parent,x,y,flip=false){
  const socket=group(parent,'fan housing');socket.position.set(x,y,0);if(flip)socket.rotation.z=Math.PI;
  cylinder(socket,53,2,0,-2,0,polymer);ring(socket,53,1.3,0,.4,0,edge);ring(socket,48.8,.38,0,.3,0,graphite);
  const rotor=group(socket,'rotor'),vertices=[],indices=[];
  // Swept, pitched blades: highlights follow the curved airfoil surface.
  for(let i=0;i<=24;i++)for(let j=0;j<=8;j++){
    const u=i/24,v=j/8,r=12+u*38,angle=u*u*.54+(v-.5)*(.4+.12*u);
    vertices.push(Math.cos(angle)*r,Math.sin(u*Math.PI)*1.8+(v-.5)*5*u,Math.sin(angle)*r);
    if(i<24&&j<8){const n=i*9+j;indices.push(n,n+9,n+1,n+1,n+9,n+10);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
  for(let i=0;i<11;i++){const blade=mesh(rotor,geo,fanMaterial,0,2.8,0);blade.rotation.y=i*Math.PI*2/11;}
  cylinder(rotor,13.2,3.8,0,1.8,0,polymer);cylinder(rotor,11.8,.18,0,3.8,0,graphite);ring(rotor,10.8,.1,0,3.91,0,titanium);return rotor;
}

export function createGraphicsCard(){
  const root=new T.Group();root.name='graphics';const pcb=group(root,'graphics board'),cooler=group(root,'heat sink'),shell=group(root,'frame and fans');
  const board=new T.MeshStandardMaterial({color:0x172321,metalness:.2,roughness:.48});box(pcb,281,1.6,111,0,-14,0,board,1.8);
  const circuits=circuitTexture(2048,1024,true);circuits.colorSpace=T.SRGBColorSpace;plane(pcb,277,107,-13.19,new T.MeshStandardMaterial({map:circuits,metalness:.32,roughness:.45}));
  box(pcb,148,1.6,7,-52,-14,57,board,.25);const pins=[];for(let i=0;i<81;i++)if(i!==11&&i!==12)pins.push([-123+i*1.73,-13.12,58.5]);instances(pcb,new T.BoxGeometry(1.05,.14,6),gold,pins);
  box(pcb,28,1.9,28,-40,-11.3,0,polymer,.7);box(pcb,18,.18,18,-40,-10.25,0,silver,.3);
  for(let i=0;i<12;i++)box(pcb,13,1.5,10,-76+(i%6)*17,-11.3,i<6?-24:24,polymer,.45);
  const regulators=[],capacitors=[];for(let i=0;i<13;i++){regulators.push([-102+i*16,-11,-41]);capacitors.push([-102+i*16,-10.8,42]);}
  instances(pcb,new T.BoxGeometry(7,4,7),graphite,regulators);instances(pcb,new T.CylinderGeometry(2.5,2.5,5,16),solder,capacitors);
  const finPositions=[];for(let i=0;i<123;i++)finPositions.push([-143+i*2.34,0,0]);instances(cooler,new T.BoxGeometry(.55,45,114),graphite,finPositions);
  for(const z of [-40,-20,0,20,40]){const pipe=cylinder(cooler,3.2,280,0,-21,z,edge);pipe.rotation.z=Math.PI/2;}
  for(const z of [-64,64])for(const y of [-26,26])box(shell,304,6,6,0,y,z,titanium,1.4);for(const x of [-149,149])box(shell,6,57,128,x,0,0,titanium,1.6);
  // Opposite-side fans preserve the FE's flow-through construction.
  const fans=[makeFan(shell,84,27),makeFan(shell,-84,-27,true)];
  const face=new T.Shape();face.moveTo(-149,-64);face.lineTo(149,-64);face.lineTo(149,64);face.lineTo(-149,64);face.closePath();
  const fanHole=new T.Path();fanHole.absarc(84,0,53.5,0,Math.PI*2,true);face.holes.push(fanHole);
  const exhaust=new T.Path();exhaust.moveTo(-139,-54);exhaust.lineTo(-139,54);exhaust.lineTo(6,54);exhaust.lineTo(6,-54);exhaust.closePath();face.holes.push(exhaust);
  const faceGeo=new T.ExtrudeGeometry(face,{depth:2.5,bevelEnabled:true,bevelSize:1.1,bevelThickness:.7,bevelSegments:4,curveSegments:48});faceGeo.rotateX(-Math.PI/2);
  const faceMesh=mesh(shell,faceGeo,titanium,0,26,0);faceMesh.receiveShadow=false;
  box(shell,140,15,1,-48,14,67,titanium,.4).receiveShadow=false;
  for(const x of [-146,146])for(const z of [-59,59]){cylinder(shell,2,.5,x,29.2,z,graphite);box(shell,2.2,.1,.4,x,29.51,z,polymer);}
  const word=texture(1024,256,(c,w,h)=>{c.fillStyle='#c5c8c9';c.textAlign='center';c.font='500 66px Arial';c.fillText('GEFORCE RTX',w/2,150);});word.colorSpace=T.SRGBColorSpace;
  mesh(shell,new T.PlaneGeometry(83,20),new T.MeshStandardMaterial({map:word,transparent:true,roughness:.4,metalness:.7}),-48,14,67.55);
  box(pcb,22,11,13,19,10,-60,polymer,1.2);box(pcb,2.2,60,120,-154,-1,0,edge,.4);
  for(let i=0;i<4;i++){box(pcb,2.8,12,18,-155.6,-13,-41+i*26,polymer,.5);box(pcb,2.9,8,13,-155.8,-13,-41+i*26,graphite,.5);}
  for(let i=0;i<17;i++)box(pcb,2.6,1.6,36,-155,7+i*1.3,20,polymer,.3);
  return{root,pcb,cooler,shell,fans,animate(amount,spin){cooler.position.y=amount*28;shell.position.y=amount*54;fans.forEach((f,i)=>f.rotation.y=spin*(i?-1:1));}};
}

export function createSupportingPart(id){
  const root=createHardware(id);root.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.metalness>.7){m.roughness=Math.max(.26,m.roughness);m.envMapIntensity=.7;}});
  if(id==='mainboard'){
    const map=circuitTexture(2048,2048,true);map.colorSpace=T.SRGBColorSpace;
    plane(root,232,303,1.01,new T.MeshStandardMaterial({map,metalness:.18,roughness:.68}));
    const details=[],ends=[];
    for(let i=0;i<100;i++){
      const x=-94+(i%20)*5.5,z=109+Math.floor(i/20)*6;details.push([x,1.8,z]);ends.push([x-1.2,1.8,z],[x+1.2,1.8,z]);
    }
    for(let i=0;i<48;i++){const x=-51+(i%12)*5,z=-132+Math.floor(i/12)*4;details.push([x,1.8,z]);ends.push([x-1.2,1.8,z],[x+1.2,1.8,z]);}
    instances(root,new T.BoxGeometry(2.4,1.1,1.5),polymer,details);instances(root,new T.BoxGeometry(.45,1.15,1.55),solder,ends);
  }
  return root;
}
