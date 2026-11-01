// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { GmApp, recommendedInitiativeOrder, type GmAppRuntime } from "../../src/ui/gm-app";
import { EncounterApplication } from "../../src/application/encounter/encounter-application";
import { CombatSessionRepository } from "../../src/infrastructure/persistence/combat-session-repository";
import type { CampaignSnapshot } from "../../src/application/ports/campaign-repository";
import { nativeCombatFixture } from "../fixtures/native-combat";
import type { TaleSpireNativeInitiativeQueue } from "../../src/infrastructure/talespire/talespire-gm-collaboration";
import type { DiceRollRequest } from "../../src/application/ports/dice-roller";
import { normalizeMonsterDefinition } from "../../src/domain/monsters/monster-catalog";
import { normalizeSpellDefinition } from "../../src/domain/spells/spell-catalog";
import { normalizeEquipmentDefinition } from "../../src/domain/equipment/equipment-catalog";

const apps: GmApp[] = [];
afterEach(() => { apps.splice(0).forEach((app) => app.stop()); vi.useRealTimers(); vi.restoreAllMocks(); document.body.innerHTML = ""; });

async function setup(overrides: Partial<GmAppRuntime> = {}, configure?: (campaign: CampaignSnapshot["campaign"]) => void) {
  const fixture = await nativeCombatFixture();
  if (configure) {
    const snapshot = (await fixture.source.load())!;
    configure(snapshot.campaign);
    await fixture.source.save(snapshot.campaign, { kind: "checksum", checksum: snapshot.checksum });
  }
  const root = document.createElement("div");
  document.body.append(root);
  let native: (queue: TaleSpireNativeInitiativeQueue) => void = () => undefined;
  let player: (clientId: string, total: number, characterId: string | null) => void = () => undefined;
  let resolved: (result: { name: string; total: number; correlationId?: string }) => void = () => undefined;
  let imageChanged: (creatureId: string | null) => void = () => undefined;
  const requests: DiceRollRequest[] = [];
  const runtime: GmAppRuntime = {
    monsters: [fixture.monster],
    diceRoller: { roll: vi.fn(async (request: DiceRollRequest) => {
      requests.push(request);
      return { kind: "submitted" as const, totals: [], summary: "En la bandeja" };
    }) },
    getNativeInitiative: async () => fixture.queue,
    subscribeNativeInitiative: (listener) => { native = listener; return () => undefined; },
    subscribeInitiative: (listener) => { player = listener; return () => undefined; },
    subscribeDiceResults: (listener) => { resolved = listener; return () => undefined; },
    createMiniatureThumbnail: async () => { const element = document.createElement("img"); element.alt = "Miniatura TS"; return element; },
    subscribeMiniatureChanges: (listener) => { imageChanged = listener; return () => undefined; },
    ...overrides,
  };
  const app = new GmApp(root, new EncounterApplication(new CombatSessionRepository(fixture.source)), runtime);
  apps.push(app);
  await app.start();
  const view = app as unknown as { snapshot: CampaignSnapshot; operations: Promise<void> };
  const idle = async () => { await view.operations; };
  const cards = () => [...root.querySelectorAll<HTMLElement>("[data-combatant-id]")];
  const combatants = () => Object.values(view.snapshot.campaign.encounters)[0]!.combatants;
  return { ...fixture, app, root, runtime, requests, idle, cards, combatants,
    native: (queue: TaleSpireNativeInitiativeQueue) => native(queue),
    player: (id: string, total: number, characterId: string | null) => player(id, total, characterId),
    resolved: (result: { name: string; total: number; correlationId?: string }) => resolved(result),
    imageChanged: (creatureId: string | null) => imageChanged(creatureId),
  };
}

describe("native combat UI", () => {
  it("keeps creature abilities and saves only in expanded details and still rolls them for the correct combatant", async () => {
    const monster = normalizeMonsterDefinition({ Id: "goblin", Name: "Goblin", Abilities: { Str: 18, Dex: 14, Con: 12, Int: 10, Wis: 14, Cha: 8 }, Saves: ["Fuerza +6"] });
    const f = await setup({ monsters: [monster] });
    const card = () => f.cards()[0]!;
    expect(card().querySelector(":scope > summary .gm-monster-ability-saves")).toBeNull();
    expect(card().querySelectorAll(".gm-monster-ability-saves")).toHaveLength(1);
    expect(card().querySelectorAll(".gm-combat-details .gm-save-roll")).toHaveLength(6);
    card().querySelector<HTMLElement>(":scope > summary")!.click();
    const save = card().querySelector<HTMLButtonElement>('.gm-combat-details .gm-save-roll[data-roll-expression="1d20+6"]')!;
    const actor = f.combatants()[0]!.name;
    save.click();
    await vi.waitFor(() => expect(f.requests).toHaveLength(1));
    expect(f.requests[0]).toMatchObject({ expressions: ["1d20+6"], name: expect.stringContaining(actor) });
  });

  it("uses the same quick-fact labels for creature and character passives and spellcasting", async () => {
    const monster = normalizeMonsterDefinition({ Id: "goblin", Name: "Goblin", Speed: ["30 pies"], Abilities: { Wis: 14, Int: 8 }, Skills: ["Perspicacia +3"], Senses: ["Percepción pasiva 17"], spellcasting: { ability: "intelligence", attackBonus: 6, saveDc: 14, casterLevel: 5 } });
    const f = await setup({ monsters: [monster] }, campaign => {
      const character = Object.values(campaign.characters)[0]!;
      character.abilities.wisdom = 14; character.abilities.intelligence = 8;
      character.spellcasting.ability = "intelligence";
    });
    const creatureFacts = f.cards()[0]!.querySelector(":scope > summary .gm-combat-facts")!;
    const characterFacts = f.cards()[1]!.querySelector(":scope > summary .gm-combat-facts")!;
    expect([...creatureFacts.querySelectorAll("small")].map(e => e.textContent)).toEqual([...characterFacts.querySelectorAll("small")].map(e => e.textContent));
    expect(creatureFacts.querySelector('[title="Percepción pasiva: 17"] strong')!.textContent).toBe("17");
    expect(creatureFacts.querySelector('[title="Investigación pasiva: 9"] strong')!.textContent).toBe("9");
    expect(creatureFacts.querySelector('[title="Perspicacia pasiva: 13"] strong')!.textContent).toBe("13");
    expect(creatureFacts.querySelector('[title="CD de salvación de conjuros: 14"]')).not.toBeNull();
    expect(creatureFacts.querySelector('[title="Bonificador de ataque con conjuros: +6"]')).not.toBeNull();
    expect(characterFacts.querySelector('[title="Percepción pasiva: 12"]')).not.toBeNull();
    expect(characterFacts.querySelector('[title="Investigación pasiva: 9"]')).not.toBeNull();
    expect(characterFacts.querySelector('[title="Perspicacia pasiva: 12"]')).not.toBeNull();
    expect(f.cards()[1]!.querySelector(".gm-combat-details .gm-passive-strip")).toBeNull();
  });

  it("keeps all passive fields present for incomplete creatures without guessing scores", async () => {
    const f = await setup();
    const facts = f.cards()[0]!.querySelector(":scope > summary .gm-combat-facts")!;
    for (const name of ["Percepción", "Investigación", "Perspicacia"]) expect(facts.querySelector(`[title="${name} pasiva: —"]`)).not.toBeNull();
  });

  it("rolls shop item capabilities without spending stock and retains the merchant draft", async () => {
    const item = { ...normalizeEquipmentDefinition({ name: "Vara de prueba", description: "Una descripción extensa con 2d6+1 de daño." }), id: "inv_11111111111111111111111111111111", order: 0, group: "backpack" };
    item.features = [{ id: "itf_11111111111111111111111111111111", order: 0, kind: "action", name: "Descarga", description: "El objetivo debe estar a la vista.", active: false, toggleable: false, showInActions: true, chargeCost: 1, uses: { current: 2, maximum: 3, reset: "dawn" }, rolls: [{ label: "Impacto", expression: "1d20+5", mode: "advantage" }], bonuses: [] }];
    const npc = normalizeMonsterDefinition({ Id: "merchant", Name: "Mercader", Inventory: [item] });
    const save = vi.fn(async () => undefined);
    const f = await setup({ loadGmContent: async () => ({ spells: [], equipment: [], monsters: [npc], shops: [{ name: "Tienda", npcId: npc.id, categories: {} }], checklist: [] }), saveCustomMonster: save });
    f.root.querySelector<HTMLButtonElement>('[data-gm-section="content"]')!.click();
    f.root.querySelector<HTMLButtonElement>('[data-gm-content-kind="shop"]')!.click();
    f.root.querySelector<HTMLButtonElement>('[data-gm-edit="shop"]')!.click();
    const name = f.root.querySelector<HTMLInputElement>('[name="name"]')!;
    name.value = "Tienda editada"; name.dispatchEvent(new Event("input", { bubbles: true }));
    f.root.querySelector<HTMLButtonElement>('[data-roll-expression="1d20+5"]')!.click();
    await vi.waitFor(() => expect(f.requests).toHaveLength(1));
    expect(f.requests[0]).toMatchObject({ expressions: ["1d20+5"], mode: "advantage" });
    await vi.waitFor(() => expect(f.root.querySelector<HTMLInputElement>('[name="name"]')!.value).toBe("Tienda editada"));
    expect(f.root.textContent).toContain("2/3 usos");
    expect(save).not.toHaveBeenCalled();
  });

  it("rolls campaign monster spells with the selected level and keeps that level after an attack", async () => {
    const monster = normalizeMonsterDefinition({ Id: "goblin", Name: "Goblin", Spells: ["Rayo propio"], spellcasting: { ability: "intelligence", attackBonus: 6, saveDc: 14, casterLevel: 5 } });
    const spell = normalizeSpellDefinition({ name: "Rayo propio", level: 1, attackType: "attack", damageExpression: "2d6", upcastDamageExpression: "1d6", description: "Una descripción completa.", higherLevels: "Un dado por nivel." });
    const f = await setup({ monsters: [monster], loadGmContent: async () => ({ spells: [spell], equipment: [], monsters: [monster], shops: [], checklist: [] }) });
    const card = () => f.cards()[0]!.querySelector<HTMLElement>('[data-monster-spell]')!;
    const level = card().querySelector<HTMLSelectElement>('[data-monster-spell-level]')!;
    level.value = "3"; level.dispatchEvent(new Event("change", { bubbles: true }));
    expect(card().querySelector('[data-roll-expression="4d6"]')).not.toBeNull();
    card().querySelector<HTMLButtonElement>('[data-roll-expression="1d20+6"]')!.click();
    await vi.waitFor(() => expect(f.requests).toHaveLength(1));
    await vi.waitFor(() => expect(card().querySelector<HTMLOptionElement>('[data-monster-spell-level] option[selected]')!.value).toBe("3"));
    card().querySelector<HTMLButtonElement>('[data-roll-expression="4d6"]')!.click();
    await vi.waitFor(() => expect(f.requests).toHaveLength(2));
    expect(f.requests.map(r => r.expressions)).toEqual([["1d20+6"], ["4d6"]]);
    expect(f.requests[0]!.name).toContain("Rayo propio");
    expect(card().textContent).toContain("Una descripción completa.");
  });

  it("shows projected spell bonuses in quick facts and keeps character states visible after compacting the card", async () => {
    const f = await setup({}, (campaign) => {
      const character = Object.values(campaign.characters)[0]!;
      character.identity.level = 10;
      character.identity.className = "Mago · Escuela de abjuración";
      character.abilities.intelligence = 18;
      character.spellcasting.ability = "intelligence";
      character.spellcasting.saveDcBonus = 2;
      character.spellcasting.attackBonus = 1;
      character.combat.exhaustion = 1;
      character.combat.conditions = [
        { id: "cond_11111111111111111111111111111111", key: "concentration", label: "Concentración", level: null, addedAt: "2026-10-20T12:00:00Z" },
        { id: "cond_22222222222222222222222222222222", key: "poisoned", label: "Envenenado", level: null, addedAt: "2026-10-20T12:00:00Z" },
      ];
    });
    const summary = f.cards()[1]!.querySelector<HTMLElement>("summary")!;
    const facts = summary.querySelector(".gm-combat-facts")!;
    expect(facts.querySelector('[title="CD de salvación de conjuros: 18"] strong')!.textContent).toBe("18");
    expect(facts.querySelector('[title="Bonificador de ataque con conjuros: +9"] strong')!.textContent).toBe("+9");
    expect(summary.querySelector(".gm-summary-conditions")!.textContent).toContain("Concentración");
    expect(summary.querySelector(".gm-summary-conditions")!.textContent).toContain("Envenenado");
    expect(summary.querySelector(".gm-summary-conditions")!.textContent).toContain("Agotamiento 1");
    expect(summary.querySelector(".gm-combat-identity-rank")!.textContent).toContain("nivel 10");
    summary.click();
    expect(f.cards()[1]!.querySelector(".gm-character-identity-details")!.textContent).not.toContain("Escuela de abjuración"); // Already visible in the compact identity.
    expect(f.requests).toHaveLength(0);
  });

  it("does not fetch or display combat portraits even when native image capabilities are available", async () => {
    const thumbnail = vi.fn(async () => document.createElement("img"));
    const f = await setup({ createMiniatureThumbnail: thumbnail });
    expect(f.root.querySelector("[data-miniature-image]")).toBeNull();
    expect(thumbnail).not.toHaveBeenCalled();
    expect(f.cards().map(card => card.querySelector<HTMLElement>("[data-combat-miniature-name]")?.dataset.combatMiniatureName)).toEqual(["Goblin del puente", "Delerion", "Guardia de la torre"]);
  });

  it("shows only the native queue with miniature names, missing bindings and no encounter management", async () => {
    const f = await setup();
    expect(f.root.textContent).toContain("Combate de TaleSpire");
    expect(f.root.querySelector('[data-action="create-encounter"]')).toBeNull();
    expect(f.root.querySelector('[data-action="select-encounter"]')).toBeNull();
    expect(f.cards().map((card) => card.querySelector<HTMLElement>("[data-combat-miniature-name]")?.dataset.combatMiniatureName)).toEqual([
      "Goblin del puente", "Delerion", "Guardia de la torre",
    ]);
    expect(f.cards()[0]?.classList.contains("active")).toBe(true);
    expect(f.cards()[2]?.querySelector(".needs-association")).not.toBeNull();
    expect(f.cards()[2]?.querySelector('[data-open-association="player"]')).not.toBeNull();
    expect(f.cards()[2]?.querySelector('[data-open-association="monster"]')).not.toBeNull();
    expect(f.root.querySelectorAll("[data-miniature-image] img")).toHaveLength(0);
    expect(f.cards()[1]?.querySelector(".needs-initiative")?.textContent).toContain("Falta INI");
    // A sheet without a casting ability must not advertise fabricated spell stats.
    expect(f.cards()[1]?.querySelector('.gm-combat-facts [title^="CD de salvación de conjuros:"]')).toBeNull();
  });

  it("automatically receives character initiative, recommends a position and follows subsequent TS edits", async () => {
    const f = await setup();
    f.player("client-hero", 21, f.character.id);
    await f.idle();
    expect(f.combatants().find((entry) => entry.kind === "player")?.initiative).toBe(21);
    expect(f.cards()[1]?.querySelector(".gm-order-correction")?.textContent).toBe("↑ #1");
    expect(f.cards()[0]?.querySelector<HTMLElement>("[data-combat-miniature-name]")?.dataset.combatMiniatureName).toBe("Goblin del puente");
    const reordered = { ...f.queue, items: [f.queue.items[1]!, f.queue.items[0]!], activeItemIndex: 0 };
    f.native(reordered);
    await f.idle();
    expect(f.cards()).toHaveLength(2);
    expect(f.cards()[0]?.querySelector(".gm-order-correction")).toBeNull();
    expect(f.cards()[0]?.querySelector('[data-action="roll-initiative"]')?.textContent).toBe("21");
    // A result tagged with a different character must not fall back to the last client association.
    f.player("client-hero", 2, "chr_22222222222222222222222222222222");
    await f.idle();
    expect(f.combatants()[0]?.initiative).toBe(21);
  });

  it("associates a character from the card and persists the miniature instance binding", async () => {
    const f = await setup();
    f.cards()[2]!.querySelector<HTMLButtonElement>('[data-open-association="player"]')!.click();
    expect(f.root.querySelector("[data-association-category]")?.textContent).toContain("Mago");
    f.root.querySelector<HTMLButtonElement>(`[data-associate-id="${f.character.id}"]`)!.click();
    await f.idle();
    expect((await f.source.load())!.campaign.gm.miniatureAssociations?.["mini-new"]?.characterId).toBe(f.character.id);
    expect(f.cards()[2]?.querySelector(".needs-association")).toBeNull();
    expect(f.cards()[2]?.querySelector<HTMLElement>("[data-combat-miniature-name]")?.dataset.combatMiniatureName).toBe("Guardia de la torre");
    expect(Object.keys((await f.source.load())!.campaign.encounters)).toHaveLength(1);
  });

  it("uses character modifiers and correlates results without expanding the card or leaking routing IDs", async () => {
    const f = await setup();
    f.cards()[1]!.querySelector<HTMLButtonElement>('[data-action="roll-initiative"]')!.click();
    await vi.waitFor(() => expect(f.requests).toHaveLength(1));
    expect(f.requests[0]).toMatchObject({ name: "Iniciativa: Delerion", expressions: ["1d20+3"] });
    expect(f.cards()[1]?.hasAttribute("open")).toBe(false);
    expect(f.cards()[1]?.textContent).toContain("Tirando…");
    f.resolved({ name: f.requests[0]!.name, total: 17, correlationId: f.requests[0]!.correlationId! });
    await f.idle();
    expect(f.combatants()[1]?.initiative).toBe(17);
    expect(f.root.textContent).not.toContain(f.requests[0]!.correlationId!);
    f.root.querySelector<HTMLButtonElement>('[data-action="clear-initiatives"]')!.click();
    await f.idle();
    expect(f.combatants().every((entry) => entry.initiative === null)).toBe(true);
  });

  it("keeps equal initiatives stable and unknown initiatives last in recommendations", async () => {
    const f = await setup();
    const [a, b, c] = f.combatants();
    expect(recommendedInitiativeOrder([{ ...a!, initiative: 12 }, { ...b!, initiative: 12 }, { ...c!, initiative: null }])
      .map((entry) => entry.id)).toEqual([a!.id, b!.id, c!.id]);
  });

  it("does not rebuild an open search for an unchanged native update", async () => {
    const f = await setup();
    f.cards()[2]!.querySelector<HTMLButtonElement>('[data-open-association="monster"]')!.click();
    const search = f.root.querySelector<HTMLInputElement>("[data-association-search]")!;
    search.value = "gob";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    f.native(f.queue);
    await f.idle();
    expect(f.root.querySelector("[data-association-search]")).toBe(search);
    expect(search.value).toBe("gob");
  });

  it("serializes simultaneous character results and native queue changes without dropping either", async () => {
    const f = await setup();
    f.player("client-hero", 20, f.character.id);
    f.native({ ...f.queue, items: [f.queue.items[1]!, f.queue.items[0]!], activeItemIndex: 1 });
    await f.idle();
    expect(f.combatants().map((entry) => entry.taleSpireCreatureId)).toEqual(["mini-hero", "mini-goblin"]);
    expect(f.combatants()[0]?.initiative).toBe(20);
    expect(f.cards()[1]?.classList.contains("active")).toBe(true);
  });

  it("ignores a late dice result after initiatives were cleared", async () => {
    const f = await setup();
    f.cards()[0]!.querySelector<HTMLButtonElement>('[data-action="roll-initiative"]')!.click();
    await vi.waitFor(() => expect(f.requests).toHaveLength(1));
    f.root.querySelector<HTMLButtonElement>('[data-action="clear-initiatives"]')!.click();
    await f.idle();
    f.resolved({ name: f.requests[0]!.name, total: 19, correlationId: f.requests[0]!.correlationId! });
    await f.idle();
    expect(f.combatants()[0]?.initiative).toBeNull();
    expect(f.cards()[0]?.textContent).not.toContain("Tirando…");
  });

  it("places horizontal HP below the name and groups initiative with AC without losing its controls", async () => {
    const f = await setup();
    const summary = f.cards()[0]!.querySelector(".gm-combatant-summary")!;
    const identity = summary.querySelector(".gm-combatant-identity")!;
    expect(identity.nextElementSibling?.classList.contains("gm-combatant-hp-readout")).toBe(true);
    const stats = identity.querySelector(".gm-combat-header-stats")!;
    expect(stats.querySelector(".gm-combat-ac")).not.toBeNull();
    expect(stats.querySelector('[data-action="roll-initiative"]')).not.toBeNull();
    (summary as HTMLElement).click();
    expect(f.cards()[0]?.hasAttribute("open")).toBe(true);
    expect(f.cards()[0]?.querySelector(".gm-monster-details")?.hasAttribute("open")).toBe(true);
    expect(f.cards()[0]?.querySelector(".gm-combat-detail-toolbar [data-action=damage]")).not.toBeNull();
  });

  it("restores initiatives and creature HP when the GM panel is reopened", async () => {
    const f = await setup();
    f.player("client-hero", 19, f.character.id);
    await f.idle();
    f.cards()[0]!.querySelector<HTMLButtonElement>('[data-action="damage"]')!.click();
    await f.idle();
    const root = document.createElement("div"); document.body.append(root);
    const reopened = new GmApp(root, new EncounterApplication(new CombatSessionRepository(f.source)), f.runtime);
    apps.push(reopened);
    await reopened.start();
    expect(root.querySelectorAll("[data-combatant-id]")).toHaveLength(3);
    expect(root.querySelectorAll(".gm-combatant-hp-readout")[0]?.getAttribute("aria-valuenow")).toBe("6");
    expect(root.querySelectorAll('[data-action="roll-initiative"]')[1]?.textContent).toBe("19");
    expect(f.requests).toHaveLength(0);
  });
});
