import { isXanatharFeat } from "../../src/domain/character/xanathar-feats";
import { describe, expect, it } from "vitest";
import { phbFighterCreation, completeFighterChoice } from "../fixtures/phb-fighter-builder";
import { createGuidedFighter, advanceGuidedFighter, validateFighterCreation, fighterBuilderScores } from "../../src/domain/character/fighter-builder";
import { FeatChoiceSchema, type FighterSubclass, type FeatChoice, BUILDER_ABILITIES } from "../../src/domain/character/character-builder-model";
import { BUILDER_RACES, BACKGROUND_PRESETS, PHB_EQUIPMENT } from "../../src/domain/character/fighter-builder-catalog";
import { FEATS, MANEUVERS } from "../../src/domain/character/phb-fighter-choices";
import { PHB_SPELLS, classSpells } from "../../src/domain/character/phb-spells";
import { replayFighterChoices } from "../../src/domain/character/fighter-build-rules";
import { projectCharacterStatistics, projectSpellcasting, projectSpellDamageExpression } from "../../src/domain/character/character-projection";
import { castCharacterSpell } from "../../src/domain/character/character-spells";
import { applyCharacterResourceCommand } from "../../src/domain/character/character-resources";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { createCampaignSnapshot, encodeCampaignEnvelope, decodeCampaignEnvelope } from "../../src/infrastructure/persistence/campaign-snapshot";
import { createTestCampaign } from "../fixtures/native-campaign";
import { DRAGON_ANCESTRIES } from "../../src/domain/character/phb-character-options";
const id = "chr_11111111111111111111111111111111", operation = "build_11111111111111111111111111111111", time = "2026-10-12T20:00:00.000Z";
async function build(level: number, subclass: FighterSubclass = "champion", race: keyof typeof BUILDER_RACES = "human") {
  let character = await createGuidedFighter(id, operation, phbFighterCreation(race), time);
  while (character.identity.level < level) character = await advanceGuidedFighter(character, completeFighterChoice(character, subclass), time);
  return character;
}
describe("complete PHB single-class fighter", () => {
  it("covers fifteen origins, eighteen background profiles, sixteen PHB maneuvers and forty-two feats", () => {
    expect(Object.keys(BUILDER_RACES)).toHaveLength(15);
    expect(Object.keys(BACKGROUND_PRESETS)).toHaveLength(18);
    expect(Object.keys(MANEUVERS)).toHaveLength(16);
    expect(Object.keys(FEATS)).toHaveLength(57);
    expect(classSpells("wizard",0)).toHaveLength(25);
    expect(classSpells("wizard",1,4)).toHaveLength(152);
    expect(PHB_SPELLS["booming-blade"]).toBeUndefined();
    expect(MANEUVERS).not.toHaveProperty("ambush");
  });
  it("creates every race/background combination with valid customization and complete background equipment", async () => {
    for (const race of Object.keys(BUILDER_RACES) as Array<keyof typeof BUILDER_RACES>) {
      for (const background of Object.keys(BACKGROUND_PRESETS) as Array<keyof typeof BACKGROUND_PRESETS>) {
        const creation = phbFighterCreation(race, background);
        const character = await createGuidedFighter(id, operation, creation, time);
        expect(character.identity.background).toBe(BACKGROUND_PRESETS[background].name);
        expect(character.inventory.some((item) => item.name === "Bolsa de monedas")).toBe(true);
        expect(character.traits.flatMap((group) => group.traits).some((trait) => trait.name === creation.background.featureName)).toBe(true);
        expect(character.abilities).toEqual(fighterBuilderScores(character.builder!));
        expect(character.checks.savingThrows.strength.proficiency).toBe(1);
        expect(character.checks.savingThrows.constitution.proficiency).toBe(1);
      }
    }
  });
  it.each(["champion", "battle-master", "eldritch-knight"] as const)("replays %s through level 20 with its own features and persistent resources", async (subclass) => {
    let character = await build(3,subclass);
    character.combat.hitPoints.current = 2;
    character.traits.flatMap((group) => group.traits).find((t) => t.name === "Segundo aliento")!.uses.used = 1;
    while (character.identity.level < 20) {
      character = await advanceGuidedFighter(character, completeFighterChoice(character,subclass), time);
      expect(character.combat.hitPoints.current).toBe(2);
      expect(character.traits.flatMap((group) => group.traits).find((t) => t.name === "Segundo aliento")!.uses.used).toBe(1);
      if (subclass !== "champion") expect(character.traits.flatMap((g) => g.traits).some((t) => t.name === "Atleta notable")).toBe(false);
    }
    const traits = character.traits.flatMap((g) => g.traits);
    if (subclass === "battle-master") {
      expect(replayFighterChoices(character.builder!).maneuvers).toHaveLength(9);
      expect(traits.find((t) => t.name === "Dados de superioridad")!.uses).toMatchObject({ maximum: 6, reset: "short-rest" });
      expect(character.actions.find((a) => a.name === "Dado de superioridad")!.damageExpression).toBe("1d12");
      expect(traits.some((t) => t.name === "Implacable")).toBe(true);
    }
    if (subclass === "eldritch-knight") {
      expect(replayFighterChoices(character.builder!).spells).toHaveLength(13);
      expect(replayFighterChoices(character.builder!).cantrips).toHaveLength(3);
      expect([1,2,3,4].map((level) => character.spellcasting.slots[String(level)]!.maximum)).toEqual([4,3,3,1]);
      expect(traits.some((t) => t.name === "Magia de guerra mejorada")).toBe(true);
      expect(projectSpellcasting(character).ability).toBe("intelligence");
    }
    const stats = projectCharacterStatistics(character);
    if (subclass !== "champion") expect(stats.initiativeModifier).toBe(Math.floor((character.abilities.dexterity-10)/2));
  });
  it("replaces only eligible maneuvers and retires the old generated trait while preserving the superiority pool", async () => {
    const character = await build(6,"battle-master");
    character.traits.flatMap((g) => g.traits).find((t) => t.name === "Dados de superioridad")!.uses.used = 3;
    const step = completeFighterChoice(character,"battle-master"), oldKey = replayFighterChoices(character.builder!).maneuvers[0]!;
    step.maneuverReplacement = { oldKey, newKey: "trip-attack" };
    const next = await advanceGuidedFighter(character,step,time);
    expect(replayFighterChoices(next.builder!).maneuvers).not.toContain(oldKey);
    expect(next.traits.flatMap((g) => g.traits).some((t) => t.name === MANEUVERS[oldKey as keyof typeof MANEUVERS].name)).toBe(false);
    expect(next.traits.flatMap((g) => g.traits).find((t) => t.name === "Dados de superioridad")!.uses).toMatchObject({ maximum: 5, used: 3 });
    await expect(advanceGuidedFighter(await build(5,"battle-master"), { ...completeFighterChoice(await build(5,"battle-master"),"battle-master"), maneuverReplacement: { oldKey, newKey: "trip-attack" } },time)).rejects.toThrow("sustitución");
  });
  it("keeps Eldritch Knight free-school permissions tied to their original slots", async () => {
    let character = await build(3,"eldritch-knight");
    const replay = replayFighterChoices(character.builder!), restricted = replay.spells.find((spell) => !spell.unrestricted)!, free = replay.spells.find((spell) => spell.unrestricted)!;
    const step = completeFighterChoice(character,"eldritch-knight");
    step.magic.replace = { oldKey: restricted.key, newKey: "find-familiar" };
    await expect(advanceGuidedFighter(character, step,time)).rejects.toThrow("plaza original");
    step.magic.replace = { oldKey: free.key, newKey: "find-familiar" };
    character = await advanceGuidedFighter(character,step,time);
    expect(replayFighterChoices(character.builder!).spells.find((spell) => spell.key === "find-familiar")?.unrestricted).toBe(true);
    const spell = character.spellcasting.spells.find((spell) => spell.name === "Encontrar familiar")!;
    expect(spell.casting?.kind).toBe("slots");
    expect(character.spellcasting.spells.some((spell) => spell.name === PHB_SPELLS[free.key]!.name)).toBe(false);
  });
  it("uses Charisma for racial spells alongside Intelligence for Eldritch Knight, spending their own pools", async () => {
    let character = await build(3,"eldritch-knight","tiefling");
    const racial = character.spellcasting.spells.find((spell) => spell.name === "Reprensión infernal")!, arcane = character.spellcasting.spells.find((spell) => spell.casting?.source === "builder:eldritch-knight" && spell.level === 1)!;
    expect(projectSpellcasting(character,racial).ability).toBe("charisma");
    expect(projectSpellcasting(character,arcane).ability).toBe("intelligence");
    expect(projectSpellDamageExpression(character,racial,2)).toBe("3d10");
    character = castCharacterSpell(character,racial.id,2,{ expectedRevision: character.revision, updatedAt: time });
    expect(character.spellcasting.slots["1"]!.used).toBe(0);
    expect(() => castCharacterSpell(character,racial.id,2,{ expectedRevision: character.revision, updatedAt: time })).toThrow("No quedan usos");
    character = castCharacterSpell(character,arcane.id,1,{ expectedRevision: character.revision, updatedAt: time });
    expect(character.spellcasting.slots["1"]!.used).toBe(1);
    character = await advanceGuidedFighter(character,completeFighterChoice(character,"eldritch-knight"),time);
    expect(character.spellcasting.slots["1"]!.used).toBe(1);
    const refreshed = applyCharacterResourceCommand(character,{ kind: "long-rest" },{ expectedRevision: character.revision, updatedAt: time }).character;
    expect(refreshed.traits.flatMap((g) => g.traits).find((t) => t.id === racial.casting!.traitId)!.uses.used).toBe(0);
  });
  it("scales every draconic breath ancestry correctly and grants both drow spells at their racial levels", async () => {
    const types = ["acid","lightning","fire","lightning","acid","fire","poison","fire","cold","cold"];
    for (const [i, ancestry] of (Object.keys(DRAGON_ANCESTRIES) as Array<keyof typeof DRAGON_ANCESTRIES>).entries()) {
      const creation = phbFighterCreation("dragonborn"); creation.origin.ancestry = ancestry;
      const character = await createGuidedFighter(id,operation,creation,time), breath = character.actions.find((action) => action.name === "Arma de aliento")!;
      expect(breath.damageType).toBe(types[i]);
      expect(breath.reach).toContain(i < 5 ? "30" : "15");
      expect(breath.description).toContain(i === 6 || i >= 8 ? "constitution" : "dexterity");
    }
    for (const level of [1,6,11,16]) {
      const character = await build(level,"champion","dragonborn");
      expect(character.actions.find((a) => a.name === "Arma de aliento")!.damageExpression).toBe(`${level === 1 ? 2 : level === 6 ? 3 : level === 11 ? 4 : 5}d6`);
    }
    const drow = await build(5,"champion","drow");
    expect(drow.spellcasting.spells.map((s) => s.name)).toEqual(expect.arrayContaining(["Luces danzantes","Fuego feérico","Oscuridad"]));
  });
  it("supports rolled attributes, gold purchases and equipped stacks without granting background packages", async () => {
    const creation = phbFighterCreation(); creation.abilityMethod = "rolled";
    creation.baseAbilities = { strength: 18, dexterity: 3, constitution: 18, intelligence: 3, wisdom: 3, charisma: 3 };
    creation.equipment.method = "gold"; creation.equipment.goldRoll = [4,4,4,4,4];
    creation.equipment.purchases = [{ key: "chain-mail", quantity: 1, equipped: true }, { key: "longsword", quantity: 2, equipped: true }, { key: "shield", quantity: 1, equipped: true }];
    const character = await createGuidedFighter(id,operation,creation,time);
    expect(character.currency.gold).toBe(85);
    expect(character.inventory.filter((i) => i.equipped).every((i) => i.quantity === 1)).toBe(true);
    expect(character.inventory.some((i) => i.name === "Símbolo sagrado")).toBe(false);
    expect(character.combat.armorClass).toBe(19);
    creation.equipment.purchases = [{ key: "plate-armor", quantity: 1, equipped: true }];
    expect(() => validateFighterCreation(creation)).toThrow("superan");
  });
  it("creates a higher-level character atomically and retries the same initial decisions after later advances", async () => {
    const seed = await build(5,"eldritch-knight"), creation = { ...seed.builder!.creation, startingLevel: 5 }, levels = seed.builder!.levels;
    const application = new CampaignApplication(new InMemoryCampaignRepository());
    const empty = await application.createCampaign(time);
    const command = { operationId: operation, creation, initialLevels: levels, expectedCampaignChecksum: empty.checksum };
    const created = await application.createGuidedCharacter(command), character = Object.values(created.campaign.characters)[0]!;
    expect(character.identity).toMatchObject({ level: 5, subclass: "Caballero arcano" });
    expect(character.combat.hitPoints.current).toBe(character.combat.hitPoints.maximum);
    const advanced = await application.advanceGuidedCharacter({ characterId: character.id, choice: completeFighterChoice(character,"eldritch-knight"), expectedCharacterRevision: character.revision, expectedCampaignChecksum: created.checksum });
    expect(await application.createGuidedCharacter(command)).toEqual(advanced);
    const changed = structuredClone(levels); changed[0]!.hpMethod = "rolled"; changed[0]!.hpBase = 8;
    await expect(application.createGuidedCharacter({ ...command, initialLevels: changed })).rejects.toThrow("niveles iniciales");
    const campaign = createTestCampaign(); campaign.characters = { [character.id]: character };
    const snapshot = await createCampaignSnapshot(campaign);
    expect((await decodeCampaignEnvelope(encodeCampaignEnvelope(snapshot))).campaign.characters[character.id]!.builder).toEqual(character.builder);
  });
  it.each(Object.keys(FEATS).filter((k) => !isXanatharFeat(k)) as Array<FeatChoice["key"]>)("records every eligible PHB feat and its selected benefits: %s", async (key) => {
    const creation = phbFighterCreation("high-elf"); creation.abilityMethod = "rolled";
    creation.baseAbilities = Object.fromEntries(BUILDER_ABILITIES.map((ability) => [ability,16])) as typeof creation.baseAbilities;
    let character = await createGuidedFighter(id,operation,creation,time);
    while (character.identity.level < 3) character = await advanceGuidedFighter(character,completeFighterChoice(character,"eldritch-knight"),time);
    const feat = FeatChoiceSchema.parse({ key, ability: FEATS[key].abilities[0] ?? null });
    if (key === "skilled") feat.skills = ["arcana","deception","history"];
    if (key === "linguist") feat.languages = ["Infernal","Abisal","Celestial"];
    if (key === "elemental-adept") feat.damageType = "fire";
    if (key === "martial-adept") feat.maneuvers = ["parry","riposte"];
    if (key === "weapon-master") feat.weapons = ["club","dagger","longsword","longbow"];
    if (["magic-initiate","ritual-caster","spell-sniper"].includes(key)) feat.spellClass = "wizard";
    if (key === "magic-initiate") feat.spells = ["blade-ward","friends","chromatic-orb"];
    if (key === "ritual-caster") feat.spells = ["detect-magic","find-familiar"];
    if (key === "spell-sniper") feat.spells = ["fire-bolt"];
    const step = completeFighterChoice(character,"eldritch-knight"); step.abilityIncrease = null; step.feat = feat;
    const next = await advanceGuidedFighter(character,step,time);
    expect(next.traits.flatMap((g) => g.traits).some((trait) => trait.name === FEATS[key].name)).toBe(true);
    if (feat.ability) expect(next.abilities[feat.ability]).toBe(character.abilities[feat.ability]+1);
    if (key === "tough") expect(next.combat.hitPoints.maximum-character.combat.hitPoints.maximum).toBe(6+3+8);
    if (key === "mobile") expect(next.combat.speed).toBe("40 ft");
    if (key === "alert") expect(projectCharacterStatistics(next).initiativeModifier-projectCharacterStatistics(character).initiativeModifier).toBe(5);
    if (key === "resilient") expect(next.checks.savingThrows.strength.proficiency).toBe(1);
    if (key === "tavern-brawler") expect(next.actions.find((a) => a.name === "Golpe sin armas")!.damageExpression).toBe("1d4");
    if (key === "ritual-caster") expect(next.inventory.some((i) => i.name === "Libro de rituales")).toBe(true);
    expect(next.inventory.filter((i) => i.category === "armor")).toHaveLength(1);
  });
  it("rejects illegal feat prerequisites and repeated feats and allows a voluntary skipped improvement", async () => {
    const third = await build(3), step = completeFighterChoice(third);
    step.abilityIncrease = null; step.feat = FeatChoiceSchema.parse({ key: "war-caster" });
    await expect(advanceGuidedFighter(third,step,time)).rejects.toThrow("requisito");
    step.feat = FeatChoiceSchema.parse({ key: "alert" });
    let character = await advanceGuidedFighter(third,step,time);
    character = await advanceGuidedFighter(character,completeFighterChoice(character),time);
    const repeat = completeFighterChoice(character); repeat.abilityIncrease = null; repeat.feat = step.feat;
    await expect(advanceGuidedFighter(character,repeat,time)).rejects.toThrow("ya se eligió");
    repeat.feat = null; repeat.skipImprovement = true;
    expect((await advanceGuidedFighter(character,repeat,time)).abilities).toEqual(character.abilities);
  });
  it("retains a feat's other benefits at the ability cap and allows an unspent point-buy budget", async () => {
    const creation = phbFighterCreation("mountain-dwarf"); creation.abilityMethod = "rolled"; creation.baseAbilities.strength = 18;
    let character = await createGuidedFighter(id,operation,creation,time);
    while (character.identity.level < 3) character = await advanceGuidedFighter(character,completeFighterChoice(character),time);
    const step = completeFighterChoice(character); step.abilityIncrease = null; step.feat = FeatChoiceSchema.parse({ key: "heavy-armor-master", ability: "strength" });
    character = await advanceGuidedFighter(character,step,time);
    expect(character.abilities.strength).toBe(20);
    expect(character.traits.flatMap((g) => g.traits).some((t) => t.name === "Maestro de armadura pesada")).toBe(true);
    const pointBuy = phbFighterCreation(); pointBuy.abilityMethod = "point-buy";
    pointBuy.baseAbilities = { strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 };
    expect(() => validateFighterCreation(pointBuy)).not.toThrow();
    pointBuy.baseAbilities.strength = 16; expect(() => validateFighterCreation(pointBuy)).toThrow("27");
  });
  it("keeps Martial Adept usage while Improved Combat Superiority increases its die", async () => {
    let character = await build(3,"battle-master");
    const step = completeFighterChoice(character,"battle-master"); step.abilityIncrease = null;
    step.feat = FeatChoiceSchema.parse({ key: "martial-adept", maneuvers: ["parry","riposte"] });
    character = await advanceGuidedFighter(character,step,time);
    const trait = character.traits.flatMap((g) => g.traits).find((t) => t.name === "Dado de superioridad adicional d6")!;
    trait.uses.used = 1;
    trait.adjustment = { category: "skills", subcategory: "", ability: "stealth", value: 1, advantage: false, disadvantage: false, applyToDerived: true };
    while (character.identity.level < 18) {
      character = await advanceGuidedFighter(character,completeFighterChoice(character,"battle-master"),time);
      const die = character.traits.flatMap((g) => g.traits).find((t) => t.id === trait.id)!;
      expect(die.name).toContain(character.identity.level >= 18 ? "d12" : character.identity.level >= 10 ? "d10" : "d6");
      expect(die.uses.used).toBe(1);
      expect(die.adjustment).toEqual(trait.adjustment);
    }
  });
});
