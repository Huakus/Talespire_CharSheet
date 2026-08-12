import {
  CampaignV2Schema,
  CharacterV2Schema,
  type CampaignV2,
  type CharacterV2,
} from "../../src/domain/character/character-v2";
import { createCharacter } from "../../src/domain/character/create-character";
import { STABLE_ID_PATTERN } from "../../src/shared/id";

export const testTimestamp = "2026-07-25T12:00:00.000Z";

function fixtureId(label: string): string {
  if (STABLE_ID_PATTERN.test(label)) return label;
  const kind = (label.split(/[-_]/)[0] ?? "test").replace(/[^a-z0-9-]/g, "") || "test";
  const hash = (input: string) => {
    let value = 0x811c9dc5;
    for (const character of input) {
      value ^= character.charCodeAt(0);
      value = Math.imul(value, 0x01000193);
    }
    return (value >>> 0).toString(16).padStart(8, "0");
  };
  return `${kind}_${[0, 1, 2, 3].map((salt) => hash(`${salt}:${label}`)).join("")}`;
}

function normalizeFixtureIds(value: unknown): void {
  const replacements = new Map<string, string>();
  const collect = (current: unknown): void => {
    if (!current || typeof current !== "object") return;
    for (const [key, entry] of Object.entries(current)) {
      if (key === "id" && typeof entry === "string" && !STABLE_ID_PATTERN.test(entry)) {
        replacements.set(entry, fixtureId(entry));
      } else collect(entry);
    }
  };
  const replace = (current: unknown): void => {
    if (!current || typeof current !== "object") return;
    for (const [key, entry] of Object.entries(current)) {
      if (typeof entry === "string" && replacements.has(entry)) {
        Reflect.set(current, key, replacements.get(entry));
      } else replace(entry);
    }
  };
  collect(value);
  replace(value);
}

export function createTestCharacter(options: {
  id?: string;
  name?: string;
  createdAt?: string;
  configure?: (character: CharacterV2) => void;
} = {}): CharacterV2 {
  const character = createCharacter(
    fixtureId(options.id ?? "character-test"),
    options.name ?? "Hero",
    options.createdAt ?? testTimestamp,
  );
  options.configure?.(character);
  normalizeFixtureIds(character);
  return CharacterV2Schema.parse(character);
}

export function createTestCampaign(options: {
  id?: string;
  createdAt?: string;
  character?: CharacterV2;
} = {}): CampaignV2 {
  const createdAt = options.createdAt ?? testTimestamp;
  const character = options.character ?? createTestCharacter({ createdAt });
  return CampaignV2Schema.parse({
    schemaVersion: 2,
    id: fixtureId(options.id ?? "campaign-test"),
    revision: 0,
    characters: { [character.id]: character },
    encounters: {},
    gm: { noteGroups: [], randomTables: [], googleDocsUrl: "" },
    metadata: { createdAt, updatedAt: createdAt },
  });
}
