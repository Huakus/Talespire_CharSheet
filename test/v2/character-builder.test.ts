import { describe, expect, it } from "vitest";
import { createGuidedFighter, advanceGuidedFighter, fighterBuilderScores, validateFighterCreation } from "../../src/domain/character/fighter-builder";
import { defaultFighterCreation, FIGHTER_ASI_LEVELS, BUILDER_RACES, BUILDER_WEAPONS, BACKGROUND_PRESETS } from "../../src/domain/character/fighter-builder-catalog";
import { BUILDER_ABILITIES, FighterLevelChoiceSchema, type FighterLevelChoice } from "../../src/domain/character/character-builder-model";
import { projectActionAttackModifier, projectActionDamageBonus, projectInventory, projectCharacterStatistics, projectAbilityCheckModifier, preferredWeaponAbility, projectHeavyArmorSpeedPenalty, projectAdjustedRollMode } from "../../src/domain/character/character-projection";
import { applyCharacterResourceCommand } from "../../src/domain/character/character-resources";
import { setInventoryItemEquipped, resetInventoryItemResources } from "../../src/domain/character/character-inventory";
import { InventoryFeatureSchema } from "../../src/domain/character/character-inventory-model";
import { normalizeEquipmentDefinition } from "../../src/domain/equipment/equipment-catalog";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { createCampaignSnapshot, encodeCampaignEnvelope, decodeCampaignEnvelope } from "../../src/infrastructure/persistence/campaign-snapshot";
import { assembleCampaign, fragmentCampaign } from "../../src/infrastructure/remote/campaign-fragments";
import { mergeCampaignChanges } from "../../src/infrastructure/remote/campaign-three-way-merge";
import { createTestCampaign } from "../fixtures/native-campaign";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
import { editCharacterCore } from "../../src/domain/character/edit-character";
import { phbFighterCreation } from "../fixtures/phb-fighter-builder";

const id = "chr_11111111111111111111111111111111";
const timestamp = "2026-10-12T12:00:00.000Z";
const operation = (n: number) => `build_${n.toString(16).padStart(32, "0")}`;
const create = () => createGuidedFighter(id, operation(1), defaultFighterCreation("Ada"), timestamp);
function choice(character: CharacterV2, operationOffset = 0): FighterLevelChoice {
  const level = character.identity.level + 1;
  const increases = Object.fromEntries(BUILDER_ABILITIES.map((key) => [key,0])) as CharacterV2["abilities"];
  const target = BUILDER_ABILITIES.find((key) => character.abilities[key] <= 18)!;
  increases[target] = 2;
  return FighterLevelChoiceSchema.parse({ operationId: operation(level + operationOffset), level, hpBase: 6, hpMethod: "fixed", abilityIncrease: FIGHTER_ASI_LEVELS.includes(level) ? increases : null, subclass: level === 3 ? "champion" : null, additionalStyle: level === 10 ? "archery" : null });
}
async function advanceTo(level: number): Promise<CharacterV2> {
  let character = await create();
  while (character.identity.level < level) character = await advanceGuidedFighter(character, choice(character), timestamp);
  return character;
}

describe("guided fighter construction and advancement", () => {
  it.each(Object.keys(BUILDER_RACES) as Array<keyof typeof BUILDER_RACES>)("retains all racial benefits for %s without generalizing conditional skills", async (race) => {
    const creation = phbFighterCreation(race);
    const character = await createGuidedFighter(id, operation(1), creation, timestamp);
    expect(character.combat.speed).toBe(`${BUILDER_RACES[race].speed} ft`);
    expect(character.abilities).toEqual(Object.fromEntries(BUILDER_ABILITIES.map((key) => [key, creation.baseAbilities[key] + ((BUILDER_RACES[race].bonuses as Partial<CharacterV2["abilities"]>)[key] ?? 0) + creation.origin.abilities.filter((pick) => pick === key).length])));
    expect(character.proficiencies.languages).toEqual([...BUILDER_RACES[race].languages, ...creation.languages, ...creation.background.languages]);
    const traits = character.traits.flatMap((group) => group.traits);
    expect(traits.some((trait) => trait.name === (race.includes("halfling") || race.includes("gnome") ? "Tamaño Pequeño" : "Tamaño Mediano"))).toBe(true);
    if (race.includes("dwarf")) {
      expect(traits.find((trait) => trait.name === "Afinidad con la piedra")?.description).toContain("aunque no tengas Historia");
      expect(character.checks.skills.history.proficiency).toBe(0);
      expect(traits.some((trait) => trait.name === "Movimiento enano")).toBe(true);
    }
    if (race === "half-orc") expect(character.checks.skills.intimidation.proficiency).toBe(1);
  });
  it("splits two identical starting weapons so only one unit is equipped and the spare can be equipped", async () => {
    const creation = defaultFighterCreation("Twins");
    creation.equipment = { ...creation.equipment, shield: false, secondary: creation.equipment.primary };
    const character = await createGuidedFighter(id, operation(1), creation, timestamp);
    const swords = character.inventory.filter((item) => item.name === "Espada larga");
    expect(swords.map((item) => [item.quantity, item.equipped])).toEqual([[1, true], [1, false]]);
    const equipped = setInventoryItemEquipped(character, swords[1]!.id, true, { expectedRevision: character.revision, updatedAt: timestamp });
    expect(equipped.inventory.filter((item) => item.weapon && item.equipped)).toHaveLength(2);
  });
  it("records complete background equipment and both prayer and gaming alternatives", async () => {
    for (const preset of ["acolyte", "soldier", "sage"] as const) {
      const creation = defaultFighterCreation("Background");
      creation.skills = ["perception", "survival"];
      creation.background = { ...BACKGROUND_PRESETS[preset], prayerItem: "prayer-wheel", gamingSet: "cards" };
      const character = await createGuidedFighter(id, operation(1), creation, timestamp);
      expect(character.inventory.some((item) => item.name === "Bolsa")).toBe(true);
      expect(character.currency.gold).toBe(preset === "acolyte" ? 15 : 10);
      if (preset === "acolyte") {
        expect(character.inventory.some((item) => item.name === "Rueda de plegarias")).toBe(true);
        expect(character.inventory.some((item) => item.name === "Libro de plegarias")).toBe(false);
      }
      if (preset === "soldier") expect(character.inventory.some((item) => item.name === "Juego de cartas para jugar")).toBe(true);
    }
  });
  it("replaces a duplicate racial skill with any distinct skill of the same kind", async () => {
    const creation = { ...defaultFighterCreation("Orc"), race: "half-orc" as const, languages: [], skills: ["intimidation", "perception"] as const, racialSkillReplacement: "arcana" as const };
    const character = await createGuidedFighter(id, operation(1), { ...creation, skills: [...creation.skills] }, timestamp);
    expect(character.checks.skills.arcana.proficiency).toBe(1);
    expect(character.checks.skills.intimidation.proficiency).toBe(1);
    expect(Object.values(character.checks.skills).filter((skill) => skill.proficiency === 1)).toHaveLength(5);
    expect(() => validateFighterCreation({ ...creation, skills: ["athletics", "perception"] })).toThrow("Solo podés sustituir");
  });
  it("refreshes automatic finesse choices after an ASI while preserving authored damage bonuses", async () => {
    const creation = defaultFighterCreation("Finesse");
    creation.equipment.primary = "rapier";
    let character = await createGuidedFighter(id, operation(1), creation, timestamp);
    character.actions.find((action) => action.name === "Estoque")!.damageBonus += 5;
    while (character.identity.level < 6) {
      const step = choice(character);
      if (step.abilityIncrease) step.abilityIncrease = { strength: 0, dexterity: 2, constitution: 0, intelligence: 0, wisdom: 0, charisma: 0 };
      character = await advanceGuidedFighter(character, step, timestamp);
    }
    const rapier = character.actions.find((action) => action.name === "Estoque")!;
    expect(rapier.ability).toBe("dexterity");
    expect(rapier.damageBonus).toBe(9);
    expect(projectActionAttackModifier(character, rapier)).toBe(7);
    expect(preferredWeaponAbility({ strength: 18, dexterity: 10 }, BUILDER_WEAPONS.dart!)).toBe("strength");
    expect(preferredWeaponAbility({ strength: 18, dexterity: 10 }, BUILDER_WEAPONS["longbow"]!)).toBe("dexterity");
  });
  it("does not turn a net into a damaging weapon and exposes weapon-specific restrictions", async () => {
    const creation = defaultFighterCreation("Net"); creation.equipment.primary = "net";
    const character = await createGuidedFighter(id, operation(1), creation, timestamp);
    expect(character.actions.find((action) => action.name === "Red")).toMatchObject({ damageExpression: "", damageBonus: 0 });
    expect(BUILDER_WEAPONS.net!.description).toContain("solo podrás realizar un ataque");
    expect(BUILDER_WEAPONS["light-crossbow"]!.description).toContain("solo podrás disparar una unidad de munición");
    expect(BUILDER_WEAPONS.lance!.description).toContain("si no estás sobre una montura");
    creation.equipment.primary = "lance"; creation.style = "dueling";
    const lancer = await createGuidedFighter(id, operation(1), creation, timestamp);
    expect(projectActionDamageBonus(lancer, lancer.actions.find((action) => action.name === "Lanza de caballería")!)).toBe(3);
  });
  it("recovers short-rest abilities on a long rest and leaves long-rest abilities spent on a short rest", async () => {
    let character = await advanceTo(17);
    character.traits.forEach((group) => group.traits.forEach((trait) => { trait.uses.used = trait.uses.maximum; }));
    const short = applyCharacterResourceCommand(character, { kind: "short-rest" }, { expectedRevision: character.revision, updatedAt: timestamp }).character;
    const traits = short.traits.flatMap((group) => group.traits);
    expect(traits.find((trait) => trait.name === "Acción súbita")!.uses.used).toBe(0);
    expect(traits.find((trait) => trait.name === "Indomable")!.uses.used).toBe(3);
    character = applyCharacterResourceCommand(character, { kind: "long-rest" }, { expectedRevision: character.revision, updatedAt: timestamp }).character;
    expect(character.traits.flatMap((group) => group.traits).filter((trait) => trait.uses.maximum > 0).every((trait) => trait.uses.used === 0)).toBe(true);
  });
  it("recovers item resources for short or long rests and retains imported armor strength requirements", async () => {
    const character = await create();
    const item = character.inventory[0]!;
    item.charges = { current: 0, maximum: 3, reset: "short-rest" };
    item.features = ["short-rest", "long-rest", "none"].map((reset, order) => InventoryFeatureSchema.parse({ id: `feature-${order}`, order, name: reset, description: "", kind: "activation", uses: { current: 0, maximum: 2, reset } }));
    const short = resetInventoryItemResources(item, "short-rest"), long = resetInventoryItemResources(item, "long-rest");
    expect(short.charges?.current).toBe(3);
    expect(long.charges?.current).toBe(3);
    expect(short.features.map((feature) => feature.uses?.current)).toEqual([2, 0, 0]);
    expect(long.features.map((feature) => feature.uses?.current)).toEqual([2, 2, 0]);
    const armor = normalizeEquipmentDefinition({ name: "Plate", equipment_category: { index: "armor" }, armor_class: { base: 18 }, armor_category: "heavy", str_minimum: 15 });
    expect(armor.armor?.strengthRequirement).toBe(15);
  });
  it("removes the heavy-armor speed penalty when an ASI meets its requirement, with a dwarf exemption", async () => {
    const creation = defaultFighterCreation("Weak fighter");
    creation.baseAbilities = { strength: 10, dexterity: 15, constitution: 14, intelligence: 13, wisdom: 12, charisma: 8 };
    let character = await createGuidedFighter(id, operation(1), creation, timestamp);
    expect(character.combat.speed).toBe("20 ft");
    expect(projectAdjustedRollMode(character, "skills", ["stealth"], "normal")).toBe("disadvantage");
    character.inventory.find((item) => item.armor?.stealthDisadvantage)!.armor!.stealthDisadvantage = false;
    expect(projectAdjustedRollMode(character, "skills", ["stealth"], "normal")).toBe("normal");
    while (character.identity.level < 4) character = await advanceGuidedFighter(character, choice(character), timestamp);
    expect(character.abilities.strength).toBe(13);
    expect(character.combat.speed).toBe("30 ft");
    for (const race of ["hill-dwarf", "mountain-dwarf"] as const) {
      const dwarf = await createGuidedFighter(id, operation(1), { ...creation, race, languages: [], dwarfTool: "smith" }, timestamp);
      expect(dwarf.abilities.strength).toBeLessThan(13);
      expect(dwarf.combat.speed).toBe("25 ft");
      expect(projectHeavyArmorSpeedPenalty(dwarf)).toBe(0);
    }
  });
  it("checks every fighter and Champion unlock at its actual level", async () => {
    let character = await create();
    while (true) {
      const level = character.identity.level;
      const traits = character.traits.flatMap((group) => group.traits);
      const byName = (name: string) => traits.find((trait) => trait.name === name);
      expect(byName("Segundo aliento")!.uses).toMatchObject({ maximum: 1, reset: "short-rest" });
      expect(byName("Acción súbita")?.uses.maximum ?? 0).toBe(level < 2 ? 0 : level < 17 ? 1 : 2);
      expect(byName("Indomable")?.uses.maximum ?? 0).toBe(level < 9 ? 0 : level < 13 ? 1 : level < 17 ? 2 : 3);
      expect(Boolean(byName("Atleta notable"))).toBe(level >= 7);
      expect(Boolean(byName("Superviviente"))).toBe(level >= 18);
      expect(Boolean(byName("Crítico mejorado"))).toBe(level >= 3 && level < 15);
      expect(Boolean(byName("Crítico superior"))).toBe(level >= 15);
      if (level >= 5) expect(byName("Ataque Extra")!.description).toContain(`${level < 11 ? 2 : level < 20 ? 3 : 4} ataques`);
      expect(traits.filter((trait) => trait.name.startsWith("Estilo:")).length).toBe(level < 10 ? 1 : 2);
      if (level === 20) break;
      character = await advanceGuidedFighter(character, choice(character), timestamp);
    }
  });
  it("creates a playable first-level sheet with origins, equipment, attacks and resources", async () => {
    const character = await create();
    expect(character.identity).toMatchObject({ className: "Guerrero", level: 1, species: "Humano", background: "Acólito" });
    expect(character.abilities).toEqual({ strength: 16, dexterity: 14, constitution: 15, intelligence: 11, wisdom: 13, charisma: 9 });
    expect(character.combat.hitPoints).toEqual({ current: 12, maximum: 12, temporary: 0 });
    expect(character.combat.armorClass).toBe(19);
    expect(character.inventory.find((item) => item.name === "Virote de ballesta")?.quantity).toBe(20);
    expect(character.currency.gold).toBe(15);
    expect(character.checks.skills.athletics.proficiency).toBe(1);
    expect(character.checks.skills.religion.proficiency).toBe(1);
    expect(character.checks.savingThrows.constitution.proficiency).toBe(1);
    expect(character.actions.find((a) => a.name === "Espada larga")).toMatchObject({ proficient: true, damageExpression: "1d8", damageBonus: 3 });
    expect(character.traits.flatMap((g) => g.traits).find((t) => t.name === "Segundo aliento")?.uses.maximum).toBe(1);
  });
  it("rejects illegal scores, duplicate grants and invalid equipment rather than producing an incomplete sheet", () => {
    const creation = defaultFighterCreation("Ada");
    expect(() => validateFighterCreation({ ...creation, baseAbilities: { ...creation.baseAbilities, strength: 14 } })).toThrow("Asigná");
    expect(() => validateFighterCreation({ ...creation, abilityMethod: "point-buy", baseAbilities: { ...creation.baseAbilities, strength: 20 } })).toThrow("27");
    expect(() => validateFighterCreation({ ...creation, skills: ["athletics", "athletics"] })).toThrow("distintas");
    expect(() => validateFighterCreation({ ...creation, background: { ...creation.background, skills: ["athletics", "religion"] } })).toThrow("repetidas");
    expect(() => validateFighterCreation({ ...creation, equipment: { ...creation.equipment, primary: "dagger" } })).toThrow("marcial");
    expect(() => validateFighterCreation({ ...creation, languages: ["Común"] })).toThrow("idiomas");
  });
  it("applies racial choices and hill dwarf HP without double-counting at later levels", async () => {
    const creation = { ...defaultFighterCreation("Borin"), race: "hill-dwarf" as const, languages: [], dwarfTool: "smith" as const };
    const character = await createGuidedFighter(id, operation(1), creation, timestamp);
    expect(character.abilities.constitution).toBe(16);
    expect(character.combat.hitPoints.maximum).toBe(14);
    const next = await advanceGuidedFighter(character, choice(character), timestamp);
    expect(next.combat.hitPoints.maximum).toBe(24);
    expect(next.proficiencies.tools).toContain("Herramientas de herrero");
  });
  it("recalculates Constitution retroactively and preserves runtime, inventory and manual content", async () => {
    const character = await advanceTo(3);
    character.combat.hitPoints.current = 4;
    character.combat.hitPoints.temporary = 7;
    character.combat.hitDice.remaining = 1;
    character.currency.gold = 3;
    character.inventory = [];
    character.traits.flatMap((g) => g.traits).find((t) => t.name === "Segundo aliento")!.uses.used = 1;
    const step = choice(character);
    step.abilityIncrease = { strength: 0, dexterity: 0, constitution: 2, intelligence: 0, wisdom: 0, charisma: 0 };
    const next = await advanceGuidedFighter(character, step, timestamp);
    expect(next.combat.hitPoints).toEqual({ current: 4, maximum: 40, temporary: 7 });
    expect(next.combat.hitDice.remaining).toBe(2);
    expect(next.inventory).toEqual([]);
    expect(next.currency.gold).toBe(3);
    expect(next.traits.flatMap((g) => g.traits).find((t) => t.name === "Segundo aliento")!.uses.used).toBe(1);
    expect(character.builder!.levels).toHaveLength(2);
    expect(next.builder!.levels).toHaveLength(3);
  });
  it("grants at least one HP on low rolls and applies a later Constitution increase to all previous levels", async () => {
    const creation = defaultFighterCreation("Low Constitution");
    creation.baseAbilities = { strength: 15, dexterity: 14, constitution: 8, intelligence: 13, wisdom: 12, charisma: 10 };
    let character = await createGuidedFighter(id, operation(1), creation, timestamp);
    expect(character.combat.hitPoints.maximum).toBe(9);
    for (const maximum of [10, 11, 15]) {
      const step = { ...choice(character), hpMethod: "rolled" as const, hpBase: 1 };
      if (step.abilityIncrease) step.abilityIncrease = { strength: 0, dexterity: 0, constitution: 2, intelligence: 0, wisdom: 0, charisma: 0 };
      character = await advanceGuidedFighter(character, step, timestamp);
      expect(character.combat.hitPoints.maximum).toBe(maximum);
      expect(character.combat.hitPoints.current).toBe(9);
    }
  });
  it("replays through level 20 with class-specific ASIs, stable grant IDs and no duplicate deliveries", async () => {
    const first = await create();
    let character = first;
    while (character.identity.level < 20) character = await advanceGuidedFighter(character, choice(character), timestamp);
    expect(character.builder!.levels.filter((step) => step.abilityIncrease).map((step) => step.level)).toEqual(FIGHTER_ASI_LEVELS);
    expect(character.identity.subclass).toBe("Campeón");
    expect(character.inventory).toEqual(first.inventory);
    expect(character.builder!.levels).toHaveLength(19);
    expect(character.abilities).toEqual(fighterBuilderScores(character.builder!));
    const traits = character.traits.flatMap((g) => g.traits);
    expect(traits.find((t) => t.name === "Acción súbita")?.uses.maximum).toBe(2);
    expect(traits.find((t) => t.name === "Indomable")?.uses.maximum).toBe(3);
    expect(traits.find((t) => t.name === "Ataque Extra")?.description).toContain("4 ataques");
    expect(new Set(traits.map((t) => t.id)).size).toBe(traits.length);
    expect(traits.find((t) => t.name === "Segundo aliento")?.id).toBe(first.traits.flatMap((g) => g.traits).find((t) => t.name === "Segundo aliento")?.id);
    expect(await advanceGuidedFighter(character, character.builder!.levels.at(-1)!, timestamp)).toEqual(character);
  });
  it("enforces the next level, subclass, ASI cap, roll bounds and distinct second style", async () => {
    const character = await advanceTo(2);
    await expect(advanceGuidedFighter(character, { ...choice(character), subclass: null }, timestamp)).rejects.toThrow("Campeón");
    await expect(advanceGuidedFighter(character, { ...choice(character), level: 5 }, timestamp)).rejects.toThrow("historial");
    await expect(advanceGuidedFighter(character, { ...choice(character), hpBase: 11, hpMethod: "rolled" }, timestamp)).rejects.toThrow();
    const ninth = await advanceTo(9);
    await expect(advanceGuidedFighter(ninth, { ...choice(ninth), additionalStyle: "defense" }, timestamp)).rejects.toThrow("distinto");
    const third = await advanceTo(3);
    await expect(advanceGuidedFighter(third, { ...choice(third), abilityIncrease: { strength: 5, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, charisma: 0 } }, timestamp)).rejects.toThrow("Distribuí");
  });
  it("applies conditional styles and Champion checks without granting saving throw proficiency", async () => {
    const creation = { ...defaultFighterCreation("Ada"), style: "dueling" as const };
    const character = await createGuidedFighter(id, operation(1), creation, timestamp);
    const sword = character.actions.find((a) => a.name === "Espada larga")!;
    expect(projectActionDamageBonus(character, sword)).toBe(5);
    character.inventory.find((i) => i.name === "Espada larga")!.equipped = false;
    expect(projectActionDamageBonus(character, sword)).toBe(3);
    expect(projectInventory(character).calculatedArmorClass).toBe(18);
    const archer = await createGuidedFighter(id, operation(1), { ...creation, style: "archery" }, timestamp);
    expect(projectActionAttackModifier(archer, archer.actions.find((a) => a.name === "Ballesta ligera")!)).toBe(6);
    const seventh = await advanceTo(7);
    const stats = projectCharacterStatistics(seventh);
    expect(stats.skills.acrobatics).toBe(4);
    expect(stats.savingThrows.dexterity).toBe(2);
    expect(projectAbilityCheckModifier(seventh, "constitution")).toBe(4);
    expect(stats.initiativeModifier).toBe(4);
  });
  it("round-trips builder decisions through campaign export and granular fragments", async () => {
    const campaign = createTestCampaign();
    const character = await advanceTo(4);
    campaign.characters = { [character.id]: character };
    const snapshot = await createCampaignSnapshot(campaign);
    expect((await decodeCampaignEnvelope(encodeCampaignEnvelope(snapshot))).campaign).toEqual(campaign);
    const roundtrip = assembleCampaign({ campaignRevision: campaign.revision, campaignUpdatedAt: campaign.metadata.updatedAt, updatedBy: null, characters: [{ characterId: id, revision: character.revision, createdAt: character.metadata.createdAt, updatedAt: character.metadata.updatedAt }], fragments: fragmentCampaign(campaign).map((entry) => ({ ...entry, revision: 1 })) });
    expect(roundtrip).toEqual(campaign);
  });
  it("rejects semantic merging of two competing level-ups", async () => {
    const base = createTestCampaign();
    const character = await create();
    base.characters = { [id]: character };
    const local = structuredClone(base), remote = structuredClone(base);
    local.characters[id] = await advanceGuidedFighter(character, choice(character), timestamp);
    remote.characters[id] = await advanceGuidedFighter(character, choice(character, 100), timestamp);
    expect(mergeCampaignChanges(base, local, remote)).toEqual({ campaign: null, conflictPaths: [`characters.${id}.builder`] });
  });
  it("merges an independent runtime change without recovering spent resources", async () => {
    const base = createTestCampaign();
    const character = await create();
    base.characters = { [id]: character };
    const local = structuredClone(base), remote = structuredClone(base);
    local.characters[id] = await advanceGuidedFighter(character, choice(character), timestamp);
    remote.characters[id]!.combat.hitPoints.current = 9;
    remote.characters[id]!.traits.flatMap((g) => g.traits).find((t) => t.name === "Segundo aliento")!.uses.used = 1;
    remote.characters[id]!.revision++;
    const result = mergeCampaignChanges(base, local, remote);
    expect(result.conflictPaths).toEqual([]);
    expect(result.campaign!.characters[id]!.identity.level).toBe(2);
    expect(result.campaign!.characters[id]!.combat.hitPoints).toMatchObject({ current: 9, maximum: 20 });
    expect(result.campaign!.characters[id]!.traits.flatMap((g) => g.traits).find((t) => t.name === "Segundo aliento")!.uses.used).toBe(1);
  });
  it("protects managed decisions while allowing ordinary play and identity edits", async () => {
    const character = await create();
    const editOptions = { expectedRevision: character.revision, updatedAt: timestamp };
    expect(() => editCharacterCore(character, { identity: { level: 3 } }, editOptions)).toThrow("tutorial");
    expect(() => editCharacterCore(character, { abilities: { strength: 20 } }, editOptions)).toThrow("tutorial");
    const edited = editCharacterCore(character, { name: "New name", combat: { hitPoints: { current: 2 } } }, editOptions);
    expect(edited.name).toBe("New name");
    expect(edited.combat.hitPoints.current).toBe(2);
    expect(edited.builder).toEqual(character.builder);
  });
});

describe("guided campaign commands", () => {
  it("keeps saved speed current when armor changes, without losing a manual speed adjustment or applying an ASI twice", async () => {
    const application = new CampaignApplication(new InMemoryCampaignRepository());
    let snapshot = await application.createCampaign(timestamp);
    const creation = defaultFighterCreation("Weak fighter");
    creation.baseAbilities = { strength: 10, dexterity: 15, constitution: 14, intelligence: 13, wisdom: 12, charisma: 8 };
    snapshot = await application.createGuidedCharacter({ operationId: operation(1), creation, expectedCampaignChecksum: snapshot.checksum, createdAt: timestamp });
    const characterId = Object.keys(snapshot.campaign.characters)[0]!;
    const current = () => snapshot.campaign.characters[characterId]!;
    const command = () => ({ characterId, expectedCharacterRevision: current().revision, expectedCampaignChecksum: snapshot.checksum, updatedAt: timestamp });
    const armorId = current().inventory.find((item) => item.category === "armor")!.id;
    expect(current().combat.speed).toBe("20 ft");
    snapshot = await application.editCharacter({ ...command(), patch: { combat: { speed: "35 ft" } } });
    snapshot = await application.setInventoryItemEquipped({ ...command(), itemId: armorId, value: false });
    expect(current().combat.speed).toBe("45 ft");
    snapshot = await application.setInventoryItemEquipped({ ...command(), itemId: armorId, value: true });
    expect(current().combat.speed).toBe("35 ft");
    while (current().identity.level < 4) snapshot = await application.advanceGuidedCharacter({ ...command(), choice: choice(current()) });
    expect(current().combat.speed).toBe("45 ft");
    snapshot = await application.removeInventoryItem({ ...command(), itemId: armorId });
    expect(current().combat.speed).toBe("45 ft");
  });
  it("commits complete characters and levels once, including retries with stale checksums", async () => {
    const repository = new InMemoryCampaignRepository();
    const application = new CampaignApplication(repository);
    const empty = await application.createCampaign(timestamp);
    const command = { operationId: operation(1), creation: defaultFighterCreation("Ada"), expectedCampaignChecksum: empty.checksum, createdAt: timestamp };
    const created = await application.createGuidedCharacter(command);
    expect(await application.createGuidedCharacter(command)).toEqual(created);
    const character = Object.values(created.campaign.characters)[0]!;
    const levelCommand = { characterId: character.id, choice: choice(character), expectedCharacterRevision: character.revision, expectedCampaignChecksum: created.checksum, updatedAt: timestamp };
    const next = await application.advanceGuidedCharacter(levelCommand);
    expect(await application.advanceGuidedCharacter(levelCommand)).toEqual(next);
    expect(next.campaign.characters[character.id]!.identity.level).toBe(2);
    expect(next.campaign.characters[character.id]!.inventory).toEqual(character.inventory);
    await expect(application.createGuidedCharacter({ ...command, creation: { ...command.creation, name: "Other" } })).rejects.toThrow("otras elecciones");
  });
});
