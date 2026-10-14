import { CharacterV2Schema,type CharacterV2 } from "./character-v2";
import { CharacterBuilderStateSchema,FighterCreationSchema,FighterLevelChoiceSchema,BUILDER_ABILITIES,type CharacterBuilderState,type FighterCreationInput,type FighterLevelChoiceInput } from "./character-builder-model";
import { validateBuilderOrigin,fighterBuilderScores,fighterBuilderMaximumHp,createBuilderCharacter,finishBuilderCreation } from "./fighter-builder";
import { validateFeat,builderFeats,distinct } from "./fighter-build-rules";
import { applyAdditionalFighterBenefits } from "./fighter-builder-grants";
import { PHB_SPELLS,classSpells } from "./phb-spells";
import { DRUID_CIRCLES,DRUID_LANDS,DRUID_CORE,DRUID_FEATURES,HERBALISM,druidCircle,druidLand,druidCantrips,druidCircleSpells } from "./druid-catalog";
import { WIZARD_SLOTS,WIZARD_ASI_LEVELS } from "./wizard-catalog";
import { BUILDER_WEAPONS } from "./fighter-builder-catalog";
import { CharacterSpellV2Schema } from "./character-spell-model";
import { DruidRuntimeSchema } from "./druid-model";
import { traitGroup,type TraitDefinition } from "./builder-traits";
import { abilityModifier,projectAbilityScore,projectInventory,preferredWeaponAbility,projectUpdatedBuilderSpeed } from "./character-projection";
import { createDeterministicId } from "../../shared/id";
import { canonicalJsonStringify,type JsonValue } from "../../shared/json";
export const druidPreparationLimit = (c: CharacterV2) => Math.max(1,c.identity.level+abilityModifier(projectAbilityScore(c,"wisdom")));
export const druidSpellKeys = (s: CharacterBuilderState,level = s.levels.length+1) => [...new Set([...classSpells("druid",1,WIZARD_SLOTS[level]!.length),...druidCircleSpells(s,level)])];
export function replayDruidChoices(state: CharacterBuilderState) {
  const cantrips: string[] = [];
  for (const [level,c] of [[1,state.creation.druid],...state.levels.map((s) => [s.level,s.druid] as const)] as const) {
    const partial = { ...state,levels: state.levels.filter((s) => s.level <= level) },circle = druidCircle(partial);
    if ((level === 2) !== !!c.circle) throw new Error("Elegí un círculo únicamente al adquirir Druida 2.");
    if ((level === 3 && circle === "land") !== !!c.land) throw new Error("El terreno se elige únicamente en Círculo de la Tierra 3.");
    const other = [state.creation.origin.cantrip,...(state.creation.race === "forest-gnome" ? ["minor-illusion"] : []),...builderFeats({ ...state,levels: state.levels.filter((s) => s.level < level) }).flatMap(({ feat }) => feat.spells.filter((key) => PHB_SPELLS[key]?.level === 0))].filter(Boolean);
    const count = level === 1 ? 2 : druidCantrips(level)-druidCantrips(level-1),keys = [...c.cantrips,...(c.bonusCantrip ? [c.bonusCantrip] : [])];
    if (c.cantrips.length !== count || (level === 2 && circle === "land") !== !!c.bonusCantrip || !distinct([...cantrips,...keys]) || keys.some((key) => !classSpells("druid",0).includes(key) || other.includes(key))) throw new Error("Elegí los trucos nuevos de Druida que correspondan, sin repetir; Tierra agrega un truco en nivel 2.");
    cantrips.push(...keys);
    if (c.prepared !== null) {
      const free = druidCircleSpells(partial,level),available = druidSpellKeys(partial,level),scores = fighterBuilderScores(partial);
      if (!distinct(c.prepared) || c.prepared.some((key) => !available.includes(key)) || c.prepared.filter((key) => !free.includes(key)).length > Math.max(1,level+abilityModifier(scores.wisdom))) throw new Error("Prepará conjuros disponibles hasta nivel de Druida + SAB; los conjuros del círculo no ocupan cupo.");
    }
  }
  return { cantrips,circle: druidCircle(state),land: druidLand(state),circleSpells: druidCircleSpells(state) };
}
export function validateDruidCreation(input: FighterCreationInput) {
  const c = FighterCreationSchema.parse(input);
  if (c.classKey !== "druid") throw new Error("Este recorrido requiere Druida.");
  validateBuilderOrigin(c);
  if (c.background.tools.includes(HERBALISM)) throw new Error("Druida ya concede Kit de herborista; elegí otra competencia de herramientas en el trasfondo personalizado.");
  if (c.equipment.method === "packages" && (c.druidPrimary !== "shield" && !BUILDER_WEAPONS[c.druidPrimary]?.weapon?.category.startsWith("simple") || c.druidWeapon !== "scimitar" && (!BUILDER_WEAPONS[c.druidWeapon]?.weapon?.category.startsWith("simple") || BUILDER_WEAPONS[c.druidWeapon]?.weapon?.range !== "melee"))) throw new Error("Elegí escudo de madera o arma sencilla; además cimitarra o arma sencilla cuerpo a cuerpo.");
  replayDruidChoices({ schemaVersion: 1,packageVersion: 1,ruleset: "dnd5e-2014",classKey: "druid",creationOperationId: "build_00000000000000000000000000000000",creation: c,levels: [] });
  return c;
}
export function validateDruidBuild(input: CharacterBuilderState) {
  const state = CharacterBuilderStateSchema.parse(input); validateDruidCreation(state.creation);
  if (state.classKey !== "druid") throw new Error("El historial no corresponde a Druida.");
  for (const [index,step] of state.levels.entries()) {
    if (step.hpBase > 8 || step.hpMethod === "fixed" && step.hpBase !== 5) throw new Error("Druida usa 5 PG fijos o una tirada de d8, antes de Constitución.");
    if (step.subclass || step.additionalStyle || step.maneuvers.length || step.maneuverReplacement || step.artisanTool || step.magic.learn.length || step.magic.cantrips.length || step.magic.replace) throw new Error("Druida no concede elecciones de Guerrero.");
    const previous = { ...state,levels: state.levels.slice(0,index) };
    if (WIZARD_ASI_LEVELS.includes(step.level)) {
      if (step.skipImprovement) { if (step.feat || step.abilityIncrease) throw new Error("La renuncia debe dejar vacías las elecciones."); }
      else if (step.feat) { if (step.abilityIncrease) throw new Error("Elegí mejora o dote."); validateFeat(step.feat,fighterBuilderScores(previous),previous); }
      else if (!step.abilityIncrease || Object.values(step.abilityIncrease).reduce((a,b) => a+b,0) !== 2) throw new Error("Distribuí dos puntos de atributo o elegí una dote permitida.");
    } else if (step.feat || step.abilityIncrease || step.skipImprovement) throw new Error("Este nivel de Druida no concede mejora ni dote.");
    if (Object.values(fighterBuilderScores({ ...state,levels: state.levels.slice(0,index+1) })).some((n) => n > 20)) throw new Error("Las mejoras no pueden superar 20.");
  }
  replayDruidChoices(state); return state;
}
export async function applyDruidBenefits(input: CharacterV2,previous: CharacterV2|null = null) {
  const c = CharacterV2Schema.parse(input),state = c.builder!,level = c.identity.level,replay = replayDruidChoices(state),r = DruidRuntimeSchema.parse(c.spellcasting.druid ?? {});
  c.identity.className = "Druida";c.identity.subclass = replay.circle ? DRUID_CIRCLES[replay.circle]+(replay.land ? ` · ${DRUID_LANDS[replay.land]}` : "") : "";c.spellcasting.ability = "wisdom";
  if (replay.circle === "shepherd") c.proficiencies.languages = [...new Set([...c.proficiencies.languages,"Silvano"])];
  const definitions: TraitDefinition[] = [...DRUID_CORE,...(replay.circle ? DRUID_FEATURES[replay.circle] : [])].filter((f) => f.level <= level).map((f) => ({ ...f }));
  if (level === 20) { const wild = definitions.find((f) => f.key === "wild-shape")!;wild.maximum = 0;wild.reset = "none"; }
  const balm = definitions.find((f) => f.key === "balm");if (balm) { balm.maximum = level;balm.reset = "long-rest"; }
  const paths = definitions.find((f) => f.key === "hidden-paths");if (paths) { paths.maximum = Math.max(1,abilityModifier(projectAbilityScore(c,"wisdom")));paths.reset = "long-rest"; }
  const group = await traitGroup(c,"druid",`Druida${replay.circle ? ` · ${DRUID_CIRCLES[replay.circle]}` : ""}`,definitions);if (level === 20) group.traits.find((t) => t.name === "Forma Salvaje")!.uses.used = 0;
  definitions.forEach((d,i) => { r.resourceIds[d.key] = group.traits[i]!.id; });c.traits = [...c.traits.filter((g) => g.id !== group.id),group];
  for (let n=1;n<=9;n++) c.spellcasting.slots[String(n)] = { maximum: WIZARD_SLOTS[level]![n-1] ?? 0,used: c.spellcasting.slots[String(n)]?.used ?? 0 };
  const choice = level === 1 ? state.creation.druid : state.levels.at(-1)!.druid;
  const daily = choice.prepared ?? (previous ? previous.spellcasting.spells.filter((s) => s.casting?.kind === "druid" && s.level > 0 && s.prepared && !druidCircleSpells(previous.builder!).includes(s.casting.key)).map((s) => s.casting!.key) : druidSpellKeys(state).filter((key) => !replay.circleSpells.includes(key)).slice(0,druidPreparationLimit(c)));
  const keys = [...new Set([...replay.cantrips,...druidSpellKeys(state)])];
  const generated = await Promise.all(keys.map(async (key,index) => {
    const id = await createDeterministicId("spl",c.id,"druid",key),old = c.spellcasting.spells.find((s) => s.id === id),definition = PHB_SPELLS[key];if (!definition) throw new Error(`Falta el conjuro del círculo ${key}.`);
    return CharacterSpellV2Schema.parse({ id,name: definition.name,level: definition.level,order: old?.order ?? index,prepared: definition.level === 0 || daily.includes(key) || replay.circleSpells.includes(key),definition: structuredClone(definition),effect: old?.effect ?? { description: "",active: false },casting: { source: "builder:druid",key,ability: "wisdom",kind: "druid",traitId: null,level: definition.level } });
  }));
  if (replay.circle === "moon" && level >= 14) { const key = "alter-self",definition = PHB_SPELLS[key]!;generated.push(CharacterSpellV2Schema.parse({ id: await createDeterministicId("spl",c.id,"druid-thousand-forms"),name: `${definition.name} · Mil Formas`,level: 2,order: generated.length,prepared: true,definition: structuredClone(definition),casting: { source: "builder:druid-moon",key,ability: "wisdom",kind: "at-will",traitId: null,level: 2 } })); }
  c.spellcasting.spells = [...c.spellcasting.spells.filter((s) => !s.casting?.source.startsWith("builder:druid")),...generated];c.spellcasting.druid = r;return CharacterV2Schema.parse(c);
}

export async function createGuidedDruid(id: string,operationId: string,input: FighterCreationInput,createdAt: string,initialLevels: FighterLevelChoiceInput[] = []) {
  const creation = validateDruidCreation(input), state = validateDruidBuild({ schemaVersion: 1,packageVersion: 1,ruleset: "dnd5e-2014",classKey: "druid",creationOperationId: operationId,creation,levels: [] });
  let character = await applyDruidBenefits(await createBuilderCharacter(id,state,createdAt));
  if (initialLevels.length !== creation.startingLevel-1) throw new Error("Completá todos los niveles iniciales.");
  for (const step of initialLevels) character = await advanceGuidedDruid(character,step,createdAt);
  return finishBuilderCreation(character);
}
export async function advanceGuidedDruid(input: CharacterV2,choiceInput: FighterLevelChoiceInput,updatedAt: string) {
  const character = CharacterV2Schema.parse(input),choice = FighterLevelChoiceSchema.parse(choiceInput);
  if (character.builder?.classKey !== "druid") throw new Error("Esta ficha no tiene historial guiado de Druida.");
  const previous = validateDruidBuild(character.builder), old = previous.levels.find((step) => step.operationId === choice.operationId);
  if (old) { if (canonicalJsonStringify(old as unknown as JsonValue) !== canonicalJsonStringify(choice as unknown as JsonValue)) throw new Error("Esta operación ya se confirmó con otras elecciones."); return character; }
  const scores = fighterBuilderScores(previous);
  if (choice.operationId === previous.creationOperationId || character.identity.level !== previous.levels.length+1 || choice.level !== character.identity.level+1 || character.identity.className !== "Druida" || character.identity.subclass !== (druidCircle(previous) ? DRUID_CIRCLES[druidCircle(previous)!]+(druidLand(previous) ? ` \u00b7 ${DRUID_LANDS[druidLand(previous)!]}` : "") : "") || BUILDER_ABILITIES.some((key) => character.abilities[key] !== scores[key])) throw new Error("La ficha cambió fuera del tutorial o no coincide con su historial.");
  const next = validateDruidBuild({ ...previous,levels: [...previous.levels,choice] }), abilities = fighterBuilderScores(next), maximum = character.combat.hitPoints.maximum+fighterBuilderMaximumHp(next)-fighterBuilderMaximumHp(previous);
  const actions = await Promise.all(character.actions.map(async (action) => {
    const item = character.inventory.find((i) => i.id === action.inventoryItemId); if (!item?.weapon || !action.ability) return action;
    const generated = action.id === await createDeterministicId("act",character.id,"builder-weapon",item.id), ability = generated && action.ability === preferredWeaponAbility(scores,item) ? preferredWeaponAbility(abilities,item) : action.ability;
    return { ...action,ability,damageBonus: action.damageExpression ? action.damageBonus+abilityModifier(abilities[ability])-abilityModifier(scores[action.ability]) : action.damageBonus };
  }));
  let result = CharacterV2Schema.parse({ ...character,builder: next,abilities,actions,revision: character.revision+1,metadata: { ...character.metadata,updatedAt },identity: { ...character.identity,level: choice.level },combat: { ...character.combat,hitPoints: { ...character.combat.hitPoints,maximum,current: Math.min(character.combat.hitPoints.current,maximum) },hitDice: { ...character.combat.hitDice,maximum: choice.level,remaining: character.combat.hitDice.remaining+1,current: String(character.combat.hitDice.remaining+1),formula: `${choice.level}d8` } } });
  result = await applyAdditionalFighterBenefits(result,character); result = await applyDruidBenefits(result,character);
  result.combat.armorClass = projectInventory(result).calculatedArmorClass; result.combat.speed = projectUpdatedBuilderSpeed(character,result);
  return CharacterV2Schema.parse(result);
}
