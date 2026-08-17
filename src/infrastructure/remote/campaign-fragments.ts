import { z } from "zod";
import {
  CampaignV2Schema,
  CharacterV2Schema,
  type CampaignV2,
  type CharacterV2,
} from "../../domain/character/character-v2";
import { canonicalJsonStringify, cloneJson, JsonObjectSchema, type JsonObject } from "../../shared/json";
import { migrateLegacyCharacterSpellClasses } from "../persistence/legacy-spell-class-migration";

export const CampaignFragmentKindSchema = z.enum([
  "campaign",
  "character-core",
  "character-runtime",
  "character-action",
  "character-inventory",
  "character-trait",
  "character-note",
  "character-extra",
  "character-spell",
  "encounter",
  "gm-settings",
  "gm-note-group",
  "gm-random-table",
]);

export type CampaignFragmentKind = z.infer<typeof CampaignFragmentKindSchema>;

export interface CampaignFragmentDraft {
  kind: CampaignFragmentKind;
  parentId: string;
  entityId: string;
  position: number;
  payload: JsonObject;
}

export interface RemoteCampaignFragment extends CampaignFragmentDraft {
  revision: number;
}

export interface RemoteCharacterVersion {
  characterId: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface RemoteCampaignFragmentState {
  campaignRevision: number;
  campaignUpdatedAt: string;
  updatedBy: string | null;
  characters: RemoteCharacterVersion[];
  fragments: RemoteCampaignFragment[];
}

export type CampaignFragmentChange =
  | (CampaignFragmentDraft & { operation: "upsert"; expectedRevision: number | null })
  | {
      kind: CampaignFragmentKind;
      parentId: string;
      entityId: string;
      operation: "delete";
      expectedRevision: number;
    };

export type CharacterVersionChange =
  | { characterId: string; operation: "create"; createdAt: string; updatedAt: string }
  | { characterId: string; operation: "touch"; updatedAt: string }
  | { characterId: string; operation: "delete" };

function fragmentKey(value: Pick<CampaignFragmentDraft, "kind" | "parentId" | "entityId">): string {
  return `${value.kind}\u0000${value.parentId}\u0000${value.entityId}`;
}

function object(value: unknown, label: string): JsonObject {
  const parsed = JsonObjectSchema.safeParse(value);
  if (!parsed.success) throw new Error(`${label} must be a JSON object`);
  return parsed.data;
}

function characterFragments(character: CharacterV2): CampaignFragmentDraft[] {
  const {
    revision: _revision,
    metadata: _metadata,
    combat,
    commerce,
    currency,
    spellcasting,
    actions,
    inventory,
    traits,
    notes,
    extras,
    ...core
  } = character;
  const { spells, ...spellcastingRuntime } = spellcasting;
  const parentId = character.id;
  return [
    { kind: "character-core", parentId, entityId: character.id, position: 0, payload: object(core, "character core") },
    {
      kind: "character-runtime",
      parentId,
      entityId: character.id,
      position: 0,
      payload: object({ combat, commerce, currency, spellcasting: spellcastingRuntime }, "character runtime"),
    },
    ...actions.map((payload, position) => ({ kind: "character-action" as const, parentId, entityId: payload.id, position, payload: object(payload, "character action") })),
    ...inventory.map((payload, position) => ({ kind: "character-inventory" as const, parentId, entityId: payload.id, position, payload: object(payload, "inventory item") })),
    ...traits.map((payload, position) => ({ kind: "character-trait" as const, parentId, entityId: payload.id, position, payload: object(payload, "trait group") })),
    ...notes.map((payload, position) => ({ kind: "character-note" as const, parentId, entityId: payload.id, position, payload: object(payload, "note group") })),
    ...extras.map((payload, position) => ({ kind: "character-extra" as const, parentId, entityId: payload.id, position, payload: object(payload, "character extra") })),
    ...spells.map((payload, position) => ({ kind: "character-spell" as const, parentId, entityId: payload.id, position, payload: object(payload, "character spell") })),
  ];
}

export function fragmentCampaign(campaignInput: CampaignV2): CampaignFragmentDraft[] {
  const campaign = CampaignV2Schema.parse(campaignInput);
  return [
    {
      kind: "campaign",
      parentId: "",
      entityId: "root",
      position: 0,
      payload: object({
        schemaVersion: campaign.schemaVersion,
        id: campaign.id,
        metadata: { createdAt: campaign.metadata.createdAt },
      }, "campaign root"),
    },
    ...Object.values(campaign.characters).flatMap(characterFragments),
    ...Object.values(campaign.encounters).map((payload) => ({
      kind: "encounter" as const,
      parentId: "",
      entityId: payload.id,
      position: 0,
      payload: object(payload, "encounter"),
    })),
    {
      kind: "gm-settings",
      parentId: "",
      entityId: "root",
      position: 0,
      payload: object({
        googleDocsUrl: campaign.gm.googleDocsUrl,
        miniatureAssociations: campaign.gm.miniatureAssociations ?? {},
      }, "GM settings"),
    },
    ...campaign.gm.noteGroups.map((payload, position) => ({
      kind: "gm-note-group" as const,
      parentId: "",
      entityId: payload.id,
      position,
      payload: object(payload, "GM note group"),
    })),
    ...campaign.gm.randomTables.map((payload, position) => ({
      kind: "gm-random-table" as const,
      parentId: "",
      entityId: payload.id,
      position,
      payload: object(payload, "GM random table"),
    })),
  ];
}

function payloads(
  fragments: RemoteCampaignFragment[],
  kind: CampaignFragmentKind,
  parentId: string,
): JsonObject[] {
  return fragments
    .filter((fragment) => fragment.kind === kind && fragment.parentId === parentId)
    .sort((left, right) => left.position - right.position || left.entityId.localeCompare(right.entityId))
    .map((fragment) => cloneJson(fragment.payload));
}

export function assembleCampaign(state: RemoteCampaignFragmentState): CampaignV2 {
  const root = state.fragments.find((fragment) =>
    fragment.kind === "campaign" && fragment.parentId === "" && fragment.entityId === "root"
  );
  if (!root) throw new Error("The granular campaign root is missing");
  const settings = state.fragments.find((fragment) =>
    fragment.kind === "gm-settings" && fragment.parentId === "" && fragment.entityId === "root"
  )?.payload ?? { googleDocsUrl: "" };

  const characters = Object.fromEntries(state.characters.map((version) => {
    const core = state.fragments.find((fragment) =>
      fragment.kind === "character-core" && fragment.parentId === version.characterId
    );
    const runtime = state.fragments.find((fragment) =>
      fragment.kind === "character-runtime" && fragment.parentId === version.characterId
    );
    if (!core || !runtime) throw new Error(`Character ${version.characterId} is missing a required fragment`);
    const runtimeSpellcasting = object(runtime.payload.spellcasting, "character spellcasting runtime");
    const character = CharacterV2Schema.parse({
      ...core.payload,
      revision: version.revision,
      combat: runtime.payload.combat,
      commerce: runtime.payload.commerce,
      currency: runtime.payload.currency,
      spellcasting: {
        ...runtimeSpellcasting,
        spells: payloads(state.fragments, "character-spell", version.characterId).map(migrateLegacyCharacterSpellClasses),
      },
      actions: payloads(state.fragments, "character-action", version.characterId),
      inventory: payloads(state.fragments, "character-inventory", version.characterId),
      traits: payloads(state.fragments, "character-trait", version.characterId),
      notes: payloads(state.fragments, "character-note", version.characterId),
      extras: payloads(state.fragments, "character-extra", version.characterId),
      metadata: { createdAt: version.createdAt, updatedAt: version.updatedAt },
    });
    return [character.id, character];
  }));

  const campaignRoot = root.payload;
  const metadata = object(campaignRoot.metadata, "campaign metadata");
  return CampaignV2Schema.parse({
    ...campaignRoot,
    revision: state.campaignRevision,
    characters,
    encounters: Object.fromEntries(payloads(state.fragments, "encounter", "").map((entry) => [String(entry.id), entry])),
    gm: {
      googleDocsUrl: String(settings.googleDocsUrl ?? ""),
      miniatureAssociations: settings.miniatureAssociations ?? {},
      noteGroups: payloads(state.fragments, "gm-note-group", ""),
      randomTables: payloads(state.fragments, "gm-random-table", ""),
    },
    metadata: { createdAt: metadata.createdAt, updatedAt: state.campaignUpdatedAt },
  });
}

export interface CampaignFragmentDiff {
  changes: CampaignFragmentChange[];
  characterChanges: CharacterVersionChange[];
}

export function diffCampaignFragments(
  beforeInput: CampaignV2,
  afterInput: CampaignV2,
  remoteFragments: RemoteCampaignFragment[],
): CampaignFragmentDiff {
  const before = CampaignV2Schema.parse(beforeInput);
  const after = CampaignV2Schema.parse(afterInput);
  const beforeFragments = new Map(fragmentCampaign(before).map((fragment) => [fragmentKey(fragment), fragment]));
  const afterFragments = new Map(fragmentCampaign(after).map((fragment) => [fragmentKey(fragment), fragment]));
  const remote = new Map(remoteFragments.map((fragment) => [fragmentKey(fragment), fragment]));
  const changes: CampaignFragmentChange[] = [];
  const keys = new Set([...beforeFragments.keys(), ...afterFragments.keys()]);

  for (const key of [...keys].sort()) {
    const previous = beforeFragments.get(key);
    const next = afterFragments.get(key);
    if (
      previous && next && previous.position === next.position &&
      canonicalJsonStringify(previous.payload) === canonicalJsonStringify(next.payload)
    ) continue;
    const stored = remote.get(key);
    if (!next) {
      if (!previous || !stored) throw new Error(`Cannot delete unknown campaign fragment ${key}`);
      changes.push({
        kind: previous.kind,
        parentId: previous.parentId,
        entityId: previous.entityId,
        operation: "delete",
        expectedRevision: stored.revision,
      });
      continue;
    }
    if (previous && !stored) throw new Error(`Remote campaign fragment ${key} is missing`);
    changes.push({
      ...next,
      operation: "upsert",
      expectedRevision: stored?.revision ?? null,
    });
  }

  const characterChanges: CharacterVersionChange[] = [];
  const beforeIds = new Set(Object.keys(before.characters));
  const afterIds = new Set(Object.keys(after.characters));
  for (const characterId of [...new Set([...beforeIds, ...afterIds])].sort()) {
    if (!beforeIds.has(characterId)) {
      characterChanges.push({
        characterId,
        operation: "create",
        createdAt: after.characters[characterId]!.metadata.createdAt,
        updatedAt: after.characters[characterId]!.metadata.updatedAt,
      });
      continue;
    }
    if (!afterIds.has(characterId)) {
      characterChanges.push({ characterId, operation: "delete" });
      continue;
    }
    if (changes.some((change) => change.parentId === characterId)) {
      characterChanges.push({
        characterId,
        operation: "touch",
        updatedAt: after.characters[characterId]!.metadata.updatedAt,
      });
    }
  }
  return { changes, characterChanges };
}

export function remoteFragmentMap(fragments: RemoteCampaignFragment[]): Map<string, RemoteCampaignFragment> {
  return new Map(fragments.map((fragment) => [fragmentKey(fragment), fragment]));
}
