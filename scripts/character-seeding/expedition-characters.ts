import { createCharacter } from "../../src/domain/character/create-character";
import { CharacterV2Schema, type CharacterV2 } from "../../src/domain/character/character-v2";
import { createDefaultSpellSlots, type SpellDefinition } from "../../src/domain/character/character-spell-model";
import { createDeterministicId } from "../../src/shared/id";
import { pendingCharacterBlueprints } from "../../test/fixtures/pending-character-blueprints";

type Blueprint = (typeof pendingCharacterBlueprints)[number];
type InventoryItem = CharacterV2["inventory"][number];
type TraitUses = CharacterV2["traits"][number]["traits"][number]["uses"];
type ActionDraft = Omit<CharacterV2["actions"][number], "id" | "order" | "rollMode">;

export interface SpellCatalogBinding {
  characterId: string;
  spellId: string;
  contentKey: string;
}

const emptyEffect = { description: "", active: false } as const;
const noUses: TraitUses = { maximum: 0, used: 0, reset: "none" };

const traitDescriptions: Record<string, string> = {
  "Competencia en una habilidad": "La variante humana aporta una competencia adicional, ya incorporada en la sección de habilidades.",
  "Dote a nivel 1": "La variante humana obtiene una dote a nivel 1; la dote concreta figura en su propio grupo.",
  Vagabundo: "Recuerda mapas y geografía, encuentra alimento y agua para el grupo cuando el entorno lo permite.",
  "Competencias del trasfondo personalizado": "Atletismo, Supervivencia, Kit de herborista y las elecciones de idioma indicadas en la hoja.",
  "Enemigo predilecto": "Ventaja en pruebas de Sabiduría para rastrear gigantes y los humanoides elegidos, y en pruebas de Inteligencia para recordar información sobre ellos.",
  "Explorador nato": "Bosques y montañas son terrenos predilectos. En pruebas relacionadas, duplica la competencia de Inteligencia o Sabiduría si ya es competente.",
  "Estilo de combate: Tiro con Arco": "Suma +2 a las tiradas de ataque realizadas con armas a distancia.",
  "Lanzamiento de conjuros": "Sabiduría es la aptitud mágica. CD 14 y ataque de conjuro +6.",
  "Conciencia primigenia": "Puede gastar un espacio para detectar durante un tiempo la presencia general de ciertos tipos de criatura en la región.",
  "Ataque adicional": "Cuando realiza la acción Atacar, puede efectuar dos ataques.",
  "Coloso asesino": "Una vez por turno, causa 1d8 adicional al impactar a una criatura que ya haya perdido puntos de golpe.",
  "Escapar de la horda": "Los ataques de oportunidad contra el personaje se realizan con desventaja.",
  "Tirador experto": "Ignora penalizadores habituales de distancia larga y cobertura; puede aceptar -5 al ataque para sumar +10 al daño.",
  "Genio técnico": "Especialista narrativo en mecanismos, trampas, sistemas hidráulicos, dispositivos mágicos y tecnología aeloriana.",
  "Contactos de la Orden Carmesí": "Puede recurrir a ingenieros, talleres y recursos técnicos de la Orden cuando la ficción lo permita.",
  "Retoques mágicos": "Imbuye objetos diminutos no mágicos con efectos mágicos menores.",
  "Infundir objeto": "Conoce 6 infusiones y mantiene 3 activas: Arma mejorada, Defensa mejorada y Replicar objeto mágico (Bolsa de contención).",
  "La herramienta adecuada para el trabajo": "Puede crear mágicamente un juego de herramientas de artesano tras trabajar durante un descanso.",
  "Pericia con herramientas": "Duplica la bonificación de competencia en pruebas realizadas con herramientas en las que sea competente.",
  "Destello de genio": "Como reacción, suma Inteligencia (+5) a una prueba o salvación propia o de una criatura visible cercana.",
  "Herramientas del oficio": "Obtiene competencia con herramientas de herrero y armadura pesada.",
  "Conjuros de armero": "Mantiene preparados Proyectil mágico, Onda atronadora, Imagen múltiple y Shatter sin contarlos entre sus 8 preparados ordinarios.",
  "Armadura arcana": "La armadura cubre todo el cuerpo, sirve de foco, no exige Fuerza y no puede retirarse contra su voluntad.",
  "Modelo de armadura: Infiltrador": "Aumenta 5 pies la velocidad, incorpora Lanzarrayos y concede ventaja en Sigilo; la media armadura cancela esa ventaja con su desventaja.",
  "Experto en ballestas": "Ignora Carga, evita la desventaja por ataques a distancia a 5 pies y habilita el ataque adicional de ballesta de mano cuando se cumplen sus requisitos.",
  "Visión en la oscuridad superior": "Ve en oscuridad hasta 120 pies, en escala de grises.",
  "Sensibilidad a la luz solar": "Bajo luz solar directa sufre desventaja en ataques y en Percepción basada en la vista.",
  "Linaje feérico": "Ventaja contra ser encantado y no puede ser dormido mediante magia.",
  Trance: "Medita profundamente durante 4 horas en lugar de dormir.",
  "Magia drow": "Conoce Luces danzantes y puede usar Fuego feérico y Oscuridad una vez por descanso largo cada uno, usando Carisma.",
  "Entrenamiento con armas drow": "Competencia con estoque, espada corta y ballesta de mano.",
  Investigador: "Cuando desconoce una información, suele saber dónde o de quién podría obtenerla.",
  "Inspiración bárdica d8": "Como acción adicional entrega un d8 de inspiración. Tiene 5 usos y los recupera tras descanso corto o largo.",
  "Aprendiz de todo": "Añade media competencia a pruebas de característica que no incluyan ya su competencia.",
  "Canción de descanso d6": "Durante un descanso corto, aliados que gasten dados de golpe recuperan 1d6 adicional.",
  Pericia: "Duplica competencia en Historia e Investigación.",
  "Fuente de inspiración": "Recupera Inspiración bárdica al terminar un descanso corto o largo.",
  Contraencantamiento: "Como acción inicia una interpretación que ayuda a aliados cercanos contra miedo y encantamiento hasta su siguiente turno.",
  "Competencias adicionales": "El Colegio del Saber aporta tres competencias adicionales, ya incorporadas en la hoja.",
  "Palabras cortantes": "Como reacción gasta Inspiración bárdica para restar el d8 a un ataque, prueba o tirada de daño válida de otra criatura.",
  "Secretos mágicos adicionales": "Aprende Contrahechizo y Espíritus guardianes; no cuentan contra los 10 conjuros ordinarios conocidos.",
  "Líder inspirador": "Tras 10 minutos, hasta seis criaturas obtienen 12 PG temporales; una criatura debe descansar antes de beneficiarse de nuevo.",
};

function catalogMetadata(contentKey: string | null) {
  return contentKey === null
    ? null
    : { contentKey, origin: "official" as const, tags: ["official", "es"], revision: 0 };
}

function usesForTrait(name: string, characterName: string): TraitUses {
  if (name === "Destello de genio") return { maximum: 5, used: 0, reset: "long-rest" };
  if (name === "Inspiración bárdica d8") return { maximum: 5, used: 0, reset: "short-rest" };
  if (name === "Magia drow") return { maximum: 2, used: 0, reset: "long-rest" };
  if (name === "Líder inspirador") return { maximum: 1, used: 0, reset: "short-rest" };
  if (name === "Conciencia primigenia" && characterName === "Edrick Voss") return noUses;
  return noUses;
}

function customSpellDefinition(name: string): SpellDefinition | null {
  if (name !== "Cordón de flechas") return null;
  return {
    name,
    level: 2,
    description: "Clava cuatro piezas de munición no mágicas en el suelo. Cuando una criatura distinta de ti entra por primera vez en el área, una munición vuela hacia ella; una salvación de Destreza evita 1d6 de daño perforante. La munición queda destruida y el conjuro termina cuando no queda ninguna.",
    higherLevels: "Añade dos piezas de munición por cada nivel de espacio superior a 2.",
    range: "5 pies",
    components: "V, S, M",
    material: "Cuatro o más flechas o virotes no mágicos",
    ritual: false,
    duration: "8 horas",
    concentration: false,
    castingTime: "1 minuto",
    school: "Transmutación",
    classes: ["ranger"],
    attackType: "save",
    saveAbility: "dexterity",
    damageExpression: "1d6",
    upcastDamageExpression: "",
    addAbilityModifier: false,
    damageType: "Perforante",
    year: "2014",
    catalog: null,
  };
}

async function buildInventory(characterId: string, blueprint: Blueprint): Promise<InventoryItem[]> {
  const entries: InventoryItem[] = [];
  for (const [order, source] of blueprint.inventory.entries()) {
    const id = await createDeterministicId("inv", characterId, source.name);
    const lower = source.name.toLocaleLowerCase();
    const isEdrickBow = lower.includes("vigía invernal");
    const isEdrickSword = lower.includes("colmillo gris");
    const isDravenArmor = lower.includes("armadura de campo korr");
    const isShield = blueprint.name === "Draven Korr" && lower === "escudo";
    const isDravenCrossbow = lower.includes("pistola repetidora");
    const isMaelionArmor = blueprint.name === "Maelion Vaelaris" && lower.includes("cuero tachonado");
    const isEdrickArmor = blueprint.name === "Edrick Voss" && lower.includes("cuero tachonado");
    const isRapier = lower.includes("luz de penumbra");
    const isWeapon = isEdrickBow || isEdrickSword || isDravenCrossbow || isRapier;
    const isArmor = isDravenArmor || isMaelionArmor || isEdrickArmor;
    const isDossLute = lower.includes("laúd de los ecos");
    const isPearl = lower.includes("perla de poder");
    const isBag = lower.includes("bolsa conservadora");
    const isConsumable = ["fuego del alquimista", "aceite (frasco)", "antorcha alquímica", "raciones", "vial de ácido", "bomba incendiaria"].some((value) => lower.includes(value));
    const equipped = isEdrickBow || isEdrickArmor || isDravenArmor || isShield || isMaelionArmor || isRapier || isDossLute || isPearl;
    const attuned = isDossLute || isPearl;
    const category = isWeapon ? "weapon" : isArmor ? "armor" : isShield ? "shield" : lower.includes("flecha") ? "ammunition" : lower.includes("herramientas") || lower.includes("kit de") ? "tool" : isDossLute || isPearl || isBag || lower.includes("carcaj de ehlonna") || lower.includes("monóculo") ? "wondrous-item" : "adventuring-gear";
    const armor = isDravenArmor
      ? { base: 15, dexterityBonus: true, maximumDexterityBonus: 2, armorCategory: "Media", stealthDisadvantage: true }
      : isMaelionArmor || isEdrickArmor
        ? { base: 12, dexterityBonus: true, maximumDexterityBonus: null, armorCategory: "Ligera", stealthDisadvantage: false }
        : isShield
          ? { base: 2, dexterityBonus: false, maximumDexterityBonus: 0, armorCategory: "Escudo", stealthDisadvantage: false }
          : null;
    const weapon = isEdrickBow
      ? { category: "Marcial", range: "A distancia", normalRange: 150, longRange: 600, damageExpression: "1d8", versatileDamageExpression: "", damageType: "Perforante", attackBonus: 2, damageBonus: 2 }
      : isEdrickSword
        ? { category: "Marcial", range: "Cuerpo a cuerpo", normalRange: null, longRange: null, damageExpression: "1d6", versatileDamageExpression: "", damageType: "Perforante", attackBonus: 1, damageBonus: 1 }
        : isDravenCrossbow
          ? { category: "Marcial", range: "A distancia", normalRange: 30, longRange: 120, damageExpression: "1d6", versatileDamageExpression: "", damageType: "Perforante", attackBonus: 1, damageBonus: 1 }
          : isRapier
            ? { category: "Marcial", range: "Cuerpo a cuerpo", normalRange: null, longRange: null, damageExpression: "1d8", versatileDamageExpression: "", damageType: "Perforante", attackBonus: 1, damageBonus: 1 }
            : null;
    const bonuses = isEdrickArmor || isMaelionArmor
      ? [{ category: "combatStats", key: "AC", value: 1, advantage: false, disadvantage: false }]
      : isShield
        ? [{ category: "combatStats", key: "AC", value: 1, advantage: false, disadvantage: false }]
        : [];
    const charges = isDossLute || isPearl ? { current: 1, maximum: 1, reset: "dawn" } : null;
    const description = source.note ?? (
      isDravenArmor ? "Media armadura no mágica convertida en Armadura arcana. El Lanzarrayos es el único componente de la armadura con Arma mejorada."
      : isShield ? "Escudo no mágico con la infusión Defensa mejorada (+1 CA adicional)."
      : isDravenCrossbow ? "Ballesta de mano +1 usada como arma de respaldo cuando el escudo está guardado. Ataque reglado +6; daño 1d6+3."
      : isDossLute ? "Laúd de Doss renombrado. Requiere sintonización por un bardo; conserva los beneficios oficiales del instrumento y no añade +2 a los ataques de conjuro."
      : isPearl ? "Mientras está sintonizada, permite recuperar una vez al día un espacio gastado de nivel 3 o inferior."
      : isBag ? "Bolsa de contención creada mediante Replicar objeto mágico."
      : source.catalogKey ? "Entrada oficial reutilizada del catálogo de campaña." : "Equipo descrito en la ficha de campaña."
    );
    entries.push({
      id,
      order,
      group: order < 5 ? "equipment" : lower.includes("fragmento") || lower.includes("núcleo") ? "narrative" : "backpack",
      name: source.name,
      quantity: source.quantity,
      unitWeight: lower.includes("raciones") ? 2 : lower.includes("cuerda") ? 5 : lower.includes("flecha") ? 0.05 : 0,
      cost: { quantity: 0, unit: "gp" },
      category,
      description,
      properties: [
        ...(isEdrickBow ? ["Munición", "Pesada", "Dos manos", "Mágica +2"] : []),
        ...(isEdrickSword || isRapier ? ["Sutil", "Mágica +1"] : []),
        ...(isDravenCrossbow ? ["Munición", "Ligera", "Carga", "Mágica +1"] : []),
        ...(isDossLute || isPearl ? ["Requiere sintonización"] : []),
      ],
      equipped,
      attuned,
      requiresAttunement: attuned,
      usable: isConsumable || isDossLute || isPearl,
      consumable: isConsumable,
      charges,
      armor,
      weapon,
      bonuses,
      effect: { ...emptyEffect },
      catalog: catalogMetadata(source.catalogKey),
    });
  }
  return entries;
}

async function buildTraits(characterId: string, blueprint: Blueprint): Promise<CharacterV2["traits"]> {
  const groups: CharacterV2["traits"] = [];
  for (const [groupOrder, [title, names]] of Object.entries(blueprint.traitGroups).entries()) {
    const groupId = await createDeterministicId("trg", characterId, title);
    const traits = [];
    for (const [order, name] of names.entries()) {
      traits.push({
        id: await createDeterministicId("trt", characterId, title, name),
        order,
        name,
        description: traitDescriptions[name] ?? `Rasgo de ${title} incluido en la ficha de campaña.`,
        collapsed: true,
        uses: usesForTrait(name, blueprint.name),
        adjustment: null,
        effect: { ...emptyEffect },
      });
    }
    groups.push({ id: groupId, order: groupOrder, title, collapsed: false, traits });
  }
  return groups;
}

async function buildNotes(characterId: string, blueprint: Blueprint): Promise<CharacterV2["notes"]> {
  const groupId = await createDeterministicId("ntg", characterId, "campaign-notes");
  const sections = [
    ["Concepto y función", blueprint.notes.join("\n\n")],
    ["Ajustes reglados", blueprint.corrections.join("\n\n")],
    ["Decisiones aplicadas", blueprint.decisions.map((entry) => `${entry.field}: ${entry.recommendation}`).join("\n\n")],
  ] as const;
  return [{
    id: groupId,
    order: 0,
    title: "Ficha de campaña",
    collapsed: false,
    notes: await Promise.all(sections.map(async ([title, content], order) => ({
      id: await createDeterministicId("nte", characterId, title),
      order,
      title,
      content,
      tags: ["campaña", "nivel-7"],
    }))),
  }];
}

async function buildActions(characterId: string, blueprint: Blueprint, inventory: InventoryItem[]): Promise<CharacterV2["actions"]> {
  const finalize = (actions: ActionDraft[]) => Promise.all(actions.map(async (action, order) => ({
    ...action,
    id: await createDeterministicId("act", characterId, action.name),
    order,
    rollMode: "normal" as const,
  })));
  const inventoryByName = new Map(inventory.map((entry) => [entry.name, entry.id]));
  if (blueprint.name === "Edrick Voss") {
    const bowId = inventory.find((entry) => entry.name.includes("Vigía Invernal"))!.id;
    const swordId = inventory.find((entry) => entry.name.includes("Colmillo Gris"))!.id;
    const actions: ActionDraft[] = [
      { name: "Vigía Invernal (Arco largo +2)", categories: ["attack", "action"], activation: "Acción (dos ataques)", reach: "Ranged 150/600 ft", ability: "dexterity", proficient: true, attackBonus: 4, damageExpression: "1d8", damageBonus: 7, damageType: "Perforante", weaponType: "Arma a distancia", properties: "Munición, pesada, dos manos", description: "Ataque total +12. Puede aplicar Marca del cazador y Coloso asesino cuando corresponda.", inventoryItemId: bowId },
      { name: "Vigía Invernal — Tirador experto", categories: ["attack", "action"], activation: "Acción (dos ataques)", reach: "Ranged 150/600 ft", ability: "dexterity", proficient: true, attackBonus: -1, damageExpression: "1d8", damageBonus: 17, damageType: "Perforante", weaponType: "Arma a distancia", properties: "Tirador experto (-5/+10)", description: "Ataque total +7 y daño 1d8+17.", inventoryItemId: bowId },
      { name: "Colmillo Gris (Espada corta +1)", categories: ["attack", "action"], activation: "Acción (dos ataques)", reach: "5 ft", ability: "dexterity", proficient: true, attackBonus: 1, damageExpression: "1d6", damageBonus: 6, damageType: "Perforante", weaponType: "Cuerpo a cuerpo", properties: "Sutil, ligera", description: "Ataque total +9 y daño 1d6+6.", inventoryItemId: swordId },
      { name: "Coloso asesino", categories: ["other"], activation: "Una vez por turno", reach: "", ability: null, proficient: false, attackBonus: 0, damageExpression: "1d8", damageBonus: 0, damageType: "Del arma", weaponType: "", properties: "Cazador", description: traitDescriptions["Coloso asesino"]!, inventoryItemId: null },
    ];
    return finalize(actions);
  }
  if (blueprint.name === "Draven Korr") {
    const armorId = inventory.find((entry) => entry.name.includes("Armadura de campo Korr"))!.id;
    const crossbowId = inventory.find((entry) => entry.name.includes("Pistola repetidora"))!.id;
    const actions: ActionDraft[] = [
      { name: "Lanzarrayos mejorado", categories: ["attack", "action"], activation: "Acción (dos ataques)", reach: "Ranged 90/300 ft", ability: "intelligence", proficient: true, attackBonus: 1, damageExpression: "1d6", damageBonus: 6, damageType: "Rayo", weaponType: "Arma simple a distancia integrada", properties: "Arma mejorada +1", description: "Ataque total +9. Una vez en cada turno, un impacto puede causar 1d6 de rayo adicional.", inventoryItemId: armorId },
      { name: "Daño adicional del Lanzarrayos", categories: ["other"], activation: "Una vez por turno al impactar", reach: "", ability: null, proficient: false, attackBonus: 0, damageExpression: "1d6", damageBonus: 0, damageType: "Rayo", weaponType: "", properties: "Modelo Infiltrador", description: "Se añade a uno de los impactos del Lanzarrayos durante el turno.", inventoryItemId: armorId },
      { name: "Pistola repetidora experimental (Ballesta de mano +1)", categories: ["attack", "action"], activation: "Acción; escudo guardado", reach: "Ranged 30/120 ft", ability: "dexterity", proficient: true, attackBonus: 1, damageExpression: "1d6", damageBonus: 3, damageType: "Perforante", weaponType: "Ballesta de mano", properties: "Munición, ligera, carga", description: "Ataque reglado +6 y daño 1d6+3. Requiere una mano libre para la munición.", inventoryItemId: crossbowId },
      { name: "Destello de genio", categories: ["reaction"], activation: "Reacción", reach: "30 ft", ability: "intelligence", proficient: false, attackBonus: 0, damageExpression: "", damageBonus: 0, damageType: "", weaponType: "", properties: "5 usos por descanso largo", description: traitDescriptions["Destello de genio"]!, inventoryItemId: null },
    ];
    return finalize(actions);
  }
  const rapierId = inventoryByName.get("Luz de Penumbra (Estoque +1)")!;
  const actions: ActionDraft[] = [
    { name: "Luz de Penumbra (Estoque +1)", categories: ["attack", "action"], activation: "Acción", reach: "5 ft", ability: "dexterity", proficient: true, attackBonus: 1, damageExpression: "1d8", damageBonus: 4, damageType: "Perforante", weaponType: "Cuerpo a cuerpo", properties: "Sutil", description: "Ataque total +7 y daño 1d8+4.", inventoryItemId: rapierId },
    { name: "Palabras cortantes", categories: ["reaction"], activation: "Reacción", reach: "60 ft", ability: "charisma", proficient: false, attackBonus: 0, damageExpression: "1d8", damageBonus: 0, damageType: "Reducción", weaponType: "", properties: "Consume Inspiración bárdica", description: traitDescriptions["Palabras cortantes"]!, inventoryItemId: null },
    { name: "Líder inspirador", categories: ["action"], activation: "10 minutos", reach: "30 ft", ability: "charisma", proficient: false, attackBonus: 0, damageExpression: "", damageBonus: 12, damageType: "PG temporales", weaponType: "", properties: "Hasta 6 criaturas", description: traitDescriptions["Líder inspirador"]!, inventoryItemId: null },
  ];
  return finalize(actions);
}

async function buildCharacter(blueprint: Blueprint, createdAt: string): Promise<{ character: CharacterV2; bindings: SpellCatalogBinding[] }> {
  const characterId = await createDeterministicId("chr", "ece-expedition", blueprint.name);
  const base = createCharacter(characterId, blueprint.name, createdAt);
  const checks = structuredClone(base.checks);
  for (const [skill, state] of Object.entries(blueprint.skills)) {
    checks.skills[skill as keyof typeof checks.skills] = {
      proficiency: state.proficiency,
      bonus: 0,
      rollMode: "normal",
    };
  }
  for (const ability of blueprint.savingThrows) {
    checks.savingThrows[ability].proficiency = 1;
  }
  const inventory = await buildInventory(characterId, blueprint);
  const actions = await buildActions(characterId, blueprint, inventory);
  const traits = await buildTraits(characterId, blueprint);
  const notes = await buildNotes(characterId, blueprint);
  const bindings: SpellCatalogBinding[] = [];
  const spells = [];
  for (const [order, source] of blueprint.spellcasting.spells.entries()) {
    const spellId = await createDeterministicId("spl", characterId, source.origin, source.name);
    if (source.catalogKey !== null) bindings.push({ characterId, spellId, contentKey: source.catalogKey });
    spells.push({
      id: spellId,
      order,
      name: source.name,
      level: source.level,
      prepared: true,
      definition: customSpellDefinition(source.name),
      effect: { ...emptyEffect },
    });
  }
  const slots = createDefaultSpellSlots();
  for (const [level, maximum] of Object.entries(blueprint.spellcasting.slots)) {
    slots[level] = { maximum, used: 0 };
  }
  return {
    bindings,
    character: CharacterV2Schema.parse({
      ...base,
      revision: 0,
      identity: { ...blueprint.identity, playerName: "" },
      abilities: blueprint.abilities,
      combat: {
        armorClass: blueprint.combat.armorClass,
        speed: `${blueprint.combat.speedFeet} ft`,
        initiative: blueprint.combat.initiative >= 0 ? `+${blueprint.combat.initiative}` : String(blueprint.combat.initiative),
        hitPoints: { current: blueprint.combat.maximumHitPoints, maximum: blueprint.combat.maximumHitPoints, temporary: 0 },
        hitDice: { current: "7", formula: blueprint.combat.hitDice, remaining: 7, maximum: 7, dieSize: blueprint.combat.hitDice === "7d10" ? 10 : 8 },
        deathSaves: { successes: 0, failures: 0 },
        conditions: [],
        inspiration: false,
        exhaustion: 0,
      },
      proficiencies: blueprint.proficiencies,
      checks,
      actions,
      inventory,
      traits,
      notes,
      extras: [],
      commerce: { suspicionByMerchant: {} },
      taleSpire: null,
      currency: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
      spellcasting: {
        ability: blueprint.combat.spellcastingAbility,
        selectedLevel: null,
        levels: {},
        showUpcast: false,
        attackBonus: 0,
        saveDcBonus: 0,
        favoriteSpells: blueprint.name === "Edrick Voss"
          ? ["Marca del cazador"]
          : blueprint.name === "Draven Korr"
            ? ["Absorber elementos", "Calentar metal"]
            : ["Contrahechizo", "Patrón hipnótico", "Espíritus guardianes"],
        spells,
        slots,
      },
      metadata: { createdAt, updatedAt: createdAt },
    }),
  };
}

export async function createExpeditionCharacters(createdAt: string): Promise<{
  characters: CharacterV2[];
  spellCatalogBindings: SpellCatalogBinding[];
}> {
  const built = [];
  for (const blueprint of pendingCharacterBlueprints) built.push(await buildCharacter(blueprint, createdAt));
  return {
    characters: built.map((entry) => entry.character),
    spellCatalogBindings: built.flatMap((entry) => entry.bindings),
  };
}
