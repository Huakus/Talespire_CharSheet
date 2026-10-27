import type { MonsterDefinition } from "../domain/monsters/monster-catalog";
import { MONSTER_SAVES, MONSTER_SKILLS, parseMonsterChecks, serializeMonsterChecks } from "../domain/monsters/monster-checks";
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function renderMonsterChecksEditor(monster: MonsterDefinition | null): string {
  return (["saves", "skills"] as const).map(kind => {
    const parsed = parseMonsterChecks(monster?.[kind] ?? [], kind), choices = kind === "saves" ? MONSTER_SAVES : MONSTER_SKILLS;
    return `<details class="gm-monster-section gm-monster-checks" ${kind === "saves" || Object.keys(parsed.bonuses).length ? "open" : ""}><summary>${kind === "saves" ? "Salvaciones" : "Habilidades"}<small>${Object.keys(parsed.bonuses).length} bonificadores propios</small></summary><div class="gm-monster-section-body"><p class="builder-help">Bonificador final. ${kind === "saves" ? "Vacío: usar el modificador de la característica." : "Vacío: no agregar esta habilidad."}</p><div class="gm-checks-editor-grid">${choices.map(d => `<label>${d.label}<input type="number" step="1" name="monster-${kind}-${d.key}" value="${parsed.bonuses[d.key] ?? ""}" aria-label="${kind === "saves" ? "Salvación" : "Habilidad"}: ${d.label}"></label>`).join("")}</div>${parsed.unparsed.length ? `<label>Entradas importadas por revisar<textarea name="monster-${kind}-unknown">${escape(parsed.unparsed.join("\n"))}</textarea></label>` : ""}</div></details>`;
  }).join("");
}

export function readMonsterChecksEditor(data: FormData, kind: "saves" | "skills"): string[] {
  const choices = kind === "saves" ? MONSTER_SAVES : MONSTER_SKILLS, bonuses: Record<string, number> = {};
  for (const d of choices) {
    const value = String(data.get(`monster-${kind}-${d.key}`) ?? "").trim();
    if (!value) continue;
    const n = Number(value);
    if (!Number.isSafeInteger(n)) throw new Error(`El bonificador de ${d.label} debe ser un entero.`);
    bonuses[d.key] = n;
  }
  return serializeMonsterChecks(bonuses, String(data.get(`monster-${kind}-unknown`) ?? "").split("\n").map(s => s.trim()).filter(Boolean), kind);
}
