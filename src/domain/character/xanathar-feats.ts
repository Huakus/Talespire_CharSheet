import { bardCollege,bardClassSkills,bardClassTools,bardClassExpertise } from "./bard-catalog";
import { rogueClassSkills,rogueClassExpertise } from "./rogue-catalog";
import type { FeatChoice,CharacterBuilderState,FighterCreation } from "./character-builder-model";
type RacialFeat = { name: string; description: string; abilities: string[]; prerequisite: null; races: string[] };
const f = (name: string,description: string,races: string[],abilities: string[] = []): RacialFeat => ({ name,description,races,abilities,prerequisite: null });
const elves = ["high-elf","wood-elf","drow"], gnomes = ["forest-gnome","rock-gnome"], halflings = ["lightfoot-halfling","stout-halfling"], dwarves = ["hill-dwarf","mountain-dwarf"];
export const XANATHAR_FEATS = {
  "bountiful-luck": f("Suerte Abundante","Reacción cuando aliado visible a 30 pies saca 1 natural en ataque, prueba o salvación: repite y usa el nuevo resultado. Hasta final de tu siguiente turno, no podés usar tu Suerte racial.",halflings),
  "dragon-fear": f("Miedo de Dragón","+1 FUE, CON o CAR. En lugar de exhalar con Arma de Aliento, gastá ese mismo uso para rugir: criaturas elegidas a 30 pies que te vean/u oigan hacen SAB CD 8 + competencia + CAR o asustadas 1 minuto. Si reciben daño repiten la salvación; ignora sordas/ciegas que no te perciban.",["dragonborn"],["strength","constitution","charisma"]),
  "dragon-hide": f("Piel de Dragón","+1 FUE, CON o CAR. Sin armadura, CA 13 + DEX; admite escudo. Garras retráctiles: golpe sin armas 1d4 cortante + FUE.",["dragonborn"],["strength","constitution","charisma"]),
  "drow-high-magic": f("Alta Magia Drow","Detectar Magia a voluntad sin espacio; Levitar y Disipar Magia una vez cada uno sin espacio por descanso largo, con CAR.",["drow"]),
  "dwarven-fortitude": f("Fortaleza Enana","+1 CON. Al Esquivar en combate, podés gastar un dado de golpe, tirarlo y curar resultado + CON (mínimo 1 PG). Gastá el dado y aplicá la curación.",dwarves,["constitution"]),
  "elven-accuracy": f("Precisión Élfica","+1 DEX, INT, SAB o CAR. Cuando tenés ventaja en un ataque que usa cualquiera de esos atributos, podés repetir uno de los dados una vez. No se aplica a ataques con FUE.",[...elves,"half-elf"],["dexterity","intelligence","wisdom","charisma"]),
  "fade-away": f("Desvanecerse","+1 DEX o INT. Reacción tras recibir daño: invisible hasta final de tu siguiente turno o hasta atacar, causar daño u obligar a una salvación. Un uso por descanso corto/largo.",gnomes,["dexterity","intelligence"]),
  "fey-teleportation": f("Teletransporte Feérico","+1 INT o CAR; aprendés silvano. Paso Brumoso una vez sin espacio por descanso corto/largo; INT como atributo del conjuro.",["high-elf"],["intelligence","charisma"]),
  "flames-of-phlegethos": f("Llamas de Flegetos","+1 INT o CAR. Repetí cada 1 de dados de fuego de tus conjuros una vez y usá el resultado nuevo. Al lanzar uno que cause fuego podés rodearte de llamas hasta final de tu siguiente turno: luz brillante 30 pies y tenue otros 30; atacante a 5 pies que te impacte cuerpo a cuerpo recibe 1d4 fuego.",["tiefling"],["intelligence","charisma"]),
  "infernal-constitution": f("Constitución Infernal","+1 CON, resistencia a frío y veneno; ventaja en salvaciones contra envenenado.",["tiefling"],["constitution"]),
  "orcish-fury": f("Furia Orca","+1 FUE o CON. Al impactar con arma sencilla/marcial, podés añadir un dado de daño del arma del mismo tipo, una vez por descanso corto/largo. Al usar Aguante Incansable, reacción para un ataque con arma.",["half-orc"],["strength","constitution"]),
  prodigy: f("Prodigio","Una competencia en habilidad, otra en herramienta y un idioma nuevo. Elegí además una habilidad competente para duplicar competencia (no se acumula con otra pericia).",["human","human-variant","half-elf","half-orc"]),
  "second-chance": f("Segunda Oportunidad","+1 DEX, CON o CAR. Reacción tras recibir impacto visible: obliga a repetir el ataque contra vos. Se recupera al tirar iniciativa o tras descanso corto/largo.",halflings,["dexterity","constitution","charisma"]),
  "squat-nimbleness": f("Agilidad Achaparrada","+1 FUE o DEX, velocidad de caminar +5 pies, competencia en Acrobacias o Atletismo; ventaja en pruebas de FUE (Atletismo) o DEX (Acrobacias) para escapar de un agarre.",[...dwarves,...halflings,...gnomes],["strength","dexterity"]),
  "wood-elf-magic": f("Magia de Elfo del Bosque","Un truco de druida con SAB. Zancada Prodigiosa y Pasar sin Dejar Rastro una vez cada uno sin espacio por descanso largo, con SAB.",["wood-elf"]),
} satisfies Record<string,RacialFeat>;
export const isXanatharFeat = (key: string): key is keyof typeof XANATHAR_FEATS => key in XANATHAR_FEATS;
export function validateXanatharFeat(feat: FeatChoice,previous: CharacterBuilderState) {
  if (!isXanatharFeat(feat.key)) return;
  const definition = XANATHAR_FEATS[feat.key], c = previous.creation;
  if (!(definition.races as string[]).includes(c.race)) throw new Error(`No cumplís el requisito racial de ${definition.name}.`);
  const old = [c.initialFeat,...previous.levels.map((s) => s.feat)].filter((v) => v !== null);
  const skills = [...bardClassSkills(previous),...rogueClassSkills(previous),...c.skills,...c.background.skills,...c.origin.skills,...c.cleric.skills,...old.flatMap((f) => f.skills),...previous.levels.map((s) => s.xanathar.skill).filter(Boolean),...(["high-elf","wood-elf","drow"].includes(c.race) ? [c.racialSkillReplacement ?? "perception"] : c.race === "half-orc" ? [c.racialSkillReplacement ?? "intimidation"] : [])];
  if (feat.key === "prodigy") {
    if (feat.skills.length !== 1 || skills.includes(feat.skills[0]!) || feat.tools.length !== 1 || !feat.expertise || ![...skills,...feat.skills].includes(feat.expertise)) throw new Error("Prodigio requiere una habilidad nueva, una herramienta nueva y pericia en una habilidad competente.");
    const expertise = [...bardClassExpertise(previous),...rogueClassExpertise(previous),...old.flatMap((f) => f.expertise ? [f.expertise] : []),...(c.cleric.domain === "knowledge" ? c.cleric.skills : [])];
    if (expertise.includes(feat.expertise)) throw new Error("Ya tenés pericia en esta habilidad.");
    if (feat.languages.length !== 1) throw new Error("Prodigio requiere un idioma nuevo.");
  } else if (feat.key === "squat-nimbleness") {
    if (feat.skills.length !== 1 || !["acrobatics","athletics"].includes(feat.skills[0]!) || skills.includes(feat.skills[0]!)) throw new Error("Elegí Acrobacias o Atletismo sin repetir competencia.");
  } else if (feat.skills.length || feat.tools.length || feat.languages.length || feat.expertise) throw new Error("Esta dote no concede estas elecciones de competencias.");
  if (feat.key === "wood-elf-magic") {
    if (feat.spells.length !== 1) throw new Error("Magia de Elfo del Bosque requiere un truco de druida.");
  } else if (feat.spells.length) throw new Error("Esta dote no elige conjuros.");
  if (feat.spellClass || feat.damageType || feat.maneuvers.length || feat.weapons.length) throw new Error("Estas elecciones no corresponden a la dote racial.");
}
