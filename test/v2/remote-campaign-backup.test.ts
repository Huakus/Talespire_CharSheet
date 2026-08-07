import { describe, expect, it } from "vitest";
import { previewCampaignMigration } from "../../src/application/migration/migrate-campaign-v1";
import {
  createCampaignSnapshot,
  encodeCampaignEnvelope,
} from "../../src/infrastructure/persistence/campaign-snapshot";
import {
  createRemoteCampaignBackup,
  parseRemoteCampaignBackup,
} from "../../src/infrastructure/remote/remote-campaign-backup";

describe("remote campaign backup", () => {
  it("round-trips a checksummed remote campaign document", async () => {
    const preview = await previewCampaignMigration(
      { characters: { Hero: { playerClass: "Wizard", characterLevel: "5" } } },
      { campaignId: "backup-test", migratedAt: "2026-08-05T01:00:00.000Z" },
    );
    if (!preview.ok) throw new Error(preview.issues.join("; "));
    const snapshot = await createCampaignSnapshot(preview.data);
    const payload = JSON.parse(encodeCampaignEnvelope(snapshot)) as Record<string, unknown>;
    const raw = await createRemoteCampaignBackup("Campaña principal", {
      campaignId: "d17bf690-35c3-4a70-84d6-767446020735",
      revision: 7,
      payload,
      updatedBy: null,
      updatedAt: "2026-08-05T01:01:00.000Z",
    }, "2026-08-05T01:02:00.000Z");

    await expect(parseRemoteCampaignBackup(raw)).resolves.toEqual({
      campaignName: "Campaña principal",
      sourceCampaignId: "d17bf690-35c3-4a70-84d6-767446020735",
      sourceRevision: 7,
      payload,
    });
  });

  it("rejects a backup whose campaign payload was modified", async () => {
    const preview = await previewCampaignMigration(
      { characters: { Hero: { playerClass: "Wizard", characterLevel: "5" } } },
      { campaignId: "tampered-backup", migratedAt: "2026-08-05T01:00:00.000Z" },
    );
    if (!preview.ok) throw new Error(preview.issues.join("; "));
    const snapshot = await createCampaignSnapshot(preview.data);
    const raw = await createRemoteCampaignBackup("Campaña principal", {
      campaignId: "d17bf690-35c3-4a70-84d6-767446020735",
      revision: 7,
      payload: JSON.parse(encodeCampaignEnvelope(snapshot)) as Record<string, unknown>,
      updatedBy: null,
      updatedAt: "2026-08-05T01:01:00.000Z",
    }, "2026-08-05T01:02:00.000Z");
    const tampered = JSON.parse(raw) as { payload: { campaign: { revision: number } } };
    tampered.payload.campaign.revision += 1;

    await expect(parseRemoteCampaignBackup(JSON.stringify(tampered))).rejects.toThrow(
      "checksum mismatch",
    );
  });
});
