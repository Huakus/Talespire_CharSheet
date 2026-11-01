import{readFileSync,writeFileSync}from'node:fs';import{createServer}from'vite';import{createHash}from'node:crypto';import assert from'node:assert/strict';
const root='docs/v2/equipment-used-actions-2026-11-01/',read=n=>JSON.parse(readFileSync(root+n,'utf8')),before=read('before.json'),state=read('owner-before.json'),missing=read('missing-attacks.json');assert.equal(missing.length,1);
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const{inventoryWeaponAction}=await server.ssrLoadModule('/src/domain/equipment/equipment-weapon-actions.ts'),{createCharacter}=await server.ssrLoadModule('/src/domain/character/create-character.ts'),{normalizeEquipmentDefinition}=await server.ssrLoadModule('/src/domain/equipment/equipment-catalog.ts'),{createDeterministicId}=await server.ssrLoadModule('/src/shared/id.ts');
 const row=missing[0],core=before.cores.find(c=>c.id===row.owner),c=createCharacter(core.id,core.name,'2026-11-01T00:00:00.000Z');Object.assign(c,{identity:core.identity,abilities:core.abilities,proficiencies:core.proficiencies,actions:state.actions.map(r=>r.payload)});
 c.inventory=before.weapons.filter(w=>w.owner===c.id).map(w=>({...normalizeEquipmentDefinition(w.payload),id:w.id,order:0,group:'Equipo'}));
 const item=c.inventory.find(i=>i.id===row.itemId);assert.ok(item);assert.ok(!c.actions.some(a=>a.inventoryItemId===item.id));
 const action=inventoryWeaponAction(c,item,await createDeterministicId('act',c.id,'inventory-weapon',item.id));assert.equal(action.proficient,true);
 const cid='9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd',q=s=>"'"+String(s).replaceAll("'","''")+"'",data=JSON.stringify(action),tag='attack_'+createHash('sha256').update(data).digest('hex').slice(0,16),json='$'+tag+'$'+data+'$'+tag+'$::jsonb',position=Math.max(-1,...state.actions.map(r=>r.position))+1;
 const sql=`begin;lock table public.campaigns,public.campaign_state_fragments,public.campaign_character_versions in share row exclusive mode;do $attack$ begin
 if(select state_revision from public.campaigns where id=${q(cid)})<>1755 then raise exception 'ATTACK_CAMPAIGN_CHANGED';end if;
 if exists(select 1 from public.campaign_state_fragments where campaign_id=${q(cid)} and fragment_kind='character-action' and (entity_id=${q(action.id)} or parent_id=${q(c.id)} and payload->>'inventoryItemId'=${q(item.id)}))then raise exception 'ATTACK_ALREADY_EXISTS';end if;
 if not exists(select 1 from public.campaign_character_versions where campaign_id=${q(cid)} and character_id=${q(c.id)} and revision=${state.version.revision})then raise exception 'ATTACK_OWNER_CHANGED';end if;
 insert into public.campaign_state_fragments(campaign_id,fragment_kind,parent_id,entity_id,position,payload,revision,updated_at,updated_by)values(${q(cid)},'character-action',${q(c.id)},${q(action.id)},${position},${json},0,statement_timestamp(),${q(state.updatedBy)}::uuid);
 update public.campaign_character_versions set revision=revision+1,updated_at=statement_timestamp()where campaign_id=${q(cid)} and character_id=${q(c.id)};
 update public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp()where id=${q(cid)};
 end $attack$;select(select state_revision from public.campaigns where id=${q(cid)})as revision,${q(action.id)}as action_id;commit;`;
 writeFileSync(root+'publish.sql',sql);writeFileSync(root+'plan.json',JSON.stringify({owner:c.id,itemId:item.id,action,baselineRevision:1755,nextRevision:1756}));console.log(JSON.stringify({owner:core.name,action:action.name,proficient:action.proficient,ability:action.ability}));
}finally{await server.close();}
