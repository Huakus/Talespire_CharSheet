import { afterEach, describe, expect, it, vi } from "vitest";
import { TaleSpirePlayerCollaboration } from "../../src/infrastructure/talespire/talespire-player-collaboration";
import { TaleSpireGmCollaboration } from "../../src/infrastructure/talespire/talespire-gm-collaboration";
import { createGmProtocolMessage } from "../../src/domain/encounter/encounter-protocol";
import { TaleSpireDiceRoller } from "../../src/infrastructure/talespire/talespire-dice-roller";

const characterId = "chr_11111111111111111111111111111111";
afterEach(() => vi.useRealTimers());
async function player(sent: string[]) {
  const c = new TaleSpirePlayerCollaboration({ sync: { send: async message => { sent.push(message); } }, clients: {
    whoAmI: async () => ({ id: "player" }), getClientsInThisBoard: async () => [{ id: "player" }, { id: "gm" }],
    getMoreInfo: async () => [{ id: "gm", clientMode: "gm" }],
  } });
  await c.initialize(); return c;
}
describe("acknowledged initiative delivery", () => {
  it("retries with the same message identity and accepts only the selected GM's acknowledgement", async () => {
    vi.useFakeTimers(); const sent: string[] = [], c = await player(sent), states: unknown[] = [];
    c.subscribeInitiativeDelivery(s => states.push(s));
    const delivery = c.sendInitiative(17, characterId, { rollId: "roll-one", epoch: 3, encounterId: "enc_00000000000000000000000000000001" });
    await vi.advanceTimersByTimeAsync(1501);
    expect(sent).toHaveLength(2); expect(sent[0]).toBe(sent[1]); expect(sent[0]!.length).toBeLessThanOrEqual(500);
    const receipt = createGmProtocolMessage({ type: "gm/initiative-received", requestId: JSON.parse(sent[0]!).messageId });
    await c.handleSyncEvent({ payload: { fromClient: { id: "stranger" }, str: JSON.stringify(receipt) } });
    expect(states).toHaveLength(0);
    await c.handleSyncEvent({ payload: { fromClient: { id: "gm" }, str: JSON.stringify(receipt) } });
    await delivery; await vi.advanceTimersByTimeAsync(30_000);
    expect(states).toEqual([expect.objectContaining({ kind: "success" })]); expect(sent).toHaveLength(2);
  });
  it("reports failed delivery instead of claiming the result was assigned", async () => {
    vi.useFakeTimers(); const sent: string[] = [], c = await player(sent), states: unknown[] = [];
    c.subscribeInitiativeDelivery(s => states.push(s));
    const failure = c.sendInitiative(12, characterId, { rollId: "lost" }).catch(e => e);
    await vi.runAllTimersAsync();
    expect(await failure).toBeInstanceOf(Error); expect(sent).toHaveLength(4);
    expect(states).toEqual([expect.objectContaining({ kind: "error" })]);
  });
  it("acknowledges only after the GM confirms persistence or preservation of an existing initiative", async () => {
    const sent: string[] = [];
    const gm = new TaleSpireGmCollaboration({ sync: { send: async message => { sent.push(message); }, getClientsConnected: async () => [] }, clients: {
      whoAmI: async () => ({ id: "gm" }), getClientsInThisBoard: async () => [], getMoreInfo: async () => [],
    } });
    await gm.initialize(); const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true); gm.subscribeInitiative(save);
    const message = createGmProtocolMessage({ type: "player/set-character-initiative", characterId, initiative: 19, rollId: "pending", epoch: 2 });
    const event = { payload: { fromClient: { id: "player" }, str: JSON.stringify(message) } };
    await gm.handleSyncEvent(event); expect(sent).toHaveLength(0);
    await gm.handleSyncEvent(event); expect(JSON.parse(sent[0]!).payload).toEqual({ type: "gm/initiative-received", requestId: message.messageId });
  });
});

describe("experimental GM result presentation", () => {
  it("publishes only a rollValue total while keeping the full breakdown in the GM event", async () => {
    const publish = vi.fn(), listeners: Array<{ detail?: string }> = [];
    const tray = vi.fn(async (_rolls: { name: string; roll: string }[], _quiet: boolean) => "native-roll");
    const roller = new TaleSpireDiceRoller({ putDiceInTray: tray, evaluateDiceResultsGroup: async () => 19, sendDiceResult: publish });
    roller.subscribe(r => listeners.push(r));
    await roller.roll({ name: "Espada +7", expressions: ["1d20+7"], mode: "normal", visibility: "total" });
    await roller.handleRollEvent({ kind: "rollResults", payload: { rollId: "native-roll", resultsGroups: [{ name: "Espada", result: { operator: "+", operands: [{ kind: "d20", results: [12] }, { value: 7 }] } }] } });
    expect(publish).toHaveBeenCalledWith([{ name: "Espada", result: { value: 19 } }], "native-roll");
    expect(tray.mock.calls[0]![0][0]!.name).toBe("Espada");
    expect(listeners[0]!.detail).toContain("d20[12] + 7");
  });
  it("never republishes a native GM-only result to the public result API", async () => {
    const publish = vi.fn(), received = vi.fn();
    const roller = new TaleSpireDiceRoller({ putDiceInTray: async () => "private", evaluateDiceResultsGroup: async () => 10, sendDiceResult: publish });
    roller.subscribe(received); await roller.roll({ name: "Secreto", expressions: ["1d20"], mode: "normal" });
    await roller.handleRollEvent({ kind: "rollResults", payload: { rollId: "private", gmOnly: true, resultsGroups: [{ result: { kind: "d20", results: [10] } }] } });
    expect(received).toHaveBeenCalled(); expect(publish).not.toHaveBeenCalled();
  });
});
