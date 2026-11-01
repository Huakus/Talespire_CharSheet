import { CharacterV2Schema, StableIdSchema, IsoTimestampSchema, type CharacterV2 } from "../character/character-v2";
import type { CharacterInventoryItemV2 } from "../character/character-inventory-model";
import { useInventoryFeature } from "../character/character-inventory";
import { applyCharacterResourceCommand } from "../character/character-resources";
import { CharacterRevisionConflictError } from "../character/edit-character";
import { abilityModifier, projectAbilityScore, hasBuilderFeat, proficiencyBonus } from "../character/character-projection";
import { martialConditionImmune } from "../character/martial-play";
import { druidCircle } from "../character/druid-catalog";
import { equipmentBearerIssue, inventoryEquipmentDefinition } from "./equipment-live";
import { equipmentRollBounds } from "./equipment-resource-runtime";

export function equipmentConsumableRule(item: Pick<CharacterInventoryItemV2, "rules">) {
  for (const capability of inventoryEquipmentDefinition(item)?.capabilities ?? []) {
    const effect = capability.effects.find(e => e.kind === "consumable-action");
    if (effect?.kind === "consumable-action") return { capability, rule: effect.rule };
  }
  return null;
}

export function classPoisonImmunity(c: CharacterV2): boolean {
  return c.builder?.classKey === "monk" && c.identity.level >= 10 || c.builder?.classKey === "druid" && c.identity.level >= 10 && druidCircle(c.builder) === "land";
}

function poisonConditionImmune(c: CharacterV2): boolean {
  if (classPoisonImmunity(c) || martialConditionImmune(c, "poisoned")) return true;
  return c.inventory.some(i => i.quantity > 0 && i.equipped && (!i.requiresAttunement || i.attuned) && !equipmentBearerIssue(c,i) && inventoryEquipmentDefinition(i)?.capabilities.some(cap => cap.activation === "passive" && cap.execution.mode === "automatic" && cap.effects.some(e => !e.condition && (e.kind === "condition" && e.conditionKey === "poisoned" && e.operation === "prevent" || e.kind === "defense" && e.defense === "immunity" && e.target === "poison"))));
}

function rollInBounds(value: number | undefined, expression: string): number {
  const bounds = equipmentRollBounds(expression);
  if (value === undefined || !Number.isSafeInteger(value) || value < bounds.minimum || value > bounds.maximum) throw new Error(`Ingresá un resultado válido de ${expression}.`);
  return value;
}

function total(value: number | undefined): number {
  if (value === undefined || !Number.isSafeInteger(value)) throw new Error("Ingresá el resultado total de la prueba o salvación.");
  return value;
}

function canAct(c: CharacterV2): void {
  if ((c.spellcasting.druid?.form?.currentHp ?? c.combat.hitPoints.current) <= 0 || c.combat.conditions.some(p => ["dead","incapacitated","unconscious","stunned","paralyzed","petrified"].includes(p.key))) throw new Error("El usuario necesita poder actuar; otra criatura puede administrarle una poción.");
}

function damage(c: CharacterV2, amount: number, type: "poison" | "fire" | "acid", updatedAt: string) {
  if (amount === 0) return { character: c, concentrationDc: null };
  if (type === "poison" && classPoisonImmunity(c)) return { character: c, concentrationDc: null };
  const result = applyCharacterResourceCommand(c, { kind: "damage", amount, damageType: type, magical: false }, { expectedRevision: c.revision, updatedAt });
  return { character: result.character, concentrationDc: result.effects.concentrationCheckDc };
}

export type EquipmentConsumableAction =
  | { kind: "alchemist-fire"; attackRoll: number; distanceFeet: number; targetConfirmed: boolean }
  | { kind: "acid"; attackRoll: number; distanceFeet: number; targetConfirmed: boolean; delivery: "splash" | "throw"; damageRoll?: number }
  | { kind: "potion-poison"; damageRoll: number; saveTotal: number; ingested: boolean };

export function equipmentImprovisedRangedAttack(source: CharacterV2, target: CharacterV2, attackRoll: number) {
  rollInBounds(attackRoll, "1d20");
  const dexterity = abilityModifier(projectAbilityScore(source, "dexterity"));
  const modifier = dexterity + (hasBuilderFeat(source, "tavern-brawler") ? proficiencyBonus(source.identity.level) : 0);
  return { hit: attackRoll !== 1 && (attackRoll === 20 || attackRoll + modifier >= target.combat.armorClass), critical: attackRoll === 20, damageModifier: dexterity };
}

export interface EquipmentConsumableOptions { expectedSourceRevision: number; expectedTargetRevision: number; updatedAt: string; effectId: string }

/** One save commits the consumed unit and the target's effect, even when the throw misses. */
export function useEquipmentConsumable(sourceInput: CharacterV2, targetInput: CharacterV2, itemId: string, action: EquipmentConsumableAction, options: EquipmentConsumableOptions): { source: CharacterV2; target: CharacterV2 } {
  let source = CharacterV2Schema.parse(sourceInput), target = source.id === targetInput.id ? source : CharacterV2Schema.parse(targetInput);
  const updatedAt = IsoTimestampSchema.parse(options.updatedAt), effectId = StableIdSchema.parse(options.effectId);
  if ([...source.equipmentEffects, ...target.equipmentEffects].some(e=>e.id===effectId)) throw new Error("La identidad del efecto ya está en uso.");
  if (source.revision !== options.expectedSourceRevision) throw new CharacterRevisionConflictError(options.expectedSourceRevision, source.revision);
  if (target.revision !== options.expectedTargetRevision) throw new CharacterRevisionConflictError(options.expectedTargetRevision, target.revision);
  const item = source.inventory.find(i => i.id === itemId), rule = item && equipmentConsumableRule(item);
  if (!item || !rule || rule.rule !== action.kind || rule.capability.consumeQuantity !== 1) throw new Error("El objeto no tiene esa forma de uso configurada.");
  canAct(source);
  let hit = true, acidDamage = 0;
  if (action.kind !== "potion-poison") {
    const attack = equipmentImprovisedRangedAttack(source, target, action.attackRoll);
    const range = action.kind === "acid" && action.delivery === "splash" ? 5 : 20;
    if (action.kind === "acid" && !["splash", "throw"].includes(action.delivery)) throw new Error("Elegí esparcir o lanzar el ácido.");
    if (!action.targetConfirmed || !Number.isFinite(action.distanceFeet) || action.distanceFeet < 0 || action.distanceFeet > range) throw new Error(`Confirmá un objetivo a ${range} pies o menos.`);
    hit = attack.hit;
    if (action.kind === "acid" && hit) acidDamage = Math.max(0, rollInBounds(action.damageRoll, attack.critical ? "4d6" : "2d6") + attack.damageModifier);
  } else {
    if (!action.ingested) throw new Error("Confirmá que el objetivo bebe la poción.");
    rollInBounds(action.damageRoll, "3d6"); total(action.saveTotal);
  }
  // All validation precedes consumption. No free-standing “use” can bypass target resolution.
  source = useInventoryFeature(source, itemId, rule.capability.id, { expectedRevision: source.revision, updatedAt, resolvedConsumable: true });
  if (source.id === target.id) target = source;
  if (action.kind === "alchemist-fire" && hit) {
    if (!target.equipmentEffects.some(e => e.kind === "alchemist-fire")) target.equipmentEffects.push({ id: effectId, kind: action.kind, sourceItemId: item.id, sourceName: item.name, conditionId: null, dice: 1, phase: "start", concentrationDc: null });
  } else if (action.kind === "acid" && hit) {
    const result = damage(target, acidDamage, "acid", updatedAt); target = result.character;
    if (result.concentrationDc !== null) target.equipmentEffects.push({ id: effectId, kind: "concentration-check", sourceItemId: item.id, sourceName: item.name, conditionId: null, dice: 1, phase: "end", concentrationDc: result.concentrationDc });
  } else if (action.kind === "potion-poison") {
    const result = damage(target, action.damageRoll, "poison", updatedAt); target = result.character;
    if (action.saveTotal < 13 && !poisonConditionImmune(target)) {
      const old = target.equipmentEffects.filter(e => e.kind === action.kind);
      const oldIds = new Set(old.map(e=>e.conditionId));
      target.combat.conditions = target.combat.conditions.filter(c=>!oldIds.has(c.id));
      const conditionId = `cnd_${effectId.split("_").at(-1)}`;
      target.combat.conditions.push({ id: conditionId, key: "poisoned", label: "Envenenado · poción de veneno", level: null, addedAt: updatedAt });
      target.equipmentEffects = target.equipmentEffects.filter(e => e.kind !== action.kind);
      target.equipmentEffects.push({ id: effectId, kind: action.kind, sourceItemId: item.id, sourceName: item.name, conditionId, dice: 3, phase: "start", concentrationDc: result.concentrationDc });
    } else if (result.concentrationDc !== null) {
      target.equipmentEffects.push({ id: effectId, kind: "concentration-check", sourceItemId: item.id, sourceName: item.name, conditionId: null, dice: 1, phase: "end", concentrationDc: result.concentrationDc });
    }
  }
  target.revision = targetInput.revision + 1; target.metadata.updatedAt = updatedAt;
  if (source.id === target.id) source = target;
  source.revision = sourceInput.revision + 1; source.metadata.updatedAt = updatedAt;
  return { source: CharacterV2Schema.parse(source), target: CharacterV2Schema.parse(target) };
}

export type EquipmentEffectAction =
  | { kind: "damage"; damageRoll: number }
  | { kind: "end-turn"; saveTotal?: number }
  | { kind: "extinguish"; checkTotal: number }
  | { kind: "concentration"; saveTotal: number };

export function performEquipmentEffectAction(input: CharacterV2, effectId: string, action: EquipmentEffectAction, options: { expectedRevision: number; updatedAt: string; actor?: CharacterV2 }): CharacterV2 {
  let c = CharacterV2Schema.parse(input);
  const updatedAt = IsoTimestampSchema.parse(options.updatedAt);
  if (c.revision !== options.expectedRevision) throw new CharacterRevisionConflictError(options.expectedRevision, c.revision);
  let effect = c.equipmentEffects.find(e => e.id === effectId);
  if (!effect) throw new Error("El efecto ya terminó.");
  let ended = false;
  if (action.kind !== "concentration" && effect.concentrationDc !== null && c.combat.conditions.some(p => p.key === "concentration")) throw new Error("Resolvé primero la salvación de concentración causada por el daño.");
  if (effect.kind === "concentration-check" && action.kind !== "concentration") throw new Error("Solo queda resolver la salvación de concentración.");
  if (action.kind === "damage") {
    if (effect.phase !== "start") throw new Error("El daño de este turno ya está registrado. Finalizá el turno antes del siguiente.");
    const rolled = rollInBounds(action.damageRoll, effect.kind === "potion-poison" ? `${effect.dice}d6` : "1d4");
    const result = damage(c, rolled, effect.kind === "potion-poison" ? "poison" : "fire", updatedAt);
    c = result.character; effect = c.equipmentEffects.find(e => e.id === effectId)!;
    effect.phase = "end"; effect.concentrationDc = result.concentrationDc;
  } else if (action.kind === "end-turn") {
    if (effect.phase !== "end") throw new Error("Registrá primero el daño del principio del turno.");
    if (effect.kind === "potion-poison" && total(action.saveTotal) >= 13) effect.dice--;
    ended = effect.dice === 0; effect.phase = "start";
  } else if (action.kind === "extinguish") {
    if (effect.kind !== "alchemist-fire") throw new Error("Este efecto no se extingue con esa prueba.");
    canAct(options.actor ?? c); ended = total(action.checkTotal) >= 10;
  } else if (action.kind === "concentration") {
    if (effect.concentrationDc === null) throw new Error("No hay una salvación de concentración pendiente de este efecto.");
    if (total(action.saveTotal) < effect.concentrationDc) {
      for (const condition of c.combat.conditions.filter(p=>p.key==="concentration")) c=applyCharacterResourceCommand(c,{kind:"remove-condition",conditionId:condition.id},{expectedRevision:c.revision,updatedAt}).character;
      effect=c.equipmentEffects.find(e=>e.id===effectId)!;
    }
    effect.concentrationDc = null;
    ended = effect.kind === "concentration-check";
  }
  if (ended) {
    c.equipmentEffects = c.equipmentEffects.filter(e => e.id !== effectId);
    c.combat.conditions = c.combat.conditions.filter(p => p.id !== effect.conditionId);
  }
  c.revision = input.revision + 1; c.metadata.updatedAt = updatedAt;
  return CharacterV2Schema.parse(c);
}
