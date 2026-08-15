import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  CampaignFragmentKindSchema,
  type CampaignFragmentChange,
  type CharacterVersionChange,
  type RemoteCampaignFragmentState,
} from "./campaign-fragments";
import {
  RemoteCampaignError,
  type RemoteCampaignSubscription,
} from "./supabase-campaign-document-client";

const FragmentSchema = z.object({
  kind: CampaignFragmentKindSchema,
  parentId: z.string(),
  entityId: z.string().min(1),
  position: z.coerce.number().int().nonnegative(),
  payload: z.record(z.string(), z.unknown()),
  revision: z.coerce.number().int().nonnegative(),
});

const CharacterVersionSchema = z.object({
  characterId: z.string().min(1),
  revision: z.coerce.number().int().nonnegative(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

const FragmentStateSchema = z.object({
  campaignRevision: z.coerce.number().int().nonnegative(),
  campaignUpdatedAt: z.string().min(1),
  updatedBy: z.string().uuid().nullable(),
  characters: z.array(CharacterVersionSchema),
  fragments: z.array(FragmentSchema),
});

const FragmentRevisionSchema = z.object({
  kind: CampaignFragmentKindSchema,
  parentId: z.string(),
  entityId: z.string().min(1),
  revision: z.coerce.number().int().nonnegative(),
  deleted: z.boolean(),
});

const SaveResultSchema = z.object({
  previousCampaignRevision: z.coerce.number().int().nonnegative(),
  campaignRevision: z.coerce.number().int().nonnegative(),
  campaignUpdatedAt: z.string().min(1),
  updatedBy: z.string().uuid(),
  characters: z.array(CharacterVersionSchema),
  fragments: z.array(FragmentRevisionSchema),
});

const CampaignSignalSchema = z.object({
  id: z.string().uuid(),
  state_revision: z.coerce.number().int().nonnegative(),
  state_updated_by: z.string().uuid().nullable(),
  updated_at: z.string().min(1),
});

type RpcError = { code?: string; details?: string; message: string };

export class RemoteCampaignFragmentConflictError extends RemoteCampaignError {
  constructor(message: string, code: string | undefined, details: string | undefined) {
    super(message, code, details);
    this.name = "RemoteCampaignFragmentConflictError";
  }
}

function throwFragmentRpcError(error: RpcError): never {
  if (error.message.includes("CAMPAIGN_FRAGMENT_CONFLICT")) {
    throw new RemoteCampaignFragmentConflictError(error.message, error.code, error.details);
  }
  throw new RemoteCampaignError(error.message, error.code, error.details);
}

export interface RemoteCampaignFragmentSaveResult {
  previousCampaignRevision: number;
  campaignRevision: number;
  campaignUpdatedAt: string;
  updatedBy: string;
  characters: z.infer<typeof CharacterVersionSchema>[];
  fragments: z.infer<typeof FragmentRevisionSchema>[];
}

export interface RemoteCampaignSignal {
  campaignId: string;
  revision: number;
  updatedBy: string | null;
  updatedAt: string;
}

export class SupabaseCampaignFragmentClient {
  constructor(private readonly client: SupabaseClient) {}

  async readCampaign(campaignId: string): Promise<RemoteCampaignFragmentState | null> {
    const result = await this.client.rpc("read_campaign_fragments", {
      p_campaign_id: campaignId,
    });
    if (result.error) throwFragmentRpcError(result.error);
    if (result.data === null) return null;
    return FragmentStateSchema.parse(result.data) as RemoteCampaignFragmentState;
  }

  async saveCampaign(
    campaignId: string,
    expectedCampaignRevision: number,
    campaignUpdatedAt: string,
    changes: CampaignFragmentChange[],
    characterChanges: CharacterVersionChange[],
  ): Promise<RemoteCampaignFragmentSaveResult> {
    const result = await this.client.rpc("save_campaign_fragment_batch", {
      p_campaign_id: campaignId,
      p_expected_campaign_revision: expectedCampaignRevision,
      p_campaign_updated_at: campaignUpdatedAt,
      p_changes: changes,
      p_character_changes: characterChanges,
    });
    if (result.error) throwFragmentRpcError(result.error);
    return SaveResultSchema.parse(result.data);
  }

  subscribeCampaign(
    campaignId: string,
    listener: (signal: RemoteCampaignSignal) => void,
  ): RemoteCampaignSubscription {
    let resolveReady: (() => void) | undefined;
    let rejectReady: ((error: Error) => void) | undefined;
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    const channel = this.client
      .channel(`campaign-state:${campaignId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "campaigns",
          filter: `id=eq.${campaignId}`,
        },
        (event) => {
          const row = CampaignSignalSchema.parse(event.new);
          if (row.id !== campaignId) return;
          listener({
            campaignId: row.id,
            revision: row.state_revision,
            updatedBy: row.state_updated_by,
            updatedAt: row.updated_at,
          });
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
