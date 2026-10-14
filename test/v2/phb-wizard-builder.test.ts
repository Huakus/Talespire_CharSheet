import { isXanatharFeat } from "../../src/domain/character/xanathar-feats";
import { describe, it, expect } from "vitest";
import { phbWizardCreation, completeWizardChoice } from "../fixtures/phb-wizard-builder";
import { createGuidedWizard, advanceGuidedWizard, replayWizardChoices } from "../../src/domain/character/wizard-builder";
import { WIZARD_SCHOOLS,wizardTraditionName } from "../../src/domain/character/wizard-catalog";
import { BUILDER_RACES, BACKGROUND_PRESETS } from "../../src/domain/character/fighter-builder-catalog";
import { classSpells,XANATHAR_SPELL_KEYS } from "../../src/domain/character/phb-spells";
import type { WizardSchool } from "../../src/domain/character/character-builder-model";
import { FeatChoiceSchema } from "../../src/domain/character/character-builder-model";
import { applyWizardAction, wizardWardMaximum } from "../../src/domain/character/wizard-play";
import type { WizardAction } from "../../src/domain/character/wizard-model";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
import { castCharacterSpell } from "../../src/domain/character/character-spells";
import { applyCharacterResourceCommand } from "../../src/domain/character/character-resources";
import { projectCharacterStatistics, projectSpellDamageExpression } from "../../src/domain/character/character-projection";
import { FEATS } from "../../src/domain/character/phb-fighter-choices";
import type { FeatChoice } from "../../src/domain/character/character-builder-model";
const id = "chr_11111111111111111111111111111111", operation = "build_11111111111111111111111111111111", time = "2026-10-13T00:00:00.000Z";
const schoolMilestones: Record<WizardSchool,string[]> = {
  "war-magic": ["Desviación Arcana","Sobrecarga de Poder","Magia Duradera","Sudario Deflector"],
  abjuration: ["Guardián arcano","Guardián proyectado","Abjuración mejorada","Resistencia a conjuros"],
  conjuration: ["Conjuración menor","Transposición benigna","Conjuración concentrada","Invocaciones duraderas"],
  divination: ["Portento","Adivinación experta","Tercer ojo","Portento superior"],
  enchantment: ["Mirada hipnótica","Encanto instintivo","Encantamiento dividido","Alterar recuerdos"],
  evocation: ["Esculpir conjuros","Truco potente","Evocación potenciada","Sobrecanalizar"],
  illusion: ["Ilusión menor mejorada","Ilusiones maleables","Yo ilusorio","Realidad ilusoria"],
  necromancy: ["Cosecha siniestra","Esbirros muertos vivientes","Habituado a la muerte","Controlar muertos vivientes"],
  transmutation: ["Alquimia menor","Piedra del transmutador","Cambiaformas","Maestro transmutador"],
};
export async function wizardAt(level: number, school: WizardSchool = "evocation") {
  let character = await createGuidedWizard(id,operation,phbWizardCreation(),time);
  while (character.identity.level < level) character = await advanceGuidedWizard(character,completeWizardChoice(character,school),time);
  return character;
}
describe("complete PHB wizard construction", () => {
  it("contains exactly the PHB wizard spell inventory at every level", () => {
    expect(Array.from({ length: 10 },(_,i) => classSpells("wizard",i).filter((k) => !XANATHAR_SPELL_KEYS.has(k)).length)).toEqual([16,30,34,29,23,23,20,15,13,12]);
  });
  it("creates all 270 race and background combinations with wizard proficiencies and equipment", async () => {
    for (const race of Object.keys(BUILDER_RACES) as Array<keyof typeof BUILDER_RACES>) for (const background of Object.keys(BACKGROUND_PRESETS) as Array<keyof typeof BACKGROUND_PRESETS>) {
      const character = await createGuidedWizard(id,operation,phbWizardCreation(race,background),time);
      expect(character.identity.className).toBe("Mago");
      expect(character.combat.hitDice.dieSize).toBe(6);
      expect(character.inventory.some((i) => i.name === "Spellbook")).toBe(true);
      expect(character.proficiencies.weapons).not.toContain("Armas marciales");
      expect(character.checks.savingThrows.intelligence.proficiency).toBe(1);
      expect(character.checks.savingThrows.wisdom.proficiency).toBe(1);
      expect(character.checks.savingThrows.strength.proficiency).toBe(0);
      expect(character.traits.flatMap((g) => g.traits).some((t) => t.name === "Segundo aliento")).toBe(false);
    }
  });
  it.each(Object.keys(WIZARD_SCHOOLS) as WizardSchool[])("advances %s through 20 with all subclass milestones and expended resources preserved", async (school) => {
    let character = await wizardAt(2,school);
    character.combat.hitPoints.current = 2; character.combat.hitDice.remaining = 1;
    character.spellcasting.slots["1"]!.used = 1;
    const recovery = character.traits.flatMap((g) => g.traits).find((t) => t.name === "Recuperación arcana")!; recovery.uses.used = 1;
    const checkMilestones = () => schoolMilestones[school].forEach((name,i) => expect(character.traits.flatMap((g) => g.traits).some((t) => t.name === name)).toBe(character.identity.level >= [2,6,10,14][i]!));
    checkMilestones();
    while (character.identity.level < 20) { character = await advanceGuidedWizard(character,completeWizardChoice(character,school),time); checkMilestones(); }
    expect(character.combat.hitPoints.current).toBe(2);
    expect(character.combat.hitDice.remaining).toBe(19);
    expect(character.spellcasting.slots["1"]!.used).toBe(1);
    expect(character.traits.flatMap((g) => g.traits).find((t) => t.id === recovery.id)!.uses.used).toBe(1);
    expect(Object.values(character.spellcasting.slots).map((s) => s.maximum)).toEqual([4,3,3,3,3,2,2,1,1]);
    expect(replayWizardChoices(character.builder!).cantrips).toHaveLength(school === "illusion" ? 6 : 5);
    expect(character.spellcasting.wizard!.mastery).toHaveLength(2);
    expect(character.builder!.levels.at(-1)!.wizard.signature).toHaveLength(2);
    expect(character.traits.flatMap((g) => g.traits).some((t) => t.name === "Maestría de conjuros")).toBe(true);
    expect(character.identity.subclass).toBe(wizardTraditionName(school));
  });
  it("rejects incomplete, repeated and out-of-list initial spell choices", async () => {
    for (const keys of [["shield"],Array(6).fill("shield"),["shield","mage-armor","magic-missile","sleep","find-familiar","cure-wounds"]]) {
      const creation = phbWizardCreation(); creation.wizard.learn = keys;
      await expect(createGuidedWizard(id,operation,creation,time)).rejects.toThrow();
    }
    const creation = phbWizardCreation(); creation.wizard.cantrips[0] = "fireball";
    await expect(createGuidedWizard(id,operation,creation,time)).rejects.toThrow();
  });
  it("rejects illegal advancement quotas, spell levels, hit dice and subclass timing", async () => {
    const character = await wizardAt(1);
    for (const modify of [
      (step: ReturnType<typeof completeWizardChoice>) => { step.wizard.learn = ["fireball","counterspell"]; },
      (step: ReturnType<typeof completeWizardChoice>) => { step.wizard.learn = ["shield","sleep"]; },
      (step: ReturnType<typeof completeWizardChoice>) => { step.wizard.cantrips = ["acid-splash"]; },
      (step: ReturnType<typeof completeWizardChoice>) => { step.hpBase = 6; },
      (step: ReturnType<typeof completeWizardChoice>) => { step.subclass = "champion"; },
      (step: ReturnType<typeof completeWizardChoice>) => { step.subclass = null; },
    ]) {
      const step = completeWizardChoice(character); modify(step);
      await expect(advanceGuidedWizard(character,step,time)).rejects.toThrow();
    }
    const second = await advanceGuidedWizard(character,completeWizardChoice(character),time), step = completeWizardChoice(second); step.subclass = "evocation";
    await expect(advanceGuidedWizard(second,step,time)).rejects.toThrow();
  });
  it("grants the illusion replacement cantrip when Minor Illusion comes from forest gnome", async () => {
    const creation = phbWizardCreation("forest-gnome"); creation.wizard.cantrips[2] = "light";
    const character = await createGuidedWizard(id,operation,creation,time), step = completeWizardChoice(character,"illusion");
    step.wizard.bonusCantrip = "acid-splash";
    const next = await advanceGuidedWizard(character,step,time);
    expect(replayWizardChoices(next.builder!).cantrips).toEqual(expect.arrayContaining(["light","acid-splash"]));
    expect(next.spellcasting.spells.filter((s) => s.level === 0)).toHaveLength(5);
  });
  it("preserves a player's chosen weapon ability when advancing", async () => {
    const character = await wizardAt(1), action = character.actions.find((a) => a.inventoryItemId && a.ability)!;
    action.ability = "intelligence"; action.damageBonus = 2;
    const next = await advanceGuidedWizard(character,completeWizardChoice(character),time);
    expect(next.actions.find((a) => a.id === action.id)!.ability).toBe("intelligence");
  });
});
let actionSequence = 1000;
const act = (character: CharacterV2,action: WizardAction) => applyWizardAction(character,action,{ operationId: `wizard_${(++actionSequence).toString(16).padStart(32,"0")}`,expectedRevision: character.revision,updatedAt: time });
const spell = (character: CharacterV2,key: string) => character.spellcasting.spells.find((s) => s.casting?.kind === "wizard" && s.casting.key === key)!;
const rest = (character: CharacterV2,kind: "long-rest" | "short-rest") => applyCharacterResourceCommand(character,{ kind },{ expectedRevision: character.revision,updatedAt: time }).character;
describe("wizard play rules", () => {
  it("enforces preparation, permits rituals from the book and preserves prepared spells when the book is lost", async () => {
    let character = await wizardAt(1);
    expect(spell(character,"find-familiar").prepared).toBe(false);
    expect(() => castCharacterSpell(character,spell(character,"find-familiar").id,1,{ expectedRevision: character.revision,updatedAt: time })).toThrow("Prepará");
    character = castCharacterSpell(character,spell(character,"find-familiar").id,1,{ expectedRevision: character.revision,updatedAt: time,mode: "ritual" });
    expect(character.spellcasting.slots["1"]!.used).toBe(0);
    await expect(act(character,{ kind: "prepare",keys: character.spellcasting.wizard!.book,afterLongRest: true })).rejects.toThrow("hasta nivel");
    character = await act(character,{ kind: "book-access",available: false });
    expect(() => castCharacterSpell(character,spell(character,"find-familiar").id,1,{ expectedRevision: character.revision,updatedAt: time,mode: "ritual" })).toThrow("libro disponible");
    character = castCharacterSpell(character,spell(character,"shield").id,1,{ expectedRevision: character.revision,updatedAt: time });
    expect(character.spellcasting.slots["1"]!.used).toBe(1);
  });
  it("copies at the school discount, records expenses and time and does not prepare new spells automatically", async () => {
    let character = await wizardAt(3,"abjuration"); character.currency.gold = 1000;
    const operationId = "wizard_22222222222222222222222222222222", options = { operationId,expectedRevision: character.revision,updatedAt: time };
    const action = { kind: "copy" as const,key: "protection-from-evil-and-good",source: "external" as const };
    character = await applyWizardAction(character,action,options);
    expect(character.currency.gold).toBe(975);
    expect(character.spellcasting.wizard!.copied[0]).toMatchObject({ key: action.key,gold: 25,hours: 1,level: 3 });
    expect(spell(character,action.key).prepared).toBe(false);
    expect(await applyWizardAction(character,action,options)).toEqual(character);
    character = await advanceGuidedWizard(character,completeWizardChoice(character,"abjuration"),time);
    expect(character.spellcasting.wizard!.book).toContain(action.key);
    expect(character.currency.gold).toBe(975);
  });
  it("reconstructs only prepared spells from a lost book and charges for a new blank book", async () => {
    let character = await wizardAt(1); character.currency.gold = 200;
    character = await act(character,{ kind: "book-access",available: false });
    await expect(act(character,{ kind: "replace-book",keys: ["find-familiar"],buyBlankBook: true })).rejects.toThrow("preparados");
    character = await act(character,{ kind: "replace-book",keys: ["shield"],buyBlankBook: true });
    expect(character.currency.gold).toBe(140);
    expect(character.spellcasting.wizard!.book).toEqual(["shield"]);
    character = await advanceGuidedWizard(character,completeWizardChoice(character),time);
    expect(character.spellcasting.wizard!.book).not.toContain("find-familiar");
    expect(spell(character,"mage-armor").prepared).toBe(true);
  });
  it("recovers only expended legal slots once per day and does not refresh Arcane Recovery on short rests", async () => {
    let character = await wizardAt(10); character.spellcasting.slots["1"]!.used = 2; character.spellcasting.slots["3"]!.used = 1;
    await expect(act(character,{ kind: "arcane-recovery",slots: [3,3],afterShortRest: true })).rejects.toThrow("mitad");
    character = await act(character,{ kind: "arcane-recovery",slots: [3,1,1],afterShortRest: true });
    expect(character.spellcasting.slots["3"]!.used).toBe(0);
    character = rest(character,"short-rest"); character.spellcasting.slots["1"]!.used = 1;
    await expect(act(character,{ kind: "arcane-recovery",slots: [1],afterShortRest: true })).rejects.toThrow("No quedan usos");
    character = rest(character,"long-rest"); character.spellcasting.slots["1"]!.used = 1;
    expect((await act(character,{ kind: "arcane-recovery",slots: [1],afterShortRest: true })).spellcasting.slots["1"]!.used).toBe(0);
  });
  it("creates and recharges Arcane Ward with abjurations, including rituals, without changing HP", async () => {
    let character = await wizardAt(2,"abjuration"); const hp = character.combat.hitPoints.current;
    character = castCharacterSpell(character,spell(character,"alarm").id,1,{ expectedRevision: character.revision,updatedAt: time,mode: "ritual" });
    expect(character.spellcasting.wizard!.ward).toEqual({ created: true,current: wizardWardMaximum(character) });
    character = await act(character,{ kind: "ward-damage",damage: 5 });
    character = castCharacterSpell(character,spell(character,"mage-armor").id,1,{ expectedRevision: character.revision,updatedAt: time });
    expect(character.spellcasting.wizard!.ward.current).toBe(wizardWardMaximum(character)-3);
    expect(character.combat.hitPoints.current).toBe(hp);
    expect(rest(character,"short-rest").spellcasting.wizard!.ward).toEqual(character.spellcasting.wizard!.ward);
    expect(rest(character,"long-rest").spellcasting.wizard!.ward.created).toBe(false);
  });
  it("refreshes Benign Transposition on a conjuration and restores a lower slot through Expert Divination", async () => {
    let conjurer = await wizardAt(6,"conjuration");
    conjurer = await act(conjurer,{ kind: "use-feature",key: "benign-transposition" });
    conjurer = castCharacterSpell(conjurer,spell(conjurer,"find-familiar").id,1,{ expectedRevision: conjurer.revision,updatedAt: time,mode: "ritual" });
    expect(conjurer.traits.flatMap((g) => g.traits).find((t) => t.name === "Transposición benigna")!.uses.used).toBe(0);
    let diviner = await wizardAt(6,"divination"); diviner.spellcasting.slots["1"]!.used = 1;
    diviner = castCharacterSpell(diviner,spell(diviner,"detect-magic").id,3,{ expectedRevision: diviner.revision,updatedAt: time,recoverSlotLevel: 1 });
    expect(diviner.spellcasting.slots["1"]!.used).toBe(0); expect(diviner.spellcasting.slots["3"]!.used).toBe(1);
    expect(() => castCharacterSpell(diviner,spell(diviner,"detect-magic").id,1,{ expectedRevision: diviner.revision,updatedAt: time,mode: "ritual",recoverSlotLevel: 1 })).toThrow("Adivinación experta");
  });
  it("stores each Portent result once and discards unused results on a long rest", async () => {
    let character = await wizardAt(14,"divination");
    character = await act(character,{ kind: "portent-roll",values: [1,12,20] });
    character = await act(character,{ kind: "portent-use",index: 2 });
    expect(character.spellcasting.wizard!.portent[2]!.used).toBe(true);
    await expect(act(character,{ kind: "portent-use",index: 2 })).rejects.toThrow("ya se gastó");
    await expect(act(character,{ kind: "portent-roll",values: [2,3,4] })).rejects.toThrow("una sola vez");
    character = rest(character,"long-rest"); expect(character.spellcasting.wizard!.portent).toHaveLength(0);
    character = await act(character,{ kind: "portent-roll",values: [2,3,4] });
    character = await act(character,{ kind: "third-eye",benefit: "invisible" });
    expect(rest(character,"short-rest").spellcasting.wizard!.thirdEye).toBeNull();
  });
  it("supports mastery, signature spells and ordinary slot casts as separate choices", async () => {
    let character = await wizardAt(20);
    const mastered = character.spellcasting.wizard!.mastery;
    character = await act(character,{ kind: "prepare",keys: mastered,afterLongRest: true });
    const spell1 = spell(character,mastered[0]!);
    character = castCharacterSpell(character,spell1.id,1,{ expectedRevision: character.revision,updatedAt: time,mode: "mastery" });
    expect(character.spellcasting.slots["1"]!.used).toBe(0);
    expect(() => castCharacterSpell(character,spell1.id,2,{ expectedRevision: character.revision,updatedAt: time,mode: "mastery" })).toThrow("nivel base");
    const signature = spell(character,character.builder!.levels.at(-1)!.wizard.signature[0]!);
    expect(signature.prepared).toBe(true);
    character = castCharacterSpell(character,signature.id,3,{ expectedRevision: character.revision,updatedAt: time,mode: "signature" });
    expect(character.spellcasting.slots["3"]!.used).toBe(0);
    expect(() => castCharacterSpell(character,signature.id,3,{ expectedRevision: character.revision,updatedAt: time,mode: "signature" })).toThrow("No quedan usos");
    character = castCharacterSpell(character,signature.id,4,{ expectedRevision: character.revision,updatedAt: time });
    expect(character.spellcasting.slots["4"]!.used).toBe(1);
    character = rest(character,"short-rest");
    expect(() => castCharacterSpell(character,signature.id,3,{ expectedRevision: character.revision,updatedAt: time,mode: "signature" })).not.toThrow();
  });
  it("handles the stone bearer, save proficiency, speed and Shapechanger without consuming slots", async () => {
    let character = await wizardAt(14,"transmutation"); const save = projectCharacterStatistics(character).savingThrows.constitution;
    character = await act(character,{ kind: "stone",benefit: "speed",bearer: "self",unencumbered: true,create: true });
    expect(character.combat.speed).toBe("40 ft");
    character = await act(character,{ kind: "stone",benefit: "constitution",bearer: "self",unencumbered: true,create: true });
    expect(character.combat.speed).toBe("30 ft"); expect(projectCharacterStatistics(character).savingThrows.constitution).toBe(save+5);
    expect(spell(character,"polymorph")).toBeDefined();
    expect(() => castCharacterSpell(character,spell(character,"polymorph").id,4,{ expectedRevision: character.revision,updatedAt: time,mode: "shapechanger" })).toThrow("preparado");
    character = await act(character,{ kind: "prepare",keys: ["polymorph"],afterLongRest: true });
    character = castCharacterSpell(character,spell(character,"polymorph").id,4,{ expectedRevision: character.revision,updatedAt: time,mode: "shapechanger" });
    expect(character.spellcasting.slots["4"]!.used).toBe(0);
    character = await act(character,{ kind: "master-transmuter",effect: "panacea" });
    expect(character.spellcasting.wizard!.stone).toBeNull();
    await expect(act(character,{ kind: "stone",benefit: "fire",bearer: "self",unencumbered: true,create: true })).rejects.toThrow("descanso largo");
    expect(rest(character,"short-rest").spellcasting.wizard!.stoneConsumed).toBe(true);
    expect(rest(character,"long-rest").spellcasting.wizard!.stoneConsumed).toBe(false);
  });
  it("adds Empowered Evocation once and records Overchannel repetitions until a long rest", async () => {
    let character = await wizardAt(14,"evocation");
    expect(projectSpellDamageExpression(character,spell(character,"fire-bolt"))).toBe("3d10+3");
    for (let i=1; i<=2; i++) {
      character = castCharacterSpell(character,spell(character,"magic-missile").id,1,{ expectedRevision: character.revision,updatedAt: time,overchannel: true });
      expect(character.spellcasting.wizard!.overchannelUses).toBe(i);
    }
    expect(rest(character,"short-rest").spellcasting.wizard!.overchannelUses).toBe(2);
    expect(rest(character,"long-rest").spellcasting.wizard!.overchannelUses).toBe(0);
  });
  it("checks armor feat prerequisites and rejects unprepared magic or spells cast in untrained armor", async () => {
    let character = await wizardAt(3), choice = completeWizardChoice(character);
    choice.abilityIncrease = null; choice.feat = FeatChoiceSchema.parse({ key: "heavily-armored",ability: "strength" });
    await expect(advanceGuidedWizard(character,choice,time)).rejects.toThrow("armaduras");
    choice.feat = FeatChoiceSchema.parse({ key: "lightly-armored",ability: "strength" });
    character = await advanceGuidedWizard(character,choice,time);
    expect(character.proficiencies.armor).toContain("Armaduras ligeras");
    const creation = phbWizardCreation(); creation.equipment.method = "gold"; creation.equipment.goldRoll = [4,4,4,4]; creation.equipment.purchases = [{ key: "chain-mail",quantity: 1,equipped: true }];
    const armored = await createGuidedWizard(id,operation,creation,time);
    expect(() => castCharacterSpell(armored,spell(armored,"fire-bolt").id,0,{ expectedRevision: armored.revision,updatedAt: time })).toThrow("armadura");
    expect(() => castCharacterSpell(character,spell(character,"fire-bolt").id,1,{ expectedRevision: character.revision,updatedAt: time })).toThrow("truco");
  });
  it("keeps backup books independent and can recover an unprepared spell from an owned backup", async () => {
    let character = await wizardAt(1); character.currency.gold = 300;
    character = await act(character,{ kind: "backup-book",keys: ["find-familiar"],buyBlankBook: true });
    expect(character.currency.gold).toBe(240);
    character = await act(character,{ kind: "book-access",available: false });
    await expect(act(character,{ kind: "copy",key: "find-familiar",source: "own" })).rejects.toThrow("libro disponible");
    character = await act(character,{ kind: "replace-book",keys: ["shield"],buyBlankBook: true });
    character = await act(character,{ kind: "copy",key: "find-familiar",source: "own" });
    expect(character.currency.gold).toBe(170);
    expect(character.spellcasting.wizard!.book).toEqual(["shield","find-familiar"]);
    expect(spell(character,"find-familiar").prepared).toBe(false);
    const backup = character.spellcasting.wizard!.backups[0]!;
    character = await act(character,{ kind: "use-backup",id: backup.id });
    expect(character.spellcasting.wizard!.book).toEqual(["find-familiar"]);
    expect(character.spellcasting.wizard!.backups[1]!.keys).toEqual(["shield","find-familiar"]);
  });
  it("adds Magic Initiate wizard magic to the class book while preserving the feat's own daily casting", async () => {
    const creation = phbWizardCreation("human-variant");
    creation.initialFeat = FeatChoiceSchema.parse({ key: "magic-initiate",spellClass: "wizard",spells: ["blade-ward","friends","chromatic-orb"] });
    let character = await createGuidedWizard(id,operation,creation,time);
    expect(character.spellcasting.wizard!.book).toHaveLength(7);
    const daily = character.spellcasting.spells.find((s) => s.name === "Orbe cromático" && s.casting?.kind === "innate")!;
    character = castCharacterSpell(character,daily.id,1,{ expectedRevision: character.revision,updatedAt: time });
    expect(character.spellcasting.slots["1"]!.used).toBe(0);
    character = await act(character,{ kind: "prepare",keys: ["chromatic-orb"],afterLongRest: true });
    character = castCharacterSpell(character,spell(character,"chromatic-orb").id,1,{ expectedRevision: character.revision,updatedAt: time });
    expect(character.spellcasting.slots["1"]!.used).toBe(1);
    expect(() => castCharacterSpell(character,daily.id,1,{ expectedRevision: character.revision,updatedAt: time })).toThrow("No quedan usos");
  });
  it("uses stable resource IDs even when a player renames a class group or resource", async () => {
    let character = await wizardAt(2,"divination");
    const group = character.traits.find((g) => g.title.startsWith("Mago ·"))!, resource = group.traits.find((t) => t.name === "Recuperación arcana")!;
    group.title = "Mi magia"; resource.name = "Mi recuperación"; character.spellcasting.slots["1"]!.used = 1;
    character = await act(character,{ kind: "arcane-recovery",slots: [1],afterShortRest: true });
    expect(character.traits.flatMap((g) => g.traits).find((t) => t.id === resource.id)!.uses.used).toBe(1);
  });
  it("ends Third Eye on incapacitation and exempts only conjuration concentration from damage", async () => {
    let character = await wizardAt(10,"divination");
    character = await act(character,{ kind: "third-eye",benefit: "darkvision" });
    character = applyCharacterResourceCommand(character,{ kind: "add-condition",conditionId: "cnd_22222222222222222222222222222222",key: "incapacitated",label: "Incapacitado",level: null,addedAt: time },{ expectedRevision: character.revision,updatedAt: time }).character;
    expect(character.spellcasting.wizard!.thirdEye).toBeNull();
    let conjurer = await wizardAt(10,"conjuration");
    conjurer.combat.hitPoints = { current: 100,maximum: 100,temporary: 0 };
    conjurer.combat.conditions = [{ id: "cnd_33333333333333333333333333333333",key: "concentration",label: "Concentración",level: null,addedAt: time }];
    conjurer.spellcasting.wizard!.concentrationSchool = "Conjuración";
    expect(applyCharacterResourceCommand(conjurer,{ kind: "damage",amount: 25 },{ expectedRevision: conjurer.revision,updatedAt: time }).effects.concentrationCheckDc).toBeNull();
    conjurer.spellcasting.wizard!.concentrationSchool = "Transmutación";
    expect(applyCharacterResourceCommand(conjurer,{ kind: "damage",amount: 25 },{ expectedRevision: conjurer.revision,updatedAt: time }).effects.concentrationCheckDc).toBe(12);
    conjurer.spellcasting.wizard!.concentrationSchool = "Conjuración";
    expect(applyCharacterResourceCommand(conjurer,{ kind: "damage",amount: 100 },{ expectedRevision: conjurer.revision,updatedAt: time }).character.combat.conditions).not.toEqual(expect.arrayContaining([expect.objectContaining({ key: "concentration" })]));
  });
  it.each(Object.keys(FEATS).filter((k) => !isXanatharFeat(k)) as Array<FeatChoice["key"]>)("applies every PHB feat to a wizard with valid prerequisites: %s", async (key) => {
    const creation = phbWizardCreation("mountain-dwarf"); creation.abilityMethod = "rolled";
    creation.baseAbilities = { strength: 16,dexterity: 16,constitution: 16,intelligence: 16,wisdom: 16,charisma: 16 };
    let character = await createGuidedWizard(id,operation,creation,time);
    while (character.identity.level < 3) character = await advanceGuidedWizard(character,completeWizardChoice(character),time);
    if (key === "heavy-armor-master") {
      const step = completeWizardChoice(character); step.abilityIncrease = null; step.feat = FeatChoiceSchema.parse({ key: "heavily-armored",ability: "strength" });
      character = await advanceGuidedWizard(character,step,time);
      while (character.identity.level < 7) character = await advanceGuidedWizard(character,completeWizardChoice(character),time);
    }
    const feat = FeatChoiceSchema.parse({ key,ability: FEATS[key].abilities[0] ?? null });
    if (key === "skilled") feat.skills = ["acrobatics","animalHandling","athletics"];
    if (key === "linguist") feat.languages = ["Infernal","Abisal","Dracónico"];
    if (key === "elemental-adept") feat.damageType = "fire";
    if (key === "martial-adept") feat.maneuvers = ["parry","riposte"];
    if (key === "weapon-master") feat.weapons = ["club","dagger","longsword","longbow"];
    if (["magic-initiate","ritual-caster","spell-sniper"].includes(key)) feat.spellClass = "wizard";
    if (key === "magic-initiate") feat.spells = ["blade-ward","friends","chromatic-orb"];
    if (key === "ritual-caster") feat.spells = ["identify","unseen-servant"];
    if (key === "spell-sniper") feat.spells = ["ray-of-frost"];
    const step = completeWizardChoice(character); step.abilityIncrease = null; step.feat = feat;
    character = await advanceGuidedWizard(character,step,time);
    expect(character.traits.flatMap((g) => g.traits).some((t) => t.name === FEATS[key].name)).toBe(true);
  });
});
