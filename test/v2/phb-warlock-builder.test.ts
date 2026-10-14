import { isXanatharFeat } from "../../src/domain/character/xanathar-feats";
import { describe,it,expect } from "vitest";
import { phbWarlockCreation,completeWarlockChoice } from "../fixtures/phb-warlock-builder";
import { createGuidedWarlock,advanceGuidedWarlock,replayWarlockChoices } from "../../src/domain/character/warlock-builder";
import { applyWarlockAction } from "../../src/domain/character/warlock-play";
import { castCharacterSpell } from "../../src/domain/character/character-spells";
import { applyCharacterResourceCommand } from "../../src/domain/character/character-resources";
import { classSpells,PHB_SPELLS,XANATHAR_SPELL_KEYS } from "../../src/domain/character/phb-spells";
import { INVOCATIONS,PATRON_SPELLS,pactSlots,WARLOCK_PATRONS } from "../../src/domain/character/warlock-catalog";
import { BUILDER_RACES,BACKGROUND_PRESETS } from "../../src/domain/character/fighter-builder-catalog";
import { projectSpellDamageExpression } from "../../src/domain/character/character-projection";
import type { WarlockPatron,PactBoon,WarlockAction } from "../../src/domain/character/warlock-model";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
import { FEATS } from "../../src/domain/character/phb-fighter-choices";
import { FeatChoiceSchema,type FeatChoice } from "../../src/domain/character/character-builder-model";
const id = "chr_11111111111111111111111111111111",operation = "build_11111111111111111111111111111111",time = "2026-10-14T00:00:00.000Z";
export async function warlockAt(level: number,patron: WarlockPatron = "fiend",boon: PactBoon = "tome") { let c = await createGuidedWarlock(id,operation,phbWarlockCreation(patron),time); while (c.identity.level < level) c = await advanceGuidedWarlock(c,completeWarlockChoice(c,boon),time); return c; }
const spell = (c: CharacterV2,key: string,source = "known") => c.spellcasting.spells.find((s) => s.casting?.key === key && s.casting.source === `builder:warlock:${source}`)!;
const cast = (c: CharacterV2,key: string,level = pactSlots(c.identity.level).level,source = "known") => castCharacterSpell(c,spell(c,key,source).id,level,{ expectedRevision: c.revision,updatedAt: time });
let sequence = 1000;
const act = (c: CharacterV2,action: WarlockAction) => applyWarlockAction(c,action,{ operationId: `warlock_${(++sequence).toString(16).padStart(32,"0")}`,expectedRevision: c.revision,updatedAt: time });
const rest = (c: CharacterV2,kind: "short-rest"|"long-rest") => applyCharacterResourceCommand(c,{ kind },{ expectedRevision: c.revision,updatedAt: time }).character;
describe("PHB warlock construction", () => {
  it("has the complete PHB spell list, all patron expansions and exactly 32 original invocations", () => {
    expect(Array.from({ length: 10 },(_,n) => classSpells("warlock",n).filter((k) => !XANATHAR_SPELL_KEYS.has(k)).length)).toEqual([9,11,12,12,4,4,8,4,5,5]);
    expect(Object.keys(INVOCATIONS)).toHaveLength(46);
    expect(Object.values(PHB_SPELLS).filter((s) => s.ritual)).toHaveLength(33);
    expect(Object.values(PHB_SPELLS).filter((s) => s.level === 0)).toHaveLength(39);
    for (const spells of Object.values(PATRON_SPELLS)) { expect(spells).toHaveLength(10); for (const key of spells) expect(PHB_SPELLS[key],key).toBeDefined(); }
  });
  it("uses the PHB pact slot table through level twenty", () => {
    expect(Array.from({ length: 20 },(_,n) => { const s = pactSlots(n+1); return [s.level,s.maximum]; })).toEqual([[1,1],[1,2],[2,2],[2,2],[3,2],[3,2],[4,2],[4,2],[5,2],[5,2],[5,3],[5,3],[5,3],[5,3],[5,3],[5,3],[5,4],[5,4],[5,4],[5,4]]);
  });
  it("creates all 270 race/background combinations with d8, WIS/CHA saves and no Fighter resources", async () => {
    for (const race of Object.keys(BUILDER_RACES) as Array<keyof typeof BUILDER_RACES>) for (const bg of Object.keys(BACKGROUND_PRESETS) as Array<keyof typeof BACKGROUND_PRESETS>) {
      const c = await createGuidedWarlock(id,operation,phbWarlockCreation("fiend",race,bg),time);
      expect(c.identity.className).toBe("Brujo"); expect(c.combat.hitDice.dieSize).toBe(8); expect(c.checks.savingThrows.charisma.proficiency).toBe(1); expect(c.checks.savingThrows.wisdom.proficiency).toBe(1); expect(c.proficiencies.armor).toContain("Armaduras ligeras");
      expect(c.traits.flatMap((g) => g.traits).some((t) => t.name === "Segundo aliento")).toBe(false);
      expect(c.inventory.filter((i) => i.name === "Daga").reduce((n,i) => n+i.quantity,0)).toBeGreaterThanOrEqual(2);
    }
  });
  it.each((Object.keys(WARLOCK_PATRONS) as WarlockPatron[]).flatMap((patron) => (["blade","chain","tome"] as PactBoon[]).map((boon) => ({ patron,boon }))))("advances $patron / $boon through every level", async ({ patron,boon }) => {
    let c = await warlockAt(2,patron,boon); c.combat.hitPoints.current = 2; c.spellcasting.slots["1"]!.used = 1;
    while (c.identity.level < 20) c = await advanceGuidedWarlock(c,completeWarlockChoice(c,boon),time);
    const replay = replayWarlockChoices(c.builder!);
    expect(replay.spells).toHaveLength(15); expect(replay.cantrips).toHaveLength(patron === "celestial" ? 6 : 4); expect(replay.invocations).toHaveLength(8); expect(replay.arcana).toHaveLength(4); expect(replay.boon).toBe(boon);
    expect(c.combat.hitPoints.current).toBe(2); expect(c.spellcasting.slots["5"]).toEqual({ maximum: 4,used: 1 }); expect(c.identity.subclass).toBe(WARLOCK_PATRONS[patron]);
    const names = c.traits.flatMap((g) => g.traits).map((t) => t.name);
    const expected = { celestial: ["Luz Sanadora","Alma Radiante","Resiliencia Celestial","Venganza Ardiente"],hexblade: ["Guerrero Maléfico","Espectro Maldito","Armadura de Maleficios","Maestro de Maleficios"],fiend: ["Bendición del Oscuro","Suerte del Oscuro","Resistencia infernal","Lanzar a través del infierno"],archfey: ["Presencia feérica","Escape brumoso","Defensas cautivadoras","Delirio oscuro"],"great-old-one": ["Mente despierta","Guardián entrópico","Escudo de pensamientos","Crear esclavo"] }[patron];
    expect(names).toEqual(expect.arrayContaining(expected));
    if (boon === "tome") expect(replay.tomeCantrips).toHaveLength(3);
    if (boon === "blade") { expect(c.spellcasting.warlock!.pactWeaponId).not.toBeNull(); expect(c.actions.find((a) => a.inventoryItemId === c.spellcasting.warlock!.pactWeaponId)!.proficient).toBe(true); }
  });
  it("does not learn patron expanded spells for free and rejects invocations without prerequisites", async () => {
    const c = await warlockAt(1); expect(c.spellcasting.spells.some((s) => s.name === "Manos ardientes")).toBe(false);
    for (const key of ["thirsting-blade","lifedrinker","book-of-ancient-secrets","chains-of-carceri"]) { const step = completeWarlockChoice(c); step.warlock.invocations = [key,"armor-of-shadows"]; await expect(advanceGuidedWarlock(c,step,time)).rejects.toThrow(); }
    const creation = phbWarlockCreation(); creation.warlock.cantrips = ["mage-hand","minor-illusion"];
    const noBlast = await createGuidedWarlock(id,operation,creation,time);
    await expect(advanceGuidedWarlock(noBlast,completeWarlockChoice(noBlast),time)).rejects.toThrow("requisitos");
  });
  it("supports one known-spell and one invocation substitution even on a level without new known spells", async () => {
    const c = await warlockAt(9),step = completeWarlockChoice(c); step.warlock.replaceSpell = { oldKey: "hex",newKey: "contact-other-plane" }; step.warlock.replaceInvocation = { oldKey: "agonizing-blast",newKey: "whispers-of-the-grave" };
    const next = await advanceGuidedWarlock(c,step,time),r = replayWarlockChoices(next.builder!);
    expect(r.spells).not.toContain("hex"); expect(r.spells).toContain("contact-other-plane"); expect(r.invocations).not.toContain("agonizing-blast"); expect(r.invocations).toContain("whispers-of-the-grave");
  });
  it.each(Object.keys(INVOCATIONS))("grants each PHB invocation with its actual prerequisites: %s", async (key) => {
    const definition = INVOCATIONS[key]!,boon = definition.boon ?? "blade",level = Math.max(definition.level,definition.boon ? 3 : 2);
    const c = await warlockAt(level-1,"fiend",boon),step = completeWarlockChoice(c,boon);
    if (step.warlock.invocations.length) step.warlock.invocations = [key,...step.warlock.invocations.filter((i) => i !== key)].slice(0,step.warlock.invocations.length);
    else step.warlock.replaceInvocation = { oldKey: "armor-of-shadows",newKey: key };
    if (key === "aspect-of-the-moon") step.warlock.rituals = [];
    if (key === "book-of-ancient-secrets") step.warlock.rituals = ["find-familiar","identify"];
    const next = await advanceGuidedWarlock(c,step,time);
    expect(next.traits.flatMap((g) => g.traits).some((t) => t.name === definition.name)).toBe(true);
    if (definition.spell) expect(spell(next,definition.spell,`invocation-${key}`).casting!.kind).toBe(definition.mode);
  });
  it.each(Object.keys(FEATS).filter((k) => !isXanatharFeat(k)) as Array<FeatChoice["key"]>)("accepts every PHB feat when its prerequisites are met: %s", async (key) => {
    const creation = phbWarlockCreation("fiend","mountain-dwarf"); creation.abilityMethod = "rolled"; creation.baseAbilities = { strength: 16,dexterity: 16,constitution: 16,intelligence: 16,wisdom: 16,charisma: 16 };
    let c = await createGuidedWarlock(id,operation,creation,time); while (c.identity.level < 3) c = await advanceGuidedWarlock(c,completeWarlockChoice(c),time);
    if (key === "heavy-armor-master") { const s = completeWarlockChoice(c); s.abilityIncrease = null; s.feat = FeatChoiceSchema.parse({ key: "heavily-armored",ability: "strength" }); c = await advanceGuidedWarlock(c,s,time); while (c.identity.level < 7) c = await advanceGuidedWarlock(c,completeWarlockChoice(c),time); }
    const feat = FeatChoiceSchema.parse({ key,ability: FEATS[key].abilities[0] ?? null });
    if (key === "skilled") feat.skills = ["acrobatics","animalHandling","athletics"];
    if (key === "linguist") feat.languages = ["Infernal","Abisal","Dracónico"];
    if (key === "elemental-adept") feat.damageType = "fire";
    if (key === "martial-adept") feat.maneuvers = ["parry","riposte"];
    if (key === "weapon-master") feat.weapons = ["club","dagger","longsword","longbow"];
    if (["magic-initiate","ritual-caster","spell-sniper"].includes(key)) feat.spellClass = "warlock";
    if (key === "magic-initiate") feat.spells = ["friends","chill-touch","hellish-rebuke"];
    if (key === "ritual-caster") feat.spells = ["comprehend-languages","unseen-servant"];
    if (key === "spell-sniper") feat.spells = ["chill-touch"];
    const step = completeWarlockChoice(c); step.abilityIncrease = null; step.feat = feat; c = await advanceGuidedWarlock(c,step,time);
    expect(c.traits.flatMap((g) => g.traits).some((t) => t.name === FEATS[key].name)).toBe(true);
  });
});
describe("warlock play resources", () => {
  it("removes invocation skill grants when replaced without removing permanent proficiency", async () => {
    let c = await warlockAt(1),step = completeWarlockChoice(c); step.warlock.invocations = ["beguiling-influence","armor-of-shadows"];
    c = await advanceGuidedWarlock(c,step,time); expect(c.checks.skills.persuasion.proficiency).toBe(1);
    step = completeWarlockChoice(c,"chain"); step.warlock.replaceInvocation = { oldKey: "beguiling-influence",newKey: "devils-sight" };
    c = await advanceGuidedWarlock(c,step,time); expect(c.checks.skills.persuasion.proficiency).toBe(0); expect(c.checks.skills.deception.proficiency).toBe(1);
  });
  it("separates Magic Initiate's daily cast from pact-slot casting for the warlock class", async () => {
    const creation = phbWarlockCreation("fiend","human-variant"); creation.initialFeat = FeatChoiceSchema.parse({ key: "magic-initiate",spellClass: "warlock",spells: ["friends","chill-touch","hellish-rebuke"] });
    let c = await createGuidedWarlock(id,operation,creation,time); const daily = c.spellcasting.spells.find((s) => s.casting?.kind === "innate" && s.casting.key === "hellish-rebuke")!;
    c = castCharacterSpell(c,daily.id,1,{ expectedRevision: c.revision,updatedAt: time }); expect(c.spellcasting.slots["1"]!.used).toBe(0);
    const ordinary = c.spellcasting.spells.find((s) => s.casting?.kind === "pact" && s.casting.key === "hellish-rebuke")!;
    c = castCharacterSpell(c,ordinary.id,1,{ expectedRevision: c.revision,updatedAt: time }); expect(c.spellcasting.slots["1"]!.used).toBe(1);
  });
  it("casts at the pact level, preserves expended slots when that level increases and restores them on short rests", async () => {
    let c = cast(await warlockAt(2),"hex",1);
    c = await advanceGuidedWarlock(c,completeWarlockChoice(c),time); expect(c.spellcasting.slots["2"]).toEqual({ maximum: 2,used: 1 });
    expect(() => cast(c,"hex",1)).toThrow("mismo nivel"); c = cast(c,"hex",2); expect(() => cast(c,"hex",2)).toThrow();
    c.spellcasting.slots["9"] = { maximum: 1,used: 1 };
    const rested = rest(c,"short-rest"); expect(rested.spellcasting.slots["2"]!.used).toBe(0); expect(rested.spellcasting.slots["9"]!.used).toBe(1);
  });
  it("requires both a pact slot and the separate long-rest use for limited invocations", async () => {
    const first = await warlockAt(1),step = completeWarlockChoice(first); step.warlock.invocations = ["thief-of-five-fates","armor-of-shadows"];
    let c = await advanceGuidedWarlock(first,step,time); c = cast(c,"bane",1,"invocation-thief-of-five-fates");
    expect(c.spellcasting.slots["1"]!.used).toBe(1);
    c = rest(c,"short-rest"); expect(() => cast(c,"bane",1,"invocation-thief-of-five-fates")).toThrow();
    c = rest(c,"long-rest"); c = cast(c,"bane",1,"invocation-thief-of-five-fates"); expect(c.spellcasting.slots["1"]!.used).toBe(1);
  });
  it("casts at-will invocations without slots, at base level, and rolls Eldritch Blast damage per beam", async () => {
    let c = await warlockAt(20,"fiend","blade"); c.spellcasting.slots["5"]!.used = 4;
    c = cast(c,"mage-armor",1,"invocation-armor-of-shadows"); expect(c.spellcasting.slots["5"]!.used).toBe(4);
    expect(() => cast(c,"mage-armor",5,"invocation-armor-of-shadows")).toThrow("nivel base");
    expect(projectSpellDamageExpression(c,spell(c,"eldritch-blast"))).toBe("1d10+5");
  });
  it("keeps Mystic Arcana and invocation uses spent when short-resting or using Eldritch Master", async () => {
    let c = await warlockAt(20); const arcane = replayWarlockChoices(c.builder!).arcana[0]!;
    c = cast(c,arcane,6,"arcanum"); c.spellcasting.slots["5"]!.used = 4; c = rest(c,"short-rest");
    expect(() => cast(c,arcane,6,"arcanum")).toThrow(); c.spellcasting.slots["5"]!.used = 4;
    c = await act(c,{ kind: "eldritch-master",minutes: 1 }); expect(c.spellcasting.slots["5"]!.used).toBe(0); expect(() => cast(c,arcane,6,"arcanum")).toThrow();
    await expect(act(c,{ kind: "eldritch-master",minutes: 1 })).rejects.toThrow();
    c = rest(c,"long-rest"); expect(cast(c,arcane,6,"arcanum").spellcasting.slots["5"]!.used).toBe(0);
  });
  it("restricts book cantrips and rituals when lost and copies rituals from any class with cost and level checks", async () => {
    let c = await warlockAt(3); c.currency.gold = 200;
    c = await act(c,{ kind: "copy-ritual",key: "augury",sourceAvailable: true }); expect(c.currency.gold).toBe(100); expect(c.spellcasting.warlock!.copiedRituals[0]).toMatchObject({ gold: 100,hours: 4 });
    c = await act(c,{ kind: "book-access",available: false });
    expect(() => cast(c,"guidance",0,"tome")).toThrow("Libro"); expect(() => cast(c,"augury",2,"ritual")).toThrow("Libro");
    c = await act(c,{ kind: "replace-book",hours: 1 }); c = cast(c,"augury",2,"ritual"); expect(c.spellcasting.slots["2"]!.used).toBe(0);
    await expect(act(c,{ kind: "copy-ritual",key: "commune",sourceAvailable: true })).rejects.toThrow("mitad");
  });
  it("grants Chain familiar ritual without granting ritual casting for every known spell", async () => {
    let c = await warlockAt(3,"great-old-one","chain"); const familiar = spell(c,"find-familiar");
    c = castCharacterSpell(c,familiar.id,1,{ expectedRevision: c.revision,updatedAt: time,mode: "ritual" }); expect(c.spellcasting.slots["2"]!.used).toBe(0);
    const creation = phbWarlockCreation(); creation.warlock.learn[0] = "comprehend-languages"; const noRitual = await createGuidedWarlock(id,operation,creation,time);
    expect(() => castCharacterSpell(noRitual,spell(noRitual,"comprehend-languages").id,1,{ expectedRevision: noRitual.revision,updatedAt: time,mode: "ritual" })).toThrow("ritual");
  });
  it("applies Fiend temporary HP without stacking and changes resistance only for the right patron/level", async () => {
    let c = await warlockAt(10); c = await act(c,{ kind: "dark-blessing",hostileReducedToZero: true }); expect(c.combat.hitPoints.temporary).toBe(15);
    c.combat.hitPoints.temporary = 50; c = await act(c,{ kind: "dark-blessing",hostileReducedToZero: true }); expect(c.combat.hitPoints.temporary).toBe(50);
    c = await act(c,{ kind: "resistance",damageType: "psychic",afterRest: true }); expect(c.spellcasting.warlock!.resistance).toBe("psychic");
    await expect(act(await warlockAt(10,"archfey"),{ kind: "resistance",damageType: "fire",afterRest: true })).rejects.toThrow();
  });
});
