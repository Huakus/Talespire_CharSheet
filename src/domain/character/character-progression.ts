import { oathSpells } from "./martial-catalog";
import { CharacterV2Schema,type CharacterV2 } from "./character-v2";
import { CharacterBuilderStateSchema,BUILDER_ABILITIES,type FighterLevelChoice } from "./character-builder-model";
import { buildGuidedCharacter,advanceGuidedCharacter } from "./guided-character-builder";
import { progressionChoices,progressionSpellName,type ProgressionChoice,type ProgressionReplacement } from "./progression-choices";
import { SAVE_DEFINITIONS,SKILL_DEFINITIONS,type SkillKey } from "./character-checks";
import { projectCharacterStatistics } from "./character-projection";
import { rangerCompanionMaximum } from "./ranger-builder";
import { applyWizardBenefits } from "./wizard-builder";
import { wizardCopyDescription, wizardBookDefinition } from "./wizard-catalog";
import { clericDomain,clericDomainSpells } from "./cleric-catalog";
import { druidCircleSpells } from "./druid-catalog";

export interface ProgressionTrait { name: string;description: string;group: string;updated: boolean;uses: string }
export interface ProgressionSpell { name: string;level: number;kind: "Truco"|"Libro"|"Disponible para preparar"|"Siempre preparado"|"Conocido"|"Innato"|"Ritual" }
export interface ProgressionLevel {
  level: number;className: string;subclass: string;decisions: ProgressionChoice[];replacements: ProgressionReplacement[];
  benefits: ProgressionChoice[];traits: ProgressionTrait[];retiredTraits: ProgressionTrait[];spells: ProgressionSpell[];
  studies: ProgressionChoice[];
  hpMaximum: number;hpIncrease: number;proficiency: number;
}
export interface CharacterProgression { className: string;initialLevel: number;levels: ProgressionLevel[];notices: string[] }

type Trait = CharacterV2["traits"][number]["traits"][number];
const traits = (c: CharacterV2|null) => c?.traits.flatMap((g) => g.traits.map((t) => ({ ...t,group: g.title }))) ?? [];
const resetName = (t: Trait) => t.uses.reset === "short-rest" ? "descanso corto/largo" : t.uses.reset === "long-rest" ? "descanso largo" : "sin recuperación automática";
function traitEntry(t: Trait & { group: string },old?: Trait): ProgressionTrait {
  const changed = old && old.uses.maximum !== t.uses.maximum;
  return { name: t.name,description: t.description,group: t.group,updated: !!old,uses: t.uses.maximum > 0 ? `Usos máximos: ${changed ? `${old.uses.maximum} → ` : ""}${t.uses.maximum} · ${resetName(t)}` : changed ? "El límite de usos cambió; consultá el rasgo." : "" };
}
function levelEntry(c: CharacterV2,old: CharacterV2|null,step: FighterLevelChoice|null): ProgressionLevel {
  const state = c.builder!,choices = progressionChoices(state,step),benefits: ProgressionChoice[] = [],before = old ? projectCharacterStatistics(old) : null,after = projectCharacterStatistics(c);
  const change = (label: string,from: number,to: number,suffix = "") => { if (from !== to || !old) benefits.push({ label,value: `${old ? `${from} → ` : ""}${to}${suffix}${old && to > from ? ` (+${to-from})` : ""}` }); };
  change("PG máximos",old?.combat.hitPoints.maximum ?? 0,c.combat.hitPoints.maximum);change("Dados de Golpe",old?.combat.hitDice.maximum ?? 0,c.combat.hitDice.maximum,`d${c.combat.hitDice.dieSize}`);change("Bono de competencia",before?.proficiencyBonus ?? 0,after.proficiencyBonus);
  for (const a of BUILDER_ABILITIES) change(SAVE_DEFINITIONS[a].label,old?.abilities[a] ?? 0,c.abilities[a]);
  for (let n=1;n<=9;n++) { const from = old?.spellcasting.slots[String(n)]?.maximum ?? 0,to = c.spellcasting.slots[String(n)]?.maximum ?? 0;if (from !== to) benefits.push({ label: `${state.classKey === "warlock" ? "Espacios de pacto" : "Espacios de conjuro"} · nivel ${n}`,value: `${from} → ${to}${state.classKey === "warlock" ? " · descanso corto/largo" : " · descanso largo"}` }); }
  for (const [key,s] of Object.entries(c.checks.skills)) { const previous = old?.checks.skills[key as SkillKey].proficiency ?? 0;if (s.proficiency > previous) benefits.push({ label: s.proficiency === 2 ? "Pericia obtenida" : "Competencia obtenida",value: SKILL_DEFINITIONS[key as SkillKey].label }); }
  for (const a of BUILDER_ABILITIES) if (c.checks.savingThrows[a].proficiency > (old?.checks.savingThrows[a].proficiency ?? 0)) benefits.push({ label: "Salvación competente",value: SAVE_DEFINITIONS[a].label });
  for (const [key,label] of [["languages","Idiomas obtenidos"],["tools","Herramientas obtenidas"],["armor","Armaduras competentes"],["weapons","Armas competentes"]] as const) { const values = c.proficiencies[key].filter((s) => !old?.proficiencies[key].includes(s));if (values.length) benefits.push({ label,value: values.join(" · ") }); }
  change("Iniciativa",before?.initiativeModifier ?? 0,after.initiativeModifier);
  if (c.spellcasting.ranger?.companion) change("PG máximos del compañero",old ? rangerCompanionMaximum(old) : 0,rangerCompanionMaximum(c));
  if (!old) { benefits.push({ label: "Equipo inicial recibido",value: c.inventory.map((i) => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join(" · ") });benefits.push({ label: "Dinero inicial restante",value: `${c.currency.gold} po · ${c.currency.silver} pp · ${c.currency.copper} pc` }); }
  const previousTraits = new Map(traits(old).map((t) => [t.id,t])),currentTraits = traits(c),currentIds = new Set(currentTraits.map((t) => t.id));
  const granted = currentTraits.filter((t) => { const p = previousTraits.get(t.id);return !p || p.name !== t.name || p.description !== t.description || p.uses.maximum !== t.uses.maximum || p.uses.reset !== t.uses.reset; }).map((t) => traitEntry(t,previousTraits.get(t.id)));
  const removed = traits(old).filter((t) => !currentIds.has(t.id)).map((t) => traitEntry(t));
  const previousSpells = new Set(old?.spellcasting.spells.map((s) => s.id) ?? []),replacementNames = new Set(choices.replacements.filter((r) => r.label === "Conjuro").map((r) => r.after));
  const domain = clericDomain(state),alwaysPrepared = state.classKey === "paladin" ? oathSpells(state) : domain ? clericDomainSpells(domain,c.identity.level) : druidCircleSpells(state);
  const previousOathSpells = old?.builder?.classKey === "paladin" ? oathSpells(old.builder) : [];
  const spells: ProgressionSpell[] = c.spellcasting.spells.filter((s) => (!previousSpells.has(s.id) || state.classKey === "paladin" && alwaysPrepared.includes(s.casting?.key ?? "") && !previousOathSpells.includes(s.casting?.key ?? "")) && !replacementNames.has(progressionSpellName(s.casting?.key ?? ""))).map((s) => ({ name: s.name,level: s.level,kind: s.level === 0 ? "Truco" : alwaysPrepared.includes(s.casting?.key ?? "") && ["cleric","druid"].includes(s.casting?.kind ?? "") ? "Siempre preparado" : s.casting?.kind === "cleric" || s.casting?.kind === "druid" ? "Disponible para preparar" : s.casting?.kind === "wizard" ? "Libro" : s.casting?.kind === "ritual" ? "Ritual" : s.casting?.kind === "innate" || s.casting?.kind === "at-will" ? "Innato" : "Conocido" }));
  return { level: c.identity.level,className: c.identity.className,subclass: c.identity.subclass,...choices,benefits,traits: granted,retiredTraits: removed,spells,studies: [],hpMaximum: c.combat.hitPoints.maximum,hpIncrease: c.combat.hitPoints.maximum-(old?.combat.hitPoints.maximum ?? 0),proficiency: after.proficiencyBonus };
}

/** Replay only saved tutorial choices. Never apply daily/runtime state or write to a campaign. */
export async function projectCharacterProgression(input: CharacterV2): Promise<CharacterProgression|null> {
  const source = CharacterV2Schema.parse(input);if (!source.builder) return null;
  const state = CharacterBuilderStateSchema.parse(source.builder),creation = { ...state.creation,startingLevel: 1 };
  let current = await buildGuidedCharacter(source.id,state.creationOperationId,creation,source.metadata.createdAt);
  const levels = [levelEntry(current,null,null)];
  // Copies can be prerequisites for later mastery/signature choices. They carry
  // their own recorded class level, so introduce them only after that level's grants.
  const introduceCopies = async () => {
    if (!current.spellcasting.wizard) return;
    const copies = (source.spellcasting.wizard?.copied ?? []).filter((s) => s.level === current.identity.level);if (!copies.length) return;
    levels.at(-1)!.studies = copies.map((s) => ({ label: "Copia al libro",value: wizardBookDefinition(s.key,copies)?.name ?? progressionSpellName(s.key),description: `${wizardCopyDescription(s)}. Registrada durante este nivel, fuera de las incorporaciones gratuitas del tutorial.` }));
    current.spellcasting.wizard.copied.push(...structuredClone(copies));current.spellcasting.wizard.book = [...new Set([...current.spellcasting.wizard.book,...copies.map((s) => s.key)])];current = await applyWizardBenefits(current,current);
  };
  await introduceCopies();
  for (const step of state.levels) { const previous = current;current = await advanceGuidedCharacter(previous,step,source.metadata.createdAt);levels.push(levelEntry(current,previous,step));await introduceCopies(); }
  const notices: string[] = [];
  if (source.identity.level !== current.identity.level) notices.push(`El historial llega a nivel ${current.identity.level}; la ficha indica nivel ${source.identity.level}.`);
  if (BUILDER_ABILITIES.some((a) => source.abilities[a] !== current.abilities[a]) || source.combat.hitPoints.maximum !== current.combat.hitPoints.maximum) notices.push("La ficha actual tiene atributos o PG máximos distintos de los otorgados por el tutorial. Aquí se muestra el recorrido original.");
  return { className: current.identity.className,initialLevel: state.creation.startingLevel,levels,notices };
}
