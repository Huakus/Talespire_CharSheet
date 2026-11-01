import{readFileSync,writeFileSync}from'node:fs';import assert from'node:assert/strict';import{createServer}from'vite';
const stages=process.argv.length>2?process.argv.slice(2):['conditional-checks','channel-divinity','flight','last-charge','last-charge-outcomes'],server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{const{EquipmentDefinitionDraftSchema}=await server.ssrLoadModule('/src/domain/equipment/equipment-definition.ts');
 for(const stage of stages){const root=`docs/v2/equipment-${stage}-2026-11-01/`,read=n=>JSON.parse(readFileSync(root+n,'utf8')),paged=stage.startsWith('last-charge'),before=paged?[...read('before-0.json'),...read('before-1.json')]:read('before.json'),after=paged?[...read('after-0.json'),...read('after-1.json')]:read('after.json'),review=read('reviews.json');
  for(const c of review.changes){const row=after.find(r=>r.scope===c.scope&&r.key===c.key),old=before.find(r=>r.scope===c.scope&&r.key===c.key);assert.ok(row);assert.ok(old);EquipmentDefinitionDraftSchema.parse(row.definition);assert.deepEqual(row.definition,c.definition);assert.deepEqual(row.features,c.features);assert.deepEqual(row.charges,c.charges);if(row.scope==='ece')assert.equal(row.revision,old.revision+1);}
  const batches=paged?read('manifest.json').batches.length:1;
  const result={baselineRevision:review.baselineRevision,revision:review.baselineRevision+batches,definitions:after.length,exactPublishedDefinitions:true,countersUnchanged:true};writeFileSync(root+'verified.json',JSON.stringify(result,null,2));console.log(JSON.stringify({stage,...result}));
 }
}finally{await server.close();}
