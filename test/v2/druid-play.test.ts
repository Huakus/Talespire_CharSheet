import { describe,it,expect } from "vitest";
import { druidAt,druidChoice,druidAtTime as at } from "../fixtures/druid-builder";
import { performDruidAction,druidCastUnavailable } from "../../src/domain/character/druid-play";
import { advanceGuidedDruid } from "../../src/domain/character/druid-builder";
import { druidCircleSpells } from "../../src/domain/character/druid-catalog";
import { castCharacterSpell,removeCharacterSpell,setCharacterSpellPrepared,upsertCharacterSpell } from "../../src/domain/character/character-spells";
import { applyCharacterResourceCommand } from "../../src/domain/character/character-resources";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
import type { DruidAction } from "../../src/domain/character/druid-model";
import { spellRitualAvailable,spellReady } from "../../src/ui/wizard-play-panel";
const feature = (c: CharacterV2,key: string) => c.traits.flatMap((g) => g.traits).find((t) => t.id === c.spellcasting.druid!.resourceIds[key])!;
const act = (c: CharacterV2,action: DruidAction,n = c.revision) => performDruidAction(c,`druid_${(100+n).toString(16).padStart(32,"0")}`,action,{ expectedRevision: c.revision,updatedAt: at });
export const wolfShape = { kind: "wild-shape" as const,name: "Lobo",formKind: "beast" as const,challenge: 0.25,swim: false,fly: false,maximumHp: 11,seenBefore: true as const };
describe("Recursos de Druida y Forma Salvaje",() => {
  it("consume dos usos compartidos, limita nado/vuelo/VD y recupera con ambos descansos",async () => {
    let c = await druidAt(2,"moon");await expect(act(c,{ ...wolfShape,challenge: 1,swim: true })).rejects.toThrow(/nado/);await expect(act(c,{ ...wolfShape,challenge: 2 })).rejects.toThrow(/VD/);
    c = await act(c,{ ...wolfShape,challenge: 1 });c = await act(c,wolfShape);expect(feature(c,"wild-shape").uses.used).toBe(2);await expect(act(c,wolfShape)).rejects.toThrow(/No quedan/);
    for (const kind of ["short-rest","long-rest"] as const) { const rest = applyCharacterResourceCommand(c,{ kind },{ expectedRevision: c.revision,updatedAt: at }).character;expect(feature(rest,"wild-shape").uses.used).toBe(0); }
    for (const level of [4,8]) { const d = await druidAt(level,"moon");await expect(act(d,{ ...wolfShape,swim: true,fly: level === 8 })).resolves.toBeDefined(); }
    await expect(act(await druidAt(1),wolfShape)).rejects.toThrow(/Druida 2/);
  });
  it("permite exactamente cuatro elementales con dos usos desde Luna 10, e ilimitados desde 20",async () => {
    const c = await druidAt(10,"moon");for (const formKind of ["air","earth","fire","water"] as const) { const form = await act(c,{ ...wolfShape,formKind,challenge: 5 });expect(form.spellcasting.druid!.form!.kind).toBe(formKind);expect(feature(form,"wild-shape").uses.used).toBe(2); }
    const used = await act(c,wolfShape);await expect(act(used,{ ...wolfShape,formKind: "fire",challenge: 5 })).rejects.toThrow(/No quedan/);
    await expect(act(await druidAt(9,"moon"),{ ...wolfShape,formKind: "fire",challenge: 5 })).rejects.toThrow(/Luna 10/);
    let top = await druidAt(20,"moon");for (let i=0;i<5;i++) top = await act(top,{ ...wolfShape,formKind: "water",challenge: 5 });expect(feature(top,"wild-shape").uses.used).toBe(0);
  });
  it("separa PG de forma, absorbe temporales, transfiere exceso y mantiene concentración al transformar",async () => {
    let c = await druidAt(4,"moon");c.combat.hitPoints.current = 8;c.combat.hitPoints.temporary = 2;c.combat.conditions = [{ id: "cnd_00000000000000000000000000000001",key: "concentration",label: "Concentración",level: null,addedAt: at }];c = await act(c,wolfShape);
    expect(c.combat.conditions).toHaveLength(1);expect(c.combat.hitPoints.current).toBe(8);
    const damage = applyCharacterResourceCommand(c,{ kind: "damage",amount: 7 },{ expectedRevision: c.revision,updatedAt: at });c = damage.character;expect(c.spellcasting.druid!.form!.currentHp).toBe(6);expect(c.combat.hitPoints.current).toBe(8);expect(damage.effects.concentrationCheckDc).toBe(10);
    c = applyCharacterResourceCommand(c,{ kind: "heal",amount: 2 },{ expectedRevision: c.revision,updatedAt: at }).character;expect(c.spellcasting.druid!.form!.currentHp).toBe(8);expect(c.combat.hitPoints.current).toBe(8);
    c = applyCharacterResourceCommand(c,{ kind: "damage",amount: 10 },{ expectedRevision: c.revision,updatedAt: at }).character;expect(c.spellcasting.druid!.form).toBeNull();expect(c.combat.hitPoints.current).toBe(6);expect(c.combat.conditions).toHaveLength(1);
  });
  it("termina por tiempo/inconsciencia y conserva heridas y tiempo al ascender",async () => {
    let c = await act(await druidAt(2),wolfShape);c = await act(c,{ kind: "elapsed-hours",hours: 0.5 });expect(c.spellcasting.druid!.form!.hoursRemaining).toBe(0.5);
    const next = await advanceGuidedDruid(c,druidChoice(c),at);expect(next.spellcasting.druid!.form!.hoursRemaining).toBe(0.5);
    expect((await act(next,{ kind: "elapsed-hours",hours: 0.5 })).spellcasting.druid!.form).toBeNull();
    const unconscious = applyCharacterResourceCommand(c,{ kind: "add-condition",conditionId: "cnd_00000000000000000000000000000002",key: "unconscious",label: "Inconsciente",level: null,addedAt: at },{ expectedRevision: c.revision,updatedAt: at }).character;expect(unconscious.spellcasting.druid!.form).toBeNull();
    expect(() => applyCharacterResourceCommand(c,{ kind: "spend-hit-dice",dice: 1,healing: 5 },{ expectedRevision: c.revision,updatedAt: at })).toThrow(/Dados de Golpe/);
  });
  it("cura Forma Salvaje de Luna con espacios y valida los d8",async () => {
    let c = await act(await druidAt(4,"moon"),wolfShape);c.spellcasting.druid!.form!.currentHp = 1;const next = await act(c,{ kind: "moon-heal",slot: 2,healing: 10 });expect(next.spellcasting.druid!.form!.currentHp).toBe(11);expect(next.spellcasting.slots["2"]!.used).toBe(1);expect(next.combat.hitPoints).toEqual(c.combat.hitPoints);
    await expect(act(c,{ kind: "moon-heal",slot: 1,healing: 9 })).rejects.toThrow(/1d8/);
  });
  it("recupera espacios de Tierra por suma de niveles, una vez por descanso largo",async () => {
    let c = await druidAt(9);c.spellcasting.slots["1"]!.used = 2;c.spellcasting.slots["3"]!.used = 1;c = await act(c,{ kind: "natural-recovery",slots: [1,1,3],afterShortRest: true });expect(c.spellcasting.slots["1"]!.used).toBe(0);expect(c.spellcasting.slots["3"]!.used).toBe(0);
    c.spellcasting.slots["1"]!.used = 1;await expect(act(c,{ kind: "natural-recovery",slots: [1],afterShortRest: true })).rejects.toThrow(/No quedan/);
    c = applyCharacterResourceCommand(c,{ kind: "short-rest" },{ expectedRevision: c.revision,updatedAt: at }).character;expect(feature(c,"natural-recovery").uses.used).toBe(1);
    c = applyCharacterResourceCommand(c,{ kind: "long-rest" },{ expectedRevision: c.revision,updatedAt: at }).character;expect(feature(c,"natural-recovery").uses.used).toBe(0);
    c.spellcasting.slots["1"]!.used = 1;await expect(act(c,{ kind: "natural-recovery",slots: [3,3],afterShortRest: true })).rejects.toThrow(/suma/);
  });
  it("registra reservas de Sueños, límites por uso, caminos y Caminante sin espacios",async () => {
    let c = await druidAt(14,"dreams");await expect(act(c,{ kind: "balm",dice: 8,requirementsConfirmed: true })).rejects.toThrow(/mitad/);c = await act(c,{ kind: "balm",dice: 7,requirementsConfirmed: true });expect(feature(c,"balm").uses.used).toBe(7);
    c = await act(c,{ kind: "hidden-path",target: "other",requirementsConfirmed: true });expect(feature(c,"hidden-paths").uses.used).toBe(1);
    const slots = structuredClone(c.spellcasting.slots);c = await act(c,{ kind: "dream-walker",spell: "dream",afterShortRest: true });expect(c.spellcasting.slots).toEqual(slots);expect(feature(c,"dream-walker").uses.used).toBe(1);
  });
  it("comparte el uso de tótem del Pastor y permite Invocaciones Leales incapacitado",async () => {
    let c = await druidAt(14,"shepherd");c = await act(c,{ kind: "spirit",spirit: "bear",requirementsConfirmed: true });await expect(act(c,{ kind: "spirit",spirit: "unicorn",requirementsConfirmed: true })).rejects.toThrow(/No quedan/);
    c.combat.hitPoints.current = 0;const summons = await act(c,{ kind: "faithful-summons",triggerConfirmed: true });expect(feature(summons,"faithful-summons").uses.used).toBe(1);
    const land = await druidAt(10);expect(() => applyCharacterResourceCommand(land,{ kind: "add-condition",conditionId: "cnd_00000000000000000000000000000002",key: "poisoned",label: "Envenenado",level: null,addedAt: at },{ expectedRevision: land.revision,updatedAt: at })).toThrow(/inmune/);
  });
  it("prepara lista y conjuros de círculo por separado, exige preparación para rituales y protege el catálogo",async () => {
    let c = await druidAt(3,"land","coast");const free = druidCircleSpells(c.builder!);c = await act(c,{ kind: "prepare",keys: ["detect-magic"],afterLongRest: true });expect(free.every((k) => c.spellcasting.spells.find((s) => s.casting?.key === k)!.prepared)).toBe(true);
    const detect = c.spellcasting.spells.find((s) => s.casting?.key === "detect-magic")!,bark = c.spellcasting.spells.find((s) => s.casting?.key === "barkskin")!;expect(spellRitualAvailable(c,detect)).toBe(true);expect(spellReady(bark,c)).toBe(false);
    expect(castCharacterSpell(c,detect.id,1,{ expectedRevision: c.revision,updatedAt: at,mode: "ritual" }).spellcasting.slots["1"]!.used).toBe(0);expect(() => castCharacterSpell(c,bark.id,2,{ expectedRevision: c.revision,updatedAt: at })).toThrow(/Prepará/);
    expect(() => setCharacterSpellPrepared(c,detect.id,false,{ expectedRevision: c.revision,updatedAt: at })).toThrow(/Druida/);expect(() => removeCharacterSpell(c,detect.id,{ expectedRevision: c.revision,updatedAt: at })).toThrow(/Druida/);expect(() => upsertCharacterSpell(c,{ ...detect,name: "Otro" },{ expectedRevision: c.revision,updatedAt: at })).toThrow(/Druida/);
  });
  it("Conjuros Bestiales y Archidruida distinguen conjuros de clase y materiales con coste/consumo",async () => {
    const seventeen = await act(await druidAt(17,"moon"),wolfShape),eighteen = await act(await druidAt(18,"moon"),wolfShape),twenty = await act(await druidAt(20,"moon"),wolfShape);
    for (const c of [seventeen,eighteen,twenty]) {
      const verbal = c.spellcasting.spells.find((s) => s.casting?.key === "healing-word")!,material = c.spellcasting.spells.find((s) => s.casting?.key === "goodberry")!,costly = c.spellcasting.spells.find((s) => s.casting?.key === "greater-restoration")!;
      expect(!!druidCastUnavailable(c,verbal)).toBe(c.identity.level < 18);expect(!!druidCastUnavailable(c,material)).toBe(c.identity.level < 20);expect(!!druidCastUnavailable(c,costly)).toBe(true);
    }
    const moon = await druidAt(14,"moon"),alter = moon.spellcasting.spells.find((s) => s.casting?.source === "builder:druid-moon")!;expect(castCharacterSpell(moon,alter.id,2,{ expectedRevision: moon.revision,updatedAt: at }).spellcasting.slots["2"]!.used).toBe(0);expect(() => castCharacterSpell(seventeen,seventeen.spellcasting.spells.find((s) => s.casting?.source === "builder:druid-moon")!.id,2,{ expectedRevision: seventeen.revision,updatedAt: at })).toThrow(/Forma Salvaje/);
  });
});
