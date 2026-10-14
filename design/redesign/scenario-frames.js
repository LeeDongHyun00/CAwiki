// A pooled set of image fragments. Every tile samples its own part of one source
// frame; fragmenting it is a teaching device, not a literal codec block layout.
import * as T from '../../lib/vendor/three/three.module.js';
import { paintScenarioFrame } from './scenario-screen.js';

export class ScenarioFrames {
 constructor(parent){
  const capacity=160;this.capacity=capacity;this.used=0;this.last='';
  this.canvas=document.createElement('canvas');this.canvas.width=960;this.canvas.height=540;
  this.texture=new T.CanvasTexture(this.canvas);this.texture.colorSpace=T.SRGBColorSpace;this.texture.minFilter=T.LinearFilter;this.texture.generateMipmaps=false;
  this.rects=new T.InstancedBufferAttribute(new Float32Array(capacity*4),4);this.alphas=new T.InstancedBufferAttribute(new Float32Array(capacity),1);
  const geometry=new T.PlaneGeometry(1,1);geometry.setAttribute('frameRect',this.rects);geometry.setAttribute('frameAlpha',this.alphas);
  const material=new T.MeshBasicMaterial({map:this.texture,transparent:true,depthTest:false,depthWrite:false,side:T.DoubleSide,toneMapped:false});
  material.onBeforeCompile=shader=>{
   shader.vertexShader='attribute vec4 frameRect; attribute float frameAlpha; varying float vFrameAlpha;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvMapUv=frameRect.xy+vMapUv*frameRect.zw;vFrameAlpha=frameAlpha;');
   shader.fragmentShader='varying float vFrameAlpha;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );','vec4 diffuseColor = vec4( diffuse, opacity * vFrameAlpha );');
  };
  this.mesh=new T.InstancedMesh(geometry,material,capacity);this.mesh.name='source image fragments';this.mesh.frustumCulled=false;this.mesh.renderOrder=5;this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.mesh.count=0;
  this.object=new T.Object3D();parent.add(this.mesh);
 }
 begin(id,time){
  this.used=0;this.mesh.count=0;const key=id+':'+Math.round(time*800);
  if(key!==this.last){paintScenarioFrame(this.canvas.getContext('2d'),id,time);this.texture.needsUpdate=true;this.last=key;}
 }
 add(position,width,height,quaternion,alpha=1,rect=[0,0,1,1]){
  if(alpha<.004||this.used>=this.capacity)return;
  const o=this.object;o.position.copy(position);o.scale.set(width,height,1);o.quaternion.copy(quaternion);o.updateMatrix();
  this.mesh.setMatrixAt(this.used,o.matrix);this.rects.setXYZW(this.used,...rect);this.alphas.setX(this.used,alpha);this.used++;
 }
 flush(){this.mesh.count=this.used;this.mesh.instanceMatrix.needsUpdate=true;this.rects.needsUpdate=true;this.alphas.needsUpdate=true;}
}
