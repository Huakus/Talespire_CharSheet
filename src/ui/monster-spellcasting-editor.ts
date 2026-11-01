import type { MonsterDefinition } from "../domain/monsters/monster-catalog";
import { MonsterSpellcastingSchema, type MonsterSpellcasting } from "../domain/monsters/monster-spellcasting-model";
import { monsterSpellcasting } from "../domain/monsters/monster-spells";
import { editorSection, editorSelect, editorInput } from "./gm-content-editors";

export function renderMonsterSpellcastingEditor(monster: MonsterDefinition | null): string {
  const inferred = monster ? monsterSpellcasting(monster) : null;
  const explicit = monster?.spellcasting;
  const field = (name: string, label: string, value: number | null | undefined, hint: number | null | undefined) => editorInput(name, label, value ?? "", `type="number" step="1" placeholder="${hint ?? "Sin configurar"}"`);
  return editorSection("Conjuración", `<p class="field-help">Los campos vacíos usan datos explícitos del rasgo de conjuración, si existen. No se deduce el nivel del lanzador del VD.</p><div class="gm-editor-grid">${editorSelect("spellcastingAbility", "Característica", [{ value: "strength", label: "Fuerza" }, { value: "dexterity", label: "Destreza" }, { value: "constitution", label: "Constitución" }, { value: "intelligence", label: "Inteligencia" }, { value: "wisdom", label: "Sabiduría" }, { value: "charisma", label: "Carisma" }], explicit?.ability ?? "", "Según rasgo")}${field("spellcastingAttack", "Bono de ataque de conjuro", explicit?.attackBonus, inferred?.attackBonus)}${field("spellcastingDc", "CD de conjuros", explicit?.saveDc, inferred?.saveDc)}${field("spellcastingLevel", "Nivel del lanzador", explicit?.casterLevel, inferred?.casterLevel)}</div>`, { collapsible: true, open: Boolean(monster?.spells.length || explicit) });
}
export function readMonsterSpellcastingEditor(data: FormData, existing?: MonsterDefinition | null): MonsterSpellcasting | undefined {
  if (!data.has("spellcastingAbility")) return existing?.spellcasting;
  const number = (name: string): number | null => {
    const raw = String(data.get(name) ?? "").trim();
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isSafeInteger(value)) throw new Error("Los valores de conjuración deben ser enteros.");
    return value;
  };
  const value = { ability: String(data.get("spellcastingAbility") ?? "") || null, attackBonus: number("spellcastingAttack"), saveDc: number("spellcastingDc"), casterLevel: number("spellcastingLevel") };
  if (Object.values(value).every(v => v === null)) return undefined;
  if (value.saveDc !== null && value.saveDc < 0) throw new Error("La CD de conjuros no puede ser negativa.");
  if (value.casterLevel !== null && (value.casterLevel < 1 || value.casterLevel > 30)) throw new Error("El nivel del lanzador debe estar entre 1 y 30.");
  return MonsterSpellcastingSchema.parse(value);
}
