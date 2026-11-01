import{readFileSync,writeFileSync}from'node:fs';import assert from'node:assert/strict';
const root='docs/v2/equipment-doss-2026-11-01/',read=n=>JSON.parse(readFileSync(root+n,'utf8')),plan=read('plan.json'),after=read('after.json'),before=read('owners-before.json'),review=read('review.json');
assert.deepEqual(after.catalog.payload.rules.definition,review.definition);assert.deepEqual(after.catalog.payload.features,review.features);assert.equal(after.catalog.payload.charges,null);
for(const p of plan.copies){const copy=after.copies.find(c=>c.owner===p.owner&&c.id===p.id),old=before.copies.find(c=>c.parent_id===p.owner&&c.entity_id===p.id);assert.ok(copy);assert.ok(old);
 for(const k of ['id','name','quantity','unitWeight','cost','equipped','attuned','bonuses','properties','armor','weapon','group','order'])assert.deepEqual(copy.payload[k],old.payload[k]);
 assert.deepEqual(copy.payload.rules.definition,review.definition);assert.deepEqual(copy.payload.features,p.next.features);assert.equal(copy.payload.charges,null);assert.equal(copy.payload.catalog.revision,after.catalog.revision);
}
for(const s of plan.spells){const actual=after.spells.find(x=>x.owner===s.owner&&x.payload.id===s.payload.id);assert.ok(actual);assert.deepEqual(actual.payload,s.payload);}
const verified={revision:1754,definitions:1,copies:plan.copies.length,itemSpellGrants:plan.spells.length,exactPublishedDefinition:true,identityAndOwnershipPreserved:true,independentUsesNotInventedFromSharedCounter:true,remaining:review.definition.review.unresolved};
writeFileSync(root+'verified.json',JSON.stringify(verified,null,2));console.log(JSON.stringify(verified));
