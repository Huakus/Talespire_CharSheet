import {
  CharacterV2Schema,
  IsoTimestampSchema,
  StableIdSchema,
  type CharacterV2,
} from "./character-v2";
import { CharacterRevisionConflictError } from "./edit-character";
import { inventoryEquipmentDefinition, equipmentBearerIssue } from "../equipment/equipment-live";
import { equipmentRollBounds } from "../equipment/equipment-resource-runtime";
import { resetEquipmentSlots } from "../equipment/equipment-spell-slots";
import { activateCoreFeature, coreFeatureIssue, isLucentCore, restLucentCore, lucentCoreState, type CoreResonance } from "../equipment/equipment-lucent-core";
import { inventoryHealingExpression } from "../equipment/equipment-healing";
import { equipmentClassResourceIssue, restoreEquipmentClassResources } from "../equipment/equipment-class-resources";
import { abilityModifier, projectAbilityScore } from "./character-projection";
import {
  CharacterInventoryItemV2Schema,
  type CharacterInventoryItemV2,
} from "./character-inventory-model";

export * from "./character-inventory-model";

export class InventoryItemNotFoundError extends Error {
  constructor(readonly itemId: string) {
    super(`Inventory item ${itemId} was not found`);
    this.name = "InventoryItemNotFoundError";
  }
}

export class AttunementLimitError extends Error {
  constructor(readonly maximum: number) {
    super(`A character cannot be attuned to more than ${maximum} items`);
    this.name = "AttunementLimitError";
  }
}

export class InventoryUseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryUseError";
  }
}

export class InventoryEquipmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryEquipmentError";
  }
}

export class InventoryFeatureUseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryFeatureUseError";
  }
}

interface InventoryMutationOptions {
  expectedRevision: number;
  updatedAt: string;
  splitItemId?: string;
}

function normalized(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

function itemClassification(item: CharacterInventoryItemV2): string {
  return normalized([
    item.category,
    item.name,
    item.armor?.armorCategory ?? "",
    ...item.properties,
  ].join(" "));
}

export function inventoryEquipmentSlot(item: CharacterInventoryItemV2): string | null {
  const value = itemClassification(item);
  if (item.weapon) return null;
  if (value.includes("shield") || value.includes("escudo")) return "shield";
  if (/(boot|bota|shoe|zapato|slipper|calzado)/.test(value)) return "feet";
  if (/(cloak|cape|capa|manto|back slot)/.test(value)) return "back";
  if (/(helmet|helm|casco|hat|sombrero|headband|diadema)/.test(value)) return "head";
  if (/(glove|guante|gauntlet|guantelete|bracer|brazal)/.test(value)) return "hands-worn";
  if (/(belt|cinturon|cinturón)/.test(value)) return "waist";
  if (/(amulet|amuleto|necklace|collar)/.test(value)) return "neck";
  if (item.armor || /(armor|armadura|tunic|tunica|túnica|robe|vestimenta)/.test(value)) return "body";
  return null;
}

export function inventoryItemHandCost(item: CharacterInventoryItemV2): number {
  const value = itemClassification(item);
  if (value.includes("shield") || value.includes("escudo")) return 1;
  if (!item.weapon) return 0;
  return item.properties.some((property) => {
    const normalizedProperty = normalized(property);
    return normalizedProperty.includes("two-handed") || normalizedProperty.includes("two handed") || normalizedProperty.includes("dos manos");
  }) ? 2 : 1;
}

export function inventoryItemsCanStack(
  left: CharacterInventoryItemV2,
  right: CharacterInventoryItemV2,
): boolean {
  if (left.rules?.storage || right.rules?.storage || inventoryEquipmentDefinition(left)?.capabilities.some((c) => c.effects.some((e) => e.kind === "spell-slot-capacity")) || inventoryEquipmentDefinition(right)?.capabilities.some((c) => c.effects.some((e) => e.kind === "spell-slot-capacity"))) return false;
  if (left.equipped || right.equipped || left.attuned || right.attuned) return false;
  if (left.charges || right.charges || left.features.some((f) => f.uses) || right.features.some((f) => f.uses)) return false;
  const comparable = (item: CharacterInventoryItemV2) => {
    const { id: _id, order: _order, quantity: _quantity, equipped: _equipped, attuned: _attuned, ...rest } = item;
    return rest;
  };
  return normalized(left.name) === normalized(right.name) &&
    JSON.stringify(comparable(left)) === JSON.stringify(comparable(right));
}

function prepare(
  input: CharacterV2,
  options: InventoryMutationOptions,
): { character: CharacterV2; updatedAt: string } {
  const character = CharacterV2Schema.parse(input);
  const updatedAt = IsoTimestampSchema.parse(options.updatedAt);
  if (character.revision !== options.expectedRevision) {
    throw new CharacterRevisionConflictError(
      options.expectedRevision,
      character.revision,
    );
  }
  return { character, updatedAt };
}

function finish(
  character: CharacterV2,
  inventory: CharacterV2["inventory"],
  updatedAt: string,
  actions = character.actions,
): CharacterV2 {
  const constitutionDelta = abilityModifier(projectAbilityScore({ ...character, inventory }, "constitution")) - abilityModifier(projectAbilityScore(character, "constitution"));
  const hitPointDelta = constitutionDelta * character.identity.level;
  const maximum = Math.max(0, character.combat.hitPoints.maximum + hitPointDelta);
  return CharacterV2Schema.parse({
    ...character,
    inventory: [...inventory].sort(
      (left, right) => left.order - right.order || left.id.localeCompare(right.id),
    ),
    actions,
    ...(hitPointDelta ? { combat: { ...character.combat, hitPoints: { ...character.combat.hitPoints, maximum, current: Math.max(0, Math.min(maximum, character.combat.hitPoints.current + hitPointDelta)) } } } : {}),
    revision: character.revision + 1,
    metadata: { ...character.metadata, updatedAt },
  });
}

export function upsertInventoryItem(
  input: CharacterV2,
  itemInput: CharacterInventoryItemV2,
  options: InventoryMutationOptions,
): CharacterV2 {
  const { character, updatedAt } = prepare(input, options);
  const previousItem = character.inventory.find((entry) => entry.id === itemInput.id);
  const item = CharacterInventoryItemV2Schema.parse({ ...itemInput, ...(previousItem?.rules && !itemInput.rules ? { rules: previousItem.rules } : {}) });
  if (item.equipped && item.quantity !== 1) {
    throw new InventoryEquipmentError("Los objetos equipados deben tener cantidad 1");
  }
  const inventory = [
    ...character.inventory.filter((existing) => existing.id !== item.id),
    item,
  ];
  if (item.attuned && inventory.filter((entry) => entry.attuned).length > 3) {
    throw new AttunementLimitError(3);
  }
  return finish(character, inventory, updatedAt);
}

export function removeInventoryItem(
  input: CharacterV2,
  itemIdInput: string,
  options: InventoryMutationOptions,
): CharacterV2 {
  const { character, updatedAt } = prepare(input, options);
  const itemId = StableIdSchema.parse(itemIdInput);
  if (!character.inventory.some((item) => item.id === itemId)) {
    throw new InventoryItemNotFoundError(itemId);
  }
  return finish(
    character,
    character.inventory.filter((item) => item.id !== itemId),
    updatedAt,
    character.actions.filter((action) => action.inventoryItemId !== itemId),
  );
}

export function setInventoryItemEquipped(
  input: CharacterV2,
  itemIdInput: string,
  equipped: boolean,
  options: InventoryMutationOptions,
): CharacterV2 {
  const { character, updatedAt } = prepare(input, options);
  const itemId = StableIdSchema.parse(itemIdInput);
  const target = character.inventory.find((item) => item.id === itemId);
  if (!target) throw new InventoryItemNotFoundError(itemId);
  if (equipped && target.quantity < 1) {
    throw new InventoryEquipmentError("No se puede equipar un objeto sin unidades disponibles");
  }

  const targetSlot = inventoryEquipmentSlot(target);
  const targetHandCost = inventoryItemHandCost(target);
  const occupiedHands = character.inventory
    .filter((item) => item.equipped && item.id !== itemId)
    .reduce((total, item) => total + inventoryItemHandCost(item), 0);
  if (equipped && targetHandCost > 0 && occupiedHands + targetHandCost > 2) {
    throw new InventoryEquipmentError("No hay manos libres suficientes para equipar este objeto");
  }

  const splitItemId = options.splitItemId === undefined ? null : StableIdSchema.parse(options.splitItemId);
  if (equipped && target.quantity > 1 && splitItemId === null) {
    throw new InventoryEquipmentError("Se necesita un identificador para separar el stack equipado");
  }

  const inventory = character.inventory.flatMap((item) => {
    if (item.id === itemId) {
      const equippedItem = {
        ...item,
        quantity: equipped ? 1 : item.quantity,
        equipped,
        attuned: equipped ? item.attuned : false,
        effect: equipped ? item.effect : { ...item.effect, active: false },
        features: equipped
          ? item.features
          : item.features.map((feature) => ({ ...feature, active: false })),
      };
      return equipped && item.quantity > 1
        ? [equippedItem, {
            ...item,
            id: splitItemId!,
            order: item.order + 1,
            quantity: item.quantity - 1,
            equipped: false,
            attuned: false,
            effect: { ...item.effect, active: false },
            features: item.features.map((feature) => ({ ...feature, active: false })),
          }]
        : [equippedItem];
    }
    if (equipped && targetSlot !== null && inventoryEquipmentSlot(item) === targetSlot) {
      return [{
        ...item,
        equipped: false,
        attuned: false,
        effect: { ...item.effect, active: false },
        features: item.features.map((feature) => ({ ...feature, active: false })),
      }];
    }
    return [item];
  });
  const actions = equipped
    ? character.actions
    : character.actions.filter((action) => action.inventoryItemId !== itemId);
  return finish(character, inventory, updatedAt, actions);
}

export function setInventoryItemAttuned(
  input: CharacterV2,
  itemIdInput: string,
  attuned: boolean,
  options: InventoryMutationOptions,
): CharacterV2 {
  const { character, updatedAt } = prepare(input, options);
  const itemId = StableIdSchema.parse(itemIdInput);
  const target = character.inventory.find((item) => item.id === itemId);
  if (!target) throw new InventoryItemNotFoundError(itemId);
  if (attuned && (!target.requiresAttunement || !target.equipped)) {
    throw new InventoryUseError("The item must require attunement and be equipped first");
  }
  const bearerIssue = attuned ? equipmentBearerIssue(character, target) : "";
  if (bearerIssue) throw new InventoryUseError(bearerIssue);
  if (attuned && character.inventory.some((item) => item.id !== itemId && item.attuned && (item.rules && target.rules && item.rules.definition.id === target.rules.definition.id || normalized(String(item.rules?.definition.name ?? item.name)) === normalized(String(target.rules?.definition.name ?? target.name))))) throw new InventoryUseError("No podés sintonizarte con dos copias del mismo objeto a la vez");
  if (attuned && character.inventory.filter((item) => item.id !== itemId && item.attuned).length >= 3) {
    throw new AttunementLimitError(3);
  }
  return finish(
    character,
    character.inventory.map((item) =>
      item.id === itemId ? {
        ...item,
        attuned,
        effect: attuned || !item.requiresAttunement ? item.effect : { ...item.effect, active: false },
        features: attuned
          ? item.features
          : item.features.map((feature) => ({ ...feature, active: false })),
      } : item,
    ),
    updatedAt,
  );
}

export function useInventoryItem(
  input: CharacterV2,
  itemIdInput: string,
  options: InventoryMutationOptions,
): CharacterV2 {
  const { character, updatedAt } = prepare(input, options);
  const itemId = StableIdSchema.parse(itemIdInput);
  const target = character.inventory.find((item) => item.id === itemId);
  if (!target) throw new InventoryItemNotFoundError(itemId);
  if (!target.usable) throw new InventoryUseError(`${target.name} is not usable`);
  if (!target.equipped && !target.consumable) {
    throw new InventoryUseError(`${target.name} debe estar equipado para poder usarse`);
  }

  if (target.requiresAttunement && !target.attuned) throw new InventoryUseError("El objeto debe estar sintonizado para poder usarse");
  const bearerIssue = equipmentBearerIssue(character, target);
  if (bearerIssue) throw new InventoryUseError(bearerIssue);

  let remove = false;
  const inventory = character.inventory.map((item) => {
    if (item.id !== itemId) return item;
    if (item.charges !== null) {
      if (item.charges.current < 1) {
        throw new InventoryUseError(`${item.name} has no charges remaining`);
      }
      return {
        ...item,
        charges: { ...item.charges, current: item.charges.current - 1 },
      };
    }
    if (!item.consumable) return item;
    if (item.quantity < 1) {
      throw new InventoryUseError(`${item.name} has no quantity remaining`);
    }
    remove = item.quantity === 1;
    return { ...item, quantity: item.quantity - 1 };
  });
  return finish(
    character,
    remove ? inventory.filter((item) => item.id !== itemId) : inventory,
    updatedAt,
    remove
      ? character.actions.filter((action) => action.inventoryItemId !== itemId)
      : character.actions,
  );
}

export function setInventoryFeatureActive(
  input: CharacterV2,
  itemIdInput: string,
  featureId: string,
  active: boolean,
  options: InventoryMutationOptions,
): CharacterV2 {
  const { character, updatedAt } = prepare(input, options);
  const itemId = StableIdSchema.parse(itemIdInput);
  const item = character.inventory.find((entry) => entry.id === itemId);
  if (!item) throw new InventoryItemNotFoundError(itemId);
  const feature = item.features.find((entry) => entry.id === featureId);
  if (!feature) throw new InventoryFeatureUseError("La capacidad ya no existe en el objeto");
  const bearerIssue = equipmentBearerIssue(character, item, featureId);
  if (bearerIssue) throw new InventoryFeatureUseError(bearerIssue);
  const coreIssue = coreFeatureIssue(item, featureId);
  if (coreIssue) throw new InventoryFeatureUseError(coreIssue);
  if (!feature.toggleable && active) {
    throw new InventoryFeatureUseError("La capacidad no mantiene un estado activo");
  }
  if (active && (!item.equipped || (item.requiresAttunement && !item.attuned))) {
    throw new InventoryFeatureUseError("El objeto debe estar equipado y, cuando corresponda, sintonizado");
  }
  return finish(character, character.inventory.map((entry) => entry.id !== itemId ? entry : {
    ...entry,
    features: entry.features.map((candidate) => candidate.id === featureId
      ? { ...candidate, active }
      : candidate),
  }), updatedAt);
}

export function useInventoryFeature(
  input: CharacterV2,
  itemIdInput: string,
  featureId: string,
  options: InventoryMutationOptions,
): CharacterV2 {
  const { character, updatedAt } = prepare(input, options);
  const itemId = StableIdSchema.parse(itemIdInput);
  const item = character.inventory.find((entry) => entry.id === itemId);
  if (!item) throw new InventoryItemNotFoundError(itemId);
  const feature = item.features.find((entry) => entry.id === featureId);
  if (!feature) throw new InventoryFeatureUseError("La capacidad ya no existe en el objeto");
  const bearerIssue = equipmentBearerIssue(character, item, featureId);
  if (bearerIssue) throw new InventoryFeatureUseError(bearerIssue);
  const coreIssue = coreFeatureIssue(item, featureId);
  if (coreIssue) throw new InventoryFeatureUseError(coreIssue);
  if (!item.equipped && !item.consumable) {
    throw new InventoryFeatureUseError("El objeto debe estar equipado para usar esta capacidad");
  }
  if (item.requiresAttunement && !item.attuned) {
    throw new InventoryFeatureUseError("El objeto debe estar sintonizado para usar esta capacidad");
  }
  if (feature.toggleable && feature.active) {
    throw new InventoryFeatureUseError("La capacidad ya está activa");
  }
  if (feature.chargeCost > 0 && (item.charges === null || item.charges.current < feature.chargeCost)) {
    throw new InventoryFeatureUseError(`Se necesitan ${feature.chargeCost} carga(s) para usar ${feature.name}`);
  }
  if (feature.uses !== null && feature.uses.current < 1) {
    throw new InventoryFeatureUseError(`${feature.name} no tiene usos disponibles`);
  }
  const consumeQuantity = inventoryEquipmentDefinition(item)?.capabilities.find((capability) => capability.id === feature.id)?.consumeQuantity ?? 0;
  if (item.quantity < Math.max(1, consumeQuantity)) throw new InventoryFeatureUseError("No quedan unidades suficientes del objeto");
  const classResourceIssue = equipmentClassResourceIssue(character, item, featureId);
  if (classResourceIssue) throw new InventoryFeatureUseError(classResourceIssue);
  const inventory = character.inventory.map((entry) => {
    if (entry.id !== itemId) return entry;
    return activateCoreFeature({
      ...entry,
      quantity: entry.quantity - consumeQuantity,
      charges: entry.charges === null || feature.chargeCost === 0
        ? entry.charges
        : { ...entry.charges, current: entry.charges.current - feature.chargeCost },
      features: entry.features.map((candidate) => candidate.id !== featureId ? candidate : {
        ...candidate,
        active: candidate.toggleable ? true : candidate.active,
        uses: candidate.uses === null
          ? null
          : { ...candidate.uses, current: candidate.uses.current - 1 },
      }),
    }, featureId);
  }).filter((entry) => entry.id !== itemId || consumeQuantity === 0 || entry.quantity > 0);
  restoreEquipmentClassResources(character, item, featureId);
  return finish(character, inventory, updatedAt, consumeQuantity && item.quantity === consumeQuantity ? character.actions.filter((action) => action.inventoryItemId !== itemId) : character.actions);
}

export function resetInventoryItemResources(
  item: CharacterInventoryItemV2,
  reset: string,
  character?: CharacterV2,
): CharacterInventoryItemV2 {
  const definition = inventoryEquipmentDefinition(item);
  const resource = definition?.resources.find((entry) => entry.kind !== "spell-storage");
  const typedRecovery = resource?.recovery;
  const mayReset = !definition || typedRecovery?.kind === "event" && typedRecovery.amount.kind === "full" && (typedRecovery.event === reset || reset === "long-rest" && typedRecovery.event === "short-rest");
  return CharacterInventoryItemV2Schema.parse({
    ...restLucentCore(resetEquipmentSlots(item, reset, character), reset),
    charges: mayReset && item.charges !== null && (item.charges.reset === reset || (reset === "long-rest" && item.charges.reset === "short-rest"))
      ? { ...item.charges, current: item.charges.maximum }
      : item.charges,
    features: item.features.map((feature) => ({
      ...feature,
      uses: feature.uses !== null && (feature.uses.reset === reset || (reset === "long-rest" && feature.uses.reset === "short-rest"))
        ? { ...feature.uses, current: feature.uses.maximum }
        : feature.uses,
    })),
  });
}

/** Consume and apply a rolled potion to its bearer in one saved character mutation. */
export function useInventoryHealingFeature(input: CharacterV2, itemId: string, featureId: string, healing: number, options: InventoryMutationOptions): CharacterV2 {
  const { character }=prepare(input,options), item=character.inventory.find((entry)=>entry.id===itemId);
  if (character.combat.hitPoints.current <= 0 || character.combat.conditions.some((condition)=>["incapacitated","unconscious","stunned","paralyzed","petrified","dead"].includes(condition.key))) throw new InventoryFeatureUseError("Necesitás poder actuar para beber la poción vos mismo; otra criatura puede administrártela.");
  const expression=item && inventoryHealingExpression(item,featureId);
  if (!expression) throw new InventoryFeatureUseError("Esta capacidad no es una curación consumible simple.");
  const bounds=equipmentRollBounds(expression);
  if (!Number.isInteger(healing) || healing < Math.max(1,bounds.minimum) || healing > bounds.maximum) throw new InventoryFeatureUseError(`Ingresá un resultado válido de ${expression}.`);
  const spent=useInventoryFeature(character,itemId,featureId,options);
  if (spent.spellcasting.druid?.form) {
    const form=spent.spellcasting.druid.form;form.currentHp=Math.min(form.maximumHp,form.currentHp+healing);
  } else spent.combat.hitPoints.current=Math.min(spent.combat.hitPoints.maximum,spent.combat.hitPoints.current+healing);
  return CharacterV2Schema.parse(spent);
}

export type LucentCoreAction =
  | { kind: "configure"; resonance: CoreResonance; d20: number }
  | { kind: "wear"; d20: number }
  | { kind: "recover"; longRestCompleted: boolean; crystalInserted: boolean }
  | { kind: "repair"; longRestCompleted: boolean; materialsConfirmed: boolean; crystalConfirmed: boolean }
  | { kind: "elapsed"; rounds: number }
  | { kind: "end" };

/** Per-copy core state. Confirmed material use is never guessed from a wallet balance. */
export function performLucentCoreAction(input: CharacterV2, itemIdInput: string, action: LucentCoreAction, options: InventoryMutationOptions): CharacterV2 {
  const { character, updatedAt } = prepare(input, options), itemId = StableIdSchema.parse(itemIdInput);
  const item = character.inventory.find((entry) => entry.id === itemId);
  if (!item || !isLucentCore(item)) throw new InventoryUseError("Este objeto no es el Núcleo Luciente Adaptado.");
  if (!["elapsed", "end"].includes(action.kind)) {
    const issue = equipmentBearerIssue(character,item);
    if (issue) throw new InventoryUseError(issue);
    if (!item.equipped || item.requiresAttunement && !item.attuned) throw new InventoryUseError("Equipá y sintonizá el núcleo antes de utilizarlo.");
  }
  const state = structuredClone(lucentCoreState(item));
  let charges = item.charges;
  if (action.kind === "configure" || action.kind === "wear") {
    if (!Number.isInteger(action.d20) || action.d20 < 1 || action.d20 > 20) throw new InventoryUseError("Ingresá el resultado de un d20, entre 1 y 20.");
  }
  if (action.kind === "configure") {
    if (!["green","blue","violet"].includes(action.resonance)) throw new InventoryUseError("Resonancia inexistente.");
    if (state.resonance === action.resonance) throw new InventoryUseError("Esta resonancia ya está configurada.");
    const total = action.d20 + abilityModifier(projectAbilityScore(character,"intelligence")) + 2 + Math.floor((character.identity.level-1)/4);
    state.lastCheckTotal = total;
    if (total >= 12) { state.resonance = action.resonance; state.active = null; state.remainingRounds = 0; }
  } else if (action.kind === "wear") {
    if (!state.wearCheckPending) throw new InventoryUseError("No hay una tirada de desgaste pendiente.");
    state.wearCheckPending = false;
    if (action.d20 === 1) { state.unstable = true; if (state.active === "violet") { state.active = null; state.remainingRounds = 0; } }
  } else if (action.kind === "recover") {
    if (action.longRestCompleted !== true || action.crystalInserted !== true) throw new InventoryUseError("La recarga requiere confirmar el descanso largo y un fragmento de Cristal Luciente insertado.");
    if (state.wearCheckPending) throw new InventoryUseError("Resolvé el desgaste pendiente antes de recargar.");
    if (!charges || charges.maximum !== 3) throw new InventoryUseError("El contador del núcleo no es válido.");
    charges = { ...charges, current: 3 };
    state.spentSinceRest = 0; state.active = null; state.remainingRounds = 0;
  } else if (action.kind === "repair") {
    if (!state.unstable) throw new InventoryUseError("El núcleo no está inestable.");
    if (action.longRestCompleted !== true || action.materialsConfirmed !== true || action.crystalConfirmed !== true) throw new InventoryUseError("Confirmá el descanso largo, los materiales metálicos de 25 po y el fragmento de Cristal Luciente.");
    state.unstable = false;
  } else if (action.kind === "elapsed") {
    if (!Number.isInteger(action.rounds) || action.rounds < 1 || action.rounds > 100) throw new InventoryUseError("El tiempo debe ser de 1 a 100 rondas.");
    state.remainingRounds = Math.max(0,state.remainingRounds-action.rounds);
    if (state.remainingRounds === 0) state.active = null;
  } else if (action.kind === "end") { state.active = null; state.remainingRounds = 0; }
  else throw new InventoryUseError("Operación del núcleo inexistente.");
  return finish(character,character.inventory.map((entry) => entry.id !== itemId ? entry : { ...entry, charges, rules: { ...entry.rules!, lucentCore: state } }),updatedAt);
}

/** Explicitly confirmed recovery event; random recovery never becomes a full reset. */
export function recoverInventoryItem(input: CharacterV2, itemId: string, event: string, rolled: number | undefined, options: InventoryMutationOptions): CharacterV2 {
  const { character, updatedAt } = prepare(input, options);
  const item = character.inventory.find((entry) => entry.id === itemId);
  if (!item) throw new InventoryItemNotFoundError(itemId);
  if (isLucentCore(item)) throw new InventoryUseError("Usá la recarga condicionada del núcleo y confirmá el descanso largo y el cristal insertado.");
  const resources = inventoryEquipmentDefinition(item)?.resources.filter((r) => r.kind !== "spell-storage");
  if (resources?.length !== 1 || !item.charges) throw new InventoryUseError("El objeto no tiene una reserva recuperable configurada");
  const recovery = resources[0]!.recovery;
  if (recovery.kind !== "event" || recovery.event !== event) throw new InventoryUseError("Ese evento no recupera los usos de este objeto");
  let amount = item.charges.maximum;
  if (recovery.amount.kind === "fixed") amount = recovery.amount.amount;
  if (recovery.amount.kind === "roll") {
    const bounds = equipmentRollBounds(recovery.amount.expression);
    if (rolled === undefined || !Number.isInteger(rolled) || rolled < bounds.minimum || rolled > bounds.maximum) throw new InventoryUseError(`Se necesita un resultado válido de ${recovery.amount.expression}`);
    amount = Math.max(0, rolled);
  }
  return finish(character, character.inventory.map((entry) => entry.id !== itemId ? entry : { ...entry, charges: { ...item.charges!, current: Math.min(item.charges!.maximum, item.charges!.current + amount) } }), updatedAt);
}

/** Record an assisted effect's actual cost without guessing which power was used. */
export function spendInventoryItemCharges(input: CharacterV2, itemId: string, amount: number, options: InventoryMutationOptions): CharacterV2 {
  const { character, updatedAt } = prepare(input, options);
  const item = character.inventory.find((entry) => entry.id === itemId);
  if (item && isLucentCore(item)) throw new InventoryUseError("Usá una resonancia para registrar también su duración y desgaste.");
  if (!item?.charges || item.quantity < 1) throw new InventoryUseError("El objeto no tiene una reserva disponible.");
  if ((!item.equipped && !item.consumable) || item.requiresAttunement && !item.attuned) throw new InventoryUseError("Equipá y, si corresponde, sintonizá el objeto antes de usarlo.");
  const issue = equipmentBearerIssue(character, item); if (issue) throw new InventoryUseError(issue);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > item.charges.current) throw new InventoryUseError("El gasto debe ser positivo y no superar la reserva disponible.");
  return finish(character, character.inventory.map((entry) => entry.id !== itemId ? entry : { ...entry, charges: { ...item.charges!, current: item.charges!.current - amount } }), updatedAt);
}

/** Explicit bookkeeping for a whole consumable unit after its assisted resolution. */
export function consumeInventoryUnit(input: CharacterV2, itemId: string, options: InventoryMutationOptions): CharacterV2 {
  const { character, updatedAt } = prepare(input, options);
  const item = character.inventory.find((entry) => entry.id === itemId);
  if (!item?.consumable || item.quantity < 1) throw new InventoryUseError("No queda una unidad consumible de este objeto.");
  const inventory = character.inventory.flatMap((entry) => entry.id !== itemId ? [entry] : entry.quantity > 1 ? [{ ...entry, quantity: entry.quantity - 1 }] : []);
  return finish(character, inventory, updatedAt, item.quantity === 1 ? character.actions.filter((a) => a.inventoryItemId !== itemId) : character.actions);
}

export function resetInventoryCharges(
  input: CharacterV2,
  reset: string,
  options: InventoryMutationOptions,
): CharacterV2 {
  const { character, updatedAt } = prepare(input, options);
  return finish(
    character,
    character.inventory.map((item) => resetInventoryItemResources(item, reset, character)),
    updatedAt,
  );
}
