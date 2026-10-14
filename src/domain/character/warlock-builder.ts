import { CharacterV2Schema, type CharacterV2 } from "./character-v2";
import { CharacterBuilderStateSchema,FighterCreationSchema,FighterLevelChoiceSchema,BUILDER_ABILITIES,type CharacterBuilderState,type FighterCreationInput,type FighterLevelChoiceInput } from "./character-builder-model";
import { WarlockRuntimeSchema,type WarlockChoices } from "./warlock-model";
import { validateBuilderOrigin,fighterBuilderScores,fighterBuilderMaximumHp,createBuilderCharacter,finishBuilderCreation } from "./fighter-builder";
import { validateFeat,builderFeats,distinct,racialSkillGrants } from "./fighter-build-rules";
import { applyAdditionalFighterBenefits } from "./fighter-builder-grants";
import { PHB_SPELLS,classSpells } from "./phb-spells";
import { WARLOCK_PATRONS,WARLOCK_KNOWN,PATRON_FEATURES,PACT_BOONS,INVOCATIONS,pactSlots,invocationCount,warlockCantrips,warlockSpellChoices } from "./warlock-catalog";
import { WIZARD_ASI_LEVELS } from "./wizard-catalog";
import { BUILDER_WEAPONS } from "./fighter-builder-catalog";
import { phbGear } from "./phb-character-options";
import { CharacterSpellV2Schema } from "./character-spell-model";
import { traitGroup,type TraitDefinition } from "./builder-traits";
import { abilityModifier,projectInventory,preferredWeaponAbility,projectUpdatedBuilderSpeed } from "./character-projection";
import { createDeterministicId } from "../../shared/id";
import { canonicalJsonStringify,type JsonValue } from "../../shared/json";

function picks(keys: string[],quota: number,eligible: string[],previous: string[] = []) {
  if (keys.length !== quota || !distinct([...previous,...keys]) || keys.some((key) => !eligible.includes(key))) throw new Error(`Elegí ${quota} opciones distintas y válidas de Brujo, sin repetir las ya aprendidas.`);
}
export function replayWarlockChoices(state: CharacterBuilderState) {
  const creation = state.creation, first = creation.warlock, patron = first.patron;
  if (!patron) throw new Error("Elegí un patrón del Manual 2014 o Xanathar.");
  picks(first.cantrips,2,classSpells("warlock",0)); picks(first.learn,2,warlockSpellChoices(patron,1));
  if (first.invocations.length || first.replaceInvocation || first.replaceSpell || first.boon || first.tomeCantrips.length || first.rituals.length || first.arcanum || first.pactWeapon) throw new Error("Invocaciones y dones se eligen en sus niveles correspondientes, no en Brujo 1.");
  const cantrips = [...first.cantrips,...(patron === "celestial" ? ["light","sacred-flame"] : [])],spells = [...first.learn],invocations: string[] = [],rituals: string[] = [],tomeCantrips: string[] = [],arcana: string[] = [];
  let boon: WarlockChoices["boon"] = null, pactWeapon = "";
  for (const step of state.levels) {
    const c = step.warlock, level = step.level;
    if (c.patron || c.story) throw new Error("El patrón y el acuerdo se fijan en la creación.");
    picks(c.cantrips,warlockCantrips(level)-warlockCantrips(level-1),classSpells("warlock",0),cantrips); cantrips.push(...c.cantrips);
    const eligible = warlockSpellChoices(patron,pactSlots(level).level);
    if (c.replaceSpell) {
      const index = spells.indexOf(c.replaceSpell.oldKey);
      if (index < 0 || !eligible.includes(c.replaceSpell.newKey) || spells.includes(c.replaceSpell.newKey)) throw new Error("Solo podés sustituir un conjuro conocido de magia de pacto por otro permitido; Arcanos e invocaciones son independientes.");
      spells[index] = c.replaceSpell.newKey;
    }
    picks(c.learn,WARLOCK_KNOWN[level]!-WARLOCK_KNOWN[level-1]!,eligible,spells); spells.push(...c.learn);
    if (level === 3) {
      if (!c.boon) throw new Error("En Brujo 3 elegí Filo, Cadena o Tomo.");
      boon = c.boon;
      if (boon === "tome") { picks(c.tomeCantrips,3,classSpellsForAllCantrips(),cantrips); tomeCantrips.push(...c.tomeCantrips); }
      else if (c.tomeCantrips.length) throw new Error("Los tres trucos adicionales requieren Pacto del Tomo.");
      if (boon === "blade") { if (!canConjurePactWeapon(c.pactWeapon,[...invocations,...c.invocations,...(c.replaceInvocation ? [c.replaceInvocation.newKey] : [])])) throw new Error("Elegí un arma cuerpo a cuerpo para el Pacto del Filo."); pactWeapon = c.pactWeapon; }
      else if (c.pactWeapon) throw new Error("Esta elección de arma requiere Pacto del Filo.");
    } else if (c.boon || c.tomeCantrips.length || c.pactWeapon) throw new Error("El don del pacto y sus elecciones se fijan en Brujo 3.");
    if (c.replaceInvocation) {
      const index = invocations.indexOf(c.replaceInvocation.oldKey);
      if (index < 0 || invocations.includes(c.replaceInvocation.newKey)) throw new Error("Elegí una invocación anterior para sustituir por otra distinta.");
      invocations[index] = c.replaceInvocation.newKey;
    }
    picks(c.invocations,invocationCount(level)-invocationCount(level-1),Object.keys(INVOCATIONS),invocations); invocations.push(...c.invocations);
    const featCantrips = builderFeats({ ...state,levels: state.levels.filter((s) => s.level <= level) }).flatMap(({ feat }) => feat.spells);
    for (const key of invocations) {
      const definition = INVOCATIONS[key];
      if (!definition || definition.level > level || definition.boon && definition.boon !== boon || definition.blast && ![...cantrips,...tomeCantrips,...featCantrips].includes("eldritch-blast") || definition.curse && !spells.includes("hex") && patron !== "hexblade" && !invocations.includes("sign-of-ill-omen")) throw new Error("No cumplís los requisitos de nivel de Brujo, don o Estallido arcano de una invocación.");
    }
    if (invocations.includes("book-of-ancient-secrets") && !rituals.length) {
      picks(c.rituals,2,Object.keys(PHB_SPELLS).filter((key) => PHB_SPELLS[key]!.ritual && PHB_SPELLS[key]!.level === 1)); rituals.push(...c.rituals);
    } else if (c.rituals.length) throw new Error("Los dos rituales iniciales se eligen al adquirir Libro de secretos ancestrales por primera vez.");
    if ([11,13,15,17].includes(level)) { const spell = PHB_SPELLS[c.arcanum]; if (!spell?.classes.includes("warlock") || spell.level !== (level+1)/2) throw new Error("Elegí el Arcano místico del nivel indicado entre los conjuros de Brujo."); arcana.push(c.arcanum); }
    else if (c.arcanum) throw new Error("Los Arcanos místicos se eligen en Brujo 11, 13, 15 y 17.");
  }
  return { patron,cantrips,spells,invocations,rituals,tomeCantrips,arcana,boon,pactWeapon };
}
export function classSpellsForAllCantrips() { return Object.keys(PHB_SPELLS).filter((key) => PHB_SPELLS[key]!.level === 0); }
export function validateWarlockCreation(input: FighterCreationInput) {
  const creation = FighterCreationSchema.parse(input);
  if (creation.classKey !== "warlock") throw new Error("Este recorrido requiere Brujo.");
  validateBuilderOrigin(creation);
  if (creation.equipment.method === "packages" && [creation.warlockPrimary,creation.warlockSecondary].some((key) => !BUILDER_WEAPONS[key]?.weapon?.category.startsWith("simple"))) throw new Error("El equipo inicial de Brujo requiere armas sencillas.");
  replayWarlockChoices({ schemaVersion: 1,packageVersion: 1,ruleset: "dnd5e-2014",classKey: "warlock",creationOperationId: "build_00000000000000000000000000000000",creation,levels: [] });
  return creation;
}
export function validateWarlockBuild(input: CharacterBuilderState) {
  const state = CharacterBuilderStateSchema.parse(input);
  validateWarlockCreation(state.creation);
  if (state.classKey !== "warlock") throw new Error("El historial no corresponde a Brujo.");
  for (const [index,step] of state.levels.entries()) {
    if (step.hpBase > 8 || step.hpMethod === "fixed" && step.hpBase !== 5) throw new Error("Brujo usa 5 PG fijos o un resultado de d8, antes de Constitución.");
    if (step.subclass || step.additionalStyle || step.maneuvers.length || step.maneuverReplacement || step.artisanTool || step.magic.learn.length || step.magic.cantrips.length || step.magic.replace || step.wizard.learn.length || step.wizard.cantrips.length || step.wizard.prepared || step.wizard.mastery.length || step.wizard.signature.length || step.wizard.bonusCantrip) throw new Error("Brujo no concede elecciones de Guerrero ni Mago.");
    const previous = { ...state,levels: state.levels.slice(0,index) };
    if (WIZARD_ASI_LEVELS.includes(step.level)) {
      if (step.skipImprovement) { if (step.feat || step.abilityIncrease) throw new Error("La renuncia debe dejar vacías las elecciones."); }
      else if (step.feat) { if (step.abilityIncrease) throw new Error("Elegí mejora o dote."); validateFeat(step.feat,fighterBuilderScores(previous),previous); }
      else if (!step.abilityIncrease || Object.values(step.abilityIncrease).reduce((a,b) => a+b,0) !== 2) throw new Error("Distribuí dos puntos de atributo o elegí una dote permitida.");
    } else if (step.feat || step.abilityIncrease || step.skipImprovement) throw new Error("Este nivel de Brujo no concede mejora ni dote.");
    if (Object.values(fighterBuilderScores({ ...state,levels: state.levels.slice(0,index+1) })).some((n) => n > 20)) throw new Error("Las mejoras no pueden superar 20.");
  }
  replayWarlockChoices(state); return state;
}
export function canConjurePactWeapon(key: string,invocations: string[]) { return !!BUILDER_WEAPONS[key]?.weapon && (BUILDER_WEAPONS[key]!.weapon!.range === "melee" || invocations.includes("improved-pact-weapon") && ["shortbow","longbow","light-crossbow","heavy-crossbow"].includes(key)); }
export async function setConjuredPactWeapon(input: CharacterV2,key: string) {
  const character = CharacterV2Schema.parse(input), definition = BUILDER_WEAPONS[key];
  if (!definition?.weapon || !canConjurePactWeapon(key,replayWarlockChoices(character.builder!).invocations)) throw new Error("El arma creada por el pacto debe ser cuerpo a cuerpo.");
  const runtime = character.spellcasting.warlock!, id = await createDeterministicId("inv",character.id,"warlock-pact-weapon");
  const existing = character.inventory.find((item) => item.id === id);
  const item = { ...definition,id,order: existing?.order ?? character.inventory.length,quantity: 1,equipped: existing?.equipped ?? false,group: "Arma de pacto",description: `${definition.description}\nArma creada por Pacto del Filo; mágica contra resistencia/inmunidad. Desaparece a más de 5 pies durante un minuto, al crear otra, descartarla o morir.` };
  character.inventory = [...character.inventory.filter((i) => i.id !== id),item];
  const ability = character.builder!.creation.warlock.patron === "hexblade" ? "charisma" as const : preferredWeaponAbility(character.abilities,item), actionId = await createDeterministicId("act",character.id,"builder-weapon",id);
  character.actions = [...character.actions.filter((a) => a.id !== actionId),{ id: actionId,order: character.actions.find((a) => a.id === actionId)?.order ?? character.actions.length,name: `${item.name} · Pacto`,categories: ["attack","action"],activation: "Acción",reach: item.weapon!.range === "ranged" ? `${item.weapon!.normalRange}/${item.weapon!.longRange} ft` : item.properties.includes("reach") ? "10 ft" : "5 ft",ability,proficient: true,attackBonus: replayWarlockChoices(character.builder!).invocations.includes("improved-pact-weapon") ? 1 : 0,damageExpression: item.weapon!.damageExpression,damageBonus: abilityModifier(character.abilities[ability])+(replayWarlockChoices(character.builder!).invocations.includes("improved-pact-weapon") ? 1 : 0),damageType: item.weapon!.damageType,weaponType: item.weapon!.category,properties: item.properties.join(", "),description: item.description,inventoryItemId: id,rollMode: "normal" }];
  runtime.pactWeaponKey = key; runtime.pactWeaponId = id; runtime.pactWeaponAppliedBonus = replayWarlockChoices(character.builder!).invocations.includes("improved-pact-weapon") ? 1 : 0;
  return CharacterV2Schema.parse(character);
}
export async function applyWarlockBenefits(input: CharacterV2): Promise<CharacterV2> {
  let character = CharacterV2Schema.parse(input);
  const state = character.builder!, level = character.identity.level, replay = replayWarlockChoices(state), runtime = WarlockRuntimeSchema.parse(character.spellcasting.warlock ?? {});
  character.spellcasting.warlock = runtime;
  const definitions: TraitDefinition[] = [
    { key: "pact-magic",name: "Magia de pacto",description: "Carisma. Dos trucos y dos conjuros iniciales; conocidos sin preparación diaria. Todos los espacios de pacto se lanzan al mismo nivel (máximo 5) y se recuperan tras descanso corto/largo. Un conjuro conocido y una invocación pueden sustituirse al ganar un nivel de Brujo. Foco arcano válido; componentes costosos/consumidos se controlan en mesa." },
    ...PATRON_FEATURES[replay.patron].filter((feature) => feature.level <= level).map((feature) => ({ ...feature })),
    ...replay.invocations.map((key) => ({ key: `invocation-${key}`,name: INVOCATIONS[key]!.name,description: INVOCATIONS[key]!.description,...(["pact-invocation","innate"].includes(INVOCATIONS[key]!.mode ?? "") || INVOCATIONS[key]!.reset ? { maximum: 1,reset: INVOCATIONS[key]!.reset ?? "long-rest" as const } : {}) })),
    ...replay.arcana.map((key) => ({ key: `arcanum-${key}`,name: `Arcano místico: ${PHB_SPELLS[key]!.name}`,description: "Un lanzamiento a nivel base sin espacio por descanso largo. Este conjuro no usa espacios de pacto ni puede sustituirse como un conocido ordinario.",maximum: 1,reset: "long-rest" as const })),
  ];
  if (replay.patron === "celestial") { const pool = definitions.find((d) => d.key === "healing-light")!; pool.maximum = level+1; pool.reset = "long-rest"; }
  if (state.creation.warlock.story) definitions.push({ key: "patron-story",name: "Acuerdo con el patrón",description: state.creation.warlock.story });
  if (replay.boon) definitions.push({ key: `boon-${replay.boon}`,name: PACT_BOONS[replay.boon],description: replay.boon === "chain" ? "Encontrar familiar adicional, con lanzamiento ordinario o ritual. Formas normales o diablillo, pseudodragón, quasit y duende. Al usar Atacar podés ceder uno de tus ataques para que el familiar ataque con su reacción. Componentes y ficha del familiar se resuelven en mesa." : replay.boon === "tome" ? "Libro de las Sombras: tres trucos de cualquier clase, considerados conjuros de Brujo y lanzados con CAR mientras llevás el libro. Una ceremonia de una hora, posible durante descanso, reemplaza un libro perdido y destruye el anterior. Se vuelve ceniza al morir." : "Acción: creá un arma cuerpo a cuerpo en tu mano vacía; tenés competencia con ella y cuenta mágica contra resistencias/inmunidad. Cambia de forma al recrearla; desaparece al alejarse más de 5 pies un minuto, crear otra, descartarla o morir. Ritual de una hora permite vincular un arma mágica (incluso a distancia), salvo artefactos o conscientes; conservá su forma y propiedades en inventario." });
  if (level >= 20) definitions.push({ key: "eldritch-master",name: "Maestro sobrenatural",description: "Un minuto rogando al patrón recupera todos los espacios de magia de pacto. Una vez por descanso largo; no recupera Arcanos ni invocaciones.",maximum: 1,reset: "long-rest" });
  const group = await traitGroup(character,"warlock",`Brujo · ${WARLOCK_PATRONS[replay.patron]}`,definitions,Object.keys(INVOCATIONS).map((key) => `invocation-${key}`));
  definitions.forEach((definition,index) => { runtime.resourceIds[definition.key] = group.traits[index]!.id; });
  character.traits = [...character.traits.filter((g) => g.id !== group.id),group];
  character.identity.className = "Brujo"; character.identity.subclass = WARLOCK_PATRONS[replay.patron]; character.spellcasting.ability = "charisma";
  const slots = pactSlots(level), used = Object.values(character.spellcasting.slots).reduce((n,s) => n+s.used,0);
  if (used > slots.maximum) throw new Error("Los espacios gastados exceden el máximo de magia de pacto.");
  for (let n=1;n<=9;n++) character.spellcasting.slots[String(n)] = { maximum: n === slots.level ? slots.maximum : 0,used: n === slots.level ? used : 0 };
  for (const key of ["deception","persuasion"] as const) {
    if (replay.invocations.includes("beguiling-influence")) {
      runtime.influenceProficiencies[key] ??= character.checks.skills[key].proficiency;
      character.checks.skills[key].proficiency = Math.max(1,character.checks.skills[key].proficiency) as 1|2;
    } else if (runtime.influenceProficiencies[key] !== undefined) {
      const permanent = [...state.creation.skills,...state.creation.background.skills,...racialSkillGrants(state.creation),...builderFeats(state).flatMap(({ feat }) => feat.skills)];
      if (!permanent.includes(key) && character.checks.skills[key].proficiency === 1) character.checks.skills[key].proficiency = runtime.influenceProficiencies[key] as 0|1|2;
      delete runtime.influenceProficiencies[key];
    }
  }
  if (replay.boon === "tome" && !character.inventory.some((i) => i.group === "Libro de las Sombras")) character.inventory.push({ ...phbGear("Libro de las Sombras",3),id: await createDeterministicId("inv",character.id,"warlock-book"),order: character.inventory.length,group: "Libro de las Sombras" });
  if (replay.boon === "blade" && !runtime.pactWeaponKey) { character = await setConjuredPactWeapon(character,replay.pactWeapon); }
  else if (replay.boon === "blade" && runtime.pactWeaponKey) {
    if (!canConjurePactWeapon(runtime.pactWeaponKey,replay.invocations)) character = await setConjuredPactWeapon(character,"longsword");
    else { const bonus = replay.invocations.includes("improved-pact-weapon") ? 1 : 0; const action = character.actions.find((a) => a.inventoryItemId === runtime.pactWeaponId); if (action) { action.attackBonus += bonus-runtime.pactWeaponAppliedBonus; action.damageBonus += bonus-runtime.pactWeaponAppliedBonus; } runtime.pactWeaponAppliedBonus = bonus; }
  }
  const featKnown = builderFeats(state).filter(({ feat }) => feat.key === "magic-initiate" && feat.spellClass === "warlock").flatMap(({ feat,level }) => feat.spells.filter((key) => PHB_SPELLS[key]!.level === 1 && !replay.spells.includes(key)).map((key) => ({ key,source: `feat-slots-${level}`,kind: "pact" as const,traitId: null as string|null })));
  const grants = [
    ...[...replay.cantrips,...replay.spells,...(replay.boon === "chain" ? ["find-familiar"] : [])].map((key) => ({ key,source: "known",kind: "pact" as const,traitId: null as string|null })),
    ...featKnown,
    ...replay.tomeCantrips.map((key) => ({ key,source: "tome",kind: "pact" as const,traitId: null as string|null })),
    ...replay.arcana.map((key) => ({ key,source: "arcanum",kind: "innate" as const,traitId: runtime.resourceIds[`arcanum-${key}`]! })),
    ...replay.invocations.flatMap((inv) => INVOCATIONS[inv]!.spell ? [{ key: INVOCATIONS[inv]!.spell!,source: `invocation-${inv}`,kind: INVOCATIONS[inv]!.mode!,traitId: ["pact-invocation","innate"].includes(INVOCATIONS[inv]!.mode ?? "") ? runtime.resourceIds[`invocation-${inv}`]! : null }] : []),
    ...(replay.invocations.includes("book-of-ancient-secrets") ? [...new Set([...replay.rituals,...runtime.copiedRituals.map((r) => r.key),...[...replay.spells,...featKnown.map((s) => s.key)].filter((key) => PHB_SPELLS[key]!.ritual)])].map((key) => ({ key,source: "ritual",kind: "ritual" as const,traitId: null as string|null })) : []),
  ];
  const generated = await Promise.all(grants.map(async (grant) => {
    const id = await createDeterministicId("spl",character.id,"warlock",grant.source,grant.key), old = character.spellcasting.spells.find((s) => s.id === id), definition = PHB_SPELLS[grant.key]!;
    return CharacterSpellV2Schema.parse({ id,name: definition.name,level: definition.level,order: old?.order ?? character.spellcasting.spells.length+grants.indexOf(grant),prepared: true,definition: old?.definition ?? definition,effect: old?.effect ?? { description: "",active: false },casting: { source: `builder:warlock:${grant.source}`,key: grant.key,ability: "charisma",kind: grant.kind,traitId: grant.traitId,level: definition.level } });
  }));
  character.spellcasting.spells = [...character.spellcasting.spells.filter((s) => !s.casting?.source.startsWith("builder:warlock:")),...generated];
  return CharacterV2Schema.parse(character);
}
export async function createGuidedWarlock(id: string,operationId: string,input: FighterCreationInput,createdAt: string,initialLevels: FighterLevelChoiceInput[] = []) {
  const creation = validateWarlockCreation(input), state = validateWarlockBuild({ schemaVersion: 1,packageVersion: 1,ruleset: "dnd5e-2014",classKey: "warlock",creationOperationId: operationId,creation,levels: [] });
  let character = await applyWarlockBenefits(await createBuilderCharacter(id,state,createdAt));
  if (initialLevels.length !== creation.startingLevel-1) throw new Error("Completá todos los niveles iniciales.");
  for (const step of initialLevels) character = await advanceGuidedWarlock(character,step,createdAt);
  return finishBuilderCreation(character);
}
export async function advanceGuidedWarlock(input: CharacterV2,choiceInput: FighterLevelChoiceInput,updatedAt: string) {
  const character = CharacterV2Schema.parse(input),choice = FighterLevelChoiceSchema.parse(choiceInput);
  if (character.builder?.classKey !== "warlock") throw new Error("Esta ficha no tiene historial guiado de Brujo.");
  const previous = validateWarlockBuild(character.builder), old = previous.levels.find((step) => step.operationId === choice.operationId);
  if (old) { if (canonicalJsonStringify(old as unknown as JsonValue) !== canonicalJsonStringify(choice as unknown as JsonValue)) throw new Error("Esta operación ya se confirmó con otras elecciones."); return character; }
  const scores = fighterBuilderScores(previous);
  if (choice.operationId === previous.creationOperationId || character.identity.level !== previous.levels.length+1 || choice.level !== character.identity.level+1 || character.identity.className !== "Brujo" || character.identity.subclass !== WARLOCK_PATRONS[previous.creation.warlock.patron!] || BUILDER_ABILITIES.some((key) => character.abilities[key] !== scores[key])) throw new Error("La ficha cambió fuera del tutorial o no coincide con su historial.");
  const next = validateWarlockBuild({ ...previous,levels: [...previous.levels,choice] }), abilities = fighterBuilderScores(next), maximum = character.combat.hitPoints.maximum+fighterBuilderMaximumHp(next)-fighterBuilderMaximumHp(previous);
  const actions = await Promise.all(character.actions.map(async (action) => {
    const item = character.inventory.find((i) => i.id === action.inventoryItemId); if (!item?.weapon || !action.ability) return action;
    const generated = action.id === await createDeterministicId("act",character.id,"builder-weapon",item.id), ability = generated && action.ability === preferredWeaponAbility(scores,item) ? preferredWeaponAbility(abilities,item) : action.ability;
    return { ...action,ability,damageBonus: action.damageExpression ? action.damageBonus+abilityModifier(abilities[ability])-abilityModifier(scores[action.ability]) : action.damageBonus };
  }));
  let result = CharacterV2Schema.parse({ ...character,builder: next,abilities,actions,revision: character.revision+1,metadata: { ...character.metadata,updatedAt },identity: { ...character.identity,level: choice.level },combat: { ...character.combat,hitPoints: { ...character.combat.hitPoints,maximum,current: Math.min(character.combat.hitPoints.current,maximum) },hitDice: { ...character.combat.hitDice,maximum: choice.level,remaining: character.combat.hitDice.remaining+1,current: String(character.combat.hitDice.remaining+1),formula: `${choice.level}d8` } } });
  result = await applyAdditionalFighterBenefits(result,character); result = await applyWarlockBenefits(result);
  result.combat.armorClass = projectInventory(result).calculatedArmorClass; result.combat.speed = projectUpdatedBuilderSpeed(character,result);
  return CharacterV2Schema.parse(result);
}
