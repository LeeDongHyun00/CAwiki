import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(`../lib/inside/${name}.js`,import.meta.url),'utf8');
const url=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const source=read('scenario-scroll').replace('inside/scroll-pacing',url(read('scroll-pacing')));
const {ScenarioScrollPacer,SCENES_PER_SECOND}=await import(url(source));
globalThis.innerWidth=390;
let reduced=false,coarse=false;
globalThis.matchMedia=query=>({matches:query.includes('pointer: coarse')?coarse:reduced});
globalThis.scrollTo=()=>assert.fail('Gesture input must never correct native scrolling');
let cases=0;
for(const stops of [[0,.14,.32,.49,.68,.86,1],[0,.1,.25,.3,.51,.63,.7,.82,.93,1]]){
 for(const start of [.001,.15,.32,.5,.75,.999])for(const direction of [-1,1])for(const fps of [15,30,60,120]){
  const pacer=new ScenarioScrollPacer(stops);let p=start;
  pacer.start(start);
  for(let frame=1;frame<=300;frame++){
   const requested=Math.max(0,Math.min(1,start+direction*frame*70/9000));
   const target=pacer.target(requested,p);
   assert.ok(Math.abs(target-requested)<1e-12,'One-direction input follows native scrolling');
   const next=pacer.advance(p,target,1/fps,8);
   assert.ok((next-p)*direction>=-1e-12,'One-direction input cannot reverse the film');
   assert.ok(Math.abs(pacer.position(next)-pacer.position(p))<=SCENES_PER_SECOND*Math.min(1/fps,.05)+1e-9,'Drawn speed is bounded');
   p=next;
  }
  // Reversing turns the film back at once, whatever travel is still queued.
  const last=Math.max(0,Math.min(1,start+direction*300*70/9000));
  const reverse=pacer.target(last-direction*20/9000,p);
  if(last!==0&&last!==1||Math.abs(last-p)>1e-6)assert.ok((reverse-p)*direction<0||Math.abs(reverse-p)<1e-9);
  cases++;
 }
}
const pacer=new ScenarioScrollPacer([0,.2,.4,.6,.8,1]);
assert.equal(pacer.advance(.3,.1,-.01,8),.3);
// Without a touch the target is the native position, on every device.
for(const mode of ['desktop','reduced','idle']){
 innerWidth=mode==='desktop'?1440:390;reduced=mode==='reduced';pacer.reset();
 assert.equal(pacer.target(.95,.3),.95);
}
innerWidth=1440;assert.ok(pacer.advance(.3,.95,.05,8)-.3>.2,'Desktop easing is not speed-limited');
innerWidth=844;coarse=true;reduced=false;pacer.start(.3);
assert.ok(pacer.active,'Landscape touch devices are paced too');
// Rest point: a slight touch returns to the nearest scene, a drag moves on
// in its direction and never pulls the drawn scene back.
const points=[0,.25,.45,.65,.85,1];
assert.equal(pacer.rest(points,.45,.46,.455),.45);
assert.equal(pacer.rest(points,.45,.56,.5),.65);
assert.equal(pacer.rest(points,.45,.34,.4),.25);
assert.equal(pacer.rest(points,.25,.95,.5),1);
assert.ok(pacer.rest(points,.25,.62,.6)>=.6);
console.log(JSON.stringify({cases,scenesPerSecond:SCENES_PER_SECOND,followsNative:true,immediateReversal:true,restPoints:true,scrollWrites:0}));
