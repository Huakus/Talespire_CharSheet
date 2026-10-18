import { describe, expect, it } from "vitest";
import shadow from "../../docs/v2/equipment-preparation-2026-10-17/reaper-shadow-clarified-definition.json";
import reviewed from "../../docs/v2/equipment-preparation-2026-10-17/used-equipment-reviewed-definitions.json";
import { EquipmentDefinitionDraftSchema } from "../../src/domain/equipment/equipment-definition";
import { applyEquipmentResourceOperation, createEquipmentResourceState, EquipmentResourceStateSchema, equipmentRecoveryLabel, equipmentRollBounds, type EquipmentResourceState, type EquipmentResourceOperation } from "../../src/domain/equipment/equipment-resource-runtime";

const reaper = EquipmentDefinitionDraftSchema.parse(shadow);
const find = (name: string) => EquipmentDefinitionDraftSchema.parse(reviewed.find((d) => d.name === name));
const staff = find("Bastón de marchitamiento"), ring = find("Anillo de almacenamiento de conjuros");
const initial = (definition = reaper, current = 1, instanceId = "copy-one") => createEquipmentResourceState(definition, instanceId, { quantity: 1, resources: Object.fromEntries(definition.resources.map((r) => [r.id, current])) });
const act = (state: EquipmentResourceState, operation: EquipmentResourceOperation, id = "operation-one", definition = reaper) => applyEquipmentResourceOperation(definition, state, { operationId: id, expectedRevision: state.revision, operation });
describe("per-copy equipment resources", () => {
  it("requires exact known counters instead of refilling a legacy copy", () => {
    expect(() => createEquipmentResourceState(reaper, "copy", { quantity: 1, resources: {} })).toThrow("coinciden");
    expect(initial(reaper, 0).resources.marca).toBe(0);
    expect(() => initial(reaper, 2)).toThrow("capacidad");
    expect(() => createEquipmentResourceState(reaper, "copy", { quantity: 2, resources: { marca: 1 } })).toThrow("Separá las copias");
    expect(() => EquipmentResourceStateSchema.parse({ ...initial(), forgottenContents: "must not vanish" })).toThrow();
  });
  it("spends a mark once, leaves other copies alone and does not mutate its inputs", () => {
    const one = initial(), two = initial(reaper, 1, "copy-two"), original = structuredClone(one);
    const used = act(one, { kind: "spend", capabilityId: "nearness-mark" });
    expect(used.state.resources.marca).toBe(0); expect(one).toEqual(original); expect(two.resources.marca).toBe(1);
    expect(() => act(used.state, { kind: "spend", capabilityId: "nearness-mark" }, "second-use")).toThrow("insuficientes");
    expect(used.state.operations).toHaveLength(1);
  });
  it("recovers the mark at dawn without treating a long rest as dawn", () => {
    const empty = initial(reaper, 0);
    const rested = act(empty, { kind: "recover", event: "long-rest" }, "rest").state;
    expect(rested.resources.marca).toBe(0);
    expect(act(rested, { kind: "recover", event: "dawn" }, "dawn").state.resources.marca).toBe(1);
    expect(reaper.capabilities.find((c) => c.id === "whisper-of-finality")!.duration).toContain("descanso largo");
    expect(equipmentRecoveryLabel(reaper.resources[0]!)).toContain("Amanecer");
  });
  it("uses supplied rolls, caps recovery and validates the complete dice result", () => {
    const empty = initial(staff, 2);
    expect(() => act(empty, { kind: "recover", event: "dawn" }, "dawn", staff)).toThrow("1d3");
    for (const amount of [0, 4, 1.5]) expect(() => act(empty, { kind: "recover", event: "dawn", rolls: { cargas: amount } }, "dawn", staff)).toThrow();
    expect(act(empty, { kind: "recover", event: "dawn", rolls: { cargas: 3 } }, "dawn", staff).state.resources.cargas).toBe(3);
    expect(equipmentRollBounds("1d6+1")).toEqual({ minimum: 2, maximum: 7 });
    expect(equipmentRollBounds("2d4-1d6+3")).toEqual({ minimum: -1, maximum: 10 });
  });
  it("retries the same request safely and rejects a reused identifier with another operation", () => {
    const command = { operationId: "click", expectedRevision: 0, operation: { kind: "spend" as const, capabilityId: "nearness-mark" } };
    const once = applyEquipmentResourceOperation(reaper, initial(), command);
    expect(applyEquipmentResourceOperation(reaper, once.state, command)).toEqual({ state: once.state, repeated: true });
    expect(() => applyEquipmentResourceOperation(reaper, once.state, { ...command, operation: { kind: "recover", event: "dawn" } })).toThrow("otra operación");
    expect(() => applyEquipmentResourceOperation(reaper, once.state, { ...command, operationId: "different" })).toThrow("cambió");
  });
  it("never resets the stored contents of a ring as if they were charges", () => {
    let state = initial(ring, 2);
    for (const event of ["short-rest", "long-rest", "dawn"] as const) state = act(state, { kind: "recover", event }, event, ring).state;
    expect(state.resources.almacenamiento).toBe(2);
    expect(equipmentRecoveryLabel(ring.resources[0]!)).toContain("no se recarga");
    const bad = structuredClone(ring); bad.capabilities[0]!.costs = [{ resourceId: "almacenamiento", amount: 1 }];
    expect(() => act(initial(bad, 2), { kind: "spend", capabilityId: bad.capabilities[0]!.id }, "spend", bad)).toThrow("contenido almacenado");
  });
  it("handles duplicate cost entries atomically and never partly spends an invalid action", () => {
    const def = structuredClone(staff); def.capabilities[0]!.costs = [{ resourceId: "cargas", amount: 1 }, { resourceId: "cargas", amount: 2 }];
    const state = initial(def, 2), before = structuredClone(state);
    expect(() => act(state, { kind: "spend", capabilityId: def.capabilities[0]!.id }, "use", def)).toThrow("insuficientes");
    expect(state).toEqual(before);
    const funded = initial(def, 3);
    expect(act(funded, { kind: "spend", capabilityId: def.capabilities[0]!.id }, "use", def).state.resources.cargas).toBe(0);
  });
  it("consumes quantities without modifying resources belonging to another copy", () => {
    const potion = find("Poción de curación"), capability = potion.capabilities[0]!;
    expect(capability.consumeQuantity).toBe(1);
    const state = createEquipmentResourceState(potion, "dose", { quantity: 2, resources: {} });
    const used = act(state, { kind: "spend", capabilityId: capability.id }, "drink", potion).state;
    expect(used.quantity).toBe(1); expect(state.quantity).toBe(2);
    const empty = act(used, { kind: "spend", capabilityId: capability.id }, "drink-again", potion).state;
    expect(empty.quantity).toBe(0);
    expect(() => act(empty, { kind: "spend", capabilityId: capability.id }, "empty", potion)).toThrow("ninguna unidad");
  });
  it("requires an explicit qualification and selection for special timed recovery", () => {
    const boots = find("Botas aladas"), state = initial(boots, 0);
    expect(() => act(state, { kind: "recover", event: "other" }, "time", boots)).toThrow("condición concreta");
    expect(() => act(state, { kind: "recover", event: "other", resourceIds: ["missing"], qualification: "12 horas sin usarlas" }, "time", boots)).toThrow("inexistentes");
    const recovered = act(state, { kind: "recover", event: "other", resourceIds: ["vuelo"], qualification: "Transcurrieron 12 horas sin utilizar las botas" }, "time", boots).state;
    expect(recovered.resources.vuelo).toBe(120);
    expect(act(recovered, { kind: "recover", event: "dawn" }, "dawn", boots).state.resources.vuelo).toBe(120);
    expect(equipmentRecoveryLabel(boots.resources[0]!)).toContain("12 horas");
  });
  it("refuses stale definitions, unknown resource keys and unrelated rolls", () => {
    const state = initial(); const revised = structuredClone(reaper); revised.revision++;
    expect(() => act(state, { kind: "recover", event: "dawn" }, "dawn", revised)).toThrow("revisiones diferentes");
    expect(() => act({ ...state, resources: { marca: 1, extra: 0 } }, { kind: "recover", event: "dawn" })).toThrow("coinciden");
    expect(() => act(state, { kind: "recover", event: "dawn", rolls: { marca: 1 } })).toThrow("no corresponde");
  });
});
