import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(`../lib/inside/${name}.js`,import.meta.url),'utf8');
const url=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const source=read('scenario-scroll').replace('inside/scroll-pacing',url(read('scroll-pacing')));
const {ScenarioScrollPacer,MAX_PENDING_SCENES}=await import(url(source));
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
   assert.ok(Math.abs(pacer.position(target)-pacer.position(p))<=MAX_PENDING_SCENES+1e-10);
   const next=pacer.advance(p,target,1/fps,8);
   assert.ok((next-p)*direction>=-1e-12,'One-direction input cannot reverse the film');
   p=next;
  }
  assert.ok(direction>0?p>.99:p<.01,'Continuous held input must continue beyond one scene');
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
for(const direction of [-1,1])for(const fps of [15,30,60,120]){
 const p=new ScenarioScrollPacer([0,.12,.28,.49,.68,.84,1]);
 p.start(.49,10000,4900);const goal=p.target((4900+direction*2000)/10000,.49,10000);
 p.release(.49,1000);let previous=.49;
 for(let ms=0;ms<500;ms+=1000/fps){
  assert.equal(p.target(direction>0?1:0,previous,10000),goal,'Inertia cannot extend the release target');
  const next=p.advance(previous,goal,1/fps,8,1000+ms);
  assert.ok((next-previous)*direction>=-1e-12);previous=next;
 }
 assert.equal(p.advance(previous,goal,1/fps,8,1500),goal);
 p.start(.49,10000,4900);assert.equal(p.released,null,'New touch interrupts release immediately');
 p.release(.49,1000);p.reset();assert.equal(p.released,null);
}
console.log(JSON.stringify({cases,maxPendingScenes:MAX_PENDING_SCENES,continuousDrag:true,overflowReversal:true,smallDrag:true,resize:true,releaseMs:500,scrollWrites:0}));
