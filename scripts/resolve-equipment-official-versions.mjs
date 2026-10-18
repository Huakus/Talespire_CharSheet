/** Resolve the 25 quarantined entries using the GM's official-first decision. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { srdEquipmentTextBlocks } from "./srd-equipment-text-blocks.mjs";

const root = "tmp/equipment-definitions";
const read = (name) => JSON.parse(readFileSync(`${root}/${name}`, "utf8"));
const snapshot = read("official-resolution-before.json");
const baseline = read("latest-preparation-baseline.json");
assert.equal(snapshot.pending.length, 25);
const draftFor = (row) => {
  const record = baseline.records.find((r) => r.payload.definition.id === `recovery:${row.content_key}`);
  assert.ok(record, row.content_key);
  return structuredClone(record.payload.definition);
};
const generic = snapshot.pending.find((r) => r.payload.index === "belt-of-giant-strength");
assert.ok(generic);
const section = JSON.parse(readFileSync("tmp/pdfs/srd-magic-items.json", "utf8")).find((s) => s.name === "Cinturón de fuerza de gigante");
assert.ok(section);
const sourceId = "srd-5.1-es-equipment";
const beltText = srdEquipmentTextBlocks(section, sourceId);
const table = beltText.blocks.find((b) => b.type === "table");
assert.ok(table);
// This PDF merges strength and rarity into one text span in four rows.
// Split the existing words back into their printed columns without changing text.
const tableWords = (rows) => rows.flat().join(" ").split(/\s+/).filter(Boolean).sort();
const originalTableWords = tableWords(table.rows);
for (const row of table.rows) if (!row[2]) {
  const combined = /^(\d+)\s+(.+)$/.exec(row[1]);
  assert.ok(combined, `Giant belt table row: ${JSON.stringify(row)}`);
  row[1] = combined[1]; row[2] = combined[2];
}
assert.deepEqual(tableWords(table.rows), originalTableWords);
const definitions = [];
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { EquipmentDefinitionDraftSchema } = await server.ssrLoadModule("/src/domain/equipment/equipment-definition.ts");
  for (const [type, label, strength, rarity] of [
    ["hill", "las colinas", 21, "rare"], ["stone", "piedra", 23, "very-rare"],
    ["frost", "escarcha", 23, "very-rare"], ["fire", "fuego", 25, "very-rare"],
    ["cloud", "las nubes", 27, "legendary"], ["storm", "las tormentas", 29, "legendary"],
  ]) {
    const officialRow = table.rows.find((r) => Number(r[1]) === strength);
    assert.ok(officialRow, `Source strength: ${strength}`);
    const key = `official:equipment:es:${createHash("sha256").update(`2014:belt-of-${type}-giant-strength`).digest("hex").slice(0,24)}`;
    const d = draftFor(generic);
    Object.assign(d, { id: `recovery:${key}`, revision: 1, name: `Cinturón de fuerza de gigante de ${label}`, aliases: [`Belt of ${type} giant strength`], baseDefinitionId: null, origin: "official", category: "wondrous-item", subtypes: [type], magical: true, rarity, consumable: false, properties: [], weight: null, weapon: null, armor: null, resources: [] });
    d.sources = [...d.sources.filter((s) => s.id !== sourceId), { id: sourceId, kind: "srd", title: "SRD 5.1 · edición oficial española", language: "es", rulesEdition: "2014", locator: `https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1_ES.pdf · página PDF ${section.page} · CC BY 4.0`, verified: true }];
    d.description = [...structuredClone(beltText.blocks), { id: "selected-giant", type: "paragraph", section: "rules", provenance: "reviewed-translation", sourceIds: [sourceId], text: `Variante de esta ficha: gigante de ${label}. La Fuerza proporcionada es ${strength}; no reduce una puntuación igual o superior.` }];
    d.requirements = { attunement: true, presence: "worn", bearer: [], explanation: "Llevar puesto y estar sintonizado con el cinturón." };
    d.economy = { basePrice: null, campaignPrice: null, explanation: "El SRD no fija un precio de venta ni un peso. No convertir un precio heredado de cero en un precio oficial." };
    d.capabilities = [{ id: "giant-strength", name: `Fuerza ${strength}`, activation: "passive", trigger: "", requirements: structuredClone(d.requirements), target: "portador", range: "", duration: "Mientras se lleve puesto y esté sintonizado.", concentration: false, costs: [], consumeQuantity: 0, effects: [{ id: "strength-minimum", kind: "bonus", target: "strength", operation: "minimum", value: strength, condition: "No tiene efecto si la Fuerza del portador ya es igual o superior." }], execution: { mode: "automatic", handler: "equipment-passive-bonus", explanation: "Aplica la Fuerza de la variante concreta, sin reducir una puntuación superior.", pendingAutomation: [] }, textBlockIds: d.description.map((b) => b.id) }];
    d.review = { identity: true, information: false, editorial: true, mechanics: true, unresolved: ["Conservar originales y cerrar su cobertura antes de eliminar versiones."] };
    definitions.push({ key, before: null, origin: "official", tags: ["es", "revisado", "reglas_2014"], definition: EquipmentDefinitionDraftSchema.parse(d) });
  }

  for (const index of ["amulet-of-the-devout-1", "rhythm-maker's-drum-1"]) {
    const row = snapshot.pending.find((r) => r.payload.index === index);
    assert.ok(row);
    const d = draftFor(row), drum = index.startsWith("rhythm");
    const article = drum ? "https://www.dndbeyond.com/posts/1186-bard-201-the-best-magic-items-for-bards" : "https://www.dndbeyond.com/posts/1243-paladin-201-the-best-magic-items-for-paladins";
    const text = [
      drum ? "Mientras sostienes este tambor, obtienes un bonificador de +1 a las tiradas de ataque y a las CD de las tiradas de salvación de tus conjuros de bardo." : "Este amuleto lleva el símbolo de una deidad. Mientras lleves puesto el símbolo sagrado, obtienes un bonificador de +1 a las tiradas de ataque y a las CD de las tiradas de salvación de tus conjuros.",
      drum ? "Como acción, puedes tocar el tambor para recuperar un uso de Inspiración bárdica. Una vez usada esta propiedad, no puede volver a usarse hasta el siguiente amanecer." : "Mientras lleves puesto el amuleto, puedes usar Canalizar divinidad sin gastar uno de sus usos normales. Una vez usada esta propiedad, no puede volver a usarse hasta el siguiente amanecer. El amuleto no cambia el tiempo de activación del efecto de Canalizar divinidad que elijas.",
      drum ? "Requiere sintonización por un bardo." : "Requiere sintonización por un clérigo o paladín.",
    ];
    Object.assign(d, { revision: d.revision + 1, name: drum ? "Tambor del creador de ritmos +1" : "Amuleto del devoto +1", origin: "official", category: "wondrous-item", magical: true, rarity: "uncommon", consumable: false, properties: [], weapon: null, armor: null });
    d.sources.push({ id: "tasha-official-identification", kind: "book", title: "Tasha's Cauldron of Everything (2020) · identificación y beneficios corroborados por D&D Beyond", language: "en", rulesEdition: "2014", locator: article, verified: true });
    // The available article corroborates the identity, not every word of the book.
    // Preserve the imported text as a separate, unverified source; do not certify an official Spanish transcription.
    d.sources.push({ id: "tasha-imported-spanish", kind: "legacy", title: "Texto español previamente existente en ECE; cotejo íntegro con el libro pendiente", language: "es", rulesEdition: "2014", locator: row.content_key, verified: false });
    d.description = text.map((value, i) => ({ id: `tasha-rule-${i}`, type: "paragraph", section: "rules", provenance: "unreviewed", sourceIds: ["tasha-imported-spanish", "tasha-official-identification"], text: value }));
    d.requirements = { attunement: true, presence: drum ? "held" : "worn", bearer: [{ kind: "class", keys: drum ? ["bard"] : ["cleric", "paladin"], explanation: text[2] }], explanation: text[2] };
    d.resources = [{ id: "daily-property", name: drum ? "Recuperar Inspiración bárdica" : "Canalizar divinidad sin gastar un uso", kind: "uses", maximum: 1, unit: "usos", recovery: { kind: "event", event: "dawn", explanation: "Recupera al amanecer; no al descansar.", amount: { kind: "full" } }, exhaustion: "No puede volver a usarse esta propiedad antes del siguiente amanecer." }];
    const makeCap = (id, name, activation, effects, block, costs = []) => ({ id, name, activation, trigger: "", requirements: structuredClone(d.requirements), target: "portador", range: "", duration: activation === "passive" ? "Mientras se cumplan los requisitos del objeto." : "Según el rasgo de clase.", concentration: false, costs, consumeQuantity: 0, effects, textBlockIds: [block], execution: activation === "passive" ? { mode: "automatic", handler: "equipment-spell-bonus", explanation: drum ? "Se aplica únicamente a conjuros identificados como aprendidos de Bardo; nunca por el mero hecho de usar Carisma." : "Se aplica a los conjuros del portador; no a la CD de rasgos que no sean conjuros.", pendingAutomation: [] } : { mode: "assisted", handler: "equipment-text-assistance", explanation: "El botón registra el uso diario del objeto. Resolver el rasgo de clase descrito, sin volver a gastar el recurso normal cuando el amuleto lo exime.", pendingAutomation: [drum ? "Recuperar un uso en la reserva concreta de Inspiración bárdica; en fichas antiguas debe identificarse primero esa reserva." : "Elegir y resolver un efecto de Canalizar divinidad sin descontar el uso de clase; el contador del objeto es independiente."] } });
    d.capabilities = [
      makeCap("spellcasting-bonus", "Bonificación de conjuros +1", "passive", [
        { id: "attack-bonus", kind: "bonus", target: drum ? "bard-spell-attack" : "spell-attack", operation: "add", value: 1, condition: text[0] },
        { id: "save-bonus", kind: "bonus", target: drum ? "bard-spell-save-dc" : "spell-save-dc", operation: "add", value: 1, condition: text[0] },
      ], "tasha-rule-0"),
      makeCap("daily-property", drum ? "Recuperar Inspiración bárdica" : "Registrar Canalizar divinidad gratuito", drum ? "action" : "other", [{ id: "class-resource", kind: "unmodeled", condition: "", explanation: text[1], original: { index, importedDescription: row.payload.description } }], "tasha-rule-1", [{ resourceId: "daily-property", amount: 1 }]),
    ];
    d.review = { identity: true, information: false, editorial: false, mechanics: false, unresolved: ["Objeto oficial de Tasha identificado. Falta cotejar íntegramente el texto del libro y obtener o acreditar la traducción española oficial; el artículo público confirma identidad y beneficios generales.", "La propiedad diaria registra el gasto del objeto; la resolución del recurso de clase sigue asistida.", "Conservar originales y cerrar su cobertura antes de eliminar versiones."] };
    definitions.push({ key: row.content_key, before: row, origin: "official", tags: ["es", "reglas_2014", "tasha", "cotejo_textual_pendiente"], definition: EquipmentDefinitionDraftSchema.parse(d) });
  }
} finally { await server.close(); }

const retired = snapshot.pending.filter((r) => /^(armor-of-(invulnerability|vulnerability)-|berserker-halberd$|vorpal-shortsword$|shortsword-of-sharpness$|vicious-net$|belt-of-giant-strength$)/.test(r.payload.index));
assert.equal(retired.length, 15);
const remaining = snapshot.pending.filter((r) => !retired.includes(r) && !definitions.some((d) => d.key === r.content_key));
assert.equal(remaining.length, 8);
const plan = { revision: snapshot.revision, definitions, retired, remaining: remaining.map((r) => ({ key: r.content_key, name: r.name, index: r.payload.index })) };
writeFileSync(`${root}/official-resolution-plan.json`, JSON.stringify(plan));
writeFileSync("docs/v2/equipment-preparation-2026-10-17/official-resolution-definitions.json", JSON.stringify(definitions.map((d) => d.definition), null, 2));
console.log(JSON.stringify({ retired: retired.length, officialUpdates: 2, concreteBelts: 6, campaignEntriesRemaining: remaining.length, beltTable: table.rows }));
