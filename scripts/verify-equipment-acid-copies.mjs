import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const root='docs/v2/equipment-acid-2026-11-01/',read=n=>JSON.parse(readFileSync(root+n,'utf8'));
const before=read('copies-before.json'),after=read('copies-after.json'),review=read('reviews.json').changes.find(c=>c.scope==='ece');
assert.equal(before.length,2);assert.equal(after.length,before.length);
for(const row of before){
 const next=after.find(a=>a.owner===row.owner&&a.id===row.id&&a.kind===row.kind);assert.ok(next);
 const expected=structuredClone(row.payload);expected.rules.definition=review.definition;expected.catalog.revision++;
 expected.consumable=true;expected.features=expected.features.map(f=>review.definition.capabilities.some(c=>c.id===f.id)?{...f,kind:'action',rolls:[],showInActions:false}:f);
 assert.deepEqual(next.payload,expected);
}
assert.deepEqual(read('guards-before.json'),read('guards-after.json'));
const result={revision:1757,copies:after.length,exactPayloadChanges:true,identitiesQuantitiesPricesStatesAndCountersPreserved:true,unrelatedDataUnchanged:true};
writeFileSync(root+'copies-verified.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
