import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(`../lib/inside/${name}.js`,import.meta.url),'utf8');
const load=source=>import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const {MobileScrollPacer}=await load(read('scroll-pacing'));
const {CHAPTERS}=await load(read('cinema-timeline'));
globalThis.innerWidth=390;
let reduced=false,scrollWrites=[];
globalThis.matchMedia=()=>({matches:reduced});
globalThis.scrollTo=options=>scrollWrites.push(options.top);
const stops=[...CHAPTERS.map(c=>c.start),1];
const candidates=[];
for(const rate of [.75,1,1.5]){
 const pacer=new MobileScrollPacer(stops,rate);pacer.start(.31,18568);
 let p=.31,t=0,peak=0;
 while(pacer.position(p)<4){
  const next=pacer.advance(p,pacer.target(1,p,18568),1/120,5.8);
  peak=Math.max(peak,(pacer.position(next)-pacer.position(p))*120);p=next;t+=1/120;
 }
 candidates.push({rate,shortChapterTraversalMs:Math.round(t*1000),peakScenesPerSecond:peak});
}
let cases=0;
for(const fps of [15,30,60,120])for(const current of [.01,.3,.629,.795,.96])for(const direction of [-1,1]){
 const pacer=new MobileScrollPacer(stops);pacer.start(current,18568);
 const requested=direction>0?1:0,target=pacer.target(requested,current,18568);
 assert.ok(Math.abs(pacer.position(target)-pacer.position(current))<=.750000001);
 for(const dt of [1/fps,.5]){
  const next=pacer.advance(current,target,dt,5.8),delta=pacer.position(next)-pacer.position(current);
  assert.ok(Math.abs(delta)<=Math.min(dt,.05)+1e-10,'Frame stall must not skip a scene');
  assert.ok(delta*direction>=0,'Reverse input must move backward immediately');
 }
 cases++;
}
const pacer=new MobileScrollPacer(stops);pacer.start(.4,18568);
for(let i=0;i<=1000;i++)assert.ok(Math.abs(pacer.progress(pacer.position(i/1000))-i/1000)<1e-12);
for(const mode of ['desktop','reduced','explicit-navigation']){
 innerWidth=mode==='desktop'?1440:390;reduced=mode==='reduced';if(mode==='explicit-navigation')pacer.reset();
 const before=scrollWrites.length;
 assert.equal(pacer.target(.9,.1,18568),.9);
 assert.equal(pacer.advance(.1,.9,.016,8),.1+.8*(1-Math.exp(-8*.016)));
 assert.equal(scrollWrites.length,before);
}
console.log(JSON.stringify({cases,inversePositions:1001,bypasses:['desktop','reduced','explicit-navigation'],candidates},null,2));
