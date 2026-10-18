/** Offline only: classify fresh exports and prepare guarded, tags-only SQL. No DB connection. */
import { createServer } from "vite";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import assert from "node:assert/strict";

const root = "tmp/item-tags", out = "docs/v2/item-tags-2026-10-17";
const campaignId = "9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd";
const read = (name) => JSON.parse(readFileSync(`${root}/${name}`, "utf8"));
const write = (name, value) => writeFileSync(`${root}/${name}`, typeof value === "string" ? value : JSON.stringify(value, null, 2));
const load = (scope) => [0, 500, 1000, 1500].flatMap((offset) => read(`${scope}-${offset}.json`));
const shared = load("shared"), ece = load("ece"), guards = read("guards-before.json");
assert.equal(shared.length, 1572); assert.equal(ece.length, 1609);
for (const rows of [shared, ece]) {
  assert.equal(new Set(rows.map((row) => row.content_key)).size, rows.length);
  assert.ok(rows.every((row) => row.kind === "equipment" && (!row.campaign_id || row.campaign_id === campaignId)));
}
mkdirSync(out, { recursive: true });
const aliases = {
  "Cloak of Charisma +1": "Capa de Carisma +1", "Reaper’s Shadow": "Sombra del Segador",
  "Lucent Crystal": "Cristal Luciente", "Wizard Amulet": "Amuleto de mago", Jewelry: "Joyas",
  "Lucent Core": "Núcleo Luciente", "Agati’s Robe": "Túnica de Agati", "Staff of Haste": "Bastón de Acelerar",
  "Reserve Crystal": "Cristal de Reserva", "Crimson Crystal": "Cristal Carmsí", "Runed Cloak": "Capa con runas",
  "Scholar’s Scroll": "Pergamino de Erudito", "Wand of Annoyance": "Varita de molestar",
};
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { classifyEquipment, equipmentRowLanguage } = await server.ssrLoadModule("/src/domain/equipment/classify-equipment.ts");
  const { EQUIPMENT_TAG_LABELS } = await server.ssrLoadModule("/src/domain/equipment/equipment-tags.ts");
  const results = { shared: classifyEquipment(shared, [], aliases), ece: classifyEquipment(ece, shared, aliases) };
  const changes = Object.entries(results).flatMap(([scope, rows]) => rows.filter((r) => JSON.stringify(r.tags) !== JSON.stringify(r.row.tags)).map((r) => ({ scope, content_key: r.row.content_key, before: r.row.tags, after: r.tags })));
  const summary = Object.fromEntries(Object.entries(results).map(([scope, rows]) => [scope, {
    total: rows.length, modified: changes.filter((c) => c.scope === scope).length,
    languages: Object.fromEntries(["es", "en", "unknown"].map((lang) => [lang, rows.filter((r) => equipmentRowLanguage(r.row) === lang).length])),
    tags: Object.fromEntries(Object.keys(EQUIPMENT_TAG_LABELS).map((tag) => [tag, rows.filter((r) => r.tags.includes(tag)).length])),
  }]));
  write("plan.json", changes);
  writeFileSync(`${root}/backup-before.json.gz`, gzipSync(JSON.stringify({ campaignId, guards, shared, ece })));
  writeFileSync(`${out}/resumen.json`, JSON.stringify({ campaignId, summary, labels: EQUIPMENT_TAG_LABELS, deleted: 0, payloadsModified: 0 }, null, 2));
  const cell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = (file, rows) => { const keys = Object.keys(rows[0]); writeFileSync(`${out}/${file}`, "\ufeff" + keys.map(cell).join(",") + "\n" + rows.map((row) => keys.map((key) => cell(row[key])).join(",")).join("\n") + "\n"); };
  const names = new Map(ece.map((row) => [row.content_key, row.name]));
  csv("clasificacion-ece.csv", results.ece.map((r) => ({ clave: r.row.content_key, nombre: r.row.name, idioma: equipmentRowLanguage(r.row), etiquetas: r.tags.join(" | "), motivos: r.reasons.join(" | ") })));
  csv("correspondencias-ingles.csv", results.ece.filter((r) => equipmentRowLanguage(r.row) === "en").map((r) => ({ clave_ingles: r.row.content_key, nombre_ingles: r.row.name, candidatos_es: r.spanishCandidates.map((key) => names.get(key)).join(" | "), claves_es: r.spanishCandidates.join(" | "), estado: r.spanishCandidates.length ? "Revisar integridad y equivalencia antes de retirar inglés" : "Conservar: sin correspondencia española identificada" })));

  const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
  const data = (value) => { const json = JSON.stringify(value); const marker = `tags_${createHash("sha256").update(json).digest("hex").slice(0, 20)}`; return `$${marker}$${json}$${marker}$::jsonb`; };
  const hash = (table, where, order) => `(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by ${order}),'')) from public.${table} t where ${where})`;
  const eceWhere = `campaign_id=${q(campaignId)} and kind='equipment' and deleted_at is null`;
  const hashes = {
    shared_equipment_hash: hash("official_content_entries", "kind='equipment'", "content_key"),
    ece_equipment_hash: hash("campaign_content_entries", eceWhere, "content_key"),
    protected_catalog_hash: hash("campaign_content_entries", `not (${eceWhere})`, "campaign_id,kind,content_key"),
    other_shared_hash: hash("official_content_entries", "kind<>'equipment'", "kind,content_key"),
    protected_fragments_hash: hash("campaign_state_fragments", "true", "campaign_id,fragment_kind,parent_id,entity_id"),
  };
  const guard = (expression, expected, label) => `if ${expression} is distinct from ${q(expected)} then raise exception ${q(`ITEM_TAGS_CONFLICT:${label}`)}; end if;`;
  const locks = `begin;\nlock table public.campaigns,public.official_content_entries,public.campaign_content_entries in share row exclusive mode;\nlock table public.campaign_state_fragments,public.campaign_character_versions in share mode;\n`;
  const groups = (field) => {
    const grouped = new Map();
    for (const change of changes) { const key = JSON.stringify([change.scope, change[field]]); if (!grouped.has(key)) grouped.set(key, { scope: change.scope, tags: change[field], keys: [] }); grouped.get(key).keys.push(change.content_key); }
    return [...grouped.values()];
  };
  const updates = (field) => groups(field).map((group) => {
    const table = group.scope === "shared" ? "official_content_entries" : "campaign_content_entries";
    const where = group.scope === "shared" ? "kind='equipment'" : eceWhere;
    return `update public.${table} set tags=array[${group.tags.map(q).join(",")}]::text[]${group.scope === "ece" ? ",revision=revision+1,updated_at=statement_timestamp()" : ""} where ${where} and content_key in (${group.keys.map(q).join(",")});\nget diagnostics affected=row_count; if affected<>${group.keys.length} then raise exception 'ITEM_TAGS_COUNT'; end if;`;
  }).join("\n");
  const notify = `update public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp() where id=${q(campaignId)};`;
  let sql = locks + `create temporary table _item_tags_before on commit drop as
select 'shared' as scope,content_key,to_jsonb(t)-'tags' as protected from public.official_content_entries t where kind='equipment'
union all select 'ece',content_key,to_jsonb(t)-'tags'-'revision'-'updated_at' from public.campaign_content_entries t where ${eceWhere};
do $item_tags$ declare affected integer; begin
${Object.entries(hashes).map(([key, expression]) => guard(expression, guards[key], key)).join("\n")}
${updates("after")}
if exists(select 1 from _item_tags_before b join public.official_content_entries t using(content_key) where b.scope='shared' and t.kind='equipment' and b.protected<>to_jsonb(t)-'tags') or exists(select 1 from _item_tags_before b join public.campaign_content_entries t using(content_key) where b.scope='ece' and t.${eceWhere.replaceAll(" and ", " and t.")} and b.protected<>to_jsonb(t)-'tags'-'revision'-'updated_at') then raise exception 'ITEM_TAGS_PAYLOAD_CHANGED'; end if;
${["protected_catalog_hash", "other_shared_hash", "protected_fragments_hash"].map((key) => guard(hashes[key], guards[key], key)).join("\n")}
${notify}
end $item_tags$;
select count(*) as classified_shared from public.official_content_entries where kind='equipment';
select count(*) as classified_ece from public.campaign_content_entries where ${eceWhere};
commit;
`;
  write("apply.sql", sql); write("dry-run.sql", sql.replace("commit;", "rollback;"));
  let rollbackGuard = "raise exception 'ITEM_TAGS_ROLLBACK_NOT_READY: export guards-after.json first';";
  try { const after = read("guards-after.json"); rollbackGuard = ["shared_equipment_hash", "ece_equipment_hash"].map((key) => guard(hashes[key], after[key], `rollback-${key}`)).join("\n"); } catch { /* Fail closed until committed hashes have been captured. */ }
  write("rollback.sql", locks + `do $undo_tags$ declare affected integer; begin\n${rollbackGuard}\n${updates("before")}\n${notify}\nend $undo_tags$;\ncommit;\n`);
  write("checksums.json", Object.fromEntries(["backup-before.json.gz", "plan.json", "apply.sql", "rollback.sql"].map((name) => [name, createHash("sha256").update(readFileSync(`${root}/${name}`)).digest("hex")])));
  console.log(JSON.stringify({ summary, changes: changes.length, sqlBytes: sql.length, executed: false }));
} finally { await server.close(); }
