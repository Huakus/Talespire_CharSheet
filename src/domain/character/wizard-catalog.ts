import type { CharacterBuilderState, WizardSchool } from "./character-builder-model";
import type { TraitDefinition } from "./builder-traits";
import { defaultFighterCreation } from "./fighter-builder-catalog";
import type { CharacterV2 } from "./character-v2";
import type { CharacterSpellV2 } from "./character-spell-model";

export const WIZARD_SCHOOLS: Record<WizardSchool, string> = { abjuration: "Abjuración", conjuration: "Conjuración", divination: "Adivinación", enchantment: "Encantamiento", evocation: "Evocación", illusion: "Ilusión", necromancy: "Nigromancia", transmutation: "Transmutación", "war-magic": "Magia de Guerra (Xanathar)" };
export function wizardTraditionName(school: WizardSchool | null) { return school ? school === "war-magic" ? WIZARD_SCHOOLS[school] : `Escuela de ${WIZARD_SCHOOLS[school]}` : ""; }
export const WIZARD_ASI_LEVELS = [4,8,12,16,19];
export const WIZARD_SKILLS = ["arcana", "history", "insight", "investigation", "medicine", "religion"] as const;
export const WIZARD_SLOTS = [
  [], [2], [3], [4,2], [4,3], [4,3,2], [4,3,3], [4,3,3,1], [4,3,3,2], [4,3,3,3,1], [4,3,3,3,2],
  [4,3,3,3,2,1], [4,3,3,3,2,1], [4,3,3,3,2,1,1], [4,3,3,3,2,1,1], [4,3,3,3,2,1,1,1],
  [4,3,3,3,2,1,1,1], [4,3,3,3,2,1,1,1,1], [4,3,3,3,3,1,1,1,1], [4,3,3,3,3,2,1,1,1], [4,3,3,3,3,2,2,1,1],
];
export function wizardCantripCount(level: number): number { return level >= 10 ? 5 : level >= 4 ? 4 : 3; }
export function wizardSchool(state: CharacterBuilderState): WizardSchool | null { return state.classKey === "wizard" ? state.levels.find((s) => s.level === 2)?.subclass as WizardSchool ?? null : null; }
export function wizardSpellSource(character: CharacterV2, spell: CharacterSpellV2): boolean {
  if (spell.casting?.kind === "wizard") return true;
  const state = character.builder;
  if (state?.classKey !== "wizard") return false;
  const feats = [...(state.creation.initialFeat ? [{ level: 1, feat: state.creation.initialFeat }] : []), ...state.levels.flatMap((s) => s.feat ? [{ level: s.level, feat: s.feat }] : [])];
  return feats.some(({ level, feat }) => feat.spellClass === "wizard" && spell.casting?.source === `builder:feat-${level}-${feat.key}`);
}
export function defaultWizardCreation(name = "") {
  const creation = defaultFighterCreation(name);
  return { ...creation, classKey: "wizard" as const, skills: ["arcana", "investigation"] as typeof creation.skills, baseAbilities: { strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10 }, equipment: { ...creation.equipment, goldRoll: [2,2,2,2] } };
}
type Feature = TraitDefinition & { level: number };
const f = (level: number, key: string, name: string, description: string, maximum?: number, reset?: TraitDefinition["reset"]): Feature => ({ level, key, name, description, ...(maximum === undefined ? {} : { maximum }), ...(reset ? { reset } : {}) });
export const WIZARD_SCHOOL_FEATURES: Record<WizardSchool, Feature[]> = {
  "war-magic": [
    f(2,"arcane-deflection","Desviación Arcana","Reacción al recibir impacto: +2 CA contra ese ataque, o al fallar salvación: +4 a esa salvación. Después solo podés lanzar trucos hasta final de tu próximo turno."),
    f(2,"tactical-wit","Astucia Táctica","Podés sumar INT a iniciativa."),
    f(6,"power-surge","Sobrecarga de Poder","Máximo INT (mínimo 1). Tras descanso largo tenés una; tras corto sin cargas ganás una. Contraconjuro o Disipar Magia que terminan un conjuro conceden una. Una vez por turno, al causar daño con conjuro de mago, gastá una para daño de fuerza adicional igual a mitad del nivel de mago a un objetivo."),
    f(10,"durable-magic","Magia Duradera","Mientras te concentrás en un conjuro, +2 CA y a todas las salvaciones."),
    f(14,"deflecting-shroud","Sudario Deflector","Al usar Desviación Arcana, hasta tres criaturas visibles a 60 pies reciben daño de fuerza igual a mitad de tu nivel de mago."),
  ],
  abjuration: [
    f(2,"arcane-ward","Guardián arcano","Al lanzar abjuración de nivel 1+, podés crear una protección con PG = 2 × nivel de mago + INT hasta descanso largo; recibe daño antes que vos y el excedente te alcanza. Si ya existe, esas abjuraciones curan 2 × nivel del conjuro. Solo se crea una vez entre descansos largos; con 0 PG permanece y puede recargarse."),
    f(6,"projected-ward","Guardián proyectado","Reacción: la protección absorbe daño de una criatura visible a 30 pies. El excedente corresponde al objetivo."),
    f(10,"improved-abjuration","Abjuración mejorada","Sumá competencia a las pruebas de atributo exigidas por tus abjuraciones, como Contraconjuro o Disipar magia."),
    f(14,"spell-resistance","Resistencia a conjuros","Ventaja en salvaciones contra conjuros; resistencia a su daño."),
  ],
  conjuration: [
    f(2,"minor-conjuration","Conjuración menor","Acción: creá un objeto inanimado visto, no mágico, en tu mano o suelo visible a 10 pies; máximo 3 pies de lado y 10 libras. Parece mágico y emite luz tenue a 5 pies. Desaparece en una hora, si usás otra vez el rasgo o si recibe o causa daño."),
    f(6,"benign-transposition","Transposición benigna","Acción: teletransporte a un espacio libre visible a 30 pies, o intercambio con una criatura dispuesta Pequeña/Mediana allí. Recupera uso tras descanso largo o conjuración de nivel 1+.",1,"long-rest"),
    f(10,"focused-conjuration","Conjuración concentrada","El daño no rompe tu concentración en conjuros de conjuración. Otras causas de pérdida siguen aplicándose."),
    f(14,"durable-summons","Invocaciones duraderas","Criaturas invocadas o creadas por tus conjuros de conjuración reciben 30 PG temporales."),
  ],
  divination: [
    f(2,"portent","Portento","Tras descanso largo registrá dos d20 (tres desde nivel 14); se descartan los anteriores. Antes de una tirada de ataque, prueba o salvación tuya o de criatura visible, reemplazala por uno de esos valores y gastalo; máximo una sustitución por turno."),
    f(6,"expert-divination","Adivinación experta","Al gastar espacio en adivinación de nivel 2+, recuperá un espacio gastado de nivel inferior al lanzamiento, como máximo 5."),
    f(10,"third-eye","Tercer ojo","Acción: elegí visión en oscuridad 60 pies, visión etérea 60 pies, leer cualquier idioma o ver invisibles a 10 pies en línea visual. Dura hasta quedar incapacitado o descansar.",1,"short-rest"),
    f(14,"greater-portent","Portento superior","Registrás tres d20 en lugar de dos al terminar un descanso largo."),
  ],
  enchantment: [
    f(2,"hypnotic-gaze","Mirada hipnótica","Acción, criatura visible a 5 pies que te vea u oiga: SAB contra tu CD; fallo, hechizada e incapacitada, velocidad 0 hasta tu siguiente turno. Acción cada turno para mantener; termina por daño, distancia o perder percepción. Tras terminar o salvar, no repetís contra ese objetivo hasta descanso largo."),
    f(6,"instinctive-charm","Encanto instintivo","Reacción antes de conocer el impacto, atacante visible a 30 pies con otro objetivo a alcance: SAB contra tu CD. Fallo, ataca a la criatura más cercana salvo vos/él; decide empates. Éxito, no repetís contra él hasta descanso largo. Inmunidad a hechizado impide el efecto."),
    f(10,"split-enchantment","Encantamiento dividido","Encantamiento de nivel 1+ que solo tenga una criatura como objetivo puede afectar a otra."),
    f(14,"alter-memories","Alterar recuerdos","Al hechizar con encantamiento, ocultá a un objetivo esa influencia. Antes de finalizar, una acción y salvación INT permiten borrar hasta 1 + CAR horas (mínimo una), sin superar el tiempo hechizado."),
  ],
  evocation: [
    f(2,"sculpt-spells","Esculpir conjuros","En evocaciones que afecten a otras criaturas visibles, elegí hasta 1 + nivel del conjuro: salvan automáticamente y no sufren daño donde normalmente recibirían mitad."),
    f(6,"potent-cantrip","Truco potente","Si una criatura salva contra un truco dañino, recibe mitad del daño y ninguno de sus otros efectos. No convierte fallos de ataque en daño."),
    f(10,"empowered-evocation","Evocación potenciada","Podés sumar INT a una tirada de daño de cada evocación de mago."),
    f(14,"overchannel","Sobrecanalizar","Podés maximizar daño de un conjuro de mago de niveles 1–5. Primer uso entre descansos largos, sin coste; segundo, 2d12 necrótico por nivel del conjuro; cada repetición añade otro d12 por nivel. Ese daño ignora resistencia e inmunidad."),
  ],
  illusion: [
    f(2,"improved-minor-illusion","Ilusión menor mejorada","Aprendés Ilusión menor fuera del cupo; si ya lo conocés, elegís otro truco de mago. Ilusión menor puede producir imagen y sonido simultáneos."),
    f(6,"malleable-illusions","Ilusiones maleables","Acción: alterá una ilusión visible propia cuya duración sea al menos un minuto, respetando los parámetros del conjuro."),
    f(10,"illusory-self","Yo ilusorio","Reacción cuando una criatura hace una tirada de ataque contra vos: una copia ilusoria hace que falle automáticamente y se disipa.",1,"short-rest"),
    f(14,"illusory-reality","Realidad ilusoria","Una vez por conjuro de ilusión de nivel 1+, acción adicional en tu turno mientras dure: un objeto inanimado no mágico de ella se vuelve real durante un minuto. No puede causar daño ni perjudicar directamente."),
  ],
  necromancy: [
    f(2,"grim-harvest","Cosecha siniestra","Una vez por turno, matar criaturas con un conjuro de nivel 1+ cura 2 × su nivel, o 3 × si es nigromancia. No funciona al matar constructos o muertos vivientes."),
    f(6,"undead-thralls","Esbirros muertos vivientes","Reanimar a los muertos se añade gratis si falta; permite un cadáver/esqueleto extra al crear. Muertos vivientes creados con nigromancia ganan PG máximos iguales a tu nivel de mago y competencia a su daño de armas."),
    f(10,"inured-to-undeath","Habituado a la muerte","Resistencia necrótica; tu máximo de PG no puede reducirse."),
    f(14,"command-undead","Controlar muertos vivientes","Acción, muerto viviente visible a 60 pies: CAR contra tu CD. Éxito, nunca repetís contra él; fallo, obedece hasta usar el rasgo otra vez. INT 8+: ventaja; INT 12+: repite cada hora para liberarse."),
  ],
  transmutation: [
    f(2,"minor-alchemy","Alquimia menor","Convertí madera, piedra no preciosa, hierro, cobre o plata entre sí: 1 pie cúbico por 10 minutos. Revierte tras una hora o al perder concentración."),
    f(6,"transmuter-stone","Piedra del transmutador","Ocho horas para crear una piedra; la anterior deja de funcionar. Portador: oscuridad 60 pies, +10 pies sin carga, competencia en CON o resistencia a ácido/frío/fuego/rayo/trueno. Lanzar transmutación 1+ permite cambiar beneficio si la llevás encima."),
    f(10,"shapechanger","Cambiaformas","Polimorfar se añade gratis si falta. Un uso sin espacio: solo vos, bestia VD ≤1; debe estar preparado, según la aclaración oficial de 2014. Recupera tras descanso corto/largo; lanzamientos normales conservan sus reglas.",1,"short-rest"),
    f(14,"master-transmuter","Maestro transmutador","Consumí la piedra: transformar objeto no mágico (cubo 5 pies, masa/tamaño similares, valor no mayor, 10 minutos); panacea al tocar (todos PG, maldiciones, enfermedades, venenos); Revivir a los muertos sin espacio/libro (diamante de 500 po consumido, hasta diez días muerto y demás requisitos del conjuro); o rejuvenecer apariencia 3d10 años, mínimo 13, sin alargar vida. No recreás piedra hasta descanso largo."),
  ],
};
