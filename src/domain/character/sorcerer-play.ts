import { CharacterV2Schema,StableIdSchema,IsoTimestampSchema,type CharacterV2 } from "./character-v2";
import { SorcererActionSchema,type SorcererAction,type SorcererCastOptions } from "./sorcerer-model";
import { sorcererOrigin,METAMAGIC,SLOT_POINT_COST } from "./sorcerer-catalog";
import { replaySorcererChoices,sorcererFeatKnown } from "./sorcerer-builder";
import { CharacterRevisionConflictError } from "./edit-character";
import { canonicalJsonStringify,type JsonValue } from "../../shared/json";
import { canCastWithEquippedArmor,type WizardCastOptions } from "./wizard-play";
import type { CharacterSpellV2 } from "./character-spell-model";
import { abilityModifier,projectAbilityScore } from "./character-projection";
import { DRAGON_ANCESTRIES } from "./phb-character-options";
import { WIZARD_SLOTS } from "./wizard-catalog";
import { createDeterministicId } from "../../shared/id";
export function sorcererFeature(c: CharacterV2,key: string) { return c.traits.flatMap((g) => g.traits).find((t) => t.id === c.spellcasting.sorcerer?.resourceIds[key]); }
export const sorceryPoints = (c: CharacterV2) => { const t = sorcererFeature(c,"sorcery-points");return t ? t.uses.maximum-t.uses.used : 0; };
export function metamagicUnavailable(c: CharacterV2,s: CharacterSpellV2,m: string,slot = s.level): string|null {
  if (!c.builder || !replaySorcererChoices(c.builder).metamagic.includes(m as never)) return "No conocés esta opción de metamagia";
  const d = s.definition,key = s.casting?.key ?? "",personal = /personal|self/i.test(d?.range ?? "");
  if (["careful","heightened"].includes(m) && d?.attackType !== "save") return "Requiere un conjuro que obligue a salvar";
  if (m === "distant" && (personal || !/toque|touch/i.test(d?.range ?? "") && !(Number((d?.range ?? "").match(/\d+/)?.[0]) >= 5))) return "Requiere toque o alcance de cinco pies o más; no Personal";
  if (m === "quickened" && !/^(?:1|una?)\s+(?:acci[oó]n|action)(?:\s*\([^)]*\))?$/i.test(d?.castingTime.trim() ?? "")) return "Requiere tiempo de una acción";
  if (m === "extended" && !/minut|hora|hour|d[ií]a|day/i.test(d?.duration ?? "")) return "Requiere duración de al menos un minuto";
  if (m === "empowered" && !d?.damageExpression) return "Requiere dados de daño; para daño posterior usá el panel de recursos";
  const multiAt: Record<string,number> = { "charm-person": 2,"charm-monster": 5,"enhance-ability": 3,"hold-person": 3,"hold-monster": 6,invisibility: 3,fly: 4,banishment: 5,"blindness-deafness": 3,longstrider: 2 };
  if (m === "twinned" && (personal || ["magic-missile","scorching-ray","fire-bolt","acid-splash","fireball","burning-hands","shatter","cone-of-cold","chain-lightning","ice-knife","chaos-bolt","dragons-breath","levitate","enlarge-reduce","disintegrate","telekinesis","animate-objects","life-transference"].includes(key) || key === "eldritch-blast" && c.identity.level >= 5 || !!multiAt[key] && slot >= multiAt[key]!)) return "Puede afectar a más de una criatura, a objetos, o tiene alcance Personal";
  return null;
}
export function spendSorcery(c: CharacterV2,cost: number) { const t = sorcererFeature(c,"sorcery-points");if (!t || cost < 0 || !Number.isInteger(cost) || cost > sorceryPoints(c)) throw new Error("No quedan suficientes puntos de hechicería.");t.uses.used += cost; }
const incapacitated = (c: CharacterV2) => c.combat.hitPoints.current <= 0 || c.combat.conditions.some((s) => ["incapacitated","unconscious","stunned","paralyzed","petrified","dead"].includes(s.key));
function use(c: CharacterV2,key: string) { const t = sorcererFeature(c,key);if (!t || t.uses.used >= t.uses.maximum) throw new Error("No quedan usos de este rasgo.");t.uses.used++; }
export function sorcererAffinity(c: CharacterV2,s: CharacterSpellV2) {
  if (!c.builder || sorcererOrigin(c.builder) !== "draconic" || c.identity.level < 6) return null;
  const type = DRAGON_ANCESTRIES[c.builder.creation.sorcerer.ancestry!]!.damage.toLocaleLowerCase(),spellType = s.definition?.damageType.toLocaleLowerCase() ?? "";
  const aliases: Record<string,string[]> = { fuego: ["fuego","fire"],frío: ["frío","frio","cold"],ácido: ["ácido","acido","acid"],veneno: ["veneno","poison"],relámpago: ["relámpago","relampago","rayo","lightning","eléctrico"] };
  const spanish: Record<string,string> = { fire: "fuego",cold: "frío",acid: "ácido",poison: "veneno",lightning: "relámpago" };
  return (aliases[spanish[type] ?? type] ?? [type]).some((d) => spellType.includes(d)) ? { type: spanish[type] ?? type,bonus: abilityModifier(projectAbilityScore(c,"charisma")) } : null;
}
export function prepareSorcererCast(c: CharacterV2,s: CharacterSpellV2,slot: number,o: WizardCastOptions & SorcererCastOptions) {
  if (incapacitated(c)) throw new Error("Necesitás poder actuar para lanzar el conjuro.");
  if (!canCastWithEquippedArmor(c)) throw new Error("No podés lanzar con armadura o escudo sin competencia.");
  const replay = replaySorcererChoices(c.builder!);
  if (s.casting?.source === "builder:sorcerer" && ![...replay.cantrips,...replay.spells.map((s) => s.key),...sorcererFeatKnown(c.builder!)].includes(s.casting.key)) throw new Error("Este conjuro no forma parte de tus conocidos de Hechicero.");
  if (o.mode === "ritual") { if (s.casting?.kind !== "ritual" || !s.definition?.ritual || slot !== s.level) throw new Error("Hechicero no concede rituales; necesitás una fuente independiente a su nivel base."); }
  else if (o.mode && !["slot","shadow-darkness"].includes(o.mode)) throw new Error("Este modo no corresponde a Hechicero.");
  const meta = o.metamagic ?? [];if (new Set(meta).size !== meta.length || meta.some((m) => !replay.metamagic.includes(m)) || meta.length > 2 || meta.length === 2 && !meta.includes("empowered")) throw new Error("Solo podés combinar una metamagia conocida con Conjuro Potenciado; no repetir opciones.");
  if (meta.length && !o.metamagicConfirmed) throw new Error("Confirmá los requisitos y límites de la metamagia para este lanzamiento.");
  const d = s.definition,personal = /personal|self/i.test(d?.range ?? ""),touch = /toque|touch/i.test(d?.range ?? "");
  let cost = 0;
  for (const m of meta) {
    const unavailable = metamagicUnavailable(c,s,m,slot);if (unavailable) throw new Error(`${METAMAGIC[m].name}: ${unavailable}.`);
    if (["careful","heightened"].includes(m) && d?.attackType !== "save") throw new Error("Esta metamagia requiere una salvación del conjuro.");
    if (m === "distant" && (personal || !touch && !(Number((d?.range ?? "").match(/\d+/)?.[0]) >= 5))) throw new Error("Conjuro Distante exige toque o alcance de cinco pies o más, no Personal.");
    if (m === "quickened" && (!/^(1|una?)\s+acci[oó]n(?:\s*\([^)]*\))?$/i.test(d?.castingTime.trim() ?? "") && !/^1 action$/i.test(d?.castingTime.trim() ?? "") || o.mode === "ritual")) throw new Error("Conjuro Acelerado requiere un tiempo de una acción; no ritual.");
    if (m === "extended" && !/minut|hora|hour|d[ií]a|day/i.test(d?.duration ?? "")) throw new Error("Ampliar Conjuro requiere una duración de al menos un minuto.");
    if (m === "empowered" && !d?.damageExpression) throw new Error("Conjuro Potenciado requiere dados de daño; para una tirada posterior, registrá el gasto cuando ocurra.");
    if (m === "twinned" && (personal || !o.twinnedEligible || ["magic-missile","scorching-ray","fire-bolt","acid-splash","fireball","burning-hands","shatter","cone-of-cold","chain-lightning","ice-knife","chaos-bolt","dragons-breath"].includes(s.casting?.key ?? "") || s.casting?.key === "eldritch-blast" && c.identity.level >= 5)) throw new Error("Conjuro Duplicado exige un único objetivo criatura posible a este nivel, no Personal, y una segunda criatura en alcance.");
    cost += m === "twinned" ? Math.max(1,slot) : METAMAGIC[m].cost;
  }
  const shadow = o.mode === "shadow-darkness" || o.shadowDarkness;
  if (shadow) { if (replay.origin !== "shadow" || c.identity.level < 3 || s.casting?.source !== "builder:sorcerer" || s.casting.key !== "darkness" || slot !== 2) throw new Error("Ojos de la Oscuridad solo permite Oscuridad de Hechicero a nivel 2 por dos puntos.");cost += 2; }
  if (o.elementalResistance) { if (!sorcererAffinity(c,s)) throw new Error("Afinidad Elemental requiere un conjuro del tipo de tu ancestro desde nivel 6.");cost++;c.spellcasting.sorcerer!.resistanceMinutes = 60; }
  if (cost) spendSorcery(c,cost);
  c.spellcasting.sorcerer!.actions.push({ operationId: `scast_${crypto.randomUUID().replaceAll("-","")}`,payload: canonicalJsonStringify({ kind: "cast",spellId: s.id,slot,mode: o.mode ?? "slot",metamagic: meta,points: cost }) });
  return !!shadow || s.casting?.kind === "ritual";
}
export function syncSorcerer(c: CharacterV2) {
  const r = c.spellcasting.sorcerer;if (!r || !c.builder) return c;
  if (incapacitated(c)) { r.shadowTurns = 0;c.combat.conditions = c.combat.conditions.filter((s) => s.key !== "concentration");if (sorcererOrigin(c.builder) === "divine-soul") r.wings = false; }
  if (r.presenceId && !c.combat.conditions.some((s) => s.id === r.presenceId)) { r.presenceTurns = 0;r.presenceId = null; }
  return c;
}
export function sorcererResourceEffects(c: CharacterV2,kind: string) {
  const r = c.spellcasting.sorcerer;if (!r || c.builder?.classKey !== "sorcerer") return c;
  if (["short-rest","long-rest"].includes(kind)) { r.resistanceMinutes = 0;r.shadowTurns = 0;r.sharedFlightMinutes = 0;r.presenceTurns = 0;if (r.presenceId) c.combat.conditions = c.combat.conditions.filter((s) => s.id !== r.presenceId);r.presenceId = null; }
  if (kind === "long-rest") { r.createdSlots = {};for (let n=1;n<=9;n++) c.spellcasting.slots[String(n)] = { maximum: WIZARD_SLOTS[c.identity.level]![n-1] ?? 0,used: 0 }; }
  if (kind === "short-rest" && c.identity.level >= 20) { const pool = sorcererFeature(c,"sorcery-points");if (pool) pool.uses.used = Math.max(0,pool.uses.used-4); }
  return syncSorcerer(c);
}
export async function performSorcererAction(input: CharacterV2,operation: string,actionInput: SorcererAction,options: { expectedRevision: number;updatedAt: string }) {
  const c = CharacterV2Schema.parse(input),a = SorcererActionSchema.parse(actionInput),operationId = StableIdSchema.parse(operation),updatedAt = IsoTimestampSchema.parse(options.updatedAt),r = c.spellcasting.sorcerer;
  if (c.builder?.classKey !== "sorcerer" || !r) throw new Error("Este control requiere una ficha guiada de Hechicero.");
  const payload = canonicalJsonStringify(a as unknown as JsonValue),previous = r.actions.find((s) => s.operationId === operationId);if (previous) { if (previous.payload !== payload) throw new Error("La operación ya se utilizó con otros datos.");return c; }
  if (c.revision !== options.expectedRevision) throw new CharacterRevisionConflictError(options.expectedRevision,c.revision);
  const origin = sorcererOrigin(c.builder),level = c.identity.level;
  if (!["strength-grave","elapsed","surge","end-form"].includes(a.kind) && incapacitated(c)) throw new Error("Necesitás poder actuar para usar este rasgo.");
  if (a.kind === "create-slot") { spendSorcery(c,SLOT_POINT_COST[a.level]!);const s = c.spellcasting.slots[String(a.level)]!;s.maximum++;r.createdSlots[String(a.level)] = (r.createdSlots[String(a.level)] ?? 0)+1; }
  else if (a.kind === "empowered-damage") { if (!replaySorcererChoices(c.builder).metamagic.includes("empowered")) throw new Error("No conocés Conjuro Potenciado.");spendSorcery(c,1); }
  else if (a.kind === "convert-slot") { const pool = sorcererFeature(c,"sorcery-points"),s = c.spellcasting.slots[String(a.level)];if (!pool || !s || s.used >= s.maximum || !pool.uses.used) throw new Error("Necesitás un espacio disponible y puntos gastados que recuperar.");s.used++;pool.uses.used = Math.max(0,pool.uses.used-a.level); }
  else if (a.kind === "feature") {
    const rules: Record<typeof a.key,{ origin: string;level: number;cost: number;limited?: boolean }> = { tides: { origin: "wild-magic",level: 1,cost: 0,limited: true },"bend-luck": { origin: "wild-magic",level: 6,cost: 2 },favored: { origin: "divine-soul",level: 1,cost: 0,limited: true },"empowered-healing": { origin: "divine-soul",level: 6,cost: 1 },hound: { origin: "shadow",level: 6,cost: 3 },"shadow-form": { origin: "shadow",level: 18,cost: 6 },recovery: { origin: "divine-soul",level: 18,cost: 0,limited: true },"wind-share": { origin: "storm",level: 18,cost: 0,limited: true } },rule = rules[a.key];
    if (origin !== rule.origin || level < rule.level) throw new Error("Este rasgo requiere su origen y nivel correspondientes.");
    if (a.key === "recovery" && c.combat.hitPoints.current >= c.combat.hitPoints.maximum/2) throw new Error("Recuperación Sobrenatural exige menos de la mitad de tus PG máximos.");
    if (rule.cost) spendSorcery(c,rule.cost);if (rule.limited) use(c,a.key);
    if (a.key === "shadow-form") r.shadowTurns = 10;
    if (a.key === "wind-share") r.sharedFlightMinutes = 60;
    if (a.key === "recovery") c.combat.hitPoints.current = Math.min(c.combat.hitPoints.maximum,c.combat.hitPoints.current+Math.floor(c.combat.hitPoints.maximum/2));
  } else if (a.kind === "wings") {
    if (!["draconic","divine-soul"].includes(origin!) || level < 14) throw new Error("Las alas requieren ese origen en nivel 14.");
    if (a.active && origin === "draconic" && c.inventory.some((i) => i.equipped && i.category === "armor") && !a.armorAccommodates) throw new Error("La armadura debe estar adaptada a las alas de dragón.");r.wings = a.active;
  } else if (a.kind === "presence") {
    if (origin !== "draconic" || level < 18) throw new Error("Presencia Draconiana requiere Linaje Dracónico 18.");spendSorcery(c,5);r.presenceTurns = 10;r.presenceId = await createDeterministicId("cnd",operationId,"presence");c.combat.conditions = [...c.combat.conditions.filter((s) => s.key !== "concentration"),{ id: r.presenceId,key: "concentration",label: `Presencia Draconiana · ${a.effect === "awe" ? "Sobrecogimiento" : "Miedo"}`,level: null,addedAt: updatedAt }];
  } else if (a.kind === "strength-grave") {
    if (origin !== "shadow" || c.combat.hitPoints.current !== 0 || a.radiant || a.critical || c.combat.conditions.some((s) => s.key === "dead")) throw new Error("Fuerza de la Tumba exige quedar a cero sin daño radiante, crítico ni muerte instantánea.");
    const t = sorcererFeature(c,"strength-grave");if (!t || t.uses.used >= t.uses.maximum) throw new Error("No quedan usos de Fuerza de la Tumba.");
    if (a.saveTotal >= 5+a.damage) { use(c,"strength-grave");c.combat.hitPoints.current = 1;c.combat.deathSaves = { successes: 0,failures: 0 };c.combat.conditions = c.combat.conditions.filter((s) => s.key !== "unconscious"); }
  } else if (a.kind === "surge") {
    if (origin !== "wild-magic" || a.rolls.length !== (level >= 14 ? 2 : 1) || a.chosen >= a.rolls.length) throw new Error("La oleada requiere Magia Salvaje y uno o dos d100 según Caos Controlado.");
    const tides = sorcererFeature(c,"tides");if (a.fromTides && (!tides || tides.uses.used === 0)) throw new Error("La oleada de Mareas exige que su uso esté gastado.");
    r.lastSurge = { rolls: a.rolls,chosen: a.chosen };if (a.fromTides) tides!.uses.used = 0;
    if (a.rolls[a.chosen]! >= 99) { const pool = sorcererFeature(c,"sorcery-points");if (pool) pool.uses.used = 0; }
  } else if (a.kind === "elapsed") { r.resistanceMinutes = Math.max(0,r.resistanceMinutes-a.minutes);r.sharedFlightMinutes = Math.max(0,r.sharedFlightMinutes-a.minutes);r.shadowTurns = Math.max(0,r.shadowTurns-Math.max(a.turns,Math.floor(a.minutes*10)));r.presenceTurns = Math.max(0,r.presenceTurns-Math.max(a.turns,Math.floor(a.minutes*10)));if (!r.presenceTurns && r.presenceId) { c.combat.conditions = c.combat.conditions.filter((s) => s.id !== r.presenceId);r.presenceId = null; } }
  else if (a.kind === "end-form") r.shadowTurns = 0;
  r.actions.push({ operationId,payload });return CharacterV2Schema.parse(syncSorcerer({ ...c,revision: c.revision+1,metadata: { ...c.metadata,updatedAt } }));
}
