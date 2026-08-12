import { describe, expect, it } from "vitest";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { createTestCampaign, createTestCharacter } from "../fixtures/native-campaign";

function characterFixture() {
  return createTestCharacter({ configure(character) {
    character.traits = [{
      id: "trait-group-class", order: 0, title: "Class Features", collapsed: false,
      traits: [{
        id: "trait-second-wind", order: 0, name: "Second Wind", description: "Recover hit points.",
        collapsed: false, uses: { maximum: 1, used: 1, reset: "short-rest" },
        adjustment: null, effect: { description: "", active: false },
      }],
    }];
    character.notes = [{
      id: "note-group-clues", order: 0, title: "Clues", collapsed: true,
      notes: [{ id: "note-door", order: 0, title: "Door", content: "Blue sigil", tags: ["dungeon"] }],
    }];
    character.extras = [{
      id: "extra-wolf", order: 0, name: "Wolf",
      hitPoints: { current: 5, maximum: 11, temporary: 3 }, conditions: [], statBlock: {},
    }];
  } });
}

describe("character free-form content", () => {
  it("stores trait uses, notes and extra hit points", () => {
    const character = characterFixture();
    expect(character.traits[0]?.traits[0]).toMatchObject({
      name: "Second Wind",
      uses: { maximum: 1, used: 1, reset: "short-rest" },
    });
    expect(character.notes[0]?.notes[0]).toMatchObject({
      title: "Door",
      content: "Blue sigil",
      tags: ["dungeon"],
    });
    expect(character.extras[0]?.hitPoints).toEqual({ current: 5, maximum: 11, temporary: 3 });
  });

  it("resets short-rest traits and applies extra damage through checked commands", async () => {
    const repository = new InMemoryCampaignRepository();
    const application = new CampaignApplication(repository);
    const character = characterFixture();
    const initial = await repository.save(createTestCampaign({ id: "content-commands", character }), { kind: "empty" });
    const extra = character.extras[0]!;

    const damaged = await application.applyExtraHitPoints({
      characterId: character.id,
      extraId: extra.id,
      action: { kind: "damage", amount: 6 },
      expectedCharacterRevision: character.revision,
      expectedCampaignChecksum: initial.checksum,
      updatedAt: "2026-07-25T20:01:00.000Z",
    });
    const afterDamage = damaged.campaign.characters[character.id]!;
    expect(afterDamage.extras[0]?.hitPoints).toEqual({ current: 2, maximum: 11, temporary: 0 });

    const rested = await application.applyCharacterResource({
      characterId: character.id,
      action: { kind: "short-rest" },
      expectedCharacterRevision: afterDamage.revision,
      expectedCampaignChecksum: damaged.checksum,
      updatedAt: "2026-07-25T20:02:00.000Z",
    });
    expect(rested.snapshot.campaign.characters[character.id]?.traits[0]?.traits[0]?.uses.used).toBe(0);
  });
});
