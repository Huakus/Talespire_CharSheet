/** Smoke test against a fresh database export, including all real characters and spells. */
import{readFileSync,writeFileSync,existsSync}from"node:fs";
import assert from"node:assert/strict";
import{createServer}from"vite";
const root="tmp/equipment-definitions",read=(n)=>JSON.parse(readFileSync(`${root}/${n}`,"utf8")),metadata=read("equipment-release-metadata.json"),rows=[0,200,400,600].flatMap((n)=>read(`equipment-release-fragments-${n}.json`)),before=read("owned-migration-live-before.json"),baseline=read("latest-preparation-baseline.json");
if(existsSync(`${root}/equipment-release-final-patch.json`)){
 const patch=read("equipment-release-final-patch.json");
 metadata.revision=patch.revision;metadata.campaignUpdatedAt=patch.campaignUpdatedAt;metadata.versions=patch.versions;
 for(const updated of patch.rows){const i=rows.findIndex((r)=>r.fragment_kind===updated.fragment_kind&&r.parent_id===updated.parent_id&&r.entity_id===updated.entity_id);assert.ok(i>=0);rows[i]=updated;}
}
// A catalog-only cleanup leaves character fragments unchanged (verified by the
// guarded publication), but replaces the historical preparation metadata.
if(existsSync(`${root}/equipment-release-catalog-patch.json`)){
 const patch=read("equipment-release-catalog-patch.json");
 assert.ok(patch.revision>=metadata.revision);
 metadata.revision=patch.revision;metadata.campaignUpdatedAt=new Date(patch.campaignUpdatedAt).toISOString();
 metadata.versions=patch.versions;metadata.preparations=patch.preparations;
}
// Verified editorial publication updates thirteen owned tool snapshots, preserving all runtime state.
if(existsSync(`${root}/equipment-release-tools-patch.json`)){
 const patch=read("equipment-release-tools-patch.json");assert.ok(patch.revision>=metadata.revision);
 metadata.revision=patch.revision;metadata.campaignUpdatedAt=patch.campaignUpdatedAt;metadata.versions=patch.versions;metadata.preparations=patch.preparations;
 for(const updated of patch.rows){const i=rows.findIndex(r=>r.fragment_kind===updated.fragment_kind&&r.parent_id===updated.parent_id&&r.entity_id===updated.entity_id);assert.ok(i>=0);rows[i]=updated;}
}
if(existsSync(`${root}/equipment-release-last-retirement.json`)){
 const patch=read("equipment-release-last-retirement.json");assert.ok(patch.revision>=metadata.revision);
 metadata.revision=patch.revision;metadata.campaignUpdatedAt=new Date(patch.campaignUpdatedAt).toISOString();
}
if(existsSync(`${root}/equipment-release-usage-patch.json`)){
 const patch=read('equipment-release-usage-patch.json');assert.ok(patch.revision>=metadata.revision);
 metadata.revision=patch.revision;metadata.campaignUpdatedAt=patch.campaignUpdatedAt;metadata.versions=patch.versions;metadata.preparations=patch.preparations;
 for(const updated of patch.rows){const i=rows.findIndex(r=>r.fragment_kind===updated.fragment_kind&&r.parent_id===updated.parent_id&&r.entity_id===updated.entity_id);assert.ok(i>=0);rows[i]=updated;}
}
const retirementPath="docs/v2/equipment-retirement-2026-10-18";
const retirement=existsSync(`${retirementPath}/verified.json`)?JSON.parse(readFileSync(`${retirementPath}/verified.json`,"utf8")):null;
const retiredPreparations=new Set(retirement&&metadata.revision>=retirement.revision
 ?JSON.parse(readFileSync(`${retirementPath}/manifest.json`,"utf8")).preparationKeys:[]);
if(existsSync(`${retirementPath}/preparations/verified.json`)){
 const verified=JSON.parse(readFileSync(`${retirementPath}/preparations/verified.json`,'utf8'));
 if(metadata.revision>=verified.revision)for(const key of JSON.parse(readFileSync(`${retirementPath}/preparations/manifest.json`,'utf8')).preparationKeys)retiredPreparations.add(key);
}
const expectedPreparations=baseline.records.filter(r=>!retiredPreparations.has(r.catalog.contentKey));
const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:"custom"});
try{
 const{assembleCampaign}=await server.ssrLoadModule("/src/infrastructure/remote/campaign-fragments.ts"),{projectInventory,projectAbilityScore,projectUpdatedBuilderSpeed,abilityModifier}=await server.ssrLoadModule("/src/domain/character/character-projection.ts"),{CharacterV2Schema}=await server.ssrLoadModule("/src/domain/character/character-v2.ts");
 const campaign=assembleCampaign({campaignRevision:metadata.revision,campaignUpdatedAt:metadata.campaignUpdatedAt,updatedBy:null,characters:metadata.versions.map((v)=>({characterId:v.character_id,revision:v.revision,createdAt:v.created_at,updatedAt:v.updated_at})),fragments:rows.map((r)=>({kind:r.fragment_kind,parentId:r.parent_id,entityId:r.entity_id,position:r.position,payload:r.payload,revision:r.revision}))});
 assert.equal(Object.keys(campaign.characters).length,16);assert.equal(Object.values(campaign.characters).reduce((n,c)=>n+c.inventory.length,0),241);
 assert.equal(metadata.preparations.length,expectedPreparations.length);
 for(const key of retiredPreparations)assert.ok(!metadata.preparations.some(p=>p.contentKey===key),"Retired preparation reappeared.");
 for(const r of expectedPreparations){const actual=metadata.preparations.find((p)=>p.contentKey===r.catalog.contentKey);assert.ok(actual);assert.equal(actual.revision,r.catalog.revision);assert.equal(Date.parse(actual.updatedAt),Date.parse(r.catalog.updatedAt));}
 const runtimeChanges=[],projections=[];
 for(const c of Object.values(campaign.characters)){
  const originals=before.characters.filter((r)=>r.parent_id===c.id),runtime=originals.find((r)=>r.fragment_kind==="character-runtime"),core=originals.find((r)=>r.fragment_kind==="character-core");
  assert.deepEqual(rows.find((r)=>r.fragment_kind==="character-core"&&r.parent_id===c.id).payload,core.payload);
  const actualRuntime=rows.find((r)=>r.fragment_kind==="character-runtime"&&r.parent_id===c.id);
  assert.deepEqual({...actualRuntime.payload,combat:{...actualRuntime.payload.combat,armorClass:runtime.payload.combat.armorClass,speed:runtime.payload.combat.speed}},runtime.payload);
  const old=CharacterV2Schema.parse({...c,...runtime.payload,spellcasting:{...runtime.payload.spellcasting,spells:c.spellcasting.spells},inventory:originals.filter((r)=>r.fragment_kind==="character-inventory").map((r)=>r.payload),actions:originals.filter((r)=>r.fragment_kind==="character-action").map((r)=>r.payload)});
  const oldAC=projectInventory(old).calculatedArmorClass,newAC=projectInventory(c).calculatedArmorClass,newSpeed=projectUpdatedBuilderSpeed(old,{...c,combat:{...c.combat,speed:old.combat.speed}});
  const constitutionDifference=abilityModifier(projectAbilityScore(c,"constitution"))-abilityModifier(projectAbilityScore(old,"constitution"));
  assert.equal(constitutionDifference,0,"No active Constitution modifiers changed in this batch.");
  const next=structuredClone(actualRuntime.payload);
  next.combat.armorClass=oldAC!==newAC?newAC:runtime.payload.combat.armorClass;
  next.combat.speed=newSpeed;
  if(JSON.stringify(next)!==JSON.stringify(actualRuntime.payload))runtimeChanges.push({character:c.name,characterId:c.id,before:actualRuntime,payload:next,version:metadata.versions.find((v)=>v.character_id===c.id)});
  for(const item of c.inventory){assert.ok(item.rules);const raw=item.rules.original;for(const key of["id","order","group","quantity","cost","equipped","attuned"])assert.deepEqual(item[key],raw[key],`${c.name}/${item.name}/${key}`);}
  projections.push({character:c.name,id:c.id,inventory:c.inventory.length,savedArmorClass:c.combat.armorClass,previousCalculatedArmorClass:oldAC,newCalculatedArmorClass:newAC,oldSpeed:c.combat.speed,newSpeed,spells:c.spellcasting.spells.length});
 }
 const result={campaignRevision:metadata.revision,characters:16,inventory:241,preparationsUnchanged:expectedPreparations.length,preparationsRetired:retiredPreparations.size,allCharactersLoad:true,individualStatePreserved:true,projections,runtimeChanges};
 writeFileSync(`${root}/equipment-release-verification.json`,JSON.stringify(result,null,2));
 if(process.argv.includes("--require-current"))assert.equal(runtimeChanges.length,0,"Published runtime caches must match the reviewed equipment projection.");
 console.log(JSON.stringify({characters:16,inventory:241,preparationsUnchanged:expectedPreparations.length,preparationsRetired:retiredPreparations.size,runtimeCacheUpdates:runtimeChanges.length,updates:runtimeChanges.map((r)=>({character:r.character,armorClassBefore:r.before.payload.combat.armorClass,armorClassAfter:r.payload.combat.armorClass,speedBefore:r.before.payload.combat.speed,speedAfter:r.payload.combat.speed}))},null,2));
}finally{await server.close();}
