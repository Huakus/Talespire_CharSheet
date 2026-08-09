import { z } from "zod";
import type { MonsterDefinition } from "../monsters/monster-catalog";

export const MerchantStateSchema = z.enum(["active", "unconscious", "dead"]);

export const MerchantInteractionSchema = z.object({
  interaction: z.boolean(),
  negotiation: z.boolean(),
  intimidation: z.boolean(),
  barter: z.boolean(),
  loot: z.boolean(),
  steal: z.boolean(),
  assault: z.boolean(),
  plantEvidence: z.boolean(),
  reputation: z.number().int(),
  difficulty: z.number().int(),
  commissionPercent: z.number().finite().min(0).max(100),
  negotiationStep: z.number().finite().min(0).max(100),
  intimidationReputationLoss: z.number().int().nonnegative(),
  fundsCopper: z.number().int().nonnegative(),
  theftsThisInteraction: z.number().int().nonnegative(),
  assaultMaxItems: z.number().int().positive(),
  assaultMaxWeight: z.number().finite().positive(),
  state: MerchantStateSchema,
});

export type MerchantState = z.infer<typeof MerchantStateSchema>;
export type MerchantInteraction = z.infer<typeof MerchantInteractionSchema>;
export type MerchantChallenge = "persuasion" | "intimidation" | "pilfer" | "assault" | "plant-evidence";

export const DEFAULT_MERCHANT_INTERACTION: MerchantInteraction = {
  interaction: true,
  negotiation: true,
  intimidation: true,
  barter: true,
  loot: false,
  steal: false,
  assault: false,
  plantEvidence: false,
  reputation: 0,
  difficulty: 0,
  commissionPercent: 20,
  negotiationStep: 5,
  intimidationReputationLoss: 1,
  fundsCopper: 10_000,
  theftsThisInteraction: 0,
  assaultMaxItems: 3,
  assaultMaxWeight: 20,
  state: "active",
};

export function normalizeMerchantInteraction(value: unknown): MerchantInteraction {
  const source = value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const integer = (key: keyof MerchantInteraction, fallback = 0): number => {
    const parsed = Number(source[key] ?? fallback);
    return Number.isSafeInteger(parsed) ? parsed : fallback;
  };
  const enabled = (key: keyof MerchantInteraction, fallback: boolean): boolean =>
    source[key] === undefined ? fallback : source[key] === true || source[key] === "true" || source[key] === 1;
  const state = MerchantStateSchema.safeParse(source.state);
  return MerchantInteractionSchema.parse({
    interaction: enabled("interaction", true),
    negotiation: enabled("negotiation", true),
    intimidation: enabled("intimidation", true),
    barter: enabled("barter", true),
    loot: enabled("loot", false),
    steal: enabled("steal", false),
    assault: enabled("assault", false),
    plantEvidence: enabled("plantEvidence", false),
    reputation: integer("reputation"),
    difficulty: integer("difficulty"),
    commissionPercent: Math.min(100, Math.max(0, Number(source.commissionPercent ?? 20) || 0)),
    negotiationStep: Math.min(100, Math.max(0, Number(source.negotiationStep ?? 5) || 0)),
    intimidationReputationLoss: Math.max(0, integer("intimidationReputationLoss", 1)),
    fundsCopper: Math.max(0, integer("fundsCopper", 10_000)),
    theftsThisInteraction: Math.max(0, integer("theftsThisInteraction")),
    assaultMaxItems: Math.max(1, integer("assaultMaxItems", 3)),
    assaultMaxWeight: Math.max(0.1, Number(source.assaultMaxWeight ?? 20) || 20),
    state: state.success ? state.data : "active",
  });
}

export function merchantChallengeTarget(
  interaction: MerchantInteraction,
  defenseModifier: number,
  situationalDifficulty = 0,
): number {
  return merchantChallengeBreakdown(interaction, defenseModifier, situationalDifficulty).total;
}

export interface MerchantDifficultyPart {
  label: string;
  value: number;
  explanation: string;
}

export interface MerchantDifficultyBreakdown {
  parts: MerchantDifficultyPart[];
  total: number;
}

export function merchantChallengeBreakdown(
  interaction: MerchantInteraction,
  defenseModifier: number,
  situationalDifficulty = 0,
): MerchantDifficultyBreakdown {
  const parts: MerchantDifficultyPart[] = [
    { label: "Base", value: 10, explanation: "Base de toda interacción" },
    { label: "Reputación", value: -interaction.reputation, explanation: "La reputación se resta: más confianza reduce la CD" },
    { label: "Defensa del NPC", value: Math.trunc(defenseModifier), explanation: "CAR para negociación y asalto; PER para acciones discretas" },
    { label: "Dificultad del comerciante", value: interaction.difficulty, explanation: "Modificador permanente configurado por el GM" },
    { label: "Dificultad de este intento", value: Math.trunc(situationalDifficulty), explanation: "Modificador puntual elegido antes de tirar" },
  ];
  return { parts, total: parts.reduce((sum, part) => sum + part.value, 0) };
}

function normalized(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z]/g, "");
}

function abilityModifier(monster: MonsterDefinition, aliases: readonly string[]): number {
  const match = Object.entries(monster.abilities).find(([key]) => aliases.includes(normalized(key)));
  return Math.floor(((match?.[1] ?? 10) - 10) / 2);
}

export function merchantNpcStatistics(monster: MonsterDefinition): { charisma: number; perception: number } {
  const charisma = abilityModifier(monster, ["cha", "car", "charisma", "carisma"]);
  const perceptionSkill = monster.skills.find((skill) => ["perception", "percepcion"].some((key) => normalized(skill).startsWith(key)));
  const parsedPerception = perceptionSkill?.match(/[+-]?\d+/)?.[0];
  const perception = parsedPerception === undefined
    ? abilityModifier(monster, ["wis", "sab", "wisdom", "sabiduria"])
    : Number(parsedPerception);
  return { charisma, perception: Number.isFinite(perception) ? perception : 0 };
}

export function negotiatedCommission(interaction: MerchantInteraction, success: boolean): number {
  const delta = success ? -interaction.negotiationStep : 0;
  return Math.min(100, Math.max(0, interaction.commissionPercent + delta));
}

export function intimidatedCommission(interaction: MerchantInteraction, success: boolean): number {
  const delta = success ? -interaction.negotiationStep * 2 : 0;
  return Math.min(100, Math.max(0, interaction.commissionPercent + delta));
}

export function merchantAfterPersuasion(interaction: MerchantInteraction, success: boolean): MerchantInteraction {
  return { ...interaction, commissionPercent: negotiatedCommission(interaction, success) };
}

export function merchantAfterIntimidation(interaction: MerchantInteraction, success: boolean): MerchantInteraction {
  const reputationLoss = interaction.intimidationReputationLoss * (success ? 1 : 2);
  return {
    ...interaction,
    commissionPercent: intimidatedCommission(interaction, success),
    reputation: interaction.reputation - reputationLoss,
  };
}

export function merchantAfterPilferAttempt(interaction: MerchantInteraction): MerchantInteraction {
  return { ...interaction, reputation: interaction.reputation - 1, theftsThisInteraction: interaction.theftsThisInteraction + 1 };
}

export function merchantAfterPlantAttempt(interaction: MerchantInteraction): MerchantInteraction {
  return { ...interaction, theftsThisInteraction: interaction.theftsThisInteraction + 1 };
}

export function merchantSuspicionDifficulty(interaction: MerchantInteraction): number {
  return Math.max(0, interaction.theftsThisInteraction) * 2;
}

export function merchantAfterAssaultAttempt(interaction: MerchantInteraction): MerchantInteraction {
  return { ...interaction, reputation: interaction.reputation - 5 };
}

const COPPER_BY_UNIT: Record<string, number> = {
  cp: 1, pc: 1, copper: 1, copperpiece: 1, copperpieces: 1, cobres: 1,
  sp: 10, pp: 10, silver: 10, silverpiece: 10, silverpieces: 10, plata: 10,
  ep: 50, pe: 50, electrum: 50, electrumpiece: 50, electrumpieces: 50, electro: 50,
  gp: 100, po: 100, gold: 100, goldpiece: 100, goldpieces: 100, oro: 100,
  platinum: 1_000, ppl: 1_000, platinumpiece: 1_000, platinumpieces: 1_000, platino: 1_000,
};

export function inventoryCostInCopper(cost: { quantity: number; unit: string }): number {
  return Math.max(0, Math.round(cost.quantity * (COPPER_BY_UNIT[normalized(cost.unit)] ?? 1)));
}

export function merchantUnitPriceInCopper(cost: { quantity: number; unit: string }, mode: "buy" | "sell", commissionPercent: number): number {
  const base = inventoryCostInCopper(cost);
  const multiplier = mode === "buy" ? 1 + commissionPercent / 100 : 1 - commissionPercent / 100;
  return Math.max(0, mode === "buy" ? Math.ceil(base * multiplier) : Math.floor(base * multiplier));
}

export function merchantCanPay(interaction: MerchantInteraction, amountCopper: number): boolean {
  return interaction.fundsCopper >= Math.max(0, Math.trunc(amountCopper));
}

export function merchantFundsAfterTrade(interaction: MerchantInteraction, mode: "buy" | "sell", amountCopper: number): number {
  const amount = Math.max(0, Math.trunc(amountCopper));
  if (mode === "sell" && !merchantCanPay(interaction, amount)) throw new RangeError("Fondos insuficientes del comerciante.");
  return mode === "buy" ? interaction.fundsCopper + amount : interaction.fundsCopper - amount;
}

export function merchantPilferTarget(
  interaction: MerchantInteraction,
  perceptionModifier: number,
  item: { cost: { quantity: number; unit: string }; unitWeight: number },
  quantity = 1,
  situationalDifficulty = 0,
): number {
  return merchantPilferBreakdown(interaction, perceptionModifier, item, quantity, situationalDifficulty).total;
}

export function merchantPilferBreakdown(
  interaction: MerchantInteraction,
  perceptionModifier: number,
  item: { cost: { quantity: number; unit: string }; unitWeight: number },
  quantity = 1,
  situationalDifficulty = 0,
): MerchantDifficultyBreakdown {
  const units = Math.max(1, Math.trunc(quantity));
  const valueDifficulty = Math.min(10, Math.ceil(inventoryCostInCopper(item.cost) * units / 1_000));
  const weightDifficulty = Math.min(10, Math.ceil(Math.max(0, item.unitWeight) * units / 5));
  const suspicionDifficulty = merchantSuspicionDifficulty(interaction);
  const base = merchantChallengeBreakdown(interaction, perceptionModifier, situationalDifficulty);
  const parts = [
    ...base.parts,
    { label: "Valor del objeto", value: valueDifficulty, explanation: "Los objetos más valiosos están mejor vigilados" },
    { label: "Peso y cantidad", value: weightDifficulty, explanation: "Más unidades o peso hacen más difícil ocultar la acción" },
    { label: "Sospecha", value: suspicionDifficulty, explanation: "Cada intento discreto previo suma +2 a la CD" },
  ];
  return { parts, total: parts.reduce((sum, part) => sum + part.value, 0) };
}

export function merchantAssaultSelectionAllowed(
  interaction: MerchantInteraction,
  selection: readonly { item: { unitWeight: number }; quantity: number }[],
): boolean {
  const units = selection.reduce((sum, entry) => sum + Math.max(0, Math.trunc(entry.quantity)), 0);
  const weight = selection.reduce((sum, entry) => sum + Math.max(0, entry.item.unitWeight) * Math.max(0, Math.trunc(entry.quantity)), 0);
  return units > 0 && units <= interaction.assaultMaxItems && weight <= interaction.assaultMaxWeight;
}

export function merchantCanBeLooted(interaction: MerchantInteraction): boolean {
  return interaction.interaction && interaction.loot && interaction.state !== "active";
}
