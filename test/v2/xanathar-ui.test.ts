// @vitest-environment happy-dom
import { beforeEach,afterEach,describe,it,expect,vi } from "vitest";
import { openCharacterBuilder } from "../../src/ui/character-builder";
import { createGuidedFighter,advanceGuidedFighter } from "../../src/domain/character/fighter-builder";
import { phbFighterCreation,completeFighterChoice } from "../fixtures/phb-fighter-builder";
import { createGuidedCleric,advanceGuidedCleric } from "../../src/domain/character/cleric-builder";
import { clericCreation,clericChoice } from "../fixtures/cleric-builder";
import { editCharacterCore } from "../../src/domain/character/edit-character";
const id="chr_00000000000000000000000000000001",op="build_00000000000000000000000000000001",at="2026-10-14T00:00:00Z";
const diceRoller={ roll:vi.fn(async () => ({ kind:"submitted" as const,summary:"test",totals:[] })) };
const field=(name:string) => document.querySelector<HTMLInputElement|HTMLSelectElement>(`dialog [name="${name}"]`)!;
async function set(name:string,value:string) { const old=field(name);old.value=value;old.dispatchEvent(new Event("change",{ bubbles:true }));if(old instanceof HTMLSelectElement) await vi.waitFor(() => expect(field(name)!==old).toBe(true)); }
const submit=() => document.querySelector("dialog form")!.dispatchEvent(new Event("submit",{ bubbles:true,cancelable:true }));
beforeEach(() => { document.body.innerHTML="";localStorage.clear();HTMLDialogElement.prototype.showModal=function() { this.open=true; };HTMLDialogElement.prototype.close=function() { this.open=false;this.dispatchEvent(new Event("close")); }; });
afterEach(() => { document.querySelector<HTMLButtonElement>("[data-builder-discard]")?.click();document.body.innerHTML=""; });
describe("Xanathar tutorial controls",() => {
  it.each(["arcane-archer","cavalier","samurai"] as const)("chooses %s and all its required training",async (subclass) => {
    let character=await createGuidedFighter(id,op,phbFighterCreation(),at);character=await advanceGuidedFighter(character,completeFighterChoice(character),at);
    const old=character,choice=completeFighterChoice(character,subclass);
    await openCharacterBuilder({ campaignId:subclass,character,diceRoller,onCreate:vi.fn(),onAdvance:async (step) => { character=await advanceGuidedFighter(character,step,at); } });
    await set("subclass",subclass);await set("xgeSkill",choice.xanathar.skill);
    if(subclass === "arcane-archer") { await set("xgeCantrip",choice.xanathar.cantrip);await set("arcaneShot0",choice.xanathar.shots[0]!);await set("arcaneShot1",choice.xanathar.shots[1]!);expect(field("arcaneShot1").querySelector(`option[value="${choice.xanathar.shots[0]}"]`)).toBeNull(); }
    submit();await vi.waitFor(() => expect(document.querySelector('dialog [aria-current="step"]')!.textContent).toContain("Revisar"));submit();await vi.waitFor(() => expect(character.identity.level).toBe(3));expect(character.revision).toBe(old.revision+1);
  });
  it("learns a cleric's fourth cantrip, keeps d8 editing valid and preserves spent slots",async () => {
    let character=await createGuidedCleric(id,op,clericCreation("life"),at);while(character.identity.level<3) character=await advanceGuidedCleric(character,clericChoice(character),at);
    character.spellcasting.slots["1"]!.used=1;
    expect(editCharacterCore(character,{ combat:{ hitDice:{ dieSize:8 } } },{ expectedRevision:character.revision,updatedAt:at }).combat.hitDice.dieSize).toBe(8);
    expect(() => editCharacterCore(character,{ combat:{ hitDice:{ dieSize:10 } } },{ expectedRevision:character.revision,updatedAt:at })).toThrow(/tutorial/);
    await openCharacterBuilder({ campaignId:"cleric-level4",character,diceRoller,onCreate:vi.fn(),onAdvance:async (step) => { character=await advanceGuidedCleric(character,step,at); } });
    await set("clericCantrip0","light");submit();await vi.waitFor(() => expect(document.querySelector('dialog [aria-current="step"]')!.textContent).toContain("Revisar"));submit();await vi.waitFor(() => expect(character.identity.level).toBe(4));expect(character.spellcasting.spells.some((s) => s.casting?.key === "light")).toBe(true);expect(character.spellcasting.slots["1"]!.used).toBe(1);
  });
});
