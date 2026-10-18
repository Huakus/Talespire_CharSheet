import { describe, expect, it } from "vitest";
import definitions from "../../docs/v2/equipment-preparation-2026-10-17/used-equipment-reviewed-definitions.json";
import personalDefinitions from "../../docs/v2/equipment-preparation-2026-10-17/inventory-only-definitions.json";
import { EquipmentDefinitionDraftSchema, type EquipmentDefinitionDraft } from "../../src/domain/equipment/equipment-definition";
import { SRD_51_ATTRIBUTION } from "../../src/domain/equipment/equipment-attribution";
const items = definitions.map((value) => EquipmentDefinitionDraftSchema.parse(value));
const named = (name: string): EquipmentDefinitionDraft => items.find((value) => value.name === name)!;

describe("source-reviewed equipment used by ECE characters and merchants", () => {
  it("preserves inventory-only variants, recovered campaign lore and unresolved Doss rules", () => {
    const personal = personalDefinitions.map((value) => EquipmentDefinitionDraftSchema.parse(value));
    expect(personal).toHaveLength(47);
    const doss = personal.find((value) => value.name.includes("Laúd de Doss"))!;
    expect(doss.requirements.bearer[0]!.keys).toEqual(["bard"]);
    expect(doss.description.some((block) => block.type === "paragraph" && block.text.includes("no se reinstala ese bono"))).toBe(true);
    expect(doss.capabilities.some((capability) => capability.effects.some((effect) => effect.kind === "bonus"))).toBe(false);
    expect(doss.review.unresolved.join(" ")).toContain("regla íntegra");
    const kit = personal.find((value) => value.name.startsWith("Kit de exploración de ruinas"))!;
    expect(kit.description.some((block) => block.type === "paragraph" && block.text.includes("cinceles"))).toBe(true);
    const bag = personal.find((value) => value.name.startsWith("Bolsa conservadora"))!;
    expect(bag.weight).toEqual({ value: 7.5, unit: "kg" });
    expect(bag.description.some((block) => block.type === "paragraph" && block.provenance === "official-spanish" && block.text.includes("Plano Astral"))).toBe(true);
    for (const value of personal) expect(value.review.information).toBe(false);
  });
  it("retains unique stable identities, source attribution in exported data, and explicit migration blockers", () => {
    expect(items).toHaveLength(117);
    expect(new Set(items.map((value) => value.id)).size).toBe(items.length);
    for (const value of items) {
      expect(value.review.editorial).toBe(true);
      expect(value.review.information).toBe(false);
      expect(value.review.unresolved.length).toBeGreaterThan(0);
      if (value.sources.some((source) => /^srd-5\.1-(es|en)-equipment$/.test(source.id))) expect(value.sources.find((source) => source.id === "srd-5.1-attribution")?.locator).toContain(SRD_51_ATTRIBUTION);
      const blocks = new Set(value.description.map((block) => block.id));
      for (const capability of value.capabilities) for (const id of capability.textBlockIds) expect(blocks.has(id)).toBe(true);
    }
  });

  it("distinguishes storing spells without attunement from casting them while attuned", () => {
    const value = named("Anillo de almacenamiento de conjuros");
    expect(value.resources[0]).toMatchObject({ maximum: 5, kind: "spell-storage", recovery: { kind: "none" } });
    expect(value.capabilities[0]).toMatchObject({ requirements: { attunement: false }, concentration: false });
    expect(value.capabilities[1]).toMatchObject({ requirements: { attunement: true, presence: "worn" }, concentration: "spell-dependent" });
  });

  it("keeps the original manual's natural-20 vicious damage and conditional flame-tongue damage", () => {
    const vicious = items.filter((value) => value.capabilities.some((capability) => capability.id === "vicious-natural-20"));
    expect(vicious.length).toBeGreaterThan(0);
    for (const value of vicious) expect(value.capabilities[0]!.effects[0]).toMatchObject({ kind: "damage", expression: "7", timing: "critical" });
    const flame = items.find((value) => value.capabilities.some((capability) => capability.id === "flaming-hit"))!;
    expect(flame.requirements.attunement).toBe(true);
    expect(flame.capabilities[0]!.activation).toBe("bonus-action");
    expect(flame.capabilities[1]!.effects[0]).toMatchObject({ kind: "damage", expression: "2d6", damageType: "fire", timing: "on-hit" });
    expect(flame.capabilities[1]!.effects[0]!.condition).toContain("encendida");
  });

  it("uses actual resource recovery events and preserves spellcaster restrictions", () => {
    const staff = items.find((value) => value.resources.some((resource) => resource.maximum === 3 && resource.recovery.kind === "event" && resource.recovery.amount.kind === "roll" && resource.recovery.amount.expression === "1d3") && value.category === "staff")!;
    expect(staff.requirements.bearer[0]!.keys).toEqual(["warlock", "cleric", "druid"]);
    expect(staff.resources[0]!.recovery).toMatchObject({ event: "dawn", amount: { kind: "roll", expression: "1d3" } });
    const pearl = named("Perla de poder");
    expect(pearl.resources[0]).toMatchObject({ maximum: 1, recovery: { event: "dawn" } });
    expect(pearl.requirements.bearer[0]!.kind).toBe("spellcaster");
    const necklace = named("Collar de hablar con los muertos");
    expect(necklace.origin).toBe("campaign");
    expect(necklace.resources[0]!.recovery).toMatchObject({ event: "long-rest" });
    expect(necklace.capabilities[0]!.effects[0]).toMatchObject({ kind: "spell", ability: "intelligence", components: "waived" });
  });

  it("separates original bundle prices from single arrows and keeps all healing variants", () => {
    const arrow = items.find((value) => value.aliases.includes("Arrow"))!;
    expect(arrow).toBeDefined();
    expect(arrow.weight).toEqual({ value: .05, unit: "lb" });
    expect(arrow.economy.basePrice).toEqual({ quantity: 5, unit: "cp" });
    for (const [name, expression] of [["Poción de curación", "2d4+2"], ["Poción de curación mayor", "4d4+4"], ["Poción de curación superior", "8d4+8"]]) {
      const value = named(name!);
      expect(value.capabilities[0]!.effects[0]).toMatchObject({ kind: "healing", expression });
      expect(value.description.find((block) => block.type === "table")?.rows).toHaveLength(4);
    }
  });

  it("keeps the Stix-only variant and does not invent resolutions for conflicting custom fields", () => {
    const dagger = named("Daga del Umbral · variante de Stix");
    expect(dagger.baseDefinitionId).not.toBeNull();
    expect(dagger.requirements.bearer[0]!.keys).toEqual(["chr_2de8dab74a76cdd8d2b0d37cc84725ea"]);
    expect(dagger.capabilities[0]).toMatchObject({ id: "phase-blade", trigger: expect.stringContaining("20 natural") });
    const amulet = named("Amuleto de la sabiduría");
    expect(amulet.origin).toBe("unknown");
    expect(amulet.review.identity).toBe(false);
    expect(amulet.review.unresolved.join(" ")).toContain("todas las salvaciones");
    expect(named("Sombra del Segador").resources[0]!.recovery.kind).toBe("unknown");
  });
});
