import type { SpellDefinition, CharacterSpellV2 } from "../character/character-spell-model";
import { canonicalJsonStringify, type JsonObject } from "../../shared/json";
import { spellSchoolKey,spellDamageTypeKeys,spellComponentNames } from "./spell-catalog";

/** One visible classification. `old` is a retained character version, never a new choice. */
export const SPELL_SOURCE_TAGS = ["manual_jugador", "xanathar", "custom", "old"] as const;
export type SpellSourceTag = typeof SPELL_SOURCE_TAGS[number];
export function spellSourceTag(spell: Pick<SpellDefinition, "catalog"> | null | undefined): SpellSourceTag | null {
  return SPELL_SOURCE_TAGS.find((tag) => spell?.catalog?.tags.includes(tag)) ?? null;
}
export function spellSourceLabel(tag: string): string {
  return ({ manual_jugador: "Manual del Jugador", xanathar: "Xanathar", custom: "Custom", old: "old" } as Record<string,string>)[tag] ?? tag;
}
export function isOldSpell(spell: Pick<SpellDefinition, "catalog"> | null | undefined): boolean { return spellSourceTag(spell) === "old"; }

/** Catalog identity/favorites do not change the version of the rules a character learned. */
export function spellDefinitionSignature(definition: SpellDefinition): string {
  const { catalog: _catalog, ...rules } = definition;
  // Import adapters translate enum labels; that does not create a different rules version.
  return canonicalJsonStringify({ ...rules,school: spellSchoolKey(rules.school),damageType: spellDamageTypeKeys(rules.damageType).join("/"),components: spellComponentNames(rules.components).join(","),classes: [...rules.classes].sort() } as unknown as JsonObject);
}

const learnedIndexes = new WeakMap<readonly SpellDefinition[], { exact: Map<string,SpellDefinition>; byName: Map<string,SpellDefinition[]> }>();
function learnedIndex(catalog: readonly SpellDefinition[]) {
  let index = learnedIndexes.get(catalog);
  if (!index) {
    index = { exact: new Map(), byName: new Map() };
    for (const entry of catalog) {
      const signature = spellDefinitionSignature(entry);
      if (!index.exact.has(signature) || !isOldSpell(entry)) index.exact.set(signature,entry);
      const key = `${entry.level}:${entry.name}`;
      index.byName.set(key,[...(index.byName.get(key) ?? []),entry]);
    }
    learnedIndexes.set(catalog,index);
  }
  return index;
}

/** Attach provenance to an existing snapshot without replacing its name, text or mechanics. */
export function resolveLearnedSpell(spell: CharacterSpellV2, catalog: readonly SpellDefinition[]): CharacterSpellV2 {
  if (isOldSpell(spell.definition)) return spell;
  const index = learnedIndex(catalog);
  if (spell.definition) {
    const signature = spellDefinitionSignature(spell.definition);
    const exact = index.exact.get(signature);
    if (exact?.catalog) return { ...spell, definition: { ...spell.definition, catalog: exact.catalog } };
    // Custom spells can have a separately preserved character snapshot.
    const custom = index.byName.get(`${spell.level}:${spell.name}`)?.find((entry) => spellSourceTag(entry) === "custom");
    if (custom?.catalog) return { ...spell, definition: { ...spell.definition, catalog: custom.catalog } };
    return spell;
  }
  const candidates = index.byName.get(`${spell.level}:${spell.name}`) ?? [];
  const retained = candidates.find(isOldSpell) ?? candidates.find((entry) => spellSourceTag(entry) === "custom");
  return retained ? { ...spell, definition: retained } : spell;
}
