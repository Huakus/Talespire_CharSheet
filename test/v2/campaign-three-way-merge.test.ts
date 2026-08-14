import { describe, expect, it } from "vitest";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import type { CampaignSnapshot } from "../../src/application/ports/campaign-repository";
import type { CampaignV2, CharacterV2 } from "../../src/domain/character/character-v2";
import { mergeCampaignChanges } from "../../src/infrastructure/remote/campaign-three-way-merge";
import {
  createCampaignSnapshot,
  decodeCampaignEnvelope,
  encodeCampaignEnvelope,
} from "../../src/infrastructure/persistence/campaign-snapshot";
import {
  RemoteCampaignRevisionConflictError,
  type RemoteCampaignDocument,
  type SupabaseCampaignDocumentClient,
} from "../../src/infrastructure/remote/supabase-campaign-document-client";
import { SupabaseCampaignRepository } from "../../src/infrastructure/remote/supabase-campaign-repository";
import { createTestCampaign, createTestCharacter } from "../fixtures/native-campaign";

const baseTime = "2026-08-07T12:00:00.000Z";
const localTime = "2026-08-07T12:01:00.000Z";
const remoteTime = "2026-08-07T12:02:00.000Z";

async function fixture(): Promise<{ campaign: CampaignV2; adler: CharacterV2; delerion: CharacterV2 }> {
  const adler = createTestCharacter({ id: "character-adler", name: "Adler", createdAt: baseTime });
  const delerion = createTestCharacter({ id: "character-delerion", name: "Delerion", createdAt: baseTime });
  const campaign = createTestCampaign({ id: "granular-merge", createdAt: baseTime, character: adler });
  campaign.characters[delerion.id] = delerion;
  return { campaign, adler, delerion };
}

function updateCharacter(
  campaign: CampaignV2,
  character: CharacterV2,
  patch: Partial<CharacterV2>,
  updatedAt: string,
): CampaignV2 {
  return {
    ...structuredClone(campaign),
    revision: campaign.revision + 1,
    characters: {
      ...structuredClone(campaign.characters),
      [character.id]: {
        ...structuredClone(character),
        ...patch,
        revision: character.revision + 1,
        metadata: { ...character.metadata, updatedAt },
      },
    },
    metadata: { ...campaign.metadata, updatedAt },
  };
}

class FakeRemoteCampaignStore {
  private revision = 0;
  private payload: Record<string, unknown>;

  constructor(campaign: CampaignV2) {
    this.payload = {};
    void createCampaignSnapshot(campaign).then((snapshot) => {
      this.payload = JSON.parse(encodeCampaignEnvelope(snapshot)) as Record<string, unknown>;
    });
  }

  async initialize(campaign: CampaignV2): Promise<void> {
    const snapshot = await createCampaignSnapshot(campaign);
    this.payload = JSON.parse(encodeCampaignEnvelope(snapshot)) as Record<string, unknown>;
  }

  async readCampaign(campaignId: string): Promise<RemoteCampaignDocument> {
    return {
      campaignId,
      revision: this.revision,
      payload: structuredClone(this.payload),
      updatedBy: null,
      updatedAt: remoteTime,
    };
  }

  async saveCampaign(
    campaignId: string,
    expectedRevision: number,
    payload: Record<string, unknown>,
  ): Promise<RemoteCampaignDocument> {
    if (expectedRevision !== this.revision) {
      throw new RemoteCampaignRevisionConflictError(expectedRevision, `current=${this.revision}`);
    }
    this.revision += 1;
    this.payload = structuredClone(payload);
    return this.readCampaign(campaignId);
  }

  async snapshot(): Promise<CampaignV2> {
    return (await decodeCampaignEnvelope(JSON.stringify(this.payload))).campaign;
  }
}

async function applicationsFor(campaign: CampaignV2): Promise<{
  first: CampaignApplication;
  second: CampaignApplication;
  store: FakeRemoteCampaignStore;
}> {
  const store = new FakeRemoteCampaignStore(campaign);
  await store.initialize(campaign);
  const client = store as unknown as SupabaseCampaignDocumentClient;
  return {
    first: new CampaignApplication(new SupabaseCampaignRepository(client, "campaign-id")),
    second: new CampaignApplication(new SupabaseCampaignRepository(client, "campaign-id")),
    store,
  };
}

describe("campaign three-way merge", () => {
  it("accepts realtime snapshots atomically and ignores an older revision that finishes later", async () => {
    const { campaign, adler } = await fixture();
    const older = await createCampaignSnapshot(campaign);
    const newer = await createCampaignSnapshot(updateCharacter(
      campaign,
      adler,
      { name: "Adler remoto" },
      remoteTime,
    ));
    const reportedRevisions: number[] = [];
    const repository = new SupabaseCampaignRepository(
      {} as SupabaseCampaignDocumentClient,
      "campaign-id",
      (revision) => reportedRevisions.push(revision),
    );
    const document = (snapshot: CampaignSnapshot, revision: number): RemoteCampaignDocument => ({
      campaignId: "campaign-id",
      revision,
      payload: JSON.parse(encodeCampaignEnvelope(snapshot)) as Record<string, unknown>,
      updatedBy: null,
      updatedAt: remoteTime,
    });

    await repository.acceptRemoteDocument(document(newer, 2));
    await repository.acceptRemoteDocument(document(older, 1));

    expect(reportedRevisions).toEqual([2]);
    await expect(repository.loadVersion(newer.checksum)).resolves.toMatchObject({ checksum: newer.checksum });
  });

  it("combines concurrent edits to Adler and Delerion", async () => {
    const { campaign, adler, delerion } = await fixture();
    const local = updateCharacter(campaign, adler, { name: "Adler local" }, localTime);
    const remote = updateCharacter(campaign, delerion, { name: "Delerion remoto" }, remoteTime);

    const result = mergeCampaignChanges(campaign, local, remote);

    expect(result.conflictPaths).toEqual([]);
    expect(result.campaign?.characters[adler.id]?.name).toBe("Adler local");
    expect(result.campaign?.characters[delerion.id]?.name).toBe("Delerion remoto");
    expect(result.campaign?.revision).toBe(2);
  });

  it("combines different fields of the same character", async () => {
    const { campaign, adler } = await fixture();
    const local = updateCharacter(campaign, adler, { name: "Adler local" }, localTime);
    const remote = updateCharacter(campaign, adler, { color: "#123456" }, remoteTime);

    const result = mergeCampaignChanges(campaign, local, remote);

    expect(result.conflictPaths).toEqual([]);
    expect(result.campaign?.characters[adler.id]).toMatchObject({
      name: "Adler local",
      color: "#123456",
      revision: 2,
    });
  });

  it("reports only the exact field changed differently by both clients", async () => {
    const { campaign, adler } = await fixture();
    const local = updateCharacter(campaign, adler, { name: "Adler local" }, localTime);
    const remote = updateCharacter(campaign, adler, { name: "Adler remoto" }, remoteTime);

    const result = mergeCampaignChanges(campaign, local, remote);

    expect(result.campaign).toBeNull();
    expect(result.conflictPaths).toEqual([`characters.${adler.id}.name`]);
  });

  it("merges the real application saves from two stale clients", async () => {
    const { campaign, adler, delerion } = await fixture();
    const { first, second, store } = await applicationsFor(campaign);
    const firstBase = await first.loadCampaign();
    const secondBase = await second.loadCampaign();
    if (!firstBase || !secondBase) throw new Error("Campaign was not loaded");

    await first.editCharacter({
      characterId: adler.id,
      expectedCharacterRevision: adler.revision,
      expectedCampaignChecksum: firstBase.checksum,
      patch: { name: "Adler editado" },
      updatedAt: localTime,
    });
    const merged = await second.editCharacter({
      characterId: delerion.id,
      expectedCharacterRevision: delerion.revision,
      expectedCampaignChecksum: secondBase.checksum,
      patch: { name: "Delerion editado" },
      updatedAt: remoteTime,
    });

    expect(merged.campaign.characters[adler.id]?.name).toBe("Adler editado");
    expect(merged.campaign.characters[delerion.id]?.name).toBe("Delerion editado");
    await expect(store.snapshot()).resolves.toEqual(merged.campaign);
  });

  it("blocks two stale clients only when they write different values to the same field", async () => {
    const { campaign, adler } = await fixture();
    const { first, second } = await applicationsFor(campaign);
    const firstBase = await first.loadCampaign();
    const secondBase = await second.loadCampaign();
    if (!firstBase || !secondBase) throw new Error("Campaign was not loaded");

    await first.editCharacter({
      characterId: adler.id,
      expectedCharacterRevision: adler.revision,
      expectedCampaignChecksum: firstBase.checksum,
      patch: { name: "Nombre de Roberto" },
      updatedAt: localTime,
    });
    await expect(second.editCharacter({
      characterId: adler.id,
      expectedCharacterRevision: adler.revision,
      expectedCampaignChecksum: secondBase.checksum,
      patch: { name: "Mi nombre" },
      updatedAt: remoteTime,
    })).rejects.toMatchObject({
      conflictPaths: [`characters.${adler.id}.name`],
    });
  });
});
