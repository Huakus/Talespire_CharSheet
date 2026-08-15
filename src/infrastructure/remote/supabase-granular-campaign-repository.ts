import type {
  CampaignRepository,
  CampaignSnapshot,
  SaveExpectation,
} from "../../application/ports/campaign-repository";
import {
  CampaignRepositoryConflictError,
  CampaignRepositoryCorruptionError,
} from "../../application/ports/campaign-repository";
import type { CampaignV2 } from "../../domain/character/character-v2";
import { createCampaignSnapshot } from "../persistence/campaign-snapshot";
import {
  assembleCampaign,
  diffCampaignFragments,
  type CampaignFragmentChange,
  type CharacterVersionChange,
  type RemoteCampaignFragment,
  type RemoteCampaignFragmentState,
} from "./campaign-fragments";
import { mergeCampaignChanges } from "./campaign-three-way-merge";
import {
  RemoteCampaignFragmentConflictError,
  SupabaseCampaignFragmentClient,
  type RemoteCampaignFragmentSaveResult,
} from "./supabase-campaign-fragment-client";

interface StoredVersion {
  snapshot: CampaignSnapshot;
  state: RemoteCampaignFragmentState;
}

function copyState(state: RemoteCampaignFragmentState): RemoteCampaignFragmentState {
  return structuredClone(state);
}

function fragmentIdentity(value: { kind: string; parentId: string; entityId: string }): string {
  return `${value.kind}\u0000${value.parentId}\u0000${value.entityId}`;
}

function applySuccessfulSave(
  stateInput: RemoteCampaignFragmentState,
  changes: CampaignFragmentChange[],
  characterChanges: CharacterVersionChange[],
  result: RemoteCampaignFragmentSaveResult,
): RemoteCampaignFragmentState {
  const state = copyState(stateInput);
  const revisions = new Map(result.fragments.map((fragment) => [fragmentIdentity(fragment), fragment]));
  const fragments = new Map(state.fragments.map((fragment) => [fragmentIdentity(fragment), fragment]));
  for (const change of changes) {
    const key = fragmentIdentity(change);
    const revision = revisions.get(key);
    if (!revision) throw new CampaignRepositoryCorruptionError(`Missing saved fragment revision for ${key}`);
    if (change.operation === "delete") {
      fragments.delete(key);
      continue;
    }
    fragments.set(key, {
      kind: change.kind,
      parentId: change.parentId,
      entityId: change.entityId,
      position: change.position,
      payload: structuredClone(change.payload),
      revision: revision.revision,
    });
  }

  const characters = new Map(state.characters.map((character) => [character.characterId, character]));
  const returnedCharacters = new Map(result.characters.map((character) => [character.characterId, character]));
  for (const change of characterChanges) {
    if (change.operation === "delete") {
      characters.delete(change.characterId);
      continue;
    }
    const character = returnedCharacters.get(change.characterId);
    if (!character) {
      throw new CampaignRepositoryCorruptionError(`Missing saved character version for ${change.characterId}`);
    }
    characters.set(change.characterId, character);
  }

  return {
    campaignRevision: result.campaignRevision,
    campaignUpdatedAt: result.campaignUpdatedAt,
    updatedBy: result.updatedBy,
    characters: [...characters.values()],
    fragments: [...fragments.values()] as RemoteCampaignFragment[],
  };
}

export class SupabaseGranularCampaignRepository implements CampaignRepository {
  private readonly versions = new Map<string, StoredVersion>();
  private latestRemoteRevision = -1;

  constructor(
    private readonly client: SupabaseCampaignFragmentClient,
    private readonly campaignId: string,
    private readonly onRemoteRevision: (revision: number) => void = () => undefined,
  ) {}

  get remoteRevision(): number {
    return this.latestRemoteRevision;
  }

  async load(): Promise<CampaignSnapshot | null> {
    const stored = await this.fetchStored();
    return stored?.snapshot ?? null;
  }

  async loadVersion(checksum: string): Promise<CampaignSnapshot | null> {
    const stored = this.versions.get(checksum);
    if (stored) return createCampaignSnapshot(stored.snapshot.campaign);
    return this.load();
  }

  async save(campaign: CampaignV2, expectation: SaveExpectation): Promise<CampaignSnapshot> {
    if (expectation.kind === "empty") {
      const current = await this.load();
      if (current) throw new CampaignRepositoryConflictError("empty", current.checksum);
      throw new CampaignRepositoryCorruptionError("The remote campaign has no granular state");
    }
    const base = this.versions.get(expectation.checksum);
    if (!base) throw new CampaignRepositoryConflictError(expectation.checksum, null);
    const local = await createCampaignSnapshot(campaign);
    let working = base;
    let candidate = local;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const diff = diffCampaignFragments(
        working.snapshot.campaign,
        candidate.campaign,
        working.state.fragments,
      );
      if (diff.changes.length === 0 && diff.characterChanges.length === 0) {
        return createCampaignSnapshot(working.snapshot.campaign);
      }
      try {
        const result = await this.client.saveCampaign(
          this.campaignId,
          working.state.campaignRevision,
          candidate.campaign.metadata.updatedAt,
          diff.changes,
          diff.characterChanges,
        );
        if (result.previousCampaignRevision !== working.state.campaignRevision) {
          const latest = await this.fetchStored();
          if (!latest) throw new CampaignRepositoryConflictError(expectation.checksum, null);
          return latest.snapshot;
        }
        const state = applySuccessfulSave(
          working.state,
          diff.changes,
          diff.characterChanges,
          result,
        );
        const snapshot = await createCampaignSnapshot(assembleCampaign(state));
        this.remember({ snapshot, state });
        this.reportRevision(state.campaignRevision);
        return snapshot;
      } catch (error) {
        if (!(error instanceof RemoteCampaignFragmentConflictError)) throw error;
        const remote = await this.fetchStored();
        if (!remote) throw new CampaignRepositoryConflictError(expectation.checksum, null);
        const merged = mergeCampaignChanges(
          base.snapshot.campaign,
          local.campaign,
          remote.snapshot.campaign,
        );
        if (!merged.campaign) {
          throw new CampaignRepositoryConflictError(
            expectation.checksum,
            remote.snapshot.checksum,
            merged.conflictPaths,
          );
        }
        working = remote;
        candidate = await createCampaignSnapshot(merged.campaign);
      }
    }
    const latest = await this.fetchStored();
    throw new CampaignRepositoryConflictError(expectation.checksum, latest?.snapshot.checksum ?? null);
  }

  private async fetchStored(): Promise<StoredVersion | null> {
    const state = await this.client.readCampaign(this.campaignId);
    if (!state) return null;
    let campaign: CampaignV2;
    try {
      campaign = assembleCampaign(state);
    } catch (error) {
      throw new CampaignRepositoryCorruptionError("The granular campaign state is invalid", { cause: error });
    }
    const stored = { snapshot: await createCampaignSnapshot(campaign), state: copyState(state) };
    this.remember(stored);
    this.reportRevision(state.campaignRevision);
    return stored;
  }

  private remember(stored: StoredVersion): void {
    this.versions.delete(stored.snapshot.checksum);
    this.versions.set(stored.snapshot.checksum, stored);
    while (this.versions.size > 20) {
      const oldest = this.versions.keys().next().value as string | undefined;
      if (!oldest) break;
      this.versions.delete(oldest);
    }
  }

  private reportRevision(revision: number): void {
    if (revision < this.latestRemoteRevision) return;
    this.latestRemoteRevision = revision;
    this.onRemoteRevision(revision);
  }
}
