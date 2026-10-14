import { describe,it,expect } from "vitest";
import { rogueCreation,rogueChoice,rogueAt } from "../fixtures/rogue-builder";
import { createGuidedRogue,advanceGuidedRogue,replayRogueChoices,validateRogueBuild } from "../../src/domain/character/rogue-builder";
import { ROGUE_ARCHETYPES,ROGUE_CORE,ROGUE_FEATURES,ROGUE_ASI_LEVELS,THIEVES_TOOLS } from "../../src/domain/character/rogue-catalog";
import type { RogueArchetype } from "../../src/domain/character/rogue-model";
import { EK_PROGRESSION } from "../../src/domain/character/phb-fighter-choices";
import { BUILDER_RACES,BACKGROUND_PRESETS } from "../../src/domain/character/fighter-builder-catalog";
import { FeatChoiceSchema } from "../../src/domain/character/character-builder-model";
import { projectCharacterStatistics,projectAdjustedRollMode,projectUpdatedBuilderSpeed } from "../../src/domain/character/character-projection";
import { rogueSkillMinimum,rogueThievesToolModifier } from "../../src/domain/character/rogue-play";
import { castCharacterSpell,removeCharacterSpell,setCharacterSpellPrepared } from "../../src/domain/character/character-spells";
import { applyCharacterResourceCommand } from "../../src/domain/character/character-resources";
const id = "chr_00000000000000000000000000000001", op = "build_00000000000000000000000000000001", at = "2026-10-14T12:00:00Z";

describe("Rogue PHB 2014 and Xanathar",() => {
  it.each(Object.keys(ROGUE_ARCHETYPES) as RogueArchetype[])("replays all twenty levels and every feature of %s",async (archetype) => {
    let c = await rogueAt(1);
    for (let level=1;level<=20;level++) {
      if (level>1) c = await advanceGuidedRogue(c,rogueChoice(c,archetype),at);
      expect(c.identity.level).toBe(level); expect(c.combat.hitDice.dieSize).toBe(8);
      expect(c.combat.hitPoints.maximum).toBe(10+7*(level-1));
      expect(c.checks.savingThrows.dexterity.proficiency).toBe(1); expect(c.checks.savingThrows.intelligence.proficiency).toBe(1); expect(c.checks.savingThrows.wisdom.proficiency).toBe(level>=15 ? 1 : 0);
      expect(c.actions.find((a) => a.name.startsWith("Ataque Furtivo"))!.damageExpression).toBe(`${Math.ceil(level/2)}d6`);
      expect(c.identity.subclass).toBe(level>=3 ? ROGUE_ARCHETYPES[archetype] : "");
      const resources = c.spellcasting.rogue!.resourceIds;
      for (const f of [...ROGUE_CORE,...(level>=3 ? ROGUE_FEATURES[archetype] : [])]) expect(Boolean(resources[f.key])).toBe(f.level<=level);
      if (archetype === "arcane-trickster" && level>=3) {
        const known = replayRogueChoices(c.builder!); expect(known.spells).toHaveLength(EK_PROGRESSION[level]!.known); expect(known.cantrips).toHaveLength(level>=10 ? 4 : 3); expect(known.cantrips).toContain("mage-hand");
        expect(Object.values(c.spellcasting.slots).slice(0,4).map((s) => s.maximum)).toEqual(EK_PROGRESSION[level]!.slots);
      }
      expect(c.traits.flatMap((g) => g.traits).some((t) => /Segundo aliento|Ataque Extra/.test(t.name))).toBe(false);
    }
  });
  it.each(Object.keys(BUILDER_RACES) as Array<keyof typeof BUILDER_RACES>)("creates every PHB background with %s",async (race) => {
    for (const background of Object.keys(BACKGROUND_PRESETS) as Array<keyof typeof BACKGROUND_PRESETS>) {
      const c = await createGuidedRogue(id,op,rogueCreation(race,background),at);
      expect(c.proficiencies.tools).toContain(THIEVES_TOOLS); expect(c.builder!.creation.skills).toHaveLength(4);
      expect(c.proficiencies.armor).not.toContain("Escudos"); expect(c.checks.skills[c.builder!.creation.skills[0]!].proficiency).toBe(2);
    }
  });
  it.each(Object.keys(ROGUE_ARCHETYPES) as RogueArchetype[])("validates %s choices with all race/background combinations",async (archetype) => {
    for(const race of Object.keys(BUILDER_RACES) as Array<keyof typeof BUILDER_RACES>) for(const background of Object.keys(BACKGROUND_PRESETS) as Array<keyof typeof BACKGROUND_PRESETS>) {
      let c=await createGuidedRogue(id,op,rogueCreation(race,background),at);
      c=await advanceGuidedRogue(c,rogueChoice(c,archetype),at);c=await advanceGuidedRogue(c,rogueChoice(c,archetype),at);
      expect(c.identity.subclass).toBe(ROGUE_ARCHETYPES[archetype]);expect(new Set(c.proficiencies.tools).size).toBe(c.proficiencies.tools.length);
    }
  },15000);
  it("validates four skills, new expertise and the level ten ASI",async () => {
    const bad = rogueCreation(); bad.skills.pop(); await expect(createGuidedRogue(id,op,bad,at)).rejects.toThrow(/cuatro/);
    const bg = rogueCreation(); bg.background.tools = [THIEVES_TOOLS]; bg.background.languages = ["Élfico"]; await expect(createGuidedRogue(id,op,bg,at)).rejects.toThrow(/ya concede/);
    const unknown = rogueCreation(); unknown.rogue.expertise[0] = "medicine"; await expect(createGuidedRogue(id,op,unknown,at)).rejects.toThrow(/pericias/);
    const five = await rogueAt(5); const six = rogueChoice(five); six.rogue.expertise[0] = five.builder!.creation.rogue.expertise[0]!; await expect(advanceGuidedRogue(five,six,at)).rejects.toThrow(/pericias/);
    const nine = await rogueAt(9), ten = rogueChoice(nine); ten.skipImprovement=false; await expect(advanceGuidedRogue(nine,ten,at)).rejects.toThrow(/puntos/);
    ten.abilityIncrease={ strength:0,dexterity:2,constitution:0,intelligence:0,wisdom:0,charisma:0 }; const c=await advanceGuidedRogue(nine,ten,at);expect(c.abilities.dexterity).toBe(nine.abilities.dexterity+2);
    expect(ROGUE_ASI_LEVELS).toEqual([4,8,10,12,16,19]);
  });
  it("grants correct scout, swashbuckler, expertise and reliable talent benefits",async () => {
    const scout=await rogueAt(13,"scout"), swash=await rogueAt(3,"swashbuckler");
    expect(scout.checks.skills.nature.proficiency).toBe(2);expect(scout.checks.skills.survival.proficiency).toBe(2);expect(scout.combat.speed).toBe("40 ft");expect(projectAdjustedRollMode(scout,"skills",["Initiative"],"normal")).toBe("advantage");
    expect(projectCharacterStatistics(swash).initiativeModifier).toBe(3); // human DEX16 (+3), CHA11 (+0)
    expect(rogueThievesToolModifier(scout)).toBe(13); // DEX3 + twice proficiency5? level13 proficiency5 => 13
    expect(rogueSkillMinimum(scout,scout.builder!.creation.skills[0]!)).toBe(10);expect(rogueSkillMinimum(scout,"medicine")).toBe(1);
    const inquisitive=await rogueAt(3,"inquisitive");expect(rogueSkillMinimum(inquisitive,"insight",true)).toBe(8);expect(rogueSkillMinimum(inquisitive,"insight")).toBe(1);
    const eight=await rogueAt(8,"scout");eight.combat.speed="30 ft; trepar 20 ft; nadar 15 ft; volar 60 ft";
    const nine=await advanceGuidedRogue(eight,rogueChoice(eight),at);expect(nine.combat.speed).toBe("40 ft; trepar 30 ft; nadar 25 ft; volar 60 ft");expect(projectUpdatedBuilderSpeed(nine,nine)).toBe(nine.combat.speed);
    const charismatic=structuredClone(swash);charismatic.abilities.charisma=16;expect(projectCharacterStatistics(charismatic).initiativeModifier).toBe(6);
  });
  it("grants every equipment package and uses four gold dice instead of packages",async () => {
    for(const weapon of ["rapier","shortsword"] as const) for(const secondary of ["shortbow","shortsword"] as const) for(const pack of ["burglar","dungeoneer","explorer"] as const) {
      const creation=rogueCreation();creation.rogueWeapon=weapon;creation.rogueSecondary=secondary;creation.roguePack=pack;const c=await createGuidedRogue(id,op,creation,at);
      expect(c.inventory.filter((i) => i.name==="Daga").reduce((n,i) => n+i.quantity,0)).toBe(2);expect(c.inventory.some((i) => i.name==="Herramientas de ladrón")).toBe(true);expect(c.actions.filter((a) => a.inventoryItemId).every((a) => a.proficient)).toBe(true);
      expect(c.inventory.filter((i) => i.name==="Flecha").reduce((n,i) => n+i.quantity,0)).toBe(secondary==="shortbow" ? 20 : 0);
    }
    const gold=rogueCreation();gold.equipment.method="gold";gold.equipment.goldRoll=[4,4,4,4];gold.equipment.purchases=[{key:"dagger",quantity:1,equipped:true}];const c=await createGuidedRogue(id,op,gold,at);expect(c.currency.gold).toBe(158);expect(c.inventory).toHaveLength(1);expect(c.proficiencies.tools).toContain(THIEVES_TOOLS);
  });
  it("keeps free school spell slots through replacement and protects known spells",async () => {
    const c=await rogueAt(3,"arcane-trickster"), four=rogueChoice(c), replay=replayRogueChoices(c.builder!);
    const free = replay.spells.find((s) => s.unrestricted)!, restricted = replay.spells.find((s) => !s.unrestricted)!;
    four.rogue.replace={oldKey:free.key,newKey:"shield"}; const next=await advanceGuidedRogue(c,four,at);expect(replayRogueChoices(next.builder!).spells.find((s) => s.key==="shield")!.unrestricted).toBe(true);
    const bad=rogueChoice(c);bad.rogue.replace={oldKey:restricted.key,newKey:"shield"};await expect(advanceGuidedRogue(c,bad,at)).rejects.toThrow(/escuela/);
    const duplicate=rogueChoice(c);duplicate.rogue.learn[0]!.key=replay.spells[0]!.key;await expect(advanceGuidedRogue(c,duplicate,at)).rejects.toThrow(/conjuros nuevos/);
    const spell=next.spellcasting.spells.find((s) => s.casting?.key==="shield")!;
    expect(() => removeCharacterSpell(next,spell.id,{expectedRevision:next.revision,updatedAt:at})).toThrow(/Sustituí/);expect(() => setCharacterSpellPrepared(next,spell.id,false,{expectedRevision:next.revision,updatedAt:at})).toThrow(/preparación/);
    expect(() => castCharacterSpell(next,spell.id,1,{expectedRevision:next.revision,updatedAt:at,mode:"ritual"})).toThrow(/ritual/);
    const cast=castCharacterSpell(next,spell.id,1,{expectedRevision:next.revision,updatedAt:at});expect(cast.spellcasting.slots["1"]!.used).toBe(1);
    const advanced=await advanceGuidedRogue(cast,rogueChoice(cast),at);expect(advanced.spellcasting.slots["1"]!.used).toBe(1);expect(advanced.combat.hitPoints.current).toBe(cast.combat.hitPoints.current);
    const short=applyCharacterResourceCommand(advanced,{kind:"short-rest"},{expectedRevision:advanced.revision,updatedAt:at}).character;expect(short.spellcasting.slots["1"]!.used).toBe(1);
    const long=applyCharacterResourceCommand(short,{kind:"long-rest"},{expectedRevision:short.revision,updatedAt:at}).character;expect(long.spellcasting.slots["1"]!.used).toBe(0);
  });
  it("permits armor and caster feats according to rogue proficiencies",async () => {
    const c=await rogueAt(3,"arcane-trickster"), four=rogueChoice(c);four.skipImprovement=false;four.feat=FeatChoiceSchema.parse({key:"war-caster"});await expect(advanceGuidedRogue(c,four,at)).resolves.toBeDefined();
    const thief=await rogueAt(3), feat=rogueChoice(thief);feat.skipImprovement=false;feat.feat=FeatChoiceSchema.parse({key:"moderately-armored",ability:"dexterity"});const medium=await advanceGuidedRogue(thief,feat,at);expect(medium.proficiencies.armor).toContain("Armaduras medias");
    const foreign=structuredClone(c.builder!);foreign.levels[0]!.rogue.cantrips=["light"];expect(() => validateRogueBuild(foreign)).toThrow();
  });
});
