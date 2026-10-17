import { describe,it,expect } from "vitest";
import { sorcererAt,sorcererCreation,sorcererChoice,sorcererId,sorcererOp,sorcererTime as at } from "../fixtures/sorcerer-builder";
import { createGuidedSorcerer,advanceGuidedSorcerer,replaySorcererChoices,validateSorcererBuild } from "../../src/domain/character/sorcerer-builder";
import { SORCERER_ORIGINS,SORCERER_KNOWN,SORCERER_CORE,SORCERER_FEATURES,sorcererCantrips,METAMAGIC,SORCERER_AFFINITIES,DIVINE_SPELLS } from "../../src/domain/character/sorcerer-catalog";
import { WIZARD_SLOTS } from "../../src/domain/character/wizard-catalog";
import { BUILDER_RACES,BACKGROUND_PRESETS } from "../../src/domain/character/fighter-builder-catalog";
import { DRAGON_ANCESTRIES } from "../../src/domain/character/phb-character-options";
import { projectInventory } from "../../src/domain/character/character-projection";
import { CharacterBuilderStateSchema,FeatChoiceSchema } from "../../src/domain/character/character-builder-model";
import type { SorcererOrigin } from "../../src/domain/character/sorcerer-model";
import { projectCharacterProgression } from "../../src/domain/character/character-progression";
import { classSpells } from "../../src/domain/character/phb-spells";
describe("Hechicero PHB 2014 y Xanathar",() => {
  it.each(Object.keys(SORCERER_ORIGINS) as SorcererOrigin[])("aplica todos los niveles de %s y los muestra en Progresión",async (origin) => {
    let c = await sorcererAt(1,origin);for (let level=1;level<=20;level++) { if (level > 1) c = await advanceGuidedSorcerer(c,sorcererChoice(c),at);const replay = replaySorcererChoices(c.builder!);expect(replay.cantrips).toHaveLength(sorcererCantrips(level));expect(replay.spells.filter((s) => !s.bonus)).toHaveLength(SORCERER_KNOWN[level]!);expect(replay.metamagic).toHaveLength(level >= 17 ? 4 : level >= 10 ? 3 : level >= 3 ? 2 : 0);expect(c.combat.hitDice.dieSize).toBe(6);expect(c.combat.hitDice.formula).toBe(`${level}d6`);expect(c.checks.savingThrows.constitution.proficiency).toBe(1);expect(c.checks.savingThrows.charisma.proficiency).toBe(1);expect(c.combat.hitPoints.maximum).toBe(8+(level-1)*6+(origin === "draconic" ? level : 0));expect(Array.from({ length: 9 },(_,i) => c.spellcasting.slots[String(i+1)]!.maximum)).toEqual([...WIZARD_SLOTS[level]!,...Array(9-WIZARD_SLOTS[level]!.length).fill(0)]);expect(() => validateSorcererBuild(c.builder!)).not.toThrow();const names = c.traits.flatMap((g) => g.traits).map((t) => t.name);expect([...SORCERER_CORE,...SORCERER_FEATURES[origin]].filter((f) => f.level <= level).every((f) => names.includes(f.name))).toBe(true); }
    expect(c.identity.subclass).toBe(SORCERER_ORIGINS[origin]);expect((await projectCharacterProgression(c))!.levels).toHaveLength(20);if (origin === "draconic") { expect(projectInventory(c).calculatedArmorClass).toBe(15);expect(c.proficiencies.languages).toContain("Dracónico"); }if (origin === "storm") expect(c.proficiencies.languages).toContain("Primordial");
  });
  it.each(Object.keys(SORCERER_ORIGINS) as SorcererOrigin[])("admite %s con las 270 combinaciones de raza y trasfondo",async (origin) => {
    for (const race of Object.keys(BUILDER_RACES) as Array<keyof typeof BUILDER_RACES>) for (const bg of Object.keys(BACKGROUND_PRESETS) as Array<keyof typeof BACKGROUND_PRESETS>) { let c = await createGuidedSorcerer(sorcererId,sorcererOp,sorcererCreation(origin,race,bg),at);while (c.identity.level < 3) c = await advanceGuidedSorcerer(c,sorcererChoice(c),at);expect(c.identity.subclass).toBe(SORCERER_ORIGINS[origin]);expect(c.proficiencies.armor.includes("Todas las armaduras")).toBe(false); }
  },30000);
  it("admite los diez ancestros y cinco afinidades; Alma Divina usa Clérigo con CAR",async () => {
    for (const ancestry of Object.keys(DRAGON_ANCESTRIES) as Array<keyof typeof DRAGON_ANCESTRIES>) { const c = sorcererCreation();c.sorcerer.ancestry = ancestry;expect((await createGuidedSorcerer(sorcererId,sorcererOp,c,at)).builder!.creation.sorcerer.ancestry).toBe(ancestry); }
    for (const affinity of Object.keys(SORCERER_AFFINITIES) as Array<keyof typeof SORCERER_AFFINITIES>) { const c = sorcererCreation("divine-soul");c.sorcerer.affinity = affinity;c.sorcerer.cantrips[0] = "guidance";const built = await createGuidedSorcerer(sorcererId,sorcererOp,c,at);expect(built.spellcasting.spells.find((s) => s.casting?.key === DIVINE_SPELLS[affinity])!.casting!.ability).toBe("charisma");expect(built.spellcasting.spells.some((s) => s.casting?.key === "guidance")).toBe(true); }
  });
  it("valida metamagia sin duplicados, fuera de nivel, conocidos, adicional divino y d6",async () => {
    const c2 = await sorcererAt(2),three = sorcererChoice(c2);three.sorcerer.metamagic = ["subtle","subtle"];await expect(advanceGuidedSorcerer(c2,three,at)).rejects.toThrow(/Metamagia/);three.sorcerer.metamagic = ["subtle","twinned"];three.hpBase = 6;await expect(advanceGuidedSorcerer(c2,three,at)).rejects.toThrow(/4 PG/);
    const soul = await sorcererAt(3,"divine-soul"),four = sorcererChoice(soul);four.sorcerer.replaceSpell = { oldKey: "cure-wounds",newKey: "burning-hands" };await expect(advanceGuidedSorcerer(soul,four,at)).rejects.toThrow(/Clérigo/);four.sorcerer.replaceSpell.newKey = "healing-word";const replaced = await advanceGuidedSorcerer(soul,four,at);expect(replaySorcererChoices(replaced.builder!).spells.find((s) => s.key === "healing-word")!.bonus).toBe("divine");
    const illegal = structuredClone(soul.builder!);illegal.creation.wizard.cantrips = ["light"];expect(() => CharacterBuilderStateSchema.parse(illegal)).toThrow();
  });
  it("conserva origen adicional al sustituir Oscuridad sin volver a concederla",async () => {
    const c = await sorcererAt(3,"shadow"),four = sorcererChoice(c),key = classSpells("sorcerer",1,2).find((k) => !four.sorcerer.learn.includes(k) && !c.spellcasting.spells.some((s) => s.casting?.key === k))!;four.sorcerer.replaceSpell = { oldKey: "darkness",newKey: key };const next = await advanceGuidedSorcerer(c,four,at);expect(replaySorcererChoices(next.builder!).spells.find((s) => s.key === key)!.bonus).toBe("shadow");expect(next.spellcasting.spells.some((s) => s.casting?.key === "darkness")).toBe(false);
  });
  it("ofrece las ocho metamagias y aplica oro/equipo, competencias y ascenso idempotente",async () => {
    for (const key of Object.keys(METAMAGIC) as Array<keyof typeof METAMAGIC>) { const c2 = await sorcererAt(2),step = sorcererChoice(c2);step.sorcerer.metamagic = [key,key === "subtle" ? "distant" : "subtle"];expect(replaySorcererChoices((await advanceGuidedSorcerer(c2,step,at)).builder!).metamagic).toContain(key); }
    const creation = sorcererCreation();creation.equipment.method = "gold";creation.equipment.goldRoll = [4,4,4];creation.equipment.purchases = [{ key: "quarterstaff",quantity: 1,equipped: true }];expect((await createGuidedSorcerer(sorcererId,sorcererOp,creation,at)).currency.gold).toBe(119);
    const c = await sorcererAt(3);c.combat.hitPoints.current = 2;c.combat.hitPoints.temporary = 5;c.spellcasting.slots["1"]!.used = 1;const four = sorcererChoice(c);four.skipImprovement = false;four.feat = FeatChoiceSchema.parse({ key: "war-caster" });const next = await advanceGuidedSorcerer(c,four,at);expect(next.combat.hitPoints.current).toBe(2);expect(next.combat.hitPoints.temporary).toBe(5);expect(next.spellcasting.slots["1"]!.used).toBe(1);expect(await advanceGuidedSorcerer(next,four,at)).toEqual(next);
  });
});
