import{readFileSync,writeFileSync}from'node:fs';
const root='tmp/equipment-definitions',snapshot=JSON.parse(readFileSync(root+'/potions-2026-10-19-before.json','utf8'));
const compact=r=>({key:r.content_key,name:r.name,cost:r.payload.cost,rarity:r.payload.rarity,weight:r.payload.unitWeight,definition:{id:r.payload.rules?.definition.id,rarity:r.payload.rules?.definition.rarity,description:r.payload.rules?.definition.description,capabilities:r.payload.rules?.definition.capabilities},features:r.payload.features});
const findings={revision:snapshot.revision,shared:snapshot.shared.map(compact),ece:snapshot.ece.map(compact)};
writeFileSync(root+'/potions-2026-10-19-audit.json',JSON.stringify(findings,null,2));
console.log(JSON.stringify(snapshot.ece.map(r=>({key:r.content_key,name:r.name,rarity:r.payload.rules.definition.rarity,effects:r.payload.rules.definition.capabilities.flatMap(c=>c.effects.map(e=>({kind:e.kind,...(e.expression?{expression:e.expression}:{}),...(e.kind==='bonus'?{target:e.target,value:e.value}:{} )}))),tables:r.payload.rules.definition.description.filter(b=>b.type==='table').map(b=>({id:b.id,columns:b.columns,rows:b.rows}))}))));
