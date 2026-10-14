import { CharacterV2Schema,type CharacterV2 } from "./character-v2";
import { CharacterBuilderStateSchema,FighterCreationSchema,FighterLevelChoiceSchema,BUILDER_ABILITIES,type CharacterBuilderState,type FighterCreationInput,type FighterLevelChoiceInput } from "./character-builder-model";
import { validateBuilderOrigin,fighterBuilderScores,fighterBuilderMaximumHp,createBuilderCharacter,finishBuilderCreation } from "./fighter-builder";
import { validateFeat,builderFeats,distinct } from "./fighter-build-rules";
import { applyAdditionalFighterBenefits } from "./fighter-builder-grants";
import { PHB_SPELLS,classSpells } from "./phb-spells";
import { RANGER_ARCHETYPES,RANGER_ENEMIES,RANGER_TERRAINS,RANGER_CORE,RANGER_FEATURES,RANGER_SLOTS,RANGER_KNOWN,HUNTER_OPTIONS,rangerArchetype,rangerBonusSpell } from "./ranger-catalog";
import { WIZARD_ASI_LEVELS } from "./wizard-catalog";
import { BUILDER_WEAPONS,BUILDER_RACES,FIGHTING_STYLES } from "./fighter-builder-catalog";
import { CharacterSpellV2Schema } from "./character-spell-model";
import { RangerRuntimeSchema } from "./ranger-model";
import { traitGroup,type TraitDefinition } from "./builder-traits";
import { abilityModifier,projectAbilityScore,projectInventory,preferredWeaponAbility,projectUpdatedBuilderSpeed,proficiencyBonus } from "./character-projection";
import { createDeterministicId } from "../../shared/id";
import { canonicalJsonStringify,type JsonValue } from "../../shared/json";
export const rangerMaxSpellLevel = (level: number) => RANGER_SLOTS[level]!.length;
const normalized = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
export function replayRangerChoices(state: CharacterBuilderState) {
  const c = state.creation,enemies: NonNullable<typeof c.ranger.enemy>[] = [],terrains: NonNullable<typeof c.ranger.terrain>[] = [],spells: { key: string;bonus: boolean }[] = [];
  let archetype: ReturnType<typeof rangerArchetype> = null,style: typeof c.ranger.style = null,companion = null as typeof c.ranger.companion;
  for (const [level,pick] of [[1,c.ranger],...state.levels.map((s) => [s.level,s.ranger] as const)] as const) {
    const previous = { ...state,levels: state.levels.filter((s) => s.level < level) };
    if ([1,6,14].includes(level)) {
      if (!pick.enemy) throw new Error("Elegí enemigo predilecto en Explorador 1, 6 y 14.");
      const e = pick.enemy,humanoids = enemies.flatMap((e) => e.humanoids).map(normalized);
      if (e.type === "humanoids" ? e.humanoids.length !== 2 || new Set([...humanoids,...e.humanoids.map(normalized)]).size !== humanoids.length+2 : e.humanoids.length > 0 || enemies.some((old) => old.type === e.type)) throw new Error("Elegí un tipo de enemigo nuevo o dos razas de humanoides distintas, sin repetir las anteriores.");
      const languages = [...BUILDER_RACES[c.race].languages,...c.languages,...c.background.languages,...enemies.map((e) => e.language).filter(Boolean),...builderFeats(previous).flatMap(({ feat }) => feat.languages)].map(normalized);
      if (!e.languageConfirmed || e.language && languages.includes(normalized(e.language))) throw new Error("Confirmá un idioma que hablen esos enemigos y que no conozcas; dejalo vacío si no hay uno que puedas aprender.");
      enemies.push(e);
    } else if (pick.enemy) throw new Error("Enemigo predilecto solo se elige en 1, 6 y 14.");
    if ([1,6,10].includes(level)) { if (!pick.terrain || terrains.includes(pick.terrain)) throw new Error("Elegí terrenos distintos en Explorador 1, 6 y 10.");terrains.push(pick.terrain); }
    else if (pick.terrain) throw new Error("El terreno adicional se elige solo en 6 y 10.");
    if (level === 2) { if (!pick.style) throw new Error("Elegí uno de los cuatro estilos de Explorador en nivel 2.");style = pick.style; }
    else if (pick.style) throw new Error("El estilo se fija únicamente en Explorador 2.");
    if (level === 3) { if (!pick.archetype) throw new Error("Elegí un arquetipo de Explorador en nivel 3.");archetype = pick.archetype; }
    else if (pick.archetype) throw new Error("El arquetipo se fija únicamente en nivel 3.");
    if (archetype === "hunter" && HUNTER_OPTIONS[level]) { if (!HUNTER_OPTIONS[level]![pick.hunter]) throw new Error(`Elegí el rasgo de Cazador de nivel ${level}.`); }
    else if (pick.hunter) throw new Error("Estas opciones requieren Cazador en 3, 7, 11 o 15.");
    if (archetype === "beast-master" && level === 3) { if (!pick.companion) throw new Error("Elegí una bestia Mediana o menor, VD 1/4 o menor, como compañero.");companion = pick.companion; }
    else if (pick.companion) throw new Error("El compañero inicial se elige en Señor de las Bestias 3; los reemplazos se vinculan durante el juego.");
    const alreadyWisdom = builderFeats(previous).some(({ feat }) => feat.key === "resilient" && feat.ability === "wisdom");
    if (archetype === "gloom-stalker" && level === 7 && alreadyWisdom) { if (!pick.ironMind) throw new Error("Ya tenés salvación SAB; Mente de Hierro requiere elegir INT o CAR."); }
    else if (pick.ironMind) throw new Error("La salvación alternativa solo corresponde a Mente de Hierro 7 si ya tenés SAB.");
    const eligible = level >= 2 ? classSpells("ranger",1,rangerMaxSpellLevel(level)) : [];
    if (pick.replaceSpell) {
      const old = spells.find((s) => s.key === pick.replaceSpell!.oldKey);
      if (!old || !eligible.includes(pick.replaceSpell.newKey) || spells.some((s) => s.key === pick.replaceSpell!.newKey)) throw new Error("Sustituí un conocido anterior por otro de la lista de Explorador disponible, sin repetir.");old.key = pick.replaceSpell.newKey;
    }
    const bonus = rangerBonusSpell(archetype,level);if (bonus && !spells.some((s) => s.key === bonus)) spells.push({ key: bonus,bonus: true });
    const count = RANGER_KNOWN[level]!-RANGER_KNOWN[level-1]!;
    if (pick.learn.length !== count || !distinct(pick.learn) || pick.learn.some((k) => !eligible.includes(k) || spells.some((s) => s.key === k))) throw new Error(`Elegí ${count} conjuros nuevos de Explorador disponibles y distintos; la magia del arquetipo no ocupa cupo.`);
    spells.push(...pick.learn.map((key) => ({ key,bonus: false })));
  }
  return { archetype,style,enemies,terrains,spells,companion };
}
export function validateRangerCreation(input: FighterCreationInput) {
  const c = FighterCreationSchema.parse(input);if (c.classKey !== "ranger") throw new Error("Este recorrido requiere Explorador.");validateBuilderOrigin(c);
  if (c.equipment.method === "packages" && !c.rangerWeapons.every((key) => key === "shortsword") && !c.rangerWeapons.every((key) => BUILDER_WEAPONS[key]?.weapon?.category.startsWith("simple") && BUILDER_WEAPONS[key]!.weapon!.range === "melee")) throw new Error("El paquete requiere dos espadas cortas o dos armas sencillas cuerpo a cuerpo.");
  replayRangerChoices({ schemaVersion: 1,packageVersion: 1,ruleset: "dnd5e-2014",classKey: "ranger",creationOperationId: "build_00000000000000000000000000000000",creation: c,levels: [] });return c;
}
export function validateRangerBuild(input: CharacterBuilderState) {
  const state = CharacterBuilderStateSchema.parse(input);validateRangerCreation(state.creation);if (state.classKey !== "ranger") throw new Error("El historial no corresponde a Explorador.");
  for (const [index,step] of state.levels.entries()) {
    if (step.hpBase > 10 || step.hpMethod === "fixed" && step.hpBase !== 6) throw new Error("Explorador usa 6 PG fijos o una tirada de d10, antes de Constitución.");
    if (step.subclass || step.additionalStyle || step.maneuvers.length || step.maneuverReplacement || step.artisanTool || step.magic.learn.length || step.magic.cantrips.length || step.magic.replace) throw new Error("Explorador no concede elecciones de Guerrero.");
    const previous = { ...state,levels: state.levels.slice(0,index) };
    if (WIZARD_ASI_LEVELS.includes(step.level)) {
      if (step.skipImprovement) { if (step.feat || step.abilityIncrease) throw new Error("La renuncia debe dejar vacías las elecciones."); }
      else if (step.feat) { if (step.abilityIncrease) throw new Error("Elegí mejora o dote.");validateFeat(step.feat,fighterBuilderScores(previous),previous); }
      else if (!step.abilityIncrease || Object.values(step.abilityIncrease).reduce((a,b) => a+b,0) !== 2) throw new Error("Distribuí dos puntos de atributo o elegí una dote permitida.");
    } else if (step.feat || step.abilityIncrease || step.skipImprovement) throw new Error("Este nivel de Explorador no concede mejora ni dote.");
    if (Object.values(fighterBuilderScores({ ...state,levels: state.levels.slice(0,index+1) })).some((n) => n > 20)) throw new Error("Las mejoras no pueden superar 20.");
  }
  replayRangerChoices(state);return state;
}
export const rangerCompanionMaximum = (c: CharacterV2) => c.spellcasting.ranger?.companion ? Math.max(c.spellcasting.ranger.companion.baseHp,c.identity.level*4) : 0;
export function rangerCompanionStats(c: CharacterV2) { const b = c.spellcasting.ranger?.companion;if (!b) return null;const p = proficiencyBonus(c.identity.level);return { maximumHp: rangerCompanionMaximum(c),armorClass: b.baseAc+p,attackBonus: b.attackBonus+p,damage: `${b.damage}+${p}`,checks: b.checks.map((s) => ({ ...s,bonus: s.bonus+p })),magical: c.identity.level >= 7 }; }
export async function applyRangerBenefits(input: CharacterV2) {
  const c = CharacterV2Schema.parse(input),state = c.builder!,level = c.identity.level,replay = replayRangerChoices(state),r = RangerRuntimeSchema.parse(c.spellcasting.ranger ?? {});
  c.identity.className = "Explorador";c.identity.subclass = replay.archetype ? RANGER_ARCHETYPES[replay.archetype] : "";c.spellcasting.ability = "wisdom";c.proficiencies.languages = [...new Set([...c.proficiencies.languages,...replay.enemies.map((e) => e.language).filter(Boolean)])];
  if (replay.archetype === "gloom-stalker" && level >= 7) c.checks.savingThrows[state.levels.find((s) => s.level === 7)!.ranger.ironMind ?? "wisdom"].proficiency = 1;
  const definitions: TraitDefinition[] = [...RANGER_CORE,...(replay.archetype ? RANGER_FEATURES[replay.archetype] : [])].filter((f) => f.level <= level).map((f) => ({ ...f }));
  const sense = definitions.find((f) => f.key === "hunters-sense");if (sense) { sense.maximum = Math.max(1,abilityModifier(projectAbilityScore(c,"wisdom")));sense.reset = "long-rest"; }
  if (replay.style) definitions.push({ key: "style",name: `Estilo: ${FIGHTING_STYLES[replay.style].name}`,description: FIGHTING_STYLES[replay.style].description });
  for (const step of state.levels) if (step.ranger.hunter) { const option = HUNTER_OPTIONS[step.level]![step.ranger.hunter]!;definitions.push({ key: `hunter-${step.level}`,name: option.name,description: option.description }); }
  definitions.push({ key: "enemies",name: "Tus Enemigos Predilectos",description: replay.enemies.map((e) => `${RANGER_ENEMIES[e.type]}${e.humanoids.length ? `: ${e.humanoids.join(", ")}` : ""}${e.language ? ` · idioma: ${e.language}` : " · sin idioma nuevo"}`).join("; ") },{ key: "terrains",name: "Tus Terrenos Predilectos",description: replay.terrains.map((t) => RANGER_TERRAINS[t]).join(", ") });
  const group = await traitGroup(c,"ranger",`Explorador${replay.archetype ? ` · ${RANGER_ARCHETYPES[replay.archetype]}` : ""}`,definitions);definitions.forEach((d,i) => { r.resourceIds[d.key] = group.traits[i]!.id; });c.traits = [...c.traits.filter((g) => g.id !== group.id),group];
  if (replay.companion && !r.companion) { r.companion = structuredClone(replay.companion);r.companionHp = Math.max(replay.companion.baseHp,level*4);r.companionDiceRemaining = replay.companion.hitDice; }
  for (let n=1;n<=9;n++) c.spellcasting.slots[String(n)] = { maximum: RANGER_SLOTS[level]![n-1] ?? 0,used: c.spellcasting.slots[String(n)]?.used ?? 0 };
  const keys = [...replay.spells.map((s) => s.key)],generated = await Promise.all(keys.map(async (key,index) => { const id = await createDeterministicId("spl",c.id,"ranger",key),old = c.spellcasting.spells.find((s) => s.id === id),definition = PHB_SPELLS[key]!;return CharacterSpellV2Schema.parse({ id,name: definition.name,level: definition.level,order: old?.order ?? index,prepared: true,definition: old?.definition ?? definition,effect: old?.effect ?? { description: "",active: false },casting: { source: "builder:ranger",key,ability: "wisdom",kind: "slots",traitId: null,level: definition.level } }); }));
  if (replay.archetype === "horizon-walker" && level >= 7) { const definition = { ...PHB_SPELLS.etherealness!,castingTime: "1 acción adicional",duration: "Hasta el final del turno actual" },id = await createDeterministicId("spl",c.id,"ranger-ethereal-step"),old = c.spellcasting.spells.find((s) => s.id === id);generated.push(CharacterSpellV2Schema.parse({ id,name: `${definition.name} · Paso Etéreo`,level: 7,order: old?.order ?? generated.length,prepared: true,definition,effect: old?.effect ?? { description: "",active: false },casting: { source: "builder:ranger-ethereal",key: "etherealness",ability: "wisdom",kind: "innate",traitId: r.resourceIds["ethereal-step"],level: 7 } })); }
  c.spellcasting.spells = [...c.spellcasting.spells.filter((s) => !s.casting?.source.startsWith("builder:ranger")),...generated];c.spellcasting.ranger = r;return CharacterV2Schema.parse(c);
}

export async function createGuidedRanger(id: string,operationId: string,input: FighterCreationInput,createdAt: string,initialLevels: FighterLevelChoiceInput[] = []) {
  const creation = validateRangerCreation(input), state = validateRangerBuild({ schemaVersion: 1,packageVersion: 1,ruleset: "dnd5e-2014",classKey: "ranger",creationOperationId: operationId,creation,levels: [] });
  let character = await applyRangerBenefits(await createBuilderCharacter(id,state,createdAt));
  if (initialLevels.length !== creation.startingLevel-1) throw new Error("Completá todos los niveles iniciales.");
  for (const step of initialLevels) character = await advanceGuidedRanger(character,step,createdAt);
  if (character.spellcasting.ranger?.companion) character.spellcasting.ranger.companionHp = rangerCompanionMaximum(character);
  return finishBuilderCreation(character);
}
export async function advanceGuidedRanger(input: CharacterV2,choiceInput: FighterLevelChoiceInput,updatedAt: string) {
  const character = CharacterV2Schema.parse(input),choice = FighterLevelChoiceSchema.parse(choiceInput);
  if (character.builder?.classKey !== "ranger") throw new Error("Esta ficha no tiene historial guiado de Explorador.");
  const previous = validateRangerBuild(character.builder), old = previous.levels.find((step) => step.operationId === choice.operationId);
  if (old) { if (canonicalJsonStringify(old as unknown as JsonValue) !== canonicalJsonStringify(choice as unknown as JsonValue)) throw new Error("Esta operación ya se confirmó con otras elecciones."); return character; }
  const scores = fighterBuilderScores(previous);
  if (choice.operationId === previous.creationOperationId || character.identity.level !== previous.levels.length+1 || choice.level !== character.identity.level+1 || character.identity.className !== "Explorador" || character.identity.subclass !== (rangerArchetype(previous) ? RANGER_ARCHETYPES[rangerArchetype(previous)!] : "") || BUILDER_ABILITIES.some((key) => character.abilities[key] !== scores[key])) throw new Error("La ficha cambió fuera del tutorial o no coincide con su historial.");
  const next = validateRangerBuild({ ...previous,levels: [...previous.levels,choice] }), abilities = fighterBuilderScores(next), maximum = character.combat.hitPoints.maximum+fighterBuilderMaximumHp(next)-fighterBuilderMaximumHp(previous);
  const actions = await Promise.all(character.actions.map(async (action) => {
    const item = character.inventory.find((i) => i.id === action.inventoryItemId); if (!item?.weapon || !action.ability) return action;
    const generated = action.id === await createDeterministicId("act",character.id,"builder-weapon",item.id), ability = generated && action.ability === preferredWeaponAbility(scores,item) ? preferredWeaponAbility(abilities,item) : action.ability;
    return { ...action,ability,damageBonus: action.damageExpression ? action.damageBonus+abilityModifier(abilities[ability])-abilityModifier(scores[action.ability]) : action.damageBonus };
  }));
  let result = CharacterV2Schema.parse({ ...character,builder: next,abilities,actions,revision: character.revision+1,metadata: { ...character.metadata,updatedAt },identity: { ...character.identity,level: choice.level },combat: { ...character.combat,hitPoints: { ...character.combat.hitPoints,maximum,current: Math.min(character.combat.hitPoints.current,maximum) },hitDice: { ...character.combat.hitDice,maximum: choice.level,remaining: character.combat.hitDice.remaining+1,current: String(character.combat.hitDice.remaining+1),formula: `${choice.level}d10` } } });
  result = await applyAdditionalFighterBenefits(result,character); result = await applyRangerBenefits(result);
  result.combat.armorClass = projectInventory(result).calculatedArmorClass; result.combat.speed = projectUpdatedBuilderSpeed(character,result);
  return CharacterV2Schema.parse(result);
}
