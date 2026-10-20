import { prepareMartialCast } from "./martial-play";
import { prepareSorcererCast,syncSorcerer } from "./sorcerer-play";
import { prepareRangerCast } from "./ranger-play";
import { prepareDruidCast } from "./druid-play";
import { prepareBardCast } from "./bard-play";
import { prepareBarbarianCast } from "./barbarian-play";
import { prepareRogueCast } from "./rogue-play";
import { PHB_SPELLS } from "./phb-spells";
import { prepareClericCast } from "./cleric-play";
import {
  CharacterV2Schema,
  IsoTimestampSchema,
  StableIdSchema,
  type CharacterV2,
} from "./character-v2";
import { CharacterRevisionConflictError } from "./edit-character";
import {
  CharacterSpellV2Schema,
  SpellLevelSchema,
  SpellSlotStateSchema,
  type CharacterSpellV2,
} from "./character-spell-model";
import { prepareWizardCast, type WizardCastOptions } from "./wizard-play";
import { prepareWarlockCast } from "./warlock-play";
import { itemSpellState } from "./item-spells";
import { useInventoryFeature } from "./character-inventory";
import { spendEquipmentSpellSlot, resetEquipmentSlots, resetRestoredEquipmentSlots } from "../equipment/equipment-spell-slots";

export * from "./character-spell-model";

export class CharacterSpellNotFoundError extends Error {
  constructor(readonly spellId: string) {
    super(`Character spell ${spellId} was not found`);
    this.name = "CharacterSpellNotFoundError";
  }
}

export class SpellSlotUnavailableError extends Error {
  constructor(readonly level: number) {
    super(`No level ${level} spell slot is available`);
    this.name = "SpellSlotUnavailableError";
  }
}

interface SpellMutationOptions {
  expectedRevision: number;
  updatedAt: string;
}

function prepare(input: CharacterV2, options: SpellMutationOptions): {
  character: CharacterV2;
  updatedAt: string;
} {
  const character = CharacterV2Schema.parse(input);
  const updatedAt = IsoTimestampSchema.parse(options.updatedAt);
  if (character.revision !== options.expectedRevision) {
    throw new CharacterRevisionConflictError(options.expectedRevision, character.revision);
  }
  return { character, updatedAt };
}

function finish(
  character: CharacterV2,
  spellcasting: CharacterV2["spellcasting"],
  updatedAt: string,
  combat = character.combat,
): CharacterV2 {
  return CharacterV2Schema.parse({
    ...character,
    spellcasting,
    combat,
    revision: character.revision + 1,
    metadata: { ...character.metadata, updatedAt },
  });
}

export function upsertCharacterSpell(
  input: CharacterV2,
  spellInput: CharacterSpellV2,
  options: SpellMutationOptions,
): CharacterV2 {
  const { character, updatedAt } = prepare(input, options);
  const spell = CharacterSpellV2Schema.parse(spellInput);
  const existing = character.spellcasting.spells.find((entry) => entry.id === spell.id);
  if ((spell.casting?.source.startsWith("builder:rogue") || existing?.casting?.source.startsWith("builder:rogue")) && (!existing || JSON.stringify(spell.casting) !== JSON.stringify(existing.casting) || spell.name !== existing.name || spell.level !== existing.level || spell.prepared !== existing.prepared)) throw new Error("Los conocidos de Brib\u00f3n Arcano se gestionan desde el tutorial y Ladr\u00f3n de Conjuros.");
  if ([spell.casting?.source,existing?.casting?.source].some((s) => s === "builder:monk" || s === "builder:paladin") && (!existing || JSON.stringify(spell.casting) !== JSON.stringify(existing.casting) || spell.name !== existing.name || spell.level !== existing.level || spell.prepared !== existing.prepared)) throw new Error("Estos conjuros se gestionan con el tutorial y la preparación de clase.");
  if ((spell.casting?.source === "builder:sorcerer" || existing?.casting?.source === "builder:sorcerer") && (!existing || JSON.stringify(spell.casting) !== JSON.stringify(existing.casting) || spell.name !== existing.name || spell.level !== existing.level || spell.prepared !== existing.prepared)) throw new Error("Los conocidos de Hechicero se gestionan desde el tutorial.");
  if ((spell.casting?.source === "builder:bard" || existing?.casting?.source === "builder:bard") && (!existing || JSON.stringify(spell.casting) !== JSON.stringify(existing.casting) || spell.name !== existing.name || spell.level !== existing.level || spell.prepared !== existing.prepared)) throw new Error("Los conocidos de Bardo se gestionan desde el tutorial.");
  if ((spell.casting?.source === "builder:barbarian" || existing?.casting?.source === "builder:barbarian") && (!existing || JSON.stringify(spell.casting) !== JSON.stringify(existing.casting) || spell.name !== existing.name || spell.level !== existing.level || spell.prepared !== existing.prepared)) throw new Error("Los conjuros de la senda se gestionan desde el tutorial de B\u00e1rbaro.");
  if ((spell.casting?.source.startsWith("builder:ranger") || existing?.casting?.source.startsWith("builder:ranger")) && (!existing || JSON.stringify(spell.casting) !== JSON.stringify(existing.casting) || (spell.name !== existing.name && spell.name !== PHB_SPELLS[existing.casting?.key ?? ""]?.name) || spell.level !== existing.level || spell.prepared !== existing.prepared)) throw new Error("Los conjuros conocidos de Explorador se gestionan desde el tutorial de subida de nivel.");
  if ((spell.casting?.source.startsWith("builder:druid") || existing?.casting?.source.startsWith("builder:druid")) && (!existing || JSON.stringify(spell.casting) !== JSON.stringify(existing.casting) || (spell.name !== existing.name && spell.name !== PHB_SPELLS[existing.casting?.key ?? ""]?.name) || spell.level !== existing.level || spell.prepared !== existing.prepared)) throw new Error("Los conjuros de Druida se gestionan desde el tutorial y su preparación diaria.");
  if ((spell.casting?.kind === "cleric" || existing?.casting?.kind === "cleric") && (!existing || JSON.stringify(spell.casting) !== JSON.stringify(existing.casting) || (spell.name !== existing.name && spell.name !== PHB_SPELLS[existing.casting?.key ?? ""]?.name) || spell.level !== existing.level || spell.prepared !== existing.prepared)) throw new Error("Los conjuros de Clérigo se gestionan desde el tutorial y su preparación diaria.");
  if ((spell.casting?.source.startsWith("builder:warlock:") || existing?.casting?.source.startsWith("builder:warlock:")) && (!existing || JSON.stringify(spell.casting) !== JSON.stringify(existing.casting) || (spell.name !== existing.name && spell.name !== PHB_SPELLS[existing.casting?.key ?? ""]?.name) || spell.level !== existing.level || spell.prepared !== existing.prepared)) throw new Error("Los conjuros de Brujo se gestionan desde el tutorial y sus recursos.");
  if (spell.casting?.kind === "wizard" && !existing) throw new Error("Aprendé conjuros de mago al subir de nivel o copiándolos al libro.");
  if (existing?.casting?.kind === "wizard" && (spell.casting?.kind !== "wizard" || spell.casting.key !== existing.casting.key || (spell.name !== existing.name && spell.name !== PHB_SPELLS[existing.casting?.key ?? ""]?.name) || spell.level !== existing.level || spell.prepared !== existing.prepared)) throw new Error("El conjuro del libro y su preparación se gestionan con los controles de Mago.");
  const spells = [
    ...character.spellcasting.spells.filter((entry) => entry.id !== spell.id),
    spell,
  ].sort((left, right) => left.level - right.level || left.order - right.order || left.name.localeCompare(right.name));
  return finish(character, { ...character.spellcasting, spells }, updatedAt);
}

export function removeCharacterSpell(
  input: CharacterV2,
  spellIdInput: string,
  options: SpellMutationOptions,
): CharacterV2 {
  const { character, updatedAt } = prepare(input, options);
  const spellId = StableIdSchema.parse(spellIdInput);
  if (["builder:monk","builder:paladin"].includes(character.spellcasting.spells.find((s) => s.id === spellId)?.casting?.source ?? "")) throw new Error("Usá las elecciones o la preparación de tu clase para este conjuro.");
  if (character.spellcasting.spells.find((s) => s.id === spellId)?.casting?.source === "builder:sorcerer") throw new Error("Sustituí los conocidos de Hechicero desde el tutorial de subida de nivel.");
  if (character.spellcasting.spells.find((s) => s.id === spellId)?.casting?.source === "builder:bard") throw new Error("Sustituí los conocidos de Bardo desde el tutorial de subida de nivel.");
  if (character.spellcasting.spells.find((s) => s.id === spellId)?.casting?.source === "builder:barbarian") throw new Error("Los conjuros de senda forman parte del historial de B\u00e1rbaro.");
  if (character.spellcasting.spells.find((s) => s.id === spellId)?.casting?.source.startsWith("builder:rogue")) throw new Error("Sustitu\u00ed conocidos al subir de nivel; los robados vencen tras ocho horas.");
  if (character.spellcasting.spells.find((s) => s.id === spellId)?.casting?.source.startsWith("builder:ranger")) throw new Error("Usá el tutorial de subida de nivel para sustituir conocidos de Explorador.");
  if (character.spellcasting.spells.find((s) => s.id === spellId)?.casting?.source.startsWith("builder:druid")) throw new Error("Usá la preparación diaria de Druida para administrar su lista.");
  if (character.spellcasting.spells.find((s) => s.id === spellId)?.casting?.kind === "cleric") throw new Error("Usá la preparación diaria de Clérigo para administrar su lista.");
  if (character.spellcasting.spells.find((spell) => spell.id === spellId)?.casting?.source.startsWith("builder:warlock:")) throw new Error("Sustituí conocidos e invocaciones con el tutorial de Brujo al subir de nivel.");
  if (character.spellcasting.spells.find((spell) => spell.id === spellId)?.casting?.kind === "wizard") throw new Error("Los conjuros aprendidos forman parte del historial. Usá los controles de acceso al libro si se perdió.");
  if (!character.spellcasting.spells.some((spell) => spell.id === spellId)) {
    throw new CharacterSpellNotFoundError(spellId);
  }
  return finish(character, {
    ...character.spellcasting,
    spells: character.spellcasting.spells.filter((spell) => spell.id !== spellId),
  }, updatedAt);
}

export function setCharacterSpellPrepared(
  input: CharacterV2,
  spellIdInput: string,
  prepared: boolean,
  options: SpellMutationOptions,
): CharacterV2 {
  const { character, updatedAt } = prepare(input, options);
  if (["builder:monk","builder:paladin"].includes(character.spellcasting.spells.find((s) => s.id === spellIdInput)?.casting?.source ?? "")) throw new Error("Usá las elecciones o la preparación de tu clase para este conjuro.");
  if (character.spellcasting.spells.find((s) => s.id === spellIdInput)?.casting?.source === "builder:sorcerer") throw new Error("Hechicero conoce sus conjuros sin preparación diaria.");
  if (character.spellcasting.spells.find((s) => s.id === spellIdInput)?.casting?.source === "builder:bard") throw new Error("Bardo conoce sus conjuros sin preparación diaria.");
  if (character.spellcasting.spells.find((s) => s.id === spellIdInput)?.casting?.source === "builder:barbarian") throw new Error("Los conjuros de senda no requieren preparaci\u00f3n diaria.");
  if (character.spellcasting.spells.find((s) => s.id === spellIdInput)?.casting?.source.startsWith("builder:rogue")) throw new Error("Brib\u00f3n Arcano conoce sus conjuros sin preparaci\u00f3n diaria.");
  if (character.spellcasting.spells.find((spell) => spell.id === spellIdInput)?.casting?.source.startsWith("builder:warlock:")) throw new Error("Brujo conoce sus conjuros y no requiere preparación diaria.");
  const spellId = StableIdSchema.parse(spellIdInput);
  if (character.spellcasting.spells.find((s) => s.id === spellId)?.casting?.source.startsWith("builder:ranger")) throw new Error("Explorador conoce sus conjuros sin preparación diaria.");
  if (character.spellcasting.spells.find((s) => s.id === spellId)?.casting?.source.startsWith("builder:druid")) throw new Error("Usá la preparación diaria de Druida para administrar su lista.");
  if (character.spellcasting.spells.find((s) => s.id === spellId)?.casting?.kind === "cleric") throw new Error("Usá la preparación diaria de Clérigo para administrar su lista.");
  if (character.spellcasting.spells.find((spell) => spell.id === spellId)?.casting?.kind === "wizard") throw new Error("Prepará la lista de mago de forma conjunta desde el libro, tras descanso largo.");
  if (!character.spellcasting.spells.some((spell) => spell.id === spellId)) {
    throw new CharacterSpellNotFoundError(spellId);
  }
  return finish(character, {
    ...character.spellcasting,
    spells: character.spellcasting.spells.map((spell) =>
      spell.id === spellId ? { ...spell, prepared } : spell,
    ),
  }, updatedAt);
}

export function setCharacterSpellFavorite(
  input: CharacterV2,
  spellNameInput: string,
  favorite: boolean,
  options: SpellMutationOptions,
): CharacterV2 {
  const { character, updatedAt } = prepare(input, options);
  const spellName = spellNameInput.trim();
  if (!spellName) throw new Error("Spell name is required");
  const normalizedName = spellName.toLocaleLowerCase();
  const withoutSpell = character.spellcasting.favoriteSpells.filter(
    (name) => name.toLocaleLowerCase() !== normalizedName,
  );
  const favoriteSpells = favorite
    ? [...withoutSpell, spellName].sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" }))
    : withoutSpell;
  return finish(character, { ...character.spellcasting, favoriteSpells }, updatedAt);
}

export function setSpellSlots(
  input: CharacterV2,
  levelInput: number,
  slotsInput: { maximum: number; used: number },
  options: SpellMutationOptions,
): CharacterV2 {
  const { character, updatedAt } = prepare(input, options);
  const level = SpellLevelSchema.min(1).parse(levelInput);
  const slots = SpellSlotStateSchema.parse(slotsInput);
  const reserved = character.spellcasting.restoredSlots.filter(s => s.sourceLevel === level).length;
  if (slots.used < reserved) throw new Error("Ese espacio ya se recuperó a otro nivel mediante un objeto; completá su descanso para recuperar la reserva original.");
  return finish(character, {
    ...character.spellcasting,
    slots: { ...character.spellcasting.slots, [String(level)]: slots },
  }, updatedAt);
}

export function castCharacterSpell(
  input: CharacterV2,
  spellIdInput: string,
  slotLevelInput: number,
  options: SpellMutationOptions & WizardCastOptions & { concentrationCondition?: CharacterV2["combat"]["conditions"][number] },
): CharacterV2 {
  const { character, updatedAt } = prepare(input, options);
  const spellId = StableIdSchema.parse(spellIdInput);
  const spell = character.spellcasting.spells.find((entry) => entry.id === spellId);
  if (!spell) throw new CharacterSpellNotFoundError(spellId);
  const slotLevel = SpellLevelSchema.parse(slotLevelInput);
  const itemCast = spell.casting?.kind === "item";
  if (itemCast) {
    const state = itemSpellState(character,spell);
    if (!state.available) throw new Error(state.reason);
    if (slotLevel !== spell.casting!.level || slotLevel < spell.level || options.mode && options.mode !== "slot" || options.overchannel || options.recoverSlotLevel) throw new Error("El objeto lanza el conjuro a su nivel indicado, sin espacios ni modos de clase.");
  }
  if (spell.level === 0 && slotLevel !== 0) throw new Error("Un truco se lanza como truco, sin elevarlo con espacios.");
  if (spell.casting?.kind === "at-will" && slotLevel !== spell.level) throw new Error("El lanzamiento a voluntad usa el nivel base, sin espacio.");
  if (spell.casting?.kind === "ritual" && slotLevel !== spell.level) throw new Error("Los conjuros de Lanzador ritual se lanzan como ritual a su nivel base.");
  if (slotLevel < spell.level) {
    throw new SpellSlotUnavailableError(slotLevel);
  }
  const freeWizardCast = (["monk","paladin"].includes(character.builder?.classKey ?? "") ? prepareMartialCast(character,spell,slotLevel,options) : character.builder?.classKey === "sorcerer" ? prepareSorcererCast(character,spell,slotLevel,options) : character.builder?.classKey === "ranger" ? prepareRangerCast(character,spell,slotLevel,options) : character.builder?.classKey === "druid" ? prepareDruidCast(character,spell,slotLevel,options) : character.builder?.classKey === "bard" ? prepareBardCast(character,spell,slotLevel,options) : character.builder?.classKey === "barbarian" ? prepareBarbarianCast(character,spell,slotLevel,options) : character.builder?.classKey === "rogue" ? prepareRogueCast(character,spell,slotLevel,options) : character.builder?.classKey === "cleric" ? prepareClericCast(character,spell,slotLevel,options) : character.builder?.classKey === "warlock" ? prepareWarlockCast(character,spell,slotLevel,options) : prepareWizardCast(character,spell,slotLevel,options)) || spell.casting?.kind === "at-will";
  let slots = character.spellcasting.slots;
  let traits = character.traits;
  if (itemCast) {
    const state = itemSpellState(character,spell);
    character.inventory = useInventoryFeature(character,state.item!.id,state.feature!.id,{ expectedRevision: character.revision,updatedAt }).inventory;
  } else if (spell.casting?.kind === "innate" && spell.level > 0) {
    if (slotLevel !== spell.casting.level || !spell.casting.traitId) throw new SpellSlotUnavailableError(slotLevel);
    const trait = character.traits.flatMap((group) => group.traits).find((entry) => entry.id === spell.casting!.traitId);
    if (!trait || trait.uses.used >= trait.uses.maximum) throw new Error("No quedan usos de este lanzamiento innato o de dote.");
    traits = character.traits.map((group) => ({ ...group, traits: group.traits.map((entry) => entry.id === trait.id ? { ...entry, uses: { ...entry.uses, used: entry.uses.used + 1 } } : entry) }));
  } else if (spell.level > 0 && spell.casting?.kind !== "ritual" && !freeWizardCast) {
    const state = slots[String(slotLevel)] ?? { maximum: 0, used: 0 };
    if (state.used >= state.maximum) {
      if (!spendEquipmentSpellSlot(character, slotLevel)) throw new SpellSlotUnavailableError(slotLevel);
    } else slots = { ...slots, [String(slotLevel)]: { ...state, used: state.used + 1 } };
  }
  const combat = options.concentrationCondition && spell.definition?.concentration
    ? {
        ...character.combat,
        conditions: [
          ...character.combat.conditions.filter((condition) => condition.key !== "concentration"),
          options.concentrationCondition,
        ],
      }
    : character.combat;
  return syncSorcerer(finish({ ...character, traits }, { ...character.spellcasting, slots }, updatedAt, combat));
}

export function resetAllSpellSlots(
  input: CharacterV2,
  options: SpellMutationOptions,
): CharacterV2 {
  const { character, updatedAt } = prepare(input, options);
  resetRestoredEquipmentSlots(character, "long-rest");
  const slots = Object.fromEntries(
    Object.entries(character.spellcasting.slots).map(([level, state]) => [
      level,
      { ...state, used: 0 },
    ]),
  );
  return finish({ ...character, inventory: character.inventory.map((item) => resetEquipmentSlots(item, "long-rest", character)) }, { ...character.spellcasting, slots }, updatedAt);
}

export function setSpellcastingSettings(
  input: CharacterV2,
  settings: Pick<CharacterV2["spellcasting"], "ability" | "selectedLevel" | "showUpcast" | "attackBonus" | "saveDcBonus">,
  options: SpellMutationOptions,
): CharacterV2 {
  const { character, updatedAt } = prepare(input, options);
  return finish(character, {
    ...character.spellcasting,
    ...settings,
  }, updatedAt);
}
