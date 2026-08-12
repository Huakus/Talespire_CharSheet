import { describe, expect, it } from "vitest";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import {
  DualCampaignRepository,
  type CampaignReplica,
  type CampaignReplicaDocument,
} from "../../src/infrastructure/persistence/dual-campaign-repository";
import {
  createCampaignSnapshot,
  decodeCampaignEnvelope,
  encodeCampaignEnvelope,
} from "../../src/infrastructure/persistence/campaign-snapshot";
import { createTestCampaign, createTestCharacter } from "../fixtures/native-campaign";

class FakeReplica implements CampaignReplica {
  saveCalls = 0;
  readError: Error | null = null;

  constructor(public document: CampaignReplicaDocument | null) {}

  async read(): Promise<CampaignReplicaDocument | null> {
    if (this.readError) throw this.readError;
    return this.document === null ? null : structuredClone(this.document);
  }

  async save(
    expectedRevision: number,
    payload: Record<string, unknown>,
  ): Promise<CampaignReplicaDocument> {
    if (this.document === null) throw new Error("remote document missing");
    if (this.document.revision !== expectedRevision) throw new Error("remote revision conflict");
    this.saveCalls += 1;
    this.document = {
      revision: expectedRevision + 1,
      payload: structuredClone(payload),
    };
    return structuredClone(this.document);
  }
}

async function campaignFixture() {
  return createTestCampaign({
    id: "dual-test",
    character: createTestCharacter({ name: "DualHero" }),
  });
}

async function replicaDocument(campaign: Awaited<ReturnType<typeof campaignFixture>>): Promise<CampaignReplicaDocument> {
  const snapshot = await createCampaignSnapshot(campaign);
  return {
    revision: 0,
    payload: JSON.parse(encodeCampaignEnvelope(snapshot)) as Record<string, unknown>,
  };
}

describe("DualCampaignRepository", () => {
  it("keeps the primary authoritative and mirrors an exact checked envelope", async () => {
    const primary = new InMemoryCampaignRepository();
    const initial = await primary.save(await campaignFixture(), { kind: "empty" });
    const replica = new FakeReplica(await replicaDocument(initial.campaign));
    const repository = new DualCampaignRepository(primary, replica);

    expect(await repository.load()).toEqual(initial);
    await expect(repository.flushReplication()).resolves.toMatchObject({ state: "synced" });

    const updatedCampaign = {
      ...initial.campaign,
      revision: initial.campaign.revision + 1,
      metadata: { ...initial.campaign.metadata, updatedAt: "2026-08-04T12:01:00.000Z" },
    };
    const saved = await repository.save(updatedCampaign, {
      kind: "checksum",
      checksum: initial.checksum,
    });
    const status = await repository.flushReplication();

    expect(status).toMatchObject({
      state: "synced",
      localChecksum: saved.checksum,
      remoteRevision: 1,
    });
    expect(replica.saveCalls).toBe(1);
    const mirrored = await decodeCampaignEnvelope(JSON.stringify(replica.document?.payload));
    expect(mirrored).toEqual(saved);
  });

  it("returns a successful primary save when the backend is unavailable", async () => {
    const primary = new InMemoryCampaignRepository();
    const initial = await primary.save(await campaignFixture(), { kind: "empty" });
    const replica = new FakeReplica(await replicaDocument(initial.campaign));
    replica.readError = new Error("backend offline");
    const repository = new DualCampaignRepository(primary, replica);

    const saved = await repository.save({
      ...initial.campaign,
      revision: initial.campaign.revision + 1,
    }, {
      kind: "checksum",
      checksum: initial.checksum,
    });

    expect(await primary.load()).toEqual(saved);
    await expect(repository.flushReplication()).resolves.toMatchObject({
      state: "unavailable",
      localChecksum: saved.checksum,
      message: "backend offline",
    });
  });

  it("detects divergence on load without overwriting the remote document", async () => {
    const primary = new InMemoryCampaignRepository();
    const local = await primary.save(await campaignFixture(), { kind: "empty" });
    const divergentCampaign = {
      ...local.campaign,
      revision: local.campaign.revision + 10,
      metadata: { ...local.campaign.metadata, updatedAt: "2026-08-04T13:00:00.000Z" },
    };
    const replica = new FakeReplica(await replicaDocument(divergentCampaign));
    const repository = new DualCampaignRepository(primary, replica);

    expect(await repository.load()).toEqual(local);
    const status = await repository.flushReplication();

    expect(status).toMatchObject({
      state: "diverged",
      localChecksum: local.checksum,
      remoteRevision: 0,
    });
    expect(replica.saveCalls).toBe(0);
  });
});
