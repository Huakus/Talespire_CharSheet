import type { CharacterV2 } from "../../domain/character/character-v2";
import type { TaleSpireApiSubset } from "./talespire-campaign-blob-store";

type MiniatureLink = NonNullable<CharacterV2["taleSpire"]>;

export interface MiniatureImageDiagnostic {
  creatureId: string;
  stage: string;
  status: "loading" | "error" | "element-returned";
  startedAt: string;
  updatedAt: string;
  boardAssetId?: string;
  activeMorphIndex?: unknown;
  morphCount?: number;
  packCount?: number;
  elementTag?: string;
  responses: Record<string, unknown>;
  error?: string;
}

type ObserveImage = (stage: string, request: () => Promise<unknown>) => Promise<unknown>;
const observeImage: ObserveImage = async (_stage, request) => request();

function responseShape(value: unknown): unknown {
  if (Array.isArray(value)) return { type: "array", length: value.length, firstKeys: Object.keys(object(value[0])).slice(0, 20) };
  return { type: value === null ? "null" : typeof value, keys: Object.keys(object(value)).slice(0, 20) };
}

export class TaleSpireMiniatureImageError extends Error {
  constructor(readonly stage: string, readonly reason: string) {
    super(`TALESPIRE_MINIATURE_IMAGE:${stage}:${reason}`);
    this.name = "TaleSpireMiniatureImageError";
  }
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && !Array.isArray(value) && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
}

// Native calls can resolve to { cause: ... } instead of rejecting their promise.
function apiResult(value: unknown, stage: string): unknown {
  const cause = object(value).cause;
  if (cause !== undefined && cause !== null) {
    let reason: string;
    try { reason = typeof cause === "string" ? cause : JSON.stringify(cause) ?? String(cause); }
    catch { reason = String(cause); }
    throw new TaleSpireMiniatureImageError(stage, reason.slice(0, 1000));
  }
  return value;
}

function apiArray(value: unknown, stage: string): unknown[] {
  const result = apiResult(value, stage);
  if (!Array.isArray(result)) throw new TaleSpireMiniatureImageError(stage, "invalid-response");
  return result;
}

export class TaleSpireMiniatureAdapter {
  private packs: Promise<unknown> | undefined;
  private readonly changeListeners = new Set<(creatureId: string | null) => void>();
  private readonly imageDiagnostics = new Map<string, MiniatureImageDiagnostic>();

  constructor(private readonly api: Pick<TaleSpireApiSubset, "creatures" | "contentPacks">) {}

  getImageDiagnostics(): { capabilities: Record<string, boolean>; images: MiniatureImageDiagnostic[] } {
    return {
      capabilities: {
        creatureInfo: typeof this.api.creatures?.getMoreInfo === "function",
        contentPacks: typeof this.api.contentPacks?.getContentPacks === "function",
        contentPackInfo: typeof this.api.contentPacks?.getMoreInfo === "function",
        modelLookup: typeof this.api.contentPacks?.findBoardObjectInPacks === "function",
        thumbnail: typeof this.api.contentPacks?.createThumbnailElementForBoardObject === "function",
      },
      images: [...this.imageDiagnostics.values()].map((entry) => ({ ...entry, responses: { ...entry.responses } })),
    };
  }

  subscribeChanges(listener: (creatureId: string | null) => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  handleStateChange(event: unknown): void {
    const state = object(event);
    if (state.kind !== "creatureActiveMorphChanged" && state.kind !== "creatureMorphsChanged") return;
    const id = object(state.payload).id;
    if (typeof id === "string" && id) this.changeListeners.forEach((listener) => listener(id));
  }

  handleContentPackChange(event: unknown): void {
    const kind = object(event).kind;
    if (kind !== "contentPackAdded" && kind !== "contentPackRemoved") return;
    this.packs = undefined;
    this.changeListeners.forEach((listener) => listener(null));
  }

  async selectFirst(): Promise<MiniatureLink> {
    if (!this.api.creatures) throw new Error("TaleSpire creature selection is unavailable");
    const selected = await this.api.creatures.getSelectedCreatures();
    const first = Array.isArray(selected) ? selected[0] : null;
    const selectedId = typeof first === "string" ? first : String(object(first).id ?? "");
    if (!selectedId) {
      throw new Error("Seleccioná una miniatura en TaleSpire antes de vincularla.");
    }
    return this.getMiniature(selectedId);
  }

  async getMiniature(selectedId: string): Promise<MiniatureLink> {
    return this.resolveMiniature(selectedId);
  }

  private async resolveMiniature(selectedId: string, observe = observeImage, diagnostic?: MiniatureImageDiagnostic): Promise<MiniatureLink> {
    if (!this.api.creatures) throw new TaleSpireMiniatureImageError("creature-info", "api-unavailable");
    const infoResult = apiArray(await observe("creature-info", () => this.api.creatures!.getMoreInfo([selectedId])), "creature-info");
    const info = object(infoResult.find((entry) => {
      const id = object(entry).id;
      return typeof id === "string" && id.toLowerCase() === selectedId.toLowerCase();
    }));
    if (typeof info.id !== "string") throw new TaleSpireMiniatureImageError("creature-info", "miniature-not-found");
    const morphs = Array.isArray(info.morphs) ? info.morphs.map(object) : [];
    if (diagnostic) {
      diagnostic.stage = "active-model";
      diagnostic.activeMorphIndex = info.activeMorphIndex ?? 0;
      diagnostic.morphCount = morphs.length;
    }
    const activeMorph = morphs[Number(info.activeMorphIndex ?? 0)] ?? {};
    if (typeof activeMorph.boardAssetId !== "string" || !activeMorph.boardAssetId.trim()) {
      throw new TaleSpireMiniatureImageError("active-model", "model-not-ready");
    }
    return {
      creatureId: String(info.id ?? selectedId),
      displayName: String(info.name ?? info.creatureName ?? "Miniatura vinculada"),
      boardAssetId: activeMorph.boardAssetId,
    };
  }

  async createCreatureThumbnail(creatureId: string): Promise<HTMLElement | null> {
    const now = new Date().toISOString();
    const diagnostic: MiniatureImageDiagnostic = { creatureId, stage: "creature-info", status: "loading",
      startedAt: now, updatedAt: now, responses: {} };
    this.imageDiagnostics.delete(creatureId);
    this.imageDiagnostics.set(creatureId, diagnostic);
    if (this.imageDiagnostics.size > 100) this.imageDiagnostics.delete(this.imageDiagnostics.keys().next().value!);
    const observe: ObserveImage = async (stage, request) => {
      diagnostic.stage = stage;
      diagnostic.updatedAt = new Date().toISOString();
      const result = await request();
      diagnostic.responses[stage] = responseShape(result);
      return result;
    };
    try {
      const link = await this.resolveMiniature(creatureId, observe, diagnostic);
      diagnostic.boardAssetId = link.boardAssetId;
      const element = await this.loadThumbnail(link, 64, observe, diagnostic);
      diagnostic.status = "element-returned";
      diagnostic.stage = "element-returned";
      if (element) diagnostic.elementTag = element.tagName;
      return element;
    } catch (error) {
      diagnostic.status = "error";
      if (error instanceof TaleSpireMiniatureImageError) diagnostic.stage = error.stage;
      diagnostic.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally { diagnostic.updatedAt = new Date().toISOString(); }
  }

  async createThumbnail(link: MiniatureLink, size = 128): Promise<HTMLElement | null> {
    return this.loadThumbnail(link, size);
  }

  private async loadThumbnail(link: MiniatureLink, size: number, observe = observeImage, diagnostic?: MiniatureImageDiagnostic): Promise<HTMLElement | null> {
    const contentPacks = this.api.contentPacks;
    if (!contentPacks) throw new TaleSpireMiniatureImageError("content-packs", "api-unavailable");
    if (!link.boardAssetId) throw new TaleSpireMiniatureImageError("active-model", "model-not-ready");
    if (!this.packs) {
      const request = observe("content-packs", () => contentPacks.getContentPacks())
        .then((fragments) => observe("content-pack-info", () => contentPacks.getMoreInfo(apiArray(fragments, "content-packs"))))
        .then((packs) => apiArray(packs, "content-pack-info"));
      this.packs = request;
      void request.catch(() => { if (this.packs === request) this.packs = undefined; });
    }
    const packRequest = this.packs;
    try {
      if (diagnostic) diagnostic.stage = "content-packs";
      const packs = await packRequest;
      if (diagnostic && Array.isArray(packs)) diagnostic.packCount = packs.length;
      const found = object(apiResult(await observe("model-lookup", () => contentPacks.findBoardObjectInPacks(link.boardAssetId!, packs)), "model-lookup"));
      if (!found.boardObject) throw new TaleSpireMiniatureImageError("model-lookup", "model-not-found");
      const thumbnail = apiResult(await observe("thumbnail", () => contentPacks.createThumbnailElementForBoardObject(found.boardObject, size)), "thumbnail");
      // The API element can originate in another browser realm. Test DOM identity,
      // rather than rejecting it solely because instanceof HTMLElement is false.
      const element = thumbnail as HTMLElement | null;
      if (!element || element.nodeType !== 1 || typeof element.setAttribute !== "function") {
        throw new TaleSpireMiniatureImageError("thumbnail", "invalid-element");
      }
      element.classList.add("gm-miniature-render");
      element.setAttribute("data-talespire-board-asset-id", link.boardAssetId);
      return element;
    } catch (error) {
      // A pack may still be loading, or a new pack may contain this active model.
      if (this.packs === packRequest) this.packs = undefined;
      throw error;
    }
  }
}
