import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { randomBytes } from "node:crypto";

// Offline preparation only: this script never connects to the database.
const dir = new URL("../docs/v2/character-repairs/varka-agonizing-blast/", import.meta.url);
const row = JSON.parse(await readFile(new URL("before.json", dir), "utf8"));
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom" });
try {
  const { CharacterV2Schema } = await server.ssrLoadModule("/src/domain/character/character-v2.ts");
  const { validateWarlockBuild, replayWarlockChoices, applyWarlockBenefits, advanceGuidedWarlock } = await server.ssrLoadModule("/src/domain/character/warlock-builder.ts");
  const { projectSpellDamageExpression, projectActionAttackModifier, projectActionDamageBonus } = await server.ssrLoadModule("/src/domain/character/character-projection.ts");
  const { completeWarlockChoice } = await server.ssrLoadModule("/test/fixtures/phb-warlock-builder.ts");
  const fragments = row.fragments;
  const raw = kind => fragments.find(f => f.fragment_kind === kind);
  const entries = kind => fragments.filter(f => f.fragment_kind === kind).sort((a,b) => a.position-b.position).map(f => f.payload);
  const runtime = raw("character-runtime").payload;
  const before = CharacterV2Schema.parse({ ...raw("character-core").payload, ...runtime,
    spellcasting: { ...runtime.spellcasting, spells: entries("character-spell") },
    actions: entries("character-action"), inventory: entries("character-inventory"), traits: entries("character-trait"), notes: entries("character-note"), extras: entries("character-extra"),
    revision: row.character_revision, metadata: { createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() } });
  assert.equal(before.name,"Varka"); assert.equal(before.archived,false); assert.equal(before.identity.level,10);
  const oldReplay = replayWarlockChoices(validateWarlockBuild(before.builder));
  assert(oldReplay.invocations.includes("improved-pact-weapon")); assert(!oldReplay.invocations.includes("agonizing-blast"));
  const draft = structuredClone(before), level = draft.builder.levels.find(s => s.level === 10);
  assert.equal(level.warlock.replaceInvocation,null);
  level.warlock.replaceInvocation = { oldKey: "improved-pact-weapon", newKey: "agonizing-blast" };
  draft.builder = validateWarlockBuild(draft.builder);
  const after = await applyWarlockBenefits(draft);
  delete after.spellcasting.warlock.resourceIds["invocation-improved-pact-weapon"];
  // Neither invocation grants a spell. Keep the player's spell presentation and
  // preparation state exactly as saved rather than reconciling unrelated flags.
  after.spellcasting.spells = structuredClone(before.spellcasting.spells);
  const replay = replayWarlockChoices(after.builder);
  assert.equal(replay.invocations.length,5); assert(replay.invocations.includes("agonizing-blast")); assert(!replay.invocations.includes("improved-pact-weapon"));
  for (const key of Object.keys(before).filter(k => !["builder","actions","traits","spellcasting"].includes(k))) assert.deepEqual(after[key],before[key],`Unrelated change: ${key}`);
  const omitWarlock = ({warlock,...rest}) => rest;
  assert.deepEqual(omitWarlock(after.spellcasting),omitWarlock(before.spellcasting));
  for (const group of before.traits) {
    const nextGroup = after.traits.find(g=>g.id===group.id); assert(nextGroup);
    for (const trait of group.traits) {
      if (trait.id===before.spellcasting.warlock.resourceIds["invocation-improved-pact-weapon"]) continue;
      assert.deepEqual(nextGroup.traits.find(t=>t.id===trait.id),trait,`Unrelated trait changed: ${trait.name}`);
    }
  }
  const pactId = before.spellcasting.warlock.pactWeaponId;
  const pactBefore = before.actions.find(a => a.inventoryItemId === pactId), pactAfter = after.actions.find(a => a.id === pactBefore?.id);
  assert(pactBefore && pactAfter);
  assert.equal(pactAfter.attackBonus,pactBefore.attackBonus-1); assert.equal(pactAfter.damageBonus,pactBefore.damageBonus-1);
  assert.equal(after.spellcasting.warlock.pactWeaponAppliedBonus,0);
  assert.equal(after.actions.length,before.actions.length);
  const changes = [];
  const add = (f,payload) => { if (JSON.stringify(f.payload)!==JSON.stringify(payload)) changes.push({ kind:f.fragment_kind,parentId:f.parent_id,entityId:f.entity_id,position:f.position,expectedRevision:f.revision,before:f.payload,after:payload }); };
  add(raw("character-core"),{...raw("character-core").payload,builder:after.builder});
  add(raw("character-runtime"),{...runtime,spellcasting:{...runtime.spellcasting,warlock:after.spellcasting.warlock}});
  for (const a of after.actions) {
    const old = before.actions.find(v => v.id === a.id);
    if (JSON.stringify(old)===JSON.stringify(a)) continue;
    assert.equal(a.id,pactBefore.id);
    assert.deepEqual({...a,attackBonus:old.attackBonus,damageBonus:old.damageBonus},old);
    const f = fragments.find(f => f.fragment_kind === "character-action" && f.entity_id===a.id);
    add(f,{...f.payload,attackBonus:a.attackBonus,damageBonus:a.damageBonus});
  }
  for (const group of after.traits) {
    const f = fragments.find(f => f.fragment_kind === "character-trait" && f.entity_id===group.id);
    assert(f,"Unexpected trait group creation");
    if (JSON.stringify(before.traits.find(g=>g.id===group.id))!==JSON.stringify(group)) add(f,group);
  }
  assert.equal(changes.length,4,"Expected only core, runtime, pact action and warlock traits");
  const blast = before.spellcasting.spells.find(s=>s.casting?.key==="eldritch-blast"); assert(blast);
  assert.equal(projectSpellDamageExpression(after,blast),"1d10+5");
  const nextChoice = completeWarlockChoice(after,"blade");
  const next = await advanceGuidedWarlock(after,nextChoice,new Date().toISOString());
  assert(replayWarlockChoices(next.builder).invocations.includes("agonizing-blast"));
  const plan = { campaignId:row.campaign_id,characterId:row.character_id,expectedCampaignRevision:row.state_revision,expectedCharacterRevision:row.character_revision,
    replacementLevel:10,replacement:level.warlock.replaceInvocation,changes,
    validation:{inventoryUnchanged:true,combatUnchanged:true,currencyUnchanged:true,spellSlotsUnchanged:true,spellListUnchanged:true,level11Validated:true,
      blastDamageBefore:projectSpellDamageExpression(before,blast),blastDamageAfter:projectSpellDamageExpression(after,blast),
      pactAttackBefore:projectActionAttackModifier(before,pactBefore),pactAttackAfter:projectActionAttackModifier(after,pactAfter),
      pactDamageBonusBefore:projectActionDamageBonus(before,pactBefore),pactDamageBonusAfter:projectActionDamageBonus(after,pactAfter)} };
  await writeFile(new URL("prepared.json",dir),JSON.stringify(plan,null,2)+"\n");
  const bodyTag = `$body_${randomBytes(12).toString("hex")}$`, dataTag = `$data_${randomBytes(12).toString("hex")}$`;
  const data = JSON.stringify(plan);
  assert(!data.includes(bodyTag) && !data.includes(dataTag));
  const sql = `-- User-authorized repair: replace Improved Pact Weapon at level 10.
-- Compare the complete old payloads and revisions before changing any row.
begin;
do ${bodyTag}
declare
  plan jsonb := ${dataTag}${data}${dataTag}::jsonb;
  campaign uuid := (plan->>'campaignId')::uuid;
  hero text := plan->>'characterId';
  current_revision bigint; change jsonb; old_payload jsonb; touched int;
  repair_time timestamptz := statement_timestamp();
begin
  select state_revision into current_revision from public.campaigns where id=campaign for update;
  if current_revision is distinct from (plan->>'expectedCampaignRevision')::bigint then raise exception 'REPAIR_CAMPAIGN_REVISION_CONFLICT'; end if;
  select revision into current_revision from public.campaign_character_versions where campaign_id=campaign and character_id=hero for update;
  if current_revision is distinct from (plan->>'expectedCharacterRevision')::bigint then raise exception 'REPAIR_CHARACTER_REVISION_CONFLICT'; end if;
  for change in select value from jsonb_array_elements(plan->'changes') loop
    select revision,payload into current_revision,old_payload from public.campaign_state_fragments
      where campaign_id=campaign and fragment_kind=change->>'kind' and parent_id=change->>'parentId' and entity_id=change->>'entityId' for update;
    if current_revision is distinct from (change->>'expectedRevision')::bigint or old_payload is distinct from change->'before' then
      raise exception 'REPAIR_FRAGMENT_CONFLICT: %',change->>'kind';
    end if;
  end loop;
  for change in select value from jsonb_array_elements(plan->'changes') loop
    update public.campaign_state_fragments set payload=change->'after',revision=revision+1,updated_at=repair_time,updated_by=null
      where campaign_id=campaign and fragment_kind=change->>'kind' and parent_id=change->>'parentId' and entity_id=change->>'entityId';
    get diagnostics touched=row_count;
    if touched<>1 then raise exception 'REPAIR_WRITE_CONFLICT'; end if;
  end loop;
  update public.campaign_character_versions set revision=revision+1,updated_at=repair_time,updated_by=null where campaign_id=campaign and character_id=hero;
  update public.campaigns set state_revision=state_revision+1,state_updated_at=repair_time,state_updated_by=null,updated_at=repair_time where id=campaign;
end;
${bodyTag};
commit;
select state_revision as campaign_revision from public.campaigns where id='${row.campaign_id}'::uuid;
`;
  await writeFile(new URL("apply.sql",dir),sql);
  console.log(JSON.stringify({changedFragments:changes.map(c=>c.kind),validation:plan.validation},null,2));
} finally { await server.close(); }
