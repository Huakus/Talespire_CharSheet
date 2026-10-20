import {readFileSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
const root='tmp/equipment-definitions',snapshot=JSON.parse(readFileSync(root+'/healing-execution-baseline.json','utf8'));
assert.equal(snapshot.ece.length,4);
const reviews=snapshot.ece.map(row=>{const definition=structuredClone(row.payload.rules.definition);assert.equal(definition.capabilities.length,1);
 const cap=definition.capabilities[0];assert.equal(cap.effects.length,1);assert.equal(cap.effects[0].kind,'healing');assert.equal(cap.consumeQuantity,1);
 cap.execution={mode:'automatic',handler:'equipment-potion-healing',explanation:'Beber y curarme o Administrar y curar valida la tirada, consume una dosis y aplica la curación en una sola operación guardada. La curación respeta los PG máximos, la Forma Salvaje y las salvaciones de muerte.',pendingAutomation:[]};definition.revision++;
 return {key:row.content_key,definition};});
writeFileSync(root+'/healing-execution-reviews.json',JSON.stringify(reviews));writeFileSync('docs/v2/equipment-completion-2026-10-19/healing-execution-definitions.json',JSON.stringify(reviews.map(r=>r.definition)));
console.log(JSON.stringify({variants:reviews.length}));
