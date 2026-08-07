import { describe, expect, it } from "vitest";
import { previewCampaignMigration } from "../../src/application/migration/migrate-campaign-v1";
import { decodeCampaignEnvelope } from "../../src/infrastructure/persistence/campaign-snapshot";
import { LocalStorageCampaignRepository } from "../../src/infrastructure/persistence/local-storage-campaign-repository";
import { resolveRemoteBackendConfig } from "../../src/infrastructure/remote/backend-config";
import { SupabaseBackendClient } from "../../src/infrastructure/remote/supabase-backend-client";

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

describe.skipIf(backendConfig === null)("Supabase persistence compatibility", () => {
  it("preserves the exact campaign snapshot produced by current persistence", async () => {
    if (backendConfig === null) throw new Error("Integration backend is not configured");
    const preview = await previewCampaignMigration(
      { characters: { IntegrationHero: { playerClass: "Wizard", characterLevel: "3" } } },
      { campaignId: "supabase-integration", migratedAt: "2026-08-03T12:00:00.000Z" },
    );
    if (!preview.ok) throw new Error(preview.issues.join("; "));

    const storage = new MemoryStorage();
    const repository = new LocalStorageCampaignRepository(storage, "integration-campaign");
    const localSnapshot = await repository.save(preview.data, { kind: "empty" });
    const localEnvelope = JSON.parse(storage.values.get("integration-campaign") ?? "null") as unknown;

    const remoteClient = SupabaseBackendClient.fromConfig(backendConfig);
    await expect(remoteClient.checkHealth()).resolves.toMatchObject({ status: "ok", schemaVersion: 1 });
    const returnedEnvelope = await remoteClient.roundTripCampaignEnvelope(localEnvelope);
    const remoteSnapshot = await decodeCampaignEnvelope(JSON.stringify(returnedEnvelope));

    expect(remoteSnapshot).toEqual(localSnapshot);
  });
});
