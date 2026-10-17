/** Prepare a guarded ECE update offline. Does not connect to or mutate a database. */
import { createServer } from "vite";
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const root = "tmp/delerion-spell-sync";
const read = (name) => JSON.parse(readFileSync(`${root}/${name}`,"utf8"));
const write = (name,value) => writeFileSync(`${root}/${name}`,typeof value === "string" ? value : JSON.stringify(value,null,2));
const snapshot = read("snapshot-before.json"), rows = read("fragments-before.json"), chars = read("characters-before.json");
const source = chars.Delerion, target = chars["Delerion 3"], campaign = snapshot.campaign.id;
// Speak with Dead remains untouched while the GM chooses a rules-compliant item.
const server = await createServer({ configFile: false,root: process.cwd(),server: { middlewareMode: true },appType: "custom" });
try {
  const { PHB_SPELLS } = await server.ssrLoadModule("/src/domain/character/phb-spells.ts");
  const { CharacterV2Schema } = await server.ssrLoadModule("/src/domain/character/character-v2.ts");
  const { CharacterSpellV2Schema } = await server.ssrLoadModule("/src/domain/character/character-spell-model.ts");
  const { createDeterministicId } = await server.ssrLoadModule("/src/shared/id.ts");
  const { applyWizardBenefits,advanceGuidedWizard,validateWizardBuild,wizardPreparationLimit } = await server.ssrLoadModule("/src/domain/character/wizard-builder.ts");
  const { completeWizardChoice } = await server.ssrLoadModule("/test/fixtures/phb-wizard-builder.ts");
  const { spellPersonalInfo } = await server.ssrLoadModule("/src/ui/spell-casting-filters.ts");
  const { spellDefinitionSignature } = await server.ssrLoadModule("/src/domain/spells/spell-source.ts");
  const custom = new Map([["Forjar Constructo","campaign:forjar-constructo"],["Transferir Eco","campaign:transferir-eco"]]);
  const identity = (s) => custom.get(s.name) ?? s.casting?.key ?? s.definition?.catalog?.contentKey?.split(":").at(-1) ?? Object.keys(PHB_SPELLS).find((key) => PHB_SPELLS[key].name === s.name);
  const known = new Set(target.spellcasting.spells.map(identity));
  const missing = source.spellcasting.spells.filter((s) => s.level > 0 && !known.has(identity(s)));
  assert.equal(missing.length,22);
  assert.equal(source.spellcasting.spells.filter((s) => s.level === 0 && !known.has(identity(s))).length,1);
  assert.equal(source.spellcasting.spells.find((s) => s.level === 0 && !known.has(identity(s)))?.name,PHB_SPELLS["fire-bolt"].name);
  let after = CharacterV2Schema.parse(target);
  const runtime = after.spellcasting.wizard, changes = [], added = [];
  assert.equal(runtime.copied.length,0);
  const copy = async (key,definition,wizardAccess) => {
    runtime.copied.push({ operationId: await createDeterministicId("wizard",target.id,"historical-external-copy",key),key,level: target.identity.level,gold: 0,hours: 0,source: "external",historical: true,definition,wizardAccess });
    if (!runtime.book.includes(key)) runtime.book.push(key);
  };
  let position = Math.max(...rows.filter((r) => r.parent_id === target.id && r.fragment_kind === "character-spell").map((r) => r.position));
  let order = Math.max(...target.spellcasting.spells.map((s) => s.order));
  for (const sourceSpell of missing) {
    const key = identity(sourceSpell), definition = sourceSpell.definition;
    assert.ok(PHB_SPELLS[key]?.classes.includes("wizard"));
    assert.ok(definition && definition.level <= 5);
    assert.equal(spellDefinitionSignature(definition),spellDefinitionSignature(PHB_SPELLS[key]));
    await copy(key,null,"standard");
    const payload = CharacterSpellV2Schema.parse({ id: await createDeterministicId("spl",target.id,"builder-spell","wizard",key),name: definition.name,level: definition.level,order: ++order,prepared: false,definition,casting: { source: "builder:wizard",kind: "wizard",key,ability: "intelligence",level: definition.level,traitId: null },effect: { active: false,description: "" } });
    after.spellcasting.spells.push(payload);
    added.push({ campaign_id: campaign,fragment_kind: "character-spell",parent_id: target.id,entity_id: payload.id,position: ++position,payload });
  }
  for (const [name,key] of custom) {
    const spell = after.spellcasting.spells.find((s) => s.name === name);
    assert.ok(spell?.definition);
    await copy(key,spell.definition,"campaign");
    spell.casting = { source: "builder:wizard",kind: "wizard",key,ability: "intelligence",level: spell.level,traitId: null };
    const before = rows.find((r) => r.parent_id === target.id && r.entity_id === spell.id && r.fragment_kind === "character-spell");
    changes.push({ before,payload: { ...before.payload,casting: spell.casting } });
  }
  const beforeRuntime = rows.find((r) => r.parent_id === target.id && r.fragment_kind === "character-runtime");
  changes.push({ before: beforeRuntime,payload: { ...beforeRuntime.payload,spellcasting: { ...beforeRuntime.payload.spellcasting,wizard: { ...beforeRuntime.payload.spellcasting.wizard,book: runtime.book,copied: runtime.copied } } } });
  validateWizardBuild(after.builder,runtime.copied);
  after = CharacterV2Schema.parse(after);
  assert.equal(after.spellcasting.spells.length,55);
  assert.equal(runtime.book.length,48);
  assert.equal(runtime.copied.length,24);
  const preparedIds = (c) => c.spellcasting.spells.filter((s) => s.prepared).map((s) => s.id).sort();
  assert.deepEqual(preparedIds(after),preparedIds(target));
  assert.deepEqual(after.currency,target.currency);
  assert.deepEqual(after.spellcasting.slots,target.spellcasting.slots);
  assert.equal(wizardPreparationLimit(after),13);
  assert.deepEqual(after.spellcasting.spells.filter((s) => s.level === 0),target.spellcasting.spells.filter((s) => s.level === 0));
  assert.deepEqual(after.spellcasting.spells.filter((s) => !s.casting).map((s) => s.name),[PHB_SPELLS["speak-with-dead"].name]);
  for (const entry of runtime.copied) {
    const spell = after.spellcasting.spells.find((s) => s.casting?.key === entry.key);
    assert.equal(spellPersonalInfo(after,spell).learning,"external-book");
  }
  const rebuilt = await applyWizardBenefits(after,after);
  assert.deepEqual(new Set(rebuilt.spellcasting.spells.map((s) => s.id)),new Set(after.spellcasting.spells.map((s) => s.id)));
  const next = await advanceGuidedWizard(after,completeWizardChoice(after,"necromancy"),"2026-10-17T03:00:00.000Z");
  for (const entry of runtime.copied) assert.ok(next.spellcasting.spells.some((s) => s.casting?.key === entry.key));
  const plan = { campaignId: campaign,targetId: target.id,sourceId: source.id,added,changes,excludedCantrip: "fire-bolt",pending: "speak-with-dead: awaiting rules-compliant item choice; no Tasha class option",counts: { newSpells: 22,existingCustomIntegrated: 2,externalCopies: 24,book: 48,totalSpells: 55,prepared: 4,preparationLimit: 13 } };
  write("plan.json",plan);
  write("character-projected.json",after);
  writeFileSync(`${root}/backup-before.json.gz`,gzipSync(JSON.stringify({ snapshot,rows,source,target })));
  const q = (s) => `'${String(s).replaceAll("'","''")}'`;
  const j = (v) => { const json = JSON.stringify(v), marker = createHash("sha256").update(json).digest("hex").slice(0,20); return `$d${marker}$${json}$d${marker}$::jsonb`; };
  const hash = (table,where,order) => `(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by ${order}),'')) from public.${table} t where ${where})`;
  const targetWhere = `campaign_id=${q(campaign)} and parent_id=${q(target.id)}`;
  const targetHash = hash("campaign_state_fragments",targetWhere,"fragment_kind,position,entity_id");
  const othersHash = hash("campaign_state_fragments",`not (campaign_id=${q(campaign)} and parent_id=${q(target.id)})`,"campaign_id,fragment_kind,parent_id,entity_id");
  const catalogHash = hash("campaign_content_entries",`campaign_id=${q(campaign)} and kind='spell'`,"content_key");
  const changeRows = changes.map(({before,payload}) => ({ fragment_kind: before.fragment_kind,entity_id: before.entity_id,before: before.payload,payload }));
  const v = snapshot.versions.find((v) => v.character_id === target.id);
  let sql = `begin;
lock table public.campaigns,public.campaign_character_versions,public.campaign_state_fragments in share row exclusive mode;
lock table public.campaign_content_entries in share mode;
create temporary table _spell_sync_changes on commit drop as select * from jsonb_to_recordset(${j(changeRows)}) as x(fragment_kind text,entity_id text,before jsonb,payload jsonb);
create temporary table _spell_sync_add on commit drop as select * from jsonb_to_recordset(${j(added)}) as x(campaign_id uuid,fragment_kind text,parent_id text,entity_id text,position integer,payload jsonb);
create temporary table _spell_sync_before on commit drop as select * from public.campaign_state_fragments where ${targetWhere};
do $sync$ declare affected integer; begin
if ${targetHash}<>${q(snapshot.target_hash)} or ${othersHash}<>${q(snapshot.other_fragments_hash)} or ${catalogHash}<>${q(snapshot.catalog_hash)} then raise exception 'SPELL_SYNC_CONFLICT: refresh snapshot'; end if;
if (select state_revision from public.campaigns where id=${q(campaign)})<>${snapshot.campaign.state_revision} or (select revision from public.campaign_character_versions where campaign_id=${q(campaign)} and character_id=${q(target.id)})<>${v.revision} then raise exception 'SPELL_SYNC_REVISION_CONFLICT'; end if;
update public.campaign_state_fragments f set payload=c.payload,revision=f.revision+1,updated_at=statement_timestamp() from _spell_sync_changes c where f.${targetWhere.replaceAll(" and "," and f.")} and f.fragment_kind=c.fragment_kind and f.entity_id=c.entity_id and f.payload=c.before;
get diagnostics affected=row_count; if affected<>${changes.length} then raise exception 'SPELL_SYNC_UPDATE_COUNT:%',affected; end if;
insert into public.campaign_state_fragments(campaign_id,fragment_kind,parent_id,entity_id,position,payload,revision,updated_at) select campaign_id,fragment_kind,parent_id,entity_id,position,payload,1,statement_timestamp() from _spell_sync_add;
get diagnostics affected=row_count; if affected<>22 then raise exception 'SPELL_SYNC_INSERT_COUNT'; end if;
if exists(select 1 from public.campaign_state_fragments f join _spell_sync_before b using(campaign_id,fragment_kind,parent_id,entity_id) where f.${targetWhere.replaceAll(" and "," and f.")} and not exists(select 1 from _spell_sync_changes c where c.fragment_kind=f.fragment_kind and c.entity_id=f.entity_id) and to_jsonb(f)<>to_jsonb(b)) then raise exception 'SPELL_SYNC_UNRELATED_TARGET_CHANGE'; end if;
update public.campaign_character_versions set revision=revision+1,updated_at=statement_timestamp() where campaign_id=${q(campaign)} and character_id=${q(target.id)};
update public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp() where id=${q(campaign)};
if ${othersHash}<>${q(snapshot.other_fragments_hash)} or ${catalogHash}<>${q(snapshot.catalog_hash)} then raise exception 'SPELL_SYNC_UNRELATED_CHANGE'; end if;
end $sync$;
commit;
select count(*) as spells from public.campaign_state_fragments where ${targetWhere} and fragment_kind='character-spell';
`;
  write("apply.sql",sql);
  write("dry-run.sql",sql.replace("commit;","rollback;"));
  write("rollback.sql",`begin;
lock table public.campaigns,public.campaign_character_versions,public.campaign_state_fragments in share row exclusive mode;
create temporary table _undo_sync_changes on commit drop as select * from jsonb_to_recordset(${j(changeRows)}) as x(fragment_kind text,entity_id text,before jsonb,payload jsonb);
create temporary table _undo_sync_add on commit drop as select * from jsonb_to_recordset(${j(added)}) as x(entity_id text,payload jsonb);
do $undo$ declare affected integer; begin
if (select count(*) from public.campaign_state_fragments f join _undo_sync_changes c using(fragment_kind,entity_id) where f.${targetWhere.replaceAll(" and "," and f.")} and f.payload=c.payload)<>${changes.length} or (select count(*) from public.campaign_state_fragments f join _undo_sync_add a using(entity_id) where f.${targetWhere.replaceAll(" and "," and f.")} and f.fragment_kind='character-spell' and f.payload=a.payload)<>22 then raise exception 'SPELL_SYNC_ROLLBACK_CONFLICT'; end if;
update public.campaign_state_fragments f set payload=c.before,revision=f.revision+1,updated_at=statement_timestamp() from _undo_sync_changes c where f.${targetWhere.replaceAll(" and "," and f.")} and f.fragment_kind=c.fragment_kind and f.entity_id=c.entity_id;
delete from public.campaign_state_fragments f using _undo_sync_add a where f.${targetWhere.replaceAll(" and "," and f.")} and f.fragment_kind='character-spell' and f.entity_id=a.entity_id;
update public.campaign_character_versions set revision=revision+1,updated_at=statement_timestamp() where campaign_id=${q(campaign)} and character_id=${q(target.id)};
update public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp() where id=${q(campaign)};
end $undo$;
commit;
`);
  write("checksums.json",Object.fromEntries(["backup-before.json.gz","plan.json","apply.sql","rollback.sql"].map((name) => [name,createHash("sha256").update(readFileSync(`${root}/${name}`)).digest("hex")])));
  console.log(JSON.stringify({ ...plan.counts,pending: plan.pending,validation: "schema, source coverage, cantrips, preparations, currency, slots, origin filters, rebuild and level-up" }));
} finally { await server.close(); }
