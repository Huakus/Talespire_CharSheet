import { describe,it,expect } from "vitest";
import { rangerAt,rangerChoice,rangerTime as at } from "../fixtures/ranger-builder";
import { performRangerAction,rangerTerrainCheck } from "../../src/domain/character/ranger-play";
import { advanceGuidedRanger,replayRangerChoices,rangerCompanionStats } from "../../src/domain/character/ranger-builder";
import { RANGER_COMPANIONS } from "../../src/domain/character/ranger-catalog";
import { castCharacterSpell,removeCharacterSpell,setCharacterSpellPrepared,upsertCharacterSpell } from "../../src/domain/character/character-spells";
import { applyCharacterResourceCommand } from "../../src/domain/character/character-resources";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
import type { RangerAction } from "../../src/domain/character/ranger-model";
import { spellRitualAvailable } from "../../src/ui/wizard-play-panel";
const feature = (c: CharacterV2,key: string) => c.traits.flatMap((g) => g.traits).find((t) => t.id === c.spellcasting.ranger!.resourceIds[key])!;
const act = (c: CharacterV2,action: RangerAction,n = c.revision) => performRangerAction(c,`ranger_${(100+n).toString(16).padStart(32,"0")}`,action,{ expectedRevision: c.revision,updatedAt: at });
const rest = (c: CharacterV2,kind: "short-rest"|"long-rest") => applyCharacterResourceCommand(c,{ kind },{ expectedRevision: c.revision,updatedAt: at }).character;
describe("Recursos y juego de Explorador",() => {
  it("gasta espacios para conocidos, protege la lista y no concede rituales",async () => {
    const c = await rangerAt(5),s = c.spellcasting.spells.find((s) => s.casting?.source === "builder:ranger")!;
    expect(castCharacterSpell(c,s.id,s.level,{ expectedRevision: c.revision,updatedAt: at }).spellcasting.slots[String(s.level)]!.used).toBe(1);
    expect(spellRitualAvailable(c,s)).toBe(false);expect(() => castCharacterSpell(c,s.id,s.level,{ expectedRevision: c.revision,updatedAt: at,mode: "ritual" })).toThrow(/ritual/);
    expect(() => setCharacterSpellPrepared(c,s.id,false,{ expectedRevision: c.revision,updatedAt: at })).toThrow(/sin preparación/);
    expect(() => removeCharacterSpell(c,s.id,{ expectedRevision: c.revision,updatedAt: at })).toThrow(/tutorial/);
    expect(() => upsertCharacterSpell(c,{ ...s,name: "Otro" },{ expectedRevision: c.revision,updatedAt: at })).toThrow(/tutorial/);
    const armor = structuredClone(c);armor.proficiencies.armor = [];expect(() => castCharacterSpell(armor,s.id,s.level,{ expectedRevision: c.revision,updatedAt: at })).toThrow(/armadura/);
  });
  it("Conciencia Primitiva consume el espacio elegido sin concentración ni recuperación corta",async () => {
    let c = await rangerAt(5);c.combat.conditions = [{ id: "cnd_00000000000000000000000000000001",key: "concentration",label: "Concentración",level: null,addedAt: at }];c = await act(c,{ kind: "primeval-awareness",slot: 2 });expect(c.spellcasting.slots["2"]!.used).toBe(1);expect(c.combat.conditions).toHaveLength(1);expect(rest(c,"short-rest").spellcasting.slots["2"]!.used).toBe(1);expect(rest(c,"long-rest").spellcasting.slots["2"]!.used).toBe(0);
    await expect(act(await rangerAt(2),{ kind: "primeval-awareness",slot: 1 })).rejects.toThrow(/Explorador 3/);
    c.spellcasting.slots["2"]!.used = 2;await expect(act(c,{ kind: "primeval-awareness",slot: 2 })).rejects.toThrow(/No quedan/);
  });
  it("Detectar Portal y Paso Etéreo comparten recuperación corta, con usos separados y sin espacios",async () => {
    let c = await rangerAt(7,"horizon-walker");c = await act(c,{ kind: "feature",key: "detect-portal",requirementsConfirmed: true });expect(feature(c,"detect-portal").uses.used).toBe(1);await expect(act(c,{ kind: "feature",key: "detect-portal",requirementsConfirmed: true })).rejects.toThrow(/No quedan/);
    for (const s of Object.values(c.spellcasting.slots)) s.used = s.maximum;
    const ethereal = c.spellcasting.spells.find((s) => s.casting?.source === "builder:ranger-ethereal")!;const slots = structuredClone(c.spellcasting.slots);c = castCharacterSpell(c,ethereal.id,7,{ expectedRevision: c.revision,updatedAt: at });expect(c.spellcasting.slots).toEqual(slots);expect(feature(c,"ethereal-step").uses.used).toBe(1);expect(ethereal.definition!.castingTime).toContain("adicional");expect(() => castCharacterSpell(c,ethereal.id,7,{ expectedRevision: c.revision,updatedAt: at })).toThrow(/No quedan/);
    c = rest(c,"short-rest");expect(feature(c,"ethereal-step").uses.used).toBe(0);expect(feature(c,"detect-portal").uses.used).toBe(0);expect(c.spellcasting.slots).toEqual(slots);
  });
  it("aplica la lista correcta del Asesino y distingue recuperación larga de Némesis",async () => {
    let c = await rangerAt(17,"monster-slayer");expect(replayRangerChoices(c.builder!).spells.filter((s) => s.bonus).map((s) => s.key)).toEqual(["protection-from-evil-and-good","zone-of-truth","magic-circle","banishment","hold-monster"]);
    c = await act(c,{ kind: "feature",key: "hunters-sense",requirementsConfirmed: true });c = await act(c,{ kind: "feature",key: "magic-nemesis",requirementsConfirmed: true });const short = rest(c,"short-rest");expect(feature(short,"hunters-sense").uses.used).toBe(1);expect(feature(short,"magic-nemesis").uses.used).toBe(0);expect(feature(rest(c,"long-rest"),"hunters-sense").uses.used).toBe(0);
    await expect(act(await rangerAt(10,"monster-slayer"),{ kind: "feature",key: "magic-nemesis",requirementsConfirmed: true })).rejects.toThrow(/nivel/);
    const zero = structuredClone(c);zero.combat.hitPoints.current = 0;await expect(act(zero,{ kind: "feature",key: "hunters-sense",requirementsConfirmed: true })).rejects.toThrow(/actuar/);
  });
  it("duplica competencia INT/SAB solo en contexto, no apila pericia y aplica ventaja al rastreo",async () => {
    const c = await rangerAt(5);c.checks.skills.survival.proficiency = 1;expect(rangerTerrainCheck(c,"survival",true).modifier-rangerTerrainCheck(c,"survival",false).modifier).toBe(3);
    c.checks.skills.survival.proficiency = 2;expect(rangerTerrainCheck(c,"survival",true).modifier).toBe(rangerTerrainCheck(c,"survival",false).modifier);
    expect(rangerTerrainCheck(c,"survival",false,true).mode).toBe("advantage");expect(rangerTerrainCheck(c,"nature",false,true).mode).toBe("advantage");expect(rangerTerrainCheck(c,"perception",false,true).mode).toBe("normal");
    c.checks.skills.survival.rollMode = "disadvantage";expect(rangerTerrainCheck(c,"survival",false,true).mode).toBe("normal");expect(rangerTerrainCheck(c,"athletics",true).modifier).toBe(rangerTerrainCheck(c,"athletics",false).modifier);
  });
  it("separa PG y dados del compañero, conserva heridas al ascender y recupera solo sus dados base",async () => {
    let c = await rangerAt(3,"beast-master");expect(c.spellcasting.ranger!.companionHp).toBe(12);expect(c.spellcasting.ranger!.companionDiceRemaining).toBe(2);
    const ownHp = c.combat.hitPoints.current;c = await act(c,{ kind: "companion-damage",amount: 9 });expect(c.spellcasting.ranger!.companionHp).toBe(3);expect(c.combat.hitPoints.current).toBe(ownHp);
    c = await act(c,{ kind: "companion-hit-dice",dice: 1,healing: 4,duringShortRest: true });expect(c.spellcasting.ranger!.companionHp).toBe(7);expect(c.spellcasting.ranger!.companionDiceRemaining).toBe(1);expect(c.combat.hitDice.remaining).toBe(3);
    c = await advanceGuidedRanger(c,rangerChoice(c,"beast-master"),at);expect(c.spellcasting.ranger!.companionHp).toBe(7);expect(rangerCompanionStats(c)!.maximumHp).toBe(16);expect(c.spellcasting.ranger!.companionDiceRemaining).toBe(1);expect(rest(c,"short-rest").spellcasting.ranger!.companionHp).toBe(7);
    c = rest(c,"long-rest");expect(c.spellcasting.ranger!.companionHp).toBe(16);expect(c.spellcasting.ranger!.companionDiceRemaining).toBe(2);await expect(act(c,{ kind: "companion-hit-dice",dice: 3,healing: 10,duringShortRest: true })).rejects.toThrow(/disponibles/);
  });
  it("no revive bestias al descansar; exige vínculo, ocho horas y una bestia legal para reemplazarlas",async () => {
    let c = await rangerAt(7,"beast-master");const bond = { kind: "bond-companion" as const,companion: RANGER_COMPANIONS.hawk!,previousDead: true as const,nonHostile: true as const,hours: 8 };
    await expect(act(c,bond)).rejects.toThrow(/muerto/);c = await act(c,{ kind: "companion-damage",amount: 100 });expect(rest(c,"long-rest").spellcasting.ranger!.companionHp).toBe(0);await expect(act(c,{ ...bond,hours: 7 })).rejects.toThrow();await expect(act(c,{ ...bond,companion: { ...bond.companion,challenge: 1 } })).rejects.toThrow();
    const healed = await act(c,{ kind: "companion-heal",amount: 4,aliveConfirmed: true });expect(healed.spellcasting.ranger!.companionHp).toBe(4);
    c = await act(c,bond);expect(c.spellcasting.ranger!.companion!.species).toBe("Halcón");expect(c.spellcasting.ranger!.companionHp).toBe(28);expect(c.spellcasting.ranger!.companionDiceRemaining).toBe(1);expect(rangerCompanionStats(c)!.magical).toBe(true);
    c = await act(c,{ kind: "companion-heal",amount: 100,aliveConfirmed: true });expect(c.spellcasting.ranger!.companionHp).toBe(28);
  });
  it("conserva origen adicional al sustituir un conjuro de magia del arquetipo",async () => {
    const c = await rangerAt(3,"monster-slayer"),choice = rangerChoice(c,"monster-slayer");choice.ranger.replaceSpell = { oldKey: "protection-from-evil-and-good",newKey: "hunters-mark" };const next = await advanceGuidedRanger(c,choice,at);expect(replayRangerChoices(next.builder!).spells.find((s) => s.key === "hunters-mark")!.bonus).toBe(true);expect(replayRangerChoices(next.builder!).spells.filter((s) => !s.bonus)).toHaveLength(3);
  });
});
