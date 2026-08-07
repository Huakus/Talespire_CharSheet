import type {
  CampaignRepository,
  CampaignSnapshot,
  SaveExpectation,
} from "../../application/ports/campaign-repository";
import type { CampaignV2 } from "../../domain/character/character-v2";
import {
  decodeCampaignEnvelope,
  encodeCampaignEnvelope,
} from "./campaign-snapshot";

export interface CampaignReplicaDocument {
  revision: number;
  payload: Record<string, unknown>;
}

export interface CampaignReplica {
  read(): Promise<CampaignReplicaDocument | null>;
  save(
    expectedRevision: number,
    payload: Record<string, unknown>,
  ): Promise<CampaignReplicaDocument>;
}

export type CampaignReplicationStatus =
  | { state: "idle" }
  | { state: "syncing"; localChecksum: string }
  | { state: "synced"; localChecksum: string; remoteRevision: number }
  | {
      state: "diverged";
      localChecksum: string;
      remoteChecksum: string | null;
      remoteRevision: number;
    }
  | { state: "missing"; localChecksum: string }
  | { state: "unavailable"; localChecksum: string; message: string };

export type CampaignReplicationStatusListener = (
  status: CampaignReplicationStatus,
) => void;

function envelopePayload(snapshot: CampaignSnapshot): Record<string, unknown> {
  return JSON.parse(encodeCampaignEnvelope(snapshot)) as Record<string, unknown>;
}

async function snapshotFromReplica(
  document: CampaignReplicaDocument,
): Promise<CampaignSnapshot | null> {
  try {
    return await decodeCampaignEnvelope(JSON.stringify(document.payload));
  } catch {
    return null;
  }
}

export class DualCampaignRepository implements CampaignRepository {
  private replicationQueue: Promise<void> = Promise.resolve();
  private currentStatus: CampaignReplicationStatus = { state: "idle" };
  private lastVerifiedRemote: { revision: number; checksum: string } | null = null;

  constructor(
    private readonly primary: CampaignRepository,
    private readonly replica: CampaignReplica,
    private readonly onStatus: CampaignReplicationStatusListener = () => undefined,
  ) {}

  get status(): CampaignReplicationStatus {
    return this.currentStatus;
  }

  async load(): Promise<CampaignSnapshot | null> {
    const snapshot = await this.primary.load();
    if (snapshot === null) {
      this.publish({ state: "idle" });
      return null;
    }
    this.enqueue(snapshot, null, false);
    return snapshot;
  }

  async save(
    campaign: CampaignV2,
    expectation: SaveExpectation,
  ): Promise<CampaignSnapshot> {
    const snapshot = await this.primary.save(campaign, expectation);
    const baseChecksum = expectation.kind === "checksum" ? expectation.checksum : null;
    this.enqueue(snapshot, baseChecksum, true);
    return snapshot;
  }

  async flushReplication(): Promise<CampaignReplicationStatus> {
    await this.replicationQueue;
    return this.currentStatus;
  }

  async checkReplication(): Promise<CampaignReplicationStatus> {
    const snapshot = await this.primary.load();
    if (snapshot === null) {
      this.publish({ state: "idle" });
      return this.currentStatus;
    }
    this.enqueue(snapshot, null, false);
    return this.flushReplication();
  }

  private enqueue(
    snapshot: CampaignSnapshot,
    baseChecksum: string | null,
    mayWrite: boolean,
  ): void {
    this.replicationQueue = this.replicationQueue
      .then(() => this.reconcile(snapshot, baseChecksum, mayWrite))
      .catch((error: unknown) => {
        this.publish({
          state: "unavailable",
          localChecksum: snapshot.checksum,
          message: error instanceof Error ? error.message : String(error),
        });
      });
  }

  private async reconcile(
    local: CampaignSnapshot,
    baseChecksum: string | null,
    mayWrite: boolean,
  ): Promise<void> {
    this.publish({ state: "syncing", localChecksum: local.checksum });
    const remote = await this.replica.read();
    if (remote === null) {
      this.publish({ state: "missing", localChecksum: local.checksum });
      return;
    }

    const remoteSnapshot = await snapshotFromReplica(remote);
    const remoteChecksum = remoteSnapshot?.checksum ?? null;
    if (remoteChecksum === local.checksum) {
      this.lastVerifiedRemote = { revision: remote.revision, checksum: remoteChecksum };
      this.publish({
        state: "synced",
        localChecksum: local.checksum,
        remoteRevision: remote.revision,
      });
      return;
    }

    const matchesExpectedBase = baseChecksum !== null && remoteChecksum === baseChecksum;
    const matchesVerifiedRemote = this.lastVerifiedRemote !== null &&
      remote.revision === this.lastVerifiedRemote.revision &&
      remoteChecksum === this.lastVerifiedRemote.checksum;
    if (!mayWrite || remoteChecksum === null || (!matchesExpectedBase && !matchesVerifiedRemote)) {
      this.publish({
        state: "diverged",
        localChecksum: local.checksum,
        remoteChecksum,
        remoteRevision: remote.revision,
      });
      return;
    }

    const saved = await this.replica.save(remote.revision, envelopePayload(local));
    const verified = await snapshotFromReplica(saved);
    if (verified?.checksum !== local.checksum) {
      this.publish({
        state: "diverged",
        localChecksum: local.checksum,
        remoteChecksum: verified?.checksum ?? null,
        remoteRevision: saved.revision,
      });
      return;
    }

    this.lastVerifiedRemote = { revision: saved.revision, checksum: verified.checksum };
    this.publish({
      state: "synced",
      localChecksum: local.checksum,
      remoteRevision: saved.revision,
    });
  }

  private publish(status: CampaignReplicationStatus): void {
    this.currentStatus = status;
    try {
      this.onStatus(status);
    } catch {
      // Observability must never change persistence behavior.
    }
  }
}
