import { describe,it,expect } from "vitest";
import { bardAt,bardChoice,bardCreation,bardId,bardOp,bardAtTime as at } from "../fixtures/bard-builder";
import { createGuidedBard,advanceGuidedBard,replayBardChoices,validateBardBuild } from "../../src/domain/character/bard-builder";
import { BARD_COLLEGES,BARD_KNOWN,BARD_SKILLS,bardCantrips,BARD_CORE,BARD_FEATURES } from "../../src/domain/character/bard-catalog";
import { BUILDER_RACES,BACKGROUND_PRESETS,BUILDER_WEAPONS } from "../../src/domain/character/fighter-builder-catalog";
import { WIZARD_SLOTS } from "../../src/domain/character/wizard-catalog";
import type { BardCollege } from "../../src/domain/character/bard-model";
import { CharacterBuilderStateSchema,FeatChoiceSchema } from "../../src/domain/character/character-builder-model";
import { projectCharacterStatistics,projectAbilityCheckModifier,projectActionDamageBonus,proficiencyBonus,abilityModifier } from "../../src/domain/character/character-projection";
import { classSpells } from "../../src/domain/character/phb-spells";
describe("Bardo PHB 2014 y Xanathar",() => {
  it.each(Object.keys(BARD_COLLEGES) as BardCollege[])("proyecta %s completo de 1 a 20",async (college) => {
    let c = await bardAt();
    for (let level=1;level<=20;level++) {
      if (level > 1) c = await advanceGuidedBard(c,bardChoice(c,college),at);
      const replay = replayBardChoices(c.builder!);
      expect(replay.cantrips).toHaveLength(bardCantrips(level));
      expect(replay.spells.filter((s) => !s.bonus)).toHaveLength(BARD_KNOWN[level]!);
      expect(replay.spells.filter((s) => s.bonus)).toHaveLength(college === "lore" && level >= 6 ? 2 : 0);
      expect(c.combat.hitDice.dieSize).toBe(8);
      expect(c.combat.hitPoints.maximum).toBe(10+(level-1)*7);
      expect(c.checks.savingThrows.dexterity.proficiency).toBe(1); expect(c.checks.savingThrows.charisma.proficiency).toBe(1); expect(c.checks.savingThrows.wisdom.proficiency).toBe(0);
      expect(Array.from({ length: 9 },(_,i) => c.spellcasting.slots[String(i+1)]!.maximum)).toEqual([...WIZARD_SLOTS[level]!,...Array(9-WIZARD_SLOTS[level]!.length).fill(0)]);
      const names = c.traits.flatMap((g) => g.traits).map((t) => t.name);
      expect([...BARD_CORE,...(level >= 3 ? BARD_FEATURES[college] : [])].filter((f) => f.level <= level).every((f) => names.includes(f.name))).toBe(true);
      expect(c.spellcasting.spells.filter((s) => s.casting?.source === "builder:bard")).toHaveLength(bardCantrips(level)+BARD_KNOWN[level]!+(college === "lore" && level >= 6 ? 2 : 0));
      expect(() => validateBardBuild(c.builder!)).not.toThrow();
    }
    expect(BARD_SKILLS.filter((s) => c.checks.skills[s].proficiency === 2)).toHaveLength(4);
    expect(c.identity.subclass).toBe(BARD_COLLEGES[college]);
    expect(c.proficiencies.armor.includes("Armaduras medias")).toBe(["valor","swords"].includes(college));
    expect(c.proficiencies.armor.includes("Escudos")).toBe(college === "valor");
    expect(c.proficiencies.weapons.includes("Armas marciales")).toBe(college === "valor");
  });
  it.each(Object.keys(BARD_COLLEGES) as BardCollege[])("admite %s con las 15 razas y 18 trasfondos",async (college) => {
    for (const race of Object.keys(BUILDER_RACES) as Array<keyof typeof BUILDER_RACES>) for (const bg of Object.keys(BACKGROUND_PRESETS) as Array<keyof typeof BACKGROUND_PRESETS>) {
      let c = await createGuidedBard(bardId,bardOp,bardCreation(race,bg),at); c = await advanceGuidedBard(c,bardChoice(c,college),at); c = await advanceGuidedBard(c,bardChoice(c,college),at);
      expect(c.identity.subclass).toBe(BARD_COLLEGES[college]); expect(c.proficiencies.tools).toEqual(expect.arrayContaining(c.builder!.creation.bard.instruments));
    }
  },30000);
  it("calcula Polivalente sin acumular medias competencias ni afectar ataques o salvaciones",async () => {
    for (const level of [1,2,5,9,13,17,20]) {
      const c = await bardAt(level,"valor"),p = projectCharacterStatistics(c),half = level >= 2 ? Math.floor(proficiencyBonus(level)/2) : 0;
      const key = BARD_SKILLS.find((s) => c.checks.skills[s].proficiency === 0)!;
      c.checks.skills[key].proficiency = 0; const definition = (await import("../../src/domain/character/character-checks")).SKILL_DEFINITIONS[key];
      expect(p.skills[key]).toBe(abilityModifier(c.abilities[definition.ability])+half);
      expect(p.initiativeModifier).toBe(abilityModifier(c.abilities.dexterity)+half);
      expect(projectAbilityCheckModifier(c,"charisma")).toBe(abilityModifier(c.abilities.charisma)+half);
      expect(p.savingThrows.wisdom).toBe(abilityModifier(c.abilities.wisdom));
      c.checks.skills[key].proficiency = 0.5; expect(projectCharacterStatistics(c).skills[key]).toBe(abilityModifier(c.abilities[definition.ability])+Math.floor(proficiencyBonus(level)/2));
    }
  });
  it("conserva la procedencia y el cupo al sustituir secretos incluso trucos",async () => {
    let c = await bardAt(5),step = bardChoice(c); step.bard.secrets = ["eldritch-blast","counterspell"]; c = await advanceGuidedBard(c,step,at);
    step = bardChoice(c);step.bard.replaceSpell = { oldKey: "counterspell",newKey: "dispel-magic" };step.bard.learn = step.bard.learn.filter((s) => s !== "dispel-magic");if (!step.bard.learn.length) step.bard.learn = ["dimension-door"];
    c = await advanceGuidedBard(c,step,at);expect(replayBardChoices(c.builder!).spells.find((s) => s.key === "dispel-magic")!.bonus).toBe(true);
    step = bardChoice(c);step.bard.replaceSpell = { oldKey: "eldritch-blast",newKey: "polymorph" };c = await advanceGuidedBard(c,step,at);
    expect(replayBardChoices(c.builder!).spells.filter((s) => s.bonus)).toHaveLength(2);
    step = bardChoice(c);step.bard.replaceSpell = { oldKey: "polymorph",newKey: "fireball" };await expect(advanceGuidedBard(c,step,at)).rejects.toThrow(/lista de Bardo/);
  });
  it("valida elecciones fuera de nivel, duplicados, límites, pericias y clases ajenas",async () => {
    const initial = bardCreation();initial.bard.instruments[1] = initial.bard.instruments[0]!;await expect(createGuidedBard(bardId,bardOp,initial,at)).rejects.toThrow(/distintas/);
    const c = await bardAt(2); const step = bardChoice(c);step.bard.expertise = ["stealth","stealth"];await expect(advanceGuidedBard(c,step,at)).rejects.toThrow(/distintas/);
    const bad = bardChoice(c);bad.hpBase = 6;await expect(advanceGuidedBard(c,bad,at)).rejects.toThrow(/5 PG/);
    const foreign = structuredClone(c.builder!);foreign.creation.barbarian.path = "berserker";expect(() => CharacterBuilderStateSchema.parse(foreign)).toThrow();
    const c9 = await bardAt(9);const ten = bardChoice(c9);ten.bard.learn = ["animate-objects"];await expect(advanceGuidedBard(c9,ten,at)).rejects.toThrow(/0 opciones/);
    const c3 = await bardAt(3,"swords"),four = bardChoice(c3);four.skipImprovement = false;four.feat = FeatChoiceSchema.parse({ key: "heavily-armored",ability: "strength" });await expect(advanceGuidedBard(c3,four,at)).resolves.toBeDefined();
    four.feat = FeatChoiceSchema.parse({ key: "war-caster" });await expect(advanceGuidedBard(c3,four,at)).resolves.toBeDefined();
  });
  it("admite todas las alternativas de equipo, oro y los dos estilos de Espadas",async () => {
    for (const [key,d] of Object.entries(BUILDER_WEAPONS).filter(([key,d]) => ["rapier","longsword"].includes(key) || d.weapon?.category.startsWith("simple"))) { const creation = bardCreation();creation.bardWeapon = key;const c = await createGuidedBard(bardId,bardOp,creation,at);expect(c.actions.find((a) => a.name === d.name)?.proficient).toBe(true); }
    const gold = bardCreation();gold.equipment.method = "gold";gold.equipment.goldRoll = [4,4,4,4,4];gold.equipment.purchases = [{ key: "rapier",quantity: 1,equipped: true }];const c = await createGuidedBard(bardId,bardOp,gold,at);expect(c.currency.gold).toBe(175);expect(c.inventory).toHaveLength(1);
    const c2 = await bardAt(2);const step = bardChoice(c2,"swords");step.bard.style = "two-weapon";expect((await advanceGuidedBard(c2,step,at)).builder!.levels.at(-1)!.bard.style).toBe("two-weapon");
    const duelist = await bardAt(3,"swords"),rapier = duelist.actions.find((a) => a.name === "Estoque")!;expect(projectActionDamageBonus(duelist,rapier)).toBe(rapier.damageBonus+2);
  });
  it("preserva daños, gastos, ajustes y reintentos durante los ascensos",async () => {
    const c = await bardAt(9); c.combat.hitPoints.current -= 8;c.combat.hitPoints.temporary = 7;c.spellcasting.slots["1"]!.used = 2;c.combat.hitDice.remaining -= 3;
    const pool = c.traits.flatMap((g) => g.traits).find((t) => t.id === c.spellcasting.bard!.inspirationId)!;pool.uses.used = 1;pool.effect.description = "nota propia";
    const step = bardChoice(c),next = await advanceGuidedBard(c,step,at);expect(next.combat.hitPoints.current).toBe(c.combat.hitPoints.current);expect(next.combat.hitPoints.temporary).toBe(7);expect(next.spellcasting.slots["1"]!.used).toBe(2);expect(next.combat.hitDice.remaining).toBe(c.combat.hitDice.remaining+1);
    expect(next.traits.flatMap((g) => g.traits).find((t) => t.id === pool.id)!.effect.description).toBe("nota propia");expect(await advanceGuidedBard(next,step,at)).toEqual(next);await expect(advanceGuidedBard(next,{ ...step,hpMethod: "rolled",hpBase: 8 },at)).rejects.toThrow(/otras elecciones/);
  });
});
