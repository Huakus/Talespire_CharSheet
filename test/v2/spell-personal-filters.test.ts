// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { BrowserApp } from "../../src/ui/browser-app";
import { spellLearningOrigin, spellPersonalInfo, type SpellPersonalFacet } from "../../src/ui/spell-casting-filters";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { createCharacter } from "../../src/domain/character/create-character";
import { CharacterSpellV2Schema, type CharacterSpellV2 } from "../../src/domain/character/character-spell-model";
import { CharacterTraitGroupV2Schema } from "../../src/domain/character/character-content-model";
import { createGuidedWizard } from "../../src/domain/character/wizard-builder";
import { phbWizardCreation } from "../fixtures/phb-wizard-builder";
import { PHB_SPELLS } from "../../src/domain/character/phb-spells";
import type { CampaignSnapshot } from "../../src/application/ports/campaign-repository";
import type { CharacterV2 } from "../../src/domain/character/character-v2";

const time = "2026-10-16T00:00:00.000Z", id = "chr_11111111111111111111111111111111";
type View = {
  snapshot: CampaignSnapshot; selectedCharacterId: string; activeSheetTab: string; sheetMode: string;
  includeUnknownSpells: boolean; spellSearch: string; spellFilter: string;
  spellPersonalFilters: Record<SpellPersonalFacet, Set<string>>;
  render(): void; renderSpellsPlay(c: CharacterV2): string;
  visibleSpellEntries(c: CharacterV2): { spell: CharacterSpellV2; known: boolean }[];
  spellLaunchState(c: CharacterV2, s: CharacterSpellV2): { canLaunch: boolean };
};
function app(root = document.createElement("div")) {
  return new BrowserApp(root, new CampaignApplication(new InMemoryCampaignRepository()), { storageLabel: "test", diceRoller: { roll: async () => ({ kind: "rolled", totals: [10], summary: "ok" }) } }) as unknown as View;
}
function learned(index: number, key: string, source: string, kind: NonNullable<CharacterSpellV2["casting"]>["kind"], prepared = true) {
  const definition = PHB_SPELLS[key]!;
  return CharacterSpellV2Schema.parse({ id: `spl_${index.toString(16).padStart(32, "0")}`, name: definition.name, level: definition.level, order: index, prepared, definition, effect: { active: false, description: "" }, casting: { source, kind, key, ability: "intelligence", level: definition.level, traitId: null } });
}
async function wizard() {
  const creation = phbWizardCreation("high-elf"); creation.origin.cantrip = "poison-spray";
  return createGuidedWizard(id, "build_11111111111111111111111111111111", creation, time);
}
afterEach(() => { document.body.replaceChildren(); localStorage.clear(); });

describe("personal spell filters", () => {
  it("distinguishes every class origin, racial magic, feats, invocations and unrecorded legacy entries", () => {
    const sources = { wizard: "wizard", cleric: "cleric", druid: "druid", paladin: "paladin", bard: "bard", sorcerer: "sorcerer", ranger: "ranger", monk: "monk", barbarian: "barbarian", rogue: "rogue", "eldritch-knight": "eldritch-knight", "warlock:known": "warlock", race: "race", "feat-1-magic-initiate": "feat", "warlock:feat-slots-4": "feat", "warlock:invocation-misty-visions": "invocation", "warlock:arcanum": "arcanum" };
    for (const [source, origin] of Object.entries(sources)) expect(spellLearningOrigin(learned(1, "light", `builder:${source}`, "innate")).key).toBe(origin);
    const c = createCharacter(id, "Anterior", time), s = learned(1, "light", "builder:race", "innate");
    s.casting = null; c.spellcasting.ability = "WIS";
    expect(spellPersonalInfo(c, s)).toMatchObject({ learning: "unrecorded", ability: "wisdom" });
    expect(spellPersonalInfo(c, s, false)).toMatchObject({ learning: "catalog", ability: "unassigned" });
  });

  it("uses actual launch readiness: cantrips and rituals remain ready without slots, prepared slot spells do not", async () => {
    const c = await wizard(), view = app();
    for (const slot of Object.values(c.spellcasting.slots)) slot.used = slot.maximum;
    view.spellPersonalFilters.availability.add("ready");
    const ready = view.visibleSpellEntries(c).map((e) => e.spell.casting?.key);
    expect(ready).toContain("poison-spray");
    expect(ready).toContain("find-familiar");
    expect(ready).not.toContain("shield");
    view.spellPersonalFilters.availability = new Set(["unready"]);
    expect(view.visibleSpellEntries(c).some((e) => e.spell.casting?.key === "shield")).toBe(true);
    // Catalog entries have no personal readiness and appear only with the availability filter cleared.
    view.includeUnknownSpells = true;
    expect(view.visibleSpellEntries(c).every((e) => e.known)).toBe(true);
    view.spellPersonalFilters.availability.clear();
    expect(view.visibleSpellEntries(c).some((e) => !e.known)).toBe(true);
    view.spellPersonalFilters.ability.add("intelligence");
    expect(view.visibleSpellEntries(c).every((e) => e.known)).toBe(true);
    // When the spellbook is unavailable, its unprepared rituals stop being ready.
    c.spellcasting.wizard!.bookAvailable = false;
    const familiar = c.spellcasting.spells.find((s) => s.casting?.key === "find-familiar")!;
    familiar.prepared = false;
    expect(view.spellLaunchState(c, familiar).canLaunch).toBe(false);
  });

  it("handles spontaneous casters, pact slots, at-will invocations and limited innate resources", () => {
    const c = createCharacter(id, "Fuentes mixtas", time), view = app();
    c.spellcasting.slots["1"] = { maximum: 1, used: 1 };
    const bard = learned(1, "sleep", "builder:bard", "slots", false);
    const paladin = learned(5, "bless", "builder:paladin", "slots", false);
    const pact = learned(2, "armor-of-agathys", "builder:warlock:known", "pact");
    const atWill = learned(3, "silent-image", "builder:warlock:invocation-misty-visions", "at-will");
    const innate = learned(4, "hellish-rebuke", "builder:race", "innate");
    const traitId = "trt_11111111111111111111111111111111";
    innate.casting!.traitId = traitId;
    c.traits = [CharacterTraitGroupV2Schema.parse({ id: "trg_11111111111111111111111111111111", order: 0, title: "Usos", collapsed: false, traits: [{ id: traitId, order: 0, name: "Magia racial", description: "", collapsed: false, uses: { maximum: 1, used: 1, reset: "long-rest" }, adjustment: null, effect: { active: false, description: "" } }] })];
    expect(view.spellLaunchState(c, bard).canLaunch).toBe(false);
    expect(view.spellLaunchState(c, pact).canLaunch).toBe(false);
    expect(view.spellLaunchState(c, atWill).canLaunch).toBe(true);
    expect(view.spellLaunchState(c, innate).canLaunch).toBe(false);
    c.spellcasting.slots["1"]!.used = 0;
    expect(view.spellLaunchState(c, bard).canLaunch).toBe(true);
    expect(view.spellLaunchState(c, pact).canLaunch).toBe(true);
    expect(view.spellLaunchState(c, paladin).canLaunch).toBe(false);
    paladin.prepared = true;
    expect(view.spellLaunchState(c, paladin).canLaunch).toBe(true);
    // Remaining slots cannot substitute for a depleted racial use.
    expect(view.spellLaunchState(c, innate).canLaunch).toBe(false);
    c.traits[0]!.traits[0]!.uses.used = 0;
    expect(view.spellLaunchState(c, innate).canLaunch).toBe(true);
  });

  it("combines origins with OR and intersects attributes, readiness, search and level", async () => {
    const c = await wizard(), view = app();
    view.spellPersonalFilters.learning.add("race");
    expect(view.visibleSpellEntries(c).map((e) => e.spell.casting?.key)).toEqual(["poison-spray"]);
    view.spellPersonalFilters.learning.add("wizard");
    expect(view.visibleSpellEntries(c).length).toBe(c.spellcasting.spells.length);
    view.spellPersonalFilters.ability.add("wisdom");
    expect(view.visibleSpellEntries(c)).toHaveLength(0);
    view.spellPersonalFilters.ability = new Set(["intelligence"]);
    view.spellPersonalFilters.availability.add("ready");
    view.spellFilter = "0"; view.spellSearch = "veneno";
    expect(view.visibleSpellEntries(c).map((e) => e.spell.casting?.key)).toEqual(["poison-spray"]);
    const html = view.renderSpellsPlay(c);
    expect(html).toContain("Fuente"); expect(html).toContain("Aprendido por"); expect(html).toContain("Disponibilidad");
    expect(html).toContain("sin coincidencias con los otros filtros");
    view.visibleSpellEntries(createCharacter("chr_22222222222222222222222222222222", "Otro personaje", time));
    expect(Object.values(view.spellPersonalFilters).every((set) => set.size === 0)).toBe(true);
  });

  it("binds facet buttons in both views, keeps menus open, clears filters and enforces a single readiness choice", async () => {
    const c = await wizard(), repository = new InMemoryCampaignRepository(), application = new CampaignApplication(repository);
    let snapshot = await application.createCampaign(time); snapshot.campaign.characters[c.id] = c;
    snapshot = await repository.save(snapshot.campaign, { kind: "checksum", checksum: snapshot.checksum });
    const root = document.createElement("div"); document.body.append(root);
    const view = new BrowserApp(root, application, { storageLabel: "test", diceRoller: { roll: async () => ({ kind: "rolled", totals: [10], summary: "ok" }) } }) as unknown as View;
    view.snapshot = snapshot; view.selectedCharacterId = c.id; view.activeSheetTab = "spells"; view.render();
    const button = (facet: string, value: string) => root.querySelector<HTMLButtonElement>(`[data-spell-personal-filter="${facet}"][data-spell-facet-value="${value}"]`)!;
    button("learning", "race").click();
    expect(view.spellPersonalFilters.learning.has("race")).toBe(true);
    expect(root.querySelector<HTMLDetailsElement>('[data-spell-facet-menu="learning"]')!.open).toBe(true);
    expect(root.querySelectorAll(".known-spell")).toHaveLength(1);
    button("availability", "ready").click();
    expect(view.spellPersonalFilters.availability).toEqual(new Set(["ready"]));
    expect(button("availability", "unready").disabled).toBe(true);
    root.querySelector<HTMLButtonElement>("[data-clear-spell-properties]")!.click();
    expect(Object.values(view.spellPersonalFilters).every((set) => set.size === 0)).toBe(true);
    button("availability", "unready").click();
    expect(view.spellPersonalFilters.availability).toEqual(new Set(["unready"]));
    button("availability", "ready").click();
    expect(view.spellPersonalFilters.availability).toEqual(new Set(["ready"]));
    root.querySelector<HTMLButtonElement>('[data-clear-spell-personal-filter="availability"]')!.click();
    expect(view.spellPersonalFilters.availability.size).toBe(0);
    view.sheetMode = "edit"; view.render();
    button("learning", "race").click();
    expect(root.querySelectorAll(".spell-card[data-spell-id]")).toHaveLength(2); // the racial spell and the add-spell form
  });
});
