import type {
  CampaignReplica,
  CampaignReplicaDocument,
} from "../persistence/dual-campaign-repository";
import { SupabaseCampaignDocumentClient } from "./supabase-campaign-document-client";

export class SupabaseCampaignReplica implements CampaignReplica {
  constructor(
    private readonly client: SupabaseCampaignDocumentClient,
    private readonly campaignId: string,
  ) {}

  async read(): Promise<CampaignReplicaDocument | null> {
    const document = await this.client.readCampaign(this.campaignId);
    return document === null
      ? null
      : { revision: document.revision, payload: document.payload };
  }

  async save(
    expectedRevision: number,
    payload: Record<string, unknown>,
  ): Promise<CampaignReplicaDocument> {
    const document = await this.client.saveCampaign(
      this.campaignId,
      expectedRevision,
      payload,
    );
    return { revision: document.revision, payload: document.payload };
  }
}
