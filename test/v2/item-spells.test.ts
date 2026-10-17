// @vitest-environment happy-dom
import { describe,it,expect } from "vitest";
import { createSpeakWithDeadNecklace,SPEAK_WITH_DEAD_FEATURE } from "../../src/domain/equipment/campaign-magic-items";
import { itemSpellSource,itemSpellState } from "../../src/domain/character/item-spells";
import { castCharacterSpell } from "../../src/domain/character/character-spells";
import { applyCharacterResourceCommand } from "../../src/domain/character/character-resources";
import { CharacterV2Schema,type CharacterV2 } from "../../src/domain/character/character-v2";
import type { CharacterSpellV2 } from "../../src/domain/character/character-spell-model";
import { CharacterSpellV2Schema } from "../../src/domain/character/character-spell-model";
import { createGuidedWizard,advanceGuidedWizard } from "../../src/domain/character/wizard-builder";
import { phbWizardCreation,completeWizardChoice } from "../fixtures/phb-wizard-builder";
import { PHB_SPELLS } from "../../src/domain/character/phb-spells";
import { spellPersonalInfo } from "../../src/ui/spell-casting-filters";
import { spellReady,spellRitualAvailable } from "../../src/ui/wizard-play-panel";
import { BrowserApp } from "../../src/ui/browser-app";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { createTestCampaign } from "../fixtures/native-campaign";
import { fragmentCampaign,assembleCampaign } from "../../src/infrastructure/remote/campaign-fragments";
const time = "2026-10-17T01:00:00.000Z", id = "chr_11111111111111111111111111111111", itemId = "inv_22222222222222222222222222222222", spellId = "spl_33333333333333333333333333333333";
async function equipped() {
  const c = await createGuidedWizard(id,"build_11111111111111111111111111111111",phbWizardCreation(),time);
  const item = createSpeakWithDeadNecklace(itemId,100);item.equipped = item.attuned = true;c.inventory.push(item);
  const definition = PHB_SPELLS["speak-with-dead"]!;
  c.spellcasting.spells.push(CharacterSpellV2Schema.parse({ id: spellId,order: 100,name: definition.name,level: 3,prepared: false,definition,casting: { source: itemSpellSource(itemId,SPEAK_WITH_DEAD_FEATURE),kind: "item",key: "speak-with-dead",ability: "intelligence",level: 3,traitId: null },effect: { active: false,description: "" } }));
  return c;
}
const cast = (c: Awaited<ReturnType<typeof equipped>>,level = 3) => castCharacterSpell(c,spellId,level,{ expectedRevision: c.revision,updatedAt: time });
describe("item spell access",() => {
  it("saves casting and the charge together and preserves their binding in remote fragments",async () => {
    const c = await equipped(),campaign = createTestCampaign({ character: c }),repository = new InMemoryCampaignRepository();
    const snapshot = await repository.save(campaign,{ kind: "empty" });
    const app = new CampaignApplication(repository);
    const saved = await app.castCharacterSpell({ characterId: c.id,spellId,slotLevel: 3,expectedCharacterRevision: c.revision,expectedCampaignChecksum: snapshot.checksum,updatedAt: time });
    const fragments = fragmentCampaign(saved.campaign);
    const rebuilt = assembleCampaign({ campaignRevision: saved.campaign.revision,campaignUpdatedAt: saved.campaign.metadata.updatedAt,updatedBy: null,characters: [{ characterId: c.id,revision: saved.campaign.characters[c.id]!.revision,createdAt: c.metadata.createdAt,updatedAt: time }],fragments: fragments.map((f) => ({ ...f,revision: 1 })) });
    expect(rebuilt.characters[c.id]!.inventory.find((i) => i.id === itemId)!.charges!.current).toBe(0);
    expect(rebuilt.characters[c.id]!.spellcasting.spells.find((s) => s.id === spellId)!.casting!.kind).toBe("item");
    expect(rebuilt.characters[c.id]!.spellcasting.slots).toEqual(c.spellcasting.slots);
  });
  it("consumes the actual item charge once without spending slots, learning or preparing the spell",async () => {
    const c = await equipped(),slots = structuredClone(c.spellcasting.slots),book = [...c.spellcasting.wizard!.book];
    const result = cast(c);
    expect(result.revision).toBe(c.revision+1);
    expect(result.inventory.find((i) => i.id === itemId)!.charges!.current).toBe(0);
    expect(c.inventory.find((i) => i.id === itemId)!.charges!.current).toBe(1);
    expect(result.spellcasting.slots).toEqual(slots);
    expect(result.spellcasting.wizard!.book).toEqual(book);
    expect(result.spellcasting.spells.find((s) => s.id === spellId)!.prepared).toBe(false);
    expect(() => cast(result)).toThrow("cargas");
    expect(() => cast(c,4)).toThrow("nivel indicado");
  });
  it("requires possession, equipment and attunement, and cannot fall back to wizard slots",async () => {
    for (const condition of ["missing","quantity","equipped","attuned","feature"] as const) {
      const c = await equipped(),item = c.inventory.find((i) => i.id === itemId)!;
      if (condition === "missing") c.inventory = c.inventory.filter((i) => i.id !== itemId);
      else if (condition === "quantity") item.quantity = 0;
      else if (condition === "feature") item.features = [];
      else item[condition] = false;
      expect(itemSpellState(c,c.spellcasting.spells.at(-1)!).available).toBe(false);
      expect(spellReady(c.spellcasting.spells.at(-1)!,c)).toBe(false);
      expect(() => cast(c)).toThrow();
    }
  });
  it("recovers after a long rest, survives serialization and level-up and stays separate from the wizard book",async () => {
    let c = cast(await equipped());
    c = applyCharacterResourceCommand(c,{ kind: "short-rest" },{ expectedRevision: c.revision,updatedAt: time }).character;
    expect(itemSpellState(c,c.spellcasting.spells.find((s) => s.id === spellId)!).available).toBe(false);
    c = applyCharacterResourceCommand(c,{ kind: "long-rest" },{ expectedRevision: c.revision,updatedAt: time }).character;
    c = CharacterV2Schema.parse(JSON.parse(JSON.stringify(c)));
    c = await advanceGuidedWizard(c,completeWizardChoice(c,"necromancy"),time);
    const spell = c.spellcasting.spells.find((s) => s.id === spellId)!;
    expect(spellReady(spell,c)).toBe(true);
    expect(spellRitualAvailable(c,spell)).toBe(false);
    expect(spellPersonalInfo(c,spell)).toMatchObject({ learning: "item",preparation: "unnecessary",ability: "intelligence" });
    expect(c.spellcasting.wizard!.book).not.toContain("speak-with-dead");
    expect(() => cast(c)).not.toThrow();
  });
  it("shows the item and its charge in both spell views and availability filters",async () => {
    const c = await equipped(),root = document.createElement("div");
    const app = new BrowserApp(root,new CampaignApplication(new InMemoryCampaignRepository()),{ storageLabel: "test",diceRoller: { roll: async () => ({ kind: "rolled",totals: [1],summary: "ok" }) } }) as unknown as { renderSpellsPlay(character: CharacterV2): string;renderSpellCard(character: CharacterV2,spell: CharacterSpellV2): string;spellLaunchState(character: CharacterV2,spell: CharacterSpellV2): { canLaunch: boolean }; };
    const spell = c.spellcasting.spells.at(-1)!;
    expect(app.spellLaunchState(c,spell).canLaunch).toBe(true);
    const html = app.renderSpellsPlay(c);
    expect(html).toContain("Collar de hablar con los muertos");
    expect(html).toContain("Objeto · nivel 3 · 1/1 cargas");
    expect(app.renderSpellCard(c,spell)).toContain("Objeto · nivel 3 · 1/1 cargas");
    c.inventory.find((i) => i.id === itemId)!.attuned = false;
    expect(app.spellLaunchState(c,spell).canLaunch).toBe(false);
    expect(app.renderSpellsPlay(c)).toContain("Sintonizá el objeto");
  });
});
