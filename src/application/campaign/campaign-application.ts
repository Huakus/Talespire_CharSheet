import { syncMonkActions } from "../../domain/character/martial-builder";
import { storeEquipmentSpell, castEquipmentStoredSpell } from "../../domain/equipment/equipment-spell-storage";
import { syncInventorySpellGrants } from "../../domain/character/item-spells";
import { spendInventoryItemCharges, consumeInventoryUnit, performLucentCoreAction, useInventoryHealingFeature, type LucentCoreAction } from "../../domain/character/character-inventory";
import { performMartialAction,martialRuntime,syncMartialEffects } from "../../domain/character/martial-play";
import type { MartialAction } from "../../domain/character/martial-model";
import { performSorcererAction } from "../../domain/character/sorcerer-play";
import type { SorcererAction } from "../../domain/character/sorcerer-model";
import { performRangerAction } from "../../domain/character/ranger-play";
import type { RangerAction } from "../../domain/character/ranger-model";
import { performDruidAction } from "../../domain/character/druid-play";
import type { DruidAction } from "../../domain/character/druid-model";
import { performBardAction } from "../../domain/character/bard-play";
import type { BardAction } from "../../domain/character/bard-model";
import { performBarbarianAction } from "../../domain/character/barbarian-play";
import type { BarbarianAction } from "../../domain/character/barbarian-model";
import { performRogueAction } from "../../domain/character/rogue-play";
import type { RogueAction } from "../../domain/character/rogue-model";
import { performClericAction } from "../../domain/character/cleric-play";
import type { ClericAction } from "../../domain/character/cleric-model";
import {
  CampaignV2Schema,
  CharacterV2Schema,
  StableIdSchema,
  type CampaignV2,
  type CharacterV2,
} from "../../domain/character/character-v2";
import {
  CharacterCorePatchSchema,
  CharacterRevisionConflictError,
  editCharacterCore,
  type CharacterCorePatch,
} from "../../domain/character/edit-character";
import {
  applyCharacterResourceCommand,
  type CharacterResourceCommand,
  type ResourceCommandEffects,
} from "../../domain/character/character-resources";
import { createRandomId } from "../../shared/id";
import { createDeterministicId } from "../../shared/id";
import { buildGuidedCharacter, advanceGuidedCharacter, validateGuidedCreation } from "../../domain/character/guided-character-builder";
import { applyWizardAction, type WizardCastOptions } from "../../domain/character/wizard-play";
import { applyWarlockAction } from "../../domain/character/warlock-play";
import type { WarlockAction } from "../../domain/character/warlock-model";
import type { WizardAction } from "../../domain/character/wizard-model";
import { FighterLevelChoiceSchema, type FighterCreationInput, type FighterLevelChoiceInput } from "../../domain/character/character-builder-model";
import {
  CharacterActionDraftSchema,
  removeCharacterAction,
  upsertCharacterAction,
  type CharacterActionDraft,
} from "../../domain/character/character-actions";
import {
  CharacterInventoryItemDraftSchema,
  inventoryItemsCanStack,
  removeInventoryItem,
  resetInventoryCharges,
  setInventoryFeatureActive,
  setInventoryItemAttuned,
  setInventoryItemEquipped,
  upsertInventoryItem,
  useInventoryFeature,
  recoverInventoryItem,
  useInventoryItem,
  type CharacterInventoryItemDraft,
  type CharacterInventoryItemV2,
} from "../../domain/character/character-inventory";
import { abilityModifier, projectInventory, preferredWeaponAbility, projectUpdatedBuilderSpeed } from "../../domain/character/character-projection";
import {
  adjustCurrency,
  type CurrencyDenomination,
} from "../../domain/character/character-currency";
import { createCharacter } from "../../domain/character/create-character";
import { cloneJson, canonicalJsonStringify, type JsonValue } from "../../shared/json";
import {
  CharacterSpellDraftSchema,
  castCharacterSpell,
  removeCharacterSpell,
  setCharacterSpellFavorite,
  setCharacterSpellPrepared,
  setSpellcastingSettings,
  setSpellSlots,
  upsertCharacterSpell,
  type CharacterSpellDraft,
} from "../../domain/character/character-spells";
import {
  CharacterExtraDraftSchema,
  CharacterNoteDraftSchema,
  CharacterNoteGroupDraftSchema,
  CharacterTraitDraftSchema,
  CharacterTraitGroupDraftSchema,
  applyExtraHitPoints,
  addExtraCondition,
  removeExtra,
  removeExtraCondition,
  removeNote,
  removeNoteGroup,
  removeTrait,
  removeTraitGroup,
  setTraitUsed,
  upsertExtra,
  upsertNote,
  upsertNoteGroup,
  upsertTrait,
  upsertTraitGroup,
  type CharacterExtraDraft,
  type CharacterNoteDraft,
  type CharacterNoteGroupDraft,
  type CharacterTraitDraft,
  type CharacterTraitGroupDraft,
} from "../../domain/character/character-content";
import type {
  CampaignRepository,
  CampaignSnapshot,
} from "../ports/campaign-repository";
import { CampaignRepositoryConflictError, loadCampaignVersion } from "../ports/campaign-repository";

export class CampaignNotFoundError extends Error {
  constructor() {
    super("No campaign is currently stored");
    this.name = "CampaignNotFoundError";
  }
}

export class CharacterNotFoundError extends Error {
  constructor(readonly characterId: string) {
    super(`Character ${characterId} was not found`);
    this.name = "CharacterNotFoundError";
  }
}

export class CampaignAlreadyExistsError extends Error {
  constructor() {
    super("A campaign already exists; replacement must be explicit");
    this.name = "CampaignAlreadyExistsError";
  }
}

export interface EditCharacterCommand {
  characterId: string;
  expectedCharacterRevision: number;
  expectedCampaignChecksum: string;
  patch: CharacterCorePatch;
  updatedAt?: string;
}

export interface RestoreCharacterStateCommand {
  characterId: string;
  expectedCharacterRevision: number;
  expectedCampaignChecksum: string;
  character: CharacterV2;
  updatedAt?: string;
}

export interface RestoreCharacterStatesCommand {
  expectedCampaignChecksum: string;
  characters: {
    characterId: string;
    expectedCharacterRevision: number;
    character: CharacterV2;
  }[];
  updatedAt?: string;
}

export type CharacterResourceAction =
  | Exclude<CharacterResourceCommand, { kind: "add-condition" }>
  | {
      kind: "add-condition";
      key: string;
      label: string;
      level: number | null;
    };

export interface ApplyCharacterResourceCommand {
  characterId: string;
  expectedCharacterRevision: number;
  expectedCampaignChecksum: string;
  action: CharacterResourceAction;
  updatedAt?: string;
}

export interface ApplyCharacterResourceResult {
  snapshot: CampaignSnapshot;
  effects: ResourceCommandEffects;
}

export interface UpsertCharacterActionCommand {
  characterId: string;
  actionId?: string;
  expectedCharacterRevision: number;
  expectedCampaignChecksum: string;
  action: CharacterActionDraft;
  updatedAt?: string;
}

export interface RemoveCharacterActionCommand {
  characterId: string;
  actionId: string;
  expectedCharacterRevision: number;
  expectedCampaignChecksum: string;
  updatedAt?: string;
}

export interface UpsertInventoryItemCommand {
  characterId: string;
  itemId?: string;
  expectedCharacterRevision: number;
  expectedCampaignChecksum: string;
  item: CharacterInventoryItemDraft;
  updatedAt?: string;
}

export interface InventoryItemCommand {
  characterId: string;
  itemId: string;
  expectedCharacterRevision: number;
  expectedCampaignChecksum: string;
  updatedAt?: string;
}

export interface InventoryFeatureCommand extends InventoryItemCommand {
  featureId: string;
}
export interface RecoverInventoryItemCommand extends InventoryItemCommand {
  event: string;
  rolled?: number;
}

export interface StoreEquipmentSpellCommand extends InventoryItemCommand {
  spell: import("../../domain/equipment/equipment-spell-storage").StoreSpellInput;
}

export interface SetInventoryFeatureStateCommand extends InventoryFeatureCommand {
  value: boolean;
}

export interface SetInventoryItemStateCommand extends InventoryItemCommand {
  value: boolean;
}

export interface AdjustInventoryItemQuantityCommand extends InventoryItemCommand {
  delta: -1 | 1;
}

export interface ResetInventoryChargesCommand {
  characterId: string;
  reset: string;
  expectedCharacterRevision: number;
  expectedCampaignChecksum: string;
  updatedAt?: string;
}

export interface TransferCurrencyCommand {
  sourceCharacterId: string;
  targetCharacterId: string;
  denomination: CurrencyDenomination;
  quantity: number;
  expectedSourceRevision: number;
  expectedTargetRevision: number;
  expectedCampaignChecksum: string;
  updatedAt?: string;
}

export interface TransferInventoryItemCommand {
  sourceCharacterId: string;
  targetCharacterId: string;
  itemId: string;
  quantity: number;
  expectedSourceRevision: number;
  expectedTargetRevision: number;
  expectedCampaignChecksum: string;
  updatedAt?: string;
}

export interface UpsertCharacterSpellCommand {
  characterId: string;
  spellId?: string;
  expectedCharacterRevision: number;
  expectedCampaignChecksum: string;
  spell: CharacterSpellDraft;
  updatedAt?: string;
}

export interface CharacterSpellCommand {
  characterId: string;
  spellId: string;
  expectedCharacterRevision: number;
  expectedCampaignChecksum: string;
  updatedAt?: string;
}

export interface SetCharacterSpellPreparedCommand extends CharacterSpellCommand {
  prepared: boolean;
}

export interface SetCharacterSpellFavoriteCommand {
  characterId: string;
  spellName: string;
  favorite: boolean;
  expectedCharacterRevision: number;
  expectedCampaignChecksum: string;
  updatedAt?: string;
}

export interface SetSpellSlotsCommand {
  characterId: string;
  level: number;
  maximum: number;
  used: number;
  expectedCharacterRevision: number;
  expectedCampaignChecksum: string;
  updatedAt?: string;
}

export interface CastCharacterSpellCommand extends CharacterSpellCommand, WizardCastOptions {
  slotLevel: number;
}

export interface SetSpellcastingSettingsCommand {
  characterId: string;
  settings: Pick<CampaignV2["characters"][string]["spellcasting"], "ability" | "selectedLevel" | "showUpcast" | "attackBonus" | "saveDcBonus">;
  expectedCharacterRevision: number;
  expectedCampaignChecksum: string;
  updatedAt?: string;
}

export interface CharacterContentCommandBase {
  characterId: string;
  expectedCharacterRevision: number;
  expectedCampaignChecksum: string;
  updatedAt?: string;
}

export interface UpsertTraitGroupCommand extends CharacterContentCommandBase {
  groupId?: string;
  group: CharacterTraitGroupDraft;
}
export interface TraitGroupCommand extends CharacterContentCommandBase { groupId: string }
export interface UpsertTraitCommand extends TraitGroupCommand { traitId?: string; trait: CharacterTraitDraft }
export interface TraitCommand extends TraitGroupCommand { traitId: string }
export interface SetTraitUsedCommand extends TraitCommand { used: number }
export interface UpsertNoteGroupCommand extends CharacterContentCommandBase { groupId?: string; group: CharacterNoteGroupDraft }
export interface NoteGroupCommand extends CharacterContentCommandBase { groupId: string }
export interface UpsertNoteCommand extends NoteGroupCommand { noteId?: string; note: CharacterNoteDraft }
export interface NoteCommand extends NoteGroupCommand { noteId: string }
export interface UpsertExtraCommand extends CharacterContentCommandBase { extraId?: string; extra: CharacterExtraDraft }
export interface ExtraCommand extends CharacterContentCommandBase { extraId: string }
export interface ApplyExtraHitPointsCommand extends ExtraCommand { action: { kind: "damage" | "heal" | "temporary"; amount: number } }
export interface AddExtraConditionCommand extends ExtraCommand { key: string; label: string; level: number | null }
export interface RemoveExtraConditionCommand extends ExtraCommand { conditionId: string }

export interface CreateCharacterCommand {
  name: string;
  expectedCampaignChecksum: string;
  createdAt?: string;
}

export interface DeleteCharacterCommand {
  characterId: string;
  expectedCampaignChecksum: string;
  updatedAt?: string;
}

export interface LinkCharacterMiniatureCommand extends CharacterContentCommandBase {
  miniature: CampaignV2["characters"][string]["taleSpire"];
}

export class CampaignApplication {
  constructor(private readonly repository: CampaignRepository) {}

  loadCampaign(): Promise<CampaignSnapshot | null> {
    return this.repository.load();
  }

  async reconcileInventorySpells(characterId: string): Promise<CampaignSnapshot | null> {
    const current = await this.repository.load();
    const original = current?.campaign.characters[characterId];
    if (!current || !original) return current;
    const character = structuredClone(original);
    await syncInventorySpellGrants(character);
    if (JSON.stringify(character.spellcasting.spells) === JSON.stringify(original.spellcasting.spells)) return current;
    character.revision += 1;
    return this.persistUpdatedCharacter(current, character, current.checksum, new Date().toISOString());
  }

  async createCampaign(createdAt = new Date().toISOString()): Promise<CampaignSnapshot> {
    if (await this.repository.load()) throw new CampaignAlreadyExistsError();
    const campaign = CampaignV2Schema.parse({
      schemaVersion: 2,
      id: await createRandomId("cmp"),
      revision: 0,
      characters: {},
      metadata: { createdAt, updatedAt: createdAt },
    });
    return this.repository.save(campaign, { kind: "empty" });
  }

  async createCharacter(command: CreateCharacterCommand): Promise<CampaignSnapshot> {
    const current = await loadCampaignVersion(this.repository, command.expectedCampaignChecksum);
    if (!current) throw new CampaignNotFoundError();
    this.assertCurrentChecksum(current, command.expectedCampaignChecksum);
    const createdAt = command.createdAt ?? new Date().toISOString();
    const character = createCharacter(await createRandomId("chr"), command.name, createdAt);
    return this.persistUpdatedCharacter(current, character, command.expectedCampaignChecksum, createdAt);
  }

  async createGuidedCharacter(command: { operationId: string; creation: FighterCreationInput; initialLevels?: FighterLevelChoiceInput[]; expectedCampaignChecksum: string; createdAt?: string }): Promise<CampaignSnapshot> {
    const operationId = StableIdSchema.parse(command.operationId);
    const creation = validateGuidedCreation(command.creation);
    const initialLevels = (command.initialLevels ?? []).map((step) => FighterLevelChoiceSchema.parse(step));
    const current = await this.repository.load();
    if (!current) throw new CampaignNotFoundError();
    const id = await createDeterministicId("chr", current.campaign.id, operationId);
    const previous = current.campaign.characters[id];
    if (previous) {
      if (!previous.builder || canonicalJsonStringify(previous.builder.creation as unknown as JsonValue) !== canonicalJsonStringify(creation as unknown as JsonValue)) throw new Error("Esta operación ya creó un personaje con otras elecciones.");
      if (canonicalJsonStringify(previous.builder.levels.slice(0, creation.startingLevel - 1) as unknown as JsonValue) !== canonicalJsonStringify(initialLevels as unknown as JsonValue)) throw new Error("La operación ya se confirmó con otras elecciones de niveles iniciales.");
      return current;
    }
    this.assertCurrentChecksum(current, command.expectedCampaignChecksum);
    const timestamp = command.createdAt ?? new Date().toISOString();
    const character = await buildGuidedCharacter(id, operationId, creation, timestamp, initialLevels);
    return this.persistUpdatedCharacter(current, character, current.checksum, timestamp);
  }

  async advanceGuidedCharacter(command: { characterId: string; choice: FighterLevelChoiceInput; expectedCharacterRevision: number; expectedCampaignChecksum: string; updatedAt?: string }): Promise<CampaignSnapshot> {
    const current = await this.repository.load();
    if (!current) throw new CampaignNotFoundError();
    const character = current.campaign.characters[command.characterId];
    if (!character) throw new CharacterNotFoundError(command.characterId);
    if (character.builder?.levels.some((step) => step.operationId === command.choice.operationId)) {
      await advanceGuidedCharacter(character, command.choice, command.updatedAt ?? character.metadata.updatedAt);
      return current;
    }
    this.assertCurrentChecksum(current, command.expectedCampaignChecksum);
    if (character.revision !== command.expectedCharacterRevision) throw new CharacterRevisionConflictError(command.expectedCharacterRevision, character.revision);
    const timestamp = command.updatedAt ?? new Date().toISOString();
    const updated = await advanceGuidedCharacter(character, command.choice, timestamp);
    return this.persistUpdatedCharacter(current, updated, current.checksum, timestamp);
  }

  async deleteCharacter(command: DeleteCharacterCommand): Promise<CampaignSnapshot> {
    const current = await loadCampaignVersion(this.repository, command.expectedCampaignChecksum);
    if (!current) throw new CampaignNotFoundError();
    this.assertCurrentChecksum(current, command.expectedCampaignChecksum);
    if (!current.campaign.characters[command.characterId]) throw new CharacterNotFoundError(command.characterId);
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const characters = { ...current.campaign.characters };
    delete characters[command.characterId];
    const campaign = CampaignV2Schema.parse({
      ...current.campaign,
      revision: current.campaign.revision + 1,
      characters,
      metadata: { ...current.campaign.metadata, updatedAt },
    });
    return this.repository.save(campaign, { kind: "checksum", checksum: command.expectedCampaignChecksum });
  }

  async linkCharacterMiniature(command: LinkCharacterMiniatureCommand): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) => {
      if (character.revision !== command.expectedCharacterRevision) {
        throw new CharacterRevisionConflictError(command.expectedCharacterRevision, character.revision);
      }
      return CampaignV2Schema.shape.characters.valueType.parse({
        ...character,
        taleSpire: command.miniature,
        revision: character.revision + 1,
        metadata: { ...character.metadata, updatedAt },
      });
    });
  }

  async editCharacter(
    command: EditCharacterCommand,
  ): Promise<CampaignSnapshot> {
    const current = await loadCampaignVersion(this.repository, command.expectedCampaignChecksum);
    if (current === null) {
      throw new CampaignNotFoundError();
    }

    // The repository repeats this check during save. Checking here avoids doing
    // domain work against a snapshot that is already known to be obsolete.
    if (current.checksum !== command.expectedCampaignChecksum) {
      throw new CampaignRepositoryConflictError(
        command.expectedCampaignChecksum,
        current.checksum,
      );
    }

    const character = current.campaign.characters[command.characterId];
    if (character === undefined) {
      throw new CharacterNotFoundError(command.characterId);
    }

    const patch = CharacterCorePatchSchema.parse(command.patch);
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const updatedCharacter = editCharacterCore(character, patch, {
      expectedRevision: command.expectedCharacterRevision,
      updatedAt,
    });
    const campaign: CampaignV2 = CampaignV2Schema.parse({
      ...current.campaign,
      revision: current.campaign.revision + 1,
      characters: {
        ...current.campaign.characters,
        [updatedCharacter.id]: updatedCharacter,
      },
      metadata: {
        ...current.campaign.metadata,
        updatedAt,
      },
    });

    return this.repository.save(campaign, {
      kind: "checksum",
      checksum: command.expectedCampaignChecksum,
    });
  }

  async applyCharacterResource(
    command: ApplyCharacterResourceCommand,
  ): Promise<ApplyCharacterResourceResult> {
    const current = await loadCampaignVersion(this.repository, command.expectedCampaignChecksum);
    if (current === null) throw new CampaignNotFoundError();
    if (current.checksum !== command.expectedCampaignChecksum) {
      throw new CampaignRepositoryConflictError(
        command.expectedCampaignChecksum,
        current.checksum,
      );
    }

    const character = current.campaign.characters[command.characterId];
    if (character === undefined) {
      throw new CharacterNotFoundError(command.characterId);
    }

    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const resourceCommand: CharacterResourceCommand =
      command.action.kind === "add-condition"
        ? {
            ...command.action,
            conditionId: await createRandomId("cnd"),
            addedAt: updatedAt,
          }
        : command.action;
    const result = applyCharacterResourceCommand(character, resourceCommand, {
      expectedRevision: command.expectedCharacterRevision,
      updatedAt,
    });
    const campaign = CampaignV2Schema.parse({
      ...current.campaign,
      revision: current.campaign.revision + 1,
      characters: {
        ...current.campaign.characters,
        [result.character.id]: result.character,
      },
      metadata: { ...current.campaign.metadata, updatedAt },
    });
    const snapshot = await this.repository.save(campaign, {
      kind: "checksum",
      checksum: command.expectedCampaignChecksum,
    });
    return { snapshot, effects: result.effects };
  }

  async restoreCharacterState(command: RestoreCharacterStateCommand): Promise<CampaignSnapshot> {
    const current = await loadCampaignVersion(this.repository, command.expectedCampaignChecksum);
    if (current === null) throw new CampaignNotFoundError();
    this.assertCurrentChecksum(current, command.expectedCampaignChecksum);
    const currentCharacter = current.campaign.characters[command.characterId];
    if (!currentCharacter) throw new CharacterNotFoundError(command.characterId);
    if (currentCharacter.revision !== command.expectedCharacterRevision) {
      throw new CharacterRevisionConflictError(command.expectedCharacterRevision, currentCharacter.revision);
    }
    if (command.character.id !== command.characterId) {
      throw new Error("The restored character id does not match the target character");
    }
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const restoredCharacter = CharacterV2Schema.parse({
      ...cloneJson(command.character),
      revision: currentCharacter.revision + 1,
      metadata: { ...command.character.metadata, updatedAt },
    });
    return this.persistUpdatedCharacter(
      current,
      restoredCharacter,
      command.expectedCampaignChecksum,
      updatedAt,
    );
  }

  async restoreCharacterStates(command: RestoreCharacterStatesCommand): Promise<CampaignSnapshot> {
    const current = await loadCampaignVersion(this.repository, command.expectedCampaignChecksum);
    if (current === null) throw new CampaignNotFoundError();
    this.assertCurrentChecksum(current, command.expectedCampaignChecksum);
    if (!command.characters.length) throw new Error("At least one character state is required");
    const uniqueIds = new Set(command.characters.map((entry) => entry.characterId));
    if (uniqueIds.size !== command.characters.length) throw new Error("Character states must be unique");
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const restored = command.characters.map((entry) => {
      const currentCharacter = current.campaign.characters[entry.characterId];
      if (!currentCharacter) throw new CharacterNotFoundError(entry.characterId);
      if (currentCharacter.revision !== entry.expectedCharacterRevision) {
        throw new CharacterRevisionConflictError(entry.expectedCharacterRevision, currentCharacter.revision);
      }
      if (entry.character.id !== entry.characterId) {
        throw new Error("The restored character id does not match the target character");
      }
      return CharacterV2Schema.parse({
        ...cloneJson(entry.character),
        revision: currentCharacter.revision + 1,
        metadata: { ...entry.character.metadata, updatedAt },
      });
    });
    return this.persistUpdatedCharacters(
      current,
      restored,
      command.expectedCampaignChecksum,
      updatedAt,
    );
  }

  async upsertCharacterAction(
    command: UpsertCharacterActionCommand,
  ): Promise<CampaignSnapshot> {
    const current = await loadCampaignVersion(this.repository, command.expectedCampaignChecksum);
    if (current === null) throw new CampaignNotFoundError();
    this.assertCurrentChecksum(current, command.expectedCampaignChecksum);
    const character = current.campaign.characters[command.characterId];
    if (!character) throw new CharacterNotFoundError(command.characterId);
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const draft = CharacterActionDraftSchema.parse(command.action);
    const updatedCharacter = upsertCharacterAction(
      character,
      {
        ...draft,
        id: command.actionId ?? await createRandomId("act"),
      },
      { expectedRevision: command.expectedCharacterRevision, updatedAt },
    );
    return this.persistUpdatedCharacter(
      current,
      updatedCharacter,
      command.expectedCampaignChecksum,
      updatedAt,
    );
  }

  async removeCharacterAction(
    command: RemoveCharacterActionCommand,
  ): Promise<CampaignSnapshot> {
    const current = await loadCampaignVersion(this.repository, command.expectedCampaignChecksum);
    if (current === null) throw new CampaignNotFoundError();
    this.assertCurrentChecksum(current, command.expectedCampaignChecksum);
    const character = current.campaign.characters[command.characterId];
    if (!character) throw new CharacterNotFoundError(command.characterId);
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const updatedCharacter = removeCharacterAction(
      character,
      command.actionId,
      { expectedRevision: command.expectedCharacterRevision, updatedAt },
    );
    return this.persistUpdatedCharacter(
      current,
      updatedCharacter,
      command.expectedCampaignChecksum,
      updatedAt,
    );
  }

  async upsertInventoryItem(
    command: UpsertInventoryItemCommand,
  ): Promise<CampaignSnapshot> {
    const current = await this.loadCurrentForCharacter(
      command.characterId,
      command.expectedCampaignChecksum,
    );
    const character = current.campaign.characters[command.characterId]!;
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const draft = CharacterInventoryItemDraftSchema.parse(command.item);
    let inventoryCharacter = upsertInventoryItem(
      character,
      { ...draft, id: command.itemId ?? await createRandomId("inv") },
      { expectedRevision: command.expectedCharacterRevision, updatedAt },
    );
    const savedItem = inventoryCharacter.inventory.find((item) => item.id === command.itemId);
    const linkedAction = command.itemId
      ? inventoryCharacter.actions.find((action) => action.inventoryItemId === command.itemId)
      : undefined;
    if (savedItem && linkedAction) {
      inventoryCharacter = CharacterV2Schema.parse({
        ...inventoryCharacter,
        actions: savedItem.weapon === null
          ? inventoryCharacter.actions.filter((action) => action.inventoryItemId !== savedItem.id)
          : inventoryCharacter.actions.map((action) => action.id !== linkedAction.id ? action : {
              ...this.actionFromInventoryItem(inventoryCharacter, savedItem, linkedAction.id),
              order: linkedAction.order,
              rollMode: linkedAction.rollMode,
            }),
      });
    }
    const updatedCharacter = inventoryCharacter;
    return this.persistUpdatedCharacter(
      current,
      updatedCharacter,
      command.expectedCampaignChecksum,
      updatedAt,
    );
  }

  async removeInventoryItem(
    command: InventoryItemCommand,
  ): Promise<CampaignSnapshot> {
    const current = await this.loadCurrentForCharacter(
      command.characterId,
      command.expectedCampaignChecksum,
    );
    const character = current.campaign.characters[command.characterId]!;
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const inventoryCharacter = removeInventoryItem(character, command.itemId, {
      expectedRevision: command.expectedCharacterRevision,
      updatedAt,
    });
    const updatedCharacter = inventoryCharacter;
    return this.persistUpdatedCharacter(
      current,
      updatedCharacter,
      command.expectedCampaignChecksum,
      updatedAt,
    );
  }

  async setInventoryItemEquipped(
    command: SetInventoryItemStateCommand,
  ): Promise<CampaignSnapshot> {
    const current = await this.loadCurrentForCharacter(
      command.characterId,
      command.expectedCampaignChecksum,
    );
    const character = current.campaign.characters[command.characterId]!;
    const item = character.inventory.find((entry) => entry.id === command.itemId);
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    let updatedCharacter = setInventoryItemEquipped(
      character,
      command.itemId,
      command.value,
      {
        expectedRevision: command.expectedCharacterRevision,
        updatedAt,
        ...(command.value && item && item.quantity > 1 ? { splitItemId: await createRandomId("inv") } : {}),
      },
    );
    if (
      command.value &&
      item?.weapon !== null && item?.weapon !== undefined &&
      !updatedCharacter.actions.some((action) => action.inventoryItemId === item.id)
    ) {
      updatedCharacter = upsertCharacterAction(
        updatedCharacter,
        this.actionFromInventoryItem(
          updatedCharacter,
          item,
          await createRandomId("act"),
        ),
        { expectedRevision: updatedCharacter.revision, updatedAt },
      );
    }
    updatedCharacter = this.withProjectedArmorClass(updatedCharacter);
    return this.persistUpdatedCharacter(
      current,
      updatedCharacter,
      command.expectedCampaignChecksum,
      updatedAt,
    );
  }

  async setInventoryItemAttuned(
    command: SetInventoryItemStateCommand,
  ): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) => {
      const updated = setInventoryItemAttuned(character, command.itemId, command.value, {
        expectedRevision: command.expectedCharacterRevision,
        updatedAt,
      });
      return updated;
    });
  }

  async useInventoryItem(
    command: InventoryItemCommand,
  ): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) =>
      useInventoryItem(character, command.itemId, {
        expectedRevision: command.expectedCharacterRevision,
        updatedAt,
      }),
    );
  }

  async useInventoryFeature(
    command: InventoryFeatureCommand,
  ): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) => {
      const updated = useInventoryFeature(character, command.itemId, command.featureId, {
        expectedRevision: command.expectedCharacterRevision,
        updatedAt,
      });
      return updated;
    });
  }

  async recoverInventoryItem(command: RecoverInventoryItemCommand): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) => recoverInventoryItem(character, command.itemId, command.event, command.rolled, { expectedRevision: command.expectedCharacterRevision, updatedAt }));
  }

  async performLucentCoreAction(command: InventoryItemCommand & { action: LucentCoreAction }): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) => performLucentCoreAction(character, command.itemId, command.action, { expectedRevision: command.expectedCharacterRevision, updatedAt }));
  }

  async useInventoryHealingFeature(command: InventoryFeatureCommand & { healing: number }): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command,(character,updatedAt)=>useInventoryHealingFeature(character,command.itemId,command.featureId,command.healing,{expectedRevision:command.expectedCharacterRevision,updatedAt}));
  }

  async spendInventoryItemCharges(command: InventoryItemCommand & { amount: number }): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) => spendInventoryItemCharges(character, command.itemId, command.amount, { expectedRevision: command.expectedCharacterRevision, updatedAt }));
  }

  async consumeInventoryUnit(command: InventoryItemCommand): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) => consumeInventoryUnit(character, command.itemId, { expectedRevision: command.expectedCharacterRevision, updatedAt }));
  }

  async storeEquipmentSpell(command: StoreEquipmentSpellCommand): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) => storeEquipmentSpell(character, command.itemId, command.spell, { expectedRevision: command.expectedCharacterRevision, updatedAt }));
  }

  async castEquipmentStoredSpell(command: InventoryItemCommand & { storedId: string }): Promise<CampaignSnapshot> {
    const id = await createRandomId("cnd");
    return this.applyCharacterMutation(command, (character, updatedAt) => castEquipmentStoredSpell(character, command.itemId, command.storedId, { expectedRevision: command.expectedCharacterRevision, updatedAt, concentrationCondition: { id, key: "concentration", label: "Concentración", level: null, addedAt: updatedAt } }));
  }

  async setInventoryFeatureActive(
    command: SetInventoryFeatureStateCommand,
  ): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) => {
      const updated = setInventoryFeatureActive(
        character,
        command.itemId,
        command.featureId,
        command.value,
        { expectedRevision: command.expectedCharacterRevision, updatedAt },
      );
      return updated;
    });
  }

  async adjustInventoryItemQuantity(
    command: AdjustInventoryItemQuantityCommand,
  ): Promise<CampaignSnapshot> {
    const current = await this.loadCurrentForCharacter(
      command.characterId,
      command.expectedCampaignChecksum,
    );
    const character = current.campaign.characters[command.characterId]!;
    const item = character.inventory.find((entry) => entry.id === command.itemId);
    if (!item) throw new Error("El objeto ya no está en el inventario.");
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    let updatedCharacter: CharacterV2;
    if (item.equipped) {
      if (command.delta < 0) throw new Error("Desequipá el objeto antes de quitar esa unidad.");
      const looseItem = { ...item, equipped: false, attuned: false };
      const stack = character.inventory.find((entry) => inventoryItemsCanStack(looseItem, entry));
      updatedCharacter = upsertInventoryItem(
        character,
        stack
          ? { ...stack, quantity: stack.quantity + 1 }
          : { ...looseItem, id: await createRandomId("inv"), order: character.inventory.length, quantity: 1 },
        { expectedRevision: character.revision, updatedAt },
      );
    } else if (item.quantity + command.delta <= 0) {
      updatedCharacter = removeInventoryItem(character, item.id, {
        expectedRevision: character.revision,
        updatedAt,
      });
    } else {
      updatedCharacter = upsertInventoryItem(character, {
        ...item,
        quantity: item.quantity + command.delta,
      }, {
        expectedRevision: character.revision,
        updatedAt,
      });
    }
    return this.persistUpdatedCharacter(
      current,
      updatedCharacter,
      command.expectedCampaignChecksum,
      updatedAt,
    );
  }

  async resetInventoryCharges(
    command: ResetInventoryChargesCommand,
  ): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) =>
      resetInventoryCharges(character, command.reset, {
        expectedRevision: command.expectedCharacterRevision,
        updatedAt,
      }),
    );
  }

  async transferCurrency(command: TransferCurrencyCommand): Promise<CampaignSnapshot> {
    const current = await loadCampaignVersion(this.repository, command.expectedCampaignChecksum);
    if (current === null) throw new CampaignNotFoundError();
    this.assertCurrentChecksum(current, command.expectedCampaignChecksum);
    if (command.sourceCharacterId === command.targetCharacterId) {
      throw new Error("El personaje de destino debe ser distinto del personaje de origen.");
    }
    if (!Number.isSafeInteger(command.quantity) || command.quantity <= 0) {
      throw new Error("La cantidad a transferir debe ser un entero positivo.");
    }
    const source = current.campaign.characters[command.sourceCharacterId];
    const target = current.campaign.characters[command.targetCharacterId];
    if (!source) throw new CharacterNotFoundError(command.sourceCharacterId);
    if (!target) throw new CharacterNotFoundError(command.targetCharacterId);
    if (source.revision !== command.expectedSourceRevision) {
      throw new CharacterRevisionConflictError(command.expectedSourceRevision, source.revision);
    }
    if (target.revision !== command.expectedTargetRevision) {
      throw new CharacterRevisionConflictError(command.expectedTargetRevision, target.revision);
    }
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const sourceUpdated = CharacterV2Schema.parse({
      ...source,
      currency: adjustCurrency(source.currency, command.denomination, -command.quantity),
      revision: source.revision + 1,
      metadata: { ...source.metadata, updatedAt },
    });
    const targetUpdated = CharacterV2Schema.parse({
      ...target,
      currency: adjustCurrency(target.currency, command.denomination, command.quantity),
      revision: target.revision + 1,
      metadata: { ...target.metadata, updatedAt },
    });
    return this.persistUpdatedCharacters(
      current,
      [sourceUpdated, targetUpdated],
      command.expectedCampaignChecksum,
      updatedAt,
    );
  }

  async transferInventoryItem(command: TransferInventoryItemCommand): Promise<CampaignSnapshot> {
    const current = await loadCampaignVersion(this.repository, command.expectedCampaignChecksum);
    if (current === null) throw new CampaignNotFoundError();
    this.assertCurrentChecksum(current, command.expectedCampaignChecksum);
    if (command.sourceCharacterId === command.targetCharacterId) {
      throw new Error("El personaje de destino debe ser distinto del personaje de origen.");
    }
    if (!Number.isSafeInteger(command.quantity) || command.quantity <= 0) {
      throw new Error("La cantidad a transferir debe ser un entero positivo.");
    }
    const source = current.campaign.characters[command.sourceCharacterId];
    const target = current.campaign.characters[command.targetCharacterId];
    if (!source) throw new CharacterNotFoundError(command.sourceCharacterId);
    if (!target) throw new CharacterNotFoundError(command.targetCharacterId);
    if (source.revision !== command.expectedSourceRevision) {
      throw new CharacterRevisionConflictError(command.expectedSourceRevision, source.revision);
    }
    if (target.revision !== command.expectedTargetRevision) {
      throw new CharacterRevisionConflictError(command.expectedTargetRevision, target.revision);
    }
    const item = source.inventory.find((entry) => entry.id === command.itemId);
    if (!item) throw new Error("El objeto a transferir ya no está en el inventario.");
    if (command.quantity > item.quantity) {
      throw new Error(`Sólo hay ${item.quantity} unidad(es) disponibles de ${item.name}.`);
    }
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const sourceInventory = command.quantity === item.quantity
      ? removeInventoryItem(source, item.id, {
          expectedRevision: source.revision,
          updatedAt,
        })
      : upsertInventoryItem(source, { ...item, quantity: item.quantity - command.quantity }, {
          expectedRevision: source.revision,
          updatedAt,
        });
    const sourceUpdated = sourceInventory;
    const transferredItem: CharacterInventoryItemV2 = {
      ...cloneJson(item),
      id: item.id,
      order: target.inventory.length,
      quantity: command.quantity,
      equipped: false,
      attuned: false,
    };
    const targetStack = target.inventory.find((entry) => inventoryItemsCanStack(transferredItem, entry));
    const targetUpdated = upsertInventoryItem(target, targetStack
      ? { ...targetStack, quantity: targetStack.quantity + command.quantity }
      : { ...transferredItem, id: await createRandomId("inv") }, {
      expectedRevision: target.revision,
      updatedAt,
    });
    return this.persistUpdatedCharacters(
      current,
      [sourceUpdated, targetUpdated],
      command.expectedCampaignChecksum,
      updatedAt,
    );
  }

  async upsertCharacterSpell(
    command: UpsertCharacterSpellCommand,
  ): Promise<CampaignSnapshot> {
    const current = await this.loadCurrentForCharacter(
      command.characterId,
      command.expectedCampaignChecksum,
    );
    const character = current.campaign.characters[command.characterId]!;
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const draft = CharacterSpellDraftSchema.parse(command.spell);
    const updatedCharacter = upsertCharacterSpell(
      character,
      { ...draft, id: command.spellId ?? await createRandomId("spl") },
      { expectedRevision: command.expectedCharacterRevision, updatedAt },
    );
    return this.persistUpdatedCharacter(
      current,
      updatedCharacter,
      command.expectedCampaignChecksum,
      updatedAt,
    );
  }

  async removeCharacterSpell(
    command: CharacterSpellCommand,
  ): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) =>
      removeCharacterSpell(character, command.spellId, {
        expectedRevision: command.expectedCharacterRevision,
        updatedAt,
      }),
    );
  }

  async setCharacterSpellPrepared(
    command: SetCharacterSpellPreparedCommand,
  ): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) =>
      setCharacterSpellPrepared(character, command.spellId, command.prepared, {
        expectedRevision: command.expectedCharacterRevision,
        updatedAt,
      }),
    );
  }

  async setCharacterSpellFavorite(
    command: SetCharacterSpellFavoriteCommand,
  ): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) =>
      setCharacterSpellFavorite(character, command.spellName, command.favorite, {
        expectedRevision: command.expectedCharacterRevision,
        updatedAt,
      }),
    );
  }

  async setSpellSlots(command: SetSpellSlotsCommand): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) =>
      setSpellSlots(
        character,
        command.level,
        { maximum: command.maximum, used: command.used },
        { expectedRevision: command.expectedCharacterRevision, updatedAt },
      ),
    );
  }

  async castCharacterSpell(
    command: CastCharacterSpellCommand,
  ): Promise<CampaignSnapshot> {
    const concentrationConditionId = await createRandomId("cnd");
    return this.applyCharacterMutation(command, (character, updatedAt) =>
      castCharacterSpell(character, command.spellId, command.slotLevel, {
        metamagic: command.metamagic,metamagicConfirmed: command.metamagicConfirmed,twinnedEligible: command.twinnedEligible,elementalResistance: command.elementalResistance,shadowDarkness: command.shadowDarkness,
        mode: command.mode, recoverSlotLevel: command.recoverSlotLevel, createWard: command.createWard, overchannel: command.overchannel,
        expectedRevision: command.expectedCharacterRevision,
        updatedAt,
        concentrationCondition: {
          id: concentrationConditionId,
          key: "concentration",
          label: "Concentración",
          level: null,
          addedAt: updatedAt,
        },
      }),
    );
  }

  async wizardAction(command: CharacterContentCommandBase & { operationId: string; action: WizardAction }): Promise<CampaignSnapshot> {
    const current = await this.repository.load();
    if (!current) throw new CampaignNotFoundError();
    const character = current.campaign.characters[command.characterId];
    if (!character) throw new CharacterNotFoundError(command.characterId);
    const retry = character.spellcasting.wizard?.actions.some((a) => a.operationId === command.operationId);
    if (!retry) this.assertCurrentChecksum(current,command.expectedCampaignChecksum);
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const updated = await applyWizardAction(character,command.action,{ operationId: command.operationId, expectedRevision: command.expectedCharacterRevision, updatedAt });
    return retry ? current : this.persistUpdatedCharacter(current,updated,current.checksum,updatedAt);
  }

  async warlockAction(command: CharacterContentCommandBase & { operationId: string; action: WarlockAction }): Promise<CampaignSnapshot> {
    const current = await this.repository.load();
    if (!current) throw new CampaignNotFoundError();
    const character = current.campaign.characters[command.characterId];
    if (!character) throw new CharacterNotFoundError(command.characterId);
    const retry = character.spellcasting.warlock?.actions.some((a) => a.operationId === command.operationId);
    if (!retry) this.assertCurrentChecksum(current,command.expectedCampaignChecksum);
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const updated = await applyWarlockAction(character,command.action,{ operationId: command.operationId, expectedRevision: command.expectedCharacterRevision, updatedAt });
    return retry ? current : this.persistUpdatedCharacter(current,updated,current.checksum,updatedAt);
  }

  async clericAction(command: CharacterContentCommandBase & { operationId: string; action: ClericAction }): Promise<CampaignSnapshot> {
    const current = await this.repository.load();
    if (!current) throw new CampaignNotFoundError();
    const character = current.campaign.characters[command.characterId];
    if (!character) throw new CharacterNotFoundError(command.characterId);
    const retry = character.spellcasting.cleric?.actions.some((a) => a.operationId === command.operationId);
    if (!retry) this.assertCurrentChecksum(current,command.expectedCampaignChecksum);
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const updated = await performClericAction(character,command.operationId,command.action,{ expectedRevision: command.expectedCharacterRevision, updatedAt });
    return retry ? current : this.persistUpdatedCharacter(current,updated,current.checksum,updatedAt);
  }
  async rogueAction(command: CharacterContentCommandBase & { operationId: string; action: RogueAction }): Promise<CampaignSnapshot> {
    const current = await this.repository.load();
    if (!current) throw new CampaignNotFoundError();
    const character = current.campaign.characters[command.characterId];
    if (!character) throw new CharacterNotFoundError(command.characterId);
    const retry = character.spellcasting.rogue?.actions.some((a) => a.operationId === command.operationId);
    if (!retry) this.assertCurrentChecksum(current,command.expectedCampaignChecksum);
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const updated = await performRogueAction(character,command.operationId,command.action,{ expectedRevision: command.expectedCharacterRevision, updatedAt });
    return retry ? current : this.persistUpdatedCharacter(current,updated,current.checksum,updatedAt);
  }
  async barbarianAction(command: CharacterContentCommandBase & { operationId: string; action: BarbarianAction }): Promise<CampaignSnapshot> {
    const current = await this.repository.load();
    if (!current) throw new CampaignNotFoundError();
    const character = current.campaign.characters[command.characterId];
    if (!character) throw new CharacterNotFoundError(command.characterId);
    const retry = character.spellcasting.barbarian?.actions.some((a) => a.operationId === command.operationId);
    if (!retry) this.assertCurrentChecksum(current,command.expectedCampaignChecksum);
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const updated = await performBarbarianAction(character,command.operationId,command.action,{ expectedRevision: command.expectedCharacterRevision, updatedAt });
    return retry ? current : this.persistUpdatedCharacter(current,updated,current.checksum,updatedAt);
  }

  async bardAction(command: CharacterContentCommandBase & { operationId: string; action: BardAction }): Promise<CampaignSnapshot> {
    const current = await this.repository.load();
    if (!current) throw new CampaignNotFoundError();
    const character = current.campaign.characters[command.characterId];
    if (!character) throw new CharacterNotFoundError(command.characterId);
    const retry = character.spellcasting.bard?.actions.some((a) => a.operationId === command.operationId);
    if (!retry) this.assertCurrentChecksum(current,command.expectedCampaignChecksum);
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const updated = await performBardAction(character,command.operationId,command.action,{ expectedRevision: command.expectedCharacterRevision, updatedAt });
    return retry ? current : this.persistUpdatedCharacter(current,updated,current.checksum,updatedAt);
  }

  async martialAction(command: CharacterContentCommandBase & { operationId: string; action: MartialAction }): Promise<CampaignSnapshot> {
    const current = await this.repository.load();
    if (!current) throw new CampaignNotFoundError();
    const character = current.campaign.characters[command.characterId];
    if (!character) throw new CharacterNotFoundError(command.characterId);
    const retry = martialRuntime(character)?.actions.some((a) => a.operationId === command.operationId);
    if (!retry) this.assertCurrentChecksum(current,command.expectedCampaignChecksum);
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const updated = await performMartialAction(character,command.operationId,command.action,{ expectedRevision: command.expectedCharacterRevision, updatedAt });
    return retry ? current : this.persistUpdatedCharacter(current,updated,current.checksum,updatedAt);
  }
  async sorcererAction(command: CharacterContentCommandBase & { operationId: string; action: SorcererAction }): Promise<CampaignSnapshot> {
    const current = await this.repository.load();
    if (!current) throw new CampaignNotFoundError();
    const character = current.campaign.characters[command.characterId];
    if (!character) throw new CharacterNotFoundError(command.characterId);
    const retry = character.spellcasting.sorcerer?.actions.some((a) => a.operationId === command.operationId);
    if (!retry) this.assertCurrentChecksum(current,command.expectedCampaignChecksum);
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const updated = await performSorcererAction(character,command.operationId,command.action,{ expectedRevision: command.expectedCharacterRevision, updatedAt });
    return retry ? current : this.persistUpdatedCharacter(current,updated,current.checksum,updatedAt);
  }

  async rangerAction(command: CharacterContentCommandBase & { operationId: string; action: RangerAction }): Promise<CampaignSnapshot> {
    const current = await this.repository.load();
    if (!current) throw new CampaignNotFoundError();
    const character = current.campaign.characters[command.characterId];
    if (!character) throw new CharacterNotFoundError(command.characterId);
    const retry = character.spellcasting.ranger?.actions.some((a) => a.operationId === command.operationId);
    if (!retry) this.assertCurrentChecksum(current,command.expectedCampaignChecksum);
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const updated = await performRangerAction(character,command.operationId,command.action,{ expectedRevision: command.expectedCharacterRevision, updatedAt });
    return retry ? current : this.persistUpdatedCharacter(current,updated,current.checksum,updatedAt);
  }

  async druidAction(command: CharacterContentCommandBase & { operationId: string; action: DruidAction }): Promise<CampaignSnapshot> {
    const current = await this.repository.load();
    if (!current) throw new CampaignNotFoundError();
    const character = current.campaign.characters[command.characterId];
    if (!character) throw new CharacterNotFoundError(command.characterId);
    const retry = character.spellcasting.druid?.actions.some((a) => a.operationId === command.operationId);
    if (!retry) this.assertCurrentChecksum(current,command.expectedCampaignChecksum);
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const updated = await performDruidAction(character,command.operationId,command.action,{ expectedRevision: command.expectedCharacterRevision, updatedAt });
    return retry ? current : this.persistUpdatedCharacter(current,updated,current.checksum,updatedAt);
  }

  async setSpellcastingSettings(
    command: SetSpellcastingSettingsCommand,
  ): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) =>
      setSpellcastingSettings(character, command.settings, {
        expectedRevision: command.expectedCharacterRevision,
        updatedAt,
      }),
    );
  }

  async upsertTraitGroup(command: UpsertTraitGroupCommand): Promise<CampaignSnapshot> {
    const groupId = command.groupId ?? await createRandomId("trg");
    return this.applyCharacterMutation(command, (character, updatedAt) => {
      const draft = CharacterTraitGroupDraftSchema.parse(command.group);
      const existingTraits = character.traits.find((group) => group.id === groupId)?.traits ?? [];
      return upsertTraitGroup(character, { ...draft, id: groupId, traits: existingTraits }, {
        expectedRevision: command.expectedCharacterRevision, updatedAt,
      });
    });
  }

  async removeTraitGroup(command: TraitGroupCommand): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) =>
      removeTraitGroup(character, command.groupId, { expectedRevision: command.expectedCharacterRevision, updatedAt }),
    );
  }

  async upsertTrait(command: UpsertTraitCommand): Promise<CampaignSnapshot> {
    const traitId = command.traitId ?? await createRandomId("trt");
    return this.applyCharacterMutation(command, (character, updatedAt) =>
      upsertTrait(character, command.groupId, {
        ...CharacterTraitDraftSchema.parse(command.trait), id: traitId,
      }, { expectedRevision: command.expectedCharacterRevision, updatedAt }),
    );
  }

  async removeTrait(command: TraitCommand): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) =>
      removeTrait(character, command.groupId, command.traitId, { expectedRevision: command.expectedCharacterRevision, updatedAt }),
    );
  }

  async setTraitUsed(command: SetTraitUsedCommand): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) =>
      setTraitUsed(character, command.groupId, command.traitId, command.used, { expectedRevision: command.expectedCharacterRevision, updatedAt }),
    );
  }

  async upsertNoteGroup(command: UpsertNoteGroupCommand): Promise<CampaignSnapshot> {
    const groupId = command.groupId ?? await createRandomId("ntg");
    return this.applyCharacterMutation(command, (character, updatedAt) => {
      const draft = CharacterNoteGroupDraftSchema.parse(command.group);
      const existingNotes = character.notes.find((group) => group.id === groupId)?.notes ?? [];
      return upsertNoteGroup(character, { ...draft, id: groupId, notes: existingNotes }, {
        expectedRevision: command.expectedCharacterRevision, updatedAt,
      });
    });
  }

  async removeNoteGroup(command: NoteGroupCommand): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) =>
      removeNoteGroup(character, command.groupId, { expectedRevision: command.expectedCharacterRevision, updatedAt }),
    );
  }

  async upsertNote(command: UpsertNoteCommand): Promise<CampaignSnapshot> {
    const noteId = command.noteId ?? await createRandomId("not");
    return this.applyCharacterMutation(command, (character, updatedAt) =>
      upsertNote(character, command.groupId, {
        ...CharacterNoteDraftSchema.parse(command.note), id: noteId,
      }, { expectedRevision: command.expectedCharacterRevision, updatedAt }),
    );
  }

  async removeNote(command: NoteCommand): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) =>
      removeNote(character, command.groupId, command.noteId, { expectedRevision: command.expectedCharacterRevision, updatedAt }),
    );
  }

  async upsertExtra(command: UpsertExtraCommand): Promise<CampaignSnapshot> {
    const extraId = command.extraId ?? await createRandomId("ext");
    return this.applyCharacterMutation(command, (character, updatedAt) =>
      upsertExtra(character, { ...CharacterExtraDraftSchema.parse(command.extra), id: extraId }, {
        expectedRevision: command.expectedCharacterRevision, updatedAt,
      }),
    );
  }

  async removeExtra(command: ExtraCommand): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) =>
      removeExtra(character, command.extraId, { expectedRevision: command.expectedCharacterRevision, updatedAt }),
    );
  }

  async applyExtraHitPoints(command: ApplyExtraHitPointsCommand): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) =>
      applyExtraHitPoints(character, command.extraId, command.action, {
        expectedRevision: command.expectedCharacterRevision, updatedAt,
      }),
    );
  }

  async addExtraCondition(command: AddExtraConditionCommand): Promise<CampaignSnapshot> {
    const conditionId = await createRandomId("cnd");
    return this.applyCharacterMutation(command, (character, updatedAt) =>
      addExtraCondition(character, command.extraId, {
        id: conditionId,
        key: command.key,
        label: command.label,
        level: command.level,
        addedAt: updatedAt,
      }, { expectedRevision: command.expectedCharacterRevision, updatedAt }),
    );
  }

  async removeExtraCondition(command: RemoveExtraConditionCommand): Promise<CampaignSnapshot> {
    return this.applyCharacterMutation(command, (character, updatedAt) =>
      removeExtraCondition(character, command.extraId, command.conditionId, {
        expectedRevision: command.expectedCharacterRevision, updatedAt,
      }),
    );
  }

  private async applyCharacterMutation(
    command: {
      characterId: string;
      expectedCampaignChecksum: string;
      updatedAt?: string;
    },
    mutate: (
      character: CampaignV2["characters"][string],
      updatedAt: string,
    ) => CampaignV2["characters"][string],
  ): Promise<CampaignSnapshot> {
    const current = await this.loadCurrentForCharacter(
      command.characterId,
      command.expectedCampaignChecksum,
    );
    const updatedAt = command.updatedAt ?? new Date().toISOString();
    const updatedCharacter = mutate(
      current.campaign.characters[command.characterId]!,
      updatedAt,
    );
    return this.persistUpdatedCharacter(
      current,
      updatedCharacter,
      command.expectedCampaignChecksum,
      updatedAt,
    );
  }

  private async loadCurrentForCharacter(
    characterId: string,
    expectedChecksum: string,
  ): Promise<CampaignSnapshot> {
    const current = await loadCampaignVersion(this.repository, expectedChecksum);
    if (current === null) throw new CampaignNotFoundError();
    this.assertCurrentChecksum(current, expectedChecksum);
    if (!current.campaign.characters[characterId]) {
      throw new CharacterNotFoundError(characterId);
    }
    return current;
  }

  private actionFromInventoryItem(
    character: CampaignV2["characters"][string],
    item: CharacterInventoryItemV2,
    actionId: string,
  ): CampaignV2["characters"][string]["actions"][number] {
    const weapon = item.weapon!;
    const ability = preferredWeaponAbility(character.abilities, item);
    const proficiencyText = character.proficiencies.weapons.join(" ").toLowerCase();
    const proficient = [weapon.category, item.name]
      .filter(Boolean)
      .some((value) => proficiencyText.includes(value.toLowerCase())) ||
      (weapon.category.startsWith("simple") && proficiencyText.includes("armas sencillas")) ||
      (weapon.category.startsWith("martial") && proficiencyText.includes("armas marciales"));
    const reach = weapon.range.toLowerCase().includes("ranged") ? weapon.longRange === null
      ? weapon.normalRange === null ? weapon.range : `${weapon.normalRange} ft`
      : `${weapon.normalRange ?? 0}/${weapon.longRange} ft`
      : item.properties.includes("reach") ? "10 ft" : "5 ft";
    return {
      id: actionId,
      order: character.actions.length,
      name: item.name,
      categories: ["attack", "action"],
      activation: "Acción",
      reach,
      ability,
      proficient,
      attackBonus: weapon.attackBonus,
      damageExpression: weapon.damageExpression,
      damageBonus: (weapon.damageExpression ? abilityModifier(character.abilities[ability]) : 0) + weapon.damageBonus,
      damageType: weapon.damageType,
      weaponType: weapon.category,
      properties: item.properties.join(", "),
      description: item.description,
      inventoryItemId: item.id,
      rollMode: "normal",
    };
  }

  private assertCurrentChecksum(
    current: CampaignSnapshot,
    expectedChecksum: string,
  ): void {
    if (current.checksum !== expectedChecksum) {
      throw new CampaignRepositoryConflictError(expectedChecksum, current.checksum);
    }
  }

  private withProjectedArmorClass(
    character: CampaignV2["characters"][string],
  ): CampaignV2["characters"][string] {
    return CharacterV2Schema.parse({
      ...character,
      combat: {
        ...character.combat,
        armorClass: projectInventory(character).calculatedArmorClass,
      },
    });
  }

  private async persistUpdatedCharacter(
    current: CampaignSnapshot,
    character: CampaignV2["characters"][string],
    expectedChecksum: string,
    updatedAt: string,
  ): Promise<CampaignSnapshot> {
    return this.persistUpdatedCharacters(
      current,
      [character],
      expectedChecksum,
      updatedAt,
    );
  }

  private async persistUpdatedCharacters(
    current: CampaignSnapshot,
    charactersToUpdate: CampaignV2["characters"][string][],
    expectedChecksum: string,
    updatedAt: string,
  ): Promise<CampaignSnapshot> {
    const characters = { ...current.campaign.characters };
    for (const character of charactersToUpdate) {
      const previous = current.campaign.characters[character.id];
      await syncInventorySpellGrants(character);
      syncMartialEffects(character);
      if (character.builder?.classKey === "monk") await syncMonkActions(character,previous ?? null);
      // Compare results instead of guessing which item fields affect AC. This covers
      // Dexterity, removed bonuses, and consumed or transferred items as well.
      characters[character.id] = previous &&
        projectInventory(previous).calculatedArmorClass !== projectInventory(character).calculatedArmorClass
        ? this.withProjectedArmorClass(character)
        : character;
      if (previous && previous.combat.speed === character.combat.speed) {
        characters[character.id] = CharacterV2Schema.parse({ ...characters[character.id], combat: {
          ...characters[character.id]!.combat, speed: projectUpdatedBuilderSpeed(previous, character),
        } });
      }
    }
    const campaign = CampaignV2Schema.parse({
      ...current.campaign,
      revision: current.campaign.revision + 1,
      characters,
      metadata: { ...current.campaign.metadata, updatedAt },
    });
    return this.repository.save(campaign, {
      kind: "checksum",
      checksum: expectedChecksum,
    });
  }
}
