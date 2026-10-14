import { defaultFighterCreation } from "./fighter-builder-catalog";
import type { CharacterBuilderState } from "./character-builder-model";
import type { SkillKey } from "./character-checks";
import type { BarbarianPath,TotemAnimal,StormEnvironment } from "./barbarian-model";
import type { TraitDefinition } from "./builder-traits";
export const BARBARIAN_SKILLS: SkillKey[] = ["animalHandling","athletics","intimidation","nature","perception","survival"];
export const BARBARIAN_ASI_LEVELS = [4,8,12,16,19];
export const BARBARIAN_PATHS: Record<BarbarianPath,string> = { berserker: "Berserker","totem-warrior": "Guerrero Totémico","ancestral-guardian": "Guardián Ancestral","storm-herald": "Heraldo de la Tormenta",zealot: "Fanático" };
export const TOTEM_ANIMALS: Record<TotemAnimal,string> = { bear: "Oso",eagle: "Águila",wolf: "Lobo" };
export const STORM_ENVIRONMENTS: Record<StormEnvironment,string> = { desert: "Desierto",sea: "Mar",tundra: "Tundra" };
export const barbarianPath = (s: CharacterBuilderState): BarbarianPath | null => s.classKey === "barbarian" ? s.levels.find((p) => p.barbarian.path)?.barbarian.path ?? null : null;
export const barbarianTotem = (s: CharacterBuilderState,level: 3|6|14): TotemAnimal | null => s.classKey === "barbarian" ? s.levels.find((p) => p.level === level)?.barbarian.totem ?? null : null;
export const barbarianStorm = (s: CharacterBuilderState): StormEnvironment | null => s.classKey === "barbarian" ? [...s.levels].reverse().find((p) => p.barbarian.storm)?.barbarian.storm ?? null : null;
export const barbarianDivineDamage = (s: CharacterBuilderState) => s.classKey === "barbarian" ? s.levels.find((p) => p.level === 3)?.barbarian.divineDamage ?? null : null;
/** Zero is an unlimited resource at level 20, never a synthetic finite counter. */
export const barbarianRages = (level: number) => level >= 20 ? 0 : level >= 17 ? 6 : level >= 12 ? 5 : level >= 6 ? 4 : level >= 3 ? 3 : 2;
export const barbarianRageDamage = (level: number) => level >= 16 ? 4 : level >= 9 ? 3 : 2;
export const barbarianBrutalDice = (level: number) => level >= 17 ? 3 : level >= 13 ? 2 : level >= 9 ? 1 : 0;
export const barbarianShieldDice = (level: number) => level >= 14 ? 4 : level >= 10 ? 3 : 2;
export const stormAuraAmount = (level: number) => level >= 20 ? 6 : level >= 15 ? 5 : level >= 10 ? 4 : level >= 5 ? 3 : 2;
export const stormSeaDice = (level: number) => level >= 20 ? 4 : level >= 15 ? 3 : level >= 10 ? 2 : 1;
export function defaultBarbarianCreation(name = "") {
  const c = defaultFighterCreation(name);c.classKey = "barbarian";
  c.baseAbilities = { strength: 15,dexterity: 13,constitution: 14,intelligence: 8,wisdom: 12,charisma: 10 };
  c.skills = ["athletics","perception"];c.equipment.goldRoll = [2,2];return c;
}
export interface BarbarianFeature extends TraitDefinition { level: number }
const f = (level: number,key: string,name: string,description: string,maximum?: number,reset?: TraitDefinition["reset"]): BarbarianFeature => ({ level,key,name,description,...(maximum === undefined ? {} : { maximum,reset: reset ?? "none" }) });
export const BARBARIAN_CORE: BarbarianFeature[] = [
  f(1,"rage","Furia","Acción adicional en tu turno; dura hasta un minuto. Sin armadura pesada: ventaja en pruebas y salvaciones de Fuerza, daño adicional en ataques cuerpo a cuerpo que usen Fuerza y resistencia a contundente, perforante y cortante (también mágicos). No podés lanzar ni concentrarte en conjuros durante ninguna furia. Termina si caés inconsciente o si al acabar tu turno no atacaste a un hostil desde tu turno anterior ni recibiste daño desde entonces; podés terminarla en tu turno como acción adicional. Recuperás usos tras descanso largo."),
  f(1,"unarmored-defense","Defensa sin Armadura","Sin armadura, podés usar CA 10 + Destreza + Constitución. Admite escudo. No se suma a otras fórmulas de CA; elegí la fórmula válida más favorable."),
  f(2,"reckless-attack","Ataque Temerario","Al hacer tu primer ataque del turno, podés tener ventaja en tus ataques con armas cuerpo a cuerpo que usen Fuerza durante ese turno. A cambio, todos los ataques contra vos tienen ventaja hasta tu próximo turno. No exige furia; no sirve para armas arrojadas ni ataques con Destreza."),
  f(2,"danger-sense","Sentido del Peligro","Ventaja en salvaciones de Destreza contra efectos que puedas ver. No funciona si estás cegado, ensordecido o incapacitado; no concede ventaja indiscriminada a todas las salvaciones de Destreza."),
  f(5,"extra-attack","Ataque Extra","La acción Atacar permite dos ataques en tu turno. No añade acciones adicionales ni duplica ataques de reacción o acción adicional."),
  f(5,"fast-movement","Movimiento Rápido","Tu velocidad aumenta 10 pies mientras no lleves armadura pesada."),
  f(7,"feral-instinct","Instinto Salvaje","Ventaja en iniciativa. Si empezás el combate sorprendido y no estás incapacitado, podés actuar normalmente en tu primer turno si entrás en furia antes de hacer cualquier otra cosa."),
  f(9,"brutal-critical","Crítico Brutal","Añadí dados de daño del arma a los críticos de ataques cuerpo a cuerpo: un dado desde nivel 9, dos desde 13 y tres desde 17. Son dados individuales: una espada de 2d6 añade 1d6 por cada dado de este rasgo. No requiere furia ni Fuerza y no añade de nuevo modificadores fijos."),
  f(11,"relentless-rage","Furia Implacable","Si estando en furia bajás a 0 PG sin morir instantáneamente, podés salvar Constitución CD 10 para quedar a 1 PG. Cada uso posterior aumenta la CD en 5, incluso tras un fallo. Descanso corto o largo restablece CD 10. Resolvé esta salvación antes de terminar la furia por inconsciencia."),
  f(15,"persistent-rage","Furia Persistente","Tu furia ya no termina antes por falta de ataques o daño. Sigue durando hasta un minuto y termina antes si quedás inconsciente o decidís terminarla."),
  f(18,"indomitable-might","Fuerza Indómita","Si el resultado TOTAL de una prueba de Fuerza es inferior a tu puntuación de Fuerza, podés usar esa puntuación como resultado. No es un mínimo al d20 y no afecta ataques ni salvaciones."),
  f(20,"primal-champion","Campeón Primario","Fuerza y Constitución aumentan en 4 y sus máximos pasan a 24. Constitución aumenta retroactivamente los PG de todos tus niveles. Tenés furias ilimitadas, manteniendo su duración y demás restricciones."),
];
export const TOTEM_FEATURES: Record<3|6|14,Record<TotemAnimal,string>> = {
  3: { bear: "Durante la furia, resistencia a todo daño salvo psíquico. Este beneficio no especifica una restricción por armadura pesada.",eagle: "Durante la furia, sin armadura pesada: los ataques de oportunidad contra vos tienen desventaja y podés hacer Carrera como acción adicional.",wolf: "Durante la furia, tus aliados tienen ventaja en ataques cuerpo a cuerpo contra criaturas hostiles a vos que estén a 5 pies de vos." },
  6: { bear: "Duplicás capacidad de carga, levantar, empujar y arrastrar. Ventaja en pruebas de Fuerza para empujar, tirar, levantar o romper objetos. No requiere furia.",eagle: "Ves hasta una milla sin dificultad y distinguís detalles de objetos a 100 pies como de cerca. La luz tenue no penaliza tu Percepción. No concede visión en oscuridad.",wolf: "Podés rastrear viajando rápido y moverte sigilosamente viajando a ritmo normal." },
  14: { bear: "Durante la furia, hostiles a 5 pies tienen desventaja al atacar a otros que no sean vos u otra criatura con este rasgo. Inmunes si no pueden verte/oírte o son inmunes a asustado.",eagle: "Durante la furia, velocidad de vuelo igual a tu velocidad a pie actual. Si terminás el turno en el aire, caés salvo que otro efecto te sostenga.",wolf: "Durante la furia, tras impactar a una criatura Grande o menor con un ataque cuerpo a cuerpo, podés usar una acción adicional para derribarla, sin salvación." },
};
export const BARBARIAN_FEATURES: Record<BarbarianPath,BarbarianFeature[]> = {
  berserker: [
    f(3,"frenzy","Frenesí","Al entrar en furia podés entrar en frenesí. A partir de tus turnos posteriores a ese, podés hacer un ataque cuerpo a cuerpo como acción adicional. Cuando termine esa furia, ganás un nivel de agotamiento, sea cual sea la causa del fin."),
    f(6,"mindless-rage","Furia Inconsciente","Durante la furia sos inmune a hechizado y asustado. Los efectos que ya tenías quedan suspendidos hasta que termine; no se disipan permanentemente."),
    f(10,"intimidating-presence","Presencia Intimidante","Acción: criatura visible a 30 pies que te vea u oiga salva SAB contra CD 8 + competencia + CAR o queda asustada hasta el final de tu siguiente turno. Podés mantenerlo gastando tu acción en turnos posteriores. Termina si acaba su turno fuera de tu vista o a más de 60 pies. Si supera la salvación, no podés volver a usarlo contra ella durante 24 horas."),
    f(14,"retaliation","Represalia","Cuando recibís daño de una criatura a 5 pies, podés gastar tu reacción para atacarla cuerpo a cuerpo. No exige que su daño provenga de un ataque ni estar en furia."),
  ],
  "totem-warrior": [
    f(3,"spirit-seeker","Buscador Espiritual","Podés lanzar Sentido animal y Hablar con los animales solo como rituales. Adquirí o fabricá un tótem físico con restos de tu animal; la representación puede ser un animal emparentado apropiado para tu tierra. Estos rituales no requieren libro ni espacios, pero conservan sus componentes y no pueden lanzarse durante la furia."),
    f(10,"spirit-walker","Caminante Espiritual","Podés lanzar Comunión con la naturaleza solo como ritual. El espíritu de uno de tus tótems te transmite la información. No consume un espacio de nivel 5."),
  ],
  "ancestral-guardian": [
    f(3,"ancestral-protectors","Protectores Ancestrales","Durante la furia, la primera criatura que impactes con un ataque en tu turno tiene desventaja al atacar a otros hasta tu próximo turno. Si impacta a otra criatura con un ataque, esa criatura resiste el daño de ese ataque. El efecto termina si termina tu furia. No requiere ataque cuerpo a cuerpo."),
    f(6,"spirit-shield","Escudo Espiritual","Durante la furia, reacción cuando OTRA criatura visible a 30 pies recibe daño: reducilo 2d6, o 3d6 desde nivel 10 y 4d6 desde 14. El dado es d6, según la errata; no podés protegerte a vos mismo con este rasgo."),
    f(10,"consult-spirits","Consultar a los Espíritus","Podés lanzar Augurio o Clarividencia sin espacio ni componentes materiales. Sabiduría es tu característica. Un uso compartido por ambos conjuros por descanso corto o largo; conservan tiempo de lanzamiento, componentes verbales/somáticos y concentración cuando corresponda. No pueden lanzarse durante la furia.",1,"short-rest"),
    f(14,"vengeful-ancestors","Ancestros Vengativos","Al usar Escudo Espiritual para prevenir daño de un ataque, el atacante recibe daño de fuerza igual al daño realmente prevenido, no necesariamente al total de los dados. No se aplica a daño que no provenga de un ataque."),
  ],
  "storm-herald": [
    f(3,"storm-aura","Aura de Tormenta","Durante la furia, aura de 10 pies que no atraviesa cobertura total. Se activa al entrar en furia y podés volver a activarla como acción adicional en tus turnos. El entorno determina su efecto y puede cambiarse cada vez que ganes un nivel de bárbaro. CD = 8 + competencia + CON."),
    f(6,"storm-soul","Alma de Tormenta","Beneficios permanentes según el entorno actual, incluso fuera de la furia. Mar concede resistencia al relámpago, respirar bajo el agua y natación 30 pies; Desierto/Tundra conceden su resistencia, protección ambiental y capacidad de manipular fuego/hielo."),
    f(10,"shielding-storm","Tormenta Protectora","Durante la furia, las criaturas que elijas dentro del aura tienen la resistencia al daño de tu Alma de Tormenta. No transmite los otros beneficios de esa alma."),
    f(14,"raging-storm","Tormenta Furiosa","El entorno actual mejora tu aura; usá la descripción de Desierto, Mar o Tundra. Las opciones de Desierto y Mar consumen reacción; Tundra se activa junto con el efecto del aura."),
  ],
  zealot: [
    f(3,"divine-fury","Furia Divina","Durante la furia, la primera criatura a la que impactes con un ataque con arma en CADA UNO DE TUS turnos recibe 1d6 + la mitad de tu nivel de bárbaro (redondeada hacia abajo) de daño adicional. Elegís radiante o necrótico al adquirir el rasgo. No exige Fuerza ni ataque cuerpo a cuerpo; no se aplica otra vez en reacciones fuera de tu turno."),
    f(3,"warrior-gods","Guerrero de los Dioses","Si un conjuro tiene como único efecto devolverte a la vida (no convertirte en muerto viviente), su lanzador no necesita componentes materiales para lanzártelo. No te resucita automáticamente ni elimina otros costes o requisitos."),
    f(6,"fanatical-focus","Enfoque Fanático","Durante la furia, podés repetir una salvación fallida y debés usar el nuevo resultado. Una vez por furia, sin compartir límite entre furias distintas."),
    f(10,"zealous-presence","Presencia Fanática","Acción adicional: hasta diez criaturas elegidas a 60 pies que te oigan tienen ventaja en ataques y salvaciones hasta el inicio de tu siguiente turno. No exige furia. Un uso por descanso largo.",1,"long-rest"),
    f(14,"rage-beyond-death","Furia más Allá de la Muerte","Mientras estás en furia, tener 0 PG no te deja inconsciente. Seguís haciendo salvaciones de muerte y sufrís las consecuencias de recibir daño a 0 PG. La muerte por tres fallos se retrasa hasta que termine la furia, y solo ocurre si seguís a 0 PG. No impide la muerte instantánea u otras formas de morir; recibir curación antes de terminar puede salvarte."),
  ],
};
export const STORM_FEATURES: Record<StormEnvironment,Record<3|6|14,string>> = {
  desert: { 3: "Al activar el aura, TODAS las demás criaturas dentro reciben daño de fuego, sin salvación: 2; 3 desde nivel 5; 4 desde 10; 5 desde 15; 6 en 20. Puede dañar aliados.",6: "Resistencia a fuego e inmunidad a efectos de calor extremo. Acción para prender fuego tocando un objeto inflamable que nadie lleve ni vista.",14: "Reacción inmediatamente después de que una criatura de tu aura te impacte con un ataque: salvación de Destreza; si falla, recibe fuego igual a la mitad de tu nivel de bárbaro, redondeada hacia abajo. Si supera, no recibe daño." },
  sea: { 3: "Al activar el aura, otra criatura visible dentro salva Destreza: 1d6 relámpago, mitad si supera. Sube a 2d6 en 10, 3d6 en 15 y 4d6 en 20.",6: "Resistencia al relámpago, respirar bajo el agua y velocidad de natación de 30 pies, incluso sin furia.",14: "Cuando impactás con un ataque a una criatura dentro del aura, reacción para obligarla a salvar Fuerza; si falla, queda derribada." },
  tundra: { 3: "Al activar el aura, cada criatura que elijas dentro (podés incluirte) recibe PG temporales: 2; 3 desde nivel 5; 4 desde 10; 5 desde 15; 6 en 20. Los PG temporales no se suman entre sí.",6: "Resistencia a frío e inmunidad a efectos de frío extremo. Acción al tocar agua: congelá un cubo de 5 pies sin criaturas dentro; se derrite tras un minuto.",14: "Al activar el efecto del Aura de Tormenta, elegí una criatura visible dentro: salvación de Fuerza; si falla, velocidad 0 hasta el inicio de tu siguiente turno. No consume reacción." },
};
