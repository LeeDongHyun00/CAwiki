"""Render the popup USB portrait from the scenario's existing assembly model."""
from pathlib import Path
import base64
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':1000,'height':760})
 page.goto('http://127.0.0.1:4173/index.html#wiki')
 data=page.evaluate('''async()=>{
  const T=await import('inside/three'),{createUSBAssembly}=await import('inside/usb-model');
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true});renderer.setSize(768,576);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  const scene=new T.Scene(),model=createUSBAssembly();model.pose(0);scene.add(model.root);
  model.root.updateMatrixWorld(true);const box=new T.Box3();model.root.traverseVisible(m=>{if(!m.isMesh||(m.geometry.type==='TubeGeometry'&&m.geometry.parameters.radius>.1))return;m.geometry.computeBoundingBox();box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld));});const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());model.root.position.sub(center);
  const camera=new T.PerspectiveCamera(30,4/3,.1,200);camera.position.set(-1.2,1.15,1.65).normalize().multiplyScalar(size.length()*1.3);camera.lookAt(0,0,0);
  const key=new T.DirectionalLight(0xfff5e9,3.4);key.position.set(-6,10,8);const rim=new T.DirectionalLight(0xdbe6ff,2.2);rim.position.set(5,3,-6);scene.add(key,rim,new T.HemisphereLight(0xe8ecf1,0x4b4b43,1.2));
  const studio=new T.Scene();studio.background=new T.Color(0x75797c);
  for(const [position,w,h,intensity] of [[[-8,9,5],9,12,4],[[8,4,0],2,14,3],[[0,8,-8],12,3,4]]){const panel=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(0xffffff).multiplyScalar(intensity),side:T.DoubleSide}));panel.position.set(...position);panel.lookAt(0,0,0);studio.add(panel);}
  const pmrem=new T.PMREMGenerator(renderer),env=pmrem.fromScene(studio,.06);scene.environment=env.texture;scene.environmentIntensity=.8;
  renderer.render(scene,camera);const url=renderer.domElement.toDataURL('image/webp',.97);env.dispose();pmrem.dispose();renderer.dispose();return url;
 }''')
 (Path(__file__).resolve().parents[1]/'assets/inside/redesign/usb.webp').write_bytes(base64.b64decode(data.split(',')[1]));b.close();print('Shared scenario USB model portrait rendered',flush=True)
