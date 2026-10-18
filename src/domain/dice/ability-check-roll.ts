import type { DiceRollRequest } from "../../application/ports/dice-roller";

export function validateAbilityCheckRoll(request: DiceRollRequest): void {
  const check = request.abilityCheck;
  if (!check) return;
  if (request.expressions[0]?.toLowerCase().replace(/\s+/g, "") !== "1d20" || request.expressions.slice(1).some(e => /d20/i.test(e)) || !Number.isSafeInteger(check.modifier) || !Number.isInteger(check.minimum) || check.minimum < 1 || check.minimum > 20) throw new Error("Prueba de característica inválida.");
}

/** Select advantage first, then the natural minimum, then modifiers and extra dice. */
export function resolveAbilityCheckRoll(request: DiceRollRequest, totals: number[]): number[] {
  validateAbilityCheckRoll(request);
  if (!request.abilityCheck) return totals;
  if (totals.length !== request.expressions.length || totals.some(n => !Number.isFinite(n)) || totals[0]! < 1 || totals[0]! > 20) throw new Error("La tirada de característica no devolvió todos los resultados válidos.");
  return [Math.max(request.abilityCheck.minimum, totals[0]!) + request.abilityCheck.modifier + totals.slice(1).reduce((sum, n) => sum + n, 0)];
}
