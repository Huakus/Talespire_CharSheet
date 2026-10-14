import { CharacterV2Schema, IsoTimestampSchema, StableIdSchema, type CharacterV2 } from "./character-v2";
import { ClericActionSchema, type ClericAction } from "./cleric-model";
import { CLERIC_FEATURES } from "./cleric-catalog";
import { clericPreparationLimit, clericSpellKeys } from "./cleric-builder";
import { clericDomainSpells } from "./cleric-catalog";
import { CharacterRevisionConflictError } from "./edit-character";
import { canonicalJsonStringify, type JsonValue } from "../../shared/json";
import { canCastWithEquippedArmor, type WizardCastOptions } from "./wizard-play";
import type { CharacterSpellV2 } from "./character-spell-model";

export function prepareClericCast(character: CharacterV2, spell: CharacterSpellV2, slot: number, options: WizardCastOptions) {
  if (!canCastWithEquippedArmor(character)) throw new Error("No podés lanzar con armadura o escudo sin competencia.");
  if (spell.casting?.kind === "cleric" && spell.level > 0 && !spell.prepared) throw new Error("Prepará el conjuro de clérigo antes de lanzarlo.");
  if (spell.casting?.kind === "ritual" && (!options.mode || ["slot","ritual"].includes(options.mode))) return true;
  if (options.mode === "ritual") {
    if (spell.casting?.kind !== "cleric" || !spell.prepared || !spell.definition?.ritual || slot !== spell.level) throw new Error("El ritual de clérigo debe estar preparado y se lanza a su nivel base.");
    return true;
  }
  if (options.mode && options.mode !== "slot") throw new Error("Este modo de lanzamiento no corresponde a Clérigo.");
  return spell.casting?.kind === "ritual";
}
export async function performClericAction(input: CharacterV2, operation: string, actionInput: ClericAction, options: { expectedRevision: number; updatedAt: string }) {
  const character = CharacterV2Schema.parse(input), operationId = StableIdSchema.parse(operation), action = ClericActionSchema.parse(actionInput), updatedAt = IsoTimestampSchema.parse(options.updatedAt);
  if (character.builder?.classKey !== "cleric" || !character.spellcasting.cleric) throw new Error("Este personaje no tiene recursos guiados de Clérigo.");
  const runtime = character.spellcasting.cleric, payload = canonicalJsonStringify(action as unknown as JsonValue);
  const prior = runtime.actions.find((entry) => entry.operationId === operationId);
  if (prior) { if (prior.payload !== payload) throw new Error("La operación ya se confirmó con otras elecciones."); return character; }
  if (character.revision !== options.expectedRevision) throw new CharacterRevisionConflictError(options.expectedRevision,character.revision);
  const domain = character.builder.creation.cleric.domain!, level = character.identity.level;
  const spend = (key: string) => {
    const trait = character.traits.flatMap((g) => g.traits).find((t) => t.id === runtime.resourceIds[key]);
    if (!trait || trait.uses.used >= trait.uses.maximum) throw new Error("No quedan usos disponibles de este recurso.");
    trait.uses.used++;
  };
  if (action.kind === "prepare") {
    const free = clericDomainSpells(domain,level), available = clericSpellKeys(character.builder);
    if (new Set(action.keys).size !== action.keys.length || action.keys.some((k) => !available.includes(k)) || action.keys.filter((k) => !free.includes(k)).length > clericPreparationLimit(character)) throw new Error("Prepará conjuros distintos de tu lista disponible, hasta nivel + SAB; el dominio no ocupa cupo.");
    for (const spell of character.spellcasting.spells) if (spell.casting?.kind === "cleric") spell.prepared = spell.level === 0 || free.includes(spell.casting.key) || action.keys.includes(spell.casting.key);
  } else if (action.kind === "channel") {
    if (level < 2 || action.key !== "turn-undead" && !CLERIC_FEATURES[domain].some((f) => f.channel && f.key === action.key && f.level <= level)) throw new Error("Esta opción de Canalizar Divinidad no está disponible.");
    spend("channel");
  } else if (action.kind === "intervention") {
    if (level < 10 || runtime.interventionCooldownDays > 0) throw new Error("Intervención Divina todavía no está disponible.");
    if (level < 20 && action.roll === null) throw new Error("Registrá el resultado del d100 (01–100).");
    spend("intervention");
    if (level === 20 || action.roll! <= level) runtime.interventionCooldownDays = 7;
  } else {
    const before = runtime.interventionCooldownDays;
    runtime.interventionCooldownDays = Math.max(0,before-action.days);
    if (before > 0 && runtime.interventionCooldownDays === 0) {
      const intervention = character.traits.flatMap((g) => g.traits).find((t) => t.id === runtime.resourceIds.intervention);
      if (intervention) intervention.uses.used = 0;
    }
  }
  runtime.actions.push({ operationId,payload });
  runtime.actions = runtime.actions.slice(-200);
  return CharacterV2Schema.parse({ ...character,revision: character.revision+1,metadata: { ...character.metadata,updatedAt } });
}
