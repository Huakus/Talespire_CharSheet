import { CharacterV2Schema,StableIdSchema,IsoTimestampSchema,type CharacterV2 } from "./character-v2";
import { BardActionSchema,type BardAction } from "./bard-model";
import { bardCollege } from "./bard-catalog";
import { replayBardChoices,bardFeatKnown } from "./bard-builder";
import { CharacterRevisionConflictError } from "./edit-character";
import { canonicalJsonStringify,type JsonValue } from "../../shared/json";
import { canCastWithEquippedArmor,type WizardCastOptions } from "./wizard-play";
import type { CharacterSpellV2 } from "./character-spell-model";
export function prepareBardCast(c: CharacterV2,s: CharacterSpellV2,slot: number,o: WizardCastOptions) {
  if (!canCastWithEquippedArmor(c)) throw new Error("No podés lanzar con armadura o escudo sin competencia.");
  if (s.casting?.source === "builder:bard") {
    const replay = replayBardChoices(c.builder!);
    if (![...replay.cantrips,...replay.spells.map((s) => s.key),...bardFeatKnown(c.builder!)].includes(s.casting.key)) throw new Error("Este conjuro no forma parte de tus conocidos de Bardo.");
  }
  if (o.mode === "ritual") {
    if (!s.definition?.ritual || slot !== s.level || s.casting && s.casting.source !== "builder:bard" && s.casting.kind !== "ritual") throw new Error("El ritual requiere un conjuro de Bardo conocido o del libro ritual, a nivel base.");
    return true;
  }
  if (o.mode && o.mode !== "slot") throw new Error("Bardo no concede modos especiales de Mago.");
  return s.casting?.kind === "ritual";
}
export async function performBardAction(input: CharacterV2,operation: string,actionInput: BardAction,options: { expectedRevision: number;updatedAt: string }) {
  const c = CharacterV2Schema.parse(input),action = BardActionSchema.parse(actionInput),operationId = StableIdSchema.parse(operation),updatedAt = IsoTimestampSchema.parse(options.updatedAt);
  if (c.builder?.classKey !== "bard" || !c.spellcasting.bard) throw new Error("Este control requiere una ficha guiada de Bardo.");
  const runtime = c.spellcasting.bard,payload = canonicalJsonStringify(action as unknown as JsonValue),old = runtime.actions.find((a) => a.operationId === operationId);
  if (old) { if (old.payload !== payload) throw new Error("La operación ya se utilizó con otros datos."); return c; }
  if (c.revision !== options.expectedRevision) throw new CharacterRevisionConflictError(options.expectedRevision,c.revision);
  const pool = c.traits.flatMap((g) => g.traits).find((t) => t.id === runtime.inspirationId);
  if (!pool) throw new Error("No se encontró la reserva de inspiración.");
  if (action.kind === "superior") {
    if (c.identity.level < 20 || pool.uses.used !== pool.uses.maximum) throw new Error("Inspiración Superior requiere nivel 20, tirar iniciativa y no tener usos disponibles.");
    pool.uses.used--;
  } else {
    const college = bardCollege(c.builder),use = action.use,level = c.identity.level;
    if ((use === "cutting-words" || use === "peerless") && college !== "lore" || use === "peerless" && level < 14 || use === "mantle-inspiration" && college !== "glamour" || ["flourish","master-flourish"].includes(use) && college !== "swords" || use === "master-flourish" && level < 14 || use === "psychic-blades" && college !== "whispers") throw new Error("No disponés de este rasgo de colegio en tu nivel.");
    if (c.combat.hitPoints.current <= 0 || c.combat.conditions.some((p) => ["incapacitated","unconscious","stunned","paralyzed","petrified","dead"].includes(p.key))) throw new Error("Necesitás poder actuar para usar este rasgo.");
    if (use !== "master-flourish") { if (pool.uses.used >= pool.uses.maximum) throw new Error("No quedan usos de Inspiración de Bardo."); pool.uses.used++; }
  }
  runtime.actions.push({ operationId,payload });
  return CharacterV2Schema.parse({ ...c,revision: c.revision+1,metadata: { ...c.metadata,updatedAt } });
}
