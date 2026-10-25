// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { TaleSpireMiniatureAdapter } from "../../src/infrastructure/talespire/talespire-miniature";

function thumbnailFixture() {
  const creatures = {
    getSelectedCreatures: async () => [],
    getMoreInfo: vi.fn(async (): Promise<unknown> => [{ id: "mini-a", name: "Goblin", activeMorphIndex: 1,
      morphs: [{ boardAssetId: "old-model" }, { boardAssetId: "active-model" }] }]),
  };
  const contentPacks = {
    getContentPacks: vi.fn(async (): Promise<unknown> => [{ id: "pack" }]),
    getMoreInfo: vi.fn(async (): Promise<unknown> => [{ id: "pack", creatures: [] }]),
    findBoardObjectInPacks: vi.fn(async (): Promise<unknown> => ({ boardObject: { id: "active-model" } })),
    createThumbnailElementForBoardObject: vi.fn(async (): Promise<unknown> => document.createElement("span")),
  };
  return { creatures, contentPacks, adapter: new TaleSpireMiniatureAdapter({ creatures, contentPacks }) };
}

describe("combat miniature images", () => {
  it("exposes the failing native stage, response shape and detected model without dumping the content packs", async () => {
    const f = thumbnailFixture();
    f.contentPacks.findBoardObjectInPacks.mockResolvedValueOnce({ cause: "notReady" });
    await expect(f.adapter.createCreatureThumbnail("mini-a")).rejects.toThrow("notReady");
    expect(f.adapter.getImageDiagnostics()).toMatchObject({
      capabilities: { creatureInfo: true, contentPacks: true, thumbnail: true },
      images: [{ creatureId: "mini-a", boardAssetId: "active-model", activeMorphIndex: 1, morphCount: 2,
        packCount: 1, stage: "model-lookup", status: "error", error: "TALESPIRE_MINIATURE_IMAGE:model-lookup:notReady",
        responses: { "model-lookup": { type: "object", keys: ["cause"] } } }],
    });
    await f.adapter.createCreatureThumbnail("mini-a");
    expect(f.adapter.getImageDiagnostics().images[0]).toMatchObject({ status: "element-returned", elementTag: "SPAN" });
    expect(f.adapter.getImageDiagnostics().images[0]).not.toHaveProperty("error");
  });

  it("keeps a pending API stage visible and does not let an older request replace newer diagnostics", async () => {
    const f = thumbnailFixture();
    let resolveOld!: (value: unknown) => void;
    f.creatures.getMoreInfo.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
    const old = f.adapter.createCreatureThumbnail("mini-a");
    expect(f.adapter.getImageDiagnostics().images[0]).toMatchObject({ status: "loading", stage: "creature-info" });
    await f.adapter.createCreatureThumbnail("mini-a");
    resolveOld({ cause: "old-error" });
    await expect(old).rejects.toThrow("old-error");
    expect(f.adapter.getImageDiagnostics().images[0]).toMatchObject({ status: "element-returned" });
  });

  it("reports missing capabilities and missing creature APIs explicitly", async () => {
    const adapter = new TaleSpireMiniatureAdapter({});
    await expect(adapter.createCreatureThumbnail("mini-a")).rejects.toThrow("creature-info:api-unavailable");
    expect(adapter.getImageDiagnostics()).toMatchObject({ capabilities: { creatureInfo: false, thumbnail: false },
      images: [{ stage: "creature-info", status: "error" }] });
  });

  it.each([
    ["getContentPacks", "content-packs"], ["getMoreInfo", "content-pack-info"],
    ["findBoardObjectInPacks", "model-lookup"], ["createThumbnailElementForBoardObject", "thumbnail"],
  ] as const)("recovers from native error objects returned by %s without caching the failure", async (method, stage) => {
    const f = thumbnailFixture();
    f.contentPacks[method].mockResolvedValueOnce({ cause: "notReady" });
    await expect(f.adapter.createCreatureThumbnail("mini-a")).rejects.toThrow(`:${stage}:notReady`);
    const image = await f.adapter.createCreatureThumbnail("mini-a");
    expect(image?.getAttribute("data-talespire-board-asset-id")).toBe("active-model");
    expect(image?.classList.contains("gm-miniature-render")).toBe(true);
    expect(f.contentPacks.getContentPacks).toHaveBeenCalledTimes(2);
  });

  it("uses the requested instance rather than another mini returned first in the response", async () => {
    const f = thumbnailFixture();
    f.creatures.getMoreInfo.mockResolvedValueOnce([
      { id: "other-mini", activeMorphIndex: 0, morphs: [{ boardAssetId: "wrong-model" }] },
      { id: "mini-a", activeMorphIndex: 0, morphs: [{ boardAssetId: "right-model" }] },
    ]);
    await f.adapter.createCreatureThumbnail("mini-a");
    expect(f.contentPacks.findBoardObjectInPacks).toHaveBeenCalledWith("right-model", expect.any(Array));
  });

  it("refreshes cached pack metadata when TaleSpire adds a content pack", async () => {
    const f = thumbnailFixture();
    const changed: (string | null)[] = [];
    f.adapter.subscribeChanges((id) => changed.push(id));
    await f.adapter.createCreatureThumbnail("mini-a");
    f.adapter.handleContentPackChange({ kind: "contentPackAdded", payload: { contentPackId: "custom-pack" } });
    await f.adapter.createCreatureThumbnail("mini-a");
    expect(changed).toEqual([null]);
    expect(f.contentPacks.getContentPacks).toHaveBeenCalledTimes(2);
  });

  it("does not replace a miniature with another model when its active form is not ready", async () => {
    const f = thumbnailFixture();
    f.creatures.getMoreInfo.mockResolvedValueOnce([{ id: "mini-a", activeMorphIndex: 2, morphs: [{ boardAssetId: "old-model" }] }]);
    await expect(f.adapter.createCreatureThumbnail("mini-a")).rejects.toThrow(":active-model:model-not-ready");
    expect(f.contentPacks.findBoardObjectInPacks).not.toHaveBeenCalled();
  });
  it("invalidates instance thumbnails when their active model changes", () => {
    const adapter = new TaleSpireMiniatureAdapter({});
    const changed: (string | null)[] = [];
    const unsubscribe = adapter.subscribeChanges((id) => changed.push(id));
    adapter.handleStateChange({ kind: "creatureActiveMorphChanged", payload: { id: "mini-a", activeMorphIndex: 1 } });
    adapter.handleStateChange({ kind: "creatureHpChanged", payload: { id: "mini-a" } });
    unsubscribe();
    adapter.handleStateChange({ kind: "creatureMorphsChanged", payload: { id: "mini-b" } });
    expect(changed).toEqual(["mini-a"]);
  });
  it("looks up each queued instance and shares one content pack request across concurrent cards", async () => {
    const creatures = {
      getSelectedCreatures: vi.fn(async () => []),
      getMoreInfo: vi.fn(async (ids: string[]) => [{ id: ids[0], name: ids[0], activeMorphIndex: 1,
        morphs: [{ boardAssetId: "old-model" }, { boardAssetId: `${ids[0]}-model` }] }]),
    };
    const contentPacks = {
      getContentPacks: vi.fn(async () => ["pack"]),
      getMoreInfo: vi.fn(async () => [{ id: "pack" }]),
      findBoardObjectInPacks: vi.fn(async (id: string) => ({ boardObject: { id } })),
      createThumbnailElementForBoardObject: vi.fn(async () => document.createElement("img")),
    };
    const adapter = new TaleSpireMiniatureAdapter({ creatures, contentPacks });
    const images = await Promise.all([adapter.createCreatureThumbnail("mini-a"), adapter.createCreatureThumbnail("mini-b")]);
    expect(images.every((image) => image instanceof HTMLElement)).toBe(true);
    expect(creatures.getSelectedCreatures).not.toHaveBeenCalled();
    expect(contentPacks.getContentPacks).toHaveBeenCalledTimes(1);
    expect(contentPacks.getMoreInfo).toHaveBeenCalledTimes(1);
    expect(contentPacks.findBoardObjectInPacks.mock.calls.map((args) => args[0])).toEqual(["mini-a-model", "mini-b-model"]);
    expect(contentPacks.createThumbnailElementForBoardObject).toHaveBeenCalledWith({ id: "mini-a-model" }, 64);
  });
});
