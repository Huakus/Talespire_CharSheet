import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const root='docs/v2/equipment-acid-2026-11-01/';
const before=JSON.parse(readFileSync(root+'before.json','utf8'));
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const{EquipmentDefinitionDraftSchema}=await server.ssrLoadModule('/src/domain/equipment/equipment-definition.ts');
 const changes=before.map(row=>{
  const definition=EquipmentDefinitionDraftSchema.parse(row.definition);
  assert.equal(definition.capabilities.length,1,row.name);
  const cap=definition.capabilities[0];definition.consumable=true;
  cap.consumeQuantity=1;cap.activation='action';cap.range='Esparcir: 5 pies. Lanzar: 20 pies.';cap.target='Una criatura u objeto';cap.duration='Instantánea';
  cap.effects=[{id:'acid-use',kind:'consumable-action',rule:'acid',condition:''}];
  cap.execution={mode:'assisted',handler:'equipment-consumable',explanation:'El ataque contra un personaje, el daño de ácido y el gasto del vial se guardan en una operación. El modo esparcir también hace un ataque a distancia. Los dados de daño se duplican con 20 natural; Destreza se suma una sola vez.',pendingAutomation:['Objetivos objeto o monstruo sin ficha de personaje y sus defensas particulares.','Cobertura, ocultación y situaciones que dan ventaja o desventaja se confirman en el control de tirada.','Las reglas generales de daño a cero PG aún no se resuelven desde este recorrido.']};
  EquipmentDefinitionDraftSchema.parse(definition);
  return{...row,definition,consumable:true,features:row.features.map(f=>({...f,kind:'action',rolls:[],showInActions:false}))};
 });
 assert.equal(changes.length,2);writeFileSync(root+'reviews.json',JSON.stringify({baselineRevision:1756,changes}));
 console.log(JSON.stringify({definitions:2,ece:1,shared:1}));
}finally{await server.close();}
