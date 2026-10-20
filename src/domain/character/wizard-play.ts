import type { SorcererCastOptions } from "./sorcerer-model";
import { recoverableEquipmentSlotCount, restoreExpendedSpellSlot } from "../equipment/equipment-spell-slots";
import { CharacterV2Schema, IsoTimestampSchema, StableIdSchema, type CharacterV2 } from "./character-v2";
import { WizardActionSchema, type WizardAction } from "./wizard-model";
import { wizardSchool, WIZARD_SCHOOLS, WIZARD_SLOTS, wizardSpellSource, wizardBookDefinition, wizardCopyAccess } from "./wizard-catalog";
import { PHB_SPELLS } from "./phb-spells";
import { applyWizardBenefits, wizardPreparationLimit, wizardSignature } from "./wizard-builder";
import { abilityModifier, projectAbilityScore, projectUpdatedBuilderSpeed } from "./character-projection";
import { CharacterRevisionConflictError } from "./edit-character";
import { canonicalJsonStringify, type JsonValue } from "../../shared/json";
import type { CharacterSpellV2 } from "./character-spell-model";

export function wizardWardMaximum(character: CharacterV2): number { return Math.max(0,2*character.identity.level+abilityModifier(projectAbilityScore(character,"intelligence"))); }
export function wizardFeature(character: CharacterV2, key: string) { const id = character.spellcasting.wizard?.resourceIds[key]; return character.traits.flatMap((g) => g.traits).find((t) => id ? t.id === id : t.name === key); }
function schoolRequired(character: CharacterV2, school: ReturnType<typeof wizardSchool>, level: number) { if (wizardSchool(character.builder!) !== school || character.identity.level < level) throw new Error("Tu escuela o nivel no concede este beneficio."); }
function classFeature(character: CharacterV2, key: string) {
  const names: Record<string,string> = { "arcane-recovery": "Recuperación arcana", "benign-transposition": "Transposición benigna", "illusory-self": "Yo ilusorio", "third-eye": "Tercer ojo", shapechanger: "Cambiaformas" };
  const trait = wizardFeature(character,names[key] ?? key);
  if (!trait) throw new Error("El rasgo todavía no está disponible.");
  return trait;
}
function useFeature(character: CharacterV2, key: string) {
  const trait = classFeature(character,key);
  if (trait.uses.used >= trait.uses.maximum) throw new Error("No quedan usos de este rasgo.");
  trait.uses.used++;
}
function pay(character: CharacterV2, gold: number) {
  const c = character.currency, total = c.copper + c.silver*10 + c.electrum*50 + c.gold*100 + c.platinum*1000, remaining = total-Math.round(gold*100);
  if (remaining < 0) throw new Error(`Necesitás ${gold} po para los materiales y la copia.`);
  character.currency = { copper: remaining%10, silver: Math.floor(remaining%100/10), electrum: 0, gold: Math.floor(remaining/100), platinum: 0 };
}
export function wizardCopyCost(character: CharacterV2, key: string, source: "external" | "own" | "scroll") {
  const spell = wizardBookDefinition(key,character.spellcasting.wizard?.copied), school = wizardSchool(character.builder!);
  const priorCopy = character.spellcasting.wizard?.copied.find((copy) => copy.key === key);
  if (!spell || spell.level < 1 || !(priorCopy ? wizardCopyAccess(priorCopy) : spell.classes.includes("wizard")) || spell.level > WIZARD_SLOTS[character.identity.level]!.length) throw new Error("Solo podés copiar conjuros de mago de un nivel que puedas preparar.");
  const half = school && spell.school === WIZARD_SCHOOLS[school] ? .5 : 1;
  return { gold: spell.level * (source === "own" ? 10 : 50) * half, hours: spell.level * (source === "own" ? 1 : 2) * half };
}
function validateMastery(character: CharacterV2, keys: string[]) {
  const r = character.spellcasting.wizard!;
  if (character.identity.level < 18 || !r.bookAvailable || keys.length !== 2 || keys.some((key,i) => !r.book.includes(key) || wizardBookDefinition(key,r.copied)?.level !== i+1)) throw new Error("Elegí Maestría de niveles 1 y 2 entre los conjuros del libro disponible; requiere Mago 18.");
}
export async function applyWizardAction(input: CharacterV2, actionInput: WizardAction, options: { operationId: string; expectedRevision: number; updatedAt: string }): Promise<CharacterV2> {
  let character = CharacterV2Schema.parse(input);
  const action = WizardActionSchema.parse(actionInput), operationId = StableIdSchema.parse(options.operationId), updatedAt = IsoTimestampSchema.parse(options.updatedAt);
  if (character.builder?.classKey !== "wizard" || !character.spellcasting.wizard) throw new Error("Este control requiere una ficha guiada de Mago.");
  const runtime = character.spellcasting.wizard, payload = canonicalJsonStringify(action as JsonValue), old = runtime.actions.find((a) => a.operationId === operationId);
  if (old) { if (old.payload !== payload) throw new Error("Esta operación ya se utilizó con otras elecciones."); return character; }
  if (character.revision !== options.expectedRevision) throw new CharacterRevisionConflictError(options.expectedRevision,character.revision);
  const school = wizardSchool(character.builder), level = character.identity.level;
  switch (action.kind) {
    case "arcane-deflection": schoolRequired(character,"war-magic",2); runtime.arcaneDeflection = true; break;
    case "end-deflection": schoolRequired(character,"war-magic",2); runtime.arcaneDeflection = false; break;
    case "power-surge-gain":
      schoolRequired(character,"war-magic",6);
      runtime.powerSurges = Math.min(Math.max(1,abilityModifier(projectAbilityScore(character,"intelligence"))),runtime.powerSurges+1); break;
    case "power-surge-spend":
      schoolRequired(character,"war-magic",6);
      if (!runtime.powerSurges) throw new Error("No quedan sobrecargas de poder.");
      runtime.powerSurges--; break;
    case "prepare": {
      const signature = wizardSignature(character.builder);
      if (!runtime.bookAvailable || new Set(action.keys).size !== action.keys.length || action.keys.some((key) => !runtime.book.includes(key)) || action.keys.filter((key) => !signature.includes(key)).length > wizardPreparationLimit(character)) throw new Error("Prepará conjuros distintos del libro disponible, hasta nivel + INT; los característicos no ocupan cupo.");
      character.spellcasting.spells.forEach((spell) => { if (spell.casting?.kind === "wizard") spell.prepared = spell.level === 0 || action.keys.includes(spell.casting.key) || signature.includes(spell.casting.key); });
      break;
    }
    case "copy": {
      if (!runtime.bookAvailable || runtime.book.includes(action.key)) throw new Error("Necesitás un libro disponible y un conjuro que todavía no esté en él.");
      if (action.source === "scroll" && !action.scrollCheckSucceeded) throw new Error("Resolver primero la prueba de Inteligencia (Arcano) del pergamino; el GM controla su consumo, incluido un fallo.");
      const existing = character.spellcasting.spells.find((s) => s.casting?.kind === "wizard" && s.casting.key === action.key);
      const ownText = runtime.backups.some((b) => b.available && b.keys.includes(action.key)) || character.spellcasting.spells.some((s) => s.casting?.kind !== "wizard" && s.casting?.key === action.key && wizardSpellSource(character,s));
      if (action.source === "own" && !runtime.book.includes(action.key) && !existing?.prepared && !ownText) throw new Error("La notación propia requiere una copia propia disponible, o reconstruir un conjuro preparado de memoria.");
      const cost = wizardCopyCost(character,action.key,action.source);
      pay(character,cost.gold);
      const previousCopy = runtime.copied.find((copy) => copy.key === action.key);
      runtime.copied.push({ operationId,key: action.key,level,gold: cost.gold,hours: cost.hours,source: action.source,historical: false,definition: previousCopy?.definition ?? null,wizardAccess: previousCopy?.wizardAccess ?? "standard" }); runtime.book.push(action.key);
      const previouslyPrepared = new Set(character.spellcasting.spells.filter((s) => s.prepared).map((s) => s.id));
      character = await applyWizardBenefits(character,character);
      character.spellcasting.spells.forEach((spell) => { if (spell.casting?.kind === "wizard") spell.prepared = spell.level === 0 || previouslyPrepared.has(spell.id) || wizardSignature(character.builder!).includes(spell.casting.key); });
      break;
    }
    case "book-access": {
      if (!action.id || action.id === runtime.activeBookId) runtime.bookAvailable = action.available;
      const active = runtime.backups.find((b) => b.id === (action.id ?? runtime.activeBookId));
      if (action.id && !active) throw new Error("No existe esa copia del libro.");
      if (active) active.available = action.available;
      break;
    }
    case "replace-book": {
      if (new Set(action.keys).size !== action.keys.length || action.keys.some((key) => !character.spellcasting.spells.some((s) => s.casting?.kind === "wizard" && s.level > 0 && s.prepared && s.casting.key === key))) throw new Error("Sin el libro anterior, solo podés reconstruir los conjuros que conservás preparados.");
      const gold = action.keys.reduce((sum,key) => sum+wizardCopyCost(character,key,"own").gold,action.buyBlankBook ? 50 : 0);
      pay(character,gold); runtime.book = [...action.keys]; runtime.bookAvailable = true; runtime.activeBookId = null;
      break;
    }
    case "backup-book": {
      if (!runtime.bookAvailable || !action.keys.length || new Set(action.keys).size !== action.keys.length || action.keys.some((key) => !runtime.book.includes(key))) throw new Error("La copia de respaldo requiere conjuros distintos de tu libro disponible.");
      const gold = action.keys.reduce((sum,key) => sum+wizardCopyCost(character,key,"own").gold,action.buyBlankBook ? 50 : 0);
      pay(character,gold); runtime.backups.push({ id: operationId,keys: [...action.keys],available: true }); break;
    }
    case "use-backup": {
      const book = runtime.backups.find((b) => b.id === action.id && b.available);
      if (!book) throw new Error("La copia de respaldo no está disponible.");
      if (!runtime.activeBookId) runtime.backups.push({ id: operationId,keys: [...runtime.book],available: runtime.bookAvailable });
      runtime.book = [...book.keys]; runtime.bookAvailable = true; runtime.activeBookId = book.id; break;
    }
    case "mastery": validateMastery(character,action.keys); runtime.mastery = [...action.keys]; break;
    case "arcane-recovery": {
      if (action.slots.reduce((a,b) => a+b,0) > Math.ceil(level/2)) throw new Error("Recuperación arcana excede la mitad del nivel de mago redondeada arriba.");
      const counts = new Map<number,number>(); action.slots.forEach((n) => counts.set(n,(counts.get(n) ?? 0)+1));
      for (const [slot,count] of counts) if (recoverableEquipmentSlotCount(character, slot) < count) throw new Error("Solo podés recuperar espacios gastados que no se hayan recuperado ya mediante un objeto.");
      useFeature(character,"arcane-recovery");
      for (const [slot,count] of counts) for (let n = 0; n < count; n++) restoreExpendedSpellSlot(character, slot);
      break;
    }
    case "portent-roll":
      schoolRequired(character,"divination",2);
      if (!runtime.portentNeedsRoll || action.values.length !== (level >= 14 ? 3 : 2)) throw new Error("Registrá los dados de Portento una sola vez tras el descanso largo: dos, o tres desde Mago 14.");
      runtime.portent = action.values.map((value) => ({ value,used: false })); runtime.portentNeedsRoll = false; break;
    case "portent-use":
      schoolRequired(character,"divination",2);
      if (!runtime.portent[action.index] || runtime.portent[action.index]!.used) throw new Error("Ese Portento ya se gastó o no existe.");
      runtime.portent[action.index]!.used = true; break;
    case "ward-damage":
      schoolRequired(character,"abjuration",action.projected ? 6 : 2);
      if (!runtime.ward.created) throw new Error("Creá el guardián al lanzar una abjuración de nivel 1 o superior.");
      runtime.ward.current = Math.max(0,runtime.ward.current-action.damage); break;
    case "stone":
      schoolRequired(character,"transmutation",6);
      if (action.create) { if (runtime.stoneConsumed) throw new Error("La piedra fue consumida; necesitás terminar un descanso largo antes de recrearla."); }
      else if (!runtime.stone || runtime.stone.bearer !== "self" || !runtime.stoneChangeAvailable) throw new Error("Para cambiar el beneficio, llevá la piedra y lanzá una transmutación de nivel 1+; crear otra requiere ocho horas.");
      runtime.stone = { benefit: action.benefit,bearer: action.bearer,unencumbered: action.unencumbered }; runtime.stoneChangeAvailable = false; break;
    case "master-transmuter":
      schoolRequired(character,"transmutation",14);
      if (!runtime.stone || runtime.stone.bearer !== "self") throw new Error("Necesitás tener la piedra para consumirla.");
      runtime.stone = null; runtime.stoneConsumed = true; runtime.stoneChangeAvailable = false; break;
    case "stone-transfer":
      schoolRequired(character,"transmutation",6);
      if (!runtime.stone) throw new Error("No hay piedra para transferir.");
      runtime.stone = { ...runtime.stone,bearer: action.bearer,unencumbered: action.unencumbered }; runtime.stoneChangeAvailable = false; break;
    case "third-eye": schoolRequired(character,"divination",10); useFeature(character,"third-eye"); runtime.thirdEye = action.benefit; break;
    case "use-feature":
      schoolRequired(character,action.key === "benign-transposition" ? "conjuration" : "illusion",action.key === "benign-transposition" ? 6 : 10);
      useFeature(character,action.key); break;
  }
  character.spellcasting.wizard!.actions.push({ operationId,payload });
  character.spellcasting.wizard!.actions = character.spellcasting.wizard!.actions.slice(-200);
  character.combat.speed = projectUpdatedBuilderSpeed(input,character);
  character.revision++; character.metadata.updatedAt = updatedAt;
  return CharacterV2Schema.parse(character);
}

export interface WizardCastOptions extends SorcererCastOptions { mode?: "slot" | "ritual" | "mastery" | "signature" | "shapechanger" | "shadow-darkness" | `ki-${number}` | undefined; recoverSlotLevel?: number | undefined; createWard?: boolean | undefined; overchannel?: boolean | undefined }
export function canCastWithEquippedArmor(character: CharacterV2) {
  const known = character.proficiencies.armor.map((s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase());
  return character.inventory.filter((i) => i.equipped && i.armor).every((item) => {
    const category = item.armor!.armorCategory.toLowerCase();
    return known.some((p) => /todas|all armor/.test(p) || (item.category === "shield" ? /escudo|shield/.test(p) : /light|ligera/.test(category) ? /light|ligera/.test(p) : /medium|media/.test(category) ? /medium|media/.test(p) : /heavy|pesada/.test(category) && /heavy|pesada/.test(p)));
  });
}
export function prepareWizardCast(character: CharacterV2, spell: CharacterSpellV2, slot: number, options: WizardCastOptions): boolean {
  if (character.spellcasting.wizard?.arcaneDeflection && spell.level > 0) throw new Error("Tras Desviación Arcana solo podés lanzar trucos hasta el final de tu siguiente turno.");
  if (character.builder?.classKey !== "wizard") { if (options.mode && options.mode !== "slot") throw new Error("Este modo de lanzamiento requiere Mago."); return false; }
  if (!canCastWithEquippedArmor(character)) throw new Error("No podés lanzar con armadura o escudo sin competencia.");
  const mode = options.mode ?? "slot", runtime = character.spellcasting.wizard!, school = wizardSchool(character.builder), isWizardSpell = spell.casting?.kind === "wizard", key = spell.casting?.key ?? "";
  const definition = wizardSpellSource(character,spell) ? wizardBookDefinition(key,runtime.copied) : spell.definition;
  if (!definition) throw new Error("El conjuro no tiene definición válida.");
  if (definition.concentration) runtime.concentrationSchool = definition.school;
  let free = spell.casting?.kind === "ritual" || spell.casting?.kind === "innate";
  const manualRitual = mode === "ritual" && !spell.casting && definition.ritual;
  if (mode !== "slot" && !isWizardSpell && !manualRitual) throw new Error("Este modo requiere un conjuro de tu clase Mago.");
  if (mode === "ritual") {
    if (!definition.ritual || (!manualRitual && (!runtime.bookAvailable || !runtime.book.includes(key))) || slot !== definition.level) throw new Error("El ritual necesita estar en tu libro disponible y se lanza a su nivel base.");
    free = true;
  } else if (mode === "mastery") {
    if (character.identity.level < 18 || !runtime.mastery.includes(key) || !spell.prepared || slot !== spell.level) throw new Error("Maestría requiere el conjuro elegido preparado, a su nivel base.");
    free = true;
  } else if (mode === "signature") {
    if (!wizardSignature(character.builder).includes(key) || slot !== 3) throw new Error("Elegí uno de tus conjuros característicos a nivel 3.");
    useFeature(character,`Conjuro característico: ${wizardBookDefinition(key,runtime.copied)!.name}`); free = true;
  } else if (mode === "shapechanger") {
    schoolRequired(character,"transmutation",10);
    if (key !== "polymorph" || slot !== 4 || !spell.prepared) throw new Error("Cambiaformas requiere Polimorfar preparado y solo te transforma a vos en bestia de VD 1 o menor.");
    useFeature(character,"shapechanger"); free = true;
  } else if (isWizardSpell && spell.level > 0 && !spell.prepared) throw new Error("Prepará este conjuro desde tu libro tras un descanso largo.");
  if (options.overchannel) {
    schoolRequired(character,"evocation",14);
    if (!wizardSpellSource(character,spell) || slot < 1 || slot > 5 || !definition.damageExpression) throw new Error("Sobrecanalizar requiere un conjuro dañino de mago de nivel 1 a 5.");
    runtime.overchannelUses++;
  }
  // Effects that trigger on a cast apply to rituals and racial magic too.
  if (slot >= 1) {
    if (school === "abjuration" && definition.school === "Abjuración") {
      if (!runtime.ward.created && options.createWard !== false) runtime.ward = { created: true,current: wizardWardMaximum(character) };
      else if (runtime.ward.created) runtime.ward.current = Math.min(wizardWardMaximum(character),runtime.ward.current+2*slot);
    }
    if (school === "conjuration" && character.identity.level >= 6 && definition.school === "Conjuración") classFeature(character,"benign-transposition").uses.used = 0;
    if (school === "transmutation" && character.identity.level >= 6 && definition.school === "Transmutación" && runtime.stone?.bearer === "self") runtime.stoneChangeAvailable = true;
  }
  if (options.recoverSlotLevel) {
    const recovered = options.recoverSlotLevel;
    if (school !== "divination" || character.identity.level < 6 || free || slot < 2 || definition.school !== "Adivinación" || !Number.isInteger(recovered) || recovered < 1 || recovered >= slot || recovered > 5 || !recoverableEquipmentSlotCount(character, recovered)) throw new Error("Adivinación experta recupera un espacio gastado inferior al lanzamiento, hasta nivel 5, solo al gastar espacio en adivinación 2+.");
    restoreExpendedSpellSlot(character, recovered);
  }
  return free;
}
export function resetWizardAfterRest(character: CharacterV2, rest: "short-rest" | "long-rest"): void {
  const runtime = character.spellcasting.wizard;
  if (!runtime) return;
  runtime.arcaneDeflection = false;
  if (character.builder && wizardSchool(character.builder) === "war-magic" && character.identity.level >= 6 && (rest === "long-rest" || runtime.powerSurges === 0)) runtime.powerSurges = 1;
  runtime.thirdEye = null;
  if (rest === "long-rest") {
    runtime.portent = []; runtime.portentNeedsRoll = true;
    runtime.ward = { created: false,current: 0 };
    runtime.overchannelUses = 0; runtime.stoneConsumed = false; runtime.stoneChangeAvailable = false;
  }
}
