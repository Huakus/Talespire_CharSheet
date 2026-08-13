import { describe, expect, it } from "vitest";
import { SupabaseCampaignLoreClient } from "../../src/infrastructure/remote/supabase-campaign-lore-client";

describe("Supabase campaign lore client", () => {
  it("calls the existing ranked search RPC with the selected campaign", async () => {
    const calls: Array<{ name: string; parameters: Record<string, unknown> }> = [];
    const supabase = {
      rpc: async (name: string, parameters: Record<string, unknown>) => {
        calls.push({ name, parameters });
        return { data: [{
          result_type: "chapter", result_id: 3, result_name: "El rescate de Haroldo", chapter_number: 3,
          rank: 0.72, excerpt: "Adler y Delerion encuentran el naufragio.",
        }], error: null };
      },
    };
    const client = new SupabaseCampaignLoreClient(supabase as never, "00000000-0000-4000-8000-000000000001");
    const results = await client.search("  Adler naufragio  ", 500);
    expect(calls).toEqual([{ name: "search_campaign_lore", parameters: {
      p_campaign_id: "00000000-0000-4000-8000-000000000001",
      p_query: "Adler naufragio",
      p_limit: 100,
    } }]);
    expect(results[0]).toMatchObject({ type: "chapter", id: 3, chapterNumber: 3, rank: 0.72 });
  });

  it("does not call Supabase for an empty query", async () => {
    const supabase = { rpc: () => { throw new Error("should not run"); } };
    const client = new SupabaseCampaignLoreClient(supabase as never, "00000000-0000-4000-8000-000000000001");
    await expect(client.search("   ")).resolves.toEqual([]);
  });
});
