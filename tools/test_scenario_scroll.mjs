import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(`../lib/inside/${name}.js`,import.meta.url),'utf8');
const url=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const source=read('scenario-scroll').replace('inside/scroll-pacing',url(read('scroll-pacing')));
const {ScenarioScrollPacer,MAX_SCENES_PER_GESTURE}=await import(url(source));
globalThis.innerWidth=390;globalThis.scrollY=1700;
let reduced=false,coarse=false;
globalThis.matchMedia=query=>({matches:query.includes('pointer: coarse')?coarse:reduced});
globalThis.scrollTo=()=>assert.fail('Gesture input must never correct native scrolling');
let cases=0;
for(const stops of [[0,.14,.32,.49,.68,.86,1],[0,.1,.25,.3,.51,.63,.7,.82,.93,1]]){
 for(const start of [.001,.15,.32,.5,.75,.999])for(const direction of [-1,1])for(const fps of [15,30,60,120]){
  const pacer=new ScenarioScrollPacer(stops);let p=start;
  pacer.start(p,9000);
  for(let frame=1;frame<=300;frame++){
   const target=pacer.target((scrollY+direction*frame*70)/9000,p,9000);
   assert.ok(Math.abs(pacer.position(target)-pacer.position(start))<=MAX_SCENES_PER_GESTURE+1e-10);
   const next=pacer.advance(p,target,1/fps,8);
   assert.ok((next-p)*direction>=-1e-12,'One-direction input cannot reverse the film');
   p=next;
  }
  assert.ok(Math.abs(pacer.position(p)-pacer.position(start))<=1+1e-10);
  const prior=pacer.value;pacer.rebase(8800,6000);
  assert.ok(Math.abs(pacer.target(6000/8800,p,8800)-prior)<1e-12,'Resize cannot seek the film');
  // Reversing inside the same gesture must not first undo discarded overflow.
  const reverse=pacer.target((6000-direction*20)/8800,p,8800);
  assert.ok((reverse-p)*direction<0);
  pacer.start(p,9000,4500);
  assert.ok((pacer.target((4500-direction*250)/9000,p,9000)-p)*direction<0);
  cases++;
 }
}
const pacer=new ScenarioScrollPacer([0,.2,.4,.6,.8,1]);
pacer.start(.3,10000,3000);
assert.equal(pacer.advance(.3,.1,-.01,8),.3);
const tiny=pacer.target(3001/10000,.3,10000);
assert.ok(tiny>.3&&tiny<.301,'No minimum drag or automatic scene snap');
// Excessive burst is bounded, but its overflow must not produce a dead zone.
assert.equal(pacer.target(.95,.3,10000),.5);
assert.ok(pacer.target(.94,.3,10000)<.3,'Small reverse input after huge burst acts immediately');
for(const mode of ['desktop','reduced','explicit']){
 innerWidth=mode==='desktop'?1440:390;reduced=mode==='reduced';if(mode==='explicit')pacer.reset();
 assert.equal(pacer.target(.95,.3,10000),.95);
}
innerWidth=844;coarse=true;reduced=false;pacer.start(.3,10000,3000);
assert.ok(pacer.active,'Landscape touch devices still bound pending distance');
assert.ok(pacer.position(pacer.target(.95,.3,10000))-pacer.position(.3)<=1);
// Native inertia remains live after the finger lifts, within the same cap.
for(const direction of [-1,1]){
 const p=new ScenarioScrollPacer([0,.12,.28,.49,.68,.84,1]);
 p.start(.49,10000,4900);
 const initial=p.target((4900+direction*100)/10000,.49,10000);
 const inertia=p.target((4900+direction*300)/10000,initial,10000);
 assert.ok((inertia-initial)*direction>0,'Post-touch inertia must keep changing the target');
 const end=p.target(direction>0?1:0,inertia,10000);
 assert.ok(Math.abs(p.position(end)-p.position(.49))<=1+1e-10);
 // A fresh touch gets its own one-scene range without any timed wait.
 p.start(end,10000,5000);
 const next=p.target((5000+direction*300)/10000,end,10000);
 assert.ok((next-end)*direction>0);
}
console.log(JSON.stringify({cases,maxScenesPerGesture:MAX_SCENES_PER_GESTURE,liveInertia:true,overflowReversal:true,smallDrag:true,resize:true,scrollWrites:0}));
