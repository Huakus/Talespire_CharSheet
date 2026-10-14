import { CharacterV2Schema,IsoTimestampSchema,StableIdSchema,type CharacterV2 } from "./character-v2";
import { BarbarianActionSchema,type BarbarianAction } from "./barbarian-model";
import { barbarianPath } from "./barbarian-catalog";
import { barbarianRaging,barbarianBeyondDeath,endBarbarianRage } from "./barbarian-rules";
import { CharacterRevisionConflictError } from "./edit-character";
import { createDeterministicId } from "../../shared/id";
import { canonicalJsonStringify,type JsonValue } from "../../shared/json";
import { canCastWithEquippedArmor,type WizardCastOptions } from "./wizard-play";
import type { CharacterSpellV2 } from "./character-spell-model";
import type { CharacterResourceCommand } from "./character-resources";

export function prepareBarbarianCast(c: CharacterV2,s: CharacterSpellV2,_slot: number,o: WizardCastOptions) {
  if (barbarianRaging(c)) throw new Error("No podés lanzar conjuros ni mantener concentración durante la furia, incluidos rituales y conjuros raciales o de dotes.");
  if (!canCastWithEquippedArmor(c)) throw new Error("No podés lanzar con armadura o escudo sin competencia.");
  if (o.mode && o.mode !== "slot" && !(o.mode === "ritual" && s.casting?.kind === "ritual")) throw new Error("Esta fuente no concede ese modo de lanzamiento; los rituales de clase solo se lanzan como rituales.");
  return s.casting?.kind === "ritual";
}
function feature(c: CharacterV2,key: string) { return c.traits.flatMap((g) => g.traits).find((t) => t.id === c.spellcasting.barbarian?.resourceIds[key]); }
export async function performBarbarianAction(input: CharacterV2,operation: string,actionInput: BarbarianAction,options: { expectedRevision: number;updatedAt: string }) {
  const c = CharacterV2Schema.parse(input), action = BarbarianActionSchema.parse(actionInput), operationId = StableIdSchema.parse(operation), updatedAt = IsoTimestampSchema.parse(options.updatedAt);
  if (c.builder?.classKey !== "barbarian" || !c.spellcasting.barbarian) throw new Error("Este control requiere una ficha guiada de Bárbaro.");
  const r = c.spellcasting.barbarian, payload = canonicalJsonStringify(action as unknown as JsonValue), old = r.actions.find((a) => a.operationId === operationId);
  if (old) { if (old.payload !== payload) throw new Error("La operación ya se utilizó con otros datos."); return c; }
  if (c.revision !== options.expectedRevision) throw new CharacterRevisionConflictError(options.expectedRevision,c.revision);
  const level = c.identity.level,path = barbarianPath(c.builder);
  switch (action.kind) {
    case "rage": {
      if (r.raging) throw new Error("Ya estás en furia; terminá la anterior antes de iniciar otra.");
      if (c.combat.hitPoints.current <= 0 || c.combat.conditions.some((p) => ["unconscious","incapacitated","stunned","paralyzed","petrified","dead"].includes(p.key))) throw new Error("Necesitás poder actuar y estar consciente para entrar en furia.");
      if (action.frenzy && (path !== "berserker" || level < 3)) throw new Error("Frenesí requiere la Senda del Berserker desde nivel 3.");
      const rage = feature(c,"rage");if (!rage || level < 20 && rage.uses.used >= rage.uses.maximum) throw new Error("No quedan furias hasta el descanso largo.");
      if (level < 20) rage.uses.used++;
      r.raging = true;r.frenzy = action.frenzy;r.rageTurns = 10;r.focusUsed = false;r.relentlessPending = false;
      const focus = feature(c,"fanatical-focus");if (focus) focus.uses.used = 0;
      for (const spell of c.spellcasting.spells) if (spell.definition?.concentration) spell.effect.active = false;
      c.combat.conditions = [...c.combat.conditions.filter((p) => !["raging","concentration"].includes(p.key)),{ id: await createDeterministicId("cnd",c.id,"barbarian-rage"),key: "raging",label: action.frenzy ? "Furia · Frenesí" : "Furia",level: null,addedAt: updatedAt }];
      break;
    }
    case "end-rage": endBarbarianRage(c);break;
    case "end-turn":
      r.reckless = false;
      if (r.raging) {
        r.rageTurns = Math.max(0,r.rageTurns-1);
        if (!r.rageTurns || level < 15 && !action.attackedHostile && !action.tookDamage) endBarbarianRage(c);
      }
      break;
    case "reckless":
      if (level < 2) throw new Error("Ataque Temerario requiere Bárbaro 2.");
      r.reckless = true;break;
    case "end-reckless": r.reckless = false;break;
    case "relentless-rage": {
      if (level < 11 || !r.raging || c.combat.hitPoints.current !== 0) throw new Error("Furia Implacable requiere estar en furia y haber sido reducido a 0 PG sin muerte instantánea.");
      const succeeded = action.saveTotal >= r.relentlessDc;
      r.relentlessDc += 5;r.relentlessPending = false;
      if (succeeded) c.combat.hitPoints.current = 1;
      else if (!barbarianBeyondDeath(c)) endBarbarianRage(c);
      break;
    }
    case "fanatical-focus":
      if (path !== "zealot" || level < 6 || !r.raging || r.focusUsed) throw new Error("Enfoque Fanático requiere una salvación fallida durante una furia con su uso disponible.");
      r.focusUsed = true;feature(c,"fanatical-focus")!.uses.used = 1;break;
    case "zealous-presence": {
      const presence = feature(c,"zealous-presence");
      if (path !== "zealot" || level < 10 || !presence || presence.uses.used >= presence.uses.maximum) throw new Error("Presencia Fanática requiere Fanático 10 y un uso disponible por descanso largo.");
      presence.uses.used++;break;
    }
  }
  r.actions.push({ operationId,payload });
  return CharacterV2Schema.parse({ ...c,revision: c.revision+1,metadata: { ...c.metadata,updatedAt } });
}
/** Called on the already assembled resource result, so HP, conditions and rest counters agree. */
export function applyBarbarianResourceEffects(c: CharacterV2,command: CharacterResourceCommand,previous: CharacterV2) {
  const r = c.spellcasting.barbarian;if (c.builder?.classKey !== "barbarian" || !r) return c;
  if (command.kind === "short-rest" || command.kind === "long-rest") { r.relentlessDc = 10;r.reckless = false; }
  if (command.kind === "remove-condition" && previous.combat.conditions.some((p) => p.id === command.conditionId && p.key === "raging") || c.combat.conditions.some((p) => p.key === "unconscious")) endBarbarianRage(c);
  if (command.kind === "damage" && r.raging && previous.combat.hitPoints.current > 0 && c.combat.hitPoints.current === 0) {
    if (c.identity.level >= 11) r.relentlessPending = true;
    else endBarbarianRage(c);
  }
  return CharacterV2Schema.parse(c);
}
