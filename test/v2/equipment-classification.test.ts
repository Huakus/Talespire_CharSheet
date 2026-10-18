import { describe, expect, it } from "vitest";
import { classifyEquipment, stableEquipmentJson, type EquipmentClassificationRow } from "../../src/domain/equipment/classify-equipment";
import { equipmentTagLabel, visibleEquipmentTags } from "../../src/domain/equipment/equipment-tags";
import { normalizeEquipmentDefinition } from "../../src/domain/equipment/equipment-catalog";
import { inventoryCatalogDefinition, inventoryViewIsVisible, renderSharedInventoryCard } from "../../src/ui/inventory-view";
import { GmToolsPanel } from "../../src/ui/gm-tools-panel";

const row = (key: string, tags: string[], payload: Record<string, unknown> = {}): EquipmentClassificationRow => ({
  content_key: key, name: String(payload.name ?? "Objeto"), origin: "official", tags,
  payload: { name: "Objeto", description: "Una descripción de prueba.", ...payload },
});

describe("equipment classification", () => {
  it("preserves legacy language and personal labels without treating origins as proof of source", () => {
    const input = row("official:equipment:es:one", ["official", "es", "favorite", "tesoro"]);
    const original = structuredClone(input);
    const [result] = classifyEquipment([input]);
    expect(result!.tags).toEqual(expect.arrayContaining([...input.tags, "fuente_pendiente"]));
    expect(input).toEqual(original);
    expect(classifyEquipment([{ ...input, origin: "imported" }])[0]!.tags).not.toContain("custom");
  });

  it("uses declared books and explicitly identified campaign definitions", () => {
    expect(classifyEquipment([row("a", ["es"], { source: "Guía de Xanathar para Todo" })])[0]!.tags).toContain("xanathar");
    expect(classifyEquipment([row("b", ["es", "phb"])])[0]!.tags).toContain("manual_jugador");
    const [custom] = classifyEquipment([row("gm:equipment:ece-collar-hablar-con-los-muertos", ["custom"])]);
    expect(custom!.tags).toContain("custom");
    expect(custom!.tags).not.toContain("fuente_pendiente");
  });

  it("never certifies an English candidate as redundant or safe to delete based on its index", () => {
    const en = row("en", ["eng"], { name: "Core", index: "core", description: "Full rules for this item." });
    const es = row("es", ["es"], { name: "Núcleo", index: "core", description: "" });
    const [candidate] = classifyEquipment([en, es]);
    expect(candidate!.tags).toContain("revisar_equivalencia");
    expect(candidate!.spanishCandidates).toEqual(["es"]);
    const [onlyEnglish] = classifyEquipment([en]);
    expect(onlyEnglish!.tags).toContain("pendiente_traduccion");
    expect(onlyEnglish!.spanishCandidates).toEqual([]);
  });

  it("supports reviewed name correspondences without requiring matching legacy indices", () => {
    const [candidate] = classifyEquipment([row("en", ["eng"], { name: "Lucent Core" }), row("es", ["es"], { name: "Núcleo Luciente" })], [], { "Lucent Core": "Núcleo Luciente" });
    expect(candidate!.spanishCandidates).toEqual(["es"]);
    expect(candidate!.tags).toContain("revisar_equivalencia");
  });

  it("distinguishes editorial problems, ambiguous data and heuristic function clues", () => {
    const [result] = classifyEquipment([row("a", ["es"], { description: '<p>{"name":"interior"}</p> Permite lanzar un conjuro y tiene 3 cargas.', equipment_category: { index: "unknown", name: "Categoría antigua" } })]);
    expect(result!.tags).toEqual(expect.arrayContaining(["revisar_descripcion", "revisar_datos", "revisar_funciones"]));
    expect(result!.tags).not.toContain("descripcion_pendiente");
    expect(classifyEquipment([row("b", ["es"], { description: "" })])[0]!.tags).toContain("descripcion_pendiente");
  });

  it("detects conflicts and local differences without overwriting either version", () => {
    const a = row("a", ["es"], { weight: 1 });
    const b = row("b", ["es"], { weight: 2 });
    expect(classifyEquipment([a, b]).every((r) => r.tags.includes("conflicto_version"))).toBe(true);
    expect(classifyEquipment([a], [{ ...a, payload: { ...a.payload, weight: 2 } }])[0]!.tags).toContain("version_local");
    expect(stableEquipmentJson({ a: 1, b: { c: 2 } })).toBe(stableEquipmentJson({ b: { c: 2 }, a: 1 }));
  });

  it("recomputes generated review tags idempotently while preserving favorites", () => {
    const input = row("es", ["es", "favorite", "revisar_descripcion", "fuente_pendiente"], { source: "Manual del Jugador" });
    const [first] = classifyEquipment([input]);
    expect(first!.tags).not.toContain("revisar_descripcion");
    expect(first!.tags).not.toContain("fuente_pendiente");
    expect(classifyEquipment([{ ...input, tags: first!.tags }])[0]!.tags).toEqual(first!.tags);
  });
});

describe("equipment tags in catalog and possessions", () => {
  it("keeps technical metadata out of display and leaves campaign labels readable", () => {
    expect(visibleEquipmentTags(["es", "official", "legacy", "phb", "manual_jugador", "favorite", "tesoro", "tesoro"])).toEqual(["manual_jugador", "tesoro"]);
    expect(equipmentTagLabel("revisar_descripcion")).toBe("Revisar descripción");
    expect(visibleEquipmentTags(["es", "xge"])).toEqual(["xanathar"]);
  });

  it("resolves identity before name and never guesses between conflicting definitions", () => {
    const a = { ...normalizeEquipmentDefinition({ name: "Daga" }), catalog: { contentKey: "a", origin: "gm" as const, tags: ["custom"], revision: 1 } };
    const b = { ...a, catalog: { ...a.catalog, contentKey: "b", tags: ["fuente_pendiente"] } };
    const { rarity: _rarity, ...owned } = b;
    const item = { ...owned, name: "Mi daga", id: "inv_11111111111111111111111111111111", order: 0, group: "equipment" };
    expect(inventoryCatalogDefinition(item, [a, b])).toBe(b);
    expect(inventoryCatalogDefinition({ ...item, catalog: { ...item.catalog, contentKey: "missing" } }, [a, b])).toBeNull();
    expect(inventoryCatalogDefinition({ ...item, catalog: null, name: "Daga" }, [a, b])).toBeNull();
    expect(inventoryCatalogDefinition({ ...item, catalog: null, name: "Daga" }, [a])).toBe(a);
  });

  it("renders Spanish labels and searches them while filters retain stable keys", async () => {
    const item = { ...normalizeEquipmentDefinition({ name: "Objeto de prueba" }), catalog: { contentKey: "a", origin: "official" as const, tags: ["es", "official", "manual_jugador", "revisar_descripcion"], revision: 0 } };
    const other = { ...normalizeEquipmentDefinition({ name: "Otra definición" }), catalog: { ...item.catalog, contentKey: "b", tags: ["es", "fuente_pendiente"] } };
    const panel = new GmToolsPanel({} as HTMLElement, { loadGmContent: async () => ({ spells: [], equipment: [item, other], monsters: [], shops: [], checklist: [] }) }, () => undefined, () => undefined, () => undefined);
    await panel.load();
    const html = panel.render("content", { noteGroups: [], randomTables: [], googleDocsUrl: "" }, "equipment");
    expect(html).toContain('data-gm-content-filter-value="manual_jugador"');
    expect(html).toContain('>Manual del Jugador</button>');
    expect(html).toContain('<span>Manual del Jugador</span>');
    expect(html).not.toContain('data-gm-content-filter-value="revisar_descripcion"');
    expect(html).not.toContain('data-gm-content-filter-value="es"');
    const state = panel as unknown as { contentFilters: { equipment: Set<string> }; contentSearch: { equipment: string } };
    state.contentFilters.equipment.add("tag\u0000manual_jugador");
    expect(panel.render("content", { noteGroups: [], randomTables: [], googleDocsUrl: "" }, "equipment")).not.toContain(`<strong>${other.name}</strong>`);
    state.contentFilters.equipment.clear();
    state.contentSearch.equipment = "manual del jugador";
    const searched = panel.render("content", { noteGroups: [], randomTables: [], googleDocsUrl: "" }, "equipment");
    expect(searched).toContain(`<strong>${item.name}</strong>`);
    expect(searched).not.toContain(`<strong>${other.name}</strong>`);
    expect(inventoryViewIsVisible(item, { search: "manual del jugador", filters: new Set(), tagFilters: new Set(["manual_jugador"]), rarityFilters: new Set() }, "none", ["manual_jugador"])).toBe(true);
    expect(renderSharedInventoryCard({ item, rarity: "none", rarityLabel: "Sin rareza", categoryTone: "gear", categoryLabel: "Equipo", quantity: 1, headerControlHtml: "", statsHtml: "", descriptionHtml: "", tags: ["revisar_descripcion"], actionsHtml: "" })).not.toContain('<span>Revisar descripción</span>');
  });
});
