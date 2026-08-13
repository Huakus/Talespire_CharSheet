import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type {
  CampaignLoreReader,
  LoreDocument,
  LoreDocumentReference,
  LoreEntryType,
  LoreIndex,
  LoreIndexEntry,
  LoreSearchResult,
} from "../../application/ports/campaign-lore-reader";

const LoreEntryTypeSchema = z.enum(["chapter", "character", "location", "event"]);
const ChapterIndexRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  chapter_number: z.coerce.number().int().positive(),
  title: z.string(),
  source_path: z.string().nullable(),
});
const NamedIndexRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  source_path: z.string().nullable(),
});
const EventIndexRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  title: z.string(),
  source_order: z.coerce.number().int().nullable(),
  source_path: z.string().nullable(),
});
const ChapterRowSchema = ChapterIndexRowSchema.extend({ content_md: z.string() });
const NamedDocumentRowSchema = NamedIndexRowSchema.extend({ description: z.string() });
const EventDocumentRowSchema = EventIndexRowSchema.extend({ description: z.string() });
const SearchRowSchema = z.object({
  result_type: LoreEntryTypeSchema,
  result_id: z.coerce.number().int().positive(),
  result_name: z.string(),
  chapter_number: z.coerce.number().int().positive().nullable(),
  rank: z.coerce.number(),
  excerpt: z.string(),
});
const LinkRowSchema = z.object({ chapter_id: z.coerce.number().int().positive() });
const EntityLinkRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  title: z.string(),
  chapter_number: z.coerce.number().int().positive().nullable().optional(),
});

type SupabaseError = { message: string; code?: string; details?: string };

function throwQueryError(error: SupabaseError | null): void {
  if (!error) return;
  const details = error.details ? ` (${error.details})` : "";
  throw new Error(`${error.message}${details}`);
}

function indexEntry(input: Omit<LoreIndexEntry, "aliases" | "chapterNumber" | "sourceOrder" | "sourcePath"> & Partial<LoreIndexEntry>): LoreIndexEntry {
  return {
    aliases: [],
    chapterNumber: null,
    sourceOrder: null,
    sourcePath: null,
    ...input,
  };
}

export class SupabaseCampaignLoreClient implements CampaignLoreReader {
  constructor(
    private readonly client: SupabaseClient,
    private readonly campaignId: string,
  ) {}

  async loadIndex(): Promise<LoreIndex> {
    const [chaptersResult, charactersResult, locationsResult, eventsResult] = await Promise.all([
      this.client.from("lore_chapters").select("id,chapter_number,title,source_path").eq("campaign_id", this.campaignId).order("chapter_number"),
      this.client.from("lore_characters").select("id,name,aliases,source_path").eq("campaign_id", this.campaignId).order("name"),
      this.client.from("lore_locations").select("id,name,aliases,source_path").eq("campaign_id", this.campaignId).order("name"),
      this.client.from("lore_events").select("id,title,source_order,source_path").eq("campaign_id", this.campaignId).order("source_order"),
    ]);
    for (const result of [chaptersResult, charactersResult, locationsResult, eventsResult]) throwQueryError(result.error);

    const chapters = z.array(ChapterIndexRowSchema).parse(chaptersResult.data).map((row) => indexEntry({
      type: "chapter", id: row.id, title: row.title, chapterNumber: row.chapter_number, sourcePath: row.source_path,
    }));
    const namedEntries = (type: "character" | "location", data: unknown): LoreIndexEntry[] => z.array(NamedIndexRowSchema).parse(data).map((row) => indexEntry({
      type, id: row.id, title: row.name, aliases: row.aliases, sourcePath: row.source_path,
    }));
    const events = z.array(EventIndexRowSchema).parse(eventsResult.data).map((row) => indexEntry({
      type: "event", id: row.id, title: row.title, sourceOrder: row.source_order, sourcePath: row.source_path,
    }));
    return { entries: [...chapters, ...namedEntries("character", charactersResult.data), ...namedEntries("location", locationsResult.data), ...events] };
  }

  async search(query: string, limit = 30): Promise<LoreSearchResult[]> {
    const normalized = query.trim();
    if (!normalized) return [];
    const result = await this.client.rpc("search_campaign_lore", {
      p_campaign_id: this.campaignId,
      p_query: normalized,
      p_limit: Math.max(1, Math.min(100, Math.trunc(limit))),
    });
    throwQueryError(result.error);
    return z.array(SearchRowSchema).parse(result.data).map((row) => ({
      type: row.result_type,
      id: row.result_id,
      title: row.result_name,
      chapterNumber: row.chapter_number,
      rank: row.rank,
      excerpt: row.excerpt,
    }));
  }

  async read(type: LoreEntryType, id: number): Promise<LoreDocument | null> {
    if (type === "chapter") return this.readChapter(id);
    const table = type === "character" ? "lore_characters" : type === "location" ? "lore_locations" : "lore_events";
    const selection = type === "event" ? "id,title,description,source_order,source_path" : "id,name,aliases,description,source_path";
    const result = await this.client.from(table).select(selection).eq("campaign_id", this.campaignId).eq("id", id).maybeSingle();
    throwQueryError(result.error);
    if (result.data === null) return null;
    const related = await this.relatedChapters(type, id);
    if (type === "event") {
      const row = EventDocumentRowSchema.parse(result.data);
      return {
        type, id: row.id, title: row.title, contentMarkdown: row.description, aliases: [], chapterNumber: related[0]?.chapterNumber ?? null,
        sourceOrder: row.source_order, sourcePath: row.source_path, related,
      };
    }
    const row = NamedDocumentRowSchema.parse(result.data);
    return {
      type, id: row.id, title: row.name, contentMarkdown: row.description, aliases: row.aliases, chapterNumber: null,
      sourceOrder: null, sourcePath: row.source_path, related,
    };
  }

  private async readChapter(id: number): Promise<LoreDocument | null> {
    const result = await this.client.from("lore_chapters")
      .select("id,chapter_number,title,content_md,source_path")
      .eq("campaign_id", this.campaignId).eq("id", id).maybeSingle();
    throwQueryError(result.error);
    if (result.data === null) return null;
    const row = ChapterRowSchema.parse(result.data);
    return {
      type: "chapter", id: row.id, title: row.title, contentMarkdown: row.content_md, aliases: [], chapterNumber: row.chapter_number,
      sourceOrder: null, sourcePath: row.source_path, related: await this.relatedEntities(id),
    };
  }

  private async relatedChapters(type: Exclude<LoreEntryType, "chapter">, id: number): Promise<LoreDocumentReference[]> {
    const relation = type === "character"
      ? { table: "lore_chapter_characters", key: "character_id" }
      : type === "location"
        ? { table: "lore_chapter_locations", key: "location_id" }
        : { table: "lore_chapter_events", key: "event_id" };
    const linksResult = await this.client.from(relation.table).select("chapter_id").eq(relation.key, id);
    throwQueryError(linksResult.error);
    const ids = z.array(LinkRowSchema).parse(linksResult.data).map((row) => row.chapter_id);
    if (!ids.length) return [];
    const chaptersResult = await this.client.from("lore_chapters").select("id,title,chapter_number").eq("campaign_id", this.campaignId).in("id", ids).order("chapter_number");
    throwQueryError(chaptersResult.error);
    return z.array(EntityLinkRowSchema).parse(chaptersResult.data).map((row) => ({
      type: "chapter", id: row.id, title: row.title, chapterNumber: row.chapter_number ?? null,
    }));
  }

  private async relatedEntities(chapterId: number): Promise<LoreDocumentReference[]> {
    const relations = [
      { type: "character" as const, linkTable: "lore_chapter_characters", linkKey: "character_id", table: "lore_characters", title: "name" },
      { type: "location" as const, linkTable: "lore_chapter_locations", linkKey: "location_id", table: "lore_locations", title: "name" },
      { type: "event" as const, linkTable: "lore_chapter_events", linkKey: "event_id", table: "lore_events", title: "title" },
    ];
    const groups = await Promise.all(relations.map(async (relation): Promise<LoreDocumentReference[]> => {
      const links = await this.client.from(relation.linkTable).select(relation.linkKey).eq("chapter_id", chapterId);
      throwQueryError(links.error);
      const ids = z.array(z.record(z.string(), z.coerce.number().int().positive())).parse(links.data).map((row) => row[relation.linkKey]!).filter(Boolean);
      if (!ids.length) return [];
      const entities = await this.client.from(relation.table).select(`id,${relation.title}`).eq("campaign_id", this.campaignId).in("id", ids).order(relation.title);
      throwQueryError(entities.error);
      return z.array(z.record(z.string(), z.unknown())).parse(entities.data).map((row) => ({
        type: relation.type,
        id: z.coerce.number().int().positive().parse(row.id),
        title: z.string().parse(row[relation.title]),
        chapterNumber: null,
      }));
    }));
    return groups.flat();
  }
}
