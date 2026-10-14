import { CharacterV2Schema,StableIdSchema,IsoTimestampSchema,type CharacterV2 } from "./character-v2";
import { DruidActionSchema,type DruidAction } from "./druid-model";
import { druidCircle,druidCircleSpells,wildShapeLimit } from "./druid-catalog";
import { druidPreparationLimit,druidSpellKeys } from "./druid-builder";
import { elapseDruidHours } from "./druid-rules";
import { CharacterRevisionConflictError } from "./edit-character";
import { canonicalJsonStringify,type JsonValue } from "../../shared/json";
import { canCastWithEquippedArmor,type WizardCastOptions } from "./wizard-play";
import type { CharacterSpellV2 } from "./character-spell-model";
import { builderFeats } from "./fighter-build-rules";
export function druidCastUnavailable(c: CharacterV2,s: CharacterSpellV2) {
  if (!c.spellcasting.druid?.form) return "";
  const druidSpell = s.casting?.source.startsWith("builder:druid") || !!c.builder && builderFeats(c.builder).some(({ feat,level }) => feat.spellClass === "druid" && s.casting?.source === `builder:feat-${level}-${feat.key}`);
  if (c.identity.level < 18 || !druidSpell) return "Forma Salvaje impide lanzar este conjuro; Conjuros Bestiales habilita tus conjuros de Druida desde nivel 18.";
  if (s.definition?.components.includes("M") && (c.identity.level < 20 || /consum|gastad|valor|worth|cost|\b(?:po|pp|pe|pc|gp|sp|cp)\b/i.test(s.definition.material))) return "No podés proporcionar componentes materiales en Forma Salvaje. Archidruida solo ignora materiales sin precio ni consumo.";
  return "";
}
export function prepareDruidCast(c: CharacterV2,s: CharacterSpellV2,slot: number,o: WizardCastOptions) {
  const unavailable = druidCastUnavailable(c,s);if (unavailable) throw new Error(unavailable);
  if (!canCastWithEquippedArmor(c)) throw new Error("No podés lanzar con armadura o escudo sin competencia.");
  if (s.casting?.kind === "druid" && s.level > 0 && !s.prepared) throw new Error("Prepará el conjuro de Druida antes de lanzarlo.");
  if (o.mode === "ritual") { if (s.casting?.kind !== "ritual" && s.casting?.kind !== "druid" || !s.prepared || !s.definition?.ritual || slot !== s.level) throw new Error("El ritual de Druida requiere estar preparado y lanzarse a nivel base.");return true; }
  if (o.mode && o.mode !== "slot") throw new Error("Druida no concede modos especiales de Mago.");
  return s.casting?.kind === "ritual";
}
export async function performDruidAction(input: CharacterV2,operation: string,actionInput: DruidAction,options: { expectedRevision: number;updatedAt: string }) {
  const c = CharacterV2Schema.parse(input),action = DruidActionSchema.parse(actionInput),operationId = StableIdSchema.parse(operation),updatedAt = IsoTimestampSchema.parse(options.updatedAt);
  if (c.builder?.classKey !== "druid" || !c.spellcasting.druid) throw new Error("Este control requiere una ficha guiada de Druida.");
  const r = c.spellcasting.druid,payload = canonicalJsonStringify(action as unknown as JsonValue),old = r.actions.find((a) => a.operationId === operationId);
  if (old) { if (old.payload !== payload) throw new Error("La operación ya se utilizó con otros datos.");return c; }
  if (c.revision !== options.expectedRevision) throw new CharacterRevisionConflictError(options.expectedRevision,c.revision);
  const level = c.identity.level,circle = druidCircle(c.builder),incapacitated = c.combat.hitPoints.current <= 0 || c.combat.conditions.some((p) => ["unconscious","incapacitated","stunned","paralyzed","petrified","dead"].includes(p.key));
  const spend = (key: string,amount = 1) => { const t = c.traits.flatMap((g) => g.traits).find((t) => t.id === r.resourceIds[key]);if (!t || t.uses.used+amount > t.uses.maximum) throw new Error("No quedan usos de este recurso.");t.uses.used += amount; };
  if (incapacitated && !["revert","elapsed-hours","faithful-summons"].includes(action.kind)) throw new Error("Necesitás poder actuar para usar este rasgo.");
  switch (action.kind) {
    case "prepare": {
      const free = druidCircleSpells(c.builder),available = druidSpellKeys(c.builder);
      if (new Set(action.keys).size !== action.keys.length || action.keys.some((k) => !available.includes(k)) || action.keys.filter((k) => !free.includes(k)).length > druidPreparationLimit(c)) throw new Error("Prepará conjuros distintos y disponibles hasta nivel + SAB; el círculo no ocupa cupo.");
      for (const s of c.spellcasting.spells) if (s.casting?.kind === "druid") s.prepared = s.level === 0 || free.includes(s.casting.key) || action.keys.includes(s.casting.key);break;
    }
    case "wild-shape": {
      if (level < 2) throw new Error("Forma Salvaje requiere Druida 2.");
      const elemental = action.formKind !== "beast";
      if (elemental && (circle !== "moon" || level < 10)) throw new Error("Las cuatro formas elementales requieren Luna 10.");
      if (!elemental && (action.challenge > wildShapeLimit(level,circle) || action.swim && level < 4 || action.fly && level < 8)) throw new Error("La forma supera el VD o requiere un nivel mayor para nado/vuelo.");
      if (elemental && action.challenge !== 5) throw new Error("Las cuatro formas elementales de Luna son VD 5.");
      if (level < 20) spend("wild-shape",elemental ? 2 : 1);
      r.form = { name: elemental ? `Elemental de ${{ air: "aire",earth: "tierra",fire: "fuego",water: "agua" }[action.formKind as "air"|"earth"|"fire"|"water"]}` : action.name,kind: action.formKind,challenge: action.challenge,swim: action.swim,fly: action.fly,maximumHp: action.maximumHp,currentHp: action.maximumHp,hoursRemaining: Math.floor(level/2),notes: action.notes };
      break;
    }
    case "revert": r.form = null;break;
    case "elapsed-hours": elapseDruidHours(c,action.hours);break;
    case "natural-recovery": {
      if (circle !== "land" || level < 2 || action.slots.reduce((a,b) => a+b,0) > Math.ceil(level/2)) throw new Error("Recuperación Natural exige Tierra y suma de niveles hasta mitad de Druida redondeada hacia arriba, sin espacios 6+.");
      const counts: Record<string,number> = {};for (const n of action.slots) counts[String(n)] = (counts[String(n)] ?? 0)+1;
      for (const [n,count] of Object.entries(counts)) if ((c.spellcasting.slots[n]?.used ?? 0) < count) throw new Error("Elegiste más espacios de los que tenés gastados.");
      spend("natural-recovery");for (const [n,count] of Object.entries(counts)) c.spellcasting.slots[n]!.used -= count;break;
    }
    case "moon-heal": {
      if (circle !== "moon" || !r.form) throw new Error("La curación de Luna requiere estar en Forma Salvaje.");
      if (action.healing < action.slot || action.healing > action.slot*8) throw new Error("Registrá el resultado de 1d8 por nivel del espacio, sin otros bonos.");
      const slot = c.spellcasting.slots[String(action.slot)];if (!slot || slot.used >= slot.maximum) throw new Error("No quedan espacios de ese nivel.");slot.used++;r.form.currentHp = Math.min(r.form.maximumHp,r.form.currentHp+action.healing);break;
    }
    case "balm": if (circle !== "dreams" || action.dice > Math.floor(level/2)) throw new Error("Bálsamo requiere Sueños y hasta mitad de nivel en dados.");spend("balm",action.dice);break;
    case "hidden-path": if (circle !== "dreams" || level < 10) throw new Error("Caminos Ocultos requiere Sueños 10.");spend("hidden-paths");break;
    case "dream-walker": if (circle !== "dreams" || level < 14) throw new Error("Caminante en Sueños requiere Sueños 14.");if (r.form && level < 18) throw new Error("Forma Salvaje impide lanzar estos conjuros antes de Conjuros Bestiales.");if (action.spell !== "teleportation-circle" || action.hasPlanarRest) spend("dream-walker");break;
    case "spirit": if (circle !== "shepherd" || level < 2) throw new Error("Tótem Espiritual requiere Pastor 2.");spend("spirit");break;
    case "faithful-summons": if (circle !== "shepherd" || level < 14) throw new Error("Invocaciones Leales requiere Pastor 14.");spend("faithful-summons");break;
  }
  r.actions.push({ operationId,payload });return CharacterV2Schema.parse({ ...c,revision: c.revision+1,metadata: { ...c.metadata,updatedAt } });
}
