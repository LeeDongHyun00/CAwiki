import { MobileScrollPacer } from '../../lib/inside/scroll-pacing.js';

export const MAX_SCENES_PER_GESTURE = 1;

// Native pan/inertia supplies input only. Never write the document's scroll
// position from a scroll event: that competes with the browser's compositor.
export class ScenarioScrollPacer extends MobileScrollPacer {
 constructor(stops){super(stops,2);}
 get enabled(){return (innerWidth<=760||matchMedia('(pointer: coarse)').matches)&&!matchMedia('(prefers-reduced-motion: reduce)').matches;}
 get active(){return this.armed&&this.enabled;}
 start(current,distance,offset=scrollY){
  this.armed=true;this.direction=0;this.anchor=this.position(current);
  this.value=current;this.origin=offset;this.distance=distance;
 }
 target(requested,current,distance){
  if(!this.active)return requested;
  const raw=requested*distance,delta=(raw-this.origin)/this.distance;
  this.origin=raw;
  const direction=Math.sign(delta);
  // Consume every native delta, even when the visual lead is capped. There
  // is no accumulated overflow to undo when the user reverses direction.
  if(direction&&this.direction&&direction!==this.direction)this.value=current;
  if(direction)this.direction=direction;
  const desired=Math.max(0,Math.min(1,this.value+delta)),at=this.anchor;
  this.value=this.progress(Math.max(at-MAX_SCENES_PER_GESTURE,
   Math.min(at+MAX_SCENES_PER_GESTURE,this.position(desired))));
  return this.value;
 }
 advance(current,target,dt,smoothing){
  // The same easing follows both direct touch and native inertia. Lifting
  // a finger neither freezes the target nor starts an input lockout timer.
  return current+(target-current)*(1-Math.exp(-smoothing*Math.max(0,Math.min(dt,.05))));
 }
 rebase(distance,offset=scrollY){
  // Preserve the current visual target when the native range changes.
  this.origin=offset;this.distance=distance;
 }
}
