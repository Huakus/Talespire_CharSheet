import { describe, expect, it } from "vitest";
import { CharacterV2Schema } from "../../src/domain/character/character-v2";
import {
  projectActionAttackModifier,
  projectCharacterStatistics,
  projectInventory,
  projectSpellcasting,
} from "../../src/domain/character/character-projection";
import { assembleCampaign, fragmentCampaign } from "../../src/infrastructure/remote/campaign-fragments";
import { createDeterministicId } from "../../src/shared/id";
import { createExpeditionCharacters } from "../../scripts/character-seeding/expedition-characters";

const createdAt = "2026-08-17T01:20:00.000Z";

describe("expedition character seed", () => {
  it("builds three complete and schema-valid characters", async () => {
    const { characters } = await createExpeditionCharacters(createdAt);
    expect(characters.map((character) => character.name)).toEqual([
      "Edrick Voss",
      "Draven Korr",
      "Maelion Vaelaris",
    ]);
    for (const character of characters) {
      expect(() => CharacterV2Schema.parse(character)).not.toThrow();
      expect(character.actions.length).toBeGreaterThanOrEqual(3);
      expect(character.inventory.length).toBeGreaterThanOrEqual(20);
      expect(character.traits.flatMap((group) => group.traits).length).toBeGreaterThanOrEqual(13);
      expect(character.notes.length).toBeGreaterThan(0);
    }
  });

  it("projects Edrick's corrected ranger totals", async () => {
    const { characters } = await createExpeditionCharacters(createdAt);
    const edrick = characters.find((character) => character.name === "Edrick Voss")!;
    const statistics = projectCharacterStatistics(edrick);
    expect(projectInventory(edrick).calculatedArmorClass).toBe(18);
    expect(statistics.skills.stealth).toBe(8);
    expect(statistics.skills.perception).toBe(6);
    expect(statistics.skills.survival).toBe(6);
    expect(projectSpellcasting(edrick)).toMatchObject({ attackModifier: 6, saveDc: 14 });
    const bow = edrick.actions.find((action) => action.name.startsWith("Vigía Invernal ("))!;
    expect(projectActionAttackModifier(edrick, bow)).toBe(12);
    expect(bow.damageBonus).toBe(7);
  });

  it("projects Draven's legal level-seven loadout", async () => {
    const { characters } = await createExpeditionCharacters(createdAt);
    const draven = characters.find((character) => character.name === "Draven Korr")!;
    const statistics = projectCharacterStatistics(draven);
    expect(projectInventory(draven).calculatedArmorClass).toBe(20);
    expect(statistics.skills.arcana).toBe(8);
    expect(statistics.skills.investigation).toBe(8);
    expect(projectSpellcasting(draven)).toMatchObject({ attackModifier: 8, saveDc: 16 });
    const launcher = draven.actions.find((action) => action.name === "Lanzarrayos mejorado")!;
    const pistol = draven.actions.find((action) => action.name.startsWith("Pistola repetidora"))!;
    expect(projectActionAttackModifier(draven, launcher)).toBe(9);
    expect(projectActionAttackModifier(draven, pistol)).toBe(6);
    expect(pistol.damageBonus).toBe(3);
  });

  it("projects Maelion's corrected bard and drow totals", async () => {
    const { characters } = await createExpeditionCharacters(createdAt);
    const maelion = characters.find((character) => character.name === "Maelion Vaelaris")!;
    const statistics = projectCharacterStatistics(maelion);
    expect(projectInventory(maelion).calculatedArmorClass).toBe(16);
    expect(statistics.skills.history).toBe(8);
    expect(statistics.skills.investigation).toBe(8);
    expect(statistics.skills.arcana).toBe(5);
    expect(statistics.skills.persuasion).toBe(8);
    expect(projectSpellcasting(maelion)).toMatchObject({ attackModifier: 8, saveDc: 16 });
    expect(maelion.spellcasting.spells.filter((spell) => spell.level === 0)).toHaveLength(4);
    expect(maelion.spellcasting.spells.filter((spell) => spell.name === "Puerta dimensional")).toHaveLength(1);
  });

  it("round-trips all generated fragments through the granular assembler", async () => {
    const { characters } = await createExpeditionCharacters(createdAt);
    const campaignId = await createDeterministicId("cmp", "expedition-seed-test");
    const campaign = {
      schemaVersion: 2 as const,
      id: campaignId,
      revision: 0,
      characters: Object.fromEntries(characters.map((character) => [character.id, character])),
      encounters: {},
      gm: { noteGroups: [], randomTables: [], googleDocsUrl: "" },
      metadata: { createdAt, updatedAt: createdAt },
    };
    const fragments = fragmentCampaign(campaign).map((fragment) => ({ ...fragment, revision: 0 }));
    const assembled = assembleCampaign({
      campaignRevision: 0,
      campaignUpdatedAt: createdAt,
      updatedBy: null,
      characters: characters.map((character) => ({
        characterId: character.id,
        revision: 0,
        createdAt,
        updatedAt: createdAt,
      })),
      fragments,
    });
    expect(Object.values(assembled.characters).map((character) => character.name)).toEqual([
      "Edrick Voss",
      "Draven Korr",
      "Maelion Vaelaris",
    ]);
  });
});
