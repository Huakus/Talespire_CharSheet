import type { CharacterBuilderState } from "./character-builder-model";
import type { SkillKey } from "./character-checks";
import type { RangerArchetype,RangerTerrain,RangerCompanion,RangerEnemy } from "./ranger-model";
import { defaultFighterCreation } from "./fighter-builder-catalog";
import type { TraitDefinition } from "./builder-traits";
export const RANGER_SKILLS: SkillKey[] = ["animalHandling","athletics","insight","investigation","nature","perception","stealth","survival"];
export const RANGER_ARCHETYPES: Record<RangerArchetype,string> = { hunter: "Cazador","beast-master": "Señor de las Bestias","gloom-stalker": "Acechador de la Penumbra","horizon-walker": "Caminante del Horizonte","monster-slayer": "Asesino de Monstruos" };
export const RANGER_TERRAINS: Record<RangerTerrain,string> = { arctic: "Ártico",coast: "Costa",desert: "Desierto",forest: "Bosque",grassland: "Pradera",mountain: "Montaña",swamp: "Pantano",underdark: "Infraoscuridad" };
export const RANGER_ENEMIES: Record<RangerEnemy["type"],string> = { aberrations: "Aberraciones",beasts: "Bestias",celestials: "Celestiales",constructs: "Constructos",dragons: "Dragones",elementals: "Elementales",fey: "Feéricos",fiends: "Infernales",giants: "Gigantes",monstrosities: "Monstruosidades",oozes: "Cienos",plants: "Plantas",undead: "Muertos vivientes",humanoids: "Dos razas de humanoides" };
export const RANGER_HUMANOIDS = ["Humanos","Elfos","Enanos","Gnomos","Medianos","Orcos","Gnolls","Goblins","Hobgoblins","Bugbears","Kobolds","Hombres lagarto","Sahuagin","Aarakocra","Bullywugs","Githyanki","Githzerai","Trogloditas","Kuo-toa","Tritones"];
export const RANGER_SLOTS = [[],[],[2],[3],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]];
export const RANGER_KNOWN = [0,0,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11];
export const rangerArchetype = (s: CharacterBuilderState): RangerArchetype|null => s.classKey === "ranger" ? s.levels.find((l) => l.ranger.archetype)?.ranger.archetype ?? null : null;
export const rangerLanguages = (s: CharacterBuilderState) => s.classKey === "ranger" ? [s.creation.ranger.enemy?.language,...s.levels.map((l) => l.ranger.enemy?.language)].filter((s): s is string => !!s) : [];
const EXTRA_SPELLS: Partial<Record<RangerArchetype,string[]>> = {
  "gloom-stalker": ["disguise-self","rope-trick","fear","greater-invisibility","seeming"],
  "horizon-walker": ["protection-from-evil-and-good","misty-step","haste","banishment","teleportation-circle"],
  "monster-slayer": ["protection-from-evil-and-good","zone-of-truth","magic-circle","banishment","hold-monster"],
};
export function rangerBonusSpell(archetype: RangerArchetype|null,level: number) { const index = [3,5,9,13,17].indexOf(level);return archetype && index >= 0 ? EXTRA_SPELLS[archetype]?.[index] ?? null : null; }
export const RANGER_COMPANIONS: Record<string,RangerCompanion> = {
  wolf: { name: "Lobo",species: "Lobo",type: "beast",size: "medium",challenge: 0.25,baseHp: 11,baseAc: 13,attackBonus: 4,damage: "2d4+2",hitDice: 2,dieSize: 8,checks: [{ label: "Percepción",bonus: 3 },{ label: "Sigilo",bonus: 4 }],notes: "Velocidad 40 pies. Mordisco perforante; impacto: FUE CD 11 o derribado. Ventaja en Percepción por oído/olfato. Tácticas de manada: ventaja al atacar si un aliado no incapacitado está a 5 pies del objetivo. Usá su bloque de estadísticas para atributos y demás reglas." },
  mastiff: { name: "Mastín",species: "Mastín",type: "beast",size: "medium",challenge: 0.125,baseHp: 5,baseAc: 12,attackBonus: 3,damage: "1d6+1",hitDice: 1,dieSize: 8,checks: [{ label: "Percepción",bonus: 3 }],notes: "Velocidad 40 pies. Mordisco perforante; impacto contra criatura: FUE CD 11 o derribada. Ventaja en Percepción por oído/olfato. Atributos y demás reglas en el bloque de la bestia." },
  hawk: { name: "Halcón",species: "Halcón",type: "beast",size: "tiny",challenge: 0,baseHp: 1,baseAc: 13,attackBonus: 5,damage: "1",hitDice: 1,dieSize: 4,checks: [{ label: "Percepción",bonus: 4 }],notes: "Velocidad 10 pies, vuelo 60 pies. Garras: daño cortante. Ventaja en Percepción basada en la vista. Atributos y demás reglas en el bloque de la bestia." },
  panther: { name: "Pantera",species: "Pantera",type: "beast",size: "medium",challenge: 0.25,baseHp: 13,baseAc: 12,attackBonus: 4,damage: "1d6+2",hitDice: 3,dieSize: 8,checks: [{ label: "Percepción",bonus: 4 },{ label: "Sigilo",bonus: 6 }],notes: "Velocidad 50 pies, trepar 40 pies. Mordisco perforante 1d6+2; garras cortantes 1d4+2 (sumá competencia de Explorador también a su daño). Ventaja en Percepción por olfato. Abalanzarse: al avanzar 20 pies rectos e impactar con garras, FUE CD 12 o derribado; si queda derribado, puede morder como acción adicional. Conservá las demás reglas del bloque." },
};
export function defaultRangerCreation(name = "") { const c = defaultFighterCreation(name);c.classKey = "ranger";c.baseAbilities = { strength: 10,dexterity: 15,constitution: 13,intelligence: 8,wisdom: 14,charisma: 12 };c.skills = ["nature","perception","survival"];c.ranger.enemy = { type: "dragons",humanoids: [],language: "Dracónico",languageConfirmed: true };c.ranger.terrain = "forest";return c; }
type Feature = TraitDefinition & { level: number };
const f = (level: number,key: string,name: string,description: string,maximum?: number,reset?: TraitDefinition["reset"]): Feature => ({ level,key,name,description,...(maximum === undefined ? {} : { maximum,reset: reset ?? "none" }) });
export const HUNTER_OPTIONS: Record<number,Record<string,{ name: string;description: string }>> = {
  3: {
    "colossus-slayer": { name: "Asesino Colosal",description: "Una vez por turno al impactar con arma a una criatura que esté por debajo de sus PG máximos, +1d8 de daño del arma." },
    "giant-killer": { name: "Asesino de Gigantes",description: "Reacción después de que una criatura Grande o mayor a 5 pies te impacte o falle con un ataque: atacala si podés verla." },
    "horde-breaker": { name: "Rompe Hordas",description: "Una vez en cada uno de tus turnos al hacer un ataque con arma, podés hacer otro con la misma arma contra otra criatura a 5 pies del objetivo original y dentro del alcance del arma." },
  },
  7: {
    "escape-horde": { name: "Escapar de la Horda",description: "Los ataques de oportunidad contra vos tienen desventaja." },
    "multiattack-defense": { name: "Defensa Contra Ataques Múltiples",description: "Después de que una criatura te impacte, +4 CA contra todos sus ataques posteriores durante el resto de ese turno." },
    "steel-will": { name: "Voluntad de Acero",description: "Ventaja en salvaciones contra estar asustado." },
  },
  11: {
    volley: { name: "Torrente",description: "Acción para un ataque a distancia separado contra cada criatura elegida a 10 pies de un punto visible dentro del alcance del arma. Munición por objetivo. No es la acción Atacar ni se acumula con Ataque Extra." },
    whirlwind: { name: "Ataque de Torbellino",description: "Acción para un ataque cuerpo a cuerpo separado contra cada criatura elegida a 5 pies de vos. No es la acción Atacar ni agrega Ataque Extra." },
  },
  15: {
    evasion: { name: "Evasión",description: "Cuando una salvación DES permite mitad de daño, recibís cero con éxito y mitad con fallo." },
    "stand-tide": { name: "Contracorriente",description: "Reacción cuando una criatura hostil falle un ataque cuerpo a cuerpo contra vos: obligala a repetir ese mismo ataque contra otra criatura elegida que no sea ella misma." },
    "uncanny-dodge": { name: "Esquiva Asombrosa",description: "Reacción cuando un atacante visible te impacte: reducí a la mitad el daño de ese ataque, no de todos los ataques del turno." },
  },
};
export const RANGER_CORE: Feature[] = [
  f(1,"favored-enemy","Enemigo Predilecto","En 1, 6 y 14 elegís un tipo de enemigo o dos razas de humanoides, y un idioma que hablen si tienen alguno. Ventaja en Supervivencia para rastrearlos y pruebas INT para recordar información sobre ellos. No concede daño extra antes de Asesino de Enemigos."),
  f(1,"natural-explorer","Explorador de lo Natural","Terreno predilecto en 1, 6 y 10. En pruebas INT/SAB relacionadas con él, duplicás competencia si usás una habilidad competente; no se acumula con pericia. Tras viajar una hora o más: terreno difícil no retrasa al grupo; no se pierde salvo por magia; seguís alerta con otras tareas; si viajás solo, podés moverte sigilosamente a ritmo normal; recolectás doble alimento; al rastrear sabés cantidad exacta, tamaños y antigüedad del paso."),
  f(2,"spellcasting","Lanzamiento de Conjuros","Sabiduría, conjuros conocidos sin preparación diaria. Dos desde nivel 2; nuevos según tabla, sin trucos de clase. Un conocido puede sustituirse por otro de la lista de Explorador al ganar nivel. Recuperás espacios tras descanso largo. Estas reglas no conceden rituales ni uso de un foco druídico: necesitás bolsa/componentes y manos/materiales según cada conjuro."),
  f(3,"primeval-awareness","Conciencia Primitiva","Acción y un espacio: durante tantos minutos como nivel del espacio, detectás presencia de aberraciones, celestiales, dragones, elementales, feéricos, infernales y muertos vivientes a una milla (seis en terreno predilecto). No revela ubicación ni número. No es conjuro ni exige concentración."),
  f(5,"extra-attack","Ataque Extra","Dos ataques al realizar la acción Atacar en tu turno. No se aplica a Torrente/Torbellino ni concede dos acciones."),
  f(8,"land-stride","Zancada Forestal","Terreno difícil no mágico no cuesta movimiento adicional. Plantas no mágicas no te frenan ni dañan con sus espinas/peligros similares. Ventaja en salvaciones contra plantas creadas/manipuladas mágicamente para impedir movimiento."),
  f(10,"hide-plain","Ocultarse a Plena Vista","Un minuto de camuflaje con materiales naturales. Al ocultarte contra una superficie sólida al menos tan alta y ancha como vos, +10 Sigilo mientras no te muevas ni realices acciones. Moverte, actuar o reaccionar exige camuflarte de nuevo."),
  f(14,"vanish","Esfumarse","Esconderse como acción adicional. No pueden rastrearte por medios no mágicos, salvo que dejes rastro voluntariamente."),
  f(18,"feral-senses","Sentidos Salvajes","Atacar a alguien que no ves no te impone desventaja por ese motivo. Conocés ubicación de invisibles a 30 pies que no estén escondidos de vos, mientras no estés cegado ni ensordecido. No equivale a visión verdadera ni elimina otras fuentes de desventaja."),
  f(20,"foe-slayer","Asesino de Enemigos","Una vez por turno, sumá SAB a la tirada de ataque o daño de un ataque contra un enemigo predilecto. Podés elegir después de tirar, antes de aplicar efectos. No se suma automáticamente a todos los ataques."),
];
export const RANGER_FEATURES: Record<RangerArchetype,Feature[]> = {
  hunter: [],
  "beast-master": [
    f(3,"companion","Compañero Animal","Una bestia Mediana o menor, VD ≤ 1/4. Suma tu competencia a CA, ataques, daño y a habilidades/salvaciones en las que sea competente; PG máximos = mayor entre sus PG base y cuatro veces tu nivel. Puede gastar sus Dados de Golpe en descanso corto. Actúa en tu iniciativa; moverla se ordena verbalmente sin acción. Usás tu acción para ordenar Atacar, Carrera, Retirada o Ayudar; sin orden realiza Esquivar. Con Ataque Extra hacés un ataque propio cuando ordenás Atacar. Si estás incapacitado o ausente, actúa por sí misma protegiéndolos. Sus reacciones nunca requieren orden. Solo con ella en terreno predilecto, ambos viajan sigilosamente a ritmo normal. Tras su muerte, vinculás otra bestia no hostil durante ocho horas."),
    f(7,"exceptional-training","Entrenamiento Excepcional","En un turno en el que la bestia no ataque, acción adicional para ordenar Carrera, Retirada o Ayudar. Esquivar ya es su acción por defecto. Sus ataques cuentan como mágicos para superar resistencia/inmunidad a ataques y daño no mágicos."),
    f(11,"bestial-fury","Furia Bestial","Al ordenarle la acción Atacar, la bestia puede realizar dos ataques o usar Multiataque si su bloque lo tiene."),
    f(15,"share-spells","Compartir Conjuros","Al lanzar un conjuro dirigido a vos mismo, también podés afectar al compañero si está a 30 pies. No concede conjuros ni altera sus demás restricciones."),
  ],
  "gloom-stalker": [
    f(3,"dread-ambusher","Emboscador Terrorífico","Sumá SAB a iniciativa. Al inicio de tu primer turno del combate, +10 pies a velocidad a pie hasta fin de turno. Si usás Atacar en ese turno, un ataque con arma adicional de esa acción; si impacta, +1d8 del tipo del arma solo en ese ataque."),
    f(3,"umbral-sight","Visión Umbral","Visión en oscuridad 60 pies; si ya la tenés por raza, aumenta 30 pies. En oscuridad sos invisible para criaturas que dependan de visión en oscuridad para verte allí."),
    f(7,"iron-mind","Mente de Hierro","Competencia en salvaciones SAB. Si ya tenés esa competencia, elegís INT o CAR en su lugar."),
    f(11,"stalker-flurry","Ráfaga de Acechador","Una vez en cada uno de tus turnos, al fallar con un ataque con arma, podés hacer otro ataque con arma como parte de la misma acción."),
    f(15,"shadowy-dodge","Evasión Sombría","Reacción cuando una criatura tire un ataque contra vos sin ventaja: imponé desventaja antes de conocer su resultado."),
  ],
  "horizon-walker": [
    f(3,"detect-portal","Detectar Portal","Acción: distancia y dirección al portal planar más cercano a una milla. Una vez por descanso corto/largo.",1,"short-rest"),
    f(3,"planar-warrior","Guerrero Planar","Acción adicional: criatura visible a 30 pies. Tu próximo impacto con arma contra ella este turno convierte todo el daño de ese ataque a fuerza y suma 1d8 (2d8 desde 11). No modifica todos los ataques del turno."),
    f(7,"ethereal-step","Paso Etéreo","Acción adicional: Excursión Etérea sin espacio; termina al final del turno actual. Una vez por descanso corto/largo.",1,"short-rest"),
    f(11,"distant-strike","Golpe Distante","Al usar Atacar, podés teletransportarte hasta 10 pies a espacio libre visible antes de cada ataque. Si atacás a dos criaturas distintas, podés hacer otro ataque contra una tercera."),
    f(15,"spectral-defense","Defensa Espectral","Reacción al recibir daño de un ataque para ganar resistencia a todo el daño de ese ataque en ese turno."),
  ],
  "monster-slayer": [
    f(3,"hunters-sense","Sentido del Cazador","Acción: criatura visible a 60 pies; conocés inmunidades, resistencias y vulnerabilidades al daño. Si está oculta de adivinación, parece no tener ninguna. Usos = SAB, mínimo uno, por descanso largo."),
    f(3,"slayers-prey","Presa del Cazador","Acción adicional: objetivo visible a 60 pies. La primera vez en cada turno que lo impactes con arma, +1d6 del daño del arma. Dura hasta descanso corto/largo o designar otro; no es Marca del Cazador ni exige concentración."),
    f(7,"supernatural-defense","Defensa Sobrenatural","+1d6 a salvaciones impuestas por tu Presa del Cazador y pruebas para escapar de su agarre."),
    f(11,"magic-nemesis","Némesis del Usuario Mágico","Reacción al ver una criatura a 60 pies lanzar un conjuro o teletransportarse: salva SAB contra tu CD o falla y se desperdicia. Una vez por descanso corto/largo; no es Contraconjuro ni gasta espacio.",1,"short-rest"),
    f(15,"slayers-counter","Contraataque del Cazador","Reacción cuando tu Presa del Cazador te imponga salvación: antes de salvar, hacé un ataque con arma contra ella. Si impacta, la salvación tiene éxito automáticamente además del efecto del ataque."),
  ],
};
