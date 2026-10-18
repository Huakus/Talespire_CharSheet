/** Review standard weapons/armor and their +1/+2/+3 variants against the 2014 SRD.
 * Uses the latest preparation baseline. Does not write to a database or any possession.
 */
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createServer } from "vite";
const root = "tmp/equipment-definitions", out = "docs/v2/equipment-preparation-2026-10-17";
const magicalFamilies = process.argv.includes("--magic-families"), pendingOnly = magicalFamilies || process.argv.includes("--pending"), prefix = magicalFamilies ? "arms-magic" : pendingOnly ? "arms-extension" : "arms";
const read = (file) => JSON.parse(readFileSync(file, "utf8"));
const baseline = read(`${root}/latest-preparation-baseline.json`);
const bases = read("src/domain/character/phb-srd-equipment.json");
const pages = read("tmp/pdfs/srd-en-equipment-rows.json");
const spanish = read("tmp/pdfs/srd-equipment-lines.json");
const magic = read("tmp/pdfs/srd-magic-items.json");
const names = {
  club: "Garrote", dagger: "Daga", greatclub: "Garrote grande", handaxe: "Hacha de mano", javelin: "Jabalina", "light-hammer": "Martillo ligero", mace: "Maza", quarterstaff: "Bastón", sickle: "Hoz", spear: "Lanza",
  "crossbow-light": "Ballesta ligera", dart: "Dardo", shortbow: "Arco corto", sling: "Honda", battleaxe: "Hacha de guerra", flail: "Mangual", glaive: "Guja", greataxe: "Hacha a dos manos", greatsword: "Espadón", halberd: "Alabarda", lance: "Lanza de caballería", longsword: "Espada larga", maul: "Maza a dos manos", morningstar: "Lucero del alba", pike: "Pica", rapier: "Estoque", scimitar: "Cimitarra", shortsword: "Espada corta", trident: "Tridente", "war-pick": "Pico de guerra", warhammer: "Martillo de guerra", whip: "Látigo", blowgun: "Cerbatana", "crossbow-hand": "Ballesta de mano", "crossbow-heavy": "Ballesta pesada", longbow: "Arco largo", net: "Red",
  "padded-armor": "Armadura acolchada", "leather-armor": "Armadura de cuero", "studded-leather-armor": "Armadura de cuero tachonado", "hide-armor": "Armadura de pieles", "chain-shirt": "Camisa de malla", "scale-mail": "Cota de escamas", breastplate: "Coraza", "half-plate-armor": "Media armadura", "ring-mail": "Cota guarnecida", "chain-mail": "Cota de malla", "splint-armor": "Armadura de bandas", "plate-armor": "Armadura de placas", shield: "Escudo",
};
const armorRows = { "padded-armor": "Padded", "leather-armor": "Leather", "studded-leather-armor": "Studded leather", "hide-armor": "Hide", "half-plate-armor": "Half plate", "splint-armor": "Splint", "plate-armor": "Plate" };
const aliases = { "studded-leather": "studded-leather-armor", "half-plate": "half-plate-armor", "plate-mail": "plate-armor" };
const esUrl = "https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1_ES.pdf", enUrl = "https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf";
const clean = (s) => s.replace(/\s+/g, " ").trim();
const token = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const source = (lang, locator) => ({ id: `srd-5.1-${lang}-equipment`, kind: "srd", title: `SRD 5.1 · ${lang === "es" ? "edición oficial española" : "original inglés"}`, language: lang, rulesEdition: "2014", verified: true, locator: `${lang === "es" ? esUrl : enUrl} · páginas PDF ${locator} · CC BY 4.0` });
const paragraph = (id, text, provenance = "official-spanish", language = "es", section = "rules") => ({ id, type: "paragraph", section, provenance, sourceIds: [`srd-5.1-${language}-equipment`], text });
const text66 = spanish.find((p) => p.page === 66).lines.map((l) => l.text).join("\n");
const pageText = (n) => spanish.find((p) => p.page === n).lines.map((l) => l.text).join("\n");
const text64 = pageText(64), text65 = pageText(65), armorText = text64 + "\n" + text65;
function between(text, start, end) {
  const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `${start} → ${end}`); return clean(text.slice(a, b));
}
const armorDescriptions = {
  "padded-armor": between(text64, " Acolchada.", " Cuero."),
  "leather-armor": between(text64, " Cuero.", " Cuero tachonado."),
  "studded-leather-armor": between(text64, " Cuero tachonado.", "\nArmaduras medias"),
  "hide-armor": between(text64, " Pieles.", " Camisa de malla."),
  "chain-shirt": between(text64, " Camisa de malla.", " Cota de escamas."),
  "scale-mail": between(text64, " Cota de escamas.", " Coraza."),
  breastplate: between(text64, " Coraza.", " Media armadura."),
  "half-plate-armor": between(text64, " Media armadura.", "\nArmaduras pesadas"),
  "ring-mail": between(text64, " Cota guarnecida.", " Cota de malla."),
  "chain-mail": between(armorText, " Cota de malla.", " Armadura de bandas."),
  "splint-armor": between(text65, " Armadura de bandas.", "\nArmaduras"),
  "plate-armor": between(text65, " Armadura de placas.", "\nFuerza"),
  shield: between(text64, " Escudos.", "\nArmaduras ligeras"),
};
const armorCompetence = clean(pageText(63).slice(pageText(63).indexOf(" Competencia con armaduras.")) + " " + text64.slice(0, text64.indexOf(" Clase de Armadura")));
const propertyNames = { "two-handed": "A dos manos", thrown: "Arrojadiza", special: "Especial", reach: "Gran alcance", light: "Ligera", ammunition: "Munición", heavy: "Pesada", loading: "Recarga", finesse: "Sutil", versatile: "Versátil" };
const headings = [...Object.values(propertyNames), "Alcance", "Armas de plata"];
function propertyText(name) {
  const start = text66.indexOf(` ${name}.`); assert.ok(start >= 0, name);
  const ends = headings.map((h) => text66.indexOf(` ${h}.`, start + 1)).filter((i) => i > start);
  if (name === "Versátil") ends.push(text66.indexOf("\nArmas de plata", start));
  return clean(text66.slice(start, Math.min(...ends.filter((n) => n > start)))).replace(/muni- ción/g, "munición");
}
function rowFor(base) {
  const matches = [];
  for (const p of pages) for (const row of p.rows) if (token(row.cells[0]?.text) === token(armorRows[base.index] ?? base.name) && /^\d[\d,.]*\s+(?:cp|sp|ep|gp|pp)$/.test(row.cells[1]?.text ?? "")) matches.push({ page: p.page, cells: row.cells.map((c) => c.text) });
  assert.equal(matches.length, 1, base.index); return matches[0];
}
function weight(text) {
  if (/^[—–-]$/.test(text)) return null;
  const raw = text.replace(/\s*lb\.?$/, "").replace("½", ".5").replace("¼", ".25").trim();
  const fraction = raw.match(/^(\d+)\/(\d+)$/);
  const n = fraction ? Number(fraction[1]) / Number(fraction[2]) : Number(raw);
  assert.ok(Number.isFinite(n), text); return { value: n, unit: "lb" };
}
const edits = [], skipped = [], sourceChecks = [];
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { EquipmentPreparationPayloadSchema } = await server.ssrLoadModule("/src/domain/equipment/equipment-preparation.ts");
  const { verifyEquipmentSource, assessEquipmentRecovery } = await server.ssrLoadModule("/src/domain/equipment/equipment-recovery.ts");
  const { SRD_51_ATTRIBUTION } = await server.ssrLoadModule("/src/domain/equipment/equipment-attribution.ts");
  for (const record of baseline.records) {
    const previous = record.payload, d = previous.definition;
    if (d.id.startsWith("personal:") || pendingOnly && d.review.editorial) continue;
    const primary = previous.originals.find((o) => d.id === `recovery:${o.originalKey}`);
    const raw = primary?.raw?.payload;
    if (!raw || typeof raw.index !== "string") continue;
    let index = raw.index.toLowerCase(), family = null;
    if (magicalFamilies) {
      if (index.startsWith("vicious-") && index !== "vicious-net") { family = "vicious"; index = index.slice(8); }
      else if (/^flame-tongue-(longsword|shortsword|greatsword)$/.test(index)) { family = "flame-tongue"; index = index.slice(13); }
      else if (/^adamantine-(splint|plate|chain-mail|half-plate|breastplate)$/.test(index)) { family = "adamantine"; index = index.slice(11); index = { splint: "splint-armor", plate: "plate-armor", "half-plate": "half-plate-armor" }[index] ?? index; }
      else continue;
    }
    const match = index.match(/^(.*?)(?:[-+]([123]))?$/);
    const baseIndex = aliases[match[1]] ?? match[1]; let bonus = Number(match[2] ?? 0);
    const base = bases.find((b) => b.index === baseIndex && (b.weapon_category || b.armor_category));
    if (!base) continue;
    // A specific malformed index is recoverable from its explicit bonuses and URL.
    const stated = String(raw.name ?? d.name).match(/\+\s*([123])\b/);
    const repaired = d.id === "recovery:official:equipment:es:19907a1ffffb2a058fd67fc1" && raw.index === "greataxe" && raw.toHitBonus === 1 && raw.damageBonus === 1 && raw.url === "/api/equipment/greataxe+1" && stated?.[1] === "1";
    if (repaired) bonus = 1;
    if ((stated && Number(stated[1]) !== bonus) || (bonus && !stated)) { skipped.push({ id: d.id, name: d.name, index: raw.index, reason: "El índice y el nombre no confirman la misma variante." }); continue; }
    const row = rowFor(base), after = structuredClone(previous), v = after.definition;
    v.revision++; v.name = names[baseIndex] + (family === "vicious" ? " feroz" : family === "flame-tongue" ? " de lengua de fuego" : family === "adamantine" ? " de adamantina" : bonus ? ` +${bonus}` : ""); assert.ok(names[baseIndex]);
    v.aliases = [...new Set([...v.aliases, d.name].filter((n) => n && n !== v.name))];
    v.origin = "official"; v.magical = bonus > 0 || family !== null; v.consumable = false;
    v.category = base.armor_category ? base.armor_category === "Shield" ? "shield" : "armor" : "weapon";
    v.rarity = family ? family === "adamantine" ? "uncommon" : "rare" : bonus ? v.category === "armor" ? [null, "rare", "very-rare", "legendary"][bonus] : [null, "uncommon", "rare", "very-rare"][bonus] : "none";
    v.sources = v.sources.filter((s) => !/^srd-5\.1-(?:es|en)-equipment$/.test(s.id));
    v.sources.push(source("es", base.weapon_category ? "66–68" : "63–65"), source("en", row.page));
    if (!v.sources.some((s) => s.id === "srd-5.1-attribution")) v.sources.push({ id: "srd-5.1-attribution", kind: "srd", title: "Atribución y licencia del SRD 5.1", language: "es", rulesEdition: "2014", verified: true, locator: SRD_51_ATTRIBUTION });
    v.weight = weight(row.cells[base.weapon_category ? 3 : 5]);
    const [cost, currency] = row.cells[1].split(/\s+/);
    v.economy = { basePrice: v.magical ? null : { quantity: Number(cost.replaceAll(",", "")), unit: currency }, campaignPrice: null, explanation: v.magical ? "La tabla describe el objeto mundano base; no fija el precio de la variante mágica. Precios personales y comerciales conservados en los originales." : "Precio del objeto base según la tabla de 2014. No modifica precios comerciales ni copias poseídas." };
    v.properties = [...(base.properties ?? []).map((p) => p.index).filter((p) => p !== "monk"), ...(v.magical ? ["magic"] : [])];
    v.requirements = { attunement: family === "flame-tongue", bearer: [], presence: base.weapon_category ? "held" : "worn", explanation: family === "flame-tongue" ? "Los poderes de la espada requieren sintonización y empuñarla; el uso mundano del arma no concede esos poderes." : "No requiere sintonización. La competencia determina los beneficios y restricciones de uso, no es una condición para poseer el objeto." };
    v.resources = []; v.capabilities = []; v.weapon = null; v.armor = null;
    v.description = [{ id: "official-base-table", type: "table", section: "description", provenance: "reviewed-translation", sourceIds: ["srd-5.1-en-equipment"], columns: ["Objeto base", "Precio del objeto mundano", "Peso"], rows: [[names[baseIndex], row.cells[1].replace(/gp/, "po").replace(/sp/, "pp").replace(/cp/, "pc"), v.weight ? `${v.weight.value} lb` : "—"]] }];
    if (base.weapon_category) {
      const type = base.damage?.damage_type.index;
      if (base.damage) { assert.ok(row.cells[2].startsWith(base.damage.damage_dice), baseIndex); assert.equal(row.cells[2].split(" ").at(-1).toLowerCase(), type); }
      else assert.equal(row.cells[2], "—");
      v.weapon = { category: base.weapon_category.toLowerCase(), meleeReachFeet: base.weapon_range === "Melee" ? v.properties.includes("reach") ? 10 : 5 : null, thrown: v.properties.includes("thrown"), rangeFeet: base.throw_range ? { normal: base.throw_range.normal, long: base.throw_range.long } : base.weapon_range === "Ranged" ? { normal: base.range.normal, long: base.range.long ?? null } : null, attackBonus: bonus, damageBonus: base.damage ? bonus : 0, ...(base.damage ? {} : { damageMode: "none" }), baseDamage: [...(base.damage ? [{ id: "base-damage", kind: "damage", expression: base.damage.damage_dice, damageType: type, timing: "base", condition: "" }] : []), ...(base.two_handed_damage ? [{ id: "versatile-damage", kind: "damage", expression: base.two_handed_damage.damage_dice, damageType: type, timing: "versatile", condition: "Empleada a dos manos en un ataque cuerpo a cuerpo." }] : [])] };
      const table = v.description[0]; table.columns.push("Daño base", "Bonificación mágica al ataque", "Propiedades"); table.rows[0].push(base.damage ? `${base.damage.damage_dice} ${{ slashing: "cortante", piercing: "perforante", bludgeoning: "contundente" }[type]}` : "No causa daño", `+${bonus}`, v.properties.filter((p) => p !== "magic").map((p) => propertyNames[p]).join(", ") || "—");
      if (v.weapon.rangeFeet) { table.columns.push("Alcance normal/largo (pies)"); table.rows[0].push(`${v.weapon.rangeFeet.normal}/${v.weapon.rangeFeet.long}`); assert.ok(row.cells.at(-1).includes(`${v.weapon.rangeFeet.normal}/${v.weapon.rangeFeet.long}`), baseIndex); }
      if (base.two_handed_damage) { table.columns.push("Daño versátil"); table.rows[0].push(base.two_handed_damage.damage_dice); assert.ok(row.cells.at(-1).includes(base.two_handed_damage.damage_dice)); }
      for (const prop of v.properties.filter((p) => p !== "magic")) v.description.push(paragraph(`property-${prop}`, propertyText(propertyNames[prop])));
      if (baseIndex === "lance") {
        v.description.push(paragraph("lance-special", clean(text66.slice(text66.indexOf(" Lanza de caballería."), text66.indexOf(" Red.")))));
        v.capabilities.push({ id: "lance-special", name: "Uso de la lanza de caballería", activation: "passive", trigger: "", requirements: structuredClone(v.requirements), target: "Portador", range: "", duration: "Mientras se utiliza el arma.", concentration: false, costs: [], consumeQuantity: 0, effects: [{ id: "lance-disadvantage", kind: "defense", defense: "disadvantage", target: "weapon-attacks", condition: "Solo al atacar a un objetivo a 5 pies o menos." }, { id: "lance-hands", kind: "unmodeled", condition: "", explanation: "Requiere dos manos si no se está montado.", original: { rule: v.description.at(-1).text } }], execution: { mode: "unsupported", handler: null, explanation: "Falta integrar la distancia al objetivo y el uso de manos según montura.", pendingAutomation: ["Resolver desventaja por proximidad y dos manos solo cuando no está montado."] }, textBlockIds: ["lance-special"] });
      }
      if (baseIndex === "net") {
        const rule = clean(text66.slice(text66.indexOf(" Red.")) + " " + pageText(67).slice(0, pageText(67).indexOf("\nArmas improvisadas")));
        v.description.push(paragraph("net-special", rule));
        v.capabilities.push({ id: "restrain-target", name: "Apresar con la red", activation: "trigger", trigger: "Impactar con la red a un objetivo susceptible.", requirements: structuredClone(v.requirements), target: "Criatura Grande o más pequeña con forma definida", range: "5/15 pies", duration: "Hasta ser liberada", concentration: false, costs: [], consumeQuantity: 0, effects: [{ id: "restrained", kind: "condition", conditionKey: "restrained", operation: "add", condition: "Solo al impactar a un objetivo susceptible; se elimina al liberarlo." }, { id: "net-procedure", kind: "unmodeled", condition: "", explanation: "Solo un ataque por acción, acción adicional o reacción. Liberar con acción y Fuerza CD 10, o destruir la red (CA 10) con 5 de daño cortante. No se inflige ese daño a la criatura.", original: { rule } }], execution: { mode: "unsupported", handler: null, explanation: "Falta integrar el tamaño/forma del objetivo, el estado apresado y los procedimientos de liberación y destrucción.", pendingAutomation: ["Aplicar y retirar el estado al objetivo sin añadir dados o bonos de daño.", "Controlar un único ataque y resolver la liberación por prueba o daño cortante."] }, textBlockIds: ["net-special"] });
      }
    } else {
      const ac = base.armor_class;
      assert.equal(parseInt(row.cells[2], 10), ac.base); assert.equal(row.cells[4] === "Disadvantage", base.stealth_disadvantage);
      const strength = row.cells[3].match(/Str (\d+)/);
      assert.equal(strength ? Number(strength[1]) : 0, base.str_minimum);
      v.armor = { category: base.armor_category.toLowerCase(), baseArmorClass: ac.base, dexterity: ac.dex_bonus ? ac.max_bonus == null ? "full" : "capped" : "none", dexterityCap: ac.max_bonus ?? null, strengthMinimum: base.str_minimum || null, stealthDisadvantage: base.stealth_disadvantage, armorClassBonus: bonus };
      const table = v.description[0]; table.columns.push("CA base", "Destreza", "Bonificación mágica", "Fuerza mínima", "Sigilo"); table.rows[0].push(String(ac.base), ac.dex_bonus ? ac.max_bonus == null ? "Modificador completo" : "Modificador, máximo +2" : "No se aplica", `+${bonus}`, String(v.armor.strengthMinimum ?? "—"), base.stealth_disadvantage ? "Desventaja" : "—");
      const timing = { light: ["1 minuto", "1 minuto"], medium: ["5 minutos", "1 minuto"], heavy: ["10 minutos", "5 minutos"], shield: ["1 acción", "1 acción"] }[v.armor.category];
      v.description.push({ id: "donning-doffing", type: "table", section: "rules", provenance: "official-spanish", sourceIds: ["srd-5.1-es-equipment"], columns: ["Poner", "Quitar"], rows: [timing] });
      v.description.push(paragraph("armor-material", armorDescriptions[baseIndex], "official-spanish", "es", "description"));
      v.description.push(paragraph("armor-proficiency", armorCompetence));
      if (v.armor.category === "heavy") v.description.push(paragraph("heavy-strength", between(text64, " Armaduras pesadas.", " Sigilo.")));
      v.description.push(paragraph("armor-stealth", between(text64, " Sigilo.", " Escudos.")));
      const categoryText = {
        light: between(text64, "Al estar hechas", " Acolchada."),
        medium: between(text64, "Las armaduras medias ofrecen", " Pieles."),
        heavy: between(text64, "De entre todas las categorías", " Cota guarnecida."),
      }[v.armor.category];
      if (categoryText) v.description.push(paragraph("armor-category", categoryText));
      v.description.push(paragraph("armor-donning", between(text65, "El tiempo que lleva ponerse", "\nPonerse y quitarse la armadura")));
    }
    if (bonus) {
      const heading = v.armor ? v.category === "shield" ? "Escudo +1, +2 o +3" : "Armadura +1, +2 o +3" : "Arma +1, +2 o +3";
      const section = magic.find((m) => m.name === heading); assert.ok(section, heading);
      let lines = section.lines.filter((l) => l.size > 8.5); while (lines[0]?.fonts.every((f) => f.includes("Italic"))) lines.shift();
      v.description.push(paragraph("enhancement-rule", clean(lines.map((l) => l.text).join(" "))));
      v.sources.find((s) => s.id === "srd-5.1-es-equipment").locator += `; propiedades mágicas página PDF ${section.page}`;
    }
    const capability = (id, name, effects, extra = {}) => ({ id, name, activation: "passive", trigger: "", requirements: structuredClone(v.requirements), target: "Portador", range: "", duration: "Mientras se cumplen los requisitos.", concentration: false, costs: [], consumeQuantity: 0, effects, execution: { mode: "unsupported", handler: null, explanation: "Regla cotejada; falta integrar y probar sus efectos en el formato nuevo.", pendingAutomation: ["Aplicar y retirar los efectos según los requisitos y las condiciones de esta capacidad."] }, textBlockIds: ["family-rule"], ...extra });
    if (family === "vicious") {
      const reference = read(`${out}/used-equipment-reviewed-definitions.json`).find((item) => item.description.some((block) => block.id === "vicious-2014")); assert.ok(reference);
      v.sources.push(structuredClone(reference.sources.find((s) => s.id === "dmg-2014-vicious")));
      const block = structuredClone(reference.description.find((b) => b.id === "vicious-2014")); block.id = "family-rule";
      v.description.push(block, structuredClone(reference.description.find((b) => b.id === "vicious-source-difference")));
      v.capabilities.push(capability("vicious-natural-20", "Daño adicional con un 20 natural", [{ id: "vicious-damage", kind: "damage", expression: "7", damageType: base.damage.damage_type.index, timing: "critical", condition: "Solo con un 20 natural en la tirada de ataque. Es una cantidad fija, no se duplica y no se activa con un crítico obtenido con 19." }], { activation: "trigger", trigger: "Un 20 natural en la tirada de ataque con esta arma.", target: "Objetivo impactado" }));
    }
    if (family === "flame-tongue") {
      const section = magic.find((s) => s.name === "Lengua de fuego"); assert.ok(section);
      const lines = [...section.lines]; while (lines[0]?.fonts.every((f) => f.includes("Italic"))) lines.shift();
      v.description.push(paragraph("family-rule", clean(lines.map((l) => l.text).join(" "))));
      v.sources.find((s) => s.id === "srd-5.1-es-equipment").locator += `; Lengua de fuego página PDF ${section.page}`;
      v.capabilities.push(capability("flaming-toggle", "Encender o apagar la hoja", [{ id: "flame-word", kind: "narrative", condition: "", instructions: "Pronunciar la palabra de activación como acción adicional. Emite luz brillante a 40 pies y tenue otros 40 pies; se apaga al soltarla, envainarla o volver a usar la palabra como acción adicional." }], { activation: "bonus-action" }));
      v.capabilities.push(capability("flaming-hit", "Daño con la hoja encendida", [{ id: "flame-damage", kind: "damage", expression: "2d6", damageType: "fire", timing: "on-hit", condition: "Solo mientras la espada esté encendida mediante su palabra de activación y el ataque impacte." }], { activation: "trigger", trigger: "Impactar con la hoja encendida.", target: "Objetivo impactado" }));
    }
    if (family === "adamantine") {
      const section = magic.find((s) => /adamantin/i.test(s.name)); assert.ok(section);
      const lines = [...section.lines]; while (lines[0]?.fonts.every((f) => f.includes("Italic"))) lines.shift();
      assert.ok(["medium", "heavy"].includes(v.armor?.category) && baseIndex !== "hide-armor");
      v.description.push(paragraph("family-rule", clean(lines.map((l) => l.text).join(" "))));
      v.sources.find((s) => s.id === "srd-5.1-es-equipment").locator += `; ${section.name} página PDF ${section.page}`;
      v.capabilities.push(capability("critical-protection", "Protección frente a críticos", [{ id: "critical-protection", kind: "defense", defense: "immunity", target: "critical-hits", condition: "Mientras se lleva puesta, los impactos críticos se convierten en impactos normales; no impide el daño de un impacto normal." }]));
    }
    v.review = { identity: true, information: false, editorial: true, mechanics: !v.capabilities.some((c) => c.effects.some((e) => e.kind === "unmodeled")), unresolved: ["Cerrar la cobertura de todos los campos originales antes de migrar o retirar versiones.", ...(d.review.editorial ? d.review.unresolved.filter((note) => !note.startsWith("Cerrar la cobertura")) : []), ...(repaired ? ["Índice heredado greataxe mal formado: la URL greataxe+1 y los campos explícitos toHitBonus=1 y damageBonus=1 acreditan la variante +1. Las versiones mundanas de sus archivos deben asignarse por separado durante la recuperación."] : [])] };
    after.decisions = after.decisions.filter((decision) => !/^\/payload\/(weight|cost)/.test(decision.pointer));
    assert.deepEqual(EquipmentPreparationPayloadSchema.parse(after), after); assert.deepEqual(after.originals, previous.originals);
    for (const o of after.originals) assert.ok(await verifyEquipmentSource(o));
    assert.deepEqual((await assessEquipmentRecovery(after.originals, after.decisions, new Map([[v.id, v]]))).issues, []);
    edits.push({ before: previous, after }); sourceChecks.push({ id: v.id, name: v.name, index: raw.index, baseIndex, family, enhancement: bonus, repairedIndex: repaired, page: row.page, officialRow: row.cells });
  }
} finally { await server.close(); }
assert.ok(edits.length > 0);
writeFileSync(`${root}/${prefix}-reviewed-changes.json`, JSON.stringify(edits));
writeFileSync(`${out}/${prefix}-reviewed-definitions.json`, JSON.stringify(edits.map((x) => x.after.definition), null, 2));
writeFileSync(`${out}/${prefix}-source-review.json`, JSON.stringify({ baselineRevision: baseline.campaignRevision, sourceChecks, skipped, activeCopiesChanged: 0, deletedVersions: 0 }, null, 2));
console.log(JSON.stringify({ reviewed: edits.length, weapons: edits.filter((e) => e.after.definition.weapon).length, armor: edits.filter((e) => e.after.definition.armor).length, skipped }));
