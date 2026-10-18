import { z } from "zod";
import { parseDiceExpression } from "../dice/dice-expression";
import { EquipmentDefinitionDraftSchema, type EquipmentDefinitionDraft } from "./equipment-definition";

const Key = z.string().min(1);
export const EquipmentResourceStateSchema = z.strictObject({
  schemaVersion: z.literal(1), instanceId: Key, definitionId: Key,
  definitionRevision: z.number().int().nonnegative(), revision: z.number().int().nonnegative(),
  quantity: z.number().int().nonnegative(),
  resources: z.record(Key, z.number().int().nonnegative()),
  operations: z.array(z.strictObject({ id: Key, signature: Key })),
}).refine((value) => new Set(value.operations.map((o) => o.id)).size === value.operations.length, "Operaciones repetidas.");
export type EquipmentResourceState = z.infer<typeof EquipmentResourceStateSchema>;
type Resource = EquipmentDefinitionDraft["resources"][number];
export type EquipmentRecoveryEvent = "short-rest" | "long-rest" | "dawn" | "dusk" | "other";
export type EquipmentResourceOperation =
  | { kind: "spend"; capabilityId: string }
  | { kind: "recover"; event: EquipmentRecoveryEvent; rolls?: Record<string, number>; resourceIds?: string[]; qualification?: string };
export interface EquipmentResourceCommand {
  operationId: string; expectedRevision: number; operation: EquipmentResourceOperation;
}
const OperationSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("spend"), capabilityId: Key }),
  z.strictObject({ kind: z.literal("recover"), event: z.enum(["short-rest", "long-rest", "dawn", "dusk", "other"]), rolls: z.record(Key, z.number().int()).optional(), resourceIds: z.array(Key).min(1).optional(), qualification: Key.optional() }),
]);
const CommandSchema = z.strictObject({ operationId: Key, expectedRevision: z.number().int().nonnegative(), operation: OperationSchema });

/** A roll is supplied by the dice service or explicitly confirmed, never silently randomized. */
export function equipmentRollBounds(expression: string): { minimum: number; maximum: number } {
  let minimum = 0, maximum = 0;
  for (const term of parseDiceExpression(expression)) {
    const low = term.count, high = term.sides === null ? term.count : term.count * term.sides;
    minimum += term.sign * (term.sign > 0 ? low : high);
    maximum += term.sign * (term.sign > 0 ? high : low);
  }
  if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum)) throw new Error("La tirada excede el rango admitido.");
  return { minimum, maximum };
}

export function equipmentRecoveryLabel(resource: Resource): string {
  const recovery = resource.recovery;
  if (recovery.kind === "none") return resource.kind === "spell-storage" ? "Se libera al utilizar o retirar el contenido; no se recarga por descanso." : "Sin recuperación.";
  if (recovery.kind === "unknown") return "Recuperación pendiente de cotejo.";
  const event = { "short-rest": "Descanso corto", "long-rest": "Descanso largo", dawn: "Amanecer", dusk: "Anochecer", other: "Evento especial" }[recovery.event];
  const amount = recovery.amount.kind === "full" ? "recuperación completa" : recovery.amount.kind === "fixed" ? `recupera ${recovery.amount.amount}` : `recupera ${recovery.amount.expression}`;
  return `${event}: ${amount}.${recovery.explanation ? ` ${recovery.explanation}` : ""}`;
}

function validateState(definition: EquipmentDefinitionDraft, input: EquipmentResourceState): EquipmentResourceState {
  const state = EquipmentResourceStateSchema.parse(input);
  if (state.definitionId !== definition.id || state.definitionRevision !== definition.revision) throw new Error("La copia y la definición del objeto tienen revisiones diferentes; hay que revisar su correspondencia.");
  const ids = definition.resources.map((r) => r.id);
  if (new Set(ids).size !== ids.length || Object.keys(state.resources).length !== ids.length || Object.keys(state.resources).some((id) => !ids.includes(id))) throw new Error("Los recursos de la copia no coinciden con los de su definición.");
  for (const resource of definition.resources) {
    if (resource.maximum === null || state.resources[resource.id] === undefined || state.resources[resource.id]! > resource.maximum) throw new Error(`${resource.name}: falta un estado conocido o una capacidad válida.`);
  }
  if (definition.resources.length && state.quantity > 1) throw new Error("Separá las copias con recursos individuales antes de usarlas; no se comparte un contador entre varias copias.");
  return state;
}

/** Requires explicit initial counters. Migration must never refill an old item by default. */
export function createEquipmentResourceState(definition: EquipmentDefinitionDraft, instanceId: string, initial: { quantity: number; resources: Record<string, number> }): EquipmentResourceState {
  EquipmentDefinitionDraftSchema.parse(definition);
  return validateState(definition, { schemaVersion: 1, instanceId, definitionId: definition.id, definitionRevision: definition.revision, revision: 0, quantity: initial.quantity, resources: initial.resources, operations: [] });
}

function signature(operation: EquipmentResourceOperation): string {
  return operation.kind === "spend" ? JSON.stringify(operation) : JSON.stringify({ kind: operation.kind, event: operation.event, rolls: Object.entries(operation.rolls ?? {}).sort(([a], [b]) => a.localeCompare(b)), resourceIds: [...(operation.resourceIds ?? [])].sort(), qualification: operation.qualification ?? "" });
}

/** Executes only costs/recovery. Effect resolution and eligibility are separate obligations.
 * No character stats, attunement, stored spells, or temporary penalties are changed here.
 * The caller must atomically save the returned state together with the resolved effects.
 */
export function applyEquipmentResourceOperation(definition: EquipmentDefinitionDraft, input: EquipmentResourceState, command: EquipmentResourceCommand): { state: EquipmentResourceState; repeated: boolean } {
  EquipmentDefinitionDraftSchema.parse(definition); CommandSchema.parse(command);
  const state = validateState(definition, input), operation = command.operation, operationSignature = signature(operation);
  const previous = state.operations.find((o) => o.id === command.operationId);
  if (previous) {
    if (previous.signature !== operationSignature) throw new Error("El identificador ya se utilizó para otra operación.");
    return { state, repeated: true };
  }
  if (state.revision !== command.expectedRevision) throw new Error("El estado del objeto cambió; recargá la copia antes de continuar.");
  const next = structuredClone(state);
  if (operation.kind === "spend") {
    if (state.quantity === 0) throw new Error("No queda ninguna unidad del objeto.");
    const capability = definition.capabilities.find((c) => c.id === operation.capabilityId);
    if (!capability) throw new Error("La capacidad no existe en esta definición.");
    const totals = new Map<string, number>();
    for (const cost of capability.costs) totals.set(cost.resourceId, (totals.get(cost.resourceId) ?? 0) + cost.amount);
    if (state.quantity < capability.consumeQuantity) throw new Error("No hay suficientes unidades para pagar el consumo.");
    for (const [id, amount] of totals) {
      const resource = definition.resources.find((r) => r.id === id);
      if (!resource || resource.kind === "spell-storage") throw new Error("El contenido almacenado necesita una operación propia; no se representa como cargas gastadas.");
      if (state.resources[id]! < amount) throw new Error(`${resource.name}: recursos insuficientes.`);
    }
    for (const [id, amount] of totals) next.resources[id]! -= amount;
    next.quantity -= capability.consumeQuantity;
  } else {
    if (operation.event === "other" && (!operation.resourceIds?.length || !operation.qualification?.trim())) throw new Error("El evento especial requiere seleccionar los recursos y confirmar su condición concreta.");
    if (operation.event !== "other" && (operation.resourceIds || operation.qualification)) throw new Error("Los eventos de descanso y amanecer no admiten condiciones especiales implícitas.");
    const selected = operation.resourceIds ? new Set(operation.resourceIds) : null;
    if (selected && (selected.size !== operation.resourceIds!.length || [...selected].some((id) => !definition.resources.some((r) => r.id === id)))) throw new Error("La selección contiene recursos inexistentes o repetidos.");
    const eligible = definition.resources.filter((resource) => resource.recovery.kind === "event" && resource.recovery.event === operation.event && (!selected || selected.has(resource.id)));
    if (selected && eligible.length !== selected.size) throw new Error("El recurso seleccionado no se recupera con este evento.");
    const rolls = operation.rolls ?? {};
    const needsRoll = eligible.filter((r) => r.recovery.kind === "event" && r.recovery.amount.kind === "roll");
    if (Object.keys(rolls).some((id) => !needsRoll.some((r) => r.id === id))) throw new Error("Se recibió una tirada que no corresponde a este evento.");
    for (const resource of eligible) {
      if (resource.kind === "spell-storage" || resource.kind === "finite") throw new Error(`${resource.name}: esta reserva no admite recarga por eventos.`);
      const recovery = resource.recovery; if (recovery.kind !== "event") continue;
      let recovered: number;
      if (recovery.amount.kind === "full") recovered = resource.maximum!;
      else if (recovery.amount.kind === "fixed") recovered = recovery.amount.amount;
      else {
        const result = rolls[resource.id], bounds = equipmentRollBounds(recovery.amount.expression);
        if (result === undefined || !Number.isSafeInteger(result) || result < bounds.minimum || result > bounds.maximum) throw new Error(`${resource.name}: ingresá una tirada válida de ${recovery.amount.expression}.`);
        recovered = Math.max(0, result);
      }
      next.resources[resource.id] = Math.min(resource.maximum!, state.resources[resource.id]! + recovered);
    }
  }
  next.revision++;
  next.operations.push({ id: command.operationId, signature: operationSignature });
  return { state: validateState(definition, next), repeated: false };
}
