import { describe, expect, it } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { CampaignRepositoryConflictError } from "../../src/application/ports/campaign-repository";
import { previewCampaignMigration } from "../../src/application/migration/migrate-campaign-v1";
import {
  createCampaignSnapshot,
  encodeCampaignEnvelope,
} from "../../src/infrastructure/persistence/campaign-snapshot";
import { resolveRemoteBackendConfig } from "../../src/infrastructure/remote/backend-config";
import {
  createRemoteSupabaseClient,
  RemoteCampaignRevisionConflictError,
  SupabaseCampaignDocumentClient,
} from "../../src/infrastructure/remote/supabase-campaign-document-client";
import { SupabaseCampaignRepository } from "../../src/infrastructure/remote/supabase-campaign-repository";

const backendConfig = resolveRemoteBackendConfig(import.meta.env);
const integrationPassword = "Integration-Only-123!";

interface TestActor {
  email: string;
  user: User;
  supabase: SupabaseClient;
  campaigns: SupabaseCampaignDocumentClient;
}

async function within<T>(label: string, operation: Promise<T>, timeoutMs = 5_000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`Integration step timed out: ${label}`)), timeoutMs);
  });
  try {
    return await Promise.race([operation, deadline]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

async function createActor(label: string): Promise<TestActor> {
  if (backendConfig === null) throw new Error("Integration backend is not configured");
  const supabase = createRemoteSupabaseClient(backendConfig);
  const uniqueEmail = `${label}-${crypto.randomUUID()}@example.test`;
  const result = await within(`sign up ${label}`, supabase.auth.signUp({
    email: uniqueEmail,
    password: integrationPassword,
  }));
  if (result.error) throw result.error;
  if (!result.data.user || !result.data.session) {
    throw new Error("Local Supabase must allow signups without email confirmation");
  }
  return {
    email: uniqueEmail,
    user: result.data.user,
    supabase,
    campaigns: new SupabaseCampaignDocumentClient(supabase),
  };
}

describe.skipIf(backendConfig === null)("Supabase campaign access", () => {
  it("enforces membership and rejects a stale concurrent write", async () => {
    const owner = await createActor("owner");
    const member = await createActor("member");
    const outsider = await createActor("outsider");
    const initialPayload = { format: "talespire-campaign", value: { round: 0 } };
    const created = await within(
      "create campaign",
      owner.campaigns.createCampaign("Integration campaign", initialPayload),
    );

    try {
      expect(created).toMatchObject({ revision: 0, payload: initialPayload });
      await within(
        "invite member by email",
        owner.campaigns.addMemberByEmail(created.campaignId, member.email, "player"),
      );

      await expect(within("member campaign list", member.campaigns.listCampaigns())).resolves.toEqual([
        expect.objectContaining({ id: created.campaignId, name: "Integration campaign" }),
      ]);
      await expect(within("outsider campaign list", outsider.campaigns.listCampaigns())).resolves.toEqual([]);

      const memberRead = await within(
        "member read",
        member.campaigns.readCampaign(created.campaignId),
      );
      expect(memberRead).toMatchObject({
        campaignId: created.campaignId,
        revision: 0,
        payload: initialPayload,
      });
      await expect(within(
        "outsider read",
        outsider.campaigns.readCampaign(created.campaignId),
      )).resolves.toBeNull();
      await expect(
        within(
          "outsider add member",
          outsider.campaigns.addMember(created.campaignId, outsider.user.id),
        ),
      ).rejects.toMatchObject({ code: "42501" });

      const memberUpdate = await within(
        "member save",
        member.campaigns.saveCampaign(
          created.campaignId,
          0,
          { format: "talespire-campaign", value: { round: 1, updatedBy: "member" } },
        ),
      );
      expect(memberUpdate).toMatchObject({ revision: 1, updatedBy: member.user.id });

      await expect(
        within(
          "stale owner save",
          owner.campaigns.saveCampaign(created.campaignId, 0, {
            format: "talespire-campaign",
            value: { round: 1, updatedBy: "stale-owner" },
          }),
        ),
      ).rejects.toBeInstanceOf(RemoteCampaignRevisionConflictError);

      await expect(within(
        "owner read latest",
        owner.campaigns.readCampaign(created.campaignId),
      )).resolves.toMatchObject({
        revision: 1,
        payload: memberUpdate.payload,
      });

      const memberRows = await within("member RLS query", Promise.resolve(
        member.supabase.from("campaigns").select("id").eq("id", created.campaignId),
      ));
      expect(memberRows.error).toBeNull();
      expect(memberRows.data).toEqual([{ id: created.campaignId }]);

      const outsiderRows = await within("outsider RLS query", Promise.resolve(
        outsider.supabase.from("campaigns").select("id").eq("id", created.campaignId),
      ));
      expect(outsiderRows.error).toBeNull();
      expect(outsiderRows.data).toEqual([]);
    } finally {
      await within("delete campaign", owner.campaigns.deleteCampaign(created.campaignId));
    }
  }, 30_000);

  it("implements the campaign repository contract with Supabase as authority", async () => {
    const owner = await createActor("remote-repository-owner");
    const preview = await previewCampaignMigration(
      { characters: { RemoteHero: { playerClass: "Cleric", characterLevel: "4" } } },
      { campaignId: "remote-repository", migratedAt: "2026-08-04T15:00:00.000Z" },
    );
    if (!preview.ok) throw new Error(preview.issues.join("; "));
    const initial = await createCampaignSnapshot(preview.data);
    const created = await owner.campaigns.createCampaign(
      "Remote repository integration",
      JSON.parse(encodeCampaignEnvelope(initial)) as Record<string, unknown>,
    );
    const reportedRevisions: number[] = [];
    const repository = new SupabaseCampaignRepository(
      owner.campaigns,
      created.campaignId,
      (revision) => reportedRevisions.push(revision),
    );

    try {
      await expect(repository.load()).resolves.toEqual(initial);
      const updatedCampaign = {
        ...initial.campaign,
        revision: initial.campaign.revision + 1,
        metadata: { ...initial.campaign.metadata, updatedAt: "2026-08-04T15:01:00.000Z" },
      };
      const saved = await repository.save(updatedCampaign, {
        kind: "checksum",
        checksum: initial.checksum,
      });
      expect(saved.campaign.revision).toBe(initial.campaign.revision + 1);
      expect(reportedRevisions.at(-1)).toBe(1);
      await expect(repository.load()).resolves.toEqual(saved);

      await expect(repository.save({
        ...updatedCampaign,
        revision: updatedCampaign.revision + 1,
      }, {
        kind: "checksum",
        checksum: initial.checksum,
      })).rejects.toBeInstanceOf(CampaignRepositoryConflictError);
    } finally {
      await owner.campaigns.deleteCampaign(created.campaignId);
    }
  }, 30_000);

  it("delivers campaign document updates through Realtime", async () => {
    const owner = await createActor("realtime-owner");
    const member = await createActor("realtime-member");
    const created = await owner.campaigns.createCampaign("Realtime integration", {
      format: "realtime-probe",
      value: 0,
    });
    await owner.campaigns.addMemberByEmail(created.campaignId, member.email);

    let receiveDocument: ((document: Awaited<ReturnType<typeof member.campaigns.readCampaign>>) => void) | undefined;
    const received = new Promise<Awaited<ReturnType<typeof member.campaigns.readCampaign>>>((resolve) => {
      receiveDocument = resolve;
    });
    const subscription = member.campaigns.subscribeCampaign(created.campaignId, (document) => {
      receiveDocument?.(document);
    });

    try {
      await within("Realtime subscribed", subscription.ready, 10_000);
      await owner.campaigns.saveCampaign(created.campaignId, 0, {
        format: "realtime-probe",
        value: 1,
      });
      await expect(within("Realtime update", received, 10_000)).resolves.toMatchObject({
        campaignId: created.campaignId,
        revision: 1,
        payload: { format: "realtime-probe", value: 1 },
      });
    } finally {
      await subscription.unsubscribe();
      await owner.campaigns.deleteCampaign(created.campaignId);
    }
  }, 30_000);
});
