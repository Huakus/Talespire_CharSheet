import type { CharacterBuilderState } from "./character-builder-model";
import { SKILL_DEFINITIONS,type SkillKey } from "./character-checks";
import { defaultFighterCreation } from "./fighter-builder-catalog";
import type { BardCollege } from "./bard-model";
import type { TraitDefinition } from "./builder-traits";
export const BARD_SKILLS = Object.keys(SKILL_DEFINITIONS) as SkillKey[];
export const BARD_COLLEGES: Record<BardCollege,string> = { lore: "Colegio del Conocimiento",valor: "Colegio del Valor",glamour: "Colegio del Glamour",swords: "Colegio de Espadas",whispers: "Colegio de los Susurros" };
export const BARD_KNOWN = [0,4,5,6,7,8,9,10,11,12,14,15,15,16,18,19,19,20,22,22,22];
export const bardCantrips = (level: number) => level >= 10 ? 4 : level >= 4 ? 3 : 2;
export const bardDie = (level: number) => level >= 15 ? 12 : level >= 10 ? 10 : level >= 5 ? 8 : 6;
export const songRestDie = (level: number) => level >= 17 ? 12 : level >= 13 ? 10 : level >= 9 ? 8 : 6;
export const bardMantleHp = (level: number) => level >= 15 ? 14 : level >= 10 ? 11 : level >= 5 ? 8 : 5;
export const psychicBladesDice = (level: number) => level >= 15 ? 8 : level >= 10 ? 5 : level >= 5 ? 3 : 2;
export const bardCollege = (s: CharacterBuilderState): BardCollege|null => s.classKey === "bard" ? s.levels.find((l) => l.bard.college)?.bard.college ?? null : null;
export const bardClassSkills = (s: CharacterBuilderState): string[] => s.classKey === "bard" ? s.levels.flatMap((l) => l.bard.skills) : [];
export const bardClassTools = (s: CharacterBuilderState): string[] => s.classKey === "bard" ? s.creation.bard.instruments : [];
export const bardClassExpertise = (s: CharacterBuilderState): string[] => s.classKey === "bard" ? s.levels.flatMap((l) => l.bard.expertise) : [];
export const bardSecretsCount = (level: number,college: BardCollege|null) => [10,14,18].includes(level) || level === 6 && college === "lore" ? 2 : 0;
export const bardLearnCount = (level: number) => BARD_KNOWN[level]!-BARD_KNOWN[level-1]!-([10,14,18].includes(level) ? 2 : 0);
export function defaultBardCreation(name = "") {
  const c = defaultFighterCreation(name); c.classKey = "bard";
  c.baseAbilities = { strength: 8,dexterity: 14,constitution: 13,intelligence: 12,wisdom: 10,charisma: 15 };
  c.skills = ["performance","persuasion","deception"];
  c.bard.instruments = ["Laúd","Flauta","Viola"];
  return c;
}
type Feature = TraitDefinition & { level: number };
const f = (level: number,key: string,name: string,description: string,maximum?: number,reset?: TraitDefinition["reset"]): Feature => ({ level,key,name,description,...(maximum === undefined ? {} : { maximum,reset: reset ?? "none" }) });
export const BARD_CORE: Feature[] = [
  f(1,"spellcasting","Lanzamiento de Conjuros","Carisma; conjuros conocidos sin preparación diaria. Instrumento musical como foco; no sustituye materiales consumidos o con precio. Podés lanzar como ritual un conjuro de bardo conocido con descriptor ritual, agregando 10 minutos y sin gastar espacio. Los espacios se recuperan tras descanso largo. Al ganar un nivel podés sustituir un conjuro de nivel 1 o superior por otro de la lista de Bardo permitido; los trucos ordinarios no se sustituyen."),
  f(1,"inspiration","Inspiración de Bardo","Acción adicional: una criatura distinta de vos a 60 pies que pueda oírte gana un dado por 10 minutos. Puede sumarlo a una prueba de característica, ataque o salvación tras ver el d20, antes de conocer el resultado. Solo un dado de inspiración por criatura. Usos = modificador de Carisma, mínimo uno; d6, d8 desde 5, d10 desde 10 y d12 desde 15. Todos los usos del colegio que gastan inspiración comparten esta reserva."),
  f(2,"jack","Polivalente","Sumá la mitad de competencia redondeada hacia abajo a pruebas de característica que no incluyan ya competencia. Incluye iniciativa y pruebas sin habilidad, como Contraconjuro y Disipar Magia; no suma a ataques o salvaciones ni se acumula con media competencia."),
  f(2,"song-rest","Canción de Descanso","Durante un descanso corto, vos y aliados que escuchen tu interpretación recuperan PG extra si gastan al menos un Dado de Golpe: d6, d8 desde 9, d10 desde 13, d12 desde 17. Una vez por descanso por criatura, no por dado gastado."),
  f(3,"expertise","Experto","En niveles 3 y 10 elegís dos habilidades competentes para duplicar competencia. No permite herramientas ni volver a duplicar una pericia existente."),
  f(5,"font","Fuente de Inspiración","Recuperás todos los usos de Inspiración de Bardo tras descanso corto o largo."),
  f(6,"countercharm","Contraoda","Acción: interpretación hasta el final de tu siguiente turno. Vos y aliados a 30 pies que puedan oírte tienen ventaja en salvaciones contra asustado o hechizado. Termina si estás incapacitado, silenciado o la terminás voluntariamente sin acción. Los objetivos y la duración se resuelven en mesa."),
  f(10,"secrets","Secretos Mágicos","En niveles 10, 14 y 18 elegís dos conjuros de cualquier clase, incluso trucos, hasta el nivel de tus espacios. Son conjuros de Bardo y cuentan dentro del total de conocidos de la tabla; un truco elegido así ocupa una plaza de Secretos, sin reducir los trucos ordinarios. Una sustitución posterior requiere la lista de Bardo."),
  f(20,"superior","Inspiración Superior","Cuando tirás iniciativa sin usos de Inspiración de Bardo, recuperás exactamente un uso. El control del panel permite confirmar este desencadenante."),
];
export const BARD_FEATURES: Record<BardCollege,Feature[]> = {
  lore: [
    f(3,"bonus-skills","Competencias Adicionales","Tres habilidades adicionales de tu elección, sin repetir competencias existentes."),
    f(3,"cutting-words","Palabras Hirientes","Reacción: gastá inspiración y restá su dado a un ataque, prueba de característica o daño de una criatura visible a 60 pies que te oiga y no sea inmune al encantamiento. Tras la tirada, antes de determinar éxito o calcular daño. No afecta salvaciones."),
    f(6,"additional-secrets","Secretos Mágicos Adicionales","Dos conjuros de cualquier clase, incluidos trucos, hasta el nivel de tus espacios. Son conjuros de Bardo adicionales al total de conocidos; no consumen las elecciones ordinarias de este nivel."),
    f(14,"peerless","Habilidad Incomparable","Al hacer una prueba de característica propia, gastá inspiración y sumá su dado tras ver la tirada, antes de saber si tiene éxito. No se aplica a ataques o salvaciones."),
  ],
  valor: [
    f(3,"valor-training","Competencias Adicionales","Competencia con armaduras medias, escudos y todas las armas marciales."),
    f(3,"combat-inspiration","Inspiración de Combate","Quien recibe tu inspiración puede sumarla al daño de un arma, o usar su reacción tras ver un ataque dirigido contra él y antes de saber si impacta para sumar el dado a su CA contra ese ataque."),
    f(6,"extra-attack","Ataque Extra","Dos ataques en lugar de uno al realizar la acción Atacar en tu turno. No concede otra acción."),
    f(14,"battle-magic","Magia de Batalla","Cuando usás tu acción para lanzar un conjuro de Bardo, podés realizar un ataque con arma como acción adicional. No sustituye la acción Atacar ni concede dos ataques adicionales."),
  ],
  glamour: [
    f(3,"mantle-inspiration","Manto de Inspiración","Acción adicional: gastá inspiración; hasta CAR (mínimo uno) criaturas visibles a 60 pies que puedan verte reciben PG temporales: 5, 8 desde nivel 5, 11 desde 10 y 14 desde 15. Podés incluirte. Cada una puede usar inmediatamente su reacción para moverse hasta su velocidad sin ataques de oportunidad. No se tira el dado de inspiración; los PG temporales no se acumulan."),
    f(3,"enthralling","Actuación Envolvente","Tras actuar un minuto, hasta CAR (mínimo uno) humanoides a 60 pies que hayan visto y oído toda la actuación hacen salvación SAB contra tu CD. Fallo: te idolatran durante una hora, te elogian y obstaculizan a tus oponentes evitando violencia salvo que ya lucharían por vos. Termina si reciben daño, los atacás o presencian que atacás/dañás sus aliados. Con éxito no advierten el intento.",1,"short-rest"),
    f(6,"mantle-majesty","Manto de Majestad","Acción adicional: Orden Imperiosa sin espacio y apariencia sobrenatural durante un minuto, con concentración como un conjuro. Mientras dure, podés repetir Orden Imperiosa como acción adicional en cada turno sin espacio; criaturas ya hechizadas por vos fallan automáticamente la salvación. Una vez por descanso largo. Administrá duración, concentración y objetivos en mesa; no concede el conjuro permanentemente.",1,"long-rest"),
    f(14,"unbreakable","Majestad Inquebrantable","Acción adicional: presencia durante un minuto o hasta incapacitarte. La primera vez que cada criatura intente atacarte en un turno, salva CAR contra tu CD; fallo debe elegir otro objetivo o pierde el ataque. Éxito puede atacarte, pero tiene desventaja en salvaciones contra tus conjuros durante tu siguiente turno.",1,"short-rest"),
  ],
  swords: [
    f(3,"swords-training","Competencias Adicionales","Competencia con armaduras medias y cimitarra. Un arma cuerpo a cuerpo sencilla o marcial con la que seas competente puede ser foco para tus conjuros de Bardo."),
    f(3,"style","Estilo de Combate","Duelo: +2 daño con arma cuerpo a cuerpo usada a una mano y sin otra arma. Lucha con dos armas: sumá característica al daño del segundo ataque de combate con dos armas; ese ataque usa tu acción adicional."),
    f(3,"flourish","Ademán de Cuchilla","Al usar Atacar en tu turno, +10 pies de velocidad a pie hasta fin de turno. Una vez por turno, al impactar un ataque con arma de esa acción, gastá inspiración: sumá el dado al daño y elegí Defensivo (misma cifra a CA hasta inicio de tu siguiente turno), Cortante (mismo daño a otra criatura visible a 5 pies de vos) o Móvil (empujá hasta 5 + dado pies, y podés usar reacción para moverte hasta tu velocidad a un lugar libre a 5 pies del objetivo). Bonos temporales y movimiento se resuelven en mesa."),
    f(6,"extra-attack","Ataque Extra","Dos ataques al usar Atacar en tu turno."),
    f(14,"master-flourish","Ademán del Maestro","Cada vez que uses Ademán de Cuchilla, podés usar d6 sin gastar inspiración, o gastar inspiración para usar su dado normal. Conserva el límite de un ademán por turno."),
  ],
  whispers: [
    f(3,"psychic-blades","Cuchillas Psíquicas","Una vez por ronda en tu turno, al impactar con arma, gastá inspiración para daño psíquico adicional: 2d6, 3d6 desde nivel 5, 5d6 desde 10, 8d6 desde 15. No tirás además el dado de inspiración."),
    f(3,"terror","Palabras del Terror","Tras un minuto hablando a solas con un humanoide, salva SAB contra tu CD o queda asustado de vos u otra criatura elegida durante una hora. Termina si lo atacan/dañan o ve atacar/dañar a sus aliados. Con éxito no advierte el intento.",1,"short-rest"),
    f(6,"mantle-whispers","Manto de Susurros","Reacción al morir un humanoide a 30 pies: capturá su sombra hasta usarla o terminar descanso largo. Acción para consumirla y adoptar su apariencia viva durante una hora; termina antes como acción adicional. Accedés a información que compartiría con conocidos, sin secretos. Detectar el disfraz: Perspicacia contra tu Engaño con +5. Una captura por descanso corto o largo; administrá sombra y duración en mesa.",1,"short-rest"),
    f(14,"shadow-lore","Palabra Sombría","Acción: criatura a 30 pies salva SAB contra tu CD; éxito automático si no te oye o no comparten idioma. Fallo: hechizada ocho horas, cree que conocés su secreto y obedece como a un amigo cercano sin arriesgar la vida o luchar salvo que ya lo haría. No descubrís el secreto. Termina si vos o tus aliados la atacan, dañan o fuerzan una salvación; después no comprende por qué te temía.",1,"long-rest"),
  ],
};
