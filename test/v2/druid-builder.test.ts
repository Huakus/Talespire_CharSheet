import { describe,it,expect } from "vitest";
import { druidAt,druidChoice,druidCreation,druidId,druidOp,druidAtTime as at } from "../fixtures/druid-builder";
import { createGuidedDruid,advanceGuidedDruid,replayDruidChoices,validateDruidBuild,druidPreparationLimit } from "../../src/domain/character/druid-builder";
import { DRUID_CIRCLES,DRUID_LANDS,DRUID_CORE,DRUID_FEATURES,DRUID_WEAPONS,HERBALISM,druidCantrips,druidCircleSpells,wildShapeLimit } from "../../src/domain/character/druid-catalog";
import { BUILDER_RACES,BACKGROUND_PRESETS,BUILDER_WEAPONS } from "../../src/domain/character/fighter-builder-catalog";
import { WIZARD_SLOTS } from "../../src/domain/character/wizard-catalog";
import type { DruidCircle,DruidLand } from "../../src/domain/character/druid-model";
import { CharacterBuilderStateSchema,FeatChoiceSchema } from "../../src/domain/character/character-builder-model";
import { classSpells,PHB_SPELLS } from "../../src/domain/character/phb-spells";
describe("Druida PHB 2014 y Xanathar",() => {
  it.each(Object.keys(DRUID_CIRCLES) as DruidCircle[])("proyecta %s de 1 a 20 con todos sus rasgos",async (circle) => {
    let c = await druidAt();
    for (let level=1;level<=20;level++) {
      if (level > 1) c = await advanceGuidedDruid(c,druidChoice(c,circle),at);
      const replay = replayDruidChoices(c.builder!);expect(replay.cantrips).toHaveLength(druidCantrips(level)+(circle === "land" && level >= 2 ? 1 : 0));
      expect(c.combat.hitDice.dieSize).toBe(8);expect(c.combat.hitPoints.maximum).toBe(10+(level-1)*7);
      expect(c.checks.savingThrows.intelligence.proficiency).toBe(1);expect(c.checks.savingThrows.wisdom.proficiency).toBe(1);expect(c.checks.savingThrows.constitution.proficiency).toBe(0);
      expect(Array.from({ length: 9 },(_,i) => c.spellcasting.slots[String(i+1)]!.maximum)).toEqual([...WIZARD_SLOTS[level]!,...Array(9-WIZARD_SLOTS[level]!.length).fill(0)]);
      const names = c.traits.flatMap((g) => g.traits).map((t) => t.name);expect([...DRUID_CORE,...(level >= 2 ? DRUID_FEATURES[circle] : [])].filter((f) => f.level <= level).every((f) => names.includes(f.name))).toBe(true);
      const prepared = c.spellcasting.spells.filter((s) => s.casting?.kind === "druid" && s.prepared && s.level > 0 && !replay.circleSpells.includes(s.casting.key));expect(prepared.length).toBeLessThanOrEqual(druidPreparationLimit(c));
      expect(c.spellcasting.spells.filter((s) => s.casting?.kind === "druid").every((s) => s.casting!.ability === "wisdom")).toBe(true);expect(() => validateDruidBuild(c.builder!)).not.toThrow();
    }
    expect(c.proficiencies.tools).toContain(HERBALISM);expect(c.proficiencies.languages).toContain("Druídico");expect(c.proficiencies.languages.includes("Silvano")).toBe(circle === "shepherd");
    for (const key of DRUID_WEAPONS) expect(c.proficiencies.weapons).toContain(BUILDER_WEAPONS[key]!.name);
  });
  it.each(Object.keys(DRUID_LANDS) as DruidLand[])("proyecta los ocho conjuros siempre preparados de %s",async (land) => {
    const c = await druidAt(9,"land",land),free = druidCircleSpells(c.builder!);expect(free).toHaveLength(8);expect(free.every((key) => PHB_SPELLS[key])).toBe(true);expect(free.every((key) => c.spellcasting.spells.find((s) => s.casting?.key === key)?.prepared)).toBe(true);
    expect(c.identity.subclass).toContain(DRUID_LANDS[land]);
  });
  it.each(Object.keys(DRUID_CIRCLES) as DruidCircle[])("crea %s con las 270 combinaciones de raza y trasfondo",async (circle) => {
    for (const race of Object.keys(BUILDER_RACES) as Array<keyof typeof BUILDER_RACES>) for (const bg of Object.keys(BACKGROUND_PRESETS) as Array<keyof typeof BACKGROUND_PRESETS>) {
      let c = await createGuidedDruid(druidId,druidOp,druidCreation(race,bg),at);c = await advanceGuidedDruid(c,druidChoice(c,circle),at);c = await advanceGuidedDruid(c,druidChoice(c,circle),at);expect(c.identity.subclass).toContain(DRUID_CIRCLES[circle]);expect(c.combat.hitDice.dieSize).toBe(8);
    }
  },30000);
  it("valida terreno/círculo/trucos por nivel, preparación, d8 y clases ajenas",async () => {
    const initial = druidCreation();initial.druid.circle = "land";await expect(createGuidedDruid(druidId,druidOp,initial,at)).rejects.toThrow(/Druida 2/);
    const c = await druidAt(1),step = druidChoice(c);step.druid.bonusCantrip = "thorn-whip";await expect(advanceGuidedDruid(c,step,at)).rejects.toThrow(/trucos/);
    const c2 = await druidAt(2);const noLand = druidChoice(c2);noLand.druid.land = null;await expect(advanceGuidedDruid(c2,noLand,at)).rejects.toThrow(/terreno/);
    const bad = druidChoice(c);bad.hpBase = 6;await expect(advanceGuidedDruid(c,bad,at)).rejects.toThrow(/5 PG/);
    const over = druidCreation();over.druid.prepared = classSpells("druid",1).slice(0,10);await expect(createGuidedDruid(druidId,druidOp,over,at)).rejects.toThrow(/Prepará/);
    const foreign = structuredClone(c.builder!);foreign.creation.bard.cantrips = ["light"];expect(() => CharacterBuilderStateSchema.parse(foreign)).toThrow();
    const tools = druidCreation();tools.background.tools = [HERBALISM];tools.background.languages.pop();await expect(createGuidedDruid(druidId,druidOp,tools,at)).rejects.toThrow(/herborista/);
  });
  it("admite todas las alternativas iniciales legales, oro 2d4 y dotes de lanzador/armadura",async () => {
    for (const [key,d] of Object.entries(BUILDER_WEAPONS).filter(([,d]) => d.weapon!.category.startsWith("simple"))) { const creation = druidCreation();creation.druidPrimary = key;const c = await createGuidedDruid(druidId,druidOp,creation,at);expect(c.inventory.some((i) => i.name === d.name)).toBe(true);if (d.weapon!.range === "melee") { creation.druidWeapon = key;await expect(createGuidedDruid(druidId,druidOp,creation,at)).resolves.toBeDefined(); } }
    const gold = druidCreation();gold.equipment.method = "gold";gold.equipment.goldRoll = [4,4];gold.equipment.purchases = [{ key: "scimitar",quantity: 1,equipped: true }];const c = await createGuidedDruid(druidId,druidOp,gold,at);expect(c.currency.gold).toBe(55);expect(c.inventory).toHaveLength(1);
    const c3 = await druidAt(3),four = druidChoice(c3);four.skipImprovement = false;four.feat = FeatChoiceSchema.parse({ key: "war-caster" });await expect(advanceGuidedDruid(c3,four,at)).resolves.toBeDefined();four.feat = FeatChoiceSchema.parse({ key: "heavily-armored",ability: "strength" });await expect(advanceGuidedDruid(c3,four,at)).resolves.toBeDefined();
    expect([2,4,8,18].map((n) => wildShapeLimit(n,"land"))).toEqual([0.25,0.5,1,1]);expect([2,6,9,12,15,18].map((n) => wildShapeLimit(n,"moon"))).toEqual([1,2,3,4,5,6]);
  });
  it("conserva gastos, daños, preparación e idempotencia al avanzar",async () => {
    const c = await druidAt(3);c.combat.hitPoints.current = 3;c.combat.hitPoints.temporary = 7;c.spellcasting.slots["1"]!.used = 1;
    const prepared = c.spellcasting.spells.filter((s) => s.casting?.kind === "druid" && s.prepared && s.level > 0 && !druidCircleSpells(c.builder!).includes(s.casting.key)).map((s) => s.casting!.key);
    const step = druidChoice(c),next = await advanceGuidedDruid(c,step,at);expect(next.combat.hitPoints.current).toBe(3);expect(next.combat.hitPoints.temporary).toBe(7);expect(next.spellcasting.slots["1"]!.used).toBe(1);expect(prepared.every((key) => next.spellcasting.spells.find((s) => s.casting?.key === key)?.prepared)).toBe(true);expect(await advanceGuidedDruid(next,step,at)).toEqual(next);await expect(advanceGuidedDruid(next,{ ...step,hpMethod: "rolled",hpBase: 8 },at)).rejects.toThrow(/otras elecciones/);
  });
});
