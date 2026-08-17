import { describe, expect, it } from "vitest";
import {
  assembleCampaign,
  diffCampaignFragments,
  fragmentCampaign,
  type RemoteCampaignFragmentState,
} from "../../src/infrastructure/remote/campaign-fragments";
import { createTestCampaign, createTestCharacter } from "../fixtures/native-campaign";

function remoteState(campaign: ReturnType<typeof createTestCampaign>): RemoteCampaignFragmentState {
  return {
    campaignRevision: campaign.revision,
    campaignUpdatedAt: campaign.metadata.updatedAt,
    updatedBy: null,
    characters: Object.values(campaign.characters).map((character) => ({
      characterId: character.id,
      revision: character.revision,
      createdAt: character.metadata.createdAt,
      updatedAt: character.metadata.updatedAt,
    })),
    fragments: fragmentCampaign(campaign).map((fragment) => ({ ...fragment, revision: 0 })),
  };
}

describe("granular campaign fragments", () => {
  it("round-trips campaign, character and ordered GM state", () => {
    const campaign = createTestCampaign({
      character: createTestCharacter({ configure(character) {
        character.spellcasting.favoriteSpells = ["Escudo"];
        character.combat.hitPoints.current = 7;
      } }),
    });
    campaign.gm = {
      googleDocsUrl: "https://docs.google.com/document/d/example/edit",
      miniatureAssociations: {
        "creature-goblin": {
          displayName: "Goblin",
          boardAssetId: "asset-goblin",
          monster: { definitionId: "goblin", name: "Goblin", armorClass: 15, hitPoints: 7 },
          characterId: null,
          updatedAt: "2026-07-25T12:00:00.000Z",
        },
      },
      noteGroups: [
        { id: "gmg_22222222222222222222222222222222", title: "Segundo", notes: [] },
        { id: "gmg_11111111111111111111111111111111", title: "Primero", notes: [] },
      ],
      randomTables: [{ id: "gmt_33333333333333333333333333333333", name: "Clima", entries: ["Sol"] }],
    };

    expect(assembleCampaign(remoteState(campaign))).toEqual(campaign);
  });

  it("writes only the runtime fragment for hit point changes", () => {
    const campaign = createTestCampaign();
    const state = remoteState(campaign);
    const characterId = Object.keys(campaign.characters)[0]!;
    const after = structuredClone(campaign);
    after.revision += 1;
    after.metadata.updatedAt = "2026-07-25T12:01:00.000Z";
    after.characters[characterId]!.revision += 1;
    after.characters[characterId]!.metadata.updatedAt = after.metadata.updatedAt;
    after.characters[characterId]!.combat.hitPoints.current -= 1;

    const diff = diffCampaignFragments(campaign, after, state.fragments);

    expect(diff.changes).toHaveLength(1);
    expect(diff.changes[0]).toMatchObject({
      kind: "character-runtime",
      parentId: characterId,
      operation: "upsert",
      expectedRevision: 0,
    });
    expect(diff.characterChanges).toEqual([{
      characterId,
      operation: "touch",
      updatedAt: after.characters[characterId]!.metadata.updatedAt,
    }]);
  });

  it("keeps independent character and GM changes in independent rows", () => {
    const campaign = createTestCampaign();
    const state = remoteState(campaign);
    const characterId = Object.keys(campaign.characters)[0]!;
    const after = structuredClone(campaign);
    after.characters[characterId]!.name = "Otro nombre";
    after.gm.noteGroups.push({
      id: "gmg_44444444444444444444444444444444",
      title: "Pistas",
      notes: [],
    });

    const diff = diffCampaignFragments(campaign, after, state.fragments);

    expect(diff.changes.map((change) => change.kind)).toEqual([
      "character-core",
      "gm-note-group",
    ]);
    expect(diff.characterChanges).toEqual([{
      characterId,
      operation: "touch",
      updatedAt: after.characters[characterId]!.metadata.updatedAt,
    }]);
  });
});
