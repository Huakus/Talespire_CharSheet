/** Match complete words and numerical signs; punctuation must not hide rule changes. */
export function equipmentRuleTextFingerprint(text: string): string {
  const normalized = text.normalize("NFKD").toLowerCase()
    .replace(/[\u0300-\u036f]/g, "").replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[’']/g, "").replace(/([a-z])-\s+([a-z])/g, "$1$2")
    .replace(/([+-])\s+(?=\d)/g, "$1");
  const tokens = normalized.match(/[+-]?\d+(?:[./]\d+)?%?|[a-z]+/g) ?? [];
  return tokens.length ? "|" + tokens.join("|") + "|" : "";
}

export function primaryEquipmentTextIssues(evidence: {
  englishTextParts: readonly string[]; englishSection: string;
  spanishExpectedParts: readonly string[]; spanishActualParts: readonly string[];
}): string[] {
  const issues: string[] = [], en = equipmentRuleTextFingerprint(evidence.englishSection);
  const es = equipmentRuleTextFingerprint(evidence.spanishActualParts.join(" "));
  if (!en || !es || !evidence.spanishExpectedParts.length) return ["missing-primary-text"];
  if (evidence.englishTextParts.some(p => {
    const text = equipmentRuleTextFingerprint(p); return text && !en.includes(text);
  })) issues.push("English-text-outside-primary-section");
  if (evidence.spanishExpectedParts.some(p => {
    const text = equipmentRuleTextFingerprint(p); return text && !es.includes(text);
  })) issues.push("Spanish-primary-text-not-complete");
  return issues;
}

/** Imported fields outside this known vocabulary need their own recovery review. */
export function unaccountedLegacyEquipmentPaths(value: unknown): string[] {
  const patterns = [
    /^\/(cost)(\/(quantity|unit))?$/,
    /^\/(name|index|rarity|weight|hasCharges|requires_attunement|url|weapon_range|category_range|weapon_category|toHitBonus|damageBonus|attunement|str_minimum|armor_category|stealth_disadvantage|quantity)$/,
    /^\/rarity\/(name|index)$/,
    /^\/(desc|description|special)(\/\d+)?$/,
    /^\/(bonus|properties)$/,
    /^\/bonus\/\d+\/(key|value|category|description)$/,
    /^\/properties\/\d+\/(name|index|url)$/,
    /^\/(equipment_category|gear_category|gearCategory|tool_category)(\/(name|index|url))?$/,
    /^\/(range|throw_range)(\/(normal|long))?$/,
    /^\/(damage|two_handed_damage)(\/damage_dice|\/damage_type(\/(name|index|url))?)?$/,
    /^\/armor_class(\/(base|dex_bonus|max_bonus))?$/,
    /^\/chargesOptions(\/(maxCharges|chargeReset))?$/,
  ];
  const unknown: string[] = [];
  function walk(v: unknown, path: string): void {
    if (v !== null && typeof v === "object" && Object.keys(v).length) {
      for (const [key, child] of Object.entries(v)) walk(child, path + "/" + key);
    } else if (!patterns.some(p => p.test(path))) unknown.push(path);
  }
  walk(value, "");
  return unknown;
}
