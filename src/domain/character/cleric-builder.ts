import { CharacterV2Schema, type CharacterV2 } from "./character-v2";
import { BUILDER_ABILITIES, CharacterBuilderStateSchema, FighterCreationSchema, FighterLevelChoiceSchema, type CharacterBuilderState, type FighterCreationInput, type FighterLevelChoiceInput } from "./character-builder-model";
import { validateBuilderOrigin, fighterBuilderScores, fighterBuilderMaximumHp, createBuilderCharacter, finishBuilderCreation } from "./fighter-builder";
import { builderFeats, distinct, racialSkillGrants, validateFeat } from "./fighter-build-rules";
import { applyAdditionalFighterBenefits } from "./fighter-builder-grants";
import { CLERIC_DOMAINS, CLERIC_FEATURES, KNOWLEDGE_SKILLS, NATURE_SKILLS, clericCantripCount, clericChannelUses, clericDestroyCr, clericDomainSpells, clericHeavyArmor, clericMartialWeapons } from "./cleric-catalog";
import { ClericRuntimeSchema } from "./cleric-model";
import { WIZARD_ASI_LEVELS, WIZARD_SLOTS } from "./wizard-catalog";
import { PHB_SPELLS, classSpells } from "./phb-spells";
import { LANGUAGES } from "./phb-character-options";
import { BUILDER_RACES, BUILDER_WEAPONS } from "./fighter-builder-catalog";
import { CharacterSpellV2Schema } from "./character-spell-model";
import { traitGroup, type TraitDefinition } from "./builder-traits";
import { abilityModifier, projectAbilityScore, projectInventory, projectUpdatedBuilderSpeed, preferredWeaponAbility } from "./character-projection";
import { createDeterministicId } from "../../shared/id";
import { canonicalJsonStringify, type JsonValue } from "../../shared/json";
import type { SkillKey } from "./character-checks";

export function clericPreparationLimit(character: CharacterV2) { return Math.max(1,character.identity.level+abilityModifier(projectAbilityScore(character,"wisdom"))); }
export function clericSpellKeys(state: CharacterBuilderState, level = state.levels.length+1) {
  const domain = state.creation.cleric.domain!;
  return [...new Set([...classSpells("cleric",1,WIZARD_SLOTS[level]!.length),...clericDomainSpells(domain,level)])];
}
function validateCantrips(keys: string[], count: number, known: string[]) {
  if (keys.length !== count || !distinct([...known,...keys]) || keys.some((key) => !PHB_SPELLS[key]?.classes.includes("cleric") || PHB_SPELLS[key]!.level !== 0)) throw new Error(`Elegí ${count} trucos de clérigo distintos que todavía no conozcas.`);
}
export function replayClericChoices(state: CharacterBuilderState) {
  const c = state.creation, choices = c.cleric, domain = choices.domain;
  if (!domain) throw new Error("Elegí un dominio divino de Clérigo.");
  const otherCantrips = [c.origin.cantrip,...(c.race === "forest-gnome" ? ["minor-illusion"] : []),...(c.initialFeat?.spells.filter((key) => PHB_SPELLS[key]?.level === 0) ?? [])].filter(Boolean);
  const domainCantrip = domain === "light" ? "light" : domain === "grave" ? "spare-the-dying" : null;
  validateCantrips(choices.cantrips,3,[...new Set([...otherCantrips,...(domainCantrip ? [domainCantrip] : [])])]);
  const cantrips = [...choices.cantrips];
  if (domain === "light" && ![...cantrips,...otherCantrips].includes("light")) cantrips.push("light");
  if (domain === "grave" && !cantrips.includes("spare-the-dying")) cantrips.push("spare-the-dying");
  if (domain === "nature") {
    if (!PHB_SPELLS[choices.natureCantrip]?.classes.includes("druid") || PHB_SPELLS[choices.natureCantrip]?.level !== 0 || [...cantrips,...otherCantrips].includes(choices.natureCantrip)) throw new Error("Acólito de la Naturaleza requiere un truco de druida nuevo.");
    cantrips.push(choices.natureCantrip);
  } else if (choices.natureCantrip) throw new Error("El truco de druida corresponde únicamente a Naturaleza.");
  const skills = domain === "knowledge" ? KNOWLEDGE_SKILLS : domain === "nature" ? NATURE_SKILLS : [];
  const quota = domain === "knowledge" ? 2 : domain === "nature" ? 1 : 0;
  if (choices.skills.length !== quota || !distinct(choices.skills) || choices.skills.some((s) => !skills.includes(s))) throw new Error(`Este dominio requiere ${quota} habilidades de su lista.`);
  if (!distinct([...c.skills,...c.background.skills,...racialSkillGrants(c),...choices.skills])) throw new Error("Las habilidades de dominio deben ser distintas de las de clase, raza y trasfondo; personalizá las repetidas.");
  const langs = [...BUILDER_RACES[c.race].languages,...c.languages,...c.background.languages,...choices.languages];
  if (choices.languages.length !== (domain === "knowledge" ? 2 : 0) || !distinct(langs) || choices.languages.some((l) => !LANGUAGES.includes(l))) throw new Error("Conocimiento requiere dos idiomas adicionales distintos de los que ya conocés.");
  for (const [level, pick] of [[1,choices],...state.levels.map((step) => [step.level,step.cleric] as const)] as const) {
    if (level > 1) {
      if (pick.domain || pick.deity || pick.skills.length || pick.languages.length || pick.natureCantrip) throw new Error("El dominio y sus elecciones de origen se eligen al adquirir Clérigo 1.");
      const priorFeat = builderFeats({ ...state,levels: state.levels.filter((s) => s.level < level) }).flatMap(({ feat }) => feat.spells).filter((key) => PHB_SPELLS[key]?.level === 0);
      validateCantrips(pick.cantrips,clericCantripCount(level)-clericCantripCount(level-1),[...new Set([...cantrips,...otherCantrips,...priorFeat])]);
      cantrips.push(...pick.cantrips);
    }
    if (pick.prepared !== null) {
      const available = clericSpellKeys(state,level), free = clericDomainSpells(domain,level), scores = fighterBuilderScores({ ...state,levels: state.levels.filter((s) => s.level <= level) });
      if (!distinct(pick.prepared) || pick.prepared.some((key) => !available.includes(key)) || pick.prepared.filter((key) => !free.includes(key)).length > Math.max(1,level+abilityModifier(scores.wisdom))) throw new Error("Prepará conjuros de clérigo disponibles hasta nivel + SAB (mínimo uno); el dominio no ocupa cupo.");
    }
  }
  return { cantrips,domain,domainSpells: clericDomainSpells(domain,state.levels.length+1) };
}
export function validateClericCreation(input: FighterCreationInput) {
  const c = FighterCreationSchema.parse(input);
  if (c.classKey !== "cleric") throw new Error("Este recorrido requiere Clérigo.");
  validateBuilderOrigin(c);
  if (c.cleric.domain === "forge" && (c.background.tools.includes("Herramientas de herrero") || c.dwarfTool === "smith")) throw new Error("Forja ya concede herramientas de herrero; elegí otra competencia de trasfondo o raza.");
  const state: CharacterBuilderState = { schemaVersion: 1,packageVersion: 1,ruleset: "dnd5e-2014",classKey: "cleric",creationOperationId: "build_00000000000000000000000000000000",creation: c,levels: [] };
  replayClericChoices(state);
  if (c.equipment.method === "packages") {
    const dwarf = c.race.includes("dwarf"), martial = clericMartialWeapons(c.cleric.domain);
    if (c.clericWeapon === "warhammer" && !dwarf && !martial && !(c.initialFeat?.key === "weapon-master" && c.initialFeat.weapons.includes("warhammer"))) throw new Error("El martillo de guerra inicial requiere competencia: dominio, raza o dote.");
    if (c.clericArmor === "chain-mail" && !clericHeavyArmor(c.cleric.domain) && c.initialFeat?.key !== "heavily-armored") throw new Error("La cota de malla inicial requiere competencia en armadura pesada.");
    if (!BUILDER_WEAPONS[c.clericSecondary]?.weapon?.category.startsWith("simple")) throw new Error("El arma adicional debe ser un arma simple.");
  }
  return c;
}
export function validateClericBuild(input: CharacterBuilderState) {
  const state = CharacterBuilderStateSchema.parse(input);
  if (state.classKey !== "cleric") throw new Error("El historial no corresponde a Clérigo.");
  validateClericCreation(state.creation);
  for (const [i,step] of state.levels.entries()) {
    if (step.hpBase > 8 || step.hpMethod === "fixed" && step.hpBase !== 5) throw new Error("Clérigo usa 5 PG fijos o un resultado de d8, antes de Constitución.");
    if (step.subclass || step.additionalStyle || step.maneuvers.length || step.maneuverReplacement || step.artisanTool || step.magic.cantrips.length || step.magic.learn.length || step.magic.replace || step.wizard.cantrips.length || step.wizard.learn.length || step.wizard.bonusCantrip || step.wizard.mastery.length || step.wizard.signature.length || step.wizard.prepared || Object.values(step.warlock).some((v) => Array.isArray(v) ? v.length : v !== null && v !== "")) throw new Error("Este nivel no concede elecciones de Guerrero, Mago ni Brujo.");
    const prior = { ...state,levels: state.levels.slice(0,i) };
    if (WIZARD_ASI_LEVELS.includes(step.level)) {
      if (step.skipImprovement) { if (step.feat || step.abilityIncrease) throw new Error("Renunciar requiere dejar las elecciones vacías."); }
      else if (step.feat) { if (step.abilityIncrease) throw new Error("Elegí dote o mejora, no ambas."); validateFeat(step.feat,fighterBuilderScores(prior),prior); }
      else if (!step.abilityIncrease || Object.values(step.abilityIncrease).reduce((a,b) => a+b,0) !== 2 || Object.values(step.abilityIncrease).some((n) => n > 2)) throw new Error("Distribuí dos puntos de atributo o elegí una dote.");
    } else if (step.feat || step.abilityIncrease || step.skipImprovement) throw new Error("Este nivel no concede mejora de atributos.");
    if (Object.values(fighterBuilderScores({ ...state,levels: state.levels.slice(0,i+1) })).some((n) => n > 20)) throw new Error("Una mejora no puede superar 20.");
  }
  replayClericChoices(state);
  return state;
}
export async function applyClericBenefits(input: CharacterV2, previous: CharacterV2 | null = null) {
  const character = CharacterV2Schema.parse(input), state = character.builder!, level = character.identity.level;
  const replay = replayClericChoices(state), domain = replay.domain, wisdom = Math.max(1,abilityModifier(character.abilities.wisdom));
  const runtime = ClericRuntimeSchema.parse(character.spellcasting.cleric ?? {});
  character.identity.className = "Clérigo";
  character.identity.subclass = `Dominio de ${CLERIC_DOMAINS[domain]}`;
  character.spellcasting.ability = "wisdom";
  for (const skill of state.creation.cleric.skills) character.checks.skills[skill as SkillKey].proficiency = Math.max(character.checks.skills[skill as SkillKey].proficiency,domain === "knowledge" ? 2 : 1) as 1|2;
  character.proficiencies.languages = [...new Set([...character.proficiencies.languages,...state.creation.cleric.languages])];
  if (domain === "forge") character.proficiencies.tools = [...new Set([...character.proficiencies.tools,"Herramientas de herrero"])];
  const definitions: TraitDefinition[] = [
    { key: "spellcasting",name: "Lanzamiento de conjuros de clérigo",description: "Sabiduría. Preparás desde toda la lista disponible, hasta nivel de clérigo + SAB (mínimo uno). Tras descanso largo podés cambiarla, orando al menos un minuto por nivel de cada conjuro preparado. Conjuros de dominio siempre preparados, fuera de cupo. Trucos permanentes; no se sustituyen al subir en estas reglas." },
    { key: "ritual",name: "Conjuración ritual y foco divino",description: "Un ritual de clérigo debe estar preparado, incluido dominio; suma diez minutos, sin espacio. Símbolo sagrado como foco: sostenido, visible o en escudo. Materiales con precio o consumidos requieren aportarse; componentes somáticos pueden exigir mano libre. Armadura/escudo sin competencia impiden lanzar." },
    ...CLERIC_FEATURES[domain].filter((f) => f.level <= level).map((f) => ({ ...f })),
  ];
  if (level >= 2) definitions.push({ key: "channel",name: "Canalizar Divinidad",description: "Recurso compartido por Expulsar Muertos Vivientes y todas las opciones de dominio. Recuperás todos los usos tras descanso corto o largo. CD = 8 + competencia + SAB.",maximum: clericChannelUses(level),reset: "short-rest" },{ key: "turn-undead",name: "Expulsar Muertos Vivientes",description: "Acción y símbolo sagrado: muertos vivientes que vean u oigan a 30 pies hacen SAB. Fallo: expulsados 1 minuto o hasta recibir daño; deben alejarse, sin reacciones, y solo Carrera/escapar de impedimentos (Esquivar si no pueden moverse). No pueden acercarse voluntariamente a 30 pies. Gasta el recurso compartido de Canalizar Divinidad." });
  const cr = clericDestroyCr(level);
  if (cr) definitions.push({ key: "destroy-undead",name: "Destruir Muertos Vivientes",description: `Al fallar la salvación contra Expulsar Muertos Vivientes, destrucción instantánea si su VD es ${cr} o menor. No se aplica a otros efectos de Canalizar Divinidad.` });
  if (level >= 8) {
    if (["knowledge","light","grave"].includes(domain)) definitions.push({ key: "potent-spellcasting",name: "Lanzamiento de Conjuros Potente",description: "Sumá tu modificador de Sabiduría al daño de cualquier truco de clérigo." });
    else definitions.push({ key: "divine-strike",name: "Golpe Divino",description: `Una vez en cada uno de tus turnos, al impactar con arma, podés añadir ${level >= 14 ? "2d8" : "1d8"} de ${({ life: "radiante",nature: "frío, fuego o rayo a elección",tempest: "trueno",trickery: "veneno",war: "mismo tipo que el arma",forge: "fuego" } as Record<string,string>)[domain]}. Se resuelve por impacto, sin sumarlo a todos los ataques.` });
  }
  if (level >= 10) definitions.push({ key: "intervention",name: "Intervención Divina",description: `Acción: describí ayuda y tirá d100; éxito con ${level} o menos${level === 20 ? " (en nivel 20 es automático)" : ""}. El GM decide la ayuda. Éxito: siete días sin usarlo; fallo: vuelve tras descanso largo. Los días se registran aparte; descansar no elimina la espera de siete días.`,maximum: 1,reset: "long-rest" });
  for (const definition of definitions) {
    if (["warding-flare","wrath-storm","war-priest","eyes-grave","sentinel-death"].includes(definition.key)) { definition.maximum = wisdom; definition.reset = "long-rest"; }
    if (definition.key === "visions") { definition.maximum = 1; definition.reset = "short-rest"; }
  }
  const group = await traitGroup(character,"cleric",`Clérigo · ${CLERIC_DOMAINS[domain]}`,definitions);
  definitions.forEach((d,i) => { runtime.resourceIds[d.key] = group.traits[i]!.id; });
  character.traits = [...character.traits.filter((g) => g.id !== group.id),group];
  for (let n=1;n<=9;n++) character.spellcasting.slots[String(n)] = { maximum: WIZARD_SLOTS[level]![n-1] ?? 0,used: character.spellcasting.slots[String(n)]?.used ?? 0 };
  const choice = level === 1 ? state.creation.cleric : state.levels.at(-1)!.cleric;
  const daily = choice.prepared ?? (previous ? previous.spellcasting.spells.filter((s) => s.casting?.source === "builder:cleric" && s.level > 0 && s.prepared && !clericDomainSpells(domain,previous.identity.level).includes(s.casting.key)).map((s) => s.casting!.key) : clericSpellKeys(state).filter((key) => !replay.domainSpells.includes(key)).slice(0,clericPreparationLimit(character)));
  const keys = [...new Set([...replay.cantrips,...clericSpellKeys(state)])];
  const spells = await Promise.all(keys.map(async (key,index) => {
    const definition = PHB_SPELLS[key];
    if (!definition) throw new Error(`Falta el conjuro de dominio ${key} en el catálogo.`);
    const id = await createDeterministicId("spl",character.id,"builder-spell","cleric",key), old = character.spellcasting.spells.find((s) => s.id === id);
    const localized = structuredClone(definition);
    if (domain === "grave" && key === "spare-the-dying") { localized.range = "30 pies"; localized.castingTime = "1 acción o 1 acción adicional"; }
    return CharacterSpellV2Schema.parse({ id,name: definition.name,level: definition.level,order: old?.order ?? index,prepared: definition.level === 0 || daily.includes(key) || replay.domainSpells.includes(key),definition: localized,casting: { source: "builder:cleric",key,ability: "wisdom",kind: "cleric",level: definition.level,traitId: null },effect: old?.effect ?? { description: "",active: false } });
  }));
  character.spellcasting.spells = [...character.spellcasting.spells.filter((s) => s.casting?.source !== "builder:cleric"),...spells];
  character.spellcasting.cleric = runtime;
  return CharacterV2Schema.parse(character);
}
export async function createGuidedCleric(id: string,operationId: string,input: FighterCreationInput,createdAt: string,initialLevels: FighterLevelChoiceInput[] = []) {
  const creation = validateClericCreation(input), state = validateClericBuild({ schemaVersion: 1,packageVersion: 1,ruleset: "dnd5e-2014",classKey: "cleric",creationOperationId: operationId,creation,levels: [] });
  let character = await applyClericBenefits(await createBuilderCharacter(id,state,createdAt));
  if (initialLevels.length !== creation.startingLevel-1) throw new Error("Completá las elecciones de todos los niveles iniciales.");
  for (const step of initialLevels) character = await advanceGuidedCleric(character,step,createdAt);
  return finishBuilderCreation(character);
}
export async function advanceGuidedCleric(input: CharacterV2,choiceInput: FighterLevelChoiceInput,updatedAt: string) {
  const character = CharacterV2Schema.parse(input), choice = FighterLevelChoiceSchema.parse(choiceInput);
  if (character.builder?.classKey !== "cleric") throw new Error("La ficha no tiene historial guiado de Clérigo.");
  const previous = validateClericBuild(character.builder), existing = previous.levels.find((s) => s.operationId === choice.operationId);
  if (existing) { if (canonicalJsonStringify(existing as unknown as JsonValue) !== canonicalJsonStringify(choice as unknown as JsonValue)) throw new Error("La operación ya se confirmó con otras elecciones."); return character; }
  if (choice.operationId === previous.creationOperationId || choice.level !== character.identity.level+1 || choice.level !== previous.levels.length+2 || character.identity.className !== "Clérigo" || character.identity.subclass !== `Dominio de ${CLERIC_DOMAINS[previous.creation.cleric.domain!]}`) throw new Error("La ficha cambió o el nivel no coincide con su historial.");
  const scores = fighterBuilderScores(previous);
  if (BUILDER_ABILITIES.some((a) => character.abilities[a] !== scores[a])) throw new Error("Los atributos se editaron fuera del tutorial.");
  const next = validateClericBuild({ ...previous,levels: [...previous.levels,choice] }), abilities = fighterBuilderScores(next);
  const maximum = character.combat.hitPoints.maximum+fighterBuilderMaximumHp(next)-fighterBuilderMaximumHp(previous);
  const actions = await Promise.all(character.actions.map(async (a) => {
    const item = character.inventory.find((i) => i.id === a.inventoryItemId);
    if (!item?.weapon || !a.ability) return a;
    const ability = a.id === await createDeterministicId("act",character.id,"builder-weapon",item.id) && a.ability === preferredWeaponAbility(scores,item) ? preferredWeaponAbility(abilities,item) : a.ability;
    return { ...a,ability,damageBonus: a.damageExpression ? a.damageBonus+abilityModifier(abilities[ability])-abilityModifier(scores[a.ability]) : a.damageBonus };
  }));
  let result = CharacterV2Schema.parse({ ...character,builder: next,abilities,actions,revision: character.revision+1,metadata: { ...character.metadata,updatedAt },identity: { ...character.identity,level: choice.level },combat: { ...character.combat,hitPoints: { ...character.combat.hitPoints,maximum,current: Math.min(character.combat.hitPoints.current,maximum) },hitDice: { ...character.combat.hitDice,maximum: choice.level,remaining: character.combat.hitDice.remaining+1,current: String(character.combat.hitDice.remaining+1),formula: `${choice.level}d8` } } });
  result = await applyAdditionalFighterBenefits(result,character);
  result = await applyClericBenefits(result,character);
  result.combat.armorClass = projectInventory(result).calculatedArmorClass;
  result.combat.speed = projectUpdatedBuilderSpeed(character,result);
  return result;
}
