import { CharacterV2Schema,IsoTimestampSchema,StableIdSchema,type CharacterV2 } from "./character-v2";
import { RogueActionSchema,type RogueAction } from "./rogue-model";
import { rogueArchetype,THIEVES_EXPERTISE } from "./rogue-catalog";
import { replayRogueChoices } from "./rogue-builder";
import { CharacterRevisionConflictError } from "./edit-character";
import { PHB_SPELLS } from "./phb-spells";
import { CharacterSpellV2Schema,type CharacterSpellV2 } from "./character-spell-model";
import { createDeterministicId } from "../../shared/id";
import { canonicalJsonStringify,type JsonValue } from "../../shared/json";
import { canCastWithEquippedArmor,type WizardCastOptions } from "./wizard-play";
import { EK_PROGRESSION } from "./phb-fighter-choices";
import { abilityModifier,projectAbilityScore,proficiencyBonus } from "./character-projection";

export function rogueSkillMinimum(character: CharacterV2,key: keyof CharacterV2["checks"]["skills"],detectingLies = false) {
  if (character.builder?.classKey !== "rogue") return 1;
  if (character.identity.level >= 11 && character.checks.skills[key].proficiency >= 1) return 10;
  return detectingLies && key === "insight" && rogueArchetype(character.builder) === "inquisitive" ? 8 : 1;
}
export function rogueThievesToolModifier(character: CharacterV2,ability: keyof CharacterV2["abilities"] = "dexterity") {
  const rank = character.spellcasting.rogue?.expertise.includes(THIEVES_EXPERTISE) ? 2 : 1;
  return abilityModifier(projectAbilityScore(character,ability))+rank*proficiencyBonus(character.identity.level);
}
export function prepareRogueCast(character: CharacterV2,spell: CharacterSpellV2,slot: number,options: WizardCastOptions) {
  if (!canCastWithEquippedArmor(character)) throw new Error("No podés lanzar con armadura o escudo sin competencia.");
  const source = spell.casting?.source;
  if (source === "builder:rogue") {
    const known = replayRogueChoices(character.builder!);
    if (![...known.cantrips,...known.spells.map((s) => s.key)].includes(spell.casting!.key)) throw new Error("Este conjuro no forma parte de tus conocidos de Bribón Arcano.");
  }
  if (source === "builder:rogue-stolen" && (character.spellcasting.rogue?.stolenSpell !== spell.casting!.key || character.spellcasting.rogue.stolenHoursRemaining <= 0)) throw new Error("El conjuro robado ya no está disponible.");
  if (spell.casting?.kind === "ritual" && (!options.mode || ["slot","ritual"].includes(options.mode))) return true;
  if (options.mode && options.mode !== "slot") throw new Error("Bribón Arcano no concede lanzamiento ritual ni modos especiales de Mago.");
  return false;
}
/** Campaign time is explicit; eight hours here are game hours, never wall-clock hours. */
export function elapseRogueHours(character: CharacterV2,hours: number) {
  const runtime = character.spellcasting.rogue;
  if (!runtime) return;
  runtime.stolenHoursRemaining = Math.max(0,runtime.stolenHoursRemaining-hours);
  if (!runtime.stolenHoursRemaining) { runtime.stolenSpell = null; character.spellcasting.spells = character.spellcasting.spells.filter((s) => s.casting?.source !== "builder:rogue-stolen"); }
}
export async function performRogueAction(input: CharacterV2,operation: string,actionInput: RogueAction,options: { expectedRevision: number;updatedAt: string }) {
  const character = CharacterV2Schema.parse(input), action = RogueActionSchema.parse(actionInput), operationId = StableIdSchema.parse(operation), updatedAt = IsoTimestampSchema.parse(options.updatedAt);
  if (character.builder?.classKey !== "rogue" || !character.spellcasting.rogue) throw new Error("Este control requiere una ficha guiada de Pícaro.");
  const runtime = character.spellcasting.rogue, payload = canonicalJsonStringify(action as unknown as JsonValue), old = runtime.actions.find((a) => a.operationId === operationId);
  if (old) { if (old.payload !== payload) throw new Error("La operación ya se usó con otros datos."); return character; }
  if (character.revision !== options.expectedRevision) throw new CharacterRevisionConflictError(options.expectedRevision,character.revision);
  if (action.kind === "pass-time") elapseRogueHours(character,action.hours);
  else {
    if (rogueArchetype(character.builder) !== "arcane-trickster" || character.identity.level < 17) throw new Error("Ladrón de Conjuros requiere Bribón Arcano 17.");
    const definition = PHB_SPELLS[action.key];
    if (!definition) throw new Error("Elegí el conjuro que acaba de lanzarte la criatura.");
    const trait = character.traits.flatMap((g) => g.traits).find((t) => t.id === runtime.resourceIds["spell-thief"]);
    if (!trait || trait.uses.used >= trait.uses.maximum) throw new Error("No quedan usos de Ladrón de Conjuros hasta el descanso largo.");
    trait.uses.used++;
    if (action.targetFailedSave && definition.level > 0 && definition.level <= EK_PROGRESSION[character.identity.level]!.slots.filter(Boolean).length) {
      runtime.stolenSpell = action.key; runtime.stolenHoursRemaining = 8;
      character.spellcasting.spells = character.spellcasting.spells.filter((s) => s.casting?.source !== "builder:rogue-stolen");
      character.spellcasting.spells.push(CharacterSpellV2Schema.parse({ id: await createDeterministicId("spl",character.id,"rogue-stolen",action.key),name: definition.name,level: definition.level,prepared: true,order: character.spellcasting.spells.length,definition: structuredClone(definition),casting: { kind: "slots",source: "builder:rogue-stolen",key: action.key,ability: "intelligence",level: definition.level,traitId: null } }));
    }
  }
  runtime.actions.push({ operationId,payload });
  return CharacterV2Schema.parse({ ...character,revision: character.revision+1,metadata: { ...character.metadata,updatedAt } });
}
