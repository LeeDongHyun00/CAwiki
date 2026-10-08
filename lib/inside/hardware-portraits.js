import * as T from 'inside/three';
import { FRONT_FACING } from 'inside/data';

// A single photographic setup drives both the live landing pose and its still.
export function portraitRotation(id){
  const direction=new T.Vector3(...(id==='mouse'?[.9,1.15,-1.5]:FRONT_FACING.has(id)?[.7,.38,1.6]:[.75,1.2,1.65]));
  return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(direction,new T.Vector3(),new T.Vector3(0,1,0))).invert();
}
export function portraitScene(environment){
  const scene=new T.Scene();scene.environment=environment;scene.environmentIntensity=.58;
  const rotation=portraitRotation('cpu');scene.environmentRotation.setFromQuaternion(rotation);
  const key=new T.DirectionalLight(0xfff5e9,1.7);key.position.set(-4,8,6).applyQuaternion(rotation);
  const rim=new T.DirectionalLight(0xdbe6ff,1.1);rim.position.set(5,3,-6).applyQuaternion(rotation);
  const fill=new T.HemisphereLight(0xe8ecf1,0x4b4b43,.8);fill.position.applyQuaternion(rotation);
  scene.add(key,rim,fill);return scene;
}
export function portraitCamera(width,height){
  const aspect=width/height,camera=new T.OrthographicCamera(-5*aspect,5*aspect,5,-5,.1,200);camera.position.z=80;return camera;
}
export function portraitPose(size,target,width,height){
  const unit=10/height,w=Math.min(target.width,target.height*4/3),h=Math.min(target.height,target.width*3/4);
  return{x:(target.x+target.width/2-width/2)*unit,y:(height/2-target.y-target.height/2)*unit,scale:Math.min(w*unit/size.x,h*unit/size.y)*.78};
}
export function portraitModel(root,id,rest=[]){
  const clone=root.clone(true);clone.position.set(0,0,0);clone.quaternion.identity();clone.scale.setScalar(1);
  const moving=[];clone.traverse(node=>{if(node!==clone&&node.isGroup)moving.push(node);});
  const from=moving.map(node=>({position:node.position.clone(),quaternion:node.quaternion.clone(),scale:node.scale.clone()}));
  const startCenter=new T.Box3().setFromObject(clone).getCenter(new T.Vector3());
  const apply=t=>{
    moving.forEach((node,i)=>{const to=rest[i];if(!to)return;node.position.copy(from[i].position).lerp(to.position,t);node.quaternion.copy(from[i].quaternion).slerp(to.quaternion,t);node.scale.copy(from[i].scale).lerp(to.scale,t);});
  };
  apply(1);const endCenter=new T.Box3().setFromObject(clone).getCenter(new T.Vector3());
  clone.position.copy(endCenter).negate();
  const group=new T.Group();group.add(clone);group.quaternion.copy(portraitRotation(id));
  const size=new T.Box3().setFromObject(group).getSize(new T.Vector3());
  return{group,size,assemble(t){apply(t);clone.position.copy(startCenter).lerp(endCenter,t).negate();}};
}
