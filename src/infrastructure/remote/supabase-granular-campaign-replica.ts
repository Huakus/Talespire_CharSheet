import type {
  CampaignReplica,
  CampaignReplicaDocument,
} from "../persistence/dual-campaign-repository";
import {
  decodeCampaignEnvelope,
  encodeCampaignEnvelope,
} from "../persistence/campaign-snapshot";
import { RemoteCampaignRevisionConflictError } from "./supabase-campaign-document-client";
import { SupabaseGranularCampaignRepository } from "./supabase-granular-campaign-repository";

export class SupabaseGranularCampaignReplica implements CampaignReplica {
  private lastChecksum: string | null = null;
  private lastRevision = -1;

  constructor(private readonly repository: SupabaseGranularCampaignRepository) {}

  async read(): Promise<CampaignReplicaDocument | null> {
    const snapshot = await this.repository.load();
    if (!snapshot) return null;
    this.lastChecksum = snapshot.checksum;
    this.lastRevision = this.repository.remoteRevision;
    return {
      revision: this.lastRevision,
      payload: JSON.parse(encodeCampaignEnvelope(snapshot)) as Record<string, unknown>,
    };
  }

  async save(expectedRevision: number, payload: Record<string, unknown>): Promise<CampaignReplicaDocument> {
    if (this.lastChecksum === null || this.lastRevision !== expectedRevision) {
      throw new RemoteCampaignRevisionConflictError(expectedRevision, `current=${this.lastRevision}`);
    }
    const candidate = await decodeCampaignEnvelope(JSON.stringify(payload));
    const saved = await this.repository.save(candidate.campaign, {
      kind: "checksum",
      checksum: this.lastChecksum,
    });
    this.lastChecksum = saved.checksum;
    this.lastRevision = this.repository.remoteRevision;
    return {
      revision: this.lastRevision,
      payload: JSON.parse(encodeCampaignEnvelope(saved)) as Record<string, unknown>,
    };
  }
}
