import { describe,it,expect } from "vitest";
import { bardAt,bardChoice,bardCreation,bardId,bardOp,bardAtTime as at } from "../fixtures/bard-builder";
import { advanceGuidedBard,createGuidedBard } from "../../src/domain/character/bard-builder";
import { FeatChoiceSchema } from "../../src/domain/character/character-builder-model";
import { performBardAction } from "../../src/domain/character/bard-play";
import { castCharacterSpell,removeCharacterSpell,setCharacterSpellPrepared,upsertCharacterSpell } from "../../src/domain/character/character-spells";
import { applyCharacterResourceCommand } from "../../src/domain/character/character-resources";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
import type { BardAction } from "../../src/domain/character/bard-model";
import { spellRitualAvailable } from "../../src/ui/wizard-play-panel";
const pool = (c: CharacterV2) => c.traits.flatMap((g) => g.traits).find((t) => t.id === c.spellcasting.bard!.inspirationId)!;
const spend = async (c: CharacterV2,use: Extract<BardAction,{ kind: "inspiration" }>["use"] = "inspire",n = c.revision) => performBardAction(c,`bard_${(100+n).toString(16).padStart(32,"0")}`,{ kind: "inspiration",use,requirementsConfirmed: true },{ expectedRevision: c.revision,updatedAt: at });
describe("Recursos y magia de Bardo",() => {
  it("Iniciado en Magia de Bardo conserva su uso gratuito y permite espacios, sin ocupar cupo de clase",async () => {
    const creation = bardCreation("human-variant");creation.initialFeat = FeatChoiceSchema.parse({ key: "magic-initiate",spellClass: "bard",spells: ["light","message","identify"] });
    const c = await createGuidedBard(bardId,bardOp,creation,at),innate = c.spellcasting.spells.find((s) => s.casting?.key === "identify" && s.casting.kind === "innate")!,slots = c.spellcasting.spells.find((s) => s.casting?.key === "identify" && s.casting.source === "builder:bard")!;
    const free = castCharacterSpell(c,innate.id,1,{ expectedRevision: c.revision,updatedAt: at });expect(free.spellcasting.slots["1"]!.used).toBe(0);
    expect(castCharacterSpell(free,slots.id,1,{ expectedRevision: free.revision,updatedAt: at }).spellcasting.slots["1"]!.used).toBe(1);expect(spellRitualAvailable(c,slots)).toBe(true);expect(c.builder!.creation.bard.learn).toHaveLength(4);
  });
  it("comparte la reserva con Palabras Hirientes y Habilidad Incomparable; resetea según Fuente",async () => {
    let c = await bardAt(14);c = await spend(c,"cutting-words");c = await spend(c,"peerless");expect(pool(c).uses.used).toBe(2);c = await spend(c);await expect(spend(c)).rejects.toThrow(/No quedan/);
    c = applyCharacterResourceCommand(c,{ kind: "short-rest" },{ expectedRevision: c.revision,updatedAt: at }).character;expect(pool(c).uses.used).toBe(0);
    c = await spend(await bardAt(4));expect(pool(applyCharacterResourceCommand(c,{ kind: "short-rest" },{ expectedRevision: c.revision,updatedAt: at }).character).uses.used).toBe(1);
    const five = await advanceGuidedBard(c,bardChoice(c),at);expect(pool(five).uses.used).toBe(1);expect(pool(applyCharacterResourceCommand(five,{ kind: "short-rest" },{ expectedRevision: five.revision,updatedAt: at }).character).uses.used).toBe(0);
    expect(pool(applyCharacterResourceCommand(c,{ kind: "long-rest" },{ expectedRevision: c.revision,updatedAt: at }).character).uses.used).toBe(0);
  });
  it("permite Ademán del Maestro sin inspiración pero valida colegio, nivel y estado",async () => {
    let c = await bardAt(14,"swords");c = await spend(c,"flourish");c = await spend(c,"flourish");expect(pool(c).uses.used).toBe(2);const next = await spend(c,"master-flourish");expect(pool(next).uses.used).toBe(2);
    await expect(spend(await bardAt(13,"swords"),"master-flourish")).rejects.toThrow(/rasgo/);
    await expect(spend(await bardAt(14,"lore"),"flourish")).rejects.toThrow(/rasgo/);
    c.combat.hitPoints.current = 0;await expect(spend(c,"master-flourish")).rejects.toThrow(/actuar/);
  });
  it("Manto de Inspiración y Cuchillas gastan un uso; Inspiración Superior recupera solo uno",async () => {
    for (const [college,use] of [["glamour","mantle-inspiration"],["whispers","psychic-blades"]] as const) expect(pool(await spend(await bardAt(3,college),use)).uses.used).toBe(1);
    const c = await bardAt(20);pool(c).uses.used = pool(c).uses.maximum;const next = await performBardAction(c,"bard_00000000000000000000000000000001",{ kind: "superior",rolledInitiative: true },{ expectedRevision: c.revision,updatedAt: at });expect(pool(next).uses.maximum-pool(next).uses.used).toBe(1);
    await expect(performBardAction(next,"bard_00000000000000000000000000000002",{ kind: "superior",rolledInitiative: true },{ expectedRevision: next.revision,updatedAt: at })).rejects.toThrow(/no tener usos/);
  });
  it("lanza conocidos y rituales con Carisma, gasta espacios solo en lanzamiento ordinario",async () => {
    const c = await bardAt(5),detect = c.spellcasting.spells.find((s) => s.casting?.key === "detect-magic")!;expect(detect.casting!.ability).toBe("charisma");expect(spellRitualAvailable(c,detect)).toBe(true);
    const ritual = castCharacterSpell(c,detect.id,1,{ expectedRevision: c.revision,updatedAt: at,mode: "ritual" });expect(ritual.spellcasting.slots["1"]!.used).toBe(0);
    const cast = castCharacterSpell(c,detect.id,3,{ expectedRevision: c.revision,updatedAt: at,mode: "slot" });expect(cast.spellcasting.slots["3"]!.used).toBe(1);
    expect(() => castCharacterSpell(c,detect.id,2,{ expectedRevision: c.revision,updatedAt: at,mode: "ritual" })).toThrow(/nivel base/);
    const heal = c.spellcasting.spells.find((s) => s.casting?.key === "healing-word")!;expect(() => castCharacterSpell(c,heal.id,1,{ expectedRevision: c.revision,updatedAt: at,mode: "ritual" })).toThrow(/ritual/);
    expect(() => castCharacterSpell(c,detect.id,1,{ expectedRevision: c.revision,updatedAt: at,mode: "mastery" })).toThrow(/Mago/);
    expect(() => removeCharacterSpell(c,detect.id,{ expectedRevision: c.revision,updatedAt: at })).toThrow(/Bardo/);
    expect(() => setCharacterSpellPrepared(c,detect.id,false,{ expectedRevision: c.revision,updatedAt: at })).toThrow();
    expect(() => upsertCharacterSpell(c,{ ...detect,name: "Otro" },{ expectedRevision: c.revision,updatedAt: at })).toThrow(/Bardo/);
  });
  it("los secretos de otras listas son conjuros de Bardo conocidos y rituales si corresponde",async () => {
    const before = await bardAt(5),step = bardChoice(before);step.bard.secrets = ["find-familiar","fireball"];const c = await advanceGuidedBard(before,step,at);
    const familiar = c.spellcasting.spells.find((s) => s.casting?.key === "find-familiar")!,fireball = c.spellcasting.spells.find((s) => s.casting?.key === "fireball")!;
    expect(spellRitualAvailable(c,familiar)).toBe(true);expect(castCharacterSpell(c,familiar.id,1,{ expectedRevision: c.revision,updatedAt: at,mode: "ritual" }).spellcasting.slots["1"]!.used).toBe(0);
    expect(castCharacterSpell(c,fireball.id,3,{ expectedRevision: c.revision,updatedAt: at }).spellcasting.slots["3"]!.used).toBe(1);
    expect(fireball.casting!.ability).toBe("charisma");
  });
});
