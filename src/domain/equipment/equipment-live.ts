import { CharacterInventoryItemV2Schema, type CharacterInventoryItemV2, type InventoryBonus, type InventoryFeature } from "../character/character-inventory-model";
import { EquipmentDefinitionDraftSchema, type EquipmentDefinitionDraft } from "./equipment-definition";
import { SRD_51_ATTRIBUTION } from "./equipment-attribution";
import { equipmentRecoveryLabel } from "./equipment-resource-runtime";
import type { JsonObject } from "../../shared/json";
import type { CharacterV2 } from "../character/character-v2";

const definitionCache = new WeakMap<object, EquipmentDefinitionDraft>();
export function inventoryEquipmentDefinition(item: Pick<CharacterInventoryItemV2, "rules">): EquipmentDefinitionDraft | null {
  if (!item.rules) return null;
  const cached = definitionCache.get(item.rules.definition);
  if (cached) return cached;
  const definition = EquipmentDefinitionDraftSchema.parse(item.rules.definition);
  definitionCache.set(item.rules.definition, definition);
  return definition;
}
export function equipmentPlainDescription(definition: EquipmentDefinitionDraft): string {
  const text = definition.description.filter((b) => b.section !== "gm-notes").map((b) => b.type === "paragraph" ? b.text : b.type === "list" ? b.items.map((s, i) => `${b.ordered ? `${i + 1}.` : "•"} ${s}`).join("\n") : [b.columns.join(" · "), ...b.rows.map((row) => row.join(" · "))].join("\n")).join("\n\n");
  return definition.sources.some((s) => s.verified && s.kind === "srd") && !text.includes(SRD_51_ATTRIBUTION) ? `${text}\n\n${SRD_51_ATTRIBUTION}` : text;
}
const normalized = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9+]/g, "");
const damageNames: Record<string, string> = { bludgeoning: "contundente", piercing: "perforante", slashing: "cortante", fire: "fuego", cold: "frío", necrotic: "necrótico", force: "fuerza", poison: "veneno" };
const bonus = (category: string, key: string, value: number): InventoryBonus => ({ category, key, value, valueSource: null, advantage: false, disadvantage: false });
export function equipmentBearerIssue(character: CharacterV2, item: CharacterInventoryItemV2, featureId?: string): string {
  const definition = inventoryEquipmentDefinition(item);
  const requirements = featureId ? definition?.capabilities.find((cap) => cap.id === featureId)?.requirements : definition?.requirements;
  const classText = tokenClass(character.identity.className), classNames: Record<string, RegExp> = { wizard: /mago|wizard/, warlock: /brujo|bruja|warlock/, cleric: /clerigo|cleric/, druid: /druida|druid/, bard: /bardo|bard/, sorcerer: /hechicero|sorcerer/, paladin: /paladin/, ranger: /explorador|ranger/, rogue: /picaro|rogue/, fighter: /guerrero|fighter/, artificer: /artifice|artificer/ };
  const key = character.builder?.classKey ?? Object.entries(classNames).find(([, pattern]) => pattern.test(classText))?.[0];
  for (const requirement of requirements?.bearer ?? []) {
    if (requirement.kind === "class" && (!key || !requirement.keys.includes(key))) return requirement.explanation;
    if (requirement.kind === "proficiency") {
      const tools = character.proficiencies.tools.map(normalized);
      const known = [...tools,...character.proficiencies.weapons.map(normalized),...character.proficiencies.armor.map(normalized)];
      const matches = requirement.keys.some((required) => required === "tinker-tools"
        ? tools.some((tool) => /tinker|hojalater|manitas|herramientasdeartifice/.test(tool))
        : known.includes(normalized(required)));
      if (!matches) return requirement.explanation;
    }
    if (requirement.kind === "other" && requirement.keys.some((k) => k.startsWith("chr_")) && !requirement.keys.includes(character.id)) return requirement.explanation;
    if (requirement.kind === "spellcaster" && !Object.values(character.spellcasting.slots).some((s) => s.maximum > 0) && !character.spellcasting.spells.length && !["wizard", "cleric", "warlock", "druid", "bard", "sorcerer"].includes(key ?? "")) return requirement.explanation;
  }
  return "";
}
const tokenClass = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Immutable catalog snapshot plus a lossless original. Never resets current counters. */
export function bindReviewedEquipment(original: JsonObject, definition: EquipmentDefinitionDraft, options: { preserveName?: boolean } = {}): CharacterInventoryItemV2 {
  const old = CharacterInventoryItemV2Schema.parse(original), item = structuredClone(old);
  const pending: string[] = [];
  if (old.rules?.definition.id === definition.id) return old;
  const text = equipmentPlainDescription(definition);
  const authoredTexts = new Set(definition.description.filter((b) => b.type === "paragraph").map((b) => b.text));
  const personalDescription = old.description.trim() && old.description.trim() !== text.trim() && !authoredTexts.has(old.description) && !/^(Equipo descrito|La ficha registra)/.test(old.description) ? old.description : "";
  item.rules = { definition: JSON.parse(JSON.stringify(definition)) as JsonObject, pending, original: structuredClone(original), personalDescription, slotUsage: {}, storage: definition.resources.some((r) => r.kind === "spell-storage") ? { known: false, spells: [] } : null };
  if (!options.preserveName) item.name = definition.name.replace(/ · [^·]+$/, definition.id.startsWith("personal:") ? "" : "$&");
  if (text) item.description = text;
  if (definition.category) item.category = definition.category;
  if (definition.weight) item.unitWeight = definition.weight.unit === "lb" ? definition.weight.value : definition.weight.value / 0.45359237;
  if (definition.requirements.attunement !== null) item.requiresAttunement = definition.requirements.attunement;
  if (definition.consumable !== null) item.consumable = definition.consumable;
  // Copies retain their own price. A zero in an old copy never becomes a free official item.
  if (definition.properties.length) item.properties = [...new Set([...definition.properties, ...old.properties.filter((p) => ["silvered", "cursed"].includes(p))])];
  const generated: InventoryBonus[] = [];
  const abilityNames: Record<string, string> = { strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha" };
  for (const cap of definition.capabilities.filter((c) => c.activation === "passive")) for (const effect of cap.effects) if (effect.kind === "bonus" && abilityNames[effect.target]) {
    item.bonuses = item.bonuses.filter((entry) => !(normalized(entry.category) === "attributes" && [effect.target, abilityNames[effect.target]].includes(normalized(entry.key)) && entry.value === effect.value));
  }
  if (definition.weapon) {
    const w = definition.weapon, base = w.baseDamage.find((e) => e.kind === "damage" && e.timing === "base"), versatile = w.baseDamage.find((e) => e.kind === "damage" && e.timing === "versatile");
    item.weapon = { category: w.category, range: w.meleeReachFeet !== null ? "melee" : "ranged", normalRange: w.rangeFeet?.normal ?? null, longRange: w.rangeFeet?.long ?? null, attackBonus: w.attackBonus, damageBonus: w.damageBonus, damageExpression: base?.kind === "damage" ? base.expression : "", versatileDamageExpression: versatile?.kind === "damage" ? versatile.expression : "", damageType: base?.kind === "damage" ? damageNames[base.damageType] ?? base.damageType : "" };
    for (const field of ["attackBonus", "damageBonus"] as const) if (old.weapon && old.weapon[field] !== 0 && old.weapon[field] !== item.weapon[field]) { item.weapon[field] = old.weapon[field]; pending.push(`Se conserva el bono propio ${field === "attackBonus" ? "de ataque" : "de daño"} ${old.weapon[field]}; difiere de la base y requiere cotejo de la personalización.`); }
  }
  if (definition.armor) {
    const a = definition.armor;
    item.armor = { base: a.baseArmorClass, dexterityBonus: a.dexterity !== "none", maximumDexterityBonus: a.dexterityCap, armorCategory: a.category, stealthDisadvantage: a.stealthDisadvantage, strengthRequirement: a.strengthMinimum };
    if (a.armorClassBonus) generated.push(bonus("combatStats", "AC", a.armorClassBonus));
  }
  for (const cap of definition.capabilities.filter((c) => c.activation === "passive")) for (const effect of cap.effects) {
    if (effect.kind !== "bonus" || effect.operation !== "add") continue;
    const key = effect.target;
    if (/^(strength|dexterity|constitution|intelligence|wisdom|charisma)$/.test(key)) {
      // Attribute operators are projected from the typed rule, including upper limits.
      continue;
    }
    if (key === "armor-class") generated.push(bonus("combatStats", "AC", effect.value));
    else if (key === "wisdom-saves") generated.push(bonus("saves", "wisdom", effect.value));
    else if (key === "arcana") generated.push(bonus("skills", "arcana", effect.value));
    else if (key === "spell-attack") generated.push(bonus("combatStats", "SpellAttack", effect.value));
    else if (key === "spell-save-dc") generated.push(bonus("combatStats", "SpellSaveDC", effect.value));
    else if (key === "bard-spell-attack" || key === "bard-spell-save-dc") { /* Projected per spell source, never as a global Charisma bonus. */ }
    else if (key === "saving-throws") generated.push(bonus("saves", "all", effect.value));
    else if (key === "ability-checks") generated.push(bonus("skills", "all", effect.value));
    else pending.push(`${cap.name}: el bono requiere resolución asistida según su condición.`);
  }
  for (const entry of generated) {
    const existing = item.bonuses.find((b) => normalized(b.category) === normalized(entry.category) && normalized(b.key) === normalized(entry.key));
    if (!existing) item.bonuses.push(entry);
    else if (existing.value !== entry.value) pending.push(`${entry.key}: se conserva el bono propio ${existing.value}; la definición indica ${entry.value}.`);
  }
  const ordinaryResources = definition.resources.filter((r) => r.kind !== "spell-storage");
  if (definition.resources.some((r) => r.kind === "spell-storage")) {
    item.charges = null; item.usable = false;
    pending.push("El contenido almacenado se gestiona como conjuros y niveles, nunca como cargas. El contador antiguo se conserva en el original.");
  } else if (ordinaryResources.length === 1 && ordinaryResources[0]!.maximum !== null) {
    const r = ordinaryResources[0]!, recovery = r.recovery;
    const current = old.charges ? Math.min(old.charges.current, r.maximum!) : 0;
    item.charges = { current, maximum: r.maximum!, reset: recovery.kind === "event" && recovery.amount.kind === "full" ? recovery.event : "manual" };
    if (!old.charges || old.charges.maximum === 0) pending.push(`${r.name}: no había contador válido; se conserva cero disponible hasta recuperar o confirmar su estado. ${equipmentRecoveryLabel(r)}`);
  }
  const existingIds = new Set(old.features.map((f) => f.id));
  const features: InventoryFeature[] = definition.capabilities.filter((cap) => !existingIds.has(cap.id)).map((cap, index) => {
    const unmodeled = cap.effects.some((e) => e.kind === "unmodeled");
    const activation = cap.activation === "trigger" || cap.activation === "other" ? "other" : cap.activation;
    const costsSupported = cap.costs.every((c) => ordinaryResources.length === 1 && ordinaryResources[0]!.id === c.resourceId);
    const ruleText = definition.description.filter((block) => cap.textBlockIds.includes(block.id)).map((block) => block.type === "paragraph" ? block.text : block.type === "list" ? block.items.join("\n") : block.rows.map((row) => row.join(" · ")).join("\n")).join("\n\n");
    const automaticPassive = cap.activation === "passive" && cap.effects.every((effect) => effect.kind === "spell-slot-capacity" || effect.kind === "bonus" && ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma", "armor-class", "wisdom-saves", "arcana", "spell-attack", "spell-save-dc", "bard-spell-attack", "bard-spell-save-dc"].includes(effect.target));
    if (!automaticPassive && (unmodeled || cap.execution.mode !== "automatic")) pending.push(...cap.execution.pendingAutomation.map((note) => `${cap.name}: ${note}`));
    return { id: cap.id, order: old.features.length + index, kind: !costsSupported || unmodeled && cap.consumeQuantity === 0 && !cap.costs.length ? "other" : activation, name: cap.name, description: [ruleText, ...cap.effects.flatMap((effect) => effect.kind === "unmodeled" ? [effect.explanation] : effect.kind === "narrative" ? [effect.instructions] : []), cap.duration ? `Duración: ${cap.duration}.` : "", cap.range ? `Alcance: ${cap.range}.` : "", cap.concentration ? `Concentración: ${cap.concentration === "spell-dependent" ? "según el conjuro" : "sí"}.` : "", ...cap.costs.map((cost) => `Coste: ${cost.amount} ${definition.resources.find((r) => r.id === cost.resourceId)?.name ?? cost.resourceId}.`), !automaticPassive && ["unsupported", "assisted"].includes(cap.execution.mode) ? "Resolución asistida: aplicar las condiciones y resultados descritos; el botón registra el gasto cuando corresponda. Las automatizaciones pendientes se detallan en el objeto." : ""].filter(Boolean).join("\n\n"), active: false, toggleable: false, showInActions: !["passive", "other"].includes(activation) && (!unmodeled || cap.consumeQuantity > 0 || cap.costs.length > 0), chargeCost: costsSupported ? cap.costs.reduce((n, c) => n + c.amount, 0) : 0, uses: null, rolls: cap.effects.flatMap((effect) => effect.kind === "damage" || effect.kind === "healing" ? [{ label: effect.kind === "healing" ? "Curación" : `Daño${effect.condition ? " condicionado" : ""}`, expression: effect.expression, mode: "normal" as const }] : []), bonuses: [] };
  });
  item.features = [...old.features, ...features];
  if (features.length) item.usable = false; // The capability owns its cost; no second generic Use button.
  if (!definition.review.editorial) pending.push("La descripción o sus reglas de campaña todavía requieren información; se conserva íntegra la copia anterior.");
  pending.push(...definition.review.unresolved.filter((note) => !/^(Cerrar la cobertura|Conservar originales|Conservar los originales|Conservar.*cerrar|La descripción oficial española está recuperada íntegramente)/.test(note)));
  if (definition.sources.some((s) => s.id === "srd-5.1-attribution") && !item.description.includes(SRD_51_ATTRIBUTION)) item.description += `\n\n${SRD_51_ATTRIBUTION}`;
  item.rules.pending = [...new Set(pending)];
  return CharacterInventoryItemV2Schema.parse(item);
}
