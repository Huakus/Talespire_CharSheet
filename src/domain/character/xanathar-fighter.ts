import type { CharacterBuilderState,FighterCreation } from "./character-builder-model";
import type { TraitDefinition } from "./builder-traits";
import { racialSkillGrants,builderFeats,distinct } from "./fighter-build-rules";
import { LANGUAGES } from "./phb-character-options";
import { BUILDER_RACES } from "./fighter-builder-catalog";
export const ARCANE_SHOTS: Record<string,{ name: string; description: string }> = {
  banishing: { name: "Flecha de Destierro",description: "CAR contra CD: destierra al Feywild hasta final de su siguiente turno. Velocidad 0 e incapacitado mientras está fuera; reaparece en su lugar o el más cercano. Desde Guerrero 18, el impacto también causa 2d6 de fuerza." },
  beguiling: { name: "Flecha Seductora",description: "+2d6 psíquico (4d6 en 18); elegí aliado a 30 pies del objetivo: SAB o queda hechizado por él hasta inicio de tu siguiente turno, o hasta recibir daño del aliado/sus compañeros." },
  bursting: { name: "Flecha Explosiva",description: "Tras impacto, objetivo y criaturas a 10 pies reciben 2d6 de fuerza (4d6 en 18), sin salvación." },
  enfeebling: { name: "Flecha Debilitadora",description: "+2d6 necrótico (4d6 en 18). CON o daño de ataques con armas reducido a la mitad hasta inicio de tu siguiente turno." },
  grasping: { name: "Flecha Atrapante",description: "+2d6 veneno; velocidad −10 pies y 2d6 cortante la primera vez de cada turno que se mueva 1 pie o más sin teletransporte. Dura 1 minuto o hasta retirarla: acción y Atletismo contra CD por objetivo u otra criatura. En 18, ambos daños pasan a 4d6." },
  piercing: { name: "Flecha Perforante",description: "No tirás ataque: línea 30 pies × 1 pie sin cobertura, atraviesa objetos inofensivamente. Criaturas hacen DEX: daño normal de flecha +1d6 perforante; mitad con éxito. En 18, adicional 2d6." },
  seeking: { name: "Flecha Buscadora",description: "No tirás ataque: una criatura vista en el último minuto y dentro de alcance del arma. La flecha sortea esquinas y cobertura, salvo si no hay camino o está fuera de alcance. DEX: daño normal +1d6 fuerza y revela ubicación; éxito mitad, sin revelar. En 18, adicional 2d6." },
  shadow: { name: "Flecha Sombría",description: "+2d6 psíquico (4d6 en 18). SAB o no puede ver más allá de 5 pies hasta inicio de tu siguiente turno." },
};
export const XGE_FIGHTER_SKILLS = { "arcane-archer": ["arcana","nature"],cavalier: ["animalHandling","history","insight","performance","persuasion"],samurai: ["history","insight","performance","persuasion"] };
export function validateXanatharFighter(state: CharacterBuilderState) {
  const subclass = state.levels.find((s) => s.level===3)?.subclass;
  const shots: string[] = [];
  for (const step of state.levels) {
    const x = step.xanathar, first = step.level===3, archer = subclass === "arcane-archer";
    const quota = archer ? first ? 2 : [7,10,15,18].includes(step.level) ? 1 : 0 : 0;
    if (x.shots.length !== quota || x.shots.some((k) => !ARCANE_SHOTS[k]) || !distinct([...shots,...x.shots])) throw new Error(`Este nivel requiere ${quota} opciones nuevas de Disparo Arcano.`);
    shots.push(...x.shots);
    if (first && subclass && subclass in XGE_FIGHTER_SKILLS) {
      const allowed = XGE_FIGHTER_SKILLS[subclass as keyof typeof XGE_FIGHTER_SKILLS], selected = x.skill;
      if (archer ? !allowed.includes(selected) || !!x.language : (Boolean(selected) === Boolean(x.language)) || selected && !allowed.includes(selected) || x.language && !LANGUAGES.includes(x.language)) throw new Error("Elegí la habilidad de tu arquetipo o, donde corresponda, un idioma.");
      const known = [...state.creation.skills,...state.creation.background.skills,...racialSkillGrants(state.creation),...builderFeats({ ...state,levels: state.levels.filter((s) => s.level<3) }).flatMap(({ feat }) => feat.skills)];
      if (selected && known.includes(selected as typeof known[number])) throw new Error("Ya tenés esta habilidad; elegí otra competencia de arquetipo.");
      if (x.language && [...BUILDER_RACES[state.creation.race].languages,...state.creation.languages,...state.creation.background.languages,...builderFeats(state).flatMap(({ feat }) => feat.languages)].includes(x.language)) throw new Error("Ya conocés este idioma.");
      if (archer ? !["prestidigitation","druidcraft"].includes(x.cantrip) : !!x.cantrip) throw new Error("Arquero Arcano aprende Prestidigitación o Saber Druídico.");
    } else if (x.skill || x.language || x.cantrip) throw new Error("Estas elecciones de arquetipo se adquieren en Guerrero 3.");
    const wisdomKnown = state.creation.initialFeat?.key === "resilient" && state.creation.initialFeat.ability === "wisdom" || state.levels.some((s) => s.level<=7 && s.feat?.key === "resilient" && s.feat.ability === "wisdom");
    if (subclass === "samurai" && step.level === 7 && wisdomKnown ? !["intelligence","charisma"].includes(x.bonusSave ?? "") : x.bonusSave !== null) throw new Error("Cortesano Elegante concede SAB; si ya sos competente, elegí salvación INT o CAR.");
  }
}
export function xanatharFighterTraits(state: CharacterBuilderState,scores: FighterCreation["baseAbilities"]): TraitDefinition[] {
  const subclass = state.levels.find((s) => s.level===3)?.subclass, level = state.levels.length+1, mod = (score: number) => Math.floor((score-10)/2), result: TraitDefinition[] = [];
  const add = (minimum: number,key: string,name: string,description: string,maximum?: number,reset?: TraitDefinition["reset"]) => { if (level>=minimum) result.push({ key,name,description,...(maximum !== undefined ? { maximum,...(reset ? { reset } : {}) } : {}) }); };
  if (subclass === "arcane-archer") {
    add(3,"arcane-lore","Saber del Arquero Arcano","Competencia en Conocimiento Arcano o Naturaleza; Prestidigitación o Saber Druídico, con Inteligencia.");
    add(3,"arcane-shot","Disparo Arcano",`Dos usos por descanso corto/largo. Una vez por turno, al disparar flecha con arco corto/largo como parte de Atacar, aplicá una opción; normalmente se decide tras impactar salvo que no tire ataque. CD = 8 + competencia + INT (${mod(scores.intelligence)}).`,2,"short-rest");
    for (const key of state.levels.flatMap((s) => s.xanathar.shots)) result.push({ key: `shot-${key}`,...ARCANE_SHOTS[key]! });
    add(7,"magic-arrow","Flecha Mágica","Flechas no mágicas de arco corto/largo cuentan como mágicas contra resistencia/inmunidad hasta terminar el ataque.");
    add(7,"curving-shot","Disparo Curvo","Acción adicional tras fallar con flecha mágica: repetí el ataque contra otro objetivo a 60 pies del original.");
    add(15,"ever-ready-shot","Disparo Siempre Listo","Si tirás iniciativa sin usos de Disparo Arcano, recuperás uno; ajustá el contador.");
  } else if (subclass === "cavalier") {
    add(3,"born-saddle","Nacido para la Silla","Ventaja en salvaciones para no caer de montura. Si caés a 10 pies o menos, podés aterrizar de pie si no estás incapacitado. Montar/desmontar cuesta 5 pies de movimiento.");
    add(3,"unwavering-mark","Marca Inquebrantable",`Tras impacto cuerpo a cuerpo con arma, marcá hasta final de tu siguiente turno (termina por incapacitarte, morir u otra marca). A 5 pies de vos, desventaja en ataques a otros. Si daña a otro, en tu próximo turno podés gastar uso para un ataque cuerpo a cuerpo con arma como acción adicional, con ventaja y +${Math.floor(level/2)} daño. Marcar es ilimitado; el contador corresponde solo al ataque especial.`,Math.max(1,mod(scores.strength)),"long-rest");
    add(7,"warding-maneuver","Maniobra Protectora","Reacción cuando vos o criatura visible a 5 pies recibe un impacto, sosteniendo arma cuerpo a cuerpo o escudo: 1d8 a su CA para ese ataque. Si aun impacta, resistencia al daño de ese ataque.",Math.max(1,mod(scores.constitution)),"long-rest");
    add(10,"hold-line","Mantener la Línea","Criaturas provocan ataque de oportunidad al moverse 5 pies o más dentro de tu alcance. Si impactás con un ataque de oportunidad, velocidad 0 el resto del turno.");
    add(15,"ferocious-charger","Cargador Feroz",`Una vez en cada uno de tus turnos, tras moverte 10 pies rectos hacia criatura y golpearla cuerpo a cuerpo con arma: FUE CD ${8+Math.ceil(level/4)+1+mod(scores.strength)} o derribada.`);
    add(18,"vigilant-defender","Defensor Vigilante","Reacción especial una vez en cada turno ajeno, solo ataque de oportunidad. No puede usarse en el mismo turno que tu reacción normal.");
  } else if (subclass === "samurai") {
    add(3,"fighting-spirit","Espíritu de Lucha",`Acción adicional: ventaja en ataques con armas hasta final de este turno y ${level>=15 ? 15 : level>=10 ? 10 : 5} PG temporales (no se acumulan).`,3,"long-rest");
    add(7,"elegant-courtier","Cortesano Elegante","Sumá SAB a Persuasión y ganá competencia en salvaciones SAB; si ya la tenés, elegí INT o CAR.");
    add(10,"tireless-spirit","Espíritu Incansable","Si tirás iniciativa sin usos de Espíritu de Lucha, recuperás uno; ajustá el contador.");
    add(15,"rapid-strike","Golpe Rápido","Una vez en cada uno de tus turnos, si tenés ventaja en un ataque con arma al Atacar, renunciá a ella en ese ataque para hacer otro ataque con arma contra el mismo objetivo como parte de la acción.");
    add(18,"strength-before-death","Fuerza Antes de la Muerte","Reacción al caer a 0 PG sin morir instantáneamente: interrumpí el turno y tomá uno adicional. El daño causa fallos de salvación de muerte normalmente; tres fallos matan. Al terminar ese turno, quedás inconsciente si seguís a 0 PG.",1,"long-rest");
  }
  return result;
}
