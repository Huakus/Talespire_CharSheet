import { describe,it,expect } from "vitest";
import { clericCreation,clericChoice } from "../fixtures/cleric-builder";
import { createGuidedCleric,advanceGuidedCleric,replayClericChoices,clericPreparationLimit } from "../../src/domain/character/cleric-builder";
import { CLERIC_DOMAINS,clericDomainSpells,clericChannelUses,clericDestroyCr } from "../../src/domain/character/cleric-catalog";
import type { ClericDomain } from "../../src/domain/character/cleric-model";
import { castCharacterSpell,removeCharacterSpell,setCharacterSpellPrepared } from "../../src/domain/character/character-spells";
import { performClericAction } from "../../src/domain/character/cleric-play";
import { projectInventory,projectSpellDamageExpression } from "../../src/domain/character/character-projection";
import { BUILDER_RACES,BACKGROUND_PRESETS } from "../../src/domain/character/fighter-builder-catalog";
const id = "chr_00000000000000000000000000000001", op = "build_00000000000000000000000000000001", at = "2026-10-14T12:00:00Z";
const create = (domain: ClericDomain = "life") => createGuidedCleric(id,op,clericCreation(domain),at);
describe("Cleric PHB 2014 and Xanathar",() => {
  for (const domain of Object.keys(CLERIC_DOMAINS) as ClericDomain[]) it(`validates all twenty levels of ${domain}`,async () => {
    let c = await create(domain);
    for (let level=1;level<=20;level++) {
      if (level>1) c = await advanceGuidedCleric(c,clericChoice(c),at);
      expect(c.identity.level).toBe(level);
      const replay = replayClericChoices(c.builder!);
      expect(replay.cantrips.length).toBe((level>=10 ? 5 : level>=4 ? 4 : 3)+(["light","grave","nature"].includes(domain) ? 1 : 0));
      const free = clericDomainSpells(domain,level);
      expect(free.every((k) => c.spellcasting.spells.some((s) => s.casting?.key === k && s.prepared))).toBe(true);
      const channel = c.traits.flatMap((g) => g.traits).find((t) => t.id === c.spellcasting.cleric!.resourceIds.channel);
      expect(channel?.uses.maximum ?? 0).toBe(clericChannelUses(level));
      expect(clericDestroyCr(level)).toBe(level>=17 ? "4" : level>=14 ? "3" : level>=11 ? "2" : level>=8 ? "1" : level>=5 ? "1/2" : null);
    }
  });
  it.each(Object.keys(CLERIC_DOMAINS) as ClericDomain[])("creates every race/background combination for %s without fighter benefits",async (domain) => {
    for (const race of Object.keys(BUILDER_RACES) as Array<keyof typeof BUILDER_RACES>) for (const background of Object.keys(BACKGROUND_PRESETS) as Array<keyof typeof BACKGROUND_PRESETS>) {
      const c = await createGuidedCleric(id,op,clericCreation(domain,race,background),at);
      expect(c.combat.hitDice.dieSize).toBe(8); expect(c.checks.savingThrows.wisdom.proficiency).toBe(1); expect(c.checks.savingThrows.charisma.proficiency).toBe(1);
      expect(c.traits.flatMap((g) => g.traits).some((t) => t.name === "Segundo aliento")).toBe(false);
    }
  });
  it("enforces daily preparation, domain exemptions, rituals and armor",async () => {
    for (const domain of ["light","grave"] as const) {
      const invalid = clericCreation(domain);invalid.cleric.cantrips[0] = domain === "light" ? "light" : "spare-the-dying";
      await expect(createGuidedCleric(id,op,invalid,at)).rejects.toThrow(/trucos de clérigo distintos/);
    }
    let c = await create("knowledge");
    const keys = c.spellcasting.spells.filter((s) => s.level===1).map((s) => s.casting!.key);
    await expect(performClericAction(c,"build_00000000000000000000000000000002",{ kind: "prepare",keys,afterLongRest: true },{ expectedRevision: c.revision,updatedAt: at })).rejects.toThrow(/nivel \+ SAB/);
    c = await performClericAction(c,"build_00000000000000000000000000000003",{ kind: "prepare",keys: ["detect-magic"],afterLongRest: true },{ expectedRevision: c.revision,updatedAt: at });
    const ritual = c.spellcasting.spells.find((s) => s.casting?.key === "detect-magic")!;
    c = castCharacterSpell(c,ritual.id,1,{ expectedRevision: c.revision,updatedAt: at,mode: "ritual" }); expect(c.spellcasting.slots["1"]!.used).toBe(0);
    const unprepared = c.spellcasting.spells.find((s) => s.casting?.key === "healing-word")!;
    expect(() => castCharacterSpell(c,unprepared.id,1,{ expectedRevision: c.revision,updatedAt: at })).toThrow(/Prepará/);
    const identify = c.spellcasting.spells.find((s) => s.casting?.key === "identify")!;
    expect(identify.prepared).toBe(true);
    expect(() => removeCharacterSpell(c,identify.id,{ expectedRevision: c.revision,updatedAt: at })).toThrow(/preparación/);
    expect(() => setCharacterSpellPrepared(c,identify.id,false,{ expectedRevision: c.revision,updatedAt: at })).toThrow(/preparación/);
    expect(clericPreparationLimit(c)).toBe(4);
  });
  it("shares channel uses and records intervention cooldown separately from rests",async () => {
    let c = await create();
    while (c.identity.level<10) c = await advanceGuidedCleric(c,clericChoice(c),at);
    c = await performClericAction(c,"build_00000000000000000000000000000004",{ kind: "channel",key: "turn-undead" },{ expectedRevision: c.revision,updatedAt: at });
    c = await performClericAction(c,"build_00000000000000000000000000000005",{ kind: "channel",key: "preserve-life" },{ expectedRevision: c.revision,updatedAt: at });
    await expect(performClericAction(c,"build_00000000000000000000000000000006",{ kind: "channel",key: "preserve-life" },{ expectedRevision: c.revision,updatedAt: at })).rejects.toThrow(/usos/);
    const action = { kind: "intervention" as const,roll: 10 };
    c = await performClericAction(c,"build_00000000000000000000000000000007",action,{ expectedRevision: c.revision,updatedAt: at });
    expect(c.spellcasting.cleric!.interventionCooldownDays).toBe(7);
    const retry = await performClericAction(c,"build_00000000000000000000000000000007",action,{ expectedRevision: 0,updatedAt: at }); expect(retry).toEqual(c);
    c = await performClericAction(c,"build_00000000000000000000000000000008",{ kind: "elapsed-days",days: 7 },{ expectedRevision: c.revision,updatedAt: at }); expect(c.spellcasting.cleric!.interventionCooldownDays).toBe(0);
  });
  it("applies domain proficiencies, forge armor and potent cantrip damage",async () => {
    const low = clericCreation("light");low.baseAbilities.wisdom=8;low.baseAbilities.intelligence=15;
    const simultaneous = await Promise.all([create("light"),createGuidedCleric(id,op,low,at)]);
    expect(simultaneous.map((character) => character.traits.flatMap((g) => g.traits).find((t) => t.name === "Fulgor Protector")!.uses.maximum)).toEqual([3,1]);
    const c = await create("knowledge"); expect(c.builder!.creation.cleric.skills.every((k) => c.checks.skills[k as keyof typeof c.checks.skills].proficiency===2)).toBe(true);
    let forge = await create("forge"), light = await create("light");
    while (forge.identity.level<8) { forge = await advanceGuidedCleric(forge,clericChoice(forge),at); light = await advanceGuidedCleric(light,clericChoice(light),at); }
    expect(projectInventory(forge).calculatedArmorClass).toBe(16); // scale mail (14) + shield (2); heavy-only bonus does not apply
    const flame = light.spellcasting.spells.find((s) => s.casting?.key === "sacred-flame")!;
    expect(projectSpellDamageExpression(light,flame,0)).toBe("2d8+3");
    const grave = await create("grave"); const spare = grave.spellcasting.spells.find((s) => s.casting?.key === "spare-the-dying")!; expect(spare.definition?.range).toBe("30 pies"); expect(spare.definition?.castingTime).toContain("adicional");
  });
});
