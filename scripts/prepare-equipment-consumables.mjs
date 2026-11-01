import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const root='docs/v2/equipment-consumables-2026-11-01/';
const before=JSON.parse(readFileSync(root+'before.json','utf8'));
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const{EquipmentDefinitionDraftSchema}=await server.ssrLoadModule('/src/domain/equipment/equipment-definition.ts');
 const changes=before.map(row=>{
  const definition=EquipmentDefinitionDraftSchema.parse(row.definition);
  assert.equal(definition.capabilities.length,1,row.name);
  const cap=definition.capabilities[0];cap.consumeQuantity=1;definition.consumable=true;
  cap.effects=[{id:'consumable-use',kind:'consumable-action',rule:row.name==='Poción de veneno'?'potion-poison':'alchemist-fire',condition:''}];
  cap.execution={mode:'automatic',handler:'equipment-consumable',explanation:'Selecciona el objetivo y registra consumo y efecto en una operación. El daño por turno y las salvaciones se resuelven en la ficha del afectado, conservando el estado entre sesiones.',pendingAutomation:[]};
  EquipmentDefinitionDraftSchema.parse(definition);
  return{...row,definition,consumable:true,features:row.features.map(f=>({...f,rolls:[]}))};
 });
 assert.equal(changes.length,4);writeFileSync(root+'reviews.json',JSON.stringify({baselineRevision:1752,changes}));
 console.log(JSON.stringify({definitions:4,ece:2,shared:2}));
}finally{await server.close();}
