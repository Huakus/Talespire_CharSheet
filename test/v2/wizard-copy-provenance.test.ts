import { describe, expect, it } from "vitest";
import { createGuidedWizard, advanceGuidedWizard, applyWizardBenefits, validateWizardBuild } from "../../src/domain/character/wizard-builder";
import { applyWizardAction } from "../../src/domain/character/wizard-play";
import { WizardRuntimeSchema } from "../../src/domain/character/wizard-model";
import { projectCharacterProgression } from "../../src/domain/character/character-progression";
import { wizardCopyDescription } from "../../src/domain/character/wizard-catalog";
import { PHB_SPELLS } from "../../src/domain/character/phb-spells";
import { CharacterV2Schema } from "../../src/domain/character/character-v2";
import { castCharacterSpell } from "../../src/domain/character/character-spells";
import { spellPersonalInfo } from "../../src/ui/spell-casting-filters";
import { phbWizardCreation, completeWizardChoice } from "../fixtures/phb-wizard-builder";
const time = "2026-10-16T00:00:00.000Z", id = "chr_11111111111111111111111111111111", operationId = "wizard_11111111111111111111111111111111";

describe("wizard copied-spell provenance", () => {
  async function wizardAtFive() {
    let c = await createGuidedWizard(id, "build_11111111111111111111111111111111", phbWizardCreation(), time);
    while (c.identity.level < 5) c = await advanceGuidedWizard(c, completeWizardChoice(c,"necromancy"), time);
    return c;
  }
  it("does not grant Speak with Dead as a PHB wizard spell even to a necromancer", async () => {
    const c = await wizardAtFive();
    const copy = WizardRuntimeSchema.parse({ copied: [{ operationId,key: "speak-with-dead",level: 5,gold: 0,hours: 0,source: "external",historical: true }] }).copied[0]!;
    expect(() => validateWizardBuild(c.builder!,[copy])).toThrow("historial de copia");
    expect(PHB_SPELLS[copy.key]!.classes).not.toContain("wizard");
  });
  it("retains a custom book spell through preparation, casting, persistence, level-up and recopying", async () => {
    let c = await wizardAtFive();
    const key = "campaign:custom-necromancy", originalId = "spl_22222222222222222222222222222222";
    const definition = { ...PHB_SPELLS["speak-with-dead"]!,name: "Conjuro de prueba de campaña",classes: [] };
    c.spellcasting.wizard!.copied.push({ operationId,key,level: 5,gold: 0,hours: 0,source: "external",historical: true,definition,wizardAccess: "campaign" });
    c.spellcasting.wizard!.book.push(key);
    c.spellcasting.spells.push({ id: originalId,order: 100,name: definition.name,level: 3,prepared: false,definition,casting: { source: "builder:wizard",kind: "wizard",key,ability: "intelligence",level: 3,traitId: null },effect: { active: false,description: "" } });
    c = await applyWizardBenefits(c,c);
    expect(c.spellcasting.spells.filter((s) => s.casting?.key === key).map((s) => s.id)).toEqual([originalId]);
    c = await applyWizardAction(c,{ kind: "prepare",keys: [key],afterLongRest: true },{ operationId: "wizard_33333333333333333333333333333333",expectedRevision: c.revision,updatedAt: time });
    c = castCharacterSpell(c,originalId,3,{ expectedRevision: c.revision,updatedAt: time });
    expect(c.spellcasting.slots["3"]!.used).toBe(1);
    c = CharacterV2Schema.parse(JSON.parse(JSON.stringify(c)));
    c = await advanceGuidedWizard(c,completeWizardChoice(c,"necromancy"),time);
    expect(c.spellcasting.spells.find((s) => s.id === originalId)?.casting?.ability).toBe("intelligence");
    expect((await projectCharacterProgression(c))!.levels[4]!.studies.some((study) => study.value === definition.name)).toBe(true);
    c.spellcasting.wizard!.book = c.spellcasting.wizard!.book.filter((k) => k !== key);
    c.currency.gold = 200;
    c = await applyWizardAction(c,{ kind: "copy",key,source: "external" },{ operationId: "wizard_44444444444444444444444444444444",expectedRevision: c.revision,updatedAt: time });
    expect(c.currency.gold).toBe(125);
    expect(c.spellcasting.wizard!.copied.at(-1)).toMatchObject({ wizardAccess: "campaign",definition,source: "external",historical: false,gold: 75,hours: 3 });
    expect(() => validateWizardBuild(c.builder!,c.spellcasting.wizard!.copied)).not.toThrow();
  });
  it("loads previous copy records without inventing their source", () => {
    const runtime = WizardRuntimeSchema.parse({ copied: [{ operationId, key: "alarm", level: 1, gold: 50, hours: 2 }] });
    expect(runtime.copied[0]).toMatchObject({ source: null, historical: false });
    expect(wizardCopyDescription(runtime.copied[0]!)).toBe("Copia al libro · 50 po · 2 horas");
  });
  it("records a normal external copy and exposes its origin without changing its wizard casting kind", async () => {
    let c = await createGuidedWizard(id, "build_11111111111111111111111111111111", phbWizardCreation(), time);
    c.currency.gold = 100;
    c = await applyWizardAction(c, { kind: "copy", key: "alarm", source: "external" }, { operationId, expectedRevision: c.revision, updatedAt: time });
    const spell = c.spellcasting.spells.find((s) => s.casting?.key === "alarm")!;
    expect(c.currency.gold).toBe(50);
    expect(c.spellcasting.wizard!.copied[0]).toMatchObject({ source: "external", historical: false });
    expect(spell.casting?.kind).toBe("wizard");
    expect(spellPersonalInfo(c, spell)).toMatchObject({ learning: "external-book", learningLabel: "Libro ajeno", ability: "intelligence" });
  });
  it("preserves a historical copy through level-up and progression without claiming it was free or charging current money", async () => {
    let c = await createGuidedWizard(id, "build_11111111111111111111111111111111", phbWizardCreation(), time);
    const gold = c.currency.gold;
    c.spellcasting.wizard!.copied.push({ operationId, key: "alarm", level: 1, gold: 0, hours: 0, source: "external", historical: true,definition: null,wizardAccess: "standard" });
    c.spellcasting.wizard!.book.push("alarm");
    c = await applyWizardBenefits(c, c);
    validateWizardBuild(c.builder!, c.spellcasting.wizard!.copied);
    c = await advanceGuidedWizard(c, completeWizardChoice(c), time);
    expect(c.currency.gold).toBe(gold);
    expect(c.spellcasting.spells.filter((s) => s.casting?.key === "alarm")).toHaveLength(1);
    const history = await projectCharacterProgression(c);
    expect(history!.levels[0]!.studies[0]!.description).toContain("Libro ajeno");
    expect(history!.levels[0]!.studies[0]!.description).toContain("coste y tiempo anteriores no registrados");
    expect(history!.levels[0]!.studies[0]!.description).not.toContain("0 po");
  });
});
