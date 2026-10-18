import { describe, expect, it } from "vitest";
import { emptyEquipmentDefinition } from "../../src/domain/equipment/equipment-preparation";
import { simpleEquipmentReplacementIssues } from "../../src/domain/equipment/equipment-retirement";

function destination() {
  const d = emptyEquipmentDefinition("abacus-es", "Ábaco");
  d.category = "adventuring-gear"; d.magical = false;
  d.economy.basePrice = { quantity: 2, unit: "gp" }; d.weight = { value: 2, unit: "lb" };
  d.review.identity = true; d.review.editorial = true;
  d.sources = [{ id: "source", kind: "srd", language: "es", rulesEdition: "2014", title: "SRD", locator: "official table", verified: true }];
  d.description = [{ id: "data", type: "paragraph", section: "rules", provenance: "official-spanish", sourceIds: ["source"], text: "Datos de la tabla." }];
  return d;
}
const source = () => ({ name: "Abacus", index: "abacus", cost: { quantity: 2, unit: "gp" }, weight: 2, equipment_category: { index: "adventuring-gear", name: "Adventuring Gear" } });
describe("narrow information audit before retiring table-only duplicates", () => {
  it("accepts matching table data without requiring unrelated special-power automation", () => {
    expect(destination().review.information).toBe(false);
    expect(simpleEquipmentReplacementIssues(source(), destination())).toEqual([]);
  });
  it("keeps English prose, nested descriptions and unexpected custom powers for further review", () => {
    for (const change of [{ desc: ["An extra power."] }, { description: { text: "Extra" } }, { bonus: [{ value: 1 }] }, { contents: [{ quantity: 1 }] }, { capacity: "500 lb." }, { gear_category: { index: "gear", extra: "Extra power" } }]) {
      expect(simpleEquipmentReplacementIssues({ ...source(), ...change }, destination()).length).toBeGreaterThan(0);
    }
  });
  it("does not erase missing weights, campaign prices, monetary units or unknown zero values", () => {
    const noWeight = destination(); noWeight.weight = null;
    expect(simpleEquipmentReplacementIssues(source(), noWeight)).toContain("Peso diferente o incompleto.");
    expect(simpleEquipmentReplacementIssues({ ...source(), weight: 0 }, destination())).toContain("Peso diferente o incompleto.");
    expect(simpleEquipmentReplacementIssues({ ...source(), cost: { quantity: 2, unit: "sp" } }, destination())).toContain("Precio diferente o incompleto.");
  });
  it("requires verified identity, a Spanish presentation and an official edition-2014 source", () => {
    for (const change of [
      { magical: true }, { sources: [] }, { description: [] },
      { review: { ...destination().review, identity: false } },
    ]) expect(simpleEquipmentReplacementIssues(source(), { ...destination(), ...change }).length).toBeGreaterThan(0);
  });
  it("compares all armor restrictions and fails when a magic bonus or stealth restriction changes", () => {
    const d=destination(); d.category="armor";
    d.armor={ category:"medium", baseArmorClass:14, dexterity:"capped", dexterityCap:2, strengthMinimum:null, stealthDisadvantage:true, armorClassBonus:0 };
    const s={...source(), equipment_category:{index:"armor"}, armor_category:"Medium", armor_class:{base:14,dex_bonus:true,max_bonus:2},str_minimum:0,stealth_disadvantage:true};
    expect(simpleEquipmentReplacementIssues(s,d)).toEqual([]);
    for (const change of [{armorClassBonus:1},{stealthDisadvantage:false},{dexterityCap:null},{strengthMinimum:13}]) {
      expect(simpleEquipmentReplacementIssues(s,{...d,armor:{...d.armor,...change}})).toContain("Estadísticas de armadura diferentes.");
    }
    expect(simpleEquipmentReplacementIssues({...s,armor_class:{...s.armor_class,special:"flight"}},d)).toContain("Perfil de armadura desconocido.");
  });
});
