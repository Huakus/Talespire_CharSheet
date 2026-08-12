import { describe, expect, it } from "vitest";
import { decodeCampaignEnvelope } from "../../src/infrastructure/persistence/campaign-snapshot";
import { LocalStorageCampaignRepository } from "../../src/infrastructure/persistence/local-storage-campaign-repository";
import { resolveRemoteBackendConfig } from "../../src/infrastructure/remote/backend-config";
import { SupabaseBackendClient } from "../../src/infrastructure/remote/supabase-backend-client";
import { createTestCampaign, createTestCharacter } from "../fixtures/native-campaign";

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const backendConfig = resolveRemoteBackendConfig(import.meta.env);

describe.skipIf(backendConfig === null)("Supabase persistence", () => {
  it("preserves the exact campaign snapshot produced by current persistence", async () => {
    if (backendConfig === null) throw new Error("Integration backend is not configured");
    const campaign = createTestCampaign({
      id: "supabase-integration",
      character: createTestCharacter({ name: "IntegrationHero" }),
    });

    const storage = new MemoryStorage();
    const repository = new LocalStorageCampaignRepository(storage, "integration-campaign");
    const localSnapshot = await repository.save(campaign, { kind: "empty" });
    const localEnvelope = JSON.parse(storage.values.get("integration-campaign") ?? "null") as unknown;

    const remoteClient = SupabaseBackendClient.fromConfig(backendConfig);
    await expect(remoteClient.checkHealth()).resolves.toMatchObject({ status: "ok", schemaVersion: 1 });
    const returnedEnvelope = await remoteClient.roundTripCampaignEnvelope(localEnvelope);
    const remoteSnapshot = await decodeCampaignEnvelope(JSON.stringify(returnedEnvelope));

    expect(remoteSnapshot).toEqual(localSnapshot);
  });
});
