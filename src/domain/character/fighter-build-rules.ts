import { monkCanCast } from "./martial-catalog";
import { rangerLanguages } from "./ranger-catalog";
import { HERBALISM } from "./druid-catalog";
import { bardCollege,bardClassSkills,bardClassTools,bardClassExpertise } from "./bard-catalog";
import { barbarianPath } from "./barbarian-catalog";
import { builderGoldDice,builderGoldMultiplier } from "./fighter-builder-catalog";
import { rogueArchetype,rogueClassSkills,rogueClassTools } from "./rogue-catalog";
import { isXanatharFeat,validateXanatharFeat } from "./xanathar-feats";
import { clericHeavyArmor } from "./cleric-catalog";
import type { CharacterBuilderState, FighterCreation, FeatChoice } from "./character-builder-model";
import { BUILDER_RACES, BUILDER_WEAPONS, PHB_EQUIPMENT, PHB_PURCHASABLE_EQUIPMENT, equipmentGoldCost, DWARF_TOOLS } from "./fighter-builder-catalog";
import { ARTISAN_TOOLS, TOOLS, LANGUAGES, BACKGROUND_EQUIPMENT } from "./phb-character-options";
import { FEATS, MANEUVERS, EK_PROGRESSION, fighterSubclass } from "./phb-fighter-choices";
import { PHB_SPELLS } from "./phb-spells";
import type { SkillKey } from "./character-checks";

export const distinct = (values: readonly string[]): boolean => new Set(values.map((v) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase())).size === values.length;
export function racialSkillGrants(creation: FighterCreation): SkillKey[] {
  const fixed = creation.race === "half-orc" ? "intimidation" : ["high-elf", "wood-elf", "drow"].includes(creation.race) ? "perception" : null;
  return [...(fixed ? [creation.racialSkillReplacement ?? fixed] : []), ...creation.origin.skills];
}
export function builderFeats(state: CharacterBuilderState): Array<{ feat: FeatChoice; level: number }> {
  return [...(state.creation.initialFeat ? [{ feat: state.creation.initialFeat, level: 1 }] : []), ...state.levels.flatMap((step) => step.feat ? [{ feat: step.feat, level: step.level }] : [])];
}
export function canCastSpells(state: CharacterBuilderState): boolean {
  return state.classKey === "paladin" && state.levels.length+1 >= 2 || monkCanCast(state) || state.classKey === "sorcerer" || state.classKey === "ranger" && state.levels.length+1 >= 2 || barbarianPath(state) === "totem-warrior" || barbarianPath(state) === "ancestral-guardian" && state.levels.length+1 >= 10 || rogueArchetype(state) === "arcane-trickster" || state.classKey === "druid" || state.classKey === "bard" || state.classKey === "wizard" || state.classKey === "warlock" || state.classKey === "cleric" || ["high-elf", "drow", "forest-gnome", "tiefling"].includes(state.creation.race) || fighterSubclass(state) === "eldritch-knight" || builderFeats(state).some(({ feat }) => ["magic-initiate", "ritual-caster", "spell-sniper"].includes(feat.key));
}
export function validateFighterOrigin(creation: FighterCreation): void {
  const variable = ["human-variant", "half-elf"].includes(creation.race);
  if (creation.origin.abilities.length !== (variable ? 2 : 0) || !distinct(creation.origin.abilities) || (creation.race === "half-elf" && creation.origin.abilities.includes("charisma"))) throw new Error("Elegí los dos aumentos raciales distintos que corresponden; el semielfo ya recibe Carisma +2.");
  const skillCount = creation.race === "half-elf" ? 2 : creation.race === "human-variant" ? 1 : 0;
  if (creation.origin.skills.length !== skillCount || !distinct(creation.origin.skills)) throw new Error(`Este origen requiere ${skillCount} habilidades raciales a elección.`);
  const fixed = creation.race === "half-orc" ? "intimidation" : ["high-elf", "wood-elf", "drow"].includes(creation.race) ? "perception" : null;
  if (creation.racialSkillReplacement && (!fixed || ![...creation.skills, ...creation.background.skills].includes(fixed))) throw new Error("Solo podés sustituir una competencia racial si otra fuente ya concede esa competencia.");
  if (creation.race === "high-elf") { const spell = PHB_SPELLS[creation.origin.cantrip]; if (!spell || spell.level !== 0 || !spell.classes.includes("wizard")) throw new Error("Elegí un truco de mago para el alto elfo."); }
  else if (creation.origin.cantrip) throw new Error("Este origen no elige un truco racial.");
  if ((creation.race === "dragonborn") !== (creation.origin.ancestry !== null)) throw new Error("Elegí la ascendencia dracónica solo para un dracónido.");
  if ((creation.race === "human-variant") !== (creation.initialFeat !== null)) throw new Error("El humano variante elige una dote inicial; los demás orígenes no reciben esa elección.");
  if (creation.initialFeat && !creation.allowFeats) throw new Error("El humano variante necesita que la mesa permita dotes.");
  const extraLanguages = ["human", "human-variant", "high-elf", "half-elf"].includes(creation.race) ? 1 : 0;
  if (creation.languages.length !== extraLanguages) throw new Error(`Este origen requiere ${extraLanguages} idiomas adicionales.`);
  if (![...creation.languages, ...creation.background.languages].every((lang) => LANGUAGES.includes(lang))) throw new Error("Elegí idiomas del Manual 2014; los idiomas exóticos requieren acuerdo del GM.");
  if (!creation.background.tools.every((tool) => TOOLS.includes(tool))) throw new Error("Elegí herramientas del Manual 2014 para el trasfondo.");
  if (creation.background.selections.length > BACKGROUND_EQUIPMENT[creation.background.equipment].choices.length) throw new Error("Hay elecciones de equipo de trasfondo que no corresponden.");
  BACKGROUND_EQUIPMENT[creation.background.equipment].choices.forEach((choice, i) => {
    const selected = creation.background.selections[i];
    if (selected && !choice.keys.includes(selected)) throw new Error("El equipo elegido no pertenece a esta alternativa del trasfondo.");
  });
  if (creation.equipment.method === "gold") {
    if (creation.equipment.goldRoll.length !== builderGoldDice(creation.classKey)) throw new Error(`El oro inicial de tu clase requiere ${builderGoldDice(creation.classKey)}d4${creation.classKey === "monk" ? "" : " × 10"} po.`);
    if (!distinct(creation.equipment.purchases.map((p) => p.key))) throw new Error("Agrupá las compras repetidas en una sola cantidad.");
    if (creation.equipment.purchases.some((p) => !PHB_PURCHASABLE_EQUIPMENT[p.key])) throw new Error("Elegí equipo con precio de compra en el catálogo PHB 2014; los regalos y objetos narrativos pertenecen al paquete de trasfondo.");
    const cost = creation.equipment.purchases.reduce((sum, p) => sum + equipmentGoldCost(p.key) * p.quantity, 0);
    if (cost > creation.equipment.goldRoll.reduce((a,b) => a+b, 0) * builderGoldMultiplier(creation.classKey) + .000001) throw new Error(`Las compras superan las po iniciales: ${builderGoldDice(creation.classKey)}d4${creation.classKey === "monk" ? "" : " × 10"}. Esta alternativa reemplaza equipo y oro de clase y trasfondo.`);
    const equipped = creation.equipment.purchases.filter((p) => p.equipped).map((p) => PHB_EQUIPMENT[p.key]!);
    const hands = equipped.reduce((sum, item) => sum + (item.category === "shield" ? 1 : item.weapon ? item.properties.includes("two-handed") ? 2 : 1 : 0), 0);
    if (hands > 2 || equipped.filter((item) => item.category === "armor").length > 1 || equipped.filter((item) => item.category === "shield").length > 1) throw new Error("El equipo inicial necesita manos libres y una sola armadura/escudo equipados.");
  }
}

export function validateFeat(feat: FeatChoice, scores: FighterCreation["baseAbilities"], previous: CharacterBuilderState): void {
  if (!previous.creation.allowFeats) throw new Error("La mesa no permite dotes para este personaje.");
  const definition = FEATS[feat.key];
  if (feat.expertise && feat.key !== "prodigy") throw new Error("Solo Prodigio elige pericia con estas dotes.");
  const armorFeats = builderFeats(previous).map(({ feat }) => feat.key);
  const medium = previous.classKey === "paladin" || previous.classKey === "ranger" || previous.classKey === "druid" || previous.classKey === "bard" && ["valor","swords"].includes(bardCollege(previous) ?? "") || previous.classKey === "barbarian" || previous.classKey === "warlock" && previous.creation.warlock.patron === "hexblade" || previous.classKey === "cleric" || previous.classKey === "fighter" || previous.creation.race === "mountain-dwarf" || armorFeats.includes("moderately-armored") || armorFeats.includes("heavily-armored");
  const light = previous.classKey === "bard" || previous.classKey === "rogue" || previous.classKey === "warlock" || medium || armorFeats.includes("lightly-armored"), heavy = previous.classKey === "paladin" || previous.classKey === "cleric" && clericHeavyArmor(previous.creation.cleric.domain) || previous.classKey === "fighter" || armorFeats.includes("heavily-armored");
  if ((["heavily-armored", "medium-armor-master"].includes(feat.key) && !medium) || (feat.key === "moderately-armored" && !light) || (feat.key === "heavy-armor-master" && !heavy)) throw new Error(`No cumplís el requisito de competencia con armaduras de ${definition.name}.`);
  if (definition.abilities.length ? !feat.ability || !definition.abilities.includes(feat.ability) : feat.ability !== null) throw new Error("Elegí el atributo de la dote; su aumento se limita a 20.");
  const prerequisite = definition.prerequisite;
  if ((prerequisite === "spell" && !canCastSpells(previous)) || (prerequisite === "dex13" && scores.dexterity < 13) || (prerequisite === "str13" && scores.strength < 13) || (prerequisite === "cha13" && scores.charisma < 13) || (prerequisite === "int-wis13" && scores.intelligence < 13 && scores.wisdom < 13)) throw new Error(`No cumplís el requisito de ${definition.name}.`);
  if (builderFeats(previous).some(({ feat: old }) => old.key === feat.key && (feat.key !== "elemental-adept" || old.damageType === feat.damageType))) throw new Error("Esta dote ya se eligió; solo Adepto elemental admite tipos de daño distintos.");
  if (isXanatharFeat(feat.key)) {
    validateXanatharFeat(feat,previous);
    if (feat.key === "wood-elf-magic" && (feat.spells.some((key) => PHB_SPELLS[key]?.level !== 0 || !PHB_SPELLS[key]?.classes.includes("druid")))) throw new Error("Elegí un truco de druida.");
    if (feat.key === "prodigy") {
      const knownLanguages = [...rangerLanguages(previous),...previous.levels.flatMap((s) => s.rogue.languages),...BUILDER_RACES[previous.creation.race].languages,...previous.creation.languages,...previous.creation.background.languages,...previous.creation.cleric.languages,...builderFeats(previous).flatMap(({ feat }) => feat.languages)];
      const knownTools = [...(previous.classKey === "monk" ? [previous.creation.monk.tool,...(previous.levels.some((s) => s.monk.tradition === "drunken-master") ? ["Suministros de cervecero"] : []),...previous.levels.flatMap((s) => s.monk.brush ? [s.monk.brush === "painter" ? "Suministros de pintor" : "Suministros de calígrafo"] : [])] : []),...(previous.classKey === "druid" ? [HERBALISM] : []),...bardClassTools(previous),...rogueClassTools(previous),...previous.creation.background.tools,...(previous.creation.dwarfTool ? [DWARF_TOOLS[previous.creation.dwarfTool]] : []),...builderFeats(previous).flatMap(({ feat }) => feat.tools)];
      if (!TOOLS.includes(feat.tools[0]!) || knownTools.includes(feat.tools[0]!) || !LANGUAGES.includes(feat.languages[0]!) || !distinct([...knownLanguages,...feat.languages])) throw new Error("Prodigio requiere herramienta e idioma nuevos del catálogo.");
    }
    return;
  }
  if (feat.key === "skilled") {
    if (feat.skills.length + feat.tools.length !== 3 || !distinct(feat.skills) || !distinct(feat.tools) || !feat.tools.every((tool) => TOOLS.includes(tool))) throw new Error("Hábil requiere tres competencias distintas en habilidades o herramientas.");
    const skills = [...(previous.classKey === "monk" && previous.levels.some((s) => s.monk.tradition === "drunken-master") ? ["performance"] : []),...bardClassSkills(previous),...rogueClassSkills(previous),...previous.creation.cleric.skills,...previous.levels.map((s) => s.xanathar.skill).filter(Boolean),...previous.creation.skills, ...previous.creation.background.skills, ...racialSkillGrants(previous.creation), ...builderFeats(previous).flatMap(({ feat: old }) => old.skills)];
    const tools = [...(previous.classKey === "monk" ? [previous.creation.monk.tool,...(previous.levels.some((s) => s.monk.tradition === "drunken-master") ? ["Suministros de cervecero"] : []),...previous.levels.flatMap((s) => s.monk.brush ? [s.monk.brush === "painter" ? "Suministros de pintor" : "Suministros de calígrafo"] : [])] : []),...(previous.classKey === "druid" ? [HERBALISM] : []),...bardClassTools(previous),...rogueClassTools(previous),...(previous.classKey === "cleric" && previous.creation.cleric.domain === "forge" ? ["Herramientas de herrero"] : []),...previous.creation.background.tools, ...(previous.creation.dwarfTool ? [DWARF_TOOLS[previous.creation.dwarfTool]] : []), ...(previous.creation.race === "rock-gnome" ? ["Herramientas de hojalatero"] : []), ...builderFeats(previous).flatMap(({ feat: old }) => old.tools), ...previous.levels.filter((s) => s.artisanTool).map((s) => s.artisanTool)];
    if (feat.skills.some((skill) => skills.includes(skill)) || feat.tools.some((tool) => tools.includes(tool))) throw new Error("Ya conocés una de las competencias elegidas para Hábil.");
  } else if (feat.skills.length || feat.tools.length) throw new Error("Esta dote no concede elecciones de habilidades o herramientas.");
  if (feat.key === "linguist") {
    const known = [...rangerLanguages(previous),...previous.levels.flatMap((s) => s.rogue.languages),...previous.creation.cleric.languages,...previous.levels.map((s) => s.xanathar.language).filter(Boolean),...BUILDER_RACES[previous.creation.race].languages, ...previous.creation.languages, ...previous.creation.background.languages, ...builderFeats(previous).flatMap(({ feat: old }) => old.languages)];
    if (feat.languages.length !== 3 || !distinct([...known, ...feat.languages]) || !feat.languages.every((lang) => LANGUAGES.includes(lang))) throw new Error("Lingüista requiere tres idiomas nuevos distintos.");
  } else if (feat.languages.length) throw new Error("Esta dote no elige idiomas.");
  if ((feat.key === "elemental-adept") !== (feat.damageType !== null)) throw new Error("Elegí el tipo de daño de Adepto elemental únicamente para esa dote.");
  if (feat.key === "martial-adept") {
    const known = [...replayFighterChoices(previous).maneuvers, ...builderFeats(previous).flatMap(({ feat: old }) => old.maneuvers)];
    if (feat.maneuvers.length !== 2 || !distinct([...known, ...feat.maneuvers]) || feat.maneuvers.some((key) => !(key in MANEUVERS))) throw new Error("Adepto marcial requiere dos maniobras nuevas del PHB.");
  } else if (feat.maneuvers.length) throw new Error("Esta dote no elige maniobras.");
  if (feat.key === "weapon-master") {
    if (feat.weapons.length !== 4 || !distinct(feat.weapons) || feat.weapons.some((key) => !BUILDER_WEAPONS[key])) throw new Error("Maestro de armas requiere cuatro armas sencillas o marciales distintas.");
  } else if (feat.weapons.length) throw new Error("Esta dote no elige armas.");
  if (["magic-initiate", "ritual-caster", "spell-sniper"].includes(feat.key)) {
    if (!feat.spellClass || !distinct(feat.spells)) throw new Error("Elegí la clase y conjuros distintos de la dote.");
    const spells = feat.spells.map((key) => PHB_SPELLS[key]);
    if (spells.some((spell) => !spell || !spell.classes.includes(feat.spellClass!))) throw new Error("La dote requiere conjuros de la lista de clase elegida.");
    if (feat.key === "magic-initiate" && (spells.length !== 3 || spells.filter((s) => s!.level === 0).length !== 2 || spells.filter((s) => s!.level === 1).length !== 1)) throw new Error("Iniciado en magia requiere dos trucos y un conjuro de nivel 1.");
    if (feat.key === "ritual-caster" && (spells.length !== 2 || spells.some((s) => s!.level !== 1 || !s!.ritual))) throw new Error("Lanzador ritual requiere dos rituales de nivel 1.");
    if (feat.key === "spell-sniper" && (spells.length !== 1 || spells[0]!.level !== 0 || spells[0]!.attackType !== "attack")) throw new Error("Francotirador mágico requiere un truco que use tirada de ataque.");
  } else if (feat.spellClass || feat.spells.length) throw new Error("Esta dote no elige conjuros.");
}

export function replayFighterChoices(state: CharacterBuilderState): { maneuvers: string[]; spells: Array<{ key: string; unrestricted: boolean }>; cantrips: string[] } {
  const subclass = fighterSubclass(state);
  const maneuvers: string[] = [], spells: Array<{ key: string; unrestricted: boolean }> = [], cantrips: string[] = [];
  for (const step of state.levels) {
    const bm = subclass === "battle-master" && step.level >= 3;
    const ek = subclass === "eldritch-knight" && step.level >= 3;
    const quota = bm ? step.level === 3 ? 3 : [7, 10, 15].includes(step.level) ? 2 : 0 : 0;
    if (step.maneuvers.length !== quota || step.maneuvers.some((key) => !(key in MANEUVERS))) throw new Error(`Guerrero ${step.level} requiere ${quota} maniobras nuevas.`);
    if (step.maneuverReplacement) {
      const { oldKey, newKey } = step.maneuverReplacement, index = maneuvers.indexOf(oldKey);
      if (!quota || index < 0 || !(newKey in MANEUVERS) || maneuvers.includes(newKey)) throw new Error("La sustitución de maniobra requiere un nivel que enseñe maniobras y una opción nueva.");
      maneuvers[index] = newKey;
    }
    maneuvers.push(...step.maneuvers);
    if (!distinct(maneuvers)) throw new Error("Elegí maniobras distintas de las que ya conocés.");
    if (bm && step.level === 3) {
      if (!ARTISAN_TOOLS.includes(step.artisanTool)) throw new Error("Estudiante de guerra requiere una herramienta de artesano.");
      const known = [...state.creation.background.tools, ...(state.creation.dwarfTool ? [DWARF_TOOLS[state.creation.dwarfTool]] : []), ...(state.creation.race === "rock-gnome" ? ["Herramientas de hojalatero"] : []), ...builderFeats({ ...state, levels: state.levels.filter((s) => s.level < 3) }).flatMap(({ feat }) => feat.tools)];
      if (known.includes(step.artisanTool)) throw new Error("Ya conocés esa herramienta; elegí otra o personalizá las herramientas del trasfondo para resolver la duplicación.");
    }
    else if (step.artisanTool) throw new Error("Las herramientas de Estudiante de guerra se eligen en Maestro de batalla 3.");
    if (!ek) { if (step.magic.cantrips.length || step.magic.learn.length || step.magic.replace) throw new Error("Solo el Caballero arcano elige estos conjuros."); continue; }
    const table = EK_PROGRESSION[step.level]!, old = EK_PROGRESSION[step.level - 1];
    const maxSpell = table.slots.reduce((max, amount, index) => amount > 0 ? index + 1 : max, 0);
    const eligible = (key: string, unrestricted: boolean) => {
      const spell = PHB_SPELLS[key];
      return spell && spell.classes.includes("wizard") && spell.level > 0 && spell.level <= maxSpell && (unrestricted || ["Abjuración", "Evocación"].includes(spell.school));
    };
    if (step.magic.replace) {
      const { oldKey, newKey } = step.magic.replace, index = spells.findIndex((spell) => spell.key === oldKey), oldSpell = spells[index];
      if (!oldSpell || !eligible(newKey, oldSpell.unrestricted) || spells.some((s) => s.key === newKey)) throw new Error("Sustituí un conjuro conocido respetando el nivel y la escuela de su plaza original.");
      spells[index] = { ...oldSpell, key: newKey };
    }
    const learned = table.known - (old?.known ?? 0), free = [3, 8, 14, 20].includes(step.level) ? 1 : 0;
    if (step.magic.learn.length !== learned || step.magic.learn.filter((s) => s.unrestricted).length !== free || step.magic.learn.some((s) => !eligible(s.key, s.unrestricted))) throw new Error(`Caballero arcano ${step.level}: elegí ${learned} conjuros nuevos, ${free} sin restricción de escuela.`);
    spells.push(...step.magic.learn);
    if (!distinct(spells.map((s) => s.key))) throw new Error("El Caballero arcano no aprende dos veces el mismo conjuro.");
    if (step.magic.cantrips.length !== table.cantrips - (old?.cantrips ?? 0) || step.magic.cantrips.some((key) => PHB_SPELLS[key]?.level !== 0 || !PHB_SPELLS[key]?.classes.includes("wizard"))) throw new Error("Elegí los trucos nuevos de mago correspondientes a este nivel.");
    cantrips.push(...step.magic.cantrips);
    if (!distinct(cantrips)) throw new Error("Elegí trucos de clase distintos de los que ya conocés.");
  }
  return { maneuvers, spells, cantrips };
}
