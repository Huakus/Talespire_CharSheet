import { CharacterV2Schema, type CharacterV2 } from "./character-v2";
import { CharacterBuilderStateSchema, FighterCreationSchema, FighterLevelChoiceSchema, WizardSchoolSchema, BUILDER_ABILITIES, type CharacterBuilderState, type FighterCreationInput, type FighterLevelChoiceInput } from "./character-builder-model";
import { validateBuilderOrigin, fighterBuilderScores, fighterBuilderMaximumHp, createBuilderCharacter, finishBuilderCreation } from "./fighter-builder";
import { validateFeat, distinct, builderFeats } from "./fighter-build-rules";
import { applyAdditionalFighterBenefits } from "./fighter-builder-grants";
import { WIZARD_SCHOOLS, WIZARD_SLOTS, WIZARD_ASI_LEVELS, WIZARD_SCHOOL_FEATURES, wizardCantripCount, wizardSchool,wizardTraditionName } from "./wizard-catalog";
import { PHB_SPELLS } from "./phb-spells";
import { WizardRuntimeSchema, type WizardRuntime } from "./wizard-model";
import { CharacterSpellV2Schema } from "./character-spell-model";
import { traitGroup, type TraitDefinition } from "./builder-traits";
import { abilityModifier, projectInventory, projectUpdatedBuilderSpeed, preferredWeaponAbility, projectAbilityScore } from "./character-projection";
import { createDeterministicId } from "../../shared/id";
import { canonicalJsonStringify, type JsonValue } from "../../shared/json";

export function wizardPreparationLimit(character: CharacterV2): number { return Math.max(1, character.identity.level + abilityModifier(projectAbilityScore(character,"intelligence"))); }
export function wizardSignature(state: CharacterBuilderState): string[] { return state.levels.find((step) => step.level === 20)?.wizard.signature ?? []; }
function validateSpells(keys: string[], count: number, min: number, max: number, known: string[] = []): void {
  if (keys.length !== count || !distinct([...known,...keys]) || keys.some((key) => !PHB_SPELLS[key]?.classes.includes("wizard") || PHB_SPELLS[key]!.level < min || PHB_SPELLS[key]!.level > max)) throw new Error(`Elegí ${count} conjuros de mago distintos, de niveles ${min}–${max}, que todavía no hayas aprendido.`);
}
function validatePrepared(keys: string[] | null, book: string[], scores: ReturnType<typeof fighterBuilderScores>, level: number, signature: string[] = []): void {
  if (keys && (!distinct(keys) || keys.some((key) => !book.includes(key)) || keys.filter((key) => !signature.includes(key)).length > Math.max(1,level+abilityModifier(scores.intelligence)))) throw new Error("La preparación debe usar conjuros del libro y respetar el límite nivel de mago + INT (mínimo uno); los característicos no ocupan cupo.");
}
export function replayWizardChoices(state: CharacterBuilderState, copied: WizardRuntime["copied"] = []) {
  const creation = state.creation, school = wizardSchool(state);
  validateSpells(creation.wizard.cantrips,3,0,0);
  validateSpells(creation.wizard.learn,6,1,1);
  if (creation.wizard.bonusCantrip || creation.wizard.mastery.length || creation.wizard.signature.length) throw new Error("Estas elecciones de mago se adquieren en sus niveles de clase, no en nivel 1.");
  const initialFeatSpells = builderFeats({ ...state,levels: [] }).flatMap(({ feat }) => feat.key === "magic-initiate" && feat.spellClass === "wizard" ? feat.spells.filter((key) => PHB_SPELLS[key]?.level === 1) : []);
  const book = [...new Set([...creation.wizard.learn,...initialFeatSpells])], cantrips = [...creation.wizard.cantrips];
  validatePrepared(creation.wizard.prepared,book,fighterBuilderScores({ ...state, levels: [] }),1);
  for (const step of state.levels) {
    for (const entry of copied.filter((entry) => entry.level < step.level)) if (!book.includes(entry.key)) book.push(entry.key);
    validateSpells(step.wizard.learn,2,1,WIZARD_SLOTS[step.level]!.length,book);
    book.push(...step.wizard.learn);
    if (step.feat?.key === "magic-initiate" && step.feat.spellClass === "wizard") for (const key of step.feat.spells.filter((key) => PHB_SPELLS[key]?.level === 1)) if (!book.includes(key)) book.push(key);
    validateSpells(step.wizard.cantrips,wizardCantripCount(step.level)-wizardCantripCount(step.level-1),0,0,cantrips);
    cantrips.push(...step.wizard.cantrips);
    if (school === "illusion" && step.level === 2) {
      const other = [creation.origin.cantrip, creation.race === "forest-gnome" ? "minor-illusion" : "", ...builderFeats({ ...state, levels: state.levels.filter((s) => s.level < 2) }).flatMap(({ feat }) => feat.spells)];
      if ([...cantrips,...other].includes("minor-illusion")) { validateSpells([step.wizard.bonusCantrip],1,0,0,[...new Set([...cantrips,...other.filter((key) => PHB_SPELLS[key]?.level === 0)])]); cantrips.push(step.wizard.bonusCantrip); }
      else { if (step.wizard.bonusCantrip) throw new Error("Ilusión concede Ilusión menor automáticamente si todavía no lo conocés."); cantrips.push("minor-illusion"); }
    } else if (step.wizard.bonusCantrip) throw new Error("El truco adicional solo se elige al obtener Ilusión 2 si ya conocés Ilusión menor.");
    if (school === "necromancy" && step.level === 6 && !book.includes("animate-dead")) book.push("animate-dead");
    if (school === "transmutation" && step.level === 10 && !book.includes("polymorph")) book.push("polymorph");
    if (step.level === 18) {
      if (step.wizard.mastery.length !== 2 || step.wizard.mastery.some((key,i) => !book.includes(key) || PHB_SPELLS[key]?.level !== i+1)) throw new Error("Maestría requiere un conjuro de nivel 1 y otro de nivel 2 de tu libro, en ese orden.");
    } else if (step.wizard.mastery.length) throw new Error("Maestría de conjuros se elige en Mago 18.");
    if (step.level === 20) {
      if (step.wizard.signature.length !== 2 || !distinct(step.wizard.signature) || step.wizard.signature.some((key) => !book.includes(key) || PHB_SPELLS[key]?.level !== 3)) throw new Error("Conjuros característicos requiere dos conjuros distintos de nivel 3 de tu libro.");
    } else if (step.wizard.signature.length) throw new Error("Los conjuros característicos se eligen en Mago 20.");
    validatePrepared(step.wizard.prepared,book,fighterBuilderScores({ ...state, levels: state.levels.filter((s) => s.level <= step.level) }),step.level,step.wizard.signature);
  }
  for (const entry of copied) if (!book.includes(entry.key)) book.push(entry.key);
  return { book, cantrips };
}
export function validateWizardCreation(input: FighterCreationInput) {
  const creation = FighterCreationSchema.parse(input);
  if (creation.classKey !== "wizard") throw new Error("Este recorrido requiere la clase Mago.");
  validateBuilderOrigin(creation);
  validateSpells(creation.wizard.cantrips,3,0,0);
  validateSpells(creation.wizard.learn,6,1,1);
  return creation;
}
export function validateWizardBuild(input: CharacterBuilderState, copied: WizardRuntime["copied"] = []): CharacterBuilderState {
  const state = CharacterBuilderStateSchema.parse(input);
  if (state.classKey !== "wizard") throw new Error("El historial no corresponde a Mago.");
  validateWizardCreation(state.creation);
  if (!distinct(copied.map((entry) => entry.operationId)) || copied.some((entry) => entry.level > state.levels.length+1 || !PHB_SPELLS[entry.key]?.classes.includes("wizard") || PHB_SPELLS[entry.key]!.level < 1 || PHB_SPELLS[entry.key]!.level > WIZARD_SLOTS[entry.level]!.length)) throw new Error("El historial de copia contiene conjuros o niveles que no corresponden a este mago.");
  for (const [i,step] of state.levels.entries()) {
    if (step.hpBase > 6 || step.hpMethod === "fixed" && step.hpBase !== 4) throw new Error("Mago usa 4 PG fijos o un resultado de d6, antes de Constitución.");
    if ((step.level === 2) !== (step.subclass !== null) || step.subclass && !WizardSchoolSchema.safeParse(step.subclass).success) throw new Error("Elegí una tradición arcana del Manual 2014 o Xanathar al adquirir Mago 2.");
    if (step.additionalStyle || step.maneuvers.length || step.maneuverReplacement || step.artisanTool || step.magic.cantrips.length || step.magic.learn.length || step.magic.replace) throw new Error("Mago no concede estilos, maniobras ni elecciones de Caballero arcano.");
    if (WIZARD_ASI_LEVELS.includes(step.level)) {
      if (step.skipImprovement) { if (step.feat || step.abilityIncrease) throw new Error("Renunciar a la mejora requiere dejar sus elecciones vacías."); }
      else if (step.feat) {
        if (step.abilityIncrease) throw new Error("Elegí dote o mejora, no ambas.");
        validateFeat(step.feat,fighterBuilderScores({ ...state, levels: state.levels.slice(0,i) }),{ ...state, levels: state.levels.slice(0,i) });
      } else if (!step.abilityIncrease || Object.values(step.abilityIncrease).reduce((a,b) => a+b,0) !== 2 || Object.values(step.abilityIncrease).some((n) => n > 2)) throw new Error("Distribuí dos puntos de atributo o elegí una dote permitida.");
    } else if (step.feat || step.abilityIncrease || step.skipImprovement) throw new Error("Este nivel de mago no concede mejora de atributos ni dote.");
    if (Object.values(fighterBuilderScores({ ...state, levels: state.levels.slice(0,i+1) })).some((n) => n > 20)) throw new Error("Una mejora no puede superar 20.");
  }
  replayWizardChoices(state,copied);
  return state;
}

export async function applyWizardBenefits(input: CharacterV2, previous: CharacterV2 | null = null): Promise<CharacterV2> {
  let character = CharacterV2Schema.parse(input);
  const state = character.builder!, level = character.identity.level, school = wizardSchool(state), oldRuntime = character.spellcasting.wizard;
  const replay = replayWizardChoices(state,oldRuntime?.copied), oldBook = previous?.spellcasting.wizard?.book;
  const runtime = WizardRuntimeSchema.parse(oldRuntime ?? {});
  if (school === "war-magic" && level >= 6 && (previous?.identity.level === 5 || !oldRuntime)) runtime.powerSurges = 1;
  if (!oldRuntime) {
    runtime.book = [...replay.book];
    runtime.bookAvailable = character.inventory.some((item) => /^(spellbook|libro de conjuros)$/i.test(item.name));
  } else {
    const oldReplay = previous?.builder ? replayWizardChoices(previous.builder,previous.spellcasting.wizard?.copied) : null;
    runtime.book = [...new Set([...(oldBook ?? runtime.book), ...replay.book.filter((key) => !oldReplay?.book.includes(key))])];
    if (school === "necromancy" && level === 6 && previous?.identity.level === 5 && !runtime.book.includes("animate-dead")) runtime.book.push("animate-dead");
    if (school === "transmutation" && level === 10 && previous?.identity.level === 9 && !runtime.book.includes("polymorph")) runtime.book.push("polymorph");
  }
  if (level === 18 && previous?.identity.level === 17 || !oldRuntime && level >= 18) runtime.mastery = [...state.levels.find((s) => s.level === 18)!.wizard.mastery];
  if (runtime.activeBookId) { const book = runtime.backups.find((b) => b.id === runtime.activeBookId); if (book) book.keys = [...runtime.book]; }
  const definitions: TraitDefinition[] = [
    { key: "spellcasting", name: "Lanzamiento de conjuros de mago", description: "Inteligencia; libro inicial con seis conjuros de nivel 1 y tres trucos. Aprendés dos conjuros por nivel de mago, hasta el nivel de tus espacios. Los trucos de clase no se sustituyen en PHB 2014. Prepará hasta nivel de mago + INT (mínimo uno) tras descanso largo, estudiando al menos un minuto por nivel de cada conjuro preparado." },
    { key: "ritual", name: "Lanzamiento ritual y foco arcano", description: "Rituales de mago en tu libro disponible: no necesitan preparación ni espacio y añaden diez minutos. Podés usar foco arcano o bolsa de componentes; componentes con precio o consumidos se aportan específicamente. Sin competencia en una armadura o escudo equipado no podés lanzar conjuros." },
    { key: "spellbook", name: "Tu libro de conjuros", description: "Copiar otro libro: dos horas y 50 po por nivel; requiere un nivel que puedas preparar y acceso al texto. Copiar notación propia: una hora y 10 po por nivel. Sin libro, reconstruís solo los conjuros preparados de memoria; el resto debe recuperarse de otra fuente. Las dos incorporaciones de cada nivel son gratuitas. Los pergaminos requieren además la prueba y resolución de mesa correspondientes." },
    { key: "arcane-recovery", name: "Recuperación arcana", description: `Una vez por día, al terminar descanso corto, recuperá espacios gastados por hasta ${Math.ceil(level/2)} niveles combinados; ningún espacio puede ser de nivel 6 o más.`, maximum: 1, reset: "long-rest" },
  ];
  if (school) {
    if (school !== "war-magic") definitions.push({ key: "savant", name: `Erudito en ${WIZARD_SCHOOLS[school]}`, description: "El coste y el tiempo para copiar conjuros de esta escuela al libro se reducen a la mitad." });
    definitions.push(...WIZARD_SCHOOL_FEATURES[school].filter((f) => f.level <= level));
  }
  if (level >= 18) definitions.push({ key: "spell-mastery", name: "Maestría de conjuros", description: "Un conjuro de nivel 1 y otro de nivel 2 del libro: si están preparados, podés lanzarlos a su nivel base sin espacio. Para elevarlos, gastás espacio normal. Ocho horas de estudio permiten intercambiar una o ambas elecciones por otras de los mismos niveles." });
  for (const key of wizardSignature(state)) definitions.push({ key: `signature-${key}`, name: `Conjuro característico: ${PHB_SPELLS[key]!.name}`, description: "Siempre preparado, sin ocupar cupo; un lanzamiento a nivel 3 sin espacio por descanso corto/largo. También podés gastar espacios normales, incluidos superiores.", maximum: 1, reset: "short-rest" });
  const group = await traitGroup(character,"wizard",`Mago · ${school ? WIZARD_SCHOOLS[school] : "PHB 2014"}`,definitions);
  definitions.forEach((definition,i) => { runtime.resourceIds[definition.key] = group.traits[i]!.id; runtime.resourceIds[definition.name] = group.traits[i]!.id; });
  character.traits = [...character.traits.filter((g) => g.id !== group.id),group];
  character.identity = { ...character.identity, className: "Mago", subclass: wizardTraditionName(school) };
  character.spellcasting.ability = "intelligence";
  for (let i=1; i<=9; i++) {
    const used = character.spellcasting.slots[String(i)]?.used ?? 0, maximum = WIZARD_SLOTS[level]![i-1] ?? 0;
    if (used > maximum) throw new Error("Los espacios gastados exceden la progresión de Mago; revisá sus cambios manuales antes de subir.");
    character.spellcasting.slots[String(i)] = { maximum, used };
  }
  const decisions = level === 1 ? state.creation.wizard.prepared : state.levels.at(-1)!.wizard.prepared;
  const prepared = decisions ?? (previous ? character.spellcasting.spells.filter((s) => s.casting?.source === "builder:wizard" && s.level > 0 && s.prepared).map((s) => s.casting!.key!) : replay.book.slice(0,wizardPreparationLimit(character)));
  const generated = await Promise.all([...replay.cantrips,...replay.book].map(async (key) => {
    const id = await createDeterministicId("spl",character.id,"builder-spell","wizard",key), old = character.spellcasting.spells.find((s) => s.id === id), definition = PHB_SPELLS[key]!;
    return CharacterSpellV2Schema.parse({ id, name: definition.name, level: definition.level, order: old?.order ?? character.spellcasting.spells.length + [...replay.cantrips,...replay.book].indexOf(key), prepared: definition.level === 0 || prepared.includes(key) || wizardSignature(state).includes(key), definition: old?.definition ?? definition, casting: { source: "builder:wizard", key, ability: "intelligence", kind: "wizard", level: definition.level, traitId: null }, effect: old?.effect ?? { description: "", active: false } });
  }));
  character.spellcasting.spells = [...character.spellcasting.spells.filter((s) => s.casting?.source !== "builder:wizard"),...generated];
  character.spellcasting.wizard = runtime;
  return CharacterV2Schema.parse(character);
}

export async function createGuidedWizard(id: string, operationId: string, input: FighterCreationInput, createdAt: string, initialLevels: FighterLevelChoiceInput[] = []): Promise<CharacterV2> {
  const creation = validateWizardCreation(input), state = validateWizardBuild({ schemaVersion: 1, packageVersion: 1, ruleset: "dnd5e-2014", classKey: "wizard", creationOperationId: operationId, creation, levels: [] });
  let character = await applyWizardBenefits(await createBuilderCharacter(id,state,createdAt));
  if (initialLevels.length !== creation.startingLevel-1) throw new Error("Completá las elecciones de todos los niveles iniciales.");
  for (const step of initialLevels) character = await advanceGuidedWizard(character,step,createdAt);
  return finishBuilderCreation(character);
}
export async function advanceGuidedWizard(input: CharacterV2, choiceInput: FighterLevelChoiceInput, updatedAt: string): Promise<CharacterV2> {
  const character = CharacterV2Schema.parse(input), choice = FighterLevelChoiceSchema.parse(choiceInput);
  if (!character.builder || character.builder.classKey !== "wizard") throw new Error("Esta ficha no tiene historial guiado de Mago.");
  const previous = validateWizardBuild(character.builder,character.spellcasting.wizard?.copied);
  const old = previous.levels.find((s) => s.operationId === choice.operationId);
  if (old) { if (canonicalJsonStringify(old as unknown as JsonValue) !== canonicalJsonStringify(choice as unknown as JsonValue)) throw new Error("La operación ya se confirmó con otras elecciones."); return character; }
  const school = wizardSchool(previous), expectedSubclass = wizardTraditionName(school);
  if (choice.operationId === previous.creationOperationId || choice.level !== character.identity.level+1 || choice.level !== previous.levels.length+2 || character.identity.className !== "Mago" || character.identity.subclass !== expectedSubclass) throw new Error("La ficha cambió o el nivel no coincide con su historial de mago.");
  const scores = fighterBuilderScores(previous);
  if (BUILDER_ABILITIES.some((a) => character.abilities[a] !== scores[a])) throw new Error("Los atributos se editaron fuera del tutorial.");
  const next = validateWizardBuild({ ...previous, levels: [...previous.levels,choice] },character.spellcasting.wizard?.copied), abilities = fighterBuilderScores(next);
  const capstoneChoices = [...choice.wizard.mastery,...choice.wizard.signature];
  if (capstoneChoices.length && (!character.spellcasting.wizard?.bookAvailable || capstoneChoices.some((key) => ![...character.spellcasting.wizard!.book,...choice.wizard.learn].includes(key)))) throw new Error("Maestría y los conjuros característicos deben elegirse del libro disponible, incluidas las incorporaciones de este nivel.");
  const maximum = character.combat.hitPoints.maximum + fighterBuilderMaximumHp(next)-fighterBuilderMaximumHp(previous);
  const actions = await Promise.all(character.actions.map(async (action) => {
    const item = character.inventory.find((i) => i.id === action.inventoryItemId);
    if (!item?.weapon || !action.ability) return action;
    const generated = action.id === await createDeterministicId("act",character.id,"builder-weapon",item.id);
    const ability = generated && action.ability === preferredWeaponAbility(scores,item) ? preferredWeaponAbility(abilities,item) : action.ability;
    return { ...action, ability, damageBonus: action.damageExpression ? action.damageBonus + abilityModifier(abilities[ability])-abilityModifier(scores[action.ability]) : action.damageBonus };
  }));
  let result = CharacterV2Schema.parse({ ...character, builder: next, abilities, actions, revision: character.revision+1, metadata: { ...character.metadata, updatedAt }, identity: { ...character.identity, level: choice.level }, combat: { ...character.combat, hitPoints: { ...character.combat.hitPoints, maximum, current: Math.min(character.combat.hitPoints.current,maximum) }, hitDice: { ...character.combat.hitDice, maximum: choice.level, remaining: character.combat.hitDice.remaining+1, current: String(character.combat.hitDice.remaining+1), formula: `${choice.level}d6` } } });
  result = await applyAdditionalFighterBenefits(result,character);
  result = await applyWizardBenefits(result,character);
  result.combat.armorClass = projectInventory(result).calculatedArmorClass;
  result.combat.speed = projectUpdatedBuilderSpeed(character,result);
  return CharacterV2Schema.parse(result);
}
