/** Generates additive, guarded preparation batches. Never updates old definitions or possessions. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { createServer } from "vite";
const root = "tmp/equipment-definitions", read = (name) => JSON.parse(readFileSync(`${root}/${name}`, "utf8"));
const drafts = read("real-drafts-reviewed.json"), before = read("catalog-publish-before.json");
const campaignId = "9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd";
const rows = drafts.map((record) => ({ content_key: `gm:equipment:preparation:${record.payload.definition.id}`, name: record.payload.definition.name, payload: record.payload }));
assert.equal(rows.length, 806); assert.equal(new Set(rows.map((row) => row.content_key)).size, rows.length);
assert.equal(before.preparation_keys.length, 21);
assert.ok(before.preparation_keys.every((key) => rows.some((row) => row.content_key === key)));
const pending = rows.filter((row) => !before.preparation_keys.includes(row.content_key));
assert.equal(pending.length, 785);
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { EquipmentPreparationPayloadSchema } = await server.ssrLoadModule("/src/domain/equipment/equipment-preparation.ts");
  const { verifyEquipmentSource } = await server.ssrLoadModule("/src/domain/equipment/equipment-recovery.ts");
  const { SupabaseCampaignContentStore } = await server.ssrLoadModule("/src/infrastructure/remote/supabase-campaign-content-store.ts");
  const originals = [0, 500, 1000, 1500].flatMap((offset) => JSON.parse(readFileSync(`tmp/item-tags/ece-after-${offset}.json`, "utf8")));
  const archived = new Map();
  for (const row of pending) {
    assert.deepEqual(EquipmentPreparationPayloadSchema.parse(row.payload), row.payload);
    for (const original of row.payload.originals) archived.set(original.id, original);
  }
  for (const original of archived.values()) assert.ok(await verifyEquipmentSource(original));
  const entry = (row) => ({ campaignId, kind: row.kind ?? "equipment", contentKey: row.content_key, name: row.name, origin: row.origin ?? "gm", tags: row.tags ?? ["es", "en_preparacion"], payload: row.payload, revision: row.revision ?? 0, updatedAt: row.updated_at ?? "2026-10-17T00:00:00Z" });
  const active = originals.map(entry), preparation = rows.map(entry), scopes = [];
  const store = new SupabaseCampaignContentStore({ listCampaignContent: async (_id, scope) => { scopes.push(scope); return scope === "preparation" ? preparation : active; } }, campaignId);
  const normal = await store.load(); assert.equal(normal.equipment.length, 806); assert.equal(normal.equipmentPreparations, undefined); assert.deepEqual(scopes, ["active"]);
  assert.equal((await store.loadEquipmentPreparations()).equipmentPreparations.length, 806);
  assert.deepEqual(scopes, ["active", "preparation"]);
} finally { await server.close(); }

const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => { const text = JSON.stringify(value); let tag = "prep_" + createHash("sha256").update(text).digest("hex").slice(0, 20); while (text.includes(`$${tag}$`)) tag += "x"; return `$${tag}$${text}$${tag}$::jsonb`; };
const scope = `campaign_id=${q(campaignId)} and kind='equipment' and ((payload->>'format') is not distinct from 'equipment-preparation')`;
const hash = (table, where, order) => `(select md5(string_agg(md5(to_jsonb(t)::text),'' order by ${order})) from public.${table} t where ${where})`;
const hashes = {
  campaign_catalog_hash: hash("campaign_content_entries", `not (${scope})`, "campaign_id,kind,content_key"),
  shared_hash: hash("official_content_entries", "true", "kind,content_key"),
  fragments_hash: hash("campaign_state_fragments", "true", "campaign_id,fragment_kind,parent_id,entity_id"),
  versions_hash: hash("campaign_character_versions", "true", "campaign_id,character_id"),
};
const guards = Object.entries(hashes).map(([key, sql]) => `if ${sql} is distinct from ${q(before[key])} then raise exception ${q(`EQUIPMENT_CATALOG_CONFLICT:${key}`)}; end if;`).join("\n");
mkdirSync(`${root}/catalog-batches`, { recursive: true });
const files = [];
for (let offset = 0; offset < pending.length; offset += 100) {
  const batch = pending.slice(offset, offset + 100), number = files.length;
  const sql = `begin;
lock table public.campaigns,public.campaign_content_entries in share row exclusive mode;
lock table public.official_content_entries,public.campaign_state_fragments,public.campaign_character_versions in share mode;
create temporary table _equipment_catalog on commit drop as select * from jsonb_to_recordset(${json(batch)}) as x(content_key text,name text,payload jsonb);
do $catalog$ declare affected integer; begin
${guards}
if (select state_revision from public.campaigns where id=${q(campaignId)}) is distinct from __CAMPAIGN_REVISION__ then raise exception 'EQUIPMENT_CATALOG_CAMPAIGN_CHANGED'; end if;
if ${hash("campaign_content_entries", scope, "content_key")} is distinct from '__PREPARATION_HASH__' then raise exception 'EQUIPMENT_CATALOG_PREPARATION_CHANGED'; end if;
if exists(select 1 from public.campaign_content_entries t join _equipment_catalog p using(content_key) where t.campaign_id=${q(campaignId)} and t.kind='equipment') then raise exception 'EQUIPMENT_CATALOG_TARGET_EXISTS'; end if;
insert into public.campaign_content_entries(campaign_id,kind,content_key,name,origin,tags,payload,revision)
select ${q(campaignId)},'equipment',content_key,name,'gm',array['es','en_preparacion'],payload,0 from _equipment_catalog;
get diagnostics affected=row_count; if affected<>${batch.length} then raise exception 'EQUIPMENT_CATALOG_COUNT'; end if;
if (select count(*) from public.campaign_content_entries t join _equipment_catalog p using(content_key) where t.campaign_id=${q(campaignId)} and t.kind='equipment' and t.payload=p.payload and t.revision=0)<>${batch.length} then raise exception 'EQUIPMENT_CATALOG_DATA'; end if;
${guards}
update public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp() where id=${q(campaignId)};
end $catalog$;
select (select count(*) from public.campaign_content_entries where ${scope}) as preparation_rows,
 ${hash("campaign_content_entries", scope, "content_key")} as preparation_hash,
 (select state_revision from public.campaigns where id=${q(campaignId)}) as campaign_revision;
commit;
`;
  const file = `${root}/catalog-batches/batch-${number}.sql`; writeFileSync(file, sql);
  files.push({ file, entries: batch.length, sha256: createHash("sha256").update(sql).digest("hex"), characters: sql.length });
}
const manifest = { mode: "review-preparation-only", beforePreparationRows: 21, preservedExistingRows: 21, insertions: pending.length, finalPreparationRows: 806,
  batches: files, migratedCopies: 0, deletedVersions: 0, definitiveObjects: 0, executed: false };
writeFileSync(`${root}/catalog-publish-manifest.json`, JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ ...manifest, batches: files.map(({ file, entries, characters }) => ({ file, entries, characters })) }));
