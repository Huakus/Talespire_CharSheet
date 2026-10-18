import { CharacterV2Schema,StableIdSchema,IsoTimestampSchema,type CharacterV2 } from "./character-v2";
import { WarlockActionSchema,type WarlockAction } from "./warlock-model";
import { replayWarlockChoices,applyWarlockBenefits,setConjuredPactWeapon } from "./warlock-builder";
import { pactSlots } from "./warlock-catalog";
import { PHB_SPELLS } from "./phb-spells";
import type { CharacterSpellV2 } from "./character-spell-model";
import { abilityModifier,projectAbilityScore,projectInventory,preferredWeaponAbility } from "./character-projection";
import { canCastWithEquippedArmor,type WizardCastOptions } from "./wizard-play";
import { CharacterRevisionConflictError } from "./edit-character";
import { canonicalJsonStringify,type JsonValue } from "../../shared/json";
import { equipmentSlotCapacity } from "../equipment/equipment-spell-slots";

export function warlockSpellAvailable(character: CharacterV2,spell: CharacterSpellV2) {
  if (!spell.casting?.source.startsWith("builder:warlock:")) return true;
  if (["builder:warlock:tome","builder:warlock:ritual"].includes(spell.casting.source) && !character.spellcasting.warlock?.bookAvailable) return false;
  if (spell.casting.traitId) { const trait = character.traits.flatMap((g) => g.traits).find((t) => t.id === spell.casting!.traitId); if (!trait || trait.uses.used >= trait.uses.maximum) return false; }
  return true;
}
export function warlockRitualAvailable(character: CharacterV2,spell: CharacterSpellV2) {
  if (!spell.definition?.ritual) return false;
  if (!spell.casting || spell.casting.kind === "ritual" && !spell.casting.source.startsWith("builder:warlock:")) return true;
  if (!spell.casting.source.startsWith("builder:warlock:")) return false;
  const replay = replayWarlockChoices(character.builder!);
  return replay.boon === "chain" && spell.casting.key === "find-familiar" || !!character.spellcasting.warlock?.bookAvailable && replay.invocations.includes("book-of-ancient-secrets") && (spell.casting.source === "builder:warlock:ritual" || spell.casting.source.startsWith("builder:warlock:feat-slots-") || replay.spells.includes(spell.casting.key));
}
export function prepareWarlockCast(character: CharacterV2,spell: CharacterSpellV2,level: number,options: WizardCastOptions) {
  if (!canCastWithEquippedArmor(character)) throw new Error("No podés lanzar con armadura o escudo sin competencia.");
  if (!warlockSpellAvailable(character,spell)) throw new Error("Este lanzamiento requiere el Libro de las Sombras disponible o un uso del recurso sin gastar.");
  if (options.mode && !["slot","ritual"].includes(options.mode)) throw new Error("Este modo de lanzamiento no corresponde a Brujo.");
  if (options.mode === "ritual") {
    if (!warlockRitualAvailable(character,spell) || level !== spell.level) throw new Error("Brujo no obtiene lanzamiento ritual general: requiere Cadena, Libro de secretos ancestrales u otra fuente que lo conceda.");
    return true;
  }
  if (spell.casting?.kind === "at-will") { if (level !== spell.level) throw new Error("Una invocación a voluntad se lanza a su nivel base."); return true; }
  if (spell.level > 0 && ["pact","pact-invocation"].includes(spell.casting?.kind ?? "")) {
    if (level !== pactSlots(character.identity.level).level && !character.inventory.some((item) => equipmentSlotCapacity(item,level) > (item.rules?.slotUsage[String(level)] ?? 0))) throw new Error("Todos tus espacios de magia de pacto tienen el mismo nivel; el objeto debe conceder un espacio adicional válido para usar otro nivel.");
    if (spell.casting?.kind === "pact-invocation") {
      const trait = character.traits.flatMap((g) => g.traits).find((t) => t.id === spell.casting!.traitId);
      if (!trait || trait.uses.used >= trait.uses.maximum) throw new Error("No quedan usos de esta invocación hasta descanso largo.");
      trait.uses.used++;
    }
  }
  return false;
}
export async function applyWarlockAction(input: CharacterV2,actionInput: WarlockAction,options: { operationId: string;expectedRevision: number;updatedAt: string }) {
  let character = CharacterV2Schema.parse(input);
  const action = WarlockActionSchema.parse(actionInput), operationId = StableIdSchema.parse(options.operationId),updatedAt = IsoTimestampSchema.parse(options.updatedAt), payload = canonicalJsonStringify(action as JsonValue);
  if (character.builder?.classKey !== "warlock" || !character.spellcasting.warlock) throw new Error("Este control requiere una ficha guiada de Brujo.");
  const runtime = character.spellcasting.warlock, old = runtime.actions.find((a) => a.operationId === operationId);
  if (old) { if (old.payload !== payload) throw new Error("La operación ya se confirmó con otras elecciones."); return character; }
  if (character.revision !== options.expectedRevision) throw new CharacterRevisionConflictError(options.expectedRevision,character.revision);
  const replay = replayWarlockChoices(character.builder), level = character.identity.level;
  switch (action.kind) {
    case "healing-light": {
      const trait = character.traits.flatMap((g) => g.traits).find((t) => t.id === runtime.resourceIds["healing-light"]);
      if (replay.patron !== "celestial" || !trait || action.dice > Math.max(1,abilityModifier(projectAbilityScore(character,"charisma"))) || trait.uses.used+action.dice > trait.uses.maximum) throw new Error("Luz Sanadora requiere dados disponibles y como máximo CAR dados (mínimo uno) por acción adicional.");
      trait.uses.used += action.dice; break;
    }
    case "eldritch-smite": {
      const slot = character.spellcasting.slots[String(pactSlots(level).level)]!;
      if (!replay.invocations.includes("eldritch-smite") || slot.used >= slot.maximum) throw new Error("Castigo Sobrenatural requiere la invocación y un espacio de pacto disponible.");
      slot.used++; break;
    }
    case "hex-weapon": {
      const item = character.inventory.find((i) => i.id === action.id), attack = character.actions.find((a) => a.inventoryItemId === action.id);
      if (replay.patron !== "hexblade" || !item?.weapon || item.properties.includes("two-handed") || !attack?.proficient) throw new Error("Guerrero Maléfico requiere un arma competente sin dos manos; el arma de pacto se beneficia aparte.");
      const old = character.actions.find((a) => a.inventoryItemId === runtime.hexWeaponId);
      if (old && runtime.hexWeaponId !== runtime.pactWeaponId && old.ability === "charisma") { const oldItem = character.inventory.find((i) => i.id === old.inventoryItemId)!; const ability = preferredWeaponAbility(character.abilities,oldItem); old.damageBonus += abilityModifier(character.abilities[ability])-abilityModifier(character.abilities.charisma); old.ability = ability; }
      const previousAbility = attack.ability;
      if (previousAbility) attack.damageBonus += abilityModifier(character.abilities.charisma)-abilityModifier(character.abilities[previousAbility]);
      attack.ability = "charisma"; runtime.hexWeaponId = item.id; break;
    }
    case "eldritch-master": {
      const trait = character.traits.flatMap((g) => g.traits).find((t) => t.id === runtime.resourceIds["eldritch-master"]);
      if (level < 20 || !trait || trait.uses.used >= trait.uses.maximum) throw new Error("Maestro sobrenatural requiere Brujo 20 y un uso disponible.");
      trait.uses.used++; character.spellcasting.slots[String(pactSlots(level).level)]!.used = 0; break;
    }
    case "dark-blessing":
      if (replay.patron !== "fiend") throw new Error("Bendición del Oscuro requiere patrón Infernal.");
      character.combat.hitPoints.temporary = Math.max(character.combat.hitPoints.temporary,1,level+abilityModifier(projectAbilityScore(character,"charisma"))); break;
    case "resistance":
      if (replay.patron !== "fiend" || level < 10) throw new Error("Resistencia infernal requiere Infernal 10.");
      runtime.resistance = action.damageType; break;
    case "book-access": case "replace-book":
      if (replay.boon !== "tome") throw new Error("Este libro requiere Pacto del Tomo.");
      runtime.bookAvailable = action.kind === "replace-book" || action.available; break;
    case "copy-ritual": {
      const definition = PHB_SPELLS[action.key];
      if (!runtime.bookAvailable || !replay.invocations.includes("book-of-ancient-secrets") || !definition?.ritual || definition.level < 1 || definition.level > Math.ceil(level/2) || [...replay.rituals,...runtime.copiedRituals.map((r) => r.key)].includes(action.key)) throw new Error("La copia requiere Libro de secretos ancestrales, libro disponible y un ritual nuevo de nivel hasta la mitad de Brujo, redondeada arriba.");
      if (!action.scrollCheckSucceeded) throw new Error("Resolvé con el GM la prueba y el consumo del pergamino antes de copiar.");
      const gold = definition.level*50,c = character.currency,total = c.copper+c.silver*10+c.electrum*50+c.gold*100+c.platinum*1000-gold*100;
      if (total < 0) throw new Error(`Necesitás ${gold} po para copiar este ritual.`);
      character.currency = { copper: total%10,silver: Math.floor(total%100/10),electrum: 0,gold: Math.floor(total/100),platinum: 0 };
      runtime.copiedRituals.push({ operationId,key: action.key,gold,hours: definition.level*2 });
      character = await applyWarlockBenefits(character); break;
    }
    case "pact-weapon":
      if (replay.boon !== "blade") throw new Error("Crear un arma de pacto requiere Pacto del Filo.");
      character = await setConjuredPactWeapon(character,action.key); character.combat.armorClass = projectInventory(character).calculatedArmorClass; break;
  }
  character.spellcasting.warlock!.actions.push({ operationId,payload }); character.spellcasting.warlock!.actions = character.spellcasting.warlock!.actions.slice(-200);
  character.revision++; character.metadata.updatedAt = updatedAt;
  return CharacterV2Schema.parse(character);
}
