/** Local preparation only. Never connects to the DB or migrates an owned item. */
import { createServer } from "vite";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const output = "tmp/equipment-definitions", reports = "docs/v2/equipment-format-2026-10-17";
const read = (file) => JSON.parse(readFileSync(file, "utf8"));
const shared = [0, 500, 1000, 1500].flatMap((offset) => read(`tmp/item-tags/shared-after-${offset}.json`));
const ece = [0, 500, 1000, 1500].flatMap((offset) => read(`tmp/item-tags/ece-after-${offset}.json`));
const context = read("tmp/item-tags/triage-live-context.json"), guards = read("tmp/item-tags/guards-after.json");
assert.equal(context.catalog_hash, guards.ece_equipment_hash);
assert.equal(context.shared_hash, guards.shared_equipment_hash);
const inventory = context.rows.filter((row) => row.fragment_kind === "character-inventory");
const merchants = read(`${output}/merchant-context-complete.json`);
assert.equal(inventory.length, context.inventory_count);
const inputs = [
  ...shared.map((row) => ({ scope: "shared", key: row.content_key, row })),
  ...ece.map((row) => ({ scope: "ECE", key: row.content_key, row })),
  ...inventory.map((row) => ({ scope: `ECE:character:${row.parent_id}`, key: row.entity_id, row })),
  ...merchants.rows.map((row) => ({ scope: "ECE:merchant-content", key: row.content_key, row })),
];
mkdirSync(output, { recursive: true }); mkdirSync(reports, { recursive: true });
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { captureEquipmentSource, verifyEquipmentSource, equipmentSourcePointers } = await server.ssrLoadModule("/src/domain/equipment/equipment-recovery.ts");
  const { equipmentDraftExamples } = await server.ssrLoadModule("/test/fixtures/equipment-definition-drafts.ts");
  const { equipmentCompletionIssues, serializeEquipmentDefinitionDraft, parseEquipmentDefinitionDraft } = await server.ssrLoadModule("/src/domain/equipment/equipment-definition.ts");
  const { EQUIPMENT_CATALOG_DECISIONS, equipmentReviewPolicy } = await server.ssrLoadModule("/src/domain/equipment/equipment-policy.ts");
  const file = `${output}/sources.jsonl`;
  const prior = existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)) : [];
  for (const source of prior) assert.ok(await verifyEquipmentSource(source), `A saved original was changed: ${source.id}`);
  const byId = new Map(prior.map((source) => [source.id, source])), current = [], capturedAt = new Date().toISOString();
  for (const input of inputs) {
    const source = await captureEquipmentSource(input.scope, input.key, capturedAt, input.row);
    if (!byId.has(source.id)) byId.set(source.id, source);
    assert.deepEqual(byId.get(source.id).raw, input.row);
    current.push(byId.get(source.id));
  }
  // Existing originals are retained across subsequent runs, even if input snapshots change.
  writeFileSync(file, [...byId.values()].map((source) => JSON.stringify(source)).join("\n") + "\n");
  const persisted = readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
  for (const source of persisted) assert.ok(await verifyEquipmentSource(source));
  const manifest = {
    format: "equipment-recovery-workspace", schemaVersion: 1, preparedAt: capturedAt,
    state: "preparation-only", activeCatalogWrites: 0, ownedCopiesMigrated: 0, deleted: 0,
    sourceSnapshots: { sharedEquipmentHash: context.shared_hash, eceEquipmentHash: context.catalog_hash, inventoryFile: "tmp/item-tags/triage-live-context.json", merchantReadAt: merchants.captured_at, note: "Local snapshots; merchant context was read separately. Refresh all relevant snapshots before any future live migration." },
    currentSources: current.map((source) => ({ id: source.id, scope: source.scope, originalKey: source.originalKey, fieldsPending: equipmentSourcePointers(source.raw).length })),
    retainedSourceArchives: byId.size,
    reviewDecisionsFile: "review-decisions.json",
    policy: EQUIPMENT_CATALOG_DECISIONS,
  };
  // Reviews are stored separately: regenerating an index must never erase decisions.
  writeFileSync(`${output}/source-index.json`, JSON.stringify(manifest, null, 2));
  if (!existsSync(`${output}/review-decisions.json`)) writeFileSync(`${output}/review-decisions.json`, "[]\n");
  const examples = equipmentDraftExamples();
  const blockers = [];
  for (const example of examples) {
    assert.deepEqual(parseEquipmentDefinitionDraft(serializeEquipmentDefinitionDraft(example)), example);
    const issues = equipmentCompletionIssues(example, equipmentReviewPolicy(example));
    assert.ok(issues.length > 0);
    blockers.push({ id: example.id, name: example.name, definitive: false, blockers: issues });
  }
  writeFileSync(`${reports}/ejemplos-sinteticos.json`, JSON.stringify(examples, null, 2));
  writeFileSync(`${reports}/validacion-ejemplos.json`, JSON.stringify(blockers, null, 2));
  const summary = {
    state: "preparation-only", sharedRowsPreserved: shared.length, eceRowsPreserved: ece.length, ownedRowsPreserved: inventory.length,
    npcRowsPreserved: merchants.rows.filter((row) => row.kind === "monster").length,
    shopRowsPreserved: merchants.rows.filter((row) => row.kind === "shop").length,
    currentSourceRows: current.length, allArchivedFieldsPendingReview: current.reduce((total, source) => total + equipmentSourcePointers(source.raw).length, 0),
    retainedSourceArchives: byId.size, archivesReloadedAndVerified: persisted.length,
    syntheticFormatExamples: examples.length, definitiveObjectsCreated: 0, migrated: 0, deleted: 0,
    policyPending: [], policy: EQUIPMENT_CATALOG_DECISIONS,
    archiveSha256: createHash("sha256").update(readFileSync(file)).digest("hex"),
  };
  writeFileSync(`${reports}/preparacion.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
} finally { await server.close(); }
