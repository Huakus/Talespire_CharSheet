import type { CharacterBuilderState } from "./character-builder-model";
import type { SkillKey } from "./character-checks";
import type { DruidCircle,DruidLand } from "./druid-model";
import { defaultFighterCreation } from "./fighter-builder-catalog";
import type { TraitDefinition } from "./builder-traits";
export const DRUID_SKILLS: SkillKey[] = ["arcana","animalHandling","insight","medicine","nature","perception","religion","survival"];
export const DRUID_WEAPONS = ["club","dagger","dart","javelin","mace","quarterstaff","scimitar","sickle","sling","spear"];
export const DRUID_CIRCLES: Record<DruidCircle,string> = { land: "Círculo de la Tierra",moon: "Círculo de la Luna",dreams: "Círculo de los Sueños",shepherd: "Círculo del Pastor" };
export const DRUID_LANDS: Record<DruidLand,string> = { arctic: "Ártico",forest: "Bosque",coast: "Costa",desert: "Desierto",underdark: "Infraoscuridad",mountain: "Montaña",swamp: "Pantano",grassland: "Pradera" };
export const HERBALISM = "Kit de herborista";
export const druidCircle = (s: CharacterBuilderState): DruidCircle|null => s.classKey === "druid" ? s.levels.find((l) => l.druid.circle)?.druid.circle ?? null : null;
export const druidLand = (s: CharacterBuilderState): DruidLand|null => s.classKey === "druid" ? s.levels.find((l) => l.druid.land)?.druid.land ?? null : null;
export const druidCantrips = (level: number) => level >= 10 ? 4 : level >= 4 ? 3 : 2;
export function wildShapeLimit(level: number,circle: DruidCircle|null) { return level < 2 ? 0 : circle === "moon" ? level >= 6 ? Math.floor(level/3) : 1 : level >= 8 ? 1 : level >= 4 ? 0.5 : 0.25; }
const LAND_SPELLS: Record<DruidLand,string[][]> = {
  arctic: [["hold-person","spike-growth"],["sleet-storm","slow"],["freedom-of-movement","ice-storm"],["commune-with-nature","cone-of-cold"]],
  forest: [["barkskin","spider-climb"],["call-lightning","plant-growth"],["divination","freedom-of-movement"],["commune-with-nature","tree-stride"]],
  coast: [["mirror-image","misty-step"],["water-breathing","water-walk"],["control-water","freedom-of-movement"],["conjure-elemental","scrying"]],
  desert: [["blur","silence"],["create-food-and-water","protection-from-energy"],["blight","hallucinatory-terrain"],["insect-plague","wall-of-stone"]],
  underdark: [["spider-climb","web"],["gaseous-form","stinking-cloud"],["greater-invisibility","stone-shape"],["cloudkill","insect-plague"]],
  mountain: [["spider-climb","spike-growth"],["lightning-bolt","meld-into-stone"],["stone-shape","stoneskin"],["passwall","wall-of-stone"]],
  swamp: [["acid-arrow","darkness"],["water-walk","stinking-cloud"],["freedom-of-movement","locate-creature"],["insect-plague","scrying"]],
  grassland: [["invisibility","pass-without-trace"],["daylight","haste"],["divination","freedom-of-movement"],["dream","insect-plague"]],
};
export function druidCircleSpells(state: CharacterBuilderState,level = state.levels.length+1) { const land = druidLand(state);return druidCircle(state) === "land" && land ? LAND_SPELLS[land].filter((_,i) => level >= 3+i*2).flat() : []; }
export function defaultDruidCreation(name = "") { const c = defaultFighterCreation(name);c.classKey = "druid";c.baseAbilities = { strength: 8,dexterity: 14,constitution: 13,intelligence: 12,wisdom: 15,charisma: 10 };c.skills = ["nature","perception"];c.equipment.goldRoll = [2,2];return c; }
type Feature = TraitDefinition & { level: number };
const f = (level: number,key: string,name: string,description: string,maximum?: number,reset?: TraitDefinition["reset"]): Feature => ({ level,key,name,description,...(maximum === undefined ? {} : { maximum,reset: reset ?? "none" }) });
export const DRUID_CORE: Feature[] = [
  f(1,"druidic","Lengua Druídica","Idioma secreto de druidas. Podés hablarlo y dejar mensajes ocultos; quienes lo conocen detectan automáticamente los mensajes. Otros los detectan con Percepción CD 15, pero no los descifran sin magia."),
  f(1,"spellcasting","Lanzamiento de Conjuros","Sabiduría. Preparás hasta nivel de Druida + SAB (mínimo uno) de toda la lista disponible, tras descanso largo y meditación de al menos un minuto por nivel de conjuro. Los espacios vuelven tras descanso largo. Ritual solo si está preparado. Foco druídico para materiales sin precio ni consumo. Los druidas tienen competencia con armaduras ligeras, medias y escudos, pero no visten armaduras ni usan escudos de metal; esto no es falta de competencia. Acordá materiales alternativos con el GM."),
  f(2,"wild-shape","Forma Salvaje","Acción: bestia vista antes, dos usos por descanso corto/largo. VD máximo 1/4 sin nado/vuelo; desde 4, VD 1/2 con nado; desde 8, VD 1 con vuelo. Dura mitad de nivel redondeada hacia abajo en horas; volver antes usa acción adicional. A 0 PG de forma, inconsciente o muerto revertís. Recuperás los PG de la ficha base y el daño sobrante se transfiere. Conservás INT/SAB/CAR, personalidad y alineamiento; usás estadísticas/PG/Dados de Golpe de la bestia. Conservás tus competencias y ganás las suyas; en competencias compartidas usá el bonificador mayor. Sin acciones legendarias/de guarida. Conservás rasgos físicamente posibles; sentidos especiales solo si la forma los tiene. Equipo: cae, se fusiona (sin efecto) o se lleva si el GM admite su tamaño/forma. No podés lanzar conjuros antes de Conjuros Bestiales; sí mantener concentración y realizar acciones de conjuros ya lanzados." ,2,"short-rest"),
  f(18,"timeless","Cuerpo Eterno","Por cada diez años transcurridos tu cuerpo envejece uno."),
  f(18,"beast-spells","Conjuros Bestiales","Podés realizar componentes verbales y somáticos de conjuros de Druida en Forma Salvaje, pero no proporcionar materiales. No habilita conjuros raciales o de otras clases."),
  f(20,"archdruid","Archidruida","Forma Salvaje ilimitada. Tus conjuros de Druida ignoran componentes verbales y somáticos y materiales sin precio ni consumo, tanto en forma natural como salvaje. Los materiales con precio o consumidos siguen siendo necesarios; en forma salvaje no podés proporcionarlos."),
];
export const DRUID_FEATURES: Record<DruidCircle,Feature[]> = {
  land: [
    f(2,"bonus-cantrip","Truco Adicional","Un truco de Druida adicional al elegir Tierra; no cuenta contra los trucos de la tabla."),
    f(2,"natural-recovery","Recuperación Natural","Durante descanso corto recuperá espacios gastados cuyos niveles sumen hasta mitad de nivel de Druida redondeada hacia arriba. Ninguno puede ser nivel 6 o superior. Una vez por descanso largo.",1,"long-rest"),
    f(3,"circle-spells","Conjuros del Círculo","Elegís uno de ocho terrenos en nivel 3; sus pares de conjuros llegan en 3, 5, 7 y 9. Siempre preparados, fuera del límite diario y considerados conjuros de Druida aunque no estén en su lista."),
    f(6,"land-stride","Zancada Forestal","Terreno difícil no mágico no cuesta movimiento adicional. Atravesás plantas no mágicas sin lentitud ni daño de espinas o peligros similares. Ventaja en salvaciones contra plantas creadas/manipuladas mágicamente para impedir movimiento."),
    f(10,"nature-ward","Protección de la Naturaleza","Inmune a veneno y enfermedad. Elementales y feéricos no pueden hechizarte ni asustarte."),
    f(14,"nature-sanctuary","Santuario de la Naturaleza","Bestias y plantas que intenten atacarte salvan SAB contra tu CD de conjuros. Fallo: eligen otro objetivo o el ataque falla automáticamente. Éxito: inmunes a este rasgo 24 horas. Conocen el efecto antes de atacar."),
  ],
  moon: [
    f(2,"combat-shape","Forma Salvaje de Combate","Podés transformarte como acción adicional. Mientras estás transformado, una acción adicional gasta un espacio y cura 1d8 PG de forma por nivel del espacio. No es lanzar un conjuro."),
    f(2,"circle-forms","Formas del Círculo","VD máximo 1 desde nivel 2 y un tercio de nivel redondeado hacia abajo desde 6. Conservás los límites de nado hasta 4 y vuelo hasta 8."),
    f(6,"primal-strike","Golpe Primitivo","Los ataques en forma de bestia cuentan como mágicos para superar resistencia e inmunidad a ataques/daño no mágicos."),
    f(10,"elemental-shape","Forma Salvaje Elemental","Gastá dos usos a la vez para elemental de aire, tierra, fuego o agua. No habilita otros elementales. Archidruida elimina el límite de usos."),
    f(14,"thousand-forms","Mil Formas","Alterar el Propio Aspecto a voluntad, a nivel 2 sin espacio. Conserva tiempo de lanzamiento, concentración y componentes; no es Forma Salvaje ni concede la capacidad de lanzarlo transformado antes de Conjuros Bestiales."),
  ],
  dreams: [
    f(2,"balm","Bálsamo del Tribunal de Verano","Reserva de d6 igual a tu nivel de Druida, por descanso largo. Acción adicional: criatura visible a 120 pies; gastá hasta mitad de nivel redondeada hacia abajo en dados, curá su suma y otorgá un PG temporal por dado gastado. No es conjuro; PG temporales no se acumulan."),
    f(6,"hearth","Hoguera de Luz de Luna y Sombra","Al iniciar descanso corto/largo, tocá un punto y creá esfera invisible de radio 30 pies, bloqueada por cobertura total. Vos y aliados dentro tienen +5 Sigilo y Percepción; la luz de llamas abiertas no se ve desde fuera. Termina al finalizar el descanso o si salís de la esfera."),
    f(10,"hidden-paths","Caminos Ocultos","Acción adicional: teleportate hasta 60 pies a lugar libre visible. O acción: criatura dispuesta que tocás se teletransporta hasta 30 pies a lugar libre visible. Usos = SAB (mínimo uno) por descanso largo."),
    f(14,"dream-walker","Caminante en Sueños","Al terminar descanso corto lanzá Sueño (vos como mensajero), Escudriñamiento o Círculo de Teletransportación sin espacio ni materiales. El círculo conduce al último lugar donde terminaste descanso largo en el plano actual; si no existe, falla sin gastar el rasgo. Una vez por descanso largo.",1,"long-rest"),
  ],
  shepherd: [
    f(2,"speech-woods","Lenguaje del Bosque","Hablás, leés y escribís Silvano. Las bestias entienden tu habla y comprendés sus sonidos y movimientos; no concede amistad ni capacidad para conceptos complejos."),
    f(2,"spirit","Tótem Espiritual","Acción adicional: espíritu en punto visible a 60 pies, aura de 30 pies, un minuto o hasta incapacitarte. No es criatura ni objeto; otra acción adicional lo mueve hasta 60 pies a punto visible. Elegí oso, halcón o unicornio al invocarlo; no es elección permanente del tutorial.",1,"short-rest"),
    f(2,"bear-spirit","Espíritu del Oso","Al aparecer el espíritu, criaturas elegidas en el aura reciben 5 + nivel de Druida PG temporales. Vos y aliados en el aura tienen ventaja en pruebas y salvaciones de Fuerza."),
    f(2,"hawk-spirit","Espíritu del Halcón","Reacción cuando una criatura tira un ataque contra un objetivo en el aura: concedé ventaja al ataque. Vos y aliados en el aura tienen ventaja en Percepción."),
    f(2,"unicorn-spirit","Espíritu del Unicornio","Vos y aliados tienen ventaja en pruebas para detectar criaturas dentro del aura. Al lanzar un conjuro con un espacio que cure PG a cualquier criatura dentro o fuera del aura, cada criatura elegida en el aura cura tu nivel de Druida."),
    f(6,"mighty-summoner","Invocador Poderoso","Bestias y feéricos invocados o creados por tus conjuros tienen dos PG extra por Dado de Golpe; daño de sus armas naturales cuenta como mágico para superar resistencias/inmunidades a ataques/daño no mágicos. No modifica tu Forma Salvaje."),
    f(10,"guardian-spirit","Espíritu Guardián","Una bestia o feérico invocado/creado por tus conjuros que termine su turno en el aura de tu tótem cura mitad de nivel de Druida redondeada hacia abajo."),
    f(14,"faithful-summons","Invocaciones Leales","Al quedar a 0 PG o incapacitado contra tu voluntad, podés obtener Conjurar Animales como a nivel 9: exactamente cuatro bestias elegidas de VD 2 o menor, aparecen a 20 pies y te protegen/atacan enemigos sin órdenes. Una hora o hasta descartarlo sin acción, sin concentración. Una vez por descanso largo.",1,"long-rest"),
  ],
};
