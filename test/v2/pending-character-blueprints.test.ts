import { describe, expect, it } from "vitest";
import {
  pendingCharacterBlueprints,
  type AbilityKey,
} from "../fixtures/pending-character-blueprints";

const abilityModifier = (score: number): number => Math.floor((score - 10) / 2);

describe("pending character blueprints", () => {
  it("stages exactly the three requested characters without persistence identities", () => {
    expect(pendingCharacterBlueprints.map((character) => character.name)).toEqual([
      "Edrick Voss",
      "Draven Korr",
      "Maelion Vaelaris",
    ]);

    for (const character of pendingCharacterBlueprints) {
      expect(character.status).toBe("pending");
      expect(character).not.toHaveProperty("id");
      expect(character).not.toHaveProperty("campaignId");
      expect(character).not.toHaveProperty("revision");
      expect(character.source.documentId).toBe("1Zf5oPNgrkZHU0RJJ4Zdwc7uLc_Gg37vOHNOMbV2VBa8");
    }
  });

  it("contains every section required to assemble a complete CharacterV2 later", () => {
    for (const character of pendingCharacterBlueprints) {
      expect(Object.keys(character.abilities)).toHaveLength(6);
      expect(character.identity.level).toBe(7);
      expect(character.identity.experience).toBe(23000);
      expect(character.savingThrows).toHaveLength(2);
      expect(Object.keys(character.skills).length).toBeGreaterThanOrEqual(5);
      expect(character.actions.length).toBeGreaterThan(0);
      expect(Object.keys(character.traitGroups).length).toBeGreaterThan(0);
      expect(character.spellcasting.spells.length).toBeGreaterThan(0);
      expect(character.inventory.length).toBeGreaterThan(0);
      expect(character.notes.length).toBeGreaterThan(0);
      expect(character.corrections.length).toBeGreaterThan(0);
      expect(character.decisions.every((decision) => decision.recommendation && decision.reason)).toBe(true);
    }
  });

  it("keeps derived skill and spellcasting numbers internally consistent", () => {
    for (const character of pendingCharacterBlueprints) {
      for (const skill of Object.values(character.skills)) {
        const skillAbility = skill.ability as AbilityKey;
        const expected = abilityModifier(character.abilities[skillAbility])
          + character.combat.proficiencyBonus * skill.proficiency;
        expect(skill.expectedBonus, `${character.name}: ${skill.ability}`).toBe(expected);
      }

      const castingModifier = abilityModifier(
        character.abilities[character.combat.spellcastingAbility as AbilityKey],
      );
      expect(character.combat.spellSaveDc).toBe(8 + character.combat.proficiencyBonus + castingModifier);
      expect(character.combat.spellAttackBonus).toBe(character.combat.proficiencyBonus + castingModifier);
    }
  });

  it("honors each level-seven spell limit while keeping racial and subclass grants separate", () => {
    for (const character of pendingCharacterBlueprints) {
      const classCantrips = character.spellcasting.spells.filter(
        (spell) => spell.origin === "class" && spell.level === 0,
      );
      const ordinarySpells = character.spellcasting.spells.filter(
        (spell) => spell.origin === "class" && spell.level > 0,
      );
      expect(classCantrips, `${character.name}: class cantrips`).toHaveLength(
        character.spellcasting.classCantripLimit,
      );
      expect(ordinarySpells, `${character.name}: ordinary spells`).toHaveLength(
        character.spellcasting.ordinarySpellLimit,
      );
    }
  });

  it("makes every unresolved catalog dependency explicit", () => {
    const missingCatalogEntries = pendingCharacterBlueprints.flatMap((character) => [
      ...character.spellcasting.spells
        .filter((spell) => spell.catalogKey === null)
        .map((spell) => `${character.name}: ${spell.name}`),
      ...character.inventory
        .filter((entry) => entry.catalogKey === null)
        .map((entry) => `${character.name}: ${entry.name}`),
    ]);

    expect(missingCatalogEntries).toContain("Edrick Voss: Cordón de flechas");
    expect(missingCatalogEntries).toContain("Draven Korr: Armadura de campo Korr");
    expect(missingCatalogEntries).toContain("Maelion Vaelaris: Laúd de los Ecos Profundos (Laúd de Doss)");
    expect(
      pendingCharacterBlueprints.every((character) =>
        character.decisions.some((decision) => decision.field.startsWith("catalog.")),
      ),
    ).toBe(true);
  });
});
