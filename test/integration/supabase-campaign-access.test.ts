import { describe, expect, it } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { CampaignRepositoryConflictError } from "../../src/application/ports/campaign-repository";
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
import { SupabaseCampaignFragmentClient } from "../../src/infrastructure/remote/supabase-campaign-fragment-client";
import { SupabaseGranularCampaignRepository } from "../../src/infrastructure/remote/supabase-granular-campaign-repository";
import { createTestCampaign, createTestCharacter } from "../fixtures/native-campaign";

const backendConfig = resolveRemoteBackendConfig(import.meta.env);
const integrationPassword = "Integration-Only-123!";

interface TestActor {
  email: string;
  user: User;
  supabase: SupabaseClient;
  campaigns: SupabaseCampaignDocumentClient;
  fragments: SupabaseCampaignFragmentClient;
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
  const uniqueEmail = `${label}-${crypto.randomUUID()}@example.com`;
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
    fragments: new SupabaseCampaignFragmentClient(supabase),
  };
}

describe.skipIf(backendConfig === null)("Supabase campaign access", () => {
  it("enforces membership and rejects a stale concurrent write", async () => {
    const owner = await createActor("owner");
    const member = await createActor("member");
    const outsider = await createActor("outsider");
    const initialSnapshot = await createCampaignSnapshot(createTestCampaign({ id: "campaign-access" }));
    const initialPayload = JSON.parse(encodeCampaignEnvelope(initialSnapshot)) as Record<string, unknown>;
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
    const initial = await createCampaignSnapshot(createTestCampaign({
      id: "remote-repository",
      character: createTestCharacter({ name: "RemoteHero" }),
    }));
    const created = await owner.campaigns.createCampaign(
      "Remote repository integration",
      JSON.parse(encodeCampaignEnvelope(initial)) as Record<string, unknown>,
    );
    const reportedRevisions: number[] = [];
    const repository = new SupabaseGranularCampaignRepository(
      owner.fragments,
      created.campaignId,
      (revision) => reportedRevisions.push(revision),
    );

    try {
      await expect(repository.load()).resolves.toEqual(initial);
      const updatedCampaign = {
        ...initial.campaign,
        revision: initial.campaign.revision + 1,
        metadata: { ...initial.campaign.metadata, updatedAt: "2026-08-04T15:01:00.000Z" },
        gm: {
          ...initial.campaign.gm,
          googleDocsUrl: "https://docs.google.com/document/d/remote-repository/edit",
        },
      };
      const saved = await repository.save(updatedCampaign, {
        kind: "checksum",
        checksum: initial.checksum,
      });
      expect(saved.campaign.revision).toBe(initial.campaign.revision + 1);
      expect(reportedRevisions.at(-1)).toBe(1);
      await expect(repository.load()).resolves.toEqual(saved);

      await expect(repository.save({
        ...initial.campaign,
        revision: initial.campaign.revision + 1,
        metadata: { ...initial.campaign.metadata, updatedAt: "2026-08-04T15:01:30.000Z" },
        gm: {
          ...initial.campaign.gm,
          googleDocsUrl: "https://docs.google.com/document/d/stale-conflict/edit",
        },
      }, {
        kind: "checksum",
        checksum: initial.checksum,
      })).rejects.toBeInstanceOf(CampaignRepositoryConflictError);
    } finally {
      await owner.campaigns.deleteCampaign(created.campaignId);
    }
  }, 30_000);

  it("delivers small granular campaign signals through Realtime", async () => {
    const owner = await createActor("realtime-owner");
    const member = await createActor("realtime-member");
    const seed = await createCampaignSnapshot(createTestCampaign({ id: "realtime-granular" }));
    const created = await owner.campaigns.createCampaign(
      "Realtime integration",
      JSON.parse(encodeCampaignEnvelope(seed)) as Record<string, unknown>,
    );
    await owner.campaigns.addMemberByEmail(created.campaignId, member.email);

    const ownerRepository = new SupabaseGranularCampaignRepository(owner.fragments, created.campaignId);
    const initial = (await ownerRepository.load())!;
    let receiveSignal: ((signal: { campaignId: string; revision: number }) => void) | undefined;
    const received = new Promise<{ campaignId: string; revision: number }>((resolve) => {
      receiveSignal = resolve;
    });
    const subscription = member.fragments.subscribeCampaign(created.campaignId, (signal) => {
      receiveSignal?.(signal);
    });

    try {
      await within("Realtime subscribed", subscription.ready, 10_000);
      await ownerRepository.save({
        ...initial.campaign,
        revision: initial.campaign.revision + 1,
        metadata: { ...initial.campaign.metadata, updatedAt: "2026-08-04T15:02:00.000Z" },
        gm: { ...initial.campaign.gm, googleDocsUrl: "https://docs.google.com/document/d/realtime/edit" },
      }, {
        kind: "checksum",
        checksum: initial.checksum,
      });
      await expect(within("Realtime update", received, 10_000)).resolves.toMatchObject({
        campaignId: created.campaignId,
        revision: 1,
      });
    } finally {
      await subscription.unsubscribe();
      await owner.campaigns.deleteCampaign(created.campaignId);
    }
  }, 30_000);
});
