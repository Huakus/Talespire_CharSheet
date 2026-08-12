import { describe, expect, it } from "vitest";
import {
  CampaignRepositoryConflictError,
  CampaignRepositoryCorruptionError,
} from "../../src/application/ports/campaign-repository";
import { LocalStorageCampaignRepository } from "../../src/infrastructure/persistence/local-storage-campaign-repository";
import { checksumJson } from "../../src/shared/hash";
import { createTestCampaign } from "../fixtures/native-campaign";

class FakeStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

async function campaignFixture() {
  return createTestCampaign({ id: "repository-test" });
}

describe("LocalStorageCampaignRepository", () => {
  it("round-trips a validated campaign envelope", async () => {
    const storage = new FakeStorage();
    const repository = new LocalStorageCampaignRepository(storage, "test-key");
    const saved = await repository.save(await campaignFixture(), { kind: "empty" });

    expect(await repository.load()).toEqual(saved);
    expect(JSON.parse(storage.values.get("test-key") ?? "{}").format).toBe(
      "talespire-toolset-campaign-v2",
    );
  });

  it("detects payload tampering through the checksum", async () => {
    const storage = new FakeStorage();
    const repository = new LocalStorageCampaignRepository(storage, "test-key");
    await repository.save(await campaignFixture(), { kind: "empty" });

    const envelope = JSON.parse(storage.values.get("test-key") ?? "{}");
    envelope.campaign.revision = 99;
    storage.values.set("test-key", JSON.stringify(envelope));

    await expect(repository.load()).rejects.toBeInstanceOf(
      CampaignRepositoryCorruptionError,
    );
  });

  it("does not expose mutable internal campaign references", async () => {
    const storage = new FakeStorage();
    const repository = new LocalStorageCampaignRepository(storage, "test-key");
    const saved = await repository.save(await campaignFixture(), { kind: "empty" });
    saved.campaign.revision = 100;

    expect((await repository.load())?.campaign.revision).toBe(0);
  });

  it("serializes simultaneous compare-and-save operations", async () => {
    const storage = new FakeStorage();
    const repository = new LocalStorageCampaignRepository(storage, "test-key");
    const initial = await repository.save(await campaignFixture(), { kind: "empty" });
    const firstCandidate = { ...initial.campaign, revision: 1 };
    const secondCandidate = { ...initial.campaign, revision: 2 };

    const results = await Promise.allSettled([
      repository.save(firstCandidate, {
        kind: "checksum",
        checksum: initial.checksum,
      }),
      repository.save(secondCandidate, {
        kind: "checksum",
        checksum: initial.checksum,
      }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejection = results.find((result) => result.status === "rejected");
    expect(rejection).toMatchObject({
      status: "rejected",
      reason: expect.any(CampaignRepositoryConflictError),
    });
  });

  it("discards fields that are not part of the current campaign model", async () => {
    const storage = new FakeStorage();
    const repository = new LocalStorageCampaignRepository(storage, "test-key");
    const campaign = await campaignFixture();
    const character = Object.values(campaign.characters)[0]!;
    character.spellcasting.spells = [{
      id: "spell_11111111111111111111111111111111",
      order: 0,
      name: "Prueba",
      level: 1,
      prepared: false,
      definition: null,
      effect: { description: "", active: false },
    }];
    const saved = await repository.save(campaign, { kind: "empty" });
    const envelope = JSON.parse(storage.values.get("test-key") ?? "{}");
    envelope.campaign.characters[character.id].spellcasting.spells[0].source = "unused-value";
    envelope.checksum = await checksumJson(envelope.campaign);
    storage.values.set("test-key", JSON.stringify(envelope));

    expect((await repository.load())?.campaign.characters[character.id]?.spellcasting.spells[0]).toEqual(
      saved.campaign.characters[character.id]?.spellcasting.spells[0],
    );
  });

});
