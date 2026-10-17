import { describe, expect, it, vi } from "vitest";
import { CampaignRepositoryCorruptionError } from "../../src/application/ports/campaign-repository";
import { createCampaignSnapshot } from "../../src/infrastructure/persistence/campaign-snapshot";
import {
  fragmentCampaign,
  type CampaignFragmentChange,
  type CharacterVersionChange,
  type RemoteCampaignFragmentState,
} from "../../src/infrastructure/remote/campaign-fragments";
import type { SupabaseCampaignFragmentClient } from "../../src/infrastructure/remote/supabase-campaign-fragment-client";
import { SupabaseGranularCampaignRepository } from "../../src/infrastructure/remote/supabase-granular-campaign-repository";
import { createTestCampaign } from "../fixtures/native-campaign";

function stateFixture(): RemoteCampaignFragmentState {
  const campaign = createTestCampaign();
  const character = Object.values(campaign.characters)[0]!;
  return {
    campaignRevision: campaign.revision,
    campaignUpdatedAt: campaign.metadata.updatedAt,
    updatedBy: null,
    characters: [{
      characterId: character.id,
      revision: character.revision,
      createdAt: character.metadata.createdAt,
      updatedAt: character.metadata.updatedAt,
    }],
    fragments: fragmentCampaign(campaign).map((fragment) => ({ ...fragment, revision: 0 })),
  };
}

describe("SupabaseGranularCampaignRepository", () => {
  it("reports the failing character and field without saving or accepting invalid state", async () => {
    const state = stateFixture();
    const runtime = state.fragments.find((fragment) => fragment.kind === "character-runtime")!;
    (runtime.payload.combat as { hitPoints: { current: unknown } }).hitPoints.current = "invalid";
    const saveCampaign = vi.fn();
    const repository = new SupabaseGranularCampaignRepository({
      readCampaign: async () => state,
      saveCampaign,
    } as unknown as SupabaseCampaignFragmentClient, "campaign");

    const error = await repository.load().catch((error: unknown) => error);
    expect(error).toBeInstanceOf(CampaignRepositoryCorruptionError);
    expect((error as Error).message).toContain("Hero");
    expect((error as Error).message).toContain("combat.hitPoints.current");
    expect((error as Error).cause).toBeInstanceOf(Error);
    expect(repository.remoteRevision).toBe(-1);
    expect(saveCampaign).not.toHaveBeenCalled();
  });

  it("preserves the missing-fragment cause", async () => {
    const state = stateFixture();
    state.fragments = state.fragments.filter((fragment) => fragment.kind !== "character-runtime");
    const repository = new SupabaseGranularCampaignRepository({
      readCampaign: async () => state,
    } as unknown as SupabaseCampaignFragmentClient, "campaign");
    await expect(repository.load()).rejects.toThrow("missing a required fragment");
  });

  it("saves a hit point change as one small fragment transaction", async () => {
    const state = stateFixture();
    const saves: { changes: CampaignFragmentChange[]; characters: CharacterVersionChange[] }[] = [];
    const serverTime = "2026-07-25T13:00:00.000Z";
    const client = {
      readCampaign: async () => structuredClone(state),
      saveCampaign: async (
        _campaignId: string,
        expectedCampaignRevision: number,
        _campaignUpdatedAt: string,
        changes: CampaignFragmentChange[],
        characters: CharacterVersionChange[],
      ) => {
        saves.push({ changes, characters });
        return {
          previousCampaignRevision: expectedCampaignRevision,
          campaignRevision: expectedCampaignRevision + 1,
          campaignUpdatedAt: serverTime,
          updatedBy: "00000000-0000-4000-8000-000000000001",
          characters: state.characters.map((character) => ({
            ...character,
            revision: character.revision + 1,
            updatedAt: serverTime,
          })),
          fragments: changes.map((change) => ({
            kind: change.kind,
            parentId: change.parentId,
            entityId: change.entityId,
            revision: change.expectedRevision === null ? 0 : change.expectedRevision + 1,
            deleted: change.operation === "delete",
          })),
        };
      },
    } as unknown as SupabaseCampaignFragmentClient;
    const repository = new SupabaseGranularCampaignRepository(client, "00000000-0000-4000-8000-000000000010");
    const initial = (await repository.load())!;
    const characterId = Object.keys(initial.campaign.characters)[0]!;
    const candidate = structuredClone(initial.campaign);
    candidate.revision += 1;
    candidate.metadata.updatedAt = serverTime;
    candidate.characters[characterId]!.revision += 1;
    candidate.characters[characterId]!.metadata.updatedAt = serverTime;
    candidate.characters[characterId]!.combat.hitPoints.current -= 3;

    const saved = await repository.save(candidate, { kind: "checksum", checksum: initial.checksum });

    expect(saves).toHaveLength(1);
    expect(saves[0]!.changes).toHaveLength(1);
    expect(saves[0]!.changes[0]).toMatchObject({ kind: "character-runtime", operation: "upsert" });
    expect(saved.campaign.characters[characterId]!.combat.hitPoints.current).toBe(
      initial.campaign.characters[characterId]!.combat.hitPoints.current - 3,
    );
    expect(saved.campaign.revision).toBe(1);
    expect(saved.campaign.characters[characterId]!.revision).toBe(1);
  });

  it("does not contact the server for a semantic no-op", async () => {
    const state = stateFixture();
    let saves = 0;
    const client = {
      readCampaign: async () => structuredClone(state),
      saveCampaign: async () => { saves += 1; throw new Error("unexpected save"); },
    } as unknown as SupabaseCampaignFragmentClient;
    const repository = new SupabaseGranularCampaignRepository(client, "00000000-0000-4000-8000-000000000010");
    const initial = (await repository.load())!;
    const candidate = structuredClone(initial.campaign);
    candidate.revision += 1;
    candidate.metadata.updatedAt = "2026-07-25T13:00:00.000Z";
    const character = Object.values(candidate.characters)[0]!;
    character.revision += 1;
    character.metadata.updatedAt = candidate.metadata.updatedAt;

    const saved = await repository.save(candidate, { kind: "checksum", checksum: initial.checksum });

    expect(saves).toBe(0);
    expect(saved).toEqual(await createCampaignSnapshot(initial.campaign));
  });
});
