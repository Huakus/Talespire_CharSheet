// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { GmToolsPanel, type GmToolsRuntime } from "../../src/ui/gm-tools-panel";
import { normalizeSpellDefinition } from "../../src/domain/spells/spell-catalog";
import { normalizeEquipmentDefinition } from "../../src/domain/equipment/equipment-catalog";
import { normalizeMonsterDefinition } from "../../src/domain/monsters/monster-catalog";
import { normalizeMerchantInteraction } from "../../src/domain/commerce/merchant-interaction";
import { SpellDefinitionSchema } from "../../src/domain/character/character-spell-model";
import type { CampaignContent } from "../../src/domain/content/campaign-content";
import { bindReviewedEquipment } from "../../src/domain/equipment/equipment-live";
import { EquipmentDefinitionDraftSchema } from "../../src/domain/equipment/equipment-definition";
import reviewed from "../../docs/v2/equipment-preparation-2026-10-17/used-equipment-reviewed-definitions.json";

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });
const meta = { origin: "gm" as const, contentKey: "custom:one", revision: 4, tags: ["es", "favorite", "campaña"] };
async function harness(section: "spell" | "equipment" | "shop", content: Partial<CampaignContent>, runtime: Partial<GmToolsRuntime> = {}) {
  const root = document.createElement("div"); document.body.append(root);
  const messages: { text: string }[] = [];
  const workspace = { noteGroups: [], randomTables: [], googleDocsUrl: "" };
  const render = () => {
    root.innerHTML = panel.render("content", workspace, section);
    // Happy DOM 21's parser chooses the preceding option; honor the declared selection as a browser does.
    root.querySelectorAll<HTMLSelectElement>("select").forEach(select => { const selected = select.querySelector<HTMLOptionElement>("option[selected]"); if (selected) select.value = selected.value; });
    panel.bind("content", workspace, "checksum");
  };
  const panel = new GmToolsPanel(root, { loadGmContent: async () => ({ spells: [], equipment: [], monsters: [], shops: [], checklist: [], ...content }), ...runtime }, () => undefined, message => messages.push(message), render);
  await panel.load();
  Object.assign(panel, { editingContent: section });
  render();
  const field = (name: string) => root.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name="${name}"]`)!;
  const change = (name: string, value: string) => { field(name).value = value; field(name).dispatchEvent(new Event("input", { bubbles: true })); field(name).dispatchEvent(new Event("change", { bubbles: true })); };
  const submit = () => root.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  return { root, panel, messages, field, change, submit };
}

describe("structured GM content editors", () => {
  it("offers full structured stock rules, supplementary capabilities and persistent read-more controls", async () => {
    const definition = EquipmentDefinitionDraftSchema.parse(reviewed.find(d => d.name === "Poción de curación"));
    const item = bindReviewedEquipment({ ...normalizeEquipmentDefinition({ name: definition.name }), id: "inv_11111111111111111111111111111111", order: 0, group: "backpack" }, definition);
    item.description = "Resumen anterior incompleto.";
    item.features[0]!.description += "\n\nUna condición adicional que debe verse completa.";
    item.rules!.personalDescription = "Una nota propia del comerciante.";
    const npc = normalizeMonsterDefinition({ Id: "merchant", Name: "Mercader", Inventory: [item] });
    const ui = await harness("shop", { monsters: [npc], shops: [{ name: "Tienda", npcId: npc.id, categories: {} }] });
    const description = () => ui.root.querySelector<HTMLElement>('[data-inventory-description]')!;
    expect(description().querySelector("table")).not.toBeNull();
    expect(description().querySelectorAll("tbody tr")).toHaveLength(1); // Only this potion variant's row.
    expect(ui.root.textContent).toContain("Una condición adicional que debe verse completa.");
    expect(ui.root.textContent).toContain("Una nota propia del comerciante.");
    expect(ui.root.textContent).toContain("Resumen anterior incompleto.");
    expect(ui.root.querySelector('[data-roll-expression="2d4+2"]')).not.toBeNull();
    description().querySelector<HTMLButtonElement>('[data-toggle-inventory-description]')!.click();
    expect(description().classList.contains("expanded")).toBe(true);
    ui.change("name", "Tienda editada");
    const search = ui.root.querySelector<HTMLInputElement>('[data-gm-shop-inventory-search]')!;
    search.value = "curación"; search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(description().classList.contains("expanded")).toBe(true);
    expect(ui.field("name").value).toBe("Tienda editada");
    expect(description().querySelector('[data-toggle-inventory-description]')!.getAttribute("aria-expanded")).toBe("true");
    description().querySelector<HTMLButtonElement>('[data-toggle-inventory-description]')!.click();
    expect(description().classList.contains("expanded")).toBe(false);
  });

  it("round-trips every spell field, tags and uncommon class values", async () => {
    const spell = SpellDefinitionSchema.parse({ ...normalizeSpellDefinition({ name: "Prueba", level: 2 }), year: "2024", school: "Escuela propia", components: "V, S, M", material: "Cristal", ritual: true, concentration: true, classes: ["wizard", "artífice propio"], attackType: "save", saveAbility: "wisdom", damageType: "Fuego", damageExpression: "2d6", upcastDamageExpression: "1d6", addAbilityModifier: true, higherLevels: "Otro dado", description: "Texto completo", range: "60 pies", castingTime: "1 acción", duration: "1 minuto", catalog: meta });
    const save = vi.fn<NonNullable<GmToolsRuntime["saveCustomSpell"]>>(async () => undefined);
    const ui = await harness("spell", { spells: [spell] }, { saveCustomSpell: save });
    ui.submit();
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    const saved = save.mock.calls[0]![0];
    expect({ ...saved, catalog: null }).toEqual({ ...spell, catalog: null });
    expect(saved.catalog?.tags).toEqual(expect.arrayContaining(meta.tags));
    expect(saved.catalog?.revision).toBe(4);
  });

  it("keeps the draft after invalid dice and failed persistence, and blocks duplicate saves", async () => {
    let finish!: () => void;
    const save = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const ui = await harness("spell", { spells: [normalizeSpellDefinition({ name: "Prueba" })] }, { saveCustomSpell: save });
    ui.change("damageExpression", "bad dice"); ui.submit();
    await vi.waitFor(() => expect(ui.messages.at(-1)?.text).toContain("Revisá los dados"));
    expect(ui.field("damageExpression").value).toBe("bad dice");
    expect(save).not.toHaveBeenCalled();
    ui.change("damageExpression", "2d6"); ui.submit(); ui.submit();
    expect(save).toHaveBeenCalledOnce();
    expect(ui.root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    finish();
    await vi.waitFor(() => expect(ui.messages.at(-1)?.text).toBe("Conjuro guardado."));

    const failed = await harness("spell", { spells: [normalizeSpellDefinition({ name: "Prueba" })] }, { saveCustomSpell: async () => { throw new Error("Sin conexión"); } });
    failed.change("description", "No perder este texto"); failed.submit();
    await vi.waitFor(() => expect(failed.messages.at(-1)?.text).toBe("Sin conexión"));
    expect(failed.field("description").value).toBe("No perder este texto");
    expect(failed.root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  });

  it("keeps source classification immutable while allowing campaign tags", async () => {
    const spell = { ...normalizeSpellDefinition({ name: "Prueba" }), catalog: { ...meta, tags: ["manual_jugador", "favorite", "campaña"] } };
    const save = vi.fn<NonNullable<GmToolsRuntime["saveCustomSpell"]>>(async () => undefined);
    const ui = await harness("spell", { spells: [spell] }, { saveCustomSpell: save });
    expect(ui.field("catalogTags").value).not.toContain("manual_jugador");
    ui.change("catalogTags", "old, xanathar, custom, otro"); ui.submit();
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0]![0].catalog?.tags.sort()).toEqual(["favorite", "manual_jugador", "otro"]);
  });

  it("preserves item state and armor requirements while switching conditional fields", async () => {
    const equipment = normalizeEquipmentDefinition({ name: "Armadura", armor_class: { base: 18 }, str_minimum: 15 });
    const item = { ...equipment, quantity: 3, equipped: true, attuned: true, catalog: meta };
    const save = vi.fn<NonNullable<GmToolsRuntime["saveCustomEquipment"]>>(async () => undefined);
    const ui = await harness("equipment", { equipment: [item] }, { saveCustomEquipment: save });
    ui.change("strengthRequirement", "17");
    ui.change("itemKind", "weapon"); ui.change("damageExpression", "1d8");
    ui.change("itemKind", "armor");
    expect(ui.field("damageExpression").value).toBe("1d8");
    expect(ui.root.querySelector<HTMLElement>('[data-equipment-section="weapon"]')!.hidden).toBe(true);
    expect(ui.root.querySelector<HTMLElement>('[data-equipment-section="armor"]')!.hidden).toBe(false);
    ui.submit();
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0]![0]).toMatchObject({ quantity: 3, equipped: true, attuned: true, armor: { strengthRequirement: 17 }, bonuses: item.bonuses, features: item.features, effect: item.effect });
  });

  it("preserves advanced equipment definitions and resources when editing ordinary fields", async () => {
    const base = normalizeEquipmentDefinition({ name: "Botas aladas" });
    const owned = bindReviewedEquipment({ ...base, id: "inv_11111111111111111111111111111111", order: 0, group: "backpack" }, EquipmentDefinitionDraftSchema.parse(reviewed.find(d => d.name === "Botas aladas")));
    const item = { ...owned, rarity: "uncommon", catalog: meta };
    const save = vi.fn<NonNullable<GmToolsRuntime["saveCustomEquipment"]>>(async () => undefined);
    const ui = await harness("equipment", { equipment: [item] }, { saveCustomEquipment: save });
    ui.change("description", "Nueva descripción personal"); ui.submit();
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0]![0].rules).toEqual(item.rules);
    expect(save.mock.calls[0]![0].features).toEqual(item.features);
    expect(save.mock.calls[0]![0].bonuses).toEqual(item.bonuses);
    expect(save.mock.calls[0]![0].description).toBe("Nueva descripción personal");
  });

  it("keeps merchant settings, legacy categories and theft counters when filtering stock", async () => {
    const npc = normalizeMonsterDefinition({ Id: "merchant", Name: "Mercader", Abilities: { Cha: 16 } });
    const shop = { name: "Tienda", npcId: npc.id, categories: { Equipo: ["Cuerda"] }, interactions: normalizeMerchantInteraction({ theftsThisInteraction: 2, reputation: 3, assault: true, fundsCopper: 1234 }), tags: ["favorito", "mercado"] };
    const save = vi.fn<NonNullable<GmToolsRuntime["saveShop"]>>(async () => undefined), saveNpc = vi.fn(async () => undefined);
    const ui = await harness("shop", { monsters: [npc], shops: [shop] }, { saveShop: save, saveCustomMonster: saveNpc });
    ui.change("name", "Tienda nueva"); ui.change("commissionPercent", "30");
    const search = ui.root.querySelector<HTMLInputElement>('[data-gm-shop-inventory-search]')!;
    search.value = "Cuerda"; search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(ui.field("name").value).toBe("Tienda nueva");
    expect(ui.field("commissionPercent").value).toBe("30");
    ui.submit();
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(saveNpc).toHaveBeenCalledOnce();
    expect(save.mock.calls[0]![0]).toMatchObject({ name: "Tienda nueva", categories: shop.categories, interactions: { theftsThisInteraction: 2, commissionPercent: 30, reputation: 3, assault: true, fundsCopper: 1234 }, tags: expect.arrayContaining(shop.tags) });
  });
});
