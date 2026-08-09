import { describe, expect, it } from "vitest";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { GmWorkspaceApplication } from "../../src/application/gm/gm-workspace-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { GmToolsPanel, matchesGroupedFilters } from "../../src/ui/gm-tools-panel";
import { removeGmNoteGroup } from "../../src/domain/gm/gm-workspace";
import { calculateFloatingPanelPosition, calculateTaleSpireRoundDelta, findPlayerInitiativeCombatant, GmApp } from "../../src/ui/gm-app";
import { createCharacter } from "../../src/domain/character/create-character";
import { renderCheckboxGroup } from "../../src/ui/checkbox-group";
import { normalizeEquipmentDefinition } from "../../src/domain/equipment/equipment-catalog";
import { normalizeMonsterDefinition } from "../../src/domain/monsters/monster-catalog";
import type { GmShop } from "../../src/domain/gm/gm-global-content";

describe("GM workspace", () => {
  it("combines values inside a filter group with OR and different groups with AND", () => {
    const filters = new Set(["resistance\u0000Fuego", "resistance\u0000Frío", "type\u0000Dragón"]);
    expect(matchesGroupedFilters(filters, { resistance: ["Frío"], type: ["Dragón"] })).toBe(true);
    expect(matchesGroupedFilters(filters, { resistance: ["Ácido"], type: ["Dragón"] })).toBe(false);
    expect(matchesGroupedFilters(filters, { resistance: ["Fuego"], type: ["Bestia"] })).toBe(false);
  });

  it("detects native TaleSpire round boundaries without counting queue edits", () => {
    const items = [
      { id: "a", name: "A", kind: "creature" },
      { id: "b", name: "B", kind: "creature" },
      { id: "c", name: "C", kind: "creature" },
    ];
    expect(calculateTaleSpireRoundDelta({ items, activeItemIndex: 2 }, { items, activeItemIndex: 0 })).toBe(1);
    expect(calculateTaleSpireRoundDelta({ items, activeItemIndex: 0 }, { items, activeItemIndex: 2 })).toBe(-1);
    expect(calculateTaleSpireRoundDelta({ items, activeItemIndex: 0 }, { items, activeItemIndex: 1 })).toBe(0);
    expect(calculateTaleSpireRoundDelta({ items, activeItemIndex: 2 }, { items: items.slice(0, 2), activeItemIndex: 0 })).toBe(0);
  });

  it("matches a rolled initiative to a character even before a client link was persisted", () => {
    const characterCombatant = {
      id: "cmb_11111111111111111111111111111111",
      kind: "player" as const,
      characterId: "chr_11111111111111111111111111111111",
      taleSpireClientId: null,
    };
    const encounter = { combatants: [characterCombatant] } as unknown as Parameters<typeof findPlayerInitiativeCombatant>[0];
    expect(findPlayerInitiativeCombatant(encounter, "client-1", characterCombatant.characterId, null)?.id).toBe(characterCombatant.id);
    expect(findPlayerInitiativeCombatant(encounter, "client-1", null, characterCombatant.characterId)?.id).toBe(characterCombatant.id);
  });

  it("persists notes, tables and Google Docs URL with optimistic concurrency", async () => {
    const repository = new InMemoryCampaignRepository();
    const snapshot = await new CampaignApplication(repository).createCampaign("2026-08-02T12:00:00.000Z");
    const application = new GmWorkspaceApplication(repository);
    const workspace = {
      noteGroups: [{ id: "gmg_11111111111111111111111111111111", title: "Trama", notes: [{ id: "gmn_22222222222222222222222222222222", title: "Pista", content: "Una pista" }] }],
      randomTables: [{ id: "gmt_33333333333333333333333333333333", name: "Clima", entries: ["Sol", "Lluvia"] }],
      googleDocsUrl: "https://docs.google.com/document/d/example/edit",
    };
    const saved = await application.save(workspace, snapshot.checksum, "2026-08-02T12:01:00.000Z");
    expect(saved.campaign.gm).toEqual(workspace);
    expect(saved.campaign.revision).toBe(1);
    await expect(application.save(workspace, snapshot.checksum)).rejects.toThrow();
  });

  it("renders every non-combat GM surface", async () => {
    let savedShopTags: string[] = [];
    const ropeDefinition = normalizeEquipmentDefinition({ name: "Cuerda", weight: 10, cost: { quantity: 1, unit: "gp" }, description: "Una cuerda resistente." });
    const { rarity: _rarity, ...rope } = ropeDefinition;
    const merchant = normalizeMonsterDefinition({
      Id: "npc_mercado",
      Name: "Mercader del mercado",
      Inventory: [{ ...rope, id: "inv_11111111111111111111111111111111", order: 0, group: "backpack", quantity: 2 }],
    });
    const panel = new GmToolsPanel({} as HTMLElement, {
      loadGmContent: async () => ({ spells: [], equipment: [ropeDefinition], monsters: [merchant], shops: [{ name: "Mercado", npcId: merchant.id, categories: {}, tags: ["ciudad", "favorite"] }], checklist: [{ id: "task", text: "Preparar mapa", checked: false }] }),
      saveShop: async (shop) => { savedShopTags = shop.tags ?? []; },
    }, () => undefined, () => undefined, () => undefined);
    await panel.load();
    const workspace = { noteGroups: [], randomTables: [], googleDocsUrl: "" };
    expect(panel.render("content", workspace, "spell")).toContain('data-gm-new="spell"');
    expect(panel.render("content", workspace, "equipment")).toContain('data-gm-new="equipment"');
    const shops = panel.render("content", workspace, "shop");
    expect(shops).toContain('data-gm-new="shop"');
    expect(shops).toContain('data-gm-content-search="shop"');
    expect(shops).toContain('data-gm-filter-group="tag"');
    expect(shops).toContain('data-gm-content-filter-value="ciudad"');
    expect(shops).toContain('data-gm-show-all-content="shop"');
    expect(shops).not.toContain('data-gm-content-filter-value="favorite"');
    expect(shops).toContain('data-gm-favorites-only="shop"');
    expect(shops).toContain('class="favorite-toggle active"');
    expect(shops).toContain("CD negociación");
    expect(shops).toContain("Fondos");
    expect(shops).toContain('class="play-card gm-catalog-card gm-shop-card favorite"');
    const allShops = shops;
    expect(allShops).toContain('data-gm-template="shop" data-gm-content-key="Mercado" title="Crear una copia editable">Clonar</button>');
    expect(allShops).toContain('data-gm-edit="shop" data-gm-content-key="Mercado"');
    expect(allShops).toContain('<span>ciudad</span>');
    expect(allShops).not.toContain('data-gm-form="shop"');
    await (panel as unknown as { toggleFavorite(section: "shop", key: string): Promise<void> }).toggleFavorite("shop", "Mercado");
    expect(savedShopTags).toEqual(["ciudad"]);
    (panel as unknown as { pendingDeleteContent: { section: "shop"; key: string } }).pendingDeleteContent = { section: "shop", key: "Mercado" };
    expect(panel.render("content", workspace, "shop")).toContain("Confirmar eliminación");
    expect(panel.render("notes", workspace)).toContain("Nuevo grupo de notas");
    const tools = panel.render("tools", workspace);
    expect(tools).toContain("Checklist");
    expect(tools).toContain("Tablas");
    expect(tools).toContain("Viaje y salto");
    expect(tools).toContain('data-gm-tool="npc"');
    expect(tools).toContain("Google Docs");
    expect(tools).toContain('data-gm-tool="checklist" class="active"');
    expect(tools).not.toContain('data-gm-add="table"');
    (panel as unknown as { activeTool: string }).activeTool = "tables";
    expect(panel.render("tools", workspace)).toContain('data-gm-add="table"');

    const editable = panel as unknown as {
      editingContent: "shop";
      contentTemplate: { section: "shop"; value: GmShop };
    };
    editable.editingContent = "shop";
    editable.contentTemplate = { section: "shop", value: { name: "COPIA DE Mercado", npcId: merchant.id, categories: {} } };
    const templateForm = panel.render("content", workspace, "shop");
    expect(templateForm).toContain('value="COPIA DE Mercado"');
    expect(templateForm).not.toContain('name="categories"');
    expect(templateForm).toContain("Acciones habilitadas");
    expect(templateForm).toContain('name="commissionPercent"');
    expect(templateForm).toContain('name="intimidationReputationLoss"');
    expect(templateForm).toContain('name="fundsCopper"');
    expect(templateForm).toContain('name="assaultMaxItems"');
    expect(templateForm).toContain('name="assaultMaxWeight"');
    expect(templateForm).toContain("Inventario del comerciante");
    expect(templateForm).toContain('data-gm-shop-inventory-search');
    expect(templateForm).toContain('data-gm-shop-inventory-catalog');
    expect(templateForm).toContain("Cuerda");
    expect(templateForm).toContain('<strong>2</strong>');
    expect(templateForm).toContain("20.0 lb");
    expect(templateForm).toContain("Estadísticas del NPC asociado");
  });

  it("removes a complete note group without altering the other groups", () => {
    const first = { id: "gmg_11111111111111111111111111111111", title: "Primero", notes: [] };
    const second = { id: "gmg_22222222222222222222222222222222", title: "Segundo", notes: [] };
    const workspace = { noteGroups: [first, second], randomTables: [], googleDocsUrl: "" };
    expect(removeGmNoteGroup(workspace, first.id).noteGroups).toEqual([second]);
  });

  it("keeps combatant panels inside the visible interface", () => {
    const nearBottomRight = calculateFloatingPanelPosition(
      { width: 320, height: 480 },
      { left: 270, top: 420, bottom: 465 },
      { width: 390, height: 700 },
    );
    expect(nearBottomRight.left).toBe(6);
    expect(nearBottomRight.top).toBe(6);
    expect(nearBottomRight.maxHeight).toBe(468);
    const normal = calculateFloatingPanelPosition(
      { width: 900, height: 700 },
      { left: 100, top: 100, bottom: 150 },
      { width: 300, height: 250 },
    );
    expect(normal).toMatchObject({ left: 100, top: 154 });
  });

  it("renders independent visual checkboxes for multiple values", () => {
    const html = renderCheckboxGroup("Inmunidades", "immunities", ["fire", "cold"], ["cold"]);
    expect(html).toContain('class="gm-checkbox-group"');
    expect(html).toContain('type="checkbox" name="immunities" value="fire"');
    expect(html).toContain('type="checkbox" name="immunities" value="cold" checked');
    expect(html).not.toContain("<select");
  });

  it("renders linked character state without player actions or inventory", () => {
    const character = createCharacter("chr_44444444444444444444444444444444", "Delerion", "2026-08-08T12:00:00.000Z");
    character.combat.hitPoints = { current: 7, maximum: 12, temporary: 3 };
    character.combat.exhaustion = 1;
    const view = Object.create(GmApp.prototype) as unknown as { renderCharacterDetails(value: typeof character): string };
    const html = view.renderCharacterDetails(character);
    expect(html).toContain("gm-character-overview");
    expect(html).toContain("gm-character-ability-strip");
    expect(html).toContain("Percepción pasiva");
    expect(html).toContain("Salv. muerte");
    expect(html).toContain("Agotamiento");
    expect(html).not.toContain("<header>");
    expect(html).not.toContain("<h4>Acciones</h4>");
    expect(html).not.toContain("<h4>Conjuros</h4>");
    expect(html).not.toContain("<h4>Inventario</h4>");
  });

  it("never exposes merchant stock in monster views or the monster editor", () => {
    const { rarity: _rarity, ...dagger } = normalizeEquipmentDefinition({ name: "Daga de Mirna" });
    const monster = normalizeMonsterDefinition({
      Id: "npc_mirna",
      Name: "Mirna",
      Inventory: [{ ...dagger, id: "inv_55555555555555555555555555555555", order: 0, group: "backpack", quantity: 1 }],
    });
    const view = Object.create(GmApp.prototype) as unknown as {
      runtime: { contentCatalogIsComplete: boolean };
      customSpells: never[];
      renderCustomMonsterView(value: typeof monster): string;
      renderCustomMonsterForm(value: typeof monster): string;
    };
    view.runtime = { contentCatalogIsComplete: true };
    view.customSpells = [];
    const html = `${view.renderCustomMonsterView(monster)}${view.renderCustomMonsterForm(monster)}`;
    expect(html).not.toContain("Daga de Mirna");
    expect(html).not.toContain("Inventario");
  });

  it("renders persistent GM color controls and a scoped action log", () => {
    const view = Object.create(GmApp.prototype) as {
      gmColor: string;
      undoStack: unknown[];
      redoStack: unknown[];
      actionLog: { id: number; label: string; occurredAt: string; kind: "action" }[];
      renderColorPicker(): string;
      renderActionHistoryControls(): string;
    };
    view.gmColor = "#6f96c4";
    view.undoStack = [{}];
    view.redoStack = [];
    view.actionLog = [{ id: 1, label: "Aplicar daño", occurredAt: "2026-08-02T12:34:56.000Z", kind: "action" }];
    expect(view.renderColorPicker()).toContain('data-gm-color-value="#6f96c4"');
    expect(view.renderColorPicker()).toContain('id="gm-interface-color"');
    const history = view.renderActionHistoryControls();
    expect(history).toContain('data-gm-history="undo"');
    expect(history).toContain("Aplicar daño");
    expect(history).not.toContain("Último log");
  });
});
