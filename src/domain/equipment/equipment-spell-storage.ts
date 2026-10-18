import { CharacterV2Schema, type CharacterV2 } from "../character/character-v2";
import { CharacterRevisionConflictError } from "../character/edit-character";
import { CharacterSpellV2Schema, SpellDefinitionSchema, type SpellDefinition, type SpellcastingAbility } from "../character/character-spell-model";
import { InventoryFeatureSchema } from "../character/character-inventory-model";
import { castCharacterSpell } from "../character/character-spells";
import { inventoryEquipmentDefinition } from "./equipment-live";
import type { JsonObject } from "../../shared/json";

interface Mutation { expectedRevision: number; updatedAt: string }
export interface StoreSpellInput {
  id: string; definition: SpellDefinition; slotLevel: number;
  ability: SpellcastingAbility; saveDc: number; attackBonus: number; abilityModifier: number;
  expenditureConfirmed: boolean;
}
function prepare(input: CharacterV2, itemId: string, options: Mutation) {
  const character = CharacterV2Schema.parse(input);
  if (character.revision !== options.expectedRevision) throw new CharacterRevisionConflictError(options.expectedRevision, character.revision);
  const item = character.inventory.find((i) => i.id === itemId);
  const resource = item && inventoryEquipmentDefinition(item)?.resources.find((r) => r.kind === "spell-storage");
  if (!item || !item.quantity || !item.rules?.storage || !resource?.maximum) throw new Error("El objeto no tiene almacenamiento de conjuros configurado.");
  if (!item.rules.storage.known) throw new Error("El contenido antiguo debe identificarse antes de modificarlo.");
  return { character, item, storage: item.rules.storage, capacity: resource.maximum };
}

/** Loading records a spell already cast into the ring, including its original caster's statistics. */
export function storeEquipmentSpell(input: CharacterV2, itemId: string, value: StoreSpellInput, options: Mutation): CharacterV2 {
  const { character, storage, capacity } = prepare(input, itemId, options);
  const definition = SpellDefinitionSchema.parse(value.definition);
  if (!value.expenditureConfirmed) throw new Error("Confirmá que el lanzador gastó el espacio para cargar el objeto.");
  if (!Number.isInteger(value.slotLevel) || value.slotLevel < Math.max(1, definition.level) || value.slotLevel > 9) throw new Error("Nivel de espacio inválido para almacenar este conjuro.");
  if (definition.level === 0) throw new Error("El anillo almacena conjuros de nivel 1 o superior.");
  if (storage.spells.reduce((sum, s) => sum + s.slotLevel, 0) + value.slotLevel > capacity) throw new Error("El conjuro supera la capacidad libre del objeto.");
  if (storage.spells.some((s) => s.id === value.id)) throw new Error("Esta carga ya fue registrada.");
  storage.spells.push({ id: value.id, slotLevel: value.slotLevel, definition: JSON.parse(JSON.stringify(definition)) as JsonObject, ability: value.ability, saveDc: value.saveDc, attackBonus: value.attackBonus, abilityModifier: value.abilityModifier });
  return CharacterV2Schema.parse({ ...character, revision: character.revision + 1, metadata: { ...character.metadata, updatedAt: options.updatedAt } });
}

/** Consumes one stored spell atomically. It never spends the bearer's spell slots. */
export function castEquipmentStoredSpell(input: CharacterV2, itemId: string, storedId: string, options: Mutation & { concentrationCondition?: CharacterV2["combat"]["conditions"][number] }): CharacterV2 {
  const { character, item, storage } = prepare(input, itemId, options);
  const stored = storage.spells.find((s) => s.id === storedId);
  if (!stored) throw new Error("El conjuro ya no está almacenado.");
  const definition = SpellDefinitionSchema.parse(stored.definition);
  // The ordinary item-spell pipeline enforces equipment/attunement and concentration.
  const featureId = `stored:${storedId}`;
  item.features.push(InventoryFeatureSchema.parse({ id: featureId, order: item.features.length, kind: "action", name: definition.name, description: "" }));
  const spell = CharacterSpellV2Schema.parse({ id: storedId, order: 0, name: definition.name, level: definition.level, prepared: true, definition, casting: { kind: "item", source: `inventory:${itemId}:${featureId}`, ability: stored.ability, key: storedId, level: stored.slotLevel, traitId: null }, effect: { active: false, description: "" } });
  character.spellcasting.spells.push(spell);
  const next = castCharacterSpell(character, storedId, stored.slotLevel, options);
  const nextItem = next.inventory.find((i) => i.id === itemId)!;
  nextItem.rules!.storage!.spells = nextItem.rules!.storage!.spells.filter((s) => s.id !== storedId);
  nextItem.features = nextItem.features.filter((f) => f.id !== featureId);
  next.spellcasting.spells = next.spellcasting.spells.filter((s) => s.id !== storedId);
  return CharacterV2Schema.parse(next);
}
