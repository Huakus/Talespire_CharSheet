import type { Encounter, EncounterCombatant, EncounterCondition } from "./encounter-model";

export class EncounterRevisionConflictError extends Error {
  constructor(expected: number, actual: number) {
    super(`ENCOUNTER_REVISION_CONFLICT:${expected}:${actual}`);
    this.name = "EncounterRevisionConflictError";
  }
}

export interface EncounterCommandOptions {
  expectedRevision: number;
  updatedAt: string;
}

export type EncounterCommand =
  | { kind: "add-combatant"; combatant: EncounterCombatant }
  | { kind: "remove-combatant"; combatantId: string }
  | { kind: "advance-turn" }
  | { kind: "previous-turn" }
  | { kind: "set-active-combatant"; combatantId: string }
  | { kind: "set-initiative"; combatantId: string; initiative: number | null }
  | { kind: "set-visibility"; combatantId: string; visibleToPlayers: boolean }
  | { kind: "set-talespire-creature"; combatantId: string; creatureId: string | null }
  | { kind: "add-condition"; combatantId: string; condition: EncounterCondition }
  | { kind: "remove-condition"; combatantId: string; conditionId: string }
  | {
      kind: "update-combatant-stats";
      combatantId: string;
      name: string;
      armorClass: number;
      hitPoints: EncounterCombatant["hitPoints"];
      conditions: EncounterCombatant["conditions"];
      taleSpireClientId?: string;
    }
  | { kind: "damage"; combatantId: string; amount: number }
  | { kind: "heal"; combatantId: string; amount: number }
  | { kind: "grant-temporary-hit-points"; combatantId: string; amount: number }
  | {
      kind: "synchronize-talespire-initiative";
      items: { creatureId: string; name: string; combatantId: string }[];
      activeCreatureId: string | null;
      roundDelta: number;
    };

export interface EncounterCommandResult {
  encounter: Encounter;
  effects: {
    roundChangedBy: number;
    hitPointsChangedBy: number;
    temporaryHitPointsChangedBy: number;
  };
}

export function orderedCombatants(encounter: Encounter): EncounterCombatant[] {
  return [...encounter.combatants].sort((left, right) => {
    const leftLinked = typeof left.taleSpireCreatureId === "string";
    const rightLinked = typeof right.taleSpireCreatureId === "string";
    if (leftLinked || rightLinked) {
      if (leftLinked !== rightLinked) return leftLinked ? -1 : 1;
      if (left.order !== right.order) return left.order - right.order;
    }
    if (left.initiative === null && right.initiative !== null) return 1;
    if (left.initiative !== null && right.initiative === null) return -1;
    if (left.initiative !== right.initiative) return (right.initiative ?? 0) - (left.initiative ?? 0);
    return left.order - right.order;
  });
}

export function isBloodied(combatant: EncounterCombatant): boolean {
  return combatant.hitPoints.maximum > 0
    && combatant.hitPoints.current > 0
    && combatant.hitPoints.current <= Math.floor(combatant.hitPoints.maximum / 2);
}

export function applyEncounterCommand(
  source: Encounter,
  command: EncounterCommand,
  options: EncounterCommandOptions,
): EncounterCommandResult {
  if (source.revision !== options.expectedRevision) {
    throw new EncounterRevisionConflictError(options.expectedRevision, source.revision);
  }
  const encounter = structuredClone(source);
  const effects = {
    roundChangedBy: 0,
    hitPointsChangedBy: 0,
    temporaryHitPointsChangedBy: 0,
  };

  if (command.kind === "add-combatant") {
    if (encounter.combatants.some((combatant) => combatant.id === command.combatant.id)) {
      throw new Error(`COMBATANT_ALREADY_EXISTS:${command.combatant.id}`);
    }
    encounter.combatants.push(structuredClone(command.combatant));
  } else if (command.kind === "remove-combatant") {
    requireCombatant(encounter, command.combatantId);
    encounter.combatants = encounter.combatants.filter((combatant) => combatant.id !== command.combatantId);
    if (encounter.activeCombatantId === command.combatantId) encounter.activeCombatantId = null;
  } else if (command.kind === "synchronize-talespire-initiative") {
    synchronizeTaleSpireInitiative(encounter, command.items, command.activeCreatureId);
    const roundDelta = Math.max(-1, Math.min(1, Math.trunc(command.roundDelta)));
    const previousRound = encounter.round;
    encounter.round = Math.max(1, encounter.round + roundDelta);
    effects.roundChangedBy = encounter.round - previousRound;
  } else if (command.kind === "advance-turn" || command.kind === "previous-turn") {
    moveTurn(encounter, command.kind === "advance-turn" ? 1 : -1, effects);
  } else if (command.kind === "set-active-combatant") {
    requireCombatant(encounter, command.combatantId);
    encounter.activeCombatantId = command.combatantId;
  } else {
    const combatant = requireCombatant(encounter, command.combatantId);
    if (command.kind === "set-initiative") {
      if (command.initiative !== null && !Number.isSafeInteger(command.initiative)) {
        throw new Error("INVALID_INITIATIVE");
      }
      combatant.initiative = command.initiative;
    } else if (command.kind === "set-visibility") {
      combatant.visibleToPlayers = command.visibleToPlayers;
    } else if (command.kind === "set-talespire-creature") {
      const creatureId = command.creatureId?.trim() || null;
      if (creatureId !== null) {
        encounter.combatants.forEach((candidate) => {
          if (candidate.id !== combatant.id && candidate.taleSpireCreatureId === creatureId) candidate.taleSpireCreatureId = null;
        });
      }
      combatant.taleSpireCreatureId = creatureId;
    } else if (command.kind === "add-condition") {
      if (combatant.conditions.some((condition) => condition.key === command.condition.key)) {
        throw new Error(`CONDITION_ALREADY_EXISTS:${command.condition.key}`);
      }
      combatant.conditions.push(structuredClone(command.condition));
    } else if (command.kind === "remove-condition") {
      if (!combatant.conditions.some((condition) => condition.id === command.conditionId)) {
        throw new Error(`CONDITION_NOT_FOUND:${command.conditionId}`);
      }
      combatant.conditions = combatant.conditions.filter((condition) => condition.id !== command.conditionId);
    } else if (command.kind === "update-combatant-stats") {
      combatant.name = command.name;
      combatant.armorClass = command.armorClass;
      combatant.hitPoints = structuredClone(command.hitPoints);
      combatant.conditions = structuredClone(command.conditions);
      if (command.taleSpireClientId && combatant.kind === "player") combatant.taleSpireClientId = command.taleSpireClientId;
    } else {
      applyHitPointCommand(combatant, command, effects);
    }
  }

  encounter.revision += 1;
  encounter.metadata.updatedAt = options.updatedAt;
  return { encounter, effects };
}

function synchronizeTaleSpireInitiative(
  encounter: Encounter,
  items: { creatureId: string; name: string; combatantId: string }[],
  activeCreatureId: string | null,
): void {
  const linkedByCreatureId = new Map(
    encounter.combatants
      .filter((combatant) => typeof combatant.taleSpireCreatureId === "string")
      .map((combatant) => [combatant.taleSpireCreatureId!, combatant]),
  );
  const unclaimed = new Set(encounter.combatants);
  const synchronized: EncounterCombatant[] = [];
  const synchronizedIds = new Map<string, string>();
  const normalizedName = (value: string): string => value.trim().toLocaleLowerCase();

  for (const [order, item] of items.entries()) {
    let combatant = linkedByCreatureId.get(item.creatureId);
    if (!combatant) {
      combatant = [...unclaimed].find((candidate) => normalizedName(candidate.name) === normalizedName(item.name));
    }
    if (combatant) {
      unclaimed.delete(combatant);
      combatant.taleSpireCreatureId = item.creatureId;
      combatant.order = order;
      synchronized.push(combatant);
      synchronizedIds.set(item.creatureId, combatant.id);
      continue;
    }
    const created: EncounterCombatant = {
      kind: "custom",
      id: item.combatantId,
      taleSpireCreatureId: item.creatureId,
      name: item.name,
      initiative: null,
      order,
      armorClass: null,
      hitPoints: { current: 1, maximum: 1, temporary: 0 },
      conditions: [],
      visibleToPlayers: true,
    };
    synchronized.push(created);
    synchronizedIds.set(item.creatureId, created.id);
  }

  const retained = [...unclaimed]
    .map((combatant, index) => ({
      ...combatant,
      order: synchronized.length + index,
    }));
  encounter.combatants = [...synchronized, ...retained];
  encounter.activeCombatantId = activeCreatureId === null
    ? null
    : synchronizedIds.get(activeCreatureId) ?? null;
}

function requireCombatant(encounter: Encounter, combatantId: string): EncounterCombatant {
  const combatant = encounter.combatants.find((candidate) => candidate.id === combatantId);
  if (!combatant) throw new Error(`COMBATANT_NOT_FOUND:${combatantId}`);
  return combatant;
}

function moveTurn(
  encounter: Encounter,
  direction: 1 | -1,
  effects: EncounterCommandResult["effects"],
): void {
  const ordered = orderedCombatants(encounter);
  if (!ordered.length) {
    encounter.activeCombatantId = null;
    return;
  }
  const currentIndex = ordered.findIndex((combatant) => combatant.id === encounter.activeCombatantId);
  if (currentIndex < 0) {
    encounter.activeCombatantId = ordered[direction === 1 ? 0 : ordered.length - 1]!.id;
    return;
  }
  let nextIndex = currentIndex + direction;
  if (nextIndex >= ordered.length) {
    nextIndex = 0;
    encounter.round += 1;
    effects.roundChangedBy = 1;
  } else if (nextIndex < 0) {
    nextIndex = ordered.length - 1;
    if (encounter.round > 1) {
      encounter.round -= 1;
      effects.roundChangedBy = -1;
    }
  }
  encounter.activeCombatantId = ordered[nextIndex]!.id;
}

function applyHitPointCommand(
  combatant: EncounterCombatant,
  command: Extract<EncounterCommand, { kind: "damage" | "heal" | "grant-temporary-hit-points" }>,
  effects: EncounterCommandResult["effects"],
): void {
  if (!Number.isSafeInteger(command.amount) || command.amount < 0) throw new Error("INVALID_HIT_POINT_AMOUNT");
  const beforeCurrent = combatant.hitPoints.current;
  const beforeTemporary = combatant.hitPoints.temporary;
  if (command.kind === "damage") {
    const absorbed = Math.min(combatant.hitPoints.temporary, command.amount);
    combatant.hitPoints.temporary -= absorbed;
    combatant.hitPoints.current = Math.max(0, combatant.hitPoints.current - (command.amount - absorbed));
  } else if (command.kind === "heal") {
    combatant.hitPoints.current = Math.min(
      combatant.hitPoints.maximum,
      combatant.hitPoints.current + command.amount,
    );
  } else {
    combatant.hitPoints.temporary = Math.max(combatant.hitPoints.temporary, command.amount);
  }
  effects.hitPointsChangedBy = combatant.hitPoints.current - beforeCurrent;
  effects.temporaryHitPointsChangedBy = combatant.hitPoints.temporary - beforeTemporary;
}
