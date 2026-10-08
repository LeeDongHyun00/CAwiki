import { quality, textureCanvas, segments } from 'inside/quality';
// A restrained 122 × 62 × 37 mm mouse: low nose, continuous matte shell,
// flush click panels and a recessed wheel. Clicks pivot at the rear flexure.
import * as T from 'inside/three';

const sections=[
  [-60,23,12],[-55,27,15],[-43,29.7,21.5],[-26,30.3,29],
  [-8,31,34.4],[10,31.2,37],[27,29.8,35],[43,25.7,27],
  [54,17.7,16.5],[59,8.5,9.5],[61.5,.5,6.1],
];
function profile(z,column){
  z=T.MathUtils.clamp(z,sections[0][0],sections.at(-1)[0]);
  let i=0;while(i<sections.length-2&&z>sections[i+1][0])i++;
  const a=sections[i],b=sections[i+1],prev=sections[Math.max(0,i-1)],next=sections[Math.min(sections.length-1,i+2)];
  const span=b[0]-a[0],t=(z-a[0])/span,m0=(b[column]-prev[column])/(b[0]-prev[0]),m1=(next[column]-a[column])/(next[0]-a[0]);
  return (2*t**3-3*t*t+1)*a[column]+(t**3-2*t*t+t)*span*m0+(-2*t**3+3*t*t)*b[column]+(t**3-t*t)*span*m1;
}
function surface(z,u){
  const w=profile(z,1),h=profile(z,2),arch=Math.pow(Math.max(0,1-u*u),.58);
  return new T.Vector3(w*u,6+(h-6)*arch,z);
}
// Closed, thin-walled panels; the buttons share the palm shell's curvature.
function panel(z0,z1,left,right,thickness=1.15,lift=0){
  const rows=segments(72,32),columns=segments(32,16),positions=[],uvs=[],indices=[];
  for(let side=0;side<2;side++)for(let i=0;i<=rows;i++){
    const z=T.MathUtils.lerp(z0,z1,i/rows),a=typeof left==='function'?left(z):left,b=typeof right==='function'?right(z):right;
    for(let j=0;j<=columns;j++){
      const p=surface(z,T.MathUtils.lerp(a,b,j/columns));positions.push(p.x,p.y+lift-side*thickness,p.z);uvs.push(j/columns,i/rows);
    }
  }
  const stride=columns+1,offset=(rows+1)*stride;
  for(let i=0;i<rows;i++)for(let j=0;j<columns;j++){
    const n=i*stride+j;indices.push(n,n+stride,n+1,n+1,n+stride,n+stride+1);
    indices.push(n+offset,n+1+offset,n+stride+offset,n+1+offset,n+stride+1+offset,n+stride+offset);
  }
  // Split edge vertices so the thin wall cannot bend the click surface normals.
  const edge=(a,b)=>{
    const start=positions.length/3;
    for(const i of [a,b,a+offset,b+offset]){positions.push(...positions.slice(i*3,i*3+3));uvs.push(...uvs.slice(i*2,i*2+2));}
    indices.push(start,start+1,start+2,start+1,start+3,start+2);
  };
  for(let i=0;i<rows;i++){edge(i*stride,(i+1)*stride);edge((i+1)*stride+columns,i*stride+columns);}
  for(let j=0;j<columns;j++){edge(j+1,j);edge(rows*stride+j,rows*stride+j+1);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function outline(scale=1){
  const shape=new T.Shape();shape.moveTo(profile(-60,1)*scale,60);
  for(let i=1;i<=96;i++){const z=-60+121.5*i/96;shape.lineTo(profile(z,1)*scale,-z);}
  for(let i=96;i>=0;i--){const z=-60+121.5*i/96;shape.lineTo(-profile(z,1)*scale,-z);}
  shape.quadraticCurveTo(0,63,profile(-60,1)*scale,60);shape.closePath();return shape;
}

export function buildMouse(k){
  const {part,mesh,box,cyl,board,text,wire}=k;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const c=canvas.getContext('2d'),noise=c.createImageData(512,512);let seed=7389;
  for(let i=0;i<noise.data.length;i+=4){seed=Math.imul(seed,1664525)+1013904223>>>0;const v=155+(seed>>>25);noise.data.set([v,v,v,255],i);}c.putImageData(noise,0,0);
  const grain=new T.CanvasTexture(canvas);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(3,5);grain.anisotropy=8;
  const shellMaterial=new T.MeshPhysicalMaterial({color:0x292b2c,metalness:0,roughness:.69,clearcoat:.035,clearcoatRoughness:.75,bumpMap:grain,bumpScale:.026});
  const buttonMaterial=shellMaterial;
  const gripMaterial=new T.MeshStandardMaterial({color:0x161a1c,roughness:.78,bumpMap:grain,bumpScale:.05});
  const base=part('하부 섀시 · PTFE 피트 · 센서 렌즈'),pcb=part('센서 PCB · 스위치 · 배터리',[0,16,0]);
  const palm=part('매트 일체형 팜 쉘',[0,43,9]),left=part('왼쪽 클릭 패널',[-8,58,-5]),right=part('오른쪽 클릭 패널',[8,64,-5]),wheel=part('고무 타이어 · 휠 · 엔코더',[0,31,-7]);
  const plate=(g,scale,y,depth,mat)=>{
    const geometry=new T.ExtrudeGeometry(outline(scale),{depth,bevelEnabled:true,bevelSize:.55,bevelThickness:.4,bevelSegments:4,curveSegments:32});geometry.rotateX(-Math.PI/2);return mesh(g,geometry,mat,0,y,0);
  };
  plate(base,.965,1.3,3.7,'black');plate(base,.98,5.3,.35,gripMaterial);
  mesh(palm,panel(-14.92,61.5,-1,1),shellMaterial);
  mesh(palm,panel(-60,-15.04,-1,-.985),shellMaterial);
  mesh(palm,panel(-60,-15.04,.985,1),shellMaterial);
  const slot=z=>(.19+2.8*Math.exp(-Math.pow((z+34)/5.8,8)))/profile(z,1);
  const hingeY=profile(-15.04,2),hingeZ=-15.04;
  for(const [g,side,name] of [[left,-1,'left click hinge'],[right,1,'right click hinge']]){
    const hinge=new T.Group();hinge.name=name;hinge.position.set(0,hingeY,hingeZ);g.add(hinge);
    const geometry=panel(-59.8,-15.06,side<0?-.985:slot,side<0?z=>-slot(z):.985,1.1,0);
    geometry.translate(0,-hingeY,-hingeZ);mesh(hinge,geometry,buttonMaterial);
  }
  // Black recesses keep the tiny split and wheel slot optically closed.
  mesh(palm,panel(-59.8,-15.04,-.025,.025,.5,-1.5),gripMaterial);
  mesh(palm,panel(-43,-25,-.15,.15,.6,-3.5),gripMaterial);
  const front=new T.Shape();front.moveTo(-23,5.6);
  for(let i=0;i<=48;i++){const point=surface(-60,-1+2*i/48);front.lineTo(point.x,point.y-.8);}
  front.lineTo(23,5.6);front.closePath();
  mesh(palm,new T.ExtrudeGeometry(front,{depth:.8,bevelEnabled:true,bevelSize:.25,bevelThickness:.18,bevelSegments:4}),shellMaterial,0,0,-60);
  box(base,7.5,2.1,.4,0,7.6,-60.35,gripMaterial,.8);box(base,5,.4,.5,0,7.6,-60.57,'black',.15);
  // The axle and encoder stay inside; only the tire's crown clears the shell.
  const wheelY=profile(-34,2)-2.7;
  const axisCylinder=(radius,width,mat)=>{const m=cyl(wheel,radius,width,0,wheelY,-34,mat);m.rotation.z=Math.PI/2;return m;};
  axisCylinder(3.6,5.4,'black');axisCylinder(4.35,4.8,gripMaterial);axisCylinder(.8,8,'black');
  const tread=new T.InstancedMesh(new T.BoxGeometry(4.4,.18,.3),gripMaterial,40),o=new T.Object3D();
  for(let i=0;i<40;i++){const a=i*Math.PI*2/40;o.position.set(0,wheelY+Math.cos(a)*4.37,-34+Math.sin(a)*4.37);o.rotation.set(a,0,0);o.updateMatrix();tread.setMatrixAt(i,o.matrix);}
  tread.castShadow=tread.receiveShadow=true;wheel.add(tread);
  box(wheel,2.4,6,5,-5,wheelY-4,-34,'black',.5);box(wheel,2.4,5,4,5,wheelY-4,-34,'black',.5);
  // The chassis retains an actual sensor aperture and low-friction skates.
  for(const [z,w] of [[-48,44],[45,35]])box(base,w,.85,8,0,.35,z,'white',3);
  box(base,13,1.3,15,0,.65,1,'black',2);box(base,5.8,.5,6.8,0,-.05,1,new T.MeshPhysicalMaterial({color:0x193748,roughness:.09,metalness:.35,clearcoat:1}),.8);
  for(const x of [-20,20])for(const z of [-41,39]){cyl(base,1.6,.15,x,.6,z,'steel');box(base,1.8,.12,.35,x,.47,z,'black',.05);}
  board(pcb,41,84,0,7.2,0,'#123329');box(pcb,11,2,11,0,9.1,1,'black',.4);text(pcb,'OPTICAL',9,4,0,10.2,1,{size:116});
  for(const x of [-14,14]){box(pcb,6.5,5.5,13,x,10.7,-37,'black',.7);box(pcb,2.8,1,6,x,14.05,-38,'white',.3);}
  box(pcb,23,7,30,0,12.2,26,'black',2);text(pcb,'Li-ion\n3.7 V',19,18,0,15.76,26,{color:'#8d9697',size:105});
  wire(pcb,[[11,13,20],[16,15,11],[14,10,4]],.42,'copper');wire(pcb,[[10,13,20],[14,15,10],[12,10,4]],.45,'black');
  for(let i=0;i<9;i++)box(pcb,1.5,.6,2.2,-16+i*4,8.6,-19,'ceramic',.13);
  box(pcb,5,1,6,12,8.7,7,'black');text(base,'WIRELESS  /  OPTICAL',27,4,0,1.1,23,{size:60});
}

export function poseMouseClick(root,amount){
  const hinge=root.getObjectByName('left click hinge');
  if(hinge)hinge.rotation.x=-.0105*T.MathUtils.clamp(amount,0,1);
}
