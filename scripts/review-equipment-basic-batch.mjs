/** Applies a bounded, manually checked source review. No database access or inventory writes. */
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createServer } from "vite";
const root = "tmp/equipment-definitions", reports = "docs/v2/equipment-preparation-2026-10-17";
const drafts = JSON.parse(readFileSync(`${root}/real-drafts.json`, "utf8"));
const review = JSON.parse(readFileSync(`${reports}/cotejo-equipo-basico.json`, "utf8"));
const selected = [], originalCount = drafts.length;
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { EquipmentPreparationPayloadSchema } = await server.ssrLoadModule("/src/domain/equipment/equipment-preparation.ts");
  const { verifyEquipmentSource, assessEquipmentRecovery } = await server.ssrLoadModule("/src/domain/equipment/equipment-recovery.ts");
  const { equipmentCompletionIssues } = await server.ssrLoadModule("/src/domain/equipment/equipment-definition.ts");
  const { equipmentReviewPolicy, equipmentAutomationGaps } = await server.ssrLoadModule("/src/domain/equipment/equipment-policy.ts");
  for (const checked of review.items) {
    // Match only the primary Spanish original, never a related candidate's index or a partial name.
    const matches = drafts.filter((draft) => draft.payload.originals.some((source) =>
      draft.payload.definition.id === `recovery:${source.originalKey}` && source.scope === "ECE" &&
      source.raw.payload?.index === checked.index && source.raw.tags?.includes("es")));
    assert.equal(matches.length, 1, checked.index);
    const record = matches[0], value = record.payload.definition;
    const beforeOriginals = JSON.stringify(record.payload.originals);
    // This particular review covers plain gear and one healing potion. Do not replace unknown abilities.
    assert.equal(value.capabilities.length, 0, `Unreviewed capabilities: ${checked.index}`);
    value.aliases = [...new Set([...value.aliases, ...record.payload.originals.map((source) => source.raw.name).filter((name) => typeof name === "string" && name !== checked.name)])];
    value.name = checked.name; value.origin = "official"; value.category = checked.category;
    value.magical = checked.magical ?? false; value.consumable = checked.consumable ?? false;
    value.rarity = value.magical ? null : "none";
    value.weight = checked.weightLb === null ? null : { value: checked.weightLb, unit: "lb" };
    value.economy = { basePrice: checked.price, campaignPrice: null, explanation: "Precio del equipo de 2014. No sustituye precios propios de comerciantes ni valora poderes adicionales." };
    value.requirements = { attunement: false, bearer: [], presence: checked.healing ? "held" : "possessed", explanation: "El objeto básico no requiere sintonización ni restricciones de portador." };
    value.sources.push(...review.sources);
    const textSources = [review.sources[0].id];
    value.description = [{ id: "reviewed-equipment-table", type: "table", section: "description", provenance: "reviewed-translation", sourceIds: textSources,
      columns: ["Objeto", "Coste", "Peso"], rows: [[checked.name, `${checked.price.quantity} ${{ cp: "pc", sp: "pp", gp: "po" }[checked.price.unit]}`, checked.weightLb === null ? "—" : `${String(checked.weightLb).replace(".", ",")} lb`]] }];
    if (checked.paragraph) value.description.push({ id: "reviewed-equipment-rules", type: "paragraph", section: "rules", provenance: "reviewed-translation", sourceIds: textSources, text: checked.paragraph });
    if (checked.healing) value.capabilities.push({
      id: "drink-or-administer", name: "Beber o administrar", activation: "action", trigger: "", requirements: { ...value.requirements },
      target: "La criatura que bebe o recibe la poción.", range: "Contacto", duration: "Instantánea", concentration: false,
      costs: [], consumeQuantity: 1,
      effects: [{ id: "restore-hit-points", kind: "healing", condition: "Al beber o recibir la poción.", expression: checked.healing, target: "recipient" }],
      execution: { mode: "unsupported", handler: null,
        explanation: "Regla cotejada: gastar una acción, consumir una poción y recuperar 2d4 + 2 PG, sin superar el máximo. Falta conectar esta definición nueva a su ejecución; no concede otro uso a las copias actuales.",
        pendingAutomation: ["Seleccionar al receptor y aplicar la curación sin superar sus PG máximos.", "Consumir exactamente una unidad y registrar la acción sin duplicar efectos."] },
      textBlockIds: ["reviewed-equipment-rules"],
    });
    value.review = { identity: true, information: false, editorial: true, mechanics: true,
      unresolved: ["Cerrar la cobertura de todos los campos de los originales antes de migrar o retirar versiones.", ...(checked.notes ?? [])] };
    if (checked.weightLb === null) value.review.unresolved.push("La fuente no especifica peso: no confundir el guion de la tabla con cero libras.");
    for (const original of record.payload.originals) {
      const add = (pointer, target, reason) => {
        if (record.payload.decisions.some((decision) => decision.sourceId === original.id && decision.pointer === pointer)) return;
        record.payload.decisions.push({ sourceId: original.id, pointer, disposition: "incorporated", destination: { documentId: value.id, pointer: target }, reason, reviewed: true });
      };
      const aliasPath = (name) => name === value.name ? "/name" : value.aliases.includes(name) ? `/aliases/${value.aliases.indexOf(name)}` : null;
      for (const [pointer, name] of [["/name", original.raw.name], ["/payload/name", original.raw.payload?.name]]) {
        const target = aliasPath(name);
        if (typeof name === "string" && target) add(pointer, target, "Nombre conservado como nombre español cotejado o como alias de la versión original.");
      }
      const legacy = original.raw.payload;
      if (legacy?.cost?.quantity === checked.price.quantity && legacy?.cost?.unit === checked.price.unit) {
        add("/payload/cost/quantity", "/economy/basePrice/quantity", "Precio de catálogo contrastado con la tabla de equipo de 2014; no modifica precios de copias ni de tiendas.");
        add("/payload/cost/unit", "/economy/basePrice/unit", "Unidad monetaria preservada en el precio base cotejado.");
      }
      if (typeof legacy?.weight === "number" && legacy.weight === checked.weightLb) add("/payload/weight", "/weight/value", "Peso en libras contrastado con la tabla de equipo de 2014.");
      if (checked.weightLb === null && legacy?.weight === 0) add("/payload/weight", "/weight", "El cero heredado representaba un guion de la tabla. Se corrige a peso no especificado; el valor antiguo permanece en el original íntegro.");
    }
    EquipmentPreparationPayloadSchema.parse(record.payload);
    assert.equal(JSON.stringify(record.payload.originals), beforeOriginals);
    for (const original of record.payload.originals) assert.ok(await verifyEquipmentSource(original));
    const recovery = await assessEquipmentRecovery(record.payload.originals, record.payload.decisions, new Map([[value.id, value]]));
    assert.deepEqual(recovery.issues, []); assert.ok(recovery.resolved > 0); assert.equal(recovery.complete, false);
    const blockers = equipmentCompletionIssues(value, equipmentReviewPolicy(value));
    assert.ok(blockers.length > 0, "Source review must not declare usable definitive content");
    selected.push({ record, checked, blockers, recovery, automation: equipmentAutomationGaps(value) });
  }
  assert.equal(drafts.length, originalCount);
  assert.equal(selected.length, review.items.length);
  writeFileSync(`${root}/reviewed-basic-drafts.json`, JSON.stringify(selected.map((item) => item.record)));
  writeFileSync(`${root}/real-drafts-reviewed.json`, JSON.stringify(drafts));
  const report = { mode: "local-source-review-only", reviewedDefinitions: selected.length, totalDrafts: drafts.length,
    originalArchivesUnchanged: true, resolvedFields: selected.reduce((sum, item) => sum + item.recovery.resolved, 0), definitiveObjects: 0, migratedCopies: 0, deletedVersions: 0,
    names: selected.map(({ record, checked, blockers, automation, recovery }) => ({ name: record.payload.definition.name, index: checked.index, recovery: { fields: recovery.fields, resolved: recovery.resolved, pending: recovery.pending.length }, blockers, automation })) };
  writeFileSync(`${reports}/cotejo-equipo-basico-verificado.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, names: selected.map(({ record }) => record.payload.definition.name) }));
} finally { await server.close(); }
