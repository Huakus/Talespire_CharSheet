import { CharacterV2Schema,type CharacterV2 } from "./character-v2";
import { CharacterBuilderStateSchema,FighterCreationSchema,FighterLevelChoiceSchema,BUILDER_ABILITIES,type CharacterBuilderState,type FighterCreationInput,type FighterLevelChoiceInput } from "./character-builder-model";
import { validateBuilderOrigin,fighterBuilderScores,fighterBuilderMaximumHp,createBuilderCharacter,finishBuilderCreation } from "./fighter-builder";
import { validateFeat,builderFeats,distinct } from "./fighter-build-rules";
import { applyAdditionalFighterBenefits } from "./fighter-builder-grants";
import { PHB_SPELLS,classSpells } from "./phb-spells";
import { SORCERER_ORIGINS,SORCERER_CORE,SORCERER_FEATURES,SORCERER_KNOWN,METAMAGIC,DIVINE_SPELLS,sorcererOrigin,sorcererCantrips,sorcererSpellList } from "./sorcerer-catalog";
import { WIZARD_SLOTS,WIZARD_ASI_LEVELS } from "./wizard-catalog";
import { BUILDER_WEAPONS } from "./fighter-builder-catalog";
import { DRAGON_ANCESTRIES } from "./phb-character-options";
import { CharacterSpellV2Schema } from "./character-spell-model";
import { SorcererRuntimeSchema,type Metamagic } from "./sorcerer-model";
import { traitGroup,type TraitDefinition } from "./builder-traits";
import { abilityModifier,projectInventory,preferredWeaponAbility,projectUpdatedBuilderSpeed } from "./character-projection";
import { createDeterministicId } from "../../shared/id";
import { canonicalJsonStringify,type JsonValue } from "../../shared/json";
export const sorcererMaxSpellLevel = (level: number) => WIZARD_SLOTS[level]!.length;
export function sorcererFeatKnown(s: CharacterBuilderState) { return builderFeats(s).filter(({ feat }) => feat.key === "magic-initiate" && feat.spellClass === "sorcerer").flatMap(({ feat }) => feat.spells.filter((k) => PHB_SPELLS[k]?.level === 1)); }
export function replaySorcererChoices(state: CharacterBuilderState) {
  const first = state.creation.sorcerer,origin = first.origin;
  if (!origin) throw new Error("Elegí un origen de Hechicero en nivel 1.");
  if (origin === "draconic" ? !first.ancestry || first.affinity : first.ancestry || (origin === "divine-soul" ? !first.affinity : first.affinity)) throw new Error("Elegí ancestro solo para Linaje Dracónico y afinidad solo para Alma Divina.");
  const cantrips: string[] = [],spells: { key: string;bonus: "divine"|"shadow"|null }[] = [],metamagic: Metamagic[] = [];
  for (const [level,p] of [[1,first],...state.levels.map((s) => [s.level,s.sorcerer] as const)] as const) {
    if (level > 1 && (p.origin || p.ancestry || p.affinity)) throw new Error("El origen y su afinidad/ancestro se fijan en nivel 1.");
    const list = sorcererSpellList(state,1,sorcererMaxSpellLevel(level));
    if (p.replaceSpell) {
      const old = spells.find((s) => s.key === p.replaceSpell!.oldKey),eligible = old?.bonus === "divine" ? classSpells("cleric",1,sorcererMaxSpellLevel(level)) : list;
      if (!old || !eligible.includes(p.replaceSpell.newKey) || spells.some((s) => s.key === p.replaceSpell!.newKey)) throw new Error("Sustituí un conocido anterior por otro disponible sin repetir; el adicional de Alma Divina exige lista de Clérigo.");old.key = p.replaceSpell.newKey;
    }
    const bonus = origin === "divine-soul" && level === 1 ? DIVINE_SPELLS[first.affinity!] : origin === "shadow" && level === 3 ? "darkness" : null;
    if (bonus && !spells.some((s) => s.key === bonus)) spells.push({ key: bonus,bonus: origin === "shadow" ? "shadow" : "divine" });
    const quota = SORCERER_KNOWN[level]!-SORCERER_KNOWN[level-1]!,cantripQuota = sorcererCantrips(level)-(level === 1 ? 0 : sorcererCantrips(level-1));
    if (p.learn.length !== quota || !distinct(p.learn) || p.learn.some((k) => !list.includes(k) || spells.some((s) => s.key === k))) throw new Error(`Elegí ${quota} conjuros nuevos de Hechicero disponibles y distintos; los adicionales no ocupan cupo.`);
    if (p.cantrips.length !== cantripQuota || !distinct([...cantrips,...p.cantrips]) || p.cantrips.some((k) => !sorcererSpellList(state,0).includes(k))) throw new Error(`Elegí ${cantripQuota} trucos nuevos disponibles, distintos. No se sustituyen en reglas 2014.`);
    spells.push(...p.learn.map((key) => ({ key,bonus: null })));cantrips.push(...p.cantrips);
    const metaQuota = level === 3 ? 2 : [10,17].includes(level) ? 1 : 0;
    if (p.metamagic.length !== metaQuota || !distinct([...metamagic,...p.metamagic])) throw new Error(`Elegí ${metaQuota} opciones nuevas y distintas de Metamagia.`);metamagic.push(...p.metamagic);
  }
  return { origin,cantrips,spells,metamagic };
}
export function validateSorcererCreation(input: FighterCreationInput) {
  const c = FighterCreationSchema.parse(input);if (c.classKey !== "sorcerer") throw new Error("Este recorrido requiere Hechicero.");validateBuilderOrigin(c);
  if (c.equipment.method === "packages" && !BUILDER_WEAPONS[c.sorcererWeapon]?.weapon?.category.startsWith("simple")) throw new Error("Elegí ballesta ligera o arma sencilla para el paquete de Hechicero.");
  replaySorcererChoices({ schemaVersion: 1,packageVersion: 1,ruleset: "dnd5e-2014",classKey: "sorcerer",creationOperationId: "build_00000000000000000000000000000000",creation: c,levels: [] });return c;
}
export function validateSorcererBuild(input: CharacterBuilderState) {
  const s = CharacterBuilderStateSchema.parse(input);validateSorcererCreation(s.creation);if (s.classKey !== "sorcerer") throw new Error("El historial no corresponde a Hechicero.");
  for (const [index,step] of s.levels.entries()) {
    if (step.hpBase > 6 || step.hpMethod === "fixed" && step.hpBase !== 4) throw new Error("Hechicero usa 4 PG fijos o una tirada de d6, antes de Constitución.");
    if (step.subclass || step.additionalStyle || step.maneuvers.length || step.maneuverReplacement || step.artisanTool || step.magic.learn.length || step.magic.cantrips.length || step.magic.replace) throw new Error("Hechicero no concede elecciones de Guerrero.");
    const previous = { ...s,levels: s.levels.slice(0,index) };
    if (WIZARD_ASI_LEVELS.includes(step.level)) {
      if (step.skipImprovement) { if (step.feat || step.abilityIncrease) throw new Error("La renuncia debe dejar vacías las elecciones."); }
      else if (step.feat) { if (step.abilityIncrease) throw new Error("Elegí mejora o dote.");validateFeat(step.feat,fighterBuilderScores(previous),previous); }
      else if (!step.abilityIncrease || Object.values(step.abilityIncrease).reduce((a,b) => a+b,0) !== 2) throw new Error("Distribuí dos puntos o elegí una dote.");
    } else if (step.feat || step.abilityIncrease || step.skipImprovement) throw new Error("Este nivel no concede mejora ni dote.");
    if (Object.values(fighterBuilderScores({ ...s,levels: s.levels.slice(0,index+1) })).some((n) => n > 20)) throw new Error("Las mejoras no pueden superar 20.");
  }
  replaySorcererChoices(s);return s;
}
export async function applySorcererBenefits(input: CharacterV2) {
  const c = CharacterV2Schema.parse(input),state = c.builder!,level = c.identity.level,replay = replaySorcererChoices(state),r = SorcererRuntimeSchema.parse(c.spellcasting.sorcerer ?? {});
  c.identity.className = "Hechicero";c.identity.subclass = SORCERER_ORIGINS[replay.origin];c.spellcasting.ability = "charisma";
  const language = replay.origin === "draconic" ? "Dracónico" : replay.origin === "storm" ? "Primordial" : null;if (language) c.proficiencies.languages = [...new Set([...c.proficiencies.languages,language])];
  const definitions: TraitDefinition[] = [...SORCERER_CORE,...SORCERER_FEATURES[replay.origin]].filter((f) => f.level <= level).map((f) => ({ ...f }));const pool = definitions.find((f) => f.key === "sorcery-points");if (pool) { pool.maximum = level;pool.reset = "long-rest"; }
  if (replay.origin === "draconic") { const ancestor = DRAGON_ANCESTRIES[state.creation.sorcerer.ancestry!]!;definitions.push({ key: "your-ancestor",name: `Tu Ancestro Dragón: ${ancestor.name}`,description: `Tipo asociado: ${ancestor.damage}. Este ancestro es independiente de la ascendencia racial de un Dracónido.` }); }
  for (const key of replay.metamagic) definitions.push({ key: `metamagic-${key}`,name: METAMAGIC[key].name,description: METAMAGIC[key].description });
  const group = await traitGroup(c,"sorcerer",`Hechicero · ${SORCERER_ORIGINS[replay.origin]}`,definitions);definitions.forEach((d,i) => { r.resourceIds[d.key] = group.traits[i]!.id; });c.traits = [...c.traits.filter((g) => g.id !== group.id),group];
  for (let n=1;n<=9;n++) c.spellcasting.slots[String(n)] = { maximum: (WIZARD_SLOTS[level]![n-1] ?? 0)+(r.createdSlots[String(n)] ?? 0),used: c.spellcasting.slots[String(n)]?.used ?? 0 };
  const keys = [...new Set([...replay.cantrips,...replay.spells.map((s) => s.key),...sorcererFeatKnown(state)])],generated = await Promise.all(keys.map(async (key,index) => { const id = await createDeterministicId("spl",c.id,"sorcerer",key),old = c.spellcasting.spells.find((s) => s.id === id),definition = PHB_SPELLS[key]!;return CharacterSpellV2Schema.parse({ id,name: definition.name,level: definition.level,order: old?.order ?? index,prepared: true,definition: old?.definition ?? definition,effect: old?.effect ?? { description: "",active: false },casting: { source: "builder:sorcerer",key,ability: "charisma",kind: "slots",traitId: null,level: definition.level } }); }));
  c.spellcasting.spells = [...c.spellcasting.spells.filter((s) => s.casting?.source !== "builder:sorcerer"),...generated];c.spellcasting.sorcerer = r;return CharacterV2Schema.parse(c);
}

export async function createGuidedSorcerer(id: string,operationId: string,input: FighterCreationInput,createdAt: string,initialLevels: FighterLevelChoiceInput[] = []) {
  const creation = validateSorcererCreation(input), state = validateSorcererBuild({ schemaVersion: 1,packageVersion: 1,ruleset: "dnd5e-2014",classKey: "sorcerer",creationOperationId: operationId,creation,levels: [] });
  let character = await applySorcererBenefits(await createBuilderCharacter(id,state,createdAt));
  if (initialLevels.length !== creation.startingLevel-1) throw new Error("Completá todos los niveles iniciales.");
  for (const step of initialLevels) character = await advanceGuidedSorcerer(character,step,createdAt);
  return finishBuilderCreation(character);
}
export async function advanceGuidedSorcerer(input: CharacterV2,choiceInput: FighterLevelChoiceInput,updatedAt: string) {
  const character = CharacterV2Schema.parse(input),choice = FighterLevelChoiceSchema.parse(choiceInput);
  if (character.builder?.classKey !== "sorcerer") throw new Error("Esta ficha no tiene historial guiado de Hechicero.");
  const previous = validateSorcererBuild(character.builder), old = previous.levels.find((step) => step.operationId === choice.operationId);
  if (old) { if (canonicalJsonStringify(old as unknown as JsonValue) !== canonicalJsonStringify(choice as unknown as JsonValue)) throw new Error("Esta operación ya se confirmó con otras elecciones."); return character; }
  const scores = fighterBuilderScores(previous);
  if (choice.operationId === previous.creationOperationId || character.identity.level !== previous.levels.length+1 || choice.level !== character.identity.level+1 || character.identity.className !== "Hechicero" || character.identity.subclass !== (sorcererOrigin(previous) ? SORCERER_ORIGINS[sorcererOrigin(previous)!] : "") || BUILDER_ABILITIES.some((key) => character.abilities[key] !== scores[key])) throw new Error("La ficha cambió fuera del tutorial o no coincide con su historial.");
  const next = validateSorcererBuild({ ...previous,levels: [...previous.levels,choice] }), abilities = fighterBuilderScores(next), maximum = character.combat.hitPoints.maximum+fighterBuilderMaximumHp(next)-fighterBuilderMaximumHp(previous);
  const actions = await Promise.all(character.actions.map(async (action) => {
    const item = character.inventory.find((i) => i.id === action.inventoryItemId); if (!item?.weapon || !action.ability) return action;
    const generated = action.id === await createDeterministicId("act",character.id,"builder-weapon",item.id), ability = generated && action.ability === preferredWeaponAbility(scores,item) ? preferredWeaponAbility(abilities,item) : action.ability;
    return { ...action,ability,damageBonus: action.damageExpression ? action.damageBonus+abilityModifier(abilities[ability])-abilityModifier(scores[action.ability]) : action.damageBonus };
  }));
  let result = CharacterV2Schema.parse({ ...character,builder: next,abilities,actions,revision: character.revision+1,metadata: { ...character.metadata,updatedAt },identity: { ...character.identity,level: choice.level },combat: { ...character.combat,hitPoints: { ...character.combat.hitPoints,maximum,current: Math.min(character.combat.hitPoints.current,maximum) },hitDice: { ...character.combat.hitDice,maximum: choice.level,remaining: character.combat.hitDice.remaining+1,current: String(character.combat.hitDice.remaining+1),formula: `${choice.level}d6` } } });
  result = await applyAdditionalFighterBenefits(result,character); result = await applySorcererBenefits(result);
  result.combat.armorClass = projectInventory(result).calculatedArmorClass; result.combat.speed = projectUpdatedBuilderSpeed(character,result);
  return CharacterV2Schema.parse(result);
}
