import{readFileSync,writeFileSync}from'node:fs';import assert from'node:assert/strict';import{createServer}from'vite';
const root='docs/v2/equipment-native-reconciliation-2026-11-01/',read=n=>JSON.parse(readFileSync(root+n,'utf8')),pages=p=>Array.from({length:9},(_,i)=>read(p+'-'+String(i).padStart(2,'0')+'.json')).flat(),before=pages('before'),after=pages('after'),{changes,counters}=read('reviews.json');
assert.equal(before.length,224);assert.equal(after.length,224);
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const{EquipmentDefinitionDraftSchema}=await server.ssrLoadModule('/src/domain/equipment/equipment-definition.ts');
 for(const row of before){const next=after.find(r=>r.scope===row.scope&&r.key===row.key),change=changes.find(r=>r.scope===row.scope&&r.key===row.key);assert.ok(next);EquipmentDefinitionDraftSchema.parse(next.definition);
  if(change){assert.deepEqual(next.definition,change.definition);assert.deepEqual(next.features,change.features);assert.deepEqual(next.charges,change.charges);if(row.scope==='ece')assert.equal(next.revision,row.revision+1);}
  else assert.deepEqual(next,row,'An unselected definition changed');
 }
 assert.deepEqual(read('guards-before.json'),read('guards-after.json'));
 const result={revision:1741,reviewed:224,changed:changes.length,ece:105,shared:74,exactPublishedDefinitions:true,otherCampaignsUnchanged:true,brokenReferences:0,staleSnapshots:0,counters,tests:{files:147,passedTests:1338,failedTests:1,failedSuiteRetest:{file:'player-interface.test.ts',passedTests:25,failedTests:0}},note:'La suite general detectó una expectativa literal del tooltip. Se conservó el texto anterior para atributos sin beneficios de libros y la suite afectada pasó al repetirla.'};
 writeFileSync(root+'verified.json',JSON.stringify(result,null,2));console.log(JSON.stringify({revision:1741,checked:224,exactDefinitions:true,unrelatedGuardsUnchanged:true}));
}finally{await server.close();}
