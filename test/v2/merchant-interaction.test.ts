import { describe, expect, it } from "vitest";
import {
  merchantCanBeLooted,
  merchantCanPay,
  merchantAfterAssaultAttempt,
  merchantAfterPlantAttempt,
  merchantAfterIntimidation,
  merchantAfterPersuasion,
  merchantAfterPilferAttempt,
  merchantAssaultSelectionAllowed,
  merchantChallengeTarget,
  merchantChallengeBreakdown,
  merchantPilferBreakdown,
  merchantPilferTarget,
  merchantFundsAfterTrade,
  merchantSuspicionDifficulty,
  merchantNpcStatistics,
  merchantUnitPriceInCopper,
  intimidatedCommission,
  negotiatedCommission,
  normalizeMerchantInteraction,
} from "../../src/domain/commerce/merchant-interaction";
import { reconcileShopInventory } from "../../src/domain/gm/gm-global-content";
import { normalizeMonsterDefinition } from "../../src/domain/monsters/monster-catalog";

describe("merchant interactions", () => {
  it("applies reputation, merchant defense, base difficulty and attempt difficulty", () => {
    const merchant = normalizeMerchantInteraction({ reputation: 3, difficulty: 2 });
    expect(merchantChallengeTarget(merchant, 4)).toBe(13);
    expect(merchantChallengeTarget(merchant, 6, 5)).toBe(20);
    expect(merchantChallengeTarget(merchant, 6, -2)).toBe(13);
    expect(merchantChallengeBreakdown(merchant, 6, 5)).toEqual({
      parts: [
        { label: "Base", value: 10, explanation: "Base de toda interacción" },
        { label: "Reputación", value: -3, explanation: "La reputación se resta: más confianza reduce la CD" },
        { label: "Defensa del NPC", value: 6, explanation: "CAR para negociación y asalto; PER para acciones discretas" },
        { label: "Dificultad del comerciante", value: 2, explanation: "Modificador permanente configurado por el GM" },
        { label: "Dificultad de este intento", value: 5, explanation: "Modificador puntual elegido antes de tirar" },
      ],
      total: 20,
    });
  });

  it("only permits looting an enabled unconscious or dead NPC", () => {
    expect(merchantCanBeLooted(normalizeMerchantInteraction({ loot: true, state: "active" }))).toBe(false);
    expect(merchantCanBeLooted(normalizeMerchantInteraction({ loot: true, state: "unconscious" }))).toBe(true);
    expect(merchantCanBeLooted(normalizeMerchantInteraction({ loot: true, state: "dead" }))).toBe(true);
    expect(merchantCanBeLooted(normalizeMerchantInteraction({ interaction: false, loot: true, state: "dead" }))).toBe(false);
  });

  it("keeps the linked NPC inventory as the source of truth without losing known categories", () => {
    expect(reconcileShopInventory(
      { Armas: ["Daga", "Espada"], Objetos: ["Cuerda"] },
      ["Daga", "Daga", "Cuerda", "Gema"],
    )).toEqual({ Armas: ["Daga"], Objetos: ["Cuerda"], Inventario: ["Daga", "Gema"] });
  });

  it("derives merchant defenses from its NPC stat block", () => {
    const npc = normalizeMonsterDefinition({ Name: "Mirna", Abilities: { Cha: 16, Wis: 12 }, Skills: ["Percepción +5"] });
    expect(merchantNpcStatistics(npc)).toEqual({ charisma: 3, perception: 5 });
  });

  it("prices every operation in copper and changes persistent commission after negotiation", () => {
    const merchant = normalizeMerchantInteraction({ commissionPercent: 20, negotiationStep: 5 });
    expect(merchantUnitPriceInCopper({ quantity: 1, unit: "gp" }, "buy", merchant.commissionPercent)).toBe(120);
    expect(merchantUnitPriceInCopper({ quantity: 1, unit: "gp" }, "sell", merchant.commissionPercent)).toBe(80);
    expect(negotiatedCommission(merchant, true)).toBe(15);
    expect(negotiatedCommission(merchant, false)).toBe(20);
    expect(intimidatedCommission(merchant, true)).toBe(10);
    expect(intimidatedCommission(merchant, false)).toBe(20);
    expect(merchantAfterPersuasion({ ...merchant, reputation: 4 }, true)).toMatchObject({ commissionPercent: 15, reputation: 4 });
    expect(merchantAfterIntimidation({ ...merchant, reputation: 4 }, true)).toMatchObject({ commissionPercent: 10, reputation: 3 });
    expect(merchantAfterIntimidation({ ...merchant, reputation: 4 }, false)).toMatchObject({ commissionPercent: 20, reputation: 2 });
    const configuredLoss = normalizeMerchantInteraction({ commissionPercent: 20, negotiationStep: 5, intimidationReputationLoss: 3, reputation: 10 });
    expect(merchantAfterIntimidation(configuredLoss, true)).toMatchObject({ commissionPercent: 10, reputation: 7 });
    expect(merchantAfterIntimidation(configuredLoss, false)).toMatchObject({ commissionPercent: 20, reputation: 4 });
  });

  it("limits sales to merchant funds and moves copper only during trade", () => {
    const merchant = normalizeMerchantInteraction({ fundsCopper: 500 });
    expect(merchantCanPay(merchant, 500)).toBe(true);
    expect(merchantCanPay(merchant, 501)).toBe(false);
    expect(merchantFundsAfterTrade(merchant, "buy", 120)).toBe(620);
    expect(merchantFundsAfterTrade(merchant, "sell", 120)).toBe(380);
    expect(() => merchantFundsAfterTrade(merchant, "sell", 501)).toThrow("Fondos insuficientes");
  });

  it("calculates pilfer difficulty from reputation, value, weight and prior attempts", () => {
    const merchant = normalizeMerchantInteraction({ reputation: 2, difficulty: 1, theftsThisInteraction: 2 });
    const item = { cost: { quantity: 50, unit: "gp" }, unitWeight: 6 };
    expect(merchantPilferTarget(merchant, 4, item, 1)).toBe(24);
    expect(merchantPilferTarget(merchant, 4, item, 2)).toBe(30);
    expect(merchantSuspicionDifficulty(merchant)).toBe(4);
    expect(merchantPilferTarget({ ...merchant, theftsThisInteraction: 3 }, 4, item, 1)).toBe(26);
    expect(merchantPilferBreakdown(merchant, 4, item, 1).parts.slice(-3)).toEqual([
      { label: "Valor del objeto", value: 5, explanation: "Los objetos más valiosos están mejor vigilados" },
      { label: "Peso y cantidad", value: 2, explanation: "Más unidades o peso hacen más difícil ocultar la acción" },
      { label: "Sospecha", value: 4, explanation: "Cada intento discreto previo suma +2 a la CD" },
    ]);
  });

  it("limits free assault loot by both unit count and total weight", () => {
    const merchant = normalizeMerchantInteraction({ assaultMaxItems: 3, assaultMaxWeight: 20 });
    expect(merchantAssaultSelectionAllowed(merchant, [{ item: { unitWeight: 5 }, quantity: 3 }])).toBe(true);
    expect(merchantAssaultSelectionAllowed(merchant, [{ item: { unitWeight: 1 }, quantity: 4 }])).toBe(false);
    expect(merchantAssaultSelectionAllowed(merchant, [{ item: { unitWeight: 11 }, quantity: 2 }])).toBe(false);
    expect(merchantAfterAssaultAttempt({ ...merchant, reputation: 4 }).reputation).toBe(-1);
    expect(merchantAfterPilferAttempt({ ...merchant, reputation: 4, theftsThisInteraction: 2 })).toMatchObject({ reputation: 3, theftsThisInteraction: 3 });
    expect(merchantAfterPlantAttempt({ ...merchant, reputation: 4, theftsThisInteraction: 2 })).toMatchObject({ reputation: 4, theftsThisInteraction: 3 });
  });
});
