import { CharacterV2Schema,type CharacterV2 } from "./character-v2";
import { BUILDER_ABILITIES,CharacterBuilderStateSchema,FighterCreationSchema,FighterLevelChoiceSchema,type CharacterBuilderState,type FighterCreationInput,type FighterLevelChoiceInput } from "./character-builder-model";
import { validateBuilderOrigin,fighterBuilderScores,fighterBuilderMaximumHp,createBuilderCharacter,finishBuilderCreation } from "./fighter-builder";
import { validateFeat } from "./fighter-build-rules";
import { applyAdditionalFighterBenefits } from "./fighter-builder-grants";
import { BARBARIAN_ASI_LEVELS,BARBARIAN_CORE,BARBARIAN_FEATURES,BARBARIAN_PATHS,TOTEM_ANIMALS,TOTEM_FEATURES,STORM_ENVIRONMENTS,STORM_FEATURES,barbarianPath,barbarianTotem,barbarianStorm,barbarianDivineDamage,barbarianRages,barbarianRageDamage,barbarianShieldDice,stormAuraAmount,stormSeaDice } from "./barbarian-catalog";
import { BarbarianRuntimeSchema } from "./barbarian-model";
import { BUILDER_WEAPONS } from "./fighter-builder-catalog";
import { PHB_SPELLS } from "./phb-spells";
import { CharacterSpellV2Schema } from "./character-spell-model";
import { traitGroup,type TraitDefinition } from "./builder-traits";
import { abilityModifier,projectInventory,projectUpdatedBuilderSpeed,preferredWeaponAbility } from "./character-projection";
import { createDeterministicId } from "../../shared/id";
import { canonicalJsonStringify,type JsonValue } from "../../shared/json";

export function validateBarbarianCreation(input: FighterCreationInput) {
  const c = FighterCreationSchema.parse(input);
  if (c.classKey !== "barbarian") throw new Error("Este recorrido requiere Bárbaro.");
  validateBuilderOrigin(c);
  if (Object.values(c.barbarian).some((v) => v !== null)) throw new Error("La senda y sus elecciones se adquieren desde Bárbaro 3.");
  if (c.equipment.method === "packages") {
    if (BUILDER_WEAPONS[c.barbarianWeapon]?.weapon?.category !== "martial") throw new Error("Elegí un arma marcial cuerpo a cuerpo para el equipo inicial de Bárbaro.");
    if (c.barbarianSecondary !== "two-handaxes" && !BUILDER_WEAPONS[c.barbarianSecondary]?.weapon?.category.startsWith("simple")) throw new Error("Elegí dos hachas de mano o un arma simple adicional.");
  }
  return c;
}
export function validateBarbarianBuild(input: CharacterBuilderState) {
  const state = CharacterBuilderStateSchema.parse(input);
  if (state.classKey !== "barbarian") throw new Error("El historial no corresponde a Bárbaro.");
  validateBarbarianCreation(state.creation);
  const path = barbarianPath(state);
  for (const [i,step] of state.levels.entries()) {
    const pick = step.barbarian, level = step.level;
    if (step.hpBase > 12 || step.hpMethod === "fixed" && step.hpBase !== 7) throw new Error("Bárbaro usa 7 PG fijos o un resultado de d12, antes de Constitución.");
    if (step.subclass || step.additionalStyle || step.maneuvers.length || step.maneuverReplacement || step.artisanTool || step.magic.cantrips.length || step.magic.learn.length || step.magic.replace) throw new Error("Bárbaro no concede elecciones de Guerrero.");
    if ((level === 3) !== (pick.path !== null)) throw new Error("Elegí una senda primitiva únicamente en Bárbaro 3.");
    if ((path === "totem-warrior" && [3,6,14].includes(level)) !== (pick.totem !== null)) throw new Error("Guerrero Totémico elige un animal en cada nivel 3, 6 y 14; pueden ser distintos.");
    if (path === "storm-herald" && level === 3 ? !pick.storm : (path !== "storm-herald" || level < 3) && pick.storm !== null) throw new Error("Heraldo de la Tormenta elige entorno en nivel 3 y puede cambiarlo en ascensos posteriores.");
    if ((path === "zealot" && level === 3) !== (pick.divineDamage !== null)) throw new Error("Fanático elige radiante o necrótico únicamente al adquirir Furia Divina en nivel 3.");
    const prior = { ...state,levels: state.levels.slice(0,i) };
    if (BARBARIAN_ASI_LEVELS.includes(level)) {
      if (step.skipImprovement) { if (step.feat || step.abilityIncrease) throw new Error("Renunciar requiere dejar las elecciones vacías."); }
      else if (step.feat) { if (step.abilityIncrease) throw new Error("Elegí dote o mejora, no ambas."); validateFeat(step.feat,fighterBuilderScores(prior),prior); }
      else if (!step.abilityIncrease || Object.values(step.abilityIncrease).reduce((a,b) => a+b,0) !== 2 || Object.values(step.abilityIncrease).some((n) => n > 2)) throw new Error("Distribuí dos puntos de atributo o elegí una dote.");
    } else if (step.feat || step.abilityIncrease || step.skipImprovement) throw new Error("Este nivel no concede mejora de atributos.");
    const scores = fighterBuilderScores({ ...state,levels: state.levels.slice(0,i+1) });
    if (BUILDER_ABILITIES.some((a) => scores[a] > (level === 20 && ["strength","constitution"].includes(a) ? 24 : 20))) throw new Error("Las mejoras no pueden superar 20; Campeón Primario permite 24 en Fuerza y Constitución.");
  }
  return state;
}
export async function applyBarbarianBenefits(input: CharacterV2) {
  const character = CharacterV2Schema.parse(input), state = character.builder!, level = character.identity.level, path = barbarianPath(state), environment = barbarianStorm(state);
  const runtime = BarbarianRuntimeSchema.parse(character.spellcasting.barbarian ?? {});
  character.identity.className = "Bárbaro";character.identity.subclass = path ? `Senda del ${BARBARIAN_PATHS[path]}` : "";
  const definitions: TraitDefinition[] = [...BARBARIAN_CORE,...(path ? BARBARIAN_FEATURES[path] : [])].filter((f) => f.level <= level).map((f) => ({ ...f }));
  const rage = definitions.find((d) => d.key === "rage")!;
  rage.maximum = barbarianRages(level);rage.reset = "long-rest";
  rage.description = `${level >= 20 ? "Furias ilimitadas" : `${rage.maximum} furias por descanso largo`}; daño de furia +${barbarianRageDamage(level)}. ${rage.description}`;
  for (const n of [3,6,14] as const) {
    const animal = barbarianTotem(state,n);
    if (animal) definitions.push({ key: `totem-${n}`,name: `${n === 3 ? "Espíritu Tótem" : n === 6 ? "Aspecto de la Bestia" : "Sintonía Totémica"}: ${TOTEM_ANIMALS[animal]}`,description: TOTEM_FEATURES[n][animal] });
  }
  if (environment) for (const n of [3,6,14] as const) if (level >= n) definitions.push({ key: `storm-${n}`,name: `${n === 3 ? "Aura" : n === 6 ? "Alma" : "Tormenta Furiosa"}: ${STORM_ENVIRONMENTS[environment]}`,description: STORM_FEATURES[environment][n] });
  const focus = definitions.find((d) => d.key === "fanatical-focus");if (focus) { focus.maximum = 1;focus.reset = "none"; }
  const shield = definitions.find((d) => d.key === "spirit-shield");if (shield) shield.description = `${barbarianShieldDice(level)}d6 de reducción. ${shield.description}`;
  const divine = definitions.find((d) => d.key === "divine-fury");if (divine) divine.description = `1d6 + ${Math.floor(level/2)} de daño ${barbarianDivineDamage(state) === "radiant" ? "radiante" : "necrótico"}. ${divine.description}`;
  const group = await traitGroup(character,"barbarian",`Bárbaro${path ? ` · ${BARBARIAN_PATHS[path]}` : ""}`,definitions);
  if (level >= 20) group.traits[definitions.indexOf(rage)]!.uses.used = 0;
  definitions.forEach((d,i) => { runtime.resourceIds[d.key] = group.traits[i]!.id; });
  character.traits = [...character.traits.filter((g) => g.id !== group.id),group];
  runtime.storm = environment;
  character.spellcasting.barbarian = runtime;
  const grants: Array<{ key: string;kind: "ritual"|"innate";traitId: string|null }> = path === "totem-warrior" ? ["beast-sense","speak-with-animals",...(level >= 10 ? ["commune-with-nature"] : [])].map((key) => ({ key,kind: "ritual",traitId: null })) : path === "ancestral-guardian" && level >= 10 ? ["augury","clairvoyance"].map((key) => ({ key,kind: "innate",traitId: runtime.resourceIds["consult-spirits"]! })) : [];
  const generated = await Promise.all(grants.map(async (grant,index) => {
    const definition = structuredClone(PHB_SPELLS[grant.key]!), id = await createDeterministicId("spl",character.id,"builder-spell","barbarian",grant.key), old = character.spellcasting.spells.find((s) => s.id === id);
    if (grant.kind === "innate") { definition.material = "No requiere componentes materiales por Consultar a los Espíritus."; definition.components = definition.components.split(",").map((c) => c.trim()).filter((c) => c !== "M").join(", "); }
    return CharacterSpellV2Schema.parse({ id,name: definition.name,level: definition.level,prepared: true,order: old?.order ?? index,definition,casting: { source: "builder:barbarian",key: grant.key,ability: "wisdom",kind: grant.kind,level: definition.level,traitId: grant.traitId },effect: old?.effect ?? { description: "",active: false } });
  }));
  character.spellcasting.spells = [...character.spellcasting.spells.filter((s) => s.casting?.source !== "builder:barbarian"),...generated];
  if (grants.length) character.spellcasting.ability = "wisdom";
  const extras: Array<{ key: string;name: string;dice: string;bonus: number;damageType: string;description: string }> = [];
  if (path === "zealot") extras.push({ key: "divine-fury",name: "Furia Divina (daño adicional)",dice: "1d6",bonus: Math.floor(level/2),damageType: barbarianDivineDamage(state)!,description: divine!.description });
  if (path === "ancestral-guardian" && level >= 6) extras.push({ key: "spirit-shield",name: "Escudo Espiritual (reducción)",dice: `${barbarianShieldDice(level)}d6`,bonus: 0,damageType: "Reducción de daño",description: shield!.description });
  if (path === "storm-herald" && environment) extras.push({ key: "storm-aura",name: `Aura de Tormenta: ${STORM_ENVIRONMENTS[environment]}`,dice: environment === "sea" ? `${stormSeaDice(level)}d6` : String(stormAuraAmount(level)),bonus: 0,damageType: environment === "sea" ? "lightning" : environment === "desert" ? "fire" : "PG temporales",description: STORM_FEATURES[environment][3] });
  for (const extra of extras) {
    const id = await createDeterministicId("act",character.id,"builder",extra.key), old = character.actions.find((a) => a.id === id);
    character.actions = [...character.actions.filter((a) => a.id !== id),{ id,order: old?.order ?? character.actions.length,name: extra.name,categories: ["other"],activation: extra.key === "spirit-shield" ? "Reacción" : extra.key === "storm-aura" ? "Al entrar en furia o acción adicional" : "Primer impacto con arma de tu turno",reach: extra.key === "spirit-shield" ? "Otra criatura visible a 30 pies" : extra.key === "storm-aura" ? "Aura de 10 pies" : "Según el arma",ability: null,proficient: false,attackBonus: 0,damageExpression: extra.dice,damageBonus: extra.bonus,damageType: extra.damageType,weaponType: "",properties: "",description: extra.description,inventoryItemId: null,rollMode: "normal" }];
  }
  return CharacterV2Schema.parse(character);
}
export async function createGuidedBarbarian(id: string,operationId: string,input: FighterCreationInput,createdAt: string,initialLevels: FighterLevelChoiceInput[] = []) {
  const creation = validateBarbarianCreation(input), state = validateBarbarianBuild({ schemaVersion: 1,packageVersion: 1,ruleset: "dnd5e-2014",classKey: "barbarian",creationOperationId: operationId,creation,levels: [] });
  let character = await applyBarbarianBenefits(await createBuilderCharacter(id,state,createdAt));
  if (initialLevels.length !== creation.startingLevel-1) throw new Error("Completá las elecciones de todos los niveles iniciales.");
  for (const step of initialLevels) character = await advanceGuidedBarbarian(character,step,createdAt);
  return finishBuilderCreation(character);
}

export async function advanceGuidedBarbarian(input: CharacterV2,choiceInput: FighterLevelChoiceInput,updatedAt: string) {
  const character = CharacterV2Schema.parse(input), choice = FighterLevelChoiceSchema.parse(choiceInput);
  if (character.builder?.classKey !== "barbarian") throw new Error("La ficha no tiene historial guiado de Bárbaro.");
  const previous = validateBarbarianBuild(character.builder), existing = previous.levels.find((s) => s.operationId === choice.operationId);
  if (existing) { if (canonicalJsonStringify(existing as unknown as JsonValue) !== canonicalJsonStringify(choice as unknown as JsonValue)) throw new Error("La operación ya se confirmó con otras elecciones."); return character; }
  if (choice.operationId === previous.creationOperationId || choice.level !== character.identity.level+1 || choice.level !== previous.levels.length+2 || character.identity.className !== "Bárbaro" || character.identity.subclass !== (barbarianPath(previous) ? `Senda del ${BARBARIAN_PATHS[barbarianPath(previous)!]}` : "")) throw new Error("La ficha cambió o el nivel no coincide con su historial.");
  const scores = fighterBuilderScores(previous);
  if (BUILDER_ABILITIES.some((a) => character.abilities[a] !== scores[a])) throw new Error("Los atributos se editaron fuera del tutorial.");
  const next = validateBarbarianBuild({ ...previous,levels: [...previous.levels,choice] }), abilities = fighterBuilderScores(next);
  const maximum = character.combat.hitPoints.maximum+fighterBuilderMaximumHp(next)-fighterBuilderMaximumHp(previous);
  const actions = await Promise.all(character.actions.map(async (a) => {
    const item = character.inventory.find((i) => i.id === a.inventoryItemId);
    if (!item?.weapon || !a.ability) return a;
    const ability = a.id === await createDeterministicId("act",character.id,"builder-weapon",item.id) && a.ability === preferredWeaponAbility(scores,item) ? preferredWeaponAbility(abilities,item) : a.ability;
    return { ...a,ability,damageBonus: a.damageExpression ? a.damageBonus+abilityModifier(abilities[ability])-abilityModifier(scores[a.ability]) : a.damageBonus };
  }));
  let result = CharacterV2Schema.parse({ ...character,builder: next,abilities,actions,revision: character.revision+1,metadata: { ...character.metadata,updatedAt },identity: { ...character.identity,level: choice.level },combat: { ...character.combat,hitPoints: { ...character.combat.hitPoints,maximum,current: Math.min(character.combat.hitPoints.current,maximum) },hitDice: { ...character.combat.hitDice,maximum: choice.level,remaining: character.combat.hitDice.remaining+1,current: String(character.combat.hitDice.remaining+1),formula: `${choice.level}d12` } } });
  result = await applyAdditionalFighterBenefits(result,character);
  result = await applyBarbarianBenefits(result);
  result.combat.armorClass = projectInventory(result).calculatedArmorClass;
  result.combat.speed = projectUpdatedBuilderSpeed(character,result);
  return result;
}
