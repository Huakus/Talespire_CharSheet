import{readFileSync}from'node:fs';const root='docs/v2/equipment-native-reconciliation-2026-11-01/',read=n=>JSON.parse(readFileSync(root+n,'utf8')),r=read('reviews.json');
const rows=Array.from({length:9},(_,i)=>read('before-'+String(i).padStart(2,'0')+'.json')).flat();
for(const row of rows.filter(r=>r.scope==='ece'&&r.definition.category==='tool')){const next=r.changes.find(c=>c.key===row.key&&c.scope==='ece')??row;console.log(JSON.stringify({name:next.name,capabilities:next.definition.capabilities.map(c=>({id:c.id,effects:c.effects.map(e=>e.kind),mode:c.execution.mode}))}));}
