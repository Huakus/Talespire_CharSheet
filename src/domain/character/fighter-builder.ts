import { RANGER_SKILLS } from "./ranger-catalog";
import { DRUID_SKILLS,DRUID_WEAPONS,HERBALISM } from "./druid-catalog";
import { BARD_SKILLS,bardCollege } from "./bard-catalog";
import { BARBARIAN_SKILLS } from "./barbarian-catalog";
import { ROGUE_SKILLS,THIEVES_TOOLS } from "./rogue-catalog";
import { validateXanatharFighter,xanatharFighterTraits } from "./xanathar-fighter";
import { CLERIC_SKILLS, clericHeavyArmor, clericMartialWeapons } from "./cleric-catalog";
import { CharacterV2Schema, type CharacterV2 } from "./character-v2";
import { createCharacter } from "./create-character";
import { abilityModifier, projectInventory, preferredWeaponAbility, projectHeavyArmorSpeedPenalty, projectUpdatedBuilderSpeed } from "./character-projection";
import { createDeterministicId } from "../../shared/id";
import { canonicalJsonStringify, type JsonValue } from "../../shared/json";
import { CharacterBuilderStateSchema, FighterCreationSchema, FighterLevelChoiceSchema, BUILDER_ABILITIES, type FighterCreation, type FighterCreationInput, type FighterLevelChoice, type FighterLevelChoiceInput, type CharacterBuilderState } from "./character-builder-model";
import { BUILDER_RACES, BUILDER_WEAPONS, PHB_EQUIPMENT, equipmentGoldCost, DWARF_TOOLS, FIGHTER_SKILLS, FIGHTER_ASI_LEVELS, FIGHTING_STYLES } from "./fighter-builder-catalog";
import { validateFighterOrigin, validateFeat, builderFeats, racialSkillGrants, replayFighterChoices } from "./fighter-build-rules";
import { fighterSubclass } from "./phb-fighter-choices";
import { SUBCLASSES, BACKGROUND_EQUIPMENT } from "./phb-character-options";
import { applyAdditionalFighterBenefits } from "./fighter-builder-grants";
import { traitGroup, type TraitDefinition } from "./builder-traits";
import type { CharacterActionV2 } from "./character-action-model";
import { SKILL_DEFINITIONS } from "./character-checks";
import { WARLOCK_SKILLS } from "./warlock-catalog";

export const POINT_BUY_COSTS: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export function pointBuyCost(scores: FighterCreation["baseAbilities"]): number {
  return BUILDER_ABILITIES.reduce((sum, key) => sum + (POINT_BUY_COSTS[scores[key]] ?? Infinity), 0);
}
function unique(values: readonly string[]): boolean { return new Set(values.map((value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())).size === values.length; }

export function validateFighterCreation(input: FighterCreationInput): FighterCreation {
  const creation = FighterCreationSchema.parse(input);
  if (creation.classKey !== "fighter") throw new Error("Este recorrido requiere la clase Guerrero.");
  return validateBuilderOrigin(creation);
}

export function validateBuilderOrigin(creation: FighterCreation): FighterCreation {
  validateFighterAbilities(creation);
  validateFighterOrigin(creation);
  const racialSkills = racialSkillGrants(creation);
  const classSkills: readonly string[] = creation.classKey === "ranger" ? RANGER_SKILLS : creation.classKey === "druid" ? DRUID_SKILLS : creation.classKey === "bard" ? BARD_SKILLS : creation.classKey === "barbarian" ? BARBARIAN_SKILLS : creation.classKey === "rogue" ? ROGUE_SKILLS : creation.classKey === "wizard" ? ["arcana", "history", "insight", "investigation", "medicine", "religion"] : creation.classKey === "cleric" ? CLERIC_SKILLS : creation.classKey === "warlock" ? WARLOCK_SKILLS : FIGHTER_SKILLS;
  if (creation.skills.length !== (creation.classKey === "rogue" ? 4 : ["bard","ranger"].includes(creation.classKey) ? 3 : 2) || creation.skills.some((key) => !classSkills.includes(key)) || !unique(creation.skills)) throw new Error(`Elegí ${creation.classKey === "rogue" ? "cuatro" : ["bard","ranger"].includes(creation.classKey) ? "tres" : "dos"} habilidades distintas de la lista de tu clase.`);
  if (!unique([...creation.skills, ...creation.background.skills, ...racialSkills])) throw new Error("Hay competencias repetidas. Personalizá las habilidades del trasfondo o elegí otras habilidades de clase.");
  if (creation.background.tools.length + creation.background.languages.length !== 2) throw new Error("El trasfondo requiere dos herramientas/idiomas en total.");
  if (creation.race.includes("dwarf") !== (creation.dwarfTool !== null)) throw new Error("Elegí la competencia con herramientas del enano.");
  if (!unique([...BUILDER_RACES[creation.race].languages, ...creation.languages, ...creation.background.languages])) throw new Error("Elegí idiomas distintos de los que ya conocés.");
  if (!unique([...creation.background.tools, ...(creation.dwarfTool ? [DWARF_TOOLS[creation.dwarfTool]] : []), ...(creation.race === "rock-gnome" ? ["Herramientas de hojalatero"] : [])])) throw new Error("Las herramientas se repiten; personalizá el trasfondo.");
  const primary = BUILDER_WEAPONS[creation.equipment.primary];
  const secondary = creation.equipment.secondary ? BUILDER_WEAPONS[creation.equipment.secondary] : null;
  if (creation.equipment.method === "packages" && creation.classKey === "fighter" && (!primary?.weapon?.category.startsWith("martial") || (!creation.equipment.shield && !secondary?.weapon?.category.startsWith("martial")) || (creation.equipment.shield && creation.equipment.secondary !== null))) throw new Error("Elegí un arma marcial y escudo, o dos armas marciales.");
  if (creation.initialFeat) {
    const previous: CharacterBuilderState = { schemaVersion: 1, ruleset: "dnd5e-2014", packageVersion: 1, classKey: creation.classKey, creationOperationId: "build_00000000000000000000000000000000", creation: { ...creation, initialFeat: null }, levels: [] };
    validateFeat(creation.initialFeat, fighterBuilderScores(previous), previous);
  }
  return creation;
}

export function validateFighterAbilities(creation: FighterCreation): void {
  const values = Object.values(creation.baseAbilities);
  if (creation.abilityMethod === "standard-array" && values.sort((a,b) => a-b).join(",") !== "8,10,12,13,14,15") throw new Error("Asigná una vez cada valor: 15, 14, 13, 12, 10 y 8.");
  if (creation.abilityMethod === "point-buy" && pointBuyCost(creation.baseAbilities) > 27) throw new Error("La compra de puntos permite hasta 27 puntos y valores entre 8 y 15.");
  if (creation.abilityMethod === "rolled" && values.some((value) => value < 3 || value > 18)) throw new Error("Los atributos por tirada de 4d6 descartando el menor deben estar entre 3 y 18.");
}

export function fighterBuilderScores(state: CharacterBuilderState): CharacterV2["abilities"] {
  const scores = { ...state.creation.baseAbilities };
  const bonuses = BUILDER_RACES[state.creation.race].bonuses as Partial<typeof scores>;
  for (const key of BUILDER_ABILITIES) scores[key] += bonuses[key] ?? 0;
  for (const key of state.creation.origin.abilities) scores[key]++;
  if (state.creation.initialFeat?.ability) scores[state.creation.initialFeat.ability] = Math.min(20, scores[state.creation.initialFeat.ability]+1);
  for (const step of state.levels) {
    if (step.abilityIncrease) for (const key of BUILDER_ABILITIES) scores[key] += step.abilityIncrease[key];
    if (step.feat?.ability) scores[step.feat.ability] = Math.min(20, scores[step.feat.ability]+1);
  }
  if (state.classKey === "barbarian" && state.levels.some((s) => s.level === 20)) { scores.strength += 4; scores.constitution += 4; }
  return scores;
}

export function validateFighterBuild(input: CharacterBuilderState): CharacterBuilderState {
  const state = CharacterBuilderStateSchema.parse(input);
  if (state.classKey !== "fighter") throw new Error("El historial no corresponde a Guerrero.");
  validateFighterCreation(state.creation);
  const scores = fighterBuilderScores({ ...state, levels: [] });
  const subclass = fighterSubclass(state);
  for (const [index, step] of state.levels.entries()) {
    if (step.hpBase > 10) throw new Error("Guerrero usa un d10 para sus PG.");
    if (step.hpMethod === "fixed" && step.hpBase !== 6) throw new Error("El valor fijo de PG del guerrero es 6 antes de Constitución.");
    if (FIGHTER_ASI_LEVELS.includes(step.level)) {
      if (step.skipImprovement) {
        if (step.feat || step.abilityIncrease) throw new Error("Renunciar a la mejora requiere dejar atributos y dote sin elección.");
      } else if (step.feat) {
        if (step.abilityIncrease) throw new Error("Elegí una dote o mejora de atributos, no ambas.");
        validateFeat(step.feat, scores, { ...state, levels: state.levels.slice(0, index) });
        if (step.feat.ability) scores[step.feat.ability] = Math.min(20, scores[step.feat.ability]+1);
      } else {
        if (!step.abilityIncrease || Object.values(step.abilityIncrease).reduce((a,b) => a+b, 0) !== 2 || Object.values(step.abilityIncrease).some((v) => v > 2)) throw new Error("Distribuí +2 en un atributo o +1 en dos atributos, o elegí una dote permitida.");
        for (const key of BUILDER_ABILITIES) { scores[key] += step.abilityIncrease[key]; if (scores[key] > 20) throw new Error("Una mejora no puede superar 20."); }
      }
    } else if (step.abilityIncrease !== null || step.feat !== null || step.skipImprovement) throw new Error("Este nivel de guerrero no concede mejora de atributos ni dote.");
    if ((step.level === 3) !== (step.subclass !== null) || step.subclass && !["champion", "battle-master", "eldritch-knight", "arcane-archer", "cavalier", "samurai"].includes(step.subclass)) throw new Error("Elegí Campeón, Maestro de batalla o Caballero arcano únicamente al adquirir Guerrero 3.");
    if (step.wizard.cantrips.length || step.wizard.learn.length || step.wizard.bonusCantrip || step.wizard.mastery.length || step.wizard.signature.length || step.wizard.prepared) throw new Error("Guerrero no concede elecciones de Mago.");
    if (step.level === 10 && subclass === "champion") {
      if (!step.additionalStyle || step.additionalStyle === state.creation.style) throw new Error("Campeón 10 requiere un segundo estilo distinto.");
    } else if (step.additionalStyle !== null) throw new Error("El segundo estilo se elige en Campeón 10.");
  }
  validateXanatharFighter(state);
  const replay = replayFighterChoices(state);
  if (!unique([...replay.maneuvers, ...builderFeats(state).flatMap(({ feat }) => feat.maneuvers)])) throw new Error("Las maniobras de clase y de Adepto marcial deben ser distintas.");
  return state;
}

export function fighterBuilderMaximumHp(state: CharacterBuilderState): number {
  // Replaying the ledger also handles retroactive Constitution increases and
  // minimum one HP acquired at each later level without applying a bonus twice.
  let scores = fighterBuilderScores({ ...state, levels: [] });
  let constitution = abilityModifier(scores.constitution);
  const racial = state.creation.race === "hill-dwarf" ? 1 : 0;
  let hp = (state.classKey === "barbarian" ? 12 : state.classKey === "wizard" ? 6 : ["warlock","cleric","rogue","bard","druid"].includes(state.classKey) ? 8 : 10) + constitution + racial;
  for (const step of state.levels) {
    scores = fighterBuilderScores({ ...state, levels: state.levels.filter((entry) => entry.level <= step.level) });
    const nextConstitution = abilityModifier(scores.constitution);
    hp += (nextConstitution - constitution) * (step.level - 1);
    hp += Math.max(1, step.hpBase + nextConstitution) + racial;
    constitution = nextConstitution;
  }
  return Math.max(1, hp) + (builderFeats(state).some(({ feat }) => feat.key === "tough") ? 2 * (state.levels.length + 1) : 0);
}

export function builderStyles(character: CharacterV2): string[] {
  if (character.builder?.classKey === "ranger") return character.builder.levels.flatMap((s) => s.ranger.style ? [s.ranger.style] : []);
  if (character.builder?.classKey === "bard") return character.builder.levels.flatMap((s) => s.bard.style ? [s.bard.style] : []);
  return character.builder?.classKey === "fighter" ? [character.builder.creation.style, ...character.builder.levels.flatMap((step) => step.additionalStyle ? [step.additionalStyle] : [])] : [];
}

function classTraits(state: CharacterBuilderState): TraitDefinition[] {
  const level = state.levels.length + 1;
  const champion = fighterSubclass(state) === "champion";
  const traits: TraitDefinition[] = [
    { key: "second-wind", name: "Segundo aliento", description: `Acción adicional: recuperá 1d10 + ${level} PG. Gastá un uso y aplicá la curación obtenida.`, maximum: 1, reset: "short-rest" },
    ...[state.creation.style, ...state.levels.flatMap((step) => step.additionalStyle ? [step.additionalStyle] : [])].map((key) => ({ key: `style-${key}`, name: `Estilo: ${FIGHTING_STYLES[key].name}`, description: FIGHTING_STYLES[key].description })),
  ];
  if (level >= 2) traits.push({ key: "action-surge", name: "Acción súbita", description: "En tu turno, obtené una acción adicional. Como máximo una vez por turno.", maximum: level >= 17 ? 2 : 1, reset: "short-rest" });
  if (champion && level >= 3) traits.push({ key: "critical", name: level >= 15 ? "Crítico superior" : "Crítico mejorado", description: `Tus ataques con armas son críticos con ${level >= 15 ? "18, 19 o 20" : "19 o 20"} en el d20. Resolvé el daño crítico al tirar.` });
  if (level >= 5) traits.push({ key: "extra-attack", name: "Ataque Extra", description: `La acción Atacar permite ${level >= 20 ? 4 : level >= 11 ? 3 : 2} ataques. No concede acciones adicionales.` });
  if (champion && level >= 7) traits.push({ key: "athlete", name: "Atleta notable", description: "Las pruebas de Fuerza, Destreza y Constitución que no sumen ya competencia reciben la mitad de competencia redondeada hacia arriba. El salto de longitud con carrera añade tantos pies como tu modificador de Fuerza; no afecta el salto de altura." });
  if (level >= 9) traits.push({ key: "indomitable", name: "Indomable", description: "Repetí una salvación fallida y usá el nuevo resultado.", maximum: level >= 17 ? 3 : level >= 13 ? 2 : 1, reset: "long-rest" });
  if (champion && level >= 18) traits.push({ key: "survivor", name: "Superviviente", description: "Al comenzar el turno, si tus PG están entre 1 y la mitad de tu máximo, recuperá 5 + mod. CON PG. Aplicá esa curación en la hoja." });
  return [...traits,...xanatharFighterTraits(state,fighterBuilderScores(state))];
}

async function applyClassBenefits(character: CharacterV2): Promise<CharacterV2> {
  const state = validateFighterBuild(character.builder!);
  const level = state.levels.length + 1;
  const group = await traitGroup(character, "fighter", "Guerrero · PHB 2014", classTraits(state));
  const secondWindId = await createDeterministicId("act", character.id, "builder", "second-wind");
  const secondWind: CharacterActionV2 = { id: secondWindId, order: character.actions.find((a) => a.id === secondWindId)?.order ?? character.actions.length, name: "Segundo aliento", categories: ["bonus-action"], activation: "Acción adicional", reach: "Personal", ability: null, proficient: false, attackBonus: 0, damageExpression: "1d10", damageBonus: level, damageType: "healing", weaponType: "", properties: "", description: "Tirá la curación, gastá el uso del rasgo y aplicá el resultado en PG.", inventoryItemId: null, rollMode: "normal" };
  const subclass = fighterSubclass(state);
  return CharacterV2Schema.parse({ ...character, identity: { ...character.identity, className: "Guerrero", subclass: subclass ? SUBCLASSES[subclass] : "", level }, traits: [...character.traits.filter((entry) => entry.id !== group.id), group].sort((a,b) => a.order-b.order), actions: [...character.actions.filter((entry) => entry.id !== secondWindId), secondWind].sort((a,b) => a.order-b.order) });
}

export async function createGuidedFighter(id: string, operationId: string, input: FighterCreationInput, createdAt: string, initialLevels: FighterLevelChoiceInput[] = []): Promise<CharacterV2> {
  const creation = validateFighterCreation(input);
  const state = validateFighterBuild({ schemaVersion: 1, ruleset: "dnd5e-2014", packageVersion: 1, classKey: "fighter", creationOperationId: operationId, creation, levels: [] });
  let character = await createBuilderCharacter(id, state, createdAt);
  if (initialLevels.length !== creation.startingLevel - 1) throw new Error("Completá las elecciones de todos los niveles iniciales del personaje.");
  for (const step of initialLevels) character = await advanceGuidedFighter(character, step, createdAt);
  return finishBuilderCreation(character);
}

export function finishBuilderCreation(character: CharacterV2): CharacterV2 {
  return CharacterV2Schema.parse({ ...character, revision: 0, combat: { ...character.combat, hitPoints: { ...character.combat.hitPoints, current: character.combat.hitPoints.maximum } } });
}

export async function createBuilderCharacter(id: string, state: CharacterBuilderState, createdAt: string): Promise<CharacterV2> {
  const creation = state.creation, ranger = state.classKey === "ranger", druid = state.classKey === "druid", bard = state.classKey === "bard", wizard = state.classKey === "wizard", warlock = state.classKey === "warlock", cleric = state.classKey === "cleric", rogue = state.classKey === "rogue", barbarian = state.classKey === "barbarian";
  let character = createCharacter(id, creation.name, createdAt);
  const race = BUILDER_RACES[creation.race];
  const abilities = fighterBuilderScores(state);
  const hp = fighterBuilderMaximumHp(state);
  character = CharacterV2Schema.parse({ ...character, builder: state, abilities, identity: { ...character.identity, playerName: creation.playerName, species: race.species, subrace: race.subrace, background: creation.background.name, alignment: creation.alignment }, combat: { ...character.combat, speed: `${race.speed} ft`, initiative: String(abilityModifier(abilities.dexterity)), hitPoints: { current: hp, maximum: hp, temporary: 0 }, hitDice: { current: "1", formula: "1d10", remaining: 1, maximum: 1, dieSize: 10 } }, proficiencies: { armor: ["Todas las armaduras", "Escudos"], weapons: ["Armas sencillas", "Armas marciales"], tools: [...creation.background.tools, ...(creation.dwarfTool ? [DWARF_TOOLS[creation.dwarfTool]] : []), ...(creation.race === "rock-gnome" ? ["Herramientas de hojalatero"] : [])], languages: [...race.languages, ...creation.languages, ...creation.background.languages] } });
  if (ranger) { character.identity.className = "Explorador";character.proficiencies.armor = ["Armaduras ligeras","Armaduras medias","Escudos"]; }
  if (barbarian) {
    character.identity.className = "Bárbaro"; character.combat.hitDice = { current: "1",formula: "1d12",remaining: 1,maximum: 1,dieSize: 12 };
    character.proficiencies.armor = ["Armaduras ligeras","Armaduras medias","Escudos"];
  }
  if (wizard) {
    character.identity.className = "Mago";
    character.combat.hitDice = { current: "1", formula: "1d6", remaining: 1, maximum: 1, dieSize: 6 };
    character.proficiencies.armor = creation.race === "mountain-dwarf" ? ["Armaduras ligeras", "Armaduras medias"] : [];
    character.proficiencies.weapons = ["Daga", "Dardo", "Honda", "Bastón", "Ballesta ligera", ...(creation.race.includes("dwarf") ? ["Hacha de batalla", "Hacha de mano", "Martillo ligero", "Martillo de guerra"] : ["high-elf", "wood-elf"].includes(creation.race) ? ["Espada larga", "Espada corta", "Arco largo", "Arco corto"] : creation.race === "drow" ? ["Estoque", "Espada corta", "Ballesta de mano"] : [])];
  }
  if (warlock || cleric || rogue || bard) {
    character.identity.className = bard ? "Bardo" : rogue ? "Pícaro" : cleric ? "Clérigo" : "Brujo";
    character.combat.hitDice = { current: "1",formula: "1d8",remaining: 1,maximum: 1,dieSize: 8 };
    character.proficiencies.armor = ["Armaduras ligeras", ...(cleric || creation.race === "mountain-dwarf" ? ["Armaduras medias"] : []), ...(warlock && creation.warlock.patron === "hexblade" ? ["Armaduras medias","Escudos"] : []), ...(cleric ? ["Escudos", ...(clericHeavyArmor(creation.cleric.domain) ? ["Todas las armaduras"] : [])] : [])];
    character.proficiencies.weapons = ["Armas sencillas", ...(rogue || bard ? ["Ballesta de mano","Espada larga","Estoque","Espada corta"] : []), ...(cleric && clericMartialWeapons(creation.cleric.domain) || warlock && creation.warlock.patron === "hexblade" ? ["Armas marciales"] : []), ...(creation.race.includes("dwarf") ? ["Hacha de batalla","Martillo de guerra"] : ["high-elf","wood-elf"].includes(creation.race) ? ["Espada larga","Espada corta","Arco largo","Arco corto"] : creation.race === "drow" ? ["Estoque","Espada corta","Ballesta de mano"] : [])];
  }
  if (druid) {
    character.identity.className = "Druida"; character.combat.hitDice = { current: "1",formula: "1d8",remaining: 1,maximum: 1,dieSize: 8 };
    character.proficiencies.armor = ["Armaduras ligeras","Armaduras medias","Escudos"];
    character.proficiencies.weapons = [...new Set([...DRUID_WEAPONS.map((key) => BUILDER_WEAPONS[key]!.name),...(creation.race.includes("dwarf") ? ["Hacha de batalla","Hacha de mano","Martillo ligero","Martillo de guerra"] : ["high-elf","wood-elf"].includes(creation.race) ? ["Espada larga","Espada corta","Arco largo","Arco corto"] : creation.race === "drow" ? ["Estoque","Espada corta","Ballesta de mano"] : [])])];
    character.proficiencies.tools = [...new Set([...character.proficiencies.tools,HERBALISM])];character.proficiencies.languages = [...new Set([...character.proficiencies.languages,"Druídico"])];
  }
  if (rogue) { character.proficiencies.weapons = [...new Set(character.proficiencies.weapons)]; character.proficiencies.tools = [...new Set([...character.proficiencies.tools,THIEVES_TOOLS])]; character.proficiencies.languages.push("Jerga de Ladrones"); }
  if (bard) character.proficiencies.tools = [...new Set([...character.proficiencies.tools,...creation.bard.instruments])];
  for (const skill of [...creation.skills, ...creation.background.skills, ...racialSkillGrants(creation)]) character.checks.skills[skill].proficiency = 1;
  character.checks.savingThrows[rogue || bard ? "dexterity" : wizard || druid ? "intelligence" : warlock || cleric ? "charisma" : "strength"].proficiency = 1;
  character.checks.savingThrows[ranger ? "dexterity" : bard ? "charisma" : rogue ? "intelligence" : wizard || druid || warlock || cleric ? "wisdom" : "constitution"].proficiency = 1;
  const quantities = new Map<string, { quantity: number; equipped: boolean }>();
  const add = (key: string, quantity = 1, equipped = false) => { const old = quantities.get(key); quantities.set(key, { quantity: (old?.quantity ?? 0) + quantity, equipped: equipped || (old?.equipped ?? false) }); };
  if (creation.equipment.method === "gold") {
    for (const purchase of creation.equipment.purchases) add(purchase.key, purchase.quantity, purchase.equipped);
    const spent = creation.equipment.purchases.reduce((sum, p) => sum + equipmentGoldCost(p.key) * p.quantity, 0);
    const copper = Math.round((creation.equipment.goldRoll.reduce((a,b) => a+b, 0) * 10 - spent) * 100);
    character.currency.gold = Math.floor(copper / 100);
    character.currency.silver = Math.floor(copper % 100 / 10); character.currency.copper = copper % 10;
  } else {
    if (wizard) {
      add(creation.wizardWeapon, 1, true); add(creation.wizardFocus); add(creation.wizardPack === "scholar" ? "scholars-pack" : "explorer"); add("spellbook");
    } else if (ranger) {
      add(creation.rangerArmor,1,true);creation.rangerWeapons.forEach((key,i) => add(key,1,i === 0));add(creation.rangerPack);add("longbow");add("quiver");add("arrows",20);
    } else if (druid) {
      add("leather",1,true); add(creation.druidPrimary,1,true); add(creation.druidWeapon,1,creation.druidPrimary === "shield"); add("explorer"); add(creation.druidFocus);
    } else if (bard) {
      add("leather",1,true); add(creation.bardWeapon,1,true); add("dagger"); add(creation.bardPack === "diplomat" ? "diplomats-pack" : "entertainers-pack"); add(creation.bardInstrument);
    } else if (barbarian) {
      add(creation.barbarianWeapon,1,true); if (creation.barbarianSecondary === "two-handaxes") add("handaxe",2); else add(creation.barbarianSecondary); add("explorer"); add("javelin",4);
    } else if (rogue) {
      add("leather",1,true); add(creation.rogueWeapon,1,true); add(creation.rogueSecondary); if (creation.rogueSecondary === "shortbow") { add("arrows",20); add("quiver"); } add("dagger",2); add("thieves-tools"); add(creation.roguePack === "burglar" ? "burglars-pack" : creation.roguePack);
    } else if (cleric) {
      add(creation.clericArmor,1,true); add(creation.clericWeapon,1,true); add("shield",1,true); add(creation.clericSymbol); add(creation.clericSecondary); if (creation.clericSecondary === "light-crossbow") add("bolts",20); add(creation.clericPack === "priest" ? "priests-pack" : "explorer");
    } else if (warlock) {
      add("leather",1,true); add(creation.warlockPrimary,1,true); if (creation.warlockPrimary === "light-crossbow") add("bolts",20);
      add(creation.warlockSecondary); add("dagger",2); add(creation.wizardFocus); add(creation.warlockPack === "scholar" ? "scholars-pack" : "dungeoneer");
    } else {
    add(creation.equipment.armor, 1, true); add(creation.equipment.primary, 1, true);
    if (creation.equipment.shield) add("shield", 1, !BUILDER_WEAPONS[creation.equipment.primary]!.properties.includes("two-handed"));
    else add(creation.equipment.secondary!);
    if (creation.equipment.armor === "leather") { add("longbow"); add("arrows", 20); }
    if (creation.equipment.backup === "crossbow") { add("light-crossbow"); add("bolts", 20); } else add("handaxe", 2);
    add(creation.equipment.pack);
    }
    add("pouch");
    const background = BACKGROUND_EQUIPMENT[creation.background.equipment];
    for (const [key, quantity] of background.items) add(key, quantity);
    background.choices.forEach((choice, i) => {
      const legacy = creation.background.equipment === "acolyte" ? creation.background.prayerItem : creation.background.equipment === "soldier" ? creation.background.gamingSet === "cards" ? "playing-cards" : "gaming-set" : choice.keys[0]!;
      const selected = creation.background.selections[i] ?? legacy;
      if (selected === "mule-cart") { add("mule"); add("cart"); } else add(selected);
    });
    character.currency.gold = background.gold;
  }
  for (const [key, value] of quantities) {
    const definition = PHB_EQUIPMENT[key]!;
    const base = { ...definition, group: "Equipo inicial" };
    character.inventory.push({ ...base, id: await createDeterministicId("inv", id, "builder-starting", key), order: character.inventory.length, ...value, quantity: value.equipped ? 1 : value.quantity });
    if (value.equipped && value.quantity > 1) character.inventory.push({ ...base, id: await createDeterministicId("inv", id, "builder-starting", key, "spare"), order: character.inventory.length, equipped: false, quantity: value.quantity - 1 });
  }
  if (druid && creation.equipment.method === "packages") { const shield = character.inventory.find((i) => i.category === "shield"); if (shield) { shield.name = "Escudo de madera";shield.description = "Escudo de madera, no metálico. " + shield.description; } }
  for (const item of character.inventory.filter((entry) => entry.weapon)) {
    const ranged = item.weapon!.range === "ranged";
    const ability = preferredWeaponAbility(abilities, item);
    character.actions.push({ id: await createDeterministicId("act", id, "builder-weapon", item.id), order: character.actions.length, name: item.name, categories: ["attack", "action"], activation: "Acción", reach: ranged ? `${item.weapon!.normalRange}/${item.weapon!.longRange} ft` : item.properties.includes("reach") ? "10 ft" : "5 ft", ability, proficient: ranger || barbarian || state.classKey === "fighter" || character.proficiencies.weapons.includes(item.name) || (warlock || cleric || rogue || bard) && item.weapon!.category.startsWith("simple") || cleric && clericMartialWeapons(creation.cleric.domain) || warlock && creation.warlock.patron === "hexblade", attackBonus: 0, damageExpression: item.weapon!.damageExpression, damageBonus: item.weapon!.damageExpression ? abilityModifier(abilities[ability]) : 0, damageType: item.weapon!.damageType, weaponType: item.weapon!.category, properties: item.properties.join(", "), description: item.description, inventoryItemId: item.id, rollMode: "normal" });
  }
  character.traits.push(await traitGroup(character, "background", creation.background.name, [{ key: "feature", name: creation.background.featureName, description: creation.background.featureDescription }]));
  const personality = [creation.personality, creation.appearance && `Descripción: ${creation.appearance}`, ...creation.personalTraits.map((t, i) => `Rasgo ${i+1}: ${t}`), creation.ideal && `Ideal: ${creation.ideal}`, creation.bond && `Vínculo: ${creation.bond}`, creation.flaw && `Defecto: ${creation.flaw}`].filter(Boolean).join("\n\n");
  if (personality.trim()) character.notes.push({ id: await createDeterministicId("ntg", id, "builder-personality"), order: 0, title: "Historia y personalidad", collapsed: false, notes: [{ id: await createDeterministicId("note", id, "builder-personality"), order: 0, title: "Mi personaje", content: personality, tags: [] }] });
  if (state.classKey === "fighter") character = await applyClassBenefits(character);
  character = await applyAdditionalFighterBenefits(character);
  character.combat.armorClass = projectInventory(character).calculatedArmorClass;
  character.combat.speed = `${race.speed + (builderFeats(state).some(({ feat }) => feat.key === "mobile") ? 10 : 0) + (builderFeats(state).some(({ feat }) => feat.key === "squat-nimbleness") ? 5 : 0) - projectHeavyArmorSpeedPenalty(character)} ft`;
  return CharacterV2Schema.parse(character);
}

export async function advanceGuidedFighter(input: CharacterV2, choiceInput: FighterLevelChoiceInput, updatedAt: string): Promise<CharacterV2> {
  const character = CharacterV2Schema.parse(input);
  if (!character.builder) throw new Error("Esta ficha no tiene historial del asistente. La adopción de fichas manuales todavía no está habilitada.");
  const choice = FighterLevelChoiceSchema.parse(choiceInput);
  const previous = validateFighterBuild(character.builder);
  const existing = previous.levels.find((step) => step.operationId === choice.operationId);
  if (existing) { if (canonicalJsonStringify(existing as unknown as JsonValue) !== canonicalJsonStringify(choice as unknown as JsonValue)) throw new Error("La operación ya se usó con otras elecciones."); return character; }
  if (choice.operationId === previous.creationOperationId || choice.level !== previous.levels.length + 2 || character.identity.level !== choice.level - 1 || character.identity.className !== "Guerrero" || character.identity.subclass !== (fighterSubclass(previous) ? SUBCLASSES[fighterSubclass(previous)!] : "")) throw new Error("La ficha cambió o el próximo nivel no coincide con su historial.");
  const oldScores = fighterBuilderScores(previous);
  if (BUILDER_ABILITIES.some((key) => character.abilities[key] !== oldScores[key])) throw new Error("Los atributos se editaron fuera del asistente. Revisá esas diferencias antes de continuar la progresión.");
  const next = validateFighterBuild({ ...previous, levels: [...previous.levels, choice] });
  const abilities = fighterBuilderScores(next);
  const hpIncrease = fighterBuilderMaximumHp(next) - fighterBuilderMaximumHp(previous);
  const maximum = character.combat.hitPoints.maximum + hpIncrease;
  const actions = await Promise.all(character.actions.map(async (action) => {
    const item = character.inventory.find((entry) => entry.id === action.inventoryItemId);
    if (!item?.weapon || !action.ability) return action;
    const generated = action.id === await createDeterministicId("act", character.id, "builder-weapon", item.id);
    const ability = generated && action.ability === preferredWeaponAbility(oldScores, item) ? preferredWeaponAbility(abilities, item) : action.ability;
    return { ...action, ability, damageBonus: action.damageExpression ? action.damageBonus + abilityModifier(abilities[ability]) - abilityModifier(oldScores[action.ability]) : action.damageBonus };
  }));
  let result = CharacterV2Schema.parse({ ...character, builder: next, abilities, revision: character.revision + 1, metadata: { ...character.metadata, updatedAt }, combat: { ...character.combat, hitPoints: { ...character.combat.hitPoints, maximum, current: Math.min(character.combat.hitPoints.current, maximum) }, hitDice: { ...character.combat.hitDice, maximum: choice.level, remaining: character.combat.hitDice.remaining + 1, current: String(character.combat.hitDice.remaining + 1), formula: `${choice.level}d10` } }, actions });
  result = await applyClassBenefits(result);
  result = await applyAdditionalFighterBenefits(result, character);
  result.combat.armorClass = projectInventory(result).calculatedArmorClass;
  result.combat.speed = projectUpdatedBuilderSpeed(character, result);
  return CharacterV2Schema.parse(result);
}
