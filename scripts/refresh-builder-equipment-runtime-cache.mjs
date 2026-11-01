import{readFileSync,writeFileSync,existsSync}from'node:fs';import assert from'node:assert/strict';import{createServer}from'vite';
const path='src/domain/equipment/builder-equipment-cache.json',cache=JSON.parse(readFileSync(path,'utf8'));
const editorial=JSON.parse(readFileSync('docs/v2/equipment-editorial-cleanup-2026-11-01/plan.json','utf8')).changes.filter(c=>c.scope==='ece'),native=JSON.parse(readFileSync('docs/v2/equipment-native-reconciliation-2026-11-01/reviews.json','utf8')).changes.filter(c=>c.scope==='ece');
const conditionalPath='docs/v2/equipment-conditional-checks-2026-11-01/reviews.json';
const conditional=existsSync(conditionalPath)?JSON.parse(readFileSync(conditionalPath,'utf8')).changes.filter(c=>c.scope==='ece'):[];
const packPath='docs/v2/equipment-packs-2026-11-01/reviews.json';
const packs=existsSync(packPath)?JSON.parse(readFileSync(packPath,'utf8')).changes.filter(c=>c.scope==='ece'):[];
const consumablePath='docs/v2/equipment-consumables-2026-11-01/reviews.json';
const consumables=existsSync(consumablePath)?JSON.parse(readFileSync(consumablePath,'utf8')).changes.filter(c=>c.scope==='ece'):[];
const foodPath='docs/v2/equipment-food-2026-11-01/reviews.json';
const food=existsSync(foodPath)?JSON.parse(readFileSync(foodPath,'utf8')).changes.filter(c=>c.scope==='ece'):[];
const acidPath='docs/v2/equipment-acid-2026-11-01/reviews.json';
const acid=existsSync(acidPath)?JSON.parse(readFileSync(acidPath,'utf8')).changes.filter(c=>c.scope==='ece'):[];
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const{EquipmentDefinitionDraftSchema}=await server.ssrLoadModule('/src/domain/equipment/equipment-definition.ts');let changes=0;
 for(const e of cache){const before=JSON.stringify(e),rule=acid.find(c=>c.key===e.catalog.contentKey)??food.find(c=>c.key===e.catalog.contentKey)??consumables.find(c=>c.key===e.catalog.contentKey)??packs.find(c=>c.key===e.catalog.contentKey)??conditional.find(c=>c.key===e.catalog.contentKey)??native.find(c=>c.key===e.catalog.contentKey),text=editorial.find(c=>c.key===e.catalog.contentKey);
  if(rule){e.definition=rule.definition;e.catalog.revision=rule.revision+1;}
  else if(text){const field=text.fields.find(f=>f.path.join('.')==='rules.definition.description');if(field){e.definition.description=field.value;const ids=new Set(field.value.map(b=>b.id));for(const cap of e.definition.capabilities){cap.textBlockIds=cap.textBlockIds.filter(id=>ids.has(id));if(!cap.textBlockIds.length)cap.textBlockIds=[field.value[0].id];}}e.catalog.revision=text.revision+1;}
  EquipmentDefinitionDraftSchema.parse(e.definition);assert.equal(e.definition.language,'es');assert.equal(e.definition.magical,false);
  if(JSON.stringify(e)!==before)changes++;
 }
 writeFileSync(path,JSON.stringify(cache));writeFileSync('docs/v2/equipment-native-reconciliation-2026-11-01/builder-cache.json',JSON.stringify({templates:cache.length,refreshed:changes},null,2));console.log(JSON.stringify({templates:cache.length,refreshed:changes}));
}finally{await server.close();}
