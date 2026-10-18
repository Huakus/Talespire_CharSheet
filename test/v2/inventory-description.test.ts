import { describe, expect, it } from "vitest";
import { Window } from "happy-dom";
import reviewed from "../../docs/v2/equipment-preparation-2026-10-17/used-equipment-reviewed-definitions.json";
import { EquipmentDefinitionDraftSchema } from "../../src/domain/equipment/equipment-definition";
import { bindReviewedEquipment } from "../../src/domain/equipment/equipment-live";
import { CharacterInventoryItemV2Schema, type InventoryFeature } from "../../src/domain/character/character-inventory-model";
import { normalizeEquipmentDefinition } from "../../src/domain/equipment/equipment-catalog";
import { createCharacter } from "../../src/domain/character/create-character";
import { BrowserApp } from "../../src/ui/browser-app";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { inventorySupplementalText, inventoryPlayerText } from "../../src/ui/inventory-description";
import { SRD_51_ATTRIBUTION } from "../../src/domain/equipment/equipment-attribution";
import { inventoryViewMatchesBasicFilter } from "../../src/ui/inventory-view";
import { equipmentPropertyLabel } from "../../src/domain/equipment/equipment-constants";

function fixture() {
  const character = createCharacter("chr_11111111111111111111111111111111", "Prueba", "2026-10-18T18:00:00.000Z");
  const definition = EquipmentDefinitionDraftSchema.parse(reviewed.find(d => d.name === "Poción de curación"));
  const rule = definition.description.find(b => b.type === "paragraph")!;
  if (rule.type !== "paragraph") throw Error("fixture");
  const item = bindReviewedEquipment(CharacterInventoryItemV2Schema.parse({ ...normalizeEquipmentDefinition({name: definition.name}), id: "inv_11111111111111111111111111111111", order: 0, group: "Mochila", quantity: 2 }), definition);
  const feature = item.features[0]!;
  feature.description = `${rule.text}\n\n${rule.text}\n\nUna aclaración propia del portador.`;
  item.features.push({ ...structuredClone(feature), id: "own-feature", name: "Otro poder", description: "Una aclaración propia del portador.\n\nSolo si el objetivo es un muerto viviente." } as InventoryFeature);
  item.rules!.personalDescription = `${item.description}\n\nGrabado por mi maestro.`;
  item.effect.description = rule.text;
  character.inventory = [item];
  const view = new BrowserApp({} as HTMLElement, new CampaignApplication(new InMemoryCampaignRepository()), { storageLabel: "test", diceRoller: { roll: async () => ({ kind: "rolled", summary: "ok", totals: [6] }) } });
  const harness = view as unknown as { snapshot: { campaign: { characters: Record<string, typeof character> } }; selectedCharacterId: string; showInventoryDescriptions: boolean; renderInventoryPlayCard(c: typeof character, i: typeof item, catalog?: boolean, commerce?: {mode: "buy"; unitPriceCopper: number; selectedQuantity: number; ownedQuantity: number; disabled: boolean}): string; renderInventoryFeatureCapability(i: typeof item, f: InventoryFeature, actionCard: boolean): string };
  harness.snapshot = { campaign: { characters: { [character.id]: character } } }; harness.selectedCharacterId = character.id;
  return { character, item, harness, rule: rule.text };
}
function body(html: string) { const doc = new Window().document; doc.body.innerHTML = html; return doc.body; }

describe("one authoritative rule text per inventory card", () => {
  it("recognizes usable capabilities after the generic Use button has been replaced", () => {
    const {item}=fixture();item.usable=false;expect(inventoryViewMatchesBasicFilter(item,'usable')).toBe(true);
    item.consumable=false;item.features=[];expect(inventoryViewMatchesBasicFilter(item,'usable')).toBe(false);
    expect(equipmentPropertyLabel('Requires Attunement')).toBe('Requiere sintonización');
    expect(equipmentPropertyLabel('  Requires attunement ')).toBe('Requiere sintonización');
    expect(inventoryPlayerText('Una regla.<br>Otra regla.\n\nRequires attunement.')).toBe('Una regla.\nOtra regla.\n\nRequiere sintonización.');
  });
  it("only treats whitespace as equivalent and retains changed costs, signs and restrictions", () => {
    expect(inventorySupplementalText("Bono +1.\n\nBono -1.\n\nBono +1 solo de noche.", ["Bono +1."])).toBe("Bono -1.\n\nBono +1 solo de noche.");
    expect(inventorySupplementalText("Consume 2 cargas.\n\nConsume 3 cargas.", ["Consume 2 cargas."])).toBe("Consume 3 cargas.");
    expect(inventorySupplementalText("Texto\npartido.\n\nTexto partido.")).toBe("Texto\npartido.");
  });
  it("renders rules once and keeps controls without source or notes panels", () => {
    const { character, item, harness, rule } = fixture(), original = structuredClone(item);
    const card = body(harness.renderInventoryPlayCard(character, item));
    expect(card.textContent!.split(rule.split("2d4")[0]!).length - 1).toBe(1);
    expect(card.textContent).not.toContain(SRD_51_ATTRIBUTION);
    expect(card.textContent!.match(/Una aclaración propia del portador\./g)).toHaveLength(1);
    expect(card.textContent).toContain("Solo si el objetivo es un muerto viviente.");
    expect(card.textContent).not.toContain("Grabado por mi maestro.");
    expect(card.querySelector('.inventory-rule-status')).toBeNull();
    expect(card.querySelector('[data-effect-toggle="inventory"]')).not.toBeNull();
    expect(card.querySelectorAll('[data-inventory-feature-action="use"]')).toHaveLength(2);
    expect(card.querySelector('[data-equipment-self-healing]')).not.toBeNull();
    expect(item).toEqual(original);
  });
  it("also deduplicates the merchant preview, without adding activation buttons", () => {
    const { character, item, harness } = fixture();
    const card = body(harness.renderInventoryPlayCard(character, item, false, {mode:"buy", unitPriceCopper:5000, selectedQuantity:0, ownedQuantity:0, disabled:false}));
    expect(card.textContent!.match(/Una aclaración propia del portador\./g)).toHaveLength(1);
    expect(card.querySelector('[data-inventory-feature-action]')).toBeNull();
    expect(card.textContent).not.toContain("Grabado por mi maestro.");
    expect(card.querySelector('.inventory-rule-status')).toBeNull();
  });
  it("does not repeat a table's rules as plain text in a capability", () => {
    const { character, item, harness } = fixture();
    const table = EquipmentDefinitionDraftSchema.parse(item.rules!.definition).description.find(b => b.type === "table");
    if (!table || table.type !== "table") throw Error("fixture table");
    item.features[0]!.description = table.rows.map(row => row.join(" · ")).join("\n");
    const card = body(harness.renderInventoryPlayCard(character, item));
    expect(card.querySelectorAll('.inventory-rule-table')).toHaveLength(1);
    expect(card.querySelector('.inventory-feature-capability')!.querySelector('.rich-inventory-text')).toBeNull();
    expect(card.querySelector('[data-equipment-self-healing]')).not.toBeNull();
  });
  it("keeps a standalone action readable and hides feature prose with the descriptions switch", () => {
    const { character, item, harness } = fixture();
    expect(body(harness.renderInventoryFeatureCapability(item, item.features[0]!, true)).textContent).toContain("Una aclaración propia del portador.");
    harness.showInventoryDescriptions = false;
    const card = body(harness.renderInventoryPlayCard(character, item));
    expect(card.querySelector('.inventory-description')).toBeNull();
    expect(card.querySelector('.inventory-feature-capability .rich-inventory-text')).toBeNull();
    expect(card.querySelector('[data-inventory-feature-action="use"]')).not.toBeNull();
  });
  it("keeps migration history out of a card without removing rules or controls", () => {
    const { character, item, harness } = fixture();
    item.rules!.pending = ["Migrar la versión antigua; falta conectar su adaptador."];
    item.features[0]!.description += "\n\nResolución asistida: aplicar las condiciones y resultados descritos; el botón registra el gasto cuando corresponda. Las automatizaciones pendientes se detallan en el objeto.";
    const card = body(harness.renderInventoryPlayCard(character, item));
    expect(card.textContent).not.toMatch(/Migrar|versión antigua|adaptador|automatizaciones pendientes|Definición:|revisión/);
    expect(card.textContent).not.toContain("Fuente y notas");
    expect(card.textContent).toContain("Solo si el objetivo es un muerto viviente.");
    expect(card.querySelector('[data-equipment-self-healing]')).not.toBeNull();
    expect(item.rules!.pending).toHaveLength(1);
  });
});
