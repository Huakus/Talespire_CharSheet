/** Build a review collection from preserved originals. No database writes or migration. */
import { createServer } from "vite";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const out = "tmp/equipment-definitions", report = "docs/v2/equipment-preparation-2026-10-17";
const read = (file) => JSON.parse(readFileSync(file, "utf8"));
const rows = [0, 500, 1000, 1500].flatMap((offset) => read(`tmp/item-tags/ece-after-${offset}.json`));
const archives = readFileSync(`${out}/sources.jsonl`, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
const index = new Map(archives.filter((source) => source.scope === "ECE").map((source) => [source.originalKey, source]));
const sharedIndex = new Map(archives.filter((source) => source.scope === "shared").map((source) => [source.originalKey, source]));
mkdirSync(report, { recursive: true });
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { equipmentRowLanguage } = await server.ssrLoadModule("/src/domain/equipment/classify-equipment.ts");
  const { relatedEquipmentKeys } = await server.ssrLoadModule("/src/domain/equipment/equipment-candidates.ts");
  const { preparationFromOriginals, EquipmentPreparationPayloadSchema } = await server.ssrLoadModule("/src/domain/equipment/equipment-preparation.ts");
  const { equipmentAutomationGaps, EQUIPMENT_CATALOG_DECISIONS } = await server.ssrLoadModule("/src/domain/equipment/equipment-policy.ts");
  const { verifyEquipmentSource } = await server.ssrLoadModule("/src/domain/equipment/equipment-recovery.ts");
  const identities = rows.map((row) => ({ key: row.content_key, name: row.name, index: row.payload.index }));
  const spanish = rows.filter((row) => equipmentRowLanguage(row) === "es"), drafts = [];
  for (const row of spanish) {
    const selected = index.get(row.content_key); assert.ok(selected);
    const keys = [row.content_key, ...relatedEquipmentKeys({ key: row.content_key, name: row.name, index: row.payload.index }, identities)];
    const originals = [...new Map(keys.flatMap((key) => [index.get(key), sharedIndex.get(key)]).filter(Boolean).map((source) => [source.id, source])).values()];
    const draft = preparationFromOriginals(`recovery:${row.content_key}`, selected, originals, "9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd");
    assert.deepEqual(EquipmentPreparationPayloadSchema.parse(JSON.parse(JSON.stringify(draft.payload))), draft.payload);
    drafts.push(draft);
  }
  const used = new Set(drafts.flatMap((draft) => draft.payload.originals.map((source) => source.id)));
  for (const source of archives.filter((source) => used.has(source.id))) assert.ok(await verifyEquipmentSource(source));
  assert.equal(drafts.length, 806);
  writeFileSync(`${out}/real-drafts.json`, JSON.stringify(drafts));
  const gaps = drafts.flatMap((draft) => equipmentAutomationGaps(draft.payload.definition).map((gap) => ({ itemId: draft.payload.definition.id, itemName: draft.payload.definition.name, ...gap })));
  writeFileSync(`${report}/automatizacion-pendiente.json`, JSON.stringify(gaps, null, 2));
  const coveredEnglish = rows.filter((row) => equipmentRowLanguage(row) === "en" && used.has(index.get(row.content_key)?.id));
  const summary = {
    mode: "local-preparation-only", spanishDrafts: drafts.length, relatedEnglishRowsPreserved: coveredEnglish.length,
    uniqueOriginalArchivesUsed: used.size, draftsWithRelatedSources: drafts.filter((draft) => draft.payload.originals.length > 1).length,
    recoveredRuleCandidates: drafts.reduce((count, draft) => count + draft.payload.definition.capabilities.length, 0),
    pendingAutomationEntries: gaps.length, definitiveObjects: 0, migratedCopies: 0, deletedVersions: 0,
    policy: EQUIPMENT_CATALOG_DECISIONS,
    stixVariant: drafts.find((draft) => draft.payload.definition.name === "Daga del Umbral · variante de Stix")?.payload.definition.id,
    note: "Candidate relations preserve evidence; they do not certify identities, translations or rules. Unknown fields remain pending instead of receiving invented defaults.",
  };
  writeFileSync(`${report}/preparacion-real.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
} finally { await server.close(); }
