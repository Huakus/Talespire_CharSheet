import { readFileSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const root='docs/v2/equipment-doss-2026-11-01/',read=n=>JSON.parse(readFileSync(root+n,'utf8'));
const change=read('review.json'),state=read('owners-before.json'),cid='9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd';
const q=s=>"'"+String(s).replaceAll("'","''")+"'",j=value=>{const data=JSON.stringify(value),tag='doss_'+createHash('sha256').update(data).digest('hex').slice(0,16);return '$'+tag+'$'+data+'$'+tag+'$::jsonb';};
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const{bindReviewedEquipment}=await server.ssrLoadModule('/src/domain/equipment/equipment-live.ts');
 const{createCharacter}=await server.ssrLoadModule('/src/domain/character/create-character.ts');
 const{syncInventorySpellGrants}=await server.ssrLoadModule('/src/domain/character/item-spells.ts');
 const{CharacterInventoryItemV2Schema}=await server.ssrLoadModule('/src/domain/character/character-inventory-model.ts');
 const copies=[],spells=[];
 for(const row of state.copies){
  const old=CharacterInventoryItemV2Schema.parse(row.payload),oldCapIds=new Set(old.rules.definition.capabilities.map(c=>c.id)),newCapIds=new Set(change.definition.capabilities.map(c=>c.id));
  const{rules,...base}=old;
  const item=bindReviewedEquipment({...base,features:old.features.filter(f=>!oldCapIds.has(f.id)||newCapIds.has(f.id))},change.definition,{preserveName:true});
  item.catalog={...old.catalog,revision:change.revision+1};
  item.rules.original=old.rules.original;
  item.rules.slotUsage=old.rules.slotUsage;
  // A previous shared 1/day counter cannot identify seven independently spent spells.
  // Preserve any already identified uses; newly introduced counters remain zero until dawn.
  for(const f of item.features){const previous=old.features.find(p=>p.id===f.id);if(f.uses&&previous?.uses)f.uses.current=Math.min(f.uses.maximum,previous.uses.current);}
  copies.push({...row,next:item});
  const core=state.cores.find(c=>c.entity_id===row.parent_id);assert.ok(core);
  const actor=createCharacter(row.parent_id,core.payload.name,'2026-11-01T00:00:00.000Z');
  actor.identity=core.payload.identity;actor.abilities=core.payload.abilities;actor.inventory=[item];
  actor.spellcasting.spells=state.spells.filter(s=>s.parent_id===row.parent_id).map(s=>s.payload);
  await syncInventorySpellGrants(actor);
  for(const spell of actor.spellcasting.spells){if(state.spells.some(s=>s.entity_id===spell.id))continue;spells.push({owner:actor.id,payload:spell});}
 }
 let sql=`begin;lock table public.campaigns,public.campaign_content_entries,public.campaign_state_fragments,public.campaign_character_versions in share row exclusive mode;do $doss$ begin if(select state_revision from public.campaigns where id=${q(cid)})<>1753 then raise exception 'DOSS_CAMPAIGN_CHANGED';end if;`;
 const target=`campaign_id=${q(cid)} and kind='equipment' and content_key=${q(change.key)}`;
 sql+=`if not exists(select 1 from public.campaign_content_entries t where ${target} and md5(to_jsonb(t)::text)=${q(change.hash)})then raise exception 'DOSS_DEFINITION_CHANGED';end if;`;
 let catalog='payload';for(const[path,value]of [['{rules,definition}',change.definition],['{features}',change.features],['{charges}',null],['{description}',change.description],['{rules,pending}',[]]])catalog=`jsonb_set(${catalog},'${path}',${j(value)},true)`;
 sql+=`update public.campaign_content_entries set payload=${catalog},revision=revision+1,updated_at=statement_timestamp()where ${target};`;
 for(const row of copies){
  const where=`campaign_id=${q(cid)} and fragment_kind='character-inventory' and parent_id=${q(row.parent_id)} and entity_id=${q(row.entity_id)}`;
  sql+=`if not exists(select 1 from public.campaign_state_fragments t where ${where} and md5(to_jsonb(t)::text)=${q(row.hash)})then raise exception 'DOSS_COPY_CHANGED';end if;`;
  let payload='payload';for(const path of ['description','charges','features','usable','consumable'])payload=`jsonb_set(${payload},'{${path}}',${j(row.next[path])},true)`;
  for(const[path,value]of [['{rules,definition}',change.definition],['{rules,pending}',row.next.rules.pending],['{rules,personalDescription}',row.next.rules.personalDescription],['{catalog,revision}',change.revision+1]])payload=`jsonb_set(${payload},'${path}',${j(value)},true)`;
  sql+=`update public.campaign_state_fragments set payload=${payload},revision=revision+1,updated_at=statement_timestamp()where ${where};`;
 }
 const positions=new Map(state.positions.map(p=>[p.id,p.next]));
 for(const spell of spells){
  const core=state.cores.find(c=>c.entity_id===spell.owner),position=positions.get(spell.owner);positions.set(spell.owner,position+1);
  sql+=`if exists(select 1 from public.campaign_state_fragments where campaign_id=${q(cid)} and fragment_kind='character-spell' and parent_id=${q(spell.owner)} and entity_id=${q(spell.payload.id)})then raise exception 'DOSS_SPELL_EXISTS';end if;`;
  sql+=`insert into public.campaign_state_fragments(campaign_id,fragment_kind,parent_id,entity_id,position,payload,revision,updated_at,updated_by)values(${q(cid)},'character-spell',${q(spell.owner)},${q(spell.payload.id)},${position},${j(spell.payload)},0,statement_timestamp(),${core.updated_by?q(core.updated_by)+'::uuid':'null'});`;
 }
 for(const version of state.versions){sql+=`if not exists(select 1 from public.campaign_character_versions where campaign_id=${q(cid)} and character_id=${q(version.character_id)} and revision=${version.revision})then raise exception 'DOSS_CHARACTER_CHANGED';end if;update public.campaign_character_versions set revision=revision+1,updated_at=statement_timestamp()where campaign_id=${q(cid)} and character_id=${q(version.character_id)};`;}
 sql+=`update public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp()where id=${q(cid)};end $doss$;select(select state_revision from public.campaigns where id=${q(cid)})as revision,${copies.length} as copies,${spells.length} as spells;commit;`;
 writeFileSync(root+'publish.sql',sql);writeFileSync(root+'plan.json',JSON.stringify({copies:copies.map(r=>({owner:r.parent_id,id:r.entity_id,next:r.next})),spells,baselineRevision:1753,nextRevision:1754}));
 console.log(JSON.stringify({definitions:1,copies:copies.length,spells:spells.length}));
}finally{await server.close();}
