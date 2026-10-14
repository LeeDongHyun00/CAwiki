import { MobileScrollPacer } from 'inside/scroll-pacing';

export const SCENES_PER_SECOND = 2;

// Native pan/inertia is the input and the document position is never fought
// while a finger or its inertia is moving. Instead of capping each gesture at
// one scene, the drawn film follows at most two scenes per second, and the
// film settles on a scene once the gesture has ended (see ScenarioFilm).
export class ScenarioScrollPacer extends MobileScrollPacer {
 constructor(stops){super(stops,SCENES_PER_SECOND);}
 get enabled(){return (innerWidth<=760||matchMedia('(pointer: coarse)').matches)&&!matchMedia('(prefers-reduced-motion: reduce)').matches;}
 // Armed from a touch until its inertia ends.
 get active(){return this.armed&&this.enabled;}
 start(requested){this.armed=true;this.last=requested;}
 reset(){this.armed=false;this.last=null;this.offset=0;}
 // The target follows native scrolling one to one. Reversing drops the travel
 // still queued ahead of the drawn scene, so the film turns back at once; the
 // offset this leaves is cleared when the film settles.
 target(requested,current){
  if(!this.active){this.reset();return requested;}
  const delta=this.last==null?0:requested-this.last,pending=this.last==null?0:this.last+(this.offset||0)-current;
  this.last=requested;
  if(delta&&pending&&Math.sign(delta)!==Math.sign(pending))this.offset=current-(requested-delta);
  return Math.max(0,Math.min(1,requested+(this.offset||0)));
 }
 advance(current,target,dt,smoothing){
  const elapsed=Math.max(0,Math.min(dt,.05));if(elapsed===0)return current;
  const next=current+(target-current)*(1-Math.exp(-smoothing*elapsed));
  if(!this.enabled)return next;
  const at=this.position(current),limit=this.rate*elapsed;
  return this.progress(Math.max(at-limit,Math.min(at+limit,this.position(next))));
 }
 // The scene to rest on after a gesture from `from` released at `target`
 // while `drawn` is on screen. A real drag moves on in its direction without
 // pulling the drawn scene back; a slight touch returns to the nearest scene.
 rest(points,from,target,drawn){
  const nearest=list=>list.reduce((best,n)=>Math.abs(n-target)<Math.abs(best-target)?n:best);
  const direction=Math.sign(target-from);
  if(!direction||Math.abs(this.position(target)-this.position(from))<.15)return nearest(points);
  const ahead=points.filter(n=>(n-drawn)*direction>=-1e-9);
  return nearest(ahead.length?ahead:points);
 }
}
