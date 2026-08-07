import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { RemoteBackendConfig } from "./backend-config";

const CampaignDocumentRowSchema = z.object({
  campaign_id: z.string().uuid(),
  revision: z.coerce.number().int().nonnegative(),
  payload: z.record(z.string(), z.unknown()),
  updated_by: z.string().uuid().nullable(),
  updated_at: z.string().min(1),
});

const CampaignSummaryRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  owner_user_id: z.string().uuid(),
  updated_at: z.string().min(1),
});

export interface RemoteCampaignDocument {
  campaignId: string;
  revision: number;
  payload: Record<string, unknown>;
  updatedBy: string | null;
  updatedAt: string;
}

export type CampaignMemberRole = "gm" | "player";

export interface RemoteCampaignSummary {
  id: string;
  name: string;
  ownerUserId: string;
  updatedAt: string;
}

export interface RemoteCampaignSubscription {
  ready: Promise<void>;
  unsubscribe(): Promise<void>;
}

export class RemoteCampaignError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
    readonly details: string | undefined,
  ) {
    super(message);
    this.name = "RemoteCampaignError";
  }
}

export class RemoteCampaignRevisionConflictError extends RemoteCampaignError {
  constructor(
    readonly expectedRevision: number,
    details: string | undefined,
    code = "P0001",
  ) {
    super("The remote campaign was updated by another client", code, details);
    this.name = "RemoteCampaignRevisionConflictError";
  }
}

type RpcError = {
  code?: string;
  details?: string;
  message: string;
};

function throwRpcError(error: RpcError, expectedRevision?: number): never {
  if (error.message.includes("CAMPAIGN_REVISION_CONFLICT") && expectedRevision !== undefined) {
    throw new RemoteCampaignRevisionConflictError(expectedRevision, error.details, error.code);
  }
  throw new RemoteCampaignError(error.message, error.code, error.details);
}

function parseDocument(data: unknown): RemoteCampaignDocument {
  const candidate = Array.isArray(data) ? data[0] : data;
  const row = CampaignDocumentRowSchema.parse(candidate);
  return {
    campaignId: row.campaign_id,
    revision: row.revision,
    payload: row.payload,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

export function createRemoteSupabaseClient(
  config: RemoteBackendConfig,
  options: { persistSession?: boolean; autoRefreshToken?: boolean } = {},
): SupabaseClient {
  return createClient(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: options.autoRefreshToken ?? false,
      detectSessionInUrl: false,
      persistSession: options.persistSession ?? false,
    },
  });
}

export class SupabaseCampaignDocumentClient {
  static fromConfig(config: RemoteBackendConfig): SupabaseCampaignDocumentClient {
    return new SupabaseCampaignDocumentClient(createRemoteSupabaseClient(config));
  }

  constructor(private readonly client: SupabaseClient) {}

  async listCampaigns(): Promise<RemoteCampaignSummary[]> {
    const result = await this.client
      .from("campaigns")
      .select("id,name,owner_user_id,updated_at")
      .order("updated_at", { ascending: false });
    if (result.error) throwRpcError(result.error);
    return z.array(CampaignSummaryRowSchema).parse(result.data).map((row) => ({
      id: row.id,
      name: row.name,
      ownerUserId: row.owner_user_id,
      updatedAt: row.updated_at,
    }));
  }

  async createCampaign(
    name: string,
    payload: Record<string, unknown>,
  ): Promise<RemoteCampaignDocument> {
    const result = await this.client.rpc("create_campaign", {
      p_name: name,
      p_payload: payload,
    });
    if (result.error) throwRpcError(result.error);
    return parseDocument(result.data);
  }

  async readCampaign(campaignId: string): Promise<RemoteCampaignDocument | null> {
    const result = await this.client.rpc("read_campaign_document", {
      p_campaign_id: campaignId,
    });
    if (result.error) throwRpcError(result.error);
    if (Array.isArray(result.data) && result.data.length === 0) return null;
    if (result.data === null) return null;
    return parseDocument(result.data);
  }

  async saveCampaign(
    campaignId: string,
    expectedRevision: number,
    payload: Record<string, unknown>,
  ): Promise<RemoteCampaignDocument> {
    const result = await this.client.rpc("save_campaign_document", {
      p_campaign_id: campaignId,
      p_expected_revision: expectedRevision,
      p_payload: payload,
    });
    if (result.error) throwRpcError(result.error, expectedRevision);
    return parseDocument(result.data);
  }

  async addMember(
    campaignId: string,
    userId: string,
    role: CampaignMemberRole = "player",
  ): Promise<void> {
    const result = await this.client.rpc("add_campaign_member", {
      p_campaign_id: campaignId,
      p_user_id: userId,
      p_role: role,
    });
    if (result.error) throwRpcError(result.error);
  }

  async addMemberByEmail(
    campaignId: string,
    email: string,
    role: CampaignMemberRole = "player",
  ): Promise<string> {
    const result = await this.client.rpc("add_campaign_member_by_email", {
      p_campaign_id: campaignId,
      p_email: email,
      p_role: role,
    });
    if (result.error) throwRpcError(result.error);
    return z.string().uuid().parse(result.data);
  }

  async deleteCampaign(campaignId: string): Promise<void> {
    const result = await this.client.rpc("delete_campaign", {
      p_campaign_id: campaignId,
    });
    if (result.error) throwRpcError(result.error);
  }

  subscribeCampaign(
    campaignId: string,
    listener: (document: RemoteCampaignDocument) => void,
  ): RemoteCampaignSubscription {
    let resolveReady: (() => void) | undefined;
    let rejectReady: ((error: Error) => void) | undefined;
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    const channel = this.client
      .channel(`campaign-document:${campaignId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "campaign_documents",
        },
        (event) => {
          const document = parseDocument(event.new);
          if (document.campaignId === campaignId) listener(document);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") resolveReady?.();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          rejectReady?.(new Error(`Realtime subscription failed: ${status}`));
        }
      });
    return {
      ready,
      unsubscribe: async () => {
        await this.client.removeChannel(channel);
      },
    };
  }
}
