import { describe,it,expect } from "vitest";
import { rangerAt,rangerChoice,rangerCreation,rangerId,rangerOp,rangerTime as at } from "../fixtures/ranger-builder";
import { createGuidedRanger,advanceGuidedRanger,replayRangerChoices,validateRangerBuild,rangerCompanionStats } from "../../src/domain/character/ranger-builder";
import { RANGER_ARCHETYPES,RANGER_KNOWN,RANGER_SLOTS,RANGER_CORE,RANGER_FEATURES,HUNTER_OPTIONS,RANGER_ENEMIES,RANGER_TERRAINS } from "../../src/domain/character/ranger-catalog";
import { BUILDER_RACES,BACKGROUND_PRESETS } from "../../src/domain/character/fighter-builder-catalog";
import type { RangerArchetype } from "../../src/domain/character/ranger-model";
import { CharacterBuilderStateSchema,FeatChoiceSchema } from "../../src/domain/character/character-builder-model";
import { projectCharacterStatistics,projectActionAttackModifier,projectActionDamageBonus,projectInventory } from "../../src/domain/character/character-projection";
import { classSpells } from "../../src/domain/character/phb-spells";
describe("Explorador PHB 2014 y Xanathar",() => {
  it.each(Object.keys(RANGER_ARCHETYPES) as RangerArchetype[])("proyecta %s en cada nivel de 1 a 20",async (archetype) => {
    let c = await rangerAt();for (let level=1;level<=20;level++) {
      if (level > 1) c = await advanceGuidedRanger(c,rangerChoice(c,archetype),at);const replay = replayRangerChoices(c.builder!);
      expect(replay.spells.filter((s) => !s.bonus)).toHaveLength(RANGER_KNOWN[level]!);expect(replay.spells.filter((s) => s.bonus)).toHaveLength(["gloom-stalker","horizon-walker","monster-slayer"].includes(archetype) ? [3,5,9,13,17].filter((n) => n <= level).length : 0);
      expect(c.combat.hitDice.dieSize).toBe(10);expect(c.combat.hitDice.formula).toBe(`${level}d10`);expect(c.combat.hitPoints.maximum).toBe(12+(level-1)*8);expect(c.checks.savingThrows.strength.proficiency).toBe(1);expect(c.checks.savingThrows.dexterity.proficiency).toBe(1);expect(c.proficiencies.armor).not.toContain("Todas las armaduras");
      expect(Array.from({ length: 9 },(_,i) => c.spellcasting.slots[String(i+1)]!.maximum)).toEqual([...RANGER_SLOTS[level]!,...Array(9-RANGER_SLOTS[level]!.length).fill(0)]);
      const names = c.traits.flatMap((g) => g.traits).map((t) => t.name);expect([...RANGER_CORE,...(level >= 3 ? RANGER_FEATURES[archetype] : [])].filter((f) => f.level <= level).every((f) => names.includes(f.name))).toBe(true);expect(() => validateRangerBuild(c.builder!)).not.toThrow();
      if (archetype === "gloom-stalker" && level >= 3) expect(projectCharacterStatistics(c).initiativeModifier).toBe(5);
    }
    expect(replayRangerChoices(c.builder!).enemies).toHaveLength(3);expect(replayRangerChoices(c.builder!).terrains).toHaveLength(3);expect(c.identity.subclass).toBe(RANGER_ARCHETYPES[archetype]);
    if (archetype === "beast-master") expect(rangerCompanionStats(c)).toMatchObject({ maximumHp: 80,armorClass: 19,attackBonus: 10,damage: "2d4+2+6",magical: true });
  });
  it.each(Object.keys(RANGER_ARCHETYPES) as RangerArchetype[])("admite %s con las 270 combinaciones de raza y trasfondo",async (archetype) => {
    for (const race of Object.keys(BUILDER_RACES) as Array<keyof typeof BUILDER_RACES>) for (const bg of Object.keys(BACKGROUND_PRESETS) as Array<keyof typeof BACKGROUND_PRESETS>) { let c = await createGuidedRanger(rangerId,rangerOp,rangerCreation(race,bg),at);c = await advanceGuidedRanger(c,rangerChoice(c,archetype),at);c = await advanceGuidedRanger(c,rangerChoice(c,archetype),at);expect(c.identity.subclass).toBe(RANGER_ARCHETYPES[archetype]); }
  },30000);
  it("permite las 54 combinaciones de Cazador",async () => {
    for (const a of Object.keys(HUNTER_OPTIONS[3]!)) for (const b of Object.keys(HUNTER_OPTIONS[7]!)) for (const d of Object.keys(HUNTER_OPTIONS[11]!)) for (const e of Object.keys(HUNTER_OPTIONS[15]!)) { const c = await rangerAt(15,"hunter",{ 3: a,7: b,11: d,15: e });expect(c.builder!.levels.filter((s) => s.ranger.hunter).map((s) => s.ranger.hunter)).toEqual([a,b,d,e]); }
  },15000);
  it("admite tipos de enemigo, humanoides y terrenos sin repetir",async () => {
    for (const type of Object.keys(RANGER_ENEMIES) as Array<keyof typeof RANGER_ENEMIES>) { const c = rangerCreation();c.ranger.enemy = { type,humanoids: type === "humanoids" ? ["Orcos","Gnolls"] : [],language: "",languageConfirmed: true };await expect(createGuidedRanger(rangerId,rangerOp,c,at)).resolves.toBeDefined(); }
    for (const terrain of Object.keys(RANGER_TERRAINS) as Array<keyof typeof RANGER_TERRAINS>) { const c = rangerCreation();c.ranger.terrain = terrain;await expect(createGuidedRanger(rangerId,rangerOp,c,at)).resolves.toBeDefined(); }
    const c5 = await rangerAt(5),six = rangerChoice(c5);six.ranger.terrain = "forest";await expect(advanceGuidedRanger(c5,six,at)).rejects.toThrow(/terrenos distintos/);six.ranger.terrain = "coast";six.ranger.enemy = { type: "beasts",humanoids: [],language: "",languageConfirmed: true };await expect(advanceGuidedRanger(c5,six,at)).rejects.toThrow(/tipo de enemigo nuevo/);
    const bad = rangerCreation();bad.ranger.enemy = { type: "humanoids",humanoids: ["Orcos","ORCOS"],language: "",languageConfirmed: true };await expect(createGuidedRanger(rangerId,rangerOp,bad,at)).rejects.toThrow(/razas/);
  });
  it("valida conjuros, sustitución, idioma, pericias de clase ajena y d10",async () => {
    const c = await rangerAt(3),four = rangerChoice(c),known = replayRangerChoices(c.builder!).spells[0]!.key,newKey = classSpells("ranger",1).find((s) => !replayRangerChoices(c.builder!).spells.some((p) => p.key === s))!;four.ranger.replaceSpell = { oldKey: known,newKey };const next = await advanceGuidedRanger(c,four,at);expect(replayRangerChoices(next.builder!).spells.some((s) => s.key === known)).toBe(false);
    const dup = rangerChoice(await rangerAt(1));dup.ranger.learn = ["cure-wounds","cure-wounds"];await expect(advanceGuidedRanger(await rangerAt(1),dup,at)).rejects.toThrow(/distintos/);
    const hp = rangerChoice(c);hp.hpBase = 5;await expect(advanceGuidedRanger(c,hp,at)).rejects.toThrow(/6 PG/);
    const language = rangerCreation();language.ranger.enemy!.language = "Común";await expect(createGuidedRanger(rangerId,rangerOp,language,at)).rejects.toThrow(/idioma/);
    const foreign = structuredClone(c.builder!);foreign.creation.bard.cantrips = ["light"];expect(() => CharacterBuilderStateSchema.parse(foreign)).toThrow();
  });
  it("aplica cuatro estilos y Mente de Hierro con salvación alternativa",async () => {
    for (const style of ["archery","defense","dueling","two-weapon"] as const) { const c1 = await rangerAt(1),two = rangerChoice(c1);two.ranger.style = style;const c = await advanceGuidedRanger(c1,two,at);expect(c.builder!.levels[0]!.ranger.style).toBe(style);if (style === "archery") { const bow = c.actions.find((a) => a.name === "Arco largo")!;expect(projectActionAttackModifier(c,bow)).toBe(7); }if (style === "defense") expect(projectInventory(c).calculatedArmorClass).toBe(17); }
    let c = await rangerAt(3,"gloom-stalker");const four = rangerChoice(c,"gloom-stalker");four.skipImprovement = false;four.feat = FeatChoiceSchema.parse({ key: "resilient",ability: "wisdom" });c = await advanceGuidedRanger(c,four,at);while (c.identity.level < 6) c = await advanceGuidedRanger(c,rangerChoice(c,"gloom-stalker"),at);const seven = rangerChoice(c,"gloom-stalker");seven.ranger.ironMind = null;await expect(advanceGuidedRanger(c,seven,at)).rejects.toThrow(/INT o CAR/);seven.ranger.ironMind = "charisma";c = await advanceGuidedRanger(c,seven,at);expect(c.checks.savingThrows.charisma.proficiency).toBe(1);expect(c.checks.savingThrows.wisdom.proficiency).toBe(1);
  });
  it("respeta oro, equipo, requisitos de magia desde 2 y reintentos de ascenso",async () => {
    const creation = rangerCreation();creation.equipment.method = "gold";creation.equipment.goldRoll = [4,4,4,4,4];creation.equipment.purchases = [{ key: "longbow",quantity: 1,equipped: true }];expect((await createGuidedRanger(rangerId,rangerOp,creation,at)).currency.gold).toBe(150);
    let c = await rangerAt(3);c.combat.hitPoints.current = 2;c.combat.hitPoints.temporary = 3;c.spellcasting.slots["1"]!.used = 1;const four = rangerChoice(c);four.skipImprovement = false;four.feat = FeatChoiceSchema.parse({ key: "war-caster" });const next = await advanceGuidedRanger(c,four,at);expect(next.combat.hitPoints.current).toBe(2);expect(next.combat.hitPoints.temporary).toBe(3);expect(next.spellcasting.slots["1"]!.used).toBe(1);expect(await advanceGuidedRanger(next,four,at)).toEqual(next);
    const initial = rangerCreation("human-variant");initial.initialFeat = FeatChoiceSchema.parse({ key: "war-caster" });await expect(createGuidedRanger(rangerId,rangerOp,initial,at)).rejects.toThrow(/requisito/);
  });
});
