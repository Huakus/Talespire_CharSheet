import { describe, expect, it, vi } from "vitest";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { EncounterApplication } from "../../src/application/encounter/encounter-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { CombatSessionRepository, ACTIVE_COMBAT_ID } from "../../src/infrastructure/persistence/combat-session-repository";
import type { CampaignSnapshot } from "../../src/application/ports/campaign-repository";
import { GmApp } from "../../src/ui/gm-app";

const expected = (s: CampaignSnapshot) => ({ encounterId: ACTIVE_COMBAT_ID, expectedCampaignChecksum: s.checksum, expectedEncounterRevision: s.campaign.encounters[ACTIVE_COMBAT_ID]!.revision });
async function fixture() {
  const source = new InMemoryCampaignRepository(); await new CampaignApplication(source).createCampaign();
  const r1 = new CombatSessionRepository(source), r2 = new CombatSessionRepository(source), a = new EncounterApplication(r1), b = new EncounterApplication(r2);
  let s = (await r1.load())!;
  s = await a.synchronizeTaleSpireInitiative({ ...expected(s), queue: { items: [{ id: "mini", name: "Goblin", kind: "creature" }], activeItemIndex: 0, retainUnlisted: false } });
  const id = s.campaign.encounters[ACTIVE_COMBAT_ID]!.combatants[0]!.id;
  s = await a.associateMonster({ ...expected(s), combatantId: id, monster: { definitionId: "goblin", name: "Goblin", armorClass: 15, hitPoints: 20 } });
  const s1 = (await r1.load())!, s2 = (await r2.load())!;
  return { source, r1, r2, a, b, s1, s2, id };
}
const combat = (s: CampaignSnapshot) => s.campaign.encounters[ACTIVE_COMBAT_ID]!;

describe("two GM combat writers", () => {
  it("does not offer an undo that would erase changes incorporated from another GM", async () => {
    const f = await fixture();
    const view = Object.assign(Object.create(GmApp.prototype), {
      snapshot: f.s1, operations: Promise.resolve(), runtime: {}, application: f.a,
      undoStack: [], redoStack: [], actionLog: [], nextHistoryId: 1,
      notifications: [], nextNotificationId: 1, unreadImportantNotifications: 0,
      selectAvailableEncounter: () => {}, render: () => {},
    });
    await f.b.apply({ ...expected(f.s2), action: { kind: "damage", combatantId: f.id, amount: 3 } });
    await view.execute(async () => (await f.a.apply({ ...expected(f.s1), action: { kind: "damage", combatantId: f.id, amount: 5 } })).snapshot, "Daño");
    expect(combat(view.snapshot).combatants[0]!.hitPoints.current).toBe(12);
    expect(view.undoStack).toEqual([]);
    expect(view.actionLog).toHaveLength(1);
  });
  it("accumulates concurrent damage and applies a repeated operation only once", async () => {
    const f = await fixture();
    const first = { ...expected(f.s1), operationId: "damage-one", action: { kind: "damage" as const, combatantId: f.id, amount: 5 } };
    await Promise.all([f.a.apply(first), f.b.apply({ ...expected(f.s2), operationId: "damage-two", action: { kind: "damage", combatantId: f.id, amount: 3 } })]);
    expect(combat((await f.source.load())!).combatants[0]!.hitPoints.current).toBe(12);
    const retried = await f.a.apply(first);
    expect(combat(retried.snapshot).combatants[0]!.hitPoints.current).toBe(12);
    await expect(f.a.apply({ ...first, action: { ...first.action, amount: 9 } })).rejects.toThrow("otros datos");
  });
  it("does not lose two identical damage amounts to a same-value document merge", async () => {
    const f = await fixture();
    await Promise.all([f.a.apply({ ...expected(f.s1), action: { kind: "damage", combatantId: f.id, amount: 5 } }), f.b.apply({ ...expected(f.s2), action: { kind: "damage", combatantId: f.id, amount: 5 } })]);
    expect(combat((await f.source.load())!).combatants[0]!.hitPoints.current).toBe(10);
  });
  it("fills only missing initiative, including a race against a manual zero", async () => {
    const f = await fixture();
    await f.a.apply({ ...expected(f.s1), action: { kind: "set-initiative", combatantId: f.id, initiative: 0 } });
    const result = await f.b.apply({ ...expected(f.s2), action: { kind: "set-initiative", combatantId: f.id, initiative: 19, onlyIfMissing: true, epoch: combat(f.s2).initiativeEpoch } });
    expect(combat(result.snapshot).combatants[0]!.initiative).toBe(0);
  });
  it("deduplicates automatic initiative across two GMs and ignores results from an older initiative epoch", async () => {
    const f = await fixture();
    const action = { kind: "set-initiative" as const, combatantId: f.id, initiative: 16, onlyIfMissing: true, epoch: combat(f.s1).initiativeEpoch };
    await Promise.all([f.a.apply({ ...expected(f.s1), operationId: "roll-shared", action }), f.b.apply({ ...expected(f.s2), operationId: "roll-shared", action })]);
    let s = (await f.r1.load())!;
    expect(combat(s).combatants[0]!.initiative).toBe(16);
    s = (await f.a.apply({ ...expected(s), action: { kind: "clear-initiatives" } })).snapshot;
    s = (await f.a.apply({ ...expected(s), action })).snapshot;
    expect(combat(s).combatants[0]!.initiative).toBeNull();
  });
  it("does not count the same native queue transition twice", async () => {
    const f = await fixture(), save = vi.spyOn(f.source, "save");
    const queue = { items: [{ id: "mini", name: "Goblin", kind: "creature" }], activeItemIndex: -1, roundDelta: 1, retainUnlisted: false };
    await Promise.all([f.a.synchronizeTaleSpireInitiative({ ...expected(f.s1), queue }), f.b.synchronizeTaleSpireInitiative({ ...expected(f.s2), queue })]);
    expect(combat((await f.source.load())!).round).toBe(2);
    expect(combat((await f.source.load())!).revision).toBe(combat(f.s1).revision + 1);
    expect(save).toHaveBeenCalled();
  });
  it("preserves a character edit outside combat while saving combat damage", async () => {
    const f = await fixture();
    await new CampaignApplication(f.source).createCharacter({ name: "Otro personaje", expectedCampaignChecksum: (await f.source.load())!.checksum });
    await f.a.apply({ ...expected(f.s1), action: { kind: "damage", combatantId: f.id, amount: 2 } });
    const latest = (await f.source.load())!;
    expect(Object.values(latest.campaign.characters).map(c => c.name)).toEqual(["Otro personaje"]);
    expect(combat(latest).combatants[0]!.hitPoints.current).toBe(18);
  });
});
