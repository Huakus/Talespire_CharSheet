import { defaultFighterCreation } from "./fighter-builder-catalog";
import type { CharacterBuilderState } from "./character-builder-model";
import type { SkillKey } from "./character-checks";
import type { RogueArchetype } from "./rogue-model";
import type { TraitDefinition } from "./builder-traits";
export const ROGUE_SKILLS: SkillKey[] = ["acrobatics","athletics","deception","insight","intimidation","investigation","perception","performance","persuasion","sleightOfHand","stealth"];
export const ROGUE_ASI_LEVELS = [4,8,10,12,16,19];
export const THIEVES_TOOLS = "Herramientas de ladrón";
export const THIEVES_EXPERTISE = "thieves-tools";
export const ROGUE_ARCHETYPES: Record<RogueArchetype,string> = { thief: "Ladrón",assassin: "Asesino","arcane-trickster": "Bribón Arcano",inquisitive: "Inquisitivo",mastermind: "Mente Maestra",scout: "Rastreador",swashbuckler: "Espadachín" };
export function rogueArchetype(state: CharacterBuilderState): RogueArchetype | null { return state.classKey === "rogue" ? state.levels.find((s) => s.rogue.archetype)?.rogue.archetype ?? null : null; }
export const rogueClassSkills = (state: CharacterBuilderState): string[] => rogueArchetype(state) === "scout" ? ["nature","survival"] : [];
export const rogueClassTools = (state: CharacterBuilderState): string[] => state.classKey === "rogue" ? [THIEVES_TOOLS,...state.levels.flatMap((s) => s.rogue.tools)] : [];
export const rogueClassExpertise = (state: CharacterBuilderState): string[] => state.classKey === "rogue" ? [...state.creation.rogue.expertise,...state.levels.flatMap((s) => s.rogue.expertise),...rogueClassSkills(state)] : [];
export function defaultRogueCreation(name = "") {
  const c = defaultFighterCreation(name);
  c.classKey = "rogue";
  c.baseAbilities = { strength: 8,dexterity: 15,constitution: 13,intelligence: 14,wisdom: 12,charisma: 10 };
  c.skills = ["acrobatics","investigation","sleightOfHand","stealth"];
  c.rogue.expertise = ["stealth",THIEVES_EXPERTISE];
  c.equipment.goldRoll = [2,2,2,2];
  return c;
}
export interface RogueFeature extends TraitDefinition { level: number }
const f = (level: number,key: string,name: string,description: string,maximum?: number,reset?: TraitDefinition["reset"]): RogueFeature => ({ level,key,name,description,...(maximum === undefined ? {} : { maximum,reset: reset ?? "none" }) });
export const ROGUE_CORE: RogueFeature[] = [
  f(1,"expertise","Experto","En niveles 1 y 6 elegís dos competencias para duplicar tu bonificador: habilidades competentes o herramientas de ladrón. Una competencia no puede recibir pericia dos veces."),
  f(1,"sneak-attack","Ataque Furtivo","Una vez por turno, al impactar con arma sutil o a distancia: sumá los dados de Ataque Furtivo si tenés ventaja, o si otro enemigo del objetivo está a 5 pies de él y no está incapacitado y vos no tenés desventaja. Puede usarse en un turno ajeno con una reacción. El daño comparte tipo y crítico con el ataque; no se añade a todos los impactos automáticamente."),
  f(1,"cant","Jerga de Ladrones","Código secreto verbal y de signos. Un mensaje hablado tarda cuatro veces lo normal; solo quienes conocen la jerga lo entienden. Los signos comunican advertencias, botines, territorios y refugios."),
  f(2,"cunning-action","Acción Astuta","En cada uno de tus turnos podés usar tu acción adicional para Carrera, Retirada o Esconderse. No otorga una segunda acción adicional."),
  f(5,"uncanny-dodge","Esquiva Asombrosa","Cuando un atacante que ves te impacta con un ataque, podés gastar tu reacción para reducir a la mitad el daño de ese ataque."),
  f(7,"evasion","Evasión","Ante un efecto con salvación de Destreza para mitad de daño, recibís cero si tenés éxito y la mitad si fallás. No se aplica a cualquier salvación ni a cualquier ataque."),
  f(11,"reliable-talent","Talento Seguro","En una prueba de característica que sume tu bonificador de competencia, tratá un d20 inferior a 10 como 10. No cambia el modificador, las salvaciones ni los ataques. Aplicá el mínimo al dado, antes de sumar modificadores y otros dados."),
  f(14,"blindsense","Sentido Ciego","Mientras puedas oír, conocés la ubicación de criaturas ocultas o invisibles a 10 pies. No equivale a verlas ni elimina por sí solo las reglas de invisibilidad."),
  f(15,"slippery-mind","Mente Escurridiza","Obtenés competencia en salvaciones de Sabiduría."),
  f(18,"elusive","Escurridizo","Mientras no estés incapacitado, ningún ataque tiene ventaja contra vos."),
  f(20,"stroke-of-luck","Golpe de Suerte","Si fallás un ataque contra un objetivo a tu alcance, podés convertirlo en impacto. También podés tratar el d20 de una prueba de característica fallida como 20. No afecta salvaciones. Un uso por descanso corto o largo.",1,"short-rest"),
];
export const ROGUE_FEATURES: Record<RogueArchetype,RogueFeature[]> = {
  thief: [
    f(3,"fast-hands","Manos Rápidas","Acción Astuta permite Juego de Manos, usar herramientas de ladrón para abrir cerraduras o desarmar trampas y Usar un Objeto. Activar un objeto mágico no es Usar un Objeto."),
    f(3,"second-story","Trabajo en el Segundo Piso","Trepar no cuesta movimiento extra. Los saltos con carrera suman tantos pies como tu modificador de Destreza; no concede velocidad de trepar independiente."),
    f(9,"supreme-sneak","Sigilo Supremo","Ventaja en Sigilo si no te movés más de la mitad de tu velocidad durante ese turno."),
    f(13,"use-magic-device","Usar Objeto Mágico","Ignorás requisitos de clase, raza y nivel de objetos mágicos. Conservan sus demás requisitos, sintonización y límites."),
    f(17,"thief-reflexes","Reflejos de Ladrón","Si no estás sorprendido, tenés dos turnos en la primera ronda: uno en tu iniciativa y otro diez puntos por debajo."),
  ],
  assassin: [
    f(3,"assassin-tools","Competencias Adicionales","Competencia con útiles para disfrazarse y de envenenador. Si ya tenías una, elegí otra herramienta del mismo tipo de competencia."),
    f(3,"assassinate","Asesinar","Ventaja en ataques contra criaturas que todavía no tomaron un turno en el combate. Un impacto contra una criatura sorprendida es crítico. Actuar antes no basta por sí solo para que esté sorprendida."),
    f(9,"infiltration","Experto en Infiltración","Con siete días y 25 po creás una identidad ficticia con historia, profesión y afiliaciones; no puede pertenecer a una persona existente. Se acepta hasta que haya un motivo evidente para dudar."),
    f(13,"impostor","Impostor","Tras al menos tres horas estudiando habla, escritura y conducta, podés imitarlas. Observadores casuales no lo distinguen; tenés ventaja en Engaño ante sospechas de observadores alertas."),
    f(17,"death-strike","Golpe Mortal","Cuando impactás a una criatura sorprendida, hace salvación de Constitución, CD 8 + competencia + Destreza. Si falla, duplicá el daño del ataque, incluido el furtivo. Resolvé también el crítico de Asesinar."),
  ],
  "arcane-trickster": [
    f(3,"spellcasting","Lanzamiento de Conjuros","Inteligencia; lista de mago. Mano de mago y dos trucos adicionales en nivel 3, otro en nivel 10. Conjuros conocidos, sin preparación ni libro; no concede rituales ni foco arcano. Usá componentes o bolsa de componentes. Recuperás espacios tras descanso largo. Podés sustituir un conjuro de nivel 1+ por nivel; conserva la libertad de escuela de su elección original (3, 8, 14 o 20)."),
    f(3,"legerdemain","Prestidigitación de Mano de Mago","La mano puede ser invisible, guardar o sacar objetos de contenedores que lleve otra criatura y usar herramientas de ladrón a distancia. Para hacerlo sin ser advertido: Juego de Manos contra Percepción. Acción Astuta permite controlarla como acción adicional; conserva las limitaciones de Mano de mago."),
    f(9,"magical-ambush","Emboscada Mágica","Si estás oculto de una criatura al lanzarle un conjuro, tiene desventaja en sus salvaciones contra ese conjuro durante ese turno."),
    f(13,"versatile-trickster","Bribón Versátil","Acción adicional: distraé una criatura a 5 pies de tu Mano de mago. Tus ataques contra ella tienen ventaja hasta el final del turno."),
    f(17,"spell-thief","Ladrón de Conjuros","Reacción inmediatamente después de que una criatura lance un conjuro que te tenga como objetivo o incluya en su área: salvación con su característica de lanzamiento contra tu CD. Si falla, negás el efecto sobre vos. Si es de nivel 1+ y de un nivel que puedas lanzar, lo conocés durante ocho horas y podés gastar tus espacios para lanzarlo, aunque no sea de mago; el lanzador no puede lanzarlo en ese tiempo. Se gasta el uso aunque supere la salvación.",1,"long-rest"),
  ],
  inquisitive: [
    f(3,"ear-for-deceit","Oído para el Engaño","En Perspicacia para descubrir mentiras, tratá un d20 de 7 o menos como 8. Es situacional; no modifica todas las pruebas de Perspicacia."),
    f(3,"eye-for-detail","Ojo para los Detalles","Acción adicional para Percepción destinada a detectar criaturas u objetos ocultos, o Investigación para descubrir o descifrar pistas."),
    f(3,"insightful-fighting","Lucha Inteligente","Acción adicional: Perspicacia contra Engaño de una criatura que puedas ver y no esté incapacitada. Si ganás, podés hacerle Ataque Furtivo sin ventaja mientras no tengas desventaja. Dura un minuto o hasta usarlo con éxito contra otro objetivo; conserva las demás reglas del furtivo."),
    f(9,"steady-eye","Ojo Estático","Ventaja en Percepción e Investigación si no te movés más de la mitad de tu velocidad ese turno."),
    f(13,"unerring-eye","Ojo Infalible","Acción: si no estás cegado ni ensordecido, percibís a 30 pies la presencia de ilusiones, cambiaformas fuera de su forma original y otra magia que engañe los sentidos. Solo percibís el engaño, no su naturaleza ni lo oculto. Usos = SAB, mínimo uno, por descanso largo.",1,"long-rest"),
    f(17,"eye-for-weakness","Ojo para la Debilidad","Tu Ataque Furtivo suma 3d6 contra la criatura afectada por tu Lucha Inteligente. No es un aumento general del furtivo."),
  ],
  mastermind: [
    f(3,"master-intrigue","Maestro de la Intriga","Competencia con útiles para disfrazarse, útiles de falsificación y un juego elegido; dos idiomas. Tras escuchar un minuto, imitás sin error el habla y acento de una criatura para pasar por nativo, siempre que conozcas el idioma."),
    f(3,"master-tactics","Maestro de Tácticas","Podés Ayudar como acción adicional. Al ayudar en un ataque, su objetivo puede estar a 30 pies de vos si puede verte u oírte, en lugar de 5 pies."),
    f(9,"insightful-manipulator","Manipulador Perspicaz","Tras un minuto observando o interactuando fuera del combate, compará dos valores con los tuyos: Inteligencia, Sabiduría, Carisma o niveles de clase. El GM informa si es igual, superior o inferior; puede revelar historia o personalidad."),
    f(13,"misdirection","Desorientar","Si una criatura a 5 pies te proporciona cobertura frente a un ataque dirigido contra vos, podés usar tu reacción para que ese ataque la impacte a ella."),
    f(17,"soul-deceit","Alma de Engaño","Nadie lee tus pensamientos sin permiso. Podés presentar pensamientos falsos ganando Engaño contra Perspicacia del lector. Si elegís hacerlo, la magia detecta tus palabras como verdaderas y no puede obligarte a decir la verdad."),
  ],
  scout: [
    f(3,"skirmisher","Escaramuzador","Si un enemigo termina su turno a 5 pies, podés usar tu reacción para moverte hasta la mitad de tu velocidad sin provocar ataques de oportunidad."),
    f(3,"survivalist","Superviviente","Competencia y doble bonificador en Naturaleza y Supervivencia. Si ya tenías competencia, igualmente pasa a pericia; no concede habilidades sustitutas."),
    f(9,"superior-mobility","Movilidad Superior","+10 pies a tu velocidad a pie y a tus velocidades de trepar y nadar si ya las tenés. No concede nuevas velocidades."),
    f(13,"ambush-master","Maestro de la Emboscada","Ventaja en iniciativa. La primera criatura que impactes en la primera ronda concede ventaja a todos los ataques contra ella hasta el inicio de tu próximo turno."),
    f(17,"sudden-strike","Golpe Repentino","Si realizás la acción Atacar en tu turno, podés hacer un ataque como acción adicional. Este puede recibir Ataque Furtivo aunque ya lo hayas usado ese turno, pero nunca contra el mismo objetivo más de una vez en ese turno."),
  ],
  swashbuckler: [
    f(3,"fancy-footwork","Juego de Pies Elegante","Una criatura contra la que hagas un ataque cuerpo a cuerpo durante tu turno no puede hacerte ataques de oportunidad el resto de ese turno. No requiere impactar."),
    f(3,"rakish-audacity","Audacia Gallarda","Sumás tu modificador de Carisma a iniciativa. Otra forma de Ataque Furtivo: estar a 5 pies del objetivo, sin ninguna otra criatura a 5 pies de vos y sin desventaja. Conserva el requisito de arma sutil o a distancia y el límite por turno."),
    f(9,"panache","Estilo","Acción: Persuasión contra Perspicacia de alguien que te oiga y comparta idioma. Hostil: un minuto con desventaja al atacar a otros y sin ataques de oportunidad contra ellos; termina si un compañero lo ataca o afecta con un conjuro, o se separan más de 60 pies. No hostil: queda hechizado y te considera conocido amistoso por un minuto, hasta que vos o tus compañeros lo dañen."),
    f(13,"elegant-maneuver","Maniobra Elegante","Acción adicional para tener ventaja en tu próxima prueba de Acrobacias o Atletismo durante ese turno."),
    f(17,"master-duelist","Maestro Duelista","Cuando fallás un ataque, podés repetirlo con ventaja. Un uso por descanso corto o largo.",1,"short-rest"),
  ],
};
