import type { CharacterV2 } from "../domain/character/character-v2";
import type { CharacterSpellV2,SpellDefinition } from "../domain/character/character-spell-model";
import { PHB_SPELLS } from "../domain/character/phb-spells";
import srd from "../domain/character/phb-srd-spells.json";
import translations from "../domain/character/spells-es-2014.json";
import { isOldSpell, resolveLearnedSpell, spellSourceTag } from "../domain/spells/spell-source";
const englishKeys = new Map(srd.map((s) => [s.name.toLowerCase(),s.key]));
for (const [key,translation] of Object.entries(translations)) englishKeys.set(translation.englishName.toLowerCase(),key);
export function localizedSpellDefinition(definition: SpellDefinition): SpellDefinition {
  if (definition.catalog?.origin === "gm" || isOldSpell(definition) || spellSourceTag(definition) === "custom") return definition;
  const key = englishKeys.get(definition.name.toLowerCase());
  return key ? PHB_SPELLS[key] ?? definition : definition;
}
export function localizedManagedSpell(spell: CharacterSpellV2): CharacterSpellV2 {
  if (isOldSpell(spell.definition)) return spell;
  const definition = spell.casting?.source.startsWith("builder:") ? PHB_SPELLS[spell.casting.key] : null;
  return definition ? { ...spell,name: definition.name,definition: { ...definition,...(spell.casting?.kind === "cleric" && spell.casting.key === "spare-the-dying" ? { range: spell.definition?.range ?? definition.range,castingTime: spell.definition?.castingTime ?? definition.castingTime } : {}) } } : spell;
}
/** Presentation only: preserve stored campaign data and its checksum. */
export function localizedCharacter(character: CharacterV2, catalog: readonly SpellDefinition[] = []): CharacterV2 { return { ...character,spellcasting: { ...character.spellcasting,spells: character.spellcasting.spells.map((spell) => localizedManagedSpell(resolveLearnedSpell(spell,catalog))) } }; }
