// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectMiniatureImage, openMiniatureImageDiagnostics, type MiniatureImageReport } from "../../src/ui/miniature-image-diagnostics";

afterEach(() => { document.querySelector<HTMLDialogElement>("dialog")?.close(); document.body.replaceChildren(); vi.restoreAllMocks(); });

function report(): MiniatureImageReport {
  const slot = document.createElement("span");
  slot.innerHTML = '<img class="gm-miniature-render" src="https://example.test/image?token=private">';
  return { build: { version: "test", sourceHash: "hash", builtAt: "2026-10-20T00:00:00Z" },
    capturedAt: "2026-10-20T00:00:00Z", thumbnailLoaderAvailable: true, capabilities: { thumbnail: true },
    participants: [{ creatureId: "mini-a", name: "<Goblin>", display: inspectMiniatureImage(slot) }] };
}

describe("miniature image diagnostics", () => {
  it("reports broken image content without exposing the resource URL", () => {
    const slot = document.createElement("span");
    const image = document.createElement("img"); image.className = "gm-miniature-render";
    image.src = "https://example.test/image?token=private";
    Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 0 }, naturalHeight: { value: 0 } });
    slot.append(image);
    const snapshot = report(); snapshot.participants[0]!.display = inspectMiniatureImage(slot);
    openMiniatureImageDiagnostics(() => snapshot, () => undefined);
    expect(document.querySelector("dialog")!.textContent).toContain("no tiene contenido cargado");
    const text = document.querySelector("textarea")!.value;
    expect(text).not.toContain("token"); expect(text).not.toContain("example.test");
    expect(JSON.parse(text).participants[0].display.images[0]).toMatchObject({ complete: true, naturalWidth: 0, hasSource: true });
    expect(document.querySelector("goblin")).toBeNull();
  });

  it("selects the displayed report if TaleSpire denies clipboard access", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    openMiniatureImageDiagnostics(report, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-image-copy]")!.click();
    await vi.waitFor(() => expect(document.querySelector("[data-image-feedback]")!.textContent).toContain("Ctrl+C"));
    const field = document.querySelector("textarea")!;
    expect(field.selectionStart).toBe(0); expect(field.selectionEnd).toBe(field.value.length);
  });

  it("makes unavailable APIs and an empty turn list visible", () => {
    const snapshot = report(); snapshot.thumbnailLoaderAvailable = false; snapshot.capabilities.thumbnail = false; snapshot.participants = [];
    openMiniatureImageDiagnostics(() => snapshot, () => undefined);
    expect(document.querySelector("dialog")!.textContent).toContain("API no disponible");
    expect(document.querySelector("dialog")!.textContent).toContain("Funciones de TaleSpire ausentes");
    expect(document.querySelector("dialog")!.textContent).toContain("Sin participantes");
  });
});
