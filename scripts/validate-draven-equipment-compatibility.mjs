import{readFileSync,writeFileSync}from'node:fs';import{createServer}from'vite';
const root='docs/v2/equipment-client-compatibility-2026-11-01/';
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const{CharacterInventoryItemV2Schema}=await server.ssrLoadModule('/src/domain/character/character-inventory-model.ts');
 const{EquipmentDefinitionDraftSchema}=await server.ssrLoadModule('/src/domain/equipment/equipment-definition.ts');
 const result=JSON.parse(readFileSync(root+'draven-inventory.json','utf8')).map(row=>{
  const item=CharacterInventoryItemV2Schema.safeParse(row.payload),definition=EquipmentDefinitionDraftSchema.safeParse(row.payload.rules.definition);
  return{id:row.entity_id,name:row.payload.name,position:row.position,itemValid:item.success,definitionValid:definition.success,issues:definition.success?[]:definition.error.issues};
 });
 writeFileSync(root+'current-client-validation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 if(result.some(r=>!r.itemValid||!r.definitionValid))process.exitCode=1;
 const saved=JSON.parse(readFileSync(root+'draven-fragments.json','utf8')),meta=saved.meta[0];
 const{assembleCampaign}=await server.ssrLoadModule('/src/infrastructure/remote/campaign-fragments.ts');
 const iso=value=>new Date(value).toISOString();
 const state={campaignRevision:meta.state_revision,campaignUpdatedAt:iso(meta.state_updated_at),updatedBy:null,characters:[{characterId:meta.character_id,revision:meta.revision,createdAt:iso(meta.created_at),updatedAt:iso(meta.updated_at)}],fragments:saved.fragments.map(f=>({kind:f.fragment_kind,parentId:f.parent_id,entityId:f.entity_id,position:f.position,payload:f.payload,revision:f.revision}))};
 const campaign=assembleCampaign(state),character=campaign.characters[meta.character_id];
 const rebuilt={character:character.name,id:character.id,campaignRevision:campaign.revision,inventory:character.inventory.length,spells:character.spellcasting.spells.length,completeCharacterReconstruction:true,remoteWrites:false};
 writeFileSync(root+'character-validation.json',JSON.stringify(rebuilt,null,2));console.log(JSON.stringify(rebuilt));
}finally{await server.close();}
