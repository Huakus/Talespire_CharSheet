import { describe, expect, it } from "vitest";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import {
  projectSpellcasting,
  projectSpellDamageExpression,
} from "../../src/domain/character/character-projection";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import type { CharacterSpellV2 } from "../../src/domain/character/character-spell-model";
import { createTestCampaign, createTestCharacter } from "../fixtures/native-campaign";

function spell(id: string, name: string, level: number, prepared: boolean, damageExpression: string): CharacterSpellV2 {
  return {
    id, order: level, name, level, prepared,
    definition: {
      name, level, description: "", higherLevels: "", range: "", components: "",
      material: "", ritual: false, duration: "", concentration: false,
      castingTime: "", school: "", classes: "", attackType: "none", saveAbility: "",
      damageExpression, upcastDamageExpression: level === 0 ? "1d6" : "", addAbilityModifier: false,
      damageType: "acid", year: "", catalog: null,
    },
    effect: { description: "", active: false },
  };
}

function characterFixture() {
  return createTestCharacter({ name: "Mage", configure(character) {
    character.identity.level = 5;
    character.abilities.intelligence = 18;
    character.spellcasting.ability = "intelligence";
    character.spellcasting.selectedLevel = "3";
    character.spellcasting.showUpcast = true;
    character.spellcasting.slots["1"] = { maximum: 3, used: 1 };
    character.spellcasting.slots["2"] = { maximum: 2, used: 0 };
    character.spellcasting.spells = [
      spell("spell-acid-splash", "Acid Splash", 0, false, "1d6"),
      spell("spell-absorb-elements", "Absorb Elements*", 1, true, ""),
      spell("spell-acid-arrow", "Acid Arrow", 2, true, "4d4"),
    ];
  } });
}

describe("spells", () => {
  it("stores known/prepared spells and slot usage in typed state", () => {
    const character = characterFixture();
    expect(character.spellcasting.showUpcast).toBe(true);
    expect(character.spellcasting.slots["1"]).toEqual({ maximum: 3, used: 1 });
    expect(character.spellcasting.spells).toHaveLength(3);
    expect(character.spellcasting.spells.find((spell) => spell.name === "Acid Arrow")).toMatchObject({
      level: 2,
      prepared: true,
    });
    expect(projectSpellcasting(character)).toEqual({
      ability: "intelligence",
      attackModifier: 7,
      saveDc: 15,
    });
    const cantrip = character.spellcasting.spells.find((spell) => spell.name === "Acid Splash")!;
    expect(projectSpellDamageExpression(character, cantrip)).toBe("2d6");
  });

  it("casts with an upcast slot, tracks concentration and resets slots on long rest", async () => {
    const repository = new InMemoryCampaignRepository();
    const application = new CampaignApplication(repository);
    const character = characterFixture();
    const initial = await repository.save(createTestCampaign({ id: "spell-commands", character }), { kind: "empty" });
    const absorb = character.spellcasting.spells.find((spell) => spell.name === "Absorb Elements*")!;

    const cast = await application.castCharacterSpell({
      characterId: character.id,
      spellId: absorb.id,
      slotLevel: 2,
      expectedCharacterRevision: character.revision,
      expectedCampaignChecksum: initial.checksum,
      updatedAt: "2026-07-25T19:01:00.000Z",
    });
    const afterCast = cast.campaign.characters[character.id]!;
    expect(afterCast.spellcasting.slots["2"]?.used).toBe(1);

    const rested = await application.applyCharacterResource({
      characterId: character.id,
      expectedCharacterRevision: afterCast.revision,
      expectedCampaignChecksum: cast.checksum,
      action: { kind: "long-rest" },
      updatedAt: "2026-07-25T19:02:00.000Z",
    });
    expect(rested.snapshot.campaign.characters[character.id]?.spellcasting.slots["1"]?.used).toBe(0);
    expect(rested.snapshot.campaign.characters[character.id]?.spellcasting.slots["2"]?.used).toBe(0);
    expect(rested.effects.deferredResets).toEqual([]);
  });

  it("persists favorites independently from the known spell list", async () => {
    const repository = new InMemoryCampaignRepository();
    const application = new CampaignApplication(repository);
    const character = characterFixture();
    const initial = await repository.save(createTestCampaign({ id: "spell-favorites", character }), { kind: "empty" });

    const favorite = await application.setCharacterSpellFavorite({
      characterId: character.id,
      spellName: "Un conjuro todavía desconocido",
      favorite: true,
      expectedCharacterRevision: character.revision,
      expectedCampaignChecksum: initial.checksum,
      updatedAt: "2026-07-25T19:03:00.000Z",
    });
    const updated = favorite.campaign.characters[character.id]!;

    expect(updated.spellcasting.favoriteSpells).toEqual(["Un conjuro todavía desconocido"]);
    expect(updated.spellcasting.spells).toHaveLength(character.spellcasting.spells.length);
  });
});
