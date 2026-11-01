import{readFileSync,writeFileSync}from'node:fs';import assert from'node:assert/strict';import{createServer}from'vite';
const root='docs/v2/equipment-food-2026-11-01/',rows=JSON.parse(readFileSync(root+'before.json','utf8'));
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{const{EquipmentDefinitionDraftSchema}=await server.ssrLoadModule('/src/domain/equipment/equipment-definition.ts');
 const changes=rows.map(r=>{const definition=EquipmentDefinitionDraftSchema.parse(r.definition);assert.equal(definition.capabilities.length,1);const cap=definition.capabilities[0];
  cap.effects=[{id:'daily-food',kind:'food',days:1,condition:''}];cap.activation='action';cap.consumeQuantity=1;cap.requirements.presence='possessed';cap.name='Comer una ración';
  cap.execution={mode:'automatic',handler:'equipment-food',explanation:'Consume una unidad y registra alimento para un día de campaña. No concede curación ni sustituye el agua.',pendingAutomation:[]};definition.consumable=true;
  EquipmentDefinitionDraftSchema.parse(definition);return{...r,definition,consumable:true,features:r.features.map(f=>f.id===cap.id?{...f,name:cap.name,kind:'action',rolls:[]}:f)};
 });assert.equal(changes.length,2);writeFileSync(root+'reviews.json',JSON.stringify({baselineRevision:1754,changes}));console.log(JSON.stringify({definitions:2,ece:1,shared:1}));
}finally{await server.close();}
