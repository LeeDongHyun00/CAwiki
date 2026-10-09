// Touch scrolling uses the browser's native pan/inertia. Bound the visual
// timeline in scene units, so a short chapter cannot flash past in one frame.
export const MOBILE_SCENES_PER_SECOND = 1;
export const MOBILE_MAX_LEAD = .75;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export class MobileScrollPacer {
 constructor(stops,rate=MOBILE_SCENES_PER_SECOND){this.stops=stops;this.rate=rate;this.armed=false;}
 get active(){return this.armed&&innerWidth<=760&&!matchMedia('(prefers-reduced-motion: reduce)').matches;}
 position(p){
  const a=this.stops,i=Math.max(0,a.findIndex((n,j)=>j>0&&p<n)-1);
  if(p>=1)return a.length-1;
  return i+(p-a[i])/(a[i+1]-a[i]);
 }
 progress(position){
  const a=this.stops,p=clamp(position,0,a.length-1),i=Math.min(a.length-2,Math.floor(p));
  return a[i]+(a[i+1]-a[i])*(p-i);
 }
 start(progress,distance){
  this.armed=true;
  // A new drag starts at the image the user sees, including when reversing.
  if(this.active)scrollTo({top:progress*distance,behavior:'instant'});
 }
 reset(){this.armed=false;}
 target(requested,current,distance){
  if(!this.active)return requested;
  const at=this.position(current),limited=this.progress(clamp(this.position(requested),at-MOBILE_MAX_LEAD,at+MOBILE_MAX_LEAD));
  // Discard excess native momentum rather than queueing seconds of animation.
  // One pixel of tolerance prevents scroll-event feedback from pixel rounding.
  if(Math.abs(limited-requested)*distance>1)scrollTo({top:limited*distance,behavior:'instant'});
  return limited;
 }
 advance(current,target,dt,smoothing){
  const elapsed=Math.max(0,this.active?Math.min(dt,.05):dt);
  if(elapsed===0)return current;
  const next=current+(target-current)*(1-Math.exp(-smoothing*elapsed));
  if(!this.active)return next;
  const at=this.position(current),limit=this.rate*elapsed;
  return this.progress(clamp(this.position(next),at-limit,at+limit));
 }
}
