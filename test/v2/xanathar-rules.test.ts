import { describe,it,expect } from "vitest";
import { createGuidedFighter,advanceGuidedFighter } from "../../src/domain/character/fighter-builder";
import { phbFighterCreation,completeFighterChoice } from "../fixtures/phb-fighter-builder";
import { createGuidedWarlock,advanceGuidedWarlock } from "../../src/domain/character/warlock-builder";
import { phbWarlockCreation,completeWarlockChoice } from "../fixtures/phb-warlock-builder";
import { createGuidedWizard,advanceGuidedWizard } from "../../src/domain/character/wizard-builder";
import { phbWizardCreation,completeWizardChoice } from "../fixtures/phb-wizard-builder";
import { XANATHAR_FEATS } from "../../src/domain/character/xanathar-feats";
import { FeatChoiceSchema,type FighterCreation } from "../../src/domain/character/character-builder-model";
import { PHB_SPELLS,XANATHAR_SPELL_KEYS,classSpells } from "../../src/domain/character/phb-spells";
import { TOOLS,LANGUAGES } from "../../src/domain/character/phb-character-options";
import { projectCharacterStatistics,projectInventory } from "../../src/domain/character/character-projection";
import { applyWizardAction } from "../../src/domain/character/wizard-play";
import { castCharacterSpell } from "../../src/domain/character/character-spells";
import { applyWarlockAction } from "../../src/domain/character/warlock-play";
import { applyCharacterResourceCommand } from "../../src/domain/character/character-resources";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
const id="chr_00000000000000000000000000000001",op="build_00000000000000000000000000000001",at="2026-10-14T00:00:00Z";
const rest = (c: CharacterV2,kind: "short-rest" | "long-rest") => applyCharacterResourceCommand(c,{ kind },{ expectedRevision: c.revision,updatedAt: at }).character;
describe("Xanathar expansion for guided classes",() => {
  it("contains all 95 spells with correct class membership and Spanish content",() => {
    expect(XANATHAR_SPELL_KEYS.size).toBe(95);expect(Object.keys(PHB_SPELLS)).toHaveLength(456);
    expect(classSpells("wizard",0).filter((k) => XANATHAR_SPELL_KEYS.has(k))).toHaveLength(9);
    expect(classSpells("wizard",0,9).filter((k) => XANATHAR_SPELL_KEYS.has(k))).toHaveLength(77);
    expect(classSpells("warlock",0,9).filter((k) => XANATHAR_SPELL_KEYS.has(k))).toHaveLength(36);
    expect(classSpells("cleric",0,9).filter((k) => XANATHAR_SPELL_KEYS.has(k))).toHaveLength(7);
    expect(classSpells("cleric",4)).toContain("divination");expect(classSpells("cleric",4)).not.toContain("arcane-eye");
    expect(classSpells("druid",3)).toContain("meld-into-stone");expect(classSpells("druid",3)).not.toContain("create-food-and-water");
    expect(classSpells("bard",1)).toContain("faerie-fire");
    expect(PHB_SPELLS["skill-empowerment"]!.school).toBe("Transmutación");
    expect(PHB_SPELLS["mind-spike"]!.higherLevels).toContain("1d8");
    expect(PHB_SPELLS["healing-spirit"]!.description).toContain("mínimo dos");
    for (const key of XANATHAR_SPELL_KEYS) { expect(PHB_SPELLS[key]!.name).not.toBe(key);expect(PHB_SPELLS[key]!.description.length).toBeGreaterThan(50); }
  });
  for (const subclass of ["arcane-archer","cavalier","samurai"] as const) it(`advances ${subclass} through every level`,async () => {
    let c = await createGuidedFighter(id,op,phbFighterCreation(),at);
    for (let level=2;level<=20;level++) c = await advanceGuidedFighter(c,completeFighterChoice(c,subclass),at);
    if (subclass === "arcane-archer") { expect(c.builder!.levels.flatMap((s) => s.xanathar.shots)).toHaveLength(6);expect(c.spellcasting.spells.some((s) => s.casting?.key === "prestidigitation")).toBe(true); }
    if (subclass === "samurai") expect(c.checks.savingThrows.wisdom.proficiency).toBe(1);
    if (subclass === "cavalier") expect(c.traits.flatMap((g) => g.traits).map((t) => t.name)).toContain("Defensor Vigilante");
  });
  for (const [key,definition] of Object.entries(XANATHAR_FEATS)) it(`validates racial prerequisite and grants ${key}`,async () => {
    const creation = phbFighterCreation(definition.races[0] as FighterCreation["race"]);
    let c = await createGuidedFighter(id,op,creation,at); while (c.identity.level<3) c = await advanceGuidedFighter(c,completeFighterChoice(c),at);
    const feat = FeatChoiceSchema.parse({ key,ability: definition.abilities[0] ?? null });
    const fresh = Object.entries(c.checks.skills).filter(([,s]) => s.proficiency===0).map(([k]) => k);
    if (key === "prodigy") { feat.skills=[fresh[0] as typeof feat.skills[number]];feat.expertise=feat.skills[0]!;feat.tools=[TOOLS.find((k) => !c.proficiencies.tools.includes(k))!];feat.languages=[LANGUAGES.find((k) => !c.proficiencies.languages.includes(k))!]; }
    if (key === "squat-nimbleness") feat.skills=[fresh.find((k) => ["acrobatics","athletics"].includes(k)) as typeof feat.skills[number]];
    if (key === "wood-elf-magic") feat.spells=["druidcraft"];
    const step=completeFighterChoice(c);step.abilityIncrease=null;step.feat=feat;c=await advanceGuidedFighter(c,step,at);
    expect(c.traits.flatMap((g) => g.traits).some((t) => t.name === definition.name)).toBe(true);
    if (key === "prodigy") expect(c.checks.skills[feat.expertise!].proficiency).toBe(2);
    if (key === "dragon-hide") { c.inventory.forEach((i) => i.equipped=false);expect(projectInventory(c).calculatedArmorClass).toBe(13+Math.floor((c.abilities.dexterity-10)/2));expect(c.actions.find((a) => a.weaponType === "unarmed")!.damageExpression).toBe("1d4"); }
    if (key === "drow-high-magic") { const spell=c.spellcasting.spells.find((s) => s.casting?.key === "detect-magic")!;c=castCharacterSpell(c,spell.id,1,{ expectedRevision: c.revision,updatedAt: at });expect(c.spellcasting.slots["1"]!.used).toBe(0); }
    if (key === "fey-teleportation") expect(c.proficiencies.languages).toContain("Silvano");
    if (key !== "prodigy") { const wrong=await createGuidedFighter(id,op,phbFighterCreation("human"),at); let third=wrong;while(third.identity.level<3) third=await advanceGuidedFighter(third,completeFighterChoice(third),at);const invalid=completeFighterChoice(third);invalid.abilityIncrease=null;invalid.feat=feat;await expect(advanceGuidedFighter(third,invalid,at)).rejects.toThrow(/racial/); }
  });
  it("tracks War Magic defenses, cantrip restriction and power surges",async () => {
    let c=await createGuidedWizard(id,op,phbWizardCreation(),at);while(c.identity.level<10) c=await advanceGuidedWizard(c,completeWizardChoice(c,"war-magic"),at);
    expect(c.spellcasting.wizard!.powerSurges).toBe(1);
    const initial=projectCharacterStatistics(c);c.combat.conditions.push({ id:"cnd_00000000000000000000000000000001",key:"concentration",label:"Concentración",level:null,addedAt:at });
    expect(projectInventory(c).calculatedArmorClass).toBe(c.combat.armorClass+2);expect(projectCharacterStatistics(c).savingThrows.wisdom).toBe(initial.savingThrows.wisdom+2);
    c=await applyWizardAction(c,{ kind:"arcane-deflection" },{ operationId:"wizard_00000000000000000000000000000002",expectedRevision:c.revision,updatedAt:at });
    const spell=c.spellcasting.spells.find((s) => s.level===1 && s.prepared)!;expect(() => castCharacterSpell(c,spell.id,1,{ expectedRevision:c.revision,updatedAt:at })).toThrow(/solo podés lanzar trucos/);
    c=await applyWizardAction(c,{ kind:"power-surge-spend",oncePerTurn:true },{ operationId:"wizard_00000000000000000000000000000003",expectedRevision:c.revision,updatedAt:at });expect(c.spellcasting.wizard!.powerSurges).toBe(0);c=rest(c,"short-rest");expect(c.spellcasting.wizard!.powerSurges).toBe(1);expect(c.spellcasting.wizard!.arcaneDeflection).toBe(false);
  });
  it("manages Celestial dice and Hexblade pact weapon / smite resources",async () => {
    let celestial=await createGuidedWarlock(id,op,phbWarlockCreation("celestial"),at);while(celestial.identity.level<10) celestial=await advanceGuidedWarlock(celestial,completeWarlockChoice(celestial,"blade"),at);
    celestial=await applyWarlockAction(celestial,{ kind:"healing-light",dice:2 },{ operationId:"warlock_00000000000000000000000000000002",expectedRevision:celestial.revision,updatedAt:at });expect(celestial.traits.flatMap((g) => g.traits).find((t) => t.name === "Luz Sanadora")!.uses.used).toBe(2);celestial=rest(celestial,"short-rest");expect(celestial.combat.hitPoints.temporary).toBe(celestial.identity.level+Math.floor((celestial.abilities.charisma-10)/2));
    let hex=await createGuidedWarlock(id,op,phbWarlockCreation("hexblade"),at);while(hex.identity.level<4) hex=await advanceGuidedWarlock(hex,completeWarlockChoice(hex,"blade"),at);const step=completeWarlockChoice(hex,"blade");step.warlock.invocations=["eldritch-smite"];step.warlock.replaceInvocation={ oldKey:"armor-of-shadows",newKey:"improved-pact-weapon" };hex=await advanceGuidedWarlock(hex,step,at);
    const weapon=hex.actions.find((a) => a.inventoryItemId === hex.spellcasting.warlock!.pactWeaponId)!;expect(weapon.ability).toBe("charisma");expect(weapon.attackBonus).toBe(1);
    hex=await applyWarlockAction(hex,{ kind:"eldritch-smite",pactWeaponHit:true,oncePerTurn:true },{ operationId:"warlock_00000000000000000000000000000003",expectedRevision:hex.revision,updatedAt:at });expect(hex.spellcasting.slots["3"]!.used).toBe(1);
  });
});
