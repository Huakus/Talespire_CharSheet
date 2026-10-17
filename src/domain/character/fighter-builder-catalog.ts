import { FighterCreationSchema, type FighterCreation, type FightingStyle } from "./character-builder-model";
import { EXTRA_RACES, EXTRA_BACKGROUNDS, EXTRA_GEAR } from "./phb-character-options";
import srdEquipment from "./phb-srd-equipment.json";
import type { SkillKey } from "./character-checks";
import type { EquipmentCatalogDraft } from "../equipment/equipment-catalog";
import { normalizeEquipmentDefinition } from "../equipment/equipment-catalog";

export const FIGHTER_SKILLS: readonly SkillKey[] = ["acrobatics", "animalHandling", "athletics", "history", "insight", "intimidation", "perception", "survival"];
export const FIGHTER_ASI_LEVELS = [4, 6, 8, 12, 14, 16, 19];
export const FIGHTING_STYLES: Record<FightingStyle, { name: string; description: string }> = {
  archery: { name: "Arquería", description: "+2 a los ataques con armas a distancia." },
  defense: { name: "Defensa", description: "+1 CA mientras llevás armadura." },
  dueling: { name: "Duelo", description: "+2 al daño con una única arma cuerpo a cuerpo a una mano; permite escudo." },
  "great-weapon": { name: "Combate con armas grandes", description: "Con un arma cuerpo a cuerpo de propiedad a dos manos o versátil, empuñada a dos manos, podés repetir cada dado de daño que dé 1 o 2. Debés usar la repetición, aunque vuelva a dar 1 o 2." },
  protection: { name: "Protección", description: "Con escudo, podés gastar tu reacción cuando un atacante que ves ataque a otra criatura a 5 pies de vos: imponés desventaja a ese ataque." },
  "two-weapon": { name: "Combate con dos armas", description: "Después de Atacar con un arma cuerpo a cuerpo ligera a una mano, podés gastar una acción adicional para atacar con otra arma ligera en la otra mano. Este estilo permite sumar el modificador de atributo al daño del ataque adicional; no elimina el requisito de armas ligeras." },
};
export const BUILDER_RACES = {
  ...EXTRA_RACES,
  human: { name: "Humano", species: "Humano", subrace: "", bonuses: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 }, speed: 30, languages: ["Común"], traits: [] },
  "hill-dwarf": { name: "Enano de las colinas", species: "Enano", subrace: "Colinas", bonuses: { constitution: 2, wisdom: 1 }, speed: 25, languages: ["Común", "Enano"], traits: ["Visión en la oscuridad: 60 pies; luz tenue como clara y oscuridad como tenue, sin distinguir colores", "Resistencia enana: resistencia al daño de veneno y ventaja en salvaciones contra veneno", "Afinidad con la piedra: en Historia sobre el origen de obras de piedra, sos competente y sumás dos veces competencia, aunque no tengas Historia", "Dureza enana: +1 PG máximo por nivel", "Movimiento enano: la armadura pesada no reduce tu velocidad", "Entrenamiento enano con armas: hacha de batalla, hacha de mano, martillo ligero y martillo de guerra (incluido en las competencias de Guerrero)"] },
  "mountain-dwarf": { name: "Enano de las montañas", species: "Enano", subrace: "Montañas", bonuses: { constitution: 2, strength: 2 }, speed: 25, languages: ["Común", "Enano"], traits: ["Visión en la oscuridad: 60 pies; luz tenue como clara y oscuridad como tenue, sin distinguir colores", "Resistencia enana: resistencia al daño de veneno y ventaja en salvaciones contra veneno", "Afinidad con la piedra: en Historia sobre el origen de obras de piedra, sos competente y sumás dos veces competencia, aunque no tengas Historia", "Movimiento enano: la armadura pesada no reduce tu velocidad", "Entrenamiento enano con armas: hacha de batalla, hacha de mano, martillo ligero y martillo de guerra (incluido en las competencias de Guerrero)", "Entrenamiento enano con armaduras: armaduras ligeras y medias (incluido en las competencias de Guerrero)"] },
  "lightfoot-halfling": { name: "Mediano piesligeros", species: "Mediano", subrace: "Piesligeros", bonuses: { dexterity: 2, charisma: 1 }, speed: 25, languages: ["Común", "Mediano"], traits: ["Afortunado: repetí los 1 en ataques, pruebas y salvaciones; usá el nuevo resultado", "Valiente: ventaja en salvaciones contra miedo", "Agilidad mediana: atravesá espacios de criaturas de tamaño mayor", "Sigilo natural: podés esconderte tras una criatura de tamaño mayor"] },
  "stout-halfling": { name: "Mediano fornido", species: "Mediano", subrace: "Fornido", bonuses: { dexterity: 2, constitution: 1 }, speed: 25, languages: ["Común", "Mediano"], traits: ["Afortunado: repetí los 1 en ataques, pruebas y salvaciones; usá el nuevo resultado", "Valiente: ventaja en salvaciones contra miedo", "Agilidad mediana: atravesá espacios de criaturas de tamaño mayor", "Resistencia fornida: resistencia al veneno y ventaja en salvaciones contra veneno"] },
  "half-orc": { name: "Semiorco", species: "Semiorco", subrace: "", bonuses: { strength: 2, constitution: 1 }, speed: 30, languages: ["Común", "Orco"], traits: ["Visión en la oscuridad: 60 pies; luz tenue como clara y oscuridad como tenue, sin distinguir colores", "Ataques salvajes: en un crítico con un arma cuerpo a cuerpo, añadí un dado de daño del arma", "Amenazador: competencia en Intimidación"] },
} as const;

export const DWARF_TOOLS = { smith: "Herramientas de herrero", brewer: "Suministros de cervecero", mason: "Herramientas de albañil" } as const;
export const BACKGROUND_PRESETS: Record<FighterCreation["background"]["equipment"], FighterCreation["background"]> = {
  ...EXTRA_BACKGROUNDS,
  acolyte: { name: "Acólito", skills: ["insight", "religion"], tools: [], languages: ["Celestial", "Élfico"], featureName: "Refugio de los fieles", featureDescription: "Tu fe te permite oficiar ceremonias. Sus templos ofrecen cuidados y curación a vos y tus compañeros; aportás los componentes materiales. Los fieles pueden mantenerte a vos con un nivel de vida modesto. Un templo con el que tengas buena relación puede prestar ayuda no peligrosa.", equipment: "acolyte", prayerItem: "prayer-book", gamingSet: "dice", selections: [] },
  soldier: { name: "Soldado", skills: ["athletics", "intimidation"], tools: ["Juego de dados", "Vehículos terrestres"], languages: [], featureName: "Rango militar", featureDescription: "Los soldados de tu antigua organización reconocen tu rango. Los de menor rango pueden seguir tus órdenes; podés solicitar equipo sencillo o caballos prestados temporalmente. Donde reconozcan tu rango, normalmente podés acceder a campamentos y fortalezas amigas.", equipment: "soldier", prayerItem: "prayer-book", gamingSet: "dice", selections: [] },
  sage: { name: "Sabio", skills: ["arcana", "history"], tools: [], languages: ["Élfico", "Dracónico"], featureName: "Investigador", featureDescription: "Si desconocés información, con frecuencia sabés dónde o de quién podrías obtenerla; el acceso depende de la situación.", equipment: "sage", prayerItem: "prayer-book", gamingSet: "dice", selections: [] },
};

function item(name: string, category: string, weight: number, gold: number, description = ""): EquipmentCatalogDraft {
  return { ...normalizeEquipmentDefinition({ name, category, weight }), cost: { quantity: gold, unit: "gp" }, description };
}
type WeaponRow = [string, string, string, string, number, number, string, string?, (number | undefined)?, (number | undefined)?, string?];
const rows: WeaponRow[] = [
  ["club", "Garrote", "simple", "1d4", 2, .1, "bludgeoning", "light"],
  ["dagger", "Daga", "simple", "1d4", 1, 2, "piercing", "finesse,light,thrown", 20, 60],
  ["greatclub", "Gran garrote", "simple", "1d8", 10, .2, "bludgeoning", "two-handed"],
  ["handaxe", "Hacha de mano", "simple", "1d6", 2, 5, "slashing", "light,thrown", 20, 60],
  ["javelin", "Jabalina", "simple", "1d6", 2, .5, "piercing", "thrown", 30, 120],
  ["light-hammer", "Martillo ligero", "simple", "1d4", 2, 2, "bludgeoning", "light,thrown", 20, 60],
  ["mace", "Maza", "simple", "1d6", 4, 5, "bludgeoning"],
  ["quarterstaff", "Bastón", "simple", "1d6", 4, .2, "bludgeoning", "versatile", undefined, undefined, "1d8"],
  ["sickle", "Hoz", "simple", "1d4", 2, 1, "slashing", "light"],
  ["spear", "Lanza", "simple", "1d6", 3, 1, "piercing", "thrown,versatile", 20, 60, "1d8"],
  ["light-crossbow", "Ballesta ligera", "simple-ranged", "1d8", 5, 25, "piercing", "ammunition,loading,two-handed", 80, 320],
  ["dart", "Dardo", "simple-ranged", "1d4", .25, .05, "piercing", "finesse,thrown", 20, 60],
  ["shortbow", "Arco corto", "simple-ranged", "1d6", 2, 25, "piercing", "ammunition,two-handed", 80, 320],
  ["sling", "Honda", "simple-ranged", "1d4", 0, .1, "bludgeoning", "ammunition", 30, 120],
  ["battleaxe", "Hacha de batalla", "martial", "1d8", 4, 10, "slashing", "versatile", undefined, undefined, "1d10"],
  ["flail", "Mangual", "martial", "1d8", 2, 10, "bludgeoning"],
  ["glaive", "Guja", "martial", "1d10", 6, 20, "slashing", "heavy,reach,two-handed"],
  ["greataxe", "Gran hacha", "martial", "1d12", 7, 30, "slashing", "heavy,two-handed"],
  ["greatsword", "Espadón", "martial", "2d6", 6, 50, "slashing", "heavy,two-handed"],
  ["halberd", "Alabarda", "martial", "1d10", 6, 20, "slashing", "heavy,reach,two-handed"],
  ["lance", "Lanza de caballería", "martial", "1d12", 6, 10, "piercing", "reach,special"],
  ["longsword", "Espada larga", "martial", "1d8", 3, 15, "slashing", "versatile", undefined, undefined, "1d10"],
  ["maul", "Gran maza", "martial", "2d6", 10, 10, "bludgeoning", "heavy,two-handed"],
  ["morningstar", "Lucero del alba", "martial", "1d8", 4, 15, "piercing"],
  ["pike", "Pica", "martial", "1d10", 18, 5, "piercing", "heavy,reach,two-handed"],
  ["rapier", "Estoque", "martial", "1d8", 2, 25, "piercing", "finesse"],
  ["scimitar", "Cimitarra", "martial", "1d6", 3, 25, "slashing", "finesse,light"],
  ["shortsword", "Espada corta", "martial", "1d6", 2, 10, "piercing", "finesse,light"],
  ["trident", "Tridente", "martial", "1d6", 4, 5, "piercing", "thrown,versatile", 20, 60, "1d8"],
  ["war-pick", "Pico de guerra", "martial", "1d8", 2, 5, "piercing"],
  ["warhammer", "Martillo de guerra", "martial", "1d8", 2, 15, "bludgeoning", "versatile", undefined, undefined, "1d10"],
  ["whip", "Látigo", "martial", "1d4", 3, 2, "slashing", "finesse,reach"],
  ["blowgun", "Cerbatana", "martial-ranged", "1", 1, 10, "piercing", "ammunition,loading", 25, 100],
  ["hand-crossbow", "Ballesta de mano", "martial-ranged", "1d6", 3, 75, "piercing", "ammunition,light,loading", 30, 120],
  ["heavy-crossbow", "Ballesta pesada", "martial-ranged", "1d10", 18, 50, "piercing", "ammunition,heavy,loading,two-handed", 100, 400],
  ["longbow", "Arco largo", "martial-ranged", "1d8", 2, 50, "piercing", "ammunition,heavy,two-handed", 150, 600],
  ["net", "Red", "martial-ranged", "", 3, 1, "", "special,thrown", 5, 15],
];
export const BUILDER_WEAPONS = Object.fromEntries(rows.map(([key, name, category, dice, weight, gold, type, properties = "", normal, long, versatile = ""]) => [key, {
  ...item(name, "weapon", weight, gold, [
    properties.includes("loading") ? "Recarga: solo un disparo por acción, acción adicional o reacción, aunque tengas Ataque Extra." : "",
    properties.includes("ammunition") ? "Munición: gastá una unidad por disparo; para recargar un arma de una mano necesitás la otra libre." : "",
    properties.includes("heavy") ? "Pesada: criaturas Pequeñas tienen desventaja en los ataques." : "",
    properties.includes("light") && !category.includes("ranged") ? "Dos armas: con otra arma cuerpo a cuerpo ligera en la otra mano, podés atacar con la segunda como acción adicional después de Atacar con la primera. Ese ataque no suma el modificador positivo al daño salvo que tengas el estilo Combate con dos armas; el negativo sí se aplica. Esta acción muestra el daño del ataque normal." : "",
    properties.includes("thrown") ? `Arrojadiza: alcance ${normal}/${long} pies; usa el mismo atributo que el ataque normal del arma.` : "",
    versatile ? `Versátil: daño ${versatile} cuando atacás cuerpo a cuerpo a dos manos.` : "",
    normal ? "Más allá del alcance normal: desventaja; más allá del alcance largo: no podés atacar." : "",
    key === "lance" ? "Lanza de caballería: desventaja contra objetivos a 5 pies o menos; requiere dos manos cuando no estás montado. Duelo solo corresponde si la empuñás a una mano estando montado; añadí ese bono manualmente." : "",
    key === "net" ? "Red: no inflige daño. Apresa a criaturas Grandes o menores con forma definida. Una acción con prueba de Fuerza CD 10 libera al objetivo; también 5 de daño cortante contra la red (CA 10) la destruyen. Atacar con red permite solo un ataque en esa acción, acción adicional o reacción." : "",
  ].filter(Boolean).join("\n")), properties: properties.split(",").filter(Boolean),
  weapon: { category, range: category.includes("ranged") ? "ranged" : "melee", normalRange: normal ?? null, longRange: long ?? null, damageExpression: dice, versatileDamageExpression: versatile, damageType: type, attackBonus: 0, damageBonus: 0 },
}])) as Record<string, EquipmentCatalogDraft>;

export const BUILDER_GEAR: Record<string, EquipmentCatalogDraft> = {
  ...EXTRA_GEAR,
  "chain-mail": { ...item("Cota de malla", "armor", 55, 75, "Fuerza 13; desventaja en Sigilo."), armor: { base: 16, dexterityBonus: false, maximumDexterityBonus: null, armorCategory: "heavy", stealthDisadvantage: true, strengthRequirement: 13 } },
  leather: { ...item("Armadura de cuero", "armor", 10, 10), armor: { base: 11, dexterityBonus: true, maximumDexterityBonus: null, armorCategory: "light", stealthDisadvantage: false, strengthRequirement: 0 } },
  shield: { ...item("Escudo", "shield", 6, 10), armor: { base: 2, dexterityBonus: false, maximumDexterityBonus: null, armorCategory: "shield", stealthDisadvantage: false, strengthRequirement: 0 } },
  arrows: item("Flecha", "ammunition", .05, .05),
  bolts: item("Virote", "ammunition", .075, .05),
  dungeoneer: item("Paquete de explorador de mazmorras", "adventuring-gear", 61.5, 12, "Mochila, palanca, martillo, 10 pitones, 10 antorchas, yesquero, raciones para 10 días, odre y 50 pies de cuerda de cáñamo."),
  explorer: item("Paquete de explorador", "adventuring-gear", 59, 10, "Mochila, saco de dormir, utensilios de cocina, yesquero, 10 antorchas, raciones para 10 días, odre y 50 pies de cuerda de cáñamo."),
  "diplomats-pack": item("Paquete de diplomático", "adventuring-gear",36,39,"Cofre, dos estuches para mapas/pergaminos, ropa fina, tinta, pluma, lámpara, dos frascos de aceite, cinco hojas de papel, perfume, lacre y jabón."),
  "sprig-of-mistletoe": item("Ramita de muérdago", "adventuring-gear",0,1,"Foco druídico. No sustituye materiales con precio ni consumidos."),
  totem: item("Tótem druídico", "adventuring-gear",0,1,"Foco druídico con plumas, pelo, huesos o dientes de animales sagrados."),
  "wooden-staff": item("Bastón de madera druídico", "adventuring-gear",4,5,"Foco druídico extraído entero de un árbol vivo. Si lo usás como arma, creá su acción y acordá el uso como bastón con el GM."),
  "yew-wand": item("Varita de tejo", "adventuring-gear",1,10,"Foco druídico de madera sagrada. No sustituye materiales con precio ni consumidos."),
  "entertainers-pack": item("Paquete de actor", "adventuring-gear",38,40,"Mochila, saco de dormir, dos disfraces, cinco velas, raciones para cinco días, odre y kit de disfraz."),
  "burglars-pack": item("Paquete de ladrón", "adventuring-gear", 47.5, 16, "Mochila, bolsa de 1000 bolas de metal, 10 pies de cordel, campana, 5 velas, palanca, martillo, 10 pitones, linterna sorda, 2 frascos de aceite, raciones para 5 días, yesquero, odre y 50 pies de cuerda de cáñamo."),
  "thieves-tools": item("Herramientas de ladrón", "tool", 1, 25, "Lima pequeña, ganzúas, espejo con mango metálico, tijeras estrechas y alicates. Competencia permite sumar el bonificador al desarmar trampas y abrir cerraduras; Experto de Pícaro puede duplicarlo."),
  quiver: item("Carcaj", "adventuring-gear", 1, 1, "Contiene hasta 20 flechas."),
  "common-clothes": item("Ropa común", "adventuring-gear", 3, .5),
  pouch: item("Bolsa de monedas", "adventuring-gear", 1, .5),
  "holy-symbol": item("Símbolo sagrado", "adventuring-gear", 1, 5),
  "prayer-book": item("Libro de plegarias", "adventuring-gear", 5, 0),
  "prayer-wheel": item("Rueda de plegarias", "adventuring-gear", 0, 0, "Peso no especificado; acordalo con el GM."),
  incense: item("Varilla de incienso", "adventuring-gear", 0, 0),
  vestments: item("Vestiduras", "adventuring-gear", 0, 0),
  insignia: item("Insignia de rango", "adventuring-gear", 0, 0),
  trophy: item("Trofeo de un enemigo", "adventuring-gear", 0, 0),
  "gaming-set": item("Juego de dados", "tool", 0, .1),
  "playing-cards": item("Baraja de cartas", "tool", 0, .5),
  ink: item("Botella de tinta", "adventuring-gear", 0, 10),
  quill: item("Pluma", "adventuring-gear", 0, .02),
  "small-knife": item("Cuchillo pequeño", "adventuring-gear", 0, 0),
  letter: item("Carta con una pregunta pendiente", "adventuring-gear", 0, 0),
};

export const PHB_EQUIPMENT: Record<string, EquipmentCatalogDraft> = {
  ...Object.fromEntries(srdEquipment.map((row) => {
    const definition = normalizeEquipmentDefinition(row);
    const raw = row as unknown as { armor_category?: string; quantity?: number; cost?: { quantity: number; unit: string } };
    if (definition.armor) {
      definition.armor.armorCategory = (raw.armor_category ?? "").toLowerCase();
      if (definition.armor.armorCategory === "shield") definition.category = "shield";
    }
    if (raw.quantity && raw.quantity > 1) {
      definition.unitWeight /= raw.quantity;
      definition.cost.quantity /= raw.quantity;
    }
    return [row.index, definition];
  })),
  ...BUILDER_GEAR, ...BUILDER_WEAPONS,
};
export function equipmentGoldCost(key: string): number {
  const cost = PHB_EQUIPMENT[key]?.cost;
  return cost ? cost.quantity * ({ cp: .01, sp: .1, ep: .5, gp: 1, pp: 10 }[cost.unit.toLowerCase()] ?? 1) : Infinity;
}
// Gifts and narrative background objects have no purchase price; zero does not
// mean that a shop gives them away. They remain available in background grants.
export const PHB_PURCHASABLE_EQUIPMENT = Object.fromEntries(Object.entries(PHB_EQUIPMENT).filter(([, item]) => item.cost.quantity > 0));

export function defaultFighterCreation(name = ""): FighterCreation {
  const creation = FighterCreationSchema.parse({ name: name || "Borrador", playerName: "", race: "human", abilityMethod: "standard-array", baseAbilities: { strength: 15, dexterity: 13, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 }, skills: ["athletics", "perception"], racialSkillReplacement: null, languages: ["Goblin"], dwarfTool: null, background: structuredClone(BACKGROUND_PRESETS.acolyte), style: "defense", equipment: { armor: "chain-mail", primary: "longsword", secondary: null, shield: true, backup: "crossbow", pack: "explorer" }, personality: "" });
  return { ...creation, name };
}

export const builderGoldMultiplier = (key: string) => key === "monk" ? 1 : 10;
export function builderGoldDice(classKey: FighterCreation["classKey"]) { return classKey === "sorcerer" ? 3 : ["barbarian","druid"].includes(classKey) ? 2 : ["fighter","cleric","bard","ranger","monk","paladin"].includes(classKey) ? 5 : 4; }
