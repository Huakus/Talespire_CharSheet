import type { TraitDefinition } from "./builder-traits";
import { defaultFighterCreation } from "./fighter-builder-catalog";
import type { CharacterBuilderState,FighterCreation } from "./character-builder-model";
import type { ClericDomain } from "./cleric-model";
export const CLERIC_DOMAINS: Record<ClericDomain,string> = { knowledge: "Conocimiento", life: "Vida", light: "Luz", nature: "Naturaleza", tempest: "Tempestad", trickery: "Superchería", war: "Guerra", forge: "Forja (Xanathar)", grave: "Tumba (Xanathar)" };
export const CLERIC_SKILLS = ["history","insight","medicine","persuasion","religion"] as const;
export const KNOWLEDGE_SKILLS = ["arcana","history","nature","religion"];
export const NATURE_SKILLS = ["animalHandling","nature","survival"];
export const clericDomain = (state: CharacterBuilderState): ClericDomain | null => state.classKey === "cleric" ? state.creation.cleric.domain : null;
export const clericHeavyArmor = (domain: ClericDomain | null) => domain !== null && ["life","nature","tempest","war","forge"].includes(domain);
export const clericMartialWeapons = (domain: ClericDomain | null) => domain === "tempest" || domain === "war";
export const clericCantripCount = (level: number) => level >= 10 ? 5 : level >= 4 ? 4 : 3;
export const clericChannelUses = (level: number) => level >= 18 ? 3 : level >= 6 ? 2 : level >= 2 ? 1 : 0;
export const clericDestroyCr = (level: number) => level >= 17 ? "4" : level >= 14 ? "3" : level >= 11 ? "2" : level >= 8 ? "1" : level >= 5 ? "1/2" : null;
export const CLERIC_DOMAIN_SPELLS: Record<ClericDomain,string[][]> = {
  knowledge: [["command","identify"],["augury","suggestion"],["nondetection","speak-with-dead"],["arcane-eye","confusion"],["legend-lore","scrying"]],
  life: [["bless","cure-wounds"],["lesser-restoration","spiritual-weapon"],["beacon-of-hope","revivify"],["death-ward","guardian-of-faith"],["mass-cure-wounds","raise-dead"]],
  light: [["burning-hands","faerie-fire"],["flaming-sphere","scorching-ray"],["daylight","fireball"],["guardian-of-faith","wall-of-fire"],["flame-strike","scrying"]],
  nature: [["animal-friendship","speak-with-animals"],["barkskin","spike-growth"],["plant-growth","wind-wall"],["dominate-beast","grasping-vine"],["insect-plague","tree-stride"]],
  tempest: [["fog-cloud","thunderwave"],["gust-of-wind","shatter"],["call-lightning","sleet-storm"],["control-water","ice-storm"],["destructive-wave","insect-plague"]],
  trickery: [["charm-person","disguise-self"],["mirror-image","pass-without-trace"],["blink","dispel-magic"],["dimension-door","polymorph"],["dominate-person","modify-memory"]],
  war: [["divine-favor","shield-of-faith"],["magic-weapon","spiritual-weapon"],["crusaders-mantle","spirit-guardians"],["freedom-of-movement","stoneskin"],["flame-strike","hold-monster"]],
  forge: [["identify","searing-smite"],["heat-metal","magic-weapon"],["elemental-weapon","protection-from-energy"],["fabricate","wall-of-fire"],["animate-objects","creation"]],
  grave: [["bane","false-life"],["gentle-repose","ray-of-enfeeblement"],["revivify","vampiric-touch"],["blight","death-ward"],["antilife-shell","raise-dead"]],
};
export function clericDomainSpells(domain: ClericDomain, level: number) { return CLERIC_DOMAIN_SPELLS[domain].slice(0,Math.min(5,Math.ceil(level/2))).flat(); }
export function defaultClericCreation(name = ""): FighterCreation {
  const creation = defaultFighterCreation(name);
  return { ...creation,classKey: "cleric" as const,skills: ["medicine","persuasion"] as typeof creation.skills,baseAbilities: { strength: 14,dexterity: 10,constitution: 13,intelligence: 8,wisdom: 15,charisma: 12 },cleric: { ...creation.cleric,domain: "life" as const } };
}
type Feature = TraitDefinition & { level: number; channel?: boolean };
const f = (level: number,key: string,name: string,description: string,channel = false): Feature => ({ level,key,name,description,channel });
export const CLERIC_FEATURES: Record<ClericDomain,Feature[]> = {
  knowledge: [
    f(1,"knowledge","Bendiciones del Conocimiento","Dos idiomas y dos competencias entre Conocimiento Arcano, Historia, Naturaleza y Religión. Duplicás competencia en esas dos habilidades."),
    f(2,"knowledge-ages","Conocimiento de las Edades","Acción y Canalizar Divinidad: competencia en una habilidad o herramienta a elección durante 10 minutos.",true),
    f(6,"read-thoughts","Leer Pensamientos","Acción y Canalizar Divinidad: criatura visible a 60 pies, salvación SAB. Fallo: leés pensamientos superficiales durante 1 minuto a esa distancia. Podés terminar el efecto con una acción para lanzar Sugestión sin espacio; falla automáticamente su salvación. Si supera la salvación inicial, no podés repetir contra ella hasta descanso largo.",true),
    f(17,"visions","Visiones del Pasado","Meditación con concentración de hasta SAB minutos: tras 1 minuto ves dueño anterior y adquisición/evento significativo de un objeto; minutos adicionales permiten otros dueños de los últimos SAB días. En un área de hasta 50 pies de lado, cada minuto revela un evento significativo de los últimos SAB días, desde el más reciente."),
  ],
  life: [
    f(1,"disciple-life","Discípulo de la Vida","Cuando un conjuro de nivel 1+ restaura PG, añade 2 + nivel del conjuro a la curación de cada criatura. No se aplica a trucos ni a PG temporales."),
    f(2,"preserve-life","Preservar Vida","Acción y Canalizar Divinidad: repartí hasta 5 × nivel de clérigo PG entre criaturas a 30 pies; no supera la mitad del máximo de cada una. No afecta constructos ni muertos vivientes.",true),
    f(6,"blessed-healer","Sanador Bendecido","Cuando lanzás un conjuro de nivel 1+ que restaura PG a otra criatura, recuperás 2 + nivel del conjuro PG. Solo una vez por lanzamiento, aunque cures a varias criaturas."),
    f(17,"supreme-healing","Sanación Suprema","Los dados de curación de tus conjuros usan su resultado máximo. No maximiza daño ni curaciones de otros rasgos."),
  ],
  light: [
    f(1,"light-cantrip","Truco Adicional: Luz","Aprendés Luz fuera del cupo de clase si todavía no lo conocés; no concede otro truco sustituto."),
    f(1,"warding-flare","Fulgor Protector","Reacción antes del ataque de una criatura visible a 30 pies contra vos: desventaja. Inmune a cegado: no afecta. Usos SAB (mínimo 1) por descanso largo."),
    f(2,"radiance-dawn","Resplandor del Alba","Acción y Canalizar Divinidad con símbolo sagrado: disipa oscuridad mágica a 30 pies; hostiles allí sin cobertura total hacen CON o reciben 2d10 + nivel radiante, mitad al salvar.",true),
    f(6,"improved-flare","Fulgor Mejorado","Fulgor Protector también puede proteger a otra criatura atacada por un enemigo visible a 30 pies."),
    f(17,"corona","Corona de Luz","Acción: aura 1 minuto, luz brillante 60 pies y tenue otros 30. Enemigos en luz brillante tienen desventaja en salvaciones contra conjuros que causen fuego o radiante. Otra acción permite desactivarla."),
  ],
  nature: [
    f(1,"acolyte-nature","Acólito de la Naturaleza","Un truco de druida (usa SAB y cuenta como conjuro de clérigo para vos) y una competencia entre Trato con Animales, Naturaleza o Supervivencia. Competencia en armadura pesada."),
    f(2,"charm-nature","Hechizar Animales y Plantas","Acción y Canalizar Divinidad, símbolo sagrado: bestias y plantas que te vean a 30 pies hacen SAB; fallo, hechizadas y amistosas con vos y tus designados 1 minuto o hasta recibir daño.",true),
    f(6,"dampen-elements","Amortiguar Elementos","Reacción cuando vos o criatura a 30 pies recibe ácido, frío, fuego, rayo o trueno: resistencia a ese daño para ese impacto."),
    f(17,"master-nature","Maestro de la Naturaleza","Acción adicional: ordená verbalmente lo que harán en su siguiente turno las criaturas hechizadas por Hechizar Animales y Plantas."),
  ],
  tempest: [
    f(1,"wrath-storm","Ira de la Tormenta","Reacción tras impacto de atacante visible a 5 pies: DEX o 2d8 de rayo o trueno; mitad si salva. Usos SAB (mínimo 1), descanso largo. Competencia marcial y armadura pesada."),
    f(2,"destructive-wrath","Ira Destructiva","Al tirar daño de rayo o trueno, gastá Canalizar Divinidad para maximizar esos dados en lugar de tirarlos.",true),
    f(6,"thunderbolt","Golpe de Rayo","Cuando causás daño de rayo a una criatura Grande o menor, podés empujarla hasta 10 pies alejándola de vos."),
    f(17,"stormborn","Hijo de la Tormenta","Vuelo igual a tu velocidad actual de caminar mientras no estés bajo techo ni bajo tierra."),
  ],
  trickery: [
    f(1,"blessing-trickster","Bendición del Tramposo","Acción y tocar a otra criatura dispuesta: ventaja en Sigilo 1 hora o hasta usarlo otra vez. No podés aplicártelo a vos mismo."),
    f(2,"invoke-duplicity","Invocar Duplicidad","Acción y Canalizar Divinidad: duplicado ilusorio visible a 30 pies, 1 minuto con concentración como un conjuro. Acción adicional para moverlo 30 pies (máximo 120 de vos). Lanzás desde él usando tus propios sentidos. Si ambos están a 5 pies de criatura que ve la ilusión, tenés ventaja en ataques contra ella.",true),
    f(6,"cloak-shadows","Capa de Sombras","Acción y Canalizar Divinidad: invisible hasta final de tu siguiente turno; termina si atacás o lanzás conjuro.",true),
    f(17,"improved-duplicity","Duplicidad Mejorada","Invocar Duplicidad crea hasta cuatro duplicados. Una acción adicional mueve cualquier número de ellos hasta 30 pies, manteniéndolos a 120 pies de vos."),
  ],
  war: [
    f(1,"war-priest","Clérigo de Guerra","Al usar la acción Atacar, podés hacer un ataque con arma como acción adicional. Usos SAB (mínimo 1) por descanso largo. Competencia en armas marciales y armadura pesada."),
    f(2,"guided-strike","Impacto Guiado","Canalizar Divinidad: +10 a una tirada de ataque propia después de ver el dado y antes de saber si impacta.",true),
    f(6,"war-blessing","Bendición del Dios de la Guerra","Reacción y Canalizar Divinidad: +10 a un ataque de otra criatura a 30 pies, después de ver la tirada y antes de saber si impacta.",true),
    f(17,"avatar-battle","Avatar de Batalla","Resistencia al daño contundente, perforante y cortante de ataques no mágicos."),
  ],
  forge: [
    f(1,"blessing-forge","Bendición de la Forja","Al terminar descanso largo, tocá un arma simple/marcial o armadura no mágicas (no escudo): se vuelve mágico, +1 ataque y daño o +1 CA hasta el próximo descanso largo o tu muerte. Un solo objeto. Competencia en armadura pesada y herramientas de herrero."),
    f(2,"artisan-blessing","Bendición del Artesano","Canalizar Divinidad y ritual de 1 hora: creá objeto no mágico que contenga metal, de hasta 100 po, consumiendo metal/monedas del mismo valor. Aparece a 5 pies; puede incluir partes no metálicas. Para duplicar un objeto necesitás el original durante el ritual.",true),
    f(6,"soul-forge","Alma de la Forja","Resistencia a fuego y +1 CA mientras llevás armadura pesada."),
    f(17,"saint-forge","Santo de Forja y Fuego","Inmunidad a fuego; mientras llevás armadura pesada, resistencia a contundente, perforante y cortante de ataques no mágicos."),
  ],
  grave: [
    f(1,"circle-mortality","Círculo de Mortalidad","Al curar con un conjuro a una criatura que está a 0 PG, maximizás sus dados de curación. Aprendés Piedad con los Moribundos fuera de cupo: para vos, alcance 30 pies y también puede lanzarse como acción adicional."),
    f(1,"eyes-grave","Secretos de la Tumba","Acción: hasta el final de tu próximo turno detectás ubicación de muertos vivientes a 60 pies, salvo cobertura total o protección contra adivinación. No revela identidad ni capacidades. Usos SAB (mínimo 1), descanso largo."),
    f(2,"path-grave","Camino a la Tumba","Acción y Canalizar Divinidad: maldecí criatura visible a 30 pies hasta el final de tu siguiente turno. El próximo ataque de vos o un aliado que la impacte tiene vulnerabilidad a todo su daño; luego termina.",true),
    f(6,"sentinel-death","Centinela en las Puertas de la Muerte","Reacción al recibir vos o criatura visible a 30 pies un crítico: lo convertís en impacto normal, anulando efectos por crítico. Usos SAB (mínimo 1) por descanso largo."),
    f(17,"keeper-souls","Guardián de las Almas","Al morir enemigo visible a 60 pies, vos o criatura a 60 pies recupera PG iguales a sus dados de golpe. No disponible incapacitado; una vez hasta el inicio de tu siguiente turno."),
  ],
};
