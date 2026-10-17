/** Prepare (never execute) the ECE/shared spell cleanup from a read-only backup. */
import { createServer } from "vite";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
const directory = "tmp/spell-cleanup";
const read = (name) => JSON.parse(readFileSync(`${directory}/${name}.json`,"utf8"));
const write = (name,value) => writeFileSync(`${directory}/${name}.json`,JSON.stringify(value,null,2));
mkdirSync(directory,{ recursive: true });
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { PHB_SPELLS, XANATHAR_SPELL_KEYS } = await server.ssrLoadModule("/src/domain/character/phb-spells.ts");
  const { SpellDefinitionSchema,CharacterSpellV2Schema } = await server.ssrLoadModule("/src/domain/character/character-spell-model.ts");
  const { normalizeSpellDefinition } = await server.ssrLoadModule("/src/domain/spells/spell-catalog.ts");
  const { spellDefinitionSignature,resolveLearnedSpell,spellSourceTag } = await server.ssrLoadModule("/src/domain/spells/spell-source.ts");
  const { localizedManagedSpell } = await server.ssrLoadModule("/src/ui/localized-spells.ts");
  const { serializeSpellContentPayload } = await server.ssrLoadModule("/src/domain/content/content-payload.ts");
  const { migrateLegacyCharacterSpellClasses } = await server.ssrLoadModule("/src/infrastructure/persistence/legacy-spell-class-migration.ts");
  const before = read("ece-spells-before");
  const uses = read("ece-used-spells-before");
  const official = Object.entries(PHB_SPELLS).map(([key,definition]) => ({
    kind: "spell",content_key: definition.catalog.contentKey,name: definition.name,origin: "official",
    tags: [XANATHAR_SPELL_KEYS.has(key) ? "xanathar" : "manual_jugador"],payload: serializeSpellContentPayload(definition),
  }));
  const canonicalBySignature = new Map(Object.entries(PHB_SPELLS).map(([key,value]) => [spellDefinitionSignature(value),{ key,value }]));
  const customs = before.filter((row) => row.deleted_at === null && row.origin !== "official" && row.tags.includes("es") && ["Forjar Constructo","Transferir Eco"].includes(row.name)).map((row) => ({
    ...row,tags: ["custom"],payload: { ...row.payload,language: "es",year: "2014" },
  }));
  if (customs.length !== 2) throw new Error(`Expected exactly the two reviewed Spanish campaign creations; found ${customs.length}`);
  // No unidentified GM material can be silently discarded.
  const reviewedImports = new Set(["Forge Construct","Forjar Constructo","Transfer Echo","Transferir Eco","Fuerza fantasmal (importado)","Phantasmal Force (importado)"]);
  if (before.some((row) => row.deleted_at === null && row.origin !== "official" && !reviewedImports.has(row.name))) throw new Error("Unreviewed campaign creation: audit before deleting anything");
  const customNames = new Set(customs.map((row) => row.name));
  const old = new Map(); const resolution = [];
  for (const fragment of uses) {
    const stored = fragment.payload;
    if (customNames.has(stored.name)) {
      resolution.push({ spellId: fragment.entity_id,characterId: fragment.parent_id,name: stored.name,classification: "custom",contentKey: customs.find((row) => row.name === stored.name).content_key });
      continue;
    }
    const migrated = migrateLegacyCharacterSpellClasses(stored);
    let definition;
    if (stored.definition !== null && stored.definition !== undefined) {
      const parsed = SpellDefinitionSchema.safeParse(migrated.definition);
      if (!parsed.success) throw new Error(`Cannot preserve malformed learned spell ${stored.name}: ${parsed.error}`);
      definition = parsed.data;
      const match = canonicalBySignature.get(spellDefinitionSignature(definition));
      if (match) {
        resolution.push({ spellId: fragment.entity_id,characterId: fragment.parent_id,name: stored.name,classification: match.value.catalog.tags[0],contentKey: match.value.catalog.contentKey });
        continue;
      }
    } else {
      definition = normalizeSpellDefinition({ name: stored.name,level: stored.level,description: "Definición anterior no disponible. Pendiente de reemplazo.",year: "2014" });
    }
    const signature = spellDefinitionSignature(definition);
    const id = createHash("sha256").update(signature).digest("hex");
    const contentKey = `old:spell:${id}`;
    const { catalog: _catalog,...payload } = definition;
    if (!old.has(id)) old.set(id,{ kind: "spell",content_key: contentKey,name: definition.name,origin: "imported",tags: ["old"],payload: { ...payload,retainedDefinitionMissing: !stored.definition,retainedRawDefinition: stored.definition ?? null },usedBy: [] });
    old.get(id).usedBy.push({ characterId: fragment.parent_id,spellId: fragment.entity_id });
    resolution.push({ spellId: fragment.entity_id,characterId: fragment.parent_id,name: stored.name,classification: "old",contentKey });
  }
  const deletedRows = before.filter((row) => !customs.some((custom) => custom.content_key === row.content_key));
  const plan = { campaignId: "9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd",official,customs,old: [...old.values()],resolution,deletedContentKeys: deletedRows.map((row) => row.content_key) };
  if (official.length !== 456 || resolution.length !== uses.length || new Set(resolution.map((r) => `${r.characterId}:${r.spellId}`)).size !== uses.length) throw new Error("Incomplete coverage");
  const projectedCatalog=[...official,...customs,...old.values()].map((row)=>({ ...normalizeSpellDefinition(row.payload),catalog: { contentKey: row.content_key,origin: row.origin,tags: row.tags,revision: 0 } }));
  for (const [i,fragment] of uses.entries()) {
    const spell=CharacterSpellV2Schema.parse(migrateLegacyCharacterSpellClasses(fragment.payload));
    const projected=localizedManagedSpell(resolveLearnedSpell(spell,projectedCatalog));
    if (spellSourceTag(projected.definition)!==resolution[i].classification) throw new Error(`Classification lost in UI projection: ${spell.name}`);
    if (spell.definition && spellDefinitionSignature(projected.definition)!==spellDefinitionSignature(spell.definition)) throw new Error(`A character's rules would be silently changed: ${spell.name}`);
  }
  write("plan",plan);
  const counts = { official: official.length,manual_jugador: official.filter((row) => row.tags[0] === "manual_jugador").length,xanathar: official.filter((row) => row.tags[0] === "xanathar").length,custom: customs.length,oldVersions: old.size,learned: uses.length,learnedClassification: Object.fromEntries([...new Set(resolution.map((r) => r.classification))].map((tag) => [tag,resolution.filter((r) => r.classification === tag).length])),eceRowsToRemove: deletedRows.length,eceResultRows: official.length+customs.length+old.size,deletedTombstones: deletedRows.filter((row) => row.deleted_at !== null).length };
  write("counts",counts);
  console.log(JSON.stringify(counts));
} finally { await server.close(); }
