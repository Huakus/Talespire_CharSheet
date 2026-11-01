/** Add an explicit per-level dice increment, retaining any fixed terms. */
export function increaseMatchingDice(base: string, increment: string, times: number): string {
  if (times <= 0) return base;
  const match = increment.trim().match(/^(\d*)d(\d+)$/i);
  if (!match) return base;
  const amount = Number(match[1] || 1) * times, sides = match[2]!;
  let replaced = false;
  const result = base.replace(new RegExp(`(\\d*)d${sides}\\b`, "i"), (_whole, count: string) => {
    replaced = true; return `${Number(count || 1) + amount}d${sides}`;
  });
  return replaced ? result : `${base}${base ? "+" : ""}${amount}d${sides}`;
}
