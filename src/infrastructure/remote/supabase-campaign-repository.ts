import type {
  CampaignRepository,
  CampaignSnapshot,
  SaveExpectation,
} from "../../application/ports/campaign-repository";
import {
  CampaignRepositoryConflictError,
  CampaignRepositoryCorruptionError,
} from "../../application/ports/campaign-repository";
import type { CampaignV2 } from "../../domain/character/character-v2";
import {
  createCampaignSnapshot,
  decodeCampaignEnvelope,
  encodeCampaignEnvelope,
} from "../persistence/campaign-snapshot";
import {
  RemoteCampaignRevisionConflictError,
  SupabaseCampaignDocumentClient,
  type RemoteCampaignDocument,
} from "./supabase-campaign-document-client";
import { mergeCampaignChanges } from "./campaign-three-way-merge";

export class SupabaseCampaignRepository implements CampaignRepository {
  private readonly versions = new Map<string, CampaignSnapshot>();
  private latestRemoteRevision = -1;

  constructor(
    private readonly client: SupabaseCampaignDocumentClient,
    private readonly campaignId: string,
    private readonly onRemoteRevision: (revision: number) => void = () => undefined,
  ) {}

  async load(): Promise<CampaignSnapshot | null> {
    const document = await this.client.readCampaign(this.campaignId);
    return document === null ? null : this.acceptRemoteDocument(document);
  }

  async acceptRemoteDocument(document: RemoteCampaignDocument): Promise<CampaignSnapshot> {
    if (document.campaignId !== this.campaignId) {
      throw new CampaignRepositoryCorruptionError(
        `Received campaign ${document.campaignId} for repository ${this.campaignId}`,
      );
    }
    const snapshot = await decodeCampaignEnvelope(JSON.stringify(document.payload));
    this.rememberRemoteSnapshot(snapshot, document.revision);
    return snapshot;
  }

  async loadVersion(checksum: string): Promise<CampaignSnapshot | null> {
    const known = this.versions.get(checksum);
    if (known !== undefined) return createCampaignSnapshot(known.campaign);
    return this.load();
  }

  async save(
    campaign: CampaignV2,
    expectation: SaveExpectation,
  ): Promise<CampaignSnapshot> {
    if (expectation.kind === "empty") {
      const currentDocument = await this.client.readCampaign(this.campaignId);
      const current = currentDocument === null
        ? null
        : await decodeCampaignEnvelope(JSON.stringify(currentDocument.payload));
      if (current !== null) throw new CampaignRepositoryConflictError("empty", current.checksum);
      throw new CampaignRepositoryCorruptionError(
        "Remote campaign exists without an initialized campaign document",
      );
    }
    const base = this.versions.get(expectation.checksum);
    if (base === undefined) {
      throw new CampaignRepositoryConflictError(expectation.checksum, null);
    }
    const local = await createCampaignSnapshot(campaign);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const currentDocument = await this.client.readCampaign(this.campaignId);
      if (currentDocument === null) {
        throw new CampaignRepositoryConflictError(expectation.checksum, null);
      }
      const remote = await decodeCampaignEnvelope(JSON.stringify(currentDocument.payload));
      this.remember(remote);
      const candidate = remote.checksum === expectation.checksum
        ? local
        : await this.mergedCandidate(base, local, remote, expectation.checksum);
      try {
        const saved = await this.client.saveCampaign(
          this.campaignId,
          currentDocument.revision,
          JSON.parse(encodeCampaignEnvelope(candidate)) as Record<string, unknown>,
        );
        const verified = await decodeCampaignEnvelope(JSON.stringify(saved.payload));
        if (verified.checksum !== candidate.checksum) {
          throw new CampaignRepositoryCorruptionError(
            `Remote campaign verification failed: expected ${candidate.checksum}, found ${verified.checksum}`,
          );
        }
        this.rememberRemoteSnapshot(verified, saved.revision);
        return verified;
      } catch (error) {
        if (!(error instanceof RemoteCampaignRevisionConflictError)) throw error;
      }
    }
    const latest = await this.load();
    throw new CampaignRepositoryConflictError(expectation.checksum, latest?.checksum ?? null);
  }

  private async mergedCandidate(
    base: CampaignSnapshot,
    local: CampaignSnapshot,
    remote: CampaignSnapshot,
    expectedChecksum: string,
  ): Promise<CampaignSnapshot> {
    const result = mergeCampaignChanges(base.campaign, local.campaign, remote.campaign);
    if (result.campaign === null) {
      throw new CampaignRepositoryConflictError(
        expectedChecksum,
        remote.checksum,
        result.conflictPaths,
      );
    }
    return createCampaignSnapshot(result.campaign);
  }

  private remember(snapshot: CampaignSnapshot): void {
    this.versions.delete(snapshot.checksum);
    this.versions.set(snapshot.checksum, snapshot);
    while (this.versions.size > 20) {
      const oldest = this.versions.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.versions.delete(oldest);
    }
  }

  private rememberRemoteSnapshot(snapshot: CampaignSnapshot, revision: number): void {
    if (revision < this.latestRemoteRevision) return;
    this.latestRemoteRevision = revision;
    this.remember(snapshot);
    this.onRemoteRevision(revision);
  }
}
