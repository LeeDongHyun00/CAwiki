import { MobileScrollPacer } from 'inside/scroll-pacing';

export const MAX_PENDING_SCENES = 1;
export const SCENARIO_RELEASE_MS = 500;

// Native pan/inertia supplies input only. Never write the document's scroll
// position from a scroll event: that competes with the browser's compositor.
export class ScenarioScrollPacer extends MobileScrollPacer {
 constructor(stops){super(stops,2);}
 get enabled(){return (innerWidth<=760||matchMedia('(pointer: coarse)').matches)&&!matchMedia('(prefers-reduced-motion: reduce)').matches;}
 get active(){return this.armed&&this.enabled;}
 start(current,distance,offset=scrollY){
  this.released=null;this.armed=true;this.direction=0;
  this.value=current;this.origin=offset;this.distance=distance;
 }
 reset(){super.reset();this.released=null;}
 release(current,now=performance.now()){
  this.released={from:current,to:this.value,at:now};return this.value;
 }
 target(requested,current,distance){
  if(!this.active)return requested;
  if(this.released)return this.released.to;
  const raw=requested*distance,delta=(raw-this.origin)/this.distance;
  this.origin=raw;
  const direction=Math.sign(delta);
  // Consume every native delta, even when the visual lead is capped. There
  // is no accumulated overflow to undo when the user reverses direction.
  if(direction&&this.direction&&direction!==this.direction)this.value=current;
  if(direction)this.direction=direction;
  const desired=Math.max(0,Math.min(1,this.value+delta)),at=this.position(current);
  this.value=this.progress(Math.max(at-MAX_PENDING_SCENES,
   Math.min(at+MAX_PENDING_SCENES,this.position(desired))));
  return this.value;
 }
 advance(current,target,dt,smoothing,now=performance.now()){
  if(!this.active)return super.advance(current,target,dt,smoothing);
  if(!this.released){
   // Direct manipulation follows the finger without a per-gesture stop or
   // a second speed limiter. Only queued visual distance is bounded.
   return current+(target-current)*(1-Math.exp(-smoothing*Math.max(0,Math.min(dt,.05))));
  }
  const {from,to,at}=this.released,t=Math.max(0,Math.min(1,(now-at)/SCENARIO_RELEASE_MS));
  if(t===1)return to;
  const a=this.position(from),b=this.position(to);
  return this.progress(a+(b-a)*(1-(1-t)**3));
 }
 rebase(distance,offset=scrollY){
  // Preserve the current visual target when the native range changes.
  this.origin=offset;this.distance=distance;
 }
}
