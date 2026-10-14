import { CharacterV2Schema,type CharacterV2 } from "./character-v2";
import { CharacterBuilderStateSchema,FighterCreationSchema,FighterLevelChoiceSchema,BUILDER_ABILITIES,type CharacterBuilderState,type FighterCreationInput,type FighterLevelChoiceInput } from "./character-builder-model";
import { validateBuilderOrigin,fighterBuilderScores,fighterBuilderMaximumHp,createBuilderCharacter,finishBuilderCreation } from "./fighter-builder";
import { validateFeat,builderFeats,distinct,racialSkillGrants } from "./fighter-build-rules";
import { applyAdditionalFighterBenefits } from "./fighter-builder-grants";
import { PHB_SPELLS,classSpells } from "./phb-spells";
import { BARD_COLLEGES,BARD_CORE,BARD_FEATURES,BARD_KNOWN,BARD_SKILLS,bardCollege,bardCantrips,bardSecretsCount,bardLearnCount } from "./bard-catalog";
import { WIZARD_SLOTS,WIZARD_ASI_LEVELS } from "./wizard-catalog";
import { BUILDER_WEAPONS } from "./fighter-builder-catalog";
import { INSTRUMENTS,INSTRUMENT_GEAR } from "./phb-character-options";
import { CharacterSpellV2Schema } from "./character-spell-model";
import { traitGroup,type TraitDefinition } from "./builder-traits";
import { abilityModifier,projectAbilityScore,projectInventory,preferredWeaponAbility,projectUpdatedBuilderSpeed } from "./character-projection";
import { createDeterministicId } from "../../shared/id";
import { canonicalJsonStringify,type JsonValue } from "../../shared/json";
import type { SkillKey } from "./character-checks";

export const bardMaxSpellLevel = (level: number) => WIZARD_SLOTS[level]!.length;
export function bardFeatKnown(state: CharacterBuilderState) { return builderFeats(state).filter(({ feat }) => feat.key === "magic-initiate" && feat.spellClass === "bard").flatMap(({ feat }) => feat.spells.filter((key) => PHB_SPELLS[key]?.level === 1)); }
export function bardSecretOptions(level: number) { return Object.keys(PHB_SPELLS).filter((key) => PHB_SPELLS[key]!.level <= bardMaxSpellLevel(level)); }
function picks(keys: string[],quota: number,eligible: readonly string[],previous: string[] = []) {
  if (keys.length !== quota || !distinct([...previous,...keys]) || keys.some((key) => !eligible.includes(key))) throw new Error(`Elegí ${quota} opciones distintas y válidas de Bardo, sin repetir las anteriores.`);
}
export function replayBardChoices(state: CharacterBuilderState) {
  const first = state.creation.bard;
  picks(first.instruments,3,INSTRUMENTS,state.creation.background.tools);
  picks(first.cantrips,2,classSpells("bard",0)); picks(first.learn,4,classSpells("bard",1));
  if (first.college || first.skills.length || first.expertise.length || first.style || first.secrets.length || first.replaceSpell) throw new Error("Colegio, pericias y secretos se eligen en sus niveles correspondientes.");
  const cantrips = [...first.cantrips],spells = first.learn.map((key) => ({ key,bonus: false })),skills: string[] = [],expertise: string[] = [];
  let college = null as ReturnType<typeof bardCollege>,style: "dueling"|"two-weapon"|null = null;
  for (const [index,step] of state.levels.entries()) {
    const c = step.bard,level = step.level;
    if (c.instruments.length) throw new Error("Los tres instrumentos se eligen en Bardo 1.");
    if (level === 3) { if (!c.college) throw new Error("Elegí un colegio de Bardo en nivel 3."); college = c.college; }
    else if (c.college) throw new Error("El colegio se fija únicamente en Bardo 3.");
    const previous = { ...state,levels: state.levels.slice(0,index) };
    const knownSkills = [...state.creation.skills,...state.creation.background.skills,...racialSkillGrants(state.creation),...skills,...builderFeats(previous).flatMap(({ feat }) => feat.skills)];
    picks(c.skills,level === 3 && college === "lore" ? 3 : 0,BARD_SKILLS,knownSkills); skills.push(...c.skills);
    const priorExpert = [...expertise,...builderFeats(previous).flatMap(({ feat }) => feat.expertise ? [feat.expertise] : [])];
    picks(c.expertise,[3,10].includes(level) ? 2 : 0,[...knownSkills,...skills],priorExpert); expertise.push(...c.expertise);
    if (level === 3 && college === "swords") { if (!c.style) throw new Error("Elegí Duelo o Lucha con dos armas para Espadas."); style = c.style; }
    else if (c.style) throw new Error("El estilo se elige en Colegio de Espadas 3.");
    const known = () => [...cantrips,...spells.map((s) => s.key)];
    picks(c.cantrips,bardCantrips(level)-bardCantrips(level-1),classSpells("bard",0),known()); cantrips.push(...c.cantrips);
    const eligible = classSpells("bard",1,bardMaxSpellLevel(level));
    if (c.replaceSpell) {
      const old = spells.find((s) => s.key === c.replaceSpell!.oldKey);
      // A secret retains its bonus/ordinary origin on replacement. A secret
      // cantrip occupies a secret place, unlike ordinary bard cantrips.
      if (!old || !eligible.includes(c.replaceSpell.newKey) || known().includes(c.replaceSpell.newKey)) throw new Error("Sustituí un conocido anterior por un conjuro de nivel 1 o superior de la lista de Bardo, sin repetir. Los trucos ordinarios no se sustituyen.");
      old.key = c.replaceSpell.newKey;
    }
    picks(c.learn,bardLearnCount(level),eligible,known()); spells.push(...c.learn.map((key) => ({ key,bonus: false })));
    picks(c.secrets,bardSecretsCount(level,college),bardSecretOptions(level),known()); spells.push(...c.secrets.map((key) => ({ key,bonus: level === 6 })));
    if (spells.filter((s) => !s.bonus).length !== BARD_KNOWN[level]) throw new Error("Los Secretos Mágicos de nivel 10, 14 y 18 están incluidos en el total de conocidos.");
  }
  return { college,style,cantrips,spells,skills,expertise };
}
export function validateBardCreation(input: FighterCreationInput) {
  const creation = FighterCreationSchema.parse(input);
  if (creation.classKey !== "bard") throw new Error("Este recorrido requiere Bardo.");
  validateBuilderOrigin(creation);
  if (creation.equipment.method === "packages" && (!BUILDER_WEAPONS[creation.bardWeapon]?.weapon?.category.startsWith("simple") && !["rapier","longsword"].includes(creation.bardWeapon) || !INSTRUMENT_GEAR[creation.bardInstrument])) throw new Error("Elegí estoque, espada larga o arma sencilla, y un instrumento musical para el equipo inicial.");
  replayBardChoices({ schemaVersion: 1,packageVersion: 1,ruleset: "dnd5e-2014",classKey: "bard",creationOperationId: "build_00000000000000000000000000000000",creation,levels: [] });
  return creation;
}
export function validateBardBuild(input: CharacterBuilderState) {
  const state = CharacterBuilderStateSchema.parse(input); validateBardCreation(state.creation);
  if (state.classKey !== "bard") throw new Error("El historial no corresponde a Bardo.");
  for (const [index,step] of state.levels.entries()) {
    if (step.hpBase > 8 || step.hpMethod === "fixed" && step.hpBase !== 5) throw new Error("Bardo usa 5 PG fijos o una tirada de d8, antes de Constitución.");
    if (step.subclass || step.additionalStyle || step.maneuvers.length || step.maneuverReplacement || step.artisanTool || step.magic.learn.length || step.magic.cantrips.length || step.magic.replace) throw new Error("Bardo no concede elecciones de Guerrero.");
    const previous = { ...state,levels: state.levels.slice(0,index) };
    if (WIZARD_ASI_LEVELS.includes(step.level)) {
      if (step.skipImprovement) { if (step.feat || step.abilityIncrease) throw new Error("La renuncia debe dejar vacías las elecciones."); }
      else if (step.feat) { if (step.abilityIncrease) throw new Error("Elegí mejora o dote."); validateFeat(step.feat,fighterBuilderScores(previous),previous); }
      else if (!step.abilityIncrease || Object.values(step.abilityIncrease).reduce((a,b) => a+b,0) !== 2) throw new Error("Distribuí dos puntos de atributo o elegí una dote permitida.");
    } else if (step.feat || step.abilityIncrease || step.skipImprovement) throw new Error("Este nivel de Bardo no concede mejora ni dote.");
    if (Object.values(fighterBuilderScores({ ...state,levels: state.levels.slice(0,index+1) })).some((n) => n > 20)) throw new Error("Las mejoras no pueden superar 20.");
  }
  replayBardChoices(state); return state;
}
export async function applyBardBenefits(input: CharacterV2) {
  const character = CharacterV2Schema.parse(input),state = character.builder!,level = character.identity.level,replay = replayBardChoices(state);
  character.identity.className = "Bardo"; character.identity.subclass = replay.college ? BARD_COLLEGES[replay.college] : "";
  character.spellcasting.ability = "charisma";
  const definitions: TraitDefinition[] = [...BARD_CORE,...(replay.college ? BARD_FEATURES[replay.college] : [])].filter((f) => f.level <= level).map((f) => ({ ...f }));
  const pool = definitions.find((f) => f.key === "inspiration")!;
  pool.maximum = Math.max(1,abilityModifier(projectAbilityScore(character,"charisma"))); pool.reset = level >= 5 ? "short-rest" : "long-rest";
  const group = await traitGroup(character,"bard",`Bardo${replay.college ? ` · ${BARD_COLLEGES[replay.college]}` : ""}`,definitions);
  character.traits = [...character.traits.filter((g) => g.id !== group.id),group];
  character.spellcasting.bard ??= { actions: [],inspirationId: null };
  character.spellcasting.bard.inspirationId = group.traits[definitions.indexOf(pool)]!.id;
  for (const key of replay.skills) character.checks.skills[key as SkillKey].proficiency = Math.max(1,character.checks.skills[key as SkillKey].proficiency) as 1|2;
  for (const key of replay.expertise) character.checks.skills[key as SkillKey].proficiency = 2;
  if (replay.college === "valor") { character.proficiencies.armor = [...new Set([...character.proficiencies.armor,"Armaduras medias","Escudos"])]; character.proficiencies.weapons = [...new Set([...character.proficiencies.weapons,"Armas marciales"])]; }
  if (replay.college === "swords") { character.proficiencies.armor = [...new Set([...character.proficiencies.armor,"Armaduras medias"])]; character.proficiencies.weapons = [...new Set([...character.proficiencies.weapons,"Cimitarra"])]; }
  for (const action of character.actions) { const item = character.inventory.find((i) => i.id === action.inventoryItemId); if (item?.weapon && (replay.college === "valor" || replay.college === "swords" && item.name === "Cimitarra")) action.proficient = true; }
  for (let n=1;n<=9;n++) character.spellcasting.slots[String(n)] = { maximum: WIZARD_SLOTS[level]![n-1] ?? 0,used: character.spellcasting.slots[String(n)]?.used ?? 0 };
  const keys = [...new Set([...replay.cantrips,...replay.spells.map((s) => s.key),...bardFeatKnown(state)])];
  const generated = await Promise.all(keys.map(async (key,index) => {
    const id = await createDeterministicId("spl",character.id,"bard",key),old = character.spellcasting.spells.find((s) => s.id === id),definition = PHB_SPELLS[key]!;
    return CharacterSpellV2Schema.parse({ id,name: definition.name,level: definition.level,order: old?.order ?? character.spellcasting.spells.length+index,prepared: true,definition: old?.definition ?? definition,effect: old?.effect ?? { description: "",active: false },casting: { source: "builder:bard",key,ability: "charisma",kind: "slots",traitId: null,level: definition.level } });
  }));
  character.spellcasting.spells = [...character.spellcasting.spells.filter((s) => s.casting?.source !== "builder:bard"),...generated];
  return CharacterV2Schema.parse(character);
}

export async function createGuidedBard(id: string,operationId: string,input: FighterCreationInput,createdAt: string,initialLevels: FighterLevelChoiceInput[] = []) {
  const creation = validateBardCreation(input), state = validateBardBuild({ schemaVersion: 1,packageVersion: 1,ruleset: "dnd5e-2014",classKey: "bard",creationOperationId: operationId,creation,levels: [] });
  let character = await applyBardBenefits(await createBuilderCharacter(id,state,createdAt));
  if (initialLevels.length !== creation.startingLevel-1) throw new Error("Completá todos los niveles iniciales.");
  for (const step of initialLevels) character = await advanceGuidedBard(character,step,createdAt);
  return finishBuilderCreation(character);
}
export async function advanceGuidedBard(input: CharacterV2,choiceInput: FighterLevelChoiceInput,updatedAt: string) {
  const character = CharacterV2Schema.parse(input),choice = FighterLevelChoiceSchema.parse(choiceInput);
  if (character.builder?.classKey !== "bard") throw new Error("Esta ficha no tiene historial guiado de Bardo.");
  const previous = validateBardBuild(character.builder), old = previous.levels.find((step) => step.operationId === choice.operationId);
  if (old) { if (canonicalJsonStringify(old as unknown as JsonValue) !== canonicalJsonStringify(choice as unknown as JsonValue)) throw new Error("Esta operación ya se confirmó con otras elecciones."); return character; }
  const scores = fighterBuilderScores(previous);
  if (choice.operationId === previous.creationOperationId || character.identity.level !== previous.levels.length+1 || choice.level !== character.identity.level+1 || character.identity.className !== "Bardo" || character.identity.subclass !== (bardCollege(previous) ? BARD_COLLEGES[bardCollege(previous)!] : "") || BUILDER_ABILITIES.some((key) => character.abilities[key] !== scores[key])) throw new Error("La ficha cambió fuera del tutorial o no coincide con su historial.");
  const next = validateBardBuild({ ...previous,levels: [...previous.levels,choice] }), abilities = fighterBuilderScores(next), maximum = character.combat.hitPoints.maximum+fighterBuilderMaximumHp(next)-fighterBuilderMaximumHp(previous);
  const actions = await Promise.all(character.actions.map(async (action) => {
    const item = character.inventory.find((i) => i.id === action.inventoryItemId); if (!item?.weapon || !action.ability) return action;
    const generated = action.id === await createDeterministicId("act",character.id,"builder-weapon",item.id), ability = generated && action.ability === preferredWeaponAbility(scores,item) ? preferredWeaponAbility(abilities,item) : action.ability;
    return { ...action,ability,damageBonus: action.damageExpression ? action.damageBonus+abilityModifier(abilities[ability])-abilityModifier(scores[action.ability]) : action.damageBonus };
  }));
  let result = CharacterV2Schema.parse({ ...character,builder: next,abilities,actions,revision: character.revision+1,metadata: { ...character.metadata,updatedAt },identity: { ...character.identity,level: choice.level },combat: { ...character.combat,hitPoints: { ...character.combat.hitPoints,maximum,current: Math.min(character.combat.hitPoints.current,maximum) },hitDice: { ...character.combat.hitDice,maximum: choice.level,remaining: character.combat.hitDice.remaining+1,current: String(character.combat.hitDice.remaining+1),formula: `${choice.level}d8` } } });
  result = await applyAdditionalFighterBenefits(result,character); result = await applyBardBenefits(result);
  result.combat.armorClass = projectInventory(result).calculatedArmorClass; result.combat.speed = projectUpdatedBuilderSpeed(character,result);
  return CharacterV2Schema.parse(result);
}
