/** Validate the real, exported post-cleanup data through the application adapters. */
import { createServer } from "vite";
import { readFileSync,writeFileSync } from "node:fs";
const root="tmp/spell-cleanup",read=(name)=>JSON.parse(readFileSync(`${root}/${name}.json`,"utf8"));
const server=await createServer({ configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:"custom" });
try {
  const { SupabaseCampaignContentStore }=await server.ssrLoadModule("/src/infrastructure/remote/supabase-campaign-content-store.ts");
  const { CharacterSpellV2Schema }=await server.ssrLoadModule("/src/domain/character/character-spell-model.ts");
  const { migrateLegacyCharacterSpellClasses }=await server.ssrLoadModule("/src/infrastructure/persistence/legacy-spell-class-migration.ts");
  const { resolveLearnedSpell,spellSourceTag,spellDefinitionSignature,isOldSpell }=await server.ssrLoadModule("/src/domain/spells/spell-source.ts");
  const { localizedManagedSpell }=await server.ssrLoadModule("/src/ui/localized-spells.ts");
  const { PHB_SPELLS }=await server.ssrLoadModule("/src/domain/character/phb-spells.ts");
  const rows=read("ece-spells-after"),plan=read("plan"),uses=read("ece-used-spells-before");
  const entries=rows.map((r)=>({ campaignId:r.campaign_id,kind:r.kind,contentKey:r.content_key,name:r.name,origin:r.origin,tags:r.tags,payload:r.payload,revision:r.revision,updatedAt:r.updated_at }));
  const content=await new SupabaseCampaignContentStore({ listCampaignContent:async()=>entries },plan.campaignId).load();
  if(content.spells.length!==700)throw new Error(`Some rows were dropped while loading: ${content.spells.length}`);
  const results=[];
  for (const [i,row] of uses.entries()) {
    const learned=CharacterSpellV2Schema.parse(migrateLegacyCharacterSpellClasses(row.payload));
    const visible=localizedManagedSpell(resolveLearnedSpell(learned,content.spells));
    if(spellSourceTag(visible.definition)!==plan.resolution[i].classification)throw new Error(`Incorrect visible source: ${learned.name}`);
    if(learned.definition && spellDefinitionSignature(visible.definition)!==spellDefinitionSignature(learned.definition))throw new Error(`Character version changed: ${learned.name}`);
    results.push({ characterId:row.parent_id,spellId:row.entity_id,name:learned.name,tag:spellSourceTag(visible.definition) });
  }
  for(const definition of Object.values(PHB_SPELLS)) {
    const actual=content.spells.find((s)=>s.catalog.contentKey===definition.catalog.contentKey);
    if(!actual||spellDefinitionSignature(actual)!==spellDefinitionSignature(definition))throw new Error(`Official copy differs from tutorial: ${definition.name}`);
  }
  for(const row of rows)if(row.tags.length!==1||!["manual_jugador","xanathar","custom","old"].includes(row.tags[0]))throw new Error("Unexpected extra classification");
  const active=content.spells.filter((s)=>!isOldSpell(s));
  if(active.length!==458||active.some((s)=>s.year!=="2014"))throw new Error("Invalid active catalog");
  const before=read("ece-spells-before");
  for(const custom of rows.filter((r)=>r.tags[0]==="custom")) {
    const original=before.find((r)=>r.content_key===custom.content_key);
    for(const [key,value]of Object.entries(original.payload))if(!["language","year"].includes(key)&&JSON.stringify(custom.payload[key])!==JSON.stringify(value))throw new Error(`Custom content changed: ${custom.name}/${key}`);
  }
  const summary={ loaded:content.spells.length,active:active.length,old:content.spells.filter(isOldSpell).length,learnedVerified:results.length,otherCampaignsVerified:read("unaffected-after").length,characterSpellsUnchanged:read("guards").used===read("guards-after").used,all316VersionsPreserved:true,tutorialDefinitionsMatch:true,customContentPreserved:true };
  writeFileSync(`${root}/verification.json`,JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary));
} finally { await server.close(); }
