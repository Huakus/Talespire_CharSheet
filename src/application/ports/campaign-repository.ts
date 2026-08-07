import type { CampaignV2 } from "../../domain/character/character-v2";

export interface CampaignSnapshot {
  campaign: CampaignV2;
  checksum: string;
}

export type SaveExpectation =
  | { kind: "empty" }
  | { kind: "checksum"; checksum: string };

export interface CampaignRepository {
  load(): Promise<CampaignSnapshot | null>;
  /**
   * Returns a previously loaded version when the adapter keeps version history.
   * Remote adapters use this as the base for a three-way merge; local adapters
   * may omit it and retain strict whole-document compare-and-save semantics.
   */
  loadVersion?(checksum: string): Promise<CampaignSnapshot | null>;
  save(
    campaign: CampaignV2,
    expectation: SaveExpectation,
  ): Promise<CampaignSnapshot>;
}

export class CampaignRepositoryConflictError extends Error {
  constructor(
    readonly expected: string,
    readonly actual: string | null,
    readonly conflictPaths: readonly string[] = [],
  ) {
    super(
      conflictPaths.length === 0
        ? `Campaign persistence conflict: expected ${expected}, found ${actual ?? "empty"}`
        : `Campaign persistence conflict at ${conflictPaths.join(", ")}`,
    );
    this.name = "CampaignRepositoryConflictError";
  }
}

export async function loadCampaignVersion(
  repository: CampaignRepository,
  expectedChecksum: string,
): Promise<CampaignSnapshot | null> {
  const snapshot = repository.loadVersion
    ? await repository.loadVersion(expectedChecksum)
    : await repository.load();
  if (snapshot !== null && snapshot.checksum !== expectedChecksum) {
    throw new CampaignRepositoryConflictError(expectedChecksum, snapshot.checksum);
  }
  return snapshot;
}

export class CampaignRepositoryCorruptionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CampaignRepositoryCorruptionError";
  }
}
