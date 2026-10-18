/** Source-led review of equipment actually owned in ECE. Never edits a character or stock. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createServer } from "vite";
import assert from "node:assert/strict";
import { reviewCampaignItem } from "./review-campaign-equipment-rules.mjs";
const root = "tmp/equipment-definitions", read = (file) => JSON.parse(readFileSync(file, "utf8"));
const drafts = read(`${root}/real-drafts-reviewed.json`), work = read(`${root}/owned-priority-worklist.json`);
const bindings = read("docs/v2/equipment-preparation-2026-10-17/used-source-bindings.json");
const bases = read("src/domain/character/phb-srd-equipment.json");
const tablePages = read("tmp/pdfs/srd-en-equipment-rows.json"), magic = read("tmp/pdfs/srd-magic-items.json"), prose = read("tmp/pdfs/srd-mundane-prose.json");
const token = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const clean = (s) => s.replace(/\s+/g, " ").trim();
const ES = "https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1_ES.pdf";
const EN = "https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf";
const source = (language, page) => ({ id: `srd-5.1-${language}-equipment`, kind: "srd", title: `Documento de referencia del sistema 5.1 · ${language === "es" ? "edición oficial española" : "original inglés"}`, language, rulesEdition: "2014", locator: `${language === "es" ? ES : EN} · página PDF ${page} · CC-BY-4.0`, verified: true });
const qPrice = (text) => { const m = text.match(/^([\d,.]+)\s+(cp|sp|ep|gp|pp)$/i); return m ? { quantity: Number(m[1].replaceAll(",", "")), unit: m[2].toLowerCase() } : null; };
const weight = (text) => {
  if (/^[—–-]$/.test(text)) return null;
  const value = text.replace(/\s*\(full\)$/, "").replace(/\s*lb\.?$/, "").trim().replace("½", ".5").replace("¼", ".25");
  const fraction = value.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
  if (fraction && Number(fraction[3]) > 0) return { value: Number(fraction[1] ?? 0) + Number(fraction[2]) / Number(fraction[3]), unit: "lb" };
  if (Number.isFinite(Number(value))) return { value: Number(value), unit: "lb" };
  throw new Error(`Unknown official weight: ${text}`);
};
function table(binding, base) {
  const found = [];
  for (const page of tablePages) for (const row of page.rows) {
    const wide = Boolean(base?.weapon_category || base?.armor_category);
    const groups = wide ? [row.cells] : [row.cells.filter((c) => c.x < 300), row.cells.filter((c) => c.x >= 300)];
    for (const cells of groups) if (cells.length >= 3 && token(cells[0].text) === token(binding[1])) {
      const price = qPrice(cells[1].text); if (!price) continue;
      found.push({ page: page.page, cells: cells.map((c) => c.text), price, weight: weight(cells[base?.weapon_category ? 3 : base?.armor_category ? 5 : 2].text) });
    }
  }
  assert.equal(found.length, 1, `Official table row: ${binding[1]}`); return found[0];
}
function textBlocks(section, id, sourceId) {
  const lines = section.lines.filter((line) => line.size > 8.5);
  const metadata = []; let cursor = 0;
  while (cursor < lines.length && lines[cursor].fonts.every((font) => font.includes("Italic"))) metadata.push(lines[cursor++].text);
  const paragraphs = []; let paragraph = "";
  for (const line of lines.slice(cursor)) {
    if (/^\s+\S/.test(line.text) && paragraph) { paragraphs.push(clean(paragraph)); paragraph = ""; }
    paragraph += " " + line.text;
  }
  if (paragraph.trim()) paragraphs.push(clean(paragraph));
  return { metadata: clean(metadata.join(" ")), blocks: paragraphs.map((text, index) => ({ id: `${id}-${index}`, type: "paragraph", section: "rules", provenance: "official-spanish", sourceIds: [sourceId], text })) };
}
function requirements(attunement, presence = "possessed", bearer = []) { return { attunement, bearer, presence, explanation: attunement ? "La sintonización y restricciones se aplican a los poderes mágicos, no a la mera posesión ni al uso mundano de un arma." : "No requiere sintonización." }; }
function capability(value, id, name, effects, extra = {}) {
  return { id, name, activation: "passive", trigger: "", requirements: structuredClone(value.requirements), target: "Portador", range: "", duration: "Mientras se cumplen los requisitos.", concentration: false, costs: [], consumeQuantity: 0,
    effects: effects.map((effect, index) => ({ id: `${id}-${index}`, condition: "", ...effect })), execution: { mode: "unsupported", handler: null, explanation: "Regla cotejada. Falta conectar y probar su ejecución con el formato nuevo; no modifica las copias actuales.", pendingAutomation: ["Aplicar y retirar los efectos al cambiar los requisitos, sin duplicar los de la copia antigua."] }, textBlockIds: value.description.filter((block) => block.section === "rules").map((block) => block.id), ...extra };
}
function resource(id, maximum, recovery = { kind: "none" }, unit = "usos") { return { id, name: id, kind: "uses", maximum, unit, recovery, exhaustion: "No se puede activar sin el recurso necesario." }; }
const dawn = (amount = { kind: "full" }) => ({ kind: "event", event: "dawn", explanation: "Al siguiente amanecer, no al terminar un descanso.", amount });
const effect = (kind, rest) => ({ kind, ...rest });
const damageLabels = { acid: "ácido", bludgeoning: "contundente", cold: "frío", fire: "fuego", force: "fuerza", lightning: "relámpago", necrotic: "necrótico", piercing: "perforante", poison: "veneno", psychic: "psíquico", radiant: "radiante", slashing: "cortante", thunder: "trueno" };
const propertyLabels = { ammunition: "Munición", finesse: "Sutil", heavy: "Pesada", light: "Ligera", loading: "Recarga", reach: "Gran alcance", special: "Especial", thrown: "Arrojadiza", "two-handed": "A dos manos", versatile: "Versátil", magic: "Mágica" };
function baseProfile(value, base, row, bonus = 0) {
  value.weight = row.weight; value.properties = (base.properties ?? []).map((p) => p.index).filter((p) => p !== "monk");
  if (base.weapon_category) {
    const damage = (data, timing, id) => ({ id, kind: "damage", condition: "", expression: data.damage_dice, damageType: data.damage_type.index, timing });
    const reach = value.properties.includes("reach") ? 10 : 5;
    value.category = "weapon"; value.weapon = { category: base.weapon_category.toLowerCase(), meleeReachFeet: base.weapon_range === "Melee" ? reach : null,
      thrown: value.properties.includes("thrown"), rangeFeet: base.throw_range ? { normal: base.throw_range.normal, long: base.throw_range.long ?? null } : base.weapon_range === "Ranged" ? { normal: base.range.normal, long: base.range.long ?? null } : null,
      attackBonus: bonus, damageBonus: bonus, baseDamage: [damage(base.damage, "base", "base-damage"), ...(base.two_handed_damage ? [damage(base.two_handed_damage, "versatile", "versatile-damage")] : [])] };
    assert.ok(row.cells[2].includes(base.damage.damage_dice), `Damage mismatch: ${base.index}`);
  }
  if (base.armor_category) {
    const ac = base.armor_class;
    value.category = base.armor_category === "Shield" ? "shield" : "armor";
    value.armor = { category: base.armor_category.toLowerCase(), baseArmorClass: ac.base,
      dexterity: ac.dex_bonus ? ac.max_bonus == null ? "full" : "capped" : "none", dexterityCap: ac.max_bonus ?? null,
      strengthMinimum: base.str_minimum || null, stealthDisadvantage: base.stealth_disadvantage, armorClassBonus: bonus };
    assert.equal(parseInt(row.cells[2], 10), ac.base, `AC mismatch: ${base.index}`);
  }
}
const changed = [], pending = [], corrections = [];
for (const item of work.definitions) {
  const record = drafts.find((draft) => draft.payload.definition.id === item.id); assert.ok(record);
  const original = structuredClone(record.payload), value = record.payload.definition;
  const old = value.name;
  let baseIndex = item.index, enhancement = 0, special = "";
  if (/^vicious-/.test(baseIndex ?? "")) { baseIndex = baseIndex.slice(8); special = "vicious"; }
  if (baseIndex === "flame-tongue-greatsword") { baseIndex = "greatsword"; special = "flame-tongue"; }
  const enhanced = baseIndex?.match(/^(.*)-([123])$/);
  if (enhanced && bindings.mundane[enhanced[1]]) { baseIndex = enhanced[1]; enhancement = Number(enhanced[2]); }
  if (item.index === "plate-mail-1") { baseIndex = "plate-armor"; enhancement = 1; }
  if (item.index === "studded-leather-1") { baseIndex = "studded-leather-armor"; enhancement = 1; }
  let supported = false, campaignReview = null;
  if (bindings.mundane[baseIndex]) {
    const binding = bindings.mundane[baseIndex], base = bases.find((base) => base.index === baseIndex);
    const row = table(binding, base);
    value.name = binding[0] + (enhancement ? ` +${enhancement}` : special === "vicious" ? " feroz" : special === "flame-tongue" ? " de lengua de fuego" : "");
    value.origin = "official"; value.sources.push(source("es", base?.weapon_category ? 67 : base?.armor_category ? 65 : "63–83 (sección Equipo)"), source("en", row.page));
    value.category = /tools|supplies|herbalism|dice-set/.test(baseIndex) ? "tool" : ["arrow", "crossbow-bolt", "blowgun-needle"].includes(baseIndex) ? "ammunition" : baseIndex === "saddlebags" ? "tack" : "adventuring-gear";
    value.magical = Boolean(enhancement || special); value.rarity = value.magical ? "uncommon" : "none"; value.consumable = ["acid-vial", "antitoxin-vial", "alchemists-fire-flask", "oil-flask", "torch", "rations-1-day", "ink-1-ounce-bottle"].includes(baseIndex);
    value.requirements = requirements(false); value.resources = []; value.capabilities = []; value.weapon = null; value.armor = null;
    value.economy = { basePrice: value.magical ? null : row.price, campaignPrice: null, explanation: value.magical ? "La regla no fija un precio de venta de esta variante mágica. Los precios anteriores permanecen conservados como evidencia y no se aplican a las tiendas." : "Precio oficial de 2014. No sobrescribe precios propios de personajes o comerciantes." };
    value.weight = row.weight;
    if (base) baseProfile(value, base, row, enhancement);
    const bundles = { arrow: 20, "crossbow-bolt": 20, "blowgun-needle": 50, "spike-iron": 10 };
    if (bundles[baseIndex]) {
      const count = bundles[baseIndex], copper = row.price.quantity * ({ cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 }[row.price.unit]);
      value.weight = row.weight ? { value: row.weight.value / count, unit: "lb" } : null;
      value.economy.basePrice = { quantity: copper / count, unit: "cp" };
      value.economy.explanation = `La tabla vende ${count} unidades juntas; el precio y el peso estructurados corresponden a una sola unidad. Las cantidades poseídas no cambian.`;
    }
    const stats = [value.name, `${row.price.quantity} ${{ cp: "pc", sp: "pp", ep: "pe", gp: "po", pp: "ppt" }[row.price.unit]}`, row.weight ? `${row.weight.value} lb${row.cells.some((cell) => cell.includes("(full)")) ? " (llena)" : ""}` : "—"];
    value.description = [{ id: "official-table", type: "table", section: "description", provenance: "reviewed-translation", sourceIds: ["srd-5.1-en-equipment"], columns: ["Objeto", "Precio de la fila original", "Peso de la fila original"], rows: [stats] }];
    if (value.magical) value.description[0].rows[0][1] += " (solo objeto mundano base; no es el precio de la variante mágica)";
    if (value.weapon) value.description[0].columns.push("Daño base", "Propiedades", "Bonificación mágica"), value.description[0].rows[0].push(`${base.damage.damage_dice} ${damageLabels[base.damage.damage_type.index]}`, value.properties.map((key) => propertyLabels[key] ?? key).join(", "), `+${enhancement}`);
    if (value.weapon?.rangeFeet) value.description[0].columns.push("Alcance normal/largo (pies)"), value.description[0].rows[0].push(`${value.weapon.rangeFeet.normal}/${value.weapon.rangeFeet.long ?? "—"}`);
    if (base?.two_handed_damage) value.description[0].columns.push("Daño a dos manos (versátil)"), value.description[0].rows[0].push(`${base.two_handed_damage.damage_dice} ${damageLabels[base.two_handed_damage.damage_type.index]}`);
    if (bundles[baseIndex]) value.description[0].columns.push("Unidades por paquete", "Peso por unidad (lb)", "Precio por unidad (pc)"), value.description[0].rows[0].push(String(bundles[baseIndex]), String(value.weight?.value ?? "—"), String(value.economy.basePrice.quantity));
    if (value.armor) value.description[0].columns.push("CA base", "Bonificación mágica", "Fuerza mínima", "Sigilo"), value.description[0].rows[0].push(String(value.armor.baseArmorClass), `+${enhancement}`, String(value.armor.strengthMinimum ?? "—"), value.armor.stealthDisadvantage ? "Desventaja" : "Sin desventaja por esta armadura");
    const section = binding[2] ? prose.find((section) => section.name === binding[2]) : null;
    if (binding[2]) assert.ok(section, `Spanish prose missing: ${binding[2]}`);
    if (section) { value.description.push(...textBlocks(section, "official-rules", "srd-5.1-es-equipment").blocks); value.sources.find((s) => s.id === "srd-5.1-es-equipment").locator = `${ES} · página PDF ${section.page} · CC-BY-4.0`; }
    if (enhancement || special) {
      const heading = special === "vicious" ? null : special === "flame-tongue" ? "Lengua de fuego" : value.armor ? value.category === "shield" ? "Escudo +1, +2 o +3" : "Armadura +1, +2 o +3" : "Arma +1, +2 o +3";
      if (heading) { const section = magic.find((s) => s.name === heading); assert.ok(section); value.description.push(...textBlocks(section, "official-enchantment", "srd-5.1-es-equipment").blocks); value.sources.find((s) => s.id === "srd-5.1-es-equipment").locator += `; regla mágica página ${section.page}`; }
      value.rarity = special ? "rare" : value.armor && value.category !== "shield" ? [null, "rare", "very-rare", "legendary"][enhancement] : [null, "uncommon", "rare", "very-rare"][enhancement];
      if (special === "vicious") {
        value.sources.push({ id: "dmg-2014-vicious", kind: "book", title: "Dungeon Master’s Guide (2014) · Vicious Weapon", language: "en", rulesEdition: "2014", locator: "https://www.dndbeyond.com/magic-items/5399-vicious-weapon · Legacy", verified: true });
        value.description.push({ id: "vicious-2014", type: "paragraph", section: "rules", provenance: "reviewed-translation", sourceIds: ["dmg-2014-vicious"], text: "Cuando sacas un 20 en la tirada de ataque con esta arma mágica, el objetivo recibe 7 puntos de daño adicional del tipo de daño del arma." });
        value.description.push({ id: "vicious-source-difference", type: "paragraph", section: "gm-notes", provenance: "reviewed-translation", sourceIds: ["dmg-2014-vicious"], text: "Se conserva la regla del manual de 2014: 7 puntos con un 20 natural. El SRD 5.1 ofrece otra formulación, 2d6; no se aplica esa diferencia a la campaña." });
        value.capabilities.push(capability(value, "vicious-natural-20", "Daño adicional con un 20 natural", [effect("damage", { expression: "7", damageType: base.damage.damage_type.index, timing: "critical", condition: "Únicamente si el d20 de ataque muestra un 20 natural; no se duplica esta cantidad fija ni basta un crítico con 19." })], { activation: "trigger", trigger: "Un 20 natural en la tirada de ataque." }));
      }
      if (special === "flame-tongue") {
        value.requirements = requirements(true, "held");
        value.capabilities.push(capability(value, "flaming-toggle", "Encender o apagar la hoja", [effect("narrative", { instructions: "Pronuncia la palabra de activación como acción adicional para encender o apagar la hoja. Encendida, emite luz brillante a 40 pies y tenue otros 40 pies. Las llamas se apagan al soltarla o envainarla." })], { activation: "bonus-action" }));
        value.capabilities.push(capability(value, "flaming-hit", "Daño con la hoja encendida", [effect("damage", { expression: "2d6", damageType: "fire", timing: "on-hit", condition: "La hoja está encendida mediante su palabra de activación y el ataque impacta." })], { activation: "trigger", trigger: "Impactar mientras las llamas están activas." }));
      }
    }
    if (section && !value.capabilities.length && !value.weapon && !value.armor) value.capabilities.push(capability(value, "mundane-use", "Uso del objeto", [effect("unmodeled", { explanation: "Texto de uso oficial completo conservado; falta estructurar sus condiciones particulares.", original: { sourcePage: section.page, text: value.description.filter((block) => block.type === "paragraph").map((block) => block.text).join("\n\n") } })]));
    supported = true;
  } else if (bindings.magic[item.index]) {
    const section = magic.find((entry) => entry.name === bindings.magic[item.index]); assert.ok(section);
    const parsed = textBlocks(section, "official-magic", "srd-5.1-es-equipment");
    value.sources.push(source("es", section.page)); value.origin = "official"; value.name = section.name; value.magical = true;
    value.description = parsed.blocks; value.resources = []; value.capabilities = []; value.weapon = null; value.armor = null; value.properties = ["magic"]; value.weight = null;
    const rarities = [["muy rar", "very-rare"], ["legendari", "legendary"], ["infrecuente", "uncommon"], ["rar", "rare"], ["común", "common"]];
    value.rarity = rarities.find(([text]) => parsed.metadata.includes(text))?.[1] ?? null;
    value.category = parsed.metadata.startsWith("Anillo") ? "ring" : parsed.metadata.startsWith("Bastón") ? "staff" : parsed.metadata.startsWith("Poción") ? "potion" : "wondrous-item";
    value.consumable = value.category === "potion" || item.index === "dust-of-disappearance";
    value.requirements = requirements(parsed.metadata.includes("requiere"), ["pearl-of-power", "tome-of-understanding"].includes(item.index) ? "possessed" : value.category === "potion" ? "held" : "worn");
    value.economy = { basePrice: null, campaignPrice: null, explanation: "La regla no fija precio de venta. Los precios antiguos y personalizaciones permanecen en sus originales; no se alteran tiendas ni copias." };
    let effects = [];
    if (["amulet-of-health", "headband-of-intellect"].includes(item.index)) effects = [effect("bonus", { target: item.index === "amulet-of-health" ? "constitution" : "intelligence", operation: "minimum", value: 19, condition: "Solo si la puntuación natural es inferior a 19 y se cumplen equipo y sintonización." })];
    if (item.index === "boots-of-elvenkind") effects = [effect("defense", { defense: "advantage", target: "dexterity-stealth", condition: "Solo las pruebas de Destreza (Sigilo) basadas en moverse silenciosamente." })];
    if (item.index === "amulet-of-proof-against-detection-and-location") effects = [effect("defense", { defense: "immunity", target: "divination-targeting", condition: "Oculto a magia de adivinación, incluida la detección por sensores de escudriñamiento; requiere llevar puesto y sintonizado el amuleto." })];
    if (item.index === "tome-of-understanding") effects = [effect("bonus", { target: "wisdom", operation: "add", value: 2, condition: "Tras estudiar 48 horas dentro de 6 días; aumento permanente." }), effect("bonus", { target: "wisdom-maximum", operation: "add", value: 2, condition: "Tras la misma lectura; también aumenta el máximo permitido." })];
    if (item.index.startsWith("potion-of-") && item.index !== "potion-of-poison") {
      const variant = { "potion-of-healing": ["Poción de curación", "common", "2d4+2"], "potion-of-greater-healing": ["Poción de curación mayor", "uncommon", "4d4+4"], "potion-of-superior-healing": ["Poción de curación superior", "rare", "8d4+8"] }[item.index];
      [value.name, value.rarity] = variant;
      // Keep the source's four-row table intact rather than flattening it into a paragraph.
      const tableStart = section.lines.findIndex((line) => line.text.trim() === "Pociones de curación");
      assert.ok(tableStart >= 0);
      value.description = textBlocks({ ...section, lines: section.lines.slice(0, tableStart) }, "official-magic", "srd-5.1-es-equipment").blocks;
      value.description.push({ id: "official-healing-table", type: "table", section: "rules", provenance: "official-spanish", sourceIds: ["srd-5.1-es-equipment"], columns: ["Poción de...", "Rareza", "PG recuperados"], rows: [["Curación", "Común", "2d4 + 2"], ["Curación mayor", "Infrecuente", "4d4 + 4"], ["Curación superior", "Rara", "8d4 + 8"], ["Curación suprema", "Muy rara", "10d4 + 20"]] });
      effects = [effect("healing", { expression: variant[2], target: "recipient", condition: "Al beber o recibir una dosis. No puede superar los puntos de golpe máximos." })];
      value.capabilities.push(capability(value, "drink-or-administer", "Beber o administrar", effects, { activation: "action", consumeQuantity: 1, duration: "Instantánea", target: "Receptor de la poción" }));
      if (item.index === "potion-of-healing") { value.economy.basePrice = { quantity: 50, unit: "gp" }; value.weight = { value: .5, unit: "lb" }; }
    } else if (item.index === "staff-of-withering") {
      value.requirements = requirements(true, "held", [{ kind: "class", keys: ["warlock", "cleric", "druid"], explanation: "Requisito oficial para sintonizarse: brujo, clérigo o druida." }]);
      const base = bases.find((entry) => entry.index === "quarterstaff"), row = table(bindings.mundane.quarterstaff, base); baseProfile(value, base, row); value.sources.push(source("en", row.page)); value.category = "staff";
      value.resources = [resource("cargas", 3, dawn({ kind: "roll", expression: "1d3" }), "cargas")];
      effects = [effect("damage", { expression: "2d10", damageType: "necrotic", timing: "on-hit", condition: "Al impactar con el bastón y gastar una carga." }), ...["strength-checks", "strength-saves", "constitution-checks", "constitution-saves"].map((target) => effect("defense", { defense: "disadvantage", target, condition: "Durante 1 hora si el objetivo falla una salvación de Constitución CD 15." }))];
      value.capabilities.push(capability(value, "withering-hit", "Marchitamiento", effects, { activation: "trigger", trigger: "Impactar con el bastón; gasto opcional de una carga.", costs: [{ resourceId: "cargas", amount: 1 }], duration: "1 hora para la desventaja; el daño es inmediato.", target: "Criatura alcanzada" }));
    } else if (item.index === "ring-of-spell-storing") {
      value.resources = [{ ...resource("almacenamiento", 5, { kind: "none" }, "niveles de conjuro"), kind: "spell-storage" }];
      value.capabilities.push(capability(value, "store-spells", "Almacenar un conjuro", [effect("storage", { resourceId: "almacenamiento", content: "spells", explanation: "Capacidad total de 5 niveles; cualquier criatura puede lanzar un conjuro de nivel 1 a 5 tocando el anillo, sin sintonizarse para cargarlo. El nivel del espacio gastado determina la capacidad ocupada. Si no cabe, el conjuro se gasta sin efecto. No hay recarga diaria ni se presume contenido a partir de cargas antiguas." })], { activation: "other", requirements: requirements(false, "other"), target: "El anillo, tocado al lanzar el conjuro", duration: "Hasta lanzar el conjuro almacenado." }));
      value.capabilities.push(capability(value, "cast-stored-spell", "Lanzar un conjuro almacenado", [effect("storage", { resourceId: "almacenamiento", content: "spells", explanation: "Requiere llevar puesto y sintonizado el anillo. Conserva nivel del espacio, CD, bonificador de ataque y aptitud del lanzador original; por lo demás se trata como si el portador lo lanzase. Lanzarlo libera la capacidad que ocupaba. Debe resolverse la concentración del conjuro concreto." })], { activation: "other", duration: "Según el conjuro almacenado.", concentration: "spell-dependent" }));
    } else {
      if (item.index === "pearl-of-power") {
        value.requirements = requirements(true, "possessed", [{ kind: "spellcaster", keys: [], explanation: "Requiere sintonización por un lanzador de conjuros." }]);
        value.resources = [resource("recuperacion-de-espacio", 1, dawn())];
      }
      if (item.index === "winged-boots") value.resources = [resource("vuelo", 240, { kind: "event", event: "other", explanation: "Recupera 120 minutos por cada 12 horas sin usarlas; cada vuelo gasta un mínimo de 1 minuto.", amount: { kind: "fixed", amount: 120 } }, "minutos")];
      if (item.index === "efficient-quiver") value.weight = { value: 1, unit: "kg" };
      if (item.index === "tome-of-understanding") value.resources = [resource("lectura-magica", 1, { kind: "event", event: "other", explanation: "Recupera su magia cuando pasa un siglo.", amount: { kind: "full" } })];
      if (item.index === "ring-of-djinni") value.resources = [resource("invocacion", 1, { kind: "event", event: "other", explanation: "Deben pasar 24 horas desde que el djinn se marcha; el anillo pierde la magia si el djinn muere.", amount: { kind: "full" } })];
      if (!effects.length) effects = [effect("unmodeled", { explanation: "La regla íntegra está cotejada en el texto oficial; falta estructurar su procedimiento completo para la aplicación.", original: { sourcePage: section.page, officialRule: value.description } })];
      value.capabilities.push(capability(value, "official-use", "Propiedades oficiales", effects, { ...(item.index === "pearl-of-power" ? { activation: "action", costs: [{ resourceId: "recuperacion-de-espacio", amount: 1 }] } : {}), ...(value.consumable ? { activation: "action", consumeQuantity: 1 } : {}) }));
    }
    supported = true;
  } else if (bindings.packages[item.index] || bindings.components[item.index]) {
    const component = bindings.components[item.index], packageIndex = component?.[1] ?? item.index;
    const section = prose.find((entry) => entry.name === bindings.packages[packageIndex]); assert.ok(section);
    value.sources.push(source("es", section.page)); value.origin = "official"; value.magical = false; value.rarity = "none"; value.category = "adventuring-gear"; value.consumable = false; value.requirements = requirements(false);
    value.name = component?.[0] ?? section.name.replace(/ \(.*$/, ""); value.description = textBlocks(section, "package-contents", "srd-5.1-es-equipment").blocks;
    value.weight = null; value.economy = { basePrice: component ? null : { quantity: Number(section.name.match(/\((\d+)/)[1]), unit: "gp" }, campaignPrice: null, explanation: component ? "El manual enumera este componente dentro del paquete; no le asigna aquí peso o precio individual ni un perfil de arma." : "El paquete conserva sus componentes, sin crearlos ni duplicarlos en el inventario." };
    value.resources = []; value.capabilities = []; value.weapon = null; value.armor = null; supported = true;
  } else if (item.index === "cloak-of-many-fashions") {
    value.origin = "official"; value.category = "wondrous-item"; value.magical = true; value.rarity = "common"; value.consumable = false;
    value.requirements = requirements(false, "worn"); value.resources = []; value.capabilities = []; value.weapon = null; value.armor = null; value.weight = null;
    value.sources.push({ id: "xge-provided-cloak", kind: "book", title: "Guía de Xanathar para todo (2017) · copia aportada por el usuario", language: "es", rulesEdition: "2014", locator: "PDF aportado: página 141, página impresa 140. La traducción oficial española no se acredita solo por el archivo aportado.", verified: false });
    value.description = [{ id: "cloak-rules", type: "paragraph", section: "rules", provenance: "reviewed-translation", sourceIds: ["xge-provided-cloak"], text: "Mientras llevas esta capa, puedes usar una acción adicional para cambiar su estilo, color y calidad aparente. Su peso no cambia y siempre sigue siendo una capa, cualquiera que sea su apariencia. Puede imitar el aspecto de otras capas mágicas, pero no adquiere sus propiedades mágicas." }];
    value.capabilities.push(capability(value, "change-cloak", "Cambiar el aspecto de la capa", [effect("narrative", { instructions: "Modificar únicamente estilo, color y calidad aparente; no cambia peso, tipo de prenda ni poderes." })], { activation: "bonus-action", execution: { mode: "narrative", handler: null, explanation: "Cambio de apariencia sin efectos numéricos ni consumo de recursos.", pendingAutomation: [] } }));
    value.economy = { basePrice: null, campaignPrice: null, explanation: "No se fija un precio a partir de la descripción." };
    campaignReview = { notes: ["Texto cotejado con la copia aportada; el enlace público oficial redirige a la edición nueva y no permitió cotejar allí el texto de 2017. Se mantiene esa limitación de procedencia."], identity: true }; supported = true;
  } else {
    campaignReview = reviewCampaignItem({ value, item, payload: record.payload, capability, resource, requirements, effect, dawn });
    supported = Boolean(campaignReview);
  }
  if (!supported) { pending.push(item); continue; }
  value.revision = original.definition.revision + 1;
  value.aliases = [...new Set([...value.aliases, old, ...record.payload.originals.map((source) => source.raw.name)].filter((name) => typeof name === "string" && name && name !== value.name))];
  value.sources = [...new Map(value.sources.map((s) => [s.id, s])).values()];
  value.properties = [...new Set([...value.properties, ...(value.magical ? ["magic"] : [])])];
  value.review = { identity: campaignReview?.identity ?? true, editorial: true, mechanics: !value.capabilities.some((c) => c.effects.some((e) => e.kind === "unmodeled")) && !campaignReview?.notes.length, information: false,
    unresolved: ["Cerrar la cobertura de los datos y diferencias antiguos antes de migrar o retirar versiones; las copias y precios comerciales siguen intactos.", ...(campaignReview?.notes ?? []), ...(item.uses.some((use) => use.ambiguous) ? ["Hay una copia con coincidencia de nombre ambigua. No se ha decidido automáticamente qué versión posee."] : [])] };
  // Earlier price/name decisions remain valid; weight/rule transformations receive a fresh review later.
  record.payload.decisions = record.payload.decisions.filter((decision) => !/^\/payload\/(weight|cost)/.test(decision.pointer));
  corrections.push({ id: value.id, from: old, to: value.name, index: item.index, uses: item.uses, textReviewed: true, mechanicsRepresented: value.review.mechanics, capabilities: value.capabilities.length, resources: value.resources.length });
  changed.push({ before: original, after: record.payload });
}
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { EquipmentPreparationPayloadSchema } = await server.ssrLoadModule("/src/domain/equipment/equipment-preparation.ts");
  const { verifyEquipmentSource } = await server.ssrLoadModule("/src/domain/equipment/equipment-recovery.ts");
  const { assessEquipmentRecovery } = await server.ssrLoadModule("/src/domain/equipment/equipment-recovery.ts");
  const { SRD_51_ATTRIBUTION } = await server.ssrLoadModule("/src/domain/equipment/equipment-attribution.ts");
  const seen = new Set();
  for (const item of changed) {
    if (item.after.definition.sources.some((source) => /^srd-5\.1-(es|en)-equipment$/.test(source.id))) item.after.definition.sources.push({ id: "srd-5.1-attribution", kind: "srd", title: "Atribución y licencia del SRD 5.1", language: "es", rulesEdition: "2014", verified: true, locator: `${SRD_51_ATTRIBUTION} Adaptaciones: separación de párrafos y tablas, datos estructurados y traducciones propias identificadas en cada bloque.` });
    assert.deepEqual(EquipmentPreparationPayloadSchema.parse(item.after), item.after);
    assert.deepEqual(item.after.originals, item.before.originals);
    for (const original of item.after.originals) if (!seen.has(original.id)) { assert.ok(await verifyEquipmentSource(original)); seen.add(original.id); }
    const recovery = await assessEquipmentRecovery(item.after.originals, item.after.decisions, new Map([[item.after.definition.id, item.after.definition]]));
    assert.deepEqual(recovery.issues, [], `Existing recovery decisions must remain valid: ${item.after.definition.name}`);
  }
} finally { await server.close(); }
writeFileSync(`${root}/owned-reviewed-drafts.json`, JSON.stringify(changed));
writeFileSync(`${root}/real-drafts-owned-reviewed.json`, JSON.stringify(drafts));
writeFileSync("docs/v2/equipment-preparation-2026-10-17/used-equipment-reviewed-definitions.json", JSON.stringify(changed.map((item) => item.after.definition), null, 2));
const report = { reviewedDefinitions: changed.length, characterCopies: work.characterCopies, merchantCopies: work.merchantCopies, reviewed: corrections, pendingCatalog: pending, unmatchedCopies: work.unresolved,
  sources: [{ url: ES, sha256: createHash("sha256").update(readFileSync("tmp/pdfs/srd-5.1-es.pdf")).digest("hex") }, { url: EN, sha256: createHash("sha256").update(readFileSync("tmp/pdfs/srd-5.1-en.pdf")).digest("hex") }], migratedCopies: 0, deletedVersions: 0 };
writeFileSync(`${root}/owned-review-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ reviewed: changed.length, pending: pending.map((item) => ({ name: item.name, index: item.index })), unmatchedCopies: work.unresolved.length, originalsPreserved: true }));
