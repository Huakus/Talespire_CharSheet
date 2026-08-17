import type { CampaignRepository, CampaignSnapshot } from "../ports/campaign-repository";
import { CampaignRepositoryConflictError, loadCampaignVersion } from "../ports/campaign-repository";
import { CampaignV2Schema } from "../../domain/character/character-v2";
import { EncounterSchema, type Encounter, type EncounterCombatant } from "../../domain/encounter/encounter-model";
import { applyEncounterCommand, type EncounterCommand, type EncounterCommandResult } from "../../domain/encounter/encounter";
import { createRandomId } from "../../shared/id";
import { createDeterministicId } from "../../shared/id";
import type { CharacterSummary } from "../../domain/encounter/encounter-protocol";
import { GmWorkspaceSchema, type GmWorkspace, type MiniatureAssociation } from "../../domain/gm/gm-workspace";

export class EncounterNotFoundError extends Error {
  constructor(readonly encounterId: string) {
    super(`ENCOUNTER_NOT_FOUND:${encounterId}`);
    this.name = "EncounterNotFoundError";
  }
}

export interface EncounterMutationCommand {
  encounterId: string;
  expectedEncounterRevision: number;
  expectedCampaignChecksum: string;
  action: EncounterCommand;
  updatedAt?: string;
}

export interface RestoreGmControlStateCommand {
  expectedCampaignChecksum: string;
  encounters: Record<string, Encounter>;
  workspace: GmWorkspace;
  updatedAt?: string;
}

export interface TaleSpireInitiativeQueueInput {
  items: { id: string; name: string; kind: string }[];
  activeItemIndex: number;
  roundDelta?: number;
}

export interface EncounterMiniatureInput {
  creatureId: string;
  displayName: string;
  boardAssetId: string;
}

export interface EncounterMonsterInput {
  definitionId: string;
  name: string;
  armorClass: number;
  hitPoints: number;
}

type NewEncounterCombatant = EncounterCombatant extends infer Combatant
  ? Combatant extends EncounterCombatant
    ? Omit<Combatant, "id" | "order" | "taleSpireCreatureId" | "taleSpireDisplayName" | "taleSpireBoardAssetId"> & {
        taleSpireCreatureId?: string | null;
        taleSpireDisplayName?: string | null;
        taleSpireBoardAssetId?: string | null;
      }
    : never
  : never;

export class EncounterApplication {
  constructor(private readonly repository: CampaignRepository) {}

  loadCampaign(): Promise<CampaignSnapshot | null> {
    return this.repository.load();
  }

  async createEncounter(name: string, expectedCampaignChecksum: string, createdAt = new Date().toISOString()): Promise<CampaignSnapshot> {
    const current = await this.requireCurrent(expectedCampaignChecksum);
    const encounter = EncounterSchema.parse({
      schemaVersion: 1,
      id: await createRandomId("enc"),
      revision: 0,
      name: name.trim(),
      round: 1,
      activeCombatantId: null,
      combatants: [],
      metadata: { createdAt, updatedAt: createdAt },
    });
    return this.persist(current, { ...current.campaign.encounters, [encounter.id]: encounter }, createdAt);
  }

  async deleteEncounter(encounterId: string, expectedCampaignChecksum: string, updatedAt = new Date().toISOString()): Promise<CampaignSnapshot> {
    const current = await this.requireCurrent(expectedCampaignChecksum);
    if (!current.campaign.encounters[encounterId]) throw new EncounterNotFoundError(encounterId);
    const encounters = { ...current.campaign.encounters };
    delete encounters[encounterId];
    return this.persist(current, encounters, updatedAt);
  }

  async restoreGmControlState(command: RestoreGmControlStateCommand): Promise<CampaignSnapshot> {
    const current = await this.requireCurrent(command.expectedCampaignChecksum);
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const encounters = Object.fromEntries(
      Object.entries(command.encounters).map(([id, encounter]) => [id, EncounterSchema.parse(encounter)]),
    );
    const campaign = CampaignV2Schema.parse({
      ...current.campaign,
      revision: current.campaign.revision + 1,
      encounters,
      gm: GmWorkspaceSchema.parse(command.workspace),
      metadata: { ...current.campaign.metadata, updatedAt },
    });
    return this.repository.save(campaign, { kind: "checksum", checksum: current.checksum });
  }

  async addCombatant(
    command: Omit<EncounterMutationCommand, "action"> & {
      combatant: NewEncounterCombatant;
    },
  ): Promise<CampaignSnapshot> {
    const current = await this.requireCurrent(command.expectedCampaignChecksum);
    const encounter = this.requireEncounter(current, command.encounterId);
    const combatant = {
      ...command.combatant,
      id: await createRandomId("cmb"),
      taleSpireCreatureId: command.combatant.taleSpireCreatureId ?? null,
      taleSpireDisplayName: command.combatant.taleSpireDisplayName ?? null,
      taleSpireBoardAssetId: command.combatant.taleSpireBoardAssetId ?? null,
      order: encounter.combatants.reduce((maximum, entry) => Math.max(maximum, entry.order), -1) + 1,
    } as EncounterCombatant;
    return (await this.apply({ ...command, action: { kind: "add-combatant", combatant } })).snapshot;
  }

  async apply(command: EncounterMutationCommand): Promise<{ snapshot: CampaignSnapshot; effects: EncounterCommandResult["effects"] }> {
    const current = await this.requireCurrent(command.expectedCampaignChecksum);
    const encounter = this.requireEncounter(current, command.encounterId);
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const result = applyEncounterCommand(encounter, command.action, {
      expectedRevision: command.expectedEncounterRevision,
      updatedAt,
    });
    const snapshot = await this.persist(
      current,
      { ...current.campaign.encounters, [result.encounter.id]: result.encounter },
      updatedAt,
    );
    return { snapshot, effects: result.effects };
  }

  async updateConnectedPlayer(
    command: Omit<EncounterMutationCommand, "action"> & { combatantId: string; summary: CharacterSummary; taleSpireClientId?: string },
  ): Promise<CampaignSnapshot> {
    const conditions = await Promise.all(command.summary.conditionKeys.map(async (key) => ({
      id: await createDeterministicId("cnd", command.combatantId, key),
      key,
      label: key,
      level: null,
      addedAt: command.updatedAt ?? new Date().toISOString(),
    })));
    return (await this.apply({
      encounterId: command.encounterId,
      expectedEncounterRevision: command.expectedEncounterRevision,
      expectedCampaignChecksum: command.expectedCampaignChecksum,
      ...(command.updatedAt === undefined ? {} : { updatedAt: command.updatedAt }),
      action: {
        kind: "update-combatant-stats",
        combatantId: command.combatantId,
        name: command.summary.name,
        armorClass: command.summary.armorClass,
        hitPoints: {
          current: Math.max(0, Math.min(command.summary.currentHitPoints, command.summary.maximumHitPoints)),
          maximum: command.summary.maximumHitPoints,
          temporary: command.summary.temporaryHitPoints,
        },
        conditions,
        ...(command.taleSpireClientId ? { taleSpireClientId: command.taleSpireClientId } : {}),
      },
    })).snapshot;
  }

  async addCondition(
    command: Omit<EncounterMutationCommand, "action"> & { combatantId: string; key: string; label: string; level?: number | null },
  ): Promise<CampaignSnapshot> {
    const addedAt = command.updatedAt ?? new Date().toISOString();
    return (await this.apply({
      encounterId: command.encounterId,
      expectedEncounterRevision: command.expectedEncounterRevision,
      expectedCampaignChecksum: command.expectedCampaignChecksum,
      ...(command.updatedAt === undefined ? {} : { updatedAt: command.updatedAt }),
      action: {
        kind: "add-condition",
        combatantId: command.combatantId,
        condition: {
          id: await createRandomId("cnd"),
          key: command.key,
          label: command.label,
          level: command.level ?? null,
          addedAt,
        },
      },
    })).snapshot;
  }

  async associateMiniature(command: Omit<EncounterMutationCommand, "action"> & {
    combatantId: string;
    miniature: EncounterMiniatureInput | null;
  }): Promise<CampaignSnapshot> {
    const current = await this.requireCurrent(command.expectedCampaignChecksum);
    const encounter = this.requireEncounter(current, command.encounterId);
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const result = applyEncounterCommand(encounter, {
      kind: "set-talespire-creature",
      combatantId: command.combatantId,
      creatureId: command.miniature?.creatureId ?? null,
      displayName: command.miniature?.displayName ?? null,
      boardAssetId: command.miniature?.boardAssetId ?? null,
    }, { expectedRevision: command.expectedEncounterRevision, updatedAt });
    const associations = { ...(current.campaign.gm.miniatureAssociations ?? {}) };
    if (command.miniature) {
      const combatant = result.encounter.combatants.find((entry) => entry.id === command.combatantId)!;
      associations[command.miniature.creatureId] = this.associationForCombatant(
        combatant,
        command.miniature,
        associations[command.miniature.creatureId],
        updatedAt,
      );
    }
    return this.persistState(
      current,
      { ...current.campaign.encounters, [result.encounter.id]: result.encounter },
      { ...current.campaign.gm, miniatureAssociations: associations },
      updatedAt,
    );
  }

  async associateMonster(command: Omit<EncounterMutationCommand, "action"> & {
    combatantId: string;
    monster: EncounterMonsterInput;
  }): Promise<CampaignSnapshot> {
    const current = await this.requireCurrent(command.expectedCampaignChecksum);
    const encounter = this.requireEncounter(current, command.encounterId);
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const result = applyEncounterCommand(encounter, {
      kind: "set-monster-association",
      combatantId: command.combatantId,
      monster: command.monster,
    }, { expectedRevision: command.expectedEncounterRevision, updatedAt });
    const associations = { ...(current.campaign.gm.miniatureAssociations ?? {}) };
    const combatant = result.encounter.combatants.find((entry) => entry.id === command.combatantId)!;
    if (combatant.taleSpireCreatureId) {
      const existing = associations[combatant.taleSpireCreatureId];
      associations[combatant.taleSpireCreatureId] = this.associationForCombatant(combatant, {
        creatureId: combatant.taleSpireCreatureId,
        displayName: combatant.taleSpireDisplayName ?? existing?.displayName ?? combatant.name,
        boardAssetId: combatant.taleSpireBoardAssetId ?? existing?.boardAssetId ?? "",
      }, existing, updatedAt);
    }
    return this.persistState(
      current,
      { ...current.campaign.encounters, [result.encounter.id]: result.encounter },
      { ...current.campaign.gm, miniatureAssociations: associations },
      updatedAt,
    );
  }

  async forgetMiniatureAssociation(
    creatureId: string,
    expectedCampaignChecksum: string,
    updatedAt = new Date().toISOString(),
  ): Promise<CampaignSnapshot> {
    const current = await this.requireCurrent(expectedCampaignChecksum);
    const associations = { ...(current.campaign.gm.miniatureAssociations ?? {}) };
    if (!associations[creatureId]) return current;
    delete associations[creatureId];
    return this.persistState(
      current,
      current.campaign.encounters,
      { ...current.campaign.gm, miniatureAssociations: associations },
      updatedAt,
    );
  }

  async synchronizeTaleSpireInitiative(
    command: Omit<EncounterMutationCommand, "action"> & { queue: TaleSpireInitiativeQueueInput },
  ): Promise<CampaignSnapshot> {
    const current = await this.requireCurrent(command.expectedCampaignChecksum);
    const items = await Promise.all(command.queue.items
      .filter((item) => item.kind === "creature" && item.id.trim() && item.name.trim())
      .map(async (item) => {
        const creatureId = item.id.trim();
        const association = current.campaign.gm.miniatureAssociations?.[creatureId];
        const character = Object.values(current.campaign.characters).find((entry) =>
          entry.taleSpire?.creatureId === creatureId
          || association?.characterId === entry.id && (!entry.taleSpire || entry.taleSpire.creatureId === creatureId)
        );
        const associatedCombatant: EncounterCombatant | undefined = character ? {
          kind: "player",
          id: await createRandomId("cmb"),
          taleSpireCreatureId: creatureId,
          taleSpireDisplayName: item.name.trim(),
          taleSpireBoardAssetId: character.taleSpire?.boardAssetId ?? association?.boardAssetId ?? null,
          name: character.name,
          initiative: null,
          order: 0,
          armorClass: character.combat.armorClass,
          hitPoints: {
            current: Math.max(0, Math.min(character.combat.hitPoints.current, character.combat.hitPoints.maximum)),
            maximum: character.combat.hitPoints.maximum,
            temporary: character.combat.hitPoints.temporary,
          },
          conditions: structuredClone(character.combat.conditions),
          visibleToPlayers: true,
          characterId: character.id,
          taleSpireClientId: null,
        } : association?.monster ? {
          kind: "monster",
          id: await createRandomId("cmb"),
          taleSpireCreatureId: creatureId,
          taleSpireDisplayName: item.name.trim(),
          taleSpireBoardAssetId: association.boardAssetId || null,
          name: association.monster.name,
          initiative: null,
          order: 0,
          armorClass: association.monster.armorClass,
          hitPoints: { current: association.monster.hitPoints, maximum: association.monster.hitPoints, temporary: 0 },
          conditions: [],
          visibleToPlayers: true,
          monsterDefinitionId: association.monster.definitionId,
        } : undefined;
        return {
          creatureId,
          name: item.name.trim(),
          combatantId: await createRandomId("cmb"),
          ...(associatedCombatant ? { associatedCombatant } : {}),
        };
      }));
    const active = command.queue.items[command.queue.activeItemIndex];
    return (await this.apply({
      encounterId: command.encounterId,
      expectedEncounterRevision: command.expectedEncounterRevision,
      expectedCampaignChecksum: command.expectedCampaignChecksum,
      ...(command.updatedAt === undefined ? {} : { updatedAt: command.updatedAt }),
      action: {
        kind: "synchronize-talespire-initiative",
        items,
        activeCreatureId: active?.kind === "creature" ? active.id : null,
        roundDelta: command.queue.roundDelta ?? 0,
      },
    })).snapshot;
  }

  async synchronizeCharacters(
    expectedCampaignChecksum: string,
    updatedAt = new Date().toISOString(),
    encounterId?: string,
  ): Promise<CampaignSnapshot> {
    const current = await this.requireCurrent(expectedCampaignChecksum);
    let changed = false;
    const encounters = Object.fromEntries(Object.entries(current.campaign.encounters).map(([id, encounter]) => {
      if (encounterId && id !== encounterId) return [id, encounter];
      let encounterChanged = false;
      const combatants = encounter.combatants.map((combatant) => {
        if (combatant.kind !== "player" || !combatant.characterId) return combatant;
        const character = current.campaign.characters[combatant.characterId];
        if (!character) return combatant;
        const next = {
          ...combatant,
          name: character.name,
          armorClass: character.combat.armorClass,
          hitPoints: {
            current: Math.max(0, Math.min(character.combat.hitPoints.current, character.combat.hitPoints.maximum)),
            maximum: character.combat.hitPoints.maximum,
            temporary: character.combat.hitPoints.temporary,
          },
          conditions: structuredClone(character.combat.conditions),
        };
        if (JSON.stringify(next) !== JSON.stringify(combatant)) {
          changed = true;
          encounterChanged = true;
        }
        return next;
      });
      return [id, encounterChanged ? { ...encounter, revision: encounter.revision + 1, combatants, metadata: { ...encounter.metadata, updatedAt } } : encounter];
    }));
    return changed ? this.persist(current, encounters, updatedAt) : current;
  }

  async refreshMonsterDefinition(
    previousDefinitionId: string,
    monster: EncounterMonsterInput,
    expectedCampaignChecksum: string,
    updatedAt = new Date().toISOString(),
  ): Promise<CampaignSnapshot> {
    const current = await this.requireCurrent(expectedCampaignChecksum);
    let changed = false;
    const encounters = Object.fromEntries(Object.entries(current.campaign.encounters).map(([id, encounter]) => {
      let encounterChanged = false;
      const combatants = encounter.combatants.map((combatant) => {
        if (combatant.kind !== "monster" || combatant.monsterDefinitionId !== previousDefinitionId) return combatant;
        encounterChanged = true;
        changed = true;
        const wasAtMaximum = combatant.hitPoints.current === combatant.hitPoints.maximum;
        return {
          ...combatant,
          name: monster.name,
          monsterDefinitionId: monster.definitionId,
          armorClass: monster.armorClass,
          hitPoints: {
            ...combatant.hitPoints,
            current: wasAtMaximum ? monster.hitPoints : Math.min(combatant.hitPoints.current, monster.hitPoints),
            maximum: monster.hitPoints,
          },
        };
      });
      return [id, encounterChanged ? { ...encounter, revision: encounter.revision + 1, combatants, metadata: { ...encounter.metadata, updatedAt } } : encounter];
    }));
    const associations = Object.fromEntries(Object.entries(current.campaign.gm.miniatureAssociations ?? {}).map(([id, association]) => [
      id,
      association.monster?.definitionId === previousDefinitionId
        ? { ...association, monster: structuredClone(monster), updatedAt }
        : association,
    ]));
    if (Object.values(current.campaign.gm.miniatureAssociations ?? {}).some((entry) => entry.monster?.definitionId === previousDefinitionId)) changed = true;
    return changed ? this.persistState(current, encounters, { ...current.campaign.gm, miniatureAssociations: associations }, updatedAt) : current;
  }

  private async requireCurrent(expectedChecksum: string): Promise<CampaignSnapshot> {
    const current = await loadCampaignVersion(this.repository, expectedChecksum);
    if (!current) throw new Error("CAMPAIGN_NOT_FOUND");
    if (current.checksum !== expectedChecksum) throw new CampaignRepositoryConflictError(expectedChecksum, current.checksum);
    return current;
  }

  private requireEncounter(snapshot: CampaignSnapshot, encounterId: string): Encounter {
    const encounter = snapshot.campaign.encounters[encounterId];
    if (!encounter) throw new EncounterNotFoundError(encounterId);
    return encounter;
  }

  private async persist(current: CampaignSnapshot, encounters: Record<string, Encounter>, updatedAt: string): Promise<CampaignSnapshot> {
    return this.persistState(current, encounters, current.campaign.gm, updatedAt);
  }

  private associationForCombatant(
    combatant: EncounterCombatant,
    miniature: EncounterMiniatureInput,
    existing: MiniatureAssociation | undefined,
    updatedAt: string,
  ): MiniatureAssociation {
    return {
      displayName: miniature.displayName,
      boardAssetId: miniature.boardAssetId,
      monster: combatant.kind === "monster" ? {
        definitionId: combatant.monsterDefinitionId,
        name: combatant.name,
        armorClass: combatant.armorClass ?? 0,
        hitPoints: combatant.hitPoints.maximum,
      } : combatant.kind === "player" ? null : existing?.monster ?? null,
      characterId: combatant.kind === "player"
        ? combatant.characterId
        : combatant.kind === "monster" ? null : existing?.characterId ?? null,
      updatedAt,
    };
  }

  private async persistState(
    current: CampaignSnapshot,
    encounters: Record<string, Encounter>,
    gm: GmWorkspace,
    updatedAt: string,
  ): Promise<CampaignSnapshot> {
    const campaign = CampaignV2Schema.parse({
      ...current.campaign,
      revision: current.campaign.revision + 1,
      encounters,
      gm,
      metadata: { ...current.campaign.metadata, updatedAt },
    });
    return this.repository.save(campaign, { kind: "checksum", checksum: current.checksum });
  }
}
