import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{createServer}from'vite';
const read=p=>JSON.parse(readFileSync(p,'utf8')),base='docs/v2/',root='tmp/equipment-ui-preview/';mkdirSync(root,{recursive:true});
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const{createCharacter}=await server.ssrLoadModule('/src/domain/character/create-character.ts');
 const{normalizeEquipmentDefinition}=await server.ssrLoadModule('/src/domain/equipment/equipment-catalog.ts');
 const{bindReviewedEquipment}=await server.ssrLoadModule('/src/domain/equipment/equipment-live.ts');
 const{syncInventorySpellGrants}=await server.ssrLoadModule('/src/domain/character/item-spells.ts');
 const parts=[0,1,2].flatMap(i=>read(base+`equipment-packs-2026-11-01/parts-${i}.json`));
 const changes=['packs','consumables','food'].flatMap(n=>read(base+`equipment-${n}-2026-11-01/reviews.json`).changes.filter(r=>r.scope==='ece'));
 const catalog=parts.map(r=>{const change=changes.find(c=>c.key===r.key),item=normalizeEquipmentDefinition({...r.payload,rules:{...r.payload.rules,original:{}}});if(change){item.rules.definition=change.definition;item.features=change.features;item.unitWeight=change.unitWeight??item.unitWeight;item.consumable=change.consumable??item.consumable;}return{...item,catalog:{contentKey:r.key,origin:'official',tags:[],revision:change?change.revision+1:r.revision}};});
 const doss=read(base+'equipment-doss-2026-11-01/review.json'),c=createCharacter('chr_11111111111111111111111111111111','Prueba local de objetos','2026-11-01T15:00:00.000Z');c.identity.className='Bardo';c.identity.level=7;c.abilities.charisma=18;c.combat.hitPoints={current:40,maximum:60,temporary:0};c.spellcasting.ability='charisma';
 const selected=[...changes.filter(r=>r.name==='Raciones (1 día)'||r.name==='Poción de veneno'||r.name==='Fuego de alquimista (frasco)'||r.name==='Paquete de ladrón'),doss];
 for(const[r,entry]of selected.entries()){
  const raw=normalizeEquipmentDefinition({name:entry.name,consumable:entry.consumable??false});
  const item=bindReviewedEquipment({...raw,id:'inv_'+String(r+1).padStart(32,'0'),order:r,group:'Equipo',features:[],quantity:entry.name.startsWith('Paquete')?1:2},entry.definition);
  item.features=entry.features;item.equipped=item.name.includes('Laúd');item.attuned=item.requiresAttunement;
  if(item.name.includes('Laúd'))item.quantity=1;c.inventory.push(item);
 }
 await syncInventorySpellGrants(c);
 writeFileSync(root+'fixture.json',JSON.stringify({character:c,catalog}));console.log(JSON.stringify({items:c.inventory.length,catalog:catalog.length,itemSpells:c.spellcasting.spells.length}));
}finally{await server.close();}
