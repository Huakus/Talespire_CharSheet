// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { GmApp, recommendedInitiativeOrder, type GmAppRuntime } from "../../src/ui/gm-app";
import { EncounterApplication } from "../../src/application/encounter/encounter-application";
import { CombatSessionRepository } from "../../src/infrastructure/persistence/combat-session-repository";
import type { CampaignSnapshot } from "../../src/application/ports/campaign-repository";
import { nativeCombatFixture } from "../fixtures/native-combat";
import type { TaleSpireNativeInitiativeQueue } from "../../src/infrastructure/talespire/talespire-gm-collaboration";
import type { DiceRollRequest } from "../../src/application/ports/dice-roller";

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
    expect(f.cards()[1]!.querySelector(".gm-character-identity-details")!.textContent).toContain("Escuela de abjuración");
    expect(f.requests).toHaveLength(0);
  });

  it("opens a copyable per-miniature diagnostic and retries images without changing combat state", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    let unavailable = true;
    const load = vi.fn(async () => {
      if (unavailable) throw new Error("TALESPIRE_MINIATURE_IMAGE:model-lookup:notReady");
      return document.createElement("canvas");
    });
    const f = await setup({ createMiniatureThumbnail: load, getMiniatureImageDiagnostics: () => ({
      capabilities: { thumbnail: true },
      images: [{ creatureId: "mini-goblin", stage: "model-lookup", status: "error", startedAt: "2026-10-20T00:00:00Z",
        updatedAt: "2026-10-20T00:00:00Z", boardAssetId: "active-model", responses: {}, error: "notReady" }],
    }) });
    await vi.waitFor(() => expect(f.cards()[0]?.querySelector("[data-miniature-image]")?.getAttribute("data-miniature-image-state")).toBe("retrying"));
    const before = structuredClone(f.combatants());
    f.root.querySelector<HTMLButtonElement>("[data-open-image-diagnostics]")!.click();
    const dialog = document.querySelector<HTMLDialogElement>(".miniature-image-diagnostics")!;
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain("Búsqueda del modelo");
    expect(dialog.textContent).toContain("Goblin del puente");
    const reportField = dialog.querySelector<HTMLTextAreaElement>("[data-image-report]")!;
    const snapshot = JSON.parse(reportField.value);
    expect(snapshot.participants[0]).toMatchObject({ creatureId: "mini-goblin", native: { boardAssetId: "active-model" },
      failure: { attempt: 1, reason: "TALESPIRE_MINIATURE_IMAGE:model-lookup:notReady" } });
    dialog.querySelector<HTMLButtonElement>("[data-image-copy]")!.click();
    await vi.waitFor(() => expect(copy).toHaveBeenCalledWith(reportField.value));
    unavailable = false;
    dialog.querySelector<HTMLButtonElement>("[data-image-retry]")!.click();
    await vi.waitFor(() => expect(f.root.querySelectorAll("[data-miniature-image] canvas")).toHaveLength(3));
    dialog.querySelector<HTMLButtonElement>("[data-image-refresh]")!.click();
    expect(JSON.parse(reportField.value).participants[0]).toMatchObject({ display: { elementTag: "CANVAS", canvases: [{ width: 300, height: 150 }] } });
    expect(JSON.parse(reportField.value).participants[0]).not.toHaveProperty("failure");
    expect(f.combatants()).toEqual(before);
    expect(f.requests).toHaveLength(0);
    f.app.stop();
    expect(dialog.open).toBe(false);
  });

  it("automatically retries a native image failure without touching the combat or requiring user input", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let unavailable = true;
    const load = vi.fn(async (id: string) => {
      if (id === "mini-goblin" && unavailable) throw new Error("model-not-ready");
      return document.createElement("img");
    });
    const f = await setup({ createMiniatureThumbnail: load });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.cards()[0]?.querySelector("[data-miniature-image]")?.getAttribute("data-miniature-image-state")).toBe("retrying");
    unavailable = false;
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.cards()[0]?.querySelector("[data-miniature-image] img")).not.toBeNull();
    expect(load.mock.calls.filter(([id]) => id === "mini-goblin")).toHaveLength(2);
    expect(f.combatants()).toHaveLength(3);
    expect(f.requests).toHaveLength(0);
  });

  it("immediately refreshes automatic images when a content pack becomes available", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let unavailable = true;
    const f = await setup({ createMiniatureThumbnail: async () => unavailable ? null : document.createElement("img") });
    unavailable = false;
    f.imageChanged(null);
    await vi.waitFor(() => expect(f.root.querySelectorAll("[data-miniature-image] img")).toHaveLength(3));
  });

  it("never replaces a changed miniature model with an older response that arrives late", async () => {
    let resolveOld!: (element: HTMLElement) => void;
    const old = new Promise<HTMLElement>((resolve) => { resolveOld = resolve; });
    let first = true;
    const newest = document.createElement("img"); newest.dataset.model = "new-model";
    const f = await setup({ createMiniatureThumbnail: async (id) => {
      if (id === "mini-goblin" && first) { first = false; return old; }
      return id === "mini-goblin" ? newest : document.createElement("img");
    } });
    f.imageChanged("mini-goblin");
    await vi.waitFor(() => expect(f.cards()[0]?.querySelector("img")).toBe(newest));
    resolveOld(document.createElement("canvas"));
    await old; await Promise.resolve();
    expect(f.cards()[0]?.querySelector("img")).toBe(newest);
    expect(f.cards()[0]?.querySelector("canvas")).toBeNull();
  });
  it("shows only the native queue with miniature images, missing bindings and no encounter management", async () => {
    const f = await setup();
    expect(f.root.textContent).toContain("Combate de TaleSpire");
    expect(f.root.querySelector('[data-action="create-encounter"]')).toBeNull();
    expect(f.root.querySelector('[data-action="select-encounter"]')).toBeNull();
    expect(f.cards().map((card) => card.querySelector(".gm-combatant-miniature > small")?.textContent)).toEqual([
      "Goblin del puente", "Delerion", "Guardia de la torre",
    ]);
    expect(f.cards()[0]?.classList.contains("active")).toBe(true);
    expect(f.cards()[2]?.querySelector(".needs-association")).not.toBeNull();
    expect(f.cards()[2]?.querySelector('[data-open-association="player"]')).not.toBeNull();
    expect(f.cards()[2]?.querySelector('[data-open-association="monster"]')).not.toBeNull();
    await vi.waitFor(() => expect(f.root.querySelectorAll("[data-miniature-image] img")).toHaveLength(3));
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
    expect(f.cards()[0]?.querySelector(".gm-combatant-miniature > small")?.textContent).toBe("Goblin del puente");
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
    expect(f.cards()[2]?.querySelector(".gm-combatant-miniature > small")?.textContent).toBe("Guardia de la torre");
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

  it("places HP in a separate summary column and opens the creature statistics with its details", async () => {
    const f = await setup();
    const summary = f.cards()[0]!.querySelector(".gm-combatant-summary")!;
    expect(summary.querySelector(":scope > .gm-combatant-hp-readout")).not.toBeNull();
    expect(summary.querySelector(".gm-combatant-core .gm-combatant-hp-readout")).toBeNull();
    (summary as HTMLElement).click();
    expect(f.cards()[0]?.hasAttribute("open")).toBe(true);
    expect(f.cards()[0]?.querySelector(".gm-monster-details")?.hasAttribute("open")).toBe(true);
    expect(f.cards()[0]?.querySelector(".gm-combat-detail-toolbar [data-action=damage]")).not.toBeNull();
  });

  it("keeps the original canvas thumbnail when the participant card is rendered again", async () => {
    const f = await setup();
    f.runtime.createMiniatureThumbnail = async () => document.createElement("canvas");
    f.root.querySelector<HTMLButtonElement>('[data-action="refresh-combat"]')!.click();
    await vi.waitFor(() => expect(f.root.querySelectorAll("[data-miniature-image] canvas")).toHaveLength(3));
    const canvas = f.cards()[0]!.querySelector("canvas");
    f.player("client-hero", 20, f.character.id);
    await f.idle();
    await vi.waitFor(() => expect(f.cards()[0]!.querySelector("canvas")).toBe(canvas));
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
