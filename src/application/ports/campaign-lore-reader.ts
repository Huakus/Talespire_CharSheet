export type LoreEntryType = "chapter" | "character" | "location" | "event";

export interface LoreIndexEntry {
  type: LoreEntryType;
  id: number;
  title: string;
  aliases: string[];
  chapterNumber: number | null;
  sourceOrder: number | null;
  sourcePath: string | null;
}

export interface LoreIndex {
  entries: LoreIndexEntry[];
}

export interface LoreSearchResult {
  type: LoreEntryType;
  id: number;
  title: string;
  chapterNumber: number | null;
  rank: number;
  excerpt: string;
}

export interface LoreDocumentReference {
  type: LoreEntryType;
  id: number;
  title: string;
  chapterNumber: number | null;
}

export interface LoreDocument {
  type: LoreEntryType;
  id: number;
  title: string;
  contentMarkdown: string;
  aliases: string[];
  chapterNumber: number | null;
  sourceOrder: number | null;
  sourcePath: string | null;
  related: LoreDocumentReference[];
}

export interface CampaignLoreReader {
  loadIndex(): Promise<LoreIndex>;
  search(query: string, limit?: number): Promise<LoreSearchResult[]>;
  read(type: LoreEntryType, id: number): Promise<LoreDocument | null>;
}
