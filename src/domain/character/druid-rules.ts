import type { CharacterV2 } from "./character-v2";
export function druidShapeActive(c: CharacterV2) { return c.builder?.classKey === "druid" && !!c.spellcasting.druid?.form; }
export function elapseDruidHours(c: CharacterV2,hours: number) { const form = c.spellcasting.druid?.form;if (form) { form.hoursRemaining = Math.max(0,form.hoursRemaining-hours);if (!form.hoursRemaining) c.spellcasting.druid!.form = null; } }
export function druidFormDamage(c: CharacterV2,amount: number) { const form = c.spellcasting.druid?.form;if (!form) return amount;const excess = Math.max(0,amount-form.currentHp);form.currentHp = Math.max(0,form.currentHp-amount);if (!form.currentHp) c.spellcasting.druid!.form = null;return excess; }
