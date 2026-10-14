import * as T from './vendor/three/three.module.js';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';
export function studioScene(canvas,{transparent=false}={}){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:transparent});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor(0x000000,0);
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  const scene=new T.Scene();const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();
  const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.65;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(0xe8f2ff,0x374938,.8));
  const key=new T.DirectionalLight(0xfff1db,2.5);key.position.set(-3,7,5);scene.add(key);
  const rim=new T.DirectionalLight(0xbed5ee,1.8);rim.position.set(4,3,-5);scene.add(rim);
  const camera=new T.PerspectiveCamera(34,1,.01,10000);
  return {renderer,scene,camera,environment};
}
export function fitCamera(camera,model,aspect=1,view='perspective'){
  model.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(model),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
  const radius=size.length()/2;const vertical=T.MathUtils.degToRad(camera.fov)/2;
  const distance=radius/Math.sin(Math.min(vertical,Math.atan(Math.tan(vertical)*aspect)))*1.13;
  const upright=['display','audio','camera','datacenter','infra'].includes(model.name);
  const dirs={perspective:upright?[1,.65,2.8]:[.7,1.7,2.1],top:upright?[0,0,1]:[0,1,.001],bottom:upright?[0,0,-1]:[0,-1,.001],side:[1,.15,0]};
  camera.position.copy(center).add(new T.Vector3(...dirs[view]).normalize().multiplyScalar(distance));camera.up.set(0,1,0);camera.near=Math.max(.01,distance/1000);camera.far=distance*20;camera.aspect=aspect;camera.updateProjectionMatrix();camera.lookAt(center);return {center,distance,radius};
}
