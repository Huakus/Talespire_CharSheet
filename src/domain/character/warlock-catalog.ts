import type { CharacterBuilderState } from "./character-builder-model";
import type { WarlockPatron, PactBoon } from "./warlock-model";
import type { TraitDefinition } from "./builder-traits";
import { defaultFighterCreation } from "./fighter-builder-catalog";
import { PHB_SPELLS, classSpells } from "./phb-spells";
export const WARLOCK_PATRONS: Record<WarlockPatron,string> = { archfey: "El Archihada",fiend: "El Infernal","great-old-one": "El Gran Antiguo",celestial: "El Celestial (Xanathar)",hexblade: "El Hexblade (Xanathar)" };
export const PACT_BOONS: Record<PactBoon,string> = { blade: "Pacto del Filo",chain: "Pacto de la Cadena",tome: "Pacto del Tomo" };
export const WARLOCK_SKILLS = ["arcana","deception","history","intimidation","investigation","nature","religion"] as const;
export const WARLOCK_KNOWN = [0,2,3,4,5,6,7,8,9,10,10,11,11,12,12,13,13,14,14,15,15];
export function warlockCantrips(level: number) { return level >= 10 ? 4 : level >= 4 ? 3 : 2; }
export function pactSlots(level: number) { return { level: Math.min(5,Math.ceil(level/2)),maximum: level >= 17 ? 4 : level >= 11 ? 3 : level >= 2 ? 2 : 1 }; }
export function invocationCount(level: number) { return level >= 18 ? 8 : level >= 15 ? 7 : level >= 12 ? 6 : level >= 9 ? 5 : level >= 7 ? 4 : level >= 5 ? 3 : level >= 2 ? 2 : 0; }
export function warlockBoon(state: CharacterBuilderState): PactBoon | null { return state.classKey === "warlock" ? state.levels.find((s) => s.level === 3)?.warlock.boon ?? null : null; }
export const PATRON_SPELLS: Record<WarlockPatron,string[]> = {
  celestial: ["cure-wounds","guiding-bolt","flaming-sphere","lesser-restoration","daylight","revivify","guardian-of-faith","wall-of-fire","greater-restoration","flame-strike"],
  hexblade: ["shield","wrathful-smite","blur","branding-smite","blink","elemental-weapon","phantasmal-killer","staggering-smite","banishing-smite","cone-of-cold"],
  archfey: ["faerie-fire","sleep","calm-emotions","phantasmal-force","blink","plant-growth","dominate-beast","greater-invisibility","dominate-person","seeming"],
  fiend: ["burning-hands","command","blindness-deafness","scorching-ray","fireball","stinking-cloud","fire-shield","wall-of-fire","flame-strike","hallow"],
  "great-old-one": ["dissonant-whispers","hideous-laughter","detect-thoughts","phantasmal-force","clairvoyance","sending","dominate-beast","black-tentacles","dominate-person","telekinesis"],
};
export function warlockSpellChoices(patron: WarlockPatron,maximum: number) { return [...new Set([...classSpells("warlock",1,maximum), ...PATRON_SPELLS[patron].filter((key) => PHB_SPELLS[key] && PHB_SPELLS[key]!.level <= maximum)])].sort((a,b) => PHB_SPELLS[a]!.name.localeCompare(PHB_SPELLS[b]!.name)); }
export function defaultWarlockCreation(name = "") {
  const base = defaultFighterCreation(name);
  return { ...base,classKey: "warlock" as const,baseAbilities: { strength: 8,dexterity: 14,constitution: 13,intelligence: 12,wisdom: 10,charisma: 15 },skills: ["arcana","deception"] as typeof base.skills,equipment: { ...base.equipment,goldRoll: [2,2,2,2] } };
}
interface Invocation { name: string; description: string; level: number; boon?: PactBoon; blast?: boolean; curse?: boolean; spell?: string; mode?: "at-will" | "pact-invocation" | "innate"; reset?: "short-rest" | "long-rest"; }
const i = (name: string,description: string,level = 2,extra: Omit<Invocation,"name"|"description"|"level"> = {}): Invocation => ({ name,description,level,...extra });
export const INVOCATIONS: Record<string,Invocation> = {
  "agonizing-blast": i("Descarga agonizante","Cada impacto de Estallido arcano añade CAR al daño.",2,{ blast: true }),
  "armor-of-shadows": i("Armadura de sombras","Armadura de mago a voluntad sobre vos, sin espacio ni materiales.",2,{ spell: "mage-armor",mode: "at-will" }),
  "ascendant-step": i("Paso ascendente","Levitar sobre vos, a voluntad sin espacio ni materiales.",9,{ spell: "levitate",mode: "at-will" }),
  "beast-speech": i("Habla de las bestias","Hablar con los animales a voluntad sin espacio; conserva componentes.",2,{ spell: "speak-with-animals",mode: "at-will" }),
  "beguiling-influence": i("Influencia cautivadora","Competencia en Engaño y Persuasión; no duplica el bono de competencia."),
  "bewitching-whispers": i("Susurros cautivadores","Compulsión con un espacio de pacto, una vez por descanso largo.",7,{ spell: "compulsion",mode: "pact-invocation" }),
  "book-of-ancient-secrets": i("Libro de secretos ancestrales","Dos rituales de nivel 1 de cualquier clase, sin ocupar conocidos. Con el Libro de las Sombras en mano, lanzás esos y tus conocidos rituales como ritual. Podés copiar otros rituales hasta mitad del nivel de brujo redondeada arriba: 50 po y dos horas por nivel.",2,{ boon: "tome" }),
  "chains-of-carceri": i("Cadenas de Carceri","Inmovilizar monstruo a voluntad sin espacio/materiales, solo celestiales, infernales o elementales. No repetís sobre la misma criatura hasta descansar largo.",15,{ boon: "chain",spell: "hold-monster",mode: "at-will" }),
  "devils-sight": i("Vista del diablo","Visión normal en oscuridad mágica y no mágica a 120 pies; no cambia por sí sola la luz tenue."),
  "dreadful-word": i("Palabra terrible","Confusión con un espacio de pacto, una vez por descanso largo.",7,{ spell: "confusion",mode: "pact-invocation" }),
  "eldritch-sight": i("Visión sobrenatural","Detectar magia a voluntad sin espacio.",2,{ spell: "detect-magic",mode: "at-will" }),
  "eldritch-spear": i("Lanza sobrenatural","Estallido arcano tiene alcance 300 pies.",2,{ blast: true }),
  "eyes-of-the-rune-keeper": i("Ojos del guardián de runas","Podés leer cualquier escritura; no revela automáticamente mensajes secretos o efectos mágicos."),
  "fiendish-vigor": i("Vigor infernal","Vida falsa sobre vos a nivel 1, a voluntad sin espacio ni materiales; PG temporales no acumulables.",2,{ spell: "false-life",mode: "at-will" }),
  "gaze-of-two-minds": i("Mirada de dos mentes","Acción: tocá humanoide dispuesto para percibir sus sentidos hasta fin de tu siguiente turno. Acción en turnos posteriores mantiene, en el mismo plano; ciego y sordo a tu entorno mientras percibís."),
  lifedrinker: i("Bebedor de vida","Al impactar con tu arma de pacto, añadí daño necrótico igual a CAR, mínimo uno.",12,{ boon: "blade" }),
  "mask-of-many-faces": i("Máscara de muchos rostros","Disfrazarse a voluntad sin espacio.",2,{ spell: "disguise-self",mode: "at-will" }),
  "master-of-myriad-forms": i("Maestro de formas","Alterar el propio aspecto a voluntad sin espacio.",15,{ spell: "alter-self",mode: "at-will" }),
  "minions-of-chaos": i("Esbirros del caos","Conjurar elemental con espacio de pacto, una vez por descanso largo.",9,{ spell: "conjure-elemental",mode: "pact-invocation" }),
  "mire-the-mind": i("Enlodar la mente","Ralentizar con espacio de pacto, una vez por descanso largo.",5,{ spell: "slow",mode: "pact-invocation" }),
  "misty-visions": i("Visiones brumosas","Imagen silenciosa a voluntad sin espacio ni materiales.",2,{ spell: "silent-image",mode: "at-will" }),
  "one-with-shadows": i("Uno con las sombras","Acción en luz tenue u oscuridad: invisible hasta moverte o realizar acción (incluida adicional) o reacción.",5),
  "otherworldly-leap": i("Salto de otro mundo","Salto sobre vos a voluntad sin espacio ni materiales.",9,{ spell: "jump",mode: "at-will" }),
  "repelling-blast": i("Descarga repelente","Cada impacto de Estallido arcano permite alejar al objetivo hasta 10 pies en línea recta.",2,{ blast: true }),
  "sculptor-of-flesh": i("Escultor de carne","Polimorfar con espacio de pacto, una vez por descanso largo.",7,{ spell: "polymorph",mode: "pact-invocation" }),
  "sign-of-ill-omen": i("Signo de mal agüero","Lanzar maldición con espacio de pacto, una vez por descanso largo.",5,{ spell: "bestow-curse",mode: "pact-invocation" }),
  "thief-of-five-fates": i("Ladrón de cinco destinos","Perdición con espacio de pacto, una vez por descanso largo.",2,{ spell: "bane",mode: "pact-invocation" }),
  "thirsting-blade": i("Filo sediento","Acción Atacar: dos ataques con tu arma de pacto en lugar de uno; no se suma a otros Ataques Extra.",5,{ boon: "blade" }),
  "visions-of-distant-realms": i("Visiones de reinos lejanos","Ojo arcano a voluntad sin espacio.",15,{ spell: "arcane-eye",mode: "at-will" }),
  "voice-of-the-chain-master": i("Voz del amo de la cadena","Comunicación y percepción por tu familiar en el mismo plano; al percibir, podés hablar por él con tu voz. Percibir sigue requiriendo la acción de Encontrar familiar.",2,{ boon: "chain" }),
  "whispers-of-the-grave": i("Susurros de la tumba","Hablar con los muertos a voluntad sin espacio.",9,{ spell: "speak-with-dead",mode: "at-will" }),
  "witch-sight": i("Visión de bruja","A 30 pies y en línea visual, ves la forma real de cambiaformas y criaturas ocultas por ilusión o transmutación.",15),
  "aspect-of-the-moon": i("Aspecto de la Luna","No necesitás dormir ni pueden dormirte por medios mágicos. Descanso largo: ocho horas de actividad ligera; no elimina su duración.",2,{ boon: "tome" }),
  "cloak-of-flies": i("Capa de Moscas","Acción adicional: aura de 5 pies, hasta incapacitarte o descartarla con acción adicional. Ventaja Intimidación, desventaja otras pruebas de CAR; otras criaturas que comienzan su turno allí reciben veneno igual a CAR (mínimo 0). Un uso por descanso corto/largo.",5,{ reset: "short-rest" }),
  "eldritch-smite": i("Castigo Sobrenatural","Una vez por turno al impactar con arma de pacto, gastá espacio de pacto: +1d8 de fuerza más 1d8 por nivel del espacio. Podés derribar al objetivo si es Enorme o menor.",5,{ boon: "blade" }),
  "ghostly-gaze": i("Mirada Fantasmal","Acción: ves a través de objetos sólidos a 30 pies y visión en oscuridad en ese radio durante un minuto, con concentración como conjuro. Un uso por descanso corto/largo.",7,{ reset: "short-rest" }),
  "gift-of-the-depths": i("Regalo de las Profundidades","Respirás bajo agua y nadás a tu velocidad de caminar. Respirar bajo el Agua una vez sin espacio, por descanso largo.",5,{ spell: "water-breathing",mode: "innate" }),
  "gift-of-the-ever-living-ones": i("Regalo de los Inmortales","Cuando recuperás PG y tu familiar está a 100 pies, maximizá los dados tirados para esa curación.",2,{ boon: "chain" }),
  "grasp-of-hadar": i("Agarre de Hadar","Una vez en cada uno de tus turnos al impactar con Descarga Sobrenatural, acercá al objetivo 10 pies en línea recta.",2,{ blast: true }),
  "improved-pact-weapon": i("Arma Mejorada del Pacto","Tu arma de pacto sirve como foco de brujo y gana +1 ataque/daño salvo que ya tenga esa bonificación. También podés crear arco corto/largo o ballesta ligera/pesada.",2,{ boon: "blade" }),
  "lance-of-lethargy": i("Lanza de Letargo","Una vez en cada uno de tus turnos al impactar con Descarga Sobrenatural, reducís velocidad 10 pies hasta final de tu siguiente turno.",2,{ blast: true }),
  "maddening-hex": i("Maleficio Enloquecedor","Acción adicional: objetivo de tu Maleficio o rasgo de maldición, visible a 30 pies, y criaturas elegidas visibles a 5 pies de él reciben psíquico igual a CAR (mínimo 1).",5,{ curse: true }),
  "relentless-hex": i("Maleficio Implacable","Acción adicional: teletransporte hasta 30 pies a espacio libre visible a 5 pies de un objetivo visible de tu Maleficio o rasgo de maldición.",7,{ curse: true }),
  "shroud-of-shadow": i("Sudario de Sombras","Invisibilidad a voluntad, sin espacio; conserva concentración y demás condiciones del conjuro.",15,{ spell: "invisibility",mode: "at-will" }),
  "tomb-of-levistus": i("Tumba de Levistus","Reacción al recibir daño: 10 × nivel de brujo PG temporales que absorben ese daño primero. Después: vulnerabilidad a fuego, velocidad 0 e incapacitado hasta final de tu siguiente turno; entonces termina el hielo y todo PG temporal restante. Un uso por descanso corto/largo.",5,{ reset: "short-rest" }),
  "tricksters-escape": i("Escape del Embaucador","Libertad de Movimiento sobre vos una vez sin espacio por descanso largo.",7,{ spell: "freedom-of-movement",mode: "innate" }),
};
type Feature = TraitDefinition & { level: number };
const f = (level: number,key: string,name: string,description: string,reset?: "short-rest" | "long-rest"): Feature => ({ level,key,name,description,...(reset ? { maximum: 1,reset } : {}) });
export const PATRON_FEATURES: Record<WarlockPatron,Feature[]> = {
  celestial: [
    f(1,"celestial-cantrips","Trucos Adicionales","Luz y Llama Sagrada cuentan como trucos de brujo con CAR fuera del cupo de clase."),
    f(1,"healing-light","Luz Sanadora","Reserva de 1 + nivel de brujo d6 por descanso largo. Acción adicional: curá criatura visible a 60 pies, gastando hasta CAR dados (mínimo 1) de la reserva. No es un conjuro; no añade CAR a la curación."),
    f(6,"radiant-soul","Alma Radiante","Resistencia radiante. Al lanzar conjuro que cause fuego o radiante, podés añadir CAR a una tirada de ese daño contra uno de sus objetivos."),
    f(10,"celestial-resilience","Resiliencia Celestial","Tras descanso corto/largo, PG temporales = nivel de brujo + CAR. Hasta cinco aliados visibles al terminar ganan mitad de nivel de brujo, redondeada abajo, + CAR. No se acumulan con otros PG temporales."),
    f(14,"searing-vengeance","Venganza Ardiente","Al empezar turno debiendo hacer salvación contra muerte, podés recuperar mitad de PG máximos y levantarte. Criaturas elegidas a 30 pies reciben 2d8 + CAR radiante y quedan cegadas hasta final del turno.","long-rest"),
  ],
  hexblade: [
    f(1,"hexblade-curse","Maldición de Hexblade","Acción adicional: criatura visible a 30 pies, 1 minuto. Contra ella, +competencia al daño, crítico 19–20; si muere, curás nivel de brujo + CAR (mínimo 1). Termina si muere el objetivo, morís o quedás incapacitado.","short-rest"),
    f(1,"hex-warrior","Guerrero Maléfico","Competencia en armaduras medias, escudos y armas marciales. Tras descanso largo, tocá un arma competente sin dos manos: podés usar CAR para ataques/daño hasta el siguiente descanso largo. Se extiende a todas tus armas de pacto, sin restricción de tipo."),
    f(6,"accursed-specter","Espectro Maldito","Al matar humanoide, vinculá su espectro hasta final de tu siguiente descanso largo. PG temporales = mitad de nivel; bono a sus ataques = CAR (mínimo 0). Tiene iniciativa propia y obedece órdenes verbales; ficha y efectos se resuelven en mesa.","long-rest"),
    f(10,"armor-hexes","Armadura de Maleficios","Si el objetivo de Maldición de Hexblade te impacta con ataque: reacción y d6, con 4+ falla el ataque."),
    f(14,"master-hexes","Maestro de Maleficios","Cuando muere objetivo maldito, si no estás incapacitado podés transferir la maldición a criatura visible a 30 pies. Si lo hacés, no recibís la curación de esa muerte."),
  ],
  archfey: [
    f(1,"fey-presence","Presencia feérica","Acción: cubo de 10 pies desde vos, SAB contra CD de brujo; fallo, hechizado o asustado (elegís) hasta fin de tu siguiente turno.","short-rest"),
    f(6,"misty-escape","Escape brumoso","Reacción al recibir daño: invisible y teletransporte hasta 60 pies a lugar libre visible. Invisibilidad hasta inicio de tu siguiente turno o atacar/lanzar conjuro.","short-rest"),
    f(10,"beguiling-defenses","Defensas cautivadoras","Inmune a hechizado. Reacción cuando intentan hechizarte: SAB contra tu CD o atacante hechizado un minuto, hasta recibir daño."),
    f(14,"dark-delirium","Delirio oscuro","Acción, criatura visible a 60 pies: SAB contra CD; fallo, hechizada o asustada un minuto, con concentración como conjuro; daño termina el efecto. Solo percibe a sí misma, a vos y el entorno ilusorio.","short-rest"),
  ],
  fiend: [
    f(1,"dark-blessing","Bendición del Oscuro","Reducir una criatura hostil a 0 PG concede PG temporales = nivel de brujo + CAR, mínimo uno; no se suman a otros PG temporales."),
    f(6,"dark-luck","Suerte del Oscuro","Añadí 1d10 a prueba o salvación después de ver la tirada pero antes de resolver su efecto.","short-rest"),
    f(10,"fiendish-resilience","Resistencia infernal","Después de descanso corto/largo, elegí resistencia a un tipo de daño. Armas mágicas o de plata ignoran esta resistencia."),
    f(14,"hurl-through-hell","Lanzar a través del infierno","Al impactar un ataque, enviá al objetivo por planos infernales hasta fin de tu siguiente turno. Vuelve a su espacio o libre cercano; si no es infernal, recibe 10d10 psíquico.","long-rest"),
  ],
  "great-old-one": [
    f(1,"awakened-mind","Mente despierta","Comunicación telepática hacia una criatura visible a 30 pies que comprenda algún idioma; no exige lengua común ni concede respuesta telepática."),
    f(6,"entropic-ward","Guardián entrópico","Reacción ante un ataque contra vos: imponé desventaja. Si falla, tu próximo ataque contra esa criatura antes de fin de tu siguiente turno tiene ventaja.","short-rest"),
    f(10,"thought-shield","Escudo de pensamientos","No leen tus pensamientos salvo permiso; resistencia psíquica. Quien te cause daño psíquico recibe tanto daño como el que vos recibiste."),
    f(14,"create-thrall","Crear esclavo","Acción: tocá humanoide incapacitado para hechizarlo. Termina por Quitar maldición, quitar hechizado o usar el rasgo otra vez. Comunicación telepática en el mismo plano."),
  ],
};
