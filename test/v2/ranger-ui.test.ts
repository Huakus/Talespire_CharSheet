// @vitest-environment happy-dom
import { beforeEach,afterEach,describe,it,expect,vi } from "vitest";
import { openCharacterBuilder } from "../../src/ui/character-builder";
import { BrowserApp } from "../../src/ui/browser-app";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { RANGER_ARCHETYPES } from "../../src/domain/character/ranger-catalog";
import type { RangerArchetype } from "../../src/domain/character/ranger-model";
import { rangerAt,rangerTime as time } from "../fixtures/ranger-builder";
import type { CampaignSnapshot } from "../../src/application/ports/campaign-repository";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
const diceRoller = { roll: vi.fn(async () => ({ kind: "rolled" as const,summary: "6",totals: [6] })) };
const field = (name: string) => document.querySelector<HTMLInputElement|HTMLSelectElement>(`dialog [name="${name}"]`)!;
async function set(name: string,value: string) { const old = field(name);old.value = value;old.dispatchEvent(new Event("change",{ bubbles: true }));if (old instanceof HTMLSelectElement) await vi.waitFor(() => expect(field(name) !== old).toBe(true)); }
const submit = () => document.querySelector("dialog form")!.dispatchEvent(new Event("submit",{ bubbles: true,cancelable: true }));
async function next(title: string) { submit();await vi.waitFor(() => expect(document.querySelector('dialog [aria-current="step"]')?.textContent).toContain(title)); }
async function available(name: string) { const select = field(name) as HTMLSelectElement;await set(name,[...select.options].find((o) => o.value && !o.disabled)!.value); }
async function mount(c: CharacterV2,tab = "summary") {
  const repo = new InMemoryCampaignRepository(),application = new CampaignApplication(repo);let snapshot = await application.createCampaign(time);snapshot.campaign.characters[c.id] = c;snapshot = await repo.save(snapshot.campaign,{ kind: "checksum",checksum: snapshot.checksum });
  const root = document.createElement("div");document.body.append(root);const app = new BrowserApp(root,application,{ storageLabel: "test",diceRoller });const view = app as unknown as { snapshot: CampaignSnapshot;selectedCharacterId: string;activeSheetTab: string;sheetMode: string;render(): void };Object.assign(view,{ snapshot,selectedCharacterId: c.id,activeSheetTab: tab,sheetMode: "play" });view.render();return { root,view,application };
}
beforeEach(() => { document.body.innerHTML = "";localStorage.clear();vi.clearAllMocks();HTMLDialogElement.prototype.showModal = function() { this.open = true; };HTMLDialogElement.prototype.close = function() { this.open = false;this.dispatchEvent(new Event("close")); }; });
afterEach(() => { document.querySelector<HTMLButtonElement>("[data-builder-discard]")?.click();document.body.innerHTML = ""; });
describe("Tutorial y ficha de Explorador",() => {
  it.each(Object.keys(RANGER_ARCHETYPES) as RangerArchetype[])("crea %s desde el tutorial real",async (archetype) => {
    const repo = new InMemoryCampaignRepository(),app = new CampaignApplication(repo);let snapshot = await app.createCampaign(time);
    await openCharacterBuilder({ campaignId: archetype,name: "Explorador",diceRoller,onAdvance: vi.fn(),onCreate: async (operationId,creation,initialLevels) => { snapshot = await app.createGuidedCharacter({ operationId,creation,initialLevels,expectedCampaignChecksum: snapshot.checksum }); } });
    await set("classKey","ranger");await set("startingLevel","3");await next("Atributos");await next("Formación");expect(document.querySelectorAll('dialog select[name^="skill"]').length).toBe(3);expect(field("rangerEnemyLanguage").querySelector<HTMLOptionElement>('[value="Común"]')!.disabled).toBe(true);expect(document.querySelector('[name="rangerLearn0"]')).toBeNull();await next("Equipo");await next("Nivel 2");await set("rangerStyle","archery");await available("rangerLearn0");const first = field("rangerLearn0").value;expect(field("rangerLearn1").querySelector(`[value="${first}"]`)).toBeNull();await available("rangerLearn1");await next("Nivel 3");await set("rangerArchetype",archetype);
    if (archetype === "hunter") await available("rangerHunter");if (archetype === "beast-master") await set("rangerCompanionPreset","wolf");await available("rangerLearn0");await next("Revisar");submit();await vi.waitFor(() => expect(Object.values(snapshot.campaign.characters)).toHaveLength(1));const c = Object.values(snapshot.campaign.characters)[0]!;expect(c.identity.subclass).toBe(RANGER_ARCHETYPES[archetype]);expect(c.combat.hitDice.dieSize).toBe(10);if (archetype === "beast-master") expect(c.spellcasting.ranger!.companion!.species).toBe("Lobo");
  });
  it("deshabilita terreno/enemigo previos y permite dos razas humanoides e idioma propio",async () => {
    const c = await rangerAt(5);await openCharacterBuilder({ campaignId: "six",character: c,diceRoller,onCreate: vi.fn(),onAdvance: vi.fn() });expect(field("rangerTerrain").querySelector<HTMLOptionElement>('[value="forest"]')!.disabled).toBe(true);expect(field("rangerEnemyType").querySelector<HTMLOptionElement>('[value="beasts"]')!.disabled).toBe(true);expect(field("rangerEnemyType").querySelector<HTMLOptionElement>('[value="beasts"]')!.textContent).toContain("Ya elegiste");await set("rangerEnemyType","humanoids");await set("rangerHumanoid0","Gnolls");await set("rangerHumanoid1","Sahuagin");await set("rangerEnemyLanguage","custom");expect(field("rangerCustomLanguage")).toBeTruthy();
  });
  it("ofrece todas las opciones de Cazador en 7, 11 y 15",async () => {
    for (const level of [6,10,14]) { const c = await rangerAt(level);await openCharacterBuilder({ campaignId: `hunter${level}`,character: c,diceRoller,onCreate: vi.fn(),onAdvance: vi.fn() });expect((field("rangerHunter") as HTMLSelectElement).options.length).toBe(level === 10 ? 3 : 4);document.querySelector<HTMLButtonElement>("[data-builder-discard]")!.click(); }
  });
  it("actualiza los PG del compañero desde la ficha sin alterar los PG del personaje",async () => {
    const c = await rangerAt(7,"beast-master"),{ root,view } = await mount(c);root.querySelector<HTMLInputElement>("[data-ranger-amount]")!.value = "100";root.querySelector<HTMLButtonElement>('[data-ranger-action="companion-damage"]')!.click();await vi.waitFor(() => expect(view.snapshot.campaign.characters[c.id]!.spellcasting.ranger!.companionHp).toBe(0));expect(view.snapshot.campaign.characters[c.id]!.combat.hitPoints).toEqual(c.combat.hitPoints);expect(root.querySelector("[data-ranger-alive]")).toBeTruthy();expect(root.querySelector<HTMLButtonElement>('[data-ranger-action="companion-hit-dice"]')!.disabled).toBe(true);
    const bond = root.querySelector<HTMLFormElement>("[data-ranger-bond]")!;bond.querySelector<HTMLInputElement>('[name="dead"]')!.checked = true;bond.querySelector<HTMLInputElement>('[name="nonHostile"]')!.checked = true;bond.querySelector<HTMLInputElement>('[name="replacementName"]')!.value = "Luna";bond.querySelector<HTMLButtonElement>('[data-ranger-action="bond-companion"]')!.click();await vi.waitFor(() => expect(view.snapshot.campaign.characters[c.id]!.spellcasting.ranger!.companion!.name).toBe("Luna"));expect(view.snapshot.campaign.characters[c.id]!.spellcasting.ranger!.companionHp).toBe(28);
  });
  it("lanza Paso Etéreo desde Conjuros con un uso y ningún espacio",async () => {
    const c = await rangerAt(7,"horizon-walker");for (const s of Object.values(c.spellcasting.slots)) s.used = s.maximum;const { root,view } = await mount(c,"spells"),s = c.spellcasting.spells.find((s) => s.casting?.source === "builder:ranger-ethereal")!,card = root.querySelector<HTMLElement>(`[data-spell-id="${s.id}"]`)!;expect(card.querySelector<HTMLSelectElement>("[data-cast-slot-level]")!.textContent).toContain("Innato");card.querySelector<HTMLButtonElement>('[data-spell-action="cast"]')!.click();await vi.waitFor(() => expect(view.snapshot.campaign.characters[c.id]!.revision).toBe(c.revision+1));expect(view.snapshot.campaign.characters[c.id]!.spellcasting.slots).toEqual(c.spellcasting.slots);
  });
  it("separa las tiradas del compañero de los efectos del dueño y actualiza la prueba contextual",async () => {
    const c = await rangerAt(5,"beast-master");c.checks.skills.survival.proficiency = 1;c.combat.conditions = [{ id: "cnd_00000000000000000000000000000001",key: "bless",label: "Bendición",level: null,addedAt: time }];const { root } = await mount(c);
    root.querySelector<HTMLButtonElement>('[data-roll-owner="companion"]')!.click();await vi.waitFor(() => expect(diceRoller.roll).toHaveBeenCalledWith(expect.objectContaining({ expressions: ["1d20+7"],mode: "normal" })));
    const skill = root.querySelector<HTMLSelectElement>("[data-ranger-skill]")!;skill.value = "survival";skill.dispatchEvent(new Event("change",{ bubbles: true }));for (const name of ["terrain","enemy"]) { const check = root.querySelector<HTMLInputElement>(`[data-ranger-${name}]`)!;check.checked = true;check.dispatchEvent(new Event("change",{ bubbles: true })); }
    const button = root.querySelector<HTMLButtonElement>("[data-ranger-check]")!,expression = button.dataset.rollExpression!;button.click();await vi.waitFor(() => expect(diceRoller.roll).toHaveBeenCalledWith(expect.objectContaining({ expressions: [expression+"+1d4"],mode: "advantage" })));
  });
});
