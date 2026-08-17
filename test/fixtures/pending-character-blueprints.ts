export type AbilityKey =
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma";

export type SkillProficiency = 1 | 2;

export interface PendingSkill {
  ability: AbilityKey;
  proficiency: SkillProficiency;
  expectedBonus: number;
  conditionalBonus?: number;
  condition?: string;
}

export interface PendingSpell {
  name: string;
  level: 0 | 1 | 2 | 3 | 4;
  origin: "class" | "racial" | "subclass" | "magical-secret";
  catalogKey: string | null;
  source: string;
}

export interface PendingInventoryEntry {
  name: string;
  quantity: number;
  catalogKey: string | null;
  note?: string;
}

export interface PendingDecision {
  field: string;
  recommendation: string;
  reason: string;
  blocking: boolean;
}

export interface PendingCharacterBlueprint {
  status: "pending";
  name: string;
  source: {
    documentId: string;
    tabId: string;
    rules: string[];
  };
  identity: {
    className: string;
    subclass: string;
    species: string;
    subrace: string;
    background: string;
    level: 7;
    experience: 23000;
    alignment: string;
  };
  abilities: Record<AbilityKey, number>;
  combat: {
    proficiencyBonus: 3;
    armorClass: number;
    sourceArmorClass: number;
    maximumHitPoints: number;
    hitDice: "7d8" | "7d10";
    initiative: number;
    speedFeet: number;
    spellcastingAbility: AbilityKey;
    spellSaveDc: number;
    spellAttackBonus: number;
  };
  savingThrows: AbilityKey[];
  skills: Record<string, PendingSkill>;
  proficiencies: {
    armor: string[];
    weapons: string[];
    tools: string[];
    languages: string[];
  };
  actions: Array<{
    name: string;
    attackBonus?: number;
    damage?: string;
    note: string;
  }>;
  traitGroups: Record<string, string[]>;
  spellcasting: {
    slots: Record<"1" | "2" | "3" | "4", number>;
    classCantripLimit: number;
    ordinarySpellLimit: number;
    spells: PendingSpell[];
  };
  inventory: PendingInventoryEntry[];
  notes: string[];
  corrections: string[];
  decisions: PendingDecision[];
}

const CAMPAIGN_DOCUMENT_ID = "1Zf5oPNgrkZHU0RJJ4Zdwc7uLc_Gg37vOHNOMbV2VBa8";
const PHB = "Manual del Jugador 5e (2014)";
const XGE = "Guía de Xanathar para Todo";
const TCE = "Tasha's Cauldron of Everything (dependencia no suministrada)";

const spell = (
  name: string,
  level: PendingSpell["level"],
  origin: PendingSpell["origin"],
  catalogKey: string | null,
  source = PHB,
): PendingSpell => ({ name, level, origin, catalogKey, source });

const item = (
  name: string,
  quantity = 1,
  catalogKey: string | null = null,
  note?: string,
): PendingInventoryEntry => ({ name, quantity, catalogKey, ...(note ? { note } : {}) });

export const pendingCharacterBlueprints = [
  {
    status: "pending",
    name: "Edrick Voss",
    source: {
      documentId: CAMPAIGN_DOCUMENT_ID,
      tabId: "t.2a7wwndgw42z",
      rules: [PHB, XGE],
    },
    identity: {
      className: "Explorador",
      subclass: "Cazador",
      species: "Humano variante",
      subrace: "",
      background: "Explorador de frontera (trasfondo personalizado basado en Forastero)",
      level: 7,
      experience: 23000,
      alignment: "Neutral bueno (provisional)",
    },
    abilities: {
      strength: 10,
      dexterity: 20,
      constitution: 14,
      intelligence: 12,
      wisdom: 16,
      charisma: 8,
    },
    combat: {
      proficiencyBonus: 3,
      armorClass: 18,
      sourceArmorClass: 18,
      maximumHitPoints: 67,
      hitDice: "7d10",
      initiative: 5,
      speedFeet: 30,
      spellcastingAbility: "wisdom",
      spellSaveDc: 14,
      spellAttackBonus: 6,
    },
    savingThrows: ["strength", "dexterity"],
    skills: {
      perception: {
        ability: "wisdom",
        proficiency: 1,
        expectedBonus: 6,
        conditionalBonus: 9,
        condition: "Prueba de Sabiduría vinculada a bosque o montaña por Explorador Nato",
      },
      survival: {
        ability: "wisdom",
        proficiency: 1,
        expectedBonus: 6,
        conditionalBonus: 9,
        condition: "Prueba de Sabiduría vinculada a bosque o montaña por Explorador Nato",
      },
      stealth: { ability: "dexterity", proficiency: 1, expectedBonus: 8 },
      investigation: { ability: "intelligence", proficiency: 1, expectedBonus: 4 },
      athletics: { ability: "strength", proficiency: 1, expectedBonus: 3 },
      animalHandling: { ability: "wisdom", proficiency: 1, expectedBonus: 6 },
    },
    proficiencies: {
      armor: ["Armadura ligera", "Armadura media", "Escudos"],
      weapons: ["Armas simples", "Armas marciales"],
      tools: ["Kit de herborista"],
      languages: ["Común", "Gigante", "Enano", "Goblin", "Orco"],
    },
    actions: [
      {
        name: "Vigía Invernal (Arco largo +2)",
        attackBonus: 12,
        damage: "1d8+7 perforante",
        note: "Incluye Destreza +5, competencia +3, Tiro con Arco +2 y magia +2.",
      },
      {
        name: "Vigía Invernal — Tirador experto",
        attackBonus: 7,
        damage: "1d8+17 perforante",
        note: "Variante voluntaria de -5 al ataque y +10 al daño.",
      },
      {
        name: "Colmillo Gris (Espada corta +1)",
        attackBonus: 9,
        damage: "1d6+6 perforante",
        note: "Arma sutil; usa Destreza.",
      },
      {
        name: "Coloso asesino",
        damage: "+1d8",
        note: "Una vez por turno contra una criatura que ya esté por debajo de sus PG máximos.",
      },
    ],
    traitGroups: {
      "Humano variante": ["Competencia en una habilidad", "Dote a nivel 1"],
      "Explorador de frontera": ["Vagabundo", "Competencias del trasfondo personalizado"],
      Explorador: [
        "Enemigo predilecto",
        "Explorador nato",
        "Estilo de combate: Tiro con Arco",
        "Lanzamiento de conjuros",
        "Conciencia primigenia",
        "Ataque adicional",
      ],
      Cazador: ["Coloso asesino", "Escapar de la horda"],
      Dote: ["Tirador experto"],
    },
    spellcasting: {
      slots: { "1": 4, "2": 2, "3": 0, "4": 0 },
      classCantripLimit: 0,
      ordinarySpellLimit: 5,
      spells: [
        spell("Marca del cazador", 1, "class", "official:spell:es:1321d8743f141a8397920e30"),
        spell("Absorber elementos", 1, "class", "official:spell:es:9ab49538f9e34f26cc795ecb", XGE),
        spell("Curar heridas", 1, "class", "official:spell:es:5e73ba9554d774b5b023cf59"),
        spell("Pasar sin rastro", 2, "class", "official:spell:es:942f53b92a8968bc5b273b35"),
        spell("Cordón de flechas", 2, "class", null),
      ],
    },
    inventory: [
      item("Vigía Invernal (Arco largo +2)", 1, "official:equipment:es:c19f57566f5600c65eb85dcf"),
      item("Colmillo Gris (Espada corta +1)", 1, "official:equipment:es:fbfeabdbf97d67f978564aea"),
      item("Cuero tachonado +1", 1, "official:equipment:es:55c9bbc182e669a1be9867a5"),
      item("Carcaj de Ehlonna", 1, "official:equipment:es:dfac5d1193ee8763411386fa"),
      item("Flecha normal", 40),
      item("Flecha de plata", 20),
      item("Flecha incendiaria", 20),
      item("Flecha con cuerda", 10),
      item("Fuego del alquimista (frasco)", 4, "official:equipment:es:e2c6fc0f3a4001fca0154c52"),
      item("Aceite (frasco)", 4, "official:equipment:es:f42e832b6b2895b035bada95"),
      item("Yesca impermeable"),
      item("Antorcha alquímica", 3, "official:equipment:es:d3916bc71ae13afb7a224244"),
      item("Mapa de la región"),
      item("Brújula de latón"),
      item("Kit de herborista"),
      item("Kit de escalada", 1, "official:equipment:es:61f89fe62d631f3cdc73f2bc"),
      item("Cuerda de seda (30 m)"),
      item("Catalejo", 1, "official:equipment:es:1979314dd959de4052e3f286"),
      item("Diario de exploración"),
      item("Pieles para clima extremo"),
      item("Raciones (1 día)", 15, "official:equipment:es:d915713ec2c391e5dcf80714"),
      item("Cantimplora reforzada", 1, "official:equipment:es:240e4ce5f914087a513da6a2"),
      item("Manta térmica"),
      item("Gancho de escalada", 1),
    ],
    notes: [
      "Especialista en trolls y exploración de bosques y montañas.",
      "Los 67 PG son posibles con tiradas, pero no coinciden con los 60 PG del promedio fijo.",
      "La bonificación de Explorador Nato es contextual; no debe grabarse como bonificación permanente.",
    ],
    corrections: [
      "Sigilo es +8, no +11, salvo que se añada una fuente explícita de pericia.",
      "Percepción y Supervivencia son +6 normalmente y +9 solo en las pruebas cubiertas por Explorador Nato.",
      "El ataque total del arco es +12, o +7 al usar Tirador experto.",
      "A nivel 6 faltaban un segundo enemigo predilecto y su idioma asociado.",
    ],
    decisions: [
      {
        field: "combat.maximumHitPoints",
        recommendation: "Conservar 67 y registrar que se usaron tiradas de PG.",
        reason: "El promedio fijo del explorador 7 con Constitución 14 da 60.",
        blocking: true,
      },
      {
        field: "traits.favoredEnemyLevel6",
        recommendation: "Humanoides: orcos y goblinoides; idioma Orco.",
        reason: "El Manual exige una segunda elección al nivel 6.",
        blocking: true,
      },
      {
        field: "identity.backgroundAndLanguages",
        recommendation: "Usar el trasfondo personalizado indicado y los idiomas provisionales del borrador.",
        reason: "El documento no especifica trasfondo, idiomas ni el origen de Kit de herborista.",
        blocking: true,
      },
      {
        field: "identity.alignment",
        recommendation: "Neutral bueno.",
        reason: "Dato requerido por CharacterV2 y ausente en la fuente.",
        blocking: true,
      },
      {
        field: "catalog.Cordón de flechas",
        recommendation: "Crear o importar primero una entrada oficial 2014 en español.",
        reason: "El conjuro no existe hoy en el catálogo de campaña.",
        blocking: true,
      },
    ],
  },
  {
    status: "pending",
    name: "Draven Korr",
    source: {
      documentId: CAMPAIGN_DOCUMENT_ID,
      tabId: "t.z7fu61spitpl",
      rules: [PHB, XGE, TCE],
    },
    identity: {
      className: "Artífice",
      subclass: "Armero",
      species: "Humano variante",
      subrace: "",
      background: "Ingeniero de campo (trasfondo personalizado)",
      level: 7,
      experience: 23000,
      alignment: "Neutral bueno (provisional)",
    },
    abilities: {
      strength: 10,
      dexterity: 14,
      constitution: 16,
      intelligence: 20,
      wisdom: 12,
      charisma: 8,
    },
    combat: {
      proficiencyBonus: 3,
      armorClass: 20,
      sourceArmorClass: 20,
      maximumHitPoints: 59,
      hitDice: "7d8",
      initiative: 2,
      speedFeet: 35,
      spellcastingAbility: "intelligence",
      spellSaveDc: 16,
      spellAttackBonus: 8,
    },
    savingThrows: ["constitution", "intelligence"],
    skills: {
      arcana: { ability: "intelligence", proficiency: 1, expectedBonus: 8 },
      investigation: { ability: "intelligence", proficiency: 1, expectedBonus: 8 },
      history: { ability: "intelligence", proficiency: 1, expectedBonus: 8 },
      perception: { ability: "wisdom", proficiency: 1, expectedBonus: 4 },
      insight: { ability: "wisdom", proficiency: 1, expectedBonus: 4 },
    },
    proficiencies: {
      armor: ["Armadura ligera", "Armadura media", "Escudos", "Armadura pesada (Armero)"],
      weapons: ["Armas simples", "Ballesta de mano"],
      tools: [
        "Herramientas de ladrón",
        "Herramientas de manitas",
        "Herramientas de herrero",
        "Herramientas de cartógrafo",
        "Herramientas de alquimista",
      ],
      languages: ["Común", "Enano", "Aeloriano técnico (personalizado)"],
    },
    actions: [
      {
        name: "Lanzarrayos",
        attackBonus: 8,
        damage: "1d6+5 relámpago; +1d6 una vez por turno",
        note: "Valor sin Arma mejorada. Con esa infusión sería +9 y 1d6+6, más el d6 adicional una vez por turno.",
      },
      {
        name: "Pistola repetidora experimental (Ballesta de mano +1)",
        attackBonus: 6,
        damage: "1d6+3 perforante",
        note: "Usa Destreza, no Inteligencia. Se utiliza como respaldo con el escudo guardado para disponer de una mano libre.",
      },
      {
        name: "Destello de genio",
        note: "Reacción; 5 usos por descanso largo con Inteligencia 20.",
      },
    ],
    traitGroups: {
      "Humano variante": ["Competencia en una habilidad", "Dote a nivel 1"],
      "Ingeniero de campo": ["Genio técnico", "Contactos de la Orden Carmesí"],
      Artífice: [
        "Retoques mágicos",
        "Lanzamiento de conjuros",
        "Infundir objeto",
        "La herramienta adecuada para el trabajo",
        "Pericia con herramientas",
        "Destello de genio",
      ],
      Armero: [
        "Herramientas del oficio",
        "Conjuros de armero",
        "Armadura arcana",
        "Modelo de armadura: Infiltrador",
        "Ataque adicional",
      ],
      Dote: ["Experto en ballestas"],
    },
    spellcasting: {
      slots: { "1": 4, "2": 3, "3": 0, "4": 0 },
      classCantripLimit: 2,
      ordinarySpellLimit: 8,
      spells: [
        spell("Reparar", 0, "class", "official:spell:es:de2f74c80daffbd35e43b18e"),
        spell("Agarre electrizante", 0, "class", "official:spell:es:f72474e5fe4cbcd286cbbfd5"),
        spell("Absorber elementos", 1, "class", "official:spell:es:9ab49538f9e34f26cc795ecb", XGE),
        spell("Detectar magia", 1, "class", "official:spell:es:ef1e3dffae282037b6bbc0f1"),
        spell("Curar heridas", 1, "class", "official:spell:es:5e73ba9554d774b5b023cf59"),
        spell("Identificar", 1, "class", "official:spell:es:d570b51df92902cf95b1e467"),
        spell("Alarma", 1, "class", "official:spell:es:fe7212c4f2816a27a886f632"),
        spell("Calentar metal", 2, "class", "official:spell:es:601198d144c1371244e605c2"),
        spell("Aumentar característica", 2, "class", "official:spell:es:4e8dcf105f86dc7b8a5a8341"),
        spell("Restablecimiento menor", 2, "class", "official:spell:es:4129cb9dba3216aec379e4b9"),
        spell("Proyectil mágico", 1, "subclass", "official:spell:es:e3ce83d42cc28ee88094e0ad"),
        spell("Onda atronadora", 1, "subclass", "official:spell:es:24a544ec033ad163e9ae88c6"),
        spell("Imagen múltiple", 2, "subclass", "official:spell:es:d8de3dc118f8ad60c0287344"),
        spell("Shatter", 2, "subclass", "official:spell:eng:6228f945d7402e418ec23aea"),
      ],
    },
    inventory: [
      item("Armadura de campo Korr", 1, null, "La base e infusiones están bloqueadas hasta resolver la configuración mecánica."),
      item("Escudo", 1, "official:equipment:es:96c340ebc10ebfe92ec7d74d"),
      item("Pistola repetidora experimental (Ballesta de mano +1)", 1, "official:equipment:es:3655000d40ec225ab7ef1d58"),
      item("Monóculo analítico", 1),
      item("Bolsa conservadora (Bolsa de contención replicada)", 1),
      item("Herramientas de herrero"),
      item("Herramientas de manitas"),
      item("Herramientas de cartógrafo"),
      item("Herramientas de alquimista"),
      item("Kit de exploración de ruinas"),
      item("Tienda individual"),
      item("Raciones (1 día)", 15, "official:equipment:es:d915713ec2c391e5dcf80714"),
      item("Catalejo", 1, "official:equipment:es:1979314dd959de4052e3f286"),
      item("Brújula"),
      item("Linterna protegida"),
      item("Mapa de la región"),
      item("Cuaderno de investigación"),
      item("Instrumentos de medición"),
      item("Cristales de reserva"),
      item("Fuego del alquimista (frasco)", 3, "official:equipment:es:e2c6fc0f3a4001fca0154c52"),
      item("Vial de ácido", 4, "official:equipment:es:2d32f4a1dfeb0a52c48095f1"),
      item("Bomba incendiaria experimental", 2),
      item("Núcleo luciente fragmentado", 1, null, "Objeto narrativo sin bonificación mecánica definida."),
    ],
    notes: [
      "La clase Artífice y la subclase Armero no pertenecen al Manual del Jugador 2014.",
      "Pericia con herramientas explica +11 con herramientas basadas en Inteligencia, no +11 en Arcano o Investigación.",
      "El daño base del Lanzarrayos es 1d6+modificador y suma otro 1d6 una vez por turno; no 2d6 más otro d6.",
    ],
    corrections: [
      "Arcano e Investigación son +8, no +11, salvo una fuente adicional de pericia.",
      "La Ballesta de mano +1 ataca con Destreza: +6 y 1d6+3, no +9 y 1d6+6.",
      "Los conjuros de Armero de nivel 2 son Imagen múltiple y Shatter; Inmovilizar persona no corresponde.",
      "A nivel 7 se preparan 8 conjuros ordinarios con Inteligencia 20; la fuente solo enumeraba 6.",
      "Una misma Armadura arcana no puede sostener simultáneamente Armadura mejorada y Arma mejorada antes del nivel 9.",
      "Un objeto mágico existente no puede recibir una infusión de artífice.",
    ],
    decisions: [
      {
        field: "source.rules.armorer",
        recommendation: "Añadir Tasha como fuente autorizada antes de cerrar el personaje.",
        reason: "El manual suministrado no contiene Artífice/Armero ni sus infusiones.",
        blocking: true,
      },
      {
        field: "combat.armorClassAndInfusions",
        recommendation: "Elegir entre CA 20 con Sigilo normal, o CA 19 con ventaja en Sigilo; documentar la base exacta de la armadura.",
        reason: "CA 20, ventaja en Sigilo, escudo y ambas infusiones sobre la armadura no son simultáneamente válidos a nivel 7.",
        blocking: true,
      },
      {
        field: "actions.handCrossbow",
        recommendation: "Dejar la pistola como respaldo con el escudo guardado, o reemplazar una infusión por Disparo repetido.",
        reason: "Experto en ballestas elimina Carga, pero no la necesidad de una mano libre para Munición.",
        blocking: true,
      },
      {
        field: "spellcasting.preparedSpells",
        recommendation: "Usar provisionalmente Alarma y Restablecimiento menor como los dos preparados faltantes.",
        reason: "La lista ordinaria debe contener 8 preparados.",
        blocking: true,
      },
      {
        field: "identity.backgroundLanguagesAlignment",
        recommendation: "Confirmar el trasfondo personalizado, sus competencias, idiomas y alineamiento.",
        reason: "La fuente narrativa no asigna estas elecciones regladas.",
        blocking: true,
      },
      {
        field: "catalog.armorerContent",
        recommendation: "Crear contenido personalizado en español solo después de aprobar la fuente de reglas.",
        reason: "El catálogo no contiene la clase, infusiones, Bolsa de contención ni Monóculo analítico como entradas reutilizables verificadas.",
        blocking: true,
      },
    ],
  },
  {
    status: "pending",
    name: "Maelion Vaelaris",
    source: {
      documentId: CAMPAIGN_DOCUMENT_ID,
      tabId: "t.3vku63g53u9",
      rules: [PHB],
    },
    identity: {
      className: "Bardo",
      subclass: "Colegio del Saber",
      species: "Elfo",
      subrace: "Drow",
      background: "Sabio",
      level: 7,
      experience: 23000,
      alignment: "Neutral bueno (provisional)",
    },
    abilities: {
      strength: 8,
      dexterity: 16,
      constitution: 14,
      intelligence: 14,
      wisdom: 12,
      charisma: 20,
    },
    combat: {
      proficiencyBonus: 3,
      armorClass: 16,
      sourceArmorClass: 17,
      maximumHitPoints: 52,
      hitDice: "7d8",
      initiative: 3,
      speedFeet: 30,
      spellcastingAbility: "charisma",
      spellSaveDc: 16,
      spellAttackBonus: 8,
    },
    savingThrows: ["dexterity", "charisma"],
    skills: {
      history: { ability: "intelligence", proficiency: 2, expectedBonus: 8 },
      investigation: { ability: "intelligence", proficiency: 2, expectedBonus: 8 },
      arcana: { ability: "intelligence", proficiency: 1, expectedBonus: 5 },
      persuasion: { ability: "charisma", proficiency: 1, expectedBonus: 8 },
      insight: { ability: "wisdom", proficiency: 1, expectedBonus: 4 },
      perception: { ability: "wisdom", proficiency: 1, expectedBonus: 4 },
      deception: { ability: "charisma", proficiency: 1, expectedBonus: 8 },
      performance: { ability: "charisma", proficiency: 1, expectedBonus: 8 },
    },
    proficiencies: {
      armor: ["Armadura ligera"],
      weapons: ["Armas simples", "Ballesta de mano", "Espada larga", "Estoque", "Espada corta"],
      tools: ["Laúd", "Flauta", "Lira"],
      languages: ["Común", "Élfico", "Infracomún", "Aeloriano (personalizado)"],
    },
    actions: [
      {
        name: "Luz de Penumbra (Estoque +1)",
        attackBonus: 7,
        damage: "1d8+4 perforante",
        note: "Arma sutil; usa Destreza.",
      },
      {
        name: "Palabras cortantes",
        note: "Reacción; consume Inspiración bárdica para reducir una tirada válida de otra criatura.",
      },
      {
        name: "Líder inspirador",
        note: "Tras 10 minutos, hasta 6 criaturas obtienen 12 PG temporales; una vez por descanso por criatura.",
      },
    ],
    traitGroups: {
      Drow: [
        "Visión en la oscuridad superior",
        "Sensibilidad a la luz solar",
        "Linaje feérico",
        "Trance",
        "Magia drow",
        "Entrenamiento con armas drow",
      ],
      Sabio: ["Investigador"],
      Bardo: [
        "Inspiración bárdica d8",
        "Aprendiz de todo",
        "Canción de descanso d6",
        "Pericia",
        "Fuente de inspiración",
        "Contraencantamiento",
      ],
      "Colegio del Saber": ["Competencias adicionales", "Palabras cortantes", "Secretos mágicos adicionales"],
      Dote: ["Líder inspirador"],
    },
    spellcasting: {
      slots: { "1": 4, "2": 3, "3": 3, "4": 1 },
      classCantripLimit: 3,
      ordinarySpellLimit: 10,
      spells: [
        spell("Burla dañina", 0, "class", "official:spell:es:4f744aff5a3ae3e255d0add7"),
        spell("Ilusión menor", 0, "class", "official:spell:es:10fcc61bf9dabe4ea099f8b4"),
        spell("Mano de mago", 0, "class", "official:spell:es:782c9308485f7a903ed08012"),
        spell("Luces danzantes", 0, "racial", "official:spell:es:da632510a4c737ad7c6a7e67"),
        spell("Palabra de curación", 1, "class", "official:spell:es:5f862760550cff0fe132a9ed"),
        spell("Detectar magia", 1, "class", "official:spell:es:ef1e3dffae282037b6bbc0f1"),
        spell("Susurros disonantes", 1, "class", "official:spell:es:266ff3e447a636b492a43f5e"),
        spell("Identificar", 1, "class", "official:spell:es:d570b51df92902cf95b1e467"),
        spell("Sugestión", 2, "class", "official:spell:es:aa3bf8679994689763e0e818"),
        spell("Calmar emociones", 2, "class", "official:spell:es:230c0980746351253caaea1e"),
        spell("Invisibilidad", 2, "class", "official:spell:es:f90247dd36da5748fe900398"),
        spell("Disipar magia", 3, "class", "official:spell:es:378da7d8fc10efb728801895"),
        spell("Patrón hipnótico", 3, "class", "official:spell:es:04159cd22db9653c1b1e8a0f"),
        spell("Puerta dimensional", 4, "class", "official:spell:es:22f5ed12ae5665807a094fd6"),
        spell("Contrahechizo", 3, "magical-secret", "official:spell:es:37178e3e401385b3c8786746"),
        spell("Espíritus guardianes", 3, "magical-secret", "official:spell:es:60f1f150a85848906b66a70a"),
        spell("Fuego feérico", 1, "racial", "official:spell:es:77d95774eeadb76a9986ccd6"),
        spell("Oscuridad", 2, "racial", "official:spell:es:f2b0fb3cdae904eca65dfe4d"),
      ],
    },
    inventory: [
      item("Laúd de los Ecos Profundos (Laúd de Doss)", 1),
      item("Cuero tachonado +1", 1, "official:equipment:es:55c9bbc182e669a1be9867a5"),
      item("Luz de Penumbra (Estoque +1)", 1, "official:equipment:es:a0dc88a77af046734ca56e1d"),
      item("Perla de poder", 1, "official:equipment:es:7315505b374dfa1d4dcb8e49"),
      item("Diario de campo de Vaelaris"),
      item("Kit de calígrafo"),
      item("Kit de cartógrafo"),
      item("Colección de tintas especiales"),
      item("Papel impermeabilizado"),
      item("Estuche para documentos"),
      item("Pieles para clima extremo"),
      item("Catalejo", 1, "official:equipment:es:1979314dd959de4052e3f286"),
      item("Cuerda de seda (50 pies)", 1, "official:equipment:es:b55296bd6257b7ae74153624"),
      item("Mapa regional"),
      item("Brújula"),
      item("Raciones (1 día)", 15, "official:equipment:es:d915713ec2c391e5dcf80714"),
      item("Cantimplora reforzada", 1, "official:equipment:es:240e4ce5f914087a513da6a2"),
      item("Manta térmica"),
      item("Linterna de cristal luciente drow"),
      item("Fragmento de cristal luciente negro", 1, null, "Objeto narrativo sin propiedades mecánicas."),
    ],
    notes: [
      "Prestidigitación queda como candidato excluido porque Bardo 7 conoce solo 3 trucos de clase; Luces danzantes es racial.",
      "Fuente de inspiración recupera los 5 usos de Inspiración bárdica en descanso corto o largo.",
      "La reasignación de competencias conserva las ocho habilidades de la fuente sin duplicar Arcano entre Sabio y Colegio del Saber.",
    ],
    corrections: [
      "Cuero tachonado +1 con Destreza 16 da CA 16, no 17.",
      "Historia e Investigación con Pericia son +8; Arcano +5; Persuasión, Engaño e Interpretación +8; Perspicacia y Percepción +4.",
      "El Drow también tiene Luces danzantes, Sensibilidad a la luz solar y Entrenamiento con armas drow.",
      "Bardo 7 conoce 3 trucos y 10 conjuros ordinarios; faltaba elegir un conjuro ordinario, incluido uno para el espacio de nivel 4.",
      "El Laúd de Doss oficial es poco común y no concede +2 a ataques de conjuro.",
    ],
    decisions: [
      {
        field: "combat.armorClass",
        recommendation: "Usar CA 16; para mantener 17 se necesita declarar otra bonificación real.",
        reason: "12 + Destreza 3 + magia 1 = 16.",
        blocking: true,
      },
      {
        field: "spellcasting.classCantrips",
        recommendation: "Conservar Burla dañina, Ilusión menor y Mano de mago; excluir Prestidigitación.",
        reason: "Bardo 7 conoce 3 trucos de clase, además del truco racial Luces danzantes.",
        blocking: true,
      },
      {
        field: "spellcasting.level4Choice",
        recommendation: "Añadir Puerta dimensional como décimo conjuro ordinario.",
        reason: "La fuente enumera 9 conjuros ordinarios y ninguno de nivel 4.",
        blocking: true,
      },
      {
        field: "inventory.lute",
        recommendation: "Usar un Laúd de Doss oficial renombrado, poco común y sin +2 a ataques.",
        reason: "La rareza y el bonificador descritos no pertenecen al objeto oficial de referencia.",
        blocking: true,
      },
      {
        field: "identity.backgroundLanguagesAlignment",
        recommendation: "Usar Sabio, los idiomas provisionales y alineamiento Neutral bueno.",
        reason: "La fuente no asigna formalmente estas elecciones.",
        blocking: true,
      },
      {
        field: "catalog.doss",
        recommendation: "Crear el Laúd de Doss como contenido personalizado solo tras aprobar el borrador.",
        reason: "Fuego feérico y Oscuridad sí tienen entradas oficiales reutilizables; el Laúd de Doss no.",
        blocking: true,
      },
    ],
  },
] as const satisfies readonly PendingCharacterBlueprint[];
