// @vitest-environment happy-dom
import { beforeEach,afterEach,describe,it,expect,vi } from "vitest";
import { openCharacterBuilder } from "../../src/ui/character-builder";
import { BrowserApp } from "../../src/ui/browser-app";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { DRUID_CIRCLES,DRUID_LANDS } from "../../src/domain/character/druid-catalog";
import type { DruidCircle } from "../../src/domain/character/druid-model";
import { druidAt,druidAtTime as time } from "../fixtures/druid-builder";
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
describe("Tutorial y ficha de Druida",() => {
  it.each(Object.keys(DRUID_CIRCLES) as DruidCircle[])("crea %s desde el tutorial real",async (circle) => {
    const repo = new InMemoryCampaignRepository(),app = new CampaignApplication(repo);let snapshot = await app.createCampaign(time);
    await openCharacterBuilder({ campaignId: circle,name: "Druida",diceRoller,onAdvance: vi.fn(),onCreate: async (operationId,creation,initialLevels) => { snapshot = await app.createGuidedCharacter({ operationId,creation,initialLevels,expectedCampaignChecksum: snapshot.checksum }); } });
    await set("classKey","druid");await set("startingLevel","3");await next("Atributos");await next("Formación");expect(document.querySelectorAll('dialog select[name^="skill"]').length).toBe(2);
    await set("druidCantrip0","thorn-whip");expect(field("druidCantrip1").querySelector('[value="thorn-whip"]')).toBeNull();await available("druidCantrip1");await next("Equipo");await set("druidFocus","yew-wand");await next("Nivel 2");await set("druidCircle",circle);if (circle === "land") await available("druidBonusCantrip");await next("Nivel 3");if (circle === "land") { expect((field("druidLand") as HTMLSelectElement).options.length).toBe(9);await set("druidLand","coast"); }
    await next("Revisar");submit();await vi.waitFor(() => expect(Object.values(snapshot.campaign.characters)).toHaveLength(1));const c = Object.values(snapshot.campaign.characters)[0]!;expect(c.identity.subclass).toContain(DRUID_CIRCLES[circle]);if (circle === "land") expect(c.identity.subclass).toContain(DRUID_LANDS.coast);expect(c.combat.hitDice.dieSize).toBe(8);
  });
  it("ofrece dos dados de oro y evita repetir el truco adicional de Tierra",async () => {
    const c = await druidAt(1);await openCharacterBuilder({ campaignId: "bonus",character: c,diceRoller,onCreate: vi.fn(),onAdvance: vi.fn() });await set("druidCircle","land");expect(field("druidBonusCantrip").querySelector('[value="thorn-whip"]')).toBeNull();document.querySelector<HTMLButtonElement>("[data-builder-discard]")!.click();
    await openCharacterBuilder({ campaignId: "gold",name: "Druida",diceRoller,onCreate: vi.fn(),onAdvance: vi.fn() });await set("classKey","druid");await next("Atributos");await next("Formación");await available("druidCantrip0");await available("druidCantrip1");await next("Equipo");await set("equipmentMethod","gold");expect(document.querySelectorAll('dialog [name^="goldDie"]').length).toBe(2);
  });
  it("transforma desde el panel real, bloquea formas no disponibles y registra PG sin cambiar la base",async () => {
    const c = await druidAt(2,"moon"),{ root,view } = await mount(c),formField = <T extends HTMLInputElement|HTMLSelectElement>(name: string) => root.querySelector<T>(`[data-druid-field="${name}"]`)!;
    const forms = root.querySelector<HTMLSelectElement>("[data-druid-beast]")!;expect([...forms.options].find((o) => o.textContent!.startsWith("Mamut"))!.disabled).toBe(true);const wolf = [...forms.options].find((o) => o.textContent!.startsWith("Lobo ·"))!;forms.value = wolf.value;forms.dispatchEvent(new Event("change",{ bubbles: true }));formField("form-hp").value = "11";formField<HTMLInputElement>("seen").checked = true;root.querySelector<HTMLButtonElement>('[data-druid-action="wild-shape"]')!.click();await vi.waitFor(() => expect(view.snapshot.campaign.characters[c.id]!.spellcasting.druid!.form?.currentHp).toBe(11));expect(view.snapshot.campaign.characters[c.id]!.combat.hitPoints).toEqual(c.combat.hitPoints);expect(root.textContent).toContain("Forma Salvaje activa");root.querySelector<HTMLButtonElement>('[data-druid-action="revert"]')!.click();await vi.waitFor(() => expect(view.snapshot.campaign.characters[c.id]!.spellcasting.druid!.form).toBeNull());
  });
  it("lanza Mil Formas sin espacios y muestra preparación diaria con bloqueo de cupo",async () => {
    const c = await druidAt(14,"moon");for (const s of Object.values(c.spellcasting.slots)) s.used = s.maximum;const { root,view } = await mount(c,"spells");
    const alter = c.spellcasting.spells.find((s) => s.casting?.source === "builder:druid-moon")!,card = root.querySelector<HTMLElement>(`[data-spell-id="${alter.id}"]`)!;expect(card.querySelector<HTMLSelectElement>("[data-cast-slot-level]")!.textContent).toContain("sin espacio");const launch = card.querySelector<HTMLButtonElement>('[data-spell-action="cast"]')!;expect(launch.disabled).toBe(false);launch.click();await vi.waitFor(() => expect(view.snapshot.campaign.characters[c.id]!.revision).toBe(c.revision+1));expect(view.snapshot.campaign.characters[c.id]!.spellcasting.slots).toEqual(c.spellcasting.slots);
    const inputs = [...root.querySelectorAll<HTMLInputElement>("[data-druid-key]")];for (const i of inputs) { i.checked = false;i.dispatchEvent(new Event("change",{ bubbles: true })); }const target = inputs.find((i) => i.dataset.druidKey === "detect-magic")!;target.checked = true;target.dispatchEvent(new Event("change",{ bubbles: true }));root.querySelector<HTMLButtonElement>('[data-druid-action="prepare"]')!.click();await vi.waitFor(() => expect(view.snapshot.campaign.characters[c.id]!.revision).toBe(c.revision+2));expect(view.snapshot.campaign.characters[c.id]!.spellcasting.spells.find((s) => s.casting?.key === "detect-magic")!.prepared).toBe(true);
  });
});
