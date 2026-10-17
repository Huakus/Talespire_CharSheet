import type { CharacterSpellV2, SpellcastingAbility } from "../domain/character/character-spell-model";
import type { CharacterV2 } from "../domain/character/character-v2";
import { projectSpellcasting } from "../domain/character/character-projection";

export const SPELL_ABILITY_LABELS: Record<SpellcastingAbility, string> = {
  strength: "FUE", dexterity: "DES", constitution: "CON", intelligence: "INT", wisdom: "WIS", charisma: "CAR",
};
export const SPELL_PREPARATION_LABELS = {
  prepared: "PREP", unprepared: "NO PREP", unnecessary: "Sin preparación", catalog: "No aprendido",
} as const;
export type SpellPersonalFacet = "learning" | "availability" | "ability";

export function spellLearningOrigin(spell: CharacterSpellV2): { key: string; label: string } {
  const casting = spell.casting, source = casting?.source ?? "";
  if (!casting) return { key: "unrecorded", label: "Sin origen registrado" };
  if (casting.kind === "item") return { key: "item", label: "Objeto mágico" };
  if (source === "builder:race") return { key: "race", label: "Magia racial" };
  if (source === "builder:druid-moon") return { key: "druid", label: "Druida" };
  if (source === "builder:ranger-ethereal") return { key: "ranger", label: "Explorador" };
  if (source.startsWith("builder:feat-") || source.startsWith("builder:warlock:feat-")) return { key: "feat", label: "Dote" };
  if (source.startsWith("builder:warlock:")) {
    if (source.endsWith(":arcanum")) return { key: "arcanum", label: "Arcano místico" };
    if (source.includes(":invocation-") || source.endsWith(":ritual")) return { key: "invocation", label: "Invocación" };
    return { key: "warlock", label: "Magia de pacto" };
  }
  const classes: Record<string, string> = {
    wizard: "Libro de mago", cleric: "Clérigo", druid: "Druida", paladin: "Paladín", bard: "Bardo",
    sorcerer: "Hechicero", ranger: "Explorador", monk: "Conjuro de ki", barbarian: "Conjuro de senda",
    "eldritch-knight": "Caballero Arcano", rogue: "Tramposo Arcano", "rogue-stolen": "Conjuro robado",
    "xanathar-archetype": "Arquetipo de guerrero",
  };
  const classKey = source.replace(/^builder:/, "");
  if (classes[classKey]) return { key: classKey, label: classes[classKey] };
  if (["wizard", "cleric", "druid"].includes(casting.kind)) return { key: casting.kind, label: classes[casting.kind]! };
  return { key: "other", label: "Otro origen" };
}

/** Personal facets never infer a learning origin or a casting ability for unlearned catalog spells. */
export function spellPersonalInfo(character: CharacterV2, spell: CharacterSpellV2, known = true) {
  if (!known) return { learning: "catalog", learningLabel: "No aprendido", preparation: "catalog" as const, ability: "unassigned" };
  const copy = spell.casting?.kind === "wizard" ? character.spellcasting.wizard?.copied.find((entry) => entry.key === spell.casting!.key && entry.source === "external") : null;
  const origin = copy ? { key: "external-book", label: "Libro ajeno" } : spellLearningOrigin(spell);
  const casting = spell.casting;
  const requiresPreparation = spell.level > 0 && (!casting || ["wizard", "cleric", "druid"].includes(casting.kind) || casting.source === "builder:paladin");
  return {
    learning: origin.key, learningLabel: origin.label,
    preparation: requiresPreparation ? spell.prepared ? "prepared" as const : "unprepared" as const : "unnecessary" as const,
    ability: casting?.ability ?? projectSpellcasting(character).ability ?? "unassigned",
  };
}
