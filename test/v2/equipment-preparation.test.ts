import { describe, expect, it } from "vitest";
import { relatedEquipmentKeys } from "../../src/domain/equipment/equipment-candidates";
import { preparationFromOriginals } from "../../src/domain/equipment/equipment-preparation";
import { captureEquipmentSource } from "../../src/domain/equipment/equipment-recovery";

const at = "2026-10-17T00:00:00.000Z";
describe("preparation from real legacy identities", () => {
  it("preserves translated candidates with different indices without asserting equivalence", async () => {
    const spanish = { key: "es", name: "Núcleo Luciente", index: "nucleo-luciente" };
    const english = { key: "en", name: "Lucent Core", index: "lucent-core" };
    expect(relatedEquipmentKeys(spanish, [spanish, english])).toEqual(["en"]);
    const original = await captureEquipmentSource("ECE", "es", at, { name: spanish.name, tags: ["es"], payload: { desc: "Texto español", index: spanish.index } });
    const en = await captureEquipmentSource("ECE", "en", at, { name: english.name, tags: ["eng"], payload: { desc: "Full English description", index: english.index } });
    const prepared = preparationFromOriginals("draft", original, [original, en], "ECE");
    expect(prepared.payload.originals[1]!.raw.payload).toEqual({ desc: "Full English description", index: "lucent-core" });
    expect(prepared.payload.definition.review.identity).toBe(false);
    expect(prepared.payload.definition.review.unresolved.join(" ")).toContain("no equivalencias confirmadas");
  });

  it("does not silently turn the greataxe index collision into merged rules", () => {
    const primary = { key: "base-en", name: "Greataxe", index: "greataxe" };
    expect(relatedEquipmentKeys(primary, [primary, { key: "magic-es", name: "Gran hacha +1", index: "greataxe" }])).toEqual(["magic-es"]);
    // These are only source candidates. preparationFromOriginals never copies an extra bonus.
  });

  it("makes Stix's dagger a separate campaign variant without changing other copies", async () => {
    const stixKey = "gm:equipment:1b428562-bbef-4bec-8445-a76f7e16f854";
    const baseKey = "gm:equipment:f92abc1a-849e-47e0-995b-0602c7156af8";
    const special = await captureEquipmentSource("ECE", stixKey, at, { name: "Daga del Umbral", tags: ["es"], payload: { description: "Descripción original", features: [{ name: "Hoja Fásica", rolls: [{ expression: "1d6" }], bespokeRule: false }] } });
    const base = await captureEquipmentSource("ECE", baseKey, at, { name: "Daga del Umbral", tags: ["es"], payload: { description: "Descripción original", features: [] } });
    const originals = structuredClone([special, base]);
    const variant = preparationFromOriginals(`recovery:${stixKey}`, special, [special, base], "9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd");
    const common = preparationFromOriginals(`recovery:${baseKey}`, base, [base, special], "9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd");
    expect(variant.payload.definition.baseDefinitionId).toBe(common.payload.definition.id);
    expect(variant.payload.definition.name).toContain("Stix");
    expect(variant.payload.definition.capabilities[0]?.name).toBe("Hoja Fásica");
    expect(common.payload.definition.capabilities).toEqual([]);
    expect(common.payload.definition.name).toBe("Daga del Umbral");
    expect([special, base]).toEqual(originals);
    expect(variant.payload.definition.review.unresolved.join(" ")).toContain("por copia");
    expect(preparationFromOriginals("unrelated", special, [special], "other-campaign").payload.definition.name).toBe("Daga del Umbral");
  });
});
