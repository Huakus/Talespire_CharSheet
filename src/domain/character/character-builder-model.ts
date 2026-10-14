import { RangerChoicesSchema } from "./ranger-model";
import { DruidChoicesSchema } from "./druid-model";
import { BardChoicesSchema } from "./bard-model";
import { BarbarianChoicesSchema } from "./barbarian-model";
import { z } from "zod";
import { STABLE_ID_PATTERN } from "../../shared/id";
import { SKILL_DEFINITIONS } from "./character-checks";
import { WarlockChoicesSchema } from "./warlock-model";
import { RogueChoicesSchema } from "./rogue-model";
import { ClericChoicesSchema } from "./cleric-model";

export const BUILDER_ABILITIES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;
export const BuilderScoresSchema = z.object(Object.fromEntries(BUILDER_ABILITIES.map((key) => [key, z.number().int().min(0).max(20)])) as Record<typeof BUILDER_ABILITIES[number], z.ZodNumber>);
export const FightingStyleSchema = z.enum(["archery", "defense", "dueling", "great-weapon", "protection", "two-weapon"]);
const SkillSchema = z.enum(Object.keys(SKILL_DEFINITIONS) as [keyof typeof SKILL_DEFINITIONS, ...Array<keyof typeof SKILL_DEFINITIONS>]);
const StableId = z.string().regex(STABLE_ID_PATTERN);
export const RaceKeySchema = z.enum(["human", "human-variant", "hill-dwarf", "mountain-dwarf", "lightfoot-halfling", "stout-halfling", "half-orc", "high-elf", "wood-elf", "drow", "dragonborn", "forest-gnome", "rock-gnome", "half-elf", "tiefling"]);
export const BackgroundKeySchema = z.enum(["acolyte", "charlatan", "criminal", "spy", "entertainer", "gladiator", "folk-hero", "guild-artisan", "guild-merchant", "hermit", "noble", "knight", "outlander", "sage", "sailor", "pirate", "soldier", "urchin"]);
export const FighterSubclassSchema = z.enum(["champion", "battle-master", "eldritch-knight", "arcane-archer", "cavalier", "samurai"]);
export const WizardSchoolSchema = z.enum(["abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation", "war-magic"]);
export const WizardSpellChoicesSchema = z.object({
  cantrips: z.array(z.string()).max(3).default([]),
  learn: z.array(z.string()).max(6).default([]),
  prepared: z.array(z.string()).max(30).nullable().default(null),
  bonusCantrip: z.string().default(""),
  mastery: z.array(z.string()).max(2).default([]),
  signature: z.array(z.string()).max(2).default([]),
}).prefault({});
export const FeatKeySchema = z.enum(["actor", "alert", "athlete", "charger", "crossbow-expert", "defensive-duelist", "dual-wielder", "dungeon-delver", "durable", "elemental-adept", "grappler", "great-weapon-master", "healer", "heavily-armored", "heavy-armor-master", "inspiring-leader", "keen-mind", "lightly-armored", "linguist", "lucky", "mage-slayer", "magic-initiate", "martial-adept", "medium-armor-master", "mobile", "moderately-armored", "mounted-combatant", "observant", "polearm-master", "resilient", "ritual-caster", "savage-attacker", "sentinel", "sharpshooter", "shield-master", "skilled", "skulker", "spell-sniper", "tavern-brawler", "tough", "war-caster", "weapon-master", "bountiful-luck", "dragon-fear", "dragon-hide", "drow-high-magic", "dwarven-fortitude", "elven-accuracy", "fade-away", "fey-teleportation", "flames-of-phlegethos", "infernal-constitution", "orcish-fury", "prodigy", "second-chance", "squat-nimbleness", "wood-elf-magic"]);
export const FeatChoiceSchema = z.object({
  key: FeatKeySchema,
  expertise: SkillSchema.nullable().default(null),
  ability: z.enum(BUILDER_ABILITIES).nullable().default(null),
  skills: z.array(SkillSchema).max(3).default([]), tools: z.array(z.string().trim().min(1)).max(3).default([]),
  languages: z.array(z.string().trim().min(1)).max(3).default([]),
  spells: z.array(z.string().min(1)).max(3).default([]),
  spellClass: z.enum(["bard", "cleric", "druid", "sorcerer", "warlock", "wizard"]).nullable().default(null),
  damageType: z.enum(["acid", "cold", "fire", "lightning", "thunder"]).nullable().default(null),
  maneuvers: z.array(z.string().min(1)).max(2).default([]),
  weapons: z.array(z.string().min(1)).max(4).default([]),
});
export const OriginChoicesSchema = z.object({
  abilities: z.array(z.enum(BUILDER_ABILITIES)).max(2).default([]),
  skills: z.array(SkillSchema).max(2).default([]),
  cantrip: z.string().default(""),
  ancestry: z.enum(["black", "blue", "brass", "bronze", "copper", "gold", "green", "red", "silver", "white"]).nullable().default(null),
}).prefault({});
export const FighterMagicChoiceSchema = z.object({
  cantrips: z.array(z.string().min(1)).max(2).default([]),
  learn: z.array(z.object({ key: z.string().min(1), unrestricted: z.boolean() })).max(3).default([]),
  replace: z.object({ oldKey: z.string().min(1), newKey: z.string().min(1) }).nullable().default(null),
}).prefault({});

export const FighterCreationSchema = z.object({
  classKey: z.enum(["fighter", "wizard", "warlock", "cleric", "rogue", "barbarian", "bard", "druid", "ranger"]).default("fighter"),
  name: z.string().trim().min(1).max(100),
  playerName: z.string().trim().max(100).default(""),
  race: RaceKeySchema,
  abilityMethod: z.enum(["standard-array", "point-buy", "rolled"]),
  startingLevel: z.number().int().min(1).max(20).default(1),
  allowFeats: z.boolean().default(true),
  origin: OriginChoicesSchema,
  initialFeat: FeatChoiceSchema.nullable().default(null),
  alignment: z.string().max(80).default(""),
  appearance: z.string().max(1000).default(""),
  personalTraits: z.array(z.string().max(500)).max(2).default([]),
  ideal: z.string().max(500).default(""), bond: z.string().max(500).default(""), flaw: z.string().max(500).default(""),
  baseAbilities: BuilderScoresSchema,
  skills: z.array(SkillSchema).min(2).max(4),
  racialSkillReplacement: SkillSchema.nullable().default(null),
  languages: z.array(z.string().trim().min(1).max(60)).max(2),
  dwarfTool: z.enum(["smith", "brewer", "mason"]).nullable(),
  background: z.object({
    name: z.string().trim().min(1).max(100),
    skills: z.array(SkillSchema).length(2),
    tools: z.array(z.string().trim().min(1).max(80)).max(2),
    languages: z.array(z.string().trim().min(1).max(60)).max(2),
    featureName: z.string().trim().min(1).max(100),
    featureDescription: z.string().trim().min(1).max(1500),
    equipment: BackgroundKeySchema,
    prayerItem: z.enum(["prayer-book", "prayer-wheel"]).default("prayer-book"),
    gamingSet: z.enum(["dice", "cards"]).default("dice"),
    selections: z.array(z.string().min(1)).max(5).default([]),
  }),
  style: FightingStyleSchema,
  equipment: z.object({
    armor: z.enum(["chain-mail", "leather"]),
    primary: z.string().min(1),
    secondary: z.string().min(1).nullable(),
    shield: z.boolean(),
    backup: z.enum(["crossbow", "handaxes"]),
    pack: z.enum(["dungeoneer", "explorer"]),
    method: z.enum(["packages", "gold"]).default("packages"),
    goldRoll: z.array(z.number().int().min(1).max(4)).min(2).max(5).default([2, 2, 2, 2, 2]),
    purchases: z.array(z.object({ key: z.string().min(1), quantity: z.number().int().min(1).max(100), equipped: z.boolean().default(false) })).max(100).default([]),
  }),
  personality: z.string().max(3000).default(""),
  wizard: WizardSpellChoicesSchema,
  wizardWeapon: z.enum(["dagger", "quarterstaff"]).default("quarterstaff"),
  wizardFocus: z.enum(["component-pouch", "crystal", "orb", "rod", "staff", "wand"]).default("component-pouch"),
  wizardPack: z.enum(["scholar", "explorer"]).default("scholar"),
  warlock: WarlockChoicesSchema,
  cleric: ClericChoicesSchema,
  rogue: RogueChoicesSchema,
  barbarian: BarbarianChoicesSchema,
  bard: BardChoicesSchema,
  druid: DruidChoicesSchema,
  ranger: RangerChoicesSchema,
  rangerArmor: z.enum(["scale-mail","leather"]).default("scale-mail"),
  rangerWeapons: z.array(z.string()).length(2).default(["shortsword","shortsword"]),
  rangerPack: z.enum(["dungeoneer","explorer"]).default("explorer"),
  druidPrimary: z.string().default("shield"),
  druidWeapon: z.string().default("scimitar"),
  druidFocus: z.enum(["sprig-of-mistletoe","totem","wooden-staff","yew-wand"]).default("sprig-of-mistletoe"),
  bardWeapon: z.string().default("rapier"),
  bardPack: z.enum(["diplomat","entertainer"]).default("diplomat"),
  bardInstrument: z.string().default("instrument-4"),
  barbarianWeapon: z.string().default("greataxe"),
  barbarianSecondary: z.string().default("two-handaxes"),
  rogueWeapon: z.enum(["rapier","shortsword"]).default("rapier"),
  rogueSecondary: z.enum(["shortbow","shortsword"]).default("shortbow"),
  roguePack: z.enum(["burglar","dungeoneer","explorer"]).default("burglar"),
  clericWeapon: z.enum(["mace","warhammer"]).default("mace"),
  clericArmor: z.enum(["scale-mail","leather","chain-mail"]).default("scale-mail"),
  clericSecondary: z.string().default("light-crossbow"),
  clericPack: z.enum(["priest","explorer"]).default("priest"),
  clericSymbol: z.enum(["amulet","emblem","reliquary"]).default("amulet"),
  warlockPrimary: z.string().default("light-crossbow"),
  warlockSecondary: z.string().default("mace"),
  warlockPack: z.enum(["scholar","dungeoneer"]).default("scholar"),
});

export const FighterLevelChoiceSchema = z.object({
  operationId: StableId,
  level: z.number().int().min(2).max(20),
  hpMethod: z.enum(["fixed", "rolled"]),
  hpBase: z.number().int().min(1).max(12),
  abilityIncrease: BuilderScoresSchema.nullable(),
  subclass: z.union([FighterSubclassSchema, WizardSchoolSchema]).nullable(),
  additionalStyle: FightingStyleSchema.nullable(),
  feat: FeatChoiceSchema.nullable().default(null),
  skipImprovement: z.boolean().default(false),
  maneuvers: z.array(z.string().min(1)).max(3).default([]),
  maneuverReplacement: z.object({ oldKey: z.string().min(1), newKey: z.string().min(1) }).nullable().default(null),
  artisanTool: z.string().default(""),
  magic: FighterMagicChoiceSchema,
  wizard: WizardSpellChoicesSchema,
  warlock: WarlockChoicesSchema,
  cleric: ClericChoicesSchema,
  rogue: RogueChoicesSchema,
  barbarian: BarbarianChoicesSchema,
  bard: BardChoicesSchema,
  druid: DruidChoicesSchema,
  ranger: RangerChoicesSchema,
  xanathar: z.object({ skill: z.string().default(""),language: z.string().default(""),cantrip: z.string().default(""),shots: z.array(z.string()).max(2).default([]),bonusSave: z.enum(["intelligence","charisma"]).nullable().default(null) }).prefault({}),
});

export const CharacterBuilderStateSchema = z.object({
  schemaVersion: z.literal(1),
  ruleset: z.literal("dnd5e-2014"),
  packageVersion: z.literal(1),
  classKey: z.enum(["fighter", "wizard", "warlock", "cleric", "rogue", "barbarian", "bard", "druid", "ranger"]),
  creationOperationId: StableId,
  creation: FighterCreationSchema,
  levels: z.array(FighterLevelChoiceSchema).max(19),
}).superRefine((state, context) => {
  if (state.creation.skills.length !== (state.classKey === "rogue" ? 4 : ["bard","ranger"].includes(state.classKey) ? 3 : 2)) context.addIssue({ code: "custom",message: "La cantidad de habilidades no coincide con la clase.",path: ["creation","skills"] });
  if (state.creation.classKey !== state.classKey) context.addIssue({ code: "custom", message: "La clase del origen no coincide con el historial.", path: ["creation", "classKey"] });
  const operations = new Set([state.creationOperationId]);
  const hasChoices = (value: Record<string,unknown>) => Object.values(value).some((entry) => Array.isArray(entry) ? entry.length > 0 : entry !== null && entry !== "" && entry !== false);
  for (const key of ["wizard","warlock","cleric","rogue","barbarian","bard","druid","ranger"] as const) if (key !== state.classKey && hasChoices(state.creation[key])) context.addIssue({ code: "custom",message: "Hay elecciones de otra clase en la creación.",path: ["creation",key] });
  state.levels.forEach((step, index) => {
    if (step.level !== index + 2 || operations.has(step.operationId)) context.addIssue({ code: "custom", message: "Historial de niveles inválido o duplicado.", path: ["levels", index] });
    operations.add(step.operationId);
    for (const key of ["wizard","warlock","cleric","rogue","barbarian","bard","druid","ranger"] as const) if (key !== state.classKey && hasChoices(step[key])) context.addIssue({ code: "custom",message: "Este nivel contiene elecciones de otra clase.",path: ["levels",index,key] });
    if (state.classKey !== "fighter" && hasChoices(step.xanathar)) context.addIssue({ code: "custom",message: "Las elecciones de arquetipo marcial requieren Guerrero.",path: ["levels",index,"xanathar"] });
  });
});

export type FighterCreation = z.infer<typeof FighterCreationSchema>;
export type FighterCreationInput = z.input<typeof FighterCreationSchema>;
export type FighterLevelChoice = z.infer<typeof FighterLevelChoiceSchema>;
export type FighterLevelChoiceInput = z.input<typeof FighterLevelChoiceSchema>;
export type FeatChoice = z.infer<typeof FeatChoiceSchema>;
export type FighterSubclass = z.infer<typeof FighterSubclassSchema>;
export type WizardSchool = z.infer<typeof WizardSchoolSchema>;
export type CharacterBuilderState = z.infer<typeof CharacterBuilderStateSchema>;
export type FightingStyle = z.infer<typeof FightingStyleSchema>;
