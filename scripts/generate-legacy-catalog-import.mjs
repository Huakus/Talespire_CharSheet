import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const [, , inputArgument, campaignArgument = "ECE", outputArgument] = process.argv;
if (!inputArgument) {
  throw new Error("Uso: node scripts/generate-legacy-catalog-import.mjs <archivo-global> [campaña] [salida.sql]");
}

const inputPath = resolve(inputArgument);
const campaignName = campaignArgument.trim();
if (!campaignName) throw new Error("El nombre de campaña no puede estar vacío.");
const outputPath = resolve(outputArgument ?? "supabase/migrations/20260808000200_import_legacy_gm_catalog.sql");
const root = JSON.parse(await readFile(inputPath, "utf8"));
if (!root || typeof root !== "object" || Array.isArray(root)) throw new Error("El archivo global debe contener un objeto JSON.");

const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const entries = [];
for (const [collection, kind] of [["Custom Spells", "spell"], ["Custom Equipment", "equipment"], ["Custom Monsters", "monster"]]) {
  for (const [legacyName, payloadValue] of Object.entries(object(root[collection]))) {
    const payload = object(payloadValue);
    const name = String(payload.name ?? payload.Name ?? legacyName).trim();
    if (!name) continue;
    const fingerprint = createHash("sha256").update(`${kind}\0${legacyName}\0${JSON.stringify(payload)}`).digest("hex").slice(0, 24);
    entries.push({ kind, contentKey: `imported:${kind}:legacy:${fingerprint}`, name, payload });
  }
}
for (const [nameValue, categories] of Object.entries(object(root["Shop Data"]))) {
  const name = String(nameValue).trim();
  if (!name) continue;
  const payload = { name, categories: object(categories) };
  const fingerprint = createHash("sha256").update(`shop\0${name}\0${JSON.stringify(payload)}`).digest("hex").slice(0, 24);
  entries.push({ kind: "shop", contentKey: `imported:shop:legacy:${fingerprint}`, name, payload });
}
entries.sort((left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name, "es"));
if (!entries.length) throw new Error("El archivo no contiene contenido personalizado importable.");

const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const jsonLiteral = (value, index) => {
  const json = JSON.stringify(value);
  let delimiter = `$payload_${index}$`;
  while (json.includes(delimiter)) delimiter = `$payload_${index}_${delimiter.length}$`;
  return `${delimiter}${json}${delimiter}::jsonb`;
};
const values = entries.map((entry, index) => `    (${literal(entry.kind)}, ${literal(entry.contentKey)}, ${literal(entry.name)}, ${jsonLiteral(entry.payload, index)})`).join(",\n");

const sql = `-- Generated from ${basename(inputPath)} by scripts/generate-legacy-catalog-import.mjs.
-- Imports only GM catalog content; campaign characters, encounters, notes and local settings are untouched.
do $migration$
declare
  v_campaign_id uuid;
  v_campaign_matches integer;
  v_changed integer;
begin
  select count(*) into v_campaign_matches
  from public.campaigns
  where lower(btrim(name)) = lower(btrim(${literal(campaignName)}));

  if v_campaign_matches = 0 then
    raise notice 'Legacy GM catalog skipped: campaign % does not exist in this database', ${literal(campaignName)};
    return;
  end if;
  if v_campaign_matches > 1 then
    raise exception 'LEGACY_IMPORT_EXPECTED_ONE_CAMPAIGN: % matches for %', v_campaign_matches, ${literal(campaignName)};
  end if;

  select id into v_campaign_id
  from public.campaigns
  where lower(btrim(name)) = lower(btrim(${literal(campaignName)}));

  insert into public.campaign_content_entries as target
    (campaign_id, kind, content_key, name, origin, tags, payload, revision, created_by, updated_by, deleted_at)
  select
    v_campaign_id,
    source.kind,
    source.content_key,
    case when exists (
      select 1 from public.campaign_content_entries existing
      where existing.campaign_id = v_campaign_id
        and existing.kind = source.kind
        and existing.content_key <> source.content_key
        and lower(btrim(existing.name)) = lower(btrim(source.name))
        and existing.deleted_at is null
    ) then source.name || ' (importado)' else source.name end,
    'imported',
    array['imported', 'gm', 'legacy'],
    source.payload,
    0,
    null,
    null,
    null
  from (values
${values}
  ) as source(kind, content_key, name, payload)
  on conflict (campaign_id, kind, content_key) do update set
    name = excluded.name,
    origin = excluded.origin,
    tags = excluded.tags,
    payload = excluded.payload,
    revision = target.revision + 1,
    updated_by = null,
    updated_at = statement_timestamp(),
    deleted_at = null
  where (target.name, target.origin, target.tags, target.payload, target.deleted_at)
    is distinct from (excluded.name, excluded.origin, excluded.tags, excluded.payload, excluded.deleted_at);

  get diagnostics v_changed = row_count;
  raise notice 'Imported or updated % legacy GM catalog entries in campaign % (%)', v_changed, ${literal(campaignName)}, v_campaign_id;
end
$migration$;
`;

await writeFile(outputPath, sql, "utf8");
console.log(JSON.stringify({ outputPath, campaignName, counts: Object.fromEntries(["spell", "equipment", "monster", "shop"].map((kind) => [kind, entries.filter((entry) => entry.kind === kind).length])), total: entries.length }, null, 2));
