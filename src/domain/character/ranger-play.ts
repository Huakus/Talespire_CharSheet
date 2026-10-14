import { CharacterV2Schema,StableIdSchema,IsoTimestampSchema,type CharacterV2 } from "./character-v2";
import { RangerActionSchema,type RangerAction } from "./ranger-model";
import { rangerArchetype } from "./ranger-catalog";
import { replayRangerChoices,rangerCompanionMaximum } from "./ranger-builder";
import { CharacterRevisionConflictError } from "./edit-character";
import { canonicalJsonStringify,type JsonValue } from "../../shared/json";
import { canCastWithEquippedArmor,type WizardCastOptions } from "./wizard-play";
import type { CharacterSpellV2 } from "./character-spell-model";
import { projectCharacterStatistics,proficiencyBonus,projectAdjustedRollMode } from "./character-projection";
import { SKILL_DEFINITIONS,type SkillKey } from "./character-checks";
export function prepareRangerCast(c: CharacterV2,s: CharacterSpellV2,slot: number,o: WizardCastOptions) {
  if (!canCastWithEquippedArmor(c)) throw new Error("No podés lanzar con armadura o escudo sin competencia.");
  if (s.casting?.source === "builder:ranger" && !replayRangerChoices(c.builder!).spells.some((known) => known.key === s.casting!.key)) throw new Error("Este conjuro no forma parte de tus conocidos de Explorador.");
  if (o.mode === "ritual") { if (s.casting?.kind !== "ritual" || !s.definition?.ritual || slot !== s.level) throw new Error("Explorador 2014 no concede rituales; necesitás una fuente de ritual independiente y nivel base.");return true; }
  if (o.mode && o.mode !== "slot") throw new Error("Explorador no concede modos especiales de Mago.");return s.casting?.kind === "ritual";
}
export function rangerTerrainCheck(c: CharacterV2,key: SkillKey,terrainRelevant: boolean,trackingEnemy = false) {
  const d = SKILL_DEFINITIONS[key],rank = c.checks.skills[key].proficiency,qualified = c.builder?.classKey === "ranger";
  const extra = qualified && terrainRelevant && ["intelligence","wisdom"].includes(d.ability) && rank >= 1 ? proficiencyBonus(c.identity.level)*(2-rank) : 0;
  return { modifier: projectCharacterStatistics(c).skills[key]+extra,mode: projectAdjustedRollMode(c,"skills",[key,d.label],c.checks.skills[key].rollMode,qualified && trackingEnemy && (key === "survival" || d.ability === "intelligence")) };
}
export function resetRangerAfterRest(c: CharacterV2,kind: "short-rest"|"long-rest") {
  const r = c.spellcasting.ranger;if (kind === "long-rest" && r?.companion && r.companionHp > 0) { r.companionHp = rangerCompanionMaximum(c);r.companionDiceRemaining = Math.min(r.companion.hitDice,r.companionDiceRemaining+Math.max(1,Math.floor(r.companion.hitDice/2))); }
}
export async function performRangerAction(input: CharacterV2,operation: string,actionInput: RangerAction,options: { expectedRevision: number;updatedAt: string }) {
  const c = CharacterV2Schema.parse(input),action = RangerActionSchema.parse(actionInput),operationId = StableIdSchema.parse(operation),updatedAt = IsoTimestampSchema.parse(options.updatedAt);
  if (c.builder?.classKey !== "ranger" || !c.spellcasting.ranger) throw new Error("Este control requiere una ficha guiada de Explorador.");
  const r = c.spellcasting.ranger,payload = canonicalJsonStringify(action as unknown as JsonValue),old = r.actions.find((a) => a.operationId === operationId);
  if (old) { if (old.payload !== payload) throw new Error("La operación ya se utilizó con otros datos.");return c; }
  if (c.revision !== options.expectedRevision) throw new CharacterRevisionConflictError(options.expectedRevision,c.revision);
  const archetype = rangerArchetype(c.builder),level = c.identity.level;
  if (["primeval-awareness","feature","bond-companion"].includes(action.kind) && (c.combat.hitPoints.current <= 0 || c.combat.conditions.some((p) => ["incapacitated","unconscious","stunned","paralyzed","petrified","dead"].includes(p.key)))) throw new Error("Necesitás poder actuar para usar este rasgo.");
  if (action.kind === "primeval-awareness") {
    if (level < 3) throw new Error("Conciencia Primitiva requiere Explorador 3.");const slot = c.spellcasting.slots[String(action.slot)];if (!slot || slot.used >= slot.maximum) throw new Error("No quedan espacios de ese nivel.");slot.used++;
  } else if (action.kind === "feature") {
    if (action.key === "detect-portal" ? archetype !== "horizon-walker" || level < 3 : archetype !== "monster-slayer" || level < (action.key === "hunters-sense" ? 3 : 11)) throw new Error("Este rasgo requiere su arquetipo y nivel correspondientes.");
    const trait = c.traits.flatMap((g) => g.traits).find((t) => t.id === r.resourceIds[action.key]);if (!trait || trait.uses.used >= trait.uses.maximum) throw new Error("No quedan usos de este recurso.");trait.uses.used++;
  } else {
    if (archetype !== "beast-master" || !r.companion) throw new Error("Este control requiere Señor de las Bestias y un compañero.");
    if (action.kind === "companion-damage") r.companionHp = Math.max(0,r.companionHp-action.amount);
    else if (action.kind === "companion-heal") r.companionHp = Math.min(rangerCompanionMaximum(c),r.companionHp+action.amount);
    else if (action.kind === "companion-hit-dice") { if (r.companionHp <= 0 || action.dice > r.companionDiceRemaining) throw new Error("La bestia debe estar viva y tener esos Dados de Golpe disponibles.");r.companionDiceRemaining -= action.dice;r.companionHp = Math.min(rangerCompanionMaximum(c),r.companionHp+action.healing); }
    else if (action.kind === "bond-companion") { if (r.companionHp > 0) throw new Error("El reemplazo requiere que el compañero anterior haya muerto.");r.companion = action.companion;r.companionHp = Math.max(action.companion.baseHp,level*4);r.companionDiceRemaining = action.companion.hitDice; }
  }
  r.actions.push({ operationId,payload });return CharacterV2Schema.parse({ ...c,revision: c.revision+1,metadata: { ...c.metadata,updatedAt } });
}
