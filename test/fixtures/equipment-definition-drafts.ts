import { EquipmentDefinitionDraftSchema, type EquipmentCapability, type EquipmentDefinitionDraft } from "../../src/domain/equipment/equipment-definition";

/** Synthetic examples of the format, not official entries or grants to characters. */
export function equipmentDraftExample(id = "simple"): EquipmentDefinitionDraft {
  return EquipmentDefinitionDraftSchema.parse({
    format: "equipment-definition-draft", schemaVersion: 1, id: `example:${id}`, revision: 0,
    language: "es", name: "Cuerda de prueba", aliases: [], baseDefinitionId: null,
    origin: "campaign",
    sources: [{ id: "test-source", kind: "campaign", title: "Ejemplo técnico sintético", language: "es", rulesEdition: "2014", locator: null, verified: true }],
    category: "adventuring-gear", subtypes: [], magical: false, rarity: "none", consumable: false, properties: [],
    weight: { value: 1, unit: "lb" }, economy: { basePrice: null, campaignPrice: null, explanation: "Sin precio definido en este ejemplo." },
    description: [{ id: "text", type: "paragraph", section: "description", provenance: "campaign", sourceIds: ["test-source"], text: "  Texto conservado con espacios y saltos.\nSegundo párrafo del ejemplo.  " }],
    requirements: { attunement: false, bearer: [], presence: "possessed", explanation: "" },
    weapon: null, armor: null, resources: [], capabilities: [], recoverySourceIds: ["archive:synthetic"],
    review: { identity: false, information: false, editorial: false, mechanics: false, unresolved: ["Ejemplo del formato; no es un objeto definitivo."] },
  });
}
export function equipmentCapabilityExample(id = "use"): EquipmentCapability {
  return {
    id, name: "Capacidad de prueba", activation: "action", trigger: "", requirements: { attunement: false, bearer: [], presence: "held", explanation: "" },
    target: "portador", range: "personal", duration: "instantánea", concentration: false, costs: [], consumeQuantity: 0,
    effects: [{ id: "effect", kind: "narrative", instructions: "Resolver la interacción narrativa indicada.", condition: "" }],
    execution: { mode: "narrative", handler: null, explanation: "Adjudicación narrativa." , pendingAutomation: [] }, textBlockIds: ["text"],
  };
}
export function equipmentDraftExamples(): EquipmentDefinitionDraft[] {
  const simple = equipmentDraftExample();
  const weapon = equipmentDraftExample("conditional-weapon");
  weapon.name = "Arma condicionada de prueba"; weapon.category = "weapon"; weapon.magical = true; weapon.rarity = "rare";
  weapon.weapon = { category: "simple", meleeReachFeet: 5, thrown: false, rangeFeet: null, attackBonus: 1, damageBonus: 1, baseDamage: [{ id: "base", kind: "damage", condition: "", expression: "1d6", damageType: "piercing", timing: "base" }] };
  weapon.capabilities = [{ ...equipmentCapabilityExample("conditional-damage"), activation: "trigger", trigger: "Al cumplirse la condición de este ejemplo.", effects: [{ id: "extra", kind: "damage", condition: "Solo contra el objetivo indicado.", expression: "1d4", damageType: "force", timing: "on-hit" }], execution: { mode: "unsupported", handler: null, explanation: "Adaptador pendiente." , pendingAutomation: [] } }];
  const armor = equipmentDraftExample("armor");
  armor.name = "Armadura de prueba"; armor.category = "armor";
  armor.armor = { category: "medium", baseArmorClass: 14, dexterity: "capped", dexterityCap: 2, strengthMinimum: null, stealthDisadvantage: false, armorClassBonus: 0 };
  const finite = equipmentDraftExample("finite-resource");
  finite.name = "Cristal de usos finitos de prueba"; finite.magical = true; finite.rarity = "uncommon";
  finite.resources = [{ id: "reserve", name: "Reserva", kind: "finite", maximum: 3, unit: "usos", recovery: { kind: "none" }, exhaustion: "Se agota la reserva del ejemplo." }];
  finite.capabilities = [{ ...equipmentCapabilityExample(), costs: [{ resourceId: "reserve", amount: 1 }] }];
  const spell = equipmentDraftExample("spell-item");
  spell.name = "Amuleto de conjuro de prueba"; spell.magical = true; spell.rarity = "rare";
  spell.requirements.attunement = true;
  spell.resources = [{ id: "charges", name: "Cargas", kind: "charges", maximum: 3, unit: "cargas", recovery: { kind: "event", event: "dawn", explanation: "Ejemplo de recuperación aleatoria.", amount: { kind: "roll", expression: "1d3" } }, exhaustion: "" }];
  spell.capabilities = [{ ...equipmentCapabilityExample("cast"), requirements: { ...spell.requirements, presence: "worn" }, costs: [{ resourceId: "charges", amount: 1 }], effects: [{ id: "cast-spell", kind: "spell", spellKey: "example:spell", level: 1, ability: "intelligence", saveDc: null, attackBonus: null, components: "waived", explanation: "Ejemplo sintético.", condition: "" }], execution: { mode: "unsupported", handler: null, explanation: "Vínculo de ejecución pendiente." , pendingAutomation: [] } }];
  const storage = equipmentDraftExample("spell-storage");
  storage.name = "Almacenamiento de prueba"; storage.magical = true; storage.rarity = "rare";
  storage.resources = [{ id: "capacity", name: "Capacidad", kind: "spell-storage", maximum: 5, unit: "niveles de conjuro", recovery: { kind: "none" }, exhaustion: "" }];
  storage.capabilities = [{ ...equipmentCapabilityExample("store"), effects: [{ id: "storage", kind: "storage", resourceId: "capacity", content: "spells", explanation: "La copia debe conservar los conjuros y los datos del lanzador original.", condition: "" }], execution: { mode: "unsupported", handler: null, explanation: "Almacenamiento pendiente de implementación." , pendingAutomation: [] } }];
  const custom = equipmentDraftExample("complex-campaign-item");
  custom.name = "Dispositivo de campaña de prueba";
  custom.description.push({ id: "steps", type: "list", section: "rules", provenance: "campaign", sourceIds: ["test-source"], ordered: true, items: ["Primer paso.", "Segundo paso."] });
  custom.description.push({ id: "table", type: "table", section: "rules", provenance: "campaign", sourceIds: ["test-source"], columns: ["Resultado", "Efecto"], rows: [["1", "Resultado narrativo"], ["2", "Otro resultado"]] });
  custom.capabilities = [{ ...equipmentCapabilityExample("custom"), effects: [{ id: "unknown", kind: "unmodeled", explanation: "Regla singular que debe recuperarse sin inventar su mecánica.", original: { resonances: ["a", "b"], specialRule: { limit: null, active: false } }, condition: "" }], execution: { mode: "unsupported", handler: null, explanation: "Pendiente de decisión y representación." , pendingAutomation: [] } }];
  return [simple, weapon, armor, finite, spell, storage, custom];
}
