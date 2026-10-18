/** Guarded insertion plan for a small ECE preparation pilot. Never executes SQL. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createServer } from "vite";
import assert from "node:assert/strict";
const root = "tmp/equipment-definitions", read = (file) => JSON.parse(readFileSync(`${root}/${file}`, "utf8"));
const all = read("real-drafts.json"), guards = read("pilot-guards-before.json"), campaignId = "9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd";
const names = ["Daga del Umbral · variante de Stix", "Daga del Umbral", "Collar de hablar con los muertos", "Anillo de Almacenamiento de Hechizos", "Guanteletes De Fuerza De Ogro", "Perla De Poder", "Bastón del marchitamiento", "Varita de Armadura de Mago", "Núcleo Luciente", "Poción de curación", "Munición +1", "Reloj de arena"];
const selected = names.map((name) => { const found = all.filter((entry) => entry.payload.definition.name === name); assert.equal(found.length, 1, name); return found[0]; });
assert.equal(guards.preparations.length, 0, "Review existing preparation rows before inserting a pilot");
const rows = selected.map((entry) => ({ content_key: `gm:equipment:preparation:${entry.payload.definition.id}`, name: entry.payload.definition.name, payload: entry.payload }));
writeFileSync(`${root}/pilot-rows.json`, JSON.stringify(rows));
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { SupabaseCampaignContentStore } = await server.ssrLoadModule("/src/infrastructure/remote/supabase-campaign-content-store.ts");
  const originals = [0, 500, 1000, 1500].flatMap((offset) => JSON.parse(readFileSync(`tmp/item-tags/ece-after-${offset}.json`, "utf8")));
  const entry = (row) => ({ campaignId, kind: "equipment", contentKey: row.content_key, name: row.name, origin: row.origin ?? "gm", tags: row.tags ?? ["es", "en_preparacion"], payload: row.payload, revision: row.revision ?? 0, updatedAt: row.updated_at ?? new Date().toISOString() });
  const before = await new SupabaseCampaignContentStore({ listCampaignContent: async () => originals.map(entry) }, campaignId).load();
  const store = new SupabaseCampaignContentStore({ listCampaignContent: async () => [...originals, ...rows].map(entry) }, campaignId);
  const after = { ...await store.load(), ...await store.loadEquipmentPreparations() };
  assert.deepEqual(after.equipment, before.equipment);
  assert.equal(after.equipmentPreparations.length, 12); assert.deepEqual(after.equipmentPreparationIssues, []);
  for (const row of rows) assert.deepEqual(after.equipmentPreparations.find((record) => record.catalog.contentKey === row.content_key).payload, row.payload);
} finally { await server.close(); }

const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => { const text = JSON.stringify(value); let marker = "pilot_" + createHash("sha256").update(text).digest("hex").slice(0, 24); while (text.includes(`$${marker}$`)) marker += "x"; return `$${marker}$${text}$${marker}$::jsonb`; };
const keys = rows.map((row) => q(row.content_key)).join(",");
const target = `campaign_id=${q(campaignId)} and kind='equipment' and content_key in (${keys})`;
const hash = (table, where, order) => `(select md5(string_agg(md5(to_jsonb(t)::text),'' order by ${order})) from public.${table} t where ${where})`;
const hashes = {
  campaign_catalog_hash: hash("campaign_content_entries", `not (${target})`, "campaign_id,kind,content_key"),
  shared_hash: hash("official_content_entries", "true", "kind,content_key"),
  fragments_hash: hash("campaign_state_fragments", "true", "campaign_id,fragment_kind,parent_id,entity_id"),
  versions_hash: hash("campaign_character_versions", "true", "campaign_id,character_id"),
};
const guard = (expression, expected, label) => `if ${expression} is distinct from ${q(expected)} then raise exception ${q(`EQUIPMENT_PILOT_CONFLICT:${label}`)}; end if;`;
const locks = `begin;\nlock table public.campaigns,public.campaign_content_entries in share row exclusive mode;\nlock table public.official_content_entries,public.campaign_state_fragments,public.campaign_character_versions in share mode;\n`;
const notify = `update public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp() where id=${q(campaignId)};`;
const sql = `${locks}
create temporary table _equipment_pilot on commit drop as select * from jsonb_to_recordset(${json(rows)}) as x(content_key text,name text,payload jsonb);
do $pilot$ declare affected integer; begin
if exists(select 1 from public.campaign_content_entries where ${target}) then raise exception 'EQUIPMENT_PILOT_ALREADY_EXISTS'; end if;
${Object.entries(hashes).map(([key, expression]) => guard(expression, guards[key], key)).join("\n")}
insert into public.campaign_content_entries(campaign_id,kind,content_key,name,origin,tags,payload,revision)
select ${q(campaignId)},'equipment',content_key,name,'gm',array['es','en_preparacion'],payload,0 from _equipment_pilot;
get diagnostics affected=row_count; if affected<>${rows.length} then raise exception 'EQUIPMENT_PILOT_COUNT'; end if;
if (select count(*) from public.campaign_content_entries t join _equipment_pilot p using(content_key) where t.campaign_id=${q(campaignId)} and t.kind='equipment' and t.payload=p.payload and t.tags=array['es','en_preparacion'])<>${rows.length} then raise exception 'EQUIPMENT_PILOT_DATA'; end if;
${Object.entries(hashes).map(([key, expression]) => guard(expression, guards[key], key)).join("\n")}
${notify}
end $pilot$;
select count(*) as preparation_rows from public.campaign_content_entries where ${target};
commit;
`;
writeFileSync(`${root}/pilot-apply.sql`, sql); writeFileSync(`${root}/pilot-dry-run.sql`, sql.replace("commit;", "rollback;"));
const rollback = `${locks}
create temporary table _equipment_pilot on commit drop as select * from jsonb_to_recordset(${json(rows)}) as x(content_key text,name text,payload jsonb);
do $undo_pilot$ begin
if (select count(*) from public.campaign_content_entries t join _equipment_pilot p using(content_key) where t.campaign_id=${q(campaignId)} and t.kind='equipment' and t.payload=p.payload and t.revision=0)<>${rows.length} then raise exception 'EQUIPMENT_PILOT_ROLLBACK_CHANGED'; end if;
if exists(select 1 from public.campaign_state_fragments where fragment_kind='character-inventory' and payload->'catalog'->>'contentKey' in (${keys})) then raise exception 'EQUIPMENT_PILOT_ROLLBACK_USED'; end if;
if exists(select 1 from public.campaign_content_entries where kind='monster' and payload::text like '%gm:equipment:preparation:recovery:%') then raise exception 'EQUIPMENT_PILOT_ROLLBACK_NPC_REFERENCE_REVIEW'; end if;
delete from public.campaign_content_entries where ${target};
${notify}
end $undo_pilot$;
commit;
`;
writeFileSync(`${root}/pilot-rollback.sql`, rollback);
writeFileSync(`${root}/pilot-checksums.json`, JSON.stringify(Object.fromEntries(["pilot-rows.json", "pilot-guards-before.json", "pilot-apply.sql", "pilot-rollback.sql"].map((file) => [file, createHash("sha256").update(readFileSync(`${root}/${file}`)).digest("hex")])), null, 2));
console.log(JSON.stringify({ pilotRows: rows.length, sqlCharacters: sql.length, activeEntriesUnchanged: true, activeSpanishEntries: 806, executed: false }));
