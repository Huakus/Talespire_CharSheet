import { describe, expect, it } from "vitest";
import { Window } from "happy-dom";
import originals from "../../docs/v2/equipment-completion-2026-10-19/healing-potion-definitions.json";
import { EquipmentDefinitionDraftSchema } from "../../src/domain/equipment/equipment-definition";
import { equipmentVariantDescription } from "../../src/domain/equipment/equipment-variant-description";
import { bindReviewedEquipment } from "../../src/domain/equipment/equipment-live";
import { refreshEquipmentEditorialDefinition, refreshEquipmentHealingExecution } from "../../src/domain/equipment/equipment-editorial-refresh";
import { inventoryHealingExpression } from "../../src/domain/equipment/equipment-healing";
import { CharacterInventoryItemV2Schema } from "../../src/domain/character/character-inventory-model";
import { normalizeEquipmentDefinition } from "../../src/domain/equipment/equipment-catalog";
import { createCharacter } from "../../src/domain/character/create-character";
import { useInventoryHealingFeature } from "../../src/domain/character/character-inventory";
import { BrowserApp } from "../../src/ui/browser-app";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";

const definitions = originals.map(d => EquipmentDefinitionDraftSchema.parse(d));
const now = "2026-10-19T12:00:00.000Z";
function fixture(index: number) {
  const definition = definitions[index]!;
  const item = bindReviewedEquipment(CharacterInventoryItemV2Schema.parse({ ...normalizeEquipmentDefinition({ name: definition.name }), id: "inv_11111111111111111111111111111111", order: 4, group: "Cinturón", quantity: 2 }), definition);
  const character = createCharacter("chr_11111111111111111111111111111111", "Prueba", now);
  character.combat.hitPoints = { current: 1, maximum: 200, temporary: 3 };
  character.inventory = [item];
  const view = new BrowserApp({} as HTMLElement, new CampaignApplication(new InMemoryCampaignRepository()), { storageLabel: "test", diceRoller: { roll: async () => ({ kind: "rolled", summary: "ok", totals: [6] }) } }) as unknown as {
    snapshot: { campaign: { characters: Record<string, typeof character> } }; selectedCharacterId: string;
    renderInventoryPlayCard(c: typeof character, i: typeof item, catalog?: boolean, commerce?: { mode: "buy"; unitPriceCopper: number; selectedQuantity: number; ownedQuantity: number; disabled: boolean }): string;
  };
  view.snapshot = { campaign: { characters: { [character.id]: character } } }; view.selectedCharacterId = character.id;
  return { definition, item, character, view };
}
function body(html: string) { const doc = new Window().document; doc.body.innerHTML = html; return doc.body; }

describe("healing potions retain their distinct identity and only show their own healing", () => {
  it.each([0, 1, 2, 3])("filters the legacy family table in all three card contexts (%s)", index => {
    const { definition, item, character, view } = fixture(index), before = structuredClone(item);
    const expression = inventoryHealingExpression(item, item.features[0]!.id)!;
    const rows = equipmentVariantDescription(definition).flatMap(b => b.type === "table" ? b.rows : []);
    expect(rows).toHaveLength(1); expect(rows[0]![2]!.replace(/\s/g, "")).toBe(expression.replace(/\s/g, ""));
    for (const card of [view.renderInventoryPlayCard(character, item), view.renderInventoryPlayCard(character, item, true), view.renderInventoryPlayCard(character, item, false, {mode: "buy", unitPriceCopper: 5000, selectedQuantity: 0, ownedQuantity: 0, disabled: false})]) {
      const dom = body(card);
      expect(dom.querySelectorAll(".inventory-rule-table tbody tr")).toHaveLength(1);
      for (const other of ["2d4+2", "4d4+4", "8d4+8", "10d4+20"].filter(x => x !== expression.replace(/\s/g, ""))) expect(dom.textContent!.replace(/\s/g, "")).not.toContain(other);
    }
    expect(item).toEqual(before);
  });
  it.each([[0, 4], [1, 8], [2, 16], [3, 30]])("uses the corresponding healing formula and consumes exactly one dose (%s)", (index, total) => {
    const { item, character } = fixture(index);
    const next = useInventoryHealingFeature(character, item.id, item.features[0]!.id, total, { expectedRevision: character.revision, updatedAt: now });
    expect(next.combat.hitPoints).toEqual({ current: 1 + total, maximum: 200, temporary: 3 });
    expect(next.inventory[0]!.quantity).toBe(1);
    expect(character.inventory[0]!.quantity).toBe(2);
  });
  it("publishes the corrected table without losing copy state or personal feature text", () => {
    const { definition, item } = fixture(0), table = definition.description.find(b => b.type === "table")!;
    if (table.type !== "table") throw Error("fixture");
    item.features[0]!.description = table.rows.map(row => row.join(" · ")).join("\n") + "\n\nEtiqueta de mi sanador.";
    const before = structuredClone(item), nextDefinition = { ...definition, revision: definition.revision + 1, description: equipmentVariantDescription(definition) };
    const next = refreshEquipmentEditorialDefinition(item, nextDefinition, item.name, null);
    expect(next.features[0]!.description).toContain("Etiqueta de mi sanador.");
    expect(next.features[0]!.description).not.toContain("10d4");
    for (const key of Object.keys(item).filter(k => !["rules", "description", "features"].includes(k))) expect(next[key as keyof typeof next]).toEqual(item[key as keyof typeof item]);
    expect(next.rules!.original).toEqual(item.rules!.original);
    expect(next.features.map(({description, ...rest}) => rest)).toEqual(item.features.map(({description, ...rest}) => rest));
    expect(item).toEqual(before);
  });
  it("leaves ambiguous or non-healing family tables untouched", () => {
    const { definition } = fixture(0), ambiguous = structuredClone(definition);
    const healing = ambiguous.capabilities[0]!.effects[0]!;
    if (healing.kind !== "healing") throw Error("fixture");
    ambiguous.capabilities[0]!.effects.push({ ...healing, id: "other-healing", expression: "4d4 + 4" });
    expect(equipmentVariantDescription(ambiguous)).toBe(ambiguous.description);
    ambiguous.capabilities[0]!.effects = [];
    expect(equipmentVariantDescription(ambiguous)).toBe(ambiguous.description);
  });
  it("can reconcile only the verified healing adapter without changing mechanics or counters", () => {
    const {definition,item} = fixture(0), native = structuredClone(definition);
    native.capabilities[0]!.execution = {mode: "automatic", handler: "equipment-potion-healing", explanation: "Curación atómica validada.", pendingAutomation: []}; native.revision++;
    item.features[0]!.description += "\n\nUna indicación propia del portador.";
    const next = refreshEquipmentHealingExecution(item,native,item.name,null);
    expect(next.features[0]!.description).toContain("Una indicación propia del portador.");
    expect(next.features[0]!.description).not.toContain("Resolución asistida");
    expect(next.rules!.original).toEqual(item.rules!.original);
    expect(next.features.map(({description,...state})=>state)).toEqual(item.features.map(({description,...state})=>state));
    native.capabilities[0]!.consumeQuantity = 2;
    expect(()=>refreshEquipmentHealingExecution(item,native,item.name,null)).toThrow(/MECHANICS_CHANGED/);
  });
});
