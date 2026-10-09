import { MobileScrollPacer } from 'inside/scroll-pacing';

export const MAX_SCENES_PER_GESTURE = 1;

// Native pan/inertia supplies input only. Never write the document's scroll
// position from a scroll event: that competes with the browser's compositor.
export class ScenarioScrollPacer extends MobileScrollPacer {
 constructor(stops){super(stops,2);}
 get enabled(){return (innerWidth<=760||matchMedia('(pointer: coarse)').matches)&&!matchMedia('(prefers-reduced-motion: reduce)').matches;}
 get active(){return this.armed&&this.enabled;}
 start(current,distance,offset=scrollY){
  this.armed=true;this.anchor=this.position(current);
  this.base=this.value=current;this.origin=offset;this.distance=distance;
 }
 target(requested,current,distance){
  if(!this.active)return requested;
  const raw=requested*distance;
  const desired=Math.max(0,Math.min(1,this.base+(raw-this.origin)/this.distance));
  // The bounds belong to the gesture's starting frame, not the moving frame.
  // Repeated inertia events cannot gradually push this window farther ahead.
  this.value=this.progress(Math.max(this.anchor-MAX_SCENES_PER_GESTURE,
   Math.min(this.anchor+MAX_SCENES_PER_GESTURE,this.position(desired))));
  return this.value;
 }
 rebase(distance,offset=scrollY){
  // Address-bar resizing changes the native range, not the gesture budget.
  this.base=this.value;this.origin=offset;this.distance=distance;
 }
}
