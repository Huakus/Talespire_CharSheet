/** Prepare a per-copy migration. Does not execute SQL or alter any live/local campaign. */
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "vite";
import assert from "node:assert/strict";
const root = "tmp/equipment-definitions", read = (name) => JSON.parse(readFileSync(name, "utf8"));
const live = read(`${root}/owned-migration-live-before.json`), baseline = read(`${root}/latest-preparation-baseline.json`), work = read(`${root}/owned-priority-worklist.json`), personal = read("docs/v2/equipment-preparation-2026-10-17/inventory-only-review.json");
const token = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9+]/g, "");
const owners = new Map(live.characters.filter((r) => r.fragment_kind === "character-core").map((r) => [r.entity_id, r.payload.name]));
const copies = [...live.characters.filter((r) => r.fragment_kind === "character-inventory").map((r) => ({ kind: "character", ownerId: r.parent_id, owner: owners.get(r.parent_id), item: r.payload, row: r })), ...live.merchants.filter((r) => r.kind === "monster" && r.payload.inventory?.length).flatMap((r) => r.payload.inventory.map((item) => ({ kind: "merchant", ownerId: r.payload.id, owner: r.name, item, row: r })))];
const byId = new Map(baseline.records.map((r) => [r.payload.definition.id, r.payload.definition]));
const primaryKey = (d) => d.id.startsWith("recovery:") ? d.id.slice(9) : `gm:equipment:owned:${d.id}`;
const fingerprint = (d) => JSON.stringify({ name: token(d.name), category: d.category, weapon: d.weapon, armor: d.armor, requirements: d.requirements, resources: d.resources, capabilities: d.capabilities, rarity: d.rarity });
const selected = [], blocked = [];
for (const copy of copies) {
  const specific = personal.find((p) => p.itemId === copy.item.id && p.owner === copy.owner);
  let candidates = specific ? [byId.get(specific.definitionId)].filter(Boolean) : [];
  let method = specific ? "personal-review" : "catalog-reference";
  if (!candidates.length && copy.item.catalog?.contentKey) { const found = byId.get(`recovery:${copy.item.catalog.contentKey}`); if (found) candidates = [found]; }
  if (!candidates.length) {
    candidates = work.definitions.filter((d) => d.uses.some((u) => u.id === copy.item.id && u.owner === copy.owner && u.kind === copy.kind)).map((d) => byId.get(d.id)).filter(Boolean); method = "owned-review";
  }
  if (token(copy.item.name) === "dagadelumbral") {
    const stix = copy.ownerId === "chr_2de8dab74a76cdd8d2b0d37cc84725ea";
    candidates = [byId.get(stix ? "recovery:gm:equipment:1b428562-bbef-4bec-8445-a76f7e16f854" : "recovery:gm:equipment:f92abc1a-849e-47e0-995b-0602c7156af8")]; method = "gm-personal-variant";
  }
  if (copy.owner === "Arturo" && copy.item.id === "inv_a6acf8e590c6d8dfcc4cced76745a835") {
    candidates = [byId.get("recovery:official:equipment:es:6d448708b838897d955a51eb")]; method = "gm-confirmed-vicious-longbow";
  }
  candidates = [...new Map(candidates.map((d) => [d.id, d])).values()];
  if (candidates.length > 1) {
    const reviewed = candidates.filter((d) => d.review.identity && d.review.editorial);
    if (reviewed.length && new Set(reviewed.map(fingerprint)).size === 1) candidates = [reviewed.sort((a, b) => a.id.localeCompare(b.id))[0]];
  }
  if (candidates.length !== 1) { blocked.push({ owner: copy.owner, name: copy.item.name, id: copy.item.id, candidates: candidates.map((d) => ({ id: d.id, name: d.name })), reason: "La identidad necesita una correspondencia inequívoca por copia." }); continue; }
  selected.push({ ...copy, definition: candidates[0], key: primaryKey(candidates[0]), method });
}
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { bindReviewedEquipment } = await server.ssrLoadModule("/src/domain/equipment/equipment-live.ts");
  const { CharacterInventoryItemV2Schema } = await server.ssrLoadModule("/src/domain/character/character-inventory-model.ts");
  const changes = [];
  for (const copy of selected) {
    const normalizedName = token(copy.item.name), d = copy.definition;
    const knownNames = [d.name, ...d.aliases].map(token);
    const personalName = d.id.startsWith("personal:") || !knownNames.includes(normalizedName) && /\(|—| · /.test(copy.item.name);
    const after = bindReviewedEquipment(copy.item, d, { preserveName: personalName });
    if (copy.owner === "Delerion" && copy.item.id === "inv_00f63cdb0f0f3df1c99f45a429771c2c") {
      after.rules.storage = { known: true, spells: [] };
      after.rules.pending = after.rules.pending.filter((note) => !note.includes("contenido almacenado"));
    }
    if (copy.method === "gm-personal-variant" && copy.ownerId !== "chr_2de8dab74a76cdd8d2b0d37cc84725ea") {
      after.features = after.features.filter((f) => token(f.name) !== "hojafasica");
      after.rules.pending.push("Se conserva la daga propia; Hoja Fásica está reservada a la variante de Stix por decisión del GM.");
    }
    after.catalog = { contentKey: copy.key, origin: copy.key.startsWith("gm:") ? "gm" : copy.item.catalog?.origin ?? "imported", tags: ["es", "revisado", d.origin === "campaign" ? "custom" : "reglas_2014"], revision: 0 };
    for (const field of ["id", "order", "group", "quantity", "equipped", "attuned", "cost"]) assert.deepEqual(after[field], copy.item[field], `${copy.owner}/${copy.item.name}/${field}`);
    assert.deepEqual(after.rules.original, copy.item);
    assert.deepEqual(CharacterInventoryItemV2Schema.parse(after), after);
    changes.push({ kind: copy.kind, ownerId: copy.ownerId, owner: copy.owner, key: copy.key, definitionId: d.id, before: copy.item, after, rowKey: copy.row.content_key ?? null, fragment: copy.kind === "character" ? copy.row : null, method: copy.method });
  }
  writeFileSync(`${root}/owned-migration-plan.json`, JSON.stringify({ campaignRevision: live.campaign_revision, changes, blocked }));
  writeFileSync(`${root}/owned-migration-catalog-keys.json`, JSON.stringify([...new Set(changes.map((c) => c.key))]));
  console.log(JSON.stringify({ copies: copies.length, mapped: changes.length, characters: changes.filter((c) => c.kind === "character").length, stock: changes.filter((c) => c.kind === "merchant").length, catalogDefinitions: new Set(changes.map((c) => c.key)).size, blocked }, null, 2));
} finally { await server.close(); }
