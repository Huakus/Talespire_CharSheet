import { describe, it, expect } from "vitest";
import { PHB_SPELLS } from "../../src/domain/character/phb-spells";
import type { CharacterSpellV2,SpellDefinition } from "../../src/domain/character/character-spell-model";
import { isOldSpell, resolveLearnedSpell, spellSourceTag } from "../../src/domain/spells/spell-source";
import { localizedCharacter,localizedSpellDefinition } from "../../src/ui/localized-spells";
import { createCharacter } from "../../src/domain/character/create-character";
import { BrowserApp } from "../../src/ui/browser-app";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { GmToolsPanel } from "../../src/ui/gm-tools-panel";

function learned(definition: SpellDefinition): CharacterSpellV2 {
  return { id: "spl_11111111111111111111111111111111",order: 0,name: definition.name,level: definition.level,definition,prepared: true,casting: null,effect: { description: "",active: false } };
}
function retained(definition: SpellDefinition, id="old:spell:test"): SpellDefinition {
  return { ...definition,catalog: { contentKey: id,origin: "imported",tags: ["old"],revision: 0 } };
}
describe("single-source catalog and retained character versions",() => {
  it("classifies all 456 tutorial definitions with exactly one stable source",() => {
    const definitions = Object.values(PHB_SPELLS);
    expect(definitions).toHaveLength(456);
    expect(definitions.filter((s) => spellSourceTag(s)==="manual_jugador")).toHaveLength(361);
    expect(definitions.filter((s) => spellSourceTag(s)==="xanathar")).toHaveLength(95);
    expect(new Set(definitions.map((s) => s.catalog!.contentKey)).size).toBe(456);
    for (const s of definitions) { expect(s.catalog!.tags).toHaveLength(1);expect(s.year).toBe("2014"); }
    expect(PHB_SPELLS.longstrider).toMatchObject({ duration: "1 hora",concentration: false });
    expect(PHB_SPELLS.shillelagh!.duration).toBe("1 minuto");
    expect(PHB_SPELLS["circle-of-power"]!.concentration).toBe(true);
  });
  it("matches snapshots by complete rules, preserving different versions with the same name",() => {
    const current = PHB_SPELLS["fire-bolt"]!;
    const first = { ...current,description: "Primera versión",damageExpression: "1d6",catalog: null };
    const second = { ...current,description: "Segunda versión",damageExpression: "2d8",catalog: null };
    const original = learned(second),before=JSON.stringify(original);
    const resolved=resolveLearnedSpell(original,[current,retained(first,"old:1"),retained(second,"old:2")]);
    expect(resolved.definition).toMatchObject({ description: second.description,damageExpression: "2d8",catalog: { contentKey: "old:2",tags: ["old"] } });
    expect(JSON.stringify(original)).toBe(before);
    expect(isOldSpell(resolveLearnedSpell(learned({ ...current,catalog: null }),[current,retained(first)]).definition)).toBe(false);
  });
  it("does not translate or replace old English/2024 text, including an early tutorial snapshot",() => {
    const previous={ ...PHB_SPELLS["phantasmal-force"]!,name: "Phantasmal Force",description: "Original 2024 text",damageExpression: "2d8",year: "2024",catalog: null };
    const spell=learned(previous);spell.casting={ source: "builder:wizard",kind: "wizard",ability: "intelligence",key: "phantasmal-force",level: 2,traitId: null };
    const character=createCharacter("chr_11111111111111111111111111111111","Prueba","2026-10-16T00:00:00Z");character.spellcasting.spells=[spell];
    const rendered=localizedCharacter(character,[retained(previous)]);
    expect(rendered.spellcasting.spells[0]!.definition).toMatchObject({ name: "Phantasmal Force",year: "2024",description: previous.description,damageExpression: "2d8",catalog: { tags: ["old"] } });
    expect(localizedSpellDefinition(retained(previous)).description).toBe(previous.description);
    expect(character.spellcasting.spells[0]!.definition!.catalog).toBeNull();
  });
  it("retains a custom snapshot and fills an absent definition from its retained catalog",() => {
    const custom={ ...PHB_SPELLS.light!,name: "Transferir Eco",catalog: { contentKey: "imported:spell:eco",origin: "imported" as const,tags: ["custom"],revision: 1 } };
    expect(localizedSpellDefinition(custom)).toBe(custom);
    expect(resolveLearnedSpell(learned({ ...custom,description: "Versión de la ficha",catalog: null }),[custom]).definition).toMatchObject({ description: "Versión de la ficha",catalog: { tags: ["custom"] } });
    expect(resolveLearnedSpell({ ...learned(custom),definition: null },[custom]).definition).toBe(custom);
  });
  it("shows old on learned spells and excludes old from new catalog choices",() => {
    const current=PHB_SPELLS["fire-bolt"]!,previous=retained({ ...current,description: "Texto anterior",catalog: null });
    const app=new BrowserApp({} as HTMLElement,new CampaignApplication(new InMemoryCampaignRepository()),{ storageLabel: "test",diceRoller: { roll: async()=>({ kind: "rolled",summary: "ok",totals: [10] }) } });
    const view=app as unknown as { customSpells: SpellDefinition[];includeUnknownSpells: boolean;spellCatalog(): SpellDefinition[];spellSourceEntries(c: ReturnType<typeof createCharacter>): { spell: CharacterSpellV2;known: boolean }[];spellTags(d: SpellDefinition): string[] };
    view.customSpells=[previous];view.includeUnknownSpells=true;
    const c=createCharacter("chr_11111111111111111111111111111111","Prueba","2026-10-16T00:00:00Z");c.spellcasting.spells=[learned({ ...previous,catalog: null })];
    expect(view.spellCatalog().some(isOldSpell)).toBe(false);
    const entries=view.spellSourceEntries(c),known=entries.find((e)=>e.known)!;
    expect(known.spell.definition!.description).toBe("Texto anterior");
    expect(view.spellTags(known.spell.definition!)).toEqual(["old"]);
    expect(entries.filter((e)=>!e.known).some((e)=>isOldSpell(e.spell.definition))).toBe(false);
  });
  it("makes old cards read-only and does not offer arbitrary source tags in the editor",async()=>{
    const old=retained({ ...PHB_SPELLS.light!,name: "Luz anterior" });
    const panel=new GmToolsPanel({} as HTMLElement,{ loadGmContent: async()=>({ spells:[old],equipment:[],monsters:[],shops:[],checklist:[] }) },()=>undefined,()=>undefined,()=>undefined);
    await panel.load();
    const view=panel as unknown as { renderSpellCard(s: SpellDefinition):string;renderSpellForm(s: SpellDefinition|null):string };
    const html=view.renderSpellCard(old);
    expect(html).toContain("Pendiente de reemplazo");expect(html).not.toContain("data-gm-edit");expect(html).not.toContain("data-gm-delete");
    expect(view.renderSpellForm(null)).toContain("Origen: Custom");expect(view.renderSpellForm(null)).not.toContain('name="catalogTags"');
  });
});
