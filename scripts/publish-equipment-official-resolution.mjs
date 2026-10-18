/** Generate one guarded transaction. Does not connect to or mutate the database. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { createServer } from "vite";
const root = "tmp/equipment-definitions", read = (name) => JSON.parse(readFileSync(`${root}/${name}`, "utf8"));
const prefix = process.argv[2] ?? "official-resolution";
assert.match(prefix,/^[a-z-]+$/);
const plan = read(`${prefix}-plan.json`), snapshot = read(`${prefix}-before.json`);
const cid = "9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd", q = (s) => `'${String(s).replaceAll("'", "''")}'`;
const json = (v) => { const text = JSON.stringify(v), tag = `official_${createHash("sha256").update(text).digest("hex").slice(0, 16)}`; return `$${tag}$${text}$${tag}$::jsonb`; };
const hash = (table, where, order) => `(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by ${order}),'')) from public.${table} t where ${where})`;
const keys = [...plan.definitions.map((d) => d.key), ...plan.retired.map((r) => r.content_key)], keySql = keys.map(q).join(",");
const affectedKeys = [...plan.retired.map((r) => r.content_key), ...plan.definitions.filter((d) => d.before).map((d) => d.key)].map(q).join(",");
const hashes = {
  content: hash("campaign_content_entries", `not(campaign_id=${q(cid)} and kind='equipment' and content_key in(${keySql}))`, "campaign_id,kind,content_key"),
  shared: hash("official_content_entries", "true", "kind,content_key"),
  fragments: hash("campaign_state_fragments", "true", "campaign_id,fragment_kind,parent_id,entity_id"),
  versions: hash("campaign_character_versions", "true", "campaign_id,character_id"),
  campaigns: hash("campaigns", `id<>${q(cid)}`, "id"),
};
writeFileSync(`${root}/${prefix}-guard.sql`, `select jsonb_build_object('revision',(select state_revision from public.campaigns where id=${q(cid)}),${Object.entries(hashes).map(([key, value]) => `${q(key)},${value}`).join(",")}) as guard;`);
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
const publication = [];
try {
  const { bindReviewedEquipment } = await server.ssrLoadModule("/src/domain/equipment/equipment-live.ts");
  const { normalizeEquipmentDefinition } = await server.ssrLoadModule("/src/domain/equipment/equipment-catalog.ts");
  const { serializeEquipmentContentPayload } = await server.ssrLoadModule("/src/domain/content/content-payload.ts");
  const generic = (snapshot.pending ?? snapshot.entries).find((r) => r.payload.index === "belt-of-giant-strength");
  for (const selected of plan.definitions) {
    const original = selected.before?.payload.rules?.original ?? selected.before?.payload ?? generic.payload;
    const template = normalizeEquipmentDefinition(original);
    // These unowned canonical entries must not inherit the old unscoped spell modifier.
    const resource = selected.definition.resources.find((r) => r.kind !== "spell-storage");
    const clean = { ...template, id: "inv_00000000000000000000000000000000", order: 0, group: "Mochila", catalog: null, bonuses: [], features: [], equipped: false, attuned: false, charges: resource?.maximum ? { current: resource.maximum, maximum: resource.maximum, reset: resource.recovery.kind === "event" ? resource.recovery.event : "manual" } : null };
    if (!selected.before) { clean.cost = { quantity: 0, unit: "gp" }; clean.unitWeight = 0; }
    const item = bindReviewedEquipment(clean, selected.definition);
    item.rules.original = structuredClone(original);
    if (selected.mergedOriginal) item.rules.original.mergedCatalogOriginal = structuredClone(selected.mergedOriginal);
    item.rules.personalDescription = "";
    item.quantity = 1;
    const { id: _id, order: _order, group: _group, ...draft } = item;
    const payload = serializeEquipmentContentPayload({ ...draft, rarity: selected.definition.rarity });
    assert.equal(normalizeEquipmentDefinition(payload).rules.definition.id, selected.definition.id);
    publication.push({ ...selected, payload, revision: selected.before ? selected.before.revision + 1 : 1 });
  }
} finally { await server.close(); }
writeFileSync(`${root}/${prefix}-publication.json`, JSON.stringify(publication));
let guard;
try { guard = read(`${prefix}-guards.json`); } catch { console.log("Publication payloads and guard SELECT prepared."); process.exit(0); }
assert.equal(guard.revision, plan.revision);
const assertGuards = Object.entries(hashes).map(([key, value]) => `if ${value} is distinct from ${q(guard[key])} then raise exception ${q(`OFFICIAL_SCOPE_CHANGED:${key}`)}; end if;`).join("\n");
const references = `exists(select 1 from public.campaign_state_fragments where campaign_id=${q(cid)} and fragment_kind='character-inventory' and payload#>>'{catalog,contentKey}' in(${affectedKeys})) or exists(select 1 from public.campaign_content_entries t cross join lateral jsonb_array_elements(case when jsonb_typeof(t.payload->'inventory')='array' then t.payload->'inventory' else '[]'::jsonb end)i where t.campaign_id=${q(cid)} and t.kind='monster' and t.deleted_at is null and i#>>'{catalog,contentKey}' in(${affectedKeys}))`;
let mutation = "";
for (const row of plan.retired) mutation += `
if not exists(select 1 from public.campaign_content_entries t where campaign_id=${q(cid)} and kind='equipment' and content_key=${q(row.content_key)} and to_jsonb(t)=${json(row)}) then raise exception 'OFFICIAL_RETIRE_CONFLICT'; end if;
update public.campaign_content_entries set deleted_at=statement_timestamp(),tags=array(select distinct value from unnest(tags||array['retirado_por_version_oficial'])value),revision=revision+1,updated_at=statement_timestamp() where campaign_id=${q(cid)} and kind='equipment' and content_key=${q(row.content_key)};
`;
for (const selected of publication) {
  if (selected.before) mutation += `
if not exists(select 1 from public.campaign_content_entries t where campaign_id=${q(cid)} and kind='equipment' and content_key=${q(selected.key)} and to_jsonb(t)=${json(selected.before)}) then raise exception 'OFFICIAL_UPDATE_CONFLICT'; end if;
update public.campaign_content_entries set name=${q(selected.definition.name)},origin=${q(selected.origin)},tags=ARRAY[${selected.tags.map(q).join(",")}],payload=${json(selected.payload)},revision=${selected.revision},updated_at=statement_timestamp() where campaign_id=${q(cid)} and kind='equipment' and content_key=${q(selected.key)};
`;
  else mutation += `
if exists(select 1 from public.campaign_content_entries where campaign_id=${q(cid)} and kind='equipment' and content_key=${q(selected.key)}) then raise exception 'OFFICIAL_INSERT_CONFLICT'; end if;
insert into public.campaign_content_entries(campaign_id,kind,content_key,name,origin,tags,payload,revision) values(${q(cid)},'equipment',${q(selected.key)},${q(selected.definition.name)},${q(selected.origin)},ARRAY[${selected.tags.map(q).join(",")}],${json(selected.payload)},${selected.revision});
`;
}
const sql = `begin;
lock table public.campaigns,public.campaign_content_entries in share row exclusive mode;
lock table public.official_content_entries,public.campaign_state_fragments,public.campaign_character_versions in share mode;
do $official_resolution$ begin
if(select state_revision from public.campaigns where id=${q(cid)})<>${guard.revision} then raise exception 'OFFICIAL_CAMPAIGN_CONFLICT'; end if;
if ${references} then raise exception 'OFFICIAL_ENTRY_IN_USE'; end if;
${assertGuards}
${mutation}
${assertGuards}
update public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp() where id=${q(cid)};
end $official_resolution$;
select jsonb_build_object('revision',(select state_revision from public.campaigns where id=${q(cid)}),'retired',${plan.retired.length},'updated',${publication.filter((p)=>p.before).length},'inserted',${publication.filter((p)=>!p.before).length}) as result;
commit;`;
writeFileSync(`${root}/${prefix}-publication.sql`, sql);
writeFileSync(`${root}/${prefix}-dry-run.sql`, sql.replace(/commit;$/, "rollback;"));
console.log(JSON.stringify({ retired: plan.retired.length, updated: publication.filter((p)=>p.before).length, inserted: publication.filter((p)=>!p.before).length, bytes: Buffer.byteLength(sql) }));
