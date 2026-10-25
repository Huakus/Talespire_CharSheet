import type { CampaignRepository, CampaignSnapshot, SaveExpectation } from "../../application/ports/campaign-repository";
import type { CampaignV2 } from "../../domain/character/character-v2";
import type { Encounter } from "../../domain/encounter/encounter-model";
import { assertSaveExpectation, createCampaignSnapshot } from "./campaign-snapshot";

/** One reserved encounter per campaign; legacy encounters stay outside the combat view. */
export const ACTIVE_COMBAT_ID = "enc_00000000000000000000000000000001";

export class CombatSessionRepository implements CampaignRepository {
  private campaignId: string | null = null;
  private session: Encounter | null = null;
  private writes: Promise<unknown> = Promise.resolve();

  constructor(private readonly source: CampaignRepository) {}

  async load(): Promise<CampaignSnapshot | null> {
    const base = await this.source.load();
    if (!base) return null;
    if (this.campaignId !== base.campaign.id || !this.session) {
      const now = new Date().toISOString();
      this.campaignId = base.campaign.id;
      this.session = {
        schemaVersion: 1, id: ACTIVE_COMBAT_ID, revision: 0,
        name: "Combate de TaleSpire", round: 1, activeCombatantId: null, combatants: [],
        metadata: { createdAt: now, updatedAt: now },
      };
    }
    this.session = structuredClone(base.campaign.encounters[ACTIVE_COMBAT_ID] ?? this.session);
    return this.overlay(base);
  }

  save(campaign: CampaignV2, expectation: SaveExpectation): Promise<CampaignSnapshot> {
    const operation = this.writes.then(async () => {
      const current = await this.load();
      assertSaveExpectation(expectation, current);
      if (!current || !this.session) throw new Error("CAMPAIGN_NOT_FOUND");
      const next = campaign.encounters[this.session.id];
      if (!next) throw new Error("COMBAT_SESSION_NOT_FOUND");
      const base = await this.source.load();
      if (!base) throw new Error("CAMPAIGN_NOT_FOUND");
      // Check the source again so a remote character/workspace update cannot be overwritten.
      assertSaveExpectation({ kind: "checksum", checksum: current.checksum }, await this.overlay(base));
      let saved = base;
      if (JSON.stringify(campaign.gm) !== JSON.stringify(base.campaign.gm)
        || JSON.stringify(next) !== JSON.stringify(base.campaign.encounters[ACTIVE_COMBAT_ID])) {
        saved = await this.source.save({
          ...base.campaign, gm: campaign.gm, revision: base.campaign.revision + 1,
          encounters: { ...base.campaign.encounters, [ACTIVE_COMBAT_ID]: next },
          metadata: { ...base.campaign.metadata, updatedAt: campaign.metadata.updatedAt },
        }, { kind: "checksum", checksum: base.checksum });
      }
      this.session = structuredClone(saved.campaign.encounters[ACTIVE_COMBAT_ID] ?? next);
      return this.overlay(saved);
    });
    this.writes = operation.catch(() => undefined);
    return operation;
  }

  private overlay(base: CampaignSnapshot): Promise<CampaignSnapshot> {
    const session = base.campaign.encounters[ACTIVE_COMBAT_ID] ?? this.session;
    return createCampaignSnapshot({
      ...base.campaign, encounters: session ? { [session.id]: session } : {},
    });
  }
}
