import { CharacterV2Schema,type CharacterV2 } from "./character-v2";
import { BUILDER_ABILITIES,CharacterBuilderStateSchema,FighterCreationSchema,FighterLevelChoiceSchema,type CharacterBuilderState,type FighterCreationInput,type FighterLevelChoiceInput } from "./character-builder-model";
import { validateBuilderOrigin,fighterBuilderScores,fighterBuilderMaximumHp,createBuilderCharacter,finishBuilderCreation } from "./fighter-builder";
import { builderFeats,distinct,racialSkillGrants,validateFeat } from "./fighter-build-rules";
import { applyAdditionalFighterBenefits } from "./fighter-builder-grants";
import { ROGUE_ARCHETYPES,ROGUE_ASI_LEVELS,ROGUE_CORE,ROGUE_FEATURES,THIEVES_EXPERTISE,THIEVES_TOOLS,rogueArchetype } from "./rogue-catalog";
import { RogueRuntimeSchema } from "./rogue-model";
import { EK_PROGRESSION } from "./phb-fighter-choices";
import { PHB_SPELLS } from "./phb-spells";
import { LANGUAGES,TOOLS,GAMES } from "./phb-character-options";
import { BUILDER_RACES,DWARF_TOOLS } from "./fighter-builder-catalog";
import { CharacterSpellV2Schema } from "./character-spell-model";
import { traitGroup,type TraitDefinition } from "./builder-traits";
import { abilityModifier,projectInventory,projectUpdatedBuilderSpeed,preferredWeaponAbility } from "./character-projection";
import { createDeterministicId } from "../../shared/id";
import { canonicalJsonStringify,type JsonValue } from "../../shared/json";
import type { SkillKey } from "./character-checks";

export function rogueKnownSkills(state: CharacterBuilderState): string[] {
  const c = state.creation;
  return [...c.skills,...c.background.skills,...racialSkillGrants(c),...builderFeats(state).flatMap(({ feat }) => feat.skills),...(rogueArchetype(state) === "scout" ? ["nature","survival"] : [])];
}
export function rogueKnownTools(state: CharacterBuilderState): string[] {
  const c = state.creation;
  return [THIEVES_TOOLS,...c.background.tools,...(c.dwarfTool ? [DWARF_TOOLS[c.dwarfTool]] : []),...(c.race === "rock-gnome" ? ["Herramientas de hojalatero"] : []),...builderFeats(state).flatMap(({ feat }) => feat.tools),...state.levels.flatMap((s) => s.rogue.tools)];
}
export function rogueExpertise(state: CharacterBuilderState): string[] {
  return [...state.creation.rogue.expertise,...state.levels.flatMap((s) => s.rogue.expertise),...builderFeats(state).flatMap(({ feat }) => feat.expertise ? [feat.expertise] : []),...(rogueArchetype(state) === "scout" ? ["nature","survival"] : [])];
}
export const rogueSpellAllowed = (key: string,maxLevel: number,unrestricted: boolean) => {
  const s = PHB_SPELLS[key];
  return !!s && s.classes.includes("wizard") && s.level >= 1 && s.level <= maxLevel && (unrestricted || ["Encantamiento","Ilusión"].includes(s.school));
};
export function replayRogueChoices(state: CharacterBuilderState) {
  const c = state.creation, archetype = rogueArchetype(state), cantrips: string[] = [], spells: Array<{ key: string;unrestricted: boolean }> = [];
  const expertise: string[] = [];
  if (c.rogue.archetype || c.rogue.tools.length || c.rogue.languages.length || c.rogue.cantrips.length || c.rogue.learn.length || c.rogue.replace) throw new Error("En Pícaro 1 se eligen únicamente las dos pericias iniciales.");
  for (const [level,pick] of [[1,c.rogue],...state.levels.map((s) => [s.level,s.rogue] as const)] as const) {
    const current = { ...state,levels: state.levels.filter((s) => s.level <= level) }, prior = { ...state,levels: state.levels.filter((s) => s.level < level) };
    const known = rogueKnownSkills(current), oldExpertise = [...expertise,...builderFeats(current).flatMap(({ feat }) => feat.expertise ? [feat.expertise] : []),...(archetype === "scout" && level >= 3 ? ["nature","survival"] : [])];
    if (pick.expertise.length !== ([1,6].includes(level) ? 2 : 0) || !distinct(pick.expertise) || pick.expertise.some((k) => k !== THIEVES_EXPERTISE && !known.includes(k) || oldExpertise.includes(k))) throw new Error("Elegí dos pericias nuevas en habilidades competentes o herramientas de ladrón, solo en niveles 1 y 6.");
    expertise.push(...pick.expertise);
    if (level === 1) continue;
    if ((level === 3) !== (pick.archetype !== null)) throw new Error("Elegí un arquetipo de Pícaro únicamente en nivel 3.");
    const toolCount = level === 3 ? archetype === "assassin" ? 2 : archetype === "mastermind" ? 3 : 0 : 0;
    const knownTools = rogueKnownTools(prior);
    const requiredTools = archetype === "assassin" ? ["Kit de disfraz","Kit de venenos"] : ["Kit de disfraz","Kit de falsificación"];
    if (pick.tools.length !== toolCount || !distinct([...new Set(knownTools),...pick.tools]) || pick.tools.some((t) => !TOOLS.includes(t))) throw new Error(`Este nivel requiere ${toolCount} competencias nuevas con herramientas; sustituí las que ya tengas.`);
    if (toolCount && pick.tools.some((t,i) => i < 2 ? !knownTools.includes(requiredTools[i]!) && t !== requiredTools[i] : !GAMES.includes(t) && !GAMES.some((g) => knownTools.includes(g)))) throw new Error("Conservá las herramientas del arquetipo; solo las competencias ya conocidas permiten una sustitución.");
    const langs = [...BUILDER_RACES[c.race].languages,...c.languages,...c.background.languages,...builderFeats(current).flatMap(({ feat }) => feat.languages),...prior.levels.flatMap((s) => s.rogue.languages)];
    if (pick.languages.length !== (level === 3 && archetype === "mastermind" ? 2 : 0) || !distinct([...new Set(langs),...pick.languages]) || pick.languages.some((l) => !LANGUAGES.includes(l))) throw new Error("Mente Maestra 3 requiere dos idiomas nuevos distintos.");
    if (archetype !== "arcane-trickster" || level < 3) {
      if (pick.cantrips.length || pick.learn.length || pick.replace) throw new Error("Solo Bribón Arcano a partir de nivel 3 elige magia de pícaro.");
      continue;
    }
    const progression = EK_PROGRESSION[level]!, before = EK_PROGRESSION[level-1], maxLevel = progression.slots.filter(Boolean).length;
    const otherSpells = [...(c.origin.cantrip ? [c.origin.cantrip] : []),...(c.race === "forest-gnome" ? ["minor-illusion"] : c.race === "tiefling" ? ["thaumaturgy"] : c.race === "drow" ? ["dancing-lights"] : []),...builderFeats(current).flatMap(({ feat }) => feat.spells)];
    if (level === 3) cantrips.push("mage-hand");
    const count = level === 3 ? 2 : level === 10 ? 1 : 0;
    if (pick.cantrips.length !== count || !distinct([...cantrips,...pick.cantrips]) || pick.cantrips.some((k) => otherSpells.includes(k) || PHB_SPELLS[k]?.level !== 0 || !PHB_SPELLS[k]?.classes.includes("wizard"))) throw new Error(`Elegí ${count} trucos nuevos de mago; Mano de mago se concede automáticamente.`);
    cantrips.push(...pick.cantrips);
    if (pick.replace) {
      const index = spells.findIndex((s) => s.key === pick.replace!.oldKey), newKey = pick.replace.newKey;
      if (level === 3 || index < 0 || spells.some((s) => s.key === newKey) || otherSpells.includes(newKey) || !rogueSpellAllowed(newKey,maxLevel,spells[index]!.unrestricted)) throw new Error("Sustituí un conjuro conocido por otro nuevo del nivel y escuela permitidos; la excepción de escuela conserva su origen.");
      spells[index] = { ...spells[index]!,key: newKey };
    }
    const quota = progression.known-(before?.known ?? 0), unrestricted = [3,8,14,20].includes(level) ? 1 : 0;
    if (pick.learn.length !== quota || pick.learn.filter((s) => s.unrestricted).length !== unrestricted || !distinct([...spells.map((s) => s.key),...pick.learn.map((s) => s.key)]) || pick.learn.some((s) => otherSpells.includes(s.key) || !rogueSpellAllowed(s.key,maxLevel,s.unrestricted))) throw new Error(`Bribón Arcano ${level}: ${quota} conjuros nuevos; ${unrestricted} de cualquier escuela y el resto de Encantamiento o Ilusión.`);
    spells.push(...pick.learn);
  }
  return { archetype,expertise,cantrips,spells };
}
export function validateRogueCreation(input: FighterCreationInput) {
  const c = FighterCreationSchema.parse(input);
  if (c.classKey !== "rogue") throw new Error("Este recorrido requiere Pícaro.");
  validateBuilderOrigin(c);
  if (c.background.tools.includes(THIEVES_TOOLS)) throw new Error("Pícaro ya concede herramientas de ladrón: reemplazá esa competencia del trasfondo por otra herramienta.");
  replayRogueChoices({ schemaVersion: 1,packageVersion: 1,ruleset: "dnd5e-2014",classKey: "rogue",creationOperationId: "build_00000000000000000000000000000000",creation: c,levels: [] });
  return c;
}
export function validateRogueBuild(input: CharacterBuilderState) {
  const state = CharacterBuilderStateSchema.parse(input);
  if (state.classKey !== "rogue") throw new Error("El historial no corresponde a Pícaro.");
  validateRogueCreation(state.creation);
  for (const [i,step] of state.levels.entries()) {
    if (step.hpBase > 8 || step.hpMethod === "fixed" && step.hpBase !== 5) throw new Error("Pícaro usa 5 PG fijos o un resultado de d8, antes de Constitución.");
    if (step.subclass || step.additionalStyle || step.maneuvers.length || step.maneuverReplacement || step.artisanTool || step.magic.cantrips.length || step.magic.learn.length || step.magic.replace) throw new Error("Pícaro no concede elecciones de Guerrero.");
    const prior = { ...state,levels: state.levels.slice(0,i) };
    if (ROGUE_ASI_LEVELS.includes(step.level)) {
      if (step.skipImprovement) { if (step.feat || step.abilityIncrease) throw new Error("Renunciar requiere dejar las elecciones vacías."); }
      else if (step.feat) {
        if (step.abilityIncrease) throw new Error("Elegí dote o mejora, no ambas.");
        validateFeat(step.feat,fighterBuilderScores(prior),prior);
        const known = replayRogueChoices(prior);
        if (step.feat.spells.some((k) => [...known.cantrips,...known.spells.map((s) => s.key)].includes(k))) throw new Error("La dote debe elegir conjuros que todavía no conozcas.");
      }
      else if (!step.abilityIncrease || Object.values(step.abilityIncrease).reduce((a,b) => a+b,0) !== 2 || Object.values(step.abilityIncrease).some((n) => n > 2)) throw new Error("Distribuí dos puntos de atributo o elegí una dote.");
    } else if (step.feat || step.abilityIncrease || step.skipImprovement) throw new Error("Este nivel no concede mejora de atributos.");
    if (Object.values(fighterBuilderScores({ ...state,levels: state.levels.slice(0,i+1) })).some((n) => n > 20)) throw new Error("Una mejora no puede superar 20.");
  }
  replayRogueChoices(state);
  return state;
}
export async function applyRogueBenefits(input: CharacterV2) {
  const character = CharacterV2Schema.parse(input), state = character.builder!, level = character.identity.level;
  const replay = replayRogueChoices(state), archetype = replay.archetype, runtime = RogueRuntimeSchema.parse(character.spellcasting.rogue ?? {});
  character.identity.className = "Pícaro"; character.identity.subclass = archetype ? ROGUE_ARCHETYPES[archetype] : "";
  runtime.expertise = rogueExpertise(state);
  for (const key of runtime.expertise) if (key !== THIEVES_EXPERTISE) character.checks.skills[key as SkillKey].proficiency = 2;
  if (level >= 15) character.checks.savingThrows.wisdom.proficiency = 1;
  character.proficiencies.tools = [...new Set([...character.proficiencies.tools,...state.levels.flatMap((s) => s.rogue.tools)])];
  character.proficiencies.languages = [...new Set([...character.proficiencies.languages,...state.levels.flatMap((s) => s.rogue.languages)])];
  const definitions: TraitDefinition[] = [...ROGUE_CORE,...(archetype ? ROGUE_FEATURES[archetype] : [])].filter((f) => f.level <= level).map((f) => ({ ...f }));
  const sneak = definitions.find((d) => d.key === "sneak-attack")!;
  sneak.description = `${Math.ceil(level/2)}d6 adicionales. ${sneak.description}`;
  for (const d of definitions) if (d.key === "unerring-eye") d.maximum = Math.max(1,abilityModifier(character.abilities.wisdom));
  const group = await traitGroup(character,"rogue",`Pícaro${archetype ? ` · ${ROGUE_ARCHETYPES[archetype]}` : ""}`,definitions);
  definitions.forEach((d,i) => { runtime.resourceIds[d.key] = group.traits[i]!.id; });
  character.traits = [...character.traits.filter((g) => g.id !== group.id),group];
  const id = await createDeterministicId("act",character.id,"builder","sneak-attack"), old = character.actions.find((a) => a.id === id);
  character.actions = [...character.actions.filter((a) => a.id !== id),{ id,order: old?.order ?? character.actions.length,name: "Ataque Furtivo (daño adicional)",categories: ["other" as const],activation: "Al impactar",reach: "Según el arma",ability: null,proficient: false,attackBonus: 0,damageExpression: `${Math.ceil(level/2)}d6`,damageBonus: 0,damageType: "Según el arma",weaponType: "",properties: "",description: sneak.description,inventoryItemId: null,rollMode: "normal" as const }];
  if (archetype === "inquisitive" && level >= 17) {
    const weaknessId = await createDeterministicId("act",character.id,"builder","eye-for-weakness");
    if (!character.actions.some((a) => a.id === weaknessId)) character.actions.push({ id: weaknessId,order: character.actions.length,name: "Ojo para la Debilidad (furtivo condicional)",categories: ["other"],activation: "Al aplicar Ataque Furtivo",reach: "Objetivo de Lucha Inteligente",ability: null,proficient: false,attackBonus: 0,damageExpression: "3d6",damageBonus: 0,damageType: "Según el arma",weaponType: "",properties: "",description: "Sumá estos 3d6 solo al Ataque Furtivo contra el objetivo de tu Lucha Inteligente; comparte el tipo de daño y el crítico de ese ataque.",inventoryItemId: null,rollMode: "normal" });
  }
  if (archetype === "arcane-trickster") {
    character.spellcasting.ability = "intelligence";
    for (let n=1;n<=9;n++) character.spellcasting.slots[String(n)] = { maximum: EK_PROGRESSION[level]!.slots[n-1] ?? 0,used: character.spellcasting.slots[String(n)]?.used ?? 0 };
    const spells = await Promise.all([...replay.cantrips,...replay.spells.map((s) => s.key)].map(async (key,index) => {
      const definition = structuredClone(PHB_SPELLS[key]!), spellId = await createDeterministicId("spl",character.id,"builder-spell","rogue",key), previous = character.spellcasting.spells.find((s) => s.id === spellId);
      return CharacterSpellV2Schema.parse({ id: spellId,name: definition.name,level: definition.level,order: previous?.order ?? index,prepared: true,definition,casting: { source: "builder:rogue",key,ability: "intelligence",kind: "slots",level: definition.level,traitId: null },effect: previous?.effect ?? { description: "",active: false } });
    }));
    character.spellcasting.spells = [...character.spellcasting.spells.filter((s) => s.casting?.source !== "builder:rogue"),...spells];
  }
  character.spellcasting.rogue = runtime;
  return CharacterV2Schema.parse(character);
}
export async function createGuidedRogue(id: string,operationId: string,input: FighterCreationInput,createdAt: string,initialLevels: FighterLevelChoiceInput[] = []) {
  const creation = validateRogueCreation(input), state = validateRogueBuild({ schemaVersion: 1,packageVersion: 1,ruleset: "dnd5e-2014",classKey: "rogue",creationOperationId: operationId,creation,levels: [] });
  let character = await applyRogueBenefits(await createBuilderCharacter(id,state,createdAt));
  if (initialLevels.length !== creation.startingLevel-1) throw new Error("Completá las elecciones de todos los niveles iniciales.");
  for (const step of initialLevels) character = await advanceGuidedRogue(character,step,createdAt);
  return finishBuilderCreation(character);
}

export async function advanceGuidedRogue(input: CharacterV2,choiceInput: FighterLevelChoiceInput,updatedAt: string) {
  const character = CharacterV2Schema.parse(input), choice = FighterLevelChoiceSchema.parse(choiceInput);
  if (character.builder?.classKey !== "rogue") throw new Error("La ficha no tiene historial guiado de Pícaro.");
  const previous = validateRogueBuild(character.builder), existing = previous.levels.find((s) => s.operationId === choice.operationId);
  if (existing) { if (canonicalJsonStringify(existing as unknown as JsonValue) !== canonicalJsonStringify(choice as unknown as JsonValue)) throw new Error("La operación ya se confirmó con otras elecciones."); return character; }
  if (choice.operationId === previous.creationOperationId || choice.level !== character.identity.level+1 || choice.level !== previous.levels.length+2 || character.identity.className !== "Pícaro" || character.identity.subclass !== (rogueArchetype(previous) ? ROGUE_ARCHETYPES[rogueArchetype(previous)!] : "")) throw new Error("La ficha cambió o el nivel no coincide con su historial.");
  const scores = fighterBuilderScores(previous);
  if (BUILDER_ABILITIES.some((a) => character.abilities[a] !== scores[a])) throw new Error("Los atributos se editaron fuera del tutorial.");
  const next = validateRogueBuild({ ...previous,levels: [...previous.levels,choice] }), abilities = fighterBuilderScores(next);
  const maximum = character.combat.hitPoints.maximum+fighterBuilderMaximumHp(next)-fighterBuilderMaximumHp(previous);
  const actions = await Promise.all(character.actions.map(async (a) => {
    const item = character.inventory.find((i) => i.id === a.inventoryItemId);
    if (!item?.weapon || !a.ability) return a;
    const ability = a.id === await createDeterministicId("act",character.id,"builder-weapon",item.id) && a.ability === preferredWeaponAbility(scores,item) ? preferredWeaponAbility(abilities,item) : a.ability;
    return { ...a,ability,damageBonus: a.damageExpression ? a.damageBonus+abilityModifier(abilities[ability])-abilityModifier(scores[a.ability]) : a.damageBonus };
  }));
  let result = CharacterV2Schema.parse({ ...character,builder: next,abilities,actions,revision: character.revision+1,metadata: { ...character.metadata,updatedAt },identity: { ...character.identity,level: choice.level },combat: { ...character.combat,hitPoints: { ...character.combat.hitPoints,maximum,current: Math.min(character.combat.hitPoints.current,maximum) },hitDice: { ...character.combat.hitDice,maximum: choice.level,remaining: character.combat.hitDice.remaining+1,current: String(character.combat.hitDice.remaining+1),formula: `${choice.level}d8` } } });
  result = await applyAdditionalFighterBenefits(result,character);
  result = await applyRogueBenefits(result);
  result.combat.armorClass = projectInventory(result).calculatedArmorClass;
  result.combat.speed = projectUpdatedBuilderSpeed(character,result);
  return result;
}
