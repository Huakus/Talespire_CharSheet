import type { CharacterV2 } from "../character/character-v2";
import type { CharacterInventoryItemV2 } from "../character/character-inventory-model";
import { inventoryEquipmentDefinition } from "./equipment-live";

export function equipmentSlotCapacity(item: CharacterInventoryItemV2, level: number): number {
  if (!item.rules || item.quantity < 1 || !item.equipped || item.requiresAttunement && !item.attuned) return 0;
  return (inventoryEquipmentDefinition(item)?.capabilities ?? []).filter((cap) => cap.activation === "passive").flatMap((cap) => cap.effects).reduce((sum, effect) => sum + (effect.kind === "spell-slot-capacity" && effect.level === level ? effect.amount : 0), 0);
}
export function projectEquipmentSpellSlots(character: CharacterV2, level: number): { maximum: number; used: number } {
  const base = character.spellcasting.slots[String(level)] ?? { maximum: 0, used: 0 };
  const restored = character.spellcasting.restoredSlots ?? [];
  const converted = restored.filter(s => s.sourceLevel === level).length;
  return character.inventory.reduce((state, item) => {
    const capacity = equipmentSlotCapacity(item, level);
    return { maximum: state.maximum + capacity, used: state.used + Math.min(capacity, item.rules?.slotUsage[String(level)] ?? 0) };
  }, { maximum: base.maximum - converted + restored.filter(s => s.level === level).length, used: base.used - converted + restored.filter(s => s.level === level && s.used).length });
}
/** Spend the source slot in place; removing or transferring the garment never refills it. */
export function spendEquipmentSpellSlot(character: CharacterV2, level: number): boolean {
  const restored = character.spellcasting.restoredSlots?.find(s => s.level === level && !s.used);
  if (restored) { restored.used = true; return true; }
  const item = character.inventory.find((entry) => equipmentSlotCapacity(entry, level) > (entry.rules?.slotUsage[String(level)] ?? 0));
  if (!item?.rules) return false;
  item.rules.slotUsage[String(level)] = (item.rules.slotUsage[String(level)] ?? 0) + 1;
  return true;
}

/** Slots converted by a pearl remain reserved in their original pool until its recovery. */
export function recoverableBaseSpellSlots(character: CharacterV2, level: number): number {
  return Math.max(0, (character.spellcasting.slots[String(level)]?.used ?? 0) - (character.spellcasting.restoredSlots ?? []).filter(s => s.sourceLevel === level).length);
}
export function inventorySlotRecovery(item: CharacterInventoryItemV2, featureId: string): number | null {
  const effects = inventoryEquipmentDefinition(item)?.capabilities.find(c => c.id === featureId)?.effects;
  return effects?.length === 1 && effects[0]?.kind === "spell-slot-recovery" ? effects[0].maximumLevel : null;
}
export function recoverableEquipmentSlotCount(character: CharacterV2, level: number): number {
  return recoverableBaseSpellSlots(character, level) + character.spellcasting.restoredSlots.filter(s => s.level === level && s.used).length + character.inventory.reduce((n, item) => n + Math.min(equipmentSlotCapacity(item, level), item.rules?.slotUsage[String(level)] ?? 0), 0);
}
/** Restore a spent slot at the same level, regardless of its native source. */
export function restoreExpendedSpellSlot(character: CharacterV2, level: number): void {
  if (recoverableBaseSpellSlots(character, level) > 0) { character.spellcasting.slots[String(level)]!.used--; return; }
  const restored = character.spellcasting.restoredSlots.find(s => s.level === level && s.used);
  if (restored) { restored.used = false; return; }
  const source = character.inventory.find(i => equipmentSlotCapacity(i, level) > 0 && (i.rules?.slotUsage[String(level)] ?? 0) > 0);
  if (!source?.rules) throw new Error("No queda un espacio gastado de ese nivel que se pueda recuperar.");
  source.rules.slotUsage[String(level)]!--;
}
export function restoreEquipmentSpellSlot(character: CharacterV2, item: CharacterInventoryItemV2, featureId: string, level: number | undefined): void {
  const maximum = inventorySlotRecovery(item, featureId);
  if (maximum === null) return;
  if (!Number.isInteger(level) || level! < 1 || level! > 9 || recoverableEquipmentSlotCount(character, level!) < 1) throw new Error("Elegí un espacio de conjuro gastado que todavía se pueda recuperar.");
  const hp = character.spellcasting.druid?.form?.currentHp ?? character.combat.hitPoints.current;
  if (hp <= 0 || character.combat.conditions.some(c => ["incapacitated", "unconscious", "stunned", "paralyzed", "petrified", "dead", "silenced"].includes(c.key))) throw new Error("Necesitás poder actuar y pronunciar la palabra de activación.");
  if (level! <= maximum) { restoreExpendedSpellSlot(character, level!); return; }
  if (recoverableBaseSpellSlots(character, level!) < 1) throw new Error("La recuperación de un espacio de objeto por encima del límite necesita convertir su reserva de origen.");
  const pact = character.builder?.classKey === "warlock" || /brujo|bruja|warlock/i.test(character.identity.className);
  character.spellcasting.restoredSlots.push({ sourceItemId: item.id, sourceLevel: level!, level: maximum, used: false, reset: pact ? "short-rest" : "long-rest" });
}
export function resetRestoredEquipmentSlots(character: CharacterV2, reset: string): void {
  if (!character.spellcasting.restoredSlots) return;
  if (reset === "short-rest") for (const source of character.spellcasting.restoredSlots.filter(s => s.reset === "short-rest")) {
    const slot = character.spellcasting.slots[String(source.sourceLevel)]; if (slot) slot.used = 0;
  }
  character.spellcasting.restoredSlots = character.spellcasting.restoredSlots.filter(s => reset !== "long-rest" && s.reset !== reset);
}
export function resetEquipmentSlots(item: CharacterInventoryItemV2, reset: string, character?: CharacterV2): CharacterInventoryItemV2 {
  if (!item.rules) return item;
  const pact = character?.builder?.classKey === "warlock" || /brujo|bruja|warlock/i.test(character?.identity.className ?? "");
  if (reset !== "long-rest" && !(reset === "short-rest" && pact)) return item;
  return { ...item, rules: { ...item.rules, slotUsage: {} } };
}
