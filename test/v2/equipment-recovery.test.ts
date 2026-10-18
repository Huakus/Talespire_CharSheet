import { describe, expect, it } from "vitest";
import { assessEquipmentRecovery, captureEquipmentSource, equipmentSourcePointers, verifyEquipmentSource, type EquipmentRecoveryDecision } from "../../src/domain/equipment/equipment-recovery";
import type { JsonObject } from "../../src/shared/json";

const capturedAt = "2026-10-17T22:00:00.000Z";
const decision = (sourceId: string, pointer: string, destinationPointer = pointer): EquipmentRecoveryDecision => ({
  sourceId, pointer, disposition: "duplicate", destination: { documentId: "new", pointer: destinationPointer }, reason: "Campo conservado y cotejado.", reviewed: true,
});

describe("equipment source preservation and recovery accounting", () => {
  it("archives every original field and separates original content from normalized equipment", async () => {
    const original = { name: "Original", payload: { desc: ["English source", "Segunda línea"], source: "Libro", page: 12, futureField: { active: false, count: 0, empty: [], unknown: null } }, tags: ["eng", "campaña"] };
    const archived = await captureEquipmentSource("shared", "old:key", capturedAt, original);
    expect(archived.raw).toEqual(original);
    original.payload.desc[0] = "Editado después";
    expect((archived.raw.payload as JsonObject).desc).toEqual(["English source", "Segunda línea"]);
    expect(await verifyEquipmentSource(JSON.parse(JSON.stringify(archived)))).toBe(true);
  });

  it("detects modified originals and distinguishes the same row in different scopes", async () => {
    const first = await captureEquipmentSource("shared", "old:key", capturedAt, { payload: { name: "One" } });
    const second = await captureEquipmentSource("ece", "old:key", capturedAt, first.raw);
    expect(first.id).not.toBe(second.id);
    const edited = structuredClone(first); edited.raw.name = "Modified";
    expect(await verifyEquipmentSource(edited)).toBe(false);
    const report = await assessEquipmentRecovery([edited], [], new Map());
    expect(report.complete).toBe(false); expect(report.issues.join(" ")).toContain("original cambió");
  });

  it("rejects non-JSON inputs instead of dropping them during backup", async () => {
    for (const input of [{ fn: () => true }, { missing: undefined }, { date: new Date() }, { notFinite: Infinity }, { sparse: new Array(2) }]) {
      await expect(captureEquipmentSource("shared", "old:key", capturedAt, input)).rejects.toThrow();
    }
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    await expect(captureEquipmentSource("shared", "old:key", capturedAt, cycle)).rejects.toThrow();
  });

  it("hashes object order consistently without losing special JSON property names", async () => {
    const raw = JSON.parse('{"__proto__":{"useful":"keep"},"a/b":{"~key":false},"zero":0,"empty":{}}');
    const source = await captureEquipmentSource("shared", "old:key", capturedAt, raw);
    const reordered = await captureEquipmentSource("shared", "old:key", capturedAt, { empty: {}, zero: 0, "a/b": { "~key": false }, ...JSON.parse('{"__proto__":{"useful":"keep"}}') });
    expect(source.id).toBe(reordered.id);
    expect(Object.hasOwn(source.raw, "__proto__")).toBe(true);
    expect(equipmentSourcePointers(source.raw)).toEqual(expect.arrayContaining(["/__proto__/useful", "/a~1b/~0key", "/zero", "/empty"]));
    const decisions = equipmentSourcePointers(source.raw).map((pointer) => decision(source.id, pointer));
    expect((await assessEquipmentRecovery([source], decisions, new Map([["new", raw]]))).complete).toBe(true);
  });

  it("keeps missing fields pending even if an original is safely backed up", async () => {
    const source = await captureEquipmentSource("shared", "old:key", capturedAt, { name: "One", description: "Useful English rule", empty: [] });
    const report = await assessEquipmentRecovery([source], [decision(source.id, "/name")], new Map([["new", source.raw]]));
    expect(report).toMatchObject({ complete: false, fields: 3, resolved: 1 });
    expect(report.pending).toEqual(expect.arrayContaining([{ sourceId: source.id, pointer: "/description" }, { sourceId: source.id, pointer: "/empty" }]));
  });

  it("checks that a purported duplicate really preserves the value", async () => {
    const source = await captureEquipmentSource("shared", "old:key", capturedAt, { text: "A rule and its limit" });
    const report = await assessEquipmentRecovery([source], [decision(source.id, "/text")], new Map([["new", { text: "A rule" }]]));
    expect(report.complete).toBe(false); expect(report.issues.join(" ")).toContain("información diferente");
  });

  it("requires reviewed reasons and real destinations for translations and personal variants", async () => {
    const source = await captureEquipmentSource("ece", "old:key", capturedAt, { text: "English rule" });
    const translation: EquipmentRecoveryDecision = { ...decision(source.id, "/text"), disposition: "incorporated", reason: "Traducción revisada conservando la condición." };
    const target = new Map([["new", { text: "Regla traducida" }]]);
    expect((await assessEquipmentRecovery([source], [{ ...translation, reviewed: false }], target)).complete).toBe(false);
    expect((await assessEquipmentRecovery([source], [{ ...translation, reason: "  " }], target)).complete).toBe(false);
    expect((await assessEquipmentRecovery([source], [{ ...translation, destination: null }], target)).complete).toBe(false);
    expect((await assessEquipmentRecovery([source], [translation], target)).complete).toBe(true);
    expect((await assessEquipmentRecovery([source], [{ ...translation, disposition: "personal" }], target)).complete).toBe(true);
  });

  it("permits a documented error discard but does not certify an object or authorize deletion", async () => {
    const source = await captureEquipmentSource("shared", "old:key", capturedAt, { badIndex: "wrong" });
    const discarded: EquipmentRecoveryDecision = { sourceId: source.id, pointer: "/badIndex", disposition: "discarded", destination: null, reason: "Índice contradicho por las estadísticas y la fuente cotejada.", reviewed: true };
    expect((await assessEquipmentRecovery([source], [discarded], new Map())).complete).toBe(true);
    expect((await assessEquipmentRecovery([source], [{ ...discarded, destination: { documentId: "new", pointer: "/x" } }], new Map())).complete).toBe(false);
    expect((await assessEquipmentRecovery([], [], new Map())).complete).toBe(false);
  });

  it("rejects missing pointers, duplicate decisions and prototype-chain destinations", async () => {
    const source = await captureEquipmentSource("shared", "old:key", capturedAt, { count: 1 });
    const valid = decision(source.id, "/count");
    expect((await assessEquipmentRecovery([source], [valid, valid], new Map([["new", source.raw]]))).complete).toBe(false);
    expect((await assessEquipmentRecovery([source], [decision(source.id, "/missing")], new Map([["new", source.raw]]))).complete).toBe(false);
    const inherited = Object.create({ count: 1 });
    expect((await assessEquipmentRecovery([source], [valid], new Map([["new", inherited]]))).complete).toBe(false);
    expect((await assessEquipmentRecovery([source], [decision(source.id, "/count", "/bad~escape")], new Map([["new", source.raw]]))).complete).toBe(false);
  });
});
