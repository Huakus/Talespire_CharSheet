import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { RemoteBackendConfig } from "./backend-config";

const BackendHealthPayloadSchema = z.object({
  status: z.literal("ok"),
  schemaVersion: z.number().int().nonnegative(),
  serverTime: z.string().min(1),
});

export interface BackendHealth {
  status: "ok";
  schemaVersion: number;
  serverTime: string;
  latencyMs: number;
}

export interface BackendRpcTransport {
  call(functionName: string, parameters?: Record<string, unknown>): Promise<unknown>;
}

function createSupabaseTransport(config: RemoteBackendConfig): BackendRpcTransport {
  const client = createClient(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  return {
    async call(functionName, parameters) {
      const result = parameters === undefined
        ? await client.rpc(functionName)
        : await client.rpc(functionName, parameters);
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
  };
}

export class SupabaseBackendClient {
  static fromConfig(config: RemoteBackendConfig): SupabaseBackendClient {
    return new SupabaseBackendClient(createSupabaseTransport(config));
  }

  constructor(
    private readonly transport: BackendRpcTransport,
    private readonly clock: () => number = () => performance.now(),
  ) {}

  async checkHealth(): Promise<BackendHealth> {
    const startedAt = this.clock();
    const payload = BackendHealthPayloadSchema.parse(
      await this.transport.call("backend_healthcheck"),
    );
    return {
      ...payload,
      latencyMs: Math.max(0, Math.round(this.clock() - startedAt)),
    };
  }

  roundTripCampaignEnvelope(envelope: unknown): Promise<unknown> {
    return this.transport.call("persistence_roundtrip_probe", { p_payload: envelope });
  }
}
