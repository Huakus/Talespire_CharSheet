import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import assert from'node:assert/strict';import{createServer}from'vite';
const root='tmp/equipment-definitions',read=p=>JSON.parse(readFileSync(p,'utf8')),snapshot=read(root+'/potions-2026-10-19-before.json'),server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true,hmr:false},appType:'custom'});
try{const{equipmentVariantDescription}=await server.ssrLoadModule('/src/domain/equipment/equipment-variant-description.ts');
 const healing=snapshot.ece.filter(r=>r.payload.rules.definition.capabilities.some(c=>c.effects.some(e=>e.kind==='healing')));
 assert.equal(healing.length,4);assert.equal(new Set(healing.map(r=>r.payload.rules.definition.capabilities.flatMap(c=>c.effects.filter(e=>e.kind==='healing').map(e=>e.expression)).join(','))).size,4);
 const reviews=healing.flatMap(row=>{const d=structuredClone(row.payload.rules.definition),description=equipmentVariantDescription(d);if(JSON.stringify(description)===JSON.stringify(d.description))return[];d.description=description;d.revision++;return[{key:row.content_key,definition:d}];});
 assert.equal(reviews.length,3);writeFileSync(root+'/healing-potion-variants-reviews.json',JSON.stringify(reviews));
 const base='docs/v2/equipment-completion-2026-10-19';mkdirSync(base,{recursive:true});
 writeFileSync(base+'/healing-potion-definitions.json',JSON.stringify(healing.map(r=>r.payload.rules.definition)));
 writeFileSync(base+'/potion-identity-audit.json',JSON.stringify({baselineRevision:snapshot.revision,scope:'ECE y catálogo compartido',healingVariants:healing.map(r=>({key:r.content_key,name:r.name,rarity:r.payload.rules.definition.rarity,healing:r.payload.rules.definition.capabilities.flatMap(c=>c.effects.filter(e=>e.kind==='healing').map(e=>e.expression))})),healingDuplicates:[],otherDistinctions:['Las pociones de fuerza de gigante de hielo y de piedra son variantes distintas que comparten Fuerza 23 y rareza rara en la tabla del SRD; conservar ambas identidades.','La poción de veneno se conserva separada de las de curación.'],changes:reviews.map(r=>r.key)},null,2));
 console.log(JSON.stringify({healingVariants:4,changedTables:reviews.length,duplicates:0}));
}finally{await server.close();}
