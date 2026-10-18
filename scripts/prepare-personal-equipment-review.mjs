/** Preserve inventory-only variants and recover authored descriptions from campaign sources. */
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "vite";
import assert from "node:assert/strict";
const root = "tmp/equipment-definitions", read = (file) => JSON.parse(readFileSync(`${root}/${file}`, "utf8"));
const snapshot = read("owned-priority-current.json"), work = read("owned-priority-worklist.json"), catalog = read("real-drafts-owned-reviewed.json"), document = read("personal-campaign-sources.json");
const sourceIndex = new Map(catalog.map((record) => {
  const primary = record.payload.originals.find((entry) => record.payload.definition.id === `recovery:${entry.originalKey}`);
  return [primary?.raw.payload?.index, record.payload.definition];
}));
const genericAliases = new Map([["Bolsa de monedas", "pouch"], ["Disfraz para actuaciones", "clothes-costume"], ["Estuche para documentos", "case-map-or-scroll"]]);
const sections = [
  ["Draven Korr", "Armadura de campo Korr", "t.z7fu61spitpl", "Armadura de Campo Korr\n", "\nArma Secundaria"],
  ["Draven Korr", "Monóculo analítico", "t.z7fu61spitpl", "Monóculo Analítico\n", "\nEquipo de Ingeniero"],
  ["Draven Korr", "Kit de exploración de ruinas", "t.z7fu61spitpl", "Kit de Exploración de Ruinas\n", "\nEquipo de Expedición"],
  ["Draven Korr", "Núcleo luciente fragmentado", "t.z7fu61spitpl", "Núcleo Luciente Fragmentado\n", null],
  ["Draven Korr", "Bomba incendiaria experimental", "t.z7fu61spitpl", "Equipo Anti-Troll\n", "\nObjeto Narrativo"],
  ["Maelion Vaelaris", "Laúd de los Ecos Profundos (Laúd de Doss)", "t.3vku63g53u9", "Laúd de los Ecos Profundos\n", "\nArmadura"],
  ["Maelion Vaelaris", "Diario de campo de Vaelaris", "t.3vku63g53u9", "Diario de Campo de Vaelaris\n", "\nKit de Calígrafo"],
  ["Maelion Vaelaris", "Fragmento de cristal luciente negro", "t.3vku63g53u9", "Fragmento de Cristal Luciente Negro\n", null],
  ["Garrick Vhal", "Fragmento de Acero Ancestral", "t.amb62zaa8wqa", "Fragmento de Acero Ancestral\n", null],
];
function excerpt(copy) {
  const binding = sections.find(([owner, name]) => owner === copy.owner && name === copy.value.name);
  if (!binding) return null;
  const tab = document.tabs.find((tab) => tab.tabId === binding[2]); assert.ok(tab);
  const start = tab.text.indexOf(binding[3]); assert.ok(start >= 0);
  const end = binding[4] ? tab.text.indexOf(binding[4], start) : tab.text.length; assert.ok(end > start);
  return { documentId: document.documentId, revisionId: document.revisionId, tabId: tab.tabId, title: document.title, text: tab.text.slice(start, end).trim() };
}
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
const preparations = [], plans = [];
try {
  const { captureEquipmentSource, verifyEquipmentSource } = await server.ssrLoadModule("/src/domain/equipment/equipment-recovery.ts");
  const { preparationFromOriginals, EquipmentPreparationPayloadSchema } = await server.ssrLoadModule("/src/domain/equipment/equipment-preparation.ts");
  const { SRD_51_ATTRIBUTION } = await server.ssrLoadModule("/src/domain/equipment/equipment-attribution.ts");
  for (const copy of work.unresolved) {
    const alias = genericAliases.get(copy.value.name), generic = alias ? sourceIndex.get(alias) : null;
    if (generic) {
      plans.push({ owner: copy.owner, itemId: copy.id, name: copy.value.name, decision: "generic-base-with-personal-name", definitionId: generic.id, explanation: "Identidad ordinaria reconocida; conservar nombre, estado y todos los campos de la copia. Todavía no se migra.", applied: false });
      continue;
    }
    const fragment = snapshot.characters.find((row) => row.fragment_kind === "character-inventory" && row.parent_id === copy.ownerId && row.entity_id === copy.id); assert.ok(fragment);
    const original = await captureEquipmentSource("ECE-inventory", `${copy.ownerId}:${copy.id}`, snapshot.captured_at, fragment);
    const authored = excerpt(copy), originals = [original];
    if (authored) originals.push(await captureEquipmentSource("campaign-document-excerpt", `${authored.documentId}:${authored.tabId}:${copy.id}`, new Date().toISOString(), authored));
    const record = preparationFromOriginals(`personal:${copy.ownerId}:${copy.id}`, original, originals, fragment.campaign_id);
    const value = record.payload.definition, inventory = copy.value;
    value.name = `${inventory.name} · ${copy.owner}`; value.aliases = [inventory.name];
    value.subtypes = ["personal-variant"];
    value.origin = "campaign"; value.category = ["weapon", "armor", "shield", "ammunition", "tool", "wondrous-item", "adventuring-gear"].includes(inventory.category) ? inventory.category : "adventuring-gear";
    value.consumable = inventory.consumable; value.properties = inventory.properties;
    value.requirements = { attunement: inventory.requiresAttunement, bearer: [], presence: "other", explanation: "Estado de la regla existente; no se infieren equipo, sintonización actual ni nuevos requisitos por el nombre." };
    value.magical = inventory.requiresAttunement ? true : null; value.rarity = null; value.weight = null;
    value.description = [];
    const sourceId = "ece-current-copy";
    value.sources.push({ id: sourceId, kind: "campaign", title: `ECE · posesión de ${copy.owner}`, language: "es", rulesEdition: "2014", locator: `${copy.ownerId}:${copy.id}`, verified: true });
    const placeholder = !inventory.description?.trim() || inventory.description === "Equipo descrito en la ficha de campaña.";
    if (!placeholder) value.description.push({ id: "current-description", type: "paragraph", section: "description", provenance: "campaign", sourceIds: [sourceId], text: inventory.description });
    const notes = ["Variante personal recuperada: no trasladar reglas o nombres propios a otros personajes por coincidencia de nombre.", "Peso y precio cero de una copia incompleta no se convierten en estadísticas oficiales ni en gratuidad. El estado original se conserva íntegro."];
    if (authored) {
      const authoredId = "ece-campaign-document";
      value.sources.push({ id: authoredId, kind: "campaign", title: "Notas de Campaña · descripción original del objeto", language: "es", rulesEdition: "2014", locator: `https://docs.google.com/document/d/${authored.documentId}/edit?tab=${authored.tabId} · revisión ${authored.revisionId}`, verified: true });
      value.description.push({ id: "recovered-campaign-description", type: "paragraph", section: "flavor", provenance: "campaign", sourceIds: [authoredId], text: authored.text });
    }
    const isDoss = inventory.name.includes("Laúd de Doss");
    const isBag = inventory.name === "Bolsa conservadora (Bolsa de contención replicada)";
    if (isDoss) {
      value.requirements = { attunement: true, bearer: [{ kind: "class", keys: ["bard"], explanation: "Requisito de los Instrumentos de los Bardos." }], presence: "held", explanation: "Requiere sintonización por un bardo y tocar el instrumento para sus conjuros." };
      value.magical = true; value.rarity = "uncommon";
      value.sources.push({ id: "dndbeyond-bard-2022", kind: "book", title: "D&D Beyond · Bard 201: The Best Magic Items for Bards (2022)", language: "en", rulesEdition: "2014", locator: "https://www.dndbeyond.com/posts/1186-bard-201-the-best-magic-items-for-bards · apartado 5", verified: true });
      value.description.push({ id: "doss-source-status", type: "paragraph", section: "gm-notes", provenance: "campaign", sourceIds: [sourceId], text: "Se conserva la decisión ya aplicada en la ficha: Laúd de Doss poco común, sin +2 a ataques de conjuro. La descripción original de campaña decía raro y +2; se recupera como antecedente, no se reinstala ese bono. La fuente oficial pública confirma sintonización por bardo y cuatro conjuros comunes (Volar, Invisibilidad, Levitar y Protección contra el bien y el mal), pero no ofrece aquí toda la regla específica de Doss." });
      notes.push("Falta cotejar la regla íntegra específica del Laúd de Doss en una fuente oficial accesible. No convertir la carga única antigua en usos compartidos ni añadir conjuros a partir de un foro.");
    }
    if (isBag) {
      const section = JSON.parse(readFileSync("tmp/pdfs/srd-magic-items.json", "utf8")).find((entry) => entry.name === "Bolsa de contención"); assert.ok(section);
      const lines = section.lines.filter((line) => !line.fonts.every((font) => font.includes("Italic")) && line.size > 8.5);
      const paragraphs = []; let paragraph = "";
      for (const line of lines) { if (/^\s+\S/.test(line.text) && paragraph) { paragraphs.push(paragraph.replace(/\s+/g, " ").trim()); paragraph = ""; } paragraph += " " + line.text; }
      if (paragraph.trim()) paragraphs.push(paragraph.replace(/\s+/g, " ").trim());
      value.sources.push({ id: "srd-5.1-es-equipment", kind: "srd", title: "SRD 5.1 · Wizards of the Coast LLC · español oficial", language: "es", rulesEdition: "2014", locator: "https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1_ES.pdf · página PDF 237 · CC BY 4.0", verified: true }, { id: "srd-5.1-attribution", kind: "srd", title: "Atribución y licencia del SRD 5.1", language: "es", rulesEdition: "2014", locator: SRD_51_ATTRIBUTION, verified: true });
      value.description.push(...paragraphs.map((text, index) => ({ id: `bag-official-${index}`, type: "paragraph", section: "rules", provenance: "official-spanish", sourceIds: ["srd-5.1-es-equipment"], text })));
      value.magical = true; value.rarity = "uncommon"; value.weight = { value: 7.5, unit: "kg" };
      notes.push("La bolsa replicada conserva su procedencia de infusión por copia. El catálogo no concede ni reproduce por sí mismo infusiones de artífice.");
    }
    if (!value.description.length) value.description.push({ id: "missing-authored-rule", type: "paragraph", section: "gm-notes", provenance: "campaign", sourceIds: [sourceId], text: `La ficha registra «${inventory.name}». No aporta una descripción propia ni una regla mecánica completa. Se conserva como pertenencia de campaña sin atribuirle poderes no documentados.` });
    if (inventory.name === "Kit de exploración de ruinas") notes.push("Se recuperó la composición: cinceles, martillos finos, cepillos, cuerdas y poleas. No se duplica ese contenido como objetos sueltos.");
    if (inventory.name === "Cuerda de seda (30 m)") notes.push("La longitud declarada es el doble que la cuerda de seda de 50 pies del manual. No se trata como la misma unidad ni se corrigen automáticamente precio, peso o cantidad.");
    if (inventory.name === "Símbolo sagrado") notes.push("Puede ser amuleto, emblema o relicario. No se elige automáticamente una presentación física distinta.");
    if (/Flecha (incendiaria|de plata|con cuerda)/.test(inventory.name)) notes.push("No se sustituye esta variante por una flecha normal. La fuente de campaña enumera el contenido, pero no define completamente las reglas de esta munición.");
    if (inventory.name === "Armadura de campo Korr") notes.push("La fuente dice Armadura +1, pero la configuración actual tiene la base e infusiones bloqueadas. No se duplica la CA ni se reactivan infusiones durante esta recuperación.");
    if (inventory.name === "Monóculo analítico") notes.push("«Basado en Gafas de Identificación» no identifica por sí solo un objeto oficial ni define alcance, acción, ritual o usos. Conservar su función narrativa sin conceder Identificar ilimitado.");
    const narrativeOnly = /sin (propiedades mecánicas|bonificación mecánica)|reliquia del clan/i.test(inventory.description) || ["Fragmento de cristal luciente negro", "Fragmento de Acero Ancestral", "Núcleo luciente fragmentado", "Diario de campo de Vaelaris", "Kit de exploración de ruinas"].includes(inventory.name);
    value.capabilities = [];
    if (!narrativeOnly) value.capabilities.push({ id: "preserved-personal-rule", name: "Reglas de la variante personal", activation: "other", trigger: "", requirements: value.requirements, target: "", range: "", duration: "", concentration: false, costs: [], consumeQuantity: 0,
      effects: [{ id: "raw-rule", kind: "unmodeled", condition: "", explanation: "Conservar y completar las reglas particulares sin sustituirlas por otro objeto de nombre parecido.", original: structuredClone(inventory) }],
      execution: { mode: "unsupported", handler: null, explanation: "La información recuperada todavía no habilita una ejecución completa del formato nuevo.", pendingAutomation: ["Resolver condiciones y efectos propios de esta variante antes de ejecutar o migrar."] }, textBlockIds: value.description.map((block) => block.id) });
    if (narrativeOnly) value.description.push({ id: "narrative-rule", type: "paragraph", section: "gm-notes", provenance: "campaign", sourceIds: [sourceId], text: "Se conserva su uso narrativo documentado. No se atribuyen bonificadores, poderes, inmunidades al frío ni recursos adicionales por el nombre." });
    value.review = { identity: true, information: false, editorial: Boolean(authored || !placeholder), mechanics: narrativeOnly, unresolved: notes };
    const parsed = EquipmentPreparationPayloadSchema.parse(record.payload); assert.deepEqual(parsed, record.payload);
    for (const archive of originals) assert.ok(await verifyEquipmentSource(archive));
    preparations.push(record); plans.push({ owner: copy.owner, itemId: copy.id, name: inventory.name, decision: "preserved-personal-variant", definitionId: value.id, recoveredCampaignText: Boolean(authored), narrativeOnly, missingRuleText: placeholder && !authored, applied: false });
  }
} finally { await server.close(); }
writeFileSync(`${root}/personal-preparations.json`, JSON.stringify(preparations));
writeFileSync("docs/v2/equipment-preparation-2026-10-17/inventory-only-review.json", JSON.stringify(plans, null, 2));
writeFileSync("docs/v2/equipment-preparation-2026-10-17/inventory-only-definitions.json", JSON.stringify(preparations.map((record) => record.payload.definition), null, 2));
console.log(JSON.stringify({ copiesReviewed: plans.length, genericIdentities: plans.filter((entry) => entry.decision === "generic-base-with-personal-name").length, personalVariants: preparations.length, recoveredCampaignDescriptions: plans.filter((entry) => entry.recoveredCampaignText).length, migratedCopies: 0 }));
