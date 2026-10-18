/** Read-only worklist from the current ECE inventory/merchant snapshot. */
import { readFileSync, writeFileSync } from "node:fs";
const root = "tmp/equipment-definitions";
const snapshot = JSON.parse(readFileSync(`${root}/owned-priority-current.json`, "utf8"));
const drafts = JSON.parse(readFileSync(`${root}/real-drafts-reviewed.json`, "utf8"));
const token = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9+]/g, "");
const owners = new Map(snapshot.characters.filter((row) => row.fragment_kind === "character-core").map((row) => [row.entity_id, row.payload.name]));
const copies = [
  ...snapshot.characters.filter((row) => row.fragment_kind === "character-inventory").map((row) => ({ kind: "character", owner: owners.get(row.parent_id), ownerId: row.parent_id, id: row.entity_id, value: row.payload })),
  ...snapshot.merchants.filter((row) => row.kind === "monster").flatMap((row) => (row.payload.inventory ?? []).map((value) => ({ kind: "merchant", owner: row.name, ownerId: row.payload.id, id: value.id, value }))),
];
const aliases = {
  "Kit de herbolario": "herbalism-kit", "Kit de herborista": "herbalism-kit",
  "Herramientas de alquimista": "alchemists-supplies", "Herramientas de manitas": "tinkers-tools",
  "Herramientas del cartógrafo": "cartographers-tools", "Kit de cartógrafo": "cartographers-tools", "Kit de calígrafo": "calligraphers-supplies",
  "Herramientas de cartógrafo": "cartographers-tools", "Herramientas de herrero": "smiths-tools", "Manta": "blanket",
  "Paquete de explorador": "explorers-pack", "Paquete de erudito": "scholars-pack", "Kit de comedor": "mess-kit",
  "Estuche para mapas o pergaminos": "case-map-or-scroll", "Pluma": "ink-pen", "Botella de tinta": "ink-1-ounce-bottle",
  "Virote": "crossbow-bolt", "Flecha normal": "arrow", "Aguja para cerbatana": "blowgun-needle",
  "Gancho de escalada": "grappling-hook", "Armadura de Semiplanas": "half-plate", "Cota de malla": "chain-mail",
};
const aliasMap = new Map(Object.entries(aliases).map(([name, index]) => [token(name), index]));
const identities = drafts.map((draft) => {
  const primary = draft.payload.originals.find((source) => draft.payload.definition.id === `recovery:${source.originalKey}`);
  return { draft, key: primary?.originalKey, index: primary?.raw.payload?.index, names: new Set([draft.payload.definition.name, ...draft.payload.definition.aliases, ...draft.payload.originals.map((source) => source.raw.name)].map(token)) };
});
const priority = new Map(), unresolved = [];
for (const copy of copies) {
  const reference = copy.value.catalog?.contentKey;
  let matches = reference ? identities.filter((item) => item.key === reference) : [];
  let method = "reference";
  if (!matches.length) { matches = identities.filter((item) => item.names.has(token(copy.value.name))); method = "name-candidate"; }
  if (!matches.length && aliasMap.has(token(copy.value.name))) { matches = identities.filter((item) => item.index === aliasMap.get(token(copy.value.name))); method = "alias-candidate"; }
  if (!matches.length) unresolved.push({ ...copy, reason: "No confirmed catalog candidate" });
  for (const match of matches) {
    const item = priority.get(match.key) ?? { id: match.draft.payload.definition.id, contentKey: match.key, name: match.draft.payload.definition.name, index: match.index, uses: [] };
    item.uses.push({ kind: copy.kind, owner: copy.owner, id: copy.id, name: copy.value.name, method, ambiguous: matches.length > 1 });
    priority.set(match.key, item);
  }
}
const report = { capturedAt: snapshot.captured_at, characterCopies: copies.filter((copy) => copy.kind === "character").length,
  merchantCopies: copies.filter((copy) => copy.kind === "merchant").length, catalogDefinitions: priority.size,
  definitions: [...priority.values()].sort((a, b) => a.name.localeCompare(b.name, "es")), unresolved };
writeFileSync(`${root}/owned-priority-worklist.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, definitions: report.definitions.map(({ name, index, uses }) => ({ name, index, uses: uses.length })), unresolved: unresolved.map(({ owner, value }) => ({ owner, name: value.name })) }, null, 2));
