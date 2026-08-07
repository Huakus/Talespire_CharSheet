import { describe, expect, it } from "vitest";
import {
  RemoteBackendConfigurationError,
  resolveRemoteBackendConfig,
} from "../../src/infrastructure/remote/backend-config";
import {
  SupabaseBackendClient,
  type BackendRpcTransport,
} from "../../src/infrastructure/remote/supabase-backend-client";
import { formatBackendStatus } from "../../src/ui/backend-status";
import { resolvePersistenceMode } from "../../src/infrastructure/remote/persistence-mode";

describe("remote backend foundation", () => {
  it("keeps the backend disabled when no environment is configured", () => {
    expect(resolveRemoteBackendConfig({})).toBeNull();
    expect(resolvePersistenceMode({})).toBe("local");
  });

  it("enables dual persistence only when explicitly configured", () => {
    expect(resolvePersistenceMode({ VITE_PERSISTENCE_MODE: "dual" })).toBe("dual");
    expect(resolvePersistenceMode({ VITE_PERSISTENCE_MODE: "remote" })).toBe("remote");
    expect(() => resolvePersistenceMode({ VITE_PERSISTENCE_MODE: "invalid" })).toThrow();
  });

  it("rejects partial configuration", () => {
    expect(() => resolveRemoteBackendConfig({
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
    })).toThrow(RemoteBackendConfigurationError);
  });

  it("parses a health response and measures latency", async () => {
    const transport: BackendRpcTransport = {
      call: async () => ({
        status: "ok",
        schemaVersion: 1,
        serverTime: "2026-08-03T12:00:00+00:00",
      }),
    };
    const times = [100, 112];
    const client = new SupabaseBackendClient(transport, () => times.shift() ?? 112);

    await expect(client.checkHealth()).resolves.toEqual({
      status: "ok",
      schemaVersion: 1,
      serverTime: "2026-08-03T12:00:00+00:00",
      latencyMs: 12,
    });
  });

  it("formats a visible connected status", () => {
    expect(formatBackendStatus({
      state: "connected",
      url: "http://127.0.0.1:54321",
      health: {
        status: "ok",
        schemaVersion: 1,
        serverTime: "2026-08-03T12:00:00+00:00",
        latencyMs: 9,
      },
    })).toContain("esquema 1 · 9 ms");
  });
});
