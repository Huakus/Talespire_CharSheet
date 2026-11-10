import type { RollMode } from "../domain/character/character-checks";

export const EXPERIENCE_THRESHOLDS = [
  0, 300, 900, 2_700, 6_500, 14_000, 23_000, 34_000, 48_000, 64_000,
  85_000, 100_000, 120_000, 140_000, 165_000, 195_000, 225_000, 265_000, 305_000, 355_000,
] as const;

export function experienceProgress(levelInput: number, experienceInput: number): {
  level: number;
  current: number;
  next: number | null;
  percent: number;
} {
  const level = Math.min(20, Math.max(1, Math.trunc(levelInput)));
  const current = Math.max(0, Math.trunc(experienceInput));
  const start = EXPERIENCE_THRESHOLDS[level - 1]!;
  const next = EXPERIENCE_THRESHOLDS[level] ?? null;
  const percent = next === null ? 100 : Math.round(Math.min(1, Math.max(0, (current - start) / (next - start))) * 100);
  return { level, current, next, percent };
}


export function inspiredRollMode(mode: "normal" | "advantage" | "disadvantage"): "normal" | "advantage" {
  return mode === "disadvantage" ? "normal" : "advantage";
}

export function combineRollModes(...modes: RollMode[]): RollMode {
  const advantage = modes.includes("advantage");
  const disadvantage = modes.includes("disadvantage");
  if (advantage === disadvantage) return "normal";
  return advantage ? "advantage" : "disadvantage";
}

export type ManualRollMode = Exclude<RollMode, "normal">;

export interface ManualRollModeState {
  mode: ManualRollMode;
  locked: boolean;
}

export function toggleManualRollMode(current: ManualRollModeState | null, mode: ManualRollMode): ManualRollModeState | null {
  return current?.mode === mode ? null : { mode, locked: false };
}

export function toggleManualRollModeLock(current: ManualRollModeState | null, mode: ManualRollMode): ManualRollModeState | null {
  return current?.mode === mode ? { ...current, locked: !current.locked } : current;
}

export function consumeManualRollMode(current: ManualRollModeState | null): ManualRollModeState | null {
  return current?.locked ? current : null;
}

export function applyCheckConditionDice(expression: string, conditions: ReadonlySet<string>): string {
  return expression + (conditions.has("bless") || conditions.has("guidance") ? "+1d4" : "") + (conditions.has("bane") ? "-1d4" : "");
}
