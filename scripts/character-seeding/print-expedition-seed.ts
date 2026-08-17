import { fragmentCampaign } from "../../src/infrastructure/remote/campaign-fragments";
import { createDeterministicId } from "../../src/shared/id";
import { createExpeditionCharacters } from "./expedition-characters";

const createdAt = process.argv[2] ?? new Date().toISOString();
const { characters, spellCatalogBindings } = await createExpeditionCharacters(createdAt);
const campaignId = await createDeterministicId("cmp", "expedition-character-seed");
const characterIds = new Set(characters.map((character) => character.id));
const fragments = fragmentCampaign({
  schemaVersion: 2,
  id: campaignId,
  revision: 0,
  characters: Object.fromEntries(characters.map((character) => [character.id, character])),
  encounters: {},
  gm: { noteGroups: [], randomTables: [], googleDocsUrl: "" },
  metadata: { createdAt, updatedAt: createdAt },
}).filter((fragment) => characterIds.has(fragment.parentId));

const serialized = JSON.stringify({
  createdAt,
  characters,
  spellCatalogBindings,
  changes: fragments.map((fragment) => ({ ...fragment, operation: "upsert", expectedRevision: null })),
  characterChanges: characters.map((character) => ({
    characterId: character.id,
    operation: "create",
    createdAt,
    updatedAt: createdAt,
  })),
});

const outputMode = process.argv[3] ?? "all";
if (outputMode === "length") {
  process.stdout.write(String(serialized.length));
} else if (outputMode === "chunk") {
  const start = Number.parseInt(process.argv[4] ?? "0", 10);
  const length = Number.parseInt(process.argv[5] ?? "12000", 10);
  process.stdout.write(serialized.slice(start, start + length));
} else {
  process.stdout.write(serialized);
}
