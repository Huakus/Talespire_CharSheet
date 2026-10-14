import { describe,it,expect } from "vitest";
import { projectCharacterProgression } from "../../src/domain/character/character-progression";
import { progressionChoices } from "../../src/domain/character/progression-choices";
import { buildGuidedCharacter,advanceGuidedCharacter } from "../../src/domain/character/guided-character-builder";
import { createCharacter } from "../../src/domain/character/create-character";
import { FeatChoiceSchema,type FighterCreation,type FighterLevelChoice } from "../../src/domain/character/character-builder-model";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
import { phbFighterCreation,completeFighterChoice } from "../fixtures/phb-fighter-builder";
import { phbWizardCreation,completeWizardChoice } from "../fixtures/phb-wizard-builder";
import { phbWarlockCreation,completeWarlockChoice } from "../fixtures/phb-warlock-builder";
import { clericCreation,clericChoice } from "../fixtures/cleric-builder";
import { rogueAt,rogueChoice } from "../fixtures/rogue-builder";
import { barbarianAt,barbarianChoice } from "../fixtures/barbarian-builder";
import { bardAt,bardChoice } from "../fixtures/bard-builder";
import { druidAt,druidChoice } from "../fixtures/druid-builder";
import { rangerAt,rangerChoice } from "../fixtures/ranger-builder";
import { PHB_SPELLS,classSpells } from "../../src/domain/character/phb-spells";
import { applyWizardAction } from "../../src/domain/character/wizard-play";
const id = "chr_00000000000000000000000000000001",op = "build_00000000000000000000000000000001",at = "2026-10-14T20:00:00Z";
const create = (c: FighterCreation) => buildGuidedCharacter(id,op,c,at);
async function advanceTo(c: CharacterV2,n: number,choice: (c: CharacterV2) => FighterLevelChoice) { while (c.identity.level < n) c = await advanceGuidedCharacter(c,choice(c),at);return c; }
describe("Progresión consultable del personaje",() => {
  it.each([
    ["Guerrero",async () => advanceTo(await create(phbFighterCreation()),20,(c) => completeFighterChoice(c,"battle-master"))],
    ["Mago",async () => advanceTo(await create(phbWizardCreation()),20,completeWizardChoice)],
    ["Brujo",async () => advanceTo(await create(phbWarlockCreation()),20,completeWarlockChoice)],
    ["Clérigo",async () => advanceTo(await create(clericCreation()),20,clericChoice)],
    ["Pícaro",async () => rogueAt(20,"arcane-trickster")],
    ["Bárbaro",async () => barbarianAt(20,"totem-warrior")],
    ["Bardo",async () => bardAt(20,"lore")],
    ["Druida",async () => druidAt(20,"land","coast")],
    ["Explorador",async () => rangerAt(20,"beast-master")],
  ] as const)("reconstruye los veinte niveles de %s sin alterar su ficha",async (name,factory) => {
    const c = await factory(),original = JSON.stringify(c),result = (await projectCharacterProgression(c))!;expect(result.className).toBe(name);expect(result.levels.map((l) => l.level)).toEqual(Array.from({ length: 20 },(_,i) => i+1));expect(result.levels.at(-1)!.hpMaximum).toBe(c.combat.hitPoints.maximum);expect(result.notices).toEqual([]);expect(JSON.stringify(c)).toBe(original);
    expect(result.levels.every((l) => l.benefits.some((b) => b.label === "PG máximos"))).toBe(true);expect(result.levels[0]!.decisions.some((d) => d.label === "Trasfondo")).toBe(true);expect(result.levels[0]!.benefits.some((d) => d.label === "Equipo inicial recibido")).toBe(true);
  });
  it("separa el estilo elegido en 2, los rasgos automáticos en 5 y las mejoras de recursos",async () => {
    const c = await rangerAt(5,"gloom-stalker"),result = (await projectCharacterProgression(c))!;expect(result.levels[1]!.decisions).toContainEqual({ label: "Estilo de combate",value: "Arquería" });expect(result.levels[4]!.traits.some((t) => t.name === "Ataque Extra" && !t.updated)).toBe(true);expect(result.levels[2]!.benefits.some((d) => d.label === "Iniciativa")).toBe(true);
    const bard = (await projectCharacterProgression(await bardAt(5)))!;expect(bard.levels[4]!.traits.some((t) => t.updated && t.name.includes("Inspiración"))).toBe(true);
  });
  it("muestra conjuros sustituidos con sus nombres españoles y no como aprendizaje adicional",async () => {
    const c3 = await rangerAt(3),step = rangerChoice(c3);const oldKey = c3.spellcasting.spells.find((s) => s.casting?.source === "builder:ranger")!.casting!.key,newKey = classSpells("ranger",1).find((key) => !c3.spellcasting.spells.some((s) => s.casting?.key === key))!;step.ranger.replaceSpell = { oldKey,newKey };const result = (await projectCharacterProgression(await advanceGuidedCharacter(c3,step,at)))!;expect(result.levels[3]!.replacements).toEqual([{ label: "Conjuro",before: PHB_SPELLS[oldKey]!.name,after: PHB_SPELLS[newKey]!.name }]);expect(result.levels[3]!.spells.some((s) => s.name === PHB_SPELLS[newKey]!.name)).toBe(false);
  });
  it("distingue invocaciones reemplazadas y los espacios de pacto de Brujo",async () => {
    const c = await advanceTo(await create(phbWarlockCreation()),3,completeWarlockChoice),result = (await projectCharacterProgression(c))!;expect(result.levels[2]!.replacements.some((r) => r.label === "Invocación" && r.before === "Armadura de sombras")).toBe(true);expect(result.levels[2]!.benefits.some((b) => b.label === "Espacios de pacto · nivel 2")).toBe(true);
  });
  it("etiqueta la lista disponible y los conjuros siempre preparados de dominio y terreno",async () => {
    const cleric = (await projectCharacterProgression(await create(clericCreation("life"))))!;expect(cleric.levels[0]!.spells.some((s) => s.kind === "Siempre preparado")).toBe(true);expect(cleric.levels[0]!.spells.some((s) => s.kind === "Disponible para preparar")).toBe(true);
    const druid = (await projectCharacterProgression(await druidAt(3,"land","coast")))!;expect(druid.levels[2]!.spells.some((s) => s.kind === "Siempre preparado")).toBe(true);
  });
  it("refleja aumentos retroactivos de CON y distingue dotes de renuncias",async () => {
    const c = await rangerAt(3),step = rangerChoice(c);step.skipImprovement = false;step.abilityIncrease = { strength: 0,dexterity: 0,constitution: 2,intelligence: 0,wisdom: 0,charisma: 0 };const result = (await projectCharacterProgression(await advanceGuidedCharacter(c,step,at)))!;expect(result.levels[3]!.hpIncrease).toBe(12);expect(result.levels[3]!.decisions).toContainEqual({ label: "Mejora de atributos",value: "Constitución +2" });
    step.abilityIncrease = null;step.feat = FeatChoiceSchema.parse({ key: "tough" });const feat = (await projectCharacterProgression(await advanceGuidedCharacter(c,step,at)))!;expect(feat.levels[3]!.decisions.some((d) => d.label === "Dote")).toBe(true);expect(feat.levels[3]!.hpIncrease).toBe(16);
  });
  it("mantiene copias de Mago en su nivel y permite maestría de un conjuro copiado",async () => {
    let c = await advanceTo(await create(phbWizardCreation()),17,completeWizardChoice);const known = new Set(c.spellcasting.wizard!.book),key = classSpells("wizard",1).find((s) => !known.has(s))!;c.currency.gold = 10000;c = await applyWizardAction(c,{ kind: "copy",key,source: "external" },{ operationId: "wizard_00000000000000000000000000000001",expectedRevision: c.revision,updatedAt: at });const choice = completeWizardChoice(c);choice.wizard.mastery[0] = key;c = await advanceGuidedCharacter(c,choice,at);const original = JSON.stringify(c),result = (await projectCharacterProgression(c))!;expect(result.levels[16]!.studies[0]!.value).toBe(PHB_SPELLS[key]!.name);expect(result.levels[17]!.decisions.find((d) => d.label === "Maestría de conjuros")!.value).toContain(PHB_SPELLS[key]!.name);expect(result.levels[17]!.spells.some((s) => s.name === PHB_SPELLS[key]!.name)).toBe(false);expect(JSON.stringify(c)).toBe(original);
  });
  it("ignora PG actuales, preparación y recursos de juego, y explica diferencias manuales",async () => {
    const c = await druidAt(5),expected = await projectCharacterProgression(c);c.combat.hitPoints.current = 0;for (const s of c.spellcasting.spells) s.prepared = false;for (const s of Object.values(c.spellcasting.slots)) s.used = s.maximum;expect(await projectCharacterProgression(c)).toEqual(expected);
    c.combat.hitPoints.maximum++;const result = (await projectCharacterProgression(c))!;expect(result.notices[0]).toContain("distintos");expect(result.levels.at(-1)!.hpMaximum).toBe(c.combat.hitPoints.maximum-1);
  });
  it("abre creación a nivel alto y devuelve vacío para fichas sin historial",async () => {
    const c = await rangerAt(20);c.builder!.creation.startingLevel = 20;expect((await projectCharacterProgression(c))!.initialLevel).toBe(20);expect(await projectCharacterProgression(createCharacter(id,"Manual",at))).toBeNull();
  });
  it("conserva elecciones independientes y cambios de entorno, círculo y pericias",async () => {
    const barbarian = await barbarianAt(6,"totem-warrior",{ totem: "eagle" });const choices = progressionChoices(barbarian.builder!,barbarian.builder!.levels.at(-1)!);expect(choices.decisions).toContainEqual({ label: "Tótem de nivel 6",value: "Águila" });
    const storm = await barbarianAt(3,"storm-herald",{ storm: "sea" }),next = barbarianChoice(storm,"storm-herald",{ storm: "tundra" });const changed = await advanceGuidedCharacter(storm,next,at);expect(progressionChoices(changed.builder!,next).replacements).toContainEqual({ label: "Entorno de tormenta",before: "Mar",after: "Tundra" });
    expect((await projectCharacterProgression(await rogueAt(6)))!.levels[5]!.decisions.some((d) => d.label === "Pericias elegidas")).toBe(true);
  });
});
