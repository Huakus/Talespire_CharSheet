import type {
  CampaignRepository,
  CampaignSnapshot,
  SaveExpectation,
} from "../../application/ports/campaign-repository";
import type { CampaignV2 } from "../../domain/character/character-v2";
import {
  assertSaveExpectation,
  createCampaignSnapshot,
} from "./campaign-snapshot";

export class InMemoryCampaignRepository implements CampaignRepository {
  private current: CampaignSnapshot | null = null;
  private writes: Promise<unknown> = Promise.resolve();

  async load(): Promise<CampaignSnapshot | null> {
    return this.current === null
      ? null
      : createCampaignSnapshot(this.current.campaign);
  }

  save(
    campaign: CampaignV2,
    expectation: SaveExpectation,
  ): Promise<CampaignSnapshot> {
    const operation = this.writes.then(async () => {
      assertSaveExpectation(expectation, this.current);
      this.current = await createCampaignSnapshot(campaign);
      return createCampaignSnapshot(this.current.campaign);
    });
    this.writes = operation.catch(() => undefined);
    return operation;
  }
}
