// Photo references and geometry decisions: docs/redesign/usb-thumbnail.md
// Authoring-only scene: the site uses the rendered sequence, not another WebGL context.
import * as THREE from '../../lib/vendor/three/three.module.js';
import { RoundedBoxGeometry } from '../../lib/vendor/three/RoundedBoxGeometry.js';
import { RoomEnvironment } from '../../lib/vendor/three/RoomEnvironment.js';

export function createUSBScene(renderer){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#14252c');
 const camera=new THREE.PerspectiveCamera(32,5/3,.1,100);
 camera.position.set(-9,9.5,15);camera.lookAt(-.5,.0,0);camera.zoom=1.12;camera.updateProjectionMatrix();
 renderer.setClearColor('#14252c');renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.88;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const env=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);
 const environment=pmrem.fromScene(env,.08);scene.environment=environment.texture;env.dispose();pmrem.dispose();
 const material=(color,metalness=0,roughness=.4)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
 const aluminum=material('#a0adb4',.95,.29),steel=material('#c4ced2',1,.2),edgeSteel=material('#667379',.85,.36);
 const black=material('#171c20',.06,.47),rib=material('#111619',.03,.57),blue=material('#12569d',.05,.32),gold=material('#d6ae61',.88,.25),dark=material('#080d12',.1,.45);
 // Subtle machined grain, deterministically generated from numeric data.
 const grain=new Uint8Array(128*128*4);let seed=17;
 for(let i=0;i<128*128;i++){seed=(seed*1664525+1013904223)>>>0;const n=155+(seed%80);grain.set([n,n,n,255],i*4);}
 const grainMap=new THREE.DataTexture(grain,128,128);grainMap.wrapS=grainMap.wrapT=THREE.RepeatWrapping;grainMap.repeat.set(10,1);grainMap.needsUpdate=true;
 aluminum.envMapIntensity=.65;steel.envMapIntensity=.7;edgeSteel.envMapIntensity=.12;black.bumpMap=grainMap;black.bumpScale=.0015;
 const add=(geo,mat,parent=scene,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 const box=(w,h,d,mat,parent,x,y,z,r=.04)=>add(new RoundedBoxGeometry(w,h,d,4,r),mat,parent,x,y,z);
 const rect=(x,y,w,h,r=.04)=>{const s=new THREE.Shape();s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;};
 const extrude=(shape,depth,bevel=.015)=>new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3,curveSegments:12,steps:1});
 const cylinder=(rad,len,mat,parent,x,y,z)=>{const m=add(new THREE.CylinderGeometry(rad,rad,len,48),mat,parent,x,y,z);m.rotation.z=Math.PI/2;return m;};
 const tube=(points,r,mat,parent=scene)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),64,r,16,false),mat,parent);
 const targetY=.35,targetZ=1.45;
 // A machined aluminum enclosure with actual openings, recessed liners and tongues.
 const hub=new THREE.Group();scene.add(hub);
 const housing=rect(-3.22,-.41,6.44,1.45,.23);
 housing.holes.push(rect(-3.1,-.29,6.2,1.21,.15));
 const outer=add(extrude(housing,3.56,.022),aluminum,hub,.76,0,0);outer.rotation.y=Math.PI/2;
 const face=rect(-3.21,-.40,6.42,1.43,.22);
 for(const z of [-1.45,1.45])face.holes.push(rect(-z-.94,targetY-.405,1.88,.81,.07));
 const front=add(extrude(face,.085,.012),aluminum,hub,.765,0,0);front.rotation.y=Math.PI/2;
 const back=add(extrude(rect(-3.1,-.29,6.2,1.21,.15),.09,.01),black,hub,4.21,0,0);back.rotation.y=Math.PI/2;
 for(const z of [-1.45,1.45]){
  // Four thin metal walls form the socket; no solid box is drawn over its mouth.
  box(1.32,.055,1.76,edgeSteel,hub,1.34,targetY+.34,z,.014);
  box(1.32,.055,1.76,edgeSteel,hub,1.34,targetY-.34,z,.014);
  box(1.32,.69,.055,edgeSteel,hub,1.34,targetY,z-.855,.012);
  box(1.32,.69,.055,edgeSteel,hub,1.34,targetY,z+.855,.012);
  box(.11,.65,1.68,dark,hub,2.04,targetY,z,.02);
  box(.95,.135,1.38,blue,hub,1.47,targetY-.17,z,.035);
  for(let i=0;i<4;i++)box(.56,.019,.135,gold,hub,1.43,targetY-.094,z+(i-1.5)*.31,.007);
  for(let i=0;i<5;i++)box(.15,.019,.095,gold,hub,1.83,targetY-.094,z+(i-2)*.24,.006);
  // Thin reflective front lips; the recessed walls stay dark inside the socket.
  box(.042,.045,1.77,steel,hub,.724,targetY+.34,z,.009);
  box(.042,.045,1.77,steel,hub,.724,targetY-.34,z,.009);
  box(.042,.65,.045,steel,hub,.724,targetY,z-.86,.009);
  box(.042,.65,.045,steel,hub,.724,targetY,z+.86,.009);
  // Folded spring fingers on the upper inside wall.
  for(const side of [-1,1]){const t=box(.38,.036,.23,steel,hub,1.24,targetY+.29,z+side*.48,.012);t.rotation.z=-.13;}
 }
 // End-cap seam, discrete LED lens, four rubber feet and upstream cable.
 for(const x of [1.25,3.8])for(const z of [-2.7,2.7])box(.45,.13,.42,rib,hub,x,-.49,z,.08);
 const ledMat=new THREE.MeshStandardMaterial({color:'#315148',roughness:.22,emissive:'#80e6bc',emissiveIntensity:0});
 add(new THREE.SphereGeometry(.055,24,12),ledMat,hub,.729,.73,2.61);
 tube([[3.3,.21,-3.15],[3.6,.14,-3.7],[4.8,-.28,-4.2],[7,-.43,-4.6]],.16,black);
 // USB-A male: molded grip, seam, ribbed strain relief and hollow stamped shell.
 const plug=new THREE.Group();plug.position.set(-1.6,targetY,targetZ);scene.add(plug);
 box(2.55,.94,1.86,black,plug,-2.72,0,0,.22);
 box(2.08,.022,1.35,rib,plug,-2.75,.463,0,.1);
 box(2.45,.016,1.78,rib,plug,-2.72,-.15,0,.009);
 for(let i=0;i<7;i++)for(const side of [-1,1])box(.055,.48,.025,rib,plug,-3.38+i*.22,-.01,side*.921,.014);
 cylinder(.245,.85,black,plug,-4.32,0,0);
 for(let i=0;i<5;i++)cylinder(.275-i*.012,.065,rib,plug,-4.01-i*.15,0,0);
 tube([[-4.75,0,0],[-5.6,-.06,.03],[-6.8,-.5,.7],[-9,-.65,1.3],[-16,-.65,2.1]],.195,black,plug);
 // Top and bottom stamped sheets contain two real retention holes.
 for(const sign of [-1,1]){
  const shell=rect(-1.46,-.74,1.46,1.48,.026);
  for(const z of [-.38,.38])shell.holes.push(rect(-.74,z-.14,.33,.28,.025));
  const plate=add(extrude(shell,.034,.009),steel,plug,0,sign*.267,0);plate.rotation.x=sign>0?-Math.PI/2:Math.PI/2;
 }
 for(const z of [-.741,.741])box(1.46,.53,.034,steel,plug,-.73,0,z,.012);
 box(1.31,.18,1.35,blue,plug,-.73,.132,0,.03);
 for(const z of [-.38,.38])box(.4,.013,.35,dark,plug,-.575,.231,z,.01);
 for(let i=0;i<4;i++)box(.57,.014,.15,gold,plug,-.42,.035,(i-1.5)*.3,.006);
 for(let i=0;i<5;i++)box(.2,.014,.09,gold,plug,-1.12,.035,(i-2)*.245,.005);
 // A raised, small USB trident molded into the grip, with no brand label.
 const symbol=new THREE.Group();plug.add(symbol);symbol.position.set(-2.65,.482,0);
 const trace=(points)=>tube(points.map(([x,z])=>[x,0,z]),.014,edgeSteel,symbol);
 trace([[-.44,0],[.47,0]]);trace([[-.1,0],[.03,-.28],[.25,-.28]]);trace([[-.23,0],[-.08,.25],[.09,.25]]);
 const arrow=add(new THREE.ConeGeometry(.057,.13,3),edgeSteel,symbol,.5,0,0);arrow.rotation.z=-Math.PI/2;
 add(new THREE.SphereGeometry(.046,16,8),edgeSteel,symbol,-.44,0,0);box(.074,.02,.074,edgeSteel,symbol,.28,0,-.28,.004);add(new THREE.SphereGeometry(.041,16,8),edgeSteel,symbol,.1,0,.25);
 // Soft studio illumination and contact shadows, in the site's dark teal palette.
 const ground=add(new THREE.PlaneGeometry(200,200),material('#061319',0,.85),scene,0,-.58,0);ground.rotation.x=-Math.PI/2;ground.castShadow=false;ground.material.envMapIntensity=.1;
 const key=new THREE.DirectionalLight('#f4f7f4',2.2);key.position.set(-3,9,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-12;key.shadow.camera.right=12;key.shadow.camera.top=10;key.shadow.camera.bottom=-10;key.shadow.normalBias=.025;key.shadow.bias=-.0002;key.shadow.radius=4;scene.add(key);
 const rim=new THREE.DirectionalLight('#b8d3d4',1.3);rim.position.set(5,5,-5);scene.add(rim);
 const fill=new THREE.DirectionalLight('#d1e9e0',.5);fill.position.set(-6,2,-2);scene.add(fill);
 const clamp=x=>Math.max(0,Math.min(1,x));
 function setProgress(t){
  const p=clamp((t-.08)/.76),ease=p*p*p*(p*(p*6-15)+10);
  plug.position.x=-1.6+3.65*ease;
  ledMat.emissiveIntensity=clamp((t-.83)/.12)*2.6;
  renderer.render(scene,camera);
 }
 setProgress(0);
 return {scene,camera,setProgress,plug,hub};
}
