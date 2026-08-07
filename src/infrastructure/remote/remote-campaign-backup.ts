import { z } from "zod";
import {
  CampaignEnvelopeSchema,
  decodeCampaignEnvelope,
  encodeCampaignEnvelope,
} from "../persistence/campaign-snapshot";
import type { RemoteCampaignDocument } from "./supabase-campaign-document-client";

const RemoteCampaignBackupSchema = z.object({
  format: z.literal("talespire-toolset-remote-backup-v1"),
  campaignName: z.string().trim().min(1).max(120),
  sourceCampaignId: z.string().uuid(),
  sourceRevision: z.number().int().nonnegative(),
  exportedAt: z.string().datetime(),
  payload: CampaignEnvelopeSchema,
});

export interface ParsedRemoteCampaignBackup {
  campaignName: string;
  sourceCampaignId: string;
  sourceRevision: number;
  payload: Record<string, unknown>;
}

export async function createRemoteCampaignBackup(
  campaignName: string,
  document: RemoteCampaignDocument,
  exportedAt = new Date().toISOString(),
): Promise<string> {
  const snapshot = await decodeCampaignEnvelope(JSON.stringify(document.payload));
  return JSON.stringify({
    format: "talespire-toolset-remote-backup-v1",
    campaignName,
    sourceCampaignId: document.campaignId,
    sourceRevision: document.revision,
    exportedAt,
    payload: JSON.parse(encodeCampaignEnvelope(snapshot)) as Record<string, unknown>,
  }, null, 2);
}

export async function parseRemoteCampaignBackup(
  raw: string,
): Promise<ParsedRemoteCampaignBackup> {
  const parsed = RemoteCampaignBackupSchema.parse(JSON.parse(raw));
  const snapshot = await decodeCampaignEnvelope(JSON.stringify(parsed.payload));
  return {
    campaignName: parsed.campaignName,
    sourceCampaignId: parsed.sourceCampaignId,
    sourceRevision: parsed.sourceRevision,
    payload: JSON.parse(encodeCampaignEnvelope(snapshot)) as Record<string, unknown>,
  };
}
