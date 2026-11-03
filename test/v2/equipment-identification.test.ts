// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { createCharacter } from "../../src/domain/character/create-character";
import { normalizeEquipmentDefinition } from "../../src/domain/equipment/equipment-catalog";
import { CharacterInventoryItemV2Schema } from "../../src/domain/character/character-inventory-model";
import { itemIsIdentified, unidentifiedItemView } from "../../src/domain/equipment/equipment-identification";
import { setInventoryItemEquipped, useInventoryItem, spendInventoryItemCharges, inventoryItemsCanStack, upsertInventoryItem } from "../../src/domain/character/character-inventory";
import { projectInventory, projectAbilityScore } from "../../src/domain/character/character-projection";
import { BrowserApp } from "../../src/ui/browser-app";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
import { normalizeMonsterDefinition } from "../../src/domain/monsters/monster-catalog";
import { normalizeMerchantInteraction } from "../../src/domain/commerce/merchant-interaction";
import { SupabaseCampaignDocumentClient } from "../../src/infrastructure/remote/supabase-campaign-document-client";

const runtime = { storageLabel: "test", diceRoller: { roll: async () => ({ kind: "rolled" as const, totals: [1], summary: "test" }) } };
const time = "2026-11-02T12:00:00.000Z", id = "inv_11111111111111111111111111111111";
function fixture() {
  const c = createCharacter("chr_11111111111111111111111111111111", "Hero", time);
  c.inventory = [CharacterInventoryItemV2Schema.parse({ ...normalizeEquipmentDefinition({ name: "Armadura secreta", description: "Secreto absoluto", bonuses: [{ category: "attributes", key: "strength", value: 4 }] }),
    id, order: 0, group: "backpack", quantity: 1, unitWeight: 3, equipped: true, attuned: true, usable: true, charges: { current: 2, maximum: 5, reset: "long-rest" },
    armor: { base: 19, dexterityBonus: false, maximumDexterityBonus: null, armorCategory: "heavy", stealthDisadvantage: true }, category: "armor",
    identification: { identified: false, name: "Armadura polvorienta", appearance: "Tiene grabados antiguos." } })];
  return c;
}
describe("unidentified equipment", () => {
  it("keeps old copies identified without changing their serialized shape", () => {
    const item = fixture().inventory[0]!; delete item.identification;
    expect(itemIsIdentified(item)).toBe(true);
    expect(CharacterInventoryItemV2Schema.parse(item)).toEqual(item);
  });
  it("removes hidden information from presentation without mutating resources", () => {
    const item = fixture().inventory[0]!, original = JSON.stringify(item), visible = unidentifiedItemView(item);
    expect(visible.name).toBe("Armadura polvorienta"); expect(visible.description).toBe("Tiene grabados antiguos.");
    expect(visible.armor).toBeNull(); expect(visible.charges).toBeNull(); expect(visible.bonuses).toEqual([]);
    expect(JSON.stringify(visible)).not.toContain("Secreto absoluto"); expect(JSON.stringify(item)).toBe(original);
  });
  it("blocks use and passive effects even if an old copy remains equipped", () => {
    const c = fixture(), options = { expectedRevision: c.revision, updatedAt: time }, before = JSON.stringify(c);
    expect(projectAbilityScore(c,"strength")).toBe(c.abilities.strength);
    expect(projectInventory(c).calculatedArmorClass).toBe(10 + Math.floor((c.abilities.dexterity - 10)/2));
    expect(projectInventory(c).totalWeight).toBe(3); expect(projectInventory(c).attuned).toBe(0);
    expect(() => setInventoryItemEquipped(c,id,true,options)).toThrow(/identificar/);
    expect(() => useInventoryItem(c,id,options)).toThrow(/identificar/);
    expect(() => spendInventoryItemCharges(c,id,1,options)).toThrow(/identificar/);
    expect(JSON.stringify(c)).toBe(before);
    c.inventory[0]!.identification!.identified = true;
    expect(projectAbilityScore(c,"strength")).toBe(c.abilities.strength + 4);
    expect(projectInventory(c).calculatedArmorClass).toBe(19);
    expect(c.inventory[0]!.charges!.current).toBe(2);
  });
  it("retains identification on edits and never stacks identified and unidentified copies", () => {
    const c = fixture(), item = c.inventory[0]!, plain = { ...item }; delete plain.identification;
    const next = upsertInventoryItem(c, plain, { expectedRevision: c.revision, updatedAt: time });
    expect(next.inventory[0]!.identification).toEqual(item.identification);
    const loose = { ...item, equipped: false, attuned: false, charges: null };
    expect(inventoryItemsCanStack(loose, { ...loose, identification: { ...loose.identification!, identified: true } })).toBe(false);
  });
  it("hides the real item in both player views and exposes the GM identification controls", () => {
    const c = fixture();
    const render = (gm: boolean, mode: "play" | "edit") => {
      const app = new BrowserApp(document.createElement("div"), new CampaignApplication(new InMemoryCampaignRepository()), { ...runtime, canManageCharacters: gm });
      const view = app as unknown as { activeSheetTab: string; sheetMode: string; renderCharacterForm(c: CharacterV2): string };
      view.activeSheetTab = "inventory"; view.sheetMode = mode; return view.renderCharacterForm(c);
    };
    for (const mode of ["play","edit"] as const) {
      const html = render(false,mode); expect(html).toContain("Armadura polvorienta"); expect(html).not.toContain("Armadura secreta"); expect(html).not.toContain("Secreto absoluto");
    }
    expect(render(true,"edit")).toContain('data-inventory-field="identified"');
  });
  it("keeps loot available without offering buying, selling or undiscovered stock details", () => {
    const c = fixture(), npc = normalizeMonsterDefinition({ Id: "npc_dead", Name: "Edran", Inventory: c.inventory });
    const app = new BrowserApp(document.createElement("div"), new CampaignApplication(new InMemoryCampaignRepository()), runtime);
    const view = app as unknown as { activeSheetTab: string; activeMerchantName: string; customMonsters: typeof npc[]; customShops: unknown[]; renderCharacterForm(c: CharacterV2): string };
    view.activeSheetTab = "interactions"; view.activeMerchantName = "Edran"; view.customMonsters = [npc];
    view.customShops = [{ name: "Edran", npcId: npc.id, categories: {}, interactions: normalizeMerchantInteraction({ state: "dead", loot: true, barter: false }) }];
    const html = view.renderCharacterForm(c);
    expect(html).toContain('data-merchant-action="loot-selected"'); expect(html).toContain("Inventario del comerciante");
    expect(html).not.toContain("<span>Comprar</span>"); expect(html).not.toContain("<span>Vender</span>");
    expect(html).not.toContain('data-merchant-action="open-cart-review"'); expect(html).not.toContain("Secreto absoluto"); expect(html).not.toContain("Armadura secreta");
  });
  it("routes player loot through its atomic RPC with unchanged revision checks", async () => {
    let called = "", args: Record<string,unknown> = {};
    const client = new SupabaseCampaignDocumentClient({ rpc: async (name: string, input: Record<string,unknown>) => {
      called = name; args = input; return { data: { campaignRevision: 2, characterRevision: 2, shopRevision: 1, monsterRevision: 2,
        buySubtotalCopper: 0, sellSubtotalCopper: 0, commissionCopper: 0, characterCurrencyDeltaCopper: 0, merchantCurrencyDeltaCopper: 0, updatedAt: time }, error: null };
    } } as never);
    await client.executeCampaignMerchantTrade({ operation: "loot", campaignId: "11111111-1111-1111-1111-111111111111", characterId: "hero", shopContentKey: "shop", monsterContentKey: "npc",
      expectedCampaignRevision: 1, expectedCharacterRevision: 1, expectedShopRevision: 1, expectedMonsterRevision: 1, buys: [{ itemId: id, quantity: 1 }], sells: [] });
    expect(called).toBe("execute_campaign_merchant_loot"); expect(args.p_sells).toEqual([]); expect(args.p_expected_monster_revision).toBe(1);
  });
});
