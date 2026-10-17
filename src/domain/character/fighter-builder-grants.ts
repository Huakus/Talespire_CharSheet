import { CharacterV2Schema, type CharacterV2 } from "./character-v2";
import { traitGroup, type TraitDefinition } from "./builder-traits";
import { builderFeats, replayFighterChoices } from "./fighter-build-rules";
import { FEATS, MANEUVERS, EK_PROGRESSION, fighterSubclass } from "./phb-fighter-choices";
import { BUILDER_RACES } from "./fighter-builder-catalog";
import { BUILDER_WEAPONS } from "./fighter-builder-catalog";
import { DRAGON_ANCESTRIES, phbGear } from "./phb-character-options";
import { PHB_SPELLS, spellAbility } from "./phb-spells";
import { createDeterministicId } from "../../shared/id";
import { abilityModifier, proficiencyBonus } from "./character-projection";
import { SKILL_DEFINITIONS } from "./character-checks";
import { CharacterSpellV2Schema, type CharacterSpellV2 } from "./character-spell-model";

interface SpellGrant { key: string; source: string; ability: "intelligence" | "wisdom" | "charisma"; kind: "slots" | "innate" | "ritual" | "at-will"; level?: number; traitId?: string }
export async function applyAdditionalFighterBenefits(input: CharacterV2, previous: CharacterV2 | null = null): Promise<CharacterV2> {
  const character = CharacterV2Schema.parse(input), state = character.builder!, creation = state.creation, level = character.identity.level;
  const subclass = fighterSubclass(state), replay = replayFighterChoices(state), feats = builderFeats(state);
  const spells: SpellGrant[] = [];
  const unarmedId = await createDeterministicId("act", character.id, "builder", "unarmed");
  const oldUnarmed = character.actions.find((action) => action.id === unarmedId);
  const unarmedBonus = oldUnarmed && previous ? oldUnarmed.damageBonus - abilityModifier(previous.abilities.strength) : 0;
  character.actions = [...character.actions.filter((action) => action.id !== unarmedId), { id: unarmedId, order: oldUnarmed?.order ?? character.actions.length, name: "Golpe sin armas", categories: ["attack", "action"], activation: "Acción", reach: "5 ft", ability: "strength", proficient: true, attackBonus: oldUnarmed?.attackBonus ?? 0, damageExpression: feats.some(({ feat }) => ["tavern-brawler","dragon-hide"].includes(feat.key)) ? "1d4" : "1", damageBonus: abilityModifier(character.abilities.strength) + unarmedBonus, damageType: feats.some(({ feat }) => feat.key === "dragon-hide") ? "slashing" : "bludgeoning", weaponType: "unarmed", properties: "", description: "Daño mínimo 0. Matón de taberna permite intentar agarrar con acción adicional tras impactar; resolvé el agarre por separado.", inventoryItemId: null, rollMode: oldUnarmed?.rollMode ?? "normal" }];
  const put = async (key: string, title: string, definitions: TraitDefinition[], managed: string[] = []) => {
    const group = await traitGroup(character, key, title, definitions, managed);
    character.traits = [...character.traits.filter((g) => g.id !== group.id), group].sort((a,b) => a.order-b.order);
    return group;
  };
  const racial: TraitDefinition[] = BUILDER_RACES[creation.race].traits.map((text, i) => { const description = state.classKey !== "fighter" ? text.replace(/; incluido en Guerrero/g, "").replace(/; incluidas en Guerrero/g, "") : text; return { key: `racial-${i}`, name: description.split(":")[0]!, description }; });
  if (creation.racialSkillReplacement) {
    const trait = racial.find((t) => ["Amenazador", "Sentidos agudos"].includes(t.name));
    if (trait) trait.description = `Competencia racial ya concedida por otra fuente: en su lugar, ${SKILL_DEFINITIONS[creation.racialSkillReplacement].label}.`;
  }
  const small = creation.race.includes("halfling") || creation.race.includes("gnome");
  racial.push({ key: small ? "small" : "medium", name: small ? "Tamaño Pequeño" : "Tamaño Mediano", description: small ? "Armas pesadas: desventaja en ataques; aplicala según el contexto de la tirada." : "Tu tamaño es Mediano." });
  if (creation.race === "half-orc") racial.push({ key: "relentless", name: "Aguante incansable", description: "Al caer a 0 PG sin morir instantáneamente, podés quedar en 1 PG. Gastá un uso y actualizá los PG.", maximum: 1, reset: "long-rest" });
  if (creation.race === "dragonborn") {
    const ancestry = DRAGON_ANCESTRIES[creation.origin.ancestry!];
    const dice = level >= 16 ? 5 : level >= 11 ? 4 : level >= 6 ? 3 : 2;
    const dc = 8 + proficiencyBonus(level) + abilityModifier(character.abilities.constitution);
    racial.push({ key: "ancestry", name: `Ascendencia dracónica: ${ancestry.name}`, description: `Resistencia al daño ${ancestry.damage}.` });
    racial.push({ key: "breath", name: "Arma de aliento", description: `Acción; ${ancestry.shape}. Salvación de ${ancestry.save}, CD ${dc}: ${dice}d6 ${ancestry.damage}, mitad si salva. Un uso por descanso corto o largo.`, maximum: 1, reset: "short-rest" });
    const id = await createDeterministicId("act", character.id, "builder", "dragon-breath");
    const old = character.actions.find((a) => a.id === id);
    character.actions = [...character.actions.filter((a) => a.id !== id), { id, order: old?.order ?? character.actions.length, name: "Arma de aliento", categories: ["action"], activation: "Acción", reach: ancestry.shape, ability: null, proficient: false, attackBonus: 0, damageExpression: `${dice}d6`, damageBonus: 0, damageType: ancestry.damage, weaponType: "", properties: "", description: `Salvación ${ancestry.save} CD ${dc}, mitad si salva. Gastá el uso del rasgo Arma de aliento.`, inventoryItemId: null, rollMode: "normal" }];
  }
  if (creation.race === "high-elf") spells.push({ key: creation.origin.cantrip, source: "race", ability: "intelligence", kind: "innate" });
  if (creation.race === "forest-gnome") spells.push({ key: "minor-illusion", source: "race", ability: "intelligence", kind: "innate" });
  const innate = async (key: string, castLevel: number) => {
    const traitKey = `innate-${key}`;
    racial.push({ key: traitKey, name: `Magia racial: ${PHB_SPELLS[key]!.name}`, description: `Carisma; lanzamiento a nivel ${castLevel}, una vez por descanso largo sin gastar espacios.`, maximum: 1, reset: "long-rest" });
    spells.push({ key, source: "race", ability: "charisma", kind: "innate", level: castLevel, traitId: await createDeterministicId("trt", character.id, "builder", "race", traitKey) });
  };
  if (creation.race === "tiefling") {
    spells.push({ key: "thaumaturgy", source: "race", ability: "charisma", kind: "innate" });
    if (level >= 3) await innate("hellish-rebuke", 2);
    if (level >= 5) await innate("darkness", 2);
  }
  if (creation.race === "drow") {
    spells.push({ key: "dancing-lights", source: "race", ability: "charisma", kind: "innate" });
    if (level >= 3) await innate("faerie-fire", 1);
    if (level >= 5) await innate("darkness", 2);
  }
  await put("race", BUILDER_RACES[creation.race].name, racial);
  if (subclass === "battle-master") {
    const sides = level >= 18 ? 12 : level >= 10 ? 10 : 8, count = level >= 15 ? 6 : level >= 7 ? 5 : 4;
    const tool = state.levels.find((s) => s.level === 3)!.artisanTool;
    if (!character.proficiencies.tools.includes(tool)) character.proficiencies.tools.push(tool);
    const dc = `Fuerza ${8 + proficiencyBonus(level) + abilityModifier(character.abilities.strength)} / Destreza ${8 + proficiencyBonus(level) + abilityModifier(character.abilities.dexterity)}`;
    const definitions: TraitDefinition[] = [
      { key: "superiority", name: "Dados de superioridad", description: `${count}d${sides}; un dado por maniobra, máximo una maniobra por ataque. Recuperás todos tras descanso corto o largo. CD a elección: ${dc}.`, maximum: count, reset: "short-rest" },
      { key: "student-of-war", name: "Estudiante de guerra", description: `Competencia con ${tool}.` },
      ...replay.maneuvers.map((key) => ({ key: `maneuver-${key}`, ...MANEUVERS[key as keyof typeof MANEUVERS] })),
    ];
    if (level >= 7) definitions.push({ key: "know-enemy", name: "Conoce a tu enemigo", description: "Tras observar o interactuar 1 minuto fuera de combate, el GM compara dos características con las tuyas: Fuerza, Destreza, Constitución, CA, PG actuales, niveles totales de clase o niveles de Guerrero; indica inferior, igual o superior." });
    if (level >= 10) definitions.push({ key: "improved-superiority", name: "Superioridad de combate mejorada", description: `Tus dados de superioridad son d${sides}.` });
    if (level >= 15) definitions.push({ key: "relentless", name: "Implacable", description: "Al tirar iniciativa sin dados de superioridad disponibles, recuperá uno; ajustá sus usos." });
    await put("battle-master", "Guerrero · Maestro de batalla", definitions, Object.keys(MANEUVERS).map((key) => `maneuver-${key}`));
    const actionId = await createDeterministicId("act", character.id, "builder", "superiority-die");
    const old = character.actions.find((action) => action.id === actionId);
    character.actions = [...character.actions.filter((action) => action.id !== actionId), { id: actionId, order: old?.order ?? character.actions.length, name: "Dado de superioridad", categories: ["other"], activation: "Según maniobra", reach: "", ability: null, proficient: false, attackBonus: 0, damageExpression: `1d${sides}`, damageBonus: 0, damageType: "bonus", weaponType: "", properties: "", description: "Gastá un uso de Dados de superioridad y aplicá el dado a la maniobra correspondiente. La tirada sola no gasta el recurso.", inventoryItemId: null, rollMode: "normal" }];
  }
  if (subclass === "eldritch-knight") {
    const definitions: TraitDefinition[] = [
      { key: "spellcasting", name: "Lanzamiento de conjuros", description: "Conjuros conocidos de mago con Inteligencia. Las plazas ordinarias exigen Abjuración/Evocación; las de niveles 3, 8, 14 y 20 admiten cualquier escuela y conservan esa excepción al sustituirse. No concede lanzamiento ritual ni foco arcano de mago; aportá los componentes pertinentes." },
      { key: "weapon-bond", name: "Vínculo de arma", description: "Ritual de 1 hora con arma a tu alcance, tocándola al concluir; puede hacerse en descanso corto. Hasta dos armas vinculadas. No pueden desarmarte de ellas salvo incapacitado; en el mismo plano, acción adicional en tu turno para llamar una a tu mano. Vincular una tercera rompe un vínculo anterior." },
    ];
    if (level >= 7) definitions.push({ key: "war-magic", name: level >= 18 ? "Magia de guerra mejorada" : "Magia de guerra", description: `Tras usar tu acción para lanzar ${level >= 18 ? "un conjuro" : "un truco"}, podés atacar una vez con un arma como acción adicional.` });
    if (level >= 10) definitions.push({ key: "eldritch-strike", name: "Golpe arcano", description: "Tras impactar con arma a una criatura, tiene desventaja en la próxima salvación contra un conjuro tuyo antes del final de tu próximo turno." });
    if (level >= 15) definitions.push({ key: "arcane-charge", name: "Carga arcana", description: "Al usar Acción súbita, podés teletransportarte hasta 30 pies a un espacio libre que veas, antes o después de la acción extra concedida por ese rasgo." });
    await put("eldritch-knight", "Guerrero · Caballero arcano", definitions);
    character.spellcasting.ability = "intelligence";
    EK_PROGRESSION[level]!.slots.forEach((maximum, i) => {
      const used = character.spellcasting.slots[String(i+1)]?.used ?? 0;
      if (used > maximum) throw new Error("Los espacios gastados de la ficha exceden la progresión; revisá los cambios manuales de espacios antes de subir.");
      character.spellcasting.slots[String(i+1)] = { maximum, used };
    });
    for (const key of [...replay.cantrips, ...replay.spells.map((s) => s.key)]) spells.push({ key, source: "eldritch-knight", ability: "intelligence", kind: "slots" });
  }
  if (state.classKey === "fighter") {
    const extra = state.levels.find((s) => s.level===3)?.xanathar;
    if (extra?.skill) character.checks.skills[extra.skill as keyof typeof character.checks.skills].proficiency = Math.max(1,character.checks.skills[extra.skill as keyof typeof character.checks.skills].proficiency) as 1|2;
    if (extra?.language && !character.proficiencies.languages.includes(extra.language)) character.proficiencies.languages.push(extra.language);
    if (extra?.cantrip) spells.push({ key: extra.cantrip,source: "xanathar-archetype",ability: "intelligence",kind: "slots" });
    if (subclass === "samurai" && level>=7) character.checks.savingThrows[state.levels.find((s) => s.level===7)?.xanathar.bonusSave ?? "wisdom"].proficiency = 1;
  }
  for (const { feat, level: gainedAt } of feats) {
    const source = `feat-${gainedAt}-${feat.key}`;
    const definition = FEATS[feat.key];
    const detail = [feat.ability ? `Aumento: ${feat.ability} +1.` : "", feat.damageType ? `Daño elegido: ${feat.damageType}.` : "", feat.skills.length ? `Habilidades: ${feat.skills.map((k) => SKILL_DEFINITIONS[k].label).join(", ")}.` : "", feat.tools.join(", "), feat.languages.join(", "), feat.weapons.join(", ")].filter(Boolean).join("\n");
    const definitions: TraitDefinition[] = [{ key: "feat", name: definition.name, description: `${definition.description}\n${detail}` }];
    if (feat.key === "lucky") Object.assign(definitions[0]!, { maximum: 3, reset: "long-rest" });
    if (feat.key === "martial-adept") {
      const sides = subclass === "battle-master" && level >= 10 ? level >= 18 ? 12 : 10 : 6;
      definitions.push({ key: "superiority", name: `Dado de superioridad adicional d${sides}`, description: `Un d${sides} de Adepto marcial; se contabiliza aparte para conservar usos. Superioridad de combate mejorada aumenta también este dado en Maestro de batalla 10 y 18.`, maximum: 1, reset: "short-rest" });
      definitions.push(...feat.maneuvers.map((key) => ({ key: `maneuver-${key}`, ...MANEUVERS[key as keyof typeof MANEUVERS] })));
    }
    if (["fade-away","orcish-fury","second-chance"].includes(feat.key)) Object.assign(definitions[0]!,{ maximum: 1,reset: "short-rest" });
    const fixedMagic = feat.key === "drow-high-magic" ? [["detect-magic","charisma","at-will"],["levitate","charisma","innate"],["dispel-magic","charisma","innate"]] : feat.key === "fey-teleportation" ? [["misty-step","intelligence","innate"]] : feat.key === "wood-elf-magic" ? [[feat.spells[0]!,"wisdom","innate"],["longstrider","wisdom","innate"],["pass-without-trace","wisdom","innate"]] : [];
    for (const [key,ability,kind] of fixedMagic) {
      const spell = PHB_SPELLS[key!]!; let traitId: string | undefined;
      if (spell.level > 0 && kind === "innate") { const useKey = `racial-spell-${key}`; definitions.push({ key: useKey,name: spell.name,description: "Lanzamiento de dote sin espacio.",maximum: 1,reset: feat.key === "fey-teleportation" ? "short-rest" : "long-rest" }); traitId = await createDeterministicId("trt",character.id,"builder",source,useKey); }
      spells.push({ key: key!,source,ability: ability as "intelligence" | "wisdom" | "charisma",kind: kind as "innate" | "at-will",...(traitId ? { traitId } : {}) });
    }
    if (feat.spellClass) {
      for (const key of feat.spells) {
        const spell = PHB_SPELLS[key]!;
        let traitId: string | undefined;
        if (feat.key === "magic-initiate" && spell.level > 0) {
          definitions.push({ key: "spell-use", name: `Iniciado: ${spell.name}`, description: "Un lanzamiento a nivel 1 por descanso largo mediante la dote.", maximum: 1, reset: "long-rest" });
          traitId = await createDeterministicId("trt", character.id, "builder", source, "spell-use");
        }
        spells.push({ key, source, ability: spellAbility(feat.spellClass), kind: feat.key === "ritual-caster" ? "ritual" : "innate", ...(spell.level ? { level: 1 } : {}), ...(traitId ? { traitId } : {}) });
      }
    }
    await put(source, `Dote · nivel ${gainedAt}`, definitions);
    if (!previous?.builder || !builderFeats(previous.builder).some((old) => old.level === gainedAt)) {
      if (feat.expertise) character.checks.skills[feat.expertise].proficiency = 2;
      if (feat.key === "fey-teleportation" && !character.proficiencies.languages.includes("Silvano")) character.proficiencies.languages.push("Silvano");
      for (const skill of feat.skills) character.checks.skills[skill].proficiency = Math.max(1, character.checks.skills[skill].proficiency) as 1 | 2;
      for (const tool of feat.tools) if (!character.proficiencies.tools.includes(tool)) character.proficiencies.tools.push(tool);
      for (const language of feat.languages) if (!character.proficiencies.languages.includes(language)) character.proficiencies.languages.push(language);
      if (feat.key === "resilient" && feat.ability) character.checks.savingThrows[feat.ability].proficiency = 1;
      if (feat.key === "tavern-brawler" && !character.proficiencies.weapons.includes("Armas improvisadas")) character.proficiencies.weapons.push("Armas improvisadas");
      for (const key of feat.weapons) {
        const name = BUILDER_WEAPONS[key]!.name;
        if (!character.proficiencies.weapons.includes(name)) character.proficiencies.weapons.push(name);
        character.actions.forEach((action) => { if (character.inventory.some((item) => item.id === action.inventoryItemId && item.name === name)) action.proficient = true; });
      }
      const armor = feat.key === "lightly-armored" ? ["Armaduras ligeras"] : feat.key === "moderately-armored" ? ["Armaduras medias", "Escudos"] : feat.key === "heavily-armored" ? ["Armaduras pesadas"] : [];
      for (const name of armor) if (!character.proficiencies.armor.includes(name)) character.proficiencies.armor.push(name);
      if (feat.key === "ritual-caster") {
        character.inventory.push({ ...phbGear("Libro de rituales", 5), id: await createDeterministicId("inv", character.id, "builder-ritual-book", source), order: character.inventory.length, group: "Dotes" });
      }
    }
  }
  const generated: CharacterSpellV2[] = await Promise.all(spells.map(async (grant) => {
    const id = await createDeterministicId("spl", character.id, "builder-spell", grant.source, grant.key), old = character.spellcasting.spells.find((s) => s.id === id), definition = PHB_SPELLS[grant.key]!;
    return CharacterSpellV2Schema.parse({ id, order: old?.order ?? character.spellcasting.spells.length + spells.indexOf(grant), name: definition.name, level: definition.level, prepared: old?.prepared ?? true, definition: old?.definition ?? definition, effect: old?.effect ?? { description: "", active: false }, casting: { source: `builder:${grant.source}`, key: grant.key, ability: grant.ability, kind: grant.kind, level: grant.level ?? definition.level, traitId: grant.traitId ?? null } });
  }));
  character.spellcasting.spells = [...character.spellcasting.spells.filter((spell) => !spell.casting?.source.startsWith("builder:") || spell.casting.source === "builder:monk" || spell.casting.source === "builder:paladin" || spell.casting.source === "builder:sorcerer" || spell.casting.source.startsWith("builder:ranger") || spell.casting.source.startsWith("builder:druid") || spell.casting.source === "builder:bard" || spell.casting.source === "builder:barbarian" || spell.casting.source === "builder:wizard" || spell.casting.source.startsWith("builder:rogue") || spell.casting.source === "builder:cleric" || spell.casting.source.startsWith("builder:warlock")), ...generated].sort((a,b) => a.order-b.order);
  return CharacterV2Schema.parse(character);
}
