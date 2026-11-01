import {
  CharacterInventoryItemV2Schema,
  type CharacterInventoryItemDraft,
  type CharacterInventoryItemV2,
} from "../character/character-inventory-model";
import { equipmentPlainDescription, inventoryEquipmentDefinition } from "./equipment-live";
import { equipmentRollBounds } from "./equipment-resource-runtime";

export interface EquipmentLastChargeRule {
  sides: number | null;
  outcome: "destroy" | "replace" | "nonmagical" | "keep";
  threshold: number;
  replacementKey: string | null;
  refillOnMaximum: string | null;
}

export interface EquipmentLastChargeOptions {
  replacement?: CharacterInventoryItemDraft;
  recoveryRoll?: number;
}

export function equipmentLastChargeRule(item: Pick<CharacterInventoryItemV2, "rules">): EquipmentLastChargeRule | null {
  const effect = inventoryEquipmentDefinition(item)?.capabilities.flatMap(c => c.effects)
    .find(e => e.kind === "last-charge-destruction" || e.kind === "last-charge-resolution");
  if (effect?.kind === "last-charge-destruction") return {
    sides: effect.sides, outcome: "destroy", threshold: effect.destroyAtOrBelow,
    replacementKey: null, refillOnMaximum: null,
  };
  if (effect?.kind === "last-charge-resolution") return {
    sides: effect.sides, outcome: effect.outcome, threshold: 1,
    replacementKey: effect.replacementKey, refillOnMaximum: effect.refillOnMaximum,
  };
  return null;
}

export function markEquipmentLastCharge(item: CharacterInventoryItemV2, previousCurrent: number): CharacterInventoryItemV2 {
  if (previousCurrent > 0 && item.rules && item.charges?.current === 0 && equipmentLastChargeRule(item)) {
    item.rules.lastChargePending = true;
  }
  return item;
}

export function assertEquipmentLastChargeResolved(item: CharacterInventoryItemV2): void {
  if (item.rules?.lastChargePending) throw new Error("Resolvé primero la tirada o consecuencia de la última carga.");
  if (equipmentLastChargeRule(item) && item.quantity !== 1) throw new Error("Separá las copias con cargas individuales antes de usarlas.");
}

/** Physical identity and ownership survive; the new form supplies every active property. */
function replaceForm(item: CharacterInventoryItemV2, replacement: CharacterInventoryItemDraft, key: string): CharacterInventoryItemV2 {
  const definition = inventoryEquipmentDefinition(replacement);
  if (replacement.catalog?.contentKey !== key || !definition) throw new Error("Falta la definición correcta de la nueva forma en el catálogo.");
  const oldDefinition = inventoryEquipmentDefinition(item);
  const personalName = oldDefinition && item.name !== oldDefinition.name;
  return CharacterInventoryItemV2Schema.parse({
    ...replacement, id: item.id, order: item.order, group: item.group, quantity: item.quantity,
    cost: item.cost, equipped: item.equipped,
    attuned: replacement.requiresAttunement && item.attuned,
    name: personalName ? item.name : replacement.name,
    // Changing form is not a recovery event.
    charges: replacement.charges ? { ...replacement.charges, current: 0 } : null,
    effect: { description: "", active: false },
    features: replacement.features.map(f => ({ ...f, active: false })),
    rules: { ...replacement.rules!, personalDescription: "", lastChargePending: false },
  });
}

/** An exhausted ring remains a physical possession, without a link granting its former magic. */
function nonmagicalForm(item: CharacterInventoryItemV2): CharacterInventoryItemV2 {
  const definition = structuredClone(inventoryEquipmentDefinition(item)!);
  definition.id += ":inert";
  definition.name = "Anillo sin magia";
  definition.aliases = [];
  definition.baseDefinitionId = null;
  definition.magical = false;
  definition.rarity = "none";
  definition.consumable = false;
  definition.properties = [];
  definition.resources = [];
  definition.capabilities = [];
  definition.requirements = { attunement: false, bearer: [], presence: "worn", explanation: "" };
  definition.economy = { basePrice: null, campaignPrice: null, explanation: "" };
  const sourceIds = definition.description[0]!.sourceIds;
  definition.description = [{ id: "description", type: "paragraph", section: "description",
    provenance: "reviewed-translation", sourceIds, text: "Anillo sin propiedades mágicas." }];
  definition.review = { identity: true, information: true, editorial: true, mechanics: true, unresolved: [] };
  return CharacterInventoryItemV2Schema.parse({
    ...item, name: definition.name, description: equipmentPlainDescription(definition),
    catalog: null, properties: [], charges: null, bonuses: [], features: [],
    armor: null, weapon: null, requiresAttunement: false, attuned: false, usable: false, consumable: false,
    effect: { description: "", active: false },
    rules: { ...item.rules!, definition, pending: [], personalDescription: "", lastChargePending: false, slotUsage: {}, storage: null },
  });
}

/** Validates all required rolls before changing anything; a missing second roll is safe to retry. */
export function resolveEquipmentLastCharge(
  item: CharacterInventoryItemV2,
  roll: number | null,
  options: EquipmentLastChargeOptions = {},
): CharacterInventoryItemV2 | null {
  const rule = equipmentLastChargeRule(item);
  if (!rule || !item.rules?.lastChargePending || item.charges?.current !== 0) throw new Error("No hay una tirada o consecuencia de última carga pendiente.");
  if (item.quantity !== 1) throw new Error("La comprobación corresponde a una copia individual del objeto.");
  if (rule.sides === null ? roll !== null : roll === null || !Number.isInteger(roll) || roll < 1 || roll > rule.sides || rule.threshold > rule.sides) {
    throw new Error(rule.sides === null ? "Esta consecuencia no requiere una tirada." : `Ingresá un resultado válido de 1d${rule.sides}.`);
  }
  if (rule.refillOnMaximum && roll === rule.sides) {
    const bounds = equipmentRollBounds(rule.refillOnMaximum), recovered = options.recoveryRoll;
    if (recovered === undefined || !Number.isInteger(recovered) || recovered < bounds.minimum || recovered > bounds.maximum) throw new Error(`Ingresá también el resultado válido de ${rule.refillOnMaximum}.`);
    return CharacterInventoryItemV2Schema.parse({ ...item, charges: { ...item.charges, current: Math.min(item.charges.maximum, recovered) }, rules: { ...item.rules, lastChargePending: false } });
  }
  if (options.recoveryRoll !== undefined) throw new Error("Este resultado no recupera cargas.");
  if (rule.sides === null || roll! <= rule.threshold) {
    if (rule.outcome === "destroy") return null;
    if (rule.outcome === "nonmagical") return nonmagicalForm(item);
    if (rule.outcome === "replace") {
      if (!rule.replacementKey || !options.replacement) throw new Error("Falta la definición de la nueva forma en el catálogo.");
      return replaceForm(item, options.replacement, rule.replacementKey);
    }
  }
  return CharacterInventoryItemV2Schema.parse({ ...item, rules: { ...item.rules, lastChargePending: false } });
}
