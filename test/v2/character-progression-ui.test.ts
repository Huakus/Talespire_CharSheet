// @vitest-environment happy-dom
import { beforeEach,afterEach,describe,it,expect,vi } from "vitest";
import { BrowserApp } from "../../src/ui/browser-app";
import { CharacterProgressionPanel } from "../../src/ui/character-progression-panel";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { rangerAt,rangerChoice,rangerTime as at } from "../fixtures/ranger-builder";
import { advanceGuidedCharacter } from "../../src/domain/character/guided-character-builder";
import { createCharacter } from "../../src/domain/character/create-character";
import type { CampaignSnapshot } from "../../src/application/ports/campaign-repository";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
const diceRoller = { roll: vi.fn(async () => ({ kind: "rolled" as const,summary: "6",totals: [6] })) };
async function mount(c: CharacterV2) {
  const repo = new InMemoryCampaignRepository(),application = new CampaignApplication(repo);let snapshot = await application.createCampaign(at);snapshot.campaign.characters[c.id] = c;snapshot = await repo.save(snapshot.campaign,{ kind: "checksum",checksum: snapshot.checksum });const save = vi.spyOn(repo,"save");
  const root = document.createElement("div");document.body.append(root);const app = new BrowserApp(root,application,{ storageLabel: "test",diceRoller });const view = app as unknown as { snapshot: CampaignSnapshot;selectedCharacterId: string;activeSheetTab: string;sheetMode: string;render(): void };Object.assign(view,{ snapshot,selectedCharacterId: c.id,activeSheetTab: "summary",sheetMode: "play" });view.render();return { root,view,application,save };
}
beforeEach(() => { document.body.innerHTML = "";localStorage.clear();vi.clearAllMocks(); });
afterEach(() => { document.body.innerHTML = ""; });
describe("Vista de progresión",() => {
  it("abre desde la pestaña real en juego/edición y consulta niveles sin guardar cambios",async () => {
    const c = await rangerAt(5),{ root,view,save } = await mount(c),original = JSON.stringify(view.snapshot);root.querySelector<HTMLButtonElement>('[data-sheet-tab="progression"]')!.click();await vi.waitFor(() => expect(root.querySelectorAll("[data-progression-level]")).toHaveLength(5));expect(root.textContent).toContain("Progresión del personaje");expect(root.querySelector<HTMLDetailsElement>('[data-progression-level="5"]')!.open).toBe(true);expect(root.querySelector('[data-progression-level="2"]')!.textContent).toContain("Arquería");expect(root.querySelector('[data-progression-level="5"]')!.textContent).toContain("Ataque Extra");expect(root.querySelector('[data-progression-level="6"]')).toBeNull();
    root.querySelector<HTMLButtonElement>("[data-progression-expand]")!.click();expect([...root.querySelectorAll<HTMLDetailsElement>("[data-progression-level]")].every((d) => d.open)).toBe(true);root.querySelector<HTMLButtonElement>("[data-progression-collapse]")!.click();expect([...root.querySelectorAll<HTMLDetailsElement>("[data-progression-level]")].every((d) => !d.open)).toBe(true);
    root.querySelector<HTMLButtonElement>('[data-sheet-mode-choice="edit"]')!.click();expect(root.querySelector("[data-progression]")).toBeTruthy();expect(root.querySelector("#character-form")).toBeNull();expect(save).not.toHaveBeenCalled();expect(JSON.stringify(view.snapshot)).toBe(original);
  });
  it("busca sin distinguir tildes, muestra vacíos y permite saltar a otro nivel",async () => {
    const { root } = await mount(await rangerAt(5));root.querySelector<HTMLButtonElement>('[data-sheet-tab="progression"]')!.click();await vi.waitFor(() => expect(root.querySelector("[data-progression]")).toBeTruthy());const search = root.querySelector<HTMLInputElement>("[data-progression-search]")!;search.value = "ARQUERIA";search.dispatchEvent(new Event("input",{ bubbles: true }));const visible = () => [...root.querySelectorAll<HTMLDetailsElement>("[data-progression-level]")].filter((l) => !l.hidden);expect(visible().map((l) => l.dataset.progressionLevel)).toContain("2");expect(visible().every((l) => l.open)).toBe(true);
    search.value = "zzzzz_sin_coincidencias";search.dispatchEvent(new Event("input",{ bubbles: true }));expect(visible()).toHaveLength(0);expect(root.querySelector<HTMLElement>("[data-progression-empty]")!.hidden).toBe(false);const jump = root.querySelector<HTMLSelectElement>("[data-progression-jump]")!;jump.value = "3";jump.dispatchEvent(new Event("change",{ bubbles: true }));expect(search.value).toBe("");expect(visible()).toHaveLength(5);expect(root.querySelector<HTMLDetailsElement>('[data-progression-level="3"]')!.open).toBe(true);
  });
  it("muestra sustituciones y rasgos expandibles, sin controles de edición",async () => {
    const c = await rangerAt(3),step = rangerChoice(c);step.ranger.replaceSpell = { oldKey: c.spellcasting.spells.find((s) => s.casting?.source === "builder:ranger")!.casting!.key,newKey: "hunters-mark" };const advanced = await advanceGuidedCharacter(c,step,at),{ root } = await mount(advanced);root.querySelector<HTMLButtonElement>('[data-sheet-tab="progression"]')!.click();await vi.waitFor(() => expect(root.querySelector("[data-progression]")).toBeTruthy());const fourth = root.querySelector('[data-progression-level="4"]')!;expect(fourth.querySelector(".progression-replacements")!.textContent).toContain("→");expect(root.querySelector(".progression-trait > summary")).toBeTruthy();expect(root.querySelector("[data-progression] form")).toBeNull();
  });
  it("explica fichas sin historial y escapa los textos personalizados",async () => {
    const manual = createCharacter("chr_00000000000000000000000000000002","Manual",at),{ root,view } = await mount(manual);root.querySelector<HTMLButtonElement>('[data-sheet-tab="progression"]')!.click();expect(root.textContent).toContain("no tiene un historial");
    const c = await rangerAt(1);c.builder!.creation.background.name = '<img src=x onerror="alert(1)">';view.snapshot.campaign.characters[c.id] = c;view.selectedCharacterId = c.id;view.render();await vi.waitFor(() => expect(root.querySelector("[data-progression]")).toBeTruthy());expect(root.querySelector("[data-progression] img")).toBeNull();expect(root.querySelector("[data-progression]")!.textContent).toContain('<img src=x onerror="alert(1)">');
  });
  it("invalida la caché al ascender y descarta resultados de otro personaje",async () => {
    const c = await rangerAt(1),next = await advanceGuidedCharacter(c,rangerChoice(c),at),root = document.createElement("div"),refresh = vi.fn();const panel = new CharacterProgressionPanel(refresh);panel.render(c);panel.render(next);await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));root.innerHTML = panel.render(next);panel.bind(root);expect(root.querySelectorAll("[data-progression-level]")).toHaveLength(2);expect(root.textContent).toContain("Arquería");
  });
  it("presenta un error recuperable si el historial no puede reconstruirse",async () => {
    const c = await rangerAt(1);c.builder!.creation.ranger.terrain = null;const refresh = vi.fn(),panel = new CharacterProgressionPanel(refresh),root = document.createElement("div");panel.render(c);await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());root.innerHTML = panel.render(c);panel.bind(root);expect(root.querySelector('[role="alert"]')!.textContent).toContain("No se pudo reconstruir");root.querySelector<HTMLButtonElement>("[data-progression-retry]")!.click();expect(refresh).toHaveBeenCalledTimes(2);
  });
});
