import type { CharacterBuilderState } from "./character-builder-model";
import type { Metamagic,SorcererOrigin } from "./sorcerer-model";
import type { SkillKey } from "./character-checks";
import type { TraitDefinition } from "./builder-traits";
import { defaultFighterCreation } from "./fighter-builder-catalog";
import { classSpells } from "./phb-spells";
export const SORCERER_ORIGINS: Record<SorcererOrigin,string> = { draconic: "Linaje Dracónico","wild-magic": "Magia Salvaje","divine-soul": "Alma Divina",shadow: "Magia de las Sombras",storm: "Hechicería de Tormenta" };
export const SORCERER_SKILLS: SkillKey[] = ["arcana","deception","insight","intimidation","persuasion","religion"];
export const SORCERER_KNOWN = [0,2,3,4,5,6,7,8,9,10,11,12,12,13,13,14,14,15,15,15,15];
export const sorcererCantrips = (n: number) => n >= 10 ? 6 : n >= 4 ? 5 : 4;
export const sorcererOrigin = (s: CharacterBuilderState): SorcererOrigin|null => s.classKey === "sorcerer" ? s.creation.sorcerer.origin : null;
export const SORCERER_AFFINITIES = { good: "Bien",evil: "Mal",law: "Ley",chaos: "Caos",neutrality: "Neutralidad" };
export const DIVINE_SPELLS = { good: "cure-wounds",evil: "inflict-wounds",law: "bless",chaos: "bane",neutrality: "protection-from-evil-and-good" };
export const SLOT_POINT_COST: Record<number,number> = { 1: 2,2: 3,3: 5,4: 6,5: 7 };
export function sorcererSpellList(s: CharacterBuilderState,min: number,max = min) { return [...new Set([...classSpells("sorcerer",min,max),...(sorcererOrigin(s) === "divine-soul" ? classSpells("cleric",min,max) : [])])]; }
export const METAMAGIC: Record<Metamagic,{ name: string;cost: number;description: string }> = {
  careful: { name: "Conjuro Cuidadoso",cost: 1,description: "Al lanzar un conjuro que obliga a salvar, elegís hasta CAR criaturas (mínimo una): superan automáticamente su salvación. No elimina el daño que corresponda con éxito." },
  distant: { name: "Conjuro Distante",cost: 1,description: "Duplica alcance de 5 pies o más; toque pasa a 30 pies. No aumenta un alcance Personal ni agranda áreas." },
  empowered: { name: "Conjuro Potenciado",cost: 1,description: "Al tirar daño, repetí hasta CAR dados (mínimo uno) y usá los nuevos resultados. Puede combinarse con otra metamagia del mismo lanzamiento; no se repite el mismo dado varias veces con este uso." },
  extended: { name: "Ampliar Conjuro",cost: 1,description: "Duración de un minuto o más: duplicala hasta máximo 24 horas. No elimina concentración." },
  heightened: { name: "Conjuro Aumentado",cost: 3,description: "Un objetivo tiene desventaja únicamente en su primera salvación contra el conjuro." },
  quickened: { name: "Conjuro Acelerado",cost: 2,description: "Tiempo de una acción pasa a acción adicional. Si lanzás un conjuro como acción adicional, el único otro conjuro que podés lanzar ese turno es un truco de una acción, según las reglas 2014." },
  subtle: { name: "Conjuro Sutil",cost: 1,description: "Lanzás sin componentes verbales ni somáticos. Los componentes materiales, incluidos los de precio/consumo, siguen siendo necesarios." },
  twinned: { name: "Conjuro Duplicado",cost: 0,description: "Coste igual al nivel usado (mínimo un punto para trucos). Solo una criatura como objetivo, alcance distinto de Personal e incapaz de apuntar a más de una criatura en ese nivel. Proyectil Mágico y Rayo Abrasador no son válidos. Una segunda criatura debe estar dentro del alcance." },
};
export function defaultSorcererCreation(name = "") { const c = defaultFighterCreation(name);c.classKey = "sorcerer";c.baseAbilities = { strength: 8,dexterity: 14,constitution: 13,intelligence: 12,wisdom: 10,charisma: 15 };c.skills = ["arcana","deception"];c.equipment.goldRoll = [2,2,2];c.sorcerer.origin = "draconic";c.sorcerer.ancestry = "red";c.sorcerer.cantrips = ["fire-bolt","light","prestidigitation","shocking-grasp"];c.sorcerer.learn = ["shield","magic-missile"];return c; }
type Feature = TraitDefinition & { level: number };
const f = (level: number,key: string,name: string,description: string,maximum?: number,reset: TraitDefinition["reset"] = "long-rest"): Feature => ({ level,key,name,description,...(maximum === undefined ? {} : { maximum,reset }) });
export const SORCERER_CORE: Feature[] = [
  f(1,"spellcasting","Lanzamiento de Conjuros","Carisma; cuatro trucos y dos conocidos de nivel 1 al empezar. Conocidos según tabla y una sustitución de conocido anterior por nivel. Sin preparación diaria ni rituales de clase. Foco arcano o bolsa de componentes; los materiales costosos/consumidos no se sustituyen."),
  f(2,"sorcery-points","Fuente de Magia","Puntos máximos iguales al nivel de Hechicero desde nivel 2; recuperás todos en descanso largo. Como acción adicional, sacrificá un espacio para ganar tantos puntos como su nivel, sin superar tu máximo, o creá un espacio: niveles 1/2/3/4/5 cuestan 2/3/5/6/7 puntos. Podés crear espacios por encima del máximo habitual, hasta nivel 5; desaparecen al terminar descanso largo."),
  f(3,"metamagic","Metamagia","Elegís dos opciones en nivel 3 y otra en 10 y 17. No se sustituyen por reglas 2014. Una opción por lanzamiento, salvo Conjuro Potenciado que puede combinarse con otra. Los efectos de objetivos, acciones, duración y nuevas tiradas se resuelven en mesa."),
  f(20,"restoration","Restablecimiento de Hechicero","Recuperás cuatro puntos de hechicería al terminar descanso corto, sin superar tu máximo."),
];
export const SORCERER_FEATURES: Record<SorcererOrigin,Feature[]> = {
  draconic: [
    f(1,"ancestry","Ancestro Dragón","Elegís uno de diez dragones y hablás Dracónico. En pruebas CAR al interactuar con dragones duplicás competencia si se aplica, sin acumular con pericia."),
    f(1,"resilience","Resistencia Dracónica","PG máximos +1 por nivel de Hechicero. Sin armadura, podés usar CA 13 + DES. El escudo no es armadura, pero necesitás competencia para lanzar mientras lo llevás."),
    f(6,"elemental-affinity","Afinidad Elemental","Al lanzar un conjuro del tipo de tu ancestro, sumá CAR a una sola tirada de daño del conjuro. En ese momento podés gastar un punto para ganar resistencia a ese tipo durante una hora."),
    f(14,"dragon-wings","Alas de Dragón","Acción adicional para manifestar o descartar alas. Vuelo igual a tu velocidad actual. La armadura debe estar adaptada y la ropa no adaptada se destruye. No tienen duración máxima ni terminan automáticamente al quedar incapacitado."),
    f(18,"draconic-presence","Presencia Draconiana","Acción y cinco puntos: aura de 60 pies de sobrecogimiento o miedo, un minuto con concentración. Hostiles que comiencen turno en el aura salvan SAB o quedan encantados/asustados hasta que termine. Éxito: inmunidad a tu aura por 24 horas."),
  ],
  "wild-magic": [
    f(1,"surge","Oleada de Magia Salvaje","Una vez por turno, inmediatamente después de un conjuro de Hechicero N1+, el GM puede pedir d20: con uno se tira en la tabla d100. Un conjuro producido por la oleada no admite Metamagia ni exige concentración; dura su duración completa. El GM decide cuándo ocurre; no se activa en todos los lanzamientos automáticamente."),
    f(1,"tides","Mareas de Caos","Ventaja en una tirada de ataque, prueba o salvación, una vez por descanso largo. Antes de recuperar el uso, el GM puede hacerte tirar directamente en la tabla de oleadas después de un conjuro de Hechicero N1+; entonces recuperás Mareas.",1),
    f(6,"bend-luck","Curvar la Suerte","Reacción y dos puntos cuando otra criatura visible haga ataque, prueba o salvación: tirá d4 y sumalo o restalo después de la tirada, antes de conocer sus efectos."),
    f(14,"controlled-chaos","Caos Controlado","Al tirar en la tabla de oleadas, tirá dos veces y elegí cualquiera de los resultados."),
    f(18,"spell-bombardment","Bombardeo de Conjuros","Una vez por turno, al tirar daño de un conjuro y obtener el máximo en algún dado, elegí uno de esos dados, tiralo otra vez y sumá el nuevo resultado. No exige puntos ni multiplica todos los dados."),
  ],
  "divine-soul": [
    f(1,"divine-magic","Magia Divina","Trucos y conocidos pueden elegirse de Hechicero o Clérigo y usan CAR como conjuros de Hechicero. Un conjuro de afinidad adicional no ocupa cupo. Si lo sustituís, el sustituto debe ser de Clérigo, conservando ese origen adicional. No concede preparación ni rituales de Clérigo."),
    f(1,"favored","Favorecido por los Dioses","Después de fallar un ataque o salvación, sumá 2d4 y posiblemente cambies el resultado. Una vez por descanso corto/largo.",1,"short-rest"),
    f(6,"empowered-healing","Curación Empoderada","Una vez por turno, cuando vos o un aliado a cinco pies tire dados de curación de un conjuro, gastá un punto para repetir cualquier cantidad de esos dados una vez; necesitás no estar incapacitado. No es una opción de Metamagia."),
    f(14,"otherworldly-wings","Alas de Otro Mundo","Acción adicional para manifestar alas espectrales: vuelo 30 pies. Duran hasta incapacitación, muerte o descartarlas con acción adicional. Apariencia por afinidad: águila para Bien/Ley, murciélago para Mal/Caos, libélula para Neutralidad."),
    f(18,"recovery","Recuperación Sobrenatural","Acción adicional si tus PG actuales son inferiores a la mitad del máximo: recuperás la mitad de tus PG máximos, redondeada abajo. Una vez por descanso largo.",1),
  ],
  shadow: [
    f(1,"eyes-dark","Ojos de la Oscuridad","Visión en oscuridad a 120 pies. Desde nivel 3 conocés Oscuridad fuera del cupo; podés usar espacio o dos puntos. Solo si la lanzás con puntos podés ver a través de esa oscuridad específica; conserva concentración."),
    f(1,"strength-grave","Fuerza de la Tumba","Al quedar a cero por daño, salvación CAR CD 5 + daño recibido: con éxito quedás a un PG y gastás el uso por descanso largo. No funciona con daño radiante, golpe crítico ni muerte instantánea. Un fallo no consume el uso.",1),
    f(6,"hound","Sabueso de Mal Augurio","Acción adicional y tres puntos: objetivo visible a 120 pies; aparece a 30 pies de él. Usa lobo terrible, pero Mediano y monstruosidad, con PG temporales = mitad de nivel de Hechicero (no Brujo). Atraviesa criaturas/objetos como terreno difícil, sufre cinco de fuerza al acabar dentro de objeto y sabe ubicación del objetivo al comenzar turno. Iniciativa propia; solo se mueve por ruta directa y ataca a su objetivo; solo le hace ataques de oportunidad. A cinco pies, ese objetivo salva con desventaja contra tus conjuros. Desaparece tras cinco minutos, a cero del sabueso o a cero del objetivo. Se juega con su bloque; no genera mini ni turnos automáticos."),
    f(14,"shadow-walk","Paso de Sombras","Acción adicional estando en luz tenue/oscuridad: teletransporte hasta 120 pies a espacio libre visible que también esté en luz tenue/oscuridad. Sin puntos ni usos limitados."),
    f(18,"umbral-form","Forma Umbral","Acción adicional y seis puntos: un minuto; resistencia a todo daño excepto fuerza y radiante; atravesás criaturas/objetos como terreno difícil y sufrís cinco de fuerza si acabás turno dentro de un objeto. Termina por incapacitación, muerte o acción adicional para descartarla."),
  ],
  storm: [
    f(1,"wind-speaker","Orador de Viento","Hablás, leés y escribís Primordial; entendés y te entienden sus dialectos Aquano, Aurano, Ígneo y Terrano."),
    f(1,"tempestuous-magic","Magia Tempestuosa","Acción adicional en tu turno inmediatamente antes o después de lanzar un conjuro N1+: volá hasta diez pies sin provocar ataques de oportunidad. No es vuelo permanente ni un movimiento gratuito sin acción adicional."),
    f(6,"heart-storm","Corazón de la Tormenta","Resistencia a relámpago y trueno. Al comenzar un conjuro N1+ que inflija alguno de esos daños, criaturas elegidas visibles a diez pies reciben relámpago o trueno = mitad de tu nivel, redondeada abajo. No se aplica a cualquier conjuro ni a todos los objetivos automáticamente."),
    f(6,"storm-guide","Guía de Tormenta","Acción: detener lluvia en esfera de veinte pies centrada en vos, hasta terminar con acción adicional. Si hay viento, acción adicional para elegir su dirección en esfera de cien pies hasta el final de tu siguiente turno; no cambia su velocidad."),
    f(14,"storm-fury","Furia de la Tormenta","Reacción al recibir un impacto de ataque cuerpo a cuerpo: relámpago al atacante = tu nivel. Salva FUE contra tu CD; si falla, se lo empuja hasta veinte pies alejándose de vos."),
    f(18,"wind-share","Alma de Viento","Inmunidad a relámpago y trueno, vuelo mágico 60 pies. Acción una vez por descanso corto/largo: reducís tu vuelo a 30 pies durante una hora y hasta 3 + CAR criaturas elegidas a treinta pies ganan vuelo 30 pies una hora.",1,"short-rest"),
  ],
};
