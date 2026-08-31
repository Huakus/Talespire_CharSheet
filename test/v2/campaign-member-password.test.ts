import type { User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  createCampaignMemberTemporaryPassword,
  updateSignedInPassword,
} from "../../src/ui/campaign-member-password";

type AdministrationClient = Parameters<typeof createCampaignMemberTemporaryPassword>[0];
const user = { id: "00000000-0000-4000-8000-000000000001" } as User;

function client(overrides?: { invoke?: AdministrationClient["functions"]["invoke"] }) {
  return {
    functions: {
      invoke: overrides?.invoke ?? vi.fn(async () => ({
        data: { temporaryPassword: "Abcdefghij2!temporary" },
        error: null,
      })),
    },
    auth: {
      updateUser: vi.fn(async () => ({ data: { user }, error: null })),
    },
  } as unknown as AdministrationClient;
}

describe("campaign member password administration", () => {
  it("requests a temporary password for a campaign member", async () => {
    const supabase = client();

    await expect(createCampaignMemberTemporaryPassword(
      supabase,
      "00000000-0000-4000-8000-000000000002",
      "friend@example.com",
    )).resolves.toBe("Abcdefghij2!temporary");
    expect(supabase.functions.invoke).toHaveBeenCalledWith("reset-campaign-member-password", {
      body: {
        campaignId: "00000000-0000-4000-8000-000000000002",
        email: "friend@example.com",
      },
    });
  });

  it("shows the protected function's detailed error", async () => {
    const context = new Response(JSON.stringify({ error: "Sólo el dueño puede hacerlo." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
    const supabase = client({
      invoke: vi.fn(async () => ({
        data: null,
        error: Object.assign(new Error("Edge Function returned a non-2xx status code"), { context }),
      })) as AdministrationClient["functions"]["invoke"],
    });

    await expect(createCampaignMemberTemporaryPassword(
      supabase,
      "00000000-0000-4000-8000-000000000002",
      "friend@example.com",
    )).rejects.toThrow("Sólo el dueño puede hacerlo.");
  });

  it("lets the signed-in member replace the temporary password", async () => {
    const supabase = client();

    await expect(updateSignedInPassword(supabase, "a-new-private-password")).resolves.toBe(user);
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: "a-new-private-password" });
  });
});
