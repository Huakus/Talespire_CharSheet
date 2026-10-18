import{readFileSync,writeFileSync,readdirSync,existsSync}from"node:fs";
import{equipmentRetirementCatalog}from"./equipment-retirement-catalog.mjs";
const read=p=>JSON.parse(readFileSync(p,"utf8")),rows=equipmentRetirementCatalog(),byKey=new Map(rows.map(r=>[r.content_key,r]));
const pending=read("docs/v2/equipment-retirement-2026-10-18/pending.json").rows;
const legacy=pending.map(p=>({...p,old:byKey.get(p.key),targets:p.candidates.map(c=>byKey.get(c.key))}));
writeFileSync("tmp/equipment-definitions/completion-legacy.json",JSON.stringify(legacy));
const base='docs/v2/equipment-retirement-2026-10-18',stages=['',...readdirSync(base,{withFileTypes:true}).filter(d=>d.isDirectory()&&d.name!=='shared'&&existsSync(base+'/'+d.name+'/manifest.json')&&existsSync(base+'/'+d.name+'/verified.json')).map(d=>'/'+d.name)],removed=new Set(stages.flatMap(s=>read(base+s+'/manifest.json').rows.map(r=>r.key)));
const canonical=rows.filter(r=>r.payload.rules&&!r.deleted_at&&!removed.has(r.content_key)),handlers={},effects={},pendingKinds={};
for(const r of canonical)for(const c of r.payload.rules.definition.capabilities){
 (handlers[c.execution.handler??c.execution.mode]??=[]).push({key:r.content_key,name:r.name,cap:c.id});
 for(const e of c.effects)(effects[e.kind]??=[]).push({name:r.name,cap:c.id,effect:e});
 for(const n of c.execution.pendingAutomation)(pendingKinds[n]??=[]).push(r.name);
}
writeFileSync("tmp/equipment-definitions/completion-automation.json",JSON.stringify({handlers,effects,pendingKinds}));
console.log(JSON.stringify({legacy:legacy.map(r=>({name:r.name,candidates:r.targets.map(t=>t.name),fields:Object.keys(r.old.payload)})),canonical:canonical.length,handlers:Object.fromEntries(Object.entries(handlers).map(([k,v])=>[k,v.length])),effects:Object.fromEntries(Object.entries(effects).map(([k,v])=>[k,v.length]))}));
