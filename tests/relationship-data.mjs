// Verify the authored learning paths against the preserved source graph.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RELATION_SOURCE as graph } from '../design/redesign/relation-source.js';
import { RELATION_GROUPS as groups, RELATION_SCENARIOS as scenarios, RELATION_KINDS as kinds } from '../design/redesign/relation-scenarios.js';
const source=JSON.parse(readFileSync(new URL('../data/hardware-graph.json',import.meta.url)));
const key=(a,b)=>[a,b].sort().join('--');
const nodes=new Set(graph.nodes.map(n=>n.id));
const edges=new Map(graph.edges.map(e=>[key(e.a,e.b),e]));
assert.equal(nodes.size,23);
assert.equal(edges.size,124);
assert.equal(source.edges.length,115);
for(const e of source.edges){
 const projected=edges.get(key(e.a,e.b));
 assert.ok(projected,`Missing source relationship ${e.a}/${e.b}`);
 assert.equal(projected.a,e.a,'Preserve the source explanation direction');
 assert.equal(projected.b,e.b);
}
for(const e of graph.edges){
 assert.ok(nodes.has(e.a)&&nodes.has(e.b));
 assert.ok(Object.hasOwn(kinds,e.kind));
 assert.ok(e.ab.trim()&&e.ba.trim(),`${e.id} requires both perspectives`);
}
assert.equal(groups.length,6);
assert.deepEqual(new Set(groups.flatMap(g=>g.nodes)),nodes);
for(const g of groups)assert.ok(g.nodes.includes(g.focus));
assert.equal(scenarios.length,16);
assert.equal(new Set(scenarios.map(s=>s.id)).size,16);
assert.deepEqual(scenarios.filter(s=>s.film).map(s=>s.film),['boot','game','search','storage']);
for(const s of scenarios){
 assert.equal(s.steps.length,4);
 for(const step of s.steps){
  assert.ok(nodes.has(step.focus)&&step.nodes.includes(step.focus));
  assert.ok(step.title&&step.copy);
  assert.equal(new Set(step.nodes).size,step.nodes.length);
  for(const n of step.nodes){
   assert.ok(nodes.has(n),`${s.id}: unknown hardware ${n}`);
   if(n!==step.focus)assert.ok(edges.has(key(step.focus,n)),`${s.id}: unsupported relationship ${step.focus}/${n}`);
  }
 }
}
console.log('Original 115 relationships preserved / 23 hardware / six groups / 64 supported stages PASS');
