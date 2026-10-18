import { describe, expect, it } from "vitest";
import reviewed from "../../docs/v2/equipment-preparation-2026-10-17/arms-reviewed-definitions.json";
import evidence from "../../docs/v2/equipment-preparation-2026-10-17/arms-source-review.json";
import extension from "../../docs/v2/equipment-preparation-2026-10-17/arms-extension-reviewed-definitions.json";
import extensionEvidence from "../../docs/v2/equipment-preparation-2026-10-17/arms-extension-source-review.json";
import { EquipmentDefinitionDraftSchema, equipmentCompletionIssues } from "../../src/domain/equipment/equipment-definition";
import { equipmentReviewPolicy } from "../../src/domain/equipment/equipment-policy";

const definitions = reviewed.map((d) => EquipmentDefinitionDraftSchema.parse(d));
const get = (name: string) => definitions.find((d) => d.name === name)!;
describe("source-reviewed mundane arms and numerical magic variants", () => {
  it("models nets as weapons that deal no damage and keeps their complete escape rules", () => {
    const nets = extension.map((d) => EquipmentDefinitionDraftSchema.parse(d)).filter((d) => d.name.startsWith("Red"));
    expect(nets).toHaveLength(4);
    for (const net of nets) {
      expect(net.weapon).toMatchObject({ damageMode: "none", baseDamage: [], damageBonus: 0, thrown: true, rangeFeet: { normal: 5, long: 15 } });
      expect(net.description.find((b) => b.id === "net-special")).toMatchObject({ text: expect.stringContaining("Infligir 5 de daño cortante a la red (CA 10)") });
      expect(net.description.find((b) => b.id === "net-special")).toMatchObject({ text: expect.stringContaining("solo podrás realizar un ataque") });
      expect(net.capabilities[0]!.effects[0]).toMatchObject({ kind: "condition", conditionKey: "restrained" });
      expect(net.review.mechanics).toBe(false);
      expect(equipmentCompletionIssues(net, equipmentReviewPolicy(net)).join(" ")).not.toContain("Falta el daño base");
    }
    expect(nets.find((d) => d.name === "Red +3")!.weapon!.attackBonus).toBe(3);
  });
  it("repairs the malformed greataxe index using explicit source fields instead of its name alone", () => {
    const value = EquipmentDefinitionDraftSchema.parse(extension.find((d) => d.name === "Hacha a dos manos +1"));
    expect(value.weapon).toMatchObject({ attackBonus: 1, damageBonus: 1 });
    expect(value.review.unresolved.join(" ")).toContain("toHitBonus=1 y damageBonus=1");
    expect(extensionEvidence.sourceChecks.find((s) => s.id === value.id)).toMatchObject({ index: "greataxe", repairedIndex: true, enhancement: 1 });
  });
  it("keeps bonus rarity separate for armor, shields and weapons", () => {
    expect(definitions).toHaveLength(evidence.sourceChecks.length);
    expect(get("Hacha a dos manos +1")).toMatchObject({ magical: true, rarity: "uncommon", weapon: { attackBonus: 1, damageBonus: 1 }, economy: { basePrice: null } });
    expect(get("Coraza +1")).toMatchObject({ rarity: "rare", armor: { armorClassBonus: 1 }, requirements: { attunement: false } });
    expect(get("Escudo +3")).toMatchObject({ rarity: "very-rare", armor: { baseArmorClass: 2, armorClassBonus: 3 } });
    expect(get("Coraza +3").rarity).toBe("legendary");
    expect(get("Hacha a dos manos")).toMatchObject({ magical: false, rarity: "none", economy: { basePrice: { quantity: 30, unit: "gp" } } });
  });
  it("preserves versatile dice, thrown range, fractional weight and reach separately", () => {
    expect(get("Martillo de guerra").weapon!.baseDamage).toMatchObject([{ expression: "1d8", timing: "base" }, { expression: "1d10", timing: "versatile" }]);
    expect(get("Dardo")).toMatchObject({ weight: { value: 0.25, unit: "lb" }, weapon: { meleeReachFeet: null, rangeFeet: { normal: 20, long: 60 }, thrown: true } });
    expect(get("Guja").weapon!.meleeReachFeet).toBe(10);
    expect(get("Honda").weight).toBeNull();
    expect(get("Honda").weapon!.rangeFeet).toEqual({ normal: 30, long: 120 });
  });
  it("includes complete 2014 property rules and the mounted lance exception", () => {
    const heavy = get("Hacha a dos manos").description.find((b) => b.id === "property-heavy");
    expect(heavy).toMatchObject({ text: expect.stringContaining("criaturas Pequeñas") });
    const crossbow = get("Ballesta pesada").description.find((b) => b.id === "property-loading");
    expect(crossbow).toMatchObject({ text: expect.stringContaining("una unidad de munición") });
    const lance = get("Lanza de caballería");
    expect(lance.description.find((b) => b.id === "lance-special")).toMatchObject({ text: expect.stringContaining("si no estás sobre una montura") });
    expect(lance.review.mechanics).toBe(false);
    expect(lance.capabilities[0]!.effects).toMatchObject([{ defense: "disadvantage", condition: expect.stringContaining("5 pies") }, { kind: "unmodeled" }]);
  });
  it("retains full armor descriptions, negative Dexterity rules, donning and requirements", () => {
    const plate = get("Armadura de placas");
    expect(plate.armor).toMatchObject({ baseArmorClass: 18, dexterity: "none", strengthMinimum: 15, stealthDisadvantage: true });
    expect(plate.description.find((b) => b.id === "armor-material")).toMatchObject({ text: expect.stringContaining("yelmo con visor") });
    expect(plate.description.find((b) => b.id === "armor-category")).toMatchObject({ text: expect.stringContaining("tampoco te penalizarán") });
    expect(plate.description.find((b) => b.id === "donning-doffing")).toMatchObject({ rows: [["10 minutos", "5 minutos"]] });
    expect(get("Camisa de malla").armor).toMatchObject({ baseArmorClass: 13, dexterity: "capped", dexterityCap: 2, stealthDisadvantage: false });
    const chain = get("Cota de malla").description.find((b) => b.id === "armor-material");
    expect(chain).toMatchObject({ text: expect.stringContaining("Esta cota incluye guanteletes.") });
    expect(JSON.stringify(chain)).not.toContain("Armadura de bandas");
  });
  it("keeps ambiguous identities out and does not certify field recovery or platform support", () => {
    for (const skip of evidence.skipped) expect(definitions.some((d) => d.id === skip.id)).toBe(false);
    expect(evidence.skipped.some((s) => s.index === "greataxe" && s.name.includes("+1"))).toBe(true);
    expect(get("Arco largo").review.unresolved.join(" ")).toContain("copia con coincidencia de nombre ambigua");
    for (const d of definitions) {
      expect(d.review.information).toBe(false);
      expect(d.sources.some((s) => s.id === "srd-5.1-attribution")).toBe(true);
      const issues = equipmentCompletionIssues(d, equipmentReviewPolicy(d));
      expect(issues.join(" ")).toContain("integrado");
      expect(issues.some((i) => /inexistente|repetidos|Faltan las estadísticas/.test(i))).toBe(false);
    }
  });
});
