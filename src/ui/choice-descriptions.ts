import { PHB_SPELLS } from "../domain/character/phb-spells";
import * as fighter from "../domain/character/fighter-builder-catalog";
import * as choices from "../domain/character/phb-fighter-choices";
import * as options from "../domain/character/phb-character-options";
import * as warlock from "../domain/character/warlock-catalog";
import * as wizard from "../domain/character/wizard-catalog";
import * as sorcerer from "../domain/character/sorcerer-catalog";
import * as martial from "../domain/character/martial-catalog";
import * as bard from "../domain/character/bard-catalog";
import * as cleric from "../domain/character/cleric-catalog";
import * as druid from "../domain/character/druid-catalog";
import * as ranger from "../domain/character/ranger-catalog";
import * as rogue from "../domain/character/rogue-catalog";
import * as barbarian from "../domain/character/barbarian-catalog";
import * as xanatharFighter from "../domain/character/xanathar-fighter";
import { BUILDER_CLASS_NAMES, builderClassProfile } from "./builder-class-profile";

interface Description { name: string; description: string; requirements: string }
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
let registry: Map<string, Description[]> | null = null;
function descriptions(): Map<string, Description[]> {
  if (registry) return registry;
  registry = new Map();
  let labels = new Map<string, string>();
  const add = (key: string, value: Description) => { for (const id of new Set([normalize(key), normalize(value.name)])) registry!.set(id, [...registry!.get(id) ?? [], value]); };
  const visit = (value: unknown, key = "", depth = 0): void => {
    if (!value || typeof value !== "object" || depth > 5) return;
    if (Array.isArray(value)) {
      const features = value.filter(v => v && typeof v === "object" && v.name && v.description);
      if (key && features.length) {
        const description = features.map(f => `${f.level ? `Nivel ${f.level} · ` : ""}${f.name}: ${f.description}`).join("\n\n");
        add(key, { name: labels.get(key) ?? key, description, requirements: "" });
        if (key.endsWith("_CORE")) add(key.slice(0, -5).toLowerCase(), { name: key, description, requirements: "" });
      }
      value.forEach(v => visit(v, "", depth + 1)); return;
    }
    const entry = value as Record<string, unknown>;
    const description = entry.description ?? entry.featureDescription ?? (Array.isArray(entry.traits) ? entry.traits.filter(t => typeof t === "string").join("\n") : null);
    if (typeof entry.name === "string" && typeof description === "string" && description) add(key || String(entry.key ?? entry.name), {
      name: entry.name, description,
      requirements: [typeof entry.level === "number" ? `Nivel ${entry.level}` : "", typeof entry.prerequisite === "string" ? ({ spell: "Requiere lanzar conjuros", dex13: "Destreza 13", str13: "Fuerza 13", cha13: "Carisma 13", "int-wis13": "Inteligencia o Sabiduría 13" } as Record<string, string>)[entry.prerequisite] ?? entry.prerequisite : ""].filter(Boolean).join(" · "),
    });
    for (const [child, item] of Object.entries(entry)) visit(item, child, depth + 1);
  };
  [fighter, choices, options, warlock, wizard, sorcerer, martial, bard, cleric, druid, ranger, rogue, barbarian, xanatharFighter].forEach(c => {
    labels = new Map(Object.values(c).flatMap(value => value && typeof value === "object" && !Array.isArray(value)
      ? Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string") : []));
    visit(c);
  });
  for (const [key, name] of Object.entries(BUILDER_CLASS_NAMES)) {
    const profile = builderClassProfile(key as keyof typeof BUILDER_CLASS_NAMES);
    const features = registry.get(key)?.[0]?.description ?? "";
    add(key, { name, description: [`Dado de golpe: d${profile.die}.`, features].filter(Boolean).join("\n\n"), requirements: "" });
  }
  add("champion", { name: "Campeón", description: "Crítico mejorado: los ataques con armas son críticos con 19 o 20. Más adelante obtiene Atleta notable, un segundo estilo, Crítico superior y Superviviente.", requirements: "Guerrero · Nivel 3" });
  add("battle-master", { name: "Maestro de batalla", description: "Aprende maniobras que gastan dados de superioridad. Cada maniobra explica su activación y efecto; los dados se recuperan con descanso corto o largo.", requirements: "Guerrero · Nivel 3" });
  add("eldritch-knight", { name: "Caballero Arcano", description: "Añade trucos y conjuros de mago con Inteligencia y una progresión propia de espacios. La selección distingue los conjuros de escuela restringida y los de escuela libre.", requirements: "Guerrero · Nivel 3" });
  return registry;
}

/** Attach existing rules, never inferred descriptions, before the in-page listboxes are built. */
export function enrichChoiceDescriptions(root: ParentNode): void {
  const catalog = descriptions();
  for (const select of root.querySelectorAll<HTMLSelectElement>("select")) {
    for (const option of select.options) {
      if (!option.value || option.dataset.description) continue;
      const spell = PHB_SPELLS[option.value];
      if (spell && /spell|cantrip|learn|magic|wizard|warlock|cleric|sorcerer|bard|druid|ranger|tome|ritual/i.test(select.name)) {
        option.dataset.description = [spell.description, spell.higherLevels].filter(Boolean).join("\n\n");
        option.dataset.requirements = [`Nivel ${spell.level} · ${spell.school}`, spell.castingTime, spell.range, spell.duration, spell.components, spell.material, spell.concentration ? "Concentración" : "", spell.ritual ? "Ritual" : ""].filter(Boolean).join(" · ");
        continue;
      }
      const candidates = catalog.get(normalize(option.value)) ?? catalog.get(normalize(option.textContent ?? "")) ?? [];
      const label = normalize(option.textContent ?? "");
      const entry = candidates.find(c => label.includes(normalize(c.name))) ?? (candidates.length === 1 ? candidates[0] : undefined);
      if (!entry) continue;
      option.dataset.description = entry.description; option.dataset.requirements = entry.requirements;
    }
  }
}
