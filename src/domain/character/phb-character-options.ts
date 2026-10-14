import type { FighterCreation } from "./character-builder-model";
import type { SkillKey } from "./character-checks";
import { normalizeEquipmentDefinition, type EquipmentCatalogDraft } from "../equipment/equipment-catalog";

const darkvision = "Visión en la oscuridad: 60 pies; luz tenue como clara, oscuridad como tenue, sin colores";
const fey = "Ascendencia feérica: ventaja contra hechizado e inmunidad al sueño mágico";
const trance = "Trance: meditación de 4 horas en lugar de sueño; descansos según las condiciones de la mesa";
const elfTraining = "Entrenamiento élfico con armas: espadas largas/cortas y arcos largos/cortos; incluido en Guerrero";
const gnomeCunning = "Astucia gnoma: ventaja en salvaciones de Inteligencia, Sabiduría y Carisma contra magia";
export const EXTRA_RACES = {
  "human-variant": { name: "Humano variante", species: "Humano", subrace: "Variante", bonuses: {}, speed: 30, languages: ["Común"], traits: ["Versatilidad humana: +1 en dos atributos distintos, una habilidad y una dote"] },
  "high-elf": { name: "Alto elfo", species: "Elfo", subrace: "Alto", bonuses: { dexterity: 2, intelligence: 1 }, speed: 30, languages: ["Común", "Élfico"], traits: [darkvision, fey, trance, "Sentidos agudos: competencia en Percepción", elfTraining, "Magia del alto elfo: un truco de mago, usando Inteligencia"] },
  "wood-elf": { name: "Elfo de los bosques", species: "Elfo", subrace: "Bosques", bonuses: { dexterity: 2, wisdom: 1 }, speed: 35, languages: ["Común", "Élfico"], traits: [darkvision, fey, trance, "Sentidos agudos: competencia en Percepción", elfTraining, "Máscara de la espesura: podés intentar ocultarte con ocultación ligera de vegetación, lluvia, niebla, nieve u otros fenómenos naturales"] },
  drow: { name: "Elfo oscuro (drow)", species: "Elfo", subrace: "Drow", bonuses: { dexterity: 2, charisma: 1 }, speed: 30, languages: ["Común", "Élfico"], traits: ["Visión en la oscuridad superior: 120 pies; sin colores", fey, trance, "Sentidos agudos: competencia en Percepción", "Sensibilidad a la luz solar: desventaja en ataques y Percepción visual cuando vos, el objetivo o lo observado esté bajo sol directo", "Entrenamiento drow: estoque, espada corta y ballesta de mano; incluido en Guerrero"] },
  dragonborn: { name: "Dracónido", species: "Dracónido", subrace: "", bonuses: { strength: 2, charisma: 1 }, speed: 30, languages: ["Común", "Dracónico"], traits: [] },
  "forest-gnome": { name: "Gnomo de los bosques", species: "Gnomo", subrace: "Bosques", bonuses: { intelligence: 2, dexterity: 1 }, speed: 25, languages: ["Común", "Gnomo"], traits: [darkvision, gnomeCunning, "Ilusionista natural: Ilusión menor, usando Inteligencia", "Hablar con bestias pequeñas: comunicá ideas sencillas con sonidos y gestos a bestias Pequeñas o menores"] },
  "rock-gnome": { name: "Gnomo de las rocas", species: "Gnomo", subrace: "Rocas", bonuses: { intelligence: 2, constitution: 1 }, speed: 25, languages: ["Común", "Gnomo"], traits: [darkvision, gnomeCunning, "Saber del artífice: en Historia sobre objetos mágicos, alquímicos o tecnológicos, sustituí cualquier bono de competencia por dos veces tu competencia", "Manitas: competencia con herramientas de hojalatero. En 1 hora y con 10 po de materiales construís un dispositivo Diminuto (CA 5, 1 PG), hasta tres activos. Dura 24 horas salvo mantenimiento de 1 hora; desmontarlo requiere una acción y recupera materiales. Opciones: juguete mecánico (se mueve 5 pies por turno al azar y emite sonidos), encendedor (acción para encender fuego) o caja de música (una melodía al abrirla)."] },
  "half-elf": { name: "Semielfo", species: "Semielfo", subrace: "", bonuses: { charisma: 2 }, speed: 30, languages: ["Común", "Élfico"], traits: [darkvision, fey, "Versatilidad con habilidades: dos competencias a elección", "Atributos del semielfo: +1 en dos atributos distintos de Carisma"] },
  tiefling: { name: "Tiefling", species: "Tiefling", subrace: "", bonuses: { intelligence: 1, charisma: 2 }, speed: 30, languages: ["Común", "Infernal"], traits: [darkvision, "Resistencia infernal: resistencia al daño de fuego"] },
} as const;

export const ARTISAN_TOOLS = ["Suministros de alquimista", "Suministros de cervecero", "Suministros de calígrafo", "Herramientas de carpintero", "Herramientas de cartógrafo", "Herramientas de zapatero", "Utensilios de cocinero", "Herramientas de soplador de vidrio", "Herramientas de joyero", "Herramientas de curtidor", "Herramientas de albañil", "Suministros de pintor", "Herramientas de alfarero", "Herramientas de herrero", "Herramientas de hojalatero", "Herramientas de tejedor", "Herramientas de tallista"];
export const INSTRUMENTS = ["Gaita", "Tambor", "Dulcémele", "Flauta", "Laúd", "Lira", "Cuerno", "Flauta de Pan", "Caramillo", "Viola"];
export const GAMES = ["Juego de dados", "Ajedrez de dragones", "Baraja de cartas", "Apuesta de tres dragones"];
export const TOOLS = [...ARTISAN_TOOLS, ...INSTRUMENTS, ...GAMES, "Kit de disfraz", "Kit de falsificación", "Kit de herborista", "Herramientas de navegante", "Kit de venenos", "Herramientas de ladrón", "Vehículos terrestres", "Vehículos acuáticos"];
export const LANGUAGES = ["Común", "Enano", "Élfico", "Gigante", "Gnomo", "Goblin", "Mediano", "Orco", "Abisal", "Celestial", "Dracónico", "Habla de las profundidades", "Infernal", "Primordial", "Silvano", "Infracomún"];
export const SUBCLASSES = { champion: "Campeón", "battle-master": "Maestro de batalla", "eldritch-knight": "Caballero arcano", "arcane-archer": "Arquero Arcano (Xanathar)",cavalier: "Caballero (Xanathar)",samurai: "Samurái (Xanathar)" };
export const DRAGON_ANCESTRIES = {
  black: { name: "Negro", damage: "acid", shape: "línea de 5 × 30 pies", save: "dexterity" },
  blue: { name: "Azul", damage: "lightning", shape: "línea de 5 × 30 pies", save: "dexterity" },
  brass: { name: "Oropel", damage: "fire", shape: "línea de 5 × 30 pies", save: "dexterity" },
  bronze: { name: "Bronce", damage: "lightning", shape: "línea de 5 × 30 pies", save: "dexterity" },
  copper: { name: "Cobre", damage: "acid", shape: "línea de 5 × 30 pies", save: "dexterity" },
  gold: { name: "Oro", damage: "fire", shape: "cono de 15 pies", save: "dexterity" },
  green: { name: "Verde", damage: "poison", shape: "cono de 15 pies", save: "constitution" },
  red: { name: "Rojo", damage: "fire", shape: "cono de 15 pies", save: "dexterity" },
  silver: { name: "Plata", damage: "cold", shape: "cono de 15 pies", save: "constitution" },
  white: { name: "Blanco", damage: "cold", shape: "cono de 15 pies", save: "constitution" },
} as const;

type Background = FighterCreation["background"];
function bg(equipment: Background["equipment"], name: string, skills: SkillKey[], tools: string[], languages: string[], featureName: string, featureDescription: string): Background {
  return { equipment, name, skills, tools, languages, featureName, featureDescription, prayerItem: "prayer-book", gamingSet: "dice", selections: [] };
}
const criminal = "Contacto criminal: contás con un contacto fiable que conecta con una red delictiva y sabés hacerle llegar mensajes, incluso a distancia.";
const entertainer = "Por demanda popular: encontrás lugares para actuar y recibir alojamiento y comida modestos mientras actuás allí; las actuaciones te hacen reconocible para el público local.";
const artisan = "Miembro del gremio: otros miembros pueden ofrecer alojamiento y comida, apoyo y contactos. El gremio puede defenderte si sos inocente o la infracción se justifica; pagás 5 po al mes y saldás deudas para recuperar sus beneficios.";
const sailor = "Pasaje de barco: podés obtener pasaje gratuito para vos y tus compañeros en barcos de antiguos compañeros o contactos, colaborando durante la travesía. El GM decide horarios y ruta disponibles.";
export const EXTRA_BACKGROUNDS = {
  charlatan: bg("charlatan", "Charlatán", ["deception", "sleightOfHand"], ["Kit de disfraz", "Kit de falsificación"], [], "Identidad falsa", "Tenés una segunda identidad con documentos, conocidos y disfraces. Podés falsificar documentos si has visto un ejemplo del tipo de documento o de la escritura que imitás."),
  criminal: bg("criminal", "Criminal", ["deception", "stealth"], ["Juego de dados", "Herramientas de ladrón"], [], "Contacto criminal", criminal),
  spy: bg("spy", "Espía", ["deception", "stealth"], ["Juego de dados", "Herramientas de ladrón"], [], "Contacto criminal", criminal),
  entertainer: bg("entertainer", "Artista", ["acrobatics", "performance"], ["Kit de disfraz", "Laúd"], [], "Por demanda popular", entertainer),
  gladiator: bg("gladiator", "Gladiador", ["acrobatics", "performance"], ["Kit de disfraz", "Laúd"], [], "Por demanda popular", "Conseguís lugares para actuar, especialmente arenas y clubes de lucha, con los beneficios de Por demanda popular."),
  "folk-hero": bg("folk-hero", "Héroe del pueblo", ["animalHandling", "survival"], ["Herramientas de carpintero", "Vehículos terrestres"], [], "Hospitalidad rústica", "La gente común puede alojarte, ocultarte o cuidarte mientras no hayas demostrado ser un peligro para ella; no arriesga su vida luchando por vos."),
  "guild-artisan": bg("guild-artisan", "Artesano gremial", ["insight", "persuasion"], ["Herramientas de carpintero"], ["Enano"], "Miembro del gremio", artisan),
  "guild-merchant": bg("guild-merchant", "Mercader gremial", ["insight", "persuasion"], ["Herramientas de navegante"], ["Enano"], "Miembro del gremio", artisan),
  hermit: bg("hermit", "Ermitaño", ["medicine", "religion"], ["Kit de herborista"], ["Silvano"], "Descubrimiento", "Tu aislamiento permitió un descubrimiento relevante. Definí con el GM su naturaleza, alcance y consecuencias para la campaña."),
  noble: bg("noble", "Noble", ["history", "persuasion"], ["Ajedrez de dragones"], ["Élfico"], "Posición de privilegio", "La gente suele asumir que tenés derecho a estar donde estás: la gente común intenta complacerte, otras personas de alta posición te tratan como igual, y podés conseguir audiencia con un noble local."),
  knight: bg("knight", "Caballero", ["history", "persuasion"], ["Ajedrez de dragones"], ["Élfico"], "Retenedores", "Tres sirvientes leales te acompañan; uno puede ser un escudero. Realizan tareas cotidianas, sin combatir, seguirte a lugares evidentemente peligrosos ni soportar abusos habituales."),
  outlander: bg("outlander", "Forastero", ["athletics", "survival"], ["Flauta"], ["Silvano"], "Vagabundo", "Tenés memoria excelente de mapas y geografía y recordás la disposición general de terrenos y asentamientos. Podés conseguir comida y agua para vos y otras cinco personas por día si el entorno ofrece los recursos necesarios."),
  sailor: bg("sailor", "Marinero", ["athletics", "perception"], ["Herramientas de navegante", "Vehículos acuáticos"], [], "Pasaje de barco", sailor),
  pirate: bg("pirate", "Pirata", ["athletics", "perception"], ["Herramientas de navegante", "Vehículos acuáticos"], [], "Mala reputación", "Donde te conozcan, la gente suele evitar denunciar delitos menores por temor, como negarte a pagar una comida o romper una puerta en un comercio local."),
  urchin: bg("urchin", "Huérfano", ["sleightOfHand", "stealth"], ["Kit de disfraz", "Herramientas de ladrón"], [], "Secretos de la ciudad", "Conocés rutas y pasadizos urbanos: fuera de combate, vos y los compañeros que guiás pueden viajar entre lugares de una ciudad al doble de la rapidez habitual."),
};

export function phbGear(name: string, weight = 0, gold = 0, category = "adventuring-gear", description = ""): EquipmentCatalogDraft {
  return { ...normalizeEquipmentDefinition({ name, category, weight }), cost: { quantity: gold, unit: "gp" }, description };
}
export const EXTRA_GEAR: Record<string, EquipmentCatalogDraft> = {
  "scholars-pack": phbGear("Paquete de erudito", 10, 40, "adventuring-gear", "Mochila, libro de saber, botella de tinta, pluma, diez hojas de pergamino, bolsa pequeña de arena y cuchillo pequeño. El libro de saber es distinto del libro de conjuros."),
  "fine-clothes": phbGear("Ropa fina", 6, 15), "traveler-clothes": phbGear("Ropa de viajero", 4, 2), "dark-clothes": phbGear("Ropa común oscura con capucha", 3, .5),
  "disguise-kit": phbGear("Kit de disfraz", 3, 25, "tool"), "forgery-kit": phbGear("Kit de falsificación", 5, 15, "tool"), "herbalism-kit": phbGear("Kit de herborista", 3, 5, "tool"),
  "crowbar": phbGear("Palanca", 5, 2), "shovel": phbGear("Pala", 5, 2), "iron-pot": phbGear("Olla de hierro", 10, 2), "blanket": phbGear("Manta", 3, .5),
  "hempen-rope": phbGear("Cuerda de cáñamo (50 pies)", 10, 1), "silk-rope": phbGear("Cuerda de seda (50 pies)", 5, 10), "hunting-trap": phbGear("Trampa de caza", 25, 5),
  "scroll-case": phbGear("Estuche para mapas o pergaminos", 1, 1), "signet-ring": phbGear("Anillo de sello"), "pedigree": phbGear("Pergamino de linaje"),
  "introduction": phbGear("Carta de presentación del gremio"), "admiration-gift": phbGear("Regalo de un admirador"), "lucky-charm": phbGear("Amuleto de la suerte"),
  "hermit-notes": phbGear("Notas de estudio y plegarias"), "city-map": phbGear("Mapa de tu ciudad"), "pet-mouse": phbGear("Ratón mascota"), "family-token": phbGear("Recuerdo de tus padres"),
  "loaded-dice": phbGear("Dados cargados"), "marked-cards": phbGear("Baraja marcada"), "colored-liquid": phbGear("Diez botellas de líquido coloreado"),
  "mule": phbGear("Mula", 0, 8), "cart": phbGear("Carro", 200, 15), "ritual-book": phbGear("Libro de rituales", 5, 0),
};
const toolKeys = ["alchemist-supplies", "brewer-supplies", "calligrapher-supplies", "carpenter-tools", "cartographer-tools", "cobbler-tools", "cook-utensils", "glassblower-tools", "jeweler-tools", "leatherworker-tools", "mason-tools", "painter-supplies", "potter-tools", "smith-tools", "tinker-tools", "weaver-tools", "woodcarver-tools"];
const costs = [50, 20, 10, 8, 15, 5, 1, 30, 25, 5, 10, 10, 10, 20, 50, 1, 1];
const weights = [8, 9, 5, 6, 6, 5, 8, 5, 2, 5, 8, 5, 3, 8, 10, 5, 5];
export const ARTISAN_GEAR = Object.fromEntries(ARTISAN_TOOLS.map((name, i) => [toolKeys[i]!, name]));
toolKeys.forEach((key, i) => { EXTRA_GEAR[key] = phbGear(ARTISAN_TOOLS[i]!, weights[i], costs[i], "tool"); });
export const INSTRUMENT_GEAR = Object.fromEntries(INSTRUMENTS.map((name, i) => [`instrument-${i}`, name]));
const instrumentCosts = [30, 6, 25, 2, 35, 30, 3, 12, 2, 30], instrumentWeights = [6, 3, 10, 1, 2, 2, 2, 2, 1, 1];
INSTRUMENTS.forEach((name, i) => { EXTRA_GEAR[`instrument-${i}`] = phbGear(name, instrumentWeights[i], instrumentCosts[i], "tool"); });
export interface EquipmentChoice { label: string; keys: string[] }
export const BACKGROUND_EQUIPMENT: Record<Background["equipment"], { gold: number; items: Array<[string, number]>; choices: EquipmentChoice[] }> = {
  acolyte: { gold: 15, items: [["holy-symbol", 1], ["incense", 5], ["vestments", 1], ["common-clothes", 1]], choices: [{ label: "Objeto de oración", keys: ["prayer-book", "prayer-wheel"] }] },
  charlatan: { gold: 15, items: [["fine-clothes", 1], ["disguise-kit", 1]], choices: [{ label: "Material de tu estafa", keys: ["loaded-dice", "marked-cards", "signet-ring", "colored-liquid"] }] },
  criminal: { gold: 15, items: [["crowbar", 1], ["dark-clothes", 1]], choices: [] }, spy: { gold: 15, items: [["crowbar", 1], ["dark-clothes", 1]], choices: [] },
  entertainer: { gold: 15, items: [["admiration-gift", 1], ["costume", 1]], choices: [{ label: "Instrumento", keys: Object.keys(INSTRUMENT_GEAR) }] },
  gladiator: { gold: 15, items: [["admiration-gift", 1], ["costume", 1]], choices: [{ label: "Instrumento o arma de gladiador", keys: [...Object.keys(INSTRUMENT_GEAR), "trident", "net"] }] },
  "folk-hero": { gold: 10, items: [["shovel", 1], ["iron-pot", 1], ["common-clothes", 1]], choices: [{ label: "Herramientas de artesano", keys: toolKeys }] },
  "guild-artisan": { gold: 15, items: [["introduction", 1], ["traveler-clothes", 1]], choices: [{ label: "Herramientas de artesano", keys: toolKeys }] },
  "guild-merchant": { gold: 15, items: [["introduction", 1], ["traveler-clothes", 1]], choices: [{ label: "Herramientas o mula y carro", keys: [...toolKeys, "mule-cart"] }] },
  hermit: { gold: 5, items: [["scroll-case", 1], ["hermit-notes", 1], ["blanket", 1], ["common-clothes", 1], ["herbalism-kit", 1]], choices: [] },
  noble: { gold: 25, items: [["fine-clothes", 1], ["signet-ring", 1], ["pedigree", 1]], choices: [] }, knight: { gold: 25, items: [["fine-clothes", 1], ["signet-ring", 1], ["pedigree", 1]], choices: [] },
  outlander: { gold: 10, items: [["quarterstaff", 1], ["hunting-trap", 1], ["trophy", 1], ["traveler-clothes", 1]], choices: [] },
  sage: { gold: 10, items: [["ink", 1], ["quill", 1], ["small-knife", 1], ["letter", 1], ["common-clothes", 1]], choices: [] },
  sailor: { gold: 10, items: [["club", 1], ["silk-rope", 1], ["lucky-charm", 1], ["common-clothes", 1]], choices: [] }, pirate: { gold: 10, items: [["club", 1], ["silk-rope", 1], ["lucky-charm", 1], ["common-clothes", 1]], choices: [] },
  soldier: { gold: 10, items: [["insignia", 1], ["trophy", 1], ["common-clothes", 1]], choices: [{ label: "Juego", keys: ["gaming-set", "playing-cards"] }] },
  urchin: { gold: 10, items: [["small-knife", 1], ["city-map", 1], ["pet-mouse", 1], ["family-token", 1], ["common-clothes", 1]], choices: [] },
};
EXTRA_GEAR.costume = phbGear("Disfraz para actuaciones", 4, 5);
