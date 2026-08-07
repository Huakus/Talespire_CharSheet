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
} from "./supabase-campaign-document-client";

export class SupabaseCampaignRepository implements CampaignRepository {
  constructor(
    private readonly client: SupabaseCampaignDocumentClient,
    private readonly campaignId: string,
    private readonly onRemoteRevision: (revision: number) => void = () => undefined,
  ) {}

  async load(): Promise<CampaignSnapshot | null> {
    const document = await this.client.readCampaign(this.campaignId);
    if (document !== null) this.onRemoteRevision(document.revision);
    return document === null
      ? null
      : decodeCampaignEnvelope(JSON.stringify(document.payload));
  }

  async save(
    campaign: CampaignV2,
    expectation: SaveExpectation,
  ): Promise<CampaignSnapshot> {
    const currentDocument = await this.client.readCampaign(this.campaignId);
    const current = currentDocument === null
      ? null
      : await decodeCampaignEnvelope(JSON.stringify(currentDocument.payload));

    if (expectation.kind === "empty") {
      if (current !== null) throw new CampaignRepositoryConflictError("empty", current.checksum);
      throw new CampaignRepositoryCorruptionError(
        "Remote campaign exists without an initialized campaign document",
      );
    }
    if (current?.checksum !== expectation.checksum || currentDocument === null) {
      throw new CampaignRepositoryConflictError(expectation.checksum, current?.checksum ?? null);
    }

    const candidate = await createCampaignSnapshot(campaign);
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
      this.onRemoteRevision(saved.revision);
      return verified;
    } catch (error) {
      if (!(error instanceof RemoteCampaignRevisionConflictError)) throw error;
      const latest = await this.load();
      throw new CampaignRepositoryConflictError(
        expectation.checksum,
        latest?.checksum ?? null,
      );
    }
  }
}
